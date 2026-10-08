-- ===========================================================================
-- vice-jaw-views-rollback.sql - RITORNO delle quattro viste alla versione
-- di prima del catalogo delle chele (7/10, prompt 5 di 5)
--
-- Riporta COORDINATES_Z_MC (6/10), COORDINATES_PUSH_MC (6/10, quota Z della
-- spinta), COORDINATES_BLOW_MC (5/10) e VICES (SELECT v.*) a com'erano prima
-- di coordinates-z-mc.sql, coordinates-push-mc.sql, coordinates-blow-mc.sql e
-- vices-view.sql del 7/10. Per ogni vista:
--   versione del 7/10      -> stampa la definizione trovata, ALTER a quella
--                             di prima;
--   versione di prima      -> "gia' com'era", nessuna modifica;
--   qualunque altra        -> FERMO per quella vista, non sovrascrive.
-- I testi di prima sono quelli degli script del repo prima del 7/10 (in
-- cella: quelli lanciati il 5/10 e il 6/10), copiati qui da git.
--
-- ATTENZIONE: tornate le viste, le quote tornano a leggere le colonne della
-- MORSA (VICE.CLAW_LENGTH, Z_CLAW, Z_SINK_CLAW), ferme al giorno della
-- migrazione. Per riportarci le misure del tipo montato e la battuta
-- corretta, lanciare SUBITO DOPO vice-jaw-rollback.sql (che lo fa prima di
-- togliere tabella e colonne). Il backend del 7/10 scrive nel catalogo:
-- si torna indietro insieme al backend (git checkout del commit di prima e
-- servizi-cella.ps1 -Azione aggiorna), PRIMA di questo script.
--
-- COMANDO (cella, a cella ferma):
--   cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -f 65001 -y 0 -i vice-jaw-views-rollback.sql -o D:\Backup\vice-jaw-views-rollback_esito.txt; Get-Content D:\Backup\vice-jaw-views-rollback_esito.txt
-- ===========================================================================
SET NOCOUNT ON;
GO

-- ---------------------------------------------------------------- COORDINATES_Z_MC
DECLARE @def nvarchar(max) = OBJECT_DEFINITION(OBJECT_ID('dbo.COORDINATES_Z_MC'));
DECLARE @vecchia nvarchar(max) = N'select  w.ID                                    as ORDER_ID,
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
DECLARE @nuova nvarchar(max) = N'select  w.ID                                    as ORDER_ID,
        w.MACHINE_ID                            as MC,
        -- QUOTA DI DEPOSITO DEL GREZZO e DI PRELIEVO DEL FINITO (19/9).
        -- FIXTURE.Z e il pallet piu il CORPO morsa, senza chele; l appoggio
        -- delle chele entra qui: Z_CLAW - Z_SINK_CLAW e la quota a cui il
        -- pezzo appoggia sopra il riferimento fixture.
        -- (7/10) le misure vengono dal CATALOGO delle chele (VICE_JAW), il tipo
        -- montato sulla morsa del pallet (VICE.JAW_ID): dato unico.
        -- ISNULL perche il ponte SQL non converte NULL in zero: restituisce
        -- valori casuali.
        p.Z + pz.Z_PICK  + f.Z
            + ISNULL(j.Z_CLAW, 0) - ISNULL(j.Z_SINK_CLAW, 0)   as Z_PLACE_MC,
        p.Z + pz.Z_PLACE + f.Z
            + ISNULL(j.Z_CLAW, 0) - ISNULL(j.Z_SINK_CLAW, 0)   as Z_PICK_MC,
        -- le componenti, per poter verificare il calcolo senza rifarlo a mano
        p.Z                                     as Z_POS,
        pz.Z_PICK                               as Z_PIECE_RAW,
        pz.Z_PLACE                              as Z_PIECE_FIN,
        f.Z                                     as Z_FIXTURE,
        ISNULL(j.Z_CLAW, 0)                     as Z_CLAW,
        ISNULL(j.Z_SINK_CLAW, 0)                as Z_SINK_CLAW
