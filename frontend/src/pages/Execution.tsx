import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, num, pct, type Merchant } from '../api'
import MerchantMap from '../components/MerchantMap'
import { loadPushed } from '../pushed'

const CORRIDORS = ['CN->SG', 'SG->JP']
const CATS = ['Hotel', 'Food', 'Beverage', 'Retail']

export default function Execution() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const corridor = params.get('corridor') || ''
  const category = params.get('category') || ''
  const [q, setQ] = useState('')
  const [k, setK] = useState(30)
  const [rows, setRows] = useState<Merchant[]>([])
  const [meta, setMeta] = useState({ n_filtered: 0, precision_at_k: 0, hits: 0, k: 30 })
  const [active, setActive] = useState<string | null>(null)
  const [pushed] = useState<string[]>(loadPushed)

  useEffect(() => {
    const t = setTimeout(() => {
      api.shortlist({ corridor: corridor || undefined, category: category || undefined, q, k }).then((d) => {
        setRows(d.rows)
        setMeta({ n_filtered: d.n_filtered, precision_at_k: d.precision_at_k, hits: d.hits, k: d.k })
      })
    }, 120)
    return () => clearTimeout(t)
  }, [corridor, category, q, k])

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
  }

  const topIds = useMemo(() => new Set(rows.slice(0, k).map((r) => r.merchant_id)), [rows, k])

  function openBrief(id: string) {
    setActive(id)
    navigate(`/merchant/${id}`)
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <p className="text-[11px] tracking-[0.28em] uppercase text-blue">Execution layer · BD team</p>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <h1 className="font-serif text-3xl text-navy mt-1">Merchant outreach queue</h1>
        <div className="text-sm text-navy/70">
          Top {meta.k} hit rate <span className="font-medium text-navy">{pct(meta.precision_at_k, 0)}</span>
          {' '}({meta.hits}/{meta.k}) · {meta.n_filtered.toLocaleString()} in filter
        </div>
      </div>
      <p className="mt-2 text-sm text-navy/60">
        Push is not available from this table. Open a merchant, generate the LLM briefing, then push.
      </p>

      <div className="mt-5 flex flex-wrap gap-2 items-center">
        <select className="border border-navy/20 bg-white px-2 py-1.5 text-sm" value={corridor} onChange={(e) => setFilter('corridor', e.target.value)}>
          <option value="">All corridors</option>
          {CORRIDORS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="border border-navy/20 bg-white px-2 py-1.5 text-sm" value={category} onChange={(e) => setFilter('category', e.target.value)}>
          <option value="">All categories</option>
          {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          className="border border-navy/20 bg-white px-3 py-1.5 text-sm min-w-[220px]"
          placeholder="Search name or address"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label className="text-sm text-navy/70 flex items-center gap-2 ml-auto">
          Shortlist k
          <input type="range" min={10} max={50} step={5} value={k} onChange={(e) => setK(Number(e.target.value))} />
          <span className="w-6">{k}</span>
        </label>
      </div>

      <div className="mt-5 grid lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 border border-navy/10 bg-white overflow-auto max-h-[640px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-navy text-cream text-left text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Merchant</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">HP</th>
                <th className="px-3 py-2">Exposure</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m, i) => (
                <tr
                  key={m.merchant_id}
                  className={`border-t border-navy/5 cursor-pointer ${topIds.has(m.merchant_id) ? 'bg-gold/10' : ''} ${active === m.merchant_id ? 'bg-blue/10' : 'hover:bg-cream'}`}
                  onClick={() => openBrief(m.merchant_id)}
                >
                  <td className="px-3 py-2 text-navy/50">{i + 1}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-navy">{m.name}</div>
                    <div className="text-[11px] text-navy/50">{m.corridor} · {m.category}</div>
                  </td>
                  <td className="px-3 py-2">{num(m.score, 3)}</td>
                  <td className="px-3 py-2">{m.y_high_potential ? 'Yes' : '—'}</td>
                  <td className="px-3 py-2">{num(m.exposure_score, 2)}</td>
                  <td className="px-3 py-2">
                    <button
                      className="text-xs border border-navy/20 px-2 py-1"
                      onClick={(e) => {
                        e.stopPropagation()
                        openBrief(m.merchant_id)
                      }}
                    >
                      {pushed.includes(m.merchant_id) ? 'Pushed' : 'Brief'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="lg:col-span-5 min-h-[420px] border border-navy/10">
          <MerchantMap corridor={corridor || undefined} activeId={active} onSelect={openBrief} />
        </div>
      </div>
    </div>
  )
}
