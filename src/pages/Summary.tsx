import { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, FileText, File } from 'lucide-react';
import * as api from '../lib/api';
import type { Class, StudentSummary } from '../types';
import {
  exportAttendanceCsv,
  exportSummaryCsv,
  exportAttendanceExcel,
  exportSummaryExcel,
  exportAttendancePdf,
  exportSummaryPdf,
} from '../lib/export';

export default function Summary() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [summary, setSummary] = useState<StudentSummary[]>([]);
  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    api.getClasses().then((c) => {
      setClasses(c);
      if (c.length > 0) setSelectedClassId(c[0].id);
    });
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      api.getStudentSummary(selectedClassId).then(setSummary).catch(console.error);
    }
  }, [selectedClassId]);

  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const className = selectedClass?.name || 'Class';

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
    } catch (e) {
      console.error(e);
    }
    setShowExport(false);
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Summary</h2>
          <p className="text-sm text-gray-500">Attendance summary with total present days</p>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowExport(!showExport)}
            disabled={!selectedClassId}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            <Download size={16} />
            Export
          </button>
          {showExport && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-2 w-56 z-10">
              <p className="text-xs font-semibold text-gray-500 px-2 py-1 uppercase">Detailed</p>
              <button
                onClick={() => handleExport('csv', 'attendance')}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded"
              >
                <FileText size={14} /> Attendance CSV
              </button>
              <button
                onClick={() => handleExport('excel', 'attendance')}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded"
              >
                <FileSpreadsheet size={14} /> Attendance Excel
              </button>
              <button
                onClick={() => handleExport('pdf', 'attendance')}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded"
              >
                <File size={14} /> Attendance PDF
              </button>
              <div className="border-t border-gray-100 my-1" />
              <p className="text-xs font-semibold text-gray-500 px-2 py-1 uppercase">Summary</p>
              <button
                onClick={() => handleExport('csv', 'summary')}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded"
              >
                <FileText size={14} /> Summary CSV
              </button>
              <button
                onClick={() => handleExport('excel', 'summary')}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded"
              >
                <FileSpreadsheet size={14} /> Summary Excel
              </button>
              <button
                onClick={() => handleExport('pdf', 'summary')}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded"
              >
                <File size={14} /> Summary PDF
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mb-4">
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
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
          <p className="text-gray-500 text-sm">Select a class to view summary</p>
        </div>
      ) : summary.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-sm">No attendance data yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-20">Roll No</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Student Name</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 w-28">Total Days</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 w-28">Present</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 w-24">%</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => {
                const pct = s.total_sessions > 0
                  ? Math.round((s.present_count / s.total_sessions) * 100)
                  : 0;
                return (
                  <tr key={s.student_id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-600">{s.roll_number || '—'}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{s.student_name}</td>
                    <td className="px-4 py-2.5 text-center text-gray-600">{s.total_sessions}</td>
                    <td className="px-4 py-2.5 text-center font-semibold text-success">{s.present_count}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                          pct >= 75
                            ? 'bg-success-light text-success'
                            : pct >= 50
                              ? 'bg-warning-light text-warning'
                              : 'bg-danger-light text-danger'
                        }`}
                      >
                        {pct}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
