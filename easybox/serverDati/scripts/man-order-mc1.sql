-- ===========================================================================
-- man-order-mc1.sql - vista MAN_ORDER_MC1: ordine di MC1 del pezzo di una
-- tasca, per il deposito manuale in MC1 (6/10, aggiornata il 7/10)
--
-- PERCHE'. Decisione di Dario (6/10): in manuale il deposito in MC1 usa i
-- dati dell'ordine del pezzo prelevato. Se l'ordine non c'e', il PLC da'
-- l'allarme 970 e l'operatore lo crea in Produzione senza avviarlo. La regola
-- sta qui, in SQL: le query del PLC restano corte (queryTemp regge 254).
-- La usa FB_Robot, REGION Part_Robot_to_MC, stati 10, 32, 37.
--
-- 7/10, CONSEGNA 33 (simulazione del 7/10, problema 3). La consegna 30
-- decideva "ordine avviato" con DB_MC1.order.ID > 0, ma FB204 non azzera
-- order.ID a fine produzione: dopo un ordine finito il deposito manuale
-- prendeva quote, spinta e soffiaggio dell'ordine CHIUSO. Col PLC 33 il
-- deposito dal pannello cerca l'ordine in questa vista anche quando un
-- ordine e' avviato, quindi la vista deve trovare anche quello.
--
-- REGOLA (7/10), per ogni tasca di cassetto (PARENT 'TRAY_n'):
--   PIECE_ID = POSITION.Part_Type della tasca. Resta valorizzato anche a tasca
--              vuota: VERIFICATO in cella il 6/10 (TRAY_8, tasche 1-5 vuote,
--              Part_Type 1035);
--   ORDER_ID = l'ordine di MC1 (MACHINE_ID 1) con lo stesso pezzo, dalla vista
--              WORKORDERS (la stessa del pannello), cercato in quest'ordine:
--                1. avviato e non completo: STATUS = 3 AND PRODUCTED <
--                   QUANTITY, la stessa regola con cui FB204 sceglie l'ordine
--                   attivo;
--                2. altrimenti in coda o in pausa: STATUS 4 o 6;
--                3. a parita', il piu' recente (ID piu' alto).
--              Codici da _STATUS_TYPE in cella il 6/10: 3 WORKING, 4 RAW,
--              5 FINISHED, 6 PAUSED, 7 ABORTED.
-- (6/10 la regola era: il piu' recente con STATUS 4 o 6.)
-- Tasche senza un ordine: nessuna riga (cross apply). Il PLC riceve zero
-- righe e da' 970. Colonne invariate: il PLC legge solo ORDER_ID.
-- TRAY e' testo ('8', '12') come in COORDINATES_PIECES_TRAYS_4Robot: il PLC
-- confronta TRAY='8'. Il CASE evita che una conversione venga valutata su
-- righe non di cassetto (errore 245 visto sul clone il 6/10).
-- Niente TRY_CAST: il DB della cella ha livello di compatibilita' 100.
--
-- GUARDIA (a spazi normalizzati, dalla "select" in poi):
--   vista assente            -> CREATE della versione 7/10;
--   versione 6/10            -> ALTER alla 7/10, "aggiornata";
--   versione 7/10            -> "conforme", nessuna modifica;
--   qualsiasi altra versione -> FERMO, stampa la definizione trovata.
--
-- COMANDO (da PowerShell, in cella, PRIMA del download della consegna 33):
--   cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -i man-order-mc1.sql
-- Atteso: "aggiornata dalla 6/10 alla 7/10"; rilanciato, "conforme".
--
-- ROLLBACK: la versione 6/10 si rimette SOLO insieme al PLC di prima della
-- consegna 33. Col PLC 33 e la vista 6/10, un deposito dal pannello con
-- l'ordine avviato da' 970 (la vista vecchia non trova gli ordini STATUS 3).
-- Per rimetterla: ALTER VIEW dbo.MAN_ORDER_MC1 AS <testo di @v6 qui sotto>.
-- Senza consegna 30/33 nel PLC: DROP VIEW dbo.MAN_ORDER_MC1.
-- ===========================================================================
SET NOCOUNT ON;

DECLARE @def nvarchar(max) = OBJECT_DEFINITION(OBJECT_ID('dbo.MAN_ORDER_MC1'));

-- versione 6/10 (solo per riconoscerla)
DECLARE @v6 nvarchar(max) = N'select  CASE WHEN p.PARENT LIKE ''TRAY[_]%'' THEN LTRIM(RTRIM(SUBSTRING(p.PARENT,6,10))) END AS TRAY,
        p.SUB_POS,
        p.Part_Type AS PIECE_ID,
        o.ORDER_ID
from [POSITION] p
cross apply (select top 1 w.ID AS ORDER_ID
             from WORKORDERS w
             where w.MACHINE_ID = 1 and w.PIECE_ID = p.Part_Type and w.STATUS in (4, 6)
             order by w.ID desc) o
where p.PARENT like ''TRAY[_]%''';

-- versione 7/10 (consegna 33)
DECLARE @v nvarchar(max) = N'select  CASE WHEN p.PARENT LIKE ''TRAY[_]%'' THEN LTRIM(RTRIM(SUBSTRING(p.PARENT,6,10))) END AS TRAY,
        p.SUB_POS,
        p.Part_Type AS PIECE_ID,
        o.ORDER_ID
from [POSITION] p
cross apply (select top 1 w.ID AS ORDER_ID
             from WORKORDERS w
             where w.MACHINE_ID = 1 and w.PIECE_ID = p.Part_Type
               and ((w.STATUS = 3 and w.PRODUCTED < w.QUANTITY) or w.STATUS in (4, 6))
             order by case when w.STATUS = 3 then 0 else 1 end, w.ID desc) o
where p.PARENT like ''TRAY[_]%''';

-- normalizzazione: spazi, ';' finale, dal primo "select CASE WHEN" in poi
DECLARE @t TABLE (k varchar(3) PRIMARY KEY, txt nvarchar(max));
INSERT INTO @t VALUES ('def', ISNULL(@def, N'')), ('v6', @v6), ('v', @v);
UPDATE @t SET txt = REPLACE(REPLACE(REPLACE(txt, CHAR(13), N' '), CHAR(10), N' '), CHAR(9), N' ');
WHILE EXISTS (SELECT 1 FROM @t WHERE CHARINDEX(N'  ', txt) > 0)
	UPDATE @t SET txt = REPLACE(txt, N'  ', N' ') WHERE CHARINDEX(N'  ', txt) > 0;
UPDATE @t SET txt = LTRIM(RTRIM(txt));
UPDATE @t SET txt = RTRIM(LEFT(txt, LEN(txt) - 1)) WHERE RIGHT(txt, 1) = N';';
UPDATE @t SET txt = SUBSTRING(txt, CHARINDEX(N'select CASE WHEN', txt), LEN(txt)) WHERE CHARINDEX(N'select CASE WHEN', txt) > 0;
DECLARE @nDef nvarchar(max) = (SELECT txt FROM @t WHERE k = 'def');
DECLARE @nV6 nvarchar(max) = (SELECT txt FROM @t WHERE k = 'v6');
DECLARE @nV nvarchar(max) = (SELECT txt FROM @t WHERE k = 'v');

IF @def IS NULL AND OBJECT_ID('dbo.MAN_ORDER_MC1') IS NULL
BEGIN
	EXEC (N'CREATE VIEW dbo.MAN_ORDER_MC1 AS ' + @v);
	IF OBJECT_ID('dbo.MAN_ORDER_MC1') IS NULL
		PRINT 'FERMO: CREATE VIEW non riuscita (vedi errore sopra).';
	ELSE
		PRINT 'MAN_ORDER_MC1: vista creata (versione 7/10).';
END
ELSE IF @nDef = @nV
	PRINT 'MAN_ORDER_MC1: gia'' presente e conforme (versione 7/10), nessuna modifica.';
ELSE IF @nDef = @nV6
BEGIN
	EXEC (N'ALTER VIEW dbo.MAN_ORDER_MC1 AS ' + @v);
	-- riletta: deve essere la 7/10
	DECLARE @dopo nvarchar(max) = REPLACE(REPLACE(REPLACE(OBJECT_DEFINITION(OBJECT_ID('dbo.MAN_ORDER_MC1')), CHAR(13), N' '), CHAR(10), N' '), CHAR(9), N' ');
	WHILE CHARINDEX(N'  ', @dopo) > 0 SET @dopo = REPLACE(@dopo, N'  ', N' ');
	SET @dopo = LTRIM(RTRIM(@dopo));
	IF RIGHT(@dopo, 1) = N';' SET @dopo = RTRIM(LEFT(@dopo, LEN(@dopo) - 1));
	IF CHARINDEX(N'select CASE WHEN', @dopo) > 0 SET @dopo = SUBSTRING(@dopo, CHARINDEX(N'select CASE WHEN', @dopo), LEN(@dopo));
	IF @dopo = @nV
		PRINT 'MAN_ORDER_MC1: aggiornata dalla 6/10 alla 7/10 (ordine avviato e non completo, poi in coda o in pausa).';
	ELSE
		PRINT 'FERMO: ALTER VIEW non riuscita o definizione diversa dall''attesa (vedi errore sopra).';
END
ELSE
BEGIN
	PRINT 'FERMO: MAN_ORDER_MC1 esiste ma non e'' ne'' la 6/10 ne'' la 7/10. Nessuna modifica. Definizione trovata:';
	SELECT @def AS definizione_trovata;
END

-- VERIFICA (sola lettura)
PRINT 'VERIFICA: ordini di MC1 avviati, in coda o in pausa (STATUS 3, 4, 6)';
SELECT ID, PIECE_ID, STATUS, PRODUCTED, QUANTITY FROM WORKORDERS WHERE MACHINE_ID = 1 AND STATUS IN (3, 4, 6) ORDER BY ID DESC;
IF OBJECT_ID('dbo.MAN_ORDER_MC1') IS NOT NULL
BEGIN
	PRINT 'VERIFICA: cassetto 8, prime 5 tasche';
	SELECT TOP 5 TRAY, SUB_POS, PIECE_ID, ORDER_ID FROM dbo.MAN_ORDER_MC1 WHERE TRAY = '8' ORDER BY SUB_POS;
	SELECT COUNT(*) AS tasche_dell_8_con_ordine FROM dbo.MAN_ORDER_MC1 WHERE TRAY = '8';
END
-- con la chiusura automatica (serverDati/orderAutoClose.js) attiva deve
-- essere 0: un ordine STATUS 3 gia' completo non e' "avviato" per la vista,
-- ma va riportato
PRINT 'VERIFICA: ordini avviati ma gia'' completi (STATUS 3 e PRODUCTED >= QUANTITY): atteso 0';
DECLARE @completi int = (SELECT COUNT(*) FROM WORKORDERS WHERE STATUS = 3 AND PRODUCTED >= QUANTITY);
SELECT @completi AS avviati_ma_completi;
IF @completi > 0
BEGIN
	PRINT 'ATTENZIONE: ci sono ordini STATUS 3 gia'' completi: la chiusura automatica non li ha chiusi. Da riportare.';
	SELECT ID, MACHINE_ID, PIECE_ID, STATUS, PRODUCTED, QUANTITY FROM WORKORDERS WHERE STATUS = 3 AND PRODUCTED >= QUANTITY ORDER BY ID DESC;
END
