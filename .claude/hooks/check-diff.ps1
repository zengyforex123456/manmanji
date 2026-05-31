# PostToolUse:Write Hook — Auto-detect issues after file changes
# Scans written file for common issues, reports findings

$inputJson = $input | Out-String
try { $event = $inputJson | ConvertFrom-Json } catch { exit 0 }

$toolInput = ($event.tool_input | Out-String)
$toolOutput = ($event.tool_output | Out-String)
$exitCode = $event.exit_code

# Extract file path from Write/Edit tool input
$filePath = ""
if ($toolInput -match '"file_path"\s*:\s*"([^"]+)"') { $filePath = $Matches[1] }
if (-not $filePath -or -not (Test-Path $filePath)) { exit 0 }

$fileName = Split-Path $filePath -Leaf
$ext = [System.IO.Path]::GetExtension($filePath)
$content = Get-Content $filePath -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
if (-not $content) { exit 0 }

$issues = @()

# JS file checks
if ($ext -eq '.js') {
    # innerHTML with potential user input
    $innerCount = ([regex]::Matches($content, 'innerHTML\s*=', 'IgnoreCase')).Count
    if ($innerCount -gt 5) {
        $issues += "[JS] $innerCount innerHTML usages — ensure no user-editable content flows through unsanitized"
    }
    # console.log in production code
    $consoleCount = ([regex]::Matches($content, 'console\.log\(', 'IgnoreCase')).Count
    if ($consoleCount -gt 10) {
        $issues += "[JS] $consoleCount console.log calls — consider removing in production"
    }
}

# CSS file checks
if ($ext -eq '.css') {
    $importantCount = ([regex]::Matches($content, '!important', 'IgnoreCase')).Count
    if ($importantCount -gt 2) {
        $issues += "[CSS] $importantCount !important usages — use specificity instead"
    }
    $smallFonts = ([regex]::Matches($content, 'font-size:\s*(\d+)px', 'IgnoreCase') | Where-Object { [int]$_.Groups[1].Value -lt 12 }).Count
    if ($smallFonts -gt 5) {
        $issues += "[CSS] $smallFonts font-sizes below 12px — target users are 28-45 age group"
    }
}

# HTML file checks
if ($ext -eq '.html') {
    $altMissing = ([regex]::Matches($content, '<img\s+(?!.*alt=)', 'IgnoreCase')).Count
    if ($altMissing -gt 0) {
        $issues += "[HTML] $altMissing img tags without alt attribute"
    }
}

if ($issues.Count -gt 0) {
    Write-Output "[PostWrite] $fileName — $($issues.Count) issue(s) found:"
    foreach ($issue in $issues) {
        Write-Output "  $issue"
    }
} else {
    Write-Output "[PostWrite] $fileName — no issues detected."
}

exit 0
