import { useEffect, useState } from 'react';
import { ChevronRight, Trash2 } from 'lucide-react';
import * as api from '../lib/api';
import type { AttendanceRecord, AttendanceSession, Class } from '../types';

export default function History() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    api.getClasses().then((loadedClasses) => {
      setClasses(loadedClasses);
      if (loadedClasses.length > 0) setSelectedClassId(loadedClasses[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedClassId) return;
    api.getAttendanceSessions(selectedClassId).then(setSessions).catch(console.error);
  }, [selectedClassId]);

  const loadRecords = async (sessionId: string) => {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
      return;
    }

    const loadedRecords = await api.getAttendanceRecords(sessionId);
    setRecords(loadedRecords);
    setExpandedSessionId(sessionId);
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm('Delete this attendance session and all its records?')) return;

    await api.deleteAttendanceSession(id);
    if (selectedClassId) {
      api.getAttendanceSessions(selectedClassId).then(setSessions);
    }
    if (expandedSessionId === id) {
      setExpandedSessionId(null);
    }
  };

  return (
    <div className="page-shell max-w-5xl">
      <div className="page-header">
        <div className="page-copy">
          <p className="page-kicker">Audit Trail</p>
          <h2 className="page-title">Attendance History</h2>
        </div>
      </div>

      <section className="panel px-5 py-5 sm:px-6">
        <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h3 className="text-2xl font-semibold tracking-[-0.06em] text-surface-dark">History</h3>
          </div>
          <div className="grid gap-3">
            <select
              value={selectedClassId}
              onChange={(event) => {
                setExpandedSessionId(null);
                setSelectedClassId(event.target.value);
              }}
              className="select-field"
            >
              <option value="">Select a class</option>
              {classes.map((currentClass) => (
                <option key={currentClass.id} value={currentClass.id}>
                  {currentClass.name} {currentClass.section ? `— ${currentClass.section}` : ''}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <div className="metric-card">
                <p className="metric-label">Sessions</p>
                <p className="metric-value">{sessions.length}</p>
              </div>
              <div className="metric-card">
                <p className="metric-label">Expanded</p>
                <p className="metric-value text-[1.45rem] sm:text-[1.8rem]">
                  {expandedSessionId ? 'Open' : 'Closed'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {!selectedClassId ? (
        <section className="empty-panel mt-5">
          <p className="text-base font-medium text-surface-dark">Select a class to view history.</p>
        </section>
      ) : sessions.length === 0 ? (
        <section className="empty-panel mt-5">
          <p className="text-base font-medium text-surface-dark">No attendance sessions recorded yet.</p>
        </section>
      ) : (
        <section className="mt-5 panel">
          {sessions.map((session) => {
            const isExpanded = expandedSessionId === session.id;
            const presentCount = records.filter((record) => record.status === 'present').length;
            const absentCount = records.filter((record) => record.status === 'absent').length;

            return (
              <div key={session.id} className="border-t border-black/6 first:border-t-0">
                <div
                  className="flex cursor-pointer flex-col gap-4 px-5 py-4 transition-colors hover:bg-primary/4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                  onClick={() => void loadRecords(session.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/8 bg-white/70">
                      <ChevronRight
                        size={18}
                        className={`text-[var(--ink-faint)] transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      />
                    </div>
                    <div>
                      <p className="text-xl font-semibold tracking-[-0.05em] text-surface-dark">{session.date}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {isExpanded && (
                      <>
                        <span className="tag tag-success">{presentCount} present</span>
                        <span className="tag tag-danger">{absentCount} absent</span>
                      </>
                    )}
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDeleteSession(session.id);
                      }}
                      className="icon-btn"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-black/6 bg-white/50 px-5 py-4 sm:px-6">
                    {records.length === 0 ? (
                      <p className="text-sm text-[var(--ink-soft)]">No records for this session.</p>
                    ) : (
                      <div className="grid gap-2">
                        {records.map((record) => (
                          <div
                            key={record.id}
                            className="flex flex-col gap-2 rounded-2xl border border-black/6 bg-white/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <p className="text-base font-medium text-surface-dark">
                                {record.student_name}
                              </p>
                              <p className="mono mt-1 text-xs text-[var(--ink-faint)]">
                                {record.roll_number || 'No roll number'}
                              </p>
                            </div>
                            <span className={`tag ${record.status === 'present' ? 'tag-success' : 'tag-danger'}`}>
                              {record.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
