-- ===========================================================================
-- vice-jaw-rollback.sql - RITORNO da vice-jaw.sql: via il catalogo delle
-- chele della morsa e le colonne che lo legano (7/10, prompt 5 di 5)
--
-- QUANDO: DOPO vice-jaw-views-rollback.sql (le viste devono essere tornate
-- alle colonne della morsa) e con il backend di prima (git checkout del
-- commit di prima e servizi-cella.ps1 -Azione aggiorna). Se una vista legge
-- ancora il catalogo lo script si FERMA senza toccare niente.
--
-- COSA FA, tutto in una transazione (o tutto o niente):
--   1. stampa il catalogo, le misure di ogni morsa e le battute: e' il
--      salvataggio di quello che si toglie (lanciare con -o, il file resta);
--   2. riporta nelle colonne della MORSA le misure del tipo montato
--      (VICE.CLAW_LENGTH, Z_CLAW, Z_SINK_CLAW = quelle di VICE_JAW, NULL se
--      la morsa non ha un tipo): le viste di prima leggono quelle, e cosi'
--      danno gli stessi numeri del catalogo di adesso;
--   3. la battuta: dove la chela montata e' diversa da quella con cui la
--      battuta e' stata dichiarata, STOP_BEYOND_CLAW prende il valore
--      corretto (STOP_BEYOND_CLAW + CLAW_LENGTH_REF/2 - CLAW_LENGTH/2, la
--      formula delle viste del 7/10). Se un valore corretto viene negativo
--      (la tabella non lo ammette) si FERMA e lo elenca;
--   4. toglie PIECE_ON_VICE.CLAW_LENGTH_REF, VICE.JAW_ID, WORKORDER.JAW_ID e
--      la tabella VICE_JAW;
--   5. sp_refreshview sulle viste di VICE, WORKORDER e PIECE_ON_VICE.
-- Il trigger VICE_trig scrive una riga in LOG per ogni morsa aggiornata.
--
-- COMANDO (cella, a cella ferma):
--   cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -i vice-jaw-rollback.sql -o D:\Backup\vice-jaw-rollback_esito.txt; Get-Content D:\Backup\vice-jaw-rollback_esito.txt
-- ===========================================================================
SET NOCOUNT ON;
GO

IF OBJECT_ID('dbo.VICE_JAW') IS NULL AND COL_LENGTH('dbo.VICE', 'JAW_ID') IS NULL
   AND COL_LENGTH('dbo.WORKORDER', 'JAW_ID') IS NULL AND COL_LENGTH('dbo.PIECE_ON_VICE', 'CLAW_LENGTH_REF') IS NULL
BEGIN
	PRINT 'Niente da togliere: catalogo e colonne non ci sono.';
	SET NOEXEC ON;
END
ELSE IF EXISTS (SELECT 1 FROM sys.views
	WHERE OBJECT_DEFINITION(object_id) LIKE N'%VICE_JAW%'
	   OR OBJECT_DEFINITION(object_id) LIKE N'%CLAW_LENGTH_REF%'
	   OR OBJECT_DEFINITION(object_id) LIKE N'%JAW_ID%')
BEGIN
	PRINT 'FERMO: queste viste leggono ancora il catalogo. Lanciare prima vice-jaw-views-rollback.sql. Nessuna modifica.';
	SELECT name FROM sys.views
	 WHERE OBJECT_DEFINITION(object_id) LIKE N'%VICE_JAW%'
	    OR OBJECT_DEFINITION(object_id) LIKE N'%CLAW_LENGTH_REF%'
	    OR OBJECT_DEFINITION(object_id) LIKE N'%JAW_ID%';
	SET NOEXEC ON;
END
ELSE IF OBJECT_ID('dbo.VICE_JAW') IS NULL OR COL_LENGTH('dbo.VICE', 'JAW_ID') IS NULL
	 OR COL_LENGTH('dbo.WORKORDER', 'JAW_ID') IS NULL OR COL_LENGTH('dbo.PIECE_ON_VICE', 'CLAW_LENGTH_REF') IS NULL
BEGIN
	PRINT 'FERMO: catalogo e colonne ci sono solo in parte. Riconciliare a mano (vice-jaw.sql le crea tutte). Nessuna modifica.';
	SET NOEXEC ON;
