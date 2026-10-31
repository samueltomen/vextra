import { Button } from '@heroui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Link,
  Navigate,
  Outlet,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import {
  Bell,
  LayoutDashboard,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Settings,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import { BrandMark } from '../components/brand-mark.tsx'
import { signOut } from '../features/accounts/api/account-api.ts'
import type { CurrentAccount } from '../features/accounts/model/account.ts'
import {
  CURRENT_ACCOUNT_QUERY_KEY,
  useCurrentAccount,
} from '../features/accounts/query/use-current-account.ts'
import { listMonitors } from '../features/monitoring/api/monitoring-api.ts'
import { summarizeMonitors } from '../features/monitoring/model/monitor.ts'
import { withEffectiveStatus } from '../features/monitoring/model/monitor-timing.ts'
import { useNow } from '../lib/use-now.ts'
import { isDemoModeEnabled } from '../demo/demo-mode.ts'
import { usePreferences } from '../features/workspace/query/use-preferences.ts'
import { CommandPalette } from './command-palette.tsx'
import { ThemeCycleButton, ThemeToggle } from './theme-toggle.tsx'

type NavTarget = '/' | '/monitors/new' | '/notifications' | '/settings'

const MONITORS_REFRESH_MS = 30_000

function isNavActive(pathname: string, to: NavTarget): boolean {
  if (to === '/') {
    return (
      pathname === '/' ||
      (pathname.startsWith('/monitors/') && pathname !== '/monitors/new')
    )
  }

  return pathname === to
}

function useMonitorSummary() {
  const monitorsQuery = useQuery({
    queryFn: listMonitors,
    queryKey: ['monitors', null],
    refetchInterval: MONITORS_REFRESH_MS,
  })

  const nowMs = useNow()

  return monitorsQuery.data
    ? summarizeMonitors(
        monitorsQuery.data.map((monitor) =>
          withEffectiveStatus(monitor, nowMs),
        ),
      )
    : null
}

function NavLink({
  badge,
  children,
  icon,
  to,
}: Readonly<{
  badge?: ReactNode
  children: ReactNode
  icon: ReactNode
  to: NavTarget
}>) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const isActive = isNavActive(pathname, to)

  return (
    <Link
      aria-current={isActive ? 'page' : undefined}
      className={`relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
        isActive
          ? 'bg-sidebar-active text-sidebar-ink'
          : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-ink'
      }`}
      to={to}
    >
      {isActive ? (
        <span
          aria-hidden="true"
          className="absolute -left-4 top-2 h-7 w-1 rounded-r-full bg-sidebar-accent"
        />
      ) : null}
      <span className={isActive ? 'text-sidebar-accent' : ''}>{icon}</span>
      <span className="flex-1">{children}</span>
      {badge}
    </Link>
  )
}

function FullPageStatus({
  description,
  title,
}: Readonly<{ description: string; title: string }>) {
  return (
    <main
      aria-live="polite"
      className="grid min-h-dvh place-items-center bg-canvas px-4"
      role="status"
    >
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-8 text-center shadow-card">
        <div className="mx-auto w-fit">
          <BrandMark size="lg" />
        </div>
        <h1 className="mt-5 text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
      </div>
    </main>
  )
}

