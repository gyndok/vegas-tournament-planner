export default function ChatLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading chat...</div>
    </div>
  )
}
