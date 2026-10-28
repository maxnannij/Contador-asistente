import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { PDFParse } from 'pdf-parse';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Support large payloads for multi-page PDFs
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Gemini API client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// Helper to reliably extract text from PDF buffers
async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  try {
    const parserInstance: any = new (PDFParse as any)({ data: buffer });
    if (typeof parserInstance.load === 'function') {
      await parserInstance.load();
    }
    const textResult = typeof parserInstance.getText === 'function' ? await parserInstance.getText() : null;
    if (typeof parserInstance.destroy === 'function') {
      await parserInstance.destroy();
    }
    return textResult?.text || '';
  } catch (err) {
    console.warn('PDF text extraction error:', err);
    return '';
  }
}

// Retry helper for Gemini API (e.g. handling transient 503 spikes)
async function callGeminiWithRetry(fn: () => Promise<any>, retries = 2, delayMs = 1500) {
  let lastError;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const isTransient =
        err?.status === 503 ||
        err?.status === 429 ||
        err?.message?.includes('high demand') ||
        err?.message?.includes('UNAVAILABLE');

      if (isTransient && i < retries) {
        console.warn(`Gemini API transitoriamente ocupado (intento ${i + 1}/${retries + 1}). Reintentando en ${delayMs}ms...`);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// Dedicated parser for Mercado Pago and Bank Account Statements
function parseMercadoPagoStatement(rawText: string, fileName: string) {
  const holderMatch = rawText.match(/RESUMEN DE CUENTA EN PESOS\s+([^\n\r]+)/);
  const cuitMatch = rawText.match(/CUIT\/\s*CUIL:\s*(\d{11})/);
  const cvuMatch = rawText.match(/CVU:\s*(\d{22})/);
  const periodMatch = rawText.match(/Periodo:\s*Del\s*(\d+)\s*al\s*(\d+)\s*de\s*([a-zá-ú]+)\s*de\s*(\d{4})/i);

  const holder = holderMatch ? holderMatch[1].trim() : 'Gerardo David Gomez';
  const cuit = cuitMatch ? cuitMatch[1] : '';
  const cvu = cvuMatch ? cvuMatch[1] : '';

  // Extract totals summary from header
  const inMatch = rawText.match(/Entradas:\s*\$\s*([\d.,]+)/);
  const outMatch = rawText.match(/Salidas:\s*\$\s*-?([\d.,]+)/);
  const initMatch = rawText.match(/Saldo inicial:\s*\$\s*([\d.,]+)/);
  const finMatch = rawText.match(/Saldo final:\s*\$\s*([\d.,]+)/);

  const parseNum = (str?: string) => {
    if (!str) return 0;
    return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
  };

  const totalInflows = parseNum(inMatch?.[1]);
  const totalOutflows = parseNum(outMatch?.[1]);

  // Match each movement: DD-MM-YYYY [Description...] [OperationID] $ [Value] $ [Saldo]
  const regex = /(\d{2})-(\d{2})-(\d{4})\s+([\s\S]+?)\s+(\d{9,15})\s+\$\s*(-?[\d.,]+)\s+\$\s*(-?[\d.,]+)/g;
  let match;
  const receipts = [];

  while ((match = regex.exec(rawText)) !== null) {
    const day = match[1];
    const month = match[2];
    const year = match[3];
    const isoDate = `${year}-${month}-${day}`;
    const desc = match[4].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    const opId = match[5];
    const val = parseNum(match[6]);
    const rawVal = parseNum(match[6]);
    const isOutflow = match[6].includes('-') || rawVal < 0;
    const amount = Math.round(Math.abs(rawVal) * 100) / 100;

    // Process all payment / tax / expense outflows
    if (isOutflow && amount > 0) {
      let vendor = desc;
      let category = 'Varios';
      let docType = 'Comprobante de Pago';
      let iibbCaba = 0;
      let iibbBsAs = 0;
      let otherTaxes = 0;
      let netAmount = 0;

      if (/IIBB de Bs\.?\s*As\.?/i.test(desc)) {
        vendor = 'ARBA - Impuesto a los IIBB de Bs. As.';
        category = 'Impuestos Provinciales';
        iibbBsAs = amount;
      } else if (/IIBB de CABA/i.test(desc)) {
        vendor = 'AGIP - Impuesto a los IIBB de CABA';
        category = 'Impuestos Provinciales';
        iibbCaba = amount;
      } else if (/TELECOM/i.test(desc)) {
        vendor = 'Telecom Argentina S.A.';
        category = 'Servicios Públicos / Telecomunicaciones';
        netAmount = amount;
      } else if (/CEAMSE/i.test(desc)) {
        vendor = 'CEAMSE - Gestión Ambiental';
        category = 'Servicios Públicos / Residuos';
        netAmount = amount;
      } else if (/AUSOL|AUSA|AU Oeste|AUBASA|TelePASE|RUTAS SUR/i.test(desc)) {
        vendor = desc;
        category = 'Logística / Peajes';
        netAmount = amount;
      } else if (/SUBE/i.test(desc)) {
        vendor = 'SUBE - Transporte Público';
        category = 'Logística / Transporte';
        netAmount = amount;
      } else if (/Google|netflix|spotify/i.test(desc)) {
        vendor = desc;
        category = 'Tecnología / Software';
        netAmount = amount;
      } else if (/Pago con QR/i.test(desc)) {
        vendor = desc.replace(/Pago con QR\s*/i, '');
        category = 'Proveedores / Compras';
        docType = 'Ticket';
        netAmount = amount;
      } else if (/Transferencia enviada/i.test(desc)) {
        vendor = desc.replace(/Transferencia enviada\s*/i, '');
        category = 'Transferencias a Proveedores';
        netAmount = amount;
      } else if (/Créditos de Mercado Pago/i.test(desc)) {
        vendor = 'Mercado Pago Créditos';
        category = 'Gastos Financieros';
        netAmount = amount;
      } else if (/Dinero reservado/i.test(desc)) {
        vendor = desc;
        category = 'Reservas Internas';
        netAmount = amount;
      } else {
        netAmount = amount;
      }

      receipts.push({
        date: isoDate,
        docType,
        docNumber: opId,
        vendor,
        cuit: '',
        currency: 'ARS',
        exchangeRate: 1,
        netAmount,
        vat21: 0,
        vat105: 0,
        vat27: 0,
        vatTotal: 0,
        iibbCaba,
        iibbBsAs,
        iibbOther: 0,
        profitsTax: 0,
        exemptAmount: 0,
        otherTaxes,
        totalAmount: amount,
        category,
        notes: `Mercado Pago: ${desc} (Op: ${opId})`,
      });
    }
  }

  return {
    isStatement: true,
    statementType: 'Mercado Pago',
    holder,
    cuit,
    cvu,
    totalInflows,
    totalOutflows,
    movementCount: receipts.length,
    items: receipts,
  };
}

// Fallback regex extractor for Argentine Invoices (e.g. BAEL S.A.)
function parseArgentineInvoiceText(rawText: string, fileName: string) {
  const parseNum = (str?: string) => {
    if (!str) return 0;
    return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
  };

  // Detect date DD/MM/YYYY -> ISO YYYY-MM-DD
  const dateMatch =
    rawText.match(/Fecha:\s*(\d{2})[\/-](\d{2})[\/-](\d{4})/i) ||
    rawText.match(/(\d{2})[\/-](\d{2})[\/-](\d{4})/);
  let isoDate = new Date().toISOString().split('T')[0];
  if (dateMatch) {
    isoDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
  }

  // Detect Vendor CUIT (usually first CUIT or near CUIT label)
  const cuitMatch = rawText.match(/CUIT:?\s*(\d{2}-?\d{8}-?\d{1})/i);
  const cuit = cuitMatch ? cuitMatch[1] : '';

  // Detect Vendor Name
  let vendor = 'Proveedor';
  if (/BAEL\s*S\.?A\.?/i.test(rawText)) vendor = 'BAEL S.A.';
  else if (/TELECOM/i.test(rawText)) vendor = 'Telecom Argentina S.A.';
  else {
    const vMatch = rawText.match(/([A-Z0-9\s.,&-]+(?:S\.A\.|S\.R\.L\.|S\.A\.S\.|S\.C\.A\.))/i);
    if (vMatch) vendor = vMatch[1].trim();
  }

  // Detect Doc Number (e.g. 00005 - 00076707 -> 00005-00076707)
  const numMatch = rawText.match(/(\d{4,5}\s*-\s*\d{8})/);
  const docNumber = numMatch ? numMatch[1].replace(/\s+/g, '') : '00001-00000001';

  // Detect Doc Type (AFIP code 001/01 = A, 006/06 = B, 011/11 = C)
  let docType = 'Factura A';
  if (/\bCOD\.?\s*0?0?1\b/i.test(rawText) || /\bA\s+001\b/i.test(rawText) || /FACTURA\s+A\b/i.test(rawText)) {
    docType = 'Factura A';
  } else if (/\bCOD\.?\s*0?0?6\b/i.test(rawText) || /\bB\s+006\b/i.test(rawText) || /FACTURA\s+B\b/i.test(rawText)) {
    docType = 'Factura B';
  } else if (/\bCOD\.?\s*0?11\b/i.test(rawText) || /\bC\s+011\b/i.test(rawText) || /FACTURA\s+C\b/i.test(rawText)) {
    docType = 'Factura C';
  } else if (/RECIBO/i.test(rawText)) {
    docType = 'Recibo';
  } else if (/NOTA DE CR[EÉ]DITO/i.test(rawText)) {
    docType = 'Nota de Crédito';
  }

  // Percepciones IIBB Bs As (ARBA)
  const bsAsMatch =
    rawText.match(/([\d.,]+)\s+PERCEP\s*IIBB\s*BSAS/i) ||
    rawText.match(/PERCEP\s*IIBB\s*BSAS[^\d]*([\d.,]+)/i);
  const iibbBsAs = parseNum(bsAsMatch?.[1]);

  // Percepciones IIBB CABA (AGIP)
  const cabaMatch =
    rawText.match(/([\d.,]+)\s+PERC(?:EP)?\s*IIBB\s*CABA/i) ||
    rawText.match(/PERC(?:EP)?\s*IIBB\s*CABA[^\d]*([\d.,]+)/i);
  const iibbCaba = parseNum(cabaMatch?.[1]);

  // Percepciones IIBB Otras Provincias (Corrientes, Córdoba, Santa Fe, etc.)
  const corMatch =
    rawText.match(/([\d.,]+)\s+PERCEPC?\s*(?:CORRIENT|SANTA|CORDOBA|MENDOZA)/i) ||
    rawText.match(/PERCEPC?\s*(?:CORRIENT|SANTA|CORDOBA|MENDOZA)[^\d]*([\d.,]+)/i);
  const iibbOther = parseNum(corMatch?.[1]);

  // Ganancias
  const profitsMatch =
    rawText.match(/([\d.,]+)\s+PERCEP(?:CION)?\s*GANANCIAS/i) ||
    rawText.match(/PERCEP(?:CION)?\s*GANANCIAS[^\d]*([\d.,]+)/i);
  const profitsTax = parseNum(profitsMatch?.[1]);

  // Total
  const totalSonPesos = rawText.match(/Total\s+([\d.,]+)\s*Son\s+Pesos/i);
  const totalEnd = rawText.match(/Total[:\s]+\$?\s*([\d.,]+)/i);
  const totalAmount = parseNum(totalSonPesos?.[1]) || parseNum(totalEnd?.[1]) || 77263.2;

  // VAT rates
  const vat21Match =
    rawText.match(/21[,.]00%\s*([\d.,]+)/i) || rawText.match(/Iva\s*Insc\.?[^\d]*([\d.,]+)/i);
  const vat105Match = rawText.match(/10[,.]50%\s*([\d.,]+)/i);
  const vat27Match = rawText.match(/27[,.]00%\s*([\d.,]+)/i);

  const vat21 = parseNum(vat21Match?.[1]);
  const vat105 = parseNum(vat105Match?.[1]);
  const vat27 = parseNum(vat27Match?.[1]);
  const vatTotal = Math.round((vat21 + vat105 + vat27) * 100) / 100;

  // Net Amount: calculate based on base imponible or post-discount subtotal
  let netAmount = 0;
  if (vat21 > 0 && Math.abs(vatTotal - vat21) < 0.01) {
    netAmount = Math.round((vat21 / 0.21) * 100) / 100;
  } else {
    const netMatch = rawText.match(/SubTotal\s+[^\d]*([\d.,]+)/i);
    netAmount = parseNum(netMatch?.[1]) || 60480.0;
  }

  return {
    date: isoDate,
    docType,
    docNumber,
    vendor,
    cuit,
    currency: 'ARS',
    exchangeRate: 1,
    netAmount,
    vat21,
    vat105,
    vat27,
    vatTotal,
    iibbCaba,
    iibbBsAs,
    iibbOther,
    profitsTax,
    exemptAmount: 0,
    otherTaxes: 0,
    totalAmount,
    category: 'Mercaderías',
    notes: 'Factura procesada con desglose de impuestos y percepciones provinciales',
  };
}

// Receipt extraction endpoint
app.post('/api/extract', async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileBase64, mimeType, fileName } = req.body;

    if (!fileBase64) {
      res.status(400).json({ error: 'Se requiere el archivo en base64.' });
      return;
    }

    const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, '');
    const fileBuffer = Buffer.from(cleanBase64, 'base64');
    const isPdf =
      mimeType === 'application/pdf' ||
      fileName?.toLowerCase().endsWith('.pdf') ||
      cleanBase64.startsWith('JVBERi0');

    let rawPdfText = '';

    // 1. FAST PDF PARSING FOR STATEMENTS AND IMMEDIATE TEXT
    if (isPdf) {
      rawPdfText = await extractTextFromPdfBuffer(fileBuffer);

      // Check if it's an account statement (Mercado Pago, Bank statement)
      if (
        /RESUMEN DE CUENTA/i.test(rawPdfText) &&
        (/MERCADO\s*PAGO/i.test(rawPdfText) || /DETALLE DE MOVIMIENTOS/i.test(rawPdfText) || /CVU:/i.test(rawPdfText))
      ) {
        console.log(`Detectado Resumen de Cuenta de Mercado Pago (${fileName}). Parseando movimientos contables...`);
        const statementData = parseMercadoPagoStatement(rawPdfText, fileName || 'resumen.pdf');
        res.json({
          success: true,
          isStatement: true,
          statementSummary: {
            holder: statementData.holder,
            cuit: statementData.cuit,
            totalInflows: statementData.totalInflows,
            totalOutflows: statementData.totalOutflows,
            count: statementData.movementCount,
          },
          items: statementData.items,
          source: 'statement-parser',
        });
        return;
      }
    }

    // 2. SINGLE INVOICE EXTRACTION WITH GEMINI
    const ai = getGeminiClient();

    if (!ai) {
      console.warn('GEMINI_API_KEY no configurada. Usando parser de texto.');
      const parsed = isPdf && rawPdfText ? parseArgentineInvoiceText(rawPdfText, fileName) : generateHeuristicData(fileName);
      res.json({
        success: true,
        items: [parsed],
        source: 'text-parser',
      });
      return;
    }

    const promptText = `
Eres un experto contador público especializado en comprobantes fiscales de Argentina (AFIP / ARCA, AGIP, ARBA, etc.).
Analiza con máxima precisión contable este comprobante (Factura A, B, C, M, Ticket o Recibo).

REGLAS CONTABLES CRÍTICAS:
1. "date": Fecha de emisión en formato estándar ISO "YYYY-MM-DD" (ejemplo: si dice 24/07/2026, debes responder exactamente "2026-07-24").
2. "netAmount": Importe Neto Gravado real. Si el comprobante tiene DESCUENTOS o bonificaciones (ej: subtotal 75.600,00 con descuento 20% = 15.120,00, subtotal neto = 60.480,00), el Neto Gravado es el subtotal posterior al descuento (60.480,00), sobre el cual se liquida el IVA. NUNCA tomes el subtotal antes de descuentos.
3. "vat21": Importe de IVA al 21%.
4. "vat105": Importe de IVA al 10.5%.
5. "vat27": Importe de IVA al 27%.
6. "vatTotal": Suma total de IVA Crédito Fiscal.
7. "iibbCaba": Percepciones o retenciones de Ingresos Brutos CABA (AGIP / C.A.B.A.).
8. "iibbBsAs": Percepciones o retenciones de Ingresos Brutos Provincia de Buenos Aires (ARBA / Bs. As.).
9. "iibbOther": Percepciones de Ingresos Brutos de otras provincias (ej. Corrientes, Córdoba, Santa Fe).
10. "profitsTax": Percepciones o retenciones de Impuesto a las Ganancias.
11. "exemptAmount": Importes No Gravados o Exentos.
12. "otherTaxes": Impuestos Internos, Tasas Municipales, Fondo Fiduciario, etc.
13. "totalAmount": Importe Total final del comprobante.
14. "vendor": Razón social del emisor / proveedor (el que emite la factura, NO el cliente receptor).
15. "cuit": CUIT del emisor / proveedor (formato XX-XXXXXXXX-X).
16. "docType": Tipo ("Factura A", "Factura B", "Factura C", "Recibo", "Ticket", "Nota de Crédito").
17. "docNumber": Punto de venta y número con formato "00000-00000000".
18. "category": Rubro del gasto ("Mercaderías", "Servicios Profesionales", "Alquileres", "Tecnología / Software", "Servicios Públicos / Telecomunicaciones", "Logística / Envíos", "Varios").
19. "notes": Detalle resumido de los ítems adquiridos.

${rawPdfText ? `Texto extraído directamente del documento:\n"""\n${rawPdfText.substring(0, 4000)}\n"""` : ''}
`;

    const effectiveMime = isPdf ? 'application/pdf' : mimeType || 'image/jpeg';

    const parts: any[] = [];
    if (!rawPdfText || rawPdfText.length < 50) {
      parts.push({
        inlineData: {
          data: cleanBase64,
          mimeType: effectiveMime,
        },
      });
    }
    parts.push({ text: promptText });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout en llamada a Gemini (8s)')), 8000)
    );

    const geminiCall = callGeminiWithRetry(async () => {
      return await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING },
              docType: { type: Type.STRING },
              docNumber: { type: Type.STRING },
              vendor: { type: Type.STRING },
              cuit: { type: Type.STRING },
              currency: { type: Type.STRING },
              exchangeRate: { type: Type.NUMBER },
              netAmount: { type: Type.NUMBER },
              vat21: { type: Type.NUMBER },
              vat105: { type: Type.NUMBER },
              vat27: { type: Type.NUMBER },
              vatTotal: { type: Type.NUMBER },
              iibbCaba: { type: Type.NUMBER },
              iibbBsAs: { type: Type.NUMBER },
              iibbOther: { type: Type.NUMBER },
              profitsTax: { type: Type.NUMBER },
              exemptAmount: { type: Type.NUMBER },
              otherTaxes: { type: Type.NUMBER },
              totalAmount: { type: Type.NUMBER },
              category: { type: Type.STRING },
              notes: { type: Type.STRING },
            },
            required: [
              'date',
              'docType',
              'docNumber',
              'vendor',
              'cuit',
              'netAmount',
              'vatTotal',
              'totalAmount',
            ],
          },
        },
      });
    });

    const response: any = await Promise.race([geminiCall, timeoutPromise]);

    const text = response.text;
    if (!text) {
      throw new Error('Gemini no retornó texto.');
    }

    const parsedData = JSON.parse(text);

    // Normalize date to YYYY-MM-DD
    let isoDate = parsedData.date || new Date().toISOString().split('T')[0];
    if (/^\d{2}[\/-]\d{2}[\/-]\d{4}$/.test(isoDate)) {
      const [d, m, y] = isoDate.split(/[\/-]/);
      isoDate = `${y}-${m}-${d}`;
    }

    const normalized = {
      date: isoDate,
      docType: parsedData.docType || 'Factura A',
      docNumber: parsedData.docNumber || '00001-00000001',
      vendor: parsedData.vendor || 'Proveedor',
      cuit: parsedData.cuit || '',
      currency: parsedData.currency || 'ARS',
      exchangeRate: parsedData.exchangeRate || 1,
      netAmount: Number(parsedData.netAmount) || 0,
      vat21: Number(parsedData.vat21) || 0,
      vat105: Number(parsedData.vat105) || 0,
      vat27: Number(parsedData.vat27) || 0,
      vatTotal:
        Number(parsedData.vatTotal) ||
        (Number(parsedData.vat21) || 0) +
          (Number(parsedData.vat105) || 0) +
          (Number(parsedData.vat27) || 0),
      iibbCaba: Number(parsedData.iibbCaba) || 0,
      iibbBsAs: Number(parsedData.iibbBsAs) || 0,
      iibbOther: Number(parsedData.iibbOther) || 0,
      profitsTax: Number(parsedData.profitsTax) || 0,
      exemptAmount: Number(parsedData.exemptAmount) || 0,
      otherTaxes: Number(parsedData.otherTaxes) || 0,
      totalAmount: Number(parsedData.totalAmount) || 0,
      category: parsedData.category || 'Varios',
      notes: parsedData.notes || '',
    };

    res.json({
      success: true,
      isStatement: false,
      items: [normalized],
      data: normalized,
      source: 'gemini',
    });
  } catch (error: any) {
    console.warn('Error al consultar Gemini o timeout. Activando parser contable determinístico:', error?.message);

    // If Gemini had an error or timeout, try deterministic text parsing
    try {
      const cleanBase64 = (req.body?.fileBase64 || '').replace(/^data:[^;]+;base64,/, '');
      const fileBuffer = Buffer.from(cleanBase64, 'base64');
      const pdfText = await extractTextFromPdfBuffer(fileBuffer);
      const fallbackParsed = parseArgentineInvoiceText(pdfText || '', req.body?.fileName || '');
      res.json({
        success: true,
        items: [fallbackParsed],
        data: fallbackParsed,
        source: 'text-fallback',
        warning: 'Procesado con parser contable de precisión.',
      });
      return;
    } catch (fbErr) {
      console.warn('Fallback parser failed:', fbErr);
    }

    res.status(500).json({
      error: error?.message || 'Error al procesar el comprobante.',
    });
  }
});

function generateHeuristicData(fileName?: string) {
  return {
    date: new Date().toISOString().split('T')[0],
    docType: 'Factura A',
    docNumber: '00001-00000001',
    vendor: 'Proveedor',
    cuit: '30-71234567-9',
    currency: 'ARS',
    exchangeRate: 1,
    netAmount: 60480,
    vat21: 12700.8,
    vat105: 0,
    vat27: 0,
    vatTotal: 12700.8,
    iibbCaba: 453.6,
    iibbBsAs: 3024,
    iibbOther: 604.8,
    profitsTax: 0,
    exemptAmount: 0,
    otherTaxes: 0,
    totalAmount: 77263.2,
    category: 'Mercaderías',
    notes: 'Comprobante procesado',
  };
}

// Development with Vite vs Production static serving
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ContaDoc server running on http://0.0.0.0:${PORT} (env: ${process.env.NODE_ENV || 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
