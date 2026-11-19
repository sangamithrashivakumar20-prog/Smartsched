import {
  Assignment,
  DAYS_OF_WEEK,
  DayOfWeek,
  ReminderOffsetMinutes,
  TimetableEvent,
} from '../types/scheduler';

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function addDaysToDate(base: Date, days: number): Date {
  const next = new Date(base.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

export function combineDateAndTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (!year || !month || !day) {
    return new Date(NaN);
  }
  return new Date(year, month - 1, day, Number.isFinite(hours) ? hours : 23, Number.isFinite(minutes) ? minutes : 59, 0, 0);
}

export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

export function formatTimeDisplay(timeStr: string): string {
  const [hRaw, mRaw] = timeStr.split(':').map(Number);
  if (!Number.isFinite(hRaw) || !Number.isFinite(mRaw)) return timeStr;
  const period = hRaw >= 12 ? 'PM' : 'AM';
  const h12 = hRaw % 12 === 0 ? 12 : hRaw % 12;
  return `${h12}:${pad2(mRaw)} ${period}`;
}

export function formatTimeRange(startTime: string, endTime: string): string {
  return `${formatTimeDisplay(startTime)} – ${formatTimeDisplay(endTime)}`;
}

export function formatFullDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTimeReadable(date: Date): string {
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function getGreeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function getTodayDayOfWeek(now: Date = new Date()): DayOfWeek | null {
  const dayIndex = now.getDay(); // 0 = Sun, 1 = Mon, ... 6 = Sat
  if (dayIndex === 0) return null;
  return DAYS_OF_WEEK[dayIndex - 1];
}

export function isAssignmentOverdue(assignment: Assignment, now: Date = new Date()): boolean {
  if (assignment.status === 'Completed') return false;
  const due = combineDateAndTime(assignment.dueDate, assignment.dueTime);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < now.getTime();
}

export function isAssignmentDueToday(assignment: Assignment, now: Date = new Date()): boolean {
  if (assignment.status === 'Completed') return false;
  if (isAssignmentOverdue(assignment, now)) return false;
  return assignment.dueDate === toLocalDateString(now);
}

export function isAssignmentDueSoon(assignment: Assignment, now: Date = new Date()): boolean {
  if (assignment.status === 'Completed') return false;
  const due = combineDateAndTime(assignment.dueDate, assignment.dueTime);
  if (Number.isNaN(due.getTime())) return false;
  const diffMs = due.getTime() - now.getTime();
  return diffMs >= 0 && diffMs <= 24 * 60 * 60 * 1000;
}

export type AssignmentDeadlineStatus = 'Completed' | 'Overdue' | 'Due Today' | 'Upcoming';

export function getAssignmentDeadlineStatus(
  assignment: Assignment,
  now: Date = new Date()
): AssignmentDeadlineStatus {
  if (assignment.status === 'Completed') return 'Completed';
  if (isAssignmentOverdue(assignment, now)) return 'Overdue';
  if (isAssignmentDueToday(assignment, now)) return 'Due Today';
  return 'Upcoming';
}

export function formatRelativeDuration(target: Date, now: Date = new Date()): string {
  const diffMs = target.getTime() - now.getTime();
  const absMinutes = Math.round(Math.abs(diffMs) / 60_000);

  if (absMinutes < 1) {
    return diffMs >= 0 ? 'Right now' : 'Just now';
  }

  const days = Math.floor(absMinutes / (60 * 24));
  const hours = Math.floor((absMinutes % (60 * 24)) / 60);
  const mins = absMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (days === 0 && mins > 0) parts.push(`${mins}m`);

  const label = parts.join(' ');
  return diffMs >= 0 ? `In ${label}` : `${label} ago`;
}

export function getReminderTriggerDate(assignment: Assignment, offsetMinutes: ReminderOffsetMinutes): Date {
  const due = combineDateAndTime(assignment.dueDate, assignment.dueTime);
  return new Date(due.getTime() - offsetMinutes * 60_000);
}

export function getReminderOffsetLabel(offsetMinutes: ReminderOffsetMinutes): string {
  switch (offsetMinutes) {
    case 15:
      return '15 minutes before';
    case 30:
      return '30 minutes before';
    case 60:
      return '1 hour before';
    case 1440:
      return '1 day before';
  }
}

export function getEventDurationHours(startTime: string, endTime: string): number {
  const diff = timeToMinutes(endTime) - timeToMinutes(startTime);
  return Math.max(0, diff / 60);
}

export function getClassLiveStatus(
  day: DayOfWeek,
  startTime: string,
  endTime: string,
  now: Date = new Date()
): 'live' | 'upcoming' | 'done' | null {
  const today = getTodayDayOfWeek(now);
  if (today !== day) return null;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (nowMinutes >= start && nowMinutes < end) return 'live';
  if (nowMinutes < start) return 'upcoming';
  return 'done';
}

export function formatLiveCountdown(target: Date, now: Date = new Date()): string {
  const diffMs = Math.max(0, target.getTime() - now.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${pad2(seconds)}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${pad2(seconds)}s`;
  }
  return `${seconds}s`;
}

export interface OngoingClassInfo {
  event: TimetableEvent;
  endsAt: Date;
  remainingMs: number;
}

export interface NextClassInfo {
  event: TimetableEvent;
  startsAt: Date;
  remainingMs: number;
  isToday: boolean;
}

function buildDateOnOffset(base: Date, dayOffset: number, timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number);
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() + dayOffset,
    Number.isFinite(h) ? h : 0,
    Number.isFinite(m) ? m : 0,
    0,
    0
  );
}

export function getOngoingAndNextClass(
  events: TimetableEvent[],
  now: Date = new Date()
): {
  ongoing: OngoingClassInfo | null;
  nextToday: NextClassInfo | null;
  nextUpcoming: NextClassInfo | null;
} {
  const todayDay = getTodayDayOfWeek(now);
  let ongoing: OngoingClassInfo | null = null;
  let nextToday: NextClassInfo | null = null;

  if (todayDay) {
    const todaySorted = events
      .filter((e) => e.day === todayDay)
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    for (const ev of todaySorted) {
      const startAt = buildDateOnOffset(now, 0, ev.startTime);
      const endAt = buildDateOnOffset(now, 0, ev.endTime);

      if (!ongoing && now.getTime() >= startAt.getTime() && now.getTime() < endAt.getTime()) {
        ongoing = {
          event: ev,
          endsAt: endAt,
          remainingMs: endAt.getTime() - now.getTime(),
        };
      } else if (!nextToday && startAt.getTime() > now.getTime()) {
        nextToday = {
          event: ev,
          startsAt: startAt,
          remainingMs: startAt.getTime() - now.getTime(),
          isToday: true,
        };
      }
    }
  }

  let nextUpcoming: NextClassInfo | null = nextToday;
  if (!nextUpcoming && events.length > 0) {
    for (let offset = 1; offset <= 7; offset += 1) {
      const candidateDate = addDaysToDate(now, offset);
      const candidateDay = getTodayDayOfWeek(candidateDate);
      if (!candidateDay) continue;
      const dayEvents = events
        .filter((e) => e.day === candidateDay)
        .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
      if (dayEvents.length > 0) {
        const first = dayEvents[0];
        const startsAt = buildDateOnOffset(now, offset, first.startTime);
        nextUpcoming = {
          event: first,
          startsAt,
          remainingMs: startsAt.getTime() - now.getTime(),
          isToday: false,
        };
        break;
      }
    }
  }

  return { ongoing, nextToday, nextUpcoming };
}

