import React, { useEffect, useMemo, useState } from 'react';
import FullCalendar, {
  DateSelectInfo,
  EventClickInfo,
  EventInput,
} from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import interactionPlugin from '@fullcalendar/react/interaction';
import listPlugin from '@fullcalendar/react/list';
import breezyThemePlugin from '@fullcalendar/react/themes/breezy';
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/breezy/theme.css';
import '@fullcalendar/react/themes/breezy/palettes/amber.css';
import {
  CalendarEventCategory,
  CalendarEventRecord,
  MasterTransaction,
  Outlet,
  OutletSlug,
  User,
} from '../../types';
import { store } from '../../db/store';
import { TransactionDetailsModal } from './TransactionDetailsModal';
import { Calendar as CalendarIcon, ChevronDown, Plus, Trash2, X } from 'lucide-react';

interface CentralizedCalendarProps {
  currentUser: User;
  currentOutlet?: Outlet | null;
  title?: string;
}

const OUTLET_EVENT_PALETTE: Record<string, { bg: string; border: string; text: string }> = {
  pickleball: { bg: '#FEF3C7', border: '#D97706', text: '#78350F' },
  hostel: { bg: '#DBEAFE', border: '#2563EB', text: '#1E3A8A' },
  gym: { bg: '#DCFCE7', border: '#16A34A', text: '#14532D' },
  pool: { bg: '#E0F2FE', border: '#0284C7', text: '#0C4A6E' },
  ktv: { bg: '#FCE7F3', border: '#DB2777', text: '#831843' },
  fnb: { bg: '#FFEDD5', border: '#EA580C', text: '#7C2D12' },
  billiards: { bg: '#F3E8FF', border: '#9333EA', text: '#581C87' },
  tabletennis: { bg: '#CCFBF1', border: '#0D9488', text: '#134E4A' },
  parking: { bg: '#F3F4F6', border: '#4B5563', text: '#1F2937' },
  events: { bg: '#FFE4E6', border: '#E11D48', text: '#881337' },
  custom: { bg: '#FEF9C3', border: '#CA8A04', text: '#713F12' },
};

function getOutletPalette(slug: string) {
  return OUTLET_EVENT_PALETTE[slug] || OUTLET_EVENT_PALETTE.custom;
}

function getShortOutletTag(outletName: string, slug: string): string {
  if (slug === 'fnb') return 'F&B';
  if (slug === 'tabletennis') return 'Table Tennis';
  if (slug === 'events') return 'Events';
  return outletName.split(' ')[0] || slug;
}

function toLocalDateInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const CentralizedCalendar: React.FC<CentralizedCalendarProps> = ({
  currentUser,
  currentOutlet = null,
  title = 'Centralized outlet calendar',
}) => {
  // Always defaults to 'all' ("General") per Revision 003 confirmed specification
  const [outletFilter, setOutletFilter] = useState<'all' | OutletSlug>('all');
  const [transactions, setTransactions] = useState<MasterTransaction[]>(() => store.getTransactions());
  const [customEvents, setCustomEvents] = useState<CalendarEventRecord[]>(() =>
    store.getCalendarEvents()
  );
  const [outlets, setOutlets] = useState<Outlet[]>(() => store.getOutlets());

  // Inspection modals
  const [selectedTx, setSelectedTx] = useState<MasterTransaction | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<CalendarEventRecord | null>(null);

  // Add custom schedule modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newOutletSlug, setNewOutletSlug] = useState<OutletSlug>(
    currentOutlet?.slug || 'pickleball'
  );
  const [newTitle, setNewTitle] = useState('');
  const [newCustomer, setNewCustomer] = useState('');
  const [newCategory, setNewCategory] = useState<CalendarEventCategory>('Booking');
  const [newDate, setNewDate] = useState(() => toLocalDateInput(new Date()));
  const [newEndDate, setNewEndDate] = useState('');
  const [newStartTime, setNewStartTime] = useState('14:00');
  const [newEndTime, setNewEndTime] = useState('16:00');
  const [newAllDay, setNewAllDay] = useState(false);
  const [newNotes, setNewNotes] = useState('');

  useEffect(() => {
    const refresh = () => {
      setTransactions(store.getTransactions());
      setCustomEvents(store.getCalendarEvents());
      setOutlets(store.getOutlets());
    };
    refresh();
    const unsub = store.subscribe(refresh);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (currentOutlet?.slug) {
      setNewOutletSlug(currentOutlet.slug);
    }
  }, [currentOutlet?.slug]);

  const calendarEvents: EventInput[] = useMemo(() => {
    const items: EventInput[] = [];

    // 1. Sync non-void outlet transactions
    for (const tx of transactions) {
      if (tx.transactionStatus === 'void') continue;
      if (outletFilter !== 'all' && tx.outletSlug !== outletFilter) continue;

      const palette = getOutletPalette(tx.outletSlug);
      const child = store.getOutletChildData(tx.outletRefTable, tx.outletRefId);
      const tag = getShortOutletTag(tx.outletName, tx.outletSlug);
      const isOngoingTimer =
        Boolean(tx.timerEndsAt) &&
        !tx.timerStoppedAt &&
        new Date(tx.timerEndsAt!).getTime() > Date.now();
      const statusBadge = isOngoingTimer
        ? 'Live'
        : tx.transactionStatus === 'pending'
        ? 'Pending'
        : 'Paid';

      let start = tx.transactionDateTime;
      let end: string | undefined;
      let allDay = false;

      if (tx.outletSlug === 'hostel' && child?.checkIn) {
        start = child.checkIn;
        end = child.checkOut || undefined;
        allDay = true;
      } else if (tx.outletSlug === 'events' && child?.eventDate) {
        start = child.eventDate;
        allDay = true;
      } else if (tx.outletSlug === 'gym' && child?.membershipStart) {
        start = child.membershipStart;
        allDay = true;
      } else if (tx.timerStartedAt && tx.timerEndsAt) {
        start = tx.timerStartedAt;
        end = tx.timerEndsAt;
        allDay = false;
      }

      items.push({
        id: `tx:${tx.transactionID}`,
        title: `[${tag}] ${tx.customerName} · ${statusBadge}`,
        start,
        end,
        allDay,
        backgroundColor: palette.bg,
        borderColor: palette.border,
        textColor: palette.text,
        extendedProps: {
          kind: 'transaction',
          transaction: tx,
        },
      });
    }

    // 2. Sync custom scheduled calendar bookings
    for (const ev of customEvents) {
      if (ev.status === 'cancelled') continue;
      if (outletFilter !== 'all' && ev.outletSlug !== outletFilter) continue;

      const palette = getOutletPalette(ev.outletSlug);
      const tag = getShortOutletTag(ev.outletName, ev.outletSlug);

      items.push({
        id: `cal:${ev.calendarID}`,
        title: `[${tag}] ${ev.title} (${ev.customerName})`,
        start: ev.start,
        end: ev.end || undefined,
        allDay: ev.allDay,
        backgroundColor: palette.bg,
        borderColor: palette.border,
        textColor: palette.text,
        extendedProps: {
          kind: 'booking',
          booking: ev,
        },
      });
    }

    return items;
  }, [transactions, customEvents, outletFilter]);

  const handleDateSelect = (selectInfo: DateSelectInfo) => {
    const startDatePart = selectInfo.startStr.slice(0, 10);
    setNewDate(startDatePart);
    setNewEndDate(selectInfo.allDay && selectInfo.endStr ? selectInfo.endStr.slice(0, 10) : '');
    setNewAllDay(selectInfo.allDay);
    if (!selectInfo.allDay && selectInfo.startStr.includes('T')) {
      setNewStartTime(selectInfo.startStr.slice(11, 16));
      setNewEndTime(
        selectInfo.endStr?.includes('T') ? selectInfo.endStr.slice(11, 16) : '16:00'
      );
    }
    setNewTitle('');
    setNewCustomer('');
    setNewNotes('');
    setShowAddModal(true);
    selectInfo.view.calendar.unselect();
  };

  const handleEventClick = (clickInfo: EventClickInfo) => {
    const props = clickInfo.event.extendedProps as {
      kind?: 'transaction' | 'booking';
      transaction?: MasterTransaction;
      booking?: CalendarEventRecord;
    };
    if (props?.kind === 'transaction' && props.transaction) {
      setSelectedTx(props.transaction);
    } else if (props?.kind === 'booking' && props.booking) {
      setSelectedBooking(props.booking);
    }
  };

  const handleCreateSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newCustomer.trim() || !newDate) return;

    const targetOutlet =
      outlets.find((o) => o.slug === newOutletSlug) || outlets[0];

    const startIso = newAllDay ? newDate : `${newDate}T${newStartTime}:00`;
    const endIso = newAllDay
      ? newEndDate || null
      : `${newDate}T${newEndTime || newStartTime}:00`;

    store.addCalendarEvent({
      outletSlug: targetOutlet.slug,
      outletName: targetOutlet.name,
      title: newTitle,
      customerName: newCustomer,
      category: newCategory,
      start: startIso,
      end: endIso,
      allDay: newAllDay,
      notes: newNotes,
      createdBy: currentUser.name,
    });

    setShowAddModal(false);
    setNewTitle('');
    setNewCustomer('');
    setNewNotes('');
  };

  const activeFilterOutlet =
    outletFilter === 'all' ? null : outlets.find((o) => o.slug === outletFilter);

  return (
    <section className="bg-white rounded-2xl border border-gray-200/90 overflow-hidden">
      {/* Calendar Header & Outlet Filter Controls */}
      <div className="p-4 sm:px-6 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#FFE27A] flex items-center justify-center shrink-0 text-[#1A1A1A]">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-[#1A1A1A]">{title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Synced across all outlets ·{' '}
              {activeFilterOutlet ? `${activeFilterOutlet.name} only` : 'General (All outlets)'} ·{' '}
              <span className="tabular-nums font-semibold text-[#1A1A1A]">
                {calendarEvents.length}
              </span>{' '}
              activities
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* General Button */}
          <button
            type="button"
            onClick={() => setOutletFilter('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              outletFilter === 'all'
                ? 'bg-[#FFE27A] text-[#1A1A1A] border border-[#1A1A1A]/15'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            General
          </button>

          {/* Shortcut to isolate the active outlet when inside an Outlet Dashboard */}
          {currentOutlet && (
            <button
              type="button"
              onClick={() => setOutletFilter(currentOutlet.slug)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                outletFilter === currentOutlet.slug
                  ? 'bg-[#1A1A1A] text-white'
                  : 'bg-white border border-gray-300 text-[#1A1A1A] hover:bg-gray-50'
              }`}
            >
              {getShortOutletTag(currentOutlet.name, currentOutlet.slug)} only
            </button>
          )}

          {/* Full Outlet Filter Dropdown */}
          <div className="relative">
            <select
              value={outletFilter}
              onChange={(e) => setOutletFilter(e.target.value as 'all' | OutletSlug)}
              aria-label="Filter calendar by outlet"
              className="pl-3 pr-8 py-2 rounded-xl border border-gray-300 bg-white text-xs font-semibold text-[#1A1A1A] appearance-none cursor-pointer outline-none focus:border-[#1A1A1A]"
            >
              <option value="all">General (All Outlets)</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.slug}>
                  {o.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          <button
            type="button"
            onClick={() => {
              setNewDate(toLocalDateInput(new Date()));
              setNewEndDate('');
              setNewTitle('');
              setNewCustomer('');
              setNewNotes('');
              setShowAddModal(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-[#FF5252] hover:bg-[#ff3b3b] text-[#1A1A1A] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add schedule
          </button>
        </div>
      </div>

      {/* FullCalendar Container */}
      <div className="p-4 sm:p-6 cafelupe-fc overflow-x-auto">
        <div className="min-w-[600px]">
          <FullCalendar
            plugins={[
              dayGridPlugin,
              timeGridPlugin,
              interactionPlugin,
              listPlugin,
              breezyThemePlugin,
            ]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
            }}
            events={calendarEvents}
            selectable={true}
            selectMirror={true}
            dayMaxEvents={3}
            weekends={true}
            height={640}
            select={handleDateSelect}
            eventClick={handleEventClick}
          />
        </div>
      </div>

      {/* Transaction Details Modal (when clicking synced transaction event) */}
      {selectedTx && (
        <TransactionDetailsModal
          transaction={selectedTx}
          onClose={() => setSelectedTx(null)}
        />
      )}

      {/* Custom Booking Detail Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-gray-200 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-gray-100">
              <div>
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  {selectedBooking.outletName} · {selectedBooking.category}
                </div>
                <h3 className="text-base font-extrabold text-[#1A1A1A] mt-0.5">
                  {selectedBooking.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="text-gray-400 hover:text-[#1A1A1A] cursor-pointer"
                aria-label="Close booking details"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Customer / Group</span>
                <span className="font-bold text-[#1A1A1A]">{selectedBooking.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Schedule</span>
                <span className="font-mono font-semibold text-[#1A1A1A] tabular-nums">
                  {selectedBooking.allDay
                    ? selectedBooking.start.slice(0, 10)
                    : new Date(selectedBooking.start).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className="font-bold capitalize text-[#1A1A1A]">
                  {selectedBooking.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Logged by</span>
                <span className="font-medium text-gray-700">{selectedBooking.createdBy}</span>
              </div>
              {selectedBooking.notes && (
                <div className="p-3 rounded-xl bg-[#F7F7F7] border border-gray-200 text-gray-700 mt-2">
                  {selectedBooking.notes}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-gray-100 space-y-2">
              <div className="text-[11px] font-semibold text-gray-500">Update schedule status</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {(['scheduled', 'ongoing', 'completed'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => {
                      store.updateCalendarEventStatus(selectedBooking.calendarID, st);
                      setSelectedBooking({ ...selectedBooking, status: st });
                    }}
                    className={`py-2 rounded-xl font-bold capitalize cursor-pointer border ${
                      selectedBooking.status === st
                        ? 'bg-[#FFE27A] border-[#1A1A1A]/20 text-[#1A1A1A]'
                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  store.deleteCalendarEvent(selectedBooking.calendarID);
                  setSelectedBooking(null);
                }}
                className="px-3.5 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove
              </button>
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="px-4 py-2.5 rounded-xl bg-white border border-gray-300 text-[#1A1A1A] font-semibold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Calendar Schedule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-gray-200 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <div>
                <h3 className="text-base font-extrabold text-[#1A1A1A]">Add calendar schedule</h3>
                <p className="text-xs text-gray-500">
                  Syncs instantly across Front-Desk and all outlet dashboards
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-[#1A1A1A] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSchedule} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Outlet *</label>
                  <select
                    value={newOutletSlug}
                    onChange={(e) => setNewOutletSlug(e.target.value as OutletSlug)}
                    className="w-full p-2.5 rounded-xl border border-gray-300 bg-white"
                  >
                    {outlets.map((o) => (
                      <option key={o.id} value={o.slug}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Category *</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as CalendarEventCategory)}
                    className="w-full p-2.5 rounded-xl border border-gray-300 bg-white"
                  >
                    <option value="Booking">Booking</option>
                    <option value="Reservation">Reservation</option>
                    <option value="Tournament">Tournament</option>
                    <option value="Function">Function</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-600 mb-1">Activity / Title *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Indoor Court Private Match"
                  className="w-full p-2.5 rounded-xl border border-gray-300"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-600 mb-1">Customer / Group *</label>
                <input
                  type="text"
                  value={newCustomer}
                  onChange={(e) => setNewCustomer(e.target.value)}
                  placeholder="e.g. Marco Reyes"
                  className="w-full p-2.5 rounded-xl border border-gray-300"
                  required
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="inline-flex items-center gap-2 font-semibold text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAllDay}
                    onChange={(e) => setNewAllDay(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  All-day reservation
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Date *</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-gray-300"
                    required
                  />
                </div>
                {newAllDay ? (
                  <div>
                    <label className="block font-semibold text-gray-600 mb-1">End date</label>
                    <input
                      type="date"
                      value={newEndDate}
                      onChange={(e) => setNewEndDate(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-gray-300"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="block font-semibold text-gray-600 mb-1">Start</label>
                      <input
                        type="time"
                        value={newStartTime}
                        onChange={(e) => setNewStartTime(e.target.value)}
                        className="w-full p-2 rounded-xl border border-gray-300"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-600 mb-1">End</label>
                      <input
                        type="time"
                        value={newEndTime}
                        onChange={(e) => setNewEndTime(e.target.value)}
                        className="w-full p-2 rounded-xl border border-gray-300"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-gray-600 mb-1">Notes</label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional setup details or equipment notes"
                  className="w-full p-2.5 rounded-xl border border-gray-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="py-2.5 rounded-xl bg-white border border-gray-300 text-[#1A1A1A] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2.5 rounded-xl bg-[#FF5252] hover:bg-[#ff3b3b] text-[#1A1A1A] font-bold cursor-pointer"
                >
                  Save schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
