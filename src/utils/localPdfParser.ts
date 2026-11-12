import * as pdfjsLib from 'pdfjs-dist';
import type { Receipt } from '../types/receipt';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

type PdfItem = { str: string; x: number; y: number; width: number };
type PdfLine = { y: number; text: string; cells: { x: number; text: string }[] };

const amount = (value?: string) =>
  value ? Number.parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0 : 0;

const excelDate = (day: string, month: string, year: string) =>
  `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

function groupLines(items: PdfItem[]): PdfLine[] {
  const lines: { y: number; items: PdfItem[] }[] = [];
  for (const item of items.filter((part) => part.str.trim()).sort((a, b) => a.y - b.y || a.x - b.x)) {
    const line = lines[lines.length - 1];
    if (line && Math.abs(line.y - item.y) < 2.5) line.items.push(item);
    else lines.push({ y: item.y, items: [item] });
  }
  return lines.map((line) => {
    line.items.sort((a, b) => a.x - b.x);
    let text = '';
    let previousEnd: number | null = null;
    const cells: { x: number; text: string }[] = [];
    for (const item of line.items) {
      const gap = previousEnd === null ? 0 : item.x - previousEnd;
      if (previousEnd !== null && gap > 1) text += ' ';
      text += item.str;
      if (previousEnd === null || gap > 12) cells.push({ x: item.x, text: item.str });
      else cells[cells.length - 1].text += (gap > 1 ? ' ' : '') + item.str;
      previousEnd = item.x + item.width;
    }
    return { y: line.y, text: text.trim(), cells };
  });
}

async function readPdf(file: File): Promise<PdfLine[][]> {
  const document = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: PdfLine[][] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items.flatMap((raw: any) =>
      typeof raw.str === 'string'
        ? [{ str: raw.str, x: raw.transform[4], y: -raw.transform[5], width: raw.width }]
        : [],
    );
    pages.push(groupLines(items));
  }
  return pages;
}

const blankReceipt = (file: File, index = 0): Receipt => ({
  id: `rec-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
  fileName: file.name,
  fileType: file.type === 'application/pdf' ? 'pdf' : 'image',
  fileDataUrl: '',
  date: new Date().toISOString().slice(0, 10),
  docType: 'Otro',
  docNumber: '',
  vendor: 'Revisar proveedor',
  cuit: '',
  currency: 'ARS',
  exchangeRate: 1,
  netAmount: 0, vat21: 0, vat105: 0, vat27: 0, vatTotal: 0,
  iibbCaba: 0, iibbBsAs: 0, iibbOther: 0, profitsTax: 0,
  exemptAmount: 0, otherTaxes: 0, totalAmount: 0,
  category: 'Varios',
  notes: 'No se detectaron datos automáticamente. Revisar y completar manualmente.',
  status: 'manual',
  createdAt: Date.now(),
});

