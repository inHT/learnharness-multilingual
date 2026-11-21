"use client";

/**
 * THE LANGUAGE ROWS (i18n wave, 2026-11-21): the General section's
 * interface-language and teaching-language controls. The interface pick
 * drives the LIVE switch — the write lands through the same section PUT
 * seam as every General row, and the acknowledged save calls the i18n
 * provider's setLocale so nothing reloads. The teaching pick only writes;
 * the agent layer reads it per NEW session (sessions freeze their
 * language at creation).
 *
 * Dictation stays a separate axis — its picker lives in Providers, and
 * the language row's hint says so rather than duplicating the control.
 */

import { APP_LOCALES, resolveLocale, type GeneralSettings, type LocaleSetting, type TeachingLocaleSetting } from "@/src/core";
import { useI18n } from "@/src/i18n/react";
import { SettingsRow, ThinSelect } from "./controls.tsx";

export function LanguageSettings({
	general,
	onWrite,
}: {
	/** The record's general section (the delta this row composes onto). */
	general: GeneralSettings;
	/** The section PUT writer; resolves true when the save acknowledged. */
	onWrite: (next: GeneralSettings) => Promise<boolean>;
}) {
	const { t, systemTag, setLocale } = useI18n();
	const setting: LocaleSetting = general.locale ?? "system";
	const teaching: TeachingLocaleSetting = general.teachingLocale ?? "follow";

	const pickLocale = (raw: string) => {
		const next = raw as LocaleSetting;
		// Resolve exactly like the boot did (the same OS tag), and switch only
		// after the PUT acknowledges — a rejected save leaves the UI where it was.
		void onWrite({ ...general, locale: next }).then((saved) => {
			if (saved) setLocale(resolveLocale(next, systemTag));
		});
	};
	const pickTeaching = (raw: string) => {
		void onWrite({ ...general, teachingLocale: raw as TeachingLocaleSetting });
	};

	return (
		<>
			<SettingsRow
				label={t("settings.general.language.label")}
				hint={t("settings.general.language.hint")}
				testid="row-language"
			>
				<ThinSelect
					value={setting}
					ariaLabel={t("settings.general.language.label")}
					testid="language-select"
					onChange={pickLocale}
				>
					<option value="system">{t("settings.general.language.system")}</option>
					{APP_LOCALES.map((l) => (
						<option key={l.id} value={l.id}>{l.label}</option>
					))}
				</ThinSelect>
			</SettingsRow>
			<SettingsRow
				label={t("settings.general.teachingLanguage.label")}
				hint={t("settings.general.teachingLanguage.hint")}
				testid="row-teaching-language"
			>
				<ThinSelect
					value={teaching}
					ariaLabel={t("settings.general.teachingLanguage.label")}
					testid="teaching-language-select"
					onChange={pickTeaching}
				>
					<option value="follow">{t("settings.general.teachingLanguage.follow")}</option>
					{APP_LOCALES.map((l) => (
						<option key={l.id} value={l.id}>{l.label}</option>
					))}
				</ThinSelect>
			</SettingsRow>
		</>
	);
}
