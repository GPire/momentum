import { SCHEMA_VERSION, $, $$, formatMoney, monthKey } from './core/constants.js';
import { haptic } from './core/utils.js';
import { AudioSynth } from './core/audio.js';
import { getCatById, getCatsByType, VaultDAO } from './core/vault.js';
import { showSignatureAlert, showToast } from './ui/feedback.js';
import { NeuralNexus, AntiFOMO, QuantumRL } from './ai/neural-nexus.js';
import { VoiceCore } from './voice/voice.js';
import { PredictiveOracle } from './predict/oracle.js';
import { initDeviceProfile } from './device/profiler.js';
import { AnomalyDetector, findUnknownMerchants } from './predict/anomaly.js';
import { subscriptionSummary } from './predict/subscriptions.js';
import { getWeeklyStatus } from './predict/weekly-budget.js';
import { getDailySafeToSpend, getAdvisorInsights, getMonthEndProjection, getUpcomingCharges } from './predict/advisor.js';
import { investableSurplus } from './alpha/bridge.js';
import { computeNetWorth, projectNetWorthByStrategy } from './alpha/net-worth.js';
import { taxSetAsideForPeriod, classifyIncome, learnIncomeType, projectAnnualTax, taxAdvice, REGIMI } from './predict/tax.js';
import { computeInvoice, nextInvoiceNumber, suggestFromHistory, detectRecurringClients, renderInvoiceHTML, buildInvoiceEmail, pendingSdiTransmission } from './invoice/invoice-engine.js';
import { invoicePdfBlob, invoiceFilename } from './invoice/invoice-pdf.js';
import { selectableCountries as selectableInvoiceCountries } from './invoice/country-invoicing.js';
import { recommendInvoiceType, missingForFatturaPa, buildFatturaPaXML } from './invoice/fatturapa-xml.js';
import { touchStreak, computeWeeklyRecap, computeGoalProgress, suggestSubscriptionRegistrations } from './predict/engagement.js';
import { banditContext, rankNudges, banditObserve, settleImpressions, mergePendingSameDay, phaseOfMonth, dailySeed, makeRng } from './predict/advisor-bandit.js';
import { inferLifestyle } from './predict/lifestyle.js';
import { ACHIEVEMENTS, computeStats, evaluateAchievements, nextMilestone } from './predict/achievements.js';
import { answerQuestion } from './ai/qa-engine.js';
import { chat as chatMultilingual } from './ai/chat.js';
import { detectLanguage } from './i18n/detect.js';
import { predictAmount, getQuickAddSuggestions, matchSolito } from './predict/amount-memory.js';
import { rankSuggestionsByContext, predictCategoriesNow } from './predict/context-predictor.js';
import { simulateCategoryChange } from './predict/what-if.js';
import { MeshNode, PairingSignaling } from './mesh/mesh-signaling.js';
import { createNexusMeshMind } from './mesh/nexus-adapter.js';
import { appendUpdate, peerReputation } from './mesh/update-ledger.js';
import { computeSyncDigest, transactionsMissingFromPeer } from './mesh/sync.js';
import { encryptBackup, decryptBackup } from './core/backup.js';
import { suggestMonthlyBudget, isBudgetStale } from './predict/budget-advisor.js';
import { handlePDFUpload } from './import/pdf-parser.js';
import { handleScreenshotUpload } from './import/screenshot-parser.js';
import { handleUniversalCSV } from './import/csv-parser.js';
import { importFiles, reconcileModelsWithHistory } from './import/multi-import.js';
// Firma dei modelli AI: cambiala quando spedisci modelli/tecnologie nuove →
// l'app ri-allinea l'AI dai dati preservati dell'utente, senza perdere nulla.
const MODEL_SIGNATURE = 'v10-omega-nano+meso+logreg-dcgn-2026-07';
import { MOMENTUM_TRAINED_MODEL_DATA } from './ai/trained-model-data.js';
import { TrainedCategorizer } from './ai/trained-categorizer.js';
import { TrainedMeso } from './ai/trained-meso.js';
import { HashedLogReg } from './ai/hashed-logreg.js';
import { MomentumOrchestrator } from './ai/orchestrator.js';

const CalendarBridge = {
  createEvent(ev) {
    if (!VaultDAO.state.events) VaultDAO.state.events = [];
    VaultDAO.state.events.push({ id: Date.now() + Math.random(), ...ev, completed: false, category: 'scadenza' });
    VaultDAO.save();
  }
};

// ==========================================
// DEACTIVATED CHATBOT REASONING ENGINE
// ==========================================
window.QuantumReasoningEngine = {
  active: false, // Deactivated on interface
  query(question) {
    const lower = question.toLowerCase();
    // Layer 1: context ingestion
    let thoughtProcess = "[Thought Layer 1] Ingesting financial request...\n";
    
    // Layer 2: analysis
    thoughtProcess += "[Thought Layer 2] Reading ledger nodes and predicting cash flows...\n";
    let totalWealth = 0;
    let inc = 0, exp = 0;
    Object.keys(VaultDAO.state.transactions).forEach(m => {
      VaultDAO.state.transactions[m].forEach(t => {
        if (t.type === 'entrata') inc += t.amount;
        else if (t.type === 'uscita') exp += t.amount;
      });
    });
    totalWealth = inc - exp;

    // Layer 3: proiezione misurata (src/predict/advisor.js) al posto delle
    // vecchie frasi fisse "Buffett/Munger-style" — numeri calcolati sui dati
    // veri dell'utente, mai massime decorative.
    thoughtProcess += "[Thought Layer 3] Projecting month-end from real data...\n";
    const now = new Date();
    const proj = getMonthEndProjection({
      monthTxs: VaultDAO.state.transactions[monthKey(now)] || [],
      monthlyBudget: VaultDAO.state.monthlyBudget,
      referenceDate: now,
      hwDailyLevel: window.__hwDailyLevel ?? null,
    });
    let advice = `Hai speso ${formatMoney(proj.spentSoFar)} questo mese.`;
    if (proj.projectedDelta !== null && proj.daysRemaining > 0) {
      advice += proj.willOverspend
        ? ` Di questo passo lo chiudi a ${formatMoney(proj.projectedDelta)} rispetto al budget (stima ${proj.method === 'holt-winters' ? 'sul tuo andamento reale' : 'sul ritmo di questo mese'}).`
        : ` Di questo passo ti avanzano ${formatMoney(proj.projectedDelta)} a fine mese.`;
    }

    return {
      thoughts: thoughtProcess,
      answer: `[Momentum Core] Capital: ${formatMoney(totalWealth)}. ${advice}`
    };
  }
};

// Punto unico delle risposte in linguaggio naturale (src/ai/qa-engine.js):
// usato sia dalla card "Chiedi a Momentum" sia dalla console.
function askMomentum(text) {
  const ctx = {
    allTx: VaultDAO.state.transactions,
    monthlyBudget: VaultDAO.state.monthlyBudget,
    savingsGoals: VaultDAO.state.savingsGoals,
    referenceDate: new Date(),
    hwDailyLevel: window.__hwDailyLevel ?? null,
    taxRegime: VaultDAO.state.taxRegime,
  };
  // Chatbot multilingua (src/ai/chat.js): se rileva EN/ES risponde in quella
  // lingua; per l'italiano (o intento non coperto dal chat) usa il Q&A
  // completo esistente. Così l'app "arriva" anche in Spagna/LatAm ed EU.
  const det = detectLanguage(text);
  if (det.lang !== 'it') { // EN/ES/FR/DE → chatbot multilingua; IT → Q&A completo
    const r = chatMultilingual(text, ctx);
    if (r.intent !== 'unknown') return { intent: r.intent, answer: r.answer, lang: r.lang };
  }
  return answerQuestion(text, ctx);
}

// Accessible console entry point
window.queryOracleChat = (text) => {
  const res = askMomentum(text);
  console.log(`[intent: ${res.intent}]`);
  console.log(res.answer);
  return res.answer;
};

// ==========================================
// WEBGL ORB CANVAS
// ==========================================
const initWebGLOrb = (canvasId, balance=0, freqScore=0) => {
  const normalizeFreq = (val) => {
    if (val > 1.0) return 0.1 + ((100 - Math.min(val, 100)) * 0.005);
    return Math.min(Math.max(val, 0.05), 0.6);
  };

  const canvas = document.getElementById(canvasId); if (!canvas || !window.THREE) return;
  if (canvas._orbApp) { 
    try {
      canvas._orbApp.mat.uniforms.balance.value = balance; 
      canvas._orbApp.mat.uniforms.disciplineFreq.value = normalizeFreq(freqScore); 
    } catch(e) {}
    return; 
  }
  
  try {
    const updateSize = () => {
       const p = canvas.parentElement;
       if(p) { const rect = p.getBoundingClientRect(); canvas.width = rect.width || window.innerWidth; canvas.height = rect.height || 300; if(canvas._orbApp) { canvas._orbApp.camera.aspect = canvas.width / canvas.height; canvas._orbApp.camera.updateProjectionMatrix(); canvas._orbApp.renderer.setSize(canvas.width, canvas.height, false); } }
    };

    const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000); camera.position.z = 2.4;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    window.addEventListener('resize', updateSize); 
    
    const geo = new THREE.SphereGeometry(1.2, 64, 64);
    const mat = new THREE.ShaderMaterial({
      vertexShader: `varying vec3 v_Normal; void main(){v_Normal=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `
        uniform float time; uniform float balance; uniform float disciplineFreq; varying vec3 v_Normal;
        void main(){
          float bf = clamp(balance/2000.0, -1.0, 1.0)*0.5+0.5;
          float turb = (1.0-bf)*0.5 + disciplineFreq;
          float dist = sin(v_Normal.x*5.0+time*turb*2.0)*0.5+cos(v_Normal.y*3.0-time*turb)*0.5;
          float bp = sin((v_Normal.z+time*0.1)*8.0+dist*4.0)*0.5+0.5;
          
          vec3 cRed=vec3(0.9,0.1,0.2); vec3 cBlue=vec3(0.3,0.4,0.9); vec3 cGold=vec3(0.9,0.7,0.1);
          vec3 baseColor = mix(cRed, cBlue, bf);
          if(balance > 4000.0) baseColor = mix(cBlue, cGold, clamp((balance-4000.0)/8000.0, 0.0, 1.0));
          
          vec3 fc = mix(baseColor, vec3(0.00,0.00,0.00), bp); 
          fc = mix(fc, vec3(1.0), v_Normal.z*0.3+0.2); float fr = pow(1.0-abs(v_Normal.z), 4.0);
          fc += fr * mix(vec3(0.9,0.5,0.3), vec3(0.3,0.5,0.9), bf);
          gl_FragColor = vec4(fc, 1.0 - pow(length(v_Normal.xy),2.0) + fr*0.4);
        }`,
      uniforms: { time:{value:0}, balance:{value:balance}, disciplineFreq:{value:normalizeFreq(freqScore)} },
      transparent: true, blending: THREE.NormalBlending, depthWrite: false
    });
    
    const orb = new THREE.Mesh(geo, mat); scene.add(orb); canvas._orbApp = { scene, camera, renderer, mat, orb, active: true };
    
    const obs = new IntersectionObserver(ents => { if(canvas._orbApp) canvas._orbApp.active = ents[0].isIntersecting; }); obs.observe(canvas);
    window.orbFreqTrigger = (disciplineScore) => { const freq = 0.1 + ((100 - disciplineScore) * 0.005); if(canvas._orbApp && canvas._orbApp.mat) canvas._orbApp.mat.uniforms.disciplineFreq.value = freq; };

    let isDrag=false, pX=0, pY=0;
    canvas.addEventListener('mousedown', e=>{isDrag=true; pX=e.clientX; pY=e.clientY;}); canvas.addEventListener('touchstart', e=>{isDrag=true; pX=e.touches[0].clientX; pY=e.touches[0].clientY;}, {passive:true});
    document.addEventListener('mouseup', ()=>isDrag=false); document.addEventListener('touchend', ()=>isDrag=false);
    document.addEventListener('mousemove', e=>{if(isDrag){ orb.rotation.y+=(e.clientX-pX)*0.01; orb.rotation.x+=(e.clientY-pY)*0.01; pX=e.clientX; pY=e.clientY; }});
    document.addEventListener('touchmove', e=>{if(isDrag){ orb.rotation.y+=(e.touches[0].clientX-pX)*0.01; orb.rotation.x+=(e.touches[0].clientY-pY)*0.01; pX=e.touches[0].clientX; pY=e.touches[0].clientY; }}, {passive:true});
    const clock = new THREE.Clock(); const animate = () => { requestAnimationFrame(animate); if(!canvas._orbApp || !canvas._orbApp.active) return; mat.uniforms.time.value = clock.getElapsedTime(); if(!isDrag){ orb.rotation.y+=0.002; orb.rotation.x+=0.001; } renderer.render(scene, camera); }; animate();
    updateSize();
  } catch (err) {
    console.warn("WebGL initialization failed:", err);
  }
};

// ==========================================
// DYNAMIC INTERACTIVE FORM LAYOUT
// ==========================================
const buildCatChipsHTML = (type) => {
  return getCatsByType(type).map(c => `
    <button type="button" class="cat-chip" data-cat-id="${c.id}" style="--chip-color:${c.color};--chip-bg:${c.color}22">
      <div class="cat-chip-icon" style="background:${c.color}">${c.icon}</div>
      <span class="cat-chip-label">${c.name}</span>
    </button>
  `).join('');
};

const getTxFormHTML = () => `
  <div class="flex flex-col h-full bg-[var(--surface-solid)] lg:bg-[var(--surface)] p-3 sm:p-5 lg:p-0 rounded-2xl relative min-h-0">
    
    <!-- NLP Prediction preview & AntiFOMO warnings -->
    <div id="ai-insight-panel" class="ai-insight-panel">
       <div class="ai-insight-header"><span class="inline-flex items-center gap-1.5"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M5 3v4M3 5h4M6 17v4M4 19h4M13 3l2.5 6.5L22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5z"/></svg>Categoria suggerita</span><span id="ai-cat-badge" class="truncate max-w-[120px]">Cat</span></div>
       <div class="text-[9px] font-mono text-[var(--on-surface-secondary)] mb-1">Sicurezza: <span class="ml-confidence" id="ml-confidence-score">0%</span></div>
       <div class="ai-insight-body" id="ai-insight-text">Sto guardando cosa hai scritto...</div>
       <div class="ai-insight-action" id="ai-insight-btn">Usa questo suggerimento</div>
    </div>

    <div class="type-toggle-track mb-3 shrink-0">
      <button type="button" class="type-toggle-pill active-expense" data-type="uscita">Uscita</button>
      <button type="button" class="type-toggle-pill" data-type="entrata">Entrata</button>
      <button type="button" class="type-toggle-pill" data-type="invest">Investi</button>
    </div>

    <!-- Tasti rapidi (src/predict/amount-memory.js): gli acquisti abituali
         con importo stabile — un tocco compila tutto, un secondo conferma -->
    <div id="quick-add-row" class="flex gap-2 overflow-x-auto mb-2 shrink-0 hidden"></div>

    <div class="amount-stage shrink-0">
      <div class="flex items-center justify-center">
        <span class="text-2xl font-mono text-[var(--on-surface-secondary)] mr-1">€</span>
        <div class="amount-display amount-negative" id="tx-amount-display">0</div>
      </div>
    </div>

    <div class="cat-scroll-wrapper shrink-0">
      <div class="flex gap-2.5 px-2 w-max" id="cat-scroll">${buildCatChipsHTML('uscita')}</div>
    </div>

    <div class="desc-input-wrap mt-3 mb-2 shrink-0">
      <input type="text" id="tx-desc" class="desc-input" placeholder="Aggiungi nota descrittiva..." autocomplete="off">
    </div>
    
    <div class="smart-toggles-row mb-3 shrink-0">
       <div class="neuro-pill-btn" id="date-pill-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 3v3M16 3v3"/></svg>
          <span id="date-pill-text" class="truncate">Oggi</span>
          <input type="date" id="tx-date-input" class="native-date-input" max="${new Date().toISOString().split('T')[0]}">
       </div>
    </div>

    <div class="numpad-grid mt-auto flex-1 min-h-[220px]">
      ${[7,8,9,4,5,6,1,2,3].map(n=>`<button type="button" class="numpad-key h-full min-h-0" data-num="${n}">${n}</button>`).join('')}
       <button type="button" class="numpad-key text-[var(--red)] font-bold h-full min-h-0 flex items-center justify-center" id="voice-rec-btn">
         <svg class="w-6 h-6 stroke-current" fill="none" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"/></svg>
       </button>
      <button type="button" class="numpad-key h-full min-h-0" data-num="0">0</button>
      <button type="button" class="numpad-key text-[var(--red)] font-black h-full min-h-0" data-num="DEL">DEL</button>
    </div>

    <button type="button" class="save-btn mt-3 shrink-0" id="save-tx-btn" disabled>Conferma</button>
  </div>
`;

const attachFormListeners = (container) => {
  let type = 'uscita';
  let rawVal = '';
  let catId = null;
  let selectedDate = new Date();
  
  const desc = container.querySelector('#tx-desc');
  const aiPanel = container.querySelector('#ai-insight-panel');
  const aiCatBadge = container.querySelector('#ai-cat-badge');
  const aiText = container.querySelector('#ai-insight-text');
  const aiBtn = container.querySelector('#ai-insight-btn');

  window.updateRawVal = (val) => {
    rawVal = val;
    updateAmount();
  };

  const updateAmount = () => {
    const d = container.querySelector('#tx-amount-display');
    if (d) d.textContent = rawVal || '0';
    d.className = `amount-display ${type==='entrata'?'amount-positive':type==='invest'?'amount-invest':'amount-negative'} truncate px-2`;
    
    const amt = parseFloat(rawVal) || 0;
    const saveBtn = container.querySelector('#save-tx-btn');
    
    // QuantumRL friction trigger
    const friction = QuantumRL.getFriction(amt, catId);
    if (friction.level === 'block') {
      saveBtn.classList.add('danger-friction');
      saveBtn.textContent = "ATTENZIONE: Spesa Bloccata";
    } else {
      saveBtn.classList.remove('danger-friction');
      saveBtn.textContent = "Conferma";
    }

    updateSaveBtn();
  };

  const updateSaveBtn = () => {
    const btn = container.querySelector('#save-tx-btn');
    if (btn) btn.disabled = !(parseFloat(rawVal) > 0 && catId);
  };

  // Voice Activation
  const voiceBtn = container.querySelector('#voice-rec-btn');
  if (voiceBtn) {
    VoiceCore.init(container);
    voiceBtn.onclick = () => VoiceCore.toggle();
  }

  // Input prediction and anti-FOMO check
  if (desc) {
    desc.addEventListener('input', () => {
      const val = desc.value.trim();
      if (val.length < 3) {
        aiPanel.classList.remove('active');
        return;
      }
      
      // Anti-FOMO Check
      if (AntiFOMO.scan(val)) {
        aiCatBadge.textContent = "ATTENZIONE";
        aiText.innerHTML = `<span class="text-red-500 font-bold">Rilevata spesa d'impulso (FOMO). Ti consigliamo di attendere 24 ore prima di confermare.</span>`;
        aiPanel.classList.add('active', 'anomalous');
        aiBtn.style.display = 'none';
        return;
      }

      const amt = parseFloat(rawVal) || 0;
      const pred = window.momentumOrchestrator
        ? window.momentumOrchestrator.classify(val, amt, selectedDate)
        : NeuralNexus.predict(val, amt, selectedDate);
      
      if (pred) {
        const pCat = getCatById(pred.cat);
        // Astensione (orchestrator): quando l'AI "sa di non sapere" propone
        // comunque la sua ipotesi migliore ma lo dice chiaramente e invita
        // l'utente a confermare — meglio di una categoria forzata sbagliata.
        aiCatBadge.textContent = pred.abstain ? `${pCat.name}?` : pCat.name;
        aiText.textContent = pred.abstain
          ? pred.advice
          : `${pred.advice} (sicurezza ${pred.confidence}%)`;
        aiPanel.classList.add('active');
        aiPanel.classList.remove('anomalous');
        aiBtn.style.display = 'block';
        
        // Real-time dynamic auto-categorization
        const predictedCatId = pred.cat;
        const predictedType = pCat.type;
        
        if (type !== predictedType) {
          type = predictedType;
          container.querySelectorAll('.type-toggle-pill').forEach(b => b.classList.remove('active-expense','active-income','active-invest'));
          const tPill = container.querySelector(`[data-type="${type}"]`);
          if (tPill) {
            tPill.classList.add(type==='uscita'?'active-expense':type==='entrata'?'active-income':'active-invest');
          }
          const scroll = container.querySelector('#cat-scroll');
          if (scroll) {
            scroll.innerHTML = buildCatChipsHTML(type);
            attachCatClick();
          }
        }

        catId = predictedCatId;
        const chip = container.querySelector(`[data-cat-id="${catId}"]`);
        if (chip) {
          container.querySelectorAll('.cat-chip').forEach(el=>el.classList.remove('selected'));
          chip.classList.add('selected');
          chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
        updateAmount();
        
        aiBtn.onclick = () => {
          aiPanel.classList.remove('active');
          haptic('heavy');
        };
      }
    });
  }

  // Toggles
  container.querySelectorAll('.type-toggle-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      haptic('light');
      type = btn.dataset.type;
      catId = null;

      container.querySelectorAll('.type-toggle-pill').forEach(b => b.classList.remove('active-expense','active-income','active-invest'));
      btn.classList.add(type==='uscita'?'active-expense':type==='entrata'?'active-income':'active-invest');

      const scroll = container.querySelector('#cat-scroll');
      if (scroll) {
        scroll.innerHTML = buildCatChipsHTML(type);
        attachCatClick();
      }
      
      // Stipendio Auto-1step flow
      if (type === 'entrata') {
        catId = 'stipendio';
        setTimeout(() => {
          const stipChip = container.querySelector('[data-cat-id="stipendio"]');
          if (stipChip) stipChip.classList.add('selected');
        }, 50);
      }
      updateAmount();
    });
  });

  const attachCatClick = () => {
    container.querySelectorAll('.cat-chip').forEach(c => {
      c.addEventListener('click', () => {
        haptic('light');
        AudioSynth.play('click');
        catId = c.dataset.catId;
        container.querySelectorAll('.cat-chip').forEach(el => el.classList.remove('selected'));
        c.classList.add('selected');
        // Memoria importi (src/predict/amount-memory.js): se per questa
        // categoria/descrizione la cifra è sempre la stessa (es. sigarette),
        // si precompila da sola — l'utente può sempre cancellarla col DEL.
        // Solo a importo vuoto e con confidenza alta: mai sovrascrivere
        // quello che l'utente ha già digitato, mai indovinare.
        if (!rawVal) {
          const hint = predictAmount(catId, desc?.value || '', VaultDAO.state.transactions);
          if (hint && hint.confidence === 'alta') {
            rawVal = String(hint.amount);
          }
        }
        updateAmount();
      });
    });
  };
  attachCatClick();

  // Tasti rapidi: un tocco compila tipo+categoria+descrizione+importo,
  // il secondo tocco su "Conferma" registra. Appaiono solo se nei
  // dati esistono acquisti abituali con cifra stabile.
  const quickRow = container.querySelector('#quick-add-row');
  if (quickRow) {
    // Ordinati per probabilità ADESSO (context-predictor.js): il caffè in
    // cima alle 8, la spesa in cima il sabato — il primo posto è spiegato.
    const suggestions = rankSuggestionsByContext(
      getQuickAddSuggestions(VaultDAO.state.transactions),
      VaultDAO.state.transactions,
      new Date()
    );
    if (suggestions.length > 0) {
      quickRow.classList.remove('hidden');
      quickRow.innerHTML = suggestions.map((s, i) => `
        <button type="button" class="neuro-pill-btn shrink-0" data-quick-idx="${i}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 shrink-0"><path d="M13 2L4.5 13.5H12l-1 8.5 8.5-11.5H12z"/></svg><span class="truncate max-w-[110px]">${s.description}</span>
          <span class="font-mono font-bold">${formatMoney(s.amount)}</span>
          ${i === 0 && s.reason ? `<span class="text-[9px] opacity-60">${s.reason}</span>` : ''}
        </button>
      `).join('');
      quickRow.querySelectorAll('[data-quick-idx]').forEach(btn => {
        btn.addEventListener('click', () => {
          const s = suggestions[parseInt(btn.dataset.quickIdx)];
          haptic('light');
          AudioSynth.play('click');
          const typeBtn = container.querySelector(`[data-type="${s.type}"]`);
          if (typeBtn && type !== s.type) typeBtn.click();
          catId = s.category;
          container.querySelectorAll('.cat-chip').forEach(el =>
            el.classList.toggle('selected', el.dataset.catId === s.category));
          if (desc) desc.value = s.description;
          rawVal = String(s.amount);
          updateAmount();
        });
      });
    }
  }

  // ── PREDIZIONE CONTESTUALE DI CATEGORIA (context-predictor): riconosce la
  // fascia oraria/giorno in cui SOLITAMENTE spendi e in COSA, ed evidenzia la
  // chip giusta (direzione dell'occhio) + pre-compila l'importo tipico al tocco
  // se il campo è vuoto → inserisci una spesa abituale in un tocco. Onesto: solo
  // con un pattern temporale netto (altrimenti tace, niente forzature). ──
  try {
    const ctx = predictCategoriesNow(VaultDAO.state.transactions, new Date());
    if (ctx.topPick && type === 'uscita') {
      const chip = container.querySelector(`[data-cat-id="${ctx.topPick.category}"]`);
      if (chip) {
        chip.classList.add('context-now');
        chip.setAttribute('title', `Di solito ${ctx.topPick.reason}${ctx.topPick.typicalAmount ? ` · ~${formatMoney(ctx.topPick.typicalAmount)}` : ''}`);
        chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        // al tocco: se non hai ancora scritto un importo, pre-compilo quello tipico
        chip.addEventListener('click', () => {
          if ((!rawVal || rawVal === '0') && ctx.topPick.typicalAmount) {
            rawVal = String(ctx.topPick.typicalAmount);
            updateAmount();
          }
        });
      }
    }
  } catch (_) { /* predizione assente: il form funziona identico */ }

  // Numpad key triggers
  container.querySelectorAll('.numpad-key').forEach(btn => {
    if (btn.id === 'voice-rec-btn') return;
    btn.addEventListener('click', () => {
      haptic('light');
      AudioSynth.play('click');
      const v = btn.dataset.num;
      if (v === 'DEL') {
        rawVal = rawVal.slice(0, -1);
      } else {
        if (rawVal === '0') rawVal = v;
        else rawVal += v;
      }
      updateAmount();
    });
  });

  // Confirm Ledger Save
  container.querySelector('#save-tx-btn').onclick = () => {
    const amt = parseFloat(rawVal);
    if (!amt || !catId) return;
    
    // Active friction block check on click
    const friction = QuantumRL.getFriction(amt, catId);
    if (friction.level === 'block') {
      AudioSynth.play('friction');
      haptic('heavy');
      showToast("Ho messo un piccolo freno: sei in modalità Deciso. Tocca di nuovo se vuoi procedere.", "error");
      return;
    }

    haptic('heavy');
    AudioSynth.play('success');
    const k = monthKey(selectedDate);
    
    const { route } = VaultDAO.addTransaction(k, {
      id: Date.now(),
      amount: amt,
      type,
      category: catId,
      description: desc?.value || getCatById(catId).name,
      date: selectedDate.toISOString()
    });

    if (window.momentumOrchestrator) {
      window.momentumOrchestrator.learn(desc?.value || getCatById(catId).name, catId, amt, selectedDate);
    } else {
      NeuralNexus.train(desc?.value || getCatById(catId).name, catId, amt, selectedDate);
    }
    showToast("Movimento salvato.", "success");
    updateStreak();
    evaluateAndCelebrateAchievements();
    closeModal();
    renderDashboard();
    renderAnalysis({ skipHeavyForecast: route === 'fast' });
  };
};

