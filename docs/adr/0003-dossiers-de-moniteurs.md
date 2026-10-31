# ADR 0003 — Dossiers de moniteurs

- **Statut** : Accepté
- **Date** : 2026-10-31

## Contexte

Les utilisateurs veulent regrouper leurs moniteurs (production, maintenance,
client…) pour s'y retrouver quand la liste grandit. Le libellé d'un moniteur est
aujourd'hui stocké localement dans le navigateur ; le serveur ne connaît que
l'état technique.

## Décision

- Table `monitor_folders (id, tenant_id, name, …)` et colonne nullable
  `monitors.folder_id`.
- **Dossiers plats**, un seul niveau, un moniteur dans au plus un dossier.
- Intégrité multi-tenant garantie par la base : clé étrangère composite
  `(tenant_id, folder_id) → monitor_folders (tenant_id, id)` ; un moniteur ne
  peut pas être rangé dans le dossier d'un autre tenant.
- RLS sur `monitor_folders` (`is_tenant_member`), droits de colonne limités
  (`name`, `updated_at` ; `folder_id` sur `monitors`).
- Nom unique par tenant sans tenir compte de la casse ni des espaces ; limite de
  50 dossiers par tenant (trigger).
- Suppression d'un dossier : `on delete set null (folder_id)`, les moniteurs sont
  conservés.
- API : `GET/POST /api/folders`, `PATCH/DELETE /api/folders/:id`,
  `PUT /api/monitors/:id/folder`. Le `tenant_id` provient toujours de la session.

## Alternatives écartées

1. **Dossiers imbriqués** : modèle récursif, requêtes et UI plus complexes, aucun
   besoin démontré.
2. **Étiquettes (tags) multiples** : plus flexible mais filtre et affichage plus
   lourds ; peut être ajouté plus tard.
3. **Stockage local seulement** : non partagé entre appareils, perdu avec le
   navigateur.

## Conséquences

- (+) Organisation persistante et isolée par tenant, sans coût de requête
  notable (index partiel sur `folder_id`).
- (−) Le libellé reste local au navigateur : les dossiers sont serveur, les noms
  de moniteurs non. À traiter séparément si l'on veut des noms partagés.
