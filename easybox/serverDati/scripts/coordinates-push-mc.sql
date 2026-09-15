-- ===========================================================================
-- coordinates-push-mc.sql — vista COORDINATES_PUSH_MC (ciclo di SPINTA IN
-- BATTUTA, cantiere push-to-stop 15/9)
--
-- *** NASCE IN CHIARO, DEFINIZIONE VERSIONATA QUI. ***
-- Le viste 4Robot e WORKORDERS erano CIFRATE e questo e' costato ore quando
-- si e' dovuto capire perche' PRODUCTED restava a zero. Nessuna vista nuova
-- di questo progetto sara' mai WITH ENCRYPTION.
--
-- SCOPO: il PLC legge UNA riga e ha tutto. Il calcolo delle tre quote sta
-- qui, non nel PLC: e' verificabile con un test e il PLC resta semplice.
--
-- LE TRE QUOTE (asse di battuta = Y, battuta a Y CRESCENTI, convenzione fissa):
--   deposito = P.Y                                        (invariata)
--   spinta   = P.Y - pezzo.Y/2 - spessore_ganascia_pinza/2
--   arrivo   = spinta + (ganascia_morsa - pezzo.Y)/2
-- Sulla spinta si compensa MEZZO spessore di ganascia perche' il TCP sta al
-- centro della chela e il punto che tocca il pezzo e' il bordo.
--
-- IPOTESI DICHIARATA (confermata da Dario 15/9): il deposito e' SEMPRE
-- CENTRATO sulla morsa, quindi lo spazio verso la battuta e' meta' della
-- differenza fra ganascia e pezzo. Se un domani si riapprende la posizione
-- di deposito SCENTRATA, questa formula sbaglia in silenzio: la dipendenza
-- e' annotata in APPUNTI-CELLA.
--
-- DEPOSITO BYTE-IDENTICO ALLA QUERY CHE IL PLC USA OGGI:
--   select P.X, P.Y, P.Z + C.Z_PLACE + F.Z from POSITION P, WORKORDER W,
--          PIECE C, FIXTURE F
--    where C.ID=W.PIECE_ID and F.ID=W.FIXTURE_ID and P.PARENT='MC_1'
-- cosi' la spinta parte esattamente dalla base del deposito.
-- NB: quella query non filtra W (giunzione cartesiana su tutti gli ordini):
-- la vista espone ORDER_ID proprio perche' la selezione sia esplicita, e
-- lega la posizione alla macchina dell'ordine (PARENT = 'MC_' + MACHINE_ID).
--
-- COLONNE DI ESITO — il PLC legge PUSH_STATUS PRIMA delle quote:
--   'DISABLED' bit di spinta non attivo sull'ordine  -> Y_PUSH/Y_STOP NULL
--   'NO_VICE'  nessuna morsa sul pallet dell'ordine  -> NULL
--   'NO_DATA'  manca la ganascia morsa o lo spessore ganascia pinza -> NULL
--   'NO_FIT'   pezzo piu' lungo della ganascia       -> NULL
--   'OK'       quote valorizzate
-- Y_PUSH/Y_STOP sono NULL quando non sono utilizzabili: un PLC che leggesse
-- le quote ignorando l'esito fallisce la lettura invece di muoversi male.
--
-- DIVISIONI INTERE: le colonne sono int, quindi /2 tronca (1 micron). Il
-- pannello replica lo stesso troncamento (util pushQuotes, test di parita').
--
-- IDEMPOTENTE: CREATE o ALTER secondo che la vista esista.
-- ORDINE DI DEPLOY: DOPO piece-push-to-stop.sql e vice-claw-length.sql
-- (nomina le due colonne nuove), a cella ferma con -E.
--   sqlcmd -S .\SQLEXPRESS -E -d ADMG -i coordinates-push-mc.sql
-- ===========================================================================
SET NOCOUNT ON;

IF COL_LENGTH('dbo.PIECE', 'PUSH_TO_STOP') IS NULL OR COL_LENGTH('dbo.VICE', 'CLAW_LENGTH_Y') IS NULL
BEGIN
	PRINT 'MANCANO le colonne: eseguire prima piece-push-to-stop.sql e vice-claw-length.sql.';
	SET NOEXEC ON;
END
GO

IF OBJECT_ID('dbo.COORDINATES_PUSH_MC') IS NULL
	EXEC('CREATE VIEW dbo.COORDINATES_PUSH_MC AS SELECT 1 AS segnaposto');
GO

ALTER VIEW dbo.COORDINATES_PUSH_MC AS
select	q.ORDER_ID,
		q.MC,
		q.X_PLACE,
		q.Y_PLACE,
		q.Z_PLACE,
		case when q.PUSH_STATUS = 'OK' then q.Y_PUSH_RAW end				as Y_PUSH,
		case when q.PUSH_STATUS = 'OK' then q.Y_STOP_RAW end				as Y_STOP,
		case when q.PUSH_STATUS = 'OK' then q.CLEARANCE_RAW end				as CLEARANCE,
		q.PUSH_ENABLED,
		q.PUSH_STATUS
from (
	select	w.ID													as ORDER_ID,
			w.MACHINE_ID											as MC,
			p.X														as X_PLACE,
			p.Y														as Y_PLACE,
			p.Z + pz.Z_PLACE + f.Z									as Z_PLACE,
			p.Y - pz.Y/2 - g.Tickness_CLAW/2						as Y_PUSH_RAW,
			p.Y - pz.Y/2 - g.Tickness_CLAW/2 + (v.CLAW_LENGTH_Y - pz.Y)/2	as Y_STOP_RAW,
			(v.CLAW_LENGTH_Y - pz.Y)/2								as CLEARANCE_RAW,
			case when (ISNULL(w.OPTION2,0) & 2) <> 0 then 1 else 0 end		as PUSH_ENABLED,
			case when (ISNULL(w.OPTION2,0) & 2) = 0					then 'DISABLED'
				 when v.ID is null									then 'NO_VICE'
				 when ISNULL(v.CLAW_LENGTH_Y,0) <= 0
				   or ISNULL(g.Tickness_CLAW,0) <= 0
				   or ISNULL(pz.Y,0) <= 0							then 'NO_DATA'
				 when (v.CLAW_LENGTH_Y - pz.Y) < 0					then 'NO_FIT'
				 else 'OK' end										as PUSH_STATUS
	from WORKORDER w
	inner join [POSITION] p	on RTRIM(p.PARENT) = CONCAT('MC_', w.MACHINE_ID)
	inner join PIECE pz		on pz.ID = w.PIECE_ID
	inner join FIXTURE f	on f.ID = w.FIXTURE_ID
	left  join VICE v		on v.PALLET_ID = w.PALLET_ID
	left  join GRIPPER g	on g.ID = w.GRIPPER_ID
) q;
GO
SET NOEXEC OFF;
GO

-- ===========================================================================
-- VERIFICA (numeri attesi con i dati di cella: pezzo 1033 Y 100600, pinza 26
-- Tickness_CLAW 5000, POSITION MC_1 Y da misura):
--   Y_PUSH = Y_PLACE - 50300 - 2500
--   Y_STOP = Y_PUSH + (CLAW_LENGTH_Y - 100600)/2
--   con ganascia 150000: CLEARANCE 24700
-- SELECT ORDER_ID, MC, Y_PLACE, Y_PUSH, Y_STOP, CLEARANCE, PUSH_ENABLED, PUSH_STATUS
--   FROM COORDINATES_PUSH_MC ORDER BY ORDER_ID;
-- ===========================================================================

-- ===========================================================================
-- ROLLBACK (manuale): DROP VIEW dbo.COORDINATES_PUSH_MC;
-- ===========================================================================
