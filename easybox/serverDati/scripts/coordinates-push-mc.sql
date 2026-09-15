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
-- LE TRE QUOTE (asse di battuta = X del ROBOT, quella che il PLC manda come
-- X_Pick-Place; NON l'asse della macchina utensile):
--   deposito = P.X                                        (invariata)
--   spinta   = P.X - pezzo.Y/2 - lunghezza_ganascia_pinza/2
--   arrivo   = spinta + corsa
-- Durante la spinta Y e Z restano quelle del deposito: si muove solo la X.
--
-- LA CORSA HA DUE CASI (chiarito da Dario 15/9). Un pezzo PIU' LUNGO della
-- ganascia non e' un errore: e' legittimo e succede. In quel caso non appoggia
-- sulla fine della ganascia ma piu' avanti, su un altro riferimento fisico,
-- e quella distanza va DICHIARATA in PIECE_ON_VICE.STOP_BEYOND_CLAW.
--
--   corsa = (ganascia - pezzo)/2               se pezzo <= ganascia -> 'CLAW'
--   corsa = (ganascia - pezzo)/2 + dichiarata  se pezzo >  ganascia -> 'DECLARED'
--
-- Quando il pezzo sta DENTRO la ganascia il valore dichiarato viene ignorato,
-- perche' la fine della ganascia arriva prima e il pezzo si ferma li'. E' una
-- regola del modello, allo stesso titolo del deposito centrato qui sotto.
--
-- La quota di SPINTA non cambia nei due casi: la chela tocca il bordo vicino
-- del pezzo, e dove sta quel bordo non dipende dalla ganascia.
--
-- PERCHE' pezzo.Y SULLA X: fra disegno e robot c'e' una rotazione. Nel
-- cassetto il passo lungo la X del robot vale PIECE.Y + SAFEY (convenzione
-- validata sul ferro, util/gratingAxes.js), quindi e' PIECE.Y a correre lungo
-- la X; il pezzo non ruota fra presa e deposito, percio' in morsa presenta la
-- stessa dimensione. Riscontro pezzo 1029 (PIECE.X 40, PIECE.Y 120): nel
-- cassetto occupa 120 sulla X del robot e 40 sulla Y.
--
-- Sulla spinta si compensa MEZZA LUNGHEZZA di chela: il TCP sta al centro
-- della chela e il punto che tocca il pezzo e' il bordo. Le chele della pinza
-- e le ganasce della morsa si aprono entrambe lungo la Y, cioe' stringono di
-- traverso rispetto alla spinta: la chela presenta quindi la sua LUNGHEZZA
-- nella direzione in cui spinge, e la ganascia della morsa CONTIENE il pezzo
-- nella direzione in cui scorre fino alla battuta.
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
--   'DISABLED' bit di spinta non attivo sull'ordine  -> X_PUSH/X_STOP NULL
--   'NO_VICE'  nessuna morsa sul pallet dell'ordine  -> NULL
--   'NO_DATA'  manca la ganascia della morsa o la lunghezza della chela -> NULL
--   'NO_FIT'   pezzo oltre la ganascia E appoggio NON dichiarato -> NULL
--   'NO_ROOM'  appoggio dichiarato piu' vicino di quanto il pezzo gia' sporge:
--              al deposito il pezzo sarebbe GIA' oltre la battuta e la corsa
--              verrebbe negativa, cioe' la spinta andrebbe all'indietro -> NULL
--   'OK'       quote valorizzate (corsa zero compresa: pezzo gia' a contatto)
-- X_PUSH/X_STOP sono NULL quando non sono utilizzabili: un PLC che leggesse
-- le quote ignorando l'esito fallisce la lettura invece di muoversi male.
--
-- STOP_REF dice SU COSA appoggia il pezzo: 'CLAW' fine della ganascia,
-- 'DECLARED' riferimento dichiarato oltre di essa. E' valorizzata anche su
-- NO_FIT e NO_ROOM, perche' li' la geometria il riferimento lo implica gia':
-- serve al pannello per spiegare all'operatore cosa manca.
--
-- DIVISIONI INTERE: le colonne sono int, quindi /2 tronca (1 micron). Con il
-- pezzo oltre la ganascia la differenza e' NEGATIVA e SQL Server tronca verso
-- lo ZERO, esattamente come Math.trunc: il pannello replica lo stesso
-- troncamento (util pushQuotes, test di parita' con un caso dispari negativo).
--
-- IDEMPOTENTE: CREATE o ALTER secondo che la vista esista.
-- ORDINE DI DEPLOY: DOPO piece-push-to-stop.sql, vice-claw-length.sql,
-- gripper-claw-length.sql e piece-on-vice.sql (li nomina tutti), a cella
-- ferma con -E.
--   sqlcmd -S .\SQLEXPRESS -E -d ADMG -i coordinates-push-mc.sql
-- ===========================================================================
SET NOCOUNT ON;

IF COL_LENGTH('dbo.PIECE', 'PUSH_TO_STOP') IS NULL
   OR COL_LENGTH('dbo.VICE', 'CLAW_LENGTH') IS NULL
   OR COL_LENGTH('dbo.GRIPPER', 'CLAW_LENGTH') IS NULL
   OR OBJECT_ID('dbo.PIECE_ON_VICE') IS NULL
BEGIN
	PRINT 'MANCANO colonne o tabelle: eseguire prima piece-push-to-stop.sql, vice-claw-length.sql, gripper-claw-length.sql e piece-on-vice.sql.';
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
		case when q.PUSH_STATUS = 'OK' then q.X_PUSH_RAW end				as X_PUSH,
		case when q.PUSH_STATUS = 'OK' then q.X_PUSH_RAW + q.TRAVEL_RAW end	as X_STOP,
		case when q.PUSH_STATUS = 'OK' then q.TRAVEL_RAW end				as CLEARANCE,
		q.STOP_REF,
		q.STOP_BEYOND_CLAW,
		q.PUSH_ENABLED,
		q.PUSH_STATUS
from (
	select	w.ID													as ORDER_ID,
			w.MACHINE_ID											as MC,
			p.X														as X_PLACE,
			p.Y														as Y_PLACE,
			p.Z + pz.Z_PLACE + f.Z									as Z_PLACE,
			p.X - pz.Y/2 - g.CLAW_LENGTH/2							as X_PUSH_RAW,
			-- corsa: fino alla fine della ganascia, piu' il tratto dichiarato
			-- SOLO quando il pezzo la eccede
			(v.CLAW_LENGTH - pz.Y)/2
				+ case when pz.Y > v.CLAW_LENGTH
					   then ISNULL(pv.STOP_BEYOND_CLAW, 0) else 0 end	as TRAVEL_RAW,
			pv.STOP_BEYOND_CLAW										as STOP_BEYOND_CLAW,
			case when (ISNULL(w.OPTION2,0) & 2) = 0					then null
				 when v.ID is null									then null
				 when ISNULL(v.CLAW_LENGTH,0) <= 0
				   or ISNULL(g.CLAW_LENGTH,0) <= 0
				   or ISNULL(pz.Y,0) <= 0							then null
				 when pz.Y > v.CLAW_LENGTH							then 'DECLARED'
				 else 'CLAW' end									as STOP_REF,
			case when (ISNULL(w.OPTION2,0) & 2) <> 0 then 1 else 0 end		as PUSH_ENABLED,
			case when (ISNULL(w.OPTION2,0) & 2) = 0					then 'DISABLED'
				 when v.ID is null									then 'NO_VICE'
				 when ISNULL(v.CLAW_LENGTH,0) <= 0
				   or ISNULL(g.CLAW_LENGTH,0) <= 0
				   or ISNULL(pz.Y,0) <= 0							then 'NO_DATA'
				 when pz.Y > v.CLAW_LENGTH
				  and pv.VICE_ID is null							then 'NO_FIT'
				 when (v.CLAW_LENGTH - pz.Y)/2
					  + case when pz.Y > v.CLAW_LENGTH
							 then ISNULL(pv.STOP_BEYOND_CLAW, 0) else 0 end < 0
																	then 'NO_ROOM'
				 else 'OK' end										as PUSH_STATUS
	from WORKORDER w
	inner join [POSITION] p	on RTRIM(p.PARENT) = CONCAT('MC_', w.MACHINE_ID)
	inner join PIECE pz		on pz.ID = w.PIECE_ID
	inner join FIXTURE f	on f.ID = w.FIXTURE_ID
	left  join VICE v		on v.PALLET_ID = w.PALLET_ID
	left  join GRIPPER g	on g.ID = w.GRIPPER_ID
	-- la dichiarazione segue la MORSA (v.ID), non il pallet: se la morsa si
	-- sposta su un altro pallet si porta dietro la sua battuta
	left  join PIECE_ON_VICE pv	on pv.VICE_ID = v.ID and pv.PIECE_ID = w.PIECE_ID
) q;
GO
SET NOEXEC OFF;
GO

-- ===========================================================================
-- VERIFICA con un pezzo NON QUADRATO (col 1033, 100.6x100.6, un errore d'asse
-- non si vedrebbe).
--
-- Pezzo DENTRO la ganascia — 1029: PIECE.X 40000, PIECE.Y 120000; chela pinza
-- 30000; ganascia morsa 150000:
--   X_PUSH    = X_PLACE - 60000 - 15000
--   CLEARANCE = (150000 - 120000)/2 = 15000       STOP_REF = 'CLAW'
--   X_STOP    = X_PUSH + 15000
--
-- Pezzo OLTRE la ganascia — 180000 lungo la spinta, stessa ganascia: sporge
-- 15000 per lato. Con appoggio dichiarato a 25000 oltre la fine ganascia:
--   CLEARANCE = (150000 - 180000)/2 + 25000 = 10000   STOP_REF = 'DECLARED'
-- con appoggio dichiarato a 10000: CLEARANCE = -5000 -> PUSH_STATUS 'NO_ROOM'
-- senza riga in PIECE_ON_VICE:                        -> PUSH_STATUS 'NO_FIT'
--
-- SELECT ORDER_ID, MC, X_PLACE, X_PUSH, X_STOP, CLEARANCE, STOP_REF,
--        STOP_BEYOND_CLAW, PUSH_ENABLED, PUSH_STATUS
--   FROM COORDINATES_PUSH_MC ORDER BY ORDER_ID;
-- ===========================================================================

-- ===========================================================================
-- ROLLBACK (manuale): DROP VIEW dbo.COORDINATES_PUSH_MC;
-- ===========================================================================
