import { Receipt, TaxSummary, BillingParameters, BillingSimulationResult } from '../types/receipt.ts';

export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function parseArgentineNumber(input: string | number | undefined | null): number {
  if (input === undefined || input === null) return 0;
  if (typeof input === 'number') return isNaN(input) ? 0 : round2(input);
  
  let str = input.trim();
  if (!str) return 0;

  // Handle format like "$ 1.234,56" or "1234.56" or "1,234.56"
  str = str.replace(/[^\d.,-]/g, '');
  if (!str) return 0;

  // If there's both comma and dot, check positions
  const lastDot = str.lastIndexOf('.');
  const lastComma = str.lastIndexOf(',');

  if (lastComma > lastDot) {
    // Argentine format: 1.234,56
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // US format: 1,234.56
    str = str.replace(/,/g, '');
  } else if (lastComma !== -1 && lastDot === -1) {
    // Only comma: "1234,56" -> "1234.56"
    str = str.replace(',', '.');
  }

  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : round2(parsed);
}

export function formatCurrency(amount: number, currency: 'ARS' | 'USD' = 'ARS'): string {
  const rounded = round2(amount);
  const symbol = currency === 'USD' ? 'US$' : '$';
  const parts = Math.abs(rounded).toFixed(2).split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimalPart = parts[1];
  const sign = rounded < 0 ? '-' : '';
  return `${sign}${symbol} ${integerPart},${decimalPart}`;
}

export function formatCuit(rawCuit: string): string {
  if (!rawCuit) return '';
  const digits = rawCuit.replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
  }
  return rawCuit;
}

export function checkCoherence(receipt: Partial<Receipt>): {
  isCoherent: boolean;
  computedSum: number;
  total: number;
  difference: number;
} {
  const net = parseArgentineNumber(receipt.netAmount);
  const vatTotal = parseArgentineNumber(receipt.vatTotal);
  const iibbCaba = parseArgentineNumber(receipt.iibbCaba);
  const iibbBsAs = parseArgentineNumber(receipt.iibbBsAs);
  const iibbOther = parseArgentineNumber(receipt.iibbOther);
  const profitsTax = parseArgentineNumber(receipt.profitsTax);
  const exempt = parseArgentineNumber(receipt.exemptAmount);
  const otherTaxes = parseArgentineNumber(receipt.otherTaxes);
  const total = parseArgentineNumber(receipt.totalAmount);

  const computedSum = round2(
    net + vatTotal + iibbCaba + iibbBsAs + iibbOther + profitsTax + exempt + otherTaxes
  );

  const difference = round2(Math.abs(computedSum - total));
  // Allow a 1-peso tolerance for typical AFIP rounding discrepancies
  const isCoherent = difference <= 1.05;

  return {
    isCoherent,
    computedSum,
    total,
    difference,
  };
}

export function calculateReceiptSummary(receipts: Receipt[]): TaxSummary {
  let totalNet = 0;
  let totalVat21 = 0;
  let totalVat105 = 0;
  let totalVat27 = 0;
  let totalVat = 0;
  let totalIibbCaba = 0;
  let totalIibbBsAs = 0;
  let totalIibbOther = 0;
  let totalProfitsTax = 0;
  let totalExempt = 0;
  let totalOtherTaxes = 0;
  let totalGeneral = 0;
  let discrepancyCount = 0;

  for (const r of receipts) {
    // If currency is USD, multiply by exchangeRate if provided
    const rate = r.currency === 'USD' && r.exchangeRate ? r.exchangeRate : 1;

    totalNet += r.netAmount * rate;
    totalVat21 += r.vat21 * rate;
    totalVat105 += r.vat105 * rate;
    totalVat27 += r.vat27 * rate;
    totalVat += r.vatTotal * rate;
    totalIibbCaba += r.iibbCaba * rate;
    totalIibbBsAs += r.iibbBsAs * rate;
    totalIibbOther += r.iibbOther * rate;
    totalProfitsTax += r.profitsTax * rate;
    totalExempt += r.exemptAmount * rate;
    totalOtherTaxes += r.otherTaxes * rate;
    totalGeneral += r.totalAmount * rate;

    const coherence = checkCoherence(r);
    if (!coherence.isCoherent) {
      discrepancyCount++;
    }
  }

  const totalIibb = totalIibbCaba + totalIibbBsAs + totalIibbOther;
  const totalTaxes = totalVat + totalIibb + totalProfitsTax + totalOtherTaxes;
  const effectiveTaxBurdenPct = totalNet > 0 ? round2((totalTaxes / totalNet) * 100) : 0;

  return {
    count: receipts.length,
    totalNet: round2(totalNet),
    totalVat21: round2(totalVat21),
    totalVat105: round2(totalVat105),
    totalVat27: round2(totalVat27),
    totalVat: round2(totalVat),
    totalIibbCaba: round2(totalIibbCaba),
    totalIibbBsAs: round2(totalIibbBsAs),
    totalIibbOther: round2(totalIibbOther),
    totalIibb: round2(totalIibb),
    totalProfitsTax: round2(totalProfitsTax),
    totalExempt: round2(totalExempt),
    totalOtherTaxes: round2(totalOtherTaxes),
    totalGeneral: round2(totalGeneral),
    effectiveTaxBurdenPct,
    discrepancyCount,
  };
}

