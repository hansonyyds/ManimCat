import OpenAI from 'openai'

interface ChatCompletionTextOptions {
  fallbackToNonStream?: boolean
}

type ChatCompletionRequest = Omit<OpenAI.Chat.Completions.ChatCompletionCreateParams, 'stream'>

export interface ChatCompletionTextResult {
  content: string
  mode: 'stream' | 'non-stream'
  response?: OpenAI.Chat.Completions.ChatCompletion
}

function normalizeContent(content: unknown): string {
  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part
        if (part && typeof part === 'object' && 'text' in part) {
          const text = (part as { text?: unknown }).text
          return typeof text === 'string' ? text : ''
        }
        return ''
      })
      .join('\n')
  }

  return ''
}

export async function createChatCompletionText(
  client: OpenAI,
  request: ChatCompletionRequest,
  options: ChatCompletionTextOptions = {}
): Promise<ChatCompletionTextResult> {
  let receivedContent = false

  try {
    const stream = await client.chat.completions.create({
      ...request,
      stream: true
    })

    let content = ''
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content
      if (typeof delta === 'string' && delta.length > 0) {
        content += delta
        receivedContent = true
      }
    }

    return {
      content: content.trim(),
      mode: 'stream'
    }
  } catch (error) {
    if (!options.fallbackToNonStream || receivedContent) {
      throw error
    }

    const response = await client.chat.completions.create({
      ...request,
      stream: false
    })

    return {
      content: normalizeContent(response.choices[0]?.message?.content).trim(),
      mode: 'non-stream',
      response
    }
  }
}
