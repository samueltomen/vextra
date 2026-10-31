# Vextra - Plan de construction du MVP

Statut : proposition à valider  
Date : 2026-10-24  
Mode : dépôt Git existant, branche `main`, remote `origin/main`
Objectif : livrer un SaaS multi-tenant permettant de détecter l'absence
d'exécution d'un script cron et d'alerter son propriétaire.

## 1. Périmètre et promesse produit

Vextra est un service de heartbeat pour tâches planifiées. L'utilisateur crée
un moniteur, ajoute un appel HTTP à la fin de son script, puis Vextra ouvre un
incident et alerte si aucun heartbeat n'est reçu dans la fenêtre attendue.

Le MVP doit permettre de :

- créer un compte et un espace de travail personnel ;
- créer un moniteur avec un nom, une fréquence attendue, une marge et un canal
  de notification ;
- copier une commande `curl` utilisant un token stocké dans le gestionnaire de
  secrets du serveur, jamais dans la commande elle-même ;
- recevoir un heartbeat sans authentification interactive et sans contenu ;
- détecter un moniteur en retard avec au plus 60 secondes de retard sur sa
  deadline ;
- envoyer une alerte par e-mail et notifier la reprise après retour du
  heartbeat ;
- consulter l'état courant et l'historique des incidents ;
- mettre en pause, réactiver, supprimer et faire tourner le secret d'un
  moniteur ;
- supprimer son compte et purger les données associées selon une politique
  documentée.

Le MVP ne doit pas inclure :

- l'exécution de scripts ou l'accès aux serveurs des utilisateurs ;
- la réception ou la conservation du script, de sa commande, de sa configuration
  ou de ses sorties ;
- les expressions cron calendaires complexes ;
- les SMS, appels téléphoniques et escalades on-call ;
- les organisations multi-utilisateurs avancées, la facturation et les quotas
  commerciaux ;
- une page de statut publique ;
- des webhooks arbitraires. Discord et Telegram seront des intégrations
  explicites pour éviter les risques SSRF.

### Minimisation des données

Vextra est un dead man's switch, pas un ordonnanceur de tâches. Il ne reçoit
jamais le cron, le code du script, la commande exécutée ou son résultat. Le
heartbeat ne transporte aucun contenu métier : il signale uniquement qu'une
exécution est arrivée.

Ne doivent jamais être acceptés comme données métier, indexés ou persistés :

- le contenu d'un script ou d'un fichier crontab ;
- une expression cron, une commande, des arguments ou des variables
  d'environnement ;
- `stdout`, `stderr`, un code de sortie, une stack trace ou des logs ;
- un nom de serveur, un chemin de fichier, une adresse interne ou une
  credential ;
- le corps, les paramètres de requête ou les en-têtes personnalisés du
  heartbeat ;
- l'IP ou le user-agent du heartbeat dans les données applicatives et les logs.

L'infrastructure réseau traite nécessairement la connexion entrante. Une IP
peut être utilisée de façon éphémère pour le rate limiting avec une durée de
vie très courte, mais elle ne doit être ni enregistrée dans les tables
applicatives ni écrite dans les logs ; si le fournisseur ne permet pas de
garantir cette minimisation, le mécanisme de limitation doit être revu.

Seules les données strictement nécessaires au fonctionnement sont conservées :

- l'identifiant du compte et l'e-mail nécessaire à l'authentification ;
- l'appartenance à un tenant et le rôle associé ;
- l'identifiant de session haché et le matériel d'authentification chiffré
  nécessaire au renouvellement de session ;
- l'identifiant opaque du moniteur ; le libellé convivial reste local au
  navigateur ;
- l'intervalle, la marge, la deadline, le dernier heartbeat et l'état courant ;
- le HMAC du token de ping, jamais le token complet ;
- le type et la destination chiffrée du canal de notification ;
- les incidents et les livraisons nécessaires à la déduplication, aux retries
  et au support opérationnel.

La promesse produit doit donc être formulée comme « aucune donnée sur le
contenu ou l'infrastructure des jobs », et non comme « zéro donnée » :
l'e-mail de compte et la destination de notification sont des données
personnelles indispensables au service. Elles restent chiffrées ou protégées
selon leur nature, ne sont jamais utilisées pour l'analytics et sont supprimées
avec le compte.

Le libellé choisi par l'utilisateur, par exemple « Backup DB », reste par défaut
dans le stockage local du navigateur et n'est pas envoyé à l'API. Le serveur ne
connaît qu'un identifiant opaque. Les notifications utilisent cet identifiant
court ; partager ou synchroniser un libellé entre appareils serait une option
explicite ultérieure, pas un comportement par défaut.

L'historique brut des heartbeats n'est pas conservé. L'état courant et les
transitions d'incident suffisent à détecter un silence, éviter les alertes
dupliquées et afficher le statut. L'intervalle et la marge sont uniquement des
paramètres relatifs de détection ; ils ne décrivent ni la cron ni son heure
exacte.

### Modèle de menace et garanties

Les actifs à protéger sont :

- le token de heartbeat, qui permet de maintenir un moniteur artificiellement
  sain s'il est compromis ;
- la session du dashboard et les droits du tenant ;
- l'e-mail du compte et les secrets de routage Discord ou Telegram ;
- les métadonnées de statut et de cadence des moniteurs.

Les menaces prises en compte sont la fuite d'une base ou d'une sauvegarde, un
log applicatif ou fournisseur trop verbeux, une injection XSS, un accès
inter-tenant, le vol d'un token de heartbeat et l'exposition d'un secret via
une variable frontend.

Le plan garantit que :

- aucun contenu d'exécution n'existe côté serveur, même en cas de compromission
  de la base ;
