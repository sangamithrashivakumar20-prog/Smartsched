import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  BellOff,
  BellRing,
  BookOpenCheck,
  CalendarDays,
  Check,
  CheckCheck,
  CheckCircle2,
  CheckSquare,
  Clock,
  Info,
  MailOpen,
  Plus,
  Settings,
  Trash2,
} from 'lucide-react';
import {
  AppNotification,
  Assignment,
  CLASS_REMINDER_OPTIONS,
  ClassReminderLeadMinutes,
  NotificationPreferences,
  NotificationType,
  REMINDER_OPTIONS,
  Reminder,
  ReminderOffsetMinutes,
  STUDY_REMINDER_OPTIONS,
  StudyReminderLeadMinutes,
  StudySession,
  TimetableEvent,
} from '../types/scheduler';
import {
  combineDateAndTime,
  formatDateTimeReadable,
  formatRelativeDuration,
  formatShortDate,
  formatTimeDisplay,
  formatTimeRange,
  getAssignmentDeadlineStatus,
  getReminderTriggerDate,
  getTodayDayOfWeek,
  timeToMinutes,
  toLocalDateString,
} from '../utils/dateUtils';
import { formatDurationLabel } from '../utils/studyScheduler';

export type RemindersTab = 'center' | 'upcoming' | 'settings';
type CenterFilter = 'all' | 'unread' | NotificationType;

interface RemindersViewProps {
  reminders: Reminder[];
  assignments: Assignment[];
  events: TimetableEvent[];
  studySessions: StudySession[];
  notifications: AppNotification[];
  notificationPrefs: NotificationPreferences;
  now: Date;
  initialTab?: RemindersTab;
  onAddReminder: (defaultAssignmentId?: string) => void;
  onQuickCreateReminder: (
    assignmentId: string,
    offsetMinutes: ReminderOffsetMinutes
  ) => void;
  onUpdateReminderOffset: (id: string, offsetMinutes: ReminderOffsetMinutes) => void;
  onToggleReminderEnabled: (id: string) => void;
  onDismissReminderAlert: (id: string) => void;
  onDeleteReminder: (reminder: Reminder, assignmentTitle: string) => void;
  onUpdateNotificationPrefs: (patch: Partial<NotificationPreferences>) => void;
  onToggleNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  onDeleteNotification: (id: string) => void;
  onClearAllNotifications: () => void;
  onTriggerTestNotification: () => void;
}

function getNotificationVisual(type: NotificationType) {
  switch (type) {
    case 'class':
      return {
        label: 'Class Reminder',
        icon: CalendarDays,
        bg: 'bg-blue-50',
        text: 'text-blue-600',
      };
    case 'assignment':
      return {
        label: 'Assignment Reminder',
        icon: CheckSquare,
        bg: 'bg-indigo-50',
        text: 'text-indigo-600',
      };
    case 'study':
      return {
        label: 'Study Reminder',
        icon: BookOpenCheck,
        bg: 'bg-violet-50',
        text: 'text-violet-600',
      };
  }
}

