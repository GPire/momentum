export function normalizeHex(value) {
  const hex = String(value ?? '').trim().replace(/^#/, '');
  if (/^[\da-f]{3}$/i.test(hex)) return '#' + [...hex].map(c => c + c).join('').toLowerCase();
  return /^[\da-f]{6}$/i.test(hex) ? '#' + hex.toLowerCase() : null;
}
export function hslToHex(h, s, l) {
  h = ((Number(h) % 360) + 360) % 360; s = Math.min(100, Math.max(0, Number(s))) / 100; l = Math.min(100, Math.max(0, Number(l))) / 100;
  const a = s * Math.min(l, 1 - l);
  return '#' + [0, 8, 4].map(n => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0');
  }).join('');
}
export function hexToHsl(value) {
  const hex = normalizeHex(value) || '#e11d48';
  const [r,g,b] = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255);
  const max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min, l=(max+min)/2;
  const h=!d ? 0 : max===r ? ((g-b)/d+6)%6 : max===g ? (b-r)/d+2 : (r-g)/d+4;
  return [Math.round(h*60),Math.round(d ? d/(1-Math.abs(2*l-1))*100 : 0),Math.round(l*100)];
}
export function categoryInk(value) {
  const hex=normalizeHex(value);
  if(!hex) return '#ffffff';
  const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(c=>c<=0.04045 ? c/12.92 : ((c+0.055)/1.055)**2.4);
  return 0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2]>0.179 ? '#10131a' : '#ffffff';
}
