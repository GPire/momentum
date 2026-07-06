

const haptic = type => { 
  try { 
    if (navigator.vibrate) navigator.vibrate(type === 'heavy' ? [40, 15, 40] : 10); 
  } catch(e) {} 
};

const simpleHash = str => { let hash = 0; for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; } return hash.toString(16); };

// Optimized memory-efficient two-row Levenshtein distance
const levenshtein = (a, b) => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  
  let prevRow = Array(b.length + 1);
  let currRow = Array(b.length + 1);
  
  for (let j = 0; j <= b.length; j++) {
    prevRow[j] = j;
  }
  
  for (let i = 1; i <= a.length; i++) {
    currRow[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = (a.charAt(i - 1) === b.charAt(j - 1)) ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1,
        currRow[j - 1] + 1,
        prevRow[j - 1] + cost
      );
    }
    let temp = prevRow;
    prevRow = currRow;
    currRow = temp;
  }
  return prevRow[b.length];
};

const logETL = (msg, error = false) => {
  const logBox = document.getElementById('etl-log-box');
  if (logBox) {
    const p = document.createElement('p');
    p.className = `etl-line ${error ? 'text-[var(--red)]' : ''}`;
    p.textContent = `[${new Date().toLocaleTimeString()}] > ${msg}`;
    logBox.appendChild(p);
    logBox.scrollTop = logBox.scrollHeight;
  }
};

export { haptic, simpleHash, levenshtein, logETL };
