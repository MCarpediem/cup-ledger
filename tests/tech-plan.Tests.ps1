$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$planPath = Join-Path $root 'cup-ledger-tech-plan.md'
$prdPath = Join-Path $root 'cup-ledger-prd.md'
$plan = Get-Content -LiteralPath $planPath -Raw -Encoding UTF8
$prd = Get-Content -LiteralPath $prdPath -Raw -Encoding UTF8

function Assert-Contains([string] $Text, [string] $Pattern, [string] $Description) {
    if ($Text -notmatch $Pattern) {
        throw "Missing $Description"
    }
}

Assert-Contains $plan 'React.*TypeScript.*Vite' 'frontend stack'
Assert-Contains $plan 'IndexedDB.*Dexie' 'local persistence stack'
Assert-Contains $plan 'Vitest.*Playwright' 'verification stack'
Assert-Contains $plan '快照' 'immutable record snapshot rule'
Assert-Contains $plan 'null.*0' 'missing versus zero rule'
Assert-Contains $plan '7 天.*365 或 366 天' 'period denominator rule'
Assert-Contains $plan '离线重开' 'offline reopening decision'
Assert-Contains $plan '清空.*二次确认' 'clear-data confirmation'
Assert-Contains $prd '离线完整使用是否纳入首版仍待确定' 'PRD offline scope'

$relativeLinks = [regex]::Matches($plan, '\]\((?!https?://|#)([^)]+)\)')
foreach ($link in $relativeLinks) {
    $target = Join-Path $root $link.Groups[1].Value
    if (-not (Test-Path -LiteralPath $target)) {
        throw "Broken local link: $($link.Groups[1].Value)"
    }
}

Write-Output 'Technical plan checks passed.'
