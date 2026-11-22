import React, { useState, useEffect } from 'react';
import {
  User,
  Outlet,
  MasterTransaction,
  OutletSlug,
  TransactionStatus,
} from '../../types';
import { store } from '../../db/store';
import { SidebarShell, SidebarNavItem } from '../common/SidebarShell';
import { StatTile } from '../common/StatTile';
import { StatusChip } from '../common/StatusChip';
import { TransactionDetailsModal } from '../common/TransactionDetailsModal';
import {
  LayoutGrid,
  UserCheck,
  Building2,
  Edit3,
  XCircle,
  Plus,
  ChevronDown,
  Eye,
} from 'lucide-react';

interface AdminDashboardProps {
  adminUser: User;
  onSelectOutlet: (outletSlug: OutletSlug) => void;
  onOpenProfile: () => void;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  adminUser,
  onSelectOutlet,
  onOpenProfile,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'approvals' | 'outlets'>('dashboard');

  const [transactions, setTransactions] = useState<MasterTransaction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  // Filtering
  const [txStatusFilter, setTxStatusFilter] = useState<'all' | TransactionStatus>('all');
  const [txSearch, setTxSearch] = useState('');

  // Transaction Details (Eye icon)
  const [detailTx, setDetailTx] = useState<MasterTransaction | null>(null);

