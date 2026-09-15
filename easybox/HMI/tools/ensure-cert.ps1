# ===========================================================================
# ensure-cert.ps1 — certificato del pannello per HTTPS (cantiere pwa-https)
#
# SCOPO: il tablet arriva per indirizzo IP, e Chrome installa una PWA solo da
# contesto sicuro. Serve HTTPS. Questo script prepara tutto senza che sul PC
# impianto vada installato niente: usa i comandi che Windows ha gia'.
#
# COSA FA, in ordine:
#   1. crea UNA VOLTA una CA locale da 10 anni (ca.pfx con la chiave, ca.crt
#      da installare sui dispositivi);
#   2. crea il certificato del pannello firmato da quella CA, con dentro gli
#      indirizzi IP della macchina, il nome host e localhost;
#   3. lo RIGENERA da solo quando mancano meno di 30 giorni alla scadenza, o
#      quando gli indirizzi della macchina sono cambiati;
#   4. mette la CA fra quelle fidate dell'utente corrente, cosi' anche il
#      Chrome del touch di cella si fida di https://localhost.
#
# PERCHE' RIGENERARE IL SOLO CERTIFICATO DEL PANNELLO: e' firmato dalla stessa
# CA, e i dispositivi si fidano della CA. Quindi il rinnovo NON richiede di
# ritoccare i tablet. La CA scade fra dieci anni.
#
# INDIRIZZI IP NEL CERTIFICATO: Chrome pretende che un indirizzo IP stia nel
# campo SAN come iPAddress, non come nome DNS. Per questo il SAN e' scritto a
# mano con IPAddress=..., invece di usare -DnsName che scriverebbe l'IP come
# se fosse un nome.
#
# VIA DI RITORNO: con HMI_HTTP_ONLY=1 questo script non fa niente e Vite resta
# in HTTP (vedi vite.config.js e APPUNTI-CELLA.md).
#
# USO:   powershell -ExecutionPolicy Bypass -File tools\ensure-cert.ps1
#        npm run cert
# ===========================================================================
[CmdletBinding()]
param(
    # nomi host da mettere nel certificato oltre a quello della macchina: se
    # un domani si usera' un nome al posto dell'IP, il certificato lo copre
    # gia' e non si rifa' il giro sui dispositivi
    [string[]]$ExtraDns = @('easybox', 'cella'),
    [int]$RenewDays = 30,
    # salta l'inserimento fra le CA fidate (serve solo per provare lo script
    # su una macchina che non e' il PC impianto)
    [switch]$NoTrust,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

if ($env:HMI_HTTP_ONLY -eq '1') {
    Write-Host "HMI_HTTP_ONLY=1: si resta in HTTP, nessun certificato preparato."
    exit 0
}

$certDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'certs'
if (-not (Test-Path $certDir)) { New-Item -ItemType Directory -Path $certDir | Out-Null }

$caPfx    = Join-Path $certDir 'ca.pfx'
$caCrt    = Join-Path $certDir 'ca.crt'
$caPem    = Join-Path $certDir 'ca.pem'
$panelPfx = Join-Path $certDir 'panel.pfx'
$panelPass= Join-Path $certDir 'panel.pass'
$sanFile  = Join-Path $certDir 'san.txt'

# password locale del file pfx: serve solo perche' il formato la richiede, e
# sta accanto al file. Chi puo' leggere la cartella puo' leggere la chiave in
# ogni caso: la protezione qui e' l'accesso al PC, non la password.
function Get-OrCreatePassword {
    if (-not (Test-Path $panelPass)) {
        $bytes = New-Object byte[] 24
        [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
        [Convert]::ToBase64String($bytes) | Set-Content -Path $panelPass -Encoding ASCII -NoNewline
    }
    return (Get-Content -Path $panelPass -Raw).Trim()
}

# ---------------------------------------------------------------- indirizzi
function Get-LocalIPv4 {
    $ips = @()
    try {
        $ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
               Where-Object { $_.IPAddress -notlike '169.254.*' -and $_.IPAddress -ne '127.0.0.1' } |
               Select-Object -ExpandProperty IPAddress
    } catch {
        # Windows piu' vecchi: si ripiega sulla risoluzione del nome host
        $ips = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
               Where-Object { $_.AddressFamily -eq 'InterNetwork' } |
               ForEach-Object { $_.IPAddressToString }
    }
    return @($ips | Sort-Object -Unique)
}

$ips   = @(Get-LocalIPv4) + @('127.0.0.1')
$names = @('localhost', $env:COMPUTERNAME) + $ExtraDns
$ips   = @($ips   | Where-Object { $_ } | Sort-Object -Unique)
$names = @($names | Where-Object { $_ } | Sort-Object -Unique)

$sanParts = @()
foreach ($n in $names) { $sanParts += "DNS=$n" }
foreach ($i in $ips)   { $sanParts += "IPAddress=$i" }
$san = $sanParts -join '&'

# --------------------------------------------------------------------- CA
function New-LocalCa {
    Write-Host "Creo la CA locale (10 anni)..."
    $ca = New-SelfSignedCertificate `
        -Type Custom `
        -Subject 'CN=EasyBox Local CA, O=ADMG' `
        -KeyUsage CertSign, CRLSign, DigitalSignature `
        -KeyLength 2048 `
        -KeyAlgorithm RSA `
        -HashAlgorithm SHA256 `
        -KeyExportPolicy Exportable `
        -NotAfter (Get-Date).AddYears(10) `
        -CertStoreLocation 'Cert:\CurrentUser\My' `
        -TextExtension @('2.5.29.19={text}CA=true&pathlength=0')

    $pwd = ConvertTo-SecureString -String (Get-OrCreatePassword) -AsPlainText -Force
    Export-PfxCertificate -Cert $ca -FilePath $caPfx -Password $pwd | Out-Null
    Export-Certificate  -Cert $ca -FilePath $caCrt -Type CERT | Out-Null
    Remove-Item -Path ("Cert:\CurrentUser\My\" + $ca.Thumbprint) -Force
    Write-Host "  CA creata, scade il $($ca.NotAfter.ToString('yyyy-MM-dd'))"
}

if (-not (Test-Path $caPfx) -or -not (Test-Path $caCrt)) { New-LocalCa }

# ca.pem: la stessa CA in Base64. Android si installa il .crt in DER, ma i
# programmi che verificano la catena (node, curl su Linux, openssl) vogliono
# il PEM. Averli tutti e due evita conversioni a mano quando si controlla.
if (-not (Test-Path $caPem)) {
    $caObj = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 -ArgumentList $caCrt
    $b64 = [Convert]::ToBase64String($caObj.RawData, 'InsertLineBreaks')
    "-----BEGIN CERTIFICATE-----`n$b64`n-----END CERTIFICATE-----" | Set-Content -Path $caPem -Encoding ASCII
    Write-Host "  ca.pem scritto (stessa CA, formato testo)"
}

# ------------------------------------------------- serve rigenerare il pannello?
$need = $Force.IsPresent
$why  = 'richiesto con -Force'

if (-not $need -and -not (Test-Path $panelPfx)) { $need = $true; $why = 'non esiste ancora' }

if (-not $need) {
    $pwd = ConvertTo-SecureString -String (Get-OrCreatePassword) -AsPlainText -Force
    $cur = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 `
           -ArgumentList $panelPfx, (Get-OrCreatePassword), 'Exportable'
    $giorni = [int]([math]::Floor(($cur.NotAfter - (Get-Date)).TotalDays))
    if ($giorni -lt $RenewDays) { $need = $true; $why = "scade fra $giorni giorni" }
    elseif ((Test-Path $sanFile) -and ((Get-Content $sanFile -Raw).Trim() -ne $san)) {
        $need = $true; $why = 'gli indirizzi della macchina sono cambiati'
    }
    else { Write-Host "Certificato valido ancora $giorni giorni: niente da fare." }
}

# ------------------------------------------------- certificato del pannello
if ($need) {
    Write-Host "Rigenero il certificato del pannello ($why)..."
    $pwdPlain = Get-OrCreatePassword
    $pwd = ConvertTo-SecureString -String $pwdPlain -AsPlainText -Force

    # la CA viene rimessa nello store il tempo di firmare, poi tolta: cosi' lo
    # store non si riempie di certificati a ogni rinnovo
    $caIn = Import-PfxCertificate -FilePath $caPfx -CertStoreLocation 'Cert:\CurrentUser\My' -Password $pwd -Exportable
    try {
        $panel = New-SelfSignedCertificate `
            -Type SSLServerAuthentication `
            -Subject "CN=$($env:COMPUTERNAME), O=ADMG EasyBox" `
            -KeyLength 2048 `
            -KeyAlgorithm RSA `
            -HashAlgorithm SHA256 `
            -KeyExportPolicy Exportable `
            -NotAfter (Get-Date).AddYears(2) `
            -CertStoreLocation 'Cert:\CurrentUser\My' `
            -Signer $caIn `
            -TextExtension @(
                "2.5.29.17={text}$san",
                '2.5.29.37={text}1.3.6.1.5.5.7.3.1'
            )

        Export-PfxCertificate -Cert $panel -FilePath $panelPfx -Password $pwd | Out-Null
        $san | Set-Content -Path $sanFile -Encoding ASCII -NoNewline
        Remove-Item -Path ("Cert:\CurrentUser\My\" + $panel.Thumbprint) -Force
        Write-Host "  scade il $($panel.NotAfter.ToString('yyyy-MM-dd'))"
        Write-Host "  vale per: $($names -join ', ') / $($ips -join ', ')"
    }
    finally {
        Remove-Item -Path ("Cert:\CurrentUser\My\" + $caIn.Thumbprint) -Force -ErrorAction SilentlyContinue
    }
}

# ------------------------------------------------------------- CA fidata qui
# Senza questo passo il Chrome del TOUCH DI CELLA, che apre https://localhost,
# mostrerebbe l'avviso di certificato e la PWA installata smetterebbe di
# aprirsi. Va nello store dell'utente corrente: non serve l'amministratore.
if (-not $NoTrust) {
    $ca = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 -ArgumentList $caCrt
    $gia = Get-ChildItem -Path 'Cert:\CurrentUser\Root' | Where-Object { $_.Thumbprint -eq $ca.Thumbprint }
    if (-not $gia) {
        Import-Certificate -FilePath $caCrt -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null
        Write-Host "CA aggiunta fra quelle fidate di questo utente."
    } else {
        Write-Host "CA gia' fidata su questa macchina."
    }
}

Write-Host "Pronto. Certificati in: $certDir"
