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
#   stato     servizi (se uno e' in Paused, il motivo dagli ultimi eventi
#             nssm), chi tiene le porte 8080/3000/5173 e se e' il processo del
#             servizio, avvii automatici delle vecchie finestre, ultime righe
#             dei log. Non cambia niente.
#   prova     fa tutti i controlli di installa e stampa i comandi nssm che
#             eseguirebbe. Non cambia niente.
#   installa  copia nssm.exe in Programmi\nssm, crea i due servizi, li avvia e
#             aspetta le porte. Se un passo fallisce toglie quello che ha creato.
#             Segnala (non tocca) gli avvii automatici delle vecchie finestre.
#   riavvia   ferma i due servizi, aspetta che le porte si liberino, chiude i
#             soli node rimasti sulle tre porte (le vecchie finestre), li
#             riavvia e controlla che siano Running e che le porte siano loro.
#             Altrimenti esce in errore. Per esempio dopo un git pull: node non
#             rilegge i file da solo.
#   rimuovi   ferma e toglie SOLO EasyBoxBackend e EasyBoxPannello. Dopo si
#             torna alle finestre lanciando a mano start_server.bat e start_hmi.bat.
#
# (7/10) PERCHE' STATO E RIAVVIA GUARDANO I PROPRIETARI DELLE PORTE. In cella i
# due servizi uscivano con codice 1 (EADDRINUSE) almeno dalle 13:02: le porte
# le tenevano i node delle vecchie finestre cmd (start_server.bat,
# start_hmi.bat), che partivano ancora all'accesso a Windows, PRIMA dei
# servizi (avvio ritardato). nssm rilanciava node, node usciva subito, e nssm
# metteva il servizio in Paused. Si e' sistemato a mano chiudendo quei node e
# riavviando i servizi; l'avvio automatico delle finestre si toglie con Dario.
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
# (7/10) di chi e' ogni porta: 8080 HTTP e 3000 socket.io del backend, 5173 Vite
$PORTA_SERVIZIO = @{ 8080 = $S_B; 3000 = $S_B; 5173 = $S_P }
# (7/10) cosa fa pensare a un avvio di backend o pannello fuori dai servizi
$AVVIO_SOSPETTO = '(?i)start_server|start_hmi|easybox|serverDati|vite'

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
# (7/10) il contrario: nessuna delle tre porte in ascolto
function AspettaPorteLibere([int]$secondi = 20) {
	$fine = (Get-Date).AddSeconds($secondi)
	do {
		if ((PorteInAscolto).Count -eq 0) { return $true }
		Start-Sleep -Seconds 2
	} while ((Get-Date) -lt $fine)
	return $false
}

