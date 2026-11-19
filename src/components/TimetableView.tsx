import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CalendarPlus,
  Clock,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  User,
} from 'lucide-react';
import {
  DAYS_OF_WEEK,
  DayOfWeek,
  EVENT_TYPES,
  EventType,
  TimetableEvent,
} from '../types/scheduler';
import {
  formatTimeDisplay,
  formatTimeRange,
  getClassLiveStatus,
  getEventDurationHours,
  getTodayDayOfWeek,
  timeToMinutes,
} from '../utils/dateUtils';

interface TimetableViewProps {
  events: TimetableEvent[];
  now: Date;
  initialDayFilter?: DayOfWeek;
  onAddEvent: (day?: DayOfWeek) => void;
  onEditEvent: (event: TimetableEvent) => void;
  onDeleteEvent: (event: TimetableEvent) => void;
}

const EVENT_TYPE_STYLES: Record<
  EventType,
  { surface: string; typeText: string; hoverBorder: string }
> = {
  Class: {
    surface: 'bg-blue-50/85 border-blue-200',
    typeText: 'text-blue-700',
    hoverBorder: 'hover:border-blue-300',
  },
  Lab: {
    surface: 'bg-violet-50/85 border-violet-200',
    typeText: 'text-violet-700',
    hoverBorder: 'hover:border-violet-300',
  },
  Tutorial: {
    surface: 'bg-indigo-50/85 border-indigo-200',
    typeText: 'text-indigo-700',
    hoverBorder: 'hover:border-indigo-300',
  },
};

interface PositionedEvent {
  event: TimetableEvent;
  colIndex: number;
  totalCols: number;
}

function layoutDayEvents(dayEvents: TimetableEvent[]): PositionedEvent[] {
  const sorted = [...dayEvents].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );
  const result: PositionedEvent[] = [];

  // Group overlapping clusters
  let cluster: TimetableEvent[] = [];
  let clusterMaxEnd = -1;

  const flushCluster = (items: TimetableEvent[]) => {
    if (items.length === 0) return;
    const colEnds: number[] = [];
    const assigned: { event: TimetableEvent; col: number }[] = [];

    for (const ev of items) {
      const start = timeToMinutes(ev.startTime);
      const end = timeToMinutes(ev.endTime);
      let col = colEnds.findIndex((cEnd) => cEnd <= start);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(end);
      } else {
        colEnds[col] = end;
      }
      assigned.push({ event: ev, col });
    }

    const totalCols = Math.max(1, colEnds.length);
    for (const item of assigned) {
      result.push({ event: item.event, colIndex: item.col, totalCols });
    }
  };

  for (const ev of sorted) {
    const start = timeToMinutes(ev.startTime);
    const end = timeToMinutes(ev.endTime);
    if (cluster.length === 0 || start < clusterMaxEnd) {
      cluster.push(ev);
      clusterMaxEnd = Math.max(clusterMaxEnd, end);
    } else {
      flushCluster(cluster);
      cluster = [ev];
      clusterMaxEnd = end;
    }
  }
  flushCluster(cluster);
  return result;
}

