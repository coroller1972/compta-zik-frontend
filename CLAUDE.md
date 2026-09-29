# Compta Zik — frontend

SPA Vue 3 sans étape de build pour la comptabilité d'une activité musicale (présences, facturation élèves, demandes de facture prestataires, subvention, dépenses). Interface entièrement en français.

## Lancer et tester

- Servir le dossier : `python3 -m http.server 4173` depuis ce dossier, puis http://localhost:4173
- Tests (sans dépendance à installer) : `node --test tests/*.test.mjs`
- En conteneur, Traefik route `/api/auth` vers mserv-identity, `/api` vers mserv-compta-zik et `/` vers ce frontend (voir `../docker-compose.yaml`).

## Structure

- `index.html` : charge les feuilles de style vendorisées puis `src/main.js`.
- `src/main.js` : toute l'application (composant Vue unique, gabarit en chaîne).
- `src/styles.css` : tous les styles.
- `src/vendor/` : dépendances vendorisées (Vue, polices, QR code). **Aucun CDN** : toute nouvelle ressource est copiée ici avec sa licence.
- Icônes : sprite SVG `<symbol id="icon-…">` en tête du gabarit de `src/main.js` (voir `partition.md` §5).
- `src/session-transport.mjs`, `src/avatar-crop*.mjs`, `src/theme.mjs`, `src/schedule.mjs` : modules testés dans `tests/`.
- `src/schedule.mjs` : règles du planning de la salle (plages, grille, durées, chevauchements) ; elles doivent rester identiques à `SlotRules` du backend.
- `src/theme-init.js` : script classique en tête de `index.html` qui applique le thème mémorisé avant le rendu (même clé que `theme.mjs`).

## Règles

- Le backend est l'unique source des montants et calculs financiers : le frontend n'en recalcule aucun.
- Les permissions (`can(...)`, `canAny(...)`) masquent les écrans et actions ; les conserver lors de toute refonte.
- Les jetons d'accès restent en mémoire uniquement (jamais en `localStorage`).

## Direction artistique

**Toute modification visuelle suit la DA « Partition » : lire `docs/design/partition.md` avant de toucher à l'interface.**

- Couleurs, polices et rayons viennent **uniquement** des variables de `docs/design/tokens.css` (thème clair + nuit). Pas de couleur en dur dans les composants.
- Les maquettes de référence (valeurs exactes) sont dans `docs/design/maquettes/`.
- Si la DA évolue, mettre à jour `partition.md` et `tokens.css` dans le même commit.
- La refonte « Partition » est terminée (les 8 étapes de la section 9 de `partition.md` sont fusionnées sur `main`). Les propositions encore à valider sont listées en section 8.
