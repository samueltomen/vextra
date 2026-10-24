# Domaine monitoring - preuve TDD

Source : `docs/plans/cronping-mvp.md`, étape 3.

## Comportements garantis

| #   | Garantie                                                  | Test              | Résultat |
| --- | --------------------------------------------------------- | ----------------- | -------- |
| 1   | Un moniteur naît `pending` avec une échéance calculée     | `monitor.test.ts` | PASS     |
| 2   | Une configuration invalide est rejetée                    | `monitor.test.ts` | PASS     |
| 3   | Un incident s'ouvre exactement à la deadline              | `monitor.test.ts` | PASS     |
| 4   | Un second contrôle n'ouvre pas un incident supplémentaire | `monitor.test.ts` | PASS     |
| 5   | Un heartbeat tardif résout l'incident                     | `monitor.test.ts` | PASS     |
| 6   | Un heartbeat hors ordre ne régresse pas l'état            | `monitor.test.ts` | PASS     |
| 7   | Une pause ferme l'incident et gèle les alertes            | `monitor.test.ts` | PASS     |
| 8   | Une reprise recalcule une nouvelle échéance               | `monitor.test.ts` | PASS     |

## Cycle RED/GREEN

Commande RED :

```bash
PATH=/home/stomen/.nvm/versions/node/v22.23.4/bin:$PATH \
  /home/stomen/Documents/GitHub/codex_test_skills/apps/api/node_modules/.bin/vitest \
  run packages/domain/src/monitoring/monitor.test.ts
```

Résultat RED observé : échec de résolution de `./monitor.ts`.

Commande GREEN avec couverture :

```bash
cd packages/domain
PATH=/home/stomen/.nvm/versions/node/v22.23.4/bin:$PATH \
  ./node_modules/.bin/vitest run --coverage
```

Résultat GREEN observé : 11 tests passés.

Couverture observée : 87,87 % des lignes, 85,71 % des branches et 100 % des
fonctions.

## Frontières

- `packages/domain` ne dépend ni de Hono, ni de Supabase, ni de React.
- Le temps est injecté sous forme de timestamp epoch.
- Les transitions retournent de nouveaux objets et ne mutent pas l'état reçu.
- L'identifiant de tenant reste porté par le moniteur pour les futurs adapters
  tenant-scopés.

## Limite

Les checkpoints Git n'ont pas été créés : le répertoire `.git` reste en lecture
seule dans l'environnement de l'agent.
