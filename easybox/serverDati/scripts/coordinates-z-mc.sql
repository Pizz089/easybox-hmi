-- ===========================================================================
-- coordinates-z-mc.sql - vista COORDINATES_Z_MC: quota Z di DEPOSITO del
-- grezzo e di PRELIEVO del finito in macchina (19/9), versionata il 6/10,
-- CHELE DAL CATALOGO il 7/10 (prompt 5 di 5), blocco chele TOLTO l'8/10
-- (prompt 8)
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
-- LA LEGGE ANCHE COORDINATES_PICKPLACE_MC (missione 16, il ciclo di
-- produzione: Z_PICK_MC e Z_PLACE_MC), versionata in
-- coordinates-pickplace-mc.sql. Stesse colonne, stessi nomi: quella vista non
-- si tocca.
--
-- (7/10, prompt 5 di 5) le misure della chela vengono dal CATALOGO
-- (VICE_JAW, il tipo montato sulla morsa: VICE.JAW_ID), non piu' dalla riga
-- della morsa. Con la migrazione di vice-jaw.sql il numero e' lo stesso.
-- Il PLC non cambia.
--
-- (8/10, prompt 8) IL BLOCCO CHELE NON STA PIU' QUI. Il 7/10 la vista
-- nascondeva la riga di un ordine con le chele diverse da quelle montate,
-- per fermare il PLC col 799. Ma tre punti del PLC prendono "l'ordine piu'
-- recente" dalla vista invece di filtrare per ORDER_ID (prelievo del finito
-- dal pannello con OrderIdMC = 0, soffiaggio, e la missione 16 tramite
-- COORDINATES_PICKPLACE_MC): con la riga nascosta il robot avrebbe preso le
-- quote di un ordine PRECEDENTE, cioe' di un altro pezzo, invece di fermarsi.
-- La vista torna a dare solo dati; il controllo delle chele lo fa il backend
-- quando un ordine passa a STATUS 3 (Play e rilancio: KO_ORDER_JAW_MISMATCH,
-- KO_ORDER_VICE_NO_JAW). Rimetterlo nel PLC si potra' solo dopo aver
-- cambiato quelle tre query (LAVORI-IN-CODA).
--
-- GUARDIA: si confronta il CODICE (commenti "--" tolti fino a fine riga,
-- spazi normalizzati, ";" finale tolto, dalla prima "select") con le versioni
-- note:
--   vista assente            -> la crea nella versione dell'8/10;
--   versione dell'8/10       -> "conforme", nessuna modifica;
--   versione del 6/10 o del 7/10 (col blocco, mai andata in cella)
--                            -> stampa la definizione trovata (per il
--                               ritorno) e la porta all'8/10 con ALTER;
--   qualunque altra          -> FERMO, non sovrascrive e stampa quella trovata.
-- (8/10) Prima di creare o cambiare: FERMO se la migrazione non e' avvenuta
-- (una morsa con misure senza tipo montato): la vista nuova darebbe le quote
-- senza l'appoggio delle chele. E DOPO l'ALTER la definizione si rilegge:
-- se non e' quella attesa, FERMO.
-- Lo script resta ASCII.
--
-- ORDINE DI DEPLOY: DOPO vice-jaw.sql (tabella VICE_JAW e colonne JAW_ID).
-- COMANDO (cella, a cella ferma):
--   cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -y 0 -i coordinates-z-mc.sql -o D:\Backup\coordinates-z-mc_esito.txt; Get-Content D:\Backup\coordinates-z-mc_esito.txt
--
-- RITORNO: vice-jaw-rollback.sql (riporta la versione del 6/10).
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

-- il CODICE di una definizione: commenti "--" tolti, spazi normalizzati, ";"
-- finale tolto, dalla prima "select"
IF OBJECT_ID('tempdb..#codice_vista') IS NOT NULL DROP PROCEDURE #codice_vista;
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

-- la versione del 7/10, col blocco chele: nel repo, mai andata in cella
DECLARE @intermedia nvarchar(max) = N'select  w.ID as ORDER_ID, w.MACHINE_ID as MC,
        p.Z + pz.Z_PICK  + f.Z + ISNULL(j.Z_CLAW, 0) - ISNULL(j.Z_SINK_CLAW, 0) as Z_PLACE_MC,
        p.Z + pz.Z_PLACE + f.Z + ISNULL(j.Z_CLAW, 0) - ISNULL(j.Z_SINK_CLAW, 0) as Z_PICK_MC,
        p.Z as Z_POS, pz.Z_PICK as Z_PIECE_RAW, pz.Z_PLACE as Z_PIECE_FIN, f.Z as Z_FIXTURE,
        ISNULL(j.Z_CLAW, 0) as Z_CLAW, ISNULL(j.Z_SINK_CLAW, 0) as Z_SINK_CLAW
from WORKORDER w
inner join [POSITION] p on RTRIM(p.PARENT) = CONCAT(''MC_'', w.MACHINE_ID)
inner join PIECE pz on pz.ID = w.PIECE_ID
inner join FIXTURE f on f.ID = w.FIXTURE_ID
left join VICE v on v.PALLET_ID = w.PALLET_ID
left join VICE_JAW j on j.ID = v.JAW_ID
where w.JAW_ID is null or w.JAW_ID = v.JAW_ID;';

