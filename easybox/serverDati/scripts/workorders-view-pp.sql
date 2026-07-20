-- ===========================================================================
-- workorders-view-pp.sql — cantiere AG fase 2, decisione B (ratificata)
--
-- SCOPO: la view WORKORDERS esponeva PP_ID = pp.id via INNER JOIN su
-- PARTPROGRAM: un ordine con numero di sottoprogramma libero (modello
-- ratificato: PIECE.PARTPROGRAM, snapshot in WORKORDER.PartProg_ID) senza
-- riga PARTPROGRAM omonima SPARIVA dalla view — invisibile al PLC e alla
-- tabella produzione, senza alcun errore. Questo script:
--   1. INNER JOIN -> LEFT JOIN su PARTPROGRAM
--   2. PP_ID = w.PartProg_ID (al posto di pp.id)
-- Ogni altra colonna resta byte-identica. Il select del PLC
-- (... ,PP_id from WORKORDERS where MACHINE_ID=n AND Status=3 ...) NON cambia.
-- La colonna PP (path+name Heidenhain) resta: per numeri liberi CONCAT di
-- NULL produce stringa vuota (il frontend fa fallback su PP_ID).
-- La tabella PARTPROGRAM non viene toccata (flusso Heidenhain).
--
-- IDEMPOTENTE: riesegui quando vuoi, applica solo se serve.
--
-- REGOLA IMPIANTO (manuale, NON automatizzare):
--   * dev:   eseguito via sqlcmd il 2026-07-20.
--   * cella: esecuzione MANUALE di Dario. PRIMA di eseguire, verificare che
--     la definizione della view in cella sia IDENTICA a quella dev riportata
--     nella sezione ROLLBACK qui sotto:
--       SELECT OBJECT_DEFINITION(OBJECT_ID('WORKORDERS'));
--     Se differisce, FERMARSI e riconciliare: finora l'identita' dev/cella
--     su questo oggetto e' stata estrapolata, non provata.
-- ===========================================================================

IF OBJECT_DEFINITION(OBJECT_ID('WORKORDERS')) LIKE '%w.PartProg_ID AS PP_ID%'
BEGIN
    PRINT 'workorders-view-pp: gia'' applicato, nessuna modifica.';
END
ELSE
BEGIN
    PRINT 'workorders-view-pp: applico ALTER VIEW...';
    EXEC('
ALTER VIEW WORKORDERS AS
SELECT  w.ID
		,w.STATUS
		,RTRIM(st.DESCR) AS STATUS_DESC
		,w.PIECE_ID
		,RTRIM(p.FAMILY) AS PIECE
		,RTRIM(p.DESCR) as PIECE_DESC
		,w.GRIPPER_ID as GRIPPER_ID
		,RTRIM(g.FAMILY) AS GRIPPER
		,RTRIM(g.DESCR) as GRIPPER_DESC
		,w.MACHINE_ID
		,w.PALLET_ID
		,pal.GripperREQ as Gripper4Pallet
		,w.VICE_ID
		,w.QUANTITY
		,ISNULL(x.PRODUCTED,0) as PRODUCTED
		,(w.OPTION1*65536)+w.OPTION2 as [OPTIONS]
		,w.PartProg_ID AS PP_ID
		,concat(trim(pp.path), trim(pp.NAME)) as PP
from PIECE p,
	GRIPPER g,
	[_STATUS_TYPE] st ,
	pallet pal,
	WORKORDER w
		left join (SELECT ORDER_ID,
			count(Order_ID) as PRODUCTED
			from [POSITION] p
			where parent like ''tray_%'' and Order_ID >0 and status IN (5, 6, 7)
			group by Order_ID ,status
		) as x
		on w.ORDER_ID =x.Order_ID
		left join partprogram pp
		on w.PartProg_ID = pp.id
where w.PIECE_ID =p.ID
	and (w.GRIPPER_ID-((w.GRIPPER_ID/1000)*1000)=g.ID) -- ricerco sia la prima che la seconda pinza
	and w.STATUS =st.ID
	and w.PALLET_ID =pal.ID
');
    PRINT 'workorders-view-pp: fatto.';
END
GO

-- ===========================================================================
-- ROLLBACK (definizione precedente, salvata da dev il 2026-07-20 con
-- SELECT OBJECT_DEFINITION(OBJECT_ID('WORKORDERS')) — eseguire il blocco
-- qui sotto, decommentato, per tornare indietro):
-- ===========================================================================
-- ALTER   VIEW WORKORDERS AS
-- SELECT  w.ID
-- 		,w.STATUS
-- 		,RTRIM(st.DESCR) AS STATUS_DESC
-- 		,w.PIECE_ID
-- 		,RTRIM(p.FAMILY) AS PIECE
-- 		,RTRIM(p.DESCR) as PIECE_DESC
-- 		,w.GRIPPER_ID as GRIPPER_ID
-- 		,RTRIM(g.FAMILY) AS GRIPPER
-- 		,RTRIM(g.DESCR) as GRIPPER_DESC
-- 		,w.MACHINE_ID
-- 		,w.PALLET_ID
-- 		,pal.GripperREQ as Gripper4Pallet
-- 		,w.VICE_ID
-- 		,w.QUANTITY
-- 		,ISNULL(x.PRODUCTED,0) as PRODUCTED
-- 		,(w.OPTION1*65536)+w.OPTION2 as [OPTIONS]
-- 		,pp.id as PP_ID
-- 		,concat(trim(pp.path), trim(pp.NAME)) as PP
-- from PIECE p,
-- 	GRIPPER g,
-- 	[_STATUS_TYPE] st ,
-- 	pallet pal,
-- 	partprogram pp,
-- 	WORKORDER w
-- 		left join (SELECT ORDER_ID,
-- 			count(Order_ID) as PRODUCTED
-- 			from [POSITION] p
-- 			where parent like 'tray_%' and Order_ID >0 and status IN (5, 6, 7)
-- 			group by Order_ID ,status
-- 		) as x
-- 		on w.ORDER_ID =x.Order_ID
-- where w.PIECE_ID =p.ID
-- 	and (w.GRIPPER_ID-((w.GRIPPER_ID/1000)*1000)=g.ID) -- ricerco sia la prima che la seconda pinza
-- 	and w.STATUS =st.ID
-- 	and w.PALLET_ID =pal.ID
-- 	and w.PartProg_ID=pp.id
