import React, { useState, useEffect } from 'react';
import {
  Outlet,
  User,
  MasterTransaction,
  TransactionStatus,
  PaymentChannel,
  PaymentArrangement,
  VoidRequest,
} from '../../types';
import { store, TIMED_OUTLET_SLUGS, calculateDiscountBreakdown } from '../../db/store';
import { SidebarShell, SidebarNavItem } from '../common/SidebarShell';
import { StatTile } from '../common/StatTile';
import { StatusChip } from '../common/StatusChip';
import { OutletTransactionForm } from './OutletTransactionForm';
import { PosTerminal } from './PosTerminal';
import { QrPhModal } from '../common/QrPhModal';
import { ReceiptModal } from '../common/ReceiptModal';
import { TransactionDetailsModal } from '../common/TransactionDetailsModal';
import {
  InitialDownPaymentCashModal,
  PayBalanceModal,
} from '../common/PaymentWorkflowModals';
import {
  LayoutGrid,
  Clock,
  XCircle,
  Plus,
  Search,
  Edit3,
  QrCode,
  Eye,
  Lock,
  UtensilsCrossed,
  Bell,
  Timer,
  Banknote,
  Square,
} from 'lucide-react';

interface OutletWorkspaceProps {
  outlet: Outlet;
  user: User;
  onOpenProfile: () => void;
  onLogout: () => void;
  topBanner?: React.ReactNode;
  headerExtra?: React.ReactNode;
  sidebarExtra?: React.ReactNode;
}

