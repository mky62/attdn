import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Mic,
  History,
  BarChart3,
  Settings,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/classes', icon: GraduationCap, label: 'Classes' },
  { to: '/students', icon: Users, label: 'Students' },
  { to: '/attendance', icon: Mic, label: 'Attendance' },
  { to: '/history', icon: History, label: 'History' },
  { to: '/summary', icon: BarChart3, label: 'Summary' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout() {
  return (
    <div className="flex h-screen bg-surface">
      <aside className="w-56 bg-sidebar flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-sidebar-hover">
          <h1 className="text-xl font-bold text-white tracking-tight">Attdn</h1>
          <p className="text-xs text-sidebar-text mt-0.5">Voice Attendance</p>
        </div>
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-sidebar-hover text-sidebar-active'
                    : 'text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-active'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-sidebar-hover">
          <p className="text-[10px] text-sidebar-text">v0.1.0 · Offline First</p>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
