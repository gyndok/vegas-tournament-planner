'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { TournamentResult } from '@/types'

interface LogResultDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tournamentName: string
  buyIn: number
  existingResult?: TournamentResult | null
  onSave: (data: { result_amount: number; finish_position?: number | null; notes?: string | null }) => Promise<void>
  onDelete?: () => Promise<void>
}

export function LogResultDialog({
  open,
  onOpenChange,
  tournamentName,
  buyIn,
  existingResult,
  onSave,
  onDelete,
}: LogResultDialogProps) {
  const [resultAmount, setResultAmount] = useState('')
  const [finishPosition, setFinishPosition] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (open) {
      if (existingResult) {
        setResultAmount(String(existingResult.result_amount))
        setFinishPosition(existingResult.finish_position ? String(existingResult.finish_position) : '')
        setNotes(existingResult.notes || '')
      } else {
        setResultAmount('')
        setFinishPosition('')
        setNotes('')
      }
    }
  }, [open, existingResult])

  const profit = resultAmount ? parseInt(resultAmount, 10) - buyIn : null

  async function handleSave() {
    if (!resultAmount) return
    setSaving(true)
    try {
      await onSave({
        result_amount: parseInt(resultAmount, 10),
        finish_position: finishPosition ? parseInt(finishPosition, 10) : null,
        notes: notes || null,
      })
      onOpenChange(false)
    } catch {
      // Error handled by parent
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!onDelete) return
    setDeleting(true)
    try {
      await onDelete()
      onOpenChange(false)
    } catch {
      // Error handled by parent
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existingResult ? 'Edit Result' : 'Log Result'}</DialogTitle>
          <p className="text-sm text-muted-foreground truncate">{tournamentName}</p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="resultAmount">Cash Out Amount ($) *</Label>
            <Input
              id="resultAmount"
              type="number"
              value={resultAmount}
              onChange={(e) => setResultAmount(e.target.value)}
              placeholder={`0 if busted (buy-in was $${buyIn})`}
              min="0"
              required
            />
            {profit !== null && !isNaN(profit) && (
              <p className={`text-xs font-medium ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {profit >= 0 ? '+' : ''}{profit.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} net
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="finishPosition">Finish Position</Label>
            <Input
              id="finishPosition"
              type="number"
              value={finishPosition}
              onChange={(e) => setFinishPosition(e.target.value)}
              placeholder="Optional (e.g. 3)"
              min="1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="resultNotes">Notes</Label>
            <Textarea
              id="resultNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {existingResult && onDelete && (
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting} className="sm:mr-auto">
              {deleting ? 'Deleting...' : 'Delete Result'}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !resultAmount}>
            {saving ? 'Saving...' : existingResult ? 'Update' : 'Save Result'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
