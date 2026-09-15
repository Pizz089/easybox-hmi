-- ===========================================================================
-- piece-on-vice.sql — tabella PIECE_ON_VICE (ciclo di SPINTA IN BATTUTA,
-- cantiere push-to-stop 15/9)
--
-- SCOPO: dichiarare DOVE APPOGGIA DAVVERO un pezzo che ECCEDE la ganascia
-- della morsa. Un pezzo piu' lungo della ganascia non e' un errore: e'
-- legittimo e succede. In quel caso non si ferma sulla fine della ganascia ma
-- piu' avanti, su un altro riferimento fisico, e quella distanza nessuno la
-- puo' dedurre dai dati: va DICHIARATA.
--
-- STOP_BEYOND_CLAW: distanza fra la faccia di FINE GANASCIA, dal lato verso
-- cui il pezzo viene spinto, e la faccia del riferimento su cui il pezzo
-- appoggia davvero. In MICRON. E' una misura col calibro, come tutte le altre
-- di questo cantiere: l'operatore non insegna coordinate.
--
-- LA RIGA E' LA DICHIARAZIONE, NON IL VALORE.
-- Riga assente = nessuno ha dichiarato dove appoggia -> l'ordine viene
-- rifiutato (KO_PUSH_NO_FIT). Riga presente con valore 0 = dichiarato che il
-- pezzo, pur sporgendo, tocca ancora la fine della ganascia. Sono due cose
-- diverse e restano distinguibili SENZA convenzioni dentro il numero: e' la
-- lezione di NULL-vs-zero di CLAW_LENGTH, qui applicata meglio. Per questo la
-- colonna e' NOT NULL: il "non dichiarato" e' l'assenza della riga.
--
-- PERCHE' LA COPPIA (morsa, pezzo) E NON UNA COLONNA SULLA MORSA.
-- Con un valore solo per morsa il sistema indovinerebbe per ogni pezzo: se un
-- pezzo appoggia altrove la quota uscirebbe plausibile e SBAGLIATA, e niente
-- se ne accorgerebbe. Con la riga di coppia la mancanza e' un buco visibile
-- che ferma l'ordine. Una misura che manca blocca, non viene supposta.
--
-- PERCHE' LA CHIAVE E' LA MORSA E NON IL PALLET.
-- Il riferimento sta con la morsa: se la morsa viene spostata su un altro
-- pallet si porta dietro la sua battuta, e la dichiarazione la segue. Con la
-- chiave sul pallet la dichiarazione resterebbe attaccata al POSTO e verrebbe
-- applicata in silenzio alla morsa che arriva dopo — la stessa famiglia di
-- errore silenzioso dell'UPDATE che cercava la riga che avrebbe dovuto creare.
--
-- COSA NON STA NELLA CHIAVE, dicendolo: la MACCHINA. In POSITION esiste anche
-- MC_2, quindi la dimensione e' reale nello schema, ma la cella lavora su MC_1
-- e nessuno ha dichiarato che la battuta appartenga alla macchina invece che
-- alla morsa. Se un domani si scopre che appartiene alla macchina, questa
-- tabella guadagna una colonna e cambia la chiave: migrazione contenuta, da
-- fare su un fatto e non su un sospetto.
--
-- CHIAVE PRIMARIA COMPOSTA DALLA NASCITA: FIXTURE_ON_PALLET l'indice unico
-- l'ha ricevuto solo dopo il guasto del 15/9, quando i duplicati c'erano gia'.
-- Qui la chiave c'e' dal primo giorno.
--
-- IDEMPOTENTE.
-- ORDINE DI DEPLOY: PRIMA di coordinates-push-mc.sql (la vista la legge) e
-- PRIMA del backend.
--
-- IN CELLA (login plc senza CREATE — manuale, regola APPUNTI-CELLA):
--   sqlcmd -S .\SQLEXPRESS -E -d ADMG -i piece-on-vice.sql
-- ===========================================================================
SET NOCOUNT ON;

IF OBJECT_ID('dbo.PIECE_ON_VICE') IS NOT NULL
	PRINT 'PIECE_ON_VICE gia'' presente: niente da fare.';
ELSE BEGIN
	CREATE TABLE dbo.PIECE_ON_VICE (
		VICE_ID				int NOT NULL,
		PIECE_ID			int NOT NULL,
		-- micron, >= 0. Zero e' un valore legittimo: appoggio sulla fine
		-- della ganascia dichiarato anche per un pezzo che sporge.
		STOP_BEYOND_CLAW	int NOT NULL,
		CONSTRAINT PK_PIECE_ON_VICE PRIMARY KEY (VICE_ID, PIECE_ID),
		-- la distanza non puo' essere negativa: il riferimento sta OLTRE la
		-- fine della ganascia, mai prima. Un valore negativo sarebbe un dato
		-- inserito male, non una geometria possibile.
		CONSTRAINT CK_PIECE_ON_VICE_STOP CHECK (STOP_BEYOND_CLAW >= 0)
	);
	PRINT 'PIECE_ON_VICE creata (chiave VICE_ID+PIECE_ID, STOP_BEYOND_CLAW in micron).';
END
GO

-- NB: nessuna FOREIGN KEY verso VICE e PIECE. In questo database le chiavi
-- esterne non ci sono da nessuna parte (vedi FIXTURE_ON_PALLET, WORKORDER):
-- introdurle qui e in un punto solo darebbe un'illusione di integrita' e
-- romperebbe le cancellazioni esistenti, che non se le aspettano. La pulizia
-- delle righe orfane la fa la pagina morsa, che elenca solo pezzi vivi.

-- verifica:
-- SELECT pv.VICE_ID, pv.PIECE_ID, pv.STOP_BEYOND_CLAW,
--        RTRIM(p.FAMILY) AS PEZZO, p.Y AS LUNGO_LA_SPINTA, v.CLAW_LENGTH
--   FROM PIECE_ON_VICE pv
--   JOIN PIECE p ON p.ID = pv.PIECE_ID
--   JOIN VICE  v ON v.ID = pv.VICE_ID;

-- ===========================================================================
-- ROLLBACK (manuale, dopo aver ridistribuito il backend precedente):
-- DROP TABLE dbo.PIECE_ON_VICE;
-- ===========================================================================
