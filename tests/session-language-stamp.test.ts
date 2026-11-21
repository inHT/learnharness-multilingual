/**
 * The session's FROZEN teaching language (i18n wave, 2026-11-21): the chat
 * store stamps a concrete locale at birth from the settings record + the
 * OS tag, and later settings changes never rewrite an existing session.
 *
 * Isolated HOME/data/auth before importing any store or config.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { after, describe, it } from "node:test";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "lh-session-language-"));
process.env.HOME = path.join(directory, "home");
process.env.LH_DATA_DIR = path.join(directory, "data");
process.env.LH_AUTH_FILE = path.join(directory, "auth.json");
process.env.LH_OS_LOCALE = "zh-CN";
fs.mkdirSync(process.env.HOME, { recursive: true });
fs.mkdirSync(process.env.LH_DATA_DIR, { recursive: true });
fs.writeFileSync(process.env.LH_AUTH_FILE, "{}");

const { chatStore } = await import("../src/store/chats.ts");
const { writeSettings } = await import("../src/store/settings.ts");

after(() => fs.rmSync(directory, { recursive: true, force: true }));

describe("the session language stamp", () => {
	it("follows the OS locale when settings say 'system'/'follow'", () => {
		writeSettings({ version: 1, general: { locale: "system", teachingLocale: "follow" } });
		const chat = chatStore.createChat("First session");
		assert.equal(chat.teachingLocale, "zh-CN");
		assert.equal(chatStore.getChat(chat.id)?.teachingLocale, "zh-CN");
	});

	it("an explicit teaching locale wins over the interface locale", () => {
		writeSettings({ version: 1, general: { locale: "zh-CN", teachingLocale: "en" } });
		const chat = chatStore.createChat("English lesson");
		assert.equal(chat.teachingLocale, "en");
	});

	it("a later settings change never rewrites an existing session", () => {
		writeSettings({ version: 1, general: { locale: "system", teachingLocale: "en" } });
		const chat = chatStore.createChat("Frozen");
		assert.equal(chat.teachingLocale, "en");
		writeSettings({ version: 1, general: { locale: "system", teachingLocale: "zh-CN" } });
		assert.equal(chatStore.getChat(chat.id)?.teachingLocale, "en", "the record keeps its birth language");
	});
});
