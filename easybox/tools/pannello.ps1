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
#      e fermerebbero lo script ogni volta. Se uno di loro e' d'intralcio al
#      cambio di ramo, e' git switch a dirlo, e lo script si ferma al passo 3;
#   2. git fetch origin;
#   3. git switch sul ramo;
#   4. git pull --ff-only (se non e' un avanzamento semplice si ferma);
#   5. npm install in easybox\HMI se package-lock.json e' cambiato (o se
#      node_modules manca, o se l'ultima installazione e' fallita);
#   6. dice cosa e' attivo e cosa riavviare. In cella non ci sono servizi:
#      backend e pannello girano nelle finestre di start_server.bat e
#      start_hmi.bat e nessuno dei due si riavvia da solo. Il backend va
#      riavviato sempre; il pannello solo se c'e' stato npm install o sono
#      cambiati package.json, package-lock.json o vite.config.js, altrimenti
#      basta Ctrl+F5 sui client.
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
	exit 1
}
# git con uscita e codice, senza far diventare errore l'stderr (git ci
# scrive anche i messaggi normali, es. l'avanzamento del fetch)
function G([string[]]$argomenti) {
	$uscita = & git -C $script:Radice @argomenti 2>&1 | ForEach-Object { "$_" }
	return [pscustomobject]@{ Codice = $LASTEXITCODE; Uscita = @($uscita) }
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
# Se uno di loro e' d'intralcio al cambio di ramo, lo dice git switch.
function ModificheLocali { return @((G @('status', '--porcelain', '--untracked-files=no')).Uscita | Where-Object { $_ -and $_.Trim() }) }

# ---------------------------------------------------------------- stato
if ($Versione -eq 'stato') {
	Stato
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

# commit e lock di prima (per sapere se serve npm install e se il pannello
# va riavviato)
$headPrima = ((G @('rev-parse', 'HEAD')).Uscita -join '').Trim()
$lockPrima = ((G @('rev-parse', ('HEAD:' + $LOCK))).Uscita -join '').Trim()

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
