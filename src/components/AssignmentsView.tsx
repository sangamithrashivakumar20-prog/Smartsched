import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Flag,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { Assignment, AssignmentPriority, Reminder } from '../types/scheduler';
import {
  combineDateAndTime,
  formatRelativeDuration,
  formatShortDate,
  formatTimeDisplay,
  getAssignmentDeadlineStatus,
  getReminderOffsetLabel,
  isAssignmentOverdue,
} from '../utils/dateUtils';

interface AssignmentsViewProps {
  assignments: Assignment[];
  reminders: Reminder[];
  now: Date;
  onAddAssignment: () => void;
  onEditAssignment: (assignment: Assignment) => void;
  onDeleteAssignment: (assignment: Assignment) => void;
  onToggleStatus: (id: string) => void;
  onManageReminderForAssignment: (assignmentId: string, existingReminder?: Reminder) => void;
}

type StatusFilter = 'All' | 'Pending' | 'Completed' | 'Overdue';
type SortMode = 'due' | 'priority';

const PRIORITY_RANK: Record<AssignmentPriority, number> = {
  High: 0,
  Medium: 1,
  Low: 2,
};

const PRIORITY_TEXT_CLASS: Record<AssignmentPriority, string> = {
  High: 'text-red-700',
  Medium: 'text-indigo-700',
  Low: 'text-slate-600',
};

