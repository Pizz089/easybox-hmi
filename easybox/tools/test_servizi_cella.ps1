# ============================================================================
# easybox/tools/test_servizi_cella.ps1 - controlli sul TESTO di
# servizi-cella.ps1 (non lo esegue: niente nssm, niente servizi)
#
# Con il parser di PowerShell (AST), non con le espressioni sul testo:
#   1. il controllo da amministratore viene prima di qualunque esecuzione di
#      nssm e di qualunque Start-Service, Stop-Service, Restart-Service;
#   2. "prova" esce prima di qualunque esecuzione di nssm (le sole
#      esecuzioni prima della sua uscita sono nel ramo "rimuovi", che esce);
#   3. "rimuovi" agisce solo su EasyBoxBackend ed EasyBoxPannello;
#   4. nessun "sc.exe delete" / "sc delete" e nessun nome di servizio
#      diverso dai due;
#   5. solo ASCII;
#   6. nessuna variabile assegnata con un nome che differisce da un altro
#      solo per maiuscole e minuscole (per PowerShell e' la stessa);
#   (7/10, servizi in Paused per i node delle vecchie finestre)
#   7. Stop-Process solo in ChiudiNodeSullePorte, solo sui node che non sono
#      dei servizi, e chiamata solo da "riavvia", a servizi fermi;
#   8. "riavvia" (RiavviaServizi, che usa anche aggiorna): Stop-Service,
#      porte libere, scambio delle dist se c'e', avvio del backend e POI del
#      pannello, verifica (Running e proprietari delle porte), uscita in
#      errore altrimenti; niente Restart-Service;
#   9. avvii automatici: nessuna scrittura su registro ed Esecuzione
#      automatica, nessun Remove-Item; le operazioni pianificate si cercano
#      (start_server, start_hmi, node, npm, nodemon, vite, easybox) e l'unica
#      scrittura e' Disable-ScheduledTask in ProponiDisabilita: solo da
#      installa (non da prova ne' da stato), dopo una "s" esplicita e dopo
#      averne salvato la definizione; stato elenca solo le attive; installa
#      le controlla prima di fermarsi per servizi gia' installati;
#  10. "stato": proprietari delle porte e motivo di un Paused dagli eventi nssm;
#   (7/10, pannello compilato)
#  11. preview / aggiorna / ripristina / dev: parametri del servizio
#      ("vite.js preview --port 5173 --strictPort" e "vite.js"); la build va
#      in dist_build e se fallisce ci si ferma prima di toccare dist e
#      servizio; lo scambio delle dist a pannello fermo; solo il pannello si
#      ferma e riparte, il backend no; dist_build e dist_prev ignorate da git.
# Uso: powershell -ExecutionPolicy Bypass -File easybox\tools\test_servizi_cella.ps1
# Exit code = numero di controlli falliti.
# ============================================================================
$ErrorActionPreference = 'Stop'
$file = Join-Path $PSScriptRoot 'servizi-cella.ps1'
$script:falliti = 0
function Check([bool]$ok, [string]$cosa) {
	Write-Host ($(if ($ok) { '  ok   ' } else { '  FAIL ' }) + $cosa)
	if (-not $ok) { $script:falliti++ }
}

$token = $null; $errori = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($file, [ref]$token, [ref]$errori)
Check ($errori.Count -eq 0) ('il file si analizza senza errori (' + $errori.Count + ')')

$comandi = @($ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.CommandAst] }, $true))
$nome = { param($c) $c.CommandElements[0].Extent.Text }
# esecuzioni di nssm: "& $Nssm ..."
$nssm = @($comandi | Where-Object { $_.InvocationOperator -eq 'Ampersand' -and (& $nome $_) -eq '$Nssm' })
$servizi = @($comandi | Where-Object { @('Start-Service', 'Stop-Service', 'Restart-Service') -contains (& $nome $_) })

