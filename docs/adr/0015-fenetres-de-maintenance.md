# ADR 0015 — Fenêtres de maintenance

- **Statut** : Accepté
- **Date** : 2026-10-31

## Contexte

Une opération planifiée (migration, redémarrage) interrompt les tâches
surveillées. Sans mécanisme dédié, chaque intervention produit des incidents et
des alertes sans valeur, et dégrade la disponibilité affichée. Mettre les
moniteurs en pause à la main est fastidieux et se termine par des oublis de
reprise.

## Décision

- **Table `maintenance_windows`** : espace, moniteur facultatif (nul = tous les
  moniteurs de l'espace), nom, début, fin. Contraintes : fin postérieure au
  début, durée maximale de 30 jours, 100 fenêtres à venir par espace. RLS par
  appartenance à l'espace ; création et suppression seulement (une fenêtre se
  recrée plutôt qu'elle ne se modifie).
- **Suppression des incidents à la source** : `is_in_maintenance(tenant,
monitor, instant)` est évaluée dans `open_due_monitor_incidents` (retard de
  signal) et dans `record_run_event` (ping d'échec). Aucun incident n'est
  ouvert, donc aucune notification, aucun rappel, aucun événement temps réel
  parasite. Un incident déjà ouvert au début de la fenêtre n'est pas modifié.
- **Marge de reprise** : la fenêtre est prolongée de la marge (`grace_seconds`)
  du moniteur, pour laisser au job le temps de renvoyer un signal après la
  reprise sans déclencher d'alerte immédiate.
- **Page de statut** : un moniteur en maintenance est affiché « en
  maintenance » (même état que la pause), sans pénaliser la disponibilité
  puisque aucun incident n'est créé.
- **API** : `GET|POST /api/maintenance`, `DELETE /api/maintenance/:id`, tenant
  déduit de la session ; un `tenantId` du client est rejeté.

## Alternatives écartées

- **Pause automatique planifiée** : exige un ordonnanceur de plus et un état
  « pausé par fenêtre » à ne pas confondre avec la pause manuelle.
- **Filtrer à l'envoi des notifications** : les incidents existeraient quand
  même (disponibilité dégradée, historique faux, rappels déclenchés).

## Conséquences

- Les signaux reçus pendant une fenêtre sont enregistrés normalement.
- Les fonctions SQL modifiées sont couvertes par pgTAP (moniteur couvert sans
  incident, moniteur non couvert qui alerte, isolation entre espaces).
- Les fenêtres récurrentes (hebdomadaires) ne sont pas prises en charge ; elles
  pourront s'appuyer sur le moteur cron (ADR 0012).
