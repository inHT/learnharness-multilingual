/**
 * THE SUB-AGENT LANGUAGE BLOCK (i18n wave, 2026-11-21): sub-agents whose
 * output the learner SEES — research briefs quoted by the teacher, drawn
 * figures and their labels, extracted propositions, demos, PDF reading —
 * carry the session's frozen teaching language. Internal reasoning stays
 * English; only learner-facing wording is steered.
 *
 * Same appended block as the teacher's (core/locales.ts owns the text), so
 * the main agent and its workers state one rule. A locale-less call keeps
 * the prompt byte-identical (pre-i18n behavior, test seams).
 */

import { learnerLanguageInstruction, type AppLocale } from "../../core/locales.ts";

export function withLearnerLanguage(systemPrompt: string, locale?: AppLocale): string {
	if (!locale) return systemPrompt;
	return `${systemPrompt}\n\n---\n\n${learnerLanguageInstruction(locale)}`;
}
