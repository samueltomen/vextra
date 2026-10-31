# ADR 0007 — Personnalisation de la configuration

- **Statut** : Accepté
- **Date** : 2026-10-31

## Contexte

Le nom d'un moniteur n'existait que dans le navigateur (stockage local) : il
disparaissait sur un autre appareil et n'apparaissait pas dans les e-mails
d'alerte. Les réglages ne permettaient de choisir ni l'affichage, ni les valeurs
proposées à la création d'un moniteur, ni de couper les alertes d'un seul
moniteur.

## Décision

**Moniteur** (colonnes ajoutées à `monitors`, droits de mise à jour limités) :

- `name` (80 caractères), `description` (200), `notes` (2000) : stockés côté
  serveur, contraintes `check` en base, aucun secret attendu. Le nom affiché est
  le nom serveur, sinon le libellé local historique, sinon un identifiant court.
- `alerts_enabled` : quand il est faux, `claim_notification_deliveries` marque
  les envois `skipped` (`monitor_muted`) ; l'incident reste enregistré.
- Le nom est transmis aux e-mails (échappé dans le HTML).
- API : `PATCH /api/monitors/:id/details` (objet strict, mise à jour partielle).
- **Clonage** : lien vers la création pré-remplie (fréquence, marge, nom), sans
  copier le token.

**Préférences** (colonnes ajoutées à `account_preferences`, synchronisées entre
appareils) :

- Affichage : format de l'heure (12 h/24 h), densité (compacte/confortable), vue
  et tri par défaut du dashboard.
- Valeurs par défaut des nouveaux moniteurs : fréquence, marge, dossier. Le
  dossier est contraint au même espace par clé étrangère composite.
- Le tri et la vue choisis explicitement dans le dashboard restent prioritaires
  sur ces valeurs par défaut.

`claim_notification_deliveries` est recréée (nouvelle colonne `monitor_name`) :
suppression puis création, avec les mêmes droits (`service_role` uniquement).

## Alternatives écartées

1. **Garder le nom en stockage local** : non partagé, absent des e-mails.
2. **Table séparée pour les détails** : une jointure de plus à chaque lecture de
   la liste, pour quelques colonnes.
3. **Préférences d'affichage en stockage local** : perdues d'un appareil à
   l'autre, alors que les autres préférences sont déjà côté serveur.

## Conséquences

- (+) Un nom, une description et des notes disponibles partout, dont les alertes.
- (+) Alertes réglables par moniteur sans toucher aux préférences globales.
- (−) Les colonnes de texte libre sont affichées telles quelles par l'interface
  (React échappe) et échappées dans les e-mails ; pas de mise en forme riche.
- (−) Le nom d'un moniteur est visible de tout membre de l'espace.
