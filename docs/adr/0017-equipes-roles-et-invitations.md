# ADR 0017 — Équipes, rôles et invitations

- **Statut** : Accepté
- **Date** : 2026-10-31

## Contexte

Un espace n'avait qu'un utilisateur. Les équipes veulent partager leurs
moniteurs avec des collègues, certains en consultation seule. L'isolation par
espace (`tenant_id`) reste l'exigence de sécurité centrale ; l'ajout de rôles ne
doit pas créer de chemin d'écriture non contrôlé.

## Décision

- **Trois rôles** : `owner` (un seul par espace : gère l'équipe et reçoit les
  alertes), `member` (modifie tout sauf l'équipe), `viewer` (lecture seule).
  L'ancien rôle `admin`, jamais utilisé, devient `member`.
- **Lecture seule imposée par la base**, pas par l'interface : toutes les
  politiques RLS d'écriture et les six fonctions SQL de moniteurs passent de
  `is_tenant_member` à `can_write_tenant` (migration générique sur le catalogue,
  vérifiée par pgTAP). Les lectures restent ouvertes à tous les rôles.
- **Garde HTTP complémentaire** : un `viewer` reçoit `403 read_only` sur toute
  méthode non sûre des routes de données, avant le handler (messages clairs).
  Exemptés : authentification, suppression de compte, pings, et les routes
  d'équipe (quitter un espace, accepter une invitation). La session est
  résolue une seule fois par requête (évite une double rotation du jeton de
  rafraîchissement).
- **Invitation par lien à usage unique** : `vxi_` + 32 octets, condensat HMAC
  stocké, expiration 7 jours, 20 invitations en attente par espace. L'adresse
  invitée doit être **celle d'un compte confirmé** ; le lien seul ne suffit pas,
  et tout échec renvoie la même réponse (inconnu, expiré, utilisé, autre
  adresse). Le propriétaire ne peut pas inviter un autre propriétaire.
- **Pas d'envoi d'e-mail pour l'instant** : le propriétaire copie le lien et le
  transmet. L'envoi par Resend/SMTP viendra avec un gabarit dédié.
- **Espace actif** : un utilisateur peut appartenir à plusieurs espaces. L'espace
  choisi est stocké dans le cookie de session chiffré et **revérifié contre les
  appartenances à chaque requête** ; un identifiant non reconnu retombe sur
  l'espace le plus ancien. `POST /api/auth/tenant` refuse (403) un espace dont
  l'utilisateur n'est pas membre. Le canal temps réel se reconnecte au
  changement d'espace.
- **Continuité** : si le propriétaire quitte un espace partagé (suppression de
  compte), le membre le plus ancien en devient propriétaire ; un espace sans
  aucun membre est supprimé.
- **Gestion** : fonctions SQL `list_tenant_members`, `set_member_role`,
  `remove_tenant_member`, `list_my_tenants`. Le propriétaire change le rôle ou
  retire ; tout non-propriétaire peut quitter l'espace.

## Alternatives écartées

- **Restriction uniquement dans l'API** : une route oubliée donnerait un accès
  en écriture ; la RLS est la dernière garde.
- **Choix d'espace dans un cookie en clair** : falsifiable ; stocké dans la
  charge chiffrée et revalidé.
- **Invitation sans vérification d'adresse** : quiconque obtiendrait le lien
  rejoindrait l'espace.

## Conséquences

- Les alertes et rapports partent vers le propriétaire de l'espace, pas vers
  chaque membre (à revoir avec les préférences par membre).
- Un lien d'invitation divulgué est inutilisable sans le compte de l'adresse
  visée, et se révoque depuis les réglages.
- Les jetons de clés d'API et le heartbeat restent liés à l'espace, pas à la
  personne qui les a créés.
