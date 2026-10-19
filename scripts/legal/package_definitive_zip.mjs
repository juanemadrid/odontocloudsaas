import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

async function createDefinitiveZip() {
  const baseDir = path.resolve('documentacion/odontocloud/ENTREGA-DEFINITIVA-EXPEDIENTE-2026');
  const zip = new JSZip();

  // 1. Agregar Índice definitivo
  const indexContent = fs.readFileSync(path.join(baseDir, 'INDICE-EXPEDIENTE-DEFINITIVO.md'));
  zip.file('INDICE-EXPEDIENTE-DEFINITIVO.md', indexContent);

  // 2. Subcarpeta PDF
  const pdfFolder = zip.folder('pdf');
  const pdfDir = path.join(baseDir, 'pdf');
  const pdfFiles = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'));
  for (const f of pdfFiles) {
    const content = fs.readFileSync(path.join(pdfDir, f));
    pdfFolder.file(f, content);
  }

  // 3. Subcarpeta DOCX
  const docxFolder = zip.folder('docx');
  const docxDir = path.join(baseDir, 'docx');
  const docxFiles = fs.readdirSync(docxDir).filter(f => f.endsWith('.docx'));
  for (const f of docxFiles) {
    const content = fs.readFileSync(path.join(docxDir, f));
    docxFolder.file(f, content);
  }

  // Generar buffer comprimido
  console.log('Comprimiendo OdontoCloud-2026-Expediente-Definitivo.zip...');
  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  const zipPath = path.join(baseDir, 'OdontoCloud-2026-Expediente-Definitivo.zip');
  fs.writeFileSync(zipPath, zipBuffer);

  // Copia directa en la raíz documental
  const rootCopyPath = path.resolve('documentacion/odontocloud/OdontoCloud-2026-Expediente-Definitivo.zip');
  fs.writeFileSync(rootCopyPath, zipBuffer);

  const stats = fs.statSync(zipPath);
  console.log(`✓ Archivo ZIP generado con éxito: ${zipPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`✓ Copia de conveniencia en: ${rootCopyPath}`);
}

createDefinitiveZip().catch(err => {
  console.error('Error generando ZIP definitivo:', err);
  process.exit(1);
});
