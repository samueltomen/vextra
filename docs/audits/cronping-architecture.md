# Audit d'architecture CronPing

- **Date** : 2026-10-24
- **Méthode** : pré-scan `repo-scan` niveau standard + revue des frontières
  ports/adapters et de l'arborescence réelle
- **Périmètre** : `apps/api`, `apps/web`, `packages/*`, `supabase/*`

## Constat global

La structure suit correctement le modèle monolithe modulaire par domaine.
Le domaine monitoring ne dépend ni de Hono, ni de Supabase, ni de React. Les
ports vivent dans `application/`, les adapters HTTP et de persistance dans
`adapters/`, et le câblage est centralisé dans `apps/api/src/composition.ts`.

Aucun doublon de module significatif ni dossier de bruit non ignoré n'a été
détecté en dehors des artefacts attendus (`coverage/`, `node_modules/`,
`dist/`, `.wrangler/`).

## Arborescence physique

```text
apps/
  api/
    src/
      app.ts                # assemblage HTTP, headers de sécurité, garde d'origine
      composition.ts        # composition root, câblage des adapters
      worker.ts             # handler fetch et handler planifié
      features/
        accounts/
          application/      # use case de session
          adapters/
            inbound/http/   # routes auth, cookies, garde d'origine
            outbound/       # codec AES-GCM, gateway Supabase
        monitoring/
          application/      # use cases création, lecture, heartbeat, checker
          adapters/
            inbound/http/   # routes moniteur et ping
            outbound/       # repositories et RPC Supabase
  web/
    src/
      api/                  # client fetch sans secret
      features/{accounts,monitoring}/
      shell/                # layout applicatif
      routes/               # routes TanStack générées par fichiers
packages/
  contracts/                # schémas Zod partagés
  domain/                   # règles monitoring pures
supabase/
  migrations/               # schéma versionné
  tests/                    # pgTAP RLS et cycle de vie
```

## Corrections appliquées

| Problème                                      | Correction                                                             |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| `formatFrequency` dupliqué dans deux écrans   | extrait dans `monitor-format.ts` et réutilisé                          |
| date/heure formatée localement dans le détail | extraite en `formatDateTime` partagé                                   |
| type de filtre exporté depuis un composant UI | déplacé dans le modèle `monitor.ts` pour éviter un cycle de dépendance |
| résumé de statut non interactif               | transformé en contrôles de filtre accessibles (`aria-pressed`)         |

## Points conservés

- `packages/domain` reste sans import d'infrastructure ;
- `tenantId` n'est jamais accepté depuis un corps de requête ;
- le client dashboard est lié au JWT utilisateur pour laisser RLS décider ;
- le client service-role n'est utilisé que par le handler planifié ;
- le heartbeat public est routé par hash et ne lit ni corps ni paramètres.

## Recommandations non bloquantes

- extraire `src/api` et `src/shell` en petites factories si le frontend grossit ;
- ajouter une validation runtime des réponses API côté SPA lorsqu'un contrat
  évolue ;
- prévoir l'outbox de notifications avant d'étendre le checker ;
- documenter les ADR de persistance et de scheduler avant le déploiement.
