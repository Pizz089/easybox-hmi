-- ===========================================================================
-- grating-thickness.sql — colonna GRATING.THICKNESS (spessore del grigliato,
-- protezione anti-urto in GENERAZIONE tasche; cantiere 14/9)
--
-- SCOPO: lo spessore fisico della griglia dentro il cassetto, in MICRON
-- (come PIECE.Z_PICK/Z_PLACE con cui viene confrontato; SAFEX/SAFEY restano
-- in mm per eredita'). Regola, applicata da associateGrating (server) e dal
-- dialog Associa/Sostituisci/Rigenera (client) in TUTTI i modi, copia da
-- sorgente compresa:
--   PIECE.Z_PICK  >= THICKNESS + 1000   e   PIECE.Z_PLACE >= THICKNESS + 1000
-- (franco 1 mm). Sotto il minimo la generazione RIFIUTA (KO_Z_BELOW_GRATING)
-- e nessuna riga entra in [POSITION].
--
-- DEFAULT NULL = "non misurato": NULL e 0 NON attivano il vincolo, i
-- grigliati esistenti continuano a funzionare come oggi finche' qualcuno non
-- misura e compila il campo dal form grigliato.
--
-- IDEMPOTENTE (guardia COL_LENGTH). La vista GRATINGS elenca le colonne per
-- nome (nessun SELECT *): nessun sp_refreshview necessario.
--
-- ORDINE DI DEPLOY: PRIMA del backend (insert/update di CONF/Grating.js
-- nominano la colonna). Indipendente da robot-tray-view-v3.sql (tocca solo
-- la vista cassetti): si lanciano nella stessa fermata, in qualsiasi ordine.
--
-- IN CELLA (login plc senza ALTER — manuale, regola APPUNTI-CELLA):
--   sqlcmd -S .\SQLEXPRESS -E -d ADMG -i grating-thickness.sql
-- ===========================================================================
SET NOCOUNT ON;

IF COL_LENGTH('dbo.GRATING', 'THICKNESS') IS NOT NULL
	PRINT 'GRATING.THICKNESS gia'' presente: niente da fare.';
ELSE BEGIN
	ALTER TABLE dbo.GRATING ADD THICKNESS int NULL;
	PRINT 'GRATING.THICKNESS aggiunta (int NULL, micron; NULL = non misurato).';
END

-- verifica:
-- SELECT ID, RTRIM(NAME) AS NAME, SAFEX, SAFEY, THICKNESS FROM GRATING;

-- ===========================================================================
-- ROLLBACK (manuale, solo per tornare indietro — prima ridistribuire il
-- backend precedente, che non nomina la colonna):
-- ALTER TABLE dbo.GRATING DROP COLUMN THICKNESS;
-- ===========================================================================
