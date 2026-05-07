import { Link } from 'react-router-dom'
import { Mail, MapPin, Phone } from 'lucide-react'
import { site } from '../content/site'

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-navy-950 text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-3">
        <div>
          <img src="/logo-rexgroup.svg" alt="" className="mb-4 h-11 brightness-0 invert" width={200} height={48} />
          <p className="text-sm leading-relaxed text-slate-400">{site.description}</p>
        </div>
        <div>
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-white">Contact</h3>
          <ul className="space-y-3 text-sm">
            <li className="flex gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
              {site.address}
            </li>
            <li className="flex gap-2">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
              <span>
                <a href={`tel:${site.phonePrimary.replace(/\s/g, '')}`} className="hover:text-white">
                  {site.phonePrimary}
                </a>
                <span className="text-slate-500"> · </span>
                <a href={`tel:${site.phoneSecondary.replace(/\s/g, '')}`} className="hover:text-white">
                  {site.phoneSecondary}
                </a>
              </span>
            </li>
            <li className="flex gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
              <a href={`mailto:${site.email}`} className="hover:text-white">
                {site.emailDisplay}
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-white">Explore</h3>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/about" className="hover:text-white">
                About us
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-white">
                Contact & quotes
              </Link>
            </li>
            <li className="pt-2 text-xs text-slate-500">Hours: {site.hours}</li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-2">
            <a
              href={site.social.facebook}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold hover:border-amber-500 hover:text-white"
            >
              Facebook
            </a>
            <a
              href={site.social.twitter}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold hover:border-amber-500 hover:text-white"
            >
              X
            </a>
            <a
              href={site.social.instagram}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold hover:border-amber-500 hover:text-white"
            >
              Instagram
            </a>
            <a
              href={site.social.linkedin}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold hover:border-amber-500 hover:text-white"
            >
              LinkedIn
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} {site.legalName}. All rights reserved.
      </div>
    </footer>
  )
}
