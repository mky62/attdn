// Voice system: TTS + Speech Recognition with fallback to manual

type StatusHandler = (status: 'present' | 'absent' | 'unknown' | 'silence') => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let recognition: any = null;

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

export function speakStudentName(name: string): Promise<void> {
  return speak(name, 0.85);
}

export function repeatStudentName(name: string): Promise<void> {
  return speak(name, 0.75);
}

// ── Speech Recognition ──────────────────────────────────────────────────

const PRESENT_WORDS = ['present', 'yes', 'here', 'yeah', 'yep', 'hai', 'haan', 'present mam', 'present sir'];
const ABSENT_WORDS = ['absent', 'not here', 'gone', 'nahi', 'absent mam', 'absent sir'];

function interpretResponse(transcript: string): 'present' | 'absent' | 'unknown' {
  const lower = transcript.toLowerCase().trim();
  for (const word of PRESENT_WORDS) {
    if (lower.includes(word)) return 'present';
  }
  for (const word of ABSENT_WORDS) {
    if (lower.includes(word)) return 'absent';
  }
  return 'unknown';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSpeechRecognition(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
}

export function startListening(
  onResult: StatusHandler,
  silenceTimeout = 4000,
): { stop: () => void } {
  const SpeechRecognitionCtor = getSpeechRecognition();
  if (!SpeechRecognitionCtor) {
    const timer = setTimeout(() => onResult('silence'), silenceTimeout);
    return { stop: () => clearTimeout(timer) };
  }

  recognition = new SpeechRecognitionCtor();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-IN';
  recognition.maxAlternatives = 3;

  let resolved = false;
  let silenceTimer: ReturnType<typeof setTimeout>;

  const cleanup = () => {
    resolved = true;
    clearTimeout(silenceTimer);
    try { recognition?.stop(); } catch { /* ignore */ }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recognition.onresult = (event: any) => {
    if (resolved) return;
    const transcript = event.results[0][0].transcript;
    const status = interpretResponse(transcript);
    cleanup();
    onResult(status);
  };

  recognition.onerror = () => {
    if (resolved) return;
    cleanup();
    onResult('silence');
  };

  recognition.onend = () => {
    if (resolved) return;
    cleanup();
    onResult('silence');
  };

  silenceTimer = setTimeout(() => {
    if (resolved) return;
    cleanup();
    onResult('silence');
  }, silenceTimeout);

  try {
    recognition.start();
  } catch {
    clearTimeout(silenceTimer);
    setTimeout(() => onResult('silence'), silenceTimeout);
  }

  return {
    stop: cleanup,
  };
}

export function stopListening(): void {
  try { recognition?.stop(); } catch { /* ignore */ }
  recognition = null;
}

// ── Full Roll Call Step ─────────────────────────────────────────────────

export async function callStudent(
  studentName: string,
  onResult: StatusHandler,
  silenceTimeout = 4000,
  useVoiceInput = true,
): Promise<{ stop: () => void }> {
  await speakStudentName(studentName);

  if (!useVoiceInput) {
    return { stop: () => {} };
  }

  const listener = startListening(onResult, silenceTimeout);
  return listener;
}
