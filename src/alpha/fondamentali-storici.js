// GENERATO da bench/fetch-fondamentali-sec.mjs — non modificare a mano.
// Bilanci REALI depositati alla SEC (moduli 10-K), fonte PRIMARIA e non un
// aggregatore. Nessuna chiave, nessuna registrazione.
//
// PERCHE' ESISTE: fondamentali.js dichiarava da sempre il proprio limite piu'
// serio — "sono i numeri degli ultimi dodici mesi; Buffett chiede dieci anni
// di conti buoni, e la storia dei bilanci qui non c'e'". Adesso c'e'.
//
// ONESTA': e' una FOTOGRAFIA aggiornata al giorno dello scaricamento, non un
// flusso in tempo reale. E copre solo le aziende quotate negli Stati Uniti:
// la SEC e' l'autorita' americana, e per un'azienda europea qui non c'e'
// niente. Va detto, non aggirato.
'use strict';

export const SEC_SCARICATO_IL = '2026-08-20';
export const SEC_FONTE = 'SEC EDGAR — companyfacts XBRL, moduli 10-K';

export const FONDAMENTALI_STORICI = {
 "AAPL": {
  "nome": "Apple",
  "anni": [
   {
    "anno": 2007,
    "roe": 0.2406,
    "margine": 0.1456,
    "roa": null,
    "utileNetto": 3496000000,
    "ricavi": 24006000000,
    "patrimonioNetto": 14531000000
   },
   {
    "anno": 2008,
    "roe": 0.2744,
    "margine": 0.1632,
    "roa": 0.1692,
    "utileNetto": 6119000000,
    "ricavi": 37491000000,
    "patrimonioNetto": 22297000000
   },
   {
    "anno": 2009,
    "roe": 0.2603,
    "margine": 0.1919,
    "roa": 0.1734,
    "utileNetto": 8235000000,
    "ricavi": 42905000000,
    "patrimonioNetto": 31640000000
   },
   {
    "anno": 2010,
    "roe": 0.2932,
    "margine": 0.2148,
    "roa": 0.1864,
    "utileNetto": 14013000000,
    "ricavi": 65225000000,
    "patrimonioNetto": 47791000000
   },
   {
    "anno": 2011,
    "roe": 0.3383,
    "margine": 0.2395,
    "roa": 0.2228,
    "utileNetto": 25922000000,
    "ricavi": 108249000000,
    "patrimonioNetto": 76615000000
   },
   {
    "anno": 2012,
    "roe": 0.353,
    "margine": 0.2667,
    "roa": 0.237,
    "utileNetto": 41733000000,
    "ricavi": 156508000000,
    "patrimonioNetto": 118210000000
   },
   {
    "anno": 2013,
    "roe": 0.2998,
    "margine": 0.2167,
    "roa": 0.1789,
    "utileNetto": 37037000000,
    "ricavi": 170910000000,
    "patrimonioNetto": 123549000000
   },
   {
    "anno": 2014,
    "roe": 0.3542,
    "margine": 0.2161,
    "roa": 0.1704,
    "utileNetto": 39510000000,
    "ricavi": 182795000000,
    "patrimonioNetto": 111547000000
   },
   {
    "anno": 2015,
    "roe": 0.4474,
    "margine": 0.2285,
    "roa": 0.1839,
    "utileNetto": 53394000000,
    "ricavi": 233715000000,
    "patrimonioNetto": 119355000000
   },
   {
    "anno": 2016,
    "roe": 0.3562,
    "margine": 0.2119,
    "roa": 0.142,
    "utileNetto": 45687000000,
    "ricavi": 215639000000,
    "patrimonioNetto": 128249000000
   },
   {
    "anno": 2017,
    "roe": 0.3607,
    "margine": 0.2109,
    "roa": 0.1288,
    "utileNetto": 48351000000,
    "ricavi": 229234000000,
    "patrimonioNetto": 134047000000
   },
   {
    "anno": 2018,
    "roe": 0.5556,
    "margine": 0.2241,
    "roa": 0.1628,
    "utileNetto": 59531000000,
    "ricavi": 265595000000,
    "patrimonioNetto": 107147000000
   },
   {
    "anno": 2019,
    "roe": 0.6106,
    "margine": 0.2124,
    "roa": 0.1632,
    "utileNetto": 55256000000,
    "ricavi": 260174000000,
    "patrimonioNetto": 90488000000
   },
   {
    "anno": 2020,
    "roe": 0.8787,
    "margine": 0.2091,
    "roa": 0.1773,
    "utileNetto": 57411000000,
    "ricavi": 274515000000,
    "patrimonioNetto": 65339000000
   },
   {
    "anno": 2021,
    "roe": 1.5007,
    "margine": 0.2588,
    "roa": 0.2697,
    "utileNetto": 94680000000,
    "ricavi": 365817000000,
    "patrimonioNetto": 63090000000
   },
   {
    "anno": 2022,
    "roe": 1.9696,
    "margine": 0.2531,
    "roa": 0.2829,
    "utileNetto": 99803000000,
    "ricavi": 394328000000,
    "patrimonioNetto": 50672000000
   },
   {
    "anno": 2023,
    "roe": 1.5608,
    "margine": 0.2531,
    "roa": 0.2751,
    "utileNetto": 96995000000,
    "ricavi": 383285000000,
    "patrimonioNetto": 62146000000
   },
   {
    "anno": 2024,
    "roe": 1.6459,
    "margine": 0.2397,
    "roa": 0.2568,
    "utileNetto": 93736000000,
    "ricavi": 391035000000,
    "patrimonioNetto": 56950000000
   },
   {
    "anno": 2025,
    "roe": 1.5191,
    "margine": 0.2692,
    "roa": 0.3118,
    "utileNetto": 112010000000,
    "ricavi": 416161000000,
    "patrimonioNetto": 73733000000
   }
  ]
 },
 "MSFT": {
  "nome": "Microsoft",
  "anni": [
   {
    "anno": 2008,
    "roe": 0.4873,
    "margine": 0.2926,
    "roa": null,
    "utileNetto": 17681000000,
    "ricavi": 60420000000,
    "patrimonioNetto": 36286000000
   },
   {
    "anno": 2009,
    "roe": 0.3683,
    "margine": 0.2493,
    "roa": 0.1871,
    "utileNetto": 14569000000,
    "ricavi": 58437000000,
    "patrimonioNetto": 39558000000
   },
   {
    "anno": 2010,
    "roe": 0.4063,
    "margine": 0.3002,
    "roa": 0.2179,
    "utileNetto": 18760000000,
    "ricavi": 62484000000,
    "patrimonioNetto": 46175000000
   },
   {
    "anno": 2011,
    "roe": 0.4055,
    "margine": 0.331,
    "roa": 0.213,
    "utileNetto": 23150000000,
    "ricavi": 69943000000,
    "patrimonioNetto": 57083000000
   },
   {
    "anno": 2012,
    "roe": 0.2558,
    "margine": 0.2303,
    "roa": 0.14,
    "utileNetto": 16978000000,
    "ricavi": 73723000000,
    "patrimonioNetto": 66363000000
   },
   {
    "anno": 2013,
    "roe": 0.2769,
    "margine": 0.2808,
    "roa": 0.1535,
    "utileNetto": 21863000000,
    "ricavi": 77849000000,
    "patrimonioNetto": 78944000000
   },
   {
    "anno": 2014,
    "roe": 0.2459,
    "margine": 0.2542,
    "roa": 0.1281,
    "utileNetto": 22074000000,
    "ricavi": 86833000000,
    "patrimonioNetto": 89784000000
   },
   {
    "anno": 2015,
    "roe": 0.1523,
    "margine": 0.1303,
    "roa": 0.0699,
    "utileNetto": 12193000000,
    "ricavi": 93580000000,
    "patrimonioNetto": 80083000000
   },
   {
    "anno": 2016,
    "roe": 0.2472,
    "margine": 0.2253,
    "roa": 0.1062,
    "utileNetto": 20539000000,
    "ricavi": 91154000000,
    "patrimonioNetto": 83090000000
   },
   {
    "anno": 2017,
    "roe": 0.2906,
    "margine": 0.2639,
    "roa": 0.1018,
    "utileNetto": 25489000000,
    "ricavi": 96571000000,
    "patrimonioNetto": 87711000000
   },
   {
    "anno": 2018,
    "roe": 0.2003,
    "margine": 0.1502,
    "roa": 0.064,
    "utileNetto": 16571000000,
    "ricavi": 110360000000,
    "patrimonioNetto": 82718000000
   },
   {
    "anno": 2019,
    "roe": 0.3835,
    "margine": 0.3118,
    "roa": 0.1369,
    "utileNetto": 39240000000,
    "ricavi": 125843000000,
    "patrimonioNetto": 102330000000
   },
   {
    "anno": 2020,
    "roe": 0.3743,
    "margine": 0.3096,
    "roa": 0.147,
    "utileNetto": 44281000000,
    "ricavi": 143015000000,
    "patrimonioNetto": 118304000000
   },
   {
    "anno": 2021,
    "roe": 0.4315,
    "margine": 0.3645,
    "roa": 0.1836,
    "utileNetto": 61271000000,
    "ricavi": 168088000000,
    "patrimonioNetto": 141988000000
   },
   {
    "anno": 2022,
    "roe": 0.4368,
    "margine": 0.3669,
    "roa": 0.1994,
    "utileNetto": 72738000000,
    "ricavi": 198270000000,
    "patrimonioNetto": 166542000000
   },
   {
    "anno": 2023,
    "roe": 0.3509,
    "margine": 0.3415,
    "roa": 0.1756,
    "utileNetto": 72361000000,
    "ricavi": 211915000000,
    "patrimonioNetto": 206223000000
   },
   {
    "anno": 2024,
    "roe": 0.3283,
    "margine": 0.3596,
    "roa": 0.1721,
    "utileNetto": 88136000000,
    "ricavi": 245122000000,
    "patrimonioNetto": 268477000000
   },
   {
    "anno": 2025,
    "roe": 0.2965,
    "margine": 0.3615,
    "roa": 0.1645,
    "utileNetto": 101832000000,
    "ricavi": 281724000000,
    "patrimonioNetto": 343479000000
   },
   {
    "anno": 2026,
    "roe": 0.3023,
    "margine": 0.4031,
    "roa": 0.1764,
    "utileNetto": 133749000000,
    "ricavi": 331839000000,
    "patrimonioNetto": 442387000000
   }
  ]
 },
 "GOOGL": {
  "nome": "Alphabet",
  "anni": [
   {
    "anno": 2013,
    "roe": 0.1464,
    "margine": 0.2293,
    "roa": null,
    "utileNetto": 12733000000,
    "ricavi": 55519000000,
    "patrimonioNetto": 86977000000
   },
   {
    "anno": 2014,
    "roe": 0.1361,
    "margine": 0.2142,
    "roa": 0.1094,
    "utileNetto": 14136000000,
    "ricavi": 66001000000,
    "patrimonioNetto": 103860000000
   },
   {
    "anno": 2015,
    "roe": 0.1359,
    "margine": 0.218,
    "roa": 0.1109,
    "utileNetto": 16348000000,
    "ricavi": 74989000000,
    "patrimonioNetto": 120331000000
   },
   {
    "anno": 2016,
    "roe": 0.1401,
    "margine": 0.2158,
    "roa": 0.1163,
    "utileNetto": 19478000000,
    "ricavi": 90272000000,
    "patrimonioNetto": 139036000000
   },
   {
    "anno": 2017,
    "roe": 0.083,
    "margine": 0.1142,
    "roa": 0.0642,
    "utileNetto": 12662000000,
    "ricavi": 110855000000,
    "patrimonioNetto": 152502000000
   },
   {
    "anno": 2018,
    "roe": 0.173,
    "margine": 0.2246,
    "roa": 0.132,
    "utileNetto": 30736000000,
    "ricavi": 136819000000,
    "patrimonioNetto": 177628000000
   },
   {
    "anno": 2019,
    "roe": 0.1705,
    "margine": 0.2122,
    "roa": 0.1245,
    "utileNetto": 34343000000,
    "ricavi": 161857000000,
    "patrimonioNetto": 201442000000
   },
   {
    "anno": 2020,
    "roe": 0.1809,
    "margine": 0.2206,
    "roa": 0.126,
    "utileNetto": 40269000000,
    "ricavi": 182527000000,
    "patrimonioNetto": 222544000000
   },
   {
    "anno": 2021,
    "roe": 0.3022,
    "margine": 0.2951,
    "roa": 0.2116,
    "utileNetto": 76033000000,
    "ricavi": 257637000000,
    "patrimonioNetto": 251635000000
   },
   {
    "anno": 2022,
    "roe": 0.2341,
    "margine": 0.212,
    "roa": 0.1642,
    "utileNetto": 59972000000,
    "ricavi": 282836000000,
    "patrimonioNetto": 256144000000
   },
   {
    "anno": 2023,
    "roe": 0.2604,
    "margine": 0.2401,
    "roa": 0.1834,
    "utileNetto": 73795000000,
    "ricavi": 307394000000,
    "patrimonioNetto": 283379000000
   },
   {
    "anno": 2024,
    "roe": 0.308,
    "margine": 0.286,
    "roa": 0.2224,
    "utileNetto": 100118000000,
    "ricavi": 350018000000,
    "patrimonioNetto": 325084000000
   },
   {
    "anno": 2025,
    "roe": 0.3183,
    "margine": 0.3281,
    "roa": 0.222,
    "utileNetto": 132170000000,
    "ricavi": 402836000000,
    "patrimonioNetto": 415265000000
   }
  ]
 },
 "AMZN": {
  "nome": "Amazon",
  "anni": [
   {
    "anno": 2007,
    "roe": 0.3977,
    "margine": 0.0321,
    "roa": null,
    "utileNetto": 476000000,
    "ricavi": 14835000000,
    "patrimonioNetto": 1197000000
   },
   {
    "anno": 2008,
    "roe": 0.2414,
    "margine": 0.0337,
    "roa": 0.0776,
    "utileNetto": 645000000,
    "ricavi": 19166000000,
    "patrimonioNetto": 2672000000
   },
   {
    "anno": 2009,
    "roe": 0.1716,
    "margine": 0.0368,
    "roa": 0.0653,
    "utileNetto": 902000000,
    "ricavi": 24509000000,
    "patrimonioNetto": 5257000000
   },
   {
    "anno": 2010,
    "roe": 0.1678,
    "margine": 0.0337,
    "roa": 0.0613,
    "utileNetto": 1152000000,
    "ricavi": 34204000000,
    "patrimonioNetto": 6864000000
   },
   {
    "anno": 2011,
    "roe": 0.0813,
    "margine": 0.0131,
    "roa": 0.025,
    "utileNetto": 631000000,
    "ricavi": 48077000000,
    "patrimonioNetto": 7757000000
   },
   {
    "anno": 2012,
    "roe": -0.0048,
    "margine": -0.0006,
    "roa": -0.0012,
    "utileNetto": -39000000,
    "ricavi": 61093000000,
    "patrimonioNetto": 8192000000
   },
   {
    "anno": 2013,
    "roe": 0.0281,
    "margine": 0.0037,
    "roa": 0.0068,
    "utileNetto": 274000000,
    "ricavi": 74452000000,
    "patrimonioNetto": 9746000000
   },
   {
    "anno": 2014,
    "roe": -0.0224,
    "margine": -0.0027,
    "roa": -0.0044,
    "utileNetto": -241000000,
    "ricavi": 88988000000,
    "patrimonioNetto": 10741000000
   },
   {
    "anno": 2015,
    "roe": 0.0445,
    "margine": 0.0056,
    "roa": 0.0092,
    "utileNetto": 596000000,
    "ricavi": 107006000000,
    "patrimonioNetto": 13384000000
   },
   {
    "anno": 2016,
    "roe": 0.1229,
    "margine": 0.0174,
    "roa": 0.0284,
    "utileNetto": 2371000000,
    "ricavi": 135987000000,
    "patrimonioNetto": 19285000000
   },
   {
    "anno": 2017,
    "roe": 0.1095,
    "margine": 0.0171,
    "roa": 0.0231,
    "utileNetto": 3033000000,
    "ricavi": 177866000000,
    "patrimonioNetto": 27709000000
   },
   {
    "anno": 2018,
    "roe": 0.2313,
    "margine": 0.0433,
    "roa": 0.0619,
    "utileNetto": 10073000000,
    "ricavi": 232887000000,
    "patrimonioNetto": 43549000000
   },
   {
    "anno": 2019,
    "roe": 0.1867,
    "margine": 0.0413,
    "roa": 0.0514,
    "utileNetto": 11588000000,
    "ricavi": 280522000000,
    "patrimonioNetto": 62060000000
   },
   {
    "anno": 2020,
    "roe": 0.2284,
    "margine": 0.0553,
    "roa": 0.0664,
    "utileNetto": 21331000000,
    "ricavi": 386064000000,
    "patrimonioNetto": 93404000000
   },
   {
    "anno": 2021,
    "roe": 0.2413,
    "margine": 0.071,
    "roa": 0.0793,
    "utileNetto": 33364000000,
    "ricavi": 469822000000,
    "patrimonioNetto": 138245000000
   },
   {
    "anno": 2022,
    "roe": -0.0186,
    "margine": -0.0053,
    "roa": -0.0059,
    "utileNetto": -2722000000,
    "ricavi": 513983000000,
    "patrimonioNetto": 146043000000
   },
   {
    "anno": 2023,
    "roe": 0.1507,
    "margine": 0.0529,
    "roa": 0.0576,
    "utileNetto": 30425000000,
    "ricavi": 574785000000,
    "patrimonioNetto": 201875000000
   },
   {
    "anno": 2024,
    "roe": 0.2072,
    "margine": 0.0929,
    "roa": 0.0948,
    "utileNetto": 59248000000,
    "ricavi": 637959000000,
    "patrimonioNetto": 285970000000
   },
   {
    "anno": 2025,
    "roe": 0.1889,
    "margine": 0.1083,
    "roa": 0.0949,
    "utileNetto": 77670000000,
    "ricavi": 716924000000,
    "patrimonioNetto": 411065000000
   }
  ]
 },
 "NVDA": {
  "nome": "NVIDIA",
  "anni": [
   {
    "anno": 2008,
    "roe": 0.3047,
    "margine": 0.1946,
    "roa": null,
    "utileNetto": 797645000,
    "ricavi": 4097860000,
    "patrimonioNetto": 2617912000
   },
   {
    "anno": 2009,
    "roe": -0.0125,
    "margine": -0.0088,
    "roa": -0.009,
    "utileNetto": -30041000,
    "ricavi": 3424859000,
    "patrimonioNetto": 2394652000
   },
   {
    "anno": 2010,
    "roe": -0.0255,
    "margine": -0.0204,
    "roa": -0.019,
    "utileNetto": -67987000,
    "ricavi": 3326445000,
    "patrimonioNetto": 2665140000
   },
   {
    "anno": 2011,
    "roe": 0.0796,
    "margine": 0.0714,
    "roa": 0.0563,
    "utileNetto": 253146000,
    "ricavi": 3543309000,
    "patrimonioNetto": 3181462000
   },
   {
    "anno": 2012,
    "roe": 0.1402,
    "margine": 0.1453,
    "roa": 0.1046,
    "utileNetto": 581090000,
    "ricavi": 3997930000,
    "patrimonioNetto": 4145724000
   },
   {
    "anno": 2013,
    "roe": 0.1165,
    "margine": 0.1314,
    "roa": 0.0877,
    "utileNetto": 562536000,
    "ricavi": 4280159000,
    "patrimonioNetto": 4827000000
   },
   {
    "anno": 2014,
    "roe": 0.0988,
    "margine": 0.1065,
    "roa": 0.0607,
    "utileNetto": 440000000,
    "ricavi": 4130000000,
    "patrimonioNetto": 4455000000
   },
   {
    "anno": 2015,
    "roe": 0.1428,
    "margine": 0.1348,
    "roa": 0.0876,
    "utileNetto": 631000000,
    "ricavi": 4682000000,
    "patrimonioNetto": 4418000000
   },
   {
    "anno": 2016,
    "roe": 0.1374,
    "margine": 0.1226,
    "roa": 0.0833,
    "utileNetto": 614000000,
    "ricavi": 5010000000,
    "patrimonioNetto": 4469000000
   },
   {
    "anno": 2017,
    "roe": 0.2891,
    "margine": 0.2411,
    "roa": 0.1693,
    "utileNetto": 1666000000,
    "ricavi": 6910000000,
    "patrimonioNetto": 5762000000
   },
   {
    "anno": 2018,
    "roe": 0.4078,
    "margine": 0.3137,
    "roa": 0.2711,
    "utileNetto": 3047000000,
    "ricavi": 9714000000,
    "patrimonioNetto": 7471000000
   },
   {
    "anno": 2019,
    "roe": 0.4433,
    "margine": 0.3534,
    "roa": 0.3115,
    "utileNetto": 4141000000,
    "ricavi": 11716000000,
    "patrimonioNetto": 9342000000
   },
   {
    "anno": 2020,
    "roe": 0.2291,
    "margine": 0.2561,
    "roa": 0.1615,
    "utileNetto": 2796000000,
    "ricavi": 10918000000,
    "patrimonioNetto": 12204000000
   },
   {
    "anno": 2021,
    "roe": 0.2564,
    "margine": 0.2598,
    "roa": 0.1505,
    "utileNetto": 4332000000,
    "ricavi": 16675000000,
    "patrimonioNetto": 16893000000
   },
   {
    "anno": 2022,
    "roe": 0.3665,
    "margine": 0.3623,
    "roa": 0.2207,
    "utileNetto": 9752000000,
    "ricavi": 26914000000,
    "patrimonioNetto": 26612000000
   },
   {
    "anno": 2023,
    "roe": 0.1976,
    "margine": 0.1619,
    "roa": 0.1061,
    "utileNetto": 4368000000,
    "ricavi": 26974000000,
    "patrimonioNetto": 22101000000
   },
   {
    "anno": 2024,
    "roe": 0.6924,
    "margine": 0.4885,
    "roa": 0.4528,
    "utileNetto": 29760000000,
    "ricavi": 60922000000,
    "patrimonioNetto": 42978000000
   },
   {
    "anno": 2025,
    "roe": 0.9187,
    "margine": 0.5585,
    "roa": 0.653,
    "utileNetto": 72880000000,
    "ricavi": 130497000000,
    "patrimonioNetto": 79327000000
   },
   {
    "anno": 2026,
    "roe": 0.7633,
    "margine": 0.556,
    "roa": 0.5806,
    "utileNetto": 120067000000,
    "ricavi": 215938000000,
    "patrimonioNetto": 157293000000
   }
  ]
 },
 "TSLA": {
  "nome": "Tesla",
  "anni": [
   {
    "anno": 2009,
    "roe": null,
    "margine": -0.4979,
    "roa": null,
    "utileNetto": -55740000,
    "ricavi": 111943000,
    "patrimonioNetto": -253523000
   },
   {
    "anno": 2010,
    "roe": -0.7454,
    "margine": -1.3219,
    "roa": -0.3997,
    "utileNetto": -154328000,
    "ricavi": 116744000,
    "patrimonioNetto": 207048000
   },
   {
    "anno": 2011,
    "roe": -1.1355,
    "margine": -1.2456,
    "roa": -0.3566,
    "utileNetto": -254411000,
    "ricavi": 204242000,
    "patrimonioNetto": 224045000
   },
   {
    "anno": 2012,
    "roe": -3.1773,
    "margine": -0.9588,
    "roa": -0.3556,
    "utileNetto": -396213000,
    "ricavi": 413256000,
    "patrimonioNetto": 124700000
   },
   {
    "anno": 2013,
    "roe": -0.1109,
    "margine": -0.0368,
    "roa": -0.0306,
    "utileNetto": -74014000,
    "ricavi": 2013496000,
    "patrimonioNetto": 667120000
   },
   {
    "anno": 2014,
    "roe": -0.3225,
    "margine": -0.0919,
    "roa": -0.0504,
    "utileNetto": -294040000,
    "ricavi": 3198356000,
    "patrimonioNetto": 911710000
   },
   {
    "anno": 2015,
    "roe": -0.82,
    "margine": -0.2196,
    "roa": -0.1101,
    "utileNetto": -888663000,
    "ricavi": 4046025000,
    "patrimonioNetto": 1083704000
   },
   {
    "anno": 2016,
    "roe": -0.1219,
    "margine": -0.0964,
    "roa": -0.0298,
    "utileNetto": -674914000,
    "ricavi": 7000132000,
    "patrimonioNetto": 5538000000
   },
   {
    "anno": 2017,
    "roe": -0.3749,
    "margine": -0.1669,
    "roa": -0.0685,
    "utileNetto": -1962000000,
    "ricavi": 11759000000,
    "patrimonioNetto": 5234000000
   },
   {
    "anno": 2018,
    "roe": -0.1695,
    "margine": -0.0455,
    "roa": -0.0328,
    "utileNetto": -976000000,
    "ricavi": 21461000000,
    "patrimonioNetto": 5757000000
   },
   {
    "anno": 2019,
    "roe": -0.1154,
    "margine": -0.0351,
    "roa": -0.0251,
    "utileNetto": -862000000,
    "ricavi": 24578000000,
    "patrimonioNetto": 7467000000
   },
   {
    "anno": 2020,
    "roe": 0.0312,
    "margine": 0.0229,
    "roa": 0.0138,
    "utileNetto": 721000000,
    "ricavi": 31536000000,
    "patrimonioNetto": 23075000000
   },
   {
    "anno": 2021,
    "roe": 0.1779,
    "margine": 0.1025,
    "roa": 0.0888,
    "utileNetto": 5519000000,
    "ricavi": 53823000000,
    "patrimonioNetto": 31015000000
   },
   {
    "anno": 2022,
    "roe": 0.276,
    "margine": 0.1541,
    "roa": 0.1525,
    "utileNetto": 12556000000,
    "ricavi": 81462000000,
    "patrimonioNetto": 45489000000
   },
   {
    "anno": 2023,
    "roe": 0.2367,
    "margine": 0.155,
    "roa": 0.1407,
    "utileNetto": 14997000000,
    "ricavi": 96773000000,
    "patrimonioNetto": 63367000000
   },
   {
    "anno": 2024,
    "roe": 0.0973,
    "margine": 0.0726,
    "roa": 0.0581,
    "utileNetto": 7091000000,
    "ricavi": 97690000000,
    "patrimonioNetto": 72913000000
   },
   {
    "anno": 2025,
    "roe": 0.0462,
    "margine": 0.04,
    "roa": 0.0275,
    "utileNetto": 3794000000,
    "ricavi": 94827000000,
    "patrimonioNetto": 82137000000
   }
  ]
 },
 "META": {
  "nome": "Meta",
  "anni": [
   {
    "anno": 2011,
    "roe": 0.2041,
    "margine": 0.2695,
    "roa": 0.158,
    "utileNetto": 1000000000,
    "ricavi": 3711000000,
    "patrimonioNetto": 4899000000
   },
   {
    "anno": 2012,
    "roe": 0.0045,
    "margine": 0.0104,
    "roa": 0.0035,
    "utileNetto": 53000000,
    "ricavi": 5089000000,
    "patrimonioNetto": 11755000000
   },
   {
    "anno": 2013,
    "roe": 0.097,
    "margine": 0.1905,
    "roa": 0.0838,
    "utileNetto": 1500000000,
    "ricavi": 7872000000,
    "patrimonioNetto": 15470000000
   },
   {
    "anno": 2014,
    "roe": 0.0814,
    "margine": 0.2358,
    "roa": 0.0736,
    "utileNetto": 2940000000,
    "ricavi": 12466000000,
    "patrimonioNetto": 36096000000
   },
   {
    "anno": 2015,
    "roe": 0.0834,
    "margine": 0.2057,
    "roa": 0.0746,
    "utileNetto": 3688000000,
    "ricavi": 17928000000,
    "patrimonioNetto": 44218000000
   },
   {
    "anno": 2016,
    "roe": 0.1726,
    "margine": 0.3697,
    "roa": 0.1573,
    "utileNetto": 10217000000,
    "ricavi": 27638000000,
    "patrimonioNetto": 59194000000
   },
   {
    "anno": 2017,
    "roe": 0.2143,
    "margine": 0.392,
    "roa": 0.1885,
    "utileNetto": 15934000000,
    "ricavi": 40653000000,
    "patrimonioNetto": 74347000000
   },
   {
    "anno": 2018,
    "roe": 0.2628,
    "margine": 0.396,
    "roa": 0.2272,
    "utileNetto": 22112000000,
    "ricavi": 55838000000,
    "patrimonioNetto": 84127000000
   },
   {
    "anno": 2019,
    "roe": 0.1829,
    "margine": 0.2615,
    "roa": 0.1386,
    "utileNetto": 18485000000,
    "ricavi": 70697000000,
    "patrimonioNetto": 101054000000
   },
   {
    "anno": 2020,
    "roe": 0.2272,
    "margine": 0.339,
    "roa": 0.1829,
    "utileNetto": 29146000000,
    "ricavi": 85965000000,
    "patrimonioNetto": 128290000000
   },
   {
    "anno": 2021,
    "roe": 0.3153,
    "margine": 0.3338,
    "roa": 0.2372,
    "utileNetto": 39370000000,
    "ricavi": 117929000000,
    "patrimonioNetto": 124879000000
   },
   {
    "anno": 2022,
    "roe": 0.1845,
    "margine": 0.199,
    "roa": 0.1249,
    "utileNetto": 23200000000,
    "ricavi": 116609000000,
    "patrimonioNetto": 125713000000
   },
   {
    "anno": 2023,
    "roe": 0.2553,
    "margine": 0.2898,
    "roa": 0.1703,
    "utileNetto": 39098000000,
    "ricavi": 134902000000,
    "patrimonioNetto": 153168000000
   },
   {
    "anno": 2024,
    "roe": 0.3414,
    "margine": 0.3791,
    "roa": 0.2259,
    "utileNetto": 62360000000,
    "ricavi": 164501000000,
    "patrimonioNetto": 182637000000
   },
   {
    "anno": 2025,
    "roe": 0.2783,
    "margine": 0.3008,
    "roa": 0.1652,
    "utileNetto": 60458000000,
    "ricavi": 200966000000,
    "patrimonioNetto": 217243000000
   }
  ]
 },
 "JPM": {
  "nome": "JPMorgan Chase",
  "anni": [
   {
    "anno": 2007,
    "roe": 0.1247,
    "margine": 0.2153,
    "roa": null,
    "utileNetto": 15365000000,
    "ricavi": 71372000000,
    "patrimonioNetto": 123221000000
   },
   {
    "anno": 2008,
    "roe": 0.0336,
    "margine": 0.0833,
    "roa": 0.0026,
    "utileNetto": 5605000000,
    "ricavi": 67252000000,
    "patrimonioNetto": 166884000000
   },
   {
    "anno": 2009,
    "roe": 0.0729,
    "margine": 0.1168,
    "roa": 0.0055,
    "utileNetto": 11728000000,
    "ricavi": 100434000000,
    "patrimonioNetto": 160845000000
   },
   {
    "anno": 2010,
    "roe": 0.0986,
    "margine": 0.1691,
    "roa": 0.0082,
    "utileNetto": 17370000000,
    "ricavi": 102694000000,
    "patrimonioNetto": 176106000000
   },
   {
    "anno": 2011,
    "roe": 0.1034,
    "margine": 0.1952,
    "roa": 0.0084,
    "utileNetto": 18976000000,
    "ricavi": 97234000000,
    "patrimonioNetto": 183573000000
   },
   {
    "anno": 2012,
    "roe": 0.1043,
    "margine": 0.2194,
    "roa": 0.009,
    "utileNetto": 21284000000,
    "ricavi": 97031000000,
    "patrimonioNetto": 204069000000
   },
   {
    "anno": 2013,
    "roe": 0.0848,
    "margine": 0.1837,
    "roa": 0.0074,
    "utileNetto": 17886000000,
    "ricavi": 97367000000,
    "patrimonioNetto": 210857000000
   },
   {
    "anno": 2014,
    "roe": 0.0938,
    "margine": 0.2286,
    "roa": 0.0085,
    "utileNetto": 21745000000,
    "ricavi": 95112000000,
    "patrimonioNetto": 231727000000
   },
   {
    "anno": 2015,
    "roe": 0.0987,
    "margine": 0.2613,
    "roa": 0.0104,
    "utileNetto": 24442000000,
    "ricavi": 93543000000,
    "patrimonioNetto": 247573000000
   },
   {
    "anno": 2016,
    "roe": 0.0973,
    "margine": 0.2561,
    "roa": 0.0099,
    "utileNetto": 24733000000,
    "ricavi": 96569000000,
    "patrimonioNetto": 254190000000
   },
   {
    "anno": 2017,
    "roe": 0.0956,
    "margine": 0.2427,
    "roa": 0.0096,
    "utileNetto": 24441000000,
    "ricavi": 100705000000,
    "patrimonioNetto": 255693000000
   },
   {
    "anno": 2018,
    "roe": 0.1266,
    "margine": 0.2985,
    "roa": 0.0124,
    "utileNetto": 32474000000,
    "ricavi": 108783000000,
    "patrimonioNetto": 256515000000
   },
   {
    "anno": 2019,
    "roe": 0.1394,
    "margine": 0.3148,
    "roa": 0.0136,
    "utileNetto": 36431000000,
    "ricavi": 115720000000,
    "patrimonioNetto": 261330000000
   },
   {
    "anno": 2020,
    "roe": 0.1043,
    "margine": 0.2429,
    "roa": 0.0086,
    "utileNetto": 29131000000,
    "ricavi": 119951000000,
    "patrimonioNetto": 279354000000
   },
   {
    "anno": 2021,
    "roe": 0.1643,
    "margine": 0.3973,
    "roa": 0.0129,
    "utileNetto": 48334000000,
    "ricavi": 121649000000,
    "patrimonioNetto": 294127000000
   },
   {
    "anno": 2022,
    "roe": 0.1289,
    "margine": 0.2928,
    "roa": 0.0103,
    "utileNetto": 37676000000,
    "ricavi": 128695000000,
    "patrimonioNetto": 292332000000
   },
   {
    "anno": 2023,
    "roe": 0.1511,
    "margine": 0.3134,
    "roa": 0.0128,
    "utileNetto": 49552000000,
    "ricavi": 158104000000,
    "patrimonioNetto": 327878000000
   },
   {
    "anno": 2024,
    "roe": 0.1696,
    "margine": 0.3293,
    "roa": 0.0146,
    "utileNetto": 58471000000,
    "ricavi": 177556000000,
    "patrimonioNetto": 344758000000
   },
   {
    "anno": 2025,
    "roe": 0.1574,
    "margine": 0.3127,
    "roa": 0.0129,
    "utileNetto": 57048000000,
    "ricavi": 182447000000,
    "patrimonioNetto": 362438000000
   }
  ]
 },
 "BRK-B": {
  "nome": "Berkshire Hathaway",
  "anni": [
   {
    "anno": 2008,
    "roe": 0.0457,
    "margine": 0.0463,
    "roa": 0.0187,
    "utileNetto": 4994000000,
    "ricavi": 107786000000,
    "patrimonioNetto": 109267000000
   },
   {
    "anno": 2009,
    "roe": 0.0593,
    "margine": 0.0716,
    "roa": 0.0271,
    "utileNetto": 8055000000,
    "ricavi": 112493000000,
    "patrimonioNetto": 135785000000
   },
   {
    "anno": 2010,
    "roe": 0.0796,
    "margine": 0.0952,
    "roa": 0.0348,
    "utileNetto": 12967000000,
    "ricavi": 136185000000,
    "patrimonioNetto": 162934000000
   },
   {
    "anno": 2011,
    "roe": 0.0607,
    "margine": 0.0714,
    "roa": 0.0261,
    "utileNetto": 10254000000,
    "ricavi": 143688000000,
    "patrimonioNetto": 168961000000
   },
   {
    "anno": 2012,
    "roe": 0.0774,
    "margine": 0.0912,
    "roa": 0.0347,
    "utileNetto": 14824000000,
    "ricavi": 162463000000,
    "patrimonioNetto": 191588000000
   },
   {
    "anno": 2013,
    "roe": 0.0868,
    "margine": 0.1069,
    "roa": 0.0402,
    "utileNetto": 19476000000,
    "ricavi": 182150000000,
    "patrimonioNetto": 224485000000
   },
   {
    "anno": 2014,
    "roe": 0.0821,
    "margine": 0.1021,
    "roa": 0.0378,
    "utileNetto": 19872000000,
    "ricavi": 194699000000,
    "patrimonioNetto": 242096000000
   },
   {
    "anno": 2015,
    "roe": 0.0935,
    "margine": 0.1142,
    "roa": 0.0436,
    "utileNetto": 24083000000,
    "ricavi": 210943000000,
    "patrimonioNetto": 257696000000
   },
   {
    "anno": 2016,
    "roe": 0.0843,
    "margine": 0.1119,
    "roa": 0.0388,
    "utileNetto": 24074000000,
    "ricavi": 215114000000,
    "patrimonioNetto": 285428000000
   },
   {
    "anno": 2017,
    "roe": 0.1277,
    "margine": 0.1873,
    "roa": 0.064,
    "utileNetto": 44940000000,
    "ricavi": 239933000000,
    "patrimonioNetto": 351954000000
   },
   {
    "anno": 2018,
    "roe": 0.0114,
    "margine": 0.0162,
    "roa": 0.0057,
    "utileNetto": 4021000000,
    "ricavi": 247837000000,
    "patrimonioNetto": 352500000000
   },
   {
    "anno": 2019,
    "roe": 0.19,
    "margine": 0.3198,
    "roa": 0.0996,
    "utileNetto": 81417000000,
    "ricavi": 254616000000,
    "patrimonioNetto": 428563000000
   },
   {
    "anno": 2020,
    "roe": 0.0956,
    "margine": 0.1731,
    "roa": 0.0487,
    "utileNetto": 42521000000,
    "ricavi": 245579000000,
    "patrimonioNetto": 444908000000
   },
   {
    "anno": 2021,
    "roe": 0.1762,
    "margine": 0.3256,
    "roa": 0.0937,
    "utileNetto": 89937000000,
    "ricavi": 276185000000,
    "patrimonioNetto": 510299000000
   },
   {
    "anno": 2022,
    "roe": -0.0472,
    "margine": -0.0754,
    "roa": -0.024,
    "utileNetto": -22759000000,
    "ricavi": 302020000000,
    "patrimonioNetto": 481681000000
   },
   {
    "anno": 2023,
    "roe": 0.1696,
    "margine": 0.264,
    "roa": 0.0899,
    "utileNetto": 96223000000,
    "ricavi": 364482000000,
    "patrimonioNetto": 567509000000
   },
   {
    "anno": 2024,
    "roe": 0.137,
    "margine": 0.2396,
    "roa": 0.0771,
    "utileNetto": 88995000000,
    "ricavi": 371433000000,
    "patrimonioNetto": 649368000000
   },
   {
    "anno": 2025,
    "roe": 0.0933,
    "margine": 0.1803,
    "roa": 0.0548,
    "utileNetto": 66968000000,
    "ricavi": 371444000000,
    "patrimonioNetto": 717419000000
   }
  ]
 },
 "KO": {
  "nome": "Coca-Cola",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": null,
    "roa": null,
    "utileNetto": 5981000000,
    "ricavi": null,
    "patrimonioNetto": 0
   },
   {
    "anno": 2008,
    "roe": 0.2837,
    "margine": null,
    "roa": 0.1433,
    "utileNetto": 5807000000,
    "ricavi": null,
    "patrimonioNetto": 20472000000
   },
   {
    "anno": 2009,
    "roe": 0.2752,
    "margine": null,
    "roa": 0.1402,
    "utileNetto": 6824000000,
    "ricavi": null,
    "patrimonioNetto": 24799000000
   },
   {
    "anno": 2010,
    "roe": 0.3802,
    "margine": null,
    "roa": 0.1616,
    "utileNetto": 11787000000,
    "ricavi": null,
    "patrimonioNetto": 31003000000
   },
   {
    "anno": 2011,
    "roe": 0.2713,
    "margine": null,
    "roa": 0.1073,
    "utileNetto": 8584000000,
    "ricavi": null,
    "patrimonioNetto": 31635000000
   },
   {
    "anno": 2012,
    "roe": 0.2751,
    "margine": null,
    "roa": 0.1047,
    "utileNetto": 9019000000,
    "ricavi": null,
    "patrimonioNetto": 32790000000
   },
   {
    "anno": 2013,
    "roe": 0.2588,
    "margine": null,
    "roa": 0.0953,
    "utileNetto": 8584000000,
    "ricavi": null,
    "patrimonioNetto": 33173000000
   },
   {
    "anno": 2014,
    "roe": 0.2341,
    "margine": null,
    "roa": 0.0771,
    "utileNetto": 7098000000,
    "ricavi": null,
    "patrimonioNetto": 30320000000
   },
   {
    "anno": 2015,
    "roe": 0.2877,
    "margine": null,
    "roa": 0.0817,
    "utileNetto": 7351000000,
    "ricavi": null,
    "patrimonioNetto": 25554000000
   },
   {
    "anno": 2016,
    "roe": 0.283,
    "margine": 0.1559,
    "roa": 0.0748,
    "utileNetto": 6527000000,
    "ricavi": 41863000000,
    "patrimonioNetto": 23062000000
   },
   {
    "anno": 2017,
    "roe": 0.0731,
    "margine": 0.0345,
    "roa": 0.0142,
    "utileNetto": 1248000000,
    "ricavi": 36212000000,
    "patrimonioNetto": 17072000000
   },
   {
    "anno": 2018,
    "roe": 0.3789,
    "margine": 0.1876,
    "roa": 0.0773,
    "utileNetto": 6434000000,
    "ricavi": 34300000000,
    "patrimonioNetto": 16981000000
   },
   {
    "anno": 2019,
    "roe": 0.4699,
    "margine": 0.2394,
    "roa": 0.1033,
    "utileNetto": 8920000000,
    "ricavi": 37266000000,
    "patrimonioNetto": 18981000000
   },
   {
    "anno": 2020,
    "roe": 0.4014,
    "margine": 0.2347,
    "roa": 0.0887,
    "utileNetto": 7747000000,
    "ricavi": 33014000000,
    "patrimonioNetto": 19299000000
   },
   {
    "anno": 2021,
    "roe": 0.4248,
    "margine": 0.2528,
    "roa": 0.1036,
    "utileNetto": 9771000000,
    "ricavi": 38655000000,
    "patrimonioNetto": 22999000000
   },
   {
    "anno": 2022,
    "roe": 0.3959,
    "margine": 0.2219,
    "roa": 0.1029,
    "utileNetto": 9542000000,
    "ricavi": 43004000000,
    "patrimonioNetto": 24105000000
   },
   {
    "anno": 2023,
    "roe": 0.413,
    "margine": 0.2342,
    "roa": 0.1097,
    "utileNetto": 10714000000,
    "ricavi": 45754000000,
    "patrimonioNetto": 25941000000
   },
   {
    "anno": 2024,
    "roe": 0.4277,
    "margine": 0.2259,
    "roa": 0.1057,
    "utileNetto": 10631000000,
    "ricavi": 47061000000,
    "patrimonioNetto": 24856000000
   },
   {
    "anno": 2025,
    "roe": 0.4074,
    "margine": 0.2734,
    "roa": 0.125,
    "utileNetto": 13107000000,
    "ricavi": 47941000000,
    "patrimonioNetto": 32169000000
   }
  ]
 },
 "JNJ": {
  "nome": "Johnson & Johnson",
  "anni": [
   {
    "anno": 2007,
    "roe": 0.2441,
    "margine": null,
    "roa": null,
    "utileNetto": 10576000000,
    "ricavi": null,
    "patrimonioNetto": 43319000000
   },
   {
    "anno": 2008,
    "roe": 0.3046,
    "margine": null,
    "roa": 0.1525,
    "utileNetto": 12949000000,
    "ricavi": null,
    "patrimonioNetto": 42511000000
   },
   {
    "anno": 2010,
    "roe": 0.2425,
    "margine": null,
    "roa": 0.1295,
    "utileNetto": 12266000000,
    "ricavi": null,
    "patrimonioNetto": 50588000000
   },
   {
    "anno": 2011,
    "roe": 0.2357,
    "margine": null,
    "roa": 0.1296,
    "utileNetto": 13334000000,
    "ricavi": null,
    "patrimonioNetto": 56579000000
   },
   {
    "anno": 2012,
    "roe": 0.1674,
    "margine": null,
    "roa": 0.0894,
    "utileNetto": 10853000000,
    "ricavi": null,
    "patrimonioNetto": 64826000000
   },
   {
    "anno": 2013,
    "roe": 0.1868,
    "margine": null,
    "roa": 0.1042,
    "utileNetto": 13831000000,
    "ricavi": null,
    "patrimonioNetto": 74053000000
   },
   {
    "anno": 2014,
    "roe": 0.234,
    "margine": null,
    "roa": 0.1252,
    "utileNetto": 16323000000,
    "ricavi": null,
    "patrimonioNetto": 69752000000
   },
   {
    "anno": 2016,
    "roe": 0.2166,
    "margine": null,
    "roa": 0.1155,
    "utileNetto": 15409000000,
    "ricavi": null,
    "patrimonioNetto": 71150000000
   },
   {
    "anno": 2017,
    "roe": 0.0216,
    "margine": 0.017,
    "roa": 0.0083,
    "utileNetto": 1300000000,
    "ricavi": 76450000000,
    "patrimonioNetto": 60160000000
   },
   {
    "anno": 2018,
    "roe": 0.256,
    "margine": 0.1875,
    "roa": 0.1,
    "utileNetto": 15297000000,
    "ricavi": 81581000000,
    "patrimonioNetto": 59752000000
   },
   {
    "anno": 2019,
    "roe": 0.2542,
    "margine": 0.1842,
    "roa": 0.0959,
    "utileNetto": 15119000000,
    "ricavi": 82059000000,
    "patrimonioNetto": 59471000000
   },
   {
    "anno": 2021,
    "roe": 0.2325,
    "margine": 0.1782,
    "roa": 0.0841,
    "utileNetto": 14714000000,
    "ricavi": 82584000000,
    "patrimonioNetto": 63278000000
   },
   {
    "anno": 2022,
    "roe": 0.282,
    "margine": 0.2652,
    "roa": 0.1147,
    "utileNetto": 20878000000,
    "ricavi": 78740000000,
    "patrimonioNetto": 74023000000
   },
   {
    "anno": 2023,
    "roe": 0.4577,
    "margine": 0.4128,
    "roa": 0.2098,
    "utileNetto": 35153000000,
    "ricavi": 85159000000,
    "patrimonioNetto": 76804000000
   },
   {
    "anno": 2024,
    "roe": 0.1968,
    "margine": 0.1584,
    "roa": 0.0781,
    "utileNetto": 14066000000,
    "ricavi": 88821000000,
    "patrimonioNetto": 71490000000
   },
   {
    "anno": 2025,
    "roe": 0.3287,
    "margine": 0.2846,
    "roa": 0.1346,
    "utileNetto": 26804000000,
    "ricavi": 94193000000,
    "patrimonioNetto": 81544000000
   }
  ]
 },
 "V": {
  "nome": "Visa",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": -0.2997,
    "roa": null,
    "utileNetto": -1076000000,
    "ricavi": 3590000000,
    "patrimonioNetto": -463000000
   },
   {
    "anno": 2008,
    "roe": 0.038,
    "margine": 0.1284,
    "roa": 0.023,
    "utileNetto": 804000000,
    "ricavi": 6263000000,
    "patrimonioNetto": 21141000000
   },
   {
    "anno": 2009,
    "roe": 0.1015,
    "margine": 0.3405,
    "roa": 0.0729,
    "utileNetto": 2353000000,
    "ricavi": 6911000000,
    "patrimonioNetto": 23193000000
   },
   {
    "anno": 2010,
    "roe": 0.1186,
    "margine": 0.3678,
    "roa": 0.0888,
    "utileNetto": 2966000000,
    "ricavi": 8065000000,
    "patrimonioNetto": 25014000000
   },
   {
    "anno": 2011,
    "roe": 0.1381,
    "margine": 0.3973,
    "roa": 0.105,
    "utileNetto": 3650000000,
    "ricavi": 9188000000,
    "patrimonioNetto": 26437000000
   },
   {
    "anno": 2012,
    "roe": 0.0776,
    "margine": 0.2057,
    "roa": 0.0536,
    "utileNetto": 2144000000,
    "ricavi": 10421000000,
    "patrimonioNetto": 27630000000
   },
   {
    "anno": 2013,
    "roe": 0.1853,
    "margine": 0.4228,
    "roa": 0.1385,
    "utileNetto": 4980000000,
    "ricavi": 11778000000,
    "patrimonioNetto": 26870000000
   },
   {
    "anno": 2014,
    "roe": 0.1984,
    "margine": 0.4281,
    "roa": 0.141,
    "utileNetto": 5438000000,
    "ricavi": 12702000000,
    "patrimonioNetto": 27413000000
   },
   {
    "anno": 2015,
    "roe": 0.2121,
    "margine": 0.4559,
    "roa": 0.1607,
    "utileNetto": 6328000000,
    "ricavi": 13880000000,
    "patrimonioNetto": 29842000000
   },
   {
    "anno": 2016,
    "roe": 0.182,
    "margine": 0.3972,
    "roa": 0.0936,
    "utileNetto": 5991000000,
    "ricavi": 15082000000,
    "patrimonioNetto": 32912000000
   },
   {
    "anno": 2017,
    "roe": 0.2045,
    "margine": 0.3649,
    "roa": 0.0985,
    "utileNetto": 6699000000,
    "ricavi": 18358000000,
    "patrimonioNetto": 32760000000
   },
   {
    "anno": 2018,
    "roe": 0.3029,
    "margine": 0.4998,
    "roa": 0.1488,
    "utileNetto": 10301000000,
    "ricavi": 20609000000,
    "patrimonioNetto": 34006000000
   },
   {
    "anno": 2019,
    "roe": 0.3483,
    "margine": 0.5257,
    "roa": 0.1665,
    "utileNetto": 12080000000,
    "ricavi": 22977000000,
    "patrimonioNetto": 34684000000
   },
   {
    "anno": 2020,
    "roe": 0.3001,
    "margine": 0.4974,
    "roa": 0.1343,
    "utileNetto": 10866000000,
    "ricavi": 21846000000,
    "patrimonioNetto": 36210000000
   },
   {
    "anno": 2021,
    "roe": 0.3275,
    "margine": 0.5107,
    "roa": 0.1485,
    "utileNetto": 12311000000,
    "ricavi": 24105000000,
    "patrimonioNetto": 37589000000
   },
   {
    "anno": 2022,
    "roe": 0.4204,
    "margine": 0.5103,
    "roa": 0.1749,
    "utileNetto": 14957000000,
    "ricavi": 29310000000,
    "patrimonioNetto": 35581000000
   },
   {
    "anno": 2023,
    "roe": 0.446,
    "margine": 0.529,
    "roa": 0.1909,
    "utileNetto": 17273000000,
    "ricavi": 32653000000,
    "patrimonioNetto": 38733000000
   },
   {
    "anno": 2024,
    "roe": 0.5045,
    "margine": 0.5495,
    "roa": 0.2089,
    "utileNetto": 19743000000,
    "ricavi": 35926000000,
    "patrimonioNetto": 39137000000
   },
   {
    "anno": 2025,
    "roe": 0.5291,
    "margine": 0.5014,
    "roa": 0.2013,
    "utileNetto": 20058000000,
    "ricavi": 40000000000,
    "patrimonioNetto": 37909000000
   }
  ]
 },
 "WMT": {
  "nome": "Walmart",
  "anni": [
   {
    "anno": 2008,
    "roe": 0.1922,
    "margine": 0.0338,
    "roa": null,
    "utileNetto": 12731000000,
    "ricavi": 377023000000,
    "patrimonioNetto": 66250000000
   },
   {
    "anno": 2009,
    "roe": 0.2004,
    "margine": 0.0331,
    "roa": 0.0819,
    "utileNetto": 13381000000,
    "ricavi": 404254000000,
    "patrimonioNetto": 66763000000
   },
   {
    "anno": 2010,
    "roe": 0.1978,
    "margine": 0.0352,
    "roa": 0.0843,
    "utileNetto": 14370000000,
    "ricavi": 408085000000,
    "patrimonioNetto": 72648000000
   },
   {
    "anno": 2011,
    "roe": 0.23,
    "margine": 0.0389,
    "roa": 0.0907,
    "utileNetto": 16389000000,
    "ricavi": 421849000000,
    "patrimonioNetto": 71247000000
   },
   {
    "anno": 2012,
    "roe": 0.2072,
    "margine": 0.0352,
    "roa": 0.0812,
    "utileNetto": 15699000000,
    "ricavi": 446509000000,
    "patrimonioNetto": 75761000000
   },
   {
    "anno": 2013,
    "roe": 0.208,
    "margine": 0.0363,
    "roa": 0.0837,
    "utileNetto": 16999000000,
    "ricavi": 468651000000,
    "patrimonioNetto": 81738000000
   },
   {
    "anno": 2014,
    "roe": 0.197,
    "margine": 0.0336,
    "roa": 0.0783,
    "utileNetto": 16022000000,
    "ricavi": 476294000000,
    "patrimonioNetto": 81339000000
   },
   {
    "anno": 2015,
    "roe": 0.1904,
    "margine": 0.0337,
    "roa": 0.0804,
    "utileNetto": 16363000000,
    "ricavi": 485651000000,
    "patrimonioNetto": 85937000000
   },
   {
    "anno": 2016,
    "roe": 0.1757,
    "margine": 0.0305,
    "roa": 0.0736,
    "utileNetto": 14694000000,
    "ricavi": 482130000000,
    "patrimonioNetto": 83611000000
   },
   {
    "anno": 2017,
    "roe": 0.1694,
    "margine": 0.0281,
    "roa": 0.0686,
    "utileNetto": 13643000000,
    "ricavi": 485873000000,
    "patrimonioNetto": 80535000000
   },
   {
    "anno": 2018,
    "roe": 0.122,
    "margine": 0.0197,
    "roa": 0.0482,
    "utileNetto": 9862000000,
    "ricavi": 500343000000,
    "patrimonioNetto": 80822000000
   },
   {
    "anno": 2019,
    "roe": 0.0838,
    "margine": 0.013,
    "roa": 0.0304,
    "utileNetto": 6670000000,
    "ricavi": 514405000000,
    "patrimonioNetto": 79634000000
   },
   {
    "anno": 2020,
    "roe": 0.1825,
    "margine": 0.0284,
    "roa": 0.0629,
    "utileNetto": 14881000000,
    "ricavi": 523964000000,
    "patrimonioNetto": 81552000000
   },
   {
    "anno": 2021,
    "roe": 0.1543,
    "margine": 0.0242,
    "roa": 0.0535,
    "utileNetto": 13510000000,
    "ricavi": 559151000000,
    "patrimonioNetto": 87531000000
   },
   {
    "anno": 2022,
    "roe": 0.1488,
    "margine": 0.0239,
    "roa": 0.0558,
    "utileNetto": 13673000000,
    "ricavi": 572754000000,
    "patrimonioNetto": 91891000000
   },
   {
    "anno": 2023,
    "roe": 0.1395,
    "margine": 0.0191,
    "roa": 0.048,
    "utileNetto": 11680000000,
    "ricavi": 611289000000,
    "patrimonioNetto": 83754000000
   },
   {
    "anno": 2024,
    "roe": 0.1717,
    "margine": 0.0239,
    "roa": 0.0615,
    "utileNetto": 15511000000,
    "ricavi": 648125000000,
    "patrimonioNetto": 90349000000
   },
   {
    "anno": 2025,
    "roe": 0.2136,
    "margine": 0.0285,
    "roa": 0.0745,
    "utileNetto": 19436000000,
    "ricavi": 680985000000,
    "patrimonioNetto": 91013000000
   },
   {
    "anno": 2026,
    "roe": 0.2198,
    "margine": 0.0307,
    "roa": 0.0769,
    "utileNetto": 21893000000,
    "ricavi": 713163000000,
    "patrimonioNetto": 99617000000
   }
  ]
 },
 "PG": {
  "nome": "Procter & Gamble",
  "anni": [
   {
    "anno": 2008,
    "roe": 0.173,
    "margine": 0.1524,
    "roa": 0.0839,
    "utileNetto": 12075000000,
    "ricavi": 79257000000,
    "patrimonioNetto": 69784000000
   },
   {
    "anno": 2009,
    "roe": 0.212,
    "margine": 0.1752,
    "roa": 0.0996,
    "utileNetto": 13436000000,
    "ricavi": 76694000000,
    "patrimonioNetto": 63382000000
   },
   {
    "anno": 2010,
    "roe": 0.2073,
    "margine": 0.1642,
    "roa": 0.0994,
    "utileNetto": 12736000000,
    "ricavi": 77567000000,
    "patrimonioNetto": 61439000000
   },
   {
    "anno": 2011,
    "roe": 0.1735,
    "margine": 0.1455,
    "roa": 0.0853,
    "utileNetto": 11797000000,
    "ricavi": 81104000000,
    "patrimonioNetto": 68001000000
   },
   {
    "anno": 2012,
    "roe": 0.168,
    "margine": 0.3787,
    "roa": 0.0813,
    "utileNetto": 10756000000,
    "ricavi": 28400000000,
    "patrimonioNetto": 64035000000
   },
   {
    "anno": 2013,
    "roe": 0.1646,
    "margine": 0.1412,
    "roa": 0.0812,
    "utileNetto": 11312000000,
    "ricavi": 80116000000,
    "patrimonioNetto": 68709000000
   },
   {
    "anno": 2014,
    "roe": 0.1664,
    "margine": 0.1565,
    "roa": 0.0807,
    "utileNetto": 11643000000,
    "ricavi": 74401000000,
    "patrimonioNetto": 69976000000
   },
   {
    "anno": 2015,
    "roe": 0.1116,
    "margine": 0.0995,
    "roa": 0.0543,
    "utileNetto": 7036000000,
    "ricavi": 70749000000,
    "patrimonioNetto": 63050000000
   },
   {
    "anno": 2016,
    "roe": 0.1812,
    "margine": 0.1609,
    "roa": 0.0827,
    "utileNetto": 10508000000,
    "ricavi": 65299000000,
    "patrimonioNetto": 57983000000
   },
   {
    "anno": 2017,
    "roe": 0.2748,
    "margine": 0.2356,
    "roa": 0.1273,
    "utileNetto": 15326000000,
    "ricavi": 65058000000,
    "patrimonioNetto": 55778000000
   },
   {
    "anno": 2018,
    "roe": 0.1844,
    "margine": 0.1459,
    "roa": 0.0824,
    "utileNetto": 9750000000,
    "ricavi": 66832000000,
    "patrimonioNetto": 52883000000
   },
   {
    "anno": 2019,
    "roe": 0.0819,
    "margine": 0.0576,
    "roa": 0.0339,
    "utileNetto": 3897000000,
    "ricavi": 67684000000,
    "patrimonioNetto": 47579000000
   },
   {
    "anno": 2020,
    "roe": 0.2779,
    "margine": 0.1836,
    "roa": 0.1079,
    "utileNetto": 13027000000,
    "ricavi": 70950000000,
    "patrimonioNetto": 46878000000
   },
   {
    "anno": 2021,
    "roe": 0.3066,
    "margine": 0.1879,
    "roa": 0.1199,
    "utileNetto": 14306000000,
    "ricavi": 76118000000,
    "patrimonioNetto": 46654000000
   },
   {
    "anno": 2022,
    "roe": 0.3146,
    "margine": 0.1838,
    "roa": 0.1258,
    "utileNetto": 14742000000,
    "ricavi": 80187000000,
    "patrimonioNetto": 46854000000
   },
   {
    "anno": 2023,
    "roe": 0.3113,
    "margine": 0.1787,
    "roa": 0.1213,
    "utileNetto": 14653000000,
    "ricavi": 82006000000,
    "patrimonioNetto": 47065000000
   },
   {
    "anno": 2024,
    "roe": 0.2943,
    "margine": 0.177,
    "roa": 0.1216,
    "utileNetto": 14879000000,
    "ricavi": 84039000000,
    "patrimonioNetto": 50559000000
   },
   {
    "anno": 2025,
    "roe": 0.3055,
    "margine": 0.1895,
    "roa": 0.1276,
    "utileNetto": 15974000000,
    "ricavi": 84284000000,
    "patrimonioNetto": 52284000000
   },
   {
    "anno": 2026,
    "roe": 0.2954,
    "margine": 0.1844,
    "roa": 0.1268,
    "utileNetto": 16046000000,
    "ricavi": 87032000000,
    "patrimonioNetto": 54311000000
   }
  ]
 }
};

export const TICKER_DISPONIBILI = Object.keys(FONDAMENTALI_STORICI);

// Gli anni davvero coperti per un'azienda: serve a non promettere "dieci anni"
// quando ce ne sono quattro.
export function anniCoperti(ticker) {
  const a = FONDAMENTALI_STORICI[ticker]?.anni || [];
  return a.length ? { da: a[0].anno, a: a[a.length - 1].anno, quanti: a.length } : null;
}
