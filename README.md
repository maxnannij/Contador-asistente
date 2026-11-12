# ContaDoc

Aplicación contable estática para organizar comprobantes de compras y pagos. Está preparada para ejecutarse en GitHub Pages, sin servidor propio, sin Google AI Studio y sin servicios de inteligencia artificial.

## Desarrollo local

```bash
npm install
npm run dev
```

## Compilar

```bash
npm run build
npm run preview
```

## Publicar en GitHub Pages

El workflow `.github/workflows/deploy-pages.yml` compila la aplicación y publica la carpeta `dist` automáticamente. En el repositorio, abrir **Settings → Pages** y seleccionar **GitHub Actions** como fuente de publicación.

La URL del proyecto es:

https://maxnannij.github.io/Contador-asistente/

## Procesamiento de comprobantes

- Los PDF con texto se leen en el navegador mediante PDF.js.
- Los resúmenes de cuenta de Mercado Pago se procesan con reglas y expresiones regulares para generar movimientos de egresos.
- Las facturas se interpretan con reglas de texto para detectar CUIT, fecha, tipo y número de comprobante, neto, IVA y percepciones.
- Las imágenes y los PDF escaneados se guardan para completar los datos manualmente; no se utiliza OCR en esta versión.
- Los archivos se procesan en el dispositivo y no se envían a un servidor.
- Los datos del reporte y parámetros se guardan en el almacenamiento local del navegador. Se recomienda exportar periódicamente copias de Excel.

**Importante:** la extracción por reglas no reemplaza la revisión contable. Los formatos de comprobantes varían; verificar los importes antes de utilizarlos en una declaración o registración.
