/**
 * THE LOCALE BOOT (i18n wave, 2026-11-21): what app/layout.tsx reads to
 * resolve the interface + teaching locale server-side, the same seam as
 * readThemeBoot (the record is per-machine disk state; connection() in the
 * layout keeps this off prerendered builds).
 *
 * The OS tag: Electron injects app.getLocale() as LH_OS_LOCALE (electron/
 * main.cjs spawn env); a plain dev server falls back to Node's ICU default
 * — in dev the server runs on the user's machine, so the resolution still
 * matches the user's OS. The tag rides into the provider so a live
 * "system" pick resolves identically client-side.
 */

import { resolveLocale, resolveTeachingLocale, systemLocaleTag, type AppLocale } from "../core/locales.ts";
import { readSettings } from "../store/settings.ts";

/** Re-exported for callers that only import the boot module. */
export { systemLocaleTag };

/** Everything the layout needs: the two resolved locales + the tag they resolved against. */
export interface LocaleBoot {
	locale: AppLocale;
	teachingLocale: AppLocale;
	systemTag: string;
}

/** Read the record and resolve both locales. Missing record (first boot) →
 *  "system" → the OS tag; teaching follows the interface (the factories). */
export function readLocaleBoot(env: Record<string, string | undefined> = process.env): LocaleBoot {
	const general = readSettings()?.general;
	const systemTag = systemLocaleTag(env);
	const locale = resolveLocale(general?.locale, systemTag);
	const teachingLocale = resolveTeachingLocale(general?.teachingLocale, locale);
	return { locale, teachingLocale, systemTag };
}
