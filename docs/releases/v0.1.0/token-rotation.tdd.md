# Rotation du token de heartbeat

Date : 2026-10-24

## Parcours

En tant qu'utilisateur, je veux remplacer le token d'un moniteur afin
d'invalider immédiatement un secret potentiellement exposé.

## Garanties

- le nouveau token est généré cryptographiquement côté Worker ;
- seul son HMAC et son préfixe sont transmis à Supabase ;
- l'ancien hash ne peut plus enregistrer de heartbeat après rotation ;
- la RPC vérifie l'appartenance au tenant avant toute modification ;
- le token brut est renvoyé une seule fois dans la réponse puis uniquement
  conservé en mémoire de la page ;
- un moniteur absent ou étranger renvoie `404`.

## Cycle TDD

```text
RED : 928ff3a test: specify heartbeat token rotation
```

## Vérifications

```text
API : 112 tests
Web : 40 tests
Contrats : 13 tests
Domaine : 11 tests
pgTAP : 41 tests
Supabase db lint : aucun schéma en erreur
```

Le bouton « Renouveler le token » affiche le nouveau secret dans un encart
temporaire et rappelle que l'ancien token est immédiatement invalide.
