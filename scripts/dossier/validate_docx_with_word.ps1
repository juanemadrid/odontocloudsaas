$docxDir = Resolve-Path "documentacion/odontocloud/expediente-institucional-2026/docx"

Write-Output "================================================================================="
Write-Output "INSPECCION DE INTEGRIDAD OPENXML Y APERTURA REAL CON MICROSOFT WORD"
Write-Output "================================================================================="

$word = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = [Microsoft.Office.Interop.Word.WdAlertLevel]::wdAlertsNone
    Write-Output "Motor de Validacion: Microsoft Word $($word.Version) (Instancia COM Activa)`n"
} catch {
    Write-Error "No se pudo instanciar Microsoft Word COM: $_"
    exit 1
}

$files = Get-ChildItem -Path $docxDir -Filter "*.docx" | Sort-Object Name
$results = @()

Add-Type -AssemblyName System.IO.Compression.FileSystem

foreach ($file in $files) {
    $fullPath = $file.FullName
    $name = $file.Name
    $code = $name.Substring(0, 6)
    
    # 1. Comprobar que en el ZIP interno de Word no exista ninguna extension .undefined
    $zip = [System.IO.Compression.ZipFile]::OpenRead($fullPath)
    $hasUndefined = $false
    $mediaCount = 0
    foreach ($entry in $zip.Entries) {
        if ($entry.FullName.StartsWith("word/media/")) {
            $mediaCount++
            if ($entry.FullName.EndsWith(".undefined")) {
                $hasUndefined = $true
            }
        }
    }
    $zip.Dispose()
    
    $openStatus = "Fallido"
    $pageCount = 0
    $wordCount = 0
    $tableCount = 0
    $shapeCount = 0
    
    try {
        # Abrir el documento directamente con Microsoft Word
        $doc = $word.Documents.Open($fullPath, $false, $true)
        $openStatus = "Apertura Exitosa"
        
        # Consultar estadisticas nativas de Microsoft Word
        $pageCount = $doc.ComputeStatistics([Microsoft.Office.Interop.Word.WdStatistic]::wdStatisticPages)
        $wordCount = $doc.ComputeStatistics([Microsoft.Office.Interop.Word.WdStatistic]::wdStatisticWords)
        $tableCount = $doc.Tables.Count
        $shapeCount = $doc.InlineShapes.Count + $doc.Shapes.Count
        
        $doc.Close([Microsoft.Office.Interop.Word.WdSaveOptions]::wdDoNotSave)
    } catch {
        $openStatus = "Error: " + $_.Exception.Message
    }
    
    $errFlag = "CORREGIDO (0 undefined)"
    if ($hasUndefined) {
        $errFlag = "ERROR DETECTADO"
    }
    
    $resObj = [PSCustomObject]@{
        Codigo = $code
        Archivo = $name
        EstadoAperturaWord = $openStatus
        ImagenesMedia = $mediaCount
        ErrorUndefined = $errFlag
        PaginasWord = $pageCount
        PalabrasWord = $wordCount
        TablasWord = $tableCount
        FigurasWord = $shapeCount
    }
    $results += $resObj
    
    Write-Output "[$code] -> $openStatus | Pags: $pageCount | Palabras: $wordCount | Tablas: $tableCount | Figuras: $shapeCount | ErrorUndefined: $errFlag"
}

$word.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
[System.GC]::Collect()
[System.GC]::WaitForPendingFinalizers()

Write-Output "`n================================================================================="
Write-Output "TABLA FINAL DE VALIDACION INDEPENDIENTE CON MICROSOFT WORD"
Write-Output "================================================================================="
$results | Format-Table -AutoSize Codigo, EstadoAperturaWord, PaginasWord, PalabrasWord, TablasWord, FigurasWord, ErrorUndefined
