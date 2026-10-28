import React, { useState, useEffect } from 'react';
import { Receipt } from '../types/receipt.ts';
import { round2, checkCoherence, formatCurrency } from '../utils/taxCalculations.ts';
import { X, CheckCircle2, AlertTriangle, FileText, Image as ImageIcon, Sparkles } from 'lucide-react';

interface ReceiptModalProps {
  receipt: Receipt | null;
  mode: 'view' | 'edit' | 'create';
  isOpen: boolean;
  onClose: () => void;
  onSave: (receipt: Receipt) => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  receipt,
  mode,
  isOpen,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<Partial<Receipt>>({});

  useEffect(() => {
    if (receipt) {
      setFormData({ ...receipt });
    } else {
      // Default blank receipt for manual creation
      setFormData({
        id: `rec-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        docType: 'Factura A',
        docNumber: '',
        vendor: '',
        cuit: '',
        currency: 'ARS',
        exchangeRate: 1,
        netAmount: 0,
        vat21: 0,
        vat105: 0,
        vat27: 0,
        vatTotal: 0,
        iibbCaba: 0,
        iibbBsAs: 0,
        iibbOther: 0,
        profitsTax: 0,
        exemptAmount: 0,
        otherTaxes: 0,
        totalAmount: 0,
        category: 'Mercaderías',
        notes: '',
        status: 'manual',
        createdAt: Date.now(),
      });
    }
  }, [receipt, isOpen]);

  if (!isOpen) return null;

  const handleChange = (field: keyof Receipt, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };

      // Auto update vatTotal if individual VAT rates are changed
      if (field === 'vat21' || field === 'vat105' || field === 'vat27') {
        const v21 = field === 'vat21' ? Number(value) || 0 : Number(prev.vat21) || 0;
        const v105 = field === 'vat105' ? Number(value) || 0 : Number(prev.vat105) || 0;
        const v27 = field === 'vat27' ? Number(value) || 0 : Number(prev.vat27) || 0;
        updated.vatTotal = round2(v21 + v105 + v27);
      }

      return updated;
    });
  };

  const coherence = checkCoherence(formData);

  const handleAutoFixTotal = () => {
    setFormData((prev) => ({
      ...prev,
      totalAmount: coherence.computedSum,
    }));
  };

  const handleQuickVat21 = () => {
    const net = Number(formData.netAmount) || 0;
    const vat = round2(net * 0.21);
    setFormData((prev) => {
      const updated = {
        ...prev,
        vat21: vat,
        vat105: 0,
        vat27: 0,
        vatTotal: vat,
      };
      const coh = checkCoherence(updated);
      updated.totalAmount = coh.computedSum;
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vendor || !formData.date) {
      alert('Por favor complete los datos obligatorios (Proveedor y Fecha).');
      return;
    }

    const completedReceipt: Receipt = {
      id: formData.id || `rec-${Date.now()}`,
      fileName: formData.fileName || 'comprobante_manual.pdf',
      fileType: formData.fileType || 'pdf',
      fileDataUrl: formData.fileDataUrl,
      date: formData.date || new Date().toISOString().split('T')[0],
      docType: formData.docType || 'Factura A',
      docNumber: formData.docNumber || '00001-00000001',
      vendor: formData.vendor || 'Proveedor',
      cuit: formData.cuit || '',
      currency: formData.currency || 'ARS',
      exchangeRate: Number(formData.exchangeRate) || 1,
      netAmount: Number(formData.netAmount) || 0,
      vat21: Number(formData.vat21) || 0,
      vat105: Number(formData.vat105) || 0,
      vat27: Number(formData.vat27) || 0,
      vatTotal: Number(formData.vatTotal) || 0,
      iibbCaba: Number(formData.iibbCaba) || 0,
      iibbBsAs: Number(formData.iibbBsAs) || 0,
      iibbOther: Number(formData.iibbOther) || 0,
      profitsTax: Number(formData.profitsTax) || 0,
      exemptAmount: Number(formData.exemptAmount) || 0,
      otherTaxes: Number(formData.otherTaxes) || 0,
      totalAmount: Number(formData.totalAmount) || 0,
      category: formData.category || 'Varios',
      notes: formData.notes || '',
      status: mode === 'create' ? 'manual' : 'revisado',
      createdAt: formData.createdAt || Date.now(),
    };

    onSave(completedReceipt);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {mode === 'create'
                ? 'Nuevo Comprobante'
                : mode === 'edit'
                ? 'Editar Comprobante e Impuestos'
                : 'Detalle de Comprobante'}
            </h3>
            <p className="text-xs text-slate-500">
              {formData.vendor ? `${formData.vendor} (${formData.docType || ''} ${formData.docNumber || ''})` : 'Carga contable detallada'}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          
          {/* File preview banner if attached */}
          {formData.fileDataUrl && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {formData.fileType === 'pdf' ? (
                  <FileText className="w-5 h-5 text-red-500" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-blue-500" />
                )}
                <div>
                  <div className="font-semibold text-slate-800">{formData.fileName}</div>
                  <div className="text-[11px] text-slate-500">Comprobante escaneado / digital adjunto</div>
                </div>
              </div>

              {formData.fileType !== 'pdf' && (
                <a
                  href={formData.fileDataUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg font-medium transition-colors"
                >
                  Abrir Imagen Original
                </a>
              )}
            </div>
          )}

          {/* General Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Fecha Emisión:
              </label>
              <input
                type="date"
                required
                value={formData.date || ''}
                onChange={(e) => handleChange('date', e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tipo Comprobante:
              </label>
              <select
                value={formData.docType || 'Factura A'}
                onChange={(e) => handleChange('docType', e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-emerald-500"
              >
                <option value="Factura A">Factura A</option>
                <option value="Factura B">Factura B</option>
                <option value="Factura C">Factura C</option>
                <option value="Recibo">Recibo</option>
                <option value="Ticket">Ticket</option>
                <option value="Nota de Crédito">Nota de Crédito</option>
                <option value="Nota de Débito">Nota de Débito</option>
                <option value="Comprobante de Pago">Comprobante de Pago</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                N° Comprobante:
              </label>
              <input
                type="text"
                placeholder="00001-00012345"
                value={formData.docNumber || ''}
                onChange={(e) => handleChange('docNumber', e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Categoría Contable:
              </label>
              <select
                value={formData.category || 'Mercaderías'}
                onChange={(e) => handleChange('category', e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-emerald-500"
              >
                <option value="Mercaderías">Mercaderías</option>
                <option value="Servicios Profesionales">Servicios Profesionales</option>
                <option value="Alquileres">Alquileres</option>
                <option value="Tecnología / Software">Tecnología / Software</option>
                <option value="Servicios Públicos / Telecomunicaciones">Servicios Públicos / Telecom</option>
                <option value="Logística / Envíos">Logística / Envíos</option>
                <option value="Gastos Bancarios">Gastos Bancarios</option>
                <option value="Mantenimiento / Insumos">Mantenimiento / Insumos</option>
                <option value="Varios">Varios</option>
              </select>
            </div>
          </div>

          {/* Vendor & CUIT */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Proveedor / Razón Social:
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Telecom Argentina S.A."
                value={formData.vendor || ''}
                onChange={(e) => handleChange('vendor', e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                CUIT:
              </label>
              <input
                type="text"
                placeholder="30-12345678-9"
                value={formData.cuit || ''}
                onChange={(e) => handleChange('cuit', e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Individual Tax Breakdown Fields */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Desglose Individual de Impuestos
              </div>
              <button
                type="button"
                onClick={handleQuickVat21}
                className="inline-flex items-center gap-1 text-[11px] text-blue-700 hover:text-blue-800 font-semibold cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-blue-600" />
                Calcular IVA 21% auto
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              
              {/* Neto Gravado */}
              <div className="bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200">
                <label className="block text-xs font-bold text-emerald-900 mb-1">
                  Neto Gravado ($):
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.netAmount || ''}
                  onChange={(e) => handleChange('netAmount', Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-emerald-300 rounded-md font-mono font-bold text-slate-900"
                />
              </div>

              {/* IVA 21% */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  IVA 21% ($):
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.vat21 || ''}
                  onChange={(e) => handleChange('vat21', Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md font-mono"
                />
              </div>

              {/* IVA 10.5% */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  IVA 10.5% ($):
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.vat105 || ''}
                  onChange={(e) => handleChange('vat105', Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md font-mono"
                />
              </div>

              {/* IVA 27% */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  IVA 27% ($):
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.vat27 || ''}
                  onChange={(e) => handleChange('vat27', Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md font-mono"
                />
              </div>

              {/* IIBB CABA */}
              <div>
                <label className="block text-xs font-semibold text-purple-900 mb-1">
                  IIBB CABA (AGIP) ($):
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.iibbCaba || ''}
                  onChange={(e) => handleChange('iibbCaba', Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs border border-purple-200 rounded-md font-mono text-purple-900"
                />
              </div>

              {/* IIBB Bs As */}
              <div>
                <label className="block text-xs font-semibold text-indigo-900 mb-1">
                  IIBB Bs. As. (ARBA) ($):
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.iibbBsAs || ''}
                  onChange={(e) => handleChange('iibbBsAs', Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs border border-indigo-200 rounded-md font-mono text-indigo-900"
                />
              </div>

              {/* IIBB Otras */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  IIBB Otras Prov. ($):
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.iibbOther || ''}
                  onChange={(e) => handleChange('iibbOther', Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md font-mono"
                />
              </div>

              {/* Ganancias */}
              <div>
                <label className="block text-xs font-semibold text-amber-900 mb-1">
                  Ret./Perc. Ganancias ($):
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.profitsTax || ''}
                  onChange={(e) => handleChange('profitsTax', Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs border border-amber-200 rounded-md font-mono text-amber-900"
                />
              </div>

              {/* Exento */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  No Gravado / Exento ($):
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.exemptAmount || ''}
                  onChange={(e) => handleChange('exemptAmount', Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md font-mono"
                />
              </div>

              {/* Otros impuestos / Tasas */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Otros Tributos / Tasas ($):
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.otherTaxes || ''}
                  onChange={(e) => handleChange('otherTaxes', Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md font-mono"
                />
              </div>

              {/* Total Comprobante */}
              <div className="sm:col-span-2 bg-slate-200/80 p-2.5 rounded-lg border border-slate-300">
                <label className="block text-xs font-extrabold text-slate-900 mb-1">
                  TOTAL COMPROBANTE FINAL ($):
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.totalAmount || ''}
                  onChange={(e) => handleChange('totalAmount', Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-sm bg-white border border-slate-400 rounded-md font-mono font-extrabold text-slate-950"
                />
              </div>

            </div>

            {/* Arithmetic Coherence Feedback */}
            <div className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
              coherence.isCoherent
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <div className="flex items-center gap-2">
                {coherence.isCoherent ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      <strong>Suma Coherente:</strong> Neto + Impuestos = {formatCurrency(coherence.computedSum)}. Coincide con el Total.
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>Aviso de descuadre:</strong> La suma de los componentes es {formatCurrency(coherence.computedSum)} y el Total es {formatCurrency(coherence.total)} (diferencia: {formatCurrency(coherence.difference)}).
                    </span>
                  </>
                )}
              </div>

              {!coherence.isCoherent && (
                <button
                  type="button"
                  onClick={handleAutoFixTotal}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-amber-300 rounded-md hover:bg-amber-100 transition-colors shrink-0 ml-2 cursor-pointer"
                >
                  Ajustar Total a {formatCurrency(coherence.computedSum)}
                </button>
              )}
            </div>

          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Notas / Concepto Facturado:
            </label>
            <input
              type="text"
              placeholder="Detalle o descripción de los ítems adquiridos..."
              value={formData.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              Guardar Comprobante
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
