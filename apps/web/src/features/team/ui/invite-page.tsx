import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

import { BrandMark } from '../../../components/brand-mark.tsx'
import { CURRENT_ACCOUNT_QUERY_KEY } from '../../accounts/query/use-current-account.ts'
import { useCurrentAccount } from '../../accounts/query/use-current-account.ts'
import { acceptInvitation, switchSpace } from '../api/team-api.ts'
import { PENDING_INVITE_KEY } from '../model/pending-invite.ts'

type Outcome = 'accepting' | 'invalid'

export function InvitePage() {
  const { token } = useParams({ from: '/invite/$token' })
  const accountQuery = useCurrentAccount()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [outcome, setOutcome] = useState<Outcome>('accepting')
  const started = useRef(false)
  const account = accountQuery.data
  const loading = accountQuery.isPending

  const phase = !loading && !account ? 'login' : outcome

  useEffect(() => {
    if (loading || started.current) {
      return
    }

    started.current = true

    if (!account) {
      try {
        window.sessionStorage.setItem(PENDING_INVITE_KEY, token)
      } catch {
        // Storage can be unavailable; the link still works once logged in.
      }

      return
    }

    void (async () => {
      try {
        const tenantId = await acceptInvitation(token)

        if (!tenantId) {
          setOutcome('invalid')

          return
        }

        window.sessionStorage.removeItem(PENDING_INVITE_KEY)
        const next = await switchSpace(tenantId)

        queryClient.removeQueries({
          predicate: (query) =>
            query.queryKey[0] !== CURRENT_ACCOUNT_QUERY_KEY[0],
        })
        queryClient.setQueryData(CURRENT_ACCOUNT_QUERY_KEY, next)
        await navigate({ replace: true, to: '/' })
      } catch {
        setOutcome('invalid')
      }
    })()
  }, [account, loading, navigate, queryClient, token])

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 text-ink">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-8 text-center shadow-card">
        <div className="mb-4 flex justify-center">
          <BrandMark size="lg" />
        </div>
        {phase === 'accepting' ? (
          <p role="status">Acceptation de l’invitation…</p>
        ) : null}
        {phase === 'login' ? (
          <>
            <h1 className="text-xl font-semibold">Vous êtes invité</h1>
            <p className="mt-2 text-sm text-muted">
              Connectez-vous, ou créez un compte, avec l’adresse e-mail à
              laquelle l’invitation a été envoyée pour rejoindre l’espace.
            </p>
            <Link
              className="mt-5 inline-flex min-h-10 items-center rounded-md bg-action px-4 text-sm font-semibold text-action-fg"
              to="/login"
            >
              Se connecter
            </Link>
          </>
        ) : null}
        {phase === 'invalid' ? (
          <>
            <h1 className="text-xl font-semibold">Invitation inutilisable</h1>
            <p className="mt-2 text-sm text-muted">
              Ce lien est expiré, déjà utilisé, annulé, ou il est destiné à une
              autre adresse e-mail que celle de votre compte.
            </p>
            <Link
              className="mt-5 inline-flex min-h-10 items-center rounded-md border border-line px-4 text-sm"
              to="/"
            >
              Retour à l’application
            </Link>
          </>
        ) : null}
      </div>
    </main>
  )
}
