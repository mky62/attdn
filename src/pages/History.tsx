import { useEffect, useState } from 'react';
import { Trash2, ChevronRight } from 'lucide-react';
import * as api from '../lib/api';
import type { Class, AttendanceSession, AttendanceRecord } from '../types';

export default function History() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    api.getClasses().then((c) => {
      setClasses(c);
      if (c.length > 0) setSelectedClassId(c[0].id);
    });
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      api.getAttendanceSessions(selectedClassId).then(setSessions).catch(console.error);
    }
  }, [selectedClassId]);

  const loadRecords = async (sessionId: string) => {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
      return;
    }
    const recs = await api.getAttendanceRecords(sessionId);
    setRecords(recs);
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
    <div className="p-6 max-w-3xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Attendance History</h2>
      <p className="text-sm text-gray-500 mb-4">View past attendance sessions</p>

      <div className="mb-4">
        <select
          value={selectedClassId}
          onChange={(e) => {
            setExpandedSessionId(null);
            setSelectedClassId(e.target.value);
          }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
        >
          <option value="">Select a class</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.section ? `— ${c.section}` : ''}
            </option>
          ))}
        </select>
      </div>

      {!selectedClassId ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-sm">Select a class to view history</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-sm">No attendance sessions recorded yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
                onClick={() => loadRecords(s.id)}
              >
                <div className="flex items-center gap-3">
                  <ChevronRight
                    size={16}
                    className={`text-gray-400 transition-transform ${
                      expandedSessionId === s.id ? 'rotate-90' : ''
                    }`}
                  />
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{s.date}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSession(s.id);
                  }}
                  className="p-1.5 text-gray-400 hover:text-danger hover:bg-red-50 rounded transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {expandedSessionId === s.id && (
                <div className="border-t border-gray-100 px-4 py-2">
                  {records.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">No records</p>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {records.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between py-1.5 text-sm"
                        >
                          <span className="text-gray-700">
                            <span className="text-gray-400 mr-2">{r.roll_number}</span>
                            {r.student_name}
                          </span>
                          <span
                            className={`text-xs font-medium ${
                              r.status === 'present' ? 'text-success' : 'text-danger'
                            }`}
                          >
                            {r.status === 'present' ? '✓ Present' : '✗ Absent'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="pt-2 pb-1 text-xs text-gray-400">
                    {records.filter((r) => r.status === 'present').length} present ·{' '}
                    {records.filter((r) => r.status === 'absent').length} absent
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
