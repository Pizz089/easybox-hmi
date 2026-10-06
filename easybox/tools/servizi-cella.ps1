# ============================================================================
# easybox/tools/servizi-cella.ps1 - backend e pannello come servizi Windows
#
# Decisione di Dario (6/10): in cella backend e pannello partono da soli
# all'accensione, come servizi nssm sotto l'utente di sistema (LocalSystem),
# al posto delle due finestre di start_server.bat e start_hmi.bat. I due .bat
# restano come riserva (vedi "rimuovi").
#
#   EasyBoxBackend   node --max-old-space-size=1024 server.js   in easybox\serverDati
#   EasyBoxPannello  node node_modules\vite\bin\vite.js         in easybox\HMI
#
# Uso, da PowerShell COME AMMINISTRATORE:
#   powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\servizi-cella.ps1 -Azione stato
#   powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\servizi-cella.ps1 -Azione prova
#   powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\servizi-cella.ps1 -Azione installa
#   powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\servizi-cella.ps1 -Azione riavvia
#   powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\servizi-cella.ps1 -Azione rimuovi
#
#   stato     servizi, porte 8080/3000/5173, ultime righe dei log. Non cambia niente.
#   prova     fa tutti i controlli di installa e stampa i comandi nssm che
#             eseguirebbe. Non cambia niente.
#   installa  copia nssm.exe in Programmi\nssm, crea i due servizi, li avvia e
#             aspetta le porte. Se un passo fallisce toglie quello che ha creato.
#   riavvia   riavvia i due servizi (per esempio dopo un git pull: node non
#             rilegge i file da solo).
#   rimuovi   ferma e toglie SOLO EasyBoxBackend e EasyBoxPannello. Dopo si
#             torna alle finestre lanciando a mano start_server.bat e start_hmi.bat.
#
# Scelte:
#   - avvio automatico RITARDATO (circa 2 minuti dopo l'accensione): SQL Server
#     e mosquitto, che sono automatici normali, sono gia' su. Nessuna
#     dipendenza dichiarata: fermare mosquitto o SQL non deve fermare i servizi;
#     il backend si ricollega da solo.
#   - se node si chiude, nssm lo riavvia dopo 5 secondi (AppRestartDelay); se
#     cade subito dopo l'avvio, nssm allunga l'attesa da solo (AppThrottle).
#   - l'uscita e gli errori di node vanno in log\servizio_*.log (in coda, con
#     rotazione a 10 MB): oggi un errore all'avvio restava solo nella finestra.
#     access.log del backend resta dov'e'.
#   - Vite parte con node e vite.js direttamente, non con npm: cosi' nssm
#     controlla il processo vero e lo ferma per intero.
#   - nssm.exe viene copiato fuori dal repo (Programmi\nssm): il servizio non
#     deve dipendere da un file dentro D:\Prog\easybox.
#
# Testi senza lettere accentate: PowerShell 5.1 legge i file senza BOM come
# ANSI e le storpierebbe.
# ============================================================================
param(
	[Parameter(Mandatory = $true)]
	[ValidateSet('stato', 'prova', 'installa', 'riavvia', 'rimuovi')]
	[string]$Azione
)

$ErrorActionPreference = 'Continue'

$Easybox   = Split-Path -Parent $PSScriptRoot
$Backend   = Join-Path $Easybox 'serverDati'
$Pannello  = Join-Path $Easybox 'HMI'
$NssmOrig  = Join-Path $Easybox 'nssm.exe'
$NssmDir   = Join-Path $env:ProgramFiles 'nssm'
$Nssm      = Join-Path $NssmDir 'nssm.exe'
$LogB      = Join-Path $Backend 'log\servizio_backend.log'
$LogP      = Join-Path $Pannello 'log\servizio_pannello.log'
$AccessLog = Join-Path $Backend 'log\access.log'
$ViteJs    = Join-Path $Pannello 'node_modules\vite\bin\vite.js'
$ServerJs  = Join-Path $Backend 'server.js'
$S_B = 'EasyBoxBackend'
$S_P = 'EasyBoxPannello'
$PORTE = @(8080, 3000, 5173)

function Scrivi([string]$testo, [string]$colore = 'Gray') { Write-Host $testo -ForegroundColor $colore }
function Fermati([string]$perche, [string]$cosaFare) {
	Scrivi ''
	Scrivi ('FERMO: ' + $perche) 'Red'
	if ($cosaFare) { Scrivi ('Cosa fare: ' + $cosaFare) 'Yellow' }
	exit 1
}
function Amministratore {
	$p = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
	return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}
