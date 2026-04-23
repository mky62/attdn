import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, LoaderCircle, Mic, Square, Volume2 } from 'lucide-react';
import { deleteSetting, getSetting, setSetting } from '../lib/settings';
import { sendOpenRouterText } from '../lib/openrouter';
import { startVoiceCapture, speak, stopSpeaking, type VoiceCaptureResult } from '../lib/voice';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type VoiceState = 'idle' | 'recording' | 'thinking' | 'speaking';

const SYSTEM_PROMPT = `You are a warm, natural voice companion.
Talk like a real person.
Understand both English and Hindi.
Reply in the same language the user used, unless they explicitly ask otherwise.
Keep replies short, spoken, and conversational.
Do not use markdown tables.
Do not act like an attendance app.
Just have a natural voice conversation.`;

export default function VoiceAssistant() {
  const messageIdRef = useRef(1);
  const captureRef = useRef<{ stop: () => void } | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'assistant-0',
      role: 'assistant',
      content: 'Hi. Talk to me in English or Hindi.',
    },
  ]);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [status, setStatus] = useState('Ready');
  const [error, setError] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const currentKey = await getSetting('openrouter_api_key');
      if (!cancelled) {
        setApiKey(currentKey || '');
      }
    })();

    return () => {
      cancelled = true;
      captureRef.current?.stop();
      stopSpeaking();
    };
  }, []);

  const hasApiKey = useMemo(() => apiKey.trim().length > 0, [apiKey]);

  const nextMessageId = (role: Message['role']) => {
    const nextId = `${role}-${messageIdRef.current}`;
    messageIdRef.current += 1;
    return nextId;
  };

  const saveApiKey = async (value = apiKey) => {
    try {
      const trimmedValue = value.trim();
      if (trimmedValue) {
        await setSetting('openrouter_api_key', trimmedValue);
      } else {
        await deleteSetting('openrouter_api_key');
      }

      setApiKey(trimmedValue);
      setApiKeySaved(true);
      window.setTimeout(() => setApiKeySaved(false), 1800);
      setError('');
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof Error ? saveError.message : 'Unable to save the API key.');
    }
  };

  const submitTranscript = async (transcript: string) => {
    const trimmedTranscript = transcript.trim();
    if (!trimmedTranscript) {
      setError('No speech captured.');
      setStatus('Ready');
      setVoiceState('idle');
      return;
    }

    stopSpeaking();
    setError('');
    setStatus('Thinking');
    setVoiceState('thinking');

    const userMessage: Message = {
      id: nextMessageId('user'),
      role: 'user',
      content: trimmedTranscript,
    };

    const history = [...messages, userMessage];
    setMessages(history);

    try {
      const reply = await sendOpenRouterText([
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ], {
        temperature: 0.6,
        maxTokens: 320,
      });

      const assistantMessage: Message = {
        id: nextMessageId('assistant'),
        role: 'assistant',
        content: reply,
      };

      setMessages((current) => [...current, assistantMessage]);
      setStatus('Speaking');
      setVoiceState('speaking');
      await speak(reply);
      setStatus('Ready');
      setVoiceState('idle');
    } catch (submitError) {
      console.error(submitError);
      setError(submitError instanceof Error ? submitError.message : 'Voice conversation failed.');
      setStatus('Ready');
      setVoiceState('idle');
    }
  };

  const handleCaptureResult = async (result: VoiceCaptureResult) => {
    captureRef.current = null;

    if (result.error) {
      setError(result.error);
      setStatus('Ready');
      setVoiceState('idle');
      return;
    }

    await submitTranscript(result.transcript);
  };

  const startRecording = async () => {
    if (!hasApiKey) {
      setError('Add and save an OpenRouter API key first.');
      return;
    }

    setError('');
    setStatus('Recording, tap again to send');
    setVoiceState('recording');

    try {
      const capture = await startVoiceCapture((result) => {
        void handleCaptureResult(result);
      }, 12000);
      captureRef.current = capture;
    } catch (captureError) {
      console.error(captureError);
      setError(captureError instanceof Error ? captureError.message : 'Unable to start voice capture.');
      setStatus('Ready');
      setVoiceState('idle');
    }
  };

  const handleVoiceButton = async () => {
    if (voiceState === 'recording') {
      captureRef.current?.stop();
      return;
    }

    if (voiceState === 'speaking') {
      stopSpeaking();
      setStatus('Ready');
      setVoiceState('idle');
      return;
    }

    if (voiceState === 'thinking') {
      return;
    }

    await startRecording();
  };

  return (
    <main className="voice-shell">
      <section className="voice-top">
        <div>
          <p className="voice-kicker">Voice Companion</p>
          <h1 className="voice-title">Just talk.</h1>
          <p className="voice-copy">
            English and Hindi supported. Tap once to start, tap again to send.
          </p>
        </div>
        <div className="voice-status-pill">
          <Volume2 size={16} />
          <span>{status}</span>
        </div>
      </section>

      <section className="voice-key-card">
        <div>
          <p className="voice-key-kicker">OpenRouter</p>
          <h2 className="voice-key-title">API key</h2>
        </div>
        <div className="voice-key-controls">
          <input
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="sk-or-..."
            className="voice-key-input"
          />
          <button type="button" onClick={() => setShowApiKey((current) => !current)} className="voice-key-btn">
            {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
            {showApiKey ? 'Hide' : 'Show'}
          </button>
          <button type="button" onClick={() => void saveApiKey()} className="voice-primary-btn">
            {apiKeySaved ? 'Saved' : 'Save Key'}
          </button>
        </div>
      </section>

      <section className="voice-center">
        <button
          type="button"
          onClick={() => void handleVoiceButton()}
          className={`voice-orb ${voiceState}`}
          disabled={voiceState === 'thinking'}
          aria-label="Voice conversation button"
        >
          {voiceState === 'thinking' ? (
            <LoaderCircle size={48} className="animate-spin" />
          ) : voiceState === 'recording' ? (
            <Square size={44} />
          ) : (
            <Mic size={48} />
          )}
        </button>
      </section>

      {error && <section className="voice-error">{error}</section>}

      <section className="voice-log">
        {messages.map((message) => (
          <article key={message.id} className={`voice-bubble ${message.role}`}>
            <p className="voice-bubble-role">{message.role === 'assistant' ? 'Assistant' : 'You'}</p>
            <p>{message.content}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
