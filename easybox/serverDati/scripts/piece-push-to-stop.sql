-- ===========================================================================
-- piece-push-to-stop.sql — colonna PIECE.PUSH_TO_STOP (ciclo di SPINTA IN
-- BATTUTA, cantiere push-to-stop 15/9)
--
-- SCOPO: dopo aver posato il grezzo in morsa il robot lo spinge contro una
-- battuta, per portarlo a un riferimento certo. E' una proprieta' del PEZZO
-- (dipende dalla sua geometria e dalla tolleranza richiesta), non della
-- singola produzione: l'operatore la dichiara una volta in anagrafica e
-- l'ordine la eredita come ISTANTANEA, esattamente come il part program
-- (PIECE.PARTPROGRAM -> WORKORDER.PartProg_ID).
--
-- L'istantanea finisce nel bit 1 di WORKORDER.OPTION2 (la vista WORKORDERS
-- espone OPTIONS = OPTION1*65536 + OPTION2). Il bit 0 resta al gripper
-- doppio.
--
-- DEFAULT 0 = ciclo disabilitato: tutti i pezzi esistenti continuano a
-- lavorare esattamente come oggi.
--
-- IDEMPOTENTE (guardia COL_LENGTH). ORDINE DI DEPLOY: PRIMA del backend
-- (insert/update di CONF/Piece.js nominano la colonna).
--
-- IN CELLA (login plc senza ALTER — manuale, regola APPUNTI-CELLA):
--   sqlcmd -S .\SQLEXPRESS -E -d ADMG -i piece-push-to-stop.sql
-- ===========================================================================
SET NOCOUNT ON;

IF COL_LENGTH('dbo.PIECE', 'PUSH_TO_STOP') IS NOT NULL
	PRINT 'PIECE.PUSH_TO_STOP gia'' presente: niente da fare.';
ELSE BEGIN
	ALTER TABLE dbo.PIECE ADD PUSH_TO_STOP bit NOT NULL CONSTRAINT DF_PIECE_PUSH_TO_STOP DEFAULT 0;
	PRINT 'PIECE.PUSH_TO_STOP aggiunta (bit, default 0 = ciclo disabilitato).';
END

-- verifica:
-- SELECT ID, RTRIM(FAMILY) AS FAMILY, Y, PUSH_TO_STOP FROM PIECE ORDER BY ID;

-- ===========================================================================
-- ROLLBACK (manuale, dopo aver ridistribuito il backend precedente):
-- ALTER TABLE dbo.PIECE DROP CONSTRAINT DF_PIECE_PUSH_TO_STOP;
-- ALTER TABLE dbo.PIECE DROP COLUMN PUSH_TO_STOP;
-- ===========================================================================
