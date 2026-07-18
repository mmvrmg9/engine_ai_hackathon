import { NavLink } from 'react-router-dom'
import { JourneyIcon, PatternsIcon, ShareIcon, TodayIcon } from './icons'

const TABS = [
  { to: '/', label: 'Today', Icon: TodayIcon },
  { to: '/patterns', label: 'Patterns', Icon: PatternsIcon },
  { to: '/share', label: 'Share', Icon: ShareIcon },
  { to: '/journey', label: 'Journey', Icon: JourneyIcon },
]

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-md justify-around">
        {TABS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors ${
                isActive ? 'text-violet-700' : 'text-slate-400'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
