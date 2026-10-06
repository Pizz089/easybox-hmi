-- ===========================================================================
-- rollback-wo.sql - ritorno dal work object per cassetto al riferimento
-- unico della cassettiera (6/10)
--
-- Annulla, in UNA transazione, i due passi SQL della fermata di passaggio:
--   1. vista COORDINATES_PIECES_TRAYS_4Robot: dalla v4 alla v3
--      (robot-tray-view-v4.sql);
--   2. righe [POSITION] EXTRACT_TRAY_n: tornano ESATTAMENTE com'erano prima
--      del passaggio, X/Y/Z e X/Y/Z_CORR, dalla tabella di backup
--      dbo.POSITION_EXTRACT_PRE_WO (extract-coords-workobject.sql).
-- Dopo il ripristino la tabella di backup viene RINOMINATA in
-- POSITION_EXTRACT_PRE_WO_ANNULLATO_<data_ora>: resta come storia e lo script
-- di estrazione si puo' rilanciare per un nuovo passaggio.
--
-- QUANDO: solo INSIEME al ritorno del robot al riferimento unico. Con il robot
-- ancora sui work object, quote assolute = cassetto 8 a Z 755 mm dal suo WO.
-- Per questo parte solo con -v ROBOT_RIF_UNICO=SI.
--
-- COMANDO (da PowerShell, in cella; il file in D:\Backup e' il resoconto,
-- con le correzioni a mano che il ripristino scarta):
--
--   cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -v ROBOT_RIF_UNICO=SI -i rollback-wo.sql -o D:\Backup\rollback_wo.txt; Get-Content D:\Backup\rollback_wo.txt
--
-- NON TOCCA: la tabella TRAY, le tasche, il PLC (N_Cassetto resta: il robot
-- sul riferimento unico lo ignora), il pannello (avvisi e "0 CASSETTIERA"
-- eliminato restano finche' CC non annulla quei commit).
--
-- STATI GESTITI (riconoscimento della vista a spazi normalizzati, dalla
-- "select" in poi, come robot-tray-view-v4.sql):
--   - vista v4 + backup presente            -> annulla tutti e due i passi;
--   - vista v3 + backup presente            -> annulla solo le quote;
--   - vista v4 + nessun backup, quote ancora assolute -> annulla solo la vista
--     (fermata interrotta prima dello script di estrazione);
--   - vista v3 + nessun backup, quote assolute -> niente da annullare;
--   - qualunque altro caso                  -> FERMO, nessuna modifica.
-- Con il backup presente: 12 righe nel backup, 12 righe EXTRACT, stesso ID e
-- stesso PARENT, altrimenti FERMO.
--
-- AVVISI (non fermano): TRAY non e' nel backup. Se le correzioni TRAY di un
-- piano sono cambiate dopo il passaggio, con la v3 le quote delle tasche di
-- quel piano usano i valori nuovi. Lo script lo ricava confrontando backup e
-- quote attuali (al passaggio: attuale = backup - TRAY) e segna i piani
-- DA CONTROLLARE. Lo stesso segno compare se dopo il passaggio qualcuno ha
-- modificato a mano X/Y/Z della riga di estrazione (il ripristino le scarta).
--
-- Il testo della v3 e della v4 qui sotto e' lo stesso di
-- robot-tray-view-v4.sql (test_rollback_wo.js controlla che coincidano).
-- ===========================================================================
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @def nvarchar(max), @nDef nvarchar(max), @nV3 nvarchar(max), @nV4 nvarchar(max), @nNew nvarchar(max);
DECLARE @vista varchar(2), @bk bit, @estr varchar(10);
DECLARE @nRighe int, @nBk int, @nAss int, @nRel int, @nAbs int, @nOk int, @nControllo int, @nRitocchi int;
DECLARE @ts nvarchar(20), @nomeBk nvarchar(128);

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

DECLARE @v4 nvarchar(max) = N'select  pt.id as partType,
		CASE WHEN pos.PARENT LIKE ''TRAY[_]%'' THEN SUBSTRING(pos.PARENT,6,2) END AS TRAY,
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

IF '$(ROBOT_RIF_UNICO)' <> 'SI'
BEGIN
	PRINT 'FERMO: manca -v ROBOT_RIF_UNICO=SI. Il rollback va lanciato solo insieme al ritorno del robot al riferimento unico della cassettiera.';
	RETURN;
END

-- 1. stato della vista ---------------------------------------------------------
SET @def = OBJECT_DEFINITION(OBJECT_ID('COORDINATES_PIECES_TRAYS_4Robot'));
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
SELECT @nDef = txt FROM @t WHERE k = 'def';
SELECT @nV3 = txt FROM @t WHERE k = 'v3';
SELECT @nV4 = txt FROM @t WHERE k = 'v4';

IF @def IS NULL
BEGIN
	PRINT 'FERMO: COORDINATES_PIECES_TRAYS_4Robot assente o cifrata. Nessuna modifica.';
	RETURN;
END
IF @nDef = @nV4 SET @vista = 'v4';
ELSE IF @nDef = @nV3 SET @vista = 'v3';
ELSE
BEGIN
	PRINT 'FERMO: la vista non e'' ne'' la v4 ne'' la v3. Nessuna modifica. Definizione trovata:';
	SELECT @def AS definizione_trovata;
	RETURN;
END
PRINT 'vista trovata: ' + @vista;

-- 2. stato delle quote di estrazione ---------------------------------------------
SELECT @nRighe = COUNT(*) FROM [POSITION] WHERE PARENT LIKE 'EXTRACT%';

-- quote "relative": Z effettiva entro 150 mm (altezza della maniglia dal fondo)
-- quote "assolute": Z effettiva meno TRAY.Z_CORR del piano entro 150 mm
-- (il piano 1, con TRAY.Z_CORR 0, conta in tutte e due)
SELECT @nRel = SUM(CASE WHEN p.Z + ISNULL(p.Z_CORR,0) BETWEEN 0 AND 150000 THEN 1 ELSE 0 END),
	@nAbs = SUM(CASE WHEN p.Z + ISNULL(p.Z_CORR,0) - ISNULL(t.Z_CORR,0) BETWEEN 0 AND 150000 THEN 1 ELSE 0 END)
FROM [POSITION] p
LEFT JOIN TRAY t ON t.FLOOR_MAG = CAST(SUBSTRING(p.PARENT,14,50) AS int)
WHERE p.PARENT LIKE 'EXTRACT%';
SET @estr = CASE WHEN @nAbs = 12 AND @nRel < 12 THEN 'assolute'
	WHEN @nRel = 12 AND @nAbs < 12 THEN 'relative' ELSE 'incerte' END;
SET @bk = CASE WHEN OBJECT_ID('dbo.POSITION_EXTRACT_PRE_WO','U') IS NOT NULL THEN 1 ELSE 0 END;
PRINT 'righe EXTRACT: ' + CAST(@nRighe AS varchar(10)) + ', quote di estrazione: ' + @estr
	+ ', backup dbo.POSITION_EXTRACT_PRE_WO: ' + CASE WHEN @bk = 1 THEN 'presente' ELSE 'assente' END;

IF @bk = 0
BEGIN
	IF @vista = 'v3' AND @estr = 'assolute'
	BEGIN
		PRINT 'Niente da annullare: vista v3 e quote di estrazione assolute. Nessuna modifica.';
		RETURN;
	END
	IF NOT (@vista = 'v4' AND @estr = 'assolute')
	BEGIN
		PRINT 'FERMO: nessun backup delle quote di estrazione e quote non assolute (o vista v3 con quote relative): va ricostruito a mano. Nessuna modifica.';
		RETURN;
	END
	PRINT 'Nessun backup e quote ancora assolute: lo script di estrazione non era stato lanciato. Si annulla solo la vista.';
END
ELSE
BEGIN
	SELECT @nBk = COUNT(*) FROM dbo.POSITION_EXTRACT_PRE_WO;
	SELECT @nAss = COUNT(*) FROM [POSITION] p
	JOIN dbo.POSITION_EXTRACT_PRE_WO b ON b.ID = p.ID AND RTRIM(b.PARENT) = RTRIM(p.PARENT)
	WHERE p.PARENT LIKE 'EXTRACT%';
	PRINT 'righe nel backup: ' + CAST(@nBk AS varchar(10)) + ' (attese 12), righe EXTRACT con stesso ID e PARENT: ' + CAST(@nAss AS varchar(10)) + ' (attese 12)';
	IF @nBk <> 12 OR @nRighe <> 12 OR @nAss <> 12
	BEGIN
		PRINT 'FERMO: backup e righe di estrazione non corrispondono. Nessuna modifica.';
		RETURN;
	END

	PRINT '=== PRIMA: quote attuali, backup (prima del passaggio), TRAY ===';
	SELECT RTRIM(p.PARENT) AS PARENT,
		p.X AS X_ORA, p.Y AS Y_ORA, p.Z AS Z_ORA, p.X_CORR AS XC_ORA, p.Y_CORR AS YC_ORA, p.Z_CORR AS ZC_ORA,
		b.X AS X_BK, b.Y AS Y_BK, b.Z AS Z_BK, b.X_CORR AS XC_BK, b.Y_CORR AS YC_BK, b.Z_CORR AS ZC_BK,
		t.X_CORR AS TRAY_X, t.Y_CORR AS TRAY_Y, t.Z_CORR AS TRAY_Z,
		b.X - p.X AS TRAY_X_AL_PASSAGGIO, b.Y - p.Y AS TRAY_Y_AL_PASSAGGIO, b.Z - p.Z AS TRAY_Z_AL_PASSAGGIO,
		CASE WHEN b.X - p.X <> ISNULL(t.X_CORR,0) OR b.Y - p.Y <> ISNULL(t.Y_CORR,0) OR b.Z - p.Z <> ISNULL(t.Z_CORR,0)
			THEN 'DA CONTROLLARE' ELSE 'ok' END AS TRAY_O_QUOTA,
		CASE WHEN ISNULL(p.X_CORR,0) <> ISNULL(b.X_CORR,0) OR ISNULL(p.Y_CORR,0) <> ISNULL(b.Y_CORR,0) OR ISNULL(p.Z_CORR,0) <> ISNULL(b.Z_CORR,0)
			THEN 'RITOCCATE (scartate)' ELSE 'come prima' END AS CORREZIONI_RIGA
	FROM [POSITION] p
	JOIN dbo.POSITION_EXTRACT_PRE_WO b ON b.ID = p.ID
	LEFT JOIN TRAY t ON t.FLOOR_MAG = CAST(SUBSTRING(p.PARENT,14,50) AS int)
	WHERE p.PARENT LIKE 'EXTRACT%'
	ORDER BY CAST(SUBSTRING(p.PARENT,14,50) AS int);

	SELECT @nControllo = SUM(CASE WHEN b.X - p.X <> ISNULL(t.X_CORR,0) OR b.Y - p.Y <> ISNULL(t.Y_CORR,0) OR b.Z - p.Z <> ISNULL(t.Z_CORR,0) THEN 1 ELSE 0 END),
		@nRitocchi = SUM(CASE WHEN ISNULL(p.X_CORR,0) <> ISNULL(b.X_CORR,0) OR ISNULL(p.Y_CORR,0) <> ISNULL(b.Y_CORR,0) OR ISNULL(p.Z_CORR,0) <> ISNULL(b.Z_CORR,0) THEN 1 ELSE 0 END)
	FROM [POSITION] p
	JOIN dbo.POSITION_EXTRACT_PRE_WO b ON b.ID = p.ID
	LEFT JOIN TRAY t ON t.FLOOR_MAG = CAST(SUBSTRING(p.PARENT,14,50) AS int)
	WHERE p.PARENT LIKE 'EXTRACT%';
END

-- 3. annullamento, tutto o niente ---------------------------------------------------
BEGIN TRAN;

IF @vista = 'v4'
	EXEC (N'ALTER VIEW COORDINATES_PIECES_TRAYS_4Robot AS ' + @v3);

IF @bk = 1
BEGIN
	UPDATE p SET
		p.X = b.X, p.Y = b.Y, p.Z = b.Z,
		p.X_CORR = b.X_CORR, p.Y_CORR = b.Y_CORR, p.Z_CORR = b.Z_CORR
	FROM [POSITION] p
	JOIN dbo.POSITION_EXTRACT_PRE_WO b ON b.ID = p.ID
	WHERE p.PARENT LIKE 'EXTRACT%';

	SELECT @nOk = COUNT(*) FROM [POSITION] p
	JOIN dbo.POSITION_EXTRACT_PRE_WO b ON b.ID = p.ID
	WHERE p.PARENT LIKE 'EXTRACT%'
		AND p.X = b.X AND p.Y = b.Y AND p.Z = b.Z
		AND ISNULL(p.X_CORR,0) = ISNULL(b.X_CORR,0)
		AND ISNULL(p.Y_CORR,0) = ISNULL(b.Y_CORR,0)
		AND ISNULL(p.Z_CORR,0) = ISNULL(b.Z_CORR,0);
	IF @nOk <> 12
	BEGIN
		ROLLBACK TRAN;
		PRINT 'FERMO: dopo il ripristino le righe uguali al backup sono ' + CAST(@nOk AS varchar(10)) + ' invece di 12. Annullato tutto, vista compresa.';
		RETURN;
	END

	SET @ts = CONVERT(nvarchar(8), GETDATE(), 112) + N'_' + REPLACE(CONVERT(nvarchar(8), GETDATE(), 108), N':', N'');
	SET @nomeBk = N'POSITION_EXTRACT_PRE_WO_ANNULLATO_' + @ts;
	EXEC sp_rename N'dbo.POSITION_EXTRACT_PRE_WO', @nomeBk;
END

-- la vista deve essere la v3
SET @def = OBJECT_DEFINITION(OBJECT_ID('COORDINATES_PIECES_TRAYS_4Robot'));
INSERT INTO @t VALUES ('new', ISNULL(@def, N''));
UPDATE @t SET txt = REPLACE(REPLACE(REPLACE(txt, CHAR(13), N' '), CHAR(10), N' '), CHAR(9), N' ') WHERE k = 'new';
WHILE EXISTS (SELECT 1 FROM @t WHERE k = 'new' AND CHARINDEX(N'  ', txt) > 0)
	UPDATE @t SET txt = REPLACE(txt, N'  ', N' ') WHERE k = 'new';
UPDATE @t SET txt = LTRIM(RTRIM(txt)) WHERE k = 'new';
UPDATE @t SET txt = RTRIM(LEFT(txt, LEN(txt) - 1)) WHERE k = 'new' AND RIGHT(txt, 1) = N';';
UPDATE @t SET txt = SUBSTRING(txt, CHARINDEX(N'select pt.id as partType', txt), LEN(txt))
	WHERE k = 'new' AND CHARINDEX(N'select pt.id as partType', txt) > 0;
UPDATE @t SET txt = N'' WHERE k = 'new' AND CHARINDEX(N'select pt.id as partType', txt) <> 1;
SELECT @nNew = txt FROM @t WHERE k = 'new';
IF @nNew <> @nV3
BEGIN
	ROLLBACK TRAN;
	PRINT 'FERMO: dopo l''ALTER la vista non risulta la v3. Annullato tutto, quote comprese.';
	RETURN;
END

COMMIT TRAN;

-- 4. resoconto (sola lettura) ---------------------------------------------------------
PRINT '=== DOPO ===';
PRINT 'vista: v3' + CASE WHEN @vista = 'v4' THEN ' (riportata dalla v4)' ELSE ' (era gia'' v3)' END;
IF @bk = 1
	PRINT 'quote di estrazione: ripristinate dal backup (12 righe); backup rinominato in dbo.' + @nomeBk;

PRINT 'COORDINATES_FOR_EXTRACT (quello che legge FB7):';
SELECT TRAY, MAG, X, Y, Z, X_ROT, Y_ROT, Z_ROT, APPROACH_TYPE, APPROACH_X, APPROACH_Y, APPROACH_Z
FROM COORDINATES_FOR_EXTRACT ORDER BY TRAY;

PRINT 'cassetto 8, tasche 1/13/40/52 con la v3 (Z_PICK di nuovo con TRAY.Z_CORR del piano):';
SELECT TRAY, SUB_POS, X_PICK, Y_PICK, Z_PICK, X_ROT, Y_ROT, Z_ROT
FROM COORDINATES_PIECES_TRAYS_4Robot
WHERE TRAY = '8' AND SUB_POS IN (1, 13, 40, 52)
ORDER BY SUB_POS;

IF ISNULL(@nControllo,0) > 0
	PRINT 'ATTENZIONE: ' + CAST(@nControllo AS varchar(10)) + ' piani DA CONTROLLARE (tabella PRIMA): correzioni TRAY cambiate dopo il passaggio, o quote di estrazione modificate a mano. Con la v3 le tasche usano le correzioni TRAY attuali: controllarle prima di muovere il robot.';
IF ISNULL(@nRitocchi,0) > 0
	PRINT 'NOTA: ' + CAST(@nRitocchi AS varchar(10)) + ' righe avevano correzioni a mano fatte dopo il passaggio: sono state scartate, i valori sono nella tabella PRIMA.';
PRINT 'FATTO: rollback dei work object per cassetto.';
