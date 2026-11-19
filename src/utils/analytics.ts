import { Assignment, StudySession } from '../types/scheduler';
import { isAssignmentDueToday, isAssignmentOverdue } from './dateUtils';
import { getWeekDates } from './studyScheduler';

export interface AssignmentAnalytics {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  dueToday: number;
  onTrackPending: number;
  completionPct: number;
  byPriority: {
    High: { total: number; completed: number };
    Medium: { total: number; completed: number };
    Low: { total: number; completed: number };
  };
}

export interface DailyStudyPoint {
  dateStr: string;
  shortDay: string;
  dayName: string;
  shortDate: string;
  plannedSessions: number;
  completedSessions: number;
  pendingSessions: number;
  plannedMinutes: number;
  completedMinutes: number;
  plannedHours: number;
  completedHours: number;
}

export interface WeeklyStudyAnalytics {
  days: DailyStudyPoint[];
  totalPlannedSessions: number;
  totalCompletedSessions: number;
  totalPendingSessions: number;
  totalPlannedHours: number;
  totalCompletedHours: number;
  totalPendingHours: number;
  sessionCompletionPct: number;
}

export interface OverallStudyAnalytics {
  totalSessions: number;
  completedSessions: number;
  pendingSessions: number;
  totalHours: number;
  completedHours: number;
  completionPct: number;
}

export interface SubjectProgressItem {
  subject: string;
  plannedSessions: number;
  completedSessions: number;
  pendingSessions: number;
  plannedHours: number;
  completedHours: number;
  studyCompletionPct: number;
  totalAssignments: number;
  completedAssignments: number;
}

export interface ProductivityIndicator {
  label: string;
  tone: 'success' | 'info' | 'warning' | 'danger' | 'neutral';
  description: string;
}

export function computeAssignmentAnalytics(
  assignments: Assignment[],
  now: Date
): AssignmentAnalytics {
  const total = assignments.length;
  const completed = assignments.filter((a) => a.status === 'Completed').length;
  const pending = total - completed;
  const overdue = assignments.filter((a) => isAssignmentOverdue(a, now)).length;
  const dueToday = assignments.filter((a) => isAssignmentDueToday(a, now)).length;
  const onTrackPending = Math.max(0, pending - overdue);
  const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const byPriority: AssignmentAnalytics['byPriority'] = {
    High: { total: 0, completed: 0 },
    Medium: { total: 0, completed: 0 },
    Low: { total: 0, completed: 0 },
  };

  for (const asg of assignments) {
    const p = asg.priority ?? 'Medium';
    byPriority[p].total += 1;
    if (asg.status === 'Completed') {
      byPriority[p].completed += 1;
    }
  }

  return {
    total,
    completed,
    pending,
    overdue,
    dueToday,
    onTrackPending,
    completionPct,
    byPriority,
  };
}

export function computeWeeklyStudyAnalytics(
  studySessions: StudySession[],
  weekStartMonday: Date
): WeeklyStudyAnalytics {
  const weekDates = getWeekDates(weekStartMonday);

  const days: DailyStudyPoint[] = weekDates.map((wd) => {
    const daySessions = studySessions.filter((s) => s.date === wd.dateStr);
    const completedList = daySessions.filter((s) => s.status === 'Completed');
    const pendingList = daySessions.filter((s) => s.status === 'Pending');

    const plannedMinutes = daySessions.reduce(
      (sum, s) => sum + s.durationMinutes,
      0
    );
    const completedMinutes = completedList.reduce(
      (sum, s) => sum + s.durationMinutes,
      0
    );

    return {
      dateStr: wd.dateStr,
      shortDay: wd.shortDay,
      dayName: wd.dayName,
      shortDate: wd.shortDate,
      plannedSessions: daySessions.length,
      completedSessions: completedList.length,
      pendingSessions: pendingList.length,
      plannedMinutes,
      completedMinutes,
      plannedHours: Number((plannedMinutes / 60).toFixed(2)),
      completedHours: Number((completedMinutes / 60).toFixed(2)),
    };
  });

  const totalPlannedSessions = days.reduce((s, d) => s + d.plannedSessions, 0);
  const totalCompletedSessions = days.reduce((s, d) => s + d.completedSessions, 0);
  const totalPendingSessions = days.reduce((s, d) => s + d.pendingSessions, 0);

  const totalPlannedMinutes = days.reduce((s, d) => s + d.plannedMinutes, 0);
  const totalCompletedMinutes = days.reduce((s, d) => s + d.completedMinutes, 0);

  const totalPlannedHours = Number((totalPlannedMinutes / 60).toFixed(1));
  const totalCompletedHours = Number((totalCompletedMinutes / 60).toFixed(1));
  const totalPendingHours = Number(
    (Math.max(0, totalPlannedMinutes - totalCompletedMinutes) / 60).toFixed(1)
  );

  const sessionCompletionPct =
    totalPlannedSessions > 0
      ? Math.round((totalCompletedSessions / totalPlannedSessions) * 100)
      : 0;

  return {
    days,
    totalPlannedSessions,
    totalCompletedSessions,
    totalPendingSessions,
    totalPlannedHours,
    totalCompletedHours,
    totalPendingHours,
    sessionCompletionPct,
  };
}

