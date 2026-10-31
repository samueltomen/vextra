# Référence de l'API

Cette page décrit les points d'entrée destinés à vos scripts et à vos outils.
Remplacez `<origine>` par l'adresse de votre instance (par exemple
`https://vextra.exemple.org`).

L'interface web utilise d'autres routes (`/api/auth/*`, `/api/monitors/*`,
etc.). Elles sont protégées par une session et par une garde d'origine : elles
ne sont pas faites pour être appelées depuis un script.

## Envoyer un heartbeat (ping)

Chaque moniteur possède un **token de ping**, affiché une seule fois à la
création et remplaçable depuis la page du moniteur. Le token est haché côté
serveur ; il n'est jamais stocké ni journalisé en clair.

```bash
curl --fail --silent --show-error --retry 3 \
  --request POST \
  --header "Authorization: Bearer $VEXTRA_TOKEN" \
  "<origine>/api/ping"
```

- La requête ne doit contenir **ni corps ni paramètres** : Vextra ne reçoit
  jamais le contenu de vos scripts.
- Réponse `204` : heartbeat accepté.
- Réponse `401` : token invalide ou inconnu (même réponse dans les deux cas).
- Réponse `429` : trop de requêtes depuis cette adresse IP (120 par minute).

### Signaler le cycle de vie d'un job

| Événement | Effet                                                                          |
| --------- | ------------------------------------------------------------------------------ |
| `start`   | Marque le début de l'exécution et permet de mesurer sa durée.                  |
| `success` | Heartbeat normal : recalcule l'échéance, ferme l'incident éventuel.            |
| `fail`    | Ouvre immédiatement un incident, sans attendre la marge.                       |
| `warn`    | Enregistre un avertissement dans l'historique sans changer l'état du moniteur. |

Deux formes équivalentes. Avec l'en-tête `Authorization`, seule la méthode
`POST` est acceptée ; avec le token dans l'URL, `GET`, `HEAD` et `POST` le sont :

```bash
# En-tête Authorization (recommandé : le token ne figure pas dans l'URL)
curl -X POST -H "Authorization: Bearer $VEXTRA_TOKEN" "<origine>/api/ping/start"
curl -X POST -H "Authorization: Bearer $VEXTRA_TOKEN" "<origine>/api/ping/fail"

# Token dans l'URL, pour les outils qui ne savent pas envoyer d'en-tête
curl "<origine>/api/ping/<token>"
curl "<origine>/api/ping/<token>/start"
curl "<origine>/api/ping/<token>/fail"
curl "<origine>/api/ping/<token>/<code>"   # 0 = succès, 1 à 255 = échec
```

Exemple de tâche planifiée qui mesure sa durée et signale ses échecs :

```bash
#!/usr/bin/env bash
set -u
ping() { curl -fsS -m 10 --retry 3 -X POST -H "Authorization: Bearer $VEXTRA_TOKEN" "<origine>/api/ping$1" >/dev/null; }

ping /start
if ./sauvegarde.sh; then ping ""; else ping /fail; fi
```

## API en lecture seule (clés d'API)

Les propriétaires d'un espace créent des clés dans **Réglages > Clés d'API**
(10 clés actives au maximum). Une clé commence par `vx_`, n'est affichée qu'une
fois, et donne un accès **en lecture seule** aux moniteurs de son espace.

```bash
curl -H "Authorization: Bearer vx_…" "<origine>/api/v1/monitors"
curl -H "Authorization: Bearer vx_…" "<origine>/api/v1/monitors/<id>"
```

Réponse de la liste :

```json
{
  "data": {
    "monitors": [
      {
        "id": "2f0c…",
        "name": "Sauvegarde nocturne",
        "status": "healthy",
        "intervalSeconds": 86400,
        "graceSeconds": 1800,
        "cronExpression": null,
        "cronTimezone": null,
        "lastHeartbeatAt": "2026-10-31T03:00:12.000Z",
        "alertAt": "2026-11-01T03:30:12.000Z",
        "incidentOpenedAt": null,
        "alertsEnabled": true,
        "tags": ["prod"],
        "totalPings": 42
      }
    ]
  }
}
```

(La réponse réelle contient aussi `description`, `notes`, `createdAt`,
`folderId`, `pausedAt` et `runningSince`.)

Statuts possibles : `pending` (jamais pingué), `healthy`, `late`, `paused`.
Une clé invalide ou révoquée renvoie `401`. Une clé ne peut ni créer, ni
modifier, ni supprimer quoi que ce soit.

## Page de statut publique et badges

Si vous activez la page de statut (Réglages), elle est servie sans compte :

- Page : `<origine>/status/<adresse>`
- Données JSON : `GET <origine>/api/status/<adresse>`
- Badge SVG (pour un README) : `<origine>/api/status/<adresse>/badge.svg`

```markdown
![Statut](https://vextra.exemple.org/api/status/mon-service/badge.svg)
```

Seuls les noms, états, disponibilités et incidents des moniteurs que vous
choisissez d'afficher sont exposés. Aucun identifiant, token ou donnée
d'espace ne figure dans la réponse.

## Conventions

- Les dates sont en ISO 8601, en UTC.
- Les erreurs ont la forme `{ "error": { "code": "…", "message": "…" } }`.
- Les routes publiques sont limitées par adresse IP.
