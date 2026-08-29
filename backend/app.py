"""Demo API + static SPA host."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query

load_dotenv(Path(__file__).resolve().parent / ".env")
load_dotenv(Path(__file__).resolve().parent.parent / ".env")
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from explain import explain, llm_status, reset_llm_circuit

ROOT = Path(__file__).resolve().parent
BUNDLE = ROOT / "bundle"
DIST = ROOT.parent / "frontend" / "dist"

app = FastAPI(title="AMEX Merchant Intelligence Demo")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def load(name: str):
    path = BUNDLE / name
    if not path.exists():
        raise HTTPException(500, f"Missing {name}. Run prepare_data.py first.")
    return json.loads(path.read_text())


@app.get("/api/health")
def health():
    status = llm_status()
    return {"ok": True, "llm": status["live"], **status}


@app.get("/api/llm/status")
def api_llm_status():
    return llm_status()


@app.get("/api/overview")
def overview():
    return load("overview.json")


@app.get("/api/strategy")
def strategy():
    data = load("strategy.json")
    briefs = load("briefs.json")
    data["briefs"] = {
        "corridor": briefs.get("corridor", {}),
        "category": briefs.get("category", {}),
    }
    data["llm_live"] = llm_status()["live"]
    return data


@app.get("/api/shortlist")
def shortlist(
    corridor: Optional[str] = None,
    category: Optional[str] = None,
    q: Optional[str] = None,
    k: int = Query(30, ge=5, le=200),
):
    rows = load("merchants.json")
    if corridor:
        rows = [r for r in rows if r["corridor"] == corridor]
    if category:
        rows = [r for r in rows if r["category"] == category]
    if q:
        needle = q.lower()
        rows = [
            r for r in rows
            if needle in (r.get("name") or "").lower()
            or needle in (r.get("address") or "").lower()
            or needle in (r.get("city") or "").lower()
        ]
    rows = sorted(rows, key=lambda r: r.get("score") or 0, reverse=True)
    top = rows[:k]
    n = max(len(top), 1)
    hits = sum(1 for r in top if r.get("y_high_potential"))
    return {
        "k": k,
        "n_filtered": len(rows),
        "precision_at_k": hits / n,
        "hits": hits,
        "rows": rows[: max(k, 80)],
        "all_ids": [r["merchant_id"] for r in rows[:k]],
    }


@app.get("/api/merchant/{merchant_id}")
def merchant(merchant_id: str):
    rows = load("merchants.json")
    row = next((r for r in rows if r["merchant_id"] == merchant_id), None)
    if not row:
        raise HTTPException(404, "merchant not found")
    history = load("history.json").get(merchant_id, [])
    try:
        status = llm_status()
    except Exception:
        status = {"live": False, "fallback": "template"}
    return {"merchant": row, "history": history, "llm": status}


@app.get("/api/map")
def map_data(corridor: Optional[str] = None):
    rows = load("merchants.json")
    if corridor:
        rows = [r for r in rows if r["corridor"] == corridor]
    hotspots = load("hotspots.json")
    points = [
        {
            "merchant_id": r["merchant_id"],
            "name": r["name"],
            "corridor": r["corridor"],
            "category": r["category"],
            "lat": r["lat"],
            "lng": r["lng"],
            "score": r["score"],
            "exposure_score": r["exposure_score"],
            "y_high_potential": r["y_high_potential"],
        }
        for r in rows
        if r.get("lat") is not None and r.get("lng") is not None
    ]
    return {
        "points": points,
        "hotspots": hotspots.get(corridor, hotspots) if corridor else hotspots,
        "corridor": corridor,
    }


@app.get("/api/model")
def model():
    return load("model.json")


class ExplainIn(BaseModel):
    level: str
    id: str
    use_llm: bool = True


@app.post("/api/explain")
def api_explain(body: ExplainIn):
    if body.level not in {"corridor", "category", "merchant"}:
        raise HTTPException(400, "level must be corridor|category|merchant")
    result = explain(body.level, body.id, use_llm=body.use_llm)
    if result.get("error") == "not found":
        raise HTTPException(404, "facts not found")
    return result


@app.post("/api/merchants/{merchant_id}/brief")
def merchant_brief(merchant_id: str, use_llm: bool = True, force: bool = False):
    """Dedicated merchant LLM briefing. Falls back to template if the live API is down."""
    if force:
        reset_llm_circuit()
    result = explain("merchant", merchant_id, use_llm=use_llm)
    if result.get("error") == "not found":
        raise HTTPException(404, "merchant not found")
    return result


if DIST.exists():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="spa")
