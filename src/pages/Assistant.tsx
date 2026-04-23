import { useEffect, useRef, useState } from 'react';
import { Bot, LoaderCircle, Send, Sparkles, User } from 'lucide-react';
import { loadTeacherAssistantContext, sendTeacherAssistantMessage, type TeacherAssistantContext } from '../lib/assistant';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const starterPrompts = [
  'Summarize the latest attendance for this class.',
  'Which students are below 75% attendance?',
  'How many sessions have been recorded for this class?',
  'Who was absent in the latest session?',
];

export default function Assistant() {
  const messageIdRef = useRef(1);
  const [context, setContext] = useState<TeacherAssistantContext | null>(null);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'assistant-welcome',
      role: 'assistant',
      content: 'Ask about attendance, class trends, absentees, or low-attendance students.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loadingContext, setLoadingContext] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const nextContext = await loadTeacherAssistantContext();
        if (cancelled) return;

        setContext(nextContext);
        if (nextContext.selectedClass) {
          setSelectedClassId(nextContext.selectedClass.id);
        }
      } catch (contextError) {
        if (cancelled) return;
        console.error(contextError);
        setError('Unable to load assistant context.');
      }

      if (!cancelled) {
        setLoadingContext(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const nextMessageId = (prefix: 'user' | 'assistant') => {
    const nextId = `${prefix}-${messageIdRef.current}`;
    messageIdRef.current += 1;
    return nextId;
  };

  const refreshContext = async (nextClassId: string) => {
    setLoadingContext(true);
    setError('');

    try {
      const nextContext = await loadTeacherAssistantContext(nextClassId);
      setContext(nextContext);
      setSelectedClassId(nextClassId);
    } catch (contextError) {
      console.error(contextError);
      setError('Unable to load assistant context.');
    }

    setLoadingContext(false);
  };

  const submitMessage = async (rawMessage: string) => {
    const trimmedMessage = rawMessage.trim();
    if (!trimmedMessage || !context || sending) return;

    const userMessage: ChatMessage = {
      id: nextMessageId('user'),
      role: 'user',
      content: trimmedMessage,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setSending(true);
    setError('');

    try {
      const reply = await sendTeacherAssistantMessage(
        context,
        nextMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      );

      setMessages((current) => [
        ...current,
        {
          id: nextMessageId('assistant'),
          role: 'assistant',
          content: reply,
        },
      ]);
    } catch (sendError) {
      console.error(sendError);
      setError(sendError instanceof Error ? sendError.message : 'Assistant request failed.');
    }

    setSending(false);
  };

  return (
    <div className="page-shell max-w-6xl">
      <div className="page-header">
        <div className="page-copy">
          <p className="page-kicker">Teacher AI</p>
          <h2 className="page-title">Assistant</h2>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.4fr]">
        <section className="panel px-5 py-5 sm:px-6">
          <div className="grid gap-4">
            <div>
              <label className="page-kicker mb-2 block">Class</label>
              <select
                value={selectedClassId}
                onChange={(event) => void refreshContext(event.target.value)}
                className="select-field"
                disabled={loadingContext}
              >
                <option value="">Select a class</option>
                {context?.classes.map((currentClass) => (
                  <option key={currentClass.id} value={currentClass.id}>
                    {currentClass.name} {currentClass.section ? `— ${currentClass.section}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="metric-card">
                <p className="metric-label">Students</p>
                <p className="metric-value">{context?.students.length || 0}</p>
              </div>
              <div className="metric-card">
                <p className="metric-label">Sessions</p>
                <p className="metric-value">{context?.sessions.length || 0}</p>
              </div>
              <div className="metric-card">
                <p className="metric-label">Latest Session</p>
                <p className="metric-value text-[1.15rem] sm:text-[1.45rem]">
                  {context?.latestSession?.date || 'None'}
                </p>
              </div>
            </div>

            <div className="panel-muted rounded-[var(--radius-panel)] border border-[var(--line)] px-4 py-4">
              <p className="page-kicker">Try asking</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {starterPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => void submitMessage(prompt)}
                    disabled={!context?.selectedClass || sending || loadingContext}
                    className="tag tag-neutral"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="panel flex min-h-[38rem] flex-col overflow-hidden">
          <div className="border-b border-black/6 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles size={18} />
              </div>
              <div>
                <p className="page-kicker">Conversation</p>
                <p className="text-lg font-medium text-surface-dark">
                  {context?.selectedClass?.name || 'Select a class'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-auto px-5 py-5 sm:px-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Bot size={17} />
                  </div>
                )}

                <div
                  className={`max-w-[44rem] rounded-[var(--radius-panel)] border px-4 py-3 text-sm leading-6 ${
                    message.role === 'user'
                      ? 'border-primary/16 bg-primary/8 text-surface-dark'
                      : 'border-[var(--line)] bg-white/88 text-surface-dark'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                </div>

                {message.role === 'user' && (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black/6 text-[var(--ink-soft)]">
                    <User size={17} />
                  </div>
                )}
              </div>
            ))}

            {sending && (
              <div className="flex gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Bot size={17} />
                </div>
                <div className="flex items-center gap-2 rounded-[var(--radius-panel)] border border-[var(--line)] bg-white/88 px-4 py-3 text-sm text-[var(--ink-soft)]">
                  <LoaderCircle size={16} className="animate-spin" />
                  Thinking
                </div>
              </div>
            )}

            {!loadingContext && !context?.selectedClass && (
              <div className="empty-panel">
                Select a class to start.
              </div>
            )}
          </div>

          <div className="border-t border-black/6 px-5 py-4 sm:px-6">
            {error && (
              <div className="mb-3 rounded-[var(--radius-control)] border border-danger/18 bg-danger/8 px-3 py-2 text-sm text-danger">
                {error}
              </div>
            )}

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submitMessage(input);
              }}
              className="flex gap-3"
            >
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask about attendance, absentees, trends, or class stats"
                className="field flex-1"
                disabled={!context?.selectedClass || sending || loadingContext}
              />
              <button
                type="submit"
                className="action-btn action-btn-primary"
                disabled={!input.trim() || !context?.selectedClass || sending || loadingContext}
              >
                <Send size={16} />
                Send
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
