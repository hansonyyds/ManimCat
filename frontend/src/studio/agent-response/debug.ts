export function debugStudioMessages(event: string, payload: Record<string, unknown>): void {
  if (!shouldLogStudioMessages()) {
    return
  }

  console.debug(`[studio-messages] ${event}`, payload)
}

function shouldLogStudioMessages(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const globalFlag = (window as typeof window & { __MANIMCAT_STUDIO_DEBUG__?: unknown }).__MANIMCAT_STUDIO_DEBUG__
  if (globalFlag) {
    return true
  }

  try {
    return window.localStorage.getItem('manimcat:studio-debug') === '1'
  } catch {
    return false
  }
}
