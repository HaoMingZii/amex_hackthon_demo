"""Turn structured model facts into natural-language briefs.

Numbers always come from facts. The LLM (optional) only writes prose.
Without DEEPSEEK_API_KEY / OPENAI_API_KEY, a deterministic template is used so the demo never stalls.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
BUNDLE = ROOT / "bundle"
load_dotenv(ROOT / ".env")
load_dotenv(ROOT.parent / ".env")


def _pct(v, digits=1) -> str:
    if v is None:
        return "n/a"
    return f"{float(v) * 100:.{digits}f}%"


def _num(v, digits=2) -> str:
    if v is None:
        return "n/a"
    return f"{float(v):.{digits}f}"


def _int(v) -> str:
    if v is None:
        return "n/a"
    return f"{int(round(float(v))):,}"


def corridor_template(f: dict) -> dict:
    yoy = f.get("arrivals_yoy")
    mom = f.get("momentum_weighted")
    direction = "accelerating" if (mom or 0) > 0.15 else "mixed"
    fx_note = ""
    if f.get("fx_yoy") is not None:
        fx_note = (
            f"{f['fx_pair']} is {_pct(f['fx_yoy'])} year-on-year, "
            "so currency is a secondary tailwind rather than the main story."
        )
    arrivals_note = (
        f"Official {f['source']} arrivals into {f['destination']} "
        f"were last observed in {f.get('arrivals_latest_month') or 'n/a'} "
        f"at {_int(f.get('arrivals_level'))} visitors "
        f"({_pct(yoy)} YoY)."
    )
    text = (
        f"{f['label']} is the #{f.get('rank', '–')} corridor on the {f['as_of_month']} "
        f"shortlist window. Weighted merchant momentum is {_num(mom, 3)} — {direction} "
        f"versus a flat market. The universe covers {_int(f.get('n_merchants'))} merchants, "
        f"of which {_int(f.get('n_high_potential'))} ({_pct(f.get('high_potential_share'))}) "
        f"are flagged high-potential inside their category cell. "
        f"Lead category is {f.get('top_category')}. {arrivals_note} {fx_note} "
        f"Recommendation: concentrate APAC partnership effort on {f.get('top_category')} "
        f"and the next-ranked category, then feed the execution queue rather than spraying "
        f"the full merchant universe."
    )
    return {
        "level": "corridor",
        "id": f["corridor"],
        "headline": f"{f['label']}: prioritise {f.get('top_category')} first",
        "text": " ".join(text.split()),
        "source": "template",
        "bullets": [
            f"Rank #{f.get('rank')} · momentum {_num(mom, 3)} · HP share {_pct(f.get('high_potential_share'))}",
            f"Lead category: {f.get('top_category')}",
            f"Arrivals {_pct(yoy)} YoY as of {f.get('arrivals_latest_month')}",
        ],
    }


def category_template(f: dict) -> dict:
    names = ", ".join(m["name"] for m in (f.get("top_merchants") or [])[:3]) or "n/a"
    text = (
        f"In {f['label']}, {f['category']} ranks by review-weighted momentum "
        f"({_num(f.get('momentum_weighted'), 3)}) across {_int(f.get('n_merchants'))} merchants. "
        f"{_pct(f.get('share_high_potential'))} of the cell is labelled high-potential for the "
        f"next 3 months. This is a category-priority call for commercial coverage, not a claim "
        f"that every shop is driven by inbound {f.get('destination')} tourism. "
        f"Seed outreach with {names}. Use the execution queue to work the ranked list rather "
        f"than equal effort across the cell."
    )
    return {
        "level": "category",
        "id": f"{f['corridor']}|{f['category']}",
        "headline": f"{f['category']} on {f['label']} is a coverage priority",
        "text": " ".join(text.split()),
        "source": "template",
        "bullets": [
            f"Weighted momentum {_num(f.get('momentum_weighted'), 3)}",
            f"{_int(f.get('n_merchants'))} merchants · HP share {_pct(f.get('share_high_potential'))}",
            f"Seed list: {names}",
        ],
    }


def merchant_template(m: dict) -> dict:
    dist = m.get("hotspot_min_dist_km")
    hotspot = m.get("nearest_hotspot") or "the nearest tourist cluster"
    hp = "high-potential" if m.get("y_high_potential") else "watchlist"
    dist_txt = f"{_num(dist, 1)} km from {hotspot}" if dist is not None else f"near {hotspot}"
    loc = ", ".join(x for x in [m.get("address"), m.get("city")] if x) or "address n/a"
    profile = (
        f"{m.get('name')} is a {m.get('category')} merchant on the {m.get('corridor')} corridor "
        f"({m.get('raw_category') or m.get('category')}). Location: {loc}. "
        f"Rating {_num(m.get('rating'), 2)} on a review base of {_int(m.get('reviews'))}. "
        f"Model score {_num(m.get('score'), 3)} (global rank #{m.get('global_rank')}), "
        f"labelled {hp} inside its corridor × category cell. "
        f"Exposure score {_num(m.get('exposure_score'), 2)}; {dist_txt}. "
        f"Exposure is a geography/language proxy, not a claim about visitor nationality. "
        f"Recent momentum {_num(m.get('momentum_score'), 2)} "
        f"({_num(m.get('reviews_pm_back'), 1)} → {_num(m.get('reviews_pm_fwd'), 1)} reviews/month)."
    )
    hook = (
        f"Hi — we are prioritising {str(m.get('category') or '').lower()} partners near {hotspot} "
        f"on the {m.get('corridor')} corridor. {m.get('name')} scores {_num(m.get('score'), 2)} "
        f"on 3-month momentum. Would you be open to a short AMEX merchant conversation this week?"
    )
    bullets = [
        f"Who: {m.get('name')} · {m.get('category')} · {loc}.",
        f"Why now: score {_num(m.get('score'), 3)}, momentum {_num(m.get('momentum_score'), 2)}, "
        f"labelled {hp}.",
        f"Where: {dist_txt}; exposure {_num(m.get('exposure_score'), 2)} (proxy, not attribution).",
    ]
    talking = [
        f"Open with the {m.get('category')} fit on {m.get('corridor')} and the {hotspot} catchment.",
        f"Cite the held-out model score {_num(m.get('score'), 3)} and review base {_int(m.get('reviews'))}.",
        "Do not claim source-country footfall; exposure is a proxy only.",
    ]
    risks = [
        "Template fallback: live LLM intro is not available, so this pack restates model facts only.",
        "Scenario-test panel — do not present scores as production validation.",
    ]
    return {
        "level": "merchant",
        "id": m["merchant_id"],
        "headline": f"Merchant brief: {m.get('name')}",
        "profile": " ".join(profile.split()),
        "intro": " ".join(profile.split()),
        "text": " ".join(profile.split()),
        "source": "template",
        "llm_status": "unavailable",
        "bullets": bullets,
        "talking_points": talking,
        "risks": risks,
        "hook": hook,
    }


def cache_default_briefs(corridors, categories, merchants) -> dict:
    briefs = {"corridor": {}, "category": {}, "merchant": {}}
    for f in corridors:
        briefs["corridor"][f["corridor"]] = corridor_template(f)
    for f in categories:
        briefs["category"][f"{f['corridor']}|{f['category']}"] = category_template(f)
    for m in merchants:
        briefs["merchant"][m["merchant_id"]] = merchant_template(m)
    return briefs


def load_json(name: str):
    return json.loads((BUNDLE / name).read_text())


def facts_for(level: str, ident: str) -> dict | None:
    if level == "corridor":
        for row in load_json("corridor_facts.json"):
            if row["corridor"] == ident:
                return row
    elif level == "category":
        corridor, _, category = ident.partition("|")
        for row in load_json("category_facts.json"):
            if row["corridor"] == corridor and row["category"] == category:
                return row
    elif level == "merchant":
        row = None
        for item in load_json("merchants.json"):
            if item["merchant_id"] == ident:
                row = dict(item)
                break
        if not row:
            return None
        history = load_json("history.json").get(ident, [])
        row["momentum_history"] = history[-8:]
        if history:
            first, last = history[0], history[-1]
            row["momentum_trend_note"] = {
                "from_month": first.get("month"),
                "to_month": last.get("month"),
                "from_momentum": first.get("momentum"),
                "to_momentum": last.get("momentum"),
                "latest_rating": last.get("rating"),
            }
        return row
    return None


def template_brief(level: str, facts: dict) -> dict:
    if level == "corridor":
        return corridor_template(facts)
    if level == "category":
        return category_template(facts)
    return merchant_template(facts)


_LLM_CIRCUIT = {"open": False, "reason": None}


def reset_llm_circuit() -> None:
    _LLM_CIRCUIT["open"] = False
    _LLM_CIRCUIT["reason"] = None


def _llm_api_key() -> str:
    return (os.environ.get("DEEPSEEK_API_KEY") or os.environ.get("OPENAI_API_KEY") or "").strip()


def _llm_base_url() -> str:
    explicit = (os.environ.get("OPENAI_BASE_URL") or "").strip()
    if explicit:
        return explicit.rstrip("/")
    if os.environ.get("DEEPSEEK_API_KEY"):
        return "https://api.deepseek.com"
    return "https://api.openai.com/v1"


def _llm_model() -> str:
    explicit = (os.environ.get("OPENAI_MODEL") or os.environ.get("DEEPSEEK_MODEL") or "").strip()
    if explicit:
        return explicit
    if "deepseek" in _llm_base_url() or os.environ.get("DEEPSEEK_API_KEY"):
        return "deepseek-chat"
    return "gpt-4o-mini"


def _llm_provider() -> str:
    if "deepseek" in _llm_base_url() or os.environ.get("DEEPSEEK_API_KEY"):
        return "deepseek"
    return "openai"


def llm_available() -> bool:
    if os.environ.get("LLM_ENABLED", "true").lower() in {"0", "false", "no"}:
        return False
    return bool(_llm_api_key())


def llm_status() -> dict:
    configured = bool(_llm_api_key())
    enabled = os.environ.get("LLM_ENABLED", "true").lower() not in {"0", "false", "no"}
    live = configured and enabled and not _LLM_CIRCUIT["open"]
    return {
        "configured": configured,
        "enabled": enabled,
        "live": live,
        "provider": _llm_provider(),
        "model": _llm_model(),
        "base_url": _llm_base_url(),
        "fallback": "template",
        "circuit_open": _LLM_CIRCUIT["open"],
        "circuit_reason": _LLM_CIRCUIT["reason"],
        "note": "POST /api/explain with level=merchant|corridor|category. Live LLM is used when configured; otherwise a facts-only template.",
    }


SYSTEM = (
    "You write commercial briefs for American Express merchant development. "
    "Use ONLY the supplied facts. Never invent numbers, ratings, distances, arrivals, "
    "owner names, cuisine claims, or visitor nationalities that are not in the facts. "
    "You MAY write a fuller narrative introduction by connecting those facts "
    "(who the shop is, where it sits, quality/scale, momentum, why BD should care, caveats). "
    "Exposure is a geography/language proxy, not nationality attribution. "
    "Mark the run as scenario-test / simulated. Write executive English."
)


def _llm_prompt(level: str, facts: dict) -> str:
    if level == "corridor":
        return (
            "Write a corridor strategy brief for APAC partners.\n"
            "Return JSON with keys: headline, text (6-8 sentences), bullets (3 strings).\n"
            f"FACTS:\n{json.dumps(facts, ensure_ascii=False)}"
        )
    if level == "category":
        return (
            "Write a category priority brief for APAC partners.\n"
            "Return JSON with keys: headline, text (4-6 sentences), bullets (3 strings).\n"
            f"FACTS:\n{json.dumps(facts, ensure_ascii=False)}"
        )
    return (
        "Write a merchant briefing pack that BD must read BEFORE pushing the lead.\n"
        "The live LLM version must be RICHER than a one-line fact dump: introduce the merchant "
        "as a commercial target (who they are, format/category, location story vs nearest hotspot, "
        "quality and scale from rating/reviews, momentum trajectory from history, why this quarter, "
        "and what not to over-claim).\n"
        "Return JSON with keys:\n"
        "- headline (short)\n"
        "- intro (8-12 sentences, the merchant introduction BD would actually read)\n"
        "- profile (4-6 sentence factual summary)\n"
        "- bullets (exactly 3 strings: who / why now / where)\n"
        "- talking_points (4 strings BD can say in a call)\n"
        "- risks (1-3 caveats grounded in facts, including simulated-data warning)\n"
        "- hook (one email/WhatsApp sentence)\n"
        f"FACTS:\n{json.dumps(facts, ensure_ascii=False)}"
    )


def _llm_output_ok(level: str, data: dict) -> bool:
    if not isinstance(data, dict) or not data:
        return False
    if not (data.get("headline") and (data.get("text") or data.get("intro") or data.get("profile"))):
        return False
    bullets = data.get("bullets")
    if not isinstance(bullets, list) or len(bullets) < 1:
        return False
    if level == "merchant" and not (data.get("intro") or data.get("profile") or data.get("text")):
        return False
    return True


def llm_brief(level: str, facts: dict) -> dict | None:
    if not llm_available() or _LLM_CIRCUIT["open"]:
        return None
    try:
        from openai import OpenAI
        client = OpenAI(
            api_key=_llm_api_key(),
            base_url=_llm_base_url(),
            timeout=20.0,
        )
        model = _llm_model()
        resp = client.chat.completions.create(
            model=model,
            temperature=0.4,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": _llm_prompt(level, facts)},
            ],
        )
        content = resp.choices[0].message.content or "{}"
        data = json.loads(content)
        if not _llm_output_ok(level, data):
            fallback = template_brief(level, facts)
            fallback["llm_status"] = "invalid"
            fallback["error"] = "LLM returned incomplete JSON; using template."
            return fallback
        out = template_brief(level, facts)
        out["headline"] = data.get("headline") or out["headline"]
        out["text"] = data.get("intro") or data.get("text") or data.get("profile") or out.get("text")
        if data.get("intro"):
            out["intro"] = data["intro"]
        if data.get("profile"):
            out["profile"] = data["profile"]
        elif data.get("intro"):
            out["profile"] = data["intro"]
        out["bullets"] = data.get("bullets") or out["bullets"]
        if data.get("talking_points"):
            out["talking_points"] = data["talking_points"]
        if data.get("risks"):
            out["risks"] = data["risks"]
        if data.get("hook"):
            out["hook"] = data["hook"]
        out["source"] = "llm"
        out["llm_status"] = "ok"
        out.pop("error", None)
        return out
    except Exception as exc:
        msg = str(exc)
        if "429" in msg or "insufficient_quota" in msg or "credit_balance" in msg or "timeout" in msg.lower():
            _LLM_CIRCUIT["open"] = True
            _LLM_CIRCUIT["reason"] = "LLM API unavailable. Using template."
        fallback = template_brief(level, facts)
        fallback["error"] = _LLM_CIRCUIT["reason"] or msg
        fallback["llm_status"] = "unavailable"
        return fallback


def explain(level: str, ident: str, use_llm: bool = True) -> dict[str, Any]:
    facts = facts_for(level, ident)
    if not facts:
        return {"error": "not found", "level": level, "id": ident}
    if use_llm:
        generated = llm_brief(level, facts)
        if generated:
            return generated
    out = template_brief(level, facts)
    out["llm_status"] = "skipped" if not use_llm else "unavailable"
    if _LLM_CIRCUIT["reason"]:
        out["error"] = _LLM_CIRCUIT["reason"]
    return out
