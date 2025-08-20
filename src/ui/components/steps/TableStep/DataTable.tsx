import * as React from 'react'
import { useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import type { RowData } from '@/ui/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table'
import { Checkbox } from '../../ui/checkbox'

type Props = {
  headers: Array<{ key: string; label: string }>
  rows: RowData[]
  analyzeMode: boolean
  currentSheetKey: string
  tabAnalyzeSelection: Record<string, Record<string, boolean>>
  setTabAnalyzeSelection: React.Dispatch<React.SetStateAction<Record<string, Record<string, boolean>>>>
  tabRowSelection: Record<string, Record<string, boolean>>
  setTabRowSelection: React.Dispatch<React.SetStateAction<Record<string, Record<string, boolean>>>>
  onRowSelectionChange: (rows: RowData[]) => void
}

export function DataTable(props: Props) {
  const { headers, rows, analyzeMode, currentSheetKey, tabAnalyzeSelection, setTabAnalyzeSelection, tabRowSelection, setTabRowSelection, onRowSelectionChange } = props

  const columns = useMemo<ColumnDef<RowData>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => {
        if (analyzeMode) {
          const sel = tabAnalyzeSelection[currentSheetKey] ?? {}
          const pageRows = table.getRowModel().rows
          const allChecked = pageRows.length > 0 && pageRows.every((r) => sel[r.id])
          const someChecked = !allChecked && pageRows.some((r) => sel[r.id])
          return (
            <Checkbox
              checked={allChecked || (someChecked && 'indeterminate')}
              onCheckedChange={(value) => {
                setTabAnalyzeSelection((prev) => {
                  const cur = prev[currentSheetKey] ?? {}
                  const next = { ...cur }
                  if (value) pageRows.forEach((r) => { next[r.id] = true })
                  else pageRows.forEach((r) => { delete next[r.id] })
                  return { ...prev, [currentSheetKey]: next }
                })
              }}
              aria-label="Select all"
              className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
            />
          )
        }
        return (
          <Checkbox
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        )
      },
      cell: ({ row, table }) => (
        <Checkbox
          checked={analyzeMode ? !!(tabAnalyzeSelection[currentSheetKey]?.[row.id]) : row.getIsSelected()}
          onCheckedChange={(value) => {
            if (analyzeMode) {
              setTabAnalyzeSelection((prev) => {
                const cur = prev[currentSheetKey] ?? {}
                const next = { ...cur }
                if (value) next[row.id] = true; else delete next[row.id]
                return { ...prev, [currentSheetKey]: next }
              })
            } else {
              row.toggleSelected(!!value)
            }
          }}
          aria-label={`Select ${row.id}`}
          className={analyzeMode ? 'data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500' : undefined}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    ...headers.map((h) => ({ accessorKey: h.key, header: h.label } as ColumnDef<RowData>))
  ], [headers, analyzeMode, tabAnalyzeSelection, currentSheetKey])

  const currentRowSelection = tabRowSelection[currentSheetKey] ?? {}
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
    state: { rowSelection: currentRowSelection },
    onRowSelectionChange: (updater) => {
      setTabRowSelection((prev) => {
        const prevForTab = prev[currentSheetKey] ?? {}
        const nextForTab = typeof updater === 'function' ? (updater as (old: Record<string, boolean>) => Record<string, boolean>)(prevForTab) : updater
        return { ...prev, [currentSheetKey]: nextForTab }
      })
    },
  })

  React.useEffect(() => {
    onRowSelectionChange(table.getFilteredSelectedRowModel().rows.map((r) => r.original as RowData))
  }, [rows, tabRowSelection])

  const parentRef = React.useRef<HTMLDivElement | null>(null)
  const rowVirtualizer = useVirtualizer({ count: table.getRowModel().rows.length, getScrollElement: () => parentRef.current, estimateSize: () => 36, overscan: 10 })

  return (
    <div ref={parentRef} className={'h-full overflow-auto'}>
      <div className="inline-block min-w-max rounded-md border">
        <Table className="w-full">
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rowVirtualizer.getVirtualItems()[0] && (
              <TableRow style={{ height: rowVirtualizer.getVirtualItems()[0].start }}>
                <TableCell colSpan={headers.length + 1} />
              </TableRow>
            )}
            {rowVirtualizer.getVirtualItems().map((vi) => {
              const r = table.getRowModel().rows[vi.index]
              return (
                <TableRow key={r.id}>
                  {r.getVisibleCells().map((c) => (
                    <TableCell key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</TableCell>
                  ))}
                </TableRow>
              )
            })}
            {(() => {
              const v = rowVirtualizer.getVirtualItems()
              const end = v.length ? v[v.length - 1].end : 0
              const total = rowVirtualizer.getTotalSize()
              const pad = Math.max(0, total - end)
              return pad > 0 ? (
                <TableRow style={{ height: pad }}>
                  <TableCell colSpan={headers.length + 1} />
                </TableRow>
              ) : null
            })()}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}


