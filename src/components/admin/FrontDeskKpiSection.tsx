import React, { useMemo } from 'react';
import { MasterTransaction, Outlet } from '../../types';
import { store } from '../../db/store';
import { Bell, Clock, Square, Timer, TrendingUp } from 'lucide-react';

const MASK = '*****';

function maskText(formatted: string | number, hidden: boolean): string {
  return hidden ? MASK : String(formatted);
}

function formatPhp(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatRemainingCountdown(
  timerEndsAt: string | null | undefined,
  nowMs: number
): { label: string; isExpired: boolean } {
  if (!timerEndsAt) return { label: '—', isExpired: false };
  const diffMs = new Date(timerEndsAt).getTime() - nowMs;
  if (diffMs <= 0) return { label: '00:00:00', isExpired: true };
  const totalSec = Math.floor(diffMs / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return { label: `${pad(hrs)}:${pad(mins)}:${pad(secs)}`, isExpired: false };
}

interface FrontDeskTimerBoardProps {
  transactions: MasterTransaction[];
  nowMs: number;
  isPrivacyHidden: boolean;
  onExtendTimer: (tx: MasterTransaction) => void;
}

export const FrontDeskTimerBoard: React.FC<FrontDeskTimerBoardProps> = ({
  transactions,
  nowMs,
  isPrivacyHidden,
  onExtendTimer,
}) => {
  const timedSessions = useMemo(
    () =>
      transactions.filter(
        (t) =>
          Boolean(t.timerEndsAt) &&
          !t.timerStoppedAt &&
          !t.timerAcknowledged &&
          t.transactionStatus !== 'void'
      ),
    [transactions]
  );

  const expiredSessions = timedSessions.filter(
    (t) => new Date(t.timerEndsAt!).getTime() <= nowMs
  );
  const rollingSessions = timedSessions.filter(
    (t) => new Date(t.timerEndsAt!).getTime() > nowMs
  );

  return (
    <section className="space-y-4">
      {/* Expired Timer Alert Cards */}
      {expiredSessions.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-[#FF5252] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#FF5252] text-[#1A1A1A] flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-[#1A1A1A]">
                  Timer Alert Cards ({maskText(expiredSessions.length, isPrivacyHidden)} expired)
                </h2>
                <p className="text-xs text-gray-500">
                  Immediate Front-Desk attention required across timed outlets
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {expiredSessions.map((tx) => (
              <div
                key={tx.transactionID}
                className="p-4 rounded-xl bg-[#FFE27A] border border-[#1A1A1A]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-extrabold text-[#1A1A1A] text-sm truncate">
                    {tx.customerName}
                  </div>
                  <div className="font-semibold text-[#1A1A1A]/80 truncate">
                    {tx.outletName} · {tx.outletService}
                  </div>
                  <div className="mt-1 flex items-center gap-2 font-mono text-[11px] font-bold text-[#FF5252]">
                    <span>00:00:00 Expired</span>
                    <span className="text-[#1A1A1A]/60">·</span>
                    <span className="text-[#1A1A1A] tabular-nums">
                      {maskText(formatPhp(tx.totalAmount), isPrivacyHidden)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onExtendTimer(tx)}
                    className="px-3 py-1.5 rounded-lg bg-white text-[#1A1A1A] font-semibold cursor-pointer"
                  >
                    Extend
                  </button>
                  <button
                    type="button"
                    onClick={() => store.acknowledgeTimer(tx.transactionID)}
                    className="px-3 py-1.5 rounded-lg bg-[#FF5252] hover:bg-[#ff3b3b] text-[#1A1A1A] font-bold cursor-pointer"
                  >
                    Acknowledge
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Rolling Timers */}
      <div className="bg-white rounded-2xl border border-gray-200/90 p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#FFE27A] text-[#1A1A1A] flex items-center justify-center">
              <Timer className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-[#1A1A1A]">
                Pending rolling timers
              </h2>
              <p className="text-xs text-gray-500">
                Live countdowns across Pickleball, Billiards, Table Tennis, and KTV Rooms
              </p>
            </div>
          </div>
          <div className="text-xs font-bold text-[#1A1A1A] tabular-nums">
            {maskText(rollingSessions.length, isPrivacyHidden)} active sessions
          </div>
        </div>

        {rollingSessions.length === 0 ? (
          <div className="py-6 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl">
            No active rolling timers right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {rollingSessions.map((tx) => {
              const countdown = formatRemainingCountdown(tx.timerEndsAt, nowMs);
              return (
                <div
                  key={tx.transactionID}
                  className="p-4 rounded-xl bg-[#F7F7F7] border border-gray-200 flex flex-col justify-between gap-3 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-extrabold text-[#1A1A1A] text-sm truncate">
                        {tx.customerName}
                      </div>
                      <div className="text-gray-600 font-semibold truncate mt-0.5">
                        {tx.outletName}
                      </div>
                      <div className="text-[11px] text-gray-500 truncate">
                        {tx.outletService}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#FFE27A] text-[#1A1A1A] font-mono font-extrabold text-xs tabular-nums">
                        <Clock className="w-3 h-3" />
                        {countdown.label}
                      </div>
                      <div className="text-[11px] text-gray-500 font-mono mt-1 tabular-nums">
                        {maskText(formatPhp(tx.totalAmount), isPrivacyHidden)}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-200/80 flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-gray-500">{tx.transactionID}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => store.stopTimer(tx.transactionID)}
                        className="px-2.5 py-1 rounded-lg bg-gray-900 hover:bg-black text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Square className="w-2.5 h-2.5 fill-current" />
                        Stop
                      </button>
                      <button
                        type="button"
                        onClick={() => onExtendTimer(tx)}
                        className="px-2.5 py-1 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-[#1A1A1A] text-[11px] font-semibold cursor-pointer"
                      >
                        Extend
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

interface FrontDeskKpiGridProps {
  transactions: MasterTransaction[];
  outlets: Outlet[];
  isPrivacyHidden: boolean;
}

export const FrontDeskKpiGrid: React.FC<FrontDeskKpiGridProps> = ({
  transactions,
  outlets,
  isPrivacyHidden,
}) => {
  const analytics = useMemo(() => {
    const nonVoid = transactions.filter((t) => t.transactionStatus !== 'void');
    const paidTxs = transactions.filter((t) => t.transactionStatus === 'paid');
    const pendingTxs = transactions.filter((t) => t.transactionStatus === 'pending');
    const voidTxs = transactions.filter((t) => t.transactionStatus === 'void');

    const paidTotal = paidTxs.reduce((sum, t) => sum + t.totalAmount, 0);
    const pendingBalance = pendingTxs.reduce(
      (sum, t) => sum + (t.balanceDue > 0 ? t.balanceDue : t.totalAmount),
      0
    );
    const cashPaid = paidTxs
      .filter((t) => t.paymentChannel === 'Cash')
      .reduce((sum, t) => sum + t.totalAmount, 0);
    const qrPaid = paidTxs
      .filter((t) => t.paymentChannel === 'QRPh')
      .reduce((sum, t) => sum + t.totalAmount, 0);

    const totalPotential = paidTotal + pendingBalance;
    const collectionRate = totalPotential > 0 ? Math.round((paidTotal / totalPotential) * 100) : 100;
    const avgTicket = paidTxs.length > 0 ? paidTotal / paidTxs.length : 0;

    // Outlet sales ranking
    const outletMap = new Map<string, { name: string; paid: number; pending: number; count: number }>();
    for (const o of outlets) {
      outletMap.set(o.name, { name: o.name, paid: 0, pending: 0, count: 0 });
    }
    for (const tx of nonVoid) {
      const entry = outletMap.get(tx.outletName) || {
        name: tx.outletName,
        paid: 0,
        pending: 0,
        count: 0,
      };
      entry.count += 1;
      if (tx.transactionStatus === 'paid') {
        entry.paid += tx.totalAmount;
      } else {
        entry.pending += tx.balanceDue > 0 ? tx.balanceDue : tx.totalAmount;
      }
      outletMap.set(tx.outletName, entry);
    }

    const outletSales = Array.from(outletMap.values()).sort(
      (a, b) => b.paid + b.pending - (a.paid + a.pending)
    );
    const topOutlet = outletSales[0] || { name: 'None', paid: 0, pending: 0, count: 0 };
    const maxOutletTotal = Math.max(1, ...outletSales.map((o) => o.paid + o.pending));

    // 7-day trend
    const days: Array<{ label: string; isoDate: string; paid: number; pending: number }> = [];
    const today = new Date();
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const isoDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      days.push({
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
        isoDate,
        paid: 0,
        pending: 0,
      });
    }

    for (const tx of nonVoid) {
      const key = tx.transactionDateTime.slice(0, 10);
      const bucket = days.find((d) => d.isoDate === key);
      if (bucket) {
        if (tx.transactionStatus === 'paid') bucket.paid += tx.totalAmount;
        else bucket.pending += tx.balanceDue > 0 ? tx.balanceDue : tx.totalAmount;
      }
    }

    const distribution = [
      { label: 'Paid Cash', value: cashPaid, color: '#1A1A1A' },
      { label: 'Paid QR Ph', value: qrPaid, color: '#D97706' },
      { label: 'Pending Balance', value: pendingBalance, color: '#FF5252' },
      { label: 'Voided Value', value: voidTxs.reduce((s, t) => s + t.totalAmount, 0), color: '#D1D5DB' },
    ];
    const distTotal = Math.max(
      1,
      distribution.reduce((s, d) => s + d.value, 0)
    );

    return {
      paidTotal,
      pendingBalance,
      pendingCount: pendingTxs.length,
      paidCount: paidTxs.length,
      collectionRate,
      avgTicket,
      topOutlet,
      outletSales: outletSales.slice(0, 6),
      maxOutletTotal,
      days,
      distribution,
      distTotal,
    };
  }, [transactions, outlets]);

  // Build SVG donut segments
  const donutRadius = 46;
  const donutCirc = 2 * Math.PI * donutRadius;
  let runningOffset = 0;

  // Build SVG line chart coordinates
  const maxDayVal = Math.max(100, ...analytics.days.map((d) => Math.max(d.paid, d.pending)));
  const chartW = 320;
  const chartH = 120;
  const padX = 16;
  const padY = 14;
  const paidPoints = analytics.days
    .map((d, idx) => {
      const x = padX + (idx * (chartW - padX * 2)) / 6;
      const y = chartH - padY - ((d.paid / maxDayVal) * (chartH - padY * 2));
      return `${x},${y}`;
    })
    .join(' ');
  const pendingPoints = analytics.days
    .map((d, idx) => {
      const x = padX + (idx * (chartW - padX * 2)) / 6;
      const y = chartH - padY - ((d.pending / maxDayVal) * (chartH - padY * 2));
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <section className="space-y-4">
      {/* 4 Secondary Operational KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl p-4 sm:p-5 bg-white border border-gray-200/90 flex flex-col justify-between">
          <div className="text-xs font-semibold text-gray-500">Outstanding balances</div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-extrabold text-[#1A1A1A] tabular-nums">
              {maskText(formatPhp(analytics.pendingBalance), isPrivacyHidden)}
            </div>
            <div className="text-[11px] text-gray-500 mt-1 tabular-nums">
              {maskText(analytics.pendingCount, isPrivacyHidden)} pending receivables
            </div>
          </div>
        </div>

        <div className="rounded-2xl p-4 sm:p-5 bg-white border border-gray-200/90 flex flex-col justify-between">
          <div className="text-xs font-semibold text-gray-500">Collection rate</div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-extrabold text-[#1A1A1A] tabular-nums">
              {maskText(`${analytics.collectionRate}%`, isPrivacyHidden)}
            </div>
            <div className="text-[11px] text-gray-500 mt-1 tabular-nums">
              {maskText(analytics.paidCount, isPrivacyHidden)} settled tickets
            </div>
          </div>
        </div>

        <div className="rounded-2xl p-4 sm:p-5 bg-white border border-gray-200/90 flex flex-col justify-between">
          <div className="text-xs font-semibold text-gray-500">Average ticket</div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-extrabold text-[#1A1A1A] tabular-nums">
              {maskText(formatPhp(analytics.avgTicket), isPrivacyHidden)}
            </div>
            <div className="text-[11px] text-gray-500 mt-1">Across settled orders</div>
          </div>
        </div>

        <div className="rounded-2xl p-4 sm:p-5 bg-white border border-gray-200/90 flex flex-col justify-between">
          <div className="text-xs font-semibold text-gray-500">Top outlet</div>
          <div className="mt-2">
            <div className="text-base sm:text-lg font-extrabold text-[#1A1A1A] truncate">
              {analytics.topOutlet.name}
            </div>
            <div className="text-[11px] text-gray-500 mt-1 tabular-nums">
              {maskText(
                formatPhp(analytics.topOutlet.paid + analytics.topOutlet.pending),
                isPrivacyHidden
              )}{' '}
              volume
            </div>
          </div>
        </div>
      </div>

      {/* 3 Visual KPI Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 1. Top Outlets Sales Horizontal Bar Graph */}
        <div className="bg-white rounded-2xl border border-gray-200/90 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-[#1A1A1A]">Top outlets sales</h3>
              <p className="text-xs text-gray-500">Paid &amp; active volume by outlet</p>
            </div>
            <TrendingUp className="w-4 h-4 text-gray-400" />
          </div>

          <div className="space-y-3">
            {analytics.outletSales.map((item) => {
              const total = item.paid + item.pending;
              const widthPct = Math.max(4, Math.round((total / analytics.maxOutletTotal) * 100));
              return (
                <div key={item.name} className="space-y-1 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold text-[#1A1A1A] truncate">{item.name}</span>
                    <span className="font-mono font-bold text-[#1A1A1A] tabular-nums shrink-0">
                      {maskText(formatPhp(total), isPrivacyHidden)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#FFE27A] border border-[#1A1A1A]/15 transition-all"
                      style={{ width: isPrivacyHidden ? '45%' : `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Sales Distribution Pie/Donut Chart */}
        <div className="bg-white rounded-2xl border border-gray-200/90 p-5 space-y-4">
          <div>
            <h3 className="text-sm font-extrabold text-[#1A1A1A]">Sales distribution</h3>
            <p className="text-xs text-gray-500">Cash, QR Ph, pending &amp; void mix</p>
          </div>

          <div className="flex items-center gap-4">
            <svg viewBox="0 0 120 120" className="w-28 h-28 shrink-0 -rotate-90">
              <circle
                cx="60"
                cy="60"
                r={donutRadius}
                fill="none"
                stroke="#F3F4F6"
                strokeWidth="16"
              />
              {analytics.distribution.map((seg) => {
                const segLen = (seg.value / analytics.distTotal) * donutCirc;
                const dashArray = `${segLen} ${donutCirc - segLen}`;
                const dashOffset = -runningOffset;
                runningOffset += segLen;
                if (seg.value <= 0) return null;
                return (
                  <circle
                    key={seg.label}
                    cx="60"
                    cy="60"
                    r={donutRadius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="16"
                    strokeDasharray={dashArray}
                    strokeDashoffset={dashOffset}
                  />
                );
              })}
            </svg>

            <div className="flex-1 space-y-2 text-xs min-w-0">
              {analytics.distribution.map((seg) => {
                const pct = Math.round((seg.value / analytics.distTotal) * 100);
                return (
                  <div key={seg.label} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-gray-600 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: seg.color }}
                      />
                      <span className="truncate">{seg.label}</span>
                    </span>
                    <span className="font-mono font-bold text-[#1A1A1A] tabular-nums shrink-0">
                      {maskText(`${pct}%`, isPrivacyHidden)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100 flex justify-between text-xs">
            <span className="text-gray-500">Collected revenue</span>
            <span className="font-mono font-extrabold text-[#1A1A1A] tabular-nums">
              {maskText(formatPhp(analytics.paidTotal), isPrivacyHidden)}
            </span>
          </div>
        </div>

        {/* 3. 7-Day Revenue & Pending Line Chart */}
        <div className="bg-white rounded-2xl border border-gray-200/90 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-[#1A1A1A]">7-day sales trend</h3>
              <p className="text-xs text-gray-500">Settled vs. pending daily flow</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-gray-600">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-0.5 bg-[#1A1A1A] inline-block" /> Paid
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-0.5 bg-[#FF5252] inline-block" /> Pending
              </span>
            </div>
          </div>

          <div className="w-full">
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-32 overflow-visible">
              <line
                x1={padX}
                y1={chartH - padY}
                x2={chartW - padX}
                y2={chartH - padY}
                stroke="#E5E7EB"
                strokeWidth="1"
              />
              <line
                x1={padX}
                y1={chartH / 2}
                x2={chartW - padX}
                y2={chartH / 2}
                stroke="#F3F4F6"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <polyline
                fill="none"
                stroke="#FF5252"
                strokeWidth="2"
                strokeLinejoin="round"
                points={pendingPoints}
              />
              <polyline
                fill="none"
                stroke="#1A1A1A"
                strokeWidth="2.5"
                strokeLinejoin="round"
                points={paidPoints}
              />
              {analytics.days.map((d, idx) => {
                const x = padX + (idx * (chartW - padX * 2)) / 6;
                const y = chartH - padY - ((d.paid / maxDayVal) * (chartH - padY * 2));
                return (
                  <circle
                    key={d.isoDate}
                    cx={x}
                    cy={y}
                    r="3.5"
                    fill="#FFE27A"
                    stroke="#1A1A1A"
                    strokeWidth="1.5"
                  />
                );
              })}
            </svg>
            <div className="flex justify-between px-2 text-[10px] font-semibold text-gray-400">
              {analytics.days.map((d) => (
                <span key={d.isoDate}>{d.label}</span>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100 flex justify-between text-xs">
            <span className="text-gray-500">Today settled</span>
            <span className="font-mono font-bold text-[#1A1A1A] tabular-nums">
              {maskText(
                formatPhp(analytics.days[analytics.days.length - 1]?.paid || 0),
                isPrivacyHidden
              )}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