from WORKORDER w
inner join [POSITION] p on RTRIM(p.PARENT) = CONCAT(''MC_'', w.MACHINE_ID)
inner join PIECE pz     on pz.ID = w.PIECE_ID
inner join FIXTURE f    on f.ID = w.FIXTURE_ID
-- la morsa segue il PALLET, come in COORDINATES_PUSH_MC
left  join VICE v       on v.PALLET_ID = w.PALLET_ID
left  join VICE_JAW j   on j.ID = v.JAW_ID
-- (7/10) BLOCCO CHELE: con le chele dell ordine diverse da quelle montate la
-- vista non da righe e il PLC si ferma col 799 prima di muovere. Ordini
-- senza chele confermate (JAW_ID NULL): come prima.
where w.JAW_ID is null or w.JAW_ID = v.JAW_ID;';
DECLARE @s nvarchar(max), @i int, @j int, @a nvarchar(max), @o nvarchar(max), @n nvarchar(max);
	SET @s = ISNULL(@def, N'');
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
	SET @a = @s;
	SET @s = @vecchia;
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
	SET @o = @s;
	SET @s = @nuova;
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
	SET @n = @s;

IF @def IS NULL
	PRINT 'COORDINATES_Z_MC: la vista non esiste. FERMO per questa vista.';
ELSE IF @a = @o
	PRINT 'COORDINATES_Z_MC: gia'' com''era prima del 7/10, nessuna modifica.';
ELSE IF @a = @n
BEGIN
	PRINT 'COORDINATES_Z_MC: versione del 7/10. Definizione trovata:';
	SELECT @def AS definizione_trovata;
	EXEC (N'ALTER VIEW dbo.COORDINATES_Z_MC AS ' + @vecchia);
	PRINT 'COORDINATES_Z_MC: riportata alla versione del 6/10.';
END
ELSE
BEGIN
	PRINT 'FERMO: COORDINATES_Z_MC non e'' nessuna delle versioni note. Nessuna modifica. Definizione trovata:';
	SELECT @def AS definizione_trovata;
END
GO

-- ---------------------------------------------------------------- COORDINATES_PUSH_MC
DECLARE @def NVARCHAR(MAX) = OBJECT_DEFINITION(OBJECT_ID('dbo.COORDINATES_PUSH_MC'));
DECLARE @norm NVARCHAR(MAX) = REPLACE(REPLACE(REPLACE(ISNULL(@def, N''),
	CHAR(13), N' '), CHAR(10), N' '), CHAR(9), N' ');
WHILE CHARINDEX(N'  ', @norm) > 0
	SET @norm = REPLACE(@norm, N'  ', N' ');
DECLARE @vecchia nvarchar(max) = N'select	q.ORDER_ID,
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
IF @def IS NULL
	PRINT 'COORDINATES_PUSH_MC: la vista non esiste. FERMO per questa vista.';
ELSE IF @norm LIKE N'%left join VICE_JAW j on j.ID = v.JAW_ID%'
	 AND @norm LIKE N'%else pv.STOP_BEYOND_CLAW + pv.CLAW_LENGTH_REF/2 - j.CLAW_LENGTH/2 end as STOP_BEYOND_CLAW) s%'
	 AND @norm LIKE N'%as Z_PUSH_DROP%'
