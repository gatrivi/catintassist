# Local machine setup only. Run without -Apply to inspect; requires Voicemeeter Standard.
# -MicName: substring match against WDM device names (default: the Realtek headset).
# Plan: docs/soundboard/voicemeeter-mic-plan.md — Strip0=mic->B1, Strip2(VAIO app greetings)->B1.
param([switch]$Apply, [string]$MicName = 'Realtek')
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
Check ([CatVm]::VBVMR_Login())
try {
 Start-Sleep -Milliseconds 250
 [void][CatVm]::VBVMR_IsParametersDirty()
 [int]$kind = 0
 Check ([CatVm]::VBVMR_GetVoicemeeterType([ref]$kind))
 if ($kind -ne 1) { throw 'This setup requires Voicemeeter Standard.' }
 if ($Apply) {
  $backup = Join-Path $env:TEMP ('catint-voicemeeter-before-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.xml')
  Check ([CatVm]::VBVMR_SetParameterStringA('Command.Save', $backup))
  Start-Sleep -Milliseconds 500
  if (!(Test-Path -LiteralPath $backup)) { throw 'Backup was not created; settings left unchanged.' }
  Write-Output "Restore backup: $backup"
  # Find the requested mic by cycling WDM devices ('+' steps to next device).
  $found = $false
  for ($i = 0; $i -lt 16 -and -not $found; $i++) {
    $current = Read-Text 'Strip[0].device.name'
    if ($current -like "*$MicName*") { $found = $true; break }
    Check ([CatVm]::VBVMR_SetParameterStringA('Strip[0].device.wdm', '+'))
    Start-Sleep -Milliseconds 300
    [void][CatVm]::VBVMR_IsParametersDirty()
  }
  if (-not $found) { throw "No WDM device matching '$MicName' found on Strip[0]; settings left as-is (restore: $backup)." }
  Write-Output ("Mic matched: " + (Read-Text 'Strip[0].device.name'))
  # Mic (Strip0) -> B1 (call app mic). App greetings on Strip2 (Voicemeeter VAIO input) -> B1 too.
  foreach ($pair in @(@('Strip[0].A1',0),@('Strip[0].B1',1),@('Strip[0].Mute',0),@('Strip[0].Gain',0),@('Strip[1].B1',0),@('Strip[2].B1',1),@('Bus[1].Mute',0),@('Bus[1].Gain',0))) {
   Check ([CatVm]::VBVMR_SetParameterFloat($pair[0], [single]$pair[1]))
  }
  Start-Sleep -Milliseconds 2500
  [void][CatVm]::VBVMR_IsParametersDirty()
 }
 Write-Output ('Mic: ' + (Read-Text 'Strip[0].device.name'))
 foreach ($name in @('Strip[0].A1','Strip[0].B1','Strip[0].Mute','Strip[1].B1','Strip[2].B1','Bus[1].Mute')) {
  Write-Output ($name + ': ' + (Read-Number $name))
 }
} finally { [void][CatVm]::VBVMR_Logout() }