# l'if che controlla l'amministratore (a livello di script)
$ifAdmin = @($ast.EndBlock.Statements | Where-Object { $_ -is [System.Management.Automation.Language.IfStatementAst] -and $_.Clauses[0].Item1.Extent.Text -match 'Amministratore' })[0]
Check ($null -ne $ifAdmin -and $ifAdmin.Clauses[0].Item2.Extent.Text -match 'Fermati') 'esiste il controllo da amministratore (se non lo e'', Fermati)'
$oltreAdmin = $ifAdmin.Extent.EndOffset
Check ($nssm.Count -gt 0) ('trovate le esecuzioni di nssm (' + $nssm.Count + ')')
Check (@($nssm | Where-Object { $_.Extent.StartOffset -lt $oltreAdmin }).Count -eq 0) '1. nessuna esecuzione di nssm prima del controllo da amministratore'
Check (@($servizi | Where-Object { $_.Extent.StartOffset -lt $oltreAdmin }).Count -eq 0) ('1. nessun Start/Stop/Restart-Service prima del controllo (' + $servizi.Count + ' in tutto)')

# 2. prova
$ramo = { param($testo) @($ast.EndBlock.Statements | Where-Object { $_ -is [System.Management.Automation.Language.IfStatementAst] -and $_.Clauses[0].Item1.Extent.Text -eq $testo })[0] }
$ifProva = & $ramo '$prova'
$ifRimuovi = & $ramo '$Azione -eq ''rimuovi'''
Check ($null -ne $ifProva -and $ifProva.Clauses[0].Item2.Extent.Text -match '\bexit 0\b') '2. il ramo "prova" esiste e finisce con exit 0'
Check ($null -ne $ifRimuovi -and $ifRimuovi.Clauses[0].Item2.Extent.Text -match '\bexit 0\b') '   il ramo "rimuovi" esiste e finisce con exit 0'
$dentro = { param($n, $blocco) $n.Extent.StartOffset -ge $blocco.Extent.StartOffset -and $n.Extent.EndOffset -le $blocco.Extent.EndOffset }
# (7/10) anche "preview" e "dev" eseguono nssm (set AppParameters) prima di
# "prova": sono rami che escono, come "rimuovi"
$ifPreview = & $ramo '$Azione -eq ''preview'''
$ifDev = & $ramo '$Azione -eq ''dev'''
$ramiEscono = @($ifRimuovi, $ifPreview, $ifDev) | Where-Object { $_ }
$primaDiProva = @($nssm | Where-Object { $n0 = $_; $_.Extent.StartOffset -lt $ifProva.Extent.EndOffset -and -not @($ramiEscono | Where-Object { & $dentro $n0 $_ }).Count })
Check ($primaDiProva.Count -eq 0 -and $ramiEscono.Count -eq 3 -and @($ramiEscono | Where-Object { $_.Clauses[0].Item2.Extent.Text -notmatch '\bexit 0\b' }).Count -eq 0) '2. "prova" esce prima di qualunque esecuzione di nssm (prima della sua uscita solo i rami rimuovi, preview e dev, che escono a loro volta)'
Check (@($servizi | Where-Object { $_.Extent.StartOffset -gt $ifProva.Extent.StartOffset -and $_.Extent.EndOffset -lt $ifProva.Extent.EndOffset }).Count -eq 0) '   "prova" non avvia ne'' ferma servizi'

# 3. rimuovi: il ciclo e' sui due nomi, e nssm remove usa la variabile del ciclo
$cicli = @($ifRimuovi.FindAll({ param($n) $n -is [System.Management.Automation.Language.ForEachStatementAst] }, $true))
Check ($cicli.Count -eq 1 -and $cicli[0].Condition.Extent.Text -eq '@($S_P, $S_B)' -and $cicli[0].Variable.Extent.Text -eq '$n') '3. "rimuovi" cicla solo su $S_P e $S_B'
$inRimuovi = @($nssm | Where-Object { & $dentro $_ $ifRimuovi })
Check ($inRimuovi.Count -eq 1 -and $inRimuovi[0].Extent.Text -eq '& $Nssm remove $n confirm') ('   e l''unico nssm e'' "remove $n confirm" (' + (($inRimuovi | ForEach-Object { $_.Extent.Text }) -join ' | ') + ')')
$assegna = { param($v) @($ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.AssignmentStatementAst] -and $n.Left.Extent.Text -eq $v }, $true)) }
$sb = & $assegna '$S_B'; $sp = & $assegna '$S_P'
Check ($sb.Count -eq 1 -and $sb[0].Right.Extent.Text -eq '''EasyBoxBackend''' -and $sp.Count -eq 1 -and $sp[0].Right.Extent.Text -eq '''EasyBoxPannello''') '   $S_B = EasyBoxBackend, $S_P = EasyBoxPannello, assegnati una volta sola'
# tutte le cleanup dopo un errore di installa sono sugli stessi due
$cleanup = @($nssm | Where-Object { $_.Extent.Text -match 'remove' -and -not (& $dentro $_ $ifRimuovi) })
Check (@($cleanup | Where-Object { $_.Extent.Text -ne '& $Nssm remove $n confirm' }).Count -eq 0) '   anche la pulizia dopo un errore di installa e'' "remove $n confirm" sui due servizi'