function SystemStatus() {
  const summary = useMonitorSummary()

  if (!summary || summary.total === 0) {
    return null
  }

  const hasIncident = summary.late > 0

  return (
    <div
      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-xs font-medium ${
        hasIncident
          ? 'border-warning-border bg-warning-bg text-warning'
          : 'border-healthy-border bg-healthy-bg text-healthy'
      }`}
      role="status"
    >
      <span
        aria-hidden="true"
        className={`size-2 shrink-0 rounded-full bg-current ${
          hasIncident ? 'cp-pulse' : ''
        }`}
      />
      {hasIncident
        ? `${summary.late} incident${summary.late > 1 ? 's' : ''} en cours`
        : 'Tout est dans les temps'}
    </div>
  )
}

function LateBadge() {
  const late = useMonitorSummary()?.late ?? 0

  if (late === 0) {
    return null
  }

  return (
    <span
      aria-hidden="true"
      className="grid min-w-5 place-items-center rounded-full bg-[#fbbf24] px-1.5 text-[11px] font-bold text-[#2d2208] tabular-nums"
    >
      {late}
    </span>
  )
}

function MobileTab({
  icon,
  label,
  to,
}: Readonly<{ icon: ReactNode; label: string; to: NavTarget }>) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const isActive = isNavActive(pathname, to)

  return (
    <Link
      aria-current={isActive ? 'page' : undefined}
      aria-label={label}
      className={`grid min-h-14 place-items-center ${
        isActive ? 'text-sidebar-accent' : 'text-sidebar-muted'
      }`}
      to={to}
    >
      {icon}
    </Link>
  )
}

function AppFrame({
  account,
  children,
  demoMode,
  isLoggingOut,
  onLogout,
}: Readonly<{
  account: CurrentAccount
  children: ReactNode
  demoMode: boolean
  isLoggingOut: boolean
  onLogout: () => void
}>) {
  const [paletteOpen, setPaletteOpen] = useState(false)

  usePreferences()

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((isOpen) => !isOpen)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="min-h-dvh bg-canvas text-ink lg:grid lg:grid-cols-[256px_1fr]">
      <a
        className="sr-only rounded-md bg-surface px-4 py-3 font-medium text-ink focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
        href="#main-content"
      >
        Aller au contenu
      </a>

      <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto border-r border-sidebar-line bg-sidebar px-4 py-5 text-sidebar-ink lg:flex">
        <Link className="mb-6 flex items-center gap-3 px-2" to="/">
          <BrandMark />
          <span className="text-lg font-semibold tracking-tight">CronPing</span>
        </Link>

        <button
          aria-label="Ouvrir la recherche"
          className="mb-5 flex min-h-10 items-center gap-2 rounded-lg border border-sidebar-line bg-sidebar-hover/60 px-3 text-sm text-sidebar-muted transition-colors hover:text-sidebar-ink"
          onClick={() => setPaletteOpen(true)}
          type="button"
        >
          <Search aria-hidden="true" size={15} />
          <span className="flex-1 text-left">Rechercher…</span>
          <kbd className="rounded border border-sidebar-line px-1.5 font-mono text-[10px]">
            Ctrl K
          </kbd>
        </button>

        <nav aria-label="Navigation principale" className="space-y-1">
          <NavLink
            badge={<LateBadge />}
            icon={<LayoutDashboard aria-hidden="true" size={18} />}
            to="/"
          >
            Moniteurs
          </NavLink>
          <NavLink
            icon={<Plus aria-hidden="true" size={18} />}
            to="/monitors/new"
          >
            Nouveau moniteur
          </NavLink>
          <NavLink
            icon={<Bell aria-hidden="true" size={18} />}
            to="/notifications"
          >
            Notifications
          </NavLink>
        </nav>

        <div className="mt-auto space-y-3 pt-6">
          <SystemStatus />
          <NavLink
            icon={<Settings aria-hidden="true" size={18} />}
            to="/settings"
          >
            Réglages
          </NavLink>
          <ThemeToggle />

          <div className="rounded-xl border border-sidebar-line bg-sidebar-hover/50 p-3">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="grid size-8 shrink-0 place-items-center rounded-full bg-sidebar-active text-xs font-bold uppercase text-sidebar-accent"
              >
                {account.user.email.slice(0, 1)}
              </span>
              <p
                className="min-w-0 flex-1 truncate text-sm font-medium"
                title={account.user.email}
              >
                {account.user.email}
              </p>
            </div>
            <p className="mt-2 text-xs leading-5 text-sidebar-muted">
              {demoMode
                ? 'Mode démo local, données fictives.'
                : 'Session sécurisée. Aucun contenu de script transmis.'}
            </p>
            <Button
              className="mt-2 min-h-10 w-full justify-start text-sidebar-muted data-[hover=true]:text-sidebar-ink"
              isLoading={isLoggingOut}
              onPress={onLogout}
              radius="md"
              startContent={
                isLoggingOut ? undefined : (
                  <LogOut aria-hidden="true" size={16} />
                )
              }
              variant="light"
            >
              {demoMode ? 'Quitter la démo' : 'Se déconnecter'}
            </Button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        {demoMode ? (
          <div className="border-b border-action/20 bg-action-soft px-4 py-2 text-center text-xs font-medium text-action">
            Mode démo local · aucune requête API ni donnée Supabase
          </div>
        ) : null}

        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-canvas/90 px-4 backdrop-blur-md lg:hidden">
          <Link className="flex items-center gap-2.5 font-semibold" to="/">
            <BrandMark size="sm" />
            CronPing
          </Link>
          <div className="flex items-center">
            <button
              aria-label="Rechercher"
              className="grid size-11 place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink"
              onClick={() => setPaletteOpen(true)}
              type="button"
            >
              <Search aria-hidden="true" size={19} />
            </button>
            <ThemeCycleButton />
            <button
              aria-label={demoMode ? 'Quitter la démo' : 'Se déconnecter'}
              className="grid size-11 place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink disabled:opacity-50"
              disabled={isLoggingOut}
              onClick={onLogout}
              type="button"
            >
              <LogOut aria-hidden="true" size={19} />
            </button>
          </div>
        </header>

        <main
          className="mx-auto w-full max-w-[1200px] px-4 pb-28 pt-8 sm:px-6 lg:px-8 lg:pb-12 lg:pt-10"
          id="main-content"
        >
          {children}
        </main>

        <nav
          aria-label="Navigation mobile"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-sidebar-line bg-sidebar px-2 pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          <MobileTab
            icon={<LayoutDashboard aria-hidden="true" size={21} />}
            label="Voir les moniteurs"
            to="/"
          />
          <MobileTab
            icon={<Plus aria-hidden="true" size={21} />}
            label="Créer un moniteur"
            to="/monitors/new"
          />
          <MobileTab
            icon={<Bell aria-hidden="true" size={21} />}
            label="Voir les notifications"
            to="/notifications"
          />
          <MobileTab
            icon={<Settings aria-hidden="true" size={21} />}
            label="Ouvrir les réglages"
            to="/settings"
          />
        </nav>
      </div>

      <CommandPalette
        isOpen={paletteOpen}
        onLogout={onLogout}
        onOpenChange={setPaletteOpen}
      />
    </div>
  )
}

export function AppShell() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const accountQuery = useCurrentAccount()
  const demoMode = isDemoModeEnabled()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const logout = useMutation({
    mutationFn: signOut,
    onSuccess: async () => {
      queryClient.setQueryData(CURRENT_ACCOUNT_QUERY_KEY, null)
      queryClient.removeQueries({ queryKey: ['monitors'] })
      await navigate({ replace: true, to: '/login' })
    },
  })

  if (pathname === '/login') {
    if (accountQuery.isPending) {
      return (
        <FullPageStatus
          description="Vérification de votre cookie de session."
          title="Chargement de CronPing"
        />
      )
    }

    if (accountQuery.data) {
      return <Navigate replace to="/" />
    }

    return <Outlet />
  }

  if (accountQuery.isPending) {
    return (
      <FullPageStatus
        description="Nous vérifions votre session avant d’ouvrir le dashboard."
        title="Chargement de la session"
      />
    )
  }

  if (accountQuery.isError) {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas px-4">
        <div className="w-full max-w-md rounded-xl border border-danger-border bg-danger-bg p-8 text-center text-danger">
          <h1 className="text-xl font-semibold">Session indisponible</h1>
          <p className="mt-2 text-sm leading-6">
            Le serveur n’a pas pu vérifier votre session.
          </p>
          <Button
            className="mt-5 border-danger-border text-danger"
            onPress={() => void accountQuery.refetch()}
            radius="md"
            startContent={<RefreshCw aria-hidden="true" size={16} />}
            variant="bordered"
          >
            Réessayer
          </Button>
        </div>
      </main>
    )
  }

  if (!accountQuery.data) {
    return <Navigate replace to="/login" />
  }

  return (
    <AppFrame
      account={accountQuery.data}
      demoMode={demoMode}
      isLoggingOut={logout.isPending}
      onLogout={() => logout.mutate()}
    >
      <Outlet />
    </AppFrame>
  )
}
