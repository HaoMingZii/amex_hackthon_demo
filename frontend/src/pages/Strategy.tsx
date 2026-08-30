import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, num, pct, type Brief, type CorridorFacts } from '../api'

type Generated = {
  corridor: string
  category: string
  corridorBrief: Brief
  categoryBrief: Brief
}

export default function Strategy() {
  const [payload, setPayload] = useState<Awaited<ReturnType<typeof api.strategy>> | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [corridor, setCorridor] = useState('')
  const [category, setCategory] = useState('')
  const [generated, setGenerated] = useState<Generated | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    api.strategy().then(setPayload).catch((e) => setLoadError(String(e)))
  }, [])

  const selected = payload?.corridors.find((c) => c.corridor === corridor)
  const categories = selected?.categories ?? []

  const chart = useMemo(
    () =>
      categories.map((c) => ({
        name: c.category,
        momentum: Number((c.momentum_weighted * 100).toFixed(1)),
      })),
    [categories],
  )

  const stale =
    generated != null && (generated.corridor !== corridor || generated.category !== category)

  function pickCorridor(next: string) {
    setCorridor(next)
    const row = payload?.corridors.find((c) => c.corridor === next)
    setCategory((prev) => {
      if (row?.categories.some((c) => c.category === prev)) return prev
      return ''
    })
  }

  async function generate() {
    if (!corridor || !category) return
    setBusy(true)
    try {
      const catKey = `${corridor}|${category}`
      const loadOne = async (level: 'corridor' | 'category', id: string) => {
        try {
          return await api.explain(level, id, true)
        } catch {
          return api.explain(level, id, false)
        }
      }
      const [corridorBrief, categoryBrief] = await Promise.all([
        loadOne('corridor', corridor),
        loadOne('category', catKey),
      ])
      setGenerated({ corridor, category, corridorBrief, categoryBrief })
      const live = [corridorBrief, categoryBrief].some((b) => b.source === 'llm')
      setToast(live ? 'Briefs generated with live LLM' : 'LLM unavailable · template briefs from model facts')
    } catch (e) {
      setToast(String(e))
    } finally {
      setBusy(false)
      setTimeout(() => setToast(null), 2800)
    }
  }

  if (loadError) {
    return (
      <div className="p-10 text-navy">
        <p>Could not load strategy data.</p>
        <pre className="mt-2 text-xs text-navy/50">{loadError}</pre>
      </div>
    )
  }
  if (!payload) return <div className="p-10 text-navy/50">Loading strategy…</div>

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] tracking-[0.28em] uppercase text-gold">Strategic layer · APAC partners</p>
          <h1 className="font-serif text-3xl text-navy mt-1">Select, then generate briefs</h1>
          <p className="mt-2 text-sm text-navy/65 max-w-2xl">
            In production this picker lists every covered corridor and category. This demo only has two
            corridors and four categories because that is the current merchant panel — not because the
            workflow is limited to two markets.
          </p>
        </div>
        <div className="text-xs text-navy/50">
          {payload.llm_live ? 'Live LLM available' : 'Template briefs · set DEEPSEEK_API_KEY to generate with a model'}
        </div>
      </div>

      <div className="mt-6 border border-navy/10 bg-white p-5">
        <div className="text-[11px] uppercase tracking-widest text-navy/45">Step 1 · Choose coverage</div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm text-navy/70">
            Which corridor
            <select
              className="mt-1 block border border-navy/20 bg-paper px-3 py-2 min-w-[240px]"
              value={corridor}
              onChange={(e) => pickCorridor(e.target.value)}
            >
              <option value="">Select corridor…</option>
              {payload.corridors.map((c) => (
                <option key={c.corridor} value={c.corridor}>
                  #{c.rank} {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-navy/70">
            Which category
            <select
              className="mt-1 block border border-navy/20 bg-paper px-3 py-2 min-w-[200px]"
              value={category}
              disabled={!corridor}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Select category…</option>
              {categories.map((c) => (
                <option key={c.category} value={c.category}>
                  {c.category} · momentum {num(c.momentum_weighted, 3)}
                </option>
              ))}
            </select>
          </label>
          <button
            className="bg-navy text-cream px-5 py-2 text-sm disabled:opacity-40"
            disabled={!corridor || !category || busy}
            onClick={generate}
          >
            {busy ? 'Generating…' : 'Generate briefs'}
          </button>
        </div>
        {stale && (
          <p className="mt-3 text-xs text-gold">Selection changed. Generate again to refresh the briefs below.</p>
        )}
      </div>

      <div className="mt-6 grid md:grid-cols-2 gap-3">
        {payload.corridors.map((c: CorridorFacts) => (
          <button
            key={c.corridor}
            onClick={() => pickCorridor(c.corridor)}
            className={`text-left border p-5 ${c.corridor === corridor ? 'border-navy bg-navy text-cream' : 'border-navy/10 bg-white'}`}
          >
            <div className="flex justify-between items-baseline">
              <span className="font-serif text-xl">#{c.rank} {c.label}</span>
              <span className="text-sm opacity-80">momentum {num(c.momentum_weighted, 3)}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div><div className="opacity-60 text-[11px] uppercase">Merchants</div>{c.n_merchants}</div>
              <div><div className="opacity-60 text-[11px] uppercase">High-potential</div>{c.n_high_potential}</div>
              <div><div className="opacity-60 text-[11px] uppercase">Lead category</div>{c.top_category}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-8 grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-navy/10 p-5">
          <h2 className="font-serif text-xl text-navy">
            Category priority{selected ? ` · ${selected.label}` : ''}
          </h2>
          {!selected ? (
            <p className="mt-8 text-sm text-navy/50">Select a corridor to see category ranking for that market.</p>
          ) : (
            <>
              <div className="h-56 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#00175a22" />
                    <XAxis dataKey="name" tick={{ fill: '#00175a', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#00175a', fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="momentum" fill="#006fcf" name="Weighted momentum %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {categories.map((c) => (
                  <button
                    key={c.category}
                    onClick={() => setCategory(c.category)}
                    className={`text-xs px-3 py-1 border ${category === c.category ? 'bg-navy text-cream border-navy' : 'border-navy/20'}`}
                  >
                    {c.category} · {num(c.momentum_weighted, 3)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="lg:col-span-7 space-y-4">
          {!generated ? (
            <div className="border border-dashed border-navy/20 bg-cream/40 p-8 text-sm text-navy/60">
              Step 2 · After you choose a corridor and category, generate a corridor brief and a category
              brief. Copy is written from model facts only; it is not auto-run for every cell.
            </div>
          ) : (
            <>
              <BriefCard title={`Corridor brief · ${generated.corridor}`} brief={generated.corridorBrief} />
              <BriefCard title={`${generated.category} brief`} brief={generated.categoryBrief} />
              <div className="flex flex-wrap gap-3 items-center">
                <button
                  className="text-sm border border-navy/30 px-4 py-2 disabled:opacity-40"
                  disabled={busy || !corridor || !category}
                  onClick={generate}
                >
                  {busy ? 'Generating…' : 'Regenerate'}
                </button>
                <Link
                  to={`/execution?corridor=${encodeURIComponent(generated.corridor)}&category=${encodeURIComponent(generated.category)}`}
                  className="inline-flex bg-gold text-navy px-4 py-2 text-sm font-medium"
                >
                  Drill into execution queue →
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {selected && (
        <div className="mt-8 grid sm:grid-cols-3 gap-3 text-sm">
          <Stat label="Arrivals (latest official)" value={`${selected.arrivals_level?.toLocaleString() ?? '—'} · ${selected.arrivals_latest_month}`} />
          <Stat label="Arrivals YoY" value={pct(selected.arrivals_yoy)} />
          <Stat label={`${selected.fx_pair} YoY`} value={pct(selected.fx_yoy)} />
        </div>
      )}
      {toast && <div className="fixed bottom-6 right-6 bg-navy text-cream px-4 py-2 text-sm">{toast}</div>}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-navy/10 bg-white p-4">
      <div className="text-[11px] uppercase tracking-widest text-navy/50">{label}</div>
      <div className="mt-1 text-navy">{value}</div>
    </div>
  )
}

function BriefCard({ title, brief }: { title: string; brief: Brief }) {
  return (
    <article className="border border-navy/10 bg-cream/60 p-5">
      <h3 className="font-serif text-lg text-navy">{title}</h3>
      <p className="mt-2 font-medium text-navy">{brief.headline}</p>
      <p className="mt-2 text-sm text-navy/75 leading-relaxed">{brief.text}</p>
      <ul className="mt-3 space-y-1 text-sm text-navy/80">
        {brief.bullets?.map((b) => (
          <li key={b}>· {b}</li>
        ))}
      </ul>
      <div className="mt-3 text-[10px] uppercase tracking-widest text-navy/40">Source · {brief.source}</div>
    </article>
  )
}
