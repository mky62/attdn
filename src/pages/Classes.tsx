import { useEffect, useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import * as api from '../lib/api';
import type { Class } from '../types';

export default function Classes() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [section, setSection] = useState('');
  const [loading, setLoading] = useState(false);

  const load = () => {
    api.getClasses().then(setClasses).catch(console.error);
  };

  useEffect(load, []);

  const handleSubmit = async () => {
    if (!name.trim()) return;

    setLoading(true);
    try {
      if (editId) {
        await api.updateClass(editId, name.trim(), section.trim());
        setEditId(null);
      } else {
        await api.createClass(name.trim(), section.trim());
      }
      setName('');
      setSection('');
      setShowForm(false);
      load();
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const startEdit = (currentClass: Class) => {
    setEditId(currentClass.id);
    setName(currentClass.name);
    setSection(currentClass.section);
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditId(null);
    setName('');
    setSection('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this class and all its students/attendance?')) return;
    await api.deleteClass(id);
    load();
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="page-copy">
          <p className="page-kicker">Structure</p>
          <h2 className="page-title">Class architecture.</h2>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="action-btn action-btn-primary">
            <Plus size={16} />
            Add Class
          </button>
        )}
      </div>

      <section className="grid gap-5 lg:grid-cols-[0.95fr_1.3fr]">
        <div className="panel px-5 py-5 sm:px-6">
          <p className="page-kicker">{editId ? 'Edit Class' : 'New Class'}</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.06em] text-surface-dark">
            {editId ? 'Edit class' : 'New class'}
          </h3>

          {showForm ? (
            <div className="mt-5 grid gap-3">
              <input
                type="text"
                placeholder="Class name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleSubmit()}
                className="field"
                autoFocus
              />
              <input
                type="text"
                placeholder="Section (optional)"
                value={section}
                onChange={(event) => setSection(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleSubmit()}
                className="field"
              />
              <div className="mt-2 flex flex-wrap gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={loading || !name.trim()}
                  className="action-btn action-btn-primary"
                >
                  <Check size={16} />
                  {editId ? 'Update' : 'Create'}
                </button>
                <button onClick={cancelForm} className="action-btn action-btn-secondary">
                  <X size={16} />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-[var(--line-strong)] bg-white/45 px-4 py-5 text-sm text-[var(--ink-soft)]">
              Select a class to edit or add a new one.
            </div>
          )}
        </div>

        <div className="panel">
          <div className="border-b border-black/6 px-5 py-4 sm:px-6">
            <p className="page-kicker">Current Classes</p>
            <h3 className="mt-1 text-2xl font-semibold tracking-[-0.06em] text-surface-dark">
              {classes.length === 0 ? 'Nothing configured yet.' : `${classes.length} classes ready.`}
            </h3>
          </div>

          {classes.length === 0 ? (
            <div className="empty-panel m-5">
              <p className="text-base font-medium text-surface-dark">No classes yet.</p>
            </div>
          ) : (
            <div>
              {classes.map((currentClass) => (
                <div key={currentClass.id} className="list-row">
                  <div>
                    <p className="text-lg font-medium tracking-[-0.04em] text-surface-dark">
                      {currentClass.name}
                    </p>
                    <p className="mt-1 text-sm text-[var(--ink-soft)]">
                      {currentClass.section || 'No section assigned'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => startEdit(currentClass)} className="icon-btn">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => handleDelete(currentClass.id)} className="icon-btn">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
