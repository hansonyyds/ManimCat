import { createLogger } from '../../utils/logger'

const logger = createLogger('PlotStudioTiming')

const PLOT_STUDIO_EVENT_LABELS: Record<string, string> = {
  'http.run.requested': '绘图工作室：收到运行请求',
  'http.run.accepted': '绘图工作室：运行请求已接受',
  'provider.completed': '绘图工作室：模型请求完成',
  'provider.failed': '绘图工作室：模型请求失败',
  'step.started': '绘图工作室：模型步骤开始',
  'step.response': '绘图工作室：模型步骤返回',
  'step.finished': '绘图工作室：模型步骤结束',
  'run.started': '绘图工作室：运行开始',
  'run.completed': '绘图工作室：运行完成',
  'run.failed': '绘图工作室：运行失败',
  'loop.started': '绘图工作室：进入工具循环',
  'assistant.text': '绘图工作室：助手文本已写入',
  'tool.started': '绘图工作室：工具开始执行',
  'tool.completed': '绘图工作室：工具执行成功',
  'tool.failed': '绘图工作室：工具执行失败',
  'events.client.connected': '绘图工作室：前端事件流已连接',
  'events.client.disconnected': '绘图工作室：前端事件流已断开',
}

export function isPlotStudioKind(studioKind?: string | null): boolean {
  return studioKind === 'plot'
}

export function logPlotStudioTiming(
  studioKind: string | null | undefined,
  event: string,
  data: Record<string, unknown>,
  level: 'info' | 'warn' = 'info'
): void {
  if (!isPlotStudioKind(studioKind)) {
    return
  }

  logger[level](toChinesePlotStudioEventLabel(event), {
    事件代码: event,
    ...data,
  })
}

export function readElapsedMs(startedAt: number): number {
  return Math.max(0, Date.now() - startedAt)
}

export function readRunElapsedMs(run: { createdAt?: string }): number | null {
  if (!run.createdAt) {
    return null
  }

  const createdAt = new Date(run.createdAt).getTime()
  if (!Number.isFinite(createdAt)) {
    return null
  }

  return Math.max(0, Date.now() - createdAt)
}

function toChinesePlotStudioEventLabel(event: string): string {
  return PLOT_STUDIO_EVENT_LABELS[event] ?? `绘图工作室：${event}`
}
