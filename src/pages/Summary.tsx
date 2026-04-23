import { useEffect, useState } from 'react';
import { Download, File, FileSpreadsheet, FileText } from 'lucide-react';
import * as api from '../lib/api';
import {
  exportAttendanceCsv,
  exportAttendanceExcel,
  exportAttendancePdf,
  exportSummaryCsv,
  exportSummaryExcel,
  exportSummaryPdf,
} from '../lib/export';
import type { Class, StudentSummary } from '../types';

export default function Summary() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [summary, setSummary] = useState<StudentSummary[]>([]);
  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    api.getClasses().then((loadedClasses) => {
      setClasses(loadedClasses);
      if (loadedClasses.length > 0) setSelectedClassId(loadedClasses[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedClassId) return;
    api.getStudentSummary(selectedClassId).then(setSummary).catch(console.error);
  }, [selectedClassId]);

  const selectedClass = classes.find((currentClass) => currentClass.id === selectedClassId);
  const className = selectedClass?.name || 'Class';
  const totalPresent = summary.reduce((accumulator, row) => accumulator + row.present_count, 0);
  const totalSessions = summary.reduce((accumulator, row) => accumulator + row.total_sessions, 0);

  const handleExport = async (type: 'csv' | 'excel' | 'pdf', mode: 'attendance' | 'summary') => {
    try {
      if (mode === 'summary') {
        const data = await api.getExportSummary(selectedClassId);
        if (type === 'csv') await exportSummaryCsv(data, className);
        else if (type === 'excel') await exportSummaryExcel(data, className);
        else await exportSummaryPdf(data, className);
      } else {
        const data = await api.getExportData(selectedClassId);
        if (type === 'csv') await exportAttendanceCsv(data, className);
        else if (type === 'excel') await exportAttendanceExcel(data, className);
        else await exportAttendancePdf(data, className);
      }
    } catch (error) {
      console.error(error);
    }

    setShowExport(false);
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="page-copy">
          <p className="page-kicker">Reporting</p>
          <h2 className="page-title">Summary</h2>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowExport((current) => !current)}
            disabled={!selectedClassId}
            className="action-btn action-btn-primary"
          >
            <Download size={16} />
            Export
          </button>

          {showExport && (
            <div className="absolute right-0 top-full z-10 mt-3 w-64 rounded-[1.1rem] border border-[var(--line)] bg-white/96 p-2 shadow-[0_18px_40px_rgba(17,19,24,0.14)] backdrop-blur">
              <p className="px-3 py-2 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                Detailed Attendance
              </p>
              <button
                onClick={() => void handleExport('csv', 'attendance')}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-surface-dark transition-colors hover:bg-primary/6"
              >
                <FileText size={15} />
                Attendance CSV
              </button>
              <button
                onClick={() => void handleExport('excel', 'attendance')}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-surface-dark transition-colors hover:bg-primary/6"
              >
                <FileSpreadsheet size={15} />
                Attendance Excel
              </button>
              <button
                onClick={() => void handleExport('pdf', 'attendance')}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-surface-dark transition-colors hover:bg-primary/6"
              >
                <File size={15} />
                Attendance PDF
              </button>
              <div className="my-2 border-t border-black/8" />
              <p className="px-3 py-2 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                Summary
              </p>
              <button
                onClick={() => void handleExport('csv', 'summary')}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-surface-dark transition-colors hover:bg-primary/6"
              >
                <FileText size={15} />
                Summary CSV
              </button>
              <button
                onClick={() => void handleExport('excel', 'summary')}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-surface-dark transition-colors hover:bg-primary/6"
              >
                <FileSpreadsheet size={15} />
                Summary Excel
              </button>
              <button
                onClick={() => void handleExport('pdf', 'summary')}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-surface-dark transition-colors hover:bg-primary/6"
              >
                <File size={15} />
                Summary PDF
              </button>
            </div>
          )}
        </div>
      </div>

      <section className="panel px-5 py-5 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <h3 className="text-2xl font-semibold tracking-[-0.06em] text-surface-dark">Summary</h3>
          </div>
          <div className="grid gap-3">
            <select
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
              className="select-field"
            >
              <option value="">Select a class</option>
              {classes.map((currentClass) => (
                <option key={currentClass.id} value={currentClass.id}>
                  {currentClass.name} {currentClass.section ? `— ${currentClass.section}` : ''}
                </option>
              ))}
            </select>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="metric-card">
                <p className="metric-label">Students</p>
                <p className="metric-value">{summary.length}</p>
              </div>
              <div className="metric-card">
                <p className="metric-label">Present Marks</p>
                <p className="metric-value">{totalPresent}</p>
              </div>
              <div className="metric-card">
                <p className="metric-label">Session Slots</p>
                <p className="metric-value">{totalSessions}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {!selectedClassId ? (
        <section className="empty-panel mt-5">
          <p className="text-base font-medium text-surface-dark">Select a class to view summary.</p>
        </section>
      ) : summary.length === 0 ? (
        <section className="empty-panel mt-5">
          <p className="text-base font-medium text-surface-dark">No attendance data yet.</p>
        </section>
      ) : (
        <section className="table-wrap mt-5">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-24">Roll No</th>
                <th>Student Name</th>
                <th className="text-center">Total Days</th>
                <th className="text-center">Present</th>
                <th className="text-center">Rate</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row) => {
                const attendanceRate = row.total_sessions > 0
                  ? Math.round((row.present_count / row.total_sessions) * 100)
                  : 0;

                return (
                  <tr key={row.student_id}>
                    <td className="mono text-[var(--ink-soft)]">{row.roll_number || '—'}</td>
                    <td className="font-medium">{row.student_name}</td>
                    <td className="text-center text-[var(--ink-soft)]">{row.total_sessions}</td>
                    <td className="text-center font-bold text-success">{row.present_count}</td>
                    <td className="text-center">
                      <span
                        className={`tag ${
                          attendanceRate >= 75
                            ? 'tag-success'
                            : attendanceRate >= 50
                              ? 'tag-warning'
                              : 'tag-danger'
                        }`}
                      >
                        {attendanceRate}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
