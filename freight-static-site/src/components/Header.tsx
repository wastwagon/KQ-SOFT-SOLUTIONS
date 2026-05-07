import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { site } from '../content/site'

const nav = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
]

export function Header() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="border-b border-amber-500/90 bg-gradient-to-r from-amber-500 to-orange-600 py-1 text-center text-xs font-semibold tracking-wide text-white">
        <span className="hidden sm:inline">
          {site.address} · <a href={`tel:${site.phonePrimary.replace(/\s/g, '')}`}>{site.phonePrimary}</a> ·{' '}
          <a href={`mailto:${site.email}`}>{site.emailDisplay}</a>
        </span>
        <span className="sm:hidden">Call {site.phonePrimary}</span>
      </div>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link to="/" className="flex items-center gap-3" aria-label={`${site.name} home`}>
          <img src="/logo-rexgroup.svg" alt={site.name} className="h-10 w-auto md:h-12" width={200} height={48} />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  isActive ? 'bg-navy-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <Link
          to="/contact"
          className="hidden rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:brightness-110 md:inline-flex"
        >
          Get a quote
        </Link>

        <button
          type="button"
          className="inline-flex rounded-lg border border-slate-200 p-2 text-slate-800 md:hidden"
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-3 text-base font-semibold ${
                    isActive ? 'bg-navy-900 text-white' : 'text-slate-800'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <Link
              to="/contact"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 py-3 text-center font-bold text-white"
            >
              Get a quote
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  )
}
