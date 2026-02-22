'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Series } from '@/types'
import { Upload, ChevronDown, ChevronUp, Eye, Loader2, AlertTriangle, CheckCircle } from 'lucide-react'

const SAMPLE_JSON = `[
  {
    "event_number": 1,
    "name": "Event Name",
    "date": "2026-06-01",
    "day_of_week": "Monday",
    "start_time": "10:00:00",
    "buy_in": 1500,
    "game_type": "NLH",
    "format": "Re-entry",
    "table_size": 9,
    "is_flight": false
  }
]`

const SAMPLE_CSV = `event_number,name,date,day_of_week,start_time,buy_in,game_type,format,table_size,is_flight
1,Event Name,2026-06-01,Monday,10:00:00,1500,NLH,Re-entry,9,false`

interface PreviewRow {
  [key: string]: unknown
}

interface ImportResult {
  inserted: number
  skipped: number
  errors: string[]
  series_id?: string
  error?: string
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }
  }
  result.push(current)
  return result
}

function parseCSVData(raw: string): PreviewRow[] {
  const lines = raw.split('\n').filter((line) => line.trim() !== '')
  if (lines.length < 2) return []

  const headers = parseCSVLine(lines[0])
  const rows: PreviewRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row: PreviewRow = {}
    headers.forEach((header, idx) => {
      row[header.trim()] = (values[idx] || '').trim()
    })
    rows.push(row)
  }
  return rows
}

