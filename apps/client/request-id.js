let fallbackSequence = 0;

export function createRequestId(cryptoProvider = globalThis.crypto) {
  if (typeof cryptoProvider?.getRandomValues === 'function') {
    const bytes = cryptoProvider.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  fallbackSequence = (fallbackSequence + 1) % Number.MAX_SAFE_INTEGER;
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2).padEnd(10, '0');
  return `${timestamp}-${fallbackSequence.toString(36)}-${randomPart}`;
}
