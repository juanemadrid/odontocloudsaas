import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

async function createFinalZip() {
  const baseDir = path.resolve('documentacion/odontocloud/EXPEDIENTE-INSTITUCIONAL-FINAL-2026');
  const zip = new JSZip();

  // 1. Agregar Índice maestro
  const indexContent = fs.readFileSync(path.join(baseDir, 'INDICE-EXPEDIENTE-FINAL.md'));
  zip.file('INDICE-EXPEDIENTE-FINAL.md', indexContent);

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

  // Generar buffer y guardar
  console.log('Comprimiendo paquete ZIP oficial...');
  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  const zipPath = path.join(baseDir, 'OdontoCloud-2026-Expediente-Institucional-Final.zip');
  fs.writeFileSync(zipPath, zipBuffer);

  const stats = fs.statSync(zipPath);
  console.log(`✓ Archivo ZIP generado con éxito: ${zipPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
}

createFinalZip().catch(err => {
  console.error('Error generando ZIP:', err);
  process.exit(1);
});
