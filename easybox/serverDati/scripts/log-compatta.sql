-- ===========================================================================
-- log-compatta.sql - tabella LOG da nchar a nvarchar, con gli ultimi GIORNI
-- giorni di storico (17/11)
--
-- PERCHE'. In LOG oggi DESCR e' nchar(2000), UNIT_A e UNIT_B nchar(20). Un
-- nchar occupa sempre tutta la sua lunghezza: una riga pesa circa 4,1 KB e in
-- una pagina da 8 KB ne sta una sola, quindi 8 KB a riga. 98.581 righe dal
-- 01/09 = 774 MB sui 779 del database. La pulizia vecchia del backend (una
-- cancellazione unica ogni 4 h) non riusciva: riempiva il log del database
-- (MAXSIZE 100 MB) e tornava indietro.
-- Lo script crea LOG_NEW con nvarchar (stesse colonne nello stesso ordine,
-- stessa identity, stessa nullabilita'), ci copia a blocchi le righe degli
-- ultimi GIORNI giorni togliendo gli spazi in coda, e la scambia con LOG in
-- una transazione. La LOG di prima resta intera come LOG_OLD.
--
-- QUANDO. A cella ferma e con il servizio EasyBoxBackend FERMO, e DOPO il
-- rilascio della parte 1 (pulizia a blocchi del backend, logTableCleanup.js).
-- Non prima: il backend vecchio ogni 4 h cancella tutto quello che ha piu' di
-- 3 giorni in una volta sola; sulle righe da 8 KB non ci riusciva, sulla
-- tabella compatta ci riuscirebbe e lascerebbe 3 giorni di storico.
--
-- COMANDO (da PowerShell, in cella; il resoconto resta in D:\Backup):
--
--   cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -v GIORNI=60 -i log-compatta.sql -o D:\Backup\log_compatta.txt; Get-Content D:\Backup\log_compatta.txt
--
-- GIORNI: storico da tenere, 60 come il default del backend
-- (LOG_TABLE_KEEP_DAYS). Va sempre data con -v: sqlcmd non ha un default nel
-- file che -v possa cambiare (un ":setvar" scritto qui vincerebbe sulla riga
-- di comando). Senza -v sqlcmd si ferma con "scripting variable not defined"
-- e lo script, che e' un batch solo, non parte.
--
-- PASSI
--   0. guardie (qualunque FERMO = nessuna modifica) e stampe di controllo;
--   1. log del database: MAXSIZE 2048 MB, FILEGROWTH 128 MB;
--   2. LOG_NEW: ID bigint (identity come l'originale), DATA datetime, DESCR
--      nvarchar(2000), UNIT_A e UNIT_B nvarchar(20); stessa nullabilita' e
--      collation, eventuali DEFAULT ricopiati; PK clustered su ID col nome
--      nuovo PK_LOG_NEW, indici IX_LOG_DATA (DATA) e IX_LOG_UNIT_B_DATA
--      (UNIT_B, DATA);
--   3. copia a blocchi da 5000 righe per ID crescente, solo DATA >= ora -
--      GIORNI giorni, RTRIM su DESCR, UNIT_A, UNIT_B, con IDENTITY_INSERT;
--   4. scambio in UNA transazione, con LOG bloccata in esclusiva: ricopia
--      delle righe arrivate durante la copia, conteggi confrontati (diversi =
--      ROLLBACK e FERMO), LOG -> LOG_OLD, LOG_NEW -> LOG, nomi dei vincoli
--      sistemati (la nuova PK_LOG, la vecchia PK_LOG_OLD), permessi a livello
--      oggetto ricopiati, identity riallineata al MAX(ID) della LOG di prima;
--   5. verifiche: conteggi, MIN(DATA), sp_spaceused, INSERT/SELECT di prova
--      annullata con ROLLBACK;
--   6. fine. Nessuna tabella viene eliminata: LOG_OLD resta per il ritorno
--      indietro (blocco commentato in fondo).
--
-- GUARDIE DEL PASSO 0 (FERMO prima di toccare qualunque cosa): GIORNI non
-- intero o 0; database diverso da ADMG; file di log SmallBOX_log assente;
-- dbo.LOG assente; colonne diverse da ID bigint, DATA datetime, DESCR
-- nchar(2000), UNIT_A e UNIT_B nchar(20) in quest'ordine e senza altre
-- (POSITION_trig, APPUNTI-CELLA 4/9, scrive in LOG: la tabella nuova deve
-- accettare le stesse INSERT); ID che accetta NULL o con valori doppi;
-- LOG_NEW o LOG_OLD gia' presenti; trigger, chiavi esterne o CHECK su LOG
-- (lo script non li ricreerebbe); oggetti legati a LOG con SCHEMABINDING;
-- nomi dei vincoli nuovi gia' presi.
--
-- SE SI FERMA DOPO IL PASSO 1: la LOG non e' stata toccata (lo scambio e'
-- l'ultima cosa e sta in una transazione). Puo' restare LOG_NEW, parziale:
-- per rilanciare va eliminata a mano, decide Dario.
--
-- SPAZIO. Il file del database non si rimpicciolisce da solo: LOG_OLD tiene i
-- suoi MB finche' non viene eliminata (decisione a parte, dopo qualche giorno
-- con la tabella nuova) e anche dopo serve uno shrink per ridarli al disco.
--
-- Un solo batch, niente GO: un RETURN ferma tutto. Le istruzioni su LOG_NEW
-- e sulla LOG dopo lo scambio sono SQL dinamico, cosi' i nomi si risolvono
-- quando l'istruzione parte e non quando sqlcmd manda il batch.
-- Livello di compatibilita' del DB della cella 100: niente TRY_CAST.
-- ===========================================================================
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @giorniTxt varchar(20) = '$(GIORNI)';
DECLARE @giorni int, @limite datetime;
DECLARE @obj int, @nColonne int, @nColonneOk int, @n int;
DECLARE @identita bit, @seed bigint, @incr bigint, @nfr bit, @idNullable bit, @idUnivoco bit = 0;
DECLARE @pkOrig sysname;
DECLARE @nullData varchar(8), @nullDescr varchar(8), @nullA varchar(8), @nullB varchar(8);
DECLARE @collDescr sysname, @collA sysname, @collB sysname;
DECLARE @totale int, @attese int, @copiate int, @nBlocchi int, @dalVecchia datetime, @minId bigint, @maxId bigint;
DECLARE @dopo bigint, @ultimo bigint;
DECLARE @nAttese int, @nNuova int, @nLog int, @nOld int, @dalLog datetime;
DECLARE @crea nvarchar(max), @default nvarchar(max), @permessi nvarchar(max), @blocco nvarchar(max), @parametri nvarchar(200);
DECLARE @i int, @da sysname, @a sysname, @oggetto nvarchar(300), @nome nvarchar(300), @testo nvarchar(max);
DECLARE @nomi TABLE (id int IDENTITY(1,1) PRIMARY KEY, fase int, da sysname, a sysname);
DECLARE @dflt TABLE (col sysname, definizione nvarchar(max), nome sysname);
DECLARE @dip TABLE (id int IDENTITY(1,1) PRIMARY KEY, nome nvarchar(300), tipo nvarchar(60), schemabound int, definizione nvarchar(max));

-- ===========================================================================
-- PASSO 0 - guardie e stampe. Solo letture: nessuna scrittura prima del passo 1.
-- ===========================================================================
PRINT '=== PASSO 0: guardie e stampe di controllo ===';

IF @giorniTxt = '' OR @giorniTxt LIKE '%[^0-9]%' OR LEN(@giorniTxt) > 4
BEGIN
	PRINT 'FERMO: GIORNI deve essere un numero intero di giorni (es. -v GIORNI=60), ricevuto [' + @giorniTxt + ']. Nessuna modifica.';
	RETURN;
END
SET @giorni = CAST(@giorniTxt AS int);
IF @giorni < 1
BEGIN
	PRINT 'FERMO: GIORNI=0 vorrebbe dire nessuna riga da tenere. Nessuna modifica.';
	RETURN;
END
SET @limite = DATEADD(day, -@giorni, GETDATE());
PRINT 'database ' + DB_NAME() + ', ora ' + CONVERT(varchar(19), GETDATE(), 120) + ', GIORNI ' + CAST(@giorni AS varchar(10))
	+ ': restano le righe con DATA >= ' + CONVERT(varchar(19), @limite, 120);

IF DB_NAME() <> 'ADMG'
BEGIN
	PRINT 'FERMO: database corrente ' + DB_NAME() + ', atteso ADMG (sqlcmd ... -d ADMG). Nessuna modifica.';
	RETURN;
END

PRINT '--- file del database (MB; max_mb -1 = senza limite) ---';
SELECT name, type_desc, size / 128 AS mb,
	CASE WHEN max_size = -1 THEN -1 ELSE CAST(max_size AS bigint) / 128 END AS max_mb,
	CASE WHEN is_percent_growth = 1 THEN CAST(growth AS varchar(10)) + ' %' ELSE CAST(growth / 128 AS varchar(10)) + ' MB' END AS crescita
FROM sys.database_files;
PRINT '--- modello di recupero (SIMPLE: il log si svuota da solo fra una transazione e l''altra) ---';
SELECT name, recovery_model_desc, log_reuse_wait_desc, compatibility_level FROM sys.databases WHERE database_id = DB_ID();
PRINT '--- altre connessioni a questo database (attese: nessuna, servizio EasyBoxBackend fermo) ---';
SELECT session_id, login_name, host_name, program_name FROM sys.dm_exec_sessions
WHERE database_id = DB_ID() AND session_id <> @@SPID AND is_user_process = 1;

IF NOT EXISTS (SELECT 1 FROM sys.database_files WHERE name = 'SmallBOX_log' AND type = 1)
BEGIN
	PRINT 'FERMO: il file di log SmallBOX_log non c''e'' (file del database sopra). Nessuna modifica.';
	RETURN;
END

IF OBJECT_ID(N'dbo.LOG', 'U') IS NULL
BEGIN
	PRINT 'FERMO: dbo.LOG non esiste o non e'' una tabella. Nessuna modifica.';
	RETURN;
END
SET @obj = OBJECT_ID(N'dbo.LOG', 'U');

IF OBJECT_ID(N'dbo.LOG_NEW') IS NOT NULL OR OBJECT_ID(N'dbo.LOG_OLD') IS NOT NULL
BEGIN
	PRINT 'FERMO: dbo.LOG_NEW o dbo.LOG_OLD esiste gia'': script gia'' eseguito o tentato. Nessuna modifica. Controllare a mano prima di qualunque altra cosa.';
	RETURN;
END

PRINT '--- colonne di LOG (tipo, byte, nullabilita'', identity, collation) ---';
SELECT c.column_id, c.name, TYPE_NAME(c.system_type_id) AS tipo, c.max_length AS byte, c.is_nullable, c.is_identity, c.is_computed, c.collation_name
FROM sys.columns c WHERE c.object_id = @obj ORDER BY c.column_id;

SELECT @nColonne = COUNT(*) FROM sys.columns WHERE object_id = @obj;
SELECT @nColonneOk = COUNT(*)
FROM (SELECT c.name, TYPE_NAME(c.system_type_id) AS tipo, c.max_length, c.is_computed,
		ROW_NUMBER() OVER (ORDER BY c.column_id) AS pos
	FROM sys.columns c WHERE c.object_id = @obj) x
JOIN (VALUES (1, 'ID', 'bigint', 8), (2, 'DATA', 'datetime', 8), (3, 'DESCR', 'nchar', 4000),
		(4, 'UNIT_A', 'nchar', 40), (5, 'UNIT_B', 'nchar', 40)) a (pos, nome, tipo, lung)
	ON a.pos = x.pos AND a.nome = x.name AND a.tipo = x.tipo AND a.lung = x.max_length AND x.is_computed = 0;
IF @nColonne <> 5 OR @nColonneOk <> 5
BEGIN
	PRINT 'FERMO: le colonne di LOG non sono ID bigint, DATA datetime, DESCR nchar(2000), UNIT_A nchar(20), UNIT_B nchar(20), in quest''ordine e senza altre (elenco sopra). Nessuna modifica.';
	RETURN;
END

SELECT @identita = is_identity, @idNullable = is_nullable FROM sys.columns WHERE object_id = @obj AND name = 'ID';
SELECT @nullData = CASE WHEN is_nullable = 1 THEN 'NULL' ELSE 'NOT NULL' END FROM sys.columns WHERE object_id = @obj AND name = 'DATA';
SELECT @nullDescr = CASE WHEN is_nullable = 1 THEN 'NULL' ELSE 'NOT NULL' END, @collDescr = collation_name FROM sys.columns WHERE object_id = @obj AND name = 'DESCR';
SELECT @nullA = CASE WHEN is_nullable = 1 THEN 'NULL' ELSE 'NOT NULL' END, @collA = collation_name FROM sys.columns WHERE object_id = @obj AND name = 'UNIT_A';
SELECT @nullB = CASE WHEN is_nullable = 1 THEN 'NULL' ELSE 'NOT NULL' END, @collB = collation_name FROM sys.columns WHERE object_id = @obj AND name = 'UNIT_B';

PRINT '--- identity su ID (LOG_NEW la riprende uguale) ---';
SELECT name, seed_value, increment_value, last_value, is_not_for_replication FROM sys.identity_columns WHERE object_id = @obj;
SELECT @seed = CAST(seed_value AS bigint), @incr = CAST(increment_value AS bigint), @nfr = is_not_for_replication
FROM sys.identity_columns WHERE object_id = @obj;
IF @identita = 0
	PRINT 'ID NON e'' identity: non lo sara'' nemmeno in LOG_NEW (stessa definizione).';

IF @idNullable = 1
BEGIN
	PRINT 'FERMO: ID accetta NULL: la chiave primaria clustered su ID di LOG_NEW non si puo'' creare. Nessuna modifica.';
	RETURN;
END

PRINT '--- indici di LOG (la LOG nuova ha PK_LOG, IX_LOG_DATA, IX_LOG_UNIT_B_DATA; gli altri non vengono ricreati) ---';
SELECT i.name, i.type_desc, i.is_primary_key, i.is_unique,
	(SELECT COL_NAME(ic.object_id, ic.column_id) + ' ' FROM sys.index_columns ic
	 WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.key_ordinal > 0
	 ORDER BY ic.key_ordinal FOR XML PATH('')) AS colonne
FROM sys.indexes i WHERE i.object_id = @obj AND i.type > 0;
SELECT @pkOrig = name FROM sys.key_constraints WHERE parent_object_id = @obj AND type = 'PK';
PRINT 'chiave primaria di LOG: ' + ISNULL(@pkOrig, '(nessuna)');

IF EXISTS (SELECT 1 FROM sys.indexes i
	WHERE i.object_id = @obj AND i.is_unique = 1
	  AND (SELECT COUNT(*) FROM sys.index_columns ic WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.key_ordinal > 0) = 1
	  AND EXISTS (SELECT 1 FROM sys.index_columns ic WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
				  AND ic.key_ordinal = 1 AND COL_NAME(ic.object_id, ic.column_id) = 'ID'))
BEGIN
	SET @idUnivoco = 1;
END
ELSE IF EXISTS (SELECT ID FROM dbo.LOG GROUP BY ID HAVING COUNT(*) > 1)
BEGIN
	PRINT 'FERMO: in LOG ci sono ID doppi (e nessun indice univoco su ID): la PK di LOG_NEW li rifiuterebbe. Nessuna modifica.';
	RETURN;
END

PRINT '--- trigger su LOG (attesi: nessuno) ---';
SELECT name, is_disabled, OBJECT_DEFINITION(object_id) AS definizione FROM sys.triggers WHERE parent_id = @obj;
IF EXISTS (SELECT 1 FROM sys.triggers WHERE parent_id = @obj)
BEGIN
	PRINT 'FERMO: LOG ha dei trigger (elenco sopra): lo script non li ricrea sulla tabella nuova. Nessuna modifica.';
	RETURN;
END

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = @obj OR referenced_object_id = @obj)
	OR EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = @obj)
