Add-Type -AssemblyName UIAutomationClient
$desktop = [System.Windows.Automation.AutomationElement]::RootElement
$cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, 'Enable audio enhancements')
$els = $desktop.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)
Write-Output ("found=" + $els.Count)
foreach ($el in $els) {
  $pat = $null
  if ($el.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$pat)) {
    Write-Output ("toggle=" + $pat.Current.ToggleState)
  }
}
