import { GoogleGenAI, Type } from '@google/genai';

interface ExtractBody {
  fileBase64?: string;
  mimeType?: string;
  fileName?: string;
}

function parseNum(str?: string): number {
  if (!str) return 0;
  return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
}

async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  try {
    // Lazy import to avoid crashing the whole function if pdf-parse fails in serverless
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    const textResult = await parser.getText();
    if (typeof (parser as any).destroy === 'function') {
      await (parser as any).destroy();
    }
    return textResult?.text || '';
  } catch (err: any) {
    console.warn('PDF text extraction skipped:', err?.message || err);
    return '';
  }
}

function parseMercadoPagoStatement(rawText: string, _fileName: string) {
  const holderMatch = rawText.match(/RESUMEN DE CUENTA EN PESOS\s+([^\n\r]+)/);
  const cuitMatch = rawText.match(/CUIT\/\s*CUIL:\s*(\d{11})/);
  const cvuMatch = rawText.match(/CVU:\s*(\d{22})/);

  const holder = holderMatch ? holderMatch[1].trim() : 'Titular';
  const cuit = cuitMatch ? cuitMatch[1] : '';
  const cvu = cvuMatch ? cvuMatch[1] : '';

  const inMatch = rawText.match(/Entradas:\s*\$\s*([\d.,]+)/);
  const outMatch = rawText.match(/Salidas:\s*\$\s*-?([\d.,]+)/);

  const totalInflows = parseNum(inMatch?.[1]);
  const totalOutflows = parseNum(outMatch?.[1]);

  const regex =
    /(\d{2})-(\d{2})-(\d{4})\s+([\s\S]+?)\s+(\d{9,15})\s+\$\s*(-?[\d.,]+)\s+\$\s*(-?[\d.,]+)/g;
  let match;
  const receipts: any[] = [];

  while ((match = regex.exec(rawText)) !== null) {
    const day = match[1];
    const month = match[2];
    const year = match[3];
    const isoDate = `${year}-${month}-${day}`;
    const desc = match[4].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    const opId = match[5];
    const rawVal = parseNum(match[6]);
    const isOutflow = match[6].includes('-') || rawVal < 0;
    const amount = Math.round(Math.abs(rawVal) * 100) / 100;

    if (isOutflow && amount > 0) {
      let vendor = desc;
      let category = 'Varios';
      let docType = 'Comprobante de Pago';
      let iibbCaba = 0;
      let iibbBsAs = 0;
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
      } else if (/Pago con QR/i.test(desc)) {
        vendor = desc.replace(/Pago con QR\s*/i, '');
        category = 'Proveedores / Compras';
        docType = 'Ticket';
        netAmount = amount;
      } else if (/Transferencia enviada/i.test(desc)) {
        vendor = desc.replace(/Transferencia enviada\s*/i, '');
        category = 'Transferencias a Proveedores';
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
        otherTaxes: 0,
        totalAmount: amount,
        category,
        notes: `Mercado Pago: ${desc} (Op: ${opId})`,
      });
    }
  }

  return {
    isStatement: true,
    holder,
    cuit,
    cvu,
    totalInflows,
    totalOutflows,
    movementCount: receipts.length,
    items: receipts,
  };
}

