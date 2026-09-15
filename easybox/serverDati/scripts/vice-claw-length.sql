-- ===========================================================================
-- vice-claw-length.sql — colonna VICE.CLAW_LENGTH_Y (ciclo di SPINTA IN
-- BATTUTA, cantiere push-to-stop 15/9)
--
-- SCOPO: lunghezza della GANASCIA della morsa sull'ASSE DI BATTUTA, in
-- MICRON. L'asse di battuta e' Y, con la battuta a Y CRESCENTI (convenzione
-- fissa, non un dato). E' una dimensione FISICA, si misura col calibro: da
-- questa e dalle dimensioni del pezzo il sistema ricava tutte le quote,
-- l'operatore non inserisce nessuna coordinata.
--
-- NB: VICE.X e VICE.Y esistono gia' ma sono l'INGOMBRO della morsa (nessuno
-- li legge, la vista macchina non li usa). Riusarli per la ganascia
-- significherebbe dare due significati alla stessa colonna: e' l'errore che
-- ha gia' morso su TRAY.X e su GRIPPER.X_BODY. Colonna dedicata.
--
-- NULL = non misurata: il ciclo di spinta NON si abilita e l'ordine viene
-- rifiutato con KO_PUSH_NO_DATA. Le morse esistenti restano com'erano.
--
-- IDEMPOTENTE (guardia COL_LENGTH). ORDINE DI DEPLOY: PRIMA del backend.
--
-- IN CELLA (login plc senza ALTER — manuale, regola APPUNTI-CELLA):
--   sqlcmd -S .\SQLEXPRESS -E -d ADMG -i vice-claw-length.sql
-- ===========================================================================
SET NOCOUNT ON;

IF COL_LENGTH('dbo.VICE', 'CLAW_LENGTH_Y') IS NOT NULL
	PRINT 'VICE.CLAW_LENGTH_Y gia'' presente: niente da fare.';
ELSE BEGIN
	ALTER TABLE dbo.VICE ADD CLAW_LENGTH_Y int NULL;
	PRINT 'VICE.CLAW_LENGTH_Y aggiunta (int NULL, micron; NULL = non misurata).';
END
GO

-- La vista VICES e' definita come SELECT v.*: una vista con l'asterisco NON
-- vede le colonne aggiunte dopo la sua creazione finche' non la si aggiorna.
-- Senza questo il pannello (che legge VICES) non vedrebbe mai la ganascia.
EXEC sp_refreshview 'dbo.VICES';
PRINT 'vista VICES aggiornata (SELECT * non vede da solo le colonne nuove).';

-- verifica:
-- SELECT ID, RTRIM(FAMILY) AS FAMILY, X, Y, CLAW_LENGTH_Y, PALLET_ID FROM VICE;

-- ===========================================================================
-- ROLLBACK (manuale, dopo aver ridistribuito il backend precedente):
-- ALTER TABLE dbo.VICE DROP COLUMN CLAW_LENGTH_Y;
-- ===========================================================================
