"use client";

import { RefreshCw, Settings } from "lucide-react";
import { usePlugins } from "@/components/plugins";
import type { FrontendPlugin } from "@/components/plugin-manager";
import { Button } from "@/components/ui/button";
import { SettingsRow, SettingsSection, Toggle } from "./controls";
import { useT } from "@/src/i18n/react";
import { translate } from "@/src/i18n";
import type { AppLocale } from "@/src/core";

export const PLUGIN_TRUST_WARNING = "Only enable plugins you trust. Plugins run trusted local code with broad file and network access; they are not sandboxed. A broken plugin may require restarting LearnHarness.";

/** The trust warning in the given interface language (i18n wave). */
export function pluginTrustWarning(locale: AppLocale = "en"): string {
	return translate(locale, "settings.plugins.trustWarning");
}

export function PluginsSection({ onOpenSettings, origin = "community" }: { onOpenSettings?: (pluginId: string) => void; origin?: "core" | "community" }) {
	const { manager, snapshot } = usePlugins();
	const core = origin === "core";
	const plugins = snapshot.plugins.filter(plugin => plugin.info.origin === origin);
	const t = useT();
	return <SettingsSection title={core ? t("settings.nav.corePlugins") : t("settings.nav.communityPlugins")} testid={core ? "section-core-plugins" : "section-plugins"}>
		{!core && <>
		<p className="font-prose text-sm text-muted-foreground">{t("settings.plugins.trustWarning")}</p>
		<details data-testid="plugin-install-help" className="text-xs text-muted-foreground">
			<summary className="w-fit cursor-pointer list-none text-muted-foreground underline underline-offset-2 hover:text-foreground [&::-webkit-details-marker]:hidden">{t("settings.plugins.howToInstall")}</summary>
			<ol className="mt-2 list-decimal space-y-2 pl-5">
				<li>{t("settings.plugins.installStep1")}</li>
				<li>{t("settings.plugins.installStep2Before")} <code>npm run build</code>{t("settings.plugins.installStep2Middle")} <code>dist/manifest.json</code>{t("settings.plugins.installStep2After")}</li>
				<li>{t("settings.plugins.installStep3")}</li>
				<li>{t("settings.plugins.installStep4Before")} <code>data/</code>{t("settings.plugins.installStep4Middle")} <code>dist/</code>{t("settings.plugins.installStep4After")}</li>
			</ol>
		</details>
		<div data-testid="plugin-authoring-help" className="space-y-2 border-t border-border/60 pt-3">
			<h3 className="text-xs uppercase tracking-widest">{t("settings.plugins.buildPlugin")}</h3>
			<p className="font-prose text-sm text-muted-foreground">{t("settings.plugins.authoringNote")}</p>
			<Button variant="outline" size="sm" asChild><a href="/plugin-authoring/learnharness-plugins.zip" download={`learnharness-plugins-${process.env.LH_VERSION ?? "authoring"}.zip`} data-testid="download-plugin-authoring">{t("settings.plugins.downloadSkill")}</a></Button>
		</div>
		<div data-testid="plugin-directory" className="border-t border-border/60 pt-3">
			<p className="text-xs text-muted-foreground">{t("settings.plugins.directory")}</p>
			<div className="mt-1 flex items-center gap-3">
				<code className="min-w-0 flex-1 break-all text-xs select-text">{snapshot.directory}</code>
				<Button variant="outline" size="icon-sm" aria-label={t("settings.plugins.refresh")} title={t("settings.plugins.refresh")} aria-busy={snapshot.refreshing}
					disabled={!manager || snapshot.refreshing || snapshot.plugins.some(plugin => plugin.busy)} onClick={() => void manager?.refresh()}>
					<RefreshCw aria-hidden="true" className={snapshot.refreshing ? "animate-spin" : undefined} />
				</Button>
			</div>
		</div>
		{snapshot.conflicts.map(conflict => <p role="alert" key={conflict.id} className="break-words text-xs text-destructive">{conflict.error}</p>)}
		</>}
		{snapshot.error && <p role="alert" className="text-xs text-destructive">{snapshot.error}</p>}
		{snapshot.loading ? <p role="status" className="text-xs text-muted-foreground">{t("settings.loadingPlugins")}</p>
			: plugins.length === 0 ? <p className="text-xs text-muted-foreground">{core ? t("settings.plugins.noneCore") : t("settings.plugins.noneCommunity")}</p>
				: plugins.map(plugin => <PluginRow key={plugin.info.id} plugin={plugin}
					onSettings={() => onOpenSettings?.(plugin.info.id)} />)}
	</SettingsSection>;
}

function PluginRow({ plugin, onSettings }: { plugin: FrontendPlugin; onSettings: () => void }) {
	const t = useT();
	const { manager, snapshot } = usePlugins();
	const { info } = plugin;
	const name = info.manifest?.name ?? info.id;
	return <div className="border-t border-border/60 pt-3" data-testid={`plugin-${info.id}`}>
		<SettingsRow label={name} hint={[info.origin === "community" ? info.manifest?.version : undefined, plugin.busy ? t("settings.plugins.saving") : plugin.error ? t("settings.plugins.error") : plugin.phase === "loading" ? t("common.loading") : info.enabled ? t("settings.plugins.enabled") : t("settings.plugins.disabled")].filter(Boolean).join(" · ")}>
			<div className="flex shrink-0 items-center gap-2">
				{info.enabled && <button type="button" aria-label={t("settings.plugins.settingsFor", { name })} title={t("settings.plugins.settingsFor", { name })}
					className="flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					onClick={onSettings}><Settings className="size-3.5" aria-hidden="true" /></button>}
				<Toggle label={t("settings.plugins.enable", { name })} checked={info.enabled} disabled={!manager || plugin.busy || snapshot.refreshing || (!info.manifest && !info.enabled)} onChange={enabled => void manager?.setEnabled(info.id, enabled)} />
			</div>
		</SettingsRow>
		{info.manifest?.description && <p className="mt-1 font-prose text-sm text-muted-foreground">{info.manifest.description}</p>}
		{plugin.error && <p role="alert" className="mt-2 break-words text-xs text-destructive">{plugin.error}</p>}
	</div>;
}
