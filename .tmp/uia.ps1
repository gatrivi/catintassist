Add-Type -AssemblyName UIAutomationClient
$proc = Get-Process rundll32 | Where-Object { $_.MainWindowTitle -like '*Microphone Properties*' } | Select-Object -First 1
$root = [System.Windows.Automation.AutomationElement]::FromHandle($proc.MainWindowHandle)
$cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, 'Enable audio enhancements')
$el = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
if ($el) {
  $pat = $null
  if ($el.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$pat)) {
    Write-Output ("enhancements=" + $pat.Current.ToggleState)
  } else { Write-Output 'no-toggle-pattern' }
} else { Write-Output 'checkbox-not-found' }
