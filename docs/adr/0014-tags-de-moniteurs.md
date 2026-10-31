# ADR 0014 — Tags de moniteurs

- **Statut** : Accepté
- **Date** : 2026-10-31

## Contexte

Les dossiers (ADR 0005) organisent les moniteurs de façon exclusive : un
moniteur appartient à un seul dossier. Les utilisateurs veulent aussi des
critères transversaux (« prod », « paiement », « équipe-data ») pour filtrer
sans multiplier les dossiers.

## Décision

- **Colonne `monitors.tags text[]`** (défaut vide) plutôt qu'une table de
  jointure : lecture sans jointure, mise à jour atomique avec le moniteur, RLS
  déjà en place. Index GIN pour les recherches par appartenance.
- **Contrainte en base** (`valid_monitor_tags`) : 10 tags maximum, distincts,
  `[a-z0-9][a-z0-9_-]{0,23}`. Le contrat Zod normalise (minuscules, espaces
  retirés, doublons supprimés) avant l'écriture ; la base reste la dernière
  garde.
- **Droits** : `grant update (tags)` aux utilisateurs authentifiés, sous la
  RLS existante des moniteurs ; aucune nouvelle table à protéger.
- **Interface** : édition dans la carte de détails du moniteur, puces dans la
  liste, barre de filtre par tag sur le tableau de bord (un tag à la fois,
  avec compteur) et recherche textuelle étendue aux tags.

## Alternatives écartées

- **Table `tags` + liaison** : gestion de la suppression, des renommages et de
  l'isolation par tenant pour un gain qui n'est pas démontré.
- **Tags libres sans contrainte** : risque d'injection dans des vues futures et
  de doublons visuels (« Prod » / « prod »).

## Conséquences

- Renommer un tag globalement n'est pas un cas d'usage de cette version.
- Les filtres multi-tags (ET/OU) pourront s'appuyer sur l'index GIN sans
  migration.
