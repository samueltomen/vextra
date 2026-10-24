# CronPing - Plan de construction du MVP

Statut : proposition à valider  
Date : 2026-10-24  
Mode : direct, car le dossier `.git` actuel n'est pas un dépôt Git exploitable  
Objectif : livrer un SaaS multi-tenant permettant de détecter l'absence
d'exécution d'un script cron et d'alerter son propriétaire.

## 1. Périmètre et promesse produit

CronPing est un service de heartbeat pour tâches planifiées. L'utilisateur crée
un moniteur, ajoute un appel HTTP à la fin de son script, puis CronPing ouvre un
incident et alerte si aucun heartbeat n'est reçu dans la fenêtre attendue.

Le MVP doit permettre de :

- créer un compte et un espace de travail personnel ;
- créer un moniteur avec un nom, une fréquence attendue, une marge et un canal
  de notification ;
- copier une commande `curl` prête à intégrer dans un script ;
- recevoir un heartbeat sans authentification interactive ;
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
- les expressions cron calendaires complexes ;
- les SMS, appels téléphoniques et escalades on-call ;
- les organisations multi-utilisateurs avancées, la facturation et les quotas
  commerciaux ;
- une page de statut publique ;
- des webhooks arbitraires. Discord et Telegram seront des intégrations
  explicites pour éviter les risques SSRF.

## 2. Contraintes mesurables

Ces cibles sont des objectifs de pilote, pas des garanties de production :

| Domaine | Cible |
| --- | --- |
| Création d'un moniteur | moins de 30 secondes de la connexion à l'URL copiée |
| Heartbeat | disponibilité 99,5 %, p95 sous 300 ms hors rate limit |
| Détection | au plus 60 secondes après `deadline + grace` |
| Première notification | p95 sous 60 secondes après détection |
| Isolation | zéro accès ou écriture inter-tenant dans les tests et politiques RLS |
| Fiabilité | aucun doublon d'incident ouvert ou d'alerte pour un même épisode |
| Charge pilote | 100 tenants, 1 000 moniteurs, fréquence moyenne de 5 minutes |
| Coût pilote | mesurer coût fixe et coût par million de heartbeats |

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

| Créneau | Livrable |
| --- | --- |
| 09:00-10:00 | choix rapide du scheduler, bootstrap et variables d'environnement |
| 10:00-12:00 | Supabase Auth, schéma minimal, RLS de base et premier tenant |
| 12:00-13:30 | création d'un moniteur, token et snippet `curl` |
| 13:30-15:00 | route de ping et mise à jour de l'état |
| 15:00-16:30 | checker manuel, incident et e-mail Resend |
| 16:30-18:00 | déploiement, test avec un vrai cron et corrections nominales |

Un MVP fiable avec isolation tenant, incidents, outbox, retries, tests
d'intégration et déploiement demande plutôt 4 à 6 jours d'ingénierie. Une V1
commercialisable avec facturation, quotas, Discord, Telegram et observabilité
demande environ 2 à 3 semaines.

## 3. Stack de référence proposée

La stack reste soumise aux ADR et doit être validée avant installation :

- application : Next.js avec TypeScript strict, rendu serveur et routes API ;
- UI : composants accessibles, Tailwind CSS et primitives locales ;
- base et authentification : Supabase Postgres et Supabase Auth ;
- migrations : Supabase CLI, schéma versionné et types TypeScript générés ;
- e-mail : Resend ;
- intégrations : adaptateurs Discord et Telegram ;
- tests : Vitest pour le domaine, tests d'intégration Postgres/RLS et Playwright
  pour les parcours critiques ;
- paquets : `pnpm` avec lockfile versionné ;
- hébergement : Vercel pour l'application ;
- scheduler : à décider après vérification de la granularité réellement
  disponible sur le plan d'hébergement.

Le scheduler est volontairement abstrait. Utiliser Vercel Cron si sa fréquence
minimale est compatible, sinon Supabase `pg_cron` ou Cloudflare Cron. Le choix
doit être consigné dans un ADR et non déduit d'une supposition sur les offres.

