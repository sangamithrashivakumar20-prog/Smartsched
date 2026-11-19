import {
  Assignment,
  AssignmentPriority,
  AssignmentStatus,
  DAYS_OF_WEEK,
  DayOfWeek,
  EventType,
  TimetableEvent,
} from '../types/scheduler';
import { pad2 } from './dateUtils';

export const UPLOADED_CSV_PATH =
  '/assets/aistudio/SmartSced_-_Testing_Evidence_-_Sheet1__2__50a8d245.csv';

const MONTH_MAP: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

function parseCsvRow(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function normalizeDay(raw: string): DayOfWeek | null {
  const cleaned = raw.trim().toLowerCase();
  const match = DAYS_OF_WEEK.find(
    (d) => d.toLowerCase() === cleaned || d.toLowerCase().slice(0, 3) === cleaned
  );
  return match ?? null;
}

function normalizeEventType(raw: string): EventType {
  const cleaned = raw.trim().toLowerCase();
  if (cleaned.includes('lab')) return 'Lab';
  if (cleaned.includes('tut')) return 'Tutorial';
  return 'Class';
}

function normalizeStatus(raw: string): AssignmentStatus {
  return raw.trim().toLowerCase() === 'completed' ? 'Completed' : 'Pending';
}

function normalizePriority(raw: string): AssignmentPriority {
  const cleaned = raw.trim().toLowerCase();
  if (cleaned === 'high') return 'High';
  if (cleaned === 'low') return 'Low';
  return 'Medium';
}

function parseSingleTimePart(raw: string): {
  hour: number;
  minute: number;
  period: 'AM' | 'PM' | null;
} | null {
  const match = raw.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const period = match[3] ? (match[3].toUpperCase() as 'AM' | 'PM') : null;
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return { hour, minute, period };
}

function to24Hour(hour: number, minute: number, period: 'AM' | 'PM' | null): string {
  let h24 = hour;
  if (period === 'PM' && h24 < 12) {
    h24 += 12;
  } else if (period === 'AM' && h24 === 12) {
    h24 = 0;
  }
  return `${pad2(h24)}:${pad2(minute)}`;
}

export function parseCsvTimeRange(raw: string): { startTime: string; endTime: string } | null {
  const parts = raw.split(/\s*[-–—]\s*/);
  if (parts.length !== 2) return null;

  const start = parseSingleTimePart(parts[0]);
  const end = parseSingleTimePart(parts[1]);
  if (!start || !end) return null;

  const endPeriod = end.period;
  let startPeriod = start.period;

  if (!startPeriod && endPeriod) {
    if (endPeriod === 'AM') {
      startPeriod = 'AM';
    } else {
      // endPeriod === 'PM'
      if (start.hour === 12) {
        startPeriod = 'PM';
      } else if (end.hour === 12) {
        startPeriod = 'AM';
      } else if (start.hour <= end.hour) {
        startPeriod = 'PM';
      } else {
        startPeriod = 'AM';
      }
    }
  }

  return {
    startTime: to24Hour(start.hour, start.minute, startPeriod),
    endTime: to24Hour(end.hour, end.minute, endPeriod),
  };
}

export function parseCsvDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // ISO YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${pad2(Number(isoMatch[2]))}-${pad2(Number(isoMatch[3]))}`;
  }

  // DD Month YYYY (e.g., "22 November 2026")
  const dmyMatch = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = MONTH_MAP[dmyMatch[2].toLowerCase()];
    const year = Number(dmyMatch[3]);
    if (month && day >= 1 && day <= 31) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
  }

  // Month DD, YYYY (e.g., "November 22, 2026")
  const mdyMatch = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (mdyMatch) {
    const month = MONTH_MAP[mdyMatch[1].toLowerCase()];
    const day = Number(mdyMatch[2]);
    const year = Number(mdyMatch[3]);
    if (month && day >= 1 && day <= 31) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
  }

  return null;
}

