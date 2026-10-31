# Déployer sur Cloudflare Workers

Une alternative à Docker : un seul Worker sert l'interface (assets statiques) et
l'API sous une même origine ([ADR 0001](adr/0001-deploiement-meme-origine.md)).
Un Cron Trigger s'exécute chaque minute pour détecter les retards et envoyer les
alertes.

## Prérequis

- Un compte Cloudflare et un projet Supabase (voir
  [l'auto-hébergement](self-hosting.md#1-préparer-supabase)).
- Node.js 22 et pnpm 12.15.0.

## Étapes

1. Connectez-vous : `pnpm --filter @vextra/api exec wrangler login`.
2. Appliquez les migrations sur votre projet Supabase :

   ```bash
   pnpm exec supabase link --project-ref <ref>
   pnpm exec supabase db push
   ```

3. Adaptez le nom du Worker dans `[env.production]` de `apps/api/wrangler.toml`.
4. Définissez les secrets, un par un :

   ```bash
   pnpm --filter @vextra/api exec wrangler secret put <NOM> -e production
   ```

   Pour `APP_ORIGIN`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_ENCRYPTION_KEY`, `PING_TOKEN_PEPPER` et,
   pour les e-mails, `RESEND_API_KEY` et `RESEND_FROM_EMAIL`. Le rôle de chaque
   variable est décrit dans [`.env.example`](../.env.example).

5. Déployez : `pnpm deploy:production`.
6. Vérifiez : `curl https://<votre-worker>/api/health` doit répondre `status: ok`.

## Suivre le planificateur

```bash
pnpm --filter @vextra/api exec wrangler tail <nom-du-worker> --format pretty
```

Chaque minute, une ligne `cron.tick` résume la passe (incidents ouverts, alertes
envoyées, étapes en échec).

## Après le déploiement

- Vérifiez les en-têtes de sécurité : `curl -I https://<votre-domaine>/` doit
  contenir `Content-Security-Policy` et `X-Frame-Options`.
- Une fois un domaine personnalisé attaché, passez `workers_dev` à `false` pour
  n'exposer qu'une seule origine.
