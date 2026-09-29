# Direction artistique « Partition »

Version 1 — septembre 2026. Validée pour Compta Zik, thème clair et thème nuit.

Ce document est la référence visuelle du frontend. Toute évolution d'interface s'y conforme ; si la DA doit changer, on met à jour ce document **et** `tokens.css` dans le même commit.

| Fichier | Rôle |
| --- | --- |
| `docs/design/partition.md` | Ce document : intentions, règles, composants, écrans. |
| `docs/design/tokens.css` | Jetons CSS (couleurs, typos, rayons) clair + nuit, prêts à intégrer. |
| `docs/design/maquettes/*.dc.html` | Sources des maquettes. Valeurs exactes (tailles, espacements, couleurs) à consulter en cas de doute. Voir `maquettes/README.md`. |

Maquettes interactives (canevas Claude, privé) : https://claude.ai/artifact/RtnFxWSU9yKewzE8BaJDRg

---

## 1. Intention

Une comptabilité qui se lit comme une partition : chaque trimestre est un mouvement, chaque semaine une mesure, chaque vacance une pause.

1. **Le papier avant l'écran.** Fond crème, cartes blanc cassé, filets fins à la place des ombres portées. L'outil évoque le cahier de comptes, pas le logiciel d'entreprise.
2. **Les chiffres en majesté.** Montants clés en serif ; colonnes en chiffres tabulaires alignés à droite. Le pétrole signale l'action, le laiton ce qui demande l'attention.
3. **La portée comme grille.** Cinq filets pour les graphiques, les semaines comme des mesures, les vacances hachurées comme des pauses. Le musical reste dans la structure, jamais en décor (pas de notes de musique décoratives, pas d'emoji).

## 2. Couleurs

Toujours passer par les variables de `tokens.css`, jamais de couleur en dur dans les composants.

| Rôle | Variable | Clair | Nuit |
| --- | --- | --- | --- |
| Fond | `--paper` | `#F4EFE6` | `#0F1A1E` |
| Barre latérale | `--paper-deep` | `#EDE6D8` | `#0B1417` |
| Carte | `--card` | `#FFFCF6` | `#16252A` |
| En-tête de carte | `--card-alt` | `#F8F4EC` | `#1B2C31` |
| Filet | `--line` | `#DCD3C2` | `#2A3B40` |
| Rail (sur une carte) | `--rail` | `#EAE3D5` | `#22333A` |
| Texte | `--ink` | `#13262C` | `#EDE6D8` |
| Texte secondaire | `--ink-muted` | `#56676C` | `#93A3A5` |
| Action · présent | `--petrol` | `#0B5563` | `#57A8AE` |
| Pétrole teinté | `--petrol-tint` | `#DCEBE9` | `#173A40` |
| Laiton | `--brass` | `#C08A1E` | `#D9A23A` |
| Laiton texte | `--brass-ink` | `#7E5608` | `#E3B45C` |
| Laiton teinté | `--brass-tint` | `#F5E7C8` | `#3A2E16` |
| Sauge · subvention | `--sage` | `#8DB5AE` | `#A9CFC5` |
| Brique · absence | `--brick` | `#A33A25` | `#E0735C` |
| Brique teintée | `--brick-tint` | `#F7E1DA` | `#3A1E18` |

Règles :

- **Pétrole** = action principale, état « présent », liens, progression. Une seule action pétrole pleine par zone.
- **Laiton** = attention et « en cours » : semaine courante, trimestre en cours, montants restant à facturer, éléments à traiter. Jamais pour une action.
- **Brique** = absence, erreur, suppression. Jamais en décor.
- **Sauge** = réservée à la subvention dans les graphiques.
- En nuit, le texte posé sur un fond pétrole ou laiton plein devient **sombre** (`--on-petrol`, `--on-brass`).
- Contraste minimum 4,5:1 pour le texte (3:1 au-delà de 24 px). Les couleurs à distinguer diffèrent aussi en luminosité, pas seulement en teinte.
- Ajustements après audit de contraste (étape 7) : `--ink-faint` foncé (clair `#5A6A6E`, nuit `#8A9A9D`) car les valeurs des maquettes (`#7B8A8E` / `#768689`) restaient sous 4,5:1 pour les en-têtes de tableau et libellés de navigation ; en clair, `--on-brass` devient sombre (`#13262C`) : le blanc sur `--brass` (en-tête de la semaine courante) n'atteignait que 3:1.

## 3. Typographie

| Famille | Variable | Usage | Graisses |
| --- | --- | --- | --- |
| Instrument Serif | `--font-display` | Titres de page, montants clés (KPI, totaux), noms de trimestres, titres de groupes | 400 + italique |
| Hanken Grotesk | `--font-ui` | Toute l'interface, tableaux, boutons | 400 à 800 |
| IBM Plex Mono | `--font-mono` | Numéros de semaine, dates, horaires, références de documents, axes de graphique | 400, 500 |

Les trois sont sous licence SIL OFL. **Les vendoriser en woff2 dans `src/vendor/`** comme Manrope aujourd'hui (le frontend n'appelle aucun CDN). Manrope peut ensuite être retirée.