- le token brut n'est jamais stocké et n'apparaît pas dans les logs ;
- les secrets de notification sont chiffrés au repos ;
- la session dashboard n'est pas stockée dans `localStorage` ;
- aucun historique brut de heartbeat n'est conservé ;
- les politiques RLS et les tests inter-tenant empêchent un accès croisé.

Le plan ne peut pas garantir la confidentialité absolue du trafic : le
fournisseur réseau voit la connexion entrante et peut traiter l'IP brièvement
pour la protection anti-abus. Il peut aussi déduire une cadence approximative
depuis les dates de heartbeat. Un token volé peut produire de faux heartbeats.
La rotation immédiate du token et un endpoint fixe sans secret dans l'URL
réduisent ce risque.

## 2. Contraintes mesurables

Ces cibles sont des objectifs de pilote, pas des garanties de production :

| Domaine                | Cible                                                                |
| ---------------------- | -------------------------------------------------------------------- |
| Création d'un moniteur | moins de 30 secondes de la connexion à la commande copiée            |
| Heartbeat              | disponibilité 99,5 %, p95 sous 300 ms hors rate limit                |
| Détection              | au plus 60 secondes après `deadline + grace`                         |
| Première notification  | p95 sous 60 secondes après détection                                 |
| Isolation              | zéro accès ou écriture inter-tenant dans les tests et politiques RLS |
| Fiabilité              | aucun doublon d'incident ouvert ou d'alerte pour un même épisode     |
| Charge pilote          | 100 tenants, 1 000 moniteurs, fréquence moyenne de 5 minutes         |
| Coût pilote            | mesurer coût fixe et coût par million de heartbeats                  |

Le checker toutes les 15 minutes ne respecte pas cette cible. Il faut un
checker au moins toutes les minutes, ou documenter un SLA dégradé et imposer une
fréquence minimale cohérente aux moniteurs.

### Réalisme du délai d'un jour

Une démonstration fonctionnelle est réalisable en une journée si l'on accepte :

- un seul canal e-mail ;
- un checker déclenché manuellement ou par un scheduler déjà disponible ;
- des tests limités au parcours nominal ;
- aucune facturation, aucun historique riche et aucune reprise automatique
  complète.

Trajectoire indicative de cette démo, sans marge de sécurité :

| Créneau     | Livrable                                                               |
| ----------- | ---------------------------------------------------------------------- |
| 09:00-10:00 | choix rapide du scheduler, initialisation et variables d'environnement |
| 10:00-12:00 | Supabase Auth, schéma minimal, RLS de base et premier tenant           |
| 12:00-13:30 | création d'un moniteur, token et snippet `curl`                        |
| 13:30-15:00 | route de ping et mise à jour de l'état                                 |
| 15:00-16:30 | checker manuel, incident et e-mail Resend                              |
| 16:30-18:00 | déploiement, test avec un vrai cron et corrections nominales           |

Un MVP fiable avec isolation tenant, incidents, outbox, retries, session
sécurisée, chiffrement et déploiement demande plutôt 5 à 7 jours d'ingénierie.
Une V1 commercialisable avec facturation, quotas, Discord, Telegram et
observabilité demande environ 2 à 3 semaines.

## 3. Stack de référence proposée

La stack reste soumise aux ADR et doit être validée avant installation :

- frontend : React avec TypeScript strict et Vite ;
- routing : TanStack Router en mode SPA, avec routes typées et chargement
  différé ;
- données client : TanStack Query pour l'état serveur, les caches, les
  mutations et les invalidations ;
- formulaires : TanStack Form avec schémas Zod partagés ;
- tableaux : TanStack Table uniquement si le dashboard nécessite tri,
  filtrage ou pagination côté client ;
- UI : HeroUI et Tailwind CSS ; Bootstrap et ses variantes sont interdits ;
- base et authentification : Supabase Postgres et Supabase Auth ;
- migrations : Supabase CLI, schéma versionné et types TypeScript générés ;
- API : Hono déployé sur Cloudflare Workers, avec un handler HTTP et un
  handler planifié ;
- e-mail : Resend ;
- intégrations : adaptateurs Discord et Telegram ;
- tests : Vitest et React Testing Library pour le frontend et le domaine,
  tests d'intégration Postgres/RLS pour l'API, Playwright pour les parcours
  critiques ;
- paquets : `pnpm` avec lockfile versionné ;
- hébergement frontend : `dist/` servi comme site statique, avec fallback SPA
  vers `index.html` ;
- scheduler : Cloudflare Cron Trigger toutes les minutes, sous réserve de
  validation des limites du compte et du plan au moment de l'implémentation.

TanStack désigne ici Router, Query et Form, pas TanStack Start. Le frontend
reste une SPA statique et toute la logique serveur vit dans l'API Hono. Si
TanStack Start était réellement souhaité, ce choix devrait remplacer l'API Hono
et faire l'objet d'un autre ADR.

Les secrets ne doivent jamais utiliser le préfixe `VITE_`. La SPA ne reçoit que
`VITE_API_URL` et ne contacte jamais Supabase directement. La clé service
Supabase, la clé Resend, le secret HMAC, la clé de chiffrement des canaux et les
webhooks restent côté Worker.

## 4. Architecture cible

Le produit reste un monolithe modulaire backend avec deux artefacts de
déploiement : une SPA statique et une API Worker. Le dépôt est organisé en
workspace `pnpm` pour partager les contrats sans importer de code serveur dans
le navigateur :