# 4. niente sc delete, niente altri nomi di servizio
$testo = [IO.File]::ReadAllText($file)
Check (-not ($testo -match '(?i)\bsc(\.exe)?\s+delete\b')) '4. nessun "sc delete" / "sc.exe delete"'
$stringhe = @($ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.StringConstantExpressionAst] }, $true) | ForEach-Object { $_.Value })
$nomiServizio = @($stringhe | Where-Object { $_ -match '^EasyBox[A-Za-z]+$' } | Sort-Object -Unique)
Check (($nomiServizio -join ',') -eq 'EasyBoxBackend,EasyBoxPannello') ('   nomi di servizio nelle stringhe: solo i due (' + ($nomiServizio -join ', ') + ')')
# il valore di -Name di ogni Start/Stop/Restart-Service
$argNome = @($servizi | ForEach-Object {
	$el = $_.CommandElements
	for ($i = 1; $i -lt $el.Count; $i++) {
		if ($el[$i] -is [System.Management.Automation.Language.CommandParameterAst] -and $el[$i].ParameterName -eq 'Name') {
			if ($el[$i].Argument) { $el[$i].Argument.Extent.Text } elseif ($i + 1 -lt $el.Count) { $el[$i + 1].Extent.Text }
		}
	}
})
Check ($argNome.Count -eq $servizi.Count) ('   ogni Start/Stop/Restart-Service dice -Name (' + $argNome.Count + ' su ' + $servizi.Count + ')')
Check (@($argNome | Where-Object { @('$S_B', '$S_P', '$S_B, $S_P', '$n') -notcontains $_ }).Count -eq 0) ('   Start/Stop/Restart-Service solo su $S_B, $S_P o $n del ciclo (' + (($argNome | Sort-Object -Unique) -join ' | ') + ')')

# 4b. installa crea le cartelle dei DUE log prima di creare i servizi: senza
#     la cartella nssm non apre il log e il servizio non parte
$cartelle = @($comandi | Where-Object { (& $nome $_) -eq 'New-Item' -and $_.Extent.Text -match 'Directory' -and $_.Extent.StartOffset -gt $ifProva.Extent.EndOffset })
# istruzione di primo livello che contiene il nodo (es. il foreach intorno)
$cima = { param($n) $p = $n; while ($p.Parent -and -not ($p.Parent -is [System.Management.Automation.Language.NamedBlockAst])) { $p = $p.Parent }; $p }
$conLog = @($cartelle | Where-Object { (& $cima $_).Extent.Text -match 'Split-Path \$Log' })
$testoCartelle = ($conLog | ForEach-Object { (& $cima $_).Extent.Text }) -join ' '
$primoNssmInstalla = @($nssm | Where-Object { $_.Extent.StartOffset -gt $ifProva.Extent.EndOffset -and $_.Extent.Text -match '@a' })[0]
Check ($testoCartelle -match 'Split-Path \$LogB' -and $testoCartelle -match 'Split-Path \$LogP') ('4b. installa crea le cartelle di $LogB e di $LogP (' + $testoCartelle.Trim() + ')')
Check ($conLog.Count -gt 0 -and $null -ne $primoNssmInstalla -and @($conLog | Where-Object { $_.Extent.StartOffset -lt $primoNssmInstalla.Extent.StartOffset }).Count -eq $conLog.Count) '    prima dei comandi nssm di installa'

