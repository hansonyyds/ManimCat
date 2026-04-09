import { useMemo, useRef, useState } from 'react'
import { StudioPermissionModeModal } from './commands/ui/StudioPermissionModeModal'
import { StudioCommandPanel, type StudioCommandPanelHandle } from './components/StudioCommandPanel'
import { useStudioSession } from './hooks/use-studio-session'
import { PlotPreviewPanel } from './plot/PlotPreviewPanel'
import { useI18n } from '../i18n'
import ManimCatLogo from '../components/ManimCatLogo'
import { useModalTransition } from '../hooks/useModalTransition'
import { StudioSessionHistoryModal } from './commands/ui/StudioSessionHistoryModal'

interface PlotStudioShellProps {
  onExit: () => void
  isExiting?: boolean
}

export function PlotStudioShell({ onExit, isExiting }: PlotStudioShellProps) {
  const { t } = useI18n()
  const studio = useStudioSession({
    studioKind: 'plot',
    title: 'Plot Studio'
  })
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null)
  const [orderedWorkIds, setOrderedWorkIds] = useState<string[]>([])
  const [confirmExitOpen, setConfirmExitOpen] = useState(false)
  const [interruptArmedUntil, setInterruptArmedUntil] = useState<number | null>(null)
  const commandPanelRef = useRef<StudioCommandPanelHandle | null>(null)
  const incomingIds = useMemo(() => studio.workSummaries.map((entry) => entry.work.id), [studio.workSummaries])

  const orderedWorkSummaries = useMemo(() => {
    const byId = new Map(studio.workSummaries.map((entry) => [entry.work.id, entry]))
    const preserved = orderedWorkIds.filter((id) => byId.has(id))
    const appended = incomingIds.filter((id) => !preserved.includes(id))
    return [...appended, ...preserved]
      .map((id) => byId.get(id))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
  }, [incomingIds, orderedWorkIds, studio.workSummaries])

  const effectiveSelectedWorkId =
    selectedWorkId && orderedWorkSummaries.some((entry) => entry.work.id === selectedWorkId)
      ? selectedWorkId
      : orderedWorkSummaries[0]?.work.id ?? null
  const selected = studio.selectWork(effectiveSelectedWorkId)
  const historyCountLabel = String(orderedWorkSummaries.length).padStart(2, '0')
  const historyCount = orderedWorkSummaries.length
  const maxHistorySlots = historyCount <= 12 ? 12 : Math.ceil(historyCount / 12) * 12 + (historyCount % 12 === 0 ? 0 : 12)

  const handleReorderWorks = (nextWorkIds: string[]) => {
    setOrderedWorkIds((current) => (areSameIds(current, nextWorkIds) ? current : nextWorkIds))
  }

  const interruptHintActive = interruptArmedUntil !== null && interruptArmedUntil > Date.now()

  const handleEscapePress = () => {
    const activeRun = studio.latestRun
    const runIsInterruptible = activeRun && (activeRun.status === 'pending' || activeRun.status === 'running')
    if (!runIsInterruptible) {
      setInterruptArmedUntil(null)
      return
    }

    const now = Date.now()
    if (interruptArmedUntil && interruptArmedUntil > now) {
      setInterruptArmedUntil(null)
      void studio.cancelCurrentRun('Cancelled by double-escape in Plot Studio')
      return
    }

    setInterruptArmedUntil(now + 3000)
    window.setTimeout(() => {
      setInterruptArmedUntil((current) => (current && current <= Date.now() ? null : current))
    }, 3100)
  }

  return (
    <>
      <div
        className={`studio-shell-root relative isolate flex min-h-screen flex-col overflow-y-auto bg-[#fafaf8] px-6 pb-2 pt-7 text-accent antialiased dark:bg-bg-primary dark:text-text-primary sm:px-8 sm:pb-3 sm:pt-8 md:h-screen md:overflow-hidden md:px-10 md:pb-4 md:pt-10 lg:px-12 lg:pb-5 lg:pt-12 ${
          isExiting ? 'animate-studio-exit' : 'animate-studio-entrance'
        }`}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(66,66,66,0.045),_transparent_52%),radial-gradient(circle_at_bottom_right,_rgba(66,66,66,0.04),_transparent_36%)] dark:bg-[radial-gradient(circle_at_top,_rgba(138,138,138,0.08),_transparent_42%),radial-gradient(circle_at_bottom_right,_rgba(138,138,138,0.05),_transparent_32%)]"
        />

        <header className="mb-10 flex shrink-0 items-center justify-between gap-6 md:mb-12">
          <div className="flex min-w-0 items-center gap-4 sm:gap-6">
            <ManimCatLogo className="h-8 w-8 shrink-0 opacity-80 mix-blend-multiply dark:mix-blend-normal sm:h-9 sm:w-9" />
            <div className="flex min-w-0 items-baseline gap-4 sm:gap-6">
              <span className="truncate text-lg font-light tracking-[0.22em] sm:text-xl sm:tracking-[0.28em]">MANIMCAT</span>
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.36em] opacity-35 sm:text-[11px]">{studio.session?.directory ?? 'workspace'}</span>
            </div>
          </div>
          <button 
            onClick={() => setConfirmExitOpen(true)}
            className="shrink-0 font-mono text-[10px] uppercase tracking-[0.4em] opacity-35 transition-opacity hover:opacity-100"
          >
            {t('studio.exitAction')}
          </button>
        </header>

        <main className="relative mb-10 flex min-h-[36vh] flex-1 items-center justify-center md:mb-12 md:min-h-0">
          <div className="h-full w-full">
            <PlotPreviewPanel
              session={studio.session}
              works={orderedWorkSummaries}
              selectedWorkId={effectiveSelectedWorkId}
              work={selected.work}
              result={selected.result}
              latestRun={studio.latestRun}
              tasks={selected.tasks}
              requests={studio.pendingPermissions}
              replyingPermissionIds={studio.replyingPermissionIds}
              latestAssistantText={studio.latestAssistantText}
              errorMessage={studio.state.error ?? studio.state.connection.eventError}
              onSelectWork={setSelectedWorkId}
              onReorderWorks={handleReorderWorks}
              onReply={studio.replyPermission}
              onSendPreviewToComposer={(attachment) => commandPanelRef.current?.appendPreviewAttachment(attachment)}
              variant="pure-minimal-top"
            />
          </div>
        </main>

        <section className="flex shrink-0 min-h-0 flex-col gap-5 md:h-72 md:flex-row md:gap-12 lg:gap-16">
          <div className="relative flex min-h-[15rem] min-w-0 flex-1 flex-col md:pl-5 md:pr-5 lg:pl-8 lg:pr-10">
            <StudioCommandPanel
              ref={commandPanelRef}
              session={studio.session}
              messages={studio.messages}
              latestAssistantText={studio.latestAssistantText}
              isBusy={studio.isBusy}
              disabled={studio.isBusy || studio.state.connection.snapshotStatus !== 'ready'}
              onRun={studio.runCommand}
              onExit={onExit}
              variant="pure-minimal-bottom"
              onEscapePress={handleEscapePress}
              inputPlaceholderOverride={interruptHintActive ? t('studio.interruptPlaceholder') : undefined}
            />
          </div>

          <aside className="flex min-h-0 w-full shrink-0 flex-col md:w-[32rem] lg:w-[35rem] xl:w-[38rem]">
            <div className="mb-3 h-[1px] bg-accent opacity-[0.08] dark:opacity-[0.18]" />
            <div className="mb-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.4em] opacity-40 dark:opacity-55">
              <span>{t('studio.plot.history')}</span>
              <span>{historyCountLabel}-{maxHistorySlots}</span>
            </div>
            
            <div className="no-scrollbar min-h-0 overflow-y-auto">
              <div className="grid grid-cols-3 content-start gap-4 md:gap-5">
                {orderedWorkSummaries.map((entry) => {
                  const isSelected = entry.work.id === effectiveSelectedWorkId
                  const attachment = entry.result?.attachments?.find((item) => (
                    item.mimeType?.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(item.path)
                  ))
                  const failed = entry.work.status === 'failed' || entry.result?.kind === 'failure-report'

                  return (
                    <button
                      key={entry.work.id}
                      type="button"
                      onClick={() => setSelectedWorkId(entry.work.id)}
                      className={`group relative aspect-square overflow-hidden rounded-[1.6rem] border transition-all duration-500 ${
                        isSelected
                          ? 'border-black/10 bg-black/[0.08] dark:border-white/10 dark:bg-bg-secondary/72'
                          : 'border-transparent bg-black/[0.028] hover:bg-black/[0.05] dark:bg-bg-secondary/38 dark:hover:bg-bg-secondary/55'
                      }`}
                    >
                      {attachment ? (
                        <img
                          src={attachment.path}
                          alt={entry.work.title}
                          className={`h-full w-full object-cover transition-all duration-700 ${
                            isSelected
                              ? 'scale-100 opacity-100'
                              : 'scale-[1.08] opacity-32 group-hover:scale-100 group-hover:opacity-72 dark:opacity-45 dark:group-hover:opacity-80'
                          }`}
                        />
                      ) : failed ? (
                        <div className="flex h-full w-full items-center justify-center bg-rose-500/[0.06] text-rose-700/60 dark:bg-rose-400/[0.08] dark:text-rose-200/65">
                          <span className="font-mono text-[8px] uppercase tracking-[0.24em]">Fail</span>
                        </div>
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <span className="font-mono text-[8px] uppercase tracking-[0.22em] opacity-12 dark:opacity-25">IMG</span>
                        </div>
                      )}
                      <span className="pointer-events-none absolute left-2 top-2 font-mono text-[8px] uppercase tracking-[0.24em] text-white/72 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        {entry.work.title.slice(0, 8)}
                      </span>
                    </button>
                  )
                })}
                {orderedWorkSummaries.length === 0 && (
                  <div className="col-span-3 flex aspect-[3/1] items-center justify-center">
                    <span className="font-mono text-[9px] uppercase tracking-[0.42em] opacity-[0.18]">Null Stack</span>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>

      <StudioPermissionModeModal {...studio.permissionModeModal} />
      <StudioSessionHistoryModal {...studio.historyModal} />
      <StudioExitConfirmModal
        isOpen={confirmExitOpen}
        onClose={() => setConfirmExitOpen(false)}
        onConfirm={() => {
          setConfirmExitOpen(false)
          onExit()
        }}
      />
    </>
  )
}

