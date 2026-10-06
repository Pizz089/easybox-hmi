# ============================================================================
# easybox/tools/test_pannello_servizi.ps1 - pannello.ps1 con i servizi
# Windows FINTI, su un clone parziale temporaneo come quello di cella
#
# Il clone si fa dal repo che contiene questo file (origin = il repo
# locale: nessun accesso a GitHub), in cone su easybox/, con i file non
# tracciati della cella. pannello.ps1 gira NELLO STESSO PowerShell, cosi'
# le funzioni finte qui sotto prendono il posto dei cmdlet veri (PowerShell
# preferisce una funzione a un cmdlet con lo stesso nome):
#   Get-Service, Stop-Service, Start-Service, Restart-Service  servizi finti
#   Get-NetTCPConnection                                      porte finte
#   Test-EasyBoxAmministratore                                amministratore si'/no
#   npm.cmd                                                   npm finto (esito scelto)
# Nessun servizio vero viene toccato, nessun npm vero parte.
#
# Casi: servizi assenti (comportamento di prima); servizi presenti e
# amministratore; servizi presenti e non amministratore (si ferma prima del
# fetch); npm install fallito (il pannello si rimette su); pannello che non
# si ferma (nessun file cambiato).
# Uso: powershell -ExecutionPolicy Bypass -File easybox\tools\test_pannello_servizi.ps1
# Exit code = numero di controlli falliti. I rami ui-lifting e ui-v3 del
# repo devono contenere il pannello.ps1 da provare (si prova il committato).
# Prima dei casi, un controllo sul TESTO del pannello.ps1 accanto a questo
# file: nessuna variabile assegnata con un nome che differisce da un altro
# solo per maiuscole e minuscole (per PowerShell e' la stessa).
# ============================================================================
$ErrorActionPreference = 'Continue'
$REPO = ((& git -C $PSScriptRoot rev-parse --show-toplevel) | Select-Object -First 1).Trim()
$BASE = Join-Path ([IO.Path]::GetTempPath()) ('easybox-prova-servizi-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
$global:CLONE = Join-Path $BASE 'Prog'
$SCRIPT = Join-Path $global:CLONE 'easybox\tools\pannello.ps1'
$script:esiti = @()
function Check([bool]$ok, [string]$cosa) {
	$script:esiti += [pscustomobject]@{ Ok = $ok; Cosa = $cosa }
	Write-Host ($(if ($ok) { '  ok   ' } else { '  FAIL ' }) + $cosa)
}
function GitC { & git.exe -C $global:CLONE @args 2>&1 | ForEach-Object { "$_" } }
function Ramo { ((GitC branch --show-current) -join '').Trim() }

# ------------------------------------------------------------ nomi delle variabili
# $segno e $SEGNO sono la STESSA variabile (in servizi-cella.ps1 il 6/10
# $porte sovrascriveva $PORTE). Nomi assegnati: con =, come variabile di un
# foreach, come parametro; senza "script:" e "global:".
$tok = $null; $errPars = $null
$AST = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'pannello.ps1'), [ref]$tok, [ref]$errPars)
$assegnati = @($AST.FindAll({ param($n) $n -is [System.Management.Automation.Language.AssignmentStatementAst] -or $n -is [System.Management.Automation.Language.ForEachStatementAst] -or $n -is [System.Management.Automation.Language.ParameterAst] }, $true) | ForEach-Object {
	$v = if ($_ -is [System.Management.Automation.Language.AssignmentStatementAst]) { $_.Left } elseif ($_ -is [System.Management.Automation.Language.ForEachStatementAst]) { $_.Variable } else { $_.Name }
	# $a, $b = ...  e  [int]$x = ...
	$v = if ($v -is [System.Management.Automation.Language.ArrayLiteralAst]) { $v.Elements } else { @($v) }
	foreach ($e in $v) {
		while ($e -is [System.Management.Automation.Language.AttributedExpressionAst]) { $e = $e.Child }
		if ($e -is [System.Management.Automation.Language.VariableExpressionAst]) { $e.VariablePath.UserPath -replace '^(?i)(script|global|local|private):', '' }
	}
})
$nomiAssegnati = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::Ordinal)
foreach ($a in $assegnati) { [void]$nomiAssegnati.Add($a) }
$stessa = @($nomiAssegnati | Group-Object { $_.ToLowerInvariant() } | Where-Object { $_.Count -gt 1 } | ForEach-Object { ($_.Group | ForEach-Object { '$' + $_ }) -join ' = ' })
Check ($errPars.Count -eq 0 -and $stessa.Count -eq 0) ('pannello.ps1: nessuna variabile assegnata con un nome che differisce da un altro solo per maiuscole/minuscole (' + $nomiAssegnati.Count + ' nomi' + $(if ($stessa.Count) { '; stessa variabile: ' + ($stessa -join ', ') } else { '' }) + ')')

