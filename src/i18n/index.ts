import he from "./he.json";

/**
 * Dependency-free i18n (VetTrack convention): Hebrew is the default and is
 * bundled eagerly; English loads lazily on demand. All UI strings go through
 * t() — no hardcoded user-facing text (CLAUDE.md §4).
 */

export type MessageKey = keyof typeof he;
export type Locale = "he" | "en";

type Messages = Record<MessageKey, string>;

const dictionaries: Partial<Record<Locale, Messages>> = { he };

let activeLocale: Locale = "he";

export function getLocale(): Locale {
  return activeLocale;
}

export async function setLocale(locale: Locale): Promise<void> {
  if (locale === "en" && dictionaries.en === undefined) {
    const mod = await import("./en.json");
    dictionaries.en = mod.default as Messages;
  }
  activeLocale = locale;
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "he" ? "rtl" : "ltr";
}

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const dict = dictionaries[activeLocale] ?? dictionaries.he;
  let message = dict?.[key] ?? he[key];
  if (params !== undefined) {
    for (const [name, value] of Object.entries(params)) {
      message = message.replaceAll(`{${name}}`, String(value));
    }
  }
  return message;
}
