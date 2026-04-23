import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Mic,
  History,
  BarChart3,
  Settings,
  AudioLines,
  MessageSquare,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/classes', icon: GraduationCap, label: 'Classes' },
  { to: '/students', icon: Users, label: 'Students' },
  { to: '/attendance', icon: Mic, label: 'Attendance' },
  { to: '/history', icon: History, label: 'History' },
  { to: '/summary', icon: BarChart3, label: 'Summary' },
  { to: '/assistant', icon: MessageSquare, label: 'Assistant' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout() {
  return (
    <div className="app-shell">
      <div className="relative flex min-h-screen flex-col lg:flex-row">
        <aside className="border-b border-white/8 bg-sidebar/95 text-sidebar-active backdrop-blur-xl lg:w-72 lg:border-b-0 lg:border-r">
          <div className="border-b border-white/8 px-5 py-5 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/12 bg-white/8 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
                <AudioLines size={22} />
              </div>
              <div>
                <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-sidebar-text">
                  Voice Attendance
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-[-0.08em] text-white">Attdn</h1>
              </div>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto px-4 py-4 lg:flex-col lg:overflow-visible lg:px-5">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `app-nav-link shrink-0 lg:w-full ${isActive ? 'active' : ''}`}
              >
                <item.icon size={18} />
                <span className="text-sm font-medium tracking-[0.01em]">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="flex-1 overflow-auto">
          <div className="min-h-screen px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
