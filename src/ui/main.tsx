import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { DataTableDemo } from './components/data-table-demo'
import { ResizableHandle } from './components/ui/resizable'

function App() {
	return (
		<div className="h-full flex flex-col p-4 gap-3 min-h-0">
			<h2 className="text-lg font-semibold">UI Demo</h2>
			<div className="flex-1 min-h-0">
				<DataTableDemo />
			</div>
			<ResizableHandle />
		</div>
	)
}

createRoot(document.getElementById('root')!).render(<App />)


