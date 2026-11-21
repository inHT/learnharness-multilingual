/**
 * THE SHELL'S MENU LANGUAGE (i18n wave, 2026-11-21): the Electron main
 * process is CJS and cannot import the TypeScript core, so this module
 * mirrors core/locales.ts's resolution rules over the same catalog files
 * (messages/<locale>.json, shipped inside the asar via electron-builder's
 * files list). Only CUSTOM menu items read it — Electron role items (undo,
 * copy, quit, …) are localized by the OS itself.
 *
 * Resolution: the record's general.locale (explicit id or "system") → the
 * OS tag (app.getLocale()) → English. zh-Hant variants stay English until
 * a Traditional catalog exists — the same rule as the renderer, kept in
 * sync by electron/menu-language.test.ts.
 */

const fs = require("node:fs");
const path = require("node:path");

// Mirrors src/core/locales.ts mapSystemLocale.
function mapSystemLocale(tag) {
	const lower = String(tag ?? "").trim().toLowerCase();
	if (!lower) return null;
	if (lower === "en" || lower.startsWith("en-")) return "en";
	if (lower === "zh-cn" || lower === "zh-hans") return "zh-CN";
	if (lower === "zh") return "zh-CN";
	if (lower === "zh-hant" || lower === "zh-tw" || lower === "zh-hk" || lower === "zh-mo") return null;
	if (lower.startsWith("zh-hans") || lower.startsWith("zh-cn") || lower.startsWith("zh-sg")) return "zh-CN";
	return null;
}

// Mirrors resolveLocale for the menu's single axis (the interface language).
function resolveLocale(setting, tag) {
	if (setting && setting !== "system") return setting;
	return mapSystemLocale(tag) ?? "en";
}

function flatten(obj, prefix = "", out = {}) {
	for (const [key, value] of Object.entries(obj)) {
		const dotted = prefix ? `${prefix}.${key}` : key;
		if (typeof value === "string") out[dotted] = value;
		else if (value && typeof value === "object" && !Array.isArray(value)) flatten(value, dotted, out);
	}
	return out;
}

function readCatalog(messagesDir, locale) {
	try {
		return flatten(JSON.parse(fs.readFileSync(path.join(messagesDir, `${locale}.json`), "utf8")));
	} catch {
		return {};
	}
}

/**
 * Build the menu translator.
 * @param {object} options
 * @param {string} options.dataDir        the server's data dir (settings.json lives there)
 * @param {string} options.messagesDir    absolute path to the messages/ directory
 * @param {string} [options.tag]          the OS locale tag (app.getLocale())
 * @param {string} [options.locale]       an already-resolved locale (live updates from the renderer)
 */
function createMenuI18n({ dataDir, messagesDir, tag, locale }) {
	let setting = "system";
	try {
		setting = JSON.parse(fs.readFileSync(path.join(dataDir, "settings.json"), "utf8"))?.general?.locale ?? "system";
	} catch {
		/* first boot / unreadable: "system" */
	}
	const resolved = locale ?? resolveLocale(setting, tag);
	const catalog = readCatalog(messagesDir, resolved);
	const fallback = resolved === "en" ? {} : readCatalog(messagesDir, "en");
	const t = (key) => catalog[key] ?? fallback[key] ?? key;
	return { locale: resolved, t };
}

module.exports = { createMenuI18n, mapSystemLocale, resolveLocale };
