import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, pct, type Overview } from '../api'

export default function Landing() {
  const [data, setData] = useState<Overview | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    api.overview().then(setData).catch((e) => setErr(String(e)))
  }, [])

  if (err) {
    return (
      <div className="max-w-3xl mx-auto p-10">
        <p className="text-navy">Cannot reach the API. Start the backend on port 8000.</p>
        <pre className="mt-3 text-xs text-navy/60">{err}</pre>
      </div>
    )
  }
  if (!data) return <div className="p-10 text-navy/50">Loading pipeline…</div>

  return (
    <div>
      <section className="amex-grid border-b border-navy/10">
        <div className="max-w-[1400px] mx-auto px-6 py-14 grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7">
            <p className="text-[11px] tracking-[0.28em] uppercase text-gold">CN→SG · SG→JP · 3-month momentum</p>
            <h1 className="font-serif text-4xl md:text-5xl text-navy mt-3 leading-tight">
              From a broad merchant universe to a focused, explainable shortlist.
            </h1>
            <p className="mt-5 text-navy/75 max-w-xl leading-relaxed">
              One merchant-level model. Three roll-ups. An LLM that only writes from model facts.
              Dual tracks: a strategy brief for APAC partners, and an execution queue for BD.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/strategy" className="bg-navy text-cream px-5 py-2.5 text-sm tracking-wide">
                Open strategic brief
              </Link>
              <Link to="/execution" className="border border-navy text-navy px-5 py-2.5 text-sm">
                Open execution queue
              </Link>
              <Link to="/merchant" className="border border-gold/60 text-navy px-5 py-2.5 text-sm">
                Open merchant brief
              </Link>
            </div>
          </div>
          <div className="lg:col-span-5 grid grid-cols-2 gap-3">
            {[
              ['Universe', data.universe.toLocaleString()],
              ['High-potential', data.high_potential.toLocaleString()],
              ['Precision@30', pct(data.precision_at_30, 0)],
              ['Lift@30', `${data.lift_at_k.toFixed(2)}×`],
            ].map(([k, v]) => (
              <div key={k} className="bg-white border border-navy/10 p-4">
                <div className="text-[11px] uppercase tracking-widest text-navy/50">{k}</div>
                <div className="font-serif text-3xl text-navy mt-1">{v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-[1400px] mx-auto px-6 py-12">
        <h2 className="font-serif text-2xl text-navy">Five-step decision tree</h2>
        <p className="text-sm text-navy/60 mt-1">Click a leaf in step 5 to enter the corresponding workspace.</p>
        <div className="mt-8 grid md:grid-cols-5 gap-3">
          {data.pipeline.map((step) => (
            <div key={step.id} className="border border-navy/10 bg-white p-4 min-h-[160px]">
              <div className="text-gold font-serif text-2xl">{String(step.id).padStart(2, '0')}</div>
              <div className="mt-2 font-medium text-navy">{step.title}</div>
              <p className="mt-2 text-sm text-navy/65 leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 grid md:grid-cols-2 gap-3">
          <Link to="/strategy" className="border border-gold/50 bg-cream p-5 hover:border-gold">
            <div className="text-[11px] tracking-[0.2em] uppercase text-gold">Step 5 · Strategic</div>
            <div className="font-serif text-xl text-navy mt-1">Corridor + category briefs</div>
            <p className="text-sm text-navy/65 mt-2">For APAC partners: where to concentrate coverage this quarter.</p>
          </Link>
          <Link to="/execution" className="border border-navy/20 bg-white p-5 hover:border-navy">
            <div className="text-[11px] tracking-[0.2em] uppercase text-blue">Step 5 · Execution</div>
            <div className="font-serif text-xl text-navy mt-1">Merchant outreach queue</div>
            <p className="text-sm text-navy/65 mt-2">For BD: ranked shops, map, and a copy-ready signing reason.</p>
          </Link>
        </div>
      </section>
    </div>
  )
}
