# Étape 1 - Socle : preuve TDD

Source : `docs/plans/cronping-mvp.md`, étape 1.

## Cas vérifiés

| #   | Garantie                                                        | Test                                     | Résultat |
| --- | --------------------------------------------------------------- | ---------------------------------------- | -------- |
| 1   | L'API expose un health check JSON                               | `apps/api/src/app.test.ts`               | PASS     |
| 2   | La page d'accueil présente la promesse sans contenu d'exécution | `apps/web/src/routes/home-page.test.tsx` | PASS     |

## Cycle TDD du health check

Commande RED :

```bash
cd apps/api
./node_modules/.bin/vitest run src/app.test.ts
```

Résultat RED observé : échec de résolution de `./app.ts`, car le endpoint
n'existait pas encore.

Commande GREEN :

```bash
cd apps/api
./node_modules/.bin/vitest run src/app.test.ts
```

Résultat GREEN observé : 1 fichier et 1 test passés.

## Validation du frontend

```bash
cd apps/web
./node_modules/.bin/vitest run src/routes/home-page.test.tsx
```

Résultat observé : 1 fichier et 1 test passés avec le vrai `HeroUIProvider` et
le vrai composant `Button`.

## Typechecks

```bash
cd apps/api && ./node_modules/.bin/tsc --noEmit -p tsconfig.json
cd ../web && ./node_modules/.bin/tsc --noEmit -p tsconfig.json
./node_modules/.bin/tsc --noEmit -p tsconfig.node.json
```

Résultat observé : aucune erreur pour l'API, le code web et les configurations
web.

## Build et couverture

```bash
cd apps/web && ./node_modules/.bin/vite build
cd ../api && ./node_modules/.bin/vitest run --coverage
cd ../web && ./node_modules/.bin/vitest run --coverage
```

Résultat observé : build Vite réussi et couverture déclarée à 100 % sur les
modules inclus dans les seuils.

## Contrôles statiques

```bash
./node_modules/.bin/prettier --check .
./node_modules/.bin/eslint .
/home/stomen/.local/share/pnpm/bin/pnpm peers check
node scripts/check-no-bootstrap.mjs
git diff --check
```

Résultat observé : formatage conforme, ESLint sans erreur, aucun conflit de
peer dependency, aucune dépendance Bootstrap détectée et aucun problème
d'espacement dans le diff.

## Correction du premier `pnpm check`

Le premier `pnpm check` exécuté côté utilisateur a échoué avec six erreurs
ESLint : globals Node absents dans le script de contrôle et dans la
configuration PostCSS CommonJS.

Corrections appliquées :

- ajout de `"type": "module"` au manifeste racine ;
- déclaration explicite des globals Node pour les scripts et configurations ;
- suppression de la configuration PostCSS devenue inutile avec Tailwind 4 ;
- alignement des peers sur Tailwind 4 et Vite 7 ;
- utilisation de la carte pnpm 12 `allowBuilds` pour les quatre scripts natifs.

Validation après correction :

```bash
./node_modules/.bin/eslint .
./node_modules/.bin/prettier --check .
node scripts/check-no-bootstrap.mjs
```

Résultat observé : ESLint et Prettier passent, aucune dépendance Bootstrap n'est
détectée.

## Limites de l'environnement

- Node.js 20 est actif dans l'environnement d'exécution, alors que Wrangler
  exige Node.js 22. Le build web est validé ; seul le build/dry-run du Worker
  doit être relancé après activation de Node.js 22.
- Les checkpoints Git n'ont pas pu être créés car le répertoire `.git` est en
  lecture seule dans cet environnement.

Ces limites ne doivent pas être présentées comme des validations réussies.
