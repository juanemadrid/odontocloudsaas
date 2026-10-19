$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

$files = Get-ChildItem -Path "documentacion/odontocloud/EXPEDIENTE-INSTITUCIONAL-FINAL-2026/docx/*.docx" | Sort-Object Name

Write-Output "================================================================================"
Write-Output "REPORTE DE APERTURA Y ESTADISTICAS REALES EN MICROSOFT WORD 16.0"
Write-Output "================================================================================"

foreach ($f in $files) {
    try {
        $doc = $word.Documents.Open($f.FullName, $false, $true)
        $pages = $doc.ComputeStatistics([Microsoft.Office.Interop.Word.WdStatistic]::wdStatisticPages)
        $words = $doc.ComputeStatistics([Microsoft.Office.Interop.Word.WdStatistic]::wdStatisticWords)
        $tables = $doc.Tables.Count
        Write-Output "$($f.Name) | Paginas: $pages | Palabras: $words | Tablas: $tables | Apertura: OK"
        $doc.Close(0)
    } catch {
        Write-Output "$($f.Name) | ERROR: $_"
    }
}

$word.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