```text
apps/
  web/
    src/
      routes/__root.tsx
      routes/login.tsx
      routes/_authenticated.tsx
      routes/_authenticated/index.tsx
      routes/_authenticated/monitors/$monitorId.tsx
      features/{accounts,monitoring,notifications}/
      api/client.ts
      query/query-client.ts
      main.tsx
  api/
    src/
      routes/ping.ts
      routes/monitors.ts
      routes/internal.ts
      features/{accounts,monitoring,notifications}/
      worker.ts
packages/
  domain/
  contracts/
supabase/migrations/
tests/{integration,e2e}
docs/adr
infra
scripts
```

Les packages du workspace sont nommés `@vextra/web`, `@vextra/api`,
`@vextra/domain` et `@vextra/contracts`.

Le domaine `monitoring` contient les règles de calcul de deadline et les
transitions `pending -> healthy -> late -> healthy`. Il ne connaît ni Supabase,
ni HTTP, ni React. `packages/domain` ne dépend d'aucun package d'infrastructure.
L'API appelle les cas d'usage ; ses adapters implémentent les ports de
persistance et de notification.

Le frontend utilise TanStack Router pour les routes et les gardes
d'authentification, TanStack Query pour les données serveur et TanStack Form
pour les mutations. Une garde de route améliore l'expérience utilisateur mais
n'est jamais une frontière de sécurité : l'API valide la session à chaque
requête et RLS protège les données.

La SPA ne manipule pas directement les tokens Supabase. L'API expose les routes
d'authentification et établit une session chiffrée et signée, exposée au
navigateur uniquement via un cookie `__Host-vextra_session` `HttpOnly`,
`Secure` et `SameSite=Strict`. Elle utilise ensuite le JWT Supabase
correspondant côté serveur pour les requêtes dashboard. Les mutations
authentifiées par cookie nécessitent en plus une protection CSRF et une
validation d'origine.

Les endpoints dashboard utilisent un client Supabase lié à la session
utilisateur afin que RLS s'applique. Le client à clé service est isolé dans les
cas d'usage de ping et de checker, qui passent par des RPC minimales ; il ne
doit jamais servir les lectures générales du dashboard.

### Flux nominal

1. La SPA envoie une mutation TanStack Query à l'API avec son cookie de
   session ; l'API vérifie la session, l'appartenance au tenant et crée le
   moniteur.
2. L'API génère un secret aléatoire d'au moins 256 bits. Le secret complet est
   affiché une seule fois ; seul son HMAC-SHA-256 est stocké avec un préfixe
   non secret pour l'identification.
3. Le script appelle l'endpoint fixe `POST /api/ping` avec le token dans un
   header `Authorization: Bearer`, et non dans l'URL.
4. La route Hono réalise en transaction : validation du token, mise à jour de
   `last_ping_at` et `alert_at`, résolution de l'incident ouvert et écriture
   d'un événement de reprise.
5. Cloudflare Cron invoque directement le handler planifié du Worker. Celui-ci
   appelle une fonction SQL atomique qui sélectionne et réserve les moniteurs
   échus avec `FOR UPDATE SKIP LOCKED`, ouvre au plus un incident par moniteur
   et ajoute une notification dans l'outbox.
6. Le même handler planifié traite l'outbox, envoie l'e-mail, enregistre le
   résultat et programme un retry avec backoff en cas d'échec.

Le checker et le worker de livraison ne dépendent donc pas d'une route HTTP
publique et ne dépendent pas d'un heartbeat utilisateur pour s'exécuter.

### Source de temps et sémantique d'échéance

Le MVP surveille une fréquence attendue, pas une heure calendaire stricte :

- `interval_seconds` : fréquence attendue du heartbeat ;
- `grace_seconds` : tolérance après la deadline ;
- `alert_at = dernier heartbeat + interval_seconds + grace_seconds` ;
- avant le premier heartbeat,
  `alert_at = created_at + interval_seconds + grace_seconds` ;
- toutes les dates sont stockées et comparées en UTC avec l'horloge Postgres ;
- les presets UI « toutes les heures » et « tous les jours » produisent des
  intervalles, ce qui couvre le besoin de détection de silence sans prétendre
  remplacer un ordonnanceur calendaire.

Les expressions cron avec fuseau horaire, heure d'été et calendrier pourront
être ajoutées comme second mode après validation des besoins utilisateurs.

## 5. Modèle de données minimal

| Table                           | Colonnes principales                                                                                                                                | Contraintes et index                                                                                |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `tenants`                       | `id`, `created_at`                                                                                                                                  | clé primaire UUID ; aucun libellé métier                                                            |
| `memberships`                   | `tenant_id`, `user_id`, `role`                                                                                                                      | PK composite, rôle vérifié                                                                          |
| `auth_sessions`                 | `id_hash`, `user_id`, `encrypted_refresh_token`, `key_version`, `created_at`, `expires_at`, `revoked_at`                                            | jamais lisible par le client ; hash et chiffrement uniquement                                       |
| `monitors`                      | `id`, `tenant_id`, `token_hash`, `token_prefix`, `interval_seconds`, `grace_seconds`, `status`, `last_ping_at`, `alert_at`, `enabled`, `created_at` | `token_hash` unique ; index partiel `(alert_at)` pour moniteurs actifs ; `(tenant_id, created_at)`  |
| `incidents`                     | `id`, `monitor_id`, `opened_at`, `resolved_at`, `reason`                                                                                            | index unique partiel d'un seul incident ouvert par moniteur                                         |
| `notification_channels`         | `id`, `tenant_id`, `type`, `encrypted_config`, `key_version`, `enabled`, `created_at`                                                               | config chiffrée avec nonce unique ; l'e-mail est résolu depuis le compte, sans duplication en clair |
| `monitor_notification_channels` | `monitor_id`, `channel_id`                                                                                                                          | PK composite ; les deux ressources doivent appartenir au même tenant                                |
| `notification_deliveries`       | `id`, `incident_id`, `channel_id`, `kind`, `status`, `attempts`, `next_attempt_at`, `last_error_code`, `idempotency_key`                            | `idempotency_key` unique ; index `(status, next_attempt_at)` ; erreur normalisée                    |
| `audit_events`                  | `id`, `tenant_id`, `actor_id`, `action`, `target_type`, `target_id`, `metadata_redacted`, `created_at`                                              | lecture tenant-scopée ; aucune donnée secrète                                                       |

