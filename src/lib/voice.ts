import { getSetting } from './settings';

type AttendanceStatus = 'present' | 'absent' | 'unknown' | 'silence';
type ListenMode = 'browser' | 'ai' | 'manual';

export interface AttendanceListenResult {
  status: AttendanceStatus;
  mode: ListenMode;
  transcript?: string;
  error?: string;
}

type ResultHandler = (result: AttendanceListenResult) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let recognition: any = null;

const OPENROUTER_AUDIO_MODEL =
  import.meta.env.VITE_OPENROUTER_AUDIO_MODEL?.trim() || 'openai/gpt-4o';
const FORCE_AI_VOICE = import.meta.env.VITE_FORCE_AI_VOICE === 'true';

// ── Text-to-Speech ──────────────────────────────────────────────────────

export function speak(text: string, rate = 0.9): Promise<void> {
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

function buildAttendancePrompt(name: string): string {
  return `${name}, attendance check. Please say present or absent.`;
}

function buildRepeatAttendancePrompt(name: string): string {
  return `${name}, I only need present or absent. Please say present or absent.`;
}

export function speakStudentName(name: string): Promise<void> {
  return speak(buildAttendancePrompt(name), 0.88);
}

export function repeatStudentName(name: string): Promise<void> {
  return speak(buildRepeatAttendancePrompt(name), 0.82);
}

// ── Shared Helpers ──────────────────────────────────────────────────────

const PRESENT_WORDS = ['present', 'yes', 'here', 'yeah', 'yep', 'hai', 'haan', 'present mam', 'present sir'];
const ABSENT_WORDS = ['absent', 'not here', 'gone', 'nahi', 'absent mam', 'absent sir'];

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function transcriptMatchesStudent(transcript: string, expectedStudentName: string): boolean {
  const normalizedTranscript = normalizeName(transcript);
  const normalizedExpected = normalizeName(expectedStudentName);

  if (!normalizedTranscript || !normalizedExpected) {
    return false;
  }

  if (normalizedTranscript.includes(normalizedExpected)) {
    return true;
  }

  const transcriptTokens = normalizedTranscript.split(' ');
  const expectedTokens = normalizedExpected.split(' ').filter((token) => token.length > 1);
  if (expectedTokens.length === 0) {
    return false;
  }

  const matchedTokens = expectedTokens.filter((token) => transcriptTokens.includes(token));
  if (matchedTokens.length === expectedTokens.length) {
    return true;
  }

  if (expectedTokens.length > 1 && matchedTokens.length >= Math.max(1, expectedTokens.length - 1)) {
    return true;
  }

  return expectedTokens.some((token) => token.length >= 3 && normalizedTranscript.includes(token));
}

function interpretResponse(transcript: string, expectedStudentName: string): AttendanceStatus {
  const lower = transcript.toLowerCase().trim();
  if (!lower) {
    return 'silence';
  }

  if (transcriptMatchesStudent(transcript, expectedStudentName)) {
    return 'present';
  }

  for (const word of PRESENT_WORDS) {
    if (lower.includes(word)) return 'present';
  }

  for (const word of ABSENT_WORDS) {
    if (lower.includes(word)) return 'absent';
  }

  return 'unknown';
}

function resolveTranscript(content: unknown): string {
  if (typeof content === 'string') {
    return content;
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
    // Fall back to the raw text below when the body is not JSON.
  }

  return payloadText.trim();
}

function formatAiRequestError(status: number, payloadText: string): string {
  const apiMessage = extractApiErrorMessage(payloadText);

  if (status === 401 || status === 403) {
    return 'AI fallback authentication failed. Check the OpenRouter API key in Settings.';
  }

  if (status === 429) {
    return 'AI fallback rate limit reached. Try again shortly or mark manually.';
  }

  if (status >= 500) {
    return 'AI fallback is temporarily unavailable. Mark manually or try again.';
  }

  return apiMessage || 'AI recognition request failed.';
}

async function getOptionalApiKey(): Promise<string | null> {
  try {
    return getSetting('openrouter_api_key');
  } catch {
    return null;
  }
}

function formatRecognitionError(errorCode: string): string {
  switch (errorCode) {
    case 'not-allowed':
      return 'Microphone permission was denied.';
    case 'service-not-allowed':
      return 'Browser speech recognition service is blocked in this browser.';
    case 'audio-capture':
      return 'No microphone audio could be captured.';
    case 'network':
      return 'Browser speech recognition network service failed.';
    case 'language-not-supported':
      return 'The browser speech-recognition language is not supported.';
    default:
      return errorCode
        ? `Microphone recognition failed (${errorCode}).`
        : 'Microphone recognition failed.';
  }
}

export async function getVoiceCapabilities(): Promise<{
  browserRecognitionAvailable: boolean;
  aiFallbackAvailable: boolean;
}> {
  return {
    browserRecognitionAvailable: !FORCE_AI_VOICE && Boolean(getSpeechRecognition()),
    aiFallbackAvailable: Boolean(await getOptionalApiKey()),
  };
}

export async function ensureMicrophoneAccess(): Promise<boolean> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return false;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch {
    return false;
  }
}

