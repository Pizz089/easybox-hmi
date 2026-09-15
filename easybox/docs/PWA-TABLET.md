# Pannello su tablet Android come app (PWA)

Obiettivo: usare il pannello da un tablet portato in giro intorno alla cella,
a schermo intero, senza barra del browser sopra e senza barra di navigazione
Android sotto.

## Cosa c'e' nel repo

| File | Cosa fa |
|---|---|
| `HMI/public/manifest.webmanifest` | dichiara nome, icone, `display: fullscreen`, `orientation: landscape` |
| `HMI/index.html` | collega il manifest, dichiara `theme-color` e `viewport-fit=cover` |
| `HMI/public/pwa-192.png`, `pwa-512.png` | icone richieste da Chrome per poter installare |
| `HMI/public/pwa-maskable-512.png` | icona `maskable`: Android la ritaglia nella forma del suo lanciatore |
| `HMI/tools/make-pwa-icons.mjs` | rigenera le tre icone dal logo, senza dipendenze |

`display: fullscreen` e non `standalone` perche' standalone lascia la barra di
stato di Android in cima. `orientation: landscape` e non `landscape-primary`
cosi' il tablet si puo' girare di 180 gradi e l'immagine segue: chi lo tiene in
mano lo rovescia senza accorgersene.

Le icone sono su **fondo scuro** (`#0b0f14`, lo stesso `--bg` del tema scuro
del pannello) perche' il logo e' bianco con un segno rosso su trasparente: su
fondo bianco la scritta sparirebbe. Il logo attuale e' `src/assets/logo.png`;
per sostituirlo basta rimpiazzare quel file e rilanciare
`node tools/make-pwa-icons.mjs` dalla cartella `HMI`.

## Il punto che decide tutto: contesto sicuro

**Chrome installa una PWA solo da un contesto sicuro: `https`, oppure
`localhost`.**

**Sul touch di cella e' gia' risolto** (verificato il 15/9): il pannello si
apre da `localhost`, che Chrome considera sicuro anche in HTTP, quindi la PWA
si installa e va a schermo intero senza altro lavoro.

**Resta il tablet**, che arriva per indirizzo IP e quindi non ha contesto
sicuro. Li' il manifest viene letto e le icone pure, ma la voce "Installa app"
non compare, e `display: fullscreen` **non ha alcun effetto in una scheda
normale**. "Aggiungi a schermata Home" da un'origine non sicura crea una
semplice scorciatoia che riapre il browser con le sue barre.

Decisione presa: **niente app di terze parti sul tablet**, quindi la strada del
browser kiosk e' esclusa. Si e' fatto HTTPS, ed e' descritto qui sotto.

### Passo gia' fatto: origine singola

Il pannello viveva su **tre origini**: la pagina sulla 5173, le chiamate dati
sulla 8080, il socket sulla 3000. Con tre origini in chiaro, una pagina servita
in HTTPS vedrebbe dati e socket **bloccati dal browser come contenuto misto**,
e il pannello smetterebbe di funzionare: il certificato da solo non sarebbe
bastato, avrebbe rotto tutto.

Adesso il browser parla solo con l'origine da cui e' stato caricato, e Vite
gira le chiamate al backend su `127.0.0.1` (`server.proxy` in
`vite.config.js`, indirizzo relativo in `src/data.js`). E' un miglioramento a
se' — una porta sola verso la rete di cella invece di tre — ed e' la
condizione perche' accendere HTTPS domani sia solo il certificato.

Il backend **non e' cambiato** e continua ad ascoltare dove ascoltava. Le sue
porte restano raggiungibili dalla rete: chiuderle a `127.0.0.1` e' un
intervento possibile in seguito, da valutare verificando prima che nessun altro
le usi.

### Passo fatto: HTTPS

Il certificato lo prepara `HMI/tools/ensure-cert.ps1`, che usa i comandi che
Windows ha gia': niente da installare sul PC impianto.

| Cosa | Dove |
|---|---|
| CA locale, dieci anni | `HMI/certs/ca.pfx` (chiave) e `ca.crt` (da installare sui dispositivi) |
| Certificato del pannello, due anni | `HMI/certs/panel.pfx`, letto da `vite.config.js` |
| Rinnovo | automatico sotto i 30 giorni, firmato dalla STESSA CA |
| Via di ritorno | `HMI_HTTP_ONLY=1`, vedi `APPUNTI-CELLA.md` |

Nel certificato ci sono **gli indirizzi IP della macchina**, `localhost`, il
nome del computer e i nomi `easybox` e `cella`: se un domani si usera' un nome
al posto dell'IP, il certificato lo copre gia' e non si rifa' il giro sui
dispositivi. Gli IP stanno nel campo SAN come indirizzi e non come nomi, che e'
la forma che Chrome pretende.

Il rinnovo rigenera **solo il certificato del pannello**, non la CA: i
dispositivi si fidano della CA, quindi non vanno ritoccati. La CA scade nel
2036.

