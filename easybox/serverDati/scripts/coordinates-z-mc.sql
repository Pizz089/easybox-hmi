-- ===========================================================================
-- coordinates-z-mc.sql - vista COORDINATES_Z_MC: quota Z di DEPOSITO del
-- grezzo e di PRELIEVO del finito in macchina (19/9), versionata il 6/10,
-- CHELE DAL CATALOGO e BLOCCO CHELE il 7/10 (prompt 5 di 5)
--
-- PERCHE'. La vista e' in cella dal 19/9 ma non era nel repo: la definizione
-- stava solo in sys.sql_modules e nei commenti di FB_Robot. La quota Z della
-- spinta (6/10, PIECE_ON_VICE.Z_PUSH) si calcola come DIFFERENZA da
-- Z_PLACE_MC, quindi va versionata. Testo letto sul clone del portatile del
-- 6/10 (backup della cella delle 17:47).
--
-- COLONNE (micron), INVARIATE:
--   ORDER_ID, MC   ordine e macchina (WORKORDER.ID, WORKORDER.MACHINE_ID)
--   Z_PLACE_MC     DEPOSITO DEL GREZZO = POSITION.Z della macchina
--                  + PIECE.Z_PICK + FIXTURE.Z + Z_CLAW - Z_SINK_CLAW
--   Z_PICK_MC      PRELIEVO DEL FINITO: stessa somma con PIECE.Z_PLACE
--   Z_POS, Z_PIECE_RAW (= PIECE.Z_PICK), Z_PIECE_FIN (= PIECE.Z_PLACE),
--   Z_FIXTURE, Z_CLAW, Z_SINK_CLAW: le componenti, per verificare la somma.
-- Il pezzo entra in Z_PLACE_MC con Z_PICK, la quota di presa dal fondo
-- (verificato sulla definizione il 6/10): il TCP del robot sta a Z_PICK sopra
-- il fondo del grezzo, e il fondo appoggia sull'appoggio delle chele.
-- FIXTURE.Z e' pallet + corpo morsa, SENZA chele; l'appoggio delle chele
-- entra qui (Z_CLAW - Z_SINK_CLAW, con ISNULL: il ponte SQL non converte
-- NULL in zero). NB: PIECE.Z_PICK e PIECE.Z_PLACE NON hanno ISNULL: un pezzo
-- senza quota da' NULL. In cella la vista e' cosi' e qui non si cambia.
-- La morsa segue il PALLET (v.PALLET_ID = w.PALLET_ID), come in
-- COORDINATES_PUSH_MC.
--
-- (7/10, prompt 5 di 5) DUE CAMBI, il PLC non cambia:
--   1. le misure della chela vengono dal CATALOGO (VICE_JAW, il tipo montato
--      sulla morsa: VICE.JAW_ID), non piu' dalla riga della morsa. Con la
--      migrazione di vice-jaw.sql il numero e' lo stesso;
--   2. BLOCCO CHELE: la riga di un ordine esce solo se l'ordine non ha chele
--      confermate (WORKORDER.JAW_ID NULL, tutti gli ordini di prima) o se le
--      sue chele sono quelle montate sulla morsa del pallet. Con le chele
--      diverse la vista non da' righe e il PLC si ferma col 799 PRIMA di
--      muovere (Part_Robot_to_MC, stato 30): la scelta delle zero righe come
--      fermo sicuro e' la stessa del join interno su FIXTURE. Serve anche qui
--      e non solo nel pannello perche' il PLC prende gli ordini a STATUS 3:
--      un ordine puo' arrivarci senza passare dalla conferma del pannello.
--
-- GUARDIA: si confronta il CODICE (commenti "--" tolti fino a fine riga,
-- spazi normalizzati, ";" finale tolto, dalla prima "select") con le due
-- versioni note:
--   vista assente            -> la crea nella versione nuova;
--   versione nuova           -> "conforme", nessuna modifica;
--   versione del 6/10        -> stampa la definizione trovata (per il ritorno)
--                               e la porta alla nuova con ALTER;
--   qualunque altra          -> FERMO, non sovrascrive e stampa quella trovata.
-- Lo script resta ASCII.
--
-- ORDINE DI DEPLOY: DOPO vice-jaw.sql (tabella VICE_JAW e colonne JAW_ID).
-- COMANDO (cella, a cella ferma):
--   cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -y 0 -i coordinates-z-mc.sql -o D:\Backup\coordinates-z-mc_esito.txt; Get-Content D:\Backup\coordinates-z-mc_esito.txt
--
-- ROLLBACK: vice-jaw-views-rollback.sql (riporta la versione del 6/10).
-- ===========================================================================
SET NOCOUNT ON;

IF OBJECT_ID('dbo.VICE_JAW') IS NULL
   OR COL_LENGTH('dbo.VICE', 'JAW_ID') IS NULL
   OR COL_LENGTH('dbo.WORKORDER', 'JAW_ID') IS NULL