`font-variant-numeric: tabular-nums` est appliqué globalement sur `body`.

Échelle :

| Élément | Police | Taille / graisse |
| --- | --- | --- |
| Titre de page (desktop) | display | 64 px, interligne 1 |
| Titre de page (mobile) | display | 34 px |
| Montant KPI | display | 40 px |
| Grand total | display | 48 px |
| Nom de trimestre, titre de groupe | display | 21–24 px |
| Titre de section (h2) | ui | 20 px, 700 |
| Corps, cellules de tableau | ui | 15 px |
| Libellé de champ, sous-titre | ui | 13–14 px, 600 |
| En-tête de tableau | ui | 12 px, 700, majuscules, interlettrage 0.06em |
| Libellé de groupe de navigation | ui | 11 px, 700, majuscules, interlettrage 0.08em |
| Sur-titre (date, période) | mono | 13 px |
| Axes, numéros de semaine | mono | 11–12 px |

Le logotype texte s'écrit « Compta *Zik* » en Instrument Serif 28 px, « Zik » en italique couleur `--wordmark-accent`, précédé d'un carré pétrole 38 px (rayon 10) contenant une double croche laiton.

## 4. Formes et espacements

- Rayons : 4 (barres), 8–10 (champs, cellules, items de navigation), 12 (petites cartes, boîte utilisateur), 16 (cartes principales), 999 (boutons, pastilles, contrôles segmentés).
- Bordures : 1 px `--line` sur les cartes. **Pas d'ombre portée** sur les cartes ; `--shadow-overlay` uniquement pour modales et menus.
- Hauteur des contrôles : 44 px minimum (cible tactile), 48 px pour l'action principale d'un en-tête.
- Espacements sur une base de 4 : 8, 12, 16, 20, 24, 36, 48. Page desktop : 36 px haut/bas, 48 px côtés. Écart entre cartes : 16 px.
- Barre latérale : 248 px de large.

## 5. Composants

### Boutons

| Variante | Style |
| --- | --- |
| Principal | Pilule, fond `--petrol`, texte `--on-petrol`, 700 |
| Secondaire | Pilule, contour 1.5 px `--ink`, fond transparent |
| Discret | Texte `--link` souligné (décalage 4 px), sans fond |
| Danger | Pilule, contour 1.5 px `--brick`, fond `--brick-tint`, texte `--brick-tint-ink` |

### Pastilles de statut

Statut d'année (`OPEN` / `REVIEWED` / `CLOSED`) :
- Ouverte : `--petrol-tint` / `--petrol-tint-ink`
- Revue : `--brass-tint` / `--brass-tint-ink`
- Clôturée : `--inverse-bg` / `--inverse-ink`

Statut de document (`DRAFT` / `GENERATED` / `SENT` / `CANCELLED`) :
- Brouillon : contour pointillé 1.5 px `--ink-faint`, texte `--ink-soft`
- Générée : `--petrol-tint` / `--petrol-tint-ink`
- Envoyée : `--petrol` / `--on-petrol`
- Annulée : fond `--rail`, texte `--ink-muted` barré