// Stato del "modello globale emergente" (src/mesh/update-ledger.js): rende
// visibile e concreta la crescita collettiva — esempi totali su cui l'AI di
// questo dispositivo è addestrata, dispositivi fidati collegati, e la
// reputazione dei peer dalla catena hash. Non teoria: numeri veri.
function renderMeshStatus() {
  const el = document.getElementById('mesh-status');
  if (!el) return;
  const peers = window.momentumMeshNode?.peers?.size || 0;
  const examples = VaultDAO.state.mlData?.totalWords || 0;
  const ledger = VaultDAO.state.updateLedger || [];
  if (peers === 0) {
    el.innerHTML = `Nessun dispositivo collegato: l'AI impara solo da questo (${examples} esempi finora).`;
    return;
  }
  const merges = ledger.filter(e => e.accepted).length;
  const rejected = ledger.length - merges;
  el.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1.5 align-middle"></span>${peers} dispositivo/i fidato/i collegato/i · modello su <b>${examples}</b> esempi · ${merges} fusioni accettate${rejected > 0 ? `, ${rejected} rifiutate (anti-manomissione)` : ''}.`;
}

// Web Share Target (Android): il SW ha parcheggiato lo screenshot condiviso
// nella cache come './__shared-image' e ci ha aperti con ?shared=1. Qui lo
// si raccoglie, si pulisce URL e mailbox (mai ri-consumare al reload) e lo
// si instrada nell'OCR esistente — identico all'upload manuale.
// Su iOS questo flusso non esiste (Apple non supporta share_target per PWA).
async function consumeSharedImage() {
  try {
    if (!new URLSearchParams(location.search).has('shared')) return;
    history.replaceState(null, '', './index.html');
    const cache = await caches.open('momentum-vault-v52'); // stesso APP_CACHE di sw.js
    const res = await cache.match('./__shared-image');
    if (!res) return;
    await cache.delete('./__shared-image');
    const blob = await res.blob();
    const result = await handleScreenshotUpload(blob);
    if (result) {
      renderDashboard();
      renderAnalysis({ skipHeavyForecast: result.route === 'fast' });
    }
  } catch (e) { console.warn('Immagine condivisa non recuperabile:', e); }
}

// Streak (src/predict/engagement.js): pura fuori, stato del vault dentro —
// salva solo se il giorno è davvero cambiato.
function updateStreak() {
  const next = touchStreak(VaultDAO.state.engagement);
  if (next.changed) {
    const { changed, ...engagement } = next;
    VaultDAO.state.engagement = engagement;
    VaultDAO.save();
  }
}

// Traguardi (src/predict/achievements.js): riconoscimento onesto dei fatti
// misurati. Celebra i NUOVI sblocchi (toast + haptic + suono), idempotente:
// mai due volte lo stesso. Chiamato dopo ogni transazione/import.
function evaluateAndCelebrateAchievements() {
  const stats = computeStats(VaultDAO.state, new Date());
  const { unlocked, newly } = evaluateAchievements(VaultDAO.state.achievements || {}, stats);
  if (newly.length) {
    VaultDAO.state.achievements = unlocked;
    VaultDAO.save();
    for (const id of newly) {
      const a = ACHIEVEMENTS.find(x => x.id === id);
      if (a) showToast(`Traguardo raggiunto: ${a.name}!`, 'success');
    }
    try { haptic('heavy'); AudioSynth.play('success'); } catch (_) {}
  }
}

const openTransactionModal = () => {
  openModal(getTxFormHTML());
  attachFormListeners($('#modal-body'));
};

