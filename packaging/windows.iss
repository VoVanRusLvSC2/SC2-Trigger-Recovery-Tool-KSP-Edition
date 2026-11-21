#ifndef StageRoot
  #error StageRoot must name the verified portable application directory
#endif
#ifndef ReleaseDir
  #error ReleaseDir must name the release output directory
#endif
#ifdef Standalone
  #define ProductName "SC2 Trigger Recovery KSP Standalone"
  #define Edition "Standalone"
#else
  #define ProductName "SC2 Trigger Recovery KSP"
  #define Edition "Installed-SC2"
#endif
[Setup]
#ifdef Standalone
AppId={{96CF3250-8816-4F78-8858-C004725B9161}
ExtraDiskSpaceRequired=1500000000
#else
AppId={{12A42223-5F31-482C-BD20-DC03C98795D7}
#endif
Uninstallable=not PortableInstall
AppName={#ProductName}
AppVersion={#AppRelease}
AppPublisher=Trigger Revizer KSP contributors
AppPublisherURL=https://github.com/VoVanRusLvSC2/SC2-Trigger-Recovery-Tool-KSP-Edition
DefaultDirName={localappdata}\Programs\{#ProductName}
AllowNoIcons=yes
DefaultGroupName={#ProductName}
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir={#ReleaseDir}
OutputBaseFilename=SC2-Trigger-Recovery-KSP-{#AppRelease}-{#Edition}-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName={#ProductName}
CloseApplications=no
LicenseFile={#StageRoot}\THIRD_PARTY_NOTICES.md
[Files]
Source: "{#StageRoot}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
[Icons]
Name: "{group}\{#ProductName}"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\packaging\launcher.ps1"""; WorkingDir: "{app}"
Name: "{group}\Command line help"; Filename: "{cmd}"; Parameters: "/k """"{app}\trigger-recovery.cmd"" --help"""; WorkingDir: "{userdocs}"
Name: "{group}\Documentation"; Filename: "{app}\INSTALL.md"
#ifdef Standalone
[UninstallDelete]
Type: filesandordirs; Name: "{app}\.runtime\public-resources"
#endif
[Code]
function PortableInstall: Boolean;
begin
  Result := ExpandConstant('{param:PORTABLE|0}') = '1';
end;
procedure CurStepChanged(CurStep: TSetupStep);
var ResultCode: Integer;
begin
  if CurStep = ssPostInstall then
  begin
    if not Exec(ExpandConstant('{app}\node\node.exe'), '"' + ExpandConstant('{app}\scripts\verify-distribution.mjs') + '"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) or (ResultCode <> 0) then
      RaiseException('Installed file verification failed. Reinstall from a verified release.');
#ifdef Standalone
    WizardForm.StatusLabel.Caption := 'Downloading and verifying public SC2 metadata (1.17 GB expanded)...';
    if not Exec(ExpandConstant('{app}\node\node.exe'), '"' + ExpandConstant('{app}\packaging\install-resources.mjs') + '"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) or (ResultCode <> 0) then
      RaiseException('Public metadata installation failed. Check your Internet connection and disk space, then run Setup again.');
#endif
  end;
end;
