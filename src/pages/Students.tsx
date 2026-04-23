import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Pencil, Plus, Trash2, Upload, Users, X } from 'lucide-react';
import Papa from 'papaparse';
import * as api from '../lib/api';
import { pickTextFile } from '../lib/files';
import type { Class, Student } from '../types';

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
    api.getClasses().then((loadedClasses) => {
      setClasses(loadedClasses);
      if (loadedClasses.length > 0) {
        setSelectedClassId((current) => current || loadedClasses[0].id);
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
    if (!selectedClassId) return;
    api.getStudents(selectedClassId).then(setStudents).catch(console.error);
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
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const startEdit = (student: Student) => {
    setEditId(student.id);
    setName(student.name);
    setRollNumber(student.roll_number);
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

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        if (row.length >= 2) {
          const parsedRoll = row[0]?.trim() || '';
          const parsedName = row[1]?.trim() || '';
          if (parsedName) studentsToImport.push([parsedName, parsedRoll]);
        } else if (row.length === 1 && row[0]?.trim()) {
          studentsToImport.push([row[0].trim(), String(index + 1)]);
        }
      }

      if (studentsToImport.length > 0) {
        const count = await api.importStudents(selectedClassId, studentsToImport);
        alert(`Imported ${count} students`);
        loadStudents();
      }
    } catch (error) {
      console.error(error);
      alert('Import failed. Make sure CSV has roll_number,name columns.');
    }
  };

  const selectedClass = classes.find((currentClass) => currentClass.id === selectedClassId);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="page-copy">
          <p className="page-kicker">Roster Control</p>
          <h2 className="page-title">Students</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          {selectedClassId && (
            <>
              <button onClick={handleImportCsv} className="action-btn action-btn-secondary">
                <Upload size={16} />
                Import CSV
              </button>
              <button onClick={() => setShowForm(true)} className="action-btn action-btn-primary">
                <Plus size={16} />
                Add Student
              </button>
            </>
          )}
        </div>
      </div>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.4fr]">
        <div className="panel px-5 py-5 sm:px-6">
          <p className="page-kicker">Target Class</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.06em] text-surface-dark">
            {selectedClass ? selectedClass.name : 'Select a class first.'}
          </h3>

          <div className="mt-5 grid gap-3">
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

            <div className="grid grid-cols-2 gap-3">
              <div className="metric-card">
                <p className="metric-label">Roster Size</p>
                <p className="metric-value">{students.length}</p>
              </div>
              <div className="metric-card">
                <p className="metric-label">Section</p>
                <p className="metric-value text-[1.5rem] sm:text-[1.9rem]">
                  {selectedClass?.section || 'Open'}
                </p>
              </div>
            </div>
          </div>

          {showForm && selectedClassId && (
            <div className="mt-5 rounded-[1.2rem] border border-[var(--line)] bg-white/72 p-4">
              <p className="page-kicker">{editId ? 'Edit Student' : 'New Student'}</p>
              <div className="mt-3 grid gap-3">
                <input
                  type="text"
                  placeholder="Roll number"
                  value={rollNumber}
                  onChange={(event) => setRollNumber(event.target.value)}
                  className="field"
                />
                <input
                  type="text"
                  placeholder="Student name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && handleSubmit()}
                  className="field"
                  autoFocus
                />
                <div className="mt-1 flex flex-wrap gap-3">
                  <button
                    onClick={handleSubmit}
                    disabled={loading || !name.trim()}
                    className="action-btn action-btn-primary"
                  >
                    <Check size={16} />
                    {editId ? 'Update' : 'Add'}
                  </button>
                  <button onClick={cancelForm} className="action-btn action-btn-secondary">
                    <X size={16} />
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {!selectedClassId ? (
          <div className="empty-panel">
            <Users size={42} className="mx-auto text-[var(--ink-faint)]" />
            <h3 className="mt-4 text-xl font-medium tracking-[-0.05em] text-surface-dark">
              Select a class to load a roster.
            </h3>
          </div>
        ) : students.length === 0 ? (
          <div className="empty-panel">
            <Users size={42} className="mx-auto text-[var(--ink-faint)]" />
            <h3 className="mt-4 text-xl font-medium tracking-[-0.05em] text-surface-dark">
              No students in {selectedClass?.name}.
            </h3>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-32">Roll No</th>
                  <th>Name</th>
                  <th className="w-28 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td className="mono text-[var(--ink-soft)]">{student.roll_number || '—'}</td>
                    <td className="font-medium">{student.name}</td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => startEdit(student)} className="icon-btn">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => handleDelete(student.id)} className="icon-btn">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
