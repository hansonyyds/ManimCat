import { executeStudioImageInputCommand } from './handlers/image-input'
import type { StudioCommandDefinition, StudioImageInputCommand } from './types'

export const featureStudioCommands: StudioCommandDefinition[] = [
  {
    id: 'image-input',
    group: 'feature',
    scope: 'local',
    presentation: {
      trigger: '/p',
      titleKey: 'studio.command.imageTitle',
      descriptionKey: 'studio.command.imageDescription',
      aliases: ['/paint'],
      keywords: ['image', 'upload', 'canvas', 'reference'],
    },
    matches(input): StudioImageInputCommand | null {
      const normalized = input.trim().toLowerCase()
      if (normalized !== '/p' && normalized !== '/paint') {
        return null
      }

      return {
        id: 'image-input',
        group: 'feature',
        raw: normalized,
      }
    },
    execute: executeStudioImageInputCommand,
  },
]
