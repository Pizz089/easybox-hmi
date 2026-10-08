-- ===========================================================================
-- vice-jaw.sql - catalogo delle CHELE DELLA MORSA (VICE_JAW) e colonne che lo
-- legano a morsa, ordine e battuta (prompt 5 di 5, 7/10; correzioni
-- dell'audit, prompt 8, 8/10)
--
-- PERCHE'. Il cliente vuole un punto dove dichiarare le chele della morsa con
-- le loro misure, e ritrovarle quando le rimonta. Decisione di Dario (7/10):
-- CATALOGO PER RIFERIMENTO. La morsa punta al tipo di chele montato
-- (VICE.JAW_ID) e le tre viste lette dal PLC prendono le misure dal catalogo:
-- dato unico. Le viste si cambiano DOPO, con gli script delle viste
-- (coordinates-z-mc.sql, coordinates-push-mc.sql, coordinates-blow-mc.sql,
-- vices-view.sql): questo script non tocca nessuna vista letta dal PLC.
--
-- COSA FA, in quest'ordine, e ogni passo e' ripetibile:
--   1. tabella VICE_JAW (stessi nomi di colonna di VICE per le tre misure:
--      nelle viste cambia solo l'alias);
--   2. colonne nuove, tutte int NULL, con la FK verso VICE_JAW(ID):
--        VICE.JAW_ID               il tipo montato, NULL = nessuno;
--        WORKORDER.JAW_ID          il tipo con cui l'ordine e' stato
--                                  confermato, NULL negli ordini di prima;
--        PIECE_ON_VICE.CLAW_JAW_REF  (8/10) il TIPO montato quando la battuta
--                                  e' stata dichiarata. Prima era la
--                                  lunghezza (CLAW_LENGTH_REF): cosi' una
--                                  correzione della misura di un tipo veniva
--                                  presa per un cambio di chele;
--      poi sp_refreshview SOLO su VICES (vedi sotto);
--   3. MIGRAZIONE, una volta sola (solo se VICE_JAW e' vuota e nessuna morsa
--      ha gia' un tipo):
--        - per ogni morsa con almeno una delle tre misure non nulla, un tipo
--          "Chele attuali morsa <ID>" con le sue misure, montato su quella
--          morsa. (8/10) Il codice ha SEMPRE l'ID della morsa: con la
--          famiglia due morse con FAMILY NULL e FAMILY 'morsa' collidevano
--          sull'UNIQUE, e una famiglia lunga (nchar(200)) poteva superare la
--          colonna;
--        - CLAW_JAW_REF delle righe di PIECE_ON_VICE = il tipo creato per la
--          loro morsa (la battuta e' stata dichiarata con quelle chele).
--      Cosi' le tre viste, dopo il loro script, danno righe IDENTICHE al
--      micron: nessun ordine ha ancora JAW_ID, le misure sono le stesse e il
--      tipo di riferimento e' quello montato (correzione zero).
--      Le colonne vecchie di VICE (CLAW_LENGTH, Z_CLAW, Z_SINK_CLAW) RESTANO
--      COM'ERANO, per il ritorno indietro: non si cancellano, non si
--      rinominano, e da qui in poi nessuno le scrive.
--
-- (8/10) SOLO VICES SI RINFRESCA. Il PLC legge alcune viste con "select *"
-- (COORDINATES_FOR_PALLET_WAREHOUSE, FB_Robot) e prende le colonne PER
-- POSIZIONE: una vista con l'asterisco rinfrescata dopo l'aggiunta di una
-- colonna potrebbe spostargliele. Le viste con l'asterisco che leggono le
-- tabelle toccate (in cella, 8/10: COORDINATES_MC, FIXTURES, VICES,
-- WORKORDERS) senza refresh continuano a dare le colonne di prima. VICES la
-- legge solo il backend, e vices-view.sql la riscrive comunque.
--
-- ZERI E NEGATIVI NELLE MISURE VECCHIE. Nel catalogo lunghezza e altezza sono
-- > 0 e l'affondo >= 0 (lo zero dell'affondo e' un valore vero: chela
-- piatta). Una lunghezza o un'altezza a 0 nella morsa diventa NULL nel tipo:
-- nelle tre viste 0 e NULL danno lo stesso numero (ISNULL a 0, oppure NO_DATA
-- per la spinta), quindi le righe restano identiche. Un valore NEGATIVO
-- invece cambierebbe il risultato: se ce n'e' uno la migrazione si FERMA,
-- elenca le morse e non scrive niente.
--
-- IL TRIGGER VICE_trig (AFTER UPDATE) scrive in LOG da "FROM inserted i,
-- deleted d", senza condizione di join: con piu' righe aggiornate insieme
-- scriverebbe il prodotto incrociato (righe che mescolano le morse). La
-- migrazione monta i tipi UNA MORSA ALLA VOLTA: una riga di log giusta per
-- morsa. Il trigger concatena le colonne con cast(... as varchar): un NULL
-- rende NULL tutta la descrizione, e se LOG.DESCR non accettasse NULL la
-- migrazione si fermerebbe (annullata per intero). Sul clone del 6/10
-- LOG.DESCR accetta NULL; vice-jaw-controlli.sql lo dice per la cella.
--
-- GUARDIA DI MACCHINA: nessuna. Lo script e' idempotente e non distruttivo:
-- crea, aggiunge, scrive solo colonne nuove. (8/10) SET XACT_ABORT ON: un
-- errore dentro la transazione della migrazione la annulla per intero.
--
-- COMANDO (cella, a cella ferma, dopo il backup del DB verificato; procedura
-- in APPUNTI-CELLA, catalogo delle chele):
--   cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -i vice-jaw.sql -o D:\Backup\vice-jaw_esito.txt; Get-Content D:\Backup\vice-jaw_esito.txt
--
-- RITORNO: vice-jaw-rollback.sql (uno solo: misure, battute e viste in una
-- transazione, poi le tabelle di salvataggio e il DROP).
-- ===========================================================================
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

PRINT '== CONTEGGI PRIMA ==';
SELECT (SELECT COUNT(*) FROM dbo.VICE) AS morse,
       (SELECT COUNT(*) FROM dbo.VICE WHERE CLAW_LENGTH IS NOT NULL OR Z_CLAW IS NOT NULL OR Z_SINK_CLAW IS NOT NULL) AS morse_con_misure,
       (SELECT COUNT(*) FROM dbo.PIECE_ON_VICE) AS battute,
       (SELECT COUNT(*) FROM dbo.WORKORDER) AS ordini,
       CASE WHEN OBJECT_ID('dbo.VICE_JAW') IS NULL THEN -1 ELSE (SELECT SUM(p.rows) FROM sys.partitions p WHERE p.object_id = OBJECT_ID('dbo.VICE_JAW') AND p.index_id IN (0, 1)) END AS tipi_chele;
GO

-- 0. la versione del 7/10 (PIECE_ON_VICE.CLAW_LENGTH_REF) non e' mai andata in
-- cella: se c'e', qualcuno l'ha lanciata a mano. Non si mescolano le due.
IF COL_LENGTH('dbo.PIECE_ON_VICE', 'CLAW_LENGTH_REF') IS NOT NULL
BEGIN
	PRINT 'FERMO: c''e'' PIECE_ON_VICE.CLAW_LENGTH_REF, la versione del 7/10 del catalogo, mai andata in cella. Nessuna modifica: riconciliare a mano.';
	SET NOEXEC ON;
END
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
IF COL_LENGTH('dbo.PIECE_ON_VICE', 'CLAW_JAW_REF') IS NOT NULL
	PRINT 'PIECE_ON_VICE.CLAW_JAW_REF gia'' presente.';
ELSE BEGIN
	ALTER TABLE dbo.PIECE_ON_VICE ADD CLAW_JAW_REF int NULL;
	PRINT 'PIECE_ON_VICE.CLAW_JAW_REF aggiunta (int NULL: il tipo di chele montato quando e'' stata dichiarata la battuta).';
END
GO

-- (8/10) le FK verso il catalogo: un JAW_ID che non esiste non si scrive (le
-- rotte del backend controllano gia', la FK lo garantisce anche a mano). Il
-- ritorno le toglie prima del DROP. In SQL dinamico: la colonna deve esistere
-- quando l'istruzione si compila.
IF OBJECT_ID('dbo.FK_VICE_JAW_ID', 'F') IS NOT NULL
	PRINT 'FK_VICE_JAW_ID gia'' presente.';
ELSE BEGIN
	EXEC (N'ALTER TABLE dbo.VICE WITH CHECK ADD CONSTRAINT FK_VICE_JAW_ID FOREIGN KEY (JAW_ID) REFERENCES dbo.VICE_JAW (ID);');
	PRINT 'FK_VICE_JAW_ID aggiunta (VICE.JAW_ID -> VICE_JAW.ID).';
END
IF OBJECT_ID('dbo.FK_WORKORDER_JAW_ID', 'F') IS NOT NULL
	PRINT 'FK_WORKORDER_JAW_ID gia'' presente.';
ELSE BEGIN
	EXEC (N'ALTER TABLE dbo.WORKORDER WITH CHECK ADD CONSTRAINT FK_WORKORDER_JAW_ID FOREIGN KEY (JAW_ID) REFERENCES dbo.VICE_JAW (ID);');
	PRINT 'FK_WORKORDER_JAW_ID aggiunta (WORKORDER.JAW_ID -> VICE_JAW.ID).';
END
IF OBJECT_ID('dbo.FK_PIECE_ON_VICE_CLAW_JAW_REF', 'F') IS NOT NULL
	PRINT 'FK_PIECE_ON_VICE_CLAW_JAW_REF gia'' presente.';
ELSE BEGIN
	EXEC (N'ALTER TABLE dbo.PIECE_ON_VICE WITH CHECK ADD CONSTRAINT FK_PIECE_ON_VICE_CLAW_JAW_REF FOREIGN KEY (CLAW_JAW_REF) REFERENCES dbo.VICE_JAW (ID);');
	PRINT 'FK_PIECE_ON_VICE_CLAW_JAW_REF aggiunta (PIECE_ON_VICE.CLAW_JAW_REF -> VICE_JAW.ID).';
END
GO

-- (8/10) refresh della sola VICES (SELECT v.*): vedi l'intestazione. Le altre
-- viste con l'asterisco non si toccano.
IF OBJECT_ID('dbo.VICES', 'V') IS NULL
	PRINT 'refresh vista dbo.VICES: la vista non c''e'', niente da fare (la crea vices-view.sql).';
ELSE BEGIN
	BEGIN TRY
		EXEC sp_refreshview N'dbo.VICES';
		PRINT 'refresh vista dbo.VICES: ok';
	END TRY
	BEGIN CATCH
		PRINT 'refresh vista dbo.VICES: NON riuscito (' + ERROR_MESSAGE() + '). Non blocca: vices-view.sql la riscrive.';
	END CATCH
END
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
	CREATE TABLE #map (VICE_ID int NOT NULL PRIMARY KEY, JAW_ID int NOT NULL);
	MERGE dbo.VICE_JAW AS t
	USING (
		SELECT v.ID AS VICE_ID,
			   N'Chele attuali morsa ' + CAST(v.ID AS nvarchar(12)) AS CODE,
			   LEFT(N'Misure lette dalla morsa ' + CAST(v.ID AS nvarchar(12))
					+ ISNULL(N' (' + NULLIF(RTRIM(v.FAMILY), N'') + N')', N'')
					+ N' alla nascita del catalogo', 200) AS DESCR,
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
	OUTPUT s.VICE_ID, inserted.ID INTO #map (VICE_ID, JAW_ID);

	-- il tipo su ogni morsa UNA ALLA VOLTA: VICE_trig scriverebbe il prodotto
	-- incrociato con piu' righe insieme (vedi l'intestazione)
	DECLARE @v int, @jj int;
	DECLARE m CURSOR LOCAL FAST_FORWARD FOR SELECT VICE_ID, JAW_ID FROM #map ORDER BY VICE_ID;
	OPEN m;
	FETCH NEXT FROM m INTO @v, @jj;
	WHILE @@FETCH_STATUS = 0
	BEGIN
		UPDATE dbo.VICE SET JAW_ID = @jj WHERE ID = @v;
		FETCH NEXT FROM m INTO @v, @jj;
	END
	CLOSE m;
	DEALLOCATE m;

	-- la battuta e' stata dichiarata con le chele che la morsa aveva: il tipo
	-- appena creato per quella morsa
	UPDATE pv SET CLAW_JAW_REF = mp.JAW_ID
	  FROM dbo.PIECE_ON_VICE pv JOIN #map mp ON mp.VICE_ID = pv.VICE_ID
	 WHERE pv.CLAW_JAW_REF IS NULL;

	COMMIT;
	PRINT 'MIGRAZIONE: fatta.';
	SELECT mp.VICE_ID, mp.JAW_ID, RTRIM(j.CODE) AS CODE, j.CLAW_LENGTH, j.Z_CLAW, j.Z_SINK_CLAW
	  FROM #map mp JOIN dbo.VICE_JAW j ON j.ID = mp.JAW_ID ORDER BY mp.VICE_ID;
	DROP TABLE #map;
END TRY
BEGIN CATCH
	IF @@TRANCOUNT > 0 ROLLBACK;
	PRINT 'FERMO: migrazione NON riuscita, annullata per intero (' + ERROR_MESSAGE() + '). Tabella e colonne restano: non riprendere la produzione, rilanciare dopo aver letto l''errore (vedi APPUNTI-CELLA).';
	IF OBJECT_ID('tempdb..#map') IS NOT NULL DROP TABLE #map;
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
       (SELECT COUNT(*) FROM dbo.PIECE_ON_VICE WHERE CLAW_JAW_REF IS NOT NULL) AS battute_con_tipo,
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
PRINT 'VERIFICA 3: il tipo di riferimento di ogni battuta e'' quello montato sulla sua morsa (atteso: nessuna riga)';
SELECT pv.VICE_ID, pv.PIECE_ID, pv.CLAW_JAW_REF, v.JAW_ID
  FROM dbo.PIECE_ON_VICE pv JOIN dbo.VICE v ON v.ID = pv.VICE_ID
 WHERE v.JAW_ID IS NOT NULL AND ISNULL(pv.CLAW_JAW_REF, -1) <> v.JAW_ID;
PRINT 'VERIFICA 4: le tre FK ci sono (atteso: 3)';
SELECT COUNT(*) AS fk FROM sys.foreign_keys
 WHERE name IN (N'FK_VICE_JAW_ID', N'FK_WORKORDER_JAW_ID', N'FK_PIECE_ON_VICE_CLAW_JAW_REF');
GO
