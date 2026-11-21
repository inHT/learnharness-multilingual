/**
 * THE I18N RUNTIME (i18n wave, 2026-11-21): catalog lookup + ICU
 * formatting for the interface language layer. Pure — no React, no node
 * builtins — so the server boot (app/layout.tsx), the client provider
 * (react.tsx) and tests all read through this one module.
 *
 * Catalogs are the static JSON files messages/<locale>.json, nested
 * objects addressed by dotted keys ("sidebar.newSession"). The English
 * catalog is the source of truth for the KEY SET: a missing entry in a
 * translation falls back to English, and a missing entry there falls back
 * to the key itself (a broken catalog must not blank the UI; the
 * validation script scripts/check-translations.mjs catches the drift
 * before commit).
 *
 * Values are ICU MessageFormat templates (intl-messageformat — plural
 * rules matter beyond this first translation, so the machinery is in from
 * the start). Placeholders never survive a translation change: the
 * validator compares the placeholder sets per key across catalogs.
 */

import en from "../../messages/en.json" with { type: "json" };
import zhCN from "../../messages/zh-CN.json" with { type: "json" };
import { IntlMessageFormat } from "intl-messageformat";
import type { AppLocale } from "../core/locales.ts";

/** The catalog shape: nested string leaves (the dotted-key lookup walks it). */
type Catalog = { [key: string]: string | Catalog };

const CATALOGS: Record<AppLocale, Catalog> = {
	en: en as Catalog,
	"zh-CN": zhCN as Catalog,
};

/** The last catalog in every fallback chain. */
export const DEFAULT_LOCALE: AppLocale = "en";

/** All cataloged locales (the settings row derives its options from core's
 *  APP_LOCALES; this is the runtime-side mirror for the validator). */
export const CATALOG_LOCALES: readonly AppLocale[] = ["en", "zh-CN"];

/** Dotted-key lookup: walks the nested catalog, returns the string leaf or
 *  undefined (a non-leaf hit — an object where a string belongs — reads as
 *  missing, like any malformed entry). */
function lookup(catalog: Catalog, key: string): string | undefined {
	let node: string | Catalog | undefined = catalog;
	for (const part of key.split(".")) {
		if (typeof node !== "object" || node === null) return undefined;
		node = node[part];
	}
	return typeof node === "string" ? node : undefined;
}

/** Compiled ICU templates, cached per locale+template (the catalogs are
 *  static, so entries never evict). */
const formatters = new Map<string, IntlMessageFormat>();
function formatter(locale: AppLocale, template: string): IntlMessageFormat {
	const cacheKey = `${locale}\u0000${template}`;
	let fmt = formatters.get(cacheKey);
	if (!fmt) {
		fmt = new IntlMessageFormat(template, locale);
		formatters.set(cacheKey, fmt);
	}
	return fmt;
}

/** Compile+format one ICU template for a locale. Exported (with translate)
 *  so tests can pin the plural machinery without a catalog entry. */
export function formatTemplate(locale: AppLocale, template: string, params?: Record<string, unknown>): string {
	if (params === undefined) return template;
	try {
		const formatted = formatter(locale, template).format(params);
		return Array.isArray(formatted) ? formatted.join("") : String(formatted);
	} catch {
		return template;
	}
}

/** THE translation call: locale catalog → English catalog → the key.
 *  Params format through ICU (plurals included); a malformed template
 *  renders as its raw text rather than throwing into a component render. */
export function translate(locale: AppLocale, key: string, params?: Record<string, unknown>): string {
	const template = lookup(CATALOGS[locale], key) ?? lookup(CATALOGS[DEFAULT_LOCALE], key);
	if (template === undefined) return key;
	return formatTemplate(locale, template, params);
}
