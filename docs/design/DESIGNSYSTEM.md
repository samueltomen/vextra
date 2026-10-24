# CronPing - Design System V1

Ce document est la référence visuelle de la V1.

- **Statut** : proposition pour la V1
- **Date** : 2026-10-24
- **Plateforme** : application web responsive, thème clair en priorité
- **Bibliothèque de composants** : HeroUI
- **Source de vérité visuelle** : tokens CSS de ce document

## 1. Intention

CronPing doit inspirer le calme et la précision. L'interface surveille des
tâches invisibles ; elle doit rendre leur état immédiatement compréhensible sans
créer d'anxiété ni surcharger l'utilisateur.

Direction retenue : **salle de contrôle calme**. Une interface lumineuse,
structurée et presque éditoriale, avec peu d'effets, des frontières nettes et
un bleu d'action unique. Les couleurs sémantiques sont réservées aux états.

### Principes

1. **L'état avant le décor.** Un moniteur doit être compris en moins de deux
   secondes grâce à son statut, son dernier heartbeat et sa prochaine échéance.
2. **Une action principale par écran.** Le reste est secondaire, discret et
   accessible au clavier.
3. **Densité maîtrisée.** Assez compact pour surveiller plusieurs moniteurs,
   assez aéré pour rester lisible.
4. **La sécurité est visible.** Les secrets sont masqués, les actions
   destructives sont confirmées et les messages ne révèlent aucune donnée
   d'exécution.
5. **Aucune information par la couleur seule.** Chaque statut associe couleur,
   icône et libellé.
6. **Pas de décoration sans fonction.** Pas de dégradé, de verre dépoli, de
   blob, d'illustration générique ou d'animation de démonstration.

### Ton produit

Court, factuel et rassurant. Les messages décrivent ce qui s'est passé et
l'action possible, sans anthropomorphisme ni urgence artificielle.

Exemples :

- « Heartbeat reçu il y a 2 minutes. »
- « Aucun heartbeat depuis 26 minutes. »
- « Surveillance en pause. »
- « Le token a été remplacé. L'ancien token ne fonctionne plus. »

## 2. Périmètre V1

La V1 définit :

- les tokens de couleur, typographie, espacement, rayon, ombre et mouvement ;
- HeroUI comme unique bibliothèque de composants interactive ;
- les composants nécessaires à la connexion, au dashboard, à la création d'un
  moniteur, au détail d'un moniteur et aux réglages des notifications ;
- les états normal, survolé, actif, focus, désactivé, chargement, vide et
  erreur ;
- les règles responsive et d'accessibilité ;
- les règles d'affichage des statuts et des secrets ;
- les critères de validation avant intégration.

La V1 ne définit pas encore :

- le mode sombre ;
- les thèmes personnalisés par tenant ;
- les graphiques temporels avancés ;
- les illustrations de marque ;
- une bibliothèque marketing complète ;
- le mode compact pour très grands volumes.

Ces éléments ne doivent pas être ajoutés sans validation et nouvelle version du
design system.

### Socle HeroUI

HeroUI est la base officielle des composants de la V1. Il fournit notamment les
boutons, champs, switches, modales, alertes, toasts, tableaux et skeletons.
Tailwind CSS reste utilisé pour la composition et les ajustements locaux.

Règles impératives :

- Bootstrap, `react-bootstrap`, les feuilles de style Bootstrap et Bootstrap
  Icons sont interdits ;
- aucun second kit de composants ne doit être ajouté sans décision explicite ;
- les composants HeroUI sont montés via un provider unique à la racine de la
  SPA ;
- le thème HeroUI est mappé vers les tokens de ce document, qui restent la
  source de vérité ;
- les variantes HeroUI par défaut ne doivent pas imposer une couleur, un rayon
  ou une ombre hors du système ;
- les wrappers locaux servent uniquement à appliquer les variantes CronPing et
  à préserver l'accessibilité, pas à recréer les comportements fournis par
  HeroUI ;
- les composants doivent être importés directement afin de préserver le
  tree-shaking ;
