import { DayOfWeek, StudySession, TimetableEvent } from '../types/scheduler';
import {
  addDaysToDate,
  formatTimeDisplay,
  pad2,
  timeToMinutes,
  toLocalDateString,
} from './dateUtils';

export function minutesToTimeString(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

export function getStudyEndTime(startTime: string, durationMinutes: number): string {
  const total = timeToMinutes(startTime) + durationMinutes;
  const wrapped = ((total % 1440) + 1440) % 1440;
  return minutesToTimeString(wrapped);
}

export function formatDurationLabel(durationMinutes: number): string {
  if (durationMinutes < 60) return `${durationMinutes} min`;
  const hours = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  if (mins === 0) return hours === 1 ? '1 hour' : `${hours} hours`;
  return `${hours}h ${mins}m`;
}

export function getDayOfWeekFromDateString(dateStr: string): DayOfWeek | null {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  const dayIdx = date.getDay(); // 0=Sun, 1=Mon...6=Sat
  const map: Record<number, DayOfWeek> = {
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
  };
  return map[dayIdx] ?? null;
}

export function getMondayOfWeek(referenceDate: Date): Date {
  const copy = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  const day = copy.getDay(); // 0=Sun..6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diffToMonday);
  return copy;
}

export function getWeekDates(weekStartMonday: Date): {
  dateStr: string;
  dateObj: Date;
  dayName: string;
  shortDay: string;
  shortDate: string;
}[] {
  return Array.from({ length: 7 }, (_, i) => {
    const dateObj = addDaysToDate(weekStartMonday, i);
    return {
      dateStr: toLocalDateString(dateObj),
      dateObj,
      dayName: dateObj.toLocaleDateString('en-US', { weekday: 'long' }),
      shortDay: dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
      shortDate: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    };
  });
}

export interface TimeConflictResult {
  classConflicts: TimetableEvent[];
  sessionConflicts: StudySession[];
}

export function checkStudyTimeConflict(
  dateStr: string,
  startTime: string,
  durationMinutes: number,
  timetableEvents: TimetableEvent[],
  studySessions: StudySession[],
  excludeSessionId?: string
): TimeConflictResult {
  const start = timeToMinutes(startTime);
  const end = start + durationMinutes;
  const weekday = getDayOfWeekFromDateString(dateStr);

  const classConflicts = weekday
    ? timetableEvents.filter((ev) => {
        if (ev.day !== weekday) return false;
        const evStart = timeToMinutes(ev.startTime);
        const evEnd = timeToMinutes(ev.endTime);
        return start < evEnd && end > evStart;
      })
    : [];

  const sessionConflicts = studySessions.filter((sess) => {
    if (excludeSessionId && sess.id === excludeSessionId) return false;
    if (sess.date !== dateStr) return false;
    const sStart = timeToMinutes(sess.startTime);
    const sEnd = sStart + sess.durationMinutes;
    return start < sEnd && end > sStart;
  });

  return { classConflicts, sessionConflicts };
}

export interface FreeSlotSuggestion {
  startTime: string;
  endTime: string;
  label: string;
}

/**
 * Finds conflict-free study start times on a given date between 07:00 and 22:00
 * avoiding both college timetable hours and existing study sessions.
 */
export function findFreeStudySlots(
  dateStr: string,
  durationMinutes: number,
  timetableEvents: TimetableEvent[],
  studySessions: StudySession[],
  excludeSessionId?: string,
  now?: Date
): FreeSlotSuggestion[] {
  const earliestMinute = 7 * 60; // 07:00
  const latestEndMinute = 22 * 60; // 22:00
  const isToday = now ? toLocalDateString(now) === dateStr : false;
  const nowMinutes = now ? now.getHours() * 60 + now.getMinutes() : 0;

  const suggestions: FreeSlotSuggestion[] = [];
  let lastPickedEnd = -1;

  for (let m = earliestMinute; m + durationMinutes <= latestEndMinute; m += 30) {
    if (isToday && m < nowMinutes + 15) continue;

    const candidateStart = minutesToTimeString(m);
    const conflicts = checkStudyTimeConflict(
      dateStr,
      candidateStart,
      durationMinutes,
      timetableEvents,
      studySessions,
      excludeSessionId
    );

    if (
      conflicts.classConflicts.length === 0 &&
      conflicts.sessionConflicts.length === 0
    ) {
      // Space suggestions cleanly so users see distinct windows across the day
      if (m >= lastPickedEnd || suggestions.length === 0) {
        const endTime = minutesToTimeString(m + durationMinutes);
        suggestions.push({
          startTime: candidateStart,
          endTime,
          label: `${formatTimeDisplay(candidateStart)} – ${formatTimeDisplay(endTime)}`,
        });
        lastPickedEnd = m + Math.max(60, durationMinutes);
        if (suggestions.length >= 6) break;
      }
    }
  }

  return suggestions;
}

export interface FreeTimeWindow {
  startTime: string;
  endTime: string;
  minutes: number;
}

/**
 * Returns contiguous daytime free blocks (08:00 - 21:00) on a date
 * around college classes and planned study sessions.
 */
export function getDayFreeWindows(
  dateStr: string,
  timetableEvents: TimetableEvent[],
  studySessions: StudySession[],
  now?: Date
): FreeTimeWindow[] {
  let dayStart = 8 * 60;
  const dayEnd = 21 * 60;
  if (now && toLocalDateString(now) === dateStr) {
    const currentMins = now.getHours() * 60 + now.getMinutes() + 15;
    const roundedUp = Math.ceil(currentMins / 15) * 15;
    dayStart = Math.max(dayStart, roundedUp);
  }
  if (dayStart >= dayEnd) {
    return [];
  }
  const weekday = getDayOfWeekFromDateString(dateStr);

  const busy: { start: number; end: number }[] = [];

  if (weekday) {
    for (const ev of timetableEvents) {
      if (ev.day !== weekday) continue;
      busy.push({
        start: Math.max(dayStart, timeToMinutes(ev.startTime)),
        end: Math.min(dayEnd, timeToMinutes(ev.endTime)),
      });
    }
  }

  for (const sess of studySessions) {
    if (sess.date !== dateStr) continue;
    const sStart = timeToMinutes(sess.startTime);
    const sEnd = sStart + sess.durationMinutes;
    busy.push({
      start: Math.max(dayStart, sStart),
      end: Math.min(dayEnd, sEnd),
    });
  }

  busy.sort((a, b) => a.start - b.start);

  // Merge overlapping busy intervals
  const merged: { start: number; end: number }[] = [];
  for (const interval of busy) {
    if (interval.end <= interval.start) continue;
    const prev = merged[merged.length - 1];
    if (!prev || interval.start > prev.end) {
      merged.push({ ...interval });
    } else {
      prev.end = Math.max(prev.end, interval.end);
    }
  }

  const windows: FreeTimeWindow[] = [];
  let cursor = dayStart;
  for (const block of merged) {
    if (block.start - cursor >= 30) {
      windows.push({
        startTime: minutesToTimeString(cursor),
        endTime: minutesToTimeString(block.start),
        minutes: block.start - cursor,
      });
    }
    cursor = Math.max(cursor, block.end);
  }
  if (dayEnd - cursor >= 30) {
    windows.push({
      startTime: minutesToTimeString(cursor),
      endTime: minutesToTimeString(dayEnd),
      minutes: dayEnd - cursor,
    });
  }

  return windows;
}