  // Edit Request modal (Front-Desk -> Accountant Approval per Rev 002)
  const [editingTx, setEditingTx] = useState<MasterTransaction | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editDiscount, setEditDiscount] = useState<number>(0);
  const [editStatus, setEditStatus] = useState<TransactionStatus>('paid');
  const [editCustomer, setEditCustomer] = useState<string>('');
  const [editNote, setEditNote] = useState<string>('');

  // Void Request modal (Front-Desk -> Accountant Approval per Rev 002)
  const [voidingTx, setVoidingTx] = useState<MasterTransaction | null>(null);
  const [voidReason, setVoidReason] = useState<string>('Customer cancelled');
  const [voidNote, setVoidNote] = useState<string>('');

  // Dynamic Outlet / Service creation (FR88)
  const [showAddOutlet, setShowAddOutlet] = useState(false);
  const [newOutletName, setNewOutletName] = useState('');
  const [newOutletDesc, setNewOutletDesc] = useState('');
  const [newOutletCategory, setNewOutletCategory] = useState<Outlet['category']>('sports');
  const [newOutletTemplate, setNewOutletTemplate] = useState('generic');

  const [serviceModalOutlet, setServiceModalOutlet] = useState<Outlet | null>(null);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState<number>(300);

  const loadData = () => {
    setTransactions(store.getTransactions());
    setUsers(store.getUsers());
    setOutlets(store.getOutlets());
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
    }, 5000);
  };

  const totalGrossSales = transactions
    .filter((t) => t.transactionStatus === 'paid')
    .reduce((acc, t) => acc + t.totalAmount, 0);

  const pendingBalancesTotal = transactions
    .filter((t) => t.transactionStatus === 'pending')
    .reduce((acc, t) => acc + (t.balanceDue > 0 ? t.balanceDue : t.totalAmount), 0);

  const pendingCount = transactions.filter((t) => t.transactionStatus === 'pending').length;
  const pendingUsers = users.filter((u) => u.approvalStatus === 'pending');

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const filteredTransactions = transactions.filter((t) => {
    const matchesStatus = txStatusFilter === 'all' || t.transactionStatus === txStatusFilter;
    const matchesSearch =
      !txSearch ||
      t.transactionID.toLowerCase().includes(txSearch.toLowerCase()) ||
      t.customerName.toLowerCase().includes(txSearch.toLowerCase()) ||
      t.outletName.toLowerCase().includes(txSearch.toLowerCase()) ||
      t.outletService.toLowerCase().includes(txSearch.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const navItems: SidebarNavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'approvals', label: 'Approvals', icon: UserCheck, badge: pendingUsers.length },
    { id: 'outlets', label: 'Outlets', icon: Building2 },
  ];

  const handleSubmitFrontDeskEditRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx || !editNote.trim()) return;
    store.createEditRequest(
      editingTx.transactionID,
      adminUser.id,
      adminUser.name,
      {
        customerName: editCustomer,
        transactionAmount: editAmount,
        discount: editDiscount,
        totalAmount: Math.max(0, editAmount - editDiscount),
        transactionStatus: editStatus,
      },
      editNote.trim(),
      'admin'
    );
    showNotice(`Edit request for ${editingTx.transactionID} sent to Accountant for approval.`);
    setEditingTx(null);
  };

  const handleSubmitFrontDeskVoidRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidingTx || !voidReason) return;
    store.createVoidRequest(
      voidingTx.transactionID,
      adminUser.id,
      adminUser.name,
      adminUser.role,
      voidReason,
      voidNote
    );
    showNotice(`Void request for ${voidingTx.transactionID} sent to Accountant for approval.`);
    setVoidingTx(null);
  };

  const handleCreateOutlet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOutletName) return;
    store.addOutlet(newOutletName, newOutletDesc || 'Custom outlet', newOutletCategory, newOutletTemplate);
    setShowAddOutlet(false);
    setNewOutletName('');
    setNewOutletDesc('');
  };

  const handleAddServiceToOutlet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceModalOutlet || !newServiceName) return;
    store.addService(serviceModalOutlet.id, newServiceName, newServicePrice);
    setNewServiceName('');
    setNewServicePrice(300);
  };

  const frontDeskOutlets = store.getFrontDeskOutlets();

  const sidebarOutletSelector = (
    <div className="px-1 pt-0.5 space-y-1.5">
      <div className="px-2.5 text-[10px] font-extrabold uppercase tracking-wider text-[#1A1A1A]/60">
        Outlet Selector
      </div>
      <div className="relative">
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) onSelectOutlet(e.target.value as OutletSlug);
          }}
          aria-label="Outlet Selector"
          className="w-full px-3.5 py-2.5 pr-8 rounded-xl bg-white/85 hover:bg-white text-[#1A1A1A] font-bold text-xs appearance-none cursor-pointer outline-none border border-[#1A1A1A]/10 shadow-2xs"
        >
          <option value="" disabled>
            Select an outlet...
          </option>
          {frontDeskOutlets.map((o) => (
            <option key={o.id} value={o.slug} className="bg-white text-[#1A1A1A]">
              {o.name}
            </option>
          ))}
        </select>
        <ChevronDown className="w-4 h-4 text-[#1A1A1A] absolute right-2.5 top-2.5 pointer-events-none" />
      </div>
    </div>
  );

  return (
    <SidebarShell
      brandSubLabel="Front-Desk"
      navItems={navItems}
      activeNavId={activeTab}
      onSelectNav={(id) => setActiveTab(id as any)}
      user={adminUser}
      onOpenProfile={onOpenProfile}
      onLogout={onLogout}
      sidebarExtra={sidebarOutletSelector}
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

      {/* TAB 1: DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-[#1A1A1A]">
                Front-Desk dashboard
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">All outlets · {todayFormatted}</p>
            </div>
          </div>

          {/* 4-Tile Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile
              label="All outlets today"
              value={`₱${totalGrossSales.toLocaleString()}`}
              sub={`${transactions.length} transactions`}
              isHighlight={true}
            />
            <StatTile
              label="Pending accounts"
              value={pendingUsers.length}
              sub="New staff approvals"
            />
            <StatTile
              label="Pending balances"
              value={`₱${pendingBalancesTotal.toLocaleString()}`}
              sub={`${pendingCount} open tickets`}
            />
            <StatTile
              label="Managed outlets"
              value={frontDeskOutlets.length}
              sub="Use sidebar selector"
            />
          </div>

          {/* Central Transactions Table */}
          <div className="bg-white rounded-2xl border border-gray-200/90 overflow-hidden">
            <div className="p-4 sm:px-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-sm font-bold text-[#1A1A1A]">Central transactions</div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  placeholder="Search ID, customer, outlet..."
                  className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-[#1A1A1A] outline-none w-48"
                />
                <div className="inline-flex p-1 bg-gray-100 rounded-xl gap-0.5">
                  {(['all', 'paid', 'pending', 'void'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setTxStatusFilter(st)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize cursor-pointer ${
                        txStatusFilter === st
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
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.transactionID} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-3.5 px-6 font-mono text-gray-500 whitespace-nowrap">
                        {tx.transactionID}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#1A1A1A]">{tx.customerName}</td>
                      <td className="py-3.5 px-4 text-gray-600 max-w-xs truncate">
                        <span className="font-semibold text-[#1A1A1A]">{tx.outletName.split(' ')[0]}</span> ·{' '}
                        {tx.outletService}
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
                      <td className="py-3.5 px-6 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setDetailTx(tx)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-[#1A1A1A] hover:bg-gray-100 cursor-pointer"
                            title="View transaction details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {tx.transactionStatus !== 'void' && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTx(tx);
                                setEditAmount(tx.transactionAmount);
                                setEditDiscount(tx.discount);
                                setEditStatus(tx.transactionStatus);
                                setEditCustomer(tx.customerName);
                                setEditNote('');
                              }}
                              className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 cursor-pointer"
                              title="Request transaction edit (Accountant approval)"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {tx.transactionStatus !== 'void' && (
                            <button
                              type="button"
                              onClick={() => {
                                setVoidingTx(tx);
                                setVoidReason('Customer cancelled');
                                setVoidNote('');
                              }}
                              className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                              title="Request void (Accountant approval)"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ACCOUNT APPROVALS (FR81) */}
      {activeTab === 'approvals' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#1A1A1A]">
              Account approvals
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Approve or disapprove new staff accounts
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200/90 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 text-sm font-bold text-[#1A1A1A]">
              Pending accounts
            </div>

            {pendingUsers.length === 0 ? (
              <div className="py-10 text-center text-xs text-gray-400">
                No pending staff registrations at this time.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {pendingUsers.map((u) => (
                  <div
                    key={u.id}
                    className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-6 flex-1">
                      <span className="font-bold text-[#1A1A1A]">{u.name}</span>
                      <span className="text-gray-500 font-mono truncate">{u.email}</span>
                      <span className="text-gray-700 font-medium">{u.outletName || 'General Staff'}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => store.updateUserApproval(u.id, 'rejected')}
                        className="px-4 py-2 rounded-xl bg-white border border-gray-300 text-[#1A1A1A] font-semibold text-xs hover:bg-gray-50 cursor-pointer"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => store.updateUserApproval(u.id, 'approved')}
                        className="px-4 py-2 rounded-xl bg-[#FF5252] hover:bg-[#ff3b3b] text-[#1A1A1A] font-bold text-xs cursor-pointer"
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* All Registered Staff Directory */}
          <div className="bg-white rounded-2xl border border-gray-200/90 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 text-sm font-bold text-[#1A1A1A]">
              Approved &amp; decided accounts
            </div>
            <div className="divide-y divide-gray-100">
              {users
                .filter((u) => u.approvalStatus !== 'pending')
                .map((u) => (
                  <div key={u.id} className="px-6 py-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-[#1A1A1A]">{u.name}</span>
                      <span className="text-gray-400 ml-2 font-mono">{u.email}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500">{u.outletName || u.role}</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize ${
                          u.approvalStatus === 'approved'
                            ? 'bg-[#FFE27A] text-[#1A1A1A]'
                            : 'bg-[#FF5252] text-[#1A1A1A]'
                        }`}
                      >
                        {u.approvalStatus}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: OUTLETS AND SERVICES (FR88 - Use template button removed per Rev 002) */}
      {activeTab === 'outlets' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-[#1A1A1A]">
                Outlets and services
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Add outlets and services across Cafe Lupe
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setNewOutletTemplate('generic');
                  setShowAddOutlet(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-[#FF5252] hover:bg-[#ff3b3b] text-[#1A1A1A] text-xs font-bold cursor-pointer min-h-[42px]"
              >
                Add outlet
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200/90 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 text-sm font-bold text-[#1A1A1A]">
              Outlets
            </div>
            <div className="divide-y divide-gray-100">
              {outlets.map((o) => {
                const serviceCount = store.getServices(o.id).length;
                return (
                  <div
                    key={o.id}
                    className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="font-bold text-[#1A1A1A] min-w-[200px]">{o.name}</div>
                    <div className="text-gray-500">{serviceCount} services</div>
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#FFE27A] text-[#1A1A1A] font-bold text-[11px]">
                        Active
                      </span>
                      <button
                        type="button"
                        onClick={() => setServiceModalOutlet(o)}
                        className="px-3 py-1.5 rounded-xl bg-white border border-gray-300 text-[#1A1A1A] font-semibold hover:bg-gray-50 cursor-pointer"
                      >
                        Edit services
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Front-Desk Edit Request Modal (Requires Accountant Approval per Rev 002) */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-gray-200 shadow-2xl">
            <h3 className="text-base font-extrabold text-[#1A1A1A]">
              Request transaction edit ({editingTx.transactionID})
            </h3>
            <p className="text-xs text-gray-500 mt-0.5 mb-4">
              Sent to Accountant for approval before changes apply
            </p>
            <form onSubmit={handleSubmitFrontDeskEditRequest} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-600 mb-1">Customer</label>
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
                <label className="block font-semibold text-gray-600 mb-1">Target status</label>
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
              <div>
                <label className="block font-semibold text-gray-600 mb-1">Audit note *</label>
                <textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Explain the adjustment for Accountant approval"
                  rows={2}
                  className="w-full p-2.5 rounded-xl border border-gray-300"
                  required
                />
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
                  Submit request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Front-Desk Void Request Modal (Requires Accountant Approval per Rev 002) */}
      {voidingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-gray-200 shadow-2xl">
            <h3 className="text-base font-extrabold text-[#1A1A1A]">Request void</h3>
            <div className="mt-3 p-3.5 rounded-xl bg-[#FFE27A] text-[#1A1A1A] text-xs">
              <div className="font-bold font-mono">
                {voidingTx.transactionID} · {voidingTx.customerName}
              </div>
              <div className="text-[#1A1A1A]/80 mt-0.5">
                {voidingTx.outletName} · ₱{voidingTx.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <form onSubmit={handleSubmitFrontDeskVoidRequest} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-600 mb-1">Reason *</label>
                <select
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-300 bg-white"
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
                  className="w-full p-2.5 rounded-xl border border-gray-300"
                />
              </div>
              <p className="text-[11px] text-gray-500">
                Sent to Accountant for approval. Transactions remain recorded until approved.
              </p>
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setVoidingTx(null)}
                  className="py-2.5 rounded-xl bg-white border border-gray-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2.5 rounded-xl bg-[#FF5252] text-[#1A1A1A] font-bold cursor-pointer"
                >
                  Send request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Outlet Modal (FR88) */}
      {showAddOutlet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-gray-200 shadow-2xl">
            <h3 className="text-base font-extrabold text-[#1A1A1A] mb-4">Add outlet</h3>
            <form onSubmit={handleCreateOutlet} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-600 mb-1">Outlet name</label>
                <input
                  type="text"
                  value={newOutletName}
                  onChange={(e) => setNewOutletName(e.target.value)}
                  placeholder="e.g. Badminton Court"
                  className="w-full p-2.5 rounded-xl border border-gray-300"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-600 mb-1">Description</label>
                <input
                  type="text"
                  value={newOutletDesc}
                  onChange={(e) => setNewOutletDesc(e.target.value)}
                  placeholder="Hourly court rentals"
                  className="w-full p-2.5 rounded-xl border border-gray-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-600 mb-1">Template</label>
                <select
                  value={newOutletTemplate}
                  onChange={(e) => setNewOutletTemplate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-300 bg-white"
                >
                  <option value="generic">From scratch (generic_transactions)</option>
                  <option value="pickleball">Hourly court rental template</option>
                  <option value="fnb">F&amp;B POS template</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddOutlet(false)}
                  className="py-2.5 rounded-xl bg-white border border-gray-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2.5 rounded-xl bg-[#FF5252] text-[#1A1A1A] font-bold cursor-pointer"
                >
                  Create outlet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Outlet Services Modal (FR88) */}
      {serviceModalOutlet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-gray-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-[#1A1A1A]">
                  {serviceModalOutlet.name} services
                </h3>
                <p className="text-[11px] text-gray-500">Preset dropdown items (FR88)</p>
              </div>
              <button
                type="button"
                onClick={() => setServiceModalOutlet(null)}
                className="text-gray-400 hover:text-[#1A1A1A] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="max-h-44 overflow-y-auto divide-y divide-gray-100 text-xs">
              {store.getServices(serviceModalOutlet.id).map((s) => (
                <div key={s.id} className="py-2 flex justify-between">
                  <span className="font-medium text-[#1A1A1A]">{s.name}</span>
                  <span className="font-bold tabular-nums">₱{s.defaultPrice.toLocaleString()}</span>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddServiceToOutlet} className="pt-3 border-t border-gray-100 space-y-2.5 text-xs">
              <div className="font-bold text-[#1A1A1A]">Add new service preset</div>
              <input
                type="text"
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                placeholder="Service name"
                className="w-full p-2.5 rounded-xl border border-gray-300"
                required
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  value={newServicePrice}
                  onChange={(e) => setNewServicePrice(Number(e.target.value))}
                  placeholder="Price (₱)"
                  className="w-32 p-2.5 rounded-xl border border-gray-300 font-bold tabular-nums"
                  required
                />
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#FF5252] text-[#1A1A1A] font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add service
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
