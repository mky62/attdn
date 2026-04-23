import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Sparkles,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import * as api from '../lib/api';
import {
  callStudent,
  ensureMicrophoneAccess,
  getVoiceCapabilities,
  repeatStudentName,
  stopListening,
  stopSpeaking,
  type AttendanceListenResult,
} from '../lib/voice';
import type { Class, Student } from '../types';

type SessionState = 'setup' | 'active' | 'paused' | 'complete';

function formatListenFailureMessage(studentName: string, errorMessage: string): string {
  const normalized = errorMessage.toLowerCase();

  if (
    normalized.includes('authentication failed')
    || normalized.includes('not configured')
    || normalized.includes('api key')
  ) {
    return `${errorMessage} Mark ${studentName} manually or update Settings.`;
  }

  return `${errorMessage} Repeat ${studentName} or mark manually.`;
}

export default function Attendance() {
  const [searchParams] = useSearchParams();
  const classIdParam = searchParams.get('classId');

  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState(classIdParam || '');
  const [students, setStudents] = useState<Student[]>([]);
  const [sessionState, setSessionState] = useState<SessionState>('setup');
  const [sessionId, setSessionId] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [records, setRecords] = useState<Map<string, string>>(new Map());
  const [useVoiceInput, setUseVoiceInput] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [silenceTimeout, setSilenceTimeout] = useState(6000);
  const [statusMessage, setStatusMessage] = useState('Ready to start attendance.');
  const [browserVoiceReady, setBrowserVoiceReady] = useState(false);
  const [aiFallbackReady, setAiFallbackReady] = useState(false);

  const listenerRef = useRef<{ stop: () => void } | null>(null);
  const advanceTimerRef = useRef<number | null>(null);
  const stepTokenRef = useRef(0);
  const sessionIdRef = useRef('');
  const runStudentStepRef = useRef<(index: number) => void | Promise<void>>(() => {});

  const today = format(new Date(), 'yyyy-MM-dd');

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  const stopCurrentInteraction = useCallback(() => {
    listenerRef.current?.stop();
    listenerRef.current = null;
    clearAdvanceTimer();
    stopListening();
    stopSpeaking();
    setIsListening(false);
  }, [clearAdvanceTimer]);

  useEffect(() => {
    api.getClasses()
      .then((loadedClasses) => {
        setClasses(loadedClasses);
        if (loadedClasses.length > 0) {
          setSelectedClassId((current) => current || loadedClasses[0].id);
        }
      })
      .catch(console.error);

    getVoiceCapabilities()
      .then((capabilities) => {
        setBrowserVoiceReady(capabilities.browserRecognitionAvailable);
        setAiFallbackReady(capabilities.aiFallbackAvailable);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const request = selectedClassId
      ? api.getStudents(selectedClassId)
      : Promise.resolve<Student[]>([]);

    request.then(setStudents).catch(console.error);
  }, [selectedClassId]);

  useEffect(() => () => {
    stopCurrentInteraction();
  }, [stopCurrentInteraction]);

  const markStudent = useCallback(async (studentId: string, status: 'present' | 'absent') => {
    if (!sessionIdRef.current) return;

    await api.markAttendance(sessionIdRef.current, studentId, status);
    setRecords((previous) => {
      const next = new Map(previous);
      next.set(studentId, status);
      return next;
    });
  }, []);

  const completeSession = useCallback(() => {
    stopCurrentInteraction();
    setSessionState('complete');
    setStatusMessage('Attendance session completed.');
  }, [stopCurrentInteraction]);

  const handleListenResult = useCallback(async (
    student: Student,
    result: AttendanceListenResult,
    nextIndex: number,
  ) => {
    setIsListening(false);

    if (result.status === 'present' || result.status === 'absent') {
      await markStudent(student.id, result.status);
    }

    const transcriptDetail = result.transcript ? ` Heard: "${result.transcript}".` : '';
    const sourceLabel = result.mode === 'ai'
      ? 'AI fallback'
      : result.mode === 'browser'
        ? 'browser mic'
        : 'manual mode';

    if (result.status === 'present') {
      setStatusMessage(`${student.name} marked present via ${sourceLabel}.${transcriptDetail}`);
    } else if (result.status === 'absent') {
      setStatusMessage(`${student.name} marked absent via ${sourceLabel}.${transcriptDetail}`);
    } else if (result.error) {
      setStatusMessage(formatListenFailureMessage(student.name, result.error));
    } else {
      setStatusMessage(`No clear response for ${student.name}.${transcriptDetail} Repeat the name or mark manually.`);
    }

    if (result.status !== 'present' && result.status !== 'absent') {
      listenerRef.current = null;
      return;
    }

    if (nextIndex >= students.length) {
      completeSession();
      return;
    }

    clearAdvanceTimer();
    advanceTimerRef.current = window.setTimeout(() => {
      setCurrentIndex(nextIndex);
      if (sessionState === 'active') {
        void runStudentStepRef.current(nextIndex);
      }
    }, 700);
  }, [clearAdvanceTimer, completeSession, markStudent, sessionState, students.length]);

  const runStudentStep = useCallback(async (index: number) => {
    stopCurrentInteraction();

    if (index >= students.length) {
      completeSession();
      return;
    }

    const student = students[index];
    if (!student) {
      completeSession();
      return;
    }

    const stepToken = stepTokenRef.current + 1;
    stepTokenRef.current = stepToken;

    setCurrentIndex(index);

    if (!voiceEnabled) {
      setStatusMessage('Voice output is off. Mark attendance manually for the selected student.');
      return;
    }

    setStatusMessage(`Calling ${student.name}...`);

    const listener = await callStudent(
      student.name,
      (result) => {
        if (stepToken !== stepTokenRef.current) return;
        void handleListenResult(student, result, index + 1);
      },
      silenceTimeout,
      useVoiceInput,
    );

    if (stepToken !== stepTokenRef.current) {
      listener.stop();
      return;
    }

    listenerRef.current = listener;

    if (!useVoiceInput) {
      setStatusMessage(`${student.name} announced. Use the Present or Absent buttons.`);
      return;
    }

    setIsListening(true);
    setStatusMessage(
      listener.mode === 'ai'
        ? `Listening for ${student.name} with AI fallback...`
        : `Listening for ${student.name}...`,
    );
  }, [completeSession, handleListenResult, silenceTimeout, stopCurrentInteraction, students, useVoiceInput, voiceEnabled]);

  useEffect(() => {
    runStudentStepRef.current = runStudentStep;
  }, [runStudentStep]);

  const startSession = async () => {
    if (!selectedClassId || students.length === 0) return;

    if (useVoiceInput) {
      const microphoneAvailable = await ensureMicrophoneAccess();
      if (!microphoneAvailable) {
        setStatusMessage('Microphone access is blocked. Allow microphone access and try again.');
        return;
      }
    }

    try {
      const nextSession = await api.getOrCreateSession(selectedClassId, today);
      sessionIdRef.current = nextSession.id;
      setSessionId(nextSession.id);

      await api.markAllAbsent(nextSession.id, selectedClassId);

      const initialRecords = new Map<string, string>();
      students.forEach((student) => initialRecords.set(student.id, 'absent'));
      setRecords(initialRecords);
      setCurrentIndex(0);
      setSessionState('active');
      setStatusMessage('Attendance session started.');
      void runStudentStep(0);
    } catch (error) {
      console.error(error);
      setStatusMessage('Unable to start attendance right now.');
    }
  };

  const moveToStudent = (index: number) => {
    if (index < 0 || index >= students.length) return;
    setCurrentIndex(index);
    if (sessionState === 'active') {
      void runStudentStep(index);
    }
  };

  const nextStudent = () => {
    stopCurrentInteraction();
    if (currentIndex + 1 < students.length) {
      moveToStudent(currentIndex + 1);
      return;
    }
    completeSession();
  };

  const prevStudent = () => {
    stopCurrentInteraction();
    if (currentIndex > 0) {
      moveToStudent(currentIndex - 1);
    }
  };

  const handleManualMark = async (status: 'present' | 'absent') => {
    const student = students[currentIndex];
    if (!student) return;

    stopCurrentInteraction();
    await markStudent(student.id, status);
    setStatusMessage(`${student.name} marked ${status}.`);

    if (currentIndex + 1 >= students.length) {
      completeSession();
      return;
    }

    clearAdvanceTimer();
    advanceTimerRef.current = window.setTimeout(() => {
      moveToStudent(currentIndex + 1);
    }, 700);
  };

  const handleRepeat = async () => {
    const student = students[currentIndex];
    if (!student || !voiceEnabled) return;

    stopCurrentInteraction();
    setStatusMessage(`Repeating ${student.name}...`);
    await repeatStudentName(student.name);

    if (sessionState === 'active') {
      setStatusMessage(`Listening for ${student.name} again...`);
      void runStudentStep(currentIndex);
    }
  };

  const togglePause = () => {
    if (sessionState === 'active') {
      stopCurrentInteraction();
      setSessionState('paused');
      setStatusMessage('Attendance paused.');
      return;
    }

    if (sessionState === 'paused') {
      setSessionState('active');
      setStatusMessage('Attendance resumed.');
      void runStudentStep(currentIndex);
    }
  };

  const resetSession = () => {
    stopCurrentInteraction();
    setSessionState('setup');
    setCurrentIndex(0);
    setRecords(new Map());
    setSessionId('');
    sessionIdRef.current = '';
    setStatusMessage('Ready to start attendance.');
  };

  const selectedClass = classes.find((item) => item.id === selectedClassId);
  const currentStudent = students[currentIndex];
  const presentCount = Array.from(records.values()).filter((status) => status === 'present').length;
  const absentCount = Array.from(records.values()).filter((status) => status === 'absent').length;
  const progressWidth = students.length > 0 ? ((currentIndex + 1) / students.length) * 100 : 0;

  if (sessionState === 'setup') {
    return (
      <div className="page-shell max-w-5xl">
        <div className="page-header">
          <div className="page-copy">
            <p className="page-kicker">Live Session</p>
            <h2 className="page-title">Configure the attendance run.</h2>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="panel px-5 py-5 sm:px-6">
            <div className="mt-4 grid gap-4">
              <div>
                <label className="page-kicker mb-2 block">Class</label>
                <select
                  value={selectedClassId}
                  onChange={(event) => setSelectedClassId(event.target.value)}
                  className="select-field"
                >
                  <option value="">Select a class</option>
                  {classes.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name} {course.section ? `— ${course.section}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="page-kicker mb-2 block">Date</label>
                <input type="date" value={today} readOnly className="field" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => setVoiceEnabled((current) => !current)}
                  className={`flex items-center justify-between rounded-[1.1rem] border px-4 py-4 text-left transition-colors ${
                    voiceEnabled
                      ? 'border-primary/20 bg-primary/8'
                      : 'border-[var(--line)] bg-white/58'
                  }`}
                >
                  <div>
                    <p className="page-kicker">Voice Output</p>
                    <p className="mt-1 text-base font-bold tracking-[-0.03em] text-surface-dark">
                      Text to speech
                    </p>
                  </div>
                  {voiceEnabled ? <Volume2 size={20} className="text-primary" /> : <VolumeX size={20} className="text-[var(--ink-faint)]" />}
                </button>

                <button
                  onClick={() => setUseVoiceInput((current) => !current)}
                  className={`flex items-center justify-between rounded-[1.1rem] border px-4 py-4 text-left transition-colors ${
                    useVoiceInput
                      ? 'border-primary/20 bg-primary/8'
                      : 'border-[var(--line)] bg-white/58'
                  }`}
                >
                  <div>
                    <p className="page-kicker">Voice Input</p>
                    <p className="mt-1 text-base font-bold tracking-[-0.03em] text-surface-dark">
                      Recognition
                    </p>
                  </div>
                  {useVoiceInput ? <Mic size={20} className="text-primary" /> : <MicOff size={20} className="text-[var(--ink-faint)]" />}
                </button>
              </div>

              {useVoiceInput && (
                <div className="rounded-[1.1rem] border border-[var(--line)] bg-white/70 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="page-kicker">Silence Timeout</p>
                      <p className="mt-1 text-base font-bold tracking-[-0.03em] text-surface-dark">
                        {(silenceTimeout / 1000).toFixed(1)} seconds
                      </p>
                    </div>
                    <span className="tag tag-neutral">Listening Window</span>
                  </div>
                  <input
                    type="range"
                    min={2000}
                    max={8000}
                    step={500}
                    value={silenceTimeout}
                    onChange={(event) => setSilenceTimeout(Number(event.target.value))}
                    className="mt-4 w-full accent-[var(--accent)]"
                  />
                </div>
              )}

              <button
                onClick={startSession}
                disabled={!selectedClassId || students.length === 0}
                className="action-btn action-btn-primary w-full"
              >
                <Mic size={17} />
                Start Attendance
              </button>
            </div>
          </section>

          <section className="grid gap-5">
            <div className="panel px-5 py-5 sm:px-6">
              <div className="mt-4 grid gap-3">
                <div className="metric-card">
                  <p className="metric-label">Browser Recognition</p>
                  <p className="metric-value text-[1.45rem] sm:text-[1.8rem]">
                    {browserVoiceReady ? 'Available' : 'Not Ready'}
                  </p>
                </div>
                <div className="metric-card">
                  <p className="metric-label">AI Fallback</p>
                  <p className="metric-value text-[1.45rem] sm:text-[1.8rem]">
                    {aiFallbackReady ? 'Configured' : 'Missing Key'}
                  </p>
                </div>
                <div className="metric-card">
                  <p className="metric-label">Students In Queue</p>
                  <p className="metric-value">{students.length}</p>
                </div>
              </div>
            </div>

            <div className="status-panel">
              <Sparkles size={18} className="mt-0.5 shrink-0" />
              <p className="text-sm leading-6">{statusMessage}</p>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (sessionState === 'complete') {
    return (
      <div className="page-shell max-w-5xl">
        <div className="page-header">
          <div className="page-copy">
            <p className="page-kicker">Run Complete</p>
            <h2 className="page-title">Attendance captured.</h2>
          </div>
        </div>

        <section className="panel px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-success/12 text-success">
                <CheckCircle2 size={30} />
              </div>
              <h3 className="mt-4 text-3xl font-semibold tracking-[-0.07em] text-surface-dark">
                {selectedClass?.name || 'Attendance Session'}
              </h3>
              <p className="mt-2 text-sm text-[var(--ink-soft)]">{today}</p>
              {sessionId && (
                <p className="mono mt-3 text-xs text-[var(--ink-faint)]">Session ID: {sessionId}</p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="metric-card">
                <p className="metric-label">Present</p>
                <p className="metric-value text-success">{presentCount}</p>
              </div>
              <div className="metric-card">
                <p className="metric-label">Absent</p>
                <p className="metric-value text-danger">{absentCount}</p>
              </div>
              <div className="metric-card">
                <p className="metric-label">Total</p>
                <p className="metric-value">{students.length}</p>
              </div>
            </div>
          </div>

          <div className="status-panel mt-5">
            <Sparkles size={18} className="mt-0.5 shrink-0" />
            <p className="text-sm leading-6">{statusMessage}</p>
          </div>

          <div className="mt-5 table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-24">Roll No</th>
                  <th>Name</th>
                  <th className="text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const status = records.get(student.id) === 'present' ? 'present' : 'absent';
                  return (
                    <tr key={student.id}>
                      <td className="mono text-[var(--ink-soft)]">{student.roll_number || '—'}</td>
                      <td className="font-semibold">{student.name}</td>
                      <td className="text-right">
                        <span className={`tag ${status === 'present' ? 'tag-success' : 'tag-danger'}`}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={resetSession} className="action-btn action-btn-primary">
              New Session
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell max-w-6xl">
      <div className="page-header">
        <div className="page-copy">
          <p className="page-kicker">{sessionState === 'paused' ? 'Paused' : 'Active Session'}</p>
          <h2 className="page-title">{selectedClass?.name || 'Attendance Session'}</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <span className="tag tag-success">{presentCount} present</span>
          <span className="tag tag-danger">{absentCount} absent</span>
          <span className="tag tag-neutral">{sessionState}</span>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.9fr]">
        <section className="grid gap-5">
          <div className="panel px-5 py-5 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-2xl font-semibold tracking-[-0.06em] text-surface-dark">
                  {today} · {currentIndex + 1} / {students.length}
                </p>
              </div>
              <span className="tag tag-neutral">{Math.round(progressWidth)}%</span>
            </div>
            <div className="progress-track mt-5">
              <div className="progress-value" style={{ width: `${progressWidth}%` }} />
            </div>

            <div className="status-panel mt-5">
              <Sparkles size={18} className="mt-0.5 shrink-0" />
              <p className="text-sm leading-6">{statusMessage}</p>
            </div>

            {currentStudent && (
              <div className="mt-5 rounded-[1.35rem] border border-primary/16 bg-white/78 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] sm:p-6">
                <div className="text-center">
                  {currentStudent.roll_number && (
                    <p className="mono text-xs uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                      Roll {currentStudent.roll_number}
                    </p>
                  )}
                  <h3 className="mt-3 text-4xl font-semibold tracking-[-0.09em] text-surface-dark sm:text-5xl">
                    {currentStudent.name}
                  </h3>
                  {isListening && (
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/16 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
                      <span className="relative flex h-3 w-3">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
                      </span>
                      Listening...
                    </div>
                  )}
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={() => void handleManualMark('present')}
                    className={`action-btn w-full ${
                      records.get(currentStudent.id) === 'present'
                        ? 'action-btn-primary'
                        : 'action-btn-secondary border-success/24 text-success'
                    }`}
                  >
                    <CheckCircle2 size={18} />
                    Present
                  </button>
                  <button
                    onClick={() => void handleManualMark('absent')}
                    className={`action-btn w-full ${
                      records.get(currentStudent.id) === 'absent'
                        ? 'action-btn-danger'
                        : 'action-btn-secondary border-danger/24 text-danger'
                    }`}
                  >
                    <XCircle size={18} />
                    Absent
                  </button>
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 sm:justify-between">
              <div className="flex items-center gap-2">
                <button onClick={prevStudent} disabled={currentIndex === 0} className="icon-btn">
                  <SkipForward size={18} className="rotate-180" />
                </button>
                <button onClick={() => void handleRepeat()} disabled={!voiceEnabled} className="icon-btn">
                  <RotateCcw size={18} />
                </button>
                <button onClick={togglePause} className="action-btn action-btn-secondary">
                  {sessionState === 'paused' ? <Play size={16} /> : <Pause size={16} />}
                  {sessionState === 'paused' ? 'Resume' : 'Pause'}
                </button>
                <button onClick={nextStudent} className="icon-btn">
                  <SkipForward size={18} />
                </button>
              </div>

              <button onClick={completeSession} className="action-btn action-btn-danger">
                End Session
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-5">
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="metric-card">
              <p className="metric-label">Current Position</p>
              <p className="metric-value">{currentIndex + 1}</p>
            </div>
            <div className="metric-card">
              <p className="metric-label">Voice Input</p>
              <p className="metric-value text-[1.45rem] sm:text-[1.8rem]">
                {useVoiceInput ? 'On' : 'Manual'}
              </p>
            </div>
            <div className="metric-card">
              <p className="metric-label">Voice Output</p>
              <p className="metric-value text-[1.45rem] sm:text-[1.8rem]">
                {voiceEnabled ? 'On' : 'Muted'}
              </p>
            </div>
          </div>

          <div className="panel">
            <div className="border-b border-black/6 px-5 py-4 sm:px-6">
              <h3 className="text-2xl font-semibold tracking-[-0.06em] text-surface-dark">Queue</h3>
            </div>

            <div className="max-h-[34rem] overflow-auto">
              {students.map((student, index) => {
                const studentStatus = records.get(student.id);
                return (
                  <div
                    key={student.id}
                    className={`list-row ${index === currentIndex ? 'bg-primary/6' : ''}`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="mono w-6 text-xs text-[var(--ink-faint)]">{index + 1}</span>
                      <span className="mono w-14 text-xs text-[var(--ink-faint)]">
                        {student.roll_number || '—'}
                      </span>
                      <span className={`truncate font-semibold ${index === currentIndex ? 'text-primary' : 'text-surface-dark'}`}>
                        {student.name}
                      </span>
                    </div>
                    <span
                      className={`tag ${
                        studentStatus === 'present'
                          ? 'tag-success'
                          : studentStatus === 'absent'
                            ? 'tag-danger'
                            : 'tag-neutral'
                      }`}
                    >
                      {studentStatus || 'pending'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
