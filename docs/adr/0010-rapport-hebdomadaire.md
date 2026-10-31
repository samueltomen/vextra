# ADR 0010 — Rapport hebdomadaire par e-mail

- **Statut** : Accepté
- **Date** : 2026-10-31

## Contexte

Les utilisateurs veulent un résumé régulier de la santé de leurs jobs sans ouvrir
l'application. Le produit ne conserve que des compteurs (ADR 0004) : le rapport
doit s'appuyer sur eux.

## Décision

- **Envoi** : chaque **lundi à partir de 9 h UTC**, par e-mail, au propriétaire
  de l'espace, avec la même charte (clair/sombre) que les alertes.
- **Contenu** : nombre de moniteurs, heartbeats reçus et échecs signalés sur 7
  jours, incidents ouverts, incidents encore en cours, et jusqu'à 5 moniteurs
  ayant eu des incidents (avec lien). Aucun contenu de job.
- **Idempotence** : table `weekly_reports` (une ligne par espace et par semaine
  ISO). La fonction `claim_weekly_reports` calcule les destinataires dus et
  réserve la ligne de façon atomique ; le cron, qui tourne chaque minute, ne peut
  donc pas envoyer deux fois. Un envoi non confirmé est retenté **après 10
  minutes, 3 fois au plus**.
- **Choix de l'utilisateur** : préférence `weekly_report_enabled`, **activée par
  défaut**, désactivable dans les réglages et par le lien du pied de page. Un
  espace sans moniteur ne reçoit rien.
- Les fonctions sont `security definer` et réservées au rôle de service ; la
  table n'est lisible par aucun client.

## Alternatives écartées

1. **Planifier un déclencheur Cloudflare hebdomadaire séparé** : un second cron à
   gérer ; la fenêtre du lundi dans le cron existant suffit, et la table garantit
   l'unicité.
2. **Envoyer à tous les membres** : l'application n'a qu'un propriétaire par
   espace aujourd'hui ; à reprendre avec la gestion d'équipe.
3. **Désactivé par défaut** : sous-utilisé ; l'envoi reste réversible en un clic et
   limité au propriétaire.

## Conséquences

- (+) Rapport fiable, sans doublon, avec reprise après une panne du fournisseur.
- (−) Le lundi à 9 h UTC n'est pas 9 h locale pour tous ; un horaire par
  utilisateur demanderait de planifier par fuseau.
- (−) Nécessite `RESEND_API_KEY` et `RESEND_FROM_EMAIL` ; sans eux, aucun rapport
  n'est envoyé (comme pour les alertes e-mail).
