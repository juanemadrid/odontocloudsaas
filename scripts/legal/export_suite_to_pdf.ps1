$base = (Resolve-Path "documentacion/odontocloud/EXPEDIENTE-INSTITUCIONAL-FINAL-2026").Path
$docxDir = Join-Path $base "docx"
$pdfDir = Join-Path $base "pdf"

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = [Microsoft.Office.Interop.Word.WdAlertLevel]::wdAlertsNone

Write-Output "================================================================================"
Write-Output "VALIDACION DE INTEGRIDAD Y EXPORTACION NATIVA EN MICROSOFT WORD 16.0"
Write-Output "================================================================================"

$files = Get-ChildItem -Path $docxDir -Filter "*.docx" | Sort-Object Name
$results = @()

foreach ($f in $files) {
    $outPdf = Join-Path $pdfDir ($f.BaseName + ".pdf")
    
    try {
        $doc = $word.Documents.Open($f.FullName, $false, $true)
        $pages = $doc.ComputeStatistics([Microsoft.Office.Interop.Word.WdStatistic]::wdStatisticPages)
        $words = $doc.ComputeStatistics([Microsoft.Office.Interop.Word.WdStatistic]::wdStatisticWords)
        $tables = $doc.Tables.Count
        
        # 17 = wdExportFormatPDF, OpenAfterExport = $false
        $doc.ExportAsFixedFormat($outPdf, 17, $false, 0)
        $doc.Close([Microsoft.Office.Interop.Word.WdSaveOptions]::wdDoNotSave)
        
        Write-Output "[$($f.BaseName)]"
        Write-Output "  [OK] Word Pages: $pages | Words: $words | Tables: $tables | PDF Exportado: Exitoso`n"
        
        $results += [PSCustomObject]@{
            Codigo = $f.BaseName.Substring(0, 7)
            Nombre = $f.BaseName
            PaginasWord = $pages
            Palabras = $words
            Tablas = $tables
            Estado = "Apertura y Exportacion Exitosa"
        }
    } catch {
        Write-Output "[$($f.BaseName)] -> ERROR: $_`n"
    }
}

$word.Quit()

Write-Output "================================================================================"
Write-Output "RESUMEN DE CONTROL DE CALIDAD SUITE FINAL"
Write-Output "================================================================================"
$results | Format-Table Codigo, PaginasWord, Palabras, Tablas, Estado -AutoSize
