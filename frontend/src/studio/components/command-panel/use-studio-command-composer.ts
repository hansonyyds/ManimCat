import { useImperativeHandle, useRef, useState } from 'react'
import type { Ref } from 'react'
import {
  addAttachmentTokenToInput,
  appendStudioReferenceImages,
  createComposerImageAttachment,
  filterAttachmentsPresentInInput,
  removeAttachmentTokenFromInput,
} from '../../composer/attachments'
import { useStudioComposerAttachments } from '../../composer/use-studio-composer-attachments'
import { resolveStudioCommand } from '../../commands/resolve-studio-command'
import { useStudioCommandAutocomplete } from '../../commands/ui/autocomplete/use-studio-command-autocomplete'
import { useStudioImageInputCommand } from '../../commands/ui/image-input/use-studio-image-input-command'
import type { StudioMessage, StudioSession } from '../../protocol/studio-agent-types'
import type { StudioCommandPanelHandle } from '../StudioCommandPanel'

interface UseStudioCommandComposerInput {
  session: StudioSession | null
  disabled: boolean
  onRun: (inputText: string) => Promise<void> | void
  composerRef: Ref<StudioCommandPanelHandle>
}

export function useStudioCommandComposer({
  session,
  disabled,
  onRun,
  composerRef,
}: UseStudioCommandComposerInput) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const attachmentsState = useStudioComposerAttachments()
  const commandAutocomplete = useStudioCommandAutocomplete(input)

  const focusInput = () => {
    if (disabled) {
      return
    }
    inputRef.current?.focus()
  }

  const appendAttachmentTokens = (nextInput: string, nextAttachments: typeof attachmentsState.attachments) => {
    return nextAttachments.reduce((current, attachment) => addAttachmentTokenToInput(current, attachment), nextInput)
  }

  const addAttachmentsToComposer = (nextAttachments: typeof attachmentsState.attachments) => {
    if (nextAttachments.length === 0) {
      return
    }
    setInput((current) => appendAttachmentTokens(current, nextAttachments))
    focusInput()
  }

  const imageInputCommand = useStudioImageInputCommand({
    addImageFiles: attachmentsState.addImageFiles,
    appendReferenceImages: attachmentsState.appendReferenceImages,
    onAttachmentsAdded: addAttachmentsToComposer,
    onFocusComposer: focusInput,
  })

  const handleSubmit = async () => {
    const next = input.trim()
    if (!next || disabled) {
      return
    }

    const localCommand = resolveStudioCommand(next)
    if (localCommand?.definition.scope === 'local') {
      setInput('')
      await localCommand.definition.execute(localCommand.command as never, {
        session,
        openHistory: () => {},
        createSession: async () => {},
        setPendingMode: () => {},
        openImageInputMode: imageInputCommand.openImageInputMode,
      })
      focusInput()
      return
    }

    const submittedAttachments = attachmentsState.attachments
    setInput('')
    attachmentsState.clearAttachments()
    const runInput = appendStudioReferenceImages(next, submittedAttachments)
    try {
      await onRun(runInput)
    } catch {
      setInput(next)
      attachmentsState.retainAttachments(submittedAttachments)
    }
    inputRef.current?.focus()
  }

  const handleInputChange = (nextValue: string) => {
    setInput(nextValue)
    const retained = filterAttachmentsPresentInInput(nextValue, attachmentsState.attachments)
    if (retained.length !== attachmentsState.attachments.length) {
      attachmentsState.retainAttachments(retained)
    }
  }

  const handleRemoveAttachment = (attachmentId: string) => {
    const target = attachmentsState.attachments.find((attachment) => attachment.id === attachmentId)
    if (!target) {
      return
    }

    attachmentsState.removeAttachment(attachmentId)
    setInput((current) => removeAttachmentTokenFromInput(current, target))
  }

  const applySuggestion = (nextInput: string) => {
    setInput(nextInput)
    inputRef.current?.focus()
  }

  useImperativeHandle(composerRef, () => ({
    appendPreviewAttachment: (attachment) => {
      const nextAttachment = createComposerImageAttachment({
        url: attachment.url,
        name: attachment.name,
        mimeType: attachment.mimeType,
        detail: 'low',
      })
      attachmentsState.appendUploadedAttachment(nextAttachment)
      setInput((current) => addAttachmentTokenToInput(current, nextAttachment))
      focusInput()
    },
    focusComposer: focusInput,
  }), [attachmentsState.appendUploadedAttachment, disabled])

  return {
    input,
    inputRef,
    attachments: attachmentsState.attachments,
    attachmentError: attachmentsState.attachmentError,
    commandAutocomplete,
    imageInputCommand,
    effectiveApplySuggestion: applySuggestion,
    focusInput,
    handleInputChange,
    handleRemoveAttachment,
    handleSubmit,
  }
}
