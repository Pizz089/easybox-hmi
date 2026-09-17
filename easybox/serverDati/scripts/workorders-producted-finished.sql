-- ===========================================================================
-- workorders-producted-finished.sql — vista WORKORDERS v3: cosa conta come
-- "pezzo prodotto" (cantiere chiusura ordine, 17/9)
--
-- UNA SOLA MODIFICA, nella derivata che calcola PRODUCTED:
--
--     status IN (5,6,7)   ->   status = 5
--
-- 5 = finito, 6 = in pausa, 7 = ABORTITO. Un pezzo abortito non e' un pezzo
-- prodotto. Finche' PRODUCTED serviva solo a mostrare l'avanzamento in
-- tabella, contarlo era un'imprecisione; da adesso la CHIUSURA AUTOMATICA
-- dell'ordine si appoggia a questo conteggio (setPositionStatus in
-- MQTT_Client.js), quindi contare gli abortiti chiuderebbe l'ordine PRIMA
-- della quantita' richiesta, con pezzi mai fatti. Ogni altra colonna, ogni
-- join e il raggruppamento restano identici.
--
-- CONSEGUENZA DA SAPERE PRIMA DI LANCIARLO: sugli ordini gia' in corso che
-- hanno tasche in stato 6 o 7, PRODUCTED CALA. E' il numero giusto (quei
-- pezzi non sono stati prodotti), ma la tabella di produzione mostrera' un
-- avanzamento minore di prima. La query 2 in coda dice esattamente quali
-- ordini e di quanto: lanciarla PRIMA.
--
-- ---------------------------------------------------------------------------
-- DA DOVE VIENE QUESTO TESTO — leggere prima di modificarlo.
--
-- Dalla definizione REALE letta in cella il 2026-09-17 con
--     SELECT definition FROM sys.sql_modules
--      WHERE object_id = OBJECT_ID('WORKORDERS');
-- e NON da workorders-view-pp.sql (v2), che descrive la vista come sta su
-- DEV. Le due DIFFERISCONO, e la differenza e' proprio nella derivata:
--
--     dev  (workorders-view-pp.sql)      cella (verificata)
--     ------------------------------     --------------------------------
--     on w.ORDER_ID = x.Order_ID         on w.ID = x.Order_ID
--     group by Order_ID, status          group by Order_ID
--     count(Order_ID)                    count(*)
--
-- In cella la join si aggancia a w.ID, la chiave dell'ordine, la stessa che
-- POSITION.Order_ID contiene. WORKORDER.ORDER_ID (il nome su cui si aggancia
-- la versione dev) e' invece NULL su tutte le righe: colonna morta. E il
-- group by e' su una colonna sola, quindi la derivata restituisce una riga
-- per ordine e la LEFT JOIN non puo' duplicare niente.
--
-- Il testo dev NON va usato come base per la cella: vedi l'intestazione di
-- workorders-view-pp.sql, marcato di conseguenza.
--
-- L'ALLINEAMENTO NON E' SIGNIFICATIVO: qui sotto il testo va a capo per
-- leggibilita', in cella sta su poche righe lunghe. Le guardie confrontano la
-- definizione a spazi NORMALIZZATI, non carattere per carattere.
-- ---------------------------------------------------------------------------
--
-- IDEMPOTENTE, e si FERMA invece di sovrascrivere se la vista in cella non e'
-- quella attesa: e' esattamente l'errore da cui nasce questo script.
--
-- ESECUZIONE MANUALE, a cella ferma:
--   sqlcmd -S .\SQLEXPRESS -E -d ADMG -i workorders-producted-finished.sql
-- ===========================================================================
SET NOCOUNT ON;

DECLARE @def NVARCHAR(MAX) = OBJECT_DEFINITION(OBJECT_ID('WORKORDERS'));

-- confronto a spazi normalizzati: a capo, tabulazioni e spazi multipli
-- diventano un singolo spazio, cosi' le guardie non dipendono da come la
-- definizione e' stata formattata
DECLARE @norm NVARCHAR(MAX) = REPLACE(REPLACE(REPLACE(ISNULL(@def, N''),
	CHAR(13), N' '), CHAR(10), N' '), CHAR(9), N' ');
WHILE CHARINDEX(N'  ', @norm) > 0
	SET @norm = REPLACE(@norm, N'  ', N' ');

IF @def IS NULL
BEGIN
	PRINT 'workorders-producted-finished: vista WORKORDERS assente o CIFRATA — FERMO.';
	SET NOEXEC ON;
END
ELSE IF @norm LIKE N'%v3: PRODUCTED conta solo i FINITI%'
BEGIN
	PRINT 'workorders-producted-finished: v3 gia'' applicata, nessuna modifica.';
	SET NOEXEC ON;
END
-- la vista deve essere gia' v1+v2 (PP_ID dal workorder, GRIPPER in LEFT JOIN):
-- questo script NON rifa' quel lavoro, lo da' per fatto
ELSE IF @norm NOT LIKE N'%w.PartProg_ID AS PP_ID%'
	 OR @norm NOT LIKE N'%left join GRIPPER%'
