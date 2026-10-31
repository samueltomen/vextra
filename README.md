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
- UI connectée avec connexion, dashboard, création et détail d'un moniteur ;
- ingestion de heartbeats par token `Bearer`, hash HMAC et résolution
  d'incident ;
- checker planifié chaque minute avec ouverture idempotente des incidents ;
- outbox e-mail transactionnelle avec claim atomique, retries et
  déduplication ;
- configuration TypeScript stricte, Prettier, ESLint et Vitest ;
- garde-fou interdisant Bootstrap.

Le flux normal utilise désormais l'API et Supabase. Seuls les libellés choisis
par l'utilisateur restent dans `localStorage` ; le serveur ne reçoit que
l'intervalle et la marge techniques. Les états `?state=loading`, `?state=empty`
et `?state=error` restent disponibles en développement pour prévisualiser le
dashboard.

## Prérequis

- Node.js 22 ou plus récent ;
- pnpm 12.15.0.

## Installation

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm setup:local
```

Renseigner ensuite dans `apps/api/.dev.vars` la clé publishable Supabase
locale et deux secrets indépendants d'au moins 32 octets :
`SESSION_ENCRYPTION_KEY` et `PING_TOKEN_PEPPER`. Ces valeurs restent côté
Worker et ne doivent jamais recevoir le préfixe `VITE_`.

`pnpm setup:local` lit les clés du Supabase local et génère
`apps/api/.dev.vars` avec des secrets aléatoires. Le fichier est ignoré par Git
et reçoit les permissions `0600`. Si le fichier existe déjà, la commande
refuse de l'écraser sans `--force`.

Pour vérifier uniquement l'UX sans Supabase, ouvrir
`http://localhost:5173/?demo=1`. Ce mode est limité au développement et
n'effectue aucun appel API.

`SUPABASE_SERVICE_ROLE_KEY` est uniquement requis par le handler planifié pour
exécuter la RPC interne du checker. Il ne doit jamais être exposé à la SPA.

La livraison e-mail nécessite aussi `RESEND_API_KEY` et
`RESEND_FROM_EMAIL`. Sans ces deux valeurs, les événements restent dans
l'outbox et aucun envoi externe n'est tenté.

Pour les tests sans domaine vérifié, utiliser
`RESEND_FROM_EMAIL=CronPing <onboarding@resend.dev>` et une adresse de compte
liée au compte Resend. Pour envoyer à des utilisateurs quelconques, vérifier un
domaine dans Resend puis utiliser une adresse de ce domaine, par exemple
`CronPing <alerts@mail.votre-domaine.com>`.

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

Les moniteurs utilisent :

- `GET /api/monitors` pour la liste ;
- `GET /api/monitors/:monitorId` pour le détail ;
- `POST /api/monitors` pour la création.
- `PATCH /api/monitors/:monitorId` pour modifier la fréquence et la marge
  (`intervalSeconds`, `graceSeconds`) ; un moniteur en attente ou opérationnel
  reçoit une nouvelle échéance, un moniteur en pause ou en retard conserve la
  sienne ;
- `POST /api/monitors/:monitorId/pause` pour la mise en pause ;
- `POST /api/monitors/:monitorId/resume` pour la reprise ;
- `POST /api/monitors/:monitorId/rotate-token` pour remplacer le token ;
- `DELETE /api/monitors/:monitorId` pour la suppression ;
- `GET /api/monitors/:monitorId/incidents` pour l'historique.

Les notifications e-mail utilisent `GET /api/notifications` pour afficher les
50 dernières livraisons du tenant. La réponse contient le type d'événement,
l'état, les tentatives et l'identifiant du moniteur, jamais l'adresse
destinataire.

La suppression du compte utilise `DELETE /api/account`. L'identifiant supprimé
est toujours celui de la session courante ; aucun identifiant utilisateur n'est
accepté depuis le navigateur. La suppression du membership déclenche le
nettoyage du tenant devenu vide et la suppression en cascade de ses données.

Le heartbeat public utilise :

```bash
curl --fail --silent --show-error --retry 3 \
  --request POST \
  --header "Authorization: Bearer $CRONPING_TOKEN" \
  "https://api.cronping.app/api/ping"
```

La requête ne doit contenir ni corps, ni paramètres de requête. Le token brut
est hashé avec `PING_TOKEN_PEPPER` avant l'appel Supabase et n'est jamais
persisté ni journalisé. Un heartbeat accepté renvoie `204`; un token invalide
et un token inconnu partagent la même réponse `401`.

Le tenant est toujours résolu côté serveur depuis la session ; un `tenantId`
envoyé par le navigateur est rejeté. Un libellé local n'est jamais inclus dans
une requête API.

La session est chiffrée avec AES-GCM et transmise uniquement via
`__Host-cronping_session`, avec `HttpOnly`, `Secure`, `SameSite=Strict` et
`Path=/`. Les JWT Supabase ne sont jamais renvoyés au navigateur. Les mutations
du dashboard exigent l'origine exacte configurée dans `APP_ORIGIN` ; le futur
heartbeat serveur restera hors de cette garde navigateur.

