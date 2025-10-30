import React from 'react'
import * as XLSX from 'xlsx'
import { Button } from './ui/button'
import type { RowData } from '@/ui/types'
import { Upload, FileSpreadsheet, X } from 'lucide-react'

type Props = {
  onDataLoaded: (data: { headers: Array<{ key: string; label: string }>; rows: RowData[] }) => void
  onClear: () => void
}

export function XlsxUpload({ onDataLoaded, onClear }: Props) {
  const [isDragging, setIsDragging] = React.useState(false)
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      alert('Please upload an Excel file (.xlsx or .xls)')
      return
    }

    setIsLoading(true)
    setFileName(file.name)

    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      
      // Use first sheet
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
      
      if (jsonData.length === 0) {
        alert('The Excel file is empty')
        setIsLoading(false)
        return
      }

      // Parse headers from first row
      const headerRow = jsonData[0] || []
      const maxCols = Math.max(...jsonData.map(row => row?.length || 0))
      const labels = Array.from({ length: maxCols }, (_, i) => 
        String(headerRow[i] ?? `Column ${i + 1}`)
      )

      // Create keys from labels
      const toKey = (s: string) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_')
      const preliminary = labels.map(toKey)
      const used = new Set<string>()
      const keys = preliminary.map((k, i) => {
        let base = k || `col_${i + 1}`
        let name = base
        let n = 1
        while (used.has(name)) {
          name = `${base}_${n++}`
        }
        used.add(name)
        return name
      })

      // Parse data rows (skip header row)
      const dataRows: RowData[] = (jsonData.length > 1 ? jsonData.slice(1) : []).map((row) => {
        const obj: RowData = {}
        keys.forEach((k, i) => {
          obj[k] = row && row[i] !== undefined ? String(row[i]) : ''
        })
        return obj
      })

      const headers = labels.map((label, i) => ({ label, key: keys[i] }))

      onDataLoaded({ headers, rows: dataRows })
    } catch (error) {
      console.error('Error parsing Excel file:', error)
      alert('Failed to parse Excel file')
      setFileName(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFile(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFile(file)
    }
  }

  const handleClear = () => {
    setFileName(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onClear()
  }

  return (
    <div className="flex flex-col gap-4">
      {!fileName ? (
        <div
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-colors
            ${isDragging 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            }
          `}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileInput}
          />
          <div className="flex flex-col items-center gap-3">
            <Upload className="w-12 h-12 text-gray-400" />
            <div>
              <p className="text-lg font-medium text-gray-700">
                Drop your Excel file here
              </p>
              <p className="text-sm text-gray-500 mt-1">
                or click to browse (.xlsx, .xls)
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg p-4 bg-green-50 border-green-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-8 h-8 text-green-600" />
              <div>
                <p className="font-medium text-gray-900">{fileName}</p>
                <p className="text-sm text-gray-600">File loaded successfully</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-gray-600 hover:text-gray-900"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="text-center py-4">
          <p className="text-gray-600">Loading Excel file...</p>
        </div>
      )}
    </div>
  )
}


