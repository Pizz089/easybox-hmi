-- ===========================================================================
-- coordinates-pickplace-mc.sql - vista COORDINATES_PICKPLACE_MC (missione 16,
-- il ciclo di produzione: prelievo del finito e deposito del grezzo in MC1),
-- versionata l'8/10 (prompt 8)
--
-- PERCHE'. Il PLC ne legge Z_PICK_MC e Z_PLACE_MC (FB_Robot, missione 16 e
-- prelievo/deposito manuale) ma la definizione non era nel repo: il prompt 5
-- del catalogo delle chele non la nominava. Dai controlli di cella dell'8/10
-- (controlli-audit-8-10.sql) legge le quote Z da COORDINATES_Z_MC: col
-- catalogo delle chele cambia solo quella vista (coordinates-z-mc.sql), e
-- questa no. Lo script serve a VERSIONARLA e a dire che in cella e' quella.
--
-- COLONNE: ORDER_ID, X, Y (della posizione MC_1), Z_PICK_MC (prelievo del
-- FINITO), Z_PLACE_MC (deposito del GREZZO), X_ROT, Y_ROT, Z_ROT,
-- APPROACH_TYPE, APPROACH_X, APPROACH_Y, APPROACH_Z.
-- NB: la posizione e' sempre 'MC_1' (non la macchina dell'ordine) e la vista
-- non filtra gli ordini: un ordine per riga, tutti gli ordini con una riga in
-- COORDINATES_Z_MC. In cella e' cosi' e qui non si cambia.
--
-- GUARDIA: si confronta il CODICE (commenti "--" tolti, TUTTI gli spazi
-- tolti, minuscole, dalla prima "select", ";" finale tolto). In cella il
-- commento iniziale ha caratteri non ASCII, per questo i commenti non
-- contano:
--   versione nota (questa)   -> "conforme", nessuna modifica;
--   vista assente            -> la crea (un database nuovo);
--   qualunque altra          -> FERMO, non sovrascrive e stampa quella trovata.
-- Non c'e' un ramo ALTER: non si conosce un'altra versione da portare qui.
-- Lo script resta ASCII.
--
-- COMANDO (cella; sola lettura se e' conforme):
--   cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -y 0 -i coordinates-pickplace-mc.sql -o D:\Backup\coordinates-pickplace-mc_esito.txt; Get-Content D:\Backup\coordinates-pickplace-mc_esito.txt
-- ===========================================================================
SET NOCOUNT ON;

DECLARE @def nvarchar(max) = OBJECT_DEFINITION(OBJECT_ID('dbo.COORDINATES_PICKPLACE_MC'));

-- la versione di cella (letta l'8/10 dai controlli di cella e dal clone del
-- 6/10: stesso codice, il commento di cella qui e' riscritto in ASCII)
DECLARE @nota nvarchar(max) = N'select  w.ID                as ORDER_ID,
        p.X,
        p.Y,
        -- LE QUOTE Z VENGONO DA COORDINATES_Z_MC (19/9): il calcolo era
        -- scritto a mano qui e in altri due punti del PLC, e la geometria
        -- delle ganasce era inglobata in FIXTURE.Z: cambiando le chele il
        -- pezzo finiva alla quota delle vecchie. Adesso FIXTURE.Z e pallet
        -- piu corpo morsa senza chele e il calcolo sta in un posto solo.
        z.Z_PICK_MC,        -- prelievo del FINITO
        z.Z_PLACE_MC,       -- deposito del GREZZO
        p.X_ROT,
        p.Y_ROT,
        p.Z_ROT,
        p.APPROACH_TYPE,
        p.APPROACH_X,
        p.APPROACH_Y,
        p.APPROACH_Z
from WORKORDER w
inner join [POSITION] p       on p.PARENT = ''MC_1''
inner join COORDINATES_Z_MC z on z.ORDER_ID = w.ID;';

-- confronto del codice: via i commenti, via tutti gli spazi, minuscole
DECLARE @t TABLE (k int PRIMARY KEY, s nvarchar(max));
INSERT INTO @t VALUES (1, ISNULL(@def, N'')), (2, @nota);
DECLARE @k int = 1, @i int, @j int, @s nvarchar(max);
WHILE @k <= 2
BEGIN
	SET @s = (SELECT s FROM @t WHERE k = @k);
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
	UPDATE @t SET s = @s WHERE k = @k;
	SET @k = @k + 1;
END

IF @def IS NULL AND OBJECT_ID('dbo.COORDINATES_PICKPLACE_MC') IS NULL
BEGIN
	IF OBJECT_ID('dbo.COORDINATES_Z_MC') IS NULL
		PRINT 'FERMO: COORDINATES_PICKPLACE_MC non c''e'' e nemmeno COORDINATES_Z_MC, che legge: eseguire prima coordinates-z-mc.sql.';
	ELSE BEGIN
		EXEC (N'CREATE VIEW dbo.COORDINATES_PICKPLACE_MC AS ' + @nota);
		IF OBJECT_ID('dbo.COORDINATES_PICKPLACE_MC') IS NULL
			PRINT 'FERMO: CREATE VIEW non riuscita (vedi errore sopra).';
		ELSE
			PRINT 'COORDINATES_PICKPLACE_MC: vista creata (la versione di cella).';
	END
END
ELSE IF (SELECT s FROM @t WHERE k = 1) = (SELECT s FROM @t WHERE k = 2)
	PRINT 'COORDINATES_PICKPLACE_MC: conforme (la versione di cella, legge le quote Z da COORDINATES_Z_MC), nessuna modifica.';
ELSE
BEGIN
	PRINT 'FERMO: COORDINATES_PICKPLACE_MC esiste ma non e'' la versione nota. Nessuna modifica. Definizione trovata (da riconciliare con questo script):';
	SELECT @def AS definizione_trovata;
END
GO

-- VERIFICA (sola lettura)
IF OBJECT_ID('dbo.COORDINATES_PICKPLACE_MC') IS NOT NULL AND OBJECT_ID('dbo.COORDINATES_Z_MC') IS NOT NULL
BEGIN
	PRINT 'VERIFICA 1: le quote Z sono quelle di COORDINATES_Z_MC (atteso: nessuna riga)';
	SELECT pp.ORDER_ID, pp.Z_PICK_MC, z.Z_PICK_MC AS Z_PICK_MC_Z, pp.Z_PLACE_MC, z.Z_PLACE_MC AS Z_PLACE_MC_Z
	  FROM dbo.COORDINATES_PICKPLACE_MC pp JOIN dbo.COORDINATES_Z_MC z ON z.ORDER_ID = pp.ORDER_ID
	 WHERE ISNULL(pp.Z_PICK_MC, -1) <> ISNULL(z.Z_PICK_MC, -1) OR ISNULL(pp.Z_PLACE_MC, -1) <> ISNULL(z.Z_PLACE_MC, -1);
	PRINT 'VERIFICA 2: righe per ordine (atteso: 1 per ogni ordine, con una sola posizione MC_1)';
	SELECT ORDER_ID, COUNT(*) AS righe FROM dbo.COORDINATES_PICKPLACE_MC GROUP BY ORDER_ID HAVING COUNT(*) <> 1;
END
GO