BEGIN
	PRINT 'FERMO: LOG ha chiavi esterne o vincoli CHECK (elenco sotto): lo script non li ricrea. Nessuna modifica.';
	SELECT name, type_desc FROM sys.foreign_keys WHERE parent_object_id = @obj OR referenced_object_id = @obj
	UNION ALL SELECT name, type_desc FROM sys.check_constraints WHERE parent_object_id = @obj;
	RETURN;
END

INSERT INTO @dflt (col, definizione, nome)
SELECT c.name, d.definition, d.name
FROM sys.default_constraints d JOIN sys.columns c ON c.object_id = d.parent_object_id AND c.column_id = d.parent_column_id
WHERE d.parent_object_id = @obj;
PRINT '--- DEFAULT su LOG (ricopiati su LOG_NEW con la stessa definizione; attesi: nessuno) ---';
SELECT col, definizione, nome FROM @dflt;

PRINT '--- permessi a livello oggetto su LOG (ricopiati sulla LOG nuova) ---';
SELECT USER_NAME(p.grantee_principal_id) AS a_chi, p.state_desc, p.permission_name, COL_NAME(p.major_id, p.minor_id) AS colonna
FROM sys.database_permissions p WHERE p.class = 1 AND p.major_id = @obj;
SET @permessi = N'';
SELECT @permessi = @permessi + CASE p.state WHEN 'W' THEN N'GRANT' ELSE p.state_desc END + N' ' + p.permission_name
	+ N' ON dbo.LOG' + CASE WHEN p.minor_id > 0 THEN N' (' + QUOTENAME(COL_NAME(p.major_id, p.minor_id)) + N')' ELSE N'' END
	+ N' TO ' + QUOTENAME(USER_NAME(p.grantee_principal_id)) + CASE p.state WHEN 'W' THEN N' WITH GRANT OPTION' ELSE N'' END + N'; '