- le CSS global ne doit contenir ni reset Bootstrap ni classes utilitaires
  Bootstrap.

## 3. Identité visuelle

### Logotype

Le mot-symbole « CronPing » utilise la fonte UI en graisse 600 et un
interlettrage légèrement resserré. L'icône est un anneau simple avec un point
central, évocation d'un signal reçu. Elle ne dépend ni d'un dégradé ni d'une
animation.

L'icône seule peut servir de favicon. Le mot-symbole reste lisible à partir de
96 px de largeur. Ne pas déformer, ajouter d'ombre ou modifier ses couleurs
hors des tokens.

### Personnalité

- précision sans froideur ;
- calme sans passivité ;
- technique sans jargon ;
- contemporain sans effet de mode.

### Ce qu'il faut éviter

- dégradés violet-bleu ou vert-cyan ;
- cartes en verre dépoli ;
- angles excessivement arrondis sur tous les éléments ;
- ombres portées larges et sombres ;
- grandes zones d'illustration générique ;
- animations permanentes ;
- badges partout ;
- texte centré sur plusieurs lignes ;
- couleurs vives sans signification d'état.

## 4. Couleurs

La palette est optimisée pour un thème clair. Les composants consomment
uniquement les variables sémantiques, jamais les valeurs hexadécimales
directement.

### Contrastes vérifiés

| Usage              | Combinaison             | Ratio   |
| ------------------ | ----------------------- | ------- |
| Texte principal    | `#151A1D` sur `#F7F8F6` | 16,46:1 |
| Texte principal    | `#151A1D` sur `#FFFFFF` | 17,54:1 |
| Texte secondaire   | `#5D6670` sur `#FFFFFF` | 5,83:1  |
| Texte discret      | `#6A737C` sur `#F7F8F6` | 4,53:1  |
| Libellé sur action | `#FFFFFF` sur `#1F5EFF` | 5,12:1  |
| Succès             | `#0E6245` sur `#E6F6EF` | 6,59:1  |
| Attention          | `#7A4600` sur `#FFF3D6` | 7,04:1  |
| Danger             | `#A12822` sur `#FDECEA` | 6,46:1  |
| Focus sur surface  | `#1F5EFF` sur `#FFFFFF` | 5,12:1  |

Tous les textes normaux doivent atteindre au moins 4,5:1. Les composants
d'interface non textuels doivent atteindre au moins 3:1. La bordure
`--color-border-interactive` est réservée aux limites de champs et de contrôles.

### Règles d'usage

- Le bleu `action` sert uniquement aux actions, liens et focus.
- Le vert, l'ambre et le rouge servent uniquement aux états sémantiques.
- Le fond `canvas` sépare la page des surfaces blanches.
- Le texte secondaire ne doit pas porter une information critique.
- Une bordure seule ne peut pas signaler une erreur : ajouter une icône et un
  message.
- Les couleurs de statut ne sont jamais utilisées comme fond de page complet.

### Tokens CSS