function StudioExitConfirmModal({
  isOpen,
  onClose,
  onConfirm,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const { t } = useI18n()
  const { shouldRender, isExiting } = useModalTransition(isOpen)

  if (!shouldRender) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 bg-bg-primary/60 backdrop-blur-md transition-opacity duration-300 ${
          isExiting ? 'opacity-0' : 'animate-overlay-wash-in'
        }`}
        onClick={onClose}
      />

      <div
        className={`relative w-full max-w-sm rounded-[2.2rem] border border-border/5 bg-bg-secondary p-8 shadow-2xl ${
          isExiting ? 'animate-fade-out-soft' : 'animate-fade-in-soft'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium tracking-tight text-text-primary">
              {t('studio.exitConfirmTitle')}
            </h2>
            <p className="mt-3 text-sm leading-7 text-text-secondary/72">
              {t('studio.exitConfirmDescription')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl p-2.5 text-text-secondary/50 transition-all hover:bg-bg-primary/50 hover:text-text-primary"
            aria-label={t('common.close')}
            title={t('common.close')}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-bg-primary/50 px-5 py-3.5 text-sm font-medium text-text-secondary transition-all hover:bg-bg-tertiary hover:text-text-primary"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-2xl bg-accent px-5 py-3.5 text-sm font-medium text-bg-primary shadow-md shadow-accent/10 transition-all hover:bg-accent/90"
          >
            {t('studio.exitConfirmAction')}
          </button>
        </div>
      </div>
    </div>
  )
}

function areSameIds(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false
    }
  }

  return true
}
