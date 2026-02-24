'use client'

import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { useFavorites } from '@/hooks/use-favorites'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FavoriteButtonProps {
  tournamentId: string
  className?: string
}

export function FavoriteButton({ tournamentId, className }: FavoriteButtonProps) {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const { isFavorited, toggleFavorite, loading: favLoading } = useFavorites()

  const favorited = isFavorited(tournamentId)

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (!user) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`)
      return
    }

    await toggleFavorite(tournamentId)
  }

  if (userLoading || (user && favLoading)) {
    return null
  }

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'size-8 shrink-0 rounded-full transition-colors',
            favorited
              ? 'text-red-500 bg-red-500/10 hover:bg-red-500/20'
              : 'text-muted-foreground hover:text-red-500 hover:bg-red-500/10',
            className,
          )}
          onClick={handleClick}
        >
          <Heart className={cn('size-4', favorited && 'fill-current')} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={4}>
        {!user
          ? 'Sign in to favorite'
          : favorited
            ? 'Remove from favorites'
            : 'Add to favorites'}
      </TooltipContent>
    </Tooltip>
  )
}
