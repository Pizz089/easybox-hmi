-- ===========================================================================
-- vices-view.sql - vista VICES (lettura delle morse dal pannello) con le
-- misure della chela dal CATALOGO (7/10, prompt 5 di 5)
--
-- PERCHE'. VICES era SELECT v.*: le tre misure della chela uscivano dalle
-- colonne della morsa. Dal 7/10 il dato e' nel catalogo (VICE_JAW, il tipo
-- montato: VICE.JAW_ID). La vista elenca le colonne PER ESTESO e prende le
-- tre misure da j CON LO STESSO NOME (CLAW_LENGTH, Z_CLAW, Z_SINK_CLAW): chi
-- legge VICES non cambia (CONF/Vice.js, e da li' form morsa, Spinta in
-- battuta, wizard, Attrezzaggi). In piu' JAW_ID e JAW_CODE, il codice del
-- tipo montato. Le colonne vecchie della morsa restano in tabella e non si
-- leggono piu'.
-- Chi legge VICES (verificato il 7/10): solo il backend (CONF/Vice.js). Il
-- PLC no (FB_Robot legge COORDINATES_Z_MC, _PUSH_MC e _BLOW_MC), nessuna
-- vista ne' procedura sul clone del 6/10 (sys.sql_expression_dependencies).
--
-- GUARDIE:
--   - colonne di VICE: la vista nuova le elenca a mano, quindi VICE non deve
--     averne di diverse da quelle note, altrimenti la vista le perderebbe:
--     FERMO con l'elenco;
--   - definizione: si confronta il CODICE (commenti "--" tolti, TUTTI gli
--     spazi tolti, minuscole, dalla prima "select"): versione nuova ->
--     "conforme"; versione di prima (SELECT v.*) -> stampa la definizione
--     trovata e ALTER; vista assente -> CREATE; altro -> FERMO.
--   - (8/10) dopo CREATE o ALTER la definizione si RILEGGE e si confronta col
--     codice atteso: se non e' quella, FERMO (prima "misure dal catalogo" si
--     stampava senza ricontrollare).
--
-- ORDINE DI DEPLOY: DOPO vice-jaw.sql. Insieme agli script delle tre viste
-- del PLC (vedi APPUNTI-CELLA, procedura del catalogo chele).
--   cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -y 0 -i vices-view.sql -o D:\Backup\vices-view_esito.txt; Get-Content D:\Backup\vices-view_esito.txt
--
-- RITORNO: vice-jaw-rollback.sql (riporta SELECT v.*).
-- ===========================================================================
SET NOCOUNT ON;

IF OBJECT_ID('dbo.VICE_JAW') IS NULL OR COL_LENGTH('dbo.VICE', 'JAW_ID') IS NULL
BEGIN
	PRINT 'MANCANO tabella o colonne: eseguire prima vice-jaw.sql. Nessuna modifica.';
	SET NOEXEC ON;
END
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.VICE')
	AND name NOT IN (N'ID', N'FAMILY', N'DESCR', N'STATUS', N'X', N'Y', N'Z', N'Z_CLAW', N'Z_SINK_CLAW',
					 N'MAG', N'MAG_POS', N'POS_PLANT', N'PALLET_ID', N'CLAW_LENGTH', N'JAW_ID'))
BEGIN
	PRINT 'FERMO: VICE ha colonne che la vista nuova non elenca (le perderebbe). Nessuna modifica. Colonne in piu'':';
	SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.VICE')
	   AND name NOT IN (N'ID', N'FAMILY', N'DESCR', N'STATUS', N'X', N'Y', N'Z', N'Z_CLAW', N'Z_SINK_CLAW',
						N'MAG', N'MAG_POS', N'POS_PLANT', N'PALLET_ID', N'CLAW_LENGTH', N'JAW_ID');
	SET NOEXEC ON;
END
GO

DECLARE @def nvarchar(max) = OBJECT_DEFINITION(OBJECT_ID('dbo.VICES'));
DECLARE @vecchia nvarchar(max) = N'SELECT v.*, ST.DESCR AS STATUS_DESC
FROM VICE v , [_STATUS_TYPE] st
WHERE v.STATUS =ST.ID';
DECLARE @nuova nvarchar(max) = N'SELECT v.ID, v.FAMILY, v.DESCR, v.STATUS, v.X, v.Y, v.Z,
	-- (7/10) le tre misure della chela dal tipo montato, stesso nome di prima
	j.Z_CLAW AS Z_CLAW,
	j.Z_SINK_CLAW AS Z_SINK_CLAW,
	v.MAG, v.MAG_POS, v.POS_PLANT, v.PALLET_ID,
	j.CLAW_LENGTH AS CLAW_LENGTH,
	-- (7/10) il tipo montato
	v.JAW_ID,
	RTRIM(j.CODE) AS JAW_CODE,
	ST.DESCR AS STATUS_DESC
FROM VICE v
INNER JOIN [_STATUS_TYPE] st ON v.STATUS = st.ID
LEFT JOIN VICE_JAW j ON j.ID = v.JAW_ID';

