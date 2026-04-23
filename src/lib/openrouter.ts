import { getSetting } from './settings';

const OPENROUTER_PRIMARY_TEXT_MODEL =
  import.meta.env.VITE_OPENROUTER_PRIMARY_TEXT_MODEL?.trim() || 'z-ai/glm-4.5-air:free';
const OPENROUTER_FALLBACK_TEXT_MODEL =
  import.meta.env.VITE_OPENROUTER_FALLBACK_TEXT_MODEL?.trim() || 'meta-llama/llama-3.3-70b-instruct:free';

type ChatRole = 'system' | 'user' | 'assistant';

export interface OpenRouterTextMessage {
  role: ChatRole;
  content: string;
}

type OpenRouterPayload = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type OpenRouterRequestOptions = {
  temperature?: number;
  maxTokens?: number;
};

class OpenRouterRequestError extends Error {
  readonly status?: number;
  readonly retryable: boolean;
  readonly kind: 'config' | 'auth' | 'upstream';

  constructor(message: string, options: {
    status?: number;
    retryable: boolean;
    kind: 'config' | 'auth' | 'upstream';
  }) {
    super(message);
    this.name = 'OpenRouterRequestError';
    this.status = options.status;
    this.retryable = options.retryable;
    this.kind = options.kind;
  }
}

function extractApiErrorMessage(payloadText: string): string {
  try {
    const parsed = JSON.parse(payloadText) as {
      error?: { message?: unknown };
      message?: unknown;
    };

    if (typeof parsed?.error?.message === 'string' && parsed.error.message.trim()) {
      return parsed.error.message.trim();
    }

    if (typeof parsed?.message === 'string' && parsed.message.trim()) {
      return parsed.message.trim();
    }
  } catch {
    // Fall back to raw text when the body is not JSON.
  }

  return payloadText.trim();
}

async function getApiKey(): Promise<string> {
  const apiKey = await getSetting('openrouter_api_key');
  if (!apiKey) {
    throw new OpenRouterRequestError('OpenRouter API key is missing.', {
      retryable: false,
      kind: 'config',
    });
  }

  return apiKey;
}

function formatAuthError(): string {
  return 'OpenRouter authentication failed. Check the configured API key.';
}

function formatUnavailableError(): string {
  return 'Text conversation models are temporarily unavailable. GLM failed and Meta Llama fallback also failed.';
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

async function requestModel(
  model: string,
  messages: OpenRouterTextMessage[],
  options: OpenRouterRequestOptions,
): Promise<string> {
  const apiKey = await getApiKey();

  let response: Response;
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 500,
        messages,
      }),
    });
  } catch {
    throw new OpenRouterRequestError(`Text request to ${model} failed before a response was received.`, {
      retryable: true,
      kind: 'upstream',
    });
  }

  if (!response.ok) {
    const payloadText = await response.text();
    const message = extractApiErrorMessage(payloadText);

    if (response.status === 401 || response.status === 403) {
      throw new OpenRouterRequestError(formatAuthError(), {
        status: response.status,
        retryable: false,
        kind: 'auth',
      });
    }

    throw new OpenRouterRequestError(message || `Text request to ${model} failed.`, {
      status: response.status,
      retryable: isRetryableStatus(response.status),
      kind: 'upstream',
    });
  }

  const payload = await response.json() as OpenRouterPayload;
  const content = payload.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new OpenRouterRequestError(`Text request to ${model} returned no content.`, {
      retryable: true,
      kind: 'upstream',
    });
  }

  return content;
}

export async function sendOpenRouterText(
  messages: OpenRouterTextMessage[],
  options: OpenRouterRequestOptions = {},
): Promise<string> {
  try {
    return await requestModel(OPENROUTER_PRIMARY_TEXT_MODEL, messages, options);
  } catch (primaryError) {
    if (!(primaryError instanceof OpenRouterRequestError)) {
      throw primaryError;
    }

    if (!primaryError.retryable) {
      throw new Error(primaryError.message);
    }

    try {
      return await requestModel(OPENROUTER_FALLBACK_TEXT_MODEL, messages, options);
    } catch (fallbackError) {
      if (fallbackError instanceof OpenRouterRequestError && !fallbackError.retryable) {
        throw new Error(fallbackError.message);
      }

      throw new Error(formatUnavailableError());
    }
  }
}
