import { useEffect, useState, useRef, useCallback } from 'react';
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
} from 'lucide-react';
import * as api from '../lib/api';
import { speakStudentName, repeatStudentName, stopSpeaking, callStudent } from '../lib/voice';
// Note: speakStudentName and repeatStudentName are used directly in the component for non-voice-input mode and repeat
import type { Class, Student } from '../types';
import { format } from 'date-fns';

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
  const [silenceTimeout, setSilenceTimeout] = useState(4000);
  const listenerRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    api.getClasses().then((c) => {
      setClasses(c);
      if (!selectedClassId && c.length > 0) {
        setSelectedClassId(c[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      api.getStudents(selectedClassId).then(setStudents).catch(console.error);
    }
  }, [selectedClassId]);

  const today = format(new Date(), 'yyyy-MM-dd');

  const startSession = async () => {
    if (!selectedClassId) return;
    const session = await api.getOrCreateSession(selectedClassId, today);
    setSessionId(session.id);
    // Mark all absent first
    await api.markAllAbsent(session.id, selectedClassId);
    const initialRecords = new Map<string, string>();
    students.forEach((s) => initialRecords.set(s.id, 'absent'));
    setRecords(initialRecords);
    setCurrentIndex(0);
    setSessionState('active');
  };

  const markStudent = useCallback(
    async (studentId: string, status: 'present' | 'absent') => {
      if (!sessionId) return;
      await api.markAttendance(sessionId, studentId, status);
      setRecords((prev) => {
        const next = new Map(prev);
        next.set(studentId, status);
        return next;
      });
    },
    [sessionId],
  );

  const callNextStudent = useCallback(
    async (index: number) => {
      if (index >= students.length) {
        setSessionState('complete');
        return;
      }
      const student = students[index];
      if (!student) return;

      if (voiceEnabled) {
        if (useVoiceInput) {
          setIsListening(true);
          const listener = await callStudent(
            student.name,
            (result) => {
              setIsListening(false);
              if (result === 'present') {
                markStudent(student.id, 'present');
              } else if (result === 'absent') {
                markStudent(student.id, 'absent');
              }
              // 'unknown' or 'silence' - leave as absent (default)
            },
            silenceTimeout,
            useVoiceInput,
          );
          listenerRef.current = listener;
        } else {
          await speakStudentName(student.name);
        }
      }
    },
    [students, voiceEnabled, useVoiceInput, silenceTimeout, markStudent],
  );

  useEffect(() => {
    if (sessionState === 'active' && currentIndex < students.length) {
      callNextStudent(currentIndex);
    }
  }, [sessionState, currentIndex, students.length, callNextStudent]);

  const nextStudent = () => {
    listenerRef.current?.stop();
    setIsListening(false);
    stopSpeaking();
    if (currentIndex + 1 < students.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setSessionState('complete');
    }
  };

  const prevStudent = () => {
    listenerRef.current?.stop();
    setIsListening(false);
    stopSpeaking();
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleRepeat = async () => {
    if (currentIndex < students.length) {
      listenerRef.current?.stop();
      setIsListening(false);
      stopSpeaking();
      await repeatStudentName(students[currentIndex].name);
    }
  };

  const togglePause = () => {
    if (sessionState === 'active') {
      listenerRef.current?.stop();
      setIsListening(false);
      stopSpeaking();
      setSessionState('paused');
    } else if (sessionState === 'paused') {
      setSessionState('active');
    }
  };

  const endSession = () => {
    listenerRef.current?.stop();
    setIsListening(false);
    stopSpeaking();
    setSessionState('complete');
  };

  const resetSession = () => {
    listenerRef.current?.stop();
    setIsListening(false);
    stopSpeaking();
    setSessionState('setup');
    setCurrentIndex(0);
    setRecords(new Map());
    setSessionId('');
  };

  const presentCount = Array.from(records.values()).filter((s) => s === 'present').length;
  const absentCount = Array.from(records.values()).filter((s) => s === 'absent').length;
  const currentStudent = students[currentIndex];

  // ── Setup Screen ──────────────────────────────────────────────────────

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
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
            >
              <option value="">Select a class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.section ? `— ${c.section}` : ''}
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

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-700">Voice Output (TTS)</p>
              <p className="text-xs text-gray-500">Read student names aloud</p>
            </div>
            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
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
              onClick={() => setUseVoiceInput(!useVoiceInput)}
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
                onChange={(e) => setSilenceTimeout(Number(e.target.value))}
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

          {students.length === 0 && selectedClassId && (
            <p className="text-xs text-warning text-center">
              No students in this class. Add students first.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Complete Screen ────────────────────────────────────────────────────

  if (sessionState === 'complete') {
    return (
      <div className="p-6 max-w-2xl">
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <CheckCircle2 size={48} className="mx-auto text-success mb-3" />
          <h2 className="text-xl font-bold text-gray-900 mb-1">Attendance Complete</h2>
          <p className="text-sm text-gray-500 mb-4">{today}</p>

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

          <div className="max-h-60 overflow-auto text-left mb-4">
            {students.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between py-1.5 px-3 text-sm border-b border-gray-100 last:border-0"
              >
                <span className="text-gray-700">
                  {s.roll_number && <span className="text-gray-400 mr-2">{s.roll_number}</span>}
                  {s.name}
                </span>
                <span
                  className={`font-medium ${
                    records.get(s.id) === 'present' ? 'text-success' : 'text-danger'
                  }`}
                >
                  {records.get(s.id) === 'present' ? 'Present' : 'Absent'}
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

  // ── Active / Paused Session ────────────────────────────────────────────

  return (
    <div className="p-6 max-w-3xl h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {classes.find((c) => c.id === selectedClassId)?.name}
          </h2>
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

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-4">
        <div
          className="bg-primary h-1.5 rounded-full transition-all"
          style={{ width: `${((currentIndex + 1) / students.length) * 100}%` }}
        />
      </div>

      {/* Current Student Card */}
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

          {/* Manual Controls */}
          <div className="flex justify-center gap-3">
            <button
              onClick={() => markStudent(currentStudent.id, 'present')}
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
              onClick={() => markStudent(currentStudent.id, 'absent')}
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

      {/* Navigation Controls */}
      <div className="flex items-center justify-center gap-2 mb-4 flex-shrink-0">
        <button
          onClick={prevStudent}
          disabled={currentIndex === 0}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors"
        >
          <SkipForward size={18} className="rotate-180" />
        </button>
        <button
          onClick={handleRepeat}
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

      {/* Student List */}
      <div className="flex-1 overflow-auto bg-white rounded-xl border border-gray-200">
        <div className="divide-y divide-gray-100">
          {students.map((s, i) => (
            <div
              key={s.id}
              className={`flex items-center justify-between px-4 py-2 text-sm ${
                i === currentIndex ? 'bg-primary-light' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-xs w-6">{i + 1}</span>
                <span className="text-gray-400 text-xs w-12">{s.roll_number}</span>
                <span className={`font-medium ${i === currentIndex ? 'text-primary' : 'text-gray-800'}`}>
                  {s.name}
                </span>
              </div>
              <span
                className={`text-xs font-medium ${
                  records.get(s.id) === 'present'
                    ? 'text-success'
                    : records.get(s.id) === 'absent'
                      ? 'text-danger'
                      : 'text-gray-300'
                }`}
              >
                {records.get(s.id) === 'present'
                  ? '✓ Present'
                  : records.get(s.id) === 'absent'
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
