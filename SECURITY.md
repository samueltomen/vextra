# Politique de sécurité

## Signaler une vulnérabilité

**Ne publiez pas de faille dans une issue publique.**

Utilisez le signalement privé de GitHub : onglet **Security** du dépôt, puis
**Report a vulnerability**. Décrivez le problème, la version concernée et, si
possible, les étapes pour le reproduire.

Nous nous engageons à accuser réception sous 5 jours ouvrés et à vous tenir
informé de la correction. Merci de nous laisser un délai raisonnable avant toute
divulgation publique.

## Périmètre

Sont concernés : l'API (`apps/api`), l'interface (`apps/web`), les migrations et
politiques de sécurité de la base (`supabase/`), et les fichiers de déploiement
(`Dockerfile`, `docker-compose.yml`).

Sont particulièrement sensibles : l'isolation entre espaces (RLS), la session par
cookie chiffré, les secrets des canaux d'alerte, la limitation de débit et les
routes de ping publiques.

## Si vous auto-hébergez

- Ne commitez jamais votre fichier `.env`, ni vos clés Supabase, Resend ou SMTP.
- Générez des valeurs aléatoires longues pour `SESSION_ENCRYPTION_KEY` et
  `PING_TOKEN_PEPPER` (`openssl rand -base64 48`). Ne changez jamais
  `PING_TOKEN_PEPPER` après coup : tous les tokens de ping deviendraient invalides.
- Exposez l'application derrière HTTPS (les cookies de session sont `Secure`).
- Gardez la clé `service_role` de Supabase côté serveur uniquement.
- Mettez à jour régulièrement l'image et les dépendances.