# ------------------------------------------------------------ clone parziale
New-Item -ItemType Directory -Force $BASE | Out-Null
& git.exe clone -q --sparse --branch ui-lifting $REPO $global:CLONE 2>&1 | Out-Null
GitC sparse-checkout set --cone easybox | Out-Null
foreach ($f in @('easybox\serverDati\start_server.bat', 'easybox\HMI\start_hmi.bat', 'easybox\nssm.exe', 'easybox\serverDati_BACKUP_2026-06-03\server.js')) {
	$p = Join-Path $global:CLONE $f
	New-Item -ItemType Directory -Force (Split-Path $p) | Out-Null
	Set-Content -Path $p -Encoding ASCII -Value ('finto, come in cella: ' + $f)
}
Check (Test-Path $SCRIPT) ('clone parziale pronto: ' + $global:CLONE)

# ------------------------------------------------------------ finti
$global:SERVIZI = @{}
$global:CHIAMATE = New-Object System.Collections.ArrayList
$global:ADMIN = $true
$global:NPM_ESITO = 0
$global:PANNELLO_NON_SI_FERMA = $false
function global:Get-Service {
	[CmdletBinding()] param([Parameter(Position = 0)][string[]]$Name)
	foreach ($n in $Name) { if ($global:SERVIZI.ContainsKey($n)) { [pscustomobject]@{ Name = $n; Status = $global:SERVIZI[$n] } } }
}
function global:Stop-Service {
	[CmdletBinding()] param([string[]]$Name, [switch]$Force)
	foreach ($n in $Name) {
		[void]$global:CHIAMATE.Add('Stop ' + $n + ' @' + (((& git.exe -C $global:CLONE branch --show-current) -join '').Trim()))
		if ($global:SERVIZI.ContainsKey($n) -and -not $global:PANNELLO_NON_SI_FERMA) { $global:SERVIZI[$n] = 'Stopped' }
	}
}
function global:Start-Service {
	[CmdletBinding()] param([string[]]$Name)
	foreach ($n in $Name) { [void]$global:CHIAMATE.Add('Start ' + $n); if ($global:SERVIZI.ContainsKey($n)) { $global:SERVIZI[$n] = 'Running' } }
}
function global:Restart-Service {
	[CmdletBinding()] param([string[]]$Name, [switch]$Force)
	foreach ($n in $Name) { [void]$global:CHIAMATE.Add('Restart ' + $n); if ($global:SERVIZI.ContainsKey($n)) { $global:SERVIZI[$n] = 'Running' } }
}
function global:Get-NetTCPConnection {
	[CmdletBinding()] param($State, $LocalPort)
	# porte su quando i due servizi girano
	if ($global:SERVIZI['EasyBoxBackend'] -eq 'Running' -and $global:SERVIZI['EasyBoxPannello'] -eq 'Running') { foreach ($p in $LocalPort) { [pscustomobject]@{ LocalPort = $p } } }
}
function global:Test-EasyBoxAmministratore { return $global:ADMIN }
function global:npm.cmd {
	[void]$global:CHIAMATE.Add('npm ' + ($args -join ' '))
	if ($global:NPM_ESITO -eq 0 -and -not (Test-Path node_modules)) { New-Item -ItemType Directory node_modules | Out-Null }
	$global:LASTEXITCODE = $global:NPM_ESITO
}

