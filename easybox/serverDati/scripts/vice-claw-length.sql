-- ===========================================================================
-- vice-claw-length.sql — colonna VICE.CLAW_LENGTH (ciclo di SPINTA IN
-- BATTUTA, cantiere push-to-stop 15/9)
--
-- SCOPO: LUNGHEZZA della ganascia della morsa nella direzione in cui il pezzo
-- SCORRE FINO ALLA BATTUTA, in MICRON. E' una dimensione FISICA, si misura
-- col calibro: da questa e dalle dimensioni del pezzo il sistema ricava tutte
-- le quote, l'operatore non inserisce nessuna coordinata.
--
-- GEOMETRIA (chiarita da Dario 15/9): le ganasce della morsa si aprono lungo
-- la Y del robot, cioe' stringono DI TRAVERSO rispetto alla spinta; la
-- ganascia e' quindi lunga lungo la X del robot e CONTIENE il pezzo nella
-- direzione in cui scorre. La battuta e' il fermo all'estremita' della
-- ganascia. Spazio verso la battuta = (ganascia - pezzo) / 2, con il deposito
-- centrato sulla morsa.
--
-- NB: VICE.X e VICE.Y esistono gia' ma sono l'INGOMBRO della morsa (nessuno
-- li legge, la vista macchina non li usa). Riusarli significherebbe dare due
-- significati alla stessa colonna: e' l'errore che ha gia' morso su TRAY.X e
-- su GRIPPER.X_BODY. Colonna dedicata, e chiamata per quello che e' (la
-- lunghezza della ganascia) e non per un asse.
--
-- NULL = non misurata: il ciclo di spinta NON si abilita e l'ordine viene
-- rifiutato con KO_PUSH_NO_DATA. Le morse esistenti restano com'erano.
--
-- IDEMPOTENTE. Gestisce anche la RINOMINA da CLAW_LENGTH_Y, nome della prima
-- stesura (asse sbagliato: le quote erano sulla Y, la battuta e' sulla X).
-- ORDINE DI DEPLOY: PRIMA del backend.
--
-- IN CELLA (login plc senza ALTER — manuale, regola APPUNTI-CELLA):
--   sqlcmd -S .\SQLEXPRESS -E -d ADMG -i vice-claw-length.sql
-- ===========================================================================
SET NOCOUNT ON;

IF COL_LENGTH('dbo.VICE', 'CLAW_LENGTH') IS NOT NULL
	PRINT 'VICE.CLAW_LENGTH gia'' presente: niente da fare.';
ELSE IF COL_LENGTH('dbo.VICE', 'CLAW_LENGTH_Y') IS NOT NULL
BEGIN
	EXEC sp_rename 'dbo.VICE.CLAW_LENGTH_Y', 'CLAW_LENGTH', 'COLUMN';
	PRINT 'VICE.CLAW_LENGTH_Y rinominata in CLAW_LENGTH (la battuta e'' sulla X, non sulla Y).';
END
ELSE BEGIN
	ALTER TABLE dbo.VICE ADD CLAW_LENGTH int NULL;
	PRINT 'VICE.CLAW_LENGTH aggiunta (int NULL, micron; NULL = non misurata).';
END
GO

-- La vista VICES e' definita come SELECT v.*: una vista con l'asterisco NON
-- vede le colonne aggiunte (o rinominate) dopo la sua creazione finche' non la
-- si aggiorna. Senza questo il pannello (che legge VICES) non vedrebbe mai la
-- ganascia. Trappola da ricordare per OGNI colonna nuova.
EXEC sp_refreshview 'dbo.VICES';
PRINT 'vista VICES aggiornata (SELECT * non vede da solo le colonne nuove).';

-- verifica:
-- SELECT ID, RTRIM(FAMILY) AS FAMILY, X, Y, CLAW_LENGTH, PALLET_ID FROM VICE;

-- ===========================================================================
-- ROLLBACK (manuale, dopo aver ridistribuito il backend precedente):
-- ALTER TABLE dbo.VICE DROP COLUMN CLAW_LENGTH;
-- EXEC sp_refreshview 'dbo.VICES';
-- ===========================================================================