-- confronto del codice: via i commenti, via tutti gli spazi, minuscole
DECLARE @t TABLE (k int PRIMARY KEY, s nvarchar(max));
INSERT INTO @t VALUES (1, ISNULL(@def, N'')), (2, @vecchia), (3, @nuova);
DECLARE @k int = 1, @i int, @j int, @s nvarchar(max);
WHILE @k <= 3
BEGIN
	SET @s = (SELECT s FROM @t WHERE k = @k);
	WHILE CHARINDEX(N'--', @s) > 0
	BEGIN
		SET @i = CHARINDEX(N'--', @s);
		SET @j = CHARINDEX(CHAR(10), @s, @i);
		IF @j = 0 SET @j = LEN(@s) + 1;
		SET @s = STUFF(@s, @i, @j - @i, N'');
	END
	SET @s = LOWER(REPLACE(REPLACE(REPLACE(REPLACE(@s, CHAR(13), N''), CHAR(10), N''), CHAR(9), N''), N' ', N''));
	IF RIGHT(@s, 1) = N';' SET @s = LEFT(@s, LEN(@s) - 1);
	IF CHARINDEX(N'select', @s) > 0 SET @s = SUBSTRING(@s, CHARINDEX(N'select', @s), LEN(@s));
	UPDATE @t SET s = @s WHERE k = @k;
	SET @k = @k + 1;
END
DECLARE @a nvarchar(max) = (SELECT s FROM @t WHERE k = 1),
		@o nvarchar(max) = (SELECT s FROM @t WHERE k = 2),
		@n nvarchar(max) = (SELECT s FROM @t WHERE k = 3);
-- il codice atteso, per rileggere la vista dopo (batch dopo)
IF OBJECT_ID('tempdb..#attesa') IS NOT NULL DROP TABLE #attesa;
CREATE TABLE #attesa (s nvarchar(max));
INSERT INTO #attesa VALUES (@n);

IF @def IS NULL AND OBJECT_ID('dbo.VICES') IS NULL
BEGIN
	EXEC (N'CREATE VIEW dbo.VICES AS ' + @nuova);
END
ELSE IF @a = @n
	PRINT 'VICES: gia'' con le misure dal catalogo, conforme, nessuna modifica.';
ELSE IF @a = @o
BEGIN
	PRINT 'VICES: trovata la versione SELECT v.*. Definizione trovata, da tenere per il ritorno:';
	SELECT @def AS definizione_trovata;
	EXEC (N'ALTER VIEW dbo.VICES AS ' + @nuova);
END
ELSE
BEGIN
	PRINT 'FERMO: VICES non e'' nessuna delle versioni note. Nessuna modifica. Definizione trovata:';
	SELECT @def AS definizione_trovata;
END
GO
SET NOEXEC OFF;
GO

-- (8/10) la definizione si RILEGGE (stessa normalizzazione della guardia)
IF OBJECT_ID('tempdb..#attesa') IS NOT NULL
BEGIN
	DECLARE @s nvarchar(max) = ISNULL(OBJECT_DEFINITION(OBJECT_ID('dbo.VICES')), N''), @i int, @j int;
	WHILE CHARINDEX(N'--', @s) > 0
	BEGIN
		SET @i = CHARINDEX(N'--', @s);
		SET @j = CHARINDEX(CHAR(10), @s, @i);
		IF @j = 0 SET @j = LEN(@s) + 1;
		SET @s = STUFF(@s, @i, @j - @i, N'');
	END
	SET @s = LOWER(REPLACE(REPLACE(REPLACE(REPLACE(@s, CHAR(13), N''), CHAR(10), N''), CHAR(9), N''), N' ', N''));
	IF RIGHT(@s, 1) = N';' SET @s = LEFT(@s, LEN(@s) - 1);
	IF CHARINDEX(N'select', @s) > 0 SET @s = SUBSTRING(@s, CHARINDEX(N'select', @s), LEN(@s));
	IF @s = (SELECT s FROM #attesa)
		PRINT 'VICES: riletta, misure della chela dal catalogo, colonne per esteso, JAW_ID e JAW_CODE.';
	ELSE
		PRINT 'FERMO: VICES riletta NON e'' la versione con le misure dal catalogo (vedi sopra).';
	DROP TABLE #attesa;
END
GO

-- VERIFICA (sola lettura): le misure della vista sono quelle del tipo montato
IF OBJECT_ID('dbo.VICE_JAW') IS NOT NULL AND COL_LENGTH('dbo.VICES', 'JAW_CODE') IS NOT NULL
BEGIN
	PRINT 'VERIFICA: misure di VICES = misure del tipo montato (atteso: nessuna riga)';
	EXEC (N'SELECT s.ID FROM dbo.VICES s JOIN dbo.VICE v ON v.ID = s.ID LEFT JOIN dbo.VICE_JAW j ON j.ID = v.JAW_ID
	 WHERE ISNULL(s.CLAW_LENGTH, -1) <> ISNULL(j.CLAW_LENGTH, -1) OR ISNULL(s.Z_CLAW, -1) <> ISNULL(j.Z_CLAW, -1)
	    OR ISNULL(s.Z_SINK_CLAW, -1) <> ISNULL(j.Z_SINK_CLAW, -1);');
END
