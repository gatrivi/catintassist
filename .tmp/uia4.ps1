Add-Type -AssemblyName UIAutomationClient
$desktop = [System.Windows.Automation.AutomationElement]::RootElement
$cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, 'Enable audio enhancements')
$el = $desktop.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
# Win32 checkboxes: read via MSAA state through LegacyIAccessible property ids
$leg = $el.GetCurrentPattern([System.Windows.Automation.AutomationElement]::NativeWindowHandle) # dummy
# Use IsKeyboardFocusable + bounding box pixel read instead: print properties we can get
Write-Output ("hwnd=" + $el.Current.NativeWindowHandle)
Write-Output ("classname=" + $el.Current.ClassName)
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class W {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out R r);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  public struct R { public int L, T, Rt, B; }
}
"@
$h = [IntPtr]$el.Current.NativeWindowHandle
$r = New-Object W+R
[W]::GetWindowRect($h, [ref]$r) | Out-Null
Write-Output ("rect=" + $r.L + "," + $r.T + "," + $r.Rt + "," + $r.B)
# BM_GETCHECK = 0x00F0 ; BST_CHECKED = 1
$c = [W]::SendMessage($h, 0x00F0, [IntPtr]::Zero, [IntPtr]::Zero)
Write-Output ("checkstate=" + $c)
