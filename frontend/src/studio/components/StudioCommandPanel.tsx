import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../i18n'
import type { StudioMessage, StudioSession } from '../protocol/studio-agent-types'
import { StudioCommandComposer } from './command-panel/StudioCommandComposer'
import { StudioCommandViewport } from './command-panel/StudioCommandViewport'
import {
  createStudioCommandPanelStore,
  type StudioCommandPanelSnapshot,
} from './command-panel/store'
import { useStudioCommandComposer } from './command-panel/use-studio-command-composer'

interface StudioCommandPanelProps {
  session: StudioSession | null
  messages: StudioMessage[]
  latestAssistantText: string
  isBusy: boolean
  disabled: boolean
  onRun: (inputText: string) => Promise<void> | void
  onExit: () => void
  variant?: 'default' | 't-layout-bottom' | 'pure-minimal-bottom'
  inputPlaceholderOverride?: string
  onEscapePress?: () => void
}

export interface StudioCommandPanelHandle {
  appendPreviewAttachment: (attachment: { url: string; name: string; mimeType?: string }) => void
  focusComposer: () => void
}

export const StudioCommandPanel = forwardRef<StudioCommandPanelHandle, StudioCommandPanelProps>(function StudioCommandPanel({
  session,
  messages,
  latestAssistantText,
  isBusy,
  disabled,
  onRun,
  onExit,
  variant = 'default',
  inputPlaceholderOverride,
  onEscapePress,
}, ref) {
  const { t } = useI18n()
  const isTLayout = variant === 't-layout-bottom'
  const isMinimal = variant === 'pure-minimal-bottom'
  const isFrameless = isTLayout || isMinimal
  const [animatedAssistantText, setAnimatedAssistantText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const streamRateRef = useRef(0)
  const latestTextMetaRef = useRef<{ text: string; at: number }>({ text: '', at: 0 })
  const lastScrollSignatureRef = useRef('')

  const snapshot = useMemo<StudioCommandPanelSnapshot>(() => ({
    messages,
    isBusy,
    latestAssistantText,
    animatedAssistantText,
  }), [animatedAssistantText, isBusy, latestAssistantText, messages])
  const storeRef = useRef(createStudioCommandPanelStore(snapshot))
  const commandStore = storeRef.current
  const composer = useStudioCommandComposer({
    session,
    disabled,
    onRun,
    composerRef: ref,
  })

  const lastMessage = messages.at(-1) ?? null

  useLayoutEffect(() => {
    commandStore.setSnapshot(snapshot)
  }, [commandStore, snapshot])

  useEffect(() => {
    const signature = [
      messages.length,
      lastMessage?.id ?? '',
      isBusy ? 'busy' : 'idle',
    ].join(':')

    if (signature === lastScrollSignatureRef.current) {
      return
    }

    lastScrollSignatureRef.current = signature
    if (typeof endRef.current?.scrollIntoView === 'function') {
      endRef.current.scrollIntoView({ block: 'end', behavior: 'smooth' })
    }
  }, [isBusy, lastMessage?.id, messages.length])

  useEffect(() => {
    composer.focusInput()
  }, [composer, disabled, session?.id])

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      if (event.key === 'Escape' && onEscapePress) {
        event.preventDefault()
        onEscapePress()
        return
      }

      if (disabled) {
        return
      }

      const target = event.target as HTMLElement | null
      if (
        target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target?.isContentEditable
      ) {
        return
      }

      if (!shouldRedirectKeyToInput(event)) {
        return
      }

      composer.focusInput()
      if (event.key === 'Backspace') {
        composer.handleInputChange(composer.input.slice(0, -1))
        event.preventDefault()
        return
      }

      if (event.key.length === 1) {
        composer.handleInputChange(`${composer.input}${event.key}`)
        event.preventDefault()
      }
    }

    window.addEventListener('keydown', handleWindowKeyDown)
    return () => window.removeEventListener('keydown', handleWindowKeyDown)
  }, [composer, disabled, onEscapePress])

  useEffect(() => {
    if (!latestAssistantText) {
      streamRateRef.current = 0
      latestTextMetaRef.current = { text: '', at: 0 }
      const frame = window.requestAnimationFrame(() => {
        setAnimatedAssistantText('')
      })
      return () => window.cancelAnimationFrame(frame)
    }

    const now = Date.now()
    const prev = latestTextMetaRef.current
    if (prev.text && latestAssistantText.startsWith(prev.text) && latestAssistantText.length > prev.text.length) {
      const deltaChars = latestAssistantText.length - prev.text.length
      const deltaMs = Math.max(1, now - prev.at)
      const charsPerSecond = (deltaChars * 1000) / deltaMs
      streamRateRef.current = streamRateRef.current === 0
        ? charsPerSecond
        : streamRateRef.current * 0.68 + charsPerSecond * 0.32
    } else if (!prev.text) {
      streamRateRef.current = 0
    }
    latestTextMetaRef.current = { text: latestAssistantText, at: now }

    const frame = window.requestAnimationFrame(() => {
      setAnimatedAssistantText((current) => {
        if (!latestAssistantText.startsWith(current)) {
          return latestAssistantText.slice(0, 1)
        }
        return current || latestAssistantText.slice(0, 1)
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [latestAssistantText])

  useEffect(() => {
    if (!latestAssistantText) {
      return
    }

    if (animatedAssistantText === latestAssistantText) {
      return
    }

    const timer = window.setTimeout(() => {
      setAnimatedAssistantText((current) => {
        if (!latestAssistantText.startsWith(current)) {
          return latestAssistantText.slice(0, 1)
        }

        const nextLength = current.length + nextTypeStep(latestAssistantText.length - current.length)
        return latestAssistantText.slice(0, nextLength)
      })
    }, nextTypeDelay(latestAssistantText, animatedAssistantText.length, streamRateRef.current))

    return () => window.clearTimeout(timer)
  }, [animatedAssistantText, latestAssistantText])

  const effectivePlaceholder = inputPlaceholderOverride ?? (disabled ? t('studio.initializing') : t('studio.commandPlaceholder'))
  const enterToSendLabel = t('studio.enterToSend')

  return (
    <section
      data-variant={variant}
      className={`studio-terminal relative flex h-full min-h-0 min-w-0 flex-1 flex-col ${isTLayout ? 'bg-white' : ''} ${isMinimal ? 'text-[13px] leading-loose text-accent' : ''}`}
    >
      {isMinimal && (
        <div className="mb-4 ml-4 mr-3 h-[1px] bg-accent opacity-[0.08]" />
      )}

      {!isFrameless && (
        <header className="shrink-0 flex items-center justify-between gap-4 px-8 py-5">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-accent/20 animate-pulse" />
            <div className="studio-brand-title text-[13px] font-bold uppercase tracking-[0.2em] text-text-primary/70">
              {session?.title ?? t('studio.title')}
            </div>
          </div>
          <button
            type="button"
            onClick={onExit}
            className="text-[11px] font-medium uppercase tracking-[0.28em] text-text-secondary/45 transition hover:text-rose-500/80"
          >
            {t('common.close')}
          </button>
        </header>
      )}

      <StudioCommandViewport
        store={commandStore}
        endRef={endRef}
        scrollRef={scrollRef}
        messagesLength={messages.length}
        isMinimal={isMinimal}
        isTLayout={isTLayout}
        variant={variant}
        readyLabel={t('studio.readyForCommands')}
      />

      <StudioCommandComposer
        variant={variant}
        isFrameless={isFrameless}
        isTLayout={isTLayout}
        isMinimal={isMinimal}
        isBusy={isBusy}
        disabled={disabled}
        effectivePlaceholder={effectivePlaceholder}
        enterToSendLabel={enterToSendLabel}
        onEscapePress={onEscapePress}
        composer={composer}
      />
    </section>
  )
})

function nextTypeDelay(target: string, currentLength: number, streamRate: number) {
  const nextChar = target[currentLength] ?? ''
  const backlog = target.length - currentLength
  const targetCharsPerSecond = resolveTypingCharsPerSecond(backlog, streamRate)
  if (!nextChar) {
    return 18
  }

  if (nextChar === '\n') {
    return 1000 / Math.max(targetCharsPerSecond * 1.4, 1)
  }

  if (/[，。！？；：,.!?;:]/.test(nextChar)) {
    return Math.max(24, 1000 / Math.max(targetCharsPerSecond * 0.55, 1))
  }

  if (/\s/.test(nextChar)) {
    return Math.max(10, 1000 / Math.max(targetCharsPerSecond * 1.25, 1))
  }

  return Math.max(12, 1000 / Math.max(targetCharsPerSecond, 1))
}

function nextTypeStep(backlog: number) {
  if (backlog >= 28) {
    return 3
  }

  if (backlog >= 16) {
    return 2
  }

  return 1
}

function resolveTypingCharsPerSecond(backlog: number, streamRate: number) {
  const minCharsPerSecond = 10
  const maxCharsPerSecond = 26
  const adaptiveBase = streamRate > 0 ? streamRate * 0.55 + 6 : minCharsPerSecond

  if (backlog >= 10) {
    return clamp(adaptiveBase, 12, maxCharsPerSecond)
  }

  return clamp(adaptiveBase, minCharsPerSecond, 18)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function shouldRedirectKeyToInput(event: KeyboardEvent): boolean {
  return event.key.length === 1 || event.key === 'Backspace'
}
