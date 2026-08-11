import { SCHEMA_VERSION, $, $$, formatMoney, monthKey } from './core/constants.js';
import { haptic } from './core/utils.js';
import { AudioSynth } from './core/audio.js';
import { getCatById, getCatsByType, VaultDAO, DurableStore } from './core/vault.js';
import { showSignatureAlert, showToast } from './ui/feedback.js';
import { NeuralNexus, AntiFOMO } from './ai/neural-nexus.js';
import { VoiceCore } from './voice/voice.js';
import { PredictiveOracle } from './predict/oracle.js';
import { initDeviceProfile } from './device/profiler.js';
import { AnomalyDetector, findUnknownMerchants } from './predict/anomaly.js';
import { subscriptionSummary } from './predict/subscriptions.js';
import { getWeeklyStatus } from './predict/weekly-budget.js';
import { getDailySafeToSpend, getAdvisorInsights, getMonthEndProjection, getUpcomingCharges, getMonthlyCommitments } from './predict/advisor.js';
import { investableSurplus } from './alpha/bridge.js';
import { computeNetWorth, projectNetWorthByStrategy, projectStrategy } from './alpha/net-worth.js';
import { validateStrategySet } from './alpha/strategy-validation.js';
import { stalenessNote } from './core/data-freshness.js';
import { runUpdateCycle, cycleSummary, taxRulesSource, fatturaPaFormatSource, netReturnRatesSource } from './core/auto-update.js';

// Rendimenti annuali ricostruiti dai parametri di una strategia, per poterla
// passare al vaglio statistico. Modello LOG-NORMALE, lo stesso di
// projectStrategy: il rendimento semplice che ne esce è illimitato verso
// l'alto (un +300% è possibile e va rappresentato) e non scende mai sotto
// −100%, che per una posizione comprata senza debito è il limite fisico —
// non puoi perdere più di quello che hai messo. Deterministico a parità di
// seme, così il giudizio mostrato non cambia a ogni apertura dell'app.
function syntheticAnnualReturns(mu, sigma, n = 40, seed = 1) {
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return (s >>> 8) / 16777216; };
  const out = [];
  for (let i = 0; i < n; i++) {
    const u1 = Math.max(1e-9, rnd()), u2 = rnd();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    out.push(Math.exp((mu - 0.5 * sigma * sigma) + sigma * z) - 1);
  }
  return out;
}
import { sectorRanking } from './alpha/sector-rotation.js';
import measuredAssumptions from './alpha/measured-assumptions.js';
import { createPriceAlert, checkPriceAlerts, removePriceAlert } from './predict/price-alerts.js';
import { isItalianDevice } from './alpha/translate.js';
import { chiediAlMercatoSync, precarica as precaricaMercato } from './alpha/mercato-qa.js';
import { isTelemetryEnabled, setTelemetryEnabled, sendTelemetryPings, needsTelemetryDisclosure, markTelemetryDisclosed } from './core/telemetry.js';

// Endpoint del contatore anonimo (server/telemetry-worker.js): vuoto finché
// non viene distribuito — con endpoint vuoto sendTelemetryPings è un no-op
// silenzioso, così il repo resta clonabile/utilizzabile da chiunque senza
// dover configurare nulla. Da valorizzare con l'URL reale dopo il deploy.
const TELEMETRY_ENDPOINT = '';

// Etichette statiche (non dati) tradotte in italiano quando il dispositivo è
// italiano — Alpha Vantage restituisce region/exchange sempre in inglese.
const REGION_LABELS_IT = {
  'United States': 'Stati Uniti', 'United Kingdom': 'Regno Unito', Canada: 'Canada', 'Frankfurt': 'Francoforte',
  Toronto: 'Toronto', China: 'Cina', India: 'India', 'India/Bombay': 'India (Bombay)', 'Brazil/Sao Paolo': 'Brasile (San Paolo)',
  Amsterdam: 'Amsterdam', Paris: 'Parigi', Milan: 'Milano', Madrid: 'Madrid', Brussels: 'Bruxelles', Lisbon: 'Lisbona',
  Vienna: 'Vienna', Ireland: 'Irlanda', 'Hong Kong': 'Hong Kong', Shenzhen: 'Shenzhen', Shanghai: 'Shanghai',
  Copenhagen: 'Copenaghen', Helsinki: 'Helsinki', Stockholm: 'Stoccolma', Zurich: 'Zurigo', Estonia: 'Estonia',
};
function translateRegionLabel(region) {
  if (!region) return region;
  return isItalianDevice() ? (REGION_LABELS_IT[region] || region) : region;
}
import { taxSetAsideForPeriod, classifyIncome, learnIncomeType, projectAnnualTax, taxAdvice, REGIMI, parseInvoiceLine, simulateNewPartitaIva, ATECO_COEFFICIENTI, CASSE_PROFESSIONALI, searchAtecoComuni, ATECO_UFFICIALE_URL } from './predict/tax.js';
import { computeAvsIndipendente, ivaObbligatoriaCh, AVS_SOGLIA_ALIQUOTA_PIENA, IVA_CH_SOGLIA_OBBLIGO, AVS_CALCOLATORE_UFFICIALE_URL } from './predict/tax-ch.js';
import { buildSwissQrPayload } from './invoice/swiss-qr-bill.js';
import { generateQrrReference, formatQrrReference } from './invoice/swiss-qr-reference.js';
import { t as tCh, resolveUiLanguage } from './i18n/ui-strings.js';
import { generateDemoTransactions, fadeDemo, demoStatus, mergeDemoForDisplay, DEMO_FADE_AT } from './ui/demo-dataset.js';
import { statoDelMese, stripHtml, evidenziaNumeri } from './ui/mese-strip.js';
import { buildAccountantReport, renderAccountantReportHTML } from './predict/accountant-export.js';
import { determinaPeriodicitaIva, upcomingIvaLiquidazioni, previsioneSuperamentoSogliaTrimestrale } from './predict/iva-liquidazione.js';
import { matchInvoicePayments, cashBasisRevenue, accrualRevenue, ceilingStatusByCash, unpaidExposure } from './predict/tax-cash-basis.js';
import { upcomingTaxDeadlines, taxCashWarning, overdueTaxDeadlines } from './predict/tax-deadlines.js';
import { righeF24Iva, righeF24Imposte, f24Riepilogo } from './predict/f24.js';
import { calcolaRavvedimento } from './predict/ravvedimento.js';
import { taxReserveStatus, recordTaxPayment, removeTaxPayment } from './predict/tax-payments.js';
import { rulesForYear, setActiveTaxRules } from './predict/tax-rules.js';
import { computeInvoice, nextInvoiceNumber, suggestFromHistory, detectRecurringClients, renderInvoiceHTML, buildInvoiceEmail, pendingSdiTransmission, INVOICE_THEMES, suggestInvoiceTheme } from './invoice/invoice-engine.js';
import { invoicePdfBlob, invoiceFilename } from './invoice/invoice-pdf.js';
import { selectableCountries as selectableInvoiceCountries } from './invoice/country-invoicing.js';
import { recommendInvoiceType, missingForFatturaPa, buildFatturaPaXML } from './invoice/fatturapa-xml.js';
import { parseFatturaPaXML, fatturaPassivaToAcquisti } from './invoice/fatturapa-import.js';
import { isValidPartitaIva, isValidCodiceFiscale } from './invoice/it-fiscal-id.js';
import { buildEpcPayload, sepaFallbackText, isValidIBAN, normalizeIBAN } from './pay/sepa-qr.js';
import { qrSvg } from './pay/qr-encode.js';
import { createGroup, addSharedExpense, settlementView, quickSplit, frequentCoSplitters, settlementToSepa, suggestSettleTiming, encodeGroupShare, encodeGroupInvite, decodeGroupShare, mergeIntoGroups, computeBalances, settlementCounts, simplifyAcrossGroups, extractSharePayload, renameGroup, describeGroupChanges, claimMember, myMemberId, unclaimedMembers } from './split/split-engine.js';
// Codice d'invito corto e leggibile (src/split/invite-codec.js): il link che
// finisce su WhatsApp era lungo 1.759 caratteri e faceva paura a chi lo
// riceveva. Qui si comprime, il contenuto va nel fragment (mai al server) e la
// parte visibile dice di che gruppo si tratta.
import { packShare, unpackShare, extractShareCode, buildInviteUrl } from './split/invite-codec.js';
import { detectRecurring, predictExpenseShape, flagAnomaly, forecastGroupBalances } from './split/split-intelligence.js';
import { predictCoSplitters, predictShares, netAcrossGroups, parseSplitLine, learnFromSplit, settlementIntelligence, settleAdvice } from './split/split-predictor.js';
import { resolveSalary, nextPayday, daysToNextPayday } from './predict/income-model.js';
import { commitmentForecast, remainingInstallments, payoffDate, enrichCommitmentsWithLearning, cycleAllowance, isActive } from './predict/fixed-commitments.js';
import { cashForecast } from './predict/cash-forecast.js';
import { trainCommitments, enrichWithNormality, judgeCommitmentPayment } from './predict/commitment-training.js';
import { bnplExposure, bnplToLedgerEvents, learnPlanLengths, detectBnplSeries } from './predict/bnpl.js';
import { investmentReadiness } from './ai/reasoning-fusion.js';
import { detectRegime } from './alpha/regime.js';
import { fireTargetCapital, yearsToFire, coastFireCheck } from './predict/fire.js';
import { detectPlatform, installSteps } from './pwa/install-guide.js';
import { comparePeriods, lastNMonthKeys } from './predict/period-compare.js';
import { buildCausalGraph, pruneNonCausal, buildCategorySeries } from './predict/causal-graph.js';
import { analyzeCausalStructure } from './predict/causal-orchestrator.js';
import { startCategoryExperiment, stopCategoryExperiment, experimentStatus } from './predict/experiment-tracker.js';
import { fetchMacroSeries, alignMacroToWeeks } from './predict/macro-context.js';
import { classifyCategoryChips } from './predict/experiment-chip.js';

// Proxy noti per rilevare un regime LIVE (invece dello scatto statico
// datato) quando l'utente ha già in portafoglio una posizione che traccia
// indice/cripto — riusa la serie già scaricata da idleFetchPrices
// (window.__liveSeries), nessuna chiamata di rete aggiuntiva qui.
const LIVE_REGIME_PROXIES = { indice: ['SPY', 'VOO', 'IVV'], cripto: ['BTC', 'XBT'] };
function detectLiveRegimeFor(assetKey) {
  try {
    const tickers = LIVE_REGIME_PROXIES[assetKey] || [];
    const match = (VaultDAO.state.positions || []).find(p => tickers.includes((p.ticker || '').toUpperCase()));
    const series = match && window.__liveSeries?.[match.ticker];
    if (!series || series.length < 25) return null;
    return detectRegime(series.map(pt => pt.close));
  } catch (_) { return null; }
}
import { fetchLiveCryptoPrice, fetchLiveStockPrice, STOCK_PROVIDER_IDS } from './alpha/live-price.js';
import { buildPayoutRequest, resolvePayout, PAYOUT_METHODS, PAYOUT_LABELS } from './split/payout.js';
import { buildShareUrl, recordOrigin } from './core/share-base.js';
import { touchStreak, computeWeeklyRecap, computeGoalProgress, suggestSubscriptionRegistrations } from './predict/engagement.js';
import { banditContext, rankNudges, banditObserve, settleImpressions, mergePendingSameDay, phaseOfMonth, dailySeed, makeRng } from './predict/advisor-bandit.js';
import { inferLifestyle } from './predict/lifestyle.js';
import { buildCalendarRows, calendarSummary } from './predict/calendar-format.js';
import { derivePriors, seedBanditState } from './predict/onboarding-priors.js';
import { evaluateBrake } from './predict/spending-brake.js';
import { ACHIEVEMENTS, computeStats, evaluateAchievements, nextMilestone } from './predict/achievements.js';
import { answerQuestion } from './ai/qa-engine.js';
import { recordUnknownQuestion, learnCorrection, qaLearningCoverage } from './ai/qa-learning.js';
import { mergeMorphology, initMorphology } from './ai/merchant-morphology.js';
import { chat as chatMultilingual } from './ai/chat.js';
import { resolveQaLanguage, detectDeviceLanguage, SUPPORTED as QA_SUPPORTED_LANGS } from './i18n/detect.js';
import { detectNewsIntent } from './predict/news-intent.js';
import { predictAmount, getQuickAddSuggestions, matchSolito } from './predict/amount-memory.js';
import { rankSuggestionsByContext, predictCategoriesNow } from './predict/context-predictor.js';
import { nextExpenseNudge, splitReminder, amountEntryImpact, amountVsTypical, monthTrajectoryFocus, splitCandidate } from './predict/command-center.js';
import { simulateCategoryChange } from './predict/what-if.js';
import { MeshNode, PairingSignaling } from './mesh/mesh-signaling.js';
import { createNexusMeshMind } from './mesh/nexus-adapter.js';
import { appendUpdate, peerReputation } from './mesh/update-ledger.js';
import { computeSyncDigest, transactionsMissingFromPeer } from './mesh/sync.js';
import { rankMissingByMonth, scoreForSync } from './mesh/sync-priority.js';
import { buildSketch, serializeCells, recommendedSize, reconcile } from './mesh/iblt.js';
import { assertShareable } from './mesh/compute-market.js';
import { acceptForCarry, pruneExpired, MAX_CARRIED } from './mesh/store-forward.js';
import { loadOrCreateExchangeIdentity, openSealedAny, statoIdentita } from './mesh/exchange-identity.js';
import { loadOrCreateDeviceIdentity } from './mesh/device-signing-identity.js';
import { verificationWords, addTrustedDevice, isTrustedKey } from './mesh/device-trust.js';
import { initLexiconPool, observeLexicon, buildLexiconDigest, mergeLexiconDigests, eligibleLexicon, heldBackLexicon, DEFAULT_K_ANONYMITY } from './mesh/federated-distillation.js';
import { encryptBackup, decryptBackup, createRecoveryKit, restoreFromShares } from './core/backup.js';
import { backupRisk, placementQuality, recordPlacement, placeLabel } from './core/backup-health.js';
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
    // Nuovi intent (patrimonio/stipendio/rate) — riusano gli stessi motori
    // già usati altrove nell'app (net-worth.js, fixed-commitments.js,
    // bnpl.js), mai un secondo calcolo isolato per il QA.
    positions: VaultDAO.state.positions || [],
    currentPriceByTicker: window.__livePrices || {},
    manualAssets: VaultDAO.state.manualAssets || [],
    liabilities: VaultDAO.state.liabilities || 0,
    salary: resolveSalary(VaultDAO.state, VaultDAO.state.transactions),
    fixedCommitments: VaultDAO.state.fixedCommitments || [],
    bnplLearned: VaultDAO.state.mlData?.bnplLearned || {},
    bnplDismissed: VaultDAO.state.mlData?.bnplDismissed || [],
    // predict/macro-context.js: se il tasso BCE è già stato scaricato (Dashboard
    // → renderCausalGraphViz lo mette in cache la prima volta), il QA lo
    // riusa senza rifare la richiesta. Se non c'è ancora (utente che chiede
    // subito, prima di aver mai aperto il grafo), resta null e il QA
    // funziona comunque com'è sempre stato — additivo, mai bloccante.
    macroContext: __macroContextCache,
    // ── Domande sui MERCATI (src/alpha/mercato-qa.js) ──
    // Il QA delle finanze personali ha la precedenza: "quanto ho speso" non
    // deve mai finire in un'analisi di borsa. Questo si consulta solo quando
    // nessun intento personale ha risposto. E' sincrono perche' i moduli
    // pesanti (145 KB di serie storiche) vengono precaricati in sottofondo
    // dopo l'avvio: chi non chiede mai di mercati non li scarica al primo
    // colpo, e chi chiede trova tutto gia' pronto.
    mercato: (testo) => { try { return chiediAlMercatoSync(testo); } catch (_) { return null; } },
    // src/ai/qa-learning.js: apprendimento locale, per-utente, delle
    // formulazioni che i pattern fissi non riconoscono — vedi askMomentum
    // più sotto per dove si registra/insegna.
    qaLearning: VaultDAO.state.qaLearning,
  };
  // Chatbot multilingua (src/ai/chat.js): se rileva EN/ES risponde in quella
  // lingua; per l'italiano (o intento non coperto dal chat) usa il Q&A
  // completo esistente. Così l'app "arriva" anche in Spagna/LatAm ed EU.
  // Priorità di lingua (richiesta esplicita): scelta manuale in Impostazioni
  // > segnale forte nel testo della domanda > lingua del dispositivo (prima
  // un testo ambiguo cadeva sempre su 'it', anche con device in inglese).
  const resolved = resolveQaLanguage(text, { deviceLang: detectDeviceLanguage(), override: VaultDAO.state.qaLanguageOverride || null });
  if (resolved.lang !== 'it') { // EN/ES/FR/DE → chatbot multilingua; IT → Q&A completo
    const r = chatMultilingual(text, { ...ctx, forceLang: resolved.lang });
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
       <div class="text-[11px] font-mono text-[var(--on-surface-secondary)] mb-1">Sicurezza: <span class="ml-confidence" id="ml-confidence-score">0%</span></div>
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
      <!-- Tastierino VIVO (src/predict/command-center.js): mentre digiti, la
           conseguenza reale sul tuo "Oggi puoi spendere" + "più del solito?".
           Calcolato sui tuoi dati, non decorativo. Nascosto senza budget/importo. -->
      <div id="amount-impact" class="mt-2 min-h-[1.25rem] text-[12px] font-bold flex items-center justify-center gap-1.5 opacity-0 transition-opacity duration-200" aria-live="polite"></div>
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
       <!-- "È da dividere?" (src/predict/command-center.js → splitCandidate): sempre
            disponibile per le uscite — segnalato dall'utente che mancava. Onesto: il
            nome del gruppo compare SOLO con un match testuale reale a una spesa già
            divisa in passato; senza prova resta generico, mai inventato. Un tocco apre
            la divisione (già pronta con importo/descrizione) invece di doverci pensare dopo. -->
       <button type="button" id="split-pill-btn" class="neuro-pill-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span id="split-pill-text" class="truncate">Dividi</span>
       </button>
    </div>

    <div class="numpad-grid mt-auto flex-1 min-h-[220px]" tabindex="0" aria-label="Tastierino importo — puoi anche digitare da tastiera fisica">
      ${[7,8,9,4,5,6,1,2,3].map(n=>`<button type="button" class="numpad-key h-full min-h-0" data-num="${n}">${n}</button>`).join('')}
       <button type="button" class="numpad-key text-[var(--red)] font-bold h-full min-h-0 flex items-center justify-center" id="voice-rec-btn" aria-label="Detta l'importo a voce">
         <svg class="w-6 h-6 stroke-current" fill="none" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"/></svg>
       </button>
      <button type="button" class="numpad-key h-full min-h-0" data-num="0">0</button>
      <button type="button" class="numpad-key text-[var(--red)] font-black h-full min-h-0" data-num="DEL" aria-label="Cancella ultima cifra">DEL</button>
    </div>

    <!-- Suggerimento visibile SOLO con puntatore/tastiera fisici (desktop/laptop):
         su touch resta nascosto perché lì il tastierino è la via naturale. -->
    <p class="form-kbd-hint items-center justify-center gap-1.5 text-[10px] text-[var(--on-surface-secondary)] mt-1.5 shrink-0" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M9 13h6"/></svg>
      Puoi digitare da tastiera: cifre, virgola, ⌫ e Invio per confermare
    </p>

    <button type="button" class="save-btn mt-3 shrink-0" id="save-tx-btn" disabled>Conferma</button>
  </div>
`;

const attachFormListeners = (container, prefill = null) => {
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
    // Micro-pop sul numero a ogni cifra digitata: feedback tattile immediato.
    d.classList.remove('amount-pop'); void d.offsetWidth; d.classList.add('amount-pop');

    const amt = parseFloat(rawVal) || 0;
    const saveBtn = container.querySelector('#save-tx-btn');
    
    // Il freno spese ora vive nell'indicatore onesto sotto (renderAmountImpact):
    // niente "Spesa Bloccata" finto — l'app non blocca i tuoi soldi, ti dà un
    // fatto utile e decidi tu. Il bottone resta neutro.
    saveBtn.classList.remove('danger-friction');
    updateSaveBtn();
    renderAmountImpact();
  };

  const updateSaveBtn = () => {
    const btn = container.querySelector('#save-tx-btn');
    if (btn) btn.disabled = !(parseFloat(rawVal) > 0 && catId);
  };

  // ── TASTIERINO VIVO E PREDITTIVO ──
  // A ogni cifra digitata mostra la CONSEGUENZA reale: quanto ti resta del tuo
  // "Oggi puoi spendere" (verde/ambra/rosso) e se è "più del solito" per la
  // categoria (dai tuoi dati). Calcolato FRESCO ad ogni tocco (mai stale, anche
  // sul form desktop persistente). Solo uscite di OGGI e con budget: altrimenti
  // tace (onestà: niente numeri fuori contesto). Non addestra da solo — è la
  // conferma a farlo — ma rende l'inserimento una decisione informata.
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const renderAmountImpact = () => {
    const el = container.querySelector('#amount-impact');
    if (!el) return;
    const amt = parseFloat(rawVal) || 0;
    const hide = () => { el.style.opacity = '0'; el.innerHTML = ''; };
    if (type !== 'uscita' || amt <= 0) return hide();
    const parts = [];
    const now = new Date();
    // FRENO SPESE integrato (src/predict/spending-brake.js): un solo messaggio
    // motivazionale governato dal tuo "quanto l'app ti frena" (aiAggression) e
    // dai segnali REALI del Core — safe-to-spend di oggi, PROIEZIONE di fine mese,
    // importo tipico per categoria. Cambiare modalità cambia DAVVERO cosa vedi.
    const mode = VaultDAO.state.aiAggression || 'advisor';
    const budget = VaultDAO.state.monthlyBudget;
    let safeToday = null, monthEndDelta = null, typical = null;
    if (sameDay(selectedDate, now)) {
      try {
        const monthTxs = VaultDAO.state.transactions[monthKey(now)] || [];
        const sts = getDailySafeToSpend({ monthTxs, allTx: VaultDAO.state.transactions, monthlyBudget: budget, referenceDate: now });
        if (sts) safeToday = sts.safeToday;
        const proj = getMonthEndProjection({ monthTxs, monthlyBudget: budget, referenceDate: now });
        if (proj && typeof proj.projectedDelta === 'number') monthEndDelta = proj.projectedDelta;
      } catch (_) { /* nessun segnale giornaliero */ }
    }
    if (catId) {
      try { const hint = predictAmount(catId, desc?.value || '', VaultDAO.state.transactions); if (hint && hint.amount) typical = hint.amount; } catch (_) {}
    }
    const brake = evaluateBrake(mode, { amount: amt, safeToday, monthEndDelta, typical, budget });
    if (brake.level !== 'ok' && brake.message) {
      const COL = brake.level === 'warn' ? 'text-rose-400' : 'text-amber-400';
      parts.push(`<span class="${COL}">${brake.message}</span>`);
    }
    if (!parts.length) return hide();
    el.innerHTML = parts.join('<span class="opacity-40 mx-0.5">·</span>');
    el.style.opacity = '1';
  };

  // ── "È da dividere?" (src/predict/command-center.js → splitCandidate):
  // shortcut sempre disponibile per le uscite (segnalato mancante dall'utente).
  // Il NOME del gruppo compare solo con un match testuale reale a una spesa già
  // divisa — mai inventato. Ricalcolato a ogni digitazione della descrizione. ──
  const renderSplitPill = () => {
    const btn = container.querySelector('#split-pill-btn');
    if (!btn) return;
    if (type !== 'uscita') { btn.classList.add('hidden'); return; }
    btn.classList.remove('hidden');
    let sc;
    try {
      sc = splitCandidate({ type, description: desc?.value || '', groups: VaultDAO.state.splitGroups || [] });
    } catch (_) { sc = { show: true, confident: false, groupName: null }; }
    const txt = btn.querySelector('#split-pill-text');
    if (txt) txt.textContent = sc.confident && sc.groupName ? `Dividi con ${sc.groupName}` : 'Dividi';
  };

  // Voice Activation
  const voiceBtn = container.querySelector('#voice-rec-btn');
  if (voiceBtn) {
    VoiceCore.init(container);
    voiceBtn.onclick = () => VoiceCore.toggle();
  }

  // "Dividi" si aggiorna a ogni carattere digitato (può nominare il gruppo
  // giusto man mano che la descrizione somiglia a una spesa già divisa).
  if (desc) desc.addEventListener('input', renderSplitPill);
  const splitPillBtn = container.querySelector('#split-pill-btn');
  if (splitPillBtn) {
    splitPillBtn.addEventListener('click', () => {
      haptic('light');
      const amt = parseFloat(rawVal) || 0;
      const description = desc?.value || (catId ? getCatById(catId).name : '');
      window.openSplitExpense({ amount: amt, description });
    });
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
      renderSplitPill(); // "Dividi" ha senso solo per le uscite

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
    // Il pool eleggibile (getQuickAddSuggestions) e' piu' ampio delle chip
    // mostrate: il ranking per contesto sceglie le 4 migliori PER ADESSO da un
    // ventaglio più largo, non solo le 4 più frequenti in assoluto (bug fix:
    // prima il pool era già tagliato a 4 per frequenza PRIMA del ranking, così
    // un'abitudine perfetta per questo momento ma meno frequente non entrava mai).
    const suggestions = rankSuggestionsByContext(
      getQuickAddSuggestions(VaultDAO.state.transactions),
      VaultDAO.state.transactions,
      new Date()
    ).slice(0, 4);
    if (suggestions.length > 0) {
      quickRow.classList.remove('hidden');
      quickRow.innerHTML = suggestions.map((s, i) => `
        <button type="button" class="neuro-pill-btn shrink-0" data-quick-idx="${i}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 shrink-0"><path d="M13 2L4.5 13.5H12l-1 8.5 8.5-11.5H12z"/></svg><span class="truncate max-w-[110px]">${s.description}</span>
          <span class="font-mono font-bold">${formatMoney(s.amount)}</span>
          ${i === 0 && s.reason ? `<span class="text-[11px] opacity-60">${s.reason}</span>` : ''}
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

  // ── TASTIERA FISICA (desktop/laptop, o tablet con tastiera): l'inserimento
  // NON è più solo touch. Chi ha una tastiera digita l'importo direttamente —
  // cifre, virgola/punto per i centesimi (che il tastierino touch non ha),
  // Backspace per cancellare, Invio per confermare. Adattamento reale alla
  // modalità d'input, non un numpad finto da cliccare col mouse.
  // Il gestore è a livello document ma si AUTO-RIMUOVE quando il suo form non è
  // più nel DOM (modale riaperto) → niente listener fantasma né doppi eventi.
  const onPhysicalKey = (e) => {
    if (!container.isConnected) { document.removeEventListener('keydown', onPhysicalKey); return; }
    // #modal-body è persistente: quando un ALTRO modale (dividi spese, gruppi,
    // fattura...) sostituisce l'innerHTML, questo form non c'è più anche se il
    // container resta "connected" — bug reale segnalato dall'utente (le cifre
    // sparivano/venivano bloccate in "Dividi spese"). Senza il proprio form
    // (marker #tx-amount-display) il gestore deve tacere del tutto.
    if (!container.querySelector('#tx-amount-display')) { document.removeEventListener('keydown', onPhysicalKey); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const modalContainer = document.getElementById('modal-container');
    const modalOpen = modalContainer && !modalContainer.classList.contains('hidden');
    const inModal = !!container.closest('#modal-container');
    const ae = document.activeElement;
    const typingText = ae && ae.id === 'tx-desc';
    // Un ALTRO campo (fuori da questo form) ha il focus — es. "Chiedi a Momentum",
    // campi in Impostazioni: lì le cifre devono restare testo, non dirottarle.
    const otherField = ae && ae !== container && !container.contains(ae) &&
      (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT' || ae.isContentEditable);
    // Modale aperto → il suo form è attivo. Form desktop persistente → attivo
    // quando NON c'è un modale e non stai scrivendo altrove: così su Mac/desktop
    // basta iniziare a digitare, senza dover prima cliccare il tastierino.
    const active = inModal ? modalOpen : (!modalOpen && !otherField);
    if (!active) return;
    const key = e.key;
    if (key >= '0' && key <= '9') {
      if (typingText) return; // nella nota, le cifre restano testo
      if (rawVal === '0') rawVal = key; else rawVal += key;
      e.preventDefault(); haptic('light'); updateAmount();
    } else if (key === ',' || key === '.') {
      if (typingText) return;
      if (!rawVal.includes('.')) { rawVal = (rawVal || '0') + '.'; e.preventDefault(); updateAmount(); }
    } else if (key === 'Backspace') {
      if (typingText) return; // lascia cancellare il testo della nota
      rawVal = rawVal.slice(0, -1); e.preventDefault(); updateAmount();
    } else if (key === 'Enter') {
      const btn = container.querySelector('#save-tx-btn');
      if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
    }
  };
  // Il contenitore del modale (#modal-body) è PERSISTENTE: attachFormListeners
  // viene richiamato a ogni apertura sullo stesso elemento. Senza rimuovere il
  // gestore precedente si accumulerebbero listener duplicati (ogni cifra
  // aggiunta N volte). Deduplico per-contenitore: un solo gestore attivo. */
  if (container._mmKeyHandler) document.removeEventListener('keydown', container._mmKeyHandler);
  container._mmKeyHandler = onPhysicalKey;
  document.addEventListener('keydown', onPhysicalKey);

  // ── DATA della transazione (fix bug pre-esistente): il selettore nativo
  // #tx-date-input non aveva alcun listener → scegliere una data non aveva
  // effetto e la spesa si salvava sempre con OGGI, silenziosamente (contro la
  // regola n.1: il form non deve ignorare la scelta dell'utente). Ora aggiorna
  // selectedDate + l'etichetta della pill, e ricalcola l'impatto (che vale solo
  // per oggi → backdatando sparisce, corretto).
  const dateInput = container.querySelector('#tx-date-input');
  const datePillText = container.querySelector('#date-pill-text');
  if (dateInput) {
    dateInput.onchange = () => {
      if (!dateInput.value) return;
      const [yy, mm, dd] = dateInput.value.split('-').map(Number);
      if (!yy || !mm || !dd) return;
      selectedDate = new Date(yy, mm - 1, dd);
      if (datePillText) {
        const now = new Date();
        const isToday = selectedDate.getFullYear() === now.getFullYear()
          && selectedDate.getMonth() === now.getMonth()
          && selectedDate.getDate() === now.getDate();
        datePillText.textContent = isToday
          ? 'Oggi'
          : selectedDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
      }
      updateAmount();
    };
  }

  // Confirm Ledger Save
  container.querySelector('#save-tx-btn').onclick = () => {
    const amt = parseFloat(rawVal);
    if (!amt || !catId) return;
    
    // FRENO al salvataggio, integrato e onesto: solo in modalità "Deciso"
    // (predator) e solo quando il freno è FORTE (warn: la spesa fa chiudere il
    // mese in rosso o è ben oltre il margine di oggi) chiediamo un secondo tocco
    // di conferma — mai un blocco, decidi tu. Le altre modalità non frenano qui.
    if ((VaultDAO.state.aiAggression || 'advisor') === 'predator' && !window.__brakeConfirmed) {
      let sTd = null, mDelta = null, typ = null;
      try {
        const mTx = VaultDAO.state.transactions[monthKey(selectedDate)] || [];
        const s = getDailySafeToSpend({ monthTxs: mTx, allTx: VaultDAO.state.transactions, monthlyBudget: VaultDAO.state.monthlyBudget, referenceDate: new Date() });
        if (s) sTd = s.safeToday;
        const p = getMonthEndProjection({ monthTxs: mTx, monthlyBudget: VaultDAO.state.monthlyBudget, referenceDate: new Date() });
        if (p && typeof p.projectedDelta === 'number') mDelta = p.projectedDelta;
        const h = predictAmount(catId, desc?.value || '', VaultDAO.state.transactions); if (h && h.amount) typ = h.amount;
      } catch (_) {}
      const b = evaluateBrake('predator', { amount: amt, safeToday: sTd, monthEndDelta: mDelta, typical: typ, budget: VaultDAO.state.monthlyBudget });
      if (b.level === 'warn') {
        window.__brakeConfirmed = true;
        setTimeout(() => { window.__brakeConfirmed = false; }, 4000); // il consenso vale pochi secondi
        AudioSynth.play('friction'); haptic('heavy');
        showToast(`${b.message} Tocca di nuovo per confermare.`, 'error');
        return;
      }
    }
    window.__brakeConfirmed = false;

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

  // ── PRE-COMPILAZIONE da Dashboard (safe-to-spend tappabile / nudge "prossima
  // spesa probabile"): apre il form già impostato su tipo+categoria+importo così
  // l'utente conferma in UN tocco. NON registra da solo (onestà: nessun numero
  // finto entra nel vault senza conferma). Alla conferma il salvataggio normale
  // chiama comunque orchestrator.learn → ogni scorciatoia addestra il Core. ──
  if (prefill) {
    if (prefill.type && prefill.type !== type) {
      const typeBtn = container.querySelector(`[data-type="${prefill.type}"]`);
      if (typeBtn) typeBtn.click(); // rigenera le chip del tipo giusto
    }
    if (prefill.category) {
      catId = prefill.category;
      container.querySelectorAll('.cat-chip').forEach(el =>
        el.classList.toggle('selected', el.dataset.catId === prefill.category));
      const chip = container.querySelector(`[data-cat-id="${prefill.category}"]`);
      if (chip) chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
    if (prefill.amount > 0) rawVal = String(prefill.amount);
    if (prefill.description && desc) desc.value = prefill.description;
    updateAmount();
  }
  renderSplitPill(); // stato iniziale (con o senza prefill)

  // Nel MODALE (mobile/tablet/desktop-shortcut) porto il focus sul tastierino:
  // così la tastiera fisica scrive l'importo da subito e appare l'anello di
  // focus (a11y). Nel form desktop persistente NON rubo il focus all'avvio.
  if (container.closest('#modal-container')) {
    setTimeout(() => { try { container.querySelector('.numpad-grid')?.focus({ preventScroll: true }); } catch (_) {} }, 60);
  }
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
  updateSplitMeshDot();
}

// Stesso pallino di stato, ma dentro "Insieme": prima si vedeva SOLO nelle
// impostazioni del Vault — chi stava dividendo le spese non aveva modo di
// sapere se il sync live fosse davvero attivo finché non arrivava un toast.
// Bug reale di intuitività, non solo estetico: "sembra che non stia
// succedendo niente" era la lamentela, e in parte aveva ragione — lo stato
// c'era ma era invisibile da qui.
function updateSplitMeshDot() {
  const el = document.getElementById('split-mesh-status');
  if (!el) return;
  const peers = window.momentumMeshNode?.peers?.size || 0;
  el.innerHTML = peers > 0
    ? `<span class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>${peers} dispositivo${peers === 1 ? '' : 'i'} collegat${peers === 1 ? 'o' : 'i'} in diretta`
    : `<span class="inline-block w-1.5 h-1.5 rounded-full bg-[var(--on-surface-secondary)] opacity-50"></span>Nessun collegamento diretto — il link basta comunque`;
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

// ── DEEP-LINK "UNISCITI" (abbatte l'attrito del condividi) ───────────────────
// Prima l'amico riceveva un blob di testo (MSPLIT1:...) e doveva: selezionarlo,
// copiarlo, aprire Momentum a mano, navigare fino a "Ricevi", incollarlo. Ora
// riceve un LINK Momentum: lo tocca, l'app si apre GIÀ sul gruppo, un tocco e le
// spese si uniscono. Zero copia-incolla, zero navigazione. Il link è la nostra
// firma: marchiato Momentum, riconoscibile, diverso dai codici anonimi dei
// concorrenti. Funziona anche a PWA installata (stessa origine).
// Estrae il payload di un gruppo (MSPLIT1:...) da QUALSIASI punto dell'URL,
// indipendentemente dal dominio e dal formato del link. Riconosce:
//  - ?join=<payload> (query, il formato che generiamo);
//  - #join=<payload> (hash, più robusto su hosting statici / redirect);
//  - il marcatore MSPLIT1: ovunque nell'URL (fallback: link riscritti da
//    servizi di messaggistica, accorciatori, o dominio cambiato dopo il deploy).
// È la stessa filosofia dell'update-locator: riconoscere l'intento dal
// CONTENUTO (il marcatore firmato), non dall'indirizzo — così il link continua
// a funzionare anche se domani l'app vive su un dominio diverso da oggi.
function extractJoinPayload() {
  // Riusa il riconoscimento per-contenuto del motore (stessa logica testata):
  // funziona con ?join=, #join=, o il marcatore ovunque nell'URL, su qualsiasi
  // dominio. Passa l'intero URL: extractShareCode trova il payload dentro,
  // sia nel nuovo formato compresso sia in quello storico gia' in circolazione.
  return extractShareCode(location.href) || extractSharePayload(location.href);
}

// Legge un codice di gruppo di QUALSIASI formato: quello nuovo (compresso) e
// quello storico. Un link mandato mesi fa deve continuare ad aprirsi.
async function readGroupCode(raw) {
  try {
    const g = await unpackShare(raw);
    if (g && g.id && Array.isArray(g.members)) {
      if (!Array.isArray(g.expenses)) g.expenses = [];
      return g;
    }
  } catch (_) { /* prova il formato storico qui sotto */ }
  try { return decodeGroupShare(raw); } catch (_) { return null; }
}

async function consumeJoinLink() {
  try {
    const raw = extractJoinPayload();
    if (!raw) return;
    // Pulisci subito l'URL (query E hash): mai ri-consumare al reload (idempotenza).
    history.replaceState(null, '', location.pathname);
    const g = await readGroupCode(raw);
    if (!g) { showToast('Il link del gruppo non è valido o è incompleto.', 'error'); return; }
    // Se siamo ancora nell'onboarding, aspetta che l'app sia pronta (l'utente
    // deve prima entrare) — riprova a breve senza perdere l'invito.
    if (!document.getElementById('app-core') || document.getElementById('app-core').classList.contains('hidden')) {
      window._pendingJoin = g; return;
    }
    window.openJoinConfirm(g);
  } catch (e) { console.warn('Link gruppo non recuperabile:', e); }
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

// Apre il form di aggiunta GIÀ pre-compilato (da una scorciatoia della
// Dashboard). Funziona identico su mobile, tablet e desktop (stesso modale,
// stesso flusso di conferma → stesso apprendimento del Core).
window.openPrefilledAdd = (prefill = {}) => {
  haptic('light');
  openModal(getTxFormHTML());
  attachFormListeners($('#modal-body'), prefill);
};

// ==========================================
// RENDERS
// ==========================================
// ── DATASET DIMOSTRATIVO (src/ui/demo-dataset.js) ──
// Il primo schermo vuoto è il punto di abbandono più alto: si apre l'app,
// non c'è niente, e sembra un lavoro da fare invece di uno strumento che
// aiuta. Qui l'utente VEDE subito com'è Momentum pieno, e l'esempio si
// dissolve da solo man mano che entrano i suoi dati veri.
// SICUREZZA: le voci finte vivono SOLO in state.demoTransactions e si
// uniscono soltanto qui, al momento di disegnare. Il motore fiscale,
// l'AI e la previsione di cassa leggono state.transactions e non possono
// vederle nemmeno per errore — è impossibile per costruzione.
function realTxCount() {
  return Object.values(VaultDAO.state.transactions || {}).reduce((n, arr) => n + (arr?.length || 0), 0);
}
function ensureDemoSeeded() {
  if (VaultDAO.state.demoDismissed) return;
  if (Array.isArray(VaultDAO.state.demoTransactions)) return;
  // Si semina UNA volta sola, e solo se l'utente non ha ancora dati suoi:
  // chi arriva con un backup ripristinato non deve vedere spese finte.
  if (realTxCount() > 0) return;
  VaultDAO.state.demoTransactions = generateDemoTransactions({ now: new Date() });
}
function liveDemoTx() {
  if (VaultDAO.state.demoDismissed) return [];
  return fadeDemo(VaultDAO.state.demoTransactions || [], realTxCount());
}
// Transazioni di un mese PER DISEGNARE: le vere più le finte superstiti.
function displayTxForMonth(k) {
  const reali = VaultDAO.state.transactions[k] || [];
  const finte = liveDemoTx().filter((t) => String(t.date).slice(0, 7) === k);
  if (!finte.length) return reali;
  return [...reali, ...finte].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}
// Storico COMPLETO per disegnare. Serve ai numeri derivati ("Oggi puoi
// spendere") che guardano oltre il mese corrente: senza, un utente nuovo
// vedrebbe le card piene di esempio e il numero principale a zero — una
// incoerenza che erode la fiducia proprio nel primo momento.
// mergeDemoForDisplay è testata per NON mutare la mappa reale: l'originale
// resta intatto e non può finire salvato nel vault.
function displayAllTx() {
  const finte = liveDemoTx();
  if (!finte.length) return VaultDAO.state.transactions;
  return mergeDemoForDisplay(VaultDAO.state.transactions || {}, finte, realTxCount());
}
// L'avviso è SEMPRE visibile finché l'esempio è attivo: mostrare soldi
// finti senza dirlo sarebbe la bugia peggiore possibile in un'app di
// finanza. Ambra (momento consapevole), mai rosso-colpa. La barra mostra
// quanto manca alla sparizione: rende visibile il progresso invece di
// chiedere un atto di fede.
function renderDemoBanner() {
  const el = document.getElementById('demo-banner');
  if (!el) return;
  const s = demoStatus(VaultDAO.state.demoTransactions || [], realTxCount());
  if (!s.attivo || VaultDAO.state.demoDismissed) { el.classList.add('hidden'); el.innerHTML = ''; return; }
  const fatte = Math.max(0, DEMO_FADE_AT - s.realiMancanti);
  const pct = Math.round((fatte / DEMO_FADE_AT) * 100);
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3">
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div class="min-w-0">
          <p class="text-[12px] font-black text-amber-300 leading-tight">Questo è un esempio, non i tuoi soldi</p>
          <p class="text-[11px] text-amber-200/90 mt-1 leading-snug">Così vedi subito com'è Momentum pieno. Sparisce da solo mentre aggiungi le tue spese: ne mancano <b>${s.realiMancanti}</b>.</p>
        </div>
        <button onclick="window.dismissDemo()" class="shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-amber-400/40 text-amber-200 hover:bg-amber-400/10">Parti dai miei dati</button>
      </div>
      <div class="h-1.5 rounded-full bg-black/30 overflow-hidden mt-2.5">
        <div class="h-full rounded-full bg-amber-400/80 transition-all duration-500" style="width:${pct}%"></div>
      </div>
    </div>`;
}

// "Parti dai miei dati": il demo sparisce subito e non torna più.
window.dismissDemo = () => {
  VaultDAO.state.demoDismissed = true;
  VaultDAO.state.demoTransactions = [];
  VaultDAO.save();
  showToast('Fatto — ora vedi solo i tuoi dati.', 'success');
  renderDashboard();
};

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
  ensureDemoSeeded();
  const txs = displayTxForMonth(k);
  renderDemoBanner();

  let inc = 0, exp = 0, inv = 0;
  txs.forEach(t => {
    if (t.type === 'entrata') inc += t.amount;
    else if (t.type === 'uscita') exp += t.amount;
    else inv += t.amount;
  });
  const liquidity = inc - exp;

  // ── LO STIPENDIO CHE NON E' ANCORA ARRIVATO ──
  // `liquidity` e' entrate meno uscite DEL MESE IN CORSO. Per chi prende uno
  // stipendio il 27, dal giorno 1 al 26 quel numero e' negativo per
  // costruzione: l'affitto e' gia' uscito e lo stipendio deve ancora entrare.
  // Mostrarlo grande e in rosso per ventisei giorni su trenta non e' informare,
  // e' fabbricare allarme ogni mese. E' esattamente cio' che faceva spaventare
  // chi apriva l'app per la prima volta.
  //
  // Il numero resta quello vero — non si addolcisce un dato. Cambia come lo si
  // presenta: se in questo mese non e' ancora arrivata un'entrata ma nei mesi
  // scorsi arrivava, non e' un buco, e' un mese a meta'. Si dice quello.
  // La fonte deve essere la STESSA che disegna, non `state.transactions`: le
  // transazioni di esempio vivono apposta fuori dal vault (demo-dataset.js), e
  // guardando li' la condizione non scattava mai per un utente nuovo — cioe'
  // proprio per chi il numero rosso lo vede per primo.
  const tuttoPerDisegnare = displayAllTx();
  const mesiPrecedentiConEntrate = Object.keys(tuttoPerDisegnare || {})
    .filter((mk) => mk < k)
    .some((mk) => (tuttoPerDisegnare[mk] || []).some((t) => t.type === 'entrata'));
  const entrataAncoraDaVenire = inc === 0 && exp > 0 && mesiPrecedentiConEntrate;

  $('#total-income').textContent = formatMoney(inc);
  $('#total-expense').textContent = formatMoney(exp);
  $('#total-liquidity').textContent = formatMoney(liquidity);
  $('#total-invest').textContent = formatMoney(inv);
  const iebInc = $('#income-expense-bar-inc'), iebExp = $('#income-expense-bar-exp'), iebNote = $('#income-expense-bar-note');
  if (iebInc && iebExp) {
    const total = Math.max(1, inc + exp);
    iebInc.style.width = `${Math.round((inc / total) * 100)}%`;
    iebExp.style.width = `${Math.round((exp / total) * 100)}%`;
    if (iebNote) iebNote.textContent = liquidity >= 0 ? `margine +${formatMoney(liquidity)}` : `margine ${formatMoney(liquidity)}`;
  }
  // Pop-in scaglionato: i numeri VERI arrivano con vita, non un "€0" statico che
  // scatta senza preavviso. Ri-attiva l'animazione anche sui re-render (cambio
  // mese) togliendo/rimettendo la classe con un reflow in mezzo.
  ['#total-income', '#total-expense', '#total-liquidity', '#total-invest'].forEach((sel, i) => {
    const el = $(sel); if (!el) return;
    el.classList.remove('stat-pop'); void el.offsetWidth;
    el.style.animationDelay = `${i * 0.06}s`;
    el.classList.add('stat-pop');
  });

  // "Oggi puoi spendere": sempre riferito a OGGI reale — guardando un mese
  // diverso la card sparisce invece di mostrare un numero fuori contesto.
  // Linguaggio e colori semantici volutamente elementari (verde = puoi,
  // rosso = fermati): è il numero che deve capire chiunque al primo sguardo.
  // ── UNA SOLA RISPOSTA a "quanto posso spendere oggi" ────────────────────────
  // BUG DI DESIGN TROVATO (segnalato dall'utente: la dashboard si complica):
  // questa card (budget settimanale fisso, advisor.js) e "Il tuo mese, senza
  // sorprese" (Cassa Unica: ritmo reale + impegni + stipendio + BNPL) rispondono
  // alla STESSA domanda con DUE numeri DIVERSI, visibili sulla stessa schermata
  // (verificato dal vivo: 0€ vs 1137€ nello stesso istante) — non complessità
  // visiva soltanto, un conflitto che erode la fiducia. La Cassa Unica ha input
  // migliori (dati reali, non un tetto impostato a mano): quando è disponibile
  // (stipendio o impegni noti) diventa l'UNICA fonte, questa card si tace.
  const cassaUnicaAttiva = !!(resolveSalary(VaultDAO.state, VaultDAO.state.transactions) || (VaultDAO.state.fixedCommitments || []).length);
  const stsCard = $('#safe-to-spend-card');
  // Calcolato qui e riusato dall'orb piu' sotto: e' lo stesso numero, e deve
  // essere LO STESSO CALCOLO. Ricalcolarlo in due punti e' il modo classico
  // per ritrovarsi due cifre diverse per la stessa domanda.
  const stsPerOrb = (isCurrentMonth && !cassaUnicaAttiva)
    ? getDailySafeToSpend({ monthTxs: txs, allTx: displayAllTx(), monthlyBudget: VaultDAO.state.monthlyBudget, referenceDate: realNow })
    : null;
  // L'orb piu' sopra mostra "oggi puoi spendere" quando il numero c'e'. In quel
  // caso QUESTA card non lo ripete grande: resta il dettaglio (quanto rimane
  // nella settimana, cosa e' gia' impegnato, la traiettoria del mese). E' la
  // stessa regola gia' scritta per la Cassa Unica — due risposte alla stessa
  // domanda sulla stessa schermata erodono la fiducia piu' di quanto la
  // ripetizione aggiunga.
  const orbHaIlNumero = !!(stsPerOrb && Number.isFinite(stsPerOrb.safeToday));
  if (stsCard) {
    const sts = stsPerOrb;
    // reset stato interattivo (la card viene riusata tra i render)
    stsCard.removeAttribute('data-action');
    stsCard.removeAttribute('role');
    stsCard.removeAttribute('tabindex');
    stsCard.removeAttribute('aria-label');
    stsCard.style.cursor = '';
    if (!sts) {
      stsCard.classList.add('hidden');
    } else {
      stsCard.classList.remove('hidden');
      // ── TRAIETTORIA DEL MESE (forward-looking, proprietaria): "Oggi puoi
      // spendere" guarda a OGGI; questa riga guarda al MESE — di questo passo,
      // come chiudi? Proiezione Holt-Winters (o run-rate), banda semantica,
      // metodo dichiarato in parole semplici. Due orizzonti, una sola card. ──
      let trajHtml = '';
      try {
        const projection = getMonthEndProjection({ monthTxs: txs, monthlyBudget: VaultDAO.state.monthlyBudget, referenceDate: realNow, hwDailyLevel: window.__hwDailyLevel ?? null });
        const tf = monthTrajectoryFocus({ projection, monthlyBudget: VaultDAO.state.monthlyBudget, referenceDate: realNow });
        if (tf.show) {
          const MAP = {
            over:  { col: 'text-rose-400',    bar: 'bg-rose-400/80',    txt: `chiudi oltre il budget di ${formatMoney(Math.abs(tf.delta))}` },
            tight: { col: 'text-amber-400',   bar: 'bg-amber-400/80',   txt: `resti dentro per un soffio (+${formatMoney(tf.delta)})` },
            ok:    { col: 'text-emerald-400', bar: 'bg-emerald-400/80', txt: `resti dentro, +${formatMoney(tf.delta)} di margine` },
          };
          const m = MAP[tf.level] || MAP.ok;
          const pct = Math.max(4, Math.min(100, Math.round(tf.projectedTotal / VaultDAO.state.monthlyBudget * 100)));
          const methodNote = tf.confident ? 'Stima sui tuoi ultimi giorni' : 'Stima sul ritmo di questo mese';
          trajHtml = `
          <div class="mt-3 pt-3 border-t border-[var(--glass-border)]">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[10px] font-bold uppercase tracking-wider text-[var(--on-surface-secondary)]">Di questo passo, a fine mese</span>
              <span class="font-mono font-black text-[13px] ${m.col} shrink-0">${formatMoney(tf.projectedTotal)}</span>
            </div>
            <div class="h-1.5 rounded-full bg-[var(--outline)] overflow-hidden mt-1.5"><div class="h-full ${m.bar}" style="width:${pct}%"></div></div>
            <p class="text-[10px] ${m.col} mt-1 font-semibold">${m.txt}</p>
            <p class="text-[11px] text-[var(--on-surface-secondary)] mt-0.5 opacity-70">${methodNote}</p>
          </div>`;
        }
      } catch (_) { /* proiezione assente: la card resta il solo "oggi" */ }
      if (sts.isOverBudget) {
        stsCard.style.borderTop = '3px solid var(--red)';
        stsCard.innerHTML = `
          <p class="text-[10px] font-extrabold uppercase tracking-widest text-rose-400 mb-1">Oggi meglio non spendere</p>
          <p class="hero-num font-black font-mono text-rose-400 tracking-tighter">0€</p>
          <p class="riga-dato mt-1">${evidenziaNumeri(`Sei oltre di ${formatMoney(Math.abs(sts.weekRemaining))}`)}</p>
          <p class="riga-nota">Ogni giorno senza spese ti rimette in pari.</p>
          ${trajHtml}
        `;
      } else {
        // LA FRASE PIU' BRUTTA DELLA SCHERMATA, ed era una sola riga lunga:
        // "162,81 € rimasti per questa settimana (7 giorni) · esclusi 10,99 €
        // che serviranno per gli abbonamenti in arrivo". Due informazioni
        // diverse incollate da un puntino, una parentesi in mezzo, e nessun
        // appiglio per l'occhio. Adesso sono due righe: la prima e' il dato,
        // la seconda e' la precisazione — e la precisazione sta piu' in basso
        // e piu' spenta, perche' e' quello che e'.
        const chargeNote = sts.reservedForCharges > 0
          ? `<p class="riga-nota">${evidenziaNumeri(`${formatMoney(sts.reservedForCharges)} sono già impegnati per gli abbonamenti in arrivo`)}</p>`
          : '';
        stsCard.style.borderTop = '3px solid var(--green)';
        // Il numero-eroe del giorno diventa l'AZIONE primaria a un tocco: chi sa
        // "oggi posso spendere X" spesso vuole subito segnare una spesa. Tap →
        // form uscita pronto (poi conferma → orchestrator.learn addestra il Core).
        stsCard.dataset.action = 'quick-add-expense';
        stsCard.setAttribute('role', 'button');
        stsCard.setAttribute('tabindex', '0');
        stsCard.setAttribute('aria-label', `Oggi puoi spendere ${formatMoney(sts.safeToday)}. Tocca per segnare una spesa.`);
        stsCard.style.cursor = 'pointer';
        stsCard.innerHTML = `
          <p class="text-[10px] font-extrabold uppercase tracking-widest text-[var(--on-surface-secondary)] mb-1">${orbHaIlNumero ? 'Come stai messo questa settimana' : 'Oggi puoi spendere'}</p>
          ${orbHaIlNumero ? '' : `<p class="hero-num font-black font-mono text-emerald-400 tracking-tighter">${formatMoney(sts.safeToday)}</p>`}
          <p class="riga-dato ${orbHaIlNumero ? '' : 'mt-1'}">${evidenziaNumeri(`${formatMoney(sts.weekRemaining)} rimasti in ${sts.daysLeftInWeek} giorni`)}</p>
          ${chargeNote}
          <p class="text-[10px] font-bold text-emerald-400/80 mt-2 inline-flex items-center gap-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M12 5v14M5 12h14"/></svg>Tocca per segnare una spesa</p>
          ${trajHtml}
        `;
      }
    }
  }

  // ── PROSSIMA SPESA PROBABILE (src/predict/command-center.js): scorciatoia
  // predittiva a UN tocco. In base a ora×giorno mostra l'abitudine che stai per
  // fare (es. "di solito la mattina · Bar ~€1,50") con importo tipico già pronto.
  // Tap → form uscita pre-compilato; la conferma passa dal salvataggio normale →
  // orchestrator.learn addestra il Core. Solo a mese corrente e con pattern netto
  // (altrimenti tace): predittivo ma mai inventato. ──
  const nudgeEl = $('#next-expense-nudge');
  if (nudgeEl) {
    const nudge = isCurrentMonth ? nextExpenseNudge(VaultDAO.state.transactions, realNow) : { show: false };
    if (nudge.show) {
      const c = getCatById(nudge.category);
      const amtLabel = formatMoney(nudge.typicalAmount);
      nudgeEl.classList.remove('hidden');
      // Neurocolore: usa il colore della categoria (riconoscimento immediato,
      // "è la TUA abitudine"), non un neon generico. Tocco ≥44px, aria-label chiaro.
      nudgeEl.innerHTML = `
        <button type="button" data-action="quick-add-predicted" data-cat="${nudge.category}" data-amt="${nudge.typicalAmount}"
          aria-label="Aggiungi ${c.name} da ${amtLabel}, ${nudge.reason || 'spesa abituale'}"
          class="w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border bg-[color-mix(in_srgb,var(--surface-elevated)_50%,transparent)] active:scale-[0.98] transition-transform text-left"
          style="border-color:${c.color}55">
          <span class="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0" style="background:${c.color}">${c.icon}</span>
          <span class="min-w-0 flex-1">
            <span class="block text-[13px] font-bold text-[var(--on-surface)] truncate">${c.name} <span class="font-mono">${amtLabel}</span></span>
            <span class="block text-[11px] text-[var(--on-surface-secondary)] truncate">${nudge.reason ? nudge.reason.charAt(0).toUpperCase() + nudge.reason.slice(1) : 'La tua spesa abituale'} · tocca per aggiungere</span>
          </span>
          <span class="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white" style="background:${c.color}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M12 5v14M5 12h14"/></svg></span>
        </button>`;
    } else {
      nudgeEl.classList.add('hidden');
      nudgeEl.innerHTML = '';
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
      calm:   { bd: 'border-[var(--glass-border)]', bg: 'bg-[color-mix(in_srgb,var(--surface-elevated)_40%,transparent)]', tx: 'text-[var(--on-surface-secondary)]' },
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

  // ── PROMEMORIA DIVISIONE SPESE (integrazione intelligente, non invasiva):
  // mostrato SOLO se c'è un saldo aperto in un gruppo. Verde = ti devono (bello,
  // soldi in arrivo); ambra = devi tu (promemoria gentile, mai rosso/vergogna).
  // Un tocco apre "I miei gruppi" per saldare. Nascosto quando non c'è nulla. ──
  const splitEl = $('#split-reminder');
  if (splitEl) {
    const sr = splitReminder(VaultDAO.state.splitGroups || []);
    if (sr.show) {
      const owed = sr.direction === 'owed';
      const tone = owed
        ? { bd: 'border-emerald-500/30', bg: 'bg-emerald-950/10', tx: 'text-emerald-200', ic: 'text-emerald-400' }
        : { bd: 'border-amber-500/30', bg: 'bg-amber-950/10', tx: 'text-amber-200', ic: 'text-amber-400' };
      const verb = owed ? 'Ti devono' : 'Devi';
      const extra = sr.groups > 1 ? ` <span class="opacity-60">· e altri ${sr.groups - 1} gruppi</span>` : '';
      const ico = owed
        ? '<path d="M12 19V5M5 12l7-7 7 7"/>'        // freccia su = entra a te
        : '<path d="M12 5v14M5 12l7 7 7-7"/>';       // freccia giù = esce da te
      splitEl.classList.remove('hidden');
      splitEl.innerHTML = `
        <button type="button" data-action="open-split" aria-label="${verb} ${formatMoney(sr.amount)} nel gruppo ${sr.groupName}. Tocca per saldare."
          class="w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-xl border ${tone.bd} ${tone.bg} ${tone.tx} active:scale-[0.98] transition-transform text-left">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 shrink-0 ${tone.ic}">${ico}</svg>
          <span class="min-w-0 flex-1 text-[13px]"><b>${verb} ${formatMoney(sr.amount)}</b> in <b>${sr.groupName}</b>${extra}</span>
          <span class="shrink-0 text-[11px] font-bold ${tone.ic}">Salda →</span>
        </button>`;
    } else {
      splitEl.classList.add('hidden');
      splitEl.innerHTML = '';
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
    // "Capitale Libero" e' gergo: nessuno dice cosi' parlando dei propri soldi.
    // La riga sopra il numero dice in italiano che numero e', e cambia con la
    // situazione invece di essere sempre la stessa etichetta.
    // ── CHE NUMERO METTERE NEL CERCHIO ──
    // L'orb occupa il quaranta per cento della prima schermata: e' la cosa che
    // decide se una persona capisce l'app in tre secondi o la chiude. Fino a
    // qui mostrava entrate-meno-uscite del mese, che e' un numero su cui NON
    // si puo' fare niente — e "oggi puoi spendere", l'unico su cui si agisce,
    // finiva sotto la piega su un telefono corto.
    // Adesso il cerchio mostra il numero AZIONABILE quando esiste, e il resto
    // scende a riga di contesto. Non e' un'aggiunta: e' uno scambio di posto,
    // e la card qui sotto tace per non dare due volte la stessa risposta —
    // la stessa regola gia' scritta per la Cassa Unica.
    const azionabile = stsPerOrb && Number.isFinite(stsPerOrb.safeToday) ? stsPerOrb.safeToday : null;
    const etichetta = azionabile !== null ? 'Oggi puoi spendere'
      : entrataAncoraDaVenire ? 'Speso finora questo mese' : 'Entrate meno uscite, questo mese';
    // Il ROSSO si usa quando c'e' davvero una brutta notizia. Un mese a meta'
    // senza stipendio non lo e': li' il numero resta neutro, e sotto c'e' una
    // riga che spiega perche'. Il colore e' un'informazione, non una decorazione:
    // se allarma quando non c'e' nulla di cui allarmarsi, smette di funzionare
    // quando serve davvero.
    const colore = azionabile !== null ? (azionabile >= 0 ? 'text-[var(--cyan)]' : 'text-[var(--red)]')
      : entrataAncoraDaVenire ? 'text-[var(--on-surface)]'
        : liquidity >= 0 ? 'text-[var(--cyan)]' : 'text-[var(--red)]';
    const valore = azionabile !== null ? formatMoney(azionabile)
      : entrataAncoraDaVenire ? formatMoney(exp) : formatMoney(liquidity);
    // La riga sotto compare solo quando toglie una paura o aggiunge il contesto
    // che manca. Mai come commento perenne: una spiegazione sempre presente
    // diventa arredamento e smette di essere letta.
    // ── SOTTO L'ORB: UNA STRISCIA, NON UNA FRASE ──
    // Qui c'era "Questo mese hai speso X, e lo stipendio deve ancora
    // arrivare." Vera e utile, ma un paragrafo di prosa in mezzo allo spazio
    // vuoto sotto un cerchio — l'utente l'ha bocciata e aveva ragione.
    // Quella frase diceva tre cose che sono tutte POSIZIONI NEL TEMPO: a che
    // punto del mese sei, quanto hai speso, quando entrano i soldi. Una riga
    // disegnata le mostra in un colpo d'occhio; una frase costringe a
    // ricostruirle leggendo.
    // Ed e' piu' precisa: "deve ancora arrivare" non distingue tre giorni da
    // diciotto, che sono situazioni completamente diverse. La striscia si'.
    const contesto = $('#orb-contesto');
    if (contesto) {
      const stato = statoDelMese(displayAllTx(), { oggi: realNow, speso: exp });
      const html = isCurrentMonth ? stripHtml(stato, { formatMoney }) : '';
      contesto.innerHTML = html;
      contesto.classList.toggle('hidden', !html);
    }
    const spiega = '';
    orbText.innerHTML = `
      <div class="orb-etichetta">${etichetta}</div>
      <div class="orb-numero font-mono font-black ${colore}">${valore}</div>${spiega}${streakHtml}
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

  // Impegni ricorrenti in arrivo (affitto/mutuo/abbonamenti): calcolati una volta,
  // riusati sia dall'avanzo-da-risparmiare sia dalla fascia "soldi impegnati".
  const com = getMonthlyCommitments(VaultDAO.state.transactions, realNow);
  const sweepEstText = $('#sweeper-estimate-val');
  // PREDITTIVO (computeSafeSweepEstimate, condivisa col click "SEGNA"): non
  // solo gli impegni già noti, ma il punto più basso della Cassa Unica in
  // scenario prudente fino al prossimo stipendio — non suggerisce mai di
  // mettere via soldi che il tuo stesso ritmo di spesa userà prima di allora.
  const sweepEst = computeSafeSweepEstimate(liquidity, inv, realNow);
  if (sweepEstText) {
    sweepEstText.textContent = formatMoney(sweepEst);
  }
  const sweepBtn = $('#sweep-btn');
  if (sweepBtn) {
    sweepBtn.disabled = (sweepEst <= 0);
  }

  // La "sicurezza" dovrebbe coprire il BISOGNO ESSENZIALE (affitto, mutuo,
  // bollette) non l'intero stile di vita — la spesa discrezionale la puoi
  // tagliare in un'emergenza, l'affitto no. Se l'utente ha dichiarato i suoi
  // impegni fissi (Cassa Unica / "Il tuo mese, senza sorprese"), il traguardo
  // usa QUELLI (più corretto e personale); altrimenti degrado onesto sulla
  // media di spesa totale, come prima — mai un dato mancante che rompe il calcolo.
  const activeCommitments = (VaultDAO.state.fixedCommitments || []).filter(c => +c.amount > 0 && isActive(c, Date.now()));
  const essentialMonthly = activeCommitments.reduce((s, c) => s + (+c.amount || 0), 0);
  const avgExpenses = monthCountAllTime > 0 ? (totalExpAllTime / monthCountAllTime) : 500;
  const safetyBasis = essentialMonthly > 0 ? essentialMonthly : avgExpenses;
  const safetyGoal = safetyBasis * 6;
  const safetyScore = safetyGoal > 0 ? Math.min(Math.round((cumulativeReserve / safetyGoal) * 100), 100) : 0;

  const safetyStatusText = $('#safety-status');
  if (safetyStatusText) {
    safetyStatusText.textContent = `Sicurezza: ${safetyScore}%`;
    safetyStatusText.style.color = safetyScore >= 100 ? 'var(--green)' : (safetyScore > 50 ? 'var(--yellow)' : 'var(--red)');
  }

  const waveBar = $('#reserve-wave');
  if (waveBar) {
    waveBar.style.height = `${Math.max(10, Math.min(safetyScore, 100))}%`;
  }

  // ── SOLDI GIÀ IMPEGNATI (getMonthlyCommitments): la quota del saldo già
  // promessa agli impegni ricorrenti in arrivo entro fine mese (affitto, mutuo,
  // abbonamenti). Mostra il "disponibile VERO" = liquidità − riserva, con barra
  // impegnato/libero e i 3 impegni maggiori. Anti-sorpresa = fiducia = retention.
  // Onesto: solo ricorrenti realmente rilevati; se 0, la fascia resta nascosta. ──
  const commitEl = $('#committed-reserve');
  if (commitEl) {
    // BUG REALE trovato dal vivo: il "disponibile vero" toglieva gli impegni
    // ricorrenti ma NON l'accantonamento fiscale — un utente con P.IVA vedeva
    // come "suoi" esattamente i soldi che il salvadanaio virtuale (tax.js)
    // gli dice di non toccare. Stessa aritmetica del resto del modulo fiscale
    // (taxSetAsideForPeriod + taxReserveStatus), mai una seconda formula:
    // qui si USA il risultato, non lo si ricalcola in modo diverso.
    let taxReserved = 0;
    try {
      if (hasInvoiceIncome()) {
        const allFlat = Object.values(VaultDAO.state.transactions || {}).flat();
        const learned = VaultDAO.state.taxLearned || {};
        const model = (typeof window !== 'undefined' && window.__incomeModel) || null;
        const dovutoTotale = taxSetAsideForPeriod(allFlat, { regime: VaultDAO.state.taxRegime || 'forfettario', learned, model }).daAccantonare;
        taxReserved = taxReserveStatus(dovutoTotale, VaultDAO.state.taxPayments || []).daAccantonare;
      }
    } catch (_) { /* onesto: se il calcolo fiscale non è disponibile, il resto della card resta valido */ }
    const totalReserved = +(com.reserved + taxReserved).toFixed(2);
    if (totalReserved > 0 && liquidity > 0) {
      const free = Math.max(0, +(liquidity - totalReserved).toFixed(2));
      const pctCommitted = Math.min(100, Math.round(totalReserved / liquidity * 100));
      const chips = com.top.map(t => `<span class="text-[10px] px-2 py-0.5 rounded-full bg-black/25 border border-[var(--glass-border)] whitespace-nowrap">${t.name.length > 16 ? t.name.slice(0, 15) + '…' : t.name} · ${formatMoney(t.amount)}</span>`).join('');
      commitEl.classList.remove('hidden');
      commitEl.innerHTML = `
        <div class="rounded-2xl border border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--surface-elevated)_40%,transparent)] p-3.5">
          ${com.reserved > 0 ? `<div class="flex items-center justify-between gap-2 mb-1.5">
            <span class="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--on-surface-secondary)]"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>Già impegnati entro fine mese</span>
            <span class="font-mono font-black text-sm text-amber-300">${formatMoney(com.reserved)}</span>
          </div>` : ''}
          ${taxReserved > 0 ? `<div class="flex items-center justify-between gap-2 mb-2">
            <span class="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--on-surface-secondary)]"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>Da mettere via per il fisco</span>
            <span class="font-mono font-black text-sm text-orange-300">${formatMoney(taxReserved)}</span>
          </div>` : ''}
          <div class="h-2 rounded-full bg-emerald-500/25 overflow-hidden"><div class="h-full bg-amber-400/70" style="width:${pctCommitted}%"></div></div>
          <div class="flex items-center justify-between mt-2">
            <span class="text-[10px] text-[var(--on-surface-secondary)]">Disponibile vero (già tolti impegni e fisco)</span>
            <span class="font-mono font-bold text-sm text-emerald-400">${formatMoney(free)}</span>
          </div>
          ${chips ? `<div class="flex flex-wrap gap-1.5 mt-2">${chips}</div>` : ''}
          <p class="text-[10px] text-[var(--on-surface-secondary)] mt-2 opacity-80">Lascia questi soldi sul conto: serviranno per gli impegni in arrivo${taxReserved > 0 ? ' e per le tasse' : ''}. Momentum non li sposta — te lo ricorda soltanto.</p>
        </div>`;
    } else {
      commitEl.classList.add('hidden');
      commitEl.innerHTML = '';
    }
  }

  // Fantasmi: stipendio − impegni fissi (mutuo/prestiti/affitto/bollette).
  try { renderGhostForecast(); } catch (_) {}

  // Ledger list
  const list = $('#transaction-list-container');
  list.innerHTML = '';
  if (txs.length === 0) {
    list.innerHTML = `<p class="text-center text-xs text-[var(--on-surface-secondary)] py-6">Nessun movimento ancora registrato.</p>`;
    return;
  }

  // Difensivo: una transazione può arrivare "sottile" da una pipeline che si
  // aspetta di arricchirla più tardi da un duplicato cross-canale
  // (mergeTransaction in deduplicator.js riempie i campi mancanti quando lo
  // stesso movimento arriva da un secondo canale — se quel secondo canale non
  // arriva mai, un campo resta `undefined` per sempre). Senza questo fallback,
  // `${t.description}` stampava alla lettera la parola "undefined" a schermo.
  const escTx = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  txs.sort((a,b) => b.id - a.id).forEach(t => {
    const c = getCatById(t.category);
    const isInc = t.type === 'entrata';
    const isInv = t.type === 'invest';
    const descLabel = (t.description && String(t.description).trim()) || c.name;
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
             <p class="font-bold text-[0.9rem] sm:text-[0.95rem] text-[var(--on-surface)] tracking-tight truncate flex items-center"><span class="truncate">${escTx(descLabel)}</span></p>
             <p class="text-[10px] sm:text-[11px] text-[var(--on-surface-secondary)] font-bold uppercase tracking-wider mt-0.5 truncate">${escTx(dateLabel)}</p>
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
  // Ingresso scaglionato (stesso principio di .view-in): reflow forzato per
  // ri-attivare l'animazione a ogni render (nuovo mese, nuova tx, eliminazione).
  list.classList.remove('tx-in'); void list.offsetWidth; list.classList.add('tx-in');
};

window.deleteTx = (k, id) => {
  if (confirm("Rimuovere questo movimento?")) {
    const finish = () => {
      VaultDAO.deleteTransaction(k, id);
      renderDashboard();
      renderAnalysis();
      showToast("Transazione rimossa.", "info");
    };
    const card = document.querySelector(`.tx-card[data-id="${id}"]`);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (card && !reduced) {
      card.classList.add('tx-leaving');
      setTimeout(finish, 220);
    } else {
      finish();
    }
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
    const note = ($('#ev-note')?.value || '').trim();
    const amountRaw = parseFloat($('#ev-amount').value);
    const amount = (!isNaN(amountRaw) && amountRaw > 0) ? amountRaw : 0; // importo FACOLTATIVO
    const dateStr = $('#ev-date').value;

    // Serve almeno un cosa + una data. L'importo NON è obbligatorio: un
    // appuntamento (dentista, riunione) è valido senza cifra.
    if (!title || !dateStr) {
      showToast("Scrivi cosa e quando (l'importo è facoltativo).", "error");
      AudioSynth.play('friction');
      return;
    }

    const ev = {
      id: Date.now() + Math.random(),
      title,
      note,
      amount,
      date: dateStr,
      completed: false,
      // Senza importo è un appuntamento/promemoria; con importo una scadenza.
      intent: amount > 0 ? 'deadline' : 'appointment',
      category: 'scadenza'
    };

    if (!VaultDAO.state.events) VaultDAO.state.events = [];
    VaultDAO.state.events.push(ev);
    VaultDAO.save();

    $('#ev-title').value = '';
    if ($('#ev-note')) $('#ev-note').value = '';
    $('#ev-amount').value = '';
    $('#ev-date').value = '';

    window.renderCalendarEvents();
    AudioSynth.play('success');
    showToast(amount > 0 ? "Scadenza pianificata." : "Appuntamento aggiunto.", "success");
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

  // Righe normalizzate dal modulo puro (src/predict/calendar-format.js):
  // etichetta corretta anche per gli eventi da VOCE (che hanno description, non
  // title), appuntamenti NON finanziari (niente "−0,00 €"), nota estesa, ordine
  // per data con i completati in fondo. Il DOM resta qui, la logica è testata.
  const rows = buildCalendarRows(events, upcoming, new Date());
  const sum = calendarSummary(rows);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // Icona per tipo (neurodesign: un colpo d'occhio distingue appuntamento da
  // scadenza da promemoria da previsione, senza leggere).
  const kindIcon = {
    appointment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 inline-block align-[-2px] mr-1"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 3v3M16 3v3"/></svg>',
    reminder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 inline-block align-[-2px] mr-1"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    deadline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 inline-block align-[-2px] mr-1"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    predicted: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 inline-block align-[-2px] mr-1"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
  };

  // Intestazione di gestione: con MOLTI eventi conta a colpo d'occhio (oltre i 5
  // non serve più contarli a mano) e dà l'export .ics di tutti in un tocco.
  const header = `<div class="flex items-center justify-between mb-2 px-0.5">
    <span class="text-[10px] font-bold uppercase tracking-wider text-[var(--on-surface-secondary)]">${sum.active + sum.predicted} in programma${sum.done ? ` · ${sum.done} fatt${sum.done > 1 ? 'i' : 'o'}` : ''}</span>
    ${sum.active ? `<button onclick="window.exportEventsToICS()" class="text-[10px] font-bold text-[var(--primary)] hover:underline">Esporta nel calendario</button>` : ''}
  </div>`;

  list.innerHTML = header + rows.map(ev => {
    const dt = new Date(ev.date);
    const validDate = !isNaN(dt.getTime());
    const ItalianDate = validDate ? dt.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    const timeStr = (ev.hasTime && validDate) ? ' · ' + dt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';
    const border = ev.predicted ? 'border-amber-500/20 bg-amber-950/5' : (ev.completed ? 'border-[color-mix(in_srgb,var(--outline)_50%,transparent)] bg-[color-mix(in_srgb,var(--surface-solid)_40%,transparent)]' : 'border-[var(--outline)] bg-[var(--surface-solid)]');
    const meta = ev.predicted ? ' · stima dai tuoi abbonamenti' : (ev.kind === 'appointment' ? ' · appuntamento' : '');
    // Importo mostrato SOLO se davvero finanziario: un appuntamento non mostra €.
    const money = ev.isFinancial
      ? `<span class="font-mono font-bold text-xs ${ev.predicted ? 'text-amber-400' : 'text-[var(--red)]'}">${ev.predicted ? '~' : '−'}${formatMoney(ev.amount)}</span>`
      : '';
    return `
      <div class="flex items-center justify-between p-2.5 rounded-lg border ${border} hover:border-[color-mix(in_srgb,var(--primary)_30%,transparent)] transition-colors ${ev.completed ? 'opacity-60' : ''}">
        <div class="min-w-0 pr-2">
          <p class="font-bold text-xs text-white truncate ${ev.completed ? 'line-through' : ''}">${kindIcon[ev.kind] || ''}${esc(ev.label)}</p>
          ${ev.note ? `<p class="text-[10px] text-[var(--on-surface-secondary)] mt-0.5 truncate">${esc(ev.note)}</p>` : ''}
          <p class="text-[10px] text-[var(--on-surface-secondary)] mt-0.5">${ItalianDate}${timeStr}${meta}</p>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          ${money}
          ${ev.predicted ? '' : `<button onclick="window.deleteCalendarEvent(${ev.id})" class="text-[10px] font-bold text-[var(--red)] hover:underline p-1" aria-label="Rimuovi">✕</button>`}
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
  const noteStr = (ev.note || '').trim();
  block += `DESCRIPTION:${ev.intent === 'appointment' ? 'Appuntamento' : 'Promemoria'} Momentum Vault.${isFinancial ? ` Importo: ${formatMoney(ev.amount)}.` : ''}${noteStr ? ` ${noteStr.replace(/[\r\n]+/g, ' ')}` : ''}\r\n`;
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

// ── QUANTO È DAVVERO SICURO METTERE VIA ─────────────────────────────────────
// Unica fonte di verità per l'avanzo sweepabile: usata sia dal render (numero
// mostrato) sia dal click "SEGNA" (numero registrato) — MAI due calcoli
// diversi (era il bug corretto: prima il pulsante ricalcolava a modo suo).
// PREDITTIVO: non basta sottrarre gli impegni GIÀ noti da qui a fine mese
// (calcolo statico) — si simula la Cassa Unica fino al prossimo stipendio e si
// prende il punto PIÙ BASSO dello scenario prudente lungo tutto il percorso,
// non solo il saldo finale. Se un giorno intermedio (es. il weekend prima
// dello stipendio) scende sotto quello odierno, è QUELLO il vincolo reale —
// mai suggerire di mettere via soldi che il tuo stesso ritmo di spesa userà
// prima che ti paghino. Onesto: senza Cassa Unica disponibile (dati insufficienti)
// degrada al calcolo statico precedente, mai un crash o un'invenzione.
function computeSafeSweepEstimate(liquidity, inv, referenceDate = new Date()) {
  const com = getMonthlyCommitments(VaultDAO.state.transactions, referenceDate);
  const naive = Math.max(0, +(liquidity - inv - com.reserved).toFixed(2));
  try {
    const salary = resolveSalary(VaultDAO.state, VaultDAO.state.transactions);
    const daysAhead = salary ? Math.max(7, Math.min(30, daysToNextPayday(salary, referenceDate) || 21)) : 14;
    // Le rate BNPL in arrivo (Klarna/PayPal/Scalapay...) sono soldi già
    // promessi quanto un impegno: entrano nella stessa simulazione, così il
    // minimo prudente le tiene conto SENZA una sottrazione separata da
    // mantenere in sincrono — un piano attivo abbassa da solo l'avanzo sicuro.
    const bnplEvents = bnplToLedgerEvents(VaultDAO.state.transactions,
      { now: referenceDate.getTime(), horizonDays: daysAhead, learned: VaultDAO.state.mlData?.bnplLearned || {}, anticipate: true, dismissed: VaultDAO.state.mlData?.bnplDismissed || [] });
    const fc = cashForecast({
      allTx: VaultDAO.state.transactions,
      commitments: VaultDAO.state.fixedCommitments || [],
      salary,
      startBalance: liquidity,
      now: referenceDate.getTime(),
      horizonDays: daysAhead,
      extraLedgerEvents: bnplEvents,
    });
    if (!fc.known) return naive;
    // il minimo prudente lungo TUTTO il percorso, non solo il finale.
    const prudentMin = Math.min(fc.end.p10, ...fc.path.map(p => p.p10));
    return Math.max(0, Math.min(naive, +prudentMin.toFixed(2)));
  } catch (_) { return naive; }
}

// Segna l'avanzo come "risparmio da spostare": l'importo è LO STESSO mostrato
// nella card (computeSafeSweepEstimate, condivisa col render), mai un altro
// calcolo dietro le quinte. Onesto come applySweep: nessun ETF, nessuna banca
// toccata — solo un'annotazione, il trasferimento reale lo fa l'utente.
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
    const sweepAmt = computeSafeSweepEstimate(liquidity, inv, VaultDAO.state.currentDate);

    if (sweepAmt <= 0) {
      showToast("Nessun avanzo disponibile da mettere al sicuro (tolti gli impegni in arrivo).", "info");
      AudioSynth.play('friction');
      return;
    }

    const newTx = {
      id: Date.now() + Math.random(),
      amount: sweepAmt,
      type: 'invest',
      category: 'risparmio',
      description: 'Risparmio avanzo (da spostare tu)',
      color: getCatById('risparmio').color,
      date: new Date().toISOString(),
    };
    VaultDAO.addTransaction(k, newTx);
    if (window.momentumOrchestrator) {
      window.momentumOrchestrator.learn(newTx.description, 'risparmio', sweepAmt, new Date());
    } else {
      NeuralNexus.train(newTx.description, 'risparmio', sweepAmt, new Date());
    }

    AudioSynth.play('sweep');
    haptic('heavy');
    renderDashboard();
    renderAnalysis();
    showToast(`Segnato. Ora sposta davvero ${formatMoney(sweepAmt)} sul tuo conto risparmio — Momentum non tocca la banca.`, "success");
  } catch (err) { console.error(err); }
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
        <div class="flex flex-wrap justify-between items-end gap-x-2">
          <p class="text-xl font-black font-mono min-w-0 truncate ${overBudget ? 'text-rose-400' : 'text-emerald-400'}">${formatMoney(Math.abs(currentWeek.remaining))}</p>
          <p class="text-[11px] text-[var(--on-surface-secondary)] shrink-0">${overBudget ? 'oltre budget' : 'rimanenti'} su ${formatMoney(currentWeek.budget)}</p>
        </div>
        ${currentWeek.rolloverIn ? `<p class="text-[10px] mt-1 ${currentWeek.rolloverIn > 0 ? 'text-emerald-400/70' : 'text-rose-400/70'}">${currentWeek.rolloverIn > 0 ? '+' : ''}${formatMoney(currentWeek.rolloverIn)} riportato dalla settimana scorsa</p>` : ''}
      `;
    } else {
      // mese non corrente: mostra il riepilogo di tutte le settimane invece del solo "questa settimana"
      weeklyBox.innerHTML = `
        <h4 class="text-[10px] font-extrabold uppercase tracking-widest text-[var(--on-surface-secondary)] mb-2">Budget per settimana</h4>
        <div class="space-y-1 text-[11px]">
          ${weeks.map(w => `<div class="flex justify-between"><span class="text-[var(--on-surface-secondary)]">${fmtDay(w.start)}-${fmtDay(w.end)}</span><span class="${w.remaining < 0 ? 'text-rose-400' : 'text-[var(--on-surface-secondary)]'}">${formatMoney(w.remaining)}</span></div>`).join('')}
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
          data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }] },
          options: {
            responsive: true, maintainAspectRatio: false, cutout: '75%',
            plugins: { legend: { display: false } },
            // Ogni cambio mese ricrea il chart (destroy+new) → senza questo
            // l'animazione d'entrata sparisce dal secondo render in poi e i
            // segmenti "scattano". Curva morbida esplicita, sempre viva.
            animation: { duration: 650, easing: 'easeOutQuart' },
            transitions: { active: { animation: { duration: 200 } } },
          }
        });
      } catch(e) { console.warn("Chart error:", e); }
    } else {
      ctx.clearRect(0, 0, chartEl.width, chartEl.height);
    }
  }
  // Legenda: la ciambella da sola richiede hover/tocco per sapere COSA sono
  // le fette (il tooltip nativo di Chart.js non è leggibile a colpo d'occhio,
  // specialmente da bambino) — riusa gli stessi labels/data/colors, mai un
  // secondo calcolo. Ordinata dalla fetta più grande alla più piccola.
  const legendEl = $('#category-chart-legend');
  if (legendEl) {
    const total = Object.values(catTotals).reduce((s, v) => s + v, 0);
    const rows = Object.keys(catTotals).map(id => ({ id, name: getCatById(id).name, color: getCatById(id).color, amount: catTotals[id] }))
      .sort((a, b) => b.amount - a.amount);
    legendEl.innerHTML = rows.map(r => `
      <div class="flex items-center gap-2 text-[11px]">
        <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${r.color}"></span>
        <span class="text-[var(--on-surface-secondary)] truncate flex-grow">${r.name}</span>
        <span class="text-slate-500 shrink-0">${total > 0 ? Math.round((r.amount / total) * 100) : 0}%</span>
        <span class="font-mono font-bold shrink-0 w-16 text-right">${formatMoney(r.amount)}</span>
      </div>`).join('');
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

  // FIRE calculator (src/predict/fire.js): PRIMA qui c'era una divisione
  // lineare (target / risparmio-mensile×12) che ignorava del tutto la
  // crescita composta del capitale GIÀ investito — per chi ha un
  // portafoglio, sovrastimava di molto gli anni mancanti. Ora simula la
  // crescita composta mese su mese con un rendimento REALE MISURATO
  // (measured-assumptions.js, walk-forward su prezzi SPY reali — mai un
  // tasso inventato), e mostra anche il Coast FIRE (il capitale già
  // investito, lasciato crescere da solo, basta a raggiungere il
  // traguardo entro un'età di pensionamento di riferimento?).
  let totalExp = 0;
  Object.keys(VaultDAO.state.transactions).forEach(m => {
    VaultDAO.state.transactions[m].forEach(t => {
      if (t.type === 'uscita') totalExp += t.amount;
    });
  });
  const activeMonths = Object.keys(VaultDAO.state.transactions).length || 1;
  const fireExpenses = (totalExp / activeMonths) * 12;
  const fireTargetVal = fireTargetCapital(fireExpenses);
  const fireExpectedReturn = measuredAssumptions.spy?.buyHold?.mu ?? 0.09;
  const fireInvested = computeNetWorth({
    transactions: VaultDAO.state.transactions || {},
    positions: VaultDAO.state.positions || [],
    currentPriceByTicker: window.__livePrices || {},
    manualAssets: VaultDAO.state.manualAssets || [],
    liabilities: 0,
  }).invested;

  $('#fire-target-val').textContent = formatMoney(fireTargetVal);
  const fireResult = yearsToFire({
    currentInvested: fireInvested,
    monthlyContribution: Math.max(0, proj.projectedMonthlyFlow || 0),
    targetCapital: fireTargetVal,
    expectedAnnualReturn: fireExpectedReturn,
  });
  $('#fire-years').textContent = fireResult.reachable ? `${fireResult.years.toFixed(1)} anni` : "Nessun risparmio.";
  const coastNoteEl = $('#fire-coast-note');
  if (coastNoteEl) {
    const coast = coastFireCheck({ currentAge: 35, retirementAge: 65, currentInvested: fireInvested, targetCapital: fireTargetVal, expectedAnnualReturn: fireExpectedReturn });
    coastNoteEl.textContent = `Rendimento ipotizzato ${(fireExpectedReturn * 100).toFixed(1)}%/anno (misurato su SPY, non promesso).${fireInvested > 0 && coast.isCoastFire ? ' Il capitale già investito, da solo, potrebbe già bastare entro i 65 anni (Coast FIRE).' : ''}`;
  }

  // Heatmap Grid
  const grid = $('#heatmap-grid');
  if (grid) {
    grid.innerHTML = '';
    const today = new Date();
    const days = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

    const spends = {};
    __heatmapDayTx = {};
    txs.forEach(t => {
      if (t.type === 'uscita') {
        const d = new Date(t.date).getDate();
        spends[d] = (spends[d] || 0) + t.amount;
        (__heatmapDayTx[d] = __heatmapDayTx[d] || []).push(t);
      }
    });
    __heatmapMonthLabel = VaultDAO.state.currentDate.toLocaleDateString('it-IT', { month: 'long' });

    for (let i = 1; i <= days; i++) {
      const amt = spends[i] || 0;
      let bg = 'bg-slate-900/40 border border-[var(--glass-border)]';
      if (amt > 0 && amt <= 20) bg = 'bg-indigo-900/30';
      else if (amt > 20 && amt <= 80) bg = 'bg-indigo-700/50';
      else if (amt > 80 && amt <= 200) bg = 'bg-indigo-500/70';
      else if (amt > 200) bg = 'bg-indigo-400';

      // title = tooltip per mouse; il click (sotto) è il vero drill-down,
      // necessario perché su touch il title non appare mai al tocco.
      grid.innerHTML += `<div class="heatmap-day ${bg} flex items-center justify-center text-[11px] font-mono text-[var(--on-surface-secondary)] cursor-pointer" data-heatmap-day="${i}" title="${i} ${__heatmapMonthLabel}: ${amt > 0 ? formatMoney(amt) : 'nessuna spesa'}">${i}</div>`;
    }
    $('#heatmap-day-detail').innerHTML = '';
  }

  // Alerts & Anomalie: prima chiamata sincrona (proiezione run-rate), poi
  // il forecast worker la ri-renderizza con il livello Holt-Winters vero.
  renderRadarAlerts(k, budgetLimit, window.__hwDailyLevel ?? null);
  renderInvestments();
  renderNetWorth();
  renderPeriodCompare();
  renderCausalGraphViz();
  renderTax(k);
};

// ── I TRE BLOCCHI CHE NESSUN PORTALE PUÒ MOSTRARE ──────────────────────────
// Portano a schermo i motori costruiti a parte e finora invisibili:
//  1. il tetto forfettario misurato sugli INCASSI (tax-cash-basis.js) — il
//     numero giusto, non il fatturato che tutti guardano per sbaglio;
//  2. chi non ti paga e da quanto — visibile perché Momentum vede sia le
//     fatture emesse sia i soldi entrati, cosa che un portale non può fare;
//  3. la prossima scadenza con un PIANO settimanale concreto
//     (tax-deadlines.js), mai un allarme senza soluzione.
// Ogni blocco compare SOLO quando ha qualcosa di vero da dire: una card che
// parla sempre smette di essere letta.
// Stato per il modale F24 (window.openF24Precompilato): popolato da
// renderTaxCashBlocks ogni volta che la card fiscale si ridisegna, così il
// bottone inline non deve serializzare oggetti complessi in un onclick.
let __f24State = null;
// true quando la card fiscale ha un motivo REALE di attenzione (scadenza
// saltata o cassa a rischio prima di una scadenza) — legge renderTax per
// accendere un piccolo segnale discreto sull'icona della card esistente,
// mai un popup o una schermata in più.
let __taxCardUrgent = false;

// `urgent`: true solo quando c'è un motivo REALE di attenzione (scadenza
// saltata, o la cassa prevista scende sotto zero prima di una scadenza) —
// usato dal chiamante per un piccolo segnale visivo discreto sulla card
// esistente, mai un popup o una nuova schermata. Niente allarme per il solo
// fatto di avere una scadenza futura tranquilla: sarebbe rumore, non un segnale.
function renderTaxCashBlocks(proj, regime) {
  let html = '';
  let urgent = false;
  try {
    const invoices = VaultDAO.state.invoices || [];
    const anno = new Date().getFullYear();

    // 1 + 2: servono le fatture emesse. Senza, questi blocchi non hanno
    // materia — e non si inventa nulla.
    if (invoices.length) {
      const matched = matchInvoicePayments(invoices, VaultDAO.state.transactions || {});
      if (regime && String(regime).startsWith('forfettario')) {
        const tetto = rulesForYear(anno).forfettarioCeiling;
        const stato = ceilingStatusByCash(cashBasisRevenue(matched, anno), accrualRevenue(invoices, anno), tetto);
        // Il livello 'ok' non si mostra: sarebbe rumore. Si parla solo
        // quando c'è davvero qualcosa da sapere.
        if (stato && stato.livello !== 'ok') {
          const col = stato.livello === 'superato' ? 'text-orange-300' : 'text-amber-300';
          html += `<div class="text-[11px] ${col} mt-1.5 leading-snug">${escapeHtml(stato.messaggio)}</div>`;
        }
      } else if (regime === 'ordinario') {
        // LACUNA COLMATA: prima il regime ordinario (per chi fattura grandi
        // numeri) aveva solo l'IVA nella singola fattura, mai la liquidazione
        // periodica reale che deve versare. Regole verificate su fonte
        // ufficiale (iva-liquidazione.js), stessa disciplina del forfettario.
        const volumeAnnoPrec = accrualRevenue(invoices, anno - 1);
        const { periodicita } = determinaPeriodicitaIva(volumeAnnoPrec);
        // LACUNA COLMATA (2026-08-06): prima si dichiarava onestamente "IVA
        // sugli acquisti non tracciata" senza dare modo di tracciarla — ora
        // un acquisto dichiarato (registro-acquisti-iva.js pattern, stesso
        // schema di taxPayments) riduce davvero il dovuto, periodo per periodo.
        const acquistiIva = VaultDAO.state.acquistiIva || [];
        const prossime = upcomingIvaLiquidazioni(invoices, anno, periodicita, { now: new Date(), acquisti: acquistiIva });
        if (prossime[0]) {
          const p = prossime[0];
          html += `<div class="text-[11px] text-[var(--on-surface-secondary)] mt-1.5 leading-snug">Prossima liquidazione IVA (${periodicita}) il ${escapeHtml(p.scadenza)}: ${escapeHtml(formatMoney(p.totaleDaVersare))} — metti via ~${escapeHtml(formatMoney(p.daMettereViaASettimana))} a settimana. ${escapeHtml(p.ivaCreditoNota)}</div>`;
        }
        html += `<button onclick="window.openRegistraAcquistoIva()" class="mt-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-[var(--glass-border)] text-[var(--on-surface-secondary)] hover:border-[var(--gold)] hover:text-[var(--gold)]">Registra un acquisto (IVA detraibile)${acquistiIva.filter(a => new Date(a.data).getFullYear() === anno).length ? ` · ${acquistiIva.filter(a => new Date(a.data).getFullYear() === anno).length} quest'anno` : ''}</button>`;
        const previsione = previsioneSuperamentoSogliaTrimestrale(invoices, anno, { now: new Date() });
        if (previsione.messaggio) {
          html += `<div class="text-[11px] text-amber-300 mt-1.5 leading-snug">${escapeHtml(previsione.messaggio)}</div>`;
        }
      }
      const esp = unpaidExposure(matched, { now: Date.now() });
      if (esp.numero > 0) {
        const col = esp.inRitardo > 0 ? 'text-amber-300' : 'text-[var(--on-surface-secondary)]';
        html += `<div class="text-[11px] ${col} mt-1.5 leading-snug">${escapeHtml(esp.messaggio)}</div>`;
      }
    }

    // 3: la prossima scadenza + quanto mettere via a settimana. Il "già
    // versato" viene dai versamenti che l'utente ha dichiarato
    // (tax-payments.js): mai dare per scontato che non abbia pagato nulla.
    const versamenti = VaultDAO.state.taxPayments || [];
    const riserva = taxReserveStatus(proj.estimatedAnnualTax, versamenti);
    const deadlines = upcomingTaxDeadlines(proj.estimatedAnnualTax, { giaVersato: riserva.versato });

    // SCADENZE SALTATE (colma un vuoto reale): prima una scadenza non
    // versata spariva semplicemente dalla lista al giorno dopo, come se non
    // fosse mai esistita. Ora si vede, col ravvedimento operoso già calcolato
    // — il momento più delicato per chi non ha un commercialista.
    const overdue = overdueTaxDeadlines(proj.estimatedAnnualTax, { giaVersato: riserva.versato });
    if (overdue.length) {
      const o = overdue[0];
      const rav = calcolaRavvedimento(o.importo, o.giorniDiRitardo);
      html += `<div class="rounded-xl border border-orange-400/40 bg-orange-500/10 px-3 py-2.5 mt-1.5">
        <div class="text-[11px] font-bold text-orange-300 leading-snug">Scadenza del ${escapeHtml(o.date)} non ancora versata (${o.giorniDiRitardo} giorni di ritardo).</div>
        <div class="text-[11px] text-orange-200/90 mt-1 leading-snug">Con il ravvedimento operoso oggi pagheresti ${escapeHtml(formatMoney(rav.totale))}: ${escapeHtml(formatMoney(o.importo))} dovuto + ${escapeHtml(formatMoney(rav.sanzioneRidotta))} di sanzione ridotta (${escapeHtml(rav.fascia)}) + ${escapeHtml(formatMoney(rav.interessi))} di interessi. Più aspetti, più sale.</div>
        <div class="text-[10px] text-orange-200/70 mt-1.5 leading-snug">${escapeHtml(rav.nota)}</div>
        <button onclick="window.openRegistraVersamento(${o.importo}, 'Scadenza del ${escapeHtml(o.date)}')" class="text-[11px] font-bold text-orange-200 underline mt-2">L'ho già versata</button>
      </div>`;
      urgent = true;
      maybeNotifyTaxUrgency(
        `overdue:${o.id}`,
        'Una scadenza fiscale ti aspetta',
        `Il ${o.date} non risulta versato. Con il ravvedimento oggi costerebbe ${formatMoney(rav.totale)} — ho già fatto i conti, dai un'occhiata quando puoi.`,
      );
    }

    // BUG REALE TROVATO (2026-08-06): taxCashWarning veniva chiamata con
    // `forecast: null` — l'UNICA funzione di questa card pensata apposta per
    // dire "la cassa scende sotto zero PRIMA della scadenza fiscale" (il
    // pezzo che nessun portale di fatturazione può fare, perché loro non
    // vedono il conto) non veniva MAI collegata alla previsione di cassa
    // vera: quel ramo era codice morto in produzione. Qui si costruisce lo
    // stesso forecast probabilistico (p10/p50/p90) già usato dalla
    // Dashboard, con orizzonte esteso fino alla scadenza stessa.
    let forecastPerAvviso = null;
    if (deadlines[0]) {
      try {
        let cumulativeReserve = 0;
        Object.values(VaultDAO.state.transactions || {}).forEach((txs) => {
          (txs || []).forEach((t) => {
            if (t.type === 'entrata') cumulativeReserve += t.amount;
            else if (t.type === 'uscita') cumulativeReserve -= t.amount;
            else cumulativeReserve -= t.amount; // invest: esce dal liquido disponibile
          });
        });
        const salary = resolveSalary(VaultDAO.state, VaultDAO.state.transactions);
        const orizzonte = Math.min(400, Math.max(14, deadlines[0].giorniMancanti + 5));
        forecastPerAvviso = cashForecast({
          allTx: VaultDAO.state.transactions,
          commitments: VaultDAO.state.fixedCommitments || [],
          salary,
          startBalance: cumulativeReserve,
          now: Date.now(),
          horizonDays: orizzonte,
        });
      } catch (e) {
        console.warn('Previsione di cassa per l\'avviso fiscale non disponibile:', e);
      }
    }
    const avviso = taxCashWarning(deadlines, forecastPerAvviso);
    if (avviso) {
      const col = avviso.urgenza === 'alta' ? 'text-orange-300' : avviso.urgenza === 'ok' ? 'text-emerald-300' : 'text-[var(--on-surface-secondary)]';
      html += `<div class="text-[11px] ${col} mt-1.5 leading-snug">${escapeHtml(avviso.messaggio)}</div>`;
      // Regole vecchie (utente che non aggiorna da anni): lo dice qui, dove
      // sta guardando i soldi, invece di nasconderlo in un pannello tecnico.
      const scad = deadlines[0];
      if (scad && scad.regoleAggiornate === false) {
        html += `<div class="text-[10px] text-amber-300/80 mt-1 leading-snug">${escapeHtml(scad.avvisoRegole)}</div>`;
      }
      if (avviso.urgenza === 'alta') {
        urgent = true;
        maybeNotifyTaxUrgency(
          `cashrisk:${scad.id}`,
          'Un attimo — la cassa ti serve',
          `Nei prossimi giorni potresti restare senza prima del ${scad.date}, quando servono ${formatMoney(scad.importo)}. Ho già calcolato quanto mettere via a settimana per arrivarci sereno.`,
        );
      }
    }
    // ── LE ALIQUOTE SONO CAMBIATE: dirlo, e dire COSA ──
    // Un numero che cambia da solo senza spiegazione è peggio di un numero
    // vecchio: la persona ha visto "metti da parte 4.320 €" a giugno, legge
    // 3.900 € a settembre, e l'unica conclusione ragionevole è che l'app
    // sbagli. Da lì in poi non si fida più di nessun numero.
    const cambioRegole = VaultDAO.state.ultimoCambioRegole;
    if (cambioRegole && !cambioRegole.visto) {
      // Classi LETTERALI, mai costruite a stringa — stessa regola già
      // applicata in runMeshNetDiagnosis, e qui l'avevo violata: con una
      // compilazione statica di Tailwind `border-${x}-400/40` non esisterebbe
      // nel CSS e il riquadro uscirebbe senza stile. Oggi il CDN JIT le
      // genererebbe comunque, ma la scelta non deve dipendere da come il CSS
      // è caricato oggi.
      // Neurocolori: verde solo se il cambiamento ti è FAVOREVOLE, ambra se ti
      // costa, blu se è misto. Mai rosso: una legge che cambia non è una tua
      // colpa e non è un'emergenza.
      // L'icona dice il tono PRIMA che si legga una parola — è la lettura più
      // veloce possibile, e per chi apre l'app di corsa è spesso l'unica.
      // Freccia giù = ti costa meno, freccia su = ti costa di più,
      // calendario = riguarda il futuro, non i tuoi numeri di adesso.
      const S = cambioRegole.tono === 'favorevole'
        ? { box: 'border-emerald-400/40 bg-emerald-500/10 border-l-emerald-400', t: 'text-emerald-300', b: 'text-emerald-200/90', n: 'text-emerald-200/70', a: 'text-emerald-100 bg-emerald-400/15 hover:bg-emerald-400/25', ic: 'text-emerald-300', col: 'var(--green, #10b981)',
            path: cambioRegole.soloFuturo ? '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>' : '<path d="M12 5v14M19 12l-7 7-7-7"/>' }
        : cambioRegole.tono === 'sfavorevole'
        ? { box: 'border-amber-400/40 bg-amber-500/10 border-l-amber-400', t: 'text-amber-300', b: 'text-amber-200/90', n: 'text-amber-200/70', a: 'text-amber-100 bg-amber-400/15 hover:bg-amber-400/25', ic: 'text-amber-300', col: 'var(--gold, #f59e0b)',
            path: cambioRegole.soloFuturo ? '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>' : '<path d="M12 19V5M5 12l7-7 7 7"/>' }
        : { box: 'border-sky-400/40 bg-sky-500/10 border-l-sky-400', t: 'text-sky-300', b: 'text-sky-200/90', n: 'text-sky-200/70', a: 'text-sky-100 bg-sky-400/15 hover:bg-sky-400/25', ic: 'text-sky-300', col: '#38bdf8',
            path: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>' };
      html += `<div class="rules-alert rounded-xl border ${S.box} px-3.5 py-3 mt-1.5" style="--tl1-icon-color:${S.col}">
        <div class="flex items-start gap-2.5">
          <span class="ra-icon shrink-0 mt-0.5 ${S.ic}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">${S.path}</svg>
          </span>
          <div class="min-w-0 flex-1">
            <div class="text-[13px] font-black ${S.t} leading-snug tracking-tight">${escapeHtml(cambioRegole.titolo)}</div>
            <ul class="text-[12px] ${S.b} mt-2 leading-relaxed space-y-1.5">
              ${(cambioRegole.cambi || []).map((c) => `<li class="flex gap-2"><span class="shrink-0"></span><span>${escapeHtml(c.testo)}</span></li>`).join('')}
            </ul>
            <div class="ra-note text-[10px] ${S.n} mt-2 leading-snug">${escapeHtml(cambioRegole.nota)}</div>
            <button onclick="window.confermaCambioRegoleVisto()" class="ra-cta text-[11px] font-bold ${S.a} rounded-lg px-3 py-1.5 mt-2.5">Ho capito</button>
          </div>
        </div>
      </div>`;
    }
    // AVVISO REGOLE VECCHIE — reso INDIPENDENTE (difetto corretto il
    // 2026-08-07): stava dentro `if (avviso)`, quindi se `taxCashWarning` non
    // produceva un messaggio l'avviso "sto usando le aliquote del 2026 per un
    // calcolo del 2029" non compariva MAI. Proprio il caso in cui serve di
    // più: nessun problema di cassa, e numeri silenziosamente vecchi.
    const scadPerFreschezza = deadlines[0];
    if (scadPerFreschezza && scadPerFreschezza.regoleAggiornate === false && !(avviso && avviso.scadenza)) {
      html += `<div class="text-[10px] text-amber-300/80 mt-1.5 leading-snug">${escapeHtml(scadPerFreschezza.avvisoRegole)}</div>`;
    }
    // F24 PRECOMPILATO (T11 — colma la lacuna registro acquisti/INPS/F24):
    // le stesse scadenze già mostrate qui, scomposte nelle righe pronte da
    // copiare nell'home banking — mai un secondo calcolo, solo i codici
    // tributo veri applicati ai numeri già mostrati sopra.
    if (deadlines.length) {
      __f24State = { deadlines, regime: regime || 'forfettario', annualizedRevenue: proj.annualizedRevenue, invoices, anno };
      html += `<button onclick="window.openF24Precompilato()" class="mt-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-[var(--glass-border)] text-[var(--on-surface-secondary)] hover:border-[var(--gold)] hover:text-[var(--gold)]">Prepara l'F24</button>`;
    }
    // Quello che hai già versato, sempre correggibile. Compare solo quando c'è
    // qualcosa da dire: se non hai mai dichiarato un versamento e non c'è
    // niente in scadenza, questa riga sarebbe solo rumore.
    if (riserva.versato > 0) {
      html += `<div class="text-[11px] text-[var(--on-surface-secondary)] mt-1.5 leading-snug">Di questi, <span class="font-mono font-bold text-[var(--positive)]">${formatMoney(riserva.versato)}</span> risultano già versati da te. <button onclick="window.openVersamentiFiscali()" class="underline">Correggi</button></div>`;
    } else if (deadlines.length || overdue.length) {
      html += `<div class="text-[11px] text-[var(--on-surface-secondary)] mt-1.5 leading-snug"><button onclick="window.openVersamentiFiscali()" class="underline">Ne hai già versata una?</button> Dimmelo e smetto di contarla.</div>`;
    }
    // Opt-in alle notifiche: MAI un banner persistente. Comparire ad ogni
    // apertura anche senza un motivo vero è esattamente il pattern che
    // genera assuefazione al banner e abbandono — l'errore trovato e
    // corretto qui. Ora l'invito appare SOLO quando `urgent` è vero (c'è
    // già un motivo reale sotto gli occhi) e mai più di una volta ogni 14
    // giorni se l'utente lo ignora, invece di ripetersi ad ogni render.
    if (VaultDAO.state.taxNotifyOptIn) {
      html += `<div class="flex items-center justify-between gap-2 mt-1.5"><span class="text-[10px] text-emerald-300/90">Ti avviso solo se c'è un motivo vero — anche ad app chiusa di recente.</span><button onclick="window.disableTaxNotifications()" class="text-[10px] text-[var(--on-surface-secondary)] underline shrink-0">disattiva</button></div>`;
    } else if (urgent) {
      const oggi = new Date().toISOString().slice(0, 10);
      const ultimoRifiuto = VaultDAO.state.taxNotifyDismissedAt;
      const giorniDaRifiuto = ultimoRifiuto ? Math.round((new Date(oggi) - new Date(ultimoRifiuto)) / 86400000) : Infinity;
      if (giorniDaRifiuto >= 14) {
        html += `<div class="flex items-center gap-2 mt-1.5">
          <button onclick="window.enableTaxNotifications()" class="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-[var(--glass-border)] text-[var(--on-surface-secondary)] hover:border-[var(--gold)] hover:text-[var(--gold)]">Avvisami anche se chiudo l'app</button>
          <button onclick="window.dismissTaxNotifyPrompt()" class="text-[10px] text-[var(--on-surface-secondary)] underline shrink-0">non ora</button>
        </div>`;
      }
    }
  } catch (e) {
    // Onesto: se un blocco non si può calcolare, il resto della card resta
    // valido — mai far cadere tutta la schermata per un blocco in più.
    console.warn('Blocchi fiscali avanzati non disponibili:', e);
  }
  __taxCardUrgent = urgent;
  // LIVELLO 2 — Ponte commercialista: un pacchetto che il professionista apre
  // senza account, con fatture/incassi/scadenze già pronti (T11, il pezzo che
  // trasforma il commercialista da ostacolo a canale di distribuzione).
  if ((VaultDAO.state.invoices || []).length) {
    html += `<button onclick="window.exportAccountantReport()" class="mt-2 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-[var(--glass-border)] text-[var(--on-surface-secondary)] hover:border-[var(--gold)] hover:text-[var(--gold)]">Esporta riepilogo per il commercialista</button>`;
  }
  return html;
}

// Genera il riepilogo per il commercialista (Livello 2, T11): apre in una
// scheda pronta per "Stampa → Salva come PDF", stesso schema già verificato
// per la fattura di cortesia. Nessun account, nessun login — un file che si
// apre e basta.
window.exportAccountantReport = () => {
  const anno = new Date().getFullYear();
  const regime = VaultDAO.state.taxRegime || 'forfettario';
  const report = buildAccountantReport(
    VaultDAO.state.invoices || [], VaultDAO.state.transactions || {}, anno, regime,
    { taxPayments: VaultDAO.state.taxPayments || [], learned: VaultDAO.state.taxLearned, model: window.__incomeModel },
  );
  const emitter = ((VaultDAO.state.invoiceProfile || {}).emitter) || '';
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(renderAccountantReportHTML(report, { emitter }));
    win.document.close();
    win.addEventListener('load', () => setTimeout(() => win.print(), 250));
    showToast('Riepilogo pronto — scegli "Salva come PDF" nella finestra di stampa, o giralo così com\'è al commercialista.', 'success');
  } else {
    showToast('Popup bloccati dal browser: consenti i popup per generare il riepilogo.', 'error');
  }
};

// Registro acquisti IVA (colma la lacuna dichiarata in iva-liquidazione.js):
// un acquisto dichiarato riduce davvero il dovuto del periodo in cui cade,
// mai un'automazione — è l'utente a dire "questo l'ho comprato con IVA
// detraibile", Momentum si limita a sommare e sottrarre col segno giusto.
window.openRegistraAcquistoIva = () => {
  const oggi = new Date().toISOString().slice(0, 10);
  window.openModal(`
    <div class="flex flex-col gap-4 p-4 sm:p-6 lg:p-2 text-center items-center modal-section-in">
      ${tl1Icon('<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/><path d="M9 9h1M14 9h1M9 13h1M14 13h1"/>', '--primary')}
      <div>
        <h3 class="text-lg font-black leading-tight">Registra un acquisto</h3>
        <p class="card-sub !mb-0 mt-1.5">Una spesa con fattura e IVA detraibile (materiali, strumenti, servizi) riduce davvero l'IVA da versare — non solo un promemoria.</p>
      </div>
      <div class="w-full flex flex-col gap-2.5 text-left">
        <input id="acq-desc" type="text" placeholder="Cosa hai comprato (es. Laptop, hosting)" class="w-full bg-black/30 border border-[var(--glass-border)] rounded-xl px-4 py-3 text-sm" />
        <div class="grid grid-cols-2 gap-2.5">
          <input id="acq-imponibile" type="number" inputmode="decimal" placeholder="Imponibile €" class="w-full bg-black/30 border border-[var(--glass-border)] rounded-xl px-4 py-3 text-sm font-mono" />
          <input id="acq-data" type="date" value="${oggi}" max="${oggi}" class="w-full bg-black/30 border border-[var(--glass-border)] rounded-xl px-4 py-3 text-sm" />
        </div>
        <div>
          <span class="text-[10px] font-bold text-[var(--on-surface-secondary)] uppercase tracking-wide">Aliquota IVA sull'acquisto</span>
          <div class="mt-1.5">${tl1Select('acq-aliquota', [
            { value: '0.22', label: '22% (ordinaria)' },
            { value: '0.10', label: '10% (ridotta)' },
            { value: '0.04', label: '4% (super-ridotta)' },
            { value: '0', label: '0% (esente/fuori campo)' },
          ], '0.22')}</div>
        </div>
      </div>
      <button id="acq-save" class="btn-action btn-primary w-full py-3.5 font-bold rounded-xl">Registra acquisto</button>
      <div class="w-full flex items-center gap-2 text-[10px] text-[var(--on-surface-secondary)] uppercase tracking-wide">
        <div class="flex-1 h-px bg-[var(--glass-border)]"></div>oppure<div class="flex-1 h-px bg-[var(--glass-border)]"></div>
      </div>
      <input id="acq-xml-input" type="file" accept=".xml" class="hidden" />
      <button id="acq-xml-btn" type="button" class="w-full py-3 font-bold rounded-xl border border-[var(--glass-border)] text-[var(--on-surface-secondary)] hover:border-[var(--gold)] hover:text-[var(--gold)] text-sm">Importa fattura ricevuta (XML)</button>
      <p class="text-[10px] text-[var(--on-surface-secondary)] leading-snug -mt-1">Il file che scarichi dal cassetto fiscale o ricevi dal fornitore: Momentum legge fornitore, data, imponibile e aliquota, e li registra da solo — resta sul tuo dispositivo, nessun upload.</p>
      ${(VaultDAO.state.acquistiIva || []).length ? `
      <div class="w-full text-left mt-1">
        <div class="text-[10px] font-bold text-[var(--on-surface-secondary)] uppercase tracking-wide mb-1.5">Già registrati</div>
        <div class="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
          ${(VaultDAO.state.acquistiIva || []).slice().reverse().map((a) => {
            const idxReale = (VaultDAO.state.acquistiIva || []).indexOf(a);
            return `<div class="flex items-center justify-between gap-2 text-[11px] text-[var(--on-surface-secondary)] border-b border-[var(--glass-border)] pb-1.5">
              <span class="truncate">${escapeHtml(a.descrizione || 'Acquisto')} · ${escapeHtml(a.data)}</span>
              <span class="shrink-0 flex items-center gap-2"><span class="font-mono">${formatMoney(a.imponibile)}</span>
              <button type="button" onclick="window.removeAcquistoIva(${idxReale})" class="text-[var(--on-surface-secondary)] hover:text-[var(--red)]" aria-label="Rimuovi">✕</button></span>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}
    </div>`);
  document.getElementById('acq-save')?.addEventListener('click', () => {
    const descrizione = (document.getElementById('acq-desc').value || '').trim();
    const imponibile = parseFloat(String(document.getElementById('acq-imponibile').value).replace(',', '.'));
    const data = document.getElementById('acq-data').value || oggi;
    const aliquotaIva = parseFloat(document.getElementById('acq-aliquota').dataset.value || '0.22');
    if (!(imponibile > 0)) { showToast('Inserisci l\'imponibile dell\'acquisto.', 'error'); return; }
    VaultDAO.state.acquistiIva = [...(VaultDAO.state.acquistiIva || []), { descrizione, imponibile, data, aliquotaIva }];
    VaultDAO.save();
    showToast('Acquisto registrato — l\'IVA detraibile è già nel calcolo del periodo.', 'success');
    window.openRegistraAcquistoIva();
    renderAnalysis();
  });
  document.getElementById('acq-xml-btn')?.addEventListener('click', () => {
    document.getElementById('acq-xml-input')?.click();
  });
  document.getElementById('acq-xml-input')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const testo = await file.text();
      const parsed = parseFatturaPaXML(testo);
      if (parsed.errore) { showToast(parsed.errore, 'error'); return; }
      const nuove = fatturaPassivaToAcquisti(parsed);
      if (!nuove.length) { showToast('Nessuna riga con IVA trovata in questa fattura.', 'error'); return; }
      VaultDAO.state.acquistiIva = [...(VaultDAO.state.acquistiIva || []), ...nuove];
      VaultDAO.save();
      showToast(`${nuove.length > 1 ? `${nuove.length} righe importate` : 'Fattura importata'} da ${parsed.fornitore} — registro acquisti aggiornato.`, 'success');
      window.openRegistraAcquistoIva();
      renderAnalysis();
    } catch (err) {
      console.warn('Import fattura passiva fallito:', err);
      showToast('Non sono riuscito a leggere questo file: controlla che sia l\'XML della fattura, non un altro formato.', 'error');
    }
  });
};
// F24 PRECOMPILATO — mai trasmesso da Momentum (nessun accesso bancario:
// stessa regola di tax-payments.js), ma pronto da copiare riga per riga
// nell'home banking o nel modello F24 web dell'Agenzia. Codici tributo veri
// (f24.js), applicati alle scadenze e alla liquidazione IVA già mostrate
// nella card — mai un numero nuovo, solo il codice giusto attaccato a un
// numero che l'utente ha già visto.
// ==========================================
// VERSAMENTI FISCALI DICHIARATI (tax-payments.js)
// ==========================================
// BUG REALE, il più grave del modulo fiscale: `recordTaxPayment` e
// `removeTaxPayment` esistevano, erano testate, e NON le chiamava nessuno.
// `VaultDAO.state.taxPayments` era letto in tre punti e mai scritto, quindi
// `riserva.versato` restava 0 per sempre: ogni scadenza già pagata continuava
// a comparire fra le "non versate", e il box del ravvedimento operoso
// calcolava sanzioni e interessi su soldi che la persona aveva già dato allo
// Stato. Non è una funzione mancante — è un NUMERO SBAGLIATO su soldi dovuti
// allo Stato, mostrato con la stessa autorevolezza di uno giusto.
// Un versamento è l'unica cosa che Momentum non può dedurre da sé: succede
// fuori dall'app, in home banking. Quindi va CHIESTO, non indovinato.
window.confermaCambioRegoleVisto = () => {
  if (VaultDAO.state.ultimoCambioRegole) {
    VaultDAO.state.ultimoCambioRegole = { ...VaultDAO.state.ultimoCambioRegole, visto: true };
    VaultDAO.save();
  }
  renderAnalysis({ skipHeavyForecast: true });
};

window.registraVersamentoFiscale = (importo, nota = '') => {
  const n = +importo;
  if (!Number.isFinite(n) || n <= 0) { showToast('Inserisci un importo valido.', 'error'); return false; }
  VaultDAO.state.taxPayments = recordTaxPayment(VaultDAO.state.taxPayments || [], n, { note: nota });
  VaultDAO.save();
  showToast(`Versamento di ${formatMoney(n)} registrato: non te lo chiederò più.`, 'success');
  closeModal();
  renderAnalysis({ skipHeavyForecast: true });
  renderDashboard();
  return true;
};

window.rimuoviVersamentoFiscale = (id) => {
  VaultDAO.state.taxPayments = removeTaxPayment(VaultDAO.state.taxPayments || [], id);
  VaultDAO.save();
  showToast('Versamento rimosso.', 'info');
  renderAnalysis({ skipHeavyForecast: true });
  renderDashboard();
  window.openVersamentiFiscali();
};

// Chiede l'importo con un valore già proposto (quello della scadenza o del
// totale F24): la persona conferma invece di digitare, ma può correggere —
// un versamento parziale è normale e non va reso impossibile.
window.openRegistraVersamento = (importoProposto = 0, etichetta = '') => {
  const val = Number.isFinite(+importoProposto) && +importoProposto > 0 ? (+importoProposto).toFixed(2) : '';
  openModal(`
    <div class="flex flex-col gap-4 p-4 sm:p-6 lg:p-2 text-center items-center modal-section-in">
      ${tl1Icon('<path d="M20 6 9 17l-5-5"/>', '--positive')}
      <div>
        <h3 class="text-lg font-black leading-tight">L'hai versato?</h3>
        <p class="card-sub !mb-0 mt-1.5">${etichetta ? escapeHtml(etichetta) + '. ' : ''}Segnandolo qui smetto di contarlo fra quelli da mettere da parte, e sparisce dagli avvisi di ritardo.</p>
      </div>
      <input id="vers-importo" type="number" inputmode="decimal" step="0.01" value="${escapeHtml(val)}" placeholder="Quanto hai versato (€)" class="w-full bg-black/30 border border-[var(--glass-border)] rounded-xl p-4 text-2xl font-mono text-center" />
      <input id="vers-nota" type="text" maxlength="60" placeholder="Nota (facoltativa): es. F24 giugno" class="w-full bg-black/30 border border-[var(--glass-border)] rounded-xl p-3 text-sm" />
      <button onclick="window.registraVersamentoFiscale(document.getElementById('vers-importo').value, document.getElementById('vers-nota').value)" class="btn-action btn-primary w-full py-3.5 font-bold rounded-xl">Sì, l'ho versato</button>
      <p class="text-[10px] text-[var(--on-surface-secondary)] leading-snug">Se hai versato solo una parte, scrivi quella: il resto continuo a tenerlo da conto.</p>
    </div>`);
  setTimeout(() => document.getElementById('vers-importo')?.focus(), 60);
};

window.openVersamentiFiscali = () => {
  const versamenti = VaultDAO.state.taxPayments || [];
  openModal(`
    <div class="flex flex-col gap-4 p-4 sm:p-6 lg:p-2 text-center items-center modal-section-in">
      ${tl1Icon('<path d="M3 6h18M3 12h18M3 18h12"/>', '--primary')}
      <div>
        <h3 class="text-lg font-black leading-tight">Versamenti che hai dichiarato</h3>
        <p class="card-sub !mb-0 mt-1.5">Solo quelli che mi hai detto tu: Momentum non vede il tuo conto e non può saperlo da solo.</p>
      </div>
      ${!versamenti.length ? `<p class="text-[12px] text-[var(--on-surface-secondary)]">Nessuno, per ora.</p>` : `
      <div class="w-full flex flex-col gap-2 text-left">
        ${versamenti.slice().reverse().map((p) => `
        <div class="flex items-center justify-between gap-2 rounded-xl border border-[var(--glass-border)] bg-black/20 px-3.5 py-2.5">
          <div class="min-w-0">
            <div class="font-mono font-bold text-sm">${formatMoney(p.amount)}</div>
            <div class="text-[10px] text-[var(--on-surface-secondary)] truncate">${escapeHtml(String(p.date).slice(0, 10))}${p.note ? ' · ' + escapeHtml(p.note) : ''}</div>
          </div>
          <button onclick="window.rimuoviVersamentoFiscale('${escapeHtml(p.id)}')" class="text-[10px] text-[var(--on-surface-secondary)] underline shrink-0">Rimuovi</button>
        </div>`).join('')}
      </div>`}
      <button onclick="window.openRegistraVersamento(0)" class="btn-action w-full py-3 text-xs rounded-xl">Aggiungi un versamento</button>
    </div>`);
};

window.openF24Precompilato = () => {
  const s = __f24State;
  if (!s) { showToast('Nessuna scadenza fiscale da preparare al momento.', 'info'); return; }
  const rigImposte = righeF24Imposte(s.deadlines, { regime: s.regime, annualizedRevenue: s.annualizedRevenue, opts: {
    cassaPropria: VaultDAO.state.taxCassaPropria || null,
    altraCoperturaPrevidenziale: !!VaultDAO.state.taxAltraCopertura,
  } });
  let rigIva = [];
  if (s.regime === 'ordinario') {
    const volumeAnnoPrec = accrualRevenue(s.invoices, s.anno - 1);
    const { periodicita } = determinaPeriodicitaIva(volumeAnnoPrec);
    const acquistiIva = VaultDAO.state.acquistiIva || [];
    const periodiIva = upcomingIvaLiquidazioni(s.invoices, s.anno, periodicita, { now: new Date(), acquisti: acquistiIva });
    rigIva = righeF24Iva(periodiIva, { anno: s.anno, periodicita });
  }
  const righe = [...rigImposte, ...rigIva].sort((a, b) => new Date(a.scadenza) - new Date(b.scadenza));
  const { totale, pronto } = f24Riepilogo(righe);

  const testoCopiabile = righe.map((r) =>
    `${r.sezione} · codice ${r.codiceTributo} · anno ${r.annoRiferimento} · ${formatMoney(r.importo)} · scadenza ${r.scadenza} — ${r.etichetta}`
  ).join('\n');

  window.openModal(`
    <div class="flex flex-col gap-4 p-4 sm:p-6 lg:p-2 text-center items-center modal-section-in">
      ${tl1Icon('<path d="M9 12h6M9 16h6M9 8h1M13 8h3M5 21V5a2 2 0 0 1 2-2h7l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/>', '--primary')}
      <div>
        <h3 class="text-lg font-black leading-tight">F24 pronto da copiare</h3>
        <p class="card-sub !mb-0 mt-1.5">Codici tributo veri, righe pronte per l'home banking o il modello F24 web dell'Agenzia. Momentum non trasmette nulla: lo versi tu, in un attimo invece di doverlo capire da zero.</p>
      </div>
      ${!pronto ? `<div class="text-[12px] text-[var(--on-surface-secondary)]">Niente da preparare al momento: nessuna scadenza con un importo da versare.</div>` : `
      <div class="w-full flex flex-col gap-2 text-left">
        ${righe.map((r) => `
        <div class="rounded-xl border border-[var(--glass-border)] bg-black/20 px-3.5 py-3">
          <div class="flex items-center justify-between gap-2">
            <span class="text-[10px] font-bold uppercase tracking-wide text-[var(--on-surface-secondary)]">${escapeHtml(r.sezione)} · codice <span class="text-[var(--gold)]">${escapeHtml(r.codiceTributo)}</span></span>
            <span class="font-mono font-bold text-sm">${formatMoney(r.importo)}</span>
          </div>
          <div class="text-[11px] text-[var(--on-surface-secondary)] mt-1">${escapeHtml(r.etichetta)} · anno ${escapeHtml(r.annoRiferimento)} · scadenza ${escapeHtml(r.scadenza)}</div>
          ${r.nota ? `<div class="text-[10px] text-amber-300/80 mt-1.5 leading-snug">${escapeHtml(r.nota)}</div>` : ''}
        </div>`).join('')}
        <div class="flex items-center justify-between px-1 pt-1">
          <span class="text-[11px] font-bold uppercase tracking-wide text-[var(--on-surface-secondary)]">Totale</span>
          <span class="font-mono font-black">${formatMoney(totale)}</span>
        </div>
      </div>
      <button id="f24-copy" class="btn-action btn-primary w-full py-3.5 font-bold rounded-xl">Copia tutte le righe</button>
      <button onclick="window.openRegistraVersamento(${totale}, 'F24 da ${formatMoney(totale)}')" class="btn-action w-full py-3 text-xs rounded-xl">L'ho versato</button>
      <p class="text-[10px] text-[var(--on-surface-secondary)] leading-snug">Sono STIME sui dati che hai in Momentum, non una dichiarazione: verificale col commercialista prima di versare, soprattutto se hai anche altre entrate o crediti d'imposta fuori dall'app.</p>
      `}
    </div>`);
  document.getElementById('f24-copy')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(testoCopiabile);
      showToast('Righe F24 copiate — incollale dove preferisci per tenerle a portata di mano.', 'success');
    } catch {
      showToast('Copia non riuscita: seleziona il testo manualmente.', 'error');
    }
  });
};

window.removeAcquistoIva = (idx) => {
  VaultDAO.state.acquistiIva = (VaultDAO.state.acquistiIva || []).filter((_, i) => i !== idx);
  VaultDAO.save();
  showToast('Acquisto rimosso.', 'info');
  window.openRegistraAcquistoIva();
  renderAnalysis();
};

// Card Partita IVA (src/predict/tax.js): mostrata solo se l'utente ha
// abilitato il regime P.IVA (VaultDAO.state.taxRegime) o ha entrate rilevanti.
function renderTax(monthK) {
  const card = $('#tax-card'), setEl = $('#tax-setaside'), noteEl = $('#tax-note'), extraEl = $('#tax-extra');
  if (!card) return;
  if (extraEl) extraEl.innerHTML = '';
  // Reset ad ogni render: il segnale di attenzione si riaccende SOLO se
  // renderTaxCashBlocks trova di nuovo un motivo vero — mai uno stantio.
  card.classList.remove('tax-alert');
  const regime = VaultDAO.state.taxRegime;
  const learned = VaultDAO.state.taxLearned || {};
  const monthTxs = VaultDAO.state.transactions[monthK] || [];
  const allFlat = Object.values(VaultDAO.state.transactions || {}).flat();
  // Il modulo P.IVA ha senso solo per chi FATTURA. Se non c'è regime E non
  // c'è mai stata una fattura, resta nascosto (niente modulo per chi non serve).
  const everInvoice = hasInvoiceIncome();
  const incomeModel = (typeof window !== 'undefined' && window.__incomeModel) || null;
  // LIVELLO 0 — "non ho ancora la Partita IVA": prima la card spariva del
  // tutto, lasciando fuori esattamente chi sta VALUTANDO se aprirla (nessun
  // portale copre questo momento). Ora mostra un invito leggero alla
  // simulazione invece di sparire nel nulla.
  if (!regime && !everInvoice) {
    // Chi ha già detto "sono dipendente, non mi serve" non deve continuare a
    // vedere l'invito ogni mese — ricordarlo è rispetto, non insistenza.
    if (VaultDAO.state.noPartitaIva) { card.classList.add('hidden'); return; }
    card.classList.remove('hidden');
    setEl.textContent = '';
    noteEl.textContent = 'Stai valutando se aprire la Partita IVA? Scopri in un attimo cosa ti resterebbe davvero in tasca.';
    if (extraEl) extraEl.innerHTML = `
      <button onclick="window.openTaxLevel1()" class="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-[var(--gold)] text-[var(--gold)]">Simula la tua Partita IVA</button>
      <button onclick="window.setNoPartitaIva(true)" class="text-[11px] text-[var(--on-surface-secondary)] underline ml-2">Sono dipendente, non mi serve</button>
      <button onclick="window.openSwissSimulator()" class="text-[11px] text-[var(--on-surface-secondary)] underline ml-2">🇨🇭 Lavori in Svizzera?</button>`;
    return;
  }
  card.classList.remove('hidden');

  // ── INTELLIGENZA REGIME: senza regime NON si inventa un numero (IRPEF/INPS/
  // coefficiente dipendono dal regime). Se ci sono fatture ma manca il regime,
  // si CHIEDE con un tocco — poi il calcolo diventa reale.
  if (everInvoice && !regime) {
    setEl.textContent = '?';
    noteEl.textContent = 'Vedo delle fatture ma non so il tuo regime fiscale: senza, il calcolo sarebbe a caso. Dimmelo con un tocco e calcolo tasse + contributi giusti.';
    if (extraEl) {
      extraEl.innerHTML = `<div class="flex flex-wrap gap-2">${Object.entries(REGIMI).map(([k, v]) =>
        `<button onclick="window.setTaxRegime('${k}')" class="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--surface-elevated)_40%,transparent)] hover:border-[var(--red)]">${v.label.split('(')[0].trim()}</button>`).join('')}</div>`;
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
        html += `<div class="flex items-start gap-1.5 text-[11px] text-[var(--on-surface-secondary)] border-t border-[var(--glass-border)] pt-2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 shrink-0 mt-0.5"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 3v3M16 3v3"/></svg><span>${proj.note}</span></div>`;
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
        html += renderTaxCashBlocks(proj, regime);
      }
    }
    // ── CONFERMA APPRESA: le entrate incerte diventano un tap "è una fattura?" ──
    if (r.uncertainCount > 0) {
      const rows = r.uncertain.slice(0, 4).map(t =>
        `<div class="flex items-center justify-between gap-2 py-1">
          <span class="min-w-0 truncate">${t.description || 'entrata'} · <b>${formatMoney(t.amount)}</b></span>
          <span class="shrink-0 flex gap-2">
            <button onclick='window.learnIncome(${JSON.stringify(t.description || "")}, "invoice")' class="text-[11px] font-bold text-emerald-400 underline">è fattura</button>
            <button onclick='window.learnIncome(${JSON.stringify(t.description || "")}, "personal")' class="text-[11px] font-bold text-[var(--on-surface-secondary)] underline">no</button>
          </span>
        </div>`).join('');
      html += `<div class="mt-2 border-t border-[var(--glass-border)] pt-2"><div class="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1">${r.uncertainCount} entrat${r.uncertainCount > 1 ? 'e' : 'a'} da confermare</div><div class="text-xs text-[var(--on-surface-secondary)]">${rows}</div></div>`;
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
      html += `<div class="mt-3 border border-[color-mix(in_srgb,var(--gold)_25%,transparent)] bg-[color-mix(in_srgb,var(--gold)_5%,transparent)] rounded-xl px-3 py-2.5">
        <div class="flex items-center gap-2 mb-1"><span class="text-[10px] font-bold text-[var(--gold)] uppercase tracking-wider">${pend.count} fattur${pend.count > 1 ? 'e' : 'a'} da caricare sullo SdI</span></div>
        <div class="text-xs text-[var(--on-surface-secondary)]">${rows}</div>
        <a href="${SDI_PORTAL_URL}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 mt-2 text-[11px] font-bold px-3 py-1.5 rounded-full bg-[color-mix(in_srgb,var(--gold)_15%,transparent)] border border-[color-mix(in_srgb,var(--gold)_30%,transparent)] text-[var(--gold)]">Apri il portale Fatture e Corrispettivi<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg></a>
      </div>`;
    }
    // ── CREA FATTURA: azione contestuale, appare solo qui (per chi fattura) ──
    html += `<button onclick="window.openCreateInvoice()" class="btn-action btn-primary w-full py-2.5 font-bold rounded-xl mt-3 text-sm inline-flex items-center justify-center gap-2"><svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>Crea fattura</button>`;
    extraEl.innerHTML = html;
    // Segnale discreto SOLO se c'è un motivo vero (scadenza saltata o cassa a
    // rischio) — niente popup, niente nuova schermata: un piccolo bagliore
    // sull'icona della card che già esiste, coerente col resto della UI.
    card.classList.toggle('tax-alert', !!__taxCardUrgent);
  }
}
// Rilevamento condiviso "questo utente fattura?" — riusato dalla card Analisi e
// dalla card Impostazioni (una sola definizione = un solo comportamento).
function hasInvoiceIncome() {
  const learned = VaultDAO.state.taxLearned || {};
  const incomeModel = (typeof window !== 'undefined' && window.__incomeModel) || null;
  const allFlat = Object.values(VaultDAO.state.transactions || {}).flat();
  return allFlat.some(t => t.type === 'entrata' && classifyIncome(t, learned, incomeModel).kind === 'invoice');
}

// CASA PERMANENTE della Partita IVA in Impostazioni. Prima l'unico accesso a
// "crea fattura"/regime viveva dentro la card Analisi, nascosta finché non c'era
// già una fattura o un regime → per un freelance nuovo la sezione "spariva"
// (vicolo cieco uovo-e-gallina). Qui c'è sempre, e il contenuto è PREDITTIVO:
//  · regime attivo   → mostra il regime + azioni (crea fattura / cambia).
//  · fatture viste ma nessun regime → nudge onesto: "vedo fatture, dimmi il
//    regime e calcolo tasse+contributi giusti" (mai un numero inventato).
//  · niente di tutto ciò → invito discreto per chi HA la Partita IVA ad
//    attivarla, senza imporla a chi non fattura.
function renderTaxSettings() {
  const body = $('#tax-settings-body');
  if (!body) return;
  const regime = VaultDAO.state.taxRegime;
  const everInvoice = hasInvoiceIncome();
  const regimeButtons = (accent) => `<div class="flex flex-wrap gap-2">${Object.entries(REGIMI).map(([k, v]) =>
    `<button onclick="window.setTaxRegime('${k}')" class="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--surface-elevated)_40%,transparent)] hover:border-[${accent}]">${v.label.split('(')[0].trim()}</button>`).join('')}</div>`;

  if (regime) {
    const label = (REGIMI[regime] && REGIMI[regime].label.split('(')[0].trim()) || regime;
    // PREDITTIVO E GLANCEABLE (comprensibile a colpo d'occhio, anche da un
    // bambino): a questo ritmo quanto fatturi quest'anno e quanto mettere da
    // parte. Solo se ci sono già fatture; onesto: è una proiezione sul ritmo.
    let predLine = '';
    try {
      const learned = VaultDAO.state.taxLearned || {};
      const model = (typeof window !== 'undefined' && window.__incomeModel) || null;
      const allFlat = Object.values(VaultDAO.state.transactions || {}).flat();
      const proj = projectAnnualTax(allFlat, { regime, referenceDate: new Date(), learned, model });
      if (proj && proj.invoicedYTD > 0) {
        const eur = (n) => `${Math.round(n).toLocaleString('it-IT')}€`;
        predLine = `<div class="grid grid-cols-2 gap-2 mb-3">
          <div class="rounded-xl border border-[var(--glass-border)] bg-black/20 px-3 py-2">
            <p class="text-[10px] uppercase tracking-wider text-[var(--on-surface-secondary)]">A questo ritmo, quest'anno</p>
            <p class="text-base font-black font-mono text-white">~${eur(proj.annualizedRevenue)}</p>
          </div>
          <div class="rounded-xl border border-[color-mix(in_srgb,var(--red)_25%,transparent)] bg-[color-mix(in_srgb,var(--red)_5%,transparent)] px-3 py-2">
            <p class="text-[10px] uppercase tracking-wider text-[var(--on-surface-secondary)]">Da mettere da parte</p>
            <p class="text-base font-black font-mono text-[var(--red)]">~${eur(proj.estimatedAnnualTax)}</p>
          </div>
        </div>`;
      }
    } catch (_) { /* niente proiezione: si mostra comunque il resto */ }
    body.innerHTML = `
      <div class="flex items-center gap-2 text-xs text-emerald-300 mb-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 shrink-0"><path d="M20 6 9 17l-5-5"/></svg>
        <span>Regime attivo: <b>${label}</b>. Il dettaglio mese per mese è nella scheda Analisi.</span>
      </div>
      ${predLine}
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
        <button onclick="window.openCreateInvoice()" class="btn-action btn-primary justify-center font-bold"><svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>Crea fattura</button>
        <button onclick="window.openTaxRegimePicker()" class="btn-action justify-between"><span>Cambia regime fiscale</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path d="M9 18l6-6-6-6"/></svg></button>
      </div>`;
    return;
  }

  if (everInvoice) {
    // PREDITTIVO: il modello entrate ha già visto entrate che sembrano fatture.
    body.innerHTML = `
      <div class="flex items-start gap-2 text-xs text-amber-200 bg-amber-950/10 border border-amber-500/20 rounded-xl px-3 py-2.5 mb-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 shrink-0 mt-0.5"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>
        <span>Ho visto entrate che sembrano <b>fatture</b>, ma non conosco il tuo regime: senza, il calcolo delle tasse sarebbe a caso. Dimmelo e lo calcolo giusto.</span>
      </div>
      ${regimeButtons('var(--amber)')}
      <button onclick="window.openTaxLevel1Simulate()" class="mt-3 text-[11px] text-[var(--on-surface-secondary)] underline">Non ce l'ho ancora — voglio solo sapere cosa mi resterebbe</button>`;
    return;
  }

  // Chi ha già detto "sono dipendente" vede una riga compatta e reversibile,
  // non l'intero invito ripetuto ogni volta che apre il Vault.
  if (VaultDAO.state.noPartitaIva) {
    body.innerHTML = `
      <div class="flex items-center justify-between gap-2 text-xs text-[var(--on-surface-secondary)]">
        <span>Hai detto di essere dipendente: non ti chiedo più della Partita IVA.</span>
        <button onclick="window.setNoPartitaIva(false)" class="text-[11px] font-bold text-[var(--primary)] underline shrink-0">Ho cambiato idea</button>
      </div>`;
    return;
  }

  // Nessun regime, nessuna fattura: invito discreto (non imporre a chi non
  // fattura), ma senza dare per scontato che ce l'abbia già — porta al punto
  // d'ingresso che chiede PRIMA "ce l'hai già o la stai valutando?" (BUG
  // reale trovato testando: prima si saltava dritti al selettore regime,
  // ignorando in Momentum Vault proprio lo scenario "se aprissi la P.IVA"
  // che il simulatore Livello 1 esiste apposta per coprire).
  body.innerHTML = `
    <p class="text-xs text-[var(--on-surface-secondary)] mb-3">Hai la Partita IVA, o la stai valutando? In entrambi i casi Momentum ti aiuta: calcola tasse e contributi da mettere da parte, o ti dice subito cosa ti resterebbe se la aprissi.</p>
    <button onclick="window.openTaxLevel1()" class="btn-action btn-primary justify-between w-full"><span>Partita IVA</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path d="M9 18l6-6-6-6"/></svg></button>
    <button onclick="window.setNoPartitaIva(true)" class="mt-2 text-[11px] text-[var(--on-surface-secondary)] underline">Sono dipendente, non mi serve</button>`;
}

// ══════════════════════════════════════════════════════════════════════════
// LIVELLO 0/1 P.IVA — UNA DOMANDA ALLA VOLTA, linguaggio semplice
// ══════════════════════════════════════════════════════════════════════════
// Punto d'ingresso unico per due pubblici diversi, distinti dalla PRIMA
// domanda invece che indovinati: chi la P.IVA ce l'ha già (→ il selettore
// regime esistente, zero duplicazione) e chi la sta ancora valutando (→ il
// simulatore, il buco di mercato che nessun portale copre). Mai un modulo
// unico con dieci campi: un passo, una domanda, un bottone grande.
// Cerchio-icona in testa a ogni passo (stesso linguaggio dello scudo del
// flusso di backup: un'immagine rassicurante prima di qualunque domanda,
// mai un modulo che parte a freddo con un campo vuoto).
function tl1Icon(pathD, colorVar = '--primary') {
  return `<div class="tl1-icon-pulse w-14 h-14 rounded-2xl flex items-center justify-center mx-auto bg-[color-mix(in_srgb,var(${colorVar})_16%,transparent)]" style="--tl1-icon-color:var(${colorVar})">
    <svg class="w-7 h-7 text-[var(${colorVar})]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${pathD}</svg>
  </div>`;
}
// Pallini di avanzamento (stesso pattern di rkDots): il secondo si accende
// solo quando si arriva al risultato, mai una percentuale astratta.
function tl1Dots(fatti, tot = 2) {
  return `<div class="flex items-center justify-center gap-1.5" aria-hidden="true">${Array.from({ length: tot }, (_, i) => i + 1)
    .map((n) => `<span class="rounded-full transition-all duration-300 ${n <= fatti ? 'w-6 h-1.5 bg-[var(--gold)]' : 'w-1.5 h-1.5 bg-[var(--outline)]'}"></span>`).join('')}</div>`;
}
// Menu a tendina disegnato da noi (ATECO, cassa previdenziale nel Livello 1):
// un <select> nativo apre il popup del sistema operativo, che nessun CSS
// riesce a ridisegnare davvero (font, colori, animazioni: tutto deciso dal
// browser/OS). Qui il pannello è HTML nostro, con lo stesso linguaggio
// visivo (icon-circle, oro/viola, pop e ingresso a scaglione) del resto
// dell'app. Un solo listener delegato su document gestisce tutte le istanze
// contemporaneamente in vita: niente listener duplicati o persi a ogni
// apertura di modale.
function tl1Select(id, options, selected) {
  const sel = options.find((o) => o.value === selected) || options[0];
  return `<div id="${id}" class="tl1-select relative" data-value="${sel?.value ?? ''}">
    <button type="button" class="tl1-select-trigger w-full flex items-center justify-between gap-2 bg-black/30 border border-[var(--glass-border)] rounded-xl px-3.5 py-2.5 text-sm text-left">
      <span class="tl1-select-label truncate">${sel?.label ?? ''}</span>
      <svg class="tl1-select-chevron w-4 h-4 shrink-0 text-[var(--primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
    </button>
    <div class="tl1-select-panel rounded-xl border border-[var(--glass-border)] bg-[var(--surface-elevated)] shadow-xl">
      ${options.map((o, i) => `<button type="button" data-value="${o.value}" class="tl1-select-opt tl1-step-in w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left text-[13px] hover:bg-[var(--primary)]/10 ${o.value === sel?.value ? 'bg-[var(--primary)]/10 text-[var(--primary)] font-bold' : 'text-[var(--on-surface)]'}" style="animation-delay:${i * 0.025}s">
        <span class="truncate">${o.label}</span>
        ${o.value === sel?.value ? '<svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' : ''}
      </button>`).join('')}
    </div>
  </div>`;
}
let __tl1SelectDelegated = false;
function ensureTl1SelectDelegation() {
  if (__tl1SelectDelegated) return;
  __tl1SelectDelegated = true;
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const closeAll = (except) => {
    document.querySelectorAll('.tl1-select.tl1-select-open').forEach((r) => { if (r !== except) r.classList.remove('tl1-select-open'); });
  };
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.tl1-select-trigger');
    const opt = e.target.closest('.tl1-select-opt');
    if (trigger) {
      const root = trigger.closest('.tl1-select');
      const willOpen = !root.classList.contains('tl1-select-open');
      closeAll(willOpen ? root : null);
      root.classList.toggle('tl1-select-open', willOpen);
      if (willOpen && !reduced()) {
        root.querySelectorAll('.tl1-select-opt').forEach((el) => { el.classList.remove('tl1-step-in'); void el.offsetWidth; el.classList.add('tl1-step-in'); });
      }
      return;
    }
    if (opt) {
      const root = opt.closest('.tl1-select');
      const label = root.querySelector('.tl1-select-label');
      root.dataset.value = opt.dataset.value;
      label.textContent = opt.querySelector('span').textContent;
      root.querySelectorAll('.tl1-select-opt').forEach((o) => {
        const isSel = o === opt;
        o.classList.toggle('bg-[var(--primary)]/10', isSel);
        o.classList.toggle('text-[var(--primary)]', isSel);
        o.classList.toggle('font-bold', isSel);
        o.classList.toggle('text-[var(--on-surface)]', !isSel);
        const existingCheck = o.querySelector('svg');
        if (isSel && !existingCheck) o.insertAdjacentHTML('beforeend', '<svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>');
        if (!isSel && existingCheck) existingCheck.remove();
      });
      closeAll();
      // Un <select> nativo emette 'change' quando l'opzione cambia — questo
      // non è nativo, quindi lo dichiariamo a mano: qualunque codice che già
      // ascolta 'change' su questo elemento (scritto per il vecchio <select>)
      // continua a funzionare identico, zero riscrittura altrove.
      root.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    closeAll();
  });
}
ensureTl1SelectDelegation();
// Imposta il valore da codice (es. autocompilazione cliente ricorrente) —
// riusa lo stesso percorso del click reale sull'opzione, così label,
// checkmark ed evento 'change' restano coerenti in un solo posto.
function tl1SelectSetValue(id, value) {
  const root = document.getElementById(id);
  const opt = root?.querySelector(`.tl1-select-opt[data-value="${value}"]`);
  opt?.click();
}

// Passo numerato per le guide "come si fa davvero" (apertura P.IVA, SdI):
// un cerchietto col numero invece di un elenco puntato piatto, coerente col
// resto del linguaggio visivo del Livello 1.
function tl1Step(n, html) {
  return `<div class="tl1-step-in flex items-start gap-2.5" style="animation-delay:${(n - 1) * 0.06}s">
    <span class="shrink-0 w-5 h-5 rounded-full bg-[var(--gold)]/20 text-[var(--gold)] text-[10px] font-black flex items-center justify-center mt-0.5">${n}</span>
    <span class="text-[11px] text-[var(--on-surface-secondary)] text-left leading-relaxed">${html}</span>
  </div>`;
}
// Coppia costo/tempo: le due domande che chiunque si fa PRIMA di iniziare
// ("costa? ci metto tanto?") e che nessuna guida mette in cima — qui sono
// la prima cosa visibile dopo il titolo del percorso, non un dettaglio in
// fondo. Verde = certo e favorevole, ambra = variabile (mai rosso: non è
// una colpa, è un'informazione).
function tl1CostoTempo(costo, costoTono, tempo, tempoTono) {
  const chip = (label, value, tono) => {
    const col = tono === 'green' ? '--green' : '--gold';
    return `<div class="flex-1 rounded-xl border border-[var(--glass-border)] bg-black/20 px-3 py-2">
      <div class="text-[9px] font-bold text-[var(--on-surface-secondary)] uppercase tracking-wide">${label}</div>
      <div class="text-[13px] font-black text-[var(${col})]">${value}</div>
    </div>`;
  };
  return `<div class="flex gap-2 w-full">${chip('Costo', costo, costoTono)}${chip('Tempo', tempo, tempoTono)}</div>`;
}
// Checklist "cosa ti serve prima di iniziare": spezzare "sembra difficile"
// in 3-5 cose piccole e già possedute per la maggior parte delle persone
// (codice fiscale, un indirizzo) abbassa l'ansia molto più di un paragrafo
// rassicurante — e vederle spuntare una a una dà un senso di controllo
// concreto (la stessa leva psicologica di una lista della spesa).
function tl1Checklist(id, items) {
  return `<div class="w-full text-left">
    <div class="flex items-center justify-between mb-1.5">
      <span class="text-[10px] font-bold text-[var(--on-surface-secondary)] uppercase tracking-wide">Cosa ti serve, prima di iniziare</span>
      <span id="${id}-count" class="text-[10px] font-bold text-[var(--gold)]">0/${items.length}</span>
    </div>
    <div class="tl1-checklist-progress mb-2"><div id="${id}-bar" style="width:0%"></div></div>
    <div class="flex flex-col gap-1.5">
      ${items.map((txt, i) => `<label class="flex items-center gap-2.5 text-[11px] text-[var(--on-surface-secondary)] cursor-pointer select-none" data-tl1-checklist="${id}">
        <input type="checkbox" class="tl1-check w-4 h-4 rounded accent-[var(--green)] shrink-0" />
        <span>${txt}</span>
      </label>`).join('')}
    </div>
  </div>`;
}
// Validazione LIVE dei campi fiscali della fattura: la card "Crea fattura"
// non aveva ALCUN controllo specifico su P.IVA/Codice Fiscale/CAP/Provincia
// — un errore di battitura si scopriva solo dopo, allo scarto SdI. Qui si
// usano gli stessi validatori con cifra di controllo REALE già presenti in
// it-fiscal-id.js (mai usati finora nel form) per dare un segnale immediato,
// a colpo d'occhio: bordo verde = coerente, ambra = da controllare (mai
// rosso-colpa, è un dato tecnico non un errore morale). Anello di conferma
// verde quando il campo torna valido, coerente col resto dell'app.
function tl1LiveValidate(id, validator) {
  const el = document.getElementById(id);
  if (!el) return;
  const check = () => {
    const val = el.value.trim();
    el.classList.remove('tl1-field-ok', 'tl1-field-warn', 'tl1-field-pop');
    if (!val) return; // campo vuoto: nessun giudizio, potrebbe essere solo non ancora compilato
    const ok = validator(val);
    el.classList.add(ok ? 'tl1-field-ok' : 'tl1-field-warn');
    if (ok && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.remove('tl1-field-pop'); void el.offsetWidth; el.classList.add('tl1-field-pop');
    }
  };
  el.addEventListener('input', check);
  check();
}
function tl1InitChecklist(id) {
  const boxes = document.querySelectorAll(`[data-tl1-checklist="${id}"] input`);
  const count = document.getElementById(`${id}-count`);
  const bar = document.getElementById(`${id}-bar`);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  boxes.forEach((box) => box.addEventListener('change', () => {
    const done = Array.from(boxes).filter((b) => b.checked).length;
    if (count) count.textContent = `${done}/${boxes.length}`;
    if (bar) bar.style.width = `${(done / boxes.length) * 100}%`;
    if (box.checked && !reduced) { box.classList.remove('tl1-check-pop'); void box.offsetWidth; box.classList.add('tl1-check-pop'); }
  }));
}

// SVIZZERA — una sola domanda (reddito annuo stimato in CHF), numeri grandi,
// zero gergo: stesso principio "semplice anche per un bambino" già usato per
// la Partita IVA italiana, applicato a un sistema fiscale strutturalmente
// diverso (niente regime forfettario/ordinario, niente SdI — src/predict/tax-ch.js).
// LOCALIZZAZIONE (i18n/ui-strings.js): rilevata una volta per sessione dal
// dispositivo (le 3 lingue nazionali svizzere coperte + inglese di
// sicurezza per chi non rientra in nessuna) — mai l'italiano imposto a chi
// non l'ha scelto e il cui dispositivo non lo suggerisce. Primo modulo
// riusabile: stesso pattern da estendere schermata per schermata quando si
// aggiunge il prossimo mercato, non riscritto da capo ogni volta.
const __chLang = resolveUiLanguage();

window.openSwissSimulator = () => {
  window.openModal(`
    <div class="flex flex-col gap-4 p-4 sm:p-6 lg:p-2 text-center items-center modal-section-in">
      ${tl1Icon('<path d="M12 3v18M3 12h18"/><rect x="4" y="4" width="16" height="16" rx="2"/>', '--red')}
      <div>
        <h3 class="text-lg font-black leading-tight">${tCh('chSimTitle', __chLang)}</h3>
        <p class="card-sub !mb-0 mt-1.5">${tCh('chSimSubtitle', __chLang)}</p>
      </div>
      <div class="w-full flex items-center gap-2">
        <button type="button" id="ch-step-down" aria-label="-" class="tl1-step-btn shrink-0 w-11 h-11 rounded-xl border border-[var(--glass-border)] bg-black/30 text-lg font-black flex items-center justify-center">−</button>
        <input id="ch-amount" type="number" inputmode="decimal" placeholder="${tCh('chSimPlaceholder', __chLang)}" class="w-full bg-black/30 border border-[var(--glass-border)] rounded-xl px-4 py-3.5 text-2xl font-black text-center tracking-tight" />
        <button type="button" id="ch-step-up" aria-label="+" class="tl1-step-btn shrink-0 w-11 h-11 rounded-xl border border-[var(--glass-border)] bg-black/30 text-lg font-black flex items-center justify-center">+</button>
      </div>
      <button id="ch-go" class="btn-action btn-primary w-full py-3.5 font-bold rounded-xl">${tCh('chSimCta', __chLang)}</button>
      <button onclick="window.openTaxLevel1()" class="text-[11px] text-[var(--on-surface-secondary)] underline">${tCh('chSimBack', __chLang)}</button>
    </div>`);
  const input = document.getElementById('ch-amount');
  input?.focus();
  document.getElementById('ch-step-down')?.addEventListener('click', () => { input.value = Math.max(0, (+input.value || 0) - 1000); });
  document.getElementById('ch-step-up')?.addEventListener('click', () => { input.value = (+input.value || 0) + 1000; });
  document.getElementById('ch-go')?.addEventListener('click', () => {
    const reddito = parseFloat(String(input.value).replace(',', '.'));
    if (!(reddito > 0)) { showToast(tCh('chInvErrAmount', __chLang), 'error'); return; }
    window.openSwissSimulatorResult(reddito);
  });
};

window.openSwissSimulatorResult = (reddito) => {
  const avs = computeAvsIndipendente(reddito);
  const iva = ivaObbligatoriaCh(reddito);
  const avsRigo = avs.fasciaPiena
    ? `<div class="rounded-xl border border-[var(--glass-border)] bg-black/20 px-3.5 py-3 text-left">
        <div class="flex items-center justify-between gap-2"><span class="text-[10px] font-bold uppercase tracking-wide text-[var(--on-surface-secondary)]">${tCh('chAvsLabel', __chLang)}</span><span class="font-mono font-bold text-sm">CHF ${Math.round(avs.contributo).toLocaleString('it-CH')}</span></div>
      </div>`
    : `<div class="rounded-xl border border-amber-400/40 bg-amber-500/10 px-3.5 py-3 text-left">
        <div class="text-[11px] font-bold text-amber-300">${tCh('chAvsDegressiveTitle', __chLang)}</div>
        <div class="text-[11px] text-amber-200/90 mt-1 leading-snug">${tCh('chAvsDegressiveText', __chLang, AVS_SOGLIA_ALIQUOTA_PIENA.toLocaleString('it-CH'), avs.contributoMinimoAnnuo)} <a href="${AVS_CALCOLATORE_UFFICIALE_URL}" target="_blank" rel="noopener" class="underline">${tCh('chAvsDegressiveLink', __chLang)}</a>.</div>
      </div>`;
  const ivaColor = iva.obbligatoria ? 'orange-300' : 'emerald-300';
  window.openModal(`
    <div class="flex flex-col gap-4 p-4 sm:p-6 lg:p-2 text-center items-center modal-section-in">
      ${tl1Icon('<path d="M12 3v18M3 12h18"/><rect x="4" y="4" width="16" height="16" rx="2"/>', '--red')}
      <div>
        <h3 class="text-lg font-black leading-tight">${tCh('chResultTitle', __chLang, Math.round(reddito).toLocaleString('it-CH'))}</h3>
        <p class="card-sub !mb-0 mt-1.5">${tCh('chResultSubtitle', __chLang)}</p>
      </div>
      <div class="w-full flex flex-col gap-2.5">
        ${avsRigo}
        <div class="text-[11px] text-${ivaColor} leading-snug text-left px-1">${escapeHtml(iva.messaggio)}</div>
        <div class="text-[11px] text-emerald-300/90 leading-snug text-left px-1">${tCh('chInvestText', __chLang)}</div>
      </div>
      <p class="text-[10px] text-[var(--on-surface-secondary)] leading-snug">${tCh('chCantonNote', __chLang)}</p>
      <button onclick="window.closeModal(); window.openCreateInvoiceCH();" class="btn-action btn-primary w-full py-3 font-bold rounded-xl text-sm">${tCh('chCreateInvoice', __chLang)}</button>
      <button onclick="window.openSwissSimulator()" class="text-[11px] text-[var(--on-surface-secondary)] underline">${tCh('chRecalculate', __chLang)}</button>
    </div>`);
};

// FATTURA SVIZZERA CON QR-BILL — colma la lacuna dichiarata: prima "Crea
// fattura" esisteva solo per la Partita IVA italiana (FatturaPA/SdI, che in
// Svizzera non esiste). Riusa lo stesso encoder QR già in produzione per i
// bonifici SEPA (src/pay/qr-encode.js, livello di correzione M — lo stesso
// richiesto dalla specifica QR-bill) e il payload verificato byte-per-byte
// contro 3 esempi ufficiali SIX (swiss-qr-bill.js). Il profilo del
// creditore (i TUOI dati) si chiede una volta sola e si ricorda, stesso
// schema di VaultDAO.state.invoiceProfile per l'Italia — ma un oggetto
// separato: i campi non corrispondono (IBAN/QR-IBAN invece di Partita IVA).
window.openCreateInvoiceCH = () => {
  const prof = VaultDAO.state.chInvoiceProfile || {};
  window.openModal(`
    <div class="flex flex-col gap-4 p-4 sm:p-6 lg:p-2 text-center items-center modal-section-in">
      ${tl1Icon('<path d="M12 3v18M3 12h18"/><rect x="4" y="4" width="16" height="16" rx="2"/>', '--red')}
      <div>
        <h3 class="text-lg font-black leading-tight">${tCh('chInvTitle', __chLang)}</h3>
        <p class="card-sub !mb-0 mt-1.5">${tCh('chInvSubtitle', __chLang)}</p>
      </div>
      <div class="w-full flex flex-col gap-2.5 text-left">
        <div class="text-[10px] font-bold text-[var(--on-surface-secondary)] uppercase tracking-wide">${tCh('chInvYourData', __chLang)}</div>
        <input id="ch-inv-iban" type="text" placeholder="${tCh('chInvIban', __chLang)}" value="${escapeHtml(prof.iban || '')}" class="w-full bg-black/30 border border-[var(--glass-border)] rounded-xl px-4 py-3 text-sm font-mono" />
        <input id="ch-inv-name" type="text" placeholder="${tCh('chInvName', __chLang)}" value="${escapeHtml(prof.name || '')}" class="w-full bg-black/30 border border-[var(--glass-border)] rounded-xl px-4 py-3 text-sm" />
        <div class="grid grid-cols-2 gap-2.5">
          <input id="ch-inv-street" type="text" placeholder="${tCh('chInvStreet', __chLang)}" value="${escapeHtml(prof.street || '')}" class="w-full bg-black/30 border border-[var(--glass-border)] rounded-xl px-4 py-3 text-sm" />
          <input id="ch-inv-bld" type="text" placeholder="${tCh('chInvBuilding', __chLang)}" value="${escapeHtml(prof.buildingNo || '')}" class="w-full bg-black/30 border border-[var(--glass-border)] rounded-xl px-4 py-3 text-sm" />
        </div>
        <div class="grid grid-cols-2 gap-2.5">
          <input id="ch-inv-cap" type="text" placeholder="${tCh('chInvCap', __chLang)}" value="${escapeHtml(prof.postalCode || '')}" class="w-full bg-black/30 border border-[var(--glass-border)] rounded-xl px-4 py-3 text-sm" />
          <input id="ch-inv-city" type="text" placeholder="${tCh('chInvCity', __chLang)}" value="${escapeHtml(prof.town || '')}" class="w-full bg-black/30 border border-[var(--glass-border)] rounded-xl px-4 py-3 text-sm" />
        </div>
        <div class="text-[10px] font-bold text-[var(--on-surface-secondary)] uppercase tracking-wide mt-1">${tCh('chInvClientSection', __chLang)}</div>
        <input id="ch-inv-client" type="text" placeholder="${tCh('chInvClientName', __chLang)}" class="w-full bg-black/30 border border-[var(--glass-border)] rounded-xl px-4 py-3 text-sm" />
        <div class="grid grid-cols-2 gap-2.5">
          <input id="ch-inv-amount" type="number" inputmode="decimal" placeholder="${tCh('chInvAmount', __chLang)}" class="w-full bg-black/30 border border-[var(--glass-border)] rounded-xl px-4 py-3 text-sm font-mono" />
          <input id="ch-inv-desc" type="text" placeholder="${tCh('chInvDesc', __chLang)}" class="w-full bg-black/30 border border-[var(--glass-border)] rounded-xl px-4 py-3 text-sm" />
        </div>
      </div>
      <button id="ch-inv-go" class="btn-action btn-primary w-full py-3.5 font-bold rounded-xl">${tCh('chInvGenerate', __chLang)}</button>
      <p class="text-[10px] text-[var(--on-surface-secondary)] leading-snug">${tCh('chInvDisclaimer', __chLang)}</p>
    </div>`);
  document.getElementById('ch-inv-go')?.addEventListener('click', () => {
    const iban = document.getElementById('ch-inv-iban').value.trim();
    const name = document.getElementById('ch-inv-name').value.trim();
    const street = document.getElementById('ch-inv-street').value.trim();
    const buildingNo = document.getElementById('ch-inv-bld').value.trim();
    const postalCode = document.getElementById('ch-inv-cap').value.trim();
    const town = document.getElementById('ch-inv-city').value.trim();
    const client = document.getElementById('ch-inv-client').value.trim();
    const amount = parseFloat(String(document.getElementById('ch-inv-amount').value).replace(',', '.'));
    const desc = document.getElementById('ch-inv-desc').value.trim();
    if (!iban || !name || !postalCode || !town) { showToast(tCh('chInvErrMissing', __chLang), 'error'); return; }
    if (!(amount > 0)) { showToast(tCh('chInvErrAmount', __chLang), 'error'); return; }
    VaultDAO.state.chInvoiceProfile = { iban, name, street, buildingNo, postalCode, town, country: 'CH' };
    VaultDAO.save();
    const ibanNorm = iban.replace(/\s/g, '').toUpperCase();
    const iid = +ibanNorm.slice(4, 9);
    const isQrIban = Number.isFinite(iid) && iid >= 30000 && iid <= 31999;
    let referenceType = 'NON', reference = '';
    if (isQrIban) {
      const base = String(Date.now()).slice(-10);
      const gen = generateQrrReference(base);
      referenceType = 'QRR'; reference = gen.reference;
    }
    const r = buildSwissQrPayload({
      creditor: { iban: ibanNorm, name, street, buildingNo, postalCode, town, country: 'CH' },
      amount, currency: 'CHF',
      debtor: client ? { name: client, country: 'CH' } : null,
      referenceType, reference,
      unstructuredMessage: desc,
    });
    if (!r.ok) { showToast(r.errori[0] || tCh('chInvErrMissing', __chLang), 'error'); return; }
    window.openCreateInvoiceCHResult(r, { name, client, amount, desc, reference, referenceType });
  });
};

window.openCreateInvoiceCHResult = (r, meta) => {
  const svg = qrSvg(r.payload, { moduleSize: 5, quiet: 3 });
  window.openModal(`
    <div class="flex flex-col gap-4 p-4 sm:p-6 lg:p-2 text-center items-center modal-section-in">
      ${tl1Icon('<path d="M20 6L9 17l-5-5"/>', '--green')}
      <div>
        <h3 class="text-lg font-black leading-tight">${tCh('chResTitle', __chLang)}</h3>
        <p class="card-sub !mb-0 mt-1.5">${escapeHtml(meta.client || '')} · CHF ${meta.amount.toLocaleString('it-CH')}${meta.desc ? ' · ' + escapeHtml(meta.desc) : ''}</p>
      </div>
      <div class="bg-white rounded-xl p-3 inline-block">${svg}</div>
      ${meta.referenceType === 'QRR' ? `<div class="text-[11px] font-mono text-[var(--on-surface-secondary)]">${tCh('chRefLabel', __chLang)}: ${escapeHtml(formatQrrReference(meta.reference))}</div>` : ''}
      <p class="text-[10px] text-[var(--on-surface-secondary)] leading-snug">${tCh('chResDisclaimer', __chLang)}</p>
      <button onclick="window.openCreateInvoiceCH()" class="text-[11px] text-[var(--on-surface-secondary)] underline">${tCh('chResNewInvoice', __chLang)}</button>
    </div>`);
};

window.openTaxLevel1 = () => {
  window.openModal(`
    <div class="flex flex-col gap-4 p-4 sm:p-6 lg:p-2 text-center items-center modal-section-in">
      ${tl1Icon('<path d="M20 7h-3V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v2H4a1 1 0 0 0-1 1v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a1 1 0 0 0-1-1z"/><path d="M9 7V5h6v2"/>')}
      <div>
        <h3 class="text-lg font-black leading-tight">Partita IVA</h3>
        <p class="card-sub !mb-0 mt-1.5">Una domanda per volta — dimmi solo questo, il resto lo capisco io.</p>
      </div>
      <div class="w-full flex flex-col gap-2.5">
        <button onclick="window.closeModal(); window.openTaxRegimePicker();" class="btn-action btn-primary w-full py-3.5 font-bold rounded-xl justify-between">
          <span class="inline-flex items-center gap-2"><svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>Sì, ce l'ho già</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4 shrink-0"><path d="M9 18l6-6-6-6"/></svg>
        </button>
        <button onclick="window.openTaxLevel1Simulate()" class="btn-action w-full py-3.5 font-bold rounded-xl justify-between">
          <span class="inline-flex items-center gap-2"><svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>Non ancora, la sto valutando</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4 shrink-0"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
    </div>`);
};

// Passo 2: una sola domanda numerica. Nessuna configurazione (regime, ATECO,
// cassa) chiesta qui — sarebbe gergo proprio a chi ancora non sa cosa sia.
window.openTaxLevel1Simulate = () => {
  window.openModal(`
    <div class="flex flex-col gap-4 p-4 sm:p-6 lg:p-2 text-center items-center modal-section-in">
      ${tl1Icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>', '--gold')}
      ${tl1Dots(1)}
      <div>
        <h3 class="text-lg font-black leading-tight">Se aprissi la Partita IVA…</h3>
        <p class="card-sub !mb-0 mt-1.5">Quanto pensi di fatturare? Anche una stima approssimativa va bene.</p>
      </div>
      <!-- Problema reale: molte persone pensano in termini MENSILI ("mi
           pagano 2000 al mese"), non annuali — costringerle a fare la
           moltiplicazione a mente è attrito puro. Il numero sotto resta
           sempre annuale per il calcolo, il testo del bottone dice cosa sta
           per convertire, mai un cambio silenzioso. -->
      <div class="flex gap-1.5 p-1 rounded-full bg-black/30 border border-[var(--glass-border)]">
        <button type="button" id="tl1-periodo-anno" class="flex-1 text-[11px] font-bold py-1.5 rounded-full transition-all bg-[var(--primary)] text-white">All'anno</button>
        <button type="button" id="tl1-periodo-mese" class="flex-1 text-[11px] font-bold py-1.5 rounded-full transition-all text-[var(--on-surface-secondary)]">Al mese</button>
      </div>
      <!-- Stepper +/- disegnato apposta invece delle frecce native del
           browser (grigie, cambiano forma per OS, mai in stile con l'app). -->
      <div class="w-full flex items-center gap-2">
        <button type="button" id="tl1-step-down" aria-label="Diminuisci" class="tl1-step-btn shrink-0 w-11 h-11 rounded-xl border border-[var(--glass-border)] bg-black/30 text-lg font-black flex items-center justify-center">−</button>
        <input id="tl1-amount" type="number" inputmode="decimal" placeholder="Es. 30000" class="w-full bg-black/30 border border-[var(--glass-border)] rounded-xl px-4 py-3.5 text-2xl font-black text-center tracking-tight" />
        <button type="button" id="tl1-step-up" aria-label="Aumenta" class="tl1-step-btn shrink-0 w-11 h-11 rounded-xl border border-[var(--glass-border)] bg-black/30 text-lg font-black flex items-center justify-center">+</button>
      </div>
      <!-- Facoltativo: il coefficiente cambia molto il risultato per chi fa
           commercio invece di consulenza, ma chiederlo come domanda obbligata
           sarebbe gergo per chi sta ancora decidendo — resta un dettaglio
           apribile, mai un campo che blocca il passo successivo. -->
      <details class="w-full text-left">
        <summary class="cursor-pointer text-[11px] text-[var(--on-surface-secondary)] underline">Cosa farai, di preciso? (facoltativo, cambia la stima)</summary>
        <!-- Non "cerca il tuo codice ATECO" (gergo), ma "descrivi il lavoro"
             — la ricerca trova lei il codice, l'utente non deve saperlo a
             memoria. Elenco parziale e onesto: link allo strumento ufficiale
             sempre visibile, mai un'unica fonte di verità nostra. -->
        <p class="text-[10px] text-[var(--on-surface-secondary)] mt-2 mb-1">Descrivi in due parole cosa farai (es. "vendo online", "faccio l'elettricista") e trovo io il codice ATECO più vicino:</p>
        <div class="relative">
          <input id="tl1-ateco-search" type="text" placeholder="Es. faccio consulenza informatica…" autocomplete="off" class="w-full bg-black/30 border border-[var(--glass-border)] rounded-xl px-3.5 py-2.5 text-sm" />
          <div id="tl1-ateco-hits" class="hidden mt-1.5 rounded-xl border border-[var(--glass-border)] bg-[var(--surface-elevated)] shadow-xl overflow-hidden max-h-56 overflow-y-auto"></div>
        </div>
        <div id="tl1-ateco-picked" class="hidden mt-2 rounded-xl border border-[var(--primary)] bg-[var(--primary)]/10 px-3 py-2 text-[11px] text-[var(--on-surface)] flex items-center justify-between gap-2">
          <span id="tl1-ateco-picked-label"></span>
          <button type="button" id="tl1-ateco-picked-clear" class="text-[var(--on-surface-secondary)] hover:text-[var(--on-surface)]" aria-label="Rimuovi">✕</button>
        </div>
        <p class="text-[10px] text-[var(--on-surface-secondary)] mt-1.5">Non lo trovi o vuoi il codice esatto? <a href="${ATECO_UFFICIALE_URL}" target="_blank" rel="noopener" class="underline text-[var(--primary)]">Cercalo sullo strumento ufficiale gratuito</a>, o scegli solo la categoria qui sotto:</p>
        <div class="mt-2">${tl1Select('tl1-ateco',
          Object.entries(ATECO_COEFFICIENTI).map(([k, v]) => ({ value: k, label: v.label })),
          'professionisti')}</div>
        <!-- Chi ha un albo professionale con cassa propria è ESENTE per legge
             dall'INPS Gestione Separata (fatto verificato, non un dettaglio di
             stile) — senza chiederlo, Momentum applicherebbe un contributo che
             non è dovuto per un'ampia fetta del mercato P.IVA. -->
        <div class="mt-2">${tl1Select('tl1-cassa',
          [{ value: '', label: 'Nessun albo/cassa propria (INPS Gestione Separata)' },
           ...Object.entries(CASSE_PROFESSIONALI).map(([k, v]) => ({ value: k, label: `${k.replace(/_/g, '/')} — ${v}` }))],
          '')}</div>
        <label class="flex items-center gap-2 mt-2 text-[11px] text-[var(--on-surface-secondary)] cursor-pointer select-none">
          <input type="checkbox" id="tl1-dipendente" class="w-3.5 h-3.5 rounded accent-[var(--primary)]" />
          Lavoro già come dipendente (o ho un'altra copertura previdenziale obbligatoria) — INPS al 24% invece di 26,07%
        </label>
      </details>
      <button id="tl1-go" class="btn-action btn-primary w-full py-3.5 font-bold rounded-xl">Scopri cosa ti resterebbe</button>
      <button onclick="window.openTaxLevel1()" class="text-[11px] text-[var(--on-surface-secondary)] underline">← Torna indietro</button>
    </div>`);
  const input = document.getElementById('tl1-amount');
  input?.focus();
  // Ricerca ATECO in linguaggio comune: filtra a ogni tocco, mostra fino a 6
  // suggerimenti con codice reale + categoria, e sceglierne uno aggiorna sia
  // il menu a tendina (così il coefficiente applicato resta quello giusto)
  // sia un'etichetta "scelta" con il codice specifico mostrato per intero —
  // utile più avanti nel kit di riepilogo della guida "come si apre davvero".
  const atecoSearch = document.getElementById('tl1-ateco-search');
  const atecoHits = document.getElementById('tl1-ateco-hits');
  const atecoPicked = document.getElementById('tl1-ateco-picked');
  const atecoPickedLabel = document.getElementById('tl1-ateco-picked-label');
  const atecoRoot = document.getElementById('tl1-ateco');
  atecoSearch?.addEventListener('input', () => {
    const hits = searchAtecoComuni(atecoSearch.value);
    if (!hits.length) { atecoHits.classList.add('hidden'); atecoHits.innerHTML = ''; return; }
    atecoHits.innerHTML = hits.map((h, i) => `<button type="button" data-code="${h.code}" data-categoria="${h.categoria}" data-label="${h.label}" class="tl1-ateco-hit w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left text-[13px] hover:bg-[var(--primary)]/10 text-[var(--on-surface)]" style="animation-delay:${i * 0.03}s">
      <span class="truncate">${h.label}</span>
      <span class="shrink-0 text-[10px] font-mono text-[var(--on-surface-secondary)]">${h.code}</span>
    </button>`).join('');
    atecoHits.classList.remove('hidden');
  });
  atecoHits?.addEventListener('click', (e) => {
    const hit = e.target.closest('.tl1-ateco-hit');
    if (!hit) return;
    const opt = atecoRoot?.querySelector(`.tl1-select-opt[data-value="${hit.dataset.categoria}"]`);
    opt?.click();
    atecoRoot.dataset.atecoCode = hit.dataset.code;
    atecoPickedLabel.textContent = `${hit.dataset.label} — ATECO ${hit.dataset.code}`;
    atecoPicked.classList.remove('hidden');
    atecoHits.classList.add('hidden');
    atecoSearch.value = '';
  });
  document.getElementById('tl1-ateco-picked-clear')?.addEventListener('click', () => {
    if (atecoRoot) delete atecoRoot.dataset.atecoCode;
    atecoPicked.classList.add('hidden');
  });
  let periodo = 'anno';
  const btnAnno = document.getElementById('tl1-periodo-anno'), btnMese = document.getElementById('tl1-periodo-mese');
  const setPeriodo = (p) => {
    // Riconverte il NUMERO nell'input (non solo l'etichetta): passare da
    // "annuale" a "mensile" senza aggiornare la cifra mostrerebbe un valore
    // che non corrisponde più a cosa dice il bottone — la fonte #1 di
    // confusione in qualunque form con un'unità che cambia.
    const val = parseFloat(String(input.value).replace(',', '.'));
    if (val > 0) input.value = periodo === 'anno' && p === 'mese' ? +(val / 12).toFixed(0) : periodo === 'mese' && p === 'anno' ? +(val * 12).toFixed(0) : val;
    periodo = p;
    btnAnno.className = `flex-1 text-[11px] font-bold py-1.5 rounded-full transition-all ${p === 'anno' ? 'bg-[var(--primary)] text-white' : 'text-[var(--on-surface-secondary)]'}`;
    btnMese.className = `flex-1 text-[11px] font-bold py-1.5 rounded-full transition-all ${p === 'mese' ? 'bg-[var(--primary)] text-white' : 'text-[var(--on-surface-secondary)]'}`;
    input.placeholder = p === 'anno' ? 'Es. 30000' : 'Es. 2500';
  };
  btnAnno?.addEventListener('click', () => setPeriodo('anno'));
  btnMese?.addEventListener('click', () => setPeriodo('mese'));
  // Stepper +/- con passo sensato per periodo (500€ all'anno, 50€ al mese —
  // scatti piccoli sarebbero inutili su cifre a 5 zeri, grandi sarebbero
  // rozzi al mese) e un piccolo salto verticale nella direzione del segno,
  // così il numero si "sente" muoversi invece di cambiare di scatto.
  const bump = (dir, btn) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    input.style.setProperty('--bump-y', dir > 0 ? '-9px' : '9px');
    input.classList.remove('tl1-bump'); void input.offsetWidth; input.classList.add('tl1-bump');
    if (btn) { btn.classList.remove('tl1-ring'); void btn.offsetWidth; btn.classList.add('tl1-ring'); }
  };
  const step = (dir, btn) => {
    const cur = parseFloat(String(input.value).replace(',', '.')) || 0;
    const unit = periodo === 'anno' ? 500 : 50;
    input.value = Math.max(0, cur + dir * unit);
    bump(dir, btn);
  };
  const stepUpBtn = document.getElementById('tl1-step-up'), stepDownBtn = document.getElementById('tl1-step-down');
  stepUpBtn?.addEventListener('click', () => step(1, stepUpBtn));
  stepDownBtn?.addEventListener('click', () => step(-1, stepDownBtn));
  const go = () => {
    const val = parseFloat(String(input.value).replace(',', '.')) || 0;
    window.openTaxLevel1Result(periodo === 'mese' ? val * 12 : val, document.getElementById('tl1-ateco')?.dataset.value, {
      cassaPropria: document.getElementById('tl1-cassa')?.dataset.value || null,
      altraCoperturaPrevidenziale: !!document.getElementById('tl1-dipendente')?.checked,
      atecoCode: document.getElementById('tl1-ateco')?.dataset.atecoCode || null,
    });
  };
  document.getElementById('tl1-go')?.addEventListener('click', go);
  input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
};

// Passo 3: il risultato, in parole — mai un numero orfano senza spiegazione,
// e mai senza l'avviso sul secondo anno (la sorpresa di cassa più comune).
// Il numero "arriva" con un pop invece di apparire di scatto: lo stesso
// micro-ritmo già usato per la conferma di scelta sui temi fattura.
const TL1_STRATEGY_ICONS = {
  startup: '<path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"/>', // stella (aliquota agevolata)
  timing: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>', // orologio (tempismo incassi)
  cassa: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/>', // edificio (cassa/albo professionale)
  dipendente: '<rect x="4" y="7" width="16" height="13" rx="2"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/>', // valigetta (doppio lavoro)
};
window.openTaxLevel1Result = (fatturato, ateco, extra = {}) => {
  if (!(fatturato > 0)) { showToast('Inserisci una stima di fatturato per continuare.', 'error'); return; }
  const s = simulateNewPartitaIva(fatturato, { ateco, cassaPropria: extra.cassaPropria, altraCoperturaPrevidenziale: extra.altraCoperturaPrevidenziale });
  // Strategie legittime (mai trucchi inventati): ogni voce è verificata su
  // fonte ufficiale e posta come domanda da fare al commercialista, non come
  // fatto certo — l'eleggibilità reale dipende dalla storia dell'utente, che
  // Momentum non conosce.
  const strategieHTML = s.strategie.length ? `
    <div class="w-full text-left">
      <div class="text-[10px] font-bold text-[var(--gold)] uppercase tracking-wide mb-1.5">Strategie da valutare</div>
      <div class="flex flex-col gap-2">
        ${s.strategie.map(t => `<div class="rounded-xl border border-[var(--glass-border)] bg-black/20 p-3 text-[11px] text-[var(--on-surface-secondary)] flex items-start gap-2">
          <svg class="w-4 h-4 shrink-0 mt-0.5 text-[var(--gold)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TL1_STRATEGY_ICONS[t.icon] || TL1_STRATEGY_ICONS.timing}</svg>
          <span>${t.testo}</span>
        </div>`).join('')}
      </div>
    </div>` : '';
  window.openModal(`
    <div class="flex flex-col gap-4 p-4 sm:p-6 lg:p-2 text-center items-center modal-section-in">
      ${tl1Icon('<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', '--gold')}
      ${tl1Dots(2)}
      <h3 class="text-base font-black leading-tight">Con ~${Math.round(fatturato).toLocaleString('it-IT')}€/anno${s.atecoLabel ? ` <span class="font-normal text-[var(--on-surface-secondary)] text-xs">(${s.atecoLabel.split('(')[0].trim()})</span>` : ''}</h3>
      <div class="w-full rounded-2xl border border-[var(--glass-border)] bg-[color-mix(in_srgb,#10b981_8%,var(--surface-elevated))] p-4">
        <div class="text-[10px] font-bold text-[var(--on-surface-secondary)] uppercase tracking-wide">Ti resterebbero circa</div>
        <div id="tl1-result-number" class="text-4xl font-black text-emerald-400 my-1">${Math.round(s.netMensile).toLocaleString('it-IT')}€<span class="text-sm font-bold text-[var(--on-surface-secondary)]">/mese</span></div>
        <div class="text-[11px] text-[var(--on-surface-secondary)]">${Math.round(s.netAnnuo).toLocaleString('it-IT')}€/anno, dopo tasse e contributi</div>
      </div>
      <div class="text-xs text-[var(--on-surface-secondary)] text-left w-full">Regime consigliato: <b class="text-[var(--on-surface)]">${s.regimeLabel}</b>. ${s.suggestion.reason}</div>
      <div class="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-200 text-left flex items-start gap-2">
        <svg class="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>
        <span>${s.primoAnnoNote}</span>
      </div>
      ${strategieHTML}
      <div class="text-[10px] text-[var(--on-surface-secondary)] opacity-70">Stima, non consulenza fiscale: verifica sempre col commercialista prima di aprire la Partita IVA.</div>
      <button onclick="window.openTaxLevel1HowToOpen()" class="btn-action w-full py-3.5 font-bold rounded-xl justify-between">
        <span class="inline-flex items-center gap-2"><svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>Ok, come si apre davvero?</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4 shrink-0"><path d="M9 18l6-6-6-6"/></svg>
      </button>
      <button onclick="window.openTaxLevel1Simulate()" class="text-[11px] text-[var(--on-surface-secondary)] underline">← Rifai con un altro importo</button>
      <button onclick="window.closeModal()" class="btn-action btn-primary w-full py-3.5 font-bold rounded-xl">Ho capito</button>
    </div>`);
  // Micro-animazione: il numero arriva con un pop invece di comparire di
  // scatto, coerente col resto dell'app. Rispetta prefers-reduced-motion.
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.getElementById('tl1-result-number')?.animate(
      [{ transform: 'scale(.85)', opacity: 0 }, { transform: 'scale(1.04)', opacity: 1, offset: 0.7 }, { transform: 'scale(1)' }],
      { duration: 420, easing: 'cubic-bezier(.22,1.4,.36,1)' },
    );
  }
  // Stato ponte verso "come si apre davvero": una variabile globale invece
  // di incastrare un oggetto intero in un attributo onclick (fragile con
  // virgolette/apostrofi nei testi). Il kit di riepilogo della guida lo
  // legge da qui — MAI dati personali identificabili, solo la stima.
  window.__tl1LastResult = { fatturato, ateco: ateco || 'professionisti', atecoCode: extra.atecoCode || null, s };
};

// Guida onesta a "come si apre DAVVERO" — passo dopo passo, con il link
// ufficiale vero, non un elenco generico. Due strade reali e diverse per
// procedura: libero professionista (niente Registro Imprese, Modello AA9/12
// via PEC) e attività d'impresa/artigianale (Comunicazione Unica via il
// Registro Imprese, che apre in un colpo solo P.IVA + INPS + INAIL).
// L'ATECO scelto nel simulatore NON è una mappa 1:1 col tipo di procedura
// (es. "altre" è ambiguo) — quindi qui si SUGGERISCE la strada più probabile
// con un badge, ma si mostrano SEMPRE entrambe, aperte e scelte dall'utente:
// mai un'inferenza forzata su qualcosa che cambia la pratica da presentare.
// Testo pronto da incollare nel Modello AA9/12, nella ComUnica o in un
// messaggio al commercialista: la vera frizione di aprire una P.IVA non è
// solo "dove clicco", è arrivare al modulo SENZA sapere cosa scrivere nei
// campi. Solo la stima già calcolata, mai dati anagrafici che Momentum non
// conosce (nome, indirizzo, codice fiscale restano da compilare a mano).
function tl1KitText(last) {
  const { fatturato, atecoCode, s } = last;
  const righe = [
    `Fatturato annuo stimato: ~${Math.round(fatturato).toLocaleString('it-IT')}€`,
    `Codice ATECO: ${atecoCode ? atecoCode : `da confermare su ${ATECO_UFFICIALE_URL} (categoria: ${s.atecoLabel || '—'})`}`,
    `Regime fiscale consigliato: ${s.regimeLabel}`,
  ];
  if (s.cassaNome) righe.push(`Cassa previdenziale: ${s.cassaNome} (esente INPS Gestione Separata)`);
  return righe.join('\n');
}
const TL1_IMPRESA_ATECO = new Set(['commercio', 'ambulante_alimentari', 'intermediari', 'costruzioni']);
window.openTaxLevel1HowToOpen = (atecoArg) => {
  // Se richiamata dal bottone del risultato, legge lo stato ponte
  // (window.__tl1LastResult) per costruire il kit di riepilogo; se chiamata
  // a sé stante con un ateco esplicito, funziona comunque senza kit.
  const last = atecoArg ? null : window.__tl1LastResult;
  const ateco = atecoArg || last?.ateco || 'professionisti';
  const consigliaImpresa = TL1_IMPRESA_ATECO.has(ateco);
  const kitHTML = last ? `
      <div id="tl1-kit" class="w-full text-left rounded-2xl border border-[var(--glass-border)] bg-black/20 p-3.5">
        <div class="flex items-center justify-between gap-2 mb-2">
          <div class="text-[10px] font-bold text-[var(--gold)] uppercase tracking-wide">Il tuo riepilogo, pronto da incollare</div>
        </div>
        <div id="tl1-kit-text" class="text-[11px] text-[var(--on-surface-secondary)] leading-relaxed whitespace-pre-line select-all">${tl1KitText(last)}</div>
        <button type="button" id="tl1-kit-copy" class="mt-2.5 w-full btn-action justify-center text-[11px] font-bold py-2">
          <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copia — incollalo nel modulo o mandalo al commercialista
        </button>
      </div>` : '';
  window.openModal(`
    <div class="flex flex-col gap-4 p-4 sm:p-6 lg:p-2 text-center items-center modal-section-in">
      ${tl1Icon('<path d="M9 12l2 2 4-4M7.8 3.6a9 9 0 1 1-4.2 4.2"/>', '--primary')}
      <div>
        <h3 class="text-lg font-black leading-tight">Come si apre, davvero</h3>
        <p class="card-sub !mb-0 mt-1.5">Due strade diverse, in base a cosa farai. Scegli la tua — Momentum ti indica quella esatta, tu premi invio dalla tua PEC o firma digitale.</p>
      </div>
      <!-- "Modalità esperta": chi legge questa guida può essere un
           commercialista o chi apre la prima P.IVA della sua vita — stesso
           contenuto per entrambi, ma i riferimenti normativi restano un
           dettaglio apribile, mai il default che intimidisce chi non è del
           mestiere. -->
      <button type="button" id="tl1-expert-toggle" class="text-[10px] font-bold text-[var(--on-surface-secondary)] underline self-end -mt-2">Sei del mestiere? Mostra i riferimenti normativi</button>
      <div class="w-full flex flex-col gap-2.5">
        <details class="w-full text-left rounded-2xl border ${!consigliaImpresa ? 'border-[var(--primary)]' : 'border-[var(--glass-border)]'} bg-black/20 overflow-hidden" ${!consigliaImpresa ? 'open' : ''}>
          <summary class="cursor-pointer list-none p-3.5 flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-[color-mix(in_srgb,var(--primary)_16%,transparent)]">
              <svg class="w-4.5 h-4.5 text-[var(--primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7h-3V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v2H4a1 1 0 0 0-1 1v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a1 1 0 0 0-1-1z"/><path d="M9 7V5h6v2"/></svg>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-black flex items-center gap-1.5">Libero professionista${!consigliaImpresa ? ` <span class="text-[9px] font-bold text-[var(--primary)] bg-[var(--primary)]/15 rounded-full px-1.5 py-0.5">il tuo caso</span>` : ''}</div>
              <div class="text-[10px] text-[var(--on-surface-secondary)]">Niente Registro Imprese — Modello AA9/12</div>
            </div>
            <svg class="tl1-guide-chevron w-4 h-4 shrink-0 text-[var(--on-surface-secondary)] transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
          </summary>
          <div class="px-3.5 pb-3.5 flex flex-col gap-2.5 border-t border-[var(--glass-border)] pt-3">
            ${tl1CostoTempo('Gratis', 'green', '24–48 ore', 'green')}
            ${tl1Checklist('tl1-check-libero', ['Codice fiscale', 'Il tuo codice ATECO (già trovato sopra, se l\'hai cercato)', 'Un indirizzo per l\'attività (va bene anche la tua residenza)', 'PEC attiva (se non ce l\'hai, un provider costa in media ~35€/anno)'])}
            ${tl1Step(1, 'Tieni pronti codice fiscale, il tuo codice ATECO e l\'indirizzo dell\'attività.')}
            ${tl1Step(2, 'Compila il <b class="text-[var(--on-surface)]">Modello AA9/12</b> (apertura P.IVA persona fisica), scaricabile dal sito dell\'Agenzia delle Entrate.')}
            ${tl1Step(3, 'Invialo via <b class="text-[var(--on-surface)]">PEC</b> alla Direzione Provinciale competente, oggetto "Dichiarazione di inizio attività", <b class="text-[var(--on-surface)]">entro 30 giorni</b> dall\'inizio dell\'attività — con firma digitale, oppure firma autografa + copia di un documento d\'identità allegata.')}
            ${tl1Step(4, 'Ricevi il numero di Partita IVA in risposta: da lì puoi già fatturare.')}
            <a href="https://www.agenziaentrate.gov.it/portale/schede/istanze/aa9_11-apertura-variazione-chiusura-pf/modello-e-istr-pi-pf" target="_blank" rel="noopener" class="mt-1 inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--primary)] underline">
              Modello AA9/12 su agenziaentrate.gov.it
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M7 7h10v10"/></svg>
            </a>
            <div class="tl1-expert text-[10px] text-[var(--on-surface-secondary)] border-t border-[var(--glass-border)] pt-2 mt-1">Riferimento normativo: obbligo di dichiarazione di inizio attività IVA — art. 35, DPR 633/1972.</div>
          </div>
        </details>
        <details class="w-full text-left rounded-2xl border ${consigliaImpresa ? 'border-[var(--primary)]' : 'border-[var(--glass-border)]'} bg-black/20 overflow-hidden" ${consigliaImpresa ? 'open' : ''}>
          <summary class="cursor-pointer list-none p-3.5 flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-[color-mix(in_srgb,var(--primary)_16%,transparent)]">
              <svg class="w-4.5 h-4.5 text-[var(--primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/></svg>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-black flex items-center gap-1.5">Impresa / artigianato${consigliaImpresa ? ` <span class="text-[9px] font-bold text-[var(--primary)] bg-[var(--primary)]/15 rounded-full px-1.5 py-0.5">il tuo caso</span>` : ''}</div>
              <div class="text-[10px] text-[var(--on-surface-secondary)]">Serve il Registro Imprese — Comunicazione Unica</div>
            </div>
            <svg class="tl1-guide-chevron w-4 h-4 shrink-0 text-[var(--on-surface-secondary)] transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
          </summary>
          <div class="px-3.5 pb-3.5 flex flex-col gap-2.5 border-t border-[var(--glass-border)] pt-3">
            ${tl1CostoTempo('Diritti CCIAA + PEC (~35€/anno se non li hai)', 'amber', 'Alcuni giorni lavorativi', 'amber')}
            ${tl1Checklist('tl1-check-impresa', ['Codice fiscale e dati anagrafici', 'Il tuo codice ATECO', 'Sede dell\'attività', 'Firma digitale', 'PEC attiva'])}
            ${tl1Step(1, 'Tieni pronti i dati dell\'attività: sede, codice ATECO, eventuali requisiti per attività artigianali.')}
            ${tl1Step(2, 'Presenta la <b class="text-[var(--on-surface)]">Comunicazione Unica d\'Impresa (ComUnica)</b> sul portale del Registro delle Imprese: un\'unica pratica apre insieme Partita IVA, iscrizione al Registro Imprese, posizione INPS e INAIL.')}
            ${tl1Step(3, 'Serve una <b class="text-[var(--on-surface)]">firma digitale</b> — o un intermediario abilitato (es. commercialista) che la presenti per te.')}
            ${tl1Step(4, 'La Camera di Commercio smista tutto agli altri enti automaticamente: ricevi conferma e numero di Partita IVA.')}
            <a href="https://registroimprese.infocamere.it" target="_blank" rel="noopener" class="mt-1 inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--primary)] underline">
              Comunicazione Unica su registroimprese.infocamere.it
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M7 7h10v10"/></svg>
            </a>
            <div class="tl1-expert text-[10px] text-[var(--on-surface-secondary)] border-t border-[var(--glass-border)] pt-2 mt-1">Riferimento normativo: Comunicazione Unica obbligatoria dal 2010 — art. 9, L. 40/2007 (conversione D.L. 7/2007).</div>
          </div>
        </details>
      </div>
      ${kitHTML}
      <div class="text-[10px] text-[var(--on-surface-secondary)] opacity-70">Momentum ti indica la strada esatta ma non può presentare la pratica al posto tuo: firma digitale e PEC restano sempre tue, non passano mai dai nostri server.</div>
      <button onclick="window.closeModal()" class="btn-action btn-primary w-full py-3.5 font-bold rounded-xl">Ho capito</button>
    </div>`);
  document.getElementById('tl1-kit-copy')?.addEventListener('click', async () => {
    const text = document.getElementById('tl1-kit-text')?.textContent || '';
    try {
      await navigator.clipboard.writeText(text);
      showToast('Riepilogo copiato — incollalo dove ti serve.', 'success');
      const kit = document.getElementById('tl1-kit');
      if (kit && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        kit.classList.remove('tl1-kit-copied'); void kit.offsetWidth; kit.classList.add('tl1-kit-copied');
      }
    } catch (_) {
      showToast('Non riesco a copiare automaticamente: selezionalo e copialo a mano.', 'error');
    }
  });
  tl1InitChecklist('tl1-check-libero');
  tl1InitChecklist('tl1-check-impresa');
  document.getElementById('tl1-expert-toggle')?.addEventListener('click', (e) => {
    const on = document.querySelectorAll('#modal-content .tl1-expert.tl1-expert-open').length === 0;
    document.querySelectorAll('#modal-content .tl1-expert').forEach((el) => el.classList.toggle('tl1-expert-open', on));
    e.target.textContent = on ? 'Nascondi i riferimenti normativi' : 'Sei del mestiere? Mostra i riferimenti normativi';
  });
  // Freccia che ruota quando la scheda si apre, e i passi numerati che
  // rientrano a scaglione ogni volta che una scheda passa da chiusa ad
  // aperta — un <details> nasconde il contenuto con display:none, quindi
  // l'animazione d'ingresso non riparte da sola: la si rilancia a mano.
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('#modal-content details').forEach((det) => {
    const chevron = det.querySelector('.tl1-guide-chevron');
    det.addEventListener('toggle', () => {
      if (chevron) chevron.style.transform = det.open ? 'rotate(180deg)' : 'rotate(0deg)';
      if (det.open && !reduced) {
        det.querySelectorAll('.tl1-step-in').forEach((el) => {
          el.classList.remove('tl1-step-in'); void el.offsetWidth; el.classList.add('tl1-step-in');
        });
      }
    });
    if (chevron && det.open) chevron.style.transform = 'rotate(180deg)';
  });
};

// Selettore di regime a bassa frizione (un tocco), riusato da "attiva" e "cambia".
window.openTaxRegimePicker = () => {
  const cur = VaultDAO.state.taxRegime;
  window.openModal(`
    <div class="p-1">
      <h3 class="text-lg font-black mb-1">Regime fiscale</h3>
      <p class="text-xs text-[var(--on-surface-secondary)] mb-4">Scegli il tuo: cambia come calcolo imposta e contributi. Puoi modificarlo quando vuoi.</p>
      <div class="space-y-2">
        ${Object.entries(REGIMI).map(([k, v]) => `
          <button onclick="window.setTaxRegime('${k}'); window.closeModal();" class="btn-action w-full justify-between ${k === cur ? 'border-[var(--primary)]' : ''}">
            <span class="text-left">${v.label}${k === cur ? ' · attivo' : ''}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4 shrink-0"><path d="M9 18l6-6-6-6"/></svg>
          </button>`).join('')}
      </div>
      <button onclick="window.closeModal()" class="btn-action w-full justify-center mt-4 text-[var(--on-surface-secondary)]">Chiudi</button>
    </div>`);
};

window.setTaxRegime = (regime) => { VaultDAO.state.taxRegime = regime; VaultDAO.save(); showToast('Regime fiscale impostato.', 'success'); renderTaxSettings(); renderAnalysis(); };
// "Sono dipendente, non mi serve": rispetta la scelta e smette di chiedere,
// ma resta reversibile con un tocco (cambiare lavoro è normale, non un caso
// limite da nascondere per sempre dietro un flag irreversibile).
window.setNoPartitaIva = (val) => {
  VaultDAO.state.noPartitaIva = val;
  VaultDAO.save();
  showToast(val ? 'Va bene — non te lo chiederò più. Puoi sempre riattivarlo da Momentum Vault.' : 'Fatto, te lo mostro di nuovo.', 'info');
  renderTaxSettings();
  renderTax(monthKey(new Date()));
};
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

// ── BONIFICO SEPA on-device: Momentum NON tocca la banca. Prepara il bonifico
// (QR standard EPC + dati copiabili + condivisione) che ESEGUI TU nella tua app
// bancaria, o che invii al cliente perché paghi la fattura in una scansione.
// Universale: dove il QR non è supportato, i dati copiabili funzionano con
// qualsiasi banca. Coerente col design dell'app. ──
window.openSepaTransfer = (d = {}) => {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const name = String(d.name || '').trim();
  const iban = normalizeIBAN(d.iban);
  const amount = +d.amount || 0;
  const remittance = String(d.remittance || '').trim();
  const validIban = isValidIBAN(iban);
  const epc = buildEpcPayload({ name, iban, amount, remittance });
  const fallback = sepaFallbackText({ name, iban, amount, remittance });
  const isRequest = d.mode === 'request';
  const title = d.title || (isRequest ? 'Chiedi il pagamento' : 'Fai il bonifico');
  const sub = isRequest
    ? 'Mostralo o invialo al cliente: paga in una scansione con la sua app bancaria.'
    : 'Apri la tua app della banca e scansiona (o incolla i dati): il bonifico si apre già compilato. Momentum non tocca la banca — confermi tu.';
  let qr = '';
  try { if (validIban && epc.ok) qr = qrSvg(epc.payload, { moduleSize: 5, quiet: 4, dark: '#0b0b0d', light: '#ffffff' }); } catch (_) { qr = ''; }
  openModal(`
    <div class="flex flex-col gap-3 p-3 sm:p-5 lg:p-0">
      <div><h3 class="text-base font-black">${esc(title)}</h3><p class="card-sub !mb-0">${esc(sub)}</p></div>
      ${!validIban ? `<div class="rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-200 text-[12px] px-3 py-2.5">Manca un IBAN valido: aggiungilo nei tuoi dati fiscali per generare il bonifico.</div>` : ''}
      ${qr ? `<div class="mx-auto rounded-2xl bg-white p-2.5" style="width:min(240px,72vw)">${qr}</div>
              <p class="text-[10px] text-center text-[var(--on-surface-secondary)]">QR standard SEPA (EPC). Se la tua app non lo legge, usa i dati qui sotto — funzionano con ogni banca.</p>` : ''}
      <div class="rounded-xl border border-[var(--glass-border)] bg-black/20 p-3 text-[12px] font-mono whitespace-pre-line select-all">${esc(fallback)}</div>
      <button id="sepa-copy" class="btn-action btn-primary w-full py-3 font-bold rounded-xl">Copia i dati del bonifico</button>
      <div class="grid grid-cols-4 gap-2">
        <button id="sepa-wa" class="flex flex-col items-center gap-1 py-2.5 rounded-xl border border-[var(--glass-border)] bg-black/20 text-[10px] font-bold"><svg class="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.6 4.7-1.2A10 10 0 1 0 12 2zm0 2a8 8 0 0 1 0 16 8 8 0 0 1-4.1-1.1l-.3-.2-2.4.6.6-2.3-.2-.3A8 8 0 0 1 12 4zm-2.6 3.4c-.2 0-.5 0-.7.4-.2.4-.9.9-.9 2.1s.9 2.5 1 2.6c.1.2 1.7 2.8 4.3 3.8 2.1.8 2.6.7 3 .6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1 0-.1-.3-.2-.6-.4-.3-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1-.2.3-.6.8-.7.9-.1.2-.3.2-.5.1-.3-.1-1-.4-2-1.2-.7-.7-1.2-1.5-1.4-1.7-.1-.3 0-.4.1-.5l.4-.5c.1-.1.2-.3.2-.4.1-.2 0-.3 0-.4 0-.1-.5-1.3-.7-1.7-.2-.4-.4-.4-.5-.4z"/></svg>WhatsApp</button>
        <button id="sepa-email" class="flex flex-col items-center gap-1 py-2.5 rounded-xl border border-[var(--glass-border)] bg-black/20 text-[10px] font-bold"><svg class="w-5 h-5 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>Email</button>
        <button id="sepa-share" class="flex flex-col items-center gap-1 py-2.5 rounded-xl border border-[var(--glass-border)] bg-black/20 text-[10px] font-bold"><svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>Altro…</button>
        <button id="sepa-copy-iban" class="flex flex-col items-center gap-1 py-2.5 rounded-xl border border-[var(--glass-border)] bg-black/20 text-[10px] font-bold"><svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>IBAN</button>
      </div>
      <p class="text-[11px] text-[var(--on-surface-secondary)] opacity-90">Momentum non invia bonifici né accede al conto: prepara il messaggio e i dati, l'invio e il movimento li fai tu (con la tua autenticazione).</p>
    </div>`);
  // Messaggio pronto (per richiesta pagamento: intro gentile + dati; per bonifico proprio: i dati)
  // Firma sobria Momentum solo per la richiesta TRA AMICI (d.brand), non per le
  // fatture/bonifici professionali (contesto diverso, resta neutro).
  const brandLine = d.brand
    ? `\n\n— conto diviso con Momentum, giusto per tutti${d.momentumLink ? `\nVedi la tua parte 👉 ${d.momentumLink}` : ''}`
    : '';
  const message = isRequest
    ? `Ciao, ecco i dati per il pagamento${remittance ? ` (${remittance})` : ''}:\n\n${fallback}\n\nGrazie!${brandLine}`
    : fallback;
  const subject = isRequest ? `Pagamento${remittance ? ` — ${remittance}` : ''}` : 'Dati bonifico';
  $('#sepa-copy')?.addEventListener('click', () => { navigator.clipboard?.writeText(fallback); showToast('Dati del bonifico copiati.', 'success'); });
  $('#sepa-copy-iban')?.addEventListener('click', () => { navigator.clipboard?.writeText(iban); showToast('IBAN copiato.', 'success'); });
  $('#sepa-wa')?.addEventListener('click', () => { window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener'); });
  $('#sepa-email')?.addEventListener('click', () => { window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`; });
  $('#sepa-share')?.addEventListener('click', async () => {
    try {
      if (navigator.share) await navigator.share({ title, text: message });
      else { navigator.clipboard?.writeText(message); showToast('Messaggio copiato (condivisione non disponibile qui).', 'info'); }
    } catch (e) { /* utente ha annullato */ }
  });
};

// ── DIVIDI UNA SPESA (Splitwise/Settle Up on-device): una videata, semplice per
// chiunque. Quanto, con chi (ricorda le persone di sempre), chi ha pagato → "ognuno
// paga X" + "chi deve cosa a chi" (settlement minimo) + saldo reale via QR/WhatsApp.
// Coerente col design, responsive. 100% on-device, nessun account, nessun paywall. ──
// prefill (additivo, default vuoto): { amount, description } — dallo shortcut
// "Dividi" nel form di aggiunta spesa, così chi ha già digitato importo e nota
// non li ridigita qui (anti-attrito, stesso principio di openPrefilledAdd).
window.openSplitExpense = (prefill = {}) => {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const eur = (n) => `${(+n || 0).toFixed(2).replace('.', ',')} €`;
  const myIban = ((VaultDAO.state.invoiceProfile || {}).fiscale || {}).iban || '';
  const past = VaultDAO.state.splitGroups || [];
  // MODELLO INTUITIVO (feedback utente): due domande separate e chiare, non una
  // sola "chi ha pagato" confusa. (1) CHI HA MESSO QUANTO — per ogni persona un
  // campo €, vuoto = non ha anticipato niente (gestisce più pagatori con importi
  // diversi, non solo un pagante unico). (2) COME SI DIVIDE il conto — equo o a
  // quote diverse (chi ha consumato di più). Il totale è la somma dei versamenti.
  // Persone pre-compilate (es. da un comando vocale "dividi con Marco e Luca"):
  // "Io" c'è sempre e resta in testa; i nomi dettati arrivano già capitalizzati.
  const prePeople = Array.isArray(prefill.people) && prefill.people.length
    ? Array.from(new Set(['Io', ...prefill.people])) : ['Io'];
  const state = {
    description: prefill.description || '',
    people: prePeople,
    paid: prefill.amount > 0 ? { Io: String(prefill.amount) } : {}, // quanto ha messo ciascuno
    splitMode: 'equal',  // 'equal' | 'custom' — come si divide il COSTO
    owed: {},            // per split custom: quanto DEVE (ha consumato) ciascuno
  };
  const inputCls = 'w-full bg-black/30 border border-[var(--glass-border)] rounded-xl px-4 py-3 text-sm min-w-0';
  const num = (v) => parseFloat(String(v ?? '').replace(',', '.')) || 0;
  const paidOf = (p) => num(state.paid[p]);
  const total = () => state.people.reduce((s, p) => s + paidOf(p), 0);
  const owedSum = () => state.people.reduce((s, p) => s + num(state.owed[p]), 0);
  // Il conto è valido se qualcuno ha messo qualcosa e (per split a quote) le
  // quote di consumo tornano al totale.
  const splitValid = () => {
    const t = total(); if (!(t > 0)) return false;
    if (state.splitMode === 'custom') return Math.abs(Math.round((owedSum() - t) * 100) / 100) < 0.01;
    return true;
  };

  const buildGroup = () => {
    let g = createGroup({ name: state.description || 'Spesa', members: state.people });
    const t = total();
    if (!(t > 0) || !splitValid()) return g;
    const idOf = (p) => g.members[state.people.indexOf(p)].id;
    // Frazione di COSTO dovuta da ciascuno (somma 1): equa o dai consumi.
    const owedFrac = {};
    if (state.splitMode === 'custom') state.people.forEach(p => owedFrac[p] = num(state.owed[p]) / t);
    else state.people.forEach(p => owedFrac[p] = 1 / state.people.length);
    // Una spesa per OGNI persona che ha messo qualcosa, ripartita per owedFrac.
    // Sommando tutte: saldo = messo − dovuto (chi ha anticipato di più recupera).
    state.people.forEach(p => {
      const a = Math.round(paidOf(p) * 100) / 100;
      if (a <= 0) return;
      const byId = {}; let acc = 0;
      state.people.forEach(q => { const s = Math.round(a * owedFrac[q] * 100) / 100; byId[idOf(q)] = s; acc += s; });
      // Aggiusta il residuo di arrotondamento sull'ultima persona (somma esatta = a).
      const diff = Math.round((a - acc) * 100) / 100;
      if (Math.abs(diff) >= 0.01) { const last = idOf(state.people[state.people.length - 1]); byId[last] = Math.round((byId[last] + diff) * 100) / 100; }
      g = addSharedExpense(g, { payer: idOf(p), amount: a, description: state.description, shares: { byId } });
    });
    return g;
  };

  // La MIA parte reale (quanto ho consumato) = la somma di quanto devo in tutte
  // le sotto-spese del gruppo costruito. È questa che finisce nelle mie spese.
  const myShareFrom = (g) => {
    const myId = g.members[state.people.indexOf('Io')]?.id;
    return g.expenses.reduce((s, e) => s + (e.owed?.[myId] || 0), 0);
  };

  const render = () => {
    const t = total();
    // PREDITTIVO (proprietario): chi dividi di solito per QUESTO tipo di spesa,
    // in questo giorno — non la sola frequenza. Fallback a frequenza pura.
    const ctx = predictCoSplitters(past, { description: state.description, date: new Date() }).filter(f => !state.people.includes(f.name));
    const freq = (ctx.length ? ctx : frequentCoSplitters(past).filter(f => !state.people.includes(f.name))).slice(0, 4);
    // Posizione netta cross-gruppo con le persone già nel gruppo (il gap di Splitwise).
    const nets = netAcrossGroups(past).filter(n => state.people.includes(n.name));
    // Se con QUESTE persone dividi di solito NON equo (affitto 25/75), lo propongo.
    const sharePred = state.people.length > 1 ? predictShares(past, state.people) : null;
    const canPreview = state.people.length > 1 && splitValid();
    const owedRemaining = Math.round((t - owedSum()) * 100) / 100;
    const perHead = state.people.length ? Math.round((t / state.people.length) * 100) / 100 : 0;
    let settleHtml = '';
    if (canPreview) {
      const g = buildGroup();
      const counts = settlementCounts(g);
      const { transfers } = settlementView(g);
      // PREDITTIVO (proprietario): con che cadenza dividi con ciascuno → per i
      // rimborsi PICCOLI con chi rivedi spesso, consiglio di NON inseguirli:
      // si compensano alla prossima divisione. Nessun concorrente lo fa.
      const intel = settlementIntelligence(past, { date: new Date() });
      // Per ciò che DEVO io: uso il modello entrate (stipendio rilevato/impostato)
      // + il disponibile del mese → dico se posso saldare ORA senza restare a
      // secco, o se conviene dopo il prossimo accredito. Solo Momentum lo sa.
      const salary = resolveSalary(VaultDAO.state, VaultDAO.state.transactions);
      const monthTxsNow = VaultDAO.state.transactions[monthKey(new Date())] || [];
      const spentThisMonth = monthTxsNow.filter(x => x.type === 'uscita').reduce((s, x) => s + (+x.amount || 0), 0);
      const available = VaultDAO.state.monthlyBudget > 0 ? Math.round((VaultDAO.state.monthlyBudget - spentThisMonth) * 100) / 100 : null;
      const payDays = salary ? daysToNextPayday(salary, new Date()) : null;
      const payLabel = salary ? nextPayday(salary, new Date()).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' }) : null;
      settleHtml = transfers.map(tr => {
        const line = tr.toName === 'Io' ? `<b>${esc(tr.fromName)}</b> ti deve <b>${eur(tr.amount)}</b>`
          : tr.fromName === 'Io' ? `Devi <b>${eur(tr.amount)}</b> a <b>${esc(tr.toName)}</b>`
            : `<b>${esc(tr.fromName)}</b> deve ${eur(tr.amount)} a <b>${esc(tr.toName)}</b>`;
        // Consiglio solo per i rimborsi che coinvolgono ME (la mia prospettiva).
        const counter = tr.toName === 'Io' ? tr.fromName : tr.fromName === 'Io' ? tr.toName : null;
        const adv = counter ? settleAdvice(intel, counter, tr.amount) : { tone: 'now' };
        const iOwe = tr.fromName === 'Io';
        // Timing sul MIO debito quando non è il caso "aspetta si compensa".
        let timing = null;
        if (iOwe && adv.tone !== 'wait' && available != null) {
          const st = suggestSettleTiming({ amountDue: tr.amount, currentAvailable: available, nextIncome: (payLabel && salary) ? { date: payLabel } : null });
          if (st.when === 'ora') timing = { txt: 'Puoi saldarlo ora senza restare a secco', tone: 'ok' };
          else if (payLabel) timing = { txt: `Meglio dal ${payLabel}${payDays != null ? ` (tra ${payDays}g, l'accredito)` : ''}`, tone: 'wait' };
          else timing = { txt: 'Meglio quando hai margine', tone: 'wait' };
        }
        const act = adv.tone === 'wait'
          ? `<span class="shrink-0 text-[11px] font-bold text-[var(--primary)]">✨ aspetta</span>`
          : tr.toName === 'Io' ? `<button data-ask="${tr.amount}" data-who="${esc(tr.fromName)}" class="shrink-0 text-[11px] font-bold text-emerald-400 underline">Chiedi</button>`
            : tr.fromName === 'Io' ? `<button data-tellamt="${tr.amount}" data-tellwho="${esc(tr.toName)}" class="shrink-0 text-[11px] font-bold text-[var(--gold)] underline">Avvisa</button>` : '';
        let hint = '';
        if (adv.tone === 'wait') hint = `<div class="text-[10px] text-[var(--primary)] -mt-0.5 mb-1">${esc(adv.label)}</div>`;
        else if (timing) hint = `<div class="text-[10px] -mt-0.5 mb-1 ${timing.tone === 'ok' ? 'text-emerald-400' : 'text-amber-400'}">${esc(timing.txt)}${salary ? ` · <button data-editsalary class="underline">${salary.source === 'manual' ? 'stipendio' : 'è giusto?'}</button>` : ''}</div>`;
        return `<div class="flex items-center justify-between gap-2 py-1.5 text-[13px] text-slate-200">${line}${act}</div>${hint}`;
      }).join('');
      if (counts.saved > 0) settleHtml = `<div class="text-[11px] font-bold text-emerald-300 mb-1">Semplificato: ${counts.simplified} pagament${counts.simplified === 1 ? 'o' : 'i'} invece di ${counts.raw} (${counts.saved} in meno).</div>` + settleHtml;
    }
    openModal(`
      <div class="flex flex-col gap-3 p-3 sm:p-5 lg:p-0">
        <div><h3 class="text-base font-black">Dividi una spesa</h3><p class="card-sub !mb-0">Scrivi una riga, o compila sotto — ti dico io chi deve dare quanto a chi.</p></div>
        <div>
          <input id="sp-oneline" class="${inputCls}" placeholder="Prova: 60 cena io Marco Luca" autocomplete="off" />
          <div class="text-[10px] text-[var(--on-surface-secondary)] mt-1">Importo, per cosa e con chi in una frase. Al resto penso io.</div>
        </div>
        <div class="flex items-center gap-2 text-[10px] text-[var(--on-surface-secondary)]"><span class="flex-1 h-px bg-[var(--glass-border)]"></span>oppure passo per passo<span class="flex-1 h-px bg-[var(--glass-border)]"></span></div>
        <input id="sp-desc" value="${esc(state.description)}" class="${inputCls}" placeholder="Per cosa? (es. Cena, Casa al mare)" />
        ${nets.length ? `<div class="card p-2.5 flex flex-col gap-1">
          <div class="text-[10px] font-bold text-[var(--on-surface-secondary)] uppercase tracking-wide">In totale, con questi amici</div>
          ${nets.map(n => `<div class="flex items-center justify-between text-[12px]"><span>${esc(n.name)}${n.groups > 1 ? ` <span class="opacity-50">(${n.groups} gruppi)</span>` : ''}</span><span class="font-bold ${n.net > 0 ? 'text-emerald-400' : 'text-amber-400'}">${n.net > 0 ? `ti deve ${eur(n.net)}` : `gli devi ${eur(-n.net)}`}</span></div>`).join('')}
        </div>` : ''}

        <!-- 1) CHI HA MESSO QUANTO: un campo € per persona, vuoto = non ha anticipato -->
        <div class="card p-3 flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold text-[var(--on-surface-secondary)]">Chi ha messo quanto</span>
            <span class="text-[11px] font-bold">Totale <span class="font-mono text-emerald-400">${eur(t)}</span></span>
          </div>
          ${state.people.map((p, i) => `<div class="flex items-center gap-2">
            <span class="text-[13px] flex-1 truncate ${p === 'Io' ? 'font-bold' : ''}">${esc(p)}</span>
            <div class="flex items-center gap-1 bg-black/30 border border-[var(--glass-border)] rounded-lg px-2 focus-within:border-[var(--primary)]">
              <input data-paid="${esc(p)}" type="text" inputmode="decimal" value="${esc(state.paid[p] ?? '')}" placeholder="0" class="w-16 bg-transparent py-1.5 text-sm font-mono text-right outline-none" />
              <span class="text-[11px] text-[var(--on-surface-secondary)]">€</span>
            </div>
            ${p !== 'Io' ? `<button data-rm="${i}" class="text-[var(--on-surface-secondary)] opacity-60 hover:opacity-100 w-6 text-center" title="Togli ${esc(p)}">✕</button>` : '<span class="w-6"></span>'}
          </div>`).join('')}
          <div class="flex flex-wrap gap-2 mt-1 items-center">
            ${freq.map(f => `<button data-add="${esc(f.name)}" title="${f.reason ? esc(f.reason) : 'Aggiungi'}" class="text-[11px] px-2.5 py-1 rounded-full border active:scale-95 transition-transform ${f.reason ? 'border-[var(--primary)] text-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_5%,transparent)]' : 'border-dashed border-[var(--glass-border)] text-[var(--on-surface-secondary)]'}">+ ${esc(f.name)}${f.reason ? ' ✨' : ''}</button>`).join('')}
            <input id="sp-newname" class="text-[12px] bg-black/30 border border-[var(--glass-border)] rounded-full px-3 py-1 w-28 min-w-0" placeholder="+ altra persona" />
          </div>
          ${freq.some(f => f.reason) ? `<div class="text-[10px] text-[var(--primary)]">✨ = suggerito dal contesto (${esc(freq.find(f => f.reason).reason)})</div>` : ''}
          <div class="text-[10px] text-[var(--on-surface-secondary)]">Chi non ha anticipato niente? Lascia il suo campo a 0.</div>
        </div>

        <!-- 2) COME SI DIVIDE IL CONTO -->
        <div class="flex flex-col gap-2">
          <span class="text-[11px] font-bold text-[var(--on-surface-secondary)]">Come si divide il conto</span>
          <div class="flex gap-2">
            <button type="button" data-splitmode="equal" class="segment-btn ${state.splitMode === 'equal' ? 'active' : ''}" style="flex:1">In parti uguali</button>
            <button type="button" data-splitmode="custom" class="segment-btn ${state.splitMode === 'custom' ? 'active' : ''}" style="flex:1">Chi ha consumato di più</button>
          </div>
          ${state.splitMode === 'equal' ? `<div class="card p-3 flex items-center justify-between">
            <span class="eyebrow !mb-0"><svg viewBox="0 0 24 24"><circle cx="9" cy="7" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M15 20c0-2 1.5-3.5 4-3.5"/></svg>Ognuno deve</span>
            <span class="font-mono font-black text-lg text-emerald-400">${eur(perHead)}</span>
          </div>` : `<div class="card p-3 flex flex-col gap-2">
            <div class="text-[11px] text-[var(--on-surface-secondary)]">Quanto ha consumato ciascuno (deve tornare al totale ${eur(t)})</div>
            ${sharePred ? `<button id="sp-usepred" class="text-[11px] font-bold text-[var(--primary)] text-left active:scale-95 transition-transform">✨ Usa le quote di sempre (${state.people.map(p => `${esc(p)} ${Math.round((sharePred.shares[p] || 0) * 100)}%`).join(' · ')})</button>` : ''}
            ${state.people.map(p => `<div class="flex items-center gap-2"><span class="text-[13px] flex-1 truncate">${esc(p)}</span><div class="flex items-center gap-1 bg-black/30 border border-[var(--glass-border)] rounded-lg px-2 focus-within:border-[var(--primary)]"><input data-owed="${esc(p)}" type="text" inputmode="decimal" value="${esc(state.owed[p] ?? '')}" placeholder="0" class="w-16 bg-transparent py-1.5 text-sm font-mono text-right outline-none" /><span class="text-[11px] text-[var(--on-surface-secondary)]">€</span></div></div>`).join('')}
            ${t > 0 ? `<div class="text-[11px] font-bold text-right ${Math.abs(owedRemaining) < 0.01 ? 'text-emerald-400' : 'text-amber-400'}">${Math.abs(owedRemaining) < 0.01 ? 'Torna esatto ✓' : owedRemaining > 0 ? `Mancano ${eur(owedRemaining)}` : `${eur(-owedRemaining)} di troppo`}</div>` : ''}
          </div>`}
        </div>

        ${canPreview && settleHtml ? `<div class="card p-3"><div class="text-[10px] font-bold text-[var(--on-surface-secondary)] uppercase tracking-wide mb-1">Chi dà quanto a chi</div>${settleHtml}</div>` : ''}

        <div class="flex gap-2">
          <button id="sp-save" class="btn-action btn-primary flex-1 py-3 font-bold rounded-xl active:scale-[0.98] transition-transform">Salva la divisione</button>
          <button id="sp-share" class="flex-1 py-3 font-bold rounded-xl border border-[var(--glass-border)] bg-black/20 text-sm inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>Invita</button>
        </div>
        <p class="text-[11px] text-[var(--on-surface-secondary)] opacity-90">100% sul tuo telefono, senza account. Invita un amico (anche lontano) con un link: le spese si uniscono senza server. I rimborsi li fai tu (QR, WhatsApp, IBAN) — Momentum non muove soldi.</p>
      </div>`);

    // ── bind: ogni input a testo (type=text) così il ripristino del cursore
    // funziona su Chrome (i number non supportano selectionStart). ──
    const descEl = $('#sp-desc');
    descEl?.addEventListener('input', () => {
      state.description = descEl.value;
      const caret = descEl.selectionStart; render();
      const fresh = $('#sp-desc'); if (fresh) { fresh.focus(); try { fresh.setSelectionRange(caret, caret); } catch (_) {} }
    });
    const oneLine = $('#sp-oneline');
    oneLine?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return; e.preventDefault();
      const parsed = parseSplitLine(oneLine.value);
      if (!parsed) { showToast('Scrivi almeno un importo, es. "60 cena io Marco".', 'error'); return; }
      if (parsed.description) state.description = parsed.description;
      for (const p of parsed.people) if (!state.people.includes(p)) state.people.push(p);
      // Chi scrive di solito è chi ha anticipato: metto il totale su "Io".
      if (parsed.amount > 0) state.paid['Io'] = String(parsed.amount);
      render();
    });
    $('#sp-newname')?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.value.trim()) { const n = e.target.value.trim(); if (!state.people.includes(n)) state.people.push(n); render(); } });
    // Campi "ha messo €" — re-render live (aggiorna totale/anteprima) con cursore.
    document.querySelectorAll('[data-paid]').forEach(inp => inp.addEventListener('input', () => {
      state.paid[inp.dataset.paid] = inp.value;
      const caret = inp.selectionStart; render();
      const fresh = document.querySelector(`[data-paid="${CSS.escape(inp.dataset.paid)}"]`);
      if (fresh) { fresh.focus(); try { fresh.setSelectionRange(caret, caret); } catch (_) {} }
    }));
    // Campi "ha consumato €" (split custom).
    document.querySelectorAll('[data-owed]').forEach(inp => inp.addEventListener('input', () => {
      state.owed[inp.dataset.owed] = inp.value;
      const caret = inp.selectionStart; render();
      const fresh = document.querySelector(`[data-owed="${CSS.escape(inp.dataset.owed)}"]`);
      if (fresh) { fresh.focus(); try { fresh.setSelectionRange(caret, caret); } catch (_) {} }
    }));
    $('#sp-usepred')?.addEventListener('click', () => {
      const t2 = total();
      if (sharePred && t2 > 0) { state.people.forEach(p => { state.owed[p] = (Math.round((sharePred.shares[p] || 0) * t2 * 100) / 100).toFixed(2); }); render(); }
    });
    document.querySelectorAll('[data-splitmode]').forEach(b => b.addEventListener('click', () => { state.splitMode = b.dataset.splitmode; render(); }));
    document.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => { if (!state.people.includes(b.dataset.add)) state.people.push(b.dataset.add); render(); }));
    document.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => { const i = +b.dataset.rm; const removed = state.people[i]; delete state.paid[removed]; delete state.owed[removed]; state.people.splice(i, 1); render(); }));
    document.querySelectorAll('[data-ask]').forEach(b => b.addEventListener('click', () => {
      // Link alla divisione reale (brandizzato Momentum): l'amico apre e vede la
      // sua parte. Generato dal gruppo corrente, distinto dal link "paga qui".
      let mLink = ''; try { mLink = buildJoinLink(encodeGroupShare(buildGroup())); } catch (_) {}
      window.openRequestPayment({ amount: +b.dataset.ask, fromName: b.dataset.who, note: state.description || 'la spesa divisa', momentumLink: mLink });
    }));
    document.querySelectorAll('[data-tellamt]').forEach(b => b.addEventListener('click', async () => {
      const msg = `Ciao ${b.dataset.tellwho}, ti devo ${eur(+b.dataset.tellamt)} per ${state.description || 'la spesa'}. Mandami l'IBAN così ti giro il bonifico!`;
      try { if (navigator.share) await navigator.share({ text: msg }); else { navigator.clipboard?.writeText(msg); showToast('Messaggio copiato.', 'success'); } } catch (_) { }
    }));
    // Correggi/imposta lo stipendio usato per il timing (sempre modificabile).
    $('#modal-body [data-editsalary]')?.addEventListener('click', () => window.openSalaryEditor(() => render()));
    $('#sp-save')?.addEventListener('click', () => {
      if (total() <= 0 || state.people.length < 2) { showToast('Metti almeno un importo e due persone.', 'error'); return; }
      if (!splitValid()) { showToast('Le quote di consumo non tornano al totale.', 'error'); return; }
      const g = buildGroup();
      VaultDAO.state.splitGroups = mergeIntoGroups(VaultDAO.state.splitGroups || [], { ...g, date: new Date().toISOString().slice(0, 10) });
      // La MIA parte reale (quanto ho consumato) come spesa personale + addestra
      // il Core (categoria). learnFromSplit vive nel modulo split, testato.
      const { category, mine } = learnFromSplit(window.momentumOrchestrator, { description: state.description, myShare: myShareFrom(g), date: new Date() });
      const desc = state.description ? `${state.description} (la mia parte)` : 'Spesa condivisa (la mia parte)';
      const res = VaultDAO.addTransaction(monthKey(new Date()), { id: Date.now(), amount: mine, type: 'uscita', category, description: desc, date: new Date().toISOString() });
      try { if (!res.duplicate && window.momentumOrchestrator) window.momentumOrchestrator.learn(desc, category, mine, new Date()); } catch (_) { }
      VaultDAO.save();
      closeModal();
      showToast(`Divisione salvata. La tua parte (${eur(mine)}) è nelle spese.`, 'success');
      renderDashboard(); renderAnalysis({ skipHeavyForecast: true });
    });
    $('#sp-share')?.addEventListener('click', async () => {
      if (total() <= 0 || state.people.length < 2) { showToast('Metti almeno un importo e due persone prima di invitare.', 'error'); return; }
      if (!splitValid()) { showToast('Le quote di consumo non tornano al totale.', 'error'); return; }
      const g = buildGroup();
      VaultDAO.state.splitGroups = mergeIntoGroups(VaultDAO.state.splitGroups || [], { ...g, date: new Date().toISOString().slice(0, 10) });
      VaultDAO.save();
      const p2p = await tryCreateP2POffer();
      _groupInvitePairing = p2p?.pairing || null;
      window.openShareCode({ code: await buildInviteCode(g, p2p?.offer), groupName: g.name, title: `Invita a "${g.name}"`, sub: 'Manda il link: l\'amico lo tocca e Momentum si apre già sul gruppo. Le vostre spese si uniscono, anche da Paesi diversi, senza server.', pairing: _groupInvitePairing });
    });
  };
  render();
};

// ── STIPENDIO: mostra quello capito dai movimenti e lascia correggerlo ───────
// "Momentum capisce da solo quando e quanto prendi" — ma resta tuo: qui vedi il
// giorno e l'importo rilevati (o li imposti se non ci sono abbastanza dati) e
// ── FANTASMI: impegni fissi sottratti dallo stipendio PRIMA della transazione ─
// La domanda che disegna l'ansia di fine mese: "quanto mi resta DAVVERO, tolto
// tutto ciò che è già promesso?". Mutuo, prestiti, affitto, bollette entrano
// come spese "fantasma" — già tolte dallo stipendio anche se non ancora pagate.
// Semplice da capire per chiunque: un numero grande verde = quello che è
// davvero tuo. Onesto: usa i dati che inserisci, e lo dichiara.
// ── LA CURVA DEL MESE (Cassa Unica) ─────────────────────────────────────────
// Una riga sola per l'occhio: dove va il tuo denaro da qui a fine ciclo, con la
// banda prudente/fortunato, il giorno critico se c'è, e UNA leva misurata (non
// un consiglio generico: è ri-simulata, e dice quanti giorni fa guadagnare).
// Tace se il motore non ha abbastanza dati — nessuna curva inventata.
// Sottotitolo integrato: niente più "card dentro la card". `standalone=false`
// toglie intestazione/bordo/percentuale-fiducia (rumore tecnico che un bambino
// non legge) — la curva continua semplicemente il racconto del numero grande.
// La fiducia si dice solo quando è BASSA (poche settimane di dati): quando è
// alta, ripeterla è rumore; quando è bassa, è l'unica cosa onesta da dire.
// Curva morbida (Catmull-Rom → Bézier) invece di segmenti spezzati: la stessa
// serie di punti, ma disegnata come la leggerebbe un'app finanziaria vera —
// continua, senza spigoli che suggeriscano una precisione che i dati non hanno.
function catmullRomPath(points) {
  if (points.length < 2) return `M${points[0]?.x ?? 0},${points[0]?.y ?? 0}`;
  let d = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i], p1 = points[i], p2 = points[i + 1], p3 = points[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6, cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6, cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

// ── ANELLO DI RITMO — sostituisce il volto con un'icona di design coerente ──
// Due corone concentriche, stesso linguaggio degli anelli-obiettivo già usati
// altrove nell'app: la esterna è QUANTO TEMPO del ciclo è passato, l'interna è
// QUANTO hai speso. Se l'interna "supera" l'esterna a colpo d'occhio, stai
// correndo — nessuna parola necessaria, leggibile anche da un bambino.
// Nessun'invenzione: senza `adaptive` (dati insufficienti) non si disegna nulla.
function paceRingHtml(pctSpent, pctTime, [c1, c2]) {
  const size = 64, stroke = 6.5, rOuter = 27, rInner = 18.5;
  const cOuter = 2 * Math.PI * rOuter, cInner = 2 * Math.PI * rInner;
  const offOuter = cOuter * (1 - Math.min(100, pctTime) / 100);
  const offInner = cInner * (1 - Math.min(100, pctSpent) / 100);
  return `
    <svg viewBox="0 0 ${size} ${size}" class="ghost-ring w-14 h-14 shrink-0" aria-hidden="true">
      <defs><linearGradient id="ghostRingGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/>
      </linearGradient></defs>
      <circle cx="${size / 2}" cy="${size / 2}" r="${rOuter}" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="${stroke}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${rInner}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="${stroke}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${rOuter}" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${cOuter.toFixed(1)}" stroke-dashoffset="${offOuter.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${rInner}" fill="none" stroke="url(#ghostRingGrad)" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${cInner.toFixed(1)}" stroke-dashoffset="${offInner.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    </svg>`;
}

// Icone di design coerenti con lo stile stroke dell'app (nessuna emoji).
const ICON_IDEA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="w-3 h-3 inline-block align-[-1px] mr-1"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2.3h6c0-1.1.4-1.8 1-2.3A7 7 0 0 0 12 2z"/></svg>`;
const ICON_CHECK_SM = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" class="w-2.5 h-2.5 inline-block align-[-1px]"><path d="M20 6L9 17l-5-5"/></svg>`;
const ICON_FLAG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="w-3 h-3 inline-block align-[-1px] mr-1"><path d="M4 22V4"/><path d="M4 4h13l-2 4 2 4H4"/></svg>`;

function cashCurveHtml(commitments, salary, { standalone = true, tone = ['#818cf8', '#22d3ee'] } = {}) {
  let f;
  const nowMs = Date.now();
  try {
    const subs = subscriptionSummary(VaultDAO.state.transactions, new Date());
    // Ciò che devo agli amici: scenario a parte (la data la decide l'utente).
    const net = netAcrossGroups(VaultDAO.state.splitGroups || []);
    const owed = Math.abs(Math.min(0, net.reduce((s, p) => s + Math.min(0, p.net), 0)));
    // Le rate BNPL (Klarna/PayPal/Scalapay...) sono eventi certi quanto un
    // impegno dichiarato: entrano nella STESSA riga temporale via il ponte
    // generico extraLedgerEvents, con la lunghezza-piano già appresa da questo
    // utente (mlData.bnplLearned) se disponibile.
    const bnplEvents = bnplToLedgerEvents(VaultDAO.state.transactions,
      { now: nowMs, horizonDays: 30, learned: VaultDAO.state.mlData?.bnplLearned || {}, anticipate: true, dismissed: VaultDAO.state.mlData?.bnplDismissed || [] });
    f = cashForecast({
      allTx: VaultDAO.state.transactions,
      commitments,
      salary,
      subscriptions: (subs.subscriptions || []).map(s => ({ name: s.name, amount: s.amount, nextDate: s.nextDate })),
      splitOwed: owed,
      monthTx: VaultDAO.state.transactions[monthKey(new Date())] || [],
      now: nowMs,
      horizonDays: 30,
      extraLedgerEvents: bnplEvents,
    });
  } catch (_) { return ''; }
  if (!f || !f.known || !f.path?.length) return '';

  const dayName = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const eur = (n) => formatMoney(n);
  const [t1, t2] = tone;

  // "Oggi" è CERTO (nessuna banda): lo aggiungiamo come primo punto vero della
  // curva invece di farla iniziare a mezz'aria — la curva è quindi un racconto
  // completo (da dove sei, a dove puoi arrivare), non un frammento fluttuante.
  const anchor = { date: new Date(nowMs).toISOString().slice(0, 10), p50: f.startBalance, p10: f.startBalance, p90: f.startBalance };
  const pts = [anchor, ...f.path];

  const ys = pts.flatMap(p => [p.p10, p.p90]);
  const min = Math.min(...ys), max = Math.max(...ys);
  const span = (max - min) || 1;
  // Chart PIÙ GRANDE e area piena (non un nastro sottile): l'AREA sotto la
  // linea è il linguaggio che qualunque app di soldi usa (Apple/Revolut) — più
  // pieno = più tranquillo, si legge senza numeri. La banda prudente/fortunato
  // resta ma come guida sottile tratteggiata SOPRA, non come forma a sé che
  // competeva visivamente con l'area piena.
  const W = 100, H = 52, PAD = 4;
  const x = (i) => (i / (pts.length - 1)) * W;
  const y = (v) => PAD + (H - PAD * 2) - ((v - min) / span) * (H - PAD * 2);

  // curve MORBIDE (Catmull-Rom): continue come un'app finanziaria vera, non un
  // elettrocardiogramma di segmenti dritti.
  const medPts = pts.map((p, i) => ({ x: x(i), y: y(p.p50) }));
  const lineD = catmullRomPath(medPts);
  const topGuideD = catmullRomPath(pts.map((p, i) => ({ x: x(i), y: y(p.p90) })));
  const botGuideD = catmullRomPath(pts.map((p, i) => ({ x: x(i), y: y(p.p10) })));
  // area piena: dalla linea mediana fino al fondo del grafico.
  const areaD = `${lineD} L${x(pts.length - 1).toFixed(2)},${(H - PAD).toFixed(2)} L${x(0).toFixed(2)},${(H - PAD).toFixed(2)} Z`;

  // MARCATORI reali sulla curva invece di doverli leggere in una frase: dove
  // sei OGGI, dove la curva GIRA (arriva lo stipendio), e il punto più STRETTO.
  const valle = f.lowest && f.lowest.value < Math.min(0, f.end.p50) - 20 ? f.lowest : null;
  // il prossimo stipendio è un evento nel ledger (cashForecast non espone un
  // campo `payday` proprio — quello vive nell'altro forecast, commitmentForecast).
  const payday = f.ledger.find(e => e.kind === 'stipendio');
  const paydayIdx = payday ? pts.findIndex(p => p.date === payday.date) : -1;
  let valleIdx = valle ? pts.findIndex(p => p.date === valle.date) : -1;
  // Niente pillole a scontrarsi: se la valle è troppo vicina a "oggi" (poco
  // spazio per l'etichetta) o coincide col giorno stipendio (il punto di svolta
  // È già segnato da quel marcatore), non si duplica — l'informazione resta
  // comunque nella frase sopra il grafico.
  if (valleIdx >= 0 && (valleIdx <= 1 || Math.abs(valleIdx - paydayIdx) <= 1)) valleIdx = -1;
  // posizioni in PERCENTUALE (W=100 e H coincidono con lo spazio del
  // contenitore grazie a preserveAspectRatio="none"): le etichette-pillola
  // fuori dall'SVG si posizionano con le STESSE coordinate, senza conversioni.
  const xPct = (i) => x(i);
  const yPct = (i) => (y(pts[i].p50) / H) * 100;

  // La leva si mostra solo se serve DAVVERO: quando c'è un giorno critico da
  // spostare (e lo sposta), o quando è un'indicazione di tempistica. Senza
  // rischio in vista, un "spendi il 20% in meno" è rumore — un focus per volta.
  const lever = f.levers.find(l => (f.riskDay && l.daysGained > 0) || l.note);

  // ONESTÀ: senza sapere quanto hai in banca, "scendi sotto zero" non è dicibile
  // — la previsione è RELATIVA a oggi. Allora si dice ciò che è vero comunque:
  // dove sarai a fine finestra, e QUANDO passi dal punto più basso (la valle,
  // quasi sempre il giorno prima dell'accredito) — è quello il momento stretto.
  const testa = !f.relative && f.riskDay
    ? `<span class="text-amber-300 font-bold">Attenzione al ${dayName(f.riskDay.date)}</span> <span class="text-[var(--on-surface-secondary)]">· nello scenario prudente lì tocchi il fondo</span>`
    : f.relative
      ? `<span class="${f.end.p50 >= 0 ? 'text-emerald-400' : 'text-amber-300'} font-bold">${f.end.p50 >= 0 ? '+' : ''}${eur(f.end.p50)}</span> <span class="text-[var(--on-surface-secondary)]">rispetto a oggi entro il ${dayName(f.end.date)}${valle ? ` · il momento più stretto è il ${dayName(valle.date)}` : ''}</span>`
      : `<span class="text-emerald-400 font-bold">Nessun giorno critico</span> <span class="text-[var(--on-surface-secondary)]">fino al ${dayName(f.end.date)}</span>`;

  // La fiducia si dice solo se bassa: sopra il 70% è rumore, sotto è l'unica
  // cosa onesta da dire ("sto ancora imparando le tue abitudini").
  const lowConfidence = (f.confidence || 0) < 0.7
    ? `<p class="text-[11px] text-[var(--on-surface-secondary)] opacity-80 mt-1">Sto ancora imparando le tue abitudini: più giorni importi, più questa stima diventa precisa.</p>` : '';

  const wrapOpen = standalone ? `<div class="mt-3 pt-3 border-t border-[var(--glass-border)]">` : `<div class="mt-2.5">`;
  return `
    ${wrapOpen}
      <p class="text-[11.5px] leading-snug mb-2">${testa}</p>
      <!-- due livelli: l'ESTERNO dà sfondo e respiro alle pillole che sporgono
           sopra/sotto la curva; l'INTERNO è stretto sull'SVG, così le
           percentuali di posizione delle pillole (calcolate su W/H dell'SVG)
           corrispondono esattamente ai suoi pixel, senza sfasamenti col padding. -->
      <div class="ghost-curve-wrap rounded-xl bg-black/15 pt-7 pb-5 px-0.5">
        <div class="relative">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="w-full h-24 ghost-curve-svg" aria-hidden="true">
          <defs>
            <linearGradient id="ghostAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${t1}" stop-opacity="0.5"/>
              <stop offset="100%" stop-color="${t1}" stop-opacity="0.02"/>
            </linearGradient>
            <linearGradient id="ghostLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="${t1}"/><stop offset="100%" stop-color="${t2}"/>
            </linearGradient>
          </defs>
          <path d="${topGuideD}" fill="none" stroke="currentColor" stroke-width="0.3" opacity="0.22" stroke-dasharray="1.4 1.8" vector-effect="non-scaling-stroke"/>
          <path d="${botGuideD}" fill="none" stroke="currentColor" stroke-width="0.3" opacity="0.22" stroke-dasharray="1.4 1.8" vector-effect="non-scaling-stroke"/>
          ${paydayIdx > 0 ? `<line x1="${x(paydayIdx).toFixed(1)}" y1="${PAD}" x2="${x(paydayIdx).toFixed(1)}" y2="${(H - PAD).toFixed(1)}" stroke="#34d399" stroke-width="0.35" opacity="0.4" stroke-dasharray="1 1.6"/>` : ''}
          <path d="${areaD}" fill="url(#ghostAreaGrad)"/>
          <path d="${lineD}" fill="none" stroke="url(#ghostLineGrad)" stroke-width="1.8" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round" class="ghost-curve-line"/>
          <circle cx="${x(0).toFixed(1)}" cy="${y(pts[0].p50).toFixed(1)}" r="1.6" fill="var(--on-surface)"/>
          ${valleIdx > 0 ? `<circle cx="${x(valleIdx).toFixed(1)}" cy="${y(pts[valleIdx].p50).toFixed(1)}" r="1.8" fill="#fbbf24" class="ghost-curve-dot"/>` : ''}
          ${paydayIdx > 0 ? `<circle cx="${x(paydayIdx).toFixed(1)}" cy="${y(pts[paydayIdx].p50).toFixed(1)}" r="1.8" fill="#34d399" class="ghost-curve-dot"/>` : ''}
        </svg>
        <!-- etichette-pillola posizionate SULLA curva, non in una riga a parte:
             si legge dove succede la cosa, non un legenda da decifrare. -->
        <span class="absolute -bottom-1 text-[8.5px] font-bold text-[var(--on-surface-secondary)] opacity-70" style="left:${xPct(0)}%">oggi</span>
        <span class="absolute -bottom-1 -translate-x-full text-[8.5px] font-bold text-[var(--on-surface-secondary)] opacity-70" style="left:${xPct(pts.length - 1)}%">${dayName(f.end.date)}</span>
        ${paydayIdx > 0 ? `<span class="absolute -translate-x-1/2 text-[8.5px] font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-full whitespace-nowrap" style="left:${xPct(paydayIdx)}%; top:${Math.max(0, yPct(paydayIdx) - 22)}%">stipendio</span>` : ''}
        ${valleIdx > 0 ? `<span class="absolute -translate-x-1/2 text-[8.5px] font-bold text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded-full whitespace-nowrap" style="left:${xPct(valleIdx)}%; top:${Math.min(78, yPct(valleIdx) + 8)}%">più stretto</span>` : ''}
        </div>
      </div>
      ${lever ? `<p class="text-[10.5px] mt-2 text-[var(--primary)]">${ICON_IDEA}${lever.label}${lever.daysGained > 0 ? `: guadagni <b>${lever.daysGained} giorn${lever.daysGained === 1 ? 'o' : 'i'}</b> di respiro` : lever.note ? ` — ${lever.note}` : ''}.</p>` : ''}
      ${f.withSplit ? `<p class="text-[10px] text-[var(--on-surface-secondary)] mt-1">Se saldi subito i ${eur(f.withSplit.owed)} delle divisioni, chiudi a ${eur(f.withSplit.endP50)}.</p>` : ''}
      ${lowConfidence}
      <details class="ghost-details mt-1">
        <summary class="text-[11px] text-[var(--on-surface-secondary)] opacity-70 cursor-pointer list-none min-h-[24px] inline-block">Cosa vuol dire il tratteggio?</summary>
        <p class="text-[11px] text-[var(--on-surface-secondary)] opacity-80 mt-1">La linea piena è lo scenario più probabile. Le due guide tratteggiate sopra e sotto vanno da prudente (<b>${eur(f.end.p10)}</b>) a fortunato (<b>${eur(f.end.p90)}</b>) al ${dayName(f.end.date)}: sono i due estremi ragionevoli, non un errore.</p>
      </details>
    </div>`;
}

function renderGhostForecast() {
  const el = document.getElementById('ghost-forecast');
  if (!el) return;
  const rawCommitments = VaultDAO.state.fixedCommitments || [];
  const salary = resolveSalary(VaultDAO.state, VaultDAO.state.transactions);
  // Mostra la card solo se c'è qualcosa da dire (stipendio noto o impegni definiti).
  if (!salary && !rawCommitments.length) { el.classList.add('hidden'); el.innerHTML = ''; return; }
  // AUTO-ADDESTRAMENTO: ogni impegno impara la media dei suoi pagamenti reali
  // passati (es. bolletta variabile) e la usa al posto del numero digitato.
  // AUTO-ADDESTRAMENTO TRASVERSALE: gli impegni dichiarati sono il segnale più
  // pulito che l'utente possa dare (quella riga si ripeterà, con quel nome). Se i
  // suoi pagamenti passati sono archiviati in una categoria coerente, quella
  // coppia esercente→categoria diventa un'etichetta ad alta confidenza per il
  // Core: il prossimo import con la stessa insegna si categorizza da solo.
  // Ogni etichetta si insegna UNA volta (impronta nel vault, campo additivo).
  try {
    const ml = VaultDAO.state.mlData;
    const r = trainCommitments(window.momentumOrchestrator, rawCommitments,
      VaultDAO.state.transactions, { seen: ml.commitmentLabels || [] });
    if (r.taught.length) { ml.commitmentLabels = r.seen; VaultDAO.save(); }
  } catch (_) {}
  // AUTO-ADDESTRAMENTO BNPL: ogni piano Klarna/PayPal/Scalapay CHIUSO insegna
  // la sua vera lunghezza per quel provider (src/predict/bnpl.js) — il prossimo
  // piano dello stesso provider proietta le rate residue sull'appreso invece
  // che sullo standard di settore. Serve un 2° piano chiuso prima di fidarsi
  // (un solo campione potrebbe essere un caso anomalo).
  try {
    const ml = VaultDAO.state.mlData;
    const bnplSeries = detectBnplSeries(VaultDAO.state.transactions, { now: Date.now() });
    const r = learnPlanLengths(bnplSeries, ml.bnplLearned || {}, { now: Date.now(), seen: ml.bnplLearnedSeen || [] });
    if (r.taught.length) { ml.bnplLearned = r.learned; ml.bnplLearnedSeen = r.seen; VaultDAO.save(); }
  } catch (_) {}
  // Gli impegni portano con sé la loro banda di normalità MISURATA: il forecast
  // allarga la banda dove l'importo è davvero incerto (bolletta), non dove è fisso.
  const commitments = enrichWithNormality(rawCommitments, VaultDAO.state.transactions);
  // Transazioni del mese corrente → riconciliazione: ciò che è GIÀ stato pagato
  // (import CSV/estratto) non è più un fantasma, così non lo contiamo due volte.
  const monthTx = VaultDAO.state.transactions[monthKey(new Date())] || [];
  const f = commitmentForecast(commitments, salary, { now: Date.now(), monthTx });
  const eur = (n) => formatMoney(n);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const stip = salary && salary.amount ? salary.amount : null;
  const ghosts = f.pendingGhostTotal;            // solo i fantasmi ANCORA da pagare
  const real = stip !== null ? Math.max(0, Math.round((stip - ghosts) * 100) / 100) : null;
  const pctGhost = stip ? Math.min(100, Math.round((ghosts / stip) * 100)) : 0;
  const paidIds = new Set(f.paid.map(c => c.id));

  let anyLearned = false;
  const ghostChips = commitments.filter(c => +c.amount > 0).slice(0, 6).map(c => {
    const rem = remainingInstallments(c, Date.now());
    const tail = rem !== null ? ` · ${rem} rate` : '';
    const done = paidIds.has(c.id);
    if (c.learned) anyLearned = true;
    // "~" davanti a un importo appreso dalla media reale (es. bolletta variabile).
    const amt = `${c.learned ? '~' : ''}${eur(c.amount)}`;
    // un impegno già materializzato nel mese si mostra spuntato (già contato per davvero).
    return `<span class="text-[10px] px-2 py-0.5 rounded-full ${done ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-black/25 border-[var(--glass-border)]'} border whitespace-nowrap">${done ? ICON_CHECK_SM + ' ' : ''}${esc(c.name.length > 16 ? c.name.slice(0, 15) + '…' : c.name)} · ${amt}${done ? '' : tail}</span>`;
  }).join('');
  const paidNote = f.paidTotal > 0 ? `<p class="text-[10.5px] text-emerald-400/90 mt-1.5">${ICON_CHECK_SM} Già pagati questo mese: ${eur(f.paidTotal)} (non più contati come fantasmi).</p>` : '';
  const learnNote = anyLearned ? `<p class="text-[10px] text-[color-mix(in_srgb,var(--primary)_80%,transparent)] mt-1.5">Gli importi con “~” sono la media dei tuoi pagamenti reali passati: più mesi importi, più diventano precisi.</p>` : '';

  const endingMsg = f.endingSoon.length
    ? `<p class="text-[10.5px] text-emerald-400/90 mt-2">${ICON_FLAG}Quasi finito: ${f.endingSoon.slice(0, 2).map(e => `${esc(e.name)} (${e.remaining} rate, chiude ${e.payoff})`).join(' · ')}</p>` : '';

  // ── UN SOLO FUOCO: "quanto posso spendere oggi senza rovinare il mese?" ────
  // Tutto il resto (impegni, totali, spiegazioni) sta sotto, a scomparsa. La
  // card risponde a una domanda sola, con una frase che capirebbe un bambino:
  // «Oggi puoi spendere 49 €. Poi ti pagano fra 17 giorni.»
  const adaptive = cycleAllowance(commitments, salary, { now: Date.now(), allTx: VaultDAO.state.transactions });
  const a = adaptive || f.allowance;
  const days = a ? (a.daysLeft ?? a.daysToNext) : null;
  const oggi = a ? a.perDay : null;
  // Ritmo: mai un rimprovero. Verde = tranquillo, ambra = attenzione, e sempre
  // una via d'uscita ("puoi rimetterti in pari così") — anti-abbandono.
  const pace = adaptive ? adaptive.pace : null;
  const paceTone = !adaptive ? 'calm' : adaptive.onTrack ? 'calm' : pace === 'oltre il ritmo' ? 'warn' : 'soft';
  const toneColor = { calm: 'text-emerald-400', soft: 'text-amber-300', warn: 'text-amber-400' }[paceTone];
  const toneHex = { calm: ['#34d399', '#5eead4'], soft: ['#fcd34d', '#fdba74'], warn: ['#fbbf24', '#fb7185'] }[paceTone];
  const toneBorder = { calm: 'border-emerald-500/25', soft: 'border-amber-500/25', warn: 'border-amber-500/35' }[paceTone];
  // quanto del ciclo è già passato / già speso: due corone concentriche invece
  // di una barra + tacca — lo stesso dato, ma come ICONA DI DESIGN (l'anello
  // esterno = tempo passato, l'interno = quanto speso) invece di un'emoji o
  // di testo da leggere. Nessuna invenzione: senza `adaptive` l'anello non si
  // disegna (mostreremmo un dato non misurato).
  const pctSpent = adaptive && adaptive.budget > 0 ? Math.min(100, Math.round((adaptive.spent / adaptive.budget) * 100)) : 0;
  const pctTime = adaptive && adaptive.cycleLen > 0 ? Math.min(100, Math.round((adaptive.daysElapsed / adaptive.cycleLen) * 100)) : 0;
  const ringHtml = adaptive ? paceRingHtml(pctSpent, pctTime, toneHex) : '';

  const paceLine = adaptive
    ? (adaptive.onTrack
      ? `<b class="${toneColor}">Stai andando bene.</b> <span class="text-[var(--on-surface-secondary)]">Hai speso ${eur(adaptive.spent)} dei ${eur(adaptive.budget)} liberi.</span>`
      : `<b class="${toneColor}">Stai correndo un po'.</b> <span class="text-[var(--on-surface-secondary)]">Hai speso ${eur(adaptive.spent)} dei ${eur(adaptive.budget)} liberi: con ${eur(oggi)} al giorno arrivi comunque in fondo.</span>`)
    : `<span class="text-[var(--on-surface-secondary)]">Tolti gli impegni fissi, questo è ciò che resta da qui allo stipendio.</span>`;

  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="ghost-card rounded-2xl border ${oggi !== null ? toneBorder : 'border-[var(--glass-border)]'} bg-[color-mix(in_srgb,var(--surface-elevated)_40%,transparent)] p-4">
      <div class="flex items-center justify-between gap-2 mb-3">
        <span class="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--on-surface-secondary)]"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><rect x="3.5" y="4.5" width="17" height="16" rx="2"/><path d="M3.5 9.5h17M8 3v3M16 3v3M9 14l2 2 4-4"/></svg>Il tuo mese, senza sorprese</span>
        <button id="ghost-manage" class="text-[11px] font-bold text-[var(--primary)] px-2 py-1 -mr-1 rounded-lg min-h-[32px]">Gestisci</button>
      </div>

      ${oggi !== null ? `
        <!-- IL NUMERO: uno solo, grande, accanto all'anello di ritmo. Il colore
             e il riempimento delle corone si leggono prima ancora del numero. -->
        <div class="flex items-center justify-center gap-3">
          ${ringHtml}
          <div class="text-left">
            <div class="text-[11px] text-[var(--on-surface-secondary)] mb-0.5">Oggi puoi spendere</div>
            <div class="ghost-hero font-mono font-black text-[2.4rem] leading-none ${toneColor}">${eur(oggi)}</div>
          </div>
        </div>
        <div class="text-[11.5px] text-[var(--on-surface-secondary)] text-center mt-1.5">${days === 1 ? 'Domani ti pagano.' : `Poi ti pagano fra <b class="text-[var(--on-surface)]">${days} giorni</b>.`}</div>
        ${adaptive ? `<div class="flex items-center justify-center gap-3 mt-1.5 text-[11px] text-[var(--on-surface-secondary)]">
          <span class="inline-flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-full" style="background:linear-gradient(135deg,${toneHex[0]},${toneHex[1]})"></span>quanto hai speso</span>
          <span class="inline-flex items-center gap-1"><span class="inline-block w-2 h-2 rounded-full bg-white/60"></span>a che punto è il mese</span>
        </div>` : ''}
        <p class="text-[10.5px] mt-2 leading-snug text-center">${paceLine}</p>
        ${a.perWeek ? `<p class="text-[10px] text-[var(--on-surface-secondary)] mt-1 text-center">Se preferisci ragionare a settimane: <b class="text-[var(--on-surface)]">${eur(a.perWeek)}</b>.</p>` : ''}
      ` : stip !== null ? `
        <div class="text-center">
          <div class="text-[11px] text-[var(--on-surface-secondary)] mb-0.5">Ti resta davvero questo mese</div>
          <div class="ghost-hero font-mono font-black text-[2.4rem] leading-none text-emerald-400">${eur(real)}</div>
          <div class="text-[11px] text-[var(--on-surface-secondary)] mt-1">stipendio ${eur(stip)} − impegni ${eur(ghosts)}</div>
        </div>
        <div class="h-2.5 rounded-full bg-emerald-500/25 overflow-hidden mt-3"><div class="ghost-bar h-full bg-amber-400/70" style="width:${pctGhost}%"></div></div>
      ` : `
        <!-- COLD START: niente stipendio noto. Una domanda sola, un tocco. -->
        <div class="text-center py-1">
          <div class="text-[13px] font-bold mb-1">Ogni mese se ne vanno ${eur(ghosts)} da soli.</div>
          <p class="text-[11.5px] text-[var(--on-surface-secondary)] mb-2.5">Dimmi quando ti pagano e ti dico quanto puoi spendere ogni giorno, senza pensarci.</p>
          <button id="ghost-setup-salary" class="w-full min-h-[44px] rounded-xl font-bold text-[13px] text-white" style="background:var(--apex-gradient)">Quando ti pagano?</button>
        </div>
      `}

      ${cashCurveHtml(commitments, salary, { standalone: false, tone: oggi !== null ? toneHex : undefined })}

      <!-- TUTTO IL RESTO A SCOMPARSA: c'è, ma non pesa sull'occhio -->
      <details class="ghost-details mt-3 group">
        <summary class="flex items-center justify-between gap-2 cursor-pointer list-none min-h-[36px] text-[11.5px] font-bold text-[var(--on-surface-secondary)]">
          <span class="inline-flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" class="w-3.5 h-3.5 transition-transform group-open:rotate-90"><path d="M9 6l6 6-6 6"/></svg>
            Cosa se ne va da solo
          </span>
          <span class="font-mono text-amber-300">${eur(f.monthlyFixedTotal)}/mese</span>
        </summary>
        <div class="pt-2">
          ${ghostChips ? `<div class="flex flex-wrap gap-1.5">${ghostChips}</div>` : `<p class="text-[11px] text-[var(--on-surface-secondary)]">Non hai ancora scritto cosa paghi ogni mese.</p>`}
          ${f.payday && f.dueBeforePaydayTotal > 0 ? `<p class="text-[10.5px] text-[var(--on-surface-secondary)] mt-2">Prima dello stipendio devi ancora coprire <b class="text-amber-300">${eur(f.dueBeforePaydayTotal)}</b>.</p>` : ''}
          ${paidNote}
          ${learnNote}
          ${endingMsg}
          <p class="text-[11px] text-[var(--on-surface-secondary)] mt-2 opacity-75">Sono stime dai tuoi impegni, non certezze. Gli impegni sono soldi già promessi: tienili da parte.</p>
        </div>
      </details>
    </div>`;
  document.getElementById('ghost-manage')?.addEventListener('click', () => openCommitmentsManager(renderDashboard));
  document.getElementById('ghost-setup-salary')?.addEventListener('click', () => window.openSalaryEditor?.(renderDashboard));
}

// Gestore impegni fissi (mutuo, prestiti, affitto, bollette): CRUD semplice su
// VaultDAO.state.fixedCommitments (campo additivo). Un mutuo/prestito può avere
// una durata (rate) → l'app sa quando finisce. Collega anche l'editor stipendio.
window.openCommitmentsManager = (onDone = null) => {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const eur = (n) => `${(+n || 0).toFixed(2).replace('.', ',')} €`;
  const list = () => VaultDAO.state.fixedCommitments || [];
  const KINDS = [['affitto', 'Affitto'], ['mutuo', 'Mutuo'], ['prestito', 'Prestito'], ['bolletta', 'Bolletta'], ['abbonamento', 'Abbonamento']];
  const salary = resolveSalary(VaultDAO.state, VaultDAO.state.transactions);

  const render = () => {
    const rows = list().map(c => {
      const rem = remainingInstallments(c, Date.now());
      const sub = rem !== null ? `giorno ${c.dayOfMonth} · ${rem} rate rimaste · chiude ${payoffDate(c)}` : `giorno ${c.dayOfMonth} · ricorrente`;
      return `<div class="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-[var(--glass-border)] bg-black/20">
        <button data-edit="${c.id}" class="min-w-0 text-left flex-1"><span class="font-bold text-[13px] block truncate">${esc(c.name)} <span class="text-[10px] text-[var(--primary)] opacity-80">modifica</span></span><span class="text-[10.5px] text-[var(--on-surface-secondary)]">${sub}</span></button>
        <span class="flex items-center gap-2 shrink-0"><span class="font-mono font-black text-[13px] text-amber-300">${eur(c.amount)}</span><button data-del="${c.id}" class="text-[11px] text-[var(--red)] opacity-70">✕</button></span>
      </div>`;
    }).join('');
    openModal(`
      <div class="flex flex-col gap-3 p-3 sm:p-5 lg:p-0">
        <div>
          <p class="eyebrow !mb-0 text-[var(--primary)]">Impegni fissi</p>
          <h3 class="text-base font-black">Mutuo, prestiti, affitto, bollette</h3>
          <p class="card-sub !mb-0">Li tolgo dallo stipendio come "fantasmi": vedi subito quanto ti resta davvero. Per mutuo e prestiti dimmi le rate e so anche quando finiscono.</p>
        </div>
        <button id="fc-salary" class="card p-3 text-left flex items-center justify-between">
          <span class="text-[13px] font-bold">Il tuo stipendio</span>
          <span class="text-[12px] text-${salary ? 'emerald-400' : 'amber-300'} font-mono">${salary ? `${eur(salary.amount)} il ${salary.dayOfMonth}` : 'da impostare ›'}</span>
        </button>
        ${rows || '<p class="text-[12px] text-[var(--on-surface-secondary)]">Nessun impegno ancora. Aggiungine uno qui sotto.</p>'}
        <div class="card p-3 flex flex-col gap-2">
          <div class="eyebrow !mb-0"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Aggiungi un impegno</div>
          <div class="flex flex-wrap gap-1.5" id="fc-kinds">${KINDS.map((k, i) => `<button data-kind="${k[0]}" class="text-[11px] font-bold px-2.5 py-1.5 rounded-full border ${i === 0 ? 'border-[var(--gold)] text-[var(--gold)]' : 'border-[var(--glass-border)] text-[var(--on-surface-secondary)]'} bg-black/20">${k[1]}</button>`).join('')}</div>
          <input id="fc-name" placeholder="Nome (es. Mutuo casa)" class="bg-black/30 border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm" />
          <div class="flex gap-2">
            <input id="fc-amt" inputmode="decimal" placeholder="Importo €" class="flex-1 min-w-0 bg-black/30 border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm font-mono" />
            <input id="fc-day" inputmode="numeric" placeholder="Giorno" class="w-24 bg-black/30 border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm font-mono" />
          </div>
          <div id="fc-term-wrap" class="hidden flex gap-2">
            <input id="fc-start" type="date" class="flex-1 min-w-0 bg-black/30 border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-[13px] font-mono" />
            <input id="fc-months" inputmode="numeric" placeholder="Rate totali" class="w-28 bg-black/30 border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm font-mono" />
          </div>
          <button id="fc-add" class="btn-action btn-primary w-full py-2.5 font-bold rounded-xl">Aggiungi</button>
        </div>
      </div>`);

    let kind = 'affitto';
    let editingId = null;
    const syncTerm = () => document.getElementById('fc-term-wrap').classList.toggle('hidden', !(kind === 'mutuo' || kind === 'prestito'));
    const selectKind = (k) => {
      kind = k;
      document.querySelectorAll('#fc-kinds [data-kind]').forEach(x => { x.className = x.className.replace(/border-\[var\(--gold\)\] text-\[var\(--gold\)\]/, 'border-[var(--glass-border)] text-[var(--on-surface-secondary)]'); if (x.dataset.kind === k) x.className = x.className.replace('border-[var(--glass-border)] text-[var(--on-surface-secondary)]', 'border-[var(--gold)] text-[var(--gold)]'); });
      syncTerm();
    };
    // Modifica: precarica i valori dell'impegno nel form (importi cambiati,
    // giorno diverso, ecc.) e trasforma "Aggiungi" in salvataggio della modifica.
    document.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
      const c = list().find(x => x.id === b.dataset.edit);
      if (!c) return;
      editingId = c.id;
      document.getElementById('fc-name').value = c.name;
      document.getElementById('fc-amt').value = c.amount;
      document.getElementById('fc-day').value = c.dayOfMonth;
      selectKind(c.kind || 'affitto');
      if (c.startDate) document.getElementById('fc-start').value = c.startDate;
      if (c.termMonths) document.getElementById('fc-months').value = c.termMonths;
      const addBtn = document.getElementById('fc-add'); if (addBtn) addBtn.textContent = 'Salva modifiche';
      document.getElementById('fc-name').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }));
    document.querySelectorAll('#fc-kinds [data-kind]').forEach(b => b.addEventListener('click', () => selectKind(b.dataset.kind)));
    document.getElementById('fc-salary')?.addEventListener('click', () => openSalaryEditor(() => openCommitmentsManager(onDone)));
    document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      VaultDAO.state.fixedCommitments = list().filter(c => c.id !== b.dataset.del);
      VaultDAO.save(); render();
    }));
    document.getElementById('fc-add')?.addEventListener('click', () => {
      const name = String(document.getElementById('fc-name').value).trim();
      const amt = parseFloat(String(document.getElementById('fc-amt').value).replace(',', '.'));
      const day = parseInt(String(document.getElementById('fc-day').value).replace(/\D/g, ''), 10);
      if (!name || !(amt > 0) || !(day >= 1 && day <= 31)) { showToast('Metti nome, importo e giorno (1–31).', 'error'); return; }
      const c = { id: editingId || ('fc_' + Date.now().toString(36)), name, amount: Math.round(amt * 100) / 100, dayOfMonth: day, kind };
      if (kind === 'mutuo' || kind === 'prestito') {
        const start = document.getElementById('fc-start').value;
        const months = parseInt(String(document.getElementById('fc-months').value).replace(/\D/g, ''), 10);
        if (start && months > 0) { c.startDate = start; c.termMonths = months; }
      }
      // modifica in-place (stesso id) o aggiunta; l'edit preserva la posizione.
      VaultDAO.state.fixedCommitments = editingId
        ? list().map(x => x.id === editingId ? c : x)
        : [...list(), c];
      VaultDAO.save(); haptic('medium');
      showToast(editingId ? `"${name}" aggiornato.` : `"${name}" aggiunto: ${eur(amt)} il giorno ${day}.`, 'success');
      editingId = null;
      render();
    });
  };
  render();
  const origClose = window.closeModal;
  // quando l'utente chiude il gestore, ridisegna la dashboard (fantasmi aggiornati)
  window.closeModal = function () { origClose(); if (onDone) onDone(); window.closeModal = origClose; };
};

// ── CHIAVE PERSONALE PER PREZZI LIVE (Alpha Vantage, opzionale) ─────────────
// Vive solo in VaultDAO.state.liveDataKeys (locale, cifrato come tutto il
// resto del vault): nessun server Momentum esiste a cui inviarla. Le cripto
// non ne hanno bisogno (CoinGecko è aperto); azioni/indici sì, perché
// Yahoo/Stooq bloccano le chiamate dirette dal browser (verificato CORS).
// Un pallino verde/grigio invece di un paragrafo che appariva SOLO a chiave
// già salvata (altrimenti restava vuoto — nessun modo di capire a colpo
// d'occhio quali dei 5 provider mancano ancora di essere configurati).
function renderKeyStatusDot(elId, provider) {
  const el = document.getElementById(elId);
  if (!el) return;
  const key = VaultDAO.state.liveDataKeys?.[provider];
  el.innerHTML = key
    ? `<span class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1"></span>Chiave salvata (${maskKey(key)}). Tocca "Guida" per cambiarla.`
    : `<span class="inline-block w-1.5 h-1.5 rounded-full bg-slate-600 mr-1"></span>Non ancora configurata.`;
}
window.saveLiveDataKey = (provider) => {
  const input = document.getElementById(`${provider}-key-input`);
  // Ogni provider ha il proprio elemento di stato (alphavantage usa
  // #live-price-status per compatibilità con testi/markup esistenti,
  // gli altri usano #{provider}-status) — bug potenziale evitato: prima
  // avrebbe sempre scritto sullo stato di Alpha Vantage a prescindere.
  const status = document.getElementById(provider === 'alphavantage' ? 'live-price-status' : `${provider}-status`);
  const value = (input?.value || '').trim();
  if (!value) { showToast('Incolla prima la tua chiave.', 'error'); return; }
  VaultDAO.state.liveDataKeys = { ...(VaultDAO.state.liveDataKeys || {}), [provider]: value };
  VaultDAO.save();
  if (input) input.value = '';
  if (status) status.innerHTML = '<span class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1"></span>Chiave salvata su questo dispositivo. I prezzi si aggiorneranno in background.';
  showToast('Chiave salvata.', 'success');
  try { window.idleFetchPrices && window.idleFetchPrices(); } catch (_) {}
};

// ── GUIDA PASSO-PASSO PER LE CHIAVI GRATUITE (abbattere l'attrito) ──────────
// Chi non sa cosa sia una "chiave API" si perde tra un link esterno e il
// tornare indietro a incollarla. Questa guida tiene "vai a prenderla" e
// "incollala qui" nello STESSO posto, con istruzioni numerate in linguaggio
// semplice — mai gergo tecnico, un passo alla volta.
// `usageUrl`: la pagina REALE del provider dove vedere quota/utilizzo/limiti
// aggiornati al momento — mai un numero copiato qui dentro, perché i
// provider li cambiano quando vogliono senza preavviso; un numero fisso
// scritto oggi sarebbe falso tra qualche mese. `freeNoCard`: dichiara se
// serve davvero una carta, mai la stessa frase per tutti a prescindere.
const API_KEY_GUIDES = {
  alphavantage: {
    title: 'Prezzi live per azioni/ETF',
    url: 'https://www.alphavantage.co/support/#api-key',
    freeNoCard: true,
    steps: ['Apri il sito (si apre in una scheda nuova)', 'Lascia pure il menu com\'è, scrivi la tua email nel campo "Email"', 'Premi il pulsante verde "GET FREE API KEY"', 'Copia il codice che appare e torna qui'],
  },
  // Piano B per azioni/ETF (a cascata con Alpha Vantage, richiesto
  // esplicitamente: "mai dipendere da un solo provider"). Quota gratuita
  // molto più generosa (~800 richieste/giorno vs 25 di Alpha Vantage).
  twelvedata: {
    title: 'Prezzi/storico azioni-ETF — Twelve Data (piano B)',
    url: 'https://twelvedata.com/pricing',
    usageUrl: 'https://twelvedata.com/account/usage',
    freeNoCard: true,
    steps: ['Apri il sito (si apre in una scheda nuova)', 'Scegli il piano "Basic" (gratuito) e crea un account', 'Vai su "API Keys" nel tuo pannello e copia la chiave generata', 'Torna qui e incollala'],
  },
  // Terzo piano B (richiesto esplicitamente: "mai dipendere da un solo
  // provider"). Quota gratuita 250 richieste/giorno, storico USA reale
  // fino al 1985 — solo azioni USA sul piano gratuito, dichiarato.
  fmp: {
    title: 'Prezzi/storico azioni USA — Financial Modeling Prep (piano B)',
    url: 'https://site.financialmodelingprep.com/register',
    usageUrl: 'https://site.financialmodelingprep.com/developer/docs/pricing',
    freeNoCard: true,
    steps: ['Apri il sito (si apre in una scheda nuova)', 'Crea un account gratuito', 'Vai nella tua Dashboard e copia la chiave API mostrata', 'Torna qui e incollala. Solo azioni USA sul piano gratuito.'],
  },
  // Piano B per le notizie (richiesto esplicitamente: Alpha Vantage News
  // condivide lo stesso limite di 25 richieste/giorno della ricerca).
  // Piano gratuito molto più generoso (60/minuto), CORS verificato dal vivo.
  finnhub: {
    title: 'Notizie aziendali reali — Finnhub (piano B, molto più generoso)',
    url: 'https://finnhub.io/register',
    usageUrl: 'https://finnhub.io/dashboard',
    freeNoCard: true,
    steps: ['Apri il sito (si apre in una scheda nuova)', 'Crea un account gratuito', 'Copia la chiave API mostrata nella tua Dashboard', 'Torna qui e incollala. 60 richieste al minuto, molto più del piano gratuito Alpha Vantage.'],
  },
  // Terzo piano B per le notizie, generaliste (non solo finanziarie) —
  // utile per aziende meno coperte dagli analisti finanziari. Hacker News
  // non serve chiave (funziona già senza configurare nulla).
  newsapi: {
    title: 'Notizie generaliste — NewsAPI.org (piano B, non solo finanza)',
    url: 'https://newsapi.org/register',
    usageUrl: 'https://newsapi.org/account',
    freeNoCard: true,
    steps: ['Apri il sito (si apre in una scheda nuova)', 'Crea un account gratuito', 'Copia la chiave API mostrata', 'Torna qui e incollala. Piano gratuito per uso non commerciale.'],
  },
  gemini: {
    title: 'Chat generica — Gemini (consigliata)',
    url: 'https://aistudio.google.com/app/apikey',
    usageUrl: 'https://aistudio.google.com/app/apikey',
    freeNoCard: true,
    // Testi verificati dal vivo (2026-07-27): il sito si traduce da solo
    // nella lingua del browser — "Create API key" può apparire come "Crea
    // chiave API" per chi ha Google in italiano. Non dare per scontato un
    // solo testo fisso in inglese: era un errore reale, corretto qui.
    steps: ['Apri il sito (si apre in una scheda nuova)', 'Accedi con un account Google, quello che usi già', 'Cerca il pulsante per creare una chiave — può dire "Create API key" o, se il sito è in italiano, "Crea chiave API"', 'Copia il codice (inizia con "AIza...") e torna qui'],
  },
  groq: {
    title: 'Chat generica — Groq (alternativa)',
    url: 'https://console.groq.com/keys',
    usageUrl: 'https://console.groq.com/settings/limits',
    freeNoCard: true,
    steps: ['Apri il sito (si apre in una scheda nuova)', 'Crea un account gratuito — puoi scegliere Google, GitHub o la tua email', 'Premi "Create API Key"', 'Copia il codice (inizia con "gsk_...") e torna qui'],
  },
  deepseek: {
    title: 'Chat generica — DeepSeek',
    url: 'https://platform.deepseek.com/api_keys',
    usageUrl: 'https://platform.deepseek.com/usage',
    freeNoCard: false,
    steps: ['Apri il sito (si apre in una scheda nuova)', 'Premi "Sign up" per creare un account (o "Log in with Google" se ne hai già uno)', 'Vai su "API keys" nel menu e premi "Create new API key"', 'Copia il codice e torna qui — verifica tu i costi sul tuo account'],
  },
  mistral: {
    title: 'Chat generica — Mistral (piano gratuito)',
    url: 'https://console.mistral.ai/api-keys',
    usageUrl: 'https://console.mistral.ai/usage',
    freeNoCard: true,
    steps: ['Apri il sito (si apre in una scheda nuova)', 'Crea un account gratuito', 'Vai su "API Keys" e crea una nuova chiave', 'Copia il codice e torna qui — verifica tu i limiti sul tuo account'],
  },
  // Aggregatore: una sola chiave dà accesso a decine di modelli, incluso
  // il modello ":free" già configurato di default — utile a chi vuole
  // più scelta senza account separati per ogni provider.
  openrouter: {
    title: 'Chat generica — OpenRouter (aggregatore, modelli gratuiti)',
    url: 'https://openrouter.ai/keys',
    usageUrl: 'https://openrouter.ai/activity',
    freeNoCard: true,
    steps: ['Apri il sito (si apre in una scheda nuova)', 'Crea un account gratuito', 'Premi "Create Key"', 'Copia il codice e torna qui. Una chiave dà accesso a molti modelli, inclusi quelli gratuiti (marcati ":free")'],
  },
  // Corretto (verificato dal vivo sulla documentazione ufficiale,
  // 2026-07-27): NON è gratis senza carta come indicato inizialmente —
  // serve una carta di pagamento verificata per ricevere $5 di credito
  // di prova, che scadono dopo 30 giorni. freeNoCard: false onesto.
  cerebras: {
    title: 'Chat generica — Cerebras (molto veloce, richiede carta per il credito di prova)',
    url: 'https://cloud.cerebras.ai/platform/keys',
    usageUrl: 'https://cloud.cerebras.ai/platform/usage',
    freeNoCard: false,
    steps: ['ATTENZIONE: serve una carta di pagamento verificata per ricevere $5 di credito di prova (scade dopo 30 giorni) — non è gratis senza carta', 'Apri il sito (si apre in una scheda nuova)', 'Crea un account e verifica un metodo di pagamento', 'Vai su "API Keys" e crea una nuova chiave', 'Copia il codice e torna qui'],
  },
  qwen: {
    title: 'Chat generica — Qwen (Alibaba)',
    url: 'https://dashscope-intl.console.aliyun.com/apiKey',
    usageUrl: 'https://dashscope-intl.console.aliyun.com/billing',
    freeNoCard: true,
    steps: ['Apri il sito (si apre in una scheda nuova, modalità internazionale)', 'Crea un account gratuito', 'Genera una chiave API', 'Copia il codice e torna qui — verifica tu i limiti sul tuo account'],
  },
  moonshot: {
    title: 'Chat generica — Moonshot AI / Kimi (Cina)',
    url: 'https://platform.moonshot.ai/console/api-keys',
    usageUrl: 'https://platform.moonshot.ai/console/billing',
    freeNoCard: true,
    steps: ['Apri il sito (si apre in una scheda nuova)', 'Crea un account gratuito', 'Vai su "API Keys" e crea una nuova chiave', 'Copia il codice e torna qui — verifica tu i limiti sul tuo account'],
  },
  glm: {
    title: 'Chat generica — GLM / Zhipu AI (Cina)',
    url: 'https://open.bigmodel.cn/usercenter/apikeys',
    usageUrl: 'https://open.bigmodel.cn/usercenter/financepage',
    freeNoCard: true,
    steps: ['Apri il sito (si apre in una scheda nuova)', 'Crea un account gratuito', 'Vai su "API Keys" e crea una nuova chiave', 'Copia il codice e torna qui — verifica tu i limiti sul tuo account'],
  },
  openai: {
    title: 'Chat generica — OpenAI (a pagamento)',
    url: 'https://platform.openai.com/api-keys',
    usageUrl: 'https://platform.openai.com/usage',
    freeNoCard: false,
    steps: ['A PAGAMENTO A CONSUMO: l\'abbonamento ChatGPT Plus non include questo, è fatturato separatamente', 'Apri il sito (si apre in una scheda nuova)', 'Crea una chiave API e imposta un metodo di pagamento', 'Copia il codice e torna qui'],
  },
  anthropic: {
    title: 'Chat generica — Anthropic/Claude (a pagamento)',
    url: 'https://console.anthropic.com/settings/keys',
    usageUrl: 'https://console.anthropic.com/settings/usage',
    freeNoCard: false,
    steps: ['A PAGAMENTO A CONSUMO: l\'abbonamento Claude Pro non include questo, è fatturato separatamente', 'Apri il sito (si apre in una scheda nuova)', 'Crea una chiave API e imposta un metodo di pagamento', 'Copia il codice e torna qui'],
  },
  // BUG REALE segnalato dall'utente: una chiave che inizia con "xai-" era
  // stata salvata nel campo "Groq" per l'omonimia dei nomi (Groq e xAI/Grok
  // sono due servizi completamente diversi, account e fatturazione separati)
  // — le richieste fallivano sempre in silenzio. Campo dedicato per evitare
  // la stessa confusione ad altri utenti.
  xai: {
    title: 'Chat generica — xAI/Grok (a pagamento, diverso da Groq)',
    url: 'https://console.x.ai',
    usageUrl: 'https://console.x.ai/team',
    freeNoCard: false,
    steps: ['ATTENZIONE: xAI/Grok è un servizio DIVERSO da Groq, nonostante il nome simile — chiavi non intercambiabili', 'A PAGAMENTO A CONSUMO: serve credito attivo sul team console.x.ai', 'Apri il sito (si apre in una scheda nuova) e crea/accedi al tuo team', 'Vai su "API Keys", crea una chiave (inizia con "xai-...") e torna qui'],
  },
};
window.openApiKeyGuide = (provider) => {
  const g = API_KEY_GUIDES[provider];
  if (!g) return;
  window.openModal(`
    <h3 class="text-lg font-bold mb-1">${g.title}</h3>
    <p class="text-xs text-[var(--on-surface-secondary)] mb-4">Nessuna carta di credito. Circa un minuto.</p>
    <ol class="flex flex-col gap-2.5 mb-4">
      ${g.steps.map((s, i) => `<li class="flex items-start gap-2.5 text-sm"><span class="shrink-0 w-5 h-5 rounded-full bg-indigo-600/20 text-indigo-300 text-[11px] font-bold flex items-center justify-center mt-0.5">${i + 1}</span><span>${s}</span></li>`).join('')}
    </ol>
    <a href="${g.url}" target="_blank" rel="noopener" class="btn-action w-full justify-center mb-3">Apri il sito →</a>
    <div class="flex gap-2">
      <input type="password" id="guide-key-input" class="modal-input !mb-0 py-2 text-xs flex-1" placeholder="Incolla qui la chiave copiata..." />
      <button onclick="window.saveGuideKey('${provider}')" class="px-3 bg-indigo-600 rounded-lg text-xs font-bold whitespace-nowrap">Salva</button>
    </div>
  `);
};
window.saveGuideKey = (provider) => {
  const input = document.getElementById('guide-key-input');
  const value = (input?.value || '').trim();
  if (!value) { showToast('Incolla prima la chiave copiata dal sito.', 'error'); return; }
  VaultDAO.state.liveDataKeys = { ...(VaultDAO.state.liveDataKeys || {}), [provider]: value };
  VaultDAO.save();
  showToast('Chiave salvata. Fatto!', 'success');
  try { window.idleFetchPrices && window.idleFetchPrices(); } catch (_) {}
  try { window.renderChatProviderStatus && window.renderChatProviderStatus(); } catch (_) {}
  window.closeModal();
};

// ── CONTEGGIO ANONIMO (opt-in, disattivato di default) ──────────────────────
window.setTelemetryOptIn = (checked) => {
  setTelemetryEnabled(checked);
  showToast(checked ? 'Grazie: un numero anonimo aiuterà a far crescere Momentum.' : 'Conteggio disattivato.', 'success');
  if (checked) sendTelemetryPings(TELEMETRY_ENDPOINT).catch(() => {});
};
function initTelemetryToggle() {
  const cb = document.getElementById('telemetry-opt-in');
  if (cb) cb.checked = isTelemetryEnabled();
  if (isTelemetryEnabled()) sendTelemetryPings(TELEMETRY_ENDPOINT).catch(() => {});
  // Avviso ESPLICITO al primissimo avvio (mai silenzioso): attivo di
  // default, ma l'utente lo scopre subito con un modo immediato per
  // disattivarlo, non solo sepolto in Impostazioni.
  // BUG REALE segnalato dal vivo ("escono molti messaggi del Momentum
  // Vault al primo avvio"): questa e la disclosure della chat generica
  // qui sotto partivano come DUE toast separati (a 2,5s e 4,5s) proprio nei
  // primi istanti in cui un utente nuovo guarda l'app per la prima volta —
  // il momento in cui è già più sensibile a "sembra complicato". Entrambe
  // riguardano la stessa cosa (privacy/opt-out) e vanno quasi sempre
  // insieme al primo avvio: ora si combinano in UN solo messaggio quando
  // servono entrambe, e restano singole solo per chi ne ha già vista una
  // (es. utente esistente che aggiorna l'app).
  const ctxCb = document.getElementById('chat-context-optin');
  if (ctxCb) ctxCb.checked = VaultDAO.state.chatContextOptIn !== false;
  const needsTelemetry = needsTelemetryDisclosure();
  const needsChatCtx = !localStorage.getItem('momentum_chatctx_disclosed');
  if (needsTelemetry) markTelemetryDisclosed();
  if (needsChatCtx) localStorage.setItem('momentum_chatctx_disclosed', '1');
  if (needsTelemetry && needsChatCtx) {
    setTimeout(() => {
      showToast('Un numero anonimo (mai i tuoi dati) aiuta Momentum a crescere, e la chat generica include un riassunto anonimo della tua situazione (mai le transazioni). Entrambi disattivabili in Momentum Vault.', 'info');
    }, 2500);
  } else if (needsTelemetry) {
    setTimeout(() => {
      showToast('Un numero anonimo (mai i tuoi dati) aiuta Momentum a crescere. Disattivabile in Momentum Vault.', 'info');
    }, 2500);
  } else if (needsChatCtx) {
    setTimeout(() => {
      showToast('La chat generica ora include di default un riassunto anonimo della tua situazione (mai transazioni). Disattivabile in Momentum Vault.', 'info');
    }, 2500);
  }
  const animCb = document.getElementById('force-anim-optin');
  if (animCb) animCb.checked = !!VaultDAO.state.forceAnimations;
  document.documentElement.classList.toggle('force-anim', !!VaultDAO.state.forceAnimations);
  const langSel = document.getElementById('qa-language-select');
  if (langSel) langSel.value = VaultDAO.state.qaLanguageOverride && QA_SUPPORTED_LANGS.includes(VaultDAO.state.qaLanguageOverride) ? VaultDAO.state.qaLanguageOverride : '';
  renderChatProviderStatus();
  renderKeyStatusDot('live-price-status', 'alphavantage');
  renderKeyStatusDot('twelvedata-status', 'twelvedata');
  renderKeyStatusDot('fmp-status', 'fmp');
  renderKeyStatusDot('finnhub-status', 'finnhub');
  renderKeyStatusDot('newsapi-status', 'newsapi');
}

// Prima non si capiva se una chiave era già salvata (segnalato dall'utente:
// "sembra sempre che debba essere messa anche quando c'è già") — mostra lo
// stato REALE di ognuno dei 5 provider e permette di cambiarla in qualsiasi
// momento (stesso openApiKeyGuide, che già sovrascrive senza problemi).
function maskKey(key) {
  const k = String(key || '');
  return k.length > 8 ? `${k.slice(0, 4)}…${k.slice(-4)}` : '••••';
}
function renderChatProviderStatus() {
  const box = document.getElementById('chat-provider-status');
  if (!box) return;
  const PROVIDERS = [
    { id: 'gemini', label: 'Gemini' },
    { id: 'groq', label: 'Groq' },
    { id: 'deepseek', label: 'DeepSeek' },
    { id: 'mistral', label: 'Mistral' },
    { id: 'openrouter', label: 'OpenRouter' },
    { id: 'cerebras', label: 'Cerebras' },
    { id: 'qwen', label: 'Qwen' },
    { id: 'moonshot', label: 'Moonshot AI' },
    { id: 'glm', label: 'GLM (Zhipu)' },
    { id: 'xai', label: 'xAI/Grok' },
    { id: 'openai', label: 'OpenAI' },
    { id: 'anthropic', label: 'Anthropic' },
  ];
  const keys = VaultDAO.state.liveDataKeys || {};
  box.innerHTML = PROVIDERS.map(p => {
    const active = !!keys[p.id];
    return `
      <div class="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg" style="background:rgba(255,255,255,0.03)">
        <span class="flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-slate-600'}"></span>
          ${p.label}${active ? ` <span class="text-slate-500 font-mono">${maskKey(keys[p.id])}</span>` : ''}
        </span>
        <button onclick="window.openApiKeyGuide('${p.id}')" class="text-[10px] underline ${active ? 'text-[var(--on-surface-secondary)]' : 'text-[var(--primary)]'}">${active ? 'Cambia' : 'Attiva'} →</button>
      </div>`;
  }).join('');
}
window.renderChatProviderStatus = renderChatProviderStatus;

// Scelta manuale della lingua di "Chiedi a Momentum" — vuoto = automatica
// (segue il testo della domanda, poi il dispositivo, mai più solo l'italiano
// di default). Non tocca la lingua del resto dell'app (label statiche ecc.),
// solo le risposte del Q&A/chat generica.
window.setQaLanguage = (lang) => {
  VaultDAO.state.qaLanguageOverride = lang || null;
  VaultDAO.save();
};

// "Riduci movimento" di sistema è rispettato di default in TUTTA l'app —
// questo toggle è l'unica eccezione, esplicita e scelta dall'utente stesso
// (mai imposta), solo per le micro-animazioni di attesa della chat generica.
window.setForceAnimations = (checked) => {
  VaultDAO.state.forceAnimations = checked;
  document.documentElement.classList.toggle('force-anim', checked);
  VaultDAO.save();
};

// ── CONTESTO FINANZIARIO PER LA CHAT GENERICA (opt-in SEPARATO, disattivato
// di default): solo se attivo, un riassunto AGGREGATO e anonimo (mai
// transazioni/esercenti/conti — vedi buildFinancialContextSummary) viene
// aggiunto alla domanda inviata al provider scelto dall'utente.
window.setChatContextOptIn = (checked) => {
  VaultDAO.state.chatContextOptIn = checked;
  VaultDAO.save();
  showToast(checked ? 'Le domande alla chat generica includeranno un riassunto anonimo (mai transazioni).' : 'Riassunto disattivato: solo il testo che scrivi.', 'success');
};

// ── CERCA UN ASSET: prezzo live + notizie/sentiment reali + avvisi ─────────
// (src/alpha/asset-search.js, src/alpha/news.js, src/predict/price-alerts.js)
// Cripto: nessuna chiave (CoinGecko). Azioni/ETF: chiave personale Alpha
// Vantage già raccolta sopra. Mai un consiglio di acquisto: solo prezzo,
// notizie reali con sentiment dichiarato, e la possibilità di essere
// avvisati quando un prezzo tocca una soglia scelta dall'utente.
const assetSearchCache = { get: (k) => DurableStore.get('state', k).catch(() => null), put: (k, v) => DurableStore.put('state', v, k).catch(() => {}) };
let lastSearchResults = [];

// Modalità privacy (richiesta esplicita utente: "non mostrare i dati
// sensibili ad altre persone"): sfoca l'intero <main> con un tocco — nessun
// dato lascia il dispositivo, è un filtro CSS locale. Stato ricordato tra
// le sessioni (additivo su VaultDAO.state, mai tocca dati finanziari).
// L'icona deve cambiare FORMA (occhio aperto ↔ occhio barrato), non solo
// colore — un utente che tocca "nascondi" deve vedere subito che l'app ha
// capito, non dedurlo dal solo bordo colorato.
const EYE_OPEN_PATH = '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>';
const EYE_CLOSED_PATH = '<path d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a21.8 21.8 0 015.06-6.06M9.9 4.24A10.94 10.94 0 0112 4c7 0 11 8 11 8a21.75 21.75 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><path d="M1 1l22 22"/>';

function setPrivacyToggleIcon(btn, active) {
  const svg = btn?.querySelector('svg');
  if (svg) svg.innerHTML = active ? EYE_CLOSED_PATH : EYE_OPEN_PATH;
}

// Stesso principio dell'occhio privacy: il pulsante tema mostrava SEMPRE la
// luna, anche già in tema chiaro — un utente in tema chiaro vedeva l'icona
// "sbagliata" per lo stato in cui si trovava già. Sole ↔ luna in base al
// tema ATTUALE (non a quello a cui si passerà).
const THEME_MOON_PATH = '<path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>';
const THEME_SUN_PATH = '<circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12H5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8"/>';
function setThemeToggleIcon(btn, dark) {
  const svg = btn?.querySelector('svg');
  if (svg) svg.innerHTML = dark ? THEME_MOON_PATH : THEME_SUN_PATH;
}

window.togglePrivacyMode = (e) => {
  const active = document.body.classList.toggle('privacy-mode');
  [$('#privacy-toggle-mobile'), $('#privacy-toggle-desktop')].forEach(btn => {
    if (!btn) return;
    btn.classList.toggle('active', active);
    setPrivacyToggleIcon(btn, active);
    // Lampo dell'anello + scatto dell'icona: conferma visiva immediata del
    // tocco, non solo un cambio di stato silenzioso.
    btn.classList.remove('just-toggled');
    void btn.offsetWidth;
    btn.classList.add('just-toggled');
  });
  // Onda che nasce dal punto esatto del tocco (coordinate reali dell'evento,
  // non un centro fisso) ed espande abbastanza da coprire l'angolo più
  // lontano dello schermo — collega visivamente il gesto al suo effetto.
  const ripple = $('#privacy-ripple');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let maxDelayMs = 0;
  const nodes = document.querySelectorAll('.font-mono:not(.no-privacy-blur)');
  if (e && Number.isFinite(e.clientX) && !reduceMotion) {
    const x = e.clientX, y = e.clientY;
    if (ripple) {
      const maxDist = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      const size = maxDist * 2.3;
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.background = `radial-gradient(circle, color-mix(in srgb, var(--primary) 18%, transparent) 0%, transparent 70%)`;
      ripple.style.display = 'block';
      ripple.classList.remove('active');
      void ripple.offsetWidth;
      ripple.classList.add('active');
    }
    // Propagazione reale e UNIFICATA: sia lo sfocamento (transition-delay)
    // sia il "poof" di scala (animation-delay) usano lo STESSO ritardo per
    // ogni numero, calcolato dalla sua distanza reale dal punto toccato.
    // Prima erano due tempistiche scollegate (poof istantaneo ovunque +
    // blur ritardato) che si leggevano come due animazioni in conflitto
    // invece di un'unica onda che si allarga dal dito.
    // Velocità ricalibrata: con 2.6px/ms due numeri distanti 200px sullo
    // stesso schermo (il caso comune su mobile) differivano di appena 77ms
    // — sotto la soglia a cui l'occhio umano distingue "in sequenza" da
    // "insieme" (circa 100ms). Risultato: la propagazione era REALE ma
    // impercettibile, si leggeva come un blur generico invece che un'onda.
    const speed = 1.1; // px di distanza per ms di ritardo
    nodes.forEach(n => {
      const r = n.getBoundingClientRect();
      const d = Math.hypot((r.left + r.width / 2) - x, (r.top + r.height / 2) - y);
      const delay = Math.min(d / speed, 420);
      n.style.transitionDelay = `${delay.toFixed(0)}ms`;
      n.style.animationDelay = `${delay.toFixed(0)}ms`;
      if (delay > maxDelayMs) maxDelayMs = delay;
    });
  }
  // "Poof" sui numeri nel momento esatto del cambio, in entrambe le
  // direzioni — un gesto percepibile invece di un blur che sale/scende piano.
  document.body.classList.add('privacy-flash');
  const cleanupMs = maxDelayMs + 420; // copre il ritardo più lungo + la durata delle animazioni
  setTimeout(() => {
    document.body.classList.remove('privacy-flash');
    nodes.forEach(n => { n.style.transitionDelay = ''; n.style.animationDelay = ''; });
  }, cleanupMs);
  VaultDAO.state.privacyMode = active;
  VaultDAO.save();
};
window.quickAssetSearch = (label) => {
  const input = document.getElementById('asset-search-input');
  if (!input) return;
  input.value = label;
  window.runAssetSearch();
};
window.runAssetSearch = async () => {
  const input = document.getElementById('asset-search-input');
  const resultsEl = document.getElementById('asset-search-results');
  const query = (input?.value || '').trim();
  if (!query) return;
  resultsEl.innerHTML = `<p class="text-[10px] text-[var(--on-surface-secondary)]">Cerco...</p>`;
  try {
    const { searchAsset } = await import('./alpha/asset-search.js');
    const { results, stale } = await searchAsset(query, { apiKey: VaultDAO.state.liveDataKeys?.alphavantage, fetchImpl: fetch.bind(window), cache: assetSearchCache });
    lastSearchResults = results;
    if (!results.length) { resultsEl.innerHTML = `<p class="text-[10px] text-[var(--on-surface-secondary)]">Nessun risultato${stale ? ' (offline: nemmeno in cache)' : ''}.</p>`; return; }
    resultsEl.innerHTML = (stale ? `<p class="text-[11px] text-amber-300 mb-1">Offline: risultati dall'ultima ricerca.</p>` : '') + results.map((r, i) =>
      `<button onclick="window.selectAsset(${i})" class="text-left text-[11px] px-2.5 py-1.5 rounded-lg" style="background:rgba(255,255,255,0.04)"><b>${r.symbol}</b> · ${r.name}${r.kind === 'stock' ? ` (${translateRegionLabel(r.region) || 'azione/ETF'})` : ' (cripto)'}</button>`
    ).join('');
  } catch (e) {
    resultsEl.innerHTML = `<p class="text-[10px] text-rose-300">${e.message}</p>`;
  }
};

window.selectAsset = async (idx) => {
  const asset = lastSearchResults[idx];
  const detailEl = document.getElementById('asset-detail');
  if (!asset || !detailEl) return;
  detailEl.innerHTML = `<p class="text-[10px] text-[var(--on-surface-secondary)]">Carico prezzo e notizie...</p>`;
  let priceHtml = '';
  try {
    const { fetchLiveCryptoPrice, fetchLiveStockPrice } = await import('./alpha/live-price.js');
    if (asset.kind === 'crypto') {
      const { price, asOf } = await fetchLiveCryptoPrice(asset.id);
      (window.__livePrices = window.__livePrices || {})[asset.symbol] = price;
      priceHtml = `<p class="text-xl font-black font-mono text-[var(--gold)]">${formatMoney(price)}</p><p class="text-[11px] text-[var(--on-surface-secondary)]">Live · CoinGecko · ${new Date(asOf).toLocaleTimeString('it-IT')}</p>`;
    } else if (VaultDAO.state.liveDataKeys?.alphavantage) {
      const { price, asOf } = await fetchLiveStockPrice(asset.symbol, { apiKey: VaultDAO.state.liveDataKeys.alphavantage });
      (window.__livePrices = window.__livePrices || {})[asset.symbol] = price;
      priceHtml = `<p class="text-xl font-black font-mono text-[var(--gold)]">${formatMoney(price)}</p><p class="text-[11px] text-[var(--on-surface-secondary)]">Live · Alpha Vantage · ${new Date(asOf).toLocaleTimeString('it-IT')}</p>`;
    } else {
      priceHtml = `<p class="text-[10px] text-[var(--on-surface-secondary)]">Aggiungi la tua chiave Alpha Vantage qui sopra per vedere il prezzo live.</p>`;
    }
  } catch (e) {
    priceHtml = `<p class="text-[10px] text-rose-300">${e.message}</p>`;
  }
  // Riassunto REALE dell'azienda/cripto (src/alpha/asset-overview.js): cosa
  // fa, settore/categoria — in linguaggio semplice, mai un giudizio di
  // "innovazione" inventato (quello lo dicono le notizie reali qui sotto).
  let overviewHtml = '';
  if (asset.kind === 'crypto' || VaultDAO.state.liveDataKeys?.alphavantage) {
    try {
      const { fetchAssetOverview } = await import('./alpha/asset-overview.js');
      const ov = await fetchAssetOverview(asset, { apiKey: VaultDAO.state.liveDataKeys?.alphavantage, fetchImpl: fetch.bind(window) });
      const meta = ov.kind === 'stock' ? [ov.sector, ov.industry].filter(Boolean).join(' · ') : ov.category;
      let summary = ov.summary;
      let translatedTag = '';
      // Dispositivo italiano: le fonti (Alpha Vantage/CoinGecko) non hanno
      // contenuti reali in italiano (verificato: description.it di CoinGecko
      // esiste nello schema ma è vuoto) — si traduce il testo VERO con un
      // servizio reale (MyMemory), mai testo inventato, sempre etichettato.
      const { translateText } = await import('./alpha/translate.js');
      if (isItalianDevice()) {
        try { summary = await translateText(ov.summary, { fetchImpl: fetch.bind(window) }); translatedTag = ' <span class="text-slate-600">(traduzione automatica)</span>'; } catch (_) { /* fallback: resta in inglese, mai bloccante */ }
      }
      overviewHtml = `<p class="text-[10px] text-[var(--on-surface-secondary)] mt-1.5 leading-snug">${summary}${translatedTag}</p>${meta ? `<p class="text-[11px] text-slate-500 mt-0.5">${meta}</p>` : ''}`;
    } catch (_) { /* riassunto opzionale: nessun errore bloccante se manca */ }
  }
  // ARCHITETTURA UNIFICATA (richiesto esplicitamente: prima questa vista
  // aveva una propria cascata SEPARATA e meno capace — solo Alpha Vantage,
  // nessun grafico storico con selettore periodo — rispetto a "Chiedi a
  // Momentum". Stessa domanda su Apple dava risultati diversi nei due
  // punti). Ora usa le STESSE due funzioni condivise: mai due motori
  // isolati per la stessa cosa.
  let newsHtml = '', historyChart = '', trackRecordHtml = '';
  try {
    const { items, stale } = await window.fetchAssetNewsCascade(asset);
    if (items.length) newsHtml = `<div class="mt-2">${stale ? '<p class="text-[11px] text-amber-300">Offline: ultime notizie salvate.</p>' : ''}${window.buildNewsItemsHtml(items)}</div>`;
  } catch (_) { /* notizie opzionali: nessun errore bloccante se mancano */ }
  try {
    const { historyChart: chart, trackRecordHtml: tr } = await window.fetchAssetHistoryData(asset);
    historyChart = chart || '';
    trackRecordHtml = tr || '';
  } catch (_) { /* grafico opzionale: nessun errore bloccante se manca */ }
  detailEl.innerHTML = `<div class="p-3 rounded-xl" style="background:rgba(255,255,255,0.03)"><p class="text-[11px] text-[var(--on-surface-secondary)] mb-1"><b>${asset.symbol}</b> · ${asset.name}</p>${priceHtml}${overviewHtml}${newsHtml}${historyChart}${trackRecordHtml}
    <div class="flex gap-1.5 mt-2">
      <select id="alert-direction" class="bg-black/30 border border-[var(--glass-border)] rounded-lg px-2 py-1 text-[10px]"><option value="above">sale sopra</option><option value="below">scende sotto</option></select>
      <input type="number" id="alert-threshold" class="modal-input !mb-0 py-1 text-[10px] flex-1" placeholder="Soglia €" />
      <button onclick="window.addPriceAlert('${asset.symbol}','${asset.kind}')" class="px-2.5 bg-indigo-600 rounded-lg text-[10px] font-bold whitespace-nowrap">Avvisami</button>
    </div>
    <button onclick="window.addToWatchlist('${asset.symbol}','${asset.kind}','${asset.id}','${(asset.name || '').replace(/'/g, "\\'")}')" class="mt-1.5 text-[10px] text-[var(--primary)] underline">Segui questo asset (aggiorna il prezzo da solo, senza rifare la ricerca)</button>
  </div>`;
};

window.addToWatchlist = (symbol, kind, id, name) => {
  const list = VaultDAO.state.watchlist || [];
  if (list.some(w => w.symbol === symbol)) { showToast(`${symbol} è già tra i seguiti.`, 'info'); return; }
  VaultDAO.state.watchlist = [...list, { symbol, kind, id, name }];
  VaultDAO.save();
  showToast(`${symbol} seguito: il prezzo si aggiorna da solo, non serve rifare la ricerca.`, 'success');
  renderWatchlist();
};
window.removeFromWatchlist = (symbol) => {
  VaultDAO.state.watchlist = (VaultDAO.state.watchlist || []).filter(w => w.symbol !== symbol);
  VaultDAO.save();
  renderWatchlist();
};
function renderWatchlist() {
  const el = document.getElementById('asset-watchlist');
  if (!el) return;
  const list = VaultDAO.state.watchlist || [];
  if (!list.length) { el.innerHTML = ''; return; }
  const live = window.__livePrices || {};
  el.innerHTML = list.map(w => `<div class="flex items-center justify-between gap-2 text-[10px] px-2.5 py-1.5 rounded-lg" style="background:rgba(255,255,255,0.03)">
    <span><b>${w.symbol}</b> · ${w.name || ''} ${Number.isFinite(live[w.symbol]) ? `— <span class="text-[var(--gold)] font-mono">${formatMoney(live[w.symbol])}</span>` : '<span class="text-slate-500">in aggiornamento...</span>'}</span>
    <button onclick="window.removeFromWatchlist('${w.symbol}')" class="text-rose-300">${ICON_REMOVE_SM}</button>
  </div>`).join('');
}

// Notifica di SISTEMA reale (Web Notification API): un toast si vede solo
// se l'app è aperta in quel momento — un avviso di prezzo deve arrivare
// anche se Momentum è in background o chiuso. Passa dal Service Worker
// quando disponibile (più affidabile in PWA), altrimenti Notification
// diretta. Silenziosa se il permesso non c'è: mai bloccante, mai invadente
// (il permesso si chiede solo quando l'utente crea il primo avviso).
async function notifyUser(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg?.showNotification) reg.showNotification(title, { body, icon: '/icons/icon-192.png' });
    else new Notification(title, { body });
  } catch (_) {}
}

// Notifica fiscale opt-in (mai attiva di default: il permesso del browser va
// comunque chiesto un tocco alla volta, stesso schema di addPriceAlert).
// De-dup per `key` + giorno: una scadenza saltata o una cassa a rischio non
// devono generare una notifica ad ogni ri-render della Dashboard — solo
// quando il motivo è NUOVO o è passato un giorno da quando l'hai già visto.
function maybeNotifyTaxUrgency(key, title, body) {
  if (!VaultDAO.state.taxNotifyOptIn) return;
  const oggi = new Date().toISOString().slice(0, 10);
  const last = VaultDAO.state.taxLastNotified;
  if (last && last.key === key && last.date === oggi) return;
  VaultDAO.state.taxLastNotified = { key, date: oggi };
  VaultDAO.save();
  notifyUser(title, body);
}

// Attiva l'opt-in (chiede il permesso al tocco, mai in automatico) e
// ridisegna subito la card così il pulsante sparisce e appare la conferma.
window.enableTaxNotifications = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch (_) {}
  }
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    showToast('Permesso non concesso: puoi attivarlo dalle impostazioni del browser quando vuoi.', 'info');
    return;
  }
  VaultDAO.state.taxNotifyOptIn = true;
  VaultDAO.save();
  showToast('Avvisi attivi: ti scrivo solo se c\'è davvero un motivo, mai per abitudine.', 'success');
  renderAnalysis();
};
window.disableTaxNotifications = () => {
  VaultDAO.state.taxNotifyOptIn = false;
  VaultDAO.save();
  showToast('Avvisi disattivati.', 'info');
  renderAnalysis();
};
// "Non ora": rimanda l'invito di 14 giorni invece di ripeterlo ad ogni
// apertura — l'antidoto esplicito al banner persistente che genera abbandono.
window.dismissTaxNotifyPrompt = () => {
  VaultDAO.state.taxNotifyDismissedAt = new Date().toISOString().slice(0, 10);
  VaultDAO.save();
  renderAnalysis();
};

window.addPriceAlert = async (symbol, kind) => {
  const direction = document.getElementById('alert-direction')?.value;
  const threshold = parseFloat(document.getElementById('alert-threshold')?.value);
  try {
    const alert = { ...createPriceAlert({ symbol, direction, threshold }), kind };
    VaultDAO.state.priceAlerts = [...(VaultDAO.state.priceAlerts || []), alert];
    VaultDAO.save();
    if ('Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch (_) {}
    }
    // Best-effort, mai bloccante: se il browser/dispositivo non supporta il
    // Periodic Background Sync (Safari/Firefox, PWA non installata, permesso
    // negato) l'avviso funziona comunque mentre l'app è aperta — non degrada
    // a un errore visibile per qualcosa che è puro bonus.
    try {
      const reg = await navigator.serviceWorker?.ready;
      if (reg && 'periodicSync' in reg) {
        const status = await navigator.permissions?.query({ name: 'periodic-background-sync' }).catch(() => null);
        if (status?.state === 'granted') {
          await reg.periodicSync.register('momentum-price-watch', { minInterval: 12 * 60 * 60 * 1000 });
        }
      }
    } catch (_) {}
    showToast(`Ti avviserò quando ${symbol} ${direction === 'above' ? 'supera' : 'scende sotto'} ${formatMoney(threshold)}.`, 'success');
    renderPriceAlerts();
  } catch (e) {
    showToast(e.message, 'error');
  }
};

const ICON_ALERT_ACTIVE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 inline-block shrink-0 text-[var(--gold)]"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>`;
const ICON_ALERT_PENDING = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 inline-block shrink-0 text-[var(--on-surface-secondary)]"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`;
const ICON_REMOVE_SM = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M18 6L6 18M6 6l12 12"/></svg>`;

function renderPriceAlerts() {
  const el = document.getElementById('price-alerts-list');
  if (!el) return;
  const alerts = VaultDAO.state.priceAlerts || [];
  if (!alerts.length) { el.innerHTML = ''; return; }
  el.innerHTML = alerts.map(a => `<div class="flex items-center justify-between gap-2 text-[10px] px-2.5 py-1.5 rounded-lg" style="background:rgba(255,255,255,0.03)">
    <span class="flex items-center gap-1.5">${a.triggeredAt ? ICON_ALERT_ACTIVE : ICON_ALERT_PENDING} <b>${a.symbol}</b> ${a.direction === 'above' ? '>' : '<'} ${formatMoney(a.threshold)}${a.triggeredAt ? ` — scattato a ${formatMoney(a.triggeredPrice)}` : ''}</span>
    <button onclick="window.removePriceAlertUI('${a.id}')" class="text-rose-300">${ICON_REMOVE_SM}</button>
  </div>`).join('');
}
window.removePriceAlertUI = (id) => {
  VaultDAO.state.priceAlerts = removePriceAlert(VaultDAO.state.priceAlerts || [], id);
  VaultDAO.save();
  renderPriceAlerts();
};

// ── GESTORE PIANI A RATE (BNPL, src/predict/bnpl.js) ────────────────────────
// Il CONTROLLO che mancava: prima il motore parlava solo con una riga nel feed
// insight, senza modo per l'utente di vedere i piani rilevati o correggere un
// falso positivo del rilevatore generico (pattern di cadenza, senza nome di
// marchio — può sbagliare su un caso raro). "Non è un piano a rate" persiste
// l'id nel vault (mlData.bnplDismissed, additivo): non richiede mai di nuovo.
window.openBnplManager = (onDone = null) => {
  const eur = (n) => `${(+n || 0).toFixed(2).replace('.', ',')} €`;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const dayName = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const dismissed = () => VaultDAO.state.mlData.bnplDismissed || [];

  const render = () => {
    const exp = bnplExposure(VaultDAO.state.transactions, {
      now: Date.now(), learned: VaultDAO.state.mlData?.bnplLearned || {}, anticipate: true, dismissed: dismissed(),
    });
    const rows = exp.plans.map(p => {
      const badge = p.anticipated
        ? `<span class="text-[11px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25">previsto</span>`
        : p.confidence === 'pattern'
          ? `<span class="text-[11px] px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/25">non verificato</span>`
          : '';
      const next = p.upcoming[0];
      return `<div class="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-[var(--glass-border)] bg-black/20">
        <div class="min-w-0 flex-1">
          <span class="font-bold text-[13px] flex items-center gap-1.5 flex-wrap"><span class="truncate">${esc(p.providerLabel)}</span>${badge}</span>
          <span class="text-[10.5px] text-[var(--on-surface-secondary)]">${p.remainingCount} rate residue${next ? ` · prossima il ${dayName(next.date)}` : ''}</span>
        </div>
        <span class="flex items-center gap-2 shrink-0">
          <span class="font-mono font-black text-[13px] text-amber-300">${eur(p.remainingTotal)}</span>
          <button data-dismiss="${p.id}" title="Non è un piano a rate" class="text-[10px] text-[var(--on-surface-secondary)] opacity-70 underline whitespace-nowrap">non è un piano</button>
        </span>
      </div>`;
    }).join('');

    openModal(`
      <div class="flex flex-col gap-3 p-3 sm:p-5 lg:p-0">
        <div>
          <p class="eyebrow !mb-0 text-[var(--primary)]">Piani a rate</p>
          <h3 class="text-base font-black">Klarna, PayPal, Scalapay e altri</h3>
          <p class="card-sub !mb-0">Vedo tutti i piani insieme, indipendentemente dal provider — nessuna delle loro app lo fa. Se ne riconosco uno per sbaglio, correggimi qui sotto.</p>
        </div>
        ${exp.count > 0 ? `<div class="card p-3 flex items-center justify-between">
          <span class="text-[11px] font-bold text-[var(--on-surface-secondary)] uppercase tracking-wide">Totale ancora da pagare</span>
          <span class="font-mono font-black text-[15px] text-amber-300">${eur(exp.totalRemaining)}</span>
        </div>` : ''}
        ${rows || '<p class="text-[12px] text-[var(--on-surface-secondary)]">Nessun piano a rate rilevato per ora.</p>'}
        ${dismissed().length ? `<button id="bnpl-restore" class="text-[10.5px] text-[var(--primary)] underline self-start">Ripristina i piani corretti (${dismissed().length})</button>` : ''}
      </div>`);

    // BUG TROVATO verificando dal vivo: il dismiss salvava correttamente nel
    // vault, ma il feed radar SOTTOSTANTE (già disegnato prima di aprire questo
    // pannello) non si aggiornava finché non arrivava un onDone esplicito —
    // l'insight "hai un piano a rate" restava a schermo anche dopo la
    // correzione. Ora ogni dismiss/ripristino aggiorna SUBITO anche il feed,
    // non solo il modale, indipendentemente da come è stato aperto il pannello.
    const refreshUnderlying = () => { try { renderAnalysis({ skipHeavyForecast: true }); } catch (_) {} };
    document.querySelectorAll('[data-dismiss]').forEach(b => b.addEventListener('click', () => {
      const ml = VaultDAO.state.mlData;
      ml.bnplDismissed = [...dismissed(), b.dataset.dismiss];
      VaultDAO.save();
      showToast('Ok, non lo conto più come piano a rate.', 'info');
      render();
      refreshUnderlying();
    }));
    document.getElementById('bnpl-restore')?.addEventListener('click', () => {
      VaultDAO.state.mlData.bnplDismissed = [];
      VaultDAO.save();
      render();
      refreshUnderlying();
    });
  };
  render();
  const origClose = window.closeModal;
  window.closeModal = function () { origClose(); if (typeof onDone === 'function') onDone(); window.closeModal = origClose; };
};

// puoi correggerli. L'override vince sul rilevato (resolveSalary). onDone()
// ridisegna la schermata chiamante così il nuovo stipendio si applica subito.
window.openSalaryEditor = (onDone = null) => {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const eur = (n) => `${(+n || 0).toFixed(2).replace('.', ',')} €`;
  const detected = resolveSalary(VaultDAO.state, VaultDAO.state.transactions);
  const isAuto = detected && detected.source === 'auto';
  openModal(`
    <div class="flex flex-col gap-3 p-3 sm:p-5 lg:p-0">
      <div>
        <p class="eyebrow !mb-0 text-[var(--primary)]">Il tuo accredito</p>
        <h3 class="text-base font-black">Quando e quanto prendi</h3>
        <p class="card-sub !mb-0">${detected ? (isAuto ? `L'ho capito dai tuoi movimenti. Se non è giusto, correggilo.` : `Lo hai impostato tu. Puoi cambiarlo quando vuoi.`) : `Non ho ancora abbastanza accrediti per capirlo da solo. Impostalo tu (bastano pochi mesi importati e lo riconosco).`}</p>
      </div>
      ${detected && isAuto ? `<div class="card p-3 flex items-center justify-between">
        <div><div class="text-[13px] font-bold">${esc(detected.label || 'Stipendio')}</div><div class="text-[11px] text-[var(--on-surface-secondary)]">Rilevato · fiducia ${Math.round((detected.confidence || 0) * 100)}%</div></div>
        <div class="text-right"><div class="font-mono font-black text-emerald-400">${eur(detected.amount)}</div><div class="text-[11px] text-[var(--on-surface-secondary)]">il giorno ${detected.dayOfMonth}</div></div>
      </div>` : ''}
      <div class="flex gap-2">
        <label class="flex-1 text-[11px] font-bold text-[var(--on-surface-secondary)]">Giorno del mese
          <input id="sal-day" type="text" inputmode="numeric" value="${detected ? detected.dayOfMonth : ''}" placeholder="es. 27" class="w-full mt-1 bg-black/30 border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm font-mono" />
        </label>
        <label class="flex-1 text-[11px] font-bold text-[var(--on-surface-secondary)]">Importo netto
          <input id="sal-amt" type="text" inputmode="decimal" value="${detected ? detected.amount : ''}" placeholder="es. 1500" class="w-full mt-1 bg-black/30 border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm font-mono" />
        </label>
      </div>
      <button id="sal-save" class="btn-action btn-primary w-full py-3 font-bold rounded-xl active:scale-[0.98] transition-transform">Salva</button>
      ${VaultDAO.state.salaryProfile ? `<button id="sal-reset" class="text-[11px] text-[var(--on-surface-secondary)] underline">Torna a farlo capire da Momentum</button>` : ''}
      <p class="text-[11px] text-[var(--on-surface-secondary)] opacity-90">Resta sul tuo dispositivo. Serve solo a dirti quando puoi saldare senza restare a secco.</p>
    </div>`);
  $('#sal-save')?.addEventListener('click', () => {
    const day = parseInt(String($('#sal-day').value).replace(/\D/g, ''), 10);
    const amt = parseFloat(String($('#sal-amt').value).replace(',', '.'));
    if (!(day >= 1 && day <= 31) || !(amt > 0)) { showToast('Metti un giorno (1–31) e un importo validi.', 'error'); return; }
    VaultDAO.state.salaryProfile = { dayOfMonth: day, amount: Math.round(amt * 100) / 100, label: (detected && detected.label) || 'Stipendio' };
    VaultDAO.save(); haptic('medium');
    closeModal();
    showToast(`Accredito impostato: ${eur(amt)} il giorno ${day}.`, 'success');
    if (onDone) onDone();
  });
  $('#sal-reset')?.addEventListener('click', () => {
    delete VaultDAO.state.salaryProfile; VaultDAO.save();
    closeModal(); showToast('Ora lo capisco di nuovo dai tuoi movimenti.', 'info');
    if (onDone) onDone();
  });
};

// ── COME FARMI PAGARE: impostato una volta, riusato ovunque ─────────────────
// Fix del vicolo cieco "IBAN vuoto": qui scegli come vuoi essere pagato (IBAN,
// PayPal, Revolut, Satispay, o un link tuo), Momentum lo ricorda e prepara la
// richiesta giusta. onDone() prosegue l'azione che l'aveva richiesto.
window.openPayoutSetup = (onDone = null) => {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cur = VaultDAO.state.payoutProfile || (resolvePayout(VaultDAO.state) || {});
  let method = cur.method || 'paypal';
  const placeholders = { iban: 'IT60 X054 2811 1010 0000 0123 456', paypal: 'il tuo nome PayPal (o link paypal.me/...)', revolut: 'il tuo @ Revolut (o link revolut.me/...)', satispay: 'il tuo numero/nome Satispay', other: 'un link o un recapito per pagarti' };
  const draw = () => {
    openModal(`
      <div class="flex flex-col gap-3 p-3 sm:p-5 lg:p-0">
        <div>
          <p class="eyebrow !mb-0 text-[var(--primary)]">Come farti pagare</p>
          <h3 class="text-base font-black">Scegli una volta, lo ricordo io</h3>
          <p class="card-sub !mb-0">Quando chiedi un rimborso, preparo il messaggio giusto — con un link toccabile dove si può. Niente conti, niente movimenti: paghi e ricevi tu.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          ${PAYOUT_METHODS.map(m => `<button data-pm="${m}" class="text-[12px] font-bold px-3 py-2 rounded-full border active:scale-95 transition-transform ${m === method ? 'border-[var(--primary)] text-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]' : 'border-[var(--glass-border)] text-[var(--on-surface-secondary)]'}">${esc(PAYOUT_LABELS[m])}</button>`).join('')}
        </div>
        <input id="po-value" value="${esc(cur.value || '')}" class="w-full bg-black/30 border border-[var(--glass-border)] rounded-xl px-4 py-3 text-sm" placeholder="${esc(placeholders[method])}" />
        ${method === 'iban' ? `<input id="po-holder" value="${esc(cur.holder || '')}" class="w-full bg-black/30 border border-[var(--glass-border)] rounded-xl px-4 py-3 text-sm" placeholder="Intestatario (facoltativo)" />` : ''}
        <button id="po-save" class="btn-action btn-primary w-full py-3 font-bold rounded-xl active:scale-[0.98] transition-transform">Salva</button>
        <p class="text-[11px] text-[var(--on-surface-secondary)] opacity-90">Resta sul tuo dispositivo. Puoi cambiarlo quando vuoi.</p>
      </div>`);
    document.querySelectorAll('[data-pm]').forEach(b => b.addEventListener('click', () => { cur.value = $('#po-value')?.value || cur.value; method = b.dataset.pm; draw(); }));
    $('#po-save')?.addEventListener('click', () => {
      const value = String($('#po-value').value || '').trim();
      if (!value) { showToast('Scrivi come vuoi essere pagato.', 'error'); return; }
      VaultDAO.state.payoutProfile = { method, value, holder: method === 'iban' ? (String($('#po-holder')?.value || '').trim()) : '' };
      VaultDAO.save(); haptic('medium'); closeModal();
      showToast('Metodo di pagamento salvato.', 'success');
      if (onDone) onDone();
    });
  };
  draw();
};

// ── CHIEDI UN RIMBORSO (intelligente): usa il metodo salvato, o lo imposta una
// volta. IBAN → QR SEPA (ricco); PayPal/Revolut/altro → messaggio con LINK
// toccabile. Fine del vicolo cieco "IBAN vuoto". ──
window.openRequestPayment = ({ amount = 0, fromName = '', note = '', momentumLink = '' } = {}) => {
  const payout = resolvePayout(VaultDAO.state);
  if (!payout) { window.openPayoutSetup(() => window.openRequestPayment({ amount, fromName, note, momentumLink })); return; }
  if (payout.method === 'iban') {
    window.openSepaTransfer({ mode: 'request', brand: true, momentumLink, name: payout.holder || 'Io', iban: payout.value, amount, remittance: note.slice(0, 140), title: `Chiedi ${(+amount).toFixed(2).replace('.', ',')} € a ${fromName || ''}`.trim() });
    return;
  }
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const { message, link } = buildPayoutRequest({ ...payout, amount, note, fromName, momentumLink });
  let qr = '';
  try { if (link && link.length <= 300) qr = qrSvg(link, { moduleSize: 4, quiet: 4, dark: '#0b0b0d', light: '#ffffff' }); } catch (_) { qr = ''; }
  openModal(`
    <div class="flex flex-col gap-3 p-3 sm:p-5 lg:p-0">
      <div><h3 class="text-base font-black">Chiedi ${esc((+amount).toFixed(2).replace('.', ','))} €${fromName ? ` a ${esc(fromName)}` : ''}</h3><p class="card-sub !mb-0">Via ${esc(PAYOUT_LABELS[payout.method])}. Mando io il messaggio pronto — l'amico ${link ? 'tocca il link e paga' : 'paga come gli dici'}.</p></div>
      ${qr ? `<div class="mx-auto rounded-2xl bg-white p-2.5" style="width:min(200px,60vw)">${qr}</div><p class="text-[10px] text-center text-[var(--on-surface-secondary)]">Inquadra per pagare, o manda il messaggio sotto.</p>` : ''}
      <div class="rounded-xl border border-[var(--outline)] bg-[var(--surface-elevated)] p-3 text-[12px] whitespace-pre-line select-all">${esc(message)}</div>
      <div class="grid grid-cols-2 gap-2">
        <button id="rp-wa" class="btn-action btn-primary py-3 font-bold rounded-xl active:scale-[0.98] transition-transform">WhatsApp</button>
        <button id="rp-copy" class="py-3 font-bold rounded-xl border border-[var(--outline)] bg-[var(--surface-elevated)] text-sm active:scale-[0.98] transition-transform">Copia</button>
      </div>
      ${link ? `<button id="rp-open" class="text-[11px] text-[var(--primary)] underline">Apri ${esc(PAYOUT_LABELS[payout.method])}</button>` : ''}
      <button id="rp-change" class="text-[11px] text-[var(--on-surface-secondary)] underline">Cambia come farti pagare</button>
    </div>`);
  $('#rp-wa')?.addEventListener('click', () => window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener'));
  $('#rp-copy')?.addEventListener('click', () => { navigator.clipboard?.writeText(message); showToast('Messaggio copiato.', 'success'); });
  $('#rp-open')?.addEventListener('click', () => window.open(link, '_blank', 'noopener'));
  $('#rp-change')?.addEventListener('click', () => window.openPayoutSetup(() => window.openRequestPayment({ amount, fromName, note, momentumLink })));
};

// ── CONDIVIDI UN CODICE (gruppo spese) — a distanza, senza server: il codice
// viaggia su WhatsApp/Email/QR e l'amico lo importa. QR solo se abbastanza corto
// (limite fisico del QR); altrimenti WhatsApp/copia (funzionano sempre). ──
// Costruisce il LINK Momentum brandizzato che apre l'app già sul gruppo. Usa
// l'origine corrente (stessa app), così a PWA installata o su web funziona
// uguale. Il codice viaggia nel parametro ?join= (URL-encoded).
// La base del link è RISOLTA in modo intelligente (share-base.js): base canonica
// stabile se conosciuta, altrimenti l'origine imparata più stabile, altrimenti
// quella corrente → il link è preso in automatico e resta valido anche se cambia
// host/server/dominio. Il riconoscimento in ricezione è comunque per contenuto.
// Il codice d'invito, nel formato corto. Stesso contenuto di sempre (id, nome,
// membri e — se c'e' — l'offerta di collegamento diretto): mai le spese, che
// arrivano dopo con la sincronizzazione.
async function buildInviteCode(group, p2pOffer) {
  const slim = { id: group.id, name: group.name, members: group.members, ...(p2pOffer ? { p2p: p2pOffer } : {}) };
  try { return await packShare(slim); } catch (_) { return encodeGroupInvite(group, p2pOffer); }
}

function buildJoinLink(code, groupName = '') {
  // Formato nuovo: il contenuto sta DOPO il cancelletto (non raggiunge mai un
  // server, nemmeno nei log) e prima del cancelletto si legge il nome del
  // gruppo. Chi riceve il link capisce cos'e' prima di toccarlo — era il
  // motivo principale per cui gli inviti non venivano aperti.
  const base = buildShareUrl(VaultDAO.state, location.origin, '', location.pathname).replace(/\?join=$/, '');
  try {
    return buildInviteUrl({ base: new URL(base).origin, path: new URL(base).pathname, code, groupName });
  } catch (_) {
    return buildShareUrl(VaultDAO.state, location.origin, code, location.pathname);
  }
}

window.openShareCode = ({ code, title = 'Condividi il gruppo', sub = '', groupName = 'la spesa', pairing = null } = {}) => {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const link = buildJoinLink(code, groupName);
  // Il QR ora punta al LINK, non al blob: scansionandolo l'app si apre già sul
  // gruppo (prima apriva nulla, era solo testo da incollare). Il link è più
  // corto del blob → il QR è più leggibile.
  let qr = '';
  try { if (link && link.length <= 900) qr = qrSvg(link, { moduleSize: 4, quiet: 4, dark: '#0b0b0d', light: '#ffffff' }); } catch (_) { qr = ''; }
  openModal(`
    <div class="flex flex-col gap-3 p-3 sm:p-5 lg:p-0">
      <div><h3 class="text-base font-black">${esc(title)}</h3><p class="card-sub !mb-0">${esc(sub || 'Manda il link all\'amico: lo tocca e Momentum si apre già sul gruppo. Niente da copiare, niente account, niente server.')}</p></div>
      ${qr ? `<div class="mx-auto rounded-2xl bg-white p-2.5" style="width:min(200px,60vw)">${qr}</div><p class="text-[10px] text-center text-[var(--on-surface-secondary)]">Inquadra il QR per unirti, oppure manda il link qui sotto.</p>` : ''}
      <div class="flex items-center gap-2 bg-[var(--surface-elevated)] border border-[var(--outline)] rounded-xl px-3 py-2.5">
        <svg class="w-4 h-4 shrink-0 text-[var(--primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>
        <span class="text-[11px] font-mono truncate flex-1" id="sc-linktext">${esc(link)}</span>
      </div>
      <button id="sc-copy" class="btn-action btn-primary w-full py-3 font-bold rounded-xl">Copia il link</button>
      <div class="grid grid-cols-3 gap-2">
        <button id="sc-wa" class="flex flex-col items-center gap-1 py-2.5 rounded-xl border border-[var(--outline)] bg-[var(--surface-elevated)] text-[10px] font-bold active:scale-95 transition-transform"><svg class="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.6 4.7-1.2A10 10 0 1 0 12 2zm0 2a8 8 0 1 1-4.1 14.9l-.3-.2-2.4.6.6-2.3-.2-.3A8 8 0 0 1 12 4z"/></svg>WhatsApp</button>
        <button id="sc-email" class="flex flex-col items-center gap-1 py-2.5 rounded-xl border border-[var(--outline)] bg-[var(--surface-elevated)] text-[10px] font-bold active:scale-95 transition-transform"><svg class="w-5 h-5 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>Email</button>
        <button id="sc-share" class="flex flex-col items-center gap-1 py-2.5 rounded-xl border border-[var(--outline)] bg-[var(--surface-elevated)] text-[10px] font-bold active:scale-95 transition-transform"><svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>Altro…</button>
      </div>
      <details class="text-[10px] text-[var(--on-surface-secondary)]"><summary class="cursor-pointer opacity-70">Il link non si apre? Usa il codice</summary><textarea readonly class="w-full h-16 mt-2 bg-[var(--surface-elevated)] border border-[var(--outline)] rounded-xl p-2 text-[10px] font-mono select-all" id="sc-code">${esc(code)}</textarea></details>
      ${pairing ? `<details class="text-[10px] text-[var(--on-surface-secondary)]"><summary class="cursor-pointer opacity-70">Ha risposto? Completa il collegamento diretto (facoltativo)</summary><p class="mt-2 opacity-80">Se ti manda indietro una risposta, incollala qui: le spese si sincronizzeranno da sole quando siete online insieme, senza ri-condividere niente.</p><textarea id="sc-p2p-in" placeholder="Incolla qui la risposta ricevuta…" class="w-full h-16 mt-2 bg-[var(--surface-elevated)] border border-[var(--outline)] rounded-xl p-2 text-[10px] font-mono"></textarea><button id="sc-p2p-go" class="btn-action w-full py-2 mt-2 text-[11px] font-bold rounded-xl">Connetti</button></details>` : ''}
    </div>`);
  // Il messaggio che arriva su WhatsApp. Riscritto perché il precedente
  // metteva il link in mezzo al testo e usava parole da app ("si uniscono",
  // "senza server"): chi lo riceve non ha mai sentito parlare di Momentum e
  // deve capire in due secondi tre cose — chi lo invita, a cosa, e che non
  // deve fare nulla di complicato. Regole applicate:
  //  · una frase per riga, nessun periodo lungo;
  //  · il link SEMPRE da solo sull'ultima riga (le chat lo rendono cliccabile
  //    e mostrano l'anteprima solo così; in mezzo al testo spesso si spezza);
  //  · niente parole tecniche, niente "codice" — era la parola che faceva
  //    scattare la diffidenza;
  //  · si dice subito che è gratis e senza registrazione, che è la prima
  //    domanda di chiunque riceva un link del genere.
  const msg = `Ti ho aggiunto a «${groupName}» per dividere le spese 💸\n`
    + `Tocca il link e ci sei: vedi subito chi ha pagato cosa e quanto devi.\n`
    + `Non serve registrarsi, è gratis e i conti restano sul tuo telefono.\n`
    + `${link}`;
  $('#sc-copy')?.addEventListener('click', () => { navigator.clipboard?.writeText(link); showToast('Link copiato.', 'success'); haptic('light'); });
  $('#sc-wa')?.addEventListener('click', () => window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener'));
  $('#sc-email')?.addEventListener('click', () => { window.location.href = `mailto:?subject=${encodeURIComponent(`Unisciti a «${groupName}» su Momentum`)}&body=${encodeURIComponent(msg)}`; });
  $('#sc-share')?.addEventListener('click', async () => { try { if (navigator.share) await navigator.share({ title: 'Momentum', text: msg }); else { navigator.clipboard?.writeText(link); showToast('Link copiato.', 'info'); } } catch (_) { } });
  $('#sc-p2p-go')?.addEventListener('click', async (e) => {
    const answerCode = $('#sc-p2p-in')?.value?.trim();
    if (!answerCode || !pairing) { showToast('Incolla prima la risposta ricevuta.', 'error'); return; }
    const btn = e.currentTarget;
    try {
      const channel = await pairing.acceptAnswer(answerCode);
      meshAdoptChannel(pairing.pc, channel);
      showToast('Collegamento diretto attivo: le spese si sincronizzeranno da sole quando siete online insieme.', 'success');
      haptic('heavy');
      // stessa disciplina "un solo battito, poi torna normale" di .join-badge:
      // il bottone conferma con un'icona coerente col resto dell'app (SVG a
      // tratto, mai emoji) invece di sparire e basta nel testo del toast.
      if (btn) {
        btn.innerHTML = '<svg class="w-4 h-4 inline-block align-[-0.15em] mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>Connesso';
        btn.classList.add('join-badge');
        btn.disabled = true;
      }
    } catch (_) { showToast('Risposta non valida o scaduta.', 'error'); }
  });
};

// ── RICEVI UN GRUPPO: incolla il codice ricevuto → merge conflict-free nell'elenco
// locale (idempotente: reincollare non duplica). ──
window.receiveSplitGroup = () => {
  openModal(`
    <div class="flex flex-col gap-3 p-3 sm:p-5 lg:p-0">
      <div><h3 class="text-base font-black">Ricevi un gruppo</h3><p class="card-sub !mb-0">Incolla il codice che ti ha mandato un amico (WhatsApp/Email): unirai le vostre spese, senza server.</p></div>
      <textarea id="rg-code" class="w-full h-24 bg-[var(--surface-elevated)] border border-[var(--outline)] rounded-xl p-3 text-[11px] font-mono" placeholder="Incolla qui il codice che ti hanno mandato"></textarea>
      <button id="rg-merge" class="btn-action btn-primary w-full py-3 font-bold rounded-xl">Unisci il gruppo</button>
    </div>`);
  $('#rg-merge')?.addEventListener('click', async () => {
    const g = await readGroupCode($('#rg-code').value);
    if (!g) { showToast('Codice non valido: ricontrolla di averlo copiato tutto.', 'error'); return; }
    window.openJoinConfirm(g);
  });
};

// ── CONFERMA "UNISCITI AL GRUPPO" (arrivo da deep-link o da codice) ──────────
// Il momento in cui l'amico entra: brandizzato Momentum, chiaro anche per chi
// non ha mai usato un'app di divisione, con un'anteprima di COSA sta per unire
// (nome gruppo, persone, spese) → nessuna sorpresa, un tocco solo. Micro-
// animazione d'ingresso (join-pop) per dare il feedback che "è successo".
window.openJoinConfirm = (g) => {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const eur = (n) => `${(+n || 0).toFixed(2).replace('.', ',')} €`;
  const already = (VaultDAO.state.splitGroups || []).find(x => x.id === g.id);
  const total = (g.expenses || []).reduce((s, e) => s + (+e.amount || 0), 0);
  const names = (g.members || []).map(m => m.name).filter(Boolean);
  // Chi sono io in questo gruppo? Se questo dispositivo ha già uno slot (qui
  // o nella copia locale già salvata) non richiediamolo di nuovo — solo la
  // PRIMA volta si sceglie, mai un attrito ripetuto ad ogni sync successivo.
  const deviceId = VaultDAO.state.deviceId;
  const iAmAlready = myMemberId(g, deviceId) || (already && myMemberId(already, deviceId));
  const freeSlots = unclaimedMembers(g);
  const needsIdentity = !iAmAlready;
  openModal(`
    <div class="flex flex-col gap-4 p-3 sm:p-5 lg:p-0 join-pop">
      <div class="flex flex-col items-center text-center gap-1.5">
        <div class="w-14 h-14 rounded-2xl grid place-items-center bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] border border-[color-mix(in_srgb,var(--primary)_40%,transparent)] join-badge">
          <svg class="w-7 h-7 text-[var(--primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M15 20c0-2 1.5-3.5 4-3.5"/></svg>
        </div>
        <p class="eyebrow !mb-0 text-[var(--primary)]">Momentum · Insieme</p>
        <h3 class="text-lg font-black leading-tight">${already ? 'Aggiorna' : 'Unisciti a'} «${esc(g.name)}»</h3>
        <p class="card-sub !mb-0">${names.length ? `Con ${names.slice(0, 4).map(esc).join(', ')}${names.length > 4 ? ` e altri ${names.length - 4}` : ''}.` : ''} ${(g.expenses || []).length ? `${(g.expenses || []).length} spes${(g.expenses || []).length === 1 ? 'a' : 'e'} · ${eur(total)} in tutto.` : 'Ancora nessuna spesa.'}</p>
      </div>
      ${needsIdentity ? `
      <div>
        <p class="text-[11px] font-bold text-center mb-2">Chi sei tu, tra queste persone?</p>
        <div id="join-who-chips" class="flex flex-wrap justify-center gap-2">
          ${freeSlots.map(m => `<button type="button" data-who="${esc(m.id)}" class="join-who-chip px-4 py-2 rounded-full border border-[var(--outline)] bg-[var(--surface-elevated)] text-[13px] font-bold"><svg class="join-who-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>${esc(m.name)}</button>`).join('')}
          <button type="button" id="join-who-new" class="join-who-chip px-4 py-2 rounded-full border border-dashed border-[var(--outline)] text-[13px] font-bold text-[var(--on-surface-secondary)]"><svg class="join-who-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>Non ci sono, aggiungimi</button>
        </div>
        <input id="join-who-name" type="text" placeholder="Il tuo nome…" class="hidden modal-input mt-2 w-full" maxlength="30" />
      </div>` : ''}
      <button id="join-go" class="btn-action btn-primary w-full py-3.5 font-black rounded-xl" ${needsIdentity ? 'disabled' : ''}>${already ? 'Unisci le spese' : 'Entra nel gruppo'}</button>
      <p class="text-[10px] text-center text-[var(--on-surface-secondary)] opacity-70">Resta tutto sul tuo telefono. Nessun account, nessun server — le vostre spese si uniscono da sole.${needsIdentity ? ' Il tuo slot resta solo tuo: nessun altro dispositivo potrà mai scegliere di essere te.' : ''}</p>
    </div>`);

  let pickedMemberId = null; // slot esistente scelto (null = "aggiungi il mio nome")
  const joinBtn = $('#join-go');
  const enableJoin = () => { if (joinBtn) joinBtn.disabled = false; };
  const disableJoin = () => { if (joinBtn) joinBtn.disabled = true; };

  document.querySelectorAll('.join-who-chip[data-who]').forEach(chip => {
    chip.addEventListener('click', () => {
      pickedMemberId = chip.dataset.who;
      $('#join-who-name')?.classList.add('hidden');
      document.querySelectorAll('.join-who-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      enableJoin();
    });
  });
  $('#join-who-new')?.addEventListener('click', () => {
    pickedMemberId = null;
    document.querySelectorAll('.join-who-chip').forEach(c => c.classList.remove('active'));
    $('#join-who-new')?.classList.add('active');
    const nameInput = $('#join-who-name');
    nameInput?.classList.remove('hidden');
    nameInput?.focus();
    disableJoin();
  });
  $('#join-who-name')?.addEventListener('input', (e) => {
    if (e.target.value.trim()) enableJoin();
    else disableJoin();
  });

  $('#join-go')?.addEventListener('click', () => {
    let incoming = g;
    if (needsIdentity) {
      if (pickedMemberId) {
        incoming = claimMember(incoming, pickedMemberId, deviceId);
      } else {
        const myName = $('#join-who-name')?.value?.trim();
        if (!myName) { showToast('Scegli chi sei prima di entrare.', 'error'); return; }
        const newId = `m_${deviceId.slice(0, 6)}_${Date.now().toString(36)}`;
        incoming = { ...incoming, members: [...incoming.members, { id: newId, name: myName }] };
        incoming = claimMember(incoming, newId, deviceId);
      }
    }
    VaultDAO.state.splitGroups = mergeIntoGroups(VaultDAO.state.splitGroups || [], incoming);
    VaultDAO.save();
    haptic('heavy');
    closeModal();
    showToast(already ? `Spese di «${g.name}» unite.` : `Sei nel gruppo «${g.name}».`, 'success');
    if (window.renderAnalysis) renderAnalysis({ skipHeavyForecast: true });
    // Se l'invito portava anche un'offerta P2P (vedi encodeGroupInvite), proviamo
    // ad aprire il canale diretto in background: non blocca l'ingresso (richiede
    // qualche secondo per l'ICE gathering), e se non va a buon fine il gruppo
    // resta comunque unito — è solo un'accelerazione facoltativa del sync live.
    if (g.p2p) {
      tryAutoAcceptP2P(g.p2p).then(answer => { if (answer) offerToSendP2PAnswer(answer, g.name); });
    }
    // Chi è appena arrivato dal link (attivazione lampo) e non ha ancora
    // personalizzato: dopo aver visto la divisione, il Reveal gli mostra cosa
    // fa il resto di Momentum e offre l'attivazione. Altrimenti apre il gruppo.
    if (VaultDAO.state.activatedLite && !VaultDAO.state.revealSeen) {
      setTimeout(() => window.openMomentumReveal(g), 450);
    } else {
      setTimeout(() => window.openSplitGroup(g.id), 350);
    }
  });
};

// ── MOMENTUM REVEAL — il momento anti-abbandono per chi arriva dal link ──────
// Chi entra da un link ha fatto la divisione (zero attrito) e ora NON ha motivo
// di esplorare. Qui trasformiamo quel momento in scoperta: usando la divisione
// appena fatta come gancio reale, mostriamo — con neurocolori e neuro-copy — le
// altre forze di Momentum, e offriamo di attivarle con 2 domande. Onesto (regola
// #1): sono PREVIEW di cosa farò, non numeri finti. Neurocolori: verde=sereno/
// sicuro (quanto puoi spendere), indaco=intuizione (predizioni), ciano=fiducia
// (privacy). Frizione psicologica calibrata: attivare è un tocco, saltare pure.
window.openMomentumReveal = (g = null) => {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  VaultDAO.state.revealSeen = true; VaultDAO.save();
  // Gancio predittivo REALE dalla divisione: con chi ridividere di solito.
  let hookName = '';
  try { const cs = predictCoSplitters(VaultDAO.state.splitGroups || [], { description: (g && g.name) || '' }); if (cs && cs[0]) hookName = cs[0].name; } catch (_) {}
  const cards = [
    { c: 'emerald', t: 'Quanto puoi spendere oggi', d: 'Un numero solo, ogni giorno, senza restare a secco a fine mese.', i: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>' },
    { c: 'indigo', t: 'Prevedo le tue spese', d: hookName ? `Ho già iniziato: la prossima volta per «${esc((g && g.name) || 'una spesa')}» ti suggerisco ${esc(hookName)}.` : 'Imparo le tue abitudini e ti anticipo, prima che l\'addebito arrivi.', i: '<path d="M3 12h4l3 8 4-16 3 8h4"/>' },
    { c: 'cyan', t: 'Resta tutto tuo', d: 'Nessun account, nessun server. I tuoi soldi non escono dal telefono.', i: '<path d="M12 3l7 4v5c0 4-3 7-7 9-4-2-7-5-7-9V7z"/>' },
  ];
  const tone = { emerald: 'text-emerald-400 border-emerald-400/40 bg-emerald-400/5', indigo: 'text-[var(--primary)] border-[color-mix(in_srgb,var(--primary)_40%,transparent)] bg-[color-mix(in_srgb,var(--primary)_5%,transparent)]', cyan: 'text-cyan-400 border-cyan-400/40 bg-cyan-400/5' };
  openModal(`
    <div class="flex flex-col gap-3 p-3 sm:p-5 lg:p-0 join-pop">
      <div class="text-center">
        <p class="eyebrow !mb-0 text-[var(--primary)]">Momentum</p>
        <h3 class="text-lg font-black leading-tight">Hai diviso in un lampo.<br>Ora lascia che faccia il resto.</h3>
        <p class="card-sub !mb-0">Sei già dentro. Ecco cosa posso fare per te — quando vuoi.</p>
      </div>
      <div class="flex flex-col gap-2">
        ${cards.map(card => `<div class="flex items-center gap-3 rounded-2xl border p-3 ${tone[card.c]}">
          <div class="w-9 h-9 rounded-xl grid place-items-center border ${tone[card.c]} shrink-0"><svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${card.i}</svg></div>
          <div class="min-w-0"><div class="text-[13px] font-black text-[var(--on-surface)]">${esc(card.t)}</div><div class="text-[11px] text-[var(--on-surface-secondary)] leading-snug">${card.d}</div></div>
        </div>`).join('')}
      </div>
      <button id="rev-activate" class="btn-action btn-primary w-full py-3.5 font-black rounded-xl active:scale-[0.98] transition-transform">Attiva tutto · 2 domande, 20 secondi</button>
      <button id="rev-later" class="text-[12px] text-[var(--on-surface-secondary)] underline">Esplora prima, lo attivo dopo</button>
    </div>`);
  $('#rev-activate')?.addEventListener('click', () => window.openActivationQuestions(() => { showToast('Momentum è tuo. Su misura.', 'success'); if (g) setTimeout(() => window.openSplitGroup(g.id), 300); }));
  $('#rev-later')?.addEventListener('click', () => { closeModal(); haptic('light'); if (g) setTimeout(() => window.openSplitGroup(g.id), 250); });
};

// Le 2 domande iniziali in versione compatta (modale), per personalizzare dopo
// l'attivazione lampo. Stesse scelte dell'onboarding, ma un tocco a domanda.
window.openActivationQuestions = (onDone = null) => {
  const state = { step: 1, risk: null, hz: null };
  const draw = () => {
    const q1 = `<div><p class="eyebrow !mb-0 text-[var(--primary)]">1 / 2</p><h3 class="text-base font-black mb-1">Mercato in crollo (−20%). Tu:</h3>
      <div class="flex flex-col gap-2 mt-2">
        <button data-r="aggressivo" class="g-option !max-w-none">Compro ancora (è in saldo)</button>
        <button data-r="bilanciato" class="g-option !max-w-none">Attendo e osservo</button>
        <button data-r="conservativo" class="g-option !max-w-none">Vendo, non voglio rischiare</button>
      </div></div>`;
    const q2 = `<div><p class="eyebrow !mb-0 text-[var(--primary)]">2 / 2</p><h3 class="text-base font-black mb-1">Quando ti servirà il capitale?</h3>
      <div class="flex flex-col gap-2 mt-2">
        <button data-h="lungo" class="g-option !max-w-none">Tra molti anni</button>
        <button data-h="medio" class="g-option !max-w-none">Tra 3–5 anni</button>
        <button data-h="breve" class="g-option !max-w-none">Tra pochi mesi</button>
      </div></div>`;
    openModal(`<div class="flex flex-col gap-3 p-3 sm:p-5 lg:p-0 join-pop">${state.step === 1 ? q1 : q2}</div>`);
    document.querySelectorAll('#modal-body [data-r]').forEach(b => b.addEventListener('click', () => { state.risk = b.dataset.r; state.step = 2; draw(); }));
    document.querySelectorAll('#modal-body [data-h]').forEach(b => b.addEventListener('click', () => {
      state.hz = b.dataset.h;
      seedProfileState(state.risk || 'bilanciato', state.hz);
      delete VaultDAO.state.activatedLite; VaultDAO.save(); haptic('heavy');
      closeModal();
      renderDashboard(); if (window.renderAnalysis) renderAnalysis({ skipHeavyForecast: true });
      if (onDone) onDone();
    }));
  };
  draw();
};

// ── GRUPPO SPESE PERSISTENTE (il vero Splitwise on-device): N persone SENZA
// limite, PIU' spese con pagatori e importi DIVERSI (uno paga 10, un altro 89,
// un altro niente), storico, controlli (aggiungi/elimina spesa e persone),
// settlement minimo live ("chi deve cosa a chi"), condivisione a distanza. ──
// Pannello "Momentum prevede" (split-intelligence.js): spese ricorrenti in
// arrivo + proiezione saldo a fine mese. On-device, dai soli dati del gruppo.
// Compare SOLO se c'è davvero qualcosa da prevedere (mai un box vuoto/inventato).
function renderSplitForesight(g, names) {
  const eur = (n) => `${(+n || 0).toFixed(2).replace('.', ',')} €`;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rec = detectRecurring(g).filter(r => r.daysUntilNext >= -3 && r.daysUntilNext <= 45);
  if (!rec.length) return '';
  const rows = rec.slice(0, 3).map(r => {
    const when = r.daysUntilNext <= 0 ? 'attesa ora' : `tra ~${r.daysUntilNext} giorni`;
    const payer = predictExpenseShape(g, r.description);
    const who = payer?.payer ? ` · di solito paga <b>${esc(names[payer.payer] || '?')}</b>` : '';
    return `<div class="flex items-center justify-between gap-2 py-1.5 text-[13px] border-b border-[var(--outline)] last:border-0">
      <span class="min-w-0"><b>${esc(r.description)}</b> · <span class="text-[var(--on-surface-secondary)]">${eur(r.typicalAmount)} ${when}${who}</span></span>
      <span class="shrink-0 text-[11px] text-[var(--on-surface-secondary)]">${Math.round(r.confidence * 100)}%</span>
    </div>`;
  }).join('');
  return `<div class="card p-3">
    <div class="eyebrow"><svg viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>Momentum prevede</div>
    ${rows}
    <p class="text-[10.5px] text-[var(--on-surface-secondary)] mt-1.5 leading-snug">Stime dai tuoi dati del gruppo, non certezze. La percentuale è quanto è regolare la spesa.</p>
  </div>`;
}

window.openSplitGroup = (openId = null) => {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const eur = (n) => `${(+n || 0).toFixed(2).replace('.', ',')} €`;
  const myIban = ((VaultDAO.state.invoiceProfile || {}).fiscale || {}).iban || '';
  const groups = () => VaultDAO.state.splitGroups || [];
  // Ogni modifica locale (rename, nuova spesa, nuova persona) si propaga SUBITO
  // ai dispositivi già collegati sul canale mesh (sync LIVE, sopra il CRDT):
  // se il canale non è aperto o nessuno è connesso, è un no-op silenzioso —
  // il link statico resta comunque il modo per il PRIMO aggancio.
  const persist = (g) => {
    VaultDAO.state.splitGroups = mergeIntoGroups(groups(), g);
    VaultDAO.save();
    try { window.momentumMeshNode?.shareSplitGroups([g], peerAppartieneAlGruppo); } catch (_) {}
  };
  const nameById = (g) => Object.fromEntries(g.members.map(m => [m.id, m.name]));
  let currentId = openId;
  const form = { payer: null, amount: '', desc: '', involved: null }; // involved=null → tutti

  const render = (liveSync = false) => {
    const g = currentId ? groups().find(x => x.id === currentId) : null;
    g ? renderDetail(g, liveSync) : renderList(liveSync);
    updateSplitMeshDot();
  };
  // Hook per il sync LIVE mesh: se questo pannello è aperto quando arriva un
  // aggiornamento da un altro dispositivo, si ridisegna SUBITO (non solo un
  // toast). Un solo pannello alla volta è aperto per costruzione dell'app.
  window.__splitLiveRefresh = () => render(true);

  const renderList = (liveSync = false) => {
    const gs = groups();
    const rows = gs.map(g => {
      const total = (g.expenses || []).reduce((s, e) => s + e.amount, 0);
      return `<button data-open="${g.id}" class="split-row w-full flex items-center justify-between gap-2 p-3 rounded-xl border border-[var(--outline)] bg-[var(--surface-elevated)] text-left">
        <span class="min-w-0"><span class="font-bold text-sm block truncate">${esc(g.name)}</span><span class="text-[11px] text-[var(--on-surface-secondary)]">${g.members.length} persone · ${(g.expenses || []).length} spese</span></span>
        <span class="font-mono font-black text-sm shrink-0">${eur(total)}</span></button>`;
    }).join('');
    openModal(`
      <div class="flex flex-col gap-3 p-3 sm:p-5 lg:p-0">
        <div><h3 class="text-base font-black">Insieme — i tuoi gruppi</h3><p class="card-sub !mb-0">Cena, vacanza, casa: crea un gruppo, aggiungi le spese di tutti e vedi chi deve cosa a chi. Senza account, senza limiti di persone.</p><p id="split-mesh-status" class="text-[10px] text-[var(--on-surface-secondary)] mt-1 inline-flex items-center gap-1.5"></p></div>
        <div class="flex flex-col gap-2 split-rows-in${liveSync ? ' split-sync-pulse' : ''}">${rows || '<p class="text-[12px] text-[var(--on-surface-secondary)]">Nessun gruppo ancora. Creane uno qui sotto.</p>'}</div>
        <button id="sg-new" class="btn-action btn-primary w-full py-3 font-bold rounded-xl inline-flex items-center justify-center gap-2"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>Nuovo gruppo</button>
        <button id="sg-receive" class="w-full py-2.5 font-bold rounded-xl border border-[var(--outline)] bg-[var(--surface-elevated)] text-[12px] text-[var(--on-surface-secondary)]">Ricevi un gruppo da un amico</button>
      </div>`);
    document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => { currentId = b.dataset.open; render(); }));
    $('#sg-new')?.addEventListener('click', () => {
      let g = createGroup({ name: 'Nuovo gruppo', members: ['Io'] });
      // Il creatore rivendica SUBITO il proprio slot ("Io") con l'id di questo
      // dispositivo: da qui in poi nessun altro dispositivo che entra dal
      // link potrà mai scegliere di essere "Io" — vedi claimMember.
      g = claimMember(g, g.members[0].id, VaultDAO.state.deviceId);
      persist(g); currentId = g.id; render();
    });
    $('#sg-receive')?.addEventListener('click', () => window.receiveSplitGroup());
  };

  const renderDetail = (g, liveSync = false) => {
    const names = nameById(g);
    const members = g.members;
    const bal = computeBalances(g);
    const { transfers } = settlementView(g);
    // Il default di "chi paga" era SEMPRE il primo membro dell'array — per chi
    // entra in un gruppo dopo la creazione (mai in posizione 0), il form si
    // apriva con il CREATORE preselezionato come pagante invece che se stesso.
    // Ora parte dal proprio slot rivendicato (myMemberId), quando esiste; resta
    // comunque liberamente modificabile: registrare che ha pagato qualcun
    // altro è un caso reale e legittimo, qui si tocca solo il default.
    if (!form.payer || !members.some(m => m.id === form.payer)) {
      form.payer = myMemberId(g, VaultDAO.state.deviceId) || members[0]?.id;
    }
    const involved = form.involved || members.map(m => m.id);

    const expRows = (g.expenses || []).map(e => `
      <div class="split-row flex items-center justify-between gap-2 py-1.5 border-b border-[var(--outline)] last:border-0">
        <span class="min-w-0"><b>${esc(names[e.payer] || '?')}</b> ha pagato <b>${eur(e.amount)}</b>${e.description ? ` · <span class="text-[var(--on-surface-secondary)]">${esc(e.description)}</span>` : ''}</span>
        <button data-delexp="${e.id}" class="shrink-0 text-[11px] text-[var(--red)] opacity-70 hover:opacity-100">elimina</button>
      </div>`).join('');

    const settleRows = transfers.map(t => {
      const line = t.toName === 'Io' ? `<b>${esc(t.fromName)}</b> deve darti <b>${eur(t.amount)}</b>`
        : t.fromName === 'Io' ? `Devi <b>${eur(t.amount)}</b> a <b>${esc(t.toName)}</b>`
          : `<b>${esc(t.fromName)}</b> → <b>${esc(t.toName)}</b>: ${eur(t.amount)}`;
      const act = t.toName === 'Io' ? `<button data-ask="${t.amount}" data-who="${esc(t.fromName)}" class="shrink-0 text-[11px] font-bold text-emerald-400 underline">Chiedi</button>`
        : t.fromName === 'Io' ? `<button data-tell="${t.amount}" data-tellwho="${esc(t.toName)}" class="shrink-0 text-[11px] font-bold text-[var(--gold)] underline">Avvisa</button>` : '';
      return `<div class="flex items-center justify-between gap-2 py-1.5 text-[13px]">${line}${act}</div>`;
    }).join('') || `<div class="flex items-center gap-2 py-2 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
      <svg class="w-4 h-4 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
      <span class="text-[12px] font-bold text-emerald-400">Tutto in pari — nessuno deve niente a nessuno</span>
    </div>`;

    openModal(`
      <div class="flex flex-col gap-3 p-3 sm:p-5 lg:p-0">
        <div class="flex items-center gap-2">
          <button id="sg-back" class="shrink-0 w-8 h-8 rounded-lg border border-[var(--outline)] bg-[var(--surface-elevated)] inline-flex items-center justify-center">‹</button>
          <input id="sg-name" value="${esc(g.name)}" class="flex-1 bg-transparent text-base font-black min-w-0 outline-none" />
        </div>
        <p id="split-mesh-status" class="text-[10px] text-[var(--on-surface-secondary)] -mt-1.5 inline-flex items-center gap-1.5"></p>
        <div class="${liveSync ? 'split-sync-pulse' : ''}">
          <div class="text-[11px] font-bold text-[var(--on-surface-secondary)] mb-1.5">Persone (${members.length}) · saldo</div>
          <div class="flex flex-col gap-1 split-rows-in">
            ${members.map(m => `<div class="split-row flex items-center justify-between text-[12px] px-3 py-1.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--outline)]"><span class="font-bold">${esc(m.name)}</span><span class="font-mono ${bal[m.id] > 0.005 ? 'text-emerald-400' : bal[m.id] < -0.005 ? 'text-[var(--red)]' : 'text-[var(--on-surface-secondary)]'}">${bal[m.id] > 0.005 ? 'recupera ' : bal[m.id] < -0.005 ? 'deve ' : 'in pari '}${eur(Math.abs(bal[m.id] || 0))}</span></div>`).join('')}
          </div>
          <div class="flex flex-wrap gap-2 mt-2">
            ${frequentCoSplitters(groups()).filter(f => !members.some(m => m.name === f.name)).slice(0, 4).map(f => `<button data-addmember="${esc(f.name)}" class="text-[11px] px-2.5 py-1 rounded-full border border-dashed border-[var(--outline)] text-[var(--on-surface-secondary)]">+ ${esc(f.name)}</button>`).join('')}
            <input id="sg-newmember" class="text-[12px] bg-[var(--surface-elevated)] border border-[var(--outline)] rounded-full px-3 py-1 w-32 min-w-0" placeholder="+ aggiungi persona" />
          </div>
        </div>
        ${(g.expenses || []).length ? `<div class="card p-3${liveSync ? ' split-sync-pulse' : ''}"><div class="eyebrow"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h10"/></svg>Spese (${g.expenses.length})</div><div class="split-rows-in">${expRows}</div></div>` : ''}
        ${renderSplitForesight(g, names)}
        <div class="card p-3">
          <div class="eyebrow"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Aggiungi una spesa</div>
          <div class="flex flex-wrap gap-1.5 mb-2">${members.map(m => `<button data-payer="${m.id}" class="text-[11px] font-bold px-2.5 py-1.5 rounded-full border ${form.payer === m.id ? 'border-[var(--gold)] text-[var(--gold)]' : 'border-[var(--outline)] text-[var(--on-surface-secondary)]'} bg-[var(--surface-elevated)]">${esc(m.name)} paga</button>`).join('')}</div>
          <div class="flex gap-2">
            <input id="sg-amt" type="number" inputmode="decimal" value="${esc(form.amount)}" class="w-28 bg-[var(--surface-elevated)] border border-[var(--outline)] rounded-xl px-3 py-2.5 text-sm font-mono min-w-0" placeholder="Quanto €" />
            <input id="sg-desc" value="${esc(form.desc)}" class="flex-1 bg-[var(--surface-elevated)] border border-[var(--outline)] rounded-xl px-3 py-2.5 text-sm min-w-0" placeholder="Per cosa" />
          </div>
          <div class="text-[10px] text-[var(--on-surface-secondary)] mt-1.5 mb-1">Chi partecipa a questa spesa (tocca per escludere):</div>
          <div class="flex flex-wrap gap-1.5">${members.map(m => `<button data-involve="${m.id}" class="text-[11px] px-2.5 py-1 rounded-full border ${involved.includes(m.id) ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10' : 'border-[var(--outline)] text-[var(--on-surface-secondary)] line-through'}">${esc(m.name)}</button>`).join('')}</div>
          <button id="sg-addexp" class="btn-action btn-primary w-full py-2.5 font-bold rounded-xl mt-2 text-sm">Aggiungi la spesa</button>
        </div>
        <div class="card p-3">
          <div class="eyebrow"><svg viewBox="0 0 24 24"><path d="M7 17l5-5 5 5M7 7l5 5 5-5"/></svg>Chi deve cosa a chi (meno bonifici possibili)</div>
          ${(() => { const c = settlementCounts(g); return c.saved > 0 ? `<div class="text-[11px] text-emerald-300 mb-1.5">Semplificato: <b>${c.simplified} pagament${c.simplified === 1 ? 'o' : 'i'}</b> invece di ${c.raw} — ${c.saved} in meno.</div>` : ''; })()}
          ${settleRows}
        </div>
        <div class="flex gap-2">
          <button id="sg-share" class="btn-action btn-primary flex-1 py-3 font-bold rounded-xl inline-flex items-center justify-center gap-1.5"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>Condividi</button>
          <button id="sg-del" class="px-4 py-3 font-bold rounded-xl border border-[color-mix(in_srgb,var(--red)_30%,transparent)] text-[var(--red)] text-sm">Elimina</button>
        </div>
        <p class="text-[11px] text-[var(--on-surface-secondary)] opacity-90">N persone, nessun limite. Condividi il gruppo con chi vuoi (anche lontano): le spese si uniscono senza server. I rimborsi li fate voi.</p>
      </div>`);

    // bind
    $('#sg-back')?.addEventListener('click', () => { currentId = null; render(); });
    $('#sg-name')?.addEventListener('change', (e) => { persist(renameGroup(g, e.target.value)); render(); });
    $('#sg-newmember')?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.value.trim()) { const ng = { ...g, members: [...g.members, { id: `m${g.members.length}_${Math.random().toString(36).slice(2, 6)}`, name: e.target.value.trim() }] }; persist(ng); render(); } });
    document.querySelectorAll('[data-addmember]').forEach(b => b.addEventListener('click', () => { const ng = { ...g, members: [...g.members, { id: `m${g.members.length}_${Math.random().toString(36).slice(2, 6)}`, name: b.dataset.addmember }] }; persist(ng); render(); }));
    document.querySelectorAll('[data-payer]').forEach(b => b.addEventListener('click', () => { form.payer = b.dataset.payer; render(); }));
    document.querySelectorAll('[data-involve]').forEach(b => b.addEventListener('click', () => {
      const set = new Set(form.involved || members.map(m => m.id));
      set.has(b.dataset.involve) ? set.delete(b.dataset.involve) : set.add(b.dataset.involve);
      form.involved = members.map(m => m.id).filter(id => set.has(id));
      if (!form.involved.length) form.involved = members.map(m => m.id);
      render();
    }));
    $('#sg-amt')?.addEventListener('input', (e) => { form.amount = e.target.value; });
    $('#sg-desc')?.addEventListener('input', (e) => { form.desc = e.target.value; });
    $('#sg-addexp')?.addEventListener('click', () => {
      const amt = parseFloat(String(form.amount).replace(',', '.'));
      if (!(amt > 0)) { $('#sg-amt')?.focus(); showToast('Inserisci quanto è stato speso.', 'error'); return; }
      const inv = form.involved || members.map(m => m.id);
      try {
        const ng = addSharedExpense(g, { payer: form.payer, amount: amt, description: form.desc, shares: inv.length < members.length ? { equalAmong: inv } : undefined });
        persist(ng); form.amount = ''; form.desc = ''; form.involved = null; render();
      } catch (e) { showToast('Non ho potuto aggiungere la spesa: ' + e.message, 'error'); }
    });
    document.querySelectorAll('[data-delexp]').forEach(b => b.addEventListener('click', () => { const ng = { ...g, expenses: g.expenses.filter(e => e.id !== b.dataset.delexp) }; persist(ng); render(); }));
    document.querySelectorAll('[data-ask]').forEach(b => b.addEventListener('click', () => { let mLink = ''; try { mLink = buildJoinLink(encodeGroupShare(g)); } catch (_) {} window.openRequestPayment({ amount: +b.dataset.ask, fromName: b.dataset.who, note: g.name, momentumLink: mLink }); }));
    document.querySelectorAll('[data-tell]').forEach(b => b.addEventListener('click', async () => { const msg = `Ciao ${b.dataset.tellwho}, ti devo ${eur(+b.dataset.tell)} per ${g.name}. Mandami l'IBAN così ti giro il bonifico!`; try { if (navigator.share) await navigator.share({ text: msg }); else { navigator.clipboard?.writeText(msg); showToast('Messaggio copiato.', 'success'); } } catch (_) { } }));
    $('#sg-share')?.addEventListener('click', async () => {
      const p2p = await tryCreateP2POffer();
      _groupInvitePairing = p2p?.pairing || null;
      window.openShareCode({ code: await buildInviteCode(g, p2p?.offer), groupName: g.name, title: `Invita a "${g.name}"`, sub: 'Manda il link: l\'amico lo tocca e Momentum si apre già sul gruppo. Le spese si uniscono, anche da un altro Paese, senza server.', pairing: _groupInvitePairing });
    });
    $('#sg-del')?.addEventListener('click', () => { VaultDAO.state.splitGroups = groups().filter(x => x.id !== g.id); VaultDAO.save(); currentId = null; render(); if (window.renderAnalysis) renderAnalysis({ skipHeavyForecast: true }); });
  };

  render();
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
// Fonti verificate dal vivo sul sito ufficiale dell'Agenzia delle Entrate
// (agosto 2026) — mai un link o un indirizzo inventato:
//  - portale "Fatture e Corrispettivi": ivaservizi.agenziaentrate.gov.it
//  - indirizzo PEC di PRIMO invio allo SdI: sdi01@pec.fatturapa.it (dopo il
//    primo invio lo SdI comunica un indirizzo PEC-SdI dedicato per i successivi)
// Perché Momentum non può fare il passo finale da solo: trasmettere allo SdI
// per conto di qualcun altro richiede l'accreditamento come intermediario
// presso l'Agenzia delle Entrate — un rapporto istituzionale con requisiti
// societari, non una funzione di codice. Quello che Momentum PUÒ fare (ed è
// già tutto qui) è preparare il file giusto e indicare la strada esatta.
function showUploadHelp(filename, number, year) {
  const box = $('#inv-xml-controls'); if (!box) return;
  if (!$('#inv-upload-steps')) {
    const div = document.createElement('div');
    div.id = 'inv-upload-steps';
    div.className = 'mt-2 pt-3 border-t border-emerald-400/20 modal-section-in';
    div.innerHTML = `
      ${tl1CostoTempo('Gratis', 'green', 'Pochi minuti', 'green')}
      <div class="mt-2">${tl1Checklist('tl1-check-sdi', ['SPID, CIE, CNS oppure credenziali Entratel/Fisconline', `Il file ${(filename || 'XML').replace(/</g, '')} già scaricato da Momentum (fatto)`])}</div>
      <div class="font-bold mt-3 mb-1.5 text-[10px] uppercase tracking-wide text-[var(--on-surface-secondary)]">Come caricarla (una volta sola, poi è routine)</div>
      <div class="flex flex-col gap-2">
        ${tl1Step(1, 'Accedi al portale <b class="text-[var(--on-surface)]">Fatture e Corrispettivi</b> con SPID, CIE, CNS o le tue credenziali Entratel/Fisconline.')}
        ${tl1Step(2, 'Alla prima schermata scegli il profilo <b class="text-[var(--on-surface)]">"Me stesso"</b> (sei tu che fatturi, non un\'altra persona/azienda) — è il punto dove più persone si bloccano: se vedi un elenco di aziende/deleghe, "Me stesso" è comunque sempre la prima opzione in alto.')}
        ${tl1Step(3, 'Apri la sezione <b class="text-[var(--on-surface)]">Fatturazione elettronica</b> e cerca <b class="text-[var(--on-surface)]">"trasmetti" / "importa un file"</b>.')}
        ${tl1Step(4, `Carica il file <b class="text-[var(--on-surface)]">${(filename || 'XML').replace(/</g, '')}</b> che hai appena scaricato da Momentum.`)}
        ${tl1Step(5, 'Controlla l\'anteprima e premi <b class="text-[var(--on-surface)]">Trasmetti</b>: lo SdI ti invierà la ricevuta di consegna (o di scarto, spiegata in chiaro qui sopra prima ancora di inviarla).')}
      </div>
      <div class="mt-2 opacity-70 text-[10px]">I nomi esatti delle voci possono variare nel tempo: cerca "Fatturazione elettronica" nel menu.</div>
      <button type="button" id="inv-sdi-walkthrough-btn" class="mt-2.5 w-full btn-action btn-primary justify-center text-[12px] font-bold py-2.5">
        <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3l14 9-14 9V3z"/></svg>
        Guidami passo dopo passo, uno schermo alla volta
      </button>
      <details class="mt-2.5 pt-2.5 border-t border-emerald-400/20">
        <summary class="cursor-pointer font-bold text-[11px]">Non hai SPID o non riesci ad accedere? C'è una seconda strada: la PEC</summary>
        <div class="mt-2 flex flex-col gap-2">
          <div class="text-[11px] text-[var(--on-surface-secondary)]">Se hai una casella di <b class="text-[var(--on-surface)]">PEC (Posta Elettronica Certificata)</b>, puoi mandare il file XML come allegato direttamente al Sistema di Interscambio, senza passare dal portale:</div>
          ${tl1Step(1, 'La <b class="text-[var(--on-surface)]">prima volta</b> invia una email dalla tua PEC, con il file XML allegato, a <b class="text-[var(--on-surface)]">sdi01@pec.fatturapa.it</b>.')}
          ${tl1Step(2, 'Lo SdI ti risponderà comunicandoti un <b class="text-[var(--on-surface)]">indirizzo PEC-SdI dedicato</b> tutto tuo: userai quello per <b class="text-[var(--on-surface)]">tutti gli invii successivi</b> (non più il primo indirizzo).')}
          ${tl1Step(3, 'Tieni le ricevute che arrivano: dicono se la fattura è stata consegnata o scartata.')}
          <div class="text-[10px] text-amber-300 opacity-90">Attenzione: mandare il file direttamente alla PEC del cliente, senza passare per lo SdI, NON vale come fattura elettronica — va sempre allo SdI prima.</div>
        </div>
      </details>
      <button type="button" id="tl1-sdi-expert-toggle" class="mt-2 text-[10px] font-bold text-[var(--on-surface-secondary)] underline">Sei del mestiere? Mostra i riferimenti normativi</button>
      <div class="tl1-expert text-[10px] text-[var(--on-surface-secondary)] border-t border-[var(--glass-border)] pt-2 mt-1">Riferimento normativo: obbligo generalizzato di fatturazione elettronica tra privati dal 1° gennaio 2019 — L. 205/2017 (Legge di Bilancio 2018), art. 1 commi 909–928. Regole tecniche del Sistema di Interscambio: DM 55/2013.</div>
      <div class="mt-2 opacity-70 text-[10px]">Momentum prepara il file e ti indica la strada esatta, ma non può cliccare "Trasmetti" al posto tuo: serve il tuo accesso ufficiale, che noi non vediamo mai.</div>`;
    box.appendChild(div);
    tl1InitChecklist('tl1-check-sdi');
    document.getElementById('tl1-sdi-expert-toggle')?.addEventListener('click', (e) => {
      const el = div.querySelector('.tl1-expert');
      const on = !el.classList.contains('tl1-expert-open');
      el.classList.toggle('tl1-expert-open', on);
      e.target.textContent = on ? 'Nascondi i riferimenti normativi' : 'Sei del mestiere? Mostra i riferimenti normativi';
    });
    document.getElementById('inv-sdi-walkthrough-btn')?.addEventListener('click', () => window.openSdiWalkthrough(filename, number, year));
  }
  showToast('Guida al caricamento mostrata sotto.', 'success');
}

// Percorso guidato uno-schermo-alla-volta dentro il portale reale, invece di
// un elenco da leggere tutto insieme: lo stesso passo si legge meglio quando
// è l'UNICA cosa sullo schermo, con un'icona che lo rende riconoscibile a
// colpo d'occhio anche a chi non ha mai visto un portale della P.A. Onestà
// non negoziabile: NON sono screenshot veri del portale (cambiano nel tempo
// e Momentum non può vederli in anticipo) — sono passi ricreati nella
// sequenza ufficiale, dichiarati come tali fin dal primo schermo.
const SDI_WALKTHROUGH_STEPS = [
  { icon: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', title: 'Accedi', text: 'Apri il portale Fatture e Corrispettivi ed entra con SPID, CIE, CNS o le tue credenziali Entratel/Fisconline — le stesse che usi per la dichiarazione dei redditi.', link: true },
  { icon: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>', title: '"Me stesso"', text: 'Alla prima schermata scegli il profilo "Me stesso": sei tu che fatturi, non un\'altra persona o azienda. È sempre la prima opzione in alto, anche se vedi un elenco di deleghe.' },
  { icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>', title: 'Fatturazione elettronica', text: 'Nel menu principale cerca la voce "Fatturazione elettronica", poi "Trasmetti" o "Importa un file".', link: true },
  { icon: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>', title: 'Carica il file', text: null },
  { icon: '<path d="M20 6 9 17l-5-5"/>', title: 'Trasmetti', text: 'Controlla l\'anteprima che ti mostra il portale e premi "Trasmetti". Arriverà una ricevuta di consegna (o di scarto — te l\'ho già spiegata sopra prima ancora che tu la riceva).' },
];
window.openSdiWalkthrough = (filename, number, year) => {
  let step = 0;
  const render = (dir = 'forward') => {
    const s = SDI_WALKTHROUGH_STEPS[step];
    const text = s.text || `Seleziona il file <b class="text-[var(--on-surface)]">${(filename || 'XML').replace(/</g, '')}</b> che hai già scaricato da Momentum, e caricalo dove il portale chiede "importa" o "trasmetti file".`;
    const isLast = step === SDI_WALKTHROUGH_STEPS.length - 1;
    const dirClass = dir === 'back' ? 'sdi-wt-back' : 'sdi-wt-forward';
    window.openModal(`
      <div class="flex flex-col gap-4 p-4 sm:p-6 lg:p-2 text-center items-center ${dirClass}">
        ${tl1Icon(`<path d="M5 3l14 9-14 9V3z"/>`, '--primary')}
        ${tl1Dots(step + 1, SDI_WALKTHROUGH_STEPS.length)}
        <div class="tl1-icon-pulse w-16 h-16 rounded-2xl flex items-center justify-center mx-auto bg-[color-mix(in_srgb,var(--gold)_16%,transparent)]" style="--tl1-icon-color:var(--gold)">
          <svg class="w-8 h-8 text-[var(--gold)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${s.icon}</svg>
        </div>
        <div>
          <h3 class="text-lg font-black leading-tight">${s.title}</h3>
          <p class="card-sub !mb-0 mt-1.5">${text}</p>
        </div>
        ${s.link ? `<a href="${SDI_PORTAL_URL}" target="_blank" rel="noopener noreferrer" class="w-full inline-flex items-center justify-center gap-1.5 text-[12px] font-bold px-3 py-2.5 rounded-xl bg-[color-mix(in_srgb,var(--gold)_15%,transparent)] border border-[color-mix(in_srgb,var(--gold)_30%,transparent)] text-[var(--gold)]">
          Apri il portale Fatture e Corrispettivi, vero
          <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>
        </a>` : ''}
        <div class="w-full flex gap-2">
          ${step > 0 ? `<button id="sdi-wt-back" class="btn-action flex-1 py-3 font-bold rounded-xl">← Indietro</button>` : ''}
          <button id="sdi-wt-next" class="btn-action btn-primary flex-1 py-3 font-bold rounded-xl">${isLast ? 'Fatto ✓' : 'Fatto, avanti →'}</button>
        </div>
        <p class="text-[10px] text-[var(--on-surface-secondary)] opacity-70">Passo ricreato nella sequenza ufficiale, non uno screenshot del portale — i nomi esatti delle voci possono cambiare nel tempo.</p>
      </div>`);
    document.getElementById('sdi-wt-back')?.addEventListener('click', () => { step--; render('back'); });
    document.getElementById('sdi-wt-next')?.addEventListener('click', () => {
      if (isLast) { window.openSdiWalkthroughDone(number, year); return; }
      step++; render('forward');
    });
  };
  render();
};
window.openSdiWalkthroughDone = (number, year) => {
  window.openModal(`
    <div class="flex flex-col gap-4 p-4 sm:p-6 lg:p-2 text-center items-center modal-section-in">
      ${tl1Icon('<path d="M20 6L9 17l-5-5"/>', '--green')}
      <div>
        <h3 class="text-lg font-black leading-tight">L'hai trasmessa?</h3>
        <p class="card-sub !mb-0 mt-1.5">Se hai premuto "Trasmetti" sul portale, segnala qui: sparisce dal promemoria e Momentum sa che è a posto.</p>
      </div>
      <div class="w-full flex flex-col gap-2">
        ${number != null ? `<button id="sdi-wt-mark" class="btn-action btn-primary w-full py-3 font-bold rounded-xl">Sì, l'ho trasmessa — segna fatto</button>` : ''}
        <a href="${SDI_PORTAL_URL}" target="_blank" rel="noopener noreferrer" class="btn-action w-full py-3 font-bold rounded-xl inline-flex items-center justify-center gap-1.5">Non ancora, apri il portale<svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg></a>
        <button onclick="window.closeModal()" class="text-[11px] text-[var(--on-surface-secondary)] underline">Ci penso dopo</button>
      </div>
    </div>`);
  document.getElementById('sdi-wt-mark')?.addEventListener('click', () => {
    window.markTransmitted(number, year);
    window.closeModal();
  });
};

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
  <div class="flex flex-col gap-3 p-3 sm:p-5 lg:p-0 modal-section-in">
    <div class="flex items-center gap-3">
      ${tl1Icon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15l2 2 4-4"/>', '--primary')}
      <div class="flex-1 min-w-0">
        <h3 class="text-lg font-black leading-tight">Crea fattura</h3>
        <p class="text-[11px] text-[var(--on-surface-secondary)]">n. ${num}/${year} · ${new Date().toLocaleDateString('it-IT')}</p>
      </div>
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
        ${(() => {
          // Tre stili, tre pubblici diversi (non decorazione a caso): "minimale"
          // è il registro delle grandi aziende e dei commercialisti (sobrio =
          // credibile, un cliente enterprise legge il colore forte come
          // inesperienza); "tecnico" per chi fattura consulenza IT/dev a
          // un'altra azienda; "vivace" per chi fattura al pubblico/creator,
          // dove farsi riconoscere vale più della formalità.
          const THEMES = [
            { id: 'minimale', label: 'Minimale', hint: 'Aziende grandi, commercialisti — la sobrietà è credibilità', grad: 'linear-gradient(135deg,#fbfaf7,#e7e2d8)' },
            { id: 'tecnico', label: 'Tecnico', hint: 'Consulenza IT/dev verso altre aziende', grad: 'linear-gradient(135deg,#0f172a,#1e293b)' },
            { id: 'vivace', label: 'Vivace', hint: 'Clienti privati, creator, freelance — si fa ricordare', grad: 'linear-gradient(135deg,#e11d48,#7c3aed)' },
          ];
          // Predittivo: se l'utente non ha MAI scelto un tema (nessun profilo
          // salvato) si parte già dal suggerimento più sensato invece che da
          // un default fisso — mai deciso al posto suo dopo la prima scelta.
          const cur = INVOICE_THEMES.includes(prof.theme) ? prof.theme : suggestInvoiceTheme('', '', 0);
          return `<div class="pt-1">
            <div class="text-[10px] font-bold text-[var(--on-surface-secondary)] uppercase tracking-wide mb-1.5">Stile del documento</div>
            <div id="inv-theme-picker" class="grid grid-cols-3 gap-2">
              ${THEMES.map(t => `
                <button type="button" data-theme="${t.id}" title="${t.hint}"
                  class="inv-theme-swatch flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${cur === t.id ? 'border-[var(--primary)]' : 'border-transparent'}">
                  <span class="w-full h-8 rounded-lg block" style="background:${t.grad}"></span>
                  <span class="text-[10px] font-bold">${t.label}</span>
                </button>`).join('')}
            </div>
            <div id="inv-theme-hint" class="text-[10px] text-[var(--on-surface-secondary)] mt-1.5 leading-snug">${THEMES.find(t => t.id === cur).hint}</div>
            <input type="hidden" id="inv-theme" value="${cur}" />
            <!-- Facoltativa, sempre spegnibile, e MAI sull'XML ufficiale (solo
                 sul PDF di cortesia). Acceso di default per "tecnico"/"vivace"
                 (pratica comune anche nei portali dei commercialisti, aiuta la
                 diffusione) ma NON per "minimale": quel tema esiste apposta
                 per la sobrietà istituzionale, un marchio in fondo
                 contraddirebbe la sua stessa promessa a un cliente enterprise. -->
            <label class="flex items-center gap-2 mt-2.5 text-[10px] text-[var(--on-surface-secondary)] cursor-pointer select-none">
              <input type="checkbox" id="inv-brand-credit" ${(prof.brandCredit !== undefined ? prof.brandCredit : cur !== 'minimale') ? 'checked' : ''} class="w-3.5 h-3.5 rounded accent-[var(--primary)]" />
              Aggiungi una piccola nota "Creato con Momentum" in fondo (facoltativo, mai sull'XML ufficiale)
            </label>
          </div>`;
        })()}
      </div>
    </details>
    ${(() => {
      // Chip clienti RICORRENTI: un tap ricompila tutto. Icona ricorrenza (oro)
      // sui ricorrenti; quelli con la fattura del mese da fare in evidenza oro.
      const rec = detectRecurringClients(VaultDAO.state.invoices || [], new Date()).slice(0, 5);
      if (!rec.length) return '';
      const miniRepeat = `<svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`;
      return `<div class="flex gap-2 overflow-x-auto pb-1">${rec.map((c, i) =>
        `<button type="button" data-recidx="${i}" class="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full border ${c.dueThisMonth ? 'border-[var(--gold)] text-[var(--gold)]' : 'border-[var(--glass-border)] text-[var(--on-surface-secondary)]'} bg-black/20">${c.monthly ? miniRepeat : ''}<span>${c.client}${c.typicalAmount ? ` · ${Math.round(c.typicalAmount)}€` : ''}</span></button>`).join('')}</div>`;
    })()}
    <!-- Layout NATIVO per schermo grande (richiesto esplicitamente): da
         tablet in su i campi principali si dispongono su due colonne
         (cliente a sinistra, importo/invio a destra) invece di restare
         un'unica colonna lunghissima identica a quella del telefono. Su
         mobile resta una singola colonna, invariato. -->
    <div class="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-x-4 lg:gap-y-3 lg:items-start">
      <div class="flex flex-col gap-3">
        <!-- RIGA UNICA (NL): scrivi la fattura come la diresti — anti-attrito,
             stessa filosofia della voce. "fattura a Rossi Srl 500 per
             consulenza" compila cliente, importo e causale con un tocco. -->
        <div class="flex gap-2">
          <input id="inv-oneline" class="${inputCls} flex-1" placeholder='Scrivila a parole: "a Rossi Srl 500 per consulenza"' autocomplete="off" />
          <button type="button" id="inv-oneline-fill" class="shrink-0 px-3 rounded-xl border border-[color-mix(in_srgb,var(--primary)_40%,transparent)] text-[var(--primary)] text-xs font-bold">Compila</button>
        </div>
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
      </div>
      <div class="flex flex-col gap-3">
        <input id="inv-amount" type="number" inputmode="decimal" class="${inputCls} font-mono" placeholder="Quanto (imponibile €)" />
        <input id="inv-desc" class="${inputCls}" placeholder="Per cosa (es. Consulenza marzo)" />
        <!-- Voci multiple: una fattura spesso NON è un solo importo indistinto
             ("4000 di sviluppo, 399 di hosting") — qui si scompone senza
             obbligare nessuno, resta un dettaglio apribile come gli altri.
             Ogni voce diventa una riga vera nell'XML, non solo un'annotazione. -->
        <div id="inv-extra-voci" class="flex flex-col gap-2"></div>
        <button type="button" id="inv-add-voce" class="self-start text-[11px] font-bold text-[var(--primary)] underline">+ Scomponi in più voci</button>
        <div id="inv-voci-total" class="hidden flex items-center justify-between text-[11px] text-[var(--on-surface-secondary)] border-t border-[var(--glass-border)] pt-2">
          <span>Totale imponibile</span><span id="inv-voci-total-val" class="font-mono font-bold text-[var(--on-surface)]"></span>
        </div>
        <input id="inv-email" type="email" class="${inputCls}" placeholder="Email cliente (per inviarla)" autocomplete="off" />
        <label class="block cursor-pointer select-none">
          <input id="inv-recurring" type="checkbox" class="recur-check" style="position:absolute;opacity:0;width:0;height:0" />
          <span class="recur-row">
            <span class="flex items-center gap-2 text-[12px] text-[var(--on-surface-secondary)] min-w-0">
              ${REPEAT_ICON}
              <span class="min-w-0"><b>Ricorrente ogni mese</b> <span class="text-[10px] text-[var(--on-surface-secondary)]">— te lo ricordo io</span></span>
            </span>
            <span class="recur-switch"></span>
          </span>
        </label>
        <div class="flex items-center gap-2 text-[11px] text-[var(--on-surface-secondary)]">
          <span class="shrink-0">Regime:</span>
          <div class="flex-1 min-w-0">${tl1Select('inv-regime', Object.entries(REGIMI).map(([k, v]) => ({ value: k, label: v.label.split('(')[0].trim() })), regime)}</div>
        </div>
      </div>
    </div>
    <div id="inv-preview" class="card p-3 text-xs text-[var(--on-surface-secondary)] hidden"></div>
    <!-- Esito controlli fattura elettronica (predizione scarti SdI, in chiaro) -->
    <div id="inv-xml-controls" class="hidden text-[11px] leading-snug rounded-xl border px-3 py-2.5"></div>
  </div>`;
}

// BUG REALE segnalato dal vivo, e la prima correzione (sticky dentro il
// corpo che scorre) era ANCORA SBAGLIATA: uno sticky resta comunque sotto
// tutti gli 11 campi finché non ci si arriva scorrendo — l'attrito reale
// (dover scorrere l'intero modulo prima di vedere un bottone) restava
// identico. Il bottone deve stare FUORI dall'area che scorre fin
// dall'inizio: qui va nel piè di pagina fisso di openModal (index.html
// #modal-footer), mai dentro #modal-body.
function getInvoiceFooterHTML() {
  return `
    <!-- Pulsante FATTURA ELETTRONICA (XML): primario per l'Italia. Nascosto
         per i Paesi/casi in cui non serve (allora resta solo il PDF). -->
    <button id="inv-xml" class="btn-action btn-primary w-full py-3 font-bold rounded-xl inline-flex items-center justify-center gap-2 hidden mb-2"><svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15l2 2 4-4"/></svg>Scarica fattura elettronica (XML)</button>
    <div class="flex gap-2 mb-2">
      <button id="inv-generate" class="flex-1 py-3 font-bold rounded-xl border border-[var(--glass-border)] bg-black/20 text-sm">Scarica PDF</button>
      <button id="inv-email-send" class="flex-1 py-3 font-bold rounded-xl border border-[var(--glass-border)] bg-black/20 text-sm inline-flex items-center justify-center gap-2"><svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>Invia con allegato</button>
    </div>
    <button id="inv-request-pay" class="w-full py-3 font-bold rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 text-sm inline-flex items-center justify-center gap-2"><svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="4" width="7" height="7" rx="1"/><path d="M14 14h3v3M20 20v.01M14 20v.01M20 14v.01"/></svg>Chiedi il pagamento (QR · WhatsApp · Email)</button>
    <p id="inv-foot" class="text-[11px] text-[var(--on-surface-secondary)] opacity-70 mt-2"></p>`;
}

window.openCreateInvoice = (prefillClient) => {
  openModal(getInvoiceFormHTML(), getInvoiceFooterHTML());
  // Modulo ricco di campi: da tablet in su usa una card più larga con
  // layout a due colonne (vedi CSS .modal-wide, index.html) invece della
  // stessa card stretta da telefono stiracchiata — nativo per lo schermo,
  // non un'unica taglia per tutti. Tolta alla chiusura così ogni altro
  // modale dell'app resta invariato.
  $('#modal-content').classList.add('modal-wide');
  $('#modal-footer').classList.add('modal-wide');
  const clientEl = $('#inv-client'), amountEl = $('#inv-amount'), descEl = $('#inv-desc'), regimeEl = $('#inv-regime'), prevEl = $('#inv-preview');
  const eur = (n) => `${(+n).toFixed(2).replace('.', ',')} €`;
  // Voci multiple: "4000 di sviluppo, 399 di hosting" invece di un unico
  // importo indistinto. La riga principale (descEl/amountEl) resta sempre
  // la prima voce — zero cambiamento per chi non apre mai questa sezione,
  // stessi campi di sempre. Le righe aggiunte sono puramente additive.
  const extraVociEl = $('#inv-extra-voci'), vociTotalEl = $('#inv-voci-total'), vociTotalValEl = $('#inv-voci-total-val');
  const voceInputCls = 'bg-black/30 border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-sm min-w-0';
  // Voci in percentuale (sconto/acconto/maggiorazione): "un 5% associato a un
  // costo" — non solo importi fissi. La percentuale si calcola SEMPRE sulla
  // base fissa in euro (voce principale + righe €), mai su altre percentuali:
  // due sconti del 10% non diventano un 20% composto né un 19% a cascata,
  // restano entrambi il 10% dello stesso importo di partenza — l'unico modo
  // di restare prevedibile quando le righe si possono riordinare o cancellare.
  const principaleImporto = () => parseFloat(String(amountEl.value).replace(',', '.')) || 0;
  const collectVoci = () => {
    const extraRows = [...(extraVociEl?.querySelectorAll('.inv-voce-row') || [])];
    const baseFissa = principaleImporto() + extraRows
      .filter((row) => (row.dataset.voceType || 'eur') === 'eur')
      .reduce((s, row) => s + (parseFloat(String(row.querySelector('.inv-voce-amount').value).replace(',', '.')) || 0), 0);
    const rows = [{ descrizione: (descEl.value || '').trim() || 'Prestazione professionale', importo: principaleImporto() }];
    extraRows.forEach((row) => {
      const d = (row.querySelector('.inv-voce-desc').value || '').trim();
      const raw = parseFloat(String(row.querySelector('.inv-voce-amount').value).replace(',', '.')) || 0;
      const type = row.dataset.voceType || 'eur';
      if (!raw) return;
      if (type === 'eur') { rows.push({ descrizione: d || 'Voce', importo: raw }); return; }
      const segno = type === 'pct-sconto' ? -1 : 1;
      const importoCalcolato = +((baseFissa * raw / 100) * segno).toFixed(2);
      const etichetta = type === 'pct-sconto' ? 'Sconto' : 'Maggiorazione';
      rows.push({ descrizione: d ? `${d} (${etichetta.toLowerCase()} ${raw}%)` : `${etichetta} ${raw}%`, importo: importoCalcolato });
    });
    return rows;
  };
  const totalImponibile = () => collectVoci().reduce((s, v) => s + v.importo, 0);
  const updateVociTotal = () => {
    const hasExtra = (extraVociEl?.querySelectorAll('.inv-voce-row').length || 0) > 0;
    vociTotalEl?.classList.toggle('hidden', !hasExtra);
    if (hasExtra && vociTotalValEl) vociTotalValEl.textContent = eur(totalImponibile());
  };
  // Ciclo di tre stati per il tipo di voce — un solo pulsante invece di un
  // altro menu a tendina, il tocco più veloce per un caso che capita spesso
  // ma non deve intimidire chi vuole solo un importo fisso (stato di default).
  const VOCE_TYPES = [
    { type: 'eur', label: '€', title: 'Importo fisso in euro' },
    { type: 'pct-sconto', label: '%−', title: 'Sconto: percentuale del totale, in negativo' },
    { type: 'pct-piu', label: '%+', title: 'Maggiorazione/acconto: percentuale del totale, in positivo' },
  ];
  const addVoceRow = () => {
    const row = document.createElement('div');
    row.className = 'flex flex-col gap-1 inv-voce-row tl1-step-in';
    row.dataset.voceType = 'eur';
    row.innerHTML = `
      <div class="flex gap-2 items-center">
        <input type="text" class="${voceInputCls} inv-voce-desc flex-1" placeholder="Descrizione voce" />
        <input type="number" inputmode="decimal" class="${voceInputCls} font-mono inv-voce-amount w-20 shrink-0" placeholder="€" />
        <button type="button" class="inv-voce-type shrink-0 w-11 h-9 rounded-xl border border-[var(--glass-border)] text-[11px] font-bold text-[var(--on-surface-secondary)]" title="${VOCE_TYPES[0].title}">${VOCE_TYPES[0].label}</button>
        <button type="button" class="inv-voce-remove shrink-0 w-9 h-9 rounded-xl border border-[var(--glass-border)] text-[var(--on-surface-secondary)]" aria-label="Rimuovi voce">✕</button>
      </div>
      <div class="inv-voce-computed hidden text-[10px] text-[var(--on-surface-secondary)] pl-1"></div>`;
    extraVociEl.appendChild(row);
    const amountInput = row.querySelector('.inv-voce-amount');
    const computedEl = row.querySelector('.inv-voce-computed');
    const typeBtn = row.querySelector('.inv-voce-type');
    const updateComputedHint = () => {
      const type = row.dataset.voceType;
      const raw = parseFloat(String(amountInput.value).replace(',', '.')) || 0;
      if (type === 'eur' || !raw) { computedEl.classList.add('hidden'); return; }
      const extraRows = [...extraVociEl.querySelectorAll('.inv-voce-row')];
      const baseFissa = principaleImporto() + extraRows
        .filter((r) => (r.dataset.voceType || 'eur') === 'eur')
        .reduce((s, r) => s + (parseFloat(String(r.querySelector('.inv-voce-amount').value).replace(',', '.')) || 0), 0);
      const segno = type === 'pct-sconto' ? -1 : 1;
      const val = +((baseFissa * raw / 100) * segno).toFixed(2);
      computedEl.classList.remove('hidden');
      computedEl.textContent = `= ${eur(val)} sul totale`;
    };
    const onChange = () => { refresh(); updateVociTotal(); updateComputedHint(); };
    typeBtn.addEventListener('click', () => {
      const idx = VOCE_TYPES.findIndex((t) => t.type === row.dataset.voceType);
      const next = VOCE_TYPES[(idx + 1) % VOCE_TYPES.length];
      row.dataset.voceType = next.type;
      typeBtn.textContent = next.label;
      typeBtn.title = next.title;
      amountInput.placeholder = next.type === 'eur' ? '€' : '%';
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        typeBtn.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      }
      onChange();
    });
    row.querySelector('.inv-voce-desc').addEventListener('input', onChange);
    amountInput.addEventListener('input', onChange);
    row.querySelector('.inv-voce-remove').addEventListener('click', () => { row.remove(); refresh(); updateVociTotal(); });
    row.querySelector('.inv-voce-desc')?.focus();
    updateVociTotal();
  };
  $('#inv-add-voce')?.addEventListener('click', addVoceRow);
  // Anteprima LIVE: mostra netto a ricevere e scomposizione a ogni modifica.
  // BUG REALE trovato rianalizzando il modulo (2026-08-06): computeInvoice
  // calcola già una `note` con la spiegazione legale (perché niente IVA/
  // ritenuta nel forfettario, art. 1 commi 54-89 L. 190/2014) ma la preview
  // la scartava — l'utente vedeva il numero giusto senza mai sapere perché.
  // Stessa cosa per il bollo: compare in elenco ma senza spiegare cos'è, il
  // punto #1 di confusione reale ("perché la fattura costa 2€ in più?").
  let prevTotale = null;
  const refresh = () => {
    syncGuidance();
    const imp = totalImponibile();
    if (!(imp > 0)) { prevEl.classList.add('hidden'); prevTotale = null; return; }
    const country = ($('#inv-country') && $('#inv-country').value) || 'IT';
    const inv = computeInvoice({ imponibile: imp, regime: regimeEl.dataset.value, country });
    prevEl.classList.remove('hidden');
    const bolloRiga = inv.righe.find((r) => r.voce === 'Marca da bollo');
    const voci = collectVoci();
    const vociBreakdown = voci.length > 1
      ? `<div class="mb-1.5 pb-1.5 border-b border-[var(--glass-border)]">${voci.map((v) => `<div class="flex justify-between items-center text-[var(--on-surface-secondary)]"><span class="truncate">${v.descrizione}</span><span class="font-mono shrink-0 ml-2">${eur(v.importo)}</span></div>`).join('')}</div>`
      : '';
    prevEl.innerHTML = `${vociBreakdown}${inv.righe.map((r) => `<div class="flex justify-between items-center"><span>${r.voce}${r === bolloRiga ? ` <button type="button" id="inv-bollo-why" class="text-[var(--gold)] underline font-bold">perché?</button>` : ''}</span><span class="font-mono">${eur(r.importo)}</span></div>`).join('')}
      ${bolloRiga ? `<div id="inv-bollo-explain" class="hidden mt-1 mb-1 text-[10px] text-[var(--on-surface-secondary)] leading-relaxed border-l-2 border-[var(--gold)]/40 pl-2">Le fatture senza IVA sopra 77,47€ richiedono per legge una marca da bollo da 2€ (DPR 642/1972, art. 13 n.1-bis) — Momentum la aggiunge da sola, non serve comprarla a parte.</div>` : ''}
      <div class="flex justify-between border-t border-[var(--glass-border)] mt-1 pt-1"><span class="font-bold">Totale fattura</span><span id="inv-prev-totale" class="font-mono">${eur(inv.totaleFattura)}</span></div>
      <div class="flex justify-between text-emerald-300 font-bold"><span>Riceverai</span><span id="inv-prev-netto" class="font-mono">${eur(inv.nettoARicevere)}</span></div>
      ${inv.note ? `<div class="mt-1.5 pt-1.5 border-t border-[var(--glass-border)] text-[10px] text-[var(--on-surface-secondary)] leading-relaxed">${inv.note}</div>` : ''}`;
    document.getElementById('inv-bollo-why')?.addEventListener('click', (e) => {
      document.getElementById('inv-bollo-explain')?.classList.toggle('hidden');
      e.stopPropagation();
    });
    // Micro-animazione: il netto "risponde" a ogni cifra digitata invece di
    // cambiare di scatto — lo stesso linguaggio del resto dell'app, qui
    // applicato al numero più guardato del modulo.
    if (prevTotale !== null && prevTotale !== inv.totaleFattura && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      ['inv-prev-totale', 'inv-prev-netto'].forEach((id) => {
        document.getElementById(id)?.animate(
          [{ transform: 'scale(1.12)', color: 'var(--gold)' }, { transform: 'scale(1)' }],
          { duration: 260, easing: 'cubic-bezier(.34,1.56,.64,1)' },
        );
      });
    }
    prevTotale = inv.totaleFattura;
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
    // BUG REALE trovato testando (2026-08-06): il pulsante XML sopra compare
    // solo qui, DOPO l'apertura del modale — cambia l'altezza del piè di
    // pagina fisso, ma lo spazio riservato sotto era stato calcolato una
    // sola volta all'apertura. Senza ricalcolarlo qui, l'anteprima e il
    // selettore regime restano nascosti dietro il footer cresciuto.
    const footer = $('#modal-footer'), body = $('#modal-body');
    if (footer && body && !footer.classList.contains('hidden')) body.style.paddingBottom = `${footer.offsetHeight + 16}px`;
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
    if (c.lastRegime && REGIMI[c.lastRegime]) tl1SelectSetValue("inv-regime", c.lastRegime);
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
  // Controlli specifici, live: cifra di controllo reale su P.IVA/Codice
  // Fiscale (tua e del cliente), formato su CAP (5 cifre) e Provincia (2
  // lettere) — prima non esisteva alcun feedback finché non arrivava lo
  // scarto SdI. Il Codice Fiscale del cliente è opzionale rispetto alla
  // P.IVA (basta uno dei due, verificato dove serve davvero): qui i due
  // campi restano indipendenti, ciascuno giudicato solo se compilato.
  tl1LiveValidate('inv-piva', isValidPartitaIva);
  tl1LiveValidate('inv-cf', isValidCodiceFiscale);
  tl1LiveValidate('inv-cap', (v) => /^\d{5}$/.test(v));
  tl1LiveValidate('inv-prov', (v) => /^[A-Za-z]{2}$/.test(v));
  tl1LiveValidate('inv-cli-piva', isValidPartitaIva);
  tl1LiveValidate('inv-cli-cf', isValidCodiceFiscale);
  tl1LiveValidate('inv-cli-cap', (v) => /^\d{5}$/.test(v));
  tl1LiveValidate('inv-cli-prov', (v) => /^[A-Za-z]{2}$/.test(v));
  // RIGA UNICA (NL) → compila cliente/importo/causale con un tocco (o Invio).
  const fillFromOneLine = () => {
    const parsed = parseInvoiceLine($('#inv-oneline')?.value || '');
    if (!parsed) { showToast('Scrivi almeno l\'importo, es. "a Rossi 500 per consulenza".', 'error'); return; }
    if (parsed.client) clientEl.value = parsed.client;
    amountEl.value = String(parsed.amount);
    if (parsed.description) descEl.value = parsed.description;
    clientEl.dispatchEvent(new Event('change'));
    refresh();
    showToast('Compilato. Controlla e genera.', 'success');
  };
  $('#inv-oneline-fill')?.addEventListener('click', fillFromOneLine);
  $('#inv-oneline')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); fillFromOneLine(); } });
  // Logo → data URI on-device (nessun upload esterno), tenuto in una var locale
  // e salvato nel profilo alla generazione. Limite dimensione per non gonfiare
  // il vault: se troppo grande, avvisa.
  // Selettore di stile: tre pubblici diversi, non tre colori a caso (spiegato
  // nella card sopra). Un tap sceglie, l'anteprima testuale sotto conferma la
  // scelta in parole — mai lasciare l'utente a indovinare cosa cambia.
  const THEME_HINTS = { minimale: 'Aziende grandi, commercialisti — la sobrietà è credibilità', tecnico: 'Consulenza IT/dev verso altre aziende', vivace: 'Clienti privati, creator, freelance — si fa ricordare' };
  let themeChosenByUser = INVOICE_THEMES.includes((VaultDAO.state.invoiceProfile || {}).theme);
  let brandCreditChosenByUser = (VaultDAO.state.invoiceProfile || {}).brandCredit !== undefined;
  const applyTheme = (id, { fromClick = false } = {}) => {
    const btn = document.querySelector(`.inv-theme-swatch[data-theme="${id}"]`);
    if (!btn) return;
    // Bug reale trovato dal vivo (stesso schema del conflitto sui modali):
    // "border-transparent" veniva assegnato al render iniziale e MAI rimosso
    // da questo handler — restava in conflitto con "border-[var(--primary)]"
    // aggiunta qui, e a seconda dell'ordine nel foglio CSS generato la
    // selezione visiva poteva restare sempre sullo stesso tema. Il toggle
    // ora è simmetrico: un solo colore di bordo alla volta, su ogni bottone.
    document.querySelectorAll('.inv-theme-swatch').forEach(b => {
      b.classList.remove('border-[var(--primary)]', 'border-transparent');
      b.classList.add(b === btn ? 'border-[var(--primary)]' : 'border-transparent');
    });
    if ($('#inv-theme')) $('#inv-theme').value = id;
    if ($('#inv-theme-hint')) $('#inv-theme-hint').textContent = (fromClick ? '' : '✨ Suggerito — ') + (THEME_HINTS[id] || '');
    // La nota "Creato con Momentum" segue il tema finché l'utente non ha mai
    // toccato la casella di persona: acceso ovunque tranne "minimale" (vedi
    // commento sopra il checkbox).
    if (!brandCreditChosenByUser && $('#inv-brand-credit')) $('#inv-brand-credit').checked = id !== 'minimale';
    // Micro-animazione di conferma scelta (stesso ritmo di sectionRise, mai
    // un'animazione nuova inventata), rispetta prefers-reduced-motion.
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      btn.animate([{ transform: 'scale(.94)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'cubic-bezier(.22,1.4,.36,1)' });
    }
  };
  document.querySelectorAll('.inv-theme-swatch').forEach(btn => btn.addEventListener('click', () => {
    themeChosenByUser = true; // da qui in poi il suggerimento live non lo tocca più
    applyTheme(btn.dataset.theme, { fromClick: true });
  }));
  $('#inv-brand-credit')?.addEventListener('change', () => { brandCreditChosenByUser = true; });
  // PREDITTIVO: finché l'utente non ha mai scelto un tema di persona, il
  // suggerimento segue in tempo reale cosa sta scrivendo (cliente/importo/
  // descrizione) — non un default statico, ma una lettura di CHI sta
  // fatturando. Si spegne per sempre al primo tap manuale sui tre stili.
  const liveThemeSuggest = () => {
    if (themeChosenByUser) return;
    const sugg = suggestInvoiceTheme(clientEl.value, descEl.value, totalImponibile());
    applyTheme(sugg);
  };
  clientEl.addEventListener('input', liveThemeSuggest);
  descEl.addEventListener('input', liveThemeSuggest);
  amountEl.addEventListener('input', liveThemeSuggest);
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
    const imp = totalImponibile();
    const voci = collectVoci();
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
      theme: INVOICE_THEMES.includes($('#inv-theme')?.value) ? $('#inv-theme').value : 'minimale',
      brandCredit: !!$('#inv-brand-credit')?.checked,
      country,
      fiscale: { ...fis, regime: regimeEl.dataset.value }, // ricordato per la prossima volta
    };
    const prof = VaultDAO.state.invoiceProfile;
    const clientEmail = (emailEl.value || '').trim();
    const year = new Date().getFullYear();
    const number = nextInvoiceNumber(VaultDAO.state.invoices || [], year);
    const inv = computeInvoice({ imponibile: imp, regime: regimeEl.dataset.value, country: prof.country });
    const meta = { number, year, date: new Date().toLocaleDateString('it-IT'), client, description: descEl.value.trim(), emitter: prof.emitter, emitterInfo, logo: prof.logo, accent: prof.accent, theme: prof.theme, country: prof.country, clientInfo, regime: regimeEl.dataset.value, ...(voci.length > 1 ? { voci } : {}) };
    // salva nello storico (numerazione + apprendimento cliente/email + dati
    // fiscali del cliente per il riuso + flag ricorrente per il promemoria)
    const recurring = !!($('#inv-recurring') && $('#inv-recurring').checked);
    const hasCliFiscal = cliFis.partitaIva || cliFis.codiceFiscale || cliFis.indirizzo;
    VaultDAO.state.invoices = [...(VaultDAO.state.invoices || []), { number, year, date: new Date().toISOString().slice(0, 10), client, imponibile: imp, description: descEl.value.trim(), regime: regimeEl.dataset.value, clientEmail, country: prof.country, ...(opts.electronic ? { isElectronic: true, sdiTransmitted: false } : {}), ...(hasCliFiscal ? { clientFiscale: cliFis } : {}), ...(recurring ? { recurring: true, cadence: 'mensile' } : {}), ...(voci.length > 1 ? { voci } : {}) }];
    // AUTO-ADDESTRAMENTO (chiude il loop, come richiesto): creare una fattura per
    // un cliente INSEGNA al sistema che i futuri accrediti da quel cliente sono
    // reddito da fattura — su due livelli:
    //  · classificatore entrate fiscale (taxLearned): l'accantonamento tasse
    //    scatta da solo per quel mittente, senza richiedere conferma;
    //  · Momentum Core (orchestrator): categorizza le entrate di quel cliente,
    //    così tutta l'app impara dallo stesso gesto. Onesto: impara dal nome
    //    reale che l'utente ha scritto, non da un'assunzione.
    if (client) {
      try {
        VaultDAO.state.taxLearned = learnIncomeType(VaultDAO.state.taxLearned || {}, client, 'invoice');
        VaultDAO.state.taxLearned = learnIncomeType(VaultDAO.state.taxLearned, `fattura ${client} ${descEl.value.trim()}`, 'invoice');
        window.momentumOrchestrator?.learn(client, 'stipendio', imp, new Date());
      } catch (_) { /* apprendimento best-effort: non blocca il salvataggio */ }
    }
    VaultDAO.save();
    // dati strutturati per la fattura elettronica (usati dall'handler XML)
    const emitterFiscal = { ...fis, denominazione: prof.emitter, regime: regimeEl.dataset.value, nazione: 'IT' };
    const clientFiscal = { ...cliFis, nazione: 'IT' };
    return { inv, meta, clientEmail, number, year, emitterFiscal, clientFiscal };
  };

  // "PDF di cortesia": apre il VERO documento disegnato (logo + colore +
  // stile scelto) in una scheda pronta per "Stampa → Salva come PDF" — non
  // il PDF minimale in bianco e nero generato byte a byte (quello resta solo
  // come riserva se il browser blocca la finestra). renderInvoiceHTML esiste
  // da tempo in invoice-engine.js ma non era mai stata collegata a un
  // bottone: qui il documento di cortesia diventa davvero un documento di
  // design, non un file di solo testo.
  $('#inv-generate').addEventListener('click', () => {
    const res = buildAndSave();
    if (!res) return;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(renderInvoiceHTML(res.inv, res.meta));
      win.document.close();
      win.addEventListener('load', () => setTimeout(() => win.print(), 250));
      closeModal();
      showToast(`Fattura n.${res.number}/${res.year} pronta — scegli "Salva come PDF" nella finestra di stampa.`, 'success');
    } else {
      // Riserva onesta: se il browser blocca i popup, il documento di solo
      // testo resta comunque scaricabile, invece di lasciare l'utente senza nulla.
      const fname = invoiceFilename({ number: res.number, year: res.year, client: res.meta.client, isoDate: new Date().toISOString().slice(0, 10) });
      const url = URL.createObjectURL(invoicePdfBlob(res.inv, res.meta));
      const a = document.createElement('a'); a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      closeModal();
      showToast('Popup bloccati dal browser: scaricata la versione semplice in PDF. Consenti i popup per la versione disegnata.', 'error');
    }
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

  // "Chiedi il pagamento": genera il bonifico SEPA (QR + WhatsApp/Email/copia)
  // che il CLIENTE usa per pagarti in una scansione. Beneficiario = tu, importo =
  // totale della fattura. Serve il TUO IBAN (dai dati fiscali).
  $('#inv-request-pay')?.addEventListener('click', () => {
    const emitter = ($('#inv-emitter').value || '').trim();
    const fis = currentFiscal();
    const imp = totalImponibile();
    if (!fis.iban) {
      const det = document.querySelector('#modal-body details'); if (det) det.open = true;
      $('#inv-iban')?.focus();
      showToast('Aggiungi il tuo IBAN nei dati fiscali per farti pagare.', 'error'); return;
    }
    if (!(imp > 0)) { amountEl.focus(); showToast('Inserisci l\'importo della fattura.', 'error'); return; }
    const inv = computeInvoice({ imponibile: imp, regime: regimeEl.dataset.value, country: ($('#inv-country') && $('#inv-country').value) || 'IT' });
    const year = new Date().getFullYear();
    const number = nextInvoiceNumber(VaultDAO.state.invoices || [], year);
    window.openSepaTransfer({
      mode: 'request', name: emitter, iban: fis.iban, amount: inv.totaleFattura,
      remittance: `Fattura ${number}/${year}${clientEl.value ? ' - ' + clientEl.value : ''}`.slice(0, 140),
      title: 'Chiedi il pagamento al cliente',
    });
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
    const imp = totalImponibile();
    const voci = collectVoci();
    const emitterFiscal = { ...currentFiscal(), denominazione: ($('#inv-emitter').value || '').trim(), regime: regimeEl.dataset.value, nazione: 'IT' };
    const clientFiscal = { ...currentClientFiscal(), nazione: 'IT' };
    const inv = (imp > 0) ? computeInvoice({ imponibile: imp, regime: regimeEl.dataset.value, country: 'IT' }) : { imponibile: 0 };
    const year = new Date().getFullYear();
    const number = nextInvoiceNumber(VaultDAO.state.invoices || [], year);
    const meta = { number, year, date: new Date().toISOString().slice(0, 10), regime: regimeEl.dataset.value, description: descEl.value.trim(), ...(voci.length > 1 ? { voci } : {}) };
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
    const out = buildFatturaPaXML({ emitter: res.emitterFiscal, client: res.clientFiscal, invoice: res.inv, meta: { number: res.number, year: res.year, date: new Date().toISOString().slice(0, 10), regime: regimeEl.dataset.value, description: res.meta.description, ...(res.meta.voci ? { voci: res.meta.voci } : {}) } });
    const warns = out.controls.filter(c => c.level === 'warn');
    const url = URL.createObjectURL(new Blob([out.xml], { type: 'application/xml' }));
    const a = document.createElement('a'); a.href = url; a.download = out.filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    box.className = 'text-[11px] leading-snug rounded-xl border px-3 py-2.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-200 modal-section-in';
    // BUG REALE segnalato dal vivo (2026-08-06): scaricare l'XML non guidava
    // nessuno a trasmetterlo — la guida esisteva ma serviva un secondo tap
    // su "Come si carica?" per vederla, e nessuna azione qui chiudeva il
    // ciclo. Ora la guida appare SUBITO (zero tap in più) e c'è un pulsante
    // che segna la fattura trasmessa nello stesso posto in cui l'hai appena
    // creata, invece di doverlo ricordare più tardi dal promemoria in Analisi.
    box.innerHTML = `<div class="flex items-center gap-2 font-bold mb-1"><svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Fattura elettronica pronta — ora trasmettila</div>
      <div><b>${out.filename}</b> è stato scaricato. Due minuti e hai finito: caricalo sul portale <b>Fatture e Corrispettivi</b> dell'Agenzia delle Entrate, oppure invialo al commercialista. Momentum non può caricarlo da solo: serve il tuo accesso ufficiale.</div>
      <div class="flex flex-wrap gap-2 mt-2">
        <a href="${SDI_PORTAL_URL}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-100">Apri il portale Fatture e Corrispettivi<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg></a>
        <button type="button" id="inv-mark-transmitted" class="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full border border-emerald-400/30 text-emerald-100/90">L'ho già caricata — segna trasmessa</button>
      </div>
      ${warns.length ? `<div class="mt-2 opacity-80">Nota: ${warns.map(w => w.message).join(' ')}</div>` : ''}`;
    box.classList.remove('hidden');
    showUploadHelp(out.filename, res.number, res.year);
    $('#inv-mark-transmitted')?.addEventListener('click', (e) => {
      window.markTransmitted(res.number, res.year);
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.className = 'inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full bg-emerald-500/30 border border-emerald-400/50 text-emerald-100';
      btn.innerHTML = '<svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>Trasmessa';
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        btn.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      }
    });
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
      if (c.lastRegime && REGIMI[c.lastRegime]) tl1SelectSetValue("inv-regime", c.lastRegime);
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
  const surplusEl = $('#invest-surplus'), noteEl = $('#invest-note'), regimeEl = $('#invest-regime'), fundBarEl = $('#invest-fund-bar');
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
  // Fondo d'emergenza: barra (non un secondo numero da leggere) — il vero
  // "perché" dietro il testo, pieno = puoi investire, altrimenti quanto manca.
  if (fundBarEl) {
    const target = Math.max(1, r.targetEmergency || 0);
    const pct = Math.min(100, Math.round((invested / target) * 100));
    const full = invested >= target;
    const barColor = full ? 'bg-emerald-400/80' : 'bg-[color-mix(in_srgb,var(--gold)_80%,transparent)]';
    fundBarEl.innerHTML = `
      <div class="flex items-center justify-between text-[11px] text-slate-500 mb-1">
        <span>Fondo d'emergenza</span>
        <span>${formatMoney(invested)} / ${formatMoney(target)}</span>
      </div>
      <div class="h-2 rounded-full bg-white/5 overflow-hidden"><div class="h-full rounded-full ${barColor}" style="width:${pct}%"></div></div>`;
  }
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
      // Barra invece di tabella di numeri: la barra chiara arriva fino al
      // "se va bene" (p95), quella piena color oro fino al "tipico" (p50), il
      // trattino verticale segna il "se va male" (p5) — leggibile a colpo
      // d'occhio, senza dover leggere le cifre riga per riga. Scala PER RIGA
      // (non su un massimo condiviso): la coda di Bitcoin è un ordine di
      // grandezza sopra le altre strategie, e su una scala condivisa
      // schiaccerebbe ogni altra barra a una linea invisibile — il numero
      // stampato a destra resta il modo per confrontare i valori assoluti.
      // VAGLIO STATISTICO (src/alpha/strategy-validation.js), collegato qui
      // perché è il punto in cui l'utente confronta 8 strategie insieme — ed è
      // esattamente la situazione in cui la migliore sembra buona per il solo
      // fatto di essere il massimo di 8 estrazioni. Il numero di tentativi è
      // il numero di righe mostrate, non 1: è la correzione che nessun
      // prodotto del settore applica.
      let vaglio = null;
      try {
        vaglio = validateStrategySet(proj.rows.map((r) => ({
          name: r.label,
          // Rendimenti annuali ricostruiti dai parametri della riga: la stessa
          // base su cui è costruita la proiezione mostrata sopra, così il
          // giudizio riguarda proprio ciò che l'utente sta guardando.
          returns: syntheticAnnualReturns(r.mu, r.sigma, 40, r.label.length * 13),
        })));
      } catch (_) { vaglio = null; }
      const solide = new Set((vaglio?.solide || []).map((s) => s.name));

      projEl.innerHTML = `
        <p class="text-[11px] text-[var(--on-surface-secondary)] mb-2">Strategia (10 anni) · chiaro = se va bene, pieno = tipico, trattino = se va male</p>
        <div class="space-y-2.5">${proj.rows.map(r => {
          const rowMax = Math.max(1, r.p95);
          const p95Pct = 100;
          const p50Pct = Math.min(100, (r.p50 / rowMax) * 100);
          const p5Pct = Math.min(100, (r.p5 / rowMax) * 100);
          const regge = solide.has(r.label);
          const marchio = vaglio
            ? (regge
              ? '<span class="text-emerald-400 text-[9px] font-bold" title="Il risultato storico regge anche tenendo conto che stai confrontando più strategie insieme">✓ regge</span>'
              : '<span class="text-amber-400/80 text-[9px] font-bold" title="Confrontando più strategie insieme, un risultato così capita anche per caso: non c\'è motivo di crederci più delle altre">~ può essere fortuna</span>')
            : '';
          return `<div class="text-[10px]">
            <div class="flex items-center justify-between mb-1 gap-2">
              <span class="text-[var(--on-surface-secondary)] truncate">${r.label}</span>
              <span class="flex items-center gap-2 shrink-0">${marchio}<span class="font-mono text-[var(--gold)]">${formatMoney(r.p50)}</span></span>
            </div>
            <div class="relative h-2 rounded-full bg-white/5 overflow-hidden" title="se va male ${formatMoney(r.p5)} · tipico ${formatMoney(r.p50)} · se va bene ${formatMoney(r.p95)}">
              <div class="absolute inset-y-0 left-0 rounded-full bg-[color-mix(in_srgb,var(--gold)_25%,transparent)]" style="width:${p95Pct}%"></div>
              <div class="absolute inset-y-0 left-0 rounded-full bg-[var(--gold)]" style="width:${p50Pct}%"></div>
              <div class="absolute inset-y-0 w-0.5 bg-rose-300/80" style="left:${p5Pct}%"></div>
            </div>
          </div>`;
        }).join('')}</div>
        ${vaglio ? `<p class="text-[10px] text-[var(--on-surface-secondary)] mt-2.5 leading-relaxed">${escapeHtml(vaglio.riassunto)} Stai confrontando ${vaglio.trials} strategie: più ne guardi insieme, più è facile che la migliore lo sia per caso.</p>` : ''}
        ${(() => {
          // src/core/data-freshness.js: i parametri storici (measured-assumptions.js)
          // sono generati una volta e poi restano fermi finché non si rilancia lo
          // script — l'app deve saperlo e dirlo, non mostrarli come sempre freschi.
          const nota = measuredAssumptions?.generatedAt ? stalenessNote(measuredAssumptions.generatedAt, { now: Date.now(), maxAgeDays: 90, label: 'I parametri storici misurati' }) : null;
          return nota ? `<p class="text-[10px] text-amber-300/80 mt-1">⏱ ${escapeHtml(nota)}</p>` : '';
        })()}`;
    } else projEl.innerHTML = '';
  }
  // Classifica settori S&P 500 (src/alpha/sector-rotation.js): Sharpe reale
  // misurato + regime attuale, MAI un "compra questo" — solo dati storici
  // ordinati, con la finestra reale coperta dichiarata (ETF nati fine 1998).
  const sectorEl = $('#sector-ranking');
  if (sectorEl) {
    const { rows, yearsCovered } = sectorRanking(measuredAssumptions);
    if (rows.length) {
      // Barra per Sharpe (leggibilità a colpo d'occhio) + pallino colorato per
      // il regime attuale (verde = risk-on, ambra = neutral, rosso = risk-off)
      // invece di una colonna testuale da leggere riga per riga.
      const maxSharpe = Math.max(0.01, ...rows.map(r => r.sharpe));
      const regimeColor = (r) => r === 'risk-on' ? 'bg-emerald-400' : r === 'risk-off' ? 'bg-rose-400' : 'bg-amber-300';
      sectorEl.innerHTML = `<p class="text-[11px] text-[var(--on-surface-secondary)] mb-2">Settori S&P 500 per rendimento/rischio storico (~${yearsCovered} anni misurati, mai una previsione)</p>
        <div class="space-y-2">${rows.map(r => {
          const pct = Math.max(4, Math.round((r.sharpe / maxSharpe) * 100));
          return `<div class="text-[10px]">
            <div class="flex items-center justify-between mb-0.5">
              <span class="flex items-center gap-1.5 text-[var(--on-surface-secondary)]"><span class="inline-block w-1.5 h-1.5 rounded-full ${regimeColor(r.regime)}" title="Regime ora: ${r.regime || '—'}"></span>${r.label}</span>
              <span class="font-mono text-[var(--gold)]">${r.sharpe.toFixed(2)}</span>
            </div>
            <div class="h-1.5 rounded-full bg-white/5 overflow-hidden"><div class="h-full rounded-full bg-[color-mix(in_srgb,var(--gold)_70%,transparent)]" style="width:${pct}%"></div></div>
          </div>`;
        }).join('')}</div>`;
    } else sectorEl.innerHTML = '';
  }
}

// Drill-down giorno-per-giorno sulla heatmap "Le tue spese giorno per giorno":
// il title nativo non appare mai su tocco (touch), quindi il tap deve aprire
// un pannello visibile con le voci reali di quel giorno — mai solo la cifra.
let __heatmapDayTx = {};
let __heatmapMonthLabel = '';
document.addEventListener('click', (e) => {
  const cell = e.target.closest('.heatmap-day');
  if (!cell) return;
  const day = cell.dataset.heatmapDay;
  const detailEl = $('#heatmap-day-detail');
  if (!detailEl) return;
  document.querySelectorAll('.heatmap-day').forEach(c => c.classList.remove('ring-2', 'ring-[var(--gold)]'));
  cell.classList.add('ring-2', 'ring-[var(--gold)]');
  const dayTxs = __heatmapDayTx[day] || [];
  if (!dayTxs.length) {
    detailEl.innerHTML = `<p class="text-[10px] text-[var(--on-surface-secondary)] p-2">${day} ${__heatmapMonthLabel}: nessuna spesa registrata.</p>`;
    return;
  }
  const total = dayTxs.reduce((s, t) => s + t.amount, 0);
  const rows = [...dayTxs].sort((a, b) => b.amount - a.amount).map(t => {
    const cat = getCatById(t.category);
    return `<div class="flex items-center justify-between text-[10px] py-1 border-b border-white/5 last:border-0">
      <span class="text-[var(--on-surface-secondary)]">${cat?.name || t.category}${t.note ? ` · ${t.note}` : ''}</span>
      <span class="font-mono text-slate-200">${formatMoney(t.amount)}</span>
    </div>`;
  }).join('');
  detailEl.innerHTML = `<div class="p-2.5 rounded-lg bg-black/20">
    <div class="flex items-baseline justify-between mb-1.5">
      <span class="text-[11px] font-bold text-slate-200">${day} ${__heatmapMonthLabel}</span>
      <span class="font-mono text-[13px] font-bold text-[var(--gold)]">${formatMoney(total)}</span>
    </div>
    ${rows}
  </div>`;
});

// Confronto periodi (src/predict/period-compare.js): richiesto esplicitamente
// "confrontare periodi come mesi di quest'anno e passati". Il mese/anno IN
// CORSO è sempre escluso dal calcolo (parziale, falserebbe il confronto con
// uno completo) — si confronta l'ultimo periodo COMPLETO col precedente.
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.period-cmp-btn');
  if (!btn) return;
  renderPeriodCompare(btn.dataset.periodCompare);
});
let __periodCompareMode = 'month';
function renderPeriodCompare(mode = __periodCompareMode) {
  __periodCompareMode = mode;
  const bodyEl = $('#period-compare-body');
  if (!bodyEl) return;
  const allTx = VaultDAO.state.transactions || {};
  const ref = new Date();
  const isYear = mode === 'year';
  const curKeys = isYear ? lastNMonthKeys(ref, 12, 1) : lastNMonthKeys(ref, 1, 1);
  const prevKeys = isYear ? lastNMonthKeys(ref, 12, 13) : lastNMonthKeys(ref, 1, 2);
  const r = comparePeriods(allTx, curKeys, prevKeys);
  if (r.current === 0 && r.previous === 0) {
    bodyEl.innerHTML = `<p class="text-[11px] text-[var(--on-surface-secondary)]">Non ho ancora ${isYear ? 'due anni' : 'due mesi'} completi di storia da confrontare.</p>`;
    return;
  }
  const periodLabel = isYear ? 'quest\'anno (12 mesi) vs anno scorso' : 'mese scorso vs il precedente';
  const rows = r.rows.filter(row => row.current > 0 || row.previous > 0).slice(0, 6);
  const labelCap = periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1);
  const up = r.totalDeltaPct > 0;
  const totalColor = up ? 'text-rose-300' : 'text-emerald-300';
  const totalArrow = up ? '↑' : (r.totalDeltaPct < 0 ? '↓' : '→');
  // Barra affiancata (mai solo numeri): il rettangolo pieno mostra a colpo
  // d'occhio il rapporto tra i due periodi, comprensibile anche senza
  // leggere le cifre — "esperto e bambino" con lo stesso sguardo.
  const maxVal = Math.max(1, ...rows.flatMap(row => [row.current, row.previous]));
  bodyEl.innerHTML = `
    <div class="flex items-baseline gap-2 mb-3 p-2 rounded-lg bg-black/20">
      <span class="text-xl font-black font-mono ${totalColor}">${totalArrow} ${up ? '+' : ''}${r.totalDeltaPct}%</span>
      <span class="text-[11px] text-slate-500">${labelCap} · ${formatMoney(r.previous)} → ${formatMoney(r.current)}</span>
    </div>
    <div class="space-y-2">${rows.map(row => {
      const cat = getCatById(row.category);
      const rowUp = row.deltaPct > 0;
      const color = rowUp ? 'text-rose-300' : row.deltaPct < 0 ? 'text-emerald-300' : 'text-[var(--on-surface-secondary)]';
      const barColor = rowUp ? 'bg-rose-400/70' : 'bg-emerald-400/70';
      const prevPct = Math.round((row.previous / maxVal) * 100);
      const curPct = Math.round((row.current / maxVal) * 100);
      const arrow = rowUp ? '↑' : (row.deltaPct < 0 ? '↓' : '→');
      return `<div class="text-[10px]">
        <div class="flex items-center justify-between mb-0.5">
          <span class="text-[var(--on-surface-secondary)] truncate">${cat?.name || row.category}</span>
          <span class="font-mono shrink-0 ml-2 ${color}">${arrow} ${row.deltaPct > 0 ? '+' : ''}${row.deltaPct}%</span>
        </div>
        <div class="flex items-center gap-1.5">
          <div class="flex-1 h-2.5 rounded-full bg-white/5 overflow-hidden relative" title="Prima: ${formatMoney(row.previous)}">
            <div class="h-full bg-slate-500/50 rounded-full" style="width:${prevPct}%"></div>
          </div>
          <div class="flex-1 h-2.5 rounded-full bg-white/5 overflow-hidden relative" title="Ora: ${formatMoney(row.current)}">
            <div class="h-full ${barColor} rounded-full" style="width:${curPct}%"></div>
          </div>
        </div>
      </div>`;
    }).join('')}</div>
    <p class="text-[10px] text-slate-600 mt-2">Barra grigia = prima, colorata = ora — stessa scala per categoria</p>`;
}

// Grafo causale visivo — ora dietro `analyzeCausalStructure`
// (src/predict/causal-orchestrator.js), che sceglie da solo il motore giusto:
// PCMCI (scoperta di struttura + correzione Benjamini-Yekutieli, non solo
// coppie) quando c'è abbastanza storia, il vecchio metodo a coppie quando non
// ce n'è ancora — DICHIARANDO quale dei due sta usando, mai spacciando il
// meno potente per il risultato definitivo. Layout a cerchio invariato;
// cambia cosa alimenta gli archi e cosa dice il testo sotto.
// Contesto macro (predict/macro-context.js) tenuto in cache di sessione: un
// tasso di riferimento non cambia più volte al giorno, e ricaricarlo a ogni
// apertura della Dashboard sarebbe solo traffico sprecato. Fonte SENZA
// CHIAVE (BIS, verificata CORS-aperta dal vivo): funziona per ogni utente
// dal primo avvio, zero attrito — risponde diretto a "i dati non sono
// integrati e servono una chiave che pochi hanno": qui non ne serve nessuna.
let __macroContextCache = null;
let __macroContextFetchInCorso = false;
async function ensureMacroContext(weeks) {
  if (__macroContextCache || __macroContextFetchInCorso) return __macroContextCache;
  __macroContextFetchInCorso = true;
  try {
    const r = await fetchMacroSeries({ fetchImpl: fetch.bind(window) }); // default: BCE, verificato dal vivo
    if (r.affidabile && r.series.length) {
      const allineato = alignMacroToWeeks(r.series, { weeks, referenceDate: new Date() });
      if (allineato.copertura >= 0.3) {
        __macroContextCache = { ...allineato, label: 'il tasso di riferimento BCE/BIS' };
        // Raggiunta la fonte davvero: lo si mette a disposizione della mesh
        // per chi non ci riesce (firewall, rete mobile che blocca l'API, in
        // quel momento la fonte è in rate-limit). Riusa knowledge-relay.js,
        // che ricontrolla la plausibilità in locale invece di fidarsi
        // dell'etichetta — chi riceve non deve fidarsi di noi sulla parola.
        shareMacroKnowledge(r);
        return __macroContextCache;
      }
    }
  } catch (_) {
    // onesto: senza rete si prova comunque con quanto la mesh ha già portato
  } finally {
    __macroContextFetchInCorso = false;
  }
  // Non siamo riusciti a raggiungere la fonte da soli: proviamo con quanto
  // un altro dispositivo della mesh ha già raccolto e verificato. È il
  // punto vero di questa funzionalità — non risparmiare un fetch, ma
  // funzionare per chi altrimenti resterebbe senza contesto macro del
  // tutto (rete che blocca le API di FRED/BCE ma non la mesh P2P stessa).
  const dallaMesh = await macroKnowledgeFromMesh(weeks);
  if (dallaMesh) __macroContextCache = dallaMesh;
  return __macroContextCache;
}

// ── Staffetta della conoscenza macro (knowledge-relay.js) ──
// VaultDAO.state.knowledgeRelay: store additivo, mai personale — solo serie
// pubbliche già verificate. Vedi knowledge-relay.js per il perché di ogni
// scelta di fiducia; qui c'è solo il collegamento ai punti reali dell'app.
function shareMacroKnowledge(rawFetchResult) {
  if (!momentumMeshNode?.shareKnowledge) return;
  import('./mesh/knowledge-relay.js').then(({ packForRelay }) => {
    const pkg = packForRelay(rawFetchResult, { symbol: rawFetchResult.symbol, kind: rawFetchResult.kind });
    if (pkg) momentumMeshNode.shareKnowledge(pkg);
  }).catch(() => {});
}

async function macroKnowledgeFromMesh(weeks) {
  const store = VaultDAO.state.knowledgeRelay;
  if (!store) return null;
  const { bestKnown } = await import('./mesh/knowledge-relay.js');
  const best = bestKnown(store, 'FM/D.U2.EUR.4F.KR.MRR_FR.LEV', 'macro') || bestKnown(store, 'WS_CBPOL', 'macro');
  if (!best || !best.trainingEligible || !best.prices?.length) return null;
  const allineato = alignMacroToWeeks(best.prices, { weeks, referenceDate: new Date() });
  if (allineato.copertura < 0.3) return null;
  return { ...allineato, label: 'il tasso di riferimento BCE/BIS (da un altro tuo dispositivo)' };
}

async function renderCausalGraphViz() {
  const el = $('#causal-graph-viz');
  if (!el) return;
  const allTx = VaultDAO.state.transactions || {};
  const WEEKS = 26;
  const series = buildCategorySeries(allTx, new Date(), WEEKS);
  const macroContext = __macroContextCache; // usa la cache se già pronta, mai blocca il primo render
  const analisi = analyzeCausalStructure(series, { allTx, maxLag: 3, macroContext });
  if (!macroContext) {
    // Primo giro senza contesto macro: lo si recupera in background e, se
    // arriva, si ridisegna UNA volta sola — mai un'attesa percepibile.
    ensureMacroContext(WEEKS).then((ctx) => { if (ctx) renderCausalGraphViz(); });
  }

  // Adatta i due formati di link (base: {from,to,r,lagWeeks,samples};
  // pcmci: {from,to,r,p,lag,n}) a un'unica forma per il disegno.
  const links = (analisi.motore === 'pcmci' ? analisi.links : analisi.links)
    .map((l) => ({
      from: l.from, to: l.to, r: l.r,
      lagLabel: analisi.motore === 'pcmci'
        ? (l.lag === 0 ? 'nella stessa settimana' : `con ${l.lag} settiman${l.lag === 1 ? 'a' : 'e'} di ritardo`)
        : (l.lagWeeks === 0 ? 'nella stessa settimana' : `con ${l.lagWeeks} settiman${l.lagWeeks === 1 ? 'a' : 'e'} di ritardo`),
      samples: analisi.motore === 'pcmci' ? l.n : l.samples,
      p: l.p,
    }));

  if (!links.length) {
    el.innerHTML = `<p class="text-[11px] text-[var(--on-surface-secondary)]">${escapeHtml(analisi.riassunto || 'Non emergono ancora legami affidabili tra categorie nei tuoi dati (serve più storia).')}</p>`;
    return;
  }
  const effettoPer = new Map((analisi.edges || []).map((e) => [`${e.from}|${e.to}`, e]));
  const top = links.slice(0, 10);
  const cats = [...new Set(top.flatMap(l => [l.from, l.to]))];
  const n = cats.length;
  const R = 92, CX = 120, CY = 120;
  const pos = {};
  // Se ci sono solo 2 categorie il cerchio degenera in una linea verticale
  // (0° e 180°) — poco leggibile come "grafo". Le distribuiamo invece su un
  // asse orizzontale in quel caso, resta comunque un cerchio pieno da 3 in su.
  cats.forEach((c, i) => {
    const a = n === 2 ? (i === 0 ? Math.PI : 0) : (i / n) * Math.PI * 2 - Math.PI / 2;
    pos[c] = { x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) };
  });
  const arcs = top.map(l => {
    const p1 = pos[l.from], p2 = pos[l.to];
    const strength = Math.min(1, Math.abs(l.r));
    const color = l.r >= 0 ? '#34d399' : '#fb7185';
    const catA = getCatById(l.from)?.name || l.from, catB = getCatById(l.to)?.name || l.to;
    const eff = effettoPer.get(`${l.from}|${l.to}`);
    // Frase per arco leggibile senza sapere cos'è una correlazione: l'effetto
    // quantificato quando c'è, altrimenti solo la direzione temporale misurata.
    const frase = eff
      ? `Quando ${catA} sale, ${catB} tende a ${eff.beta >= 0 ? 'salire' : 'scendere'} ${l.lagLabel} (effetto stimato ${eff.beta >= 0 ? '+' : ''}${eff.beta}).`
      : `${catA} e ${catB} si muovono ${l.r >= 0 ? 'insieme' : 'in direzione opposta'} ${l.lagLabel}.`;
    return `<line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}" stroke="${color}" stroke-width="${(1.5 + strength * 4).toFixed(1)}" opacity="${(0.4 + strength * 0.5).toFixed(2)}" stroke-linecap="round"><title>${frase}</title></line>`;
  }).join('');
  const nodes = cats.map(c => {
    const cat = getCatById(c);
    const p = pos[c];
    const fill = cat?.color || '#94a3b8';
    return `<g class="causal-node" style="cursor:pointer">
      <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="10" fill="${fill}" opacity="0.18"/>
      <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="6" fill="${fill}" stroke="#0b0f1a" stroke-width="1.5"/>
      <title>${cat?.name || c}</title>
    </g>`;
  }).join('');
  const labels = cats.map(c => {
    const cat = getCatById(c);
    const p = pos[c];
    const dx = p.x > CX ? 12 : (p.x < CX ? -12 : 0);
    const dy = p.y > CY ? 14 : (p.y < CY ? -14 : 0);
    const anchor = p.x > CX + 5 ? 'start' : (p.x < CX - 5 ? 'end' : 'middle');
    const label = String(cat?.name || c).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    return `<text x="${(p.x + dx).toFixed(1)}" y="${(p.y + dy).toFixed(1)}" font-size="9" font-weight="600" fill="#e2e8f0" text-anchor="${anchor}" dominant-baseline="middle">${label}</text>`;
  }).join('');

  // Motore usato + eventuali avvertimenti della diagnosi: la persona deve
  // sapere se questi legami reggono per DECIDERE o solo per DESCRIVERE.
  const motoreTxt = analisi.motore === 'pcmci'
    ? 'Controllo avanzato (tiene conto di più categorie insieme).'
    : `Controllo di base — ${analisi.motivoMotoreBase || 'serve più storia per quello avanzato'}`;
  const avvisiGravi = (analisi.diagnosi?.avvertimenti || []).filter((a) => a.gravita === 'alta');
  const avvisiHtml = avvisiGravi.length
    ? `<div class="mt-1.5 flex flex-col gap-1">${avvisiGravi.map((a) => `<p class="text-[10px] text-amber-300/90">⚠ ${escapeHtml(a.dettaglio || '')}</p>`).join('')}</div>`
    : '';
  const nonLinHtml = (analisi.nonLineari || []).length
    ? `<p class="text-[10px] text-[var(--primary)]/90 mt-1">+ ${analisi.nonLineari.length} legame${analisi.nonLineari.length === 1 ? '' : 'i'} nascost${analisi.nonLineari.length === 1 ? 'o' : 'i'}: c'è una relazione ma non è una linea retta (spesso una soglia).</p>`
    : '';

  // Chiude il cerchio tra "trovato un legame" e "verificalo davvero"
  // (src/predict/experiment-tracker.js + anytime-experiment.js): per ogni
  // categoria coinvolta, un chip che apre l'esperimento — mostra lo stato se
  // già in corso, propone di avviarlo se no. Nessun'altra app di questo
  // settore chiude questo cerchio.
  // AUTO-APPRENDIMENTO (la diagnosi corregge la proposta, non solo la
  // descrive): categorie il cui legame è già spiegato da un fattore macro
  // reale (predict/macro-context.js) — proporre "prova a cambiare X" qui
  // sarebbe una leva finta, perché il legame non dipende dalla categoria
  // stessa ma da un tasso che si muove per conto suo. Si mostra il motivo
  // invece del bottone. Ma un esperimento GIÀ avviato o concluso non sparisce
  // mai dietro una scoperta arrivata dopo (classifyCategoryChips.js, testato
  // a parte): la spiegazione macro diventa solo una nota nel tooltip.
  const chipData = classifyCategoryChips(cats, {
    avvertimenti: analisi.diagnosi?.avvertimenti || [],
    experiments: VaultDAO.state.experiments,
    allTx,
    now: new Date(),
    experimentStatusFn: experimentStatus,
  });
  const espChips = chipData.map(({ categoria: c, tipo, stato, spiegazioneMacro }) => {
    const cat = getCatById(c);
    const nome = cat?.name || c;
    if (tipo === 'macro-spiegato') {
      return `<span class="text-[9px] px-2 py-1 rounded-lg border border-dashed border-[var(--outline)] text-[var(--on-surface-secondary)]" title="Il legame di questa categoria sembra spiegato da ${escapeHtml(spiegazioneMacro)}, non da una relazione diretta: un esperimento qui non avrebbe senso.">~ ${escapeHtml(nome)}: spiegato dal contesto</span>`;
    }
    if (tipo === 'proponi') {
      return `<button class="rk-place text-[9px] px-2 py-1 rounded-lg border border-[var(--outline)]" data-exp-start="${escapeHtml(c)}">▶ Prova a cambiare ${escapeHtml(nome)}</button>`;
    }
    const colore = stato.conclusione === 'cambiato' ? 'text-emerald-400 border-emerald-500/30' : stato.conclusione === 'nessun-cambiamento' ? 'text-[var(--on-surface-secondary)] border-[var(--outline)]' : 'text-amber-300 border-amber-500/30';
    const nota = spiegazioneMacro ? ` — nota: il legame sembra spiegato da ${escapeHtml(spiegazioneMacro)}` : '';
    return `<button class="text-[9px] px-2 py-1 rounded-lg border ${colore}" data-exp-open="${escapeHtml(c)}" title="${escapeHtml(nome)}${nota}">◉ ${escapeHtml(nome)}: ${stato.conclusione ? (stato.conclusione === 'cambiato' ? 'confermato' : stato.conclusione === 'nessun-cambiamento' ? 'nessun effetto' : '') : 'in corso'}</button>`;
  }).join('');

  el.innerHTML = `
    <svg viewBox="0 0 240 240" class="w-full" style="max-height:260px">
      <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-dasharray="2 4"/>
      ${arcs}${nodes}${labels}
    </svg>
    <p class="text-[11px] text-slate-500 mt-1.5">Verde = si muovono insieme, rosso = in direzione opposta. Spessore = quanto è forte il legame. Tocca un punto o una linea per i dettagli.</p>
    <p class="text-[10px] text-slate-600 mt-1">${escapeHtml(motoreTxt)}</p>
    ${avvisiHtml}${nonLinHtml}
    <div class="flex flex-wrap gap-1.5 mt-2">${espChips}</div>`;

  el.querySelectorAll('[data-exp-start]').forEach((btn) => {
    btn.addEventListener('click', () => window.openExperimentPanel(btn.dataset.expStart));
  });
  el.querySelectorAll('[data-exp-open]').forEach((btn) => {
    btn.addEventListener('click', () => window.openExperimentPanel(btn.dataset.expOpen));
  });
}

// Pannello dell'esperimento: propone di avviarlo (se non in corso) o mostra
// lo stato valido-in-ogni-istante (src/predict/anytime-experiment.js) —
// guardabile ogni giorno senza intaccare la garanzia statistica, ed è
// esattamente il punto: nessuna app di finanza personale verifica mai se il
// suo consiglio ha funzionato davvero.
window.openExperimentPanel = (category) => {
  const cat = getCatById(category);
  const nome = cat?.name || category;
  const allTx = VaultDAO.state.transactions || {};
  const stato = experimentStatus(VaultDAO.state.experiments, category, allTx, { now: new Date() });

  if (!stato) {
    openModal(`
      <div class="flex flex-col gap-3 p-3 sm:p-5 lg:p-0 text-center items-center">
        <h3 class="text-base font-black">Prova a cambiare ${escapeHtml(nome)}</h3>
        <p class="card-sub !mb-0">Fotografiamo le ultime settimane come riferimento. Poi, quando vuoi — anche ogni giorno — ti dico se è cambiato davvero, non solo se sembra.</p>
        <button id="exp-start-go" class="btn-action btn-primary w-full py-3 font-bold rounded-2xl">Comincia adesso</button>
      </div>`);
    document.getElementById('exp-start-go').addEventListener('click', () => {
      VaultDAO.state.experiments = startCategoryExperiment(VaultDAO.state.experiments, category, allTx, { now: new Date() });
      VaultDAO.save();
      showToast('Esperimento avviato. Torna quando vuoi.', 'success');
      closeModal();
      renderCausalGraphViz();
    });
    return;
  }

  const dots = stato.puoiFermarti === false
    ? `<p class="text-[11px] text-[var(--on-surface-secondary)]">Settimana ${stato.settimanePassate} di almeno ${stato.periodiMinimi || 4}.</p>`
    : '';
  const verdettoColore = stato.conclusione === 'cambiato' ? 'text-emerald-300' : stato.conclusione === 'nessun-cambiamento' ? 'text-[var(--on-surface-secondary)]' : 'text-amber-300';
  openModal(`
    <div class="flex flex-col gap-3 p-3 sm:p-5 lg:p-0 text-center items-center">
      <h3 class="text-base font-black">${escapeHtml(nome)}</h3>
      <p class="text-[11px] text-[var(--on-surface-secondary)]">Prima: ${formatMoney(stato.mediaBaseline)}/settimana in media.</p>
      <p class="text-[13px] font-bold ${verdettoColore}">${escapeHtml(stato.messaggio)}</p>
      ${dots}
      <button id="exp-stop-go" class="text-[11px] text-[var(--on-surface-secondary)] underline">Ferma questo esperimento</button>
    </div>`);
  document.getElementById('exp-stop-go').addEventListener('click', () => {
    VaultDAO.state.experiments = stopCategoryExperiment(VaultDAO.state.experiments, category);
    VaultDAO.save();
    closeModal();
    renderCausalGraphViz();
  });
};

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
// Ogni card di alert/insight aveva SOLO un bordo colorato + titolo maiuscolo:
// una fila di scatole identiche, indistinguibili a colpo d'occhio (segnalato
// dall'utente: "sembrano tirate a caso"). L'icona nel badge colorato dà a
// ognuna una forma riconoscibile prima ancora di leggere il testo.
const SEVERITY_STYLE = {
  danger: { border: 'border-rose-500/20 bg-rose-950/5', text: 'text-rose-400', badge: 'bg-rose-500/15', icon: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/>' },
  warn:   { border: 'border-amber-500/20 bg-amber-950/5', text: 'text-amber-400', badge: 'bg-amber-500/15', icon: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>' },
  info:   { border: 'border-sky-500/20 bg-sky-950/5', text: 'text-sky-400', badge: 'bg-sky-500/15', icon: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>' },
  positive: { border: 'border-emerald-500/20 bg-emerald-950/5', text: 'text-emerald-400', badge: 'bg-emerald-500/15', icon: '<path d="M20 6L9 17l-5-5"/>' },
  recap: { border: 'border-indigo-500/20 bg-indigo-950/5', text: 'text-indigo-400', badge: 'bg-indigo-500/15', icon: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 3v3M16 3v3"/>' },
};
function insightCardHeader(style, title) {
  return `<div class="flex items-center gap-2 mb-2">
    <span class="shrink-0 w-6 h-6 rounded-full ${style.badge} flex items-center justify-center">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 ${style.text}">${style.icon}</svg>
    </span>
    <h4 class="text-[10px] font-bold ${style.text} uppercase tracking-widest">${title}</h4>
  </div>`;
}

function renderRadarAlerts(k, budgetLimit, hwDailyLevel) {
  try { renderSubscriptions(); } catch (e) { console.error('renderSubscriptions:', e); } // abbonamenti trovati (Ghost Charge Radar)
  try { renderPriceAlerts(); } catch (e) { console.error('renderPriceAlerts:', e); } // avvisi di prezzo attivi (Cerca un asset)
  try { renderWatchlist(); } catch (e) { console.error('renderWatchlist:', e); } // asset seguiti, prezzo auto-aggiornato (Cerca un asset)
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
        ${insightCardHeader(SEVERITY_STYLE.danger, 'Spese insolite: le riconosci?')}
        <div class="space-y-2 text-xs text-[var(--on-surface-secondary)]">
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

  // ── BNPL stacking (src/predict/bnpl.js): il numero che nessun Klarna/PayPal
  // vede da solo, perché ognuno vede solo i propri piani. Entra nello STESSO
  // feed unificato e nello STESSO bandit di ranking degli altri insight —
  // niente riquadro a parte, coerente col resto (non appesantisce la card).
  try {
    const bnpl = bnplExposure(VaultDAO.state.transactions,
      { now: realNow.getTime(), learned: VaultDAO.state.mlData?.bnplLearned || {}, anticipate: true, dismissed: VaultDAO.state.mlData?.bnplDismissed || [] });
    if (bnpl.count > 0) {
      const dayName = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' });
      const providers = bnpl.byProvider.map(p => p.providerLabel).join(', ');
      rawInsights.push({
        kind: 'bnpl-exposure',
        severity: bnpl.count >= 2 ? 'warn' : 'info',
        title: bnpl.count === 1 ? `Hai un piano a rate aperto: ${providers}` : `Hai ${bnpl.count} piani a rate aperti: ${providers}`,
        body: `Ti restano ${formatMoney(bnpl.totalRemaining)} da pagare in tutto${bnpl.nextDue ? `, prossima rata il ${dayName(bnpl.nextDue.date)} (${bnpl.nextDue.providerLabel}).` : '.'}`,
        action: { label: 'Gestisci piani', handler: 'openBnplManager', payload: null },
      });
    }
  } catch (_) {}

  // ── "Posso permettermi di investire?" (src/ai/reasoning-fusion.js): il
  // ponte che né Bloomberg/Revolut/Trade Republic (non vedono la tua cassa)
  // né un'app di budget qualunque (non ha un segnale di mercato) possono
  // dare. ONESTÀ: dato di mercato STATICO e datato (l'app non ha rete a
  // runtime) — si tace se lo scatto è troppo vecchio (>60gg, sarebbe
  // fuorviante) o se non c'è un avanzo sicuro degno di nota (<50€, rumore).
  // Mai un consiglio d'acquisto: solo il quadro. Un insight in più nello
  // STESSO feed unificato, nessuna superficie nuova.
  try {
    const ir = investmentReadiness({
      allTx: VaultDAO.state.transactions,
      commitments: VaultDAO.state.fixedCommitments || [],
      salary: resolveSalary(VaultDAO.state, VaultDAO.state.transactions),
      now: realNow.getTime(),
      liveRegime: detectLiveRegimeFor('indice'),
    });
    if (ir.verdict && ir.verdict.canConsider && ir.verdict.personalSafeSurplus >= 50 && ir.verdict.marketStaleDays <= 60) {
      rawInsights.push({
        kind: 'investment-readiness',
        severity: 'info',
        title: `Avanzo sicuro: ${formatMoney(ir.verdict.personalSafeSurplus)}`,
        body: ir.verdict.message,
      });
    }
  } catch (_) {}

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
      ? `<div class="space-y-1.5 text-xs text-[var(--on-surface-secondary)] mt-1.5">${ins.items.map(h => `<div>${h.description}: ${formatMoney(h.previousAmount)} → <b>${formatMoney(h.newAmount)}</b> (+${h.increasePct}%)</div>`).join('')}</div>`
      : '';
    const actionHtml = ins.action
      ? `<button onclick='window.nudgeActed(${JSON.stringify(ins.kind)}, ${JSON.stringify(ins.action.handler || 'applyBudgetSuggestion')}, ${JSON.stringify(ins.action.payload).replace(/'/g, "&#39;")})' class="text-[11px] font-bold ${style.text} underline mt-1.5">${ins.action.label}</button>`
      : '';
    alertsBox.innerHTML += `
      <div class="card p-4 border ${style.border}">
        ${insightCardHeader(style, ins.title)}
        <p class="text-xs text-[var(--on-surface-secondary)]">${ins.body}</p>
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
        ${insightCardHeader(SEVERITY_STYLE.recap, 'La tua settimana scorsa')}
        <div class="text-xs text-[var(--on-surface-secondary)] space-y-0.5">
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
        <div class="text-xs text-[var(--on-surface-secondary)] divide-y divide-emerald-500/10">${rows}</div>
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

// ---- Aggiornamento autonomo dei dati, anche senza una nuova versione ----
// src/core/auto-update.js sa GIÀ eseguire il controllo vero (rete +
// validazione anti-veleno). Qui si collega alle uniche due fonti reali che
// il progetto ha già pronte (regole fiscali, tracciato fattura elettronica),
// SOLO se l'utente ha configurato una URL fidata: senza, resta innocuo, come
// fetchRulesUpdate già garantisce da solo. Nessuna URL è inclusa di default
// — inventarne una sarebbe esattamente il tipo di dato non verificato che
// questo progetto vieta: va decisa e aggiunta consapevolmente.
// IL PUNTO UNICO in cui le regole scaricate entrano nei calcoli
// (src/predict/tax-rules.js: setActiveTaxRules). Va chiamata al boot — perché
// un override adottato la sessione scorsa deve valere subito, non al prossimo
// aggiornamento — e dopo ogni adozione riuscita.
function applicaRegoleFiscaliAttive() {
  const ov = VaultDAO.state.dataOverrides?.taxRules;
  setActiveTaxRules(ov && ov.rules ? ov : null);
  return !!(ov && ov.rules);
}

// ── LA FONTE PREDEFINITA: perché questa e non l'Agenzia delle Entrate ──
// "Momentum deve prendersi le aliquote da sola quando cambiano." La domanda
// vera è DA DOVE, e la risposta è stata verificata dal vivo dal browser il
// 2026-08-07, non assunta:
//   agenziaentrate.gov.it  -> BLOCCATA da CORS (TypeError: Failed to fetch)
//   normattiva.it          -> BLOCCATA da CORS
//   raw.githubusercontent  -> HTTP 200, leggibile
// Quindi leggere direttamente la fonte ufficiale dal browser è impossibile —
// e anche potendo, estrarre un'aliquota da un testo di legge sarebbe
// esattamente l'invenzione di numeri che questo progetto vieta: una norma non
// si "parsa", si legge e si verifica a mano.
// La via reale: le regole verificate a mano vivono in `data/tax-rules.json`
// nel repo pubblico, e ogni dispositivo se le prende da solo. Non è "un nostro
// server": è un file statico in un repo che esiste già, e non ci passa NESSUN
// dato dell'utente — la richiesta è un GET anonimo di un file uguale per tutti.
// Difesa: `validateRulesPayload` (anti-veleno su struttura e valori
// implausibili) gira comunque, e un payload che non la passa non viene
// adottato, qualunque sia la sua provenienza.
// Limite dichiarato: chi controlla il repo controlla questo file. La firma
// ECDSA (core/update-locator.js) è la difesa contro quel caso e resta da
// collegare — finché non lo è, questa fonte è autenticata dal TLS e validata
// nel contenuto, non firmata. Detto qui perché è la differenza fra le due.
const FONTE_REGOLE_FISCALI_DEFAULT = 'https://raw.githubusercontent.com/GPire/momentum/main/data/tax-rules.json';

function fontiDatiEffettive() {
  const urls = { ...(VaultDAO.state.dataSourceUrls || {}) };
  // L'utente può sostituirla o disattivarla (stringa vuota), mai subirla.
  if (urls.taxRules === undefined) urls.taxRules = FONTE_REGOLE_FISCALI_DEFAULT;
  return urls;
}

async function runAutoUpdateCycle({ manuale = false } = {}) {
  const urls = fontiDatiEffettive();
  if (!urls.taxRules && !urls.fatturaPaFormat && !urls.netReturnRates) {
    if (manuale) showToast('Nessuna fonte dati configurata: aggiungine una nelle impostazioni avanzate.', 'error');
    return null;
  }
  const overrides = VaultDAO.state.dataOverrides || {};
  const sources = [];
  if (urls.taxRules) {
    sources.push(taxRulesSource({
      url: urls.taxRules, fetchImpl: fetch.bind(window),
      currentVersion: overrides.taxRules?.version, generatedAt: overrides.taxRules?.fetchedAt,
    }));
  }
  if (urls.fatturaPaFormat) {
    sources.push(fatturaPaFormatSource({
      url: urls.fatturaPaFormat, fetchImpl: fetch.bind(window),
      currentVersion: overrides.fatturaPaFormat?.version, generatedAt: overrides.fatturaPaFormat?.fetchedAt,
    }));
  }
  if (urls.netReturnRates) {
    sources.push(netReturnRatesSource({
      url: urls.netReturnRates, fetchImpl: fetch.bind(window),
      currentVersion: overrides.netReturnRates?.version, generatedAt: overrides.netReturnRates?.fetchedAt,
    }));
  }
  const result = await runUpdateCycle(sources, {
    now: Date.now(),
    backoffState: VaultDAO.state.autoUpdateBackoff || {},
    onUpdated: async (id, esito) => {
      // Adottato SOLO qui, dopo che runUpdateCycle ha già ricevuto un
      // updated:true da fetchRulesUpdate/fetchFormatUpdate/fetchNetReturnRatesUpdate
      // — cioè dopo che il payload ha già passato la validazione anti-veleno
      // specifica (struttura + valori plausibili) E si è dimostrato più
      // recente della versione corrente. Qui non si ri-valida nulla: si
      // registra solo COSA è stato adottato e QUANDO.
      const key = id === 'tax-rules' ? 'taxRules' : id === 'fatturapa-format' ? 'fatturaPaFormat' : 'netReturnRates';
      // COSA cambia, non solo CHE è cambiato: si cattura la regola in uso
      // PRIMA di sostituirla, altrimenti il confronto non è più possibile e
      // resta solo un "aggiornato" che non spiega niente.
      const annoOggi = new Date().getFullYear();
      // Si fotografano anche gli anni FUTURI, non solo quello corrente: la
      // legge di bilancio si pubblica a dicembre per l'anno dopo, e guardando
      // solo l'anno in corso quel cambiamento sarebbe invisibile fino a
      // gennaio — cioè fino a quando non serve più a decidere niente.
      // (Difetto trovato dal vivo: l'aggiornamento veniva adottato e non
      // compariva nessun avviso, proprio in questo scenario.)
      const anniDaGuardare = [annoOggi, annoOggi + 1, annoOggi + 2];
      const snapPrima = key === 'taxRules'
        ? Object.fromEntries(anniDaGuardare.map((a) => [a, rulesForYear(a)])) : null;
      VaultDAO.state.dataOverrides = {
        ...(VaultDAO.state.dataOverrides || {}),
        [key]: { version: esito.version, rules: esito.rules, specs: esito.specs, profiles: esito.profiles, fetchedAt: new Date().toISOString() },
      };
      // E qui le regole entrano DAVVERO nei calcoli. Senza questa riga
      // l'aggiornamento restava cosmetico: scaricato, validato, salvato,
      // mostrato nel pannello — e mai usato da nessun numero.
      if (key === 'taxRules') {
        applicaRegoleFiscaliAttive();
        try {
          const { describeRulesChangeMultiAnno } = await import('./predict/tax-rules-diff.js');
          const snapDopo = Object.fromEntries(anniDaGuardare.map((a) => [a, rulesForYear(a)]));
          const cambio = describeRulesChangeMultiAnno(snapPrima, snapDopo, { annoCorrente: annoOggi });
          // Se non è cambiato niente di rilevante NON si dice niente: un
          // avviso che conferma il normale è il modo più veloce per far
          // ignorare anche quelli che contano.
          if (cambio) {
            VaultDAO.state.ultimoCambioRegole = { ...cambio, visto: false, quando: new Date().toISOString() };
            notifyUser(cambio.titolo, cambio.sintesi);
            showToast(cambio.sintesi, 'info');
            renderAnalysis({ skipHeavyForecast: true });
          }
        } catch (e) { console.warn('Confronto regole non riuscito:', e); }
      }
    },
  });
  VaultDAO.state.autoUpdateBackoff = result.backoffState;
  VaultDAO.save();
  const riassunto = cycleSummary(result);
  if (manuale) showToast(riassunto, 'success');
  return { ...result, riassunto };
}
window.runAutoUpdateCycle = runAutoUpdateCycle;

// Pannello impostazioni: quanto sono vecchie le fonti configurate + dove
// aggiungerne una. Senza nessuna URL configurata dice onestamente perché il
// controllo automatico è fermo, invece di far finta che i dati si aggiornino
// da soli quando in realtà non hanno nessuna fonte a cui rivolgersi.
window.renderDataFreshnessCard = () => {
  const el = document.getElementById('data-freshness-card');
  if (!el) return;
  const urls = VaultDAO.state.dataSourceUrls || {};
  const overrides = VaultDAO.state.dataOverrides || {};
  const configurate = Object.entries(urls).filter(([, v]) => v);

  const fontiHtml = configurate.length
    ? configurate.map(([k]) => {
        const label = k === 'taxRules' ? 'Regole fiscali' : 'Tracciato fattura elettronica';
        const ov = overrides[k];
        const nota = ov?.fetchedAt ? escapeHtml(stalenessNote(ov.fetchedAt, { now: Date.now(), maxAgeDays: k === 'taxRules' ? 180 : 365, label }) || `${label}: aggiornata l'ultima volta il ${new Date(ov.fetchedAt).toLocaleDateString('it-IT')}.`) : `${label}: non ancora controllata.`;
        return `<p class="text-[10px] text-[var(--on-surface-secondary)]">${nota}</p>`;
      }).join('')
    : `<p class="text-[10px] text-[var(--on-surface-secondary)]">Nessuna fonte configurata: i dati inclusi nell'app restano quelli con cui è stata installata. Aggiungi una fonte fidata qui sotto per farli aggiornare da soli, anche senza una nuova versione di Momentum.</p>`;

  el.innerHTML = `
    <div class="border-t border-[var(--outline)] pt-3 mt-3">
      <p class="text-[10px] text-[var(--on-surface-secondary)] mb-1.5">Dati che si aggiornano da soli:</p>
      ${fontiHtml}
      <details class="mt-2">
        <summary class="text-[10px] text-[var(--on-surface-secondary)] cursor-pointer">Configura una fonte (avanzato)</summary>
        <div class="mt-2 space-y-1.5">
          <input id="dsu-tax" type="url" placeholder="URL regole fiscali (opzionale)" value="${escapeHtml(urls.taxRules || '')}" class="w-full bg-black/30 border border-[var(--glass-border)] rounded-lg px-2 py-1.5 text-[10px]">
          <input id="dsu-format" type="url" placeholder="URL tracciato fattura (opzionale)" value="${escapeHtml(urls.fatturaPaFormat || '')}" class="w-full bg-black/30 border border-[var(--glass-border)] rounded-lg px-2 py-1.5 text-[10px]">
          <p class="text-[9px] text-[var(--on-surface-secondary)]">Il payload viene comunque verificato (struttura + valori plausibili) prima di essere usato: una fonte configurata male o malevola viene scartata, mai adottata.</p>
          <div class="flex gap-1.5">
            <button id="dsu-save" class="btn-action flex-1 text-[10px] py-1.5">Salva</button>
            <button id="dsu-check" class="btn-action flex-1 text-[10px] py-1.5">Controlla ora</button>
          </div>
        </div>
      </details>
    </div>`;

  document.getElementById('dsu-save')?.addEventListener('click', () => {
    const taxRules = document.getElementById('dsu-tax').value.trim();
    const fatturaPaFormat = document.getElementById('dsu-format').value.trim();
    VaultDAO.state.dataSourceUrls = { taxRules: taxRules || null, fatturaPaFormat: fatturaPaFormat || null };
    VaultDAO.save();
    showToast('Fonti salvate.', 'success');
    window.renderDataFreshnessCard();
  });
  document.getElementById('dsu-check')?.addEventListener('click', async () => {
    await runAutoUpdateCycle({ manuale: true });
    window.renderDataFreshnessCard();
  });
};

// ---- Copia di sicurezza a pezzi: nessuna password da ricordare ----
// Il flusso vecchio (qui sopra) chiede una passphrase con un prompt(): è il
// punto in cui il settore perde le persone due volte — la prima perché un
// prompt grigio del browser non spiega niente e si chiude, la seconda anni
// dopo quando quella parola non la ricorda più nessuno. Questo flusso non ha
// nessuna parola da ricordare: tre fogli, ne bastano due, e l'app controlla
// che non finiscano tutti nello stesso posto.
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const RECOVERY_PLACES = [
  { id: 'mail', label: 'Mail', icon: 'M4 4h16v16H4z M22 6l-10 7L2 6' },
  { id: 'personaFidata', label: 'A chi mi fido', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8' },
  { id: 'chiavetta', label: 'Salva', icon: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3' },
  { id: 'stampato', label: 'Stampa', icon: 'M6 9V2h12v7 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v8H6z' },
];

// Un passo per volta, con il posto GIÀ scelto: la persona non deve decidere
// niente, deve solo toccare. La decisione ("dove lo metto?") è la frizione che
// fa chiudere la schermata — resta disponibile, ma non è più obbligatoria.
// Fonetica: parole corte e piane, nessuna sibilante dura, nessun imperativo
// tecnico ("esporta", "genera", "configura").
const RECOVERY_STEPS = [
  {
    where: 'mail',
    titolo: 'Mandiamo il primo foglio alla tua mail',
    sotto: 'La tua mail c\'è anche se il telefono non c\'è più. È il posto più facile per cominciare.',
    azione: 'Apri la mail',
  },
  {
    where: 'personaFidata',
    titolo: 'Il secondo a una persona di cui ti fidi',
    sotto: 'Da solo questo foglio non apre niente e non dice niente di te: non stai dando via i tuoi dati.',
    azione: 'Manda su WhatsApp',
  },
  {
    where: 'chiavetta',
    titolo: 'Il terzo, se vuoi, tienilo tu',
    sotto: 'I primi due bastano già. Questo è solo un margine in più, e puoi farlo anche fra un mese.',
    azione: 'Salva il file',
    opzionale: true,
  },
];

function recoveryKitState() {
  return VaultDAO.state.recoveryKit || { threshold: 2, total: 3, placements: [] };
}

// Il verdetto in fondo alla schermata si aggiorna a ogni pezzo messo via:
// l'utente vede il momento esatto in cui è davvero protetto.
function renderRecoveryVerdict({ animateIfSafe = false } = {}) {
  const box = document.getElementById('rk-verdict');
  if (!box) return;
  const q = placementQuality(recoveryKitState());
  const eraOk = box.dataset.ok === '1';
  box.dataset.ok = q.ok ? '1' : '0';
  box.className = `rounded-2xl border p-3 transition-colors ${q.ok ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-amber-500/40 bg-amber-500/10'}`;
  box.innerHTML = `
    <p class="text-[13px] font-black ${q.ok ? 'text-emerald-300' : 'text-amber-300'}">${q.ok ? '✓ ' : ''}${escapeHtml(q.headline)}</p>
    <p class="text-[11px] text-[var(--on-surface-secondary)] mt-0.5">${escapeHtml(q.detail)}</p>`;
  // Il pulsare arriva SOLO nell'istante in cui si passa da non protetto a
  // protetto: se pulsasse a ogni tocco perderebbe significato in due secondi.
  if (animateIfSafe && q.ok && !eraOk) {
    box.classList.add('rk-safe');
    setTimeout(() => box.classList.remove('rk-safe'), 700);
  }
}

window.markRecoveryPlacement = (index, where) => {
  const kit = recordPlacement(recoveryKitState(), index, where, { now: new Date() });
  VaultDAO.state.recoveryKit = kit;
  VaultDAO.save();
  const chip = document.getElementById(`rk-where-${index}`);
  if (chip) {
    chip.textContent = `Messo ${placeLabel(where)}`;
    chip.className = 'text-[10px] text-emerald-400 font-bold';
  }
  const card = document.getElementById(`rk-card-${index}`);
  if (card) { card.classList.remove('rk-placed'); void card.offsetWidth; card.classList.add('rk-placed'); }
  renderRecoveryVerdict({ animateIfSafe: true });
};

// Il pannello che compare in Momentum Vault: dice il NUMERO di lavoro esposto,
// non una frase generica, e sparisce quando non c'è niente da dire. Colori
// secondo la regola del progetto: ambra = momento consapevole, mai rosso-colpa.
window.renderBackupHealthCard = () => {
  const box = document.getElementById('backup-health-card');
  if (!box) return;
  const r = backupRisk(VaultDAO.state, { now: new Date() });
  const q = placementQuality(recoveryKitState());
  if (r.level === 'ok' && !q.ok && !VaultDAO.state.recoveryKit) {
    box.innerHTML = `<p class="text-[10px] text-[var(--on-surface-secondary)]">Copia di sicurezza: tre fogli in tre posti diversi, nessuna password da ricordare.</p>`;
    return;
  }
  const tono = r.level === 'urgente' ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
    : r.level === 'attenzione' ? 'border-amber-500/30 bg-amber-500/5 text-amber-200'
    : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
  const coda = VaultDAO.state.recoveryKit ? `<p class="text-[10px] text-[var(--on-surface-secondary)] mt-1">${escapeHtml(q.headline)}</p>` : '';
  box.innerHTML = `
    <div class="rounded-2xl border p-3 ${tono}">
      <p class="text-[12px] font-black">${escapeHtml(r.headline)}</p>
      <p class="text-[10px] text-[var(--on-surface-secondary)] mt-0.5">${escapeHtml(r.detail)}</p>
      ${coda}
    </div>`;
};

// Copia di sicurezza guidata: UN passo per schermata, mai tre muri di codice
// tutti insieme. La prima versione mostrava i tre fogli e dodici bottoni in
// una volta: sembrava un compito da esperti e spaventava — esattamente il
// punto in cui una persona chiude e non torna più. Qui la persona vede una
// frase, un bottone, e un cerchio che si riempie.
let RK = null; // stato del flusso in corso (vive solo mentre il modale è aperto)

function rkSteps() {
  const passi = RECOVERY_STEPS.map((s, i) => ({ ...s, index: i + 1 }));
  if ((RK?.kit?.shares?.length || 3) === 1) {
    // Foglio unico: un passo solo, e il testo non promette una divisione.
    return [{ ...passi[0], titolo: 'Mettiamo il foglio nella tua mail', sotto: 'La tua mail c\'e\' anche se il telefono non c\'e\' piu\'. Tienilo dove nessun altro lo legge: questo foglio apre tutto.' }];
  }
  return passi;
}

// Cerchio di avanzamento: tre segmenti che si accendono. Non una percentuale
// (astratta), non "step 1/3" (gergo): tre pallini, come tre fogli reali.
function rkDots(fatti) {
  // Tanti pallini quanti sono i fogli veri: con il foglio unico mostrarne tre
  // prometterebbe una protezione che non c'e'.
  const quanti = RK?.kit?.shares?.length || 3;
  return `<div class="flex items-center justify-center gap-1.5" aria-hidden="true">
    ${Array.from({ length: quanti }, (_, i) => i + 1).map((n) => `<span class="rounded-full transition-all duration-300 ${n <= fatti ? 'w-6 h-1.5 bg-emerald-400' : 'w-1.5 h-1.5 bg-[var(--outline)]'}"></span>`).join('')}
  </div>`;
}

function rkRender() {
  const body = document.getElementById('modal-body');
  if (!body || !RK) return;
  const fatti = placementQuality(recoveryKitState()).postiDistinti;
  const alSicuro = placementQuality(recoveryKitState()).ok;

  // Schermata di apertura: toglie la paura prima di chiedere qualsiasi cosa.
  if (RK.fase === 'intro') {
    body.innerHTML = `
      <div class="rk-screen flex flex-col gap-4 p-4 sm:p-6 lg:p-2 text-center items-center">
        <div class="rk-shield w-16 h-16 rounded-3xl flex items-center justify-center bg-[color-mix(in_srgb,var(--primary)_16%,transparent)]">
          <svg class="w-8 h-8 text-[var(--primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div>
          <h3 class="text-lg font-black leading-tight">Se perdi il telefono,<br>non perdi niente</h3>
          <p class="card-sub !mb-0 mt-1.5">Facciamo tre fogli e li mettiamo in tre posti diversi. Con due qualsiasi torni esattamente dov'eri.</p>
        </div>
        <div class="w-full rounded-2xl border border-[var(--outline)] bg-[var(--surface-elevated)] p-3 text-left">
          <p class="text-[12px] font-bold flex items-center gap-2"><span class="text-emerald-400">✓</span> Nessuna password da ricordare</p>
          <p class="text-[12px] font-bold flex items-center gap-2 mt-1.5"><span class="text-emerald-400">✓</span> Due minuti, poi non ci pensi più</p>
          <p class="text-[12px] font-bold flex items-center gap-2 mt-1.5"><span class="text-emerald-400">✓</span> Un foglio da solo non apre niente</p>
        </div>
        <button id="rk-start" class="rk-cta btn-action btn-primary w-full py-3.5 font-bold rounded-2xl">Iniziamo</button>
        <div class="flex flex-col gap-1.5">
          <button id="rk-uno" class="text-[11px] text-[var(--on-surface-secondary)] underline">Preferisco un foglio solo</button>
          <button id="rk-later" class="text-[11px] text-[var(--on-surface-secondary)] underline">Lo faccio dopo</button>
        </div>
      </div>`;
    document.getElementById('rk-start').addEventListener('click', () => { RK.fase = 'passo'; RK.passo = 1; rkRender(); });
    document.getElementById('rk-later').addEventListener('click', () => closeModal());
    // Foglio unico: scelta legittima, ma è più debole e va detto PRIMA, non
    // scoperto dopo. Nessun ostacolo, nessuna colpa: una frase e si prosegue.
    document.getElementById('rk-uno').addEventListener('click', () => { RK.fase = 'sceltaUno'; rkRender(); });
    return;
  }

  if (RK.fase === 'sceltaUno') {
    body.innerHTML = `
      <div class="rk-screen flex flex-col gap-4 p-4 sm:p-6 lg:p-2 text-center items-center">
        <div>
          <h3 class="text-base font-black">Un foglio solo: come funziona</h3>
          <p class="card-sub !mb-0 mt-1">È più semplice, ma cambia due cose ed è giusto che tu le sappia adesso.</p>
        </div>
        <div class="w-full rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3 text-left">
          <p class="text-[12px] font-bold text-amber-200">Chi lo trova apre tutto</p>
          <p class="text-[11px] text-[var(--on-surface-secondary)] mt-0.5">Con tre fogli, chi ne trova uno non apre niente.</p>
          <p class="text-[12px] font-bold text-amber-200 mt-2">Se lo perdi, hai perso tutto</p>
          <p class="text-[11px] text-[var(--on-surface-secondary)] mt-0.5">Con tre fogli puoi perderne uno e rientrare lo stesso.</p>
        </div>
        <button id="rk-uno-ok" class="rk-cta btn-action w-full py-3.5 font-bold rounded-2xl border border-[var(--outline)]">Va bene, un foglio solo</button>
        <button id="rk-uno-no" class="text-[11px] text-[var(--primary)] font-bold underline">Torna ai tre fogli</button>
      </div>`;
    document.getElementById('rk-uno-no').addEventListener('click', () => { RK.fase = 'intro'; rkRender(); });
    document.getElementById('rk-uno-ok').addEventListener('click', async () => {
      try {
        RK.kit = await createRecoveryKit(VaultDAO.state, { threshold: 1, total: 1 });
      } catch (e) { showToast(e.message, 'error'); return; }
      VaultDAO.state.recoveryKit = { threshold: 1, total: 1, createdAt: new Date().toISOString(), placements: [] };
      VaultDAO.save();
      RK.fase = 'passo'; RK.passo = 1;
      rkRender();
    });
    return;
  }

  // Schermata finale: chiude il cerchio con una parola sola.
  if (RK.fase === 'fine') {
    const q = placementQuality(recoveryKitState());
    body.innerHTML = `
      <div class="rk-screen flex flex-col gap-4 p-4 sm:p-6 lg:p-2 text-center items-center">
        <div class="rk-done w-16 h-16 rounded-full flex items-center justify-center bg-emerald-500/15">
          <svg class="w-8 h-8 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <div>
          <h3 class="text-lg font-black">Ci sei.</h3>
          <p class="card-sub !mb-0 mt-1">${escapeHtml(q.headline)} ${escapeHtml(q.detail)}</p>
        </div>
        ${rkDots(q.postiDistinti)}
        <div class="w-full rounded-2xl border border-[var(--outline)] bg-[var(--surface-elevated)] p-3 text-left">
          <p class="text-[11px] text-[var(--on-surface-secondary)]">Il file della copia è già sul telefono. ${RK.kit.shares.length === 1 ? 'Da solo non si apre: serve il tuo foglio.' : 'Da solo non si apre: servono due fogli.'}</p>
          <a href="${RK.envelopeUrl}" download="momentum-${RK.oggi}.momentum" class="text-[11px] font-bold text-[var(--primary)] underline mt-1 inline-block">Scarica di nuovo il file</a>
        </div>
        <button id="rk-close" class="rk-cta btn-action btn-primary w-full py-3.5 font-bold rounded-2xl">Ho finito</button>
        ${q.mancanti.length ? '<button id="rk-more" class="text-[11px] text-[var(--on-surface-secondary)] underline">Metti via anche l\'ultimo foglio</button>' : ''}
      </div>`;
    document.getElementById('rk-close').addEventListener('click', () => closeModal());
    document.getElementById('rk-more')?.addEventListener('click', () => { RK.fase = 'passo'; RK.passo = 3; rkRender(); });
    return;
  }

  // Le schermate dei passi: una frase, un bottone, niente da decidere.
  const step = rkSteps()[RK.passo - 1];
  const share = RK.kit.shares[RK.passo - 1];
  const place = RECOVERY_PLACES.find((p) => p.id === step.where);
  body.innerHTML = `
    <div class="rk-screen flex flex-col gap-4 p-4 sm:p-6 lg:p-2 items-center text-center">
      ${rkDots(fatti)}
      <div class="rk-step-icon w-14 h-14 rounded-2xl flex items-center justify-center bg-[color-mix(in_srgb,var(--primary)_14%,transparent)]">
        <svg class="w-7 h-7 text-[var(--primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${place.icon}"/></svg>
      </div>
      <div>
        <h3 class="text-base font-black leading-snug">${escapeHtml(step.titolo)}</h3>
        <p class="card-sub !mb-0 mt-1">${escapeHtml(step.sotto)}</p>
      </div>
      <button id="rk-do" class="rk-cta btn-action btn-primary w-full py-3.5 font-bold rounded-2xl">${escapeHtml(step.azione)}</button>
      <button id="rk-alt" class="text-[11px] text-[var(--on-surface-secondary)] underline">Preferisco un altro posto</button>
      <div id="rk-alt-box" class="hidden w-full grid grid-cols-2 sm:grid-cols-4 gap-1.5"></div>
      <details class="w-full text-left">
        <summary class="text-[10px] text-[var(--on-surface-secondary)] cursor-pointer">Vedi il foglio</summary>
        <button class="rk-copy w-full text-left text-[10px] font-mono break-all leading-relaxed bg-[var(--surface-solid)] rounded-lg p-2 border border-[var(--outline)] mt-1.5 active:scale-[.99] transition-transform" data-text="${escapeHtml(share.text)}">${escapeHtml(share.text)}</button>
        <p class="text-[9px] text-[var(--on-surface-secondary)] mt-1">Tocca per copiarlo. Non serve capirlo né trascriverlo a mano.</p>
      </details>
      ${step.opzionale ? '<button id="rk-skip" class="text-[11px] text-[var(--on-surface-secondary)] underline">Salto questo, sono già al sicuro</button>' : ''}
    </div>`;

  const avanza = () => {
    const ultimo = RK.kit.shares.length;
    if (RK.passo >= ultimo || (RK.passo >= 2 && placementQuality(recoveryKitState()).ok && RK.passo === 2)) {
      // Chiudiamo il cerchio appena la protezione è REALE (due posti diversi):
      // lasciare un terzo passo aperto quando la persona è già salva crea un
      // senso di incompiuto che non corrisponde a niente di vero.
      RK.fase = 'fine';
    } else {
      RK.passo += 1;
    }
    rkRender();
  };

  document.getElementById('rk-do').addEventListener('click', async () => {
    await rkPlace(share, step.where, place.label);
    avanza();
  });
  document.getElementById('rk-skip')?.addEventListener('click', () => { RK.fase = 'fine'; rkRender(); });
  document.getElementById('rk-alt').addEventListener('click', () => {
    const box = document.getElementById('rk-alt-box');
    box.classList.toggle('hidden');
    if (!box.innerHTML) {
      box.innerHTML = RECOVERY_PLACES.map((p) => `
        <button class="rk-place flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border border-[var(--outline)] text-[10px] font-bold active:scale-95 transition-transform" data-where="${p.id}" data-label="${escapeHtml(p.label)}">
          <svg class="w-4 h-4 text-[var(--primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${p.icon}"/></svg>${escapeHtml(p.label)}
        </button>`).join('');
      box.querySelectorAll('.rk-place').forEach((b) => b.addEventListener('click', async () => {
        await rkPlace(share, b.dataset.where, b.dataset.label);
        avanza();
      }));
    }
  });
  document.querySelector('.rk-copy')?.addEventListener('click', async (e) => {
    try { await navigator.clipboard.writeText(e.currentTarget.dataset.text); showToast('Foglio copiato.', 'success'); }
    catch (_) { showToast('Copia non riuscita: selezionalo a mano.', 'error'); }
  });
}

// Esegue il gesto (mail, WhatsApp, file, copia) e segna dove è finito il foglio.
async function rkPlace(share, where, label) {
  const corpo = `${share.label}\n\n${share.text}`;
  try {
    if (where === 'mail') {
      window.location.href = `mailto:?subject=${encodeURIComponent('Momentum — foglio di recupero ' + share.index)}&body=${encodeURIComponent(corpo)}`;
    } else if (where === 'personaFidata') {
      window.open(`https://wa.me/?text=${encodeURIComponent(corpo)}`, '_blank', 'noopener');
    } else if (where === 'chiavetta') {
      const b = new Blob([corpo], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `momentum-foglio-${share.index}.txt`;
      a.click();
      URL.revokeObjectURL(a.href);
    } else if (where === 'stampato') {
      await navigator.clipboard?.writeText(corpo);
      showToast('Foglio copiato: incollalo dove vuoi stamparlo.', 'success');
    }
  } catch (_) { /* il segno resta: è la persona a dire dove l'ha messo */ }
  window.markRecoveryPlacement(share.index, where);
}

window.openRecoveryKit = async () => {
  let kit;
  try {
    kit = await createRecoveryKit(VaultDAO.state, { threshold: 2, total: 3 });
  } catch (e) {
    showToast(e.message, 'error');
    return;
  }
  const envelopeBlob = new Blob([JSON.stringify(kit.envelope, null, 2)], { type: 'application/json' });
  RK = {
    fase: 'intro', passo: 1, kit,
    envelopeUrl: URL.createObjectURL(envelopeBlob),
    oggi: new Date().toISOString().slice(0, 10),
  };

  VaultDAO.state.recoveryKit = { threshold: 2, total: 3, createdAt: new Date().toISOString(), placements: [] };
  VaultDAO.state.backupHealth = { ...(VaultDAO.state.backupHealth || {}), lastProtectedAt: new Date().toISOString() };
  VaultDAO.save();

  openModal('<div id="rk-root"></div>');
  rkRender();
};

// Rientrare da un telefono nuovo. Qui la persona è in ansia: la casella accetta
// i fogli incollati come capitano, dice quanti ne mancano, e non chiede mai una
// password che non ha.
window.openRecoveryRestore = () => {
  openModal(`
    <div class="flex flex-col gap-3 p-3 sm:p-5 lg:p-0">
      <div>
        <h3 class="text-base font-black">Torna dentro</h3>
        <p class="card-sub !mb-0">Scegli il file della copia, poi incolla due dei tuoi tre fogli. Non serve nessuna password.</p>
      </div>
      <label class="btn-action w-full py-3 font-bold rounded-xl text-center border border-[var(--outline)] cursor-pointer">
        <span id="rr-filename">Scegli il file della copia</span>
        <input id="rr-file" type="file" accept=".momentum,application/json" class="hidden">
      </label>
      <textarea id="rr-shares" rows="5" placeholder="Incolla qui il primo foglio, vai a capo, incolla il secondo." class="w-full text-[11px] font-mono rounded-xl bg-[var(--surface-elevated)] border border-[var(--outline)] p-3"></textarea>
      <div id="rr-status" class="text-[11px] text-[var(--on-surface-secondary)]">Ancora nessun foglio.</div>
      <button id="rr-go" class="btn-action btn-primary w-full py-3 font-bold rounded-xl">Riporta i miei dati</button>
    </div>`);

  let envelope = null;
  const status = document.getElementById('rr-status');
  const area = document.getElementById('rr-shares');
  const pezzi = () => String(area.value || '').split(/\n{1,}/).map((s) => s.trim()).filter((s) => /MR1/i.test(s));

  const aggiorna = () => {
    const n = pezzi().length;
    const parts = [];
    parts.push(envelope ? 'File pronto.' : 'Manca il file della copia.');
    parts.push(n === 0 ? 'Nessun foglio incollato.' : n === 1 ? 'Un foglio: ne serve ancora uno.' : `${n} fogli: bastano.`);
    status.textContent = parts.join(' ');
    status.className = `text-[11px] ${envelope && n >= 2 ? 'text-emerald-400' : 'text-[var(--on-surface-secondary)]'}`;
  };
  area.addEventListener('input', aggiorna);

  document.getElementById('rr-file').addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      envelope = JSON.parse(await f.text());
      document.getElementById('rr-filename').textContent = f.name;
    } catch (_) {
      envelope = null;
      showToast('Questo file non sembra una copia di Momentum.', 'error');
    }
    aggiorna();
  });

  document.getElementById('rr-go').addEventListener('click', async () => {
    if (!envelope) { showToast('Scegli prima il file della copia.', 'error'); return; }
    try {
      const restored = await restoreFromShares(envelope, pezzi());
      if (!confirm('I dati di questo dispositivo verranno sostituiti da quelli della copia. Procedere?')) return;
      VaultDAO.state = { ...VaultDAO.state, ...restored, currentDate: new Date() };
      VaultDAO.save();
      showToast('Ci sei. Ricarico…', 'success');
      setTimeout(() => window.location.reload(), 1000);
    } catch (e) { showToast(e.message, 'error'); }
  });
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
    description: sweep.goalName ? `Risparmio per ${sweep.goalName} (da spostare tu)` : 'Risparmio avanzo (da spostare tu)',
    date: now.toISOString(),
  });
  VaultDAO.state.lastSweepWeek = sweep.weekKey; // campo additivo
  VaultDAO.save();
  showToast(`Segnato. Ora sposta davvero ${formatMoney(sweep.amount)} sul tuo conto risparmio — Momentum non tocca la banca.`, 'success');
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
      <p class="text-xs text-[var(--on-surface-secondary)]">Copia questo token e incollalo sulla scheda dell'altro dispositivo per sincronizzare:</p>
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

// Spiegazione concreta di ogni livello del freno spese (cambia col tocco → si
// capisce la differenza, e mostra che è integrato coi segnali reali del Core).
const BRAKE_DESC = {
  zen: 'Ti lascio libero: ti avviso solo per spese davvero fuori scala. Nessuna interruzione.',
  advisor: 'Equilibrato: quando una spesa intacca troppo il tuo margine di oggi o la proiezione di fine mese, te lo dico con calma.',
  predator: 'Protettivo: ti avviso presto e, sulle spese che ti farebbero chiudere il mese in rosso, ti chiedo un secondo tocco di conferma. Mai un blocco — decidi tu.',
};
function renderBrakeDesc() {
  const el = $('#ai-mode-desc'); if (!el) return;
  const mode = VaultDAO.state.aiAggression || 'advisor';
  el.textContent = BRAKE_DESC[mode] || BRAKE_DESC.advisor;
  $$('.segment-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.aiMode === mode);
    btn.classList.toggle('predator', mode === 'predator' && btn.dataset.aiMode === 'predator');
  });
}
window.setAIAggression = (mode) => {
  haptic('light');
  VaultDAO.state.aiAggression = mode;
  VaultDAO.save();
  renderBrakeDesc();
  const label = mode === 'zen' ? 'Delicato' : mode === 'predator' ? 'Deciso' : 'Consigliere';
  showToast(`Freno spese: ${label}.`, 'success');
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

    // PRIMING PROGRESSIVO (anti-abbandono): a ogni risposta seminiamo i priori in
    // memoria (SENZA salvare: il save avviene solo alla conferma finale, per non
    // marcare "onboarded" a metà). Se l'utente completa, il motore è già caldo;
    // se torna indietro, l'ultima risposta ridefinisce i priori senza residui.
    if (value && (step === 2 || step === 3)) {
      try {
        const p = derivePriors(window.userRiskProfile || 'bilanciato', window.userTimeHorizon || 'medio');
        VaultDAO.state.aiAggression = p.aiAggression;
        VaultDAO.state.investmentPrefs = { investFraction: p.investFraction, emergencyMonths: p.emergencyMonths, riskFloor: p.riskFloor, horizon: p.horizon };
        VaultDAO.state.advisorBandit = seedBanditState(VaultDAO.state.advisorBandit, p.risk);
      } catch (_) { /* priming best-effort: non blocca mai l'onboarding */ }
    }

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
  // Bug reale segnalato dall'utente: window.genesisStep non torna mai indietro
  // dopo la consacrazione (resta 3 per SEMPRE), quindi senza il controllo su
  // endGenesis._done questo gestore restava attaccato a `document` a vita —
  // la prima Barra Spaziatrice digitata ovunque nell'app (es. descrizione di
  // "Dividi spese") veniva rubata e bloccata (preventDefault) invece di finire
  // nel campo di testo. Si rimuove esplicitamente appena la consacrazione è
  // fatta, così il listener non sopravvive oltre l'onboarding.
  const keyHandler = (e) => {
    if (endGenesis._done) { document.removeEventListener('keydown', keyHandler); return; }
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
  endGenesis._keyHandler = keyHandler;

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

// ==========================================
// PROVACI TU — la promessa di privacy che l'utente può tentare di rompere
// ==========================================
// La scena della cupola (index.html) MOSTRA che i dati non escono. Ma resta
// una cosa che decidiamo noi: è la nostra animazione, e chi guarda deve
// crederci lo stesso. L'unico gradino sopra il "mostrare" è lasciare che
// provino a CONTRADDIRCI: qui il dito afferra un dato e prova a portarlo
// fuori dal dispositivo. Il muro lo tiene, e lo tiene ogni volta.
// Questo è anche il primo momento in cui Momentum risponde al tocco: la
// promessa più importante del prodotto diventa la prima interazione.
//
// Il raggio si legge dal DOM, non da una costante: la scena ha tre scale
// responsive (0.72 / 1 / 1.12) e un muro che non coincide col muro disegnato
// sarebbe peggio di nessun muro.
// Una sola funzione per DUE scene: la hero (muta, chi tocca scopre) e la
// schermata di apertura sopra l'orb (dove l'invito è scritto). Le misure non
// sono cablate da nessuna parte — si leggono dal DOM — quindi la stessa
// funzione regge scale diverse senza saperlo.
const initPrivacyProof = (scene, hint = null, autoInvito = true) => {
  const pull = scene?.querySelector('.ps-pull');
  const leash = scene?.querySelector('.ps-leash');
  const dome = scene?.querySelector('.ps-dome');
  if (!scene || !pull || !leash || !dome || !window.PointerEvent) return;
  if (scene.dataset.proofArmed === '1') return; // mai due volte sullo stesso nodo
  scene.dataset.proofArmed = '1';

  // La scala si fissa all'inizio di ogni trascinamento e non si rimisura in
  // corsa: la cupola RESPIRA (domePulse, ±2%), e ricalcolarla a ogni movimento
  // farebbe tremare il punto sotto il dito di quel 2%.
  let attivo = false, respinto = false, ultimoHaptic = 0, kDrag = 1;

  // Lo stage è SCALATO (0.72 sui telefoni bassi, 1.12 sugli schermi alti), il
  // dito no: senza dividere per la scala, il punto si sposterebbe più (o meno)
  // del dito e la presa sembrerebbe scivolosa. La scala si misura confrontando
  // la cupola disegnata con la cupola a schermo — così resta vera anche se un
  // domani le misure cambiano.
  const scala = () => {
    const s = dome.getBoundingClientRect().width / (dome.offsetWidth || 140);
    return s > 0.1 ? s : 1;
  };
  const raggio = () => {
    const r = dome.getBoundingClientRect().width / 2;
    // 7px (a schermo) dentro il bordo: il punto ha un suo diametro, e deve
    // fermarsi CONTRO il muro, non a cavallo del muro.
    return Math.max(24, r - 7 * kDrag);
  };
  const centro = () => {
    const b = scene.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  };
  // dx/dy arrivano in pixel DI SCHERMO; dentro lo stage vanno in pixel locali.
  const poni = (dx, dy) => {
    const lx = dx / kDrag, ly = dy / kDrag;
    pull.style.setProperty('--px', `${lx}px`);
    pull.style.setProperty('--py', `${ly}px`);
    leash.style.setProperty('--len', `${Math.hypot(lx, ly)}px`);
    leash.style.setProperty('--ang', `${(Math.atan2(ly, lx) * 180) / Math.PI}deg`);
  };

  const muroColpito = () => {
    // Il lampo si ri-arma togliendo e rimettendo la classe: senza il reflow in
    // mezzo, il browser non riavvia l'animazione e dal secondo tentativo in
    // poi il muro non reagirebbe più — che è esattamente il contrario del
    // messaggio ("ogni volta, non solo la prima").
    scene.classList.remove('blocked');
    void scene.offsetWidth;
    scene.classList.add('blocked');
    const ora = Date.now();
    if (ora - ultimoHaptic > 260) { ultimoHaptic = ora; try { haptic('light'); } catch (_) {} }
    if (!respinto) {
      respinto = true;
      if (hint) hint.textContent = 'Ci hai provato. Non escono.';
    }
  };

  scene.addEventListener('pointerdown', (e) => {
    attivo = true;
    // Dichiarato sul nodo: la schermata di apertura non deve sparire MENTRE
    // il dito sta ancora tirando. Portare via lo schermo a metà di un gesto è
    // il modo più rapido di far sembrare finto tutto quello che ha appena visto.
    scene.dataset.dragging = '1';
    kDrag = scala();
    pull.classList.remove('springing');
    scene.classList.add('dragging');
    try { scene.setPointerCapture(e.pointerId); } catch (_) {}
    const c = centro();
    poni(e.clientX - c.x, e.clientY - c.y);
    if (hint) hint.classList.remove('hidden-hint');
  });

  scene.addEventListener('pointermove', (e) => {
    if (!attivo) return;
    try { e.preventDefault(); } catch (_) {}
    const c = centro();
    let dx = e.clientX - c.x, dy = e.clientY - c.y;
    const dist = Math.hypot(dx, dy), R = raggio();
    if (dist > R) {
      // Clamp sul cerchio: il dito continua, il dato no. È qui che la
      // promessa smette di essere una frase.
      const k = R / dist;
      dx *= k; dy *= k;
      muroColpito();
    }
    poni(dx, dy);
  });

  const rilascia = () => {
    if (!attivo) return;
    attivo = false;
    scene.dataset.dragging = '0';
    scene.classList.remove('dragging');
    // Il rientro è una MOLLA (CSS), non una linea retta: lineare sembrerebbe
    // "l'app me l'ha annullato", la molla sembra respinto.
    pull.classList.add('springing');
    poni(0, 0);
    setTimeout(() => pull.classList.remove('springing'), 640);
  };
  scene.addEventListener('pointerup', rilascia);
  scene.addEventListener('pointercancel', rilascia);
  // NIENTE `pointerleave`: qui si trascina APPOSTA fuori dai bordi della scena,
  // e su alcuni browser quell'evento chiuderebbe il gesto proprio nel momento
  // in cui il muro deve farsi sentire. Il fallback è a livello di finestra, per
  // il caso in cui il dito venga alzato fuori dalla pagina.
  window.addEventListener('pointerup', rilascia);

  // L'invito arriva dopo il secondo rimbalzo della scena (~3.6s): chi ha già
  // capito è andato avanti, chi è ancora lì viene invitato a verificare.
  // Non compare se nel frattempo ha già trascinato: dire "provaci" a chi ha
  // appena provato è la definizione di interfaccia che non guarda.
  // Nella hero l'invito non esiste; sopra l'orb lo scopre chi chiama, al
  // momento della riga di caricamento che parla di privacy — non a un tempo
  // scelto a caso che potrebbe cadere dopo che la schermata è già sparita.
  if (hint && autoInvito) setTimeout(() => { if (!respinto) hint.classList.remove('hidden-hint'); }, 3600);
};

// Semina lo stato del profilo (budget + preferenze investimento + prior del
// modello) da rischio+orizzonte. Unica fonte di verità: la usano sia
// l'onboarding completo (endGenesis) sia l'attivazione "lampo" (activateLite) e
// il potenziamento dal Reveal — così le tre strade non divergono mai.
function seedProfileState(risk = 'bilanciato', hz = 'medio') {
  // LE 2 DOMANDE ADDESTRANO IL CORE (src/predict/onboarding-priors.js): dai due
  // profili deriviamo priori per PIÙ modelli, così Momentum parte già
  // personalizzato e predittivo dal primo tocco (nessun concorrente lo fa).
  const p = derivePriors(risk, hz);
  VaultDAO.state.isFirstLaunch = false;
  VaultDAO.state.onboardingProfile = { riskProfile: p.risk, horizon: p.horizon };
  VaultDAO.state.monthlyBudget = p.monthlyBudget;
  VaultDAO.state.investmentPrefs = { investFraction: p.investFraction, emergencyMonths: p.emergencyMonths, riskFloor: p.riskFloor, horizon: p.horizon };
  // Tono dei nudge di spesa personalizzato subito.
  VaultDAO.state.aiAggression = p.aiAggression;
  // Priori DEBOLI per il contextual bandit dell'advisor: il primo consiglio è
  // già orientato al profilo (prudente→risparmio, aggressivo→ottimizzazione),
  // ma i dati reali li superano in fretta. Non tocca i bracci già appresi.
  try { VaultDAO.state.advisorBandit = seedBanditState(VaultDAO.state.advisorBandit, p.risk); } catch (_) {}
  // Priori della rete neurale on-device.
  try { NeuralNexus.initPriorWeights(VaultDAO.state.onboardingProfile); } catch (_) {}
}

// ATTIVAZIONE LAMPO (anti-attrito): chi arriva da un link di divisione NON deve
// fare l'onboarding completo prima di usare l'app. Attiva Momentum con default
// sensati (bilanciato/medio) e marca `activatedLite` → più tardi il Reveal
// propone di personalizzare con 2 domande. isFirstLaunch=false + save marca
// "onboarded" (omega_core_db), così ai riavvii successivi entra diretto.
function activateLite() {
  seedProfileState('bilanciato', 'medio');
  VaultDAO.state.activatedLite = true;
  VaultDAO.save();
}

const endGenesis = () => {
  // Idempotente: qualunque percorso (hold, tap, click, tastiera) può chiamarla,
  // ma la consacrazione avviene UNA sola volta — niente doppia esecuzione né
  // conflitti tra pointer e click.
  if (endGenesis._done) return;
  endGenesis._done = true;
  if (endGenesis._keyHandler) { document.removeEventListener('keydown', endGenesis._keyHandler); endGenesis._keyHandler = null; }
  try {
    haptic('heavy');
    // Il profilo rischio+orizzonte parametrizza budget e motore investimenti.
    // Logica condivisa con l'attivazione "lampo" (seedProfileState) per non
    // divergere mai. Il campo `activatedLite` viene tolto: qui il profilo è
    // scelto davvero dall'utente (onboarding completo).
    seedProfileState(window.userRiskProfile || 'bilanciato', window.userTimeHorizon || 'medio');
    delete VaultDAO.state.activatedLite;
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
    
    // La promessa di privacy vive QUI, non nella hero: al primo avvio la hero
    // ha già tre cose da dire in dieci secondi, mentre questa schermata ha un
    // orb al centro, silenzio intorno, e un'attesa che l'utente ha già
    // accettato di darci. È il momento giusto per invitarlo a smentirci.
    const otaScene = $('#ota-privacy-scene');
    const otaHint = $('#ota-privacy-hint');
    try { initPrivacyProof(otaScene, otaHint, false); }
    catch (e) { console.warn('privacy proof (apertura) non armato:', e); }

    // Copy rifatto. "Analizzo le tue abitudini di spesa" al PRIMO avvio è
    // falso: di abitudini non ce n'è ancora nessuna, e aprire un rapporto con
    // una frase non vera è il modo peggiore di aprirlo — soprattutto in una
    // schermata che sta chiedendo di essere creduta sulla privacy.
    // Ogni riga dice una cosa che sta davvero succedendo.
    const logs = [
      "Apro Momentum",
      "Preparo il tuo spazio",
      "Accendo il motore che imparerà da te",
      "Nessun account, nessuna password",
      "Pronto."
    ];
    let idx = 0;
    // 640ms invece di 450: con cinque righe la schermata durava 3,1 secondi in
    // tutto — meno del tempo di accorgersi che la cupola si può toccare. Non è
    // attesa aggiunta per far sembrare l'app impegnata: è il tempo minimo
    // perché la promessa più importante del prodotto possa essere MESSA ALLA
    // PROVA invece che solo letta di sfuggita.
    const interval = setInterval(() => {
      if (idx < logs.length) {
        // Sostituisce, non accumula: la riga precedente ha già fatto il suo
        // lavoro, e una lista che cresce ruba lo sguardo alla cupola.
        if (logBox) logBox.innerHTML = `<p>${logs[idx]}</p>`;
        // L'invito compare esattamente sulla riga che parla dei dati: la frase
        // e il gesto che la dimostra arrivano nello stesso istante.
        if (idx === 1 && otaHint) otaHint.classList.remove('hidden-hint');
        idx++;
      } else {
        clearInterval(interval);
        // Non si porta via lo schermo mentre il dito sta ancora tirando.
        // Il tetto d'attesa esiste perché un dito appoggiato e dimenticato non
        // deve poter bloccare l'ingresso nell'app per sempre.
        const attesaIniziata = Date.now();
        const chiudi = () => {
          if (otaScene?.dataset.dragging === '1' && Date.now() - attesaIniziata < 8000) {
            setTimeout(chiudi, 220); return;
          }
          if (ota) ota.classList.remove('active');
          const app = $('#app-core');
          if (app) {
            app.classList.remove('hidden');
            requestAnimationFrame(() => app.style.opacity = '1');
          }
          bootUI();
          // Se l'utente è arrivato da un link "unisciti" (primo avvio), ora che
          // l'app è pronta processa l'invito rimasto in sospeso.
          consumeJoinLink();
          if (window._pendingJoin) { const g = window._pendingJoin; window._pendingJoin = null; setTimeout(() => window.openJoinConfirm(g), 400); }
        };
        setTimeout(chiudi, 1100);
      }
    }, 640);
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

// Guida installazione PWA (src/pwa/install-guide.js) — TOP-LEVEL, non dentro
// initApp: deve reagire a 'beforeinstallprompt' che il browser può sparare
// in qualsiasi momento, anche prima che initApp finisca di girare (bug di
// scope già trovato due volte in questa stessa sessione per altre funzioni
// dentro initApp non raggiungibili da fuori — qui evitato del tutto usando
// solo document.getElementById diretto, mai gli helper $/$$ di initApp).
let __installPromptEvent = null;
const INSTALL_ICON_SVG = {
  share: '<path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><rect x="4" y="12" width="16" height="9" rx="2"/>',
  plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  install: '<path d="M12 3v12"/><path d="M8 11l4 4 4-4"/><path d="M4 19h16"/>',
};
function renderInstallGuide() {
  const stepsEl = document.getElementById('install-guide-steps');
  if (!stepsEl) return;
  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
  const platform = detectPlatform(navigator.userAgent, { standalone });
  const { title, steps } = installSteps(platform);
  const titleEl = document.getElementById('install-guide-title');
  const btnEl = document.getElementById('install-guide-btn');
  const doneEl = document.getElementById('install-guide-done');
  if (titleEl) titleEl.textContent = title;
  if (standalone) {
    stepsEl.innerHTML = '';
    btnEl?.classList.add('hidden');
    doneEl?.classList.remove('hidden');
    return;
  }
  doneEl?.classList.add('hidden');
  stepsEl.innerHTML = steps.map((s, i) => `
    <div class="flex items-start gap-3 install-step-in">
      <div class="w-7 h-7 rounded-full bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] text-[var(--primary)] flex items-center justify-center shrink-0 font-bold text-xs">${i + 1}</div>
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 text-[var(--on-surface-secondary)] shrink-0">${INSTALL_ICON_SVG[s.icon] || INSTALL_ICON_SVG.info}</svg>
        <p class="text-xs text-[var(--on-surface-secondary)] leading-snug">${s.text}</p>
      </div>
    </div>`).join('');
  // Il pulsante nativo appare SOLO se il browser ha davvero offerto
  // l'evento beforeinstallprompt — mai un pulsante "Installa" decorativo
  // che su iOS/Firefox non farebbe nulla (l'utente lo scoprirebbe solo
  // toccandolo, la peggiore delle sorprese).
  if (platform.supportsNativePrompt && __installPromptEvent) {
    btnEl?.classList.remove('hidden');
  } else {
    btnEl?.classList.add('hidden');
  }
}
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  __installPromptEvent = e;
  renderInstallGuide();
});
window.addEventListener('appinstalled', () => {
  __installPromptEvent = null;
  renderInstallGuide();
});
document.addEventListener('click', (e) => {
  if (e.target.closest?.('#install-guide-btn') && __installPromptEvent) {
    __installPromptEvent.prompt();
    __installPromptEvent.userChoice.finally(() => { __installPromptEvent = null; renderInstallGuide(); });
  }
});
renderInstallGuide();

const navigate = (view) => {
  haptic('light');
  VaultDAO.state.currentView = view;
  ['dashboard', 'analysis', 'settings'].forEach(v => {
    const el = $(`#${v}-view`);
    if (el) el.classList.toggle('hidden', v !== view);
  });
  // Evidenzia il tab ATTIVO su ENTRAMBE le nav (desktop sidebar + mobile): prima
  // solo la mobile veniva aggiornata → su desktop il tab corrente non si
  // illuminava (restava acceso "Dashboard"). Stesso neurocolore attivo ovunque
  // (indaco = "sei qui"), per coerenza e per ridurre l'attrito di orientamento.
  $$('.mobile-nav .nav-btn').forEach(btn => {
    btn.classList.toggle('text-[var(--primary)]', btn.dataset.view === view);
    btn.classList.toggle('text-[var(--on-surface-secondary)]', btn.dataset.view !== view);
  });
  $$('aside .nav-btn[data-view]').forEach(btn => {
    const active = btn.dataset.view === view;
    btn.classList.toggle('text-[var(--primary)]', active);
    btn.classList.toggle('bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]', active);
    btn.classList.toggle('text-[var(--on-surface-secondary)]', !active);
  });
  // Ricalcolo ad ogni apertura della Dashboard (richiesto esplicitamente:
  // "non essere sempre le stesse") — non solo all'avvio dell'app.
  // window.renderQaSuggestions (non la funzione diretta): navigate() vive
  // fuori dalla closure di initApp, dove la funzione è definita — stesso
  // bug di scope già trovato e corretto per fetchAssetNewsCascade più
  // sotto in questo file; qui esposta su window per lo stesso motivo.
  if (view === 'dashboard') window.renderQaSuggestions?.();
  if (view === 'analysis') renderAnalysis();
  if (view === 'settings') {
    renderTaxSettings(); renderBrakeDesc(); renderInstallGuide(); window.renderBackupHealthCard?.(); window.renderDataFreshnessCard?.();
    // BUG REALE trovato: al primo avvio VaultDAO.state.liveDataKeys non è
    // ancora popolato dal merge asincrono (IndexedDB/DurableStore) quando
    // initTelemetryToggle() gira una sola volta all'avvio — lo stato dei
    // provider mostrava sempre "non attivo" anche a chiave già salvata
    // (esattamente il bug segnalato dall'utente). Ri-renderizzare ad ogni
    // apertura della vista Impostazioni lo tiene sempre corretto.
    renderChatProviderStatus();
    renderKeyStatusDot('live-price-status', 'alphavantage');
    renderKeyStatusDot('twelvedata-status', 'twelvedata');
    renderKeyStatusDot('fmp-status', 'fmp');
    renderKeyStatusDot('finnhub-status', 'finnhub');
    renderKeyStatusDot('newsapi-status', 'newsapi');
    renderCloudFallbackLogPanel();
  }
  function renderCloudFallbackLogPanel() {
    const box = document.getElementById('cloud-fallback-log');
    if (!box) return;
    // Numero VERO, non un'etichetta: quante famiglie di domande il QA ha
    // imparato a riconoscere da solo (qa-learning.js) — cresce più in fretta
    // delle correzioni fatte a mano perché ognuna copre tutte le
    // formulazioni simili future, non solo quella esatta insegnata.
    const cop = qaLearningCoverage(VaultDAO.state.qaLearning);
    const coverageLine = cop.famiglieRiconosciute > 0
      ? `<div class="mb-2 text-[var(--primary)]">Il QA riconosce ormai ${cop.famiglieRiconosciute} modo${cop.famiglieRiconosciute === 1 ? '' : 'i'} diverso${cop.famiglieRiconosciute === 1 ? '' : 'i'} in cui fai le domande${cop.famiglieInAttesaDiConferma ? ` (+${cop.famiglieInAttesaDiConferma} in attesa di una seconda conferma)` : ''}.</div>`
      : '';
    const log = (VaultDAO.state.mlData.cloudFallbackLog || []).slice().reverse();
    box.innerHTML = coverageLine + (log.length
      ? log.map(e => `<div>"${String(e.q).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]))}"</div>`).join('')
      : '<div class="text-slate-500">Ancora nessuna — appariranno qui man mano che fai domande fuori dai tuoi soldi.</div>');
  }
  window.renderCloudFallbackLogPanel = renderCloudFallbackLogPanel;
  // Ingresso SCAGLIONATO del contenuto della sezione (ri-attiva l'animazione ad
  // ogni cambio vista togliendo/rimettendo la classe: reflow forzato in mezzo).
  const shown = $(`#${view}-view`);
  if (shown) { shown.classList.remove('view-in'); void shown.offsetWidth; shown.classList.add('view-in'); }
};

// `footerHtml` (opzionale): contenuto SEMPRE VISIBILE, fuori dall'area che
// scorre — per i moduli lunghi (es. Crea fattura) il bottone d'azione
// principale deve essere raggiungibile senza dover prima scorrere tutto il
// modulo. Senza footerHtml il piè di pagina resta vuoto e nascosto: ogni
// altro modale dell'app è invariato.
let __modalFooterObserver = null;
function ensureModalFooterResizeSync() {
  if (__modalFooterObserver || typeof ResizeObserver === 'undefined') return;
  const footer = $('#modal-footer'), body = $('#modal-body');
  __modalFooterObserver = new ResizeObserver(() => {
    if (!footer.classList.contains('hidden')) body.style.paddingBottom = `${footer.offsetHeight + 16}px`;
  });
  __modalFooterObserver.observe(footer);
}
window.openModal = (html, footerHtml = '') => {
  const body = $('#modal-body');
  body.innerHTML = html;
  // Reset di default: solo chi la chiede esplicitamente (openCreateInvoice)
  // riattiva la card larga subito dopo — mai un residuo dal modale precedente.
  $('#modal-content').classList.remove('modal-wide');
  const footer = $('#modal-footer');
  footer.classList.remove('modal-wide');
  footer.innerHTML = footerHtml;
  // Il piè di pagina è `position:fixed` (ancorato alla finestra vera, non al
  // modale) — senza riservare lo spazio equivalente nel corpo scorrevole,
  // l'ultimo campo del modulo finirebbe NASCOSTO dietro i bottoni invece che
  // semplicemente sopra di essi. Si toglie prima `hidden` per poter
  // misurare l'altezza vera renderizzata (a display:none sarebbe sempre 0).
  if (footerHtml) {
    footer.classList.remove('hidden');
    body.style.paddingBottom = `${footer.offsetHeight + 16}px`;
  } else {
    footer.classList.add('hidden');
    body.style.paddingBottom = '';
  }
  // BUG REALE trovato testando "Crea fattura" (2026-08-06): il pié di pagina
  // può CAMBIARE altezza DOPO l'apertura — es. il pulsante "Scarica fattura
  // elettronica (XML)" compare solo quando il form diventa valido — ma il
  // padding sopra era calcolato una volta sola all'apertura. Risultato:
  // l'anteprima e il selettore regime finivano nascosti dietro un footer
  // cresciuto, senza alcun modo di scorrere fino a vederli. Un
  // ResizeObserver tiene il padding sincronizzato per tutta la vita della
  // modale, non solo al primo render.
  ensureModalFooterResizeSync();
  // Dissolvenza/rise leggera del contenuto (apertura o cambio step di un
  // flusso multi-step): reflow forzato per ri-attivare l'animazione ogni volta.
  body.classList.remove('modal-body-in'); void body.offsetWidth; body.classList.add('modal-body-in');
  $('#modal-content').classList.remove('modal-closing');
  $('#modal-container').classList.remove('hidden');
  // BUG REALE segnalato dal vivo: con un modale aperto, scorrere sul suo
  // contenuto scorreva ANCHE la pagina sotto (Dashboard/Analisi dietro il
  // buio) — su mobile il gesto capita facilmente sul bordo del modale e
  // finisce sulla pagina invece che dentro #modal-body, rendendo il campo
  // in fondo (es. l'email cliente in "Crea fattura") impossibile da
  // raggiungere. `overflow:hidden` da solo non basta su iOS Safari (il rimbalzo
  // elastico scorre comunque lo sfondo): si blocca il body in `position:fixed`
  // nel punto esatto in cui si trovava, e lo si rimette esattamente lì alla
  // chiusura — l'utente non deve accorgersi che è successo qualcosa.
  if (!document.body.dataset.scrollLockY) {
    document.body.dataset.scrollLockY = String(window.scrollY || window.pageYOffset || 0);
    document.body.style.position = 'fixed';
    document.body.style.top = `-${document.body.dataset.scrollLockY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
  }
  setTimeout(() => {
    $('#modal-backdrop').style.opacity = '1';
    $('#modal-content').classList.remove('translate-y-full', 'lg:scale-95', 'opacity-0');
  }, 10);
};

window.closeModal = () => {
  // In chiusura niente overshoot: curva più rapida e lineare (.modal-closing).
  $('#modal-content').classList.add('modal-closing');
  $('#modal-content').classList.add('translate-y-full', 'lg:scale-95', 'opacity-0');
  $('#modal-backdrop').style.opacity = '0';
  setTimeout(() => {
    $('#modal-container').classList.add('hidden');
    // Bug reale trovato dal vivo: il piè di pagina è `position:fixed`, quindi
    // sta FUORI da #modal-container — nasconderlo qui e non solo il
    // contenitore lo lasciava visibile e cliccabile sopra la pagina anche a
    // modale chiusa, per ogni modulo che lo usa (es. "Crea fattura").
    $('#modal-footer').classList.add('hidden');
    $('#modal-body').style.paddingBottom = '';
    // Sblocco dello scroll di sfondo e ripristino ESATTO della posizione da
    // cui l'utente era partito (vedi commento in openModal).
    if (document.body.dataset.scrollLockY !== undefined) {
      const y = +document.body.dataset.scrollLockY || 0;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      delete document.body.dataset.scrollLockY;
      window.scrollTo(0, y);
    }
  }, 300);
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
    // Prima: solo una frase. Ora una barra-fantasma (tratteggiata, vuota) che
    // mostra COSA diventerà questa sezione appena c'è un obiettivo — lo stesso
    // linguaggio visivo delle barre reali sotto, non un'assenza silenziosa.
    box.innerHTML = `
      <button onclick="window.openGoalEditor()" class="w-full text-left p-3 rounded-xl border border-dashed border-[var(--glass-border)] hover:border-[color-mix(in_srgb,var(--primary)_50%,transparent)] transition-colors">
        <div class="flex items-center gap-2 mb-2 text-[var(--on-surface-secondary)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 shrink-0"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.5"/></svg>
          <span class="text-xs font-bold">Crea il tuo primo obiettivo</span>
        </div>
        <div class="budget-track opacity-40"><div class="budget-fill" style="width:0%; background:var(--cyan);"></div></div>
        <p class="text-[11px] text-[var(--on-surface-secondary)] mt-1">Vedere la barra riempirsi è metà della motivazione — tocca per iniziare.</p>
      </button>`;
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
// Ultima classificazione NAT nota (da runMeshNetDiagnosis), tenuta qui per
// poterla usare quando un canale diretto si apre davvero (onPeerConnected):
// senza questo, l'esito reale non avrebbe alcun contesto con cui imparare.
// Puo' essere vecchia di qualche minuto se l'utente ha aspettato prima di
// collegarsi: non e' un problema, la rete cambia raramente in quella scala
// di tempo, ed e' comunque piu' informativo di nessun contesto.
let __ultimaNatDiagnosi = null;

function meshAdoptChannel(pc, channel) {
  const attach = () => momentumMeshNode.addDirectPeer('peer-' + Date.now(), pc, channel);
  if (channel.readyState === 'open') attach();
  else channel.onopen = attach;
}

// ==========================================
// PAIRING P2P INTEGRATO NELL'INVITO DI GRUPPO
// Prima il collegamento diretto viveva SOLO nella schermata separata
// "Sincronizza dispositivi": bisognava condividere il link del gruppo E POI,
// a parte, scambiarsi altri due codici a mano. Qui l'offerta WebRTC viaggia
// nello STESSO link/QR dell'invito (encodeGroupInvite con p2pOffer) e la
// risposta si incolla dentro la stessa schermata "Invita" — un solo flusso.
// Onestà: resta un tentativo BEST-EFFORT. Se chi entra apre il link quando
// il creatore ha già chiuso la scheda (l'RTCPeerConnection in memoria non
// sopravvive a un reload), l'offerta è semplicemente scaduta: il gruppo
// entra comunque via link, e la sincronizzazione resta quella già
// funzionante (merge CRDT al prossimo scambio di codice/QR, o mesh se poi
// entrambi si collegano da vivi). Nessuna funzionalità dipende da questo.
// ==========================================
let _groupInvitePairing = null;

async function tryCreateP2POffer() {
  try {
    if (typeof RTCPeerConnection === 'undefined') return null;
    const pairing = new PairingSignaling();
    const offer = await pairing.createInvite();
    return { pairing, offer };
  } catch (_) { return null; }
}

async function tryAutoAcceptP2P(offerCode) {
  try {
    if (typeof RTCPeerConnection === 'undefined' || !offerCode) return null;
    const pairing = new PairingSignaling();
    const answer = await pairing.acceptInvite(offerCode, channel => meshAdoptChannel(pairing.pc, channel));
    return answer;
  } catch (_) { return null; }
}

// Chi è appena entrato mostra questa risposta da rimandare a chi l'ha invitato
// (stesso schema copia/WhatsApp di openShareCode, ma per il codice di risposta):
// quando l'altro la incolla nella sua schermata "Invita", il canale si apre.
function offerToSendP2PAnswer(answerCode, groupName) {
  openModal(`
    <div class="p-4 space-y-3 text-center join-pop">
      <div class="w-12 h-12 mx-auto rounded-2xl grid place-items-center bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] border border-[color-mix(in_srgb,var(--primary)_40%,transparent)] join-badge">
        <svg class="w-6 h-6 text-[var(--primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>
      </div>
      <h3 class="text-base font-black">Collegamento diretto pronto</h3>
      <p class="text-[12px] text-[var(--on-surface-secondary)]">Manda questa risposta a chi ti ha invitato: da quando la incolla, le vostre spese si sincronizzano da sole quando siete online insieme, senza ri-condividere il link.</p>
      <textarea readonly class="w-full h-16 bg-black/30 border border-[var(--glass-border)] rounded-xl p-2 text-[10px] font-mono select-all">${answerCode}</textarea>
      <div class="grid grid-cols-2 gap-2">
        <button id="p2p-copy" class="btn-action py-2.5 text-[12px] font-bold rounded-xl">Copia</button>
        <button id="p2p-wa" class="btn-action py-2.5 text-[12px] font-bold rounded-xl">WhatsApp</button>
      </div>
      <button id="p2p-skip" class="w-full py-2 text-[11px] text-[var(--on-surface-secondary)]">Salta, va bene anche senza</button>
    </div>`);
  const msg = `Risposta per collegare Momentum su «${groupName}»:\n${answerCode}`;
  $('#p2p-copy')?.addEventListener('click', () => { navigator.clipboard?.writeText(answerCode); showToast('Risposta copiata.', 'success'); haptic('light'); closeModal(); });
  $('#p2p-wa')?.addEventListener('click', () => window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener'));
  $('#p2p-skip')?.addEventListener('click', () => closeModal());
}

// ── TRASPORTO A STAFFETTA (src/mesh/store-forward.js) ──
// Rende reale il pezzo che prima esisteva solo nei test: i dispositivi si
// passano davvero pacchetti cifrati destinati a QUALCUN ALTRO, che il
// portatore non puo' leggere. È così che un dato arriva a chi in questo
// momento non è online, senza che esista da nessuna parte un server che lo
// conserva — e quindi senza che esista qualcosa da leggere o sequestrare.
// BUG PREESISTENTE trovato per analogia mentre si correggeva la stessa
// forma su identitaFirma() (vedi sotto per la scoperta dal vivo): con più
// peer connessi quasi insieme, `for (const pid of ...) scambiaStaffetta(pid)`
// chiama questa funzione più volte senza aspettare la precedente — cacheare
// il RISULTATO invece della PROMISE lascia una finestra in cui due chiamate
// concorrenti generano due identità di scambio diverse sullo stesso
// dispositivo. Stesso rimedio: si cachea la promise.
// Chi ha titolo a ricevere un gruppo: solo un dispositivo che HA RIVENDICATO
// uno slot in quel gruppo (`claimedBy`, split-engine.js:471). Non basta essere
// collegati alla mesh — collegarsi a qualcuno per dividere una cena non deve
// dare accesso a tutti gli altri gruppi di quella persona.
// Prudente per costruzione: se non riconosco il dispositivo, NON mando. Il
// costo di un mancato invio è un sync in ritardo; il costo dell'errore
// opposto è mandare nomi e importi a chi non c'entra.
function peerAppartieneAlGruppo(peerId, gruppo) {
  if (!gruppo || !Array.isArray(gruppo.members)) return false;
  return gruppo.members.some((m) => m.claimedBy && m.claimedBy === peerId);
}

let __scambioIdentitaPromise = null;

function identitaScambio() {
  if (__scambioIdentitaPromise) return __scambioIdentitaPromise;
  // La chiave PRIVATA resta non esportabile — i suoi byte non sono leggibili
  // da nessun codice, nemmeno il nostro — ma ora SOPRAVVIVE alla chiusura
  // dell'app, conservata come oggetto CryptoKey in IndexedDB. Prima si
  // rigenerava ad ogni avvio, e quel commento chiamava "prezzo da pagare" una
  // perdita secca: un pacchetto e' indirizzato a una chiave pubblica, e se
  // quella chiave muore il pacchetto resta sigillato per sempre. Con tre
  // aperture al giorno la probabilita' di consegna era ~5%.
  // Vedi exchange-identity.js per la misura completa e il ripiego dichiarato.
  __scambioIdentitaPromise = loadOrCreateExchangeIdentity().then((id) => {
    VaultDAO.state.exchangePublicKey = id.publicKey;
    VaultDAO.state.exchangeKeyPersistente = id.persistente;
    return id;
  });
  return __scambioIdentitaPromise;
}

// Identità di FIRMA (device-trust.js), separata da quella di scambio: serve
// a dimostrare "sono lo stesso dispositivo di prima", non a mettersi
// d'accordo su un segreto. Stesso motivo di persistenza già spiegato sopra:
// senza sopravvivere al riavvio, nessun dispositivo fidato resterebbe tale.
// BUG REALE trovato dal vivo (due schede, tre parole diverse su ciascun
// lato — nessun attaccante, solo una corsa nel proprio codice): questa
// funzione veniva chiamata due volte quasi in contemporanea — una da
// onPeerConnected per MANDARE la chiave, una da gestisciDeviceHello per
// CALCOLARE le parole appena arriva quella del peer. Cacheare il
// RISULTATO non basta: finché la prima await non è tornata, la cache è
// ancora vuota, quindi la seconda chiamata genera una SECONDA identità in
// parallelo. Ogni chiamata ritorna la PROPRIA coppia di chiavi appena
// generata: quella che perde la corsa di scrittura sul deposito è comunque
// già stata restituita e usata da un pezzo di codice diverso da quella che
// vince — due chiavi diverse sullo stesso dispositivo, nello stesso istante.
// Si cachea la PROMISE, non il valore: chiamate concorrenti condividono la
// stessa attesa invece di avviarne una a testa.
let __firmaIdentitaPromise = null;
function identitaFirma() {
  if (!__firmaIdentitaPromise) __firmaIdentitaPromise = loadOrCreateDeviceIdentity();
  return __firmaIdentitaPromise;
}

// Un aggancio già confermato con le tre parole non deve richiederle di
// nuovo ad ogni riconnessione nella stessa sessione — solo la PRIMA volta
// che si vede quella chiave pubblica in questa finestra dell'app.
const __proposteFiduciaMostrate = new Set();

// Quando un peer manda la sua chiave (device_hello): se è già fidato non si
// disturba l'utente con niente; altrimenti si calcolano le tre parole e si
// chiede UNA conferma umana — l'unico gesto che distingue "il mio secondo
// telefono" da "il telefono di uno sconosciuto sulla stessa rete".
async function gestisciDeviceHello(peerId, publicKeyAltrui) {
  if (!publicKeyAltrui) return;
  const fidati = VaultDAO.state.trustedDevices || [];
  if (isTrustedKey(fidati, publicKeyAltrui)) return; // già confermato in passato, nulla da chiedere
  if (__proposteFiduciaMostrate.has(publicKeyAltrui)) return; // già proposto in questa sessione
  __proposteFiduciaMostrate.add(publicKeyAltrui);
  const mia = await identitaFirma();
  const parole = await verificationWords(mia.publicKey, publicKeyAltrui);
  window.confermaFiduciaDispositivo = (conferma) => {
    if (conferma) {
      VaultDAO.state.trustedDevices = addTrustedDevice(VaultDAO.state.trustedDevices || [], { publicKey: publicKeyAltrui, label: 'Dispositivo collegato', now: Date.now() });
      VaultDAO.save();
      showToast('Dispositivo riconosciuto: non ti verrà più chiesto.', 'success');
    }
    closeModal();
    delete window.confermaFiduciaDispositivo;
  };
  openModal(`
    <div class="p-5 space-y-4 text-center">
      <h3 class="text-lg font-bold">Sono le stesse tre parole sull'altro schermo?</h3>
      <p class="text-xs text-[var(--on-surface-secondary)]">Guardale anche sull'altro dispositivo: se coincidono, il collegamento è sicuro. Se sono diverse, qualcun altro potrebbe essersi messo in mezzo — non confermare.</p>
      <div class="flex justify-center gap-3 py-2">
        ${parole.map((p) => `<span class="px-3 py-2 rounded-xl bg-black/30 border border-[var(--glass-border)] font-mono text-base font-bold">${escapeHtml(p)}</span>`).join('')}
      </div>
      <div class="flex gap-2">
        <button onclick="window.confermaFiduciaDispositivo(false)" class="btn-action flex-1 text-xs opacity-70">Sono diverse</button>
        <button onclick="window.confermaFiduciaDispositivo(true)" class="btn-action flex-1 text-xs">Sì, sono uguali</button>
      </div>
    </div>
  `);
}

function saccoStaffetta() {
  return pruneExpired(VaultDAO.state.carryBag || []);
}

// A ogni incontro: consegno cio' che è per lui, e accetto cio' che porta.
// Prova a far arrivare UN pacchetto a un dispositivo che non è collegato
// direttamente: diretto -> ponte -> consegna differita, in quest'ordine.
// È il punto in cui relay-election.js passa da motore testato a strada vera.
window.inviaAlDispositivo = (targetId, bundle) => {
  if (!momentumMeshNode?.routeToPeer) return { tipo: 'nessuno' };
  const r = momentumMeshNode.routeToPeer(targetId, bundle);
  if (r.tipo === 'differito') {
    // Non si perde: entra nel sacco e parte al primo incontro utile.
    VaultDAO.state.carryBag = acceptForCarry(saccoStaffetta(), bundle);
    VaultDAO.save();
  }
  return r;
};

async function scambiaStaffetta(peerId) {
  try {
    if (!momentumMeshNode) return;
    const sacco = saccoStaffetta();
    if (!sacco.length) return;
    // Non so quale sia la chiave del peer finché non me la dice: gli passo
    // tutto cio' che ha ancora vita davanti, e sarà lui a tenere solo cio'
    // che riguarda lui o che accetta di portare avanti. Non è uno spreco:
    // sono pacchetti che nessuno dei due puo' leggere.
    momentumMeshNode.sendBundles(peerId, sacco.slice(0, MAX_CARRIED));
  } catch (e) { console.warn('Scambio a staffetta non riuscito:', e); }
}

// ── SYNC LIVE: la spesa appena inserita arriva SUBITO sull'altro schermo ──
// Difetto trovato: requestSync veniva chiamato SOLO alla connessione. Una
// spesa aggiunta mentre i due dispositivi erano già collegati non partiva:
// l'altro la vedeva alla riconnessione successiva. I gruppi di divisione si
// propagavano al volo, le transazioni no.
//
// La parte intelligente non è "mandare tutto subito" — sarebbe chiacchiericcio
// e batteria sprecata sul telefono di chi riceve. È decidere QUANDO, con lo
// stesso punteggio semantico già usato per l'ordine (sync-priority.js):
//   - ciò che cambia una decisione ADESSO (spesa di oggi, importo grosso)
//     parte immediatamente;
//   - il resto viene accorpato in una finestra breve, così tre inserimenti di
//     fila diventano un messaggio solo invece di tre.
const LIVE_SYNC_SOGLIA_URGENZA = 1.5; // sopra: parte subito
const LIVE_SYNC_ATTESA_MS = 1500;     // sotto: si accorpa
let __liveSyncCoda = [];
let __liveSyncTimer = null;

function flushLiveSync() {
  clearTimeout(__liveSyncTimer);
  __liveSyncTimer = null;
  const coda = __liveSyncCoda;
  __liveSyncCoda = [];
  if (!coda.length || !momentumMeshNode) return;
  try {
    const perMese = {};
    for (const { mese, tx } of coda) (perMese[mese] = perMese[mese] || []).push(tx);
    momentumMeshNode.broadcastTransactions(rankMissingByMonth(perMese, { now: Date.now() }));
  } catch (e) { console.warn('Sync live non riuscito (i dati partiranno alla prossima connessione):', e); }
}

// LA GARANZIA, scritta perché non resti un'assunzione: la finestra di
// accorpamento RAGGRUPPA, non filtra — tutto ciò che entra in coda viene
// spedito, o subito o entro 1,5 secondi. E se anche non partisse (app chiusa
// nell'istante sbagliato, nessun peer collegato in quel momento), alla
// prossima connessione parte comunque la sincronizzazione differenziale
// completa: il sync live è un'ACCELERAZIONE sopra quella garanzia, mai un
// suo sostituto. Nessun dato può sparire perché era "poco urgente".
//
// Resta un caso stretto e reale: l'app che viene chiusa o messa in secondo
// piano DENTRO la finestra. Qui si svuota la coda prima che accada, così
// anche quell'ultimo inserimento parte subito invece di aspettare la
// riconnessione.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushLiveSync(); });
  window.addEventListener('pagehide', () => flushLiveSync());
}

function queueLiveSync(mese, tx) {
  if (!momentumMeshNode || !tx) return;
  __liveSyncCoda.push({ mese, tx });
  // Urgenza dal punteggio già testato: vicinanza a oggi + importo.
  const urgente = scoreForSync(tx, { now: Date.now() }) >= LIVE_SYNC_SOGLIA_URGENZA;
  if (urgente) { flushLiveSync(); return; }
  if (!__liveSyncTimer) __liveSyncTimer = setTimeout(flushLiveSync, LIVE_SYNC_ATTESA_MS);
}

// ── CALCOLO CONDIVISO TRA DISPOSITIVI (src/mesh/compute-market.js) ──
// Un telefono in carica, un tablet sul tavolo e il portatile di un amico
// sono insieme molta più potenza di quella che ha in mano l'utente. Qui la
// si usa per i calcoli pesanti — ma solo per i carichi il cui input è
// PUBBLICO (rendimenti di mercato, serie storiche): mai sui dati personali,
// e il cancello (assertShareable) viene prima di tutto il resto.
//
// I carichi sono DETERMINISTICI: dallo stesso seme esce lo stesso numero,
// bit per bit. È questo che rende possibile verificare chi calcola per te,
// invece di doverti fidare.
const COMPUTE_WORKLOADS = {
  // Un cammino Monte Carlo su rendimenti di mercato: input pubblico, output
  // un singolo numero. Generatore congruenziale seminato dall'unità: due
  // dispositivi che ricevono lo stesso seme DEVONO produrre lo stesso valore,
  // ed è esattamente ciò che il controllo incrociato verifica.
  'montecarlo-strategie': ({ seed }, { mu = 0.05, sigma = 0.15, anni = 10 } = {}) => {
    let s = seed >>> 0;
    const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    let valore = 1;
    for (let a = 0; a < anni; a++) {
      // Box-Muller: da uniforme a normale, deterministico dato il seme
      const u1 = Math.max(1e-12, rnd()), u2 = rnd();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      valore *= 1 + mu + sigma * z;
    }
    return +valore.toFixed(6);
  },
};

// Esegue le unità che un peer ci ha assegnato. Ricontrolla il cancello: chi
// esegue non si fida di chi chiede.
function runComputeUnitsLocally(workloadId, units) {
  try {
    assertShareable(workloadId); // lancia se non distribuibile: si rifiuta e basta
  } catch (e) {
    console.warn('Richiesta di calcolo rifiutata:', e.message);
    return null;
  }
  const fn = COMPUTE_WORKLOADS[workloadId];
  if (!fn) return null;
  const out = {};
  for (const u of units || []) out[u.index] = fn(u);
  return out;
}

// ── APPRENDIMENTO CONDIVISO (src/mesh/federated-distillation.js) ──
// Il problema del settore: quasi tutti dicono "condividiamo i pesi del
// modello, non i dati". NON è privacy: dai gradienti si possono
// ricostruire gli esempi di addestramento. Qui non escono né pesi né
// gradienti — esce solo un LESSICO (parola → categoria) già filtrato con
// soglia k-anonima, dove un nome visto da un solo dispositivo non esce mai.
// Opt-in esplicito, spento di default, e prima di accendere si mostrano LE
// RIGHE VERE che uscirebbero: una descrizione rassicurante non basta.
function lexiconPool() {
  return VaultDAO.state.mlData?.lexiconPool || initLexiconPool();
}
function shareLexiconIfAllowed() {
  try {
    if (!VaultDAO.state.sharedLearningOptIn || !momentumMeshNode) return 0;
    const digest = buildLexiconDigest(lexiconPool(), { k: DEFAULT_K_ANONYMITY });
    return momentumMeshNode.shareLexicon(digest);
  } catch (e) { console.warn('Condivisione lessico non riuscita:', e); return 0; }
}
window.openSharedLearning = () => {
  const pool = lexiconPool();
  const uscirebbero = eligibleLexicon(pool, { k: DEFAULT_K_ANONYMITY });
  const trattenuti = heldBackLexicon(pool, { k: DEFAULT_K_ANONYMITY });
  const attivo = !!VaultDAO.state.sharedLearningOptIn;
  const righe = uscirebbero.slice(0, 10)
    .map((e) => `<div class="flex items-center justify-between gap-2 text-[11px] py-1 border-b border-[var(--glass-border)]"><span class="font-mono truncate">${escapeHtml(e.token)}</span><span class="text-[var(--on-surface-secondary)] shrink-0">${escapeHtml(e.category)}</span></div>`)
    .join('');
  openModal(`
    <div class="flex flex-col gap-4 p-4 sm:p-6 lg:p-2 text-center items-center modal-section-in">
      ${tl1Icon('<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="3.5"/>', '--primary')}
      <div>
        <h3 class="text-lg font-black leading-tight">Far crescere l'intelligenza insieme</h3>
        <p class="card-sub !mb-0 mt-1.5">I tuoi dispositivi possono insegnarsi a vicenda a riconoscere i negozi. Non escono spese, importi né date: solo "questa parola è di questa categoria".</p>
      </div>
      <div class="w-full text-left">
        <div class="text-[10px] font-bold uppercase tracking-wide text-[var(--on-surface-secondary)] mb-1.5">Esattamente questo uscirebbe (${uscirebbero.length} voci)</div>
        <div class="rounded-xl border border-[var(--glass-border)] bg-black/20 px-3 py-2 max-h-44 overflow-y-auto">
          ${righe || '<p class="text-[11px] text-[var(--on-surface-secondary)] py-2">Ancora niente: servono più dispositivi che vedano lo stesso negozio prima che una voce diventi condivisibile.</p>'}
        </div>
        ${trattenuti.length ? `<p class="text-[10px] text-emerald-300/90 mt-2 leading-snug">${trattenuti.length} voci restano ferme qui: le ha viste un solo dispositivo, e da sole potrebbero identificarti. Non escono mai.</p>` : ''}
      </div>
      <p class="text-[10px] text-[var(--on-surface-secondary)] leading-snug">Nessun peso e nessun gradiente lascia il dispositivo — da quelli si potrebbero ricostruire i tuoi dati, ed è il motivo per cui non li usiamo. Quello che ricevi viene accettato solo se almeno due dispositivi indipendenti concordano, e non sovrascrive mai una tua correzione.</p>
      ${attivo
        ? `<button onclick="window.setSharedLearning(false)" class="btn-action w-full py-3 font-bold rounded-xl">Disattiva</button>`
        : `<button onclick="window.setSharedLearning(true)" class="btn-action btn-primary w-full py-3.5 font-bold rounded-xl">Attiva l'apprendimento condiviso</button>`}
    </div>`);
};
window.setSharedLearning = (on) => {
  VaultDAO.state.sharedLearningOptIn = !!on;
  VaultDAO.save();
  if (on) {
    const n = shareLexiconIfAllowed();
    showToast(n > 0 ? `Attivo — condiviso con ${n} dispositivo${n > 1 ? 'i' : ''}.` : 'Attivo: condividerò al prossimo collegamento.', 'success');
  } else {
    showToast('Disattivato: da adesso non esce più nulla.', 'info');
  }
  window.openSharedLearning();
};

window.openMeshPairing = () => {
  openModal(`
    <div class="p-4 space-y-4">
      <h3 class="text-lg font-bold inline-flex items-center gap-2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M12 5a3 3 0 0 0-3 3c-1.7 0-3 1.3-3 3s1.3 3 3 3a3 3 0 0 0 6 0c1.7 0 3-1.3 3-3s-1.3-3-3-3a3 3 0 0 0-3-3z"/><path d="M12 5v14"/></svg>Collega un dispositivo</h3>
      <p class="text-xs text-[var(--on-surface-secondary)]">Le due AI impareranno l'una dall'altra. I tuoi dati NON si spostano: viaggiano solo i "pesi" imparati, protetti dal controllo anti-manomissione.</p>
      <!-- DIAGNOSI DI RETE PREDITTIVA (src/mesh/nat-probe.js): il punto di
           abbandono numero uno della sincronizzazione è la rotella che gira
           e poi fallisce, su reti (telefono, aziendali) dove il collegamento
           diretto non poteva partire in partenza. Qui si misura PRIMA e si
           dice cosa aspettarsi, in una frase umana — mai una percentuale. -->
      <div id="mesh-net-diag" class="rounded-xl border border-[var(--glass-border)] bg-black/20 px-3 py-2.5">
        <div class="flex items-center gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-[var(--on-surface-secondary)] animate-pulse"></span>
          <span class="text-[11px] text-[var(--on-surface-secondary)]">Sto guardando che rete hai…</span>
        </div>
      </div>
      <div class="flex gap-2">
        <button onclick="window.meshCreateInvite()" class="btn-action flex-1 text-xs">1a. Crea invito (questo dispositivo)</button>
      </div>
      <textarea id="mesh-code-out" readonly placeholder="Il codice da copiare sull'altro dispositivo apparirà qui..." class="w-full bg-black/30 border border-[var(--glass-border)] rounded-xl p-3 text-[10px] font-mono h-20"></textarea>
      <div class="border-t border-[var(--outline)] pt-3">
        <p class="text-[10px] text-[var(--on-surface-secondary)] mb-2">Incolla qui il codice ricevuto dall'altro dispositivo:</p>
        <textarea id="mesh-code-in" placeholder="Codice dall'altro dispositivo..." class="w-full bg-black/30 border border-[var(--glass-border)] rounded-xl p-3 text-[10px] font-mono h-20"></textarea>
        <div class="flex gap-2 mt-2">
          <button onclick="window.meshJoin()" class="btn-action flex-1 text-xs">1b. Ho ricevuto un INVITO</button>
          <button onclick="window.meshAcceptAnswer()" class="btn-action flex-1 text-xs">2a. Ho ricevuto la RISPOSTA</button>
        </div>
      </div>
    </div>
  `);
  runMeshNetDiagnosis();
};

// Misura la rete e lo dice PRIMA che l'utente aspetti. Il piano lo chiama
// il punto di abbandono numero uno: su rete mobile con NAT simmetrico o
// CGNAT il collegamento diretto non si stabilisce, l'utente vede una
// rotella e conclude che l'app è rotta. Qui la sonda gira in background e
// la card diventa una frase onesta: cosa succederà e cosa faremo invece.
// Best-effort: se la sonda non può girare (WebRTC assente, permessi), la
// card sparisce e i pulsanti restano — mai un blocco per una diagnosi.
async function runMeshNetDiagnosis() {
  const box = document.getElementById('mesh-net-diag');
  if (!box) return;
  try {
    const { probeNetwork } = await import('./mesh/nat-probe.js');
    const { initChannelLearning, tipoRete } = await import('./mesh/channel-learning.js');
    // Il modello vive nel vault, additivo: un dispositivo nuovo parte dalla
    // sola fisica (nat-matrix.js) e comincia a correggerla appena si
    // registrano esiti reali. Oggi nessun punto del codice registra ancora
    // un esito — la lettura è collegata, la scrittura resta il passo
    // successivo dichiarato, non va lasciato ambiguo.
    // Salvato SUBITO, non al prossimo save() casuale di qualcos'altro: senza
    // questo, aprendo l'app solo per collegare due dispositivi (mai una
    // transazione nel mezzo) il modello sparirebbe alla chiusura — proprio
    // la sessione in cui servirebbe di più cominciare a imparare.
    if (!VaultDAO.state.channelLearning) { VaultDAO.state.channelLearning = initChannelLearning(); VaultDAO.save(); }
    const { nat, advice, timeoutMs } = await probeNetwork({
      channels: { link: true, paste: true },
      learningModel: VaultDAO.state.channelLearning,
      reteTipo: tipoRete(),
    });
    __ultimaNatDiagnosi = { nat, reteTipo: tipoRete() };
    // La propria classe di rete va data al nodo mesh: da qui in poi viaggia
    // in ogni device_hello e nel gossip, ed è ciò che rende CALCOLABILE
    // l'elezione di un ponte per chi non ci arriva in diretta. Senza,
    // relay-election resta un motore che non può decidere niente.
    try { momentumMeshNode?.setLocalNat?.(nat.kind); } catch (_) {}
    const diretto = advice.prefer === 'direct';
    // Neurocolori coerenti col resto dell'app: verde = via libera,
    // ambra = momento consapevole (c'è un piano B pronto). Mai rosso: la
    // rete dell'utente non è una sua colpa. Classi LETTERALI, non costruite
    // a stringa: sopravvivono a qualunque compilazione futura di Tailwind.
    const S = diretto
      ? { box: 'rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2.5', icon: 'text-emerald-300', title: 'text-emerald-300', body: 'text-emerald-200/90' }
      : { box: 'rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2.5', icon: 'text-amber-300', title: 'text-amber-300', body: 'text-amber-200/90' };
    box.className = S.box;
    box.innerHTML = `
      <div class="flex items-start gap-2">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 shrink-0 mt-0.5 ${S.icon}">
          ${diretto ? '<path d="M5 12.5 10 17l9-10"/>' : '<path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="9"/>'}
        </svg>
        <div class="min-w-0">
          <p class="text-[11px] font-bold ${S.title} leading-snug">${escapeHtml(advice.headline)}</p>
          ${advice.detail ? `<p class="text-[11px] ${S.body} mt-1 leading-snug">${escapeHtml(advice.detail)}</p>` : ''}
          <button type="button" onclick="this.nextElementSibling.classList.toggle('hidden')" class="text-[10px] text-[var(--on-surface-secondary)] underline mt-1.5">Perché?</button>
          <p class="hidden text-[10px] text-[var(--on-surface-secondary)] mt-1 leading-snug">${escapeHtml(nat.reason)}${timeoutMs ? ` Se non parte entro ${Math.round(timeoutMs / 1000)} secondi passiamo al link, senza farti aspettare oltre.` : ''}</p>
        </div>
      </div>`;
    // Consegna differita: si dice qualcosa SOLO se non funziona. Nel caso
    // buono il silenzio è la scelta giusta — un avviso che conferma il
    // normale è rumore, e il rumore è il primo passo verso l'abbandono.
    try {
      const stato = statoIdentita(await identitaScambio());
      if (!stato.ok) {
        const nota = document.createElement('p');
        nota.className = 'text-[11px] text-amber-200/90 mt-2 leading-snug';
        nota.textContent = stato.testo;
        box.appendChild(nota);
      }
    } catch { /* la diagnosi di rete resta valida anche senza questa nota */ }
  } catch (e) {
    console.warn('Diagnosi di rete non disponibile:', e);
    box.remove(); // meglio niente che una diagnosi finta
  }
}

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
  try { initTelemetryToggle(); } catch (e) { console.error('initTelemetryToggle:', e); }
  // Le regole fiscali adottate in una sessione precedente devono valere SUBITO,
  // dal primo numero mostrato — non dal prossimo aggiornamento riuscito.
  try { applicaRegoleFiscaliAttive(); } catch (e) { console.warn('Regole fiscali attive non applicate:', e); }
  // SCHEDULER (mancava del tutto): finora `runAutoUpdateCycle` partiva SOLO da
  // un tocco nelle impostazioni. Un'app che "non invecchia" ma si aggiorna solo
  // se qualcuno preme un bottone non si aggiorna: chi non apre quel pannello —
  // cioè quasi tutti — resta indietro per sempre.
  // Al ritorno sull'app, non a intervallo fisso: un timer che scatta mentre la
  // scheda è in secondo piano consuma rete e batteria per un dato che nessuno
  // sta guardando. `runUpdateCycle` ha già il suo backoff e il suo budget di
  // richieste, quindi tornare spesso non moltiplica le chiamate.
  try {
    const forse = () => { runAutoUpdateCycle().catch(() => {}); };
    setTimeout(forse, 8000); // non al primo istante: prima l'app deve essere usabile
    document.addEventListener('visibilitychange', () => { if (!document.hidden) forse(); });
  } catch (e) { console.warn('Scheduler aggiornamenti non avviato:', e); }
  // Register Service Worker for PWA — aggiornamento automatico: quando il
  // nuovo service worker (già installato in background da skipWaiting/
  // clients.claim in sw.js) prende davvero il controllo della pagina, si
  // ricarica UNA VOLTA per caricare il codice nuovo, senza azione manuale
  // dell'utente. I dati non sono a rischio in questo passaggio: vivono in
  // IndexedDB/localStorage, indipendenti dal bundle JS in esecuzione — un
  // deploy nuovo non li tocca (vedi runSchemaMigrations in vault.js per la
  // sicurezza sui cambi di STRUTTURA dei dati tra versioni).
  // In DEV (localhost) NON registrare il service worker: in sviluppo il SW
  // serviva HTML/CSS/JS STANTIO (bug ricorrente in tutto il progetto — "vedo la
  // versione vecchia"), rendendo impossibile vedere i cambiamenti. Su localhost
  // il dev server (vite) è già sempre fresco. In produzione il SW resta (offline
  // + PWA). Se un SW era già registrato in dev, lo si rimuove.
  const isLocalDev = ['localhost', '127.0.0.1', '0.0.0.0'].includes(location.hostname);
  if ('serviceWorker' in navigator && isLocalDev) {
    navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
    if (navigator.serviceWorker.controller) {
      // una vecchia istanza SW controlla ancora la pagina: pulizia + reload unico
      caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))).catch(() => {});
    }
  } else if ('serviceWorker' in navigator) {
    // updateViaCache:'none' → il browser NON usa la sua cache HTTP per sw.js:
    // controlla SEMPRE se c'è un service worker nuovo (fix del problema ricorrente
    // "vedo ancora la versione vecchia"). Combinato con skipWaiting/clients.claim
    // in sw.js e il reload su controllerchange, un deploy nuovo arriva da solo.
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
      .then(reg => {
        console.log('ServiceWorker registered:', reg);
        window.momentumSWReg = reg; // per il bottone manuale "Cerca aggiornamenti ora" nel Vault
        // Controlla aggiornamenti SUBITO e a ogni RIAPERTURA/ritorno all'app
        // (focus / tab di nuovo visibile), non solo ogni ora: appena riapri
        // Momentum prende il codice nuovo, senza aspettare né azioni manuali.
        const checkUpdate = () => reg.update().catch(() => {});
        checkUpdate();
        setInterval(checkUpdate, 30 * 60 * 1000);
        window.addEventListener('focus', checkUpdate);
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpdate(); });
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

    // Controllo MANUALE ("Cerca aggiornamenti ora" nel Vault): oltre ai controlli
    // automatici (apertura/focus/ritorno visibile/ogni 30 min), chi vuole la
    // certezza subito può chiederlo a tocco. Se c'è una versione nuova, lo stesso
    // flusso automatico sopra (updatefound → toast → controllerchange → reload)
    // scatta da solo; se non c'è, lo diciamo onestamente invece di far finta.
    window.checkForAppUpdate = async (e) => {
      const btn = e?.currentTarget || document.getElementById('check-update-btn');
      if (!window.momentumSWReg) { showToast('Il controllo automatico è già attivo su questo dispositivo.', 'info'); return; }
      btn?.classList.add('checking-update');
      haptic('light');
      try {
        const before = window.momentumSWReg.installing || window.momentumSWReg.waiting;
        await window.momentumSWReg.update();
        await new Promise(r => setTimeout(r, 800)); // tempo reale perché il browser scarichi e valuti sw.js
        const after = window.momentumSWReg.installing || window.momentumSWReg.waiting;
        if (after && after !== before) {
          showToast('Trovata una versione nuova — si installa da sola tra un attimo.', 'success');
        } else {
          showToast('Hai già l\'ultima versione di Momentum.', 'success');
        }
      } catch (_) {
        showToast('Non sono riuscito a controllare ora: ci riprovo automaticamente più tardi.', 'error');
      } finally {
        btn?.classList.remove('checking-update');
      }
    };
  }

  // ── FEEDBACK ─────────────────────────────────────────────────────────────
  // Zero-server per i DATI finanziari (regola non negoziabile del progetto);
  // il feedback testuale è l'UNICA eccezione dichiarata, ed è per questo un
  // modulo separato (Formspree, gratuito, nessun account per l'utente) — mai
  // un dato di spesa/saldo/identità nel corpo, solo il testo scritto qui.
  // Endpoint reale del progetto (form Formspree dell'autore). Se un giorno
  // smettesse di rispondere, l'invio fallisce onestamente con un errore e il
  // pulsante torna attivo: mai un finto "grazie" su una richiesta non riuscita.
  const FEEDBACK_ENDPOINT = 'https://formspree.io/f/mrenjlnj';

  window.openFeedbackModal = () => {
    haptic('light');
    let rating = 0;
    openModal(`
      <div class="p-4 sm:p-5 lg:p-0 flex flex-col items-center text-center gap-3 join-pop">
        <span class="qa-wait-orb" style="width:64px;height:64px;"><span class="qa-spark"></span><span class="qa-spark"></span><span class="qa-spark"></span><span class="qa-pulse"></span><span class="qa-pulse"></span><span class="qa-pulse"></span></span>
        <div>
          <h3 class="text-lg font-black leading-tight">Cosa ne pensi di Momentum?</h3>
          <p class="card-sub !mb-0">Due righe bastano. Nessuna spesa, saldo o dato personale lascia mai questo telefono — solo quello che scrivi qui sotto.</p>
        </div>
        <div id="fb-stars" class="flex gap-1.5 my-1">
          ${[1, 2, 3, 4, 5].map(n => `<button type="button" data-star="${n}" class="fb-star p-1" aria-label="${n} stelle"><svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l2.7 5.9 6.3.6-4.8 4.3 1.4 6.2-5.6-3.3-5.6 3.3 1.4-6.2-4.8-4.3 6.3-.6z"/></svg></button>`).join('')}
        </div>
        <textarea id="fb-text" class="w-full h-24 bg-[var(--surface-elevated)] border border-[var(--outline)] rounded-xl p-3 text-sm" placeholder="Cosa funziona, cosa no, cosa vorresti diverso… (facoltativo)"></textarea>
        <button id="fb-send" class="btn-action btn-primary w-full py-3 font-bold rounded-xl" disabled>Invia</button>
        <button id="fb-skip" class="text-[11px] text-[var(--on-surface-secondary)]">Non ora</button>
      </div>`);
    const sendBtn = $('#fb-send');
    document.querySelectorAll('.fb-star').forEach(star => {
      star.addEventListener('click', () => {
        rating = +star.dataset.star;
        document.querySelectorAll('.fb-star').forEach(s => {
          const active = +s.dataset.star <= rating;
          s.classList.toggle('fb-star-active', active);
          s.querySelector('svg').setAttribute('fill', active ? 'currentColor' : 'none');
        });
        sendBtn.disabled = false;
        haptic('light');
      });
    });
    $('#fb-skip')?.addEventListener('click', () => closeModal());
    sendBtn?.addEventListener('click', async () => {
      sendBtn.disabled = true;
      sendBtn.textContent = 'Invio…';
      const message = $('#fb-text')?.value?.trim() || '';
      try {
        const res = await fetch(FEEDBACK_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ rating, message, app: 'Momentum', version: $('#version-display')?.textContent || '' }),
        });
        if (!res.ok) throw new Error('risposta non ok');
        haptic('heavy');
        // Ringraziamento: stessa disciplina "un battito, poi torna calmo" già
        // usata per il collegamento P2P riuscito — icona coerente, non un'altra
        // emoji, e chiusura da sola dopo un momento invece di lasciare l'utente
        // a chiedersi se è davvero partito.
        const modalBody = sendBtn.closest('.join-pop') || sendBtn.parentElement;
        if (modalBody) {
          modalBody.innerHTML = `
            <div class="flex flex-col items-center text-center gap-2 py-4">
              <div class="w-14 h-14 rounded-2xl grid place-items-center bg-emerald-500/15 border border-emerald-500/30 join-badge">
                <svg class="w-7 h-7 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <h3 class="text-base font-black">Grazie!</h3>
              <p class="card-sub !mb-0">Ogni feedback aiuta davvero a migliorare Momentum.</p>
            </div>`;
        }
        setTimeout(() => closeModal(), 1600);
      } catch (_) {
        showToast('Non sono riuscito a inviarlo ora. Riprova tra poco.', 'error');
        sendBtn.disabled = false;
        sendBtn.textContent = 'Invia';
      }
    });
  };

  try {
    VaultDAO.init();
  } catch(e) { console.error("VaultDAO init error:", e); }

  initMomentumRealAI();

  const mobileAddBtn = document.getElementById('mobile-add-btn');
  if (mobileAddBtn) {
    mobileAddBtn.onclick = openTransactionModal;
  }

  // Card "Chiedi a Momentum" (src/ai/qa-engine.js). Fuori dal perimetro
  // finanziario (intent 'unknown') e SOLO se l'utente ha attivato
  // esplicitamente la chat generica (chiave Gemini/Groq propria, opt-in —
  // src/ai/chat-fallback.js), prova il fallback cloud. Mai automatico.
  const qaInput = $('#qa-input');
  const qaSend = $('#qa-send');
  const qaAnswer = $('#qa-answer');
  // Ogni STATO della risposta ha un colore/icona propri, mai un paragrafo
  // anonimo: locale (ambra=attenzione, verde=buona notizia, blu=info,
  // stesso linguaggio cromatico del resto dell'app), "sto pensando"
  // (violetto, pulsazione — chiarisce che sta uscendo dal dispositivo),
  // risposta esterna riuscita (violetto, etichetta col nome del provider —
  // trasparenza: l'utente deve SEMPRE sapere quando risponde un'AI esterna
  // e non Momentum), errore esterno (rosso, con un modo diretto per
  // sistemare la chiave invece di un messaggio d'errore grezzo).
  const ICON_QA_THINK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="w-3.5 h-3.5 inline-block animate-pulse"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`;
  const ICON_QA_CLOUD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 inline-block"><path d="M17.5 19a4.5 4.5 0 000-9 6 6 0 00-11.6 1.7A4 4 0 006 19h11.5z"/></svg>`;
  const ICON_QA_WARN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 inline-block qa-arrive-icon qa-icon-danger"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>`;
  // Stessa icona-fumetto del titolo "Chiedi a Momentum" (index.html) — quando
  // risponde Momentum stesso, l'eyebrow lo dice subito, stessa grammatica
  // visiva della risposta cloud (etichetta in testa, mai un blob di testo nudo).
  const ICON_QA_MOMENTUM = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 inline-block"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`;
  // Scintilla a 4 punte (stessa famiglia visiva delle altre icone QA: line-art,
  // stroke-width 2) — segna una risposta guidata da ciò che l'utente ha
  // insegnato al QA (qa-learning.js), mai un'emoji fuori registro col resto
  // dell'interfaccia.
  const ICON_QA_LEARNED = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3 h-3 inline-block"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M6.5 6.5l1.8 1.8M15.7 15.7l1.8 1.8M6.5 17.5l1.8-1.8M15.7 8.3l1.8-1.8"/></svg>`;
  function replayQaAnimation() {
    qaAnswer.classList.remove('qa-answer-in'); void qaAnswer.offsetWidth; qaAnswer.classList.add('qa-answer-in');
  }
  // Stessa grammatica visiva della risposta cloud (eyebrow con icona in
  // testa + blocchi con evidenze colorate) applicata anche alle risposte
  // ISTANTANEE di Momentum stesso — prima era solo testo nudo (textContent),
  // mentre l'esterno aveva già struttura: disparità richiesta di correggere.
  // BUG REALE segnalato dall'utente: "non mi crea grafici e statistiche
  // come chiesto" — la risposta a "dove spendo di più?" era SOLO testo con
  // percentuali scritte, mai un grafico vero. qa-engine.js già calcola i
  // dati (res.data = [[categoria, importo], ...] top 3) per l'intento
  // 'top-category': qui li disegna, non li ripete solo a parole. Barre
  // colorate con lo STESSO colore categoria usato ovunque nell'app (mai
  // una palette isolata).
  function buildTopCategoryChart(data) {
    if (!Array.isArray(data) || !data.length) return '';
    const max = Math.max(...data.map(([, v]) => v));
    const rows = data.map(([id, v]) => {
      const cat = getCatById(id);
      const pct = Math.max(6, Math.round((v / max) * 100));
      return `<div class="flex items-center gap-2">
        <span class="w-16 truncate text-[var(--on-surface-secondary)]">${cat.name}</span>
        <div class="flex-1 h-2 rounded-full bg-white/5 overflow-hidden"><div class="h-full rounded-full qa-cloud-block" style="width:${pct}%;background:${cat.color}"></div></div>
        <span class="w-16 text-right font-mono" style="color:${cat.color}">${formatMoney(v)}</span>
      </div>`;
    }).join('');
    return `<div class="space-y-1.5 mt-2">${rows}</div>`;
  }
  // Barra impilata generica (contante/investito/debiti, libero/impegni,
  // disponibile/da accantonare...) — STESSA grammatica visiva di
  // buildTopCategoryChart (barre colorate + legenda), mai un secondo stile
  // isolato per ogni nuovo intento. Segmenti a valore 0 o negativo non
  // vengono disegnati (mai una barra vuota che sembra un bug).
  function buildStackedBar(segments) {
    const real = segments.filter(s => s.value > 0);
    if (!real.length) return '';
    const max = Math.max(1, real.reduce((s, x) => s + x.value, 0));
    const bars = real.map(s => `<div class="h-full" style="width:${Math.max(2, (s.value / max) * 100)}%;background:${s.color}" title="${s.label} ${formatMoney(s.value)}"></div>`).join('');
    const legend = real.map(s => `<span><span class="inline-block w-1.5 h-1.5 rounded-full mr-1" style="background:${s.color}"></span>${s.label} ${formatMoney(s.value)}</span>`).join('');
    return `<div class="mt-2">
      <div class="flex h-2.5 rounded-full overflow-hidden bg-white/5">${bars}</div>
      <div class="flex flex-wrap gap-3 mt-1.5 text-[11px] text-slate-500">${legend}</div>
    </div>`;
  }
  // "quanto vale il mio patrimonio?" — contante/investito/debiti in proporzione
  // al patrimonio LORDO (mai al netto: un debito alto sballerebbe le
  // proporzioni verso lo zero, rendendo il grafico inutile o fuorviante).
  function buildNetWorthChart(n) {
    return buildStackedBar([
      { label: 'Contante', value: n.cash, color: '#38bdf8' },
      { label: 'Investito', value: n.invested, color: '#a78bfa' },
      { label: 'Debiti', value: n.liabilities, color: '#fb7185' },
    ]);
  }
  // "quanto ho risparmiato?" — entrate vs uscite affiancate, stesso stile a
  // barre orizzontali di buildTopCategoryChart (riuso diretto, non un grafico
  // isolato).
  function buildSavingsChart(d) {
    const max = Math.max(d.inc, d.out, 1);
    const bar = (label, v, color) => `<div class="flex items-center gap-2">
      <span class="w-14 text-[var(--on-surface-secondary)]">${label}</span>
      <div class="flex-1 h-2 rounded-full bg-white/5 overflow-hidden"><div class="h-full rounded-full" style="width:${Math.max(4, (v / max) * 100)}%;background:${color}"></div></div>
      <span class="w-16 text-right font-mono" style="color:${color}">${formatMoney(v)}</span>
    </div>`;
    return `<div class="space-y-1.5 mt-2">${bar('Entrate', d.inc, '#34d399')}${bar('Uscite', d.out, '#fb7185')}</div>`;
  }
  // "quanto posso spendere oggi?" / "quanto mi resta?" — stesso motore dati
  // (getDailySafeToSpend) per ENTRAMBI gli intenti: libero da spendere questa
  // settimana vs già riservato per impegni in arrivo (mai un secondo calcolo
  // isolato: i numeri devono combaciare sempre con la risposta a parole).
  function buildSafeToSpendChart(sts) {
    if (!sts) return '';
    return buildStackedBar([
      { label: 'Libero questa settimana', value: +(sts.safeToday * sts.daysLeftInWeek).toFixed(2), color: '#34d399' },
      { label: 'Impegni in arrivo', value: sts.reservedForCharges, color: '#fbbf24' },
    ]);
  }
  // "come chiudo il mese?" — barra di progresso con marcatore del budget:
  // speso finora (colore pieno) dentro la proiezione di fine mese (colore
  // tenue), col budget come riga verticale se impostato. Onesto: se non c'è
  // budget, il marcatore semplicemente non compare (mai un valore inventato).
  function buildMonthEndChart(proj, monthlyBudget) {
    const budget = monthlyBudget || 0;
    const max = Math.max(proj.projectedTotal, budget, proj.spentSoFar, 1);
    const pctSpent = Math.min(100, (proj.spentSoFar / max) * 100);
    const pctProj = Math.min(100, (proj.projectedTotal / max) * 100);
    const spentColor = proj.willOverspend ? '#fb7185' : '#34d399';
    const projColor = proj.willOverspend ? 'rgba(251,113,133,0.3)' : 'rgba(52,211,153,0.3)';
    const marker = budget > 0 ? `<div class="absolute top-0 bottom-0 w-px bg-white/50" style="left:${Math.min(100, (budget / max) * 100)}%"></div>` : '';
    return `<div class="mt-2">
      <div class="relative h-2.5 rounded-full bg-white/5 overflow-hidden">
        <div class="absolute inset-y-0 left-0 rounded-full" style="width:${pctProj}%;background:${projColor}"></div>
        <div class="absolute inset-y-0 left-0 rounded-full" style="width:${pctSpent}%;background:${spentColor}"></div>
        ${marker}
      </div>
      <div class="flex justify-between mt-1 text-[11px] text-slate-500">
        <span>Speso ${formatMoney(proj.spentSoFar)}</span>
        ${budget > 0 ? `<span>Budget ${formatMoney(budget)}</span>` : ''}
        <span>Proiezione ${formatMoney(proj.projectedTotal)}</span>
      </div>
    </div>`;
  }
  // "quando mi pagano?" — stesso stile a barra impilata: quanto resta
  // disponibile dello stipendio (allowance.pool, già al netto dei fantasmi)
  // vs quanto è ancora da accantonare prima dell'accredito.
  function buildPaydayChart(f) {
    if (!f.allowance) return '';
    return buildStackedBar([
      { label: 'Disponibile', value: f.allowance.pool, color: '#34d399' },
      { label: 'Da accantonare prima dello stipendio', value: f.dueBeforePaydayTotal, color: '#fbbf24' },
    ]);
  }
  // "cosa succede se spendo di più in X?" — impatto misurato % su ogni
  // categoria collegata (dati reali del grafo causale, mai un valore
  // inventato), stesso stile a barre di buildTopCategoryChart: verde se la
  // categoria collegata scende, rosso se sale insieme.
  function buildCausalChart(effects) {
    if (!Array.isArray(effects) || !effects.length) return '';
    const maxAbs = Math.max(...effects.map(e => Math.abs(e.expectedPct)), 1);
    const rows = effects.slice(0, 3).map(e => {
      const cat = getCatById(e.category);
      const up = e.expectedPct > 0;
      const pct = Math.max(6, Math.round((Math.abs(e.expectedPct) / maxAbs) * 100));
      const color = up ? '#fb7185' : '#34d399';
      return `<div class="flex items-center gap-2">
        <span class="w-16 truncate text-[var(--on-surface-secondary)]">${cat.name}</span>
        <div class="flex-1 h-2 rounded-full bg-white/5 overflow-hidden"><div class="h-full rounded-full" style="width:${pct}%;background:${color}"></div></div>
        <span class="w-14 text-right font-mono" style="color:${color}">${up ? '+' : ''}${e.expectedPct}%</span>
      </div>`;
    }).join('');
    return `<div class="space-y-1.5 mt-2">${rows}</div>`;
  }
  function buildQaChart(res, ctx) {
    switch (res.intent) {
      case 'top-category': return buildTopCategoryChart(res.data);
      case 'causal': return buildCausalChart(res.data);
      case 'net-worth': return buildNetWorthChart(res.data);
      case 'savings': return buildSavingsChart(res.data);
      case 'safe-to-spend':
      case 'budget-left': return buildSafeToSpendChart(res.data);
      case 'month-end': return buildMonthEndChart(res.data, ctx?.monthlyBudget);
      case 'payday': return buildPaydayChart(res.data);
      default:
        // I moduli di mercato (src/alpha/) producono il proprio SVG come
        // funzione PURA, accanto ai dati che lo generano: sono testabili senza
        // DOM, cosa che i costruttori qui sopra non sono. Invece di duplicare
        // un secondo motore di grafici, questo ramo li fa passare. La regola:
        // chi calcola il numero disegna anche il grafico, cosi' testo e figura
        // non possono raccontare due cose diverse.
        return [res.grafico, res.grafico2].filter(Boolean)
          .map((g) => `<div class="qa-grafico mt-2.5">${g}</div>`).join('');
    }
  }
  function styleQaAnswer(res) {
    const warn = res?.data?.isOverBudget === true || res?.data?.willOverspend === true || res?.data?.onTrack === false || (typeof res?.data?.net === 'number' && res.data.net < 0);
    const good = res?.data?.onTrack === true || (typeof res?.data?.net === 'number' && res.data.net >= 0);
    const tone = warn
      ? { cls: 'bg-amber-950/20 border border-amber-500/25 text-amber-200', label: 'text-amber-400', strong: 'text-amber-300' }
      : good
        ? { cls: 'bg-emerald-950/20 border border-emerald-500/20 text-emerald-200', label: 'text-emerald-400', strong: 'text-emerald-300' }
        : { cls: 'bg-sky-950/15 border border-sky-500/20 text-sky-100', label: 'text-sky-400', strong: 'text-sky-300' };
    const chart = buildQaChart(res, { monthlyBudget: VaultDAO.state.monthlyBudget });
    // Trasparenza (stessa regola già applicata alla risposta cloud, mai una
    // risposta che sembra "magica"): quando l'intento è scattato grazie a
    // ciò che l'utente stesso ha insegnato (qa-engine.js, `learned:true`),
    // lo si dichiara in chiaro invece di nasconderlo dentro una risposta
    // indistinguibile da una normale.
    const learnedBadge = res.learned
      ? ` <span class="qa-learned-badge text-[9px] font-normal normal-case tracking-normal inline-flex items-center gap-0.5" style="color:var(--primary)"><span class="qa-arrive-icon qa-icon-glow">${ICON_QA_LEARNED}</span> imparato da te</span>`
      : '';
    qaAnswer.className = 'text-xs mt-3 p-3 rounded-xl ' + tone.cls;
    qaAnswer.innerHTML = `
      <h4 class="text-[10px] font-bold ${tone.label} uppercase tracking-widest flex items-center gap-1 mb-2"><span class="qa-arrive-icon qa-icon-glow">${ICON_QA_MOMENTUM}</span> Momentum${learnedBadge}</h4>
      <div class="space-y-1.5">${formatCloudAnswer(res.answer, tone.strong)}</div>${chart}`;
    replayQaAnimation();
  }
  // Momento focale vero, non un'iconcina persa nel testo: l'utente ha
  // chiesto esplicitamente "dimensioni completamente diverse" dal primo
  // tentativo (18px, inline) — l'orb ora è il centro visivo dell'attesa,
  // stessa identità del grande orb 3D del Dashboard.
  // "Momo" — nome dato all'orb su richiesta esplicita: un'identità coerente
  // e riconoscibile aiuta la memorabilità (stessa ragione per cui Duo di
  // Duolingo funziona) MOLTO più di altra animazione. Momo è solo il
  // personaggio che accompagna l'attesa: non cambia né sostituisce la
  // dicitura onesta "non è Momentum" quando la risposta arriva da un
  // provider esterno — sono due cose distinte (chi accompagna vs chi risponde).
  function showQaThinking(localAnswer) {
    qaAnswer.className = 'text-xs mt-3 p-3 rounded-xl bg-violet-950/20 border border-violet-500/25 text-violet-200';
    qaAnswer.innerHTML = `
      <p class="text-[var(--on-surface-secondary)] mb-2.5">${localAnswer}</p>
      <div class="flex items-center gap-3">
        <span class="qa-wait-orb"><span class="qa-spark"></span><span class="qa-spark"></span><span class="qa-spark"></span><span class="qa-pulse"></span><span class="qa-pulse"></span><span class="qa-pulse"></span></span>
        <div>
          <p class="text-violet-100 font-bold text-[13px]">Momo sta cercando la risposta</p>
          <p class="text-violet-400 text-[10px] mt-0.5">Fuori da Momentum, per te<span class="qa-thinking-dots">${'<span></span>'.repeat(3)}</span></p>
        </div>
      </div>`;
    replayQaAnimation();
  }
  // AUTO-APPRENDIMENTO DEL QA (src/ai/qa-learning.js) — quando una domanda
  // non viene riconosciuta (motore locale O provider esterno, "anche quando
  // le risposte sono delegate a terzi": vale su ENTRAMBI i percorsi), si
  // registra la formulazione (mai il contenuto della risposta, stesso
  // perimetro già stabilito per cloudFallbackLog) e si propongono i temi più
  // comuni: se l'utente ne tocca uno, quella è una CONFERMA ESPLICITA — mai
  // un'inferenza silenziosa — che rinforza l'apprendimento. Solo alla
  // seconda conferma su formulazioni simili il QA la riconosce da solo la
  // volta successiva (qa-learning.js, CONFERME_PER_AUTOAPPLICARE=2): mai
  // un'azione automatica da un caso isolato.
  const QA_LEARN_TOPICS = [
    { intent: 'spent', label: 'Quanto ho speso' },
    { intent: 'savings', label: 'Quanto ho risparmiato' },
    { intent: 'subscriptions', label: 'I miei abbonamenti' },
    { intent: 'budgetLeft', label: 'Quanto mi resta' },
    { intent: 'netWorth', label: 'Il mio patrimonio' },
    { intent: 'bnplOwed', label: 'Le mie rate' },
  ];
  function recordQaUnknown(question) {
    VaultDAO.state.qaLearning = recordUnknownQuestion(VaultDAO.state.qaLearning, question);
    VaultDAO.save();
  }
  // Icona-bersaglio (stessa famiglia line-art, 2px stroke): "questo era ciò
  // che intendevo" — un cerchio con centro, non un punto interrogativo (che
  // suonerebbe come un altro "non lo so", il contrario del messaggio).
  const ICON_QA_TEACH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="w-2.5 h-2.5 inline-block"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/></svg>`;
  function renderQaLearnPrompt(question) {
    const chips = QA_LEARN_TOPICS.map(({ intent, label }) =>
      `<button class="qa-learn-chip text-[9px] px-2 py-1 rounded-lg border inline-flex items-center gap-1 text-[var(--on-surface-secondary)]" data-learn-intent="${intent}" data-learn-question="${escapeHtml(question)}"><span style="color:var(--primary)">${ICON_QA_TEACH}</span>${escapeHtml(label)}</button>`,
    ).join('');
    const box = document.createElement('div');
    box.className = 'mt-2 pt-2 border-t border-white/5';
    box.innerHTML = `<p class="text-[10px] text-[var(--on-surface-secondary)] mb-1.5 flex items-center gap-1"><span style="color:var(--primary)">${ICON_QA_TEACH}</span> Aiutami a capire — intendevi una di queste?</p><div class="flex flex-wrap gap-1.5">${chips}</div>`;
    qaAnswer.appendChild(box);
    box.querySelectorAll('[data-learn-intent]').forEach((btn) => btn.addEventListener('click', () => {
      const q = btn.dataset.learnQuestion, intent = btn.dataset.learnIntent;
      VaultDAO.state.qaLearning = learnCorrection(VaultDAO.state.qaLearning, q, intent);
      VaultDAO.save();
      haptic('light');
      const res = askMomentum(q);
      styleQaAnswer(res);
      if (res.intent === 'unknown') { recordQaUnknown(q); renderQaLearnPrompt(q); }
    }));
  }
  // Le chat generiche (Gemini ecc.) rispondono in Markdown leggero
  // (**grassetto**, a capo) — verificato dal vivo: senza questo passaggio
  // l'utente vedeva gli asterischi letterali in chat E un unico paragrafo
  // denso, contro l'obiettivo "design pulito, un'idea per blocco,
  // comprensibile a un bambino". SYSTEM_PROMPT chiede blocchi separati da
  // riga vuota; se un provider non rispetta il formato, fallback: spezza da
  // sola su frasi lunghe (nessun blocco > ~140 caratteri resta un blob unico).
  // Escape PRIMA di tutto: il testo arriva da un provider esterno, mai
  // fidarsi ciecamente in innerHTML.
  function formatCloudAnswer(text, strongClass = 'text-violet-300') {
    const esc = String(text).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    let blocks = esc.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
    if (blocks.length <= 1) {
      blocks = esc.split(/\n+/).flatMap(line => line.length > 140 ? line.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý])/) : [line]).map(s => s.trim()).filter(Boolean);
    }
    return blocks.map(b => `<div class="qa-cloud-block">${b.replace(/\*\*(.+?)\*\*/g, `<strong class="${strongClass}">$1</strong>`)}</div>`).join('');
  }
  // Stessa grammatica visiva delle card insight del radar (eyebrow colorata
  // in maiuscolo + corpo con evidenze colorate): l'etichetta "non è
  // Momentum" va SUBITO in testa, non in coda come nota a piè di pagina —
  // l'utente deve saperlo PRIMA di leggere, non dopo.
  // Il "pop" dell'icona (qa-arrive-icon) è il momento-premio DOPO l'attesa
  // reale del cloud — principio Duo: la celebrazione arriva a fine compito,
  // mai a interrompere. Le risposte locali (styleQaAnswer) sono istantanee,
  // senza attesa vera: niente pop lì, sarebbe fronzolo senza motivo (Clippy).
  // BUG REALE segnalato dall'utente: la risposta cloud mostrava sempre
  // "Gemini" a prescindere dal provider che aveva davvero risposto — questa
  // mappa non era mai stata aggiornata con i 7 provider aggiunti stasera
  // (xai/mistral/openrouter/cerebras/qwen/moonshot/glm), quindi per quelli
  // sarebbe comunque comparso l'id grezzo, non "Gemini" — la causa reale di
  // "sempre Gemini" è quasi certamente la cache del service worker (vedi
  // sw.js) che serviva ancora il bundle precedente ai fix di stasera.
  function showQaCloudAnswer(answer, provider) {
    const label = {
      gemini: 'Gemini', groq: 'Groq', deepseek: 'DeepSeek', mistral: 'Mistral',
      openrouter: 'OpenRouter', cerebras: 'Cerebras', qwen: 'Qwen',
      moonshot: 'Moonshot AI', glm: 'GLM (Zhipu)', xai: 'xAI',
      openai: 'OpenAI', anthropic: 'Anthropic',
    }[provider] || provider;
    qaAnswer.className = 'text-xs mt-3 p-3 rounded-xl bg-violet-950/20 border border-violet-500/25 text-violet-100';
    qaAnswer.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <h4 class="text-[10px] font-bold text-violet-400 uppercase tracking-widest flex items-center gap-1"><span class="qa-arrive-icon qa-icon-glow">${ICON_QA_CLOUD}</span> ${label}</h4>
        <span class="text-[11px] text-violet-400/70">non è Momentum</span>
      </div>
      <div class="space-y-1.5">${formatCloudAnswer(answer)}</div>`;
    replayQaAnimation();
  }
  // Messaggio semplice, mai il testo tecnico grezzo dell'errore (l'utente
  // ha segnalato: "API key not valid" non lo capisce chi non sa cosa sia
  // una chiave — dettaglio tecnico spostato SOLO nel title, a chi lo cerca).
  // BUG REALE segnalato dall'utente: "dammi le notizie di Nvidia" cadeva
  // sulla chat generica, che senza dati veri risponde con frasi educative
  // generiche ("Nvidia continua a essere al centro dell'attenzione...") —
  // inutile per chi vuole informarsi davvero, costringendo a uscire
  // dall'app. Ora usa la pipeline REALE già costruita per "Cerca un asset"
  // (CoinGecko/Alpha Vantage NEWS_SENTIMENT) invece della chat generica.
  // ── APPRENDIMENTO ONESTO DALLE DOMANDE (richiesta esplicita dell'utente:
  // ogni domanda/risposta anche via AI esterna deve servire a rendere
  // Momentum più intelligente) ─────────────────────────────────────────────
  // Cosa NON fa, con onestà: le risposte generiche di Gemini/Groq su ETF,
  // notizie ecc. non hanno NESSUN segnale utile per la rete neurale
  // finanziaria (predice categorie/comportamento dalle TUE transazioni, un
  // testo educativo esterno non c'entra) — inserirle lì sarebbe decorativo,
  // lo stesso errore che il progetto ha già rifiutato una volta (SLLMv2).
  // Cosa fa DAVVERO, onestamente: registra QUALI domande sono uscite dal
  // riconoscimento locale (qa-engine.js) verso l'esterno — è il segnale
  // reale per capire dove ampliare i pattern locali nel tempo (mai il
  // contenuto della risposta, mai dati finanziari, solo la domanda scritta
  // dall'utente, che è già uscita una volta verso il provider scelto).
  function logCloudFallbackQuestion(question) {
    const log = VaultDAO.state.mlData.cloudFallbackLog || [];
    log.push({ q: String(question).slice(0, 200), ts: Date.now() });
    VaultDAO.state.mlData.cloudFallbackLog = log.slice(-50);
    VaultDAO.save();
  }
  window.getCloudFallbackLog = () => VaultDAO.state.mlData.cloudFallbackLog || [];
  // Grafico storico multi-anno VERO (richiesta esplicita: "il grafico deve
  // esserci sempre", non solo il numero a parole). Riusa catmullRomPath
  // (curva morbida) già esistente in main.js, stessa identità visiva della
  // Cassa Unica — non un grafico isolato con uno stile a parte. I marcatori
  // sono il massimo/minimo REALI per anno solare (yearlyExtremes) — MAI un
  // "motivo" narrativo: non abbiamo un archivio di notizie storiche, quindi
  // non fingiamo di sapere perché un picco di anni fa sia avvenuto.
  // RIDISEGNATO (feedback esplicito dell'utente: "il grafico è troppo
  // difficile da comprendere in quel modo" — la vecchia versione elencava
  // OGNI anno in testo, es. 46 righe per Apple dal 1980: illeggibile,
  // contro il principio "comprensibile a un bambino di 8 anni"). Ora: solo
  // 2 marcatori sul grafico (massimo/minimo storico ASSOLUTI, non uno per
  // anno), grafico più grande, e un riepilogo "a colpo d'occhio" con 3
  // numeri chiave invece di una lista — miglior/peggior anno restano MA
  // come UNA riga sola, non 46.
  function buildAssetHistoryChart(series, extremes) {
    if (!series.length) return '';
    const W = 320, H = 130, PAD = 6;
    const prices = series.map(p => p.price);
    const minP = Math.min(...prices), maxP = Math.max(...prices);
    const span = maxP - minP || 1;
    const x = (i) => PAD + (i / (series.length - 1)) * (W - PAD * 2);
    const y = (p) => H - PAD - ((p - minP) / span) * (H - PAD * 2);
    const points = series.map((p, i) => ({ x: x(i), y: y(p.price) }));
    const path = catmullRomPath(points);
    // Solo i due estremi ASSOLUTI di tutta la serie (mai uno per anno): un
    // grafico con 46 pallini è rumore, non informazione.
    let hiIdx = 0, loIdx = 0;
    series.forEach((p, i) => { if (p.price > series[hiIdx].price) hiIdx = i; if (p.price < series[loIdx].price) loIdx = i; });
    const hi = series[hiIdx], lo = series[loIdx];
    const markersHtml = `
      <circle cx="${x(hiIdx).toFixed(1)}" cy="${y(hi.price).toFixed(1)}" r="3" fill="#34d399"/>
      <circle cx="${x(loIdx).toFixed(1)}" cy="${y(lo.price).toFixed(1)}" r="3" fill="#fb7185"/>`;
    const last = series[series.length - 1];
    const fromPeakPct = hi.price > 0 ? ((last.price - hi.price) / hi.price) * 100 : null;
    // Miglior/peggior anno: UNA riga sola (non una per anno) — sceglie i
    // due estremi reali già calcolati da yearlyExtremes, mai un'invenzione.
    const withPct = extremes.filter(e => Number.isFinite(e.changePct));
    const best = withPct.length ? withPct.reduce((a, b) => b.changePct > a.changePct ? b : a) : null;
    const worst = withPct.length ? withPct.reduce((a, b) => b.changePct < a.changePct ? b : a) : null;
    const stat = (label, value, color) => `<div class="flex-1 min-w-0"><div class="text-[10px] text-slate-500 uppercase tracking-wide truncate">${label}</div><div class="text-[11px] font-bold truncate" style="color:${color}">${value}</div></div>`;
    const stats = `<div class="flex gap-3 mt-2">
      ${stat('Massimo storico', `${hi.price.toFixed(0)} (${hi.date.slice(0, 4)})`, '#34d399')}
      ${stat('Minimo storico', `${lo.price.toFixed(0)} (${lo.date.slice(0, 4)})`, '#fb7185')}
      ${fromPeakPct !== null ? stat('Oggi vs massimo', `${fromPeakPct >= 0 ? '+' : ''}${fromPeakPct.toFixed(0)}%`, fromPeakPct >= 0 ? '#34d399' : '#fbbf24') : ''}
    </div>`;
    const yearNote = (best && worst && best.year !== worst.year)
      ? `<p class="text-[11px] text-slate-500 mt-1.5">Miglior anno: ${best.year} (${best.changePct >= 0 ? '+' : ''}${best.changePct.toFixed(0)}%) · Peggior anno: ${worst.year} (${worst.changePct >= 0 ? '+' : ''}${worst.changePct.toFixed(0)}%)</p>`
      : '';
    // Hover/tocca il grafico per capire un punto esatto (richiesto
    // esplicitamente: "deve essere possibile navigarci sopra per capire e
    // confrontare periodi") — serie compatta incorporata nell'attributo
    // data-series (date+price VERI, mai un valore interpolato o inventato),
    // letta dal listener delegato in initApp per mostrare data/prezzo esatti
    // sotto il grafico e spostare un punto+linea guida sull'SVG.
    const seriesData = encodeURIComponent(JSON.stringify(series.map(p => [p.date, Math.round(p.price * 100) / 100])));
    return `
      <div class="qa-cloud-block mt-1.5">
        <div class="qa-hist-wrap" style="position:relative">
          <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="qa-hist-svg w-full h-24" style="touch-action:none;cursor:crosshair" data-series="${seriesData}" data-w="${W}" data-h="${H}" data-pad="${PAD}">
            <path d="${path} L${x(series.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z" fill="url(#qaHistGrad)" opacity="0.25"/>
            <path d="${path}" fill="none" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round"/>
            ${markersHtml}
            <line class="qa-hist-guide" x1="0" y1="0" x2="0" y2="${H}" stroke="#94a3b8" stroke-width="1" opacity="0"/>
            <circle class="qa-hist-dot" r="3.5" fill="#fbbf24" stroke="#0b0f1a" stroke-width="1" opacity="0"/>
            <defs><linearGradient id="qaHistGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#38bdf8" stop-opacity="0"/></linearGradient></defs>
          </svg>
          <div class="flex justify-between text-[10px] text-slate-600 font-mono uppercase tracking-wide px-0.5 mt-0.5">
            <span>${series[0].date}</span>
            <span>${series[series.length - 1].date}</span>
          </div>
          <p class="qa-hist-hover-label text-[11px] text-sky-200 text-center mt-1 font-mono font-semibold tracking-wide">${last.date} · ${last.price.toFixed(2)} <span class="text-slate-500 font-normal">— tocca per esplorare</span></p>
        </div>
        ${stats}
        ${yearNote}
        <p class="text-[11px] text-slate-500 mt-1.5">Verde/rosso = massimo/minimo storico reale misurato. Ultimo anno: è il massimo storico che l'API pubblica e gratuita permette. Non sappiamo (e non inventiamo) il motivo di un picco passato: nessun archivio di notizie storiche.</p>
      </div>`;
  }
  // Selettore di periodo (richiesta esplicita: "possibilità di scegliere i
  // momenti salienti" — 1 anno / 5 anni / tutto lo storico, invece di
  // vedere sempre l'intera serie insieme). I 3 pannelli sono precalcolati
  // qui (mai un secondo fetch al click: la serie è già scaricata) e
  // scambiati mostra/nascondi da un listener delegato su qaAnswer, così
  // funziona anche dopo che il contenuto viene ri-renderizzato.
  function buildAssetHistoryChartWithPeriods(series, yearlyExtremesFn) {
    if (!series.length) return '';
    const variants = [
      { key: 'all', label: 'Tutto' },
      { key: '5y', label: '5 anni', months: 60 },
      { key: '1y', label: '1 anno', months: 12 },
    ];
    const buttons = variants.map(v => `<button type="button" class="qa-period-btn text-[11px] px-2 py-0.5 rounded-full ${v.key === 'all' ? 'qa-period-active' : ''}" data-key="${v.key}">${v.label}</button>`).join('');
    const panels = variants.map(v => {
      const sliced = v.months ? series.slice(-v.months) : series;
      const chart = sliced.length > 1 ? buildAssetHistoryChart(sliced, yearlyExtremesFn(sliced)) : '<p class="text-[11px] text-slate-500 mt-1.5">Storico insufficiente per questo periodo.</p>';
      return `<div class="qa-period-panel" data-key="${v.key}" ${v.key === 'all' ? '' : 'style="display:none"'}>${chart}</div>`;
    }).join('');
    return `<div class="flex gap-1.5 mt-1.5">${buttons}</div>${panels}`;
  }
  // Listener delegato UNA SOLA VOLTA (qaAnswer resta lo stesso nodo anche
  // quando il contenuto viene sostituito da innerHTML) — mai un secondo
  // listener duplicato ad ogni domanda.
  // Delegato su document (non solo qaAnswer): il grafico con selettore
  // periodo ora appare anche in "Cerca un asset" (Analisi Tensor), stesso
  // markup, un solo listener invece di uno per ogni contenitore.
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.qa-period-btn');
    if (!btn) return;
    const key = btn.dataset.key;
    const group = btn.closest('div').parentElement;
    group.querySelectorAll('.qa-period-btn').forEach(b => b.classList.toggle('qa-period-active', b === btn));
    group.querySelectorAll('.qa-period-panel').forEach(p => { p.style.display = p.dataset.key === key ? '' : 'none'; });
  });
  // Navigazione sul grafico storico (richiesto esplicitamente: "deve essere
  // possibile navigarci sopra per capire") — pointermove copre sia mouse che
  // touch con un solo listener delegato, mai un secondo gestore separato per
  // il tocco su mobile. Trova il punto REALE più vicino al dito/cursore
  // (mai un valore interpolato) e lo mostra come testo + pallino + linea
  // guida sull'SVG.
  function updateHistHover(svg, clientX) {
    const series = svg.__qaSeries || (svg.__qaSeries = JSON.parse(decodeURIComponent(svg.dataset.series)));
    if (!series.length) return;
    const W = Number(svg.dataset.w), H = Number(svg.dataset.h), PAD = Number(svg.dataset.pad);
    const rect = svg.getBoundingClientRect();
    const scaleX = W / rect.width;
    const localX = (clientX - rect.left) * scaleX;
    const t = Math.max(0, Math.min(1, (localX - PAD) / (W - PAD * 2)));
    const idx = Math.round(t * (series.length - 1));
    const [date, price] = series[idx];
    const prices = series.map(p => p[1]);
    const minP = Math.min(...prices), maxP = Math.max(...prices);
    const span = maxP - minP || 1;
    const px = PAD + (idx / (series.length - 1)) * (W - PAD * 2);
    const py = H - PAD - ((price - minP) / span) * (H - PAD * 2);
    const guide = svg.querySelector('.qa-hist-guide');
    const dot = svg.querySelector('.qa-hist-dot');
    guide.setAttribute('x1', px.toFixed(1)); guide.setAttribute('x2', px.toFixed(1)); guide.setAttribute('opacity', '0.5');
    dot.setAttribute('cx', px.toFixed(1)); dot.setAttribute('cy', py.toFixed(1)); dot.setAttribute('opacity', '1');
    const label = svg.closest('.qa-hist-wrap')?.querySelector('.qa-hist-hover-label');
    if (label) label.textContent = `${date} · ${price.toFixed(2)}`;
  }
  document.addEventListener('pointermove', (e) => {
    const svg = e.target.closest('.qa-hist-svg');
    if (!svg) return;
    if (e.pointerType === 'touch') e.preventDefault();
    updateHistHover(svg, e.clientX);
  }, { passive: false });
  document.addEventListener('pointerleave', (e) => {
    const svg = e.target.closest?.('.qa-hist-svg');
    if (!svg) return;
    svg.querySelector('.qa-hist-guide')?.setAttribute('opacity', '0');
    svg.querySelector('.qa-hist-dot')?.setAttribute('opacity', '0');
  }, true);
  // Card notizie CONDIVISA (richiesto esplicitamente: unificare invece di
  // duplicare) — usata sia da "Chiedi a Momentum" sia da "Cerca un asset"
  // (Analisi Tensor), stessa identità visiva ovunque. Riassunto reale (mai
  // generato da Momentum), escape prima di tutto: il testo arriva da fonti
  // esterne, mai fidarsi ciecamente in innerHTML.
  function buildNewsItemsHtml(items) {
    const labelColor = { bullish: 'text-emerald-300', 'somewhat-bullish': 'text-emerald-200', neutral: 'text-[var(--on-surface-secondary)]', 'somewhat-bearish': 'text-amber-300', bearish: 'text-rose-300', sconosciuto: 'text-slate-500' };
    const escNews = (s) => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    const newsHeader = items.length ? `<h5 class="text-[11px] font-bold text-sky-400/80 uppercase tracking-widest mt-2 mb-1">Notizie</h5>` : '';
    const itemsHtml = items.map(n => `
      <a href="${n.url}" target="_blank" rel="noopener" class="block rounded-lg px-2.5 py-2 mb-1.5 hover:bg-white/5 transition-colors" style="background:rgba(255,255,255,0.03)">
        <div class="flex items-start gap-1.5">
          <span class="${labelColor[n.sentimentLabel] || 'text-[var(--on-surface-secondary)]'} mt-0.5 shrink-0">●</span>
          <div class="min-w-0">
            <div class="font-semibold leading-snug">${escNews(n.title)}</div>
            <div class="text-slate-500 text-[11px] mt-0.5">${escNews(n.source || '')}</div>
            ${n.summary ? `<div class="text-[var(--on-surface-secondary)] text-[10px] mt-1 leading-snug">${escNews(n.summary)}</div>` : ''}
          </div>
        </div>
      </a>`
    ).join('');
    return newsHeader + itemsHtml;
  }
  // BUG DI CHIAREZZA segnalato dal vivo dall'utente: per un'azione senza
  // nessuna chiave prezzi configurata, la card mostrava SOLO le notizie —
  // niente prezzo, niente grafico, in silenzio. Un utente (esperto o alle
  // prime armi) non può distinguere "non esiste un prezzo live gratuito per
  // le azioni" (vero, verificato — a differenza delle cripto via CoinGecko,
  // nessuna fonte azionaria è keyless) da "l'app non funziona". Qui si dice
  // il motivo vero e si apre la strada più corta per risolverlo.
  // Icona-chiave (line-art, stessa famiglia stroke-2 delle altre icone QA):
  // rassicurante, mai un'icona di lucchetto/blocco che suonerebbe come un
  // divieto — qui è un invito, non una restrizione.
  const ICON_QA_KEY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 inline-block"><circle cx="8" cy="15" r="4"/><path d="M10.5 12.5 19 4M15 8l2 2M18 5l2 2"/></svg>`;
  function buildStockKeyCta(asset) {
    return `<div class="qa-learned-badge mt-2.5 p-2.5 rounded-xl border border-sky-500/20 bg-sky-500/[0.04] flex items-center gap-2.5">
      <span class="shrink-0 w-7 h-7 rounded-full bg-sky-500/10 text-sky-300 flex items-center justify-center">${ICON_QA_KEY}</span>
      <div class="flex-1 min-w-0">
        <p class="text-[10px] text-sky-200/80 leading-snug">Il prezzo di ${escapeHtml(asset.name || asset.symbol)} serve una chiave gratuita — nessuna carta, circa un minuto.</p>
      </div>
      <button id="qa-add-stock-key" class="shrink-0 text-[10px] font-bold text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 px-2.5 py-1.5 rounded-lg transition-colors">Aggiungila →</button>
    </div>`;
  }
  function showQaNewsAnswer(asset, items, stale, yoyNote, historyChart, multiYearNote, groundedNewsNote, trackRecordHtml = '') {
    qaAnswer.className = 'text-xs mt-3 p-3 rounded-xl bg-sky-950/15 border border-sky-500/20 text-sky-100';
    const newsBlockHtml = buildNewsItemsHtml(items);
    // Dato storico REALE (CoinGecko, mai una previsione) — risponde a
    // "cosa è successo nello stesso periodo l'anno scorso" per le cripto.
    const yoyHtml = yoyNote ? `<p class="qa-cloud-block text-sky-200/90">${yoyNote}</p>` : '';
    // Punti reali a 2/3/5 anni — non una linea continua (l'API gratuita non
    // lo permette oltre 365gg), ma prezzi veri in quelle date esatte.
    const multiYearHtml = multiYearNote ? `<p class="qa-cloud-block text-sky-200/70 text-[10px]">${multiYearNote}</p>` : '';
    // Fallback quando Alpha Vantage non dà notizie (chiave assente/esaurita
    // — feedback esplicito dell'utente: "la parte delle notizie non dice
    // niente"): Gemini con grounding Google Search cerca sul web reale cosa
    // sta facendo l'azienda (prodotti, innovazioni, rumor) — MAI spacciato
    // per un dato di Momentum, etichetta separata e onesta come ogni altra
    // risposta cloud di questa sessione.
    const groundedHtml = groundedNewsNote ? `
      <div class="mt-2 pt-2 border-t border-sky-500/10">
        <div class="flex items-center justify-between mb-1">
          <h5 class="text-[11px] font-bold text-violet-400 uppercase tracking-widest flex items-center gap-1">${ICON_QA_CLOUD} Gemini · ricerca web</h5>
          <span class="text-[11px] text-violet-400/70">non è Momentum</span>
        </div>
        ${formatCloudAnswer(groundedNewsNote, 'text-violet-300')}
      </div>` : '';
    const nessunaChiavePrezzi = !(VaultDAO.state.liveDataKeys?.alphavantage || VaultDAO.state.liveDataKeys?.twelvedata || VaultDAO.state.liveDataKeys?.fmp);
    const stockKeyCta = asset.kind === 'stock' && nessunaChiavePrezzi && !historyChart ? buildStockKeyCta(asset) : '';
    qaAnswer.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <h4 class="text-[10px] font-bold text-sky-400 uppercase tracking-widest flex items-center gap-1"><span class="qa-arrive-icon qa-icon-glow">${ICON_QA_MOMENTUM}</span> ${asset.symbol} · dati reali</h4>
        <span class="text-[11px] text-sky-400/70">${stale ? 'ultime salvate' : 'CoinGecko/Alpha Vantage'}</span>
      </div>
      <div class="space-y-1.5">${yoyHtml}${multiYearHtml}</div>${newsBlockHtml}${historyChart || ''}${trackRecordHtml || ''}${groundedHtml}${stockKeyCta}`;
    document.getElementById('qa-add-stock-key')?.addEventListener('click', () => {
      document.querySelector('[data-view="settings"]')?.click(); // Momentum Vault
      setTimeout(() => window.openApiKeyGuide?.('alphavantage'), 250);
    });
    replayQaAnimation();
  }
  // Ritorna true se ha risposto con dati reali (fine flusso), false se deve
  // proseguire col percorso normale (Momentum locale → chat generica). Mai
  // un dato inventato: se la ricerca/le fonti non rispondono, ripiega
  // onestamente sul flusso esistente. Le notizie (Alpha Vantage) richiedono
  // una chiave personale; il confronto storico cripto (CoinGecko) no —
  // funziona anche senza alcuna chiave configurata.
  // ── PIPELINE CONDIVISA notizie+storico asset ────────────────────────────
  // ARCHITETTURA (richiesto esplicitamente: unificare invece di duplicare):
  // prima "Cerca un asset" (Analisi Tensor) aveva una propria implementazione
  // SEPARATA e meno capace (solo Alpha Vantage, nessuna cascata, nessun
  // grafico con selettore periodo) rispetto a "Chiedi a Momentum" — stessa
  // domanda ("dammi le notizie di Apple" vs cercare "Apple" in Analisi
  // Tensor) dava risultati diversi. Ora UNA SOLA pipeline, usata da
  // entrambi i punti: mai due motori isolati per la stessa cosa.
  async function fetchAssetNewsCascade(asset) {
    const apiKey = VaultDAO.state.liveDataKeys?.alphavantage;
    let items = [], stale = false;
    if (apiKey) {
      try {
        const { fetchNewsSentiment } = await import('./alpha/news.js');
        const r = await fetchNewsSentiment(asset.symbol, { apiKey, cache: assetSearchCache, limit: 4, fetchImpl: fetch.bind(window) });
        items = r.items || []; stale = r.stale;
      } catch (_) { /* onesto: niente notizie, il resto continua comunque */ }
    }
    // Piano B: Finnhub (CORS verificato dal vivo, endpoint dedicato alle
    // notizie aziendali, piano gratuito molto più generoso di Alpha Vantage).
    const finnhubKey = VaultDAO.state.liveDataKeys?.finnhub;
    if (!items.length && finnhubKey) {
      try {
        const { fetchFinnhubNews } = await import('./alpha/news.js');
        const r = await fetchFinnhubNews(asset.symbol, { apiKey: finnhubKey, cache: assetSearchCache, limit: 4, fetchImpl: fetch.bind(window) });
        items = r.items || []; stale = r.stale;
      } catch (_) { /* onesto: niente notizie, il resto continua comunque */ }
    }
    // Piano B a chiave (NewsAPI.org, generalista — utile quando le fonti
    // finanziarie non hanno nulla su un'azienda meno coperta).
    const newsApiKey = VaultDAO.state.liveDataKeys?.newsapi;
    if (!items.length && newsApiKey) {
      try {
        const { fetchNewsApiOrg } = await import('./alpha/news.js');
        const r = await fetchNewsApiOrg(asset.name || asset.symbol, { apiKey: newsApiKey, cache: assetSearchCache, limit: 4, fetchImpl: fetch.bind(window) });
        items = r.items || []; stale = r.stale;
      } catch (_) { /* onesto: niente notizie, il resto continua comunque */ }
    }
    // Piano B SENZA ALCUNA CHIAVE (Hacker News) — funziona sempre, anche
    // per chi non ha configurato nulla. Discussioni tech reali, non un
    // sentiment (dichiarato onestamente "sconosciuto").
    if (!items.length) {
      try {
        const { fetchHackerNewsMentions } = await import('./alpha/news.js');
        const r = await fetchHackerNewsMentions(asset.name || asset.symbol, { cache: assetSearchCache, limit: 4, fetchImpl: fetch.bind(window) });
        items = r.items || []; stale = r.stale;
      } catch (_) { /* onesto: niente notizie, il resto continua comunque */ }
    }
    // Ultimo fallback (grounding Gemini): se non ci sono notizie reali E
    // l'utente ha configurato Gemini, usa il grounding Google Search per
    // cercare davvero cosa sta facendo l'azienda — mai al posto dei dati
    // numerici, solo per il testo, ed etichettato come "non è Momentum".
    let groundedNewsNote = null;
    if (!items.length) {
      const geminiKey = VaultDAO.state.liveDataKeys?.gemini;
      if (geminiKey) {
        try {
          const { askCloudFallback } = await import('./ai/chat-fallback.js');
          const label = asset.name || asset.symbol;
          const { answer } = await askCloudFallback(
            `Notizie reali e recenti su ${label} (${asset.symbol}): cosa stanno facendo ultimamente, innovazioni, prodotti o pubblicazioni recenti, eventuali rumor. Fatti concreti e attuali, non descrizioni generiche dell'azienda.`,
            { apiKey: geminiKey, provider: 'gemini', grounding: true, fetchImpl: fetch.bind(window) }
          );
          groundedNewsNote = answer;
        } catch (_) { /* onesto: niente notizie via grounding, il resto continua comunque */ }
      }
    }
    return { items, stale, groundedNewsNote };
  }
  // Esposte su window: window.selectAsset (Analisi Tensor → "Cerca un
  // asset") vive fuori dalla closure di initApp e non potrebbe altrimenti
  // vederle — bug reale trovato dal vivo (2026-07-27): la chiamata falliva
  // in silenzio (ReferenceError catturato dal try/catch "opzionale"), zero
  // richieste di rete, nessuna notizia/grafico mostrato.
  window.fetchAssetNewsCascade = fetchAssetNewsCascade;
  window.buildNewsItemsHtml = buildNewsItemsHtml;
  async function fetchAssetHistoryData(asset) {
    const apiKey = VaultDAO.state.liveDataKeys?.alphavantage;
    let yoyNote = null, historyChart = '', multiYearNote = null, trackRecordHtml = '';
    // Sullo STESSO storico reale già scaricato (mai una serie a parte),
    // src/alpha/asset-track-record.js applica il vaglio scientifico
    // (Sharpe deflazionato + Munger): risponde a "questo rendimento è
    // bravura o fortuna?", cosa che nessun grafico da solo dice.
    const buildTrackRecord = async (series) => {
      try {
        if (!series || series.length < 9) return '';
        const { assessTrackRecord } = await import('./alpha/asset-track-record.js');
        const r = assessTrackRecord(series, { label: asset.name || asset.symbol });
        if (!r.disponibile) return '';
        const tono = r.verdetto === 'solido' ? 'text-emerald-300' : r.verdetto === 'probabile-fortuna' ? 'text-amber-300' : 'text-[var(--on-surface-secondary)]';
        const conc = r.concentrazione ? `<p class="text-[10px] text-[var(--on-surface-secondary)] mt-0.5">${escapeHtml(r.concentrazione.messaggio)}</p>` : '';
        return `<div class="mt-1.5 p-2 rounded-lg border border-[var(--outline)] bg-[var(--surface-elevated)]">
          <p class="text-[10px] font-bold ${tono}">${escapeHtml(r.messaggio)}</p>${conc}
        </div>`;
      } catch (_) { return ''; }
    };
    if (asset.kind === 'crypto') {
      try {
        const { fetchLiveCryptoPrice } = await import('./alpha/live-price.js');
        const { fetchCryptoPriceYearsAgo, describeYoyChange, yearlyExtremes, fetchCryptoMultiYearComparison, fetchCryptoHistoryCascade } = await import('./alpha/year-over-year.js');
        // A CASCATA e SENZA CHIAVE (richiesto esplicitamente): Binance
        // (nessuna registrazione, storico reale di anni) prima, CoinGecko
        // (limitato a 365gg sul piano gratuito) come piano B se il
        // simbolo non è quotato su Binance.
        const [live, past, { series }, multiYear] = await Promise.all([
          fetchLiveCryptoPrice(asset.id, { fetchImpl: fetch.bind(window) }),
          fetchCryptoPriceYearsAgo(asset.id, { yearsAgo: 1, fetchImpl: fetch.bind(window) }),
          fetchCryptoHistoryCascade(asset.id, asset.symbol, { fetchImpl: fetch.bind(window) }),
          fetchCryptoMultiYearComparison(asset.id, { yearsList: [2, 3, 5], fetchImpl: fetch.bind(window) }),
        ]);
        yoyNote = describeYoyChange(live?.price, past, { yearsAgo: 1 });
        if (series.length > 1) historyChart = buildAssetHistoryChartWithPeriods(series, yearlyExtremes);
        trackRecordHtml = await buildTrackRecord(series);
        // Punti reali a 2/3/5 anni (mai una linea continua fabbricata:
        // CoinGecko gratuito limita la serie a 365gg, ma il singolo punto
        // storico non ha questo limite — dati veri, non un grafico finto).
        if (Number.isFinite(live?.price) && multiYear.length) {
          multiYearNote = multiYear.map(({ yearsAgo, point }) => {
            const pct = ((live.price - point.price) / point.price) * 100;
            return `${yearsAgo} anni fa (${point.date}): ${point.price.toFixed(0)} → oggi ${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`;
          }).join(' · ');
        }
      } catch (_) { /* onesto: niente confronto storico, il resto continua comunque */ }
    } else if (asset.kind === 'stock' && (apiKey || VaultDAO.state.liveDataKeys?.twelvedata || VaultDAO.state.liveDataKeys?.fmp)) {
      // Azioni/ETF: Alpha Vantage TIME_SERIES_MONTHLY o Twelve Data
      // /time_series danno storico reale spesso 20+ anni anche gratis (a
      // differenza del limite di 365gg di CoinGecko per le cripto) — qui
      // la linea continua multi-anno è possibile davvero, non solo punti
      // singoli. Segnalato dall'utente: "non accade solo con Nvidia" —
      // vale per ogni azione/ETF. A CASCATA (richiesta esplicita): mai
      // dipendere da un solo provider, l'utente porta le proprie chiavi.
      try {
        const { fetchStockMonthlySeriesCascade, describeStockYearsAgo } = await import('./alpha/stock-history.js');
        const { series } = await fetchStockMonthlySeriesCascade(asset.symbol, { keys: VaultDAO.state.liveDataKeys || {}, fetchImpl: fetch.bind(window) });
        if (series.length > 1) {
          const { yearlyExtremes } = await import('./alpha/year-over-year.js');
          const current = series[series.length - 1].price;
          yoyNote = describeStockYearsAgo(series, 1, current);
          historyChart = buildAssetHistoryChartWithPeriods(series, yearlyExtremes);
          trackRecordHtml = await buildTrackRecord(series);
          const points = [2, 3, 5].map(y => ({ y, note: describeStockYearsAgo(series, y, current) })).filter(p => p.note);
          if (points.length) multiYearNote = points.map(p => p.note).join(' ');
        }
      } catch (_) { /* onesto: niente confronto storico, il resto continua comunque */ }
    }
    return { yoyNote, historyChart, multiYearNote, trackRecordHtml };
  }
  window.fetchAssetHistoryData = fetchAssetHistoryData;
  async function tryAnswerWithRealNews(assetQuery) {
    try {
      const { searchAsset } = await import('./alpha/asset-search.js');
      const apiKey = VaultDAO.state.liveDataKeys?.alphavantage;
      // BUG REALE trovato dal vivo: la RICERCA usava solo Alpha Vantage anche
      // se Twelve Data/FMP erano configurati (loro erano collegati solo allo
      // storico prezzi) — col limite di 25 richieste/giorno di Alpha Vantage
      // facilissimo da esaurire, la ricerca falliva sempre. Ora passa anche
      // le altre due chiavi: searchAsset prova la stessa cascata già usata
      // per lo storico.
      const { results, stockWarning } = await searchAsset(assetQuery, {
        apiKey,
        twelvedataKey: VaultDAO.state.liveDataKeys?.twelvedata,
        fmpKey: VaultDAO.state.liveDataKeys?.fmp,
        fetchImpl: fetch.bind(window),
        cache: assetSearchCache,
      });
      // BUG REALE trovato dal vivo: con una chiave Alpha Vantage non valida
      // (es. "TEST_DEMO_KEY"), "Apple" ripiegava in silenzio su un token
      // cripto assurdo ("dog-with-apple-in-mouth") spacciato per il
      // risultato migliore. Ora, se la ricerca azionaria ha un errore REALE
      // e l'unico risultato è una cripto poco pertinente, lo diciamo — mai
      // un dato sbagliato spacciato per quello richiesto.
      if (stockWarning) {
        showQaCloudError(`Non trovo un titolo azionario reale per "${assetQuery}".`, stockWarning);
        return true;
      }
      const asset = results?.[0];
      if (!asset) return false;
      const { items, stale, groundedNewsNote } = await fetchAssetNewsCascade(asset);
      const { yoyNote, historyChart, multiYearNote, trackRecordHtml } = await fetchAssetHistoryData(asset);
      if (!items.length && !yoyNote && !historyChart && !groundedNewsNote) return false;
      showQaNewsAnswer(asset, items, stale, yoyNote, historyChart, multiYearNote, groundedNewsNote, trackRecordHtml);
      return true;
    } catch (_) { return false; }
  }
  function showQaCloudError(localAnswer, message) {
    qaAnswer.className = 'text-xs mt-3 p-3 rounded-xl bg-rose-950/20 border border-rose-500/25 text-rose-200';
    qaAnswer.innerHTML = `
      <p class="text-[var(--on-surface-secondary)] mb-2.5">${localAnswer}</p>
      <div class="flex items-center gap-1 mb-1" title="${String(message).replace(/"/g, '&quot;')}">
        <h4 class="text-[10px] font-bold text-rose-400 uppercase tracking-widest flex items-center gap-1">${ICON_QA_WARN} Aiuto esterno</h4>
      </div>
      <p class="text-rose-200/90">L'aiuto extra non risponde in questo momento.</p>
      <button id="qa-fix-key" class="mt-2 text-[10px] underline text-rose-300">Controlla il collegamento →</button>`;
    document.getElementById('qa-fix-key')?.addEventListener('click', () => {
      document.querySelector('[data-view="settings"]')?.click(); // Momentum Vault
      setTimeout(() => window.openApiKeyGuide?.('gemini'), 250);
    });
    replayQaAnimation();
  }
  // Chip di suggerimento DINAMICI E ROTANTI (richiesto esplicitamente: "non
  // essere sempre le stesse così l'utente può capire cosa chiedere e fare"):
  // un pool ampio di domande REALI (ogni intent qui elencato esiste davvero
  // in qa-engine.js — mai una domanda-esca che poi cade su "non lo so
  // ancora"), filtrato da cosa esiste nei dati dell'utente, poi mescolato e
  // troncato a un numero fisso — così ad ogni apertura della Dashboard
  // l'utente scopre capacità diverse invece di vedere sempre le stesse 4
  // domande. Multilingua: seguono la lingua del dispositivo.
  function shuffledSample(arr, n) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, n);
  }
  function renderQaSuggestions() {
    const box = $('#qa-suggestions');
    if (!box) return;
    const it = isItalianDevice();
    const always = [];
    const goals = VaultDAO.state.savingsGoals || [];
    if (goals[0]) always.push(`${it ? 'come va il mio obiettivo' : "how's my goal"} ${goals[0].name}?`);
    const salary = resolveSalary(VaultDAO.state, VaultDAO.state.transactions);
    if (salary) always.push(it ? 'quando mi pagano?' : 'when do I get paid?');
    const hasInvestments = (VaultDAO.state.positions || []).length > 0 || (VaultDAO.state.manualAssets || []).length > 0;
    // Pool ampio: ogni voce corrisponde a un intent reale in qa-engine.js —
    // se non risponde con dati veri risponde onestamente "non lo so ancora",
    // ma non è mai una frase decorativa senza motore dietro.
    const pool = [
      it ? 'quanto posso spendere oggi?' : 'how much can I spend today?',
      it ? 'dove spendo di più?' : 'where do I spend the most?',
      it ? 'quali abbonamenti pago?' : 'what subscriptions do I pay?',
      it ? 'come chiudo il mese?' : 'how will I end the month?',
      it ? 'quanto ho risparmiato?' : 'how much have I saved?',
      it ? 'quanto vale il mio patrimonio?' : "what's my net worth?",
      it ? 'quanto posso investire?' : 'how much can I invest?',
      it ? 'quanto devo ancora a rate?' : 'how much do I still owe in installments?',
      it ? 'perché ho speso di più questo mese?' : 'why did I spend more this month?',
      it ? 'quanto vale bitcoin?' : "what's bitcoin worth?",
      it ? 'notizie su Apple' : 'news on Apple',
      it ? 'posso permettermi 50€?' : 'can I afford 50€?',
    ].filter(c => hasInvestments || !/patrimonio|net worth/.test(c));
    const chips = [...always, ...shuffledSample(pool, 5 - always.length)];
    const esc = (s) => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    box.innerHTML = chips.map(c => `<button class="qa-chip text-[10px] px-2.5 py-1 rounded-full" style="background:rgba(255,255,255,0.05)" data-question="${esc(c)}">${esc(c)}</button>`).join('');
    // Delegato, mai onclick inline: un nome di obiettivo con un apostrofo
    // (es. "L'auto nuova") romperebbe un onclick="..." costruito a mano —
    // bug reale trovato verificando dal vivo (SyntaxError in console).
    box.querySelectorAll('.qa-chip').forEach(btn => btn.addEventListener('click', () => {
      qaInput.value = btn.dataset.question;
      qaSend.click();
    }));
  }
  window.renderQaSuggestions = renderQaSuggestions;
  renderQaSuggestions();
  if (qaInput && qaSend && qaAnswer) {
    const ask = async () => {
      const question = qaInput.value.trim();
      if (!question) return;
      const newsIntent = detectNewsIntent(question);
      if (newsIntent) {
        qaAnswer.classList.remove('hidden');
        showQaThinking(`Cerco notizie reali su "${newsIntent.asset}"...`);
        haptic('light');
        const handled = await tryAnswerWithRealNews(newsIntent.asset);
        if (handled) return;
      }
      const res = askMomentum(question);
      styleQaAnswer(res);
      qaAnswer.classList.remove('hidden');
      haptic('light');
      // I dati di mercato si caricano in sottofondo dopo l'avvio, e nei primi
      // secondi non ci sono. Chi chiedeva subito "quanto e' salito l'oro"
      // riceveva un "questa non la so ancora" — un rifiuto secco a una domanda
      // che l'app sa benissimo. Trovato provando dal vivo, invisibile ai test
      // perche' li' il precaricamento e' sempre gia' finito.
      // Ora la domanda si rifa' da sola appena gli archivi sono pronti:
      // l'utente vede il messaggio d'attesa trasformarsi nella risposta vera
      // senza dover ridigitare niente.
      if (res?.inCaricamento) {
        precaricaMercato().then(() => {
          if (qaInput.value.trim() !== question) return; // ha gia' chiesto altro
          const secondo = askMomentum(question);
          if (!secondo?.inCaricamento) { styleQaAnswer(secondo); haptic('light'); }
        }).catch(() => {});
        return;
      }
      const keys = VaultDAO.state.liveDataKeys || {};
      const hasCloudKey = keys.gemini || keys.groq || keys.deepseek || keys.openai || keys.anthropic;
      if (res.intent === 'unknown' && !hasCloudKey) {
        // Nessuna chiave cloud configurata: la domanda resta comunque un
        // segnale di apprendimento locale, sempre disponibile.
        recordQaUnknown(question);
        renderQaLearnPrompt(question);
      }
      if (res.intent === 'unknown' && hasCloudKey) {
        showQaThinking(res.answer);
        // Riconoscimento DINAMICO dell'asset (richiesta esplicita: il regex
        // sopra è statico, qualunque altra formulazione — "come sta andando
        // quella cripto famosa" — deve funzionare comunque). Usa la STESSA
        // AI esterna già configurata solo per capire DI COSA parla la
        // domanda; il grafico/prezzo restano sempre dati reali presi dopo,
        // mai inventati da questa chiamata. Se non trova un asset, prosegue
        // normalmente sulla chat generica.
        try {
          const { extractAssetName } = await import('./ai/chat-fallback.js');
          const firstProvider = ['gemini', 'groq', 'deepseek', 'openai', 'anthropic'].find(p => keys[p]);
          const dynamicAsset = await extractAssetName(question, { apiKey: keys[firstProvider], provider: firstProvider });
          if (dynamicAsset) {
            const handled = await tryAnswerWithRealNews(dynamicAsset);
            if (handled) return;
          }
        } catch (_) { /* onesto: se l'estrazione fallisce, prosegue sulla chat generica */ }
        try {
          const { askCloudFallbackChain, buildFinancialContextSummary } = await import('./ai/chat-fallback.js');
          // Attivo di DEFAULT (opt-out, richiesta esplicita dell'utente
          // 2026-07-27 — prima era opt-in): riassunto aggregato e anonimo,
          // mai transazioni/esercenti — vedi buildFinancialContextSummary.
          // `!== false` così solo la disattivazione ESPLICITA lo spegne.
          let contextSummary = null;
          if (VaultDAO.state.chatContextOptIn !== false) {
            try {
              const now = new Date();
              const monthTxs = VaultDAO.state.transactions[monthKey(now)] || [];
              const sts = getDailySafeToSpend({ monthTxs, allTx: VaultDAO.state.transactions, monthlyBudget: VaultDAO.state.monthlyBudget, referenceDate: now });
              const byCat = {};
              for (const t of monthTxs) if (t.type === 'uscita') byCat[t.category] = (byCat[t.category] || 0) + t.amount;
              const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
              const topCat = sorted[0];
              const totalOut = sorted.reduce((s, [, v]) => s + v, 0);
              // Stesse quote del grafico a torta "Dove vanno i tuoi soldi"
              // (Analisi Tensor) — top 3, solo percentuali, mai gli importi
              // delle singole spese: permette alla chat di "leggere" quel
              // grafico se l'utente chiede di spiegarglielo.
              const categoryBreakdown = totalOut > 0
                ? sorted.slice(0, 3).map(([id, v]) => ({ name: getCatById(id).name, pct: Math.round((v / totalOut) * 100) }))
                : null;
              const liveRegime = detectLiveRegimeFor('indice');
              contextSummary = buildFinancialContextSummary({
                safeToday: sts?.safeToday ?? null,
                monthRemaining: sts?.weekRemaining ?? null,
                topCategory: topCat ? getCatById(topCat[0]).name : null,
                marketRegime: liveRegime?.regime ?? null,
                categoryBreakdown,
              });
            } catch (_) { contextSummary = null; }
          }
          const { answer, provider } = await askCloudFallbackChain(question, { keys, fetchImpl: fetch.bind(window), contextSummary });
          showQaCloudAnswer(answer, provider);
          logCloudFallbackQuestion(question);
        } catch (e) {
          showQaCloudError(res.answer, e.message);
        }
        // Apprendimento locale ANCHE quando la risposta è stata delegata a
        // un provider esterno: la domanda restava fuori dal riconoscimento
        // di Momentum comunque, e insegnargli il tema serve a farla
        // riconoscere in locale la prossima volta, senza dover uscire di
        // nuovo verso terzi.
        recordQaUnknown(question);
        renderQaLearnPrompt(question);
      }
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

  // What-if simulator live updates. PRIMA: una formula di interesse composto
  // deterministica (un solo numero, nessuna incertezza mostrata). Ora riusa
  // il Motore Monte Carlo GIÀ esistente (src/alpha/net-worth.js,
  // projectStrategy — 500 percorsi, rendimenti misurati su SPY reale) e
  // mostra un intervallo onesto (se va male/tipico/se va bene) invece di
  // un unico valore che finge certezza — stessa disciplina già applicata
  // alla tabella "Strategia (10 anni)" più sopra in questa vista.
  const slider = document.getElementById('scenario-slider');
  const compareEl = document.getElementById('scenario-strategy-compare');
  if (slider) {
    slider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) || 0;
      $('#scenario-extra-val').textContent = `+€${val}/m`;
      try {
        const a = measuredAssumptions.spy?.buyHold;
        const mu = a?.mu ?? 0.09, sigma = a?.sigma ?? 0.15;
        const r = projectStrategy({ start: 0, monthlyContribution: val, years: 5, mu, sigma, paths: 500 });
        $('#scenario-future-impact').textContent = val > 0
          ? `5 anni: ${formatMoney(r.p5)} – ${formatMoney(r.p50)} – ${formatMoney(r.p95)}`
          : '5 Anni: +€0';
        // Confronto tra le 8 strategie per QUESTO risparmio extra (richiesto
        // esplicitamente: "e con questo risparmio, quale strategia conviene
        // di più?") — stesso motore già usato per la tabella "Strategia (10
        // anni)" più sopra, mai un secondo calcolo isolato. Risposta
        // dinamica: cambia strategia migliore a seconda di quanto risparmi,
        // non un ranking statico.
        if (compareEl) {
          if (val > 0) {
            const cmp = projectNetWorthByStrategy({ start: 0, monthlyContribution: val, years: 5, paths: 400 });
            const top = cmp.rows.slice(0, 4);
            const maxP50 = Math.max(1, ...top.map(row => row.p50));
            compareEl.classList.remove('hidden');
            compareEl.innerHTML = `<p class="text-[11px] text-slate-500 mb-1">Con questo risparmio, le strategie migliori a 5 anni (tipico):</p>
              <div class="space-y-1.5">${top.map((row, i) => `
                <div class="text-[10px]">
                  <div class="flex items-center justify-between mb-0.5">
                    <span class="text-[var(--on-surface-secondary)] truncate">${i + 1}. ${row.label}</span>
                    <span class="font-mono font-bold text-[var(--gold)] shrink-0 ml-2">${formatMoney(row.p50)}</span>
                  </div>
                  <div class="h-1.5 rounded-full bg-white/5 overflow-hidden"><div class="h-full rounded-full bg-[color-mix(in_srgb,var(--gold)_70%,transparent)]" style="width:${Math.max(4, Math.round((row.p50 / maxP50) * 100))}%"></div></div>
                </div>`).join('')}</div>`;
          } else {
            compareEl.classList.add('hidden');
            compareEl.innerHTML = '';
          }
        }
      } catch (err) { console.error(err); }
    });
  }

  // Impara l'origine da cui gira ORA l'app (più è stabile il dominio abituale,
  // più i link condivisi ci puntano). NON salviamo qui: un save() scriverebbe
  // omega_core_db e falserebbe il rilevamento primo-avvio più sotto. Muta solo
  // lo stato in memoria — persiste al primo salvataggio naturale (onboarding,
  // attivazione, o qualsiasi azione utente).
  try {
    const next = recordOrigin(VaultDAO.state.shareOrigins, location.origin);
    if (next !== VaultDAO.state.shareOrigins) VaultDAO.state.shareOrigins = next;
  } catch (_) { /* niente storage: i link usano comunque l'origine corrente */ }

  // JOIN DEEP-LINK IMMUNE AI RELOAD. Bug reale trovato dal vivo: al primo avvio
  // il service worker (skipWaiting/clients.claim) prende il controllo e la pagina
  // si RICARICA una volta; se il payload di divisione vivesse solo nell'URL, quel
  // reload lo perderebbe e l'utente finirebbe sull'onboarding invece che sulla
  // divisione (l'anti-abbandono saltava). Lo parcheggiamo in sessionStorage così
  // sopravvive a qualunque reload, e lo consumiamo UNA sola volta (clearJoin).
  const urlJoin = extractSharePayload(location.href);
  if (urlJoin) { try { sessionStorage.setItem('__mJoin', urlJoin); } catch (_) {} }
  let joinPayload = urlJoin;
  if (!joinPayload) { try { joinPayload = sessionStorage.getItem('__mJoin'); } catch (_) {} }
  const clearJoin = () => { try { sessionStorage.removeItem('__mJoin'); } catch (_) {} };
  // Il codice puo' essere nel formato nuovo (compresso, va decompresso in modo
  // asincrono) o in quello storico: readGroupCode li legge entrambi. Restituisce
  // sempre una promise, cosi' il boot resta identico per tutti e due i formati.
  const decodedJoin = () => joinPayload ? readGroupCode(joinPayload) : Promise.resolve(null);

  // Check onboarding state
  const hasOnboarded = localStorage.getItem('omega_core_db');
  if (hasOnboarded) {
    const gen = $('#genesis-container');
    if (gen) gen.remove();
    $('#app-core').classList.remove('hidden');
    $('#app-core').style.opacity = '1';
    // BUG REALE trovato analizzando il tema chiaro: <html class="dark"> è
    // scritto fisso nell'HTML e nessun punto del boot leggeva mai
    // VaultDAO.state.themeDark — il tema scelto veniva salvato ma MAI
    // riapplicato al riavvio, quindi ogni reload tornava silenziosamente
    // al tema scuro qualunque cosa l'utente avesse scelto l'ultima volta.
    const isDark = VaultDAO.state.themeDark !== false;
    document.documentElement.classList.toggle('dark', isDark);
    document.querySelectorAll('[data-action="toggle-theme"]').forEach(btn => setThemeToggleIcon(btn, isDark));
    // Modalità privacy ricordata tra le sessioni: se l'utente l'aveva
    // attivata, i numeri restano sfocati anche subito dopo il reload.
    if (VaultDAO.state.privacyMode) {
      document.body.classList.add('privacy-mode');
      [$('#privacy-toggle-mobile'), $('#privacy-toggle-desktop')].forEach(btn => {
        btn?.classList.add('active');
        setPrivacyToggleIcon(btn, true);
      });
    }
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
    // I dati di mercato si scaricano in sottofondo, senza bloccare niente: se
    // l'utente chiedera' "cosa protegge quando crolla" li trovera' pronti, e
    // se non lo chiedera' mai non avra' pagato nulla all'avvio.
    setTimeout(() => {
      precaricaMercato().then(async () => {
        // AGGIORNAMENTO DEI DATI DI MERCATO quando c'e' rete. I pannelli
        // incorporati sono istantanee: senza questo, fra tre anni l'app
        // direbbe con la stessa sicurezza numeri fermi al 2026. Si scaricano
        // solo le osservazioni NUOVE e si tengono in una "coda" additiva nel
        // vault — il pannello verificato resta la base, la coda e' l'aggiunta.
        // Silenzioso e non bloccante: se non c'e' rete non succede niente e
        // l'app continua con i dati che ha, dichiarandone l'eta'.
        if (navigator.onLine === false) return;
        try {
          const { aggiornaConRicaduta } = await import('./alpha/freschezza.js');
          const prec = VaultDAO.state.mercatoCoda || null;
          // Non si riscarica piu' di una volta al giorno: le fonti pubblicano
          // settimanalmente o mensilmente, e martellarle non aggiunge niente.
          if (prec?.aggiornatoIl && Date.now() - prec.aggiornatoIl < 86400000) return;
          const daDate = {};
          for (const c of prec?.code || []) daDate[c.chiave] = c.ultimo?.data;
          // Con ricaduta: se una fonte non risponde si prova la successiva.
          const coda = await aggiornaConRicaduta(undefined, { daDate });
          if (coda.riuscito) { VaultDAO.state.mercatoCoda = coda; VaultDAO.save(); }
        } catch (_) { /* mai bloccante */ }
      }).catch(() => {});
    }, 3000);
    consumeSharedImage(); // screenshot condiviso via share target (Android)
    // Utente già attivo che arriva (o torna dopo un reload SW) da un link di
    // divisione: apri direttamente la conferma d'ingresso, dal payload
    // sopravvissuto in sessionStorage se l'URL è già stato ripulito.
    decodedJoin().then(gExisting => {
    if (gExisting) { history.replaceState(null, '', location.pathname); setTimeout(() => { window.openJoinConfirm(gExisting); clearJoin(); }, 400); }
    else {
      clearJoin(); consumeJoinLink();
      // Feedback proposto UNA sola volta, dopo un uso reale (non al primo
      // avvio, mai un popup che torna): 10 giorni da quando questo
      // dispositivo ha iniziato a usare Momentum. Mai più dopo la prima
      // volta, risposto o "Non ora" che sia — l'attrito peggiore non è
      // chiederlo una volta, è chiederlo più di una.
      const daysUsed = (Date.now() - (VaultDAO.state.firstUsedAt || Date.now())) / 86400000;
      if (daysUsed >= 10 && !VaultDAO.state.feedbackPromptShown) {
        VaultDAO.state.feedbackPromptShown = true;
        VaultDAO.save();
        setTimeout(() => { try { window.openFeedbackModal(); } catch (_) {} }, 2500);
      }
    }
    });
  } else if (joinPayload) {
    // ANTI-ATTRITO: primo avvio ma si arriva da un LINK di divisione. Non
    // imponiamo l'onboarding completo (domande di mercato) prima di poter usare
    // l'app: attiviamo Momentum con default sensati, saltiamo il genesis, e
    // portiamo dritti alla divisione. Il Reveal (dopo il join) proporrà di
    // personalizzare. Se qualcosa va storto, fallback al genesis classico.
    decodedJoin().then(g => {
      history.replaceState(null, '', location.pathname);
      if (!g) throw new Error('payload non valido');
      activateLite();
      const gen = $('#genesis-container'); if (gen) gen.remove();
      $('#app-core').classList.remove('hidden');
      $('#app-core').style.opacity = '1';
      updateStreak();
      bootUI();
      // clearJoin DOPO aver mostrato il modale: se un reload SW cade nei 500ms,
      // il payload è ancora in sessionStorage e il ramo hasOnboarded lo riprende.
      setTimeout(() => { window.openJoinConfirm(g); clearJoin(); }, 500);
    }).catch(e => {
      console.warn('Percorso lampo fallito, uso onboarding classico:', e);
      clearJoin();
      window._pendingJoin = window._pendingJoin || null;
      const canvas = document.getElementById('genesis-canvas');
      if (canvas) { try { canvas.width = window.innerWidth; canvas.height = window.innerHeight; } catch (_) {} }
    });
  }
  // Il cielo stellato del primo avvio è ora in CSS PURO (index.html: .starfield),
  // quindi non serve disegnarlo da JS: è sempre presente, gira su qualsiasi
  // dispositivo e non dipende dal timing del boot (fix del canvas che non partiva).

  // "Provaci tu": si arma solo se il primo avvio è davvero a schermo. Nei rami
  // sopra il genesis viene rimosso dal DOM, e armare listener su una scena che
  // non esiste è il modo classico di lasciarne uno appeso.
  const heroScene = document.querySelector('#genesis-container #g-step-0 .privacy-scene');
  if (heroScene) {
    // Hero: nessun invito scritto (secondo argomento assente) — resta ipnotica.
    try { initPrivacyProof(heroScene); } catch (e) { console.warn('privacy proof non armato:', e); }
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
      const applyTheme = () => {
        VaultDAO.state.themeDark = !VaultDAO.state.themeDark;
        document.documentElement.classList.toggle('dark', VaultDAO.state.themeDark);
        setThemeToggleIcon(t, VaultDAO.state.themeDark);
        // Stesso scatto usato per l'icona privacy: conferma il cambio invece
        // di lasciare che l'utente lo scopra solo dal colore dello schermo.
        t.classList.remove('just-toggled');
        void t.offsetWidth;
        t.classList.add('just-toggled');
        VaultDAO.save();
        showToast("Tema aggiornato.", "success");
      };
      // Cerchio che si espande dal punto toccato e "rivela" il nuovo tema
      // sotto — stesso principio della propagazione privacy, applicato qui
      // con la View Transitions API (nativa, nessuna libreria). Dove non è
      // supportata (Safari meno recenti) o con animazioni ridotte, il tema
      // cambia comunque, solo senza il cerchio.
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (document.startViewTransition && !reduceMotion) {
        const rect = t.getBoundingClientRect();
        const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
        const endRadius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
        // Il cerchio (View Transition) e la dissolvenza colore di .card/
        // .theme-fade partivano ENTRAMBI nello stesso istante e si
        // accavallavano — due movimenti indipendenti sulla stessa superficie
        // si leggevano a scatti invece che come un unico gesto. Disattivata
        // la dissolvenza manuale durante il cerchio: qui la rivelazione la fa
        // solo lui, un unico movimento fluido.
        document.documentElement.classList.add('vt-active');
        const transition = document.startViewTransition(() => applyTheme());
        transition.ready.then(() => {
          document.documentElement.animate(
            { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`] },
            { duration: 550, easing: 'cubic-bezier(.22,1,.36,1)', pseudoElement: '::view-transition-new(root)' }
          );
        }).catch(() => {});
        transition.finished.finally(() => document.documentElement.classList.remove('vt-active'));
      } else {
        applyTheme();
      }
    } else if (a === 'quick-add-expense') {
      // Numero-eroe "Oggi puoi spendere" tappato → form uscita pronto (un tocco
      // per aprire, un tocco per confermare). La conferma addestra il Core.
      window.openPrefilledAdd({ type: 'uscita' });
    } else if (a === 'quick-add-predicted') {
      // Nudge "prossima spesa probabile" tappato → form pre-compilato con
      // categoria + importo tipico. La conferma (salvataggio normale) chiama
      // orchestrator.learn: ogni scorciatoia predittiva addestra i modelli.
      window.openPrefilledAdd({
        type: 'uscita',
        category: t.dataset.cat,
        amount: parseFloat(t.dataset.amt) || 0,
      });
    } else if (a === 'open-split') {
      // Promemoria "ti devono / devi" tappato → apre i gruppi per saldare.
      if (typeof window.openSplitGroup === 'function') window.openSplitGroup();
    }
  } catch(err) { console.error(err); }
});

// Accessibilità (WCAG): gli elementi resi azionabili con role="button" +
// tabindex (es. la card "Oggi puoi spendere") devono attivarsi da tastiera con
// Invio/Spazio, non solo col tocco/click.
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
  const t = e.target;
  if (t && t.getAttribute && t.getAttribute('role') === 'button' && t.hasAttribute('data-action')) {
    e.preventDefault();
    t.click();
  }
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

    // Il lessico condivisibile si alimenta da OGNI categorizzazione, ovunque
    // avvenga: intercettando learn() una volta sola invece di toccare i sei
    // punti che la chiamano — così non se ne dimentica uno domani.
    // Attenzione: qui si registra SEMPRE nel serbatoio locale (serve a far
    // maturare la soglia k-anonima), ma NIENTE esce finché l'utente non
    // accende l'apprendimento condiviso. Registrare non è condividere.
    const learnOriginale = momentumOrchestrator.learn.bind(momentumOrchestrator);
    momentumOrchestrator.learn = (description, category, amount, date) => {
      try {
        const token = String(description || '').trim().toLowerCase().split(/\s+/)[0];
        if (token && category) {
          VaultDAO.state.mlData = VaultDAO.state.mlData || {};
          VaultDAO.state.mlData.lexiconPool = observeLexicon(
            VaultDAO.state.mlData.lexiconPool || initLexiconPool(),
            { token, category, deviceId: VaultDAO.state.deviceId || 'local' },
          );
        }
      } catch (_) { /* mai bloccare l'apprendimento vero per il lessico */ }
      return learnOriginale(description, category, amount, date);
    };

    // Mente condivisa: MeshNode collegato al VERO stato NeuralNexus tramite
    // l'adapter (prima sincronizzava il motore standalone, una copia morta).
    // learn() dell'orchestratore chiama già mesh.broadcastLearning() — quindi
    // ogni apprendimento locale si propaga da solo ai dispositivi collegati.
    momentumMeshNode = new MeshNode(undefined, createNexusMeshMind(momentumOrchestrator, VaultDAO));
    // Sync differenziale dei DATI tra device fidati (src/mesh/sync.js):
    // callback che la mesh usa per scambiare digest→delta e per il merge.
    // Il digest porta anche le CANCELLAZIONI, altrimenti l'altro dispositivo
    // non puo' sapere che una spesa e' stata cancellata e continua a rimandarla.
    momentumMeshNode.getSyncDigest = () => computeSyncDigest(VaultDAO.state.transactions, VaultDAO.state.deletedTx || {});
    // SINCRONIZZAZIONE A PRIORITÀ SEMANTICA (src/mesh/sync-priority.js):
    // non ordine cronologico, ma PRIMA CIÒ CHE CAMBIA UNA DECISIONE. Le
    // cancellazioni per prime (costano un id e impediscono di mostrare un
    // dato già falso), poi i movimenti vicini a oggi, poi gli importi
    // grandi. Su una connessione instabile due secondi producono comunque
    // valore invece di niente: se cade a metà, quello che è arrivato è
    // quello che serviva. La struttura per mese resta identica — nessun
    // cambio di protocollo, solo un ordine più intelligente dentro.
    // RICONCILIAZIONE IBLT: si manda uno sketch di dimensione fissa invece
    // dell'elenco di tutti gli id. Misurato (npm run bench:mesh): con 10.000
    // transazioni e 3 differenze si passa da 169.299 a 477 byte. Il digest
    // cresce con lo storico, lo sketch no — è la differenza tra una
    // sincronizzazione che peggiora invecchiando e una che non lo fa.
    const idsLocali = () => Object.values(VaultDAO.state.transactions || {})
      .flat().map((t) => String(t.id)).filter(Boolean);
    // Calcolo condiviso: questo dispositivo accetta di lavorare per i peer
    // (solo carichi a input pubblico — il cancello è dentro la funzione).
    momentumMeshNode.runComputeUnits = runComputeUnitsLocally;

    // SYNC LIVE: si intercetta addTransaction UNA volta sola invece di
    // toccare i cinque punti che la chiamano — così non se ne dimentica uno
    // domani, che è esattamente come nascono i dati che non si sincronizzano.
    // Si propaga solo ciò che è stato davvero scritto (route conferma che non
    // era un duplicato): ritrasmettere un doppione sarebbe innocuo per il
    // merge CRDT, ma inutile da mandare.
    if (!VaultDAO.__liveSyncWrapped) {
      const addOriginale = VaultDAO.addTransaction.bind(VaultDAO);
      VaultDAO.addTransaction = (mese, tx, opts = {}) => {
        const esito = addOriginale(mese, tx, opts);
        try { if (esito && esito.route !== 'duplicate') queueLiveSync(mese, tx); } catch (_) {}
        return esito;
      };
      VaultDAO.__liveSyncWrapped = true;
    }
    momentumMeshNode.getSyncSketch = () => {
      try {
        const ids = idsLocali();
        if (!ids.length) return null;
        // Dimensionato sulle differenze ATTESE tra due dispositivi dello
        // stesso utente (poche): se sono molte la riconciliazione fallisce e
        // il protocollo torna da solo al digest classico.
        const s = buildSketch(ids, { m: recommendedSize(12) });
        return { cells: serializeCells(s), m: s.m, k: s.k };
      } catch (e) { console.warn('Sketch non costruito:', e); return null; }
    };
    momentumMeshNode.reconcileSketch = (msg) => {
      try {
        const ids = idsLocali();
        const mio = buildSketch(ids, { m: msg.m, k: msg.k });
        const r = reconcile(mio, msg.cells);
        if (!r.success) return { success: false };
        // `peerIsMissing` sono id MIEI che l'altro non ha: posso nominarli.
        const mancanti = new Set(r.peerIsMissing.map(String));
        const perMese = {};
        for (const [mese, lista] of Object.entries(VaultDAO.state.transactions || {})) {
          const sel = (lista || []).filter((t) => mancanti.has(String(t.id)));
          if (sel.length) perMese[mese] = sel;
        }
        // Anche qui l'ordine è per impatto sulla decisione, non cronologico.
        return { success: true, txs: rankMissingByMonth(perMese, { now: Date.now() }) };
      } catch (e) { console.warn('Riconciliazione fallita, si usa il digest:', e); return { success: false }; }
    };
    momentumMeshNode.getMissingForPeer = (peerDigest) => rankMissingByMonth(
      transactionsMissingFromPeer(VaultDAO.state.transactions, peerDigest, VaultDAO.state.deletedTx || {}),
      { now: Date.now() },
    );
    momentumMeshNode.onSyncReceived = (txs) => {
      const added = VaultDAO.applySyncMerge(txs);
      if (added > 0) { renderDashboard(); renderAnalysis({ skipHeavyForecast: true }); showToast(`${added} transazioni sincronizzate da un tuo dispositivo.`, 'success'); }
      return added;
    };
    momentumMeshNode.onPeerConnected = () => {
      renderMeshStatus();
      showToast('Dispositivo collegato: dati e AI ora si sincronizzano.', 'success');
      // IL PASSO CHE MANCAVA (channel-learning.js): fino ad oggi il sistema
      // leggeva un prior corretto ma nessun punto del codice registrava un
      // esito VERO. Questo e' l'unico punto che tutti e tre i modi di aprire
      // un canale diretto attraversano — invito manuale, auto-discovery via
      // gossip, riconnessione — perche' tutti finiscono in addDirectPeer,
      // che chiama onPeerConnected. Un solo hook, tre percorsi coperti.
      // Si registra solo il SUCCESSO (mai un fallimento come evento negativo:
      // e' la scelta di disegno gia' dichiarata in channel-learning.js — un
      // contesto dove 'diretto' non compare mai resta basso per costruzione,
      // senza bisogno di eventi negativi che nessuno saprebbe attribuire con
      // certezza a "la rete non va" invece che "l'utente ha cambiato idea").
      if (VaultDAO.state.channelLearning && __ultimaNatDiagnosi) {
        import('./mesh/channel-learning.js').then(({ recordOutcome }) => {
          recordOutcome(VaultDAO.state.channelLearning, {
            reteTipo: __ultimaNatDiagnosi.reteTipo,
            miaNat: __ultimaNatDiagnosi.nat,
            canale: 'diretto',
          });
          VaultDAO.save();
        }).catch(() => {}); // l'apprendimento e' un miglioramento, mai un blocco alla connessione
      }
      // sync automatico al pairing: scambio simmetrico dei soli delta
      for (const pid of momentumMeshNode.peers.keys()) momentumMeshNode.requestSync(pid);
      // e i gruppi di divisione già esistenti, per allinearli subito.
      if ((VaultDAO.state.splitGroups || []).length) momentumMeshNode.shareSplitGroups(VaultDAO.state.splitGroups, peerAppartieneAlGruppo);
      // FEDERAZIONE tipi esercente: condivido il modello morfologico appreso, così
      // un dispositivo nuovo eredita subito la categorizzazione dei negozi locali.
      const mm = VaultDAO.state.mlData?.merchantMorphology;
      if (mm && Object.keys(mm.tokens || {}).length) momentumMeshNode.shareMorphology(mm);
      // APPRENDIMENTO CONDIVISO — solo se l'utente lo ha acceso, mai per
      // impostazione predefinita. Esce un lessico gia' filtrato con soglia
      // k-anonima (un negozio visto da un solo dispositivo non esce MAI):
      // vedi window.openSharedLearning per il consenso e l'anteprima.
      if (VaultDAO.state.sharedLearningOptIn) shareLexiconIfAllowed();
      // Staffetta: a ogni incontro si scambiano i pacchetti in transito.
      for (const pid of momentumMeshNode.peers.keys()) scambiaStaffetta(pid);
      // FIDUCIA (device-trust.js): la propria chiave di firma viaggia ad
      // ogni nuovo collegamento diretto — mai una prova da sola, solo il
      // materiale con cui l'altro lato potrà calcolare le tre parole.
      identitaFirma().then((mia) => {
        for (const pid of momentumMeshNode.peers.keys()) momentumMeshNode.sendDeviceHello(pid, mia.publicKey);
      });
      // Se questo dispositivo ha già raggiunto una fonte macro, la passa
      // subito al nuovo arrivato — non deve aspettare il prossimo suo fetch.
      if (__macroContextCache) {
        import('./mesh/knowledge-relay.js').then(({ packForRelay }) => {
          const store = VaultDAO.state.knowledgeRelay;
          const raw = store && (store['macro:FM/D.U2.EUR.4F.KR.MRR_FR.LEV'] || store['macro:WS_CBPOL']);
          if (raw) momentumMeshNode.shareKnowledge(packForRelay({ ...raw, verified: raw.trainingEligible ? 'confirmed' : 'single-source' }, { symbol: raw.symbol, kind: raw.kind }));
        }).catch(() => {});
      }
    };
    // Ricezione della staffetta della conoscenza: SOLO dati pubblici, MAI
    // legati a una transazione o a una persona (vedi knowledge-relay.js per
    // il perché). Il cancello anti-avvelenamento è tutto lì — qui si
    // consegna il pacchetto e si salva il verdetto, nient'altro.
    momentumMeshNode.onKnowledgeReceived = async (peerId, payload) => {
      try {
        const { receiveRelayed } = await import('./mesh/knowledge-relay.js');
        const store = VaultDAO.state.knowledgeRelay || {};
        const r = receiveRelayed(store, payload, peerId, { now: Date.now(), ledger: VaultDAO.state.updateLedger || [] });
        if (r.accepted) {
          // POTATURA (difetto: `pruneKnowledge` esisteva e non la chiamava
          // nessuno, quindi lo store cresceva senza fine e la scadenza
          // dichiarata in knowledge-relay.js non era applicata da nessuna
          // parte). Una serie di tre mesi fa non aiuta più nessuno e occupa
          // spazio nel vault di tutti.
          const { pruneKnowledge } = await import('./mesh/knowledge-relay.js');
          VaultDAO.state.knowledgeRelay = pruneKnowledge(store);
          if (r.ledger) VaultDAO.state.updateLedger = r.ledger;
          VaultDAO.save();
          if (r.affidabile && payload.kind === 'macro' && !__macroContextCache) {
            // Un contesto macro affidabile è appena arrivato e non ne
            // avevamo uno nostro: si aggiorna la card che lo usa, non solo
            // lo stato — altrimenti l'utente lo vedrebbe solo al prossimo
            // riavvio.
            const ctx = await macroKnowledgeFromMesh(26);
            if (ctx) { __macroContextCache = ctx; renderCausalGraphViz(); }
          }
        }
      } catch (e) { console.warn('Staffetta della conoscenza non elaborata:', e); }
    };
    momentumMeshNode.onDeviceHello = (peerId, publicKey) => {
      gestisciDeviceHello(peerId, publicKey).catch((e) => console.warn('Verifica dispositivo non riuscita:', e));
    };
    // Ricezione dei pacchetti a staffetta: si apre cio' che è per noi, si
    // porta avanti il resto — senza poterlo leggere, e entro i limiti che
    // decidiamo noi (capienza e scadenza), così un peer non puo' usarci come
    // deposito infinito.
    momentumMeshNode.onBundlesReceived = async (peerId, bundles) => {
      try {
        const mio = await identitaScambio();
        let sacco = saccoStaffetta();
        let aperti = 0;
        for (const b of bundles || []) {
          // openSealedAny e non openSealed: prova anche le chiavi ritirate di
          // recente, così una rotazione non butta via la posta gia' in viaggio.
          const contenuto = await openSealedAny(mio, b);
          if (contenuto) { aperti++; continue; }        // era per me: consumato
          sacco = acceptForCarry(sacco, b);              // non per me: lo porto avanti
        }
        VaultDAO.state.carryBag = sacco;
        VaultDAO.save();
        if (aperti > 0) showToast(`${aperti} aggiornament${aperti > 1 ? 'i' : 'o'} arrivat${aperti > 1 ? 'i' : 'o'} da un altro dispositivo.`, 'success');
      } catch (e) { console.warn('Pacchetti a staffetta non elaborati:', e); }
    };
    // Ricezione del lessico condiviso: si accetta solo cio' che almeno DUE
    // dispositivi indipendenti hanno visto uguale (voto di maggioranza in
    // mergeLexiconDigests). Un peer solo, anche malevolo, non sposta nulla.
    momentumMeshNode.onLexiconReceived = (peerId, digest) => {
      try {
        if (!VaultDAO.state.sharedLearningOptIn) return; // chi non partecipa non riceve
        const pending = (VaultDAO.state.mlData?.lexiconInbox || []).filter((x) => x.peerId !== peerId);
        pending.push({ peerId, digest });
        VaultDAO.state.mlData = VaultDAO.state.mlData || {};
        VaultDAO.state.mlData.lexiconInbox = pending.slice(-8); // finestra breve
        const { accettati } = mergeLexiconDigests(pending, { minVoti: 2 });
        if (accettati.length) {
          const learned = VaultDAO.state.mlData.learnedCategories || {};
          for (const { token, category } of accettati) {
            if (!learned[token]) learned[token] = category; // mai sovrascrivere una TUA correzione
          }
          VaultDAO.state.mlData.learnedCategories = learned;
        }
        VaultDAO.save();
      } catch (e) { console.warn('Lessico condiviso non applicato:', e); }
    };
    // Ricezione federata dei tipi esercente: merge anti-poisoning (cap per token)
    // sul modello locale. Zero dati grezzi ricevuti — solo parole-tipo+categorie.
    momentumMeshNode.onMorphologyReceived = (peerId, model) => {
      try {
        if (!model || !model.tokens) return;
        VaultDAO.state.mlData = VaultDAO.state.mlData || {};
        VaultDAO.state.mlData.merchantMorphology =
          mergeMorphology(VaultDAO.state.mlData.merchantMorphology || initMorphology(), model);
        VaultDAO.save();
      } catch (_) {}
    };
    // SYNC LIVE gruppi divisione (task "sync live post-condivisione"): un
    // rename/nuova-spesa/nuova-persona fatto sull'altro dispositivo arriva QUI
    // sul canale già aperto (non serve ri-condividere un link). Merge CRDT
    // (mergeIntoGroups, last-writer-wins per campo — già usato dal box
    // "Ricevi"): non perde mai dati locali, converge nei due sensi.
    momentumMeshNode.onSplitGroupsReceived = (peerId, incoming) => {
      let changed = false;
      const allChanges = [];
      for (const g of (incoming || [])) {
        const before = (VaultDAO.state.splitGroups || []).find(x => x.id === g.id) || null;
        // LA DIFESA CHE NON DIPENDE DALLA BUONA FEDE DEL MITTENTE.
        // Filtrare in invio (shareSplitGroups) impedisce a NOI di mandare
        // gruppi a chi non c'entra. Ma non ci protegge da un mittente che
        // manda comunque: un dispositivo con una versione vecchia, o uno che
        // lo fa apposta. Un gruppo mai visto che arriva via sync non viene
        // accettato — a un gruppo ci si unisce con un INVITO, mai perché
        // qualcuno te lo spinge addosso. È anche la difesa contro il
        // riempimento del vault con gruppi inventati.
        if (!before) {
          console.warn('Gruppo non richiesto ignorato: a un gruppo ci si unisce con un invito.');
          continue;
        }
        const merged = mergeIntoGroups(VaultDAO.state.splitGroups || [], g).find(x => x.id === g.id);
        // Notifica PRECISA (non "aggiornato"): cosa è arrivato per davvero —
        // persona entrata, spesa aggiunta con importo, rename. Un concorrente
        // cloud (Splitwise/Settle Up) non ti dice mai QUESTO livello di
        // dettaglio su un update da un altro dispositivo.
        if (merged) allChanges.push(...describeGroupChanges(before, merged).changes);
        const list = mergeIntoGroups(VaultDAO.state.splitGroups || [], g);
        if (list !== VaultDAO.state.splitGroups) { VaultDAO.state.splitGroups = list; changed = true; }
      }
      if (changed) {
        VaultDAO.save();
        if (allChanges.length) allChanges.slice(0, 3).forEach(msg => showToast(msg, 'success'));
        else showToast('Un gruppo condiviso è stato aggiornato da un tuo dispositivo.', 'success');
        // Se il pannello di divisione è aperto ORA (marcatori stabili di
        // renderList/renderDetail nel modale), si ridisegna subito: è questo
        // che rende il sync "live" — MAI se è aperto un modale diverso
        // (sovrascriverebbe il suo contenuto).
        const modalShowsSplit = !!(document.getElementById('sg-new') || document.getElementById('sg-name'));
        if (modalShowsSplit) { try { window.__splitLiveRefresh?.(); } catch (_) {} }
      }
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
        const updatedSymbols = [];
        for (const [sym, payload] of Object.entries(prices || {})) {
          const key = `mkt:${payload.kind || 'crypto'}:${sym}`;
          const local = await DurableStore.get('state', key).catch(() => null);
          const winner = mergePeerPrices(local, { ...payload, prices: payload.series }, peerId);
          if (winner) {
            await DurableStore.put('state', winner, key).catch(() => {});
            const last = winner.prices[winner.prices.length - 1];
            if (last) {
              (window.__livePrices = window.__livePrices || {})[sym] = last.close;
              (window.__liveSeries = window.__liveSeries || {})[sym] = winner.prices.slice(-30);
            }
            updatedSymbols.push(sym);
          }
        }
        if (updatedSymbols.length) {
          renderNetWorth();
          // Notifica PRECISA: quali simboli, non un "prezzi aggiornati" generico.
          const list = updatedSymbols.slice(0, 4).join(', ') + (updatedSymbols.length > 4 ? ` +${updatedSymbols.length - 4}` : '');
          showToast(`Prezzi aggiornati da un tuo dispositivo: ${list}.`, 'success');
        }
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
    const cacheAdapter = { get: (k) => DurableStore.get('state', k).catch(() => null), put: (k, v) => DurableStore.put('state', v, k).catch(() => {}) };

    // ── Avvisi di prezzo (src/predict/price-alerts.js) + WATCHLIST: logica
    // pura, qui solo il "collegamento a rete" — prendere l'ultimo prezzo noto
    // e dichiarare gli avvisi scattati. La watchlist (`VaultDAO.state.
    // watchlist`, asset "seguiti" senza per forza un avviso) si aggiorna qui
    // ALLO STESSO MODO: l'utente non deve rifare la ricerca per vedere un
    // prezzo aggiornato, il ciclo idle lo fa da solo per ogni asset seguito.
    const idleCheckAlerts = async () => {
      const alerts = VaultDAO.state.priceAlerts || [];
      const watchlist = VaultDAO.state.watchlist || [];
      const pending = alerts.filter(a => !a.triggeredAt);
      if ((!pending.length && !watchlist.length) || !navigator.onLine) return;
      const live = window.__livePrices || {};
      const tracked = new Map();
      pending.forEach(a => tracked.set(a.symbol, a.kind));
      watchlist.forEach(w => tracked.set(w.symbol, w.kind));
      const missing = [...tracked.keys()].filter(s => !Number.isFinite(live[s]));
      if (missing.length) {
        const { fetchLiveCryptoPrice, fetchLiveStockPrice } = await import('./alpha/live-price.js');
        for (const symbol of missing.slice(0, 5)) {
          const kind = tracked.get(symbol);
          try {
            if (kind === 'crypto') {
              const { price } = await fetchLiveCryptoPrice(symbol.toLowerCase());
              live[symbol] = price;
            } else if (VaultDAO.state.liveDataKeys?.alphavantage) {
              const { price } = await fetchLiveStockPrice(symbol, { apiKey: VaultDAO.state.liveDataKeys.alphavantage });
              live[symbol] = price;
            }
          } catch (_) {}
        }
        window.__livePrices = live;
        if (watchlist.length) renderWatchlist();
      }
      const { alerts: updated, fired } = checkPriceAlerts(alerts, live);
      if (fired.length) {
        VaultDAO.state.priceAlerts = updated;
        VaultDAO.save();
        fired.forEach(a => {
          const msg = `${a.symbol} ha ${a.direction === 'above' ? 'superato' : 'toccato sotto'} ${formatMoney(a.threshold)} (ora ${formatMoney(a.triggeredPrice)}).`;
          showToast(msg, 'info');
          notifyUser('Momentum · avviso di prezzo', msg);
        });
        renderPriceAlerts();
      }
    };

    const idleFetchPrices = () => {
      const positions = VaultDAO.state.positions || [];
      idleCheckAlerts();
      if (!positions.length || !navigator.onLine) return;
      import('./alpha/sources.js').then(async ({ fetchVerified, trainingEligible }) => {
        const shared = {};
        // BUG REALE TROVATO (2026-07-27): qui si passava kind:'crypto'/'stock',
        // ma SOURCE_REGISTRY etichetta le fonti prezzo con kind:'prices' (vedi
        // sources.js) — il filtro non ha MAI trovato una fonte utilizzabile,
        // per NESSUNA posizione, da quando questo codice esiste. L'intero
        // sistema di prezzi verificati (cross-check, cache, mesh-sharing)
        // restituiva sempre "nessuna fonte" in silenzio. Corretto insieme al
        // bug di Stooq (CORS bloccato) qui accanto.
        for (const p of positions.slice(0, 6)) {           // budget rete per sessione
          const kind = 'prices';
          const assetKind = p.assetClass === 'crypto' ? 'crypto' : 'stock';
          try {
            // Alpha Vantage (azioni/indici) richiede la chiave PERSONALE
            // dell'utente (VaultDAO.state.liveDataKeys, mai una chiave
            // condivisa Momentum) — senza chiave la fonte si salta da sola
            // (fetchVerified lo dichiara), niente crash, niente invenzione.
            const params = assetKind === 'stock' ? { apiKey: VaultDAO.state.liveDataKeys?.alphavantage } : {};
            const r = await fetchVerified({ symbol: p.ticker.toLowerCase(), kind, fetchImpl: fetch.bind(window), cache: cacheAdapter, params });
            const last = r.prices && r.prices[r.prices.length - 1];
            if (last && trainingEligible(r)) {
              (window.__livePrices = window.__livePrices || {})[p.ticker] = last.close;
              (window.__liveSeries = window.__liveSeries || {})[p.ticker] = r.prices.slice(-30);
              shared[p.ticker] = { kind: assetKind, asOf: r.asOf, source: r.source, series: r.prices.slice(-30) };
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
    window.idleFetchPrices = idleFetchPrices; // richiamabile subito dopo il salvataggio di una chiave (vedi saveLiveDataKey)
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

