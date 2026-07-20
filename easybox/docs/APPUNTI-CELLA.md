# Appunti cella — interventi manuali da eseguire in impianto

> Regola impianto: le modifiche allo schema DB della cella NON sono
> automatizzate. Ogni voce qui sotto va eseguita a mano da Dario, spuntata
> con data, e rimossa solo quando verificata.

## [ ] 2026-07-20 — ALTER VIEW WORKORDERS (cantiere AG fase 2, decisione B)

Script: `serverDati/scripts/workorders-view-pp.sql` (idempotente, con rollback
commentato in coda).

Cosa fa: la view WORKORDERS passa a `LEFT JOIN` su PARTPROGRAM e espone
`PP_ID = w.PartProg_ID` (prima: `pp.id` via INNER JOIN). Senza questo, gli
ordini con numero di sottoprogramma libero (modello part-program-dal-
particolare) **spariscono dalla view**: invisibili al PLC e alla tabella
produzione, senza errori. Il select del PLC non cambia.

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
