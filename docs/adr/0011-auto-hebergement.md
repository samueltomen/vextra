# ADR 0011 — Auto-hébergement et double mode d'exécution

- **Statut** : Accepté
- **Date** : 2026-10-31

## Contexte

CronPing est un logiciel libre (licence MIT) proposé en service hébergé sur
Cloudflare et Supabase. Tout utilisateur doit aussi pouvoir l'installer sur son
propre serveur, avec ses propres identifiants d'e-mail et de base de données,
sans compte Cloudflare.

## Décision

**Un seul code métier, deux points d'entrée.** La racine de composition
(`composition.ts`) est partagée ; chaque environnement fournit ses adaptateurs :

| Besoin              | Cloudflare (service hébergé) | Node (auto-hébergé)                                       |
| ------------------- | ---------------------------- | --------------------------------------------------------- |
| Serveur HTTP        | Worker                       | `@hono/node-server` (`node.ts`)                           |
| Planificateur       | Déclencheur cron             | Minuterie d'une minute, mêmes étapes (`runScheduledTick`) |
| Temps réel          | Durable Object par espace    | `LiveRegistry` en mémoire, WebSocket `ws`                 |
| Limitation de débit | Binding Rate Limiting        | Fenêtre fixe en mémoire                                   |
| Site web            | Assets statiques             | Fichiers servis par le même processus, CSP par hash       |
| E-mail              | Resend                       | Resend ou SMTP (`nodemailer`)                             |

**Distribution** : une image Docker unique (`Dockerfile`), un bundle esbuild d'un
seul fichier, utilisateur non-root, système de fichiers en lecture seule,
`docker-compose.yml` et `.env.example`. La base reste **Supabase** (cloud ou
auto-hébergé) : migrations, RLS et fonctions SQL sont identiques.

**Choix de sécurité propres au mode Node** :

- **Une API neuve par requête** (`createApiDelegate`) : un client Supabase partagé
  garderait la session du dernier utilisateur connecté et l'utiliserait pour les
  appels anonymes comme les pings (défaut constaté pendant les tests).
- **IP du client** : par défaut, l'adresse de la connexion (tout en-tête fourni
  par le client est écrasé) ; derrière un proxy de confiance,
  `CLIENT_IP_HEADER` désigne l'en-tête à lire.
- **Inscriptions** : `SIGNUPS_ENABLED=false` ferme l'enregistrement (403).
- **Configuration validée au démarrage** : toutes les erreurs listées d'un coup,
  secrets d'au moins 32 caractères.
- **WebSocket** : mêmes contrôles qu'en Worker (session et origine exacte), via
  la route `/api/live` elle-même.
- Les canaux Slack, Discord, etc. restent des réglages **par utilisateur**, dans
  l'interface, pas dans l'environnement du serveur.

## Alternatives écartées

1. **Réécrire l'accès aux données sans Supabase** (Postgres direct, authentification
   maison) : refonte complète de l'authentification, des politiques RLS et des
   clients ; hors de proportion pour la valeur apportée.
2. **Embarquer toute la pile Supabase dans le Compose** : une dizaine de
   conteneurs à maintenir et à sécuriser ; Supabase fournit déjà un Compose
   officiel, et son offre cloud gratuite couvre les petits usages.
3. **Un déploiement Cloudflare guidé uniquement** : exige deux comptes tiers ;
   écarté comme voie principale, toujours possible grâce au Worker existant.
4. **Plusieurs réplicas** : le planificateur, le limiteur et le registre temps réel
   sont en mémoire ; un déploiement multi-instances demanderait un état partagé.

## Conséquences

- (+) Une installation en quelques commandes, sans compte Cloudflare, avec SMTP.
- (+) Le service hébergé et l'auto-hébergé évoluent ensemble (même code, mêmes
  migrations, mêmes tests).
- (−) Une instance unique en auto-hébergement ; la haute disponibilité passe par la
  base (Supabase) et le redémarrage du conteneur.
- (−) Deux points d'entrée à tester : le bootstrap Node (`node.ts`) n'est pas
  couvert par les tests unitaires, mais ses éléments le sont, et il a été validé
  de bout en bout (inscription, ping, durée, WebSocket, conteneur sain).
