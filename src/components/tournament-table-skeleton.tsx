export function TournamentTableSkeleton() {
  return (
    <div className="acr-lobby rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm bg-card">
        <thead>
          <tr
            className="text-xs text-muted-foreground uppercase tracking-wider"
            style={{ backgroundColor: 'var(--acr-header-bg)' }}
          >
            <th className="px-3 py-2 text-left font-medium">Start</th>
            <th className="px-3 py-2 text-left font-medium">Date</th>
            <th className="px-3 py-2 text-left font-medium">Tournament Name</th>
            <th className="px-3 py-2 text-right font-medium">Buy-In</th>
            <th className="px-3 py-2 text-center font-medium">Game</th>
            <th className="px-3 py-2 text-center font-medium">Format</th>
            <th className="px-3 py-2 text-right font-medium">GTD</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 12 }).map((_, i) => (
            <tr key={i} className="border-b border-border">
              <td className="px-3 py-1.5"><div className="h-3 w-16 rounded bg-muted animate-pulse" /></td>
              <td className="px-3 py-1.5"><div className="h-3 w-14 rounded bg-muted animate-pulse" /></td>
              <td className="px-3 py-1.5"><div className="h-3 w-64 rounded bg-muted animate-pulse" /></td>
              <td className="px-3 py-1.5"><div className="h-3 w-12 rounded bg-muted animate-pulse ml-auto" /></td>
              <td className="px-3 py-1.5"><div className="h-3 w-10 rounded bg-muted animate-pulse mx-auto" /></td>
              <td className="px-3 py-1.5"><div className="h-3 w-16 rounded bg-muted animate-pulse mx-auto" /></td>
              <td className="px-3 py-1.5"><div className="h-3 w-14 rounded bg-muted animate-pulse ml-auto" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