// ==========================================
// RENDERS
// ==========================================
const renderDashboard = () => {
  let score = 400;
  try { score = PredictiveOracle.calculateMomentumScore(); } catch(e) {}
  
  const realNow = new Date();
  const isCurrentMonth = VaultDAO.state.currentDate.getFullYear() === realNow.getFullYear() && VaultDAO.state.currentDate.getMonth() === realNow.getMonth();
  const nextBtn = $('#next-month-btn');
  if (nextBtn) {
    nextBtn.style.opacity = isCurrentMonth ? '0.2' : '1';
    nextBtn.style.pointerEvents = isCurrentMonth ? 'none' : 'auto';
  }

  const k = monthKey(VaultDAO.state.currentDate);
  const display = $('#current-month-display');
  if (display) {
    const label = VaultDAO.state.currentDate.toLocaleDateString('it-IT', {month:'long', year:'numeric'});
    // Micro-interazione intelligente: fuori dal mese corrente il titolo diventa
    // un tap-target per tornare a oggi (affordance visibile solo quando serve:
    // pallino pulsante + cursore). Nel mese corrente è testo normale, zero rumore.
    if (isCurrentMonth) {
      display.textContent = label;
      display.removeAttribute('data-action');
      display.style.cursor = '';
      display.title = '';
    } else {
      const dir = VaultDAO.state.currentDate < realNow ? 'passato' : 'futuro';
      display.innerHTML = `${label} <span class="inline-block w-1.5 h-1.5 rounded-full bg-[var(--gold)] align-middle ml-1 animate-pulse"></span>`;
      display.dataset.action = 'jump-today';
      display.style.cursor = 'pointer';
      display.title = `Stai guardando un mese ${dir} — tocca per tornare a oggi`;
    }
  }
  const txs = VaultDAO.state.transactions[k] || [];

  let inc = 0, exp = 0, inv = 0;
  txs.forEach(t => {
    if (t.type === 'entrata') inc += t.amount;
    else if (t.type === 'uscita') exp += t.amount;
    else inv += t.amount;
  });
  const liquidity = inc - exp;

  $('#total-income').textContent = formatMoney(inc);
  $('#total-expense').textContent = formatMoney(exp);
  $('#total-liquidity').textContent = formatMoney(liquidity);
  $('#total-invest').textContent = formatMoney(inv);

  // "Oggi puoi spendere": sempre riferito a OGGI reale — guardando un mese
  // diverso la card sparisce invece di mostrare un numero fuori contesto.
  // Linguaggio e colori semantici volutamente elementari (verde = puoi,
  // rosso = fermati): è il numero che deve capire chiunque al primo sguardo.
  const stsCard = $('#safe-to-spend-card');
  if (stsCard) {
    const sts = isCurrentMonth
      ? getDailySafeToSpend({ monthTxs: txs, allTx: VaultDAO.state.transactions, monthlyBudget: VaultDAO.state.monthlyBudget, referenceDate: realNow })
      : null;
    if (!sts) {
      stsCard.classList.add('hidden');
    } else {
      stsCard.classList.remove('hidden');
      if (sts.isOverBudget) {
        stsCard.style.borderTop = '3px solid var(--red)';
        stsCard.innerHTML = `
          <p class="text-[10px] font-extrabold uppercase tracking-widest text-rose-400 mb-1">Oggi meglio non spendere</p>
          <p class="text-3xl sm:text-4xl font-black font-mono text-rose-400 tracking-tighter">0€</p>
          <p class="text-[11px] text-[var(--on-surface-secondary)] mt-1">Questa settimana sei oltre di ${formatMoney(Math.abs(sts.weekRemaining))}. Ogni giorno senza spese ti rimette in pari.</p>
        `;
      } else {
        const chargeNote = sts.reservedForCharges > 0
          ? ` · ${formatMoney(sts.reservedForCharges)} già da parte per gli abbonamenti in arrivo`
          : '';
        stsCard.style.borderTop = '3px solid var(--green)';
        stsCard.innerHTML = `
          <p class="text-[10px] font-extrabold uppercase tracking-widest text-[var(--on-surface-secondary)] mb-1">Oggi puoi spendere</p>
          <p class="text-3xl sm:text-4xl font-black font-mono text-emerald-400 tracking-tighter">${formatMoney(sts.safeToday)}</p>
          <p class="text-[11px] text-[var(--on-surface-secondary)] mt-1">${formatMoney(sts.weekRemaining)} rimasti per questa settimana (${sts.daysLeftInWeek} giorni)${chargeNote}</p>
        `;
      }
    }
  }

  // ── Riga-insight umana della Dashboard: UNA sola cosa notata, in una riga
  // semplice (principio "un bambino di 8 anni"): priorità alla dopamina
  // anticipatoria (traguardo vicino), poi al pattern di vita del mese. Il
  // dettaglio completo resta in Analisi — qui è solo l'headline, mai un muro.
  const insightEl = $('#dashboard-insight');
  if (insightEl) {
    // NEURODESIGN (skill neuro-copy, applicata a favore dell'utente): il
    // colore È il significato. Verde = comportamento sano (rinforzo positivo,
    // dopamina). Ambra = "momento consapevole" — micro-frizione gentile sugli
    // spend fuori-norma (l'INVERSO del supermercato: non spinge a spendere,
    // invita a fermarsi un attimo). Oro = traguardo (anticipazione). MAI
    // rosso/vergogna sulla persona (ansia → abbandono). Tono: agency, numeri
    // specifici, presente. Una riga sola, zero disordine.
    const TONE = {
      gold:   { bd: 'border-amber-500/25', bg: 'bg-amber-950/10', tx: 'text-amber-200' },
      green:  { bd: 'border-emerald-500/25', bg: 'bg-emerald-950/10', tx: 'text-emerald-200' },
      amber:  { bd: 'border-orange-500/25', bg: 'bg-orange-950/10', tx: 'text-orange-200' },
      calm:   { bd: 'border-[var(--glass-border)]', bg: 'bg-[var(--surface-elevated)]/40', tx: 'text-slate-300' },
    };
    // Icone SVG coerenti (stesso tratto del resto dell'app), MAI emoji a caso.
    const S = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 shrink-0">${p}</svg>`;
    const ICON = {
      goal: S('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="0.6"/>'),      // traguardo (bersaglio)
      green: S('<path d="M11 20A7 7 0 0 1 4 13c0-4 3-6 3-6s2 1 3 3c1-4 4-6 4-6s3 4 3 9a7 7 0 0 1-6 7z"/>'),               // comportamento sano (foglia)
      amber: S('<circle cx="12" cy="12" r="9"/><polygon points="15.5 8.5 10.5 10.5 8.5 15.5 13.5 13.5"/>'),               // momento consapevole (bussola)
      calm: S('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.3 1 2.5h6c0-1.2.4-1.9 1-2.5A6 6 0 0 0 12 3z"/>'),   // spunto (lampadina)
    };
    const POSITIVE = new Set(['investor-habit', 'home-cooking', 'social-quiet']);
    const CAUTION = new Set(['shopping-surge', 'social-active', 'on-the-move']);
    let line = null;
    if (isCurrentMonth) {
      const aStats = computeStats(VaultDAO.state, realNow);
      const nm = nextMilestone(VaultDAO.state.achievements || {}, aStats);
      if (nm && nm.pct >= 0.6) {
        const manca = nm.target - nm.current;
        // Descrive il COMPORTAMENTO in parole di tutti (niente nomi-badge né
        // "sblocchi"): cosa fare + a che punto sei. Neuro-copy: anticipazione,
        // agency, zero vergogna.
        const goal = String(nm.desc || '').replace(/\.$/, '');
        line = { icon: ICON.goal, tone: 'gold', text: `Ci sei quasi: ${goal}. Sei a <b>${nm.current} di ${nm.target}</b>${manca === 1 ? ', ne manca 1!' : `, ne mancano ${manca}.`}` };
      } else {
        const life = inferLifestyle({ allTx: VaultDAO.state.transactions, referenceDate: realNow });
        if (life.patterns.length) {
          const p = life.patterns[0];
          const tone = POSITIVE.has(p.id) ? 'green' : CAUTION.has(p.id) ? 'amber' : 'calm';
          // ambra = momento consapevole: invito gentile a fermarsi, mai un giudizio.
          const tail = tone === 'amber' ? ' <span class="opacity-70">— solo per consapevolezza, la scelta è tua.</span>' : '';
          line = { icon: ICON[tone] || ICON.calm, tone, text: `<b>${p.label}.</b> ${p.evidence}${tail}` };
        } else if (nm && nm.pct >= 0.3) {
          const goal = String(nm.desc || '').replace(/\.$/, '');
          line = { icon: ICON.goal, tone: 'gold', text: `Prossimo obiettivo: ${goal}. Sei a <b>${nm.current} di ${nm.target}</b>.` };
        }
      }
    }
    if (line) {
      const t = TONE[line.tone] || TONE.calm;
      insightEl.classList.remove('hidden');
      insightEl.innerHTML = `<div class="flex items-center gap-2.5 px-4 py-2.5 rounded-xl ${t.bg} border ${t.bd} text-[13px] ${t.tx}">${line.icon}<span class="min-w-0">${line.text}</span></div>`;
    } else {
      insightEl.classList.add('hidden');
      insightEl.innerHTML = '';
    }
  }

  // WebGL orb — disattivato su hardware debole (profilo misurato, non stimato)
  if (window.momentumDeviceProfile?.enable3D !== false) {
    initWebGLOrb('financial-orb-canvas', liquidity, score / 10);
  }
  const orbText = $('#financial-orb-text');
  if (orbText) {
    // Streak (src/predict/engagement.js): mostrata solo da 2 giorni in su —
    // un "1 giorno di fila" non motiva nessuno, meglio niente.
    const streak = VaultDAO.state.engagement?.streak || 0;
    const streakHtml = streak >= 2
      ? `<div class="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-400 mt-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M12 3s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3 1-3s0 2 2 2c1.5 0 1.5-2 1.5-4 0-2-.5-4-.5-4z"/></svg>${streak} giorni di fila</div>`
      : '';
    orbText.innerHTML = `
      <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Capitale Libero</div>
      <div class="text-3xl sm:text-4xl font-mono font-black ${liquidity >= 0 ? 'text-[var(--cyan)]' : 'text-[var(--red)]'}">${formatMoney(liquidity)}</div>${streakHtml}
    `;
  }

  // Quantum Overflow Buffer
  let cumulativeReserve = 0;
  let totalExpAllTime = 0;
  let monthCountAllTime = 0;
  Object.keys(VaultDAO.state.transactions).forEach(monthKey => {
    let mInc = 0, mExp = 0, mInv = 0;
    VaultDAO.state.transactions[monthKey].forEach(t => {
      if (t.type === 'entrata') mInc += t.amount;
      else if (t.type === 'uscita') mExp += t.amount;
      else if (t.type === 'invest') mInv += t.amount;
    });
    cumulativeReserve += (mInc - mExp - mInv);
    if (mExp > 0) {
      totalExpAllTime += mExp;
      monthCountAllTime++;
    }
  });

  const reserveText = $('#cumulative-reserve-val');
  if (reserveText) {
    reserveText.textContent = formatMoney(cumulativeReserve);
    reserveText.className = `text-2xl sm:text-3xl font-mono font-black ${cumulativeReserve >= 0 ? 'text-[var(--cyan)]' : 'text-[var(--red)]'} tracking-tighter truncate`;
  }

  const sweepEstText = $('#sweeper-estimate-val');
  const sweepEst = Math.max(0, liquidity - inv);
  if (sweepEstText) {
    sweepEstText.textContent = formatMoney(sweepEst);
  }
  const sweepBtn = $('#sweep-btn');
  if (sweepBtn) {
    sweepBtn.disabled = (sweepEst <= 0);
  }

  const avgExpenses = monthCountAllTime > 0 ? (totalExpAllTime / monthCountAllTime) : 500;
  const safetyGoal = avgExpenses * 6;
  const safetyScore = safetyGoal > 0 ? Math.min(Math.round((cumulativeReserve / safetyGoal) * 100), 100) : 0;
  
  const safetyStatusText = $('#quantum-safety-status');
  if (safetyStatusText) {
    safetyStatusText.textContent = `Sicurezza: ${safetyScore}%`;
    safetyStatusText.style.color = safetyScore >= 100 ? 'var(--green)' : (safetyScore > 50 ? 'var(--yellow)' : 'var(--red)');
  }

  const waveBar = $('#quantum-reserve-wave');
  if (waveBar) {
    waveBar.style.height = `${Math.max(10, Math.min(safetyScore, 100))}%`;
  }

  // Ledger list
  const list = $('#transaction-list-container');
  list.innerHTML = '';
  if (txs.length === 0) {
    list.innerHTML = `<p class="text-center text-xs text-slate-400 py-6">Nessun movimento ancora registrato.</p>`;
    return;
  }

  txs.sort((a,b) => b.id - a.id).forEach(t => {
    const c = getCatById(t.category);
    const isInc = t.type === 'entrata';
    const isInv = t.type === 'invest';
    let dateLabel = c.name;
    if (t.date) {
      const d = new Date(t.date);
      dateLabel = `${d.getDate()} ${d.toLocaleString('it-IT', {month:'short'})} • ${c.name}`;
    }

    list.innerHTML += `
      <div class="tx-card group" data-id="${t.id}">
        <div class="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
          <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-[1rem] flex items-center justify-center text-white shadow-inner shrink-0" style="background:${c.color}">${c.icon}</div>
          <div class="min-w-0 pr-2 flex-1">
             <p class="font-bold text-[0.9rem] sm:text-[0.95rem] text-[var(--on-surface)] tracking-tight truncate flex items-center"><span class="truncate">${t.description}</span></p>
             <p class="text-[10px] sm:text-[11px] text-[var(--on-surface-secondary)] font-bold uppercase tracking-wider mt-0.5 truncate">${dateLabel}</p>
          </div>
        </div>
        <div class="flex flex-col items-end shrink-0 pl-2">
          <span class="font-mono font-black text-lg sm:text-xl tracking-tighter ${isInc ? 'text-[var(--green)]' : isInv ? 'text-[var(--gold)]' : ''}">${isInc ? '+' : isInv ? '⟳' : '−'}${formatMoney(t.amount)}</span>
          <div class="flex mt-1 items-center">
            <!-- Neuro-UX + fix responsive: era "ELIMINA" testo su hover (invisibile
                 su touch → impossibile cancellare da mobile) e un muro di bottoni
                 rossi urlati. Ora: icona cestino DISCRETA (azione distruttiva a
                 bassa prominenza, principio "non rendere facile lo sbaglio") ma
                 SEMPRE accessibile su ogni dispositivo, area tocco adeguata. -->
            <button onclick="deleteTx('${k}', ${t.id})" aria-label="Elimina transazione" title="Elimina" class="text-[var(--on-surface-secondary)] opacity-40 hover:opacity-100 hover:text-[var(--red)] focus:opacity-100 active:text-[var(--red)] transition p-2 -m-1">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;
  });
};

window.deleteTx = (k, id) => {
  if (confirm("Rimuovere questo movimento?")) {
    VaultDAO.deleteTransaction(k, id);
    renderDashboard();
    renderAnalysis();
    showToast("Transazione rimossa.", "info");
  }
};

window.toggleSound = () => {
  VaultDAO.state.soundActive = $('#settings-sound').checked;
  VaultDAO.save();
  AudioSynth.play('click');
  showToast("Feedback sonoro aggiornato.", "success");
};

window.addCalendarEvent = () => {
  try {
    const title = $('#ev-title').value.trim();
    const amount = parseFloat($('#ev-amount').value);
    const dateStr = $('#ev-date').value;
    
    if (!title || isNaN(amount) || amount <= 0 || !dateStr) {
      showToast("Dati scadenza non validi.", "error");
      AudioSynth.play('friction');
      return;
    }
    
    const ev = {
      id: Date.now() + Math.random(),
      title,
      amount,
      date: dateStr,
      completed: false,
      category: 'scadenza'
    };
    
    if (!VaultDAO.state.events) VaultDAO.state.events = [];
    VaultDAO.state.events.push(ev);
    VaultDAO.save();
    
    $('#ev-title').value = '';
    $('#ev-amount').value = '';
    $('#ev-date').value = '';
    
    window.renderCalendarEvents();
    AudioSynth.play('success');
    showToast("Promemoria pianificato.", "success");
  } catch(err) { console.error(err); }
};

window.deleteCalendarEvent = (id) => {
  try {
    if (confirm("Rimuovere questa scadenza dal calendario?")) {
      VaultDAO.state.events = VaultDAO.state.events.filter(e => e.id !== id);
      VaultDAO.save();
      window.renderCalendarEvents();
      AudioSynth.play('success');
      showToast("Scadenza rimossa.", "info");
    }
  } catch(err) { console.error(err); }
};

window.renderCalendarEvents = () => {
  const list = $('#calendar-events-list');
  if (!list) return;
  
  const events = VaultDAO.state.events || [];

  // Addebiti ricorrenti ATTESI nei prossimi 30 giorni (src/predict/advisor.js):
  // previsioni, non impegni — mostrate come voci "fantasma" accanto agli
  // eventi reali, così l'utente vede cosa lo aspetta senza doverlo inserire.
  const upcoming = getUpcomingCharges(VaultDAO.state.transactions, new Date(), 30)
    .map(c => ({ predicted: true, title: `${c.description} (previsto)`, amount: c.amount, date: c.expectedDate.toISOString() }));

  const all = [...events, ...upcoming];
  if (all.length === 0) {
    // Empty state INTELLIGENTE (non "dead"): spiega cosa comparirà qui e come,
    // così l'app è utile e chiara già dal primo avvio, anche senza dati.
    list.innerHTML = `<div class="text-center py-4 px-2">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="w-7 h-7 mx-auto mb-2 text-[var(--on-surface-secondary)]"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 3v3M16 3v3"/><path d="M12 13v3M10.5 14.5h3"/></svg>
      <p class="text-xs font-bold text-white">Qui prevedo cosa ti aspetta</p>
      <p class="text-[11px] text-[var(--on-surface-secondary)] mt-1">Appena aggiungi o importi qualche spesa, scovo da solo gli abbonamenti e le bollette ricorrenti e ti dico <b>quando</b> arriva il prossimo addebito — senza che tu inserisca nulla.</p>
    </div>`;
    return;
  }

  all.sort((a,b) => new Date(a.date) - new Date(b.date));

  list.innerHTML = all.map(ev => {
    const dt = new Date(ev.date);
    const ItalianDate = dt.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const border = ev.predicted ? 'border-amber-500/20 bg-amber-950/5' : 'border-[var(--outline)] bg-[var(--surface-solid)]';
    const icon = ev.predicted ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 inline-block align-[-2px] mr-1"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>' : '';
    return `
      <div class="flex items-center justify-between p-2.5 rounded-lg border ${border} hover:border-[var(--primary)]/30 transition-colors">
        <div class="min-w-0 pr-2">
          <p class="font-bold text-xs text-white truncate">${icon}${ev.title}</p>
          <p class="text-[10px] text-[var(--on-surface-secondary)] mt-0.5">${ItalianDate}${ev.predicted ? ' · stima dai tuoi abbonamenti' : ''}</p>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <span class="font-mono font-bold text-xs ${ev.predicted ? 'text-amber-400' : 'text-[var(--red)]'}">${ev.predicted ? '~' : '−'}${formatMoney(ev.amount)}</span>
          ${ev.predicted ? '' : `<button onclick="window.deleteCalendarEvent(${ev.id})" class="text-[10px] font-bold text-[var(--red)] hover:underline p-1">✕</button>`}
        </div>
      </div>
    `;
  }).join('');
};

// Costruisce il blocco VEVENT di un singolo evento, incluso l'orario
// quando presente (bug reale corretto: prima l'orario catturato dal
// voice core andava perso nell'export, tutto diventava "evento intera giornata").
function buildVEventBlock(ev) {
  const dt = new Date(ev.date);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  const hasRealTime = ev.hasTime && (dt.getHours() !== 0 || dt.getMinutes() !== 0);

  // Titolo/descrizione: gli eventi creati da voce hanno "description", non
  // "title" (bug reale corretto: l'export cercava un campo inesistente).
  const label = ev.title || ev.description || 'Promemoria Momentum';
  const isFinancial = typeof ev.amount === 'number' && ev.amount > 0;

  let block = "BEGIN:VEVENT\r\n";
  block += `UID:momentum-${ev.id}@omega.vault\r\n`;
  if (hasRealTime) {
    const hh = String(dt.getHours()).padStart(2, '0');
    const mm = String(dt.getMinutes()).padStart(2, '0');
    const dtStr = `${y}${m}${d}T${hh}${mm}00`;
    block += `DTSTART:${dtStr}\r\n`;
    block += `DTEND:${dtStr}\r\n`; // evento puntuale, senza durata dichiarata
  } else {
    const dateStr = `${y}${m}${d}`;
    block += `DTSTART;VALUE=DATE:${dateStr}\r\n`;
    block += `DTEND;VALUE=DATE:${dateStr}\r\n`;
  }
  block += `SUMMARY:${isFinancial ? `Momentum: ${label} (${formatMoney(ev.amount)})` : label}\r\n`;
  block += `DESCRIPTION:${ev.intent === 'appointment' ? 'Appuntamento' : 'Promemoria'} Momentum Vault.${isFinancial ? ` Importo: ${formatMoney(ev.amount)}.` : ''}\r\n`;
  block += "STATUS:CONFIRMED\r\n";
  block += "END:VEVENT\r\n";
  return block;
}

function downloadICS(icsContent, filename) {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Esporta un SOLO evento appena creato (es. da voce) e avvia subito il
// download — l'utente deve comunque toccare il file per confermare
// l'aggiunta al Calendario di sistema (nessuna webapp può scriverci
// in modo silenzioso, è un limite del sistema operativo, non di questo codice).
window.exportSingleEventToICS = (ev) => {
  try {
    let icsContent = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Momentum Vault//Temporal Nexus//IT\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n";
    icsContent += buildVEventBlock(ev);
    icsContent += "END:VCALENDAR\r\n";
    downloadICS(icsContent, `momentum_${(ev.title || ev.description || 'evento').slice(0,20).replace(/\W+/g,'_')}.ics`);
    showToast("Tocca il file scaricato per aggiungerlo al Calendario del dispositivo.", "info");
  } catch (err) {
    console.error("ICS single export error:", err);
  }
};

window.exportEventsToICS = () => {
  try {
    const events = VaultDAO.state.events || [];
    if (events.length === 0) {
      showToast("Nessun promemoria da esportare.", "info");
      return;
    }

    let icsContent = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Momentum Vault//Temporal Nexus//IT\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n";
    events.forEach(ev => { icsContent += buildVEventBlock(ev); });
    icsContent += "END:VCALENDAR\r\n";

    downloadICS(icsContent, 'momentum_scadenze.ics');
    AudioSynth.play('success');
    showToast("Calendario (.ics) esportato con successo!", "success");
  } catch(err) {
    console.error("ICS export error:", err);
    showToast("Errore durante l'esportazione ICS.", "error");
  }
};

window.runAIOverflowSweep = () => {
  try {
    const k = monthKey(VaultDAO.state.currentDate);
    const txs = VaultDAO.state.transactions[k] || [];
    let inc = 0, exp = 0, inv = 0;
    txs.forEach(t => {
      if (t.type === 'entrata') inc += t.amount;
      else if (t.type === 'uscita') exp += t.amount;
      else if (t.type === 'invest') inv += t.amount;
    });
    const liquidity = inc - exp - inv;
    
    if (liquidity <= 0) {
      showToast("Nessun surplus disponibile per lo Sweep.", "info");
      AudioSynth.play('friction');
      return;
    }
    
    const investAmt = Math.round(liquidity * 0.8 * 100) / 100;
    if (investAmt > 0) {
      const newTx = {
        id: Date.now() + Math.random(),
        amount: investAmt,
        type: 'invest',
        category: 'etf',
        description: 'AI Sweep Overflow',
        color: getCatById('etf').color,
        date: new Date().toISOString()
      };
      VaultDAO.addTransaction(k, newTx);
      if (window.momentumOrchestrator) {
        window.momentumOrchestrator.learn('AI Sweep Overflow', 'etf', investAmt, new Date());
      } else {
        NeuralNexus.train('AI Sweep Overflow', 'etf', investAmt, new Date());
      }
    }
    
    AudioSynth.play('sweep');
    haptic('heavy');
    renderDashboard();
    renderAnalysis();
    showToast(`AI Sweep completato! Spostati ${formatMoney(investAmt)} su ETF.`, "success");
  } catch(err) { console.error(err); }
};

// `skipHeavyForecast`: quando il dispatcher (src/predict/dispatcher.js) ha
// classificato l'ultima transazione come 'fast' (di routine, nessun segnale
// di novità), non vale la pena svegliare il Web Worker per Monte Carlo/GARCH
// — il calcolo sincrono già mostrato in UI resta valido. Risparmia CPU/batteria
// senza cambiare cosa vede l'utente su transazioni ordinarie.
const renderAnalysis = (opts = {}) => {
  const k = monthKey(VaultDAO.state.currentDate);
  const txs = VaultDAO.state.transactions[k] || [];
  let exp = 0;
  const catTotals = {};

  txs.forEach(t => {
    if (t.type === 'uscita') {
      exp += t.amount;
      catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
    }
  });

  const budgetLimit = VaultDAO.state.monthlyBudget;
  $('#budget-spent').textContent = formatMoney(exp);
  $('#budget-limit').textContent = `su ${formatMoney(budgetLimit)}`;
  
  const bBar = $('#budget-progress');
  if (budgetLimit > 0) {
    const perc = Math.min((exp / budgetLimit) * 100, 100);
    bBar.style.width = `${perc}%`;
    bBar.style.background = perc > 90 ? 'var(--danger-gradient)' : (perc > 75 ? 'var(--yellow)' : 'var(--green)');
  }

  // Budget settimanale (src/predict/weekly-budget.js) — derivato in automatico
  // dallo stesso tetto mensile già impostato, zero input nuovi da configurare.
  const weeklyBox = $('#weekly-budget-container');
  if (weeklyBox && budgetLimit > 0) {
    const realNowForWeekly = new Date();
    const viewingCurrentMonth = monthKey(realNowForWeekly) === k;
    // se si guarda un mese passato/futuro, il "punto di osservazione" è la
    // fine/l'inizio di quel mese (altrimenti tutte le settimane di un mese
    // passato risulterebbero "passate" rispetto a oggi, che è corretto, ma
    // per un mese futuro risulterebbero tutte "future" senza mai calcolare
    // niente — coerente in entrambi i casi con questa scelta).
    const referenceDate = viewingCurrentMonth ? realNowForWeekly : VaultDAO.state.currentDate;
    const { currentWeek, weeks } = getWeeklyStatus(txs, budgetLimit, referenceDate);
    const fmtDay = d => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

    if (currentWeek) {
      const overBudget = currentWeek.remaining < 0;
      weeklyBox.innerHTML = `
        <h4 class="text-[10px] font-extrabold uppercase tracking-widest text-[var(--on-surface-secondary)] mb-1">Questa settimana (${fmtDay(currentWeek.start)} - ${fmtDay(currentWeek.end)})</h4>
        <div class="flex justify-between items-end">
          <p class="text-xl font-black font-mono ${overBudget ? 'text-rose-400' : 'text-emerald-400'}">${formatMoney(Math.abs(currentWeek.remaining))}</p>
          <p class="text-[11px] text-[var(--on-surface-secondary)]">${overBudget ? 'oltre budget' : 'rimanenti'} su ${formatMoney(currentWeek.budget)}</p>
        </div>
        ${currentWeek.rolloverIn ? `<p class="text-[10px] mt-1 ${currentWeek.rolloverIn > 0 ? 'text-emerald-400/70' : 'text-rose-400/70'}">${currentWeek.rolloverIn > 0 ? '+' : ''}${formatMoney(currentWeek.rolloverIn)} riportato dalla settimana scorsa</p>` : ''}
      `;
    } else {
      // mese non corrente: mostra il riepilogo di tutte le settimane invece del solo "questa settimana"
      weeklyBox.innerHTML = `
        <h4 class="text-[10px] font-extrabold uppercase tracking-widest text-[var(--on-surface-secondary)] mb-2">Budget per settimana</h4>
        <div class="space-y-1 text-[11px]">
          ${weeks.map(w => `<div class="flex justify-between"><span class="text-[var(--on-surface-secondary)]">${fmtDay(w.start)}-${fmtDay(w.end)}</span><span class="${w.remaining < 0 ? 'text-rose-400' : 'text-slate-300'}">${formatMoney(w.remaining)}</span></div>`).join('')}
        </div>
      `;
    }
  }

  renderSavingsGoals();

  // Doughnut chart
  const chartEl = $('#category-chart');
  if (chartEl) {
    const ctx = chartEl.getContext('2d');
    if (window.catChart) {
      try { window.catChart.destroy(); } catch(e) {}
    }
    const labels = Object.keys(catTotals).map(id => getCatById(id).name);
    const data = Object.values(catTotals);
    const colors = Object.keys(catTotals).map(id => getCatById(id).color);
    if (data.length > 0 && typeof Chart !== 'undefined') {
      try {
        window.catChart = new Chart(ctx, {
          type: 'doughnut',
          data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
          options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false } } }
        });
      } catch(e) { console.warn("Chart error:", e); }
    } else {
      ctx.clearRect(0, 0, chartEl.width, chartEl.height);
    }
  }

  // Predictions & Jar Fill
  const proj = PredictiveOracle.calculateProjections();
  $('#forecast-cagr').textContent = `Crescita media stimata: ${(proj.dynCagr * 100).toFixed(1)}%`;
  $('#forecast-1y').textContent = formatMoney(proj.proj1y);
  $('#forecast-5y').textContent = formatMoney(proj.proj5y);
  const bandDisplay = document.getElementById('forecast-band-display');
  if (bandDisplay && proj.sim5y) {
    bandDisplay.textContent = `Scenari possibili tra 5 anni (dal 5% al 95%): ${formatMoney(proj.sim5y.p5)} - ${formatMoney(proj.sim5y.p95)}`;
  }
  $('#discipline-score').textContent = `Costanza: ${proj.discipline}/100`;
  $('#forecast-jar-fill').style.height = `${proj.discipline}%`;

  // Aggiornamento progressivo: il worker ricalcola con l'ensemble
  // (linreg+AR2 pesati per backtest), Holt-Winters, GARCH e Monte Carlo
  // Cornish-Fisher, senza bloccare la UI. Se fallisce, resta il calcolo sopra.
  if (!opts.skipHeavyForecast) {
    PredictiveOracle.enhanceAsync(window.momentumDeviceProfile?.forecastBudget).then(r => {
      if (!r) return;
      $('#forecast-1y').textContent = formatMoney(r.sims.y1.p50);
      $('#forecast-5y').textContent = formatMoney(r.sims.y5.p50);
      const band = document.getElementById('forecast-band-display');
      if (band) {
        let txt = `Scenari possibili tra 5 anni (dal 5% al 95%): ${formatMoney(r.sims.y5.p5)} - ${formatMoney(r.sims.y5.p95)}`;
        if (r.mcExpenses) txt += ` · Spese del prossimo mese: di solito ${formatMoney(r.mcExpenses.p50)}, al massimo ${formatMoney(r.mcExpenses.var95)}`;
        band.textContent = txt;
      }
      const cagrEl = $('#forecast-cagr');
      if (cagrEl && r.ensemble?.weights) {
        const w = r.ensemble.weights;
        cagrEl.textContent = `Crescita media stimata: ${(proj.dynCagr * 100).toFixed(1)}%`;
      }
      // Il livello Holt-Winters (spesa giornaliera destagionalizzata) rende
      // la proiezione di fine mese dell'advisor un vero forecast invece del
      // run-rate: si memorizza per i render futuri e si aggiorna la card ora.
      if (typeof r.hw?.level === 'number' && isFinite(r.hw.level)) {
        window.__hwDailyLevel = Math.max(0, r.hw.level);
        renderRadarAlerts(k, budgetLimit, window.__hwDailyLevel);
      }
    });
  }

  // FIRE calculator target
  let totalExp = 0;
  Object.keys(VaultDAO.state.transactions).forEach(m => {
    VaultDAO.state.transactions[m].forEach(t => {
      if (t.type === 'uscita') totalExp += t.amount;
    });
  });
  const activeMonths = Object.keys(VaultDAO.state.transactions).length || 1;
  const fireExpenses = (totalExp / activeMonths) * 12;
  const fireTargetVal = fireExpenses * 25;
  
  $('#fire-target-val').textContent = formatMoney(fireTargetVal);
  const rate = proj.projectedMonthlyFlow || 1;
  const yearsNeeded = rate > 0 ? (fireTargetVal / (rate * 12)) : 99;
  $('#fire-years').textContent = yearsNeeded < 90 ? `${yearsNeeded.toFixed(1)} anni` : "Nessun risparmio.";

  // Heatmap Grid
  const grid = $('#heatmap-grid');
  if (grid) {
    grid.innerHTML = '';
    const today = new Date();
    const days = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    
    const spends = {};
    txs.forEach(t => {
      if (t.type === 'uscita') {
        const d = new Date(t.date).getDate();
        spends[d] = (spends[d] || 0) + t.amount;
      }
    });

    for (let i = 1; i <= days; i++) {
      const amt = spends[i] || 0;
      let bg = 'bg-slate-900/40 border border-[var(--glass-border)]';
      if (amt > 0 && amt <= 20) bg = 'bg-indigo-900/30';
      else if (amt > 20 && amt <= 80) bg = 'bg-indigo-700/50';
      else if (amt > 80 && amt <= 200) bg = 'bg-indigo-500/70';
      else if (amt > 200) bg = 'bg-indigo-400';

      // title = tooltip nativo: tocco/hover sul giorno → quanto hai speso
      grid.innerHTML += `<div class="heatmap-day ${bg} flex items-center justify-center text-[9px] font-mono text-slate-300" title="${i} ${VaultDAO.state.currentDate.toLocaleDateString('it-IT', { month: 'long' })}: ${amt > 0 ? formatMoney(amt) : 'nessuna spesa'}">${i}</div>`;
    }
  }

  // Alerts & Anomalie: prima chiamata sincrona (proiezione run-rate), poi
  // il forecast worker la ri-renderizza con il livello Holt-Winters vero.
  renderRadarAlerts(k, budgetLimit, window.__hwDailyLevel ?? null);
  renderInvestments();
  renderNetWorth();
  renderTax(k);
};

// Card Partita IVA (src/predict/tax.js): mostrata solo se l'utente ha
// abilitato il regime P.IVA (VaultDAO.state.taxRegime) o ha entrate rilevanti.
function renderTax(monthK) {
  const card = $('#tax-card'), setEl = $('#tax-setaside'), noteEl = $('#tax-note'), extraEl = $('#tax-extra');
  if (!card) return;
  if (extraEl) extraEl.innerHTML = '';
  const regime = VaultDAO.state.taxRegime;
  const learned = VaultDAO.state.taxLearned || {};
  const monthTxs = VaultDAO.state.transactions[monthK] || [];
  const allFlat = Object.values(VaultDAO.state.transactions || {}).flat();
  // Il modulo P.IVA ha senso solo per chi FATTURA. Se non c'è regime E non
  // c'è mai stata una fattura, resta nascosto (niente modulo per chi non serve).
  const incomeModel = (typeof window !== 'undefined' && window.__incomeModel) || null;
  const everInvoice = allFlat.some(t => t.type === 'entrata' && classifyIncome(t, learned, incomeModel).kind === 'invoice');
  if (!regime && !everInvoice) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');

  // ── INTELLIGENZA REGIME: senza regime NON si inventa un numero (IRPEF/INPS/
  // coefficiente dipendono dal regime). Se ci sono fatture ma manca il regime,
  // si CHIEDE con un tocco — poi il calcolo diventa reale.
  if (everInvoice && !regime) {
    setEl.textContent = '?';
    noteEl.textContent = 'Vedo delle fatture ma non so il tuo regime fiscale: senza, il calcolo sarebbe a caso. Dimmelo con un tocco e calcolo tasse + contributi giusti.';
    if (extraEl) {
      extraEl.innerHTML = `<div class="flex flex-wrap gap-2">${Object.entries(REGIMI).map(([k, v]) =>
        `<button onclick="window.setTaxRegime('${k}')" class="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-[var(--glass-border)] bg-[var(--surface-elevated)]/40 hover:border-[var(--red)]">${v.label.split('(')[0].trim()}</button>`).join('')}</div>`;
    }
    return;
  }

  const r = taxSetAsideForPeriod(monthTxs, { regime: regime || 'forfettario', learned, model: incomeModel });
  if (r.count > 0) {
    setEl.textContent = formatMoney(r.daAccantonare);
    noteEl.textContent = r.note;
  } else {
    setEl.textContent = '—';
    noteEl.textContent = everInvoice
      ? 'Nessuna fattura registrata questo mese: niente da accantonare.'
      : 'Non vedo fatture P.IVA. Se sei un libero professionista, registra un\'entrata come fattura (parole tipo "fattura", "compenso"): calcolo io quanto mettere da parte per il fisco.';
  }

  if (extraEl) {
    let html = '';
    // ── PROIEZIONE ANNUALE + CONSIGLI (come un commercialista, onesto) ──
    if (regime && everInvoice) {
      const proj = projectAnnualTax(allFlat, { regime, referenceDate: new Date(), learned, model: incomeModel });
      if (proj.invoicedYTD > 0) {
        html += `<div class="flex items-start gap-1.5 text-[11px] text-slate-300 border-t border-[var(--glass-border)] pt-2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 shrink-0 mt-0.5"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 3v3M16 3v3"/></svg><span>${proj.note}</span></div>`;
        // Consigli prioritizzati con neurocolori: high=ambra (attenzione),
        // info positivo=verde (rinforzo). Regole dell'anno pertinente.
        const { advice } = taxAdvice({
          regime, annualizedRevenue: proj.annualizedRevenue, invoicedYTD: proj.invoicedYTD,
          estimatedAnnualTax: proj.estimatedAnnualTax, year: new Date().getFullYear(),
        });
        for (const a of advice) {
          const col = a.priority === 'high' ? 'text-orange-300' : a.priority === 'medium' ? 'text-amber-300' : 'text-emerald-300';
          html += `<div class="text-[11px] ${col} mt-1">${a.icon} ${a.text}</div>`;
        }
      }
    }
    // ── CONFERMA APPRESA: le entrate incerte diventano un tap "è una fattura?" ──
    if (r.uncertainCount > 0) {
      const rows = r.uncertain.slice(0, 4).map(t =>
        `<div class="flex items-center justify-between gap-2 py-1">
          <span class="min-w-0 truncate">${t.description || 'entrata'} · <b>${formatMoney(t.amount)}</b></span>
          <span class="shrink-0 flex gap-2">
            <button onclick='window.learnIncome(${JSON.stringify(t.description || "")}, "invoice")' class="text-[11px] font-bold text-emerald-400 underline">è fattura</button>
            <button onclick='window.learnIncome(${JSON.stringify(t.description || "")}, "personal")' class="text-[11px] font-bold text-slate-400 underline">no</button>
          </span>
        </div>`).join('');
      html += `<div class="mt-2 border-t border-[var(--glass-border)] pt-2"><div class="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1">${r.uncertainCount} entrat${r.uncertainCount > 1 ? 'e' : 'a'} da confermare</div><div class="text-xs text-slate-300">${rows}</div></div>`;
    }
    // ── PROMEMORIA PROATTIVO: fatture ricorrenti (mensili) di questo mese non
    // ancora emesse. Predittivo + automatico, MAI auto-invia: un tap apre il
    // form già compilato per quel cliente. ──
    const dovute = detectRecurringClients(VaultDAO.state.invoices || [], new Date()).filter(c => c.dueThisMonth).slice(0, 3);
    for (const c of dovute) {
      html += `<div class="flex items-center gap-2 mt-2 text-xs text-amber-200 bg-amber-950/10 border border-amber-500/20 rounded-xl px-3 py-2">
        <span class="text-[var(--gold)]">${REPEAT_ICON}</span>
        <span class="min-w-0 flex-1">Fattura ${c.cadence || ''} per <b>${c.client}</b>${c.typicalAmount ? ` (~${Math.round(c.typicalAmount)}€)` : ''}: non ancora fatta questo mese.</span>
        <button onclick='window.openCreateInvoice(${JSON.stringify(c.client)})' class="shrink-0 text-[11px] font-bold text-[var(--gold)] underline">Crea</button>
      </div>`;
    }
    // ── CICLO SdI: e-fatture create ma NON ancora trasmesse. Promemoria onesto
    // (l'app non può trasmettere), col link al portale e "segna trasmessa". ──
    const pend = pendingSdiTransmission(VaultDAO.state.invoices || []);
    if (pend.count > 0) {
      const rows = pend.invoices.slice(0, 4).map(i =>
        `<div class="flex items-center justify-between gap-2 py-1">
          <span class="min-w-0 truncate">n.${i.number}/${i.year} · ${i.client || 'cliente'} · <b>${formatMoney(i.imponibile)}</b></span>
          <button onclick='window.markTransmitted(${i.number}, ${i.year})' class="shrink-0 text-[11px] font-bold text-emerald-400 underline">segna trasmessa</button>
        </div>`).join('');
      html += `<div class="mt-3 border border-[var(--gold)]/25 bg-[var(--gold)]/5 rounded-xl px-3 py-2.5">
        <div class="flex items-center gap-2 mb-1"><span class="text-[10px] font-bold text-[var(--gold)] uppercase tracking-wider">${pend.count} fattur${pend.count > 1 ? 'e' : 'a'} da caricare sullo SdI</span></div>
        <div class="text-xs text-slate-300">${rows}</div>
        <a href="${SDI_PORTAL_URL}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 mt-2 text-[11px] font-bold px-3 py-1.5 rounded-full bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)]">Apri il portale Fatture e Corrispettivi<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg></a>
      </div>`;
    }
    // ── CREA FATTURA: azione contestuale, appare solo qui (per chi fattura) ──
    html += `<button onclick="window.openCreateInvoice()" class="btn-action btn-primary w-full py-2.5 font-bold rounded-xl mt-3 text-sm inline-flex items-center justify-center gap-2"><svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>Crea fattura</button>`;
    extraEl.innerHTML = html;
  }
}
window.setTaxRegime = (regime) => { VaultDAO.state.taxRegime = regime; VaultDAO.save(); showToast('Regime fiscale impostato.', 'success'); renderAnalysis(); };
// Segna una e-fattura come TRASMESSA allo SdI (dopo che l'utente l'ha caricata
// sul portale). Chiude il ciclo: sparisce dal promemoria. Onesto: è l'utente a
// confermarlo, l'app non può saperlo da sola.
window.markTransmitted = (number, year) => {
  VaultDAO.state.invoices = (VaultDAO.state.invoices || []).map(i =>
    (i.number === number && i.year === year && i.isElectronic) ? { ...i, sdiTransmitted: true } : i);
  VaultDAO.save();
  showToast(`Fattura n.${number}/${year} segnata come trasmessa. ✓`, 'success');
  renderAnalysis();
};

