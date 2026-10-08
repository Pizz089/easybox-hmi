# ============================================================================
# easybox/tools/pannello.ps1 - cambia la versione del pannello in cella
#
#   stabile  ramo ui-lifting: solo modifiche funzionali (quello di sempre)
#   v3       ramo ui-v3: ui-lifting + la grafica nuova (pannello v3)
#   stato    dice su che versione si e', senza cambiare niente
#   ritorno  (8/10) riporta la copia di lavoro a un commit della storia del
#            ramo attuale, scritto PER ESTESO (40 caratteri) col parametro
#            -Commit: il ritorno dopo una finestra andata male (procedure in
#            docs/APPUNTI-CELLA.md), senza comandi git a mano
#
# Uso (da qualunque cartella):
#   powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\pannello.ps1 -Versione v3
#   powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\pannello.ps1 -Versione stabile
#   powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\pannello.ps1 -Versione stato
#   powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\pannello.ps1 -Versione ritorno -Commit <40 caratteri>
#
# RITORNO (8/10). Il ramo NON si sposta (niente reset): la copia di lavoro si
# stacca sul commit indicato (git switch --detach), che deve stare nella
# storia del ramo attuale; il git pull di dopo resta un avanzamento semplice.
# Per tornare al ramo: -Versione v3 o -Versione stabile, come sempre. Il
# commit si cerca prima in locale: senza rete il ritorno funziona lo stesso
# (git fetch solo se manca). (8/10, prompt 8) Il commit deve stare sulla
# linea PRINCIPALE del ramo (git rev-list --first-parent HEAD): un commit di
# ui-lifting entrato in ui-v3 con un merge e' nella storia di ui-v3, ma
# tornarci metterebbe la cella v3 sul codice stabile. E dopo il distacco sul
# commit, se lo script si ferma (npm install o aggiorna non riusciti) riavvia
# comunque EasyBoxBackend e lo dice: il database e' gia' stato riportato
# indietro e il backend acceso girerebbe ancora il codice di prima.
# DOPO il ritorno, tools\ e' quello del commit di arrivo: un pannello.ps1
# vecchio non conosce -Versione ritorno e con -Versione stato dice
# "nessuna delle due (ramo non previsto)", perche' la copia di lavoro non e'
# su un ramo. Per tornare al ramo vale -Versione v3 o -Versione stabile. Poi le stesse cautele e gli stessi passi del
# cambio di versione qui sotto: HOLD, amministratore coi servizi, si ferma
# con modifiche locali o con file non tracciati d'intralcio, pannello
# fermato prima e rimesso su se qualcosa va storto, npm install se serve,
# aggiorna col pannello compilato (build e riavvio di backend e pannello).
#
# Perche' sotto easybox/ e non in tools/ alla radice: il clone di cella e'
# parziale (sparse-checkout in modalita' cone: D:\Prog\.git\info\sparse-checkout
# contiene /*, !/*/ e /easybox/). Sul disco della cella vengono scritti solo i
# file della radice e la cartella easybox/: tools/ e plc/ non ci sono. Il 6/10
# il pull ha messo tools/pannello.ps1 nell'elenco, ma il file non e' mai
# comparso. Tutto quello che deve arrivare in cella sta sotto easybox/.
# La radice del repo lo script la trova da solo, con git rev-parse
# --show-toplevel dalla sua cartella: da qui funziona come prima.
#
# Cosa fa con v3 / stabile (prima ricorda che la cella deve essere in HOLD):
#   1. se ci sono modifiche locali ai file TRACCIATI le elenca e si ferma,
#      senza toccare niente. I file non tracciati non contano: in cella ce ne
#      sono sempre (i due .bat di avvio, la cartella di backup di serverDati)
#      e fermerebbero lo script ogni volta;
#   2. git fetch origin, poi controlla che il ramo di arrivo non porti file
#      dove sul disco ce n'e' gia' uno non tracciato (con un contenuto
#      diverso): nel clone parziale di cella git switch e git pull lo
#      sovrascriverebbero senza fermarsi. Se ce ne sono li elenca e si ferma;
#   3. git switch sul ramo;
#   4. git pull --ff-only (se non e' un avanzamento semplice si ferma);
#   5. npm install in easybox\HMI se package-lock.json e' cambiato (o se
#      node_modules manca, o se l'ultima installazione e' fallita);
#   6. dice cosa e' attivo e cosa riavviare. Senza servizi, backend e
#      pannello girano nelle finestre di start_server.bat e start_hmi.bat e
#      nessuno dei due si riavvia da solo. Il backend va riavviato sempre; il
#      pannello solo se c'e' stato npm install o sono cambiati package.json,
#      package-lock.json o vite.config.js, altrimenti basta Ctrl+F5 sui client.
#
# CON I SERVIZI (easybox/tools/servizi-cella.ps1: EasyBoxBackend ed
# EasyBoxPannello, decisione di Dario del 6/10):
#   - serve PowerShell come amministratore: senza, si ferma PRIMA di toccare
#     qualunque cosa e dice il comando da rilanciare;
#   - prima di git switch / git pull ferma EasyBoxPannello: Vite acceso
#     terrebbe bloccati i file di npm install. Da li' in poi, se qualcosa
#     fallisce, EasyBoxPannello si rimette su comunque, sulla versione che
#     c'e', prima di uscire;
#   - alla fine riavvia EasyBoxBackend, avvia EasyBoxPannello e aspetta le
#     porte 8080, 3000 e 5173 (al massimo 90 secondi). Niente finestre.
#   - (7/10 sera) COL PANNELLO COMPILATO (EasyBoxPannello in modo preview)
#     riavviare non basta: servirebbe la dist di prima. Dopo pull e npm
#     install si lancia servizi-cella.ps1 -Azione aggiorna, cioe' la stessa
#     build di sempre con lo stesso codice (build in dist_build, scambio delle
#     dist, riavvio di backend e pannello): niente copia qui. Se aggiorna non
#     riesce il pannello (e il backend, se e' fermo) si rimette su sulla
#     versione che c'e' e lo script si ferma: quale pannello e' servito lo
#     dicono i messaggi di aggiorna (8/10: aggiorna puo' fermarsi anche dopo
#     lo scambio delle dist). Il messaggio finale dice cosa e' servito
#     (dist\build.txt: ramo e commit della build).
#   - (prompt 10) un servizio fermo si rimette su solo se le sue porte sono
#     libere (backend 8080 e 3000, pannello 5173): se le tiene un altro
#     processo, ed e' il caso di "I servizi sono FERMI" di aggiorna, non si
#     avvia e lo si dice in rosso. "Di nuovo su" solo quando le porte sono in
#     ascolto e del servizio, non guardando solo lo stato del servizio.
#     (prompt 11) Un servizio che gira gia' non si tocca: si dice "gira, porte
#     sue", oppure in rosso quale porta non e' sua.
# Non usa MAI reset, clean, stash, checkout -- o --force: nel peggiore dei
# casi si ferma e spiega, e il repo resta com'era.
# Testi senza lettere accentate: PowerShell 5.1 legge i file senza BOM come
# ANSI e le storpierebbe.
# ============================================================================
param(
	[Parameter(Mandatory = $true)]
	[ValidateSet('v3', 'stabile', 'stato', 'ritorno')]
	[string]$Versione,
	# solo con -Versione ritorno: il commit di arrivo, per esteso
	[string]$Commit = ''
)

