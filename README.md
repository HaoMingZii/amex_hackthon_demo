# AMEX Merchant Intelligence Demo

Interactive demo for the CN→SG / SG→JP merchant shortlist. One supervised merchant model, three roll-ups (corridor, category, merchant), LLM copy from **model facts only**, two workspaces:

- **Strategic brief** — APAC partners
- **Execution queue** — BD outreach

Metrics come from the simulated pipeline run in `amex_hackathon`. The yellow banner is intentional: this is scenario-test, not production validation.

## Run

From two terminals:

```bash
# 1) API
cd amex_demo/backend
python3 -m pip install -r requirements.txt
python3 prepare_data.py          # only needed after data refresh
python3 -m uvicorn app:app --reload --port 8000

# 2) UI
cd amex_demo/frontend
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). Vite proxies `/api` to port 8000.

中文界面说明见 [使用教程.md](使用教程.md)。

Live LLM: copy `backend/.env.example` to `backend/.env` and set `OPENAI_API_KEY`. Then click **Regenerate** on a brief. Without a key, the same numbers are rendered as a template so the demo still runs.

## Demo path (~2 min)

1. Landing — five-step tree  
2. Strategic brief — pick CN→SG, read the corridor/category LLM copy  
3. Drill into Food → Execution queue  
4. Set k=30, read hit rate, open a merchant, **Push to BD** / **Copy outreach**  
5. Model lab if judges want P@30 vs baselines  

## Layout

```
amex_demo/
  backend/          FastAPI + JSON bundle
  frontend/         Vite + React
```

Does not re-run `amex_hackathon` training. Data files under `backend/data` are a copy of processed/outputs needed by the UI.
