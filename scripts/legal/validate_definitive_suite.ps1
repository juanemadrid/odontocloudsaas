$base = (Resolve-Path 'documentacion/odontocloud/ENTREGA-DEFINITIVA-EXPEDIENTE-2026').Path
$docxDir = Join-Path $base 'docx'
$pdfDir = Join-Path $base 'pdf'

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

Write-Output '================================================================================'
Write-Output 'AUDITORIA DE INTEGRIDAD MICROSOFT WORD 16.0 — ENTREGA DEFINITIVA 2026'
Write-Output '================================================================================'

$docxFiles = Get-ChildItem -Path $docxDir -Filter '*.docx' | Sort-Object Name
$results = @()

foreach ($f in $docxFiles) {
    try {
        $doc = $word.Documents.Open($f.FullName, $false, $true)
        $pagesWord = $doc.ComputeStatistics([Microsoft.Office.Interop.Word.WdStatistic]::wdStatisticPages)
        $words = $doc.ComputeStatistics([Microsoft.Office.Interop.Word.WdStatistic]::wdStatisticWords)
        $tables = $doc.Tables.Count
        $doc.Close(0)

        $pdfPath = Join-Path $pdfDir ($f.BaseName + '.pdf')
        $pdfExists = Test-Path $pdfPath

        $results += [PSCustomObject]@{
            Codigo = $f.BaseName.Substring(0, 7)
            Archivo = $f.Name
            PaginasWord = $pagesWord
            Palabras = $words
            Tablas = $tables
            PDF = if ($pdfExists) { 'Presente' } else { 'Faltante' }
            Estado = 'OK'
        }
    } catch {
        Write-Output 'Error procesando archivo'
    }
}

$word.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null

$results | Format-Table Codigo, PaginasWord, Palabras, Tablas, PDF, Estado -AutoSize
