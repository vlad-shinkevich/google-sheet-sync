import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import type { RowData } from './types'
import { XlsxUpload } from './components/XlsxUpload'
import { SimpleDataTable } from './components/SimpleDataTable'
import { Button } from './components/ui/button'
import { attachImageFetchHandler } from './lib/imageHandler'

function App() {
  const [headers, setHeaders] = React.useState<Array<{ key: string; label: string }>>([])
  const [rows, setRows] = React.useState<RowData[]>([])
  const [selectedRows, setSelectedRows] = React.useState<RowData[]>([])
  const [syncStatus, setSyncStatus] = React.useState<string>('')

  const handleDataLoaded = (data: { headers: Array<{ key: string; label: string }>; rows: RowData[] }) => {
    setHeaders(data.headers)
    setRows(data.rows)
    setSelectedRows([])
    setSyncStatus('')
  }

  const handleClear = () => {
    setHeaders([])
    setRows([])
    setSelectedRows([])
    setSyncStatus('')
  }

  const handleSync = () => {
    if (selectedRows.length === 0) {
      alert('Please select at least one row to sync')
      return
    }

    setSyncStatus('Syncing...')

    // Send sync message to Figma plugin code
    parent.postMessage(
      {
        pluginMessage: {
          type: 'sync/text',
          payload: {
            sets: [
              {
                tabTitle: 'Sheet1',
                headers: headers,
                rows: selectedRows,
              },
            ],
          },
        },
      },
      '*'
    )
  }

  // Listen for sync results from Figma plugin
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage || event.data
      if (msg?.type === 'sync/text:result') {
        if (msg.error) {
          setSyncStatus(`Error: ${msg.error}`)
        } else if (msg.result) {
          setSyncStatus(
            `Success! Created ${msg.result.clones} clones, updated ${msg.result.updated} elements`
          )
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Attach image fetch handler
  React.useEffect(() => {
    const cleanup = attachImageFetchHandler()
    return cleanup
  }, [])

  return (
    <div className="h-full flex flex-col p-6 gap-4 min-h-0">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Excel to Figma Sync</h1>
        <p className="text-sm text-gray-600 mt-1">
          Upload an Excel file, select rows, and sync to your Figma design
        </p>
      </div>

      <XlsxUpload onDataLoaded={handleDataLoaded} onClear={handleClear} />

      {rows.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {selectedRows.length} of {rows.length} rows selected
            </p>
            <Button onClick={handleSync} disabled={selectedRows.length === 0}>
              Sync to Figma
            </Button>
          </div>

          <SimpleDataTable headers={headers} rows={rows} onRowSelectionChange={setSelectedRows} />

          {syncStatus && (
            <div
              className={`p-3 rounded-lg text-sm ${
                syncStatus.startsWith('Error')
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : syncStatus.startsWith('Success')
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}
            >
              {syncStatus}
            </div>
          )}
        </>
      )}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
