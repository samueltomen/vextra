import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { Activity, Bell, LayoutDashboard, Plus, Settings } from 'lucide-react'
import type { ReactNode } from 'react'

function NavLink({
  children,
  icon,
  to,
}: Readonly<{
  children: ReactNode
  icon: ReactNode
  to: '/' | '/monitors/new'
}>) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const isActive = pathname === to

  return (
    <Link
      aria-current={isActive ? 'page' : undefined}
      className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
        isActive
          ? 'bg-action-soft text-action'
          : 'text-muted hover:bg-surface hover:text-ink'
      }`}
      to={to}
    >
      {icon}
      {children}
    </Link>
  )
}

export function AppShell() {
  return (
    <div className="min-h-dvh bg-canvas text-ink lg:grid lg:grid-cols-[232px_1fr]">
      <a
        className="sr-only rounded-md bg-surface px-4 py-3 font-medium text-ink focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
        href="#main-content"
      >
        Aller au contenu
      </a>
      <aside className="hidden min-h-dvh flex-col border-r border-line bg-surface px-4 py-5 lg:flex">
        <Link className="mb-10 flex items-center gap-3 px-2" to="/">
          <span className="grid size-10 place-items-center rounded-lg bg-ink text-white">
            <Activity aria-hidden="true" size={21} />
          </span>
          <span className="text-lg font-semibold tracking-tight">CronPing</span>
        </Link>

        <nav aria-label="Navigation principale" className="space-y-1">
          <NavLink
            icon={<LayoutDashboard aria-hidden="true" size={18} />}
            to="/"
          >
            Moniteurs
          </NavLink>
          <NavLink
            icon={<Plus aria-hidden="true" size={18} />}
            to="/monitors/new"
          >
            Créer
          </NavLink>
        </nav>

        <div className="mt-auto space-y-1 border-t border-line pt-4">
          <span className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-muted">
            <Bell aria-hidden="true" size={18} />
            Notifications
            <span className="ml-auto text-xs">Bientôt</span>
          </span>
          <span className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-muted">
            <Settings aria-hidden="true" size={18} />
            Réglages
            <span className="ml-auto text-xs">Bientôt</span>
          </span>
        </div>

        <div className="mt-4 rounded-lg border border-line bg-canvas px-3 py-3">
          <p className="text-sm font-medium">Compte pilote</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Données d&apos;interface locales, aucun script transmis.
          </p>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-canvas/95 px-4 backdrop-blur-sm lg:hidden">
          <Link className="flex items-center gap-2 font-semibold" to="/">
            <span className="grid size-8 place-items-center rounded-md bg-ink text-white">
              <Activity aria-hidden="true" size={18} />
            </span>
            CronPing
          </Link>
          <nav
            aria-label="Navigation mobile"
            className="flex items-center gap-1"
          >
            <Link
              aria-label="Voir les moniteurs"
              className="grid size-11 place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink"
              to="/"
            >
              <LayoutDashboard aria-hidden="true" size={20} />
            </Link>
            <Link
              aria-label="Créer un moniteur"
              className="grid size-11 place-items-center rounded-lg bg-action text-white"
              to="/monitors/new"
            >
              <Plus aria-hidden="true" size={20} />
            </Link>
          </nav>
        </header>

        <main
          className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10"
          id="main-content"
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
