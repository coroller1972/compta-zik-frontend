/** Préférence de thème (DA « Partition » §7) : clair, nuit ou auto (réglage du système), mémorisée par navigateur. */
export const THEME_STORAGE_KEY = "compta-zik-theme";

export const THEME_CHOICES = [
  { value: "light", label: "Clair" },
  { value: "dark", label: "Nuit" },
  { value: "auto", label: "Auto" },
];

export function normalizeTheme(value) {
  return value === "light" || value === "dark" ? value : "auto";
}

export function readThemePreference(storage = globalThis.localStorage) {
  try {
    return normalizeTheme(storage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return "auto";
  }
}

/** « auto » retire data-theme : tokens.css suit alors prefers-color-scheme. */
export function applyThemePreference(preference, root = globalThis.document?.documentElement) {
  const theme = normalizeTheme(preference);
  if (!root) return theme;
  if (theme === "auto") delete root.dataset.theme;
  else root.dataset.theme = theme;
  return theme;
}

export function saveThemePreference(preference, { storage = globalThis.localStorage, root } = {}) {
  const theme = applyThemePreference(preference, root);
  try {
    if (theme === "auto") storage?.removeItem(THEME_STORAGE_KEY);
    else storage?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Stockage indisponible (navigation privée…) : le choix vaut pour la page ouverte.
  }
  return theme;
}