BEGIN
	PRINT 'MANCANO tabella o colonne: eseguire prima vice-jaw.sql (VICE_JAW, VICE.JAW_ID, WORKORDER.JAW_ID). Nessuna modifica.';
	SET NOEXEC ON;
END
GO

DECLARE @def nvarchar(max) = OBJECT_DEFINITION(OBJECT_ID('dbo.COORDINATES_Z_MC'));

-- la versione del 6/10, com'e' in cella (letta sul clone)
DECLARE @vecchia nvarchar(max) = N'select  w.ID                                    as ORDER_ID,
        w.MACHINE_ID                            as MC,
        p.Z + pz.Z_PICK  + f.Z
            + ISNULL(v.Z_CLAW, 0) - ISNULL(v.Z_SINK_CLAW, 0)   as Z_PLACE_MC,
        p.Z + pz.Z_PLACE + f.Z
            + ISNULL(v.Z_CLAW, 0) - ISNULL(v.Z_SINK_CLAW, 0)   as Z_PICK_MC,
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
left  join VICE v       on v.PALLET_ID = w.PALLET_ID;';

-- la versione del 7/10: misure dal catalogo, blocco chele
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

-- confronto del codice: via i commenti, spazi normalizzati, dalla "select"
DECLARE @a nvarchar(max) = ISNULL(@def, N''), @o nvarchar(max) = @vecchia, @n nvarchar(max) = @nuova, @i int, @j int, @k int;
DECLARE @t TABLE (k int PRIMARY KEY, s nvarchar(max));
INSERT INTO @t VALUES (1, @a), (2, @o), (3, @n);
SET @k = 1;
WHILE @k <= 3
BEGIN
	DECLARE @s nvarchar(max) = (SELECT s FROM @t WHERE k = @k);
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
	UPDATE @t SET s = @s WHERE k = @k;
	SET @k = @k + 1;
END
SELECT @a = s FROM @t WHERE k = 1;
SELECT @o = s FROM @t WHERE k = 2;
SELECT @n = s FROM @t WHERE k = 3;

IF @def IS NULL AND OBJECT_ID('dbo.COORDINATES_Z_MC') IS NULL
BEGIN
	EXEC (N'CREATE VIEW dbo.COORDINATES_Z_MC AS ' + @nuova);
	IF OBJECT_ID('dbo.COORDINATES_Z_MC') IS NULL
		PRINT 'FERMO: CREATE VIEW non riuscita (vedi errore sopra).';
	ELSE
		PRINT 'COORDINATES_Z_MC: vista creata (versione del 7/10).';
END
ELSE IF @a = @n
	PRINT 'COORDINATES_Z_MC: gia'' nella versione del 7/10 (chele dal catalogo, blocco chele), conforme, nessuna modifica.';
ELSE IF @a = @o
BEGIN
	PRINT 'COORDINATES_Z_MC: trovata la versione del 6/10. Definizione trovata, da tenere per il ritorno:';
	SELECT @def AS definizione_trovata;
	EXEC (N'ALTER VIEW dbo.COORDINATES_Z_MC AS ' + @nuova);
	PRINT 'COORDINATES_Z_MC: portata alla versione del 7/10 (chele dal catalogo, blocco chele).';
END
ELSE
BEGIN
	PRINT 'FERMO: COORDINATES_Z_MC esiste ma non e'' nessuna delle versioni note. Nessuna modifica. Definizione trovata:';
	SELECT @def AS definizione_trovata;
END
GO
SET NOEXEC OFF;
GO

-- VERIFICA (sola lettura)
IF OBJECT_ID('dbo.COORDINATES_Z_MC') IS NOT NULL AND OBJECT_ID('dbo.VICE_JAW') IS NOT NULL
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
	PRINT 'VERIFICA 3: ordini con chele confermate DIVERSE da quelle montate, fermati dal blocco chele (righe = ordini che il PLC fermerebbe col 799)';
	SELECT w.ID AS ORDER_ID, w.STATUS, w.JAW_ID AS CHELE_ORDINE, v.JAW_ID AS CHELE_MONTATE, v.ID AS VICE_ID
	  FROM WORKORDER w LEFT JOIN VICE v ON v.PALLET_ID = w.PALLET_ID
	 WHERE w.JAW_ID IS NOT NULL AND (v.JAW_ID IS NULL OR v.JAW_ID <> w.JAW_ID);
	PRINT 'VERIFICA 4: ultimi ordini di MC1';
	SELECT TOP 5 ORDER_ID, MC, Z_PLACE_MC, Z_PICK_MC, Z_POS, Z_PIECE_RAW, Z_PIECE_FIN, Z_FIXTURE, Z_CLAW, Z_SINK_CLAW
	  FROM dbo.COORDINATES_Z_MC WHERE MC = 1 ORDER BY ORDER_ID DESC;
END
