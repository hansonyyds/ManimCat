import type { StudioFileAttachment, StudioRun, StudioSession, StudioTask, StudioWork, StudioWorkResult } from '../protocol/studio-agent-types'
import { formatStudioTime, studioStatusBadge, truncateStudioText } from '../theme'

interface StudioWorkListItem {
  work: StudioWork
  latestTask: StudioTask | null
  result: StudioWorkResult | null
}

interface StudioAssetsPanelProps {
  session: StudioSession | null
  works: StudioWorkListItem[]
  selectedWorkId: string | null
  work: StudioWork | null
  result: StudioWorkResult | null
  latestRun: StudioRun | null
  onSelectWork: (workId: string) => void
}

export function StudioAssetsPanel({
  session,
  works,
  selectedWorkId,
  work,
  result,
  latestRun,
  onSelectWork,
}: StudioAssetsPanelProps) {
  const previewAttachment = result?.attachments?.find(isPreviewAttachment) ?? result?.attachments?.[0] ?? null

  return (
    <aside className="flex h-full min-h-0 w-[360px] shrink-0 flex-col gap-6 overflow-hidden px-6 pb-6 pt-8 shadow-[inset_-8px_0_12px_-8px_rgba(0,0,0,0.04)] dark:shadow-[inset_-8px_0_12px_-8px_rgba(0,0,0,0.2)]">
      <div className="shrink-0">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.34em] text-text-secondary/45">预览区</div>
          <span className="studio-paw-float text-sm opacity-30">🐾</span>
        </div>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-text-primary/90">{work?.title ?? '等待产出'}</h2>
            <div className="mt-2 text-xs leading-6 text-text-secondary/60">
              {session?.title ?? 'Studio 会话'} · {latestRun ? translateRunStatus(latestRun.status) : '待命'}
            </div>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${studioStatusBadge(work?.status ?? latestRun?.status ?? 'idle')}`}>
            {work ? translateWorkStatus(work.status) : latestRun ? translateRunStatus(latestRun.status) : '待命'}
          </span>
        </div>
      </div>

      <section className="shrink-0 overflow-hidden">
        <div className="aspect-video">
          <PreviewSurface attachment={previewAttachment} result={result} />
        </div>
        {(previewAttachment || result?.summary) && (
          <div className="px-1 py-4">
            <div className="text-[13px] leading-6 text-text-primary/70">{result?.summary}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-widest text-text-secondary/40">
              <span>{result ? translateResultKind(result.kind) : ''}</span>
              {result && <span>·</span>}
              <span>{result ? formatStudioTime(result.createdAt) : ''}</span>
            </div>
          </div>
        )}
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-1">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-text-secondary/35">Library / Works</div>
          </div>
          <div className="font-mono text-[10px] text-text-secondary/40">{works.length.toString().padStart(2, '0')}</div>
        </div>

        <div className="mt-6 min-h-0 flex-1 space-y-2 overflow-y-auto pr-2">
          {works.map((entry) => {
            const { work: item, latestTask } = entry
            const selected = item.id === selectedWorkId
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectWork(item.id)}
                className={`w-full rounded-xl px-5 py-4 text-left transition-all duration-300 ${
                  selected
                    ? 'bg-bg-secondary/40 shadow-sm'
                    : 'hover:bg-bg-secondary/20'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className={`truncate text-[13px] font-bold transition-colors ${selected ? 'text-text-primary' : 'text-text-primary/60'}`}>
                      {item.title}
                    </div>
                    <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.2em] text-text-secondary/30">{translateWorkType(item.type)}</div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-tighter ${studioStatusBadge(item.status)}`}>
                    {translateWorkStatus(item.status)}
                  </span>
                </div>
                <div className="mt-3 space-y-1.5 text-[11px] leading-5 text-text-secondary/50">
                  <div className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-current opacity-30" />
                    <span className="truncate">{latestTask ? truncateStudioText(latestTask.title, 42) : 'waiting...'}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </section>
    </aside>
  )
}

function PreviewSurface({
  attachment,
  result,
}: {
  attachment: StudioFileAttachment | null | undefined
  result: StudioWorkResult | null
}) {
  if (attachment?.mimeType?.startsWith('video/') || isVideoPath(attachment?.path)) {
    return <video src={attachment?.path} controls className="h-full w-full object-contain" />
  }

  if (attachment?.mimeType?.startsWith('image/') || isImagePath(attachment?.path)) {
    return <img src={attachment?.path} alt={attachment?.name ?? 'preview'} className="h-full w-full object-contain" />
  }

  if (result?.kind === 'failure-report') {
    return (
      <div className="flex h-full items-center justify-center opacity-30">
        <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-rose-500/70">Render Failed</div>
      </div>
    )
  }

  // 无产出时保持空白
  return null
}

function isPreviewAttachment(attachment: { path: string; mimeType?: string } | undefined) {
  if (!attachment) {
    return false
  }

  return (
    attachment.mimeType?.startsWith('video/') ||
    attachment.mimeType?.startsWith('image/') ||
    isVideoPath(attachment.path) ||
    isImagePath(attachment.path)
  )
}

function isVideoPath(path?: string) {
  return Boolean(path && /\.(mp4|webm|mov|m4v)$/i.test(path))
}

function isImagePath(path?: string) {
  return Boolean(path && /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(path))
}

function translateRunStatus(status: string) {
  switch (status) {
    case 'running':
      return '运行中'
    case 'completed':
      return '已完成'
    case 'failed':
      return '失败'
    case 'cancelled':
      return '已取消'
    case 'pending':
      return '排队中'
    default:
      return status
  }
}

function translateWorkStatus(status: string) {
  switch (status) {
    case 'running':
      return '进行中'
    case 'completed':
      return '完成'
    case 'failed':
      return '失败'
    case 'cancelled':
      return '取消'
    case 'proposed':
      return '提议'
    default:
      return status
  }
}

function translateWorkType(type: string) {
  switch (type) {
    case 'video':
      return '视频'
    case 'review':
      return '审查'
    case 'design':
      return '设计'
    case 'edit':
      return '编辑'
    case 'render-fix':
      return '渲染修复'
    default:
      return type
  }
}

function translateResultKind(kind: string) {
  switch (kind) {
    case 'render-output':
      return '渲染产物'
    case 'review-report':
      return '审查报告'
    case 'design-plan':
      return '设计方案'
    case 'edit-result':
      return '编辑结果'
    case 'failure-report':
      return '失败报告'
    default:
      return kind
  }
}
