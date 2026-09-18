# Lavori in coda — difetti noti tenuti fuori dal cantiere corrente

> Questo file NON e' una lista di desideri. Ci sta solo cio' che e' stato
> verificato nel codice, con il conteggio reale e il motivo per cui non e'
> stato corretto sul momento. Gli interventi manuali da fare in impianto
> stanno invece in `APPUNTI-CELLA.md`.

## [ ] Stato tasche in QoS 0: una radice di topic separata lato PLC

**Cosa.** Dal 18/9 la subscribe e' `FROM_PLANT/#` in **QoS 0** (prima QoS 2):
in QoS 2 mqtt.js teneva ogni pacchetto in arrivo nel suo `incomingStore` in
memoria fino alla stretta di mano a quattro passaggi, ed era una delle
strutture che crescevano nel crash per out of memory.

**Il rischio che resta.** Quasi tutto cio' che arriva su `FROM_PLANT/#` e'
stato pubblicato ON-CHANGE e ricostruibile col refresh 90 — marca, ausiliari,
stati unita', dispatcher, DECLARE. **Tranne `FROM_PLANT/PART/#`**, lo stato
delle tasche: il 90 non ripubblica il contenuto dei cassetti. Un messaggio
perso li' lascia la tasca allo stato vecchio, e da quando la chiusura
dell'ordine si appoggia al conteggio dei finiti (`setPositionStatus`),
l'ordine non si chiude.

**Perche' non e' stato corretto sul momento.** Per tenere quel solo topic in
QoS 2 serve una seconda `subscribe` che si SOVRAPPONE a `FROM_PLANT/#`, e
mosquitto su sottoscrizioni sovrapposte puo' consegnare lo stesso messaggio
due volte. I doppioni non farebbero danni (le scritture sono idempotenti:
`UPDATE POSITION SET STATUS`, e la chiusura ordine e' protetta da
`AND STATUS = 3`), ma raddoppierebbero il traffico su quel topic e le righe
di diario. Rischio accettato da Dario il 18/9.

**Come si chiude.** Chiedere al PLC una radice di topic separata per le
tasche (es. `FROM_PLANT_PART/#`), cosi' le due subscribe non si sovrappongono
e quella sola resta in QoS 2. Serve una modifica lato PLC, quindi non e' un
lavoro solo di pannello.

**Come ci si accorge che e' successo.** Una tasca ferma a grezzo con il pezzo
gia' lavorato, o un ordine a `PRODUCTED` uguale a `QUANTITY` che resta in
lavorazione.

## [ ] `dataStored.userLevel<0`: vincoli di sola lettura che non bloccano niente

**Cosa.** Nei form compare `:readonly="dataStored.userLevel<0"`. Il livello
utente vale 0, 1 o 2 e non e' mai negativo, quindi l'espressione e' sempre
falsa e il campo resta sempre modificabile. Dove l'idioma e' usato per
`:disabled` su un bottone, vale lo stesso: il bottone non si disabilita mai.

**Quanto.** 44 occorrenze in tutto, ma solo 14 sono raggiungibili dal router
attivo. Le altre stanno in file morti e non vanno toccate.

| File | Occorrenze | Stato |
|---|---|---|
| `views/conf/Grating/Grating.vue` | 9 | vivo, rotta `/conf/Grating/:grating_ID` |
| `views/conf/Grating/ImportGrating.vue` | 4 | vivo, rotta `/conf/importGrating`, gia' marcato legacy |
| `views/conf/Fixture/FixtureOnPallet.vue` | 1 | vivo, rotta `/conf/FixtureOnPallet` |
| `views/conf/Grating/GratingTest.vue` | 10 | rotta RIMOSSA l'1/9, file non raggiungibile |
| `views/conf/Grating/old/Grating1.vue` | 10 | morto |
| `views/conf/Grating/old/GratingTestORIGI.vue` | 10 | morto |

**Perche' conta.** Sono i form del grigliato e dell'attrezzatura su pallet,
cioe' dati che finiscono nelle coordinate lette dal robot. Chi ha scritto quei
binding voleva un vincolo e ha creduto di averlo messo.

**Perche' NON e' una sostituzione meccanica.** Rimpiazzare `<0` con `>=1`
accenderebbe di colpo 14 vincoli veri, e da domani l'operatore di livello 0 non
potrebbe piu' modificare campi che oggi modifica tutti i giorni. La soglia va
decisa campo per campo con chi usa il pannello, non dedotta dal codice. Per
questo il lavoro e' separato: la parte tecnica e' banale, la parte che conta e'
la decisione su chi puo' toccare cosa.

**Trovato il** 2026-09-15, durante la proposta della pagina di simulazione
della spinta in battuta.

## [ ] Bersagli touch sotto il minimo, e viste non responsive

**Cosa.** La classe base `.pure-button` (`HMI/src/assets/pure.css`) dichiara
`padding: .5em 1em` e nessun `min-height`: l'altezza risultante sta intorno ai
30 px, contro i 44 raccomandati per il tocco. La usano 46 file `.vue`.

**Perche' conta adesso.** Finche' il pannello girava solo sul touch fisso della
cella, appoggiato e sempre alla stessa distanza, era un fastidio. Dal momento
in cui si usa un tablet **portato in giro intorno alla cella**, in piedi e in
movimento, sbagliare bersaglio diventa normale.

**Nella stessa famiglia**, tutto censito il 15/9 e descritto in
`PWA-TABLET.md`: disegni a dimensione fissa in `views/layoutView.vue`, due
anteprime 3D a 360x360 in `conf/Vice/Vice.vue` e `conf/Gripper/Gripper.vue`,
la tabella cassetti a 16 colonne, 6 viste responsive su 25, e 62 regole
`:hover` che sul touch non hanno senso.

**Perche' NON e' una sostituzione meccanica.** Alzare `.pure-button` a 44 px
sposta il layout di ogni pagina che la usa, comprese quelle dense di comandi
che oggi entrano in una schermata. Va fatto guardando le pagine, non con una
regola globale.

**Trovato il** 2026-09-15, aggiungendo il supporto PWA per il tablet.
