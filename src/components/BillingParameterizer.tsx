import React from 'react';
import { TaxSummary, BillingParameters, BillingSimulationResult } from '../types/receipt.ts';
import { formatCurrency } from '../utils/taxCalculations.ts';
import {
  Sliders,
  DollarSign,
  TrendingUp,
  Scale,
  Receipt,
  FileCheck,
  Percent,
  Copy,
  Check,
} from 'lucide-react';

interface BillingParameterizerProps {
  summary: TaxSummary;
  params: BillingParameters;
  simulation: BillingSimulationResult;
  onUpdateParams: (newParams: Partial<BillingParameters>) => void;
  onExportExcel: () => void;
  onGoToReport?: () => void;
}

export const BillingParameterizer: React.FC<BillingParameterizerProps> = ({
  summary,
  params,
  simulation,
  onUpdateParams,
  onExportExcel,
  onGoToReport,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (summary.count === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-10 text-center max-w-xl mx-auto my-6">
        <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
          <Sliders className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-900">
          Sin comprobantes para parametrizar
        </h3>
        <p className="text-xs text-slate-500 mt-1.5 mb-5 leading-relaxed">
          Para que el sistema pueda proyectar los importes netos a facturar, la alícuota de IVA a liquidar y la absorción de crédito fiscal, primero sube los comprobantes de gastos de tu cliente.
        </p>
        {onGoToReport && (
          <button
            onClick={onGoToReport}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <Receipt className="w-4 h-4" />
            <span>Ir a Cargar Comprobantes</span>
          </button>
        )}
      </div>
    );
  }

  const copySummaryText = () => {
    const text = `
RESUMEN DE IMPORTES A FACTURAR (ContaDoc)
------------------------------------------
Base de Compras Netas: ${formatCurrency(simulation.baseNetCost)}
Crédito Fiscal IVA Disponible: ${formatCurrency(simulation.vatCreditAvailable)}
Margen Objetivo: ${params.targetMarginPct}%
Alícuota IVA Ventas: ${params.billingVatRate}%

IMPORTE NETO A FACTURAR: ${formatCurrency(simulation.recommendedNetToInvoice)}
IVA DÉBITO FISCAL: ${formatCurrency(simulation.recommendedVatToInvoice)}
TOTAL BRUTO A FACTURAR: ${formatCurrency(simulation.recommendedTotalToInvoice)}

POSICIÓN FISCAL ESTIMADA:
- Saldo IVA a pagar/saldo a favor: ${formatCurrency(simulation.projectedVatBalance)}
- Impuesto IIBB estimado (${params.iibbEstimatedRate}%): ${formatCurrency(simulation.projectedIibbCost)}
- Utilidad Bruta Estimada: ${formatCurrency(simulation.projectedGrossProfit)} (${simulation.achievedMarginPct}%)
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Intro banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white rounded-2xl p-6 shadow-sm">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-medium text-emerald-200 mb-3">
            <Sliders className="w-3.5 h-3.5" />
            Módulo de Planificación & Liquidación Contable
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">
            Parametrización y Resumen de Importes a Facturar
          </h2>
          <p className="text-sm text-emerald-100/90 mt-2 leading-relaxed">
            Calcula automáticamente el volumen de ventas sugerido a facturar para tu cliente según los comprobantes de gastos cargados. Parametriza márgenes comerciales, alícuotas de IVA y absorción de crédito fiscal.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Parameter controls (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-600" />
              1. Estrategia de Facturación
            </h3>

            {/* Mode selection buttons */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              <button
                type="button"
                onClick={() => onUpdateParams({ mode: 'margin' })}
                className={`px-3 py-2.5 rounded-lg text-xs font-semibold text-center border transition-all cursor-pointer ${
                  params.mode === 'margin'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs ring-1 ring-emerald-500'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <TrendingUp className="w-4 h-4 mx-auto mb-1 text-emerald-600" />
                Por Margen / Markup
              </button>

              <button
                type="button"
                onClick={() => onUpdateParams({ mode: 'vat_balance' })}
                className={`px-3 py-2.5 rounded-lg text-xs font-semibold text-center border transition-all cursor-pointer ${
                  params.mode === 'vat_balance'
                    ? 'bg-blue-50 border-blue-500 text-blue-800 shadow-2xs ring-1 ring-blue-500'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Scale className="w-4 h-4 mx-auto mb-1 text-blue-600" />
                Neutralizar IVA
              </button>

              <button
                type="button"
                onClick={() => onUpdateParams({ mode: 'profit_target' })}
                className={`px-3 py-2.5 rounded-lg text-xs font-semibold text-center border transition-all cursor-pointer ${
                  params.mode === 'profit_target'
                    ? 'bg-purple-50 border-purple-500 text-purple-800 shadow-2xs ring-1 ring-purple-500'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <DollarSign className="w-4 h-4 mx-auto mb-1 text-purple-600" />
                Meta de Ganancia
              </button>
            </div>

            {/* Parameters Inputs */}
            <div className="space-y-4">
              
              {/* Target Margin % */}
              {params.mode === 'margin' && (
                <div>
                  <div className="flex justify-between items-center text-xs font-medium text-slate-700 mb-1.5">
                    <span>Margen Comercial / Markup deseado:</span>
                    <span className="font-bold text-emerald-700 font-mono text-sm">
                      {params.targetMarginPct}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="150"
                    step="5"
                    value={params.targetMarginPct}
                    onChange={(e) => onUpdateParams({ targetMarginPct: Number(e.target.value) })}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                    <span>Conservador (10%)</span>
                    <span>Medio (35%)</span>
                    <span>Alto (100%)</span>
                  </div>
                </div>
              )}

              {/* Target Profit */}
              {params.mode === 'profit_target' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Ganancia Neta Objetivo ($):
                  </label>
                  <input
                    type="number"
                    value={params.targetNetProfit || ''}
                    placeholder="Ej. 250000"
                    onChange={(e) => onUpdateParams({ targetNetProfit: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono focus:ring-1 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>
              )}

              {/* VAT Rate on Billing */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Alícuota IVA de Venta:
                  </label>
                  <select
                    value={params.billingVatRate}
                    onChange={(e) => onUpdateParams({ billingVatRate: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white font-medium text-slate-800 cursor-pointer"
                  >
                    <option value={21}>IVA General (21%)</option>
                    <option value={10.5}>IVA Reducido (10.5%)</option>
                    <option value={27}>IVA Servicios (27%)</option>
                    <option value={0}>Exento (0%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    IIBB Estimado (%):
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={params.iibbEstimatedRate}
                    onChange={(e) => onUpdateParams({ iibbEstimatedRate: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono text-slate-800"
                  />
                </div>
              </div>

              {/* Fixed Expenses */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Gastos fijos adicionales / Sueldos / Otros a cubrir ($):
                </label>
                <input
                  type="number"
                  value={params.fixedOverhead || ''}
                  placeholder="0 (opcional)"
                  onChange={(e) => onUpdateParams({ fixedOverhead: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Se sumará a la base de compras netas ({formatCurrency(summary.totalNet)})
                </p>
              </div>

            </div>
          </div>

          {/* Quick Context Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              Base Contable Computada ({summary.count} comprobantes):
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Compras Netas Gravadas:</span>
              <span className="font-mono font-medium">{formatCurrency(summary.totalNet)}</span>
            </div>
            <div className="flex justify-between text-blue-700">
              <span>Crédito Fiscal IVA disponible:</span>
              <span className="font-mono font-bold">{formatCurrency(summary.totalVat)}</span>
            </div>
            <div className="flex justify-between text-purple-700">
              <span>Percepciones/Retenciones IIBB:</span>
              <span className="font-mono font-medium">{formatCurrency(summary.totalIibb)}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Recommended Billing Summary (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  2. Resumen Proyectado de Importes a Facturar
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Importe sugerido para emitir la factura a clientes o confeccionar presupuesto
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={copySummaryText}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Resumen</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* High-visibility Invoice Breakdown Card */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl p-5 mb-5 shadow-sm space-y-3 font-mono">
              
              {/* Row 1: Neto a Facturar */}
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-2.5">
                <div>
                  <div className="text-xs text-slate-400 font-sans uppercase tracking-wider">
                    Importe Neto Gravado a Facturar
                  </div>
                  <div className="text-[11px] text-slate-500 font-sans">
                    Costo base {formatCurrency(simulation.baseNetCost)} + margen aplicado
                  </div>
                </div>
                <div className="text-xl font-bold text-emerald-400">
                  {formatCurrency(simulation.recommendedNetToInvoice)}
                </div>
              </div>

              {/* Row 2: IVA Débito Fiscal */}
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-2.5">
                <div>
                  <div className="text-xs text-blue-300 font-sans uppercase tracking-wider flex items-center gap-1">
                    <span>IVA Débito Fiscal ({params.billingVatRate}%)</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-sans">
                    Impuesto al valor agregado a liquidar
                  </div>
                </div>
                <div className="text-lg font-bold text-blue-300">
                  + {formatCurrency(simulation.recommendedVatToInvoice)}
                </div>
              </div>

              {/* Row 3: Total Bruto Factura */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <div className="text-xs text-emerald-300 font-sans uppercase font-bold tracking-wider">
                    TOTAL BRUTO A FACTURAR (A Cobrar)
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans">
                    Total final que debe figurar en la Factura del cliente
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-white">
                  {formatCurrency(simulation.recommendedTotalToInvoice)}
                </div>
              </div>

            </div>

            {/* Impact on Tax Balance (Position) */}
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5">
              Impacto en la Posición Impositiva Mensual
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              
              {/* 1. Saldo de IVA */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-slate-600 mb-1">
                    Saldo Técnico de IVA
                  </div>
                  <div className={`text-base font-bold font-mono ${
                    simulation.projectedVatBalance > 0 ? 'text-amber-700' : 'text-emerald-700'
                  }`}>
                    {simulation.projectedVatBalance > 0
                      ? `A Pagar: ${formatCurrency(simulation.projectedVatBalance)}`
                      : `Saldo a Favor: ${formatCurrency(Math.abs(simulation.projectedVatBalance))}`}
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 mt-2 pt-1 border-t border-slate-200/60 font-mono">
                  Débito: {formatCurrency(simulation.recommendedVatToInvoice)}<br />
                  Crédito: {formatCurrency(simulation.vatCreditAvailable)}
                </div>
              </div>

              {/* 2. Estimación IIBB */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="text-[11px] font-semibold text-slate-600 mb-1">
                  IIBB Ventas Estimado
                </div>
                <div className="text-base font-bold font-mono text-purple-800">
                  {formatCurrency(simulation.projectedIibbCost)}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Tasa {params.iibbEstimatedRate}% sobre Neto a Facturar
                </p>
              </div>

              {/* 3. Utilidad Bruta */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="text-[11px] font-semibold text-slate-600 mb-1">
                  Utilidad Bruta Proyectada
                </div>
                <div className="text-base font-bold font-mono text-emerald-800">
                  {formatCurrency(simulation.projectedGrossProfit)}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Margen efectivo: {simulation.achievedMarginPct}%
                </p>
              </div>

            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                ¿Deseas exportar esta simulación a la planilla de Excel?
              </span>
              <button
                onClick={onExportExcel}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer"
              >
                Descargar en Excel con Fórmulas
              </button>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};
