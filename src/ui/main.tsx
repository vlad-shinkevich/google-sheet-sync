import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'

function App() {
	return (
		<div className="p-4 space-y-3">
			<h2 className="text-lg font-semibold">UI Demo</h2>
			<div className="flex flex-col gap-2">
				<Input placeholder="Type here" />
				<div className="flex gap-2">
					<Button>Primary</Button>
					<Button variant="outline">Outline</Button>
				</div>
			</div>
		</div>
	)
}

createRoot(document.getElementById('root')!).render(<App />)


