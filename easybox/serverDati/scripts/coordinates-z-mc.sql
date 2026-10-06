-- ===========================================================================
-- coordinates-z-mc.sql - vista COORDINATES_Z_MC: quota Z di DEPOSITO del
-- grezzo e di PRELIEVO del finito in macchina (19/9), versionata il 6/10
--
-- PERCHE'. La vista e' in cella dal 19/9 ma non era nel repo: la definizione
-- stava solo in sys.sql_modules e nei commenti di FB_Robot. La quota Z della
-- spinta (6/10, PIECE_ON_VICE.Z_PUSH) si calcola come DIFFERENZA da
-- Z_PLACE_MC, quindi va versionata. Testo letto sul clone del portatile del
-- 6/10 (backup della cella delle 17:47): IN CELLA QUESTO SCRIPT E' UN NO-OP
-- ("conforme").
--
-- COLONNE (micron):
--   ORDER_ID, MC   ordine e macchina (WORKORDER.ID, WORKORDER.MACHINE_ID)
--   Z_PLACE_MC     DEPOSITO DEL GREZZO = POSITION.Z della macchina
--                  + PIECE.Z_PICK + FIXTURE.Z + VICE.Z_CLAW - VICE.Z_SINK_CLAW
--   Z_PICK_MC      PRELIEVO DEL FINITO: stessa somma con PIECE.Z_PLACE
--   Z_POS, Z_PIECE_RAW (= PIECE.Z_PICK), Z_PIECE_FIN (= PIECE.Z_PLACE),
--   Z_FIXTURE, Z_CLAW, Z_SINK_CLAW: le componenti, per verificare la somma.
-- Il pezzo entra in Z_PLACE_MC con Z_PICK, la quota di presa dal fondo
-- (verificato sulla definizione il 6/10): il TCP del robot sta a Z_PICK sopra
-- il fondo del grezzo, e il fondo appoggia sull'appoggio delle ganasce.
-- FIXTURE.Z e' pallet + corpo morsa, SENZA chele; l'appoggio delle ganasce
-- entra qui (Z_CLAW - Z_SINK_CLAW, con ISNULL: il ponte SQL non converte
-- NULL in zero). NB: PIECE.Z_PICK e PIECE.Z_PLACE NON hanno ISNULL: un pezzo
-- senza quota da' NULL. In cella la vista e' cosi' e qui non si cambia.
-- La morsa segue il PALLET (v.PALLET_ID = w.PALLET_ID), come in
-- COORDINATES_PUSH_MC.
--
-- GUARDIA: vista assente -> la crea; uguale -> "conforme", nessuna modifica;
-- diversa -> FERMO, non sovrascrive e stampa quella trovata. Si confronta il
-- CODICE: commenti "--" tolti fino a fine riga, spazi normalizzati, ";"
-- finale tolto, dalla prima "select". I commenti non contano perche' quelli
-- della vista in cella hanno trattini lunghi (non ASCII), qui riscritti con
-- "-": lo script resta ASCII.
--
-- COMANDO (cella), sola lettura se la vista e' gia' quella:
--   cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -i coordinates-z-mc.sql
--
-- ROLLBACK: nessuno (lo script non cambia una vista esistente).
-- ===========================================================================
SET NOCOUNT ON;

DECLARE @def nvarchar(max) = OBJECT_DEFINITION(OBJECT_ID('dbo.COORDINATES_Z_MC'));
DECLARE @v nvarchar(max) = N'select  w.ID                                    as ORDER_ID,
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

-- confronto del codice: via i commenti, spazi normalizzati, dalla "select"
DECLARE @a nvarchar(max) = ISNULL(@def, N''), @b nvarchar(max) = @v, @i int, @j int;
WHILE CHARINDEX(N'--', @a) > 0
BEGIN
	SET @i = CHARINDEX(N'--', @a);
	SET @j = CHARINDEX(CHAR(10), @a, @i);
	IF @j = 0 SET @j = LEN(@a) + 1;
	SET @a = STUFF(@a, @i, @j - @i, N'');