Les routes publiques `login`, `signup` et `ping` sont limitées par IP via les
bindings Cloudflare `AUTH_RATE_LIMITER` (10/min) et `PING_RATE_LIMITER`
(120/min), avec échec ouvert si le binding est indisponible (voir
[ADR 0002](docs/adr/0002-limitation-de-debit.md)). Le déploiement en production
se fait sur une seule origine (voir
[ADR 0001](docs/adr/0001-deploiement-meme-origine.md)).

## Déploiement

Un seul Worker Cloudflare (`cronping`, environnement `production` de
`apps/api/wrangler.toml`) sert le SPA en assets statiques et l'API sous
`/api/*`, donc sous une seule origine (ADR 0001).

1. Se connecter : `pnpm --filter @cronping/api exec wrangler login`.
2. Appliquer les migrations sur le projet Supabase de production :
   `pnpm exec supabase link --project-ref <ref>` puis `pnpm exec supabase db push`.
3. Définir les secrets (une commande par secret) :
   `pnpm --filter @cronping/api exec wrangler secret put <NOM> -e production`
   pour `APP_ORIGIN` (l'URL publique du Worker), `SUPABASE_URL`,
   `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `SESSION_ENCRYPTION_KEY`, `PING_TOKEN_PEPPER`, `RESEND_API_KEY` et
   `RESEND_FROM_EMAIL`. Ne jamais les committer.
4. Déployer : `pnpm deploy:production` (build du web, puis `wrangler deploy`).
5. Vérifier : `curl https://<worker>/api/health` doit répondre `status: ok`.

La CI (`.github/workflows/ci.yml`) exécute `pnpm check` et les tests de base. Le
workflow `deploy.yml` est manuel et exige les secrets GitHub
`CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID`.

## Organisation, métriques et préférences

- **Dossiers** : dossiers plats par espace, création, renommage et suppression
  depuis le dashboard, rangement d'un moniteur depuis sa page
  ([ADR 0003](docs/adr/0003-dossiers-de-moniteurs.md)).
- **Métriques** : compteurs de heartbeats par jour (90 jours conservés),
  intervalle moyen et plus long intervalle, sans contenu ni IP
  ([ADR 0004](docs/adr/0004-metriques-heartbeat-agregees.md)).
- **Préférences** : nom affiché, fuseau horaire et alertes e-mail à l'ouverture
  ou à la résolution d'un incident
  ([ADR 0005](docs/adr/0005-preferences-de-compte.md)).

L'interface se met à jour **en direct** (WebSocket par espace, indicateur « En
direct » dans la barre latérale) : un heartbeat reçu ou un incident ouvert
apparaît en quelques secondes sans recharger
([ADR 0006](docs/adr/0006-mises-a-jour-en-direct.md)). Le premier déploiement
après cette version crée le Durable Object `TenantLiveHub` (migration `v1`).

Chaque moniteur a un **nom, une description et des notes** stockés côté serveur
(le nom apparaît dans les e-mails), des **alertes activables par moniteur** et
un bouton **Cloner**. Les réglages ajoutent le format de l'heure, la densité,
la vue et le tri par défaut, ainsi que la fréquence, la marge et le dossier
proposés à la création
([ADR 0007](docs/adr/0007-personnalisation-de-la-configuration.md)).

Les jobs peuvent aussi signaler leur cycle de vie : `start` (mesure la durée),
`success`, `fail` (ouvre un incident immédiatement) et `warn`, par en-tête
`Authorization` (recommandé) ou par URL (`/api/ping/<token>[/start|fail|warn|<code>]`
en `GET`, `HEAD` ou `POST`). La page d'un moniteur affiche l'historique des
exécutions (90 jours), les durées et les échecs, sans jamais conserver de
contenu ([ADR 0008](docs/adr/0008-evenements-d-execution.md)).

Les alertes peuvent aussi partir vers **Slack, Discord, Telegram, Microsoft
Teams, PagerDuty ou un webhook** (Réglages, « Canaux d'alerte », avec un bouton
de test). La destination est un secret : l'API ne la renvoie jamais. Un
**rappel** périodique peut être activé tant qu'un incident reste ouvert
([ADR 0009](docs/adr/0009-canaux-d-alerte-et-rappels.md)).

Chaque **lundi à 9 h UTC**, le propriétaire reçoit un **rapport hebdomadaire**
(heartbeats, échecs, incidents, moniteurs à surveiller), désactivable dans les
réglages ([ADR 0010](docs/adr/0010-rapport-hebdomadaire.md)).

Ces fonctions s'appuient sur sept migrations (`20261031100000`,
`20261031110000`, `20261031120000`, `20261031130000`, `20261031140000`,
`20261031150000`, `20261031160000`) à appliquer avec `supabase db push` avant de
déployer l'API.

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
pnpm deploy:production
```

Le contrôle anti-Bootstrap peut être exécuté seul :

```bash
pnpm check:no-bootstrap
```

## Interface

```text
/                       Dashboard et résumé des statuts
/login                  Connexion et inscription
/notifications          Centre de notifications e-mail
/settings               Compte, notifications et suppression
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

Le Cron Trigger Cloudflare s'exécute toutes les minutes. Il ouvre les incidents
échus, puis traite un lot borné de livraisons e-mail. L'adresse du propriétaire
est résolue depuis Supabase uniquement pendant le claim et n'est jamais stockée
dans l'outbox.

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