```css
:root {
  color-scheme: light;

  /* Typographie */
  --font-sans: 'Instrument Sans', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'Geist Mono', ui-monospace, 'SFMono-Regular', monospace;

  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-md: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.75rem;
  --text-3xl: 2.25rem;
  --text-4xl: 3rem;

  --leading-xs: 1rem;
  --leading-sm: 1.25rem;
  --leading-md: 1.5rem;
  --leading-lg: 1.75rem;
  --leading-xl: 2.25rem;
  --leading-3xl: 2.75rem;
  --leading-2xl: 3.5rem;

  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --tracking-tight: -0.02em;
  --tracking-normal: 0;

  /* Alias typographiques sémantiques */
  --type-display: var(--text-4xl);
  --type-h1: var(--text-3xl);
  --type-h2: var(--text-2xl);
  --type-h3: var(--text-xl);
  --type-body-lg: var(--text-lg);
  --type-body: var(--text-md);
  --type-label: var(--text-sm);
  --type-caption: var(--text-xs);
  --leading-display: var(--leading-2xl);
  --leading-h1: var(--leading-3xl);
  --leading-h2: var(--leading-xl);
  --leading-h3: var(--leading-lg);
  --leading-body-lg: var(--leading-lg);
  --leading-body: var(--leading-md);
  --leading-label: var(--leading-sm);
  --leading-caption: var(--leading-xs);

  /* Couleurs de base */
  --color-canvas: #f7f8f6;
  --color-surface: #ffffff;
  --color-surface-subtle: #eef0ec;
  --color-text: #151a1d;
  --color-text-muted: #5d6670;
  --color-text-subtle: #6a737c;
  --color-border-subtle: #d7dbd6;
  --color-border-strong: #7a858e;

  /* Action */
  --color-action: #1f5eff;
  --color-action-hover: #1747c8;
  --color-action-soft: #e9efff;
  --color-on-action: #ffffff;

  /* États sémantiques */
  --color-healthy-fg: #0e6245;
  --color-healthy-bg: #e6f6ef;
  --color-healthy-border: #a7d8c4;
  --color-warning-fg: #7a4600;
  --color-warning-bg: #fff3d6;
  --color-warning-border: #e9c46a;
  --color-danger-fg: #a12822;
  --color-danger-bg: #fdecea;
  --color-danger-border: #f2b8b5;
  --color-danger-action: #a12822;
  --color-danger-action-hover: #8f1f1a;
  --color-on-danger: #ffffff;
  --color-neutral-fg: #36414b;
  --color-neutral-bg: #eef1f3;
  --color-neutral-border: #cbd2d7;

  /* Focus */
  --focus-ring-color: #1f5eff;
  --focus-ring-width: 2px;
  --focus-ring-offset: 2px;

  /* Espacement */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.25rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-10: 2.5rem;
  --space-12: 3rem;
  --space-16: 4rem;
  --space-20: 5rem;
  --space-24: 6rem;

  /* Rayons */
  --radius-xs: 0.25rem;
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-full: 999px;

  /* Ombres */
  --shadow-xs: 0 1px 2px rgb(21 26 29 / 6%);
  --shadow-overlay:
    0 16px 40px rgb(21 26 29 / 12%), 0 2px 8px rgb(21 26 29 / 8%);

  /* Contrôles et layout */
  --control-height-sm: 2rem;
  --control-height-md: 2.5rem;
  --control-height-lg: 2.75rem;
  --sidebar-width: 14.5rem;
  --topbar-height: 4rem;
  --content-max: 75rem;

  /* Mouvement */
  --motion-fast: 120ms;
  --motion-base: 180ms;
  --motion-slow: 240ms;
  --ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1);

  /* Profondeur */
  --z-sticky: 20;
  --z-dropdown: 30;
  --z-overlay: 40;
  --z-modal: 50;
  --z-toast: 60;
}
```

## 5. Typographie

### Familles

- UI : **Instrument Sans**, police variable auto-hébergée en WOFF2.
- Code et secrets : **Geist Mono**, police variable auto-hébergée en WOFF2.
- Ne pas charger les polices depuis un CDN tiers.
- Précharger uniquement les fichiers nécessaires et limiter les variantes.

### Échelle

| Token     | Taille / interligne | Usage                        |
| --------- | ------------------- | ---------------------------- |
| `display` | 48 / 56 px          | Accueil public uniquement    |
| `h1`      | 36 / 44 px          | Titre de page desktop        |
| `h2`      | 28 / 36 px          | Section majeure              |
| `h3`      | 20 / 28 px          | Sous-section, titre de carte |
| `body-lg` | 18 / 28 px          | Introduction courte          |
| `body`    | 16 / 24 px          | Texte courant                |
| `label`   | 14 / 20 px          | Labels et boutons            |
| `caption` | 12 / 16 px          | Métadonnées non critiques    |

Sur mobile, `h1` passe à 30/36 px et `h2` à 24/32 px. Aucun texte de corps ne
descend sous 16 px.

