import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  AppNotification,
  Assignment,
  AssignmentPriority,
  AssignmentStatus,
  ClassReminderLeadMinutes,
  DayOfWeek,
  EventType,
  NotificationPreferences,
  NotificationType,
  Reminder,
  ReminderOffsetMinutes,
  StudyReminderLeadMinutes,
  StudySession,
  StudySessionStatus,
  TimetableEvent,
  ToastMessage,
} from '../types/scheduler';
import { fetchAndParseUploadedCsv } from '../utils/csvParser';
import {
  addDaysToDate,
  combineDateAndTime,
  formatShortDate,
  formatTimeDisplay,
  getReminderOffsetLabel,
  getReminderTriggerDate,
  getTodayDayOfWeek,
  toLocalDateString,
} from '../utils/dateUtils';
import { findFreeStudySlots, formatDurationLabel } from '../utils/studyScheduler';

function getStorageKeys(userId: string) {
  const prefix = `smartsched_v2_${userId}`;
  return {
    events: `${prefix}_events`,
    assignments: `${prefix}_assignments`,
    reminders: `${prefix}_reminders`,
    studySessions: `${prefix}_study_sessions`,
    notifications: `${prefix}_notifications`,
    notificationPrefs: `${prefix}_notif_prefs`,
    deliveredKeys: `${prefix}_notif_keys`,
    initialized: `${prefix}_csv_initialized`,
  };
}

const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  classRemindersEnabled: true,
  classLeadMinutes: 10,
  assignmentRemindersEnabled: true,
  assignmentDefaultLeadMinutes: 60,
  studyRemindersEnabled: true,
  studyLeadMinutes: 10,
  browserNotificationsEnabled: true,
};

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function safeReadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  const msg = (error.message ?? '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('could not find the table') ||
    msg.includes('does not exist')
  );
}

function buildRemindersForCsvAssignments(assignments: Assignment[]): Reminder[] {
  return assignments
    .filter((a) => a.status === 'Pending')
    .map((a, idx) => ({
      id: `csv-rem-${idx + 1}`,
      assignmentId: a.id,
      offsetMinutes: 60 as ReminderOffsetMinutes,
      enabled: true,
      dismissed: false,
    }));
}

function buildInitialStudySessions(
  events: TimetableEvent[],
  assignments: Assignment[],
  baseDate: Date = new Date()
): StudySession[] {
  const todayStr = toLocalDateString(baseDate);
  const tomorrowStr = toLocalDateString(addDaysToDate(baseDate, 1));
  const yesterdayStr = toLocalDateString(addDaysToDate(baseDate, -1));

  const created: StudySession[] = [];
  const pendingSubjects = assignments.filter((a) => a.status === 'Pending');
  const firstSubject = pendingSubjects[0]?.subject ?? events[0]?.subject ?? 'C Programming';
  const secondSubject = pendingSubjects[1]?.subject ?? events[1]?.subject ?? 'Quantum Physics';
  const thirdSubject = events[0]?.subject ?? 'Mathematics';

  const yesterdaySlots = findFreeStudySlots(yesterdayStr, 60, events, created);
  created.push({
    id: 'study-seed-1',
    subject: thirdSubject,
    topic: 'Linear Systems & Matrix Revision',
    date: yesterdayStr,
    startTime: yesterdaySlots[0]?.startTime ?? '16:00',
    durationMinutes: 60,
    notes: 'Completed practice problems before seminar.',
    status: 'Completed',
    createdAt: addDaysToDate(baseDate, -1).toISOString(),
  });

  const todaySlots = findFreeStudySlots(todayStr, 60, events, created, undefined, baseDate);
  created.push({
    id: 'study-seed-2',
    subject: firstSubject,
    topic: 'Arrays & Memory Indexing Practice',
    date: todayStr,
    startTime: todaySlots[0]?.startTime ?? '17:00',
    durationMinutes: 60,
    notes: 'Scheduled during free time after college classes.',
    status: 'Pending',
    createdAt: baseDate.toISOString(),
  });

  const tomorrowSlots = findFreeStudySlots(tomorrowStr, 45, events, created);
  created.push({
    id: 'study-seed-3',
    subject: secondSubject,
    topic: 'Lab Record Preparation & Derivations',
    date: tomorrowStr,
    startTime: tomorrowSlots[0]?.startTime ?? '10:00',
    durationMinutes: 45,
    notes: 'Review experiment observations and formulas.',
    status: 'Pending',
    createdAt: baseDate.toISOString(),
  });

  return created;
}

// Supabase row mapping helpers
interface DbEventRow {
  id: string;
  user_id: string;
  subject: string;
  day: string;
  start_time: string;
  end_time: string;
  venue: string;
  type: string;
  faculty: string | null;
}

interface DbAssignmentRow {
  id: string;
  user_id: string;
  title: string;
  subject: string;
  due_date: string;
  due_time: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
}

interface DbReminderRow {
  id: string;
  user_id: string;
  assignment_id: string;
  offset_minutes: number;
  enabled: boolean;
  dismissed: boolean;
}

interface DbStudySessionRow {
  id: string;
  user_id: string;
  subject: string;
  topic: string;
  date: string;
  start_time: string;
  duration_minutes: number;
  notes: string;
  status: string;
  created_at: string;
}

