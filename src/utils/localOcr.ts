import { createWorker, type Worker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

type ProgressCallback = (message: string) => void;

let workerPromise: Promise<Worker> | null = null;
let activeProgress: ProgressCallback | undefined;

function getWorker(onProgress?: ProgressCallback): Promise<Worker> {
  activeProgress = onProgress;
  if (!workerPromise) {
    workerPromise = createWorker('spa', 1, {
      logger: (message) => {
        if (message.status === 'loading tesseract core') activeProgress?.('Preparando motor OCR local...');
        else if (message.status === 'loading language traineddata') activeProgress?.('Cargando idioma español (primera vez)...');
        else if (message.status === 'initializing api') activeProgress?.('Inicializando reconocimiento...');
        else if (message.status === 'recognizing text') {
          const percent = Math.round((message.progress || 0) * 100);
          activeProgress?.(`Reconociendo texto: ${percent}%`);
        }
      },
    }).catch((error) => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

export async function recognizeImageLocally(
  file: File,
  onProgress?: ProgressCallback,
): Promise<string> {
  const worker = await getWorker(onProgress);
  onProgress?.('Leyendo imagen...');
  const { data } = await worker.recognize(file);
  return data.text.trim();
}

export async function recognizeScannedPdfLocally(
  file: File,
  onProgress?: ProgressCallback,
): Promise<string> {
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  }).promise;
  const worker = await getWorker(onProgress);
  const recognizedPages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    onProgress?.(`Preparando página ${pageNumber} de ${pdf.numPages}...`);
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo preparar la página del PDF para OCR.');

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: context, viewport }).promise;

    onProgress?.(`Reconociendo página ${pageNumber} de ${pdf.numPages}...`);
    const { data } = await worker.recognize(canvas);
    recognizedPages.push(data.text.trim());
    canvas.width = 0;
    canvas.height = 0;
  }

  return recognizedPages.filter(Boolean).join('\n\n');
}
