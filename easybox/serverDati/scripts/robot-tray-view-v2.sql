-- ===========================================================================
-- robot-tray-view-v2.sql — vista COORDINATES_PIECES_TRAYS_4Robot v2
-- (cantiere ordine->grigliato, PARTE B — cintura strutturale ratificata)
--
-- PROBLEMA (verificato in cella 23/7): la vista v1 usa JOIN IMPLICITI tutti
-- INNER, incluso `w.ID = pos.Order_ID` su WORKORDER: una tasca con
-- Order_ID=0 (stato normale PRIMA del PLAY, che e' il momento in cui il
-- pannello associa l'ordine) SPARISCE dalla vista -> il PLC non vede alcuna
-- riga e va in errore 991 su qualunque pick.
--
-- V2 (stessa filosofia del precedente workorders-view-pp.sql):
--   1. JOIN espliciti; WORKORDER diventa LEFT JOIN;
--   2. ISNULL(...,0) sui 4 decentrati dell'ordine (X/Y_PICK/PLACE_
--      DECENTRATED_TRAY): senza ordine associato il decentramento e' 0;
--   3. ogni altra colonna byte-identica alla v1 (nomi e ordine invariati).
--
-- NB CELLA: la vista in cella e' CIFRATA (OBJECT_DEFINITION = NULL, WITH
-- ENCRYPTION): questa definizione riproduce la v1 estratta dal DB dev
-- (identica per contratto) e la ricrea IN CHIARO. Il deploy DDL lo esegue
-- il committente:
--   sqlcmd -S 172.20.70.80\SQLEXPRESS -E -d ADMG -i robot-tray-view-v2.sql
-- ===========================================================================

ALTER VIEW COORDINATES_PIECES_TRAYS_4Robot AS
select  pt.id as partType,
		SUBSTRING(pos.PARENT,6,2) As TRAY,
		pos.POS as MAG,
		pos.SUB_POS ,
		pt.PRISMA as PRISMA,
		(pos.X+pos.X_CORR+t.X_CORR+ISNULL(w.X_PICK_DECENTRATED_TRAY,0)) 	as X_PICK,
		(pos.Y+pos.Y_CORR+t.Y_CORR+ISNULL(w.Y_PICK_DECENTRATED_TRAY,0)) 	as Y_PICK,
		(pos.Z+pos.Z_CORR+t.Z_CORR+pt.Z-pt.Z_PICK) 						as Z_PICK,
		(pos.X+pos.X_CORR+t.X_CORR+ISNULL(w.X_PLACE_DECENTRATED_TRAY,0)) 	as X_PLACE,
		(pos.Y+pos.Y_CORR+t.Y_CORR+ISNULL(w.Y_PLACE_DECENTRATED_TRAY,0)) 	as Y_PLACE,
		(pos.Z+pos.Z_CORR+t.Z_CORR+pt.Z+pt.Z_Place-pt.Z_PICK) 				as Z_PLACE,
		(pos.X_ROT+pos.X_ROT_CORR ) 										as X_ROT,
		(pos.Y_ROT+pos.Y_ROT_CORR ) 										as Y_ROT,
		(pos.Z_ROT+pos.Z_ROT_CORR ) 										as Z_ROT,
		pos.APPROACH_TYPE, pos.APPROACH_X,pos.APPROACH_Y ,pos.APPROACH_Z ,
		pos.APPROACH_X_ROT ,pos.APPROACH_Y_ROT ,pos.APPROACH_Z_ROT,
		pos.STATUS  ,
		pos.Order_ID
		from [POSITION] pos
		inner join PIECE pt on pos.Part_Type = pt.ID
		inner join tray t   on concat('TRAY_', t.FLOOR_MAG) = trim(pos.PARENT)
		left  join WORKORDER w on w.ID = pos.Order_ID
		where pos.parent like 'TRAY%'
		and pos.pos > 0;
GO

-- verifica (attese: righe presenti ANCHE con Order_ID=0):
-- SELECT TRAY, SUB_POS, STATUS, Order_ID, X_PICK, Y_PICK
--   FROM COORDINATES_PIECES_TRAYS_4Robot ORDER BY TRAY, SUB_POS;

-- ===========================================================================
-- ROLLBACK (v1 originale, estratta dal dev — eseguire solo per tornare
-- indietro; in cella la v1 era cifrata: il rollback la ricrea in chiaro):
-- ALTER VIEW COORDINATES_PIECES_TRAYS_4Robot AS
-- select  pt.id as partType,
-- 		SUBSTRING(pos.PARENT,6,2) As TRAY,
-- 		pos.POS as MAG,
-- 		pos.SUB_POS ,
-- 		pt.PRISMA as PRISMA,
-- 		(pos.X+pos.X_CORR+t.X_CORR+w.X_PICK_DECENTRATED_TRAY) 	as X_PICK,
-- 		(pos.Y+pos.Y_CORR+t.Y_CORR+w.Y_PICK_DECENTRATED_TRAY) 	as Y_PICK,
-- 		(pos.Z+pos.Z_CORR+t.Z_CORR+pt.Z-pt.Z_PICK) 				as Z_PICK,
-- 		(pos.X+pos.X_CORR+t.X_CORR+w.X_PLACE_DECENTRATED_TRAY) 	as X_PLACE,
-- 		(pos.Y+pos.Y_CORR+t.Y_CORR+w.Y_PLACE_DECENTRATED_TRAY) 	as Y_PLACE,
-- 		(pos.Z+pos.Z_CORR+t.Z_CORR+pt.Z+pt.Z_Place-pt.Z_PICK) 	as Z_PLACE,
-- 		(pos.X_ROT+pos.X_ROT_CORR ) 							as X_ROT,
-- 		(pos.Y_ROT+pos.Y_ROT_CORR ) 							as Y_ROT,
-- 		(pos.Z_ROT+pos.Z_ROT_CORR ) 							as Z_ROT,
-- 		pos.APPROACH_TYPE, pos.APPROACH_X,pos.APPROACH_Y ,pos.APPROACH_Z ,
-- 		pos.APPROACH_X_ROT ,pos.APPROACH_Y_ROT ,pos.APPROACH_Z_ROT,
-- 		pos.STATUS  ,
-- 		pos.Order_ID
-- 		from PIECE pt, [POSITION] pos , WORKORDER w , tray t
-- 		where pos.parent like 'TRAY%' and pos.Part_Type =pt.ID
-- 		and w.ID=pos.Order_ID
-- 		and pos.pos>0 and concat('TRAY_',t.FLOOR_MAG) = trim(pos.PARENT);
-- ===========================================================================
