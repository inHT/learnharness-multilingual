/**
 * Tests for the TEACHING LANGUAGE layer (i18n wave, 2026-11-21): the
 * learner-language instruction text, its place at the END of the composed
 * system prompt, the frozen per-session locale, and the sub-agent block.
 *
 * The agent is built with a scripted engine, so these assert the prompt
 * exactly as the model receives it — and that tool names stay English
 * even when the learner-facing language is Chinese.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { learnerLanguageInstruction, resolveLocale, resolveTeachingLocale } from "../src/core/locales.ts";
import { composeInstructions, CONVERSATION_TOOL_NAMES, createTeacherAgent } from "../src/agent/teacher-agent.ts";
import { withLearnerLanguage } from "../src/agent/subagents/language.ts";

const LANGUAGE_HEADING = "## Learner language";

/** The built agent's assembled prompt + tool registry, read back off state. */
function builtTeacher(teachingLocale?: "en" | "zh-CN") {
	const engine = {
		model: { provider: "test", id: "test-model", api: "faux" },
		level: "off",
		streamFn: async () => {
			throw new Error("scripted engine never runs here");
		},
	} as never;
	const agent = createTeacherAgent(undefined, { engine, ...(teachingLocale ? { teachingLocale } : {}) });
	return (agent as unknown as { state: { systemPrompt: string; tools: Array<{ name: string }> } }).state;
}

describe("learnerLanguageInstruction", () => {
	it("states Simplified Chinese for zh-CN and English for en", () => {
		assert.match(learnerLanguageInstruction("zh-CN"), /Simplified Chinese \(zh-Hans\)/);
		assert.match(learnerLanguageInstruction("en"), /in English\./);
	});

	it("carries every invariant the model must not translate", () => {
		const text = learnerLanguageInstruction("zh-CN");
		assert.match(text, /tool names, JSON field names, file paths, code, and mathematical notation unchanged/);
		assert.match(text, /follow the learner's language for that turn/);
	});
});

describe("composeInstructions: the language block rides the END", () => {
	it("a locale-less call composes the bare doctrine (pre-i18n bytes)", () => {
		assert.doesNotMatch(composeInstructions("teacher"), /## Learner language/);
	});

	it("zh-CN appends the block after every doctrine segment", () => {
		const prompt = composeInstructions("teacher", undefined, "zh-CN");
		assert.ok(prompt.endsWith(learnerLanguageInstruction("zh-CN")), "the block is the tail");
		assert.equal(prompt.split(LANGUAGE_HEADING).length - 1, 1, "exactly one block");
		assert.ok(prompt.includes("## Learner files"), "doctrine still precedes it");
	});

	it("a per-turn composition (switches) also appends the block", () => {
		const prompt = composeInstructions("prober", {}, "zh-CN");
		assert.ok(prompt.endsWith(learnerLanguageInstruction("zh-CN")));
	});
});

describe("createTeacherAgent: the built prompt carries the session language", () => {
	it("zh-CN: the system prompt ends with the language block; tool names stay English", () => {
		const state = builtTeacher("zh-CN");
		assert.ok(state.systemPrompt.endsWith(learnerLanguageInstruction("zh-CN")));
		// Tool identifiers are protocol, never learner-facing text.
		const names = state.tools.map((tool) => tool.name);
		for (const name of names) assert.match(name, /^[a-z_]+$/, `${name} stays an ASCII tool id`);
		for (const name of ["quiz", "ask_user_question"]) {
			assert.ok((CONVERSATION_TOOL_NAMES as readonly string[]).includes(name));
		}
		assert.match(state.systemPrompt, /\bquiz\b/);
		assert.doesNotMatch(state.systemPrompt, /学习者语言/);
	});

	it("en: the block states English", () => {
		const state = builtTeacher("en");
		assert.ok(state.systemPrompt.endsWith(learnerLanguageInstruction("en")));
	});

	it("absent locale: the legacy prompt bytes (no block)", () => {
		const state = builtTeacher();
		assert.doesNotMatch(state.systemPrompt, /## Learner language/);
	});
});

describe("withLearnerLanguage: the sub-agent block", () => {
	it("appends for a locale and is a no-op without one", () => {
		const base = "You are a researcher.";
		assert.equal(withLearnerLanguage(base), base);
		const wrapped = withLearnerLanguage(base, "zh-CN");
		assert.ok(wrapped.startsWith(base));
		assert.ok(wrapped.endsWith(learnerLanguageInstruction("zh-CN")));
	});
});

describe("the frozen per-session locale", () => {
	it("follow resolves the interface language; an explicit pick stands alone", () => {
		const ui = resolveLocale("system", "zh-CN");
		assert.equal(ui, "zh-CN");
		assert.equal(resolveTeachingLocale("follow", ui), "zh-CN");
		assert.equal(resolveTeachingLocale("en", ui), "en");
		// Traditional-Chinese OS users stay English until a zh-Hant catalog exists.
		assert.equal(resolveLocale("system", "zh-TW"), "en");
	});
});
