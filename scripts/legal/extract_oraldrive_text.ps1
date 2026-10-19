$dir = "C:\Users\madri\Downloads"
$files = Get-ChildItem -Path $dir -Filter "*.pdf" | Where-Object { 
    $_.Name -like "*Salud Drive*" -or $_.Name -like "*Certificación Ingeniero*" -or $_.Name -like "*Terminos y Condiciones*"
}

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = [Microsoft.Office.Interop.Word.WdAlertLevel]::wdAlertsNone

foreach ($f in $files) {
    Write-Output "`n================================================================================"
    Write-Output "ARCHIVO: $($f.Name)"
    Write-Output "================================================================================"
    try {
        $doc = $word.Documents.Open($f.FullName, $false, $true)
        $text = $doc.Content.Text
        $doc.Close([Microsoft.Office.Interop.Word.WdSaveOptions]::wdDoNotSave)
        
        $len = $text.Length
        Write-Output "Longitud texto: $len caracteres"
        $preview = $text.Substring(0, [Math]::Min(3500, $len))
        Write-Output $preview
    } catch {
        Write-Output "Error al abrir con Word: $_"
    }
}

$word.Quit()
