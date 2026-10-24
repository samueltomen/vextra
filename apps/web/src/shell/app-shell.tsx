import { Button } from '@heroui/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Link,
  Navigate,
  Outlet,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import {
  Activity,
  Bell,
  LayoutDashboard,
  LogOut,
  Plus,
  RefreshCw,
  Settings,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { signOut } from '../features/accounts/api/account-api.ts'
import type { CurrentAccount } from '../features/accounts/model/account.ts'
import {
  CURRENT_ACCOUNT_QUERY_KEY,
  useCurrentAccount,
} from '../features/accounts/query/use-current-account.ts'
import { isDemoModeEnabled } from '../demo/demo-mode.ts'

function NavLink({
  children,
  icon,
  to,
}: Readonly<{
  children: ReactNode
  icon: ReactNode
  to: '/' | '/monitors/new' | '/notifications'
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
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-lg bg-ink text-white">
          <Activity aria-hidden="true" size={23} />
        </span>
        <h1 className="mt-5 text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
      </div>
    </main>
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
          <NavLink
            icon={<Bell aria-hidden="true" size={18} />}
            to="/notifications"
          >
            Notifications
          </NavLink>
          <span className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-muted">
            <Settings aria-hidden="true" size={18} />
            Réglages
            <span className="ml-auto text-xs">Bientôt</span>
          </span>
        </div>

        <div className="mt-4 rounded-lg border border-line bg-canvas px-3 py-3">
          <p
            className="truncate text-sm font-medium"
            title={account.user.email}
          >
            {account.user.email}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted">
            {demoMode
              ? 'Mode démo local, données fictives.'
              : 'Session sécurisée. Aucun contenu de script transmis.'}
          </p>
          <Button
            className="mt-3 min-h-10 w-full justify-start text-muted"
            isLoading={isLoggingOut}
            onPress={onLogout}
            radius="md"
            startContent={
              isLoggingOut ? undefined : <LogOut aria-hidden="true" size={16} />
            }
            variant="light"
          >
            {demoMode ? 'Quitter la démo' : 'Se déconnecter'}
          </Button>
        </div>
      </aside>

      <div className="min-w-0">
        {demoMode ? (
          <div className="border-b border-action/20 bg-action-soft px-4 py-2 text-center text-xs font-medium text-action">
            Mode démo local · aucune requête API ni donnée Supabase
          </div>
        ) : null}
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
            <Link
              aria-label="Voir les notifications"
              className="grid size-11 place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink"
              to="/notifications"
            >
              <Bell aria-hidden="true" size={20} />
            </Link>
            <button
              aria-label={demoMode ? 'Quitter la démo' : 'Se déconnecter'}
              className="grid size-11 place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink disabled:opacity-50"
              disabled={isLoggingOut}
              onClick={onLogout}
              type="button"
            >
              <LogOut aria-hidden="true" size={19} />
            </button>
          </nav>
        </header>

        <main
          className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10"
          id="main-content"
        >
          {children}
        </main>
      </div>
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
