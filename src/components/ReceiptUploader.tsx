import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, Image as ImageIcon, Loader2, CheckCircle2, AlertCircle, PlusCircle } from 'lucide-react';
import { Receipt } from '../types/receipt.ts';
import { extractReceiptFromOcrText, extractReceiptsFromPdf } from '../utils/localPdfParser.ts';
import { recognizeImageLocally, recognizeScannedPdfLocally } from '../utils/localOcr.ts';

interface ReceiptUploaderProps {
  onReceiptsAdded: (newReceipts: Receipt[]) => void;
  onOpenManualModal: () => void;
}
interface QueueItem {
  id: string; name: string; size: number; type: string;
  status: 'processing' | 'success' | 'error'; message?: string; count?: number;
}

export const ReceiptUploader: React.FC<ReceiptUploaderProps> = ({ onReceiptsAdded, onOpenManualModal }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateQueueMessage = (id: string, message: string) => {
    setQueue((items) => items.map((item) => item.id === id ? { ...item, message } : item));
  };

  const processFiles = async (files: FileList | File[]) => {
    const accepted = Array.from(files).filter((file) =>
      file.type === 'application/pdf' || file.type.startsWith('image/'),
    );
    if (!accepted.length) return;
    const added: Receipt[] = [];

    for (const file of accepted) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setQueue((items) => [{ id, name: file.name, size: file.size, type: file.type, status: 'processing', message: 'Preparando archivo...' }, ...items]);
      try {
        let receipts: Receipt[] = [];

        if (file.type === 'application/pdf') {
          const result = await extractReceiptsFromPdf(file);
          receipts = result.receipts;

          // Si el PDF no tiene texto seleccionable o las reglas no pudieron leerlo,
          // renderizamos sus páginas y aplicamos OCR local.
          if (!receipts.length || receipts.every((receipt) => receipt.status === 'manual')) {
            updateQueueMessage(id, 'PDF escaneado: iniciando OCR local...');
            const text = await recognizeScannedPdfLocally(file, (message) => updateQueueMessage(id, message));
            if (text) {
              receipts = [extractReceiptFromOcrText(text, file)];
            } else {
              throw new Error('No se reconoció texto. Probá con una imagen más nítida o completá los datos manualmente.');
            }
          }
        } else {
          const text = await recognizeImageLocally(file, (message) => updateQueueMessage(id, message));
          if (!text) throw new Error('No se reconoció texto. Probá con una imagen más nítida o completá los datos manualmente.');
          receipts = [extractReceiptFromOcrText(text, file)];
        }

        const fileDataUrl = await readFileAsDataUrl(file);
        const prepared = receipts.map((receipt, index) => ({
          ...receipt,
          fileDataUrl,
          id: `${receipt.id}-${id}-${index}`,
          notes: (receipt.notes || '').includes('OCR local')
            ? receipt.notes
            : `${receipt.notes} Archivo procesado en este dispositivo.`,
        }));
        added.push(...prepared);
        setQueue((items) => items.map((item) => item.id === id
          ? { ...item, status: 'success', count: prepared.length, message: prepared.some((receipt) => (receipt.notes || '').includes('OCR local')) ? 'OCR local completado; revisar datos' : 'PDF leído localmente' }
          : item));
      } catch (error: any) {
        setQueue((items) => items.map((item) => item.id === id
          ? { ...item, status: 'error', message: error?.message || 'No se pudo leer el archivo' }
          : item));
      }
    }
    if (added.length) onReceiptsAdded(added);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault(); setIsDragging(false); processFiles(event.dataTransfer.files);
  };

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 sm:p-5 mb-6">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-emerald-600" /> Cargar comprobantes de compras y pagos
          </h2>
          <p className="text-xs text-slate-500 mt-1">Los PDF con texto se analizan directamente. Las imágenes y los PDF escaneados utilizan OCR local en español. Los comprobantes no se envían a ningún servicio externo. La primera vez se descargan el motor y el idioma español, que quedan en caché.</p>
        </div>
        <button onClick={onOpenManualModal} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg">
          <PlusCircle className="w-4 h-4" /> Carga manual
        </button>
      </div>
      <div
        onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-colors ${isDragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:border-emerald-500 hover:bg-slate-50'}`}
      >
        <input ref={inputRef} type="file" accept="application/pdf,image/*" multiple className="hidden"
          onChange={(event) => { if (event.target.files) processFiles(event.target.files); event.target.value = ''; }} />
        <UploadCloud className="w-8 h-8 mx-auto text-emerald-700 mb-2" />
        <p className="text-sm font-semibold text-slate-800">Seleccioná o arrastrá tus comprobantes</p>
        <p className="text-xs text-slate-500 mt-1">PDF, JPG, PNG o WEBP · OCR en español procesado en este dispositivo</p>
      </div>
      {queue.length > 0 && <div className="mt-4 border-t border-slate-100 pt-3">
        <div className="flex justify-between text-xs font-semibold text-slate-600 mb-2">
          <span>Archivos procesados ({queue.filter((item) => item.status === 'success').length}/{queue.length})</span>
          <button onClick={() => setQueue([])} className="font-normal underline text-slate-400">Limpiar historial</button>
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
          {queue.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <div className="flex items-center gap-2 min-w-0">
              {item.type === 'application/pdf' ? <FileText className="w-4 h-4 text-red-500 shrink-0" /> : <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />}
              <div className="min-w-0"><span className="block truncate font-medium">{item.name}</span>{item.message && <span className="block truncate text-[10px] text-slate-500">{item.message}</span>}</div><span className="text-slate-400 shrink-0">{(item.size / 1024).toFixed(0)} KB</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {item.status === 'processing' && <><Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" /> Procesando</>}
              {item.status === 'success' && <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {item.count} registro(s)</>}
              {item.status === 'error' && <><AlertCircle className="w-3.5 h-3.5 text-rose-600" /> {item.message || 'Error'}</>}
            </div>
          </div>)}
        </div>
      </div>}
    </section>
  );
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}