Les titres utilisent un interlettrage de `-0.02em`. Les libellés de boutons ne
sont pas mis en majuscules. Les valeurs techniques et les tokens utilisent la
fonte monospace à 13–14 px.

## 6. Espacement, grille et responsive

La base est un pas de 4 px. Les composants utilisent de préférence les pas 4,
8, 12, 16, 24, 32 et 48. Les valeurs arbitraires sont interdites hors mesure
ponctuelle documentée.

### Layout

- Contenu maximal : 1200 px.
- Sidebar desktop : 232 px.
- Barre supérieure : 64 px.
- Marge de page desktop : 32 px.
- Marge de page tablette : 24 px.
- Marge de page mobile : 16 px.
- Grille desktop : 12 colonnes, gouttière de 24 px.
- Grille tablette : 8 colonnes, gouttière de 20 px.
- Grille mobile : 4 colonnes, gouttière de 16 px.

### Breakpoints

| Nom  | Largeur |
| ---- | ------- |
| `sm` | 640 px  |
| `md` | 768 px  |
| `lg` | 1024 px |
| `xl` | 1280 px |

En dessous de 768 px :

- la sidebar devient un panneau ouvert depuis l'en-tête ;
- les actions secondaires passent dans un menu contextuel ;
- les tableaux de moniteurs deviennent des cartes empilées ;
- les formulaires restent sur une colonne ;
- les zones tactiles principales font au moins 44 × 44 px.

Le layout doit rester utilisable à 200 % de zoom et à 320 px de largeur.

## 7. Formes, bordures et élévation

- Boutons et champs : rayon 8 px.
- Cartes et panneaux : rayon 12 px.
- Petits éléments internes : rayon 4 à 6 px.
- Badges de statut : rayon complet uniquement pour ce cas.
- Bordures ordinaires : 1 px, couleur subtile.
- Champs interactifs : bordure `border-strong` à 1 px.
- Les cartes normales utilisent une bordure, pas une ombre.
- Les ombres sont réservées aux menus, dialogues et toasts.
- Aucun composant ne combine bordure forte, ombre large et fond coloré.

## 8. Mouvement

Le mouvement explique un changement d'état sans attirer l'attention.

- Survol et focus : 120 ms.
- Ouverture d'un menu ou changement visuel : 180 ms.
- Entrée ou sortie d'un dialogue : 240 ms.
- Propriétés animées : `opacity` et `transform` uniquement.
- Pas d'animation en boucle, de parallaxe ou d'animation au scroll.
- Sous `prefers-reduced-motion`, toutes les animations non essentielles sont
  supprimées et les transitions sont ramenées à 0,01 ms.
- Un feedback de chargement doit rester compréhensible sans animation.

## 9. Icônes

- Bibliothèque recommandée : Lucide React avec import ciblé.
- Bootstrap Icons est interdit.
- Taille standard : 16 px dans le texte, 20 px dans les actions, 24 px dans les
  états vides.
- Trait cohérent, sans mélange de familles d'icônes.
- Une icône seule dans un bouton exige un nom accessible.
- Une icône décorative utilise `aria-hidden="true"`.
- Les statuts associent toujours une icône et un texte lisible.

## 10. Statuts

| Statut     | Libellé                         | Icône                | Tokens  |
| ---------- | ------------------------------- | -------------------- | ------- |
| `pending`  | En attente du premier heartbeat | horloge              | neutral |
| `healthy`  | Opérationnel                    | check dans un cercle | healthy |
| `late`     | Heartbeat en retard             | triangle d'alerte    | warning |
| `paused`   | Surveillance en pause           | pause                | neutral |
| `incident` | Incident ouvert                 | cloche ou alerte     | danger  |

Règles :

- Le badge contient une icône, un point ou une forme, puis le libellé.
- « En retard » n'est pas remplacé par « Down » dans la V1.
- Un point coloré seul ne suffit jamais.
- Le statut doit être annoncé par un texte lisible, pas uniquement par
  `aria-label` sur une couleur.
- Un état tardif est visible dans l'en-tête du moniteur, son badge et son
  message de dernière activité.

