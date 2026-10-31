import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Check, Clipboard, Trash2, Users } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { ApiError } from '../../../api/client.ts'
import { CURRENT_ACCOUNT_QUERY_KEY } from '../../accounts/query/use-current-account.ts'
import {
  changeMemberRole,
  getTeam,
  inviteMember,
  listInvitations,
  listSpaces,
  removeMember,
  revokeInvitation,
  switchSpace,
  type CreatedInvitation,
} from '../api/team-api.ts'

const TEAM_KEY = ['team'] as const
const INVITATIONS_KEY = ['team-invitations'] as const
const SPACES_KEY = ['team-spaces'] as const

const ROLE_LABEL = {
  member: 'Membre',
  owner: 'Propriétaire',
  viewer: 'Lecture seule',
} as const

const formatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' })

function describeInviteError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'invitation_exists') {
      return 'Une invitation est déjà en attente pour cette adresse.'
    }

    if (error.code === 'limit_reached') {
      return 'Limite de 20 invitations en attente atteinte.'
    }

    if (error.code === 'forbidden') {
      return 'Seul le propriétaire peut inviter.'
    }
  }

  return 'L’invitation n’a pas pu être créée. Vérifiez l’adresse.'
}

export function TeamCard() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const teamQuery = useQuery({ queryFn: getTeam, queryKey: TEAM_KEY })
  const spacesQuery = useQuery({ queryFn: listSpaces, queryKey: SPACES_KEY })
  const invitationsQuery = useQuery({
    queryFn: listInvitations,
    queryKey: INVITATIONS_KEY,
  })
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'member' | 'viewer'>('member')
  const [created, setCreated] = useState<CreatedInvitation | null>(null)
  const [copied, setCopied] = useState(false)
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: TEAM_KEY })
    void queryClient.invalidateQueries({ queryKey: INVITATIONS_KEY })
    void queryClient.invalidateQueries({ queryKey: SPACES_KEY })
  }
  const invite = useMutation({
    mutationFn: () => inviteMember({ email: email.trim(), role }),
    onSuccess: (result) => {
      setCreated(result)
      setCopied(false)
      setEmail('')
      refresh()
    },
  })
  const revoke = useMutation({
    mutationFn: revokeInvitation,
    onSuccess: refresh,
  })
  const change = useMutation({
    mutationFn: (input: { role: 'member' | 'viewer'; userId: string }) =>
      changeMemberRole(input.userId, input.role),
    onSuccess: refresh,
  })
  const remove = useMutation({ mutationFn: removeMember, onSuccess: refresh })
  const leave = useMutation({
    mutationFn: removeMember,
    onSuccess: async () => {
      // The current space is gone: restart from the default one.
      const first = spacesQuery.data?.find(
        (space) => space.tenantId !== currentSpace,
      )

      if (first) {
        await switchTo.mutateAsync(first.tenantId)
      }
    },
  })
  const switchTo = useMutation({
    mutationFn: switchSpace,
    onSuccess: async (account) => {
      queryClient.removeQueries({
        predicate: (query) =>
          query.queryKey[0] !== CURRENT_ACCOUNT_QUERY_KEY[0],
      })
      queryClient.setQueryData(CURRENT_ACCOUNT_QUERY_KEY, account)
      await navigate({ to: '/' })
    },
  })
  const team = teamQuery.data
  const spaces = spacesQuery.data ?? []
  const currentSpace = queryClient.getQueryData<{ tenantId: string }>(
    CURRENT_ACCOUNT_QUERY_KEY,
  )?.tenantId
  const isOwner = team?.role === 'owner'
  const link = created
    ? `${window.location.origin}/invite/${created.token}`
    : null

  function submit(event: FormEvent) {
    event.preventDefault()
    invite.mutate()
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(true)
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex items-center gap-2 text-action">
        <Users aria-hidden="true" size={18} />
        <h2 className="text-sm font-semibold">Équipe</h2>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted">
        Invitez des collaborateurs : <strong>Membre</strong> peut tout modifier,{' '}
        <strong>Lecture seule</strong> peut seulement consulter.
      </p>

      {spaces.length > 1 ? (
        <label className="mt-4 block text-sm">
          <span className="mb-1.5 block font-medium">Espace actif</span>
          <select
            className="min-h-10 w-full rounded-md border border-line bg-canvas px-3 text-sm outline-none focus:border-action"
            disabled={switchTo.isPending}
            onChange={(event) => switchTo.mutate(event.target.value)}
            value={currentSpace ?? ''}
          >
            {spaces.map((space) => (
              <option key={space.tenantId} value={space.tenantId}>
                {space.role === 'owner'
                  ? 'Mon espace'
                  : `Espace de ${space.ownerEmail ?? 'un collègue'}`}{' '}
                · {ROLE_LABEL[space.role]}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <ul className="mt-4 space-y-2">
        {(team?.members ?? []).map((member) => {
          const isSelf = member.userId === team?.userId

          return (
            <li
              className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-canvas/40 p-3"
              key={member.userId}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {member.email}
                  {isSelf ? (
                    <span className="ml-2 text-xs text-muted">(vous)</span>
                  ) : null}
                </p>
                <p className="font-mono text-xs text-muted">
                  Depuis le {formatter.format(new Date(member.joinedAt))}
                </p>
              </div>
              {isOwner && member.role !== 'owner' ? (
                <select
                  aria-label={`Rôle de ${member.email}`}
                  className="min-h-9 rounded-md border border-line bg-canvas px-2 text-sm"
                  disabled={change.isPending}
                  onChange={(event) =>
                    change.mutate({
                      role: event.target.value as 'member' | 'viewer',
                      userId: member.userId,
                    })
                  }
                  value={member.role}
                >
                  <option value="member">Membre</option>
                  <option value="viewer">Lecture seule</option>
                </select>
              ) : (
                <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">
                  {ROLE_LABEL[member.role]}
                </span>
              )}
              {isOwner && member.role !== 'owner' ? (
                <button
                  aria-label={`Retirer ${member.email}`}
                  className="grid size-9 place-items-center rounded-md border border-line text-muted hover:border-danger-border hover:text-danger"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(member.userId)}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={15} />
                </button>
              ) : null}
              {isSelf && member.role !== 'owner' ? (
                <button
                  className="min-h-9 rounded-md border border-line px-3 text-sm hover:border-danger-border hover:text-danger"
                  disabled={leave.isPending}
                  onClick={() => leave.mutate(member.userId)}
                  type="button"
                >
                  Quitter cet espace
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>

      {isOwner ? (
        <>
          {created && link ? (
            <div
              className="mt-4 rounded-lg border border-healthy-border bg-healthy-bg p-3"
              role="status"
            >
              <p className="text-sm font-medium text-healthy">
                Invitation créée pour {created.invitation.email}. Envoyez-lui ce
                lien : il n’est affiché qu’une fois et expire dans 7 jours.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="break-all rounded bg-canvas px-2 py-1 font-mono text-xs">
                  {link}
                </code>
                <button
                  className="flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm"
                  onClick={() => void copy(link)}
                  type="button"
                >
                  {copied ? (
                    <Check aria-hidden="true" size={14} />
                  ) : (
                    <Clipboard aria-hidden="true" size={14} />
                  )}
                  {copied ? 'Lien copié' : 'Copier le lien'}
                </button>
              </div>
              <p className="mt-2 text-xs text-muted">
                La personne doit se connecter (ou créer un compte) avec
                exactement cette adresse e-mail.
              </p>
            </div>
          ) : null}

          {invitationsQuery.data && invitationsQuery.data.length > 0 ? (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium">Invitations en attente</p>
              <ul className="space-y-2">
                {invitationsQuery.data.map((invitation) => (
                  <li
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-canvas/40 p-3"
                    key={invitation.id}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{invitation.email}</p>
                      <p className="font-mono text-xs text-muted">
                        {ROLE_LABEL[invitation.role]} · expire le{' '}
                        {formatter.format(new Date(invitation.expiresAt))}
                      </p>
                    </div>
                    <button
                      aria-label={`Annuler l’invitation de ${invitation.email}`}
                      className="grid size-9 place-items-center rounded-md border border-line text-muted hover:border-danger-border hover:text-danger"
                      disabled={revoke.isPending}
                      onClick={() => revoke.mutate(invitation.id)}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <form
            className="mt-5 flex flex-wrap items-end gap-3"
            onSubmit={submit}
          >
            <label className="block min-w-48 flex-1 text-sm">
              <span className="mb-1.5 block font-medium">
                Adresse e-mail à inviter
              </span>
              <input
                className="min-h-10 w-full rounded-md border border-line bg-canvas px-3 text-sm outline-none focus:border-action"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="collegue@entreprise.com"
                type="email"
                value={email}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">Rôle</span>
              <select
                className="min-h-10 rounded-md border border-line bg-canvas px-3 text-sm"
                onChange={(event) =>
                  setRole(event.target.value as 'member' | 'viewer')
                }
                value={role}
              >
                <option value="member">Membre</option>
                <option value="viewer">Lecture seule</option>
              </select>
            </label>
            <button
              className="min-h-10 rounded-md bg-action px-4 text-sm font-semibold text-action-fg disabled:opacity-60"
              disabled={invite.isPending || email.trim().length === 0}
              type="submit"
            >
              Créer l’invitation
            </button>
          </form>
          {invite.isError ? (
            <p
              className="mt-3 rounded-lg border border-danger-border bg-danger-bg p-3 text-sm text-danger"
              role="alert"
            >
              {describeInviteError(invite.error)}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
