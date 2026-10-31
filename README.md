<div align="center">

# Vextra

**Sachez quand une tâche planifiée ne s'est pas exécutée, avant vos utilisateurs.**

Surveillance de _heartbeats_ pour sauvegardes, imports, jobs cron et pipelines.
Libre (MIT), multi-équipe, hébergeable chez vous en une commande.

[Démarrage rapide](#démarrage-rapide) ·
[Fonctionnalités](#fonctionnalités) ·
[Auto-hébergement](docs/self-hosting.md) ·
[Référence de l'API](docs/api.md) ·
[Contribuer](CONTRIBUTING.md)

</div>

---

## Le principe

Votre tâche planifiée appelle une URL de Vextra quand elle se termine. Si l'appel
n'arrive pas dans la fenêtre attendue, Vextra ouvre un incident et vous alerte.
Quand le job repart, l'incident se ferme et vous êtes prévenu de la reprise.

```text
   votre job cron                 Vextra                         vous
 ┌──────────────┐  ping   ┌─────────────────────┐  alerte  ┌──────────────┐
 │ sauvegarde.sh│ ──────▶ │ échéance recalculée │ ───────▶ │ e-mail       │
 └──────────────┘         │ rien reçu à l'heure │          │ Slack Discord│
        ✕ ne tourne plus  │ → incident ouvert   │          │ Telegram …   │
                          └─────────────────────┘          └──────────────┘
```

Vextra ne reçoit **jamais** le contenu de vos scripts, de vos logs ni de vos
sorties : un heartbeat est une requête vide.

## Fonctionnalités

**Surveillance**

- Moniteurs par **intervalle** ou par **expression cron** (cinq champs, fuseau
  horaire au choix), avec une marge de tolérance.
- Cycle de vie complet d'un job : `start`, `success`, `fail`, `warn`, avec durée
  d'exécution et historique sur 90 jours.
- Détection au plus une minute après l'échéance, ouverture d'incident idempotente.
- Pause, reprise, rotation du token, clonage, dossiers et **tags** avec filtres.
- **Fenêtres de maintenance** qui suspendent incidents et alertes.

**Alertes**

- E-mail (Resend ou SMTP), **Slack, Discord, Telegram, Microsoft Teams,
  PagerDuty** et webhook générique, avec bouton de test.
- Alerte à l'ouverture et à la résolution, **rappels** tant qu'un incident reste
  ouvert, alertes activables par moniteur.
- **Rapport hebdomadaire** par e-mail, désactivable.

**Partage et intégration**

- **Page de statut publique** sans compte, et **badges SVG** pour vos README.
- **Équipes** : rôles propriétaire, membre et lecture seule, invitations par lien
  à usage unique.
- **API en lecture seule** avec clés d'API (`vx_…`).
- Interface mise à jour **en direct**, thème clair et sombre, mode démo sans base.

**Sécurité et vie privée**

- Isolation stricte entre espaces par _Row Level Security_ PostgreSQL.
- Tokens de ping et clés d'API hachés (HMAC), jamais stockés en clair.
- Session dans un cookie chiffré `__Host-`, `HttpOnly`, `SameSite=Strict`.
- Limitation de débit, garde d'origine sur toute écriture, CSP stricte.
- Audit de sécurité publié : [docs/audits/securite-avant-production.md](docs/audits/securite-avant-production.md).

## Deux façons de l'utiliser

|              | Service hébergé  | Auto-hébergé                   |
| ------------ | ---------------- | ------------------------------ |
| Installation | Aucune           | `docker compose up`            |
| Maintenance  | Gérée pour vous  | À votre charge                 |
| Données      | Chez l'hébergeur | Dans **votre** projet Supabase |
| E-mails      | Inclus           | Votre Resend ou votre SMTP     |
| Code         | Identique, MIT   | Identique, MIT                 |

## Démarrage rapide

### 1. Créer un moniteur

Connectez-vous, cliquez sur **Nouveau moniteur**, choisissez la fréquence
attendue (intervalle ou expression cron) et une marge. Vextra affiche une
commande prête à copier avec votre token.

### 2. Ajouter le ping à votre job

```bash
# À la fin de votre script, ou dans votre crontab :
0 3 * * *  /opt/scripts/sauvegarde.sh && curl -fsS -m 10 --retry 3 -X POST \
  -H "Authorization: Bearer $VEXTRA_TOKEN" https://<votre-instance>/api/ping
```

Stockez le token dans un gestionnaire de secrets ou une variable d'environnement,
pas dans le dépôt. Pour mesurer la durée ou signaler un échec explicitement,
voir [la référence de l'API](docs/api.md).

### 3. Choisir vos alertes

Dans **Réglages**, ajoutez un canal (Slack, Discord, e-mail…), testez-le, puis
laissez Vextra surveiller. Vérifiez que les alertes du moniteur sont bien
**activées** : un moniteur en sourdine enregistre ses incidents sans prévenir
personne.

## Auto-hébergement

L'application, son planificateur et les mises à jour en direct tournent dans
**un seul conteneur**, relié à **un projet Supabase** (base et authentification).

```bash
git clone https://github.com/samueltomen/vextra.git && cd vextra
cp .env.example .env     # APP_ORIGIN, clés Supabase, deux secrets aléatoires
pnpm install && pnpm exec supabase link --project-ref <ref> && pnpm exec supabase db push
docker compose up -d --build
```

Mettez ensuite un proxy HTTPS devant (Caddy, Nginx, Traefik) : les cookies de
session sont `Secure`. Le guide complet couvre Supabase, HTTPS, e-mails,
sauvegardes et mises à jour : **[docs/self-hosting.md](docs/self-hosting.md)**.

### Configuration

| Variable                              | Rôle                                                         |
| ------------------------------------- | ------------------------------------------------------------ |
| `APP_ORIGIN`                          | URL publique exacte (cookies, garde d'origine, e-mails)      |
| `SUPABASE_URL`                        | URL de votre projet Supabase                                 |
| `SUPABASE_PUBLISHABLE_KEY`            | Clé publique (anon / publishable)                            |
| `SUPABASE_SERVICE_ROLE_KEY`           | Clé secrète, reste sur le serveur                            |
| `SESSION_ENCRYPTION_KEY`              | Secret aléatoire (≥ 32 caractères) du cookie de session      |
| `PING_TOKEN_PEPPER`                   | Secret aléatoire (≥ 32 caractères). **Ne jamais le changer** |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | E-mail via Resend (option A)                                 |
| `SMTP_*`, `EMAIL_FROM`                | E-mail via SMTP (option B)                                   |
| `SIGNUPS_ENABLED`                     | `false` pour fermer les inscriptions                         |

Générez les secrets avec `openssl rand -base64 48`. Le détail de chaque variable
est dans [`.env.example`](.env.example).

## Architecture

Un monolithe modulaire, organisé par domaine métier, sur une architecture
hexagonale : le domaine ne dépend ni du framework, ni de la base, ni du transport.

```text
apps/
  api/        API Hono (Cloudflare Workers ou serveur Node/Docker)
  web/        SPA React, Vite, TanStack Router/Query, HeroUI
packages/
  domain/     règles métier pures : échéances, états, expressions cron
  contracts/  schémas Zod partagés entre l'API et l'interface
supabase/     migrations versionnées et tests pgTAP
docs/         guides, décisions d'architecture (ADR), audit de sécurité
scripts/      automatisation locale
```

| Couche          | Technologie                                                |
| --------------- | ---------------------------------------------------------- |
| Interface       | React, Vite, TanStack, HeroUI, Tailwind                    |
| API             | Hono, TypeScript strict, Zod                               |
| Exécution       | Cloudflare Workers (+ Durable Objects) ou Node.js / Docker |
| Données et auth | Supabase (PostgreSQL, RLS, Auth)                           |
| Qualité         | Vitest, pgTAP, ESLint, Prettier, TypeScript strict         |

Les choix structurants sont consignés dans les
[décisions d'architecture](docs/README.md#décisions-darchitecture).

## Développer

Prérequis : Node.js 22, pnpm 12.15.0, Docker et le CLI Supabase pour la base locale.

```bash
pnpm install
pnpm exec supabase start     # base locale
pnpm setup:local             # génère apps/api/.dev.vars avec des secrets aléatoires
pnpm dev                     # web http://localhost:5173, API http://localhost:8787
```

Le mode démo (`http://localhost:5173/?demo=1`) parcourt l'interface sans base.

| Commande             | Rôle                                                 |
| -------------------- | ---------------------------------------------------- |
| `pnpm check`         | Format, lint, types, tests et build (la barrière CI) |
| `pnpm test`          | Tests unitaires et d'intégration                     |
| `pnpm test:coverage` | Couverture (seuil de 80 %)                           |
| `pnpm test:db`       | Tests pgTAP sur la base locale                       |
| `pnpm db:lint`       | Analyse statique du schéma                           |
| `pnpm format`        | Formate le dépôt                                     |

### Déployer sur Cloudflare

Un seul Worker sert l'interface (assets) et l'API sous une même origine
([ADR 0001](docs/adr/0001-deploiement-meme-origine.md)).

1. `pnpm --filter @vextra/api exec wrangler login`
2. Appliquez les migrations : `pnpm exec supabase link --project-ref <ref>` puis
   `pnpm exec supabase db push`.
3. Définissez les secrets, un par un, avec
   `pnpm --filter @vextra/api exec wrangler secret put <NOM> -e production`
   (variables du tableau ci-dessus).
4. `pnpm deploy:production`, puis vérifiez `curl https://<worker>/api/health`.

Adaptez le nom du Worker (`[env.production]` de `apps/api/wrangler.toml`) à votre
compte. Le planificateur s'exécute chaque minute via un Cron Trigger.

## Documentation

- [Auto-héberger Vextra](docs/self-hosting.md)
- [Référence de l'API](docs/api.md)
- [Décisions d'architecture (ADR)](docs/README.md#décisions-darchitecture)
- [Audit de sécurité](docs/audits/securite-avant-production.md)
- [Design system](docs/design/DESIGNSYSTEM.md)

## Contribuer

Les contributions sont les bienvenues : lisez [CONTRIBUTING.md](CONTRIBUTING.md)
et le [code de conduite](CODE_OF_CONDUCT.md). Pour signaler une faille, suivez
la [politique de sécurité](SECURITY.md) : n'ouvrez pas d'issue publique.

## Licence

[MIT](LICENSE) © Samuel Tomen
