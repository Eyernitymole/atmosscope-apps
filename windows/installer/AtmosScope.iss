#define MyAppName "AtmosScope"
#define MyAppPublisher "AtmosScope"
#define MyAppExeName "AtmosScope.exe"

[Setup]
AppId={{9262D8D7-7B13-4AE7-B146-24641D47051D}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\AtmosScope
DefaultGroupName=AtmosScope
OutputDir=..\..\artifacts
OutputBaseFilename=AtmosScope-Windows-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
SetupIconFile=..\AtmosScope\Assets\AtmosScope.ico
UninstallDisplayIcon={app}\{#MyAppExeName}

[Files]
Source: "..\publish\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\AtmosScope"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\AtmosScope"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加图标："

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "启动 AtmosScope"; Flags: nowait postinstall skipifsilent