function parseMercadoPago(pages: PdfLine[][], file: File): Receipt[] {
  const receipts: Receipt[] = [];
  for (const lines of pages) {
    const anchors = lines.flatMap((line) => {
      const match = /^(\d{2})-(\d{2})-(\d{4})\s*(.*?)\s*(\d{9,})\s+\$\s*(-?[\d.]*\d,\d{2})\s+\$\s*(-?[\d.]*\d,\d{2})$/.exec(line.text);
      return match ? [{ y: line.y, match, above: [] as string[], below: [] as string[] }] : [];
    });
    for (const line of lines) {
      if (/^\d{2}-\d{2}-\d{4}\s/.test(line.text)) continue;
      let closest: (typeof anchors)[number] | undefined;
      let distance = 14;
      for (const anchor of anchors) {
        const current = Math.abs(anchor.y - line.y);
        if (current < distance) { distance = current; closest = anchor; }
      }
      if (closest) (line.y < closest.y ? closest.above : closest.below).push(line.text);
    }
    for (const anchor of anchors) {
      const [, day, month, year, middle, operationId, value, balance] = anchor.match;
      const description = [...anchor.above, middle, ...anchor.below].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      const movement = amount(value);
      // El reporte contable registra egresos; los ingresos quedan fuera del listado de compras.
      if (movement >= 0) continue;
      const cost = Math.abs(movement);
      let vendor = description;
      let category = 'Varios';
      let iibbCaba = 0;
      let iibbBsAs = 0;
      let netAmount = cost;
      if (/IIBB de Bs\.?\s*As\.?/i.test(description)) {
        vendor = 'ARBA - IIBB Buenos Aires'; category = 'Impuestos Provinciales'; iibbBsAs = cost; netAmount = 0;
      } else if (/IIBB de CABA/i.test(description)) {
        vendor = 'AGIP - IIBB CABA'; category = 'Impuestos Provinciales'; iibbCaba = cost; netAmount = 0;
      } else if (/TELECOM/i.test(description)) {
        vendor = 'Telecom Argentina S.A.'; category = 'Servicios Públicos / Telecomunicaciones';
      } else if (/CEAMSE/i.test(description)) {
        vendor = 'CEAMSE - Gestión Ambiental'; category = 'Servicios Públicos / Residuos';
      } else if (/AUSOL|AUSA|AU Oeste|AUBASA|TelePASE|RUTAS SUR/i.test(description)) {
        category = 'Logística / Peajes';
      } else if (/SUBE/i.test(description)) {
        vendor = 'SUBE - Transporte Público'; category = 'Logística / Transporte';
      } else if (/Google|netflix|spotify/i.test(description)) {
        category = 'Tecnología / Software';
      } else if (/Pago con QR/i.test(description)) {
        vendor = description.replace(/Pago con QR\s*/i, ''); category = 'Proveedores / Compras';
      } else if (/Transferencia enviada/i.test(description)) {
        vendor = description.replace(/Transferencia enviada\s*/i, ''); category = 'Transferencias a Proveedores';
      } else if (/Créditos de Mercado Pago/i.test(description)) {
        vendor = 'Mercado Pago Créditos'; category = 'Gastos Financieros';
      }
      receipts.push({
        ...blankReceipt(file, receipts.length),
        date: excelDate(day, month, year),
        docType: /Pago con QR/i.test(description) ? 'Ticket' : 'Comprobante de Pago',
        docNumber: operationId,
        vendor,
        netAmount,
        iibbCaba,
        iibbBsAs,
        totalAmount: cost,
        category,
        notes: `Mercado Pago: ${description} (Op: ${operationId}). Saldo informado: ${balance}`,
        status: 'procesado',
      });
    }
  }
  return receipts;
}

