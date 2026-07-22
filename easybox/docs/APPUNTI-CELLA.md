# Appunti cella — interventi manuali da eseguire in impianto

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
