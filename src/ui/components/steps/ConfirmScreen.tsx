import * as React from "react"
import type { ConfirmPayload } from "@/ui/types"
import { inferFieldType, type FieldKind } from '@/ui/lib/infer'

type Props = {
	payload: ConfirmPayload
	onBack: () => void
}

export function ConfirmScreen({ payload, onBack }: Props) {
	const [layers, setLayers] = React.useState<Array<{ id: string; name: string; tag: string }>>([])
	const [fieldKeys, setFieldKeys] = React.useState<string[]>([])
	const [fieldTypes, setFieldTypes] = React.useState<Record<string, FieldKind>>({})

	React.useEffect(() => {
		parent.postMessage({ pluginMessage: { type: 'layers/getForSelection' } }, '*')
		function onMessage(e: MessageEvent) {
			const msg = (e.data && (e as any).data.pluginMessage) || (e as any).data
			if (msg?.type === 'layers/eligible') {
				setLayers(msg.layers || [])
			}
		}
		window.addEventListener('message', onMessage)
		const merged = new Set<string>()
		const inferred: Record<string, FieldKind> = {}
		payload.selectedTabs.forEach((t) => {
			const by = payload.byTab[t]
			if (!by) return
			by.headers?.forEach?.((h: any) => {
				merged.add(h.key)
				const firstRow = by.rows?.[0]
				const sample = firstRow ? firstRow[h.key] : ''
				const type = inferFieldType(sample)
				if (!inferred[h.key]) inferred[h.key] = type
			})
		})
		setFieldKeys(Array.from(merged))
		setFieldTypes(inferred)
		return () => window.removeEventListener('message', onMessage)
	}, [payload])

	const tagToCount = React.useMemo(() => {
		const map = new Map<string, number>()
		layers.forEach((l) => { map.set(l.tag, (map.get(l.tag) || 0) + 1) })
		return map
	}, [layers])

	const sortedTags = React.useMemo(() => Array.from(tagToCount.keys()).sort(), [tagToCount])

	return (
		<div className="h-full flex flex-col gap-3 min-h-0">
			<div className="text-sm text-muted-foreground">Match Figma layers to sheet fields</div>
			<div className="flex-1 min-h-0 rounded-md border">
				<div className="grid grid-cols-2 gap-0 text-xs">
					<div className="px-2 py-1 border-b font-medium">Figma layers (#tag)</div>
					<div className="px-2 py-1 border-b font-medium">Matched field</div>
				</div>
				<div className="min-h-0 max-h-full overflow-auto">
					{sortedTags.map((tag) => {
						const count = tagToCount.get(tag) || 0
						const exists = fieldKeys.includes(tag)
						let badge: FieldKind = fieldTypes[tag] || 'text'
						if (/variant/i.test(tag)) badge = 'variant'
						else if (/color|colour/i.test(tag)) badge = 'color'
						else if (/image|img|photo|picture/i.test(tag)) badge = 'image'
						return (
							<div key={tag} className="grid grid-cols-2 items-center gap-0 py-1 px-2 border-b last:border-b-0">
								<div className="flex items-center gap-2 min-w-0">
									<span className="truncate">#{tag}</span>
									{count > 1 && (
										<span className="inline-flex items-center justify-center rounded-full border px-1.5 py-0.5 text-[10px] text-muted-foreground">{count}</span>
									)}
								</div>
								<div className="flex items-center gap-2 min-w-0">
									{exists ? (
										<>
											<span className="truncate text-green-600">{tag}</span>
											<span className="inline-flex items-center justify-center rounded-md border px-1.5 py-0.5 text-[10px] text-muted-foreground">{badge}</span>
										</>
									) : (
										<span className="truncate text-orange-600">missing</span>
									)}
								</div>
							</div>
						)
					})}
					{sortedTags.length === 0 && (
						<div className="px-2 py-2 text-xs text-muted-foreground">Select a component or instance with layers named starting with #.</div>
					)}
				</div>
			</div>
			<div className="flex items-center justify-end gap-2">
				<button className="inline-flex items-center justify-center rounded-md border px-3 py-1 text-sm" onClick={onBack}>Back</button>
			</div>
		</div>
	)
}


