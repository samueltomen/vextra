# Audit de sécurité avant mise en production

- **Date** : 2026-10-31
- **Périmètre** : base de données (migrations `20261024…` à `20261031240000`),
  API Hono (Workers et Node), interface, configuration de déploiement,
  dépendances.
- **Méthode** : revue du catalogue PostgreSQL, tests pgTAP, parcours de bout en
  bout contre une base locale (52 contrôles, dont des attaques directes sur
  PostgREST avec le JWT d'un utilisateur), tests de garde d'origine, analyse
  des dépendances et des secrets.

## Résultats corrigés

### 1. Droits de table excessifs du rôle `authenticated` — gravité moyenne

Le rôle `authenticated` conservait **tous les droits de table** (privilèges par
défaut de Supabase) sur 11 tables : seul `anon` avait été révoqué par les
migrations. Les `GRANT UPDATE (colonnes)` n'avaient donc aucun effet.

Un utilisateur peut se connecter directement à l'API d'authentification,
obtenir son JWT et appeler PostgREST. Il pouvait alors réécrire l'état de ses
propres moniteurs (`status`, `alert_at`, `total_pings`…), lire
`heartbeat_token_hash`, et disposait de `TRUNCATE` (non couvert par la RLS).
L'isolation entre espaces n'était **pas** atteinte : la RLS la garantissait.

**Correction** : migration `20261031230000`. Les droits correspondent à
l'intention documentée (colonnes), et les privilèges par défaut des futurs
objets sont retirés. Couvert par `privilege_hardening.sql` (12 assertions) et
par 8 attaques PostgREST dans le parcours de bout en bout.

### 2. Pages du site sans en-têtes de sécurité sur Cloudflare — gravité moyenne

Sur Cloudflare, le HTML et les assets étaient servis **sans CSP, sans
`X-Frame-Options` et sans `nosniff`** : seules les réponses `/api/*` en avaient.
Le tableau de bord pouvait être intégré dans un cadre (clic-jacking).

**Correction** : le build génère `dist/_headers` (CSP par hash des scripts en
ligne, `frame-ancestors 'none'`, `object-src 'none'`, HSTS, cache immuable des
assets). Le serveur Node reçoit aussi `object-src 'none'`. **À vérifier après
déploiement** (voir plus bas).

### 3. Clé d'API qui survit au départ de son créateur — gravité moyenne

Une clé appartient à l'espace, pas à la personne : un membre retiré gardait un
accès en lecture avec la clé qu'il avait créée.

**Correction** : migration `20261031240000`. Seul le propriétaire crée ou
révoque les clés ; erreur 403 explicite ; interface adaptée.

## Vérifié sans anomalie

- RLS activée sur toutes les tables publiques ; aucune politique permissive ;
  aucun droit de table pour `anon` ; fonctions réservées au service
  (`claim_*`, `authenticate_api_key`, `set_cron_deadline`…) fermées aux rôles
  clients ; toutes les fonctions `security definer` fixent `search_path`.
- Isolation inter-espaces : lecture, édition, clés d'API et page publique d'un
  autre espace testées (404 ou liste vide) ; adhésions non écrivables en direct.
- Lecture seule : écritures refusées par la base et par l'API (403
  `read_only`) pour les créations, éditions, pauses et invitations.
- Invitations : usage unique, expiration, adresse du compte requise, même
  réponse pour tout échec ; l'invitation d'un propriétaire est impossible.
- Garde d'origine : toutes les routes d'écriture refusent une origine étrangère
  **et** l'absence d'origine (15 routes, 2 cas chacune).
- Cookie de session : `__Host-`, `HttpOnly`, `Secure`, `SameSite=Strict`,
  chiffré (l'espace actif y est stocké et revérifié à chaque requête).
- Transfert de propriété à la suppression du compte du propriétaire, vérifié
  par la suppression réelle d'un utilisateur (pas seulement de l'adhésion).
- Page publique : aucun identifiant, jeton ni donnée d'espace dans la réponse ;
  badges SVG sans CSS ni script, texte échappé.
- Secrets : aucun motif de secret dans le dépôt, `.env*` ignorés, journaux
  limités à des codes et des compteurs. Aucune table dans la publication
  temps réel de Supabase, aucun en-tête CORS.
- Dépendances de production : 1 avis faible (`deepmerge`, via HeroUI, sans
  correctif publié).

## À faire côté configuration (hors code)

1. **Réactiver la confirmation d'e-mail dans Supabase Auth** (désactivée pendant
   la mise en place). Sans elle, n'importe qui crée un compte avec l'adresse de
   quelqu'un d'autre : les alertes partent vers une adresse non vérifiée et le
   contrôle d'adresse des invitations est affaibli. Resend étant opérationnel,
   l'activer ne bloque plus personne.
2. Activer la protection anti-abus de Supabase Auth (limites de débit, CAPTCHA
   à l'inscription) pour le service hébergé.
3. Passer `workers_dev` à `false` une fois le domaine personnalisé attaché
   (ADR 0001) pour ne garder qu'une origine.
4. Après `deploy:production`, vérifier : `curl -I https://<domaine>/` (CSP,
   `X-Frame-Options`) et `curl -I https://<domaine>/api/health`.

## Risques résiduels acceptés

- Faible : le même secret (`PING_TOKEN_PEPPER`) sert aux jetons de ping, aux clés
  d'API et aux invitations. Les formats préfixés (`vx_`, `vxi_`) évitent toute
  collision ; des secrets séparés seraient préférables à terme.
- Faible : une connexion temps réel déjà ouverte d'un membre retiré reçoit
  encore des signaux « quelque chose a changé » (sans donnée) jusqu'à sa
  reconnexion.
- Faible : pas de plafond explicite de taille de corps de requête côté API
  (limite de la plateforme : 100 Mo sur Workers).
- Information : les membres en lecture seule voient les adresses e-mail des
  autres membres de leur espace.
