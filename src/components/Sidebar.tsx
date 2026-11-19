import { useEffect } from 'react';
import {
  BarChart3,
  Bell,
  BookOpenCheck,
  CalendarDays,
  CheckSquare,
  LayoutDashboard,
  LogOut,
  RotateCcw,
  User,
  X,
} from 'lucide-react';
import { PageView } from '../types/scheduler';

interface SidebarProps {
  activePage: PageView;
  onNavigate: (page: PageView) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  pendingCount: number;
  activeReminderCount: number;
  todayClassCount: number;
  pendingStudyCount: number;
  onRequestResetDemo: () => void;
  studentName?: string;
  studentEmail?: string;
  onSignOut?: () => void;
}

export function Sidebar({
  activePage,
  onNavigate,
  mobileOpen,
  onCloseMobile,
  pendingCount,
  activeReminderCount,
  todayClassCount,
  pendingStudyCount,
  onRequestResetDemo,
  studentName,
  studentEmail,
  onSignOut,
}: SidebarProps) {
  const navItems: {
    id: PageView;
    label: string;
    icon: typeof LayoutDashboard;
    count?: number;
  }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'timetable',
      label: 'Timetable',
      icon: CalendarDays,
      count: todayClassCount > 0 ? todayClassCount : undefined,
    },
    {
      id: 'study-planner',
      label: 'Study Planner',
      icon: BookOpenCheck,
      count: pendingStudyCount > 0 ? pendingStudyCount : undefined,
    },
    {
      id: 'assignments',
      label: 'Assignments',
      icon: CheckSquare,
      count: pendingCount > 0 ? pendingCount : undefined,
    },
    {
      id: 'reminders',
      label: 'Reminders',
      icon: Bell,
      count: activeReminderCount > 0 ? activeReminderCount : undefined,
    },
    {
      id: 'analytics',
      label: 'Progress Analytics',
      icon: BarChart3,
    },
  ];

  const handleSelect = (id: PageView) => {
    onNavigate(id);
    onCloseMobile();
  };

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseMobile();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mobileOpen, onCloseMobile]);

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white border-r border-slate-200">
      {/* Brand header */}
      <div className="flex h-16 items-center justify-between px-5 border-b border-slate-200">
        <button
          type="button"
          onClick={() => handleSelect('dashboard')}
          className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-md"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-xs">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
            SmartSched
          </span>
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* Primary navigation */}
      <nav aria-label="Primary navigation" className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 min-h-[42px] rounded-lg text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                isActive
                  ? 'bg-indigo-50/90 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive ? 'text-indigo-600' : 'text-slate-400'
                  }`}
                  aria-hidden="true"
                />
                <span className="truncate whitespace-nowrap">{item.label}</span>
              </span>
              {item.count !== undefined && (
                <span
                  className={`font-mono text-xs tabular-nums shrink-0 ${
                    isActive ? 'text-indigo-600 font-semibold' : 'text-slate-400'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Utility & Account footer */}
      <div className="p-4 border-t border-slate-200 space-y-3">
        {(studentName || studentEmail) && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 shrink-0">
              <User className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 truncate">
                {studentName || 'Student'}
              </p>
              {studentEmail && (
                <p className="text-[11px] text-slate-500 truncate">{studentEmail}</p>
              )}
            </div>
          </div>
        )}

        <div className="px-1 text-xs text-slate-500 leading-relaxed">
          <p className="font-medium text-slate-700">CSV Timetable Source</p>
          <p className="mt-0.5">Synced per student account from uploaded schedule CSV.</p>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              onRequestResetDemo();
              onCloseMobile();
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 min-h-[38px] rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            <span>Reload CSV Data</span>
          </button>

          {onSignOut && (
            <button
              type="button"
              onClick={() => {
                onCloseMobile();
                onSignOut();
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 min-h-[38px] rounded-lg border border-rose-200 bg-rose-50/60 text-xs font-semibold text-rose-700 hover:bg-rose-100/80 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <LogOut className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" />
              <span>Log Out</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop fixed sidebar */}
      <aside className="hidden lg:block lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile slide-over drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div
            className="fixed inset-0 bg-slate-900/35 backdrop-blur-[1px] transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] shadow-xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