export default function AdminImportPage() {
  const [seriesList, setSeriesList] = useState<Series[]>([])
  const [selectedSeries, setSelectedSeries] = useState<string>('new')
  const [format, setFormat] = useState<'json' | 'csv'>('json')
  const [data, setData] = useState('')
  const [showSample, setShowSample] = useState(false)
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  // New series form
  const [newSeriesName, setNewSeriesName] = useState('')
  const [newSeriesVenue, setNewSeriesVenue] = useState('')
  const [newSeriesStartDate, setNewSeriesStartDate] = useState('')
  const [newSeriesEndDate, setNewSeriesEndDate] = useState('')
  const [newSeriesWebsite, setNewSeriesWebsite] = useState('')

  const fetchSeries = useCallback(async () => {
    const supabase = createClient()
    const { data: series } = await supabase
      .from('series')
      .select('*')
      .order('start_date', { ascending: false })
    if (series) setSeriesList(series)
  }, [])

  useEffect(() => {
    fetchSeries()
  }, [fetchSeries])

  function handlePreview() {
    setPreviewError(null)
    setPreview(null)

    if (!data.trim()) {
      setPreviewError('Please paste some data first.')
      return
    }

    try {
      let rows: PreviewRow[]
      if (format === 'json') {
        rows = JSON.parse(data)
        if (!Array.isArray(rows)) {
          setPreviewError('JSON data must be an array of objects.')
          return
        }
      } else {
        rows = parseCSVData(data)
      }

      if (rows.length === 0) {
        setPreviewError('No data rows found.')
        return
      }

      setPreview(rows.slice(0, 10))
    } catch (err) {
      setPreviewError(`Parse error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  async function handleImport() {
    setResult(null)
    setImporting(true)

    try {
      const body: Record<string, unknown> = { format, data }

      if (selectedSeries === 'new') {
        if (!newSeriesName || !newSeriesVenue || !newSeriesStartDate || !newSeriesEndDate) {
          setResult({
            inserted: 0,
            skipped: 0,
            errors: ['New series requires name, venue, start date, and end date.'],
          })
          setImporting(false)
          return
        }
        body.new_series = {
          name: newSeriesName,
          venue: newSeriesVenue,
          start_date: newSeriesStartDate,
          end_date: newSeriesEndDate,
          website_url: newSeriesWebsite || undefined,
        }
      } else {
        body.series_id = selectedSeries
      }

      const res = await fetch('/api/admin/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const json = await res.json()
      setResult(json)
    } catch {
      setResult({ inserted: 0, skipped: 0, errors: ['Network error. Please try again.'] })
    } finally {
      setImporting(false)
    }
  }

  const previewHeaders = preview && preview.length > 0 ? Object.keys(preview[0]) : []

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Warning banner */}
      <div className="mb-6 flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
        <AlertTriangle className="size-5 text-yellow-500 shrink-0" />
        <span className="text-sm text-yellow-200">Admin area &mdash; data import tool</span>
      </div>

      <h1 className="text-2xl font-bold mb-8">Import Tournament Data</h1>

      {/* Series Selection */}
      <section className="mb-8">
        <Label className="text-sm font-medium mb-2 block">Series</Label>
        <select
          value={selectedSeries}
          onChange={(e) => setSelectedSeries(e.target.value)}
          className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-green-500/40"
        >
          <option value="new">+ Create New Series</option>
          {seriesList.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.venue})
            </option>
          ))}
        </select>

        {/* New Series Form */}
        {selectedSeries === 'new' && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border border-[#2a2a2a] bg-[#111] p-4">
            <div>
              <Label htmlFor="series-name" className="text-xs text-muted-foreground">Name *</Label>
              <Input
                id="series-name"
                placeholder="e.g. WSOP 2026"
                value={newSeriesName}
                onChange={(e) => setNewSeriesName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="series-venue" className="text-xs text-muted-foreground">Venue *</Label>
              <Input
                id="series-venue"
                placeholder="e.g. Paris Las Vegas"
                value={newSeriesVenue}
                onChange={(e) => setNewSeriesVenue(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="series-start" className="text-xs text-muted-foreground">Start Date *</Label>
              <Input
                id="series-start"
                type="date"
                value={newSeriesStartDate}
                onChange={(e) => setNewSeriesStartDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="series-end" className="text-xs text-muted-foreground">End Date *</Label>
              <Input
                id="series-end"
                type="date"
                value={newSeriesEndDate}
                onChange={(e) => setNewSeriesEndDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="series-website" className="text-xs text-muted-foreground">Website URL (optional)</Label>
              <Input
                id="series-website"
                type="url"
                placeholder="https://..."
                value={newSeriesWebsite}
                onChange={(e) => setNewSeriesWebsite(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        )}
      </section>

      {/* Format Toggle */}
      <section className="mb-6">
        <Label className="text-sm font-medium mb-2 block">Format</Label>
        <div className="flex gap-2">
          <Button
            variant={format === 'json' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFormat('json')}
            className={format === 'json' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
          >
            JSON
          </Button>
          <Button
            variant={format === 'csv' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFormat('csv')}
            className={format === 'csv' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
          >
            CSV
          </Button>
        </div>
      </section>

      {/* Sample Format Hint */}
      <section className="mb-6">
        <button
          onClick={() => setShowSample(!showSample)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {showSample ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          Show example {format.toUpperCase()} format
        </button>
        {showSample && (
          <pre className="mt-3 overflow-x-auto rounded-lg border border-[#2a2a2a] bg-[#111] p-4 text-xs text-muted-foreground font-mono">
            {format === 'json' ? SAMPLE_JSON : SAMPLE_CSV}
          </pre>
        )}
      </section>

      {/* Data Textarea */}
      <section className="mb-6">
        <Label htmlFor="import-data" className="text-sm font-medium mb-2 block">
          Paste Data
        </Label>
        <textarea
          id="import-data"
          value={data}
          onChange={(e) => {
            setData(e.target.value)
            setPreview(null)
            setPreviewError(null)
            setResult(null)
          }}
          placeholder={`Paste your ${format.toUpperCase()} data here...`}
          className="w-full h-64 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-green-500/40 resize-y"
        />
      </section>

      {/* Action Buttons */}
      <div className="flex gap-3 mb-8">
        <Button variant="outline" onClick={handlePreview} className="gap-2">
          <Eye className="size-4" />
          Preview
        </Button>
        <Button
          onClick={handleImport}
          disabled={importing || !data.trim()}
          className="gap-2 bg-green-600 hover:bg-green-700 text-white"
        >
          {importing ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Upload className="size-4" />
              Import
            </>
          )}
        </Button>
      </div>

      {/* Preview Error */}
      {previewError && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {previewError}
        </div>
      )}

      {/* Preview Table */}
      {preview && preview.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">
            Preview ({preview.length} of {data ? '...' : '0'} rows)
          </h2>
          <div className="overflow-x-auto rounded-lg border border-[#2a2a2a]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a] bg-[#111]">
                  {previewHeaders.map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-b border-[#2a2a2a] last:border-0">
                    {previewHeaders.map((h) => (
                      <td key={h} className="px-3 py-2 whitespace-nowrap text-foreground">
                        {String(row[h] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Import Result */}
      {result && (
        <section className="mb-8">
          {result.error && !result.inserted && result.inserted !== 0 ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {result.error}
            </div>
          ) : (
            <div className="rounded-lg border border-[#2a2a2a] bg-[#111] p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="size-5 text-green-500" />
                <span className="font-semibold">Import Complete</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Inserted:</span>{' '}
                  <span className="font-semibold text-green-400">{result.inserted}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Skipped:</span>{' '}
                  <span className="font-semibold text-yellow-400">{result.skipped}</span>
                </div>
              </div>
              {result.errors && result.errors.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-red-400 mb-1">Errors:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs text-red-300">
                    {result.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
