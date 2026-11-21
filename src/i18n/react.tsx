"use client";

/**
 * THE I18N CLIENT BINDING (i18n wave, 2026-11-21): the root provider and
 * the `useT()` hook every component reads. The layout seeds the resolved
 * locale server-side (same discipline as the appearance boot — no first
 * frame in the wrong language); the settings General section drives every
 * live switch through setLocale, so changing the language never reloads
 * the app.
 *
 * The context is OPTIONAL at read time: standalone render tests (and any
 * seam mounted without the root) resolve against the English catalog
 * instead of crashing — English is the fallback language everywhere.
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { translate } from "./index.ts";
import type { AppLocale } from "../core/locales.ts";

export interface I18nContextValue {
	/** The resolved interface locale (never "system" — the boot resolved it). */
	locale: AppLocale;
	/** The OS language tag the boot resolved against, so a live "system"
	 *  pick resolves identically to the server boot (no navigator drift). */
	systemTag: string;
	/** Translate for the CURRENT locale. New identity per locale change. */
	t: (key: string, params?: Record<string, unknown>) => string;
	/** Live switch — the settings General section calls this after the
	 *  section PUT acknowledges (writers dispatch, readers re-render). */
	setLocale: (locale: AppLocale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
	initialLocale,
	systemTag,
	children,
}: {
	initialLocale: AppLocale;
	systemTag: string;
	children: ReactNode;
}) {
	const [locale, setLocale] = useState(initialLocale);
	// The layout sets <html lang> server-side; this keeps it honest through
	// every live switch (screen readers + Intl consumers read it). The
	// desktop shell's native menu follows the same report (Electron rebuilds
	// its custom labels; role items stay OS-localized).
	useEffect(() => {
		document.documentElement.lang = locale;
		window.lh?.setLocale?.(locale);
	}, [locale]);
	const value = useMemo<I18nContextValue>(
		() => ({
			locale,
			systemTag,
			t: (key, params) => translate(locale, key, params),
			setLocale,
		}),
		[locale, systemTag],
	);
	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
	const ctx = useContext(I18nContext);
	if (ctx) return ctx;
	// No provider mounted (standalone render tests): English catalog serves.
	return {
		locale: "en",
		systemTag: "",
		t: (key, params) => translate("en", key, params),
		setLocale: () => {},
	};
}

/** The one-liner most components want: `const t = useT();` */
export function useT(): (key: string, params?: Record<string, unknown>) => string {
	return useI18n().t;
}
