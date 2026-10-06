// ============================================================================
// util/alarmCodes.js — lettura dei codici di allarme (pannello v3, fase D)
//
// codiceAllarme: il codice da LOG.descr ("+900011", "23") o da ROBOT/DESCR;
//   '' se il testo non e' un codice.
// scomponiCodice: i codici lunghi sono MissionCode * 100 + errore
//   (docs/ALLARMI-PLC.md): 13599 -> missione 135, errore 99. Vale da 1000 a
//   899999; i codici corti (rifiuti delle dichiarazioni, 9xx) e i 9000xx
//   (database, emergenze) sono altre famiglie. Solo i due numeri: nel
//   pannello non c'e' una tabella dei nomi delle missioni.
// ============================================================================
export function codiceAllarme(d) {
	const m = String(d == null ? '' : d).trim().match(/^\+?(\d+)$/);
	return m ? m[1] : '';
}

export function scomponiCodice(code) {
	const n = Number(code);
	return Number.isInteger(n) && n >= 1000 && n < 900000 ? { mission: Math.floor(n / 100), error: n % 100 } : null;
}
