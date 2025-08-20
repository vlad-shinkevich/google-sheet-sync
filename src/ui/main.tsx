import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { SheetSyncWizard } from './components/sheets/SheetSyncWizard'
import type { RowData, ConfirmPayload } from './types'
import { ResizableHandle } from './components/ui/resizable'

type Step = 'select' | 'confirm'

import { ConfirmScreen } from './components/steps/ConfirmScreen'

function App() {
    const [step, setStep] = React.useState<Step>('select')
    const [selectedRows, setSelectedRows] = React.useState<RowData[]>([])
    const [confirmPayload, setConfirmPayload] = React.useState<ConfirmPayload | null>(null)

    return (
        <div className="h-full flex flex-col p-4 gap-3 min-h-0">
            <h2 className="text-lg font-semibold">UI Demo</h2>
            <div className="flex-1 min-h-0 relative">
                <div className={step === 'select' ? 'h-full' : 'hidden'}>
                    <SheetSyncWizard onSelectionChange={setSelectedRows} onNext={(p) => { setConfirmPayload(p); setStep('confirm') }} />
                </div>
                <div className={step === 'confirm' ? 'h-full' : 'hidden'}>
                    {confirmPayload && <ConfirmScreen payload={confirmPayload} onBack={() => setStep('select')} />}
                </div>
            </div>
            <ResizableHandle />
        </div>
    )
}

createRoot(document.getElementById('root')!).render(<App />)


