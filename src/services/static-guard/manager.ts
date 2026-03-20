import { createLogger } from '../../utils/logger'
import { createChatCompletionText } from '../openai-stream'
import { createCustomOpenAIClient } from '../openai-client-factory'
import { buildTokenParams } from '../../utils/reasoning-model'
import type { CustomApiConfig } from '../../types'
import type { StaticDiagnostic, StaticGuardContext, StaticGuardResult, StaticPatch } from './types'
import { buildStaticPatchUserPrompt, getStaticPatchSystemPrompt } from './prompt'
import { runStaticChecks } from './checker'

const logger = createLogger('StaticGuardManager')

const STATIC_GUARD_MAX_PASSES = parseInt(process.env.STATIC_GUARD_MAX_PASSES || '6', 10)
const STATIC_GUARD_TEMPERATURE = parseFloat(process.env.STATIC_GUARD_TEMPERATURE || '0.2')
const MAX_TOKENS = parseInt(process.env.AI_MAX_TOKENS || '12000', 10)
const THINKING_TOKENS = parseInt(process.env.AI_THINKING_TOKENS || '20000', 10)

const SIMPLE_TUPLE_LIKE_PATTERN = /^\s*[-+.\w]+\s*(,\s*[-+.\w]+\s*){1,2}$/
const RANGE_PARAM_NAMES = new Set(['x_range', 'y_range', 'z_range', 'u_range', 'v_range', 't_range'])
const POINT_PARAM_NAMES = new Set(['point', 'start', 'end', 'center', 'arc_center'])
const POSITIONAL_POINT_CONSTRUCTORS = ['Dot', 'Dot3D', 'Vector']
const POSITIONAL_TWO_POINT_CONSTRUCTORS = ['Line', 'Arrow', 'DoubleArrow', 'Line3D', 'Arrow3D', 'DashedLine', 'ArcBetweenPoints']

function extractJsonObject(text: string): string {
  const normalized = text.trim()
  if (/^\s*<!DOCTYPE\s+html/i.test(normalized) || /^\s*<html/i.test(normalized)) {
    throw new Error('Static patch response was HTML, not JSON')
  }

  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim()
  }

  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1)
  }

  return text.trim()
}

function parsePatchResponse(content: string): StaticPatch {
  let parsed: { original_snippet?: unknown; replacement_snippet?: unknown }
  try {
    parsed = JSON.parse(extractJsonObject(content)) as {
      original_snippet?: unknown
      replacement_snippet?: unknown
    }
  } catch (error) {
    throw new Error(`Failed to parse static patch JSON: ${String(error)}`)
  }

  const originalSnippet = typeof parsed.original_snippet === 'string' ? parsed.original_snippet : ''
  const replacementSnippet = typeof parsed.replacement_snippet === 'string' ? parsed.replacement_snippet : ''

  if (!originalSnippet) {
    throw new Error('Static patch response missing original_snippet')
  }

  if (originalSnippet === replacementSnippet) {
    throw new Error('Static patch produced no change')
  }

  return { originalSnippet, replacementSnippet }
}

function getLineNumberAtIndex(text: string, index: number): number {
  return text.slice(0, index).split('\n').length
}

function replaceBracketLiteralWithTuple(source: string): string {
  return source.replace(/\[([^\[\]\n]+)\]/g, (match, inner) => {
    if (!SIMPLE_TUPLE_LIKE_PATTERN.test(inner)) {
      return match
    }
    return `(${inner.trim()})`
  })
}

function extractDiagnosticParameterName(message: string): string | undefined {
  const match = message.match(/parameter\s+"([^"]+)"/i)
  return match?.[1]
}

function tryApplyKnownPyrightFix(code: string, diagnostic: StaticDiagnostic): string | null {
  if (diagnostic.tool !== 'pyright' || diagnostic.code !== 'reportArgumentType') {
    return null
  }

  const normalizedMessage = diagnostic.message.toLowerCase()
  if (!normalizedMessage.includes('list[')) {
    return null
  }
  if (!normalizedMessage.includes('tuple[') && !normalizedMessage.includes('point3dlike')) {
    return null
  }

  const parameterName = extractDiagnosticParameterName(diagnostic.message)
  let nextCode = code

  if (parameterName && RANGE_PARAM_NAMES.has(parameterName)) {
    nextCode = nextCode.replace(
      new RegExp(`\\b${parameterName}\\s*=\\s*\\[([^\\[\\]\\n]+)\\]`, 'g'),
      (_, inner: string) => `${parameterName}=(${inner.trim()})`
    )
  }

  if (parameterName && POINT_PARAM_NAMES.has(parameterName)) {
    for (const constructorName of POSITIONAL_POINT_CONSTRUCTORS) {
      nextCode = nextCode.replace(
        new RegExp(`\\b${constructorName}\\s*\\(\\s*\\[([^\\[\\]\\n]+)\\]`, 'g'),
        (_, inner: string) => `${constructorName}((${inner.trim()})`
      )
    }

    for (const constructorName of POSITIONAL_TWO_POINT_CONSTRUCTORS) {
      nextCode = nextCode.replace(
        new RegExp(`\\b${constructorName}\\s*\\(\\s*\\[([^\\[\\]\\n]+)\\]\\s*,\\s*\\[([^\\[\\]\\n]+)\\]`, 'g'),
        (_, startInner: string, endInner: string) =>
          `${constructorName}((${startInner.trim()}), (${endInner.trim()})`
      )
    }

    nextCode = nextCode.replace(
      new RegExp(`\\b${parameterName}\\s*=\\s*\\[([^\\[\\]\\n]+)\\]`, 'g'),
      (_, inner: string) => `${parameterName}=(${inner.trim()})`
    )
  }

  const lines = nextCode.split('\n')
  const targetIndex = diagnostic.line - 1
  if (targetIndex >= 0 && targetIndex < lines.length) {
    lines[targetIndex] = replaceBracketLiteralWithTuple(lines[targetIndex])
    nextCode = lines.join('\n')
  }

  return nextCode !== code ? nextCode : null
}

