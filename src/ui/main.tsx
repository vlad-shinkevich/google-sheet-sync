import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { DataTableDemo } from './components/data-table-demo'
import { ResizableHandle } from './components/ui/resizable'

function App() {
	return (
		<div className="p-4 space-y-3">
			<h2 className="text-lg font-semibold">UI Demo</h2>
			<DataTableDemo />
			<ResizableHandle />
		</div>
	)
}

createRoot(document.getElementById('root')!).render(<App />)