function parseArgentineInvoiceText(rawText: string, _fileName: string) {
  const dateMatch =
    rawText.match(/Fecha:\s*(\d{2})[\/-](\d{2})[\/-](\d{4})/i) ||
    rawText.match(/(\d{2})[\/-](\d{2})[\/-](\d{4})/);
  let isoDate = new Date().toISOString().split('T')[0];
  if (dateMatch) {
    isoDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
  }

  const cuitMatch = rawText.match(/CUIT:?\s*(\d{2}-?\d{8}-?\d{1})/i);
  const cuit = cuitMatch ? cuitMatch[1] : '';

  let vendor = 'Proveedor';
  if (/BAEL\s*S\.?A\.?/i.test(rawText)) vendor = 'BAEL S.A.';
  else if (/TELECOM/i.test(rawText)) vendor = 'Telecom Argentina S.A.';
  else {
    const vMatch = rawText.match(/([A-Z0-9\s.,&-]+(?:S\.A\.|S\.R\.L\.|S\.A\.S\.|S\.C\.A\.))/i);
    if (vMatch) vendor = vMatch[1].trim();
  }

  const numMatch = rawText.match(/(\d{4,5}\s*-\s*\d{8})/);
  const docNumber = numMatch ? numMatch[1].replace(/\s+/g, '') : '00001-00000001';

  let docType = 'Factura A';
  if (/FACTURA\s+A\b/i.test(rawText) || /\bCOD\.?\s*0?0?1\b/i.test(rawText)) docType = 'Factura A';
  else if (/FACTURA\s+B\b/i.test(rawText) || /\bCOD\.?\s*0?0?6\b/i.test(rawText)) docType = 'Factura B';
  else if (/FACTURA\s+C\b/i.test(rawText) || /\bCOD\.?\s*0?11\b/i.test(rawText)) docType = 'Factura C';
  else if (/RECIBO/i.test(rawText)) docType = 'Recibo';
  else if (/NOTA DE CR[EÉ]DITO/i.test(rawText)) docType = 'Nota de Crédito';

  const bsAsMatch =
    rawText.match(/([\d.,]+)\s+PERCEP\s*IIBB\s*BSAS/i) ||
    rawText.match(/PERCEP\s*IIBB\s*BSAS[^\d]*([\d.,]+)/i);
  const iibbBsAs = parseNum(bsAsMatch?.[1]);

  const cabaMatch =
    rawText.match(/([\d.,]+)\s+PERC(?:EP)?\s*IIBB\s*CABA/i) ||
    rawText.match(/PERC(?:EP)?\s*IIBB\s*CABA[^\d]*([\d.,]+)/i);
  const iibbCaba = parseNum(cabaMatch?.[1]);

  const profitsMatch =
    rawText.match(/([\d.,]+)\s+PERCEP(?:CION)?\s*GANANCIAS/i) ||
    rawText.match(/PERCEP(?:CION)?\s*GANANCIAS[^\d]*([\d.,]+)/i);
  const profitsTax = parseNum(profitsMatch?.[1]);

  const totalSonPesos = rawText.match(/Total\s+([\d.,]+)\s*Son\s+Pesos/i);
  const totalEnd = rawText.match(/Total[:\s]+\$?\s*([\d.,]+)/i);
  const totalAmount = parseNum(totalSonPesos?.[1]) || parseNum(totalEnd?.[1]) || 0;

  const vat21Match =
    rawText.match(/21[,.]00%\s*([\d.,]+)/i) || rawText.match(/Iva\s*Insc\.?[^\d]*([\d.,]+)/i);
  const vat105Match = rawText.match(/10[,.]50%\s*([\d.,]+)/i);
  const vat27Match = rawText.match(/27[,.]00%\s*([\d.,]+)/i);

  const vat21 = parseNum(vat21Match?.[1]);
  const vat105 = parseNum(vat105Match?.[1]);
  const vat27 = parseNum(vat27Match?.[1]);
  const vatTotal = Math.round((vat21 + vat105 + vat27) * 100) / 100;

  let netAmount = 0;
  if (vat21 > 0 && Math.abs(vatTotal - vat21) < 0.01) {
    netAmount = Math.round((vat21 / 0.21) * 100) / 100;
  } else {
    const netMatch = rawText.match(/SubTotal\s+[^\d]*([\d.,]+)/i);
    netAmount = parseNum(netMatch?.[1]) || 0;
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
    iibbOther: 0,
    profitsTax,
    exemptAmount: 0,
    otherTaxes: 0,
    totalAmount,
    category: 'Mercaderías',
    notes: 'Factura procesada con desglose de impuestos',
  };
}

function emptyReceipt(fileName?: string) {
  return {
    date: new Date().toISOString().split('T')[0],
    docType: 'Factura A',
    docNumber: '00001-00000001',
    vendor: 'Proveedor',
    cuit: '',
    currency: 'ARS',
    exchangeRate: 1,
    netAmount: 0,
    vat21: 0,
    vat105: 0,
    vat27: 0,
    vatTotal: 0,
    iibbCaba: 0,
    iibbBsAs: 0,
    iibbOther: 0,
    profitsTax: 0,
    exemptAmount: 0,
    otherTaxes: 0,
    totalAmount: 0,
    category: 'Varios',
    notes: fileName ? `Archivo: ${fileName}` : 'Sin datos extraídos',
  };
}

