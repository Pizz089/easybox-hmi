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
#                    (server di sviluppo), oppure dal 7/10
#                    node node_modules\vite\bin\vite.js preview --port 5173 --strictPort
#                    (pannello COMPILATO in easybox\HMI\dist: -Azione preview)
#
# Uso, da PowerShell COME AMMINISTRATORE:
#   powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\servizi-cella.ps1 -Azione stato
#   powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\servizi-cella.ps1 -Azione prova
#   powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\servizi-cella.ps1 -Azione installa
#   powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\servizi-cella.ps1 -Azione riavvia
#   powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\servizi-cella.ps1 -Azione rimuovi
#   powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\servizi-cella.ps1 -Azione preview
#   powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\servizi-cella.ps1 -Azione aggiorna
#   powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\servizi-cella.ps1 -Azione ripristina
#   powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\servizi-cella.ps1 -Azione dev
#
#   stato     servizi (se uno e' in Paused, il motivo dagli ultimi eventi
#             nssm), chi tiene le porte 8080/3000/5173 e se e' il processo del
#             servizio, avvii automatici delle vecchie finestre (le operazioni
#             pianificate solo se attive), ultime righe dei log. Non cambia
#             niente.
#   prova     fa tutti i controlli di installa e stampa i comandi nssm che
#             eseguirebbe. Non cambia niente.
#   installa  copia nssm.exe in Programmi\nssm, crea i due servizi, li avvia e
#             aspetta le porte. Se un passo fallisce toglie quello che ha creato.
#             Prima di tutto segnala gli avvii automatici delle vecchie finestre
#             e propone di disabilitare le operazioni pianificate attive (solo
#             con una "s"; prima ne salva la definizione). Anche coi servizi
#             gia' installati, prima di fermarsi.
#   riavvia   ferma i due servizi, aspetta che le porte si liberino, chiude i
#             soli node rimasti sulle tre porte (le vecchie finestre), li
#             riavvia (prima il backend, poi il pannello) e controlla che siano
#             Running e che le porte siano loro. Altrimenti esce in errore.
#             Per esempio dopo un git pull col server di sviluppo: node non
#             rilegge i file da solo.
#   rimuovi   ferma e toglie SOLO EasyBoxBackend e EasyBoxPannello. Dopo si
#             torna alle finestre lanciando a mano start_server.bat e start_hmi.bat.
#
# (7/10, decisione di Dario) PANNELLO COMPILATO. Il server di sviluppo compila
# i moduli alla prima richiesta e il primo caricamento dopo un avvio e' lento;
# il pacchetto compilato (vite build -> HMI\dist) lo serve vite preview, con lo
# stesso proxy e lo stesso HTTPS (vite.config.js), sulla stessa porta 5173.
#   preview   passaggio dal server di sviluppo al compilato, una volta: build
#             in dist_build, che diventa dist (la dist di prima, se c'e', va
#             in dist_prev), AppParameters del pannello a "preview", riavvio
#             del solo pannello e verifica. Se la build fallisce non cambia
#             niente.
#   aggiorna  dopo ogni git pull, col pannello compilato: un comando solo.
#             Build in dist_build; se fallisce si ferma e dist e servizi
#             restano come sono. Se riesce: servizi fermi, dist -> dist_prev,
#             dist_build -> dist, poi riavvio del backend e del pannello (il
#             backend prima, come riavvia), verifica e stato.
#   ripristina scambia dist e dist_prev (torna alla build di prima; lanciato
#             di nuovo, torna a quella nuova) e riavvia il pannello.
#   dev       ritorno al server di sviluppo: AppParameters di nuovo vite.js,
#             riavvio del pannello. dist resta su disco, non si usa.
#   modo      (7/10 sera) scrive come gira il pannello: preview, dev, altro o
#             niente (non installato). Non serve l'amministratore: lo usa
#             pannello.ps1 per sapere se deve lanciare aggiorna.
#   servito   (7/10 sera, B59) da che commit viene il pannello servito: legge
#             dist\build.txt (lo scrive la build, vite.config.js) e lo
#             confronta col commit piu' recente che tocca easybox/HMI. Se la
#             build non lo contiene, riga rossa "pannello servito non
#             aggiornato: -Azione aggiorna". Non serve l'amministratore; lo
#             stampano anche stato e pannello.ps1 -Versione stato.
# Le quattro azioni riavviano con le cautele di riavvia (porta tenuta da un
# altro processo, servizio in Paused) e segnalano le operazioni pianificate
# attive. preview, ripristina e dev toccano solo il pannello; aggiorna
# riavvia anche il backend, perche' dopo un git pull serve a tutti e due.
#
# (7/10) PERCHE' STATO E RIAVVIA GUARDANO I PROPRIETARI DELLE PORTE. In cella i
# due servizi uscivano con codice 1 (EADDRINUSE) almeno dalle 13:02: le porte
# le tenevano i node delle vecchie finestre cmd (start_server.bat,
# start_hmi.bat), che partivano ancora all'accesso a Windows, PRIMA dei
# servizi (avvio ritardato). nssm rilanciava node, node usciva subito, e nssm
# metteva il servizio in Paused. Si e' sistemato a mano chiudendo quei node e
# riavviando i servizi. CAUSA trovata il 7/10: quattro operazioni pianificate
# all'accesso, \EasyBox Server (cmd /k ... npx nodemon server.js),
# \ServerDati (start_server.bat), \EasyBox HMI (cmd /k ... npm run dev) e \HMI
# (start_hmi.bat). Disabilitate da Dario ed esportate in
# D:\EasyBox_backup\task_2026-10-07. nodemon in piu' riavviava il backend a
# ogni git pull.
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
	[ValidateSet('stato', 'prova', 'installa', 'riavvia', 'rimuovi', 'preview', 'aggiorna', 'ripristina', 'dev', 'modo', 'servito')]
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
# (7/10) pannello compilato: la dist servita, quella di prima, la build nuova
$Dist      = Join-Path $Pannello 'dist'
$DistPrev  = Join-Path $Pannello 'dist_prev'
$DistBuild = Join-Path $Pannello 'dist_build'
$LogBuild  = Join-Path $Pannello 'log\build_pannello.log'
# (7/10 sera, B59) da che commit viene la dist servita: lo scrive la build
$BuildTxt  = Join-Path $Dist 'build.txt'
$ChiavePannello = 'HKLM:\SYSTEM\CurrentControlSet\Services\EasyBoxPannello\Parameters'
$PAR_DEV     = 'node_modules\vite\bin\vite.js'
$PAR_PREVIEW = 'node_modules\vite\bin\vite.js preview --port 5173 --strictPort'
$ServerJs  = Join-Path $Backend 'server.js'
$S_B = 'EasyBoxBackend'
$S_P = 'EasyBoxPannello'
$PORTE = @(8080, 3000, 5173)
# (7/10) di chi e' ogni porta: 8080 HTTP e 3000 socket.io del backend, 5173 Vite
$PORTA_SERVIZIO = @{ 8080 = $S_B; 3000 = $S_B; 5173 = $S_P }
# (7/10) cosa fa pensare a un avvio di backend o pannello fuori dai servizi
$AVVIO_SOSPETTO = '(?i)start_server|start_hmi|serverDati|\bnode(\.exe)?\b|\bnpm|nodemon|vite|easybox'
# (7/10) i browser che aprono il pannello all'accesso: non sono avvii di
# backend o pannello (EBrowser)
$BROWSER_PANNELLO = '(?i)(^|\\)(chrome|chrome_proxy|msedge)(\.exe)?$'

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
# $quali: le porte da aspettare (di default tutte e tre; il solo pannello: 5173)
function AspettaPorte([int]$secondi = 90, [int[]]$quali = $PORTE) {
	$fine = (Get-Date).AddSeconds($secondi)
	do {
		$su = @(PorteInAscolto | ForEach-Object { $_.Porta })
		if (@($quali | Where-Object { $su -notcontains $_ }).Count -eq 0) { return $true }
		Start-Sleep -Seconds 3
	} while ((Get-Date) -lt $fine)
	return $false
}
# (7/10) il contrario: nessuna di quelle porte in ascolto
function AspettaPorteLibere([int]$secondi = 20, [int[]]$quali = $PORTE) {
	$fine = (Get-Date).AddSeconds($secondi)
	do {
		if (@(PorteInAscolto | Where-Object { $quali -contains $_.Porta }).Count -eq 0) { return $true }
		Start-Sleep -Seconds 2
	} while ((Get-Date) -lt $fine)
	return $false
}
# (7/10) come gira il pannello: 'preview' (compilato), 'dev' (server di
# sviluppo), 'altro' (parametri diversi) o '' (non installato). Si legge dal
# registro, dove nssm tiene AppParameters.
function ModoPannello {
	$v = Get-ItemProperty -Path $ChiavePannello -ErrorAction SilentlyContinue
	if (-not $v) { return '' }
	$p = [string]$v.AppParameters
	if ($p -eq $PAR_PREVIEW) { return 'preview' }
	if ($p -eq $PAR_DEV) { return 'dev' }
	return 'altro'
}
# (7/10) una dist e' servibile se ha index.html; si scrive anche quando e'
# stata compilata (data di index.html)
function DescriviDist([string]$cartella) {
	$idx = Join-Path $cartella 'index.html'
	if (-not (Test-Path -LiteralPath $idx)) { return $(if (Test-Path -LiteralPath $cartella) { 'presente ma SENZA index.html' } else { 'assente' }) }
	return ('compilata il ' + (Get-Item -LiteralPath $idx).LastWriteTime.ToString('dd/MM HH:mm'))
}