# 5. ASCII
$byte = [IO.File]::ReadAllBytes($file)
Check (@($byte | Where-Object { $_ -ge 128 }).Count -eq 0) '5. solo ASCII'

# 6. $porte e $PORTE sono la STESSA variabile: il 6/10 in installa il
#    risultato di MostraPorte sovrascriveva l'elenco delle porte
#    (Get-NetTCPConnection con LocalPort nullo, falso "porte in ascolto").
#    Nomi assegnati: con =, come variabile di un foreach, come parametro;
#    senza "script:" e "global:".
$AST = $ast
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
Check ($stessa.Count -eq 0) ('6. nessuna variabile assegnata con un nome che differisce da un altro solo per maiuscole/minuscole (' + $nomiAssegnati.Count + ' nomi' + $(if ($stessa.Count) { '; stessa variabile: ' + ($stessa -join ', ') } else { '' }) + ')')

# funzioni del file e chiamate per nome
$funzioni = @{}
foreach ($f in @($ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] }, $true))) { $funzioni[$f.Name] = $f }
$chiamate = { param($chi) @($comandi | Where-Object { (& $nome $_) -eq $chi }) }
$ifRiavvia = & $ramo '$Azione -eq ''riavvia'''
$ifStato = & $ramo '$Azione -eq ''stato'''
Check ($null -ne $ifRiavvia -and $null -ne $ifStato) '   trovati i rami "riavvia" e "stato"'

# 7. Stop-Process
$stopProcess = @(& $chiamate 'Stop-Process')
$chiudi = $funzioni['ChiudiNodeSullePorte']
Check ($null -ne $chiudi -and $stopProcess.Count -eq 1 -and (& $dentro $stopProcess[0] $chiudi)) ('7. Stop-Process una volta sola, dentro ChiudiNodeSullePorte (' + $stopProcess.Count + ')')
Check ($null -ne $chiudi -and $chiudi.Body.Extent.Text -match "\`$_\.Nome -eq 'node' -and -not \`$_\.Servizio") '   solo sui processi node che non sono di un servizio'
$usiChiudi = @(& $chiamate 'ChiudiNodeSullePorte')
$riavviaPannello = $funzioni['RiavviaPannello']
$riavviaServizi = $funzioni['RiavviaServizi']
# (7/10) chiamata da RiavviaServizi (riavvia, aggiorna) e da RiavviaPannello
# (pannello compilato): in tutti e due i posti dopo uno Stop-Service nella
# stessa funzione
$dopoStop = { param($uso, $blocco) @(& $chiamate 'Stop-Service' | Where-Object { (& $dentro $_ $blocco) -and $_.Extent.StartOffset -lt $uso.Extent.StartOffset }).Count -ge 1 }
$usiBuoni = @($usiChiudi | Where-Object { $u0 = $_; @(@($riavviaServizi, $riavviaPannello) | Where-Object { $_ -and (& $dentro $u0 $_) -and (& $dopoStop $u0 $_) }).Count -eq 1 })
Check ($usiChiudi.Count -eq 2 -and $usiBuoni.Count -eq 2) ('   chiamata solo da RiavviaServizi e da RiavviaPannello, dopo lo Stop-Service (' + $usiChiudi.Count + ' chiamate)')