interface DbNotifPrefsRow {
  user_id: string;
  class_reminders_enabled: boolean;
  class_lead_minutes: number;
  assignment_reminders_enabled: boolean;
  assignment_default_lead_minutes: number;
  study_reminders_enabled: boolean;
  study_lead_minutes: number;
  browser_notifications_enabled: boolean;
}

function toDbEvent(userId: string, ev: TimetableEvent): DbEventRow {
  return {
    id: ev.id,
    user_id: userId,
    subject: ev.subject,
    day: ev.day,
    start_time: ev.startTime,
    end_time: ev.endTime,
    venue: ev.venue,
    type: ev.type,
    faculty: ev.faculty ?? null,
  };
}

function fromDbEvent(row: DbEventRow): TimetableEvent {
  return {
    id: row.id,
    subject: row.subject,
    day: row.day as DayOfWeek,
    startTime: row.start_time,
    endTime: row.end_time,
    venue: row.venue,
    type: row.type as EventType,
    faculty: row.faculty ?? undefined,
  };
}

function toDbAssignment(userId: string, asg: Assignment): DbAssignmentRow {
  return {
    id: asg.id,
    user_id: userId,
    title: asg.title,
    subject: asg.subject,
    due_date: asg.dueDate,
    due_time: asg.dueTime,
    description: asg.description,
    status: asg.status,
    priority: asg.priority,
    created_at: asg.createdAt,
  };
}

function fromDbAssignment(row: DbAssignmentRow): Assignment {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    dueDate: row.due_date,
    dueTime: row.due_time,
    description: row.description ?? '',
    status: (row.status === 'Completed' ? 'Completed' : 'Pending') as AssignmentStatus,
    priority: (['High', 'Medium', 'Low'].includes(row.priority)
      ? row.priority
      : 'Medium') as AssignmentPriority,
    createdAt: row.created_at,
  };
}

function toDbReminder(userId: string, rem: Reminder): DbReminderRow {
  return {
    id: rem.id,
    user_id: userId,
    assignment_id: rem.assignmentId,
    offset_minutes: rem.offsetMinutes,
    enabled: rem.enabled,
    dismissed: rem.dismissed,
  };
}

function fromDbReminder(row: DbReminderRow): Reminder {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    offsetMinutes: row.offset_minutes as ReminderOffsetMinutes,
    enabled: Boolean(row.enabled),
    dismissed: Boolean(row.dismissed),
  };
}

function toDbStudySession(userId: string, sess: StudySession): DbStudySessionRow {
  return {
    id: sess.id,
    user_id: userId,
    subject: sess.subject,
    topic: sess.topic,
    date: sess.date,
    start_time: sess.startTime,
    duration_minutes: sess.durationMinutes,
    notes: sess.notes,
    status: sess.status,
    created_at: sess.createdAt,
  };
}

function fromDbStudySession(row: DbStudySessionRow): StudySession {
  return {
    id: row.id,
    subject: row.subject,
    topic: row.topic,
    date: row.date,
    startTime: row.start_time,
    durationMinutes: row.duration_minutes,
    notes: row.notes ?? '',
    status: (row.status === 'Completed' ? 'Completed' : 'Pending') as StudySessionStatus,
    createdAt: row.created_at,
  };
}

function toDbPrefs(userId: string, prefs: NotificationPreferences): DbNotifPrefsRow {
  return {
    user_id: userId,
    class_reminders_enabled: prefs.classRemindersEnabled,
    class_lead_minutes: prefs.classLeadMinutes,
    assignment_reminders_enabled: prefs.assignmentRemindersEnabled,
    assignment_default_lead_minutes: prefs.assignmentDefaultLeadMinutes,
    study_reminders_enabled: prefs.studyRemindersEnabled,
    study_lead_minutes: prefs.studyLeadMinutes,
    browser_notifications_enabled: prefs.browserNotificationsEnabled,
  };
}

function fromDbPrefs(row: DbNotifPrefsRow): NotificationPreferences {
  return {
    classRemindersEnabled: Boolean(row.class_reminders_enabled),
    classLeadMinutes: row.class_lead_minutes as ClassReminderLeadMinutes,
    assignmentRemindersEnabled: Boolean(row.assignment_reminders_enabled),
    assignmentDefaultLeadMinutes: row.assignment_default_lead_minutes as ReminderOffsetMinutes,
    studyRemindersEnabled: Boolean(row.study_reminders_enabled),
    studyLeadMinutes: row.study_lead_minutes as StudyReminderLeadMinutes,
    browserNotificationsEnabled: Boolean(row.browser_notifications_enabled),
  };
}