-- la versione dell'8/10: misure dal catalogo, nessun blocco
DECLARE @nuova nvarchar(max) = N'select  w.ID                                    as ORDER_ID,
        w.MACHINE_ID                            as MC,
        -- QUOTA DI DEPOSITO DEL GREZZO e DI PRELIEVO DEL FINITO (19/9).
        -- FIXTURE.Z e il pallet piu il CORPO morsa, senza chele; l appoggio
        -- delle chele entra qui: Z_CLAW - Z_SINK_CLAW e la quota a cui il
        -- pezzo appoggia sopra il riferimento fixture.
        -- (7/10) le misure vengono dal CATALOGO delle chele (VICE_JAW), il tipo
        -- montato sulla morsa del pallet (VICE.JAW_ID): dato unico.
        -- (8/10) nessun filtro sulle chele: la vista da solo dati (il PLC in
        -- tre punti prende l ordine piu recente; il controllo delle chele lo
        -- fa il backend al passaggio a STATUS 3).
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
left  join VICE_JAW j   on j.ID = v.JAW_ID;';

DECLARE @a nvarchar(max), @o nvarchar(max), @m nvarchar(max), @n nvarchar(max);
EXEC #codice_vista @def, @a OUTPUT;
EXEC #codice_vista @vecchia, @o OUTPUT;
EXEC #codice_vista @intermedia, @m OUTPUT;
EXEC #codice_vista @nuova, @n OUTPUT;
-- il codice atteso, per rileggere la vista dopo l'ALTER (batch dopo)
IF OBJECT_ID('tempdb..#attesa') IS NOT NULL DROP TABLE #attesa;
CREATE TABLE #attesa (s nvarchar(max));
INSERT INTO #attesa VALUES (@n);

-- la migrazione e' avvenuta? (una morsa con misure deve avere un tipo)
DECLARE @migrata bit = CASE WHEN EXISTS (SELECT 1 FROM dbo.VICE WHERE JAW_ID IS NULL
	AND (CLAW_LENGTH IS NOT NULL OR Z_CLAW IS NOT NULL OR Z_SINK_CLAW IS NOT NULL)) THEN 0 ELSE 1 END;

IF @def IS NULL AND OBJECT_ID('dbo.COORDINATES_Z_MC') IS NULL
BEGIN
	IF @migrata = 0
		PRINT 'FERMO: la migrazione di vice-jaw.sql non e'' avvenuta (morse con misure senza tipo montato). Vista NON creata: rileggere l''esito di vice-jaw.sql.';
	ELSE BEGIN
		EXEC (N'CREATE VIEW dbo.COORDINATES_Z_MC AS ' + @nuova);
		PRINT 'COORDINATES_Z_MC: vista creata (versione dell''8/10).';
	END
END
ELSE IF @a = @n
	PRINT 'COORDINATES_Z_MC: gia'' nella versione dell''8/10 (chele dal catalogo, nessun blocco), conforme, nessuna modifica.';
ELSE IF @a = @o OR @a = @m
BEGIN
	PRINT 'COORDINATES_Z_MC: trovata la versione del ' + CASE WHEN @a = @o THEN '6/10' ELSE '7/10 (col blocco chele)' END + '. Definizione trovata, da tenere per il ritorno:';
	SELECT @def AS definizione_trovata;
	IF @migrata = 0
		PRINT 'FERMO: la migrazione di vice-jaw.sql non e'' avvenuta (morse con misure senza tipo montato). Nessuna modifica: rileggere l''esito di vice-jaw.sql.';
	ELSE
		EXEC (N'ALTER VIEW dbo.COORDINATES_Z_MC AS ' + @nuova);
END
ELSE
BEGIN
	PRINT 'FERMO: COORDINATES_Z_MC esiste ma non e'' nessuna delle versioni note. Nessuna modifica. Definizione trovata:';
	SELECT @def AS definizione_trovata;
END
GO
SET NOEXEC OFF;
GO

-- (8/10) la definizione si RILEGGE: "portata" si dice solo se e' quella attesa
IF OBJECT_ID('tempdb..#attesa') IS NOT NULL AND OBJECT_ID('dbo.COORDINATES_Z_MC') IS NOT NULL
BEGIN
	DECLARE @dopo nvarchar(max), @attesa nvarchar(max) = (SELECT s FROM #attesa);
	DECLARE @letta nvarchar(max) = OBJECT_DEFINITION(OBJECT_ID('dbo.COORDINATES_Z_MC'));
	EXEC #codice_vista @letta, @dopo OUTPUT;
	IF @dopo = @attesa
		PRINT 'COORDINATES_Z_MC: riletta, e'' la versione dell''8/10 (chele dal catalogo, nessun blocco).';
	ELSE
		PRINT 'FERMO: COORDINATES_Z_MC riletta NON e'' la versione dell''8/10 (vedi sopra). Non riprendere la produzione.';
	DROP TABLE #attesa;
END
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
	PRINT 'VERIFICA 3: ogni ordine con posizione e attrezzatura ha la sua riga (atteso: nessuna riga; la vista non nasconde piu'' niente)';
	SELECT w.ID AS ORDER_ID FROM WORKORDER w
	  JOIN [POSITION] p ON RTRIM(p.PARENT) = CONCAT('MC_', w.MACHINE_ID)
	  JOIN PIECE pz ON pz.ID = w.PIECE_ID
	  JOIN FIXTURE f ON f.ID = w.FIXTURE_ID
	 WHERE NOT EXISTS (SELECT 1 FROM dbo.COORDINATES_Z_MC z WHERE z.ORDER_ID = w.ID);
	PRINT 'VERIFICA 4: ultimi ordini di MC1';
	SELECT TOP 5 ORDER_ID, MC, Z_PLACE_MC, Z_PICK_MC, Z_POS, Z_PIECE_RAW, Z_PIECE_FIN, Z_FIXTURE, Z_CLAW, Z_SINK_CLAW
	  FROM dbo.COORDINATES_Z_MC WHERE MC = 1 ORDER BY ORDER_ID DESC;
END
