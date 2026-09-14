# Appunti cella — interventi manuali da eseguire in impianto

## [ ] 2026-09-14 — origine tasche + significato Z_PICK: vista 4Robot v3 e bonifica

Riscontro pendant TRAY_1 tasca 1 (pezzo 1033, 100.6x100.6x15): reale
X 84.0 / Y 102.5 / Z 7.5 contro 118.5 / 16.2 / 45 mandati dal PLC.
Due difetti, due rimedi nello stesso commit:
- ORIGINE delle tasche (`drawingToRobot`, util + replica server): la costante
  era (w1, -h1) della convenzione pre-1/9; ora X = h, Y = w (tasca 1 = i suoi
  margini dai bordi). Le correzioni di piano attuali X_CORR 10 / Y_CORR 100
  compensavano l'errore: vanno RI-INSEGNATE.
- Z_PICK/Z_PLACE del PEZZO = QUOTA DI PRESA DAL FONDO del cassetto (mezzeria:
  7.5 su un pezzo di 15). Vista 4Robot v3: Z = TRAY.Z_CORR + PIECE.Z_PICK.
  TRAY.Z_CORR = fondo del cassetto (teaching = pendant - Z_PICK).

**NON si tocca `COORDINATES_MC`** (macchina) finche' non c'e' la misura in
morsa: oggi somma anche PIECE.Z, col nuovo significato manderebbe il robot
15 mm sopra. Lo script v3 modifica SOLO la vista cassetti.

