$dir = (Resolve-Path "documentacion/odontocloud/EXPEDIENTE-INSTITUCIONAL-FINAL-2026/docx").Path
$pdfDir = (Resolve-Path "documentacion/odontocloud/EXPEDIENTE-INSTITUCIONAL-FINAL-2026/pdf").Path
$f = Join-Path $dir "CERT-01-Certificacion-Tecnica-Software-OdontoCloud.docx"
$outPdf = Join-Path $pdfDir "CERT-01-Certificacion-Tecnica-Software-OdontoCloud.pdf"

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = [Microsoft.Office.Interop.Word.WdAlertLevel]::wdAlertsNone

try {
    Write-Output "Abriendo $f..."
    $doc = $word.Documents.Open($f, $false, $true)
    Write-Output "Documento abierto exitosamente!"
    $pages = $doc.ComputeStatistics([Microsoft.Office.Interop.Word.WdStatistic]::wdStatisticPages)
    Write-Output "Paginas: $pages"
    
    Write-Output "Exportando a PDF: $outPdf..."
    $doc.ExportAsFixedFormat($outPdf, 17)
    Write-Output "Exportado con exito!"
    $doc.Close([Microsoft.Office.Interop.Word.WdSaveOptions]::wdDoNotSave)
} catch {
    Write-Output "Error: $_"
}

$word.Quit()
