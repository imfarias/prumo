# CT-X01, CT-X02 e CT-X05: instala o .exe (por usuário) e o .msi (por máquina), confere atalhos, a chave
# "Abrir com o Prumo" e o --verificar-instalacao, desinstala e confere que nada ficou para trás.
# Uso: pwsh -File testar-instaladores.ps1 <pasta-com-os-instaladores>
param([Parameter(Mandatory = $true)][string]$Pasta)
$ErrorActionPreference = 'Stop'
$LIMITE_MB = 150
$CHAVE = 'HKCU:\Software\Classes\Directory\shell\Prumo'

function Falhar([string]$m) { Write-Host "FALHOU: $m"; exit 1 }
function Esperar([scriptblock]$cond, [int]$segundos, [string]$o) {
  for ($i = 0; $i -lt $segundos * 2; $i++) { if (& $cond) { return }; Start-Sleep -Milliseconds 500 }
  Falhar "tempo esgotado esperando: $o"
}
function Verificar([string]$exe, [string]$rotulo) {
  $saida = Join-Path $env:RUNNER_TEMP "verificacao-$rotulo.txt"
  if (-not $env:RUNNER_TEMP) { $saida = Join-Path $env:TEMP "verificacao-$rotulo.txt" }
  Remove-Item $saida -ErrorAction SilentlyContinue
  $p = Start-Process -FilePath $exe -ArgumentList "--verificar-instalacao=$saida" -PassThru -Wait
  if ($p.ExitCode -ne 0) { Falhar "$rotulo --verificar-instalacao saiu com $($p.ExitCode): $(Get-Content $saida -ErrorAction SilentlyContinue)" }
  $texto = Get-Content $saida -Raw
  if ($texto -notmatch '^ok ') { Falhar "$rotulo --verificar-instalacao: $texto" }
  Write-Host "$rotulo verificado: $($texto.Trim())"
}

$setup = Get-ChildItem $Pasta -Filter 'Prumo-Setup-*.exe' | Select-Object -First 1
$msi = Get-ChildItem $Pasta -Filter 'Prumo-*.msi' | Select-Object -First 1
if (-not $setup) { Falhar 'sem Prumo-Setup-*.exe' }
if (-not $msi) { Falhar 'sem Prumo-*.msi' }
foreach ($f in @($setup, $msi)) {
  $mb = [math]::Round($f.Length / 1MB, 1)
  Write-Host "$($f.Name): $mb MB"
  if ($mb -ge $LIMITE_MB) { Falhar "$($f.Name) tem $mb MB (limite $LIMITE_MB)" }
}

# --- .exe por usuário (NSIS) ---
$dir = Join-Path $env:LOCALAPPDATA 'Programs\Prumo'
$exe = Join-Path $dir 'Prumo.exe'
$menu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Prumo.lnk'
$area = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Prumo.lnk'
Start-Process -FilePath $setup.FullName -ArgumentList '/S' -Wait
Esperar { Test-Path $exe } 60 'Prumo.exe instalado'
if (-not (Test-Path $menu)) { Falhar "atalho do menu Iniciar ausente: $menu" }
if (-not (Test-Path $area)) { Falhar "atalho da área de trabalho ausente: $area" }
$cmd = (Get-ItemProperty "$CHAVE\command").'(default)'
if ($cmd -ne "`"$exe`" `"%1`"") { Falhar "comando do menu de contexto inesperado: $cmd" }
Verificar $exe 'exe'
Start-Process -FilePath (Join-Path $dir 'Uninstall Prumo.exe') -ArgumentList '/S' -Wait
Esperar { -not (Test-Path $exe) } 60 'Prumo.exe removido'
if (Test-Path $menu) { Falhar 'atalho do menu ficou' }
if (Test-Path $area) { Falhar 'atalho da área de trabalho ficou' }
if (Test-Path $CHAVE) { Falhar 'chave "Abrir com o Prumo" ficou' }
Write-Host '.exe: instalar, verificar e desinstalar ok'

# --- .msi por máquina ---
$exeMsi = Join-Path $env:ProgramFiles 'Prumo\Prumo.exe'
$log = Join-Path $env:TEMP 'prumo-msi.log'
$p = Start-Process msiexec.exe -ArgumentList @('/i', "`"$($msi.FullName)`"", '/qn', '/l*v', "`"$log`"") -PassThru -Wait
if ($p.ExitCode -ne 0) { Get-Content $log -Tail 40; Falhar "msiexec /i saiu com $($p.ExitCode)" }
if (-not (Test-Path $exeMsi)) { Falhar "Prumo.exe não está em $exeMsi" }
$menuTodos = Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\Prumo.lnk'
if (-not (Test-Path $menuTodos) -and -not (Test-Path $menu)) { Falhar 'atalho do menu Iniciar ausente (.msi)' }
Verificar $exeMsi 'msi'
$p = Start-Process msiexec.exe -ArgumentList @('/x', "`"$($msi.FullName)`"", '/qn') -PassThru -Wait
if ($p.ExitCode -ne 0) { Falhar "msiexec /x saiu com $($p.ExitCode)" }
if (Test-Path $exeMsi) { Falhar '.msi: Prumo.exe ficou' }
Write-Host '.msi: instalar, verificar e desinstalar ok'
