-- ===========================================================================
-- fixture-on-pallet-unique.sql — UNIQUE (PALLET_ID, FIXTURE_ID) su
-- FIXTURE_ON_PALLET (cantiere rig-two-aspects, 15/9)
--
-- PERCHE': la tabella non ha ne' chiave primaria ne' indice unico ne' chiave
-- esterna (in tutto il DB ci sono 2 sole foreign key). Niente impedisce due
-- righe identiche per la stessa coppia pallet-attrezzatura: la geometria del
-- pallet diventerebbe ambigua e la vista FIXTURES restituirebbe la stessa
-- attrezzatura due volte (unisce FIXTURE_ON_PALLET senza filtrare il pallet).
--
-- NON aggiunge la foreign key verso FIXTURE: oggi in cella fallirebbe per la
-- riga orfana (PALLET_ID 1, FIXTURE_ID 2, con l'attrezzatura 2 inesistente) e
-- non si bonificano dati mentre si produce. Rimandata a impianto stabile.
--
-- *** ESEGUIRE A CELLA FERMA ***
-- La CREATE INDEX prende un lock sulla tabella.
--
-- IDEMPOTENTE: se trova duplicati NON crea l'indice e li elenca (bonificare
-- prima, CTE commentata qui sotto); se l'indice c'e' gia', non fa nulla.
--
-- IN CELLA (login plc senza ALTER — manuale, regola APPUNTI-CELLA):
--   sqlcmd -S .\SQLEXPRESS -E -d ADMG -i fixture-on-pallet-unique.sql
-- ===========================================================================
SET NOCOUNT ON;

IF EXISTS (SELECT 1 FROM dbo.FIXTURE_ON_PALLET GROUP BY PALLET_ID, FIXTURE_ID HAVING COUNT(*) > 1)
BEGIN
	PRINT 'DUPLICATI PRESENTI: indice NON creato. Bonificare e rieseguire.';
	SELECT PALLET_ID, FIXTURE_ID, COUNT(*) AS n
	FROM dbo.FIXTURE_ON_PALLET GROUP BY PALLET_ID, FIXTURE_ID HAVING COUNT(*) > 1;
	-- bonifica (tiene una sola riga per coppia; la tabella non ha una chiave
	-- tecnica, quindi si passa da una tabella temporanea):
	-- SELECT DISTINCT * INTO #fop FROM dbo.FIXTURE_ON_PALLET;
	-- DELETE FROM dbo.FIXTURE_ON_PALLET;
	-- INSERT INTO dbo.FIXTURE_ON_PALLET SELECT * FROM #fop;
	-- DROP TABLE #fop;
END
ELSE IF NOT EXISTS (SELECT 1 FROM sys.indexes
					WHERE name = 'UX_FOP_PALLET_FIXTURE'
					  AND object_id = OBJECT_ID('dbo.FIXTURE_ON_PALLET'))
BEGIN
	CREATE UNIQUE INDEX UX_FOP_PALLET_FIXTURE ON dbo.FIXTURE_ON_PALLET(PALLET_ID, FIXTURE_ID);
	PRINT 'UX_FOP_PALLET_FIXTURE creato.';
END
ELSE
	PRINT 'UX_FOP_PALLET_FIXTURE gia'' presente: niente da fare.';

-- verifica: EXEC sp_helpindex 'dbo.FIXTURE_ON_PALLET';
-- righe orfane (informativo, nessuna azione qui):
-- SELECT fop.PALLET_ID, fop.FIXTURE_ID FROM dbo.FIXTURE_ON_PALLET fop
--   LEFT JOIN dbo.FIXTURE f ON f.ID = fop.FIXTURE_ID WHERE f.ID IS NULL;

-- ===========================================================================
-- ROLLBACK (manuale):
-- DROP INDEX UX_FOP_PALLET_FIXTURE ON dbo.FIXTURE_ON_PALLET;
-- ===========================================================================
