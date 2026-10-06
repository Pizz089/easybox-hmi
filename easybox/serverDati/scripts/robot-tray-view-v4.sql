-- ===========================================================================
-- robot-tray-view-v4.sql — vista COORDINATES_PIECES_TRAYS_4Robot v4
-- (work object per cassetto, 6/10)
--
-- PERCHE'. Il robotista passa a UN WORK OBJECT PER CASSETTO: meccanicamente
-- i cassetti non sono paralleli ne' equidistanti, e un solo riferimento per
-- tutta la cassettiera non basta. Il PLC gli manda il numero del cassetto in
-- N_Cassetto (%QW644, REGION N_Cassetto in FB_RobotEfort, scaricata a parte).
-- Da quel momento le quote delle tasche devono essere RELATIVE AL CASSETTO:
--   - X e Y dall'angolo del cassetto;
--   - Z = quota di presa dal fondo.
-- La v3 sommava le correzioni del cassetto (TRAY.X_CORR, Y_CORR, Z_CORR: per
-- il piano 8 la Z del piano vale 698.6 mm): con il work object quelle quote
-- sarebbero sbagliate di tutto l'offset del piano.
--
-- DECISIONE DI DARIO: la regola sta nel CODICE (questa vista), non nei dati.
-- Nessun salvataggio dal pannello puo' rimettere gli offset di piano nelle
-- quote del robot. DA QUI LE CORREZIONI DEL CASSETTO IN TRAY (X_CORR, Y_CORR,
-- Z_CORR) NON ENTRANO PIU' NELLE QUOTE DEL ROBOT: restano nel DB, ma la
-- posizione del cassetto e' nel robot.
--
-- CONVENZIONE DEL WORK OBJECT (da concordare col robotista):
--   - origine nell'angolo interno del cassetto vicino alla tasca 1, quello da
--     cui il modello misura 819 x 605;
--   - X lungo il lato da 605, verso la tasca 40;
--   - Y lungo il lato da 819, verso la tasca 13;
--   - Z = 0 sulla superficie su cui appoggiano i pezzi.
--
-- V4, rispetto alla v3:
--   X_PICK  = pos.X + ISNULL(pos.X_CORR,0) + ISNULL(w.X_PICK_DECENTRATED_TRAY,0)
--   Y_PICK  = pos.Y + ISNULL(pos.Y_CORR,0) + ISNULL(w.Y_PICK_DECENTRATED_TRAY,0)
--   Z_PICK  = ISNULL(pos.Z,0) + ISNULL(pos.Z_CORR,0) + pt.Z_PICK
--   X_PLACE, Y_PLACE, Z_PLACE allo stesso modo, coi decentrati di place e
--   pt.Z_Place. Spariscono i termini t.X_CORR, t.Y_CORR, t.Z_CORR.
--   Rotazioni: stessa formula della v3, con ISNULL sulla correzione della
--   tasca (X_ROT + ISNULL(X_ROT_CORR,0)): vedi NULL qui sotto.
--   Avvicinamenti, colonne, nomi, ordine e significato: come la v3 (il PLC
--   le legge per nome: X_PICK, y_PICK, z_PICK, X_ROT, y_rot, Z_ROt,
--   APPROACH_type, APPROACH_x, APPROACH_y, APPROACH_Z, cast(TRAY as int),
--   SUB_POS, filtrando per TRAY, SUB_POS, STATUS, partType).
--   Il join su tray resta, con la stessa condizione sul PARENT: limita la
--   vista ai piani configurati, come prima.
--
-- NULL. Il ponte SQL verso il PLC non converte NULL in zero: passa valori
-- casuali. Per questo ISNULL su ogni correzione. I due inserimenti di tasche
-- del backend, insertPositionTray (CONF/Position.js) e il ramo "Genera" di
-- associateGrating (CONF/Tray.js, generateInsertSql), NON scrivono nessuna
-- correzione della tasca (X/Y/Z_CORR, X/Y/Z_ROT_CORR): il valore lo decide il
-- default della colonna. Il default NON e' scritto in nessun file del repo e
-- il DB non si interroga da qui: la prima SELECT di questo script lo legge dai
-- metadati (sys.columns / sys.default_constraints) e lo lascia nel file di
-- backup. Che oggi le tasche generate abbiano quote (la v3 somma pos.X_CORR
-- senza ISNULL) fa pensare a un default 0, ma va letto li'.
--
-- QUANDO: lo lancia Dario in cella INSIEME al cambio del programma robot
-- (work object per cassetto), non prima. Da PowerShell, con il backup della
-- definizione vecchia nel file (-y 0: niente troncamento della definizione):
--
--   cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -y 0 -i robot-tray-view-v4.sql -o D:\Backup\vista4Robot_prima_v4.txt; Get-Content D:\Backup\vista4Robot_prima_v4.txt
--
-- GUARDIA: la definizione letta con OBJECT_DEFINITION si confronta, a spazi
-- normalizzati e dalla "select" in poi (l'intestazione CREATE/ALTER non
-- conta), con la v3 attesa e con la v4:
--   - e' la v3 (quella di superati/robot-tray-view-v3.sql): la stampa, cosi'
--     finisce nel file di backup, poi ALTER alla v4;
--   - e' gia' la v4: nessuna modifica, "conforme";
--   - e' qualunque altra cosa (anche: vista assente o cifrata): FERMO,
--     nessuna modifica, e stampa quello che ha trovato.
--
-- ROLLBACK: rimettere la definizione v3. E' nel file di backup del comando
-- qui sopra, in fondo a questo file (commentata) e in
-- superati/robot-tray-view-v3.sql (quel file e' INERTE di proposito: copiarne
-- l'ALTER VIEW). Solo insieme al ritorno del robot al riferimento unico.
-- ===========================================================================
SET NOCOUNT ON;
GO

-- 0. default delle correzioni della tasca (sola lettura dei metadati)
SELECT c.name AS colonna, c.is_nullable AS ammette_null, ISNULL(dc.definition, '(nessun default)') AS default_colonna
  FROM sys.columns c
  LEFT JOIN sys.default_constraints dc ON dc.object_id = c.default_object_id
 WHERE c.object_id = OBJECT_ID('dbo.POSITION') AND c.name LIKE '%[_]CORR'
 ORDER BY c.column_id;
GO

-- 1. guardia
DECLARE @def nvarchar(max) = OBJECT_DEFINITION(OBJECT_ID('COORDINATES_PIECES_TRAYS_4Robot'));

-- v3 attesa: il corpo dell'ALTER di superati/robot-tray-view-v3.sql
DECLARE @v3 nvarchar(max) = N'select  pt.id as partType,
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
		and pos.pos > 0;';

-- v4: lo STESSO testo dell'ALTER VIEW del passo 2 (test_robot_tray_view.js
-- controlla che coincidano)
DECLARE @v4 nvarchar(max) = N'select  pt.id as partType,
		SUBSTRING(pos.PARENT,6,2) As TRAY,
		pos.POS as MAG,
		pos.SUB_POS ,
		pt.PRISMA as PRISMA,
		(pos.X+ISNULL(pos.X_CORR,0)+ISNULL(w.X_PICK_DECENTRATED_TRAY,0)) 	as X_PICK,
		(pos.Y+ISNULL(pos.Y_CORR,0)+ISNULL(w.Y_PICK_DECENTRATED_TRAY,0)) 	as Y_PICK,
		(ISNULL(pos.Z,0)+ISNULL(pos.Z_CORR,0)+pt.Z_PICK) 					as Z_PICK,
		(pos.X+ISNULL(pos.X_CORR,0)+ISNULL(w.X_PLACE_DECENTRATED_TRAY,0)) 	as X_PLACE,
		(pos.Y+ISNULL(pos.Y_CORR,0)+ISNULL(w.Y_PLACE_DECENTRATED_TRAY,0)) 	as Y_PLACE,
		(ISNULL(pos.Z,0)+ISNULL(pos.Z_CORR,0)+pt.Z_Place) 					as Z_PLACE,
		(pos.X_ROT+ISNULL(pos.X_ROT_CORR,0)) 								as X_ROT,
		(pos.Y_ROT+ISNULL(pos.Y_ROT_CORR,0)) 								as Y_ROT,
		(pos.Z_ROT+ISNULL(pos.Z_ROT_CORR,0)) 								as Z_ROT,
		pos.APPROACH_TYPE, pos.APPROACH_X,pos.APPROACH_Y ,pos.APPROACH_Z ,
		pos.APPROACH_X_ROT ,pos.APPROACH_Y_ROT ,pos.APPROACH_Z_ROT,
		pos.STATUS  ,
		pos.Order_ID
		from [POSITION] pos
		inner join PIECE pt on pos.Part_Type = pt.ID
		inner join tray t   on concat(''TRAY_'', t.FLOOR_MAG) = trim(pos.PARENT)
		left  join WORKORDER w on w.ID = pos.Order_ID
		where pos.parent like ''TRAY%''
		and pos.pos > 0;';

