-- ===========================================================================
-- vice-jaw-check.sql - le righe delle tre viste lette dal PLC, per il
-- confronto PRIMA e DOPO il catalogo delle chele (7/10, prompt 5 di 5)
--
-- SOLO SELECT. Stampa, in ordine fisso, tutte le righe di COORDINATES_Z_MC,
-- COORDINATES_PUSH_MC e COORDINATES_BLOW_MC con tutte le colonne, piu' conteggi
-- e somme di controllo. Si lancia due volte, con l'uscita su due file, e i
-- file si confrontano: dopo vice-jaw.sql e gli script delle viste devono
-- essere IDENTICI (nessun ordine ha ancora chele confermate, e le misure del
-- catalogo sono quelle della morsa). A cella ferma: nessun ordine deve
-- cambiare fra le due letture.
--
-- COMANDI (cella; PowerShell):
--   prima:
--     cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -s "|" -i vice-jaw-check.sql -o D:\Backup\viste_prima_chele.txt
--   dopo:
--     cd D:\Prog\easybox\serverDati\scripts; sqlcmd -S .\SQLEXPRESS -E -d ADMG -W -s "|" -i vice-jaw-check.sql -o D:\Backup\viste_dopo_chele.txt
--   confronto (atteso: nessuna riga stampata, poi "IDENTICHE"):
--     cd D:\Backup; $d = Compare-Object (Get-Content viste_prima_chele.txt) (Get-Content viste_dopo_chele.txt); $d; if (-not $d) { 'IDENTICHE' }
-- Il primo lancio va fatto PRIMA di git pull: lo script viene dal repo, se
-- in cella non c'e' ancora si copia in D:\Backup e si lancia da li' (cd
-- D:\Backup al posto di cd ...\scripts).
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
