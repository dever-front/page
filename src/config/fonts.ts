/**
 * List of available font names (visit the url `/settings/appearance`).
 * This array is used to generate dynamic font classes (e.g., `font-inter`, `font-manrope`).
 *
 * 📝 How to Add a New Font (Tailwind v4+):
 * 1. Add the font name here.
 * 2. Add local `@font-face` rules to `styles/google-fonts.css` or another
 *    local CSS file, with font files stored under `src/assets`.
 * 3. Add the new font family to `theme.css` using the `@theme inline`
 *    font variable. Do not add external font CDN links or npm font packages.
 *
 * Example:
 * fonts.ts           → Add 'roboto' to this array.
 * main.tsx           → Import the local font CSS.
 * theme.css          → Add the new font in the CSS, e.g.:
 *   @theme inline {
 *      // ... other font families
 *      --font-roboto: 'Roboto', var(--font-system);
 *   }
 */
export const fonts = ['inter', 'manrope', 'system'] as const
