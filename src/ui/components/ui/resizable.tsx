import * as React from 'react'
import { cn } from '@/lib/utils'

type HandleProps = React.HTMLAttributes<HTMLDivElement>

export const ResizableHandle = React.forwardRef<HTMLDivElement, HandleProps>(
	({ className, ...props }, ref) => {
		const startRef = React.useRef<{ x: number; y: number; w: number; h: number } | null>(null)

		function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
			startRef.current = { x: e.clientX, y: e.clientY, w: window.innerWidth, h: window.innerHeight }
			const onMove = (ev: PointerEvent) => {
				const s = startRef.current
				if (!s) return
				const dx = ev.clientX - s.x
				const dy = ev.clientY - s.y
				parent.postMessage(
					{ pluginMessage: { type: 'resize', width: Math.max(320, Math.round(s.w + dx)), height: Math.max(240, Math.round(s.h + dy)) } },
					'*',
				)
			}
			const onUp = () => {
				window.removeEventListener('pointermove', onMove)
				window.removeEventListener('pointerup', onUp)
				startRef.current = null
			}
			window.addEventListener('pointermove', onMove)
			window.addEventListener('pointerup', onUp)
		}

		return (
			<div
				ref={ref}
				onPointerDown={onPointerDown}
				className={cn(
					'fixed bottom-2 right-2 z-50 size-3 cursor-nwse-resize rounded-md border border-border bg-card/60 hover:bg-card shadow',
					className,
				)}
				{...props}
			/>
		)
	},
)
ResizableHandle.displayName = 'ResizableHandle'


