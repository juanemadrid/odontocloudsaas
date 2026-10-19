$dir = Resolve-Path "documentacion/odontocloud/PAQUETE-LEGAL-Y-CONTRATACION-2026/docx"
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = [Microsoft.Office.Interop.Word.WdAlertLevel]::wdAlertsNone

$file = Get-Item "$dir/CON-01-Contrato-Prestacion-Servicio-OdontoCloud-SaaS.docx"
$doc = $word.Documents.Open($file.FullName, $false, $true)

$pages = $doc.ComputeStatistics([Microsoft.Office.Interop.Word.WdStatistic]::wdStatisticPages)
Write-Output "TOTAL PAGINAS EN WORD: $pages`n"

for ($i = 1; $i -le $pages; $i++) {
    $p = $doc.Range().GoTo(1, 1, $i)
    if ($i -lt $pages) {
        $pNext = $doc.Range().GoTo(1, 1, $i + 1)
        $rng = $doc.Range($p.Start, $pNext.Start)
    } else {
        $rng = $doc.Range($p.Start, $doc.Range().End)
    }
    $chars = $rng.Characters.Count
    $words = $rng.ComputeStatistics([Microsoft.Office.Interop.Word.WdStatistic]::wdStatisticWords)
    Write-Output "PAGINA $($i): $chars caracteres | $words palabras"
}

$doc.Close([Microsoft.Office.Interop.Word.WdSaveOptions]::wdDoNotSave)
$word.Quit()
