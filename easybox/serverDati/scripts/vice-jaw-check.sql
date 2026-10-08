-- ===========================================================================
-- vice-jaw-check.sql - le righe delle viste lette dal PLC, per il confronto
-- PRIMA e DOPO il catalogo delle chele (7/10, prompt 5 di 5; 8/10, prompt 8:
-- anche COORDINATES_PICKPLACE_MC, la missione 16)
--
-- SOLO SELECT. Stampa, in ordine fisso, tutte le righe di COORDINATES_Z_MC,
-- COORDINATES_PUSH_MC, COORDINATES_BLOW_MC e COORDINATES_PICKPLACE_MC con
-- tutte le colonne, piu' conteggi e somme di controllo, e in fondo il
-- marcatore "== FINE ==". Si lancia due volte, con l'uscita su due file, e i
-- file si confrontano: dopo vice-jaw.sql e gli script delle viste devono
-- essere IDENTICI (nessun ordine ha ancora chele confermate, le misure del
-- catalogo sono quelle della morsa e il tipo di riferimento delle battute e'
-- quello montato). A cella ferma: nessun ordine deve cambiare fra le due
-- letture. Le righe identiche NON provano da sole che le viste leggano il
-- catalogo (dopo la migrazione sono uguali per costruzione): lo dice la
-- SELECT del passo 6 della procedura (APPUNTI-CELLA).
--
-- COMANDI (cella; PowerShell; procedura in APPUNTI-CELLA):
--   prima:
--     cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -s "|" -i vice-jaw-check.sql -o D:\Backup\viste_prima_chele.txt
--   dopo:
--     cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -s "|" -i vice-jaw-check.sql -o D:\Backup\viste_dopo_chele.txt
--   confronto (8/10: i due file ci sono, sono uguali byte per byte, senza
--   errori "Msg" e col marcatore di fine; prima Compare-Object diceva
--   IDENTICHE anche con un file mancante):
--     cd D:\Backup; if ((Test-Path viste_prima_chele.txt) -and (Test-Path viste_dopo_chele.txt) -and ((Get-FileHash viste_prima_chele.txt).Hash -eq (Get-FileHash viste_dopo_chele.txt).Hash) -and -not (Select-String -Path viste_dopo_chele.txt -Pattern '^Msg ' -Quiet) -and (Select-String -Path viste_dopo_chele.txt -Pattern '== FINE ==' -Quiet)) { 'IDENTICHE' } else { 'DIVERSE O FILE MANCANTI' }
-- ===========================================================================
SET NOCOUNT ON;

PRINT '== COORDINATES_Z_MC ==';
SELECT COUNT(*) AS righe,
	   CHECKSUM_AGG(BINARY_CHECKSUM(ORDER_ID, MC, Z_PLACE_MC, Z_PICK_MC, Z_POS, Z_PIECE_RAW, Z_PIECE_FIN, Z_FIXTURE, Z_CLAW, Z_SINK_CLAW)) AS somma_controllo
  FROM dbo.COORDINATES_Z_MC;
SELECT ORDER_ID, MC, Z_PLACE_MC, Z_PICK_MC, Z_POS, Z_PIECE_RAW, Z_PIECE_FIN, Z_FIXTURE, Z_CLAW, Z_SINK_CLAW
  FROM dbo.COORDINATES_Z_MC
 ORDER BY ORDER_ID, MC, Z_PLACE_MC, Z_PICK_MC, Z_POS, Z_PIECE_RAW, Z_PIECE_FIN, Z_FIXTURE, Z_CLAW, Z_SINK_CLAW;

PRINT '== COORDINATES_PUSH_MC ==';
SELECT COUNT(*) AS righe,
	   CHECKSUM_AGG(BINARY_CHECKSUM(ORDER_ID, MC, X_PLACE, Y_PLACE, Z_PLACE, X_PUSH, X_STOP, CLEARANCE, STOP_REF, STOP_BEYOND_CLAW, COMP_PUSH, PUSH_ENABLED, PUSH_STATUS, Z_PUSH, Z_PUSH_REF, Z_PUSH_DROP)) AS somma_controllo
  FROM dbo.COORDINATES_PUSH_MC;
SELECT ORDER_ID, MC, X_PLACE, Y_PLACE, Z_PLACE, X_PUSH, X_STOP, CLEARANCE, STOP_REF, STOP_BEYOND_CLAW, COMP_PUSH, PUSH_ENABLED, PUSH_STATUS, Z_PUSH, Z_PUSH_REF, Z_PUSH_DROP
  FROM dbo.COORDINATES_PUSH_MC
 ORDER BY ORDER_ID, MC, X_PLACE, Y_PLACE, Z_PLACE, X_PUSH, X_STOP, CLEARANCE, STOP_REF, STOP_BEYOND_CLAW, COMP_PUSH, PUSH_STATUS, Z_PUSH, Z_PUSH_DROP;

PRINT '== COORDINATES_BLOW_MC ==';
SELECT COUNT(*) AS righe,
	   CHECKSUM_AGG(BINARY_CHECKSUM(ORDER_ID, MC, CLAW_LENGTH, PART_WIDTH, STOP_BEYOND_CLAW, PART_LENGTH, PART_HEIGHT)) AS somma_controllo
  FROM dbo.COORDINATES_BLOW_MC;
SELECT ORDER_ID, MC, CLAW_LENGTH, PART_WIDTH, STOP_BEYOND_CLAW, PART_LENGTH, PART_HEIGHT,
	   CLAW_LENGTH/2 + STOP_BEYOND_CLAW AS X_SUPPORT
  FROM dbo.COORDINATES_BLOW_MC
 ORDER BY ORDER_ID, MC, CLAW_LENGTH, PART_WIDTH, STOP_BEYOND_CLAW, PART_LENGTH, PART_HEIGHT;

-- (8/10) la missione 16 legge le quote Z da COORDINATES_Z_MC
PRINT '== COORDINATES_PICKPLACE_MC ==';
SELECT COUNT(*) AS righe,
	   CHECKSUM_AGG(BINARY_CHECKSUM(ORDER_ID, X, Y, Z_PICK_MC, Z_PLACE_MC, X_ROT, Y_ROT, Z_ROT, APPROACH_TYPE, APPROACH_X, APPROACH_Y, APPROACH_Z)) AS somma_controllo
  FROM dbo.COORDINATES_PICKPLACE_MC;
SELECT ORDER_ID, X, Y, Z_PICK_MC, Z_PLACE_MC, X_ROT, Y_ROT, Z_ROT, APPROACH_TYPE, APPROACH_X, APPROACH_Y, APPROACH_Z
  FROM dbo.COORDINATES_PICKPLACE_MC
 ORDER BY ORDER_ID, X, Y, Z_PICK_MC, Z_PLACE_MC, X_ROT, Y_ROT, Z_ROT, APPROACH_TYPE, APPROACH_X, APPROACH_Y, APPROACH_Z;

-- marcatore di fine: c'e' solo se lo script e' arrivato in fondo
PRINT '== FINE ==';
