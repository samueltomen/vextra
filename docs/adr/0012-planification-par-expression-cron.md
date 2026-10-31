# ADR 0012 — Planification par expression cron et fuseau horaire

- **Statut** : Accepté
- **Date** : 2026-10-31

## Contexte

Un moniteur n'attendait qu'un intervalle fixe. Or la plupart des tâches réelles
suivent un calendrier (« chaque jour à 03:00 », « jours ouvrés à 09:00 »), dans
un fuseau donné, avec changements d'heure. Un intervalle d'un jour ne reflète ni
un horaire précis ni l'heure d'été.

## Décision

- **Deux types de planification** : intervalle (inchangé) ou expression cron à
  5 champs (alias `@daily`…, noms `MON`/`JAN`, règle jour du mois / jour de la
  semaine « OU » de Vixie) associée à un fuseau IANA.
- **Moteur dans le domaine** (`packages/domain`, sans dépendance) :
  `nextCronOccurrence`, `upcomingCronOccurrences`, `maxCronGapSeconds`, calcul
  des fuseaux par `Intl.DateTimeFormat`, heures inexistantes ou répétées lors
  des changements d'heure gérées explicitement.
- **Échéance = prochaine occurrence après le dernier signal + marge.** La base
  ne sait pas évaluer du cron : à la création, au changement de planification ou
  après un signal, une échéance **provisoire** (`intervalle = plus long écart
entre deux occurrences + 1 h`) est posée et le moniteur est marqué
  `cron_deadline_stale`. Le passage planifié (chaque minute) commence par
  **affiner** ces échéances (`claim_stale_cron_monitors` puis `set_cron_deadline`,
  réservés au rôle service) avant de vérifier les retards ; l'affinage est
  refusé si un signal est arrivé entre-temps (comparaison du dernier signal), le
  moniteur est alors simplement re-marqué.
- **Contrats** : la création et la modification acceptent l'union
  `{ intervalSeconds, graceSeconds }` ou `{ cron, timezone, graceSeconds }` ;
  une expression invalide renvoie 422 `invalid_cron`.
- **Interface** : bascule Intervalle / Expression cron, préréglages, choix du
  fuseau (par défaut celui des préférences) et aperçu des prochaines
  exécutions calculées localement avec le même moteur.

## Alternatives écartées

- **Évaluer le cron en SQL** (extension `pg_cron` ou fonction maison) :
  indisponible ou différente selon les installations Supabase, donc non
  reproductible en auto-hébergement.
- **Calculer l'échéance dans le chemin du ping** : alourdit le point le plus
  sollicité et le rend dépendant du moteur cron.
- **Bibliothèque tierce** (cron-parser…) : dépendance supplémentaire pour un
  besoin borné et déjà couvert par des tests.

## Conséquences

- L'échéance exacte d'un moniteur cron est posée au plus tard une minute après
  un signal ; l'échéance provisoire, plus tardive, évite toute fausse alerte
  dans l'intervalle.
- Le moteur est testé sur les changements d'heure (printemps, automne) et les
  planifications impossibles (`0 0 31 2 *`, rejetées à la saisie).
- Un moniteur cron conserve un `interval_seconds` dérivé, utilisé pour les
  métriques et comme repli.
