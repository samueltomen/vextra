# Heartbeat et cycle d'incident

Date : 2026-10-24

## Parcours utilisateur

En tant qu'utilisateur, je veux appeler une URL fixe à la fin de mon script afin
que Vextra sache qu'il s'est exécuté, puis qu'il ouvre un incident uniquement
si la prochaine échéance passe sans nouveau heartbeat.

## Garanties

- `POST /api/ping` accepte uniquement `Authorization: Bearer` avec un token de
  43 caractères URL-safe ;
- aucun corps, paramètre de requête ou cookie n'est lu ou persisté ;
- le token est hashé en HMAC-SHA-256 avec le pepper serveur avant la RPC ;
- un token invalide et un token inconnu renvoient la même réponse `401` ;
- un heartbeat accepté renvoie `204` sans corps ;
- la RPC `record_heartbeat` met à jour l'état et résout l'incident ouvert dans
  la même transaction ;
- le checker revendique les moniteurs échus avec `FOR UPDATE SKIP LOCKED` ;
- au plus un incident reste ouvert par moniteur ;
- un second passage du checker ne crée aucun doublon ;
- les incidents sont isolés par tenant via RLS et les clients ne peuvent pas
  les insérer directement.

## Cycle TDD

```text
RED   : 091d2dd test: specify heartbeat ingestion and due checks
GREEN : fd9d91d feat(api): add heartbeat ingestion path
```

Les tests ont d'abord échoué sur les modules d'ingestion absents, puis les cas
unitaires ont été rendus verts avant l'ajout des RPC SQL et du handler planifié.

## Vérifications

```text
API : 96 tests
Contrats : 9 tests
Domaine : 11 tests
Web : 34 tests
pgTAP : 29 tests
Supabase db lint : aucun schéma en erreur
```

Parcours réel avec Supabase et le Worker locaux :

```text
signup=201 create=201 ping=204 status_after_ping=healthy
scheduler=200 status_after_check=late open_incidents=1
invalid_ping=401
```

## Limites connues

- les alertes e-mail et webhooks ne sont pas encore branchés ;
- la limitation de débit du heartbeat doit être configurée au niveau Cloudflare
  avant une exposition publique à fort trafic ;
- l'historique détaillé des incidents n'est pas encore affiché dans la SPA.
