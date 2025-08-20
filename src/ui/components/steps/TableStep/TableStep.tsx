import * as React from 'react'
import type { RowData } from '@/ui/types'
import { AnalyzeToggle } from './AnalyzeToggle'
import { DataTable } from './DataTable'
import { Tabs, TabsList, TabsTrigger } from '../../ui/tabs'
import { Button } from '../../ui/button'
import { ScrollArea } from '../../ui/scroll-area'

type Props = {
  headers: Array<{ key: string; label: string }>
  rows: RowData[]
  sheets: Array<{ id: number; title: string }>
  selectedTabs: Set<string>
  activeSheet: string
  onBack: () => void
  onChangeTab: (title: string) => void
  onSelectionChange: (rows: RowData[]) => void
  onSync: () => void
  onNext: () => void
  analyzeMode: boolean
  setAnalyzeMode: (v: boolean) => void
  tabAnalyzeSelection: Record<string, Record<string, boolean>>
  setTabAnalyzeSelection: React.Dispatch<React.SetStateAction<Record<string, Record<string, boolean>>>>
  tabRowSelection: Record<string, Record<string, boolean>>
  setTabRowSelection: React.Dispatch<React.SetStateAction<Record<string, Record<string, boolean>>>>
}

export function TableStep(props: Props) {
  const { headers, rows, sheets, selectedTabs, activeSheet, onBack, onChangeTab, onSelectionChange, onSync, onNext, analyzeMode, setAnalyzeMode, tabAnalyzeSelection, setTabAnalyzeSelection, tabRowSelection, setTabRowSelection } = props
  const currentSheetKey = activeSheet
  const totalSelected = Object.values(tabRowSelection).reduce((acc, m) => acc + Object.keys(m || {}).length, 0)
  return (
    <div className="px-2 h-full flex flex-col min-h-0">
      <ScrollArea>
        <div className="min-w-max">
          <div className="flex items-center justify-between mb-1">
            <Button size="sm" variant="outline" onClick={onBack}>Back</Button>
            <AnalyzeToggle pressed={analyzeMode} onPressedChange={setAnalyzeMode} />
          </div>
          <Tabs value={activeSheet} onValueChange={(v)=> onChangeTab(v)}>
            <TabsList className="p-0">
              {sheets.filter(s => selectedTabs.has(s.title)).map(s => (
                <TabsTrigger key={s.id} value={s.title} className="mx-0.5">{s.title}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </ScrollArea>
      <div className="flex-1 min-h-0">
        <DataTable
          headers={headers}
          rows={rows}
          analyzeMode={analyzeMode}
          currentSheetKey={currentSheetKey}
          tabAnalyzeSelection={tabAnalyzeSelection}
          setTabAnalyzeSelection={setTabAnalyzeSelection}
          tabRowSelection={tabRowSelection}
          setTabRowSelection={setTabRowSelection}
          onRowSelectionChange={onSelectionChange}
        />
      </div>
      <div className="px-2 py-1 text-sm text-muted-foreground shrink-0 flex items-center justify-between">
        <div>{totalSelected} row(s) marked for sync.</div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onSync} disabled={totalSelected === 0}>Sync</Button>
          <Button size="sm" onClick={onNext} disabled={totalSelected === 0}>Next</Button>
        </div>
      </div>
    </div>
  )
}