### Symboles de présence

| Statut API | Symbole |
| --- | --- |
| `PRESENT` | Rond plein 14 px `--att-present` |
| `ABSENT` | Cercle 10 px, bordure 2 px `--att-absent` |
| `CANCELLED` | Trait 14 × 2 px `--att-cancelled`, incliné à −45° |
| `UNRECORDED` | Point 4 px `--att-unrecorded` |
| Semaine de vacances | Fond de cellule `--hatch` (la saisie reste possible) |
| Semaine courante | Fond de colonne `--att-current-week`, en-tête plein `--brass` avec texte `--on-brass` |
| Séance facturée (verrouillée) | Symbole inchangé + petit cadenas 10 px `--ink-faint` en coin ; cellule non cliquable |

La forme porte le sens, pas seulement la couleur. Chaque cellule est un vrai `<button>` avec un `aria-label` du type « Léa Martin, semaine 36 : présent ».

### Contrôle segmenté (trimestres, filtres)

Conteneur pilule `--track` + bordure `--line`, padding 4 px. Option sélectionnée : fond `--inverse-bg`, texte `--inverse-ink`. Le trimestre en cours porte un point 7 px `--brass-bright`.

### Tuile KPI

Carte `--card`, rayon 16, padding 20 × 22. Libellé 14/600 `--ink-muted`, montant display 40 px, sous-titre 13 px. À droite, **trois mini-barres** (8 px de large, hauteur max 30 px) représentant T1, T2 et T3 en proportion ; les trimestres terminés en `--petrol`, le trimestre en cours en `--brass-bright`. Elles remplacent les images `kpi-meter-orange.png` et `kpi-waveform-green.png`. Un trimestre à venir a sa mini-barre en `--line`.

Variante « Subvention calculée » : fond `--petrol-deep`, texte `--on-petrol-deep` (clair en clair comme en nuit), libellés `--on-petrol-muted`.

### Graphique « Évolution par trimestre »

- Barres groupées par trimestre, 4 séries dans l'ordre : élèves, prestataires, subvention, dépenses (`--series-*`). Barres de 40 px, écart 8 px, coins supérieurs 4 px.
- **Cinq lignes horizontales** (la portée) : 4 filets `--line` + ligne 0 `--line-strong`. Axe à gauche en mono 11 px, max arrondi (ex. 5 000 / 3 750 / 2 500 / 1 250 / 0).
- Valeur au-dessus de chaque barre en mono 10.5 px, arrondie à l'euro.
- Le trimestre en cours a un fond laiton très léger derrière son groupe.
- Sous chaque groupe : nom du trimestre (display 24), semaines (mono 12), pastille « Terminé » (`--rail`), « En cours » (`--brass-tint`) ou « À venir » (contour `--line`).
- Légende en haut à droite, carrés 10 px.

### Répartition des sorties

Remplace le donut : grand total display 48 px, puis une **barre horizontale unique** de 18 px, découpée en segments (subvention en `--sage`, dépenses en `--brick`) séparés de 3 px, puis la liste des valeurs et pourcentages.

### Encart « À traiter »

Fond `--brass-tint`, texte `--brass-tint-ink`, rayon 12. Réservé aux actions en attente (brouillons, semaines non renseignées).

### Tableaux

En-tête 12/700 majuscules `--ink-faint`, séparé du corps par un filet `--line-strong`. Lignes séparées par `--line`, padding vertical 14 px. Montants alignés à droite. « À facturer » en `--brass-ink` gras. Avancement : rail 6 px `--rail`, remplissage `--petrol`.

### Toast

Fond `--inverse-bg`, texte `--inverse-ink`, rayon 14, pastille ronde pétrole avec une coche. Titre en gras + détail en `--ink-muted` inversé.

### Champ de saisie

Hauteur 44 px, rayon 10, bordure 1 px `--line` (un cran plus foncé au survol), fond `--card`, libellé 13/600 `--ink-muted` au-dessus.