# (7/10) di quale dei due servizi e' un processo: si risale dai padri fino al
# processo di nssm del servizio (Win32_Service.ProcessId; node e' suo figlio).
# '' se di nessuno dei due.
function ServizioDelProcesso([int]$processo) {
	$diServizio = @{}
	foreach ($n in @($S_B, $S_P)) {
		$w = Get-CimInstance Win32_Service -Filter ("Name='" + $n + "'") -ErrorAction SilentlyContinue
		if ($w -and $w.ProcessId -gt 0) { $diServizio[[int]$w.ProcessId] = $n }
	}
	$corrente = $processo
	for ($i = 0; $i -lt 6 -and $corrente -gt 0; $i++) {
		if ($diServizio.ContainsKey($corrente)) { return $diServizio[$corrente] }
		$pr = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $corrente) -ErrorAction SilentlyContinue
		if (-not $pr) { break }
		$corrente = [int]$pr.ParentProcessId
	}
	return ''
}
# (7/10) chi tiene le porte: un elemento per porta e processo (Vite ascolta su
# piu' indirizzi), con l'ora di avvio, il padre, la riga di comando (vuota se
# non si e' amministratori) e il servizio a cui appartiene, se appartiene.
function ProcessiSullePorte {
	return @(Get-NetTCPConnection -State Listen -LocalPort $PORTE -ErrorAction SilentlyContinue |
		Sort-Object LocalPort, OwningProcess -Unique |
		ForEach-Object {
			$pr = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $_.OwningProcess) -ErrorAction SilentlyContinue
			$padre = $null
			if ($pr) { $padre = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $pr.ParentProcessId) -ErrorAction SilentlyContinue }
			[pscustomobject]@{
				Porta    = [int]$_.LocalPort
				Processo = [int]$_.OwningProcess
				Nome     = $(if ($pr) { $pr.Name -replace '(?i)\.exe$', '' } else { '?' })
				Avviato  = $(if ($pr -and $pr.CreationDate) { $pr.CreationDate.ToString('dd/MM HH:mm:ss') } else { '?' })
				Servizio = ServizioDelProcesso ([int]$_.OwningProcess)
				Padre    = $(if ($padre) { $padre.Name + ' pid ' + $padre.ProcessId } else { '?' })
				Riga     = $(if ($pr -and $pr.CommandLine) { $pr.CommandLine } else { '' })
			}
		})
}
# (7/10) per ogni porta: chi la tiene e se e' il processo del servizio giusto.
# Ritorna $true se tutte e tre sono in ascolto e tutte del servizio giusto.
function MostraProprietari {
	$righe = ProcessiSullePorte
	$tuttoBene = $true
	foreach ($porta in $PORTE) {
		$atteso = $PORTA_SERVIZIO[$porta]
		$su = @($righe | Where-Object { $_.Porta -eq $porta })
		if ($su.Count -eq 0) { Scrivi ('porta ' + $porta + ': nessuno in ascolto (deve tenerla ' + $atteso + ')') 'Yellow'; $tuttoBene = $false; continue }
		foreach ($r in $su) {
			$riga = 'porta ' + $porta + ': ' + $r.Nome + ' pid ' + $r.Processo + ', avviato ' + $r.Avviato
			if ($r.Servizio -eq $atteso) { Scrivi ($riga + ', del servizio ' + $atteso) 'Green'; continue }
			$tuttoBene = $false
			Scrivi ($riga + ', NON del servizio ' + $atteso + $(if ($r.Servizio) { ' (e'' di ' + $r.Servizio + ')' } else { '' }) + '; padre ' + $r.Padre) 'Red'
			if ($r.Riga) { Scrivi ('    ' + $r.Riga) 'Red' }
		}
	}
	return $tuttoBene
}
# (7/10) gli ultimi eventi di nssm (registro Applicazione) su un servizio: li'
# c'e' il motivo di un Paused (node uscito con codice 1, riavvio ritardato).
function MostraEventi([string]$nome, [int]$quanti = 5) {
	# senza eventi, o con la sorgente nssm non registrata, Get-WinEvent da'
	# un errore che ferma l'istruzione: qui vuol dire solo "nessun evento"
	$ev = @()
	try {
		$ev = @(Get-WinEvent -FilterHashtable @{ LogName = 'Application'; ProviderName = 'nssm' } -MaxEvents 300 -ErrorAction Stop |
			Where-Object { $_.Message -match ('\b' + [regex]::Escape($nome) + '\b') } |
			Select-Object -First $quanti)
	} catch { $ev = @() }
	if ($ev.Count -eq 0) { Scrivi '    nessun evento nssm per questo servizio nel registro Applicazione.' 'Yellow'; return }
	foreach ($e in $ev) { Scrivi ('    ' + $e.TimeCreated.ToString('dd/MM HH:mm:ss') + '  ' + (($e.Message -replace '\s+', ' ').Trim())) 'Yellow' }
}
# (7/10) chiude SOLO i node rimasti sulle tre porte a servizi fermi: sono
# quelli avviati fuori dai servizi (le vecchie finestre dei .bat). Di ognuno
# scrive pid, ora di avvio e riga di comando prima di chiuderlo. Un node di
# uno dei due servizi non si tocca (non dovrebbe esserci: i servizi sono fermi).
function ChiudiNodeSullePorte($rimasti) {
	foreach ($g in @($rimasti | Where-Object { $_.Nome -eq 'node' -and -not $_.Servizio } | Group-Object Processo)) {
		$r = $g.Group[0]
		Scrivi ('  chiudo node pid ' + $r.Processo + ' (porte ' + (($g.Group | ForEach-Object { $_.Porta }) -join ', ') + ', avviato ' + $r.Avviato + ', padre ' + $r.Padre + ')') 'Yellow'
		if ($r.Riga) { Scrivi ('    ' + $r.Riga) 'Yellow' }
		Stop-Process -Id $r.Processo -Force -ErrorAction SilentlyContinue
	}
}

