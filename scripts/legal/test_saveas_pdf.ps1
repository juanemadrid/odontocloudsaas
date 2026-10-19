$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

$f = (Resolve-Path "documentacion/odontocloud/EXPEDIENTE-INSTITUCIONAL-FINAL-2026/docx/CERT-01-Certificacion-Tecnica-Software-OdontoCloud.docx").Path
$outPdf = Join-Path (Resolve-Path "documentacion/odontocloud/EXPEDIENTE-INSTITUCIONAL-FINAL-2026/pdf").Path "CERT-01-Certificacion-Tecnica-Software-OdontoCloud.pdf"

try {
    $doc = $word.Documents.Open($f, $false, $true)
    Write-Output "Abierto. Guardando como PDF via SaveAs2..."
    $doc.SaveAs2($outPdf, 17)
    Write-Output "Guardado exitoso via SaveAs2!"
    $doc.Close(0)
} catch {
    Write-Output "Error: $_"
}

$word.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
