-- ===========================================================================
-- man-order-mc1.sql - vista MAN_ORDER_MC1: ordine in attesa del pezzo di una
-- tasca, per il deposito manuale in MC1 (6/10)
--
-- PERCHE'. Decisione di Dario: in manuale, senza ordine avviato, il deposito
-- in MC1 usa i dati dell'ordine IN ATTESA del pezzo prelevato (creato o in
-- pausa, non avviato). Se l'ordine non c'e', il PLC da' l'allarme 970 e
-- l'operatore lo crea in Produzione senza avviarlo. La regola sta qui, in SQL:
-- le query del PLC restano corte (queryTemp regge 254 caratteri).
-- La usa FB_Robot (consegna 30), REGION Part_Robot_to_MC, stati 10, 32, 37.
--
-- REGOLA, per ogni tasca di cassetto (PARENT 'TRAY_n'):
--   PIECE_ID = POSITION.Part_Type della tasca. Resta valorizzato anche a tasca
--              vuota: VERIFICATO in cella il 6/10 (TRAY_8, tasche 1-5 vuote,
--              Part_Type 1035);
--   ORDER_ID = l'ordine piu' recente di MC1 (MACHINE_ID 1) con lo stesso
--              pezzo e STATUS 4 (in coda, creato e non avviato) o 6 (in pausa),
--              dalla vista WORKORDERS, la stessa che usa il pannello.
--              Codici da _STATUS_TYPE in cella il 6/10: 3 WORKING, 4 RAW,
--              5 FINISHED, 6 PAUSED, 7 ABORTED.
-- Tasche senza un ordine in attesa: nessuna riga (cross apply). Il PLC
-- riceve zero righe e da' 970.
-- TRAY e' testo ('8', '12') come in COORDINATES_PIECES_TRAYS_4Robot: il PLC
-- confronta TRAY='8'. Il CASE evita che una conversione venga valutata su
-- righe non di cassetto (errore 245 visto sul clone il 6/10).
-- Niente TRY_CAST: il DB della cella ha livello di compatibilita' 100.
--
-- GUARDIA: vista assente -> la crea; gia' uguale (a spazi normalizzati, dalla
-- "select" in poi) -> "conforme", nessuna modifica; diversa -> FERMO.
--
-- COMANDO (da PowerShell, in cella, PRIMA del download di FB_Robot):
--   cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -i man-order-mc1.sql
--
-- ROLLBACK: DROP VIEW dbo.MAN_ORDER_MC1; solo dopo aver tolto la consegna 30
-- dal PLC (senza la vista ogni deposito manuale da' 970).
-- ===========================================================================
SET NOCOUNT ON;

DECLARE @def nvarchar(max) = OBJECT_DEFINITION(OBJECT_ID('dbo.MAN_ORDER_MC1'));
DECLARE @v nvarchar(max) = N'select  CASE WHEN p.PARENT LIKE ''TRAY[_]%'' THEN LTRIM(RTRIM(SUBSTRING(p.PARENT,6,10))) END AS TRAY,
        p.SUB_POS,
        p.Part_Type AS PIECE_ID,
        o.ORDER_ID
from [POSITION] p
cross apply (select top 1 w.ID AS ORDER_ID
             from WORKORDERS w
             where w.MACHINE_ID = 1 and w.PIECE_ID = p.Part_Type and w.STATUS in (4, 6)
             order by w.ID desc) o
where p.PARENT like ''TRAY[_]%''';

DECLARE @t TABLE (k varchar(3) PRIMARY KEY, txt nvarchar(max));
INSERT INTO @t VALUES ('def', ISNULL(@def, N'')), ('v', @v);
UPDATE @t SET txt = REPLACE(REPLACE(REPLACE(txt, CHAR(13), N' '), CHAR(10), N' '), CHAR(9), N' ');
WHILE EXISTS (SELECT 1 FROM @t WHERE CHARINDEX(N'  ', txt) > 0)
	UPDATE @t SET txt = REPLACE(txt, N'  ', N' ') WHERE CHARINDEX(N'  ', txt) > 0;
UPDATE @t SET txt = LTRIM(RTRIM(txt));
UPDATE @t SET txt = RTRIM(LEFT(txt, LEN(txt) - 1)) WHERE RIGHT(txt, 1) = N';';
UPDATE @t SET txt = SUBSTRING(txt, CHARINDEX(N'select CASE WHEN', txt), LEN(txt)) WHERE CHARINDEX(N'select CASE WHEN', txt) > 0;
DECLARE @nDef nvarchar(max) = (SELECT txt FROM @t WHERE k = 'def');
DECLARE @nV nvarchar(max) = (SELECT txt FROM @t WHERE k = 'v');

IF @def IS NULL AND OBJECT_ID('dbo.MAN_ORDER_MC1') IS NULL
BEGIN
	EXEC (N'CREATE VIEW dbo.MAN_ORDER_MC1 AS ' + @v);
	IF OBJECT_ID('dbo.MAN_ORDER_MC1') IS NULL
		PRINT 'FERMO: CREATE VIEW non riuscita (vedi errore sopra).';
	ELSE
		PRINT 'MAN_ORDER_MC1: vista creata.';
END
ELSE IF @nDef = @nV
	PRINT 'MAN_ORDER_MC1: gia'' presente e conforme, nessuna modifica.';
ELSE
BEGIN
	PRINT 'FERMO: MAN_ORDER_MC1 esiste ma non e'' quella attesa. Nessuna modifica. Definizione trovata:';
	SELECT @def AS definizione_trovata;
END

-- VERIFICA (sola lettura): ordini di MC1 in attesa e tasche del cassetto 8
-- che li trovano. Atteso il 6/10: ordine 2117 (pezzo 1035, STATUS 4) su
-- tutte le tasche dell'8.
PRINT 'VERIFICA: ordini di MC1 in attesa (STATUS 4 o 6)';
SELECT ID, PIECE_ID, STATUS FROM WORKORDERS WHERE MACHINE_ID = 1 AND STATUS IN (4, 6) ORDER BY ID DESC;
IF OBJECT_ID('dbo.MAN_ORDER_MC1') IS NOT NULL
BEGIN
	PRINT 'VERIFICA: cassetto 8, prime 5 tasche';
	SELECT TOP 5 TRAY, SUB_POS, PIECE_ID, ORDER_ID FROM dbo.MAN_ORDER_MC1 WHERE TRAY = '8' ORDER BY SUB_POS;
	SELECT COUNT(*) AS tasche_dell_8_con_ordine FROM dbo.MAN_ORDER_MC1 WHERE TRAY = '8';
END