$ErrorActionPreference = 'Continue'
$RAMI = @{ 'v3' = 'ui-v3'; 'stabile' = 'ui-lifting' }
$NOMI = @{ 'ui-v3' = 'v3 (grafica nuova)'; 'ui-lifting' = 'stabile' }
$LOCK = 'easybox/HMI/package-lock.json'
# file del pannello per cui non basta Ctrl+F5: se cambiano, start_hmi.bat
# va rilanciato
$HMI_AVVIO = @('easybox/HMI/package.json', $LOCK, 'easybox/HMI/vite.config.js')
# segno dell'ultima npm install riuscita: se un'installazione fallisce (es.
# pannello acceso che tiene bloccati dei file) lo script la rifa' al giro dopo
$SEGNO = 'easybox\HMI\node_modules\.pannello-lock'

function Scrivi([string]$testo, [string]$colore = 'Gray') { Write-Host $testo -ForegroundColor $colore }
function Fermati([string]$perche, [string]$cosaFare, [string]$nota = 'Il repo non e'' stato toccato da questo passo.') {
	Scrivi ''
	Scrivi ('FERMO: ' + $perche) 'Red'
	if ($cosaFare) { Scrivi ('Cosa fare: ' + $cosaFare) 'Yellow' }
	if ($nota) { Scrivi $nota 'Yellow' }
	# (servizi) il pannello fermato per il cambio di versione si rimette su
	# comunque, sulla versione che c'e': mai uscire lasciandolo spento
	# (8/10) ritorno gia' staccato sul commit: il backend si riavvia comunque
	if ($script:Staccato) { RiavviaBackendRitorno }
	if ($script:PannelloFermato) { RimettiSuPannello }
	exit 1
}
# git con uscita e codice, senza far diventare errore l'stderr (git ci
# scrive anche i messaggi normali, es. l'avanzamento del fetch)
function G([string[]]$argomenti) {
	$uscita = & git -C $script:Radice @argomenti 2>&1 | ForEach-Object { "$_" }
	return [pscustomobject]@{ Codice = $LASTEXITCODE; Uscita = @($uscita) }
}

