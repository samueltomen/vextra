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
- schéma Supabase initial avec isolation RLS entre tenants ;
- inscription, connexion, déconnexion et session chiffrée dans un cookie
  `__Host-` inaccessible au JavaScript ;
- création automatique d'un tenant personnel et de son propriétaire à
  l'inscription ;
- tokens du design system ;
- prototype UI local avec dashboard, création et détail d'un moniteur ;
- configuration TypeScript stricte, Prettier, ESLint et Vitest ;
- garde-fou interdisant Bootstrap.

Le prototype UI utilise encore des données locales simulées. L'API
d'authentification et le pipeline de création côté serveur sont prêts ; leur
branchement au dashboard sera réalisé dans l'étape suivante du
[plan MVP](docs/plans/cronping-mvp.md).

## Prérequis

- Node.js 22 ou plus récent ;
- pnpm 12.15.0.

## Installation

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.dev.vars.example apps/api/.dev.vars
```

Renseigner ensuite dans `apps/api/.dev.vars` la clé publishable Supabase
locale et deux secrets indépendants d'au moins 32 octets :
`SESSION_ENCRYPTION_KEY` et `PING_TOKEN_PEPPER`. Ces valeurs restent côté
Worker et ne doivent jamais recevoir le préfixe `VITE_`.

## Développement

```bash
pnpm dev
```

- SPA : `http://localhost:5173`
- API : `http://localhost:8787`
- Health check : `http://localhost:8787/api/health`

Le proxy Vite transmet `/api` vers le Worker local.

Routes d'authentification :

- `POST /api/auth/signup` ;
- `POST /api/auth/login` ;
- `POST /api/auth/logout` ;
- `GET /api/auth/me`.

La création authentifiée d'un moniteur est exposée par
`POST /api/monitors`. Le tenant est toujours résolu côté serveur depuis la
session ; un `tenantId` envoyé par le navigateur est rejeté.

La session est chiffrée avec AES-GCM et transmise uniquement via
`__Host-cronping_session`, avec `HttpOnly`, `Secure`, `SameSite=Strict` et
`Path=/`. Les JWT Supabase ne sont jamais renvoyés au navigateur. Les mutations
du dashboard exigent l'origine exacte configurée dans `APP_ORIGIN` ; le futur
heartbeat serveur restera hors de cette garde navigateur.

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

## Prototype UI

```text
/                       Dashboard et résumé des statuts
/monitors/new           Création d'un moniteur
/monitors/:monitorId    Détail et commande heartbeat
```

En développement, les états du dashboard peuvent être prévisualisés avec
`?state=loading`, `?state=empty` ou `?state=error`.

Les commandes base de données nécessitent Supabase local :

```bash
pnpm exec supabase start
pnpm exec supabase db reset
pnpm test:db
pnpm db:lint
pnpm exec supabase stop
```

Le service Analytics local est désactivé pour éviter des ports et services
inutiles au développement de CronPing.

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