## 4. Architecture cible

Le produit reste un monolithe modulaire organisé par domaine :

```text
src/
  features/
    accounts/{domain,application,adapters,ui}
    monitoring/{domain,application,adapters,ui}
    notifications/{domain,application,adapters,ui}
  app/
    api/ping/[token]/route.ts
    api/internal/check/route.ts
    api/internal/deliver/route.ts
    dashboard/...
  shared/
tests/{unit,integration,e2e}
docs/adr
infra
scripts
```

Le domaine `monitoring` contient les règles de calcul de deadline et les
transitions `pending -> healthy -> late -> healthy`. Il ne connaît ni Supabase,
ni HTTP, ni React. Les routes et composants appellent des cas d'usage ; les
adapters implémentent les ports de persistance et de notification.

### Flux nominal

1. Le dashboard crée un moniteur et génère un secret aléatoire d'au moins
   256 bits.
2. Le secret complet est affiché une seule fois ; seul son HMAC-SHA-256 est
   stocké avec un préfixe non secret pour l'identification.
3. Le script appelle `POST /api/ping/<secret>` avec `curl -fsS --retry 3`.
4. La route v1 réalise en transaction : validation du token, mise à jour de
   `last_ping_at` et `alert_at`, résolution de l'incident ouvert et écriture
   d'un événement de reprise.
5. Le checker appelle une fonction SQL atomique qui sélectionne et réserve les
   moniteurs échus avec `FOR UPDATE SKIP LOCKED`, ouvre au plus un incident par
   moniteur et ajoute une notification dans l'outbox.
6. Le delivery worker traite l'outbox, envoie l'e-mail, enregistre le résultat
   et programme un retry avec backoff en cas d'échec.

Le même scheduler, ou un second déclencheur toutes les minutes, appelle le
worker de livraison. Une alerte détectée ne dépend donc pas d'un heartbeat
utilisateur pour être envoyée.

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

| Table | Colonnes principales | Contraintes et index |
| --- | --- | --- |
| `tenants` | `id`, `name`, `created_at` | clé primaire UUID |
| `memberships` | `tenant_id`, `user_id`, `role` | PK composite, rôle vérifié |
| `monitors` | `id`, `tenant_id`, `name`, `token_hash`, `token_prefix`, `interval_seconds`, `grace_seconds`, `status`, `last_ping_at`, `alert_at`, `enabled`, `created_at` | `token_hash` unique ; index partiel `(alert_at)` pour moniteurs actifs ; `(tenant_id, created_at)` |
| `pings` | `id`, `monitor_id`, `received_at`, `source` | index `(monitor_id, received_at desc)` ; rétention initiale 30 jours |
| `incidents` | `id`, `monitor_id`, `opened_at`, `resolved_at`, `reason` | index unique partiel d'un seul incident ouvert par moniteur |
| `notification_channels` | `id`, `tenant_id`, `type`, `destination`, `enabled`, `created_at` | destination chiffrée si nécessaire ; `(tenant_id, type)` |
| `monitor_notification_channels` | `monitor_id`, `channel_id` | PK composite ; les deux ressources doivent appartenir au même tenant |
| `notification_deliveries` | `id`, `incident_id`, `channel_id`, `kind`, `status`, `attempts`, `next_attempt_at`, `last_error`, `idempotency_key` | `idempotency_key` unique ; index `(status, next_attempt_at)` |
| `audit_events` | `id`, `tenant_id`, `actor_id`, `action`, `target_type`, `target_id`, `metadata_redacted`, `created_at` | lecture tenant-scopée ; aucune donnée secrète |

Chaque table métier porte `tenant_id` ou y est rattachée sans ambiguïté.
L'isolation ne repose jamais sur un filtre oublié dans une route. Les politiques
RLS utilisent une fonction `is_tenant_member(tenant_id)` et les opérations
serveur sensibles passent par des fonctions RPC à privilèges minimaux.

