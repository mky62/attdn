import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Upload,
  Users,
} from 'lucide-react';
import * as api from '../lib/api';
import type { Class, Student } from '../types';
import Papa from 'papaparse';
import { pickTextFile } from '../lib/files';

export default function Students() {
  const [searchParams] = useSearchParams();
  const classIdParam = searchParams.get('classId');

  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState(classIdParam || '');
  const [students, setStudents] = useState<Student[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getClasses().then((c) => {
      setClasses(c);
      if (c.length > 0) {
        setSelectedClassId((current) => current || c[0].id);
      }
    });
  }, []);

  useEffect(() => {
    const request = selectedClassId
      ? api.getStudents(selectedClassId)
      : Promise.resolve<Student[]>([]);

    request.then(setStudents).catch(console.error);
  }, [selectedClassId]);

  const loadStudents = useCallback(() => {
    if (selectedClassId) {
      api.getStudents(selectedClassId).then(setStudents).catch(console.error);
    }
  }, [selectedClassId]);

  const handleSubmit = async () => {
    if (!name.trim() || !selectedClassId) return;
    setLoading(true);
    try {
      if (editId) {
        await api.updateStudent(editId, name.trim(), rollNumber.trim());
        setEditId(null);
      } else {
        await api.createStudent(selectedClassId, name.trim(), rollNumber.trim());
      }
      setName('');
      setRollNumber('');
      setShowForm(false);
      loadStudents();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const startEdit = (s: Student) => {
    setEditId(s.id);
    setName(s.name);
    setRollNumber(s.roll_number);
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditId(null);
    setName('');
    setRollNumber('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this student?')) return;
    await api.deleteStudent(id);
    loadStudents();
  };

  const handleImportCsv = async () => {
    if (!selectedClassId) return;
    try {
      const content = await pickTextFile({ accept: '.csv,text/csv' });
      if (!content) return;
      const result = Papa.parse<string[]>(content, {
        skipEmptyLines: true,
      });

      const rows = result.data;
      const studentsToImport: [string, string][] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.length >= 2) {
          const rn = row[0]?.trim() || '';
          const nm = row[1]?.trim() || '';
          if (nm) studentsToImport.push([nm, rn]);
        } else if (row.length === 1 && row[0]?.trim()) {
          studentsToImport.push([row[0].trim(), String(i + 1)]);
        }
      }

      if (studentsToImport.length > 0) {
        const count = await api.importStudents(selectedClassId, studentsToImport);
        alert(`Imported ${count} students`);
        loadStudents();
      }
    } catch (e) {
      console.error(e);
      alert('Import failed. Make sure CSV has roll_number,name columns.');
    }
  };

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Students</h2>
          <p className="text-sm text-gray-500">Manage student rosters</p>
        </div>
        <div className="flex gap-2">
          {selectedClassId && (
            <>
              <button
                onClick={handleImportCsv}
                className="flex items-center gap-2 text-gray-700 bg-white border border-gray-300 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <Upload size={16} />
                Import CSV
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
              >
                <Plus size={16} />
                Add Student
              </button>
            </>
          )}
        </div>
      </div>

      {/* Class selector */}
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

      {showForm && selectedClassId && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div className="flex gap-3 mb-3">
            <input
              type="text"
              placeholder="Roll number"
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <input
              type="text"
              placeholder="Student name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={loading || !name.trim()}
              className="flex items-center gap-1.5 bg-primary text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              <Check size={14} />
              {editId ? 'Update' : 'Add'}
            </button>
            <button
              onClick={cancelForm}
              className="flex items-center gap-1.5 text-gray-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              <X size={14} />
              Cancel
            </button>
          </div>
        </div>
      )}

      {!selectedClassId ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Users size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">Select a class to view students</p>
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Users size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">
            No students in {selectedClass?.name}. Add students or import from CSV.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            CSV format: roll_number, student_name (one per line)
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-24">Roll No</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-600">{s.roll_number || '—'}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{s.name}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => startEdit(s)}
                      className="p-1.5 text-gray-400 hover:text-primary hover:bg-blue-50 rounded transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="p-1.5 text-gray-400 hover:text-danger hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500">
            {students.length} student{students.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
