# Repository Guidelines

## Mission

Ce dépôt doit devenir un SaaS multi-tenant robuste et performant. Avant de
choisir une stack, un framework ou un service, partir du besoin métier, des
contraintes connues et de critères mesurables.

Ne jamais supposer qu'une technologie, une commande ou une convention existe :
vérifier d'abord le manifeste, la configuration versionnée ou l'état réel du
dépôt.

Le dépôt est déjà initialisé avec Git et suit la branche `main`. Ne jamais
exécuter `git init` ni recréer le dépôt. Vérifier `git status` et la branche
courante avant de modifier l'arborescence.

## Outils ECC

Utiliser uniquement les skills ECC pertinents pour la tâche ; ne pas les
invoquer systématiquement. Vérifier que le plugin ECC est installé avec
`codex plugin list --json`, puis sélectionner les skills disponibles dans la
session. Si le plugin est absent, l'installer dans Codex avec :

```bash
codex plugin marketplace add affaan-m/ECC
codex plugin add ecc@ecc
```

Invoquer ensuite un skill par son nom qualifié, par exemple
`$ecc:tdd-workflow`. Les workflows utiles sont :

- Découverte et plan : `$ecc:repo-scan`,
  `$ecc:architecture-decision-records`, `$ecc:hexagonal-architecture`.
- Conception : `$ecc:api-design`, `$ecc:backend-patterns`,
  `$ecc:database-migrations`, `$ecc:frontend-patterns` ou le skill
  correspondant à la stack choisie.
- Livraison : `$ecc:tdd-workflow`, `$ecc:e2e-testing`,
  `$ecc:verification-loop`.
- Qualité et production : `$ecc:security-review`, `$ecc:security-scan`,
  `$ecc:production-audit`, `$ecc:benchmark`.

Si un skill n'est pas disponible, appliquer son workflow manuellement et le
signaler ; ne jamais prétendre l'avoir exécuté.

## Architecture SaaS

Commencer par un monolithe modulaire, sauf contrainte mesurée justifiant des
services séparés. Organiser par domaine métier avec des frontières explicites,
par exemple `src/features/<feature>/{domain,application,adapters}`. Le domaine
ne dépend ni du framework, ni de la base, ni du transport ; inverser les
dépendances via des ports et injecter les adaptateurs au composition root.

Pour chaque fonctionnalité importante, définir les objectifs de latence, coût,
disponibilité et qualité. Traiter l'isolation multi-tenant comme une exigence de
sécurité : toute lecture ou écriture de données tenant-scopées doit être
explicitement filtrée par le `tenant_id` courant au niveau centralisé le plus
proche de l'accès aux données, avec des contraintes en base et, lorsque la stack
le permet, du Row Level Security. Ne jamais accepter un `tenant_id` fourni par
le client comme preuve d'autorisation. Séparer authentification (identité) et
autorisation (droits). Utiliser des migrations versionnées, des transactions,
des clés uniques, des index fondés sur les requêtes réelles et des opérations
asynchrones idempotentes. Ajouter cache, files d'attente, outbox ou événements
seulement lorsqu'un besoin est démontré. Prévoir des logs structurés sans
données sensibles, des traces, des métriques, des health checks et des
sauvegardes restaurées et testées.

Documenter les décisions structurantes dans `docs/adr/NNNN-titre.md` avec
contexte, alternatives et conséquences. Proposer l'ADR pendant la planification
et la créer après validation de l'utilisateur.

## Structure cible

- `apps/web/` : SPA React, Vite, TanStack et HeroUI.
- `apps/api/` : API Hono exécutée sur Cloudflare Workers.
- `packages/domain/` : domaine métier indépendant du framework et des adapters.
- `packages/contracts/` : schémas et contrats partagés.
- `supabase/migrations/` : migrations de base versionnées.
- `**/src/**/*.test.{ts,tsx}` : tests unitaires colocalisés.
- `tests/integration/` et `tests/e2e/` : tests traversant plusieurs frontières.
- `docs/adr/` : décisions d'architecture ; `docs/` : documentation produit.
- `infra/` et `scripts/` : déploiement et automatisation.
- `assets/` : ressources statiques versionnées.

Créer ces dossiers uniquement lorsqu'ils deviennent nécessaires. Documenter les
choix et commandes réelles dans `README.md`.

## Build et développement

Le workspace utilise Node.js 22 et `pnpm@12.15.0`. Les commandes canoniques
sont :

- installation : `pnpm install`
- développement : `pnpm dev`
- lint : `pnpm lint`
- formatage : `pnpm format:check`
- typecheck : `pnpm typecheck`
- tests : `pnpm test`
- couverture : `pnpm test:coverage`
- build : `pnpm build`
- validation complète : `pnpm check`

Ne jamais exécuter `npm test` ou ajouter un `package-lock.json`. Toute nouvelle
commande doit être ajoutée au `package.json` racine et au `README.md`.

Une modification n'est prête qu'après l'exécution des contrôles applicables
(build, typecheck, lint et tests) et la revue du diff. Pour une modification
documentaire, exécuter au minimum les contrôles de formatage et de liens
disponibles.

## Style et tests

Utiliser le formatter et le linter natifs de chaque langage et les exécuter
avant chaque PR. Activer le mode strict du compilateur lorsqu'il existe. Nommer
les fichiers selon la convention du langage, les fonctions par intention et les
classes/types selon leur responsabilité. Garder les erreurs explicites et
éviter les dépendances globales cachées.

Écrire le test avant la logique métier et vérifier qu'il échoue pour la bonne
raison. Viser au moins 80 % de couverture, avec des tests d'intégration pour les
adapters et des parcours E2E pour les flux critiques : inscription, connexion,
isolation tenant (y compris les tentatives d'accès inter-tenant), paiement et
suppression de compte. Nommer les tests d'après le comportement attendu.

## Commits et pull requests

Utiliser des commits courts et impératifs, idéalement préfixés :
`feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`.

Chaque PR doit décrire le problème, le résultat attendu, les décisions
d'architecture, les risques, les migrations et les commandes de validation
exécutées. Lier les issues et ajouter captures ou mesures de performance pour
tout changement visible ou sensible.

## Sécurité

Ne jamais committer de secrets, tokens ou données personnelles. Utiliser des
variables d'environnement, limiter les permissions, valider toutes les entrées,
protéger contre les risques OWASP applicables et éviter de journaliser les
données sensibles. Vérifier l'autorisation et l'appartenance au tenant pour
chaque opération sur une ressource, y compris les endpoints d'administration.
