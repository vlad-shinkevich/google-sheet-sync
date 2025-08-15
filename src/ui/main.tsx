import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { DataTableDemo, RowData, ConfirmPayload } from './components/data-table-demo'
import { ResizableHandle } from './components/ui/resizable'

type Step = 'select' | 'confirm'

function ConfirmScreen({ payload, onBack }: { payload: ConfirmPayload; onBack: () => void }) {
    return (
        <div className="h-full flex flex-col gap-3 min-h-0">
            <div className="text-sm text-muted-foreground">Confirm data from selected tabs.</div>
            <div className="flex-1 min-h-0 rounded-md border p-2 text-xs overflow-auto space-y-4">
                {payload.selectedTabs.map((t) => (
                    <div key={t} className="border rounded p-2">
                        <div className="font-medium mb-2">{t}</div>
                        <pre className="whitespace-pre-wrap break-all">{JSON.stringify(payload.byTab[t]?.rows ?? [], null, 2)}</pre>
                    </div>
                ))}
            </div>
            <div className="flex items-center justify-end gap-2">
                <button className="inline-flex items-center justify-center rounded-md border px-3 py-1 text-sm" onClick={onBack}>Back</button>
            </div>
        </div>
    )
}

function App() {
    const [step, setStep] = React.useState<Step>('select')
    const [selectedRows, setSelectedRows] = React.useState<RowData[]>([])
    const [confirmPayload, setConfirmPayload] = React.useState<ConfirmPayload | null>(null)

    return (
        <div className="h-full flex flex-col p-4 gap-3 min-h-0">
            <h2 className="text-lg font-semibold">UI Demo</h2>
            <div className="flex-1 min-h-0 relative">
                <div className={step === 'select' ? 'h-full' : 'hidden'}>
                    <DataTableDemo onSelectionChange={setSelectedRows} onNext={(p) => { setConfirmPayload(p); setStep('confirm') }} />
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