function parseInvoice(text: string, file: File): Receipt {
  const receipt = blankReceipt(file);
  const date = /Fecha:\s*(\d{2})[\/-](\d{2})[\/-](\d{4})/i.exec(text)
    || /(\d{2})[\/-](\d{2})[\/-](\d{4})/.exec(text);
  if (date) receipt.date = excelDate(date[1], date[2], date[3]);

  const cuit = /CUIT:?\s*(\d{2}-?\d{8}-?\d{1})/i.exec(text);
  if (cuit) receipt.cuit = cuit[1];
  if (/BAEL\s*S\.?A\.?/i.test(text)) receipt.vendor = 'BAEL S.A.';
  else if (/TELECOM/i.test(text)) receipt.vendor = 'Telecom Argentina S.A.';
  else {
    const vendor = /([A-Z0-9\s.,&-]+(?:S\.A\.|S\.R\.L\.|S\.A\.S\.|S\.C\.A\.))/i.exec(text);
    if (vendor) receipt.vendor = vendor[1].trim();
  }

  const number = /(\d{4,5}\s*-\s*\d{8})/.exec(text);
  if (number) receipt.docNumber = number[1].replace(/\s/g, '');
  if (/NOTA DE CR[EÉ]DITO/i.test(text)) receipt.docType = 'Nota de Crédito';
  else if (/NOTA DE D[EÉ]BITO/i.test(text)) receipt.docType = 'Nota de Débito';
  else if (/FACTURA\s+B\b|\bCOD\.?\s*0?06\b/i.test(text)) receipt.docType = 'Factura B';
  else if (/FACTURA\s+C\b|\bCOD\.?\s*011\b/i.test(text)) receipt.docType = 'Factura C';
  else if (/FACTURA\s+A\b|\bCOD\.?\s*001\b/i.test(text)) receipt.docType = 'Factura A';
  else if (/RECIBO/i.test(text)) receipt.docType = 'Recibo';

  const find = (patterns: RegExp[]) => {
    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match) return amount(match[1]);
    }
    return 0;
  };
  receipt.iibbBsAs = find([/([\d.,]+)\s+PERCEP\s*IIBB\s*BSAS/i, /PERCEP\s*IIBB\s*BSAS[^\d]*([\d.,]+)/i]);
  receipt.iibbCaba = find([/([\d.,]+)\s+PERC(?:EP)?\s*IIBB\s*CABA/i, /PERC(?:EP)?\s*IIBB\s*CABA[^\d]*([\d.,]+)/i]);
  receipt.iibbOther = find([/([\d.,]+)\s+PERCEPC?\s*(?:CORRIENT|SANTA|CORDOBA|MENDOZA)/i, /PERCEPC?\s*(?:CORRIENT|SANTA|CORDOBA|MENDOZA)[^\d]*([\d.,]+)/i]);
  receipt.profitsTax = find([/([\d.,]+)\s+PERCEP(?:CION)?\s*GANANCIAS/i, /PERCEP(?:CION)?\s*GANANCIAS[^\d]*([\d.,]+)/i]);
  receipt.vat21 = find([/21[,.]00%\s*([\d.,]+)/i, /Iva\s*Insc\.?[^\d]*([\d.,]+)/i]);
  receipt.vat105 = find([/10[,.]50%\s*([\d.,]+)/i]);
  receipt.vat27 = find([/27[,.]00%\s*([\d.,]+)/i]);
  receipt.vatTotal = receipt.vat21 + receipt.vat105 + receipt.vat27;
  receipt.netAmount = find([/SubTotal\s+[^\d]*([\d.,]+)/i, /Neto Gravado[^\d]*([\d.,]+)/i]);
  if (!receipt.netAmount && receipt.vat21) receipt.netAmount = Math.round((receipt.vat21 / 0.21) * 100) / 100;
  receipt.totalAmount = find([/Total\s+([\d.,]+)\s*Son\s+Pesos/i, /Total[:\s]+\$?\s*([\d.,]+)/i]);
  receipt.category = 'Mercaderías';
  receipt.notes = 'Extracción automática por reglas de texto. Verificar todos los importes antes de contabilizar.';
  receipt.status = 'procesado';
  if (!receipt.totalAmount && !receipt.netAmount && !receipt.vatTotal) {
    receipt.status = 'manual';
    receipt.notes = 'El PDF no contiene texto reconocible (puede ser un escaneo) o su formato no está contemplado. Completar manualmente.';
  }
  return receipt;
}

export async function extractReceiptsFromPdf(file: File): Promise<{ receipts: Receipt[]; isStatement: boolean; warning?: string }> {
  const pages = await readPdf(file);
  const fullText = pages.flat().map((line) => line.text).join('\n');
  if (/RESUMEN DE CUENTA/i.test(fullText) && (/MERCADO\s*PAGO/i.test(fullText) || /CVU:/i.test(fullText))) {
    const movements = parseMercadoPago(pages, file);
    if (movements.length) return { receipts: movements, isStatement: true };
    return { receipts: [], isStatement: true, warning: 'Se reconoció el resumen, pero no se detectaron egresos con el formato esperado.' };
  }
  return {
    receipts: [parseInvoice(fullText, file)],
    isStatement: false,
    warning: 'Procesamiento local por reglas. Revisá los campos extraídos antes de contabilizar.',
  };
}
