"use client"
import * as React from "react"
import { useMemo } from "react"
import {
    ColumnDef,
    getCoreRowModel,
    useReactTable,
    flexRender,
} from "@tanstack/react-table"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table"
import { Checkbox } from "./ui/checkbox"

type Item = {
	id: string
	name: string
	email: string
	status: "active" | "disabled"
	role: "admin" | "editor" | "viewer"
	department: string
	location: string
	createdAt: string
	score: number
}

const sample: Item[] = [
	{ id: "1", name: "Alice", email: "alice@example.com", status: "active", role: "admin", department: "Design", location: "Berlin", createdAt: "2024-10-01", score: 92 },
	{ id: "2", name: "Bob", email: "bob@example.com", status: "disabled", role: "viewer", department: "Marketing", location: "Paris", createdAt: "2024-09-14", score: 67 },
	{ id: "3", name: "Carol", email: "carol@example.com", status: "active", role: "editor", department: "Engineering", location: "NYC", createdAt: "2024-08-22", score: 88 },
	{ id: "4", name: "Dan", email: "dan@example.com", status: "active", role: "viewer", department: "Support", location: "Remote", createdAt: "2024-07-05", score: 73 },
	{ id: "5", name: "Eve", email: "eve@example.com", status: "disabled", role: "editor", department: "Sales", location: "London", createdAt: "2024-06-11", score: 81 },
]

export function DataTableDemo() {
    const [rowSelection, setRowSelection] = React.useState({})
    const lastIndexRef = React.useRef<number | null>(null)
    const shiftRef = React.useRef(false)

	const columns = useMemo<ColumnDef<Item>[]>(
		() => [
            {
                id: "select",
                header: ({ table }) => (
                    <Checkbox
                        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
                        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                        aria-label="Select all"
                    />
                ),
				cell: ({ row, table }) => (
                    <Checkbox
                        checked={row.getIsSelected()}
                        onPointerDown={(e) => {
                            // capture Shift pressed state before Radix toggles
                            shiftRef.current = e.shiftKey
                        }}
                        onCheckedChange={(value) => {
							const rows = table.getRowModel().rows
                            const idx = rows.findIndex((r) => r.id === row.id)
                            if (shiftRef.current && lastIndexRef.current !== null && idx !== -1) {
                                const [a, b] = [lastIndexRef.current, idx].sort((x, y) => x - y)
								const next = { ...(table.getState().rowSelection as Record<string, boolean>) }
                                const shouldSelect = !!value
                                for (let k = a; k <= b; k++) {
                                    const id = rows[k].id
                                    if (shouldSelect) next[id] = true
                                    else delete next[id]
                                }
								table.setRowSelection(next)
                            } else {
                                row.toggleSelected(!!value)
                            }
                            lastIndexRef.current = idx
                        }}
                        aria-label={`Select ${row.id}`}
                    />
                ),
                enableSorting: false,
                enableHiding: false,
            },
			{ accessorKey: "name", header: "Name" },
			{ accessorKey: "email", header: "Email" },
			{ accessorKey: "status", header: "Status" },
			{ accessorKey: "role", header: "Role" },
			{ accessorKey: "department", header: "Department" },
			{ accessorKey: "location", header: "Location" },
			{ accessorKey: "createdAt", header: "Created" },
			{ accessorKey: "score", header: "Score" },
		],
        [],
	)

	const table = useReactTable({
        data: sample,
        columns,
        getCoreRowModel: getCoreRowModel(),
        enableRowSelection: true,
        onRowSelectionChange: setRowSelection,
        state: { rowSelection },
    })

	return (
		<div className="overflow-x-auto">
			<div className="inline-block min-w-max rounded-md border overflow-hidden">
				<Table className="w-full">
				<TableHeader>
					{table.getHeaderGroups().map((hg) => (
						<TableRow key={hg.id}>
							{hg.headers.map((h) => (
								<TableHead key={h.id}>
									{h.isPlaceholder
										? null
										: flexRender(h.column.columnDef.header, h.getContext())}
								</TableHead>
							))}
						</TableRow>
					))}
				</TableHeader>
				<TableBody>
					{table.getRowModel().rows.map((r) => (
						<TableRow key={r.id}>
						{r.getVisibleCells().map((c) => (
							<TableCell key={c.id}>
								{flexRender(c.column.columnDef.cell, c.getContext())}
							</TableCell>
						))}
						</TableRow>
					))}
				</TableBody>
				</Table>
			</div>
            <div className="px-2 py-1 text-sm text-muted-foreground">
                {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s) selected.
            </div>
		</div>
	)
}


