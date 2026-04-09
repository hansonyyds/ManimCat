import { executeStudioPermissionModeCommand } from './handlers/permission-mode'
import type { StudioPermissionMode } from '../protocol/studio-agent-types'
import type { StudioCommandDefinition, StudioPermissionModeCommand } from './types'

export const advancedStudioCommands: StudioCommandDefinition[] = [
  createPermissionModeCommand({
    trigger: '/safe',
    mode: 'safe',
    titleKey: 'studio.command.safeTitle',
    descriptionKey: 'studio.command.safeDescription',
    keywords: ['permission', 'mode', 'approval', 'safety'],
  }),
  createPermissionModeCommand({
    trigger: '/auto',
    mode: 'auto',
    titleKey: 'studio.command.autoTitle',
    descriptionKey: 'studio.command.autoDescription',
    keywords: ['permission', 'mode', 'approval'],
  }),
  createPermissionModeCommand({
    trigger: '/full',
    mode: 'full',
    titleKey: 'studio.command.fullTitle',
    descriptionKey: 'studio.command.fullDescription',
    keywords: ['permission', 'mode', 'approval'],
  }),
]

function createPermissionModeCommand(input: {
  trigger: string
  mode: StudioPermissionMode
  titleKey: string
  descriptionKey: string
  keywords: string[]
}): StudioCommandDefinition<StudioPermissionModeCommand> {
  return {
    id: 'permission-mode',
    group: 'advanced',
    scope: 'global',
    presentation: {
      trigger: input.trigger,
      titleKey: input.titleKey,
      descriptionKey: input.descriptionKey,
      keywords: input.keywords,
    },
    matches(value): StudioPermissionModeCommand | null {
      const normalized = value.trim().toLowerCase()
      if (normalized !== input.trigger) {
        return null
      }

      return {
        id: 'permission-mode',
        group: 'advanced',
        raw: normalized,
        mode: input.mode,
      }
    },
    execute: executeStudioPermissionModeCommand,
  }
}