FROM sys.database_permissions p WHERE p.class = 1 AND p.major_id = @obj;
PRINT CASE WHEN @permessi = N'' THEN N'nessun permesso a livello oggetto su LOG.' ELSE N'da ricopiare: ' + @permessi END;

PRINT '--- oggetti che referenziano LOG (atteso almeno POSITION_trig, che scrive in [log]) ---';
INSERT INTO @dip (nome, tipo, schemabound, definizione)
SELECT OBJECT_SCHEMA_NAME(o.object_id) + N'.' + o.name, o.type_desc, x.sb, OBJECT_DEFINITION(o.object_id)
FROM (SELECT d.referencing_id, MAX(CAST(d.is_schema_bound_reference AS int)) AS sb
	FROM sys.sql_expression_dependencies d
	WHERE d.referenced_id = @obj OR (d.referenced_id IS NULL AND d.referenced_entity_name = N'LOG')
	GROUP BY d.referencing_id) x
JOIN sys.objects o ON o.object_id = x.referencing_id;
SELECT nome, tipo, schemabound FROM @dip ORDER BY id;
-- le definizioni intere (fino a 4000 caratteri): per vedere COME scrivono in
-- LOG, con o senza elenco di colonne
SET @i = 0;
WHILE 1 = 1
BEGIN
	SELECT TOP 1 @i = id, @nome = nome, @testo = definizione FROM @dip WHERE id > @i ORDER BY id;
	IF @@ROWCOUNT = 0 BREAK;
	PRINT '--- definizione di ' + @nome + ' ---';
	PRINT LEFT(ISNULL(@testo, N'(non leggibile)'), 4000);
