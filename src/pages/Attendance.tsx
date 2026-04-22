import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Mic,
  MicOff,
  SkipForward,
  RotateCcw,
  Volume2,
  VolumeX,
  CheckCircle2,
  XCircle,
  Pause,
  Play,
  Sparkles,
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

  useEffect(() => {
    return () => {
      stopCurrentInteraction();
    };
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
    const sourceLabel = result.mode === 'ai' ? 'AI fallback' : result.mode === 'browser' ? 'browser mic' : 'manual mode';

    if (result.status === 'present') {
      setStatusMessage(`${student.name} marked present via ${sourceLabel}.${transcriptDetail}`);
    } else if (result.status === 'absent') {
      setStatusMessage(`${student.name} marked absent via ${sourceLabel}.${transcriptDetail}`);
    } else if (result.error) {
      setStatusMessage(`${result.error} ${student.name} was not advanced. Use Repeat or mark manually.`);
    } else {
      setStatusMessage(`No clear response for ${student.name}.${transcriptDetail} Use Repeat or mark manually.`);
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
        if (stepToken !== stepTokenRef.current) {
          return;
        }
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

  const endSession = () => {
    completeSession();
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

  if (sessionState === 'setup') {
    return (
      <div className="p-6 max-w-2xl">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Take Attendance</h2>
        <p className="text-sm text-gray-500 mb-6">Start a voice roll call session</p>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
            <select
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={today}
              readOnly
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50"
            />
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700">
            <p className="font-medium text-slate-900 mb-1">Listening engines</p>
            <p>Browser speech recognition: {browserVoiceReady ? 'available' : 'not available'}</p>
            <p>AI fallback via OpenRouter key: {aiFallbackReady ? 'ready' : 'not configured'}</p>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-700">Voice Output (TTS)</p>
              <p className="text-xs text-gray-500">Read student names aloud</p>
            </div>
            <button
              onClick={() => setVoiceEnabled((current) => !current)}
              className={`p-2 rounded-lg transition-colors ${
                voiceEnabled ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'
              }`}
            >
              {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-700">Voice Input (Recognition)</p>
              <p className="text-xs text-gray-500">Listen for "present" / "absent"</p>
            </div>
            <button
              onClick={() => setUseVoiceInput((current) => !current)}
              className={`p-2 rounded-lg transition-colors ${
                useVoiceInput ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'
              }`}
            >
              {useVoiceInput ? <Mic size={18} /> : <MicOff size={18} />}
            </button>
          </div>

          {useVoiceInput && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Silence timeout: {(silenceTimeout / 1000).toFixed(1)}s
              </label>
              <input
                type="range"
                min={2000}
                max={8000}
                step={500}
                value={silenceTimeout}
                onChange={(event) => setSilenceTimeout(Number(event.target.value))}
                className="w-full"
              />
            </div>
          )}

          <button
            onClick={startSession}
            disabled={!selectedClassId || students.length === 0}
            className="w-full bg-primary text-white py-3 rounded-lg text-sm font-semibold hover:bg-primary-hover disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            <Mic size={18} />
            Start Attendance
          </button>

          <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-900">
            <div className="flex items-start gap-2">
              <Sparkles size={16} className="mt-0.5 flex-shrink-0" />
              <p>{statusMessage}</p>
            </div>
          </div>

          {students.length === 0 && selectedClassId && (
            <p className="text-xs text-warning text-center">
              No students in this class. Add students first.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (sessionState === 'complete') {
    return (
      <div className="p-6 max-w-2xl">
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <CheckCircle2 size={48} className="mx-auto text-success mb-3" />
          <h2 className="text-xl font-bold text-gray-900 mb-1">Attendance Complete</h2>
          <p className="text-sm text-gray-500 mb-4">{today}</p>
          {sessionId && <p className="text-xs text-gray-400 mb-4">Session ID: {sessionId}</p>}

          <div className="flex justify-center gap-6 mb-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-success">{presentCount}</p>
              <p className="text-xs text-gray-500">Present</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-danger">{absentCount}</p>
              <p className="text-xs text-gray-500">Absent</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-600">{students.length}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
          </div>

          <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-900 mb-4">
            {statusMessage}
          </div>

          <div className="max-h-60 overflow-auto text-left mb-4">
            {students.map((student) => (
              <div
                key={student.id}
                className="flex items-center justify-between py-1.5 px-3 text-sm border-b border-gray-100 last:border-0"
              >
                <span className="text-gray-700">
                  {student.roll_number && <span className="text-gray-400 mr-2">{student.roll_number}</span>}
                  {student.name}
                </span>
                <span
                  className={`font-medium ${
                    records.get(student.id) === 'present' ? 'text-success' : 'text-danger'
                  }`}
                >
                  {records.get(student.id) === 'present' ? 'Present' : 'Absent'}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={resetSession}
            className="bg-primary text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            New Session
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{selectedClass?.name}</h2>
          <p className="text-xs text-gray-500">
            {today} · {currentIndex + 1} / {students.length}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-success">{presentCount} present</span>
          <span className="text-sm text-gray-400">·</span>
          <span className="text-sm text-danger">{absentCount} absent</span>
        </div>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-4">
        <div
          className="bg-primary h-1.5 rounded-full transition-all"
          style={{ width: `${students.length > 0 ? ((currentIndex + 1) / students.length) * 100 : 0}%` }}
        />
      </div>

      <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-900 mb-4">
        {statusMessage}
      </div>

      {currentStudent && (
        <div className="bg-white rounded-xl border-2 border-primary/20 p-6 mb-4 flex-shrink-0">
          <div className="text-center mb-4">
            {currentStudent.roll_number && (
              <p className="text-xs text-gray-400 mb-1">Roll #{currentStudent.roll_number}</p>
            )}
            <h3 className="text-3xl font-bold text-gray-900">{currentStudent.name}</h3>
            {isListening && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
                </span>
                <span className="text-sm text-primary font-medium">Listening...</span>
              </div>
            )}
          </div>

          <div className="flex justify-center gap-3">
            <button
              onClick={() => void handleManualMark('present')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all ${
                records.get(currentStudent.id) === 'present'
                  ? 'bg-success text-white shadow-md'
                  : 'bg-success-light text-success hover:bg-success hover:text-white'
              }`}
            >
              <CheckCircle2 size={20} />
              Present
            </button>
            <button
              onClick={() => void handleManualMark('absent')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all ${
                records.get(currentStudent.id) === 'absent'
                  ? 'bg-danger text-white shadow-md'
                  : 'bg-danger-light text-danger hover:bg-danger hover:text-white'
              }`}
            >
              <XCircle size={20} />
              Absent
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-2 mb-4 flex-shrink-0">
        <button
          onClick={prevStudent}
          disabled={currentIndex === 0}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors"
        >
          <SkipForward size={18} className="rotate-180" />
        </button>
        <button
          onClick={() => void handleRepeat()}
          disabled={!voiceEnabled}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors"
          title="Repeat name"
        >
          <RotateCcw size={18} />
        </button>
        <button
          onClick={togglePause}
          className="p-3 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
        >
          {sessionState === 'paused' ? <Play size={20} /> : <Pause size={20} />}
        </button>
        <button
          onClick={nextStudent}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          title="Skip / Next"
        >
          <SkipForward size={18} />
        </button>
        <button
          onClick={endSession}
          className="ml-4 text-xs text-gray-400 hover:text-danger transition-colors"
        >
          End Session
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-white rounded-xl border border-gray-200">
        <div className="divide-y divide-gray-100">
          {students.map((student, index) => (
            <div
              key={student.id}
              className={`flex items-center justify-between px-4 py-2 text-sm ${
                index === currentIndex ? 'bg-primary-light' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-xs w-6">{index + 1}</span>
                <span className="text-gray-400 text-xs w-12">{student.roll_number}</span>
                <span className={`font-medium ${index === currentIndex ? 'text-primary' : 'text-gray-800'}`}>
                  {student.name}
                </span>
              </div>
              <span
                className={`text-xs font-medium ${
                  records.get(student.id) === 'present'
                    ? 'text-success'
                    : records.get(student.id) === 'absent'
                      ? 'text-danger'
                      : 'text-gray-300'
                }`}
              >
                {records.get(student.id) === 'present'
                  ? '✓ Present'
                  : records.get(student.id) === 'absent'
                    ? '✗ Absent'
                    : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
