-- ===========================================================================
-- robot-tray-view-v3.sql — vista COORDINATES_PIECES_TRAYS_4Robot v3
-- (cantiere z-pick 14/9: significato di PIECE.Z_PICK / PIECE.Z_PLACE)
--
-- TOCCA SOLO QUESTA VISTA (cassetti). La vista macchina COORDINATES_MC NON
-- viene modificata: resta sulla formula attuale finche' non c'e' la misura
-- in morsa sul pendant (decisione 14/9).
--
-- PROBLEMA (misurato in cella 14/9, TRAY_1 tasca 1, pezzo 1033 alto 15):
-- la v2 calcola Z prelievo = TRAY.Z_CORR + PIECE.Z - PIECE.Z_PICK, cioe'
-- Z_PICK = profondita' sotto la sommita'. Con Z_PICK 0 il robot chiude le
-- ganasce sul piano superiore del pezzo (45 mm mandati contro 7.5 reali).
--
-- V3: PIECE.Z_PICK e PIECE.Z_PLACE sono QUOTE DAL FONDO DEL CASSETTO:
--   Z_PICK  = pos.Z + pos.Z_CORR + TRAY.Z_CORR + PIECE.Z_PICK
--   Z_PLACE = pos.Z + pos.Z_CORR + TRAY.Z_CORR + PIECE.Z_PLACE
-- (mezzeria di un pezzo alto 15 -> Z_PICK 7.5 -> fondo + 7.5). Ogni altra
-- colonna byte-identica alla v2. TRAY.Z_CORR diventa il FONDO del cassetto:
-- il teaching cassettiera (TraysView) lo calcola come pendant - Z_PICK.
--
-- PREREQUISITI (ordine obbligato, vedi APPUNTI-CELLA 14/9):
--   1. anagrafica PIECE riscritta col nuovo significato (Z_PICK/Z_PLACE > 0
--      e <= Z): finche' un pezzo ha Z_PICK 0 il robot chiude sul fondo;
--   2. questo script a CELLA FERMA (login plc senza ALTER -> -E):
--        sqlcmd -S .\SQLEXPRESS -E -d ADMG -i robot-tray-view-v3.sql
--   3. deploy codice (origin-fix + teaching), rigenerazione tasche,
--      teaching cassettiera.
--
-- IDEMPOTENTE: riconosce la v3 gia' applicata (Z_PICK sommato, nessun
-- '-pt.Z_PICK') e non fa nulla; da v1 cifrata o v2 migra (ALTER in SQL
-- dinamico: un solo batch, la vista viene ricreata IN CHIARO).
-- ===========================================================================
SET NOCOUNT ON;

DECLARE @def nvarchar(max) = OBJECT_DEFINITION(OBJECT_ID('COORDINATES_PIECES_TRAYS_4Robot'));
IF @def IS NOT NULL AND @def LIKE '%t.Z_CORR+pt.Z_PICK)%' AND @def NOT LIKE '%-pt.Z_PICK%'
	PRINT 'COORDINATES_PIECES_TRAYS_4Robot: v3 gia'' presente, niente da fare.';
