import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, Image as ImageIcon, Loader2, CheckCircle2, AlertCircle, PlusCircle } from 'lucide-react';
import { Receipt } from '../types/receipt.ts';

interface ReceiptUploaderProps {
  onReceiptsAdded: (newReceipts: Receipt[]) => void;
  onOpenManualModal: () => void;
}

interface UploadingFileStatus {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'uploading' | 'processing' | 'success' | 'error';
  errorMessage?: string;
  count?: number;
  isStatement?: boolean;
  result?: Receipt;
}

export const ReceiptUploader: React.FC<ReceiptUploaderProps> = ({
  onReceiptsAdded,
  onOpenManualModal,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [queue, setQueue] = useState<UploadingFileStatus[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(
      (f) => f.type.startsWith('image/') || f.type === 'application/pdf'
    );

    if (fileArray.length === 0) return;

    const initialQueueItems: UploadingFileStatus[] = fileArray.map((f) => ({
      id: Math.random().toString(36).substring(2, 9),
      name: f.name,
      size: f.size,
      type: f.type,
      status: 'uploading',
    }));

    setQueue((prev) => [...initialQueueItems, ...prev]);

    const newReceipts: Receipt[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const queueItem = initialQueueItems[i];

      try {
        setQueue((prev) =>
          prev.map((item) =>
            item.id === queueItem.id ? { ...item, status: 'processing' } : item
          )
        );

        // Convert to base64
        const base64Data = await readFileAsBase64(file);

        // Call backend /api/extract
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileBase64: base64Data,
            mimeType: file.type,
            fileName: file.name,
          }),
        });

        const json = await res.json();

        if (!res.ok && !json.items && !json.data && !json.fallbackData) {
          throw new Error(json.error || 'Error al procesar el comprobante');
        }

        const rawItems = Array.isArray(json.items) && json.items.length > 0
          ? json.items
          : json.data
          ? [json.data]
          : json.fallbackData
          ? [json.fallbackData]
          : [];

        if (rawItems.length === 0) {
          throw new Error(json.error || 'No se pudieron extraer datos del comprobante.');
        }

        const isStatement = Boolean(json.isStatement);
        const importedForThisFile: Receipt[] = [];

        for (let idx = 0; idx < rawItems.length; idx++) {
          const item = rawItems[idx];
          const receipt: Receipt = {
            id: `rec-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
            fileName: file.name,
            fileType: file.type === 'application/pdf' ? 'pdf' : 'image',
            fileDataUrl: base64Data,
            date: item.date || new Date().toISOString().split('T')[0],
            docType: item.docType || (isStatement ? 'Comprobante de Pago' : 'Factura A'),
            docNumber: item.docNumber || '00000-00000000',
            vendor: item.vendor || 'Proveedor Desconocido',
            cuit: item.cuit || '',
            currency: (item.currency as 'ARS' | 'USD') || 'ARS',
            exchangeRate: Number(item.exchangeRate) || 1,
            netAmount: Number(item.netAmount) || 0,
            vat21: Number(item.vat21) || 0,
            vat105: Number(item.vat105) || 0,
            vat27: Number(item.vat27) || 0,
            vatTotal: Number(item.vatTotal) || 0,
            iibbCaba: Number(item.iibbCaba) || 0,
            iibbBsAs: Number(item.iibbBsAs) || 0,
            iibbOther: Number(item.iibbOther) || 0,
            profitsTax: Number(item.profitsTax) || 0,
            exemptAmount: Number(item.exemptAmount) || 0,
            otherTaxes: Number(item.otherTaxes) || 0,
            totalAmount: Number(item.totalAmount) || 0,
            category: item.category || 'Varios',
            notes: item.notes || '',
            status: 'procesado',
            createdAt: Date.now(),
          };

          importedForThisFile.push(receipt);
          newReceipts.push(receipt);
        }

        setQueue((prev) =>
          prev.map((item) =>
            item.id === queueItem.id
              ? {
                  ...item,
                  status: 'success',
                  result: importedForThisFile[0],
                  count: importedForThisFile.length,
                  isStatement,
                }
              : item
          )
        );
      } catch (err: any) {
        console.error('Error procesando comprobante:', err);
        setQueue((prev) =>
          prev.map((item) =>
            item.id === queueItem.id
              ? { ...item, status: 'error', errorMessage: err?.message || 'Error de lectura' }
              : item
          )
        );
      }
    }

    if (newReceipts.length > 0) {
      onReceiptsAdded(newReceipts);
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 sm:p-5 mb-6">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-emerald-600" />
            Cargar Comprobantes de Compras y Pagos
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Arrastra facturas o recibos en formato PDF, JPG o PNG. La IA desglosa automáticamente Neto, IVA, IIBB CABA/Bs As y Ganancias en columnas individuales.
          </p>
        </div>

        <button
          onClick={onOpenManualModal}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4 text-slate-600" />
          Carga Manual
        </button>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2.5 ${
          isDragging
            ? 'border-emerald-500 bg-emerald-50/60 scale-[0.99]'
            : 'border-slate-300 hover:border-emerald-500 hover:bg-slate-50/70'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          onChange={handleFileChange}
          className="hidden"
          aria-label="Subir archivos de comprobantes"
        />

        <div className="w-12 h-12 rounded-full bg-emerald-100/70 text-emerald-700 flex items-center justify-center">
          <UploadCloud className="w-6 h-6" />
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-800">
            Haz clic para seleccionar o arrastra tus comprobantes aquí
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Formatos soportados: <span className="font-medium text-slate-700">PDF, JPG, PNG, WEBP</span> • Puedes subir múltiples comprobantes a la vez
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full mt-1">
          <span>✨ Detección de AFIP / CUIT / IVA / IIBB CABA / ARBA / Ganancias</span>
        </div>
      </div>

      {/* Upload Progress Queue */}
      {queue.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-2">
            <span>Cola de procesamiento ({queue.filter(q => q.status === 'success').length}/{queue.length})</span>
            {queue.some(q => q.status === 'success' || q.status === 'error') && (
              <button
                onClick={() => setQueue([])}
                className="text-slate-400 hover:text-slate-600 text-xs font-normal underline cursor-pointer"
              >
                Limpiar historial
              </button>
            )}
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
            {queue.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs"
              >
                <div className="flex items-center gap-2.5 truncate mr-3">
                  {item.type === 'application/pdf' ? (
                    <FileText className="w-4 h-4 text-red-500 shrink-0" />
                  ) : (
                    <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />
                  )}
                  <span className="font-medium text-slate-800 truncate">{item.name}</span>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {(item.size / 1024).toFixed(0)} KB
                  </span>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {item.status === 'processing' && (
                    <span className="inline-flex items-center gap-1.5 text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Analizando impuestos...
                    </span>
                  )}
                  {item.status === 'success' && (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      {item.isStatement
                        ? `Resumen MP: ${item.count} pagos`
                        : item.count && item.count > 1
                        ? `${item.count} items`
                        : 'Procesado'}
                    </span>
                  )}
                  {item.status === 'error' && (
                    <span className="inline-flex items-center gap-1 text-rose-700 font-medium bg-rose-50 px-2 py-0.5 rounded">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      {item.errorMessage || 'Error'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