Chaque table métier porte `tenant_id` ou y est rattachée sans ambiguïté.
L'isolation ne repose jamais sur un filtre oublié dans une route. Les politiques
RLS utilisent une fonction `is_tenant_member(tenant_id)` et les opérations
serveur sensibles passent par des fonctions RPC à privilèges minimaux.

Le moniteur garde uniquement un état courant pour les décisions rapides. Aucun
événement brut de ping n'est persisté, et aucune colonne ne doit accepter un
corps, un en-tête, une IP, un user-agent, un nom de serveur ou un contenu
d'exécution.

## 6. Décisions structurantes proposées

Les ADR ne doivent pas être créés avant validation utilisateur :

- `0001-monolithe-modulaire-et-stack` : SPA React/Vite/TanStack avec HeroUI,
  API Hono, Worker Cloudflare et frontières de domaine ;
- `0002-isolation-multi-tenant` : membres, `tenant_id` et politiques RLS ;
- `0003-semantique-heartbeat` : intervalle, marge, UTC et états ;
- `0004-scheduler-et-checker` : plateforme, fréquence et mécanisme atomique ;
- `0005-outbox-et-retries` : déduplication, backoff et idempotence ;
- `0006-securite-des-tokens-de-ping` : endpoint fixe, token dans
  `Authorization`, HMAC, rotation et limitation de débit ;
- `0007-minimisation-des-donnees` : heartbeat sans contenu, libellés locaux,
  absence d'historique brut et rétention minimale ;
- `0008-secrets-et-sessions` : cookie `HttpOnly`, CSRF, chiffrement des
  destinations et séparation des clés.

## 7. Ordre d'implémentation

Le graphe critique est :

```text
1 -> 2 -> 4 -> 5 -> 6 -> 8 -> 10 -> 11
1 -> 3 --------^
2 -> 7 -> 8
5 -> 9 -> 10
```

Les étapes 3 et 7 peuvent démarrer en parallèle des étapes 2 et 4 après
validation des contrats de données. Aucune étape ne doit modifier un fichier
appartenant à une autre branche active sans rebase explicite.

### Étape 1 - Socle du dépôt et ADR

Contexte : le dépôt contient `AGENTS.md`, `docs/design/DESIGNSYSTEM.md` et ce
plan, mais aucun manifeste, runner ni application ne peut encore être supposé.

Tâches :

- valider les ADR proposés et choisir le scheduler ;
- initialiser un workspace `pnpm` avec `apps/web` en React/Vite/TanStack et
  `apps/api` en Hono ;
- installer et configurer HeroUI comme unique bibliothèque de composants,
  monter son provider une seule fois à la racine et mapper son thème vers les
  tokens de `docs/design/DESIGNSYSTEM.md` ;
- vérifier qu'aucune dépendance ou feuille de style Bootstrap n'est importée ;
- activer TypeScript strict, `vite-plugin-checker` et un typecheck explicite,
  car `vite build` ne vérifie pas les types ;
- configurer le proxy Vite `/api` vers l'API locale avec `wrangler dev` ;
- configurer formatter, lint, typecheck et tests pour le frontend, l'API et le
  domaine partagé ;
- définir les scripts `test:*`, `db:*`, `test:load` et `test:a11y` réellement
  utilisés par les étapes suivantes ;
- ajouter `.env.example`, valider séparément les variables publiques `VITE_` et
  les secrets Worker, puis ajouter `.gitignore` ;
- ajouter le secret de session, la clé de chiffrement des canaux, le pepper
  HMAC et le secret Resend au gestionnaire de secrets du Worker ;
- créer un inventaire des données autorisées et interdites, puis l'ajouter au
  README et aux contrats de test ;
- documenter dans `README.md` les commandes réelles d'installation,
  développement, migration, test et build ;
- créer un health check dans l'API Hono.

Vérification :

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @vextra/web exec tsc --noEmit
pnpm --filter @vextra/api exec tsc --noEmit
pnpm exec supabase --version
if rg -n '"(bootstrap|react-bootstrap|bootstrap-icons)"' \
  package.json pnpm-lock.yaml; then
  echo "Bootstrap est interdit dans ce projet" >&2
  exit 1
