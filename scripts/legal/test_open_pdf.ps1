$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = [Microsoft.Office.Interop.Word.WdAlertLevel]::wdAlertsNone

$file = Get-ChildItem -Path "C:\Users\madri\Downloads" -Filter "*Ingeniero*.pdf" | Select-Object -First 1

if ($file) {
    Write-Output "Encontrado: $($file.FullName)"
    $doc = $word.Documents.Open($file.FullName, $false, $true, $false)
    Write-Output "--- TEXTO DE CERTIFICACION INGENIERO ---"
    Write-Output $doc.Content.Text
    $doc.Close([Microsoft.Office.Interop.Word.WdSaveOptions]::wdDoNotSave)
} else {
    Write-Output "No encontrado"
}

$word.Quit()
