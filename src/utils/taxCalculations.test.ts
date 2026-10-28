import test from 'node:test';
import assert from 'node:assert/strict';
import {
  round2,
  parseArgentineNumber,
  formatCurrency,
  formatCuit,
  checkCoherence,
  calculateReceiptSummary,
  calculateBillingParameters,
  exportReceiptsToCsv,
} from './taxCalculations.ts';
import { Receipt, BillingParameters } from '../types/receipt.ts';

test('round2 rounds accurately to 2 decimal places', () => {
  assert.equal(round2(123.456), 123.46);
  assert.equal(round2(100.004), 100.0);
  assert.equal(round2(0.1 + 0.2), 0.3);
});

test('parseArgentineNumber parses different currency notations', () => {
  assert.equal(parseArgentineNumber('1.250.340,50'), 1250340.5);
  assert.equal(parseArgentineNumber('$ 45.000,00'), 45000);
  assert.equal(parseArgentineNumber('1234.56'), 1234.56);
  assert.equal(parseArgentineNumber(500), 500);
  assert.equal(parseArgentineNumber(''), 0);
  assert.equal(parseArgentineNumber(null), 0);
});

test('formatCurrency formats values in Argentine standard', () => {
  assert.equal(formatCurrency(1250340.5), '$ 1.250.340,50');
  assert.equal(formatCurrency(100, 'USD'), 'US$ 100,00');
  assert.equal(formatCurrency(-500.25), '-$ 500,25');
});

test('formatCuit handles 11-digit CUIT formatting', () => {
  assert.equal(formatCuit('30712345679'), '30-71234567-9');
  assert.equal(formatCuit('30-71234567-9'), '30-71234567-9');
});

test('checkCoherence validates total against sum of tax components', () => {
  const coherentReceipt: Partial<Receipt> = {
    netAmount: 1000,
    vatTotal: 210,
    iibbCaba: 30,
    iibbBsAs: 15,
    iibbOther: 0,
    profitsTax: 20,
    exemptAmount: 0,
    otherTaxes: 10,
    totalAmount: 1285,
  };
  const result1 = checkCoherence(coherentReceipt);
  assert.equal(result1.isCoherent, true);
  assert.equal(result1.difference, 0);

  const incoherentReceipt: Partial<Receipt> = {
    netAmount: 1000,
    vatTotal: 210,
    iibbCaba: 0,
    iibbBsAs: 0,
    iibbOther: 0,
    profitsTax: 0,
    exemptAmount: 0,
    otherTaxes: 0,
    totalAmount: 1500, // missing 290
  };
  const result2 = checkCoherence(incoherentReceipt);
  assert.equal(result2.isCoherent, false);
  assert.equal(result2.difference, 290);
});

test('calculateReceiptSummary aggregates all tax columns correctly', () => {
  const sampleReceipts: Receipt[] = [
    {
      id: '1',
      fileName: 'factura1.pdf',
      fileType: 'pdf',
      date: '2026-10-01',
      docType: 'Factura A',
      docNumber: '00001-00000001',
      vendor: 'Proveedor Uno S.A.',
      cuit: '30-11111111-1',
      currency: 'ARS',
      exchangeRate: 1,
      netAmount: 100000,
      vat21: 21000,
      vat105: 0,
      vat27: 0,
      vatTotal: 21000,
      iibbCaba: 3000,
      iibbBsAs: 2000,
      iibbOther: 0,
      profitsTax: 1500,
      exemptAmount: 0,
      otherTaxes: 500,
      totalAmount: 128000,
      category: 'Mercaderías',
      status: 'procesado',
      createdAt: Date.now(),
    },
    {
      id: '2',
      fileName: 'factura2.pdf',
      fileType: 'pdf',
      date: '2026-10-05',
      docType: 'Factura A',
      docNumber: '00002-00000002',
      vendor: 'Proveedor Dos S.R.L.',
      cuit: '30-22222222-2',
      currency: 'ARS',
      exchangeRate: 1,
      netAmount: 50000,
      vat21: 0,
      vat105: 5250,
      vat27: 0,
      vatTotal: 5250,
      iibbCaba: 0,
      iibbBsAs: 1000,
      iibbOther: 500,
      profitsTax: 0,
      exemptAmount: 2000,
      otherTaxes: 0,
      totalAmount: 58750,
      category: 'Servicios',
      status: 'procesado',
      createdAt: Date.now(),
    },
  ];

  const summary = calculateReceiptSummary(sampleReceipts);
  assert.equal(summary.count, 2);
  assert.equal(summary.totalNet, 150000);
  assert.equal(summary.totalVat21, 21000);
  assert.equal(summary.totalVat105, 5250);
  assert.equal(summary.totalVat, 26250);
  assert.equal(summary.totalIibbCaba, 3000);
  assert.equal(summary.totalIibbBsAs, 3000);
  assert.equal(summary.totalIibbOther, 500);
  assert.equal(summary.totalIibb, 6500);
  assert.equal(summary.totalProfitsTax, 1500);
  assert.equal(summary.totalExempt, 2000);
  assert.equal(summary.totalOtherTaxes, 500);
  assert.equal(summary.totalGeneral, 186750);
  assert.equal(summary.discrepancyCount, 0);
});

test('calculateBillingParameters calculates margin and VAT balance projections', () => {
  const summary = {
    count: 1,
    totalNet: 100000,
    totalVat21: 21000,
    totalVat105: 0,
    totalVat27: 0,
    totalVat: 21000,
    totalIibbCaba: 3000,
    totalIibbBsAs: 0,
    totalIibbOther: 0,
    totalIibb: 3000,
    totalProfitsTax: 0,
    totalExempt: 0,
    totalOtherTaxes: 0,
    totalGeneral: 124000,
    effectiveTaxBurdenPct: 24,
    discrepancyCount: 0,
  };

  const marginParams: BillingParameters = {
    targetMarginPct: 30, // 30% markup
    billingVatRate: 21,
    iibbEstimatedRate: 3.5,
    fixedOverhead: 0,
    targetNetProfit: 0,
    mode: 'margin',
  };

  const simResult = calculateBillingParameters(summary, marginParams);
  assert.equal(simResult.baseNetCost, 100000);
  assert.equal(simResult.recommendedNetToInvoice, 130000);
  assert.equal(simResult.recommendedVatToInvoice, 27300); // 130,000 * 21%
  assert.equal(simResult.recommendedTotalToInvoice, 157300);
  assert.equal(simResult.projectedVatBalance, 6300); // 27,300 - 21,000
  assert.equal(simResult.projectedGrossProfit, 30000);
});

test('exportReceiptsToCsv generates semicolon-delimited CSV with BOM', () => {
  const sampleReceipts: Receipt[] = [
    {
      id: '1',
      fileName: 'comp1.png',
      fileType: 'image',
      date: '2026-10-10',
      docType: 'Factura A',
      docNumber: '00001-00012345',
      vendor: 'Telecom',
      cuit: '30-63945373-8',
      currency: 'ARS',
      exchangeRate: 1,
      netAmount: 10000,
      vat21: 2100,
      vat105: 0,
      vat27: 0,
      vatTotal: 2100,
      iibbCaba: 300,
      iibbBsAs: 0,
      iibbOther: 0,
      profitsTax: 0,
      exemptAmount: 0,
      otherTaxes: 0,
      totalAmount: 12400,
      category: 'Servicios',
      status: 'procesado',
      createdAt: Date.now(),
    },
  ];

  const csv = exportReceiptsToCsv(sampleReceipts);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('Telecom'));
  assert.ok(csv.includes('30-63945373-8'));
  assert.ok(csv.includes('10000,00'));
});