# ---------------------------------------------------------------- servizi
# Backend e pannello come servizi Windows (servizi-cella.ps1). Get-Service,
# Stop-Service, Start-Service, Restart-Service e Get-NetTCPConnection sono i
# cmdlet di sempre (la prova li sostituisce con funzioni finte dello stesso
# nome, che PowerShell preferisce ai cmdlet).
$S_B = 'EasyBoxBackend'
$S_P = 'EasyBoxPannello'
$PORTE = @(8080, 3000, 5173)
$script:PannelloFermato = $false
# (8/10) la copia di lavoro e' gia' staccata sul commit del ritorno
$script:Staccato = $false
function Servizio([string]$nome) { return Get-Service -Name $nome -ErrorAction SilentlyContinue }
function StatoServizio([string]$nome) { $s = Servizio $nome; if ($s) { return [string]$s.Status } else { return 'non installato' } }
# amministratore: se esiste gia' una funzione con questo nome (la prova ne
# definisce una finta) si usa quella, altrimenti la verifica vera
if (-not (Get-Command Test-EasyBoxAmministratore -CommandType Function -ErrorAction SilentlyContinue)) {
	function Test-EasyBoxAmministratore {
		$p = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
		return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
	}
}
function PorteInAscolto {
	return @(Get-NetTCPConnection -State Listen -LocalPort $PORTE -ErrorAction SilentlyContinue | ForEach-Object { [int]$_.LocalPort } | Sort-Object -Unique)
}
function AspettaPorte([int]$secondi = 90) {
	$fine = (Get-Date).AddSeconds($secondi)
	do {
		$su = PorteInAscolto
		if (@($PORTE | Where-Object { $su -notcontains $_ }).Count -eq 0) { return $true }
		Start-Sleep -Seconds 3
	} while ((Get-Date) -lt $fine)
	return $false
}
# (prompt 10) chi tiene una porta in ascolto: '' nessuno; EasyBoxBackend o
# EasyBoxPannello se e' il processo del servizio o un suo discendente (nssm ->
# node); 'altro' se e' un altro processo. Stessa regola di ServizioDelProcesso
# in servizi-cella.ps1. La prova la sostituisce con una funzione finta.
if (-not (Get-Command Get-EasyBoxProprietarioPorta -CommandType Function -ErrorAction SilentlyContinue)) {
	function Get-EasyBoxProprietarioPorta([int]$porta) {
		$ascolto = @(Get-NetTCPConnection -State Listen -LocalPort $porta -ErrorAction SilentlyContinue)
		if ($ascolto.Count -eq 0) { return '' }
		$diServizio = @{}
		foreach ($nomeServizio in @($S_B, $S_P)) {
			$ws = Get-CimInstance Win32_Service -Filter ("Name='" + $nomeServizio + "'") -ErrorAction SilentlyContinue
			if ($ws -and $ws.ProcessId -gt 0) { $diServizio[[int]$ws.ProcessId] = $nomeServizio }
		}
		foreach ($conn in $ascolto) {
			$pid1 = [int]$conn.OwningProcess
			for ($passo = 0; $passo -lt 6 -and $pid1 -gt 0; $passo++) {
				if ($diServizio.ContainsKey($pid1)) { return $diServizio[$pid1] }
				$proc = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $pid1) -ErrorAction SilentlyContinue
				if (-not $proc) { break }
				$pid1 = [int]$proc.ParentProcessId
			}
		}
		return 'altro'
	}
}
# le porte di ciascun servizio: il backend 8080 (HTTP) e 3000 (socket), il
# pannello 5173
function PorteDi([string]$nome) { if ($nome -eq $S_B) { return @(8080, 3000) } else { return @(5173) } }
# aspetta che le porte del servizio siano in ascolto e SUE
function AspettaPorteDel([string]$nome, [int]$secondi = 90) {
	$fine = (Get-Date).AddSeconds($secondi)
	do {
		if (@(PorteDi $nome | Where-Object { (Get-EasyBoxProprietarioPorta $_) -ne $nome }).Count -eq 0) { return $true }
		Start-Sleep -Seconds 3
	} while ((Get-Date) -lt $fine)
	return $false
}
# (prompt 10) rimette su un servizio fermo. Prima dell'avvio: se le sue porte
# sono gia' in ascolto col servizio fermo, le tiene un altro processo (e'
# proprio il caso in cui servizi-cella.ps1 -Azione aggiorna si ferma con "I
# servizi sono FERMI"): non si avvia niente. Dopo l'avvio: "di nuovo su"
# solo con le porte in ascolto e del servizio, non guardando solo lo stato del
# servizio Windows (Running anche se node esce subito sulla porta occupata).
# (prompt 11) il servizio puo' gia' girare: aggiorna si ferma anche DOPO aver
# riavviato i servizi (per esempio uno scambio di dist non riuscito). Allora
# non si avvia niente, si guardano le sue porte (attesa breve) e si dice com'e':
# "gira, porte sue", oppure in rosso quale porta non e' sua. Prima ogni porta
# con un proprietario contava come occupata, anche quella del servizio stesso:
# messaggio rosso falso col pannello che girava sulla sua 5173.
function RimettiSu([string]$nome, [string]$cosa) {
	if ((StatoServizio $nome) -eq 'Running') {
		if (AspettaPorteDel $nome 15) {
			Scrivi ($nome + ' gira, porte sue (' + ((PorteDi $nome) -join ', ') + '): ' + $cosa + ' e'' su.') 'Yellow'
		} else {
			$male = @(PorteDi $nome | ForEach-Object {
				$chi = Get-EasyBoxProprietarioPorta $_
				if ($chi -eq '') { 'la porta ' + $_ + ' non e'' in ascolto' }
				elseif ($chi -ne $nome) { 'la porta ' + $_ + ' e'' di un altro processo' }
			})
			Scrivi ($nome + ' gira ma ' + ($male -join ', ') + ': con la cella in HOLD lanciare servizi-cella.ps1 -Azione riavvia, oppure chiamare Dario.') 'Red'
		}
		return
	}
	# servizio fermo: occupate sono solo le porte di un ALTRO processo
	$occupate = @(PorteDi $nome | Where-Object { $chi = Get-EasyBoxProprietarioPorta $_; $chi -ne '' -and $chi -ne $nome })
	if ($occupate.Count -gt 0) {
		Scrivi ($nome + ' e'' fermo e le sue porte (' + ($occupate -join ', ') + ') sono in ascolto: porte occupate da un altro processo: chiamare Dario. Non lo avvio (chi le tiene: servizi-cella.ps1 -Azione stato).') 'Red'
		return
	}
	Scrivi ('Rimetto su ' + $nome + ' sulla versione che c''e''...') 'Yellow'
	Start-Service -Name $nome -ErrorAction SilentlyContinue
	if ((StatoServizio $nome) -eq 'Running' -and (AspettaPorteDel $nome 90)) {
		Scrivi ($nome + ' avviato: ' + $cosa + ' e'' di nuovo su (porte ' + ((PorteDi $nome) -join ', ') + ' in ascolto, del servizio).') 'Yellow'
	} else {
		$chi = @(PorteDi $nome | ForEach-Object { [string]$_ + ' ' + $(if ((Get-EasyBoxProprietarioPorta $_) -eq '') { 'libera' } else { Get-EasyBoxProprietarioPorta $_ }) })
		Scrivi ($nome + ' NON di nuovo su (servizio ' + (StatoServizio $nome) + '; porte: ' + ($chi -join ', ') + '): con la cella in HOLD lanciare servizi-cella.ps1 -Azione riavvia, oppure chiamare Dario.') 'Red'
	}
}
function RimettiSuPannello {
	$script:PannelloFermato = $false
	Scrivi ''
	# (8/10) aggiorna (servizi-cella.ps1) puo' fermarsi coi DUE servizi fermi:
	# il backend, se e' fermo, si rimette su prima del pannello, e lo si dice.
	# (prompt 11) Se gira, RimettiSu ne guarda le porte e non lo tocca.
	if (Servizio $S_B) {
		if ((StatoServizio $S_B) -ne 'Running') { Scrivi ($S_B + ' e'' fermo (' + (StatoServizio $S_B) + ').') 'Yellow' }
		RimettiSu $S_B 'il backend'
	}
	RimettiSu $S_P 'il pannello'
}