export function AssignmentsView({
  assignments,
  reminders,
  now,
  onAddAssignment,
  onEditAssignment,
  onDeleteAssignment,
  onToggleStatus,
  onManageReminderForAssignment,
}: AssignmentsViewProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [sortMode, setSortMode] = useState<SortMode>('due');
  const [searchQuery, setSearchQuery] = useState('');

  const counts = useMemo(() => {
    const pending = assignments.filter((a) => a.status === 'Pending');
    const completed = assignments.filter((a) => a.status === 'Completed');
    const overdue = pending.filter((a) => isAssignmentOverdue(a, now));
    return {
      all: assignments.length,
      pending: pending.length,
      completed: completed.length,
      overdue: overdue.length,
    };
  }, [assignments, now]);

  const filteredAssignments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return assignments
      .filter((a) => {
        if (statusFilter === 'Pending' && a.status !== 'Pending') return false;
        if (statusFilter === 'Completed' && a.status !== 'Completed') return false;
        if (statusFilter === 'Overdue' && !isAssignmentOverdue(a, now)) return false;
        if (!q) return true;
        return (
          a.title.toLowerCase().includes(q) ||
          a.subject.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // Keep pending items before completed items when viewing All
        if (a.status !== b.status) {
          return a.status === 'Pending' ? -1 : 1;
        }
        if (sortMode === 'priority') {
          const pDiff =
            PRIORITY_RANK[a.priority ?? 'Medium'] - PRIORITY_RANK[b.priority ?? 'Medium'];
          if (pDiff !== 0) return pDiff;
        }
        return (
          combineDateAndTime(a.dueDate, a.dueTime).getTime() -
          combineDateAndTime(b.dueDate, b.dueTime).getTime()
        );
      });
  }, [assignments, statusFilter, sortMode, searchQuery, now]);

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900">
              Assignments &amp; Deadline Tracker
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-slate-500">
              <span className="tabular-nums">{counts.pending} pending</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{counts.completed} completed</span>
              {counts.overdue > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-red-600 tabular-nums">
                    {counts.overdue} overdue
                  </span>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onAddAssignment}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg bg-indigo-600 text-xs sm:text-sm font-medium text-white hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Add Assignment</span>
          </button>
        </div>

        {/* Filter Tabs, Sort & Search */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div
            role="group"
            aria-label="Filter assignments by status"
            className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 self-start"
          >
            {(
              [
                { id: 'All', label: 'All', count: counts.all },
                { id: 'Pending', label: 'Pending', count: counts.pending },
                { id: 'Completed', label: 'Completed', count: counts.completed },
                { id: 'Overdue', label: 'Overdue', count: counts.overdue },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  statusFilter === tab.id
                    ? tab.id === 'Overdue' && tab.count > 0
                      ? 'bg-white text-red-700 shadow-xs'
                      : 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`font-mono text-[11px] tabular-nums ${
                    tab.id === 'Overdue' && tab.count > 0 ? 'text-red-600 font-semibold' : 'text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1 sm:w-64">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title or subject..."
                aria-label="Search assignments"
                className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-white pl-9 pr-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <label className="sr-only" htmlFor="asg-sort-select">
              Sort assignments
            </label>
            <select
              id="asg-sort-select"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="due">Sort: Due Date</option>
              <option value="priority">Sort: Priority</option>
            </select>
          </div>
        </div>
      </section>

      {/* Overdue Alert Strip (shown when overdue items exist and not already viewing Completed/Overdue empty) */}
      {statusFilter !== 'Completed' && counts.overdue > 0 && !searchQuery.trim() && (
        <div
          role="status"
          className="rounded-xl border border-red-200 bg-red-50/75 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 text-xs sm:text-sm text-red-800">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" aria-hidden="true" />
            <span>
              <strong className="font-semibold">{counts.overdue}</strong>{' '}
              {counts.overdue === 1 ? 'assignment is' : 'assignments are'} past the deadline.
            </span>
          </div>
          {statusFilter !== 'Overdue' && (
            <button
              type="button"
              onClick={() => setStatusFilter('Overdue')}
              className="self-start sm:self-center px-3 py-1.5 rounded-lg border border-red-200 bg-white text-xs font-medium text-red-700 hover:bg-red-50 transition-colors whitespace-nowrap"
            >
              Show Overdue Only
            </button>
          )}
        </div>
      )}

      {/* Organized Assignment Cards Grid */}
      {filteredAssignments.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <CheckCircle2 className="mx-auto h-9 w-9 text-slate-300" aria-hidden="true" />
          <h2 className="mt-3 font-display text-base font-semibold text-slate-900">
            {assignments.length === 0
              ? 'No assignments yet'
              : statusFilter === 'Overdue'
                ? 'No overdue assignments'
                : 'No matching assignments found'}
          </h2>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            {assignments.length === 0
              ? 'Create your first assignment with a due date, priority, and reminder.'
              : statusFilter === 'Overdue'
                ? 'Great job — none of your pending assignments are past due.'
                : 'Try adjusting your filter tab or search query.'}
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            {(statusFilter !== 'All' || searchQuery.trim()) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('All');
                  setSearchQuery('');
                }}
                className="px-4 py-2 min-h-[40px] rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Show All Assignments
              </button>
            )}
            <button
              type="button"
              onClick={onAddAssignment}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Add Assignment</span>
            </button>
          </div>
        </section>
      ) : (
        <section
          aria-label="Assignment cards"
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {filteredAssignments.map((asg) => {
            const deadlineStatus = getAssignmentDeadlineStatus(asg, now);
            const isCompleted = asg.status === 'Completed';
            const isOverdue = deadlineStatus === 'Overdue';
            const isDueToday = deadlineStatus === 'Due Today';
            const priority = asg.priority ?? 'Medium';
            const dueDateObj = combineDateAndTime(asg.dueDate, asg.dueTime);
            const linkedReminder = reminders.find((r) => r.assignmentId === asg.id);

            return (
              <article
                key={asg.id}
                className={`rounded-xl border p-5 flex flex-col justify-between gap-4 transition-colors ${
                  isOverdue
                    ? 'border-red-200 bg-red-50/35'
                    : isDueToday
                      ? 'border-amber-200 bg-amber-50/25'
                      : isCompleted
                        ? 'border-slate-200 bg-slate-50/80'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="space-y-3">
                  {/* Top Meta Row: Subject + Deadline Status + Priority */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                      <span className="font-semibold text-indigo-700 truncate">
                        {asg.subject}
                      </span>
                      <span className="text-slate-300" aria-hidden="true">
                        ·
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${PRIORITY_TEXT_CLASS[priority]}`}
                      >
                        <Flag className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span>{priority} priority</span>
                      </span>
                    </div>

                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-700 shrink-0">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Completed</span>
                      </span>
                    ) : isOverdue ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-red-600 shrink-0">
                        <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Overdue</span>
                      </span>
                    ) : isDueToday ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-amber-700 shrink-0">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Due Today</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-medium text-blue-700 shrink-0">
                        <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Upcoming</span>
                      </span>
                    )}
                  </div>

                  {/* Title & Toggle Checkbox */}
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => onToggleStatus(asg.id)}
                      aria-label={
                        isCompleted
                          ? `Mark ${asg.title} as pending`
                          : `Mark ${asg.title} as completed`
                      }
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors ${
                        isCompleted
                          ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'border-slate-300 bg-white text-transparent hover:border-indigo-500 hover:bg-indigo-50'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>

                    <div className="min-w-0 flex-1">
                      <h2
                        className={`font-display text-base font-semibold leading-snug ${
                          isCompleted ? 'text-slate-500 line-through' : 'text-slate-900'
                        }`}
                      >
                        {asg.title}
                      </h2>

                      <p className="mt-1 text-xs text-slate-600 font-mono tabular-nums">
                        Due {formatShortDate(asg.dueDate)} · {formatTimeDisplay(asg.dueTime)}
                        {!isCompleted && (
                          <span className="font-sans text-slate-500">
                            {' '}
                            ({formatRelativeDuration(dueDateObj, now)})
                          </span>
                        )}
                      </p>

                      {asg.description && (
                        <p
                          className={`mt-2 text-xs sm:text-sm leading-relaxed line-clamp-3 ${
                            isCompleted ? 'text-slate-400' : 'text-slate-600'
                          }`}
                        >
                          {asg.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="pt-3 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleStatus(asg.id)}
                      className={`px-3 py-1.5 min-h-[36px] rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
                        isCompleted
                          ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          : 'border-emerald-200 bg-emerald-50/70 text-emerald-700 hover:bg-emerald-100/80'
                      }`}
                    >
                      {isCompleted ? 'Mark Pending' : 'Mark Completed'}
                    </button>

                    {!isCompleted && (
                      <button
                        type="button"
                        onClick={() => onManageReminderForAssignment(asg.id, linkedReminder)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
                          linkedReminder && linkedReminder.enabled
                            ? 'border-violet-200 bg-violet-50/70 text-violet-700 hover:bg-violet-100/80'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <Bell className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          {linkedReminder
                            ? linkedReminder.enabled
                              ? getReminderOffsetLabel(linkedReminder.offsetMinutes)
                              : 'Reminder paused'
                            : 'Remind'}
                        </span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onEditAssignment(asg)}
                      aria-label={`Edit ${asg.title}`}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-indigo-700 transition-colors"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteAssignment(asg)}
                      aria-label={`Delete ${asg.title}`}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
