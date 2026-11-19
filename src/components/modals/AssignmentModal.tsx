import { FormEvent, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  ASSIGNMENT_PRIORITIES,
  Assignment,
  AssignmentPriority,
  AssignmentStatus,
  REMINDER_OPTIONS,
  ReminderOffsetMinutes,
} from '../../types/scheduler';
import { addDaysToDate, toLocalDateString } from '../../utils/dateUtils';

interface AssignmentModalProps {
  open: boolean;
  initialAssignment: Assignment | null;
  subjectSuggestions: string[];
  onClose: () => void;
  onSave: (
    data: Omit<Assignment, 'id' | 'createdAt'>,
    existingId?: string,
    initialReminderOffset?: ReminderOffsetMinutes | null
  ) => void;
}

export function AssignmentModal({
  open,
  initialAssignment,
  subjectSuggestions,
  onClose,
  onSave,
}: AssignmentModalProps) {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('23:59');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<AssignmentStatus>('Pending');
  const [priority, setPriority] = useState<AssignmentPriority>('Medium');
  const [reminderOffset, setReminderOffset] = useState<string>('60');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initialAssignment) {
      setTitle(initialAssignment.title);
      setSubject(initialAssignment.subject);
      setDueDate(initialAssignment.dueDate);
      setDueTime(initialAssignment.dueTime);
      setDescription(initialAssignment.description);
      setStatus(initialAssignment.status);
      setPriority(initialAssignment.priority ?? 'Medium');
    } else {
      setTitle('');
      setSubject('');
      setDueDate(toLocalDateString(addDaysToDate(new Date(), 2)));
      setDueTime('23:59');
      setDescription('');
      setStatus('Pending');
      setPriority('Medium');
      setReminderOffset('60');
    }
  }, [open, initialAssignment]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedSubject = subject.trim();

    if (!trimmedTitle) {
      setError('Please enter an assignment title.');
      return;
    }
    if (!trimmedSubject) {
      setError('Please enter a subject name.');
      return;
    }
    if (!dueDate) {
      setError('Please choose a due date.');
      return;
    }
    if (!dueTime) {
      setError('Please choose a due time.');
      return;
    }

    const parsedReminder =
      !initialAssignment && reminderOffset !== 'none'
        ? (Number(reminderOffset) as ReminderOffsetMinutes)
        : null;

    onSave(
      {
        title: trimmedTitle,
        subject: trimmedSubject,
        dueDate,
        dueTime,
        description: description.trim(),
        status,
        priority,
      },
      initialAssignment?.id,
      parsedReminder
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assignment-modal-title"
    >
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2
              id="assignment-modal-title"
              className="font-display text-lg font-semibold text-slate-900"
            >
              {initialAssignment ? 'Edit Assignment' : 'Add Assignment'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Track deadlines, coursework details, and completion status.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="asg-title" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Assignment Title
            </label>
            <input
              id="asg-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Operating Systems Lab 3 Report"
              className="w-full min-h-[42px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div>
            <label htmlFor="asg-subject" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Subject
            </label>
            <input
              id="asg-subject"
              type="text"
              list="subject-suggestions"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Operating Systems"
              className="w-full min-h-[42px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <datalist id="subject-suggestions">
              {subjectSuggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="asg-due-date" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Due Date
              </label>
              <input
                id="asg-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full min-h-[42px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 font-mono text-sm tabular-nums text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label htmlFor="asg-due-time" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Due Time
              </label>
              <input
                id="asg-due-time"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full min-h-[42px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 font-mono text-sm tabular-nums text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700 mb-1.5">
              Priority
            </span>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100">
              {ASSIGNMENT_PRIORITIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPriority(item)}
                  className={`min-h-[36px] rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    priority === item
                      ? item === 'High'
                        ? 'bg-white text-red-700 shadow-xs'
                        : item === 'Medium'
                          ? 'bg-white text-indigo-700 shadow-xs'
                          : 'bg-white text-slate-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                Status
              </span>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100">
                {(['Pending', 'Completed'] as AssignmentStatus[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setStatus(item)}
                    className={`min-h-[34px] rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      status === item
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {!initialAssignment && (
              <div>
                <label htmlFor="asg-reminder" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Reminder Alert
                </label>
                <select
                  id="asg-reminder"
                  value={reminderOffset}
                  onChange={(e) => setReminderOffset(e.target.value)}
                  className="w-full min-h-[42px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="none">No reminder</option>
                  {REMINDER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="asg-description" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Description <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              id="asg-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add submission guidelines, chapter numbers, or notes..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 min-h-[40px] rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 min-h-[40px] rounded-lg bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 transition-colors whitespace-nowrap"
            >
              {initialAssignment ? 'Save Changes' : 'Create Assignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
