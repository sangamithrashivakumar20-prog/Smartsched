import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock, Sparkles, X } from 'lucide-react';
import {
  STUDY_DURATION_PRESETS,
  StudySession,
  StudySessionStatus,
  TimetableEvent,
} from '../../types/scheduler';
import { formatTimeDisplay, toLocalDateString } from '../../utils/dateUtils';
import {
  checkStudyTimeConflict,
  findFreeStudySlots,
  formatDurationLabel,
  getStudyEndTime,
} from '../../utils/studyScheduler';

interface StudySessionModalProps {
  open: boolean;
  initialSession: StudySession | null;
  defaultDate?: string;
  defaultStartTime?: string;
  subjectSuggestions: string[];
  timetableEvents: TimetableEvent[];
  studySessions: StudySession[];
  now: Date;
  onClose: () => void;
  onSave: (
    data: Omit<StudySession, 'id' | 'createdAt'>,
    existingId?: string
  ) => void;
}

const PRESET_VALUES = new Set<number>(STUDY_DURATION_PRESETS.map((p) => p.value));

export function StudySessionModal({
  open,
  initialSession,
  defaultDate,
  defaultStartTime,
  subjectSuggestions,
  timetableEvents,
  studySessions,
  now,
  onClose,
  onSave,
}: StudySessionModalProps) {
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('16:00');
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [customMinutesInput, setCustomMinutesInput] = useState('90');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<StudySessionStatus>('Pending');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initialSession) {
      setSubject(initialSession.subject);
      setTopic(initialSession.topic);
      setDate(initialSession.date);
      setStartTime(initialSession.startTime);
      setDurationMinutes(initialSession.durationMinutes);
      const custom = !PRESET_VALUES.has(initialSession.durationMinutes);
      setIsCustomDuration(custom);
      setCustomMinutesInput(String(initialSession.durationMinutes));
      setNotes(initialSession.notes);
      setStatus(initialSession.status);
    } else {
      const targetDate = defaultDate ?? toLocalDateString(now);
      const initialDur = 60;
      const freeSlots = findFreeStudySlots(
        targetDate,
        initialDur,
        timetableEvents,
        studySessions,
        undefined,
        now
      );
      setSubject('');
      setTopic('');
      setDate(targetDate);
      setDurationMinutes(initialDur);
      setIsCustomDuration(false);
      setCustomMinutesInput('90');
      setStartTime(defaultStartTime ?? freeSlots[0]?.startTime ?? '16:00');
      setNotes('');
      setStatus('Pending');
    }
  }, [open, initialSession, defaultDate, defaultStartTime]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const effectiveDuration = useMemo(() => {
    if (!isCustomDuration) return durationMinutes;
    const parsed = Number(customMinutesInput);
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
  }, [isCustomDuration, durationMinutes, customMinutesInput]);

  const freeSlots = useMemo(() => {
    if (!date || effectiveDuration < 5) return [];
    return findFreeStudySlots(
      date,
      effectiveDuration,
      timetableEvents,
      studySessions,
      initialSession?.id,
      now
    );
  }, [date, effectiveDuration, timetableEvents, studySessions, initialSession?.id, now]);

  const conflicts = useMemo(() => {
    if (!date || !startTime || effectiveDuration < 5) {
      return { classConflicts: [], sessionConflicts: [] };
    }
    return checkStudyTimeConflict(
      date,
      startTime,
      effectiveDuration,
      timetableEvents,
      studySessions,
      initialSession?.id
    );
  }, [date, startTime, effectiveDuration, timetableEvents, studySessions, initialSession?.id]);

  if (!open) return null;

  const handleAutoSuggest = () => {
    if (freeSlots.length > 0) {
      setStartTime(freeSlots[0].startTime);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedSubject = subject.trim();
    const trimmedTopic = topic.trim();

    if (!trimmedSubject) {
      setError('Please enter a subject.');
      return;
    }
    if (!trimmedTopic) {
      setError('Please enter a study topic.');
      return;
    }
    if (!date) {
      setError('Please choose a study date.');
      return;
    }
    if (!startTime) {
      setError('Please choose a start time.');
      return;
    }
    if (effectiveDuration < 5 || effectiveDuration > 480) {
      setError('Duration must be between 5 and 480 minutes.');
      return;
    }

    onSave(
      {
        subject: trimmedSubject,
        topic: trimmedTopic,
        date,
        startTime,
        durationMinutes: effectiveDuration,
        notes: notes.trim(),
        status,
      },
      initialSession?.id
    );
    onClose();
  };

  const hasConflict =
    conflicts.classConflicts.length > 0 || conflicts.sessionConflicts.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="study-modal-title"
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
              id="study-modal-title"
              className="font-display text-lg font-semibold text-slate-900"
            >
              {initialSession ? 'Edit Study Session' : 'Plan Study Session'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Schedule focused study time around your college classes.
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="study-subject"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Subject
              </label>
              <input
                id="study-subject"
                type="text"
                list="study-subject-suggestions"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g., C Programming"
                className="w-full min-h-[42px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <datalist id="study-subject-suggestions">
                {subjectSuggestions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            <div>
              <label
                htmlFor="study-date"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Study Date
              </label>
              <input
                id="study-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full min-h-[42px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 font-mono text-sm tabular-nums text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="study-topic"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Study Topic
            </label>
            <input
              id="study-topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Pointers & Array Practice"
              className="w-full min-h-[42px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* Duration Selector */}
          <div>
            <span className="block text-xs font-semibold text-slate-700 mb-1.5">
              Duration
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1 p-1 rounded-lg bg-slate-100">
              {STUDY_DURATION_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => {
                    setIsCustomDuration(false);
                    setDurationMinutes(preset.value);
                  }}
                  className={`min-h-[36px] rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    !isCustomDuration && durationMinutes === preset.value
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setIsCustomDuration(true)}
                className={`min-h-[36px] rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  isCustomDuration
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Custom
              </button>
            </div>

            {isCustomDuration && (
              <div className="mt-2.5 flex items-center gap-2">
                <label htmlFor="study-custom-duration" className="text-xs text-slate-600">
                  Minutes:
                </label>
                <input
                  id="study-custom-duration"
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  value={customMinutesInput}
                  onChange={(e) => setCustomMinutesInput(e.target.value)}
                  className="w-28 min-h-[38px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-sm tabular-nums text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <span className="text-xs text-slate-500">
                  {effectiveDuration >= 5 ? `(${formatDurationLabel(effectiveDuration)})` : ''}
                </span>
              </div>
            )}
          </div>

          {/* Start Time & Timetable-Aware Free Slot Suggestions */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="study-start-time"
                className="block text-xs font-semibold text-slate-700"
              >
                Start Time
              </label>
              <button
                type="button"
                onClick={handleAutoSuggest}
                disabled={freeSlots.length === 0}
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Suggest Free Slot</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <input
                id="study-start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-44 min-h-[42px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 font-mono text-sm tabular-nums text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              {startTime && effectiveDuration >= 5 && (
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  Ends at {formatTimeDisplay(getStudyEndTime(startTime, effectiveDuration))}
                </span>
              )}
            </div>

            {/* Free slot suggestions around college timetable */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                <Clock className="h-3.5 w-3.5 text-blue-600 shrink-0" aria-hidden="true" />
                <span>Free times around your timetable on {date || 'selected date'}</span>
              </div>

              {freeSlots.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No automatic {effectiveDuration}-minute daytime slots fit between 7:00 AM and 10:00 PM. You can adjust the duration or select any preferred time manually above.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {freeSlots.map((slot) => {
                    const selected = startTime === slot.startTime;
                    return (
                      <button
                        key={slot.startTime}
                        type="button"
                        onClick={() => setStartTime(slot.startTime)}
                        className={`px-2.5 py-1.5 min-h-[32px] rounded-md border text-xs font-mono tabular-nums transition-colors ${
                          selected
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-700'
                        }`}
                      >
                        {slot.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {hasConflict && (
              <div
                role="status"
                className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 flex items-start gap-2"
              >
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-0.5">
                  {conflicts.classConflicts.map((cls) => (
                    <p key={cls.id}>
                      Overlaps with college class: <strong>{cls.subject}</strong> (
                      {formatTimeDisplay(cls.startTime)} – {formatTimeDisplay(cls.endTime)},{' '}
                      {cls.venue}). Pick a free slot above or keep your manual time.
                    </p>
                  ))}
                  {conflicts.sessionConflicts.map((sess) => (
                    <p key={sess.id}>
                      Overlaps with planned study: <strong>{sess.subject}</strong> (
                      {formatTimeDisplay(sess.startTime)}).
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {initialSession && (
            <div>
              <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                Status
              </span>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100">
                {(['Pending', 'Completed'] as StudySessionStatus[]).map((item) => (
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
          )}

          <div>
            <label
              htmlFor="study-notes"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Notes <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              id="study-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Chapters to cover, practice problems, or goals..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
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
              {initialSession ? 'Save Changes' : 'Plan Study Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