# 8. riavvia (RiavviaServizi): l'ordine dei passi e l'uscita in errore
$tRS = if ($riavviaServizi) { $riavviaServizi.Body.Extent.Text } else { '' }
$passi = @('Stop-Service -Name $S_B, $S_P', 'AspettaPorteLibere 20', '& $daFermo', 'Start-Service -Name $S_B', 'AspettaPorte 90 @(8080, 3000)', 'Start-Service -Name $S_P', 'AspettaPorte 90 @(5173)', 'MostraProprietari')
# (MostraProprietari: l'ultima, la verifica; la prima e' nel ramo delle porte occupate)
$posPassi = @($passi | ForEach-Object { if ($_ -eq 'MostraProprietari') { $tRS.LastIndexOf($_) } else { $tRS.IndexOf($_) } })
$inOrdine = -not ($posPassi -contains -1)
for ($i = 1; $i -lt $posPassi.Count; $i++) { if ($posPassi[$i] -le $posPassi[$i - 1]) { $inOrdine = $false } }
Check $inOrdine ('8. RiavviaServizi: fermi, porte libere, scambio a servizi fermi, avvio del backend e attesa di 8080/3000, POI del pannello e attesa della 5173, poi proprietari delle porte (' + ($posPassi -join ',') + ')')
Check ($ifRiavvia.Clauses[0].Item2.Extent.Text -match '\$ok = RiavviaServizi\s+if \(-not \$ok\) \{\s+Fermati') '   riavvia: RiavviaServizi, e Fermati (exit 1) se non tutto Running o porte non dei servizi'
Check ((& $chiamate 'Restart-Service').Count -eq 0) '   nessun Restart-Service (non aspetta le porte ne'' chiude i node rimasti)'

# 9. avvii automatici
$scrive = @('Remove-ItemProperty', 'Set-ItemProperty', 'New-ItemProperty', 'Unregister-ScheduledTask', 'Stop-ScheduledTask', 'Set-ScheduledTask', 'Register-ScheduledTask')
$scritture = @($comandi | Where-Object { $scrive -contains (& $nome $_) })
Check ($scritture.Count -eq 0) ('9. nessuna scrittura su registro ed Esecuzione automatica, nessuna operazione pianificata cancellata o cambiata (' + (($scritture | ForEach-Object { & $nome $_ }) -join ', ') + ')')
# (7/10) Remove-Item solo su dist_prev e dist_build (pannello compilato)
$rimozioni = @(& $chiamate 'Remove-Item')
Check (@($rimozioni | Where-Object { $_.Extent.Text -notmatch '^Remove-Item -LiteralPath \$(DistPrev|DistBuild) -Recurse -Force -ErrorAction Stop$' }).Count -eq 0) ('   Remove-Item solo -LiteralPath $DistPrev / $DistBuild (' + $rimozioni.Count + ')')
$avvii = $funzioni['AvviiAutomatici']; $sospette = $funzioni['OperazioniSospette']
Check ($null -ne $avvii -and $avvii.Body.Extent.Text -match 'Start Menu\\Programs\\StartUp' -and $avvii.Body.Extent.Text -match 'CurrentVersion\\Run' -and $null -ne $sospette -and $sospette.Body.Extent.Text -match 'Get-ScheduledTask') '   Esecuzione automatica e chiavi Run in AvviiAutomatici, operazioni pianificate in OperazioniSospette'
$pattern = (& $assegna '$AVVIO_SOSPETTO')[0].Right.Extent.Text
$prove = @{ 'cmd /k cd /d D:\Prog\easybox\serverDati && npx nodemon server.js' = $true; 'D:\Prog\easybox\serverDati\start_server.bat' = $true; 'cmd /k npm run dev' = $true
	'D:\Prog\easybox\HMI\start_hmi.bat' = $true; '"C:\Program Files\nodejs\node.exe" vite.js' = $true; 'C:\Windows\system32\defrag.exe -c' = $false; 'nodejs-updater.exe' = $false }
$regex = Invoke-Expression $pattern
$sbagliate = @($prove.Keys | Where-Object { ($_ -match $regex) -ne $prove[$_] })
Check ($sbagliate.Count -eq 0) ('   il pattern riconosce le quattro operazioni del 7/10 (nodemon, start_server, npm run dev, start_hmi) e node; non defrag ne'' un nome che contiene solo "nodejs" (' + ($sbagliate -join ' | ') + ')')
# (7/10) i browser che aprono il pannello (\EasyBox Browser: chrome_proxy.exe
# --app-id=...) non sono avvii di backend o pannello: elencati a parte, mai
# fra le operazioni da disabilitare
$patBrowser = Invoke-Expression ((& $assegna '$BROWSER_PANNELLO')[0].Right.Extent.Text)
$proveBrowser = @{ 'C:\Program Files\Google\Chrome\Application\chrome_proxy.exe' = $true; 'C:\Program Files\Google\Chrome\Application\chrome.exe' = $true
	'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' = $true; 'chrome.exe' = $true; 'C:\Program Files\nodejs\node.exe' = $false; 'cmd.exe' = $false; 'C:\Prog\notchrome.exe' = $false }