-- normalizzazione: a capo e tab -> spazio, spazi multipli -> uno, via il ';'
-- finale; si confronta dalla "select" in poi
DECLARE @t TABLE (k varchar(3) PRIMARY KEY, txt nvarchar(max));
INSERT INTO @t VALUES ('def', ISNULL(@def, N'')), ('v3', @v3), ('v4', @v4);
UPDATE @t SET txt = REPLACE(REPLACE(REPLACE(txt, CHAR(13), N' '), CHAR(10), N' '), CHAR(9), N' ');
WHILE EXISTS (SELECT 1 FROM @t WHERE CHARINDEX(N'  ', txt) > 0)
	UPDATE @t SET txt = REPLACE(txt, N'  ', N' ') WHERE CHARINDEX(N'  ', txt) > 0;
UPDATE @t SET txt = LTRIM(RTRIM(txt));
UPDATE @t SET txt = RTRIM(LEFT(txt, LEN(txt) - 1)) WHERE RIGHT(txt, 1) = N';';
UPDATE @t SET txt = SUBSTRING(txt, CHARINDEX(N'select pt.id as partType', txt), LEN(txt))
	WHERE CHARINDEX(N'select pt.id as partType', txt) > 0;
UPDATE @t SET txt = N'' WHERE k = 'def' AND CHARINDEX(N'select pt.id as partType', txt) <> 1;