Les heartbeats sont volontairement des événements séparés de l'état courant.
Le moniteur garde un état dénormalisé pour les décisions rapides, tandis que la
table `pings` fournit l'audit et les futures métriques de latence.

## 6. Décisions structurantes proposées

Les ADR ne doivent pas être créés avant validation utilisateur :

- `0001-monolithe-modulaire-et-stack` : Next.js, Supabase et frontières de
  domaine ;
- `0002-isolation-multi-tenant` : membres, `tenant_id` et politiques RLS ;
- `0003-semantique-heartbeat` : intervalle, marge, UTC et états ;
- `0004-scheduler-et-checker` : plateforme, fréquence et mécanisme atomique ;
- `0005-outbox-et-retries` : déduplication, backoff et idempotence ;
- `0006-securite-des-tokens-de-ping` : token capable, HMAC, rotation et méthodes
  HTTP.

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

Contexte : le dépôt ne contient actuellement que `AGENTS.md` ; aucun manifeste,
runner ni convention technique ne peut être supposé.

Tâches :

- valider les ADR proposés et choisir le scheduler ;
- initialiser l'application TypeScript avec mode strict ;
- configurer formatter, lint, typecheck et tests ;
- définir les scripts `test:*`, `db:*`, `test:load` et `test:a11y` réellement
  utilisés par les étapes suivantes ;
- ajouter `.env.example`, validation des variables d'environnement et
  `.gitignore` ;
- documenter dans `README.md` les commandes réelles d'installation,
  développement, migration, test et build ;
- créer un health check applicatif minimal.

Vérification :

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec supabase --version
```

Critères de sortie : toutes les commandes passent, aucune valeur secrète n'est
versionnée, et le README reflète exactement le manifeste.

Rollback : supprimer les fichiers de bootstrap de ce lot avant toute migration
de données ; aucune donnée utilisateur n'est concernée.

### Étape 2 - Schéma Supabase, authentification et RLS

Contexte : cette étape établit la frontière de sécurité commune à tous les
tenants et les contrats de persistance.

Tâches :

- créer les migrations des tables du modèle de données et leurs index ;
- implémenter `is_tenant_member` et les politiques RLS ;
- configurer Supabase Auth avec e-mail vérifié ;
- générer et versionner les types ;
- créer le composition root côté serveur et les repositories tenant-scopés ;
- ajouter des tests prouvant qu'un membre ne peut pas lire, modifier ou
  supprimer les données d'un autre tenant ;
- interdire les opérations destructives sans confirmation explicite.

Vérification :

```bash
pnpm exec supabase db reset
pnpm exec supabase db lint
pnpm test:integration -- tenant-isolation
```

Critères de sortie : les tests passent avec deux utilisateurs et deux tenants,
toutes les tables exposées ont une politique explicite, et aucun accès anonyme
au dashboard n'est possible.

Rollback : migrations additives, désactivation de la fonctionnalité via feature
flag puis retour de l'application précédente ; conserver les tables si des
données de test ont été créées.

### Étape 3 - Domaine de surveillance et machine à états

Contexte : les règles d'échéance doivent être testables sans base ni framework.

Tâches :

- définir `Monitor`, `Heartbeat`, `Incident` et les erreurs métier ;
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
pnpm test:unit -- monitoring
```

Critères de sortie : au moins 80 % de couverture sur le domaine, aucun import
Supabase, HTTP ou React dans `domain/`, et un heartbeat au-delà de la deadline
résout l'incident selon une règle documentée.

Rollback : le domaine est isolé ; rétablir les fichiers du lot précédent sans
toucher aux migrations.

### Étape 4 - Gestion des moniteurs et secrets

Contexte : l'utilisateur doit obtenir une URL sans manipuler de configuration
complexe.

Tâches :

- implémenter création, liste, détail, pause, reprise et suppression ;
- générer un secret aléatoire cryptographiquement sûr, afficher sa valeur une
  seule fois et stocker uniquement son HMAC ;
