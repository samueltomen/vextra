# Auto-héberger CronPing

CronPing est un logiciel libre (MIT). Vous pouvez l'installer sur votre propre
serveur avec Docker : l'application, son planificateur et les mises à jour en
direct tournent dans **un seul conteneur**, qui se branche sur **un projet
Supabase** pour la base de données et l'authentification.

> Vous préférez ne rien gérer ? L'offre hébergée évite toute installation. Le
> code est le même.

## Ce qu'il vous faut

- Un serveur avec **Docker** et Docker Compose.
- Un **projet Supabase** : le plan gratuit du cloud suffit pour démarrer, ou un
  Supabase auto-hébergé.
- Un **nom de domaine en HTTPS** devant l'application (les cookies de session
  sont `Secure`). Un proxy comme Caddy, Nginx ou Traefik s'en charge.
- Facultatif : un compte **Resend** ou un **serveur SMTP** pour les e-mails.

## 1. Préparer Supabase

1. Créez un projet sur [supabase.com](https://supabase.com) (ou utilisez le vôtre).
2. Relevez, dans **Project Settings > API** : l'URL du projet, la clé
   **publishable** (anon) et la clé **service_role**. Cette dernière est un
   secret : elle reste sur votre serveur.
3. Appliquez les migrations de la base. Depuis une copie du dépôt :

   ```bash
   pnpm install
   pnpm exec supabase link --project-ref <votre-ref>
   pnpm exec supabase db push
   ```

   Pour un Supabase auto-hébergé, utilisez l'adresse de connexion directe :
   `pnpm exec supabase db push --db-url postgresql://postgres:<mot-de-passe>@<hôte>:5432/postgres`.

4. Dans **Authentication > URL Configuration**, mettez l'adresse publique de votre
   installation dans **Site URL**.
5. **E-mails d'inscription** : Supabase envoie lui-même les e-mails de
   confirmation. Soit vous désactivez « Confirm email » (Authentication >
   Providers > Email), soit vous renseignez votre SMTP dans Authentication >
   Emails > SMTP Settings. Sans cela, l'envoi est limité à quelques messages par
   heure.

## 2. Configurer

```bash
cp .env.example .env
```

Renseignez au minimum `APP_ORIGIN`, les trois valeurs Supabase et deux secrets
aléatoires :

```bash
openssl rand -base64 48   # SESSION_ENCRYPTION_KEY
openssl rand -base64 48   # PING_TOKEN_PEPPER
```

> **Ne changez jamais `PING_TOKEN_PEPPER` ensuite** : tous les tokens de ping
> existants deviendraient invalides. Ne commitez jamais `.env`.

Toutes les options sont documentées dans [`.env.example`](../.env.example).

### E-mail des alertes et du rapport hebdomadaire

| Option | Variables                                                                                                  |
| ------ | ---------------------------------------------------------------------------------------------------------- |
| Resend | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`                                                                      |
| SMTP   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` (`SMTP_SECURE=true` pour le port 465) |

Sans l'une ou l'autre, aucun e-mail n'est envoyé. Avec les deux, choisissez avec
`EMAIL_PROVIDER=resend` ou `smtp`.

### Slack, Discord, Telegram, Teams, PagerDuty, webhooks

Ces canaux **ne se règlent pas dans `.env`** : chaque utilisateur les ajoute dans
**Réglages > Canaux d'alerte**, avec un bouton de test. Les URL et clés sont des
secrets : elles ne sont jamais renvoyées par l'API après enregistrement.

## 3. Démarrer

```bash
docker compose up -d --build
docker compose logs -f cronping
```

Le journal doit afficher `server.started`. Une configuration incomplète est
détaillée à l'écran, puis le conteneur s'arrête. L'état de santé est disponible
sur `/api/health`.

## 4. HTTPS avec un proxy

Exemple Caddy (certificat automatique) :

```caddyfile
cronping.exemple.org {
  reverse_proxy 127.0.0.1:8787
}
```

Le temps réel utilise des WebSockets : le proxy doit les laisser passer (Caddy,
Traefik et Nginx récent le font avec leur configuration de base ; pour Nginx,
ajoutez les en-têtes `Upgrade` et `Connection`).

Derrière un proxy de confiance, indiquez `CLIENT_IP_HEADER=x-forwarded-for` pour
que la limitation de débit voie la vraie IP du client. **N'activez cette option
que si le proxy réécrit toujours cet en-tête** ; sinon un client pourrait le
falsifier. Sans proxy, laissez-la vide.

## 5. Créer votre compte

Ouvrez l'URL, créez votre compte puis votre premier moniteur. Pour une
installation personnelle, **fermez ensuite les inscriptions** :

```env
SIGNUPS_ENABLED=false
```

puis `docker compose up -d` pour appliquer.

## Mettre à jour

```bash
git pull
pnpm exec supabase db push     # nouvelles migrations, le cas échéant
docker compose up -d --build
```

Lisez les notes de version avant de mettre à jour : les migrations ne
reviennent pas en arrière.

## Sauvegardes

Les données sont dans votre base Supabase : activez les sauvegardes du projet
(cloud) ou planifiez un `pg_dump` (auto-hébergé), et **testez une restauration**.
Le conteneur CronPing, lui, ne stocke rien : il se recrée à volonté.

## Limites à connaître

- **Une seule instance.** Le planificateur, la limitation de débit et le temps
  réel vivent en mémoire. Ne lancez pas plusieurs réplicas.
- Le planificateur passe **chaque minute** : la détection d'un retard peut avoir
  jusqu'à une minute de décalage.
- Le temps réel interroge la base environ toutes les 2 secondes **tant qu'un
  onglet est ouvert**.

## Sécurité

Voir [SECURITY.md](../SECURITY.md). En résumé : HTTPS obligatoire, secrets
aléatoires et jamais commités, clé `service_role` uniquement sur le serveur,
inscriptions fermées pour un usage personnel, mises à jour régulières.

## Dépannage

| Symptôme                               | Piste                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------ |
| `Invalid configuration` au démarrage   | Le message liste chaque variable manquante ou trop courte.                                 |
| Connexion impossible, cookie refusé    | `APP_ORIGIN` doit être l'URL publique exacte, en HTTPS.                                    |
| Inscription refusée : limite d'e-mails | Désactivez « Confirm email » ou configurez le SMTP de Supabase.                            |
| Pas d'e-mails d'alerte                 | Vérifiez Resend ou SMTP ; le journal affiche le code d'erreur, jamais le contenu.          |
| Pas de mise à jour en direct           | Le proxy doit autoriser les WebSockets ; l'indicateur de la barre latérale affiche l'état. |
