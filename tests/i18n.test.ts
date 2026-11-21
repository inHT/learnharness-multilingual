/**
 * Tests for the i18n foundation (i18n wave, 2026-11-21): the locale
 * vocabulary/resolution (core/locales.ts), the settings record's two new
 * General fields (sanitizer + PUT parser), and the catalog runtime
 * (src/i18n/index.ts — dotted lookup, English fallback, ICU params).
 *
 * The catalog-shape guarantees (key parity, placeholder parity) live in
 * scripts/check-translations.mjs, wired into npm run check:i18n.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	APP_LOCALES,
	isAppLocale,
	isLocaleSetting,
	isTeachingLocaleSetting,
	mapSystemLocale,
	resolveLocale,
	resolveTeachingLocale,
} from "../src/core/locales.ts";
import { FACTORY_SETTINGS, sanitizeUserSettings } from "../src/core/settings.ts";
import { resolveSettings } from "../src/core/settings-resolution.ts";
import { parseGeneralSettingsBody } from "../src/server/settings-body.ts";
import { translate, translateOr, formatTemplate, DEFAULT_LOCALE, CATALOG_LOCALES } from "../src/i18n/index.ts";

describe("core/locales: the catalog vocabulary", () => {
	it("lists en and zh-CN, both accepted as settings values", () => {
		assert.deepEqual(APP_LOCALES.map((l) => l.id), ["en", "zh-CN"]);
		for (const l of APP_LOCALES) {
			assert.equal(isAppLocale(l.id), true);
			assert.equal(isLocaleSetting(l.id), true);
			assert.equal(isTeachingLocaleSetting(l.id), true);
		}
	});

	it("accepts the follow-the-environment sentinels; rejects anything else", () => {
		assert.equal(isLocaleSetting("system"), true);
		assert.equal(isLocaleSetting("follow"), false);
		assert.equal(isTeachingLocaleSetting("follow"), true);
		assert.equal(isTeachingLocaleSetting("system"), false);
		for (const bad of ["", "zh", "fr", "zh-TW", null, 1, {}, []]) {
			assert.equal(isLocaleSetting(bad), false, String(bad));
			assert.equal(isTeachingLocaleSetting(bad), false, String(bad));
		}
	});
});

describe("mapSystemLocale: the documented mapping rules", () => {
	it("maps Simplified Chinese variants to zh-CN", () => {
		for (const tag of ["zh", "zh-CN", "zh-cn", "zh-Hans", "zh-Hans-CN", "zh-SG"]) {
			assert.equal(mapSystemLocale(tag), "zh-CN", tag);
		}
	});

	it("maps English (any region) to en", () => {
		for (const tag of ["en", "en-US", "en-GB", "EN-au"]) assert.equal(mapSystemLocale(tag), "en", tag);
	});

	it("leaves Traditional Chinese unmapped until a zh-Hant catalog exists", () => {
		for (const tag of ["zh-TW", "zh-HK", "zh-MO", "zh-Hant", "zh-Hant-TW"]) {
			assert.equal(mapSystemLocale(tag), null, tag);
		}
	});

	it("leaves unrelated and empty tags unmapped", () => {
		for (const tag of ["", "  ", "fr", "de-CH", "ja", "ru"]) assert.equal(mapSystemLocale(tag), null, tag);
	});
});

describe("resolveLocale: explicit → OS → en", () => {
	it("an explicit choice wins over the OS tag", () => {
		assert.equal(resolveLocale("zh-CN", "en-US"), "zh-CN");
		assert.equal(resolveLocale("en", "zh-CN"), "en");
	});

	it("`system` (and an absent setting) resolve through the OS tag", () => {
		assert.equal(resolveLocale("system", "zh-CN"), "zh-CN");
		assert.equal(resolveLocale(undefined, "zh-Hans"), "zh-CN");
		assert.equal(resolveLocale(undefined, "en-GB"), "en");
	});

	it("falls back to en when the OS tag maps to no catalog", () => {
		assert.equal(resolveLocale("system", "zh-TW"), "en");
		assert.equal(resolveLocale("system", "fr"), "en");
		assert.equal(resolveLocale(undefined, undefined), "en");
	});
});

describe("resolveTeachingLocale: follow rides the interface", () => {
	it("`follow` (and an absent setting) tracks the resolved interface locale", () => {
		assert.equal(resolveTeachingLocale("follow", "zh-CN"), "zh-CN");
		assert.equal(resolveTeachingLocale(undefined, "zh-CN"), "zh-CN");
		assert.equal(resolveTeachingLocale("follow", "en"), "en");
	});

	it("an explicit teaching locale stands alone", () => {
		assert.equal(resolveTeachingLocale("en", "zh-CN"), "en");
		assert.equal(resolveTeachingLocale("zh-CN", "en"), "zh-CN");
	});
});

describe("settings: the two new General fields", () => {
	it("factories are system / follow", () => {
		assert.equal(FACTORY_SETTINGS.general.locale, "system");
		assert.equal(FACTORY_SETTINGS.general.teachingLocale, "follow");
	});

	it("the sanitizer keeps valid values and drops invalid ones", () => {
		const kept = sanitizeUserSettings({ version: 1, general: { locale: "zh-CN", teachingLocale: "en" } });
		assert.deepEqual(kept?.general, { locale: "zh-CN", teachingLocale: "en" });
		const dropped = sanitizeUserSettings({ version: 1, general: { locale: "zh-TW", teachingLocale: "system" } });
		assert.deepEqual(dropped?.general, {});
		// Unknown keys ride along untouched (forward-compat).
		const future = sanitizeUserSettings({ version: 1, general: { locale: "zh-CN", futureKnob: 1 } });
		assert.deepEqual(future?.general, { locale: "zh-CN" });
	});

	it("resolution lands on factories for an absent record", () => {
		const eff = resolveSettings(null);
		assert.equal(eff.general.locale, "system");
		assert.equal(eff.general.teachingLocale, "follow");
	});

	it("the PUT parser accepts the vocabulary and rejects anything else", () => {
		const ok = parseGeneralSettingsBody({ locale: "system", teachingLocale: "zh-CN" });
		assert.equal(ok.ok, true);
		assert.deepEqual(ok.ok ? ok.settings : null, { locale: "system", teachingLocale: "zh-CN" });
		for (const body of [{ locale: "follow" }, { locale: "zh-TW" }, { teachingLocale: "system" }, { teachingLocale: "fr" }]) {
			const parsed = parseGeneralSettingsBody(body);
			assert.equal(parsed.ok, false, JSON.stringify(body));
		}
	});
});

describe("src/i18n: catalog lookup + ICU", () => {
	it("catalogs match the core locale list", () => {
		assert.deepEqual([...CATALOG_LOCALES].sort(), APP_LOCALES.map((l) => l.id).sort());
		assert.equal(DEFAULT_LOCALE, "en");
	});

	it("English resolves a known dotted key to its source string", () => {
		assert.equal(translate("en", "settings.general.language.label"), "Language");
	});

	it("a key present in a translation resolves to the translated value", () => {
		assert.equal(translate("zh-CN", "settings.general.language.label"), "语言");
	});

	it("the fallback chain (translation → English → key/fallback) stays intact", () => {
		// Every catalog is complete now, so the English-fallback half is
		// exercised through translateOr's explicit fallback: a key missing
		// from every catalog returns the caller's runtime string.
		assert.equal(translateOr("zh-CN", "no.such.key", "runtime wording"), "runtime wording");
		assert.equal(translateOr("zh-CN", "settings.general.language.label", "runtime wording"), "语言");
	});

	it("a key missing everywhere returns the key itself (never blank)", () => {
		assert.equal(translate("en", "no.such.key"), "no.such.key");
		assert.equal(translate("zh-CN", "no.such.key"), "no.such.key");
	});

	it("a non-string leaf reads as missing", () => {
		assert.equal(translate("en", "settings"), "settings");
	});

	it("params format through ICU (plural machinery is live from day one)", () => {
		const template = "{count, plural, one {# session} other {# sessions}}";
		assert.equal(formatTemplate("en", template, { count: 1 }), "1 session");
		assert.equal(formatTemplate("en", template, { count: 3 }), "3 sessions");
		// Chinese has one plural category — the ICU path still applies.
		assert.equal(formatTemplate("zh-CN", template, { count: 3 }), "3 sessions");
	});

	it("a malformed template renders raw instead of throwing", () => {
		assert.equal(formatTemplate("en", "{count, plural, one {", { count: 1 }), "{count, plural, one {");
	});
});
