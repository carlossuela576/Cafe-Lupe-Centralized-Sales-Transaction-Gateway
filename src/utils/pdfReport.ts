import { jsPDF } from 'jspdf';

export interface FinancialReportOutletRow {
  outletName: string;
  paid: number;
  pending: number;
  total: number;
  txCount: number;
}

export interface FinancialReportAiSummary {
  headline?: string;
  executiveSummary?: string;
  keyFindings?: string[];
  channelInsight?: string;
  recommendations?: string[];
}

export interface FinancialReportPayload {
  periodLabel: string;
  generatedBy: string;
  totalSales: number;
  paidSales: number;
  pendingSales: number;
  cashTotal: number;
  qrPhTotal: number;
  transactionCount: number;
  outletRows: FinancialReportOutletRow[];
  aiSummary?: FinancialReportAiSummary | null;
}

function formatPhp(val: number): string {
  return `PHP ${val.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function downloadFinancialPdfReport(payload: FinancialReportPayload): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  const contentWidth = pageWidth - margin * 2;
  let y = 48;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 48) {
      doc.addPage();
      y = 48;
    }
  };

  // Warm Gold Header Band
  doc.setFillColor(255, 226, 122);
  doc.roundedRect(margin, y, contentWidth, 68, 8, 8, 'F');

  doc.setTextColor(26, 26, 26);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Cafe Lupe Financial Analysis Report', margin + 16, y + 28);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(
    `Period: ${payload.periodLabel.toUpperCase()}  |  Generated: ${new Date().toLocaleString()}  |  By: ${payload.generatedBy}`,
    margin + 16,
    y + 48
  );

  y += 88;

  // KPI Summary Grid
  const cardWidth = (contentWidth - 20) / 3;
  const kpis = [
    { label: 'TOTAL REVENUE', value: formatPhp(payload.totalSales), sub: `${payload.transactionCount} transactions` },
    { label: 'COLLECTED (PAID)', value: formatPhp(payload.paidSales), sub: `Cash: ${formatPhp(payload.cashTotal)}` },
    { label: 'PENDING RECEIVABLES', value: formatPhp(payload.pendingSales), sub: `QR Ph: ${formatPhp(payload.qrPhTotal)}` },
  ];

  kpis.forEach((k, idx) => {
    const x = margin + idx * (cardWidth + 10);
    doc.setFillColor(247, 247, 247);
    doc.setDrawColor(225, 225, 225);
    doc.roundedRect(x, y, cardWidth, 58, 6, 6, 'FD');

    doc.setTextColor(110, 110, 110);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(k.label, x + 10, y + 17);

    doc.setTextColor(26, 26, 26);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(k.value, x + 10, y + 35);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(95, 95, 95);
    doc.text(k.sub, x + 10, y + 49);
  });

  y += 78;

  // AI Executive Summary (if generated)
  if (payload.aiSummary?.executiveSummary) {
    ensureSpace(120);
    doc.setTextColor(26, 26, 26);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Executive AI Summary', margin, y);
    y += 16;

    if (payload.aiSummary.headline) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      const headLines = doc.splitTextToSize(payload.aiSummary.headline, contentWidth);
      doc.text(headLines, margin, y);
      y += headLines.length * 13 + 4;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(55, 55, 55);
    const execLines = doc.splitTextToSize(payload.aiSummary.executiveSummary, contentWidth);
    doc.text(execLines, margin, y);
    y += execLines.length * 13 + 8;

    if (payload.aiSummary.channelInsight) {
      ensureSpace(40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(26, 26, 26);
      doc.text('Payment Channel Mix:', margin, y);
      y += 12;
      doc.setFont('helvetica', 'normal');
      const chLines = doc.splitTextToSize(payload.aiSummary.channelInsight, contentWidth);
      doc.text(chLines, margin, y);
      y += chLines.length * 12 + 8;
    }

    if (payload.aiSummary.keyFindings && payload.aiSummary.keyFindings.length > 0) {
      ensureSpace(60);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(26, 26, 26);
      doc.text('Key Findings', margin, y);
      y += 14;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      payload.aiSummary.keyFindings.forEach((f) => {
        const lines = doc.splitTextToSize(`• ${f}`, contentWidth - 10);
        ensureSpace(lines.length * 12 + 4);
        doc.text(lines, margin + 6, y);
        y += lines.length * 12 + 3;
      });
      y += 6;
    }

    if (payload.aiSummary.recommendations && payload.aiSummary.recommendations.length > 0) {
      ensureSpace(60);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(26, 26, 26);
      doc.text('Recommended Actions', margin, y);
      y += 14;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      payload.aiSummary.recommendations.forEach((rec, idx) => {
        const lines = doc.splitTextToSize(`${idx + 1}. ${rec}`, contentWidth - 10);
        ensureSpace(lines.length * 12 + 4);
        doc.text(lines, margin + 6, y);
        y += lines.length * 12 + 3;
      });
      y += 10;
    }
  }

  // Per-Outlet Breakdown Table
  ensureSpace(90);
  doc.setTextColor(26, 26, 26);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Revenue Breakdown by Outlet', margin, y);
  y += 14;

  // Table header
  doc.setFillColor(26, 26, 26);
  doc.rect(margin, y, contentWidth, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('OUTLET', margin + 10, y + 14);
  doc.text('TX', margin + 215, y + 14, { align: 'right' });
  doc.text('PAID', margin + 315, y + 14, { align: 'right' });
  doc.text('PENDING', margin + 410, y + 14, { align: 'right' });
  doc.text('TOTAL', margin + contentWidth - 10, y + 14, { align: 'right' });
  y += 22;

  payload.outletRows.forEach((row, idx) => {
    ensureSpace(22);
    if (idx % 2 === 1) {
      doc.setFillColor(248, 248, 248);
      doc.rect(margin, y, contentWidth, 20, 'F');
    }
    doc.setDrawColor(235, 235, 235);
    doc.line(margin, y + 20, margin + contentWidth, y + 20);

    doc.setTextColor(26, 26, 26);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const label = row.outletName.length > 34 ? `${row.outletName.slice(0, 32)}...` : row.outletName;
    doc.text(label, margin + 10, y + 13);
    doc.text(String(row.txCount), margin + 215, y + 13, { align: 'right' });
    doc.text(formatPhp(row.paid), margin + 315, y + 13, { align: 'right' });
    doc.text(formatPhp(row.pending), margin + 410, y + 13, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(formatPhp(row.total), margin + contentWidth - 10, y + 13, { align: 'right' });

    y += 20;
  });

  const stamp = new Date().toISOString().split('T')[0];
  doc.save(`CafeLupe_Financial_Report_${payload.periodLabel}_${stamp}.pdf`);
}
