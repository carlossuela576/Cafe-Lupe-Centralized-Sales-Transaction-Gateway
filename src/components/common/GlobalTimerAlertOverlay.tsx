import React, { useEffect, useState } from 'react';
import { MasterTransaction } from '../../types';
import { store, calculateDiscountBreakdown } from '../../db/store';
import { Bell } from 'lucide-react';

interface GlobalTimerAlertOverlayProps {
  enabled: boolean;
}

export const GlobalTimerAlertOverlay: React.FC<GlobalTimerAlertOverlayProps> = ({ enabled }) => {
  const [transactions, setTransactions] = useState<MasterTransaction[]>(() => store.getTransactions());
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [extendTx, setExtendTx] = useState<MasterTransaction | null>(null);
  const [extendHours, setExtendHours] = useState<number>(1);

  useEffect(() => {
    if (!enabled) return;
    const refresh = () => setTransactions(store.getTransactions());
    refresh();
    const unsub = store.subscribe(refresh);
    const ticker = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      unsub();
      window.clearInterval(ticker);
    };
  }, [enabled]);

  if (!enabled) return null;

  const expiredTimedTxs = transactions.filter(
    (t) =>
      t.timerEndsAt &&
      !t.timerStoppedAt &&
      !t.timerAcknowledged &&
      t.transactionStatus !== 'void' &&
      new Date(t.timerEndsAt).getTime() <= nowMs
  );

  if (expiredTimedTxs.length === 0 && !extendTx) return null;

  const handleConfirmExtend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendTx || extendHours <= 0) return;
    store.extendTimedTransaction(extendTx.transactionID, extendHours);
    setExtendTx(null);
  };

  return (
    <>
      {expiredTimedTxs.length > 0 && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="global-expired-timer-heading"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 border-2 border-[#FF5252] shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#FF5252] text-[#1A1A1A] flex items-center justify-center shrink-0">
                <Bell className="w-6 h-6" />
              </div>
              <div>
                <span className="inline-block px-2 py-0.5 rounded-md bg-[#FFE27A] text-[#1A1A1A] text-[10px] font-extrabold uppercase tracking-wider">
                  Global Front-Desk Alert
                </span>
                <h2
                  id="global-expired-timer-heading"
                  className="text-lg font-extrabold text-[#1A1A1A] mt-1"
                >
                  Session Timer Expired
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  One or more timed outlet sessions have ended. Acknowledge or extend before continuing.
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
                    <div className="font-semibold text-[#1A1A1A]/85 mt-0.5">
                      {tx.outletName} · {tx.outletService}
                    </div>
                    <div className="font-mono text-[11px] text-[#1A1A1A]/70 mt-0.5">
                      {tx.transactionID}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setExtendHours(1);
                        setExtendTx(tx);
                      }}
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

      {extendTx && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/75">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-gray-200 shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-[#1A1A1A]">Extend session hours</h3>
              <p className="text-xs text-gray-500 mt-0.5 font-mono">
                {extendTx.transactionID} · {extendTx.outletName} · {extendTx.customerName}
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
                    +₱
                    {((extendTx.hourlyRate || 0) * extendHours).toLocaleString('en-PH', {
                      minimumFractionDigits: 2,
                    })}
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
                  className="py-2.5 px-4 rounded-xl bg-white border border-gray-300 text-[#1A1A1A] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-4 rounded-xl bg-[#FF5252] hover:bg-[#ff3b3b] text-[#1A1A1A] font-bold cursor-pointer"
                >
                  Confirm extension
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
