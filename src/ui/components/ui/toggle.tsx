import * as React from "react"
import * as TogglePrimitive from "@radix-ui/react-toggle"
import { cn } from "@/lib/utils"

const Toggle = React.forwardRef<
	React.ElementRef<typeof TogglePrimitive.Root>,
	React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root>
>(({ className, pressed, ...props }, ref) => (
	<TogglePrimitive.Root
		ref={ref}
		data-state={pressed ? "on" : "off"}
		className={cn(
			"inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors",
			"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
			"disabled:pointer-events-none disabled:opacity-50",
			"bg-transparent hover:bg-accent hover:text-accent-foreground",
			"data-[state=on]:bg-accent data-[state=on]:text-accent-foreground",
			"h-9 px-3",
			className,
		)}
		{...props}
	/>
))
Toggle.displayName = TogglePrimitive.Root.displayName

export { Toggle }