$sbagliateB = @($proveBrowser.Keys | Where-Object { ($_ -match $patBrowser) -ne $proveBrowser[$_] })
Check ($sbagliateB.Count -eq 0) ('   browser: chrome, chrome_proxy e msedge si riconoscono; node, cmd e un nome che finisce solo per "chrome" no (' + ($sbagliateB -join ' | ') + ')')
$tMostra = $funzioni['MostraAvvii'].Body.Extent.Text
Check ($sospette.Body.Extent.Text -match 'Browser = \$browser' -and $sospette.Body.Extent.Text -match 'EBrowser \$_' -and $tMostra -match '\$operazioni = @\(\$tutteOp \| Where-Object \{ -not \$_\.Browser \}\)' -and $tMostra -match "\`$attive = @\(\`$operazioni \| Where-Object \{ \`$_\.Stato -ne 'Disabled' \}\)" -and $tMostra -match 'Browser del pannello') '   un''operazione e'' "browser" se tutte le sue azioni lanciano un browser; MostraAvvii li elenca a parte e non li mette fra le attive da disabilitare'
$disabilita = @(& $chiamate 'Disable-ScheduledTask')
$proponi = $funzioni['ProponiDisabilita']
Check ($disabilita.Count -eq 1 -and $null -ne $proponi -and (& $dentro $disabilita[0] $proponi)) ('   Disable-ScheduledTask una volta sola, dentro ProponiDisabilita (' + $disabilita.Count + ')')
$testoProponi = if ($proponi) { $proponi.Body.Extent.Text } else { '' }
$iRisposta = $testoProponi.IndexOf("if (`$risposta -ne 's')"); $iExport = $testoProponi.IndexOf('Export-ScheduledTask'); $iScrivi = $testoProponi.IndexOf('WriteAllText'); $iDisable = $testoProponi.IndexOf('$null = Disable-ScheduledTask')
Check ($testoProponi -match 'Read-Host' -and $iRisposta -gt 0 -and $iRisposta -lt $iExport -and $iExport -lt $iScrivi -and $iScrivi -lt $iDisable -and $testoProponi -match "if \(-not \`$xml\) \{[^}]*continue \}") '   solo dopo una "s" esplicita (Read-Host), e dopo averne salvato la definizione (Export-ScheduledTask, file); senza definizione salvata non la disabilita'
$usiProponi = @(& $chiamate 'ProponiDisabilita')
$ifProvaAvvii = @($ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.IfStatementAst] -and $n.Clauses[0].Item1.Extent.Text -eq '$prova' -and $n.ElseClause }, $true))
Check ($usiProponi.Count -eq 1 -and $ifProvaAvvii.Count -eq 1 -and (& $dentro $usiProponi[0] $ifProvaAvvii[0].ElseClause) -and $usiProponi[0].Extent.StartOffset -gt $oltreAdmin -and -not (& $dentro $usiProponi[0] $ifStato)) '   ProponiDisabilita chiamata solo da installa (ramo else di "if ($prova)"), dopo il controllo da amministratore'
$mostraAvvii = @(& $chiamate 'MostraAvvii')
$gia = (& $assegna '$gia')[0]
Check (@($mostraAvvii | Where-Object { (& $dentro $_ $ifStato) -and $_.Extent.Text -eq 'MostraAvvii $true' }).Count -eq 1) '   stato: MostraAvvii $true (le operazioni pianificate solo se attive)'
$attiveInstalla = @($ast.EndBlock.Statements | Where-Object { $_ -is [System.Management.Automation.Language.AssignmentStatementAst] -and $_.Extent.Text -eq '$attive = MostraAvvii' })
Check ($attiveInstalla.Count -eq 1 -and $attiveInstalla[0].Extent.StartOffset -gt $oltreAdmin -and $attiveInstalla[0].Extent.StartOffset -lt $gia.Extent.StartOffset) '   prova e installa: prima del controllo "servizi gia'' installati" (in cella i servizi ci sono)'

