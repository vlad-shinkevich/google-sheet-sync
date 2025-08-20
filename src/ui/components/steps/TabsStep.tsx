import * as React from "react"
import { Button } from "../ui/button"

type SheetMeta = { id: number; title: string }

type Props = {
	sheets: SheetMeta[]
	selectedTabs: Set<string>
	loading: boolean
	onBack: () => void
	onNext: () => void
	onToggleTab: (title: string, checked: boolean) => void
}

export function TabsStep({ sheets, selectedTabs, loading, onBack, onNext, onToggleTab }: Props) {
	return (
		<div className="rounded-md border p-2">
			<div className="flex items-center justify-between mb-2">
				<div className="text-sm">Select tabs to load</div>
				<div className="flex items-center gap-2">
					<Button size="sm" variant="outline" onClick={onBack}>Back</Button>
					<Button size="sm" onClick={onNext} disabled={selectedTabs.size === 0 || loading}>{loading ? 'Loading...' : 'Next'}</Button>
				</div>
			</div>
			<div className="flex flex-wrap gap-2">
				{sheets.map((s) => {
					const checked = selectedTabs.has(s.title)
					return (
						<label key={s.id} className="inline-flex items-center gap-2 border rounded px-2 py-1 text-sm cursor-pointer select-none">
							<input
								type="checkbox"
								checked={checked}
								onChange={(e) => onToggleTab(s.title, e.target.checked)}
							/>
							<span>{s.title}</span>
						</label>
					)
				})}
			</div>
		</div>
	)
}


