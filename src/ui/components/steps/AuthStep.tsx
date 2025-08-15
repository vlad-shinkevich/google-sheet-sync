import * as React from "react"
import { Button } from "../ui/button"

type Props = {
	onConnect: () => void
}

export function AuthStep({ onConnect }: Props) {
	return (
		<div className="flex-1 min-h-0 flex items-center justify-center">
			<div className="w-full max-w-sm border rounded-md p-4 text-sm space-y-3">
				<div className="font-medium">Sign in with Google</div>
				<div className="text-muted-foreground">Connect your Google account to access your spreadsheets.</div>
				<div className="flex items-center justify-end">
					<Button size="sm" onClick={onConnect}>Connect Google</Button>
				</div>
			</div>
		</div>
	)
}


