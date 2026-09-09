Add-Type -AssemblyName UIAutomationClient
$desktop = [System.Windows.Automation.AutomationElement]::RootElement
$cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, 'Enable audio enhancements')
$el = $desktop.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
$leg = $null
if ($el.TryGetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern, [ref]$leg)) {
  Write-Output ("state=" + $leg.Current.State)
  Write-Output ("defaultaction=" + $leg.Current.DefaultAction)
}
foreach ($p in 'TogglePattern','InvokePattern','SelectionItemPattern') {
  $x = $null
  $t = [System.Windows.Automation.TogglePattern]::Pattern
  if ($p -eq 'InvokePattern') { $t = [System.Windows.Automation.InvokePattern]::Pattern }
  if ($p -eq 'SelectionItemPattern') { $t = [System.Windows.Automation.SelectionItemPattern]::Pattern }
  if ($el.TryGetCurrentPattern($t, [ref]$x)) { Write-Output ("has " + $p) }
}
