import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BookOpenCheck,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCheck,
  CheckSquare,
  Menu,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { AppNotification, NotificationType, PageView } from '../types/scheduler';
import { formatDateTimeReadable } from '../utils/dateUtils';

interface TopBarProps {
  activePage: PageView;
  onOpenMobileMenu: () => void;
  onQuickAddClass: () => void;
  onQuickAddAssignment: () => void;
  notifications: AppNotification[];
  onToggleNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  onDeleteNotification: (id: string) => void;
  onClearAllNotifications: () => void;
  onOpenNotificationCenter: () => void;
}

const PAGE_TITLES: Record<PageView, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Daily schedule & deadline summary',
  },
  timetable: {
    title: 'Weekly Timetable',
    subtitle: 'Monday through Saturday',
  },
  'study-planner': {
    title: 'Study Planner',
    subtitle: 'Plan study sessions around your classes',
  },
  assignments: {
    title: 'Assignments',
    subtitle: 'Coursework, deadlines & status',
  },
  reminders: {
    title: 'Notifications & Reminders',
    subtitle: 'Alerts, upcoming schedule & preferences',
  },
  analytics: {
    title: 'Progress Analytics',
    subtitle: 'Assignments, study hours & subject progress',
  },
};

function getTypeMeta(type: NotificationType): {
  label: string;
  icon: typeof CalendarDays;
  iconBg: string;
  iconText: string;
} {
  switch (type) {
    case 'class':
      return {
        label: 'Class',
        icon: CalendarDays,
        iconBg: 'bg-blue-50',
        iconText: 'text-blue-600',
      };
    case 'assignment':
      return {
        label: 'Assignment',
        icon: CheckSquare,
        iconBg: 'bg-indigo-50',
        iconText: 'text-indigo-600',
      };
    case 'study':
      return {
        label: 'Study',
        icon: BookOpenCheck,
        iconBg: 'bg-violet-50',
        iconText: 'text-violet-600',
      };
  }
}

export function TopBar({
  activePage,
  onOpenMobileMenu,
  onQuickAddClass,
  onQuickAddAssignment,
  notifications,
  onToggleNotificationRead,
  onMarkAllNotificationsRead,
  onDeleteNotification,
  onClearAllNotifications,
  onOpenNotificationCenter,
}: TopBarProps) {
  const meta = PAGE_TITLES[activePage];
  const [panelOpen, setPanelOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!panelOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setPanelOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPanelOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [panelOpen]);

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-display font-semibold text-slate-900 truncate whitespace-nowrap">
              {meta.title}
            </span>
            <span className="hidden sm:inline text-slate-300" aria-hidden="true">
              /
            </span>
            <span className="hidden sm:inline text-slate-500 truncate whitespace-nowrap">
              {meta.subtitle}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Notification Bell & Dropdown Panel */}
        <div className="relative" ref={containerRef}>
          <button
            type="button"
            onClick={() => setPanelOpen((prev) => !prev)}
            aria-expanded={panelOpen}
            aria-haspopup="dialog"
            aria-label={
              unreadCount > 0
                ? `Notifications (${unreadCount} unread)`
                : 'Notifications'
            }
            className={`relative flex h-10 w-10 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              panelOpen
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Bell className="h-4.5 w-4.5" aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-600 text-white font-mono text-[10px] font-semibold tabular-nums flex items-center justify-center shadow-xs">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {panelOpen && (
            <div
              role="dialog"
              aria-label="Notification panel"
              className="fixed inset-x-4 top-[4.25rem] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 rounded-xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="font-display text-sm font-semibold text-slate-900">
                    Notifications
                  </h2>
                  {unreadCount > 0 && (
                    <span className="font-mono text-xs tabular-nums text-indigo-600 font-semibold">
                      {unreadCount} unread
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={onMarkAllNotificationsRead}
                      title="Mark all as read"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
                    >
                      <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Read all</span>
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={onClearAllNotifications}
                      title="Clear all notifications"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Clear</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPanelOpen(false)}
                    aria-label="Close notifications panel"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {notifications.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <Bell
                    className="mx-auto h-8 w-8 text-slate-300"
                    aria-hidden="true"
                  />
                  <p className="mt-2.5 text-sm font-medium text-slate-900">
                    You&apos;re all caught up
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Class, assignment, and study session reminders will appear here while SmartSched is open.
                  </p>
                </div>
              ) : (
                <ul className="max-h-[55vh] overflow-y-auto divide-y divide-slate-100">
                  {notifications.slice(0, 20).map((notif) => {
                    const typeMeta = getTypeMeta(notif.type);
                    const TypeIcon = typeMeta.icon;
                    const createdDate = new Date(notif.createdAt);

                    return (
                      <li
                        key={notif.id}
                        className={`px-4 py-3 transition-colors ${
                          notif.read
                            ? 'bg-white hover:bg-slate-50/70'
                            : 'bg-blue-50/45 hover:bg-blue-50/70'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${typeMeta.iconBg} ${typeMeta.iconText}`}
                          >
                            <TypeIcon className="h-4 w-4" aria-hidden="true" />
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-medium text-slate-500">
                                {typeMeta.label} ·{' '}
                                <span className="font-mono tabular-nums">
                                  {formatDateTimeReadable(createdDate)}
                                </span>
                              </span>
                              {!notif.read && (
                                <span
                                  className="h-2 w-2 rounded-full bg-indigo-600 shrink-0"
                                  aria-label="Unread"
                                />
                              )}
                            </div>

                            <p
                              className={`mt-0.5 text-xs sm:text-sm leading-snug ${
                                notif.read
                                  ? 'font-medium text-slate-700'
                                  : 'font-semibold text-slate-900'
                              }`}
                            >
                              {notif.title}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                              {notif.message}
                            </p>

                            <div className="mt-2 flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => onToggleNotificationRead(notif.id)}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                              >
                                <Check className="h-3 w-3" aria-hidden="true" />
                                <span>
                                  {notif.read ? 'Mark unread' : 'Mark read'}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => onDeleteNotification(notif.id)}
                                className="text-[11px] font-medium text-slate-400 hover:text-red-600 transition-colors"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setPanelOpen(false);
                    onOpenNotificationCenter();
                  }}
                  className="w-full py-1.5 text-center text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  Open Notification Center &amp; Settings
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onQuickAddClass}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <CalendarPlus className="h-4 w-4 text-blue-600 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">Add Class</span>
          <span className="sm:hidden">Class</span>
        </button>

        <button
          type="button"
          onClick={onQuickAddAssignment}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg bg-indigo-600 text-xs sm:text-sm font-medium text-white hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">Add Assignment</span>
          <span className="sm:hidden">Task</span>
        </button>
      </div>
    </header>
  );
}
