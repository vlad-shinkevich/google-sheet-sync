import * as React from "react"
import type { ConfirmPayload } from "../data-table-demo"

type Props = {
	payload: ConfirmPayload
	onBack: () => void
}

export function ConfirmScreen({ payload, onBack }: Props) {
	return (
		<div className="h-full flex flex-col gap-3 min-h-0">
			<div className="text-sm text-muted-foreground">Confirm data from selected tabs.</div>
			<div className="flex-1 min-h-0 rounded-md border p-2 text-xs overflow-auto space-y-4">
				{payload.selectedTabs.map((t) => (
					<div key={t} className="border rounded p-2">
						<div className="font-medium mb-2">{t}</div>
						<pre className="whitespace-pre-wrap break-all">{JSON.stringify(payload.byTab[t]?.rows ?? [], null, 2)}</pre>
					</div>
				))}
			</div>
			<div className="flex items-center justify-end gap-2">
				<button className="inline-flex items-center justify-center rounded-md border px-3 py-1 text-sm" onClick={onBack}>Back</button>
			</div>
		</div>
	)
}


