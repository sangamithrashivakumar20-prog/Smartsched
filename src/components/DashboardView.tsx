import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Flag,
  MapPin,
  Plus,
  Radio,
  User,
} from 'lucide-react';
import {
  Assignment,
  DAYS_OF_WEEK,
  DayOfWeek,
  PageView,
  Reminder,
  StudySession,
  TimetableEvent,
} from '../types/scheduler';
import {
  combineDateAndTime,
  formatDateTimeReadable,
  formatFullDate,
  formatLiveCountdown,
  formatRelativeDuration,
  formatShortDate,
  formatTimeDisplay,
  formatTimeRange,
  getAssignmentDeadlineStatus,
  getClassLiveStatus,
  getEventDurationHours,
  getGreeting,
  getOngoingAndNextClass,
  getReminderOffsetLabel,
  getReminderTriggerDate,
  getTodayDayOfWeek,
  isAssignmentDueToday,
  isAssignmentOverdue,
  timeToMinutes,
  toLocalDateString,
} from '../utils/dateUtils';
import {
  computeAssignmentAnalytics,
  computeProductivityIndicator,
  computeWeeklyStudyAnalytics,
} from '../utils/analytics';
import {
  formatDurationLabel,
  getMondayOfWeek,
  getStudyEndTime,
} from '../utils/studyScheduler';

interface DashboardViewProps {
  now: Date;
  events: TimetableEvent[];
  assignments: Assignment[];
  reminders: Reminder[];
  studySessions: StudySession[];
  studentName?: string;
  onNavigate: (page: PageView, dayFilter?: DayOfWeek) => void;
  onAddClass: () => void;
  onAddAssignment: () => void;
  onPlanStudy: () => void;
  onToggleAssignment: (id: string) => void;
  onToggleStudySession: (id: string) => void;
}