BEGIN
	PRINT 'workorders-producted-finished: mancano v1/v2 (PP_ID dal workorder, GRIPPER in LEFT JOIN). FERMO.';
	SET NOEXEC ON;
END
-- la derivata deve essere quella letta in cella: se si aggancia a w.ORDER_ID
-- o raggruppa anche su status, siamo su un'altra vista e non la tocco
ELSE IF @norm NOT LIKE N'%group by Order_ID) as x on w.ID = x.Order_ID%'
BEGIN
	PRINT 'workorders-producted-finished: la derivata PRODUCTED non e'' quella attesa';
	PRINT '(attesa: group by Order_ID ... on w.ID = x.Order_ID). FERMO: riconciliare a mano.';
	PRINT 'Leggerla con: SELECT definition FROM sys.sql_modules WHERE object_id = OBJECT_ID(''WORKORDERS'');';
	SET NOEXEC ON;
END
ELSE IF @norm NOT LIKE N'%status IN (5,6,7)%'
BEGIN
	PRINT 'workorders-producted-finished: non trovo status IN (5,6,7) nella derivata.';
	PRINT 'Il filtro e'' gia'' stato cambiato da qualcun altro. FERMO.';
	SET NOEXEC ON;
END
GO

EXEC('
ALTER VIEW dbo.WORKORDERS AS
/* v3: PRODUCTED conta solo i FINITI (status 5), non 5/6/7 */
SELECT w.ID,
	w.STATUS,
	RTRIM(st.DESCR) AS STATUS_DESC,
	w.PIECE_ID,
	RTRIM(p.FAMILY) AS PIECE,
	RTRIM(p.DESCR) as PIECE_DESC,
	w.GRIPPER_ID as GRIPPER_ID,
	RTRIM(g.FAMILY) AS GRIPPER,
	RTRIM(g.DESCR) as GRIPPER_DESC,
	w.MACHINE_ID,
	w.PALLET_ID,
	pal.GripperREQ as Gripper4Pallet,
	w.VICE_ID,
	w.QUANTITY,
	ISNULL(x.PRODUCTED,0) as PRODUCTED,
	(w.OPTION1*65536)+w.OPTION2 as [OPTIONS],
	w.PartProg_ID AS PP_ID,
	concat(trim(pp.path), trim(pp.NAME)) as PP
from PIECE p, [_STATUS_TYPE] st, pallet pal, WORKORDER w
	left join (SELECT Order_ID, count(*) as PRODUCTED
		from [POSITION]
		where parent like ''tray_%'' and Order_ID > 0 and status = 5
		group by Order_ID) as x
	on w.ID = x.Order_ID
	left join partprogram pp
	on w.PartProg_ID = pp.id
	left join GRIPPER g
	on (w.GRIPPER_ID-((w.GRIPPER_ID/1000)*1000)=g.ID)
where w.PIECE_ID = p.ID and w.STATUS = st.ID and w.PALLET_ID = pal.ID
');
PRINT 'workorders-producted-finished: fatto (v3).';
GO
SET NOEXEC OFF;
GO

-- ===========================================================================
-- VERIFICA — la 2 va lanciata PRIMA, le altre DOPO.
--
-- 1) La vista risponde e il conteggio e' quello atteso:
--    SELECT ID, STATUS, STATUS_DESC, PRODUCTED, QUANTITY
--      FROM WORKORDERS WHERE STATUS = 3 ORDER BY ID;
--
-- 2) PRIMA: ordini che perderanno avanzamento perche' hanno tasche 6/7:
--    SELECT Order_ID,
--           SUM(CASE WHEN status = 5 THEN 1 ELSE 0 END) AS finiti,
--           SUM(CASE WHEN status IN (6,7) THEN 1 ELSE 0 END) AS pausa_o_abort
--      FROM [POSITION]
--     WHERE parent like 'tray_%' AND Order_ID > 0 AND status IN (5,6,7)
--     GROUP BY Order_ID
--    HAVING SUM(CASE WHEN status IN (6,7) THEN 1 ELSE 0 END) > 0;
--    Ogni riga e' un ordine il cui PRODUCTED CALA di 'pausa_o_abort'.
--
-- 3) DOPO: nessun ordine duplicato. Non deve cambiare niente rispetto a
--    prima (in cella la derivata era gia' una riga per ordine), ma costa
--    poco e chiude il dubbio:
--    SELECT ID, COUNT(*) AS righe FROM WORKORDERS GROUP BY ID HAVING COUNT(*) > 1;
--    Atteso: nessuna riga.
-- ===========================================================================

-- ===========================================================================
-- ROLLBACK: rilanciare lo stesso ALTER VIEW qui sopra con
--     status = 5   ->   status IN (5,6,7)
-- e senza la riga del marcatore /* v3: ... */. E' l'unica differenza fra la
-- definizione di cella del 2026-09-17 e questa.
-- ===========================================================================