BEGIN
	PRINT 'COORDINATES_PUSH_MC: versione del 7/10. Definizione trovata:';
	SELECT @def AS definizione_trovata;
	EXEC (N'ALTER VIEW dbo.COORDINATES_PUSH_MC AS
' + @vecchia);
	PRINT 'COORDINATES_PUSH_MC: riportata alla versione del 6/10 (quota Z della spinta, senza catalogo).';
END
ELSE IF @norm NOT LIKE N'%VICE_JAW%' AND @norm NOT LIKE N'%CLAW_LENGTH_REF%'
	 AND @norm LIKE N'%when pv.Z_PUSH > pz.Z_PICK then 0 else pz.Z_PICK - pv.Z_PUSH end as Z_PUSH_DROP%'
	PRINT 'COORDINATES_PUSH_MC: gia'' com''era prima del 7/10, nessuna modifica.';
ELSE
BEGIN
	PRINT 'FERMO: COORDINATES_PUSH_MC non e'' nessuna delle versioni note. Nessuna modifica. Definizione trovata:';
	SELECT @def AS definizione_trovata;
END
GO

-- ---------------------------------------------------------------- COORDINATES_BLOW_MC
DECLARE @def NVARCHAR(MAX) = OBJECT_DEFINITION(OBJECT_ID('dbo.COORDINATES_BLOW_MC'));
DECLARE @norm NVARCHAR(MAX) = REPLACE(REPLACE(REPLACE(ISNULL(@def, N''),
	CHAR(13), N' '), CHAR(10), N' '), CHAR(9), N' ');
WHILE CHARINDEX(N'  ', @norm) > 0
	SET @norm = REPLACE(@norm, N'  ', N' ');
DECLARE @vecchia nvarchar(max) = N'select  w.ID                            as ORDER_ID,
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
IF @def IS NULL
	PRINT 'COORDINATES_BLOW_MC: la vista non esiste. FERMO per questa vista.';
ELSE IF @norm LIKE N'%ISNULL(j.CLAW_LENGTH,0) as CLAW_LENGTH%'
	 AND @norm LIKE N'%left join VICE_JAW j on j.ID = v.JAW_ID%'
	 AND @norm LIKE N'%else pv.STOP_BEYOND_CLAW + pv.CLAW_LENGTH_REF/2 - j.CLAW_LENGTH/2 end,0) as STOP_BEYOND_CLAW%'
BEGIN
	PRINT 'COORDINATES_BLOW_MC: versione del 7/10. Definizione trovata:';
	SELECT @def AS definizione_trovata;
	EXEC (N'ALTER VIEW dbo.COORDINATES_BLOW_MC AS
' + @vecchia);
	PRINT 'COORDINATES_BLOW_MC: riportata alla versione del 5/10.';
END
ELSE IF @norm NOT LIKE N'%VICE_JAW%' AND @norm NOT LIKE N'%CLAW_LENGTH_REF%'
	 AND @norm LIKE N'%ISNULL(v.CLAW_LENGTH,0) as CLAW_LENGTH%'
	 AND @norm LIKE N'%ISNULL(pv.STOP_BEYOND_CLAW,0) as STOP_BEYOND_CLAW%'
	PRINT 'COORDINATES_BLOW_MC: gia'' com''era prima del 7/10, nessuna modifica.';
ELSE
BEGIN
	PRINT 'FERMO: COORDINATES_BLOW_MC non e'' nessuna delle versioni note. Nessuna modifica. Definizione trovata:';
	SELECT @def AS definizione_trovata;
END
GO

-- ---------------------------------------------------------------- VICES
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
DECLARE @s nvarchar(max), @i int, @j int, @a nvarchar(max), @o nvarchar(max), @n nvarchar(max);
	SET @s = ISNULL(@def, N'');
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
	SET @a = @s;
	SET @s = @vecchia;
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
	SET @o = @s;
	SET @s = @nuova;
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
	SET @n = @s;

IF @def IS NULL
	PRINT 'VICES: la vista non esiste. FERMO per questa vista.';
ELSE IF @a = @o
	PRINT 'VICES: gia'' com''era prima del 7/10, nessuna modifica.';
ELSE IF @a = @n
BEGIN
	PRINT 'VICES: versione del 7/10. Definizione trovata:';
	SELECT @def AS definizione_trovata;
	EXEC (N'ALTER VIEW dbo.VICES AS ' + @vecchia);
	PRINT 'VICES: riportata a SELECT v.*.';
END
ELSE
BEGIN
	PRINT 'FERMO: VICES non e'' nessuna delle versioni note. Nessuna modifica. Definizione trovata:';
	SELECT @def AS definizione_trovata;
END
GO

PRINT 'VERIFICA: viste che leggono ancora il catalogo (atteso: nessuna riga)';
SELECT name FROM sys.views
 WHERE OBJECT_DEFINITION(object_id) LIKE N'%VICE_JAW%' OR OBJECT_DEFINITION(object_id) LIKE N'%CLAW_LENGTH_REF%'
    OR OBJECT_DEFINITION(object_id) LIKE N'%JAW_ID%';
GO