// ── CREA FATTURA (v10): semplice come un tap, nativa per ogni schermo, coerente
// con gli stili dell'app. 3 campi (cliente, quanto, per cosa), regime pre-scelto,
// anteprima LIVE del netto a ricevere, un bottone che genera e stampa (→PDF
// on-device). Numero e data automatici. Impara i clienti dallo storico.
// Icona di ricorrenza riusabile (frecce circolari) — sostituisce l'emoji 🔁
// per coerenza col linguaggio visivo dell'app (SVG a tratto, come le altre).
const REPEAT_ICON = `<svg class="recur-ico w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`;

// Portale ufficiale dell'Agenzia delle Entrate per caricare/trasmettere la
// fattura elettronica (l'utente accede col SUO SPID: Momentum non trasmette).
const SDI_PORTAL_URL = 'https://ivaservizi.agenziaentrate.gov.it/portale/';
// Guida al caricamento passo-passo. Onesta: i nomi esatti delle voci di menu del
// portale possono cambiare nel tempo → passi descrittivi, non un percorso rigido.
function showUploadHelp(filename) {
  const steps = [
    'Accedi al portale <b>Fatture e Corrispettivi</b> con SPID, CIE o credenziali Entratel/Fisconline.',
    'Apri la sezione <b>Fatturazione elettronica</b> e scegli <b>trasmetti / importa un file</b>.',
    `Carica il file <b>${(filename || 'XML')}</b> che hai appena scaricato da Momentum.`,
    'Controlla l’anteprima e premi <b>Trasmetti</b>: lo SdI ti invierà la ricevuta di consegna (o di scarto).',
  ];
  const box = $('#inv-xml-controls'); if (!box) return;
  if (!$('#inv-upload-steps')) {
    const div = document.createElement('div');
    div.id = 'inv-upload-steps';
    div.className = 'mt-2 pt-2 border-t border-emerald-400/20';
    div.innerHTML = `<div class="font-bold mb-1">Come caricarla (una volta sola, poi è routine):</div><ol class="list-decimal pl-4 space-y-0.5">${steps.map(s => `<li>${s}</li>`).join('')}</ol><div class="mt-1 opacity-70">I nomi esatti delle voci possono variare: cerca “Fatturazione elettronica”.</div>`;
    box.appendChild(div);
  }
  showToast('Guida al caricamento mostrata sotto.', 'success');
}

