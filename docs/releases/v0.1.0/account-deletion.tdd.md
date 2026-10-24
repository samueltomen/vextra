# Paramètres et suppression de compte

Date : 2026-10-24

## Parcours

En tant qu'utilisateur, je veux consulter mon compte, accéder aux notifications
e-mail et supprimer définitivement mon compte avec une confirmation explicite.

## Garanties

- `DELETE /api/account` supprime uniquement l'utilisateur de la session ;
- aucun `user_id` client n'est accepté ;
- l'appel admin Supabase utilise exclusivement le service-role côté Worker ;
- le cookie est effacé après succès ;
- les erreurs fournisseur sont génériques ;
- le membership supprimé déclenche la suppression du tenant vide ;
- moniteurs, incidents et outbox sont supprimés en cascade ;
- la suppression exige la saisie exacte de `SUPPRIMER`.

## Cycle TDD

```text
RED : 25b9a2b test: specify account deletion
```

## Vérifications

```text
API : tests de suppression de compte
Web : tests Réglages et confirmation forte
pgTAP : 56 tests
Supabase db lint : aucun schéma en erreur
```

## Limite connue

La suppression est immédiate et ne propose pas encore de période de récupération.
