# Maquettes « Partition »

Sources des maquettes réalisées sur le canevas de design Claude :
https://claude.ai/artifact/RtnFxWSU9yKewzE8BaJDRg (privé, lié au compte du propriétaire).

| Fichier | Écran |
| --- | --- |
| `Main.dc.html` | Planche de tendance : palette, typographie, composants, principes |
| `Dashboard.dc.html` / `Dashboard-nuit.dc.html` | Tableau de bord, clair / nuit (1440 × 1120) |
| `Presences.dc.html` / `Presences-nuit.dc.html` | Grille de présences du trimestre, clair / nuit (1440 × 980) |
| `Emargement.dc.html` / `Emargement-nuit.dc.html` | Émargement mobile, clair / nuit (390 × 844) |
| `Nuit.dc.html` | Table de correspondance des couleurs clair → nuit |

Ces fichiers ne s'ouvrent pas tels quels dans un navigateur : ils dépendent du moteur du canevas (`support.js`, balises `<x-dc>`, `<sc-for>`, `{{…}}`). Ils servent de **référence de valeurs exactes** : tailles, espacements, rayons, couleurs et structure HTML sont écrits en styles en ligne et se lisent directement. La logique des listes (grille de présences, barres du graphique) est dans le bloc `<script type="text/x-dc">` en bas de chaque fichier.

Les données (élèves, montants) sont fictives. Pour la règle, se référer à `../partition.md` et aux variables de `../tokens.css` plutôt qu'aux couleurs en dur de ces fichiers.
