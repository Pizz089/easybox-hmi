-- =====================================================================
-- warehouse-positions.sql — setup posizioni magazzini (cantiere AD)
-- IDEMPOTENTE: crea SOLO le righe [POSITION] mancanti dei due magazzini
-- fisici — WPALLET 1..20 (magazzino pallet, 5 file x 4) e SHELF 1..4
-- (scaffale pinze). Le righe gia' presenti NON vengono toccate (in cella
-- esistono gia' con le quote vere del teaching).
--
-- Le righe NUOVE nascono con STATUS=2 (abilitata) e QUOTE A ZERO: il
-- teaching delle coordinate e' compito dell'impianto, questo script
-- censisce solo le posizioni per i flag di abilitazione (STATUS 9 =
-- disabilitata, qualunque altro valore = abilitata).
--
-- ESECUZIONE MANUALE (regola d'impianto: mai DDL/seed dal boot del
-- backend — ensureSchema puo' fallire in silenzio per permessi):
--   sqlcmd -S <server> -U plc -P plc -d ADMG -i warehouse-positions.sql
--
-- NB: la pulizia dei residui dev (WPALLET SUB_POS 3333/4444/5555/6666,
-- vecchio cantiere) NON sta in questo script: e' un'operazione una-tantum
-- SOLO DEV, documentata nel report del commit chore(warehouse-dev-cleanup).
-- =====================================================================
SET NOCOUNT ON;

DECLARE @n int;

-- WPALLET 1..20
SET @n = 1;
WHILE @n <= 20
BEGIN
    IF NOT EXISTS (SELECT 1 FROM [POSITION] WHERE PARENT LIKE 'WPALLET%' AND SUB_POS = @n)
        INSERT INTO [POSITION] (PARENT, POS, SUB_POS, STATUS, X, Y, Z, X_ROT, Y_ROT, Z_ROT)
        VALUES ('WPALLET', 1, @n, 2, 0, 0, 0, 0, 0, 0);
    SET @n = @n + 1;
END

-- SHELF 1..4
SET @n = 1;
WHILE @n <= 4
BEGIN
    IF NOT EXISTS (SELECT 1 FROM [POSITION] WHERE PARENT LIKE 'SHELF%' AND SUB_POS = @n)
        INSERT INTO [POSITION] (PARENT, POS, SUB_POS, STATUS, X, Y, Z, X_ROT, Y_ROT, Z_ROT)
        VALUES ('SHELF', 1, @n, 2, 0, 0, 0, 0, 0, 0);
    SET @n = @n + 1;
END

-- riepilogo
SELECT RTRIM(PARENT) AS PARENT, COUNT(*) AS N, MIN(SUB_POS) AS MIN_SUB, MAX(SUB_POS) AS MAX_SUB
FROM [POSITION]
WHERE PARENT LIKE 'WPALLET%' OR PARENT LIKE 'SHELF%'
GROUP BY PARENT;