export function RemindersView({
  reminders,
  assignments,
  events,
  studySessions,
  notifications,
  notificationPrefs,
  now,
  initialTab = 'center',
  onAddReminder,
  onQuickCreateReminder,
  onUpdateReminderOffset,
  onToggleReminderEnabled,
  onDismissReminderAlert,
  onDeleteReminder,
  onUpdateNotificationPrefs,
  onToggleNotificationRead,
  onMarkAllNotificationsRead,
  onDeleteNotification,
  onClearAllNotifications,
  onTriggerTestNotification,
}: RemindersViewProps) {
  const [activeTab, setActiveTab] = useState<RemindersTab>(initialTab);
  const [centerFilter, setCenterFilter] = useState<CenterFilter>('all');
  const [notifPermission, setNotifPermission] = useState<string>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const syncPermission = () => {
      if (typeof Notification !== 'undefined') {
        setNotifPermission(Notification.permission);
      }
    };
    window.addEventListener('focus', syncPermission);
    return () => window.removeEventListener('focus', syncPermission);
  }, []);

  const handleRequestPermission = async () => {
    if (typeof Notification === 'undefined') return;
    try {
      const result = await Notification.requestPermission();
      setNotifPermission(result);
      if (result === 'granted') {
        onUpdateNotificationPrefs({ browserNotificationsEnabled: true });
      }
    } catch {
      // Ignore permission request errors in restricted contexts
    }
  };

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (centerFilter === 'unread') return !n.read;
      if (
        centerFilter === 'class' ||
        centerFilter === 'assignment' ||
        centerFilter === 'study'
      ) {
        return n.type === centerFilter;
      }
      return true;
    });
  }, [notifications, centerFilter]);

  // Enriched Assignment Reminder rules
  const enrichedReminders = useMemo(() => {
    return reminders
      .map((rem) => {
        const assignment = assignments.find((a) => a.id === rem.assignmentId);
        if (!assignment) return null;
        const triggerDate = getReminderTriggerDate(assignment, rem.offsetMinutes);
        const isTriggered =
          rem.enabled &&
          assignment.status === 'Pending' &&
          triggerDate.getTime() <= now.getTime();
        return {
          reminder: rem,
          assignment,
          triggerDate,
          isTriggered,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.triggerDate.getTime() - b.triggerDate.getTime());
  }, [reminders, assignments, now]);

  const dueAlerts = enrichedReminders.filter(
    (item) => item.isTriggered && !item.reminder.dismissed
  );

  const pendingWithoutReminders = useMemo(() => {
    const coveredIds = new Set(reminders.map((r) => r.assignmentId));
    return assignments.filter((a) => a.status === 'Pending' && !coveredIds.has(a.id));
  }, [assignments, reminders]);

  // Today's Class Reminders (using timetable + classLeadMinutes)
  const todayStr = toLocalDateString(now);
  const todayDay = getTodayDayOfWeek(now);
  const todayClassReminders = useMemo(() => {
    if (!todayDay) return [];
    return events
      .filter((ev) => ev.day === todayDay)
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
      .map((ev) => {
        const startAt = combineDateAndTime(todayStr, ev.startTime);
        const endAt = combineDateAndTime(todayStr, ev.endTime);
        const triggerAt = new Date(
          startAt.getTime() - notificationPrefs.classLeadMinutes * 60_000
        );
        const status =
          now.getTime() >= endAt.getTime()
            ? 'done'
            : now.getTime() >= startAt.getTime()
              ? 'ongoing'
              : now.getTime() >= triggerAt.getTime()
                ? 'due'
                : 'scheduled';
        return { event: ev, startAt, triggerAt, status };
      });
  }, [events, todayDay, todayStr, notificationPrefs.classLeadMinutes, now]);

  // Due Today & Upcoming Assignments
  const upcomingAssignmentsList = useMemo(() => {
    return assignments
      .filter((a) => a.status === 'Pending')
      .map((asg) => ({
        assignment: asg,
        dueAt: combineDateAndTime(asg.dueDate, asg.dueTime),
        deadlineStatus: getAssignmentDeadlineStatus(asg, now),
        hasCustomReminder: reminders.some(
          (r) => r.assignmentId === asg.id && r.enabled
        ),
      }))
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  }, [assignments, reminders, now]);

  // Upcoming Study Session Reminders
  const upcomingStudyReminders = useMemo(() => {
    return studySessions
      .filter((s) => s.status === 'Pending')
      .map((sess) => {
        const startAt = combineDateAndTime(sess.date, sess.startTime);
        const endAt = new Date(startAt.getTime() + sess.durationMinutes * 60_000);
        const triggerAt = new Date(
          startAt.getTime() - notificationPrefs.studyLeadMinutes * 60_000
        );
        return { session: sess, startAt, endAt, triggerAt };
      })
      .filter((item) => item.endAt.getTime() >= now.getTime())
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  }, [studySessions, notificationPrefs.studyLeadMinutes, now]);

  return (
    <div className="space-y-5">
      {/* Header & Tabs */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900">
              Notifications &amp; Reminders
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Manage alerts for your timetable classes, assignment deadlines, and planned study sessions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {notifPermission === 'default' && (
              <button
                type="button"
                onClick={handleRequestPermission}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                <BellRing className="h-4 w-4 text-blue-600 shrink-0" aria-hidden="true" />
                <span>Enable Browser Alerts</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onAddReminder()}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg bg-indigo-600 text-xs sm:text-sm font-medium text-white hover:bg-indigo-700 transition-colors whitespace-nowrap"
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Add Assignment Reminder</span>
            </button>
          </div>
        </div>

        {/* Sub-view Switcher */}
        <div
          role="tablist"
          aria-label="Notifications and reminders sections"
          className="inline-flex flex-wrap gap-1.5 rounded-lg bg-slate-100 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'center'}
            onClick={() => setActiveTab('center')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 min-h-[38px] rounded-md text-xs sm:text-sm font-medium transition-colors ${
              activeTab === 'center'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bell className="h-4 w-4 text-indigo-600" aria-hidden="true" />
            <span>Notification Center</span>
            {unreadCount > 0 && (
              <span className="font-mono text-xs tabular-nums font-semibold text-indigo-600">
                ({unreadCount})
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'upcoming'}
            onClick={() => setActiveTab('upcoming')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 min-h-[38px] rounded-md text-xs sm:text-sm font-medium transition-colors ${
              activeTab === 'upcoming'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="h-4 w-4 text-blue-600" aria-hidden="true" />
            <span>Upcoming &amp; Rules</span>
            {dueAlerts.length > 0 && (
              <span className="font-mono text-xs tabular-nums font-semibold text-amber-600">
                ({dueAlerts.length})
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 min-h-[38px] rounded-md text-xs sm:text-sm font-medium transition-colors ${
              activeTab === 'settings'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings className="h-4 w-4 text-violet-600" aria-hidden="true" />
            <span>Notification Settings</span>
          </button>
        </div>
      </section>

      {/* Active Due Assignment Alerts Banner */}
      {dueAlerts.length > 0 && (
        <section
          aria-label="Triggered reminders"
          className="rounded-xl border border-amber-200 bg-amber-50/70 p-5 space-y-3"
        >
          <div className="flex items-center gap-2 text-amber-900">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" aria-hidden="true" />
            <h2 className="font-display text-sm font-semibold">
              Active Assignment Alerts ({dueAlerts.length})
            </h2>
          </div>

          <ul className="divide-y divide-amber-200/70">
            {dueAlerts.map(({ reminder, assignment, triggerDate }) => (
              <li
                key={reminder.id}
                className="py-2.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {assignment.title}
                  </p>
                  <p className="text-xs text-slate-700">
                    {assignment.subject} · Due {formatShortDate(assignment.dueDate)} at{' '}
                    <span className="font-mono tabular-nums">
                      {formatTimeDisplay(assignment.dueTime)}
                    </span>{' '}
                    (triggered {formatRelativeDuration(triggerDate, now).toLowerCase()})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onDismissReminderAlert(reminder.id)}
                  className="self-start sm:self-center px-3 py-1.5 min-h-[34px] rounded-lg border border-amber-300 bg-white text-xs font-medium text-amber-900 hover:bg-amber-100/70 transition-colors whitespace-nowrap"
                >
                  Dismiss Alert
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* TAB 1: NOTIFICATION CENTER */}
      {activeTab === 'center' && (
        <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'all', label: `All (${notifications.length})` },
                  { id: 'unread', label: `Unread (${unreadCount})` },
                  { id: 'class', label: 'Classes' },
                  { id: 'assignment', label: 'Assignments' },
                  { id: 'study', label: 'Study' },
                ] as { id: CenterFilter; label: string }[]
              ).map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setCenterFilter(filter.id)}
                  className={`px-3 py-1.5 min-h-[34px] rounded-lg text-xs font-medium transition-colors ${
                    centerFilter === filter.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllNotificationsRead}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg border border-slate-200 bg-white text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
                >
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Mark all read</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={onClearAllNotifications}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Clear all</span>
                </button>
              )}
            </div>
          </div>

          {filteredNotifications.length === 0 ? (
            <div className="p-10 text-center">
              <Bell className="mx-auto h-9 w-9 text-slate-300" aria-hidden="true" />
              <h2 className="mt-3 font-display text-base font-semibold text-slate-900">
                {notifications.length === 0
                  ? 'No notifications yet'
                  : 'No notifications match this filter'}
              </h2>
              <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
                {notifications.length === 0
                  ? 'Triggered alerts for upcoming classes, assignment deadlines, and study sessions will appear here while SmartSched is open.'
                  : 'Try switching filters or view Upcoming & Rules to check scheduled reminders.'}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={onTriggerTestNotification}
                  className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <BellRing className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                  <span>Send Test Alert</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg bg-indigo-600 text-xs sm:text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                >
                  <Settings className="h-4 w-4" aria-hidden="true" />
                  <span>Notification Settings</span>
                </button>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filteredNotifications.map((notif) => {
                const visual = getNotificationVisual(notif.type);
                const Icon = visual.icon;
                const createdDate = new Date(notif.createdAt);

                return (
                  <li
                    key={notif.id}
                    className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                      notif.read
                        ? 'bg-white hover:bg-slate-50/70'
                        : 'bg-blue-50/40 hover:bg-blue-50/65'
                    }`}
                  >
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <span
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${visual.bg} ${visual.text}`}
                      >
                        <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                          <span className="font-medium text-slate-700">
                            {visual.label}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {formatDateTimeReadable(createdDate)}
                          </span>
                          {!notif.read && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1 font-semibold text-indigo-600">
                                <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                                <span>Unread</span>
                              </span>
                            </>
                          )}
                        </div>

                        <h3
                          className={`mt-1 text-sm sm:text-base ${
                            notif.read
                              ? 'font-medium text-slate-700'
                              : 'font-semibold text-slate-900'
                          }`}
                        >
                          {notif.title}
                        </h3>
                        <p className="mt-0.5 text-xs sm:text-sm text-slate-600">
                          {notif.message}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => onToggleNotificationRead(notif.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                      >
                        {notif.read ? (
                          <>
                            <MailOpen className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                            <span>Mark Unread</span>
                          </>
                        ) : (
                          <>
                            <Check className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />
                            <span>Mark Read</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteNotification(notif.id)}
                        aria-label={`Delete notification: ${notif.title}`}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* TAB 2: UPCOMING REMINDERS & ASSIGNMENT RULES */}
      {activeTab === 'upcoming' && (
        <div className="space-y-5">
          {/* Today's Class Reminders + Upcoming Study Reminders */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Today's Class Reminders */}
            <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-slate-900">
                    Today&apos;s Class Reminders
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {notificationPrefs.classRemindersEnabled
                      ? `Alerting ${notificationPrefs.classLeadMinutes} minutes before each class`
                      : 'Class reminders are currently paused in Settings'}
                  </p>
                </div>
                <span className="font-mono text-xs tabular-nums text-slate-500">
                  {todayClassReminders.length} classes
                </span>
              </div>

              {todayClassReminders.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  {todayDay === null
                    ? 'No college classes scheduled on Sunday.'
                    : `No classes scheduled for ${todayDay}.`}
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {todayClassReminders.map(({ event, triggerAt, status }) => (
                    <li
                      key={event.id}
                      className="px-5 py-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {event.subject}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {event.type} ·{' '}
                          <span className="font-mono tabular-nums">
                            {formatTimeRange(event.startTime, event.endTime)}
                          </span>{' '}
                          · Room {event.venue}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {!notificationPrefs.classRemindersEnabled ? (
                          <span className="text-xs text-slate-400">Paused</span>
                        ) : status === 'done' ? (
                          <span className="text-xs text-slate-400">Ended</span>
                        ) : status === 'ongoing' ? (
                          <span className="text-xs font-semibold text-blue-600">
                            In progress
                          </span>
                        ) : status === 'due' ? (
                          <span className="text-xs font-semibold text-amber-700">
                            Starting soon
                          </span>
                        ) : (
                          <span className="font-mono text-xs tabular-nums font-medium text-indigo-700">
                            Alert at{' '}
                            {triggerAt.toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Upcoming Study Session Reminders */}
            <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-slate-900">
                    Study Session Reminders
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {notificationPrefs.studyRemindersEnabled
                      ? `Alerting ${notificationPrefs.studyLeadMinutes} minutes before planned sessions`
                      : 'Study session reminders are paused in Settings'}
                  </p>
                </div>
                <span className="font-mono text-xs tabular-nums text-slate-500">
                  {upcomingStudyReminders.length} upcoming
                </span>
              </div>

              {upcomingStudyReminders.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  No upcoming pending study sessions scheduled.
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {upcomingStudyReminders.slice(0, 6).map(({ session, triggerAt }) => (
                    <li
                      key={session.id}
                      className="px-5 py-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {session.subject}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 truncate">
                          {session.topic} · {formatShortDate(session.date)} at{' '}
                          <span className="font-mono tabular-nums">
                            {formatTimeDisplay(session.startTime)}
                          </span>{' '}
                          ({formatDurationLabel(session.durationMinutes)})
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {!notificationPrefs.studyRemindersEnabled ? (
                          <span className="text-xs text-slate-400">Paused</span>
                        ) : (
                          <span className="font-mono text-xs tabular-nums font-medium text-violet-700">
                            {formatRelativeDuration(triggerAt, now)}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Due Today & Upcoming Assignment Deadlines */}
          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Assignment Deadlines Overview
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Assignments due today, overdue, and upcoming deadlines covered by assignment reminders.
                </p>
              </div>
              <span className="font-mono text-xs tabular-nums text-slate-500">
                {upcomingAssignmentsList.length} pending
              </span>
            </div>

            {upcomingAssignmentsList.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                All assignments are completed.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {upcomingAssignmentsList.map(
                  ({ assignment, deadlineStatus, hasCustomReminder }) => (
                    <li
                      key={assignment.id}
                      className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {assignment.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {assignment.subject} · Due{' '}
                          <span className="font-mono tabular-nums">
                            {formatShortDate(assignment.dueDate)},{' '}
                            {formatTimeDisplay(assignment.dueTime)}
                          </span>{' '}
                          · {assignment.priority} priority
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`text-xs font-semibold ${
                            deadlineStatus === 'Overdue'
                              ? 'text-red-600'
                              : deadlineStatus === 'Due Today'
                                ? 'text-amber-700'
                                : 'text-blue-700'
                          }`}
                        >
                          {deadlineStatus}
                        </span>
                        <span className="text-xs text-slate-400" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-xs text-slate-600">
                          {hasCustomReminder
                            ? 'Custom rule active'
                            : notificationPrefs.assignmentRemindersEnabled
                              ? 'Default rule active'
                              : 'Alerts paused'}
                        </span>
                      </div>
                    </li>
                  )
                )}
              </ul>
            )}
          </section>

          {/* Configured Assignment Reminders List */}
          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Configured Assignment Reminders
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Adjust notification lead time, pause alerts, or remove per-assignment reminders.
                </p>
              </div>
              <span className="font-mono text-xs tabular-nums text-slate-500">
                {enrichedReminders.length} total
              </span>
            </div>

            {enrichedReminders.length === 0 ? (
              <div className="p-10 text-center">
                <Bell className="mx-auto h-9 w-9 text-slate-300" aria-hidden="true" />
                <h3 className="mt-3 font-display text-base font-semibold text-slate-900">
                  No custom assignment reminders
                </h3>
                <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
                  Add a custom reminder for any pending assignment to choose a specific lead time.
                </p>
                <button
                  type="button"
                  onClick={() => onAddReminder()}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Add Reminder</span>
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {enrichedReminders.map(({ reminder, assignment, triggerDate, isTriggered }) => {
                  const isCompleted = assignment.status === 'Completed';
                  return (
                    <li
                      key={reminder.id}
                      className={`p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                        !reminder.enabled || isCompleted
                          ? 'bg-slate-50/50'
                          : 'hover:bg-slate-50/60'
                      } transition-colors`}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          <h3
                            className={`text-sm sm:text-base font-semibold ${
                              isCompleted ? 'text-slate-500 line-through' : 'text-slate-900'
                            }`}
                          >
                            {assignment.title}
                          </h3>
                          <span className="text-xs font-medium text-indigo-700">
                            {assignment.subject}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                          <span className="font-mono tabular-nums">
                            Alert: {formatDateTimeReadable(triggerDate)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            Due: {formatShortDate(assignment.dueDate)},{' '}
                            {formatTimeDisplay(assignment.dueTime)}
                          </span>
                          <span aria-hidden="true">·</span>
                          {isCompleted ? (
                            <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Assignment completed</span>
                            </span>
                          ) : !reminder.enabled ? (
                            <span className="inline-flex items-center gap-1 text-slate-500">
                              <BellOff className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Paused</span>
                            </span>
                          ) : isTriggered ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>
                                Triggered ({formatRelativeDuration(triggerDate, now)})
                              </span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-medium text-blue-700">
                              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>{formatRelativeDuration(triggerDate, now)}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                        <label className="sr-only" htmlFor={`offset-${reminder.id}`}>
                          Reminder timing for {assignment.title}
                        </label>
                        <select
                          id={`offset-${reminder.id}`}
                          value={String(reminder.offsetMinutes)}
                          onChange={(e) =>
                            onUpdateReminderOffset(
                              reminder.id,
                              Number(e.target.value) as ReminderOffsetMinutes
                            )
                          }
                          className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        >
                          {REMINDER_OPTIONS.map((opt) => (
                            <option key={opt.value} value={String(opt.value)}>
                              {opt.label}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => onToggleReminderEnabled(reminder.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
                            reminder.enabled
                              ? 'border-indigo-200 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100/80'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {reminder.enabled ? (
                            <>
                              <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Enabled</span>
                            </>
                          ) : (
                            <>
                              <BellOff className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Paused</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeleteReminder(reminder, assignment.title)}
                          aria-label={`Delete reminder for ${assignment.title}`}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Pending Assignments Without Custom Reminders */}
          {pendingWithoutReminders.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Pending Assignments Without Custom Rules
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Attach a specific reminder lead time to any pending assignment.
                </p>
              </div>

              <ul className="divide-y divide-slate-100">
                {pendingWithoutReminders.map((asg) => (
                  <li
                    key={asg.id}
                    className="px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {asg.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {asg.subject} · Due{' '}
                        <span className="font-mono tabular-nums">
                          {formatShortDate(asg.dueDate)}, {formatTimeDisplay(asg.dueTime)}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      {REMINDER_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => onQuickCreateReminder(asg.id, opt.value)}
                          className="px-2.5 py-1.5 min-h-[34px] rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/70 hover:text-indigo-700 transition-colors whitespace-nowrap"
                        >
                          {opt.value === 15
                            ? '15m before'
                            : opt.value === 30
                              ? '30m before'
                              : opt.value === 60
                                ? '1h before'
                                : '1d before'}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* TAB 3: NOTIFICATION SETTINGS */}
      {activeTab === 'settings' && (
        <div className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
            <div className="p-5">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Reminder Categories &amp; Lead Times
              </h2>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
                Choose which reminders are active and how early SmartSched should alert you.
              </p>
            </div>

            {/* Class Reminders Setting */}
            <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <CalendarDays className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Class Reminders
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Remind me before classes from my timetable begin.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <label className="sr-only" htmlFor="pref-class-lead">
                  Class reminder lead time
                </label>
                <select
                  id="pref-class-lead"
                  disabled={!notificationPrefs.classRemindersEnabled}
                  value={String(notificationPrefs.classLeadMinutes)}
                  onChange={(e) =>
                    onUpdateNotificationPrefs({
                      classLeadMinutes: Number(e.target.value) as ClassReminderLeadMinutes,
                    })
                  }
                  className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  {CLASS_REMINDER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  role="switch"
                  aria-checked={notificationPrefs.classRemindersEnabled}
                  aria-label="Toggle class reminders"
                  onClick={() =>
                    onUpdateNotificationPrefs({
                      classRemindersEnabled: !notificationPrefs.classRemindersEnabled,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    notificationPrefs.classRemindersEnabled
                      ? 'bg-indigo-600'
                      : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      notificationPrefs.classRemindersEnabled
                        ? 'translate-x-6'
                        : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Assignment Reminders Setting */}
            <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <CheckSquare className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Assignment Deadline Reminders
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Alert me for assignments due today and upcoming deadlines using custom rules or this default lead time.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <label className="sr-only" htmlFor="pref-assignment-lead">
                  Default assignment reminder lead time
                </label>
                <select
                  id="pref-assignment-lead"
                  disabled={!notificationPrefs.assignmentRemindersEnabled}
                  value={String(notificationPrefs.assignmentDefaultLeadMinutes)}
                  onChange={(e) =>
                    onUpdateNotificationPrefs({
                      assignmentDefaultLeadMinutes: Number(
                        e.target.value
                      ) as ReminderOffsetMinutes,
                    })
                  }
                  className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  {REMINDER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  role="switch"
                  aria-checked={notificationPrefs.assignmentRemindersEnabled}
                  aria-label="Toggle assignment reminders"
                  onClick={() =>
                    onUpdateNotificationPrefs({
                      assignmentRemindersEnabled:
                        !notificationPrefs.assignmentRemindersEnabled,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    notificationPrefs.assignmentRemindersEnabled
                      ? 'bg-indigo-600'
                      : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      notificationPrefs.assignmentRemindersEnabled
                        ? 'translate-x-6'
                        : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Study Session Reminders Setting */}
            <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                  <BookOpenCheck className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Study Session Reminders
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Remind me before planned Study Planner sessions begin.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <label className="sr-only" htmlFor="pref-study-lead">
                  Study session reminder lead time
                </label>
                <select
                  id="pref-study-lead"
                  disabled={!notificationPrefs.studyRemindersEnabled}
                  value={String(notificationPrefs.studyLeadMinutes)}
                  onChange={(e) =>
                    onUpdateNotificationPrefs({
                      studyLeadMinutes: Number(
                        e.target.value
                      ) as StudyReminderLeadMinutes,
                    })
                  }
                  className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  {STUDY_REMINDER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  role="switch"
                  aria-checked={notificationPrefs.studyRemindersEnabled}
                  aria-label="Toggle study session reminders"
                  onClick={() =>
                    onUpdateNotificationPrefs({
                      studyRemindersEnabled: !notificationPrefs.studyRemindersEnabled,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    notificationPrefs.studyRemindersEnabled
                      ? 'bg-indigo-600'
                      : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      notificationPrefs.studyRemindersEnabled
                        ? 'translate-x-6'
                        : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>

          {/* Browser Notification Delivery & Limitations */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Browser &amp; In-App Delivery
                </h2>
                <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
                  Permission status:{' '}
                  <span className="font-semibold text-slate-800">
                    {notifPermission === 'granted'
                      ? 'Granted'
                      : notifPermission === 'denied'
                        ? 'Blocked in browser settings'
                        : notifPermission === 'unsupported'
                          ? 'Not supported in this browser'
                          : 'Not requested yet'}
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {notifPermission === 'default' && (
                  <button
                    type="button"
                    onClick={handleRequestPermission}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-lg border border-indigo-200 bg-indigo-50 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
                  >
                    <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Allow Browser Notifications</span>
                  </button>
                )}

                {notifPermission === 'granted' && (
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationPrefs.browserNotificationsEnabled}
                      onChange={(e) =>
                        onUpdateNotificationPrefs({
                          browserNotificationsEnabled: e.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Send desktop/browser popups</span>
                  </label>
                )}

                <button
                  type="button"
                  onClick={onTriggerTestNotification}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Bell className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />
                  <span>Send Test Alert</span>
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed">
              <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
              <p>
                <strong>How reminders work:</strong> Reminders trigger in-app notifications (and browser notifications when permitted) only while SmartSched is open in your browser. Notifications cannot be delivered when the app tab or browser is closed.
              </p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
