# ADR 0001 — Déploiement du web et de l'API sur une même origine

- **Statut** : Accepté
- **Date** : 2026-10-31

## Contexte

- Le web (SPA Vite) appelle l'API avec des chemins relatifs (`/api/...`) et
  `credentials: 'include'`. En développement, le proxy Vite rend ces appels
  même-origine.
- La session repose sur des cookies `httpOnly`, `Secure`, `SameSite=Strict`.
- L'API n'expose aucun CORS. Sa garde d'origine (`origin-guard.ts`) rejette
  toute requête mutante dont l'en-tête `Origin` diffère de `APP_ORIGIN`.
- `wrangler.toml` prévoit `workers_dev = true`, ce qui donnerait à l'API un
  domaine `*.workers.dev` distinct de celui du web.

Avec deux domaines distincts en production (par exemple `*.pages.dev` et
`*.workers.dev`), les cookies `SameSite=Strict` ne seraient pas envoyés aux
appels cross-site : la connexion échouerait.

## Décision

Servir le web et l'API **sous une seule origine** (`https://app.<domaine>`) :

- le SPA est servi en assets statiques sur ce domaine ;
- une route Cloudflare `app.<domaine>/api/*` dirige vers le Worker `cronping-api` ;
- `APP_ORIGIN` vaut cette origine ; `VITE_API_URL` n'est pas utilisé en
  production ;
- `workers_dev` passe à `false` en production afin de ne pas exposer une
  seconde origine.

Aucun CORS n'est ajouté. Cookies `Strict` et garde d'origine restent inchangés.

## Alternatives écartées

1. **Origines distinctes + CORS + cookies `SameSite=None`** : affaiblit la
   protection CSRF (la garde d'origine devient la seule défense), exige une
   liste d'origines et des préflights, et dégrade la latence.
2. **Sous-domaines frère (`app.` et `api.`) avec cookie `Domain=.<domaine>`** :
   les cookies `Strict` fonctionnent (même site) mais le cookie est exposé à
   tous les sous-domaines, et CORS reste nécessaire. Complexité sans gain.
3. **Jetons en `Authorization` stockés côté navigateur** : expose la session
   au XSS, contraire au choix actuel de cookies `httpOnly`.

## Conséquences

- (+) Surface CSRF et XSS minimale, aucun changement de code d'authentification.
- (+) Pas de préflight CORS, donc moins de latence.
- (−) Dépendance à un domaine personnalisé sur Cloudflare (zone gérée chez
  Cloudflare).
- (−) Les previews de branche doivent aussi suivre ce schéma (un domaine de
  preview par branche, ou pas de preview authentifiée).
- À faire : configurer `infra/` (routes, domaine), un pipeline CI de
  déploiement et la section « Déploiement » du `README.md`.