### Icônes

Icônes linéaires, trait 2 px, 18 px dans la navigation, `currentColor`. Elles sont définies une seule fois dans le sprite SVG en tête du gabarit (`<symbol id="icon-…">` dans `src/main.js`) et utilisées par `<svg class="icon"><use href="#icon-…"></use></svg>`. Phosphor a été retiré (son sous-ensemble vendorisé ne contenait pas les glyphes utilisés). Pour une nouvelle icône, ajouter un `<symbol>` 24 × 24 dans le même style. Navigation : `icon-nav-<vue>` (tableau de bord, présences, émargement, musiciens, créneaux, groupes, dépenses, facturation, import/export, configuration), déconnexion `icon-log-out`.

## 6. Écrans

### Barre latérale (desktop)

Fond `--paper-deep`, bordure droite `--line`, padding 24 × 16. De haut en bas :
1. Logotype.
2. Sélecteur de saison : carte `--card` 52 px avec « SAISON / 2026 », la pastille de statut d'année et un chevron. Il ouvre un menu (`--shadow-overlay`) où l'on saisit l'année à charger : l'API ne liste pas les années existantes.
3. Navigation en quatre groupes titrés :
   - **Saison** : Tableau de bord, Présences, Émargement
   - **Répertoire** : Musiciens, Créneaux, Groupes
   - **Comptes** : Dépenses, Facturation
   - **Système** : Import / Export, Configuration
   (Compte est accessible depuis la boîte utilisateur.) Les permissions existantes continuent de masquer les entrées.
4. Item actif : fond `--card`, bordure intérieure `--line`, texte `--ink` 700, icône `--petrol`. Items inactifs : `--ink-soft` 600.
5. En bas : boîte utilisateur (avatar rond 38 px `--avatar-bg` / `--avatar-ink`, nom, rôle, bouton de déconnexion 44 px avec `aria-label`). Avatar et nom forment un bouton qui ouvre l'écran Compte.

### Tableau de bord

- En-tête : sur-titre mono « Situation consolidée au … », titre « Saison 2026 » ; à droite le contrôle segmenté T1/T2/T3 et l'action principale « Préparer la facturation T3 ».
- Rangée de 4 tuiles KPI : facturation élèves, coût prestataires, dépenses, subvention (variante pleine).
- Rangée 1,75 fr / 1 fr : graphique par trimestre | répartition des sorties + encart « À traiter ».
- Tableau « Activité des prestataires » du trimestre sélectionné, avec totaux (heures, déjà facturé, à facturer) à droite du titre.

### Présences

- En-tête : période en mono, titre « Présences », indicateur d'enregistrement, filtre segmenté Tout / Cours / Ateliers, action secondaire de saisie groupée.
- Légende des symboles sur une ligne.
- Grille dans une carte : colonne séance de 250 px (horaire en mono + nom + instrument), une colonne par semaine du trimestre, colonne total de 96 px (montant + nombre de séances). Lignes de 48 px minimum.
- Groupes de lignes par professeur puis « Ateliers », avec un en-tête `--card-alt` (nom en display 21 px).
- Pied de grille `--card-alt` : récapitulatif de la semaine courante + total du trimestre en display.
- La colonne Total et le total du pied comptent des **séances**, pas des euros : le backend ne fournit pas de montant par ligne et le frontend ne calcule aucun montant (les montants des maquettes sont illustratifs).

### Créneaux

Planning hebdomadaire de la salle unique : cours individuels, ateliers et groupes.