export function DashboardView({
  now,
  events,
  assignments,
  reminders,
  studySessions,
  studentName,
  onNavigate,
  onAddClass,
  onAddAssignment,
  onPlanStudy,
  onToggleAssignment,
  onToggleStudySession,
}: DashboardViewProps) {
  const todayDay = getTodayDayOfWeek(now);
  const greeting = getGreeting(now);
  const formattedToday = formatFullDate(now);

  // Today's classes sorted chronologically
  const todayClasses = (todayDay ? events.filter((e) => e.day === todayDay) : []).sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );

  const { ongoing, nextToday, nextUpcoming } = getOngoingAndNextClass(events, now);

  const pendingAssignments = assignments.filter((a) => a.status === 'Pending');
  const completedAssignments = assignments.filter((a) => a.status === 'Completed');
  const overdueAssignments = pendingAssignments.filter((a) => isAssignmentOverdue(a, now));
  const dueTodayAssignments = pendingAssignments
    .filter((a) => isAssignmentDueToday(a, now))
    .sort(
      (a, b) =>
        combineDateAndTime(a.dueDate, a.dueTime).getTime() -
        combineDateAndTime(b.dueDate, b.dueTime).getTime()
    );

  const sortedPendingAssignments = [...pendingAssignments].sort(
    (a, b) =>
      combineDateAndTime(a.dueDate, a.dueTime).getTime() -
      combineDateAndTime(b.dueDate, b.dueTime).getTime()
  );

  // Next upcoming assignment (nearest non-overdue pending assignment, or earliest pending if all overdue)
  const nextUpcomingAssignment =
    sortedPendingAssignments.find((a) => !isAssignmentOverdue(a, now)) ??
    sortedPendingAssignments[0] ??
    null;

  const upcomingAssignments = sortedPendingAssignments.slice(0, 5);

  const activeReminders = reminders
    .map((rem) => {
      const assignment = assignments.find((a) => a.id === rem.assignmentId);
      if (!assignment || assignment.status === 'Completed' || !rem.enabled) return null;
      return {
        reminder: rem,
        assignment,
        triggerDate: getReminderTriggerDate(assignment, rem.offsetMinutes),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.triggerDate.getTime() - b.triggerDate.getTime());

  // Weekly hours breakdown Mon-Sat
  const weeklySummary = DAYS_OF_WEEK.map((day) => {
    const dayEvents = events.filter((e) => e.day === day);
    const hours = dayEvents.reduce(
      (sum, ev) => sum + getEventDurationHours(ev.startTime, ev.endTime),
      0
    );
    return { day, count: dayEvents.length, hours };
  });

  const maxDailyHours = Math.max(4, ...weeklySummary.map((d) => d.hours));
  const totalWeeklyHours = weeklySummary.reduce((sum, d) => sum + d.hours, 0);
  const totalAssignments = assignments.length;
  const completionPct =
    totalAssignments > 0
      ? Math.round((completedAssignments.length / totalAssignments) * 100)
      : 0;

  const nextReminder = activeReminders[0];

  const todayDateStr = toLocalDateString(now);
  const todayStudySessions = studySessions
    .filter((s) => s.date === todayDateStr)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  const nextStudySession =
    studySessions
      .filter((s) => {
        if (s.status !== 'Pending') return false;
        const startObj = combineDateAndTime(s.date, s.startTime);
        return startObj.getTime() >= now.getTime() - 15 * 60_000;
      })
      .sort(
        (a, b) =>
          combineDateAndTime(a.date, a.startTime).getTime() -
          combineDateAndTime(b.date, b.startTime).getTime()
      )[0] ?? null;

  const currentWeekMonday = getMondayOfWeek(now);
  const weeklyStudyStats = computeWeeklyStudyAnalytics(
    studySessions,
    currentWeekMonday
  );
  const assignmentAnalytics = computeAssignmentAnalytics(assignments, now);
  const productivityIndicator = computeProductivityIndicator(
    assignmentAnalytics,
    weeklyStudyStats
  );

  return (
    <div className="space-y-6">
      {/* Welcome Banner & Quick Actions */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <p className="font-mono text-xs font-medium text-indigo-600 tabular-nums">
              {formattedToday} · {formatTimeDisplay(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
              {greeting}
              {studentName ? `, ${studentName}` : ''} — ready for your schedule
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl">
              {todayDay
                ? `You have ${todayClasses.length} ${
                    todayClasses.length === 1 ? 'class' : 'classes'
                  } scheduled for ${todayDay} and ${pendingAssignments.length} pending ${
                    pendingAssignments.length === 1 ? 'assignment' : 'assignments'
                  }.`
                : `It is Sunday — no classes scheduled today. You have ${pendingAssignments.length} pending ${
                    pendingAssignments.length === 1 ? 'assignment' : 'assignments'
                  } ahead.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onAddClass}
              className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-lg border border-blue-200 bg-blue-50/70 text-sm font-medium text-blue-700 hover:bg-blue-100/80 transition-colors whitespace-nowrap"
            >
              <CalendarPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Add Class</span>
            </button>
            <button
              type="button"
              onClick={onAddAssignment}
              className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-lg bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 transition-colors whitespace-nowrap"
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Add Assignment</span>
            </button>
          </div>
        </div>
      </section>

      {/* Live Class Spotlight: Ongoing Class & Next Class Countdown */}
      {(ongoing || nextUpcoming) && (
        <section
          aria-label="Live class status and countdown"
          className={`grid grid-cols-1 ${ongoing && nextUpcoming ? 'md:grid-cols-2' : ''} gap-4`}
        >
          {ongoing && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/75 p-5 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                  <Radio className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Ongoing Class Now</span>
                </span>
                <span className="font-mono text-xs font-semibold text-blue-800 tabular-nums">
                  {formatLiveCountdown(ongoing.endsAt, now)} left
                </span>
              </div>

              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  {ongoing.event.subject}
                </h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-700">
                  <span className="font-medium text-blue-700">{ongoing.event.type}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {formatTimeRange(ongoing.event.startTime, ongoing.event.endTime)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                    <span>{ongoing.event.venue}</span>
                  </span>
                  {ongoing.event.faculty && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                        <span>{ongoing.event.faculty}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {nextUpcoming && (
            <div className="rounded-xl border border-indigo-200/80 bg-white p-5 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
                  <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {nextUpcoming.isToday
                      ? 'Next Class Today'
                      : `Next Class · ${nextUpcoming.event.day}`}
                  </span>
                </span>
                <span className="font-mono text-xs font-semibold text-indigo-700 tabular-nums">
                  Starts in {formatLiveCountdown(nextUpcoming.startsAt, now)}
                </span>
              </div>

              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  {nextUpcoming.event.subject}
                </h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                  <span className="font-medium text-violet-700">
                    {nextUpcoming.event.type}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-slate-800 font-medium">
                    Starts {formatTimeDisplay(nextUpcoming.event.startTime)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 text-slate-700">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    <span>Room {nextUpcoming.event.venue}</span>
                  </span>
                  {nextUpcoming.event.faculty && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                        <span>{nextUpcoming.event.faculty}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 4-Column Summary KPIs */}
      <section aria-label="Academic metrics" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">Today&apos;s Classes</span>
            <CalendarDays className="h-4 w-4 text-blue-600" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-slate-900 tabular-nums">
            {todayClasses.length}
          </p>
          <p className="mt-1 text-xs text-slate-500 truncate">
            {ongoing
              ? `In progress: ${ongoing.event.subject}`
              : nextToday
                ? `Next: ${formatTimeDisplay(nextToday.event.startTime)} · ${nextToday.event.subject}`
                : todayDay
                  ? todayClasses.length > 0
                    ? 'All classes finished for today'
                    : `No classes on ${todayDay}`
                  : 'Weekend break (Mon–Sat schedule)'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">Pending Assignments</span>
            <Clock className="h-4 w-4 text-indigo-600" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-slate-900 tabular-nums">
            {pendingAssignments.length}
          </p>
          <p
            className={`mt-1 text-xs font-medium ${
              overdueAssignments.length > 0 ? 'text-red-600' : 'text-slate-500 font-normal'
            }`}
          >
            {overdueAssignments.length > 0
              ? `${overdueAssignments.length} overdue — needs attention`
              : 'All pending deadlines on track'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">Completed Assignments</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-slate-900 tabular-nums">
            {completedAssignments.length}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {completionPct}% of {totalAssignments} total tasks done
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">Active Reminders</span>
            <Bell className="h-4 w-4 text-violet-600" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-slate-900 tabular-nums">
            {activeReminders.length}
          </p>
          <p className="mt-1 text-xs text-slate-500 truncate">
            {nextReminder
              ? `Next alert ${formatRelativeDuration(nextReminder.triggerDate, now).toLowerCase()}`
              : 'No upcoming alerts queued'}
          </p>
        </div>
      </section>

      {/* Main Two-Column Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Today's Classes + Weekly Overview */}
        <div className="lg:col-span-7 space-y-6">
          {/* Today's Classes */}
          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Today&apos;s Schedule
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {todayDay ? `${todayDay} classes from timetable` : 'Sunday · No classes scheduled'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('timetable', todayDay ?? 'Monday')}
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 whitespace-nowrap"
              >
                <span>Open Timetable</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            {todayClasses.length === 0 ? (
              <div className="p-8 text-center">
                <BookOpen className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-slate-800">
                  {todayDay
                    ? `No classes scheduled for ${todayDay}`
                    : 'Enjoy your Sunday — no classes today'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {todayDay
                    ? 'You have a free day today, or you can add a session to your timetable.'
                    : 'Check your Monday–Saturday sessions in the weekly timetable.'}
                </p>
                <button
                  type="button"
                  onClick={onAddClass}
                  className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <CalendarPlus className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                  <span>Add Class</span>
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {todayClasses.map((cls) => {
                  const status = getClassLiveStatus(cls.day, cls.startTime, cls.endTime, now);
                  const isOngoing = ongoing?.event.id === cls.id;
                  const isNext = !isOngoing && nextToday?.event.id === cls.id;

                  return (
                    <li
                      key={cls.id}
                      className={`px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        isOngoing
                          ? 'bg-blue-50/75'
                          : isNext
                            ? 'bg-indigo-50/35 hover:bg-indigo-50/60'
                            : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span
                            className={`font-semibold ${
                              cls.type === 'Lab'
                                ? 'text-violet-700'
                                : cls.type === 'Tutorial'
                                  ? 'text-indigo-700'
                                  : 'text-blue-700'
                            }`}
                          >
                            {cls.type}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums text-slate-700">
                            {formatTimeRange(cls.startTime, cls.endTime)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-slate-900 truncate">
                          {cls.subject}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                            <span>{cls.venue}</span>
                          </span>
                          {cls.faculty && (
                            <span className="inline-flex items-center gap-1">
                              <User className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                              <span>{cls.faculty}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isOngoing && ongoing ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 tabular-nums">
                            <Radio className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Ongoing · {formatLiveCountdown(ongoing.endsAt, now)} left</span>
                          </span>
                        ) : isNext && nextToday ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 tabular-nums">
                            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Next · in {formatLiveCountdown(nextToday.startsAt, now)}</span>
                          </span>
                        ) : status === 'upcoming' ? (
                          <span className="text-xs font-medium text-slate-600">Upcoming</span>
                        ) : (
                          <span className="text-xs text-slate-400">Completed</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Weekly Overview & Progress Summary */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Weekly Overview &amp; Progress
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Scheduled class hours across Monday–Saturday ({totalWeeklyHours.toFixed(1)} hrs total)
                </p>
              </div>
              <span className="font-mono text-xs font-medium text-slate-600 tabular-nums">
                {events.length} sessions
              </span>
            </div>

            {/* Mon-Sat Interactive Bar Chart */}
            <div className="grid grid-cols-6 gap-2.5 pt-2">
              {weeklySummary.map(({ day, count, hours }) => {
                const heightPct = hours > 0 ? Math.max(12, Math.round((hours / maxDailyHours) * 100)) : 0;
                const isToday = todayDay === day;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => onNavigate('timetable', day)}
                    title={`View ${day}: ${count} sessions (${hours.toFixed(1)} hrs)`}
                    className="group flex flex-col items-center gap-2 rounded-lg p-2 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <span className="font-mono text-[11px] tabular-nums text-slate-500">
                      {hours > 0 ? `${hours.toFixed(1)}h` : '0h'}
                    </span>
                    <div className="w-full max-w-[40px] h-24 rounded-md bg-slate-100 flex items-end overflow-hidden p-0.5">
                      {hours > 0 && (
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={`w-full rounded-sm transition-all duration-200 ${
                            isToday
                              ? 'bg-indigo-600 group-hover:bg-indigo-700'
                              : 'bg-blue-400/80 group-hover:bg-blue-500'
                          }`}
                        />
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        isToday ? 'text-indigo-700 font-semibold' : 'text-slate-600'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Assignment Completion Progress Bar */}
            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-medium text-slate-700">Assignment Completion</span>
                <span className="font-mono tabular-nums text-slate-600">
                  {completedAssignments.length} / {totalAssignments} completed ({completionPct}%)
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  style={{ width: `${completionPct}%` }}
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 to-violet-600 transition-all duration-300"
                />
              </div>
            </div>
          </section>
          {/* Today's Planned Study Sessions & Next Study Session */}
          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Today&apos;s Study Plan
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  {todayStudySessions.length}{' '}
                  {todayStudySessions.length === 1 ? 'session' : 'sessions'} planned for today
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onPlanStudy}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[34px] rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                  <Plus className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />
                  <span>Plan Study</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('study-planner')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-lg border border-indigo-200 bg-indigo-50/70 text-xs font-medium text-indigo-700 hover:bg-indigo-100/80 transition-colors whitespace-nowrap"
                >
                  <span>Open Study Planner</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {nextStudySession && (
              <div className="px-5 py-3.5 bg-indigo-50/45 border-b border-slate-100">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-indigo-700">Next Study Session</span>
                  <span className="font-mono tabular-nums text-slate-600">
                    {formatShortDate(nextStudySession.date)} ·{' '}
                    {formatTimeDisplay(nextStudySession.startTime)}
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {nextStudySession.subject} — {nextStudySession.topic}
                </p>
                <p className="mt-0.5 text-xs text-slate-600 font-mono tabular-nums">
                  {formatTimeRange(
                    nextStudySession.startTime,
                    getStudyEndTime(
                      nextStudySession.startTime,
                      nextStudySession.durationMinutes
                    )
                  )}{' '}
                  ({formatDurationLabel(nextStudySession.durationMinutes)})
                </p>
              </div>
            )}

            {todayStudySessions.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-xs text-slate-500">
                  No study sessions planned for today yet.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {todayStudySessions.map((sess) => {
                  const isCompleted = sess.status === 'Completed';
                  return (
                    <li
                      key={sess.id}
                      className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => onToggleStudySession(sess.id)}
                          aria-label={
                            isCompleted
                              ? `Mark ${sess.topic} as pending`
                              : `Mark ${sess.topic} as completed`
                          }
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                            isCompleted
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-slate-300 bg-white text-transparent hover:border-indigo-500 hover:bg-indigo-50'
                          }`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <div className="min-w-0">
                          <p
                            className={`text-sm font-semibold truncate ${
                              isCompleted ? 'text-slate-500 line-through' : 'text-slate-900'
                            }`}
                          >
                            {sess.subject}: {sess.topic}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500 font-mono tabular-nums">
                            {formatTimeRange(
                              sess.startTime,
                              getStudyEndTime(sess.startTime, sess.durationMinutes)
                            )}{' '}
                            · {formatDurationLabel(sess.durationMinutes)}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-xs font-medium shrink-0 ${
                          isCompleted ? 'text-emerald-700' : 'text-indigo-600'
                        }`}
                      >
                        {sess.status}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Right Column: Compact Progress Summary + Deadlines & Assignments + Next Reminders */}
        <div className="lg:col-span-5 space-y-6">
          {/* Compact Progress Analytics Summary */}
          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2 min-w-0">
                <BarChart3 className="h-4 w-4 text-indigo-600 shrink-0" aria-hidden="true" />
                <h2 className="font-display text-base font-semibold text-slate-900 truncate">
                  Progress Summary
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('analytics')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-lg border border-indigo-200 bg-indigo-50/70 text-xs font-medium text-indigo-700 hover:bg-indigo-100/80 transition-colors whitespace-nowrap shrink-0"
              >
                <span>Open Analytics</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Weekly Study Hours</p>
                  <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
                    {weeklyStudyStats.totalCompletedHours.toFixed(1)}h{' '}
                    <span className="text-xs font-mono font-normal text-slate-500">
                      / {weeklyStudyStats.totalPlannedHours.toFixed(1)}h
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Assignment Completion</p>
                  <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
                    {assignmentAnalytics.completionPct}%
                  </p>
                </div>
              </div>

              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  style={{ width: `${assignmentAnalytics.completionPct}%` }}
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 to-violet-600 transition-all duration-300"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-start justify-between gap-3 text-xs">
                <div>
                  <span className="text-slate-500">Productivity Status: </span>
                  <span
                    className={`font-semibold ${
                      productivityIndicator.tone === 'success'
                        ? 'text-emerald-700'
                        : productivityIndicator.tone === 'danger'
                          ? 'text-red-600'
                          : productivityIndicator.tone === 'warning'
                            ? 'text-amber-700'
                            : 'text-indigo-700'
                    }`}
                  >
                    {productivityIndicator.label}
                  </span>
                  <p className="mt-0.5 text-slate-500">
                    {productivityIndicator.description}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Next Upcoming Assignment & Due Today Spotlight */}
          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Deadlines &amp; Assignments
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  {pendingAssignments.length} pending · {dueTodayAssignments.length} due today
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('assignments')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-lg border border-indigo-200 bg-indigo-50/70 text-xs font-medium text-indigo-700 hover:bg-indigo-100/80 transition-colors whitespace-nowrap shrink-0"
              >
                <span>Open Assignments</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            {/* Next Upcoming Assignment Highlight */}
            {nextUpcomingAssignment && (
              <div className="px-5 py-4 bg-violet-50/40 border-b border-slate-100">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-violet-700">
                    Next Upcoming Assignment
                  </span>
                  <span className="font-mono tabular-nums text-slate-600">
                    {formatRelativeDuration(
                      combineDateAndTime(
                        nextUpcomingAssignment.dueDate,
                        nextUpcomingAssignment.dueTime
                      ),
                      now
                    )}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-semibold text-slate-900">
                  {nextUpcomingAssignment.title}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600">
                  <span className="font-medium text-indigo-700">
                    {nextUpcomingAssignment.subject}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {formatShortDate(nextUpcomingAssignment.dueDate)},{' '}
                    {formatTimeDisplay(nextUpcomingAssignment.dueTime)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={`inline-flex items-center gap-1 font-medium ${
                      (nextUpcomingAssignment.priority ?? 'Medium') === 'High'
                        ? 'text-red-700'
                        : (nextUpcomingAssignment.priority ?? 'Medium') === 'Medium'
                          ? 'text-indigo-700'
                          : 'text-slate-600'
                    }`}
                  >
                    <Flag className="h-3 w-3" aria-hidden="true" />
                    <span>{nextUpcomingAssignment.priority ?? 'Medium'} priority</span>
                  </span>
                </div>
              </div>
            )}

            {/* Assignments Due Today */}
            <div className="px-5 py-3.5 border-b border-slate-100">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-slate-800">Due Today</span>
                <span className="font-mono tabular-nums text-slate-500">
                  {dueTodayAssignments.length}
                </span>
              </div>
              {dueTodayAssignments.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No assignments due today.
                </p>
              ) : (
                <ul className="space-y-2">
                  {dueTodayAssignments.map((asg) => (
                    <li
                      key={asg.id}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => onToggleAssignment(asg.id)}
                        className="text-left font-medium text-slate-800 hover:text-indigo-700 truncate"
                      >
                        {asg.title}
                      </button>
                      <span className="font-mono tabular-nums text-amber-700 font-medium shrink-0">
                        {formatTimeDisplay(asg.dueTime)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {upcomingAssignments.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-slate-800">
                  All caught up on assignments
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  You have no pending coursework right now.
                </p>
                <button
                  type="button"
                  onClick={onAddAssignment}
                  className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />
                  <span>Add Assignment</span>
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {upcomingAssignments.map((asg) => {
                  const deadlineStatus = getAssignmentDeadlineStatus(asg, now);
                  const overdue = deadlineStatus === 'Overdue';
                  const dueToday = deadlineStatus === 'Due Today';
                  const priority = asg.priority ?? 'Medium';
                  const dueDateObj = combineDateAndTime(asg.dueDate, asg.dueTime);

                  return (
                    <li
                      key={asg.id}
                      className="px-5 py-3.5 flex items-start gap-3 hover:bg-slate-50/70 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => onToggleAssignment(asg.id)}
                        aria-label={`Mark ${asg.title} as completed`}
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-300 text-transparent hover:border-indigo-500 hover:bg-indigo-50 transition-colors"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {asg.title}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                          <span className="truncate">{asg.subject}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {formatShortDate(asg.dueDate)}, {formatTimeDisplay(asg.dueTime)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={`font-medium ${
                              priority === 'High'
                                ? 'text-red-700'
                                : priority === 'Medium'
                                  ? 'text-indigo-700'
                                  : 'text-slate-600'
                            }`}
                          >
                            {priority}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                          {overdue ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-red-600">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              <span>
                                Overdue ({formatRelativeDuration(dueDateObj, now)})
                              </span>
                            </span>
                          ) : dueToday ? (
                            <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              <span>Due Today · {formatRelativeDuration(dueDateObj, now)}</span>
                            </span>
                          ) : (
                            <span className="text-slate-500">
                              Upcoming · {formatRelativeDuration(dueDateObj, now)}
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Upcoming Reminders Summary */}
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Next Reminders
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Scheduled deadline alerts
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('reminders')}
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 whitespace-nowrap"
              >
                <span>Manage</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            {activeReminders.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-xs text-slate-500">
                  No active reminders configured for pending assignments.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {activeReminders.slice(0, 3).map(({ reminder, assignment, triggerDate }) => {
                  const isDue = triggerDate.getTime() <= now.getTime();
                  return (
                    <li key={reminder.id} className="px-5 py-3.5 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {assignment.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {getReminderOffsetLabel(reminder.offsetMinutes)} ·{' '}
                          <span className="font-mono tabular-nums">
                            {formatDateTimeReadable(triggerDate)}
                          </span>
                        </p>
                      </div>
                      <span
                        className={`text-xs font-medium shrink-0 tabular-nums ${
                          isDue ? 'text-amber-700' : 'text-indigo-600'
                        }`}
                      >
                        {isDue ? 'Alert due' : formatRelativeDuration(triggerDate, now)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
