import OpenAI from 'openai'
import { HttpsProxyAgent } from 'https-proxy-agent'
import type { CustomApiConfig } from '../types'

const OPENAI_TIMEOUT = parseInt(process.env.OPENAI_TIMEOUT || '600000', 10)

interface OpenAIBaseConfig {
  timeout: number
  defaultHeaders: {
    'User-Agent': string
  }
}

function getProxyUrl(apiUrl: string): string | undefined {
  const protocol = new URL(apiUrl).protocol

  if (protocol === 'http:') {
    return process.env.HTTP_PROXY || process.env.http_proxy || process.env.HTTPS_PROXY || process.env.https_proxy
  }

  return process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy
}

function createBaseConfig(): OpenAIBaseConfig {
  return {
    timeout: OPENAI_TIMEOUT,
    defaultHeaders: {
      'User-Agent': 'ManimCat/1.0'
    }
  }
}

export function createCustomOpenAIClient(config: CustomApiConfig): OpenAI {
  const apiUrl = (config.apiUrl || '').trim().replace(/\/+$/, '')
  const apiKey = (config.apiKey || '').trim()

  // Guardrail: if apiKey is missing, the OpenAI SDK may fall back to OPENAI_API_KEY env var.
  // We never want that behavior in this project: upstream must be explicitly configured per request/route.
  if (!apiUrl || !apiKey) {
    throw new Error('Upstream apiUrl/apiKey is missing')
  }

  const proxyUrl = getProxyUrl(apiUrl)
  const httpAgent = proxyUrl ? createProxyAgent(proxyUrl) : undefined

  return new OpenAI({
    ...createBaseConfig(),
    ...(httpAgent ? { httpAgent } : {}),
    baseURL: apiUrl,
    apiKey
  })
}

function createProxyAgent(proxyUrl: string): unknown {
  return new HttpsProxyAgent(proxyUrl)
}