DECLARE @nDef nvarchar(max) = (SELECT txt FROM @t WHERE k = 'def');
DECLARE @nV3  nvarchar(max) = (SELECT txt FROM @t WHERE k = 'v3');
DECLARE @nV4  nvarchar(max) = (SELECT txt FROM @t WHERE k = 'v4');

IF @def IS NULL
BEGIN
	-- PRIMA il RAISERROR, POI SET NOEXEC ON (con NOEXEC attivo non partirebbe)
	RAISERROR('COORDINATES_PIECES_TRAYS_4Robot assente o CIFRATA: non e'' la v3 attesa. FERMO, nessuna modifica.', 16, 1);
	SET NOEXEC ON;
END
ELSE IF @nDef = @nV4
BEGIN
	PRINT 'COORDINATES_PIECES_TRAYS_4Robot: gia'' v4, conforme. Nessuna modifica.';
	SET NOEXEC ON;
END
ELSE IF @nDef = @nV3
BEGIN
	PRINT 'COORDINATES_PIECES_TRAYS_4Robot: trovata la v3 attesa. Definizione PRIMA della v4 (backup):';
	SELECT @def AS definizione_v3_prima_della_v4;
	PRINT 'Passo alla v4.';
END
ELSE
BEGIN
	PRINT 'COORDINATES_PIECES_TRAYS_4Robot: definizione trovata (NON e'' ne'' la v3 attesa ne'' la v4):';
	SELECT @def AS definizione_trovata;
	RAISERROR('La vista non e'' quella attesa: riconciliare a mano. FERMO, nessuna modifica.', 16, 1);
	SET NOEXEC ON;
END
GO

-- 2. v4
ALTER VIEW COORDINATES_PIECES_TRAYS_4Robot AS
select  pt.id as partType,
		SUBSTRING(pos.PARENT,6,2) As TRAY,
		pos.POS as MAG,
		pos.SUB_POS ,
		pt.PRISMA as PRISMA,
		(pos.X+ISNULL(pos.X_CORR,0)+ISNULL(w.X_PICK_DECENTRATED_TRAY,0)) 	as X_PICK,
		(pos.Y+ISNULL(pos.Y_CORR,0)+ISNULL(w.Y_PICK_DECENTRATED_TRAY,0)) 	as Y_PICK,
		(ISNULL(pos.Z,0)+ISNULL(pos.Z_CORR,0)+pt.Z_PICK) 					as Z_PICK,
		(pos.X+ISNULL(pos.X_CORR,0)+ISNULL(w.X_PLACE_DECENTRATED_TRAY,0)) 	as X_PLACE,
		(pos.Y+ISNULL(pos.Y_CORR,0)+ISNULL(w.Y_PLACE_DECENTRATED_TRAY,0)) 	as Y_PLACE,
		(ISNULL(pos.Z,0)+ISNULL(pos.Z_CORR,0)+pt.Z_Place) 					as Z_PLACE,
		(pos.X_ROT+ISNULL(pos.X_ROT_CORR,0)) 								as X_ROT,
		(pos.Y_ROT+ISNULL(pos.Y_ROT_CORR,0)) 								as Y_ROT,
		(pos.Z_ROT+ISNULL(pos.Z_ROT_CORR,0)) 								as Z_ROT,
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
-- controllo: si rilegge la definizione. Se l'ALTER e' fallita (per esempio
-- per permessi) la vista e' ancora quella di prima e il messaggio non deve
-- dire il contrario. Prima di SET NOEXEC OFF: dopo un FERMO non parte.
IF OBJECT_DEFINITION(OBJECT_ID('COORDINATES_PIECES_TRAYS_4Robot')) LIKE N'%ISNULL(pos.Z,0)+ISNULL(pos.Z_CORR,0)+pt.Z_PICK%'
	PRINT 'COORDINATES_PIECES_TRAYS_4Robot: v4 applicata.';
