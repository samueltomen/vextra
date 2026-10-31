# ADR 0016 — Clés d'API en lecture seule

- **Statut** : Accepté
- **Date** : 2026-10-31

## Contexte

Les utilisateurs veulent consulter l'état de leurs moniteurs depuis un script,
un tableau de bord interne ou un outil tiers, sans passer par une session
navigateur. Le point d'entrée existant repose sur un cookie de session chiffré
et sur un client Supabase qui porte le jeton de l'utilisateur : un script n'a ni
l'un ni l'autre.

## Décision

- **Lecture seule d'abord** : `GET /api/v1/monitors` et
  `GET /api/v1/monitors/:id`. Les écritures (pause, création) exigeraient de
  réécrire les fonctions SQL qui s'appuient sur l'identité de l'utilisateur ;
  elles feront l'objet d'une décision séparée.
- **Format** : `vx_` + 32 octets aléatoires en base64url (43 caractères). Le
  secret n'est montré qu'à la création. Seuls le préfixe (10 caractères,
  affiché pour reconnaître la clé) et un **condensat HMAC-SHA-256** (même secret
  que les jetons de heartbeat) sont stockés.
- **Table `api_keys`** : RLS par appartenance à l'espace ; la colonne
  `key_hash` n'est ni lisible ni modifiable côté client (droits de colonne :
  insertion seule). La révocation met à jour `revoked_at` (traçabilité) ;
  10 clés actives maximum par espace.
- **Authentification** : `authenticate_api_key(hash)` est réservée au rôle
  service ; elle renvoie le tenant d'une clé non révoquée et note l'usage au
  plus une fois par minute. Le tenant provient de la clé, jamais de la requête.
- **Isolation** : les requêtes de lecture utilisent le client service avec le
  filtre `tenant_id` explicite du dépôt de requêtes (déjà testé), puisque la RLS
  ne peut pas s'appliquer sans identité utilisateur.
- **Surface** : le bearer est seul accepté sur `/api/v1/*` (un cookie ne donne
  aucun droit), pas de contrôle d'origine (aucun cookie), limitation de débit
  par IP identique à celle des pings.
- **Interface** : carte « Clés d'API » dans les réglages (création avec
  affichage unique, copie, exemple `curl`, révocation).

## Alternatives écartées

- **Jeton JWT Supabase de longue durée** : expose le projet, difficile à
  révoquer individuellement.
- **Réutiliser le jeton de heartbeat** : il est conçu pour écrire des pings et
  son compromis ne doit pas donner accès à la lecture de l'espace.

## Conséquences

- Un secret divulgué se révoque sans toucher aux autres clés ni aux sessions.
- Le client service ne sert qu'à deux lectures filtrées par le tenant de la clé ;
  tout nouvel endpoint v1 devra passer par un dépôt qui filtre explicitement.
- Les tests pgTAP vérifient que le condensat est illisible côté client, que
  l'authentification est fermée aux rôles non service et que la révocation est
  immédiate.
