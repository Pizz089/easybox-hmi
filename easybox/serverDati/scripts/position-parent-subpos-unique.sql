-- ===========================================================================
-- position-parent-subpos-unique.sql — vincolo UNIQUE (PARENT, SUB_POS) su
-- [POSITION] (dup-guard 4/9): impedisce ALLA RADICE il ripetersi delle righe
-- duplicate (93 righe per 91 tasche sul TRAY_12, salvataggi sovrapposti).
--
-- *** ESEGUIRE SOLO A CELLA FERMA ***
-- La CREATE INDEX prende un lock sulla tabella: se una scrittura del PLC e'
-- in volo puo' fallire o bloccarla. Verificato il 4/9 che (PARENT, SUB_POS)
-- e' unico su TUTTA la tabella (312 righe: TRAY_*, WPALLET, SHELF).
--
-- IDEMPOTENTE: riesegui quando vuoi. Se trova duplicati NON crea l'indice e
-- li elenca: bonificare prima (CTE ROW_NUMBER qui sotto) e rieseguire.
--
-- IN CELLA (login plc senza ALTER — manuale, regola APPUNTI-CELLA):
--   sqlcmd -S .\SQLEXPRESS -E -d ADMG -i position-parent-subpos-unique.sql
-- ===========================================================================
SET NOCOUNT ON;

IF EXISTS (SELECT 1 FROM dbo.[POSITION] GROUP BY PARENT, SUB_POS HAVING COUNT(*) > 1)
BEGIN
	PRINT 'DUPLICATI PRESENTI: indice NON creato. Bonificare e rieseguire.';
	SELECT PARENT, SUB_POS, COUNT(*) AS n
	FROM dbo.[POSITION] GROUP BY PARENT, SUB_POS HAVING COUNT(*) > 1;
	-- bonifica (adattare il PARENT, tiene la riga con ID minore):
	-- WITH d AS (SELECT ID, ROW_NUMBER() OVER (PARTITION BY PARENT, SUB_POS ORDER BY ID) AS rn
	--            FROM dbo.[POSITION])
	-- DELETE FROM dbo.[POSITION] WHERE ID IN (SELECT ID FROM d WHERE rn > 1);
END
ELSE IF NOT EXISTS (SELECT 1 FROM sys.indexes
					WHERE name = 'UX_POSITION_PARENT_SUBPOS'
					  AND object_id = OBJECT_ID('dbo.POSITION'))
BEGIN
	CREATE UNIQUE INDEX UX_POSITION_PARENT_SUBPOS ON dbo.[POSITION](PARENT, SUB_POS);
	PRINT 'UX_POSITION_PARENT_SUBPOS creato.';
END
ELSE
	PRINT 'UX_POSITION_PARENT_SUBPOS gia'' presente: niente da fare.';

-- ===========================================================================
-- ROLLBACK (manuale, solo per tornare indietro):
-- DROP INDEX UX_POSITION_PARENT_SUBPOS ON dbo.[POSITION];
-- ===========================================================================
