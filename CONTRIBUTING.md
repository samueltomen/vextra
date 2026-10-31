# Contribuer à CronPing

Merci de l'intérêt que vous portez au projet. Le dépôt est sous licence MIT.

## Mise en route

Prérequis : Node.js 22, `pnpm` (la version est fixée dans `package.json`),
Docker et le CLI Supabase pour la base locale.

```bash
pnpm install
pnpm exec supabase start
pnpm setup:local        # crée apps/api/.dev.vars à partir de la base locale
pnpm dev                # web sur :5173, API sur :8787
```

Le mode démo (`http://localhost:5173/?demo=1`) permet de parcourir l'interface
sans base de données.

## Avant d'ouvrir une pull request

```bash
pnpm check              # format, lint, typecheck, tests, build
pnpm test:db            # tests pgTAP (base locale démarrée)
pnpm db:lint
```

Règles du projet :

- **Test d'abord** : écrivez le test, vérifiez qu'il échoue pour la bonne raison,
  puis le code. Couverture visée : 80 % au minimum.
- **Architecture** : domaine indépendant du framework et de la base, adaptateurs
  injectés dans la racine de composition (`apps/api/src/composition.ts`).
- **Multi-tenant** : toute lecture ou écriture tenant-scopée est filtrée par le
  `tenant_id` de la session, jamais par une valeur fournie par le client, avec RLS
  et contraintes en base.
- **Migrations** : versionnées, sans retour arrière, avec un test pgTAP.
- **Secrets** : jamais dans le dépôt ni dans les journaux.
- **Décisions structurantes** : un ADR dans `docs/adr/`.

## Commits et pull requests

Messages courts et impératifs, préfixés : `feat:`, `fix:`, `test:`, `refactor:`,
`docs:`, `chore:`. Décrivez dans la pull request le problème, le résultat
attendu, les risques, les migrations et les commandes de validation exécutées.

## Signaler un bug ou proposer une idée

Ouvrez une issue en décrivant le contexte, les étapes pour reproduire et le
résultat attendu. Pour une faille de sécurité, suivez [SECURITY.md](SECURITY.md).
