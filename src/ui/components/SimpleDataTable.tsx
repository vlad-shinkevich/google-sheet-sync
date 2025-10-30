import React from 'react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { Checkbox } from './ui/checkbox'
import { ScrollArea } from './ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import type { RowData } from '@/ui/types'

type Props = {
  headers: Array<{ key: string; label: string }>
  rows: RowData[]
  onRowSelectionChange: (selectedRows: RowData[]) => void
}

export function SimpleDataTable({ headers, rows, onRowSelectionChange }: Props) {
  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({})

  const columns = React.useMemo<ColumnDef<RowData, any>[]>(() => {
    const cols: ColumnDef<RowData, any>[] = [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => {
              table.toggleAllPageRowsSelected(!!value)
            }}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        size: 40,
      },
    ]

    headers.forEach((h) => {
      cols.push({
        accessorKey: h.key,
        header: h.label,
        cell: ({ getValue }) => {
          const val = getValue()
          return <div className="max-w-[200px] truncate">{String(val || '')}</div>
        },
      })
    })

    return cols
  }, [headers])

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
  })

  React.useEffect(() => {
    const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original)
    onRowSelectionChange(selectedRows)
  }, [rowSelection, onRowSelectionChange, table])

  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No data loaded. Please upload an Excel file.
      </div>
    )
  }

  return (
    <div className="border rounded-lg">
      <ScrollArea className="h-[400px]">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} style={{ width: header.getSize() }}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  )
}