function getInvoiceFormHTML() {
  const regime = VaultDAO.state.taxRegime || 'forfettario';
  const year = new Date().getFullYear();
  const num = nextInvoiceNumber(VaultDAO.state.invoices || [], year);
  const prof = VaultDAO.state.invoiceProfile || {};
  const fis = prof.fiscale || {};
  const inputCls = 'w-full bg-black/30 border border-[var(--glass-border)] rounded-xl px-4 py-3 text-sm min-w-0';
  const smallCls = 'w-full bg-black/30 border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm min-w-0';
  const hasProfile = !!(prof.emitter && prof.emitter.trim());
  const v = (s) => String(s || '').replace(/"/g, '&quot;');
  // Sezione dati fiscali (P.IVA/indirizzo): serve alla FATTURA ELETTRONICA XML.
  // Compilata una volta e ricordata. Per l'Italia si apre da sola (è quello che
  // serve davvero); il PDF di cortesia funziona anche senza.
  const emitterFiscalHTML = `
        <div class="grid grid-cols-2 gap-2">
          <input id="inv-piva" inputmode="numeric" class="${smallCls}" placeholder="Partita IVA (11 cifre)" value="${v(fis.partitaIva)}" />
          <input id="inv-cf" class="${smallCls}" placeholder="Codice Fiscale (se diverso)" value="${v(fis.codiceFiscale)}" />
          <input id="inv-indirizzo" class="${smallCls} col-span-2" placeholder="Indirizzo (via e numero)" value="${v(fis.indirizzo)}" />
          <input id="inv-cap" inputmode="numeric" class="${smallCls}" placeholder="CAP" value="${v(fis.cap)}" />
          <input id="inv-comune" class="${smallCls}" placeholder="Comune" value="${v(fis.comune)}" />
          <input id="inv-prov" maxlength="2" class="${smallCls}" placeholder="Prov. (es. MI)" value="${v(fis.provincia)}" />
          <input id="inv-iban" class="${smallCls}" placeholder="IBAN (per il pagamento)" value="${v(fis.iban)}" />
        </div>`;
  return `
  <div class="flex flex-col gap-3 p-3 sm:p-5 lg:p-0">
    <div class="flex items-baseline justify-between">
      <h3 class="text-base font-black">Crea fattura</h3>
      <span class="text-[11px] text-[var(--on-surface-secondary)]">n. ${num}/${year} · ${new Date().toLocaleDateString('it-IT')}</span>
    </div>
    <!-- CONSULENTE-GUIDA: dice in parole semplici quale documento serve. Aggiornato live. -->
    <div id="inv-guidance" class="rounded-xl border border-[var(--glass-border)] bg-black/20 px-4 py-3 text-[12px] leading-snug"></div>
    <!-- I tuoi dati (emittente + dati fiscali + logo): compilati UNA volta e ricordati -->
    <details ${hasProfile ? '' : 'open'} class="rounded-xl border border-[var(--glass-border)] bg-black/20">
      <summary class="cursor-pointer px-4 py-2.5 text-[11px] font-bold text-[var(--on-surface-secondary)] select-none">I tuoi dati e logo ${hasProfile ? `· <span class="text-emerald-400">${(prof.emitter || '').slice(0, 24)}</span>` : '(compila una volta)'}</summary>
      <div class="flex flex-col gap-2 p-3 pt-0">
        <input id="inv-emitter" class="${inputCls}" placeholder="Il tuo nome / ragione sociale" value="${v(prof.emitter)}" />
        ${emitterFiscalHTML}
        <div class="flex items-center gap-3">
          <label class="text-[11px] font-bold text-[var(--gold)] cursor-pointer underline">Carica logo<input id="inv-logo" type="file" accept="image/*" class="hidden" /></label>
          <span id="inv-logo-status" class="text-[10px] text-[var(--on-surface-secondary)]">${prof.logo ? 'logo salvato ✓' : 'nessun logo'}</span>
          <select id="inv-country" class="text-[11px] bg-black/30 border border-[var(--glass-border)] rounded-lg px-2 py-1.5" title="Paese (regole fattura)">
            ${selectableInvoiceCountries().map(c => `<option value="${c.code}" ${(prof.country || 'IT') === c.code ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
          <input id="inv-accent" type="color" value="${/^#[0-9a-fA-F]{6}$/.test(prof.accent) ? prof.accent : '#0ea5e9'}" class="ml-auto w-8 h-8 rounded-lg bg-transparent border border-[var(--glass-border)] cursor-pointer" title="Colore accento" />
        </div>
      </div>
    </details>
    ${(() => {
      // Chip clienti RICORRENTI: un tap ricompila tutto. Icona ricorrenza (oro)
      // sui ricorrenti; quelli con la fattura del mese da fare in evidenza oro.
      const rec = detectRecurringClients(VaultDAO.state.invoices || [], new Date()).slice(0, 5);
      if (!rec.length) return '';
      const miniRepeat = `<svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`;
      return `<div class="flex gap-2 overflow-x-auto pb-1">${rec.map((c, i) =>
        `<button type="button" data-recidx="${i}" class="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full border ${c.dueThisMonth ? 'border-[var(--gold)] text-[var(--gold)]' : 'border-[var(--glass-border)] text-slate-300'} bg-black/20">${c.monthly ? miniRepeat : ''}<span>${c.client}${c.typicalAmount ? ` · ${Math.round(c.typicalAmount)}€` : ''}</span></button>`).join('')}</div>`;
    })()}
    <input id="inv-client" class="${inputCls}" placeholder="Cliente (es. Studio Rossi)" autocomplete="off" list="inv-clients" />
    <datalist id="inv-clients">${[...new Set((VaultDAO.state.invoices || []).map(i => i.client).filter(Boolean))].map(c => `<option value="${c.replace(/"/g, '&quot;')}">`).join('')}</datalist>
    <!-- Dati fiscali del CLIENTE: servono solo alla fattura elettronica. A scomparsa,
         si aprono da soli quando serve. Ricordati per cliente (riuso intelligente). -->
    <details id="inv-client-fiscal" class="rounded-xl border border-[var(--glass-border)] bg-black/20">
      <summary class="cursor-pointer px-4 py-2.5 text-[11px] font-bold text-[var(--on-surface-secondary)] select-none">Dati del cliente per la fattura elettronica <span id="inv-cli-badge" class="text-[var(--gold)]"></span></summary>
      <div class="grid grid-cols-2 gap-2 p-3 pt-0">
        <input id="inv-cli-piva" inputmode="numeric" class="${smallCls}" placeholder="P.IVA cliente" />
        <input id="inv-cli-cf" class="${smallCls}" placeholder="Codice Fiscale cliente" />
        <input id="inv-cli-indirizzo" class="${smallCls} col-span-2" placeholder="Indirizzo cliente" />
        <input id="inv-cli-cap" inputmode="numeric" class="${smallCls}" placeholder="CAP" />
        <input id="inv-cli-comune" class="${smallCls}" placeholder="Comune" />
        <input id="inv-cli-prov" maxlength="2" class="${smallCls}" placeholder="Prov." />
        <input id="inv-cli-sdi" maxlength="7" class="${smallCls}" placeholder="Codice SdI (7) — se ce l'ha" />
        <input id="inv-cli-pec" type="email" class="${smallCls} col-span-2" placeholder="oppure PEC del cliente" />
        <p class="col-span-2 text-[10px] text-[var(--on-surface-secondary)] leading-snug">Non hai il Codice SdI né la PEC? Nessun problema: la fattura arriva nel cassetto fiscale del cliente (useremo <b>0000000</b>).</p>
      </div>
    </details>
    <input id="inv-amount" type="number" inputmode="decimal" class="${inputCls} font-mono" placeholder="Quanto (imponibile €)" />
    <input id="inv-desc" class="${inputCls}" placeholder="Per cosa (es. Consulenza marzo)" />
    <input id="inv-email" type="email" class="${inputCls}" placeholder="Email cliente (per inviarla)" autocomplete="off" />
    <label class="block cursor-pointer select-none">
      <input id="inv-recurring" type="checkbox" class="recur-check" style="position:absolute;opacity:0;width:0;height:0" />
      <span class="recur-row">
        <span class="flex items-center gap-2 text-[12px] text-slate-300 min-w-0">
          ${REPEAT_ICON}
          <span class="min-w-0"><b>Ricorrente ogni mese</b> <span class="text-[10px] text-[var(--on-surface-secondary)]">— te lo ricordo io</span></span>
        </span>
        <span class="recur-switch"></span>
      </span>
    </label>
    <div class="flex items-center gap-2 text-[11px] text-[var(--on-surface-secondary)]">
      <span>Regime:</span>
      <select id="inv-regime" class="bg-black/30 border border-[var(--glass-border)] rounded-lg px-2 py-1">
        ${Object.entries(REGIMI).map(([k, v]) => `<option value="${k}" ${k === regime ? 'selected' : ''}>${v.label.split('(')[0].trim()}</option>`).join('')}
      </select>
    </div>
    <div id="inv-preview" class="card p-3 text-xs text-slate-300 hidden"></div>
    <!-- Esito controlli fattura elettronica (predizione scarti SdI, in chiaro) -->
    <div id="inv-xml-controls" class="hidden text-[11px] leading-snug rounded-xl border px-3 py-2.5"></div>
    <!-- Pulsante FATTURA ELETTRONICA (XML): primario per l'Italia. Nascosto per i
         Paesi/casi in cui non serve (allora resta solo il PDF). -->
    <button id="inv-xml" class="btn-action btn-primary w-full py-3 font-bold rounded-xl inline-flex items-center justify-center gap-2 hidden"><svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15l2 2 4-4"/></svg>Scarica fattura elettronica (XML)</button>
    <div class="flex gap-2">
      <button id="inv-generate" class="flex-1 py-3 font-bold rounded-xl border border-[var(--glass-border)] bg-black/20 text-sm">Scarica PDF</button>
      <button id="inv-email-send" class="flex-1 py-3 font-bold rounded-xl border border-[var(--glass-border)] bg-black/20 text-sm inline-flex items-center justify-center gap-2"><svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>Invia con allegato</button>
    </div>
    <p id="inv-foot" class="text-[9px] text-[var(--on-surface-secondary)] opacity-70"></p>
  </div>`;
}

window.openCreateInvoice = (prefillClient) => {
  openModal(getInvoiceFormHTML());
  const clientEl = $('#inv-client'), amountEl = $('#inv-amount'), descEl = $('#inv-desc'), regimeEl = $('#inv-regime'), prevEl = $('#inv-preview');
  const eur = (n) => `${(+n).toFixed(2).replace('.', ',')} €`;
  // Anteprima LIVE: mostra netto a ricevere e scomposizione a ogni modifica.
  const refresh = () => {
    syncGuidance();
    const imp = parseFloat(String(amountEl.value).replace(',', '.'));
    if (!(imp > 0)) { prevEl.classList.add('hidden'); return; }
    const country = ($('#inv-country') && $('#inv-country').value) || 'IT';
    const inv = computeInvoice({ imponibile: imp, regime: regimeEl.value, country });
    prevEl.classList.remove('hidden');
    prevEl.innerHTML = `${inv.righe.map(r => `<div class="flex justify-between"><span>${r.voce}</span><span class="font-mono">${eur(r.importo)}</span></div>`).join('')}
      <div class="flex justify-between border-t border-[var(--glass-border)] mt-1 pt-1"><span class="font-bold">Totale fattura</span><span class="font-mono">${eur(inv.totaleFattura)}</span></div>
      <div class="flex justify-between text-emerald-300 font-bold"><span>Riceverai</span><span class="font-mono">${eur(inv.nettoARicevere)}</span></div>`;
  };
  const emailEl = $('#inv-email');
  // Raccoglie i dati fiscali strutturati (tuoi e del cliente) dai campi del form.
  const currentFiscal = () => ({
    partitaIva: ($('#inv-piva')?.value || '').trim(), codiceFiscale: ($('#inv-cf')?.value || '').trim(),
    indirizzo: ($('#inv-indirizzo')?.value || '').trim(), cap: ($('#inv-cap')?.value || '').trim(),
    comune: ($('#inv-comune')?.value || '').trim(), provincia: ($('#inv-prov')?.value || '').trim(),
    iban: ($('#inv-iban')?.value || '').trim(),
  });
  const currentClientFiscal = () => ({
    denominazione: (clientEl.value || '').trim(),
    partitaIva: ($('#inv-cli-piva')?.value || '').trim(), codiceFiscale: ($('#inv-cli-cf')?.value || '').trim(),
    indirizzo: ($('#inv-cli-indirizzo')?.value || '').trim(), cap: ($('#inv-cli-cap')?.value || '').trim(),
    comune: ($('#inv-cli-comune')?.value || '').trim(), provincia: ($('#inv-cli-prov')?.value || '').trim(),
    codiceDestinatario: ($('#inv-cli-sdi')?.value || '').trim(), pec: ($('#inv-cli-pec')?.value || '').trim(),
  });
  // Compone la riga anagrafica leggibile (P.IVA · indirizzo · IBAN) per PDF/email.
  const composeInfo = (f, withIban) => {
    const parts = [];
    if (f.partitaIva) parts.push('P.IVA ' + f.partitaIva);
    else if (f.codiceFiscale) parts.push('C.F. ' + f.codiceFiscale);
    const addr = [f.indirizzo, [f.cap, f.comune].filter(Boolean).join(' '), f.provincia ? `(${f.provincia})` : ''].filter(Boolean).join(', ');
    if (addr) parts.push(addr);
    if (withIban && f.iban) parts.push('IBAN ' + f.iban);
    return parts.join(' · ');
  };
  // Recupera i dati fiscali del cliente dall'ultima fattura a quel cliente
  // (riuso intelligente: chi fattura spesso non li reinserisce ogni volta).
  const lastClientFiscal = (name) => {
    const q = String(name || '').toLowerCase().trim(); if (!q) return null;
    const hist = (VaultDAO.state.invoices || []).filter(i => String(i.client || '').toLowerCase() === q && i.clientFiscale)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    return hist.length ? hist[0].clientFiscale : null;
  };
  const fillClientFiscal = (f) => {
    if (!f) return;
    if ($('#inv-cli-piva')) $('#inv-cli-piva').value = f.partitaIva || '';
    if ($('#inv-cli-cf')) $('#inv-cli-cf').value = f.codiceFiscale || '';
    if ($('#inv-cli-indirizzo')) $('#inv-cli-indirizzo').value = f.indirizzo || '';
    if ($('#inv-cli-cap')) $('#inv-cli-cap').value = f.cap || '';
    if ($('#inv-cli-comune')) $('#inv-cli-comune').value = f.comune || '';
    if ($('#inv-cli-prov')) $('#inv-cli-prov').value = f.provincia || '';
    if ($('#inv-cli-sdi')) $('#inv-cli-sdi').value = f.codiceDestinatario || '';
    if ($('#inv-cli-pec')) $('#inv-cli-pec').value = f.pec || '';
  };
  // CONSULENTE-GUIDA live: in base al Paese dice quale documento serve (fattura
  // elettronica XML o PDF), mostra/nasconde il pulsante XML e adatta i testi.
  // Semplice per chi inizia, non invadente per chi fattura da anni.
  function syncGuidance() {
    const country = ($('#inv-country')?.value) || 'IT';
    const isIT = country === 'IT';
    const rec = recommendInvoiceType({ emitterCountry: isIT ? 'IT' : 'ES', emitterHasVat: true, clientCountry: isIT ? 'IT' : 'ES' });
    const g = $('#inv-guidance');
    if (g) g.innerHTML = `<div class="font-bold mb-0.5">${rec.title}</div><div class="text-[var(--on-surface-secondary)]">${rec.reason}</div>`;
    $('#inv-xml')?.classList.toggle('hidden', !rec.needsFatturaPa);
    if ($('#inv-generate')) $('#inv-generate').textContent = rec.needsFatturaPa ? 'PDF di cortesia' : 'Scarica PDF';
    if ($('#inv-foot')) $('#inv-foot').textContent = rec.needsFatturaPa
      ? 'La fattura elettronica (XML) è quella ufficiale: la carichi sul portale Fatture e Corrispettivi dell’Agenzia o la giri al commercialista. Il PDF è una copia leggibile di cortesia.'
      : 'Documento generato on-device, valido dove non c’è obbligo di fattura elettronica.';
    return rec;
  }
  // Chip clienti ricorrenti: un tap ricompila TUTTO (riuso intelligente).
  const recurring = detectRecurringClients(VaultDAO.state.invoices || [], new Date()).slice(0, 5);
  document.querySelectorAll('[data-recidx]').forEach(btn => btn.addEventListener('click', () => {
    const c = recurring[+btn.dataset.recidx]; if (!c) return;
    clientEl.value = c.client;
    if (c.typicalAmount) amountEl.value = c.typicalAmount;
    if (c.lastDescription) descEl.value = c.lastDescription;
    if (c.lastEmail) emailEl.value = c.lastEmail;
    if (c.lastRegime && regimeEl.querySelector(`option[value="${c.lastRegime}"]`)) regimeEl.value = c.lastRegime;
    if ($('#inv-recurring')) $('#inv-recurring').checked = !!c.monthly; // coerenza: resta ricorrente
    refresh();
  }));
  // Autocompletamento intelligente: scelto un cliente noto, pre-compila importo/descrizione/email dallo storico.
  clientEl.addEventListener('change', () => {
    const s = suggestFromHistory(VaultDAO.state.invoices || [], clientEl.value);
    if (s) { if (!amountEl.value && s.suggestedImponibile) amountEl.value = s.suggestedImponibile; if (!descEl.value && s.lastDescription) descEl.value = s.lastDescription; if (!emailEl.value && s.lastEmail) emailEl.value = s.lastEmail; }
    fillClientFiscal(lastClientFiscal(clientEl.value)); // riuso dati fiscali del cliente
    refresh();
  });
  amountEl.addEventListener('input', refresh);
  regimeEl.addEventListener('change', refresh);
  $('#inv-country')?.addEventListener('change', refresh);
  // Logo → data URI on-device (nessun upload esterno), tenuto in una var locale
  // e salvato nel profilo alla generazione. Limite dimensione per non gonfiare
  // il vault: se troppo grande, avvisa.
  let logoData = (VaultDAO.state.invoiceProfile || {}).logo || '';
  $('#inv-logo').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (f.size > 400 * 1024) { showToast('Logo troppo grande (max 400KB).', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => { logoData = reader.result; $('#inv-logo-status').textContent = 'logo caricato ✓'; };
    reader.readAsDataURL(f);
  });
  // Crea+salva la fattura (riusata da "Genera e stampa" e "Email al cliente").
  // Ritorna { inv, meta, clientEmail } o null se dati mancanti.
  const buildAndSave = (opts = {}) => {
    // CONTROLLI DI COMPLETEZZA (feedback utente): una fattura senza questi dati
    // non è valida. Messaggi chiari, focus sul campo mancante, sezione dati
    // aperta se serve — comprensibile a tutti.
    const client = clientEl.value.trim();
    const imp = parseFloat(String(amountEl.value).replace(',', '.'));
    const emitter = ($('#inv-emitter').value || '').trim();
    if (!emitter) {
      const det = document.querySelector('#modal-body details'); if (det) det.open = true;
      $('#inv-emitter').focus();
      showToast('Aggiungi il tuo nome / P.IVA (serve per una fattura valida).', 'error'); return null;
    }
    if (!client) { clientEl.focus(); showToast('Inserisci il nome del cliente.', 'error'); return null; }
    if (!(imp > 0)) { amountEl.focus(); showToast('Inserisci un importo valido.', 'error'); return null; }
    const fis = currentFiscal();
    const cliFis = currentClientFiscal();
    const country = ($('#inv-country') && $('#inv-country').value) || 'IT';
    // emitterInfo/clientInfo per il PDF: composti dai dati strutturati (una sola
    // fonte di verità → coerenti con l'XML).
    const emitterInfo = composeInfo(fis, true);
    const clientInfo = composeInfo(cliFis, false);
    VaultDAO.state.invoiceProfile = {
      emitter: ($('#inv-emitter').value || '').trim(),
      emitterInfo,
      logo: logoData || '',
      accent: $('#inv-accent').value || '#0ea5e9',
      country,
      fiscale: { ...fis, regime: regimeEl.value }, // ricordato per la prossima volta
    };
    const prof = VaultDAO.state.invoiceProfile;
    const clientEmail = (emailEl.value || '').trim();
    const year = new Date().getFullYear();
    const number = nextInvoiceNumber(VaultDAO.state.invoices || [], year);
    const inv = computeInvoice({ imponibile: imp, regime: regimeEl.value, country: prof.country });
    const meta = { number, year, date: new Date().toLocaleDateString('it-IT'), client, description: descEl.value.trim(), emitter: prof.emitter, emitterInfo, logo: prof.logo, accent: prof.accent, country: prof.country, clientInfo, regime: regimeEl.value };
    // salva nello storico (numerazione + apprendimento cliente/email + dati
    // fiscali del cliente per il riuso + flag ricorrente per il promemoria)
    const recurring = !!($('#inv-recurring') && $('#inv-recurring').checked);
    const hasCliFiscal = cliFis.partitaIva || cliFis.codiceFiscale || cliFis.indirizzo;
    VaultDAO.state.invoices = [...(VaultDAO.state.invoices || []), { number, year, date: new Date().toISOString().slice(0, 10), client, imponibile: imp, description: descEl.value.trim(), regime: regimeEl.value, clientEmail, country: prof.country, ...(opts.electronic ? { isElectronic: true, sdiTransmitted: false } : {}), ...(hasCliFiscal ? { clientFiscale: cliFis } : {}), ...(recurring ? { recurring: true, cadence: 'mensile' } : {}) }];
    VaultDAO.save();
    // dati strutturati per la fattura elettronica (usati dall'handler XML)
    const emitterFiscal = { ...fis, denominazione: prof.emitter, regime: regimeEl.value, nazione: 'IT' };
    const clientFiscal = { ...cliFis, nazione: 'IT' };
    return { inv, meta, clientEmail, number, year, emitterFiscal, clientFiscal };
  };

  // "Scarica PDF": genera e SCARICA il PDF vero (nome file intelligente). Il
  // logo (se caricato) resta nella stampa HTML → per questo offro anche "Stampa".
  $('#inv-generate').addEventListener('click', () => {
    const res = buildAndSave();
    if (!res) return;
    const fname = invoiceFilename({ number: res.number, year: res.year, client: res.meta.client, isoDate: new Date().toISOString().slice(0, 10) });
    const url = URL.createObjectURL(invoicePdfBlob(res.inv, res.meta));
    const a = document.createElement('a'); a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    closeModal();
    showToast(`PDF fattura n.${res.number}/${res.year} scaricato.`, 'success');
    renderAnalysis();
  });

  // ✉️ Invia al cliente CON LA FATTURA ALLEGATA: usa la Web Share API
  // (navigator.share con file) → il foglio di condivisione (email/WhatsApp...)
  // allega davvero il documento. Dove non supportata (molti desktop), fallback
  // a mailto (email già scritta) + apertura del documento per salvare il PDF.
  $('#inv-email-send').addEventListener('click', async () => {
    const res = buildAndSave();
    if (!res) return;
    const email = buildInvoiceEmail({ inv: res.inv, meta: res.meta, clientEmail: res.clientEmail });
    // PDF VERO (invoice-pdf.js, on-device, nessuna dipendenza) — nome file
    // intelligente (numero + cliente + data).
    const fname = invoiceFilename({ number: res.number, year: res.year, client: res.meta.client, isoDate: new Date().toISOString().slice(0, 10) });
    const file = new File([invoicePdfBlob(res.inv, res.meta)], fname, { type: 'application/pdf' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: email.subject, text: email.body });
        closeModal(); showToast('Condivisione aperta con la fattura allegata.', 'success'); renderAnalysis(); return;
      }
    } catch (e) { if (e && e.name === 'AbortError') return; /* utente ha annullato */ }
    // Fallback universale (desktop senza Web Share): SCARICO il file fattura
    // (così è già pronto da allegare, semplice per tutti) e apro l'email già
    // scritta. Zero passaggi oscuri.
    const url = URL.createObjectURL(file);
    const a = document.createElement('a'); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    window.location.href = email.mailto;
    closeModal();
    showToast('Fattura scaricata: allegala all\'email che si è aperta.', 'success');
    renderAnalysis();
  });

  // FATTURA ELETTRONICA (XML): il file ufficiale per lo SdI. Prima CONTROLLA
  // (predizione scarti SdI, offline): se manca qualcosa lo dice in chiaro, apre
  // le sezioni giuste e mette a fuoco il primo campo mancante — guida per chi
  // non ha mai fatturato. Se è tutto ok, scarica l'XML e spiega come caricarlo.
  const FOCUS_MAP = {
    'emitter.partitaIva': '#inv-piva', 'emitter.denominazione': '#inv-emitter', 'emitter.indirizzo': '#inv-indirizzo',
    'emitter.cap': '#inv-cap', 'emitter.comune': '#inv-comune',
    'client.denominazione': '#inv-client', 'client.idFiscale': '#inv-cli-piva', 'client.indirizzo': '#inv-cli-indirizzo',
    'client.cap': '#inv-cli-cap', 'client.comune': '#inv-cli-comune',
  };
  $('#inv-xml').addEventListener('click', () => {
    const client = clientEl.value.trim();
    const imp = parseFloat(String(amountEl.value).replace(',', '.'));
    const emitterFiscal = { ...currentFiscal(), denominazione: ($('#inv-emitter').value || '').trim(), regime: regimeEl.value, nazione: 'IT' };
    const clientFiscal = { ...currentClientFiscal(), nazione: 'IT' };
    const inv = (imp > 0) ? computeInvoice({ imponibile: imp, regime: regimeEl.value, country: 'IT' }) : { imponibile: 0 };
    const year = new Date().getFullYear();
    const number = nextInvoiceNumber(VaultDAO.state.invoices || [], year);
    const meta = { number, year, date: new Date().toISOString().slice(0, 10), regime: regimeEl.value, description: descEl.value.trim() };
    const missing = missingForFatturaPa({ emitter: emitterFiscal, client: clientFiscal });
    const { controls, blocking } = buildFatturaPaXML({ emitter: emitterFiscal, client: clientFiscal, invoice: inv, meta });
    const box = $('#inv-xml-controls');
    if (blocking || missing.length) {
      // apri SOLO le sezioni che servono, per non disorientare
      const detEmit = document.querySelector('#modal-body details'); if (detEmit && missing.some(m => m.field.startsWith('emitter'))) detEmit.open = true;
      const detCli = $('#inv-client-fiscal'); if (detCli && missing.some(m => m.field.startsWith('client'))) detCli.open = true;
      const items = [
        ...missing.map(m => `<li><b>${m.label}</b> <span class="opacity-70">— ${m.help}</span></li>`),
        ...controls.filter(c => c.level === 'error' && !missing.length).map(c => `<li>${c.message}</li>`),
      ];
      box.className = 'text-[11px] leading-snug rounded-xl border px-3 py-2.5 border-amber-500/40 bg-amber-500/10 text-amber-200';
      box.innerHTML = `<div class="font-bold mb-1">Ci manca qualcosa per la fattura elettronica:</div><ul class="list-disc pl-4 space-y-0.5">${items.join('')}</ul>`;
      box.classList.remove('hidden');
      const id = missing[0] && FOCUS_MAP[missing[0].field];
      if (id && $(id)) setTimeout(() => $(id).focus(), 60);
      showToast('Completa i campi indicati per la fattura elettronica.', 'error');
      return;
    }
    // Tutto in regola coi controlli offline → salva e scarica l'XML.
    const res = buildAndSave({ electronic: true }); // marca come e-fattura da trasmettere
    if (!res) return;
    const out = buildFatturaPaXML({ emitter: res.emitterFiscal, client: res.clientFiscal, invoice: res.inv, meta: { number: res.number, year: res.year, date: new Date().toISOString().slice(0, 10), regime: regimeEl.value, description: res.meta.description } });
    const warns = out.controls.filter(c => c.level === 'warn');
    const url = URL.createObjectURL(new Blob([out.xml], { type: 'application/xml' }));
    const a = document.createElement('a'); a.href = url; a.download = out.filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    box.className = 'text-[11px] leading-snug rounded-xl border px-3 py-2.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-200';
    box.innerHTML = `<div class="font-bold mb-1">Fattura elettronica pronta ✓</div>
      <div><b>${out.filename}</b> è stato scaricato. Caricalo sul portale <b>Fatture e Corrispettivi</b> dell’Agenzia delle Entrate (accesso SPID), oppure invialo al commercialista. Momentum non può caricarlo da solo: serve il tuo accesso ufficiale.</div>
      <div class="flex flex-wrap gap-2 mt-2">
        <a href="${SDI_PORTAL_URL}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-100">Apri il portale Fatture e Corrispettivi<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg></a>
        <button type="button" id="inv-how-upload" class="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full border border-emerald-400/30 text-emerald-100/90">Come si carica?</button>
      </div>
      ${warns.length ? `<div class="mt-2 opacity-80">Nota: ${warns.map(w => w.message).join(' ')}</div>` : ''}`;
    box.classList.remove('hidden');
    $('#inv-how-upload')?.addEventListener('click', () => showUploadHelp(out.filename));
    showToast('XML fattura elettronica scaricato.', 'success');
    renderAnalysis();
  });

  // Pre-selezione da promemoria proattivo: apre il form già compilato per il
  // cliente ricorrente della fattura mensile da fare (un tap dall'avviso).
  if (prefillClient) {
    const c = recurring.find(x => x.client === prefillClient) || suggestFromHistory(VaultDAO.state.invoices || [], prefillClient);
    if (c) {
      clientEl.value = c.client;
      if (c.typicalAmount || c.suggestedImponibile) amountEl.value = c.typicalAmount || c.suggestedImponibile;
      if (c.lastDescription) descEl.value = c.lastDescription;
      if (c.lastEmail) emailEl.value = c.lastEmail;
      if (c.lastRegime && regimeEl.querySelector(`option[value="${c.lastRegime}"]`)) regimeEl.value = c.lastRegime;
      if ($('#inv-recurring')) $('#inv-recurring').checked = !!c.monthly;
      fillClientFiscal(lastClientFiscal(c.client));
    }
  }
  // Guida iniziale + apri i dati fiscali del cliente se serve la e-fattura e
  // non ci sono ancora (aiuta chi inizia; chi ce li ha già li vede compilati).
  const initRec = syncGuidance();
  if (initRec.needsFatturaPa && $('#inv-client-fiscal') && !currentClientFiscal().partitaIva && !currentClientFiscal().codiceFiscale) {
    // lasciata chiusa di default per non spaventare: si apre al bisogno (click XML)
  }
  refresh();
};
// Auto-apprendimento fiscale: la conferma dell'utente insegna a Momentum come
// classificare quel mittente d'ora in poi (integrato nel loop di apprendimento).
window.learnIncome = (description, kind) => {
  VaultDAO.state.taxLearned = learnIncomeType(VaultDAO.state.taxLearned || {}, description, kind);
  VaultDAO.save();
  showToast(kind === 'invoice' ? 'Segnata come fattura: la ricorderò.' : 'Segnata come non imponibile.', 'success');
  renderAnalysis();
};

// Layer investimenti (src/alpha/): quanto investire (bridge, fondo emergenza
// prima) + regime di mercato se l'utente ha fornito una serie prezzi.
function renderInvestments() {
  const surplusEl = $('#invest-surplus'), noteEl = $('#invest-note'), regimeEl = $('#invest-regime');
  if (!surplusEl) return;
  // media uscite/entrate e fondo (investimenti accumulati) dallo storico
  const months = {}; let invested = 0;
  for (const t of Object.values(VaultDAO.state.transactions || {}).flat()) {
    const mk = (t.date || '').slice(0, 7); if (!mk) continue;
    const m = months[mk] = months[mk] || { inc: 0, out: 0 };
    if (t.type === 'entrata') m.inc += t.amount;
    else if (t.type === 'uscita') m.out += t.amount;
    else if (t.type === 'invest') invested += t.amount;
  }
  const keys = Object.keys(months); const n = keys.length || 1;
  const avgExp = keys.reduce((s, kk) => s + months[kk].out, 0) / n;
  const nowMk = monthKey(new Date());
  const cur = months[nowMk] || { inc: 0, out: 0 };
  // Preferenze dal profilo di onboarding (le domande iniziali che ora servono):
  const prefs = VaultDAO.state.investmentPrefs || {};
  const r = investableSurplus({ netMonthlyFlow: cur.inc - cur.out, avgMonthlyExpense: avgExp, currentEmergencyFund: invested, emergencyMonths: prefs.emergencyMonths ?? 6, investFraction: prefs.investFraction ?? 0.7 });
  surplusEl.textContent = r.investable > 0 ? formatMoney(r.investable) : (r.toEmergencyFund ? formatMoney(r.toEmergencyFund) : '0€');
  noteEl.textContent = r.note;
  regimeEl.textContent = '';
}

// Patrimonio netto unificato (src/alpha/net-worth.js): UN numero dominante =
// contante (dai movimenti) + posizioni (VaultDAO.state.positions, additive) −
// debiti. Sotto: proiezione Monte Carlo a 10 anni per strategia con ipotesi
// DICHIARATE — semplice come un salvadanaio: "quanto ho" e "dove può arrivare".
function renderNetWorth() {
  const totalEl = $('#net-worth-total'), breakEl = $('#net-worth-breakdown'), projEl = $('#net-worth-projection');
  if (!totalEl) return;
  const positions = VaultDAO.state.positions || [];
  const n = computeNetWorth({
    transactions: VaultDAO.state.transactions || {},
    positions,
    currentPriceByTicker: window.__livePrices || {},
    manualAssets: VaultDAO.state.manualAssets || [],
    liabilities: VaultDAO.state.liabilities || 0,
  });
  totalEl.textContent = formatMoney(n.total);
  const parts = [`contante ${formatMoney(n.cash)}`];
  if (n.invested > 0) parts.push(`investito ${formatMoney(n.invested)}${n.stale ? ' (a costo: prezzo live assente, stimato)' : ''}`);
  if (n.liabilities > 0) parts.push(`debiti −${formatMoney(n.liabilities)}`);
  breakEl.textContent = parts.join(' · ');
  // Proiezione per strategia: parte dal patrimonio investibile attuale, con il
  // risparmio medio mensile come contributo. Tabella minima p5/p50/p95.
  if (projEl) {
    const start = Math.max(0, n.total);
    const monthsN = Object.keys(VaultDAO.state.transactions || {}).length || 1;
    let inc = 0, out = 0;
    for (const t of Object.values(VaultDAO.state.transactions || {}).flat()) {
      if (t.type === 'entrata') inc += t.amount; else if (t.type === 'uscita') out += t.amount;
    }
    const monthlySave = Math.max(0, (inc - out) / monthsN);
    if (start > 0 || monthlySave > 0) {
      const proj = projectNetWorthByStrategy({ start, monthlyContribution: monthlySave, years: 10, paths: 1000, seed: 12345 });
      projEl.innerHTML = `<table class="w-full text-[10px] font-mono"><thead><tr class="text-[var(--on-surface-secondary)]"><th class="text-left font-normal">Strategia (10 anni)</th><th class="text-right font-normal">se va male</th><th class="text-right font-normal">tipico</th><th class="text-right font-normal">se va bene</th></tr></thead><tbody>${
        proj.rows.map(r => `<tr><td class="text-left text-slate-300 py-0.5">${r.label}</td><td class="text-right text-rose-300">${formatMoney(r.p5)}</td><td class="text-right text-[var(--gold)]">${formatMoney(r.p50)}</td><td class="text-right text-emerald-300">${formatMoney(r.p95)}</td></tr>`).join('')
      }</tbody></table>`;
    } else projEl.innerHTML = '';
  }
}

// Ghost Charge Radar VISIBILE: mostra gli abbonamenti ricorrenti scovati dal
// motore (src/predict/subscriptions.js) — prima esisteva ma non era in UI.
// Predittivo: prossimo addebito stimato dalla cadenza; segnala gli aumenti di
// prezzo. Semplice e chiaro (nome · prossima data · importo).
const renderSubscriptions = () => {
  const list = document.getElementById('subs-list');
  const totalEl = document.getElementById('subs-total');
  if (!list) return;
  const s = subscriptionSummary(VaultDAO.state.transactions, new Date());
  if (totalEl) totalEl.textContent = s.count ? `${formatMoney(s.monthlyTotal)}/mese` : '';
  if (!s.count) {
    list.innerHTML = `<p class="text-[11px] text-[var(--on-surface-secondary)]">Nessun abbonamento ricorrente per ora. Appena importi qualche mese di spese, te li scovo qui — col prossimo addebito previsto.</p>`;
    return;
  }
  const hikeMap = new Map(s.hikes.map(h => [h.description, h]));
  const fmtDay = d => new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  // AVVISI ANTICIPATORI (anticipatePriceHikes): creep silenzioso + rincaro
  // previsto PRIMA dell'addebito, con impatto annuale (rende concreto il "poco"
  // mensile). Ambra = attenzione consapevole, mai giudizio. In cima, è il valore.
  const anticipated = (s.anticipated || []).slice(0, 3);
  const warnIco = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 shrink-0 mt-0.5"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/></svg>`;
  const anticipatedHtml = anticipated.map(a => {
    const body = a.type === 'upcoming-rise'
      ? `<b>${a.name}</b> tra ${a.daysToNext} giorn${a.daysToNext === 1 ? 'o' : 'i'} potrebbe passare da ${formatMoney(a.current)} a ~${formatMoney(a.predictedNext)} (stima dal trend). Sono <b>+${formatMoney(a.annualImpact)}/anno</b>.`
      : `<b>${a.name}</b> è salito da ${formatMoney(a.baseline)} a ${formatMoney(a.current)} (+${a.totalPct}%) un po' alla volta: <b>+${formatMoney(a.annualImpact)}/anno</b> senza che si notasse.`;
    return `<div class="flex items-start gap-2 p-2.5 rounded-xl border border-amber-500/25 bg-amber-950/10 text-amber-200 text-[11px] leading-snug">${warnIco}<span>${body}</span></div>`;
  }).join('');
  list.innerHTML = (anticipatedHtml ? `<div class="flex flex-col gap-2 mb-2">${anticipatedHtml}</div>` : '') + s.subscriptions.slice(0, 12).map(sub => {
    const hike = hikeMap.get(sub.name);
    return `<div class="flex items-center justify-between gap-3 p-2 rounded-xl" style="background:rgba(255,255,255,0.03)">
      <div class="min-w-0">
        <p class="text-sm font-bold truncate">${sub.name}</p>
        <p class="text-[10px] text-[var(--on-surface-secondary)]">prossimo ~${fmtDay(sub.nextDate)}${hike ? ` · <span class="text-rose-400">↑ +${hike.increasePct}% (era ${formatMoney(hike.previousAmount)})</span>` : ''}</p>
      </div>
      <span class="text-sm font-black font-mono shrink-0">${formatMoney(sub.amount)}</span>
    </div>`;
  }).join('');
};

// Rende uniformi tutti gli avvisi in #radar-alerts-container: anomalie
// (AnomalyDetector, invariato) + insight consolidati dell'advisor
// (src/predict/advisor.js — prima erano blocchi HTML inline separati per
// budget stantio e aumenti di prezzo, con stili e logica duplicati).
const SEVERITY_STYLE = {
  danger: { border: 'border-rose-500/20 bg-rose-950/5', text: 'text-rose-400' },
  warn:   { border: 'border-amber-500/20 bg-amber-950/5', text: 'text-amber-400' },
  info:   { border: 'border-sky-500/20 bg-sky-950/5', text: 'text-sky-400' },
};

function renderRadarAlerts(k, budgetLimit, hwDailyLevel) {
  try { renderSubscriptions(); } catch (e) { console.error('renderSubscriptions:', e); } // abbonamenti trovati (Ghost Charge Radar)
  const alertsBox = $('#radar-alerts-container');
  if (!alertsBox) return;
  alertsBox.innerHTML = '';

  const anomalies = AnomalyDetector.detectAll().filter(a => monthKey(new Date(a.tx.date)) === k);
  // Ghost Radar v2: le anomalie con esercente MAI visto prima diventano
  // interattive — "È mia" conferma e addestra l'AI (modelStats), "Non la
  // riconosco" marca la tx come sospetta (campo additivo, mai tocca importo).
  const unknownIds = new Set(findUnknownMerchants(anomalies, VaultDAO.state.transactions).map(a => a.tx.id));
  if (anomalies.length > 0) {
    alertsBox.innerHTML += `
      <div class="card p-4 border border-rose-500/20 bg-rose-950/5">
        <h4 class="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-2">Spese insolite: le riconosci?</h4>
        <div class="space-y-2 text-xs text-slate-300">
          ${anomalies.map(a => {
            const suspect = a.tx.suspect;
            const feedback = unknownIds.has(a.tx.id) && !suspect
              ? `<div class="flex gap-2 mt-1">
                   <button onclick="window.confirmAnomalyMine('${a.tx.id}')" class="text-[10px] font-bold text-emerald-400 underline">È mia</button>
                   <button onclick="window.flagAnomalySuspect('${a.tx.id}')" class="text-[10px] font-bold text-rose-400 underline">Non la riconosco</button>
                 </div>`
              : suspect ? `<div class="inline-flex items-center gap-1 text-[10px] text-rose-400 font-bold mt-0.5"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3 h-3"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/></svg>segnata come sospetta</div>` : '';
            return `<div>${a.tx.description} (+${a.zScore.toFixed(1)}σ) → <b>${formatMoney(a.tx.amount)}</b>${feedback}</div>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  // Gli insight monetari si riferiscono sempre a OGGI reale (il mese
  // visualizzato può essere un altro: proiezioni e safe-to-spend su un mese
  // passato sarebbero numeri fuori contesto). Il safe-to-spend qui viene
  // filtrato: ha già la sua card grande in dashboard, ripeterlo è rumore.
  const realNow = new Date();
  const staleness = budgetLimit > 0 ? isBudgetStale(budgetLimit, VaultDAO.state.transactions) : { stale: false };
  const rawInsights = getAdvisorInsights({
    allTx: VaultDAO.state.transactions,
    monthTxs: VaultDAO.state.transactions[monthKey(realNow)] || [],
    monthlyBudget: VaultDAO.state.monthlyBudget,
    referenceDate: realNow,
    hwDailyLevel,
    staleness,
    savingsGoals: VaultDAO.state.savingsGoals || [],
    lastSweepWeek: VaultDAO.state.lastSweepWeek || null,
  }).filter(i => i.kind !== 'safe-to-spend');

  // ── Advisor bandit (Wave 1 v10, src/predict/advisor-bandit.js): impara
  // per-contesto quale nudge fa AGIRE l'utente e lo mostra prima. Onesto e
  // additivo: senza dati (bandit vuoto) l'ordine resta quello dell'advisor
  // (rank per severity), zero effetto sul comportamento pre-esistente.
  const todayKey = realNow.toISOString().slice(0, 10);
  const settled = settleImpressions(VaultDAO.state.advisorBandit, VaultDAO.state.banditPending, todayKey);
  VaultDAO.state.advisorBandit = settled.state;
  VaultDAO.state.banditPending = settled.pending;
  const banditCtx = banditContext({ overBudget: rawInsights.some(i => i.severity === 'danger'), phase: phaseOfMonth(realNow) });
  const insights = rankNudges(rawInsights, VaultDAO.state.advisorBandit, { context: banditCtx, explore: true, rng: makeRng(dailySeed(realNow)) });
  if (insights.length) {
    // mergePendingSameDay (non makeImpressions diretto): renderAnalysis() viene
    // chiamato più volte nello stesso giorno (forecast worker, sync, cambio
    // vista) — sovrascrivere pending da zero perderebbe i tap già registrati.
    VaultDAO.state.banditPending = mergePendingSameDay(VaultDAO.state.banditPending, todayKey, banditCtx, insights.map(i => i.kind));
  }
  VaultDAO.save();

  for (const ins of insights) {
    const style = SEVERITY_STYLE[ins.severity] || SEVERITY_STYLE.info;
    const itemsHtml = ins.items
      ? `<div class="space-y-1.5 text-xs text-slate-300 mt-1.5">${ins.items.map(h => `<div>${h.description}: ${formatMoney(h.previousAmount)} → <b>${formatMoney(h.newAmount)}</b> (+${h.increasePct}%)</div>`).join('')}</div>`
      : '';
    const actionHtml = ins.action
      ? `<button onclick='window.nudgeActed(${JSON.stringify(ins.kind)}, ${JSON.stringify(ins.action.handler || 'applyBudgetSuggestion')}, ${JSON.stringify(ins.action.payload).replace(/'/g, "&#39;")})' class="text-[11px] font-bold ${style.text} underline mt-1.5">${ins.action.label}</button>`
      : '';
    alertsBox.innerHTML += `
      <div class="card p-4 border ${style.border}">
        <h4 class="text-[10px] font-bold ${style.text} uppercase tracking-widest mb-2">${ins.title}</h4>
        <p class="text-xs text-slate-300">${ins.body}</p>
        ${itemsHtml}${actionHtml}
      </div>
    `;
  }

  // Recap della settimana scorsa (src/predict/engagement.js): la
  // gratificazione periodica che manca a quasi tutte le app di spese —
  // solo fatti misurati, appare solo se c'erano transazioni.
  const recap = computeWeeklyRecap(VaultDAO.state.transactions, realNow);
  if (recap) {
    const deltaTxt = recap.deltaPct !== null
      ? (recap.deltaPct <= 0
          ? `<b class="text-emerald-400">${Math.abs(recap.deltaPct)}% in meno</b> della settimana prima`
          : `<b class="text-amber-400">${recap.deltaPct}% in più</b> della settimana prima`)
      : '';
    const savedTxt = recap.saved > 0
      ? `<div class="mt-1">Hai messo da parte <b class="text-emerald-400">${formatMoney(recap.saved)}</b>. Continua così.</div>`
      : '';
    alertsBox.innerHTML += `
      <div class="card p-4 border border-indigo-500/20 bg-indigo-950/5">
        <h4 class="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">La tua settimana scorsa</h4>
        <div class="text-xs text-slate-300 space-y-0.5">
          <div>Hai speso <b>${formatMoney(recap.totalSpent)}</b>${deltaTxt ? `, ${deltaTxt}` : ''}.</div>
          ${recap.topCategory ? `<div>Quasi tutto in <b>${getCatById(recap.topCategory.id).name}</b> (${formatMoney(recap.topCategory.amount)}).</div>` : ''}
          ${savedTxt}
        </div>
      </div>
    `;
  }

  // NOTA UX (feedback utente 2026-07-20): "La tua vita questo mese" e "Prossimo
  // traguardo" sono stati SPOSTATI sulla Dashboard (riga-insight semplice), per
  // non trasformare Analisi in un muro di card difficile da capire. Qui restano
  // solo gli avvisi azionabili + il recap + gli abbonamenti CONSOLIDATI.

  // Abbonamenti rilevati ma non registrati: UNA sola card che li raccoglie
  // tutti (prima erano 3 card "Abbonamento trovato" identiche impilate — il
  // peggior offensore del disordine). Un tap per ciascuno li registra.
  const proposals = suggestSubscriptionRegistrations(VaultDAO.state.transactions, VaultDAO.state.subscriptions).slice(0, 4);
  if (proposals.length) {
    const rows = proposals.map(p =>
      `<div class="flex items-center justify-between gap-2 py-1">
        <span class="min-w-0 truncate">${p.description} · <b>${formatMoney(p.amount)}</b>/mese</span>
        <button onclick='window.registerDetectedSubscription(${JSON.stringify(p).replace(/'/g, "&#39;")})' class="text-[11px] font-bold text-emerald-400 underline shrink-0">registra</button>
      </div>`).join('');
    alertsBox.innerHTML += `
      <div class="card p-4 border border-emerald-500/20 bg-emerald-950/5">
        <h4 class="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2">${proposals.length === 1 ? 'Abbonamento trovato' : `${proposals.length} abbonamenti trovati`}</h4>
        <div class="text-xs text-slate-300 divide-y divide-emerald-500/10">${rows}</div>
      </div>
    `;
  }
}

