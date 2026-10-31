# ADR 0013 — Page de statut publique

- **Statut** : Accepté
- **Date** : 2026-10-31

## Contexte

Les équipes veulent partager l'état de leurs services avec leurs clients, sans
compte ni accès au tableau de bord. L'exposition de données doit rester minimale
et explicite : un moniteur contient des jetons, des notes et une planification
qui ne doivent jamais sortir de l'espace.

## Décision

- **Une page par espace** (`status_pages`, clé primaire `tenant_id`), avec une
  adresse unique (`slug`, 3 à 40 caractères `[a-z0-9-]`), un titre, une
  description et un interrupteur de publication.
- **Sélection explicite** : un moniteur n'apparaît que si
  `monitors.show_on_status_page` est vrai. Défaut : privé.
- **Lecture publique par une seule fonction SQL**
  (`get_public_status_page(slug)`, `security definer`, `search_path` vide),
  exécutable par `anon`. Elle ne renvoie que : titre, description, nom, état et
  disponibilité sur 30 jours de chaque moniteur sélectionné, et les incidents
  des 14 derniers jours. Jamais d'identifiant, de jeton, de note, de
  planification ni d'information sur l'espace. Les tables restent fermées à
  `anon`.
- **Écriture atomique** par `save_status_page` en `security invoker` : la page
  et les moniteurs exposés changent ensemble, sous la RLS de l'utilisateur ;
  un identifiant d'un autre espace est sans effet.
- **Disponibilité** = 1 − (durée cumulée des incidents recoupant la fenêtre /
  durée de la fenêtre), la fenêtre commençant à la création du moniteur si elle
  est plus récente que 30 jours.
- **API** : `GET /api/status/:slug` (public, limité en débit comme les pings),
  `GET|PUT /api/status-page` (authentifié, tenant déduit de la session). Un
  corps client contenant `tenantId` est refusé.
- **Interface** : route `/status/$slug` hors de la coque applicative, rafraîchie
  toutes les 30 secondes ; carte de configuration dans les réglages.

## Addendum — Badges SVG

`GET /api/status/:slug/badge.svg` (public) renvoie un badge « statut » (vert
opérationnel, rouge incident, gris inconnu) ; `?metric=uptime` renvoie la
disponibilité moyenne sur 30 jours, tronquée (jamais arrondie vers le haut).
Le SVG n'utilise que des attributs (aucun CSS ni script, texte échappé), est
servi en `image/svg+xml` avec `Cache-Control: public, max-age=300` (le seul
endpoint qui déroge au `no-store` global) et se dégrade en badge
« indisponible » plutôt qu'en erreur si la base est inaccessible. La carte de
configuration affiche l'aperçu et les extraits Markdown prêts à coller.

## Alternatives écartées

- **Vue SQL ouverte à `anon`** : expose plus facilement des colonnes par
  erreur lors d'une future migration.
- **Page statique générée au déploiement** : état périmé, incompatible avec le
  temps réel attendu.
- **Plusieurs pages par espace** : utile plus tard ; une page couvre le besoin
  immédiat et la clé primaire peut évoluer par migration.

## Conséquences

- Toute évolution du modèle public passe par la fonction SQL et le schéma
  `publicStatusPageSchema`, testés (pgTAP : 10 assertions dont l'absence
  d'identifiants dans la sortie).
- Le nom d'un moniteur devient public dès qu'il est sélectionné : l'interface
  le rappelle à l'utilisateur.
- La page n'est pas mise en cache (`no-store`) ; le limiteur de débit protège
  la base.