Scartato il certificato pubblico (Let's Encrypt): il rinnovo ogni novanta
giorni vuole Internet in uscita, che qui non e' garantito.

### Da aggiungere a start_hmi.bat

Una riga prima dell'avvio di Vite, piu' una commentata che serve solo come via
di ritorno:

```
rem set HMI_HTTP_ONLY=1
call npm run cert
```

### Aggiungere un tablet: sei passi

Una volta per dispositivo. Il primo passo usa l'indirizzo del **backend**, che
resta in chiaro apposta: il tablet deve poter prendere la CA prima di fidarsi
di qualcosa.

1. Sul tablet, aprire `http://<ip-pc-cella>:8080/ca.crt`. Il file viene
   scaricato.
2. Impostazioni, Sicurezza, Altre impostazioni di sicurezza, Installa dalla
   memoria, Certificato CA. Il percorso cambia un po' fra Android stock e
   Samsung: la voce da cercare e' sempre *Installa certificato*.
3. Android avvisa che la rete potrebbe essere monitorata: accettare. Resta una
   notifica permanente, ed e' normale.
4. Scegliere il file scaricato al passo 1 e confermare.
5. Aprire `https://<ip-pc-cella>:5173`. Il lucchetto deve essere chiuso: se
   compare un avviso, la CA non e' stata installata o l'indirizzo non e' quello
   del certificato.
6. Menu di Chrome, **Installa app**. L'icona compare fra le app e si apre a
   schermo intero, orizzontale.

Se al passo 6 la voce non compare, il motivo e' quasi sempre il passo 5: senza
lucchetto chiuso non c'e' contesto sicuro e Chrome non offre l'installazione.

## Verifiche gia' fatte

Sul proxy, con un finto backend sulle due porte, da **tutti e due i percorsi di
accesso** (sono diversi e sistemarne uno poteva rompere l'altro):

- da `localhost` e da indirizzo IP: pagina, chiamate dati e socket rispondono
  allo stesso modo, e il socket si collega davvero (il banner "in attesa di
  connessione" sparisce);
- le chiamate dati partono relative, nel browser non compare piu' nessun
  indirizzo con le vecchie porte.

**Difetto trovato e corretto in questa prova:** con la chiave del proxy scritta
come prefisso (`/socket.io`), Vite girava al backend anche `/socket.io.min.js`,
cioe' la **libreria client** che sta in `public/`. Tornava 503, `io` restava
indefinito e il pannello perdeva la connessione viva. Le chiavi del proxy sono
percio' espressioni regolari con la barra finale (`^/socket\.io/`), e
`test_single_origin.mjs` verifica proprio che la libreria non venga girata.

Sul manifest, interrogando l'indirizzo di rete e non `localhost`:

- `manifest.webmanifest` servito con tipo MIME `application/manifest+json`,
  che e' quello giusto. **Nessuna modifica a `vite.config.js` e' necessaria**:
  Vite serve `public/` cosi' com'e' e riconosce l'estensione.
- `start_url` e `scope` valgono `"."`, e da `http://<ip>:5173/manifest.webmanifest`
  si risolvono in `http://<ip>:5173/`. Funzionano quindi con qualunque
  indirizzo e porta, senza niente di scritto a mano nel manifest.
- Le tre icone si risolvono e si scaricano dallo stesso indirizzo.
- `npm run build` copia manifest e icone in `dist/`, e il link nel
  `dist/index.html` resta corretto.

Una nota su Vite 7: il controllo `server.allowedHosts` lascia passare gli
indirizzi IP, e infatti la prova dall'IP di rete risponde 200. Se un domani il
tablet puntasse a un **nome host** (`http://cella-rizzo:5173`) invece che
all'IP, allora servirebbe aggiungere quel nome in `server.allowedHosts`.

## Niente service worker, di proposito

Una PWA puo' avere un service worker per funzionare offline. Qui non c'e', e
non e' una dimenticanza: il pannello vive di dati della cella in tempo reale,
offline non servirebbe a niente, e un service worker che mette in cache gli
asset in un impianto che gira in **modalita' sviluppo con HMR** produrrebbe
schermate vecchie difficili da spiegare. Se Chrome sul tablet dovesse chiedere
un service worker per offrire l'installazione (il requisito e' cambiato piu'
volte fra le versioni), e' la prima cosa da verificare prima di aggiungerne
uno: si scrive in poche righe, ma va disattivato in sviluppo.

## Ergonomia su tablet tenuto in mano

Censimento fatto il 2026-09-15, **senza correggere niente**. Vedi anche
`LAVORI-IN-CODA.md`.

| Punto | Dove | Perche' da' fastidio in mano |
|---|---|---|
| Bottoni sotto il minimo touch | `assets/pure.css`, classe base `.pure-button`: `padding: .5em 1em`, nessun `min-height`. 46 file usano quella classe | l'altezza risulta intorno ai 30 px contro i 44 raccomandati; in piedi e in movimento si sbaglia bersaglio |
| Disegni a dimensione fissa | `views/layoutView.vue` (SVG 480x360 e 480x100) | non si adattano alla larghezza: su schermo stretto tagliano o lasciano vuoti |
| Anteprime 3D fisse | canvas 360x360 in `conf/Vice/Vice.vue` e `conf/Gripper/Gripper.vue` | oltre alla dimensione fissa, Babylon su un tablet consuma batteria e scalda |
| Tabella cassetti molto larga | `conf/TraysView.vue`, 16 colonne | scorrimento orizzontale continuo |
| Poche viste responsive | 6 viste su 25 hanno una `@media` | il resto e' pensato per il touch fisso della cella, che ha una sola dimensione |
| Effetti legati a `:hover` | 62 regole `:hover` | sul touch lo stato hover non esiste o resta appiccicato dopo il tocco |

Nessuno di questi impedisce l'uso: sono fastidi, e il primo della lista e'
quello che si sente di piu'. I componenti aggiunti di recente (campo numerico,
sezioni della morsa, pagina di simulazione della spinta) hanno gia' i bersagli
a 44 px.
