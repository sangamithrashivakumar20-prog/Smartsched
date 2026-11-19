export const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export const EVENT_TYPES = ['Class', 'Lab', 'Tutorial'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export interface TimetableEvent {
  id: string;
  subject: string;
  day: DayOfWeek;
  startTime: string; // HH:mm 24-hour format
  endTime: string;   // HH:mm 24-hour format
  venue: string;
  type: EventType;
  faculty?: string;
}

export type AssignmentStatus = 'Pending' | 'Completed';

export const ASSIGNMENT_PRIORITIES = ['High', 'Medium', 'Low'] as const;
export type AssignmentPriority = (typeof ASSIGNMENT_PRIORITIES)[number];

export interface Assignment {
  id: string;
  title: string;
  subject: string;
  dueDate: string; // YYYY-MM-DD
  dueTime: string; // HH:mm 24-hour format
  description: string;
  status: AssignmentStatus;
  priority: AssignmentPriority;
  createdAt: string;
}

export type ReminderOffsetMinutes = 15 | 30 | 60 | 1440;

export const REMINDER_OPTIONS: { value: ReminderOffsetMinutes; label: string }[] = [
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 1440, label: '1 day before' },
];

export interface Reminder {
  id: string;
  assignmentId: string;
  offsetMinutes: ReminderOffsetMinutes;
  enabled: boolean;
  dismissed: boolean;
}

export type StudySessionStatus = 'Pending' | 'Completed';

export const STUDY_DURATION_PRESETS = [
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
] as const;

export interface StudySession {
  id: string;
  subject: string;
  topic: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm 24-hour format
  durationMinutes: number;
  notes: string;
  status: StudySessionStatus;
  createdAt: string;
}

export type ClassReminderLeadMinutes = 5 | 10 | 15;

export const CLASS_REMINDER_OPTIONS: { value: ClassReminderLeadMinutes; label: string }[] = [
  { value: 5, label: '5 minutes before' },
  { value: 10, label: '10 minutes before' },
  { value: 15, label: '15 minutes before' },
];

export type StudyReminderLeadMinutes = 5 | 10 | 15 | 30;

export const STUDY_REMINDER_OPTIONS: { value: StudyReminderLeadMinutes; label: string }[] = [
  { value: 5, label: '5 minutes before' },
  { value: 10, label: '10 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
];

export interface NotificationPreferences {
  classRemindersEnabled: boolean;
  classLeadMinutes: ClassReminderLeadMinutes;
  assignmentRemindersEnabled: boolean;
  assignmentDefaultLeadMinutes: ReminderOffsetMinutes;
  studyRemindersEnabled: boolean;
  studyLeadMinutes: StudyReminderLeadMinutes;
  browserNotificationsEnabled: boolean;
}

export type NotificationType = 'class' | 'assignment' | 'study';

export interface AppNotification {
  id: string;
  dedupeKey: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string; // ISO timestamp
  read: boolean;
}

export type PageView =
  | 'dashboard'
  | 'timetable'
  | 'study-planner'
  | 'assignments'
  | 'reminders'
  | 'analytics';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}