// ── Browser Speech Recognition ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSpeechRecognition(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
}

function startBrowserListening(
  onResult: ResultHandler,
  silenceTimeout: number,
  expectedStudentName: string,
): { stop: () => void; mode: ListenMode } {
  const SpeechRecognitionCtor = getSpeechRecognition();
  if (!SpeechRecognitionCtor) {
    const timer = setTimeout(
      () => onResult({ status: 'silence', mode: 'manual', error: 'Browser speech recognition is unavailable.' }),
      silenceTimeout,
    );

    return {
      stop: () => clearTimeout(timer),
      mode: 'manual',
    };
  }

  recognition = new SpeechRecognitionCtor();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-IN';
  recognition.maxAlternatives = 3;

  let resolved = false;
  const deadline = Date.now() + silenceTimeout;
  let restartTimer: number | null = null;

  const silenceTimer = setTimeout(() => {
    if (resolved) return;
    cleanup();
    onResult({ status: 'silence', mode: 'browser' });
  }, silenceTimeout);

  const scheduleRestart = () => {
    if (resolved) return;

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      cleanup();
      onResult({ status: 'silence', mode: 'browser' });
      return;
    }

    if (restartTimer !== null) {
      window.clearTimeout(restartTimer);
    }

    restartTimer = window.setTimeout(() => {
      restartTimer = null;
      tryStartRecognition();
    }, Math.min(250, remainingMs));
  };

  const cleanup = () => {
    resolved = true;
    clearTimeout(silenceTimer);
    if (restartTimer !== null) {
      window.clearTimeout(restartTimer);
      restartTimer = null;
    }
    try {
      recognition?.stop();
    } catch {
      // Ignore browser stop errors.
    }
  };

  const tryStartRecognition = () => {
    if (resolved) return;

    try {
      recognition.start();
    } catch {
      scheduleRestart();
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recognition.onresult = (event: any) => {
    if (resolved) return;
    const transcript = event.results?.[0]?.[0]?.transcript ?? '';
    cleanup();
    onResult({
      status: interpretResponse(transcript, expectedStudentName),
      mode: 'browser',
      transcript,
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recognition.onerror = (event: any) => {
    if (resolved) return;

    const errorCode = String(event?.error ?? '');
    if (errorCode === 'no-speech' || errorCode === 'aborted') {
      scheduleRestart();
      return;
    }

    cleanup();
    onResult({
      status: 'silence',
      mode: 'browser',
      error: formatRecognitionError(errorCode),
    });
  };

  recognition.onend = () => {
    if (resolved) return;
    scheduleRestart();
  };

  tryStartRecognition();

  return {
    stop: cleanup,
    mode: 'browser',
  };
}

// ── AI Fallback Recording ───────────────────────────────────────────────

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

async function recordWavSnippet(durationMs: number): Promise<string> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  const muteNode = audioContext.createGain();
  const chunks: Float32Array[] = [];

  muteNode.gain.value = 0;
  source.connect(processor);
  processor.connect(muteNode);
  muteNode.connect(audioContext.destination);

  processor.onaudioprocess = (event) => {
    const channel = event.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(channel));
  };

  await new Promise((resolve) => window.setTimeout(resolve, durationMs));

  processor.disconnect();
  source.disconnect();
  muteNode.disconnect();
  stream.getTracks().forEach((track) => track.stop());
  await audioContext.close();

  if (chunks.length === 0) {
    return '';
  }

  const wavBytes = encodeWav(chunks, audioContext.sampleRate);
  return bytesToBase64(wavBytes);
}

async function classifyWithAi(
  apiKey: string,
  audioBase64: string,
  expectedStudentName: string,
): Promise<AttendanceListenResult> {
  if (!audioBase64) {
    return {
      status: 'silence',
      mode: 'ai',
      error: 'No audio captured.',
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
      max_tokens: 32,
      messages: [
        {
          role: 'system',
          content:
            `You are a class attendance assistant acting like a teacher. The expected student name is "${expectedStudentName}". Listen to the audio and decide whether the speaker identifies as that student. Do not greet back, do not answer questions, and do not have a conversation. If the speaker says hello, asks a question, chats, or says anything unrelated to attendance, classify it as "unknown" unless they also clearly say present or absent for the expected student. Return status "present" only when the spoken response confidently matches the expected student name or clearly confirms presence for that student. Return "absent" only for a clear absence response. Return "unknown" for noise, another name, weak match, ambiguity, greetings, or questions. Return "silence" for no speech. Reply exactly in the format "status: <present|absent|unknown|silence>; transcript: <what you heard>".`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Classify this attendance response for expected student ${expectedStudentName}.`,
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
    throw new Error(formatAiRequestError(response.status, payloadText));
  }

  const payload = await response.json();
  const rawContent = resolveTranscript(payload?.choices?.[0]?.message?.content);
  const normalized = rawContent.toLowerCase();

  const transcriptMatch = rawContent.match(/transcript:\s*(.+)$/i);
  const transcript = transcriptMatch?.[1]?.trim() || rawContent.trim();

  let status: AttendanceStatus = 'unknown';
  if (normalized.includes('status: present')) {
    status = 'present';
  } else if (normalized.includes('status: absent')) {
    status = 'absent';
  } else if (normalized.includes('status: silence')) {
    status = 'silence';
  } else if (normalized.includes('status: unknown')) {
    status = 'unknown';
  } else {
    status = interpretResponse(rawContent, expectedStudentName);
  }

  return {
    status,
    mode: 'ai',
    transcript,
  };
}

async function startAiListening(
  onResult: ResultHandler,
  silenceTimeout: number,
  expectedStudentName: string,
  apiKeyOverride?: string,
): Promise<{ stop: () => void; mode: ListenMode }> {
  const apiKey = apiKeyOverride ?? await getOptionalApiKey();
  if (!apiKey) {
    window.setTimeout(
      () => onResult({ status: 'silence', mode: 'manual', error: 'AI fallback is not configured.' }),
      0,
    );

    return {
      stop: () => {},
      mode: 'manual',
    };
  }

  let cancelled = false;

  void (async () => {
    try {
      const audioBase64 = await recordWavSnippet(silenceTimeout);
      if (cancelled) return;

      const result = await classifyWithAi(apiKey, audioBase64, expectedStudentName);
      if (cancelled) return;
      onResult(result);
    } catch (error) {
      if (cancelled) return;
      onResult({
        status: 'silence',
        mode: 'ai',
        error: error instanceof Error ? error.message : 'AI listening failed.',
      });
    }
  })();

  return {
    stop: () => {
      cancelled = true;
    },
    mode: 'ai',
  };
}

// ── Public Listening API ────────────────────────────────────────────────

export async function startListening(
  onResult: ResultHandler,
  expectedStudentName: string,
  silenceTimeout = 4000,
): Promise<{ stop: () => void; mode: ListenMode }> {
  const apiKey = await getOptionalApiKey();

  if (!FORCE_AI_VOICE && getSpeechRecognition()) {
    let activeStop = () => {};
    let currentMode: ListenMode = 'browser';
    let stopped = false;

    const browserListener = startBrowserListening(async (result) => {
      if (stopped) return;

      if (result.error && apiKey) {
        currentMode = 'ai';
        const aiListener = await startAiListening(onResult, silenceTimeout, expectedStudentName, apiKey);
        activeStop = aiListener.stop;
        return;
      }

      onResult(result);
    }, silenceTimeout, expectedStudentName);

    activeStop = browserListener.stop;

    return {
      stop: () => {
        stopped = true;
        activeStop();
      },
      get mode() {
        return currentMode;
      },
    };
  }

  return startAiListening(onResult, silenceTimeout, expectedStudentName, apiKey ?? undefined);
}

export function stopListening(): void {
  try {
    recognition?.stop();
  } catch {
    // Ignore browser stop errors.
  }
  recognition = null;
}

// ── Full Roll Call Step ─────────────────────────────────────────────────

export async function callStudent(
  studentName: string,
  onResult: ResultHandler,
  silenceTimeout = 4000,
  useVoiceInput = true,
): Promise<{ stop: () => void; mode: ListenMode }> {
  await speakStudentName(studentName);

  if (!useVoiceInput) {
    return { stop: () => {}, mode: 'manual' };
  }

  return startListening(onResult, studentName, silenceTimeout);
}
