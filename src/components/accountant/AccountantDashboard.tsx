import React, { useState, useEffect } from 'react';
import {
  User,
  MasterTransaction,
  TransactionStatus,
  CashConfirmation,
  EditRequest,
  VoidRequest,
} from '../../types';
import { store } from '../../db/store';
import { SidebarShell, SidebarNavItem } from '../common/SidebarShell';
import { StatTile } from '../common/StatTile';
import { StatusChip } from '../common/StatusChip';
import { TransactionDetailsModal } from '../common/TransactionDetailsModal';
import {
  DepositValidationView,
  FinancialAnalysisView,
  ForecastingView,
  DecisionAdvisorView,
  FinancialReconciliationView,
  ForecastResult,
} from './AccountantAiViews';
import {
  BarChart3,
  Clock,
  CheckSquare,
  Edit3,
  Eye,
  Search,
  FileCheck2,
  LineChart,
  TrendingUp,
  Bot,
  Scale,
} from 'lucide-react';

interface AccountantDashboardProps {
  user: User;
  onOpenProfile: () => void;
  onLogout: () => void;
}

type AccountantTab =
  | 'summary'
  | 'history'
  | 'approvals'
  | 'deposit'
  | 'analysis'
  | 'forecasting'
  | 'advisor'
  | 'reconciliation';

const SHORT_OUTLET_LABELS: Record<string, string> = {
  pickleball: 'Pickle',
  hostel: 'Hostel',
  gym: 'Gym',
  pool: 'Pool',
  ktv: 'KTV',
  fnb: 'F&B',
  billiards: 'Billiards',
  tabletennis: 'TT',
  parking: 'Park',
  events: 'Events',
};

