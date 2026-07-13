# Momentum — Acquirer readiness (mappa onesta bisogno→capacità)

> Onestà (regola #1): nessuna valutazione $2B spacciata per fatto, nessun numero competitor inventato. Questa è una mappa di **cosa servirebbe a ciascun possibile interessato** e **quale capacità REALE di Momentum lo soddisfa**, con i limiti dichiarati. Ciò che regge una due diligence è proprio non gonfiare.

## Il moat strutturale (non quantitativo)
I dati non lasciano mai il dispositivo. Chi monetizza i dati non può replicarlo senza cambiare modello di business. Specializzato + on-device + riaddestrabile localmente + federato.

## Metriche VERE (riproducibili, dagli script)
- Categorizzazione prodotto (dizionario+ML): **94.6%** (`npm run bench`), latenza ~0.2ms.
- Generalizzazione ML pura held-out: ensemble Nano+Meso+**LogReg 83.8%** (76% prima del riaddestramento locale).
- Import verificato su file bancari reali: export Revolut 1846 righe → 1777 transazioni in **301ms**, investimenti/dividendi/spese classificati, dedup esatta, 0 date sbagliate su 28 mesi.
- 401 test verdi.
- Limiti dichiarati: sul ragionamento aperto i frontier LLM restano avanti; niente confronto vs LLM live senza dataset/chiavi.

## Mappa bisogno → capacità
| Interessato | Suo bisogno | Capacità reale di Momentum | Limite onesto |
|---|---|---|---|
| **Apple** (Wallet/Siri, Apple Intelligence) | AI finanziaria on-device, privacy-first | 100% on-device, categorizzazione+causale+forecast senza server; adattività per-hardware | Non è un LLM generalista; si integra come motore specializzato |
| **Revolut / Robinhood / Trade Republic** | Ridurre abbandono, engagement sano | Attrito minimo, import robusto multi-file, abbonamenti trovati, sweep, spiegazioni tracciabili | Base utenti da costruire |
| **OpenAI / Anthropic (finance)** | Specializzazione finanziaria verificabile | 94.6% categorizzazione + aritmetica verificabile + guardrail anti-allucinazione | Non sostituisce il loro LLM; lo complementa |
| **xAI/Grok, Copilot** | AI che non allucina numeri | Deterministica, self-check aritmetico, causale interpretabile | Dominio ristretto (finanza personale) |
| **Chip/edge (NVIDIA/AMD/Qualcomm)** | Showcase edge-AI efficiente | Modelli piccoli, INT8/riaddestro locale, backend adattivo | Prestazioni misurate su commodity, non su NPU dedicate |

## Come leggerla in due diligence
Ogni riga è un'ipotesi da validare, non una promessa. La forza è la **coerenza tra ciò che diciamo e ciò che gli script dimostrano**.
