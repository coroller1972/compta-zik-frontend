// Applique le thème mémorisé avant le premier rendu, pour éviter un flash de thème clair.
// Script classique chargé en tête de index.html ; même clé et mêmes valeurs que src/theme.mjs.
(function () {
  try {
    var theme = localStorage.getItem("compta-zik-theme");
    if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  } catch (error) {
    // Stockage indisponible : le thème suit le réglage du système.
  }
})();
