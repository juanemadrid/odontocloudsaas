try {
    $word = New-Object -ComObject Word.Application
    Write-Output "Word Version: $($word.Version)"
    $word.Quit()
} catch {
    Write-Output "Word COM no disponible: $_"
}