function Servizio([string]$nome) { return Get-Service -Name $nome -ErrorAction SilentlyContinue }
function PorteInAscolto {
	return @(Get-NetTCPConnection -State Listen -LocalPort $PORTE -ErrorAction SilentlyContinue |
		Sort-Object LocalPort -Unique |
		ForEach-Object {
			$pr = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
			[pscustomobject]@{ Porta = $_.LocalPort; Processo = $_.OwningProcess; Nome = $(if ($pr) { $pr.ProcessName } else { '?' }) }
		})
}
function MostraPorte {
	$p = PorteInAscolto
	if ($p.Count -eq 0) { Scrivi 'Porte 8080/3000/5173: nessuna in ascolto.' 'Yellow' }
	else { $p | Format-Table -AutoSize | Out-String | ForEach-Object { Scrivi $_.TrimEnd() } }
	return $p
}
function Coda([string]$file, [int]$righe = 8) {
	if (Test-Path -LiteralPath $file) {
		Scrivi ('--- ultime righe di ' + $file) 'Cyan'
		Get-Content -LiteralPath $file -Tail $righe | ForEach-Object { Scrivi ('  ' + $_) }
	} else { Scrivi ('--- ' + $file + ': non ancora creato') 'Cyan' }
}
function AspettaPorte([int]$secondi = 90) {
	$fine = (Get-Date).AddSeconds($secondi)
	do {
		$su = @(PorteInAscolto | ForEach-Object { $_.Porta })
		if (($PORTE | Where-Object { $su -notcontains $_ }).Count -eq 0) { return $true }
		Start-Sleep -Seconds 3
	} while ((Get-Date) -lt $fine)
	return $false
}

# comandi nssm, uguali per prova e installa
function ComandiNssm([string]$node) {
	$c = @()
	foreach ($s in @(
		@{ Nome = $S_B; Par = '--max-old-space-size=1024 server.js'; Dir = $Backend; Log = $LogB;
		   Vis = 'EasyBox backend (serverDati)'; Desc = 'Backend della cella EasyBox (node server.js). Installato da easybox\tools\servizi-cella.ps1.' },
		@{ Nome = $S_P; Par = 'node_modules\vite\bin\vite.js'; Dir = $Pannello; Log = $LogP;
		   Vis = 'EasyBox pannello (Vite)'; Desc = 'Pannello della cella EasyBox (Vite, porta 5173). Installato da easybox\tools\servizi-cella.ps1.' })) {
		$c += ,@('install', $s.Nome, $node)
		$c += ,@('set', $s.Nome, 'AppParameters', $s.Par)
		$c += ,@('set', $s.Nome, 'AppDirectory', $s.Dir)
		$c += ,@('set', $s.Nome, 'DisplayName', $s.Vis)
		$c += ,@('set', $s.Nome, 'Description', $s.Desc)
		$c += ,@('set', $s.Nome, 'ObjectName', 'LocalSystem')
		$c += ,@('set', $s.Nome, 'Start', 'SERVICE_DELAYED_AUTO_START')
		$c += ,@('set', $s.Nome, 'AppStdout', $s.Log)
		$c += ,@('set', $s.Nome, 'AppStderr', $s.Log)
		$c += ,@('set', $s.Nome, 'AppStdoutCreationDisposition', '4')
		$c += ,@('set', $s.Nome, 'AppStderrCreationDisposition', '4')
		$c += ,@('set', $s.Nome, 'AppRotateFiles', '1')
		$c += ,@('set', $s.Nome, 'AppRotateOnline', '1')
		$c += ,@('set', $s.Nome, 'AppRotateBytes', '10485760')
		$c += ,@('set', $s.Nome, 'AppExit', 'Default', 'Restart')
		$c += ,@('set', $s.Nome, 'AppRestartDelay', '5000')
		$c += ,@('set', $s.Nome, 'AppThrottle', '10000')
	}
	return ,$c
}
function Testo([string[]]$a) { return ('nssm ' + (($a | ForEach-Object { if ($_ -match '\s') { '"' + $_ + '"' } else { $_ } }) -join ' ')) }

