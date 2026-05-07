import { Clock, Mail, MapPin, Phone } from 'lucide-react'
import { site } from '../content/site'
import { usePageMeta } from '../hooks/usePageMeta'

export function Contact() {
  usePageMeta(
    'Contact',
    `Contact RexGroup in ${site.address}. Phone ${site.phonePrimary}. Email ${site.email}.`,
  )

  return (
    <>
      <section className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-sm font-bold uppercase tracking-wider text-amber-600">Get in touch</p>
          <h1 className="mt-3 text-4xl font-extrabold text-navy-900 md:text-5xl">Contact us today</h1>
          <p className="mt-4 max-w-2xl text-slate-600">
            Reach the team for quotes, shipment support, or general enquiries. We respond during business hours and
            monitor urgent logistics requests.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-10 lg:grid-cols-3">
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <Phone className="h-8 w-8 text-amber-600" aria-hidden />
              <h2 className="mt-4 font-bold text-navy-900">Call us now</h2>
              <p className="mt-2 text-slate-600">
                <a href={`tel:${site.phonePrimary.replace(/\s/g, '')}`} className="font-semibold hover:text-amber-700">
                  {site.phonePrimary}
                </a>
                <br />
                <a href={`tel:${site.phoneSecondary.replace(/\s/g, '')}`} className="font-semibold hover:text-amber-700">
                  {site.phoneSecondary}
                </a>
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <MapPin className="h-8 w-8 text-amber-600" aria-hidden />
              <h2 className="mt-4 font-bold text-navy-900">Our office</h2>
              <p className="mt-2 text-slate-600">{site.address}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <Mail className="h-8 w-8 text-amber-600" aria-hidden />
              <h2 className="mt-4 font-bold text-navy-900">Email us</h2>
              <p className="mt-2">
                <a href={`mailto:${site.email}`} className="font-semibold text-amber-700 hover:text-amber-900">
                  {site.emailDisplay}
                </a>
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <Clock className="h-8 w-8 text-amber-600" aria-hidden />
              <h2 className="mt-4 font-bold text-navy-900">Opening hours</h2>
              <p className="mt-2 text-slate-600">{site.hours}</p>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm md:p-10">
              <h2 className="text-xl font-bold text-navy-900">Send a message</h2>
              <p className="mt-2 text-sm text-slate-600">
                Submissions are delivered by email. First-time messages may require confirming your address — check your
                inbox after sending.
              </p>
              <form
                action="https://formsubmit.co/info@rexgroupfreighttransport.com"
                method="POST"
                className="mt-8 grid gap-5"
              >
                <input type="hidden" name="_subject" value="Website enquiry — RexGroup" />
                <input type="hidden" name="_template" value="table" />
                <input type="hidden" name="_captcha" value="false" />
                <input type="text" name="_gotcha" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-navy-900">
                    First name
                    <input
                      name="first_name"
                      required
                      className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-navy-900">
                    Last name
                    <input
                      name="last_name"
                      required
                      className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
                    />
                  </label>
                </div>
                <label className="block text-sm font-semibold text-navy-900">
                  Email
                  <input
                    type="email"
                    name="email"
                    required
                    className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
                  />
                </label>
                <label className="block text-sm font-semibold text-navy-900">
                  Phone
                  <input
                    type="tel"
                    name="phone"
                    className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
                  />
                </label>
                <label className="block text-sm font-semibold text-navy-900">
                  Reason for enquiry
                  <select
                    name="reason"
                    className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
                  >
                    <option value="General">General</option>
                    <option value="Shipment">Shipment</option>
                    <option value="Support">Support</option>
                  </select>
                </label>
                <label className="block text-sm font-semibold text-navy-900">
                  Message
                  <textarea
                    name="message"
                    required
                    rows={5}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-8 py-4 text-sm font-bold text-white shadow-md hover:brightness-110"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
