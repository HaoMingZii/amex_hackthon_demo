"""Join pipeline outputs into a compact JSON bundle for the demo UI."""
from __future__ import annotations

import json
import math
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
PROCESSED = DATA / "processed"
OUTPUTS = DATA / "outputs"
BUNDLE = ROOT / "bundle"

DEFAULT_MONTH = "2026-05"

HOTSPOTS = {
    "CN->SG": [
        {"name": "Chinatown / Niu Che Shui", "lat": 1.2815, "lng": 103.8448},
        {"name": "Sentosa / Resorts World", "lat": 1.2540, "lng": 103.8238},
        {"name": "Orchard Road", "lat": 1.3048, "lng": 103.8318},
        {"name": "Marina Bay Sands", "lat": 1.2834, "lng": 103.8607},
        {"name": "Gardens by the Bay", "lat": 1.2816, "lng": 103.8636},
        {"name": "Bugis Street", "lat": 1.3006, "lng": 103.8559},
        {"name": "Jewel Changi", "lat": 1.3601, "lng": 103.9896},
        {"name": "Merlion Park", "lat": 1.2868, "lng": 103.8545},
        {"name": "Clarke Quay", "lat": 1.2907, "lng": 103.8465},
    ],
    "SG->JP": [
        {"name": "Ginza", "lat": 35.6717, "lng": 139.7650},
        {"name": "Shinjuku", "lat": 35.6896, "lng": 139.7006},
        {"name": "Shibuya", "lat": 35.6595, "lng": 139.7005},
        {"name": "Asakusa / Sensoji", "lat": 35.7148, "lng": 139.7967},
        {"name": "Akihabara", "lat": 35.6984, "lng": 139.7731},
        {"name": "Shinsaibashi", "lat": 34.6723, "lng": 135.5010},
        {"name": "Dotonbori / Namba", "lat": 34.6687, "lng": 135.5013},
        {"name": "Kyoto Gion", "lat": 35.0037, "lng": 135.7788},
        {"name": "Kyoto Station", "lat": 34.9858, "lng": 135.7588},
        {"name": "Sapporo Susukino", "lat": 43.0554, "lng": 141.3529},
        {"name": "Fukuoka Tenjin", "lat": 33.5914, "lng": 130.3989},
    ],
}

CORRIDOR_META = {
    "CN->SG": {
        "label": "China → Singapore",
        "source": "China",
        "destination": "Singapore",
        "fx_pair": "CNY/SGD",
        "audience": "Chinese outbound travellers",
    },
    "SG->JP": {
        "label": "Singapore → Japan",
        "source": "Singapore",
        "destination": "Japan",
        "fx_pair": "SGD/JPY",
        "audience": "Singapore outbound travellers",
    },
}


def _clean(v):
    if v is None or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))):
        return None
    if pd.isna(v):
        return None
    if hasattr(v, "item"):
        try:
            return v.item()
        except Exception:
            pass
    return v


def _round(v, n=4):
    v = _clean(v)
    if v is None:
        return None
    try:
        return round(float(v), n)
    except (TypeError, ValueError):
        return v


def _pct(v):
    v = _clean(v)
    if v is None:
        return None
    return round(float(v) * 100, 1)


def yoy(series: pd.Series, month: str) -> float | None:
    if month not in series.index:
        return None
    y, m = month.split("-")
    prev = f"{int(y) - 1}-{m}"
    if prev not in series.index:
        return None
    a, b = float(series.loc[month]), float(series.loc[prev])
    if b == 0:
        return None
    return (a - b) / b


def mom(series: pd.Series, month: str) -> float | None:
    if month not in series.index:
        return None
    idx = list(series.index)
    i = idx.index(month)
    if i == 0:
        return None
    a, b = float(series.loc[month]), float(series.loc[idx[i - 1]])
    if b == 0:
        return None
    return (a - b) / b