- ajouter une action de rotation invalidant immédiatement l'ancien token ;
- produire un snippet `curl` échappé correctement ;
- associer explicitement un ou plusieurs canaux de notification au moniteur, en
  vérifiant leur appartenance au même tenant ;
- appliquer des validations explicites : nom, intervalle minimum, marge,
  destination et propriétaire ;
- enregistrer un événement d'audit pour création, rotation et suppression.

Vérification :

```bash
pnpm test:integration -- monitors
pnpm test:e2e -- create-monitor
```

Critères de sortie : deux tenants ne voient jamais les mêmes moniteurs ; le
token complet n'est présent ni dans les logs ni après le premier affichage.

Rollback : masquer la fonctionnalité de rotation derrière un flag et conserver
les tokens existants ; ne pas supprimer de moniteur automatiquement.

### Étape 5 - Ingestion des heartbeats

Contexte : le chemin chaud doit rester simple, rapide et résistant aux retries
du script.

Tâches :

- créer `POST /api/ping/:token` avec réponse générique et rapide ;
- refuser les méthodes autres que `POST` et ne pas exposer d'information sur
  l'existence d'un token ;
- hacher le token reçu, retrouver le moniteur et exécuter la transaction de
  heartbeat ;
- mettre à jour `last_ping_at`, `alert_at` et l'état courant ;
- résoudre l'incident ouvert et enqueue une notification de reprise ;
- ajouter une limitation de débit par token et par IP ;
- appliquer des retries `curl` idempotents sans créer de faux incidents ;
- consommer le corps de requête sans journaliser d'en-tête sensible.

Vérification :

```bash
pnpm test:integration -- ping
pnpm test:load -- ping --rate 100
```

Critères de sortie : p95 sous 300 ms en local sur le scénario pilote, aucun
token complet dans les logs, et un token invalide reçoit une réponse générique
sans fuite tenant.

Rollback : désactiver la route et conserver les moniteurs en pause ; ne jamais
supprimer l'historique pour revenir en arrière.

### Étape 6 - Checker atomique et incidents

Contexte : plusieurs exécutions du scheduler peuvent se chevaucher et ne doivent
pas doubler les alertes.

Tâches :

- implémenter une fonction SQL de claim atomique des moniteurs dus ;
- ouvrir un seul incident par moniteur avec une contrainte partielle ;
- publier un événement d'alerte dans l'outbox, jamais appeler Resend depuis la
  transaction du checker ;
- exposer `POST /api/internal/check` protégé par un secret ;
- comparer le secret interne en temps constant, refuser la route si la variable
  n'est pas configurée et la désactiver hors scheduler autorisé ;
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
- implémenter les états `pending`, `processing`, `sent`, `failed`, `dead` ;
- ajouter un claim de livraison atomique et un backoff exponentiel plafonné ;
- déclencher le worker de livraison toutes les minutes via le scheduler, tout en
  rendant chaque appel sûr en cas de concurrence ;
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
- valider et stocker la destination de façon sûre ;
- ne jamais journaliser le webhook Discord complet ;
- traiter les erreurs fournisseur comme des échecs de livraison, sans ouvrir un
  second incident ;
- prévoir Telegram derrière une étape ultérieure si le parcours d'installation
  n'est pas validé.

Vérification :

```bash
pnpm test:integration -- resend
pnpm test:integration -- discord
pnpm test:e2e -- alert-delivery
```

Critères de sortie : une alerte est reçue en staging dans les 60 secondes suivant
la détection, la reprise est reçue après un nouveau heartbeat, et le test de
canal est limité par utilisateur.

Rollback : désactiver l'adaptateur concerné par feature flag ; les livraisons
restent en attente dans l'outbox.

### Étape 9 - Dashboard et parcours utilisateur

Contexte : la valeur du produit dépend de la compréhension immédiate de l'état
et de l'installation du heartbeat.

Tâches :

