# Outbox de notifications e-mail

Date : 2026-10-24

## Parcours

En tant qu'utilisateur, je veux recevoir un e-mail lorsqu'un incident s'ouvre ou
se résout, avec des retries fiables et sans dupliquer les alertes.

## Garanties

- l'ouverture et la résolution d'incident écrivent l'événement dans la même
  transaction ;
- chaque incident possède au plus une livraison ouverte et une livraison de
  reprise grâce à une clé d'idempotence unique ;
- l'outbox ne stocke jamais l'adresse e-mail ;
- le claim résout l'adresse depuis le compte propriétaire et est réservé au
  service-role ;
- les livraisons sont traitées par lots bornés avec `SKIP LOCKED` ;
- une erreur fournisseur devient `failed`, puis `dead` après cinq tentatives ;
- les e-mails contiennent seulement l'identifiant opaque du moniteur et le type
  d'événement ;
- sans configuration Resend, aucune requête externe n'est tentée et l'outbox
  reste en attente.

## Cycle TDD

```text
RED : ecfbfed test: specify notification delivery outbox
```

## Vérifications

```text
API : 122 tests
Web : 42 tests
Contrats : 13 tests
Domaine : 11 tests
pgTAP : 50 tests
Supabase db lint : aucun schéma en erreur
```

## Limites connues

- Discord et Telegram restent à ajouter ;
- le rendu de l'e-mail est volontairement textuel et minimal ;
- les métriques de profondeur d'outbox et le replay opérateur restent à
  instrumenter.
