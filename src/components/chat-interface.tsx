'use client'

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react'
import { useChat } from '@/hooks/use-chat'
import { ChatMessageBubble } from '@/components/chat-message'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, MessageSquare, Loader2, Trash2 } from 'lucide-react'

const SUGGESTED_PROMPTS = [
  'Plan my day -- NLH and PLO, under $1,500',
  "What's running this Saturday?",
  'Best deepstack events this week?',
  'Compare the $600 PLO events',
]

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
        <Loader2 className="h-4 w-4 text-primary animate-spin" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-card border border-border px-4 py-3">
        <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
        <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
        <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  )
}

export function ChatInterface() {
  const { messages, isLoading, error, sendMessage, clearMessages } = useChat()
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-slot="scroll-area-viewport"]')
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight
      }
    }
  }, [messages, isLoading])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'
    }
  }, [input])

  const handleSend = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return
    setInput('')
    sendMessage(trimmed)
  }, [input, isLoading, sendMessage])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handlePromptClick = (prompt: string) => {
    if (isLoading) return
    sendMessage(prompt)
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 md:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
            <MessageSquare className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-semibold">AI Tournament Planner</h1>
            <p className="text-[10px] text-muted-foreground">Powered by Claude</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearMessages}
            className="text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Clear</span>
          </Button>
        )}
      </div>

      {/* Messages area */}
      <ScrollArea ref={scrollRef} className="flex-1 overflow-hidden">
        <div className="px-4 py-4 md:px-6">
          {isEmpty ? (
            // Empty state
            <div className="flex h-full min-h-[50vh] flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-6">
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Plan Your Tournament Trip</h2>
              <p className="text-sm text-muted-foreground max-w-md mb-8">
                Ask me about tournaments, schedules, buy-ins, or anything about poker
                festivals in Las Vegas. I can search the database and help you plan.
              </p>
              <div className="grid gap-2 w-full max-w-lg">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handlePromptClick(prompt)}
                    disabled={isLoading}
                    className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm transition-colors hover:bg-accent disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // Message list
            <div className="space-y-6 max-w-3xl mx-auto">
              {messages.map((message) => (
                <ChatMessageBubble key={message.id} message={message} />
              ))}
              {isLoading && <TypingIndicator />}
              {error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t border-border px-4 py-3 md:px-6">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about tournaments..."
              disabled={isLoading}
              rows={1}
              className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 pr-12 text-sm placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-[46px] w-[46px] shrink-0 rounded-xl bg-primary hover:bg-primary/90 text-white"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          Shift + Enter for new line. Schedules may change without notice — always confirm with the venue.
        </p>
      </div>
    </div>
  )
}