export function useSmartSchedStore(userId: string | null) {
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(null);
  const [isCsvInitialized, setIsCsvInitialized] = useState<boolean>(false);
  const [isLoadingCsv, setIsLoadingCsv] = useState<boolean>(Boolean(userId));

  const [events, setEvents] = useState<TimetableEvent[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFS
  );

  const deliveredKeysRef = useRef<Set<string>>(new Set());
  const supabaseTablesAvailableRef = useRef<boolean>(false);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [now, setNow] = useState<Date>(() => new Date());
  const [dueAlertReminderIds, setDueAlertReminderIds] = useState<string[]>([]);

  const pushToast = useCallback(
    (type: ToastMessage['type'], title: string, description?: string) => {
      const id = generateId('toast');
      setToasts((prev) => [...prev, { id, type, title, description }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const sendBrowserNotification = useCallback(
    (title: string, body: string) => {
      if (
        !notificationPrefs.browserNotificationsEnabled ||
        typeof Notification === 'undefined' ||
        Notification.permission !== 'granted'
      ) {
        return;
      }
      try {
        new Notification(title, { body });
      } catch {
        // Ignore browser notification errors in restricted contexts
      }
    },
    [notificationPrefs.browserNotificationsEnabled]
  );

  const persistDeliveredKeys = useCallback(() => {
    if (!userId) return;
    const keys = getStorageKeys(userId);
    const recentKeys = Array.from(deliveredKeysRef.current).slice(-250);
    safeWriteJson(keys.deliveredKeys, recentKeys);
  }, [userId]);

  const seedUserSupabaseData = useCallback(
    async (
      targetUserId: string,
      nextEvents: TimetableEvent[],
      nextAssignments: Assignment[],
      nextReminders: Reminder[],
      nextStudy: StudySession[],
      nextPrefs: NotificationPreferences
    ) => {
      if (!supabase || !supabaseTablesAvailableRef.current) return;
      try {
        await Promise.all([
          nextEvents.length > 0
            ? supabase
                .from('timetable_events')
                .upsert(nextEvents.map((e) => toDbEvent(targetUserId, e)))
            : Promise.resolve(),
          nextAssignments.length > 0
            ? supabase
                .from('assignments')
                .upsert(nextAssignments.map((a) => toDbAssignment(targetUserId, a)))
            : Promise.resolve(),
          nextReminders.length > 0
            ? supabase
                .from('reminders')
                .upsert(nextReminders.map((r) => toDbReminder(targetUserId, r)))
            : Promise.resolve(),
          nextStudy.length > 0
            ? supabase
                .from('study_sessions')
                .upsert(nextStudy.map((s) => toDbStudySession(targetUserId, s)))
            : Promise.resolve(),
          supabase
            .from('notification_preferences')
            .upsert(toDbPrefs(targetUserId, nextPrefs)),
        ]);
      } catch {
        // Non-blocking fallback to scoped localStorage
      }
    },
    []
  );

  // Hydrate strict per-user workspace whenever userId changes
  useEffect(() => {
    let cancelled = false;

    if (!userId) {
      setHydratedUserId(null);
      setIsCsvInitialized(false);
      setIsLoadingCsv(false);
      setEvents([]);
      setAssignments([]);
      setReminders([]);
      setStudySessions([]);
      setNotifications([]);
      setNotificationPrefs(DEFAULT_NOTIFICATION_PREFS);
      setDueAlertReminderIds([]);
      deliveredKeysRef.current = new Set();
      supabaseTablesAvailableRef.current = false;
      return;
    }

    const keys = getStorageKeys(userId);
    const localInitialized = localStorage.getItem(keys.initialized) === 'true';
    const localEvents = localInitialized ? safeReadJson<TimetableEvent[]>(keys.events, []) : [];
    const localAssignments = localInitialized
      ? safeReadJson<Assignment[]>(keys.assignments, []).map((asg) => ({
          ...asg,
          priority: asg.priority ?? 'Medium',
        }))
      : [];
    const localReminders = localInitialized ? safeReadJson<Reminder[]>(keys.reminders, []) : [];
    const localStudy = localInitialized
      ? safeReadJson<StudySession[] | null>(keys.studySessions, null) ?? []
      : [];
    const localNotifications = safeReadJson<AppNotification[]>(keys.notifications, []);
    const localPrefs: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFS,
      ...safeReadJson<Partial<NotificationPreferences>>(keys.notificationPrefs, {}),
    };
    const localDeliveredKeys = safeReadJson<string[]>(keys.deliveredKeys, []);

    setHydratedUserId(null);
    setIsLoadingCsv(true);
    setNotifications(localNotifications);
    setNotificationPrefs(localPrefs);
    deliveredKeysRef.current = new Set(localDeliveredKeys);

    const hydrateUserWorkspace = async () => {
      try {
        if (supabase) {
          const [eventsRes, assignmentsRes, remindersRes, studyRes, prefsRes] =
            await Promise.all([
              supabase.from('timetable_events').select('*').eq('user_id', userId),
              supabase
                .from('assignments')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false }),
              supabase.from('reminders').select('*').eq('user_id', userId),
              supabase.from('study_sessions').select('*').eq('user_id', userId),
              supabase
                .from('notification_preferences')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle(),
            ]);

          if (cancelled) return;

          const missingTable =
            isMissingTableError(eventsRes.error) ||
            isMissingTableError(assignmentsRes.error) ||
            isMissingTableError(remindersRes.error) ||
            isMissingTableError(studyRes.error) ||
            isMissingTableError(prefsRes.error);

          supabaseTablesAvailableRef.current = !missingTable;

          if (!missingTable && !eventsRes.error && !assignmentsRes.error) {
            const dbEvents = ((eventsRes.data ?? []) as DbEventRow[]).map(fromDbEvent);
            const dbAssignments = ((assignmentsRes.data ?? []) as DbAssignmentRow[]).map(
              fromDbAssignment
            );
            const dbReminders = ((remindersRes.data ?? []) as DbReminderRow[]).map(fromDbReminder);
            const dbStudy = ((studyRes.data ?? []) as DbStudySessionRow[]).map(
              fromDbStudySession
            );
            const hasDbWorkspace =
              prefsRes.data !== null ||
              dbEvents.length > 0 ||
              dbAssignments.length > 0 ||
              dbReminders.length > 0 ||
              dbStudy.length > 0;

            if (hasDbWorkspace) {
              const resolvedPrefs = prefsRes.data
                ? fromDbPrefs(prefsRes.data as DbNotifPrefsRow)
                : localPrefs;

              setEvents(dbEvents);
              setAssignments(dbAssignments);
              setReminders(dbReminders);
              setStudySessions(dbStudy);
              setNotificationPrefs(resolvedPrefs);
              setIsCsvInitialized(true);
              setHydratedUserId(userId);

              safeWriteJson(keys.events, dbEvents);
              safeWriteJson(keys.assignments, dbAssignments);
              safeWriteJson(keys.reminders, dbReminders);
              safeWriteJson(keys.studySessions, dbStudy);
              safeWriteJson(keys.notificationPrefs, resolvedPrefs);
              localStorage.setItem(keys.initialized, 'true');
              return;
            }
          }
        } else {
          supabaseTablesAvailableRef.current = false;
        }

        // If user already has scoped local data, hydrate & sync up to Supabase if tables exist
        if (localInitialized) {
          if (cancelled) return;
          setEvents(localEvents);
          setAssignments(localAssignments);
          setReminders(localReminders);
          setStudySessions(localStudy);
          setIsCsvInitialized(true);
          setHydratedUserId(userId);
          void seedUserSupabaseData(
            userId,
            localEvents,
            localAssignments,
            localReminders,
            localStudy,
            localPrefs
          );
          return;
        }

        // Fresh account initialization from the uploaded college timetable CSV
        const parsed = await fetchAndParseUploadedCsv();
        if (cancelled) return;
        const initialReminders = buildRemindersForCsvAssignments(parsed.assignments);
        const initialStudy = buildInitialStudySessions(
          parsed.events,
          parsed.assignments,
          new Date()
        );

        setEvents(parsed.events);
        setAssignments(parsed.assignments);
        setReminders(initialReminders);
        setStudySessions(initialStudy);
        setIsCsvInitialized(true);
        setHydratedUserId(userId);

        safeWriteJson(keys.events, parsed.events);
        safeWriteJson(keys.assignments, parsed.assignments);
        safeWriteJson(keys.reminders, initialReminders);
        safeWriteJson(keys.studySessions, initialStudy);
        safeWriteJson(keys.notificationPrefs, localPrefs);
        localStorage.setItem(keys.initialized, 'true');

        void seedUserSupabaseData(
          userId,
          parsed.events,
          parsed.assignments,
          initialReminders,
          initialStudy,
          localPrefs
        );
      } catch {
        if (!cancelled) {
          pushToast(
            'error',
            'Unable to load timetable CSV',
            'Please check that the uploaded CSV asset is accessible.'
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCsv(false);
        }
      }
    };

    void hydrateUserWorkspace();
    return () => {
      cancelled = true;
    };
  }, [userId, pushToast, seedUserSupabaseData]);

  // Persist changes strictly to the active authenticated user's localStorage namespace
  useEffect(() => {
    if (!userId || hydratedUserId !== userId || !isCsvInitialized) return;
    const keys = getStorageKeys(userId);
    safeWriteJson(keys.events, events);
    localStorage.setItem(keys.initialized, 'true');
  }, [events, isCsvInitialized, hydratedUserId, userId]);

  useEffect(() => {
    if (!userId || hydratedUserId !== userId || !isCsvInitialized) return;
    const keys = getStorageKeys(userId);
    safeWriteJson(keys.assignments, assignments);
    localStorage.setItem(keys.initialized, 'true');
  }, [assignments, isCsvInitialized, hydratedUserId, userId]);

  useEffect(() => {
    if (!userId || hydratedUserId !== userId || !isCsvInitialized) return;
    const keys = getStorageKeys(userId);
    safeWriteJson(keys.reminders, reminders);
    localStorage.setItem(keys.initialized, 'true');
  }, [reminders, isCsvInitialized, hydratedUserId, userId]);

  useEffect(() => {
    if (!userId || hydratedUserId !== userId || !isCsvInitialized) return;
    const keys = getStorageKeys(userId);
    safeWriteJson(keys.studySessions, studySessions);
    localStorage.setItem(keys.initialized, 'true');
  }, [studySessions, isCsvInitialized, hydratedUserId, userId]);

  useEffect(() => {
    if (!userId || hydratedUserId !== userId) return;
    const keys = getStorageKeys(userId);
    safeWriteJson(keys.notifications, notifications);
  }, [notifications, hydratedUserId, userId]);

  useEffect(() => {
    if (!userId || hydratedUserId !== userId) return;
    const keys = getStorageKeys(userId);
    safeWriteJson(keys.notificationPrefs, notificationPrefs);
  }, [notificationPrefs, hydratedUserId, userId]);

  // Live 1-second clock + unified notification & reminder evaluator
  useEffect(() => {
    const evaluateAlerts = (currentTime: Date) => {
      if (!userId || hydratedUserId !== userId || !isCsvInitialized) return;
      const todayStr = toLocalDateString(currentTime);
      const todayDay = getTodayDayOfWeek(currentTime);
      const newNotifications: AppNotification[] = [];
      const dueIds: string[] = [];

      const queueNotification = (
        dedupeKey: string,
        type: NotificationType,
        title: string,
        message: string
      ) => {
        if (deliveredKeysRef.current.has(dedupeKey)) return;
        deliveredKeysRef.current.add(dedupeKey);
        newNotifications.push({
          id: generateId('notif'),
          dedupeKey,
          type,
          title,
          message,
          createdAt: currentTime.toISOString(),
          read: false,
        });
      };

      // 1. Class Reminders (from Timetable)
      if (notificationPrefs.classRemindersEnabled && todayDay) {
        const leadMs = notificationPrefs.classLeadMinutes * 60_000;
        for (const ev of events) {
          if (ev.day !== todayDay) continue;
          const startAt = combineDateAndTime(todayStr, ev.startTime);
          const endAt = combineDateAndTime(todayStr, ev.endTime);
          const triggerAt = new Date(startAt.getTime() - leadMs);

          if (
            currentTime.getTime() >= triggerAt.getTime() &&
            currentTime.getTime() < endAt.getTime()
          ) {
            const key = `class:${todayStr}:${ev.id}:${ev.startTime}:${notificationPrefs.classLeadMinutes}`;
            const minsUntil = Math.max(
              0,
              Math.ceil((startAt.getTime() - currentTime.getTime()) / 60_000)
            );
            const timingMsg =
              minsUntil > 0
                ? `Starts in ${minsUntil} min (${formatTimeDisplay(ev.startTime)})`
                : `Started at ${formatTimeDisplay(ev.startTime)}`;
            queueNotification(
              key,
              'class',
              `Upcoming ${ev.type}: ${ev.subject}`,
              `${timingMsg} · Room ${ev.venue}${ev.faculty ? ` · ${ev.faculty}` : ''}`
            );
          }
        }
      }

      // 2. Assignment Reminders (explicit rules + due-today / default lead time)
      const explicitAssignmentIds = new Set<string>(
        reminders.map((r) => r.assignmentId)
      );
      if (notificationPrefs.assignmentRemindersEnabled) {
        for (const reminder of reminders) {
          if (!reminder.enabled) continue;
          const assignment = assignments.find((a) => a.id === reminder.assignmentId);
          if (!assignment || assignment.status === 'Completed') continue;

          const triggerDate = getReminderTriggerDate(assignment, reminder.offsetMinutes);

          if (triggerDate.getTime() <= currentTime.getTime()) {
            if (!reminder.dismissed) {
              dueIds.push(reminder.id);
            }
            const key = `asg-rem:${reminder.id}:${reminder.offsetMinutes}:${assignment.dueDate}:${assignment.dueTime}`;
            queueNotification(
              key,
              'assignment',
              `Assignment Reminder: ${assignment.title}`,
              `${assignment.subject} · Due ${formatShortDate(assignment.dueDate)} at ${formatTimeDisplay(assignment.dueTime)}`
            );
          }
        }
      }

      if (notificationPrefs.assignmentRemindersEnabled) {
        const defaultLeadMs = notificationPrefs.assignmentDefaultLeadMinutes * 60_000;
        for (const asg of assignments) {
          if (asg.status === 'Completed' || explicitAssignmentIds.has(asg.id)) continue;
          const dueAt = combineDateAndTime(asg.dueDate, asg.dueTime);
          const triggerAt = new Date(dueAt.getTime() - defaultLeadMs);
          if (currentTime.getTime() >= triggerAt.getTime()) {
            const key = `asg-auto:${asg.id}:${notificationPrefs.assignmentDefaultLeadMinutes}:${asg.dueDate}:${asg.dueTime}`;
            queueNotification(
              key,
              'assignment',
              `Deadline Approaching: ${asg.title}`,
              `${asg.subject} · Due ${formatShortDate(asg.dueDate)} at ${formatTimeDisplay(asg.dueTime)}`
            );
          }
        }
      }

      // 3. Study Session Reminders (from Study Planner)
      if (notificationPrefs.studyRemindersEnabled) {
        const leadMs = notificationPrefs.studyLeadMinutes * 60_000;
        for (const sess of studySessions) {
          if (sess.status === 'Completed') continue;
          const startAt = combineDateAndTime(sess.date, sess.startTime);
          const endAt = new Date(startAt.getTime() + sess.durationMinutes * 60_000);
          const triggerAt = new Date(startAt.getTime() - leadMs);

          if (
            currentTime.getTime() >= triggerAt.getTime() &&
            currentTime.getTime() < endAt.getTime()
          ) {
            const key = `study:${sess.id}:${sess.date}:${sess.startTime}:${notificationPrefs.studyLeadMinutes}`;
            queueNotification(
              key,
              'study',
              `Study Session: ${sess.subject}`,
              `"${sess.topic}" at ${formatTimeDisplay(sess.startTime)} (${formatDurationLabel(sess.durationMinutes)})`
            );
          }
        }
      }

      setDueAlertReminderIds(dueIds);

      if (newNotifications.length > 0) {
        persistDeliveredKeys();
        setNotifications((prev) => [...newNotifications, ...prev]);
        for (const notif of newNotifications) {
          pushToast('info', notif.title, notif.message);
          sendBrowserNotification(notif.title, notif.message);
        }
      }
    };

    if (userId && hydratedUserId === userId && isCsvInitialized) {
      evaluateAlerts(new Date());
    }

    const intervalId = window.setInterval(() => {
      const current = new Date();
      setNow(current);
      if (userId && hydratedUserId === userId && isCsvInitialized) {
        evaluateAlerts(current);
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [
    userId,
    hydratedUserId,
    isCsvInitialized,
    events,
    assignments,
    reminders,
    studySessions,
    notificationPrefs,
    persistDeliveredKeys,
    pushToast,
    sendBrowserNotification,
  ]);

  // Notification Center Actions
  const updateNotificationPrefs = useCallback(
    (patch: Partial<NotificationPreferences>) => {
      const next = { ...notificationPrefs, ...patch };
      setNotificationPrefs(next);
      if (userId && supabase && supabaseTablesAvailableRef.current) {
        void supabase.from('notification_preferences').upsert(toDbPrefs(userId, next));
      }
      pushToast('success', 'Notification settings saved');
    },
    [notificationPrefs, userId, pushToast]
  );

  const toggleNotificationRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    );
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    pushToast('info', 'All notifications marked as read');
  }, [pushToast]);

  const deleteNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    pushToast('info', 'Notification center cleared');
  }, [pushToast]);

  const triggerTestNotification = useCallback(() => {
    const testNotif: AppNotification = {
      id: generateId('notif'),
      dedupeKey: `test:${Date.now()}`,
      type: 'class',
      title: 'Test Reminder Alert',
      message: 'In-app and browser reminders are active while SmartSched is open.',
      createdAt: new Date().toISOString(),
      read: false,
    };
    setNotifications((prev) => [testNotif, ...prev]);
    pushToast('info', testNotif.title, testNotif.message);
    sendBrowserNotification(testNotif.title, testNotif.message);
  }, [pushToast, sendBrowserNotification]);

  // Timetable Event CRUD
  const addEvent = useCallback(
    (input: Omit<TimetableEvent, 'id'>) => {
      const created: TimetableEvent = { ...input, id: generateId('evt') };
      setEvents((prev) => [...prev, created]);
      if (userId && supabase && supabaseTablesAvailableRef.current) {
        void supabase.from('timetable_events').insert(toDbEvent(userId, created));
      }
      pushToast('success', 'Schedule event added', `${input.subject} on ${input.day}`);
      return created;
    },
    [userId, pushToast]
  );

  const updateEvent = useCallback(
    (id: string, input: Omit<TimetableEvent, 'id'>) => {
      const updated: TimetableEvent = { ...input, id };
      setEvents((prev) => prev.map((ev) => (ev.id === id ? updated : ev)));
      if (userId && supabase && supabaseTablesAvailableRef.current) {
        void supabase
          .from('timetable_events')
          .upsert(toDbEvent(userId, updated));
      }
      pushToast('success', 'Schedule event updated', `${input.subject} (${input.day})`);
    },
    [userId, pushToast]
  );

  const deleteEvent = useCallback(
    (id: string) => {
      const target = events.find((e) => e.id === id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      if (userId && supabase && supabaseTablesAvailableRef.current) {
        void supabase
          .from('timetable_events')
          .delete()
          .eq('user_id', userId)
          .eq('id', id);
      }
      pushToast(
        'info',
        'Schedule event deleted',
        target ? `${target.subject} removed from ${target.day}` : undefined
      );
    },
    [events, userId, pushToast]
  );

  // Assignment CRUD
  const addAssignment = useCallback(
    (
      input: Omit<Assignment, 'id' | 'createdAt'>,
      initialReminderOffset?: ReminderOffsetMinutes | null
    ) => {
      const created: Assignment = {
        ...input,
        id: generateId('asg'),
        createdAt: new Date().toISOString(),
      };
      setAssignments((prev) => [created, ...prev]);

      let createdReminder: Reminder | null = null;
      if (initialReminderOffset) {
        createdReminder = {
          id: generateId('rem'),
          assignmentId: created.id,
          offsetMinutes: initialReminderOffset,
          enabled: true,
          dismissed: false,
        };
        setReminders((prev) => [...prev, createdReminder!]);
      }

      if (userId && supabase && supabaseTablesAvailableRef.current) {
        void supabase.from('assignments').insert(toDbAssignment(userId, created));
        if (createdReminder) {
          void supabase.from('reminders').insert(toDbReminder(userId, createdReminder));
        }
      }

      pushToast(
        'success',
        'Assignment created',
        initialReminderOffset
          ? `${input.title} with ${getReminderOffsetLabel(initialReminderOffset)} reminder`
          : input.title
      );
      return created;
    },
    [userId, pushToast]
  );

  const updateAssignment = useCallback(
    (id: string, input: Omit<Assignment, 'id' | 'createdAt'>) => {
      const previous = assignments.find((a) => a.id === id);
      const deadlineChanged =
        previous &&
        (previous.dueDate !== input.dueDate || previous.dueTime !== input.dueTime);

      const updated: Assignment = {
        ...(previous ?? { id, createdAt: new Date().toISOString() }),
        ...input,
        id,
      };

      setAssignments((prev) =>
        prev.map((asg) => (asg.id === id ? { ...asg, ...input, id } : asg))
      );
      if (deadlineChanged) {
        setReminders((prev) =>
          prev.map((r) => (r.assignmentId === id ? { ...r, dismissed: false } : r))
        );
      }

      if (userId && supabase && supabaseTablesAvailableRef.current) {
        void supabase.from('assignments').upsert(toDbAssignment(userId, updated));
        if (deadlineChanged) {
          void supabase
            .from('reminders')
            .update({ dismissed: false })
            .eq('user_id', userId)
            .eq('assignment_id', id);
        }
      }

      pushToast('success', 'Assignment updated', input.title);
    },
    [assignments, userId, pushToast]
  );

  const toggleAssignmentStatus = useCallback(
    (id: string) => {
      const target = assignments.find((a) => a.id === id);
      if (!target) return;
      const nextStatus: AssignmentStatus =
        target.status === 'Completed' ? 'Pending' : 'Completed';

      setAssignments((prev) =>
        prev.map((asg) => (asg.id === id ? { ...asg, status: nextStatus } : asg))
      );

      if (userId && supabase && supabaseTablesAvailableRef.current) {
        void supabase
          .from('assignments')
          .update({ status: nextStatus })
          .eq('user_id', userId)
          .eq('id', id);
      }

      pushToast(
        'success',
        nextStatus === 'Completed' ? 'Assignment completed' : 'Assignment reopened',
        target.title
      );
    },
    [assignments, userId, pushToast]
  );

  const deleteAssignment = useCallback(
    (id: string) => {
      const target = assignments.find((a) => a.id === id);
      setAssignments((prev) => prev.filter((a) => a.id !== id));
      setReminders((prev) => prev.filter((r) => r.assignmentId !== id));

      if (userId && supabase && supabaseTablesAvailableRef.current) {
        void supabase
          .from('assignments')
          .delete()
          .eq('user_id', userId)
          .eq('id', id);
        void supabase
          .from('reminders')
          .delete()
          .eq('user_id', userId)
          .eq('assignment_id', id);
      }

      pushToast(
        'info',
        'Assignment deleted',
        target ? `${target.title} and its reminders were removed` : undefined
      );
    },
    [assignments, userId, pushToast]
  );

  // Reminder CRUD
  const addReminder = useCallback(
    (assignmentId: string, offsetMinutes: ReminderOffsetMinutes) => {
      const assignment = assignments.find((a) => a.id === assignmentId);
      const duplicate = reminders.find(
        (r) => r.assignmentId === assignmentId && r.offsetMinutes === offsetMinutes
      );
      if (duplicate) {
        const reactivated: Reminder = { ...duplicate, enabled: true, dismissed: false };
        setReminders((prev) =>
          prev.map((r) => (r.id === duplicate.id ? reactivated : r))
        );
        if (userId && supabase && supabaseTablesAvailableRef.current) {
          void supabase.from('reminders').upsert(toDbReminder(userId, reactivated));
        }
        pushToast(
          'info',
          'Reminder reactivated',
          `${assignment?.title ?? 'Assignment'} · ${getReminderOffsetLabel(offsetMinutes)}`
        );
        return reactivated;
      }

      const created: Reminder = {
        id: generateId('rem'),
        assignmentId,
        offsetMinutes,
        enabled: true,
        dismissed: false,
      };
      setReminders((prev) => [...prev, created]);
      if (userId && supabase && supabaseTablesAvailableRef.current) {
        void supabase.from('reminders').insert(toDbReminder(userId, created));
      }
      pushToast(
        'success',
        'Reminder scheduled',
        `${assignment?.title ?? 'Assignment'} · ${getReminderOffsetLabel(offsetMinutes)}`
      );
      return created;
    },
    [assignments, reminders, userId, pushToast]
  );

  const updateReminder = useCallback(
    (id: string, offsetMinutes: ReminderOffsetMinutes) => {
      setReminders((prev) =>
        prev.map((r) => (r.id === id ? { ...r, offsetMinutes, dismissed: false } : r))
      );
      if (userId && supabase && supabaseTablesAvailableRef.current) {
        void supabase
          .from('reminders')
          .update({ offset_minutes: offsetMinutes, dismissed: false })
          .eq('user_id', userId)
          .eq('id', id);
      }
      pushToast('success', 'Reminder updated', getReminderOffsetLabel(offsetMinutes));
    },
    [userId, pushToast]
  );

  const toggleReminderEnabled = useCallback(
    (id: string) => {
      const current = reminders.find((r) => r.id === id);
      const nextEnabled = current ? !current.enabled : true;
      setReminders((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, enabled: nextEnabled, dismissed: false } : r
        )
      );
      if (userId && supabase && supabaseTablesAvailableRef.current) {
        void supabase
          .from('reminders')
          .update({ enabled: nextEnabled, dismissed: false })
          .eq('user_id', userId)
          .eq('id', id);
      }
      pushToast('info', nextEnabled ? 'Reminder enabled' : 'Reminder paused');
    },
    [reminders, userId, pushToast]
  );

  const dismissReminderAlert = useCallback(
    (id: string) => {
      setReminders((prev) =>
        prev.map((r) => (r.id === id ? { ...r, dismissed: true } : r))
      );
      if (userId && supabase && supabaseTablesAvailableRef.current) {
        void supabase
          .from('reminders')
          .update({ dismissed: true })
          .eq('user_id', userId)
          .eq('id', id);
      }
    },
    [userId]
  );

  const deleteReminder = useCallback(
    (id: string) => {
      setReminders((prev) => prev.filter((r) => r.id !== id));
      if (userId && supabase && supabaseTablesAvailableRef.current) {
        void supabase.from('reminders').delete().eq('user_id', userId).eq('id', id);
      }
      pushToast('info', 'Reminder deleted');
    },
    [userId, pushToast]
  );

  // Study Session CRUD
  const addStudySession = useCallback(
    (input: Omit<StudySession, 'id' | 'createdAt'>) => {
      const created: StudySession = {
        ...input,
        id: generateId('study'),
        createdAt: new Date().toISOString(),
      };
      setStudySessions((prev) => [...prev, created]);
      if (userId && supabase && supabaseTablesAvailableRef.current) {
        void supabase.from('study_sessions').insert(toDbStudySession(userId, created));
      }
      pushToast('success', 'Study session planned', `${input.subject} · ${input.topic}`);
      return created;
    },
    [userId, pushToast]
  );

  const updateStudySession = useCallback(
    (id: string, input: Omit<StudySession, 'id' | 'createdAt'>) => {
      const existing = studySessions.find((s) => s.id === id);
      const updated: StudySession = {
        ...(existing ?? { id, createdAt: new Date().toISOString() }),
        ...input,
        id,
      };
      setStudySessions((prev) =>
        prev.map((sess) => (sess.id === id ? { ...sess, ...input, id } : sess))
      );
      if (userId && supabase && supabaseTablesAvailableRef.current) {
        void supabase
          .from('study_sessions')
          .upsert(toDbStudySession(userId, updated));
      }
      pushToast('success', 'Study session updated', `${input.subject} · ${input.topic}`);
    },
    [studySessions, userId, pushToast]
  );

  const toggleStudySessionStatus = useCallback(
    (id: string) => {
      const target = studySessions.find((s) => s.id === id);
      if (!target) return;
      const nextStatus: StudySessionStatus =
        target.status === 'Completed' ? 'Pending' : 'Completed';

      setStudySessions((prev) =>
        prev.map((sess) => (sess.id === id ? { ...sess, status: nextStatus } : sess))
      );
      if (userId && supabase && supabaseTablesAvailableRef.current) {
        void supabase
          .from('study_sessions')
          .update({ status: nextStatus })
          .eq('user_id', userId)
          .eq('id', id);
      }
      pushToast(
        'success',
        nextStatus === 'Completed' ? 'Study session completed' : 'Study session reopened',
        `${target.subject} · ${target.topic}`
      );
    },
    [studySessions, userId, pushToast]
  );

  const deleteStudySession = useCallback(
    (id: string) => {
      const target = studySessions.find((s) => s.id === id);
      setStudySessions((prev) => prev.filter((s) => s.id !== id));
      if (userId && supabase && supabaseTablesAvailableRef.current) {
        void supabase
          .from('study_sessions')
          .delete()
          .eq('user_id', userId)
          .eq('id', id);
      }
      pushToast(
        'info',
        'Study session deleted',
        target ? `${target.subject} · ${target.topic}` : undefined
      );
    },
    [studySessions, userId, pushToast]
  );

  const resetToCsvData = useCallback(async () => {
    if (!userId) return;
    try {
      const parsed = await fetchAndParseUploadedCsv();
      const freshNow = new Date();
      const nextReminders = buildRemindersForCsvAssignments(parsed.assignments);
      const nextStudy = buildInitialStudySessions(
        parsed.events,
        parsed.assignments,
        freshNow
      );

      setNow(freshNow);
      setEvents(parsed.events);
      setAssignments(parsed.assignments);
      setReminders(nextReminders);
      setStudySessions(nextStudy);
      setIsCsvInitialized(true);
      setHydratedUserId(userId);

      if (supabase && supabaseTablesAvailableRef.current) {
        await Promise.all([
          supabase.from('timetable_events').delete().eq('user_id', userId),
          supabase.from('assignments').delete().eq('user_id', userId),
          supabase.from('reminders').delete().eq('user_id', userId),
          supabase.from('study_sessions').delete().eq('user_id', userId),
        ]);
        await seedUserSupabaseData(
          userId,
          parsed.events,
          parsed.assignments,
          nextReminders,
          nextStudy,
          notificationPrefs
        );
      }

      pushToast(
        'success',
        'Timetable CSV reloaded',
        `${parsed.events.length} classes and ${parsed.assignments.length} assignments synced`
      );
    } catch {
      pushToast('error', 'Failed to reload CSV', 'Could not read the uploaded CSV file.');
    }
  }, [userId, notificationPrefs, seedUserSupabaseData, pushToast]);

  return {
    events,
    assignments,
    reminders,
    studySessions,
    notifications,
    notificationPrefs,
    toasts,
    now,
    isLoadingCsv,
    dueAlertReminderIds,
    pushToast,
    dismissToast,
    updateNotificationPrefs,
    toggleNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    clearAllNotifications,
    triggerTestNotification,
    addEvent,
    updateEvent,
    deleteEvent,
    addAssignment,
    updateAssignment,
    toggleAssignmentStatus,
    deleteAssignment,
    addReminder,
    updateReminder,
    toggleReminderEnabled,
    dismissReminderAlert,
    deleteReminder,
    addStudySession,
    updateStudySession,
    toggleStudySessionStatus,
    deleteStudySession,
    resetToCsvData,
  };
}