function formatRemainingCountdown(timerEndsAt: string | null | undefined, nowMs: number): {
  label: string;
  isExpired: boolean;
} {
  if (!timerEndsAt) return { label: '—', isExpired: false };
  const diffMs = new Date(timerEndsAt).getTime() - nowMs;
  if (diffMs <= 0) {
    return { label: '00:00:00', isExpired: true };
  }
  const totalSec = Math.floor(diffMs / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return { label: `${pad(hrs)}:${pad(mins)}:${pad(secs)}`, isExpired: false };
}

export const OutletWorkspace: React.FC<OutletWorkspaceProps> = ({
  outlet,
  user,
  onOpenProfile,
  onLogout,
  topBanner,
  headerExtra,
  sidebarExtra,
}) => {
  const [activeNav, setActiveNav] = useState<'dashboard' | 'history' | 'voids'>('dashboard');
  const [viewMode, setViewMode] = useState<'main' | 'create' | 'pos'>('main');
  const [transactions, setTransactions] = useState<MasterTransaction[]>([]);
  const [voidRequests, setVoidRequests] = useState<VoidRequest[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TransactionStatus>('all');
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [bannerNotice, setBannerNotice] = useState<{ type: 'info' | 'warn'; text: string } | null>(null);

  // Modals
  const [qrModalTx, setQrModalTx] = useState<MasterTransaction | null>(null);
  const [initialCashDownTx, setInitialCashDownTx] = useState<MasterTransaction | null>(null);
  const [payBalanceTx, setPayBalanceTx] = useState<MasterTransaction | null>(null);
  const [extendTx, setExtendTx] = useState<MasterTransaction | null>(null);
  const [extendHours, setExtendHours] = useState<number>(1);

  const [receiptTx, setReceiptTx] = useState<{ tx: MasterTransaction; fnb?: any } | null>(null);
  const [editingTx, setEditingTx] = useState<MasterTransaction | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editDiscountApplied, setEditDiscountApplied] = useState<boolean>(false);
  const [editCustomer, setEditCustomer] = useState<string>('');
  const [editStatus, setEditStatus] = useState<TransactionStatus>('pending');
  const [editNote, setEditNote] = useState<string>('');
  const [editLockError, setEditLockError] = useState<string | null>(null);

  const [voidingTx, setVoidingTx] = useState<MasterTransaction | null>(null);
  const [voidReason, setVoidReason] = useState<string>('Customer cancelled');
  const [voidNote, setVoidNote] = useState<string>('');
  const [detailTx, setDetailTx] = useState<MasterTransaction | null>(null);

  const isTimedOutlet = TIMED_OUTLET_SLUGS.includes(outlet.slug);
  const isFrontDeskAdmin = user.role === 'admin';

  const loadData = () => {
    setTransactions(store.getTransactions(outlet.slug));
    setVoidRequests(store.getVoidRequests().filter((v) => v.outletName === outlet.name));
  };

  useEffect(() => {
    loadData();
    setViewMode('main');
    setSelectedTxId(null);
    const unsubscribe = store.subscribe(() => loadData());
    return () => unsubscribe();
  }, [outlet.slug]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const showNotice = (type: 'info' | 'warn', text: string) => {
    setBannerNotice({ type, text });
    window.setTimeout(() => {
      setBannerNotice((prev) => (prev?.text === text ? null : prev));
    }, 5500);
  };

  const paidTransactions = transactions.filter((t) => t.transactionStatus === 'paid');
  const pendingTransactions = transactions.filter((t) => t.transactionStatus === 'pending');

  const totalSales = paidTransactions.reduce((acc, t) => acc + t.totalAmount, 0);
  const pendingAmount = pendingTransactions.reduce(
    (acc, t) => acc + (t.balanceDue > 0 ? t.balanceDue : t.totalAmount),
    0
  );

  // Expired countdown timers requiring unavoidable blocking acknowledgement (exclude stopped timers)
  const expiredTimedTxs = transactions.filter(
    (t) =>
      t.timerEndsAt &&
      !t.timerStoppedAt &&
      !t.timerAcknowledged &&
      t.transactionStatus !== 'void' &&
      new Date(t.timerEndsAt).getTime() <= nowMs
  );

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const filteredTransactions = transactions.filter((t) => {
    const matchesStatus = statusFilter === 'all' || t.transactionStatus === statusFilter;
    const matchesSearch =
      !searchQuery ||
      t.transactionID.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.outletService.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleTransactionCreated = (
    newTxId: string,
    channel: PaymentChannel,
    arrangement?: PaymentArrangement
  ) => {
    setViewMode('main');
    loadData();
    const created = store.getTransactionById(newTxId);
    if (!created) return;

    if (channel === 'QRPh' && created.transactionStatus === 'pending') {
      setQrModalTx(created);
    } else if (
      arrangement === 'Down Payment' &&
      channel === 'Cash' &&
      created.transactionStatus === 'pending' &&
      created.amountPaid === 0
    ) {
      setInitialCashDownTx(created);
    }
  };

  const handlePayBalance = (tx: MasterTransaction) => {
    setPayBalanceTx(tx);
  };

  const handleOpenExtend = (tx: MasterTransaction) => {
    setExtendHours(1);
    setExtendTx(tx);
  };

  const handleConfirmExtend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendTx || extendHours <= 0) return;
    store.extendTimedTransaction(extendTx.transactionID, extendHours);
    setExtendTx(null);
  };

  const handleStartEdit = (tx: MasterTransaction) => {
    if (!isFrontDeskAdmin) {
      const lockRes = store.acquireLock(tx.transactionID, user.id, user.name);
      if (!lockRes.acquired) {
        setEditLockError(`Locked by ${lockRes.currentLockOwner || 'another clerk'} (NFR6).`);
        setTimeout(() => setEditLockError(null), 4000);
        return;
      }
    }
    setEditingTx(tx);
    setEditAmount(tx.transactionAmount);
    setEditDiscountApplied(tx.discountApplied);
    setEditCustomer(tx.customerName);
    setEditStatus(tx.transactionStatus);
    setEditNote('');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;

    // Front-Desk edits must go to Accountant for approval (Revision 002)
    if (isFrontDeskAdmin) {
      if (!editNote.trim()) {
        setEditLockError('Please enter a short audit note for the Accountant.');
        return;
      }
      const { discount, totalAmount } = calculateDiscountBreakdown(editAmount, editDiscountApplied);
      store.createEditRequest(
        editingTx.transactionID,
        user.id,
        user.name,
        {
          customerName: editCustomer,
          transactionAmount: editAmount,
          discount,
          totalAmount,
          transactionStatus: editStatus,
        },
        editNote.trim(),
        'admin'
      );
      setEditingTx(null);
      showNotice('info', `Edit request for ${editingTx.transactionID} sent to Accountant for approval.`);
      return;
    }

    const res = store.updatePendingTransaction(
      editingTx.transactionID,
      {
        customerName: editCustomer,
        transactionAmount: editAmount,
        discountApplied: editDiscountApplied,
      },
      user.id
    );
    if (res.success) {
      setEditingTx(null);
    } else {
      setEditLockError(res.error || 'Failed to save changes.');
    }
  };

  const handleCancelEdit = () => {
    if (editingTx) {
      if (!isFrontDeskAdmin) {
        store.releaseLock(editingTx.transactionID, user.id);
      }
      setEditingTx(null);
    }
  };

  const handleSubmitVoid = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidingTx || !voidReason) return;
    store.createVoidRequest(
      voidingTx.transactionID,
      user.id,
      user.name,
      user.role,
      voidReason,
      voidNote
    );
    setVoidingTx(null);
    setActiveNav('voids');
  };

  const handleHeaderRequestVoid = () => {
    const target =
      (selectedTxId && transactions.find((t) => t.transactionID === selectedTxId)) ||
      transactions.find((t) => t.transactionStatus !== 'void');
    if (target) {
      setVoidReason('Customer cancelled');
      setVoidNote('');
      setVoidingTx(target);
    }
  };

  const navItems: SidebarNavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'history', label: 'History', icon: Clock },
    {
      id: 'voids',
      label: 'Void requests',
      icon: XCircle,
      badge: voidRequests.filter((v) => v.status === 'pending').length,
    },
  ];

  const renderOperationalTile = () => {
    let title = 'Status';
    let rows: Array<{ label: string; sub: string }> = [];

    switch (outlet.slug) {
      case 'pickleball':
        title = 'Courts';
        rows = [
          { label: 'Al fresco · Ground', sub: '₱150/pax/hr' },
          { label: 'Indoor · 2nd floor', sub: 'Paddles ₱100 · Balls ₱50' },
        ];
        break;
      case 'hostel':
        title = 'Room rates (12% VAT incl.)';
        rows = [
          { label: '2 Single / Queen / King', sub: '₱1,680 – ₱3,136/night' },
          { label: 'Suite Overlooking', sub: '₱4,480/night · No SC' },
        ];
        break;
      case 'gym':
        title = 'Programs';
        rows = [
          { label: 'Annual / Monthly', sub: '₱1,600 – ₱5,000' },
          { label: 'Boxing / Muay Thai', sub: 'Per-session & Self-train' },
        ];
        break;
      case 'pool':
        title = 'Pool today';
        rows = [
          { label: 'Hotel guests', sub: 'Complimentary (₱0)' },
          { label: 'Walk-ins', sub: '₱300 adult / ₱150 child' },
        ];
        break;
      case 'ktv':
        title = 'Rooms 1–4';
        rows = [
          { label: 'KTV 1 & 2 Package', sub: '3h + ₱5k consumable' },
          { label: 'KTV Suite 4 Package', sub: '3h + ₱15k · ₱1,000/hr' },
        ];
        break;
      case 'fnb':
        title = 'POS orders';
        rows = [
          { label: 'Kitchen tickets', sub: `${transactions.length} recorded` },
          { label: 'Central database', sub: 'Synced live' },
        ];
        break;
      case 'billiards':
        title = 'Places';
        rows = [
          { label: 'Without Aircon', sub: '₱200 / hour' },
          { label: 'With Aircon', sub: '₱400 / hour' },
        ];
        break;
      case 'tabletennis':
        title = 'Tables 1–3';
        rows = [
          { label: 'Upstairs arena', sub: '₱250 / hour' },
          { label: 'Countdown timer', sub: 'Live session tracking' },
        ];
        break;
      case 'parking':
        title = 'Lot rates';
        rows = [
          { label: '4 wheels / 2 wheels', sub: '₱50 / ₱30' },
          { label: 'Checked-in guest', sub: 'Free (₱0.00)' },
        ];
        break;
      case 'events':
        title = 'Upcoming';
        rows = [
          { label: 'Pre-Christmas party', sub: 'Grand Terrace' },
          { label: 'Film / TV shoots', sub: 'Location packages open' },
        ];
        break;
      default:
        title = 'Outlet';
        rows = [{ label: outlet.name, sub: 'Active' }];
    }

    return (
      <div className="rounded-2xl p-5 bg-white border border-gray-200/90 flex flex-col justify-between min-h-[124px]">
        <div className="text-xs font-semibold text-gray-500 mb-2">{title}</div>
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div key={i} className="flex items-baseline justify-between gap-2 text-xs">
              <span className="font-bold text-[#1A1A1A] truncate">{r.label}</span>
              <span className="text-[11px] text-gray-500 shrink-0">{r.sub}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTransactionTable = (rows: MasterTransaction[], showVoidFilter: boolean) => (
    <div className="bg-white rounded-2xl border border-gray-200/90 overflow-hidden">
      {/* Header Row */}
      <div className="p-4 sm:px-6 sm:py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-sm font-bold text-[#1A1A1A]">
          {activeNav === 'dashboard' ? 'Recent transactions' : 'All transactions'}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeNav === 'history' && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ID or customer..."
                className="pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 text-xs text-[#1A1A1A] outline-none focus:border-[#1A1A1A] w-48"
              />
            </div>
          )}

          <div className="inline-flex p-1 bg-gray-100 rounded-xl gap-0.5">
            {(['all', 'paid', 'pending', ...(showVoidFilter ? ['void'] : [])] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st as any)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize cursor-pointer transition-all ${
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

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              <th className="py-3 px-6">ID</th>
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-4">Service</th>
              {isTimedOutlet && <th className="py-3 px-4">Timer</th>}
              <th className="py-3 px-4 text-right">Amount / Balance</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-xs">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={isTimedOutlet ? 7 : 6} className="py-10 text-center text-gray-400">
                  No transactions found.
                </td>
              </tr>
            ) : (
              rows.map((tx) => {
                const isSelected = selectedTxId === tx.transactionID;
                const timerInfo = formatRemainingCountdown(tx.timerEndsAt, nowMs);
                const hasBalance = tx.balanceDue > 0 || tx.transactionStatus === 'pending';
                const canStopTimer =
                  isTimedOutlet &&
                  Boolean(tx.timerEndsAt) &&
                  !tx.timerStoppedAt &&
                  !timerInfo.isExpired &&
                  tx.transactionStatus !== 'void';
                const canEdit =
                  tx.transactionStatus !== 'void' &&
                  (isFrontDeskAdmin || tx.transactionStatus === 'pending');

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
                      {tx.lockedBy && (
                        <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                          <Lock className="w-2.5 h-2.5" /> Locked
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-gray-600 max-w-xs truncate">
                      {tx.outletService}
                    </td>
                    {isTimedOutlet && (
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono tabular-nums">
                        {tx.timerStoppedAt ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-gray-100 text-gray-700">
                            <Square className="w-2.5 h-2.5 fill-current" />
                            Stopped
                          </span>
                        ) : tx.timerEndsAt ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              timerInfo.isExpired
                                ? 'bg-[#FF5252]/15 text-[#FF5252]'
                                : 'bg-[#FFE27A]/50 text-[#1A1A1A]'
                            }`}
                          >
                            <Timer className="w-3 h-3" />
                            {timerInfo.isExpired ? 'Expired' : timerInfo.label}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    )}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap tabular-nums">
                      <div className="font-bold text-[#1A1A1A]">
                        ₱{tx.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </div>
                      {tx.balanceDue > 0 && tx.transactionStatus !== 'void' && (
                        <div className="text-[11px] font-semibold text-[#FF5252]">
                          Bal: ₱{tx.balanceDue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <StatusChip status={tx.transactionStatus} size="sm" />
                    </td>
                    <td
                      className="py-3.5 px-6 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDetailTx(tx)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-[#1A1A1A] hover:bg-gray-100 cursor-pointer"
                          title="View transaction & relational details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => handleStartEdit(tx)}
                            className="p-1.5 rounded-lg text-gray-600 hover:text-[#1A1A1A] hover:bg-gray-100 cursor-pointer"
                            title={
                              isFrontDeskAdmin
                                ? 'Request transaction edit (Accountant approval)'
                                : 'Edit pending transaction'
                            }
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {hasBalance && tx.transactionStatus !== 'void' && (
                          <button
                            type="button"
                            onClick={() => handlePayBalance(tx)}
                            className="px-2.5 py-1 rounded-lg bg-[#FFE27A] hover:bg-[#fed650] text-[#1A1A1A] text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                            title="Pay Balance"
                          >
                            {tx.paymentChannel === 'QRPh' ? (
                              <QrCode className="w-3 h-3" />
                            ) : (
                              <Banknote className="w-3 h-3" />
                            )}
                            Pay Balance
                          </button>
                        )}

                        {canStopTimer && (
                          <button
                            type="button"
                            onClick={() => store.stopTimer(tx.transactionID)}
                            className="px-2.5 py-1 rounded-lg bg-gray-900 hover:bg-black text-white text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1"
                            title="Stop timer for early checkout"
                          >
                            <Square className="w-2.5 h-2.5 fill-current" />
                            Stop
                          </button>
                        )}

                        {isTimedOutlet && tx.transactionStatus !== 'void' && (
                          <button
                            type="button"
                            onClick={() => handleOpenExtend(tx)}
                            className="px-2.5 py-1 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-[#1A1A1A] text-[11px] font-semibold cursor-pointer"
                            title="Extend session hours"
                          >
                            Extend
                          </button>
                        )}

                        {tx.outletSlug === 'fnb' && (
                          <button
                            type="button"
                            onClick={() => {
                              const child = store.getOutletChildData('fnb_transactions', tx.outletRefId);
                              setReceiptTx({ tx, fnb: child });
                            }}
                            className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 cursor-pointer"
                            title="Kitchen receipt"
                          >
                            <UtensilsCrossed className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {tx.transactionStatus !== 'void' && (
                          <button
                            type="button"
                            onClick={() => {
                              setVoidReason('Customer cancelled');
                              setVoidNote('');
                              setVoidingTx(tx);
                            }}
                            className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                            title="Request void"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile List Item View */}
      <div className="md:hidden divide-y divide-gray-100">
        {rows.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">No transactions found.</div>
        ) : (
          rows.map((tx) => {
            const timerInfo = formatRemainingCountdown(tx.timerEndsAt, nowMs);
            const hasBalance = tx.balanceDue > 0 || tx.transactionStatus === 'pending';
            const canStopTimer =
              isTimedOutlet &&
              Boolean(tx.timerEndsAt) &&
              !tx.timerStoppedAt &&
              !timerInfo.isExpired &&
              tx.transactionStatus !== 'void';
            const canEdit =
              tx.transactionStatus !== 'void' &&
              (isFrontDeskAdmin || tx.transactionStatus === 'pending');

            return (
              <div key={tx.transactionID} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-[#1A1A1A] truncate">{tx.customerName}</div>
                    <div className="text-xs text-gray-500 truncate mt-0.5">{tx.outletService}</div>
                    {isTimedOutlet && (tx.timerStoppedAt || tx.timerEndsAt) && (
                      <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#FFE27A]/50 text-[#1A1A1A] font-mono text-[11px] font-bold">
                        <Timer className="w-3 h-3" />
                        {tx.timerStoppedAt
                          ? 'Stopped'
                          : timerInfo.isExpired
                          ? 'Expired'
                          : timerInfo.label}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-extrabold text-sm text-[#1A1A1A] tabular-nums">
                      ₱{tx.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </div>
                    {tx.balanceDue > 0 && tx.transactionStatus !== 'void' && (
                      <div className="text-[11px] font-bold text-[#FF5252] tabular-nums">
                        Bal: ₱{tx.balanceDue.toFixed(2)}
                      </div>
                    )}
                    <div className="mt-1">
                      <StatusChip status={tx.transactionStatus} size="sm" />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-1.5 border-t border-gray-100 text-xs">
                  <button
                    type="button"
                    onClick={() => setDetailTx(tx)}
                    className="px-2.5 py-1 rounded-lg bg-gray-100 text-[#1A1A1A] font-medium inline-flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" />
                    Details
                  </button>
                  {hasBalance && tx.transactionStatus !== 'void' && (
                    <button
                      type="button"
                      onClick={() => handlePayBalance(tx)}
                      className="px-2.5 py-1 rounded-lg bg-[#FFE27A] text-[#1A1A1A] font-bold"
                    >
                      Pay Balance
                    </button>
                  )}
                  {canStopTimer && (
                    <button
                      type="button"
                      onClick={() => store.stopTimer(tx.transactionID)}
                      className="px-2.5 py-1 rounded-lg bg-gray-900 text-white font-semibold"
                    >
                      Stop
                    </button>
                  )}
                  {isTimedOutlet && tx.transactionStatus !== 'void' && (
                    <button
                      type="button"
                      onClick={() => handleOpenExtend(tx)}
                      className="px-2.5 py-1 rounded-lg bg-white border border-gray-300 text-[#1A1A1A] font-semibold"
                    >
                      Extend
                    </button>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleStartEdit(tx)}
                      className="px-2.5 py-1 rounded-lg bg-gray-100 text-[#1A1A1A] font-semibold"
                    >
                      Edit
                    </button>
                  )}
                  {tx.transactionStatus !== 'void' && (
                    <button
                      type="button"
                      onClick={() => {
                        setVoidReason('Customer cancelled');
                        setVoidNote('');
                        setVoidingTx(tx);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 font-semibold ml-auto"
                    >
                      Void
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <SidebarShell
      brandSubLabel={outlet.name}
      navItems={navItems}
      activeNavId={activeNav}
      onSelectNav={(id) => {
        setActiveNav(id as any);
        setViewMode('main');
      }}
      user={user}
      onOpenProfile={onOpenProfile}
      onLogout={onLogout}
      topBanner={topBanner}
      sidebarExtra={sidebarExtra}
    >
      {editLockError && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold">
          {editLockError}
        </div>
      )}

      {bannerNotice && (
        <div
          className={`mb-4 p-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 ${
            bannerNotice.type === 'warn'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-[#FFE27A] border-[#1A1A1A]/15 text-[#1A1A1A]'
          }`}
        >
          <span>{bannerNotice.text}</span>
          <button
            type="button"
            onClick={() => setBannerNotice(null)}
            className="text-xs font-bold opacity-70 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* UNAVOIDABLE BLOCKING TIMER EXPIRY OVERLAY (Revision 002) */}
      {expiredTimedTxs.length > 0 && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="expired-timer-heading"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 border-2 border-[#FF5252] shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#FF5252] text-[#1A1A1A] flex items-center justify-center shrink-0">
                <Bell className="w-6 h-6" />
              </div>
              <div>
                <span className="inline-block px-2 py-0.5 rounded-md bg-[#FFE27A] text-[#1A1A1A] text-[10px] font-extrabold uppercase tracking-wider">
                  Action Required
                </span>
                <h2 id="expired-timer-heading" className="text-lg font-extrabold text-[#1A1A1A] mt-1">
                  Session Timer Expired
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Acknowledge or extend expired timed sessions before continuing outlet operations.
                </p>
              </div>
            </div>

            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {expiredTimedTxs.map((tx) => (
                <div
                  key={tx.transactionID}
                  className="p-4 rounded-2xl bg-[#FFE27A] border border-[#1A1A1A]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-extrabold text-[#1A1A1A] text-sm">{tx.customerName}</div>
                    <div className="font-semibold text-[#1A1A1A]/80 mt-0.5">
                      {tx.outletName} · {tx.outletService}
                    </div>
                    <div className="font-mono text-[11px] text-[#1A1A1A]/70 mt-0.5">
                      {tx.transactionID}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenExtend(tx)}
                      className="px-3.5 py-2 rounded-xl bg-white text-[#1A1A1A] font-semibold cursor-pointer"
                    >
                      Extend
                    </button>
                    <button
                      type="button"
                      onClick={() => store.acknowledgeTimer(tx.transactionID)}
                      className="px-4 py-2 rounded-xl bg-[#FF5252] hover:bg-[#ff3b3b] text-[#1A1A1A] font-bold cursor-pointer"
                    >
                      Acknowledge
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE: CREATE TRANSACTION */}
      {viewMode === 'create' && outlet.slug !== 'fnb' ? (
        <OutletTransactionForm
          outlet={outlet}
          user={user}
          onSuccess={handleTransactionCreated}
          onCancel={() => setViewMode('main')}
        />
      ) : viewMode === 'pos' && outlet.slug === 'fnb' ? (
        <PosTerminal
          user={user}
          onTransactionCreated={loadData}
          onBackToFnb={() => setViewMode('main')}
        />
      ) : activeNav === 'dashboard' ? (
        /* TAB 1: DASHBOARD */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-[#1A1A1A]">
                {outlet.name}
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {todayFormatted} · {isFrontDeskAdmin ? 'Front-Desk (Admin)' : `${outlet.name} clerk`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {headerExtra}
              {outlet.slug === 'fnb' ? (
                <button
                  type="button"
                  onClick={() => setViewMode('pos')}
                  className="px-4 py-2.5 rounded-xl bg-[#FF5252] hover:bg-[#ff3b3b] text-[#1A1A1A] text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer min-h-[42px]"
                >
                  <UtensilsCrossed className="w-4 h-4" />
                  Open POS
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setViewMode('create')}
                  className="px-4 py-2.5 rounded-xl bg-[#FF5252] hover:bg-[#ff3b3b] text-[#1A1A1A] text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer min-h-[42px]"
                >
                  <Plus className="w-4 h-4" />
                  Create transaction
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile
              label="Today's sales"
              value={`₱${totalSales.toLocaleString()}`}
              sub={`${transactions.length} transactions`}
              isHighlight={true}
            />
            <StatTile
              label="Paid"
              value={paidTransactions.length}
              sub={`₱${totalSales.toLocaleString()} collected`}
            />
            <StatTile
              label="Pending"
              value={pendingTransactions.length}
              sub={`₱${pendingAmount.toLocaleString()} balance`}
            />
            {renderOperationalTile()}
          </div>

          {renderTransactionTable(filteredTransactions.slice(0, 8), false)}
        </div>
      ) : activeNav === 'history' ? (
        /* TAB 2: HISTORY */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-[#1A1A1A]">
                Transaction history
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {todayFormatted} · {outlet.name}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {headerExtra}
              <button
                type="button"
                onClick={handleHeaderRequestVoid}
                disabled={transactions.filter((t) => t.transactionStatus !== 'void').length === 0}
                className="px-4 py-2.5 rounded-xl bg-white border border-gray-300 text-xs font-semibold text-[#1A1A1A] hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 min-h-[42px]"
              >
                Request void
              </button>
              {outlet.slug === 'fnb' ? (
                <button
                  type="button"
                  onClick={() => setViewMode('pos')}
                  className="px-4 py-2.5 rounded-xl bg-[#FF5252] hover:bg-[#ff3b3b] text-[#1A1A1A] text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer min-h-[42px]"
                >
                  <UtensilsCrossed className="w-4 h-4" />
                  Open POS
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setViewMode('create')}
                  className="px-4 py-2.5 rounded-xl bg-[#FF5252] hover:bg-[#ff3b3b] text-[#1A1A1A] text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer min-h-[42px]"
                >
                  <Plus className="w-4 h-4" />
                  Create transaction
                </button>
              )}
            </div>
          </div>

          {renderTransactionTable(filteredTransactions, true)}
        </div>
      ) : (
        /* TAB 3: VOID REQUESTS */
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-[#1A1A1A]">
                Void requests
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Deletion requests sent to Accountant for approval ({outlet.name})
              </p>
            </div>
            {headerExtra}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200/90 overflow-hidden">
            {voidRequests.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">
                No void requests submitted from this outlet yet.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {voidRequests.map((v) => (
                  <div
                    key={v.id}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-[#1A1A1A] font-mono">
                        {v.transactionId} · ₱{v.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-gray-600 mt-0.5">
                        Reason: {v.reason} {v.note ? `— ${v.note}` : ''}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        Requested by {v.requestedByName} · {new Date(v.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold capitalize self-start sm:self-center ${
                        v.status === 'approved'
                          ? 'bg-[#FF5252] text-[#1A1A1A]'
                          : v.status === 'rejected'
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-[#FFE27A] text-[#1A1A1A]'
                      }`}
                    >
                      {v.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* INITIAL CASH DOWN PAYMENT MODAL (Rev 002 Two-Step Fix + Void on Cancel) */}
      {initialCashDownTx && (
        <InitialDownPaymentCashModal
          transaction={initialCashDownTx}
          defaultReceiver={user.name.split(' (')[0]}
          onConfirmed={(settled) => {
            setInitialCashDownTx(null);
            showNotice(
              'info',
              `Initial Cash down payment of ₱${settled.toLocaleString('en-PH', {
                minimumFractionDigits: 2,
              })} recorded. Remaining balance stays pending.`
            );
          }}
          onCancelledAndVoided={(txId) => {
            setInitialCashDownTx(null);
            showNotice('warn', `Transaction ${txId} was voided because initial down payment was cancelled.`);
          }}
        />
      )}

      {/* PAY REMAINING BALANCE MODAL (Supports Cash / QRPh Mode Switching) */}
      {payBalanceTx && (
        <PayBalanceModal
          transaction={payBalanceTx}
          defaultReceiver={user.name.split(' (')[0]}
          onClose={() => setPayBalanceTx(null)}
          onCashPaid={() => {
            loadData();
            showNotice('info', `Payment recorded for ${payBalanceTx.transactionID}.`);
          }}
          onLaunchQrPh={(updatedTx) => {
            setQrModalTx(updatedTx);
          }}
        />
      )}

      {/* EXTEND SESSION HOURS MODAL */}
      {extendTx && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/75 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-gray-200 shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-[#1A1A1A]">Extend session hours</h3>
              <p className="text-xs text-gray-500 mt-0.5 font-mono">
                {extendTx.transactionID} · {extendTx.customerName}
              </p>
            </div>

            <form onSubmit={handleConfirmExtend} className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-[#F7F7F7] border border-gray-200 space-y-1">
                <div className="flex justify-between text-gray-600">
                  <span>Remembered hourly rate</span>
                  <span className="font-bold text-[#1A1A1A] tabular-nums">
                    ₱{(extendTx.hourlyRate || 0).toLocaleString()}/hr
                  </span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Added charge ({extendHours}h)</span>
                  <span className="font-bold text-[#1A1A1A] tabular-nums">
                    +₱{((extendTx.hourlyRate || 0) * extendHours).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-600 mb-1.5">Additional hours</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setExtendHours(h)}
                      className={`px-3.5 py-2 rounded-xl border text-xs font-bold cursor-pointer ${
                        extendHours === h
                          ? 'bg-[#FFE27A] border-[#1A1A1A]/30 text-[#1A1A1A]'
                          : 'bg-white border-gray-300 text-gray-600'
                      }`}
                    >
                      +{h} hr
                    </button>
                  ))}
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={extendHours}
                    onChange={(e) => setExtendHours(Math.max(1, Number(e.target.value)))}
                    className="w-20 px-3 py-2 rounded-xl border border-gray-300 font-bold tabular-nums text-center"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FFE27A] text-[#1A1A1A] flex justify-between items-baseline">
                <span className="font-semibold">New total payable</span>
                <span className="text-lg font-extrabold tabular-nums">
                  ₱
                  {(
                    extendTx.totalAmount +
                    calculateDiscountBreakdown(
                      (extendTx.hourlyRate || 0) * extendHours,
                      extendTx.discountApplied
                    ).totalAmount
                  ).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setExtendTx(null)}
                  className="py-2.5 px-4 rounded-xl bg-white border border-gray-300 text-[#1A1A1A] font-semibold cursor-pointer min-h-[42px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-4 rounded-xl bg-[#FF5252] hover:bg-[#ff3b3b] text-[#1A1A1A] font-bold cursor-pointer min-h-[42px]"
                >
                  Confirm extension
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REQUEST VOID MODAL */}
      {voidingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-gray-200 shadow-2xl">
            <h3 className="text-base font-extrabold text-[#1A1A1A]">Request void</h3>

            <div className="mt-3 p-3.5 rounded-xl bg-[#FFE27A] text-[#1A1A1A] text-xs">
              <div className="font-bold font-mono">
                {voidingTx.transactionID} · {voidingTx.customerName}
              </div>
              <div className="text-[#1A1A1A]/80 mt-0.5">
                {voidingTx.outletService} · ₱
                {voidingTx.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })} ·{' '}
                <span className="capitalize">{voidingTx.transactionStatus}</span>
              </div>
            </div>

            <form onSubmit={handleSubmitVoid} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-gray-600 mb-1">Reason</label>
                <select
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-white text-[#1A1A1A] outline-none"
                  required
                >
                  <option value="Customer cancelled">Customer cancelled</option>
                  <option value="Duplicate entry">Duplicate entry</option>
                  <option value="Incorrect service selected">Incorrect service selected</option>
                  <option value="Other adjustment">Other adjustment</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-600 mb-1">Notes (optional)</label>
                <textarea
                  value={voidNote}
                  onChange={(e) => setVoidNote(e.target.value)}
                  placeholder="Add a short note for the Accountant"
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-[#1A1A1A] outline-none"
                />
              </div>

              <p className="text-[11px] text-gray-500">
                Sent to Accountant for approval. The transaction is kept until approved.
              </p>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setVoidingTx(null)}
                  className="py-2.5 px-4 rounded-xl bg-white border border-gray-300 text-[#1A1A1A] font-semibold cursor-pointer min-h-[42px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-4 rounded-xl bg-[#FF5252] hover:bg-[#ff3b3b] text-[#1A1A1A] font-bold cursor-pointer min-h-[42px]"
                >
                  Send request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TRANSACTION MODAL (Clerk Pending Direct OR Front-Desk Accountant Approval Request) */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-gray-200 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <div>
                <h3 className="text-base font-extrabold text-[#1A1A1A]">
                  {isFrontDeskAdmin ? 'Request transaction edit' : 'Edit pending transaction'}
                </h3>
                <p className="text-[11px] text-gray-500 font-mono">
                  {editingTx.transactionID}{' '}
                  {isFrontDeskAdmin ? '· Requires Accountant approval' : '· 120s edit lock active'}
                </p>
              </div>
              <button type="button" onClick={handleCancelEdit} className="text-gray-400 hover:text-[#1A1A1A] cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-gray-600 font-semibold mb-1">Customer name</label>
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
                  <label className="block text-gray-600 font-semibold mb-1">Selling price (₱)</label>
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
                  <label className="block text-gray-600 font-semibold mb-1">Discount (20% SC/PWD)</label>
                  <div className="flex p-1 bg-gray-100 rounded-xl gap-1">
                    <button
                      type="button"
                      onClick={() => setEditDiscountApplied(false)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                        !editDiscountApplied ? 'bg-white text-[#1A1A1A] shadow-2xs' : 'text-gray-600'
                      }`}
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditDiscountApplied(true)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                        editDiscountApplied ? 'bg-[#FFE27A] text-[#1A1A1A] font-bold shadow-2xs' : 'text-gray-600'
                      }`}
                    >
                      Yes
                    </button>
                  </div>
                </div>
              </div>

              {isFrontDeskAdmin && (
                <>
                  <div>
                    <label className="block text-gray-600 font-semibold mb-1">Target status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as TransactionStatus)}
                      className="w-full p-2.5 rounded-xl border border-gray-300 bg-white"
                    >
                      <option value="paid">Paid</option>
                      <option value="pending">Pending</option>
                      <option value="void">Void</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-600 font-semibold mb-1">Reason / Audit note *</label>
                    <textarea
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      placeholder="Explain why this transaction needs adjustment"
                      rows={2}
                      className="w-full p-2.5 rounded-xl border border-gray-300"
                      required
                    />
                  </div>
                </>
              )}

              <div className="p-3 bg-[#FFE27A] rounded-xl flex justify-between font-bold text-[#1A1A1A]">
                <span>Revised total</span>
                <span className="tabular-nums">
                  ₱
                  {calculateDiscountBreakdown(editAmount, editDiscountApplied).totalAmount.toLocaleString(
                    'en-PH',
                    { minimumFractionDigits: 2 }
                  )}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="py-2.5 px-4 rounded-xl bg-white border border-gray-300 text-[#1A1A1A] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-4 rounded-xl bg-[#FF5252] text-[#1A1A1A] font-bold cursor-pointer"
                >
                  {isFrontDeskAdmin ? 'Submit for approval' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UNIVERSAL TRANSACTION DETAILS MODAL (EYE ICON) */}
      {detailTx && (
        <TransactionDetailsModal transaction={detailTx} onClose={() => setDetailTx(null)} />
      )}

      {qrModalTx && (
        <QrPhModal
          transaction={qrModalTx}
          onClose={() => setQrModalTx(null)}
          onSuccess={(msg) => {
            loadData();
            if (msg) showNotice('info', msg);
          }}
          onVoidCancelledInitial={(txId) => {
            loadData();
            showNotice('warn', `Transaction ${txId} was voided because initial QR Ph down payment was cancelled.`);
          }}
        />
      )}

      {receiptTx && (
        <ReceiptModal
          transaction={receiptTx.tx}
          fnbData={receiptTx.fnb}
          onClose={() => setReceiptTx(null)}
        />
      )}
    </SidebarShell>
  );
};
