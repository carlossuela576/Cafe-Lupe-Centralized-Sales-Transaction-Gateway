import React, { useState } from 'react';
import { MasterTransaction, PaymentChannel } from '../../types';
import { store } from '../../db/store';
import { Banknote, QrCode, AlertTriangle } from 'lucide-react';

interface InitialDownPaymentCashModalProps {
  transaction: MasterTransaction;
  defaultReceiver: string;
  onConfirmed: (settledAmount: number) => void;
  onCancelledAndVoided: (transactionId: string) => void;
}

export const InitialDownPaymentCashModal: React.FC<InitialDownPaymentCashModalProps> = ({
  transaction,
  defaultReceiver,
  onConfirmed,
  onCancelledAndVoided,
}) => {
  const [cashReceiver, setCashReceiver] = useState(
    transaction.cashReceivedBy || defaultReceiver || transaction.employeeHandler
  );
  const pendingInst = store.getPendingInstallment(transaction.transactionID);
  const downAmount = pendingInst?.amount ?? transaction.totalAmount;
  const remainingAfter = Math.max(0, Math.round((transaction.totalAmount - downAmount) * 100) / 100);

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    const res = store.confirmInitialDownPayment(transaction.transactionID, cashReceiver);
    onConfirmed(res.settledAmount);
  };

  const handleCancelAndVoid = () => {
    store.voidCancelledInitialPayment(transaction.transactionID);
    onCancelledAndVoided(transaction.transactionID);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-gray-200 shadow-2xl space-y-4">
        <div>
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#FFE27A] text-[#1A1A1A] text-[10px] font-extrabold uppercase tracking-wider mb-1.5">
            Initial Down Payment Required
          </span>
          <h3 className="text-base font-extrabold text-[#1A1A1A]">
            Confirm Cash Down Payment
          </h3>
          <p className="text-xs text-gray-500 mt-0.5 font-mono">
            {transaction.transactionID} · {transaction.customerName}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#FFE27A] text-[#1A1A1A] space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span>Total bill</span>
            <span className="font-bold tabular-nums">
              ₱{transaction.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between items-baseline pt-1 border-t border-[#1A1A1A]/15">
            <span className="font-extrabold">Initial Cash Due Now</span>
            <span className="text-xl font-extrabold tabular-nums">
              ₱{downAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between text-[11px] font-semibold text-[#1A1A1A]/75">
            <span>Remaining balance after down payment</span>
            <span className="tabular-nums">
              ₱{remainingAfter.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <form onSubmit={handleConfirm} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Cash received by *
            </label>
            <input
              type="text"
              value={cashReceiver}
              onChange={(e) => setCashReceiver(e.target.value)}
              placeholder="Staff full name"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs text-[#1A1A1A] outline-none"
              required
            />
          </div>

          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-[11px] text-red-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              If the customer cancels or refuses to pay the initial down payment, clicking Cancel &amp; Void will instantly void this transaction.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleCancelAndVoid}
              className="py-2.5 px-4 rounded-xl bg-white border border-gray-300 text-[#1A1A1A] font-semibold text-xs hover:bg-gray-50 cursor-pointer min-h-[42px]"
            >
              Cancel &amp; Void
            </button>
            <button
              type="submit"
              className="py-2.5 px-4 rounded-xl bg-[#FF5252] hover:bg-[#ff3b3b] text-[#1A1A1A] font-bold text-xs cursor-pointer min-h-[42px]"
            >
              Confirm Down Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface PayBalanceModalProps {
  transaction: MasterTransaction;
  defaultReceiver: string;
  onClose: () => void;
  onCashPaid: () => void;
  onLaunchQrPh: (updatedTx: MasterTransaction) => void;
}

export const PayBalanceModal: React.FC<PayBalanceModalProps> = ({
  transaction,
  defaultReceiver,
  onClose,
  onCashPaid,
  onLaunchQrPh,
}) => {
  const [selectedChannel, setSelectedChannel] = useState<PaymentChannel>(transaction.paymentChannel);
  const [cashReceiver, setCashReceiver] = useState(
    transaction.cashReceivedBy || defaultReceiver || transaction.employeeHandler
  );

  const pendingInst = store.getPendingInstallment(transaction.transactionID);
  const isUnconfirmedInitDown =
    Boolean(pendingInst) &&
    pendingInst!.phase === 'initial' &&
    transaction.paymentArrangement === 'Down Payment' &&
    transaction.amountPaid === 0;

  const amountDueNow = isUnconfirmedInitDown
    ? pendingInst!.amount
    : transaction.balanceDue > 0
    ? transaction.balanceDue
    : transaction.totalAmount;

  const handleProceed = (e: React.FormEvent) => {
    e.preventDefault();
    const res = store.payBalance(transaction.transactionID, selectedChannel, cashReceiver);
    if (!res.success) return;

    if (selectedChannel === 'QRPh' && res.transaction) {
      onClose();
      onLaunchQrPh(res.transaction);
      return;
    }

    onCashPaid();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-gray-200 shadow-2xl space-y-4">
        <div>
          <h3 className="text-base font-extrabold text-[#1A1A1A]">
            {isUnconfirmedInitDown ? 'Collect initial down payment' : 'Remaining balance settlement'}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5 font-mono">
            {transaction.transactionID} · {transaction.customerName}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#FFE27A] text-[#1A1A1A] space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span>Total payable</span>
            <span className="font-bold tabular-nums">
              ₱{transaction.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Already paid</span>
            <span className="font-semibold tabular-nums">
              ₱{transaction.amountPaid.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="pt-1.5 border-t border-[#1A1A1A]/15 flex justify-between items-baseline">
            <span className="font-bold">
              {isUnconfirmedInitDown ? 'Initial down payment due' : 'Balance due now'}
            </span>
            <span className="text-xl font-extrabold tabular-nums">
              ₱{amountDueNow.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <form onSubmit={handleProceed} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Payment channel for this settlement (Switchable)
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
              <button
                type="button"
                onClick={() => setSelectedChannel('Cash')}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  selectedChannel === 'Cash'
                    ? 'bg-white text-[#1A1A1A] shadow-2xs'
                    : 'text-gray-600 hover:text-[#1A1A1A]'
                }`}
              >
                <Banknote className="w-3.5 h-3.5" />
                Cash
              </button>
              <button
                type="button"
                onClick={() => setSelectedChannel('QRPh')}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  selectedChannel === 'QRPh'
                    ? 'bg-white text-[#1A1A1A] shadow-2xs'
                    : 'text-gray-600 hover:text-[#1A1A1A]'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                QR Ph
              </button>
            </div>
          </div>

          {selectedChannel === 'Cash' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Payment cash received by *
              </label>
              <input
                type="text"
                value={cashReceiver}
                onChange={(e) => setCashReceiver(e.target.value)}
                placeholder="Staff full name"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs text-[#1A1A1A] outline-none"
                required
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl bg-white border border-gray-300 text-[#1A1A1A] font-semibold text-xs cursor-pointer min-h-[42px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="py-2.5 px-4 rounded-xl bg-[#FF5252] hover:bg-[#ff3b3b] text-[#1A1A1A] font-bold text-xs cursor-pointer min-h-[42px]"
            >
              {selectedChannel === 'QRPh' ? 'Generate QR Ph' : 'Confirm Cash Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
