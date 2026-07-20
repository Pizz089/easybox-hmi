-- ===========================================================================
-- workorders-view-pp.sql — cantiere AG fase 2, decisioni B (C1) + A (C2)
-- v2: rappresenta lo STATO FINALE INTERO della vista WORKORDERS.
--
-- SCOPO (v1, C1): la view esponeva PP_ID = pp.id via INNER JOIN su
-- PARTPROGRAM: un ordine con numero di sottoprogramma libero (modello
-- ratificato: PIECE.PARTPROGRAM, snapshot in WORKORDER.PartProg_ID) senza
-- riga PARTPROGRAM omonima SPARIVA dalla view — invisibile al PLC e alla
-- tabella produzione, senza alcun errore.
--   1. INNER JOIN -> LEFT JOIN su PARTPROGRAM
--   2. PP_ID = w.PartProg_ID (al posto di pp.id)
--
-- SCOPO (v2, C2): stesso meccanismo sul join GRIPPER — gli ordini del ramo
-- attrezzatura hanno GRIPPER_ID=0 per convenzione PLC e la riga GRIPPER 0
-- non esiste: l'INNER li nascondeva.
--   3. INNER JOIN -> LEFT JOIN su GRIPPER (GRIPPER/GRIPPER_DESC diventano
--      NULL per quegli ordini: consumatori verificati nulli — il PLC non
--      seleziona le colonne pinza, la cella GRIPPER in productionTable e'
--      commentata). Motivazione a verbale: la sentinella a DB (opzione B)
--      avrebbe sporcato l'anagrafica visibile e reintrodotto un fallimento
--      silenzioso da disciplina manuale.
--
-- Ogni altra colonna byte-identica all'originale. Il select del PLC
-- (... ,PP_id from WORKORDERS where MACHINE_ID=n AND Status=3 ...) NON cambia.
-- La tabella PARTPROGRAM non viene toccata (flusso Heidenhain).
--
-- MAPPA JOIN della vista (v2) e residuo di rischio INNER:
--   PIECE p        INNER  w.PIECE_ID=p.ID      — sentinella PIECE 0 ESISTE
--   [_STATUS_TYPE] INNER  w.STATUS=st.ID       — status sempre da enum PLC
--   pallet pal     INNER  w.PALLET_ID=pal.ID   — PALLET_ID reale per convenzione;
--                                                 cancellare un pallet con ordini
--                                                 storici li renderebbe invisibili
--   GRIPPER g      LEFT   (v2)
--   partprogram pp LEFT   (v1)
--   subquery x     LEFT   (PRODUCTED)
--   VICE / MACHINE: NESSUN join — w.VICE_ID e w.MACHINE_ID esposti raw
--   (per questo VICE_ID=0 passa senza sentinella).
--
-- IDEMPOTENTE: riesegui quando vuoi; migra sia dalla vista ORIGINALE sia
-- dalla v1 gia' applicata; skip se v2 gia' presente.
--
-- REGOLA IMPIANTO (manuale, NON automatizzare):
--   * dev:   v1 eseguita 2026-07-20, v2 rieseguita 2026-07-20.
--   * cella: esecuzione MANUALE di Dario. PRIMA di eseguire, verificare che
--     la definizione della view in cella sia IDENTICA a una delle due attese
--     (originale = sezione ROLLBACK qui sotto; oppure v1 se gia' applicata):
--       SELECT OBJECT_DEFINITION(OBJECT_ID('WORKORDERS'));
--     Se differisce da entrambe, FERMARSI e riconciliare.
-- ===========================================================================

DECLARE @def NVARCHAR(MAX) = OBJECT_DEFINITION(OBJECT_ID('WORKORDERS'));
IF @def LIKE '%left join GRIPPER%'
BEGIN
    PRINT 'workorders-view-pp: v2 gia'' applicata, nessuna modifica.';
END
ELSE
BEGIN
    IF @def LIKE '%w.PartProg_ID AS PP_ID%'
        PRINT 'workorders-view-pp: migro da v1 a v2...';
    ELSE
        PRINT 'workorders-view-pp: migro dalla vista originale a v2...';
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
		left join GRIPPER g
		on (w.GRIPPER_ID-((w.GRIPPER_ID/1000)*1000)=g.ID) -- ricerco sia la prima che la seconda pinza
where w.PIECE_ID =p.ID
	and w.STATUS =st.ID
	and w.PALLET_ID =pal.ID
');
    PRINT 'workorders-view-pp: fatto (v2).';
END
GO

-- ===========================================================================
-- ROLLBACK (definizione ORIGINALE pre-v1, salvata da dev il 2026-07-20 con
-- SELECT OBJECT_DEFINITION(OBJECT_ID('WORKORDERS')) — eseguire il blocco
-- qui sotto, decommentato, per tornare allo stato pre-cantiere):
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