END
IF EXISTS (SELECT 1 FROM @dip WHERE schemabound = 1)
BEGIN
	PRINT 'FERMO: oggetti legati a LOG con SCHEMABINDING (colonna schemabound sopra): bloccherebbero lo scambio. Nessuna modifica.';
	RETURN;
END

-- nomi dei vincoli: fase 1 sulla LOG di prima (che diventa LOG_OLD), fase 2
-- sulla nuova. La fase 1 libera i nomi (es. PK_LOG) che la fase 2 prende.
INSERT INTO @nomi (fase, da, a) SELECT 1, @pkOrig, N'PK_LOG_OLD' WHERE @pkOrig IS NOT NULL;
INSERT INTO @nomi (fase, da, a) SELECT 1, nome, N'DF_LOG_OLD_' + col FROM @dflt;
INSERT INTO @nomi (fase, da, a) VALUES (2, N'PK_LOG_NEW', N'PK_LOG');
INSERT INTO @nomi (fase, da, a) SELECT 2, N'DF_LOG_NEW_' + col, N'DF_LOG_' + col FROM @dflt;
PRINT '--- nomi dei vincoli allo scambio (fase 1: LOG di prima, fase 2: LOG nuova) ---';
SELECT fase, da, a FROM @nomi ORDER BY id;
IF EXISTS (SELECT 1 FROM @nomi n WHERE n.fase = 2 AND OBJECT_ID(N'dbo.' + QUOTENAME(n.da)) IS NOT NULL)
	OR EXISTS (SELECT 1 FROM @nomi n WHERE n.da <> n.a AND OBJECT_ID(N'dbo.' + QUOTENAME(n.a)) IS NOT NULL
				AND NOT EXISTS (SELECT 1 FROM @nomi v WHERE v.fase = 1 AND v.da = n.a))
