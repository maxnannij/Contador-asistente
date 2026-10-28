import { FileSpreadsheet, Copy, Sparkles, PlusCircle, Check, Trash2 } from 'lucide-react';

interface HeaderProps {
  onExportExcel: () => void;
  onExportCsv: () => void;
  onCopyClipboard: () => void;
  onOpenManualModal: () => void;
  onClearAll: () => void;
  copied: boolean;
  activeTab: 'reporte' | 'facturar' | 'analisis';
  setActiveTab: (tab: 'reporte' | 'facturar' | 'analisis') => void;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  availableMonths: string[];
  receiptCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  onExportExcel,
  onExportCsv,
  onCopyClipboard,
  onOpenManualModal,
  onClearAll,
  copied,
  activeTab,
  setActiveTab,
  selectedMonth,
  setSelectedMonth,
  availableMonths,
  receiptCount,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between py-3.5 gap-3">
          
          {/* Logo & Subtitle */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-xs font-bold text-lg">
              CD
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  ContaDoc
                </h1>
                <span className="px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  Asistente Contable
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Desglose impositivo de compras, IVA, IIBB, Ganancias y parametrización de facturación
              </p>
            </div>
          </div>

          {/* Actions & Export toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Month Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <span className="text-xs font-medium text-slate-600">Período:</span>
              <select
                aria-label="Seleccionar período contable"
                disabled={receiptCount === 0}
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className={`text-xs font-semibold text-slate-800 bg-transparent focus:outline-hidden ${
                  receiptCount === 0 ? 'text-slate-400 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                {receiptCount === 0 ? (
                  <option value="todos">Sin comprobantes</option>
                ) : (
                  <>
                    <option value="todos">Todos los comprobantes</option>
                    {availableMonths.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            {/* Manual Add Button */}
            <button
              onClick={onOpenManualModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-2xs cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5 text-slate-600" />
              Nuevo
            </button>

            {/* Copy for Excel */}
            <button
              onClick={onCopyClipboard}
              disabled={receiptCount === 0}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors shadow-2xs ${
                receiptCount === 0
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-slate-400 cursor-pointer'
              }`}
              title={receiptCount === 0 ? 'Carga comprobantes para copiar a Excel' : 'Copiar datos tabulados para pegar directamente en Excel (Ctrl + V)'}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-600" />
                  <span>Copiar para Excel</span>
                </>
              )}
            </button>

            {/* Export Excel (.xlsx) */}
            <button
              onClick={onExportExcel}
              disabled={receiptCount === 0}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg shadow-2xs transition-colors ${
                receiptCount === 0
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
              }`}
              title={receiptCount === 0 ? 'Carga comprobantes para exportar a Excel' : 'Descargar archivo Excel .xlsx con hojas detalladas y fórmulas'}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Exportar Excel (.xlsx)</span>
            </button>

            {/* Clear All Data */}
            {receiptCount > 0 && (
              <button
                onClick={onClearAll}
                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                title="Limpiar y vaciar todos los comprobantes"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-t border-slate-200 gap-1 pt-1 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('reporte')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'reporte'
                ? 'border-emerald-600 text-emerald-700 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            📋 Reporte Detallado de Comprobantes
          </button>
          <button
            onClick={() => setActiveTab('facturar')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'facturar'
                ? 'border-emerald-600 text-emerald-700 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            ⚙️ Parametrización & Importes a Facturar
          </button>
          <button
            onClick={() => setActiveTab('analisis')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'analisis'
                ? 'border-emerald-600 text-emerald-700 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            📊 Análisis Financiero Impositivo
          </button>
        </div>
      </div>
    </header>
  );
};