fi
```

Critères de sortie : toutes les commandes passent, aucune valeur secrète n'est
versionnée, l'inventaire de données est explicite et le README reflète
exactement le manifeste.

Rollback : supprimer les fichiers d'initialisation de ce lot avant toute
migration de données ; aucune donnée utilisateur n'est concernée.

### Étape 2 - Schéma Supabase, authentification et RLS

Contexte : cette étape établit la frontière de sécurité commune à tous les
tenants et les contrats de persistance.

Tâches :

- créer les migrations des tables du modèle de données et leurs index ;
- implémenter `is_tenant_member` et les politiques RLS ;
- configurer Supabase Auth avec e-mail vérifié ;
- générer et versionner les types ;
- ajouter un test de schéma qui échoue si une table applicative contient un
  champ de contenu d'exécution, de corps, d'en-tête, d'IP ou de user-agent ;
- implémenter les routes d'authentification dans l'API Hono et une session
  opaque dans un cookie `HttpOnly`, `Secure`, `SameSite=Strict` ;
- ne jamais stocker de token d'accès ou de rafraîchissement dans
  `localStorage`, `sessionStorage` ou un cache TanStack persistant ;
- protéger les mutations dashboard par CSRF et vérification d'origine ;
- résoudre l'e-mail destinataire depuis le compte authentifié au moment de
  l'envoi, sans en conserver une seconde copie en clair ;
- chiffrer `encrypted_config` avec AES-GCM, un nonce unique et une version de
  clé, puis ne jamais renvoyer le webhook complet au navigateur ;
- créer le composition root côté serveur et les repositories tenant-scopés ;
- ajouter des tests prouvant qu'un membre ne peut pas lire, modifier ou
  supprimer les données d'un autre tenant ;
- interdire les opérations destructives sans confirmation explicite.

Vérification :

```bash
pnpm exec supabase db reset
pnpm exec supabase db lint
pnpm test:integration -- tenant-isolation
pnpm test:integration -- auth-session
```

Critères de sortie : les tests passent avec deux utilisateurs et deux tenants,
toutes les tables exposées ont une politique explicite, aucun accès anonyme à
l'API métier n'est possible et aucune clé service n'est présente dans le bundle
frontend. Le cookie de session porte les attributs de sécurité attendus et aucun
token d'authentification n'est accessible au JavaScript du navigateur.

Rollback : migrations additives, désactivation de la fonctionnalité via feature
flag puis retour de l'application précédente ; conserver les tables si des
données de test ont été créées.

### Étape 3 - Domaine de surveillance et machine à états

Contexte : les règles d'échéance doivent être testables sans base ni framework.

Tâches :

- définir `Monitor`, `HeartbeatSignal` transitoire, `Incident` et les erreurs
  métier ;
- calculer `alert_at` avec une horloge injectée ;
- implémenter les transitions autorisées : `pending`, `healthy`, `late`,
  `paused` ;
- définir la règle d'ouverture unique d'un incident et sa résolution ;
- définir qu'une pause ferme ou mute l'incident courant et qu'une reprise
  recalcule une nouvelle échéance sans alerter rétroactivement ;
- tester les limites exactes de deadline, les heartbeats tardifs, la pause et
  les dates invalides.

Vérification :

```bash
pnpm --filter @vextra/domain test:coverage
```

Critères de sortie : au moins 80 % de couverture sur le domaine, aucun import
Supabase, HTTP ou React dans `domain/`, et un heartbeat au-delà de la deadline
résout l'incident selon une règle documentée.

Rollback : le domaine est isolé ; rétablir les fichiers du lot précédent sans
toucher aux migrations.

### Étape 4 - Gestion des moniteurs et secrets

Contexte : l'utilisateur doit obtenir une commande fiable sans manipuler de
configuration complexe ni exposer le token dans une URL.

Tâches :

- implémenter création, liste, détail, pause, reprise et suppression ;
- exposer un endpoint de statut qui retourne seulement l'état, les dates de
  heartbeat et de deadline, sans contenu d'exécution ;
- implémenter les appels via TanStack Query et les formulaires via TanStack
  Form, avec invalidation des queries après mutation ;
- conserver le libellé convivial du moniteur dans le stockage local du
  navigateur et n'envoyer que des champs techniques validés à l'API ;
- générer un secret aléatoire cryptographiquement sûr, afficher sa valeur une
  seule fois et stocker uniquement son HMAC ;
- ajouter une action de rotation invalidant immédiatement l'ancien token ;
- produire un snippet `curl` échappé qui lit `VEXTRA_TOKEN` depuis le
  gestionnaire de secrets du serveur et l'envoie dans `Authorization` ;
- associer explicitement un ou plusieurs canaux de notification au moniteur, en
  vérifiant leur appartenance au même tenant ;
- appliquer des validations explicites : nom, intervalle minimum, marge,
  destination et propriétaire ;
- enregistrer un événement d'audit pour création, rotation et suppression.

Snippet cible à afficher et à tester :

```bash
curl --fail --silent --show-error --retry 3 \
  --request POST \
  --header "Authorization: Bearer ${VEXTRA_TOKEN}" \
  "https://api.vextra.app/api/ping"
