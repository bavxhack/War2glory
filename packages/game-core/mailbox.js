export const MAIL_RULES = Object.freeze({ subjectLength: 100, bodyLength: 4000, sendsPerMinute: 5 });

export function validateMail(payload) {
  const text = (value, max, label, multiline = false) => {
    if (typeof value !== 'string') throw new Error(`${label} fehlt.`);
    const result = value.trim();
    if (!result || Array.from(result).length > max || (multiline ? /[\x00-\x08\x0b-\x1f\x7f]/ : /[\x00-\x1f\x7f]/).test(result)) throw new Error(`${label}: 1–${max} Zeichen ohne Steuerzeichen.`);
    return result;
  };
  return { recipient: text(payload.recipient, 24, 'Empfänger').normalize('NFKC').toLocaleLowerCase('de-DE'), subject: text(payload.subject, MAIL_RULES.subjectLength, 'Betreff'), body: text(payload.body, MAIL_RULES.bodyLength, 'Nachricht', true) };
}

export function unreadMail(player) {
  const read = new Set(player.mailbox.readReportIds);
  return player.mailbox.messages.filter(message => message.recipientId === player.playerId && message.readAt == null).length
    + player.military.reports.filter(report => !read.has(report.id)).length;
}

export function markMailRead(player, { kind, id }, now) {
  if (kind === 'report') {
    if (!player.military.reports.some(report => report.id === id)) throw new Error('Bericht nicht gefunden.');
    if (!player.mailbox.readReportIds.includes(id)) player.mailbox.readReportIds.push(id);
  } else if (kind === 'message') {
    const message = player.mailbox.messages.find(item => item.id === id);
    if (!message) throw new Error('Nachricht nicht gefunden.');
    if (message.recipientId === player.playerId) message.readAt ??= now;
  } else throw new Error('Ungültiger Postbox-Eintrag.');
}
