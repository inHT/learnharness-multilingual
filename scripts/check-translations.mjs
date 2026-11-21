#!/usr/bin/env node
/**
 * THE TRANSLATION GATE (i18n wave, 2026-11-21): compares messages/en.json
 * with every other catalog, checks that source code only asks for keys
 * that exist, and rejects the easy ways a catalog rots.
 *
 * Checks:
 *  1. Key parity — every non-English catalog has exactly en.json's key set.
 *  2. Placeholder parity — the ICU placeholder names per key are identical
 *     across catalogs (a translation may reorder them, never rename/drop).
 *  3. No empty values.
 *  4. No duplicated untranslated values for keys whose English is a whole
 *     sentence (a heuristic: 4+ words or a sentence mark), except keys
 *     listed in i18n/preserve.json.
 *  5. Every key referenced from source (t("…"), translate(…), translateOr(…))
 *     exists in en.json — catches typos the runtime would silently render
 *     as the raw key.
 *
 * Exit code 1 on any failure; npm test runs it.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const messagesDir = path.join(root, "messages");
const EN = "en";

function readJson(file) {
	return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** Flatten a nested catalog into dotted-key → string leaves. */
function flatten(obj, prefix = "", out = {}) {
	for (const [key, value] of Object.entries(obj)) {
		const dotted = prefix ? `${prefix}.${key}` : key;
		if (typeof value === "string") out[dotted] = value;
		else if (value && typeof value === "object" && !Array.isArray(value)) flatten(value, dotted, out);
		else out[dotted] = value;
	}
	return out;
}

/** The ICU placeholder names in a template ({name}, {n, plural, …}). */
function placeholders(template) {
	const names = new Set();
	for (const match of String(template).matchAll(/\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*[,}]/g)) names.add(match[1]);
	return names;
}

const failures = [];
const fail = (message) => failures.push(message);

const en = flatten(readJson(path.join(messagesDir, `${EN}.json`)));
const catalogFiles = fs
	.readdirSync(messagesDir)
	.filter((file) => file.endsWith(".json") && file !== `${EN}.json`)
	.sort();

let preserve = { keys: [] };
try {
	preserve = readJson(path.join(root, "i18n", "preserve.json"));
} catch {
	// No preserve list yet — the heuristic check still runs.
}
const preserved = new Set(preserve.keys ?? []);

// ── 1–4: catalog checks (each non-English catalog against English) ─────────
for (const file of catalogFiles) {
	const locale = path.basename(file, ".json");
	const catalog = flatten(readJson(path.join(messagesDir, file)));

	for (const key of Object.keys(catalog)) {
		if (!(key in en)) fail(`${locale}: unknown key "${key}" (not in en.json)`);
	}
	for (const key of Object.keys(en)) {
		if (!(key in catalog)) fail(`${locale}: missing key "${key}"`);
	}
	for (const [key, value] of Object.entries(catalog)) {
		if (typeof value !== "string") {
			fail(`${locale}: "${key}" is not a string`);
			continue;
		}
		if (value.trim() === "") fail(`${locale}: "${key}" is empty`);
		const source = en[key];
		if (typeof source !== "string") continue;
		const want = [...placeholders(source)].sort().join(",");
		const got = [...placeholders(value)].sort().join(",");
		if (want !== got) fail(`${locale}: "${key}" placeholder mismatch (en: {${want}}, ${locale}: {${got}})`);
		if (!preserved.has(key) && value === source && /[.!?。！？]\s*$|[.!?。！？] /.test(source) && source.trim().split(/\s+/).length >= 4) {
			fail(`${locale}: "${key}" looks untranslated (add it to i18n/preserve.json if that is intentional)`);
		}
	}
}

// ── 5: every key referenced from source exists ─────────────────────────────
const sourceFiles = [];
function walk(dir) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "dist" || entry.name.startsWith(".")) continue;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) walk(full);
		else if (/\.(ts|tsx)$/.test(entry.name)) sourceFiles.push(full);
	}
}
for (const dir of ["app", "components", "src", "lib"]) {
	const full = path.join(root, dir);
	if (fs.existsSync(full)) walk(full);
}

const KEY_CALL = /\b(?:t|translate|translateOr)\(\s*["'`]([A-Za-z][A-Za-z0-9_.]*)["'`]/g;
// A literal first argument that is a locale id (translate("en", …)) or a
// bare word without a dot is not a catalog key.
const LOCALE_IDS = new Set(["en", "zh-CN"]);
const referenced = new Set();
for (const file of sourceFiles) {
	const source = fs.readFileSync(file, "utf8");
	for (const match of source.matchAll(KEY_CALL)) {
		const key = match[1];
		if (LOCALE_IDS.has(key) || !key.includes(".")) continue;
		referenced.add(key);
	}
}
for (const key of referenced) {
	if (!(key in en)) fail(`source references "${key}", which is not in en.json`);
}

// Keys in en.json that nothing references are allowed (reserved for
// upcoming phases), but worth listing for hygiene.
const unused = Object.keys(en).filter((key) => !referenced.has(key));

if (failures.length) {
	console.error(`Translation check failed (${failures.length}):`);
	for (const message of failures) console.error(`  - ${message}`);
	process.exit(1);
}

console.log(
	`Translation check passed: ${Object.keys(en).length} keys, ${catalogFiles.length} catalog(s)` +
		(unused.length ? `; ${unused.length} key(s) not referenced yet` : ""),
);
