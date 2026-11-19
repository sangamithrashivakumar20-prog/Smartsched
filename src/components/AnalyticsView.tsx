import { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Layers,
  Plus,
  TrendingUp,
} from 'lucide-react';
import { Assignment, PageView, StudySession } from '../types/scheduler';
import {
  computeAssignmentAnalytics,
  computeOverallStudyAnalytics,
  computeProductivityIndicator,
  computeSubjectProgress,
  computeWeeklyStudyAnalytics,
} from '../utils/analytics';
import { addDaysToDate, toLocalDateString } from '../utils/dateUtils';
import { getMondayOfWeek } from '../utils/studyScheduler';

interface AnalyticsViewProps {
  assignments: Assignment[];
  studySessions: StudySession[];
  now: Date;
  onNavigate: (page: PageView) => void;
  onPlanStudy: () => void;
  onAddAssignment: () => void;
}

type ChartMetric = 'sessions' | 'hours';

export function AnalyticsView({
  assignments,
  studySessions,
  now,
  onNavigate,
  onPlanStudy,
  onAddAssignment,
}: AnalyticsViewProps) {
  const currentWeekMonday = useMemo(() => getMondayOfWeek(now), [now]);
  const [selectedMondayStr, setSelectedMondayStr] = useState<string>(() =>
    toLocalDateString(getMondayOfWeek(new Date()))
  );
  const [chartMetric, setChartMetric] = useState<ChartMetric>('sessions');

  const selectedMonday = useMemo(() => {
    const [y, m, d] = selectedMondayStr.split('-').map(Number);
    if (!y || !m || !d) return currentWeekMonday;
    return new Date(y, m - 1, d);
  }, [selectedMondayStr, currentWeekMonday]);

  const isCurrentWeek =
    selectedMondayStr === toLocalDateString(currentWeekMonday);

  const weekEndDate = useMemo(
    () => addDaysToDate(selectedMonday, 6),
    [selectedMonday]
  );
  const weekRangeLabel = `${selectedMonday.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })} – ${weekEndDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;

  const assignmentStats = useMemo(
    () => computeAssignmentAnalytics(assignments, now),
    [assignments, now]
  );

  const weeklyStudyStats = useMemo(
    () => computeWeeklyStudyAnalytics(studySessions, selectedMonday),
    [studySessions, selectedMonday]
  );

  const currentWeekStudyStats = useMemo(
    () => computeWeeklyStudyAnalytics(studySessions, currentWeekMonday),
    [studySessions, currentWeekMonday]
  );

  const overallStudyStats = useMemo(
    () => computeOverallStudyAnalytics(studySessions),
    [studySessions]
  );

  const subjectProgress = useMemo(
    () => computeSubjectProgress(studySessions, assignments),
    [studySessions, assignments]
  );

  const subjectsWithStudyData = useMemo(
    () => subjectProgress.filter((item) => item.plannedSessions > 0),
    [subjectProgress]
  );

  const indicator = useMemo(
    () => computeProductivityIndicator(assignmentStats, currentWeekStudyStats),
    [assignmentStats, currentWeekStudyStats]
  );

  const maxWeeklyBarValue = useMemo(() => {
    if (chartMetric === 'hours') {
      return Math.max(
        2,
        ...weeklyStudyStats.days.map((d) =>
          Math.max(d.plannedHours, d.completedHours)
        )
      );
    }
    return Math.max(
      2,
      ...weeklyStudyStats.days.map((d) =>
        Math.max(d.plannedSessions, d.completedSessions)
      )
    );
  }, [weeklyStudyStats.days, chartMetric]);

  const todayStr = toLocalDateString(now);

  const indicatorToneClasses: Record<typeof indicator.tone, string> = {
    success: 'text-emerald-700',
    info: 'text-indigo-700',
    warning: 'text-amber-700',
    danger: 'text-red-600',
    neutral: 'text-slate-600',
  };

  return (
    <div className="space-y-6">
      {/* Header & Week Switcher */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-indigo-600">
                Live Academic Productivity
              </span>
              <span className="text-slate-300" aria-hidden="true">
                ·
              </span>
              <span className={`font-semibold ${indicatorToneClasses[indicator.tone]}`}>
                {indicator.label}
              </span>
            </div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 text-balance">
              Progress Analytics
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Calculated automatically from your Assignments and Study Planner sessions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onPlanStudy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <Plus className="h-4 w-4 text-violet-600 shrink-0" aria-hidden="true" />
              <span>Plan Study</span>
            </button>
            <button
              type="button"
              onClick={onAddAssignment}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg bg-indigo-600 text-xs sm:text-sm font-medium text-white hover:bg-indigo-700 transition-colors whitespace-nowrap"
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Add Assignment</span>
            </button>
          </div>
        </div>
      </section>

      {/* Top KPI Cards: Assignment Analytics & Study Analytics */}
      <section
        aria-label="Assignment and study key metrics"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        {/* Total & Completion % */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">
              Assignment Completion
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-slate-900 tabular-nums">
            {assignmentStats.completionPct}%
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {assignmentStats.completed} of {assignmentStats.total} completed
          </p>
        </div>

        {/* Pending & Overdue Assignments */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">
              Pending &amp; Overdue
            </span>
            <AlertCircle
              className={`h-4 w-4 ${
                assignmentStats.overdue > 0 ? 'text-red-600' : 'text-indigo-600'
              }`}
              aria-hidden="true"
            />
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-slate-900 tabular-nums">
            {assignmentStats.pending}
          </p>
          <p
            className={`mt-1 text-xs tabular-nums ${
              assignmentStats.overdue > 0
                ? 'font-semibold text-red-600'
                : 'text-slate-500'
            }`}
          >
            {assignmentStats.overdue > 0
              ? `${assignmentStats.overdue} overdue · ${assignmentStats.onTrackPending} on track`
              : `${assignmentStats.dueToday} due today · 0 overdue`}
          </p>
        </div>

        {/* Study Hours This Week */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">
              {isCurrentWeek ? 'Study Hours This Week' : 'Study Hours (Selected Week)'}
            </span>
            <Clock className="h-4 w-4 text-blue-600" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-slate-900 tabular-nums">
            {weeklyStudyStats.totalPlannedHours.toFixed(1)} hrs
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {weeklyStudyStats.totalCompletedHours.toFixed(1)} hrs completed ·{' '}
            {weeklyStudyStats.totalPendingHours.toFixed(1)} hrs pending
          </p>
        </div>

        {/* Study Sessions Completed / Pending */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">
              Study Sessions (All Time)
            </span>
            <BookOpenCheck className="h-4 w-4 text-violet-600" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-slate-900 tabular-nums">
            {overallStudyStats.completedSessions}{' '}
            <span className="text-lg font-medium text-slate-400">
              / {overallStudyStats.totalSessions}
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {overallStudyStats.pendingSessions} pending ·{' '}
            {overallStudyStats.completionPct}% completion rate
          </p>
        </div>
      </section>

      {/* Main Analytics Split: Weekly Productivity Chart + Assignment Completion Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Weekly Productivity Chart & Daily Study Hours Breakdown */}
        <section className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Weekly Study Productivity
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                {weekRangeLabel} · {weeklyStudyStats.totalCompletedSessions} of{' '}
                {weeklyStudyStats.totalPlannedSessions} sessions completed (
                {weeklyStudyStats.sessionCompletionPct}%)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Metric Switcher */}
              <div
                role="group"
                aria-label="Chart metric"
                className="inline-flex rounded-lg bg-slate-100 p-0.5"
              >
                <button
                  type="button"
                  onClick={() => setChartMetric('sessions')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    chartMetric === 'sessions'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sessions
                </button>
                <button
                  type="button"
                  onClick={() => setChartMetric('hours')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    chartMetric === 'hours'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Hours
                </button>
              </div>

              {/* Week Navigation */}
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedMondayStr(
                      toLocalDateString(addDaysToDate(selectedMonday, -7))
                    )
                  }
                  aria-label="Previous week"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                {!isCurrentWeek && (
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedMondayStr(toLocalDateString(currentWeekMonday))
                    }
                    className="px-2.5 h-8 rounded-lg border border-slate-200 bg-white text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors whitespace-nowrap"
                  >
                    This Week
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setSelectedMondayStr(
                      toLocalDateString(addDaysToDate(selectedMonday, 7))
                    )
                  }
                  aria-label="Next week"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          {/* Chart Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-blue-200 border border-blue-300" />
              <span>
                Planned ({chartMetric === 'sessions' ? 'sessions' : 'hours'})
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-indigo-600" />
              <span>
                Completed ({chartMetric === 'sessions' ? 'sessions' : 'hours'})
              </span>
            </span>
          </div>

          {/* Paired Bar Chart: Planned vs Completed */}
          {weeklyStudyStats.totalPlannedSessions === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
              <BarChart3
                className="mx-auto h-8 w-8 text-slate-300"
                aria-hidden="true"
              />
              <p className="mt-2.5 text-sm font-medium text-slate-800">
                No study sessions planned for this week
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Plan a study session in your free timetable slots to see daily productivity bars here.
              </p>
              <button
                type="button"
                onClick={onPlanStudy}
                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Plan Study Session</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto pb-1">
              <div className="min-w-[440px] grid grid-cols-7 gap-2 pt-2">
                {weeklyStudyStats.days.map((day) => {
                  const plannedVal =
                    chartMetric === 'hours' ? day.plannedHours : day.plannedSessions;
                  const completedVal =
                    chartMetric === 'hours'
                      ? day.completedHours
                      : day.completedSessions;

                  const plannedHeight =
                    plannedVal > 0
                      ? Math.max(12, Math.round((plannedVal / maxWeeklyBarValue) * 100))
                      : 0;
                  const completedHeight =
                    completedVal > 0
                      ? Math.max(
                          12,
                          Math.round((completedVal / maxWeeklyBarValue) * 100)
                        )
                      : 0;

                  const isToday = day.dateStr === todayStr;

                  return (
                    <div
                      key={day.dateStr}
                      className={`flex flex-col items-center gap-2 rounded-lg p-1.5 sm:p-2 ${
                        isToday ? 'bg-indigo-50/60' : ''
                      }`}
                    >
                      <span className="font-mono text-[11px] tabular-nums text-slate-500 whitespace-nowrap">
                        {chartMetric === 'hours'
                          ? `${day.completedHours.toFixed(1)}/${day.plannedHours.toFixed(1)}h`
                          : `${day.completedSessions}/${day.plannedSessions}`}
                      </span>

                      <div className="w-full max-w-[44px] h-28 rounded-md bg-slate-100/90 flex items-end justify-center gap-1 px-1.5 py-1">
                        <div className="w-1/2 h-full flex items-end">
                          {plannedHeight > 0 && (
                            <div
                              title={`${day.dayName}: ${day.plannedSessions} planned (${day.plannedHours.toFixed(1)}h)`}
                              style={{ height: `${plannedHeight}%` }}
                              className="w-full rounded-t-xs bg-blue-300 transition-all duration-200"
                            />
                          )}
                        </div>
                        <div className="w-1/2 h-full flex items-end">
                          {completedHeight > 0 && (
                            <div
                              title={`${day.dayName}: ${day.completedSessions} completed (${day.completedHours.toFixed(1)}h)`}
                              style={{ height: `${completedHeight}%` }}
                              className="w-full rounded-t-xs bg-indigo-600 transition-all duration-200"
                            />
                          )}
                        </div>
                      </div>

                      <div className="text-center">
                        <p
                          className={`text-xs font-medium ${
                            isToday ? 'text-indigo-700 font-semibold' : 'text-slate-700'
                          }`}
                        >
                          {day.shortDay}
                        </p>
                        <p className="font-mono text-[10px] text-slate-400 tabular-nums hidden sm:block">
                          {day.shortDate.replace(',', '')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Daily Study Hours Breakdown Table */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-xs font-semibold text-slate-800">
                Daily Study Hours Breakdown
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('study-planner')}
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
              >
                <span>Open Study Planner</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500">
                    <th className="py-2 pr-3 font-medium">Day</th>
                    <th className="py-2 px-3 font-medium text-right">Planned</th>
                    <th className="py-2 px-3 font-medium text-right">Completed</th>
                    <th className="py-2 pl-3 font-medium text-right">Sessions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {weeklyStudyStats.days.map((day) => {
                    const isToday = day.dateStr === todayStr;
                    return (
                      <tr
                        key={day.dateStr}
                        className={isToday ? 'bg-indigo-50/40' : 'hover:bg-slate-50/60'}
                      >
                        <td className="py-2.5 pr-3">
                          <span
                            className={`font-medium ${
                              isToday ? 'text-indigo-700' : 'text-slate-800'
                            }`}
                          >
                            {day.dayName}
                          </span>{' '}
                          <span className="text-slate-400 font-mono tabular-nums">
                            ({day.shortDate})
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                          {day.plannedHours.toFixed(1)} hrs
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-indigo-700 font-medium">
                          {day.completedHours.toFixed(1)} hrs
                        </td>
                        <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-slate-600">
                          {day.completedSessions} / {day.plannedSessions}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Right: Assignment Completion Breakdown & Priority Status */}
        <section className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Assignment Progress
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                {assignmentStats.total} total coursework tasks tracked
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('assignments')}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 whitespace-nowrap"
            >
              <span>Open Assignments</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          {assignmentStats.total === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
              <CheckCircle2
                className="mx-auto h-8 w-8 text-slate-300"
                aria-hidden="true"
              />
              <p className="mt-2.5 text-sm font-medium text-slate-800">
                No assignments recorded yet
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Add coursework deadlines to track completion rate and overdue risk.
              </p>
              <button
                type="button"
                onClick={onAddAssignment}
                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Add Assignment</span>
              </button>
            </div>
          ) : (
            <>
              {/* Overall Completion Meter */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">Overall Completion</span>
                  <span className="font-mono font-semibold tabular-nums text-slate-900">
                    {assignmentStats.completed} / {assignmentStats.total} (
                    {assignmentStats.completionPct}%)
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden flex">
                  {assignmentStats.completed > 0 && (
                    <div
                      title={`Completed: ${assignmentStats.completed}`}
                      style={{
                        width: `${(assignmentStats.completed / assignmentStats.total) * 100}%`,
                      }}
                      className="h-full bg-emerald-500 transition-all duration-300"
                    />
                  )}
                  {assignmentStats.onTrackPending > 0 && (
                    <div
                      title={`Pending (on track): ${assignmentStats.onTrackPending}`}
                      style={{
                        width: `${(assignmentStats.onTrackPending / assignmentStats.total) * 100}%`,
                      }}
                      className="h-full bg-indigo-500 transition-all duration-300"
                    />
                  )}
                  {assignmentStats.overdue > 0 && (
                    <div
                      title={`Overdue: ${assignmentStats.overdue}`}
                      style={{
                        width: `${(assignmentStats.overdue / assignmentStats.total) * 100}%`,
                      }}
                      className="h-full bg-red-500 transition-all duration-300"
                    />
                  )}
                </div>
              </div>

              {/* Status Breakdown Rows */}
              <dl className="divide-y divide-slate-100 text-xs">
                <div className="py-2.5 flex items-center justify-between">
                  <dt className="font-medium text-slate-700">Total Assignments</dt>
                  <dd className="font-mono font-semibold tabular-nums text-slate-900">
                    {assignmentStats.total}
                  </dd>
                </div>

                <div className="py-2.5 flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-slate-700">
                    <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500" />
                    <span>Completed</span>
                  </dt>
                  <dd className="font-mono font-semibold tabular-nums text-slate-900">
                    {assignmentStats.completed}
                  </dd>
                </div>

                <div className="py-2.5 flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-slate-700">
                    <span className="h-2.5 w-2.5 rounded-xs bg-indigo-500" />
                    <span>Pending (Total / On Track)</span>
                  </dt>
                  <dd className="font-mono font-semibold tabular-nums text-slate-900">
                    {assignmentStats.pending}{' '}
                    <span className="font-normal text-slate-500">
                      ({assignmentStats.onTrackPending} on track)
                    </span>
                  </dd>
                </div>

                <div className="py-2.5 flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-slate-700">
                    <span className="h-2.5 w-2.5 rounded-xs bg-red-500" />
                    <span>Overdue</span>
                  </dt>
                  <dd
                    className={`font-mono font-semibold tabular-nums ${
                      assignmentStats.overdue > 0 ? 'text-red-600' : 'text-slate-900'
                    }`}
                  >
                    {assignmentStats.overdue}
                  </dd>
                </div>

                <div className="py-2.5 flex items-center justify-between">
                  <dt className="text-slate-600">Due Today</dt>
                  <dd className="font-mono font-semibold tabular-nums text-amber-700">
                    {assignmentStats.dueToday}
                  </dd>
                </div>
              </dl>

              {/* Priority Breakdown */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <h3 className="text-xs font-semibold text-slate-800">
                  Completion by Priority
                </h3>
                {(['High', 'Medium', 'Low'] as const).map((priority) => {
                  const data = assignmentStats.byPriority[priority];
                  const pct =
                    data.total > 0
                      ? Math.round((data.completed / data.total) * 100)
                      : 0;
                  const barColor =
                    priority === 'High'
                      ? 'bg-red-500'
                      : priority === 'Medium'
                        ? 'bg-indigo-600'
                        : 'bg-blue-500';
                  return (
                    <div key={priority} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700">
                          {priority} Priority
                        </span>
                        <span className="font-mono tabular-nums text-slate-500">
                          {data.completed}/{data.total} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className={`h-full rounded-full ${barColor} transition-all duration-300`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>

      {/* Subject-Wise Progress */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Subject-wise Study &amp; Task Progress
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Study hours logged and session completion rates per subject across all planned study sessions.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 font-mono text-xs tabular-nums text-slate-500">
            <Layers className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />
            <span>
              {subjectsWithStudyData.length} active study{' '}
              {subjectsWithStudyData.length === 1 ? 'subject' : 'subjects'}
            </span>
          </span>
        </div>

        {subjectProgress.length === 0 ? (
          <div className="p-10 text-center">
            <TrendingUp
              className="mx-auto h-9 w-9 text-slate-300"
              aria-hidden="true"
            />
            <h3 className="mt-3 font-display text-base font-semibold text-slate-900">
              No subject progress data yet
            </h3>
            <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
              Create study sessions or assignments to break down your hours and completion by subject.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {subjectProgress.map((item) => (
              <li
                key={item.subject}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm sm:text-base font-semibold text-slate-900">
                      {item.subject}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 font-mono tabular-nums">
                      {item.plannedSessions > 0 ? (
                        <>
                          <span className="font-semibold text-indigo-700">
                            {item.completedHours.toFixed(1)} / {item.plannedHours.toFixed(1)} hrs studied
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {item.completedSessions} / {item.plannedSessions} study sessions
                          </span>
                        </>
                      ) : (
                        <span className="font-sans text-slate-400">
                          No study sessions logged yet
                        </span>
                      )}
                      {item.totalAssignments > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            {item.completedAssignments}/{item.totalAssignments} assignments
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      style={{ width: `${item.studyCompletionPct}%` }}
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 to-violet-600 transition-all duration-300"
                    />
                  </div>
                </div>

                <div className="shrink-0 flex items-center justify-between md:justify-end gap-4 md:min-w-[110px]">
                  <span className="text-xs text-slate-500 md:hidden">
                    Study completion
                  </span>
                  <span className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                    {item.plannedSessions > 0 ? `${item.studyCompletionPct}%` : '—'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
