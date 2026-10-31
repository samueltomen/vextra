# ADR 0006 — Mises à jour en direct par WebSocket

- **Statut** : Accepté
- **Date** : 2026-10-31

## Contexte

Après un `curl` de heartbeat, l'utilisateur devait recharger la page pour voir
le changement : l'interface interrogeait l'API toutes les 30 secondes. Le
navigateur ne détient volontairement aucun jeton Supabase (la session est un
cookie chiffré géré par le Worker, voir le README), ce qui exclut Supabase
Realtime depuis le navigateur.

## Décision

- Route `GET /api/live` : mise à niveau WebSocket, protégée par le cookie de
  session **et** par un contrôle strict de l'en-tête `Origin` (protection contre
  le détournement de WebSocket inter-sites).
- Un **Durable Object par espace** (`TenantLiveHub`, classe SQLite, API
  d'hibernation). Le Worker lui transmet le `tenant_id` de la session dans un
  en-tête interne toujours réécrit ; le client ne choisit jamais son espace.
- Tant qu'un client est connecté, le hub lit toutes les 2 secondes une
  **empreinte** de l'espace (état des moniteurs et des dernières notifications,
  requêtes filtrées par `tenant_id`). Si elle change, il envoie le seul message
  `changed`. Sans client, le sondage s'arrête.
- **Aucune donnée métier ne transite par le socket** : à réception, le navigateur
  invalide ses requêtes et recharge via l'API authentifiée habituelle.
- Reconnexion automatique avec délai croissant (1 s à 30 s), ping de maintien
  toutes les 25 s, et le rechargement toutes les 30 s reste en secours.
- Indicateur « En direct » / « Connexion… » / « Hors ligne » dans la barre
  latérale.

## Alternatives écartées

1. **Supabase Realtime depuis le navigateur** : exigerait d'exposer un JWT au
   navigateur, contraire au choix de session par cookie chiffré.
2. **Notifier depuis le ping et le cron** : demande de modifier
   `record_heartbeat` et `open_due_monitor_incidents` pour qu'elles renvoient
   l'espace concerné, fonctions critiques déjà modifiées plusieurs fois.
3. **Sondage rapide (5 s)** : plus simple mais charge la base et l'API pour
   chaque onglet, même sans changement.
4. **Server-Sent Events** : unidirectionnel (suffisant), mais un Worker qui garde
   une réponse ouverte est limité ; le Durable Object gère proprement
   l'hibernation.

## Conséquences

- (+) Un heartbeat ou un incident apparaît en 2 à 3 secondes, sans recharger.
- (+) Aucune modification des fonctions SQL critiques ni du chemin de ping.
- (−) Une requête SQL toutes les 2 secondes par espace tant qu'un onglet est
  ouvert ; l'empreinte est légère (au plus quelques dizaines de lignes).
- (−) Dépend des Durable Objects Cloudflare (classes SQLite, disponibles sur le
  plan gratuit) ; en local, `wrangler dev` les émule.
- (−) Le délai n'est pas instantané : il dépend de l'intervalle de sondage du hub.
