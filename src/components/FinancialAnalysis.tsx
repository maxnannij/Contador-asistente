import React from 'react';
import { TaxSummary, Receipt } from '../types/receipt.ts';
import { formatCurrency } from '../utils/taxCalculations.ts';
import { PieChart, BarChart3, TrendingUp, ShieldCheck, Landmark } from 'lucide-react';

interface FinancialAnalysisProps {
  summary: TaxSummary;
  receipts: Receipt[];
}

export const FinancialAnalysis: React.FC<FinancialAnalysisProps> = ({ summary, receipts }) => {
  if (receipts.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-10 text-center max-w-xl mx-auto my-6">
        <div className="w-14 h-14 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
          <PieChart className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-900">
          Sin comprobantes para el análisis financiero
        </h3>
        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
          Los gráficos de composición del gasto, carga tributaria efectiva y desglose de impuestos por jurisdicción se generarán en tiempo real a medida que cargues tus comprobantes.
        </p>
      </div>
    );
  }

  // Category breakdown
  const categoryMap: { [cat: string]: number } = {};
  receipts.forEach((r) => {
    categoryMap[r.category] = (categoryMap[r.category] || 0) + r.totalAmount;
  });

  const categoriesSorted = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);
  const totalAllCategories = categoriesSorted.reduce((sum, [, val]) => sum + val, 0) || 1;

  // Tax breakdown components
  const taxesBreakdown = [
    { label: 'IVA Crédito Fiscal (21%, 10.5%, 27%)', value: summary.totalVat, color: 'bg-blue-500', text: 'text-blue-700' },
    { label: 'IIBB CABA (AGIP)', value: summary.totalIibbCaba, color: 'bg-purple-500', text: 'text-purple-700' },
    { label: 'IIBB Provincia de Bs. As. (ARBA)', value: summary.totalIibbBsAs, color: 'bg-indigo-500', text: 'text-indigo-700' },
    { label: 'IIBB Otras Jurisdicciones', value: summary.totalIibbOther, color: 'bg-violet-400', text: 'text-violet-700' },
    { label: 'Impuesto a las Ganancias (Ret/Perc)', value: summary.totalProfitsTax, color: 'bg-amber-500', text: 'text-amber-700' },
    { label: 'Otros Impuestos Internos & Tasas', value: summary.totalOtherTaxes, color: 'bg-slate-400', text: 'text-slate-700' },
  ].filter((t) => t.value > 0);

  const totalTaxesSum = taxesBreakdown.reduce((sum, t) => sum + t.value, 0) || 1;

  return (
    <div className="space-y-6">
      
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Ratio 1: Composición del Desembolso Total */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            <span>Composición del Gasto Total</span>
            <PieChart className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mb-2">
            {formatCurrency(summary.totalGeneral)}
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 flex overflow-hidden mb-2">
            <div
              style={{ width: `${(summary.totalNet / (summary.totalGeneral || 1)) * 100}%` }}
              className="bg-emerald-500 h-full"
              title="Neto Gravado"
            />
            <div
              style={{ width: `${((summary.totalGeneral - summary.totalNet) / (summary.totalGeneral || 1)) * 100}%` }}
              className="bg-blue-500 h-full"
              title="Carga Tributaria Total"
            />
          </div>
          <div className="flex justify-between text-xs text-slate-600 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              Neto: {formatCurrency(summary.totalNet)} ({((summary.totalNet / (summary.totalGeneral || 1)) * 100).toFixed(1)}%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
              Impuestos: {formatCurrency(summary.totalGeneral - summary.totalNet)}
            </span>
          </div>
        </div>

        {/* Ratio 2: Carga Impositiva sobre el Neto */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            <span>Presión Impositiva Efectiva</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-blue-800 mb-1">
            {summary.effectiveTaxBurdenPct}%
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Por cada $ 100 de compra neta, se abonaron ${summary.effectiveTaxBurdenPct.toFixed(2)} en impuestos directos y percepciones.
          </p>
          <div className="text-xs font-medium text-slate-700 bg-blue-50 border border-blue-100 rounded-lg p-2 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span>IVA y percepciones son computables a favor del contribuyente en sus declaraciones juradas.</span>
          </div>
        </div>

        {/* Ratio 3: Percepciones y Pagos a Cuenta */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            <span>Pagos a Cuenta (IIBB + Ganancias)</span>
            <Landmark className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-800 mb-1">
            {formatCurrency(summary.totalIibb + summary.totalProfitsTax)}
          </div>
          <p className="text-xs text-slate-500 mb-2">
            Retenciones y percepciones que reducen el impuesto final a ingresar:
          </p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>IIBB CABA (SIRCITA / AGIP):</span>
              <span className="font-mono font-semibold">{formatCurrency(summary.totalIibbCaba)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>IIBB Bs. As. (ARBA):</span>
              <span className="font-mono font-semibold">{formatCurrency(summary.totalIibbBsAs)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Retención Impuesto Ganancias:</span>
              <span className="font-mono font-semibold">{formatCurrency(summary.totalProfitsTax)}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Deep Dive Breakdown Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Taxes Distribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-600" />
            Distribución de Impuestos y Percepciones
          </h3>

          <div className="space-y-3.5">
            {taxesBreakdown.map((t) => {
              const pct = (t.value / totalTaxesSum) * 100;
              return (
                <div key={t.label}>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-slate-700">{t.label}</span>
                    <span className={`font-mono font-bold ${t.text}`}>
                      {formatCurrency(t.value)} ({pct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full ${t.color} rounded-full transition-all duration-500`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Expenses by Category */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-emerald-600" />
            Gastos por Categoría Operativa
          </h3>

          <div className="space-y-3.5">
            {categoriesSorted.map(([category, amount]) => {
              const pct = (amount / totalAllCategories) * 100;
              return (
                <div key={category}>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-slate-700">{category}</span>
                    <span className="font-mono font-bold text-slate-900">
                      {formatCurrency(amount)} ({pct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
};
