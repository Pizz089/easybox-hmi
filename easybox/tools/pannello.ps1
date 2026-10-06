# ============================================================================
# easybox/tools/pannello.ps1 - cambia la versione del pannello in cella
#
#   stabile  ramo ui-lifting: solo modifiche funzionali (quello di sempre)
#   v3       ramo ui-v3: ui-lifting + la grafica nuova (pannello v3)
#   stato    dice su che versione si e', senza cambiare niente
#
# Uso (da qualunque cartella):
#   powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\pannello.ps1 -Versione v3
#   powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\pannello.ps1 -Versione stabile
#   powershell -ExecutionPolicy Bypass -File D:\Prog\easybox\tools\pannello.ps1 -Versione stato
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
# Non usa MAI reset, clean, stash, checkout -- o --force: nel peggiore dei
# casi si ferma e spiega, e il repo resta com'era.
# Testi senza lettere accentate: PowerShell 5.1 legge i file senza BOM come
# ANSI e le storpierebbe.
# ============================================================================
param(
	[Parameter(Mandatory = $true)]
	[ValidateSet('v3', 'stabile', 'stato')]
	[string]$Versione
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
function RimettiSuPannello {
	$script:PannelloFermato = $false
	Scrivi ''
	Scrivi ('Rimetto su ' + $S_P + ' sulla versione che c''e''...') 'Yellow'
	Start-Service -Name $S_P -ErrorAction SilentlyContinue
	if ((StatoServizio $S_P) -eq 'Running') { Scrivi ($S_P + ' avviato: il pannello e'' di nuovo su.') 'Yellow' }
	else { Scrivi ($S_P + ' NON avviato: con la cella in HOLD lanciare servizi-cella.ps1 -Azione riavvia, oppure chiamare Dario.') 'Red' }
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
	$commit = (G @('log', '-1', '--format=%h  %s')).Uscita -join ''
	$data = (G @('log', '-1', '--date=format:%d/%m/%Y %H:%M', '--format=%cd')).Uscita -join ''
	$nome = if ($NOMI.ContainsKey($ramo)) { $NOMI[$ramo] } else { 'nessuna delle due (ramo non previsto)' }
	Scrivi ('Repo:     ' + $script:Radice)
	Scrivi ('Versione: ' + $nome) 'Cyan'
	Scrivi ('Ramo:     ' + $ramo)
	Scrivi ('Commit:   ' + $commit)
	Scrivi ('Data:     ' + $data)
}
# solo i file tracciati: i non tracciati della cella (i .bat di avvio, il
# backup di serverDati) ci sono sempre e fermerebbero lo script ogni volta.
# Se uno di loro e' d'intralcio al cambio di ramo, lo trova il passo 2b.
function ModificheLocali { return @((G @('status', '--porcelain', '--untracked-files=no')).Uscita | Where-Object { $_ -and $_.Trim() }) }

# ---------------------------------------------------------------- stato
if ($Versione -eq 'stato') {
	Stato
	Scrivi ('Servizi: ' + $S_B + ' ' + (StatoServizio $S_B) + ', ' + $S_P + ' ' + (StatoServizio $S_P))
	$mod = ModificheLocali
	if ($mod.Count -eq 0) { Scrivi 'Modifiche locali (file tracciati): nessuna' 'Green' }
	else {
		Scrivi ('Modifiche locali (file tracciati): ' + $mod.Count) 'Yellow'
		$mod | ForEach-Object { Scrivi ('  ' + $_) 'Yellow' }
	}
	exit 0
}

# ---------------------------------------------------------------- cambio
$ramo = $RAMI[$Versione]
Scrivi ('Passo alla versione ' + $Versione + ' (ramo ' + $ramo + ')') 'Cyan'
Scrivi 'Promemoria: la cella deve essere in HOLD.' 'Yellow'

# 0. servizi installati? Allora serve l'amministratore (fermare e avviare i
#    servizi): si controlla prima di qualunque altra cosa
$conServizi = @(@($S_B, $S_P) | Where-Object { Servizio $_ }).Count -gt 0
if ($conServizi) {
	Scrivi ('Servizi: ' + $S_B + ' ' + (StatoServizio $S_B) + ', ' + $S_P + ' ' + (StatoServizio $S_P))
	if (-not (Test-EasyBoxAmministratore)) {
		Fermati 'con i servizi EasyBoxBackend ed EasyBoxPannello installati serve PowerShell come amministratore.' ('aprire PowerShell con "Esegui come amministratore" e rilanciare: powershell -ExecutionPolicy Bypass -File ' + $PSCommandPath + ' -Versione ' + $Versione)
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

# 2. fetch
Scrivi 'Leggo le versioni su GitHub (git fetch origin)...'
$f = G @('fetch', 'origin')
if ($f.Codice -ne 0) {
	$f.Uscita | ForEach-Object { Scrivi ('  ' + $_) }
	Fermati 'git fetch non riuscito.' 'controllare la rete del PC e l''accesso a GitHub, poi rilanciare. Se il problema resta, chiamare Dario.'
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
foreach ($ref in @(('refs/remotes/origin/' + $ramo), ('refs/heads/' + $ramo))) {
	if ((G @('rev-parse', '--verify', '--quiet', $ref)).Codice -eq 0) { $arrivi += $ref }
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

# 3. switch
$attuale = ((G @('branch', '--show-current')).Uscita -join '').Trim()
if ($attuale -eq $ramo) {
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

# 4. pull solo in avanti
if ((G @('rev-parse', '--verify', '--quiet', ('refs/remotes/origin/' + $ramo))).Codice -eq 0) {
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
$segno = if (Test-Path $segnoFile) { (Get-Content $segnoFile -Raw).Trim() } else { '' }
$serve = ($lockPrima -ne $lockDopo) -or ($segno -and $segno -ne $lockDopo) -or (-not (Test-Path $moduli))
$giaCambiato = ('Il ramo e'' gia'' ' + $ramo + ': mancano solo le dipendenze del pannello.')
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
	if ($porteOk) { Scrivi 'Porte 8080, 3000 e 5173 in ascolto.' 'Green' }
	else {
		$su = PorteInAscolto
		Scrivi ('Dopo 90 secondi non tutte le porte sono in ascolto (in ascolto: ' + $(if ($su.Count) { $su -join ', ' } else { 'nessuna' }) + '): servizi-cella.ps1 -Azione stato per i log.') 'Red'
	}
	Scrivi 'Controlli:' 'Green'
	Scrivi '  - Ctrl+F5 sui client (touch di cella e tablet);' 'Green'
	Scrivi '  - stato del robot che si aggiorna;' 'Green'
	Scrivi '  - DB_executeQuery.readyForNextQuery TRUE.' 'Green'
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
exit 0
