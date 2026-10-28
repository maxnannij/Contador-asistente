import * as XLSX from 'xlsx';
import { Receipt, TaxSummary, BillingParameters, BillingSimulationResult } from '../types/receipt.ts';
import { checkCoherence } from './taxCalculations.ts';

export function exportToExcelWorkbook(
  receipts: Receipt[],
  summary: TaxSummary,
  billingParams: BillingParameters,
  billingResult: BillingSimulationResult,
  filename = 'Reporte_Contable_Comprobantes.xlsx'
) {
  const wb = XLSX.utils.book_new();

  // 1. Sheet: Libro Compras & Pagos
  const detailRows = receipts.map((r) => {
    const coherence = checkCoherence(r);
    const iibbTotal = r.iibbCaba + r.iibbBsAs + r.iibbOther;

    return {
      'Fecha': r.date,
      'Tipo Comprobante': r.docType,
      'N° Comprobante': r.docNumber,
      'Proveedor / Razón Social': r.vendor,
      'CUIT': r.cuit,
      'Moneda': r.currency,
      'Tipo Cambio': r.exchangeRate || 1,
      'Neto Gravado': r.netAmount,
      'IVA 21%': r.vat21,
      'IVA 10.5%': r.vat105,
      'IVA 27%': r.vat27,
      'Total IVA Crédito': r.vatTotal,
      'IIBB CABA (AGIP)': r.iibbCaba,
      'IIBB Bs. As. (ARBA)': r.iibbBsAs,
      'IIBB Otras Prov.': r.iibbOther,
      'Total IIBB': iibbTotal,
      'Ret./Perc. Ganancias': r.profitsTax,
      'No Gravado / Exento': r.exemptAmount,
      'Otros Impuestos / Tasas': r.otherTaxes,
      'Total Comprobante': r.totalAmount,
      'Coherente': coherence.isCoherent ? 'SÍ' : `Diferencia $${coherence.difference}`,
      'Categoría': r.category,
      'Estado': r.status,
      'Notas': r.notes || '',
    };
  });

  const wsDetail = XLSX.utils.json_to_sheet(detailRows);

  // Set column widths for readability
  wsDetail['!cols'] = [
    { wch: 12 }, // Fecha
    { wch: 16 }, // Tipo
    { wch: 18 }, // Nro
    { wch: 32 }, // Proveedor
    { wch: 16 }, // CUIT
    { wch: 8 },  // Moneda
    { wch: 10 }, // TC
    { wch: 15 }, // Neto
    { wch: 13 }, // IVA 21%
    { wch: 13 }, // IVA 10.5%
    { wch: 13 }, // IVA 27%
    { wch: 16 }, // IVA Total
    { wch: 15 }, // IIBB CABA
    { wch: 16 }, // IIBB ARBA
    { wch: 15 }, // IIBB Otras
    { wch: 14 }, // Total IIBB
    { wch: 18 }, // Ganancias
    { wch: 16 }, // Exento
    { wch: 18 }, // Otros
    { wch: 16 }, // Total
    { wch: 12 }, // Coherente
    { wch: 22 }, // Categoria
    { wch: 12 }, // Estado
    { wch: 30 }, // Notas
  ];

  XLSX.utils.book_append_sheet(wb, wsDetail, 'Comprobantes Detallados');

  // 2. Sheet: Resumen Impositivo
  const summaryRows = [
    { 'Concepto Contable': 'Cantidad de Comprobantes', 'Importe / Valor': summary.count },
    { 'Concepto Contable': 'Total Importe Neto Gravado', 'Importe / Valor': summary.totalNet },
    { 'Concepto Contable': 'IVA Crédito Fiscal al 21%', 'Importe / Valor': summary.totalVat21 },
    { 'Concepto Contable': 'IVA Crédito Fiscal al 10.5%', 'Importe / Valor': summary.totalVat105 },
    { 'Concepto Contable': 'IVA Crédito Fiscal al 27%', 'Importe / Valor': summary.totalVat27 },
    { 'Concepto Contable': 'TOTAL IVA Crédito Fiscal Computable', 'Importe / Valor': summary.totalVat },
    { 'Concepto Contable': 'IIBB CABA (Percepciones / Retenciones AGIP)', 'Importe / Valor': summary.totalIibbCaba },
    { 'Concepto Contable': 'IIBB Bs. As. (Percepciones / Retenciones ARBA)', 'Importe / Valor': summary.totalIibbBsAs },
    { 'Concepto Contable': 'IIBB Otras Provincias', 'Importe / Valor': summary.totalIibbOther },
    { 'Concepto Contable': 'TOTAL Retenciones y Percepciones IIBB', 'Importe / Valor': summary.totalIibb },
    { 'Concepto Contable': 'TOTAL Retenciones Impuesto a las Ganancias', 'Importe / Valor': summary.totalProfitsTax },
    { 'Concepto Contable': 'TOTAL Conceptos No Gravados / Exentos', 'Importe / Valor': summary.totalExempt },
    { 'Concepto Contable': 'TOTAL Impuestos Internos y Tasas Municipales', 'Importe / Valor': summary.totalOtherTaxes },
    { 'Concepto Contable': 'TOTAL GENERAL DE COMPROBANTES', 'Importe / Valor': summary.totalGeneral },
    { 'Concepto Contable': 'Presión Impositiva Efectiva sobre Neto (%)', 'Importe / Valor': `${summary.effectiveTaxBurdenPct}%` },
    { 'Concepto Contable': 'Comprobantes con Alerta de Coherencia', 'Importe / Valor': summary.discrepancyCount },
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 45 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen Impositivo');

  // 3. Sheet: Parametrización Facturación
  const billingRows = [
    { 'Parámetro de Facturación': 'Modo de Cálculo', 'Valor Proyectado': billingParams.mode },
    { 'Parámetro de Facturación': 'Margen / Markup Objetivo (%)', 'Valor Proyectado': `${billingParams.targetMarginPct}%` },
    { 'Parámetro de Facturación': 'Alícuota IVA Ventas (%)', 'Valor Proyectado': `${billingParams.billingVatRate}%` },
    { 'Parámetro de Facturación': 'Alícuota Estimada IIBB Ventas (%)', 'Valor Proyectado': `${billingParams.iibbEstimatedRate}%` },
    { 'Parámetro de Facturación': 'Gastos Fijos Operativos Adicionales', 'Valor Proyectado': billingParams.fixedOverhead },
    { 'Parámetro de Facturación': 'Base de Costo Neto Mensual', 'Valor Proyectado': billingResult.baseNetCost },
    { 'Parámetro de Facturación': 'Crédito Fiscal IVA Disponible (Compras)', 'Valor Proyectado': billingResult.vatCreditAvailable },
    { 'Parámetro de Facturación': 'Crédito IIBB Computable a Favor', 'Valor Proyectado': billingResult.iibbCreditAvailable },
    { 'Parámetro de Facturación': '---', 'Valor Proyectado': '---' },
    { 'Parámetro de Facturación': 'IMPORTE NETO SUGERIDO A FACTURAR', 'Valor Proyectado': billingResult.recommendedNetToInvoice },
    { 'Parámetro de Facturación': 'IVA DÉBITO FISCAL A FACTURAR', 'Valor Proyectado': billingResult.recommendedVatToInvoice },
    { 'Parámetro de Facturación': 'TOTAL BRUTO A FACTURAR (A COBRAR)', 'Valor Proyectado': billingResult.recommendedTotalToInvoice },
    { 'Parámetro de Facturación': '---', 'Valor Proyectado': '---' },
    { 'Parámetro de Facturación': 'Saldo Proyectado IVA (Débito - Crédito)', 'Valor Proyectado': billingResult.projectedVatBalance },
    { 'Parámetro de Facturación': 'Impuesto IIBB Estimado a Pagar', 'Valor Proyectado': billingResult.projectedIibbCost },
    { 'Parámetro de Facturación': 'Utilidad Bruta Proyectada', 'Valor Proyectado': billingResult.projectedGrossProfit },
    { 'Parámetro de Facturación': 'Rentabilidad / Margen Real (%)', 'Valor Proyectado': `${billingResult.achievedMarginPct}%` },
  ];

  const wsBilling = XLSX.utils.json_to_sheet(billingRows);
  wsBilling['!cols'] = [{ wch: 45 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsBilling, 'Parametrización Facturar');

  // Trigger download
  XLSX.writeFile(wb, filename);
}

export async function copyReceiptsToClipboard(receipts: Receipt[]): Promise<boolean> {
  try {
    const headers = [
      'Fecha\tTipo\tNro\tProveedor\tCUIT\tNeto\tIVA 21%\tIVA 10.5%\tIVA 27%\tTotal IVA\tIIBB CABA\tIIBB Bs As\tIIBB Otras\tGanancias\tExento\tOtros\tTotal\tCategoría'
    ];

    const lines = receipts.map((r) =>
      [
        r.date,
        r.docType,
        r.docNumber,
        r.vendor,
        r.cuit,
        r.netAmount.toFixed(2),
        r.vat21.toFixed(2),
        r.vat105.toFixed(2),
        r.vat27.toFixed(2),
        r.vatTotal.toFixed(2),
        r.iibbCaba.toFixed(2),
        r.iibbBsAs.toFixed(2),
        r.iibbOther.toFixed(2),
        r.profitsTax.toFixed(2),
        r.exemptAmount.toFixed(2),
        r.otherTaxes.toFixed(2),
        r.totalAmount.toFixed(2),
        r.category,
      ].join('\t')
    );

    const tsvText = [headers, ...lines].join('\n');
    await navigator.clipboard.writeText(tsvText);
    return true;
  } catch (err) {
    console.error('Error al copiar al portapapeles:', err);
    return false;
  }
}
