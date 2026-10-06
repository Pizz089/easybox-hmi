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
#   5. solo ASCII.
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

# 5. ASCII
$byte = [IO.File]::ReadAllBytes($file)
Check (@($byte | Where-Object { $_ -ge 128 }).Count -eq 0) '5. solo ASCII'

Write-Host ''
Write-Host $(if ($script:falliti) { "$($script:falliti) CHECK FALLITI" } else { 'TUTTI I CHECK PASSATI' })
exit $script:falliti
