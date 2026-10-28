import React, { useState, useMemo } from 'react';
import { Receipt } from '../types/receipt.ts';
import { formatCurrency, formatCuit, checkCoherence } from '../utils/taxCalculations.ts';
import { Search, Eye, Edit3, Trash2, CheckCircle2, AlertTriangle, ArrowUpDown, ReceiptText } from 'lucide-react';

interface ReceiptTableProps {
  receipts: Receipt[];
  onEditReceipt: (receipt: Receipt) => void;
  onDeleteReceipt: (id: string) => void;
  onViewReceipt: (receipt: Receipt) => void;
  showDiscrepancyFilter?: boolean;
}

export const ReceiptTable: React.FC<ReceiptTableProps> = ({
  receipts,
  onEditReceipt,
  onDeleteReceipt,
  onViewReceipt,
  showDiscrepancyFilter = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('todas');
  const [typeFilter, setTypeFilter] = useState('todos');
  const [sortField, setSortField] = useState<keyof Receipt>('date');
  const [sortAsc, setSortAsc] = useState(false);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    receipts.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set).sort();
  }, [receipts]);

  // Filtered & sorted receipts
  const filteredReceipts = useMemo(() => {
    return receipts
      .filter((r) => {
        const matchesSearch =
          r.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.cuit.includes(searchTerm) ||
          r.docNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (r.notes && r.notes.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesCategory =
          categoryFilter === 'todas' || r.category === categoryFilter;

        const matchesType = typeFilter === 'todos' || r.docType === typeFilter;

        const matchesDiscrepancy =
          !showDiscrepancyFilter || !checkCoherence(r).isCoherent;

        return matchesSearch && matchesCategory && matchesType && matchesDiscrepancy;
      })
      .sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortAsc ? valA - valB : valB - valA;
        }
        const strA = String(valA || '');
        const strB = String(valB || '');
        return sortAsc ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
  }, [receipts, searchTerm, categoryFilter, typeFilter, showDiscrepancyFilter, sortField, sortAsc]);

  // Column totals for footer
  const totals = useMemo(() => {
    return filteredReceipts.reduce(
      (acc, r) => {
        acc.net += r.netAmount;
        acc.vat21 += r.vat21;
        acc.vat105 += r.vat105;
        acc.vat27 += r.vat27;
        acc.vatTotal += r.vatTotal;
        acc.iibbCaba += r.iibbCaba;
        acc.iibbBsAs += r.iibbBsAs;
        acc.iibbOther += r.iibbOther;
        acc.profitsTax += r.profitsTax;
        acc.exempt += r.exemptAmount;
        acc.otherTaxes += r.otherTaxes;
        acc.total += r.totalAmount;
        return acc;
      },
      {
        net: 0,
        vat21: 0,
        vat105: 0,
        vat27: 0,
        vatTotal: 0,
        iibbCaba: 0,
        iibbBsAs: 0,
        iibbOther: 0,
        profitsTax: 0,
        exempt: 0,
        otherTaxes: 0,
        total: 0,
      }
    );
  }, [filteredReceipts]);

  const toggleSort = (field: keyof Receipt) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  if (receipts.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-10 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
          <ReceiptText className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-800">
          No hay comprobantes cargados todavía
        </h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
          La tabla se armará automáticamente cuando subas comprobantes de compras o pagos (PDF o imágenes) en el panel superior.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
      
      {/* Table Toolbar */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por proveedor, CUIT, N° comprobante o notas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <select
            aria-label="Filtrar por categoría de gasto"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="todas">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Doc Type Filter */}
          <select
            aria-label="Filtrar por tipo de comprobante"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="todos">Todos los comprobantes</option>
            <option value="Factura A">Factura A</option>
            <option value="Factura B">Factura B</option>
            <option value="Factura C">Factura C</option>
            <option value="Recibo">Recibo</option>
            <option value="Ticket">Ticket</option>
            <option value="Nota de Crédito">Nota de Crédito</option>
          </select>

          <span className="text-xs text-slate-500 ml-1">
            {filteredReceipts.length} de {receipts.length} comprobantes
          </span>
        </div>
      </div>

      {/* Column guide hint */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-1.5 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Columnas desglosadas: <strong>Neto Gravado</strong> • <strong>IVA (21%, 10.5%, 27%)</strong> • <strong>IIBB CABA</strong> • <strong>IIBB Bs. As. (ARBA)</strong> • <strong>Ganancias</strong> • <strong>Exento</strong> • <strong>Total</strong></span>
        </div>
        <span className="text-slate-400 hidden sm:inline">Desliza horizontalmente ↔</span>
      </div>

      {/* Main Responsive Table */}
      <div className="relative">
        <div className="overflow-x-auto custom-scrollbar max-h-[640px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase tracking-wider font-semibold sticky top-0 z-20 border-b border-slate-200">
              <tr>
                <th
                  onClick={() => toggleSort('date')}
                  className="py-2.5 px-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/70 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Fecha</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-2.5 whitespace-nowrap">Comprobante</th>
                <th
                  onClick={() => toggleSort('vendor')}
                  className="py-2.5 px-3 whitespace-nowrap cursor-pointer hover:bg-slate-200/70 transition-colors min-w-[170px]"
                >
                  <div className="flex items-center gap-1">
                    <span>Proveedor / CUIT</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* Individual Tax Columns */}
                <th
                  onClick={() => toggleSort('netAmount')}
                  className="py-2.5 px-3 text-right whitespace-nowrap bg-emerald-50/70 cursor-pointer hover:bg-emerald-100/70 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1 text-emerald-950 font-bold">
                    <span>Neto Gravado</span>
                    <ArrowUpDown className="w-3 h-3 text-emerald-700" />
                  </div>
                </th>

                <th className="py-2.5 px-2 text-right whitespace-nowrap text-blue-900 bg-blue-50/40">
                  IVA 21%
                </th>
                <th className="py-2.5 px-2 text-right whitespace-nowrap text-blue-900 bg-blue-50/40">
                  IVA 10.5%
                </th>
                <th className="py-2.5 px-2 text-right whitespace-nowrap text-blue-900 bg-blue-50/40">
                  IVA 27%
                </th>

                <th
                  onClick={() => toggleSort('vatTotal')}
                  className="py-2.5 px-3 text-right whitespace-nowrap bg-blue-100/70 text-blue-950 cursor-pointer hover:bg-blue-200/70 transition-colors font-bold"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Total IVA</span>
                    <ArrowUpDown className="w-3 h-3 text-blue-800" />
                  </div>
                </th>

                <th className="py-2.5 px-2.5 text-right whitespace-nowrap text-purple-950 bg-purple-50/60 font-semibold">
                  IIBB CABA
                </th>
                <th className="py-2.5 px-2.5 text-right whitespace-nowrap text-indigo-950 bg-indigo-50/60 font-semibold">
                  IIBB Bs. As.
                </th>
                <th className="py-2.5 px-2.5 text-right whitespace-nowrap text-slate-800 bg-slate-50">
                  IIBB Otras
                </th>

                <th className="py-2.5 px-3 text-right whitespace-nowrap text-amber-950 bg-amber-50/60 font-semibold">
                  Ganancias
                </th>

                <th className="py-2.5 px-2.5 text-right whitespace-nowrap text-slate-700">
                  No Grav./Exento
                </th>
                <th className="py-2.5 px-2.5 text-right whitespace-nowrap text-slate-700">
                  Otros / Tasas
                </th>

                <th
                  onClick={() => toggleSort('totalAmount')}
                  className="py-2.5 px-3 text-right whitespace-nowrap bg-slate-200 text-slate-950 font-bold cursor-pointer hover:bg-slate-300 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Total Factura</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-800" />
                  </div>
                </th>

                <th className="py-2.5 px-2 text-center whitespace-nowrap">Auditoría</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Categoría</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap sticky right-0 bg-slate-100 z-10 border-l border-slate-200 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.08)]">
                  Acciones
                </th>
              </tr>
            </thead>

          <tbody className="divide-y divide-slate-200 font-mono">
            {filteredReceipts.length === 0 ? (
              <tr>
                <td colSpan={18} className="py-12 text-center text-slate-500 font-sans">
                  No se encontraron comprobantes con los filtros aplicados.
                </td>
              </tr>
            ) : (
              filteredReceipts.map((r) => {
                const coherence = checkCoherence(r);

                return (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    {/* Fecha */}
                    <td className="py-2 px-3 whitespace-nowrap text-slate-700">
                      {r.date}
                    </td>

                    {/* Comprobante */}
                    <td className="py-2 px-3 whitespace-nowrap font-sans">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200 mr-1.5">
                        {r.docType}
                      </span>
                      <span className="text-slate-600 font-mono text-[11px]">
                        {r.docNumber}
                      </span>
                    </td>

                    {/* Proveedor / CUIT */}
                    <td className="py-2 px-3 font-sans min-w-[180px]">
                      <div className="font-semibold text-slate-900 truncate max-w-[220px]" title={r.vendor}>
                        {r.vendor}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {formatCuit(r.cuit)}
                      </div>
                    </td>

                    {/* Neto Gravado */}
                    <td className="py-2 px-3 text-right whitespace-nowrap font-bold text-slate-900 bg-emerald-50/30">
                      {formatCurrency(r.netAmount)}
                    </td>

                    {/* IVA 21% */}
                    <td className="py-2 px-2 text-right whitespace-nowrap text-slate-700">
                      {r.vat21 > 0 ? formatCurrency(r.vat21) : '-'}
                    </td>

                    {/* IVA 10.5% */}
                    <td className="py-2 px-2 text-right whitespace-nowrap text-slate-700">
                      {r.vat105 > 0 ? formatCurrency(r.vat105) : '-'}
                    </td>

                    {/* IVA 27% */}
                    <td className="py-2 px-2 text-right whitespace-nowrap text-slate-700">
                      {r.vat27 > 0 ? formatCurrency(r.vat27) : '-'}
                    </td>

                    {/* Total IVA */}
                    <td className="py-2 px-3 text-right whitespace-nowrap font-semibold text-blue-700 bg-blue-50/30">
                      {r.vatTotal > 0 ? formatCurrency(r.vatTotal) : '-'}
                    </td>

                    {/* IIBB CABA */}
                    <td className="py-2 px-2.5 text-right whitespace-nowrap text-purple-700 font-medium">
                      {r.iibbCaba > 0 ? formatCurrency(r.iibbCaba) : '-'}
                    </td>

                    {/* IIBB Bs As */}
                    <td className="py-2 px-2.5 text-right whitespace-nowrap text-indigo-700 font-medium">
                      {r.iibbBsAs > 0 ? formatCurrency(r.iibbBsAs) : '-'}
                    </td>

                    {/* IIBB Otras */}
                    <td className="py-2 px-2.5 text-right whitespace-nowrap text-slate-600">
                      {r.iibbOther > 0 ? formatCurrency(r.iibbOther) : '-'}
                    </td>

                    {/* Ganancias */}
                    <td className="py-2 px-3 text-right whitespace-nowrap font-medium text-amber-700">
                      {r.profitsTax > 0 ? formatCurrency(r.profitsTax) : '-'}
                    </td>

                    {/* Exento */}
                    <td className="py-2 px-2.5 text-right whitespace-nowrap text-slate-600">
                      {r.exemptAmount > 0 ? formatCurrency(r.exemptAmount) : '-'}
                    </td>

                    {/* Otros Impuestos */}
                    <td className="py-2 px-2.5 text-right whitespace-nowrap text-slate-600">
                      {r.otherTaxes > 0 ? formatCurrency(r.otherTaxes) : '-'}
                    </td>

                    {/* Total Factura */}
                    <td className="py-2 px-3 text-right whitespace-nowrap font-bold text-slate-900 bg-slate-100/60">
                      {formatCurrency(r.totalAmount)}
                    </td>

                    {/* Coherencia */}
                    <td className="py-2 px-2 text-center whitespace-nowrap font-sans">
                      {coherence.isCoherent ? (
                        <span
                          title="Suma de Neto + Impuestos coincide con el Total"
                          className="inline-flex items-center text-emerald-600"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </span>
                      ) : (
                        <span
                          title={`Diferencia detectada de $${coherence.difference}. Revise los impuestos desglosados.`}
                          className="inline-flex items-center text-amber-600 cursor-pointer"
                          onClick={() => onEditReceipt(r)}
                        >
                          <AlertTriangle className="w-4 h-4" />
                        </span>
                      )}
                    </td>

                    {/* Categoría */}
                    <td className="py-2 px-3 whitespace-nowrap font-sans">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200 truncate inline-block max-w-[140px]">
                        {r.category}
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="py-2 px-3 whitespace-nowrap text-center font-sans sticky right-0 bg-white group-hover:bg-slate-50 transition-colors border-l border-slate-200 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onViewReceipt(r)}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                          title="Ver detalle y comprobante"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onEditReceipt(r)}
                          className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                          title="Editar importes"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteReceipt(r.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          title="Eliminar comprobante"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {/* Dynamic Column Totals Footer */}
          {filteredReceipts.length > 0 && (
            <tfoot className="bg-slate-100 font-semibold text-slate-900 border-t-2 border-slate-300 font-mono sticky bottom-0 z-20">
              <tr>
                <td colSpan={3} className="py-2.5 px-3 text-right font-sans uppercase text-[11px] text-slate-600">
                  TOTALES ({filteredReceipts.length} comp.):
                </td>
                <td className="py-2.5 px-3 text-right text-emerald-950 bg-emerald-100 font-bold whitespace-nowrap">
                  {formatCurrency(totals.net)}
                </td>
                <td className="py-2.5 px-2 text-right text-slate-700 whitespace-nowrap">
                  {formatCurrency(totals.vat21)}
                </td>
                <td className="py-2.5 px-2 text-right text-slate-700 whitespace-nowrap">
                  {formatCurrency(totals.vat105)}
                </td>
                <td className="py-2.5 px-2 text-right text-slate-700 whitespace-nowrap">
                  {formatCurrency(totals.vat27)}
                </td>
                <td className="py-2.5 px-3 text-right text-blue-950 bg-blue-100 font-bold whitespace-nowrap">
                  {formatCurrency(totals.vatTotal)}
                </td>
                <td className="py-2.5 px-2.5 text-right text-purple-950 font-bold whitespace-nowrap">
                  {formatCurrency(totals.iibbCaba)}
                </td>
                <td className="py-2.5 px-2.5 text-right text-indigo-950 font-bold whitespace-nowrap">
                  {formatCurrency(totals.iibbBsAs)}
                </td>
                <td className="py-2.5 px-2.5 text-right text-slate-700 whitespace-nowrap">
                  {formatCurrency(totals.iibbOther)}
                </td>
                <td className="py-2.5 px-3 text-right text-amber-950 font-bold whitespace-nowrap">
                  {formatCurrency(totals.profitsTax)}
                </td>
                <td className="py-2.5 px-2.5 text-right text-slate-700 whitespace-nowrap">
                  {formatCurrency(totals.exempt)}
                </td>
                <td className="py-2.5 px-2.5 text-right text-slate-700 whitespace-nowrap">
                  {formatCurrency(totals.otherTaxes)}
                </td>
                <td className="py-2.5 px-3 text-right text-slate-950 bg-slate-300 font-extrabold whitespace-nowrap">
                  {formatCurrency(totals.total)}
                </td>
                <td colSpan={2} className="py-2.5 px-2"></td>
                <td className="py-2.5 px-3 text-center sticky right-0 bg-slate-100 border-l border-slate-200"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      </div>

    </div>
  );
};
