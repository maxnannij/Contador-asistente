export interface Receipt {
  id: string;
  fileName: string;
  fileType: 'image' | 'pdf';
  fileDataUrl?: string; // base64 or object URL for preview
  date: string; // YYYY-MM-DD
  docType: 'Factura A' | 'Factura B' | 'Factura C' | 'Recibo' | 'Ticket' | 'Nota de Crédito' | 'Nota de Débito' | 'Comprobante de Pago' | 'Otro';
  docNumber: string; // e.g., "00014-00045892"
  vendor: string;
  cuit: string; // e.g., "30-71234567-9"
  currency: 'ARS' | 'USD';
  exchangeRate: number; // 1 for ARS
  
  // Tax breakdown (individual columns)
  netAmount: number; // Importe Neto Gravado
  vat21: number; // IVA 21%
  vat105: number; // IVA 10.5%
  vat27: number; // IVA 27%
  vatTotal: number; // Total IVA Crédito Fiscal
  
  iibbCaba: number; // Percepciones / Retenciones IIBB CABA (AGIP)
  iibbBsAs: number; // Percepciones / Retenciones IIBB Bs. As. (ARBA)
  iibbOther: number; // Percepciones IIBB Otras Provincias
  
  profitsTax: number; // Retención / Percepción Ganancias
  exemptAmount: number; // No Gravado / Exento
  otherTaxes: number; // Impuestos Internos / Tasas Municipales / Otros
  
  totalAmount: number; // Total Comprobante
  
  category: string; // e.g., "Mercaderías", "Servicios", "Alquileres", etc.
  notes?: string;
  status: 'procesado' | 'manual' | 'revisado';
  createdAt: number;
}

export interface TaxSummary {
  count: number;
  totalNet: number;
  totalVat21: number;
  totalVat105: number;
  totalVat27: number;
  totalVat: number;
  totalIibbCaba: number;
  totalIibbBsAs: number;
  totalIibbOther: number;
  totalIibb: number;
  totalProfitsTax: number;
  totalExempt: number;
  totalOtherTaxes: number;
  totalGeneral: number;
  effectiveTaxBurdenPct: number;
  discrepancyCount: number;
}

export interface BillingParameters {
  targetMarginPct: number; // e.g. 35%
  billingVatRate: number; // e.g. 21 or 10.5
  iibbEstimatedRate: number; // e.g. 3.5%
  fixedOverhead: number; // e.g. 0 or additional expenses
  targetNetProfit: number; // target net gain
  mode: 'margin' | 'vat_balance' | 'profit_target';
}

export interface BillingSimulationResult {
  baseNetCost: number;
  vatCreditAvailable: number;
  iibbCreditAvailable: number;
  recommendedNetToInvoice: number;
  recommendedVatToInvoice: number;
  recommendedTotalToInvoice: number;
  projectedIibbCost: number;
  projectedVatBalance: number; // Debit - Credit (positive = tax to pay, negative = credit balance)
  projectedGrossProfit: number;
  achievedMarginPct: number;
}