- créer les écrans connexion, liste, création, détail et incidents ;
- créer une section compte permettant la suppression avec confirmation forte ;
- afficher clairement `healthy`, `late`, `paused` et `pending` ;
- afficher le snippet `curl`, un bouton copier et la dernière date reçue ;
- rendre visibles les canaux et leur état de test ;
- ajouter les actions pause, reprise, rotation et suppression avec confirmation ;
- gérer les états vides, erreurs réseau, chargement et accessibilité clavier ;
- appliquer un design responsive sans dépendre d'une capture marketing.

Vérification :

```bash
pnpm test:e2e -- dashboard
pnpm test:e2e -- monitor-lifecycle
pnpm test:a11y -- dashboard
```

Critères de sortie : un nouvel utilisateur crée un moniteur et obtient une URL
en moins de 30 secondes lors du test manuel, et les parcours critiques sont
utilisables au clavier.

Rollback : masquer les nouveaux écrans par feature flag ; les APIs et données
restent rétrocompatibles.

### Étape 10 - Sécurité, observabilité et tests de charge

Contexte : l'URL de heartbeat est un secret et chaque erreur d'isolation peut
exposer les moniteurs d'un autre client.

Tâches :

- revoir RLS, service roles, secret handling, CSRF et validation d'entrées ;
- bloquer les destinations internes pour les futurs webhooks génériques ;
- ajouter logs structurés avec IDs de requête, sans token ni destinataire brut ;
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
pnpm test:e2e
pnpm test:load
```

Critères de sortie : aucune vulnérabilité critique ou élevée connue, aucun
secret dans le diff, et les métriques permettent de distinguer une panne du
checker d'une panne d'un client.

Rollback : revenir au déploiement précédent est sans risque uniquement si les
migrations du lot sont additives ; tester la compatibilité descendante avant
la publication.

### Étape 11 - Déploiement, staging et lancement pilote

Contexte : le produit doit prouver la boucle complète sur l'infrastructure
hébergée avant d'inviter des utilisateurs.

Tâches :

- provisionner Supabase de staging et de production avec migrations rejouées ;
- configurer les secrets dans le gestionnaire de l'hébergeur ;
- déployer l'application et le scheduler avec des environnements séparés ;
- exécuter le smoke test : inscription, création, ping, retard simulé, alerte,
  reprise, suppression du moniteur et suppression du compte de test ;
- vérifier les sauvegardes et documenter une restauration testée ;
- rédiger un runbook incident : checker arrêté, fournisseur e-mail indisponible,
  fuite de token et rollback ;
- limiter l'inscription par invitation pour le pilote ;
- mesurer activation, taux d'alertes utiles et faux positifs.

Vérification :

```bash
pnpm build
pnpm test:e2e -- staging
pnpm exec supabase db lint --linked
```

Critères de sortie : le parcours complet fonctionne en staging sur un vrai
script cron, les alertes arrivent, la reprise est détectée et le runbook est
versionné.

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

| Risque | Décision attendue |
| --- | --- |
| Scheduler trop lent ou limité | choisir un fournisseur et une fréquence minimale |
| URL de ping découverte par des scanners | accepter POST uniquement et faire tourner le token |
| Alertes perdues | valider l'outbox, les retries et le watchdog |
| Fuite inter-tenant | valider RLS, RPC, rôles et tests d'isolation |
| Coût des heartbeats fréquents | fixer la fréquence minimale et mesurer le coût réel |
| Faux positifs | choisir des presets et une marge par défaut raisonnables |
| Fuseaux horaires | reporter les vrais calendriers après le MVP d'intervalle |

## 11. Porte de validation

Avant l'étape 1, l'utilisateur doit valider :

- la cible d'une démo en un jour ou d'un MVP fiable en 4 à 6 jours ;
- le mode de schedule fondé sur intervalle + marge ;
- le scheduler et sa fréquence minimale ;
- l'ordre de priorité des canaux : e-mail, puis Discord, puis Telegram ;
- le report explicite du paiement, considéré comme non critique pour le pilote ;
- les six ADR proposés ;
- le plafond de coût mensuel du pilote.

Tant que ces points ne sont pas validés, aucune migration, aucun composant UI
et aucune infrastructure ne doivent être créés.