# ---------------------------------------------------------------- stato
if ($Azione -eq 'stato') {
	foreach ($n in @($S_B, $S_P)) {
		$s = Servizio $n
		if ($s) {
			$w = Get-CimInstance Win32_Service -Filter ("Name='" + $n + "'")
			Scrivi ($n + ': ' + $s.Status + ', avvio ' + $w.StartMode + $(if ($w.DelayedAutoStart) { ' (ritardato)' } else { '' }) + ', utente ' + $w.StartName) 'Cyan'
		} else { Scrivi ($n + ': non installato') 'Yellow' }
	}
	$null = MostraPorte
	Coda $LogB; Coda $LogP; Coda $AccessLog 5
	exit 0
}

# ---------------------------------------------------------------- controlli comuni
if (-not (Amministratore)) { Fermati 'serve PowerShell come amministratore.' 'chiudere questa finestra, aprire PowerShell con "Esegui come amministratore" e rilanciare.' }

# ---------------------------------------------------------------- riavvia
if ($Azione -eq 'riavvia') {
	$mancano = @($S_B, $S_P) | Where-Object { -not (Servizio $_) }
	if ($mancano.Count -gt 0) { Fermati ('servizi non installati: ' + ($mancano -join ', ')) 'installarli con -Azione installa, oppure usare le finestre dei .bat.' }
	Scrivi 'Riavvio EasyBoxBackend ed EasyBoxPannello (la cella deve essere in HOLD)...' 'Cyan'
	Restart-Service -Name $S_B, $S_P -Force
	if (AspettaPorte 90) { Scrivi 'Servizi ripartiti: porte 8080, 3000 e 5173 in ascolto.' 'Green' }
	else { Scrivi 'Dopo 90 secondi non tutte le porte sono in ascolto:' 'Yellow'; $null = MostraPorte; Coda $LogB; Coda $LogP }
	Coda $AccessLog 5
	exit 0
}

# ---------------------------------------------------------------- rimuovi
if ($Azione -eq 'rimuovi') {
	if (-not (Test-Path -LiteralPath $Nssm)) { Fermati ('nssm non trovato in ' + $Nssm) 'togliere i servizi a mano da services.msc, o chiamare Dario.' }
	foreach ($n in @($S_P, $S_B)) {
		if (Servizio $n) {
			Scrivi ('Fermo e tolgo ' + $n + '...') 'Cyan'
			Stop-Service -Name $n -Force -ErrorAction SilentlyContinue
			& $Nssm remove $n confirm
			if ($LASTEXITCODE -ne 0) { Scrivi ('  nssm remove ' + $n + ' non riuscito: guardare services.msc.') 'Red' }
		} else { Scrivi ($n + ': non installato, niente da togliere.') }
	}
	Scrivi ''
	Scrivi 'Fatto. Per rimettere su la cella con le finestre: doppio clic su' 'Green'
	Scrivi ('  ' + (Join-Path $Backend 'start_server.bat')) 'Green'
	Scrivi ('  ' + (Join-Path $Pannello 'start_hmi.bat')) 'Green'
	exit 0
}

# ---------------------------------------------------------------- prova / installa: controlli
$prova = ($Azione -eq 'prova')
$node = (Get-Command node.exe -ErrorAction SilentlyContinue | Select-Object -First 1).Source
if (-not $node) { Fermati 'node.exe non trovato.' 'controllare l''installazione di Node.js, poi rilanciare.' }
if (-not (Test-Path -LiteralPath $ServerJs)) { Fermati ('manca ' + $ServerJs) 'lo script va lanciato dalla sua posizione nel repo di cella (D:\Prog\easybox\tools).' }
if (-not (Test-Path -LiteralPath $ViteJs)) { Fermati ('manca ' + $ViteJs) 'le dipendenze del pannello non sono installate: rilanciare pannello.ps1 con la versione attiva.' }
if (-not (Test-Path -LiteralPath $Nssm) -and -not (Test-Path -LiteralPath $NssmOrig)) { Fermati ('nssm.exe non trovato ne'' in ' + $Nssm + ' ne'' in ' + $NssmOrig) 'chiamare Dario.' }

