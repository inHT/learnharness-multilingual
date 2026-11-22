"use client";

import { Button } from "@/components/ui/button";
import { useT } from "@/src/i18n/react";

/** Recovery belongs to the transcript, never the answer dock. The caller
 * only offers it for the current saved malformed batch, not failed/aborted
 * generations or historical attempts. */
export function MalformedQuestion({ onRetry, disabled, reason }: {
	onRetry?: () => void;
	disabled?: boolean;
	reason?: string;
}) {
	const t = useT();
	return (
		<div data-testid="malformed-question" className="my-2 rounded-xl border border-dashed bg-card/60 p-3 text-sm text-muted-foreground">
			<p>{t("question.malformed")}{onRetry ? ` ${t("question.malformedHint")}` : ""}</p>
			{onRetry && <Button type="button" variant="outline" size="xs" className="mt-2" disabled={disabled}
				title={reason ?? t("question.malformedTooltip")} data-testid="retry-malformed-question" onClick={onRetry}>
				{t("question.retryMalformed")}
			</Button>}
			{reason && <p className="mt-1 text-xs">{reason}</p>}
		</div>
	);
}