// Backup cifrato "DNA" (src/core/backup.js): esporta tutto lo stato del
// vault in un file .momentum protetto da passphrase. Risposta alla perdita
// del dispositivo senza tradire il principio "nessun dato su server".
window.exportEncryptedBackup = async () => {
  const pass = prompt('Scegli una passphrase per proteggere il backup (ricordala: senza, i dati non si recuperano):');
  if (!pass) return;
  try {
    const envelope = await encryptBackup(VaultDAO.state, pass);
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `momentum-backup-${new Date().toISOString().slice(0, 10)}.momentum`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Backup cifrato salvato. Conservalo al sicuro.', 'success');
  } catch (e) { showToast(e.message, 'error'); }
};

window.restoreEncryptedBackup = async (file) => {
  const pass = prompt('Passphrase del backup:');
  if (!pass) return;
  try {
    const envelope = JSON.parse(await file.text());
    const restored = await decryptBackup(envelope, pass);
    if (!confirm('Ripristinare sovrascriverà i dati attuali su questo dispositivo. Procedere?')) return;
    VaultDAO.state = { ...VaultDAO.state, ...restored, currentDate: new Date() };
    VaultDAO.save();
    showToast('Dati ripristinati. Ricarico…', 'success');
    setTimeout(() => window.location.reload(), 1000);
  } catch (e) { showToast(e.message, 'error'); }
};

// Export dataset correzioni (W7): storico descrizione→categoria + modelStats,
// pronto per il riaddestramento Python (train_meso.py) verso il modello v2.
window.exportTrainingData = () => {
  const examples = [];
  for (const m of Object.keys(VaultDAO.state.transactions)) {
    for (const t of VaultDAO.state.transactions[m]) {
      if (t.description && t.description.trim() && t.category) {
        examples.push({ text: t.description, label: t.category });
      }
    }
  }
  const payload = { examples, modelStats: VaultDAO.state.mlData?.modelStats || {}, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `momentum-training-data-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast(`${examples.length} esempi esportati per il riaddestramento.`, 'success');
};

// Punto d'ingresso UNICO dei tap sui nudge dell'advisor (Wave 1 v10): premia
// il bandit (reward=1, il segnale onesto "l'utente ha agito") PRIMA di
// eseguire l'azione reale, poi delega all'handler esistente invariato.
window.nudgeActed = (kind, handlerName, payload) => {
  const pending = VaultDAO.state.banditPending;
  if (pending && pending.kinds.includes(kind) && !pending.acted.includes(kind)) {
    VaultDAO.state.advisorBandit = banditObserve(VaultDAO.state.advisorBandit, { context: pending.context, kind, reward: 1 });
    pending.acted.push(kind);
    VaultDAO.save();
  }
  const handler = window[handlerName];
  if (typeof handler === 'function') handler(payload);
};

// Sweep dell'avanzo settimanale: registra il trasferimento come investimento
// (mai automatico: parte solo dal tocco dell'utente) e ricorda la settimana
// per non riproporre. Il progresso dell'obiettivo si aggiorna da solo
// (computeGoalProgress conta il netto entrate-uscite-invest... no: conta
// entrate-uscite; la tx invest riduce la liquidità e finisce nel salvadanaio).
window.applySweep = (sweep) => {
  const now = new Date();
  VaultDAO.addTransaction(monthKey(now), {
    id: Date.now(),
    amount: sweep.amount,
    type: 'invest',
    category: 'risparmio',
    description: sweep.goalName ? `Messo da parte per ${sweep.goalName}` : 'Messo da parte (avanzo settimana)',
    date: now.toISOString(),
  });
  VaultDAO.state.lastSweepWeek = sweep.weekKey; // campo additivo
  VaultDAO.save();
  showToast(`${formatMoney(sweep.amount)} messi da parte. Bravo.`, 'success');
  renderDashboard();
  renderAnalysis({ skipHeavyForecast: true });
};

// Ghost Radar v2: feedback che addestra. Trova la tx per id in qualsiasi mese.
function findTxById(id) {
  for (const m of Object.keys(VaultDAO.state.transactions)) {
    const t = VaultDAO.state.transactions[m].find(t => String(t.id) === String(id));
    if (t) return t;
  }
  return null;
}
// "È mia": conferma la categoria attuale → l'orchestratore impara (modelStats,
// v3) che quella descrizione va in quella categoria. Rinforzo reale.
window.confirmAnomalyMine = (id) => {
  const t = findTxById(id);
  if (!t) return;
  if (window.momentumOrchestrator) {
    window.momentumOrchestrator.classify(t.description, t.amount, new Date(t.date));
    window.momentumOrchestrator.learn(t.description, t.category, t.amount, new Date(t.date));
  }
  showToast('Ok, ho imparato che è una spesa tua.', 'success');
  renderAnalysis({ skipHeavyForecast: true });
};
// "Non la riconosco": marca la tx come sospetta (campo additivo, MAI tocca
// amount/category/hash → hash chain intatta) per l'evidenza rossa nel ledger.
window.flagAnomalySuspect = (id) => {
  const t = findTxById(id);
  if (!t) return;
  t.suspect = true;
  VaultDAO.save();
  showToast('Segnata come sospetta. Controllala sul tuo conto.', 'info');
  renderAnalysis({ skipHeavyForecast: true });
};

// Registrazione one-tap di un abbonamento rilevato: entra in
// state.subscriptions con la stessa forma usata da oracle.js (campo amount).
window.registerDetectedSubscription = (p) => {
  VaultDAO.state.subscriptions = VaultDAO.state.subscriptions || [];
  VaultDAO.state.subscriptions.push({ name: p.description, amount: p.amount, category: p.category, addedBy: 'auto-rilevato', addedAt: new Date().toISOString() });
  VaultDAO.save();
  showToast(`Abbonamento "${p.description}" registrato.`, 'success');
  renderAnalysis({ skipHeavyForecast: true });
}


// ==========================================
// P2P SYNC CODES
// ==========================================
window.generateSyncQR = () => {
  const stateString = localStorage.getItem('omega_core_db');
  if (!stateString) return;
  const compressed = btoa(stateString);
  // Simulating visual QR / text code modal
  openModal(`
    <div class="p-4 space-y-4">
      <h3 class="text-lg font-bold">Node Sync Token</h3>
      <p class="text-xs text-slate-400">Copia questo token e incollalo sulla scheda dell'altro dispositivo per sincronizzare:</p>
      <textarea class="w-full h-32 p-2 bg-black border border-[var(--outline)] text-xs font-mono rounded-lg" readonly>${compressed}</textarea>
      <button onclick="navigator.clipboard.writeText('${compressed}'); showToast('Token copiato!', 'success');" class="save-btn w-full !m-0">Copia Token</button>
    </div>
  `);
};

window.connectWebRTCPeer = () => {
  const token = $('#webrtc-peer-input').value.trim();
  if (!token) return;
  try {
    const decoded = atob(token);
    JSON.parse(decoded); // validate JSON
    localStorage.setItem('omega_core_db', decoded);
    VaultDAO.init();
    renderDashboard();
    renderAnalysis();
    closeModal();
    showToast("Sincronizzazione P2P Completata!", "success");
  } catch(e) {
    showToast("Token non valido.", "error");
  }
};

window.exportOmegaDNA = () => {
  const flat = [];
  Object.keys(VaultDAO.state.transactions).forEach(m => flat.push(...VaultDAO.state.transactions[m]));
  const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
    meta: { schema: SCHEMA_VERSION, generatedAt: new Date().toISOString() },
    transactions: flat,
    budget: VaultDAO.state.monthlyBudget,
    aggression: VaultDAO.state.aiAggression
  }))));
  const blob = new Blob([payload], { type: 'application/octet-stream' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `momentum_dna_${Date.now()}.momentum`;
  link.click();
  showToast("DNA Esportato con successo.", "success");
};

window.setAIAggression = (mode) => {
  haptic('light');
  VaultDAO.state.aiAggression = mode;
  VaultDAO.save();
  $$('.segment-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.aiMode === mode);
    if (mode === 'predator' && btn.dataset.aiMode === 'predator') btn.classList.add('predator');
  });
  showToast("Aggressività AI aggiornata.", "success");
};

window.toggleGhostRadar = () => {
  VaultDAO.state.ghostRadarActive = $('#settings-ghost-radar').checked;
  VaultDAO.save();
  showToast("Ghost Radar aggiornato.", "success");
};

window.nukeVault = () => {
  if (confirm("Distruggere l'intero database locale? Questa azione è irreversibile.")) {
    localStorage.clear();
    location.reload();
  }
};

// ==========================================
// BOOT & ONBOARDING LIFE CYCLES
// ==========================================
window.genesisStep = 0;
window.genesisNext = (step, value = '') => {
  try {
    haptic('light');
    if (step === 2) window.userRiskProfile = value;
    if (step === 3) window.userTimeHorizon = value;
    
    const cur = $(`#g-step-${window.genesisStep}`);
    const next = $(`#g-step-${step}`);
    if (cur) {
      cur.classList.remove('active');
      cur.classList.add('past');
    }
    if (next) {
      next.classList.remove('past');
      next.classList.add('active');
    }
    window.genesisStep = step;

    if (step === 3) initGenesisHold();
  } catch(e) { console.error("genesisNext error:", e); }
};

