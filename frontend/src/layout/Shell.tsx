import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/', label: 'Pipeline' },
  { to: '/strategy', label: 'Strategic brief' },
  { to: '/execution', label: 'Execution queue' },
  { to: '/merchant', label: 'Merchant brief' },
  { to: '/model', label: 'Model lab' },
]

export default function Shell() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="bg-navy text-cream px-6 py-2 text-[11px] tracking-[0.18em] uppercase flex items-center justify-between">
        <span>Scenario test · simulated merchant panel · not production validation</span>
        <span className="text-gold">As of 2026-05</span>
      </div>
      <header className="border-b border-navy/10 bg-paper/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-sm bg-navy text-gold grid place-items-center font-serif text-lg">A</div>
            <div>
              <div className="text-[11px] tracking-[0.28em] uppercase text-navy/60">American Express · APAC</div>
              <div className="font-serif text-lg leading-tight text-navy">Merchant Intelligence</div>
            </div>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-sm ${isActive ? 'bg-navy text-cream' : 'text-navy/70 hover:text-navy'}`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
