import React, { useState, useMemo } from 'react';
import {
  MasterTransaction,
  Outlet,
  User,
  AiAuditLog,
  ReconciliationBatch,
} from '../../types';
import { store, round2 } from '../../db/store';
import { StatTile } from '../common/StatTile';
import { StatusChip } from '../common/StatusChip';
import {
  downloadFinancialPdfReport,
  FinancialReportAiSummary,
} from '../../utils/pdfReport';
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  FileDown,
  TrendingUp,
  Send,
  Calendar,
  Bot,
  Eye,
  Loader2,
} from 'lucide-react';

async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIdx = result.indexOf(',');
      const base64 = commaIdx >= 0 ? result.slice(commaIdx + 1) : result;
      resolve({
        base64,
        mimeType: file.type || 'image/png',
        previewUrl: result,
      });
    };
    reader.onerror = () => reject(new Error('Unable to read image file.'));
    reader.readAsDataURL(file);
  });
}

function getLocalDateKey(isoStr: string): string {
  const d = new Date(isoStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayDateKey(): string {
  return getLocalDateKey(new Date().toISOString());
}

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

// =========================================================================
// 1. DAILY CASH DEPOSIT VALIDATION
// =========================================================================
export const DepositValidationView: React.FC<{
  user: User;
  transactions: MasterTransaction[];
  onInspectTx: (tx: MasterTransaction) => void;
}> = ({ user, transactions, onInspectTx }) => {
  const [targetDate, setTargetDate] = useState<string>(getTodayDateKey());
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [slipBase64, setSlipBase64] = useState<{ base64: string; mimeType: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [latestAudit, setLatestAudit] = useState<AiAuditLog | null>(null);
  const [auditLogs, setAuditLogs] = useState<AiAuditLog[]>(() =>
    store.getAiAuditLogs().filter((l) => l.auditType === 'deposit_validation')
  );

  const dayCashEntries = useMemo(() => {
    const installments = store.getInstallments();
    const matchedTxIds = new Set<string>();
    const entries: Array<{
      transactionID: string;
      outletName: string;
      customerName: string;
      amount: number;
      cashReceivedBy: string;
      phaseLabel: string;
      tx: MasterTransaction;
    }> = [];

    installments.forEach((inst) => {
      if (inst.paymentChannel !== 'Cash' || inst.status !== 'confirmed') return;
      const dateSource = inst.paidAt || inst.createdAt;
      if (getLocalDateKey(dateSource) !== targetDate) return;
      const tx = transactions.find((t) => t.transactionID === inst.transactionId);
      if (!tx || tx.transactionStatus === 'void') return;
      matchedTxIds.add(tx.transactionID);
      entries.push({
        transactionID: tx.transactionID,
        outletName: tx.outletName,
        customerName: tx.customerName,
        amount: inst.amount,
        cashReceivedBy: inst.cashReceivedBy || tx.cashReceivedBy || tx.employeeHandler,
        phaseLabel: inst.phase === 'initial' ? 'Initial' : 'Balance',
        tx,
      });
    });

    // Fallback for any paid/partial Cash transaction created on targetDate without an installment row
    transactions.forEach((tx) => {
      if (matchedTxIds.has(tx.transactionID)) return;
      if (tx.transactionStatus === 'void' || tx.paymentChannel !== 'Cash' || tx.amountPaid <= 0) return;
      if (getLocalDateKey(tx.paidAt || tx.transactionDateTime) !== targetDate) return;
      entries.push({
        transactionID: tx.transactionID,
        outletName: tx.outletName,
        customerName: tx.customerName,
        amount: tx.amountPaid,
        cashReceivedBy: tx.cashReceivedBy || tx.employeeHandler,
        phaseLabel: 'Full',
        tx,
      });
    });

    return entries;
  }, [transactions, targetDate]);

  const systemCashTotal = round2(dayCashEntries.reduce((sum, e) => sum + e.amount, 0));

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setSlipFile(file);
    try {
      const parsed = await fileToBase64(file);
      setSlipPreview(parsed.previewUrl);
      setSlipBase64({ base64: parsed.base64, mimeType: parsed.mimeType });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not read image.');
    }
  };

  const handleValidateDeposit = async () => {
    if (!slipBase64) {
      setErrorMsg('Please upload a bank deposit slip image first.');
      return;
    }
    setIsAnalyzing(true);
    setErrorMsg(null);
    try {
      const resp = await fetch('/api/ai/deposit-validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetDate,
          imageBase64: slipBase64.base64,
          mimeType: slipBase64.mimeType,
          systemCashTotal,
          systemCashTransactions: dayCashEntries.map((e) => ({
            transactionID: e.transactionID,
            outletName: e.outletName,
            customerName: e.customerName,
            amount: e.amount,
            cashReceivedBy: e.cashReceivedBy,
          })),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Deposit validation request failed.');
      }

      const saved = store.addAiAuditLog({
        auditType: 'deposit_validation',
        targetDate,
        systemTotal: Number(data.systemTotal ?? systemCashTotal),
        extractedTotal: Number(data.extractedTotal ?? 0),
        discrepancyAmount: Number(data.discrepancyAmount ?? 0),
        matchStatus: data.matchStatus === 'matched' ? 'matched' : 'conflict',
        extractedJson: data.extracted || {},
        summaryText:
          data.extracted?.notes ||
          `Slip ${data.matchStatus === 'matched' ? 'matched' : 'has variance'} against system cash ledger.`,
        createdBy: user.name,
      });

      setLatestAudit(saved);
      setAuditLogs(store.getAiAuditLogs().filter((l) => l.auditType === 'deposit_validation'));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to validate deposit slip.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#1A1A1A]">
            Daily cash deposit validation
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Compare daily cash collections against uploaded bank deposit slips via AI OCR
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-gray-200">
          <Calendar className="w-4 h-4 text-gray-500" />
          <label htmlFor="deposit-date" className="text-xs font-semibold text-gray-500">
            Deposit Date
          </label>
          <input
            id="deposit-date"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="text-xs font-bold text-[#1A1A1A] outline-none bg-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile
          label={`System cash total (${targetDate})`}
          value={`₱${systemCashTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
          sub={`${dayCashEntries.length} cash collections`}
          isHighlight={true}
        />
        <StatTile
          label="Extracted slip amount"
          value={
            latestAudit
              ? `₱${latestAudit.extractedTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
              : '—'
          }
          sub={latestAudit ? latestAudit.extractedJson?.bankName || 'Deposit slip' : 'Upload slip to extract'}
        />
        <StatTile
          label="Validation status"
          value={
            latestAudit
              ? latestAudit.matchStatus === 'matched'
                ? 'Matched'
                : `Conflict (${latestAudit.discrepancyAmount >= 0 ? '+' : ''}₱${latestAudit.discrepancyAmount.toFixed(2)})`
              : 'Pending check'
          }
          sub={latestAudit ? 'Saved to audit log' : 'Awaiting upload'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Upload & AI JSON Output */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-gray-200/90 space-y-4">
          <div className="text-sm font-bold text-[#1A1A1A]">Upload bank deposit slip</div>

          <label className="block border-2 border-dashed border-gray-300 hover:border-[#1A1A1A] rounded-2xl p-5 text-center cursor-pointer transition-colors bg-[#F7F7F7]/60">
            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            {slipPreview ? (
              <div className="space-y-2">
                <img
                  src={slipPreview}
                  alt="Uploaded deposit slip"
                  className="max-h-48 mx-auto rounded-xl object-contain border border-gray-200 bg-white"
                />
                <div className="text-[11px] font-semibold text-gray-600 truncate">
                  {slipFile?.name} (Click to replace)
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 py-4">
                <Upload className="w-7 h-7 mx-auto text-gray-400" />
                <div className="text-xs font-bold text-[#1A1A1A]">Choose deposit slip photo</div>
                <div className="text-[11px] text-gray-500">PNG or JPG image</div>
              </div>
            )}
          </label>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          <button
            type="button"
            onClick={handleValidateDeposit}
            disabled={isAnalyzing || !slipBase64}
            className="w-full py-2.5 px-4 rounded-xl bg-[#FF5252] hover:bg-[#ff3b3b] text-[#1A1A1A] font-bold text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[42px]"
          >
            {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isAnalyzing ? 'Analyzing slip with AI...' : 'Validate Deposit Slip'}
          </button>

          {latestAudit && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1A1A1A]">Extracted JSON Summary</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                    latestAudit.matchStatus === 'matched'
                      ? 'bg-[#FFE27A] text-[#1A1A1A]'
                      : 'bg-[#FF5252] text-[#1A1A1A]'
                  }`}
                >
                  {latestAudit.matchStatus}
                </span>
              </div>
              <pre className="p-3 rounded-xl bg-[#1A1A1A] text-[#FFE27A] text-[11px] font-mono overflow-x-auto max-h-56">
                {JSON.stringify(latestAudit.extractedJson, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Right: System Cash Transactions on Selected Date */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200/90 overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="text-sm font-bold text-[#1A1A1A]">
              Cash transactions on {targetDate}
            </div>
            <span className="text-xs font-bold text-gray-500 tabular-nums">
              Total: ₱{systemCashTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  <th className="py-3 px-5">ID</th>
                  <th className="py-3 px-3">Outlet / Customer</th>
                  <th className="py-3 px-3">Received By</th>
                  <th className="py-3 px-3 text-right">Cash Amount</th>
                  <th className="py-3 px-5 text-right">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {dayCashEntries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-gray-400">
                      No cash collections recorded on {targetDate}.
                    </td>
                  </tr>
                ) : (
                  dayCashEntries.map((entry, idx) => (
                    <tr key={`${entry.transactionID}-${idx}`} className="hover:bg-gray-50/70">
                      <td className="py-3 px-5 font-mono text-gray-500 whitespace-nowrap">
                        {entry.transactionID}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-[#1A1A1A]">{entry.customerName}</div>
                        <div className="text-[11px] text-gray-500">
                          {entry.outletName} · {entry.phaseLabel}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-gray-700">{entry.cashReceivedBy}</td>
                      <td className="py-3 px-3 text-right font-bold text-[#1A1A1A] tabular-nums">
                        ₱{entry.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <button
                          type="button"
                          onClick={() => onInspectTx(entry.tx)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-[#1A1A1A] hover:bg-gray-100 cursor-pointer"
                          title="View transaction details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {auditLogs.length > 0 && (
            <div className="p-4 border-t border-gray-100 bg-[#F7F7F7]/60 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Recent deposit validations
              </div>
              {auditLogs.slice(0, 3).map((log) => (
                <div
                  key={log.auditID}
                  className="flex items-center justify-between text-xs bg-white px-3 py-2 rounded-xl border border-gray-200/80"
                >
                  <div>
                    <span className="font-bold text-[#1A1A1A]">{log.targetDate}</span>{' '}
                    <span className="text-gray-500">
                      · System ₱{log.systemTotal.toLocaleString()} vs Slip ₱
                      {log.extractedTotal.toLocaleString()}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      log.matchStatus === 'matched'
                        ? 'bg-[#FFE27A] text-[#1A1A1A]'
                        : 'bg-[#FF5252] text-[#1A1A1A]'
                    }`}
                  >
                    {log.matchStatus}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// 2. FINANCIAL ANALYSIS DASHBOARD + PDF EXPORT
// =========================================================================
export const FinancialAnalysisView: React.FC<{
  user: User;
  transactions: MasterTransaction[];
}> = ({ user, transactions }) => {
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [aiSummary, setAiSummary] = useState<FinancialReportAiSummary | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const now = Date.now();
  const scopedTxs = useMemo(() => {
    return transactions.filter((t) => {
      if (t.transactionStatus === 'void') return false;
      const diffHours = (now - new Date(t.transactionDateTime).getTime()) / 3_600_000;
      if (period === 'day') return diffHours <= 24;
      if (period === 'week') return diffHours <= 24 * 7;
      if (period === 'month') return diffHours <= 24 * 30;
      return diffHours <= 24 * 365;
    });
  }, [transactions, period, now]);

  const paidSales = round2(
    scopedTxs.filter((t) => t.transactionStatus === 'paid').reduce((a, t) => a + t.totalAmount, 0)
  );
  const pendingSales = round2(
    scopedTxs.filter((t) => t.transactionStatus === 'pending').reduce((a, t) => a + t.totalAmount, 0)
  );
  const totalSales = round2(paidSales + pendingSales);

  const cashTotal = round2(
    scopedTxs.filter((t) => t.paymentChannel === 'Cash').reduce((a, t) => a + t.amountPaid, 0)
  );
  const qrPhTotal = round2(
    scopedTxs.filter((t) => t.paymentChannel === 'QRPh').reduce((a, t) => a + t.amountPaid, 0)
  );

  const outletRows = useMemo(() => {
    return store.getOutlets().map((o) => {
      const oTx = scopedTxs.filter((t) => t.outletSlug === o.slug);
      const paid = round2(
        oTx.filter((t) => t.transactionStatus === 'paid').reduce((a, t) => a + t.totalAmount, 0)
      );
      const pending = round2(
        oTx.filter((t) => t.transactionStatus === 'pending').reduce((a, t) => a + t.totalAmount, 0)
      );
      return {
        slug: o.slug,
        shortName: SHORT_OUTLET_LABELS[o.slug] || o.name.slice(0, 8),
        outletName: o.name,
        paid,
        pending,
        total: round2(paid + pending),
        txCount: oTx.length,
      };
    });
  }, [scopedTxs]);

  const maxOutletTotal = Math.max(1, ...outletRows.map((r) => r.total));

  const handleGenerateAiSummary = async () => {
    setLoadingAi(true);
    setErrorMsg(null);
    try {
      const resp = await fetch('/api/ai/financial-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodLabel: period,
          metrics: {
            totalSales,
            paidSales,
            pendingSales,
            transactionCount: scopedTxs.length,
          },
          outletBreakdown: outletRows.map((r) => ({
            outlet: r.outletName,
            txCount: r.txCount,
            paid: r.paid,
            pending: r.pending,
            total: r.total,
          })),
          channelBreakdown: {
            cashCollected: cashTotal,
            qrPhCollected: qrPhTotal,
          },
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Failed to generate AI financial summary.');
      }
      setAiSummary(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to summarize financial data.');
    } finally {
      setLoadingAi(false);
    }
  };

  const handleDownloadPdf = () => {
    downloadFinancialPdfReport({
      periodLabel: period,
      generatedBy: user.name,
      totalSales,
      paidSales,
      pendingSales,
      cashTotal,
      qrPhTotal,
      transactionCount: scopedTxs.length,
      outletRows,
      aiSummary,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#1A1A1A]">
            Financial analysis dashboard
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Historical outlet analytics, AI executive briefing, and PDF report export
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-1 bg-white border border-gray-200 rounded-xl gap-0.5">
            {(['day', 'week', 'month', 'year'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer ${
                  period === p ? 'bg-[#FFE27A] text-[#1A1A1A] font-bold' : 'text-gray-600'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleDownloadPdf}
            className="px-4 py-2 rounded-xl bg-[#FF5252] hover:bg-[#ff3b3b] text-[#1A1A1A] text-xs font-bold flex items-center gap-1.5 cursor-pointer min-h-[38px]"
          >
            <FileDown className="w-4 h-4" />
            Download PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="Total revenue"
          value={`₱${totalSales.toLocaleString()}`}
          sub={`${scopedTxs.length} active records`}
          isHighlight={true}
        />
        <StatTile
          label="Cash collected"
          value={`₱${cashTotal.toLocaleString()}`}
          sub="Walk-in & cash settlements"
        />
        <StatTile
          label="QR Ph collected"
          value={`₱${qrPhTotal.toLocaleString()}`}
          sub="Digital instant settlements"
        />
        <StatTile
          label="Pending receivables"
          value={`₱${pendingSales.toLocaleString()}`}
          sub="Open & down-payment balances"
        />
      </div>

      {/* Subtle AI Summarization Strip */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200/90 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-[#FFE27A] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#1A1A1A]" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-[#1A1A1A]">AI Executive Summary</h2>
              <p className="text-[11px] text-gray-500">
                Concise narrative generated from live {period} financial metrics (included in PDF)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleGenerateAiSummary}
            disabled={loadingAi}
            className="px-4 py-2 rounded-xl bg-[#1A1A1A] hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 self-start sm:self-auto"
          >
            {loadingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {aiSummary ? 'Refresh AI Summary' : 'Generate AI Summary'}
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {aiSummary ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs pt-2 border-t border-gray-100">
            <div className="lg:col-span-7 space-y-2">
              <div className="font-extrabold text-sm text-[#1A1A1A]">{aiSummary.headline}</div>
              <p className="text-gray-700 leading-relaxed">{aiSummary.executiveSummary}</p>
              <div className="p-3 rounded-xl bg-[#F7F7F7] border border-gray-200/70">
                <span className="font-bold text-[#1A1A1A]">Channel Mix: </span>
                <span className="text-gray-700">{aiSummary.channelInsight}</span>
              </div>
            </div>
            <div className="lg:col-span-5 space-y-2.5 bg-[#FFE27A]/35 p-4 rounded-xl border border-[#FFE27A]">
              <div className="font-bold text-[#1A1A1A]">Key Recommendations</div>
              <ul className="space-y-1.5 list-disc pl-4 text-gray-800">
                {(aiSummary.recommendations || []).map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-400">
            Click &ldquo;Generate AI Summary&rdquo; to attach an executive brief before downloading your PDF report.
          </div>
        )}
      </div>

      {/* Outlet Revenue Performance Chart + Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-gray-200/90 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold text-[#1A1A1A]">Revenue distribution by outlet</h2>
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
          <div className="h-52 flex items-end justify-between gap-2 pt-4 border-b border-gray-100 pb-2">
            {outletRows.map((bar) => {
              const paidPct = Math.round((bar.paid / maxOutletTotal) * 100);
              const pendingPct = Math.round((bar.pending / maxOutletTotal) * 100);
              return (
                <div
                  key={bar.slug}
                  className="flex-1 flex flex-col items-center justify-end h-full"
                  title={`${bar.outletName}: ₱${bar.total.toLocaleString()}`}
                >
                  <div className="w-full max-w-[30px] flex flex-col justify-end h-full gap-0.5">
                    {bar.pending > 0 && (
                      <div
                        className="w-full bg-[#FF5252] rounded-t-sm"
                        style={{ height: `${Math.max(4, pendingPct)}%` }}
                      />
                    )}
                    {bar.paid > 0 && (
                      <div
                        className="w-full bg-[#FFE27A] rounded-t-sm"
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
            {outletRows.map((bar) => (
              <div key={bar.slug} className="flex-1 text-center text-[10px] font-semibold text-gray-500 truncate">
                {bar.shortName}
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-gray-200/90">
          <h2 className="text-sm font-bold text-[#1A1A1A] mb-3">Outlet performance table</h2>
          <div className="divide-y divide-gray-100 text-xs">
            {outletRows.map((row) => (
              <div key={row.slug} className="py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-[#1A1A1A] truncate">{row.outletName}</div>
                  <div className="text-[11px] text-gray-400">{row.txCount} transactions</div>
                </div>
                <span className="font-bold text-[#1A1A1A] tabular-nums shrink-0">
                  ₱{row.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// 3. PER-OUTLET FORECASTING & PROPOSED BUSINESS ACTION PLAN
// =========================================================================
export interface ForecastResult {
  overallOutlook: string;
  externalImpactNote: string;
  outletPlans: Array<{
    outletName: string;
    priority: string;
    projectedChangePct: number;
    trendSignal: string;
    actionPlan: string;
  }>;
}

export const ForecastingView: React.FC<{
  user: User;
  transactions: MasterTransaction[];
  forecast: ForecastResult | null;
  onForecastUpdated: (next: ForecastResult) => void;
}> = ({ user, transactions, forecast, onForecastUpdated }) => {
  const [externalContext, setExternalContext] = useState(
    'Upcoming weekend & Antipolo rainy evening advisory with local corporate group inquiries'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const outletMetrics = useMemo(() => {
    return store.getOutlets().map((o) => {
      const txs = transactions.filter((t) => t.outletSlug === o.slug && t.transactionStatus !== 'void');
      const paid = round2(
        txs.filter((t) => t.transactionStatus === 'paid').reduce((a, t) => a + t.totalAmount, 0)
      );
      const pending = round2(
        txs.filter((t) => t.transactionStatus === 'pending').reduce((a, t) => a + t.balanceDue, 0)
      );
      return {
        outletName: o.name,
        category: o.category,
        txCount: txs.length,
        paidRevenue: paid,
        pendingBalance: pending,
      };
    });
  }, [transactions]);

  const totalRevenue = round2(outletMetrics.reduce((a, m) => a + m.paidRevenue, 0));
  const pendingBalance = round2(outletMetrics.reduce((a, m) => a + m.pendingBalance, 0));

  const handleGenerateForecast = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const resp = await fetch('/api/ai/forecasting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outletMetrics,
          externalContext,
          totalRevenue,
          pendingBalance,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Forecast generation failed.');
      }
      onForecastUpdated(data);
      store.addAiAuditLog({
        auditType: 'forecast_plan',
        targetDate: getTodayDateKey(),
        systemTotal: totalRevenue,
        extractedTotal: totalRevenue,
        discrepancyAmount: 0,
        matchStatus: 'info',
        extractedJson: data,
        summaryText: data.overallOutlook || 'Per-outlet forecast generated.',
        createdBy: user.name,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to generate forecast.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#1A1A1A]">
          Forecasting &amp; business action plan
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Per-outlet revenue forecast combining historical performance and external events
        </p>
      </div>

      <form
        onSubmit={handleGenerateForecast}
        className="bg-white rounded-2xl p-6 border border-gray-200/90 space-y-4"
      >
        <div>
          <label className="block text-xs font-bold text-[#1A1A1A] mb-1.5">
            External Events / Weather / Seasonality Context
          </label>
          <textarea
            value={externalContext}
            onChange={(e) => setExternalContext(e.target.value)}
            rows={2}
            placeholder="Describe upcoming holidays, weather advisories, tournaments, or corporate events..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs text-[#1A1A1A] outline-none"
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {[
              'Pre-Christmas corporate bookings surge',
              'Rainy weekend (indoor courts & KTV favored)',
              'Long holiday weekend staycation rush',
            ].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setExternalContext(preset)}
                className="px-2.5 py-1 rounded-lg bg-[#F7F7F7] hover:bg-[#FFE27A]/50 text-[11px] font-semibold text-gray-700 cursor-pointer"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="px-5 py-2.5 rounded-xl bg-[#FF5252] hover:bg-[#ff3b3b] text-[#1A1A1A] font-bold text-xs inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 min-h-[42px]"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
          {isLoading ? 'Forecasting all outlets...' : 'Generate Per-Outlet Action Plans'}
        </button>
      </form>

      {forecast && (
        <div className="space-y-5">
          <div className="rounded-2xl p-5 bg-[#FFE27A] border border-[#1A1A1A]/15 space-y-1.5 text-xs">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#1A1A1A]/70">
              Overall Outlook
            </div>
            <p className="text-sm font-bold text-[#1A1A1A]">{forecast.overallOutlook}</p>
            <p className="text-[#1A1A1A]/80">{forecast.externalImpactNote}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {forecast.outletPlans.map((plan, idx) => {
              const isPositive = plan.projectedChangePct >= 0;
              return (
                <div
                  key={`${plan.outletName}-${idx}`}
                  className="bg-white rounded-2xl p-5 border border-gray-200/90 space-y-2.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-extrabold text-sm text-[#1A1A1A]">{plan.outletName}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{plan.trendSignal}</div>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${
                          isPositive
                            ? 'bg-[#FFE27A] text-[#1A1A1A]'
                            : 'bg-[#FF5252] text-[#1A1A1A]'
                        }`}
                      >
                        {isPositive ? '+' : ''}
                        {plan.projectedChangePct}% proj.
                      </span>
                      <div className="text-[10px] font-bold uppercase text-gray-400">
                        {plan.priority} priority
                      </div>
                    </div>
                  </div>
                  <p className="text-gray-700 leading-relaxed pt-2 border-t border-gray-100">
                    {plan.actionPlan}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// =========================================================================
// 4. DECISION ANALYSIS SYSTEM (AI BUSINESS ADVISOR)
// =========================================================================
export const DecisionAdvisorView: React.FC<{
  transactions: MasterTransaction[];
  latestForecast: ForecastResult | null;
}> = ({ transactions, latestForecast }) => {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'advisor'; text: string }>>([
    {
      role: 'advisor',
      text: 'I am Cafe Lupe’s Decision Analysis Business Advisor. Ask me about outlet margins, pending down-payment collections, Cash vs QR Ph cashflow, or staffing/pricing decisions based on live figures.',
    },
  ]);
  const [question, setQuestion] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const financialSnapshot = useMemo(() => {
    const active = transactions.filter((t) => t.transactionStatus !== 'void');
    const paidTotal = round2(
      active.filter((t) => t.transactionStatus === 'paid').reduce((a, t) => a + t.totalAmount, 0)
    );
    const pendingBalance = round2(
      active.filter((t) => t.transactionStatus === 'pending').reduce((a, t) => a + t.balanceDue, 0)
    );
    const byOutlet = store.getOutlets().map((o) => {
      const oTx = active.filter((t) => t.outletSlug === o.slug);
      return {
        outlet: o.name,
        count: oTx.length,
        paidTotal: round2(
          oTx.filter((t) => t.transactionStatus === 'paid').reduce((a, t) => a + t.totalAmount, 0)
        ),
        pendingBalance: round2(oTx.reduce((a, t) => a + t.balanceDue, 0)),
      };
    });
    return {
      totalActiveTransactions: active.length,
      paidTotal,
      pendingBalance,
      byOutlet,
    };
  }, [transactions]);

  const sendPrompt = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || isSending) return;

    const nextHistory = [...messages, { role: 'user' as const, text: trimmed }];
    setMessages(nextHistory);
    setQuestion('');
    setIsSending(true);
    setErrorMsg(null);

    try {
      const resp = await fetch('/api/ai/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          financialSnapshot,
          forecastSummary: latestForecast,
          history: messages,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Advisor request failed.');
      }
      setMessages([...nextHistory, { role: 'advisor', text: data.reply }]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to reach Business Advisor.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#1A1A1A]">
          Decision analysis system
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          AI Business Advisor grounded in Cafe Lupe financial analysis and outlet forecasts
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          'Which outlets have the highest pending balances to follow up today?',
          'What pricing or bundle adjustments should we prioritize this week?',
          'Summarize Cash vs digital settlement risk across our top 3 outlets.',
        ].map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => sendPrompt(q)}
            disabled={isSending}
            className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 hover:border-[#1A1A1A] text-xs font-semibold text-[#1A1A1A] cursor-pointer disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200/90 overflow-hidden flex flex-col h-[520px]">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2.5 bg-[#FFE27A]/35">
          <Bot className="w-4 h-4 text-[#1A1A1A]" />
          <span className="text-xs font-extrabold text-[#1A1A1A]">Business Advisor Agent</span>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[82%] rounded-2xl px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-[#FFE27A] text-[#1A1A1A] font-semibold'
                    : 'bg-[#F7F7F7] border border-gray-200/70 text-[#1A1A1A]'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {isSending && (
            <div className="flex justify-start">
              <div className="px-4 py-2.5 rounded-2xl bg-[#F7F7F7] text-xs text-gray-500 inline-flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Analyzing Cafe Lupe figures...
              </div>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="mx-5 mb-2 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendPrompt(question);
          }}
          className="p-4 border-t border-gray-100 flex items-center gap-2"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask the Business Advisor a financial or operational question..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-xs text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
          />
          <button
            type="submit"
            disabled={isSending || !question.trim()}
            className="px-4 py-2.5 rounded-xl bg-[#FF5252] hover:bg-[#ff3b3b] text-[#1A1A1A] font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[40px]"
          >
            <Send className="w-3.5 h-3.5" />
            Ask
          </button>
        </form>
      </div>
    </div>
  );
};

// =========================================================================
// 5. FINANCIAL RECONCILIATION (Matches financial_recon_format.png layout)
// =========================================================================
export const FinancialReconciliationView: React.FC<{
  user: User;
  transactions: MasterTransaction[];
  onInspectTx: (tx: MasterTransaction) => void;
}> = ({ user, transactions, onInspectTx }) => {
  const outlets: Outlet[] = store.getOutlets();
  const today = getTodayDateKey();
  const defaultStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return getLocalDateKey(d.toISOString());
  }, []);

  // Per-outlet start/end date filters
  const [dateRanges, setDateRanges] = useState<Record<string, { start: string; end: string }>>(() => {
    const initial: Record<string, { start: string; end: string }> = {};
    store.getOutlets().forEach((o) => {
      initial[o.id] = { start: defaultStart, end: today };
    });
    return initial;
  });

  const [uploadingOutletId, setUploadingOutletId] = useState<string | null>(null);
  const [outletErrors, setOutletErrors] = useState<Record<string, string>>({});
  const [batches, setBatches] = useState<ReconciliationBatch[]>(() => store.getReconciliationBatches());

  const handleRangeChange = (outletId: string, field: 'start' | 'end', value: string) => {
    setDateRanges((prev) => ({
      ...prev,
      [outletId]: {
        start: prev[outletId]?.start || defaultStart,
        end: prev[outletId]?.end || today,
        [field]: value,
      },
    }));
  };

  const handleUploadStatement = async (
    outlet: Outlet,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const range = dateRanges[outlet.id] || { start: defaultStart, end: today };
    const outletTxs = transactions.filter((t) => {
      if (t.outletSlug !== outlet.slug) return false;
      const dKey = getLocalDateKey(t.transactionDateTime);
      return dKey >= range.start && dKey <= range.end;
    });

    setUploadingOutletId(outlet.id);
    setOutletErrors((prev) => {
      const next = { ...prev };
      delete next[outlet.id];
      return next;
    });

    try {
      const parsedFile = await fileToBase64(file);
      const resp = await fetch('/api/ai/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outletName: outlet.name,
          startDate: range.start,
          endDate: range.end,
          imageBase64: parsedFile.base64,
          mimeType: parsedFile.mimeType,
          outletTransactions: outletTxs,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Bank statement reconciliation failed.');
      }

      store.addReconciliationBatch({
        outletId: outlet.id,
        outletName: outlet.name,
        startDate: range.start,
        endDate: range.end,
        statementFilename: file.name,
        extractedEntriesJson: Array.isArray(data.extractedEntries) ? data.extractedEntries : [],
        comparisonResultsJson: Array.isArray(data.comparisons) ? data.comparisons : [],
        overallStatus: data.overallStatus === 'matched' ? 'matched' : 'conflict',
        summaryNote: data.summaryNote,
        statementTotal: Number(data.statementTotal ?? 0),
        systemTotal: Number(data.systemTotal ?? 0),
        createdBy: user.name,
      });
      setBatches(store.getReconciliationBatches());
    } catch (err) {
      setOutletErrors((prev) => ({
        ...prev,
        [outlet.id]: err instanceof Error ? err.message : 'Unable to reconcile statement.',
      }));
    } finally {
      setUploadingOutletId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#1A1A1A]">
          Financial Reconciliation
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Select a date range and upload each outlet&apos;s bank statement image for AI comparison
        </p>
      </div>

      <div className="space-y-6">
        {outlets.map((outlet) => {
          const range = dateRanges[outlet.id] || { start: defaultStart, end: today };
          const scopedTxs = transactions.filter((t) => {
            if (t.outletSlug !== outlet.slug) return false;
            const dKey = getLocalDateKey(t.transactionDateTime);
            return dKey >= range.start && dKey <= range.end;
          });
          const latestBatch = batches.find((b) => b.outletId === outlet.id);
          const isUploading = uploadingOutletId === outlet.id;
          const errText = outletErrors[outlet.id];

          return (
            <div
              key={outlet.id}
              className="bg-white rounded-2xl border border-gray-200/90 overflow-hidden"
            >
              {/* Row 1: Date + Pick Date range inputs (matches financial_recon_format.png) */}
              <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs font-bold text-[#1A1A1A]">Date</span>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-300 bg-white text-xs">
                    <span className="text-[11px] font-semibold text-gray-400">From</span>
                    <input
                      type="date"
                      value={range.start}
                      onChange={(e) => handleRangeChange(outlet.id, 'start', e.target.value)}
                      aria-label={`${outlet.name} start date`}
                      className="text-xs font-semibold text-[#1A1A1A] outline-none bg-transparent"
                    />
                    <span className="text-gray-300">–</span>
                    <span className="text-[11px] font-semibold text-gray-400">To</span>
                    <input
                      type="date"
                      value={range.end}
                      onChange={(e) => handleRangeChange(outlet.id, 'end', e.target.value)}
                      aria-label={`${outlet.name} end date`}
                      className="text-xs font-semibold text-[#1A1A1A] outline-none bg-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: [Outlet Name] + Upload button */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-sm font-extrabold text-[#1A1A1A]">{outlet.name}</h2>
                  {latestBatch && (
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                        latestBatch.overallStatus === 'matched'
                          ? 'bg-[#FFE27A] text-[#1A1A1A]'
                          : 'bg-[#FF5252] text-[#1A1A1A]'
                      }`}
                    >
                      {latestBatch.overallStatus === 'matched' ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <AlertTriangle className="w-3 h-3" />
                      )}
                      {latestBatch.overallStatus}
                    </span>
                  )}
                </div>

                <label
                  className={`px-4 py-2 rounded-xl bg-gray-200/80 hover:bg-gray-300/80 text-[#1A1A1A] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 ${
                    isUploading ? 'opacity-60 pointer-events-none' : ''
                  }`}
                >
                  {isUploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  {isUploading ? 'Analyzing...' : 'Upload'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleUploadStatement(outlet, e)}
                    className="hidden"
                    disabled={isUploading}
                  />
                </label>
              </div>

              {errText && (
                <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold">
                  {errText}
                </div>
              )}

              {/* Transactions Table matching ID | CUSTOMER | SERVICE | AMOUNT | STATUS | TIME */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      <th className="py-3 px-6">ID</th>
                      <th className="py-3 px-4">CUSTOMER</th>
                      <th className="py-3 px-4">SERVICE</th>
                      <th className="py-3 px-4 text-right">AMOUNT</th>
                      <th className="py-3 px-4 text-center">STATUS</th>
                      <th className="py-3 px-6 text-right">TIME</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {scopedTxs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-7 text-center text-gray-400">
                          No transactions recorded for {outlet.name} in {range.start} to {range.end}.
                        </td>
                      </tr>
                    ) : (
                      scopedTxs.map((tx) => (
                        <tr
                          key={tx.transactionID}
                          onClick={() => onInspectTx(tx)}
                          className="hover:bg-gray-50/70 transition-colors cursor-pointer"
                        >
                          <td className="py-3 px-6 font-mono text-gray-500 whitespace-nowrap">
                            {tx.transactionID}
                          </td>
                          <td className="py-3 px-4 font-bold text-[#1A1A1A] max-w-[210px] truncate">
                            {tx.customerName}
                          </td>
                          <td className="py-3 px-4 text-gray-600 max-w-xs truncate">
                            {tx.outletService}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-[#1A1A1A] tabular-nums whitespace-nowrap">
                            ₱{tx.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <StatusChip status={tx.transactionStatus} size="sm" />
                          </td>
                          <td className="py-3 px-6 text-right text-gray-500 whitespace-nowrap tabular-nums">
                            {new Date(tx.transactionDateTime).toLocaleTimeString([], {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* AI Bank Statement Reconciliation Audit Panel */}
              {latestBatch && (
                <div className="p-5 border-t border-gray-100 bg-[#F7F7F7]/80 space-y-3 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-[#1A1A1A]">
                        AI Audit ({latestBatch.statementFilename})
                      </span>
                      <span className="text-gray-500 ml-2">
                        {latestBatch.startDate} to {latestBatch.endDate}
                      </span>
                    </div>
                    <div className="font-mono font-bold text-[#1A1A1A] tabular-nums">
                      System: ₱{(latestBatch.systemTotal || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })} ·
                      Bank Statement: ₱{(latestBatch.statementTotal || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  {latestBatch.summaryNote && (
                    <p className="text-gray-700">{latestBatch.summaryNote}</p>
                  )}
                  {latestBatch.comparisonResultsJson.length > 0 && (
                    <div className="divide-y divide-gray-200/70 bg-white rounded-xl border border-gray-200/80 overflow-hidden">
                      {latestBatch.comparisonResultsJson.map((comp, idx) => (
                        <div
                          key={`${comp.referenceId}-${idx}`}
                          className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <span className="font-mono font-bold text-[#1A1A1A]">{comp.referenceId}</span>{' '}
                            <span className="text-gray-600">— {comp.description}</span>
                            <div className="text-[11px] text-gray-500">{comp.reason}</div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-mono tabular-nums text-[11px] text-gray-700">
                              Sys: {comp.systemAmount !== null ? `₱${comp.systemAmount.toFixed(2)}` : '—'} / Bank:{' '}
                              {comp.statementAmount !== null ? `₱${comp.statementAmount.toFixed(2)}` : '—'}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                comp.status === 'matched'
                                  ? 'bg-[#FFE27A] text-[#1A1A1A]'
                                  : 'bg-[#FF5252] text-[#1A1A1A]'
                              }`}
                            >
                              {comp.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
