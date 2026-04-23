import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, GraduationCap, Mic, Users } from 'lucide-react';
import * as api from '../lib/api';
import type { Class } from '../types';

export default function Dashboard() {
  const [classes, setClasses] = useState<Class[]>([]);

  useEffect(() => {
    api.getClasses().then(setClasses).catch(console.error);
  }, []);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="page-copy">
          <p className="page-kicker">Control Room</p>
          <h2 className="page-title">Sharper attendance operations.</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/attendance" className="action-btn action-btn-primary">
            <Mic size={16} />
            Start Session
          </Link>
          <Link to="/summary" className="action-btn action-btn-secondary">
            <BarChart3 size={16} />
            Open Summary
          </Link>
        </div>
      </div>

      <section className="panel px-5 py-5 sm:px-6 sm:py-6">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
          <div>
            <h3 className="mt-3 max-w-xl text-3xl font-semibold tracking-[-0.08em] text-surface-dark sm:text-4xl">
              Attendance
            </h3>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/classes" className="action-btn action-btn-primary">
                <GraduationCap size={16} />
                Manage Classes
              </Link>
              <Link to="/students" className="action-btn action-btn-secondary">
                <Users size={16} />
                Edit Rosters
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="metric-card">
              <p className="metric-label">Classes Loaded</p>
              <p className="metric-value">{classes.length}</p>
            </div>
            <div className="metric-card">
              <p className="metric-label">System Mode</p>
              <p className="metric-value text-[1.55rem] sm:text-[1.8rem]">Offline First</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Link to="/classes" className="metric-card transition-transform hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <span className="tag tag-neutral">Classes</span>
            <GraduationCap size={18} className="text-primary" />
          </div>
          <p className="metric-value">{classes.length}</p>
        </Link>

        <Link to="/students" className="metric-card transition-transform hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <span className="tag tag-neutral">Rosters</span>
            <Users size={18} className="text-primary" />
          </div>
          <p className="metric-value text-[1.7rem] sm:text-[2rem]">Student Ops</p>
        </Link>

        <Link to="/attendance" className="metric-card transition-transform hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <span className="tag tag-success">Live</span>
            <Mic size={18} className="text-success" />
          </div>
          <p className="metric-value text-[1.7rem] sm:text-[2rem]">Voice Roll Call</p>
        </Link>

        <Link to="/summary" className="metric-card transition-transform hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <span className="tag tag-warning">Reports</span>
            <BarChart3 size={18} className="text-warning" />
          </div>
          <p className="metric-value text-[1.7rem] sm:text-[2rem]">Exports Ready</p>
        </Link>
      </section>

      {classes.length === 0 ? (
        <section className="mt-5 empty-panel">
          <Users size={42} className="mx-auto text-[var(--ink-faint)]" />
          <h3 className="mt-4 text-xl font-medium tracking-[-0.05em] text-surface-dark">
            No classes yet.
          </h3>
          <Link to="/classes" className="action-btn action-btn-primary mt-5">
            <GraduationCap size={16} />
            Create Class
          </Link>
        </section>
      ) : (
        <section className="mt-5 panel">
          <div className="flex items-center justify-between border-b border-black/6 px-5 py-4 sm:px-6">
            <div>
              <h3 className="text-xl font-semibold tracking-[-0.06em] text-surface-dark">Ready</h3>
            </div>
            <Link to="/attendance" className="hidden items-center gap-2 text-sm font-medium text-primary sm:inline-flex">
              Open Attendance
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid gap-0 md:grid-cols-2">
            {classes.map((course) => (
              <Link
                key={course.id}
                to={`/attendance?classId=${course.id}`}
                className="list-row transition-colors"
              >
                <div>
                  <p className="text-lg font-medium tracking-[-0.04em] text-surface-dark">
                    {course.name}
                  </p>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">
                    {course.section || 'No section assigned'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tag tag-neutral">Launch</span>
                  <ArrowRight size={18} className="text-[var(--ink-faint)]" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