const initGenesisHold = () => {
  const btn = document.getElementById('genesis-btn');
  const fill = document.getElementById('genesis-ring-fill');
  if (!btn || !fill) return;
  endGenesis._done = false; // nuovo onboarding (anche dopo un reset): riarma

  let holdTimer = null;
  let startTimeout = null;
  let progress = 0;
  let isHoldActive = false;

  const startAction = (e) => {
    try { e.preventDefault(); } catch(err) {}
    haptic('light');
    
    isHoldActive = false;
    progress = 0;
    if (fill) fill.style.strokeDashoffset = 408.4;

    if (holdTimer) clearInterval(holdTimer);
    if (startTimeout) clearTimeout(startTimeout);

    // Wait 150ms. If still holding, treat as a hold gesture!
    startTimeout = setTimeout(() => {
      isHoldActive = true;
      holdTimer = setInterval(() => {
        progress += 5;
        const offset = 408.4 - (408.4 * progress) / 100;
        if (fill) fill.style.strokeDashoffset = offset;
        if (progress >= 100) {
          clearInterval(holdTimer);
          endGenesis();
        }
      }, 50);
    }, 150);
  };

  const endAction = (e) => {
    if (startTimeout) clearTimeout(startTimeout);
    
    if (isHoldActive) {
      if (holdTimer) clearInterval(holdTimer);
      if (progress < 100) {
        progress = 0;
        if (fill) fill.style.strokeDashoffset = 408.4;
      }
    } else {
      // Quick click/tap fallback: animate fast to 100% and unlock
      if (holdTimer) clearInterval(holdTimer);
      let p = 0;
      holdTimer = setInterval(() => {
        p += 10;
        const offset = 408.4 - (408.4 * p) / 100;
        if (fill) fill.style.strokeDashoffset = offset;
        if (p >= 100) {
          clearInterval(holdTimer);
          endGenesis();
        }
      }, 30);
    }
  };

  // ── Fix bug bloccante iOS: il "hold to Consacra" è un long-press, che su
  // iOS Safari fa partire la selezione del testo / il menu contestuale e
  // blocca l'utente nell'onboarding. Soluzione robusta:
  // 1) Pointer Events unificati (niente doppio-firing touch+mouse);
  // 2) preventDefault su pointer/touch/contextmenu → niente selezione/callout;
  // 3) pointer capture → l'up arriva anche se il dito scivola fuori;
  // 4) touch-action:none via CSS (#genesis-btn) → controllo pieno dal JS.
  const cancelHold = () => {
    if (startTimeout) clearTimeout(startTimeout);
    if (holdTimer) clearInterval(holdTimer);
    if (progress < 100) { progress = 0; if (fill) fill.style.strokeDashoffset = 408.4; }
  };
  btn.addEventListener('contextmenu', e => e.preventDefault());
  btn.addEventListener('selectstart', e => e.preventDefault());
  btn.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

  if (window.PointerEvent) {
    btn.addEventListener('pointerdown', (e) => {
      try { btn.setPointerCapture(e.pointerId); } catch (_) {}
      startAction(e);
    });
    btn.addEventListener('pointerup', endAction);
    btn.addEventListener('pointercancel', cancelHold);
  } else {
    // Fallback per browser molto vecchi senza Pointer Events
    btn.addEventListener('touchstart', startAction, { passive: false });
    btn.addEventListener('touchend', endAction);
    btn.addEventListener('mousedown', startAction);
    btn.addEventListener('mouseup', endAction);
    btn.addEventListener('mouseleave', cancelHold);
  }

  // Handle Enter / Space key press on document
  const keyHandler = (e) => {
    if (window.genesisStep === 3 && (e.key === 'Enter' || e.key === ' ')) {
      try { e.preventDefault(); } catch(err) {}
      document.removeEventListener('keydown', keyHandler);
      if (holdTimer) clearInterval(holdTimer);
      let p = 0;
      holdTimer = setInterval(() => {
        p += 10;
        const offset = 408.4 - (408.4 * p) / 100;
        if (fill) fill.style.strokeDashoffset = offset;
        if (p >= 100) {
          clearInterval(holdTimer);
          endGenesis();
        }
      }, 30);
    }
  };
  document.addEventListener('keydown', keyHandler);

  // TAP UNIVERSALE A PROVA DI DEVICE: il `click` è l'evento più affidabile su
  // ogni browser/OS (desktop, iOS, Android). Se il percorso pointer/hold non
  // scatta (bug iOS segnalato: il tap non registrava e l'utente restava
  // bloccato), il click GARANTISCE la consacrazione. endGenesis è idempotente,
  // quindi non c'è doppia esecuzione col percorso hold.
  btn.addEventListener('click', (e) => {
    try { e.preventDefault(); } catch(err) {}
    if (!endGenesis._done) {
      if (fill) fill.style.strokeDashoffset = 0; // anello pieno immediato
      haptic('medium');
      endGenesis();
    }
  });
};

const endGenesis = () => {
  // Idempotente: qualunque percorso (hold, tap, click, tastiera) può chiamarla,
  // ma la consacrazione avviene UNA sola volta — niente doppia esecuzione né
  // conflitti tra pointer e click.
  if (endGenesis._done) return;
  endGenesis._done = true;
  try {
    haptic('heavy');
    VaultDAO.state.isFirstLaunch = false;
    
    // Capture MASE profile
    VaultDAO.state.onboardingProfile = {
      riskProfile: window.userRiskProfile || 'bilanciato',
      horizon: window.userTimeHorizon || 'medio'
    };
    
    // Pre-seed budget based on profile
    if (VaultDAO.state.onboardingProfile.riskProfile === 'conservativo') {
      VaultDAO.state.monthlyBudget = 1000;
    } else if (VaultDAO.state.onboardingProfile.riskProfile === 'aggressivo') {
      VaultDAO.state.monthlyBudget = 2200;
    } else {
      VaultDAO.state.monthlyBudget = 1500;
    }

    // Le domande iniziali ora SERVONO davvero: il profilo rischio+orizzonte
    // parametrizza il motore investimenti (bridge/arbiter). Un profilo
    // aggressivo/lungo → più quota investibile, fondo emergenza più snello,
    // riskFloor più basso; conservativo/breve → cuscinetto più grande, quota
    // bassa. Campo additivo, usato da renderInvestments() e dai consigli.
    const risk = VaultDAO.state.onboardingProfile.riskProfile;
    const hz = VaultDAO.state.onboardingProfile.horizon;
    const investFraction = risk === 'aggressivo' ? 0.85 : risk === 'conservativo' ? 0.4 : 0.65;
    const emergencyMonths = risk === 'conservativo' ? 9 : risk === 'aggressivo' ? 4 : 6;
    const riskFloor = risk === 'conservativo' ? 0.35 : risk === 'aggressivo' ? 0.15 : 0.25;
    VaultDAO.state.investmentPrefs = { investFraction, emergencyMonths, riskFloor, horizon: hz };

    // Train HBNSN with initial profile weights (MASE prior seeding)
    NeuralNexus.initPriorWeights(VaultDAO.state.onboardingProfile);
    
    VaultDAO.save();
    const overlay = $('#genesis-container');
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.8s';
      setTimeout(() => overlay.remove(), 800);
    }
    
    const ota = $('#ota-overlay');
    const logBox = $('#ota-log-container');
    if (ota) ota.classList.add('active');
    
    const logs = [
      "Apertura di Momentum...",
      "Preparo i tuoi dati (restano solo sul tuo dispositivo)...",
      "Analizzo le tue abitudini di spesa...",
      "Attivo i freni gentili alle spese...",
      "Tutto pronto."
    ];
    let idx = 0;
    const interval = setInterval(() => {
      if (idx < logs.length) {
        if (logBox) logBox.innerHTML += `<p>> ${logs[idx]}</p>`;
        idx++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          if (ota) ota.classList.remove('active');
          const app = $('#app-core');
          if (app) {
            app.classList.remove('hidden');
            requestAnimationFrame(() => app.style.opacity = '1');
          }
          bootUI();
        }, 800);
      }
    }, 450);
  } catch (err) {
    console.error("endGenesis error:", err);
    // Fallback safety trigger
    const app = $('#app-core');
    if (app) {
      app.classList.remove('hidden');
      app.style.opacity = '1';
    }
    const gen = $('#genesis-container');
    if (gen) gen.remove();
    bootUI();
  }
};

const bootUI = () => {
  try {
    renderMeshStatus();
    const agg = VaultDAO.state.aiAggression;
    const btn = document.querySelector(`.segment-btn[data-ai-mode="${agg}"]`);
    if (btn) {
      btn.classList.add('active');
      if (agg === 'predator') btn.classList.add('predator');
    }
  } catch(e) { console.error(e); }

  try {
    const soundCheck = $('#settings-sound');
    if (soundCheck) soundCheck.checked = !!VaultDAO.state.soundActive;
  } catch(e) {}

  try {
    const desktopForm = $('#form-container-desktop');
    if (desktopForm) {
      desktopForm.innerHTML = getTxFormHTML();
      attachFormListeners(desktopForm);
    }
  } catch(e) { console.error(e); }

  try {
    renderDashboard();
  } catch(e) { console.error(e); }

  try {
    renderAnalysis();
  } catch(e) { console.error(e); }

  try {
    window.renderCalendarEvents();
  } catch(e) { console.error(e); }
};

const navigate = (view) => {
  haptic('light');
  VaultDAO.state.currentView = view;
  ['dashboard', 'analysis', 'settings'].forEach(v => {
    const el = $(`#${v}-view`);
    if (el) el.classList.toggle('hidden', v !== view);
  });
  $$('.mobile-nav .nav-btn').forEach(btn => {
    btn.classList.toggle('text-[var(--primary)]', btn.dataset.view === view);
    btn.classList.toggle('text-[var(--on-surface-secondary)]', btn.dataset.view !== view);
  });
  if (view === 'analysis') renderAnalysis();
};

window.openModal = (html) => {
  $('#modal-body').innerHTML = html;
  $('#modal-container').classList.remove('hidden');
  setTimeout(() => {
    $('#modal-backdrop').style.opacity = '1';
    $('#modal-content').classList.remove('translate-y-full', 'lg:scale-95', 'opacity-0');
  }, 10);
};

window.closeModal = () => {
  $('#modal-content').classList.add('translate-y-full', 'lg:scale-95', 'opacity-0');
  $('#modal-backdrop').style.opacity = '0';
  setTimeout(() => $('#modal-container').classList.add('hidden'), 300);
};

// Editor budget mensile a bassa frizione (src/predict/budget-advisor.js):
// prima di questo, l'unico posto per impostare il budget era l'onboarding
// una tantum (valore fisso 1000/1500/2200€ in base al profilo di rischio,
// mai più modificabile). Ora la card del budget è toccabile in qualsiasi
// momento, e il valore proposto non è un campo vuoto da indovinare ma la
// media reale degli ultimi mesi di spesa + margine di sicurezza — un tap
// per accettarlo, o si corregge a mano.
// ==========================================
// OBIETTIVI DI RISPARMIO (src/predict/engagement.js)
// ==========================================
function renderSavingsGoals() {
  const box = $('#savings-goals-container');
  if (!box) return;
  const goals = VaultDAO.state.savingsGoals || [];
  if (goals.length === 0) {
    box.innerHTML = `<p class="text-xs text-[var(--on-surface-secondary)]">Nessun obiettivo ancora. Creane uno: vedere la barra riempirsi è metà della motivazione.</p>`;
    return;
  }
  box.innerHTML = goals.map(g => {
    const prog = computeGoalProgress(g, VaultDAO.state.transactions);
    const barColor = prog.pct >= 100 ? 'var(--green)' : (prog.onTrack === false ? 'var(--yellow)' : 'var(--cyan)');
    const trackNote = prog.onTrack === null ? '' : (prog.onTrack
      ? `<span class="text-emerald-400">sei in linea</span>`
      : `<span class="text-amber-400">sei indietro rispetto al ritmo necessario</span>`);
    return `
      <div class="relative">
        <div class="flex justify-between items-baseline mb-1">
          <p class="text-xs font-bold">${g.name}</p>
          <button onclick="window.deleteSavingsGoal(${g.id})" class="text-[10px] text-[var(--on-surface-secondary)] opacity-60">rimuovi</button>
        </div>
        <div class="budget-track"><div class="budget-fill" style="width:${Math.min(100, prog.pct)}%; background:${barColor};"></div></div>
        <p class="text-[11px] text-[var(--on-surface-secondary)] mt-1">${formatMoney(prog.saved)} su ${formatMoney(g.target)} (${prog.pct}%) ${trackNote}</p>
      </div>
    `;
  }).join('');
}

// ==========================================
// PAIRING MESH (mente condivisa tra dispositivi)
// Scambio manuale di due codici (invito/risposta) via WebRTC senza server:
// A crea l'invito → B lo incolla e genera la risposta → A la incolla.
// Da lì il canale è diretto e cifrato, e i pesi neurali viaggiano da soli.
// ==========================================
let _meshPairing = null;

function meshAdoptChannel(pc, channel) {
  const attach = () => momentumMeshNode.addDirectPeer('peer-' + Date.now(), pc, channel);
  if (channel.readyState === 'open') attach();
  else channel.onopen = attach;
}

window.openMeshPairing = () => {
  openModal(`
    <div class="p-4 space-y-4">
      <h3 class="text-lg font-bold inline-flex items-center gap-2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M12 5a3 3 0 0 0-3 3c-1.7 0-3 1.3-3 3s1.3 3 3 3a3 3 0 0 0 6 0c1.7 0 3-1.3 3-3s-1.3-3-3-3a3 3 0 0 0-3-3z"/><path d="M12 5v14"/></svg>Collega un dispositivo</h3>
      <p class="text-xs text-[var(--on-surface-secondary)]">Le due AI impareranno l'una dall'altra. I tuoi dati NON si spostano: viaggiano solo i "pesi" imparati, protetti dal controllo anti-manomissione.</p>
      <div class="flex gap-2">
        <button onclick="window.meshCreateInvite()" class="btn-action flex-1 text-xs">1a. Crea invito (questo dispositivo)</button>
      </div>
      <textarea id="mesh-code-out" readonly placeholder="Il codice da copiare sull'altro dispositivo apparirà qui..." class="w-full bg-black/30 border border-[var(--glass-border)] rounded-xl p-3 text-[10px] font-mono h-20"></textarea>
      <div class="border-t border-[var(--outline)] pt-3">
        <p class="text-[10px] text-slate-400 mb-2">Incolla qui il codice ricevuto dall'altro dispositivo:</p>
        <textarea id="mesh-code-in" placeholder="Codice dall'altro dispositivo..." class="w-full bg-black/30 border border-[var(--glass-border)] rounded-xl p-3 text-[10px] font-mono h-20"></textarea>
        <div class="flex gap-2 mt-2">
          <button onclick="window.meshJoin()" class="btn-action flex-1 text-xs">1b. Ho ricevuto un INVITO</button>
          <button onclick="window.meshAcceptAnswer()" class="btn-action flex-1 text-xs">2a. Ho ricevuto la RISPOSTA</button>
        </div>
      </div>
    </div>
  `);
};

// Dispositivo A, passo 1: genera l'invito
window.meshCreateInvite = async () => {
  try {
    _meshPairing = new PairingSignaling();
    const code = await _meshPairing.createInvite();
    const out = document.getElementById('mesh-code-out');
    if (out) out.value = code;
    showToast('Invito creato: copialo sull\'altro dispositivo.', 'success');
  } catch (e) { console.error(e); showToast('Errore nella creazione dell\'invito.', 'error'); }
};

// Dispositivo B: incolla l'invito, genera la risposta
window.meshJoin = async () => {
  try {
    const code = document.getElementById('mesh-code-in')?.value?.trim();
    if (!code) { showToast('Incolla prima il codice di invito.', 'error'); return; }
    _meshPairing = new PairingSignaling();
    const answer = await _meshPairing.acceptInvite(code, channel => meshAdoptChannel(_meshPairing.pc, channel));
    const out = document.getElementById('mesh-code-out');
    if (out) out.value = answer;
    showToast('Risposta creata: rimandala al primo dispositivo.', 'success');
  } catch (e) { console.error(e); showToast('Codice di invito non valido.', 'error'); }
};

// Dispositivo A, passo 2: incolla la risposta di B → canale aperto
window.meshAcceptAnswer = async () => {
  try {
    const code = document.getElementById('mesh-code-in')?.value?.trim();
    if (!code || !_meshPairing) { showToast('Prima crea l\'invito, poi incolla la risposta.', 'error'); return; }
    const channel = await _meshPairing.acceptAnswer(code);
    meshAdoptChannel(_meshPairing.pc, channel);
    closeModal();
  } catch (e) { console.error(e); showToast('Codice di risposta non valido.', 'error'); }
};

window.openGoalEditor = () => {
  openModal(`
    <div class="p-4 space-y-4">
      <h3 class="text-lg font-bold">Nuovo obiettivo</h3>
      <p class="text-xs text-[var(--on-surface-secondary)]">Il progresso si calcola da solo: entrate meno uscite da oggi in poi.</p>
      <input id="goal-name-input" type="text" placeholder="Es. Vacanza, Fondo emergenze" class="w-full bg-black/30 border border-[var(--glass-border)] rounded-xl p-3 text-sm" />
      <input id="goal-target-input" type="number" inputmode="decimal" placeholder="Quanto vuoi mettere da parte (€)" class="w-full bg-black/30 border border-[var(--glass-border)] rounded-xl p-4 text-2xl font-mono text-center" />
      <input id="goal-deadline-input" type="date" class="w-full bg-black/30 border border-[var(--glass-border)] rounded-xl p-3 text-sm" />
      <button onclick="window.confirmGoalCreate()" class="btn-action w-full">Crea obiettivo</button>
    </div>
  `);
};

window.confirmGoalCreate = () => {
  const name = document.getElementById('goal-name-input')?.value?.trim();
  const target = parseFloat(document.getElementById('goal-target-input')?.value);
  const deadline = document.getElementById('goal-deadline-input')?.value || null;
  if (!name || !target || target <= 0) { showToast('Serve un nome e un importo valido.', 'error'); return; }
  VaultDAO.state.savingsGoals = VaultDAO.state.savingsGoals || [];
  VaultDAO.state.savingsGoals.push({ id: Date.now(), name, target, createdAt: new Date().toISOString(), deadline });
  VaultDAO.save();
  closeModal();
  showToast(`Obiettivo "${name}" creato.`, 'success');
  renderSavingsGoals();
};

window.deleteSavingsGoal = (id) => {
  VaultDAO.state.savingsGoals = (VaultDAO.state.savingsGoals || []).filter(g => g.id !== id);
  VaultDAO.save();
  renderSavingsGoals();
};

