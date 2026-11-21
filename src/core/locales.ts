/**
 * THE LOCALE VOCABULARY (i18n wave, 2026-11-21): the app's interface
 * language layer, browser-safe pure logic like the rest of core.
 *
 * Two settings ride GeneralSettings (owner plan, 2026-11-21):
 * - `locale` — the INTERFACE language: "system" (follow the OS) or an
 *   explicit catalog id. Factory "system".
 * - `teachingLocale` — the TEACHING language the learner-facing agent
 *   output uses: "follow" (ride the resolved interface language) or an
 *   explicit catalog id. Factory "follow".
 *
 * Resolution order: the user's explicit choice → the operating system
 * language → "en". The system tag arrives as a BCP-47 label (Electron's
 * app.getLocale() via LH_OS_LOCALE, or navigator.language); mapSystemLocale
 * carries the mapping rules. Only cataloged locales resolve — zh-Hant
 * variants fall back to "en" until a Traditional catalog exists, so a
 * Traditional-Chinese user never sees Simplified text by accident.
 *
 * Dictation is a DIFFERENT axis (DictationSettings.language — Deepgram's
 * Nova-3 codes) and is never derived from these fields; neither overrides
 * the other.
 */

/** The locales with a messages/<locale>.json catalog. A new catalog joins
 *  this union AND the APP_LOCALES list (the settings row reads it). */
export type AppLocale = "en" | "zh-CN";

/** The stored interface-language preference: "system" or an explicit id. */
export type LocaleSetting = "system" | AppLocale;

/** The stored teaching-language preference: "follow" (the interface) or an explicit id. */
export type TeachingLocaleSetting = "follow" | AppLocale;

export const APP_LOCALES: readonly { id: AppLocale; label: string; englishLabel: string }[] = [
	{ id: "en", label: "English", englishLabel: "English" },
	{ id: "zh-CN", label: "简体中文", englishLabel: "Simplified Chinese" },
];

const LOCALE_IDS: readonly AppLocale[] = APP_LOCALES.map((l) => l.id);

export function isAppLocale(value: unknown): value is AppLocale {
	return LOCALE_IDS.includes(value as AppLocale);
}

export function isLocaleSetting(value: unknown): value is LocaleSetting {
	return value === "system" || isAppLocale(value);
}

export function isTeachingLocaleSetting(value: unknown): value is TeachingLocaleSetting {
	return value === "follow" || isAppLocale(value);
}

/** A BCP-47 tag → the catalog it resolves to, or null when none matches
 *  (the caller falls back to "en"). Script/region aware: zh-Hans maps to
 *  zh-CN, zh-Hant/zh-TW/zh-HK deliberately do NOT (no Traditional catalog
 *  — an explicit "en" beats a wrong script). */
export function mapSystemLocale(tag: string): AppLocale | null {
	const lower = tag.trim().toLowerCase();
	if (!lower) return null;
	// Exact catalog ids win first.
	if (lower === "en" || lower.startsWith("en-")) return "en";
	if (lower === "zh-cn" || lower === "zh-hans") return "zh-CN";
	// bare "zh" reads as the (Simplified) default script; script/region
	// marked Traditional stays unmapped until a zh-Hant catalog exists.
	if (lower === "zh") return "zh-CN";
	if (lower === "zh-hant" || lower === "zh-tw" || lower === "zh-hk" || lower === "zh-mo") return null;
	if (lower.startsWith("zh-hans") || lower.startsWith("zh-cn") || lower.startsWith("zh-sg")) return "zh-CN";
	return null;
}

/** THE interface resolution: explicit choice → the OS tag → "en".
 *  Pure — the OS tag is a parameter, not an environment read. */
export function resolveLocale(setting: LocaleSetting | undefined, systemTag: string | undefined): AppLocale {
	if (setting && setting !== "system") return setting;
	const mapped = systemTag ? mapSystemLocale(systemTag) : null;
	return mapped ?? "en";
}

/** THE teaching resolution: "follow" rides the interface; an explicit id
 *  stands alone. */
export function resolveTeachingLocale(setting: TeachingLocaleSetting | undefined, uiLocale: AppLocale): AppLocale {
	if (!setting || setting === "follow") return uiLocale;
	return setting;
}
