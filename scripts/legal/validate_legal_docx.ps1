$dir = Resolve-Path "documentacion/odontocloud/PAQUETE-LEGAL-Y-CONTRATACION-2026/docx"
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = [Microsoft.Office.Interop.Word.WdAlertLevel]::wdAlertsNone

Write-Output "Iniciando validacion en Microsoft Word..."
$files = Get-ChildItem -Path $dir -Filter "*.docx" | Sort-Object Name

foreach ($f in $files) {
    try {
        $doc = $word.Documents.Open($f.FullName, $false, $true)
        $p = $doc.ComputeStatistics([Microsoft.Office.Interop.Word.WdStatistic]::wdStatisticPages)
        $w = $doc.ComputeStatistics([Microsoft.Office.Interop.Word.WdStatistic]::wdStatisticWords)
        $t = $doc.Tables.Count
        $doc.Close([Microsoft.Office.Interop.Word.WdSaveOptions]::wdDoNotSave)
        Write-Output "[$($f.Name.Substring(0,6))] -> Apertura Exitosa | Pags: $p | Palabras: $w | Tablas: $t"
    } catch {
        Write-Output "[$($f.Name.Substring(0,6))] -> Error: $_"
    }
}

$word.Quit()
Write-Output "Validacion completada."
