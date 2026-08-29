import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, num, pct } from '../api'

export default function ModelLab() {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.model>> | null>(null)

  useEffect(() => {
    api.model().then(setData)
  }, [])

  if (!data) return <div className="p-10 text-navy/50">Loading model lab…</div>

  const imp = Object.entries(data.importances)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, value]) => ({ name, value: Number((value * 100).toFixed(2)) }))

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <p className="text-[11px] tracking-[0.28em] uppercase text-navy/50">Evidence for judges · not the commercial workspace</p>
      <h1 className="font-serif text-3xl text-navy mt-1">Model lab</h1>
      <p className="mt-3 text-sm text-navy/65 max-w-3xl leading-relaxed">{data.warning}</p>

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        {data.train_months.map((m) => (
          <span key={m} className="bg-navy text-cream px-2 py-1">{m} train</span>
        ))}
        {data.embargoed_months.map((m) => (
          <span key={m} className="bg-gold/30 text-navy px-2 py-1">{m} embargo</span>
        ))}
        {data.test_months.map((m) => (
          <span key={m} className="border border-navy px-2 py-1">{m} test</span>
        ))}
      </div>

      <div className="mt-8 overflow-auto border border-navy/10 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-navy text-cream text-left text-[11px] uppercase tracking-wider">
            <tr>
              {['Model', 'ROC-AUC', 'PR-AUC', 'P@30', 'Lift@30'].map((h) => (
                <th key={h} className="px-4 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.metrics.map((m) => (
              <tr key={m.model} className="border-t border-navy/10">
                <td className="px-4 py-2 font-medium">{m.model}</td>
                <td className="px-4 py-2">{num(m.roc_auc, 3)}</td>
                <td className="px-4 py-2">{num(m.pr_auc, 3)}</td>
                <td className="px-4 py-2">{pct(m.precision_at_30, 0)}</td>
                <td className="px-4 py-2">{num(m.lift_at_k, 2)}×</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 bg-white border border-navy/10 p-5">
        <h2 className="font-serif text-xl text-navy">Feature importance (gain)</h2>
        <div className="h-80 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={imp} layout="vertical" margin={{ left: 140 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#00175a22" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#00175a" name="Gain %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