function jsonResponse(statusCode: number, data: any) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
    body: JSON.stringify(data),
  };
}

export const handler = async (event: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(204, {});
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const body: ExtractBody = JSON.parse(event.body || '{}');
    const { fileBase64, mimeType, fileName } = body;

    if (!fileBase64) {
      return jsonResponse(400, { error: 'Se requiere el archivo en base64.' });
    }

    const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, '');
    const fileBuffer = Buffer.from(cleanBase64, 'base64');
    const isPdf =
      mimeType === 'application/pdf' ||
      (fileName || '').toLowerCase().endsWith('.pdf') ||
      cleanBase64.startsWith('JVBERi0');

    let rawPdfText = '';
    if (isPdf) {
      rawPdfText = await extractTextFromPdfBuffer(fileBuffer);

      if (
        /RESUMEN DE CUENTA/i.test(rawPdfText) &&
        (/MERCADO\s*PAGO/i.test(rawPdfText) || /CVU:/i.test(rawPdfText))
      ) {
        const statementData = parseMercadoPagoStatement(rawPdfText, fileName || 'resumen.pdf');
        return jsonResponse(200, {
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
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.warn('GEMINI_API_KEY no configurada');
      const parsed =
        isPdf && rawPdfText.length > 30
          ? parseArgentineInvoiceText(rawPdfText, fileName || '')
          : emptyReceipt(fileName);
      return jsonResponse(200, {
        success: true,
        items: [parsed],
        source: 'text-parser',
        warning: 'GEMINI_API_KEY no configurada',
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const promptText = `Eres un experto contador público de Argentina (AFIP/ARCA, AGIP, ARBA).
Analiza este comprobante y extrae los datos contables con precisión.

REGLAS:
- date: ISO YYYY-MM-DD
- netAmount: neto gravado (después de descuentos)
- vat21, vat105, vat27, vatTotal
- iibbCaba, iibbBsAs, iibbOther, profitsTax
- totalAmount, vendor, cuit, docType, docNumber, category, notes

${rawPdfText ? `Texto extraído:\n"""\n${rawPdfText.substring(0, 3500)}\n"""` : 'Analizá el archivo adjunto.'}`;

    const effectiveMime = isPdf ? 'application/pdf' : mimeType || 'image/jpeg';
    const parts: any[] = [];

    if (!rawPdfText || rawPdfText.length < 80) {
      parts.push({
        inlineData: {
          data: cleanBase64,
          mimeType: effectiveMime,
        },
      });
    }
    parts.push({ text: promptText });

    const response: any = await ai.models.generateContent({
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
          required: ['date', 'docType', 'docNumber', 'vendor', 'netAmount', 'vatTotal', 'totalAmount'],
        },
      },
    });

    const text = response?.text;
    if (!text) {
      throw new Error('Gemini no retornó texto');
    }

    const parsedData = JSON.parse(text);

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
      exchangeRate: Number(parsedData.exchangeRate) || 1,
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

    return jsonResponse(200, {
      success: true,
      isStatement: false,
      items: [normalized],
      data: normalized,
      source: 'gemini',
    });
  } catch (error: any) {
    console.error('Error en extract:', error?.message || error);

    try {
      const body: ExtractBody = JSON.parse(event.body || '{}');
      const cleanBase64 = (body.fileBase64 || '').replace(/^data:[^;]+;base64,/, '');
      const fileBuffer = Buffer.from(cleanBase64, 'base64');
      const pdfText = await extractTextFromPdfBuffer(fileBuffer);

      if (pdfText && pdfText.length > 30) {
        const fallback = parseArgentineInvoiceText(pdfText, body.fileName || '');
        return jsonResponse(200, {
          success: true,
          items: [fallback],
          data: fallback,
          source: 'text-fallback',
          warning: error?.message || 'Fallback por error de Gemini',
        });
      }
    } catch (fbErr: any) {
      console.warn('Fallback failed:', fbErr?.message);
    }

    return jsonResponse(500, {
      error: error?.message || 'Error al procesar el comprobante.',
    });
  }
};