Nella STESSA fermata va anche `grating-thickness.sql` (colonna
GRATING.THICKNESS, spessore griglia in micron, NULL = non misurato = nessun
vincolo; protezione anti-urto in generazione: Z_PICK/Z_PLACE del pezzo >=
spessore + 1 mm, controllata da client e server). I due DDL sono
INDIPENDENTI (uno tocca la vista dei cassetti, l'altro la tabella GRATING):
ordine fra loro indifferente, ENTRAMBI prima del deploy del backend
(insert/update del grigliato nominano la colonna nuova).

Sequenza obbligata (il teaching legge la tasca 1 a DB per calcolare i CORR):
```
-- 1) anagrafica pezzi: Z_PICK e Z_PLACE riscritti col nuovo significato
--    (1033 -> 7500 / 7500). Il form ora rifiuta 0 e valori > Z.
-- 2) DDL a CELLA FERMA (login plc senza ALTER), in qualsiasi ordine:
sqlcmd -S .\SQLEXPRESS -E -d ADMG -i robot-tray-view-v3.sql
sqlcmd -S .\SQLEXPRESS -E -d ADMG -i grating-thickness.sql
-- 3) deploy codice (git pull in D:\Prog) + riavvio backend
--    (poi, con calma: spessore misurato nel form grigliato 2097)
-- 4) Cassetti > "Rigenera tasche" su 1 e 12 (grigliato 2097, nessuna
--    taratura da conservare). Il 9 esce dal piano: Dissocia.
-- 5) Cassetti > "0 CASSETTIERA": campione 1, pendant X 84 / Y 102.5 / Z 7.5
--    -> X_CORR 0.2, Y_CORR -6.0, Z_CORR piano 1 = 0; gli altri piani derivati
--    da COORDINATES_FOR_EXTRACT.
-- 6) PRIMA di fidarsi del piano 12: pendant sulla sua tasca 1 (gli Z_CORR
--    832/1130 non sono derivati in modo uniforme: 800/1092 teorici).
-- 7) morsa: misura in presa vs COORDINATES_MC, poi si decide la vista MC.
```
Verifica post DDL+teaching: `SELECT TRAY, SUB_POS, X_PICK, Y_PICK, Z_PICK
FROM COORDINATES_PIECES_TRAYS_4Robot WHERE TRAY='1' AND SUB_POS=1` ->
84000 / 102500 / 7500.

## [ ] 2026-09-04 — UNIQUE (PARENT, SUB_POS) su [POSITION] — A CELLA FERMA

Script: `serverDati/scripts/position-parent-subpos-unique.sql` (idempotente,
rollback commentato). Chiude alla radice i SUB_POS duplicati (93 righe per 91
tasche sul TRAY_12: salvataggi grigliato sovrapposti; l'HMI ora ha insert
idempotente + flag anti doppio-tap, l'indice e' la cintura).

**ESEGUIRE SOLO A CELLA FERMA**: la CREATE INDEX prende un lock su [POSITION]
e le scritture PLC in volo possono farla fallire o restarne bloccate.

```
sqlcmd -S .\SQLEXPRESS -E -d ADMG -i position-parent-subpos-unique.sql
```

Se lo script elenca duplicati: bonificare con la CTE commentata dentro lo
script e rieseguire. Verifica post: `sp_helpindex 'dbo.POSITION'` deve
mostrare `UX_POSITION_PARENT_SUBPOS`.

Nota trigger (4/9, letto con -E): `POSITION_trig` e' solo logging AFTER
UPDATE,DELETE verso [log] — non c'entra coi duplicati. Difetti noti, NON
toccati: INNER JOIN inserted/deleted (i DELETE puri non vengono loggati) e
una INSERT sincrona per ogni UPDATE del PLC (~7.000 righe/giorno in
commissioning): da rivedere a parte.

> Regola impianto: le modifiche allo schema DB della cella NON sono
> automatizzate. Ogni voce qui sotto va eseguita a mano da Dario, spuntata
> con data, e rimossa solo quando verificata.

## [ ] 2026-07-20 — ALTER VIEW WORKORDERS **v2** (cantiere AG fase 2, decisioni B+A)

Script: `serverDati/scripts/workorders-view-pp.sql` (idempotente, con rollback
commentato in coda). **La v2 SOSTITUISCE la v1**: stesso file, stato finale
intero della vista. Chi avesse già applicato la v1 in impianto riesegue lo
stesso script: riconosce la v1 e migra («migro da v1 a v2»); da vista
originale migra direttamente.

Cosa fa: la view WORKORDERS passa a `LEFT JOIN` su PARTPROGRAM con
`PP_ID = w.PartProg_ID` (v1) **e a `LEFT JOIN` su GRIPPER** (v2). Senza la v1
gli ordini a numero di sottoprogramma libero spariscono dalla view; senza la
v2 spariscono gli ordini del ramo ATTREZZATURA (GRIPPER_ID=0, nessuna riga
GRIPPER 0). In entrambi i casi: invisibili al PLC e alla tabella produzione,
senza errori. Il select del PLC non cambia.

**PRIMA di eseguire, obbligatorio:**
1. Verificare che la definizione della view in cella sia IDENTICA a quella
   dev salvata nella sezione ROLLBACK dello script:
   ```
   sqlcmd -S 172.20.70.80\SQLEXPRESS -U plc -P plc -d ADMG -Q "SELECT OBJECT_DEFINITION(OBJECT_ID('WORKORDERS'));" -y 8000
   ```
   Se differisce, FERMARSI e riconciliare (l'identità dev/cella su questo
   oggetto finora è estrapolata, non provata).
2. Eseguire lo script:
   ```
   sqlcmd -S 172.20.70.80\SQLEXPRESS -U plc -P plc -d ADMG -i workorders-view-pp.sql
   ```
3. Verifica post: gli ordini esistenti restano visibili con gli stessi PP_ID
   (`SELECT ID, PP_ID FROM WORKORDERS`), PARTPROGRAM intatta.

Da deployare INSIEME al backend con il nuovo `WORKORDER/Order.js` (le
scritture ordini puntano alla base table `WORKORDER`): view vecchia + backend
nuovo convivono (insert funziona, ma i numeri liberi restano invisibili
finché la view non è migrata); view nuova + backend vecchio NO (insert
resta rotto).

## [ ] 2026-07-20 — ALTER TABLE WORKORDER: colonna DECLARED_PIECE_ID (C2)

Script: `serverDati/scripts/workorder-declared-piece.sql` (idempotente,
rollback commentato). Aggiunge `DECLARED_PIECE_ID INT NULL` alla base table:
pezzo dichiarato del ramo attrezzatura del wizard. Solo uso HMI — la view
WORKORDERS non la espone, il PLC non la vede.

```
sqlcmd -S 172.20.70.80\SQLEXPRESS -U plc -P plc -d ADMG -i workorder-declared-piece.sql
```

PREREQUISITO del backend nuovo: senza questa colonna `insertOrder`/`updateOrder`
falliscono (la INSERT la nomina). Eseguire PRIMA di deployare il backend C2.

## [ ] Bonifica ordini legacy — PRIMA del primo ciclo automatico in cella

Gli ordini storici in `Status=3` (WORKING) con `PRODUCTED<QUANTITY` verrebbero
agganciati dal dispatcher alla prima macchina EMPTY. Vanno portati a
`Status=7` (ABORTED) prima del collaudo:

```
-- 1) conferma di cosa c'è (annotare gli ID):
sqlcmd -S 172.20.70.80\SQLEXPRESS -U plc -P plc -d ADMG -Q "SELECT ID, PIECE_ID, MACHINE_ID, QUANTITY, PRODUCTED, PP_ID FROM WORKORDERS WHERE Status=3 AND PRODUCTED<QUANTITY"

-- 2) bonifica (sulla BASE table):
sqlcmd -S 172.20.70.80\SQLEXPRESS -U plc -P plc -d ADMG -Q "UPDATE WORKORDER SET STATUS=7 WHERE STATUS=3 AND ID IN (SELECT ID FROM WORKORDERS WHERE Status=3 AND PRODUCTED<QUANTITY)"

-- 3) conferma post (atteso: nessuna riga):
sqlcmd -S 172.20.70.80\SQLEXPRESS -U plc -P plc -d ADMG -Q "SELECT ID FROM WORKORDERS WHERE Status=3 AND PRODUCTED<QUANTITY"
```

Nota: tra gli ordini legacy ce n'è almeno uno con `VICE_ID=-1` (visto su dev):
la convenzione nuova è VICE_ID=0 sempre — la bonifica a Status=7 li toglie
comunque dal giro del dispatcher.

## [ ] Tray-teaching — ORDINE OBBLIGATO in cella (DDL prima del backend)

Il backend nuovo nomina le colonne di teaching di TRAY (insertPositionTray le
usa nella INSERT...SELECT): senza DDL il salvataggio grigliato FALLISCE.
Inoltre la convenzione POSITION.Z=0 entra in vigore col deploy: le righe
POSITION esistenti (Z=interasse) vengono migrate a 0 SOLO dalla transazione
del teaching. Sequenza obbligata:

```
-- 1) DDL (login plc senza ALTER: eseguire con -E):
sqlcmd -S 172.20.70.80SQLEXPRESS -E -d ADMG -i tray-teaching.sql

-- 2) deploy backend+HMI

-- 3) teaching cassettiera dal pannello (Cassetti > "0 CASSETTIERA"):
--    scrive TRAY.CORR/ROT di tutti e 12 e porta a 0 la Z delle POSITION
--    esistenti nella STESSA transazione.

-- 4) SOLO DOPO: eventuali ri-associazioni grigliato (le righe nuove nascono
--    gia' con Z=0 e ROT/APPROACH ereditati dal TRAY).
```

NB: tra il punto 2 e il punto 3 NON ri-associare grigliati: righe con Z=0 ma
TRAY.Z_CORR ancora vecchio-regime darebbero quote basse di ~800 mm.
