-- ===========================================================================
-- vice-jaw-rollback.sql - RITORNO dal catalogo delle chele della morsa, in UN
-- solo script (8/10, prompt 8; prima erano due: vice-jaw-views-rollback.sql
-- e vice-jaw-rollback.sql)
--
-- PERCHE' UNO SOLO. Prima le viste tornavano alle colonne della MORSA e solo
-- dopo un secondo script ci copiava le misure del tipo montato. Se il secondo
-- si fermava (per esempio per una battuta corretta che diventerebbe
-- negativa: battuta 0 e chele montate piu' lunghe, caso normale) le viste
-- leggevano colonne ferme al giorno della migrazione: quota di deposito
-- sbagliata. Adesso misure, battute e viste cambiano INSIEME, in una
-- transazione con SET XACT_ABORT ON: o tutto o niente.
--
-- QUANDO, e IN CHE ORDINE (procedura in APPUNTI-CELLA, catalogo delle chele):
--   0. cella in HOLD, nessuno al pannello, backup del DB verificato (BACKUP
--      ... COPY_ONLY e RESTORE VERIFYONLY, con un altro nome di file);
--   1. backend fermo: Stop-Service EasyBoxBackend (il backend col catalogo
--      scriverebbe nelle tabelle che qui si tolgono);
--   2. QUESTO SCRIPT, PRIMA di pannello.ps1 -Versione ritorno: ai commit di
--      ritorno gli script vice-jaw*.sql non esistono piu' su disco;
--   3. pannello.ps1 -Versione ritorno -Commit <commit prima del catalogo>,
--      che ricompila il pannello e riavvia backend e pannello.
-- Nessun git checkout a mano.
--
-- COSA FA:
--   A. CONTROLLI, senza scrivere niente. FERMO se:
--        - catalogo e colonne ci sono solo in parte;
--        - una delle quattro viste (COORDINATES_Z_MC, COORDINATES_PUSH_MC,
--          COORDINATES_BLOW_MC, VICES) non e' ne' la versione col catalogo
--          (8/10, o del 7/10 mai andata in cella) ne' quella di prima;
--        - una battuta, riportata al valore corretto per le chele montate,
--          verrebbe NEGATIVA (PIECE_ON_VICE non la ammette): si elencano le
--          righe. Si sistema rimontando le chele con cui la battuta e' stata
--          dichiarata, o dichiarando di nuovo la battuta con le chele
--          montate (Spinta in battuta), poi si rilancia lo script;
--   B. UNA TRANSAZIONE (XACT_ABORT), solo quello che serve alle viste di prima:
--        1. (il controllo dei negativi, sopra: FERMO prima di scrivere);
--        2. le colonne della MORSA (CLAW_LENGTH, Z_CLAW, Z_SINK_CLAW) prendono
--           le misure del tipo montato (NULL se la morsa non ne ha uno; con
--           il catalogo VUOTO, cioe' vice-jaw.sql fermo prima della
--           migrazione, non si toccano: sono ancora le misure vere), UNA
--           MORSA ALLA VOLTA: VICE_trig scrive in LOG il prodotto incrociato
--           di inserted e deleted, con piu' righe insieme mescolerebbe le
--           morse;
--        3. STOP_BEYOND_CLAW prende la battuta CORRETTA (STOP_BEYOND_CLAW +
--           REF/2 - montata/2, la formula delle viste; REF = lunghezza del
--           tipo di riferimento), cosi' le viste di prima danno gli stessi
--           numeri;
--        4. ALTER delle quattro viste alla definizione di prima (COORDINATES_Z_MC
--           e COORDINATES_PUSH_MC del 6/10, COORDINATES_BLOW_MC del 5/10,
--           VICES SELECT v.*), solo per quelle che non lo sono gia';
--        5. COMMIT. Un errore annulla tutto: FERMO, niente cambiato.
--   C. SEPARATI, solo se B e' riuscita:
--        1. le tabelle di salvataggio (i dati che col DROP si perderebbero),
--           con data e ora nel nome, in una loro transazione:
--             VICE_JAW_BAK_<data>          il catalogo (SELECT *);
--             VICE_JAW_ID_BAK_<data>       morsa -> tipo montato;
--             WORKORDER_JAW_BAK_<data>     le coppie ordine -> chele;
--             PIECE_ON_VICE_JAWREF_BAK_<data>  le battute col tipo di
--                                          riferimento e quello montato: la
--                                          battuta com'e' adesso (gia'
--                                          riportata da B) e DICHIARATA,
--                                          quella di prima, ricalcolata;
--        2. il DROP, in un'altra transazione e solo coi salvataggi fatti: le
--           tre FK, PIECE_ON_VICE.CLAW_JAW_REF, VICE.JAW_ID, WORKORDER.JAW_ID
--           e la tabella VICE_JAW; poi sp_refreshview della sola VICES.
--      Se i salvataggi o il DROP non riescono, le viste e i dati sono gia'
--      quelli di prima: le tabelle del catalogo restano li', senza nessuno
--      che le legga.
--   Conteggi stampati prima e dopo.
-- DOPO UN FERMO: non riprendere la produzione e chiamare Dario. In A e in B
-- non e' cambiato niente (le viste leggono ancora il catalogo, coerenti col
-- backend col catalogo, che pero' e' fermo).
--
-- COMANDO (cella, PowerShell da amministratore; "-f 65001": il file e' UTF-8,
-- come le definizioni di prima delle viste):
--   cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -f 65001 -y 0 -i vice-jaw-rollback.sql -o D:\Backup\vice-jaw-rollback_esito.txt; Get-Content D:\Backup\vice-jaw-rollback_esito.txt
-- ===========================================================================
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF OBJECT_ID('tempdb..#rit') IS NOT NULL DROP TABLE #rit;
CREATE TABLE #rit (fase varchar(20) NOT NULL);
GO