def load_arrivals() -> dict[str, pd.Series]:
    sg = pd.read_csv(PROCESSED / "macro_sg_arrivals.csv")
    sg["series"] = sg["series"].astype(str).str.strip()
    china = sg[sg["series"] == "China"].set_index("month")["value"].sort_index()
    jp = pd.read_csv(PROCESSED / "macro_jp_arrivals.csv")
    jp["series"] = jp["series"].astype(str).str.strip()
    sgp = jp[jp["series"] == "Singapore"].set_index("month")["value"].sort_index()
    return {"CN->SG": china, "SG->JP": sgp}


def load_fx() -> pd.DataFrame:
    fx = pd.read_csv(PROCESSED / "macro_fx_monthly.csv")
    return fx


def arrivals_series_payload(s: pd.Series, last_n: int = 14) -> list[dict]:
    s = s.dropna().tail(last_n)
    out = []
    for month, val in s.items():
        out.append({
            "month": month,
            "value": _round(val, 0),
            "yoy": _round(yoy(s, month), 4),
        })
    return out


def build():
    BUNDLE.mkdir(parents=True, exist_ok=True)

    master = pd.read_csv(PROCESSED / "merchant_master.csv")
    exposure = pd.read_csv(PROCESSED / "exposure_features.csv")
    pred = pd.read_csv(OUTPUTS / "merchant_predictions.csv")
    labels = pd.read_csv(PROCESSED / "labels_merchant.csv")
    momentum = pd.read_csv(PROCESSED / "momentum_corridor_category.csv")
    report = json.loads((OUTPUTS / "model_report.json").read_text())
    arrivals = load_arrivals()
    fx = load_fx()

    exp_keep = exposure[[
        "merchant_id", "hotspot_min_dist_km", "hotspot_proximity_score",
        "hotspot_count_3km", "nearest_hotspot", "review_lang_share_source",
        "name_script_source_share", "exposure_score",
    ]]
    panel = master.merge(exp_keep, on="merchant_id", how="left")
    latest_pred = pred[pred["as_of_month"] == DEFAULT_MONTH].copy()
    panel = panel.merge(
        latest_pred[["merchant_id", "y_high_potential", "momentum_score",
                     "base_reviews_at_t", "score", "rank_in_cell"]],
        on="merchant_id",
        how="left",
    )

    months = sorted(pred["as_of_month"].unique().tolist())
    categories = ["Hotel", "Food", "Beverage", "Retail"]

    # --- corridor + category aggregates ---
    mom_latest = momentum[momentum["as_of_month"] == DEFAULT_MONTH].copy()
    corridor_rows = []
    category_rows = []
    for corridor, meta in CORRIDOR_META.items():
        sub = mom_latest[mom_latest["corridor"] == corridor]
        merch = panel[panel["corridor"] == corridor]
        arr = arrivals[corridor]
        arr_month = arr.index.max() if len(arr) else None
        # use latest available arrivals, not necessarily DEFAULT_MONTH
        fx_sub = fx[(fx["corridor"] == corridor) & (fx["month"] <= DEFAULT_MONTH)]
        fx_row = fx_sub.sort_values("month").tail(1)
        fx_latest = fx_row.iloc[0] if len(fx_row) else None
        weighted = float(sub["momentum_weighted"].mean()) if len(sub) else 0
        n_hp = int((merch["y_high_potential"] == 1).sum())
        cats = []
        for _, r in sub.sort_values("momentum_weighted", ascending=False).iterrows():
            cat = {
                "corridor": corridor,
                "category": r["category"],
                "momentum_weighted": _round(r["momentum_weighted"]),
                "n_merchants": int(r["n_merchants"]),
                "share_high_potential": _round(r["share_high_potential"]),
                "total_review_base": int(r["total_review_base"]),
            }
            cats.append(cat)
            category_rows.append(cat)
        top_cat = cats[0]["category"] if cats else None
        facts = {
            "corridor": corridor,
            "label": meta["label"],
            "source": meta["source"],
            "destination": meta["destination"],
            "audience": meta["audience"],
            "as_of_month": DEFAULT_MONTH,
            "n_merchants": int(len(merch)),
            "n_high_potential": n_hp,
            "high_potential_share": _round(n_hp / len(merch) if len(merch) else 0),
            "momentum_weighted": _round(weighted),
            "top_category": top_cat,
            "categories": cats,
            "arrivals_latest_month": arr_month,
            "arrivals_level": _round(arr.loc[arr_month], 0) if arr_month else None,
            "arrivals_yoy": _round(yoy(arr, arr_month), 4) if arr_month else None,
            "arrivals_mom": _round(mom(arr, arr_month), 4) if arr_month else None,
            "fx_pair": meta["fx_pair"],
            "fx_month": _clean(fx_latest["month"]) if fx_latest is not None else None,
            "fx_rate": _round(fx_latest["rate_mean"], 4) if fx_latest is not None else None,
            "fx_yoy": _round(fx_latest["rate_yoy"], 4) if fx_latest is not None else None,
        }
        corridor_rows.append(facts)

    corridor_rows.sort(key=lambda x: x["momentum_weighted"] or 0, reverse=True)
    for i, row in enumerate(corridor_rows, 1):
        row["rank"] = i

    # momentum time series per corridor x category
    mom_series = []
    for _, r in momentum.sort_values(["corridor", "category", "as_of_month"]).iterrows():
        mom_series.append({
            "corridor": r["corridor"],
            "category": r["category"],
            "month": r["as_of_month"],
            "momentum_weighted": _round(r["momentum_weighted"]),
            "share_high_potential": _round(r["share_high_potential"]),
        })

    # --- shortlist merchants ---
    merchants = []
    for _, r in panel.iterrows():
        merchants.append({
            "merchant_id": r["merchant_id"],
            "name": r["name"],
            "corridor": r["corridor"],
            "category": r["category"],
            "raw_category": _clean(r.get("raw_category")),
            "address": _clean(r.get("address")),
            "city": _clean(r.get("city")),
            "country": _clean(r.get("country")),
            "lat": _round(r.get("latitude"), 6),
            "lng": _round(r.get("longitude"), 6),
            "website": _clean(r.get("website")),
            "phone": _clean(r.get("phone")),
            "score": _round(r.get("score"), 4),
            "rank_in_cell": _round(r.get("rank_in_cell"), 4),
            "y_high_potential": int(r["y_high_potential"]) if pd.notna(r.get("y_high_potential")) else 0,
            "momentum_score": _round(r.get("momentum_score"), 4),
            "reviews": int(r["base_reviews_at_t"]) if pd.notna(r.get("base_reviews_at_t")) else None,
            "exposure_score": _round(r.get("exposure_score"), 4),
            "hotspot_min_dist_km": _round(r.get("hotspot_min_dist_km"), 2),
            "nearest_hotspot": _clean(r.get("nearest_hotspot")),
            "hotspot_count_3km": _clean(r.get("hotspot_count_3km")),
            "lang_share": _round(r.get("review_lang_share_source"), 3),
            "name_script_share": _round(r.get("name_script_source_share"), 3),
        })
    merchants.sort(key=lambda x: x["score"] or 0, reverse=True)
    for i, m in enumerate(merchants, 1):
        m["global_rank"] = i

    # rating from labels latest
    lab_latest = labels[labels["as_of_month"] == DEFAULT_MONTH][
        ["merchant_id", "rating_t", "base_rate_pm", "horizon_rate_pm"]
    ]
    rating_map = lab_latest.set_index("merchant_id").to_dict("index")
    for m in merchants:
        extra = rating_map.get(m["merchant_id"], {})
        m["rating"] = _round(extra.get("rating_t"), 2)
        m["reviews_pm_back"] = _round(extra.get("base_rate_pm"), 2)
        m["reviews_pm_fwd"] = _round(extra.get("horizon_rate_pm"), 2)

    # momentum history per merchant (compact)
    history = {}
    for _, r in labels.sort_values("as_of_month").iterrows():
        history.setdefault(r["merchant_id"], []).append({
            "month": r["as_of_month"],
            "momentum": _round(r["momentum_score"], 4),
            "rating": _round(r["rating_t"], 2),
            "y": int(r["y_high_potential"]) if pd.notna(r["y_high_potential"]) else 0,
        })

    # category facts for LLM
    category_facts = []
    for cat in category_rows:
        tops = [
            {"name": m["name"], "score": m["score"], "merchant_id": m["merchant_id"]}
            for m in merchants
            if m["corridor"] == cat["corridor"] and m["category"] == cat["category"]
        ][:3]
        cmeta = CORRIDOR_META[cat["corridor"]]
        category_facts.append({
            **cat,
            "as_of_month": DEFAULT_MONTH,
            "label": cmeta["label"],
            "destination": cmeta["destination"],
            "top_merchants": tops,
        })

    gbm = next((m for m in report["metrics"] if m["model"] == "gbm"), {})
    overview = {
        "title": "Merchant Intelligence for CN→SG and SG→JP",
        "as_of_month": DEFAULT_MONTH,
        "is_simulated": True,
        "warning": report.get("WARNING"),
        "universe": int(len(master)),
        "high_potential": int((panel["y_high_potential"] == 1).sum()),
        "corridors": 2,
        "categories": categories,
        "model": report.get("model"),
        "precision_at_30": _round(gbm.get("precision_at_30"), 3),
        "lift_at_k": _round(gbm.get("lift_at_k"), 2),
        "roc_auc": _round(gbm.get("roc_auc"), 3),
        "pr_auc": _round(gbm.get("pr_auc"), 3),
        "test_months": report.get("test_months"),
        "train_months": report.get("train_months"),
        "embargoed_months": report.get("embargoed_months"),
        "pipeline": [
            {"id": 1, "title": "Join X + Y", "body": "Macro signals spliced with merchant momentum labels."},
            {"id": 2, "title": "Merchant model", "body": "One supervised classifier scores 3-month momentum."},
            {"id": 3, "title": "Three-level roll-up", "body": "Corridor rank, category priority, merchant list."},
            {"id": 4, "title": "LLM translation", "body": "Facts become corridor briefs, category briefs, outreach copy."},
            {"id": 5, "title": "Dual-track output", "body": "Strategic brief for APAC partners. Execution queue for BD."},
        ],
    }

    strategy = {
        "as_of_month": DEFAULT_MONTH,
        "corridors": corridor_rows,
        "categories": category_facts,
        "momentum_series": mom_series,
        "arrivals": {
            c: arrivals_series_payload(arrivals[c]) for c in arrivals
        },
    }

    model_payload = {
        "generated_at": report.get("generated_at"),
        "is_simulated": report.get("IS_SIMULATED_RUN"),
        "model": report.get("model"),
        "n_features": report.get("n_features"),
        "metrics": report.get("metrics"),
        "importances": report.get("importances"),
        "importance_type": report.get("importance_type"),
        "train_months": report.get("train_months"),
        "embargoed_months": report.get("embargoed_months"),
        "test_months": report.get("test_months"),
        "warning": report.get("WARNING"),
        "features": report.get("features"),
    }

    (BUNDLE / "overview.json").write_text(json.dumps(overview, ensure_ascii=False, indent=2))
    (BUNDLE / "strategy.json").write_text(json.dumps(strategy, ensure_ascii=False))
    (BUNDLE / "merchants.json").write_text(json.dumps(merchants, ensure_ascii=False))
    (BUNDLE / "history.json").write_text(json.dumps(history, ensure_ascii=False))
    (BUNDLE / "model.json").write_text(json.dumps(model_payload, ensure_ascii=False))
    (BUNDLE / "hotspots.json").write_text(json.dumps(HOTSPOTS, ensure_ascii=False, indent=2))
    (BUNDLE / "corridor_facts.json").write_text(json.dumps(corridor_rows, ensure_ascii=False, indent=2))
    (BUNDLE / "category_facts.json").write_text(json.dumps(category_facts, ensure_ascii=False, indent=2))

    from explain import cache_default_briefs
    briefs = cache_default_briefs(corridor_rows, category_facts, merchants[:40])
    (BUNDLE / "briefs.json").write_text(json.dumps(briefs, ensure_ascii=False, indent=2))

    print(f"wrote bundle -> {BUNDLE}")
    print(f"  merchants={len(merchants)} corridors={len(corridor_rows)} categories={len(category_facts)}")


if __name__ == "__main__":
    build()
