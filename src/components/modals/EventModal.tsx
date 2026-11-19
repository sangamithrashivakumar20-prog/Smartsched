import { FormEvent, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  DAYS_OF_WEEK,
  DayOfWeek,
  EVENT_TYPES,
  EventType,
  TimetableEvent,
} from '../../types/scheduler';
import { getTodayDayOfWeek, timeToMinutes } from '../../utils/dateUtils';

interface EventModalProps {
  open: boolean;
  initialEvent: TimetableEvent | null;
  defaultDay?: DayOfWeek;
  onClose: () => void;
  onSave: (data: Omit<TimetableEvent, 'id'>, existingId?: string) => void;
}

export function EventModal({
  open,
  initialEvent,
  defaultDay,
  onClose,
  onSave,
}: EventModalProps) {
  const [subject, setSubject] = useState('');
  const [day, setDay] = useState<DayOfWeek>('Monday');
  const [type, setType] = useState<EventType>('Class');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [venue, setVenue] = useState('');
  const [faculty, setFaculty] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initialEvent) {
      setSubject(initialEvent.subject);
      setDay(initialEvent.day);
      setType(initialEvent.type);
      setStartTime(initialEvent.startTime);
      setEndTime(initialEvent.endTime);
      setVenue(initialEvent.venue);
      setFaculty(initialEvent.faculty ?? '');
    } else {
      setSubject('');
      setDay(defaultDay ?? getTodayDayOfWeek() ?? 'Monday');
      setType('Class');
      setStartTime('09:00');
      setEndTime('10:30');
      setVenue('');
      setFaculty('');
    }
  }, [open, initialEvent, defaultDay]);

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
    const trimmedSubject = subject.trim();
    const trimmedVenue = venue.trim();
    const trimmedFaculty = faculty.trim();

    if (!trimmedSubject) {
      setError('Please enter a subject name.');
      return;
    }
    if (!startTime || !endTime) {
      setError('Please select both start and end times.');
      return;
    }
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      setError('End time must be later than start time.');
      return;
    }
    if (!trimmedVenue) {
      setError('Please enter a room or venue.');
      return;
    }

    onSave(
      {
        subject: trimmedSubject,
        day,
        type,
        startTime,
        endTime,
        venue: trimmedVenue,
        ...(trimmedFaculty ? { faculty: trimmedFaculty } : {}),
      },
      initialEvent?.id
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-modal-title"
    >
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 id="event-modal-title" className="font-display text-lg font-semibold text-slate-900">
              {initialEvent ? 'Edit Timetable Event' : 'Add Timetable Event'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Schedule a recurring weekly class, lab, or tutorial session.
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
            <label htmlFor="event-subject" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Subject
            </label>
            <input
              id="event-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., C Programming"
              className="w-full min-h-[42px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="event-day" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Day of Week
              </label>
              <select
                id="event-day"
                value={day}
                onChange={(e) => setDay(e.target.value as DayOfWeek)}
                className="w-full min-h-[42px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {DAYS_OF_WEEK.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                Event Type
              </span>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100">
                {EVENT_TYPES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setType(item)}
                    className={`min-h-[34px] rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      type === item
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="event-start" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Start Time
              </label>
              <input
                id="event-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full min-h-[42px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 font-mono text-sm tabular-nums text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label htmlFor="event-end" className="block text-xs font-semibold text-slate-700 mb-1.5">
                End Time
              </label>
              <input
                id="event-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full min-h-[42px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 font-mono text-sm tabular-nums text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="event-venue" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Venue / Room
              </label>
              <input
                id="event-venue"
                type="text"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="e.g., C301 or LAB 1"
                className="w-full min-h-[42px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label htmlFor="event-faculty" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Faculty <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id="event-faculty"
                type="text"
                value={faculty}
                onChange={(e) => setFaculty(e.target.value)}
                placeholder="Instructor name"
                className="w-full min-h-[42px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
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
              {initialEvent ? 'Save Changes' : 'Add to Timetable'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
