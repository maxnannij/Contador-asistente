import React from 'react';
import { TaxSummary } from '../types/receipt.ts';
import { formatCurrency } from '../utils/taxCalculations.ts';
import { ReceiptText, Landmark, ShieldAlert, Percent, Coins, ArrowUpRight } from 'lucide-react';

interface SummaryCardsProps {
  summary: TaxSummary;
  onFilterDiscrepancies?: () => void;
  showDiscrepancyFilter?: boolean;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  summary,
  onFilterDiscrepancies,
  showDiscrepancyFilter,
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      
      {/* 1. Neto Gravado */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all">
        <div className="flex items-center justify-between text-slate-500 mb-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Neto Gravado
          </span>
          <Coins className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="text-lg font-bold text-slate-900 tracking-tight font-mono">
          {formatCurrency(summary.totalNet)}
        </div>
        <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
          <span>{summary.count} comprobantes</span>
        </p>
      </div>

      {/* 2. IVA Crédito Fiscal */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all">
        <div className="flex items-center justify-between text-slate-500 mb-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            IVA Crédito Fiscal
          </span>
          <ReceiptText className="w-4 h-4 text-blue-600" />
        </div>
        <div className="text-lg font-bold text-blue-700 tracking-tight font-mono">
          {formatCurrency(summary.totalVat)}
        </div>
        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500 font-mono">
          {summary.totalVat > 0 ? (
            <>
              <span className="bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-medium">
                21%: {formatCurrency(summary.totalVat21)}
              </span>
              {summary.totalVat105 > 0 && (
                <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded">
                  10.5%: {formatCurrency(summary.totalVat105)}
                </span>
              )}
            </>
          ) : (
            <span className="text-slate-400">Sin crédito fiscal acumulado</span>
          )}
        </div>
      </div>

      {/* 3. IIBB (CABA + Bs As + Otras) */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all">
        <div className="flex items-center justify-between text-slate-500 mb-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-purple-700">
            Total IIBB
          </span>
          <Landmark className="w-4 h-4 text-purple-600" />
        </div>
        <div className="text-lg font-bold text-purple-800 tracking-tight font-mono">
          {formatCurrency(summary.totalIibb)}
        </div>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1 text-[10px] text-slate-500 font-mono">
          {summary.totalIibb > 0 ? (
            <>
              <span className="text-purple-700 font-medium">CABA: {formatCurrency(summary.totalIibbCaba)}</span>
              <span className="text-slate-300">|</span>
              <span className="text-indigo-700 font-medium">ARBA: {formatCurrency(summary.totalIibbBsAs)}</span>
            </>
          ) : (
            <span className="text-slate-400">Sin retenciones / percepciones</span>
          )}
        </div>
      </div>

      {/* 4. Ganancias */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all">
        <div className="flex items-center justify-between text-slate-500 mb-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
            Ganancias (Ret/Perc)
          </span>
          <ShieldAlert className="w-4 h-4 text-amber-600" />
        </div>
        <div className="text-lg font-bold text-amber-800 tracking-tight font-mono">
          {formatCurrency(summary.totalProfitsTax)}
        </div>
        <p className="text-[11px] text-slate-500 mt-1">
          {summary.totalProfitsTax > 0 ? 'Computable en DDJJ Anual' : 'Sin retenciones de ganancias'}
        </p>
      </div>

      {/* 5. Total General */}
      <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xs">
        <div className="flex items-center justify-between text-slate-300 mb-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Total General
          </span>
          <ArrowUpRight className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="text-lg font-bold text-white tracking-tight font-mono">
          {formatCurrency(summary.totalGeneral)}
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          {summary.count > 0 ? 'Importe bruto de compras y pagos' : 'Esperando comprobantes'}
        </p>
      </div>

      {/* 6. Presión Tributaria / Discrepancias */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Carga Impositiva
            </span>
            <Percent className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-lg font-bold text-slate-800 tracking-tight font-mono">
            {summary.count > 0 ? `${summary.effectiveTaxBurdenPct}%` : '0.00%'}
          </div>
        </div>

        {summary.count === 0 ? (
          <div className="text-[11px] text-slate-400 mt-1">
            Sin comprobantes
          </div>
        ) : summary.discrepancyCount > 0 ? (
          <button
            onClick={onFilterDiscrepancies}
            className={`mt-1 text-[11px] font-semibold text-amber-700 hover:text-amber-800 text-left flex items-center gap-1 cursor-pointer ${
              showDiscrepancyFilter ? 'underline' : ''
            }`}
          >
            ⚠️ {summary.discrepancyCount} con aviso de redondeo
          </button>
        ) : (
          <div className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-1">
            ✓ Sumas 100% verificadas
          </div>
        )}
      </div>

    </div>
  );
};