ELSE BEGIN
	IF @def IS NULL PRINT 'vista CIFRATA (v1/v2 in cella): la ricreo in chiaro come v3.';
	ELSE PRINT 'migro a v3.';
	EXEC(N'ALTER VIEW COORDINATES_PIECES_TRAYS_4Robot AS
select  pt.id as partType,
		SUBSTRING(pos.PARENT,6,2) As TRAY,
		pos.POS as MAG,
		pos.SUB_POS ,
		pt.PRISMA as PRISMA,
		(pos.X+pos.X_CORR+t.X_CORR+ISNULL(w.X_PICK_DECENTRATED_TRAY,0)) 	as X_PICK,
		(pos.Y+pos.Y_CORR+t.Y_CORR+ISNULL(w.Y_PICK_DECENTRATED_TRAY,0)) 	as Y_PICK,
		(pos.Z+pos.Z_CORR+t.Z_CORR+pt.Z_PICK) 								as Z_PICK,
		(pos.X+pos.X_CORR+t.X_CORR+ISNULL(w.X_PLACE_DECENTRATED_TRAY,0)) 	as X_PLACE,
		(pos.Y+pos.Y_CORR+t.Y_CORR+ISNULL(w.Y_PLACE_DECENTRATED_TRAY,0)) 	as Y_PLACE,
		(pos.Z+pos.Z_CORR+t.Z_CORR+pt.Z_Place) 								as Z_PLACE,
		(pos.X_ROT+pos.X_ROT_CORR ) 										as X_ROT,
		(pos.Y_ROT+pos.Y_ROT_CORR ) 										as Y_ROT,
		(pos.Z_ROT+pos.Z_ROT_CORR ) 										as Z_ROT,
		pos.APPROACH_TYPE, pos.APPROACH_X,pos.APPROACH_Y ,pos.APPROACH_Z ,
		pos.APPROACH_X_ROT ,pos.APPROACH_Y_ROT ,pos.APPROACH_Z_ROT,
		pos.STATUS  ,
		pos.Order_ID
		from [POSITION] pos
		inner join PIECE pt on pos.Part_Type = pt.ID
		inner join tray t   on concat(''TRAY_'', t.FLOOR_MAG) = trim(pos.PARENT)
		left  join WORKORDER w on w.ID = pos.Order_ID
		where pos.parent like ''TRAY%''
		and pos.pos > 0;');
	PRINT 'COORDINATES_PIECES_TRAYS_4Robot: v3 applicata.';
END

-- verifica (TRAY_1 tasca 1, pezzo 1033 con Z_PICK 7500 e TRAY.Z_CORR 0 dopo
-- il teaching: atteso Z_PICK 7500, X_PICK 84000, Y_PICK 102500):
-- SELECT TRAY, SUB_POS, X_PICK, Y_PICK, Z_PICK, Z_PLACE
--   FROM COORDINATES_PIECES_TRAYS_4Robot WHERE TRAY='1' ORDER BY SUB_POS;

-- ===========================================================================
-- ROLLBACK (v2, robot-tray-view-v2.sql — eseguire solo per tornare indietro,
-- e SOLO insieme all'anagrafica PIECE col vecchio significato):
-- ALTER VIEW COORDINATES_PIECES_TRAYS_4Robot AS
-- select  pt.id as partType,
-- 		SUBSTRING(pos.PARENT,6,2) As TRAY,
-- 		pos.POS as MAG,
-- 		pos.SUB_POS ,
-- 		pt.PRISMA as PRISMA,
-- 		(pos.X+pos.X_CORR+t.X_CORR+ISNULL(w.X_PICK_DECENTRATED_TRAY,0)) 	as X_PICK,
-- 		(pos.Y+pos.Y_CORR+t.Y_CORR+ISNULL(w.Y_PICK_DECENTRATED_TRAY,0)) 	as Y_PICK,
-- 		(pos.Z+pos.Z_CORR+t.Z_CORR+pt.Z-pt.Z_PICK) 						as Z_PICK,
-- 		(pos.X+pos.X_CORR+t.X_CORR+ISNULL(w.X_PLACE_DECENTRATED_TRAY,0)) 	as X_PLACE,
-- 		(pos.Y+pos.Y_CORR+t.Y_CORR+ISNULL(w.Y_PLACE_DECENTRATED_TRAY,0)) 	as Y_PLACE,
-- 		(pos.Z+pos.Z_CORR+t.Z_CORR+pt.Z+pt.Z_Place-pt.Z_PICK) 				as Z_PLACE,
-- 		(pos.X_ROT+pos.X_ROT_CORR ) 										as X_ROT,
-- 		(pos.Y_ROT+pos.Y_ROT_CORR ) 										as Y_ROT,
-- 		(pos.Z_ROT+pos.Z_ROT_CORR ) 										as Z_ROT,
-- 		pos.APPROACH_TYPE, pos.APPROACH_X,pos.APPROACH_Y ,pos.APPROACH_Z ,
-- 		pos.APPROACH_X_ROT ,pos.APPROACH_Y_ROT ,pos.APPROACH_Z_ROT,
-- 		pos.STATUS  ,
-- 		pos.Order_ID
-- 		from [POSITION] pos
-- 		inner join PIECE pt on pos.Part_Type = pt.ID
-- 		inner join tray t   on concat('TRAY_', t.FLOOR_MAG) = trim(pos.PARENT)
-- 		left  join WORKORDER w on w.ID = pos.Order_ID
-- 		where pos.parent like 'TRAY%'
-- 		and pos.pos > 0;
-- ===========================================================================
