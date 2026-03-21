import { useEffect, useRef, useState } from 'react'
import type { StudioMessage, StudioSession } from '../protocol/studio-agent-types'
import { formatStudioTime } from '../theme'

interface StudioCommandPanelProps {
  session: StudioSession | null
  messages: StudioMessage[]
  disabled: boolean
  onRun: (inputText: string) => Promise<void> | void
  onExit: () => void
}

export function StudioCommandPanel({
  session,
  messages,
  disabled,
  onRun,
  onExit,
}: StudioCommandPanelProps) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleSubmit = async () => {
    const next = input.trim()
    if (!next || disabled) {
      return
    }
    setInput('')
    await onRun(next)
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  return (
    <section className="studio-terminal flex min-w-0 flex-1 flex-col bg-bg-primary/30 shadow-[inset_0_0_40px_rgba(0,0,0,0.02)]">
      <header className="flex items-center justify-between gap-4 border-b border-border/10 px-8 py-3">
        <div className="font-mono text-xs text-text-secondary/50">
          {session?.directory ?? '...'}
        </div>
        <button
          type="button"
          onClick={onExit}
          className="px-4 py-2 text-xs text-text-secondary/50 transition hover:text-rose-500/75"
        >
          退出
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-6 scrollbar-hide">
        {messages.length === 0 && (
          <div className="text-sm text-text-secondary/40">
            等待指令...<span className="studio-cursor">█</span>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {messages.map((message) => {
            const isUser = message.role === 'user'

            if (isUser) {
              return (
                <div key={message.id} className="py-1">
                  <span className="text-text-primary/80">
                    <span className="font-mono text-text-secondary/45">$ </span>
                    {message.text}
                  </span>
                  <span className="ml-3 text-[11px] text-text-secondary/35">{formatStudioTime(message.createdAt)}</span>
                </div>
              )
            }

            const parts = message.role === 'assistant' ? message.parts : []
            return (
              <div key={message.id} className="py-1">
                {parts.map((part, i) => {
                  if (part.type === 'tool') {
                    const status = part.state.status === 'error' ? '✗' : part.state.status === 'completed' ? '✓' : '…'
                    const args = 'input' in part.state ? truncateArgs(part.state.input) : ''
                    return (
                      <div key={i} className="font-mono text-[13px] text-text-secondary/40">
                        {'  → '}{part.tool}({args}) {status}
                      </div>
                    )
                  }

                  if (part.type === 'text' || part.type === 'reasoning') {
                    const text = part.text.trim()
                    if (!text) return null
                    return (
                      <div key={i} className="font-mono text-[13px] leading-7 text-text-secondary/70">
                        {text.split('\n').map((line, j) => (
                          <div key={j}>
                            <span className="text-text-secondary/35">{'> '}</span>{line}
                          </div>
                        ))}
                      </div>
                    )
                  }

                  return null
                })}

                {parts.filter((p) => p.type === 'text' || p.type === 'reasoning').every((p) => !p.text.trim()) && (
                  <div className="font-mono text-[13px] text-text-secondary/35">{'> '}(无文本输出)</div>
                )}

                <span className="text-[11px] text-text-secondary/35">{formatStudioTime(message.createdAt)}</span>
              </div>
            )
          })}

          {messages.length > 0 && disabled && (
            <div className="py-1 text-text-secondary/50">
              <span className="studio-cursor">█</span>
            </div>
          )}
        </div>
      </div>

      <footer className="border-t border-border/10 px-8 py-5">
        <div className="flex items-center">
          <span className="mr-2 font-mono text-sm text-text-secondary/40">$</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleSubmit()
              }
            }}
            placeholder={disabled ? '初始化中...' : '输入指令...'}
            disabled={disabled}
            className="flex-1 bg-transparent font-mono text-sm text-text-primary outline-none placeholder:text-text-secondary/30 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <div className="mt-3 text-[11px] text-text-secondary/35">Enter 发送</div>
      </footer>
    </section>
  )
}

function truncateArgs(input?: Record<string, unknown>) {
  if (!input) return ''
  const str = JSON.stringify(input)
  return str.length > 60 ? `${str.slice(0, 57)}...` : str
}