END
WHILE CHARINDEX(N'--', @b) > 0
BEGIN
	SET @i = CHARINDEX(N'--', @b);
	SET @j = CHARINDEX(CHAR(10), @b, @i);
	IF @j = 0 SET @j = LEN(@b) + 1;
	SET @b = STUFF(@b, @i, @j - @i, N'');
END
SET @a = REPLACE(REPLACE(REPLACE(@a, CHAR(13), N' '), CHAR(10), N' '), CHAR(9), N' ');
SET @b = REPLACE(REPLACE(REPLACE(@b, CHAR(13), N' '), CHAR(10), N' '), CHAR(9), N' ');
WHILE CHARINDEX(N'  ', @a) > 0 SET @a = REPLACE(@a, N'  ', N' ');
WHILE CHARINDEX(N'  ', @b) > 0 SET @b = REPLACE(@b, N'  ', N' ');
SET @a = LTRIM(RTRIM(@a));
SET @b = LTRIM(RTRIM(@b));
IF RIGHT(@a, 1) = N';' SET @a = RTRIM(LEFT(@a, LEN(@a) - 1));
IF RIGHT(@b, 1) = N';' SET @b = RTRIM(LEFT(@b, LEN(@b) - 1));
IF CHARINDEX(N'select ', @a) > 0 SET @a = SUBSTRING(@a, CHARINDEX(N'select ', @a), LEN(@a));
IF CHARINDEX(N'select ', @b) > 0 SET @b = SUBSTRING(@b, CHARINDEX(N'select ', @b), LEN(@b));

IF @def IS NULL AND OBJECT_ID('dbo.COORDINATES_Z_MC') IS NULL
BEGIN
	EXEC (N'CREATE VIEW dbo.COORDINATES_Z_MC AS ' + @v);
	IF OBJECT_ID('dbo.COORDINATES_Z_MC') IS NULL
		PRINT 'FERMO: CREATE VIEW non riuscita (vedi errore sopra).';
	ELSE
		PRINT 'COORDINATES_Z_MC: vista creata.';
END
ELSE IF @a = @b
	PRINT 'COORDINATES_Z_MC: gia'' presente e conforme, nessuna modifica.';
ELSE
BEGIN
	PRINT 'FERMO: COORDINATES_Z_MC esiste ma non e'' quella attesa. Nessuna modifica. Definizione trovata:';
	SELECT @def AS definizione_trovata;
END

-- VERIFICA (sola lettura)
IF OBJECT_ID('dbo.COORDINATES_Z_MC') IS NOT NULL
BEGIN
	PRINT 'VERIFICA 1: Z_PLACE_MC e Z_PICK_MC sono la somma delle componenti (atteso: nessuna riga)';
	SELECT ORDER_ID, Z_PLACE_MC, Z_PICK_MC FROM dbo.COORDINATES_Z_MC
	 WHERE Z_PLACE_MC <> Z_POS + Z_PIECE_RAW + Z_FIXTURE + Z_CLAW - Z_SINK_CLAW
	    OR Z_PICK_MC  <> Z_POS + Z_PIECE_FIN + Z_FIXTURE + Z_CLAW - Z_SINK_CLAW;
	PRINT 'VERIFICA 2: nel deposito del grezzo il pezzo entra con PIECE.Z_PICK (atteso: nessuna riga)';
	SELECT z.ORDER_ID, z.Z_PIECE_RAW, pz.Z_PICK FROM dbo.COORDINATES_Z_MC z
	  JOIN WORKORDER w ON w.ID = z.ORDER_ID
	  JOIN PIECE pz ON pz.ID = w.PIECE_ID
	 WHERE z.Z_PIECE_RAW <> pz.Z_PICK;
	PRINT 'VERIFICA 3: ultimi ordini di MC1';
	SELECT TOP 5 ORDER_ID, MC, Z_PLACE_MC, Z_PICK_MC, Z_POS, Z_PIECE_RAW, Z_PIECE_FIN, Z_FIXTURE, Z_CLAW, Z_SINK_CLAW
	  FROM dbo.COORDINATES_Z_MC WHERE MC = 1 ORDER BY ORDER_ID DESC;
END