# (8/10, prompt 8) ritorno fermo DOPO il distacco sul commit (npm install o
# aggiorna non riusciti): il database e' gia' stato riportato indietro, e il
# backend acceso girerebbe il codice di prima del ritorno contro colonne e
# tabelle che non ci sono piu'. Si riavvia comunque, e lo si dice.
function RiavviaBackendRitorno {
	$script:Staccato = $false
	Scrivi ''
	if (Servizio $S_B) {
		Scrivi ('Ritorno: riavvio comunque ' + $S_B + ', perche'' giri il backend del commit ' + $script:Commit + '...') 'Yellow'
		Restart-Service -Name $S_B -Force -ErrorAction SilentlyContinue
		if ((StatoServizio $S_B) -eq 'Running') { Scrivi ($S_B + ' riavviato: il backend e'' quello del commit del ritorno.') 'Yellow' }
		else { Scrivi ($S_B + ' NON riavviato (' + (StatoServizio $S_B) + '): con la cella in HOLD lanciare servizi-cella.ps1 -Azione riavvia, oppure chiamare Dario.') 'Red' }
	} else {
		Scrivi 'Ritorno: riavviare comunque il backend (Ctrl+C nella finestra di start_server.bat, poi rilanciarlo), perche'' giri il codice del commit del ritorno.' 'Yellow'
	}
}

# (7/10 sera) pannello compilato: il modo del servizio, il pannello servito e
# la build stanno in servizi-cella.ps1 (-Azione modo, servito, aggiorna): qui
# si chiamano, non si copiano. La prova li sostituisce con funzioni finte
# dello stesso nome (come Test-EasyBoxAmministratore).
$SERVIZI_CELLA = Join-Path $PSScriptRoot 'servizi-cella.ps1'
if (-not (Get-Command Get-EasyBoxModoPannello -CommandType Function -ErrorAction SilentlyContinue)) {
	function Get-EasyBoxModoPannello { return [string]((& $SERVIZI_CELLA -Azione modo) | Select-Object -Last 1) }
}
if (-not (Get-Command Show-EasyBoxPannelloServito -CommandType Function -ErrorAction SilentlyContinue)) {
	function Show-EasyBoxPannelloServito { & $SERVIZI_CELLA -Azione servito | Out-Host }
}
if (-not (Get-Command Invoke-EasyBoxAggiorna -CommandType Function -ErrorAction SilentlyContinue)) {
	function Invoke-EasyBoxAggiorna { & $SERVIZI_CELLA -Azione aggiorna | Out-Host; return $LASTEXITCODE }
}

# ---------------------------------------------------------------- radice
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
	Fermati 'git non trovato.' 'installare Git per Windows o chiamare Dario.'
}
$cartella = $PSScriptRoot
$r = & git -C $cartella rev-parse --show-toplevel 2>$null
if ($LASTEXITCODE -ne 0 -or -not $r) {
	Fermati ('la cartella dello script (' + $cartella + ') non e'' dentro un repo git.') 'lo script va lanciato dalla sua posizione nel repo, es. D:\Prog\easybox\tools\pannello.ps1.'
}
$script:Radice = ($r | Select-Object -First 1).Trim()

