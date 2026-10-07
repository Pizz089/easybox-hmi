-- ===========================================================================
-- gripper-has-hook.sql - vista GRIPPERS con la colonna HAS_HOOK (uncino per i
-- cassetti), consegna 34 del 7/10
--
-- PERCHE'. Decisione di Dario del 7/10: l'uncino per i cassetti e' fisso su
-- certe pinze, quindi e' un dato dell'anagrafica. La colonna GRIPPER.HAS_HOOK
-- esiste gia': VERIFICATO in cella il 7/10 il tipo, bit; nullabilita' e
-- default NON verificati (la query del 7/10 leggeva solo il tipo; sul clone
-- del portatile e' NOT NULL, default 0). Valori in cella: 1 sulla pinza
-- doppia (26 e 37), 0 sulla pinza pallet (1) e sulle vecchie righe "gancio"
-- 15 e 24 (SUB_POS 1002). Il PLC 34 la legge dalla tabella.
-- La vista GRIPPERS invece elenca le colonne per nome (vedi
-- gripper-claw-length.sql) e non la espone: il pannello, che legge le pinze
-- dalla vista (CONF/Gripper.js, select * from GRIPPERS), non la vede.
--
-- COSA FA. ALTER VIEW che aggiunge G.HAS_HOOK subito dopo G.CLAW_LENGTH e
-- lascia invariate tutte le altre colonne. Niente ALTER TABLE: la colonna
-- c'e'. Se manca, FERMO.
--
-- GUARDIA (a spazi normalizzati, dal primo "SELECT G.ID," in poi):
--   versione di gripper-claw-length.sql (senza HAS_HOOK) -> ALTER, "estesa";
--   versione con HAS_HOOK (questo script)               -> "conforme";
--   vista assente o qualsiasi altra versione            -> FERMO, stampa la
--                                                          definizione trovata.
-- Il confronto e' sul testo intero, non su un LIKE: una vista con altre
-- colonne non viene riscritta (le perderebbe), si ferma e si riporta.
--
-- COMANDO (da PowerShell, in cella, PRIMA del pannello che mostra la casella):
--   cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -i gripper-has-hook.sql
-- Atteso: "estesa con HAS_HOOK"; rilanciato, "conforme". La verifica in fondo
-- elenca le pinze con HAS_HOOK: controllare che sia 1 su tutte e sole le
-- pinze con l'uncino (precondizione del download della consegna 34).
--
-- ROLLBACK: ALTER VIEW dbo.GRIPPERS AS <testo di @vClaw qui sotto>. Il
-- pannello senza HAS_HOOK nella vista non mostra la casella e non scrive la
-- colonna (resta com'e').
-- ===========================================================================
SET NOCOUNT ON;

IF COL_LENGTH('dbo.GRIPPER', 'HAS_HOOK') IS NULL
BEGIN
	PRINT 'FERMO: la colonna GRIPPER.HAS_HOOK non esiste. Questo script non la crea (niente ALTER TABLE): riportare.';
	RETURN;
END

DECLARE @def nvarchar(max) = OBJECT_DEFINITION(OBJECT_ID('dbo.GRIPPERS'));

-- versione di gripper-claw-length.sql (solo per riconoscerla)
DECLARE @vClaw nvarchar(max) = N'SELECT 	G.ID,rtrim(G.FAMILY) as FAMILY, rtrim(G.DESCR) as DESCR,
		G.X_BODY, G.Y_BODY,G.Z_BODY,
		G.X_CLAW ,G.Y_CLAW ,G.Z_CLAW ,
		G.STATUS, ST.DESCR AS STATUS_DESC, G.SUB_POS, G.POS_MAG,G.POS_PLANT,G.STROKE_CLAW,G.TICKNESS_CLAW
		,G.CLAW_LENGTH
		,gt.Valve3*100+gt.valve2*10+gt.Valve1 as VALVES,
		g.X_ROT, g.Y_ROT, g.Z_ROT
FROM GRIPPER G, [_STATUS_TYPE] ST , [_Gripper_Type] gt
WHERE G.STATUS =ST.ID and g.FAMILY =gt.[TYPE]';

-- versione con HAS_HOOK (7/10, consegna 34): la stessa piu' una riga
DECLARE @v nvarchar(max) = N'SELECT 	G.ID,rtrim(G.FAMILY) as FAMILY, rtrim(G.DESCR) as DESCR,
		G.X_BODY, G.Y_BODY,G.Z_BODY,
		G.X_CLAW ,G.Y_CLAW ,G.Z_CLAW ,
		G.STATUS, ST.DESCR AS STATUS_DESC, G.SUB_POS, G.POS_MAG,G.POS_PLANT,G.STROKE_CLAW,G.TICKNESS_CLAW
		,G.CLAW_LENGTH
		,G.HAS_HOOK
		,gt.Valve3*100+gt.valve2*10+gt.Valve1 as VALVES,
		g.X_ROT, g.Y_ROT, g.Z_ROT
FROM GRIPPER G, [_STATUS_TYPE] ST , [_Gripper_Type] gt
WHERE G.STATUS =ST.ID and g.FAMILY =gt.[TYPE]';

-- normalizzazione: spazi, ';' finale, dal primo "SELECT G.ID," in poi
DECLARE @t TABLE (k varchar(5) PRIMARY KEY, txt nvarchar(max));
INSERT INTO @t VALUES ('def', ISNULL(@def, N'')), ('vClaw', @vClaw), ('v', @v);
UPDATE @t SET txt = REPLACE(REPLACE(REPLACE(txt, CHAR(13), N' '), CHAR(10), N' '), CHAR(9), N' ');
WHILE EXISTS (SELECT 1 FROM @t WHERE CHARINDEX(N'  ', txt) > 0)
	UPDATE @t SET txt = REPLACE(txt, N'  ', N' ') WHERE CHARINDEX(N'  ', txt) > 0;
UPDATE @t SET txt = LTRIM(RTRIM(txt));
UPDATE @t SET txt = RTRIM(LEFT(txt, LEN(txt) - 1)) WHERE RIGHT(txt, 1) = N';';
UPDATE @t SET txt = SUBSTRING(txt, CHARINDEX(N'SELECT G.ID,', txt), LEN(txt)) WHERE CHARINDEX(N'SELECT G.ID,', txt) > 0;
DECLARE @nDef nvarchar(max) = (SELECT txt FROM @t WHERE k = 'def');
DECLARE @nClaw nvarchar(max) = (SELECT txt FROM @t WHERE k = 'vClaw');
DECLARE @nV nvarchar(max) = (SELECT txt FROM @t WHERE k = 'v');

IF @def IS NULL
BEGIN
	PRINT 'FERMO: la vista GRIPPERS non esiste. Nessuna modifica: riportare.';
END
ELSE IF @nDef = @nV
	PRINT 'GRIPPERS: gia'' presente e conforme (con HAS_HOOK), nessuna modifica.';
ELSE IF @nDef = @nClaw
BEGIN
	EXEC (N'ALTER VIEW dbo.GRIPPERS AS ' + @v);
	-- riletta: deve essere la versione con HAS_HOOK
	DECLARE @dopo nvarchar(max) = REPLACE(REPLACE(REPLACE(OBJECT_DEFINITION(OBJECT_ID('dbo.GRIPPERS')), CHAR(13), N' '), CHAR(10), N' '), CHAR(9), N' ');
	WHILE CHARINDEX(N'  ', @dopo) > 0 SET @dopo = REPLACE(@dopo, N'  ', N' ');
	SET @dopo = LTRIM(RTRIM(@dopo));
	IF RIGHT(@dopo, 1) = N';' SET @dopo = RTRIM(LEFT(@dopo, LEN(@dopo) - 1));
	IF CHARINDEX(N'SELECT G.ID,', @dopo) > 0 SET @dopo = SUBSTRING(@dopo, CHARINDEX(N'SELECT G.ID,', @dopo), LEN(@dopo));
	IF @dopo = @nV
		PRINT 'GRIPPERS: estesa con HAS_HOOK (ogni altra colonna invariata).';
	ELSE
		PRINT 'FERMO: ALTER VIEW non riuscita o definizione diversa dall''attesa (vedi errore sopra).';
END
ELSE
BEGIN
	PRINT 'FERMO: GRIPPERS esiste ma non e'' ne'' la versione di gripper-claw-length.sql ne'' quella con HAS_HOOK. Nessuna modifica. Definizione trovata:';
	SELECT @def AS definizione_trovata;
END

-- VERIFICA (sola lettura)
IF COL_LENGTH('dbo.GRIPPERS', 'HAS_HOOK') IS NOT NULL
BEGIN
	PRINT 'VERIFICA: pinze nella vista GRIPPERS con HAS_HOOK (1 = uncino per i cassetti)';
	EXEC (N'select ID, FAMILY, SUB_POS, POS_PLANT, HAS_HOOK from GRIPPERS order by ID');
END
ELSE
	PRINT 'VERIFICA: la vista GRIPPERS non ha HAS_HOOK.';
