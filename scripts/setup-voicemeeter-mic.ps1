# Local machine setup only. Run without -Apply to inspect; supports Voicemeeter Standard / Banana / Potato.
# -MicName: substring match against WDM device names (default: the Realtek headset).
# Plan: docs/soundboard/voicemeeter-mic-plan.md — Strip0(mic)->B1, VAIO strip (app greetings)->B1.
param([switch]$Apply, [string]$MicName = 'Realtek', [string]$Restore = '')
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class CatVm {
 const string D = @"C:\Program Files (x86)\VB\Voicemeeter\VoicemeeterRemote64.dll";
 [DllImport(D)] public static extern int VBVMR_Login();
 [DllImport(D)] public static extern int VBVMR_Logout();
 [DllImport(D)] public static extern int VBVMR_IsParametersDirty();
 [DllImport(D)] public static extern int VBVMR_GetVoicemeeterType(ref int value);
 [DllImport(D)] public static extern int VBVMR_GetParameterFloat(string name, ref float value);
 [DllImport(D)] public static extern int VBVMR_GetParameterStringA(string name, StringBuilder value);
 [DllImport(D)] public static extern int VBVMR_SetParameterFloat(string name, float value);
 [DllImport(D)] public static extern int VBVMR_SetParameterStringA(string name, string value);
}
'@
function Check($code) { if ($code -ne 0) { throw "Voicemeeter API returned $code" } }
function Read-Text($name) {
 $value = New-Object System.Text.StringBuilder 512
 Check ([CatVm]::VBVMR_GetParameterStringA($name, $value))
 $value.ToString()
}
function Read-Number($name) {
 [single]$value = 0
 Check ([CatVm]::VBVMR_GetParameterFloat($name, [ref]$value))
 $value
}
# Read a routing param; $null when the strip/bus has no such button (smaller Voicemeeter kind).
function Read-If($name) {
 [single]$value = 0
 if ([CatVm]::VBVMR_GetParameterFloat($name, [ref]$value) -eq 0) { $value } else { $null }
}
function Set-If($name, $val) {
 if ($null -ne (Read-If $name)) { Check ([CatVm]::VBVMR_SetParameterFloat($name, [single]$val)) }
 else { Write-Output "  (skip $name - no such routing on this kind)" }
}
# Check the selected microphone without cycling live devices (which interrupts audio).
function Find-Device($wdmParam, $match, $label) {
 $current = Read-Text ($wdmParam -replace '\.wdm$', '.name')
 if ($match -and $current.IndexOf($match, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
  Write-Output ("  $label matched: " + $current)
  return
 }
 throw "Select the microphone matching '$match' on $label in Voicemeeter first (currently '$current'); settings left unchanged."
}

# Mix buses differ from physical output selectors: Standard A1/A2 share Bus[0] (A).
# Standard B1 is Bus[1], even though Bus[1].device.name selects physical output A2.
# Source: https://download.vb-audio.com/Download_CABLE/VoicemeeterRemoteAPI.pdf
$Layouts = @{
 1 = @{ Name = 'Standard'; Hw = 2; Outputs = 2; Virtual = @{2 = 'VAIO'}; Buses = @('A1','B1') }
 2 = @{ Name = 'Banana'; Hw = 3; Outputs = 3; Virtual = @{3 = 'VAIO'; 4 = 'AUX'}; Buses = @('A1','A2','A3','B1','B2') }
 3 = @{ Name = 'Potato'; Hw = 5; Outputs = 5; Virtual = @{5 = 'VAIO'; 6 = 'AUX'; 7 = 'VAIO3'}; Buses = @('A1','A2','A3','A4','A5','B1','B2','B3') }
}
$BusIndexOf = @{} # bus label -> Bus[i] index (A* first, then B*)
$i = 0

Check ([CatVm]::VBVMR_Login())
try {
 Start-Sleep -Milliseconds 250
 [void][CatVm]::VBVMR_IsParametersDirty()
 if ($Restore) {
  # Recover a settings XML saved by -Apply (Command.Load). Inspection still prints after load.
  Check ([CatVm]::VBVMR_SetParameterStringA('Command.Load', $Restore))
  Start-Sleep -Milliseconds 1500
  [void][CatVm]::VBVMR_IsParametersDirty()
  Write-Output "Loaded restore file: $Restore"
 }
 [int]$kind = 0
 Check ([CatVm]::VBVMR_GetVoicemeeterType([ref]$kind))
 if (-not $Layouts[[int]$kind]) { throw "Unknown Voicemeeter kind $kind." }
 $L = $Layouts[[int]$kind]
 foreach ($b in $L.Buses) { $BusIndexOf[$b] = $i; $i++ }
 Write-Output ("Voicemeeter kind: " + $L.Name)
 if ($Apply) {
  $backup = Join-Path $env:TEMP ('catint-voicemeeter-before-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.xml')
  Check ([CatVm]::VBVMR_SetParameterStringA('Command.Save', $backup))
  Start-Sleep -Milliseconds 500
  if (!(Test-Path -LiteralPath $backup)) { throw 'Backup was not created; settings left unchanged.' }
  Write-Output "Restore backup: $backup"
  # Match the mic FIRST; a throw here leaves routing untouched.
  Find-Device 'Strip[0].device.wdm' $MicName 'Strip[0] mic'
  # Mic (Strip0) -> B1 (client) only; no A1 self-monitor on the mic (feedback-safe).
  # Greetings (VAIO strip) -> B1 (client). Preserve existing hardware monitoring routes.
  Set-If 'Strip[0].A1' 0
  Set-If 'Strip[0].B1' 1
  Set-If 'Strip[0].B2' 0
  Set-If 'Strip[0].B3' 0
  Set-If 'Strip[0].Mute' 0
  Set-If 'Strip[0].Gain' 0
  $vaioIndex = ($L.Virtual.GetEnumerator() | Where-Object { $_.Value -eq 'VAIO' } | Select-Object -First 1).Key
  Set-If "Strip[$vaioIndex].B1" 1
  Set-If "Strip[$vaioIndex].B2" 0
  Set-If "Strip[$vaioIndex].B3" 0
  Set-If ("Bus[" + $BusIndexOf['B1'] + "].Mute") 0
  Set-If ("Bus[" + $BusIndexOf['B1'] + "].Gain") 0
  Start-Sleep -Milliseconds 2500
  [void][CatVm]::VBVMR_IsParametersDirty()
 }
 Write-Output ("Preferred sample rate: " + (Read-If 'Option.sr') + ' Hz')
 if ($kind -eq 1) { Write-Output 'Standard: A1/A2 physical outputs share mix bus A; B1 is Bus[1].' }
 # ---- Inspect: print every strip's routing so the plan doc can be checked at a glance ----
 for ($s = 0; $s -lt $L.Hw; $s++) {
  $label = Read-Text "Strip[$s].device.name"
  $routes = @()
  foreach ($b in $L.Buses) { $val = Read-If "Strip[$s].$b"; if ($val -eq 1) { $routes += $b } }
  $mute = Read-If "Strip[$s].Mute"
  $gain = Read-If "Strip[$s].Gain"
  $rate = Read-If "Strip[$s].device.sr"
  Write-Output ("Strip[$s] hw '" + $label + "': -> " + ($(if ($routes) { $routes -join ',' } else { 'NOTHING' })) + " | Mute=$mute Gain=$gain dB Rate=$rate Hz")
 }
 foreach ($entry in ($L.Virtual.GetEnumerator() | Sort-Object Key)) {
  $s = $entry.Key
  $routes = @()
  foreach ($b in $L.Buses) { $val = Read-If "Strip[$s].$b"; if ($val -eq 1) { $routes += $b } }
  $mute = Read-If "Strip[$s].Mute"
  $gain = Read-If "Strip[$s].Gain"
  Write-Output ("Strip[$s] virtual " + $entry.Value + ": -> " + ($(if ($routes) { $routes -join ',' } else { 'NOTHING' })) + " | Mute=$mute Gain=$gain dB")
 }
 for ($bIdx = 0; $bIdx -lt $L.Buses.Count; $bIdx++) {
  $lbl = $L.Buses[$bIdx]
  $mute = Read-If "Bus[$bIdx].Mute"
  $gain = Read-If "Bus[$bIdx].Gain"
  Write-Output ("Bus[$bIdx] " + $lbl + ": Mute=$mute Gain=$gain dB")
 }
 for ($out = 0; $out -lt $L.Outputs; $out++) {
  $device = Read-Text "Bus[$out].device.name"
  $rate = Read-If "Bus[$out].device.sr"
  Write-Output ("Hardware A" + ($out + 1) + ": '$device' Rate=$rate Hz")
  if ($out -eq 0 -and $device -match 'CABLE') {
   Write-Output "WARNING: A1 is '$device'; hardware monitoring feeds the cable. Select your headset on A1 if you want local monitoring."
  }
 }
} finally { [void][CatVm]::VBVMR_Logout() }