export interface ParsedCsvResult {
  events: TimetableEvent[];
  assignments: Assignment[];
}

export function parseSmartSchedCsv(csvText: string): ParsedCsvResult {
  const lines = csvText.split(/\r?\n/);
  const events: TimetableEvent[] = [];
  const assignments: Assignment[] = [];

  let mode: 'none' | 'timetable' | 'assignments' = 'none';
  let headers: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i].trim();
    if (!rawLine) {
      continue;
    }

    const row = parseCsvRow(rawLine);
    const nonEmptyCells = row.filter((c) => c.length > 0);
    if (nonEmptyCells.length === 0) {
      continue;
    }

    const lowerRow = row.map((c) => c.toLowerCase());

    // Detect section headers
    if (lowerRow[0] === 'day' && lowerRow.includes('subject')) {
      mode = 'timetable';
      headers = lowerRow;
      continue;
    }

    if (
      (lowerRow[0] === 'assignment' || lowerRow[0] === 'title') &&
      lowerRow.includes('subject')
    ) {
      mode = 'assignments';
      headers = lowerRow;
      continue;
    }

    if (mode === 'timetable') {
      const getCol = (names: string[]) => {
        const idx = headers.findIndex((h) => names.includes(h));
        return idx >= 0 ? (row[idx] ?? '').trim() : '';
      };

      const day = normalizeDay(getCol(['day', 'weekday']));
      const subject = getCol(['subject', 'course']);
      const timeRangeRaw = getCol(['time', 'timing', 'timings']);
      const startRaw = getCol(['start time', 'start']);
      const endRaw = getCol(['end time', 'end']);
      const venue = getCol(['venue', 'room', 'room number', 'location']);
      const typeRaw = getCol(['type', 'event type']);
      const faculty = getCol(['faculty', 'faculty name', 'instructor', 'professor']);

      const parsedTime = timeRangeRaw
        ? parseCsvTimeRange(timeRangeRaw)
        : startRaw && endRaw
          ? parseCsvTimeRange(`${startRaw} - ${endRaw}`)
          : null;

      if (day && subject && parsedTime) {
        events.push({
          id: `csv-evt-${events.length + 1}`,
          subject,
          day,
          startTime: parsedTime.startTime,
          endTime: parsedTime.endTime,
          venue: venue || 'TBA',
          type: normalizeEventType(typeRaw),
          ...(faculty ? { faculty } : {}),
        });
      }
    } else if (mode === 'assignments') {
      const getCol = (names: string[]) => {
        const idx = headers.findIndex((h) => names.includes(h));
        return idx >= 0 ? (row[idx] ?? '').trim() : '';
      };

      const title = getCol(['assignment', 'title', 'task']);
      const subject = getCol(['subject', 'course']);
      const dueDateRaw = getCol(['due date', 'date', 'deadline']);
      const dueTimeRaw = getCol(['due time', 'time']);
      const statusRaw = getCol(['status']);
      const priorityRaw = getCol(['priority']);
      const description = getCol(['description', 'notes']);

      const dueDate = parseCsvDate(dueDateRaw);
      const parsedDueTime = dueTimeRaw ? parseSingleTimePart(dueTimeRaw) : null;
      const dueTime = parsedDueTime
        ? to24Hour(parsedDueTime.hour, parsedDueTime.minute, parsedDueTime.period)
        : '23:59';

      if (title && subject && dueDate) {
        assignments.push({
          id: `csv-asg-${assignments.length + 1}`,
          title,
          subject,
          dueDate,
          dueTime,
          description,
          status: normalizeStatus(statusRaw),
          priority: normalizePriority(priorityRaw),
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  return { events, assignments };
}

export async function fetchAndParseUploadedCsv(): Promise<ParsedCsvResult> {
  const response = await fetch(UPLOADED_CSV_PATH, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load timetable CSV (${response.status})`);
  }
  const text = await response.text();
  return parseSmartSchedCsv(text);
}