```

`VEXTRA_TOKEN` doit être chargé depuis un coffre ou un fichier de secrets
protégé, jamais collé dans le script ou dans l'historique du shell.

Vérification :

```bash
pnpm test:integration -- monitors
pnpm --filter @vextra/web test -- monitor-form
pnpm test:e2e -- create-monitor
```

Critères de sortie : deux tenants ne voient jamais les mêmes moniteurs ; le
token complet n'est présent ni dans les logs ni après le premier affichage, et
aucun libellé choisi par l'utilisateur n'est envoyé au serveur.

Rollback : masquer la fonctionnalité de rotation derrière un flag et conserver
les tokens existants ; ne pas supprimer de moniteur automatiquement.

### Étape 5 - Ingestion des heartbeats

Contexte : le chemin chaud doit rester simple, rapide et résistant aux retries
du script.

Tâches :

- utiliser l'endpoint fixe `POST /api/ping` et extraire un unique token
  `Bearer` du header `Authorization`, avec une réponse vide et rapide ;
- ignorer tout cookie sur cet endpoint et ne pas exposer de CORS navigateur :
  le heartbeat est appelé par un script serveur ;
- refuser les méthodes autres que `POST` et ne pas exposer d'information sur
  l'existence d'un token ;
- refuser le corps de requête, les paramètres de requête et tout contenu
  métier ; ne lire et ne conserver que le token nécessaire au routage ;
- rejeter les tokens présents dans l'URL, un corps ou un paramètre de requête ;
- calculer le HMAC du token reçu avec un pepper serveur, retrouver le moniteur
  et exécuter la transaction de heartbeat ;
- encapsuler cette transaction dans une RPC à privilèges minimaux qui accepte
  uniquement le hash du token et ne permet aucune lecture dashboard ;
- mettre à jour `last_ping_at`, `alert_at` et l'état courant ;
- résoudre l'incident ouvert et enqueue une notification de reprise ;
- ajouter une limitation de débit par HMAC du token et, si nécessaire, par IP
  hachée avec un secret tournant et un TTL court, sans persister l'IP ;
- vérifier que les access logs de l'hébergeur ne conservent ni le header
  `Authorization` ni les autres en-têtes du heartbeat ;
- appliquer des retries `curl` idempotents sans créer de faux incidents ;
- journaliser uniquement un identifiant de requête, la route générique et le
  résultat, jamais le token, l'IP, le user-agent ou les en-têtes.

Vérification :

```bash
pnpm test:integration -- ping
pnpm test:integration -- ping-privacy
pnpm test:load -- ping --rate 100
```

Critères de sortie : p95 sous 300 ms en local sur le scénario pilote, aucun
token complet dans les logs, et un token invalide reçoit une réponse générique
sans fuite tenant. Un heartbeat avec un corps, des paramètres ou des en-têtes
personnalisés est rejeté ou ignoré sans être persisté.

Rollback : désactiver la route et conserver les moniteurs en pause ; ne jamais
modifier ni supprimer les états existants pour revenir en arrière.

### Étape 6 - Checker atomique et incidents

Contexte : plusieurs exécutions du scheduler peuvent se chevaucher et ne doivent
pas doubler les alertes.

Tâches :

- implémenter une fonction SQL de claim atomique des moniteurs dus ;
- ouvrir un seul incident par moniteur avec une contrainte partielle ;
- publier un événement d'alerte dans l'outbox, jamais appeler Resend depuis la
  transaction du checker ;
- implémenter le handler `scheduled` du Worker Cloudflare et l'appeler
  directement depuis le Cron Trigger ;
- exposer éventuellement `POST /api/internal/check` pour un diagnostic manuel,
  avec secret comparé en temps constant et route refusée si le secret manque ;
- rendre l'appel idempotent et borner le lot traité ;
- ajouter un watchdog : le checker doit lui-même alerter s'il n'a pas tourné ;
- tester deux workers concurrents et deux appels du même scheduler.

Vérification :

```bash
pnpm test:integration -- checker-concurrency
pnpm test:integration -- incident-deduplication
```

Critères de sortie : un incident ouvert au maximum par moniteur, aucune alerte
dupliquée sous concurrence, et le temps de détection mesuré reste sous 60
secondes après la deadline.

Rollback : suspendre le scheduler, laisser les moniteurs en pause et rejouer les
événements manuellement après correction.

### Étape 7 - Outbox et moteur de livraison

Contexte : un fournisseur d'e-mail indisponible ne doit pas perdre une alerte.

Tâches :

- créer l'outbox avec clé d'idempotence unique ;
- limiter le payload des livraisons à l'identifiant opaque du moniteur, au type
  d'événement, au statut et aux dates nécessaires ; ne jamais y inclure de nom
  de serveur, de script ou de commande ;
- implémenter les états `pending`, `processing`, `sent`, `failed`, `dead` ;
- ajouter un claim de livraison atomique et un backoff exponentiel plafonné ;
- traiter l'outbox depuis le même handler planifié toutes les minutes, tout en
  rendant chaque exécution sûre en cas de concurrence ;
- limiter le nombre de tentatives et conserver la dernière erreur non sensible ;
- prévoir une commande de replay contrôlée pour un opérateur ;
- ajouter des métriques sur la profondeur de file et les échecs.

Vérification :

```bash
pnpm test:integration -- delivery-retry
pnpm test:integration -- delivery-idempotency
```

Critères de sortie : une panne simulée du fournisseur ne perd aucune livraison,
un retry ne crée pas de doublon métier et une alerte épuisée devient visible
dans l'administration.

Rollback : mettre le worker en pause et conserver l'outbox ; le replay est
manuel et audité.

### Étape 8 - E-mail Resend et Discord

Contexte : le MVP doit alerter par un canal que l'utilisateur peut configurer
sans exposition réseau arbitraire.

Tâches :

- implémenter un port `NotificationSender` et les adapters Resend et Discord ;
- ajouter un bouton « tester le canal » ;
- envoyer une alerte d'incident et une notification de reprise ;
- rédiger les messages avec l'identifiant court du moniteur et son statut, sans
  libellé métier ni détail d'exécution ;
- valider et stocker la destination de façon sûre ;
- chiffrer la configuration Discord avec AES-GCM, stocker sa version de clé et
  ne renvoyer que des métadonnées masquées après création ;
- faire tourner la clé de chiffrement avec ré-encryption contrôlée et documenter
  la procédure ;
- ne jamais journaliser le webhook Discord complet ;
- traiter les erreurs fournisseur comme des échecs de livraison, sans ouvrir un
  second incident ;
- prévoir Telegram derrière une étape ultérieure si le parcours d'installation
  n'est pas validé.

Vérification :

```bash
pnpm test:integration -- resend
pnpm test:integration -- discord
pnpm test:integration -- channel-encryption
pnpm test:e2e -- alert-delivery
```

Critères de sortie : une alerte est reçue en staging dans les 60 secondes
suivant la détection, la reprise est reçue après un nouveau heartbeat, et le
test de canal est limité par utilisateur. Une lecture directe de la base ne
permet pas de retrouver le webhook en clair.

Rollback : désactiver l'adaptateur concerné par feature flag ; les livraisons
restent en attente dans l'outbox.

### Étape 9 - Dashboard et parcours utilisateur

Contexte : la valeur du produit dépend de la compréhension immédiate de l'état
et de l'installation du heartbeat.

Tâches :

- créer les routes TanStack Router pour connexion, liste, création, détail et
  incidents ;
- utiliser `beforeLoad` pour les gardes de navigation authentifiées et des
  imports différés par route ;
- centraliser les clés TanStack Query par tenant et invalider la liste et le
  détail après création, rotation, pause ou suppression ;
- utiliser TanStack Form avec les schémas Zod partagés de `packages/contracts` ;
- conserver la session via cookie et ne jamais persister les réponses TanStack
  Query contenant des données de compte dans le stockage navigateur ;
- créer une section compte permettant la suppression avec confirmation forte ;
- afficher clairement `healthy`, `late`, `paused` et `pending` ;
- afficher le snippet `curl`, un bouton copier et la dernière date reçue ;
- n'afficher le token complet qu'une fois, puis uniquement son préfixe et
  proposer sa rotation ;
- rendre visibles les canaux et leur état de test ;
- ajouter les actions pause, reprise, rotation et suppression avec
  confirmation ;
- implémenter la suppression de compte, la révocation des accès et la purge ou
  l'anonymisation des données selon la politique de rétention ;
- gérer les états vides, erreurs réseau, chargement et accessibilité clavier ;
- gérer les erreurs de chargement d'un chunk obsolète après déploiement par un
  rechargement contrôlé de la route ;
- appliquer un design responsive sans dépendre d'une capture marketing.

Vérification :

```bash
pnpm test:e2e -- dashboard
pnpm test:e2e -- monitor-lifecycle
pnpm test:a11y -- dashboard
```

Critères de sortie : un nouvel utilisateur crée un moniteur et obtient sa
commande de heartbeat en moins de 30 secondes lors du test manuel, et les
parcours critiques sont utilisables au clavier.

Rollback : masquer les nouveaux écrans par feature flag ; les APIs et données
restent rétrocompatibles.

### Étape 10 - Sécurité, observabilité et tests de charge

Contexte : le token de heartbeat est un secret et chaque erreur d'isolation peut
exposer les moniteurs d'un autre client.

Tâches :

- revoir RLS, service roles, secret handling, CSRF et validation d'entrées ;
- configurer CSP stricte, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`, `frame-ancestors 'none'`, HSTS et HTTPS obligatoire ;
- vérifier que le cookie dashboard est `HttpOnly`, `Secure`,
  `SameSite=Strict`, avec une durée de vie courte et une révocation serveur ;
