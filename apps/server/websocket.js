import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
export const MAX_MESSAGE_BYTES = 16 * 1024;

export class WebSocketPeer extends EventEmitter {
  #buffer = Buffer.alloc(0);
  #closed = false;

  constructor(socket) {
    super();
    this.socket = socket;
    socket.on('data', chunk => this.#consume(chunk));
    socket.on('close', () => this.#finish());
    socket.on('error', () => this.#finish());
  }

  send(value) {
    if (this.#closed) return;
    const body = Buffer.from(JSON.stringify(value));
    const header = body.length < 126
      ? Buffer.from([0x81, body.length])
      : Buffer.from([0x81, 126, body.length >> 8, body.length & 255]);
    this.socket.write(Buffer.concat([header, body]));
  }

  close(code = 1000, reason = '') {
    if (this.#closed) return;
    const text = Buffer.from(reason).subarray(0, 123);
    const body = Buffer.alloc(text.length + 2);
    body.writeUInt16BE(code);
    text.copy(body, 2);
    this.socket.write(Buffer.concat([Buffer.from([0x88, body.length]), body]));
    this.socket.end();
    this.#finish();
  }

  #finish() {
    if (this.#closed) return;
    this.#closed = true;
    this.emit('close');
  }

  #consume(chunk) {
    this.#buffer = Buffer.concat([this.#buffer, chunk]);
    while (this.#buffer.length >= 2) {
      const first = this.#buffer[0];
      const second = this.#buffer[1];
      const opcode = first & 0x0f;
      if (!(first & 0x80) || !(second & 0x80)) return this.close(1002, 'Ungültiger Frame');
      let length = second & 0x7f;
      let offset = 2;
      if (length === 126) {
        if (this.#buffer.length < 4) return;
        length = this.#buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) return this.close(1009, 'Nachricht zu groß');
      if (length > MAX_MESSAGE_BYTES) return this.close(1009, 'Nachricht zu groß');
      if (this.#buffer.length < offset + 4 + length) return;
      const mask = this.#buffer.subarray(offset, offset + 4);
      offset += 4;
      const payload = Buffer.from(this.#buffer.subarray(offset, offset + length));
      this.#buffer = this.#buffer.subarray(offset + length);
      for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4];
      if (opcode === 0x8) return this.close();
      if (opcode === 0x9) {
        this.socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload]));
        continue;
      }
      if (opcode !== 0x1) return this.close(1003, 'Nur Textnachrichten erlaubt');
      this.emit('message', payload.toString('utf8'));
    }
  }
}

export function acceptWebSocket(request, socket, head = Buffer.alloc(0)) {
  const key = request.headers['sec-websocket-key'];
  if (request.headers.upgrade?.toLowerCase() !== 'websocket' ||
      request.headers['sec-websocket-version'] !== '13' || typeof key !== 'string') {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    return null;
  }
  const accept = createHash('sha1').update(key + GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
  const peer = new WebSocketPeer(socket);
  if (head.length) socket.unshift(head);
  return peer;
}
