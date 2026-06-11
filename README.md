# Compta Zik Frontend

Prototype Vue 3 pour la compta musique vers une application web.

## Lancement

Depuis la racine du projet:

```bash
python3 -m http.server 4173 --directory comptq-zik-frontend
```

Puis ouvrir:

```text
http://localhost:4173
```

## Backend

Par defaut, l'application appelle:

```text
http://localhost:8080/api
```

Tant que l'API n'est pas disponible, l'interface bascule en mode demo avec des donnees factices.

La base API peut etre changee dans l'ecran `Configuration`; elle est stockee dans `localStorage`.

## Calculs implementes

- Cours individuel eleve: `nombre de presences * 0.5 * taux horaire professeur`.
- Dû professeur cours individuel: `nombre de cours dispenses * 0.5 * taux horaire`.
- Dû professeur groupe de travail: `nombre de seances * 1.25 * taux horaire`.
- Cotisation groupe annuelle: une seule cotisation par musicien s'il appartient a au moins un groupe.
- Cotisation groupe annuelle: appliquee uniquement sur le premier trimestre de l'annee.
- Subvention estimee: `dû professeurs - 50% des cours individuels factures - cotisations groupe`.

## Ecrans principaux

- `Présences`: grille complete de tous les cours individuels et groupes de travail du trimestre.
- `Musiciens`: creation, modification, suppression, affectation a plusieurs groupes et association a un creneau hebdomadaire.
- `Groupes`: creation de groupes musicaux ou de groupes de travail, puis association des musiciens via une liste de transfert.
- `Créneaux individuels`: demi-heures disponibles par professeur, jour et horaire, sur les plages `11:30-14:00` et `16:30-18:00`.
- `Facturation`: preparation globale des factures eleves et demandes de facture separees par professeur.
- `Configuration`: liste de transfert des semaines de vacances scolaires, marquees dans la grille de presences mais toujours cliquables.