- tester que les mutations par cookie échouent sans jeton CSRF/origine valide ;
- vérifier par introspection du schéma qu'aucune table ne contient de champ de
  script, de cron, de commande, de sortie, de corps de requête, d'IP ou de
  user-agent ;
- vérifier que les access logs et logs applicatifs masquent le token et ne
  conservent ni header `Authorization`, ni requête brute, ni destination de
  notification ;
- vérifier qu'aucun secret serveur n'entre dans les variables `VITE_` ou dans
  `dist/`, et désactiver les source maps publiques sauf envoi sécurisé au
  service d'erreurs ;
- bloquer les destinations internes pour les futurs webhooks génériques ;
- vérifier que les clés de chiffrement et de signature ne sont ni dans le code,
  ni dans les logs, ni dans les variables `VITE_` ;
- limiter la conservation des incidents à 30 jours, des livraisons terminées à
  7 jours et des audits à 30 jours, avec purge automatisée ;
- ajouter logs structurés avec IDs de requête, sans token ni destinataire brut ;
- limiter l'analytics produit à des événements pseudonymes et ne jamais capturer
  un chemin de heartbeat, un token, un libellé local ou un contenu de
  formulaire ;
- instrumenter heartbeat reçu, incident ouvert, livraison tentée et checker en
  retard ;
- ajouter traces et health checks ;
- exécuter les parcours E2E inscription, connexion, isolation tenant, alerte,
  reprise, pause, suppression de moniteur et suppression de compte ;
- tester le scénario pilote et documenter les résultats réels.

Vérification :

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:integration -- data-minimization
pnpm test:integration -- auth-session
pnpm test:integration -- csrf
pnpm test:e2e
pnpm test:load
pnpm audit --prod
pnpm --filter @vextra/web build
if rg -n 'service_role|RESEND|HMAC|CRON_SECRET' apps/web/dist; then
  echo "Secret potentiel détecté dans le bundle" >&2
  exit 1
