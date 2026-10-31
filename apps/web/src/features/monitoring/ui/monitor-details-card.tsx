import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BellOff, BellRing, NotebookPen } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { updateMonitorDetails } from '../api/monitoring-api.ts'
import type { MonitorView } from '../model/monitor.ts'
import { MAX_TAGS, normalizeTag } from '../model/tags.ts'

const MAX_DESCRIPTION = 200
const MAX_NOTES = 2000

export function MonitorDetailsCard({
  monitor,
}: Readonly<{ monitor: MonitorView }>) {
  const queryClient = useQueryClient()
  const [description, setDescription] = useState(monitor.description ?? '')
  const [notes, setNotes] = useState(monitor.notes ?? '')
  const [tags, setTags] = useState<readonly string[]>(monitor.tags)
  const [tagInput, setTagInput] = useState('')
  const [tagError, setTagError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['monitors'] })
  const save = useMutation({
    mutationFn: () =>
      updateMonitorDetails(monitor.id, {
        description: description.trim() || null,
        notes: notes.trim() || null,
        tags,
      }),
    onSuccess: async () => {
      setSaved(true)
      await refresh()
    },
  })
  const toggleAlerts = useMutation({
    mutationFn: (enabled: boolean) =>
      updateMonitorDetails(monitor.id, { alertsEnabled: enabled }),
    onSuccess: refresh,
  })

  function addTag() {
    const raw = tagInput.trim()

    if (raw.length === 0) {
      return
    }

    const tag = normalizeTag(raw)

    if (tag === null) {
      setTagError(
        'Tag invalide : 24 caractères max, lettres, chiffres, - ou _.',
      )

      return
    }

    if (!tags.includes(tag)) {
      if (tags.length >= MAX_TAGS) {
        setTagError(`${MAX_TAGS} tags maximum par moniteur.`)

        return
      }

      setTags([...tags, tag])
      setSaved(false)
    }

    setTagInput('')
    setTagError(null)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    save.mutate()
  }

  return (
    <section
      aria-labelledby="details-title"
      className="rounded-xl border border-line bg-surface p-4 sm:p-5"
    >
      <div className="flex items-center gap-2 text-action">
        <NotebookPen aria-hidden="true" size={18} />
        <h2 className="text-sm font-semibold" id="details-title">
          Description et notes
        </h2>
      </div>

      <form className="mt-4 space-y-3" onSubmit={submit}>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Description</span>
          <input
            className="min-h-10 w-full rounded-md border border-line bg-canvas px-3 text-sm outline-none placeholder:text-muted focus:border-action"
            maxLength={MAX_DESCRIPTION}
            onChange={(event) => {
              setSaved(false)
              setDescription(event.target.value)
            }}
            placeholder="À quoi sert ce job ? (facultatif)"
            value={description}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 flex justify-between font-medium">
            Notes
            <span className="font-mono text-xs font-normal text-muted">
              {notes.length}/{MAX_NOTES}
            </span>
          </span>
          <textarea
            className="min-h-24 w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-action"
            maxLength={MAX_NOTES}
            onChange={(event) => {
              setSaved(false)
              setNotes(event.target.value)
            }}
            placeholder="Procédure d’intervention, contacts, lien vers le runbook…"
            value={notes}
          />
        </label>
        <div className="text-sm">
          <label
            className="mb-1.5 block font-medium"
            htmlFor="monitor-tag-input"
          >
            Tags
          </label>
          {tags.length > 0 ? (
            <ul className="mb-2 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <li key={tag}>
                  <button
                    aria-label={`Retirer le tag ${tag}`}
                    className="rounded-full border border-line px-2.5 py-0.5 text-xs hover:border-danger-border hover:text-danger"
                    onClick={() => {
                      setSaved(false)
                      setTags(tags.filter((candidate) => candidate !== tag))
                    }}
                    type="button"
                  >
                    {tag} ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <input
            className="min-h-10 w-full rounded-md border border-line bg-canvas px-3 text-sm outline-none placeholder:text-muted focus:border-action"
            id="monitor-tag-input"
            onChange={(event) => setTagInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault()
                addTag()
              }
            }}
            placeholder="prod, base-de-données… (Entrée pour ajouter)"
            value={tagInput}
          />
          {tagError ? (
            <p className="mt-1.5 text-xs text-danger" role="alert">
              {tagError}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <button
            className="min-h-9 rounded-md bg-action px-4 text-sm font-semibold text-action-fg disabled:opacity-60"
            disabled={save.isPending}
            type="submit"
          >
            Enregistrer
          </button>
          {saved ? (
            <p className="text-sm text-healthy" role="status">
              Enregistré.
            </p>
          ) : null}
          {save.isError ? (
            <p className="text-sm text-danger" role="alert">
              L’enregistrement a échoué.
            </p>
          ) : null}
        </div>
      </form>

      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-canvas/40 p-3">
        <input
          checked={monitor.alertsEnabled}
          className="mt-1 size-4 accent-[var(--cp-color-action)]"
          disabled={toggleAlerts.isPending}
          onChange={(event) => toggleAlerts.mutate(event.target.checked)}
          type="checkbox"
        />
        <span>
          <span className="flex items-center gap-1.5 text-sm font-medium">
            {monitor.alertsEnabled ? (
              <BellRing aria-hidden="true" size={15} />
            ) : (
              <BellOff aria-hidden="true" size={15} />
            )}
            Alertes e-mail de ce moniteur
          </span>
          <span className="block text-xs text-muted">
            {monitor.alertsEnabled
              ? 'Vous recevez un e-mail à l’ouverture et à la résolution d’un incident.'
              : 'Désactivées : les incidents restent enregistrés, mais aucun e-mail n’est envoyé.'}
          </span>
        </span>
      </label>
    </section>
  )
}
