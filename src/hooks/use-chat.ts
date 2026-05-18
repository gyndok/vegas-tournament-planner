'use client'

import { useState, useCallback } from 'react'
import { ChatMessage, Tournament } from '@/types'

const MAX_HISTORY_MESSAGES = 10 // Match server-side limit

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = useCallback(async (content: string) => {
    // Client-side input length check (matches server limit)
    if (content.length > 1000) {
      setError('Please keep your message under 1,000 characters.')
      return
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)
    setError(null)

    try {
      // Build message history for API — trim to last N messages to control costs
      const allMessages = [...messages, userMessage]
      const trimmedMessages = allMessages.slice(-MAX_HISTORY_MESSAGES)
      const apiMessages = trimmedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      })

      const data = await res.json()

      // Handle rate limit (per-IP) and daily cost cap (site-wide) the same
      // way: show the server's message as a banner, and pull the user's
      // optimistically-added message back out so it doesn't sit unanswered.
      if (res.status === 429 || res.status === 503) {
        setError(data.content || 'The AI Advisor is unavailable right now. Please try again later.')
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id))
        return
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.content || 'No response received.',
        tournaments: data.tournaments?.length > 0 ? (data.tournaments as Tournament[]) : undefined,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch {
      setError('Failed to send message. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [messages])

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return { messages, isLoading, error, sendMessage, clearMessages }
}