export function computeOverallStudyAnalytics(
  studySessions: StudySession[]
): OverallStudyAnalytics {
  const totalSessions = studySessions.length;
  const completedList = studySessions.filter((s) => s.status === 'Completed');
  const completedSessions = completedList.length;
  const pendingSessions = totalSessions - completedSessions;

  const totalMinutes = studySessions.reduce((s, sess) => s + sess.durationMinutes, 0);
  const completedMinutes = completedList.reduce(
    (s, sess) => s + sess.durationMinutes,
    0
  );

  return {
    totalSessions,
    completedSessions,
    pendingSessions,
    totalHours: Number((totalMinutes / 60).toFixed(1)),
    completedHours: Number((completedMinutes / 60).toFixed(1)),
    completionPct:
      totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0,
  };
}

export function computeSubjectProgress(
  studySessions: StudySession[],
  assignments: Assignment[]
): SubjectProgressItem[] {
  const map = new Map<
    string,
    {
      subject: string;
      plannedSessions: number;
      completedSessions: number;
      plannedMinutes: number;
      completedMinutes: number;
      totalAssignments: number;
      completedAssignments: number;
    }
  >();

  const ensureEntry = (rawName: string) => {
    const trimmed = rawName.trim() || 'General';
    const key = trimmed.toLowerCase();
    let entry = map.get(key);
    if (!entry) {
      entry = {
        subject: trimmed,
        plannedSessions: 0,
        completedSessions: 0,
        plannedMinutes: 0,
        completedMinutes: 0,
        totalAssignments: 0,
        completedAssignments: 0,
      };
      map.set(key, entry);
    }
    return entry;
  };

  for (const sess of studySessions) {
    const entry = ensureEntry(sess.subject);
    entry.plannedSessions += 1;
    entry.plannedMinutes += sess.durationMinutes;
    if (sess.status === 'Completed') {
      entry.completedSessions += 1;
      entry.completedMinutes += sess.durationMinutes;
    }
  }

  for (const asg of assignments) {
    const entry = ensureEntry(asg.subject);
    entry.totalAssignments += 1;
    if (asg.status === 'Completed') {
      entry.completedAssignments += 1;
    }
  }

  return Array.from(map.values())
    .map((entry) => ({
      subject: entry.subject,
      plannedSessions: entry.plannedSessions,
      completedSessions: entry.completedSessions,
      pendingSessions: entry.plannedSessions - entry.completedSessions,
      plannedHours: Number((entry.plannedMinutes / 60).toFixed(1)),
      completedHours: Number((entry.completedMinutes / 60).toFixed(1)),
      studyCompletionPct:
        entry.plannedSessions > 0
          ? Math.round((entry.completedSessions / entry.plannedSessions) * 100)
          : 0,
      totalAssignments: entry.totalAssignments,
      completedAssignments: entry.completedAssignments,
    }))
    .sort((a, b) => {
      if (b.plannedHours !== a.plannedHours) return b.plannedHours - a.plannedHours;
      if (b.totalAssignments !== a.totalAssignments) {
        return b.totalAssignments - a.totalAssignments;
      }
      return a.subject.localeCompare(b.subject);
    });
}

export function computeProductivityIndicator(
  assignmentStats: AssignmentAnalytics,
  weeklyStudyStats: WeeklyStudyAnalytics
): ProductivityIndicator {
  const hasAssignments = assignmentStats.total > 0;
  const hasStudy = weeklyStudyStats.totalPlannedSessions > 0;

  if (!hasAssignments && !hasStudy) {
    return {
      label: 'No Activity Yet',
      tone: 'neutral',
      description: 'Add assignments or study sessions to see live progress.',
    };
  }

  const ratios: number[] = [];
  if (hasAssignments) ratios.push(assignmentStats.completionPct);
  if (hasStudy) ratios.push(weeklyStudyStats.sessionCompletionPct);
  const avgPct = Math.round(
    ratios.reduce((sum, r) => sum + r, 0) / ratios.length
  );

  if (assignmentStats.overdue > 0 && avgPct < 50) {
    return {
      label: 'Needs Attention',
      tone: 'danger',
      description: `${assignmentStats.overdue} overdue ${
        assignmentStats.overdue === 1 ? 'assignment' : 'assignments'
      } · ${avgPct}% combined completion`,
    };
  }

  if (assignmentStats.overdue > 0) {
    return {
      label: 'Catching Up',
      tone: 'warning',
      description: `${assignmentStats.overdue} overdue · ${weeklyStudyStats.totalCompletedSessions}/${weeklyStudyStats.totalPlannedSessions} study sessions done this week`,
    };
  }

  if (avgPct >= 75) {
    return {
      label: 'Strong Momentum',
      tone: 'success',
      description: `${assignmentStats.completionPct}% assignments done · ${weeklyStudyStats.totalCompletedHours.toFixed(1)}h studied this week`,
    };
  }

  if (avgPct >= 40) {
    return {
      label: 'On Track',
      tone: 'info',
      description: `${assignmentStats.completionPct}% assignments · ${weeklyStudyStats.totalCompletedSessions}/${weeklyStudyStats.totalPlannedSessions} weekly sessions completed`,
    };
  }

  return {
    label: 'In Progress',
    tone: 'info',
    description: `${assignmentStats.pending} pending tasks · ${weeklyStudyStats.totalPendingSessions} study sessions queued this week`,
  };
}
