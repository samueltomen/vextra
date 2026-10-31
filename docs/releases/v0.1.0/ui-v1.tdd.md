# Prototype UI V1 - preuve TDD

Source : `docs/plans/vextra-mvp.md`, étapes 4 et 9.

## Parcours

- En tant qu'utilisateur, je veux voir rapidement quels moniteurs sont sains ou
  en retard.
- Je veux créer un moniteur et obtenir une commande heartbeat unique.
- Je veux consulter l'échéance, le statut et les incidents d'un moniteur.

## Garanties

| #   | Garantie                                                   | Test                           | Résultat |
| --- | ---------------------------------------------------------- | ------------------------------ | -------- |
| 1   | Le résumé compte chaque statut correctement                | `monitor-summary.test.ts`      | PASS     |
| 2   | Chaque statut possède un libellé lisible                   | `status-badge.test.tsx`        | PASS     |
| 3   | Le dashboard affiche les moniteurs et l'action de création | `dashboard-page.test.tsx`      | PASS     |
| 4   | Les états loading, empty et error sont accessibles         | `dashboard-page.test.tsx`      | PASS     |
| 5   | Le filtre et la navigation vers la création fonctionnent   | `dashboard-page.test.tsx`      | PASS     |
| 6   | Le formulaire valide le libellé local                      | `create-monitor-page.test.tsx` | PASS     |
| 7   | Le canal Discord peut être sélectionné                     | `create-monitor-page.test.tsx` | PASS     |
| 8   | La création affiche le token une seule fois                | `create-monitor-page.test.tsx` | PASS     |
| 9   | La commande heartbeat peut être copiée                     | `create-monitor-page.test.tsx` | PASS     |
| 10  | Le détail affiche un incident en retard                    | `monitor-detail-page.test.tsx` | PASS     |
| 11  | Le détail sain n'affiche pas d'incident                    | `monitor-detail-page.test.tsx` | PASS     |
| 12  | Un moniteur inconnu affiche un retour sûr                  | `monitor-detail-page.test.tsx` | PASS     |

## Validation

```bash
pnpm --filter @vextra/web test:coverage
pnpm --filter @vextra/web typecheck
pnpm --filter @vextra/web build
```

Résultats observés : 17 tests réussis, 90,9 % des lignes, 84,94 % des branches
et 89,36 % des fonctions couvertes sur le périmètre UI inclus.

## Rendu visuel

Les captures desktop et mobile sont documentées dans
`docs/evidence/ui-v1/README.md`. Le rapport JSON d'accessibilité, responsive et
états de contenu est dans `docs/evidence/ui-v1/evidence.json`.

## Limite

Le prototype utilise un store en mémoire. L'authentification, la persistance
Supabase et les mutations réelles restent à brancher côté backend.