fi
```

Critères de sortie : aucune vulnérabilité critique ou élevée connue, aucun
secret dans le diff ni dans le bundle, et les métriques permettent de
distinguer une panne du checker d'une panne d'un client. Aucun contenu
d'exécution ni historique brut de heartbeat n'est présent en base, et les
destinations de notification sont illisibles sans la clé du Worker.

Rollback : revenir au déploiement précédent est sans risque uniquement si les
migrations du lot sont additives ; tester la compatibilité descendante avant
la publication.

### Étape 11 - Déploiement, staging et lancement pilote

Contexte : le produit doit prouver la boucle complète sur l'infrastructure
hébergée avant d'inviter des utilisateurs.

Tâches :

- provisionner Supabase de staging et de production avec migrations rejouées ;
- configurer les secrets dans l'environnement du Worker ;
- définir des secrets distincts pour la session, le HMAC des tokens et le
  chiffrement des canaux, avec des procédures de rotation indépendantes ;
- déployer la SPA Vite comme site statique avec fallback vers `index.html` ;
- produire un build frontend distinct par environnement, car les variables
  `VITE_` sont intégrées dans le bundle à la compilation ;
- déployer l'API Hono sur Cloudflare Workers et configurer le Cron Trigger ;
- restreindre CORS à l'origine exacte du frontend ;
- conserver les anciens assets pendant la fenêtre de déploiement afin d'éviter
  les chunks obsolètes déjà chargés par les navigateurs ;
- exécuter le smoke test : inscription, création, ping, retard simulé, alerte,
  reprise, suppression du moniteur et suppression du compte de test ;
- envoyer un heartbeat avec un corps factice et vérifier qu'il est rejeté ou
  ignoré et qu'il n'apparaît ni en base ni dans les logs ;
- vérifier que les sauvegardes sont chiffrées, suivent la même politique de
  rétention et qu'une restauration a été testée ;
- rédiger un runbook incident : checker arrêté, fournisseur e-mail indisponible,
  fuite ou rotation d'un token, compromission d'une clé de chiffrement et
  rollback ;
- limiter l'inscription par invitation pour le pilote ;
- mesurer activation, taux d'alertes utiles et faux positifs.

Vérification :

```bash
pnpm build
pnpm --filter @vextra/api exec wrangler deploy --dry-run
pnpm test:e2e -- staging
pnpm exec supabase db lint --linked
```

Critères de sortie : le parcours complet fonctionne en staging sur un vrai
script cron, les alertes arrivent, la reprise est détectée et le runbook est
versionné. `vite preview` peut servir de test local du bundle, jamais de serveur
de production.

Rollback : désactiver les invitations, mettre les nouveaux moniteurs en pause
et revenir au déploiement précédent ; ne jamais supprimer les données de
production pour corriger une release.

## 8. Parallélisation et chemins critiques

- Chemin du premier utilisateur : étapes 1, 2, 4, 5, 6, 8, 9, 11.
- Chemin de fiabilité : étapes 1, 3, 6, 7, 10.
- Étape 3 parallélisable avec l'étape 2 après validation des contrats.
- Étape 7 parallélisable avec les étapes 4 à 6 après création du schéma.
- Étape 9 peut commencer avec des données de démonstration après l'étape 5, mais
  ne passe pas son gate avant l'étape 8.
- L'étape 10 est obligatoire avant toute invitation externe.
- Le frontend peut être développé avec des mocks TanStack Query, mais son gate
  final exige l'API Hono réelle.

## 9. Améliorations prioritaires après le MVP

1. Horaires calendaires et fuseaux horaires, avec gestion explicite de l'heure
   d'été.
2. Moniteurs de type start/finish pour mesurer la durée d'exécution et détecter
   un script bloqué.
3. Telegram, Slack et webhooks génériques avec protection SSRF complète.
4. Fenêtres de maintenance et suspensions planifiées.
5. Page de statut publique optionnelle et badge par moniteur.
6. Quotas, plans et facturation Stripe.
7. Rétention configurable, export et politique de purge planifiée.
8. Alertes groupées et escalade après plusieurs incidents.
9. Régions de traitement et stockage pour répondre à des exigences de
   localisation.
10. Tests de restauration réguliers et exercices de panne du scheduler.

## 10. Risques et décisions à prendre avant le code

| Risque                                 | Décision attendue                                              |
| -------------------------------------- | -------------------------------------------------------------- |
| Scheduler trop lent ou limité          | choisir un fournisseur et une fréquence minimale               |
| Token de heartbeat découvert           | endpoint fixe, token en header, rotation immédiate             |
| Alertes perdues                        | valider l'outbox, les retries et le watchdog                   |
| Fuite inter-tenant                     | valider RLS, RPC, rôles et tests d'isolation                   |
| Coût des heartbeats fréquents          | fixer la fréquence minimale et mesurer le coût réel            |
| Faux positifs                          | choisir des presets et une marge par défaut raisonnables       |
| Fuseaux horaires                       | reporter les vrais calendriers après le MVP d'intervalle       |
| Secret exposé via `VITE_`              | séparer variables publiques et secrets Worker, scanner `dist/` |
| Token ou payload capturé en log        | vérifier le masquage de l'hébergeur avant production           |
| Libellé métier trop révélateur         | conserver les alias uniquement dans le navigateur              |
| Compromission de la clé de chiffrement | séparer les clés et documenter la rotation                     |
| Session dashboard volée                | cookie `HttpOnly`, CSRF, révocation et expiration courte       |

## 11. Porte de validation

Avant l'étape 1, l'utilisateur doit valider :

- la cible d'une démo en un jour ou d'un MVP fiable en 5 à 7 jours ;
- le mode de schedule fondé sur intervalle + marge ;
- l'absence de conservation du cron, du script, des sorties et de l'historique
  brut des heartbeats ;
- le stockage local des libellés de moniteurs ;
- l'endpoint fixe avec token dans `Authorization` plutôt que dans l'URL ;
- la session dashboard en cookie `HttpOnly` et le chiffrement des webhooks ;
- le périmètre TanStack : Router, Query et Form sans TanStack Start ;
- l'API Hono sur Cloudflare Workers avec Cron toutes les minutes ;
- le scheduler et sa fréquence minimale ;
- l'ordre de priorité des canaux : e-mail, puis Discord, puis Telegram ;
- le report explicite du paiement, considéré comme non critique pour le pilote ;
- les huit ADR proposés ;
- le plafond de coût mensuel du pilote.

Tant que ces points ne sont pas validés, aucune migration, aucun composant UI
et aucune infrastructure ne doivent être créés.
