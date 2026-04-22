import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Users, Mic, BarChart3 } from 'lucide-react';
import * as api from '../lib/api';
import type { Class } from '../types';

export default function Dashboard() {
  const [classes, setClasses] = useState<Class[]>([]);

  useEffect(() => {
    api.getClasses().then(setClasses).catch(console.error);
  }, []);

  return (
    <div className="p-6 max-w-5xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Dashboard</h2>
      <p className="text-sm text-gray-500 mb-6">Quick overview of your attendance system</p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <Link
          to="/classes"
          className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <GraduationCap size={20} className="text-primary" />
            </div>
            <span className="text-sm font-medium text-gray-600">Classes</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{classes.length}</p>
        </Link>

        <Link
          to="/attendance"
          className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <Mic size={20} className="text-success" />
            </div>
            <span className="text-sm font-medium text-gray-600">Take Attendance</span>
          </div>
          <p className="text-sm text-gray-500">Start voice roll call</p>
        </Link>

        <Link
          to="/summary"
          className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <BarChart3 size={20} className="text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Summary</span>
          </div>
          <p className="text-sm text-gray-500">View attendance reports</p>
        </Link>
      </div>

      {classes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Users size={40} className="mx-auto text-gray-300 mb-3" />
          <h3 className="text-lg font-semibold text-gray-700 mb-1">Get Started</h3>
          <p className="text-sm text-gray-500 mb-4">
            Create your first class to begin taking attendance
          </p>
          <Link
            to="/classes"
            className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            <GraduationCap size={16} />
            Create Class
          </Link>
        </div>
      ) : (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Your Classes
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {classes.map((c) => (
              <Link
                key={c.id}
                to={`/attendance?classId=${c.id}`}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow flex items-center justify-between"
              >
                <div>
                  <p className="font-semibold text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-500">{c.section || 'No section'}</p>
                </div>
                <Mic size={18} className="text-gray-400" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
