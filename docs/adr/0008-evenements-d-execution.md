# ADR 0008 — Événements d'exécution, ping par URL et historique

- **Statut** : Accepté
- **Date** : 2026-10-31

## Contexte

Seul un ping « tout va bien » existait, et uniquement par `POST` avec un en-tête
`Authorization`. Il était impossible de mesurer la durée d'un job, de signaler un
échec sans attendre la marge, ou d'utiliser `wget` et les plateformes qui ne
posent pas d'en-têtes. Le produit s'engage à ne stocker ni contenu, ni IP, ni
journal.

## Décision

**Événements** : `start`, `fail`, `warn`, en plus de `success`.

- `start` pose `monitors.running_since` ; un second `start` pendant l'exécution
  est enregistré comme **chevauchement**.
- `success` (le heartbeat actuel) calcule la durée depuis `start`, efface
  `running_since` et enregistre l'exécution.
- `fail` ouvre **immédiatement** un incident de motif `run_failed` (sans attendre
  la marge), met en file une alerte de type `run_failed`, et efface
  `running_since`. Un second échec n'ouvre pas de deuxième incident ; le prochain
  `success` résout l'incident.
- `warn` est enregistré sans changer l'état du moniteur.
- Fonctions SQL `security definer`, `search_path` vide : `record_run_event`
  (nouvelle) et `record_heartbeat` (étendue), exécutables par `anon` comme le
  heartbeat existant.

**Ping par URL** (en plus du `POST` avec en-tête, qui reste recommandé) :
`GET`, `HEAD` ou `POST` sur `/api/ping/:token`, `/api/ping/:token/start|fail|warn`
et `/api/ping/:token/:code` (0 = succès, 1 à 255 = échec). Toujours **aucun
corps ni paramètre de requête** (400 sinon). La limitation de débit s'applique à
ces méthodes.

**Historique** : table `monitor_runs` (type, durée, chevauchement, date),
**90 jours**, purge opportuniste ; `monitor_daily_stats` gagne les échecs et la
somme, le maximum et le nombre de durées. API `GET /api/monitors/:id/runs`
(50 dernières). Aucune sortie de script n'est acceptée ni conservée.

## Alternatives écartées

1. **Accepter un corps ou des logs** (comme certains concurrents) : contraire à
   la promesse « ni contenu, ni journal », et expose des données sensibles.
2. **Un état « en échec » distinct** : plus de transitions à gérer ; réutiliser
   l'incident existant (motif `run_failed`) garde un seul modèle d'alerte.
3. **Calculer la durée côté client** : le serveur est la seule source horaire
   fiable.

## Conséquences

- (+) Durée d'exécution, échecs immédiats et historique, sans stocker de contenu.
- (+) Compatible `wget`, GitHub Actions, Kubernetes, etc.
- (−) Un token dans une URL peut apparaître dans des journaux de proxy ou
  d'infrastructure : l'interface le signale et propose la variante avec en-tête.
- (−) Une ligne par événement pendant 90 jours : volume borné par la fréquence
  des jobs et par la purge.
