'use client'

import { useTournamentFilters } from '@/hooks/use-tournament-filters'
import { SERIES_COLORS } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SlidersHorizontal, X } from 'lucide-react'
import { useState } from 'react'

const GAME_TYPES = ['NLH', 'PLO', 'PLO8', 'Mixed', 'Stud', 'Razz', 'Limit Hold\'em', 'Big O', 'Badugi']
const FORMATS = ['Re-entry', 'Freezeout', 'Deepstack', 'Mystery Bounty', 'Bounty', 'Turbo']

function formatDateParam(date: Date): string {
  return date.toISOString().split('T')[0]
}

function FilterSections() {
  const { filters, setFilter, removeFilters, resetFilters, filterCount } = useTournamentFilters()

  const handleDateQuickPick = (type: 'today' | 'tomorrow' | 'week') => {
    const today = new Date()
    const from = new Date(today)
    const to = new Date(today)

    if (type === 'tomorrow') {
      from.setDate(from.getDate() + 1)
      to.setDate(to.getDate() + 1)
    } else if (type === 'week') {
      to.setDate(to.getDate() + 7)
    }

    setFilter('dateFrom', formatDateParam(from))
    // Small delay to avoid race condition with URL params
    setTimeout(() => setFilter('dateTo', formatDateParam(to)), 0)
  }

  const handleBuyInPreset = (max: number | null) => {
    if (max === null) {
      setFilter('buyInMin', null)
      setTimeout(() => setFilter('buyInMax', null), 0)
    } else {
      setFilter('buyInMin', '0')
      setTimeout(() => setFilter('buyInMax', String(max)), 0)
    }
  }

  const toggleGameType = (gameType: string) => {
    const current = filters.gameTypes || []
    const next = current.includes(gameType)
      ? current.filter(g => g !== gameType)
      : [...current, gameType]
    setFilter('gameType', next.length > 0 ? next : null)
  }

  const toggleFormat = (format: string) => {
    const current = filters.formats || []
    const next = current.includes(format)
      ? current.filter(f => f !== format)
      : [...current, format]
    setFilter('format', next.length > 0 ? next : null)
  }

  const toggleEventCategory = (category: 'bracelet' | 'side') => {
    const current = filters.eventCategories || []
    const next = current.includes(category)
      ? current.filter(c => c !== category)
      : [...current, category]
    setFilter('eventCategory', next.length > 0 ? next : null)
  }

  const toggleNumericMin = (paramKey: string, currentValue: number | undefined, value: number) => {
    const next = currentValue === value ? null : String(value)
    setFilter(paramKey, next)
  }

  const CASINO_KEYS = Object.keys(SERIES_COLORS).filter(k => k !== 'default')

  const toggleCasino = (casino: string) => {
    const current = filters.casinos || []
    const next = current.includes(casino)
      ? current.filter(c => c !== casino)
      : [...current, casino]
    setFilter('casino', next.length > 0 ? next : null)
  }

  const handleSortChange = (value: string) => {
    setFilter('sortBy', value === 'date' ? null : value)
  }

  return (
    <div className="space-y-6">
      {/* Clear All */}
      {filterCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={resetFilters}
          className="text-muted-foreground hover:text-foreground w-full justify-start"
        >
          <X className="size-4 mr-1" />
          Clear all filters ({filterCount})
        </Button>
      )}

      {/* Casino */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground">Casino</h4>
        <div className="flex flex-wrap gap-1.5">
          {CASINO_KEYS.map((casino) => {
            const colors = SERIES_COLORS[casino]
            const isSelected = (filters.casinos || []).includes(casino)
            return (
              <Badge
                key={casino}
                variant="outline"
                className={`cursor-pointer text-xs select-none transition-colors ${
                  isSelected
                    ? `${colors.bg} ${colors.text} border-transparent`
                    : 'hover:bg-muted'
                }`}
                onClick={() => toggleCasino(casino)}
              >
                <span className={`inline-block size-2 rounded-full mr-1.5 ${colors.dot}`} />
                {colors.label}
              </Badge>
            )
          })}
        </div>
      </div>

      {/* Date Quick Picks */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground">Date</h4>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDateQuickPick('today')}
            className="text-xs"
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDateQuickPick('tomorrow')}
            className="text-xs"
          >
            Tomorrow
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDateQuickPick('week')}
            className="text-xs"
          >
            This Week
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">From</label>
            <Input
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => setFilter('dateFrom', e.target.value || null)}
              className="text-xs h-8"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">To</label>
            <Input
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => setFilter('dateTo', e.target.value || null)}
              className="text-xs h-8"
            />
          </div>
        </div>
      </div>

      {/* Buy-in */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground">Buy-in</h4>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filters.buyInMax === 600 ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleBuyInPreset(600)}
            className="text-xs"
          >
            Under $600
          </Button>
          <Button
            variant={filters.buyInMax === 1500 ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleBuyInPreset(1500)}
            className="text-xs"
          >
            Under $1,500
          </Button>
          <Button
            variant={filters.buyInMax === 5000 ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleBuyInPreset(5000)}
            className="text-xs"
          >
            Under $5,000
          </Button>
          <Button
            variant={filters.buyInMin === undefined && filters.buyInMax === undefined ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleBuyInPreset(null)}
            className="text-xs"
          >
            Any
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Min ($)</label>
            <Input
              type="number"
              min="0"
              placeholder="0"
              value={filters.buyInMin ?? ''}
              onChange={(e) => setFilter('buyInMin', e.target.value || null)}
              className="text-xs h-8"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Max ($)</label>
            <Input
              type="number"
              min="0"
              placeholder="Any"
              value={filters.buyInMax ?? ''}
              onChange={(e) => setFilter('buyInMax', e.target.value || null)}
              className="text-xs h-8"
            />
          </div>
        </div>
      </div>

      {/* Game Type */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground">Game Type</h4>
        <div className="flex flex-wrap gap-1.5">
          {GAME_TYPES.map((game) => (
            <Badge
              key={game}
              variant={(filters.gameTypes || []).includes(game) ? 'default' : 'outline'}
              className="cursor-pointer text-xs select-none"
              onClick={() => toggleGameType(game)}
            >
              {game}
            </Badge>
          ))}
        </div>
      </div>

      {/* Event Type (WSOP bracelet/side) */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground">Event Type</h4>
        <div className="flex flex-wrap gap-1.5">
          {(['bracelet', 'side'] as const).map((category) => {
            const isSelected = (filters.eventCategories || []).includes(category)
            return (
              <Badge
                key={category}
                variant={isSelected ? 'default' : 'outline'}
                className={`cursor-pointer text-xs select-none capitalize ${
                  isSelected && category === 'bracelet'
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                    : ''
                }`}
                onClick={() => toggleEventCategory(category)}
              >
                {category === 'bracelet' ? 'Bracelet' : 'Side Event'}
              </Badge>
            )
          })}
        </div>
      </div>

      {/* Format */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground">Format</h4>
        <div className="flex flex-wrap gap-1.5">
          {FORMATS.map((format) => (
            <Badge
              key={format}
              variant={(filters.formats || []).includes(format) ? 'default' : 'outline'}
              className="cursor-pointer text-xs select-none"
              onClick={() => toggleFormat(format)}
            >
              {format}
            </Badge>
          ))}
        </div>
      </div>

      {/* Starting Stack */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground">Starting Stack</h4>
        <div className="flex flex-wrap gap-1.5">
          {[10000, 20000, 30000, 50000].map((value) => (
            <Badge
              key={value}
              variant={filters.startingStackMin === value ? 'default' : 'outline'}
              className="cursor-pointer text-xs select-none"
              onClick={() => toggleNumericMin('startingStackMin', filters.startingStackMin, value)}
            >
              {(value / 1000).toLocaleString()}K+
            </Badge>
          ))}
        </div>
      </div>

      {/* Blind Levels */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground">Blind Levels</h4>
        <div className="flex flex-wrap gap-1.5">
          {[20, 30, 40, 60].map((value) => (
            <Badge
              key={value}
              variant={filters.blindLevelsMinutesMin === value ? 'default' : 'outline'}
              className="cursor-pointer text-xs select-none"
              onClick={() => toggleNumericMin('blindLevelsMinutesMin', filters.blindLevelsMinutesMin, value)}
            >
              {value}+ min
            </Badge>
          ))}
        </div>
      </div>

      {/* Guarantee */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground">Guarantee</h4>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.hasGuarantee || false}
            onChange={(e) => {
              if (e.target.checked) {
                setFilter('hasGuarantee', 'true')
              } else {
                removeFilters(['hasGuarantee', 'guaranteeMin', 'guaranteeMax'])
              }
            }}
            className="h-4 w-4 rounded border-gray-600 bg-transparent text-primary focus:ring-primary focus:ring-offset-0"
          />
          <span className="text-xs">Has guarantee</span>
        </label>
        {filters.hasGuarantee && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Min ($)</label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={filters.guaranteeMin ?? ''}
                onChange={(e) => setFilter('guaranteeMin', e.target.value || null)}
                className="text-xs h-8"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Max ($)</label>
              <Input
                type="number"
                min="0"
                placeholder="Any"
                value={filters.guaranteeMax ?? ''}
                onChange={(e) => setFilter('guaranteeMax', e.target.value || null)}
                className="text-xs h-8"
              />
            </div>
          </div>
        )}
      </div>

      {/* Sort */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground">Sort By</h4>
        <Select
          value={filters.sortBy || 'date'}
          onValueChange={handleSortChange}
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date/Time</SelectItem>
            <SelectItem value="buy_in_asc">Buy-in (low to high)</SelectItem>
            <SelectItem value="buy_in_desc">Buy-in (high to low)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

export function TournamentFilters() {
  const { filterCount } = useTournamentFilters()
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Desktop dropdown — replaces sidebar */}
      <div className="hidden md:block">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <SlidersHorizontal className="size-4" />
              Filters
              {filterCount > 0 && (
                <span className="ml-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-black">
                  {filterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-0">
            <ScrollArea className="h-[80vh]">
              <div className="p-4">
                <FilterSections />
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>

      {/* Mobile filter button + sheet */}
      <div className="md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <SlidersHorizontal className="size-4" />
              Filters
              {filterCount > 0 && (
                <span className="ml-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-black">
                  {filterCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[320px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>Narrow down tournaments</SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-8">
              <FilterSections />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