function Stato {
	$ramo = (G @('branch', '--show-current')).Uscita -join ''
	# (8/10) $ultimo e non $commit: per PowerShell $commit e' il parametro $Commit
	$ultimo = (G @('log', '-1', '--format=%h  %s')).Uscita -join ''
	$data = (G @('log', '-1', '--date=format:%d/%m/%Y %H:%M', '--format=%cd')).Uscita -join ''
	$nome = if ($NOMI.ContainsKey($ramo)) { $NOMI[$ramo] } elseif (-not $ramo) { 'RITORNO: copia di lavoro ferma su un commit, fuori dal ramo (per tornare al ramo: -Versione v3 o -Versione stabile)' } else { 'nessuna delle due (ramo non previsto)' }
	Scrivi ('Repo:     ' + $script:Radice)
	Scrivi ('Versione: ' + $nome) 'Cyan'
	Scrivi ('Ramo:     ' + $ramo)
	Scrivi ('Commit:   ' + $ultimo)
	Scrivi ('Data:     ' + $data)
}
# (8/10) dopo un ritorno: dove si e' e come si torna al ramo
function NotaRitorno {
	if ($script:ritorno) { Scrivi ('Ritorno: copia di lavoro sul commit ' + $script:Commit + ', fuori dal ramo ' + $script:ramo + '. Per tornare al ramo: pannello.ps1 -Versione ' + $(if ($script:ramo -eq 'ui-lifting') { 'stabile' } else { 'v3' }) + '.') 'Yellow' }
}
# solo i file tracciati: i non tracciati della cella (i .bat di avvio, il
# backup di serverDati) ci sono sempre e fermerebbero lo script ogni volta.
# Se uno di loro e' d'intralcio al cambio di ramo, lo trova il passo 2b.
function ModificheLocali { return @((G @('status', '--porcelain', '--untracked-files=no')).Uscita | Where-Object { $_ -and $_.Trim() }) }

# ---------------------------------------------------------------- stato
if ($Versione -eq 'stato') {
	Stato
	Scrivi ('Servizi: ' + $S_B + ' ' + (StatoServizio $S_B) + ', ' + $S_P + ' ' + (StatoServizio $S_P))
	# (7/10 sera, B59) col pannello compilato: da che commit viene la dist servita
	if (Servizio $S_P) { Show-EasyBoxPannelloServito }
	$mod = ModificheLocali
	if ($mod.Count -eq 0) { Scrivi 'Modifiche locali (file tracciati): nessuna' 'Green' }
	else {
		Scrivi ('Modifiche locali (file tracciati): ' + $mod.Count) 'Yellow'
		$mod | ForEach-Object { Scrivi ('  ' + $_) 'Yellow' }
	}
	exit 0
}

# ---------------------------------------------------------------- cambio
$ritorno = ($Versione -eq 'ritorno')
if ($ritorno) {
	# (8/10) il commit per esteso, 40 caratteri esadecimali: un hash corto
	# potrebbe essere ambiguo, e in una procedura di ritorno non si indovina
	$Commit = $Commit.Trim().ToLowerInvariant()
	if ($Commit -notmatch '^[0-9a-f]{40}$') {
		Fermati ('-Versione ritorno vuole -Commit col commit per esteso (40 caratteri), non "' + $Commit + '".') 'copiare il commit dalla procedura in docs\APPUNTI-CELLA.md, intero.'
	}
	$ramo = ((G @('branch', '--show-current')).Uscita -join '').Trim()
	if (-not $ramo) {
		Fermati 'la copia di lavoro non e'' su un ramo (un ritorno e'' gia'' stato fatto?).' 'prima tornare al ramo con -Versione v3 o -Versione stabile, poi rilanciare il ritorno; oppure chiamare Dario.'
	}
	Scrivi ('Ritorno al commit ' + $Commit + ' (dalla storia del ramo ' + $ramo + ')') 'Cyan'
} else {
	$ramo = $RAMI[$Versione]
	Scrivi ('Passo alla versione ' + $Versione + ' (ramo ' + $ramo + ')') 'Cyan'
}
Scrivi 'Promemoria: la cella deve essere in HOLD.' 'Yellow'

# 0. servizi installati? Allora serve l'amministratore (fermare e avviare i
#    servizi): si controlla prima di qualunque altra cosa
$conServizi = @(@($S_B, $S_P) | Where-Object { Servizio $_ }).Count -gt 0
if ($conServizi) {
	Scrivi ('Servizi: ' + $S_B + ' ' + (StatoServizio $S_B) + ', ' + $S_P + ' ' + (StatoServizio $S_P))
	if (-not (Test-EasyBoxAmministratore)) {
		Fermati 'con i servizi EasyBoxBackend ed EasyBoxPannello installati serve PowerShell come amministratore.' ('aprire PowerShell con "Esegui come amministratore" e rilanciare: powershell -ExecutionPolicy Bypass -File ' + $PSCommandPath + ' -Versione ' + $Versione + $(if ($ritorno) { ' -Commit ' + $Commit } else { '' }))
	}
}

# 1. modifiche locali: si guarda e basta
$mod = ModificheLocali
if ($mod.Count -gt 0) {
	Scrivi ''
	Scrivi 'Ci sono modifiche locali nel repo:' 'Yellow'
	$mod | ForEach-Object { Scrivi ('  ' + $_) 'Yellow' }
	Fermati 'cambiando versione queste modifiche andrebbero perse o mescolate.' 'non cancellarle a mano: chiama Dario, che decide se tenerle (commit) o scartarle. Poi rilancia lo script.'
}