END
GO

PRINT '== SALVATAGGIO: catalogo delle chele ==';
EXEC (N'SELECT ID, RTRIM(CODE) AS CODE, RTRIM(DESCR) AS DESCR, CLAW_LENGTH, Z_CLAW, Z_SINK_CLAW, STATUS, EVER_MOUNTED, RTRIM(NOTE) AS NOTE FROM dbo.VICE_JAW ORDER BY ID;');
PRINT '== SALVATAGGIO: morse, misure di adesso (colonne della morsa) e del tipo montato ==';
EXEC (N'SELECT v.ID, RTRIM(v.FAMILY) AS FAMILY, v.PALLET_ID, v.JAW_ID, v.CLAW_LENGTH, v.Z_CLAW, v.Z_SINK_CLAW,
	j.CLAW_LENGTH AS J_CLAW_LENGTH, j.Z_CLAW AS J_Z_CLAW, j.Z_SINK_CLAW AS J_Z_SINK_CLAW
	FROM dbo.VICE v LEFT JOIN dbo.VICE_JAW j ON j.ID = v.JAW_ID ORDER BY v.ID;');
PRINT '== SALVATAGGIO: battute e chela con cui sono state dichiarate ==';
EXEC (N'SELECT pv.VICE_ID, pv.PIECE_ID, pv.STOP_BEYOND_CLAW, pv.CLAW_LENGTH_REF, j.CLAW_LENGTH AS MONTATA
	FROM dbo.PIECE_ON_VICE pv LEFT JOIN dbo.VICE v ON v.ID = pv.VICE_ID LEFT JOIN dbo.VICE_JAW j ON j.ID = v.JAW_ID
	ORDER BY pv.VICE_ID, pv.PIECE_ID;');
PRINT '== SALVATAGGIO: ordini con chele confermate ==';
EXEC (N'SELECT ID, STATUS, JAW_ID FROM dbo.WORKORDER WHERE JAW_ID IS NOT NULL ORDER BY ID;');
GO

-- tutto il resto in una transazione, in SQL dinamico: le colonne che si
-- tolgono non devono essere risolte alla compilazione del batch
DECLARE @sql nvarchar(max) = N'
SET XACT_ABORT ON;
BEGIN TRY
	BEGIN TRAN;
	DECLARE @neg int = (SELECT COUNT(*) FROM dbo.PIECE_ON_VICE pv JOIN dbo.VICE v ON v.ID = pv.VICE_ID JOIN dbo.VICE_JAW j ON j.ID = v.JAW_ID
		WHERE pv.CLAW_LENGTH_REF IS NOT NULL AND j.CLAW_LENGTH > 0
		  AND pv.STOP_BEYOND_CLAW + pv.CLAW_LENGTH_REF/2 - j.CLAW_LENGTH/2 < 0);
	IF @neg > 0
	BEGIN
		PRINT ''FERMO: con le chele montate alcune battute corrette verrebbero negative. Nessuna modifica. Righe:'';
		SELECT pv.VICE_ID, pv.PIECE_ID, pv.STOP_BEYOND_CLAW, pv.CLAW_LENGTH_REF, j.CLAW_LENGTH AS MONTATA,
			   pv.STOP_BEYOND_CLAW + pv.CLAW_LENGTH_REF/2 - j.CLAW_LENGTH/2 AS CORRETTA
		  FROM dbo.PIECE_ON_VICE pv JOIN dbo.VICE v ON v.ID = pv.VICE_ID JOIN dbo.VICE_JAW j ON j.ID = v.JAW_ID
		 WHERE pv.CLAW_LENGTH_REF IS NOT NULL AND j.CLAW_LENGTH > 0
		   AND pv.STOP_BEYOND_CLAW + pv.CLAW_LENGTH_REF/2 - j.CLAW_LENGTH/2 < 0;
		ROLLBACK;
		RETURN;
	END

	-- 2. misure del tipo montato nelle colonne della morsa
	UPDATE v SET CLAW_LENGTH = j.CLAW_LENGTH, Z_CLAW = j.Z_CLAW, Z_SINK_CLAW = j.Z_SINK_CLAW
	  FROM dbo.VICE v LEFT JOIN dbo.VICE_JAW j ON j.ID = v.JAW_ID;
	PRINT ''morse: misure del tipo montato riportate nelle colonne della morsa.'';

	-- 3. battuta corretta per le chele montate
	UPDATE pv SET STOP_BEYOND_CLAW = pv.STOP_BEYOND_CLAW + pv.CLAW_LENGTH_REF/2 - j.CLAW_LENGTH/2
	  FROM dbo.PIECE_ON_VICE pv JOIN dbo.VICE v ON v.ID = pv.VICE_ID JOIN dbo.VICE_JAW j ON j.ID = v.JAW_ID
	 WHERE pv.CLAW_LENGTH_REF IS NOT NULL AND j.CLAW_LENGTH > 0
	   AND pv.CLAW_LENGTH_REF/2 <> j.CLAW_LENGTH/2;
	PRINT ''battute: '' + CAST(@@ROWCOUNT AS nvarchar(12)) + '' riportate al valore corretto per le chele montate.'';

	-- 4. via colonne e tabella
	ALTER TABLE dbo.PIECE_ON_VICE DROP CONSTRAINT CK_PIECE_ON_VICE_CLAW_LENGTH_REF;
	ALTER TABLE dbo.PIECE_ON_VICE DROP COLUMN CLAW_LENGTH_REF;
	ALTER TABLE dbo.VICE DROP COLUMN JAW_ID;
	ALTER TABLE dbo.WORKORDER DROP COLUMN JAW_ID;
	DROP TABLE dbo.VICE_JAW;
	COMMIT;
	PRINT ''tolti PIECE_ON_VICE.CLAW_LENGTH_REF, VICE.JAW_ID, WORKORDER.JAW_ID e VICE_JAW.'';
END TRY
BEGIN CATCH
	IF @@TRANCOUNT > 0 ROLLBACK;
	PRINT ''FERMO: ritorno NON riuscito, annullato per intero ('' + ERROR_MESSAGE() + '').'';
END CATCH';
EXEC (@sql);
GO

-- 5. le viste di VICE, WORKORDER e PIECE_ON_VICE (VICES e' di nuovo v.*)
DECLARE @v sysname, @msg nvarchar(400);
DECLARE c CURSOR LOCAL FAST_FORWARD FOR
	SELECT DISTINCT OBJECT_SCHEMA_NAME(d.referencing_id) + N'.' + OBJECT_NAME(d.referencing_id)
	  FROM sys.sql_expression_dependencies d
	  JOIN sys.views w ON w.object_id = d.referencing_id
	 WHERE d.referenced_entity_name IN (N'VICE', N'WORKORDER', N'PIECE_ON_VICE')
	   AND OBJECTPROPERTY(d.referencing_id, 'IsSchemaBound') = 0;
OPEN c;
FETCH NEXT FROM c INTO @v;
WHILE @@FETCH_STATUS = 0
BEGIN
	BEGIN TRY
		EXEC sp_refreshview @v;
		SET @msg = N'refresh vista ' + @v + N': ok';
	END TRY
	BEGIN CATCH
		SET @msg = N'refresh vista ' + @v + N': NON riuscito (' + ERROR_MESSAGE() + N')';
	END CATCH
	PRINT @msg;
	FETCH NEXT FROM c INTO @v;
END
CLOSE c;
DEALLOCATE c;
GO
SET NOEXEC OFF;
GO

PRINT '== DOPO ==';
SELECT CASE WHEN OBJECT_ID('dbo.VICE_JAW') IS NULL THEN 'tolta' ELSE 'C''E'' ANCORA' END AS VICE_JAW,
	   CASE WHEN COL_LENGTH('dbo.VICE', 'JAW_ID') IS NULL THEN 'tolta' ELSE 'C''E'' ANCORA' END AS VICE_JAW_ID,
	   CASE WHEN COL_LENGTH('dbo.WORKORDER', 'JAW_ID') IS NULL THEN 'tolta' ELSE 'C''E'' ANCORA' END AS WORKORDER_JAW_ID,
	   CASE WHEN COL_LENGTH('dbo.PIECE_ON_VICE', 'CLAW_LENGTH_REF') IS NULL THEN 'tolta' ELSE 'C''E'' ANCORA' END AS CLAW_LENGTH_REF;
GO
