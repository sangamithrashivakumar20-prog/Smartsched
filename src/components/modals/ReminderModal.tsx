import { FormEvent, useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import {
  Assignment,
  REMINDER_OPTIONS,
  Reminder,
  ReminderOffsetMinutes,
} from '../../types/scheduler';
import {
  formatDateTimeReadable,
  formatShortDate,
  formatTimeDisplay,
  getReminderTriggerDate,
} from '../../utils/dateUtils';

interface ReminderModalProps {
  open: boolean;
  initialReminder: Reminder | null;
  defaultAssignmentId?: string;
  assignments: Assignment[];
  onClose: () => void;
  onSave: (
    assignmentId: string,
    offsetMinutes: ReminderOffsetMinutes,
    existingId?: string
  ) => void;
}

export function ReminderModal({
  open,
  initialReminder,
  defaultAssignmentId,
  assignments,
  onClose,
  onSave,
}: ReminderModalProps) {
  const [assignmentId, setAssignmentId] = useState('');
  const [offsetMinutes, setOffsetMinutes] = useState<ReminderOffsetMinutes>(60);
  const [error, setError] = useState<string | null>(null);

  const pendingAssignments = assignments.filter((a) => a.status === 'Pending');
  const selectableAssignments = initialReminder ? assignments : pendingAssignments;

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initialReminder) {
      setAssignmentId(initialReminder.assignmentId);
      setOffsetMinutes(initialReminder.offsetMinutes);
    } else {
      setAssignmentId(defaultAssignmentId ?? selectableAssignments[0]?.id ?? '');
      setOffsetMinutes(60);
    }
  }, [open, initialReminder, defaultAssignmentId]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const selectedAssignment = assignments.find((a) => a.id === assignmentId);
  const previewTriggerDate = selectedAssignment
    ? getReminderTriggerDate(selectedAssignment, offsetMinutes)
    : null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!assignmentId) {
      setError('Please select an assignment for this reminder.');
      return;
    }
    onSave(assignmentId, offsetMinutes, initialReminder?.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reminder-modal-title"
    >
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2
              id="reminder-modal-title"
              className="font-display text-lg font-semibold text-slate-900"
            >
              {initialReminder ? 'Edit Reminder' : 'Add Reminder'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Choose when SmartSched should alert you before the deadline.
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
            <label htmlFor="rem-assignment" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Assignment
            </label>
            {selectableAssignments.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
                No pending assignments available. Create or reopen an assignment to schedule a reminder.
              </p>
            ) : (
              <select
                id="rem-assignment"
                value={assignmentId}
                disabled={Boolean(initialReminder)}
                onChange={(e) => setAssignmentId(e.target.value)}
                className="w-full min-h-[42px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {selectableAssignments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} ({a.subject})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700 mb-1.5">
              Notify Me
            </span>
            <div className="grid grid-cols-2 gap-2">
              {REMINDER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setOffsetMinutes(opt.value)}
                  className={`min-h-[42px] rounded-lg border px-3 py-2 text-xs font-medium transition-colors text-left ${
                    offsetMinutes === opt.value
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {selectedAssignment && previewTriggerDate && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3.5 text-xs text-slate-700 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-blue-900">
                <Bell className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                <span>Scheduled Alert Preview</span>
              </div>
              <p className="text-slate-600">
                Due:{' '}
                <span className="font-mono tabular-nums text-slate-800">
                  {formatShortDate(selectedAssignment.dueDate)} ·{' '}
                  {formatTimeDisplay(selectedAssignment.dueTime)}
                </span>
              </p>
              <p className="text-slate-600">
                Alert triggers:{' '}
                <span className="font-mono tabular-nums font-medium text-indigo-700">
                  {formatDateTimeReadable(previewTriggerDate)}
                </span>
              </p>
            </div>
          )}

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
              disabled={selectableAssignments.length === 0}
              className="px-4 py-2 min-h-[40px] rounded-lg bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {initialReminder ? 'Save Reminder' : 'Set Reminder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