-- A. stato del catalogo -------------------------------------------------------
IF OBJECT_ID('dbo.VICE_JAW') IS NULL AND COL_LENGTH('dbo.VICE', 'JAW_ID') IS NULL
   AND COL_LENGTH('dbo.WORKORDER', 'JAW_ID') IS NULL AND COL_LENGTH('dbo.PIECE_ON_VICE', 'CLAW_JAW_REF') IS NULL
BEGIN
	PRINT 'Niente da togliere: catalogo e colonne non ci sono.';
	INSERT #rit VALUES ('niente');
END
ELSE IF OBJECT_ID('dbo.VICE_JAW') IS NULL OR COL_LENGTH('dbo.VICE', 'JAW_ID') IS NULL
	 OR COL_LENGTH('dbo.WORKORDER', 'JAW_ID') IS NULL OR COL_LENGTH('dbo.PIECE_ON_VICE', 'CLAW_JAW_REF') IS NULL
BEGIN
	PRINT 'FERMO: catalogo e colonne ci sono solo in parte. Nessuna modifica: riconciliare a mano (vice-jaw.sql le crea tutte).';
	INSERT #rit VALUES ('fermo');
END
GO

PRINT '== CONTEGGI PRIMA ==';
IF NOT EXISTS (SELECT 1 FROM #rit)
	EXEC (N'SELECT (SELECT COUNT(*) FROM dbo.VICE_JAW) AS tipi_chele,
		(SELECT COUNT(*) FROM dbo.VICE WHERE JAW_ID IS NOT NULL) AS morse_con_tipo,
		(SELECT COUNT(*) FROM dbo.WORKORDER WHERE JAW_ID IS NOT NULL) AS ordini_con_chele,
		(SELECT COUNT(*) FROM dbo.PIECE_ON_VICE) AS battute,
		(SELECT COUNT(*) FROM dbo.PIECE_ON_VICE WHERE CLAW_JAW_REF IS NOT NULL) AS battute_con_tipo;');
GO

-- il CODICE di una definizione, due modi (come gli script delle viste):
--   #codice_vista  commenti tolti, spazi normalizzati, dalla prima "select"
--   #codice_min    commenti tolti, TUTTI gli spazi tolti, minuscole (VICES)
IF OBJECT_ID('tempdb..#codice_vista') IS NOT NULL DROP PROCEDURE #codice_vista;
IF OBJECT_ID('tempdb..#codice_min') IS NOT NULL DROP PROCEDURE #codice_min;
GO
CREATE PROCEDURE #codice_vista @s nvarchar(max), @out nvarchar(max) OUTPUT AS
BEGIN
	DECLARE @i int, @j int;
	SET @s = ISNULL(@s, N'');
	WHILE CHARINDEX(N'--', @s) > 0
	BEGIN
		SET @i = CHARINDEX(N'--', @s);
		SET @j = CHARINDEX(CHAR(10), @s, @i);
		IF @j = 0 SET @j = LEN(@s) + 1;
		SET @s = STUFF(@s, @i, @j - @i, N'');
	END
	SET @s = REPLACE(REPLACE(REPLACE(@s, CHAR(13), N' '), CHAR(10), N' '), CHAR(9), N' ');
	WHILE CHARINDEX(N'  ', @s) > 0 SET @s = REPLACE(@s, N'  ', N' ');
	SET @s = LTRIM(RTRIM(@s));
	IF RIGHT(@s, 1) = N';' SET @s = RTRIM(LEFT(@s, LEN(@s) - 1));
	IF CHARINDEX(N'select ', @s) > 0 SET @s = SUBSTRING(@s, CHARINDEX(N'select ', @s), LEN(@s));
	SET @out = @s;
END
GO
CREATE PROCEDURE #codice_min @s nvarchar(max), @out nvarchar(max) OUTPUT AS
BEGIN
	DECLARE @i int, @j int;
	SET @s = ISNULL(@s, N'');
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
	SET @out = @s;
END
GO

-- A + B -----------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM #rit)
BEGIN
	-- le definizioni di PRIMA del catalogo (quelle lanciate in cella il 5/10 e
	-- il 6/10, copiate dagli script del repo di allora)
	DECLARE @z6 nvarchar(max) = N'select  w.ID                                    as ORDER_ID,
        w.MACHINE_ID                            as MC,
        -- QUOTA DI DEPOSITO DEL GREZZO e DI PRELIEVO DEL FINITO (19/9).
        -- Prima il calcolo era scritto a mano in TRE posti - il 10 di
        -- Part_Robot_to_MC, il 10 di Part_MC_to_Robot e la vista
        -- COORDINATES_PICKPLACE_MC - e la geometria delle ganasce era
        -- INGLOBATA in FIXTURE.Z: cambiando le chele il pezzo finiva alla quota
        -- delle vecchie. Con le chele nuove significava spingerlo 2,3 mm troppo
        -- in basso sulla morsa.
        -- Adesso FIXTURE.Z e'' il pallet piu'' il CORPO morsa, senza chele, e
        -- l''appoggio delle ganasce entra qui: Z_CLAW - Z_SINK_CLAW e'' la quota
        -- a cui il pezzo appoggia sopra il riferimento fixture.
        -- ISNULL perche'' il ponte SQL non converte NULL in zero: restituisce
        -- valori casuali.
        p.Z + pz.Z_PICK  + f.Z
            + ISNULL(v.Z_CLAW, 0) - ISNULL(v.Z_SINK_CLAW, 0)   as Z_PLACE_MC,
        p.Z + pz.Z_PLACE + f.Z
            + ISNULL(v.Z_CLAW, 0) - ISNULL(v.Z_SINK_CLAW, 0)   as Z_PICK_MC,
        -- le componenti, per poter verificare il calcolo senza rifarlo a mano
        p.Z                                     as Z_POS,
        pz.Z_PICK                               as Z_PIECE_RAW,
        pz.Z_PLACE                              as Z_PIECE_FIN,
        f.Z                                     as Z_FIXTURE,
        ISNULL(v.Z_CLAW, 0)                     as Z_CLAW,
        ISNULL(v.Z_SINK_CLAW, 0)                as Z_SINK_CLAW
from WORKORDER w
inner join [POSITION] p on RTRIM(p.PARENT) = CONCAT(''MC_'', w.MACHINE_ID)
inner join PIECE pz     on pz.ID = w.PIECE_ID
inner join FIXTURE f    on f.ID = w.FIXTURE_ID
-- la morsa segue il PALLET, come in COORDINATES_PUSH_MC
left  join VICE v       on v.PALLET_ID = w.PALLET_ID;';
	DECLARE @p6 nvarchar(max) = N'select	q.ORDER_ID,
		q.MC,
		q.X_PLACE,
		q.Y_PLACE,
		q.Z_PLACE,
		-- X_PUSH e CLEARANCE: geometria pura, senza compensazione.
		-- X_STOP: la sola quota tarata, e la compensazione si SOTTRAE — il
		-- pezzo si ferma prima della battuta teorica. La differenza fra le tre
		-- e'' il valore di COMP_PUSH, ed e'' voluto che si veda.
		case when q.PUSH_STATUS = ''OK'' then q.X_PUSH_RAW end				as X_PUSH,
		case when q.PUSH_STATUS = ''OK'' then q.X_PUSH_RAW + q.TRAVEL_RAW - q.COMP_PUSH end	as X_STOP,
		case when q.PUSH_STATUS = ''OK'' then q.TRAVEL_RAW end				as CLEARANCE,
		q.STOP_REF,
		q.STOP_BEYOND_CLAW,
		q.COMP_PUSH,
		q.PUSH_ENABLED,
		q.PUSH_STATUS,
		-- (6/10) QUOTA Z DELLA SPINTA: il PLC legge solo Z_PUSH_DROP
		q.Z_PUSH,
		q.Z_PUSH_REF,
		q.Z_PUSH_DROP
from (
	select	w.ID													as ORDER_ID,
			w.MACHINE_ID											as MC,
			p.X														as X_PLACE,
			p.Y														as Y_PLACE,
			p.Z + pz.Z_PLACE + f.Z									as Z_PLACE,
			p.X - pz.Y/2 - g.CLAW_LENGTH/2							as X_PUSH_RAW,
			-- corsa TEORICA: fino alla fine della ganascia, piu'' il tratto
			-- dichiarato SOLO quando il pezzo la eccede. La compensazione non
			-- entra qui: si toglie dall''arrivo, non da questo numero
			(v.CLAW_LENGTH - pz.Y)/2
				+ case when pz.Y > v.CLAW_LENGTH
					   then ISNULL(pv.STOP_BEYOND_CLAW, 0) else 0 end	as TRAVEL_RAW,
			pv.STOP_BEYOND_CLAW										as STOP_BEYOND_CLAW,
			-- ISNULL obbligatorio: NULL sui pezzi non tarati, e il ponte SQL
			-- non lo converte in zero (restituisce valori casuali)
			ISNULL(pv.COMP_PUSH, 0)									as COMP_PUSH,
			case when (ISNULL(w.OPTION2,0) & 2) = 0					then null
				 when v.ID is null									then null
				 when ISNULL(v.CLAW_LENGTH,0) <= 0
				   or ISNULL(g.CLAW_LENGTH,0) <= 0
				   or ISNULL(pz.Y,0) <= 0							then null
				 when pz.Y > v.CLAW_LENGTH							then ''DECLARED''
				 else ''CLAW'' end									as STOP_REF,
			case when (ISNULL(w.OPTION2,0) & 2) <> 0 then 1 else 0 end		as PUSH_ENABLED,
			case when (ISNULL(w.OPTION2,0) & 2) = 0					then ''DISABLED''
				 when v.ID is null									then ''NO_VICE''
				 when ISNULL(v.CLAW_LENGTH,0) <= 0
				   or ISNULL(g.CLAW_LENGTH,0) <= 0
				   or ISNULL(pz.Y,0) <= 0							then ''NO_DATA''
				 when pz.Y > v.CLAW_LENGTH
				  and pv.VICE_ID is null							then ''NO_FIT''
				 when (v.CLAW_LENGTH - pz.Y)/2
					  + case when pz.Y > v.CLAW_LENGTH
							 then ISNULL(pv.STOP_BEYOND_CLAW, 0) else 0 end < 0
																	then ''NO_ROOM''
				 -- la compensazione supera la corsa: l''arrivo finirebbe dietro
				 -- la partenza e il robot spingerebbe nel verso opposto
				 when (v.CLAW_LENGTH - pz.Y)/2
					  + case when pz.Y > v.CLAW_LENGTH
							 then ISNULL(pv.STOP_BEYOND_CLAW, 0) else 0 end
					  - ISNULL(pv.COMP_PUSH, 0) < 0
																	then ''NO_COMP''
				 else ''OK'' end										as PUSH_STATUS,
			-- (6/10) altezza della chela dal FONDO del pezzo durante la spinta
			-- (micron, NULL = alla quota di presa, cioe'' alla Z di deposito)
			pv.Z_PUSH												as Z_PUSH,
			ISNULL(pz.Z_PICK, 0)									as Z_PUSH_REF,
			-- di quanto scende la chela sotto la Z di deposito. MAI NULL (il
			-- ponte SQL non converte NULL in zero); vuota, pezzo senza quota di
			-- presa o fuori campo (pezzo cambiato dopo): 0, come prima
			case when pv.Z_PUSH is null								then 0
				 when ISNULL(pz.Z_PICK, 0) <= 0						then 0
				 when pv.Z_PUSH > pz.Z_PICK							then 0
				 else pz.Z_PICK - pv.Z_PUSH end						as Z_PUSH_DROP
	from WORKORDER w
	inner join [POSITION] p	on RTRIM(p.PARENT) = CONCAT(''MC_'', w.MACHINE_ID)
	inner join PIECE pz		on pz.ID = w.PIECE_ID
	inner join FIXTURE f	on f.ID = w.FIXTURE_ID
	left  join VICE v		on v.PALLET_ID = w.PALLET_ID
	left  join GRIPPER g	on g.ID = w.GRIPPER_ID
	-- la dichiarazione segue la MORSA (v.ID), non il pallet: se la morsa si
	-- sposta su un altro pallet si porta dietro la sua battuta
	left  join PIECE_ON_VICE pv	on pv.VICE_ID = v.ID and pv.PIECE_ID = w.PIECE_ID
) q;';
	DECLARE @b5 nvarchar(max) = N'select  w.ID                            as ORDER_ID,
        w.MACHINE_ID                    as MC,
        ISNULL(v.CLAW_LENGTH,0)         as CLAW_LENGTH,
        ISNULL(pz.Y,0)                  as PART_WIDTH,
        ISNULL(pv.STOP_BEYOND_CLAW,0)   as STOP_BEYOND_CLAW,
        ISNULL(pz.X,0)                  as PART_LENGTH,
        ISNULL(pz.Z,0)                  as PART_HEIGHT
from WORKORDER w
inner join PIECE pz     on pz.ID = w.PIECE_ID
left  join VICE v       on v.PALLET_ID = w.PALLET_ID
left  join PIECE_ON_VICE pv on pv.VICE_ID = v.ID and pv.PIECE_ID = w.PIECE_ID;';
	DECLARE @v0 nvarchar(max) = N'SELECT v.*, ST.DESCR AS STATUS_DESC
FROM VICE v , [_STATUS_TYPE] st
WHERE v.STATUS =ST.ID';
	-- VICES col catalogo (quella di vices-view.sql)
	DECLARE @vn nvarchar(max) = N'SELECT v.ID, v.FAMILY, v.DESCR, v.STATUS, v.X, v.Y, v.Z,
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

	DECLARE @fermo nvarchar(400) = N'';
	DECLARE @altZ bit = 0, @altP bit = 0, @altB bit = 0, @altV bit = 0;
	DECLARE @def nvarchar(max), @a nvarchar(max), @x nvarchar(max), @norm nvarchar(max);

	-- COORDINATES_Z_MC: col catalogo (8/10, o 7/10 col blocco) -> ALTER;
	-- di prima -> niente; altro -> FERMO
	SET @def = OBJECT_DEFINITION(OBJECT_ID('dbo.COORDINATES_Z_MC'));
	EXEC #codice_vista @def, @a OUTPUT;
	EXEC #codice_vista @z6, @x OUTPUT;
	IF @def IS NULL SET @fermo = @fermo + N' COORDINATES_Z_MC (assente)';
	ELSE IF @a = @x PRINT 'COORDINATES_Z_MC: gia'' com''era prima del catalogo.';
	ELSE IF @a LIKE N'%left join VICE_JAW j on j.ID = v.JAW_ID%' AND @a LIKE N'%ISNULL(j.Z_CLAW, 0) - ISNULL(j.Z_SINK_CLAW, 0) as Z_PLACE_MC%'
		SET @altZ = 1;
	ELSE SET @fermo = @fermo + N' COORDINATES_Z_MC';

	-- COORDINATES_PUSH_MC: col catalogo (8/10 col tipo di riferimento, o 7/10)
	-- -> ALTER; di prima (Z_PUSH_DROP senza catalogo) -> niente; altro -> FERMO
	SET @def = OBJECT_DEFINITION(OBJECT_ID('dbo.COORDINATES_PUSH_MC'));
	SET @norm = REPLACE(REPLACE(REPLACE(ISNULL(@def, N''), CHAR(13), N' '), CHAR(10), N' '), CHAR(9), N' ');
	WHILE CHARINDEX(N'  ', @norm) > 0 SET @norm = REPLACE(@norm, N'  ', N' ');
	IF @def IS NULL SET @fermo = @fermo + N' COORDINATES_PUSH_MC (assente)';
	ELSE IF @norm LIKE N'%left join VICE_JAW j on j.ID = v.JAW_ID%' AND @norm LIKE N'%as Z_PUSH_DROP%'
		AND (@norm LIKE N'%else pv.STOP_BEYOND_CLAW + jr.CLAW_LENGTH/2 - j.CLAW_LENGTH/2 end as STOP_BEYOND_CLAW) s%'
		  OR @norm LIKE N'%else pv.STOP_BEYOND_CLAW + pv.CLAW_LENGTH_REF/2 - j.CLAW_LENGTH/2 end as STOP_BEYOND_CLAW) s%')
		SET @altP = 1;
	ELSE IF @norm NOT LIKE N'%VICE_JAW%' AND @norm NOT LIKE N'%CLAW_LENGTH_REF%' AND @norm NOT LIKE N'%CLAW_JAW_REF%'
		AND @norm LIKE N'%when pv.Z_PUSH > pz.Z_PICK then 0 else pz.Z_PICK - pv.Z_PUSH end as Z_PUSH_DROP%'
		PRINT 'COORDINATES_PUSH_MC: gia'' com''era prima del catalogo.';
	ELSE SET @fermo = @fermo + N' COORDINATES_PUSH_MC';

	-- COORDINATES_BLOW_MC: idem
	SET @def = OBJECT_DEFINITION(OBJECT_ID('dbo.COORDINATES_BLOW_MC'));
	SET @norm = REPLACE(REPLACE(REPLACE(ISNULL(@def, N''), CHAR(13), N' '), CHAR(10), N' '), CHAR(9), N' ');
	WHILE CHARINDEX(N'  ', @norm) > 0 SET @norm = REPLACE(@norm, N'  ', N' ');
	IF @def IS NULL SET @fermo = @fermo + N' COORDINATES_BLOW_MC (assente)';
	ELSE IF @norm LIKE N'%ISNULL(j.CLAW_LENGTH,0) as CLAW_LENGTH%' AND @norm LIKE N'%left join VICE_JAW j on j.ID = v.JAW_ID%'
		AND (@norm LIKE N'%else pv.STOP_BEYOND_CLAW + jr.CLAW_LENGTH/2 - j.CLAW_LENGTH/2 end,0) as STOP_BEYOND_CLAW%'
		  OR @norm LIKE N'%else pv.STOP_BEYOND_CLAW + pv.CLAW_LENGTH_REF/2 - j.CLAW_LENGTH/2 end,0) as STOP_BEYOND_CLAW%')
		SET @altB = 1;
	ELSE IF @norm NOT LIKE N'%VICE_JAW%' AND @norm NOT LIKE N'%CLAW_LENGTH_REF%' AND @norm NOT LIKE N'%CLAW_JAW_REF%'
		AND @norm LIKE N'%ISNULL(v.CLAW_LENGTH,0) as CLAW_LENGTH%' AND @norm LIKE N'%ISNULL(pv.STOP_BEYOND_CLAW,0) as STOP_BEYOND_CLAW%'
		PRINT 'COORDINATES_BLOW_MC: gia'' com''era prima del catalogo.';
	ELSE SET @fermo = @fermo + N' COORDINATES_BLOW_MC';

	-- VICES: col catalogo -> ALTER; SELECT v.* -> niente; altro -> FERMO
	SET @def = OBJECT_DEFINITION(OBJECT_ID('dbo.VICES'));
	EXEC #codice_min @def, @a OUTPUT;
	EXEC #codice_min @v0, @x OUTPUT;
	IF @def IS NULL SET @fermo = @fermo + N' VICES (assente)';
	ELSE IF @a = @x PRINT 'VICES: gia'' com''era prima del catalogo.';
	ELSE
	BEGIN
		EXEC #codice_min @vn, @x OUTPUT;
		IF @a = @x SET @altV = 1; ELSE SET @fermo = @fermo + N' VICES';
	END

	IF @fermo <> N''
	BEGIN
		PRINT 'FERMO: viste in una versione che non conosco:' + @fermo + '. Nessuna modifica. Non riprendere la produzione: chiamare Dario.';
		PRINT 'Leggerle con: SELECT name, definition FROM sys.sql_modules m JOIN sys.views v ON v.object_id = m.object_id;';
		INSERT #rit VALUES ('fermo');
	END
	ELSE
	BEGIN
		-- le definizioni trovate, per il ritorno del ritorno (sqlcmd -y 0)
		IF @altZ = 1 SELECT 'COORDINATES_Z_MC' AS vista, OBJECT_DEFINITION(OBJECT_ID('dbo.COORDINATES_Z_MC')) AS definizione_trovata;
		IF @altP = 1 SELECT 'COORDINATES_PUSH_MC' AS vista, OBJECT_DEFINITION(OBJECT_ID('dbo.COORDINATES_PUSH_MC')) AS definizione_trovata;
		IF @altB = 1 SELECT 'COORDINATES_BLOW_MC' AS vista, OBJECT_DEFINITION(OBJECT_ID('dbo.COORDINATES_BLOW_MC')) AS definizione_trovata;
		IF @altV = 1 SELECT 'VICES' AS vista, OBJECT_DEFINITION(OBJECT_ID('dbo.VICES')) AS definizione_trovata;

		-- la transazione: in SQL dinamico, perche' le colonne che si leggono
		-- (JAW_ID, CLAW_JAW_REF) devono esistere quando si compila
		DECLARE @corpo nvarchar(max) = N'
		SET XACT_ABORT ON;
		-- A. battute che diventerebbero negative: FERMO PRIMA di scrivere
		IF EXISTS (SELECT 1 FROM dbo.PIECE_ON_VICE pv JOIN dbo.VICE v ON v.ID = pv.VICE_ID
				   JOIN dbo.VICE_JAW j ON j.ID = v.JAW_ID JOIN dbo.VICE_JAW jr ON jr.ID = pv.CLAW_JAW_REF
				   WHERE j.CLAW_LENGTH > 0 AND jr.CLAW_LENGTH > 0
					 AND pv.STOP_BEYOND_CLAW + jr.CLAW_LENGTH/2 - j.CLAW_LENGTH/2 < 0)
		BEGIN
			PRINT ''FERMO: con le chele montate queste battute corrette verrebbero NEGATIVE (PIECE_ON_VICE non le ammette). Nessuna modifica. Rimontare le chele con cui sono state dichiarate, o dichiararle di nuovo con le chele montate (Spinta in battuta), poi rilanciare. Non riprendere la produzione: chiamare Dario.'';
			SELECT pv.VICE_ID, pv.PIECE_ID, pv.STOP_BEYOND_CLAW AS DICHIARATA, RTRIM(jr.CODE) AS CHELE_DICHIARAZIONE, jr.CLAW_LENGTH AS LUNGHEZZA_DICHIARAZIONE,
				   RTRIM(j.CODE) AS CHELE_MONTATE, j.CLAW_LENGTH AS LUNGHEZZA_MONTATA,
				   pv.STOP_BEYOND_CLAW + jr.CLAW_LENGTH/2 - j.CLAW_LENGTH/2 AS CORRETTA
			  FROM dbo.PIECE_ON_VICE pv JOIN dbo.VICE v ON v.ID = pv.VICE_ID
			  JOIN dbo.VICE_JAW j ON j.ID = v.JAW_ID JOIN dbo.VICE_JAW jr ON jr.ID = pv.CLAW_JAW_REF
			 WHERE j.CLAW_LENGTH > 0 AND jr.CLAW_LENGTH > 0
			   AND pv.STOP_BEYOND_CLAW + jr.CLAW_LENGTH/2 - j.CLAW_LENGTH/2 < 0;
			INSERT #rit VALUES (''fermo'');
			RETURN;
		END
		BEGIN TRY
			BEGIN TRAN;
			-- B2. misure del tipo montato nelle colonne della morsa, una morsa
			-- alla volta (VICE_trig), solo dove cambiano. Con il catalogo VUOTO
			-- (vice-jaw.sql fermo prima della migrazione: tabella e colonne ci
			-- sono, i tipi no) le colonne della morsa sono ancora le misure vere
			-- e le viste non le hanno mai lette dal catalogo: non si toccano
			DECLARE @v int, @n int = 0;
			IF NOT EXISTS (SELECT 1 FROM dbo.VICE_JAW)
				PRINT ''catalogo vuoto (migrazione mai fatta): le colonne delle morse restano come sono.'';
			DECLARE c CURSOR LOCAL FAST_FORWARD FOR
				SELECT v.ID FROM dbo.VICE v LEFT JOIN dbo.VICE_JAW j ON j.ID = v.JAW_ID
				 WHERE EXISTS (SELECT 1 FROM dbo.VICE_JAW)
				   AND (ISNULL(v.CLAW_LENGTH, -1) <> ISNULL(j.CLAW_LENGTH, -1) OR ISNULL(v.Z_CLAW, -1) <> ISNULL(j.Z_CLAW, -1)
					OR ISNULL(v.Z_SINK_CLAW, -1) <> ISNULL(j.Z_SINK_CLAW, -1))
				 ORDER BY v.ID;
			OPEN c;
			FETCH NEXT FROM c INTO @v;
			WHILE @@FETCH_STATUS = 0
			BEGIN
				UPDATE v SET CLAW_LENGTH = j.CLAW_LENGTH, Z_CLAW = j.Z_CLAW, Z_SINK_CLAW = j.Z_SINK_CLAW
				  FROM dbo.VICE v LEFT JOIN dbo.VICE_JAW j ON j.ID = v.JAW_ID WHERE v.ID = @v;
				SET @n = @n + 1;
				FETCH NEXT FROM c INTO @v;
			END
			CLOSE c;
			DEALLOCATE c;
			PRINT ''morse: '' + CAST(@n AS nvarchar(12)) + '' con le misure del tipo montato riportate nelle colonne della morsa.'';

			-- B3. battuta corretta per le chele montate
			UPDATE pv SET STOP_BEYOND_CLAW = pv.STOP_BEYOND_CLAW + jr.CLAW_LENGTH/2 - j.CLAW_LENGTH/2
			  FROM dbo.PIECE_ON_VICE pv JOIN dbo.VICE v ON v.ID = pv.VICE_ID
			  JOIN dbo.VICE_JAW j ON j.ID = v.JAW_ID JOIN dbo.VICE_JAW jr ON jr.ID = pv.CLAW_JAW_REF
			 WHERE j.CLAW_LENGTH > 0 AND jr.CLAW_LENGTH > 0 AND jr.CLAW_LENGTH/2 <> j.CLAW_LENGTH/2;
			PRINT ''battute: '' + CAST(@@ROWCOUNT AS nvarchar(12)) + '' riportate al valore corretto per le chele montate.'';

			-- B4. le viste com''erano
			IF @altZ = 1 BEGIN EXEC (N''ALTER VIEW dbo.COORDINATES_Z_MC AS '' + @z6); PRINT ''COORDINATES_Z_MC: riportata alla versione del 6/10.''; END
			IF @altP = 1 BEGIN EXEC (N''ALTER VIEW dbo.COORDINATES_PUSH_MC AS
'' + @p6); PRINT ''COORDINATES_PUSH_MC: riportata alla versione del 6/10 (quota Z della spinta, senza catalogo).''; END
			IF @altB = 1 BEGIN EXEC (N''ALTER VIEW dbo.COORDINATES_BLOW_MC AS
'' + @b5); PRINT ''COORDINATES_BLOW_MC: riportata alla versione del 5/10.''; END
			IF @altV = 1 BEGIN EXEC (N''ALTER VIEW dbo.VICES AS '' + @v0); PRINT ''VICES: riportata a SELECT v.*.''; END

			COMMIT;
			INSERT #rit VALUES (''fatto'');
			PRINT ''RITORNO: misure, battute e viste riportate (transazione confermata).'';
		END TRY
		BEGIN CATCH
			IF @@TRANCOUNT > 0 ROLLBACK;
			PRINT ''FERMO: ritorno NON riuscito, annullato per intero ('' + ERROR_MESSAGE() + ''). Nessuna modifica. Non riprendere la produzione: chiamare Dario.'';
			INSERT #rit VALUES (''fermo'');
		END CATCH';
		EXEC sp_executesql @corpo,
			N'@z6 nvarchar(max), @p6 nvarchar(max), @b5 nvarchar(max), @v0 nvarchar(max), @altZ bit, @altP bit, @altB bit, @altV bit',
			@z6 = @z6, @p6 = @p6, @b5 = @b5, @v0 = @v0, @altZ = @altZ, @altP = @altP, @altB = @altB, @altV = @altV;
	END
END
GO

-- C1. tabelle di salvataggio, solo dopo B riuscita ----------------------------
-- in SQL dinamico: le colonne del catalogo devono esistere quando si compila
IF EXISTS (SELECT 1 FROM #rit WHERE fase = 'fatto') AND NOT EXISTS (SELECT 1 FROM #rit WHERE fase = 'fermo')
BEGIN TRY
	DECLARE @dt nvarchar(20) = CONVERT(nvarchar(8), GETDATE(), 112) + N'_' + REPLACE(CONVERT(nvarchar(8), GETDATE(), 108), N':', N'');
	BEGIN TRAN;
	EXEC (N'SELECT * INTO dbo.VICE_JAW_BAK_' + @dt + N' FROM dbo.VICE_JAW;');
	EXEC (N'SELECT ID AS VICE_ID, JAW_ID INTO dbo.VICE_JAW_ID_BAK_' + @dt + N' FROM dbo.VICE WHERE JAW_ID IS NOT NULL;');
	EXEC (N'SELECT ID AS ORDER_ID, STATUS, JAW_ID INTO dbo.WORKORDER_JAW_BAK_' + @dt + N' FROM dbo.WORKORDER WHERE JAW_ID IS NOT NULL;');
	-- DICHIARATA: la battuta di prima del ritorno. B l'ha riportata alle chele
	-- montate solo con le due lunghezze > 0: il conto inverso e' esatto
	EXEC (N'SELECT pv.VICE_ID, pv.PIECE_ID, pv.STOP_BEYOND_CLAW AS BATTUTA_ADESSO,
			CASE WHEN jr.CLAW_LENGTH > 0 AND j.CLAW_LENGTH > 0 THEN pv.STOP_BEYOND_CLAW - jr.CLAW_LENGTH/2 + j.CLAW_LENGTH/2
				 ELSE pv.STOP_BEYOND_CLAW END AS DICHIARATA,
			pv.CLAW_JAW_REF, v.JAW_ID AS MONTATO, jr.CLAW_LENGTH AS LUNGHEZZA_RIF, j.CLAW_LENGTH AS LUNGHEZZA_MONTATA
		INTO dbo.PIECE_ON_VICE_JAWREF_BAK_' + @dt + N'
		FROM dbo.PIECE_ON_VICE pv LEFT JOIN dbo.VICE v ON v.ID = pv.VICE_ID
		LEFT JOIN dbo.VICE_JAW j ON j.ID = v.JAW_ID LEFT JOIN dbo.VICE_JAW jr ON jr.ID = pv.CLAW_JAW_REF
		WHERE pv.CLAW_JAW_REF IS NOT NULL;');
	COMMIT;
	INSERT #rit VALUES ('salvate');
	PRINT 'salvate: VICE_JAW_BAK_' + @dt + ', VICE_JAW_ID_BAK_' + @dt + ', WORKORDER_JAW_BAK_' + @dt + ', PIECE_ON_VICE_JAWREF_BAK_' + @dt;
END TRY
BEGIN CATCH
	IF @@TRANCOUNT > 0 ROLLBACK;
	PRINT 'Tabelle di salvataggio NON fatte (' + ERROR_MESSAGE() + '): DROP non fatto. Le viste e i dati sono gia'' quelli di prima; le tabelle del catalogo restano, senza nessuno che le legga. Chiamare Dario.';
END CATCH
GO

-- C2. DROP, solo coi salvataggi fatti ------------------------------------------
IF EXISTS (SELECT 1 FROM #rit WHERE fase = 'salvate') AND NOT EXISTS (SELECT 1 FROM #rit WHERE fase = 'fermo')
BEGIN
	-- nessuna vista deve leggere ancora il catalogo
	IF EXISTS (SELECT 1 FROM sys.views
		WHERE OBJECT_DEFINITION(object_id) LIKE N'%VICE_JAW%' OR OBJECT_DEFINITION(object_id) LIKE N'%CLAW_JAW_REF%'
		   OR OBJECT_DEFINITION(object_id) LIKE N'%JAW_ID%')
	BEGIN
		PRINT 'FERMO: queste viste leggono ancora il catalogo, DROP non fatto (le viste lette dal PLC sono gia'' quelle di prima):';
		SELECT name FROM sys.views
		 WHERE OBJECT_DEFINITION(object_id) LIKE N'%VICE_JAW%' OR OBJECT_DEFINITION(object_id) LIKE N'%CLAW_JAW_REF%'
			OR OBJECT_DEFINITION(object_id) LIKE N'%JAW_ID%';
	END
	ELSE
	BEGIN TRY
		BEGIN TRAN;
		IF OBJECT_ID('dbo.FK_PIECE_ON_VICE_CLAW_JAW_REF', 'F') IS NOT NULL ALTER TABLE dbo.PIECE_ON_VICE DROP CONSTRAINT FK_PIECE_ON_VICE_CLAW_JAW_REF;
		IF OBJECT_ID('dbo.FK_VICE_JAW_ID', 'F') IS NOT NULL ALTER TABLE dbo.VICE DROP CONSTRAINT FK_VICE_JAW_ID;
		IF OBJECT_ID('dbo.FK_WORKORDER_JAW_ID', 'F') IS NOT NULL ALTER TABLE dbo.WORKORDER DROP CONSTRAINT FK_WORKORDER_JAW_ID;
		ALTER TABLE dbo.PIECE_ON_VICE DROP COLUMN CLAW_JAW_REF;
		ALTER TABLE dbo.VICE DROP COLUMN JAW_ID;
		ALTER TABLE dbo.WORKORDER DROP COLUMN JAW_ID;
		DROP TABLE dbo.VICE_JAW;
		COMMIT;
		PRINT 'DROP: tolti le tre FK, PIECE_ON_VICE.CLAW_JAW_REF, VICE.JAW_ID, WORKORDER.JAW_ID e VICE_JAW.';
		-- la sola VICES (SELECT v.*) vede di nuovo le colonne della morsa; le
		-- altre viste con l'asterisco non sono mai state rinfrescate
		EXEC sp_refreshview N'dbo.VICES';
		PRINT 'refresh vista dbo.VICES: ok';
	END TRY
	BEGIN CATCH
		IF @@TRANCOUNT > 0 ROLLBACK;
		PRINT 'DROP NON riuscito (' + ERROR_MESSAGE() + '). Le viste e i dati sono gia'' quelli di prima; le tabelle del catalogo restano, senza nessuno che le legga. Chiamare Dario.';
	END CATCH
END
ELSE IF EXISTS (SELECT 1 FROM #rit WHERE fase = 'fermo')
	PRINT 'DROP non fatto: il ritorno si e'' FERMATO prima (vedi sopra).';
ELSE IF EXISTS (SELECT 1 FROM #rit WHERE fase = 'fatto')
	PRINT 'DROP non fatto: mancano le tabelle di salvataggio (vedi sopra).';
GO

PRINT '== DOPO ==';
SELECT CASE WHEN OBJECT_ID('dbo.VICE_JAW') IS NULL THEN 'tolta' ELSE 'C''E'' ANCORA' END AS VICE_JAW,
	   CASE WHEN COL_LENGTH('dbo.VICE', 'JAW_ID') IS NULL THEN 'tolta' ELSE 'C''E'' ANCORA' END AS VICE_JAW_ID,
	   CASE WHEN COL_LENGTH('dbo.WORKORDER', 'JAW_ID') IS NULL THEN 'tolta' ELSE 'C''E'' ANCORA' END AS WORKORDER_JAW_ID,
	   CASE WHEN COL_LENGTH('dbo.PIECE_ON_VICE', 'CLAW_JAW_REF') IS NULL THEN 'tolta' ELSE 'C''E'' ANCORA' END AS CLAW_JAW_REF;
SELECT (SELECT COUNT(*) FROM dbo.VICE) AS morse,
	   (SELECT COUNT(*) FROM dbo.VICE WHERE CLAW_LENGTH IS NOT NULL OR Z_CLAW IS NOT NULL OR Z_SINK_CLAW IS NOT NULL) AS morse_con_misure,
	   (SELECT COUNT(*) FROM dbo.PIECE_ON_VICE) AS battute,
	   (SELECT COUNT(*) FROM dbo.WORKORDER) AS ordini;
PRINT 'tabelle di salvataggio:';
SELECT name, create_date FROM sys.tables WHERE name LIKE N'%[_]BAK[_]%' AND (name LIKE N'VICE_JAW%' OR name LIKE N'WORKORDER_JAW%' OR name LIKE N'PIECE_ON_VICE_JAWREF%') ORDER BY create_date DESC, name;
PRINT 'viste che leggono ancora il catalogo (atteso: nessuna riga)';
SELECT name FROM sys.views
 WHERE OBJECT_DEFINITION(object_id) LIKE N'%VICE_JAW%' OR OBJECT_DEFINITION(object_id) LIKE N'%CLAW_JAW_REF%'
	OR OBJECT_DEFINITION(object_id) LIKE N'%JAW_ID%';
SELECT fase FROM #rit;
GO
