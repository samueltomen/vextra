# ADR 0004 — Métriques de heartbeat agrégées

- **Statut** : Accepté
- **Date** : 2026-10-31

## Contexte

Le détail d'un moniteur n'affichait que des indicateurs dérivés des incidents.
Pour montrer l'activité réelle (volume, régularité, plus long intervalle), il
faut conserver une trace des heartbeats reçus. Le produit s'engage à ne stocker
ni contenu, ni IP, ni journal.

## Décision

- Compteur `monitors.total_pings` et table `monitor_daily_stats` : une ligne par
  moniteur et par jour UTC (`pings`, `gap_count`, `gap_sum_seconds`,
  `gap_max_seconds`).
- Mise à jour atomique dans `record_heartbeat` (déjà `security definer`) par
  `insert … on conflict do update`. Les écritures ne sont pas exposées au client.
- **Rétention de 90 jours** : purge opportuniste du moniteur à chaque heartbeat.
- Lecture par RLS (`is_tenant_member`) ; API `GET /api/monitors/:id/metrics`
  renvoyant les 30 derniers jours.
- Le client dérive : total, 30 jours, aujourd'hui, intervalle moyen, plus long
  intervalle et régularité par rapport à l'intervalle attendu.

## Alternatives écartées

1. **Historique brut de chaque ping** : volumineux, plus sensible, aucun besoin
   des métriques demandées.
2. **Calcul à la volée depuis les incidents** : ne donne aucune activité entre
   les incidents.
3. **Série temporelle externe** : dépendance supplémentaire injustifiée à cette
   échelle.

## Conséquences

- (+) Coût borné : au plus une ligne par moniteur et par jour, 90 jours.
- (+) Conforme à la promesse de confidentialité : des compteurs uniquement.
- (−) Une écriture supplémentaire par heartbeat, sur la ligne déjà verrouillée.
- (−) Résolution journalière ; pas de courbe infra-journalière.
