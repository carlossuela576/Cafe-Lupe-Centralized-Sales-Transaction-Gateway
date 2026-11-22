import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MODEL_NAME = 'gemini-4-hydrogen';

function getGeminiClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    dotenv.config({ path: '.env.local' });
    dotenv.config({ path: '.env' });
  }
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function handleAiError(res: express.Response, err: unknown, fallbackMessage: string) {
  const rawMessage = err instanceof Error ? err.message : String(err);
  console.error('[Gemini API Error]', rawMessage);

  if (rawMessage.includes('GEMINI_API_KEY')) {
    return res.status(500).json({
      error: 'Gemini API key is missing on the server. Please verify Settings > Secrets.',
    });
  }
  if (rawMessage.includes('PERMISSION_DENIED') || rawMessage.includes('403') || rawMessage.includes('API_KEY_INVALID')) {
    return res.status(403).json({
      error: 'Gemini API authentication failed. Please verify your API key in Settings > Secrets.',
    });
  }
  if (rawMessage.includes('RESOURCE_EXHAUSTED') || rawMessage.includes('429')) {
    return res.status(429).json({
      error: 'Gemini API rate limit reached. Please wait a moment and try again.',
    });
  }
  return res.status(500).json({ error: `${fallbackMessage}: ${rawMessage}` });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '20mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, model: MODEL_NAME });
  });

  // 1. Daily Cash Deposit Validation (Multimodal Slip Extraction + Comparison)
  app.post('/api/ai/deposit-validate', async (req, res) => {
    try {
      const { targetDate, imageBase64, mimeType, systemCashTotal, systemCashTransactions } = req.body || {};
      if (!imageBase64 || !mimeType) {
        return res.status(400).json({ error: 'Deposit slip image is required.' });
      }

      const ai = getGeminiClient();
      const txSummaryList = Array.isArray(systemCashTransactions)
        ? systemCashTransactions
            .map(
              (t: any) =>
                `- ${t.transactionID} | ${t.outletName} | ${t.customerName} | PHP ${Number(t.amount || 0).toFixed(2)} | Rx: ${t.cashReceivedBy || 'Staff'}`
            )
            .join('\n')
        : 'None';

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
            {
              text: `Analyze this bank deposit slip image for Cafe Lupe dated around ${targetDate || 'today'}.
Extract the bank deposit details accurately in structured JSON.
For context, the system recorded ${Array.isArray(systemCashTransactions) ? systemCashTransactions.length : 0} cash transactions totaling PHP ${Number(systemCashTotal || 0).toFixed(2)}:
${txSummaryList}`,
            },
          ],
        },
        config: {
          systemInstruction:
            'You are an accurate Philippine accounting OCR auditor for Cafe Lupe. Extract numbers faithfully from deposit slip images. All amounts must be numeric PHP totals without currency symbols.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              bankName: { type: Type.STRING },
              depositDate: { type: Type.STRING },
              accountNumber: { type: Type.STRING },
              referenceNumber: { type: Type.STRING },
              depositorName: { type: Type.STRING },
              extractedTotal: { type: Type.NUMBER },
              currency: { type: Type.STRING },
              lineItems: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    amount: { type: Type.NUMBER },
                  },
                },
              },
              notes: { type: Type.STRING },
            },
            required: ['bankName', 'depositDate', 'extractedTotal', 'notes'],
          },
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const extracted = JSON.parse((response.text ?? '{}').trim());
      const extractedTotal = Number(extracted.extractedTotal || 0);
      const sysTotal = Number(systemCashTotal || 0);
      const discrepancyAmount = Math.round((extractedTotal - sysTotal) * 100) / 100;
      const matchStatus = Math.abs(discrepancyAmount) <= 0.01 ? 'matched' : 'conflict';

      res.json({
        extracted,
        systemTotal: sysTotal,
        extractedTotal,
        discrepancyAmount,
        matchStatus,
      });
    } catch (err) {
      handleAiError(res, err, 'Failed to analyze deposit slip');
    }
  });

  // 2. Financial Analysis Dashboard AI Summarization
  app.post('/api/ai/financial-summary', async (req, res) => {
    try {
      const { periodLabel, metrics, outletBreakdown, channelBreakdown } = req.body || {};
      const ai = getGeminiClient();

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Generate a concise executive financial analysis summary for Cafe Lupe (${periodLabel || 'Current Period'}).
Metrics JSON: ${JSON.stringify(metrics)}
Outlet Breakdown JSON: ${JSON.stringify(outletBreakdown)}
Channel Breakdown JSON: ${JSON.stringify(channelBreakdown)}`,
        config: {
          systemInstruction:
            'You are a concise hospitality financial controller for Cafe Lupe in Antipolo. Provide sharp, factual observations grounded strictly in the numbers provided, with 3 actionable recommendations.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              executiveSummary: { type: Type.STRING },
              keyFindings: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              channelInsight: { type: Type.STRING },
              recommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['headline', 'executiveSummary', 'keyFindings', 'channelInsight', 'recommendations'],
          },
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err) {
      handleAiError(res, err, 'Failed to generate financial summary');
    }
  });

  // 3. Per-Outlet Forecasting & Proposed Business Plan of Action
  app.post('/api/ai/forecasting', async (req, res) => {
    try {
      const { outletMetrics, externalContext, totalRevenue, pendingBalance } = req.body || {};
      const ai = getGeminiClient();

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Create a per-outlet financial forecast and proposed business plan of action for Cafe Lupe.
Total Gross Revenue: PHP ${Number(totalRevenue || 0).toFixed(2)}
Pending Receivables: PHP ${Number(pendingBalance || 0).toFixed(2)}
External Events / Weather / Seasonality Context: ${externalContext || 'Standard weekday/weekend hospitality cycle in Antipolo, Rizal'}
Outlet Performance Data: ${JSON.stringify(outletMetrics)}`,
        config: {
          systemInstruction:
            'You are a strategic hospitality revenue forecaster for Cafe Lupe (hostel, pickleball, gym, pool, KTV, F&B, billiards, table tennis, parking, events). Return practical, outlet-specific operational actions.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallOutlook: { type: Type.STRING },
              externalImpactNote: { type: Type.STRING },
              outletPlans: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    outletName: { type: Type.STRING },
                    priority: { type: Type.STRING },
                    projectedChangePct: { type: Type.NUMBER },
                    trendSignal: { type: Type.STRING },
                    actionPlan: { type: Type.STRING },
                  },
                  required: ['outletName', 'priority', 'projectedChangePct', 'trendSignal', 'actionPlan'],
                },
              },
            },
            required: ['overallOutlook', 'externalImpactNote', 'outletPlans'],
          },
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err) {
      handleAiError(res, err, 'Failed to generate outlet forecast');
    }
  });

  // 4. Decision Analysis System (AI Business Advisor)
  app.post('/api/ai/advisor', async (req, res) => {
    try {
      const { question, financialSnapshot, forecastSummary, history } = req.body || {};
      if (!question || typeof question !== 'string') {
        return res.status(400).json({ error: 'Question is required.' });
      }

      const ai = getGeminiClient();
      const historyText = Array.isArray(history)
        ? history
            .slice(-6)
            .map((m: any) => `${m.role === 'user' ? 'Accountant' : 'Advisor'}: ${m.text}`)
            .join('\n')
        : '';

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Live Cafe Lupe Financial Snapshot:
${JSON.stringify(financialSnapshot)}

Latest Forecast Context:
${JSON.stringify(forecastSummary || 'No forecast run yet')}

Recent Conversation:
${historyText}

Accountant Question:
${question}`,
        config: {
          systemInstruction:
            'You are Cafe Lupe’s Decision Analysis AI Business Advisor. Give clear, concise, data-backed executive advice citing exact PHP figures and outlet names from the financial snapshot and forecast context.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        },
      });

      res.json({ reply: response.text || 'No response generated.' });
    } catch (err) {
      handleAiError(res, err, 'Business Advisor failed to respond');
    }
  });

  // 5. Financial Reconciliation (Per-Outlet Bank Statement Image Extraction + Comparison)
  app.post('/api/ai/reconcile', async (req, res) => {
    try {
      const { outletName, startDate, endDate, imageBase64, mimeType, outletTransactions } = req.body || {};
      if (!imageBase64 || !mimeType) {
        return res.status(400).json({ error: 'Bank statement image is required.' });
      }

      const ai = getGeminiClient();
      const txList = Array.isArray(outletTransactions)
        ? outletTransactions.map((t: any) => ({
            transactionID: t.transactionID,
            customerName: t.customerName,
            service: t.outletService,
            amountPaid: t.amountPaid,
            totalAmount: t.totalAmount,
            channel: t.paymentChannel,
            status: t.transactionStatus,
            dateTime: t.transactionDateTime,
          }))
        : [];

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
            {
              text: `You are reconciling the bank statement image for outlet "${outletName}" covering ${startDate} to ${endDate}.
1. Extract all credit/deposit/payment entries visible in the bank statement image.
2. Compare those extracted statement entries against Cafe Lupe's recorded transactions in this period:
${JSON.stringify(txList)}
3. Return each extracted entry and a line-by-line comparison result where each item is marked "matched" or "conflict", plus an overallStatus ("matched" only if all non-void paid entries reconcile cleanly without missing/mismatched amounts, otherwise "conflict").`,
            },
          ],
        },
        config: {
          systemInstruction:
            'You are a strict bank reconciliation AI auditor for Cafe Lupe. Parse bank statement entries accurately from the uploaded image and match them by amount, reference, customer, or date against the provided transaction list. Flag any discrepancy or missing entry as "conflict".',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              bankName: { type: Type.STRING },
              statementPeriod: { type: Type.STRING },
              statementTotal: { type: Type.NUMBER },
              systemTotal: { type: Type.NUMBER },
              overallStatus: { type: Type.STRING },
              summaryNote: { type: Type.STRING },
              extractedEntries: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    date: { type: Type.STRING },
                    reference: { type: Type.STRING },
                    description: { type: Type.STRING },
                    amount: { type: Type.NUMBER },
                  },
                },
              },
              comparisons: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    referenceId: { type: Type.STRING },
                    date: { type: Type.STRING },
                    description: { type: Type.STRING },
                    systemAmount: { type: Type.NUMBER },
                    statementAmount: { type: Type.NUMBER },
                    status: { type: Type.STRING },
                    reason: { type: Type.STRING },
                  },
                  required: ['referenceId', 'description', 'status', 'reason'],
                },
              },
            },
            required: ['statementTotal', 'systemTotal', 'overallStatus', 'summaryNote', 'extractedEntries', 'comparisons'],
          },
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const normalizedStatus =
        String(parsed.overallStatus || '').toLowerCase() === 'matched' ? 'matched' : 'conflict';
      const normalizedComparisons = Array.isArray(parsed.comparisons)
        ? parsed.comparisons.map((c: any) => ({
            referenceId: String(c.referenceId || '—'),
            date: String(c.date || startDate || ''),
            description: String(c.description || ''),
            systemAmount: typeof c.systemAmount === 'number' ? c.systemAmount : null,
            statementAmount: typeof c.statementAmount === 'number' ? c.statementAmount : null,
            status: String(c.status || '').toLowerCase() === 'matched' ? 'matched' : 'conflict',
            reason: String(c.reason || ''),
          }))
        : [];

      res.json({
        ...parsed,
        overallStatus: normalizedStatus,
        comparisons: normalizedComparisons,
      });
    } catch (err) {
      handleAiError(res, err, 'Failed to reconcile bank statement');
    }
  });

  // Serve Vite middleware in development, static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Cafe Lupe Gateway server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
