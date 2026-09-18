-- ===========================================================================
-- coordinates-blow-mc.sql — vista COORDINATES_BLOW_MC (SOFFIAGGIO, 18/9)
--
-- *** NASCE IN CHIARO, DEFINIZIONE VERSIONATA QUI. ***
-- Come COORDINATES_PUSH_MC, e per lo stesso motivo: le viste 4Robot e
-- WORKORDERS erano CIFRATE ed e' costato ore capire perche' PRODUCTED restava
-- a zero. Nessuna vista nuova di questo progetto sara' mai WITH ENCRYPTION.
--
-- SCOPO: prima di soffiare — sia in DEPOSITO sia in PRELIEVO — il robot deve
-- sapere quanto sono lunghe le chele della morsa e quanto e' largo il pezzo.
-- Il PLC legge questa riga e passa i tre numeri su altrettante variabili
-- PROFINET.
--
-- PERCHE' UNA VISTA E NON UNA QUERY DIRETTA. Con i join scritti a mano la
-- query misurava 298 caratteri contro i 254 di queryTemp nel PLC: sarebbe
-- arrivata TRONCATA, cioe' lo stesso difetto dell'allarme 13599 del 15/9, che
-- non da' errore ma dati sbagliati. Con la vista la query del PLC sta in 96
-- caratteri. La lunghezza qui e' un vincolo di correttezza, non di stile:
-- chiunque aggiunga colonne tenga il SELECT del PLC sotto i 254.
--
-- ISNULL SU TUTTE E TRE LE COLONNE, obbligatorio. Le tre sorgenti sono tutte
-- opzionali (morsa non montata, chele non misurate, nessuna dichiarazione di
-- appoggio) e il ponte SQL verso il PLC NON converte NULL in zero: restituisce
-- valori CASUALI. Uno zero e' leggibile e riconoscibile come "dato assente";
-- un numero casuale finisce in una quota.
--
-- IL JOIN SU PIECE_ON_VICE SEGUE LA MORSA (v.ID), non il pallet — identico a
-- COORDINATES_PUSH_MC: se la morsa si sposta su un altro pallet si porta
-- dietro la sua battuta. Con la chiave sul pallet la dichiarazione resterebbe
-- attaccata al posto e verrebbe applicata in silenzio alla morsa successiva.
--
-- PIECE in INNER JOIN, VICE in LEFT: un ordine ha sempre un pezzo, ma la morsa
-- puo' non esserci. Con PIECE in LEFT si nasconderebbe un dato mancante dietro
-- uno zero; con VICE in INNER l'ordine SPARIREBBE dalla vista e il PLC non
-- leggerebbe niente invece di leggere zero.
--
-- RISCONTRO DI CAMPO, ordine 1105: CLAW_LENGTH 107200, PART_WIDTH 100000,
-- STOP_BEYOND_CLAW 0.
--
-- STATO: la vista e' GIA' CREATA E VERIFICATA IN CELLA (18/9). Questo script
-- arriva dopo, per versionare la definizione: in cella e' un NO-OP e la
-- guardia lo dice. Se invece trova una definizione DIVERSA si FERMA, non
-- sovrascrive: la fonte di verita' e' sys.sql_modules, non il repo (vedi la
-- scheda WORKORDERS in APPUNTI-CELLA).
--
-- ORDINE DI DEPLOY: dopo vice-claw-length.sql e piece-on-vice.sql, che creano
-- le colonne lette qui. A cella ferma, con -E:
--   sqlcmd -S .\SQLEXPRESS -E -d ADMG -i coordinates-blow-mc.sql
-- ===========================================================================
SET NOCOUNT ON;

IF COL_LENGTH('dbo.VICE', 'CLAW_LENGTH') IS NULL
   OR OBJECT_ID('dbo.PIECE_ON_VICE') IS NULL
BEGIN
	PRINT 'MANCANO colonne o tabelle: eseguire prima vice-claw-length.sql e piece-on-vice.sql.';
	SET NOEXEC ON;
END
GO

DECLARE @def NVARCHAR(MAX) = OBJECT_DEFINITION(OBJECT_ID('dbo.COORDINATES_BLOW_MC'));

-- confronto a spazi normalizzati: a capo, tabulazioni e spazi multipli
-- diventano un singolo spazio, cosi' la guardia non dipende da come la
-- definizione e' stata formattata
DECLARE @norm NVARCHAR(MAX) = REPLACE(REPLACE(REPLACE(ISNULL(@def, N''),
	CHAR(13), N' '), CHAR(10), N' '), CHAR(9), N' ');