# (7/10 sera, B59) dist\build.txt: righe chiave=valore (ramo, commit, data).
# $null se il file non c'e'.
function LeggiBuildTxt([string]$file) {
	if (-not (Test-Path -LiteralPath $file)) { return $null }
	$v = @{}
	foreach ($r in @(Get-Content -LiteralPath $file -ErrorAction SilentlyContinue)) {
		if ($r -match '^\s*([a-z]+)\s*=\s*(.*?)\s*$') { $v[$Matches[1]] = $Matches[2] }
	}
	return $v
}
# La build contiene l'ultimo commit che tocca easybox/HMI? Si' se e' lo stesso
# commit o un suo discendente (dopo la build puo' esserci un commit che non
# tocca il pannello, es. i documenti: la dist resta buona).
#   $true aggiornato, $false no (commit diverso, non leggibile o sconosciuto)
function BuildContiene([string]$commitBuild, [string]$ultimoHmi) {
	if ($commitBuild -notmatch '^[0-9a-f]{7,40}$' -or $ultimoHmi -notmatch '^[0-9a-f]{7,40}$') { return $false }
	if ($commitBuild -eq $ultimoHmi) { return $true }
	# un commit che il repo non conosce: git scrive su stderr, e' un "no"
	try { & git -C $Pannello merge-base --is-ancestor $ultimoHmi $commitBuild 2>$null; return ($LASTEXITCODE -eq 0) }
	catch { return $false }
}
# Stampa da che commit viene il pannello servito e se e' aggiornato.
# Ritorna $true se aggiornato.
function PannelloServito {
	$b = LeggiBuildTxt $BuildTxt
	if (-not $b) {
		Scrivi ('Pannello servito: ' + $BuildTxt + ' non c''e'' (dist assente o compilata prima del 7/10 sera): non si sa da che commit viene. -Azione aggiorna lo riscrive.') 'Yellow'
		return $false
	}
	Scrivi ('Pannello servito: ramo ' + $b['ramo'] + ', commit ' + $b['commit'] + ', compilato il ' + $b['data']) 'Cyan'
	$ultimo = ((& git -C $Pannello log -1 --format=%H -- . 2>$null) -join '').Trim()
	if (-not $ultimo) { Scrivi '  ultimo commit di easybox/HMI non leggibile (git?): confronto saltato.' 'Yellow'; return $false }
	if (-not (BuildContiene $b['commit'] $ultimo)) {
		Scrivi ('pannello servito non aggiornato: -Azione aggiorna (ultimo commit di easybox/HMI: ' + $ultimo + ')') 'Red'
		return $false
	}
	Scrivi ('  aggiornato: contiene l''ultimo commit di easybox/HMI (' + $ultimo + ').') 'Green'
	return $true
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
# 32 bit, e utenti col profilo caricato). Si cerca un riferimento a backend o
# pannello ($AVVIO_SOSPETTO). Solo lettura. Le operazioni pianificate sono a
# parte (OperazioniSospette), perche' hanno uno stato e si possono disabilitare.
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
			$browser = $false
			if ($f.Extension -eq '.lnk' -and $shell) { $l = $shell.CreateShortcut($f.FullName); $cosa = $f.FullName + ' -> ' + $l.TargetPath + ' ' + $l.Arguments + ' (in ' + $l.WorkingDirectory + ')'; $browser = EBrowser $l.TargetPath }
			elseif ($f.Extension -match '^\.(bat|cmd)$') { $cosa = $f.FullName + ' : ' + ((Get-Content -LiteralPath $f.FullName -ErrorAction SilentlyContinue) -join ' ; ') }
			if ($cosa -match $AVVIO_SOSPETTO) { $trovati += [pscustomobject]@{ Dove = 'Esecuzione automatica'; Cosa = $cosa; Browser = $browser } }
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
			if ([string]$v.Value -match $AVVIO_SOSPETTO) {
				# il programma e' il primo pezzo della riga, fra virgolette o fino allo spazio
				$m = [regex]::Match([string]$v.Value, '^\s*(?:"([^"]+)"|(\S+))')
				$trovati += [pscustomobject]@{ Dove = $k; Cosa = $v.Name + ' = ' + $v.Value; Browser = (EBrowser ($m.Groups[1].Value + $m.Groups[2].Value)) }
			}
		}
	}
	return ,$trovati
}
# (7/10) OPERAZIONI PIANIFICATE che avviano backend o pannello. La causa
# trovata in cella il 7/10: \EasyBox Server (cmd /k ... npx nodemon
# server.js), \ServerDati (start_server.bat), \EasyBox HMI (cmd /k ... npm run
# dev) e \HMI (start_hmi.bat) partivano all'accesso a Windows, prima dei
# servizi. Si guarda il nome e le azioni (programma, argomenti, cartella).
# Browser = $true se tutte le azioni lanciano un browser (EBrowser): e' il
# pannello che si apre nel browser, non un avvio di backend o pannello.
function OperazioniSospette {
	$trovate = @()
	foreach ($t in @(Get-ScheduledTask -ErrorAction SilentlyContinue)) {
		$azioni = (@($t.Actions | ForEach-Object { ([string]$_.Execute + ' ' + [string]$_.Arguments + $(if ($_.WorkingDirectory) { ' (in ' + $_.WorkingDirectory + ')' } else { '' })).Trim() }) -join ' | ')
		if (($t.TaskName + ' ' + $azioni) -match $AVVIO_SOSPETTO) {
			$programmi = @($t.Actions | ForEach-Object { [string]$_.Execute })
			$browser = $programmi.Count -gt 0 -and @($programmi | Where-Object { -not (EBrowser $_) }).Count -eq 0
			$trovate += [pscustomobject]@{ Percorso = $t.TaskPath; Nome = $t.TaskName; Stato = [string]$t.State; Azioni = $azioni; Browser = $browser }
		}
	}
	return ,$trovate
}
# (7/10) il programma e' un browser (chrome, chrome_proxy, msedge)? In cella
# l'operazione pianificata \EasyBox Browser (chrome_proxy.exe --app-id=...
# --start-maximized) apre il pannello nel browser all'accesso: non prende porte
# e deve restare attiva. Non e' un avvio di backend o pannello.
function EBrowser([string]$programma) {
	return ($programma.Trim().Trim('"') -match $BROWSER_PANNELLO)
}
# Elenca gli avvii automatici. soloAttive: le operazioni pianificate solo se
# NON disabilitate (stato); altrimenti tutte, col loro stato (installa, prova).
# I browser del pannello si elencano a parte, "ok", senza avviso. Ritorna le
# operazioni attive che avviano backend o pannello (mai quelle dei browser).
function MostraAvvii([bool]$soloAttive = $false) {
	$tutti = AvviiAutomatici
	$tutteOp = OperazioniSospette
	$altri = @($tutti | Where-Object { -not $_.Browser })
	$operazioni = @($tutteOp | Where-Object { -not $_.Browser })
	$attive = @($operazioni | Where-Object { $_.Stato -ne 'Disabled' })
	$elenco = @($(if ($soloAttive) { $attive } else { $operazioni }))
	$browser = @(@($tutti | Where-Object { $_.Browser } | ForEach-Object { '[' + $_.Dove + '] ' + $_.Cosa }) +
		@($tutteOp | Where-Object { $_.Browser -and (-not $soloAttive -or $_.Stato -ne 'Disabled') } | ForEach-Object { '[operazione pianificata ' + $_.Percorso + $_.Nome + ', ' + $_.Stato + '] ' + $_.Azioni }))
	if ($browser.Count -gt 0) {
		Scrivi 'Browser del pannello all''accesso (ok: non prendono porte, restano attivi):' 'Green'
		$browser | ForEach-Object { Scrivi ('  ' + $_) 'Green' }
	}
	if ($altri.Count -eq 0 -and $elenco.Count -eq 0) {
		Scrivi ('Avvii automatici di backend o pannello fuori dai servizi: nessuno' + $(if ($soloAttive -and $operazioni.Count -gt 0) { ' attivo (operazioni pianificate trovate: ' + $operazioni.Count + ', tutte disabilitate)' } else { '' }) + ' (Esecuzione automatica, chiavi Run, operazioni pianificate).') 'Green'
		return ,$attive
	}
	if ($altri.Count -gt 0 -or $attive.Count -gt 0) { Scrivi 'ATTENZIONE: avvii automatici di backend o pannello FUORI dai servizi:' 'Yellow' }
	else { Scrivi 'Operazioni pianificate di backend o pannello: tutte disabilitate, non partono.' 'Green' }
	$altri | ForEach-Object { Scrivi ('  [' + $_.Dove + '] ' + $_.Cosa) 'Yellow' }
	$elenco | ForEach-Object { Scrivi ('  [operazione pianificata ' + $_.Percorso + $_.Nome + ', ' + $_.Stato + '] ' + $_.Azioni) $(if ($_.Stato -ne 'Disabled') { 'Red' } else { 'Gray' }) }
	if ($altri.Count -gt 0 -or $attive.Count -gt 0) {
		Scrivi '  Partono all''accesso a Windows, PRIMA dei servizi (avvio ritardato): prendono le porte, i servizi escono con codice 1 (EADDRINUSE) e nssm li mette in Paused. Vanno tolti.' 'Yellow'
	}
	return ,$attive
}
# (7/10) propone di DISABILITARE le operazioni pianificate attive trovate
# (solo da installa, da amministratore). Solo con una "s" esplicita; prima ne
# salva la definizione (Export-ScheduledTask) in <disco>\EasyBox_backup\
# task_<data e ora>, come quelle che Dario ha disabilitato il 7/10. Niente
# viene cancellato: si riattivano con Enable-ScheduledTask.
function ProponiDisabilita($attive) {
	$dir = Join-Path (Split-Path -Qualifier $Easybox) ('EasyBox_backup\task_' + (Get-Date -Format 'yyyy-MM-dd_HHmmss'))
	Scrivi ''
	Scrivi ('Disabilitare le operazioni pianificate attive qui sopra (' + $attive.Count + ')? Prima ne salvo la definizione in ' + $dir + '; si riattivano con Enable-ScheduledTask.') 'Yellow'
	$risposta = ''
	try { $risposta = Read-Host 'Scrivere s e invio per disabilitarle, solo invio per lasciarle' } catch { $risposta = '' }
	if ($risposta -ne 's') {
		Scrivi 'Lasciate come sono. A mano, da PowerShell come amministratore:' 'Yellow'
		$attive | ForEach-Object { Scrivi ('  Disable-ScheduledTask -TaskPath ''' + $_.Percorso + ''' -TaskName ''' + $_.Nome + '''') 'Yellow' }
		return
	}
	New-Item -ItemType Directory -Path $dir -Force | Out-Null
	foreach ($o in $attive) {
		$chi = $o.Percorso + $o.Nome
		$xml = Export-ScheduledTask -TaskPath $o.Percorso -TaskName $o.Nome -ErrorAction SilentlyContinue
		if (-not $xml) { Scrivi ('  ' + $chi + ': definizione non salvata, NON la disabilito.') 'Red'; continue }
		$file = Join-Path $dir (($chi.Trim('\') -replace '[\\/:*?"<>|]', '_') + '.xml')
		[IO.File]::WriteAllText($file, $xml, [Text.Encoding]::Unicode)
		$null = Disable-ScheduledTask -TaskPath $o.Percorso -TaskName $o.Nome -ErrorAction SilentlyContinue
		$dopo = Get-ScheduledTask -TaskPath $o.Percorso -TaskName $o.Nome -ErrorAction SilentlyContinue
		if ($dopo -and [string]$dopo.State -eq 'Disabled') { Scrivi ('  ' + $chi + ': disabilitata (definizione in ' + $file + ')') 'Green' }
		else { Scrivi ('  ' + $chi + ': NON disabilitata: guardarla in Utilita'' di pianificazione.') 'Red' }
	}
}

# comandi nssm, uguali per prova e installa
function ComandiNssm([string]$node) {
	$c = @()
	foreach ($s in @(
		@{ Nome = $S_B; Par = '--max-old-space-size=1024 server.js'; Dir = $Backend; Log = $LogB;
		   Vis = 'EasyBox backend (serverDati)'; Desc = 'Backend della cella EasyBox (node server.js). Installato da easybox\tools\servizi-cella.ps1.' },
		@{ Nome = $S_P; Par = $PAR_DEV; Dir = $Pannello; Log = $LogP;
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

# ---------------------------------------------------------------- modo, servito
# (7/10 sera) senza amministratore e senza toccare niente: le usa pannello.ps1
if ($Azione -eq 'modo') { Write-Output (ModoPannello); exit 0 }
if ($Azione -eq 'servito') {
	if ((ModoPannello) -ne 'preview') { Scrivi ('Pannello servito: non gira compilato (' + (ModoPannello) + '), serve i file del ramo com''e''.') 'Cyan'; exit 0 }
	if (PannelloServito) { exit 0 } else { exit 3 }
}

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
	# (7/10) pannello compilato o server di sviluppo, e le due dist
	$modo = ModoPannello
	if ($modo) {
		$testoModo = $(if ($modo -eq 'preview') { 'COMPILATO (vite preview, cartella dist)' } elseif ($modo -eq 'dev') { 'server di sviluppo (vite)' } else { 'parametri non riconosciuti: ' + (Get-ItemProperty -Path $ChiavePannello).AppParameters })
		Scrivi ('Pannello: ' + $testoModo + '. dist: ' + (DescriviDist $Dist) + '; dist_prev: ' + (DescriviDist $DistPrev)) 'Cyan'
		if ($modo -eq 'preview' -and -not (Test-Path -LiteralPath (Join-Path $Dist 'index.html'))) { Scrivi '  ATTENZIONE: compilato ma senza dist\index.html, il pannello non parte (nel log: The directory "dist" does not exist). Rimedio: -Azione aggiorna, oppure -Azione dev.' 'Red' }
		# (7/10 sera, B59) da che commit viene la dist servita
		if ($modo -eq 'preview') { $null = PannelloServito }
	}
	# (7/10) chi tiene le porte, e se e' il processo del servizio
	if (-not (MostraProprietari)) {
		Scrivi 'Se una porta e'' tenuta da un processo che non e'' del servizio, e'' un node avviato fuori dai servizi (le vecchie finestre dei .bat?): il servizio non riesce a prenderla. Con la cella in HOLD: -Azione riavvia (chiude solo i node rimasti sulle porte).' 'Yellow'
	}
	# (7/10) le operazioni pianificate solo se attive
	$null = MostraAvvii $true
	Coda $LogB; Coda $LogP; Coda $AccessLog 5
	exit 0
}

# ---------------------------------------------------------------- controlli comuni
if (-not (Amministratore)) { Fermati 'serve PowerShell come amministratore.' 'chiudere questa finestra, aprire PowerShell con "Esegui come amministratore" e rilanciare.' }

# ---------------------------------------------------------------- pannello compilato: funzioni (7/10)
# Qui, dopo il controllo da amministratore, perche' fermano e avviano il servizio.

# Build del pannello in dist_build: la dist servita non si tocca. E' la build
# di "npm run build" (vite build), lanciata con node e vite.js come il
# servizio. L'uscita completa va in log\build_pannello.log. Legge il .env
# della cella: VITE_DARK_MODE finisce nel pacchetto. Ritorna $true se in
# dist_build c'e' index.html.
function CompilaPannello {
	$node = (Get-Command node.exe -ErrorAction SilentlyContinue | Select-Object -First 1).Source
	if (-not $node) { Scrivi 'node.exe non trovato.' 'Red'; return $false }
	if (-not (Test-Path -LiteralPath $ViteJs)) { Scrivi ('manca ' + $ViteJs + ': dipendenze del pannello non installate (pannello.ps1, o npm install in easybox\HMI).') 'Red'; return $false }
	New-Item -ItemType Directory -Path (Split-Path $LogBuild) -Force | Out-Null
	Scrivi ('Build del pannello in ' + $DistBuild + ' (la dist servita adesso non si tocca)...') 'Cyan'
	$inizio = Get-Date
	Push-Location -LiteralPath $Pannello
	try { & $node $ViteJs build --outDir dist_build --emptyOutDir *> $LogBuild; $codice = $LASTEXITCODE }
	finally { Pop-Location }
	$secondi = [int]((Get-Date) - $inizio).TotalSeconds
	if ($codice -ne 0 -or -not (Test-Path -LiteralPath (Join-Path $DistBuild 'index.html'))) {
		Scrivi ('BUILD NON RIUSCITA (codice ' + $codice + ', ' + $secondi + ' s). Ultime righe di ' + $LogBuild + ':') 'Red'
		Get-Content -LiteralPath $LogBuild -Tail 30 -ErrorAction SilentlyContinue | ForEach-Object { Scrivi ('  ' + $_) 'Red' }
		return $false
	}
	Scrivi ('Build riuscita in ' + $secondi + ' s.') 'Green'
	return $true
}

# Riavvia SOLO EasyBoxPannello con le cautele di riavvia: fermo, porta 5173
# libera (chiude solo un node rimasto che non e' di un servizio), poi
# $daFermo se c'e' (lo scambio delle dist, a pannello fermo), avvio e
# verifica: Running e porta 5173 del servizio; se no, eventi nssm e log.
# Ritorna $true se tutto e' a posto. Se $daFermo fallisce il pannello si
# riavvia lo stesso (sulla dist che c'e'), e il risultato e' $false.
function RiavviaPannello([scriptblock]$daFermo = $null) {
	$esito = $true
	Stop-Service -Name $S_P -Force -ErrorAction SilentlyContinue
	try { (Servizio $S_P).WaitForStatus('Stopped', [TimeSpan]::FromSeconds(30)) }
	catch { Scrivi ($S_P + ' non si ferma (stato ' + (Servizio $S_P).Status + ').') 'Red'; return $false }
	if (-not (AspettaPorteLibere 20 @(5173))) {
		$rimasti = @(ProcessiSullePorte | Where-Object { $_.Porta -eq 5173 })
		if (@($rimasti | Where-Object { $_.Nome -ne 'node' -or $_.Servizio }).Count -gt 0) {
			$null = MostraProprietari
			Scrivi 'Sulla 5173 c''e'' un processo che non e'' un node delle vecchie finestre: non lo chiudo, e il pannello resta FERMO.' 'Red'
			return $false
		}
		Scrivi 'Pannello fermo, ma la 5173 e'' ancora tenuta da un node avviato fuori dai servizi:' 'Yellow'
		ChiudiNodeSullePorte $rimasti
		if (-not (AspettaPorteLibere 20 @(5173))) { $null = MostraProprietari; Scrivi 'La 5173 e'' ancora occupata: il pannello resta FERMO.' 'Red'; return $false }
	}
	if ($daFermo -and -not (& $daFermo)) { $esito = $false }
	Start-Service -Name $S_P
	$su = AspettaPorte 90 @(5173)
	$s = Servizio $S_P
	$suo = @(ProcessiSullePorte | Where-Object { $_.Porta -eq 5173 -and $_.Servizio -eq $S_P }).Count -gt 0
	if ($su -and $s.Status -eq 'Running' -and $suo) { Scrivi ($S_P + ': Running, porta 5173 del servizio.') 'Green' }
	else {
		$esito = $false
		Scrivi ($S_P + ': ' + $s.Status + ', porta 5173 ' + $(if ($suo) { 'del servizio' } elseif ($su) { 'di un ALTRO processo' } else { 'non in ascolto' }) + '. Ultimi eventi nssm:') 'Red'
		MostraEventi $S_P
		Coda $LogP
	}
	return $esito
}

# Scambi delle dist, da fare a pannello fermo (dentro RiavviaPannello).
# $ruota: la build nuova va in servizio. dist -> dist_prev (la dist_prev di
# prima si butta), dist_build -> dist.
$ruota = {
	try {
		if (Test-Path -LiteralPath $DistPrev) { Remove-Item -LiteralPath $DistPrev -Recurse -Force -ErrorAction Stop }
		if (Test-Path -LiteralPath $Dist) { Rename-Item -LiteralPath $Dist -NewName 'dist_prev' -ErrorAction Stop }
		Rename-Item -LiteralPath $DistBuild -NewName 'dist' -ErrorAction Stop
		Scrivi ('dist nuova in servizio; quella di prima in ' + $DistPrev) 'Green'
		return $true
	} catch {
		Scrivi ('Scambio delle cartelle non riuscito: ' + $_.Exception.Message) 'Red'
		if (-not (Test-Path -LiteralPath $Dist) -and (Test-Path -LiteralPath $DistPrev)) { Rename-Item -LiteralPath $DistPrev -NewName 'dist' -ErrorAction SilentlyContinue }
		return $false
	}
}
# $scambia: dist e dist_prev si scambiano (ripristina; lanciato di nuovo torna
# indietro). Passa per dist_build, che e' solo una build lasciata li'.
$scambia = {
	try {
		if (Test-Path -LiteralPath $DistBuild) { Remove-Item -LiteralPath $DistBuild -Recurse -Force -ErrorAction Stop }
		Rename-Item -LiteralPath $Dist -NewName 'dist_build' -ErrorAction Stop
		Rename-Item -LiteralPath $DistPrev -NewName 'dist' -ErrorAction Stop
		Rename-Item -LiteralPath $DistBuild -NewName 'dist_prev' -ErrorAction Stop
		Scrivi ('dist e dist_prev scambiate: in servizio la build di prima.') 'Green'
		return $true
	} catch {
		Scrivi ('Scambio delle cartelle non riuscito: ' + $_.Exception.Message) 'Red'
		if (-not (Test-Path -LiteralPath $Dist) -and (Test-Path -LiteralPath $DistBuild)) { Rename-Item -LiteralPath $DistBuild -NewName 'dist' -ErrorAction SilentlyContinue }
		return $false
	}
}

# Riavvia i DUE servizi (riavvia, e aggiorna dopo la build) con le cautele di
# sempre:
#   1. fermi, anche da Paused;
#   2. a servizi fermi le porte devono liberarsi. Se restano prese sono node
#      avviati fuori dai servizi (le vecchie finestre): si chiudono quelli, e
#      solo quelli. Un processo che non e' node non si tocca: Fermati, coi
#      servizi FERMI;
#   3. $daFermo se c'e' (aggiorna: lo scambio delle dist, a servizi fermi);
#   4. avvio PRIMA del backend (porte 8080 e 3000), POI del pannello (5173);
#   5. verifica: Running, e le porte sono dei servizi giusti; se no, eventi
#      nssm e log.
# Ritorna $true se tutto e' a posto. Se $daFermo fallisce i servizi ripartono
# lo stesso (sulla dist che c'e'), e il risultato e' $false.
function RiavviaServizi([scriptblock]$daFermo = $null) {
	Stop-Service -Name $S_B, $S_P -Force -ErrorAction SilentlyContinue
	foreach ($n in @($S_B, $S_P)) {
		try { (Servizio $n).WaitForStatus('Stopped', [TimeSpan]::FromSeconds(30)) }
		catch { Fermati ($n + ' non si ferma (stato ' + (Servizio $n).Status + ').') 'guardare services.msc e chiamare Dario.' }
	}
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
	$esito = $true
	if ($daFermo -and -not (& $daFermo)) { $esito = $false }
	Start-Service -Name $S_B
	$suB = AspettaPorte 90 @(8080, 3000)
	Start-Service -Name $S_P
	$suP = AspettaPorte 90 @(5173)
	if (-not ($suB -and $suP)) { $esito = $false }
	Scrivi ''
	foreach ($n in @($S_B, $S_P)) {
		$s = Servizio $n
		if ($s.Status -eq 'Running') { Scrivi ($n + ': Running') 'Green' }
		else { $esito = $false; Scrivi ($n + ': ' + $s.Status + '. Ultimi eventi nssm:') 'Red'; MostraEventi $n }
	}
	if (-not (MostraProprietari)) { $esito = $false }
	Coda $AccessLog 5
	if (-not $esito) { Coda $LogB; Coda $LogP }
	return $esito
}

# ---------------------------------------------------------------- riavvia
if ($Azione -eq 'riavvia') {
	$mancano = @($S_B, $S_P) | Where-Object { -not (Servizio $_) }
	if ($mancano.Count -gt 0) { Fermati ('servizi non installati: ' + ($mancano -join ', ')) 'installarli con -Azione installa, oppure usare le finestre dei .bat.' }
	Scrivi 'Riavvio EasyBoxBackend ed EasyBoxPannello (la cella deve essere in HOLD)...' 'Cyan'
	$ok = RiavviaServizi
	if (-not $ok) {
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

# ---------------------------------------------------------------- pannello compilato: azioni (7/10)
if (@('preview', 'aggiorna', 'ripristina', 'dev') -contains $Azione) {
	if (-not (Servizio $S_P)) { Fermati ($S_P + ' non installato.') 'installarlo con -Azione installa.' }
	if (-not (Test-Path -LiteralPath $Nssm)) { Fermati ('nssm non trovato in ' + $Nssm) 'chiamare Dario.' }
	Scrivi ('Pannello adesso: ' + (ModoPannello) + '. dist: ' + (DescriviDist $Dist) + '; dist_prev: ' + (DescriviDist $DistPrev)) 'Cyan'
	$null = MostraAvvii $true
}

# preview: dal server di sviluppo al compilato, una volta
if ($Azione -eq 'preview') {
	if ((ModoPannello) -eq 'preview') { Scrivi 'Il pannello gira gia'' compilato: per una build nuova -Azione aggiorna.' 'Green'; exit 0 }
	Scrivi 'Passaggio al pannello COMPILATO (la cella deve essere in HOLD)...' 'Cyan'
	if (-not (CompilaPannello)) { Fermati 'build non riuscita: il pannello resta col server di sviluppo, niente e'' cambiato.' 'leggere l''errore qui sopra (log completo in log\build_pannello.log) e mandarlo a Dario.' }
	& $Nssm set $S_P AppParameters $PAR_PREVIEW
	if ($LASTEXITCODE -ne 0 -or (ModoPannello) -ne 'preview') { Fermati 'nssm set AppParameters non riuscito: il pannello resta col server di sviluppo.' 'chiamare Dario con questa finestra.' }
	if (-not (RiavviaPannello $ruota)) { Fermati 'il pannello compilato non e'' ripartito come atteso.' 'per tornare al server di sviluppo: -Azione dev. Mandare a Dario questa finestra.' }
	Scrivi 'Pannello COMPILATO in servizio. Sui client: Ctrl+F5. Dopo ogni git pull: -Azione aggiorna. Per tornare indietro: -Azione dev.' 'Green'
	exit 0
}

# aggiorna: dopo ogni git pull, col pannello compilato. Un comando solo:
# build del pannello, poi (7/10) riavvio di backend e pannello, il backend
# prima, con lo scambio delle dist a servizi fermi (RiavviaServizi $ruota)
if ($Azione -eq 'aggiorna') {
	if (-not (Servizio $S_B)) { Fermati ($S_B + ' non installato.') 'installarlo con -Azione installa.' }
	$modo = ModoPannello
	if ($modo -ne 'preview') { Fermati ('il pannello non gira compilato (' + $modo + '): aggiorna serve solo al pannello compilato.') 'col server di sviluppo, dopo un git pull basta -Azione riavvia; per passare al compilato, -Azione preview.' }
	Scrivi 'Aggiornamento dopo un git pull: build del pannello, poi riavvio di backend e pannello (la cella deve essere in HOLD)...' 'Cyan'
	if (-not (CompilaPannello)) { Fermati 'build non riuscita: dist e servizi restano come sono, gira la versione di prima (backend compreso: non e'' stato riavviato).' 'leggere l''errore qui sopra (log completo in log\build_pannello.log); se mancano dipendenze, pannello.ps1. Poi mandarlo a Dario.' }
	$ok = RiavviaServizi $ruota
	Scrivi ('dist: ' + (DescriviDist $Dist) + '; dist_prev: ' + (DescriviDist $DistPrev)) 'Cyan'
	if (-not $ok) { Fermati 'dopo l''aggiornamento i servizi non sono tutti a posto (Running, porte loro) o lo scambio delle dist non e'' riuscito.' 'leggere eventi e log qui sopra; per tornare alla build di prima del pannello: -Azione ripristina. Mandare a Dario questa finestra.' }
	Scrivi 'Aggiornato: pannello ricompilato, backend e pannello riavviati. Sui client: Ctrl+F5.' 'Green'
	$null = PannelloServito
	exit 0
}

# ripristina: torna alla build di prima (scambia dist e dist_prev)
if ($Azione -eq 'ripristina') {
	if (-not (Test-Path -LiteralPath (Join-Path $DistPrev 'index.html'))) { Fermati 'non c''e'' una dist_prev con index.html: niente da ripristinare.' 'chiamare Dario.' }
	if (-not (Test-Path -LiteralPath (Join-Path $Dist 'index.html'))) { Fermati 'la dist in servizio non ha index.html: lo scambio non e'' sicuro.' 'chiamare Dario.' }
	if ((ModoPannello) -ne 'preview') { Scrivi 'ATTENZIONE: il pannello non gira compilato, lo scambio delle dist non cambia quello che si vede.' 'Yellow' }
	Scrivi 'Ripristino della build di prima (la cella deve essere in HOLD)...' 'Cyan'
	$ok = RiavviaPannello $scambia
	Scrivi ('dist: ' + (DescriviDist $Dist) + '; dist_prev: ' + (DescriviDist $DistPrev)) 'Cyan'
	if (-not $ok) { Fermati 'ripristino non riuscito come atteso.' 'mandare a Dario questa finestra.' }
	Scrivi 'Build di prima in servizio. Sui client: Ctrl+F5. Per tornare a quella nuova: di nuovo -Azione ripristina.' 'Green'
	exit 0
}

# dev: ritorno al server di sviluppo
if ($Azione -eq 'dev') {
	if ((ModoPannello) -eq 'dev') { Scrivi 'Il pannello gira gia'' col server di sviluppo.' 'Green'; exit 0 }
	if (-not (Test-Path -LiteralPath $ViteJs)) { Fermati ('manca ' + $ViteJs) 'le dipendenze del pannello non sono installate: pannello.ps1.' }
	Scrivi 'Ritorno al server di sviluppo (la cella deve essere in HOLD)...' 'Cyan'
	& $Nssm set $S_P AppParameters $PAR_DEV
	if ($LASTEXITCODE -ne 0 -or (ModoPannello) -ne 'dev') { Fermati 'nssm set AppParameters non riuscito.' 'chiamare Dario con questa finestra.' }
	if (-not (RiavviaPannello)) { Fermati 'il pannello non e'' ripartito come atteso.' 'mandare a Dario questa finestra.' }
	Scrivi 'Pannello col server di sviluppo. La dist resta su disco e non si usa; il primo caricamento sui client e'' di nuovo lento.' 'Green'
	exit 0
}

# ---------------------------------------------------------------- prova / installa: controlli
$prova = ($Azione -eq 'prova')
$node = (Get-Command node.exe -ErrorAction SilentlyContinue | Select-Object -First 1).Source
if (-not $node) { Fermati 'node.exe non trovato.' 'controllare l''installazione di Node.js, poi rilanciare.' }
if (-not (Test-Path -LiteralPath $ServerJs)) { Fermati ('manca ' + $ServerJs) 'lo script va lanciato dalla sua posizione nel repo di cella (D:\Prog\easybox\tools).' }
if (-not (Test-Path -LiteralPath $ViteJs)) { Fermati ('manca ' + $ViteJs) 'le dipendenze del pannello non sono installate: rilanciare pannello.ps1 con la versione attiva.' }
if (-not (Test-Path -LiteralPath $Nssm) -and -not (Test-Path -LiteralPath $NssmOrig)) { Fermati ('nssm.exe non trovato ne'' in ' + $Nssm + ' ne'' in ' + $NssmOrig) 'chiamare Dario.' }

# (7/10) le vecchie finestre non devono ripartire da sole all'accesso a
# Windows. Prima di ogni altro controllo, cosi' si vede anche coi servizi
# gia' installati: Esecuzione automatica e chiavi Run si segnalano; per le
# operazioni pianificate attive installa propone di disabilitarle, prova dice
# soltanto che lo proporrebbe.
$attive = MostraAvvii
if ($attive.Count -gt 0) {
	if ($prova) { Scrivi ('PROVA: installa proporrebbe di disabilitare le operazioni pianificate attive qui sopra (' + $attive.Count + '), dopo averne salvato la definizione.') 'Cyan' }
	else { ProponiDisabilita $attive }
}

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
Scrivi 'Il pannello e'' installato col server di sviluppo. Per il pannello compilato (decisione del 7/10): -Azione preview.' 'Green'
exit 0
