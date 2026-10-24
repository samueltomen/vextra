# Cycle de vie et historique d'incidents

Date : 2026-10-24

## Parcours

En tant qu'utilisateur, je veux mettre en pause, reprendre ou supprimer un
moniteur, et consulter ses incidents résolus ou en cours, sans jamais quitter
mon tenant.

## Garanties

- pause, reprise et suppression sont des RPC `security definer` réservées aux
  membres authentifiés du tenant ;
- une pause ferme l'incident ouvert et une reprise recalcule une échéance ;
- une suppression cascade l'historique des incidents ;
- les endpoints renvoient `204` quand l'action aboutit et `404` sinon ;
- l'historique d'incidents est filtré par RLS ;
- les réponses n'exposent ni token, ni contenu d'exécution, ni libellé serveur.

## Cycle TDD

```text
RED : 13d10ef test: specify monitor lifecycle and incidents
```

La mise au vert couvre les use cases, les routes HTTP, les adapters Supabase,
le frontend et les RPC SQL.

## Vérifications

```text
API : 102 tests
Web : 37 tests
Contrats : 9 tests
Domaine : 11 tests
pgTAP : 36 tests
Supabase db lint : aucun schéma en erreur
```

Les actions de pause/reprise et de suppression sont confirmées dans l'UI ; la
suppression exige une confirmation explicite.