export const AccountantDashboard: React.FC<AccountantDashboardProps> = ({
  user,
  onOpenProfile,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<AccountantTab>('summary');
  const [timeFilter, setTimeFilter] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [statusFilter, setStatusFilter] = useState<'all' | TransactionStatus>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | 'Cash' | 'QRPh'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<MasterTransaction[]>([]);
  const [cashConfirmations, setCashConfirmations] = useState<CashConfirmation[]>([]);
  const [editRequests, setEditRequests] = useState<EditRequest[]>([]);
  const [voidRequests, setVoidRequests] = useState<VoidRequest[]>([]);

  // Details Modal (Eye)
  const [detailTx, setDetailTx] = useState<MasterTransaction | null>(null);

  // Accountant Direct Edit Modal (No approval required per Revision 002)
  const [editingTx, setEditingTx] = useState<MasterTransaction | null>(null);
  const [editCustomer, setEditCustomer] = useState('');
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editDiscount, setEditDiscount] = useState<number>(0);
  const [editStatus, setEditStatus] = useState<TransactionStatus>('paid');
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  // Shared latest AI forecast so Decision Advisor has forecast context
  const [latestForecast, setLatestForecast] = useState<ForecastResult | null>(null);

  const loadData = () => {
    setTransactions(store.getTransactions());
    setCashConfirmations(store.getCashConfirmations());
    setEditRequests(store.getEditRequests());
    setVoidRequests(store.getVoidRequests());
  };

  useEffect(() => {
    loadData();
    const unsub = store.subscribe(() => loadData());
    return () => unsub();
  }, []);

  const showNotice = (msg: string) => {
    setBannerNotice(msg);
    window.setTimeout(() => {
      setBannerNotice((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  const now = Date.now();
  const filteredByTime = transactions.filter((t) => {
    const txTime = new Date(t.transactionDateTime).getTime();
    const diffHours = (now - txTime) / (1000 * 60 * 60);
    if (timeFilter === 'day') return diffHours <= 24;
    if (timeFilter === 'week') return diffHours <= 24 * 7;
    if (timeFilter === 'month') return diffHours <= 24 * 30;
    return diffHours <= 24 * 365;
  });

  const paidItems = filteredByTime.filter((t) => t.transactionStatus === 'paid');
  const pendingItems = filteredByTime.filter((t) => t.transactionStatus === 'pending');

  const paidSales = paidItems.reduce((acc, t) => acc + t.totalAmount, 0);
  const pendingSales = pendingItems.reduce((acc, t) => acc + t.totalAmount, 0);
  const totalSales = paidSales + pendingSales;

  const pendingCashItems = cashConfirmations.filter((c) => c.status === 'pending_audit');
  const pendingEdits = editRequests.filter((e) => e.status === 'pending');
  const pendingVoids = voidRequests.filter((v) => v.status === 'pending');
  const totalPendingApprovals =
    pendingCashItems.length + pendingEdits.length + pendingVoids.length;

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const allOutlets = store.getOutlets();
  const outletBars = allOutlets.map((o) => {
    const oTx = filteredByTime.filter((t) => t.outletSlug === o.slug && t.transactionStatus !== 'void');
    const paid = oTx
      .filter((t) => t.transactionStatus === 'paid')
      .reduce((acc, t) => acc + t.totalAmount, 0);
    const pending = oTx
      .filter((t) => t.transactionStatus === 'pending')
      .reduce((acc, t) => acc + t.totalAmount, 0);
    return {
      slug: o.slug,
      shortName: SHORT_OUTLET_LABELS[o.slug] || o.name.slice(0, 8),
      fullName: o.name,
      paid,
      pending,
      total: paid + pending,
    };
  });

  const maxOutletVal = Math.max(1, ...outletBars.map((b) => b.total));

  const historyRows = transactions.filter((t) => {
    const matchesStatus = statusFilter === 'all' || t.transactionStatus === statusFilter;
    const matchesChannel =
      channelFilter === 'all' ||
      t.paymentChannel === channelFilter ||
      t.initialPaymentMode === channelFilter ||
      t.balancePaymentMode === channelFilter;

    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      t.transactionID.toLowerCase().includes(q) ||
      t.customerName.toLowerCase().includes(q) ||
      t.outletName.toLowerCase().includes(q) ||
      t.outletService.toLowerCase().includes(q) ||
      t.employeeHandler.toLowerCase().includes(q) ||
      (t.cashReceivedBy || '').toLowerCase().includes(q) ||
      t.paymentChannel.toLowerCase().includes(q) ||
      t.paymentArrangement.toLowerCase().includes(q) ||
      t.transactionStatus.toLowerCase().includes(q) ||
      String(t.totalAmount).includes(q);

    return matchesStatus && matchesChannel && matchesSearch;
  });

  const navItems: SidebarNavItem[] = [
    { id: 'summary', label: 'Summary', icon: BarChart3 },
    { id: 'history', label: 'History', icon: Clock },
    {
      id: 'approvals',
      label: 'Approvals',
      icon: CheckSquare,
      badge: totalPendingApprovals,
    },
    {
      id: 'deposit',
      label: 'Deposit Validation',
      icon: FileCheck2,
      dividerBefore: true,
      sectionLabel: 'AI Suite',
    },
    { id: 'analysis', label: 'Financial Analysis', icon: LineChart },
    { id: 'forecasting', label: 'Forecasting', icon: TrendingUp },
    { id: 'advisor', label: 'Decision Advisor', icon: Bot },
    { id: 'reconciliation', label: 'Financial Recon', icon: Scale },
  ];

  const handleOpenDirectEdit = (tx?: MasterTransaction) => {
    const target =
      tx ||
      (selectedTxId && transactions.find((t) => t.transactionID === selectedTxId)) ||
      transactions[0];
    if (!target) return;
    setEditingTx(target);
    setEditCustomer(target.customerName);
    setEditAmount(target.transactionAmount);
    setEditDiscount(target.discount);
    setEditStatus(target.transactionStatus);
  };

  const handleSaveDirectEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;
    store.accountantDirectUpdate(editingTx.transactionID, {
      customerName: editCustomer,
      transactionAmount: editAmount,
      discount: editDiscount,
      transactionStatus: editStatus,
    });
    showNotice(`Updated ${editingTx.transactionID} directly.`);
    setEditingTx(null);
  };

  const inspectTransactionById = (txId: string) => {
    const found = store.getTransactionById(txId);
    if (found) setDetailTx(found);
  };

  return (
    <SidebarShell
      brandSubLabel="Accountant"
      navItems={navItems}
      activeNavId={activeTab}
      onSelectNav={(id) => setActiveTab(id as AccountantTab)}
      user={user}
      onOpenProfile={onOpenProfile}
      onLogout={onLogout}
    >
      {bannerNotice && (
        <div className="mb-4 p-3 rounded-xl bg-[#FFE27A] border border-[#1A1A1A]/15 text-[#1A1A1A] text-xs font-semibold flex items-center justify-between gap-3">
          <span>{bannerNotice}</span>
          <button
            type="button"
            onClick={() => setBannerNotice(null)}
            className="text-xs font-bold opacity-70 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {activeTab === 'summary' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-[#1A1A1A]">
                Sales summary
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">All outlets · {todayFormatted}</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500">Period</span>
              <div className="inline-flex p-1 bg-white border border-gray-200 rounded-xl gap-0.5">
                {(['day', 'week', 'month', 'year'] as const).map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setTimeFilter(period)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer transition-all ${
                      timeFilter === period
                        ? 'bg-[#FFE27A] text-[#1A1A1A] font-bold'
                        : 'text-gray-600 hover:text-[#1A1A1A]'
                    }`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatTile
              label="Total sales"
              value={`₱${totalSales.toLocaleString()}`}
              sub={`${filteredByTime.length} transactions`}
              isHighlight={true}
            />
            <StatTile
              label="Paid"
              value={`₱${paidSales.toLocaleString()}`}
              sub={`${paidItems.length} transactions`}
            />
            <StatTile
              label="Pending"
              value={`₱${pendingSales.toLocaleString()}`}
              sub={`${pendingItems.length} transactions`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-gray-200/90 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-bold text-[#1A1A1A]">Sales by outlet</h2>
                <div className="flex items-center gap-3 text-[11px] text-gray-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#FFE27A]" />
                    Paid
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#FF5252]" />
                    Pending
                  </span>
                </div>
              </div>

              <div className="h-56 flex items-end justify-between gap-2 pt-4 border-b border-gray-100 pb-2">
                {outletBars.map((bar) => {
                  const paidPct = Math.round((bar.paid / maxOutletVal) * 100);
                  const pendingPct = Math.round((bar.pending / maxOutletVal) * 100);
                  return (
                    <div
                      key={bar.slug}
                      className="flex-1 flex flex-col items-center justify-end h-full group"
                      title={`${bar.fullName}: ₱${bar.total.toLocaleString()}`}
                    >
                      <div className="w-full max-w-[32px] flex flex-col justify-end h-full gap-0.5">
                        {bar.pending > 0 && (
                          <div
                            className="w-full bg-[#FF5252] rounded-t-sm transition-all duration-200"
                            style={{ height: `${Math.max(4, pendingPct)}%` }}
                          />
                        )}
                        {bar.paid > 0 && (
                          <div
                            className="w-full bg-[#FFE27A] rounded-t-sm transition-all duration-200"
                            style={{ height: `${Math.max(4, paidPct)}%` }}
                          />
                        )}
                        {bar.total === 0 && <div className="w-full bg-gray-100 rounded-t-sm h-1" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between gap-2 pt-2">
                {outletBars.map((bar) => (
                  <div
                    key={bar.slug}
                    className="flex-1 text-center text-[10px] font-semibold text-gray-500 truncate"
                  >
                    {bar.shortName}
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-gray-200/90">
              <h2 className="text-sm font-bold text-[#1A1A1A] mb-4">Listed summary</h2>
              <div className="divide-y divide-gray-100 text-xs">
                {outletBars.map((bar) => (
                  <div key={bar.slug} className="py-2 flex items-center justify-between">
                    <span className="font-medium text-gray-700">{bar.fullName}</span>
                    <span className="font-bold text-[#1A1A1A] tabular-nums">
                      ₱{bar.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-[#1A1A1A]">
                Transaction history
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                All outlets · filter by Cash / QR Ph, search by any attribute, inspect or edit directly
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleOpenDirectEdit()}
                className="px-4 py-2.5 rounded-xl bg-[#FF5252] hover:bg-[#ff3b3b] text-[#1A1A1A] text-xs font-bold cursor-pointer min-h-[42px]"
              >
                Edit selected
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200/90 overflow-hidden">
            <div className="p-4 sm:px-6 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="text-sm font-bold text-[#1A1A1A]">
                All transactions ({historyRows.length})
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search ID, customer, outlet, handler..."
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 text-xs text-[#1A1A1A] outline-none focus:border-[#1A1A1A] w-56 sm:w-64"
                  />
                </div>

                {/* Channel Filter: All / Cash / QRPh */}
                <div className="inline-flex p-1 bg-gray-100 rounded-xl gap-0.5">
                  {(['all', 'Cash', 'QRPh'] as const).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setChannelFilter(ch)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                        channelFilter === ch
                          ? 'bg-[#FFE27A] text-[#1A1A1A] font-bold shadow-2xs'
                          : 'text-gray-500 hover:text-[#1A1A1A]'
                      }`}
                    >
                      {ch === 'all' ? 'All modes' : ch === 'QRPh' ? 'QR Ph' : 'Cash'}
                    </button>
                  ))}
                </div>

                {/* Status Filter */}
                <div className="inline-flex p-1 bg-gray-100 rounded-xl gap-0.5">
                  {(['all', 'paid', 'pending', 'void'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize cursor-pointer ${
                        statusFilter === st
                          ? 'bg-white text-[#1A1A1A] shadow-2xs'
                          : 'text-gray-500 hover:text-[#1A1A1A]'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    <th className="py-3 px-6">ID</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Service</th>
                    <th className="py-3 px-4">Channel</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {historyRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-gray-400">
                        No transactions match your filters.
                      </td>
                    </tr>
                  ) : (
                    historyRows.map((tx) => {
                      const isSelected = selectedTxId === tx.transactionID;
                      return (
                        <tr
                          key={tx.transactionID}
                          onClick={() => setSelectedTxId(tx.transactionID)}
                          className={`transition-colors cursor-pointer ${
                            isSelected ? 'bg-[#FFE27A]/20' : 'hover:bg-gray-50/70'
                          }`}
                        >
                          <td className="py-3.5 px-6 font-mono text-gray-500 whitespace-nowrap">
                            {tx.transactionID}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-[#1A1A1A]">
                            {tx.customerName}
                          </td>
                          <td className="py-3.5 px-4 text-gray-600 max-w-xs truncate">
                            <span className="font-semibold text-[#1A1A1A]">
                              {tx.outletName.split(' ')[0]}
                            </span>{' '}
                            · {tx.outletService}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-md bg-gray-100 text-[#1A1A1A] font-semibold text-[11px]">
                              {tx.paymentChannel === 'QRPh' ? 'QR Ph' : tx.paymentChannel}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-[#1A1A1A] tabular-nums whitespace-nowrap">
                            ₱{tx.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <StatusChip status={tx.transactionStatus} size="sm" />
                          </td>
                          <td className="py-3.5 px-4 text-gray-500 whitespace-nowrap tabular-nums">
                            {new Date(tx.transactionDateTime).toLocaleTimeString([], {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </td>
                          <td
                            className="py-3.5 px-6 text-right whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setDetailTx(tx)}
                                className="p-1.5 rounded-lg text-gray-500 hover:text-[#1A1A1A] hover:bg-gray-100 cursor-pointer"
                                title="View transaction details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenDirectEdit(tx)}
                                className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 cursor-pointer"
                                title="Edit transaction directly (no approval needed)"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'approvals' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#1A1A1A]">
              Accountant approvals
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Confirm cash payments, review Front-Desk edit requests, and decide void requests
            </p>
          </div>

          {/* 1. Cash Payments to Confirm (Migrated from Front-Desk) */}
          <div className="bg-white rounded-2xl border border-gray-200/90 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-bold text-[#1A1A1A]">Cash payments to confirm</span>
              <span className="text-xs font-bold text-gray-500">
                {pendingCashItems.length} pending audit
              </span>
            </div>
            {cashConfirmations.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">
                No cash confirmations queued.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {cashConfirmations.map((c) => (
                  <div
                    key={c.id}
                    className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1 items-center">
                      <span className="font-bold font-mono text-[#1A1A1A]">
                        {c.transactionId} · {c.customerName}
                      </span>
                      <span className="text-gray-600">
                        {c.outletName}
                        {c.cashReceivedBy ? ` · Rx by ${c.cashReceivedBy}` : ''}
                      </span>
                      <span className="font-bold text-[#1A1A1A] tabular-nums">
                        ₱{c.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => inspectTransactionById(c.transactionId)}
                        className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#1A1A1A] cursor-pointer"
                        title="View transaction details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {c.status === 'pending_audit' ? (
                        <button
                          type="button"
                          onClick={() => store.approveCashConfirmation(c.id, user.name)}
                          className="px-4 py-2 rounded-xl bg-[#FF5252] hover:bg-[#ff3b3b] text-[#1A1A1A] font-bold cursor-pointer"
                        >
                          Confirm cash
                        </button>
                      ) : (
                        <span className="px-3 py-1 rounded-full bg-[#FFE27A] text-[#1A1A1A] font-bold text-[11px]">
                          Confirmed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Edit Requests Approval (Migrated from Front-Desk; includes Front-Desk edit submissions) */}
          <div className="bg-white rounded-2xl border border-gray-200/90 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-bold text-[#1A1A1A]">Edit requests approval</span>
              <span className="text-xs font-bold text-gray-500">
                {pendingEdits.length} pending
              </span>
            </div>
            {editRequests.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">No edit requests submitted.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {editRequests.map((er) => (
                  <div
                    key={er.id}
                    className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold font-mono text-[#1A1A1A]">
                        {er.transactionId}
                        {er.changes.customerName ? ` · ${er.changes.customerName}` : ''}
                        {er.changes.transactionStatus ? ` · Status: ${er.changes.transactionStatus}` : ''}
                        {er.changes.totalAmount !== undefined
                          ? ` · ₱${er.changes.totalAmount.toLocaleString('en-PH', {
                              minimumFractionDigits: 2,
                            })}`
                          : ''}
                      </div>
                      <div className="text-gray-500 mt-0.5">
                        Requested by {er.requestedByName} — {er.note}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => inspectTransactionById(er.transactionId)}
                        className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#1A1A1A] cursor-pointer"
                        title="View transaction details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {er.status === 'pending' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => store.decideEditRequest(er.id, 'rejected', user.name)}
                            className="px-4 py-2 rounded-xl bg-white border border-gray-300 text-[#1A1A1A] font-semibold cursor-pointer"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => store.decideEditRequest(er.id, 'approved', user.name)}
                            className="px-4 py-2 rounded-xl bg-[#FF5252] hover:bg-[#ff3b3b] text-[#1A1A1A] font-bold cursor-pointer"
                          >
                            Approve edit
                          </button>
                        </>
                      ) : (
                        <span className="text-xs font-bold capitalize text-gray-500">
                          {er.status} {er.decidedBy ? `· ${er.decidedBy}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Void Requests Approval (Migrated from Front-Desk) */}
          <div className="bg-white rounded-2xl border border-gray-200/90 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-bold text-[#1A1A1A]">Void requests approval</span>
              <span className="text-xs font-bold text-gray-500">
                {pendingVoids.length} pending
              </span>
            </div>
            {voidRequests.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">No void requests.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {voidRequests.map((v) => (
                  <div
                    key={v.id}
                    className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 flex-1 items-center">
                      <span className="font-bold font-mono text-[#1A1A1A]">{v.transactionId}</span>
                      <span className="text-gray-600">{v.requestedByName}</span>
                      <span className="text-gray-600 truncate">{v.reason}</span>
                      <span className="font-bold text-[#1A1A1A] tabular-nums">
                        ₱{v.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => inspectTransactionById(v.transactionId)}
                        className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#1A1A1A] cursor-pointer"
                        title="View transaction details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {v.status === 'pending' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => store.decideVoidRequest(v.id, 'rejected', user.name)}
                            className="px-4 py-2 rounded-xl bg-white border border-gray-300 text-[#1A1A1A] font-semibold cursor-pointer"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => store.decideVoidRequest(v.id, 'approved', user.name)}
                            className="px-4 py-2 rounded-xl bg-[#FF5252] hover:bg-[#ff3b3b] text-[#1A1A1A] font-bold cursor-pointer"
                          >
                            Approve void
                          </button>
                        </>
                      ) : (
                        <span className="text-xs font-bold capitalize text-gray-500">
                          {v.status} · {v.decidedBy}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'deposit' && (
        <DepositValidationView
          user={user}
          transactions={transactions}
          onInspectTx={(tx) => setDetailTx(tx)}
        />
      )}

      {activeTab === 'analysis' && (
        <FinancialAnalysisView user={user} transactions={transactions} />
      )}

      {activeTab === 'forecasting' && (
        <ForecastingView
          user={user}
          transactions={transactions}
          forecast={latestForecast}
          onForecastUpdated={(next) => setLatestForecast(next)}
        />
      )}

      {activeTab === 'advisor' && (
        <DecisionAdvisorView transactions={transactions} latestForecast={latestForecast} />
      )}

      {activeTab === 'reconciliation' && (
        <FinancialReconciliationView
          user={user}
          transactions={transactions}
          onInspectTx={(tx) => setDetailTx(tx)}
        />
      )}

      {/* Accountant Direct Edit Modal (No approval needed per Rev 002) */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-gray-200 shadow-2xl">
            <h3 className="text-base font-extrabold text-[#1A1A1A]">
              Edit transaction ({editingTx.transactionID})
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Direct Accountant modification (applies immediately)
            </p>
            <div className="mt-3 p-3.5 rounded-xl bg-[#FFE27A] text-[#1A1A1A] text-xs">
              <div className="font-bold font-mono">
                {editingTx.outletName} · {editingTx.outletService}
              </div>
            </div>
            <form onSubmit={handleSaveDirectEdit} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-600 mb-1">Customer name</label>
                <input
                  type="text"
                  value={editCustomer}
                  onChange={(e) => setEditCustomer(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-300"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Amount (₱)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editAmount}
                    onChange={(e) => setEditAmount(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-gray-300 font-bold tabular-nums"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Discount (₱)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editDiscount}
                    onChange={(e) => setEditDiscount(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-gray-300 tabular-nums"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-gray-600 mb-1">Transaction status</label>
                <select
                  value={editStatus}
                  onChange={(e: any) => setEditStatus(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-300 bg-white"
                >
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="void">Void</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="py-2.5 rounded-xl bg-white border border-gray-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2.5 rounded-xl bg-[#FF5252] text-[#1A1A1A] font-bold cursor-pointer"
                >
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Details Modal (Eye icon) */}
      {detailTx && (
        <TransactionDetailsModal transaction={detailTx} onClose={() => setDetailTx(null)} />
      )}
    </SidebarShell>
  );
};
