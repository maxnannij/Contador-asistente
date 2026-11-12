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

/**
 * Normaliza archivos de imagen a un canvas PNG.
 * Tesseract.js puede fallar al recibir ciertos objetos File directamente
 * (por ejemplo WebP o imágenes cuyo MIME no coincide con su contenido).
 */
async function imageFileToCanvas(file: File): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('El navegador no pudo preparar la imagen para el OCR.');

  let bitmap: ImageBitmap | null = null;
  try {
    if (typeof createImageBitmap === 'function') {
      bitmap = await createImageBitmap(file);
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      context.drawImage(bitmap, 0, 0);
    } else {
      await drawImageElement(file, canvas, context);
    }
  } catch {
    // Algunos formatos o navegadores no soportan createImageBitmap:
    // se intenta decodificar mediante HTMLImageElement.
    if (bitmap) bitmap.close();
    canvas.width = 0;
    canvas.height = 0;
    await drawImageElement(file, canvas, context);
  } finally {
    bitmap?.close();
  }

  if (!canvas.width || !canvas.height) {
    throw new Error('La imagen está vacía o tiene un formato que el navegador no puede leer.');
  }

  // Evita consumir memoria excesiva con fotos de muy alta resolución,
  // manteniendo suficiente definición para leer comprobantes.
  const maxDimension = 3200;
  if (Math.max(canvas.width, canvas.height) > maxDimension) {
    const scale = maxDimension / Math.max(canvas.width, canvas.height);
    const resized = document.createElement('canvas');
    resized.width = Math.round(canvas.width * scale);
    resized.height = Math.round(canvas.height * scale);
    const resizedContext = resized.getContext('2d');
    if (!resizedContext) throw new Error('No se pudo ajustar el tamaño de la imagen.');
    resizedContext.drawImage(canvas, 0, 0, resized.width, resized.height);
    canvas.width = 0;
    canvas.height = 0;
    return resized;
  }

  return canvas;
}

function drawImageElement(
  file: File,
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      context.drawImage(image, 0, 0);
      URL.revokeObjectURL(objectUrl);
      resolve();
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo decodificar la imagen. Probá convertirla a JPG o PNG.'));
    };
    image.src = objectUrl;
  });
}

export async function recognizeImageLocally(
  file: File,
  onProgress?: ProgressCallback,
): Promise<string> {
  onProgress?.('Preparando imagen para el OCR...');
  const canvas = await imageFileToCanvas(file);
  try {
    const worker = await getWorker(onProgress);
    onProgress?.('Reconociendo texto de la imagen...');
    const { data } = await worker.recognize(canvas);
    return data.text.trim();
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
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
    try {
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      onProgress?.(`Reconociendo página ${pageNumber} de ${pdf.numPages}...`);
      const { data } = await worker.recognize(canvas);
      recognizedPages.push(data.text.trim());
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  return recognizedPages.filter(Boolean).join('\n\n');
}