BEGIN
	PRINT 'FERMO: un nome di vincolo che lo script deve usare e'' gia'' preso da un altro oggetto (elenco sopra). Nessuna modifica.';
	RETURN;
END

PRINT '--- spazio di LOG adesso ---';
EXEC sp_spaceused N'dbo.LOG';
SELECT @totale = COUNT(*), @attese = SUM(CASE WHEN [DATA] >= @limite THEN 1 ELSE 0 END),
	@dalVecchia = MIN([DATA]), @minId = MIN(ID), @maxId = MAX(ID)
FROM dbo.LOG;
SET @attese = ISNULL(@attese, 0);
PRINT 'LOG adesso: ' + CAST(@totale AS varchar(12)) + ' righe, la piu'' vecchia del ' + ISNULL(CONVERT(varchar(19), @dalVecchia, 120), '-')
	+ ', ID da ' + ISNULL(CAST(@minId AS varchar(20)), '-') + ' a ' + ISNULL(CAST(@maxId AS varchar(20)), '-');
PRINT 'righe attese nella LOG nuova (DATA >= limite): ' + CAST(@attese AS varchar(12));

-- ===========================================================================
-- PASSO 1 - log del database: da 100 MB a 2 GB massimi
-- ===========================================================================
PRINT '=== PASSO 1: log del database, MAXSIZE 2048 MB e FILEGROWTH 128 MB ===';
ALTER DATABASE ADMG MODIFY FILE (NAME = SmallBOX_log, MAXSIZE = 2048MB, FILEGROWTH = 128MB);
SELECT name, size / 128 AS mb, CAST(max_size AS bigint) / 128 AS max_mb, growth / 128 AS crescita_mb
FROM sys.database_files WHERE name = 'SmallBOX_log';

