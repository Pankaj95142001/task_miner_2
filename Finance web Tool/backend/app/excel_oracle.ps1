param(
  [Parameter(Mandatory = $true)]
  [string]$WorkbookPath,

  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [Parameter(Mandatory = $true)]
  [string]$OutputPath,

  [Parameter(Mandatory = $true)]
  [string]$SheetName
)

$ErrorActionPreference = 'Stop'

function Release-ComObjectSafely {
  param([object]$ComObject)

  if ($null -eq $ComObject) {
    return
  }

  try {
    [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($ComObject)
  }
  catch {
  }
}

$excel = $null
$workbook = $null
$worksheet = $null
$usedRange = $null

try {
  $inputData = Get-Content -Path $InputPath -Raw | ConvertFrom-Json

  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $excel.ScreenUpdating = $false
  $excel.EnableEvents = $false

  $workbook = $excel.Workbooks.Open($WorkbookPath, 0, $false)

  foreach ($sheetProperty in $inputData.inputs.PSObject.Properties) {
    $inputWorksheet = $workbook.Worksheets.Item($sheetProperty.Name)
    foreach ($cellProperty in $sheetProperty.Value.PSObject.Properties) {
      $range = $inputWorksheet.Range($cellProperty.Name)
      $nextValue = $cellProperty.Value

      if ($null -eq $nextValue -or [string]::IsNullOrWhiteSpace([string]$nextValue)) {
        $range.Value = $null
      }
      else {
        $range.Value = $nextValue
      }

      Release-ComObjectSafely $range
    }
    Release-ComObjectSafely $inputWorksheet
  }

  $excel.CalculateFullRebuild()

  $worksheet = $workbook.Worksheets.Item($SheetName)
  $usedRange = $worksheet.UsedRange

  $rows = @()

  for ($rowIndex = 1; $rowIndex -le $usedRange.Rows.Count; $rowIndex++) {
    $currentRow = @()
    for ($columnIndex = 1; $columnIndex -le $usedRange.Columns.Count; $columnIndex++) {
      $cell = $usedRange.Cells.Item($rowIndex, $columnIndex)
      $colorIndex = [int]$cell.Interior.ColorIndex
      $hasFormula = [bool]$cell.HasFormula
      $isInput = (-not $hasFormula) -and (($colorIndex -eq 20) -or ($colorIndex -eq 2))

      $currentRow += [pscustomobject]@{
        address = $cell.Address($false, $false)
        text = [string]$cell.Text
        formula = if ($hasFormula) { [string]$cell.Formula } else { '' }
        hasFormula = $hasFormula
        colorIndex = $colorIndex
        isInput = [bool]$isInput
      }

      Release-ComObjectSafely $cell
    }

    $rows += ,$currentRow
  }

  $editableCellCount = @(foreach ($row in $rows) {
    foreach ($cell in $row) {
      if ($cell.isInput) {
        $cell
      }
    }
  }).Count

  $formulaCellCount = @(foreach ($row in $rows) {
    foreach ($cell in $row) {
      if ($cell.hasFormula) {
        $cell
      }
    }
  }).Count

  $payload = [pscustomobject]@{
    sheetName = $SheetName
    usedRange = $usedRange.Address()
    rowCount = $usedRange.Rows.Count
    columnCount = $usedRange.Columns.Count
    rows = $rows
    editableCellCount = $editableCellCount
    formulaCellCount = $formulaCellCount
    inputColorIndices = @(2, 20)
  }

  $payload | ConvertTo-Json -Depth 8 | Set-Content -Path $OutputPath -Encoding utf8
}
finally {
  if ($null -ne $workbook) {
    try {
      $workbook.Close($false)
    }
    catch {
    }
  }

  if ($null -ne $excel) {
    try {
      $excel.Quit()
    }
    catch {
    }
  }

  Release-ComObjectSafely $usedRange
  Release-ComObjectSafely $worksheet
  Release-ComObjectSafely $workbook
  Release-ComObjectSafely $excel

  [System.GC]::Collect()
  [System.GC]::WaitForPendingFinalizers()
}
