"use client";

import type { CacheRetention } from "@earendil-works/pi-ai";
import { useT } from "@/src/i18n/react";
import { translate } from "@/src/i18n";
import type { AppLocale } from "@/src/core";

const OPTIONS = [
	{ value: undefined, compact: "settings.agent.cache.compact.default", label: "settings.agent.cache.optionDefault.label", description: "settings.agent.cache.optionDefault.description" },
	{ value: "none", compact: "settings.agent.cache.compact.none", label: "settings.agent.cache.optionNone.label", description: "settings.agent.cache.optionNone.description" },
	{ value: "short", compact: "settings.agent.cache.compact.short", label: "settings.agent.cache.optionShort.label", description: "settings.agent.cache.optionShort.description" },
	{ value: "long", compact: "settings.agent.cache.compact.long", label: "settings.agent.cache.optionLong.label", description: "settings.agent.cache.optionLong.description" },
] as const;

export function cacheRetentionLabel(value: CacheRetention | undefined, locale: AppLocale = "en"): string {
	return translate(locale, "settings.agent.cache.label", { value: translate(locale, OPTIONS.find((option) => option.value === value)!.compact) });
}

export function CacheRetentionMenu({ value, onPick }: {
	value: CacheRetention | undefined;
	onPick: (value: CacheRetention | undefined) => void;
}) {
	const t = useT();
	return <>
		<div className="border-b border-border px-2 pb-2">
			<p className="text-card-foreground">{t("settings.agent.cache.retention")}</p>
			<p className="mt-1 text-muted-foreground">{t("settings.agent.cache.description")}</p>
		</div>
		{OPTIONS.map((option) => <button
			key={option.value ?? "default"}
			type="button"
			data-testid={`cache-retention-option-${option.value ?? "default"}`}
			aria-pressed={value === option.value}
			onClick={() => onPick(option.value)}
			className={`rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted ${value === option.value ? "bg-muted/60" : ""}`}
		>
			<span className="flex justify-between gap-2 text-card-foreground"><span>{t(option.label)}</span>{value === option.value && <span aria-hidden>✓</span>}</span>
			<span className="mt-1 block text-muted-foreground">{t(option.description)}</span>
		</button>)}
	</>;
}