## 11. Composants V1

Chaque composant interactif est construit sur HeroUI puis habillé avec les
tokens CronPing. Les éléments purement métier, comme `MonitorRow`,
`StatusSummary` et `CodeSnippet`, sont des compositions locales autorisées.

| Composant CronPing         | Base HeroUI                                          |
| -------------------------- | ---------------------------------------------------- |
| `Button`                   | `Button`                                             |
| `IconButton`               | `Button` avec mode icône seule                       |
| `Field`, `Input`, `Select` | `Input`, `Select` et composition de formulaire       |
| `Switch`                   | `Switch`                                             |
| `StatusBadge`              | `Chip`                                               |
| `MonitorRow`               | ligne de `Table`, puis composition responsive locale |
| `Dialog`                   | `Modal`                                              |
| `Toast`                    | `Toast`                                              |
| `Banner`                   | `Alert`                                              |
| `Skeleton`                 | `Skeleton`                                           |
| `EmptyState`               | composition locale de `Card`, `Button` et icône      |

### Button

Variantes :

- `primary` : fond action, texte blanc ;
- `secondary` : surface, bordure interactive ;
- `ghost` : sans fond, pour les actions tertiaires ;
- `danger` : fond `--color-danger-action`, texte `--color-on-danger`, réservé
  aux confirmations destructives.

Hauteur standard : 40 px desktop, 44 px mobile. Padding horizontal : 16 px.
Rayon : 8 px. Texte : 14/20, graisse 600. Écart icône-texte : 8 px.

États obligatoires : default, hover, active, focus-visible, disabled,
loading. En chargement, la largeur du bouton ne doit pas changer.

### Link

Les liens dans le contenu utilisent `--color-action`, un soulignement visible et
un état hover plus foncé. Le focus reprend l'anneau standard. Un lien ne doit
pas être distingué uniquement par sa couleur. Les liens de navigation peuvent
omettre le soulignement s'ils ont un état actif et un contraste suffisant.

### IconButton

Zone visuelle de 40 px et cible tactile de 44 px. Toujours accompagnée d'un
nom accessible. Les actions destructives ne doivent pas être seulement
iconiques sans confirmation.

### Field

Comprend un label visible, un contrôle, un texte d'aide optionnel et un message
d'erreur. Le label est placé au-dessus du champ et n'est jamais remplacé par un
placeholder.

Champs : hauteur 40 px desktop, 44 px mobile, rayon 8 px, fond surface,
bordure interactive. Focus : anneau de 2 px, décalage de 2 px.

L'erreur ajoute une bordure danger, une icône et un message relié au champ par
`aria-describedby`. Le texte d'aide est associé de la même manière.

### Input et Select

- Texte de saisie à 16 px sur mobile pour éviter le zoom automatique.
- Le placeholder est un exemple, jamais un label.
- Un select conserve une valeur lisible, pas seulement un identifiant.
- Les champs numériques affichent leur unité hors du contrôle.

### Switch

Le contrôle complet fait au moins 44 px de haut avec son libellé. L'état est
lisible sans couleur grâce à la position et au texte « Activé » ou
« Désactivé ». Le changement est immédiat et annoncé accessiblement.

### StatusBadge

Hauteur 24 px, rayon complet, texte 12/16 graisse 600, icône 14 px. Le fond,
le texte et la bordure proviennent des tokens sémantiques. Le badge ne doit pas
être cliquable.

### MonitorRow

Liste desktop :

- nom local ;
- statut ;
- dernier heartbeat ;
- prochaine échéance ;
- actions ;
- hauteur minimale de 64 px.

Sur mobile, la ligne devient une carte avec le nom et le statut en première
ligne, les dates en seconde ligne et les actions dans un menu.

La ligne entière est un lien vers le détail. Les actions internes ne déclenchent
pas la navigation.

### StatusSummary

Bandeau compact au-dessus de la liste :

- nombre de moniteurs opérationnels ;
- nombre en retard ;
- nombre en pause ;
- dernier rafraîchissement.