# 2. fetch (ritorno: solo se il commit non c'e' gia' in locale)
$serveFetch = $true
if ($ritorno -and (G @('cat-file', '-e', ($Commit + '^{commit}'))).Codice -eq 0) { $serveFetch = $false }
if ($serveFetch) {
	Scrivi 'Leggo le versioni su GitHub (git fetch origin)...'
	$f = G @('fetch', 'origin')
	if ($f.Codice -ne 0) {
		$f.Uscita | ForEach-Object { Scrivi ('  ' + $_) }
		Fermati 'git fetch non riuscito.' 'controllare la rete del PC e l''accesso a GitHub, poi rilanciare. Se il problema resta, chiamare Dario.'
	}
}
# 2a. (ritorno) il commit c'e' ed e' nella storia del ramo attuale: si torna
#     indietro, mai su un altro ramo ne' su qualcosa che non si conosce
if ($ritorno) {
	if ((G @('cat-file', '-e', ($Commit + '^{commit}'))).Codice -ne 0) {
		Fermati ('il commit ' + $Commit + ' non c''e'', nemmeno dopo git fetch.') 'controllare di averlo copiato intero dalla procedura; se e'' giusto, chiamare Dario.'
	}
	# (8/10) sulla linea principale del ramo, non solo nella sua storia: su
	# ui-v3 i commit di ui-lifting entrati coi merge non valgono
	$principale = G @('rev-list', '--first-parent', 'HEAD')
	if ($principale.Codice -ne 0 -or @($principale.Uscita | ForEach-Object { $_.Trim() }) -notcontains $Commit) {
		Fermati ('il commit ' + $Commit + ' non e'' sulla linea principale del ramo ' + $ramo + ' (git rev-list --first-parent).') 'un ritorno va solo indietro sul ramo di cella, sui suoi commit: controllare il commit (la procedura ne da'' uno per ui-lifting e uno per ui-v3, e quello di ui-v3 e'' un merge).'
	}
}

# 2b. file non tracciati d'intralcio. Nel clone parziale di cella git switch
#     e git pull NON si fermano se il ramo di arrivo porta un file dove sul
#     disco ce n'e' gia' uno non tracciato: lo sovrascrivono, con il solo
#     warning "already present and thus not updated despite sparse patterns"
#     e codice 0 (provato il 6/10 con git 2.52 su un clone parziale come
#     quello di cella; in un clone completo invece git si ferma). Il
#     controllo lo fa lo script, prima di toccare qualcosa: i file che il
#     ramo di arrivo aggiunge rispetto a HEAD e che sul disco ci sono gia'
#     con un contenuto diverso. Uguale contenuto = nessuna perdita, si passa.
$arrivi = @()
if ($ritorno) { $arrivi = @($Commit) }
else {
	foreach ($ref in @(('refs/remotes/origin/' + $ramo), ('refs/heads/' + $ramo))) {
		if ((G @('rev-parse', '--verify', '--quiet', $ref)).Codice -eq 0) { $arrivi += $ref }
	}
}
$intralcio = @()
foreach ($ref in $arrivi) {
	$nuovi = (G @('diff', '--name-only', '--no-renames', '--diff-filter=A', 'HEAD', $ref)).Uscita | Where-Object { $_ -and $_.Trim() }
	foreach ($f in $nuovi) {
		if (-not (Test-Path -LiteralPath (Join-Path $script:Radice $f) -PathType Leaf)) { continue }
		$suDisco = ((G @('hash-object', '--', $f)).Uscita -join '').Trim()
		$inArrivo = ((G @('rev-parse', ($ref + ':' + $f))).Uscita -join '').Trim()
		if ($suDisco -ne $inArrivo -and $intralcio -notcontains $f) { $intralcio += $f }
	}
}
if ($intralcio.Count -gt 0) {
	Scrivi ''
	Scrivi ('File non tracciati che il ramo ' + $ramo + ' sovrascriverebbe:') 'Yellow'
	$intralcio | ForEach-Object { Scrivi ('  ' + $_) 'Yellow' }
	Fermati 'nel clone parziale di cella git li sovrascriverebbe senza fermarsi.' 'non cancellarli e non spostarli a mano: chiama Dario, che decide dove salvarli. Poi rilancia lo script.'
}

# commit e lock di prima (per sapere se serve npm install e se il pannello
# va riavviato)
$headPrima = ((G @('rev-parse', 'HEAD')).Uscita -join '').Trim()
$lockPrima = ((G @('rev-parse', ('HEAD:' + $LOCK))).Uscita -join '').Trim()

# 2c. (servizi) il pannello si ferma prima di cambiare i file: Vite come
#     servizio terrebbe bloccati i file di npm install. Da qui ogni FERMO lo
#     rimette su (Fermati -> RimettiSuPannello).
if ($conServizi -and (Servizio $S_P)) {
	Scrivi ('Fermo ' + $S_P + '...') 'Cyan'
	Stop-Service -Name $S_P -Force -ErrorAction SilentlyContinue
	if ((StatoServizio $S_P) -ne 'Stopped') { Fermati ($S_P + ' non si e'' fermato (' + (StatoServizio $S_P) + ').') 'chiamare Dario con questo messaggio: nessun file e'' stato cambiato.' }
	$script:PannelloFermato = $true
}

