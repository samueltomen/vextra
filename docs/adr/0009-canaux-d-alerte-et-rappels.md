# ADR 0009 — Canaux d'alerte et rappels

- **Statut** : Accepté
- **Date** : 2026-10-31

## Contexte

Les alertes ne partaient que par e-mail, vers le propriétaire de l'espace. Les
équipes veulent être prévenues dans Slack, Discord, Telegram, Teams ou PagerDuty,
ou via un webhook, et être relancées tant qu'un incident reste ouvert.

## Décision

**Canaux** : table `notification_channels` (type, nom, destination, activé),
10 par espace, nom unique.

- La **destination est un secret** (URL de webhook, jeton de bot, clé
  d'intégration). Les droits de colonne autorisent le client à l'**écrire** mais
  pas à la **lire** : l'API ne renvoie qu'un indice masqué (`hooks.slack.com/…abcd`).
  Seul le rôle de service lit la destination, pour livrer ou tester, toujours
  filtré par `tenant_id`.
- **Diffusion** : un trigger `fan_out_to_channels` sur `notification_outbox`
  copie chaque alerte vers `channel_outbox` (une ligne par canal activé,
  clé d'idempotence `alerte:canal`). Les fonctions critiques de ping et de
  détection ne sont pas modifiées.
- **Livraison** : le cron appelle `claim_channel_deliveries`, envoie en HTTP,
  puis `complete_channel_delivery` (5 essais, délais 1, 2, 5, 15 minutes).
  Mêmes règles que l'e-mail : préférences d'alerte, moniteur muet, canal
  désactivé donnent le statut `skipped`.
- **Protection contre le SSRF** : destinations HTTPS uniquement, hôte public
  (ni IP littérale, ni `localhost`, ni `.local`/`.internal`), port 443, pas
  d'identifiants dans l'URL, hôtes imposés pour Slack et Discord, **redirections
  refusées**, délai de 8 secondes.
- **Fournisseurs** : charge utile propre à chacun (Slack, Discord, Telegram,
  PagerDuty Events v2 avec `resolve` à la résolution, webhook et Teams en JSON).
  Un message de **test** ne déclenche jamais de page PagerDuty (gravité `info`).
- API : `GET/POST /api/channels`, `PATCH/DELETE /api/channels/:id`,
  `POST /api/channels/:id/test`.

**Rappels** : préférence `reminder_interval_minutes` (aucun, 1 h, 6 h, 24 h,
7 jours). `enqueue_incident_reminders`, appelée par le cron, met en file une
alerte `reminder` pour chaque incident ouvert dont le dernier rappel (ou
l'ouverture) est plus ancien que l'intervalle, sauf moniteur muet ou alertes
d'ouverture désactivées. Elle part par e-mail et vers les canaux.

## Alternatives écartées

1. **Chiffrer la destination côté application** : exige un secret
   supplémentaire à gérer ; les droits de colonne (jamais relue par un client) et
   le chiffrement au repos du fournisseur de base répondent au risque principal.
2. **Envoyer directement depuis le trigger de ping** : mélange les réseaux
   externes et le chemin critique du heartbeat.
3. **Autoriser n'importe quelle URL** : ouvre le SSRF et la fuite de requêtes
   vers des services internes.

## Conséquences

- (+) Alertes multi-canaux fiables (relances, idempotence) sans toucher au ping.
- (+) Un secret de webhook ne peut plus fuiter par l'API ou l'interface.
- (−) Le journal du cron peut contenir le fournisseur et le statut HTTP, jamais la
  destination.
- (−) Les rappels supposent un cron actif (déjà requis pour détecter les
  retards).
- (−) Teams utilise le format générique ; les anciens connecteurs Office 365
  retirés par Microsoft ne sont pas visés.
