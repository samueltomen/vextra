# CronPing

CronPing est un SaaS multi-tenant de heartbeat pour tâches planifiées. Il
détecte l'absence d'exécution d'un script et alerte son propriétaire sans
recevoir ni stocker le contenu du script ou du cron.

## État actuel

Le dépôt contient le socle de la V1 :

- SPA React, Vite, TanStack Router, TanStack Query et HeroUI ;
- API Hono prévue pour Cloudflare Workers ;
- endpoint de santé `GET /api/health` ;
- domaine monitoring pur avec calcul d'échéance et machine à états ;
- contrats de création d'un moniteur et pipeline serveur avec token HMAC ;
- schéma Supabase initial avec isolation RLS entre tenants.
- tokens du design system ;
- configuration TypeScript stricte, Prettier, ESLint et Vitest ;
- garde-fou interdisant Bootstrap.

Les fonctionnalités d'authentification, de moniteurs et de notifications seront
ajoutées dans les étapes suivantes du
[plan MVP](docs/plans/cronping-mvp.md).

## Prérequis

- Node.js 22 ou plus récent ;
- pnpm 12.15.0.

## Installation

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
```

## Développement

```bash
pnpm dev
```

- SPA : `http://localhost:5173`
- API : `http://localhost:8787`
- Health check : `http://localhost:8787/api/health`

Le proxy Vite transmet `/api` vers le Worker local.

## Commandes

```bash
pnpm format
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm test:db
pnpm db:lint
pnpm build
pnpm check
```

Le contrôle anti-Bootstrap peut être exécuté seul :

```bash
pnpm check:no-bootstrap
```

Les commandes base de données nécessitent Supabase local :

```bash
pnpm exec supabase start
pnpm exec supabase db reset
pnpm test:db
pnpm db:lint
pnpm exec supabase stop
```

## Structure

```text
apps/
  api/              API Hono et futur Worker planifié
  web/              SPA React/Vite/TanStack/HeroUI
docs/
  design/           design system
  plans/            plans de construction
  releases/         preuves TDD et notes de version
packages/
  contracts/       schémas Zod et contrats API partagés
  domain/           règles métier monitoring sans I/O
scripts/            automatisation locale
supabase/           configuration, migrations et tests pgTAP
```

### Fichiers de configuration racine

| Fichier                                                 | Rôle                                           |
| ------------------------------------------------------- | ---------------------------------------------- |
| `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` | workspace et dépendances                       |
| `.npmrc`                                                | politiques pnpm strictes                       |
| `.nvmrc`                                                | version Node.js du projet                      |
| `tsconfig.base.json`                                    | règles TypeScript partagées                    |
| `eslint.config.js`                                      | lint JavaScript et TypeScript                  |
| `.prettierrc.json`, `.prettierignore`                   | formatage                                      |
| `.editorconfig`                                         | conventions d'édition                          |
| `.gitignore`                                            | exclusion des dépendances et artefacts générés |

Chaque application conserve uniquement ses configurations spécifiques. Les
dossiers `node_modules`, `dist`, `coverage` et `.wrangler` sont générés par
l'outillage et ne doivent jamais être commités.

## Principes

- Aucun contenu de script, de cron, de log ou de sortie n'est reçu.
- Les heartbeats ne transportent pas de données métier.
- Les secrets restent côté serveur et ne doivent jamais utiliser `VITE_`.
- L'isolation multi-tenant et RLS seront obligatoires pour toute donnée
  persistée.
- Bootstrap et ses dérivés sont interdits.
