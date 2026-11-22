import React, { useState } from 'react';
import { MasterTransaction } from '../../types';
import { store } from '../../db/store';
import { CheckCircle } from 'lucide-react';

interface QrPhModalProps {
  transaction: MasterTransaction;
  onClose: () => void;
  onSuccess: (message?: string) => void;
  onVoidCancelledInitial?: (transactionId: string) => void;
}

export const QrPhModal: React.FC<QrPhModalProps> = ({
  transaction,
  onClose,
  onSuccess,
  onVoidCancelledInitial,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const pendingInst = store.getPendingInstallment(transaction.transactionID);
  const isInitialDownPayment =
    Boolean(pendingInst) &&
    pendingInst!.phase === 'initial' &&
    transaction.paymentArrangement === 'Down Payment' &&
    transaction.amountPaid === 0;

  const payableAmount = pendingInst
    ? pendingInst.amount
    : transaction.balanceDue > 0
    ? transaction.balanceDue
    : transaction.totalAmount;

  const phaseLabel = isInitialDownPayment
    ? 'Initial Down Payment (QR Ph)'
    : transaction.paymentArrangement === 'Down Payment' && transaction.amountPaid > 0
    ? 'Remaining Balance Settlement (QR Ph)'
    : 'Scan to pay (QR Ph)';

  const handleSimulateScan = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const res = store.validateQrPayment(transaction.transactionID);
      setIsProcessing(false);
      if (res.success) {
        setFeedback(res.message);
        setTimeout(() => {
          onSuccess(res.message);
          onClose();
        }, 900);
      }
    }, 500);
  };

  const handleCancel = () => {
    if (isInitialDownPayment) {
      store.voidCancelledInitialPayment(transaction.transactionID);
      if (onVoidCancelledInitial) {
        onVoidCancelledInitial(transaction.transactionID);
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 sm:p-7 shadow-2xl border border-gray-200 text-center">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">{phaseLabel}</div>
        <div className="text-3xl font-extrabold text-[#1A1A1A] tabular-nums mt-1 mb-1">
          ₱{payableAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
        </div>
        {isInitialDownPayment && (
          <div className="text-[11px] font-semibold text-gray-500 mb-4 tabular-nums">
            Total bill: ₱{transaction.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })} ·
            Remaining after this: ₱
            {Math.max(0, transaction.totalAmount - payableAmount).toLocaleString('en-PH', {
              minimumFractionDigits: 2,
            })}
          </div>
        )}
        {!isInitialDownPayment && <div className="mb-4" />}

        {/* Crisp QR Code Frame */}
        <div className="inline-block bg-white border border-gray-200 p-4 rounded-2xl mb-4">
          <div className="w-40 h-40 mx-auto grid grid-cols-7 grid-rows-7 gap-1 bg-white">
            {/* Top-left finder */}
            <div className="col-span-2 row-span-2 border-4 border-[#1A1A1A] rounded-xs p-1">
              <div className="w-full h-full bg-[#1A1A1A]" />
            </div>
            <div className="bg-[#1A1A1A]" />
            <div className="bg-white" />
            <div className="bg-[#1A1A1A]" />
            {/* Top-right finder */}
            <div className="col-span-2 row-span-2 border-4 border-[#1A1A1A] rounded-xs p-1">
              <div className="w-full h-full bg-[#1A1A1A]" />
            </div>
            <div className="bg-white" />
            <div className="bg-[#1A1A1A]" />
            <div className="bg-[#1A1A1A]" />

            {/* Middle matrix */}
            <div className="bg-[#1A1A1A]" />
            <div className="bg-white" />
            <div className="bg-[#1A1A1A]" />
            <div className="bg-[#FFE27A]" />
            <div className="bg-[#1A1A1A]" />
            <div className="bg-white" />
            <div className="bg-[#1A1A1A]" />

            <div className="bg-white" />
            <div className="bg-[#1A1A1A]" />
            <div className="bg-[#1A1A1A]" />
            <div className="bg-[#FF5252]" />
            <div className="bg-white" />
            <div className="bg-[#1A1A1A]" />
            <div className="bg-white" />

            <div className="bg-[#1A1A1A]" />
            <div className="bg-white" />
            <div className="bg-[#1A1A1A]" />
            <div className="bg-[#1A1A1A]" />
            <div className="bg-[#1A1A1A]" />
            <div className="bg-white" />
            <div className="bg-[#1A1A1A]" />

            {/* Bottom-left finder */}
            <div className="col-span-2 row-span-2 border-4 border-[#1A1A1A] rounded-xs p-1">
              <div className="w-full h-full bg-[#1A1A1A]" />
            </div>
            <div className="bg-white" />
            <div className="bg-[#1A1A1A]" />
            <div className="bg-white" />
            <div className="bg-[#1A1A1A]" />
            <div className="bg-[#1A1A1A]" />

            <div className="bg-[#1A1A1A]" />
            <div className="bg-white" />
            <div className="bg-[#1A1A1A]" />
            <div className="bg-white" />
            <div className="bg-[#1A1A1A]" />
          </div>
        </div>

        <div className="text-xs font-bold text-[#1A1A1A]">
          {feedback ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-700">
              <CheckCircle className="w-4 h-4" />
              {feedback}
            </span>
          ) : (
            'Waiting for scan'
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1 mb-5 leading-relaxed">
          {isInitialDownPayment
            ? 'Cancelling this initial down payment will instantly void the transaction.'
            : 'Prototype: payment is validated the moment this unique QR is scanned.'}
        </p>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isProcessing || feedback !== null}
            className="py-2.5 px-4 rounded-xl bg-white border border-gray-300 text-[#1A1A1A] font-semibold text-xs hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 min-h-[42px]"
          >
            {isInitialDownPayment ? 'Cancel & Void' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleSimulateScan}
            disabled={isProcessing || feedback !== null}
            className="py-2.5 px-4 rounded-xl bg-[#FF5252] hover:bg-[#ff3b3b] text-[#1A1A1A] font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 min-h-[42px]"
          >
            {isProcessing ? 'Validating...' : 'Simulate scan'}
          </button>
        </div>
      </div>
    </div>
  );
};
