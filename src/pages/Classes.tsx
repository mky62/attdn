import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
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
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const startEdit = (c: Class) => {
    setEditId(c.id);
    setName(c.name);
    setSection(c.section);
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
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Classes</h2>
          <p className="text-sm text-gray-500">Manage your classes and batches</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            <Plus size={16} />
            Add Class
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div className="flex gap-3 mb-3">
            <input
              type="text"
              placeholder="Class name (e.g. 10th Grade, Batch A)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              autoFocus
            />
            <input
              type="text"
              placeholder="Section (optional)"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={loading || !name.trim()}
              className="flex items-center gap-1.5 bg-primary text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              <Check size={14} />
              {editId ? 'Update' : 'Create'}
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

      {classes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-sm">No classes yet. Create your first class above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {classes.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:shadow-sm transition-shadow"
            >
              <div>
                <p className="font-semibold text-gray-900">{c.name}</p>
                <p className="text-xs text-gray-500">{c.section || 'No section'}</p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => startEdit(c)}
                  className="p-2 text-gray-400 hover:text-primary hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="p-2 text-gray-400 hover:text-danger hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