# 10. stato
Check (@(& $chiamate 'MostraProprietari' | Where-Object { & $dentro $_ $ifStato }).Count -eq 1 -and @(& $chiamate 'MostraEventi' | Where-Object { & $dentro $_ $ifStato }).Count -eq 1 -and $ifStato.Clauses[0].Item2.Extent.Text -match "'Pause'") '10. stato: proprietari delle porte e, per un servizio non Running (Paused), gli eventi nssm'
Check ($funzioni['MostraEventi'].Body.Extent.Text -match "ProviderName = 'nssm'" -and $funzioni['ServizioDelProcesso'].Body.Extent.Text -match 'Win32_Service' -and $funzioni['ServizioDelProcesso'].Body.Extent.Text -match 'ParentProcessId') '    eventi dal provider nssm; il servizio di un processo si trova risalendo i padri fino al processo del servizio'
Check (@($stopProcess + @(& $chiamate 'Stop-Service') + @(& $chiamate 'Start-Service') | Where-Object { & $dentro $_ $ifStato }).Count -eq 0) '    stato non avvia, non ferma e non chiude niente'

# 11. pannello compilato
$ifAggiorna = & $ramo '$Azione -eq ''aggiorna'''
$ifRipristina = & $ramo '$Azione -eq ''ripristina'''
Check ($null -ne $ifPreview -and $null -ne $ifAggiorna -and $null -ne $ifRipristina -and $null -ne $ifDev -and $testo -match "ValidateSet\('stato', 'prova', 'installa', 'riavvia', 'rimuovi', 'preview', 'aggiorna', 'ripristina', 'dev'\)") '11. azioni preview, aggiorna, ripristina e dev'
$parPreview = (& $assegna '$PAR_PREVIEW')[0]; $parDev = (& $assegna '$PAR_DEV')[0]
Check ($parPreview.Right.Extent.Text -eq "'node_modules\vite\bin\vite.js preview --port 5173 --strictPort'" -and $parDev.Right.Extent.Text -eq "'node_modules\vite\bin\vite.js'") '    parametri: preview sulla 5173 con --strictPort (porta di oggi), dev come prima'
Check ($funzioni['ComandiNssm'].Body.Extent.Text -match 'Nome = \$S_P; Par = \$PAR_DEV;') '    installa crea il pannello come prima, col server di sviluppo'
$compila = $funzioni['CompilaPannello']
Check ($null -ne $compila -and $compila.Body.Extent.Text -match '& \$node \$ViteJs build --outDir dist_build --emptyOutDir \*> \$LogBuild' -and $compila.Body.Extent.Text -notmatch '\$Dist\b' -and $compila.Body.Extent.Text -match "Join-Path \`$DistBuild 'index.html'") '    CompilaPannello: build in dist_build (log in build_pannello.log), non tocca dist, vuole index.html'
# in aggiorna e preview: la build fallita ferma tutto PRIMA di nssm e del riavvio
# (7/10) aggiorna riavvia backend e pannello (RiavviaServizi), preview il solo pannello
foreach ($coppia in @(@('aggiorna', $ifAggiorna, 'RiavviaServizi $ruota'), @('preview', $ifPreview, 'RiavviaPannello $ruota'))) {
	$t = $coppia[1].Clauses[0].Item2.Extent.Text
	$iBuild = $t.IndexOf('if (-not (CompilaPannello)) { Fermati'); $iNssm = $t.IndexOf('& $Nssm set'); $iRiavvio = $t.IndexOf($coppia[2])
	Check ($iBuild -ge 0 -and $iRiavvio -gt $iBuild -and ($iNssm -lt 0 -or ($iNssm -gt $iBuild -and $iNssm -lt $iRiavvio))) ('    ' + $coppia[0] + ': build fallita -> Fermati, prima di cambiare parametri e di riavviare; poi ' + $coppia[2])
}
Check ($ifAggiorna.Clauses[0].Item2.Extent.Text -notmatch 'RiavviaPannello' -and $ifAggiorna.Clauses[0].Item2.Extent.Text -match "if \(-not \(Servizio \`$S_B\)\) \{ Fermati") '    aggiorna: un comando dopo il git pull, riavvia anche il backend (che deve essere installato)'
Check ($ifAggiorna.Clauses[0].Item2.Extent.Text -match "if \(\`$modo -ne 'preview'\) \{ Fermati") '    aggiorna solo col pannello compilato'
Check ($ifPreview.Clauses[0].Item2.Extent.Text -match '& \$Nssm set \$S_P AppParameters \$PAR_PREVIEW' -and $ifDev.Clauses[0].Item2.Extent.Text -match '& \$Nssm set \$S_P AppParameters \$PAR_DEV' -and $ifDev.Clauses[0].Item2.Extent.Text -match 'RiavviaPannello\)') '    preview e dev: nssm set AppParameters del solo pannello, poi RiavviaPannello'
Check ($ifRipristina.Clauses[0].Item2.Extent.Text -match 'RiavviaPannello \$scambia' -and $ifRipristina.Clauses[0].Item2.Extent.Text -match "Join-Path \`$DistPrev 'index.html'") '    ripristina: solo con una dist_prev con index.html, scambio a pannello fermo'
$ruotaAst = (& $assegna '$ruota')[0]
$tr = $ruotaAst.Right.Extent.Text
Check ($tr.IndexOf('Remove-Item -LiteralPath $DistPrev') -ge 0 -and $tr.IndexOf('Remove-Item -LiteralPath $DistPrev') -lt $tr.IndexOf("Rename-Item -LiteralPath `$Dist -NewName 'dist_prev'") -and $tr.IndexOf("Rename-Item -LiteralPath `$Dist -NewName 'dist_prev'") -lt $tr.IndexOf("Rename-Item -LiteralPath `$DistBuild -NewName 'dist'")) '    $ruota: via la dist_prev vecchia, dist -> dist_prev, dist_build -> dist'
$tRiavviaP = $riavviaPannello.Body.Extent.Text
$iStopP = $tRiavviaP.IndexOf('Stop-Service -Name $S_P'); $iDaFermo = $tRiavviaP.IndexOf('& $daFermo'); $iStartP = $tRiavviaP.IndexOf('Start-Service -Name $S_P')
Check ($iStopP -ge 0 -and $iStopP -lt $iDaFermo -and $iDaFermo -lt $iStartP -and $tRiavviaP -match 'AspettaPorte 90 @\(5173\)' -and $tRiavviaP -match '\$_\.Servizio -eq \$S_P') '    RiavviaPannello: fermo, scambio delle dist, avvio; poi porta 5173 del servizio'
$soloPannello = @($ifPreview, $ifRipristina, $ifDev, $riavviaPannello, $compila)
Check (@(@(& $chiamate 'Stop-Service') + @(& $chiamate 'Start-Service') + @(& $chiamate 'RiavviaServizi') | Where-Object { $n1 = $_; @($soloPannello | Where-Object { & $dentro $n1 $_ }).Count -gt 0 -and $_.Extent.Text -notmatch '-Name \$S_P\b' }).Count -eq 0) '    preview, ripristina e dev fermano e avviano solo il pannello, mai il backend (solo aggiorna riavvia anche il backend)'
$gitignoreHmi = [IO.File]::ReadAllText((Join-Path (Split-Path $PSScriptRoot) 'HMI\.gitignore'))
Check ($gitignoreHmi -match '(?m)^dist_build\s*$' -and $gitignoreHmi -match '(?m)^dist_prev\s*$' -and $gitignoreHmi -match '(?m)^dist\s*$') '    dist, dist_build e dist_prev ignorate da git (easybox\HMI\.gitignore)'

Write-Host ''
Write-Host $(if ($script:falliti) { "$($script:falliti) CHECK FALLITI" } else { 'TUTTI I CHECK PASSATI' })
exit $script:falliti