# (7/10) AVVII AUTOMATICI DELLE VECCHIE FINESTRE: cartelle Esecuzione
# automatica (comune e di ogni profilo), chiavi Run e RunOnce (macchina, 64 e
# 32 bit, e utenti col profilo caricato), operazioni pianificate. Si cerca un
# riferimento a backend o pannello ($AVVIO_SOSPETTO). Solo lettura: toglierli
# si decide con Dario.
function AvviiAutomatici {
	$trovati = @()
	$cartelle = @(Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\StartUp')
	foreach ($u in @(Get-CimInstance Win32_UserProfile -ErrorAction SilentlyContinue | Where-Object { -not $_.Special -and $_.LocalPath })) {
		$cartelle += (Join-Path $u.LocalPath 'AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup')
	}
	$shell = New-Object -ComObject WScript.Shell -ErrorAction SilentlyContinue
	foreach ($c in @($cartelle | Select-Object -Unique)) {
		if (-not (Test-Path -LiteralPath $c)) { continue }
		foreach ($f in @(Get-ChildItem -LiteralPath $c -File -ErrorAction SilentlyContinue)) {
			$cosa = $f.FullName
			if ($f.Extension -eq '.lnk' -and $shell) { $l = $shell.CreateShortcut($f.FullName); $cosa = $f.FullName + ' -> ' + $l.TargetPath + ' ' + $l.Arguments + ' (in ' + $l.WorkingDirectory + ')' }
			elseif ($f.Extension -match '^\.(bat|cmd)$') { $cosa = $f.FullName + ' : ' + ((Get-Content -LiteralPath $f.FullName -ErrorAction SilentlyContinue) -join ' ; ') }
			if ($cosa -match $AVVIO_SOSPETTO) { $trovati += [pscustomobject]@{ Dove = 'Esecuzione automatica'; Cosa = $cosa } }
		}
	}
	$chiavi = @('HKLM:\Software\Microsoft\Windows\CurrentVersion\Run', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\RunOnce',
		'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run', 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\RunOnce')
	foreach ($h in @(Get-ChildItem -Path 'Registry::HKEY_USERS' -ErrorAction SilentlyContinue)) {
		$chiavi += ('Registry::' + $h.Name + '\Software\Microsoft\Windows\CurrentVersion\Run')
		$chiavi += ('Registry::' + $h.Name + '\Software\Microsoft\Windows\CurrentVersion\RunOnce')
	}
	foreach ($k in $chiavi) {
		$valori = Get-ItemProperty -Path $k -ErrorAction SilentlyContinue
		if (-not $valori) { continue }
		foreach ($v in $valori.PSObject.Properties) {
			if ($v.Name -like 'PS*') { continue }
			if ([string]$v.Value -match $AVVIO_SOSPETTO) { $trovati += [pscustomobject]@{ Dove = $k; Cosa = $v.Name + ' = ' + $v.Value } }
		}
	}
	foreach ($t in @(Get-ScheduledTask -ErrorAction SilentlyContinue)) {
		foreach ($az in @($t.Actions)) {
			$cmd = ([string]$az.Execute + ' ' + [string]$az.Arguments + ' (in ' + [string]$az.WorkingDirectory + ')').Trim()
			if ($cmd -match $AVVIO_SOSPETTO) { $trovati += [pscustomobject]@{ Dove = 'Operazione pianificata ' + $t.TaskPath + $t.TaskName + ' (' + $t.State + ')'; Cosa = $cmd } }
		}
	}
	return ,$trovati
}
function MostraAvvii {
	$trovati = AvviiAutomatici
	if ($trovati.Count -eq 0) { Scrivi 'Avvii automatici di backend o pannello fuori dai servizi: nessuno (Esecuzione automatica, chiavi Run, operazioni pianificate).' 'Green'; return }
	Scrivi 'ATTENZIONE: avvii automatici di backend o pannello FUORI dai servizi:' 'Yellow'
	$trovati | ForEach-Object { Scrivi ('  [' + $_.Dove + '] ' + $_.Cosa) 'Yellow' }
	Scrivi '  Partono all''accesso a Windows, PRIMA dei servizi (avvio ritardato): prendono le porte, i servizi escono con codice 1 (EADDRINUSE) e nssm li mette in Paused. Vanno tolti, con Dario: lo script non li tocca.' 'Yellow'
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
			# (7/10) un servizio non Running: il motivo e' negli eventi di nssm
			if ($s.Status -ne 'Running') {
				if ([string]$s.Status -match 'Pause') { Scrivi ('  ' + $n + ' e'' in PAUSA: nssm aspetta prima di rilanciare node, che usciva subito dopo l''avvio. Ultimi eventi nssm:') 'Red' }
				else { Scrivi ('  ' + $n + ' non e'' Running. Ultimi eventi nssm:') 'Yellow' }
				MostraEventi $n
			}
		} else { Scrivi ($n + ': non installato') 'Yellow' }
	}
	# (7/10) chi tiene le porte, e se e' il processo del servizio
	if (-not (MostraProprietari)) {
		Scrivi 'Se una porta e'' tenuta da un processo che non e'' del servizio, e'' un node avviato fuori dai servizi (le vecchie finestre dei .bat?): il servizio non riesce a prenderla. Con la cella in HOLD: -Azione riavvia (chiude solo i node rimasti sulle porte).' 'Yellow'
	}
	MostraAvvii
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
	# (7/10) 1. fermi, anche da Paused
	Stop-Service -Name $S_B, $S_P -Force -ErrorAction SilentlyContinue
	foreach ($n in @($S_B, $S_P)) {
		try { (Servizio $n).WaitForStatus('Stopped', [TimeSpan]::FromSeconds(30)) }
		catch { Fermati ($n + ' non si ferma (stato ' + (Servizio $n).Status + ').') 'guardare services.msc e chiamare Dario.' }
	}
	# 2. a servizi fermi le porte devono liberarsi. Se restano prese sono node
	#    avviati fuori dai servizi (le vecchie finestre): si chiudono quelli,
	#    e solo quelli. Un processo che non e' node non si tocca.
	if (-not (AspettaPorteLibere 20)) {
		$rimasti = ProcessiSullePorte
		if (@($rimasti | Where-Object { $_.Nome -ne 'node' -or $_.Servizio }).Count -gt 0) {
			$null = MostraProprietari
			Fermati 'servizi fermi, ma sulle porte c''e'' un processo che non e'' un node delle vecchie finestre: non lo chiudo. I servizi sono FERMI.' 'chiamare Dario con questa finestra.'
		}
		Scrivi 'Servizi fermi, ma le porte sono ancora tenute da node avviati fuori dai servizi (le vecchie finestre dei .bat?):' 'Yellow'
		ChiudiNodeSullePorte $rimasti
		if (-not (AspettaPorteLibere 20)) {
			$null = MostraProprietari
			Fermati 'porte ancora occupate dopo aver chiuso i node. I servizi sono FERMI.' 'chiamare Dario con questa finestra.'
		}
	}
	# 3. avvio, e verifica: Running, e le porte sono dei servizi giusti
	Start-Service -Name $S_B, $S_P
	$suTutte = AspettaPorte 90
	Scrivi ''
	$ok = $suTutte
	foreach ($n in @($S_B, $S_P)) {
		$s = Servizio $n
		if ($s.Status -eq 'Running') { Scrivi ($n + ': Running') 'Green' }
		else { $ok = $false; Scrivi ($n + ': ' + $s.Status + '. Ultimi eventi nssm:') 'Red'; MostraEventi $n }
	}
	if (-not (MostraProprietari)) { $ok = $false }
	Coda $AccessLog 5
	if (-not $ok) {
		Coda $LogB; Coda $LogP
		Fermati 'dopo il riavvio i servizi non sono tutti Running, o le porte non sono tutte dei servizi.' 'leggere eventi e log qui sopra; se una porta e'' di un altro processo, rilanciare -Azione riavvia; se non si sistema, chiamare Dario.'
	}
	Scrivi 'Servizi ripartiti: Running, e le porte 8080, 3000 e 5173 sono loro.' 'Green'
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
$occupate = MostraPorte
# (7/10) le vecchie finestre non devono ripartire da sole all'accesso a
# Windows: si segnalano, non si toccano
MostraAvvii
$comandi = ComandiNssm $node

if ($prova) {
	Scrivi ''
	Scrivi 'PROVA: comandi che installa eseguirebbe (non eseguiti):' 'Cyan'
	$comandi | ForEach-Object { Scrivi ('  ' + (Testo $_)) }
	Scrivi '  Start-Service EasyBoxBackend, EasyBoxPannello'
	if ($occupate.Count -gt 0) {
		Scrivi ''
		Scrivi 'ATTENZIONE: queste porte sono occupate (finestre dei .bat ancora aperte?). Prima di installa vanno chiuse: Ctrl+C nella finestra del backend e in quella del pannello.' 'Yellow'
	}
	Scrivi ''
	Scrivi 'Prova finita: nessuna modifica.' 'Green'
	exit 0
}

# ---------------------------------------------------------------- installa
if ($occupate.Count -gt 0) { Fermati 'le porte 8080/3000/5173 sono occupate: backend o pannello girano ancora nelle finestre.' 'con la cella in HOLD, Ctrl+C nella finestra di start_server.bat e in quella di start_hmi.bat, poi rilanciare lo script.' }

if (-not (Test-Path -LiteralPath $Nssm)) {
	New-Item -ItemType Directory -Path $NssmDir -Force | Out-Null
	Copy-Item -LiteralPath $NssmOrig -Destination $Nssm
	if (-not (Test-Path -LiteralPath $Nssm)) { Fermati ('copia di nssm.exe in ' + $Nssm + ' non riuscita.') 'chiamare Dario.' }
	Scrivi ('nssm copiato in ' + $Nssm)
}
foreach ($d in @((Split-Path $LogB), (Split-Path $LogP))) { New-Item -ItemType Directory -Path $d -Force | Out-Null }

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