function applyPatch(code: string, patch: StaticPatch, targetLine: number): string {
  const matches: number[] = []
  let searchIndex = 0

  while (true) {
    const foundAt = code.indexOf(patch.originalSnippet, searchIndex)
    if (foundAt < 0) {
      break
    }
    matches.push(foundAt)
    searchIndex = foundAt + Math.max(1, patch.originalSnippet.length)
  }

  if (matches.length === 0) {
    throw new Error('Static patch original_snippet not found in code')
  }

  const bestIndex = matches.reduce((best, current) => {
    const bestDistance = Math.abs(getLineNumberAtIndex(code, best) - targetLine)
    const currentDistance = Math.abs(getLineNumberAtIndex(code, current) - targetLine)
    return currentDistance < bestDistance ? current : best
  })

  return `${code.slice(0, bestIndex)}${patch.replacementSnippet}${code.slice(bestIndex + patch.originalSnippet.length)}`
}

async function generateStaticPatch(
  code: string,
  diagnostic: StaticDiagnostic,
  customApiConfig: CustomApiConfig
): Promise<StaticPatch> {
  const client = createCustomOpenAIClient(customApiConfig)
  const model = (customApiConfig.model || '').trim()
  if (!model) {
    throw new Error('No model available')
  }

  const { content } = await createChatCompletionText(
    client,
    {
      model,
      messages: [
        { role: 'system', content: getStaticPatchSystemPrompt() },
        { role: 'user', content: buildStaticPatchUserPrompt(code, diagnostic) }
      ],
      temperature: STATIC_GUARD_TEMPERATURE,
      ...buildTokenParams(THINKING_TOKENS, MAX_TOKENS)
    },
    { fallbackToNonStream: true, usageLabel: 'static-guard' }
  )

  if (!content) {
    throw new Error('Static patch model returned empty content')
  }

  return parsePatchResponse(content)
}

export async function runStaticGuardLoop(
  code: string,
  context: StaticGuardContext,
  customApiConfig: CustomApiConfig,
  onCheckpoint?: () => Promise<void>
): Promise<StaticGuardResult> {
  let currentCode = code

  for (let passIndex = 1; passIndex <= STATIC_GUARD_MAX_PASSES; passIndex++) {
    logger.info('Static guard pass started', {
      passIndex,
      maxPasses: STATIC_GUARD_MAX_PASSES,
      outputMode: context.outputMode,
      codeLength: currentCode.length
    })

    if (onCheckpoint) {
      await onCheckpoint()
    }

    const diagnostic = await runStaticChecks(currentCode, context.outputMode)
    if (!diagnostic) {
      logger.info('Static guard passed', { outputMode: context.outputMode, passes: passIndex - 1 })
      return {
        code: currentCode,
        passes: passIndex - 1
      }
    }

    logger.warn('Static guard found diagnostic', {
      passIndex,
      tool: diagnostic.tool,
      line: diagnostic.line,
      code: diagnostic.code,
      message: diagnostic.message
    })

    const knownFixedCode = tryApplyKnownPyrightFix(currentCode, diagnostic)
    if (knownFixedCode) {
      currentCode = knownFixedCode
      logger.info('Static guard applied known pyright tuple fix', {
        passIndex,
        line: diagnostic.line,
        code: diagnostic.code,
        message: diagnostic.message
      })
      continue
    }

    const patch = await generateStaticPatch(currentCode, diagnostic, customApiConfig)
    currentCode = applyPatch(currentCode, patch, diagnostic.line)
    logger.info('Static guard patch applied', {
      passIndex,
      tool: diagnostic.tool,
      line: diagnostic.line,
      originalLength: patch.originalSnippet.length,
      replacementLength: patch.replacementSnippet.length
    })
  }

  throw new Error(`Static guard failed after ${STATIC_GUARD_MAX_PASSES} passes`)
}