ELSE
	RAISERROR('ALTER non riuscita, la vista e'' ancora quella di prima: vedi l''errore sopra.', 16, 1);
GO
SET NOEXEC OFF;
GO

-- 3. VERIFICA (sola lettura), cassetto 8, tasche 1, 13, 40 e 52.
-- Atteso con il grigliato attuale: Z_PICK 10000, X/Y uguali a prima della v4
-- (tasca 1: X_PICK 101500, Y_PICK 61500). Dopo la rigenerazione con le
-- distanze 19/25 (piastra misurata il 6/10): tasca 1 circa 100150 / 55500.
PRINT 'VERIFICA: cassetto 8, tasche 1/13/40/52, quote della vista COM''E'' ADESSO (dopo un FERMO e'' ancora quella di prima).';
SELECT TRAY, SUB_POS, X_PICK, Y_PICK, Z_PICK, X_PLACE, Y_PLACE, Z_PLACE, X_ROT, Y_ROT, Z_ROT
  FROM COORDINATES_PIECES_TRAYS_4Robot
 WHERE cast(TRAY as int) = 8 AND SUB_POS IN (1, 13, 40, 52)
 ORDER BY SUB_POS;
GO

-- 4. VERIFICA (sola lettura): tasche dei cassetti con Z diversa da 0.
-- La v4 somma pos.Z alla quota di presa. Finora la Z a 0 la garantiva
-- "0 CASSETTIERA", che con i work object per cassetto sparisce; i due
-- inserimenti di tasche del backend (insertPositionTray e "Genera") scrivono
-- Z = 0. Se il conteggio non e' 0: avviso, niente FERMO (la vista ormai e'
-- applicata), e l'elenco delle tasche da guardare.
DECLARE @zNon0 int = (SELECT COUNT(*) FROM [POSITION]
	WHERE PARENT LIKE 'TRAY%' AND POS > 0 AND ISNULL(Z,0) <> 0);
PRINT 'VERIFICA: tasche dei cassetti con Z diversa da 0: ' + CAST(@zNon0 AS varchar(10)) + ' (atteso 0).';
IF @zNon0 <> 0
BEGIN
	PRINT 'ATTENZIONE: queste tasche hanno Z diversa da 0 e la v4 la somma alla quota di presa: il robot prenderebbe piu'' in alto o piu'' in basso di Z_PICK. Controllarle prima di lavorare su quei cassetti (elenco qui sotto).';
	SELECT ID, RTRIM(PARENT) AS PARENT, SUB_POS, Z
	  FROM [POSITION]
	 WHERE PARENT LIKE 'TRAY%' AND POS > 0 AND ISNULL(Z,0) <> 0
	 ORDER BY PARENT, SUB_POS;
END
GO

-- ===========================================================================
-- ROLLBACK (v3) — eseguire solo per tornare indietro, e SOLO insieme al
-- ritorno del robot al riferimento unico della cassettiera:
-- ALTER VIEW COORDINATES_PIECES_TRAYS_4Robot AS
-- select  pt.id as partType,
-- 		SUBSTRING(pos.PARENT,6,2) As TRAY,
-- 		pos.POS as MAG,
-- 		pos.SUB_POS ,
-- 		pt.PRISMA as PRISMA,
-- 		(pos.X+pos.X_CORR+t.X_CORR+ISNULL(w.X_PICK_DECENTRATED_TRAY,0)) 	as X_PICK,
-- 		(pos.Y+pos.Y_CORR+t.Y_CORR+ISNULL(w.Y_PICK_DECENTRATED_TRAY,0)) 	as Y_PICK,
-- 		(pos.Z+pos.Z_CORR+t.Z_CORR+pt.Z_PICK) 								as Z_PICK,
-- 		(pos.X+pos.X_CORR+t.X_CORR+ISNULL(w.X_PLACE_DECENTRATED_TRAY,0)) 	as X_PLACE,
-- 		(pos.Y+pos.Y_CORR+t.Y_CORR+ISNULL(w.Y_PLACE_DECENTRATED_TRAY,0)) 	as Y_PLACE,
-- 		(pos.Z+pos.Z_CORR+t.Z_CORR+pt.Z_Place) 								as Z_PLACE,
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
