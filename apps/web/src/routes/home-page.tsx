import { Button } from '@heroui/react'
import { Activity } from 'lucide-react'

export function HomePage() {
  return (
    <main className="min-h-dvh bg-canvas px-4 py-10 text-ink sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-12">
        <header className="flex items-center justify-between border-b border-line pb-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-action text-white">
              <Activity aria-hidden="true" size={22} />
            </span>
            <span className="text-lg font-semibold tracking-tight">
              CronPing
            </span>
          </div>
          <span className="rounded-full border border-healthy-border bg-healthy-bg px-3 py-1 text-sm font-semibold text-healthy">
            Socle opérationnel
          </span>
        </header>

        <section className="max-w-3xl py-8">
          <p className="mb-4 text-sm font-semibold text-action">
            Heartbeats pour tâches planifiées
          </p>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Sachez quand un cron cesse de donner signe de vie.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-7 text-muted">
            CronPing reçoit uniquement un signal de heartbeat. Aucun script,
            aucune commande et aucun contenu d&apos;exécution ne sont stockés.
          </p>
          <div className="mt-8">
            <Button
              as="a"
              color="primary"
              href="/api/health"
              radius="md"
              rel="noreferrer"
              target="_blank"
            >
              Vérifier l&apos;API
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-line bg-white p-6">
          <h2 className="text-xl font-semibold">Première étape terminée</h2>
          <p className="mt-2 max-w-2xl text-muted">
            Le workspace, le design system, le routeur, le client de données et
            le health check sont prêts à accueillir les fonctionnalités de
            monitoring.
          </p>
        </section>
      </div>
    </main>
  )
}
