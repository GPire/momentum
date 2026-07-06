import { monthKey } from '../core/constants.js';
import { VaultDAO } from '../core/vault.js';

// ==========================================
// PREDICTIONS & CALCULATORS
// ==========================================
const PredictiveOracle = {
  calculateProjections() {
    let totalInvested = 0;
    let invBreakdown = { crypto: 0, etf: 0, liquid: 0 };
    let x_months = [];
    let y_savings = [];
    let y_expenses = [];
    let m_idx = 0;
    let totalSavings = 0;

    Object.keys(VaultDAO.state.transactions).sort().forEach(monthKey => {
      let mInc = 0, mExp = 0;
      VaultDAO.state.transactions[monthKey].forEach(t => {
        if (t.type === 'invest') {
          totalInvested += t.amount;
          if (t.category === 'crypto') invBreakdown.crypto += t.amount;
          else if (t.category === 'etf') invBreakdown.etf += t.amount;
          else invBreakdown.liquid += t.amount;
        }
        if (t.type === 'entrata') mInc += t.amount;
        if (t.type === 'uscita') mExp += t.amount;
      });
      const sav = mInc - mExp;
      x_months.push(m_idx++);
      y_savings.push(sav);
      y_expenses.push(mExp);
      totalSavings += sav;
    });

    let n = x_months.length;
    let slope = 0;
    if (n > 1) {
      let sum_x = 0, sum_y = 0, sum_xy = 0, sum_xx = 0;
      for (let i = 0; i < n; i++) {
        sum_x += x_months[i];
        sum_y += y_savings[i];
        sum_xy += x_months[i] * y_savings[i];
        sum_xx += x_months[i] * x_months[i];
      }
      const denominator = (n * sum_xx - sum_x * sum_x);
      slope = denominator !== 0 ? (n * sum_xy - sum_x * sum_y) / denominator : 0;
    }

    let avgMonthlySavings = n > 0 ? (totalSavings / n) : 0;
    let projectedMonthlyFlow = avgMonthlySavings + (slope * 2);
    projectedMonthlyFlow = Math.max(0, projectedMonthlyFlow);

    let avgExpenses = y_expenses.length > 0 ? y_expenses.reduce((a,b)=>a+b,0)/y_expenses.length : 500;
    let varSum = y_expenses.reduce((acc, val) => acc + Math.pow(val - avgExpenses, 2), 0);
    let stdDevExp = y_expenses.length > 1 ? Math.sqrt(varSum / (y_expenses.length - 1)) : 150;

    let dynCagr = 0.05;
    if (totalInvested > 0) {
      const wCrypto = (invBreakdown.crypto / totalInvested) * 0.09;
      const wEtf = (invBreakdown.etf / totalInvested) * 0.06;
      const wLiquid = (invBreakdown.liquid / totalInvested) * 0.02;
      dynCagr = wCrypto + wEtf + wLiquid;
    }

    const profile = VaultDAO.state.onboardingProfile || { riskProfile: 'bilanciato', horizon: 'medio' };
    let volatilityMultiplier = 1.0;
    let driftRate = dynCagr;

    if (profile.riskProfile === 'aggressivo') {
      volatilityMultiplier = 1.4;
      driftRate = Math.max(driftRate, 0.08);
    } else if (profile.riskProfile === 'conservativo') {
      volatilityMultiplier = 0.6;
      driftRate = Math.min(Math.max(driftRate, 0.02), 0.04);
    }

    if (profile.horizon === 'lungo') {
      driftRate += 0.01;
    } else if (profile.horizon === 'breve') {
      driftRate = Math.max(0.01, driftRate - 0.01);
      volatilityMultiplier *= 0.8;
    }

    const runSimulation = (years) => {
      const trials = 1000;
      const steps = years * 12;
      const results = [];
      
      for (let t = 0; t < trials; t++) {
        let capital = totalInvested;
        for (let s = 0; s < steps; s++) {
          let baseFlow = projectedMonthlyFlow;
          if (y_savings.length > 0) {
            // Empirical Bootstrap Resampling
            const randIdx = Math.floor(Math.random() * y_savings.length);
            baseFlow = y_savings[randIdx];
          }
          // Stochastic Gaussian Shock
          const randomNoise = (Math.random() + Math.random() + Math.random() - 1.5) * stdDevExp * volatilityMultiplier;
          const stepFlow = Math.max(0, baseFlow + randomNoise);
          
          capital = capital * (1 + driftRate / 12) + stepFlow;
        }
        results.push(capital);
      }
      results.sort((a,b) => a - b);
      return {
        p5: results[49] || 0,
        p50: results[499] || 0,
        p95: results[949] || 0
      };
    };

    const sim1y = runSimulation(1);
    const sim5y = runSimulation(5);
    const sim10y = runSimulation(10);
    const sim20y = runSimulation(20);

    let discipline = 50;
    if (n > 0) {
      if (slope >= 0) discipline += 20;
      else discipline -= 15;
      discipline = Math.min(Math.max(Math.round(discipline), 15), 99);
    }

    return {
      avgMonthlySavings,
      projectedMonthlyFlow,
      dynCagr: driftRate,
      discipline,
      proj1y: sim1y.p50,
      proj5y: sim5y.p50,
      proj10y: sim10y.p50,
      proj20y: sim20y.p50,
      sim5y
    };
  },
  // ── Raccolta serie pure per il worker (nessun calcolo, solo aggregazione) ──
  gatherSeries() {
    const ySavings = [], yExpenses = [], txExpenseAmounts = [];
    let totalInvested = 0;
    const invBreakdown = { crypto: 0, etf: 0, liquid: 0 };
    Object.keys(VaultDAO.state.transactions).sort().forEach(mk => {
      let mInc = 0, mExp = 0;
      VaultDAO.state.transactions[mk].forEach(t => {
        if (t.type === 'invest') {
          totalInvested += t.amount;
          if (t.category === 'crypto') invBreakdown.crypto += t.amount;
          else if (t.category === 'etf') invBreakdown.etf += t.amount;
          else invBreakdown.liquid += t.amount;
        }
        if (t.type === 'entrata') mInc += t.amount;
        if (t.type === 'uscita') { mExp += t.amount; txExpenseAmounts.push(t.amount); }
      });
      ySavings.push(mInc - mExp);
      yExpenses.push(mExp);
    });
    // Serie giornaliera delle spese, ultimi 60 giorni (per Holt-Winters, period=7).
    // Prima scansionava TUTTA la cronologia dell'utente dall'inizio dei tempi
    // per riempire una finestra di soli 60 giorni — ripetuto ad ogni singolo
    // render (enhanceAsync gira ad ogni dashboard render, non solo a nuova
    // transazione). Una finestra di 60 giorni può toccare al massimo 3 mesi
    // solari (es. oggi 1 marzo, 60 giorni fa cade in gennaio): basta quindi
    // scansionare quei 3 mesi, non l'intera vita dell'utente. Per chi usa
    // l'app da anni questo è una riduzione enorme, non marginale.
    const dailyExpenses = new Array(60).fill(0);
    const now = Date.now();
    const relevantMonths = [];
    { const cursor = new Date(); for (let i = 0; i < 3; i++) { relevantMonths.push(monthKey(cursor)); cursor.setMonth(cursor.getMonth() - 1); } }
    relevantMonths.forEach(mk => {
      (VaultDAO.state.transactions[mk] || []).forEach(t => {
        if (t.type !== 'uscita') return;
        const daysAgo = Math.floor((now - new Date(t.date).getTime()) / 864e5);
        if (daysAgo >= 0 && daysAgo < 60) dailyExpenses[59 - daysAgo] += t.amount;
      });
    });
    const recurringTotal = (VaultDAO.state.subscriptions || []).reduce((a, s) => a + (s.amount || 0), 0);
    return { ySavings, yExpenses, txExpenseAmounts, dailyExpenses, totalInvested, invBreakdown, recurringTotal };
  },

  // ── Forecast potenziato nel Web Worker (progressivo: la UI renderizza
  // subito il calcolo sincrono classico, poi si aggiorna con questo).
  // Se i Worker falliscono si risolve a null e la UI resta com'è.
  _worker: null,
  enhanceAsync({ paths = 5000, capitalTrials = 2000 } = {}) {
    return new Promise((resolve) => {
      let settled = false;
      const settle = (v) => { if (!settled) { settled = true; resolve(v); } };
      try {
        if (!this._worker) {
          this._worker = new Worker(new URL('./forecast-worker.js', import.meta.url), { type: 'module' });
        }
        const w = this._worker;
        const series = this.gatherSeries();
        // stessi parametri di drift/volatilità del calcolo sincrono
        const sync = this.calculateProjections();
        const yExp = series.yExpenses;
        const avgExpenses = yExp.length ? yExp.reduce((a, b) => a + b, 0) / yExp.length : 500;
        const varSum = yExp.reduce((acc, v) => acc + Math.pow(v - avgExpenses, 2), 0);
        const stdDevExp = yExp.length > 1 ? Math.sqrt(varSum / (yExp.length - 1)) : 150;
        const profile = VaultDAO.state.onboardingProfile || { riskProfile: 'bilanciato' };
        const volatilityMultiplier = profile.riskProfile === 'aggressivo' ? 1.4 : profile.riskProfile === 'conservativo' ? 0.6 : 1.0;
        w.onmessage = (e) => settle(e.data.ok ? e.data.result : null);
        w.onerror = () => { settle(null); try { w.terminate(); } catch {} this._worker = null; };
        setTimeout(() => settle(null), 15000);
        w.postMessage({
          ySavings: series.ySavings, dailyExpenses: series.dailyExpenses,
          txExpenseAmounts: series.txExpenseAmounts, totalInvested: series.totalInvested,
          driftRate: sync.dynCagr, stdDevExp, volatilityMultiplier,
          recurringTotal: series.recurringTotal, paths, capitalTrials, years: [1, 5, 10, 20],
        });
      } catch (err) {
        console.warn('Forecast worker non disponibile, resto sul calcolo sincrono:', err);
        settle(null);
      }
    });
  },

  calculateMomentumScore() {
    const proj = this.calculateProjections();
    let totalInc = 0, totalExp = 0;
    Object.keys(VaultDAO.state.transactions).forEach(m => {
      VaultDAO.state.transactions[m].forEach(t => {
        if (t.type === 'entrata') totalInc += t.amount;
        if (t.type === 'uscita') totalExp += t.amount;
      });
    });
    const savingsRate = totalInc > 0 ? ((totalInc - totalExp) / totalInc) : 0;
    return Math.min(Math.max(Math.round(savingsRate * 400 + proj.discipline * 4 + 200), 100), 1000);
  }
};


export { PredictiveOracle };