- Barre d'outils : filtre « Tous les professeurs » (met en avant les réservations d'un professeur, estompe les autres à 35 %), légende avec la durée de chaque type (cours et atelier selon la configuration de l'année, groupe 1 h 15 ou 1 h 30 selon le groupe), rappel des plages en mono.
- Agenda dans une carte : colonne horaire mono de 56 px, une colonne par jour Lun–Ven, lignes au quart d'heure de 22 px (filet `--line` à l'heure pleine, `--line-soft` à la demi-heure). Plages 11:30–14:00 et 16:30–20:00 séparées par une bande hachurée « Pause · 14:00 → 16:30 ». En-tête de jour : nom + temps libre (« 3 h 30 libres ») ; le jour courant porte une pastille `--brass`.
- Blocs de hauteur proportionnelle à la durée, filet gauche de 3 px ; le type se lit aussi par une pastille de texte (hors cours de 30 min) :
  - Cours : `--petrol-tint`, filet `--petrol`, nom en `--petrol-tint-ink` ; deux cours partagés forment un seul bloc « Créneau partagé ».
  - Atelier : `--card-alt` + contour `--line`, filet `--petrol`, pastille « Atelier ».
  - Groupe : `--rail`, filet `--ink-soft`, pastille « Groupe ».
- Départs au quart d'heure (deux groupes de 1 h 15 tiennent sur 11:30–14:00). Créneaux libres par quart d'heure : invisibles au repos, contour pointillé `--petrol` et « + 12:45 » au survol ou au focus ; un clic ouvre le panneau « Créneau libre » (jour, heure, « libre jusqu'à … ») pour placer un groupe à placer qui y tient, ou créer un cours ou un groupe à cet horaire.
- Colonne latérale de 300 px (sous l'agenda en dessous de 1240 px) : panneau « Créneau libre » et liste « À placer » (groupes sans horaire).
- Mobile (≤ 760 px) : contrôle segmenté Lun–Ven et une seule colonne de jour.
- Formulaires : un groupe choisit sa durée (1 h 15 ou 1 h 30) ; les horaires proposés (cours, groupes) affichent la fin du créneau et pourquoi un départ est indisponible (« occupé », « dépasse 14:00 »).
- Impression (bouton « Imprimer ») : A4 paysage pour l'affichage en salle, la semaine seule sur une page. En-tête « Planning de la salle » en display (année, date d'impression, professeur mis en avant s'il y en a un), légende, agenda aux lignes de 6 mm ; ni filtre, ni colonne latérale, ni créneaux libres, ni repère du jour courant.

### Musiciens et Groupes

Même principe pour les deux écrans : une barre d'outils (recherche en pilule, filtres, bouton principal « Nouveau … » à droite), une liste, une fiche.

- Avatars d'initiales ronds `--avatar-bg` / `--avatar-ink` (34 px dans les listes, 26 px empilés sur les cartes de groupe).
- Pastilles de groupe : mêmes fonds que le planning, groupe `--rail`, atelier `--card-alt` + contour `--line`.
- Musiciens :
  - filtres en contrôle segmenté avec compteurs mono : Tous, Cours, Groupes, Ateliers, Archivés ;
  - liste en lignes cliquables : avatar, nom et adresse, cours (« Basse · Alex » puis horaire en mono), pastilles de groupes, montant à payer du trimestre sélectionné en mono ; la ligne ouverte est en `--petrol-tint` avec un filet gauche `--petrol` ;
  - la fiche se déplie sous la ligne (un second clic la replie), sur toute la largeur de la liste, sans défilement propre : trois colonnes séparées par un filet (Identité ; Cours individuel avec interrupteur et disponibilité de la salle en mono ; Groupes musicaux puis Atelier). Un nouveau musicien s'ouvre en tête de liste ;
  - groupes et ateliers en pastilles à bascule (pleines en `--petrol` quand le musicien est inscrit, horaire en mono) ; l'atelier est unique : « Aucun » ou un atelier. Une pastille ne se coupe jamais, ce sont les pastilles qui passent à la ligne ;
  - l'archivage se fait depuis la fiche (lien brique) ; les archivés se désarchivent depuis leur filtre.
- Groupes :
  - colonne de 320 px, cartes rangées par type (Ateliers, Groupes musicaux) : nom, horaire en mono ou pastille laiton « À placer », professeur (atelier) ou durée (groupe), avatars des membres ;
  - fiche : nom en display 36 px, horaire et durée en pastille mono, lien « Voir dans Créneaux » ; Réglages (type et durée en contrôle segmenté, nom, professeur, jour, horaire) à gauche, Membres à droite en liste à cocher filtrable (membres en tête sur fond pétrole léger, puis « Autres musiciens », avec leur cours et leurs autres groupes en mono).
- Enregistrement explicite : les modifications d'une fiche (membres compris) attendent le bouton « Enregistrer » ; une pastille laiton « Modifications non enregistrées » le signale, et changer de fiche demande confirmation.
- Fiche musicien sur deux colonnes sous 1100 px (Groupes et Atelier en dessous), une seule sous 760 px ; sous 980 px, la fiche de groupe passe sous la liste ; sous 760 px, les lignes de musicien s'empilent (nom et montant, cours, pastilles).

### Émargement mobile (390 px)

Saisie rapide des présences d'une journée :
- Logotype + avatar ; navigation de semaine (flèches 44 px) ; onglets Lun–Ven ; titre display « Mardi 22 ».
- Une carte par séance, avec trois boutons radio pleine largeur : Présent (plein pétrole), Absent (teinté brique), Annulé. Une séance non renseignée a une bordure pointillée laiton et une pastille « À renseigner ».
- Barre d'action : « 2 sur 3 séances renseignées » + indicateur « Enregistré automatiquement » (chaque choix est enregistré aussitôt, comme dans la grille : pas de bouton « Enregistrer »).
- Barre d'onglets en bas : Tableau, Présences, Émargement, Plus. « Plus » ouvre la barre latérale en plein écran (navigation complète, saison, compte, déconnexion).
- Mise en page mobile sous 980 px : en-tête compact (logotype + avatar vers Compte), barre d'onglets, émargement par jour à la place des feuilles imprimables (qui restent l'affichage desktop et l'impression).

## 7. Mode nuit

- Mêmes rôles, mêmes noms de variables : seules les valeurs changent (voir `tokens.css`).
- Par défaut, on suit le réglage du système. Un choix manuel **Clair / Nuit / Auto** dans l'écran Compte pose `data-theme` sur `<html>` et le mémorise en `localStorage`. L'appliquer au plus tôt (script en tête de `index.html`) pour éviter un flash de thème clair.
- Les PDF générés (factures, demandes prestataire) restent toujours en version claire.
- Le thème nuit est limité à l'écran (`@media screen` dans `tokens.css`) : l'impression (feuilles d'émargement…) utilise toujours les valeurs claires.

## 8. Propositions fonctionnelles vues dans les maquettes

Ces éléments apparaissent dans les maquettes mais **n'existent pas encore** ; ils demandent une validation (et parfois du backend) avant d'être implémentés. La DA peut être appliquée sans eux.

- Bouton « Tous présents en S39 » (saisie groupée de la semaine courante).
- Badge du nombre de brouillons sur « Facturation ».
- Encart « À traiter avant clôture » sur le tableau de bord.
- Filtre Tout / Cours / Ateliers dans la grille de présences.

Les noms d'élèves et les montants des maquettes sont **fictifs** ; seuls les noms des deux professeurs sont réels.

## 9. Plan d'implémentation conseillé

Travailler sur une branche `feat/da-partition`, un commit par étape :

1. Vendoriser les trois familles de polices dans `src/vendor/` (+ licences) et les déclarer dans `index.html`.
2. Intégrer `tokens.css` en tête de `src/styles.css` ; remplacer progressivement les couleurs en dur par les variables. Les alias de transition (`--accent`, `--surface`…) permettent de garder l'existant fonctionnel pendant la migration.
3. Barre latérale (nouvelle structure + thème clair), puis boîte utilisateur.
4. Tableau de bord : tuiles KPI, graphique, répartition, activité des prestataires.
5. Grille de présences.
6. Autres écrans (musiciens, créneaux, groupes, dépenses, facturation, import/export, configuration, compte, connexion et 2FA) avec les mêmes composants.
7. Mode nuit : sélecteur dans Compte, script d'initialisation, vérification de chaque écran.
8. Émargement mobile.

Vérifications à chaque étape : `node --test tests/*.test.mjs`, aucune barre de défilement horizontale à 390 px, contraste du texte, rendu dans les deux thèmes.
