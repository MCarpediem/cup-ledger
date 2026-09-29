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
Assert-Contains $prd '温暖饮品日记' 'PRD visual direction'
Assert-Contains $prd '水用低饱和蓝，咖啡用咖色，茶用绿色' 'PRD category palette'
Assert-Contains $prd '颜色之外同时显示饮品名称或图标' 'non-color-only category recognition'
Assert-Contains $prd '不以纯红色或颜色变化单独传达状态' 'non-color-only reference state'
Assert-Contains $plan '## 6\. 视觉实现' 'visual implementation section'

$baseColors = @('#F6F0E8', '#FFF9F2', '#3F332D', '#786A60', '#E6D9CC', '#8B4F3D')
foreach ($color in $baseColors) {
    Assert-Contains $plan ([regex]::Escape($color)) "base color $color"
}

$categories = @('水', '咖啡', '茶', '牛奶', '果汁', '碳酸饮料', '能量饮料', '运动饮料', '奶茶', '酒精饮品')
foreach ($category in $categories) {
    $pattern = '(?m)^\| ' + [regex]::Escape($category) + ' \| `#[0-9A-F]{6}` \| `#[0-9A-F]{6}` \|$'
    Assert-Contains $plan $pattern "category color $category"
}

Assert-Contains $plan '类别色不承担风险状态含义' 'separate category and risk colors'
Assert-Contains $plan 'Playwright 手机视口覆盖今日、全屏选择与配置、记录和周/月/年统计' 'mobile visual verification'
Assert-Contains $prd '趋势图与分类占比的具体图形形式及细节' 'remaining PRD chart decision'
Assert-Contains $plan '趋势图与分类占比的具体图形形式及细节' 'remaining plan chart decision'

$relativeLinks = [regex]::Matches($plan, '\]\((?!https?://|#)([^)]+)\)')
foreach ($link in $relativeLinks) {
    $target = Join-Path $root $link.Groups[1].Value
    if (-not (Test-Path -LiteralPath $target)) {
        throw "Broken local link: $($link.Groups[1].Value)"
    }
}

Write-Output 'Technical plan checks passed.'
