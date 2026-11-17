#ifndef StageRoot
  #error StageRoot must name the verified portable application directory
#endif
#ifndef ReleaseDir
  #error ReleaseDir must name the release output directory
#endif
[Setup]
AppId={{12A42223-5F31-482C-BD20-DC03C98795D7}
AppName=SC2 Trigger Recovery KSP
AppVersion=3.0.0-rc.6
AppPublisher=Trigger Revizer KSP contributors
AppPublisherURL=https://github.com/VoVanRusLvSC2/SC2-Trigger-Recovery-Tool-KSP-Edition
DefaultDirName={localappdata}\Programs\SC2 Trigger Recovery KSP
DefaultGroupName=SC2 Trigger Recovery KSP
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir={#ReleaseDir}
OutputBaseFilename=SC2-Trigger-Recovery-KSP-3.0.0-rc.6-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName=SC2 Trigger Recovery KSP
CloseApplications=no
LicenseFile={#StageRoot}\THIRD_PARTY_NOTICES.md
[Files]
Source: "{#StageRoot}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
[Icons]
Name: "{group}\SC2 Trigger Recovery KSP"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\packaging\launcher.ps1"""; WorkingDir: "{app}"
Name: "{group}\Command line help"; Filename: "{cmd}"; Parameters: "/k """"{app}\trigger-recovery.cmd"" --help"""; WorkingDir: "{userdocs}"
Name: "{group}\Documentation"; Filename: "{app}\INSTALL.md"
[Code]
procedure CurStepChanged(CurStep: TSetupStep);
var ResultCode: Integer;
begin
  if CurStep = ssPostInstall then
    if not Exec(ExpandConstant('{app}\node\node.exe'), '"' + ExpandConstant('{app}\scripts\verify-distribution.mjs') + '"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) or (ResultCode <> 0) then
      RaiseException('Installed file verification failed. Reinstall from a verified release.');
end;
