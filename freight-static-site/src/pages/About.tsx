import { Link } from 'react-router-dom'
import { ArrowRight, Package } from 'lucide-react'
import { aboutIntro, aboutLong, services, site, visionMission, whyChoose } from '../content/site'
import { usePageMeta } from '../hooks/usePageMeta'

export function About() {
  usePageMeta(
    'About',
    'Vision, mission, and logistics services — land, sea, air, import/export, freight forwarding, and warehousing.',
  )

  return (
    <>
      <section className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-sm font-bold uppercase tracking-wider text-amber-600">About us</p>
          <h1 className="mt-3 text-4xl font-extrabold text-navy-900 md:text-5xl">{aboutLong.title}</h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-600">{aboutLong.body}</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-8 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-bold text-navy-900">{visionMission.vision.title}</h2>
            <p className="mt-4 text-slate-600 leading-relaxed">{visionMission.vision.text}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-bold text-navy-900">{visionMission.mission.title}</h2>
            <p className="mt-4 text-slate-600 leading-relaxed">{visionMission.mission.text}</p>
          </article>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-extrabold text-navy-900">Fast worldwide delivery</h2>
          <p className="mt-3 max-w-3xl text-slate-600">{aboutIntro.bullets[0].text}</p>
          <h2 className="mt-10 text-2xl font-extrabold text-navy-900">Safe and secure delivery</h2>
          <p className="mt-3 max-w-3xl text-slate-600">{aboutIntro.bullets[1].text}</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-3xl font-extrabold text-navy-900">We provide all kinds of logistics service</h2>
        <p className="mt-4 max-w-3xl text-slate-600">
          We offer a comprehensive range of logistics services to meet all your transportation and supply chain needs.
          From freight forwarding to warehousing, we’ve got you covered.
        </p>
        <ul className="mt-12 space-y-10">
          {services.map((s) => (
            <li key={s.n} className="flex gap-4 border-b border-slate-200 pb-10 last:border-0">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-lg font-black text-amber-800">
                {s.n}
              </span>
              <div>
                <h3 className="text-xl font-bold text-navy-900">{s.title}</h3>
                <p className="mt-3 text-slate-600 leading-relaxed">{s.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-navy-950 py-16 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-extrabold">Reasons to work with us</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {whyChoose.map((w) => (
              <div key={w.title} className="rounded-xl border border-white/10 bg-white/5 p-6">
                <Package className="h-6 w-6 text-amber-400" aria-hidden />
                <h3 className="mt-3 font-bold">{w.title}</h3>
                <p className="mt-2 text-sm text-slate-300 leading-relaxed">{w.text}</p>
              </div>
            ))}
          </div>
          <Link
            to="/contact"
            className="mt-12 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-3 text-sm font-bold text-white hover:brightness-110"
          >
            Work with {site.name} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  )
}