# 3. switch (ritorno: la copia di lavoro si stacca sul commit, il ramo resta)
$attuale = ((G @('branch', '--show-current')).Uscita -join '').Trim()
if ($ritorno) {
	$s = G @('switch', '--detach', $Commit)
	if ($s.Codice -ne 0) {
		$s.Uscita | ForEach-Object { Scrivi ('  ' + $_) }
		Fermati ('git switch --detach ' + $Commit + ' non riuscito.') 'chiamare Dario con questo messaggio.'
	}
	$script:Staccato = $true
} elseif ($attuale -eq $ramo) {
	Scrivi ('Sono gia'' sul ramo ' + $ramo + ': lo aggiorno.')
} else {
	$remoto = G @('rev-parse', '--verify', '--quiet', ('refs/remotes/origin/' + $ramo))
	$locale = G @('rev-parse', '--verify', '--quiet', ('refs/heads/' + $ramo))
	if ($remoto.Codice -ne 0 -and $locale.Codice -ne 0) {
		Fermati ('il ramo ' + $ramo + ' non esiste ne'' qui ne'' su GitHub.') 'la versione non e'' ancora stata pubblicata: chiedere a Dario.'
	}
	$s = G @('switch', $ramo)
	if ($s.Codice -ne 0) {
		$s.Uscita | ForEach-Object { Scrivi ('  ' + $_) }
		if ($conServizi) { Fermati ('git switch su ' + $ramo + ' non riuscito.') 'chiamare Dario con questo messaggio.' }
		Fermati ('git switch su ' + $ramo + ' non riuscito.') 'se il messaggio parla di file in uso, chiudere la finestra del pannello e rilanciare; altrimenti chiamare Dario con questo messaggio.'
	}
}

# 4. pull solo in avanti (non nel ritorno: si resta sul commit indicato)
if ($ritorno) {
	Scrivi ('Copia di lavoro sul commit ' + $Commit + '; il ramo ' + $ramo + ' non e'' stato spostato.')
} elseif ((G @('rev-parse', '--verify', '--quiet', ('refs/remotes/origin/' + $ramo))).Codice -eq 0) {
	$p = G @('pull', '--ff-only', 'origin', $ramo)
	if ($p.Codice -ne 0) {
		$p.Uscita | ForEach-Object { Scrivi ('  ' + $_) }
		Fermati ('il ramo ' + $ramo + ' qui e su GitHub hanno storie diverse: non si aggiorna con un semplice avanzamento.') ('non forzare niente: chiamare Dario. La versione attiva e'' comunque quella del ramo locale ' + $ramo + '.')
	}
} else {
	Scrivi ('Il ramo ' + $ramo + ' non e'' su GitHub: resto sulla copia locale.') 'Yellow'
}

# 5. npm install se il package-lock e' cambiato, se l'ultima e' fallita o
#    se node_modules non c'e' ancora
$lockDopo = ((G @('rev-parse', ('HEAD:' + $LOCK))).Uscita -join '').Trim()
$segnoFile = Join-Path $script:Radice $SEGNO
$moduli = Split-Path $segnoFile
# non $segno: per PowerShell e' la stessa variabile di $SEGNO
$lockSegnato = if (Test-Path $segnoFile) { (Get-Content $segnoFile -Raw).Trim() } else { '' }
$serve = ($lockPrima -ne $lockDopo) -or ($lockSegnato -and $lockSegnato -ne $lockDopo) -or (-not (Test-Path $moduli))
$giaCambiato = $(if ($ritorno) { 'La copia di lavoro e'' gia'' sul commit ' + $Commit + ': mancano solo le dipendenze del pannello.' } else { 'Il ramo e'' gia'' ' + $ramo + ': mancano solo le dipendenze del pannello.' })
if ($serve) {
	Scrivi 'Le dipendenze del pannello sono cambiate: npm install in easybox\HMI...' 'Cyan'
	# npm.cmd e non npm: con l'operatore & lo shim npm.ps1 di Node legge male
	# la riga di comando (riceve "pm" al posto di "install")
	if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
		Fermati 'npm non trovato.' 'installare Node.js o chiamare Dario, poi rilanciare lo script con la stessa versione.' $giaCambiato
	}
	Push-Location (Join-Path $script:Radice 'easybox\HMI')
	& npm.cmd install
	$npm = $LASTEXITCODE
	Pop-Location
	if ($npm -ne 0) {
		if (Test-Path $moduli) { Set-Content -Path $segnoFile -Value 'fallito' -Encoding ASCII }
		if ($conServizi) { Fermati 'npm install non riuscito.' 'rilanciare lo script con la stessa versione: rifa'' npm install. Se fallisce ancora, chiamare Dario con il messaggio qui sopra.' $giaCambiato }
		Fermati 'npm install non riuscito.' 'chiudere la finestra del pannello (Ctrl+C), rilanciare lo script con la stessa versione: rifa'' npm install. Se fallisce ancora, chiamare Dario con il messaggio qui sopra.' $giaCambiato
	}
	Set-Content -Path $segnoFile -Value $lockDopo -Encoding ASCII
} else {
	Scrivi 'Dipendenze del pannello invariate: npm install non serve.'
}

# 6. riepilogo e cosa riavviare. In cella nessuno dei due si riavvia da solo:
#    sono due finestre aperte da start_server.bat e start_hmi.bat, non servizi.
#    Il pannello va rilanciato con le stesse regole della procedura in
#    docs/APPUNTI-CELLA.md: npm install fatto, o cambiato uno di questi file.
$cambiatiHmi = @((G (@('diff', '--name-only', $headPrima, 'HEAD', '--') + $HMI_AVVIO)).Uscita | Where-Object { $_ -and $_.Trim() })
$riavviaHmi = $serve -or ($cambiatiHmi.Count -gt 0)