Ne pas afficher un grand graphique si aucune tendance historique n'est
conservée. Les chiffres suffisent à la V1.

### CodeSnippet et SecretField

- Fond neutre, bordure subtile, rayon 8 px.
- Fonte monospace à 13–14 px.
- Le contenu technique se retourne sans provoquer de scroll horizontal sur
  mobile.
- Un bouton « Copier » de 44 px est toujours disponible.
- Le token complet est visible une seule fois, avec un avertissement explicite.
- Après fermeture, seul le préfixe est affiché.
- La commande utilise `CRONPING_TOKEN` et ne contient jamais de token en clair.
- La rotation demande une confirmation.

### Dialog

Utilisé pour les confirmations destructives et la révélation exceptionnelle d'un
secret. Largeur maximale de 480 px. Titre, description, action principale et
action d'annulation. Focus déplacé dans le dialogue puis restitué au
déclencheur. Échap ferme, sauf pendant une opération irréversible en cours.

### Toast

Message court, non bloquant, en haut à droite desktop et en bas mobile. Largeur
maximale 400 px. Un toast de succès utilise `role="status"` ; une erreur utilise
`role="alert"`. Ne jamais y placer un token, un e-mail ou un webhook.

### Banner

Message persistant dans le contenu pour une information importante : moniteur
en retard, perte de connexion ou action requise. Il conserve le flux normal de
la page et ne flotte pas au-dessus du contenu.

### EmptyState

Titre orienté action, explication en une phrase et un seul bouton principal.
Exemple : « Aucun moniteur pour le moment » avec « Créer un moniteur ».

### Skeleton

Utilisé uniquement pour les zones dont la structure est connue. Pas de
scintillement : une variation d'opacité lente ou un fond statique suffit. Le
contenu final doit réserver la même place afin d'éviter les sauts de layout.

## 12. Pages et hiérarchie

### Connexion

Une seule colonne, largeur maximale de 400 px, centrée verticalement. Le nom du
produit et une phrase courte suffisent. Pas de grand visuel marketing.

### Dashboard

Ordre :

1. titre de page ;
2. résumé des statuts ;
3. bouton principal « Créer un moniteur » ;
4. liste des moniteurs ;
5. état vide si la liste est vide.

Le premier écran doit rester utile à 1024 × 768 px sans scroll excessif.

### Création d'un moniteur

Formulaire sur une colonne avec les champs suivants :

- libellé local ;
- fréquence attendue ;
- marge ;
- canal de notification.

Un résumé statique de la règle de détection apparaît avant validation. Le
libellé est clairement présenté comme stocké localement.

### Détail d'un moniteur

En-tête avec libellé local, identifiant court, statut et actions. Le panneau
principal contient la commande heartbeat et les dates importantes. Le panneau
secondaire contient les canaux de notification, l'historique d'incidents et les
actions sensibles.

### Réglages des notifications

Chaque canal est une carte avec type, état, moyen de test et action de
suppression. Les secrets sont affichés sous forme masquée. Le statut de test est
textuel et non seulement coloré.

## 13. Contenu et formulation

- Utiliser le français en V1, avec des libellés prêts pour une extraction i18n.
- Écrire en sentence case.
- Les boutons décrivent l'action : « Créer un moniteur », « Tester le canal ».
- Une confirmation destructive nomme la conséquence : « Supprimer ce
  moniteur ? »
- Ne jamais afficher une stack trace, un token ou un webhook complet.
- Les dates affichent une valeur relative et une valeur absolue accessible.
- Les fuseaux horaires sont affichés lorsque le contexte peut prêter à
  confusion.
- Les erreurs indiquent quoi corriger, sans blâmer l'utilisateur.

## 14. Confidentialité dans l'interface

- Le libellé du moniteur est décrit comme local à l'appareil.
- La commande heartbeat ne contient jamais le token en clair.
- Le token complet n'apparaît qu'une seule fois.
- Après création ou rotation, un avertissement rappelle qu'il ne sera plus
  affiché.
