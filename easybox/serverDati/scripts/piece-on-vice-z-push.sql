-- ===========================================================================
-- piece-on-vice-z-push.sql - colonna PIECE_ON_VICE.Z_PUSH: altezza della chela
-- dal FONDO del pezzo durante la SPINTA IN BATTUTA (6/10)
--
-- DECISIONE DI DARIO (6/10, 18:24). Si imposta l'altezza della chela dal
-- fondo del pezzo durante la spinta, da 0 alla quota di presa del grezzo
-- (PIECE.Z_PICK). Si salva per la coppia morsa + pezzo, accanto a COMP_PUSH.
-- Il robotista: il TCP e' in punta alla chela; a 0 dal fondo la chela non
-- sfonda l'appoggio.
--
--   Z_PUSH int NULL, micron. NULL (vuoto) = alla quota di presa, cioe' alla
--   Z del deposito: COME OGGI. CHECK (Z_PUSH >= 0). Il limite superiore
--   (Z_PUSH <= PIECE.Z_PICK) dipende da un'altra tabella: lo controlla il
--   backend (CONF/Vice.js, /setZPush) e la vista COORDINATES_PUSH_MC tratta
--   un valore fuori campo come vuoto (pezzo cambiato dopo).
--
-- IDEMPOTENTE: colonna gia' presente e int NULL -> niente; presente ma di
-- altro tipo o NOT NULL -> FERMO; vincolo gia' presente con la stessa
-- condizione -> niente, con un'altra -> FERMO.
-- Le viste che leggono PIECE_ON_VICE (COORDINATES_PUSH_MC,
-- COORDINATES_BLOW_MC) nominano le colonne: non serve sp_refreshview.
--
-- ORDINE: questo script, poi coordinates-push-mc.sql (che controlla la
-- colonna), poi i servizi, poi il PLC, poi il programma robot.
--   cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -i piece-on-vice-z-push.sql
--
-- ROLLBACK (solo dopo aver tolto la consegna 31 dal PLC e rimesso la vista
-- precedente):
--   ALTER TABLE dbo.PIECE_ON_VICE DROP CONSTRAINT CK_PIECE_ON_VICE_Z_PUSH;
--   ALTER TABLE dbo.PIECE_ON_VICE DROP COLUMN Z_PUSH;
-- ===========================================================================
SET NOCOUNT ON;

IF OBJECT_ID('dbo.PIECE_ON_VICE') IS NULL
BEGIN
	PRINT 'FERMO: manca la tabella PIECE_ON_VICE (eseguire prima piece-on-vice.sql). Nessuna modifica.';
	SET NOEXEC ON;
END
GO

IF COL_LENGTH('dbo.PIECE_ON_VICE', 'Z_PUSH') IS NULL
BEGIN
	ALTER TABLE dbo.PIECE_ON_VICE ADD Z_PUSH int NULL;
	PRINT 'PIECE_ON_VICE.Z_PUSH aggiunta (int NULL, micron; NULL = alla quota di presa, come prima).';
END
ELSE IF EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
                 WHERE c.object_id = OBJECT_ID('dbo.PIECE_ON_VICE') AND c.name = 'Z_PUSH'
                   AND t.name = 'int' AND c.is_nullable = 1)
	PRINT 'PIECE_ON_VICE.Z_PUSH gia'' presente (int NULL): colonna invariata.';
ELSE
BEGIN
	PRINT 'FERMO: PIECE_ON_VICE.Z_PUSH esiste ma non e'' int NULL. Nessuna modifica.';
	SET NOEXEC ON;
END
GO

-- vincolo in un batch a parte: la colonna nuova si vede dal batch successivo
IF OBJECT_ID('dbo.CK_PIECE_ON_VICE_Z_PUSH') IS NULL
BEGIN
	ALTER TABLE dbo.PIECE_ON_VICE ADD CONSTRAINT CK_PIECE_ON_VICE_Z_PUSH CHECK (Z_PUSH >= 0);
	PRINT 'vincolo CK_PIECE_ON_VICE_Z_PUSH aggiunto (Z_PUSH >= 0).';
END
ELSE IF OBJECT_DEFINITION(OBJECT_ID('dbo.CK_PIECE_ON_VICE_Z_PUSH')) = N'([Z_PUSH]>=(0))'
	PRINT 'vincolo CK_PIECE_ON_VICE_Z_PUSH gia'' presente: invariato.';
ELSE
	PRINT 'FERMO: CK_PIECE_ON_VICE_Z_PUSH esiste con un''altra condizione: ' + OBJECT_DEFINITION(OBJECT_ID('dbo.CK_PIECE_ON_VICE_Z_PUSH')) + '. Nessuna modifica.';
GO
SET NOEXEC OFF;
GO

-- VERIFICA (sola lettura): la colonna, il vincolo, i valori.
-- Atteso: Z_PUSH int, is_nullable 1; vincolo ([Z_PUSH]>=(0)); nessuna riga
-- con Z_PUSH oltre la quota di presa del suo pezzo.
SELECT c.name, t.name AS tipo, c.is_nullable FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
 WHERE c.object_id = OBJECT_ID('dbo.PIECE_ON_VICE') AND c.name = 'Z_PUSH';
SELECT name, definition FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('dbo.PIECE_ON_VICE');
IF COL_LENGTH('dbo.PIECE_ON_VICE', 'Z_PUSH') IS NOT NULL
	EXEC (N'SELECT pv.VICE_ID, pv.PIECE_ID, pv.Z_PUSH, pz.Z_PICK AS oltre_la_quota_di_presa
	          FROM dbo.PIECE_ON_VICE pv JOIN dbo.PIECE pz ON pz.ID = pv.PIECE_ID
	         WHERE pv.Z_PUSH > ISNULL(pz.Z_PICK, 0);');
