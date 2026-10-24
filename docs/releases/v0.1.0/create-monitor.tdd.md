# Création d'un moniteur - preuve TDD

Source : `docs/plans/cronping-mvp.md`, étapes 2 et 4.

## Parcours

En tant qu'utilisateur authentifié, je veux créer un moniteur dans mon tenant
afin d'obtenir un token de heartbeat unique sans transmettre de contenu
d'exécution.

## Garanties

| #   | Garantie                                                       | Test                                  | Résultat |
| --- | -------------------------------------------------------------- | ------------------------------------- | -------- |
| 1   | Le client ne peut pas fournir `tenantId`                       | `create-monitor.test.ts` contrat      | PASS     |
| 2   | Les intervalles et marges invalides sont rejetés               | `create-monitor.test.ts` contrat      | PASS     |
| 3   | Le moniteur est créé pour le tenant authentifié                | `create-monitor.test.ts` application  | PASS     |
| 4   | Seuls le hash et le préfixe du token sont persistés            | `create-monitor.test.ts` application  | PASS     |
| 5   | Une erreur métier empêche la génération et la persistance      | `create-monitor.test.ts` application  | PASS     |
| 6   | Le token contient 256 bits aléatoires et son hash HMAC-SHA-256 | `crypto-monitor-token.test.ts`        | PASS     |
| 7   | Deux moniteurs reçoivent des tokens différents                 | `crypto-monitor-token.test.ts`        | PASS     |
| 8   | L'API exige une identité authentifiée                          | `create-monitor-route.test.ts`        | PASS     |
| 9   | L'API retourne `201`, `Location` et le token une seule fois    | `create-monitor-route.test.ts`        | PASS     |
| 10  | Un `tenantId` client provoque une erreur de validation         | `create-monitor-route.test.ts`        | PASS     |
| 11  | Les erreurs internes ne fuient aucun détail fournisseur        | `create-monitor-route.test.ts`        | PASS     |
| 12  | L'adapter Supabase ne reçoit jamais le token brut              | `supabase-monitor-repository.test.ts` | PASS     |
| 13  | Deux utilisateurs ne voient pas les données de l'autre tenant  | `supabase/tests/tenant_isolation.sql` | PASS     |

## Validation

```bash
pnpm test:coverage
pnpm exec supabase db reset
pnpm db:lint
pnpm test:db
```

Résultats observés :

- 17 tests API passent avec 100 % de couverture sur les fichiers inclus ;
- 4 tests de contrat passent ;
- la migration Supabase se rejoue sans erreur ;
- le lint SQL ne signale aucune erreur ;
- les 8 assertions pgTAP d'isolation tenant passent.

## Limite fonctionnelle

Le transport HTTP et la persistance Supabase sont testés séparément. Le
branchement de l'authentification réelle, du composition root et du formulaire
web constitue le prochain incrément avant que la feature soit accessible dans
l'interface.
