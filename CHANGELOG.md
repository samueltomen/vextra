# Journal des changements

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Le projet suit le [versionnage sémantique](https://semver.org/lang/fr/).

## [Non publié]

## [0.1.0]

Première version publique.

### Ajouté

- Moniteurs par intervalle ou par expression cron avec fuseau horaire.
- Heartbeats par en-tête ou par URL, avec `start`, `success`, `fail`, `warn`,
  durées et historique des exécutions.
- Incidents, rappels, rapport hebdomadaire et alertes par e-mail (Resend ou
  SMTP), Slack, Discord, Telegram, Microsoft Teams, PagerDuty et webhook.
- Dossiers, tags avec filtres et fenêtres de maintenance.
- Page de statut publique et badges SVG.
- Équipes (propriétaire, membre, lecture seule) et invitations par lien.
- API en lecture seule avec clés d'API.
- Interface en direct, thèmes clair et sombre, mode démo.
- Auto-hébergement avec une image Docker unique.

### Sécurité

- Isolation entre espaces par Row Level Security, privilèges de base minimaux,
  cookie de session chiffré, limitation de débit, CSP stricte.
- Audit publié dans `docs/audits/securite-avant-production.md`.
