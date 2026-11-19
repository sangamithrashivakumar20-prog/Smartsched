import { useMemo, useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { StudySession, TimetableEvent } from '../types/scheduler';
import {
  addDaysToDate,
  formatTimeDisplay,
  formatTimeRange,
  timeToMinutes,
  toLocalDateString,
} from '../utils/dateUtils';
import {
  formatDurationLabel,
  getDayFreeWindows,
  getDayOfWeekFromDateString,
  getMondayOfWeek,
  getStudyEndTime,
  getWeekDates,
} from '../utils/studyScheduler';

interface StudyPlannerViewProps {
  studySessions: StudySession[];
  timetableEvents: TimetableEvent[];
  now: Date;
  onAddSession: (defaultDate?: string, defaultStartTime?: string) => void;
  onEditSession: (session: StudySession) => void;
  onDeleteSession: (session: StudySession) => void;
  onToggleStatus: (id: string) => void;
}

export function StudyPlannerView({
  studySessions,
  timetableEvents,
  now,
  onAddSession,
  onEditSession,
  onDeleteSession,
  onToggleStatus,
}: StudyPlannerViewProps) {
  const todayStr = toLocalDateString(now);
  const [weekStartMonday, setWeekStartMonday] = useState<Date>(() =>
    getMondayOfWeek(now)
  );
  const [viewMode, setViewMode] = useState<'weekly' | 'daily'>('weekly');
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);

  const weekDays = useMemo(() => getWeekDates(weekStartMonday), [weekStartMonday]);

  const weekRangeLabel = useMemo(() => {
    const start = weekDays[0]?.dateObj;
    const end = weekDays[6]?.dateObj;
    if (!start || !end) return '';
    const startFmt = start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    const endFmt = end.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `${startFmt} – ${endFmt}`;
  }, [weekDays]);

  const weekDateSet = useMemo(
    () => new Set(weekDays.map((d) => d.dateStr)),
    [weekDays]
  );

  const weekSessions = useMemo(
    () =>
      studySessions
        .filter((s) => weekDateSet.has(s.date))
        .sort((a, b) => {
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
        }),
    [studySessions, weekDateSet]
  );

  // Weekly progress calculations
  const weeklyStats = useMemo(() => {
    const totalMinutes = weekSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    const completed = weekSessions.filter((s) => s.status === 'Completed');
    const pending = weekSessions.filter((s) => s.status === 'Pending');
    const completedMinutes = completed.reduce((sum, s) => sum + s.durationMinutes, 0);
    const pendingMinutes = pending.reduce((sum, s) => sum + s.durationMinutes, 0);
    const progressPct =
      weekSessions.length > 0
        ? Math.round((completed.length / weekSessions.length) * 100)
        : 0;

    return {
      totalHours: (totalMinutes / 60).toFixed(1),
      totalCount: weekSessions.length,
      completedCount: completed.length,
      completedHours: (completedMinutes / 60).toFixed(1),
      pendingCount: pending.length,
      pendingHours: (pendingMinutes / 60).toFixed(1),
      progressPct,
    };
  }, [weekSessions]);

  const sessionsByDate = useMemo(() => {
    const map: Record<string, StudySession[]> = {};
    for (const day of weekDays) {
      map[day.dateStr] = [];
    }
    for (const sess of weekSessions) {
      if (map[sess.date]) {
        map[sess.date].push(sess);
      }
    }
    return map;
  }, [weekDays, weekSessions]);

  // Keep selectedDateStr inside current week when navigating weeks
  const activeDailyDateStr = weekDateSet.has(selectedDateStr)
    ? selectedDateStr
    : weekDateSet.has(todayStr)
      ? todayStr
      : weekDays[0].dateStr;

  const activeDailyDayObj =
    weekDays.find((d) => d.dateStr === activeDailyDateStr) ?? weekDays[0];

  const activeDayClasses = useMemo(() => {
    const weekday = getDayOfWeekFromDateString(activeDailyDateStr);
    if (!weekday) return [];
    return timetableEvents
      .filter((e) => e.day === weekday)
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  }, [timetableEvents, activeDailyDateStr]);

  const activeDaySessions = sessionsByDate[activeDailyDateStr] ?? [];

  const activeDayFreeWindows = useMemo(
    () => getDayFreeWindows(activeDailyDateStr, timetableEvents, studySessions, now),
    [activeDailyDateStr, timetableEvents, studySessions, now]
  );

  // Combined timeline for Daily View (College classes + Study sessions)
  const dailyTimelineItems = useMemo(() => {
    const items: (
      | { kind: 'class'; startMins: number; event: TimetableEvent }
      | { kind: 'study'; startMins: number; session: StudySession }
    )[] = [];

    for (const ev of activeDayClasses) {
      items.push({ kind: 'class', startMins: timeToMinutes(ev.startTime), event: ev });
    }
    for (const sess of activeDaySessions) {
      items.push({
        kind: 'study',
        startMins: timeToMinutes(sess.startTime),
        session: sess,
      });
    }
    return items.sort((a, b) => a.startMins - b.startMins);
  }, [activeDayClasses, activeDaySessions]);

  const handleShiftWeek = (deltaWeeks: number) => {
    const nextMonday = addDaysToDate(weekStartMonday, deltaWeeks * 7);
    setWeekStartMonday(nextMonday);
    setSelectedDateStr(toLocalDateString(nextMonday));
  };

  const handleGoToCurrentWeek = () => {
    const currentMon = getMondayOfWeek(now);
    setWeekStartMonday(currentMon);
    setSelectedDateStr(todayStr);
  };

  const renderSessionCard = (sess: StudySession) => {
    const isCompleted = sess.status === 'Completed';
    const endTime = getStudyEndTime(sess.startTime, sess.durationMinutes);

    return (
      <article
        key={sess.id}
        className={`rounded-lg border p-3.5 transition-colors ${
          isCompleted
            ? 'border-slate-200 bg-slate-50/80'
            : 'border-violet-200/80 bg-white hover:border-violet-300'
        }`}
      >
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => onToggleStatus(sess.id)}
              aria-label={
                isCompleted
                  ? `Mark ${sess.topic} as pending`
                  : `Mark ${sess.topic} as completed`
              }
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                isCompleted
                  ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'border-slate-300 bg-white text-transparent hover:border-indigo-500 hover:bg-indigo-50'
              }`}
            >
              <Check className="h-3 w-3" aria-hidden="true" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                <span className="font-semibold text-indigo-700 truncate">
                  {sess.subject}
                </span>
                <span className="text-slate-300" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono tabular-nums text-slate-600">
                  {formatDurationLabel(sess.durationMinutes)}
                </span>
              </div>

              <h3
                className={`mt-0.5 text-sm font-semibold leading-snug ${
                  isCompleted ? 'text-slate-500 line-through' : 'text-slate-900'
                }`}
              >
                {sess.topic}
              </h3>

              <p className="mt-1 font-mono text-xs tabular-nums text-slate-500">
                {formatTimeRange(sess.startTime, endTime)}
              </p>

              {sess.notes && (
                <p
                  className={`mt-1.5 text-xs leading-relaxed ${
                    isCompleted ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  {sess.notes}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onEditSession(sess)}
              aria-label={`Edit ${sess.topic}`}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-indigo-700 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onDeleteSession(sess)}
              aria-label={`Delete ${sess.topic}`}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header & Week Navigation */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900">
              Study Planner
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
              Plan focused study sessions during free time around your college timetable.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Week Switcher */}
            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => handleShiftWeek(-1)}
                aria-label="Previous week"
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={handleGoToCurrentWeek}
                className="px-3 py-1 text-xs font-medium text-slate-700 hover:text-indigo-700 transition-colors whitespace-nowrap font-mono tabular-nums"
                title="Jump to current week"
              >
                {weekRangeLabel}
              </button>
              <button
                type="button"
                onClick={() => handleShiftWeek(1)}
                aria-label="Next week"
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Weekly / Daily View Toggle */}
            <div
              role="group"
              aria-label="Study planner view mode"
              className="flex items-center gap-1 p-1 rounded-lg bg-slate-100"
            >
              <button
                type="button"
                onClick={() => setViewMode('weekly')}
                className={`px-3 py-1.5 min-h-[34px] rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  viewMode === 'weekly'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Weekly Plan
              </button>
              <button
                type="button"
                onClick={() => setViewMode('daily')}
                className={`px-3 py-1.5 min-h-[34px] rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  viewMode === 'daily'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Daily Plan
              </button>
            </div>

            <button
              type="button"
              onClick={() =>
                onAddSession(viewMode === 'daily' ? activeDailyDateStr : todayStr)
              }
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg bg-indigo-600 text-xs sm:text-sm font-medium text-white hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Add Study Session</span>
            </button>
          </div>
        </div>
      </section>

      {/* Weekly Study Progress Summary */}
      <section
        aria-label="Weekly study progress"
        className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Planned This Week</p>
            <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {weeklyStats.totalHours} hrs
            </p>
            <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
              {weeklyStats.totalCount}{' '}
              {weeklyStats.totalCount === 1 ? 'session' : 'sessions'} scheduled
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500">Completed Sessions</p>
            <p className="mt-1 font-display text-2xl font-bold text-emerald-700 tabular-nums">
              {weeklyStats.completedCount}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
              {weeklyStats.completedHours} hrs finished
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500">Pending Sessions</p>
            <p className="mt-1 font-display text-2xl font-bold text-indigo-700 tabular-nums">
              {weeklyStats.pendingCount}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
              {weeklyStats.pendingHours} hrs remaining
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-medium text-slate-700">Weekly Study Progress</span>
            <span className="font-mono tabular-nums text-slate-600">
              {weeklyStats.completedCount} / {weeklyStats.totalCount} sessions completed (
              {weeklyStats.progressPct}%)
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              style={{ width: `${weeklyStats.progressPct}%` }}
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-violet-600 transition-all duration-300"
            />
          </div>
        </div>
      </section>

      {/* Weekly Plan View */}
      {viewMode === 'weekly' ? (
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {weekDays.map((day) => {
            const isToday = day.dateStr === todayStr;
            const daySessions = sessionsByDate[day.dateStr] ?? [];
            const weekday = getDayOfWeekFromDateString(day.dateStr);
            const dayClasses = weekday
              ? timetableEvents
                  .filter((e) => e.day === weekday)
                  .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
              : [];
            const freeWindows = getDayFreeWindows(
              day.dateStr,
              timetableEvents,
              studySessions,
              now
            );

            return (
              <div
                key={day.dateStr}
                className={`rounded-xl border bg-white flex flex-col overflow-hidden ${
                  isToday ? 'border-blue-300' : 'border-slate-200'
                }`}
              >
                {/* Day Header */}
                <div
                  className={`px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2 ${
                    isToday ? 'bg-blue-50/75' : 'bg-slate-50/60'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDateStr(day.dateStr);
                      setViewMode('daily');
                    }}
                    className="text-left min-w-0 group"
                  >
                    <span
                      className={`font-display text-sm font-semibold block truncate group-hover:text-indigo-700 ${
                        isToday ? 'text-blue-700' : 'text-slate-900'
                      }`}
                    >
                      {day.dayName}
                      {isToday && ' · Today'}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-slate-500">
                      {day.shortDate} · {dayClasses.length}{' '}
                      {dayClasses.length === 1 ? 'class' : 'classes'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onAddSession(day.dateStr)}
                    aria-label={`Plan study session on ${day.dayName}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-indigo-600 hover:bg-white transition-colors shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Plan</span>
                  </button>
                </div>

                {/* Day Content */}
                <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                  <div className="space-y-2.5">
                    {/* Quiet college class reference */}
                    {dayClasses.length > 0 && (
                      <div className="text-[11px] text-slate-500 space-y-1 pb-2 border-b border-slate-100">
                        <span className="font-medium text-slate-600 block">
                          College timetable:
                        </span>
                        {dayClasses.map((cls) => (
                          <p key={cls.id} className="truncate font-mono tabular-nums">
                            {formatTimeDisplay(cls.startTime)}–{formatTimeDisplay(cls.endTime)} ·{' '}
                            <span className="font-sans text-slate-700">{cls.subject}</span>
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Planned Study Sessions */}
                    {daySessions.length === 0 ? (
                      <p className="py-3 text-xs text-slate-400">
                        No study sessions planned.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {daySessions.map((sess) => renderSessionCard(sess))}
                      </div>
                    )}
                  </div>

                  {/* Quick Free-Slot Action */}
                  {freeWindows.length > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => onAddSession(day.dateStr, freeWindows[0].startTime)}
                        className="w-full text-left text-[11px] text-blue-700 hover:text-indigo-700 font-medium flex items-center justify-between gap-2"
                      >
                        <span className="inline-flex items-center gap-1 truncate">
                          <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span className="truncate">
                            Free from {formatTimeDisplay(freeWindows[0].startTime)}
                          </span>
                        </span>
                        <span className="shrink-0">+ Add</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      ) : (
        /* Daily Plan View */
        <section className="space-y-4">
          {/* 7-Day Selector Strip */}
          <div
            role="tablist"
            aria-label="Select day of week"
            className="grid grid-cols-7 gap-1 p-1 rounded-xl border border-slate-200 bg-white"
          >
            {weekDays.map((day) => {
              const active = day.dateStr === activeDailyDateStr;
              const count = (sessionsByDate[day.dateStr] ?? []).length;
              return (
                <button
                  key={day.dateStr}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedDateStr(day.dateStr)}
                  className={`py-2 px-1 rounded-lg text-center transition-colors ${
                    active
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="block text-xs font-semibold">{day.shortDay}</span>
                  <span
                    className={`block font-mono text-[10px] tabular-nums mt-0.5 ${
                      active ? 'text-indigo-100' : 'text-slate-400'
                    }`}
                  >
                    {day.shortDate.split(' ')[1]} · {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Daily Combined Timeline */}
            <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-slate-900">
                    {activeDailyDayObj.dayName}, {activeDailyDayObj.shortDate}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                    {activeDayClasses.length} college{' '}
                    {activeDayClasses.length === 1 ? 'class' : 'classes'} ·{' '}
                    {activeDaySessions.length} study{' '}
                    {activeDaySessions.length === 1 ? 'session' : 'sessions'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onAddSession(activeDailyDateStr)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg bg-indigo-600 text-xs font-medium text-white hover:bg-indigo-700 transition-colors whitespace-nowrap"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Plan Session</span>
                </button>
              </div>

              {dailyTimelineItems.length === 0 ? (
                <div className="p-8 text-center">
                  <CalendarDays className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
                  <p className="mt-3 text-sm font-medium text-slate-800">
                    Open day — no classes or study sessions yet
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Use any free window on the right or add a study session manually.
                  </p>
                </div>
              ) : (
                <div className="p-4 space-y-2.5">
                  {dailyTimelineItems.map((item) => {
                    if (item.kind === 'class') {
                      const cls = item.event;
                      return (
                        <div
                          key={`cls-${cls.id}`}
                          className="rounded-lg border border-blue-200/80 bg-blue-50/60 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-xs text-blue-700">
                              <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              <span className="font-semibold">College {cls.type}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">
                                {formatTimeRange(cls.startTime, cls.endTime)}
                              </span>
                            </div>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {cls.subject}
                            </p>
                          </div>
                          <span className="inline-flex items-center gap-1 text-xs text-slate-600 shrink-0">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                            <span>{cls.venue}</span>
                          </span>
                        </div>
                      );
                    }

                    return renderSessionCard(item.session);
                  })}
                </div>
              )}
            </div>

            {/* Free Time Windows Around Timetable */}
            <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Available Free Time
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Conflict-free windows outside college class hours (8:00 AM – 9:00 PM)
                </p>
              </div>

              {activeDayFreeWindows.length === 0 ? (
                <div className="p-6 text-center space-y-2">
                  <CheckCircle2 className="mx-auto h-7 w-7 text-slate-300" aria-hidden="true" />
                  <p className="text-xs text-slate-500">
                    Daytime slots are fully booked. You can still schedule an early morning or evening study session manually.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {activeDayFreeWindows.map((win) => (
                    <li
                      key={`${win.startTime}-${win.endTime}`}
                      className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                          {formatTimeRange(win.startTime, win.endTime)}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                          <Clock className="h-3.5 w-3.5 text-blue-600 shrink-0" aria-hidden="true" />
                          <span>{formatDurationLabel(win.minutes)} available</span>
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => onAddSession(activeDailyDateStr, win.startTime)}
                        className="px-3 py-1.5 min-h-[34px] rounded-lg border border-indigo-200 bg-indigo-50/70 text-xs font-medium text-indigo-700 hover:bg-indigo-100/80 transition-colors whitespace-nowrap shrink-0"
                      >
                        Plan Here
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
