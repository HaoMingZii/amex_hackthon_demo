import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, num, type Brief, type LlmStatus, type Merchant } from '../api'
import { loadPushed, markPushed } from '../pushed'

export default function MerchantBrief() {
  const { merchantId } = useParams()
  const navigate = useNavigate()
  const [options, setOptions] = useState<Merchant[]>([])
  const [q, setQ] = useState('')
  const [data, setData] = useState<Awaited<ReturnType<typeof api.merchant>> | null>(null)
  const [brief, setBrief] = useState<Brief | null>(null)
  const [llm, setLlm] = useState<LlmStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pushed, setPushed] = useState<string[]>(loadPushed)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    api.shortlist({ k: 80 }).then((d) => setOptions(d.rows))
    api.llmStatus().then(setLlm)
  }, [])

  useEffect(() => {
    setBrief(null)
    setData(null)
    if (!merchantId) return
    api.merchant(merchantId).then(setData)
  }, [merchantId])

  const filtered = useMemo(() => {
    const needle = q.toLowerCase()
    if (!needle) return options.slice(0, 40)
    return options.filter((m) => m.name.toLowerCase().includes(needle)).slice(0, 40)
  }, [options, q])

  const m = data?.merchant
  const canPush = Boolean(brief && merchantId && brief.id === merchantId)

  async function generate() {
    if (!merchantId) return
    setBusy(true)
    try {
      const b = await api.merchantBrief(merchantId, true, false).catch(() =>
        api.merchantBrief(merchantId, false, false),
      )
      setBrief(b)
      const live = b.source === 'llm'
      setToast(live ? 'Merchant brief generated with live LLM' : 'LLM unavailable · template brief from model facts')
      api.llmStatus().then(setLlm)
    } finally {
      setBusy(false)
      setTimeout(() => setToast(null), 2800)
    }
  }

  function push() {
    if (!m || !canPush) return
    setPushed(markPushed(m.merchant_id))
    setToast(`Pushed to BD · ${m.name}`)
    setTimeout(() => setToast(null), 2200)
  }

  async function copyHook() {
    if (!brief?.hook) return
    await navigator.clipboard.writeText(brief.hook)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <p className="text-[11px] tracking-[0.28em] uppercase text-blue">Execution · merchant LLM brief</p>
      <h1 className="font-serif text-3xl text-navy mt-1">Select a merchant, generate, then push</h1>
      <p className="mt-2 text-sm text-navy/65 max-w-3xl">
        BD must generate a merchant briefing before pushing the lead. The live LLM endpoint is
        <code className="mx-1 text-xs">POST /api/merchants/&#123;id&#125;/brief</code>
        (also <code className="mx-1 text-xs">POST /api/explain</code> with <code className="mx-1 text-xs">level=merchant</code>).
        If the model API is down, a facts-only template is returned so the demo still runs.
      </p>
      <div className="mt-2 text-xs text-navy/50">
        LLM {llm?.live ? 'live' : 'unavailable'} · fallback {llm?.fallback || 'template'}
        {llm?.circuit_reason ? ` · ${llm.circuit_reason}` : ''}
      </div>

      <div className="mt-6 border border-navy/10 bg-white p-5">
        <div className="text-[11px] uppercase tracking-widest text-navy/45">Step 1 · Choose merchant</div>
        <div className="mt-3 flex flex-wrap gap-3 items-end">
          <input
            className="border border-navy/20 px-3 py-2 text-sm min-w-[240px]"
            placeholder="Search name"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="border border-navy/20 px-3 py-2 text-sm min-w-[320px]"
            value={merchantId || ''}
            onChange={(e) => navigate(e.target.value ? `/merchant/${e.target.value}` : '/merchant')}
          >
            <option value="">Select merchant…</option>
            {filtered.map((row) => (
              <option key={row.merchant_id} value={row.merchant_id}>
                {row.name} · {row.corridor} {row.category}
              </option>
            ))}
          </select>
          <button
            className="bg-navy text-cream px-5 py-2 text-sm disabled:opacity-40"
            disabled={!merchantId || busy}
            onClick={generate}
          >
            {busy ? 'Calling LLM…' : 'Generate merchant brief'}
          </button>
        </div>
      </div>

      {!m ? (
        <p className="mt-8 text-sm text-navy/50">Pick a merchant from the list (or open one from the execution queue).</p>
      ) : (
        <div className="mt-8 grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-4">
            <div className="border border-navy/10 bg-white p-5">
              <h2 className="font-serif text-xl text-navy">{m.name}</h2>
              <p className="text-sm text-navy/60 mt-1">{m.corridor} · {m.category} · {m.address}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <Kpi label="Score" value={num(m.score, 3)} />
                <Kpi label="Rank" value={`#${m.global_rank}`} />
                <Kpi label="HP" value={m.y_high_potential ? 'Yes' : 'No'} />
                <Kpi label="Rating" value={num(m.rating, 2)} />
                <Kpi label="Reviews" value={m.reviews?.toLocaleString() ?? '—'} />
                <Kpi label="Exposure" value={num(m.exposure_score, 2)} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <Signal title="A · Macro" body={`Corridor ${m.corridor} tide is shared this month.`} />
                <Signal title="B · Merchant" body={`Momentum ${num(m.momentum_score, 2)} · ${num(m.reviews_pm_back, 1)} → ${num(m.reviews_pm_fwd, 1)} /mo.`} />
                <Signal title="C · Exposure" body={`${num(m.hotspot_min_dist_km, 1)} km to ${m.nearest_hotspot || 'hotspot'}.`} />
              </div>
              <div className="h-36 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data?.history || []}>
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="momentum" stroke="#006fcf" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <Link to="/execution" className="text-sm text-navy/60">← Back to execution queue</Link>
          </div>

          <div className="lg:col-span-7">
            {!brief || brief.id !== merchantId ? (
              <div className="border border-dashed border-navy/20 bg-cream/40 p-8 text-sm text-navy/60">
                Step 2 · Generate a briefing to learn who this merchant is. Push stays locked until the
                LLM call (or template fallback) returns.
              </div>
            ) : (
              <article className="border border-navy/10 bg-cream/60 p-5">
                <div className="text-[11px] uppercase tracking-widest text-gold">Step 2 · LLM merchant briefing</div>
                <h3 className="font-serif text-xl text-navy mt-1">{brief.headline}</h3>
                <p className="mt-3 text-sm text-navy/75 leading-relaxed whitespace-pre-wrap">
                  {brief.intro || brief.profile || brief.text}
                </p>
                {brief.profile && brief.intro && brief.profile !== brief.intro && (
                  <p className="mt-3 text-sm text-navy/60 leading-relaxed">{brief.profile}</p>
                )}
                <ul className="mt-4 space-y-1 text-sm text-navy/80">
                  {brief.bullets?.map((b) => (
                    <li key={b}>· {b}</li>
                  ))}
                </ul>
                {brief.talking_points && brief.talking_points.length > 0 && (
                  <div className="mt-4">
                    <div className="text-[11px] uppercase tracking-widest text-navy/45">Talking points</div>
                    <ul className="mt-1 space-y-1 text-sm text-navy/80">
                      {brief.talking_points.map((b) => (
                        <li key={b}>· {b}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {brief.risks && brief.risks.length > 0 && (
                  <div className="mt-4">
                    <div className="text-[11px] uppercase tracking-widest text-navy/45">Risks / caveats</div>
                    <ul className="mt-1 space-y-1 text-sm text-navy/80">
                      {brief.risks.map((b) => (
                        <li key={b}>· {b}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {brief.hook && (
                  <p className="mt-4 text-sm italic text-navy/70 border-t border-navy/10 pt-3">{brief.hook}</p>
                )}
                <div className="mt-3 text-[10px] uppercase tracking-widest text-navy/40">
                  Source · {brief.source} · status · {brief.llm_status || 'n/a'}
                  {brief.source === 'template' ? ' · live LLM intro not used' : ' · live LLM intro'}
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button className="border border-navy/30 px-4 py-2 text-sm" disabled={busy} onClick={generate}>
                    {busy ? 'Calling LLM…' : 'Regenerate'}
                  </button>
                  <button className="bg-navy text-cream px-4 py-2 text-sm disabled:opacity-40" disabled={!canPush} onClick={push}>
                    {pushed.includes(m.merchant_id) ? 'Already in BD queue' : 'Push to BD'}
                  </button>
                  <button className="border border-navy px-4 py-2 text-sm" onClick={copyHook}>
                    {copied ? 'Copied' : 'Copy outreach'}
                  </button>
                </div>
              </article>
            )}
          </div>
        </div>
      )}
      {toast && <div className="fixed bottom-6 right-6 bg-navy text-cream px-4 py-2 text-sm z-50">{toast}</div>}
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-navy/10 p-2">
      <div className="text-[10px] uppercase tracking-widest text-navy/45">{label}</div>
      <div className="text-navy font-medium">{value}</div>
    </div>
  )
}

function Signal({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-navy/10 p-2 bg-white">
      <div className="text-[10px] uppercase tracking-widest text-gold">{title}</div>
      <p className="mt-1 text-navy/70 leading-snug">{body}</p>
    </div>
  )
}
