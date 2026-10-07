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
#   8. "riavvia": Stop-Service, porte libere, Start-Service, verifica
#      (Running e proprietari delle porte), uscita in errore altrimenti;
#      niente Restart-Service;
#   9. avvii automatici in sola lettura (nessuna scrittura su registro e
#      operazioni pianificate, nessun Remove-Item), segnalati da stato e da
#      prova / installa;
#  10. "stato": proprietari delle porte e motivo di un Paused dagli eventi nssm.
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
$primaDiProva = @($nssm | Where-Object { $_.Extent.StartOffset -lt $ifProva.Extent.EndOffset -and -not (& $dentro $_ $ifRimuovi) })
Check ($primaDiProva.Count -eq 0) '2. "prova" esce prima di qualunque esecuzione di nssm (prima della sua uscita solo il ramo rimuovi, che esce a sua volta)'
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
$stopInRiavvia = @(& $chiamate 'Stop-Service' | Where-Object { & $dentro $_ $ifRiavvia })
Check ($usiChiudi.Count -eq 1 -and (& $dentro $usiChiudi[0] $ifRiavvia) -and $stopInRiavvia.Count -eq 1 -and $stopInRiavvia[0].Extent.StartOffset -lt $usiChiudi[0].Extent.StartOffset) '   chiamata solo da "riavvia", dopo lo Stop-Service dei due servizi'

# 8. riavvia: l'ordine dei passi e l'uscita in errore
$pos = { param($chi) $c = @(& $chiamate $chi | Where-Object { & $dentro $_ $ifRiavvia }); if ($c.Count) { $c[0].Extent.StartOffset } else { -1 } }
$oStop = & $pos 'Stop-Service'; $oLibere = & $pos 'AspettaPorteLibere'; $oStart = & $pos 'Start-Service'; $oPorte = & $pos 'AspettaPorte'
$verifica = @(& $chiamate 'MostraProprietari' | Where-Object { (& $dentro $_ $ifRiavvia) -and $_.Extent.StartOffset -gt $oStart })
Check ($oStop -ge 0 -and $oStop -lt $oLibere -and $oLibere -lt $oStart -and $oStart -lt $oPorte -and $verifica.Count -ge 1) '8. riavvia: Stop-Service, AspettaPorteLibere, Start-Service, AspettaPorte, poi MostraProprietari'
$ultimoFermati = @(& $chiamate 'Fermati' | Where-Object { (& $dentro $_ $ifRiavvia) -and $_.Extent.StartOffset -gt $verifica[0].Extent.StartOffset })
Check ($ultimoFermati.Count -ge 1 -and $ifRiavvia.Clauses[0].Item2.Extent.Text -match "if \(-not \`$ok\) \{[\s\S]*?Fermati") '   dopo la verifica: Fermati (exit 1) se non tutto Running o porte non dei servizi'
Check ((& $chiamate 'Restart-Service').Count -eq 0) '   nessun Restart-Service (non aspetta le porte ne'' chiude i node rimasti)'

# 9. avvii automatici in sola lettura
$scrive = @('Remove-Item', 'Remove-ItemProperty', 'Set-ItemProperty', 'New-ItemProperty', 'Unregister-ScheduledTask', 'Disable-ScheduledTask', 'Stop-ScheduledTask', 'Set-ScheduledTask')
$scritture = @($comandi | Where-Object { $scrive -contains (& $nome $_) })
Check ($scritture.Count -eq 0) ('9. nessuna scrittura su registro, Esecuzione automatica o operazioni pianificate (' + (($scritture | ForEach-Object { & $nome $_ }) -join ', ') + ')')
$avvii = $funzioni['AvviiAutomatici']
Check ($null -ne $avvii -and $avvii.Body.Extent.Text -match 'Start Menu\\Programs\\StartUp' -and $avvii.Body.Extent.Text -match 'CurrentVersion\\Run' -and $avvii.Body.Extent.Text -match 'Get-ScheduledTask') '   AvviiAutomatici guarda Esecuzione automatica, chiavi Run e operazioni pianificate'
$mostraAvvii = @(& $chiamate 'MostraAvvii')
Check (@($mostraAvvii | Where-Object { & $dentro $_ $ifStato }).Count -eq 1 -and @($mostraAvvii | Where-Object { $_.Extent.StartOffset -gt $oltreAdmin -and $_.Extent.StartOffset -lt $ifProva.Extent.StartOffset -and -not (& $dentro $_ $ifRiavvia) -and -not (& $dentro $_ $ifRimuovi) }).Count -eq 1) '   segnalati da "stato" e, prima del ramo "prova", da prova e installa'

# 10. stato
Check (@(& $chiamate 'MostraProprietari' | Where-Object { & $dentro $_ $ifStato }).Count -eq 1 -and @(& $chiamate 'MostraEventi' | Where-Object { & $dentro $_ $ifStato }).Count -eq 1 -and $ifStato.Clauses[0].Item2.Extent.Text -match "'Pause'") '10. stato: proprietari delle porte e, per un servizio non Running (Paused), gli eventi nssm'
Check ($funzioni['MostraEventi'].Body.Extent.Text -match "ProviderName = 'nssm'" -and $funzioni['ServizioDelProcesso'].Body.Extent.Text -match 'Win32_Service' -and $funzioni['ServizioDelProcesso'].Body.Extent.Text -match 'ParentProcessId') '    eventi dal provider nssm; il servizio di un processo si trova risalendo i padri fino al processo del servizio'
Check (@($stopProcess + @(& $chiamate 'Stop-Service') + @(& $chiamate 'Start-Service') | Where-Object { & $dentro $_ $ifStato }).Count -eq 0) '    stato non avvia, non ferma e non chiude niente'

Write-Host ''
Write-Host $(if ($script:falliti) { "$($script:falliti) CHECK FALLITI" } else { 'TUTTI I CHECK PASSATI' })
exit $script:falliti
