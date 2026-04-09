import { allStudioCommands } from '../all-commands'
import type { StudioCommandGroup, StudioCommandPresentation } from '../types'

export interface StudioCommandSuggestion extends StudioCommandPresentation {
  id: string
  group: StudioCommandGroup
}

export const allStudioCommandSuggestions: StudioCommandSuggestion[] = allStudioCommands.map((command, index) => ({
  id: `${command.id}-${index}`,
  group: command.group,
  ...command.presentation,
}))

export function getStudioCommandSuggestions(input: string, maxItems = 6): StudioCommandSuggestion[] {
  const normalized = normalizeCommandInput(input)
  if (!normalized) {
    return []
  }

  if (allStudioCommandSuggestions.some((item) => item.trigger.toLowerCase() === normalized)) {
    return []
  }

  return allStudioCommandSuggestions
    .map((item) => ({
      item,
      score: scoreSuggestion(item, normalized),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }
      return left.item.trigger.localeCompare(right.item.trigger)
    })
    .slice(0, maxItems)
    .map((entry) => entry.item)
}

function normalizeCommandInput(input: string) {
  const trimmed = input.trim().toLowerCase()
  if (!trimmed.startsWith('/')) {
    return null
  }
  return trimmed
}

function scoreSuggestion(item: StudioCommandSuggestion, query: string) {
  const trigger = item.trigger.toLowerCase()
  const aliases = item.aliases?.map((alias) => alias.toLowerCase()) ?? []
  const keywords = item.keywords?.map((keyword) => keyword.toLowerCase()) ?? []
  const searchTerm = query.slice(1)

  if (query === '/') {
    return 100 - trigger.length
  }

  if (trigger === query) {
    return 1000
  }

  if (trigger.startsWith(query)) {
    return 800 - (trigger.length - query.length)
  }

  for (const alias of aliases) {
    if (alias === query) {
      return 720
    }
    if (alias.startsWith(query)) {
      return 620 - (alias.length - query.length)
    }
  }

  if (searchTerm.length >= 2 && keywords.some((keyword) => keyword.includes(searchTerm))) {
    return 220
  }

  if (trigger.includes(query)) {
    return 180
  }

  return 0
}
