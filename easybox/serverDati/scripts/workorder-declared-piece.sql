-- ===========================================================================
-- workorder-declared-piece.sql — cantiere AG fase 2, C2 (ratificato)
--
-- SCOPO: aggiunge WORKORDER.DECLARED_PIECE_ID (INT NULL) alla BASE TABLE:
-- pezzo DICHIARATO del ramo attrezzatura del wizard (il pezzo e' fisicamente
-- montato sul pallet; PIECE_ID resta 0 per non avviare missioni di carico).
-- Colonna a SOLO USO HMI: il PLC seleziona colonne esplicite dalla view
-- WORKORDERS, che NON la espone — aggiungerla non lo tocca.
--
-- IDEMPOTENTE: riesegui quando vuoi, applica solo se la colonna manca.
--
-- REGOLA IMPIANTO (manuale, NON automatizzare):
--   * dev:   eseguito via sqlcmd il 2026-07-20.
--   * cella: esecuzione MANUALE di Dario (vedi docs/APPUNTI-CELLA.md).
-- ===========================================================================

IF COL_LENGTH('WORKORDER', 'DECLARED_PIECE_ID') IS NOT NULL
BEGIN
    PRINT 'workorder-declared-piece: colonna gia'' presente, nessuna modifica.';
END
ELSE
BEGIN
    PRINT 'workorder-declared-piece: aggiungo DECLARED_PIECE_ID...';
    ALTER TABLE WORKORDER ADD DECLARED_PIECE_ID INT NULL;
    PRINT 'workorder-declared-piece: fatto.';
END
GO

-- ===========================================================================
-- ROLLBACK (eseguire decommentato per tornare indietro):
-- ===========================================================================
-- ALTER TABLE WORKORDER DROP COLUMN DECLARED_PIECE_ID;