window.openBudgetEditor = () => {
  const suggestion = suggestMonthlyBudget(VaultDAO.state.transactions, new Date());
  const current = VaultDAO.state.monthlyBudget || 0;
  openModal(`
    <div class="p-4 space-y-4">
      <h3 class="text-lg font-bold">Budget mensile</h3>
      ${suggestion ? `
        <div class="card p-4 border border-emerald-500/30 bg-emerald-950/10 cursor-pointer" onclick="document.getElementById('budget-edit-input').value=${suggestion.suggested}">
          <p class="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400 mb-1">Suggerito dalla tua spesa reale</p>
          <p class="text-2xl font-black font-mono">${formatMoney(suggestion.suggested)}</p>
          <p class="text-[11px] text-[var(--on-surface-secondary)] mt-1">Media ultimi ${suggestion.basedOnMonths} mesi (${formatMoney(suggestion.rawAverage)}) + margine di sicurezza. Tocca per usarlo.</p>
        </div>
      ` : `<p class="text-xs text-[var(--on-surface-secondary)]">Non c'è ancora abbastanza storico per un suggerimento — imposta un valore di partenza, lo affineremo appena avrai qualche mese di spese registrate.</p>`}
      <input id="budget-edit-input" type="number" inputmode="decimal" value="${current}" class="w-full bg-black/30 border border-[var(--glass-border)] rounded-xl p-4 text-2xl font-mono text-center" />
      <button onclick="window.confirmBudgetEdit()" class="btn-action w-full">Conferma</button>
    </div>
  `);
};

window.confirmBudgetEdit = () => {
  const input = document.getElementById('budget-edit-input');
  const val = parseFloat(input?.value);
  if (!val || val <= 0) { showToast('Inserisci un importo valido.', 'error'); return; }
  VaultDAO.state.monthlyBudget = val;
  VaultDAO.save();
  closeModal();
  showToast('Budget aggiornato.', 'success');
  renderAnalysis();
};

// Applica direttamente il suggerimento dall'avviso "Budget da aggiornare"
// (un tap, senza passare dall'editor completo) — funzione dedicata invece di
// inline nell'HTML perché VaultDAO/renderAnalysis sono binding di modulo,
// non variabili globali: un onclick inline non le vedrebbe (stesso tipo di
// bug appena trovato con `opts`, evitato qui rifacendo lo stesso errore).
window.applyBudgetSuggestion = (value) => {
  VaultDAO.state.monthlyBudget = value;
  VaultDAO.save();
  showToast(`Budget aggiornato a ${formatMoney(value)}.`, 'success');
  renderAnalysis();
};

// ==========================================
// INITIALIZATION AND LISTENERS
// ==========================================
const initApp = () => {
  // Register Service Worker for PWA — aggiornamento automatico: quando il
  // nuovo service worker (già installato in background da skipWaiting/
  // clients.claim in sw.js) prende davvero il controllo della pagina, si
  // ricarica UNA VOLTA per caricare il codice nuovo, senza azione manuale
  // dell'utente. I dati non sono a rischio in questo passaggio: vivono in
  // IndexedDB/localStorage, indipendenti dal bundle JS in esecuzione — un
  // deploy nuovo non li tocca (vedi runSchemaMigrations in vault.js per la
  // sicurezza sui cambi di STRUTTURA dei dati tra versioni).
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('ServiceWorker registered:', reg);
        setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
        // FEEDBACK aggiornamento: quando è pronta una NUOVA versione (non il
        // primo install), lo diciamo all'utente e rassicuriamo sui dati. Il
        // riallineamento dei modelli avviene da solo dopo il reload
        // (reconcileModelsWithHistory), senza perdere nulla.
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              try { showToast('Nuova versione pronta — aggiorno in un attimo. I tuoi dati restano al sicuro.', 'info'); } catch (_) {}
            }
          });
        });
      })
      .catch(err => console.error('ServiceWorker registration failed:', err));

    let reloadedForUpdate = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloadedForUpdate) return;
      reloadedForUpdate = true;
      window.location.reload();
    });
  }

  try {
    VaultDAO.init();
  } catch(e) { console.error("VaultDAO init error:", e); }

  initMomentumRealAI();

  const mobileAddBtn = document.getElementById('mobile-add-btn');
  if (mobileAddBtn) {
    mobileAddBtn.onclick = openTransactionModal;
  }

  // Card "Chiedi a Momentum" (src/ai/qa-engine.js)
  const qaInput = $('#qa-input');
  const qaSend = $('#qa-send');
  const qaAnswer = $('#qa-answer');
  if (qaInput && qaSend && qaAnswer) {
    const ask = () => {
      const question = qaInput.value.trim();
      if (!question) return;
      const res = askMomentum(question);
      qaAnswer.textContent = res.answer;
      qaAnswer.classList.remove('hidden');
      haptic('light');
    };
    qaSend.onclick = ask;
    qaInput.addEventListener('keydown', e => { if (e.key === 'Enter') ask(); });
  }

  // Ingest listeners
  // Import UNIFICATO multi-file (N file, formati MISTI insieme): un solo save +
  // una sola render alla fine, dedup unica, progress per file. Vale anche per
  // gli input singoli quando l'utente seleziona più file dello stesso tipo.
  // OGNI import (1 o N file, formati misti) passa per importFiles: un solo
  // percorso unificato → dato integrato in TUTTO (ledger + rete neurale +
  // grafo DCGN + causale + affidabilità), guardrail categorie, progress,
  // apprendimento in background. "Ogni dato serve e viene integrato ovunque."
  const runMulti = async (files, srcInput) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    // Overlay di progresso: feedback CHIARO (parte, a che punto è, quando finisce).
    // Attrito minimo: l'utente vede subito che sta lavorando, senza dover indovinare.
    const ov = document.getElementById('import-progress');
    const elTitle = document.getElementById('import-title');
    const elFile = document.getElementById('import-file');
    const elBar = document.getElementById('import-bar-fill');
    const elCount = document.getElementById('import-count');
    const elClose = document.getElementById('import-close');
    const elSpin = document.getElementById('import-spinner');
    if (ov) { ov.classList.add('active'); elClose?.classList.add('hidden'); elSpin && (elSpin.style.display = ''); }
    if (elTitle) elTitle.textContent = `Sto leggendo ${list.length} file…`;
    const res = await importFiles(list, { onProgress: ({ i, n, name, kind }) => {
      if (elFile) elFile.textContent = name;
      if (elBar) elBar.style.width = `${Math.round((i - 1) / n * 100)}%`;
      if (elCount) elCount.textContent = `${i} / ${n} file`;
      try { logETL(`(${i}/${n}) ${name}`); } catch (_) {}
    }});
    if (srcInput) srcInput.value = '';
    const bt = res.byType;
    if (elBar) elBar.style.width = '100%';
    if (elSpin) elSpin.style.display = 'none';
    if (elTitle) elTitle.textContent = res.added > 0 ? `Fatto! ${res.added} movimenti aggiunti` : 'Tutto già presente';
    if (elFile) elFile.textContent = `${res.files} file · CSV ${bt.csv} · PDF ${bt.pdf} · foto ${bt.image}${res.errors.length ? ` · ${res.errors.length} saltati` : ''}`;
    if (elCount) elCount.textContent = res.learned?.length ? `L'AI sta imparando da ${res.learned.length} operazioni…` : '';
    elClose?.classList.remove('hidden');
    if (res.added > 0) evaluateAndCelebrateAchievements(); // traguardi 50/500 tx scattano qui
    if (res.errors.length) console.warn('Import — file con problemi:', res.errors);
  };
  const multiIn = $('#multi-upload'); if (multiIn) multiIn.addEventListener('change', e => runMulti(e.target.files, multiIn));
  const csvIn = $('#csv-upload'); if (csvIn) csvIn.addEventListener('change', e => runMulti(e.target.files, csvIn));
  const pdfIn = $('#pdf-upload'); if (pdfIn) pdfIn.addEventListener('change', e => runMulti(e.target.files, pdfIn));
  const backupIn = $('#backup-restore-input'); if (backupIn) backupIn.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) window.restoreEncryptedBackup(file);
    backupIn.value = '';
  });
  const screenshotIn = $('#screenshot-upload'); if (screenshotIn) screenshotIn.addEventListener('change', e => runMulti(e.target.files, screenshotIn));

  // What-If v2 per categoria (src/predict/what-if.js): select + slider →
  // effetto diretto + catena causale, in linguaggio semplice.
  const wCat = document.getElementById('whatif-cat');
  const wSlider = document.getElementById('whatif-slider');
  const wPct = document.getElementById('whatif-pct');
  const wResult = document.getElementById('whatif-result');
  if (wCat && wSlider && wResult) {
    const usedCats = [...new Set(Object.values(VaultDAO.state.transactions).flat().filter(t => t.type === 'uscita').map(t => t.category))];
    wCat.innerHTML = usedCats.map(c => `<option value="${c}">${getCatById(c).name}</option>`).join('');
    const runWhatIf = () => {
      const pct = parseInt(wSlider.value);
      wPct.textContent = `${pct > 0 ? '+' : ''}${pct}%`;
      const sim = simulateCategoryChange({ allTx: VaultDAO.state.transactions, catId: wCat.value, deltaPct: pct });
      if (!sim) { wResult.textContent = 'Non ho ancora abbastanza storia recente su questa categoria per simulare.'; return; }
      const verb = sim.directMonthly >= 0 ? 'risparmi' : 'spendi in più';
      let txt = `${verb} ${formatMoney(Math.abs(sim.directMonthly))} al mese`;
      if (sim.chainEffects.length > 0) {
        const e = sim.chainEffects[0];
        txt += ` — e nei tuoi dati ${getCatById(e.category).name} di solito ${e.pct < 0 ? 'scende' : 'sale'} con lei (${e.monthlyEur > 0 ? '+' : ''}${formatMoney(e.monthlyEur)} in più${e.lagWeeks > 0 ? ', la settimana dopo' : ''})`;
        txt += `. Totale stimato: ${formatMoney(sim.totalMonthly)}/mese.`;
      } else {
        txt += '.';
      }
      wResult.textContent = txt;
    };
    wSlider.addEventListener('input', runWhatIf);
    wCat.addEventListener('change', runWhatIf);
    if (usedCats.length > 0) runWhatIf();
  }

  // What-if simulator live updates
  const slider = document.getElementById('scenario-slider');
  if (slider) {
    slider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) || 0;
      $('#scenario-extra-val').textContent = `+€${val}/m`;
      
      try {
        const proj = PredictiveOracle.calculateProjections();
        const r = proj.dynCagr;
        const years = 5;
        const c_n = 12;
        const compounded = val * ((Math.pow(1 + r/c_n, c_n*years) - 1) / (r/c_n));
        $('#scenario-future-impact').textContent = `5 Anni: +${formatMoney(compounded)}`;
      } catch(err) { console.error(err); }
    });
  }

  // Check onboarding state
  const hasOnboarded = localStorage.getItem('omega_core_db');
  if (hasOnboarded) {
    const gen = $('#genesis-container');
    if (gen) gen.remove();
    $('#app-core').classList.remove('hidden');
    $('#app-core').style.opacity = '1';
    updateStreak(); // prima di bootUI, così il badge nasce già aggiornato
    // Riconoscimento silenzioso al boot dei traguardi già GUADAGNATI da un
    // utente esistente (niente pioggia di toast per lo storico): la
    // celebrazione col toast resta solo per i NUOVI sblocchi da qui in poi.
    {
      const bootStats = computeStats(VaultDAO.state, new Date());
      const { unlocked, newly } = evaluateAchievements(VaultDAO.state.achievements || {}, bootStats);
      if (newly.length) { VaultDAO.state.achievements = unlocked; VaultDAO.save(); }
    }
    bootUI();
    consumeSharedImage(); // screenshot condiviso via share target (Android)
  } else {
    // Draw particle points on Genesis canvas
    const canvas = document.getElementById('genesis-canvas');
    if (canvas) {
      try {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const pts = [];
          for (let i=0; i<100; i++) {
            pts.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height, r: Math.random()*2+1, s: Math.random()*0.5+0.1 });
          }
          const anim = () => {
            ctx.clearRect(0,0,canvas.width,canvas.height);
            ctx.fillStyle = "rgba(255,255,255,0.4)";
            pts.forEach(p => {
              p.y -= p.s;
              if (p.y < 0) p.y = canvas.height;
              ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
            });
            requestAnimationFrame(anim);
          };
          anim();
        }
      } catch(err) { console.error(err); }
    }
  }
};

// Global click actions
document.addEventListener('click', e => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const a = t.dataset.action;

  try {
    if (a === 'switch-view') {
      navigate(t.dataset.view);
    } else if (a === 'prev-month' || a === 'next-month') {
      const d = new Date(VaultDAO.state.currentDate);
      if (a === 'next-month') d.setMonth(d.getMonth() + 1);
      else d.setMonth(d.getMonth() - 1);
      VaultDAO.state.currentDate = d;
      renderDashboard();
    } else if (a === 'jump-today') {
      // Micro-interazione: un tap sul titolo del mese riporta a OGGI quando si
      // stanno guardando mesi passati/futuri. Feedback immediato (haptic +
      // suono) — l'affordance appare solo quando serve (vedi updateDashboard).
      const now = new Date();
      const already = VaultDAO.state.currentDate.getFullYear() === now.getFullYear() && VaultDAO.state.currentDate.getMonth() === now.getMonth();
      if (!already) {
        VaultDAO.state.currentDate = now;
        haptic('medium');
        try { AudioSynth.play('success'); } catch (_) {}
        renderDashboard();
        showToast('Tornato a oggi.', 'success');
      }
    } else if (a === 'toggle-theme') {
      VaultDAO.state.themeDark = !VaultDAO.state.themeDark;
      document.documentElement.classList.toggle('dark', VaultDAO.state.themeDark);
      VaultDAO.save();
      showToast("Tema aggiornato.", "success");
    }
  } catch(err) { console.error(err); }
});


let momentumOrchestrator = null;
let momentumMeshNode = null;
function initMomentumRealAI() {
  try {
    const trainedCategorizer = new TrainedCategorizer(MOMENTUM_TRAINED_MODEL_DATA);
    momentumOrchestrator = new MomentumOrchestrator({
      vaultDAO: VaultDAO,
      neuralNexus: NeuralNexus,
      trainedCategorizer,
      meshNode: null,
    });
    window.momentumOrchestrator = momentumOrchestrator;
    console.log('Momentum Real AI orchestrator pronto (NeuralNexus + Nano in ensemble).');

    // Mente condivisa: MeshNode collegato al VERO stato NeuralNexus tramite
    // l'adapter (prima sincronizzava il motore standalone, una copia morta).
    // learn() dell'orchestratore chiama già mesh.broadcastLearning() — quindi
    // ogni apprendimento locale si propaga da solo ai dispositivi collegati.
    momentumMeshNode = new MeshNode(undefined, createNexusMeshMind(momentumOrchestrator, VaultDAO));
    // Sync differenziale dei DATI tra device fidati (src/mesh/sync.js):
    // callback che la mesh usa per scambiare digest→delta e per il merge.
    momentumMeshNode.getSyncDigest = () => computeSyncDigest(VaultDAO.state.transactions);
    momentumMeshNode.getMissingForPeer = (peerDigest) => transactionsMissingFromPeer(VaultDAO.state.transactions, peerDigest);
    momentumMeshNode.onSyncReceived = (txs) => {
      const added = VaultDAO.applySyncMerge(txs);
      if (added > 0) { renderDashboard(); renderAnalysis({ skipHeavyForecast: true }); showToast(`${added} transazioni sincronizzate da un tuo dispositivo.`, 'success'); }
      return added;
    };
    momentumMeshNode.onPeerConnected = () => {
      renderMeshStatus();
      showToast('Dispositivo collegato: dati e AI ora si sincronizzano.', 'success');
      // sync automatico al pairing: scambio simmetrico dei soli delta
      for (const pid of momentumMeshNode.peers.keys()) momentumMeshNode.requestSync(pid);
    };
    momentumMeshNode.onGradientReceived = (peerId, stats) => {
      // Registro di integrità (src/mesh/update-ledger.js): ogni merge, accettato
      // o rifiutato, entra nella catena hash a prova di manomissione. La
      // reputazione del peer si aggiorna da sola: un nodo che prova ad avvelenare
      // il modello perde peso senza doverlo bandire a mano.
      const before = VaultDAO.state.mlData?.totalWords || 0;
      VaultDAO.state.updateLedger = appendUpdate(VaultDAO.state.updateLedger || [], {
        peerId, accepted: !!stats.accepted, examplesBefore: before,
        examplesAfter: stats.totalExamples || before, reason: stats.accepted ? null : (stats.reason || 'anti-poisoning'),
      });
      VaultDAO.save();
      if (stats.accepted) console.log(`Mesh: conoscenza fusa (esempi ${stats.totalExamples}). Reputazione peer: ${peerReputation(VaultDAO.state.updateLedger, peerId).score}`);
      else console.warn('Mesh: aggiornamento RIFIUTATO dall\'anti-avvelenamento, registrato in catena.', stats);
      renderMeshStatus();
    };
    momentumOrchestrator.mesh = momentumMeshNode;
    window.momentumMeshNode = momentumMeshNode;

    // ── Prezzi P2P (W8/C3): un dispositivo online condivide i prezzi recenti
    // agli altri della mesh. In ricezione: merge SOLO se più recente e
    // plausibile (mergePeerPrices: date monotone, salto <50% — anti-veleno),
    // etichettato "peer:<id>" — mai spacciato per fetch locale.
    momentumMeshNode.onPricesReceived = async (peerId, prices) => {
      try {
        const { mergePeerPrices } = await import('./alpha/market-data.js');
        let mergedAny = false;
        for (const [sym, payload] of Object.entries(prices || {})) {
          const key = `mkt:${payload.kind || 'crypto'}:${sym}`;
          const local = await DurableStore.get('state', key).catch(() => null);
          const winner = mergePeerPrices(local, { ...payload, prices: payload.series }, peerId);
          if (winner) {
            await DurableStore.put('state', winner, key).catch(() => {});
            const last = winner.prices[winner.prices.length - 1];
            if (last) (window.__livePrices = window.__livePrices || {})[sym] = last.close;
            mergedAny = true;
          }
        }
        if (mergedAny) { renderNetWorth(); showToast('Prezzi aggiornati da un tuo dispositivo.', 'success'); }
      } catch (_) {}
    };

    // ── Meta-federazione (Wave 15 v10, src/mesh/meta-federation.js): un peer
    // condivide SOLO le medie a posteriori "quale esperto è affidabile per
    // quale contesto" (mai dati grezzi/transazioni/pesi completi). Merge
    // pesato per reputazione (stesso updateLedger anti-poisoning già in uso
    // sopra) sul bandit degli esperti (Wave 13, mlData.expertBandit).
    momentumMeshNode.onReliabilityReceived = async (peerId, digest) => {
      try {
        const { mergeReliabilityDigest } = await import('./mesh/meta-federation.js');
        VaultDAO.state.mlData.expertBandit = mergeReliabilityDigest(
          VaultDAO.state.mlData.expertBandit, [{ peerId, digest }], VaultDAO.state.updateLedger || []
        );
        VaultDAO.save();
      } catch (_) {}
    };

    // ── W17 auto-apprendimento su fonti CERTE (src/alpha/sources.js): durante
    // l'idle, per i ticker delle posizioni, prova le fonti whitelisted con
    // VERIFICA INCROCIATA; solo i dati confermati/plausibili aggiornano prezzi
    // e (trainingEligible) possono alimentare l'apprendimento. Se la rete non
    // c'è: cache → peer → stima etichettata — mai un numero inventato.
    const idleFetchPrices = () => {
      const positions = VaultDAO.state.positions || [];
      if (!positions.length || !navigator.onLine) return;
      const cacheAdapter = { get: (k) => DurableStore.get('state', k).catch(() => null), put: (k, v) => DurableStore.put('state', v, k).catch(() => {}) };
      import('./alpha/sources.js').then(async ({ fetchVerified, trainingEligible }) => {
        const shared = {};
        for (const p of positions.slice(0, 6)) {           // budget rete per sessione
          const kind = p.assetClass === 'crypto' ? 'crypto' : 'stock';
          try {
            const r = await fetchVerified({ symbol: p.ticker.toLowerCase(), kind, fetchImpl: fetch.bind(window), cache: cacheAdapter });
            const last = r.prices && r.prices[r.prices.length - 1];
            if (last && trainingEligible(r)) {
              (window.__livePrices = window.__livePrices || {})[p.ticker] = last.close;
              shared[p.ticker] = { kind, asOf: r.asOf, source: r.source, series: r.prices.slice(-30) };
            }
          } catch (_) {}
        }
        if (Object.keys(shared).length) {
          renderNetWorth();
          momentumMeshNode?.sharePrices?.(shared);         // il device online aiuta gli altri
        }
        // Meta-federazione: condividi anche il digest di affidabilità corrente
        // (solo medie, mai conteggi) — stesso ciclo idle dei prezzi.
        if (momentumMeshNode?.shareReliability && VaultDAO.state.mlData.expertBandit) {
          import('./mesh/meta-federation.js').then(({ exportReliabilityDigest }) => {
            const { digest } = exportReliabilityDigest(VaultDAO.state.mlData.expertBandit);
            if (Object.keys(digest).length) momentumMeshNode.shareReliability(digest);
          }).catch(() => {});
        }
      }).catch(() => {});
    };
    (window.requestIdleCallback || ((fn) => setTimeout(fn, 4000)))(idleFetchPrices);

    // Meso (src/ai/trained-meso.js): più accurato del Nano su testo rumoroso
    // (89.7% vs 80.0%, misurato) ma più pesante da caricare (~400KB, feature
    // ibride parole+caratteri). Caricato in modo asincrono e SOLO se il
    // profiler κ dice che il dispositivo non è nel tier minimo — su un
    // telefono debole il Nano resta l'unico modello, come da architettura a
    // tier. Il fetch non blocca l'avvio: se fallisce (offline al primo avvio,
    // 404), l'ensemble resta a due vie senza errori visibili all'utente.
    const tier = window.momentumDeviceProfile?.tier;
    if (tier && tier !== 'minimo') {
      // Ottimizzazione hardware (src/ai/quantize.js): su tier MEDIO il Meso
      // gira quantizzato int8 (8× meno memoria, accuratezza invariata —
      // misurato); su tier MASSIMO resta float per la massima precisione.
      const useInt8 = tier === 'medio';
      TrainedMeso.load('/momentum_meso_model.json', { int8: useInt8 })
        .then(meso => {
          momentumOrchestrator.setMeso(meso);
          console.log(`Momentum Meso caricato (tier ${tier}, ${useInt8 ? 'int8' : 'float'}): ensemble ora a 3 vie.`);
        })
        .catch(e => console.warn('Meso non disponibile, resto sull\'ensemble Nano+NeuralNexus:', e));

      // LogReg (src/ai/hashed-logreg.js): 3° esperto STATICO riaddestrato in
      // locale in JS. In ensemble con Meso porta la generalizzazione ML da 75%
      // a ~85% (misurato, held-out). Caricato come il Meso.
      // Modello fiscale entrate (public/momentum_income_model.json, v10): NUOVO
      // classificatore addestrato fattura/stipendio/personale, stessa architettura
      // del LogReg. Caricato async e usato da renderTax via window.__incomeModel.
      HashedLogReg.load('/momentum_income_model.json')
        .then(m => { window.__incomeModel = m; console.log('Modello fiscale entrate caricato (fattura/stipendio/personale).'); })
        .catch(() => {});
      HashedLogReg.load('/momentum_logreg_model.json')
        .then(logreg => {
          momentumOrchestrator.setLogReg(logreg);
          console.log('Momentum LogReg caricato: ensemble ML a ~85% (held-out).');
          // Auto-adattamento ai nuovi modelli SENZA perdere dati: se la firma
          // dei modelli è cambiata (aggiornamento app / nuovi modelli), l'AI si
          // ri-allinea dai dati preservati dell'utente, in background, e lo dice.
          try {
            const rec = reconcileModelsWithHistory(MODEL_SIGNATURE);
            if (rec.reconciled && rec.count > 0) {
              showToast(`Aggiornamento applicato ✓ i tuoi dati sono al sicuro — l'AI si sta riallineando su ${rec.count} operazioni.`, 'success');
            }
          } catch (e) { console.warn('reconcile modelli:', e); }
        })
        .catch(e => console.warn('LogReg non disponibile, ensemble resta Nano+Meso:', e));
    }

    // Warm-up OCR: Tesseract scarica wasm+traineddata da CDN solo al primo
    // uso — senza questo giro, "OCR offline" varrebbe solo se l'utente ha già
    // scansionato qualcosa online. Creato in idle (mai in competizione col
    // boot), con gli stessi parametri del worker del pdf-parser così viene
    // riusato invece di crearne un secondo. Solo online e fuori dal tier
    // minimo: su un dispositivo debole il warm-up ruberebbe CPU al boot.
    if (tier && tier !== 'minimo' && navigator.onLine && typeof Tesseract !== 'undefined') {
      const idle = window.requestIdleCallback || (fn => setTimeout(fn, 3000));
      idle(async () => {
        try {
          if (!window._tesseractWorker) {
            window._tesseractWorker = await Tesseract.createWorker('ita', 1, { logger: () => {} });
            console.log('OCR warm-up completato: Tesseract pronto anche offline.');
          }
        } catch (e) { console.warn('OCR warm-up saltato:', e); }
      });
    }
  } catch (e) {
    console.error('Errore inizializzazione Momentum Real AI:', e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Riconcilia IndexedDB <-> localStorage prima di leggere lo stato;
  // se IndexedDB fallisce si parte comunque (fallback localStorage puro).
  // Il profilo hardware (micro-benchmark ~40ms, poi in cache 24h) decide
  // i budget di calcolo: path Monte Carlo, 3D on/off.
  Promise.allSettled([VaultDAO.initDurable(), initDeviceProfile()]).finally(() => initApp());
});
// Esposizione globale per handler inline nell'HTML (onclick="...")
window.showToast = showToast;
window.showSignatureAlert = showSignatureAlert;
// ...e per i parser di import (moduli separati che devono aggiornare la UI
// a fine lavoro: dentro un modulo ES "renderDashboard" nudo è un
// ReferenceError, serve il riferimento globale esplicito).
window.renderDashboard = renderDashboard;
window.renderAnalysis = renderAnalysis;
// Render dopo un import di massa: DIFFERITA (requestAnimationFrame → l'import
// finisce e la UI resta reattiva) e LEGGERA (skipHeavyForecast → niente Monte
// Carlo/GARCH sincrono). Così un import di 5 anni di dati non congela mai l'app.
window.renderAfterImport = () => {
  requestAnimationFrame(() => {
    try { renderDashboard(); renderAnalysis({ skipHeavyForecast: true }); }
    catch (e) { console.error('render post-import:', e); }
  });
};
// ...e per il voice core (una domanda parlata viene instradata al motore
// Q&A invece che al parser delle transazioni).
window.askMomentum = askMomentum;
// Voce "il solito" (src/voice/voice.js chiama questi): matching + registrazione
window.matchSolito = (phrase) => matchSolito(phrase, VaultDAO.state.transactions, new Date());
window.registerQuickAdd = (hit) => {
  const now = new Date();
  const { route } = VaultDAO.addTransaction(monthKey(now), {
    id: Date.now(), amount: hit.amount, type: hit.type || 'uscita',
    category: hit.category, description: hit.description, date: now.toISOString(),
  });
  if (window.momentumOrchestrator) window.momentumOrchestrator.learn(hit.description, hit.category, hit.amount, now);
  renderDashboard();
  renderAnalysis({ skipHeavyForecast: route === 'fast' });
};