BEGIN TRY
	-- =======================================================================
	-- PASSO 2 - LOG_NEW
	-- =======================================================================
	PRINT '=== PASSO 2: LOG_NEW con nvarchar, PK clustered su ID, indici su (DATA) e su (UNIT_B, DATA) ===';
	SET @crea = N'CREATE TABLE dbo.LOG_NEW (
	ID bigint' + CASE WHEN @identita = 1
		THEN N' IDENTITY(' + CAST(@seed AS nvarchar(30)) + N',' + CAST(@incr AS nvarchar(30)) + N')'
			+ CASE WHEN @nfr = 1 THEN N' NOT FOR REPLICATION' ELSE N'' END
		ELSE N'' END + N' NOT NULL,
	[DATA] datetime ' + @nullData + N',
	DESCR nvarchar(2000) COLLATE ' + @collDescr + N' ' + @nullDescr + N',
	UNIT_A nvarchar(20) COLLATE ' + @collA + N' ' + @nullA + N',
	UNIT_B nvarchar(20) COLLATE ' + @collB + N' ' + @nullB + N',
	CONSTRAINT PK_LOG_NEW PRIMARY KEY CLUSTERED (ID)
);
CREATE NONCLUSTERED INDEX IX_LOG_DATA ON dbo.LOG_NEW ([DATA]);
CREATE NONCLUSTERED INDEX IX_LOG_UNIT_B_DATA ON dbo.LOG_NEW (UNIT_B, [DATA]);';
	PRINT @crea;
	EXEC (@crea);

	SET @default = N'';
	SELECT @default = @default + N'ALTER TABLE dbo.LOG_NEW ADD CONSTRAINT ' + QUOTENAME(N'DF_LOG_NEW_' + col)
		+ N' DEFAULT ' + definizione + N' FOR ' + QUOTENAME(col) + N'; '
	FROM @dflt;
	IF @default <> N''
	BEGIN
		PRINT @default;
		EXEC (@default);
	END

	-- =======================================================================
	-- PASSO 3 - copia a blocchi. Ogni blocco e' una transazione piccola: il
	-- log del database si svuota fra un blocco e l'altro.
	-- =======================================================================
	PRINT '=== PASSO 3: copia a blocchi da 5000 righe, DATA >= ' + CONVERT(varchar(19), @limite, 120) + ' ===';
	SET @blocco = N'INSERT INTO dbo.LOG_NEW (ID, [DATA], DESCR, UNIT_A, UNIT_B)
