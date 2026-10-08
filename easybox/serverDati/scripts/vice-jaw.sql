-- ===========================================================================
-- vice-jaw.sql - catalogo delle CHELE DELLA MORSA (VICE_JAW) e colonne che lo
-- legano a morsa, ordine e battuta (prompt 5 di 5, 7/10)
--
-- PERCHE'. Il cliente vuole un punto dove dichiarare le chele della morsa con
-- le loro misure, e ritrovarle quando le rimonta. Decisione di Dario (7/10):
-- CATALOGO PER RIFERIMENTO. La morsa punta al tipo di chele montato
-- (VICE.JAW_ID) e le tre viste lette dal PLC prendono le misure dal catalogo:
-- dato unico. Le viste si cambiano DOPO, con gli script delle viste
-- (coordinates-z-mc.sql, coordinates-push-mc.sql, coordinates-blow-mc.sql,
-- vices-view.sql): questo script non tocca nessuna vista lette dal PLC.
--
-- COSA FA, in quest'ordine, e ogni passo e' ripetibile:
--   1. tabella VICE_JAW (stessi nomi di colonna di VICE per le tre misure:
--      nelle viste cambia solo l'alias);
--   2. colonne nuove, tutte int NULL:
--        VICE.JAW_ID                  il tipo montato, NULL = nessuno;
--        WORKORDER.JAW_ID             il tipo con cui l'ordine e' stato
--                                     confermato, NULL negli ordini di prima;
--        PIECE_ON_VICE.CLAW_LENGTH_REF  la lunghezza della chela con cui la
--                                     battuta e' stata dichiarata (micron).
--      Dopo le colonne, sp_refreshview sulle viste che leggono quelle tabelle
--      (VICES e' SELECT v.*: senza refresh non vede la colonna nuova);
--   3. MIGRAZIONE, una volta sola (solo se VICE_JAW e' vuota e nessuna morsa
--      ha gia' un tipo):
--        - per ogni morsa con almeno una delle tre misure non nulla, un tipo
--          "Chele attuali <famiglia morsa>" con le sue misure, montato su
--          quella morsa (se due morse hanno la stessa famiglia, al codice si
--          aggiunge l'ID della morsa: il codice e' unico);
--        - CLAW_LENGTH_REF delle righe di PIECE_ON_VICE = VICE.CLAW_LENGTH
--          della loro morsa (la battuta e' stata dichiarata con quella).
--      Cosi' le tre viste, dopo il loro script, danno righe IDENTICHE al
--      micron: nessun ordine ha ancora JAW_ID e le misure sono le stesse.
--      Le colonne vecchie di VICE (CLAW_LENGTH, Z_CLAW, Z_SINK_CLAW) RESTANO
--      COM'ERANO, per il ritorno indietro: non si cancellano, non si
--      rinominano, e da qui in poi nessuno le scrive.
--
-- ZERI E NEGATIVI NELLE MISURE VECCHIE. Nel catalogo lunghezza e altezza sono
-- > 0 e l'affondo >= 0 (lo zero dell'affondo e' un valore vero: chela
-- piatta). Una lunghezza o un'altezza a 0 nella morsa diventa NULL nel tipo:
-- nelle tre viste 0 e NULL danno lo stesso numero (ISNULL a 0, oppure NO_DATA
-- per la spinta), quindi le righe restano identiche. Un valore NEGATIVO
-- invece cambierebbe il risultato: se ce n'e' uno la migrazione si FERMA,
-- elenca le morse e non scrive niente.
--
-- IL TRIGGER VICE_trig (AFTER UPDATE) scrive una riga in LOG per ogni morsa
-- a cui la migrazione monta il tipo: e' atteso.
--
-- GUARDIA DI MACCHINA: nessuna. Lo script e' idempotente e non distruttivo:
-- crea, aggiunge, scrive solo colonne nuove.
--
-- COMANDO (cella, a cella ferma, dopo il backup del DB verificato):
--   cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -i vice-jaw.sql -o D:\Backup\vice-jaw_esito.txt; Get-Content D:\Backup\vice-jaw_esito.txt
--
-- ROLLBACK: vice-jaw-rollback.sql, DOPO vice-jaw-views-rollback.sql.
-- ===========================================================================
SET NOCOUNT ON;
GO

PRINT '== CONTEGGI PRIMA ==';
SELECT (SELECT COUNT(*) FROM dbo.VICE) AS morse,
       (SELECT COUNT(*) FROM dbo.VICE WHERE CLAW_LENGTH IS NOT NULL OR Z_CLAW IS NOT NULL OR Z_SINK_CLAW IS NOT NULL) AS morse_con_misure,
       (SELECT COUNT(*) FROM dbo.PIECE_ON_VICE) AS battute,
       (SELECT COUNT(*) FROM dbo.WORKORDER) AS ordini,
       CASE WHEN OBJECT_ID('dbo.VICE_JAW') IS NULL THEN -1 ELSE (SELECT SUM(p.rows) FROM sys.partitions p WHERE p.object_id = OBJECT_ID('dbo.VICE_JAW') AND p.index_id IN (0, 1)) END AS tipi_chele;
GO

-- 1. tabella del catalogo -----------------------------------------------------
IF OBJECT_ID('dbo.VICE_JAW') IS NOT NULL
	PRINT 'VICE_JAW gia'' presente: niente da fare.';
ELSE BEGIN
	CREATE TABLE dbo.VICE_JAW (
		ID				int IDENTITY(1,1) NOT NULL CONSTRAINT PK_VICE_JAW PRIMARY KEY,
		CODE			nvarchar(100) NOT NULL,
		DESCR			nvarchar(200) NULL,
		-- micron, come le colonne omonime di VICE
		CLAW_LENGTH		int NULL,	-- lunghezza sull'asse di battuta
		Z_CLAW			int NULL,	-- altezza della chela
		Z_SINK_CLAW		int NULL,	-- affondo del pezzo nella chela (0 = piatta)
		-- 1 attivo, 0 dismesso (un tipo dismesso non si monta)
		STATUS			tinyint NOT NULL CONSTRAINT DF_VICE_JAW_STATUS DEFAULT 1,
		NOTE			nvarchar(1000) NULL,
		-- 1 dal primo montaggio, e non torna a 0: un tipo montato almeno una
		-- volta non si cancella, si dismette
		EVER_MOUNTED	bit NOT NULL CONSTRAINT DF_VICE_JAW_EVER_MOUNTED DEFAULT 0,
		CONSTRAINT UQ_VICE_JAW_CODE UNIQUE (CODE),
		CONSTRAINT CK_VICE_JAW_CLAW_LENGTH CHECK (CLAW_LENGTH IS NULL OR CLAW_LENGTH > 0),
		CONSTRAINT CK_VICE_JAW_Z_CLAW CHECK (Z_CLAW IS NULL OR Z_CLAW > 0),
		CONSTRAINT CK_VICE_JAW_Z_SINK_CLAW CHECK (Z_SINK_CLAW IS NULL OR Z_SINK_CLAW >= 0),
		CONSTRAINT CK_VICE_JAW_STATUS CHECK (STATUS IN (0, 1))
	);
	PRINT 'VICE_JAW creata.';
END
GO

-- 2. colonne nuove ------------------------------------------------------------
IF COL_LENGTH('dbo.VICE', 'JAW_ID') IS NOT NULL
	PRINT 'VICE.JAW_ID gia'' presente.';
ELSE BEGIN
	ALTER TABLE dbo.VICE ADD JAW_ID int NULL;
	PRINT 'VICE.JAW_ID aggiunta (int NULL: il tipo di chele montato).';
END
GO
IF COL_LENGTH('dbo.WORKORDER', 'JAW_ID') IS NOT NULL
	PRINT 'WORKORDER.JAW_ID gia'' presente.';
ELSE BEGIN
	ALTER TABLE dbo.WORKORDER ADD JAW_ID int NULL;
	PRINT 'WORKORDER.JAW_ID aggiunta (int NULL: le chele con cui l''ordine e'' stato confermato).';
END
GO
IF COL_LENGTH('dbo.PIECE_ON_VICE', 'CLAW_LENGTH_REF') IS NOT NULL
	PRINT 'PIECE_ON_VICE.CLAW_LENGTH_REF gia'' presente.';
ELSE BEGIN
	ALTER TABLE dbo.PIECE_ON_VICE ADD CLAW_LENGTH_REF int NULL
		CONSTRAINT CK_PIECE_ON_VICE_CLAW_LENGTH_REF CHECK (CLAW_LENGTH_REF IS NULL OR CLAW_LENGTH_REF > 0);
	PRINT 'PIECE_ON_VICE.CLAW_LENGTH_REF aggiunta (int NULL, micron: la chela con cui e'' stata dichiarata la battuta).';
END
GO

-- sp_refreshview sulle viste che leggono le tre tabelle: una vista con
-- l'asterisco (VICES) non vede da sola le colonne nuove. Sulle altre il
-- refresh non cambia niente. Una per una, e l'esito si stampa.
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

-- 3. migrazione, una volta sola -----------------------------------------------
IF EXISTS (SELECT 1 FROM dbo.VICE_JAW) OR EXISTS (SELECT 1 FROM dbo.VICE WHERE JAW_ID IS NOT NULL)
BEGIN
	PRINT 'MIGRAZIONE: gia'' fatta (il catalogo ha dei tipi o una morsa ha gia'' un tipo montato), nessuna modifica.';
	SET NOEXEC ON;
END
ELSE IF EXISTS (SELECT 1 FROM dbo.VICE WHERE CLAW_LENGTH < 0 OR Z_CLAW < 0 OR Z_SINK_CLAW < 0)
BEGIN
	PRINT 'FERMO: una o piu'' morse hanno una misura della chela NEGATIVA. Nel catalogo non entra, e cambiarla cambierebbe le quote. Nessuna migrazione: correggere a mano e rilanciare.';
	SELECT ID, RTRIM(FAMILY) AS FAMILY, CLAW_LENGTH, Z_CLAW, Z_SINK_CLAW FROM dbo.VICE
	 WHERE CLAW_LENGTH < 0 OR Z_CLAW < 0 OR Z_SINK_CLAW < 0;
	SET NOEXEC ON;
END
GO

BEGIN TRY
	BEGIN TRAN;

	-- i tipi: uno per morsa con almeno una misura. MERGE con ON 1 = 0 per
	-- avere in OUTPUT anche l'ID della morsa da cui nasce ogni tipo.
	DECLARE @map TABLE (VICE_ID int NOT NULL, JAW_ID int NOT NULL);
	MERGE dbo.VICE_JAW AS t
	USING (
		SELECT v.ID AS VICE_ID,
			   N'Chele attuali ' + ISNULL(RTRIM(v.FAMILY), N'morsa')
				 + CASE WHEN (SELECT COUNT(*) FROM dbo.VICE x WHERE ISNULL(RTRIM(x.FAMILY), N'') = ISNULL(RTRIM(v.FAMILY), N'')) > 1
						THEN N' (morsa ' + CAST(v.ID AS nvarchar(12)) + N')' ELSE N'' END AS CODE,
			   N'Misure della chela lette dalla morsa ' + ISNULL(RTRIM(v.FAMILY), N'') + N' (ID ' + CAST(v.ID AS nvarchar(12)) + N') alla nascita del catalogo' AS DESCR,
			   CASE WHEN v.CLAW_LENGTH > 0 THEN v.CLAW_LENGTH END AS CLAW_LENGTH,
			   CASE WHEN v.Z_CLAW > 0 THEN v.Z_CLAW END AS Z_CLAW,
			   CASE WHEN v.Z_SINK_CLAW >= 0 THEN v.Z_SINK_CLAW END AS Z_SINK_CLAW
		  FROM dbo.VICE v
		 WHERE v.JAW_ID IS NULL
		   AND (v.CLAW_LENGTH IS NOT NULL OR v.Z_CLAW IS NOT NULL OR v.Z_SINK_CLAW IS NOT NULL)
	) AS s
	ON 1 = 0
	WHEN NOT MATCHED THEN
		INSERT (CODE, DESCR, CLAW_LENGTH, Z_CLAW, Z_SINK_CLAW, STATUS, NOTE, EVER_MOUNTED)
		VALUES (s.CODE, s.DESCR, s.CLAW_LENGTH, s.Z_CLAW, s.Z_SINK_CLAW, 1, N'creato da vice-jaw.sql (migrazione)', 1)
	OUTPUT s.VICE_ID, inserted.ID INTO @map (VICE_ID, JAW_ID);

	UPDATE v SET JAW_ID = m.JAW_ID
	  FROM dbo.VICE v JOIN @map m ON m.VICE_ID = v.ID;

	-- la battuta e' stata dichiarata con la chela che la morsa aveva: quella
	UPDATE pv SET CLAW_LENGTH_REF = v.CLAW_LENGTH
	  FROM dbo.PIECE_ON_VICE pv JOIN dbo.VICE v ON v.ID = pv.VICE_ID
	 WHERE pv.CLAW_LENGTH_REF IS NULL AND v.CLAW_LENGTH > 0;

	COMMIT;
	PRINT 'MIGRAZIONE: fatta.';
	SELECT m.VICE_ID, m.JAW_ID, RTRIM(j.CODE) AS CODE, j.CLAW_LENGTH, j.Z_CLAW, j.Z_SINK_CLAW
	  FROM @map m JOIN dbo.VICE_JAW j ON j.ID = m.JAW_ID ORDER BY m.VICE_ID;
END TRY
BEGIN CATCH
	IF @@TRANCOUNT > 0 ROLLBACK;
	PRINT 'FERMO: migrazione NON riuscita, annullata per intero (' + ERROR_MESSAGE() + ').';
END CATCH
GO
SET NOEXEC OFF;
GO

PRINT '== CONTEGGI DOPO ==';
SELECT (SELECT COUNT(*) FROM dbo.VICE) AS morse,
       (SELECT COUNT(*) FROM dbo.VICE WHERE CLAW_LENGTH IS NOT NULL OR Z_CLAW IS NOT NULL OR Z_SINK_CLAW IS NOT NULL) AS morse_con_misure,
       (SELECT COUNT(*) FROM dbo.VICE WHERE JAW_ID IS NOT NULL) AS morse_con_tipo,
       (SELECT COUNT(*) FROM dbo.VICE_JAW) AS tipi_chele,
       (SELECT COUNT(*) FROM dbo.PIECE_ON_VICE) AS battute,
       (SELECT COUNT(*) FROM dbo.PIECE_ON_VICE WHERE CLAW_LENGTH_REF IS NOT NULL) AS battute_con_ref,
       (SELECT COUNT(*) FROM dbo.WORKORDER) AS ordini,
       (SELECT COUNT(*) FROM dbo.WORKORDER WHERE JAW_ID IS NOT NULL) AS ordini_con_chele;

PRINT 'VERIFICA 1: ogni morsa con misure ha un tipo (atteso: nessuna riga)';
SELECT ID, RTRIM(FAMILY) AS FAMILY FROM dbo.VICE
 WHERE JAW_ID IS NULL AND (CLAW_LENGTH IS NOT NULL OR Z_CLAW IS NOT NULL OR Z_SINK_CLAW IS NOT NULL);
PRINT 'VERIFICA 2: le misure del tipo sono quelle della morsa, a meno di 0 -> NULL (atteso: nessuna riga)';
SELECT v.ID, v.CLAW_LENGTH, j.CLAW_LENGTH AS J_CLAW_LENGTH, v.Z_CLAW, j.Z_CLAW AS J_Z_CLAW, v.Z_SINK_CLAW, j.Z_SINK_CLAW AS J_Z_SINK_CLAW
  FROM dbo.VICE v JOIN dbo.VICE_JAW j ON j.ID = v.JAW_ID
 WHERE ISNULL(NULLIF(v.CLAW_LENGTH, 0), -1) <> ISNULL(j.CLAW_LENGTH, -1)
    OR ISNULL(NULLIF(v.Z_CLAW, 0), -1) <> ISNULL(j.Z_CLAW, -1)
    OR ISNULL(v.Z_SINK_CLAW, -1) <> ISNULL(j.Z_SINK_CLAW, -1);
PRINT 'VERIFICA 3: CLAW_LENGTH_REF = lunghezza della chela della morsa (atteso: nessuna riga)';
SELECT pv.VICE_ID, pv.PIECE_ID, pv.CLAW_LENGTH_REF, v.CLAW_LENGTH
  FROM dbo.PIECE_ON_VICE pv JOIN dbo.VICE v ON v.ID = pv.VICE_ID
 WHERE v.CLAW_LENGTH > 0 AND ISNULL(pv.CLAW_LENGTH_REF, -1) <> v.CLAW_LENGTH;
GO