export function TimetableView({
  events,
  now,
  initialDayFilter,
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
}: TimetableViewProps) {
  const todayDay = getTodayDayOfWeek(now);
  const [typeFilter, setTypeFilter] = useState<'All' | EventType>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [mobileSelectedDay, setMobileSelectedDay] = useState<DayOfWeek>(
    initialDayFilter ?? todayDay ?? 'Monday'
  );

  useEffect(() => {
    if (initialDayFilter) {
      setMobileSelectedDay(initialDayFilter);
    }
  }, [initialDayFilter]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => (typeFilter === 'All' ? true : e.type === typeFilter));
  }, [events, typeFilter]);

  // Determine dynamic hourly range for weekly grid (defaults to 08:00 - 18:00)
  const { startHour, endHour } = useMemo(() => {
    if (filteredEvents.length === 0) {
      return { startHour: 8, endHour: 18 };
    }
    let minHour = 8;
    let maxHour = 18;
    for (const ev of filteredEvents) {
      const sH = Math.floor(timeToMinutes(ev.startTime) / 60);
      const eH = Math.ceil(timeToMinutes(ev.endTime) / 60);
      if (sH < minHour) minHour = sH;
      if (eH > maxHour) maxHour = eH;
    }
    return {
      startHour: Math.max(6, minHour),
      endHour: Math.min(22, Math.max(minHour + 6, maxHour)),
    };
  }, [filteredEvents]);

  const hours = useMemo(() => {
    const arr: number[] = [];
    for (let h = startHour; h <= endHour; h += 1) {
      arr.push(h);
    }
    return arr;
  }, [startHour, endHour]);

  const ROW_HEIGHT_PX = 92;
  const totalGridHeight = (endHour - startHour) * ROW_HEIGHT_PX;

  const eventsByDay = useMemo(() => {
    const map: Record<DayOfWeek, TimetableEvent[]> = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: [],
    };
    for (const ev of filteredEvents) {
      map[ev.day].push(ev);
    }
    for (const day of DAYS_OF_WEEK) {
      map[day].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    }
    return map;
  }, [filteredEvents]);

  const positionedByDay = useMemo(() => {
    const map: Record<DayOfWeek, PositionedEvent[]> = {
      Monday: layoutDayEvents(eventsByDay.Monday),
      Tuesday: layoutDayEvents(eventsByDay.Tuesday),
      Wednesday: layoutDayEvents(eventsByDay.Wednesday),
      Thursday: layoutDayEvents(eventsByDay.Thursday),
      Friday: layoutDayEvents(eventsByDay.Friday),
      Saturday: layoutDayEvents(eventsByDay.Saturday),
    };
    return map;
  }, [eventsByDay]);

  const totalHoursScheduled = useMemo(
    () =>
      filteredEvents.reduce(
        (sum, ev) => sum + getEventDurationHours(ev.startTime, ev.endTime),
        0
      ),
    [filteredEvents]
  );

  const renderEventActions = (ev: TimetableEvent) => (
    <div className="flex items-center gap-1 shrink-0">
      <button
        type="button"
        onClick={() => onEditEvent(ev)}
        aria-label={`Edit ${ev.subject}`}
        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-indigo-700 transition-colors"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onDeleteEvent(ev)}
        aria-label={`Delete ${ev.subject}`}
        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-red-600 transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900">
              Weekly Timetable
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
              Monday to Saturday ·{' '}
              <span className="font-mono tabular-nums text-slate-700">
                {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'}
              </span>{' '}
              ({totalHoursScheduled.toFixed(1)} hrs/week)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Event Type Filter */}
            <div
              role="group"
              aria-label="Filter by event type"
              className="flex items-center gap-1 p-1 rounded-lg bg-slate-100"
            >
              {(['All', ...EVENT_TYPES] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`px-3 py-1.5 min-h-[34px] rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    typeFilter === t
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Desktop Grid vs List Toggle */}
            <div
              role="group"
              aria-label="Timetable view mode"
              className="hidden lg:flex items-center gap-1 p-1 rounded-lg bg-slate-100"
            >
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 min-h-[34px] rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  viewMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Weekly Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 min-h-[34px] rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  viewMode === 'list'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Agenda List
              </button>
            </div>

            <button
              type="button"
              onClick={() => onAddEvent(mobileSelectedDay)}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg bg-indigo-600 text-xs sm:text-sm font-medium text-white hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0"
            >
              <CalendarPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Add Event</span>
            </button>
          </div>
        </div>
      </section>

      {/* Empty state if completely empty */}
      {filteredEvents.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <CalendarDays className="mx-auto h-9 w-9 text-slate-300" aria-hidden="true" />
          <h2 className="mt-3 font-display text-base font-semibold text-slate-900">
            {typeFilter === 'All'
              ? 'No timetable events scheduled yet'
              : `No ${typeFilter} sessions scheduled`}
          </h2>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            {typeFilter === 'All'
              ? 'Add your weekly classes, labs, and tutorials from Monday to Saturday.'
              : `Try switching the filter to All or add a new ${typeFilter} session.`}
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            {typeFilter !== 'All' && (
              <button
                type="button"
                onClick={() => setTypeFilter('All')}
                className="px-4 py-2 min-h-[40px] rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Show All Types
              </button>
            )}
            <button
              type="button"
              onClick={() => onAddEvent(mobileSelectedDay)}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Add Event</span>
            </button>
          </div>
        </section>
      ) : (
        <>
          {/* Desktop Weekly Time-Slot Grid (lg+ when viewMode === 'grid') */}
          {viewMode === 'grid' && (
            <section className="hidden lg:block rounded-xl border border-slate-200 bg-white overflow-hidden">
              {/* Day Column Headers */}
              <div className="grid grid-cols-[76px_repeat(6,minmax(0,1fr))] border-b border-slate-200 bg-slate-50/70">
                <div className="px-3 py-3 text-xs font-medium text-slate-400 border-r border-slate-200">
                  Time
                </div>
                {DAYS_OF_WEEK.map((day) => {
                  const isToday = todayDay === day;
                  const count = eventsByDay[day].length;
                  return (
                    <div
                      key={day}
                      className={`px-3 py-3 border-r last:border-r-0 border-slate-200 flex items-center justify-between gap-2 ${
                        isToday ? 'bg-blue-50/80' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <span
                          className={`text-xs font-semibold block truncate ${
                            isToday ? 'text-blue-700' : 'text-slate-800'
                          }`}
                        >
                          {day}
                        </span>
                        <span className="font-mono text-[11px] tabular-nums text-slate-400">
                          {count} {count === 1 ? 'slot' : 'slots'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onAddEvent(day)}
                        title={`Add event on ${day}`}
                        aria-label={`Add event on ${day}`}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-white hover:text-indigo-600 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Time Grid Body */}
              <div className="grid grid-cols-[76px_repeat(6,minmax(0,1fr))] relative">
                {/* Left Time Axis */}
                <div
                  className="border-r border-slate-200 bg-white select-none"
                  style={{ height: `${totalGridHeight}px` }}
                >
                  {hours.slice(0, -1).map((hour) => (
                    <div
                      key={hour}
                      style={{ height: `${ROW_HEIGHT_PX}px` }}
                      className="border-b border-slate-100 px-2.5 pt-1.5 text-right font-mono text-[11px] tabular-nums text-slate-400"
                    >
                      {formatTimeDisplay(`${String(hour).padStart(2, '0')}:00`)}
                    </div>
                  ))}
                </div>

                {/* 6 Day Columns */}
                {DAYS_OF_WEEK.map((day) => {
                  const positionedEvents = positionedByDay[day];
                  const isToday = todayDay === day;

                  return (
                    <div
                      key={day}
                      style={{ height: `${totalGridHeight}px` }}
                      className={`relative border-r last:border-r-0 border-slate-200 ${
                        isToday ? 'bg-blue-50/20' : 'bg-white'
                      }`}
                    >
                      {/* Hourly background grid lines */}
                      {hours.slice(0, -1).map((hour) => (
                        <div
                          key={hour}
                          style={{ height: `${ROW_HEIGHT_PX}px` }}
                          className="border-b border-slate-100"
                        />
                      ))}

                      {/* Positioned Timetable Events */}
                      {positionedEvents.map(({ event: ev, colIndex, totalCols }) => {
                        const startMins = timeToMinutes(ev.startTime) - startHour * 60;
                        const durationMins = Math.max(
                          45,
                          timeToMinutes(ev.endTime) - timeToMinutes(ev.startTime)
                        );
                        const topPx = (startMins / 60) * ROW_HEIGHT_PX + 2;
                        const heightPx = Math.max(58, (durationMins / 60) * ROW_HEIGHT_PX - 4);
                        const style = EVENT_TYPE_STYLES[ev.type];
                        const widthPct = 100 / totalCols;
                        const leftPct = colIndex * widthPct;
                        const isLive = getClassLiveStatus(ev.day, ev.startTime, ev.endTime, now) === 'live';

                        return (
                          <article
                            key={ev.id}
                            style={{
                              top: `${topPx}px`,
                              height: `${heightPx}px`,
                              left: `calc(${leftPct}% + 4px)`,
                              width: `calc(${widthPct}% - 8px)`,
                            }}
                            className={`group absolute rounded-lg border px-2.5 py-2 flex flex-col justify-between overflow-hidden transition-colors ${style.surface} ${style.hoverBorder} ${
                              isLive ? 'ring-2 ring-blue-500/70 border-blue-400' : ''
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span
                                  className={`text-[11px] font-semibold truncate ${style.typeText}`}
                                >
                                  {ev.type}
                                  {isLive && (
                                    <span className="ml-1.5 text-blue-700 font-bold">· Live</span>
                                  )}
                                </span>
                                <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                  {renderEventActions(ev)}
                                </div>
                              </div>
                              <h3
                                className={`text-xs font-semibold text-slate-900 leading-tight ${
                                  durationMins <= 60 ? 'truncate' : 'line-clamp-2'
                                }`}
                              >
                                {ev.subject}
                              </h3>
                            </div>

                            <div className="mt-0.5 space-y-0.5 text-[11px] text-slate-600">
                              <p className="font-mono tabular-nums truncate">
                                {formatTimeRange(ev.startTime, ev.endTime)}
                              </p>
                              <p className="flex items-center gap-1 truncate text-slate-500">
                                <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                                <span className="truncate">
                                  {ev.venue}
                                  {ev.faculty ? ` · ${ev.faculty}` : ''}
                                </span>
                              </p>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Desktop Agenda List View (when viewMode === 'list') */}
          {viewMode === 'list' && (
            <section className="hidden lg:grid lg:grid-cols-2 gap-4">
              {DAYS_OF_WEEK.map((day) => {
                const dayEvents = eventsByDay[day];
                const isToday = todayDay === day;
                return (
                  <div
                    key={day}
                    className="rounded-xl border border-slate-200 bg-white overflow-hidden"
                  >
                    <div
                      className={`px-5 py-3.5 border-b border-slate-100 flex items-center justify-between ${
                        isToday ? 'bg-blue-50/70' : 'bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <h2
                          className={`font-display text-sm font-semibold ${
                            isToday ? 'text-blue-700' : 'text-slate-900'
                          }`}
                        >
                          {day}
                        </h2>
                        {isToday && (
                          <span className="text-xs font-medium text-blue-600">· Today</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onAddEvent(day)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Add</span>
                      </button>
                    </div>

                    {dayEvents.length === 0 ? (
                      <p className="px-5 py-6 text-xs text-slate-400">
                        No {typeFilter === 'All' ? 'events' : `${typeFilter} sessions`} on {day}.
                      </p>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {dayEvents.map((ev) => {
                          const style = EVENT_TYPE_STYLES[ev.type];
                          const isLive =
                            getClassLiveStatus(ev.day, ev.startTime, ev.endTime, now) === 'live';
                          return (
                            <li
                              key={ev.id}
                              className={`px-5 py-3.5 flex items-center justify-between gap-3 transition-colors ${
                                isLive ? 'bg-blue-50/75' : 'hover:bg-slate-50/60'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 text-xs">
                                  <span className={`font-semibold ${style.typeText}`}>
                                    {ev.type}
                                  </span>
                                  <span className="text-slate-300" aria-hidden="true">
                                    ·
                                  </span>
                                  <span className="font-mono tabular-nums text-slate-600">
                                    {formatTimeRange(ev.startTime, ev.endTime)}
                                  </span>
                                  {isLive && (
                                    <>
                                      <span className="text-slate-300" aria-hidden="true">
                                        ·
                                      </span>
                                      <span className="font-semibold text-blue-700">
                                        Ongoing now
                                      </span>
                                    </>
                                  )}
                                </div>
                                <p className="mt-1 text-sm font-semibold text-slate-900 truncate">
                                  {ev.subject}
                                </p>
                                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                                  <span className="inline-flex items-center gap-1.5">
                                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                                    <span className="truncate">{ev.venue}</span>
                                  </span>
                                  {ev.faculty && (
                                    <span className="inline-flex items-center gap-1.5">
                                      <User className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                                      <span className="truncate">{ev.faculty}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                              {renderEventActions(ev)}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </section>
          )}

          {/* Mobile & Tablet Day-Tab View (< lg) */}
          <section className="lg:hidden space-y-4">
            <div
              role="tablist"
              aria-label="Select day of week"
              className="grid grid-cols-6 gap-1 p-1 rounded-xl border border-slate-200 bg-white"
            >
              {DAYS_OF_WEEK.map((day) => {
                const active = mobileSelectedDay === day;
                const count = eventsByDay[day].length;
                return (
                  <button
                    key={day}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setMobileSelectedDay(day)}
                    className={`py-2 px-1 rounded-lg text-center transition-colors ${
                      active
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className="block text-xs font-semibold">{day.slice(0, 3)}</span>
                    <span
                      className={`block font-mono text-[10px] tabular-nums mt-0.5 ${
                        active ? 'text-indigo-100' : 'text-slate-400'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold text-slate-900">
                  {mobileSelectedDay}
                  {todayDay === mobileSelectedDay && (
                    <span className="ml-2 text-xs font-medium text-blue-600">· Today</span>
                  )}
                </h2>
                <button
                  type="button"
                  onClick={() => onAddEvent(mobileSelectedDay)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Add to {mobileSelectedDay.slice(0, 3)}</span>
                </button>
              </div>

              {eventsByDay[mobileSelectedDay].length === 0 ? (
                <div className="p-8 text-center">
                  <Clock className="mx-auto h-7 w-7 text-slate-300" aria-hidden="true" />
                  <p className="mt-2.5 text-sm font-medium text-slate-800">
                    No sessions on {mobileSelectedDay}
                  </p>
                  <button
                    type="button"
                    onClick={() => onAddEvent(mobileSelectedDay)}
                    className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Plus className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />
                    <span>Add Event</span>
                  </button>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {eventsByDay[mobileSelectedDay].map((ev) => {
                    const style = EVENT_TYPE_STYLES[ev.type];
                    const isLive =
                      getClassLiveStatus(ev.day, ev.startTime, ev.endTime, now) === 'live';
                    return (
                      <li
                        key={ev.id}
                        className={`p-4 flex items-start justify-between gap-3 ${
                          isLive ? 'bg-blue-50/75' : ''
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className={`font-semibold ${style.typeText}`}>
                              {ev.type}
                            </span>
                            <span className="text-slate-300" aria-hidden="true">
                              ·
                            </span>
                            <span className="font-mono tabular-nums text-slate-600">
                              {formatTimeRange(ev.startTime, ev.endTime)}
                            </span>
                            {isLive && (
                              <>
                                <span className="text-slate-300" aria-hidden="true">
                                  ·
                                </span>
                                <span className="font-semibold text-blue-700">Ongoing now</span>
                              </>
                            )}
                          </div>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {ev.subject}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                              <span>{ev.venue}</span>
                            </span>
                            {ev.faculty && (
                              <span className="inline-flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                                <span>{ev.faculty}</span>
                              </span>
                            )}
                          </div>
                        </div>
                        {renderEventActions(ev)}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