SELECT TOP (5000) ID, [DATA], RTRIM(DESCR), RTRIM(UNIT_A), RTRIM(UNIT_B)
FROM dbo.LOG WHERE ID > @dopo AND [DATA] >= @limite ORDER BY ID;
SET @n = @@ROWCOUNT;
SELECT @ultimo = MAX(ID) FROM dbo.LOG_NEW;';
	IF @identita = 1
		SET @blocco = N'SET IDENTITY_INSERT dbo.LOG_NEW ON;' + NCHAR(10) + @blocco + NCHAR(10) + N'SET IDENTITY_INSERT dbo.LOG_NEW OFF;';
	SET @parametri = N'@dopo bigint, @limite datetime, @n int OUTPUT, @ultimo bigint OUTPUT';
	SET @dopo = ISNULL(@minId, 0) - 1;
	SET @copiate = 0;
	SET @nBlocchi = 0;
	WHILE 1 = 1
	BEGIN
		EXEC sp_executesql @blocco, @parametri, @dopo, @limite, @n OUTPUT, @ultimo OUTPUT;
		IF @n = 0 BREAK;
		SET @copiate = @copiate + @n;
		SET @nBlocchi = @nBlocchi + 1;
		SET @dopo = @ultimo;
		PRINT 'blocco ' + CAST(@nBlocchi AS varchar(10)) + ': ' + CAST(@n AS varchar(10)) + ' righe, copiate finora ' + CAST(@copiate AS varchar(12));
	END
	PRINT 'righe attese ' + CAST(@attese AS varchar(12)) + ', copiate ' + CAST(@copiate AS varchar(12)) + ' in ' + CAST(@nBlocchi AS varchar(10)) + ' blocchi';

	-- =======================================================================
	-- PASSO 4 - scambio, tutto o niente
	-- =======================================================================
	PRINT '=== PASSO 4: scambio LOG -> LOG_OLD, LOG_NEW -> LOG, in una transazione ===';
	-- se qualcuno tiene LOG occupata, dopo 30 s errore e scambio annullato
	-- (CATCH sotto), invece di restare appesi
	SET LOCK_TIMEOUT 30000;
	BEGIN TRAN;
	-- LOG in esclusiva fino al COMMIT: da qui nessuno scrive piu' nella LOG di prima
	SELECT @nAttese = ISNULL(SUM(CASE WHEN [DATA] >= @limite THEN 1 ELSE 0 END), 0), @maxId = MAX(ID)
	FROM dbo.LOG WITH (TABLOCKX, HOLDLOCK);
	-- righe arrivate durante la copia (attese: nessuna, servizio fermo)
	SET @n = 1;
	WHILE @n > 0
	BEGIN
		EXEC sp_executesql @blocco, @parametri, @dopo, @limite, @n OUTPUT, @ultimo OUTPUT;
		IF @n > 0
		BEGIN
			PRINT 'righe arrivate durante la copia, ricopiate: ' + CAST(@n AS varchar(10));
			SET @copiate = @copiate + @n;
			SET @dopo = @ultimo;
		END
	END
	SELECT @nNuova = COUNT(*) FROM dbo.LOG_NEW;
	PRINT 'a LOG bloccata: righe da tenere nella LOG di prima ' + CAST(@nAttese AS varchar(12)) + ', righe in LOG_NEW ' + CAST(@nNuova AS varchar(12));
	IF @nNuova <> @nAttese
	BEGIN
		ROLLBACK TRAN;
		PRINT 'FERMO: i conteggi non tornano. Scambio annullato, LOG non e'' stata toccata. LOG_NEW resta da controllare (e da eliminare a mano prima di rilanciare).';
		RETURN;
	END

	EXEC sp_rename N'dbo.LOG', N'LOG_OLD';
	EXEC sp_rename N'dbo.LOG_NEW', N'LOG';
	SET @i = 0;
	WHILE 1 = 1
	BEGIN
		SELECT TOP 1 @i = id, @da = da, @a = a FROM @nomi WHERE id > @i AND da <> a ORDER BY id;
		IF @@ROWCOUNT = 0 BREAK;
		SET @oggetto = N'dbo.' + QUOTENAME(@da);
		EXEC sp_rename @oggetto, @a, N'OBJECT';
	END
	-- dopo le sp_rename dbo.LOG e' la tabella nuova
	IF @permessi <> N''
		EXEC (@permessi);
	IF @identita = 1 AND @maxId IS NOT NULL
		DBCC CHECKIDENT (N'dbo.LOG', RESEED, @maxId);
	COMMIT TRAN;
	PRINT 'scambio fatto: LOG e'' la tabella nuova, LOG_OLD quella di prima.';
END TRY
BEGIN CATCH
	IF @@TRANCOUNT > 0 ROLLBACK TRAN;
	PRINT 'FERMO: errore ' + CAST(ERROR_NUMBER() AS varchar(10)) + ': ' + ERROR_MESSAGE();
	PRINT 'LOG NON e'' stata toccata (lo scambio e'' l''ultima cosa e sta in una transazione). LOG_NEW, se c''e'', va eliminata a mano prima di rilanciare.';
	RETURN;
END CATCH

-- ===========================================================================
-- PASSO 5 - verifiche. SQL dinamico: dbo.LOG va letta adesso, dopo lo
-- scambio, non quando sqlcmd ha mandato il batch.
-- ===========================================================================
PRINT '=== PASSO 5: verifiche ===';
EXEC sp_executesql N'SELECT @n = COUNT(*), @dal = MIN([DATA]) FROM dbo.LOG;', N'@n int OUTPUT, @dal datetime OUTPUT', @nLog OUTPUT, @dalLog OUTPUT;
EXEC sp_executesql N'SELECT @n = COUNT(*) FROM dbo.LOG_OLD;', N'@n int OUTPUT', @nOld OUTPUT;
PRINT 'LOG (nuova): ' + CAST(@nLog AS varchar(12)) + ' righe (attese ' + CAST(@nAttese AS varchar(12)) + '), la piu'' vecchia del '
	+ ISNULL(CONVERT(varchar(19), @dalLog, 120), '-') + ' (limite ' + CONVERT(varchar(19), @limite, 120) + ')';