WHILE CHARINDEX(N'  ', @norm) > 0
	SET @norm = REPLACE(@norm, N'  ', N' ');

IF @def IS NULL
	PRINT 'coordinates-blow-mc: la vista non esiste, la creo.';
-- gia' quella attesa: le tre colonne con ISNULL e il join sulla morsa
ELSE IF @norm LIKE N'%ISNULL(v.CLAW_LENGTH, 0) as CLAW_LENGTH%'
	 AND @norm LIKE N'%ISNULL(pz.Y, 0) as PART_WIDTH%'
	 AND @norm LIKE N'%ISNULL(pv.STOP_BEYOND_CLAW, 0) as STOP_BEYOND_CLAW%'
	 AND @norm LIKE N'%pv.VICE_ID = v.ID and pv.PIECE_ID = w.PIECE_ID%'
BEGIN
	PRINT 'coordinates-blow-mc: vista gia'' presente e conforme, nessuna modifica.';
	SET NOEXEC ON;
END
ELSE
BEGIN
	PRINT 'coordinates-blow-mc: la vista esiste ma NON e'' quella attesa. FERMO.';
	PRINT 'Leggerla con: SELECT definition FROM sys.sql_modules WHERE object_id = OBJECT_ID(''dbo.COORDINATES_BLOW_MC'');';
	PRINT 'e riconciliare a mano: il testo qui sotto sovrascriverebbe modifiche che non conosco.';
	SET NOEXEC ON;
END
GO

IF OBJECT_ID('dbo.COORDINATES_BLOW_MC') IS NULL
	EXEC('CREATE VIEW dbo.COORDINATES_BLOW_MC AS SELECT 1 AS segnaposto');
GO

ALTER VIEW dbo.COORDINATES_BLOW_MC AS
select  w.ID                            as ORDER_ID,
        w.MACHINE_ID                    as MC,
        ISNULL(v.CLAW_LENGTH, 0)        as CLAW_LENGTH,
        ISNULL(pz.Y, 0)                 as PART_WIDTH,
        ISNULL(pv.STOP_BEYOND_CLAW, 0)  as STOP_BEYOND_CLAW
from WORKORDER w
inner join PIECE pz     on pz.ID = w.PIECE_ID
left  join VICE v       on v.PALLET_ID = w.PALLET_ID
left  join PIECE_ON_VICE pv on pv.VICE_ID = v.ID and pv.PIECE_ID = w.PIECE_ID;
GO
PRINT 'coordinates-blow-mc: fatto.';
GO
SET NOEXEC OFF;
GO

-- ===========================================================================
-- VERIFICA
--
-- 1) La riga dell'ordine di collaudo:
--    SELECT * FROM COORDINATES_BLOW_MC WHERE ORDER_ID = 1105;
--    Atteso: CLAW_LENGTH 107200, PART_WIDTH 100000, STOP_BEYOND_CLAW 0.
--
-- 2) Nessuna colonna NULL, su nessun ordine — e' tutto il senso degli ISNULL:
--    SELECT ORDER_ID FROM COORDINATES_BLOW_MC
--     WHERE CLAW_LENGTH IS NULL OR PART_WIDTH IS NULL OR STOP_BEYOND_CLAW IS NULL;
--    Atteso: nessuna riga.
--
-- 3) Un ordine per riga: la vista non deve moltiplicare niente. Se esce una
--    riga, c'e' piu' di una morsa sullo stesso pallet o piu' di una
--    dichiarazione per la stessa coppia morsa+pezzo.
--    SELECT ORDER_ID, COUNT(*) AS righe FROM COORDINATES_BLOW_MC
--     GROUP BY ORDER_ID HAVING COUNT(*) > 1;
--    Atteso: nessuna riga.
--
-- 4) La query che lancera' il PLC, per contarne i caratteri (deve stare sotto
--    i 254 di queryTemp):
--    select CLAW_LENGTH,PART_WIDTH,STOP_BEYOND_CLAW from COORDINATES_BLOW_MC where ORDER_ID=1105
-- ===========================================================================

-- ===========================================================================
-- ROLLBACK (manuale): DROP VIEW dbo.COORDINATES_BLOW_MC;
-- Nessun altro oggetto dipende da questa vista: e' di sola lettura e la
-- consuma il solo PLC.
-- ===========================================================================