- Les adresses e-mail et webhooks sont masqués dans les listes.
- Les écrans ne présentent aucun contenu de script, de cron ou de log.
- Les messages d'erreur ne doivent pas inclure le token reçu.

## 15. Accessibilité

La V1 vise WCAG 2.2 AA.

- Contraste de 4,5:1 minimum pour le texte normal.
- Contraste de 3:1 minimum pour les grands textes et contrôles nécessaires.
- Focus visible de 2 px avec décalage de 2 px sur tous les éléments
  interactifs.
- Navigation complète au clavier.
- Ordre de focus logique et absence de piège hors dialogues.
- Cibles tactiles recommandées à 44 × 44 px, jamais inférieures à 24 × 24 px.
- `label` explicite pour chaque champ.
- Messages d'erreur reliés au champ et annoncés.
- Statuts critiques annoncés via `role="status"` ou une région live adaptée.
- Aucun texte porteur d'information en image.
- Respect de `prefers-reduced-motion`.
- Aucune information ne dépend uniquement du vert, de l'ambre ou du rouge.
- Le contenu reste lisible avec une largeur de 320 px et à 200 % de zoom.

## 16. Implémentation

Lors de la création du code :

- placer les tokens dans `apps/web/src/styles/tokens.css` ;
- placer les styles de base dans `apps/web/src/styles/base.css` ;
- exposer les composants partagés dans `apps/web/src/components/ui/` ;
- utiliser des classes sémantiques ou les variables CSS dans Tailwind ;
- interdire les hexadécimaux arbitraires dans les composants ;
- construire les composants interactifs sur HeroUI et limiter les wrappers
  locaux aux variantes et compositions métier ;
- monter `HeroUIProvider` une seule fois, au-dessus du router et du client
  TanStack Query ;
- configurer le thème HeroUI à partir des tokens CSS sans recopier les couleurs
  dans un second fichier de thème ;
- vérifier l'intégration de navigation du provider avec la version installée de
  TanStack Router lors de l'initialisation du projet ;
- interdire toute dépendance Bootstrap, `react-bootstrap`, Bootstrap Icons ou
  feuille de style Bootstrap ;
- importer les icônes individuellement ;
- ne jamais charger une police depuis un CDN tiers ;
- documenter chaque variante avec un exemple exécutable.

La structure recommandée des couches CSS est :

```css
@layer tokens, reset, base, components, utilities;
```

## 17. Critères d'acceptation V1

La V1 est prête lorsque :

- [ ] tous les composants utilisent les tokens du document ;
- [ ] HeroUI est l'unique bibliothèque de composants ;
- [ ] aucune dépendance, aucun import ni fichier CSS Bootstrap n'est présent ;
- [ ] `HeroUIProvider` est monté une seule fois et le thème HeroUI pointe vers
      les tokens CSS ;
- [ ] aucun hexadécimal arbitraire n'existe dans les composants ;
- [ ] chaque état possède un focus visible et un état désactivé ;
- [ ] les statuts sont lisibles sans couleur ;
- [ ] les parcours connexion, création, détail, copie du heartbeat et rotation
      du token sont utilisables au clavier ;
- [ ] les cibles tactiles respectent les tailles minimales ;
- [ ] les contrastes sont vérifiés automatiquement ;
- [ ] les captures desktop, tablette et mobile ne présentent pas de
      débordement ;
- [ ] les états chargement, vide, erreur et succès sont documentés ;
- [ ] aucun token, webhook, e-mail ou contenu de script n'apparaît dans un toast
      ou un log frontend ;
- [ ] `prefers-reduced-motion` est respecté ;
- [ ] les composants passent les tests d'accessibilité automatiques et une
      vérification clavier manuelle.

## 18. Décisions différées

Les éléments suivants nécessitent une validation ultérieure :

- mode sombre ;
- densité compacte ;
- thème personnalisé par tenant ;
- graphiques de latence ou de disponibilité ;
- illustrations et imagerie de marque ;
- bibliothèque publiée hors du monorepo ;
- version anglaise et stratégie i18n complète.