function Lancia([string]$versione, [string]$titolo) {
	Write-Host ''
	Write-Host ('=' * 78)
	Write-Host ($titolo + '   ->   pannello.ps1 -Versione ' + $versione)
	Write-Host ('=' * 78)
	$global:CHIAMATE.Clear()
	$out = & $SCRIPT -Versione $versione *>&1 | ForEach-Object { "$_" }
	$codice = $LASTEXITCODE
	$out | ForEach-Object { Write-Host ('  | ' + $_) }
	Write-Host ('  exit code: ' + $codice + '   chiamate: ' + ($global:CHIAMATE -join ' ; '))
	return [pscustomobject]@{ Codice = $codice; Testo = ($out -join "`n"); Chiamate = @($global:CHIAMATE) }
}
$fetchHead = Join-Path $global:CLONE '.git\FETCH_HEAD'

# ------------------------------------------------------------ 1. servizi assenti
$global:SERVIZI = @{}
$r = Lancia 'stato' 'CASO 1a: servizi assenti, stato'
Check ($r.Codice -eq 0 -and $r.Testo -match 'Servizi: EasyBoxBackend non installato, EasyBoxPannello non installato') 'servizi assenti, stato: exit 0 e lo dice'
$r = Lancia 'v3' 'CASO 1b: servizi assenti, passaggio a v3'
Check ($r.Codice -eq 0 -and (Ramo) -eq 'ui-v3') 'servizi assenti: exit 0, ramo ui-v3'
Check ($r.Testo -match 'Ctrl\+C nella finestra di start_server\.bat') 'servizi assenti: messaggio di prima, con le finestre dei .bat'
Check (@($r.Chiamate | Where-Object { $_ -match '^(Stop|Start|Restart) ' }).Count -eq 0) 'servizi assenti: nessun servizio fermato o avviato'

# ------------------------------------------------------------ 2. servizi presenti, amministratore
$global:SERVIZI = @{ 'EasyBoxBackend' = 'Running'; 'EasyBoxPannello' = 'Running' }
$global:ADMIN = $true; $global:NPM_ESITO = 0
$r = Lancia 'stabile' 'CASO 2: servizi presenti, amministratore, ritorno a stabile'
Check ($r.Codice -eq 0 -and (Ramo) -eq 'ui-lifting') 'servizi + amministratore: exit 0, ramo ui-lifting'
$iStop = [array]::IndexOf($r.Chiamate, ($r.Chiamate | Where-Object { $_ -like 'Stop EasyBoxPannello*' } | Select-Object -First 1))
Check ($iStop -ge 0 -and $r.Chiamate[$iStop] -eq 'Stop EasyBoxPannello @ui-v3') 'EasyBoxPannello fermato PRIMA del cambio di ramo (era ancora su ui-v3)'
$iNpm = [array]::IndexOf($r.Chiamate, ($r.Chiamate | Where-Object { $_ -like 'npm*' } | Select-Object -First 1))
$iRestart = [array]::IndexOf($r.Chiamate, 'Restart EasyBoxBackend')
$iStart = [array]::IndexOf($r.Chiamate, 'Start EasyBoxPannello')
Check ($iNpm -gt $iStop -and $iRestart -gt $iNpm -and $iStart -gt $iNpm) ('ordine: stop pannello, npm install, poi riavvio backend e avvio pannello (' + ($r.Chiamate -join ' ; ') + ')')
Check ($global:SERVIZI['EasyBoxBackend'] -eq 'Running' -and $global:SERVIZI['EasyBoxPannello'] -eq 'Running') 'alla fine i due servizi girano'
Check ($r.Testo -match 'Fatto\. Servizi:' -and $r.Testo -match 'Porte 8080, 3000 e 5173 in ascolto' -and $r.Testo -match 'Ctrl\+F5 sui client' -and $r.Testo -match 'readyForNextQuery') 'messaggio finale: cosa e'' stato riavviato, porte e controlli'
Check ($r.Testo -notmatch 'finestra di start_server\.bat|rilanciare start_hmi\.bat') 'nessun riferimento alle finestre dei .bat'

