# Lavori in coda — difetti noti tenuti fuori dal cantiere corrente

> Questo file NON e' una lista di desideri. Ci sta solo cio' che e' stato
> verificato nel codice, con il conteggio reale e il motivo per cui non e'
> stato corretto sul momento. Gli interventi manuali da fare in impianto
> stanno invece in `APPUNTI-CELLA.md`.

## [ ] COORDINATES_Z_MC: quote del pezzo e dell'attrezzatura senza ISNULL

**Cosa.** Nella vista `COORDINATES_Z_MC` (versionata il 6/10 in
`serverDati/scripts/coordinates-z-mc.sql`) entrano senza `ISNULL` tre colonne
che nello schema ammettono NULL:
- `PIECE.Z_PICK`, in `Z_PLACE_MC` (deposito del grezzo);
- `PIECE.Z_PLACE`, in `Z_PICK_MC` (prelievo del finito);
- `FIXTURE.Z`, in tutte e due.

Le altre componenti: `POSITION.Z` e' NOT NULL; `VICE.Z_CLAW` e
`VICE.Z_SINK_CLAW` hanno gia' `ISNULL`. Le chiavi dell'ordine
(`WORKORDER.PIECE_ID`, `FIXTURE_ID`, `MACHINE_ID`) se NULL tolgono la riga,
perche' i join sono interni; `WORKORDER.PALLET_ID` NULL invece non trova la
morsa e le chele entrano come 0.

**Perche' conta.** Il ponte SQL non converte NULL in zero: un NULL arriva al
PLC come numero casuale sulla Z di deposito o di prelievo, e al 30 non c'e'
nessun controllo di plausibilita' sulla Z.

**Da valutare.** Escludere la riga quando una di quelle colonne e' NULL (il
PLC riceve zero righe e da' l'allarme 799/899) invece di `ISNULL` a 0, che
darebbe una Z sbagliata ma credibile.

**Prima di decidere**, in cella, la query che conta pezzi e ordini con quelle
colonne NULL (sola lettura):

```
-- pezzi con quota di presa o di rilascio NULL
SELECT ID, FAMILY, Z_PICK, Z_PLACE FROM PIECE WHERE Z_PICK IS NULL OR Z_PLACE IS NULL;
-- attrezzature con Z NULL
SELECT ID, FAMILY, Z FROM FIXTURE WHERE Z IS NULL;
-- ordini che la vista legge con una quota NULL, per stato
SELECT w.STATUS, COUNT(*) AS ordini
  FROM COORDINATES_Z_MC z JOIN WORKORDER w ON w.ID = z.ORDER_ID
 WHERE z.Z_PLACE_MC IS NULL OR z.Z_PICK_MC IS NULL
 GROUP BY w.STATUS;
-- ordini senza pallet (la morsa non si trova, chele a 0)
SELECT ID, STATUS FROM WORKORDER WHERE PALLET_ID IS NULL;
```

Sul clone del portatile (backup della cella del 6/10, 17:47): 0 pezzi, 0
attrezzature, 0 ordini senza pallet, 0 righe della vista con una quota NULL
(7 pezzi e un solo ordine in tutto).

**Trovato il** 2026-10-06, versionando la vista per la quota Z della spinta.

## [ ] FB_Robot: il commento "lo decide la vista, non il PLC" non vale piu'

**Cosa.** Negli stati 1418 (scambio), 39 di Part_Robot_to_MC e 39 di
Part_MC_to_Robot, sopra le righe che scrivono `Part_Length_mm` e
`Part_Height_mm`, il commento dice ancora che quale colonna di PIECE diventa
lunghezza e quale altezza "lo decide la vista COORDINATES_BLOW_MC, non il
PLC". Dal 6/10 (d89b2de) X e Y si incrociano nel PLC: `Part_Width_mm` :=
col[3] (PIECE.X), `Part_Length_mm` := col[1] (PIECE.Y).

**Perche' non e' stato corretto sul momento.** E' un commento nel PLC: si
cambia in TIA e va scaricato.

**Come si chiude.** Alla prossima finestra di download: riscrivere il
commento nei tre stati (la mappa e' nell'intestazione di
`serverDati/scripts/coordinates-blow-mc.sql`), poi tia-export e commit.

**Trovato il** 2026-10-06, nell'export dopo lo scambio di X e Y.

## [ ] Misure del pezzo al robot: verificare la mappa con X > Y e con un cilindro

**Cosa.** La mappa del 6/10 (`Part_Width_mm` = PIECE.X, `Part_Length_mm` =
PIECE.Y, `Part_Height_mm` = PIECE.Z) e' stata riscontrata in cella con un
solo pezzo, il 1035 (X 40, Y 109, Z 15), che ha X < Y.

**Ipotesi da falsificare.** Il robot vuole la misura per ASSE (Length = lungo
le chele = PIECE.Y), non il lato piu' lungo. Col 1035 le due letture danno lo
stesso risultato, perche' il lato lungo le chele e' anche il piu' lungo.

**Come si chiude.** Col primo pezzo con X > Y e col primo cilindro (X = D):
guardare cosa fa il robot con le misure che riceve (%QW636, %QW640, %QW642).
Se con X > Y vuole ancora Length = PIECE.Y, la mappa e' per asse e resta; se
vuole il lato piu' lungo, va rivista.

**Trovato il** 2026-10-06.

## [ ] Etichette L/W/H della pagina Pezzo e nomi delle misure del robot

**Cosa.** Nella pagina Pezzo X e' etichettata L (D se cilindro), Y W e Z H;
il robot riceve `Part_Width_mm` = PIECE.X e `Part_Length_mm` = PIECE.Y. La
stessa misura si chiama L nel pannello e Width verso il robot, e Y il
contrario. Le colonne della vista COORDINATES_BLOW_MC seguono l'anagrafica.

**Da decidere.** Se rinominare le etichette della pagina Pezzo, o
affiancarle ai nomi del robot, oppure tenere i due vocabolari con la mappa
scritta nell'intestazione di `coordinates-blow-mc.sql`. Dipende anche
dall'esito della voce precedente.

**Trovato il** 2026-10-06.

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
