import { describe, expect, it } from 'vitest'
import { getStudioCommandSuggestions } from '../../../studio/commands/autocomplete/command-suggestions'

describe('getStudioCommandSuggestions', () => {
  it('returns registered commands when the user types slash', () => {
    const suggestions = getStudioCommandSuggestions('/')

    expect(suggestions.map((item) => item.trigger)).toContain('/history')
    expect(suggestions.map((item) => item.trigger)).toContain('/new')
    expect(suggestions.map((item) => item.trigger)).toContain('/safe')
    expect(suggestions.map((item) => item.trigger)).toContain('/p')
  })

  it('filters suggestions by prefix', () => {
    const suggestions = getStudioCommandSuggestions('/n')

    expect(suggestions.map((item) => item.trigger)).toEqual(['/new'])
  })

  it('includes separately registered permission mode commands', () => {
    const suggestions = getStudioCommandSuggestions('/a')

    expect(suggestions.map((item) => item.trigger)).toEqual(['/auto'])
  })
})