# ------------------------------------------------------------ 3. servizi presenti, NON amministratore
$global:ADMIN = $false
$headPrima = ((GitC rev-parse HEAD) -join '').Trim()
$fetchPrima = (Get-Item $fetchHead).LastWriteTimeUtc
$r = Lancia 'v3' 'CASO 3: servizi presenti, NON amministratore'
Check ($r.Codice -eq 1 -and $r.Testo -match 'FERMO: con i servizi EasyBoxBackend ed EasyBoxPannello installati serve PowerShell come amministratore') 'non amministratore: FERMO'
Check ($r.Testo -match '-Versione v3' -and $r.Testo -match 'Esegui come amministratore') 'e dice il comando da rilanciare'
Check ($r.Testo -notmatch 'git fetch origin\)\.\.\.' -and (Get-Item $fetchHead).LastWriteTimeUtc -eq $fetchPrima) 'si ferma PRIMA del fetch'
Check ($r.Chiamate.Count -eq 0 -and (Ramo) -eq 'ui-lifting' -and ((GitC rev-parse HEAD) -join '').Trim() -eq $headPrima) 'nessun servizio toccato, ramo e commit invariati'

# ------------------------------------------------------------ 4. npm install fallito
$global:ADMIN = $true; $global:NPM_ESITO = 1
$r = Lancia 'v3' 'CASO 4: servizi presenti, npm install fallito'
Check ($r.Codice -eq 1 -and $r.Testo -match 'FERMO: npm install non riuscito') 'npm install fallito: FERMO'
$iStop = [array]::IndexOf($r.Chiamate, ($r.Chiamate | Where-Object { $_ -like 'Stop EasyBoxPannello*' } | Select-Object -First 1))
$iNpm = [array]::IndexOf($r.Chiamate, ($r.Chiamate | Where-Object { $_ -like 'npm*' } | Select-Object -First 1))
$iStart = [array]::IndexOf($r.Chiamate, 'Start EasyBoxPannello')
Check ($iStop -ge 0 -and $iNpm -gt $iStop -and $iStart -gt $iNpm) ('il pannello fermato viene rimesso su dopo il fallimento (' + ($r.Chiamate -join ' ; ') + ')')
Check ($global:SERVIZI['EasyBoxPannello'] -eq 'Running' -and $r.Testo -match 'EasyBoxPannello avviato: il pannello e'' di nuovo su') 'EasyBoxPannello di nuovo Running, e lo dice'
Check (@($r.Chiamate | Where-Object { $_ -like 'Restart EasyBoxBackend*' }).Count -eq 0) 'il backend non viene riavviato su un aggiornamento a meta'''
Check ($r.Testo -notmatch 'Ctrl\+C nella finestra') 'con i servizi il messaggio non parla di finestre'

# ------------------------------------------------------------ 5. il pannello non si ferma
$global:NPM_ESITO = 0; $global:PANNELLO_NON_SI_FERMA = $true
$headPrima = ((GitC rev-parse HEAD) -join '').Trim(); $ramoPrima = Ramo
$r = Lancia 'stabile' 'CASO 5: EasyBoxPannello non si ferma'
Check ($r.Codice -eq 1 -and $r.Testo -match 'FERMO: EasyBoxPannello non si e'' fermato') 'pannello che non si ferma: FERMO'
Check ((Ramo) -eq $ramoPrima -and ((GitC rev-parse HEAD) -join '').Trim() -eq $headPrima -and @($r.Chiamate | Where-Object { $_ -like 'npm*' -or $_ -like 'Restart*' }).Count -eq 0) 'nessun file cambiato, niente npm, niente riavvii'
$global:PANNELLO_NON_SI_FERMA = $false

# ------------------------------------------------------------ pulizia
foreach ($f in @('Get-Service', 'Stop-Service', 'Start-Service', 'Restart-Service', 'Get-NetTCPConnection', 'Test-EasyBoxAmministratore', 'npm.cmd')) { Remove-Item -LiteralPath ('function:\' + $f) -ErrorAction SilentlyContinue }
Remove-Item -LiteralPath $BASE -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ''
$ko = @($script:esiti | Where-Object { -not $_.Ok })
Write-Host ('CHECK: ' + $script:esiti.Count + ', falliti: ' + $ko.Count)
$ko | ForEach-Object { Write-Host ('  FAIL ' + $_.Cosa) }
exit $ko.Count