$gia = @($S_B, $S_P) | Where-Object { Servizio $_ }
if ($gia.Count -gt 0) { Fermati ('servizi gia'' installati: ' + ($gia -join ', ')) 'per vederli -Azione stato; per rifarli prima -Azione rimuovi.' }
$altri = @(Get-CimInstance Win32_Service | Where-Object { $_.PathName -match 'nssm' })
if ($altri.Count -gt 0) {
	$altri | Format-Table Name, State, PathName -AutoSize | Out-String | ForEach-Object { Scrivi $_.TrimEnd() 'Yellow' }
	Fermati 'c''e'' gia'' un altro servizio nssm su questo PC: potrebbe essere un vecchio backend sulle stesse porte.' 'chiamare Dario con questo elenco.'
}

Scrivi ('node:       ' + $node)
Scrivi ('nssm:       ' + $(if (Test-Path -LiteralPath $Nssm) { $Nssm } else { $NssmOrig + ' (verra'' copiato in ' + $Nssm + ')' }))
Scrivi ('backend:    ' + $Backend)
Scrivi ('pannello:   ' + $Pannello)
Scrivi ('log:        ' + $LogB + ' , ' + $LogP)
$porte = MostraPorte
$comandi = ComandiNssm $node

if ($prova) {
	Scrivi ''
	Scrivi 'PROVA: comandi che installa eseguirebbe (non eseguiti):' 'Cyan'
	$comandi | ForEach-Object { Scrivi ('  ' + (Testo $_)) }
	Scrivi '  Start-Service EasyBoxBackend, EasyBoxPannello'
	if ($porte.Count -gt 0) {
		Scrivi ''
		Scrivi 'ATTENZIONE: queste porte sono occupate (finestre dei .bat ancora aperte?). Prima di installa vanno chiuse: Ctrl+C nella finestra del backend e in quella del pannello.' 'Yellow'
	}
	Scrivi ''
	Scrivi 'Prova finita: nessuna modifica.' 'Green'
	exit 0
}

# ---------------------------------------------------------------- installa
if ($porte.Count -gt 0) { Fermati 'le porte 8080/3000/5173 sono occupate: backend o pannello girano ancora nelle finestre.' 'con la cella in HOLD, Ctrl+C nella finestra di start_server.bat e in quella di start_hmi.bat, poi rilanciare lo script.' }

if (-not (Test-Path -LiteralPath $Nssm)) {
	New-Item -ItemType Directory -Path $NssmDir -Force | Out-Null
	Copy-Item -LiteralPath $NssmOrig -Destination $Nssm
	if (-not (Test-Path -LiteralPath $Nssm)) { Fermati ('copia di nssm.exe in ' + $Nssm + ' non riuscita.') 'chiamare Dario.' }
	Scrivi ('nssm copiato in ' + $Nssm)
}
New-Item -ItemType Directory -Path (Split-Path $LogP) -Force | Out-Null

foreach ($a in $comandi) {
	Scrivi ('  ' + (Testo $a))
	$uscita = & $Nssm @a 2>&1 | ForEach-Object { "$_" }
	if ($LASTEXITCODE -ne 0) {
		Scrivi ('Comando non riuscito: ' + (Testo $a)) 'Red'
		$uscita | ForEach-Object { Scrivi ('    ' + $_) 'Red' }
		foreach ($n in @($S_P, $S_B)) { if (Servizio $n) { & $Nssm remove $n confirm | Out-Null } }
		Fermati 'installazione non riuscita: i servizi creati sono stati tolti, la cella e'' come prima.' 'rimettere su la cella con i due .bat (doppio clic) e mandare a Dario questa finestra.'
	}
}

Scrivi 'Avvio dei servizi...' 'Cyan'
Start-Service -Name $S_B
Start-Service -Name $S_P
if (AspettaPorte 90) {
	Scrivi ''
	Scrivi 'Servizi installati e avviati: porte 8080, 3000 e 5173 in ascolto.' 'Green'
} else {
	Scrivi ''
	Scrivi 'Servizi installati, ma dopo 90 secondi non tutte le porte sono in ascolto:' 'Yellow'
	$null = MostraPorte
	Coda $LogB; Coda $LogP
	Scrivi 'Se non si sistema da solo: -Azione rimuovi e poi i due .bat.' 'Yellow'
}
Coda $AccessLog 5
Scrivi ''
Scrivi 'Controlli: Ctrl+F5 sul touch e sul tablet, stato del robot che si aggiorna, DB_executeQuery.readyForNextQuery TRUE.' 'Green'
Scrivi 'D''ora in poi: niente finestre dei .bat. Dopo un git pull si usa -Azione riavvia.' 'Green'
exit 0
