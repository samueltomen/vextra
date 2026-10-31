# Authentification et session sécurisée

Date : 2026-10-24

## Comportement livré

- inscription et connexion par e-mail avec validation stricte des entrées ;
- création automatique d'un tenant personnel et d'un rôle `owner` à
  l'inscription ;
- session Supabase chiffrée avec AES-GCM dans un cookie
  `__Host-vextra_session` ;
- cookie `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, sans domaine ;
- aucun JWT Supabase renvoyé au navigateur ou stocké dans `localStorage` ;
- renouvellement de session avant expiration et rotation du cookie ;
- vérification exacte de l'origine sur les mutations dashboard authentifiées
  par cookie, sans bloquer le futur heartbeat sans `Origin` ;
- révocation de la session Supabase au logout, avec suppression locale même en
  cas d'échec distant ;
- réponse générique pour les erreurs d'authentification et aucun token dans
  les logs ;
- création de moniteur avec un client Supabase lié au JWT utilisateur, donc
  contrôlée par RLS et sans `tenant_id` fourni par le client.

## Tests ajoutés

- contrats Zod des identifiants et réponses, sans champ de token ;
- codec AES-GCM : chiffrement, intégrité et entrées malformées ;
- service de compte : connexion, inscription, refresh, révocation et échecs ;
- gateway Supabase : normalisation des erreurs et résolution du tenant ;
- routes HTTP : cookie durci, réponses génériques, logout et validation ;
- composition root et entrée Worker ;
- pgTAP : provisionnement du tenant, isolation entre deux utilisateurs et
  impossibilité d'exécuter la fonction `security definer`.

## Résultats

```text
API : 65 tests passés, 92,12 % statements, 86,72 % branches
Contrats : 7 tests passés
Domaine : 11 tests passés
Web : 17 tests passés
pgTAP : 14 tests passés
Supabase db lint : aucun schéma en erreur
```

Test de fumée contre Supabase et Worker locaux :

```text
POST /api/auth/signup  201
GET  /api/auth/me      200
POST /api/monitors     201
```

Le log du Worker ne contient ni cookie, ni JWT, ni token de heartbeat.