PRINT 'LOG_OLD (la tabella di prima, intera): ' + CAST(@nOld AS varchar(12)) + ' righe (erano ' + CAST(@totale AS varchar(12)) + ')';
EXEC sp_spaceused N'dbo.LOG';
EXEC sp_spaceused N'dbo.LOG_OLD';

-- prova di scrittura come la fanno backend e PLC (INSERT con DATA, DESCR,
-- UNIT_A, UNIT_B) e, se ID e' identity, senza elenco di colonne (come
-- potrebbe farla un trigger): annullata con ROLLBACK, l'identity avanza lo
-- stesso (alla prima riga vera mancano un paio di ID, e' normale)
BEGIN TRY
	BEGIN TRAN;
	EXEC (N'INSERT INTO dbo.LOG ([DATA], DESCR, UNIT_A, UNIT_B) VALUES (GETDATE(), N''log-compatta: riga di prova'', N''PROVA'', N''PROVA'');
SELECT TOP 1 ID, [DATA], DESCR, UNIT_A, UNIT_B, DATALENGTH(DESCR) AS byte_descr, DATALENGTH(UNIT_A) AS byte_unit_a FROM dbo.LOG ORDER BY ID DESC;');
	IF @identita = 1
		EXEC (N'INSERT INTO dbo.LOG VALUES (GETDATE(), N''log-compatta: prova senza elenco di colonne'', N''PROVA'', N''PROVA'');');
	ROLLBACK TRAN;
	PRINT 'prova INSERT/SELECT riuscita e annullata (ROLLBACK).';
END TRY
BEGIN CATCH
	IF @@TRANCOUNT > 0 ROLLBACK TRAN;
	PRINT 'ATTENZIONE: prova INSERT fallita: ' + ERROR_MESSAGE() + ' -- la LOG nuova e'' gia'' al suo posto: valutare il ritorno indietro (blocco in fondo allo script) PRIMA di riavviare il servizio.';
END CATCH

-- ===========================================================================
-- PASSO 6 - fine
-- ===========================================================================
PRINT '=== PASSO 6: fine ===';
PRINT 'FATTO: LOG compatta con gli ultimi ' + CAST(@giorni AS varchar(10)) + ' giorni. LOG_OLD (la tabella di prima) NON e'' stata eliminata: resta per il ritorno indietro (blocco commentato in fondo allo script).';
PRINT 'Lo spazio nel file del database torna libero solo eliminando LOG_OLD, decisione a parte. Ora si puo'' riavviare il servizio EasyBoxBackend.';

-- ===========================================================================
-- RITORNO INDIETRO (scambio inverso). COMMENTATO: non parte con lo script.
--
-- Rimette la tabella di prima (LOG_OLD) al posto di quella nuova. A cella
-- ferma e servizio EasyBoxBackend fermo, da sqlcmd o SSMS, togliendo "-- "
-- davanti alle righe del blocco:
--
-- SET XACT_ABORT ON;
-- BEGIN TRAN;
-- EXEC sp_rename N'dbo.LOG', N'LOG_NEW';
-- EXEC sp_rename N'dbo.PK_LOG', N'PK_LOG_NEW', N'OBJECT';
-- EXEC sp_rename N'dbo.LOG_OLD', N'LOG';
-- EXEC sp_rename N'dbo.PK_LOG_OLD', N'PK_LOG', N'OBJECT';
-- COMMIT TRAN;
-- SELECT COUNT(*) AS righe, MIN([DATA]) AS dal, MAX([DATA]) AS al FROM dbo.LOG;
--
-- NOTE
-- - Se la LOG di prima non aveva una chiave primaria ("chiave primaria di
--   LOG: (nessuna)" al passo 0), PK_LOG_OLD non esiste: togliere la quarta
--   sp_rename.
-- - Eventuali DEFAULT restano coi nomi DF_LOG_OLD_<colonna> sulla LOG rimessa
--   e DF_LOG_<colonna> su LOG_NEW: sono solo nomi, non cambiano niente.
-- - Le righe scritte dopo lo scambio restano in LOG_NEW (ID oltre il MAX(ID)
--   della LOG di prima). I permessi della LOG di prima sono rimasti suoi.
-- ===========================================================================
