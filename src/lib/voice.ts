const OPENROUTER_AUDIO_MODEL =
  import.meta.env.VITE_OPENROUTER_AUDIO_MODEL?.trim() || 'openai/gpt-4o';

export interface VoiceCaptureResult {
  transcript: string;
  error?: string;
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
    // Fall back to raw text below.
  }

  return payloadText.trim();
}

function formatAudioError(status: number, payloadText: string): string {
  const apiMessage = extractApiErrorMessage(payloadText);

  if (status === 401 || status === 403) {
    return 'Voice authentication failed. Check the configured OpenRouter API key.';
  }

  if (status === 429) {
    return 'Voice transcription is rate limited right now. Try again in a moment.';
  }

  if (status >= 500) {
    return 'Voice transcription is temporarily unavailable.';
  }

  return apiMessage || 'Voice transcription failed.';
}

function resolveTranscript(content: unknown): string {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map((item) => {
      if (typeof item === 'string') {
        return item;
      }

      if (item && typeof item === 'object') {
        const maybeItem = item as { text?: unknown; type?: unknown };
        if (typeof maybeItem.text === 'string') {
          return maybeItem.text;
        }
        if (maybeItem.type === 'output_text' && typeof maybeItem.text === 'string') {
          return maybeItem.text;
        }
      }

      return '';
    })
    .join(' ')
    .trim();
}

export function speak(text: string, rate = 0.95): Promise<void> {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      resolve();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = 1;
    utterance.volume = 1;

    const normalized = text.trim();
    utterance.lang = /[\u0900-\u097F]/.test(normalized) ? 'hi-IN' : 'en-IN';

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

export function stopSpeaking(): void {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array): number {
  let nextOffset = offset;
  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index]));
    output.setInt16(nextOffset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    nextOffset += 2;
  }
  return nextOffset;
}

function encodeWav(buffers: Float32Array[], sampleRate: number): Uint8Array {
  const totalSamples = buffers.reduce((count, buffer) => count + buffer.length, 0);
  const dataSize = totalSamples * 2;
  const wavBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wavBuffer);

  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let dataOffset = 44;
  for (const chunk of buffers) {
    dataOffset = floatTo16BitPCM(view, dataOffset, chunk);
  }

  return new Uint8Array(wavBuffer);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

async function transcribeSpeech(apiKey: string, audioBase64: string): Promise<VoiceCaptureResult> {
  if (!audioBase64) {
    return {
      transcript: '',
      error: 'No speech captured.',
    };
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENROUTER_AUDIO_MODEL,
      temperature: 0,
      max_tokens: 160,
      messages: [
        {
          role: 'system',
          content:
            'Transcribe the spoken audio accurately. The speaker may use English, Hindi, or a mix of both. Return only the transcript text. If there is no intelligible speech, return exactly NO_SPEECH.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Transcribe this speech.',
            },
            {
              type: 'input_audio',
              inputAudio: {
                data: audioBase64,
                format: 'wav',
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const payloadText = await response.text();
    throw new Error(formatAudioError(response.status, payloadText));
  }

  const payload = await response.json();
  const transcript = resolveTranscript(payload?.choices?.[0]?.message?.content);

  if (!transcript || transcript === 'NO_SPEECH') {
    return {
      transcript: '',
      error: 'No speech captured.',
    };
  }

  return { transcript };
}

export async function startVoiceCapture(
  onResult: (result: VoiceCaptureResult) => void,
  timeoutMs = 12000,
): Promise<{ stop: () => void }> {
  const apiKey = window.localStorage.getItem('attdn.settings')
    ? (() => {
        try {
          const parsed = JSON.parse(window.localStorage.getItem('attdn.settings') || '{}') as Record<string, string>;
          return parsed.openrouter_api_key?.trim() || import.meta.env.VITE_OPENROUTER_API_KEY?.trim() || '';
        } catch {
          return import.meta.env.VITE_OPENROUTER_API_KEY?.trim() || '';
        }
      })()
    : import.meta.env.VITE_OPENROUTER_API_KEY?.trim() || '';

  if (!apiKey) {
    throw new Error('OpenRouter API key is missing.');
  }

  const audioContext = new AudioContext();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  const muteNode = audioContext.createGain();
  const chunks: Float32Array[] = [];
  let resolved = false;

  muteNode.gain.value = 0;
  source.connect(processor);
  processor.connect(muteNode);
  muteNode.connect(audioContext.destination);

  processor.onaudioprocess = (event) => {
    const channel = event.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(channel));
  };

  const cleanup = async () => {
    processor.disconnect();
    source.disconnect();
    muteNode.disconnect();
    stream.getTracks().forEach((track) => track.stop());
    await audioContext.close();
  };

  const finalize = async () => {
    if (resolved) {
      return;
    }

    resolved = true;
    window.clearTimeout(timeoutHandle);

    try {
      const wavBytes = chunks.length > 0
        ? encodeWav(chunks, audioContext.sampleRate)
        : new Uint8Array();
      await cleanup();
      const result = await transcribeSpeech(apiKey, wavBytes.length > 0 ? bytesToBase64(wavBytes) : '');
      onResult(result);
    } catch (error) {
      onResult({
        transcript: '',
        error: error instanceof Error ? error.message : 'Voice capture failed.',
      });
    }
  };

  const timeoutHandle = window.setTimeout(() => {
    void finalize();
  }, timeoutMs);

  return {
    stop: () => {
      void finalize();
    },
  };
}
