import { useCallback, useState } from 'react'
import { updateStudioSession } from '../api/studio-agent-api'
import type { StudioPermissionMode, StudioSession } from '../protocol/studio-agent-types'
import { useStudioCommandRunner } from './use-studio-command-runner'

interface UseStudioCommandControlsInput {
  session: StudioSession | null
  onRun: (inputText: string) => Promise<void>
  onSessionUpdated: (session: StudioSession) => Promise<void>
  onOpenHistory: () => void
  onCreateSession: () => Promise<void>
}

export function useStudioCommandControls({
  session,
  onRun,
  onSessionUpdated,
  onOpenHistory,
  onCreateSession,
}: UseStudioCommandControlsInput) {
  const [pendingMode, setPendingMode] = useState<StudioPermissionMode | null>(null)
  const [isApplyingMode, setIsApplyingMode] = useState(false)

  const submitInput = useStudioCommandRunner({
    session,
    onRun,
    openHistory: onOpenHistory,
    createSession: onCreateSession,
    setPendingMode,
  })

  const closePermissionModeModal = useCallback(() => {
    if (isApplyingMode) {
      return
    }
    setPendingMode(null)
  }, [isApplyingMode])

  const confirmPermissionMode = useCallback(async () => {
    if (!session || !pendingMode) {
      return
    }

    setIsApplyingMode(true)
    try {
      const updatedSession = await updateStudioSession({
        sessionId: session.id,
        permissionMode: pendingMode,
      })
      await onSessionUpdated(updatedSession)
      setPendingMode(null)
    } finally {
      setIsApplyingMode(false)
    }
  }, [onSessionUpdated, pendingMode, session])

  return {
    submitInput,
    permissionModeModal: {
      isOpen: pendingMode !== null,
      mode: pendingMode,
      isSubmitting: isApplyingMode,
      onClose: closePermissionModeModal,
      onConfirm: confirmPermissionMode,
    },
  }
}

