export type PipelineStep = { id: number; title: string; body: string }

export type Overview = {
  title: string
  as_of_month: string
  is_simulated: boolean
  warning: string
  universe: number
  high_potential: number
  precision_at_30: number
  lift_at_k: number
  roc_auc: number
  pr_auc: number
  model: string
  categories: string[]
  pipeline: PipelineStep[]
}

export type CategoryRow = {
  corridor: string
  category: string
  momentum_weighted: number
  n_merchants: number
  share_high_potential: number
  total_review_base?: number
  top_merchants?: { name: string; score: number; merchant_id: string }[]
  label?: string
}

export type CorridorFacts = {
  corridor: string
  label: string
  rank: number
  n_merchants: number
  n_high_potential: number
  high_potential_share: number
  momentum_weighted: number
  top_category: string
  categories: CategoryRow[]
  arrivals_latest_month: string | null
  arrivals_level: number | null
  arrivals_yoy: number | null
  fx_pair: string
  fx_rate: number | null
  fx_yoy: number | null
  source: string
  destination: string
}

export type Brief = {
  level: string
  id: string
  headline: string
  text?: string
  intro?: string
  profile?: string
  bullets: string[]
  talking_points?: string[]
  risks?: string[]
  hook?: string
  source: string
  llm_status?: string
  error?: string
}

export type LlmStatus = {
  configured: boolean
  enabled: boolean
  live: boolean
  provider: string
  model: string
  fallback: string
  circuit_open: boolean
  circuit_reason: string | null
  note: string
}

export type Merchant = {
  merchant_id: string
  name: string
  corridor: string
  category: string
  raw_category?: string
  address?: string
  city?: string
  lat: number | null
  lng: number | null
  website?: string
  phone?: string
  score: number
  global_rank: number
  rank_in_cell: number
  y_high_potential: number
  momentum_score: number
  reviews: number | null
  rating: number | null
  exposure_score: number | null
  hotspot_min_dist_km: number | null
  nearest_hotspot: string | null
  hotspot_count_3km?: number
  lang_share?: number | null
  reviews_pm_back?: number | null
  reviews_pm_fwd?: number | null
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`${res.status} ${path}`)
  return res.json()
}

export const api = {
  overview: () => get<Overview>('/api/overview'),
  strategy: () =>
    get<{
      as_of_month: string
      corridors: CorridorFacts[]
      categories: CategoryRow[]
      momentum_series: { corridor: string; category: string; month: string; momentum_weighted: number }[]
      arrivals: Record<string, { month: string; value: number; yoy: number | null }[]>
      briefs: { corridor: Record<string, Brief>; category: Record<string, Brief> }
      llm_live: boolean
    }>('/api/strategy'),
  shortlist: (params: { corridor?: string; category?: string; q?: string; k?: number }) => {
    const qs = new URLSearchParams()
    if (params.corridor) qs.set('corridor', params.corridor)
    if (params.category) qs.set('category', params.category)
    if (params.q) qs.set('q', params.q)
    if (params.k) qs.set('k', String(params.k))
    return get<{
      k: number
      n_filtered: number
      precision_at_k: number
      hits: number
      rows: Merchant[]
    }>(`/api/shortlist?${qs}`)
  },
  merchant: (id: string) =>
    get<{ merchant: Merchant; history: { month: string; momentum: number; rating: number; y: number }[]; llm: LlmStatus }>(
      `/api/merchant/${encodeURIComponent(id)}`,
    ),
  explain: (level: string, id: string, use_llm = true) =>
    fetch('/api/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, id, use_llm }),
    }).then(async (r) => {
      const data = (await r.json()) as Brief
      if (!r.ok || data.error === 'not found' || !data.headline) {
        throw new Error(data.error || `explain failed (${r.status})`)
      }
      return data
    }),
  merchantBrief: (id: string, use_llm = true, force = false) =>
    fetch(
      `/api/merchants/${encodeURIComponent(id)}/brief?use_llm=${use_llm}&force=${force}`,
      { method: 'POST' },
    ).then(async (r) => {
      const data = (await r.json()) as Brief
      if (!r.ok || data.error === 'not found' || !data.headline) {
        throw new Error(data.error || `brief failed (${r.status})`)
      }
      return data
    }),
  llmStatus: () => get<LlmStatus>('/api/llm/status'),
  map: (corridor?: string) =>
    get<{
      points: { merchant_id: string; name: string; corridor: string; category: string; lat: number; lng: number; score: number; y_high_potential: number }[]
      hotspots: Record<string, { name: string; lat: number; lng: number }[]> | { name: string; lat: number; lng: number }[]
    }>(`/api/map${corridor ? `?corridor=${encodeURIComponent(corridor)}` : ''}`),
  model: () =>
    get<{
      metrics: { model: string; roc_auc: number; pr_auc: number; precision_at_30: number; lift_at_k: number; n: number; base_rate: number }[]
      importances: Record<string, number>
      train_months: string[]
      embargoed_months: string[]
      test_months: string[]
      warning: string
      model: string
      n_features: number
    }>('/api/model'),
}

export function pct(v?: number | null, d = 1) {
  if (v == null || Number.isNaN(v)) return '—'
  return `${(v * 100).toFixed(d)}%`
}

export function num(v?: number | null, d = 2) {
  if (v == null || Number.isNaN(v)) return '—'
  return v.toFixed(d)
}