export function calculateBillingParameters(
  summary: TaxSummary,
  params: BillingParameters
): BillingSimulationResult {
  const baseNetCost = summary.totalNet + (params.fixedOverhead || 0);
  const vatCreditAvailable = summary.totalVat;
  const iibbCreditAvailable = summary.totalIibb;
  const vatRateFraction = (params.billingVatRate || 21) / 100;
  const iibbRateFraction = (params.iibbEstimatedRate || 3.5) / 100;

  let recommendedNetToInvoice = 0;

  if (params.mode === 'margin') {
    // Target markup over net costs
    const markupMultiplier = 1 + (params.targetMarginPct || 0) / 100;
    recommendedNetToInvoice = round2(baseNetCost * markupMultiplier);
  } else if (params.mode === 'vat_balance') {
    // Target net invoice to generate Debit Fiscal that absorbs accumulated Credit Fiscal:
    // Net * vatRate = vatCreditAvailable => Net = vatCreditAvailable / vatRate
    if (vatRateFraction > 0 && vatCreditAvailable > 0) {
      recommendedNetToInvoice = round2(vatCreditAvailable / vatRateFraction);
    } else {
      recommendedNetToInvoice = round2(baseNetCost * 1.3);
    }
  } else if (params.mode === 'profit_target') {
    // Net invoice needed to cover costs + target net profit
    recommendedNetToInvoice = round2(baseNetCost + (params.targetNetProfit || 0));
  }

  const recommendedVatToInvoice = round2(recommendedNetToInvoice * vatRateFraction);
  const recommendedTotalToInvoice = round2(recommendedNetToInvoice + recommendedVatToInvoice);

  // Projected taxes & margins
  const projectedIibbCost = round2(recommendedNetToInvoice * iibbRateFraction);
  const projectedVatBalance = round2(recommendedVatToInvoice - vatCreditAvailable);
  const projectedGrossProfit = round2(recommendedNetToInvoice - baseNetCost);
  const achievedMarginPct =
    baseNetCost > 0 ? round2((projectedGrossProfit / baseNetCost) * 100) : 0;

  return {
    baseNetCost: round2(baseNetCost),
    vatCreditAvailable: round2(vatCreditAvailable),
    iibbCreditAvailable: round2(iibbCreditAvailable),
    recommendedNetToInvoice,
    recommendedVatToInvoice,
    recommendedTotalToInvoice,
    projectedIibbCost,
    projectedVatBalance,
    projectedGrossProfit,
    achievedMarginPct,
  };
}

export function exportReceiptsToCsv(receipts: Receipt[]): string {
  const headers = [
    'Fecha',
    'Tipo Comprobante',
    'Nro Comprobante',
    'Proveedor / Razón Social',
    'CUIT',
    'Moneda',
    'Tipo Cambio',
    'Neto Gravado',
    'IVA 21%',
    'IVA 10.5%',
    'IVA 27%',
    'Total IVA Crédito',
    'IIBB CABA',
    'IIBB Bs. As. (ARBA)',
    'IIBB Otras Prov.',
    'Ret./Perc. Ganancias',
    'No Gravado / Exento',
    'Otros Impuestos / Tasas',
    'Total Comprobante',
    'Categoría',
    'Estado',
    'Notas',
  ];

  const escapeCsv = (str: string | number | undefined): string => {
    if (str === undefined || str === null) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = receipts.map((r) => [
    escapeCsv(r.date),
    escapeCsv(r.docType),
    escapeCsv(r.docNumber),
    escapeCsv(r.vendor),
    escapeCsv(r.cuit),
    escapeCsv(r.currency),
    escapeCsv(r.exchangeRate),
    escapeCsv(r.netAmount.toFixed(2).replace('.', ',')),
    escapeCsv(r.vat21.toFixed(2).replace('.', ',')),
    escapeCsv(r.vat105.toFixed(2).replace('.', ',')),
    escapeCsv(r.vat27.toFixed(2).replace('.', ',')),
    escapeCsv(r.vatTotal.toFixed(2).replace('.', ',')),
    escapeCsv(r.iibbCaba.toFixed(2).replace('.', ',')),
    escapeCsv(r.iibbBsAs.toFixed(2).replace('.', ',')),
    escapeCsv(r.iibbOther.toFixed(2).replace('.', ',')),
    escapeCsv(r.profitsTax.toFixed(2).replace('.', ',')),
    escapeCsv(r.exemptAmount.toFixed(2).replace('.', ',')),
    escapeCsv(r.otherTaxes.toFixed(2).replace('.', ',')),
    escapeCsv(r.totalAmount.toFixed(2).replace('.', ',')),
    escapeCsv(r.category),
    escapeCsv(r.status),
    escapeCsv(r.notes || ''),
  ]);

  // UTF-8 BOM for automatic Excel recognition of accented characters
  return '\uFEFF' + [headers.map((h) => `"${h}"`).join(';'), ...rows.map((row) => row.join(';'))].join('\r\n');
}
