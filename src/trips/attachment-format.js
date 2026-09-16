// Structural format check, not a guarantee that the image/PDF can be decoded.
export function isTripAttachment(value) {
  if (typeof value !== 'string') return false;
  const match = /^data:(?:image\/(?:png|jpeg|webp|gif)|application\/pdf);base64,([A-Za-z0-9+/=\s]+)$/.exec(value);
  if (!match) return false;
  const payload = match[1].replace(/\s/g, '');
  return payload.length > 0 && payload.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(payload);
}
