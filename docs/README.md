# Documentation

## Guides

- [Auto-héberger Vextra](self-hosting.md) : Docker, Supabase, HTTPS, e-mails,
  sauvegardes.
- [Déployer sur Cloudflare](cloudflare.md) : Worker, secrets, Cron Trigger.
- [Référence de l'API](api.md) : ping, cycle de vie d'un job, clés d'API, page de
  statut et badges.
- [Design system](design/DESIGNSYSTEM.md) : tokens, composants et principes
  d'interface.

## Sécurité

- [Audit de sécurité avant production](audits/securite-avant-production.md)
- [Politique de sécurité](../SECURITY.md) : signaler une vulnérabilité.

## Décisions d'architecture

Chaque décision structurante est consignée dans `docs/adr/` avec son contexte,
les alternatives étudiées et ses conséquences.

- [ADR 0001 — Déploiement sur une même origine](adr/0001-deploiement-meme-origine.md)
- [ADR 0002 — Limitation de débit](adr/0002-limitation-de-debit.md)
- [ADR 0003 — Dossiers de moniteurs](adr/0003-dossiers-de-moniteurs.md)
- [ADR 0004 — Métriques de heartbeat agrégées](adr/0004-metriques-heartbeat-agregees.md)
- [ADR 0005 — Préférences de compte](adr/0005-preferences-de-compte.md)
- [ADR 0006 — Mises à jour en direct](adr/0006-mises-a-jour-en-direct.md)
- [ADR 0007 — Personnalisation de la configuration](adr/0007-personnalisation-de-la-configuration.md)
- [ADR 0008 — Événements d'exécution, ping par URL et historique](adr/0008-evenements-d-execution.md)
- [ADR 0009 — Canaux d'alerte et rappels](adr/0009-canaux-d-alerte-et-rappels.md)
- [ADR 0010 — Rapport hebdomadaire](adr/0010-rapport-hebdomadaire.md)
- [ADR 0011 — Auto-hébergement](adr/0011-auto-hebergement.md)
- [ADR 0012 — Planification par expression cron](adr/0012-planification-par-expression-cron.md)
- [ADR 0013 — Page de statut publique](adr/0013-page-de-statut-publique.md)
- [ADR 0014 — Tags de moniteurs](adr/0014-tags-de-moniteurs.md)
- [ADR 0015 — Fenêtres de maintenance](adr/0015-fenetres-de-maintenance.md)
- [ADR 0016 — Clés d'API en lecture seule](adr/0016-cles-d-api-en-lecture-seule.md)
- [ADR 0017 — Équipes, rôles et invitations](adr/0017-equipes-roles-et-invitations.md)
