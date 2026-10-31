# ADR 0002 — Limitation de débit des routes publiques

- **Statut** : Accepté
- **Date** : 2026-10-31

## Contexte

Trois routes sont atteignables sans session : `POST /api/auth/login`,
`POST /api/auth/signup` et `POST /api/ping`. Les deux premières exposent à la
force brute et à la création de comptes en masse. La troisième est le point
d'entrée des heartbeats : chaque requête, même avec un faux jeton, coûte un
appel à la base.

## Décision

Utiliser le binding **Workers Rate Limiting** de Cloudflare, derrière un port
`RateLimiter` (`apps/api/src/rate-limit/`) :

- `AUTH_RATE_LIMITER` : 10 requêtes / 60 s par IP, sur login et signup ;
- `PING_RATE_LIMITER` : 120 requêtes / 60 s par IP, sur le ping ;
- clé = `scope:IP` (`cf-connecting-ip`), `unknown` si absente ;
- réponse `429` avec `Retry-After: 60` ;
- **échec ouvert** : si le binding est absent ou en erreur, la requête passe,
  afin de ne jamais rejeter un heartbeat légitime ;
- seules les requêtes `POST` sont comptées.

## Alternatives écartées

1. **Règles WAF Cloudflare** : aucune écriture de code, mais configuration hors
   dépôt et non testable. À ajouter en complément si besoin.
2. **Compteur en base Supabase** : précis, mais une écriture par requête ajoute
   latence et charge à la base.

## Conséquences

- (+) Testé en TypeScript, indépendant de Cloudflare grâce au port.
- (−) Compteurs approximatifs par datacenter, pas exacts globalement.
- (−) Limite par IP : plusieurs clients derrière une même IP (NAT d'entreprise)
  partagent le quota. Le seuil du ping est volontairement très haut.
- (−) Pas de limite par e-mail sur le login pour l'instant.
- Les `namespace_id` de `wrangler.toml` sont propres au compte Cloudflare ; ne
  pas les réutiliser entre projets.
