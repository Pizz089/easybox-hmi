// ============================================================================
// socketCommands.js — i comandi non partono a pannello scollegato (7/10
// sera, simulazione bis B54)
//
// socket.io tiene in coda gli emit fatti mentre il pannello e' scollegato e
// li spedisce alla riconnessione; il backend li gira al PLC. Un comando dato
// minuti prima, con la cella in un altro stato, partirebbe da solo appena
// torna il collegamento.
//
// In un punto solo, dove nasce il socket (App.vue):
//   - alla disconnect si tolgono da socket.sendBuffer gli emit dei topic
//     TO_PLANT/CMD/ gia' in coda;
//   - da scollegato un nuovo emit di TO_PLANT/CMD/ non entra nel buffer
//     (si scarta, e lo si dice a chi ascolta onDrop).
// Le richieste di snapshot e di refresh (GRIPPER/REQUEST_SNAPSHOT,
// PLC/REFRESH_REQUEST, UNIT/STATUS/REQUEST...) restano: alla riconnessione
// servono. Lato backend, mqtt.connect con queueQoSZero: false: un comando a
// broker giu' va perso, non ritardato.
// ============================================================================
export const CMD_PREFIX = 'TO_PLANT/CMD/'

export const isCommand = ev => typeof ev === 'string' && ev.startsWith(CMD_PREFIX)

// toglie dal buffer di socket.io i comandi in coda; ritorna quanti ne ha tolti
export function dropBufferedCommands(socket) {
  const buf = Array.isArray(socket && socket.sendBuffer) ? socket.sendBuffer : []
  const resta = buf.filter(p => !(p && Array.isArray(p.data) && isCommand(p.data[0])))
  const tolti = buf.length - resta.length
  if (tolti > 0) socket.sendBuffer = resta
  return tolti
}

// mette la guardia sul socket; onDrop(evento) a ogni comando scartato
export function guardOfflineCommands(socket, { onDrop } = {}) {
  if (!socket || socket.__guardiaComandi) return socket
  socket.__guardiaComandi = true
  socket.on('disconnect', () => {
    const tolti = dropBufferedCommands(socket)
    if (tolti > 0 && onDrop) onDrop('disconnect', tolti)
  })
  const emit = socket.emit.bind(socket)
  socket.emit = (ev, ...args) => {
    if (!socket.connected && isCommand(ev)) {
      if (onDrop) onDrop(ev, 1)
      return socket
    }
    return emit(ev, ...args)
  }
  return socket
}
