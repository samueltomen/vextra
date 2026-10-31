# ADR 0005 — Préférences de compte

- **Statut** : Accepté
- **Date** : 2026-10-31

## Contexte

Les réglages se limitaient à l'affichage du compte et à sa suppression. Les
utilisateurs veulent choisir un fuseau horaire d'affichage, un nom affiché et les
alertes e-mail qu'ils reçoivent.

## Décision

- Table `account_preferences (tenant_id pk, display_name, timezone,
notify_on_open, notify_on_resolve)`, créée à la première modification ; les
  valeurs par défaut sont renvoyées tant qu'aucune ligne n'existe.
- RLS membre du tenant, droits de colonne limités ; le fuseau est validé en base
  (`pg_timezone_names`) et côté contrat (`Intl`).
- **Préférences d'alerte appliquées à la livraison** : `claim_notification_deliveries`
  marque `skipped` (`preference_disabled`) les envois dont le type est désactivé.
  Le statut `skipped` est ajouté à l'outbox et visible dans l'historique.
- Le fuseau s'applique à l'affichage des dates ; l'horodatage reste en UTC côté
  serveur.
- API : `GET/PATCH /api/preferences` (mise à jour partielle, objet strict).

## Alternatives écartées

1. **Filtrer à l'enfilement** (`record_heartbeat`, `open_due_monitor_incidents`) :
   modifie deux fonctions critiques de plus et fige la préférence au moment de
   l'incident.
2. **Préférences en stockage local** : non partagées entre appareils, sans effet
   sur les envois côté serveur.
3. **Destinataires multiples** : reporté, car cela impose vérification des
   adresses et gestion des désinscriptions.

## Conséquences

- (+) Les préférences ont un effet réel et testé sur les e-mails envoyés.
- (−) Une préférence désactivée n'empêche pas la création de la ligne d'outbox :
  elle est marquée `skipped` à la livraison, ce qui garde une trace auditable.
