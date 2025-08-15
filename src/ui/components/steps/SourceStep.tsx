import * as React from "react"
import { Input } from "../ui/input"
import { Button } from "../ui/button"

type Props = {
	sheetUrl: string
	loading: boolean
	onChangeUrl: (url: string) => void
	onConnect: () => void
	onLoad: () => void
    userinfo?: { email?: string; name?: string; picture?: string }
    onRefreshUserinfo?: () => void
}

export function SourceStep({ sheetUrl, loading, onChangeUrl, onConnect, onLoad, userinfo, onRefreshUserinfo }: Props) {
	return (
		<div className="flex items-center gap-2 justify-between">
			<div className="text-sm text-muted-foreground">Google Sheet</div>
			<div className="flex items-center gap-2">
				<Input placeholder="Paste Google Sheet URL" value={sheetUrl} onChange={(e)=>onChangeUrl(e.target.value)} className="w-[340px]" />
				<Button size="sm" variant="outline" onClick={onLoad} disabled={loading}>{loading ? 'Loading…' : 'Load'}</Button>
				{userinfo?.email ? (
					<span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
						{userinfo.picture && <img src={userinfo.picture} alt="avatar" className="w-4 h-4 rounded-full" />}
						<span>{userinfo.name ?? userinfo.email}</span>
						{onRefreshUserinfo && (
							<button className="underline hover:no-underline" onClick={onRefreshUserinfo}>Refresh</button>
						)}
					</span>
				) : (
					<div className="flex items-center gap-2">
						<Button size="sm" onClick={onConnect}>Connect Google</Button>
						{onRefreshUserinfo && (
							<button className="text-xs underline hover:no-underline" onClick={onRefreshUserinfo}>Refresh profile</button>
						)}
					</div>
				)}
			</div>
		</div>
	)
}


