<div align="center">

# Momentum

### Personal finance AI that runs entirely on your device.

**No server. No subscription. Nothing leaves your phone.**

[![tests](https://img.shields.io/badge/tests-2173%20passing-brightgreen)](#verify-it-yourself-30-seconds)
[![on-device](https://img.shields.io/badge/AI-100%25%20on--device-blue)](#the-one-thing-that-makes-it-different)
[![no cloud](https://img.shields.io/badge/cloud-none-blue)](#the-one-thing-that-makes-it-different)
[![PWA](https://img.shields.io/badge/PWA-offline%20first-blue)](#works-with-no-signal)
[![zero deps](https://img.shields.io/badge/runtime%20deps-0-blue)](#quick-start)

**English** · [Italiano](README.it.md)

</div>

---

## In 10 seconds

Most money apps die for two reasons: **typing every expense** and **numbers that mean nothing**.

Momentum answers the one question you actually ask — **"how much can I spend today?"** — and it does the maths where your data already lives: on your device.

**It's for you if you:**
- want to know what you can spend **today**, not a chart of last month
- are a **freelancer** who dreads tax deadlines (Italy 🇮🇹 and Switzerland 🇨🇭 supported)
- **invest** and want the return *after* tax, not the brochure number
- don't want your bank life sitting on someone else's server

## The one thing that makes it different

Every other finance app has a server. That server is the product: it holds the data, and the data is the business model.

Momentum inverts it. **The value comes from never receiving your data.**

That isn't a privacy promise bolted on top — it's the architecture. Devices sync directly with each other (WebRTC, peer-to-peer, no signalling server). The AI trains locally. There is no account to create, because there's nothing to create it on.

> A competitor who monetises data or cloud cannot copy this. They'd have to delete their own business model first.

---

## What it does

### 💶 Today's number
**"You can spend X today."** Weekly budget derived from your monthly one, proportional to real days, envelope carry-over, minus subscriptions about to hit — divided by days left.

Month-end projection uses Holt-Winters on your actual trend (falls back to run-rate, and always tells you which method it used).

### 🧾 Freelancers, VAT & invoicing — Italy and Switzerland
The part that turns a budgeting app into infrastructure.

**🇮🇹 Italy**
- **Set-aside engine** — every payment received tells you what's yours and what's the taxman's. Flat-rate (*forfettario*) and standard regimes, real ATECO coefficients, INPS, professional funds (*casse*), reduced 24% rate for employed-plus-freelance.
- **Real e-invoices** — FatturaPA v1.2.2 XML, generated on-device. Plus an **offline predictor of SdI rejection codes** (00400/00415/00417/00422/00423/00427…) so you find the error *before* sending, not after.
- **Multi-line invoices**, percentage lines (discount/surcharge), courtesy PDF, real checksum validation of VAT numbers and *codice fiscale*.
- **Periodic VAT settlement**, purchase register (deductible VAT), **passive invoice import** (drop in the XML you received, it books itself).
- **Pre-filled F24** with verified tax codes (1790/1791/1792, 4033/4034/4001, 6001-6012, 6031-6034, P10) ready to copy into your bank.
- **Missed a deadline?** *Ravvedimento operoso* calculated automatically — reduced penalty by lateness band plus legal interest. Most tools just let the deadline vanish.

**🇨🇭 Switzerland**
- **AHV/IV/EO** contributions for the self-employed, **VAT threshold** (CHF 100,000 — many freelancers don't need to register at all, and Momentum says so).
- **QR-bill** — the payment QR code mandatory on every Swiss invoice since 2022. Payload verified **byte-for-byte against three official SIX Group examples**; the QRR reference check digit verified against SIX's own published reference.
- Interface in **German, French, Italian and English**, auto-detected.

### 📈 Investments — the *real* net
Every simulator shows you gross. A 7% ETF is not a 7% ETF.

Momentum shows the return **after capital gains tax and stamp duty**, with rates verified per country — 🇮🇹 Italy (26% / 12.5% govt bonds / 0.2% stamp duty), 🇩🇪 Germany (26.375% flat + €1,000 *Sparerpauschbetrag*), 🇫🇷 France (31.4% PFU, 2026), 🇨🇭 Switzerland (0% for private investors — with the professional-trader and cantonal wealth tax caveats stated, never hidden).

Plus: net worth, Monte Carlo projections with declared assumptions, market regime detection, 40 years of drawdown base rates, portfolio import and risk-parity rebalancing.

**Never a buy/sell recommendation.** The picture, never the order — that's a regulatory line, and it's also what makes it integrable rather than blockable.

### 🧠 AI that actually learns from you
An ensemble that votes, plus an arbiter that learns **which of its own models to trust, category by category**, from your real corrections.

<details>
<summary>Technical detail</summary>

- **NeuralNexus** — Naive Bayes + neural net (real backprop, L2, gradient clipping), learns from use.
- **Nano** (always on) — MLP trained in Python/scikit-learn, ported to JS with verified numerical parity.
- **Meso** (mid/high tier) — hybrid TF-IDF words + character n-grams, 2 hidden layers, built for *dirty bank text*.
- **Orchestrator** — N-way weighted vote, weights modulated by per-category precision measured on your corrections (incremental matrix, Laplace smoothing, neutral when it has no data).
- **Hardware tiering** — a real micro-benchmark at boot picks Monte Carlo depth (500–10,000) and which engines to wake. Routine transactions never wake the heavy ones.

Reproduce the numbers: `npm run bench`, `npm run bench:vs-llm`, `npm run bench:cash`
</details>

### 🕸️ Cause and effect, honestly
Measured co-variation between categories on weekly **differences** (so a shared trend doesn't invent a link), lag 0 and lag 1, with damped propagation and an explainable path.

Stated plainly in the UI: *"this isn't a law, it's what happened in your data."*

### 💬 Ask it anything, offline
Deterministic intents computed on your real data — *"how much did I spend in June?"*, *"can I afford €50?"*, *"when do I pay Netflix?"*, *"what if I spend more on restaurants?"* Typo-tolerant. Speaks answers aloud. **When it doesn't know, it says so.**

### ⚡ Zero friction input
One-tap buttons for habitual purchases, **ordered by what's likely right now** (measured hour-of-day and day-of-week histograms — coffee at 8am, groceries on Saturday), with the reason shown. Amount memory. Bank PDF import (Intesa, UniCredit, N26, Revolut), CSV, receipt OCR, voice with multi-action sentences.

### 🌐 Sync without a server
Explicit pairing between trusted devices over WebRTC. Weighted FedAvg, **anti-poisoning validated on a local set**, and a new device *inherits* the trained network on first link.

### 📴 Works with no signal
Dual-cache service worker, IndexedDB + localStorage, schema migrations, and a **hash chain on transactions that is never rewritten**.

---

## Verify it yourself (30 seconds)

Don't take the claims. Run them.

```bash
npm install
npm test      # 2173 tests, node --test src/
```

Every capability above has tests next to the code. The Swiss QR-bill is checked against the official SIX examples; the tax rates carry the date they were verified and the source; the AI numbers regenerate with `npm run bench:*`.

## Quick start

```bash
npm install
npm run dev               # localhost:5173
npm test                  # 2173 tests
npm run build             # multi-file PWA in dist/
npm run build:singlefile  # single ~575KB HTML file
```

**Zero runtime dependencies.** Vite is the only dev dependency.

## Architecture

```
src/
  ai/        NeuralNexus, Nano, Meso, Orchestrator, Q&A engine, calibration
  predict/   cash forecast, tax engine (IT + CH), VAT settlement, F24,
             ravvedimento, deadlines, causal discovery, subscriptions, BNPL
  invoice/   FatturaPA XML + SdI rejection predictor, passive import,
             Swiss QR-bill, fiscal-ID checksums, per-country registry
  alpha/     net return after tax, net worth, portfolio, market regime,
             factors, drawdown base rates, verified data sources
  mesh/      WebRTC signalling (no server), federated peer, sync CRDT
  core/      vault (IndexedDB + hash chain + migrations), auto-update
  split/     shared expenses, optimal settlement, invite crypto
  i18n/      language detection + UI strings
  import/    bank PDF, CSV, receipt OCR, notification parser
  voice/     multi-action voice parser
```

170 source modules. 16 domains.

## Declared limits

Trust is built by what a project admits, not by what it claims.

- A PWA **cannot** read other apps' notifications (iOS or Android). Direct reading needs a native Android shell (`NotificationListenerService`). On iOS nobody can — there, the route is Open Banking.
- iOS doesn't support Web Share Target for PWAs.
- The causal graph measures **co-variation, not causality** — and says so in the UI too.
- Momentum **cannot transmit** an invoice to the Italian SdI for you: that needs accreditation as an intermediary, which is a corporate process, not code. It prepares the correct file and walks you through the real portal.
- The Swiss QR-bill produces a **correct, scannable code**, not yet the fully compliant printable payment slip layout.
- Below CHF 60,500 the Swiss AHV uses a sliding scale that isn't a simple public formula — Momentum shows the verified minimum and links the official calculator instead of inventing a number.
- **Not tax advice.** Estimates on public rates, each carrying its verification date.

## Non-negotiable principles

1. User data never leaves the device.
2. No decorative modules — every claim is measured and tested (`npm test`).
3. Pure functions separated from the DOM; every new module ships with its tests.
4. The transaction hash chain is never rewritten.
5. Every line of UI text must be understandable by an 8-year-old.
6. **If the number isn't printed, it doesn't exist.** No unverified figure enters a document, a commit, or the UI.

## Documentation

- **[VERSIONI.md](VERSIONI.md)** — per-component version manifest; versions are earned with measured leaps, never with labels.
- **[PIANO_MOMENTUM.md](PIANO_MOMENTUM.md)** — development plan, phase status, gap list.
- **[NEUROSYM.md](NEUROSYM.md)** — the reasoning architecture, including what it explicitly is *not*.

---

<div align="center">

**Your money. Your device. Nothing leaves.**

</div>
