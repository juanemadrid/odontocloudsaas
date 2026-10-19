$base = Resolve-Path "documentacion/odontocloud/PAQUETE-LEGAL-Y-CONTRATACION-2026"
$docxPath = (Get-Item "$base/docx/CON-01-Contrato-Prestacion-Servicio-OdontoCloud-SaaS.docx").FullName
$pdfPath = "$base/pdf/CON-01-Contrato-Prestacion-Servicio-OdontoCloud-SaaS.pdf"

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = [Microsoft.Office.Interop.Word.WdAlertLevel]::wdAlertsNone

$doc = $word.Documents.Open($docxPath, $false, $true)
$pages = $doc.ComputeStatistics([Microsoft.Office.Interop.Word.WdStatistic]::wdStatisticPages)
Write-Output "Word Pages: $pages"

# 17 = wdExportFormatPDF
$doc.ExportAsFixedFormat($pdfPath, 17)
$doc.Close([Microsoft.Office.Interop.Word.WdSaveOptions]::wdDoNotSave)
$word.Quit()

Write-Output "PDF exportado exitosamente desde Word: $pdfPath"
