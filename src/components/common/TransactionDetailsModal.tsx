import React from 'react';
import { MasterTransaction } from '../../types';
import { store } from '../../db/store';
import { StatusChip } from './StatusChip';
import { Timer, CalendarClock } from 'lucide-react';

interface TransactionDetailsModalProps {
  transaction: MasterTransaction;
  onClose: () => void;
}

function formatFieldLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function formatTimerReadout(tx: MasterTransaction): string {
  if (tx.timerStoppedAt) {
    return `Stopped at ${new Date(tx.timerStoppedAt).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    })}`;
  }
  if (!tx.timerEndsAt) return '—';
  const diffMs = new Date(tx.timerEndsAt).getTime() - Date.now();
  if (diffMs <= 0) return '00:00:00 (Expired)';
  const totalSec = Math.floor(diffMs / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

export const TransactionDetailsModal: React.FC<TransactionDetailsModalProps> = ({
  transaction,
  onClose,
}) => {
  const childData = store.getOutletChildData(transaction.outletRefTable, transaction.outletRefId);
  const installments = store.getInstallments(transaction.transactionID);

  const initialInst = installments.find((i) => i.phase === 'initial');
  const balanceInst = installments.find((i) => i.phase === 'balance');

  const initialMode =
    initialInst?.paymentChannel || transaction.initialPaymentMode || transaction.paymentChannel;
  const balanceMode = balanceInst?.paymentChannel || transaction.balancePaymentMode || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-gray-200 shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-start justify-between border-b border-gray-100 pb-3 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-[#1A1A1A]">Transaction details</h3>
              <StatusChip status={transaction.transactionStatus} size="sm" />
            </div>
            <p className="text-[11px] text-gray-500 font-mono mt-0.5">
              {transaction.transactionID} → {transaction.outletRefTable} ({transaction.outletRefId})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-[#1A1A1A] cursor-pointer text-sm px-1"
            aria-label="Close transaction details"
          >
            ✕
          </button>
        </div>

        {/* Date & Time Banner */}
        <div className="px-4 py-2.5 rounded-xl bg-[#F7F7F7] border border-gray-200/80 flex items-center justify-between text-xs">
          <span className="text-gray-500 flex items-center gap-1.5 font-semibold">
            <CalendarClock className="w-3.5 h-3.5 text-gray-500" />
            Date &amp; Time
          </span>
          <span className="font-mono font-bold text-[#1A1A1A] tabular-nums">
            {new Date(transaction.transactionDateTime).toLocaleString('en-PH', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
        </div>

        {/* Live / Stopped Timer Readout */}
        {(transaction.timerEndsAt || transaction.timerStoppedAt) && (
          <div className="p-3.5 rounded-2xl bg-[#FFE27A] text-[#1A1A1A] flex items-center justify-between">
            <span className="text-xs font-bold flex items-center gap-1.5">
              <Timer className="w-4 h-4" />
              {transaction.timerStoppedAt ? 'Session timer' : 'Remaining session time'}
            </span>
            <span className="font-mono text-sm font-extrabold tabular-nums">
              {formatTimerReadout(transaction)}
            </span>
          </div>
        )}

        {/* Master Summary Fields */}
        <div className="bg-[#F7F7F7] rounded-2xl p-4 space-y-1.5 text-xs">
          <div className="flex justify-between gap-4 border-b border-gray-200/70 pb-1">
            <span className="text-gray-500">Outlet</span>
            <span className="font-bold text-[#1A1A1A] text-right">{transaction.outletName}</span>
          </div>
          <div className="flex justify-between gap-4 border-b border-gray-200/70 pb-1">
            <span className="text-gray-500">Customer</span>
            <span className="font-bold text-[#1A1A1A] text-right">{transaction.customerName}</span>
          </div>
          <div className="flex justify-between gap-4 border-b border-gray-200/70 pb-1">
            <span className="text-gray-500">Service</span>
            <span className="font-bold text-[#1A1A1A] text-right">{transaction.outletService}</span>
          </div>
          <div className="flex justify-between gap-4 border-b border-gray-200/70 pb-1">
            <span className="text-gray-500">Selling Price</span>
            <span className="font-bold text-[#1A1A1A] tabular-nums">
              ₱{transaction.transactionAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between gap-4 border-b border-gray-200/70 pb-1">
            <span className="text-gray-500">Discount ({transaction.discountApplied ? 'Yes' : 'No'})</span>
            <span className="font-bold text-[#1A1A1A] tabular-nums">
              -₱{transaction.discount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between gap-4 border-b border-gray-200/70 pb-1">
            <span className="text-gray-500">Total Payable</span>
            <span className="font-extrabold text-[#1A1A1A] tabular-nums">
              ₱{transaction.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between gap-4 border-b border-gray-200/70 pb-1">
            <span className="text-gray-500">Amount Paid / Balance Due</span>
            <span className="font-bold text-[#1A1A1A] tabular-nums">
              ₱{transaction.amountPaid.toLocaleString('en-PH', { minimumFractionDigits: 2 })} /{' '}
              <span className={transaction.balanceDue > 0 ? 'text-[#FF5252]' : 'text-emerald-700'}>
                ₱{transaction.balanceDue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </span>
            </span>
          </div>
          <div className="flex justify-between gap-4 border-b border-gray-200/70 pb-1">
            <span className="text-gray-500">Payment Arrangement</span>
            <span className="font-bold text-[#1A1A1A]">{transaction.paymentArrangement}</span>
          </div>
          {transaction.cashReceivedBy && (
            <div className="flex justify-between gap-4 border-b border-gray-200/70 pb-1">
              <span className="text-gray-500">Cash Received By</span>
              <span className="font-bold text-[#1A1A1A]">{transaction.cashReceivedBy}</span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Handled By</span>
            <span className="font-medium text-[#1A1A1A]">{transaction.employeeHandler}</span>
          </div>
        </div>

        {/* Individual Payment Modes Breakdown (Revision 002 Requirement #3) */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200 space-y-2 text-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Payment Mode Breakdown (payment_installments)
          </div>
          <div className="flex items-center justify-between gap-3 py-1.5 border-b border-gray-100">
            <div>
              <div className="font-bold text-[#1A1A1A]">
                {transaction.paymentArrangement === 'Down Payment'
                  ? 'Initial Down Payment Mode'
                  : 'Initial Payment Mode'}
              </div>
              <div className="text-[11px] text-gray-500">
                {initialInst
                  ? `${initialInst.status.toUpperCase()}${
                      initialInst.paidAt
                        ? ` · ${new Date(initialInst.paidAt).toLocaleString()}`
                        : ' · Awaiting confirmation'
                    }`
                  : transaction.paidAt
                  ? `Settled · ${new Date(transaction.paidAt).toLocaleString()}`
                  : 'Recorded'}
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="px-2 py-0.5 rounded-md bg-[#FFE27A] text-[#1A1A1A] font-extrabold text-[11px]">
                {initialMode === 'QRPh' ? 'QR Ph' : initialMode}
              </span>
              {initialInst && (
                <div className="font-mono font-bold text-[#1A1A1A] tabular-nums mt-0.5">
                  ₱{initialInst.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </div>
              )}
            </div>
          </div>

          {(transaction.paymentArrangement === 'Down Payment' || balanceInst || balanceMode) && (
            <div className="flex items-center justify-between gap-3 py-1.5">
              <div>
                <div className="font-bold text-[#1A1A1A]">Remaining Balance Payment Mode</div>
                <div className="text-[11px] text-gray-500">
                  {balanceInst
                    ? `${balanceInst.status.toUpperCase()}${
                        balanceInst.paidAt
                          ? ` · ${new Date(balanceInst.paidAt).toLocaleString()}`
                          : ' · Pending settlement'
                      }`
                    : transaction.balanceDue > 0
                    ? 'Awaiting follow-up payment'
                    : 'Not applicable'}
                </div>
              </div>
              <div className="text-right shrink-0">
                {balanceMode ? (
                  <span className="px-2 py-0.5 rounded-md bg-gray-900 text-white font-extrabold text-[11px]">
                    {balanceMode === 'QRPh' ? 'QR Ph' : balanceMode}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 font-bold text-[11px]">
                    Unpaid
                  </span>
                )}
                <div className="font-mono font-bold text-[#1A1A1A] tabular-nums mt-0.5">
                  ₱
                  {(balanceInst ? balanceInst.amount : transaction.balanceDue).toLocaleString('en-PH', {
                    minimumFractionDigits: 2,
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Child Table Specific Attributes */}
        <div className="bg-[#F7F7F7] rounded-2xl p-4 space-y-1.5 font-mono text-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
            Outlet-Specific Details ({transaction.outletRefTable})
          </div>
          {childData ? (
            Object.entries(childData).map(([k, v]) => (
              <div
                key={k}
                className="flex justify-between gap-4 border-b border-gray-200/70 pb-1 last:border-0"
              >
                <span className="text-gray-500">{formatFieldLabel(k)}</span>
                <span className="font-bold text-[#1A1A1A] text-right max-w-xs break-words">
                  {Array.isArray(v)
                    ? v
                        .map((item: any) =>
                          typeof item === 'object'
                            ? `${item.quantity}× ${item.name}${item.variant ? ` (${item.variant})` : ''}`
                            : String(item)
                        )
                        .join(', ')
                    : typeof v === 'object' && v !== null
                    ? JSON.stringify(v)
                    : String(v)}
                </span>
              </div>
            ))
          ) : (
            <div className="text-gray-400">Child record linked.</div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-[#1A1A1A] text-white text-xs font-bold cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
};
