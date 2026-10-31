# Interface de monitoring connectée

Date : 2026-10-24

## Comportement livré

- redirection vers `/login` lorsqu'aucune session n'est active ;
- connexion et inscription accessibles avec labels, erreurs associées et
  attributs `autoComplete` adaptés ;
- dashboard alimenté par `GET /api/monitors` ;
- détail alimenté par `GET /api/monitors/:monitorId` ;
- création réelle par `POST /api/monitors`, puis affichage unique du token ;
- libellés conservés exclusivement dans `localStorage` sous
  `vextra.monitor-labels.v1` ;
- déconnexion avec suppression du cache de session et des moniteurs ;
- états chargement, vide, erreur, session indisponible et monitor introuvable ;
- adaptation mobile sans composant Bootstrap et sans second kit UI.

## Vérifications

```text
Contrats : 9 tests
Domaine : 11 tests
API : 76 tests
Web : 34 tests
Web : 87,45 % statements, 84,02 % branches
```

Un parcours réel a été exécuté avec Supabase et le Worker locaux :

1. connexion avec un compte Supabase ;
2. dashboard vide ;
3. création persistée d'un moniteur ;
4. affichage du token une seule fois ;
5. ouverture du détail depuis la liste ;
6. vérification desktop à 1440 px et mobile à 390 px.

Le dashboard et le détail utilisent le même contenu de libellé local, tandis
que la requête réseau ne contient que `intervalSeconds` et `graceSeconds`.
