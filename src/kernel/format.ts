/* format.ts — tiny, shared display formatters (no deps, no DOM). Components
   import these instead of re-declaring local helpers. Locale-default + tolerant
   (no i18n layer). */

/** Two-letter avatar initials from an entity id — strips the `PREFIX_`
    (e.g. CAS_/USR_) and takes the first two chars, uppercased. */
export const initials = (id: string): string =>
  String(id || "?")
    .replace(/^[A-Z]+_/, "")
    .slice(0, 2)
    .toUpperCase();

/** An ISO timestamp → the browser-locale date+time string; "" for a
    falsy/absent value; the raw string when it isn't a parseable date. */
export const fmtDateTime = (s?: string): string => {
  if (!s) return "";
  try {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleString();
  } catch {
    return String(s);
  }
};
