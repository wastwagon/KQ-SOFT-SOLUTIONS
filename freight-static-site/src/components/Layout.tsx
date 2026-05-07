import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'

export function Layout() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="absolute left-[-9999px] top-4 z-[100] rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white shadow-lg outline-none ring-amber-400 focus:left-4 focus:ring-2"
      >
        Skip to main content
      </a>
      <Header />
      <main id="main-content" className="flex-1" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
