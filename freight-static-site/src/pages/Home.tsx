import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Globe2,
  Headphones,
  Package,
  Plane,
  Ship,
  Star,
  Timer,
  Truck,
  Warehouse,
} from 'lucide-react'
import {
  aboutIntro,
  ctaBand,
  heroModes,
  services,
  site,
  stats,
  whyChoose,
} from '../content/site'
import { usePageMeta } from '../hooks/usePageMeta'

const serviceIcons = [Truck, Ship, Globe2, Plane, Package, Warehouse]

const whyIcons = [Globe2, Package, Timer, Star, Headphones, Star]

export function Home() {
  usePageMeta(
    'RexGroup — Freight, Transport & Logistics',
    'Sea, air, and land freight, warehousing, freight forwarding, and import/export — Tema, Accra, Ghana and worldwide.',
  )

  const [heroIdx, setHeroIdx] = useState(0)
  const mode = heroModes[heroIdx]

  return (
    <>
      <section className="relative min-h-[78vh] overflow-hidden bg-navy-950">
        <div
          className="absolute inset-0 bg-cover bg-center transition-all duration-700"
          style={{
            backgroundImage:
              heroIdx === 0
                ? "url('/assets/images/aerial-view-container-cargo-ship-sea.jpg')"
                : heroIdx === 1
                  ? "url('/assets/images/XXXL.jpg')"
                  : "url('/assets/images/transportation-logistics-container-cargo-ship-cargo-plane-3d-rendering-illustration-SpundXOy.jpg')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-navy-950/95 via-navy-900/80 to-navy-950/60" />
        <div className="relative mx-auto flex max-w-6xl flex-col justify-center gap-10 px-4 py-24 md:min-h-[78vh] md:flex-row md:items-center md:py-20">
          <div className="max-w-xl text-white">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">{mode.label}</p>
            <h1 className="text-4xl font-extrabold leading-tight md:text-5xl">{mode.title}</h1>
            <p className="mt-6 text-lg leading-relaxed text-slate-200">{mode.body}</p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-3 text-sm font-bold text-white shadow-soft hover:brightness-110"
              >
                Get a free quote <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/about"
                className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"
              >
                About {site.name}
              </Link>
            </div>
          </div>
          <div className="flex w-full max-w-md flex-col gap-3 self-stretch md:self-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-200/90">Modes</p>
            <div className="grid gap-2">
              {heroModes.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setHeroIdx(i)}
                  className={`flex items-center justify-between rounded-xl border px-4 py-4 text-left transition ${
                    heroIdx === i
                      ? 'border-amber-400 bg-white/15 text-white shadow-lg'
                      : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <span className="font-semibold">{m.label}</span>
                  <span className="text-xs font-bold text-amber-300">{m.code}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="order-2 lg:order-1">
            <p className="text-sm font-bold uppercase tracking-wider text-amber-600">{aboutIntro.eyebrow}</p>
            <h2 className="mt-3 text-3xl font-extrabold text-navy-900 md:text-4xl">{aboutIntro.title}</h2>
            {aboutIntro.paragraphs.map((p) => (
              <p key={p.slice(0, 24)} className="mt-4 text-slate-600 leading-relaxed">
                {p}
              </p>
            ))}
            <ul className="mt-8 space-y-6">
              {aboutIntro.bullets.map((b) => (
                <li key={b.title} className="flex gap-4">
                  <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    <Package className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-bold text-navy-900">{b.title}</h3>
                    <p className="mt-1 text-sm text-slate-600 leading-relaxed">{b.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="order-1 lg:order-2">
            <div className="relative overflow-hidden rounded-2xl shadow-soft ring-1 ring-slate-200/80">
              <img
                src="/assets/images/rexgroupimage-1.jpeg"
                alt="RexGroup logistics operations"
                className="aspect-[4/3] w-full object-cover"
                width={800}
                height={600}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-navy-950/50 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-white/95 p-4 text-sm font-semibold text-navy-900 shadow-lg backdrop-blur">
                {site.legalName}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-wider text-amber-600">Our services</p>
            <h2 className="mt-3 text-3xl font-extrabold text-navy-900 md:text-4xl">Logistics services</h2>
            <p className="mt-4 text-slate-600">
              End-to-end coverage for freight forwarding, customs, warehousing, and multimodal transport.
            </p>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s, i) => {
              const Icon = serviceIcons[i] ?? Package
              return (
                <article
                  key={s.title}
                  className="group flex flex-col rounded-2xl border border-slate-200 bg-slate-50/80 p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow-md">
                      <Icon className="h-6 w-6" aria-hidden />
                    </span>
                    <span className="text-3xl font-black text-slate-200 transition group-hover:text-amber-200">
                      {s.n}
                    </span>
                  </div>
                  <h3 className="mt-5 text-xl font-bold text-navy-900">{s.title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">{s.description}</p>
                  <Link
                    to="/contact"
                    className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-amber-700 hover:text-amber-900"
                  >
                    Get a free quote <ArrowRight className="h-4 w-4" />
                  </Link>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-navy-950 py-20 text-white">
        <img
          src="/assets/images/transportation-logistics-container-cargo-ship-cargo-plane-3d-rendering-illustration-SpundXOy.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-navy-950 via-navy-900/95 to-amber-900/40" />
        <div className="relative mx-auto max-w-6xl px-4">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-amber-300">Why choose us</p>
              <h2 className="mt-3 text-3xl font-extrabold md:text-4xl">Reasons to work with us</h2>
              <p className="mt-4 max-w-lg text-slate-300">{ctaBand}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {whyChoose.map((w, i) => {
                const Icon = whyIcons[i] ?? Star
                return (
                  <div key={w.title} className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                    <Icon className="h-6 w-6 text-amber-400" aria-hidden />
                    <h3 className="mt-3 font-bold">{w.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300">{w.text}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-100 py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"
            >
              <p className="text-4xl font-black text-navy-900">
                {s.value}
                <span className="text-amber-600">{s.suffix}</span>
              </p>
              <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-navy-900 to-navy-950 shadow-soft">
          <div className="grid lg:grid-cols-2">
            <div className="flex flex-col justify-center p-10 text-white md:p-14">
              <Ship className="mb-4 h-10 w-10 text-amber-400" aria-hidden />
              <h2 className="text-2xl font-extrabold md:text-3xl">Ready to move your next shipment?</h2>
              <p className="mt-4 text-slate-300">{ctaBand}</p>
              <Link
                to="/contact"
                className="mt-8 inline-flex w-fit items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-3 text-sm font-bold text-white hover:brightness-110"
              >
                Contact us today <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="relative min-h-[240px] lg:min-h-0">
              <img
                src="/assets/images/REXGROUP01image.png"
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