# 6-servizi col pannello COMPILATO (7/10 sera): la build nuova e il riavvio di
# backend e pannello li fa servizi-cella.ps1 -Azione aggiorna, lo stesso
# codice di sempre. Se non riesce, Fermati rimette su il pannello (sulla dist
# che c'e': con la build fallita, quella di prima).
if ($conServizi -and (Servizio $S_P) -and (Get-EasyBoxModoPannello) -eq 'preview') {
	Scrivi ''
	Scrivi 'Il pannello gira COMPILATO: build nuova e riavvio con servizi-cella.ps1 -Azione aggiorna...' 'Cyan'
	$esitoAggiorna = Invoke-EasyBoxAggiorna
	if ($esitoAggiorna -ne 0) {
		Fermati 'aggiornamento del pannello compilato non riuscito (servizi-cella.ps1 -Azione aggiorna, messaggi qui sopra).' 'leggere l''errore della build qui sopra (log completo in easybox\HMI\log\build_pannello.log) e mandarlo a Dario. Dopo la correzione: servizi-cella.ps1 -Azione aggiorna.' ($(if ($ritorno) { 'Il repo e'' gia'' sul commit ' + $Commit } else { 'Il repo e'' gia'' sul ramo ' + $ramo }) + '. Quale pannello e'' servito (quello di prima o il nuovo) e come stanno i servizi lo dicono i messaggi di aggiorna qui sopra: aggiorna puo'' fermarsi anche dopo lo scambio delle dist.')
	}
	$script:PannelloFermato = $false
	Scrivi ''
	Stato
	Scrivi ''
	Scrivi 'Fatto. Servito: pannello COMPILATO, dalla build appena fatta (backend e pannello riavviati da aggiorna):' 'Green'
	Show-EasyBoxPannelloServito
	NotaRitorno
	Scrivi 'Controlli:' 'Green'
	Scrivi '  - Ctrl+F5 sui client (touch di cella e tablet);' 'Green'
	Scrivi '  - stato del robot che si aggiorna;' 'Green'
	Scrivi '  - DB_executeQuery.readyForNextQuery TRUE.' 'Green'
	exit 0
}

# 6-servizi: si riavvia il backend (node non rilegge i file da solo), si
# riavvia il pannello e si aspettano le porte. Niente finestre.
if ($conServizi) {
	Scrivi 'Riavvio dei servizi...' 'Cyan'
	if (Servizio $S_B) { Restart-Service -Name $S_B -Force -ErrorAction SilentlyContinue }
	if (Servizio $S_P) { Start-Service -Name $S_P -ErrorAction SilentlyContinue }
	$script:PannelloFermato = $false
	$porteOk = AspettaPorte 90
	Scrivi ''
	Stato
	Scrivi ''
	Scrivi 'Fatto. Servizi:' 'Green'
	Scrivi ('  ' + $S_B + ': riavviato (' + (StatoServizio $S_B) + ');') 'Green'
	Scrivi ('  ' + $S_P + ': riavviato (' + (StatoServizio $S_P) + ').') 'Green'
	Scrivi ('Servito: ' + $(if ((Get-EasyBoxModoPannello) -eq 'dev') { 'server di sviluppo (vite), i file del ramo ' + $ramo + ' come sono.' } else { 'pannello del ramo ' + $ramo + '.' })) 'Green'
	if ($porteOk) { Scrivi 'Porte 8080, 3000 e 5173 in ascolto.' 'Green' }
	else {
		$su = PorteInAscolto
		Scrivi ('Dopo 90 secondi non tutte le porte sono in ascolto (in ascolto: ' + $(if ($su.Count) { $su -join ', ' } else { 'nessuna' }) + '): servizi-cella.ps1 -Azione stato per i log.') 'Red'
	}
	Scrivi 'Controlli:' 'Green'
	Scrivi '  - Ctrl+F5 sui client (touch di cella e tablet);' 'Green'
	Scrivi '  - stato del robot che si aggiorna;' 'Green'
	Scrivi '  - DB_executeQuery.readyForNextQuery TRUE.' 'Green'
	NotaRitorno
	exit 0
}

Scrivi ''
Stato
Scrivi ''
Scrivi 'Fatto. Adesso, con la cella sempre in HOLD:' 'Green'
Scrivi '  backend:  Ctrl+C nella finestra di start_server.bat, poi rilanciare start_server.bat (non si riavvia da solo);' 'Green'
if ($riavviaHmi) {
	Scrivi '  pannello: Ctrl+C nella finestra di start_hmi.bat, poi rilanciare start_hmi.bat (npm install fatto o configurazione cambiata).' 'Green'
} else {
	Scrivi '  pannello: basta Ctrl+F5 sui client (touch di cella e tablet).' 'Green'
}
Scrivi 'Controlli:' 'Green'
Scrivi '  - porte 5173, 8080 e 3000 in ascolto;' 'Green'
Scrivi '  - INIT nuovo in easybox\serverDati\log\access.log;' 'Green'
Scrivi '  - stato del robot che si aggiorna;' 'Green'
Scrivi '  - DB_executeQuery.readyForNextQuery TRUE.' 'Green'
Scrivi 'Le due finestre non si chiudono senza rilanciarle: il 6/10 la chiusura di quella del backend ha fermato il ponte fra PLC e SQL per circa 13 minuti.' 'Yellow'
NotaRitorno
exit 0
