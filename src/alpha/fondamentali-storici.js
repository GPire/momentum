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
  "nome": "Apple Inc.",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
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
  "nome": "MICROSOFT CORP",
  "anni": [
   {
    "anno": 2008,
    "roe": null,
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
  "nome": "Alphabet Inc.",
  "anni": [
   {
    "anno": 2013,
    "roe": null,
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
  "nome": "AMAZON COM INC",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
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
  "nome": "NVIDIA CORP",
  "anni": [
   {
    "anno": 2008,
    "roe": null,
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
 "META": {
  "nome": "Meta Platforms, Inc.",
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
 "AVGO": {
  "nome": "Broadcom Inc.",
  "anni": [
   {
    "anno": 2016,
    "roe": null,
    "margine": -0.1313,
    "roa": null,
    "utileNetto": -1739000000,
    "ricavi": 13240000000,
    "patrimonioNetto": 21876000000
   },
   {
    "anno": 2017,
    "roe": 0.0769,
    "margine": 0.1012,
    "roa": 0.0328,
    "utileNetto": 1784000000,
    "ricavi": 17636000000,
    "patrimonioNetto": 23186000000
   },
   {
    "anno": 2018,
    "roe": 0.473,
    "margine": 0.6049,
    "roa": 0.2516,
    "utileNetto": 12610000000,
    "ricavi": 20848000000,
    "patrimonioNetto": 26657000000
   },
   {
    "anno": 2019,
    "roe": 0.1092,
    "margine": 0.1205,
    "roa": 0.0404,
    "utileNetto": 2724000000,
    "ricavi": 22597000000,
    "patrimonioNetto": 24941000000
   },
   {
    "anno": 2020,
    "roe": 0.124,
    "margine": 0.1239,
    "roa": 0.039,
    "utileNetto": 2960000000,
    "ricavi": 23888000000,
    "patrimonioNetto": 23874000000
   },
   {
    "anno": 2021,
    "roe": 0.2699,
    "margine": 0.2454,
    "roa": 0.0891,
    "utileNetto": 6736000000,
    "ricavi": 27450000000,
    "patrimonioNetto": 24962000000
   },
   {
    "anno": 2022,
    "roe": 0.5062,
    "margine": 0.3462,
    "roa": 0.1569,
    "utileNetto": 11495000000,
    "ricavi": 33203000000,
    "patrimonioNetto": 22709000000
   },
   {
    "anno": 2023,
    "roe": 0.587,
    "margine": 0.3931,
    "roa": 0.1933,
    "utileNetto": 14082000000,
    "ricavi": 35819000000,
    "patrimonioNetto": 23988000000
   },
   {
    "anno": 2024,
    "roe": 0.0871,
    "margine": 0.1143,
    "roa": 0.0356,
    "utileNetto": 5895000000,
    "ricavi": 51574000000,
    "patrimonioNetto": 67678000000
   },
   {
    "anno": 2025,
    "roe": 0.2845,
    "margine": 0.362,
    "roa": 0.1352,
    "utileNetto": 23126000000,
    "ricavi": 63887000000,
    "patrimonioNetto": 81292000000
   }
  ]
 },
 "ORCL": {
  "nome": "ORACLE CORP",
  "anni": [
   {
    "anno": 2008,
    "roe": null,
    "margine": 0.2488,
    "roa": null,
    "utileNetto": 5581000000,
    "ricavi": 22430000000,
    "patrimonioNetto": 23394000000
   },
   {
    "anno": 2009,
    "roe": 0.2231,
    "margine": 0.2442,
    "roa": 0.1197,
    "utileNetto": 5677000000,
    "ricavi": 23252000000,
    "patrimonioNetto": 25445000000
   },
   {
    "anno": 2010,
    "roe": 0.1966,
    "margine": 0.2287,
    "roa": 0.0996,
    "utileNetto": 6135000000,
    "ricavi": 26820000000,
    "patrimonioNetto": 31199000000
   },
   {
    "anno": 2011,
    "roe": 0.2124,
    "margine": 0.2399,
    "roa": 0.1162,
    "utileNetto": 8547000000,
    "ricavi": 35622000000,
    "patrimonioNetto": 40245000000
   },
   {
    "anno": 2012,
    "roe": 0.2264,
    "margine": 0.2689,
    "roa": 0.1274,
    "utileNetto": 9981000000,
    "ricavi": 37121000000,
    "patrimonioNetto": 44087000000
   },
   {
    "anno": 2013,
    "roe": 0.242,
    "margine": 0.2938,
    "roa": 0.1335,
    "utileNetto": 10925000000,
    "ricavi": 37180000000,
    "patrimonioNetto": 45145000000
   },
   {
    "anno": 2014,
    "roe": 0.2309,
    "margine": 0.2862,
    "roa": 0.1214,
    "utileNetto": 10955000000,
    "ricavi": 38275000000,
    "patrimonioNetto": 47447000000
   },
   {
    "anno": 2015,
    "roe": 0.2024,
    "margine": 0.26,
    "roa": 0.0896,
    "utileNetto": 9938000000,
    "ricavi": 38226000000,
    "patrimonioNetto": 49098000000
   },
   {
    "anno": 2016,
    "roe": 0.1863,
    "margine": 0.2403,
    "roa": 0.0793,
    "utileNetto": 8901000000,
    "ricavi": 37047000000,
    "patrimonioNetto": 47790000000
   },
   {
    "anno": 2017,
    "roe": 0.1714,
    "margine": 0.2501,
    "roa": 0.07,
    "utileNetto": 9452000000,
    "ricavi": 37792000000,
    "patrimonioNetto": 55130000000
   },
   {
    "anno": 2018,
    "roe": 0.0765,
    "margine": 0.0911,
    "roa": 0.026,
    "utileNetto": 3587000000,
    "ricavi": 39383000000,
    "patrimonioNetto": 46873000000
   },
   {
    "anno": 2019,
    "roe": 0.4956,
    "margine": 0.2805,
    "roa": 0.102,
    "utileNetto": 11083000000,
    "ricavi": 39506000000,
    "patrimonioNetto": 22363000000
   },
   {
    "anno": 2020,
    "roe": 0.797,
    "margine": 0.2594,
    "roa": 0.0878,
    "utileNetto": 10135000000,
    "ricavi": 39068000000,
    "patrimonioNetto": 12717000000
   },
   {
    "anno": 2021,
    "roe": null,
    "margine": 0.3396,
    "roa": 0.1048,
    "utileNetto": 13746000000,
    "ricavi": 40479000000,
    "patrimonioNetto": 5952000000
   },
   {
    "anno": 2022,
    "roe": null,
    "margine": 0.1583,
    "roa": 0.0615,
    "utileNetto": 6717000000,
    "ricavi": 42440000000,
    "patrimonioNetto": -5768000000
   },
   {
    "anno": 2023,
    "roe": null,
    "margine": 0.1702,
    "roa": 0.0633,
    "utileNetto": 8503000000,
    "ricavi": 49954000000,
    "patrimonioNetto": 1556000000
   },
   {
    "anno": 2024,
    "roe": 1.1329,
    "margine": 0.1976,
    "roa": 0.0742,
    "utileNetto": 10467000000,
    "ricavi": 52961000000,
    "patrimonioNetto": 9239000000
   },
   {
    "anno": 2025,
    "roe": 0.6084,
    "margine": 0.2168,
    "roa": 0.0739,
    "utileNetto": 12443000000,
    "ricavi": 57399000000,
    "patrimonioNetto": 20451000000
   },
   {
    "anno": 2026,
    "roe": 0.402,
    "margine": 0.2537,
    "roa": 0.0653,
    "utileNetto": 17087000000,
    "ricavi": 67357000000,
    "patrimonioNetto": 42508000000
   }
  ]
 },
 "CRM": {
  "nome": "Salesforce, Inc.",
  "anni": [
   {
    "anno": 2008,
    "roe": null,
    "margine": 0.0245,
    "roa": null,
    "utileNetto": 18356000,
    "ricavi": 748700000,
    "patrimonioNetto": 461002000
   },
   {
    "anno": 2009,
    "roe": 0.0636,
    "margine": 0.0403,
    "roa": 0.0293,
    "utileNetto": 43428000,
    "ricavi": 1076769000,
    "patrimonioNetto": 682487000
   },
   {
    "anno": 2010,
    "roe": 0.0764,
    "margine": 0.0618,
    "roa": 0.0328,
    "utileNetto": 80719000,
    "ricavi": 1305583000,
    "patrimonioNetto": 1056666000
   },
   {
    "anno": 2011,
    "roe": 0.0505,
    "margine": 0.0389,
    "roa": 0.0209,
    "utileNetto": 64474000,
    "ricavi": 1657139000,
    "patrimonioNetto": 1276491000
   },
   {
    "anno": 2012,
    "roe": -0.0073,
    "margine": -0.0051,
    "roa": -0.0028,
    "utileNetto": -11572000,
    "ricavi": 2266539000,
    "patrimonioNetto": 1587360000
   },
   {
    "anno": 2013,
    "roe": -0.1167,
    "margine": -0.0887,
    "roa": -0.0489,
    "utileNetto": -270445000,
    "ricavi": 3050195000,
    "patrimonioNetto": 2317633000
   },
   {
    "anno": 2014,
    "roe": -0.0764,
    "margine": -0.057,
    "roa": -0.0254,
    "utileNetto": -232175000,
    "ricavi": 4071003000,
    "patrimonioNetto": 3038510000
   },
   {
    "anno": 2015,
    "roe": -0.0661,
    "margine": -0.0489,
    "roa": -0.0246,
    "utileNetto": -262688000,
    "ricavi": 5373586000,
    "patrimonioNetto": 3975183000
   },
   {
    "anno": 2016,
    "roe": -0.0095,
    "margine": -0.0071,
    "roa": -0.0037,
    "utileNetto": -47426000,
    "ricavi": 6667216000,
    "patrimonioNetto": 5003000000
   },
   {
    "anno": 2017,
    "roe": 0.0392,
    "margine": 0.0383,
    "roa": 0.0184,
    "utileNetto": 323000000,
    "ricavi": 8437000000,
    "patrimonioNetto": 8230000000
   },
   {
    "anno": 2018,
    "roe": 0.0347,
    "margine": 0.0342,
    "roa": 0.0164,
    "utileNetto": 360000000,
    "ricavi": 10540000000,
    "patrimonioNetto": 10376000000
   },
   {
    "anno": 2019,
    "roe": 0.0711,
    "margine": 0.0836,
    "roa": 0.0361,
    "utileNetto": 1110000000,
    "ricavi": 13282000000,
    "patrimonioNetto": 15605000000
   },
   {
    "anno": 2020,
    "roe": 0.0037,
    "margine": 0.0074,
    "roa": 0.0023,
    "utileNetto": 126000000,
    "ricavi": 17098000000,
    "patrimonioNetto": 33885000000
   },
   {
    "anno": 2021,
    "roe": 0.0981,
    "margine": 0.1916,
    "roa": 0.0614,
    "utileNetto": 4072000000,
    "ricavi": 21252000000,
    "patrimonioNetto": 41493000000
   },
   {
    "anno": 2022,
    "roe": 0.0248,
    "margine": 0.0545,
    "roa": 0.0152,
    "utileNetto": 1444000000,
    "ricavi": 26492000000,
    "patrimonioNetto": 58131000000
   },
   {
    "anno": 2023,
    "roe": 0.0036,
    "margine": 0.0066,
    "roa": 0.0021,
    "utileNetto": 208000000,
    "ricavi": 31352000000,
    "patrimonioNetto": 58359000000
   },
   {
    "anno": 2024,
    "roe": 0.0693,
    "margine": 0.1187,
    "roa": 0.0414,
    "utileNetto": 4136000000,
    "ricavi": 34857000000,
    "patrimonioNetto": 59646000000
   },
   {
    "anno": 2025,
    "roe": 0.1013,
    "margine": 0.1635,
    "roa": 0.0602,
    "utileNetto": 6197000000,
    "ricavi": 37895000000,
    "patrimonioNetto": 61173000000
   },
   {
    "anno": 2026,
    "roe": 0.1261,
    "margine": 0.1796,
    "roa": 0.0664,
    "utileNetto": 7457000000,
    "ricavi": 41525000000,
    "patrimonioNetto": 59142000000
   }
  ]
 },
 "ADBE": {
  "nome": "ADOBE INC.",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.2292,
    "roa": null,
    "utileNetto": 723807000,
    "ricavi": 3157881000,
    "patrimonioNetto": 4649982000
   },
   {
    "anno": 2008,
    "roe": 0.1977,
    "margine": 0.2435,
    "roa": 0.1498,
    "utileNetto": 871814000,
    "ricavi": 3579889000,
    "patrimonioNetto": 4410354000
   },
   {
    "anno": 2009,
    "roe": 0.079,
    "margine": 0.1312,
    "roa": 0.0531,
    "utileNetto": 386508000,
    "ricavi": 2945853000,
    "patrimonioNetto": 4890568000
   },
   {
    "anno": 2010,
    "roe": 0.1492,
    "margine": 0.2039,
    "roa": 0.0952,
    "utileNetto": 774680000,
    "ricavi": 3800000000,
    "patrimonioNetto": 5192387000
   },
   {
    "anno": 2011,
    "roe": 0.144,
    "margine": 0.1975,
    "roa": 0.0926,
    "utileNetto": 832847000,
    "ricavi": 4216258000,
    "patrimonioNetto": 5783113000
   },
   {
    "anno": 2012,
    "roe": 0.1249,
    "margine": 0.1891,
    "roa": 0.0829,
    "utileNetto": 832775000,
    "ricavi": 4403677000,
    "patrimonioNetto": 6665182000
   },
   {
    "anno": 2013,
    "roe": 0.0431,
    "margine": 0.0715,
    "roa": 0.0279,
    "utileNetto": 289985000,
    "ricavi": 4055240000,
    "patrimonioNetto": 6724634000
   },
   {
    "anno": 2014,
    "roe": 0.0396,
    "margine": 0.0647,
    "roa": 0.0249,
    "utileNetto": 268395000,
    "ricavi": 4147065000,
    "patrimonioNetto": 6775905000
   },
   {
    "anno": 2015,
    "roe": 0.0899,
    "margine": 0.1313,
    "roa": 0.0537,
    "utileNetto": 629551000,
    "ricavi": 4795511000,
    "patrimonioNetto": 7001580000
   },
   {
    "anno": 2016,
    "roe": 0.1574,
    "margine": 0.1996,
    "roa": 0.0921,
    "utileNetto": 1168782000,
    "ricavi": 5854430000,
    "patrimonioNetto": 7424835000
   },
   {
    "anno": 2017,
    "roe": 0.2003,
    "margine": 0.232,
    "roa": 0.1165,
    "utileNetto": 1693954000,
    "ricavi": 7301505000,
    "patrimonioNetto": 8459000000
   },
   {
    "anno": 2018,
    "roe": 0.2768,
    "margine": 0.2869,
    "roa": 0.138,
    "utileNetto": 2591000000,
    "ricavi": 9030000000,
    "patrimonioNetto": 9362000000
   },
   {
    "anno": 2019,
    "roe": 0.2802,
    "margine": 0.2642,
    "roa": 0.1421,
    "utileNetto": 2951000000,
    "ricavi": 11171000000,
    "patrimonioNetto": 10530000000
   },
   {
    "anno": 2020,
    "roe": 0.3966,
    "margine": 0.4088,
    "roa": 0.2166,
    "utileNetto": 5260000000,
    "ricavi": 12868000000,
    "patrimonioNetto": 13264000000
   },
   {
    "anno": 2021,
    "roe": 0.3259,
    "margine": 0.3055,
    "roa": 0.177,
    "utileNetto": 4822000000,
    "ricavi": 15785000000,
    "patrimonioNetto": 14797000000
   },
   {
    "anno": 2022,
    "roe": 0.3385,
    "margine": 0.2701,
    "roa": 0.1751,
    "utileNetto": 4756000000,
    "ricavi": 17606000000,
    "patrimonioNetto": 14051000000
   },
   {
    "anno": 2023,
    "roe": 0.3286,
    "margine": 0.2797,
    "roa": 0.1823,
    "utileNetto": 5428000000,
    "ricavi": 19409000000,
    "patrimonioNetto": 16518000000
   },
   {
    "anno": 2024,
    "roe": 0.3942,
    "margine": 0.2585,
    "roa": 0.1839,
    "utileNetto": 5560000000,
    "ricavi": 21505000000,
    "patrimonioNetto": 14105000000
   },
   {
    "anno": 2025,
    "roe": 0.6134,
    "margine": 0.3,
    "roa": 0.2417,
    "utileNetto": 7130000000,
    "ricavi": 23769000000,
    "patrimonioNetto": 11623000000
   }
  ]
 },
 "CSCO": {
  "nome": "CISCO SYSTEMS, INC.",
  "anni": [
   {
    "anno": 2008,
    "roe": null,
    "margine": 0.2036,
    "roa": null,
    "utileNetto": 8052000000,
    "ricavi": 39540000000,
    "patrimonioNetto": 34402000000
   },
   {
    "anno": 2009,
    "roe": 0.1586,
    "margine": 0.1698,
    "roa": 0.09,
    "utileNetto": 6134000000,
    "ricavi": 36117000000,
    "patrimonioNetto": 38677000000
   },
   {
    "anno": 2010,
    "roe": 0.1754,
    "margine": 0.194,
    "roa": 0.0957,
    "utileNetto": 7767000000,
    "ricavi": 40040000000,
    "patrimonioNetto": 44285000000
   },
   {
    "anno": 2011,
    "roe": 0.1373,
    "margine": 0.1502,
    "roa": 0.0745,
    "utileNetto": 6490000000,
    "ricavi": 43218000000,
    "patrimonioNetto": 47259000000
   },
   {
    "anno": 2012,
    "roe": 0.1567,
    "margine": 0.1746,
    "roa": 0.0876,
    "utileNetto": 8041000000,
    "ricavi": 46061000000,
    "patrimonioNetto": 51301000000
   },
   {
    "anno": 2013,
    "roe": 0.1688,
    "margine": 0.2054,
    "roa": 0.0987,
    "utileNetto": 9983000000,
    "ricavi": 48607000000,
    "patrimonioNetto": 59128000000
   },
   {
    "anno": 2014,
    "roe": 0.1386,
    "margine": 0.1666,
    "roa": 0.0747,
    "utileNetto": 7853000000,
    "ricavi": 47142000000,
    "patrimonioNetto": 56661000000
   },
   {
    "anno": 2015,
    "roe": 0.1504,
    "margine": 0.1827,
    "roa": 0.0792,
    "utileNetto": 8981000000,
    "ricavi": 49161000000,
    "patrimonioNetto": 59707000000
   },
   {
    "anno": 2016,
    "roe": 0.1689,
    "margine": 0.2181,
    "roa": 0.0883,
    "utileNetto": 10739000000,
    "ricavi": 49247000000,
    "patrimonioNetto": 63585000000
   },
   {
    "anno": 2017,
    "roe": 0.1453,
    "margine": 0.2002,
    "roa": 0.074,
    "utileNetto": 9609000000,
    "ricavi": 48005000000,
    "patrimonioNetto": 66137000000
   },
   {
    "anno": 2018,
    "roe": 0.0025,
    "margine": 0.0022,
    "roa": 0.001,
    "utileNetto": 110000000,
    "ricavi": 49330000000,
    "patrimonioNetto": 43204000000
   },
   {
    "anno": 2019,
    "roe": 0.3462,
    "margine": 0.2239,
    "roa": 0.1188,
    "utileNetto": 11621000000,
    "ricavi": 51904000000,
    "patrimonioNetto": 33571000000
   },
   {
    "anno": 2020,
    "roe": 0.2957,
    "margine": 0.2275,
    "roa": 0.1182,
    "utileNetto": 11214000000,
    "ricavi": 49301000000,
    "patrimonioNetto": 37920000000
   },
   {
    "anno": 2021,
    "roe": 0.2566,
    "margine": 0.2126,
    "roa": 0.1086,
    "utileNetto": 10591000000,
    "ricavi": 49818000000,
    "patrimonioNetto": 41275000000
   },
   {
    "anno": 2022,
    "roe": 0.297,
    "margine": 0.2291,
    "roa": 0.1257,
    "utileNetto": 11812000000,
    "ricavi": 51557000000,
    "patrimonioNetto": 39773000000
   },
   {
    "anno": 2023,
    "roe": 0.2844,
    "margine": 0.2213,
    "roa": 0.1238,
    "utileNetto": 12613000000,
    "ricavi": 56998000000,
    "patrimonioNetto": 44353000000
   },
   {
    "anno": 2024,
    "roe": 0.227,
    "margine": 0.1918,
    "roa": 0.0829,
    "utileNetto": 10320000000,
    "ricavi": 53803000000,
    "patrimonioNetto": 45457000000
   },
   {
    "anno": 2025,
    "roe": 0.2173,
    "margine": 0.1797,
    "roa": 0.0832,
    "utileNetto": 10180000000,
    "ricavi": 56654000000,
    "patrimonioNetto": 46843000000
   }
  ]
 },
 "INTC": {
  "nome": "INTEL CORP",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.182,
    "roa": null,
    "utileNetto": 6976000000,
    "ricavi": 38334000000,
    "patrimonioNetto": 43220000000
   },
   {
    "anno": 2008,
    "roe": 0.1338,
    "margine": 0.1408,
    "roa": 0.1049,
    "utileNetto": 5292000000,
    "ricavi": 37586000000,
    "patrimonioNetto": 39546000000
   },
   {
    "anno": 2009,
    "roe": 0.1048,
    "margine": 0.1244,
    "roa": 0.0823,
    "utileNetto": 4369000000,
    "ricavi": 35127000000,
    "patrimonioNetto": 41704000000
   },
   {
    "anno": 2010,
    "roe": 0.2319,
    "margine": 0.2628,
    "roa": 0.1814,
    "utileNetto": 11464000000,
    "ricavi": 43623000000,
    "patrimonioNetto": 49430000000
   },
   {
    "anno": 2011,
    "roe": 0.2819,
    "margine": 0.2397,
    "roa": 0.182,
    "utileNetto": 12942000000,
    "ricavi": 53999000000,
    "patrimonioNetto": 45911000000
   },
   {
    "anno": 2012,
    "roe": 0.2149,
    "margine": 0.2063,
    "roa": 0.1305,
    "utileNetto": 11005000000,
    "ricavi": 53341000000,
    "patrimonioNetto": 51203000000
   },
   {
    "anno": 2013,
    "roe": 0.1651,
    "margine": 0.1825,
    "roa": 0.1042,
    "utileNetto": 9620000000,
    "ricavi": 52708000000,
    "patrimonioNetto": 58256000000
   },
   {
    "anno": 2014,
    "roe": 0.2095,
    "margine": 0.2095,
    "roa": 0.1274,
    "utileNetto": 11704000000,
    "ricavi": 55870000000,
    "patrimonioNetto": 55865000000
   },
   {
    "anno": 2015,
    "roe": 0.187,
    "margine": 0.2063,
    "roa": 0.1126,
    "utileNetto": 11420000000,
    "ricavi": 55355000000,
    "patrimonioNetto": 61085000000
   },
   {
    "anno": 2016,
    "roe": 0.1558,
    "margine": 0.1737,
    "roa": 0.091,
    "utileNetto": 10316000000,
    "ricavi": 59387000000,
    "patrimonioNetto": 66226000000
   },
   {
    "anno": 2017,
    "roe": 0.1378,
    "margine": 0.153,
    "roa": 0.0779,
    "utileNetto": 9601000000,
    "ricavi": 62761000000,
    "patrimonioNetto": 69653000000
   },
   {
    "anno": 2018,
    "roe": 0.2824,
    "margine": 0.2972,
    "roa": 0.1645,
    "utileNetto": 21053000000,
    "ricavi": 70848000000,
    "patrimonioNetto": 74563000000
   },
   {
    "anno": 2019,
    "roe": 0.2716,
    "margine": 0.2925,
    "roa": 0.1542,
    "utileNetto": 21048000000,
    "ricavi": 71965000000,
    "patrimonioNetto": 77504000000
   },
   {
    "anno": 2020,
    "roe": 0.2579,
    "margine": 0.2684,
    "roa": 0.1365,
    "utileNetto": 20899000000,
    "ricavi": 77867000000,
    "patrimonioNetto": 81038000000
   },
   {
    "anno": 2021,
    "roe": 0.2083,
    "margine": 0.2514,
    "roa": 0.118,
    "utileNetto": 19868000000,
    "ricavi": 79024000000,
    "patrimonioNetto": 95391000000
   },
   {
    "anno": 2022,
    "roe": 0.0776,
    "margine": 0.1271,
    "roa": 0.044,
    "utileNetto": 8014000000,
    "ricavi": 63054000000,
    "patrimonioNetto": 103286000000
   },
   {
    "anno": 2023,
    "roe": 0.0154,
    "margine": 0.0311,
    "roa": 0.0088,
    "utileNetto": 1689000000,
    "ricavi": 54228000000,
    "patrimonioNetto": 109965000000
   },
   {
    "anno": 2024,
    "roe": -0.1889,
    "margine": -0.3532,
    "roa": -0.0955,
    "utileNetto": -18756000000,
    "ricavi": 53101000000,
    "patrimonioNetto": 99270000000
   },
   {
    "anno": 2025,
    "roe": -0.0023,
    "margine": -0.0051,
    "roa": -0.0013,
    "utileNetto": -267000000,
    "ricavi": 52853000000,
    "patrimonioNetto": 114281000000
   }
  ]
 },
 "AMD": {
  "nome": "ADVANCED MICRO DEVICES INC",
  "anni": [
   {
    "anno": 2008,
    "roe": null,
    "margine": null,
    "roa": null,
    "utileNetto": -3096000000,
    "ricavi": null,
    "patrimonioNetto": 127000000
   },
   {
    "anno": 2009,
    "roe": 0.4522,
    "margine": null,
    "roa": 0.0323,
    "utileNetto": 293000000,
    "ricavi": null,
    "patrimonioNetto": 648000000
   },
   {
    "anno": 2010,
    "roe": 0.465,
    "margine": 0.0725,
    "roa": 0.0949,
    "utileNetto": 471000000,
    "ricavi": 6494000000,
    "patrimonioNetto": 1013000000
   },
   {
    "anno": 2011,
    "roe": 0.3088,
    "margine": 0.0748,
    "roa": 0.0991,
    "utileNetto": 491000000,
    "ricavi": 6568000000,
    "patrimonioNetto": 1590000000
   },
   {
    "anno": 2012,
    "roe": -2.1989,
    "margine": -0.2182,
    "roa": -0.2958,
    "utileNetto": -1183000000,
    "ricavi": 5422000000,
    "patrimonioNetto": 538000000
   },
   {
    "anno": 2013,
    "roe": -0.1526,
    "margine": -0.0157,
    "roa": -0.0191,
    "utileNetto": -83000000,
    "ricavi": 5299000000,
    "patrimonioNetto": 544000000
   },
   {
    "anno": 2014,
    "roe": null,
    "margine": -0.0732,
    "roa": -0.107,
    "utileNetto": -403000000,
    "ricavi": 5506000000,
    "patrimonioNetto": 187000000
   },
   {
    "anno": 2015,
    "roe": null,
    "margine": -0.1654,
    "roa": -0.214,
    "utileNetto": -660000000,
    "ricavi": 3991000000,
    "patrimonioNetto": -350000000
   },
   {
    "anno": 2016,
    "roe": -1.044,
    "margine": -0.1153,
    "roa": -0.15,
    "utileNetto": -498000000,
    "ricavi": 4319000000,
    "patrimonioNetto": 477000000
   },
   {
    "anno": 2017,
    "roe": -0.0554,
    "margine": -0.0063,
    "roa": -0.0093,
    "utileNetto": -33000000,
    "ricavi": 5253000000,
    "patrimonioNetto": 596000000
   },
   {
    "anno": 2018,
    "roe": 0.2662,
    "margine": 0.052,
    "roa": 0.074,
    "utileNetto": 337000000,
    "ricavi": 6475000000,
    "patrimonioNetto": 1266000000
   },
   {
    "anno": 2019,
    "roe": 0.1206,
    "margine": 0.0507,
    "roa": 0.0566,
    "utileNetto": 341000000,
    "ricavi": 6731000000,
    "patrimonioNetto": 2827000000
   },
   {
    "anno": 2020,
    "roe": 0.4266,
    "margine": 0.255,
    "roa": 0.2778,
    "utileNetto": 2490000000,
    "ricavi": 9763000000,
    "patrimonioNetto": 5837000000
   },
   {
    "anno": 2021,
    "roe": 0.4218,
    "margine": 0.1924,
    "roa": 0.2546,
    "utileNetto": 3162000000,
    "ricavi": 16434000000,
    "patrimonioNetto": 7497000000
   },
   {
    "anno": 2022,
    "roe": 0.0241,
    "margine": 0.0559,
    "roa": 0.0195,
    "utileNetto": 1320000000,
    "ricavi": 23601000000,
    "patrimonioNetto": 54750000000
   },
   {
    "anno": 2023,
    "roe": 0.0153,
    "margine": 0.0377,
    "roa": 0.0126,
    "utileNetto": 854000000,
    "ricavi": 22680000000,
    "patrimonioNetto": 55892000000
   },
   {
    "anno": 2024,
    "roe": 0.0285,
    "margine": 0.0636,
    "roa": 0.0237,
    "utileNetto": 1641000000,
    "ricavi": 25785000000,
    "patrimonioNetto": 57568000000
   },
   {
    "anno": 2025,
    "roe": 0.0688,
    "margine": 0.1251,
    "roa": 0.0564,
    "utileNetto": 4335000000,
    "ricavi": 34639000000,
    "patrimonioNetto": 62999000000
   }
  ]
 },
 "QCOM": {
  "nome": "QUALCOMM INC/DE",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.3723,
    "roa": null,
    "utileNetto": 3303000000,
    "ricavi": 8871000000,
    "patrimonioNetto": 15835000000
   },
   {
    "anno": 2008,
    "roe": 0.1761,
    "margine": 0.2836,
    "roa": 0.1279,
    "utileNetto": 3160000000,
    "ricavi": 11142000000,
    "patrimonioNetto": 17944000000
   },
   {
    "anno": 2009,
    "roe": 0.0784,
    "margine": 0.1533,
    "roa": 0.058,
    "utileNetto": 1592000000,
    "ricavi": 10387000000,
    "patrimonioNetto": 20316000000
   },
   {
    "anno": 2010,
    "roe": 0.1557,
    "margine": 0.2957,
    "roa": 0.1062,
    "utileNetto": 3247000000,
    "ricavi": 10982000000,
    "patrimonioNetto": 20858000000
   },
   {
    "anno": 2011,
    "roe": 0.1579,
    "margine": 0.2848,
    "roa": 0.117,
    "utileNetto": 4260000000,
    "ricavi": 14957000000,
    "patrimonioNetto": 26972000000
   },
   {
    "anno": 2012,
    "roe": 0.1821,
    "margine": 0.3195,
    "roa": 0.142,
    "utileNetto": 6109000000,
    "ricavi": 19121000000,
    "patrimonioNetto": 33545000000
   },
   {
    "anno": 2013,
    "roe": 0.1899,
    "margine": 0.2756,
    "roa": 0.1506,
    "utileNetto": 6853000000,
    "ricavi": 24866000000,
    "patrimonioNetto": 36087000000
   },
   {
    "anno": 2014,
    "roe": 0.2034,
    "margine": 0.3008,
    "roa": 0.164,
    "utileNetto": 7967000000,
    "ricavi": 26487000000,
    "patrimonioNetto": 39166000000
   },
   {
    "anno": 2015,
    "roe": 0.1678,
    "margine": 0.2085,
    "roa": 0.1038,
    "utileNetto": 5271000000,
    "ricavi": 25281000000,
    "patrimonioNetto": 31414000000
   },
   {
    "anno": 2016,
    "roe": 0.1796,
    "margine": 0.2422,
    "roa": 0.109,
    "utileNetto": 5705000000,
    "ricavi": 23554000000,
    "patrimonioNetto": 31768000000
   },
   {
    "anno": 2017,
    "roe": 0.0796,
    "margine": 0.1098,
    "roa": 0.0373,
    "utileNetto": 2445000000,
    "ricavi": 22258000000,
    "patrimonioNetto": 30725000000
   },
   {
    "anno": 2018,
    "roe": null,
    "margine": -0.2195,
    "roa": -0.1517,
    "utileNetto": -4964000000,
    "ricavi": 22611000000,
    "patrimonioNetto": 807000000
   },
   {
    "anno": 2019,
    "roe": 0.8935,
    "margine": 0.1807,
    "roa": 0.1331,
    "utileNetto": 4386000000,
    "ricavi": 24273000000,
    "patrimonioNetto": 4909000000
   },
   {
    "anno": 2020,
    "roe": 0.8554,
    "margine": 0.2209,
    "roa": 0.146,
    "utileNetto": 5198000000,
    "ricavi": 23531000000,
    "patrimonioNetto": 6077000000
   },
   {
    "anno": 2021,
    "roe": 0.9088,
    "margine": 0.2694,
    "roa": 0.2193,
    "utileNetto": 9043000000,
    "ricavi": 33566000000,
    "patrimonioNetto": 9950000000
   },
   {
    "anno": 2022,
    "roe": 0.7181,
    "margine": 0.2927,
    "roa": 0.2639,
    "utileNetto": 12936000000,
    "ricavi": 44200000000,
    "patrimonioNetto": 18013000000
   },
   {
    "anno": 2023,
    "roe": 0.3351,
    "margine": 0.2019,
    "roa": 0.1417,
    "utileNetto": 7232000000,
    "ricavi": 35820000000,
    "patrimonioNetto": 21581000000
   },
   {
    "anno": 2024,
    "roe": 0.386,
    "margine": 0.2603,
    "roa": 0.1839,
    "utileNetto": 10142000000,
    "ricavi": 38962000000,
    "patrimonioNetto": 26274000000
   },
   {
    "anno": 2025,
    "roe": 0.2613,
    "margine": 0.1251,
    "roa": 0.1105,
    "utileNetto": 5541000000,
    "ricavi": 44284000000,
    "patrimonioNetto": 21206000000
   }
  ]
 },
 "TXN": {
  "nome": "TEXAS INSTRUMENTS INC",
  "anni": [
   {
    "anno": 2008,
    "roe": 0.2059,
    "margine": 0.1536,
    "roa": 0.161,
    "utileNetto": 1920000000,
    "ricavi": 12501000000,
    "patrimonioNetto": 9326000000
   },
   {
    "anno": 2009,
    "roe": 0.1512,
    "margine": 0.141,
    "roa": 0.1213,
    "utileNetto": 1470000000,
    "ricavi": 10427000000,
    "patrimonioNetto": 9722000000
   },
   {
    "anno": 2010,
    "roe": 0.3093,
    "margine": 0.2311,
    "roa": 0.2409,
    "utileNetto": 3228000000,
    "ricavi": 13966000000,
    "patrimonioNetto": 10437000000
   },
   {
    "anno": 2011,
    "roe": 0.2042,
    "margine": 0.1628,
    "roa": 0.1091,
    "utileNetto": 2236000000,
    "ricavi": 13735000000,
    "patrimonioNetto": 10952000000
   },
   {
    "anno": 2012,
    "roe": 0.1605,
    "margine": 0.1372,
    "roa": 0.0879,
    "utileNetto": 1759000000,
    "ricavi": 12825000000,
    "patrimonioNetto": 10961000000
   },
   {
    "anno": 2013,
    "roe": 0.2001,
    "margine": 0.1771,
    "roa": 0.1142,
    "utileNetto": 2162000000,
    "ricavi": 12205000000,
    "patrimonioNetto": 10807000000
   },
   {
    "anno": 2014,
    "roe": 0.2715,
    "margine": 0.2163,
    "roa": 0.1624,
    "utileNetto": 2821000000,
    "ricavi": 13045000000,
    "patrimonioNetto": 10390000000
   },
   {
    "anno": 2015,
    "roe": 0.3002,
    "margine": 0.2297,
    "roa": 0.184,
    "utileNetto": 2986000000,
    "ricavi": 13000000000,
    "patrimonioNetto": 9946000000
   },
   {
    "anno": 2016,
    "roe": 0.3433,
    "margine": 0.2689,
    "roa": 0.2188,
    "utileNetto": 3595000000,
    "ricavi": 13370000000,
    "patrimonioNetto": 10473000000
   },
   {
    "anno": 2017,
    "roe": 0.3562,
    "margine": 0.2461,
    "roa": 0.2087,
    "utileNetto": 3682000000,
    "ricavi": 14961000000,
    "patrimonioNetto": 10337000000
   },
   {
    "anno": 2018,
    "roe": 0.6204,
    "margine": 0.3535,
    "roa": 0.3256,
    "utileNetto": 5580000000,
    "ricavi": 15784000000,
    "patrimonioNetto": 8994000000
   },
   {
    "anno": 2019,
    "roe": 0.5633,
    "margine": 0.3488,
    "roa": 0.2784,
    "utileNetto": 5017000000,
    "ricavi": 14383000000,
    "patrimonioNetto": 8907000000
   },
   {
    "anno": 2020,
    "roe": 0.609,
    "margine": 0.3869,
    "roa": 0.2891,
    "utileNetto": 5595000000,
    "ricavi": 14461000000,
    "patrimonioNetto": 9187000000
   },
   {
    "anno": 2021,
    "roe": 0.5827,
    "margine": 0.4235,
    "roa": 0.3148,
    "utileNetto": 7769000000,
    "ricavi": 18344000000,
    "patrimonioNetto": 13333000000
   },
   {
    "anno": 2022,
    "roe": 0.6002,
    "margine": 0.4368,
    "roa": 0.3216,
    "utileNetto": 8749000000,
    "ricavi": 20028000000,
    "patrimonioNetto": 14577000000
   },
   {
    "anno": 2023,
    "roe": 0.3853,
    "margine": 0.3716,
    "roa": 0.2012,
    "utileNetto": 6510000000,
    "ricavi": 17519000000,
    "patrimonioNetto": 16897000000
   },
   {
    "anno": 2024,
    "roe": 0.2839,
    "margine": 0.3068,
    "roa": 0.1351,
    "utileNetto": 4799000000,
    "ricavi": 15641000000,
    "patrimonioNetto": 16903000000
   },
   {
    "anno": 2025,
    "roe": 0.3073,
    "margine": 0.2828,
    "roa": 0.1446,
    "utileNetto": 5001000000,
    "ricavi": 17682000000,
    "patrimonioNetto": 16273000000
   }
  ]
 },
 "IBM": {
  "nome": "INTERNATIONAL BUSINESS MACHINES CORP",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.1055,
    "roa": null,
    "utileNetto": 10418000000,
    "ricavi": 98786000000,
    "patrimonioNetto": 28615000000
   },
   {
    "anno": 2008,
    "roe": 0.908,
    "margine": 0.119,
    "roa": 0.1126,
    "utileNetto": 12334000000,
    "ricavi": 103630000000,
    "patrimonioNetto": 13584000000
   },
   {
    "anno": 2009,
    "roe": 0.59,
    "margine": 0.1402,
    "roa": 0.1231,
    "utileNetto": 13425000000,
    "ricavi": 95758000000,
    "patrimonioNetto": 22755000000
   },
   {
    "anno": 2010,
    "roe": 0.6401,
    "margine": 0.1485,
    "roa": 0.1307,
    "utileNetto": 14833000000,
    "ricavi": 99870000000,
    "patrimonioNetto": 23172000000
   },
   {
    "anno": 2011,
    "roe": 0.7835,
    "margine": 0.1483,
    "roa": 0.1362,
    "utileNetto": 15855000000,
    "ricavi": 106916000000,
    "patrimonioNetto": 20236000000
   },
   {
    "anno": 2012,
    "roe": 0.8746,
    "margine": 0.1614,
    "roa": 0.1393,
    "utileNetto": 16604000000,
    "ricavi": 102874000000,
    "patrimonioNetto": 18984000000
   },
   {
    "anno": 2013,
    "roe": 0.7189,
    "margine": 0.1676,
    "roa": 0.1312,
    "utileNetto": 16483000000,
    "ricavi": 98367000000,
    "patrimonioNetto": 22929000000
   },
   {
    "anno": 2014,
    "roe": 1.0007,
    "margine": 0.1296,
    "roa": 0.1025,
    "utileNetto": 12022000000,
    "ricavi": 92793000000,
    "patrimonioNetto": 12014000000
   },
   {
    "anno": 2015,
    "roe": 0.9144,
    "margine": 0.1614,
    "roa": 0.1194,
    "utileNetto": 13190000000,
    "ricavi": 81741000000,
    "patrimonioNetto": 14424000000
   },
   {
    "anno": 2016,
    "roe": 0.6455,
    "margine": 0.1486,
    "roa": 0.1011,
    "utileNetto": 11872000000,
    "ricavi": 79919000000,
    "patrimonioNetto": 18392000000
   },
   {
    "anno": 2017,
    "roe": 0.3246,
    "margine": 0.0727,
    "roa": 0.0459,
    "utileNetto": 5753000000,
    "ricavi": 79139000000,
    "patrimonioNetto": 17725000000
   },
   {
    "anno": 2018,
    "roe": 0.5156,
    "margine": 0.1097,
    "roa": 0.0707,
    "utileNetto": 8728000000,
    "ricavi": 79591000000,
    "patrimonioNetto": 16929000000
   },
   {
    "anno": 2019,
    "roe": 0.4494,
    "margine": 0.1634,
    "roa": 0.062,
    "utileNetto": 9431000000,
    "ricavi": 57714000000,
    "patrimonioNetto": 20985000000
   },
   {
    "anno": 2020,
    "roe": 0.2697,
    "margine": 0.1013,
    "roa": 0.0358,
    "utileNetto": 5590000000,
    "ricavi": 55179000000,
    "patrimonioNetto": 20727000000
   },
   {
    "anno": 2021,
    "roe": 0.3023,
    "margine": 0.1001,
    "roa": 0.0435,
    "utileNetto": 5743000000,
    "ricavi": 57350000000,
    "patrimonioNetto": 18996000000
   },
   {
    "anno": 2022,
    "roe": 0.0744,
    "margine": 0.0271,
    "roa": 0.0129,
    "utileNetto": 1639000000,
    "ricavi": 60530000000,
    "patrimonioNetto": 22021000000
   },
   {
    "anno": 2023,
    "roe": 0.3318,
    "margine": 0.1213,
    "roa": 0.0555,
    "utileNetto": 7502000000,
    "ricavi": 61860000000,
    "patrimonioNetto": 22613000000
   },
   {
    "anno": 2024,
    "roe": 0.2206,
    "margine": 0.096,
    "roa": 0.0439,
    "utileNetto": 6023000000,
    "ricavi": 62753000000,
    "patrimonioNetto": 27307000000
   },
   {
    "anno": 2025,
    "roe": 0.3245,
    "margine": 0.1569,
    "roa": 0.0697,
    "utileNetto": 10593000000,
    "ricavi": 67535000000,
    "patrimonioNetto": 32648000000
   }
  ]
 },
 "NOW": {
  "nome": "ServiceNow, Inc.",
  "anni": [
   {
    "anno": 2010,
    "roe": null,
    "margine": -0.6856,
    "roa": null,
    "utileNetto": -29705000,
    "ricavi": 43329000,
    "patrimonioNetto": -71262000
   },
   {
    "anno": 2011,
    "roe": null,
    "margine": 0.1061,
    "roa": 0.0629,
    "utileNetto": 9830000,
    "ricavi": 92641000,
    "patrimonioNetto": -57426000
   },
   {
    "anno": 2012,
    "roe": -0.1534,
    "margine": -0.1532,
    "roa": -0.0781,
    "utileNetto": -37348000,
    "ricavi": 243712000,
    "patrimonioNetto": 243405000
   },
   {
    "anno": 2013,
    "roe": -0.187,
    "margine": -0.1736,
    "roa": -0.0631,
    "utileNetto": -73708000,
    "ricavi": 424650000,
    "patrimonioNetto": 394259000
   },
   {
    "anno": 2014,
    "roe": -0.4185,
    "margine": -0.2628,
    "roa": -0.1259,
    "utileNetto": -179387000,
    "ricavi": 682563000,
    "patrimonioNetto": 428675000
   },
   {
    "anno": 2015,
    "roe": -0.3501,
    "margine": -0.1973,
    "roa": -0.1098,
    "utileNetto": -198426000,
    "ricavi": 1005480000,
    "patrimonioNetto": 566814000
   },
   {
    "anno": 2016,
    "roe": -0.7656,
    "margine": -0.2978,
    "roa": -0.2037,
    "utileNetto": -414249000,
    "ricavi": 1390985000,
    "patrimonioNetto": 541093000
   },
   {
    "anno": 2017,
    "roe": -0.15,
    "margine": -0.0609,
    "roa": -0.0329,
    "utileNetto": -116846000,
    "ricavi": 1918494000,
    "patrimonioNetto": 778744000
   },
   {
    "anno": 2018,
    "roe": -0.0241,
    "margine": -0.0102,
    "roa": -0.0069,
    "utileNetto": -26704000,
    "ricavi": 2608816000,
    "patrimonioNetto": 1110000000
   },
   {
    "anno": 2019,
    "roe": 0.2946,
    "margine": 0.1811,
    "roa": 0.1041,
    "utileNetto": 626698000,
    "ricavi": 3460000000,
    "patrimonioNetto": 2127000000
   },
   {
    "anno": 2020,
    "roe": 0.042,
    "margine": 0.0263,
    "roa": 0.0137,
    "utileNetto": 119000000,
    "ricavi": 4519000000,
    "patrimonioNetto": 2834000000
   },
   {
    "anno": 2021,
    "roe": 0.0622,
    "margine": 0.039,
    "roa": 0.0213,
    "utileNetto": 230000000,
    "ricavi": 5896000000,
    "patrimonioNetto": 3695000000
   },
   {
    "anno": 2022,
    "roe": 0.0646,
    "margine": 0.0449,
    "roa": 0.0244,
    "utileNetto": 325000000,
    "ricavi": 7245000000,
    "patrimonioNetto": 5032000000
   },
   {
    "anno": 2023,
    "roe": 0.2269,
    "margine": 0.193,
    "roa": 0.0996,
    "utileNetto": 1731000000,
    "ricavi": 8971000000,
    "patrimonioNetto": 7628000000
   },
   {
    "anno": 2024,
    "roe": 0.1483,
    "margine": 0.1297,
    "roa": 0.0699,
    "utileNetto": 1425000000,
    "ricavi": 10984000000,
    "patrimonioNetto": 9609000000
   },
   {
    "anno": 2025,
    "roe": 0.1348,
    "margine": 0.1316,
    "roa": 0.0671,
    "utileNetto": 1748000000,
    "ricavi": 13278000000,
    "patrimonioNetto": 12964000000
   }
  ]
 },
 "INTU": {
  "nome": "INTUIT INC.",
  "anni": [
   {
    "anno": 2008,
    "roe": null,
    "margine": 0.1594,
    "roa": null,
    "utileNetto": 477000000,
    "ricavi": 2993000000,
    "patrimonioNetto": 2080000000
   },
   {
    "anno": 2009,
    "roe": 0.1748,
    "margine": 0.1438,
    "roa": 0.0926,
    "utileNetto": 447000000,
    "ricavi": 3109000000,
    "patrimonioNetto": 2557000000
   },
   {
    "anno": 2010,
    "roe": 0.2035,
    "margine": 0.1687,
    "roa": 0.1104,
    "utileNetto": 574000000,
    "ricavi": 3403000000,
    "patrimonioNetto": 2821000000
   },
   {
    "anno": 2011,
    "roe": 0.2424,
    "margine": 0.1838,
    "roa": 0.1241,
    "utileNetto": 634000000,
    "ricavi": 3449000000,
    "patrimonioNetto": 2616000000
   },
   {
    "anno": 2012,
    "roe": 0.2886,
    "margine": 0.208,
    "roa": 0.1691,
    "utileNetto": 792000000,
    "ricavi": 3808000000,
    "patrimonioNetto": 2744000000
   },
   {
    "anno": 2013,
    "roe": 0.243,
    "margine": 0.2174,
    "roa": 0.1564,
    "utileNetto": 858000000,
    "ricavi": 3946000000,
    "patrimonioNetto": 3531000000
   },
   {
    "anno": 2014,
    "roe": 0.2947,
    "margine": 0.2138,
    "roa": 0.1744,
    "utileNetto": 907000000,
    "ricavi": 4243000000,
    "patrimonioNetto": 3078000000
   },
   {
    "anno": 2015,
    "roe": 0.1565,
    "margine": 0.0871,
    "roa": 0.0735,
    "utileNetto": 365000000,
    "ricavi": 4192000000,
    "patrimonioNetto": 2332000000
   },
   {
    "anno": 2016,
    "roe": 0.6562,
    "margine": 0.2086,
    "roa": 0.2304,
    "utileNetto": 979000000,
    "ricavi": 4694000000,
    "patrimonioNetto": 1492000000
   },
   {
    "anno": 2017,
    "roe": 0.5798,
    "margine": 0.1896,
    "roa": 0.2421,
    "utileNetto": 985000000,
    "ricavi": 5196000000,
    "patrimonioNetto": 1699000000
   },
   {
    "anno": 2018,
    "roe": 0.4719,
    "margine": 0.2206,
    "roa": 0.2589,
    "utileNetto": 1329000000,
    "ricavi": 6025000000,
    "patrimonioNetto": 2816000000
   },
   {
    "anno": 2019,
    "roe": 0.4153,
    "margine": 0.2295,
    "roa": 0.2478,
    "utileNetto": 1557000000,
    "ricavi": 6784000000,
    "patrimonioNetto": 3749000000
   },
   {
    "anno": 2020,
    "roe": 0.3576,
    "margine": 0.2378,
    "roa": 0.167,
    "utileNetto": 1826000000,
    "ricavi": 7679000000,
    "patrimonioNetto": 5106000000
   },
   {
    "anno": 2021,
    "roe": 0.2089,
    "margine": 0.2141,
    "roa": 0.1329,
    "utileNetto": 2062000000,
    "ricavi": 9633000000,
    "patrimonioNetto": 9869000000
   },
   {
    "anno": 2022,
    "roe": 0.1257,
    "margine": 0.1623,
    "roa": 0.0745,
    "utileNetto": 2066000000,
    "ricavi": 12726000000,
    "patrimonioNetto": 16441000000
   },
   {
    "anno": 2023,
    "roe": 0.1381,
    "margine": 0.1659,
    "roa": 0.0858,
    "utileNetto": 2384000000,
    "ricavi": 14368000000,
    "patrimonioNetto": 17269000000
   },
   {
    "anno": 2024,
    "roe": 0.1607,
    "margine": 0.1819,
    "roa": 0.0922,
    "utileNetto": 2963000000,
    "ricavi": 16285000000,
    "patrimonioNetto": 18436000000
   },
   {
    "anno": 2025,
    "roe": 0.1963,
    "margine": 0.2055,
    "roa": 0.1047,
    "utileNetto": 3869000000,
    "ricavi": 18831000000,
    "patrimonioNetto": 19710000000
   }
  ]
 },
 "AMAT": {
  "nome": "APPLIED MATERIALS INC /DE",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.1757,
    "roa": null,
    "utileNetto": 1710196000,
    "ricavi": 9734856000,
    "patrimonioNetto": 7821409000
   },
   {
    "anno": 2008,
    "roe": 0.1273,
    "margine": 0.1182,
    "roa": 0.0873,
    "utileNetto": 960746000,
    "ricavi": 8129240000,
    "patrimonioNetto": 7549000000
   },
   {
    "anno": 2009,
    "roe": -0.043,
    "margine": -0.0608,
    "roa": -0.0319,
    "utileNetto": -305000000,
    "ricavi": 5014000000,
    "patrimonioNetto": 7094000000
   },
   {
    "anno": 2010,
    "roe": 0.1245,
    "margine": 0.0982,
    "roa": 0.0857,
    "utileNetto": 938000000,
    "ricavi": 9549000000,
    "patrimonioNetto": 7536000000
   },
   {
    "anno": 2011,
    "roe": 0.2189,
    "margine": 0.1831,
    "roa": 0.139,
    "utileNetto": 1926000000,
    "ricavi": 10517000000,
    "patrimonioNetto": 8800000000
   },
   {
    "anno": 2012,
    "roe": 0.0151,
    "margine": 0.0125,
    "roa": 0.009,
    "utileNetto": 109000000,
    "ricavi": 8719000000,
    "patrimonioNetto": 7235000000
   },
   {
    "anno": 2013,
    "roe": 0.0361,
    "margine": 0.0341,
    "roa": 0.0213,
    "utileNetto": 256000000,
    "ricavi": 7509000000,
    "patrimonioNetto": 7088000000
   },
   {
    "anno": 2014,
    "roe": 0.1362,
    "margine": 0.1182,
    "roa": 0.0814,
    "utileNetto": 1072000000,
    "ricavi": 9072000000,
    "patrimonioNetto": 7868000000
   },
   {
    "anno": 2015,
    "roe": 0.1809,
    "margine": 0.1426,
    "roa": 0.09,
    "utileNetto": 1377000000,
    "ricavi": 9659000000,
    "patrimonioNetto": 7613000000
   },
   {
    "anno": 2016,
    "roe": 0.2322,
    "margine": 0.159,
    "roa": 0.1181,
    "utileNetto": 1721000000,
    "ricavi": 10825000000,
    "patrimonioNetto": 7413000000
   },
   {
    "anno": 2017,
    "roe": 0.3654,
    "margine": 0.2394,
    "roa": 0.1812,
    "utileNetto": 3519000000,
    "ricavi": 14698000000,
    "patrimonioNetto": 9630000000
   },
   {
    "anno": 2018,
    "roe": 0.4438,
    "margine": 0.1819,
    "roa": 0.1723,
    "utileNetto": 3038000000,
    "ricavi": 16705000000,
    "patrimonioNetto": 6845000000
   },
   {
    "anno": 2019,
    "roe": 0.3294,
    "margine": 0.1852,
    "roa": 0.1422,
    "utileNetto": 2706000000,
    "ricavi": 14608000000,
    "patrimonioNetto": 8214000000
   },
   {
    "anno": 2020,
    "roe": 0.3421,
    "margine": 0.2104,
    "roa": 0.1619,
    "utileNetto": 3619000000,
    "ricavi": 17202000000,
    "patrimonioNetto": 10578000000
   },
   {
    "anno": 2021,
    "roe": 0.4808,
    "margine": 0.2553,
    "roa": 0.228,
    "utileNetto": 5888000000,
    "ricavi": 23063000000,
    "patrimonioNetto": 12247000000
   },
   {
    "anno": 2022,
    "roe": 0.5351,
    "margine": 0.2531,
    "roa": 0.2441,
    "utileNetto": 6525000000,
    "ricavi": 25785000000,
    "patrimonioNetto": 12194000000
   },
   {
    "anno": 2023,
    "roe": 0.4194,
    "margine": 0.2586,
    "roa": 0.2231,
    "utileNetto": 6856000000,
    "ricavi": 26517000000,
    "patrimonioNetto": 16349000000
   },
   {
    "anno": 2024,
    "roe": 0.3777,
    "margine": 0.2641,
    "roa": 0.2086,
    "utileNetto": 7177000000,
    "ricavi": 27176000000,
    "patrimonioNetto": 19001000000
   },
   {
    "anno": 2025,
    "roe": 0.3428,
    "margine": 0.2467,
    "roa": 0.1928,
    "utileNetto": 6998000000,
    "ricavi": 28368000000,
    "patrimonioNetto": 20415000000
   }
  ]
 },
 "MU": {
  "nome": "MICRON TECHNOLOGY INC",
  "anni": [
   {
    "anno": 2009,
    "roe": null,
    "margine": -0.3918,
    "roa": null,
    "utileNetto": -1882000000,
    "ricavi": 4803000000,
    "patrimonioNetto": 6939000000
   },
   {
    "anno": 2010,
    "roe": 0.1885,
    "margine": 0.2181,
    "roa": 0.1259,
    "utileNetto": 1850000000,
    "ricavi": 8482000000,
    "patrimonioNetto": 9816000000
   },
   {
    "anno": 2011,
    "roe": 0.017,
    "margine": 0.019,
    "roa": 0.0113,
    "utileNetto": 167000000,
    "ricavi": 8788000000,
    "patrimonioNetto": 9852000000
   },
   {
    "anno": 2012,
    "roe": -0.1226,
    "margine": -0.1253,
    "roa": -0.072,
    "utileNetto": -1032000000,
    "ricavi": 8234000000,
    "patrimonioNetto": 8417000000
   },
   {
    "anno": 2013,
    "roe": 0.1189,
    "margine": 0.1312,
    "roa": 0.0622,
    "utileNetto": 1190000000,
    "ricavi": 9073000000,
    "patrimonioNetto": 10006000000
   },
   {
    "anno": 2014,
    "roe": 0.2634,
    "margine": 0.1861,
    "roa": 0.1358,
    "utileNetto": 3045000000,
    "ricavi": 16358000000,
    "patrimonioNetto": 11562000000
   },
   {
    "anno": 2015,
    "roe": 0.219,
    "margine": 0.179,
    "roa": 0.1201,
    "utileNetto": 2899000000,
    "ricavi": 16192000000,
    "patrimonioNetto": 13239000000
   },
   {
    "anno": 2016,
    "roe": -0.0213,
    "margine": -0.0223,
    "roa": -0.01,
    "utileNetto": -276000000,
    "ricavi": 12399000000,
    "patrimonioNetto": 12928000000
   },
   {
    "anno": 2017,
    "roe": 0.2614,
    "margine": 0.2504,
    "roa": 0.144,
    "utileNetto": 5089000000,
    "ricavi": 20322000000,
    "patrimonioNetto": 19470000000
   },
   {
    "anno": 2018,
    "roe": 0.4262,
    "margine": 0.4651,
    "roa": 0.3259,
    "utileNetto": 14135000000,
    "ricavi": 30391000000,
    "patrimonioNetto": 33164000000
   },
   {
    "anno": 2019,
    "roe": 0.1717,
    "margine": 0.2697,
    "roa": 0.1291,
    "utileNetto": 6313000000,
    "ricavi": 23406000000,
    "patrimonioNetto": 36770000000
   },
   {
    "anno": 2020,
    "roe": 0.0689,
    "margine": 0.1254,
    "roa": 0.0501,
    "utileNetto": 2687000000,
    "ricavi": 21435000000,
    "patrimonioNetto": 38996000000
   },
   {
    "anno": 2021,
    "roe": 0.1334,
    "margine": 0.2116,
    "roa": 0.0996,
    "utileNetto": 5861000000,
    "ricavi": 27705000000,
    "patrimonioNetto": 43933000000
   },
   {
    "anno": 2022,
    "roe": 0.1741,
    "margine": 0.2824,
    "roa": 0.1311,
    "utileNetto": 8687000000,
    "ricavi": 30758000000,
    "patrimonioNetto": 49907000000
   },
   {
    "anno": 2023,
    "roe": -0.1322,
    "margine": -0.3754,
    "roa": -0.0908,
    "utileNetto": -5833000000,
    "ricavi": 15540000000,
    "patrimonioNetto": 44120000000
   },
   {
    "anno": 2024,
    "roe": 0.0172,
    "margine": 0.031,
    "roa": 0.0112,
    "utileNetto": 778000000,
    "ricavi": 25111000000,
    "patrimonioNetto": 45131000000
   },
   {
    "anno": 2025,
    "roe": 0.1576,
    "margine": 0.2284,
    "roa": 0.1031,
    "utileNetto": 8539000000,
    "ricavi": 37378000000,
    "patrimonioNetto": 54165000000
   }
  ]
 },
 "JPM": {
  "nome": "JPMORGAN CHASE & CO",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
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
 "BAC": {
  "nome": "BANK OF AMERICA CORP /DE/",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.2242,
    "roa": null,
    "utileNetto": 14982000000,
    "ricavi": 66833000000,
    "patrimonioNetto": 146803000000
   },
   {
    "anno": 2008,
    "roe": null,
    "margine": 0.0551,
    "roa": null,
    "utileNetto": 4008000000,
    "ricavi": 72782000000,
    "patrimonioNetto": 177052000000
   },
   {
    "anno": 2009,
    "roe": 0.0271,
    "margine": 0.0525,
    "roa": 0.0027,
    "utileNetto": 6276000000,
    "ricavi": 119643000000,
    "patrimonioNetto": 231444000000
   },
   {
    "anno": 2010,
    "roe": -0.0098,
    "margine": -0.0203,
    "roa": -0.001,
    "utileNetto": -2238000000,
    "ricavi": 110220000000,
    "patrimonioNetto": 228248000000
   },
   {
    "anno": 2011,
    "roe": 0.0063,
    "margine": 0.0155,
    "roa": 0.0007,
    "utileNetto": 1446000000,
    "ricavi": 93454000000,
    "patrimonioNetto": 230101000000
   },
   {
    "anno": 2012,
    "roe": 0.0177,
    "margine": 0.0503,
    "roa": 0.0019,
    "utileNetto": 4188000000,
    "ricavi": 83334000000,
    "patrimonioNetto": 236956000000
   },
   {
    "anno": 2013,
    "roe": 0.0492,
    "margine": 0.1285,
    "roa": 0.0054,
    "utileNetto": 11431000000,
    "ricavi": 88942000000,
    "patrimonioNetto": 232475000000
   },
   {
    "anno": 2014,
    "roe": 0.0227,
    "margine": 0.0643,
    "roa": 0.0026,
    "utileNetto": 5520000000,
    "ricavi": 85894000000,
    "patrimonioNetto": 243476000000
   },
   {
    "anno": 2015,
    "roe": 0.0622,
    "margine": 0.1918,
    "roa": 0.0074,
    "utileNetto": 15910000000,
    "ricavi": 82965000000,
    "patrimonioNetto": 255615000000
   },
   {
    "anno": 2016,
    "roe": 0.067,
    "margine": 0.2129,
    "roa": 0.0081,
    "utileNetto": 17822000000,
    "ricavi": 83701000000,
    "patrimonioNetto": 266195000000
   },
   {
    "anno": 2017,
    "roe": 0.0682,
    "margine": 0.2093,
    "roa": 0.008,
    "utileNetto": 18232000000,
    "ricavi": 87126000000,
    "patrimonioNetto": 267146000000
   },
   {
    "anno": 2018,
    "roe": 0.1061,
    "margine": 0.3092,
    "roa": 0.012,
    "utileNetto": 28147000000,
    "ricavi": 91020000000,
    "patrimonioNetto": 265325000000
   },
   {
    "anno": 2019,
    "roe": 0.1036,
    "margine": 0.3006,
    "roa": 0.0113,
    "utileNetto": 27430000000,
    "ricavi": 91244000000,
    "patrimonioNetto": 264810000000
   },
   {
    "anno": 2020,
    "roe": 0.0656,
    "margine": 0.2092,
    "roa": 0.0063,
    "utileNetto": 17894000000,
    "ricavi": 85528000000,
    "patrimonioNetto": 272924000000
   },
   {
    "anno": 2021,
    "roe": 0.1184,
    "margine": 0.3588,
    "roa": 0.0101,
    "utileNetto": 31978000000,
    "ricavi": 89113000000,
    "patrimonioNetto": 270066000000
   },
   {
    "anno": 2022,
    "roe": 0.1008,
    "margine": 0.2899,
    "roa": 0.009,
    "utileNetto": 27528000000,
    "ricavi": 94950000000,
    "patrimonioNetto": 273197000000
   },
   {
    "anno": 2023,
    "roe": 0.0906,
    "margine": 0.256,
    "roa": 0.0083,
    "utileNetto": 26305000000,
    "ricavi": 102769000000,
    "patrimonioNetto": 290209000000
   },
   {
    "anno": 2024,
    "roe": 0.0918,
    "margine": 0.2548,
    "roa": 0.0083,
    "utileNetto": 26973000000,
    "ricavi": 105856000000,
    "patrimonioNetto": 293963000000
   },
   {
    "anno": 2025,
    "roe": 0.1006,
    "margine": 0.2698,
    "roa": 0.0089,
    "utileNetto": 30509000000,
    "ricavi": 113097000000,
    "patrimonioNetto": 303243000000
   }
  ]
 },
 "WFC": {
  "nome": "WELLS FARGO & COMPANY/MN",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": null,
    "roa": null,
    "utileNetto": 8057000000,
    "ricavi": null,
    "patrimonioNetto": 47886000000
   },
   {
    "anno": 2008,
    "roe": 0.0259,
    "margine": null,
    "roa": 0.002,
    "utileNetto": 2655000000,
    "ricavi": null,
    "patrimonioNetto": 102316000000
   },
   {
    "anno": 2009,
    "roe": 0.1073,
    "margine": null,
    "roa": 0.0099,
    "utileNetto": 12275000000,
    "ricavi": null,
    "patrimonioNetto": 114359000000
   },
   {
    "anno": 2010,
    "roe": 0.0967,
    "margine": null,
    "roa": 0.0098,
    "utileNetto": 12362000000,
    "ricavi": null,
    "patrimonioNetto": 127889000000
   },
   {
    "anno": 2011,
    "roe": 0.112,
    "margine": null,
    "roa": 0.0121,
    "utileNetto": 15869000000,
    "ricavi": null,
    "patrimonioNetto": 141687000000
   },
   {
    "anno": 2012,
    "roe": 0.1189,
    "margine": null,
    "roa": 0.0133,
    "utileNetto": 18897000000,
    "ricavi": null,
    "patrimonioNetto": 158911000000
   },
   {
    "anno": 2013,
    "roe": 0.1279,
    "margine": null,
    "roa": 0.0144,
    "utileNetto": 21878000000,
    "ricavi": null,
    "patrimonioNetto": 171008000000
   },
   {
    "anno": 2014,
    "roe": 0.1245,
    "margine": null,
    "roa": 0.0137,
    "utileNetto": 23057000000,
    "ricavi": null,
    "patrimonioNetto": 185262000000
   },
   {
    "anno": 2015,
    "roe": 0.1181,
    "margine": null,
    "roa": 0.0128,
    "utileNetto": 22894000000,
    "ricavi": null,
    "patrimonioNetto": 193891000000
   },
   {
    "anno": 2016,
    "roe": 0.1094,
    "margine": 0.2485,
    "roa": 0.0114,
    "utileNetto": 21938000000,
    "ricavi": 88267000000,
    "patrimonioNetto": 200497000000
   },
   {
    "anno": 2017,
    "roe": 0.1066,
    "margine": 0.251,
    "roa": 0.0114,
    "utileNetto": 22183000000,
    "ricavi": 88389000000,
    "patrimonioNetto": 208079000000
   },
   {
    "anno": 2018,
    "roe": 0.1136,
    "margine": 0.2592,
    "roa": 0.0118,
    "utileNetto": 22393000000,
    "ricavi": 86408000000,
    "patrimonioNetto": 197066000000
   },
   {
    "anno": 2019,
    "roe": 0.105,
    "margine": 0.2318,
    "roa": 0.0102,
    "utileNetto": 19715000000,
    "ricavi": 85063000000,
    "patrimonioNetto": 187702000000
   },
   {
    "anno": 2020,
    "roe": 0.0183,
    "margine": null,
    "roa": 0.0017,
    "utileNetto": 3377000000,
    "ricavi": null,
    "patrimonioNetto": 184994000000
   },
   {
    "anno": 2021,
    "roe": 0.1164,
    "margine": null,
    "roa": 0.0113,
    "utileNetto": 22109000000,
    "ricavi": null,
    "patrimonioNetto": 189889000000
   },
   {
    "anno": 2022,
    "roe": 0.0751,
    "margine": null,
    "roa": 0.0073,
    "utileNetto": 13677000000,
    "ricavi": null,
    "patrimonioNetto": 182213000000
   },
   {
    "anno": 2023,
    "roe": 0.1021,
    "margine": null,
    "roa": 0.0099,
    "utileNetto": 19142000000,
    "ricavi": null,
    "patrimonioNetto": 187443000000
   },
   {
    "anno": 2024,
    "roe": 0.1101,
    "margine": null,
    "roa": 0.0102,
    "utileNetto": 19722000000,
    "ricavi": null,
    "patrimonioNetto": 179120000000
   },
   {
    "anno": 2025,
    "roe": 0.1178,
    "margine": null,
    "roa": 0.0099,
    "utileNetto": 21338000000,
    "ricavi": null,
    "patrimonioNetto": 181117000000
   }
  ]
 },
 "GS": {
  "nome": "GOLDMAN SACHS GROUP INC",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": null,
    "roa": null,
    "utileNetto": 11599000000,
    "ricavi": null,
    "patrimonioNetto": 42800000000
   },
   {
    "anno": 2008,
    "roe": 0.0361,
    "margine": null,
    "roa": 0.0026,
    "utileNetto": 2322000000,
    "ricavi": null,
    "patrimonioNetto": 64369000000
   },
   {
    "anno": 2009,
    "roe": 0.1893,
    "margine": null,
    "roa": 0.0158,
    "utileNetto": 13385000000,
    "ricavi": null,
    "patrimonioNetto": 70714000000
   },
   {
    "anno": 2010,
    "roe": 0.108,
    "margine": null,
    "roa": 0.0092,
    "utileNetto": 8354000000,
    "ricavi": null,
    "patrimonioNetto": 77356000000
   },
   {
    "anno": 2011,
    "roe": 0.0631,
    "margine": null,
    "roa": 0.0048,
    "utileNetto": 4442000000,
    "ricavi": null,
    "patrimonioNetto": 70379000000
   },
   {
    "anno": 2012,
    "roe": 0.0987,
    "margine": null,
    "roa": 0.008,
    "utileNetto": 7475000000,
    "ricavi": null,
    "patrimonioNetto": 75716000000
   },
   {
    "anno": 2013,
    "roe": 0.1025,
    "margine": null,
    "roa": 0.0088,
    "utileNetto": 8040000000,
    "ricavi": null,
    "patrimonioNetto": 78467000000
   },
   {
    "anno": 2014,
    "roe": 0.1024,
    "margine": null,
    "roa": 0.0099,
    "utileNetto": 8477000000,
    "ricavi": null,
    "patrimonioNetto": 82797000000
   },
   {
    "anno": 2015,
    "roe": 0.0701,
    "margine": null,
    "roa": 0.0071,
    "utileNetto": 6083000000,
    "ricavi": null,
    "patrimonioNetto": 86728000000
   },
   {
    "anno": 2016,
    "roe": 0.0851,
    "margine": null,
    "roa": 0.0086,
    "utileNetto": 7398000000,
    "ricavi": null,
    "patrimonioNetto": 86893000000
   },
   {
    "anno": 2017,
    "roe": 0.0521,
    "margine": null,
    "roa": 0.0047,
    "utileNetto": 4286000000,
    "ricavi": null,
    "patrimonioNetto": 82243000000
   },
   {
    "anno": 2018,
    "roe": 0.116,
    "margine": null,
    "roa": 0.0112,
    "utileNetto": 10459000000,
    "ricavi": null,
    "patrimonioNetto": 90185000000
   },
   {
    "anno": 2019,
    "roe": 0.0938,
    "margine": null,
    "roa": 0.0085,
    "utileNetto": 8466000000,
    "ricavi": null,
    "patrimonioNetto": 90265000000
   },
   {
    "anno": 2020,
    "roe": 0.0986,
    "margine": null,
    "roa": 0.0081,
    "utileNetto": 9459000000,
    "ricavi": null,
    "patrimonioNetto": 95932000000
   },
   {
    "anno": 2021,
    "roe": 0.1968,
    "margine": null,
    "roa": 0.0148,
    "utileNetto": 21635000000,
    "ricavi": null,
    "patrimonioNetto": 109926000000
   },
   {
    "anno": 2022,
    "roe": 0.0961,
    "margine": null,
    "roa": 0.0078,
    "utileNetto": 11261000000,
    "ricavi": null,
    "patrimonioNetto": 117189000000
   },
   {
    "anno": 2023,
    "roe": 0.0728,
    "margine": null,
    "roa": 0.0052,
    "utileNetto": 8516000000,
    "ricavi": null,
    "patrimonioNetto": 116905000000
   },
   {
    "anno": 2024,
    "roe": 0.117,
    "margine": null,
    "roa": 0.0085,
    "utileNetto": 14276000000,
    "ricavi": null,
    "patrimonioNetto": 121996000000
   },
   {
    "anno": 2025,
    "roe": 0.1374,
    "margine": null,
    "roa": 0.0095,
    "utileNetto": 17176000000,
    "ricavi": null,
    "patrimonioNetto": 124972000000
   }
  ]
 },
 "MS": {
  "nome": "MORGAN STANLEY",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.1212,
    "roa": null,
    "utileNetto": 3209000000,
    "ricavi": 26478000000,
    "patrimonioNetto": 32897000000
   },
   {
    "anno": 2008,
    "roe": 0.0345,
    "margine": 0.0771,
    "roa": 0.0025,
    "utileNetto": 1707000000,
    "ricavi": 22140000000,
    "patrimonioNetto": 49456000000
   },
   {
    "anno": 2009,
    "roe": 0.0255,
    "margine": 0.0578,
    "roa": 0.0017,
    "utileNetto": 1346000000,
    "ricavi": 23280000000,
    "patrimonioNetto": 52780000000
   },
   {
    "anno": 2010,
    "roe": 0.0719,
    "margine": 0.1506,
    "roa": 0.0058,
    "utileNetto": 4703000000,
    "ricavi": 31230000000,
    "patrimonioNetto": 65407000000
   },
   {
    "anno": 2011,
    "roe": 0.0586,
    "margine": 0.1275,
    "roa": 0.0055,
    "utileNetto": 4110000000,
    "ricavi": 32227000000,
    "patrimonioNetto": 70078000000
   },
   {
    "anno": 2012,
    "roe": 0.001,
    "margine": 0.0026,
    "roa": 0.0001,
    "utileNetto": 68000000,
    "ricavi": 26178000000,
    "patrimonioNetto": 65428000000
   },
   {
    "anno": 2013,
    "roe": 0.0425,
    "margine": 0.0902,
    "roa": 0.0035,
    "utileNetto": 2932000000,
    "ricavi": 32493000000,
    "patrimonioNetto": 69030000000
   },
   {
    "anno": 2014,
    "roe": 0.0481,
    "margine": 0.1012,
    "roa": 0.0043,
    "utileNetto": 3467000000,
    "ricavi": 34275000000,
    "patrimonioNetto": 72104000000
   },
   {
    "anno": 2015,
    "roe": 0.0804,
    "margine": null,
    "roa": 0.0078,
    "utileNetto": 6127000000,
    "ricavi": null,
    "patrimonioNetto": 76184000000
   },
   {
    "anno": 2016,
    "roe": 0.0775,
    "margine": null,
    "roa": 0.0073,
    "utileNetto": 5979000000,
    "ricavi": null,
    "patrimonioNetto": 77177000000
   },
   {
    "anno": 2017,
    "roe": 0.0779,
    "margine": null,
    "roa": 0.0072,
    "utileNetto": 6111000000,
    "ricavi": null,
    "patrimonioNetto": 78466000000
   },
   {
    "anno": 2018,
    "roe": 0.1075,
    "margine": null,
    "roa": 0.0102,
    "utileNetto": 8748000000,
    "ricavi": null,
    "patrimonioNetto": 81406000000
   },
   {
    "anno": 2019,
    "roe": 0.1093,
    "margine": null,
    "roa": 0.0101,
    "utileNetto": 9042000000,
    "ricavi": null,
    "patrimonioNetto": 82697000000
   },
   {
    "anno": 2020,
    "roe": 0.1066,
    "margine": null,
    "roa": 0.0099,
    "utileNetto": 10996000000,
    "ricavi": null,
    "patrimonioNetto": 103149000000
   },
   {
    "anno": 2021,
    "roe": 0.141,
    "margine": null,
    "roa": 0.0127,
    "utileNetto": 15034000000,
    "ricavi": null,
    "patrimonioNetto": 106598000000
   },
   {
    "anno": 2022,
    "roe": 0.1089,
    "margine": null,
    "roa": 0.0093,
    "utileNetto": 11029000000,
    "ricavi": null,
    "patrimonioNetto": 101231000000
   },
   {
    "anno": 2023,
    "roe": 0.0909,
    "margine": null,
    "roa": 0.0076,
    "utileNetto": 9087000000,
    "ricavi": null,
    "patrimonioNetto": 99982000000
   },
   {
    "anno": 2024,
    "roe": 0.1281,
    "margine": null,
    "roa": 0.011,
    "utileNetto": 13390000000,
    "ricavi": null,
    "patrimonioNetto": 104511000000
   },
   {
    "anno": 2025,
    "roe": 0.151,
    "margine": null,
    "roa": 0.0119,
    "utileNetto": 16861000000,
    "ricavi": null,
    "patrimonioNetto": 111632000000
   }
  ]
 },
 "C": {
  "nome": "CITIGROUP INC",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.0468,
    "roa": null,
    "utileNetto": 3617000000,
    "ricavi": 77300000000,
    "patrimonioNetto": 118755000000
   },
   {
    "anno": 2008,
    "roe": -0.1922,
    "margine": -0.5365,
    "roa": -0.0143,
    "utileNetto": -27684000000,
    "ricavi": 51599000000,
    "patrimonioNetto": 144022000000
   },
   {
    "anno": 2009,
    "roe": -0.0105,
    "margine": -0.02,
    "roa": -0.0009,
    "utileNetto": -1606000000,
    "ricavi": 80285000000,
    "patrimonioNetto": 152700000000
   },
   {
    "anno": 2010,
    "roe": 0.0639,
    "margine": 0.1224,
    "roa": 0.0055,
    "utileNetto": 10602000000,
    "ricavi": 86601000000,
    "patrimonioNetto": 165789000000
   },
   {
    "anno": 2011,
    "roe": 0.0616,
    "margine": 0.1431,
    "roa": 0.0059,
    "utileNetto": 11067000000,
    "ricavi": 77331000000,
    "patrimonioNetto": 179573000000
   },
   {
    "anno": 2012,
    "roe": 0.0395,
    "margine": 0.109,
    "roa": 0.004,
    "utileNetto": 7541000000,
    "ricavi": 69190000000,
    "patrimonioNetto": 190997000000
   },
   {
    "anno": 2013,
    "roe": 0.0664,
    "margine": 0.178,
    "roa": 0.0073,
    "utileNetto": 13659000000,
    "ricavi": 76724000000,
    "patrimonioNetto": 205786000000
   },
   {
    "anno": 2014,
    "roe": 0.0345,
    "margine": 0.0947,
    "roa": 0.004,
    "utileNetto": 7310000000,
    "ricavi": 77219000000,
    "patrimonioNetto": 211696000000
   },
   {
    "anno": 2015,
    "roe": 0.0773,
    "margine": 0.2258,
    "roa": 0.01,
    "utileNetto": 17242000000,
    "ricavi": 76354000000,
    "patrimonioNetto": 223092000000
   },
   {
    "anno": 2016,
    "roe": 0.0659,
    "margine": 0.2106,
    "roa": 0.0083,
    "utileNetto": 14912000000,
    "ricavi": 70797000000,
    "patrimonioNetto": 226143000000
   },
   {
    "anno": 2017,
    "roe": -0.0337,
    "margine": -0.0938,
    "roa": -0.0037,
    "utileNetto": -6798000000,
    "ricavi": 72444000000,
    "patrimonioNetto": 201672000000
   },
   {
    "anno": 2018,
    "roe": 0.0916,
    "margine": 0.2477,
    "roa": 0.0094,
    "utileNetto": 18045000000,
    "ricavi": 72854000000,
    "patrimonioNetto": 197074000000
   },
   {
    "anno": 2019,
    "roe": 0.1,
    "margine": 0.2584,
    "roa": 0.0099,
    "utileNetto": 19401000000,
    "ricavi": 75067000000,
    "patrimonioNetto": 193946000000
   },
   {
    "anno": 2020,
    "roe": 0.0552,
    "margine": 0.1463,
    "roa": 0.0049,
    "utileNetto": 11047000000,
    "ricavi": 75501000000,
    "patrimonioNetto": 200200000000
   },
   {
    "anno": 2021,
    "roe": 0.1083,
    "margine": 0.3054,
    "roa": 0.0096,
    "utileNetto": 21952000000,
    "ricavi": 71884000000,
    "patrimonioNetto": 202672000000
   },
   {
    "anno": 2022,
    "roe": 0.0735,
    "margine": 0.197,
    "roa": 0.0061,
    "utileNetto": 14845000000,
    "ricavi": 75338000000,
    "patrimonioNetto": 201838000000
   },
   {
    "anno": 2023,
    "roe": 0.0447,
    "margine": 0.1182,
    "roa": 0.0038,
    "utileNetto": 9228000000,
    "ricavi": 78066000000,
    "patrimonioNetto": 206251000000
   },
   {
    "anno": 2024,
    "roe": 0.0608,
    "margine": 0.1571,
    "roa": 0.0054,
    "utileNetto": 12682000000,
    "ricavi": 80722000000,
    "patrimonioNetto": 208598000000
   },
   {
    "anno": 2025,
    "roe": 0.0674,
    "margine": 0.1679,
    "roa": 0.0054,
    "utileNetto": 14306000000,
    "ricavi": 85225000000,
    "patrimonioNetto": 212291000000
   }
  ]
 },
 "SCHW": {
  "nome": "SCHWAB CHARLES CORP",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.482,
    "roa": null,
    "utileNetto": 2407000000,
    "ricavi": 4994000000,
    "patrimonioNetto": 3732000000
   },
   {
    "anno": 2008,
    "roe": 0.2984,
    "margine": 0.2353,
    "roa": 0.0235,
    "utileNetto": 1212000000,
    "ricavi": 5150000000,
    "patrimonioNetto": 4061000000
   },
   {
    "anno": 2009,
    "roe": 0.1551,
    "margine": 0.1877,
    "roa": 0.0104,
    "utileNetto": 787000000,
    "ricavi": 4193000000,
    "patrimonioNetto": 5073000000
   },
   {
    "anno": 2010,
    "roe": 0.0729,
    "margine": 0.1069,
    "roa": 0.0049,
    "utileNetto": 454000000,
    "ricavi": 4248000000,
    "patrimonioNetto": 6226000000
   },
   {
    "anno": 2011,
    "roe": 0.112,
    "margine": 0.1842,
    "roa": 0.008,
    "utileNetto": 864000000,
    "ricavi": 4691000000,
    "patrimonioNetto": 7714000000
   },
   {
    "anno": 2012,
    "roe": 0.0968,
    "margine": 0.19,
    "roa": 0.0069,
    "utileNetto": 928000000,
    "ricavi": 4883000000,
    "patrimonioNetto": 9589000000
   },
   {
    "anno": 2013,
    "roe": 0.1032,
    "margine": 0.1971,
    "roa": 0.0075,
    "utileNetto": 1071000000,
    "ricavi": 5435000000,
    "patrimonioNetto": 10381000000
   },
   {
    "anno": 2014,
    "roe": 0.1119,
    "margine": 0.2181,
    "roa": 0.0085,
    "utileNetto": 1321000000,
    "ricavi": 6058000000,
    "patrimonioNetto": 11803000000
   },
   {
    "anno": 2015,
    "roe": 0.108,
    "margine": 0.2268,
    "roa": 0.0079,
    "utileNetto": 1447000000,
    "ricavi": 6380000000,
    "patrimonioNetto": 13402000000
   },
   {
    "anno": 2016,
    "roe": 0.115,
    "margine": 0.2526,
    "roa": 0.0085,
    "utileNetto": 1889000000,
    "ricavi": 7478000000,
    "patrimonioNetto": 16421000000
   },
   {
    "anno": 2017,
    "roe": 0.1271,
    "margine": 0.2731,
    "roa": 0.0097,
    "utileNetto": 2354000000,
    "ricavi": 8618000000,
    "patrimonioNetto": 18525000000
   },
   {
    "anno": 2018,
    "roe": 0.1697,
    "margine": 0.3461,
    "roa": 0.0118,
    "utileNetto": 3507000000,
    "ricavi": 10132000000,
    "patrimonioNetto": 20670000000
   },
   {
    "anno": 2019,
    "roe": 0.1703,
    "margine": 0.3455,
    "roa": 0.0126,
    "utileNetto": 3704000000,
    "ricavi": 10721000000,
    "patrimonioNetto": 21745000000
   },
   {
    "anno": 2020,
    "roe": 0.0588,
    "margine": 0.2822,
    "roa": 0.006,
    "utileNetto": 3299000000,
    "ricavi": 11691000000,
    "patrimonioNetto": 56060000000
   },
   {
    "anno": 2021,
    "roe": 0.1041,
    "margine": 0.3161,
    "roa": 0.0088,
    "utileNetto": 5855000000,
    "ricavi": 18520000000,
    "patrimonioNetto": 56261000000
   },
   {
    "anno": 2022,
    "roe": 0.1962,
    "margine": 0.346,
    "roa": 0.013,
    "utileNetto": 7183000000,
    "ricavi": 20762000000,
    "patrimonioNetto": 36608000000
   },
   {
    "anno": 2023,
    "roe": 0.1237,
    "margine": 0.269,
    "roa": 0.0103,
    "utileNetto": 5067000000,
    "ricavi": 18837000000,
    "patrimonioNetto": 40958000000
   },
   {
    "anno": 2024,
    "roe": 0.1228,
    "margine": 0.3031,
    "roa": 0.0124,
    "utileNetto": 5942000000,
    "ricavi": 19606000000,
    "patrimonioNetto": 48375000000
   },
   {
    "anno": 2025,
    "roe": 0.1791,
    "margine": 0.3701,
    "roa": 0.018,
    "utileNetto": 8852000000,
    "ricavi": 23921000000,
    "patrimonioNetto": 49425000000
   }
  ]
 },
 "BLK": {
  "nome": "BlackRock, Inc.",
  "anni": [
   {
    "anno": 2022,
    "roe": null,
    "margine": 0.4681,
    "roa": null,
    "utileNetto": 5178000000,
    "ricavi": 11061000000,
    "patrimonioNetto": 37876000000
   },
   {
    "anno": 2023,
    "roe": 0.1393,
    "margine": 0.3081,
    "roa": 0.0447,
    "utileNetto": 5502000000,
    "ricavi": 17859000000,
    "patrimonioNetto": 39500000000
   },
   {
    "anno": 2024,
    "roe": 0.1341,
    "margine": 0.3121,
    "roa": 0.0459,
    "utileNetto": 6369000000,
    "ricavi": 20407000000,
    "patrimonioNetto": 47495000000
   },
   {
    "anno": 2025,
    "roe": 0.0994,
    "margine": 0.2293,
    "roa": 0.0327,
    "utileNetto": 5553000000,
    "ricavi": 24216000000,
    "patrimonioNetto": 55888000000
   }
  ]
 },
 "SPGI": {
  "nome": "S&P Global Inc.",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.1497,
    "roa": null,
    "utileNetto": 1013559000,
    "ricavi": 6772281000,
    "patrimonioNetto": 1677762000
   },
   {
    "anno": 2008,
    "roe": 0.5909,
    "margine": 0.1258,
    "roa": 0.1315,
    "utileNetto": 799491000,
    "ricavi": 6355055000,
    "patrimonioNetto": 1353000000
   },
   {
    "anno": 2009,
    "roe": 0.379,
    "margine": 0.1245,
    "roa": 0.1129,
    "utileNetto": 731000000,
    "ricavi": 5870000000,
    "patrimonioNetto": 1929000000
   },
   {
    "anno": 2010,
    "roe": 0.3613,
    "margine": 0.2275,
    "roa": 0.1175,
    "utileNetto": 828000000,
    "ricavi": 3639000000,
    "patrimonioNetto": 2292000000
   },
   {
    "anno": 2011,
    "roe": 0.5751,
    "margine": 0.2304,
    "roa": 0.1376,
    "utileNetto": 911000000,
    "ricavi": 3954000000,
    "patrimonioNetto": 1584000000
   },
   {
    "anno": 2012,
    "roe": 0.5202,
    "margine": 0.1023,
    "roa": 0.062,
    "utileNetto": 437000000,
    "ricavi": 4270000000,
    "patrimonioNetto": 840000000
   },
   {
    "anno": 2013,
    "roe": 1.0238,
    "margine": 0.2926,
    "roa": 0.227,
    "utileNetto": 1376000000,
    "ricavi": 4702000000,
    "patrimonioNetto": 1344000000
   },
   {
    "anno": 2014,
    "roe": -0.2134,
    "margine": -0.0228,
    "roa": -0.017,
    "utileNetto": -115000000,
    "ricavi": 5051000000,
    "patrimonioNetto": 539000000
   },
   {
    "anno": 2015,
    "roe": null,
    "margine": 0.2176,
    "roa": 0.1413,
    "utileNetto": 1156000000,
    "ricavi": 5313000000,
    "patrimonioNetto": 243000000
   },
   {
    "anno": 2016,
    "roe": 3.0043,
    "margine": 0.372,
    "roa": 0.2429,
    "utileNetto": 2106000000,
    "ricavi": 5661000000,
    "patrimonioNetto": 701000000
   },
   {
    "anno": 2017,
    "roe": 1.953,
    "margine": 0.2467,
    "roa": 0.1587,
    "utileNetto": 1496000000,
    "ricavi": 6063000000,
    "patrimonioNetto": 766000000
   },
   {
    "anno": 2018,
    "roe": 2.8626,
    "margine": 0.3129,
    "roa": 0.2074,
    "utileNetto": 1958000000,
    "ricavi": 6258000000,
    "patrimonioNetto": 684000000
   },
   {
    "anno": 2019,
    "roe": null,
    "margine": 0.3169,
    "roa": 0.1871,
    "utileNetto": 2123000000,
    "ricavi": 6699000000,
    "patrimonioNetto": 536000000
   },
   {
    "anno": 2020,
    "roe": null,
    "margine": 0.3143,
    "roa": 0.1866,
    "utileNetto": 2339000000,
    "ricavi": 7442000000,
    "patrimonioNetto": 571000000
   },
   {
    "anno": 2021,
    "roe": 1.4352,
    "margine": 0.3645,
    "roa": 0.2013,
    "utileNetto": 3024000000,
    "ricavi": 8297000000,
    "patrimonioNetto": 2107000000
   },
   {
    "anno": 2022,
    "roe": 0.089,
    "margine": 0.2905,
    "roa": 0.0526,
    "utileNetto": 3248000000,
    "ricavi": 11181000000,
    "patrimonioNetto": 36477000000
   },
   {
    "anno": 2023,
    "roe": 0.0766,
    "margine": 0.2101,
    "roa": 0.0433,
    "utileNetto": 2626000000,
    "ricavi": 12497000000,
    "patrimonioNetto": 34300000000
   },
   {
    "anno": 2024,
    "roe": 0.1162,
    "margine": 0.2711,
    "roa": 0.064,
    "utileNetto": 3852000000,
    "ricavi": 14208000000,
    "patrimonioNetto": 33159000000
   },
   {
    "anno": 2025,
    "roe": 0.1436,
    "margine": 0.2915,
    "roa": 0.0731,
    "utileNetto": 4471000000,
    "ricavi": 15336000000,
    "patrimonioNetto": 31127000000
   }
  ]
 },
 "AXP": {
  "nome": "AMERICAN EXPRESS CO",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": null,
    "roa": null,
    "utileNetto": 4012000000,
    "ricavi": null,
    "patrimonioNetto": 11029000000
   },
   {
    "anno": 2008,
    "roe": 0.2279,
    "margine": 0.0952,
    "roa": 0.0214,
    "utileNetto": 2699000000,
    "ricavi": 28365000000,
    "patrimonioNetto": 11841000000
   },
   {
    "anno": 2009,
    "roe": 0.1686,
    "margine": 0.0869,
    "roa": 0.017,
    "utileNetto": 2130000000,
    "ricavi": 24523000000,
    "patrimonioNetto": 12637000000
   },
   {
    "anno": 2010,
    "roe": 0.2159,
    "margine": 0.1458,
    "roa": 0.0277,
    "utileNetto": 4057000000,
    "ricavi": 27819000000,
    "patrimonioNetto": 18794000000
   },
   {
    "anno": 2011,
    "roe": 0.2626,
    "margine": null,
    "roa": 0.0322,
    "utileNetto": 4935000000,
    "ricavi": null,
    "patrimonioNetto": 18794000000
   },
   {
    "anno": 2012,
    "roe": 0.2373,
    "margine": null,
    "roa": 0.0293,
    "utileNetto": 4482000000,
    "ricavi": null,
    "patrimonioNetto": 18886000000
   },
   {
    "anno": 2013,
    "roe": 0.2749,
    "margine": null,
    "roa": 0.035,
    "utileNetto": 5359000000,
    "ricavi": null,
    "patrimonioNetto": 19496000000
   },
   {
    "anno": 2014,
    "roe": 0.2847,
    "margine": null,
    "roa": 0.037,
    "utileNetto": 5885000000,
    "ricavi": null,
    "patrimonioNetto": 20673000000
   },
   {
    "anno": 2015,
    "roe": 0.2497,
    "margine": null,
    "roa": 0.0321,
    "utileNetto": 5163000000,
    "ricavi": null,
    "patrimonioNetto": 20673000000
   },
   {
    "anno": 2016,
    "roe": 0.2619,
    "margine": 0.2218,
    "roa": 0.0338,
    "utileNetto": 5375000000,
    "ricavi": 24235000000,
    "patrimonioNetto": 20523000000
   },
   {
    "anno": 2017,
    "roe": 0.1505,
    "margine": 0.1109,
    "roa": 0.0152,
    "utileNetto": 2748000000,
    "ricavi": 24780000000,
    "patrimonioNetto": 18261000000
   },
   {
    "anno": 2018,
    "roe": 0.3105,
    "margine": 0.2601,
    "roa": 0.0366,
    "utileNetto": 6921000000,
    "ricavi": 26607000000,
    "patrimonioNetto": 22290000000
   },
   {
    "anno": 2019,
    "roe": 0.293,
    "margine": 0.24,
    "roa": 0.0341,
    "utileNetto": 6759000000,
    "ricavi": 28159000000,
    "patrimonioNetto": 23071000000
   },
   {
    "anno": 2020,
    "roe": 0.1364,
    "margine": 0.1427,
    "roa": 0.0164,
    "utileNetto": 3135000000,
    "ricavi": 21974000000,
    "patrimonioNetto": 22984000000
   },
   {
    "anno": 2021,
    "roe": 0.3634,
    "margine": 0.2908,
    "roa": 0.0426,
    "utileNetto": 8060000000,
    "ricavi": 27716000000,
    "patrimonioNetto": 22177000000
   },
   {
    "anno": 2022,
    "roe": 0.3041,
    "margine": 0.2196,
    "roa": 0.0329,
    "utileNetto": 7514000000,
    "ricavi": 34219000000,
    "patrimonioNetto": 24711000000
   },
   {
    "anno": 2023,
    "roe": 0.2985,
    "margine": 0.225,
    "roa": 0.0321,
    "utileNetto": 8374000000,
    "ricavi": 37218000000,
    "patrimonioNetto": 28057000000
   },
   {
    "anno": 2024,
    "roe": 0.3347,
    "margine": 0.2609,
    "roa": 0.0373,
    "utileNetto": 10129000000,
    "ricavi": 38825000000,
    "patrimonioNetto": 30264000000
   },
   {
    "anno": 2025,
    "roe": 0.3236,
    "margine": 0.2623,
    "roa": 0.0361,
    "utileNetto": 10833000000,
    "ricavi": 41304000000,
    "patrimonioNetto": 33474000000
   }
  ]
 },
 "V": {
  "nome": "VISA INC.",
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
 "MA": {
  "nome": "Mastercard Inc",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.267,
    "roa": null,
    "utileNetto": 1085886000,
    "ricavi": 4067599000,
    "patrimonioNetto": 3032000000
   },
   {
    "anno": 2008,
    "roe": -0.1315,
    "margine": -0.0509,
    "roa": -0.0392,
    "utileNetto": -254000000,
    "ricavi": 4992000000,
    "patrimonioNetto": 1932000000
   },
   {
    "anno": 2009,
    "roe": 0.4166,
    "margine": 0.2869,
    "roa": 0.1959,
    "utileNetto": 1463000000,
    "ricavi": 5099000000,
    "patrimonioNetto": 3512000000
   },
   {
    "anno": 2010,
    "roe": 0.3539,
    "margine": 0.3333,
    "roa": 0.2089,
    "utileNetto": 1846000000,
    "ricavi": 5539000000,
    "patrimonioNetto": 5216000000
   },
   {
    "anno": 2011,
    "roe": 0.3243,
    "margine": 0.2839,
    "roa": 0.1782,
    "utileNetto": 1906000000,
    "ricavi": 6714000000,
    "patrimonioNetto": 5877000000
   },
   {
    "anno": 2012,
    "roe": 0.3982,
    "margine": 0.3733,
    "roa": 0.2214,
    "utileNetto": 2759000000,
    "ricavi": 7391000000,
    "patrimonioNetto": 6929000000
   },
   {
    "anno": 2013,
    "roe": 0.4157,
    "margine": 0.3749,
    "roa": 0.2188,
    "utileNetto": 3116000000,
    "ricavi": 8312000000,
    "patrimonioNetto": 7495000000
   },
   {
    "anno": 2014,
    "roe": 0.53,
    "margine": 0.3831,
    "roa": 0.236,
    "utileNetto": 3617000000,
    "ricavi": 9441000000,
    "patrimonioNetto": 6824000000
   },
   {
    "anno": 2015,
    "roe": 0.6282,
    "margine": 0.3939,
    "roa": 0.2343,
    "utileNetto": 3808000000,
    "ricavi": 9667000000,
    "patrimonioNetto": 6062000000
   },
   {
    "anno": 2016,
    "roe": 0.7141,
    "margine": 0.3767,
    "roa": 0.2173,
    "utileNetto": 4059000000,
    "ricavi": 10776000000,
    "patrimonioNetto": 5684000000
   },
   {
    "anno": 2017,
    "roe": 0.7122,
    "margine": 0.3133,
    "roa": 0.1836,
    "utileNetto": 3915000000,
    "ricavi": 12497000000,
    "patrimonioNetto": 5497000000
   },
   {
    "anno": 2018,
    "roe": 1.0814,
    "margine": 0.3919,
    "roa": 0.2357,
    "utileNetto": 5859000000,
    "ricavi": 14950000000,
    "patrimonioNetto": 5418000000
   },
   {
    "anno": 2019,
    "roe": 1.372,
    "margine": 0.4808,
    "roa": 0.2777,
    "utileNetto": 8118000000,
    "ricavi": 16883000000,
    "patrimonioNetto": 5917000000
   },
   {
    "anno": 2020,
    "roe": 0.9881,
    "margine": 0.419,
    "roa": 0.1909,
    "utileNetto": 6411000000,
    "ricavi": 15301000000,
    "patrimonioNetto": 6488000000
   },
   {
    "anno": 2021,
    "roe": 1.1766,
    "margine": 0.46,
    "roa": 0.2306,
    "utileNetto": 8687000000,
    "ricavi": 18884000000,
    "patrimonioNetto": 7383000000
   },
   {
    "anno": 2022,
    "roe": 1.5623,
    "margine": 0.4466,
    "roa": 0.2564,
    "utileNetto": 9930000000,
    "ricavi": 22237000000,
    "patrimonioNetto": 6356000000
   },
   {
    "anno": 2023,
    "roe": 1.605,
    "margine": 0.4461,
    "roa": 0.2637,
    "utileNetto": 11195000000,
    "ricavi": 25098000000,
    "patrimonioNetto": 6975000000
   },
   {
    "anno": 2024,
    "roe": 1.9852,
    "margine": 0.4571,
    "roa": 0.2678,
    "utileNetto": 12874000000,
    "ricavi": 28167000000,
    "patrimonioNetto": 6485000000
   },
   {
    "anno": 2025,
    "roe": 1.9346,
    "margine": 0.4565,
    "roa": 0.2764,
    "utileNetto": 14968000000,
    "ricavi": 32791000000,
    "patrimonioNetto": 7737000000
   }
  ]
 },
 "PYPL": {
  "nome": "PayPal Holdings, Inc.",
  "anni": [
   {
    "anno": 2013,
    "roe": null,
    "margine": 0.142,
    "roa": null,
    "utileNetto": 955000000,
    "ricavi": 6727000000,
    "patrimonioNetto": 7390000000
   },
   {
    "anno": 2014,
    "roe": 0.0508,
    "margine": 0.0522,
    "roa": 0.0191,
    "utileNetto": 419000000,
    "ricavi": 8025000000,
    "patrimonioNetto": 8248000000
   },
   {
    "anno": 2015,
    "roe": 0.0893,
    "margine": 0.1328,
    "roa": 0.0425,
    "utileNetto": 1228000000,
    "ricavi": 9248000000,
    "patrimonioNetto": 13759000000
   },
   {
    "anno": 2016,
    "roe": 0.0952,
    "margine": 0.1292,
    "roa": 0.0423,
    "utileNetto": 1401000000,
    "ricavi": 10842000000,
    "patrimonioNetto": 14712000000
   },
   {
    "anno": 2017,
    "roe": 0.1122,
    "margine": 0.1371,
    "roa": 0.044,
    "utileNetto": 1795000000,
    "ricavi": 13094000000,
    "patrimonioNetto": 15994000000
   },
   {
    "anno": 2018,
    "roe": 0.1337,
    "margine": 0.1331,
    "roa": 0.0475,
    "utileNetto": 2057000000,
    "ricavi": 15451000000,
    "patrimonioNetto": 15386000000
   },
   {
    "anno": 2019,
    "roe": 0.1453,
    "margine": 0.1384,
    "roa": 0.0479,
    "utileNetto": 2459000000,
    "ricavi": 17772000000,
    "patrimonioNetto": 16929000000
   },
   {
    "anno": 2020,
    "roe": 0.2094,
    "margine": 0.1959,
    "roa": 0.0597,
    "utileNetto": 4202000000,
    "ricavi": 21454000000,
    "patrimonioNetto": 20063000000
   },
   {
    "anno": 2021,
    "roe": 0.1919,
    "margine": 0.1643,
    "roa": 0.055,
    "utileNetto": 4169000000,
    "ricavi": 25371000000,
    "patrimonioNetto": 21727000000
   },
   {
    "anno": 2022,
    "roe": 0.1193,
    "margine": 0.0879,
    "roa": 0.0308,
    "utileNetto": 2419000000,
    "ricavi": 27518000000,
    "patrimonioNetto": 20274000000
   },
   {
    "anno": 2023,
    "roe": 0.2017,
    "margine": 0.1426,
    "roa": 0.0517,
    "utileNetto": 4246000000,
    "ricavi": 29771000000,
    "patrimonioNetto": 21051000000
   },
   {
    "anno": 2024,
    "roe": 0.2031,
    "margine": 0.1304,
    "roa": 0.0527,
    "utileNetto": 4147000000,
    "ricavi": 31797000000,
    "patrimonioNetto": 20417000000
   },
   {
    "anno": 2025,
    "roe": 0.2583,
    "margine": 0.1578,
    "roa": 0.0653,
    "utileNetto": 5233000000,
    "ricavi": 33172000000,
    "patrimonioNetto": 20256000000
   }
  ]
 },
 "BRK-B": {
  "nome": "BERKSHIRE HATHAWAY INC",
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
 "JNJ": {
  "nome": "JOHNSON & JOHNSON",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
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
 "UNH": {
  "nome": "UNITEDHEALTH GROUP INC",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.0617,
    "roa": null,
    "utileNetto": 4654000000,
    "ricavi": 75431000000,
    "patrimonioNetto": 20063000000
   },
   {
    "anno": 2008,
    "roe": 0.1433,
    "margine": 0.0367,
    "roa": 0.0533,
    "utileNetto": 2977000000,
    "ricavi": 81186000000,
    "patrimonioNetto": 20780000000
   },
   {
    "anno": 2009,
    "roe": 0.1619,
    "margine": 0.0439,
    "roa": 0.0647,
    "utileNetto": 3822000000,
    "ricavi": 87138000000,
    "patrimonioNetto": 23606000000
   },
   {
    "anno": 2010,
    "roe": 0.1794,
    "margine": 0.0492,
    "roa": 0.0735,
    "utileNetto": 4634000000,
    "ricavi": 94155000000,
    "patrimonioNetto": 25825000000
   },
   {
    "anno": 2011,
    "roe": 0.1817,
    "margine": 0.0505,
    "roa": 0.0757,
    "utileNetto": 5142000000,
    "ricavi": 101862000000,
    "patrimonioNetto": 28292000000
   },
   {
    "anno": 2012,
    "roe": 0.1772,
    "margine": 0.05,
    "roa": 0.0683,
    "utileNetto": 5526000000,
    "ricavi": 110618000000,
    "patrimonioNetto": 31178000000
   },
   {
    "anno": 2013,
    "roe": 0.175,
    "margine": 0.0459,
    "roa": 0.0687,
    "utileNetto": 5625000000,
    "ricavi": 122489000000,
    "patrimonioNetto": 32149000000
   },
   {
    "anno": 2014,
    "roe": 0.1731,
    "margine": 0.0431,
    "roa": 0.0651,
    "utileNetto": 5619000000,
    "ricavi": 130474000000,
    "patrimonioNetto": 32454000000
   },
   {
    "anno": 2015,
    "roe": 0.1724,
    "margine": 0.037,
    "roa": 0.0522,
    "utileNetto": 5813000000,
    "ricavi": 157107000000,
    "patrimonioNetto": 33725000000
   },
   {
    "anno": 2016,
    "roe": 0.1838,
    "margine": 0.038,
    "roa": 0.0571,
    "utileNetto": 7017000000,
    "ricavi": 184840000000,
    "patrimonioNetto": 38177000000
   },
   {
    "anno": 2017,
    "roe": 0.2119,
    "margine": 0.0525,
    "roa": 0.0759,
    "utileNetto": 10558000000,
    "ricavi": 201159000000,
    "patrimonioNetto": 49833000000
   },
   {
    "anno": 2018,
    "roe": 0.2207,
    "margine": 0.053,
    "roa": 0.0787,
    "utileNetto": 11986000000,
    "ricavi": 226247000000,
    "patrimonioNetto": 54319000000
   },
   {
    "anno": 2019,
    "roe": 0.229,
    "margine": 0.0571,
    "roa": 0.0796,
    "utileNetto": 13839000000,
    "ricavi": 242155000000,
    "patrimonioNetto": 60436000000
   },
   {
    "anno": 2020,
    "roe": 0.2254,
    "margine": 0.0599,
    "roa": 0.0781,
    "utileNetto": 15403000000,
    "ricavi": 257141000000,
    "patrimonioNetto": 68328000000
   },
   {
    "anno": 2021,
    "roe": 0.2303,
    "margine": 0.0601,
    "roa": 0.0815,
    "utileNetto": 17285000000,
    "ricavi": 287597000000,
    "patrimonioNetto": 75045000000
   },
   {
    "anno": 2022,
    "roe": 0.247,
    "margine": 0.0621,
    "roa": 0.0819,
    "utileNetto": 20120000000,
    "ricavi": 324162000000,
    "patrimonioNetto": 81450000000
   },
   {
    "anno": 2023,
    "roe": 0.237,
    "margine": 0.0602,
    "roa": 0.0818,
    "utileNetto": 22381000000,
    "ricavi": 371622000000,
    "patrimonioNetto": 94421000000
   },
   {
    "anno": 2024,
    "roe": 0.1466,
    "margine": 0.036,
    "roa": 0.0483,
    "utileNetto": 14405000000,
    "ricavi": 400278000000,
    "patrimonioNetto": 98268000000
   },
   {
    "anno": 2025,
    "roe": 0.1205,
    "margine": 0.0269,
    "roa": 0.0389,
    "utileNetto": 12056000000,
    "ricavi": 447567000000,
    "patrimonioNetto": 100090000000
   }
  ]
 },
 "LLY": {
  "nome": "ELI LILLY & Co",
  "anni": [
   {
    "anno": 2008,
    "roe": -0.3075,
    "margine": -0.1017,
    "roa": -0.0709,
    "utileNetto": -2071900000,
    "ricavi": 20371900000,
    "patrimonioNetto": 6737700000
   },
   {
    "anno": 2009,
    "roe": 0.4545,
    "margine": 0.1982,
    "roa": 0.1576,
    "utileNetto": 4328800000,
    "ricavi": 21836000000,
    "patrimonioNetto": 9525300000
   },
   {
    "anno": 2010,
    "roe": 0.4082,
    "margine": 0.2197,
    "roa": 0.1635,
    "utileNetto": 5069500000,
    "ricavi": 23076000000,
    "patrimonioNetto": 12420300000
   },
   {
    "anno": 2011,
    "roe": 0.3211,
    "margine": 0.179,
    "roa": 0.1292,
    "utileNetto": 4347700000,
    "ricavi": 24286500000,
    "patrimonioNetto": 13541700000
   },
   {
    "anno": 2012,
    "roe": 0.2769,
    "margine": 0.1809,
    "roa": 0.1189,
    "utileNetto": 4088600000,
    "ricavi": 22603400000,
    "patrimonioNetto": 14765200000
   },
   {
    "anno": 2013,
    "roe": 0.2657,
    "margine": 0.2027,
    "roa": 0.1329,
    "utileNetto": 4684800000,
    "ricavi": 23113100000,
    "patrimonioNetto": 17631400000
   },
   {
    "anno": 2014,
    "roe": 0.1555,
    "margine": 0.1219,
    "roa": 0.0658,
    "utileNetto": 2390500000,
    "ricavi": 19615600000,
    "patrimonioNetto": 15373200000
   },
   {
    "anno": 2015,
    "roe": 0.1653,
    "margine": 0.1207,
    "roa": 0.0677,
    "utileNetto": 2408400000,
    "ricavi": 19958700000,
    "patrimonioNetto": 14571300000
   },
   {
    "anno": 2016,
    "roe": 0.1954,
    "margine": 0.129,
    "roa": 0.0705,
    "utileNetto": 2737600000,
    "ricavi": 21222100000,
    "patrimonioNetto": 14007700000
   },
   {
    "anno": 2017,
    "roe": -0.0176,
    "margine": -0.0102,
    "roa": -0.0045,
    "utileNetto": -204100000,
    "ricavi": 19973800000,
    "patrimonioNetto": 11592200000
   },
   {
    "anno": 2018,
    "roe": 0.3288,
    "margine": 0.1504,
    "roa": 0.0736,
    "utileNetto": 3232000000,
    "ricavi": 21493300000,
    "patrimonioNetto": 9828700000
   },
   {
    "anno": 2019,
    "roe": 3.1909,
    "margine": 0.3727,
    "roa": 0.2117,
    "utileNetto": 8318400000,
    "ricavi": 22319500000,
    "patrimonioNetto": 2606900000
   },
   {
    "anno": 2020,
    "roe": 1.0979,
    "margine": 0.2524,
    "roa": 0.1328,
    "utileNetto": 6193700000,
    "ricavi": 24539800000,
    "patrimonioNetto": 5641600000
   },
   {
    "anno": 2021,
    "roe": 0.6216,
    "margine": 0.1971,
    "roa": 0.1144,
    "utileNetto": 5581700000,
    "ricavi": 28318400000,
    "patrimonioNetto": 8979200000
   },
   {
    "anno": 2022,
    "roe": 0.5864,
    "margine": 0.2188,
    "roa": 0.1262,
    "utileNetto": 6244800000,
    "ricavi": 28541400000,
    "patrimonioNetto": 10649800000
   },
   {
    "anno": 2023,
    "roe": 0.4865,
    "margine": 0.1536,
    "roa": 0.0819,
    "utileNetto": 5240000000,
    "ricavi": 34124000000,
    "patrimonioNetto": 10771900000
   },
   {
    "anno": 2024,
    "roe": 0.742,
    "margine": 0.2351,
    "roa": 0.1345,
    "utileNetto": 10590000000,
    "ricavi": 45043000000,
    "patrimonioNetto": 14272000000
   },
   {
    "anno": 2025,
    "roe": 0.7778,
    "margine": 0.3167,
    "roa": 0.1835,
    "utileNetto": 20640000000,
    "ricavi": 65179000000,
    "patrimonioNetto": 26535000000
   }
  ]
 },
 "PFE": {
  "nome": "PFIZER INC",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.1682,
    "roa": null,
    "utileNetto": 8144000000,
    "ricavi": 48418000000,
    "patrimonioNetto": 65124000000
   },
   {
    "anno": 2008,
    "roe": 0.1404,
    "margine": 0.1678,
    "roa": 0.0729,
    "utileNetto": 8104000000,
    "ricavi": 48296000000,
    "patrimonioNetto": 57740000000
   },
   {
    "anno": 2009,
    "roe": 0.0955,
    "margine": 0.1753,
    "roa": 0.0405,
    "utileNetto": 8635000000,
    "ricavi": 49269000000,
    "patrimonioNetto": 90446000000
   },
   {
    "anno": 2010,
    "roe": 0.0935,
    "margine": 0.1267,
    "roa": 0.0423,
    "utileNetto": 8257000000,
    "ricavi": 65165000000,
    "patrimonioNetto": 88265000000
   },
   {
    "anno": 2011,
    "roe": 0.1211,
    "margine": 0.164,
    "roa": 0.0532,
    "utileNetto": 10009000000,
    "ricavi": 61035000000,
    "patrimonioNetto": 82621000000
   },
   {
    "anno": 2012,
    "roe": 0.1784,
    "margine": 0.2666,
    "roa": 0.0784,
    "utileNetto": 14570000000,
    "ricavi": 54657000000,
    "patrimonioNetto": 81678000000
   },
   {
    "anno": 2013,
    "roe": 0.2872,
    "margine": 0.4265,
    "roa": 0.1278,
    "utileNetto": 22003000000,
    "ricavi": 51584000000,
    "patrimonioNetto": 76620000000
   },
   {
    "anno": 2014,
    "roe": 0.1275,
    "margine": null,
    "roa": 0.0545,
    "utileNetto": 9135000000,
    "ricavi": null,
    "patrimonioNetto": 71622000000
   },
   {
    "anno": 2015,
    "roe": 0.1071,
    "margine": null,
    "roa": 0.0416,
    "utileNetto": 6960000000,
    "ricavi": null,
    "patrimonioNetto": 64998000000
   },
   {
    "anno": 2016,
    "roe": 0.1206,
    "margine": 0.1366,
    "roa": 0.042,
    "utileNetto": 7215000000,
    "ricavi": 52824000000,
    "patrimonioNetto": 59840000000
   },
   {
    "anno": 2017,
    "roe": 0.2974,
    "margine": 0.4055,
    "roa": 0.124,
    "utileNetto": 21308000000,
    "ricavi": 52546000000,
    "patrimonioNetto": 71656000000
   },
   {
    "anno": 2018,
    "roe": 0.1749,
    "margine": 0.2732,
    "roa": 0.07,
    "utileNetto": 11153000000,
    "ricavi": 40825000000,
    "patrimonioNetto": 63758000000
   },
   {
    "anno": 2019,
    "roe": 0.2526,
    "margine": 0.3918,
    "roa": 0.0956,
    "utileNetto": 16026000000,
    "ricavi": 40905000000,
    "patrimonioNetto": 63447000000
   },
   {
    "anno": 2020,
    "roe": 0.1443,
    "margine": 0.2199,
    "roa": 0.0594,
    "utileNetto": 9159000000,
    "ricavi": 41651000000,
    "patrimonioNetto": 63473000000
   },
   {
    "anno": 2021,
    "roe": 0.2837,
    "margine": 0.2704,
    "roa": 0.1211,
    "utileNetto": 21979000000,
    "ricavi": 81288000000,
    "patrimonioNetto": 77462000000
   },
   {
    "anno": 2022,
    "roe": 0.3271,
    "margine": 0.3101,
    "roa": 0.1591,
    "utileNetto": 31372000000,
    "ricavi": 101175000000,
    "patrimonioNetto": 95916000000
   },
   {
    "anno": 2023,
    "roe": 0.0237,
    "margine": 0.0356,
    "roa": 0.0094,
    "utileNetto": 2119000000,
    "ricavi": 59553000000,
    "patrimonioNetto": 89288000000
   },
   {
    "anno": 2024,
    "roe": 0.0911,
    "margine": 0.1262,
    "roa": 0.0376,
    "utileNetto": 8031000000,
    "ricavi": 63627000000,
    "patrimonioNetto": 88203000000
   },
   {
    "anno": 2025,
    "roe": 0.0899,
    "margine": 0.1242,
    "roa": 0.0373,
    "utileNetto": 7771000000,
    "ricavi": 62579000000,
    "patrimonioNetto": 86476000000
   }
  ]
 },
 "ABBV": {
  "nome": "AbbVie Inc.",
  "anni": [
   {
    "anno": 2014,
    "roe": 1.0184,
    "margine": 0.0889,
    "roa": 0.0645,
    "utileNetto": 1774000000,
    "ricavi": 19960000000,
    "patrimonioNetto": 1742000000
   },
   {
    "anno": 2015,
    "roe": 1.3039,
    "margine": 0.225,
    "roa": 0.097,
    "utileNetto": 5144000000,
    "ricavi": 22859000000,
    "patrimonioNetto": 3945000000
   },
   {
    "anno": 2016,
    "roe": 1.2841,
    "margine": 0.2322,
    "roa": 0.0901,
    "utileNetto": 5953000000,
    "ricavi": 25638000000,
    "patrimonioNetto": 4636000000
   },
   {
    "anno": 2017,
    "roe": 1.0416,
    "margine": 0.1882,
    "roa": 0.075,
    "utileNetto": 5309000000,
    "ricavi": 28216000000,
    "patrimonioNetto": 5097000000
   },
   {
    "anno": 2018,
    "roe": null,
    "margine": 0.1736,
    "roa": 0.0958,
    "utileNetto": 5687000000,
    "ricavi": 32753000000,
    "patrimonioNetto": -8446000000
   },
   {
    "anno": 2019,
    "roe": null,
    "margine": 0.2369,
    "roa": 0.0884,
    "utileNetto": 7882000000,
    "ricavi": 33266000000,
    "patrimonioNetto": -8172000000
   },
   {
    "anno": 2020,
    "roe": 0.3524,
    "margine": 0.1008,
    "roa": 0.0307,
    "utileNetto": 4616000000,
    "ricavi": 45804000000,
    "patrimonioNetto": 13097000000
   },
   {
    "anno": 2021,
    "roe": 0.7477,
    "margine": 0.2054,
    "roa": 0.0788,
    "utileNetto": 11542000000,
    "ricavi": 56197000000,
    "patrimonioNetto": 15436000000
   },
   {
    "anno": 2022,
    "roe": 0.6847,
    "margine": 0.2039,
    "roa": 0.0853,
    "utileNetto": 11836000000,
    "ricavi": 58054000000,
    "patrimonioNetto": 17287000000
   },
   {
    "anno": 2023,
    "roe": 0.4677,
    "margine": 0.0895,
    "roa": 0.0361,
    "utileNetto": 4863000000,
    "ricavi": 54318000000,
    "patrimonioNetto": 10397000000
   },
   {
    "anno": 2024,
    "roe": null,
    "margine": 0.0759,
    "roa": 0.0317,
    "utileNetto": 4278000000,
    "ricavi": 56334000000,
    "patrimonioNetto": 3325000000
   },
   {
    "anno": 2025,
    "roe": null,
    "margine": 0.0691,
    "roa": 0.0315,
    "utileNetto": 4226000000,
    "ricavi": 61160000000,
    "patrimonioNetto": -3270000000
   }
  ]
 },
 "MRK": {
  "nome": "Merck & Co., Inc.",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.1354,
    "roa": null,
    "utileNetto": 3275400000,
    "ricavi": 24197700000,
    "patrimonioNetto": 20591000000
   },
   {
    "anno": 2008,
    "roe": 0.3689,
    "margine": 0.3274,
    "roa": 0.1654,
    "utileNetto": 7808000000,
    "ricavi": 23850000000,
    "patrimonioNetto": 21167000000
   },
   {
    "anno": 2009,
    "roe": 0.2098,
    "margine": 0.4703,
    "roa": 0.1148,
    "utileNetto": 12899000000,
    "ricavi": 27428000000,
    "patrimonioNetto": 61485000000
   },
   {
    "anno": 2010,
    "roe": 0.0152,
    "margine": 0.0187,
    "roa": 0.0081,
    "utileNetto": 861000000,
    "ricavi": 45987000000,
    "patrimonioNetto": 56805000000
   },
   {
    "anno": 2011,
    "roe": 0.1101,
    "margine": null,
    "roa": 0.0597,
    "utileNetto": 6272000000,
    "ricavi": null,
    "patrimonioNetto": 56943000000
   },
   {
    "anno": 2012,
    "roe": 0.1112,
    "margine": null,
    "roa": 0.0581,
    "utileNetto": 6168000000,
    "ricavi": null,
    "patrimonioNetto": 55463000000
   },
   {
    "anno": 2013,
    "roe": 0.0842,
    "margine": null,
    "roa": 0.0417,
    "utileNetto": 4404000000,
    "ricavi": null,
    "patrimonioNetto": 52326000000
   },
   {
    "anno": 2014,
    "roe": 0.2443,
    "margine": null,
    "roa": 0.1214,
    "utileNetto": 11920000000,
    "ricavi": null,
    "patrimonioNetto": 48791000000
   },
   {
    "anno": 2015,
    "roe": 0.0992,
    "margine": null,
    "roa": 0.0437,
    "utileNetto": 4442000000,
    "ricavi": null,
    "patrimonioNetto": 44767000000
   },
   {
    "anno": 2016,
    "roe": 0.0973,
    "margine": 0.0985,
    "roa": 0.0411,
    "utileNetto": 3920000000,
    "ricavi": 39807000000,
    "patrimonioNetto": 40308000000
   },
   {
    "anno": 2017,
    "roe": 0.0693,
    "margine": 0.0597,
    "roa": 0.0272,
    "utileNetto": 2394000000,
    "ricavi": 40122000000,
    "patrimonioNetto": 34569000000
   },
   {
    "anno": 2018,
    "roe": 0.2314,
    "margine": 0.1471,
    "roa": 0.0753,
    "utileNetto": 6220000000,
    "ricavi": 42294000000,
    "patrimonioNetto": 26882000000
   },
   {
    "anno": 2019,
    "roe": 0.3786,
    "margine": 0.2516,
    "roa": 0.1166,
    "utileNetto": 9843000000,
    "ricavi": 39121000000,
    "patrimonioNetto": 26001000000
   },
   {
    "anno": 2020,
    "roe": 0.2782,
    "margine": 0.1702,
    "roa": 0.0772,
    "utileNetto": 7067000000,
    "ricavi": 41518000000,
    "patrimonioNetto": 25404000000
   },
   {
    "anno": 2021,
    "roe": 0.3411,
    "margine": 0.2679,
    "roa": 0.1235,
    "utileNetto": 13049000000,
    "ricavi": 48704000000,
    "patrimonioNetto": 38257000000
   },
   {
    "anno": 2022,
    "roe": 0.3152,
    "margine": 0.2449,
    "roa": 0.133,
    "utileNetto": 14519000000,
    "ricavi": 59283000000,
    "patrimonioNetto": 46058000000
   },
   {
    "anno": 2023,
    "roe": 0.0097,
    "margine": 0.0061,
    "roa": 0.0034,
    "utileNetto": 365000000,
    "ricavi": 60115000000,
    "patrimonioNetto": 37635000000
   },
   {
    "anno": 2024,
    "roe": 0.3696,
    "margine": 0.2668,
    "roa": 0.1462,
    "utileNetto": 17117000000,
    "ricavi": 64168000000,
    "patrimonioNetto": 46313000000
   },
   {
    "anno": 2025,
    "roe": 0.347,
    "margine": 0.2808,
    "roa": 0.1334,
    "utileNetto": 18254000000,
    "ricavi": 65011000000,
    "patrimonioNetto": 52606000000
   }
  ]
 },
 "TMO": {
  "nome": "THERMO FISHER SCIENTIFIC INC.",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.0768,
    "roa": null,
    "utileNetto": 748400000,
    "ricavi": 9746400000,
    "patrimonioNetto": 14463600000
   },
   {
    "anno": 2008,
    "roe": 0.0657,
    "margine": 0.0934,
    "roa": 0.0465,
    "utileNetto": 980900000,
    "ricavi": 10498000000,
    "patrimonioNetto": 14926500000
   },
   {
    "anno": 2009,
    "roe": 0.0551,
    "margine": 0.0858,
    "roa": 0.0393,
    "utileNetto": 850300000,
    "ricavi": 9911600000,
    "patrimonioNetto": 15430900000
   },
   {
    "anno": 2010,
    "roe": 0.0674,
    "margine": 0.0996,
    "roa": 0.0485,
    "utileNetto": 1035600000,
    "ricavi": 10393100000,
    "patrimonioNetto": 15361000000
   },
   {
    "anno": 2011,
    "roe": 0.0884,
    "margine": 0.1151,
    "roa": 0.0496,
    "utileNetto": 1329900000,
    "ricavi": 11558800000,
    "patrimonioNetto": 15038100000
   },
   {
    "anno": 2012,
    "roe": 0.0762,
    "margine": 0.0942,
    "roa": 0.0429,
    "utileNetto": 1177900000,
    "ricavi": 12509900000,
    "patrimonioNetto": 15464700000
   },
   {
    "anno": 2013,
    "roe": 0.0755,
    "margine": 0.0973,
    "roa": 0.04,
    "utileNetto": 1273300000,
    "ricavi": 13090300000,
    "patrimonioNetto": 16856100000
   },
   {
    "anno": 2019,
    "roe": 0.1246,
    "margine": 0.1448,
    "roa": 0.0633,
    "utileNetto": 3698000000,
    "ricavi": 25542000000,
    "patrimonioNetto": 29684000000
   },
   {
    "anno": 2020,
    "roe": 0.1847,
    "margine": 0.1979,
    "roa": 0.0924,
    "utileNetto": 6377000000,
    "ricavi": 32218000000,
    "patrimonioNetto": 34517000000
   },
   {
    "anno": 2021,
    "roe": 0.1892,
    "margine": 0.1971,
    "roa": 0.0812,
    "utileNetto": 7728000000,
    "ricavi": 39211000000,
    "patrimonioNetto": 40855000000
   },
   {
    "anno": 2022,
    "roe": 0.1581,
    "margine": 0.155,
    "roa": 0.0716,
    "utileNetto": 6960000000,
    "ricavi": 44915000000,
    "patrimonioNetto": 44032000000
   },
   {
    "anno": 2023,
    "roe": 0.1283,
    "margine": 0.1399,
    "roa": 0.0607,
    "utileNetto": 5995000000,
    "ricavi": 42857000000,
    "patrimonioNetto": 46724000000
   },
   {
    "anno": 2024,
    "roe": 0.1278,
    "margine": 0.1477,
    "roa": 0.0651,
    "utileNetto": 6335000000,
    "ricavi": 42879000000,
    "patrimonioNetto": 49584000000
   },
   {
    "anno": 2025,
    "roe": 0.1255,
    "margine": 0.1505,
    "roa": 0.0608,
    "utileNetto": 6704000000,
    "ricavi": 44556000000,
    "patrimonioNetto": 53407000000
   }
  ]
 },
 "ABT": {
  "nome": "ABBOTT LABORATORIES",
  "anni": [
   {
    "anno": 2007,
    "roe": 0.2023,
    "margine": 0.1392,
    "roa": 0.0908,
    "utileNetto": 3606314000,
    "ricavi": 25914238000,
    "patrimonioNetto": 17823945000
   },
   {
    "anno": 2008,
    "roe": 0.2792,
    "margine": 0.1653,
    "roa": 0.1151,
    "utileNetto": 4880719000,
    "ricavi": 29527552000,
    "patrimonioNetto": 17479551000
   },
   {
    "anno": 2009,
    "roe": 0.2483,
    "margine": 0.1868,
    "roa": 0.1093,
    "utileNetto": 5745838000,
    "ricavi": 30764707000,
    "patrimonioNetto": 23144294000
   },
   {
    "anno": 2010,
    "roe": 0.204,
    "margine": 0.1315,
    "roa": 0.0764,
    "utileNetto": 4626172000,
    "ricavi": 35166721000,
    "patrimonioNetto": 22676802000
   },
   {
    "anno": 2011,
    "roe": 0.1935,
    "margine": 0.2209,
    "roa": 0.0784,
    "utileNetto": 4728000000,
    "ricavi": 21407000000,
    "patrimonioNetto": 24439833000
   },
   {
    "anno": 2012,
    "roe": 0.2232,
    "margine": 0.313,
    "roa": 0.0887,
    "utileNetto": 5963000000,
    "ricavi": 19050000000,
    "patrimonioNetto": 26721000000
   },
   {
    "anno": 2013,
    "roe": 0.1023,
    "margine": 0.131,
    "roa": 0.06,
    "utileNetto": 2576000000,
    "ricavi": 19657000000,
    "patrimonioNetto": 25171000000
   },
   {
    "anno": 2014,
    "roe": 0.1061,
    "margine": 0.1128,
    "roa": 0.0554,
    "utileNetto": 2284000000,
    "ricavi": 20247000000,
    "patrimonioNetto": 21526000000
   },
   {
    "anno": 2015,
    "roe": 0.2085,
    "margine": 0.2168,
    "roa": 0.1072,
    "utileNetto": 4423000000,
    "ricavi": 20405000000,
    "patrimonioNetto": 21211000000
   },
   {
    "anno": 2016,
    "roe": 0.0682,
    "margine": 0.0671,
    "roa": 0.0266,
    "utileNetto": 1400000000,
    "ricavi": 20853000000,
    "patrimonioNetto": 20538000000
   },
   {
    "anno": 2017,
    "roe": 0.0154,
    "margine": 0.0174,
    "roa": 0.0063,
    "utileNetto": 477000000,
    "ricavi": 27390000000,
    "patrimonioNetto": 30897000000
   },
   {
    "anno": 2018,
    "roe": 0.0776,
    "margine": 0.0774,
    "roa": 0.0353,
    "utileNetto": 2368000000,
    "ricavi": 30578000000,
    "patrimonioNetto": 30524000000
   },
   {
    "anno": 2019,
    "roe": 0.1186,
    "margine": 0.1156,
    "roa": 0.0543,
    "utileNetto": 3687000000,
    "ricavi": 31904000000,
    "patrimonioNetto": 31088000000
   },
   {
    "anno": 2020,
    "roe": 0.1371,
    "margine": 0.1299,
    "roa": 0.062,
    "utileNetto": 4495000000,
    "ricavi": 34608000000,
    "patrimonioNetto": 32784000000
   },
   {
    "anno": 2021,
    "roe": 0.1975,
    "margine": 0.1642,
    "roa": 0.094,
    "utileNetto": 7071000000,
    "ricavi": 43075000000,
    "patrimonioNetto": 35802000000
   },
   {
    "anno": 2022,
    "roe": 0.189,
    "margine": 0.1588,
    "roa": 0.0931,
    "utileNetto": 6933000000,
    "ricavi": 43653000000,
    "patrimonioNetto": 36686000000
   },
   {
    "anno": 2023,
    "roe": 0.1483,
    "margine": 0.1427,
    "roa": 0.0782,
    "utileNetto": 5723000000,
    "ricavi": 40109000000,
    "patrimonioNetto": 38603000000
   },
   {
    "anno": 2024,
    "roe": 0.2812,
    "margine": 0.3195,
    "roa": 0.1646,
    "utileNetto": 13402000000,
    "ricavi": 41950000000,
    "patrimonioNetto": 47664000000
   },
   {
    "anno": 2025,
    "roe": 0.1251,
    "margine": 0.1472,
    "roa": 0.0752,
    "utileNetto": 6524000000,
    "ricavi": 44328000000,
    "patrimonioNetto": 52130000000
   }
  ]
 },
 "DHR": {
  "nome": "DANAHER CORP /DE/",
  "anni": [
   {
    "anno": 2008,
    "roe": 0.1343,
    "margine": 0.1038,
    "roa": 0.0753,
    "utileNetto": 1317631000,
    "ricavi": 12697456000,
    "patrimonioNetto": 9808562000
   },
   {
    "anno": 2009,
    "roe": 0.099,
    "margine": 0.1095,
    "roa": 0.0588,
    "utileNetto": 1151704000,
    "ricavi": 10516681000,
    "patrimonioNetto": 11630176000
   },
   {
    "anno": 2010,
    "roe": 0.1308,
    "margine": 0.1429,
    "roa": 0.0807,
    "utileNetto": 1793000000,
    "ricavi": 12550000000,
    "patrimonioNetto": 13711010000
   },
   {
    "anno": 2011,
    "roe": 0.1285,
    "margine": 0.135,
    "roa": 0.0725,
    "utileNetto": 2172300000,
    "ricavi": 16090500000,
    "patrimonioNetto": 16904800000
   },
   {
    "anno": 2012,
    "roe": 0.1258,
    "margine": 0.131,
    "roa": 0.0726,
    "utileNetto": 2392200000,
    "ricavi": 18260400000,
    "patrimonioNetto": 19016500000
   },
   {
    "anno": 2013,
    "roe": 0.1204,
    "margine": 0.1474,
    "roa": 0.0777,
    "utileNetto": 2695000000,
    "ricavi": 18283100000,
    "patrimonioNetto": 22385300000
   },
   {
    "anno": 2014,
    "roe": 0.1111,
    "margine": 0.2019,
    "roa": 0.0702,
    "utileNetto": 2598400000,
    "ricavi": 12866900000,
    "patrimonioNetto": 23378100000
   },
   {
    "anno": 2015,
    "roe": 0.1417,
    "margine": 0.2326,
    "roa": 0.0696,
    "utileNetto": 3357400000,
    "ricavi": 14433700000,
    "patrimonioNetto": 23690300000
   },
   {
    "anno": 2016,
    "roe": 0.111,
    "margine": 0.1513,
    "roa": 0.0564,
    "utileNetto": 2553700000,
    "ricavi": 16882400000,
    "patrimonioNetto": 23002800000
   },
   {
    "anno": 2017,
    "roe": 0.0945,
    "margine": 0.1606,
    "roa": 0.0534,
    "utileNetto": 2492100000,
    "ricavi": 15518800000,
    "patrimonioNetto": 26367800000
   },
   {
    "anno": 2018,
    "roe": 0.0939,
    "margine": 0.1555,
    "roa": 0.0554,
    "utileNetto": 2651000000,
    "ricavi": 17049000000,
    "patrimonioNetto": 28225000000
   },
   {
    "anno": 2019,
    "roe": 0.0993,
    "margine": 0.1679,
    "roa": 0.0485,
    "utileNetto": 3008000000,
    "ricavi": 17911000000,
    "patrimonioNetto": 30282000000
   },
   {
    "anno": 2020,
    "roe": 0.0917,
    "margine": 0.1636,
    "roa": 0.0479,
    "utileNetto": 3646000000,
    "ricavi": 22284000000,
    "patrimonioNetto": 39777000000
   },
   {
    "anno": 2021,
    "roe": 0.1424,
    "margine": 0.2594,
    "roa": 0.0773,
    "utileNetto": 6433000000,
    "ricavi": 24802000000,
    "patrimonioNetto": 45177000000
   },
   {
    "anno": 2022,
    "roe": 0.1439,
    "margine": 0.2706,
    "roa": 0.0855,
    "utileNetto": 7209000000,
    "ricavi": 26643000000,
    "patrimonioNetto": 50090000000
   },
   {
    "anno": 2023,
    "roe": 0.0891,
    "margine": 0.1994,
    "roa": 0.0564,
    "utileNetto": 4764000000,
    "ricavi": 23890000000,
    "patrimonioNetto": 53490000000
   },
   {
    "anno": 2024,
    "roe": 0.0787,
    "margine": 0.1633,
    "roa": 0.0503,
    "utileNetto": 3899000000,
    "ricavi": 23875000000,
    "patrimonioNetto": 49543000000
   },
   {
    "anno": 2025,
    "roe": 0.0688,
    "margine": 0.1471,
    "roa": 0.0433,
    "utileNetto": 3614000000,
    "ricavi": 24568000000,
    "patrimonioNetto": 52534000000
   }
  ]
 },
 "AMGN": {
  "nome": "AMGEN INC",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.2084,
    "roa": null,
    "utileNetto": 3078000000,
    "ricavi": 14771000000,
    "patrimonioNetto": 18512000000
   },
   {
    "anno": 2008,
    "roe": 0.194,
    "margine": 0.2701,
    "roa": 0.1112,
    "utileNetto": 4052000000,
    "ricavi": 15003000000,
    "patrimonioNetto": 20885000000
   },
   {
    "anno": 2009,
    "roe": 0.2032,
    "margine": 0.3145,
    "roa": 0.1162,
    "utileNetto": 4605000000,
    "ricavi": 14642000000,
    "patrimonioNetto": 22667000000
   },
   {
    "anno": 2010,
    "roe": 0.1932,
    "margine": 0.3074,
    "roa": 0.1064,
    "utileNetto": 4627000000,
    "ricavi": 15053000000,
    "patrimonioNetto": 23944000000
   },
   {
    "anno": 2011,
    "roe": 0.1935,
    "margine": 0.2364,
    "roa": 0.0754,
    "utileNetto": 3683000000,
    "ricavi": 15582000000,
    "patrimonioNetto": 19029000000
   },
   {
    "anno": 2012,
    "roe": 0.228,
    "margine": 0.2517,
    "roa": 0.08,
    "utileNetto": 4345000000,
    "ricavi": 17265000000,
    "patrimonioNetto": 19060000000
   },
   {
    "anno": 2013,
    "roe": 0.23,
    "margine": 0.2721,
    "roa": 0.0768,
    "utileNetto": 5081000000,
    "ricavi": 18676000000,
    "patrimonioNetto": 22096000000
   },
   {
    "anno": 2014,
    "roe": 0.2001,
    "margine": 0.2571,
    "roa": 0.0747,
    "utileNetto": 5158000000,
    "ricavi": 20063000000,
    "patrimonioNetto": 25778000000
   },
   {
    "anno": 2015,
    "roe": 0.2471,
    "margine": 0.3203,
    "roa": 0.0971,
    "utileNetto": 6939000000,
    "ricavi": 21662000000,
    "patrimonioNetto": 28083000000
   },
   {
    "anno": 2016,
    "roe": 0.2585,
    "margine": 0.3359,
    "roa": 0.0995,
    "utileNetto": 7722000000,
    "ricavi": 22991000000,
    "patrimonioNetto": 29875000000
   },
   {
    "anno": 2017,
    "roe": 0.0784,
    "margine": 0.0866,
    "roa": 0.0248,
    "utileNetto": 1979000000,
    "ricavi": 22849000000,
    "patrimonioNetto": 25241000000
   },
   {
    "anno": 2018,
    "roe": 0.6715,
    "margine": 0.3535,
    "roa": 0.1264,
    "utileNetto": 8394000000,
    "ricavi": 23747000000,
    "patrimonioNetto": 12500000000
   },
   {
    "anno": 2019,
    "roe": 0.8107,
    "margine": 0.3357,
    "roa": 0.1313,
    "utileNetto": 7842000000,
    "ricavi": 23362000000,
    "patrimonioNetto": 9673000000
   },
   {
    "anno": 2020,
    "roe": 0.772,
    "margine": 0.2857,
    "roa": 0.1154,
    "utileNetto": 7264000000,
    "ricavi": 25424000000,
    "patrimonioNetto": 9409000000
   },
   {
    "anno": 2021,
    "roe": 0.8796,
    "margine": 0.2268,
    "roa": 0.0963,
    "utileNetto": 5893000000,
    "ricavi": 25979000000,
    "patrimonioNetto": 6700000000
   },
   {
    "anno": 2022,
    "roe": 1.7897,
    "margine": 0.2489,
    "roa": 0.1006,
    "utileNetto": 6552000000,
    "ricavi": 26323000000,
    "patrimonioNetto": 3661000000
   },
   {
    "anno": 2023,
    "roe": 1.0778,
    "margine": 0.2383,
    "roa": 0.0691,
    "utileNetto": 6717000000,
    "ricavi": 28190000000,
    "patrimonioNetto": 6232000000
   },
   {
    "anno": 2024,
    "roe": 0.6959,
    "margine": 0.1224,
    "roa": 0.0445,
    "utileNetto": 4090000000,
    "ricavi": 33424000000,
    "patrimonioNetto": 5877000000
   },
   {
    "anno": 2025,
    "roe": 0.8906,
    "margine": 0.2098,
    "roa": 0.0851,
    "utileNetto": 7711000000,
    "ricavi": 36751000000,
    "patrimonioNetto": 8658000000
   }
  ]
 },
 "KO": {
  "nome": "COCA COLA CO",
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
 "PEP": {
  "nome": "PEPSICO INC",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.1433,
    "roa": null,
    "utileNetto": 5658000000,
    "ricavi": 39474000000,
    "patrimonioNetto": 17296000000
   },
   {
    "anno": 2008,
    "roe": 0.4087,
    "margine": 0.1189,
    "roa": 0.1429,
    "utileNetto": 5142000000,
    "ricavi": 43251000000,
    "patrimonioNetto": 12582000000
   },
   {
    "anno": 2009,
    "roe": 0.3409,
    "margine": 0.1375,
    "roa": 0.1492,
    "utileNetto": 5946000000,
    "ricavi": 43232000000,
    "patrimonioNetto": 17442000000
   },
   {
    "anno": 2010,
    "roe": 0.2943,
    "margine": 0.1093,
    "roa": 0.0927,
    "utileNetto": 6320000000,
    "ricavi": 57838000000,
    "patrimonioNetto": 21476000000
   },
   {
    "anno": 2011,
    "roe": 0.3083,
    "margine": 0.0969,
    "roa": 0.0884,
    "utileNetto": 6443000000,
    "ricavi": 66504000000,
    "patrimonioNetto": 20899000000
   },
   {
    "anno": 2012,
    "roe": 0.2758,
    "margine": 0.0943,
    "roa": 0.0828,
    "utileNetto": 6178000000,
    "ricavi": 65492000000,
    "patrimonioNetto": 22399000000
   },
   {
    "anno": 2013,
    "roe": 0.2764,
    "margine": 0.1015,
    "roa": 0.087,
    "utileNetto": 6740000000,
    "ricavi": 66415000000,
    "patrimonioNetto": 24389000000
   },
   {
    "anno": 2014,
    "roe": 0.3712,
    "margine": 0.0977,
    "roa": 0.0924,
    "utileNetto": 6513000000,
    "ricavi": 66683000000,
    "patrimonioNetto": 17548000000
   },
   {
    "anno": 2015,
    "roe": 0.4532,
    "margine": 0.0865,
    "roa": 0.0783,
    "utileNetto": 5452000000,
    "ricavi": 63056000000,
    "patrimonioNetto": 12030000000
   },
   {
    "anno": 2016,
    "roe": 0.5651,
    "margine": 0.1008,
    "roa": 0.0861,
    "utileNetto": 6329000000,
    "ricavi": 62799000000,
    "patrimonioNetto": 11199000000
   },
   {
    "anno": 2017,
    "roe": 0.4423,
    "margine": 0.0765,
    "roa": 0.0609,
    "utileNetto": 4857000000,
    "ricavi": 63525000000,
    "patrimonioNetto": 10981000000
   },
   {
    "anno": 2018,
    "roe": 0.8571,
    "margine": 0.1935,
    "roa": 0.1612,
    "utileNetto": 12515000000,
    "ricavi": 64661000000,
    "patrimonioNetto": 14602000000
   },
   {
    "anno": 2019,
    "roe": 0.4919,
    "margine": 0.1089,
    "roa": 0.0931,
    "utileNetto": 7314000000,
    "ricavi": 67161000000,
    "patrimonioNetto": 14868000000
   },
   {
    "anno": 2020,
    "roe": 0.5254,
    "margine": 0.1012,
    "roa": 0.0766,
    "utileNetto": 7120000000,
    "ricavi": 70372000000,
    "patrimonioNetto": 13552000000
   },
   {
    "anno": 2021,
    "roe": 0.4717,
    "margine": 0.0959,
    "roa": 0.0825,
    "utileNetto": 7618000000,
    "ricavi": 79474000000,
    "patrimonioNetto": 16151000000
   },
   {
    "anno": 2022,
    "roe": 0.5158,
    "margine": 0.1031,
    "roa": 0.0967,
    "utileNetto": 8910000000,
    "ricavi": 86392000000,
    "patrimonioNetto": 17273000000
   },
   {
    "anno": 2023,
    "roe": 0.4869,
    "margine": 0.0992,
    "roa": 0.0903,
    "utileNetto": 9074000000,
    "ricavi": 91471000000,
    "patrimonioNetto": 18637000000
   },
   {
    "anno": 2024,
    "roe": 0.5309,
    "margine": 0.1043,
    "roa": 0.0963,
    "utileNetto": 9578000000,
    "ricavi": 91854000000,
    "patrimonioNetto": 18041000000
   },
   {
    "anno": 2025,
    "roe": 0.4038,
    "margine": 0.0877,
    "roa": 0.0767,
    "utileNetto": 8240000000,
    "ricavi": 93925000000,
    "patrimonioNetto": 20406000000
   }
  ]
 },
 "PG": {
  "nome": "PROCTER & GAMBLE Co",
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
 },
 "WMT": {
  "nome": "Walmart Inc.",
  "anni": [
   {
    "anno": 2008,
    "roe": null,
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
 "COST": {
  "nome": "COSTCO WHOLESALE CORP /NEW",
  "anni": [
   {
    "anno": 2008,
    "roe": 0.1383,
    "margine": 0.0177,
    "roa": 0.062,
    "utileNetto": 1283000000,
    "ricavi": 72483000000,
    "patrimonioNetto": 9274000000
   },
   {
    "anno": 2009,
    "roe": 0.1075,
    "margine": 0.0152,
    "roa": 0.0494,
    "utileNetto": 1086000000,
    "ricavi": 71422000000,
    "patrimonioNetto": 10104000000
   },
   {
    "anno": 2010,
    "roe": 0.1192,
    "margine": 0.0167,
    "roa": 0.0547,
    "utileNetto": 1303000000,
    "ricavi": 77946000000,
    "patrimonioNetto": 10930000000
   },
   {
    "anno": 2011,
    "roe": 0.1163,
    "margine": 0.0164,
    "roa": 0.0546,
    "utileNetto": 1462000000,
    "ricavi": 88915000000,
    "patrimonioNetto": 12573000000
   },
   {
    "anno": 2012,
    "roe": 0.1365,
    "margine": 0.0172,
    "roa": 0.063,
    "utileNetto": 1709000000,
    "ricavi": 99137000000,
    "patrimonioNetto": 12518000000
   },
   {
    "anno": 2013,
    "roe": 0.1852,
    "margine": 0.0194,
    "roa": 0.0673,
    "utileNetto": 2039000000,
    "ricavi": 105156000000,
    "patrimonioNetto": 11012000000
   },
   {
    "anno": 2014,
    "roe": 0.1644,
    "margine": 0.0183,
    "roa": 0.063,
    "utileNetto": 2058000000,
    "ricavi": 112640000000,
    "patrimonioNetto": 12515000000
   },
   {
    "anno": 2015,
    "roe": 0.2192,
    "margine": 0.0205,
    "roa": 0.072,
    "utileNetto": 2377000000,
    "ricavi": 116199000000,
    "patrimonioNetto": 10843000000
   },
   {
    "anno": 2016,
    "roe": 0.1906,
    "margine": 0.0198,
    "roa": 0.0709,
    "utileNetto": 2350000000,
    "ricavi": 118719000000,
    "patrimonioNetto": 12332000000
   },
   {
    "anno": 2017,
    "roe": 0.2418,
    "margine": 0.0208,
    "roa": 0.0737,
    "utileNetto": 2679000000,
    "ricavi": 129025000000,
    "patrimonioNetto": 11079000000
   },
   {
    "anno": 2018,
    "roe": 0.2392,
    "margine": 0.0221,
    "roa": 0.0768,
    "utileNetto": 3134000000,
    "ricavi": 141576000000,
    "patrimonioNetto": 13103000000
   },
   {
    "anno": 2019,
    "roe": 0.2348,
    "margine": 0.024,
    "roa": 0.0806,
    "utileNetto": 3659000000,
    "ricavi": 152703000000,
    "patrimonioNetto": 15584000000
   },
   {
    "anno": 2020,
    "roe": 0.214,
    "margine": 0.024,
    "roa": 0.072,
    "utileNetto": 4002000000,
    "ricavi": 166761000000,
    "patrimonioNetto": 18705000000
   },
   {
    "anno": 2021,
    "roe": 0.277,
    "margine": 0.0256,
    "roa": 0.0845,
    "utileNetto": 5007000000,
    "ricavi": 195929000000,
    "patrimonioNetto": 18078000000
   },
   {
    "anno": 2022,
    "roe": 0.283,
    "margine": 0.0257,
    "roa": 0.0911,
    "utileNetto": 5844000000,
    "ricavi": 226954000000,
    "patrimonioNetto": 20647000000
   },
   {
    "anno": 2023,
    "roe": 0.2511,
    "margine": 0.026,
    "roa": 0.0912,
    "utileNetto": 6292000000,
    "ricavi": 242290000000,
    "patrimonioNetto": 25058000000
   },
   {
    "anno": 2024,
    "roe": 0.3119,
    "margine": 0.029,
    "roa": 0.1055,
    "utileNetto": 7367000000,
    "ricavi": 254453000000,
    "patrimonioNetto": 23622000000
   },
   {
    "anno": 2025,
    "roe": 0.2777,
    "margine": 0.0294,
    "roa": 0.105,
    "utileNetto": 8099000000,
    "ricavi": 275235000000,
    "patrimonioNetto": 29164000000
   }
  ]
 },
 "MCD": {
  "nome": "MCDONALDS CORP",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.1051,
    "roa": null,
    "utileNetto": 2395100000,
    "ricavi": 22786600000,
    "patrimonioNetto": 15279800000
   },
   {
    "anno": 2008,
    "roe": 0.3223,
    "margine": 0.1834,
    "roa": 0.1515,
    "utileNetto": 4313200000,
    "ricavi": 23522400000,
    "patrimonioNetto": 13382600000
   },
   {
    "anno": 2009,
    "roe": 0.3243,
    "margine": 0.2001,
    "roa": 0.1506,
    "utileNetto": 4551000000,
    "ricavi": 22744700000,
    "patrimonioNetto": 14033900000
   },
   {
    "anno": 2010,
    "roe": 0.338,
    "margine": 0.2055,
    "roa": 0.1547,
    "utileNetto": 4946300000,
    "ricavi": 24074600000,
    "patrimonioNetto": 14634200000
   },
   {
    "anno": 2011,
    "roe": 0.3824,
    "margine": 0.2038,
    "roa": 0.1668,
    "utileNetto": 5503100000,
    "ricavi": 27006000000,
    "patrimonioNetto": 14390200000
   },
   {
    "anno": 2012,
    "roe": 0.3573,
    "margine": 0.1982,
    "roa": 0.1544,
    "utileNetto": 5464800000,
    "ricavi": 27567000000,
    "patrimonioNetto": 15293600000
   },
   {
    "anno": 2013,
    "roe": 0.3489,
    "margine": 0.1987,
    "roa": 0.1525,
    "utileNetto": 5585900000,
    "ricavi": 28105700000,
    "patrimonioNetto": 16009700000
   },
   {
    "anno": 2014,
    "roe": 0.3702,
    "margine": 0.1734,
    "roa": 0.139,
    "utileNetto": 4757800000,
    "ricavi": 27441300000,
    "patrimonioNetto": 12853400000
   },
   {
    "anno": 2015,
    "roe": 0.639,
    "margine": 0.1782,
    "roa": 0.1194,
    "utileNetto": 4529300000,
    "ricavi": 25413000000,
    "patrimonioNetto": 7087900000
   },
   {
    "anno": 2016,
    "roe": null,
    "margine": 0.1903,
    "roa": 0.1511,
    "utileNetto": 4686500000,
    "ricavi": 24621900000,
    "patrimonioNetto": -2204300000
   },
   {
    "anno": 2017,
    "roe": null,
    "margine": 0.2275,
    "roa": 0.1536,
    "utileNetto": 5192300000,
    "ricavi": 22820400000,
    "patrimonioNetto": -3268000000
   },
   {
    "anno": 2018,
    "roe": null,
    "margine": 0.2787,
    "roa": 0.1806,
    "utileNetto": 5924300000,
    "ricavi": 21257900000,
    "patrimonioNetto": -6258400000
   },
   {
    "anno": 2019,
    "roe": null,
    "margine": 0.282,
    "roa": 0.1268,
    "utileNetto": 6025400000,
    "ricavi": 21364400000,
    "patrimonioNetto": -8210300000
   },
   {
    "anno": 2020,
    "roe": null,
    "margine": 0.2463,
    "roa": 0.0899,
    "utileNetto": 4730500000,
    "ricavi": 19207800000,
    "patrimonioNetto": -7824900000
   },
   {
    "anno": 2021,
    "roe": null,
    "margine": 0.3249,
    "roa": 0.1401,
    "utileNetto": 7545200000,
    "ricavi": 23222900000,
    "patrimonioNetto": -4601000000
   },
   {
    "anno": 2022,
    "roe": null,
    "margine": 0.2664,
    "roa": 0.1225,
    "utileNetto": 6177000000,
    "ricavi": 23183000000,
    "patrimonioNetto": -6003000000
   },
   {
    "anno": 2023,
    "roe": null,
    "margine": 0.3322,
    "roa": 0.1508,
    "utileNetto": 8469000000,
    "ricavi": 25494000000,
    "patrimonioNetto": -4707000000
   },
   {
    "anno": 2024,
    "roe": null,
    "margine": 0.3172,
    "roa": 0.149,
    "utileNetto": 8223000000,
    "ricavi": 25920000000,
    "patrimonioNetto": -3797000000
   },
   {
    "anno": 2025,
    "roe": null,
    "margine": 0.3185,
    "roa": 0.1439,
    "utileNetto": 8563000000,
    "ricavi": 26885000000,
    "patrimonioNetto": -1791000000
   }
  ]
 },
 "NKE": {
  "nome": "NIKE, Inc.",
  "anni": [
   {
    "anno": 2008,
    "roe": null,
    "margine": 0.1011,
    "roa": null,
    "utileNetto": 1883400000,
    "ricavi": 18627000000,
    "patrimonioNetto": 7825000000
   },
   {
    "anno": 2009,
    "roe": 0.1711,
    "margine": 0.0775,
    "roa": 0.1122,
    "utileNetto": 1487000000,
    "ricavi": 19176000000,
    "patrimonioNetto": 8693000000
   },
   {
    "anno": 2010,
    "roe": 0.1955,
    "margine": 0.1003,
    "roa": 0.1323,
    "utileNetto": 1907000000,
    "ricavi": 19014000000,
    "patrimonioNetto": 9754000000
   },
   {
    "anno": 2011,
    "roe": 0.2178,
    "margine": 0.106,
    "roa": 0.1422,
    "utileNetto": 2133000000,
    "ricavi": 20117000000,
    "patrimonioNetto": 9793000000
   },
   {
    "anno": 2012,
    "roe": 0.2143,
    "margine": 0.0948,
    "roa": 0.143,
    "utileNetto": 2211000000,
    "ricavi": 23331000000,
    "patrimonioNetto": 10319000000
   },
   {
    "anno": 2013,
    "roe": 0.2231,
    "margine": 0.0977,
    "roa": 0.1409,
    "utileNetto": 2472000000,
    "ricavi": 25313000000,
    "patrimonioNetto": 11081000000
   },
   {
    "anno": 2014,
    "roe": 0.2488,
    "margine": 0.0969,
    "roa": 0.1448,
    "utileNetto": 2693000000,
    "ricavi": 27799000000,
    "patrimonioNetto": 10824000000
   },
   {
    "anno": 2015,
    "roe": 0.2576,
    "margine": 0.107,
    "roa": 0.1515,
    "utileNetto": 3273000000,
    "ricavi": 30601000000,
    "patrimonioNetto": 12707000000
   },
   {
    "anno": 2016,
    "roe": 0.3067,
    "margine": 0.1161,
    "roa": 0.1759,
    "utileNetto": 3760000000,
    "ricavi": 32376000000,
    "patrimonioNetto": 12258000000
   },
   {
    "anno": 2017,
    "roe": 0.3417,
    "margine": 0.1234,
    "roa": 0.1823,
    "utileNetto": 4240000000,
    "ricavi": 34350000000,
    "patrimonioNetto": 12407000000
   },
   {
    "anno": 2018,
    "roe": 0.197,
    "margine": 0.0531,
    "roa": 0.0858,
    "utileNetto": 1933000000,
    "ricavi": 36397000000,
    "patrimonioNetto": 9812000000
   },
   {
    "anno": 2019,
    "roe": 0.4457,
    "margine": 0.103,
    "roa": 0.1699,
    "utileNetto": 4029000000,
    "ricavi": 39117000000,
    "patrimonioNetto": 9040000000
   },
   {
    "anno": 2020,
    "roe": 0.3152,
    "margine": 0.0679,
    "roa": 0.081,
    "utileNetto": 2539000000,
    "ricavi": 37403000000,
    "patrimonioNetto": 8055000000
   },
   {
    "anno": 2021,
    "roe": 0.4486,
    "margine": 0.1286,
    "roa": 0.1517,
    "utileNetto": 5727000000,
    "ricavi": 44538000000,
    "patrimonioNetto": 12767000000
   },
   {
    "anno": 2022,
    "roe": 0.3957,
    "margine": 0.1294,
    "roa": 0.1499,
    "utileNetto": 6046000000,
    "ricavi": 46710000000,
    "patrimonioNetto": 15281000000
   },
   {
    "anno": 2023,
    "roe": 0.362,
    "margine": 0.099,
    "roa": 0.1351,
    "utileNetto": 5070000000,
    "ricavi": 51217000000,
    "patrimonioNetto": 14004000000
   },
   {
    "anno": 2024,
    "roe": 0.395,
    "margine": 0.111,
    "roa": 0.1496,
    "utileNetto": 5700000000,
    "ricavi": 51362000000,
    "patrimonioNetto": 14430000000
   },
   {
    "anno": 2025,
    "roe": 0.2436,
    "margine": 0.0695,
    "roa": 0.088,
    "utileNetto": 3219000000,
    "ricavi": 46309000000,
    "patrimonioNetto": 13213000000
   },
   {
    "anno": 2026,
    "roe": 0.2091,
    "margine": 0.067,
    "roa": 0.0809,
    "utileNetto": 3108000000,
    "ricavi": 46398000000,
    "patrimonioNetto": 14865000000
   }
  ]
 },
 "SBUX": {
  "nome": "STARBUCKS CORP",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.0715,
    "roa": null,
    "utileNetto": 672600000,
    "ricavi": 9411500000,
    "patrimonioNetto": 2301400000
   },
   {
    "anno": 2008,
    "roe": 0.1257,
    "margine": 0.0304,
    "roa": 0.0556,
    "utileNetto": 315500000,
    "ricavi": 10383000000,
    "patrimonioNetto": 2509200000
   },
   {
    "anno": 2009,
    "roe": 0.1278,
    "margine": 0.04,
    "roa": 0.0701,
    "utileNetto": 390800000,
    "ricavi": 9774600000,
    "patrimonioNetto": 3056900000
   },
   {
    "anno": 2010,
    "roe": 0.2568,
    "margine": 0.0883,
    "roa": 0.1481,
    "utileNetto": 945600000,
    "ricavi": 10707400000,
    "patrimonioNetto": 3682300000
   },
   {
    "anno": 2011,
    "roe": 0.2839,
    "margine": 0.1065,
    "roa": 0.1692,
    "utileNetto": 1245700000,
    "ricavi": 11700400000,
    "patrimonioNetto": 4387300000
   },
   {
    "anno": 2012,
    "roe": 0.2706,
    "margine": 0.1042,
    "roa": 0.1684,
    "utileNetto": 1383800000,
    "ricavi": 13276800000,
    "patrimonioNetto": 5114500000
   },
   {
    "anno": 2013,
    "roe": 0.0019,
    "margine": 0.0006,
    "roa": 0.0007,
    "utileNetto": 8300000,
    "ricavi": 14866800000,
    "patrimonioNetto": 4482300000
   },
   {
    "anno": 2014,
    "roe": 0.3922,
    "margine": 0.1257,
    "roa": 0.1923,
    "utileNetto": 2068100000,
    "ricavi": 16447800000,
    "patrimonioNetto": 5273700000
   },
   {
    "anno": 2015,
    "roe": 0.4738,
    "margine": 0.1439,
    "roa": 0.2221,
    "utileNetto": 2757400000,
    "ricavi": 19162700000,
    "patrimonioNetto": 5819800000
   },
   {
    "anno": 2016,
    "roe": 0.4783,
    "margine": 0.1322,
    "roa": 0.1969,
    "utileNetto": 2817700000,
    "ricavi": 21315900000,
    "patrimonioNetto": 5890700000
   },
   {
    "anno": 2017,
    "roe": 0.5286,
    "margine": 0.1289,
    "roa": 0.2008,
    "utileNetto": 2884700000,
    "ricavi": 22386800000,
    "patrimonioNetto": 5457000000
   },
   {
    "anno": 2018,
    "roe": null,
    "margine": 0.1828,
    "roa": 0.187,
    "utileNetto": 4518300000,
    "ricavi": 24719500000,
    "patrimonioNetto": 1175800000
   },
   {
    "anno": 2019,
    "roe": null,
    "margine": 0.1358,
    "roa": 0.1873,
    "utileNetto": 3599200000,
    "ricavi": 26508600000,
    "patrimonioNetto": -6231000000
   },
   {
    "anno": 2020,
    "roe": null,
    "margine": 0.0395,
    "roa": 0.0316,
    "utileNetto": 928300000,
    "ricavi": 23518000000,
    "patrimonioNetto": -7799400000
   },
   {
    "anno": 2021,
    "roe": null,
    "margine": 0.1445,
    "roa": 0.1338,
    "utileNetto": 4199300000,
    "ricavi": 29060600000,
    "patrimonioNetto": -5314500000
   },
   {
    "anno": 2022,
    "roe": null,
    "margine": 0.1018,
    "roa": 0.1173,
    "utileNetto": 3281600000,
    "ricavi": 32250300000,
    "patrimonioNetto": -8698700000
   },
   {
    "anno": 2023,
    "roe": null,
    "margine": 0.1146,
    "roa": 0.1401,
    "utileNetto": 4124500000,
    "ricavi": 35975600000,
    "patrimonioNetto": -7987800000
   },
   {
    "anno": 2024,
    "roe": null,
    "margine": 0.104,
    "roa": 0.12,
    "utileNetto": 3760900000,
    "ricavi": 36176200000,
    "patrimonioNetto": -7448900000
   },
   {
    "anno": 2025,
    "roe": null,
    "margine": 0.0499,
    "roa": 0.058,
    "utileNetto": 1856400000,
    "ricavi": 37184400000,
    "patrimonioNetto": -8096600000
   }
  ]
 },
 "HD": {
  "nome": "HOME DEPOT, INC.",
  "anni": [
   {
    "anno": 2008,
    "roe": null,
    "margine": 0.0568,
    "roa": null,
    "utileNetto": 4395000000,
    "ricavi": 77349000000,
    "patrimonioNetto": 17714000000
   },
   {
    "anno": 2009,
    "roe": 0.1271,
    "margine": 0.0317,
    "roa": 0.0549,
    "utileNetto": 2260000000,
    "ricavi": 71288000000,
    "patrimonioNetto": 17777000000
   },
   {
    "anno": 2010,
    "roe": 0.1372,
    "margine": 0.0402,
    "roa": 0.0651,
    "utileNetto": 2661000000,
    "ricavi": 66176000000,
    "patrimonioNetto": 19393000000
   },
   {
    "anno": 2011,
    "roe": 0.1767,
    "margine": 0.0491,
    "roa": 0.0832,
    "utileNetto": 3338000000,
    "ricavi": 67997000000,
    "patrimonioNetto": 18889000000
   },
   {
    "anno": 2012,
    "roe": 0.217,
    "margine": 0.0552,
    "roa": 0.0958,
    "utileNetto": 3883000000,
    "ricavi": 70395000000,
    "patrimonioNetto": 17898000000
   },
   {
    "anno": 2013,
    "roe": 0.2551,
    "margine": 0.0607,
    "roa": 0.1104,
    "utileNetto": 4535000000,
    "ricavi": 74754000000,
    "patrimonioNetto": 17777000000
   },
   {
    "anno": 2014,
    "roe": 0.43,
    "margine": 0.0683,
    "roa": 0.1329,
    "utileNetto": 5385000000,
    "ricavi": 78812000000,
    "patrimonioNetto": 12522000000
   },
   {
    "anno": 2015,
    "roe": 0.6806,
    "margine": 0.0763,
    "roa": 0.1588,
    "utileNetto": 6345000000,
    "ricavi": 83176000000,
    "patrimonioNetto": 9322000000
   },
   {
    "anno": 2016,
    "roe": 1.1097,
    "margine": 0.0792,
    "roa": 0.167,
    "utileNetto": 7009000000,
    "ricavi": 88519000000,
    "patrimonioNetto": 6316000000
   },
   {
    "anno": 2017,
    "roe": 1.8364,
    "margine": 0.0841,
    "roa": 0.1852,
    "utileNetto": 7957000000,
    "ricavi": 94595000000,
    "patrimonioNetto": 4333000000
   },
   {
    "anno": 2018,
    "roe": null,
    "margine": 0.0855,
    "roa": 0.1938,
    "utileNetto": 8630000000,
    "ricavi": 100904000000,
    "patrimonioNetto": 1454000000
   },
   {
    "anno": 2019,
    "roe": null,
    "margine": 0.1028,
    "roa": 0.2527,
    "utileNetto": 11121000000,
    "ricavi": 108203000000,
    "patrimonioNetto": -1878000000
   },
   {
    "anno": 2020,
    "roe": null,
    "margine": 0.102,
    "roa": 0.2194,
    "utileNetto": 11242000000,
    "ricavi": 110225000000,
    "patrimonioNetto": -3116000000
   },
   {
    "anno": 2021,
    "roe": null,
    "margine": 0.0974,
    "roa": 0.1823,
    "utileNetto": 12866000000,
    "ricavi": 132110000000,
    "patrimonioNetto": 3299000000
   },
   {
    "anno": 2022,
    "roe": null,
    "margine": 0.1087,
    "roa": 0.2286,
    "utileNetto": 16433000000,
    "ricavi": 151157000000,
    "patrimonioNetto": -1696000000
   },
   {
    "anno": 2023,
    "roe": null,
    "margine": 0.1087,
    "roa": 0.2238,
    "utileNetto": 17105000000,
    "ricavi": 157403000000,
    "patrimonioNetto": 1562000000
   },
   {
    "anno": 2024,
    "roe": null,
    "margine": 0.0992,
    "roa": 0.1979,
    "utileNetto": 15143000000,
    "ricavi": 152669000000,
    "patrimonioNetto": 1044000000
   },
   {
    "anno": 2025,
    "roe": 2.2298,
    "margine": 0.0928,
    "roa": 0.154,
    "utileNetto": 14806000000,
    "ricavi": 159514000000,
    "patrimonioNetto": 6640000000
   },
   {
    "anno": 2026,
    "roe": 1.1048,
    "margine": 0.086,
    "roa": 0.1347,
    "utileNetto": 14156000000,
    "ricavi": 164683000000,
    "patrimonioNetto": 12813000000
   }
  ]
 },
 "TGT": {
  "nome": "TARGET CORP",
  "anni": [
   {
    "anno": 2008,
    "roe": null,
    "margine": 0.045,
    "roa": null,
    "utileNetto": 2849000000,
    "ricavi": 63367000000,
    "patrimonioNetto": 15307000000
   },
   {
    "anno": 2009,
    "roe": 0.1615,
    "margine": 0.0341,
    "roa": 0.0502,
    "utileNetto": 2214000000,
    "ricavi": 64948000000,
    "patrimonioNetto": 13712000000
   },
   {
    "anno": 2010,
    "roe": 0.1621,
    "margine": 0.0381,
    "roa": 0.0559,
    "utileNetto": 2488000000,
    "ricavi": 65357000000,
    "patrimonioNetto": 15347000000
   },
   {
    "anno": 2011,
    "roe": 0.1885,
    "margine": 0.0433,
    "roa": 0.0668,
    "utileNetto": 2920000000,
    "ricavi": 67390000000,
    "patrimonioNetto": 15487000000
   },
   {
    "anno": 2012,
    "roe": 0.1851,
    "margine": 0.0419,
    "roa": 0.0628,
    "utileNetto": 2929000000,
    "ricavi": 69865000000,
    "patrimonioNetto": 15821000000
   },
   {
    "anno": 2021,
    "roe": 0.3025,
    "margine": 0.0467,
    "roa": 0.0852,
    "utileNetto": 4368000000,
    "ricavi": 93561000000,
    "patrimonioNetto": 14440000000
   },
   {
    "anno": 2022,
    "roe": 0.5415,
    "margine": 0.0655,
    "roa": 0.1291,
    "utileNetto": 6946000000,
    "ricavi": 106005000000,
    "patrimonioNetto": 12827000000
   },
   {
    "anno": 2023,
    "roe": 0.2475,
    "margine": 0.0255,
    "roa": 0.0521,
    "utileNetto": 2780000000,
    "ricavi": 109120000000,
    "patrimonioNetto": 11232000000
   },
   {
    "anno": 2024,
    "roe": 0.3081,
    "margine": 0.0385,
    "roa": 0.0748,
    "utileNetto": 4138000000,
    "ricavi": 107412000000,
    "patrimonioNetto": 13432000000
   },
   {
    "anno": 2025,
    "roe": 0.2789,
    "margine": 0.0384,
    "roa": 0.0708,
    "utileNetto": 4091000000,
    "ricavi": 106566000000,
    "patrimonioNetto": 14666000000
   },
   {
    "anno": 2026,
    "roe": 0.2292,
    "margine": 0.0354,
    "roa": 0.0623,
    "utileNetto": 3705000000,
    "ricavi": 104780000000,
    "patrimonioNetto": 16165000000
   }
  ]
 },
 "CL": {
  "nome": "COLGATE PALMOLIVE CO",
  "anni": [
   {
    "anno": 2008,
    "roe": 1.0177,
    "margine": 0.1277,
    "roa": 0.1961,
    "utileNetto": 1957000000,
    "ricavi": 15330000000,
    "patrimonioNetto": 1923000000
   },
   {
    "anno": 2009,
    "roe": 0.7352,
    "margine": 0.1495,
    "roa": 0.2058,
    "utileNetto": 2291000000,
    "ricavi": 15327000000,
    "patrimonioNetto": 3116000000
   },
   {
    "anno": 2010,
    "roe": 0.8236,
    "margine": 0.1415,
    "roa": 0.1972,
    "utileNetto": 2203000000,
    "ricavi": 15564000000,
    "patrimonioNetto": 2675000000
   },
   {
    "anno": 2011,
    "roe": 1.0236,
    "margine": 0.1453,
    "roa": 0.1911,
    "utileNetto": 2431000000,
    "ricavi": 16734000000,
    "patrimonioNetto": 2375000000
   },
   {
    "anno": 2012,
    "roe": 1.1293,
    "margine": 0.1447,
    "roa": 0.1846,
    "utileNetto": 2472000000,
    "ricavi": 17085000000,
    "patrimonioNetto": 2189000000
   },
   {
    "anno": 2013,
    "roe": 0.9722,
    "margine": 0.1286,
    "roa": 0.1602,
    "utileNetto": 2241000000,
    "ricavi": 17420000000,
    "patrimonioNetto": 2305000000
   },
   {
    "anno": 2014,
    "roe": 1.9039,
    "margine": 0.1262,
    "roa": 0.1622,
    "utileNetto": 2180000000,
    "ricavi": 17277000000,
    "patrimonioNetto": 1145000000
   },
   {
    "anno": 2015,
    "roe": null,
    "margine": 0.0863,
    "roa": 0.116,
    "utileNetto": 1384000000,
    "ricavi": 16034000000,
    "patrimonioNetto": -299000000
   },
   {
    "anno": 2016,
    "roe": null,
    "margine": 0.1606,
    "roa": 0.2014,
    "utileNetto": 2441000000,
    "ricavi": 15195000000,
    "patrimonioNetto": -243000000
   },
   {
    "anno": 2017,
    "roe": null,
    "margine": 0.131,
    "roa": 0.1597,
    "utileNetto": 2024000000,
    "ricavi": 15454000000,
    "patrimonioNetto": -60000000
   },
   {
    "anno": 2018,
    "roe": null,
    "margine": 0.1544,
    "roa": 0.1974,
    "utileNetto": 2400000000,
    "ricavi": 15544000000,
    "patrimonioNetto": -102000000
   },
   {
    "anno": 2019,
    "roe": null,
    "margine": 0.1508,
    "roa": 0.1574,
    "utileNetto": 2367000000,
    "ricavi": 15693000000,
    "patrimonioNetto": 117000000
   },
   {
    "anno": 2020,
    "roe": null,
    "margine": 0.1636,
    "roa": 0.1693,
    "utileNetto": 2695000000,
    "ricavi": 16471000000,
    "patrimonioNetto": 743000000
   },
   {
    "anno": 2021,
    "roe": null,
    "margine": 0.1243,
    "roa": 0.144,
    "utileNetto": 2166000000,
    "ricavi": 17421000000,
    "patrimonioNetto": 609000000
   },
   {
    "anno": 2022,
    "roe": null,
    "margine": 0.0993,
    "roa": 0.1135,
    "utileNetto": 1785000000,
    "ricavi": 17967000000,
    "patrimonioNetto": 401000000
   },
   {
    "anno": 2023,
    "roe": null,
    "margine": 0.1182,
    "roa": 0.1403,
    "utileNetto": 2300000000,
    "ricavi": 19457000000,
    "patrimonioNetto": 609000000
   },
   {
    "anno": 2024,
    "roe": null,
    "margine": 0.1437,
    "roa": 0.18,
    "utileNetto": 2889000000,
    "ricavi": 20101000000,
    "patrimonioNetto": 212000000
   },
   {
    "anno": 2025,
    "roe": null,
    "margine": 0.1046,
    "roa": 0.1306,
    "utileNetto": 2132000000,
    "ricavi": 20382000000,
    "patrimonioNetto": 54000000
   }
  ]
 },
 "KMB": {
  "nome": "KIMBERLY CLARK CORP",
  "anni": [
   {
    "anno": 2008,
    "roe": 0.4358,
    "margine": 0.087,
    "roa": 0.0934,
    "utileNetto": 1690000000,
    "ricavi": 19415000000,
    "patrimonioNetto": 3878000000
   },
   {
    "anno": 2009,
    "roe": 0.3485,
    "margine": 0.0986,
    "roa": 0.0981,
    "utileNetto": 1884000000,
    "ricavi": 19115000000,
    "patrimonioNetto": 5406000000
   },
   {
    "anno": 2010,
    "roe": 0.3115,
    "margine": 0.0933,
    "roa": 0.0928,
    "utileNetto": 1843000000,
    "ricavi": 19746000000,
    "patrimonioNetto": 5917000000
   },
   {
    "anno": 2011,
    "roe": 0.3031,
    "margine": 0.0763,
    "roa": 0.0821,
    "utileNetto": 1591000000,
    "ricavi": 20846000000,
    "patrimonioNetto": 5249000000
   },
   {
    "anno": 2012,
    "roe": 0.3511,
    "margine": 0.0899,
    "roa": 0.0881,
    "utileNetto": 1750000000,
    "ricavi": 19467000000,
    "patrimonioNetto": 4985000000
   },
   {
    "anno": 2013,
    "roe": 0.4411,
    "margine": 0.1095,
    "roa": 0.1132,
    "utileNetto": 2142000000,
    "ricavi": 19561000000,
    "patrimonioNetto": 4856000000
   },
   {
    "anno": 2014,
    "roe": null,
    "margine": 0.0774,
    "roa": 0.0983,
    "utileNetto": 1526000000,
    "ricavi": 19724000000,
    "patrimonioNetto": 729000000
   },
   {
    "anno": 2015,
    "roe": null,
    "margine": 0.0545,
    "roa": 0.0683,
    "utileNetto": 1013000000,
    "ricavi": 18591000000,
    "patrimonioNetto": -174000000
   },
   {
    "anno": 2016,
    "roe": null,
    "margine": 0.1184,
    "roa": 0.1483,
    "utileNetto": 2166000000,
    "ricavi": 18287000000,
    "patrimonioNetto": 117000000
   },
   {
    "anno": 2017,
    "roe": 2.5828,
    "margine": 0.1242,
    "roa": 0.1504,
    "utileNetto": 2278000000,
    "ricavi": 18348000000,
    "patrimonioNetto": 882000000
   },
   {
    "anno": 2018,
    "roe": null,
    "margine": 0.0763,
    "roa": 0.0971,
    "utileNetto": 1410000000,
    "ricavi": 18486000000,
    "patrimonioNetto": -46000000
   },
   {
    "anno": 2019,
    "roe": null,
    "margine": 0.1169,
    "roa": 0.1411,
    "utileNetto": 2157000000,
    "ricavi": 18450000000,
    "patrimonioNetto": 194000000
   },
   {
    "anno": 2020,
    "roe": null,
    "margine": 0.1229,
    "roa": 0.1342,
    "utileNetto": 2352000000,
    "ricavi": 19140000000,
    "patrimonioNetto": 869000000
   },
   {
    "anno": 2021,
    "roe": null,
    "margine": 0.0933,
    "roa": 0.1017,
    "utileNetto": 1814000000,
    "ricavi": 19440000000,
    "patrimonioNetto": 737000000
   },
   {
    "anno": 2022,
    "roe": null,
    "margine": 0.0959,
    "roa": 0.1076,
    "utileNetto": 1934000000,
    "ricavi": 20175000000,
    "patrimonioNetto": 700000000
   },
   {
    "anno": 2023,
    "roe": 1.6517,
    "margine": 0.1029,
    "roa": 0.1017,
    "utileNetto": 1764000000,
    "ricavi": 17146000000,
    "patrimonioNetto": 1068000000
   },
   {
    "anno": 2024,
    "roe": 3.0298,
    "margine": 0.1514,
    "roa": 0.1538,
    "utileNetto": 2545000000,
    "ricavi": 16805000000,
    "patrimonioNetto": 840000000
   },
   {
    "anno": 2025,
    "roe": 1.3455,
    "margine": 0.1229,
    "roa": 0.1182,
    "utileNetto": 2021000000,
    "ricavi": 16447000000,
    "patrimonioNetto": 1502000000
   }
  ]
 },
 "MDLZ": {
  "nome": "Mondelez International, Inc.",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.0759,
    "roa": null,
    "utileNetto": 2721000000,
    "ricavi": 35858000000,
    "patrimonioNetto": 27445000000
   },
   {
    "anno": 2008,
    "roe": 0.129,
    "margine": 0.0712,
    "roa": 0.0457,
    "utileNetto": 2884000000,
    "ricavi": 40492000000,
    "patrimonioNetto": 22356000000
   },
   {
    "anno": 2009,
    "roe": 0.1163,
    "margine": 0.078,
    "roa": 0.0453,
    "utileNetto": 3021000000,
    "ricavi": 38754000000,
    "patrimonioNetto": 25972000000
   },
   {
    "anno": 2010,
    "roe": 0.1144,
    "margine": 0.1306,
    "roa": 0.0432,
    "utileNetto": 4114000000,
    "ricavi": 31489000000,
    "patrimonioNetto": 35967000000
   },
   {
    "anno": 2011,
    "roe": 0.1004,
    "margine": 0.0992,
    "roa": 0.0379,
    "utileNetto": 3554000000,
    "ricavi": 35810000000,
    "patrimonioNetto": 35382000000
   },
   {
    "anno": 2012,
    "roe": 0.0946,
    "margine": 0.0876,
    "roa": 0.0406,
    "utileNetto": 3067000000,
    "ricavi": 35015000000,
    "patrimonioNetto": 32416000000
   },
   {
    "anno": 2013,
    "roe": 0.1203,
    "margine": 0.1109,
    "roa": 0.054,
    "utileNetto": 3915000000,
    "ricavi": 35299000000,
    "patrimonioNetto": 32532000000
   },
   {
    "anno": 2014,
    "roe": 0.0784,
    "margine": 0.0638,
    "roa": 0.0327,
    "utileNetto": 2184000000,
    "ricavi": 34244000000,
    "patrimonioNetto": 27853000000
   },
   {
    "anno": 2015,
    "roe": 0.2586,
    "margine": 0.2452,
    "roa": 0.1156,
    "utileNetto": 7267000000,
    "ricavi": 29636000000,
    "patrimonioNetto": 28100000000
   },
   {
    "anno": 2016,
    "roe": 0.0649,
    "margine": 0.0631,
    "roa": 0.0266,
    "utileNetto": 1635000000,
    "ricavi": 25923000000,
    "patrimonioNetto": 25195000000
   },
   {
    "anno": 2017,
    "roe": 0.1087,
    "margine": 0.1092,
    "roa": 0.0449,
    "utileNetto": 2828000000,
    "ricavi": 25896000000,
    "patrimonioNetto": 26025000000
   },
   {
    "anno": 2018,
    "roe": 0.1296,
    "margine": 0.1279,
    "roa": 0.053,
    "utileNetto": 3317000000,
    "ricavi": 25938000000,
    "patrimonioNetto": 25602000000
   },
   {
    "anno": 2019,
    "roe": 0.1438,
    "margine": 0.1519,
    "roa": 0.0609,
    "utileNetto": 3929000000,
    "ricavi": 25868000000,
    "patrimonioNetto": 27317000000
   },
   {
    "anno": 2020,
    "roe": 0.1286,
    "margine": 0.1337,
    "roa": 0.0524,
    "utileNetto": 3555000000,
    "ricavi": 26581000000,
    "patrimonioNetto": 27654000000
   },
   {
    "anno": 2021,
    "roe": 0.1518,
    "margine": 0.1497,
    "roa": 0.0641,
    "utileNetto": 4300000000,
    "ricavi": 28720000000,
    "patrimonioNetto": 28323000000
   },
   {
    "anno": 2022,
    "roe": 0.1009,
    "margine": 0.0863,
    "roa": 0.0382,
    "utileNetto": 2717000000,
    "ricavi": 31496000000,
    "patrimonioNetto": 26920000000
   },
   {
    "anno": 2023,
    "roe": 0.1748,
    "margine": 0.1377,
    "roa": 0.0695,
    "utileNetto": 4959000000,
    "ricavi": 36016000000,
    "patrimonioNetto": 28366000000
   },
   {
    "anno": 2024,
    "roe": 0.1712,
    "margine": 0.1265,
    "roa": 0.0673,
    "utileNetto": 4611000000,
    "ricavi": 36441000000,
    "patrimonioNetto": 26932000000
   },
   {
    "anno": 2025,
    "roe": 0.0949,
    "margine": 0.0636,
    "roa": 0.0343,
    "utileNetto": 2451000000,
    "ricavi": 38537000000,
    "patrimonioNetto": 25838000000
   }
  ]
 },
 "MO": {
  "nome": "ALTRIA GROUP, INC.",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.5243,
    "roa": null,
    "utileNetto": 9786000000,
    "ricavi": 18664000000,
    "patrimonioNetto": 19320000000
   },
   {
    "anno": 2008,
    "roe": 1.7433,
    "margine": 0.2547,
    "roa": 0.1812,
    "utileNetto": 4930000000,
    "ricavi": 19356000000,
    "patrimonioNetto": 2828000000
   },
   {
    "anno": 2009,
    "roe": 0.7873,
    "margine": 0.1361,
    "roa": 0.0874,
    "utileNetto": 3206000000,
    "ricavi": 23556000000,
    "patrimonioNetto": 4072000000
   },
   {
    "anno": 2010,
    "roe": 0.7521,
    "margine": 0.1604,
    "roa": 0.1045,
    "utileNetto": 3907000000,
    "ricavi": 24363000000,
    "patrimonioNetto": 5195000000
   },
   {
    "anno": 2011,
    "roe": 0.9204,
    "margine": 0.1424,
    "roa": 0.0922,
    "utileNetto": 3390000000,
    "ricavi": 23800000000,
    "patrimonioNetto": 3683000000
   },
   {
    "anno": 2012,
    "roe": 1.3186,
    "margine": 0.1698,
    "roa": 0.1183,
    "utileNetto": 4180000000,
    "ricavi": 24618000000,
    "patrimonioNetto": 3170000000
   },
   {
    "anno": 2013,
    "roe": 1.1013,
    "margine": 0.1854,
    "roa": 0.1301,
    "utileNetto": 4535000000,
    "ricavi": 24466000000,
    "patrimonioNetto": 4118000000
   },
   {
    "anno": 2014,
    "roe": 1.6844,
    "margine": 0.2068,
    "roa": 0.1471,
    "utileNetto": 5070000000,
    "ricavi": 24522000000,
    "patrimonioNetto": 3010000000
   },
   {
    "anno": 2015,
    "roe": 1.8242,
    "margine": 0.2061,
    "roa": 0.1666,
    "utileNetto": 5241000000,
    "ricavi": 25434000000,
    "patrimonioNetto": 2873000000
   },
   {
    "anno": 2016,
    "roe": 1.1148,
    "margine": 0.5531,
    "roa": 0.31,
    "utileNetto": 14239000000,
    "ricavi": 25744000000,
    "patrimonioNetto": 12773000000
   },
   {
    "anno": 2017,
    "roe": 0.6646,
    "margine": 0.3997,
    "roa": 0.2366,
    "utileNetto": 10222000000,
    "ricavi": 25576000000,
    "patrimonioNetto": 15380000000
   },
   {
    "anno": 2018,
    "roe": 0.4708,
    "margine": 0.2745,
    "roa": 0.1256,
    "utileNetto": 6963000000,
    "ricavi": 25364000000,
    "patrimonioNetto": 14789000000
   },
   {
    "anno": 2019,
    "roe": -0.2046,
    "margine": -0.0515,
    "roa": -0.0262,
    "utileNetto": -1293000000,
    "ricavi": 25110000000,
    "patrimonioNetto": 6319000000
   },
   {
    "anno": 2020,
    "roe": 1.5272,
    "margine": 0.1708,
    "roa": 0.0942,
    "utileNetto": 4467000000,
    "ricavi": 26153000000,
    "patrimonioNetto": 2925000000
   },
   {
    "anno": 2021,
    "roe": null,
    "margine": 0.0951,
    "roa": 0.0626,
    "utileNetto": 2475000000,
    "ricavi": 26013000000,
    "patrimonioNetto": -1606000000
   },
   {
    "anno": 2022,
    "roe": null,
    "margine": 0.2297,
    "roa": 0.156,
    "utileNetto": 5764000000,
    "ricavi": 25096000000,
    "patrimonioNetto": -3923000000
   },
   {
    "anno": 2023,
    "roe": null,
    "margine": 0.3321,
    "roa": 0.2108,
    "utileNetto": 8130000000,
    "ricavi": 24483000000,
    "patrimonioNetto": -3490000000
   },
   {
    "anno": 2024,
    "roe": null,
    "margine": 0.469,
    "roa": 0.3202,
    "utileNetto": 11264000000,
    "ricavi": 24018000000,
    "patrimonioNetto": -2238000000
   },
   {
    "anno": 2025,
    "roe": null,
    "margine": 0.2984,
    "roa": 0.1984,
    "utileNetto": 6947000000,
    "ricavi": 23279000000,
    "patrimonioNetto": -3502000000
   }
  ]
 },
 "XOM": {
  "nome": "ExxonMobil Holdings Corp",
  "anni": []
 },
 "CVX": {
  "nome": "CHEVRON CORP",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.0846,
    "roa": null,
    "utileNetto": 18688000000,
    "ricavi": 220904000000,
    "patrimonioNetto": 77088000000
   },
   {
    "anno": 2008,
    "roe": 0.2762,
    "margine": 0.0877,
    "roa": 0.1485,
    "utileNetto": 23931000000,
    "ricavi": 273005000000,
    "patrimonioNetto": 86648000000
   },
   {
    "anno": 2009,
    "roe": 0.1141,
    "margine": 0.0611,
    "roa": 0.0637,
    "utileNetto": 10483000000,
    "ricavi": 171636000000,
    "patrimonioNetto": 91914000000
   },
   {
    "anno": 2010,
    "roe": 0.1798,
    "margine": 0.0928,
    "roa": 0.103,
    "utileNetto": 19024000000,
    "ricavi": 204928000000,
    "patrimonioNetto": 105811000000
   },
   {
    "anno": 2011,
    "roe": 0.2201,
    "margine": 0.106,
    "roa": 0.1284,
    "utileNetto": 26895000000,
    "ricavi": 253706000000,
    "patrimonioNetto": 122181000000
   },
   {
    "anno": 2012,
    "roe": 0.1899,
    "margine": 0.1082,
    "roa": 0.1124,
    "utileNetto": 26179000000,
    "ricavi": 241909000000,
    "patrimonioNetto": 137832000000
   },
   {
    "anno": 2013,
    "roe": 0.1424,
    "margine": 0.0936,
    "roa": 0.0844,
    "utileNetto": 21423000000,
    "ricavi": 228848000000,
    "patrimonioNetto": 150427000000
   },
   {
    "anno": 2014,
    "roe": 0.1232,
    "margine": 0.0908,
    "roa": 0.0723,
    "utileNetto": 19241000000,
    "ricavi": 211970000000,
    "patrimonioNetto": 156191000000
   },
   {
    "anno": 2015,
    "roe": 0.0298,
    "margine": 0.0331,
    "roa": 0.0173,
    "utileNetto": 4587000000,
    "ricavi": 138477000000,
    "patrimonioNetto": 153886000000
   },
   {
    "anno": 2016,
    "roe": -0.0034,
    "margine": -0.0043,
    "roa": -0.0019,
    "utileNetto": -497000000,
    "ricavi": 114472000000,
    "patrimonioNetto": 146722000000
   },
   {
    "anno": 2017,
    "roe": 0.0616,
    "margine": 0.0649,
    "roa": 0.0362,
    "utileNetto": 9195000000,
    "ricavi": 141722000000,
    "patrimonioNetto": 149319000000
   },
   {
    "anno": 2018,
    "roe": 0.0952,
    "margine": 0.0891,
    "roa": 0.0584,
    "utileNetto": 14824000000,
    "ricavi": 166339000000,
    "patrimonioNetto": 155642000000
   },
   {
    "anno": 2019,
    "roe": 0.0201,
    "margine": 0.02,
    "roa": 0.0123,
    "utileNetto": 2924000000,
    "ricavi": 146516000000,
    "patrimonioNetto": 145208000000
   },
   {
    "anno": 2020,
    "roe": -0.0418,
    "margine": -0.0585,
    "roa": -0.0231,
    "utileNetto": -5543000000,
    "ricavi": 94692000000,
    "patrimonioNetto": 132726000000
   },
   {
    "anno": 2021,
    "roe": 0.1117,
    "margine": 0.0962,
    "roa": 0.0652,
    "utileNetto": 15625000000,
    "ricavi": 162465000000,
    "patrimonioNetto": 139940000000
   },
   {
    "anno": 2022,
    "roe": 0.2213,
    "margine": 0.144,
    "roa": 0.1376,
    "utileNetto": 35465000000,
    "ricavi": 246252000000,
    "patrimonioNetto": 160242000000
   },
   {
    "anno": 2023,
    "roe": 0.132,
    "margine": 0.1063,
    "roa": 0.0817,
    "utileNetto": 21369000000,
    "ricavi": 200949000000,
    "patrimonioNetto": 161929000000
   },
   {
    "anno": 2024,
    "roe": 0.1159,
    "margine": 0.0871,
    "roa": 0.0687,
    "utileNetto": 17661000000,
    "ricavi": 202792000000,
    "patrimonioNetto": 152318000000
   },
   {
    "anno": 2025,
    "roe": 0.066,
    "margine": 0.0651,
    "roa": 0.038,
    "utileNetto": 12299000000,
    "ricavi": 189031000000,
    "patrimonioNetto": 186450000000
   }
  ]
 },
 "COP": {
  "nome": "CONOCOPHILLIPS",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.0634,
    "roa": null,
    "utileNetto": 11891000000,
    "ricavi": 187437000000,
    "patrimonioNetto": 89507000000
   },
   {
    "anno": 2008,
    "roe": -0.2906,
    "margine": -0.0679,
    "roa": -0.1144,
    "utileNetto": -16349000000,
    "ricavi": 240842000000,
    "patrimonioNetto": 56265000000
   },
   {
    "anno": 2009,
    "roe": 0.0705,
    "margine": 0.0296,
    "roa": 0.029,
    "utileNetto": 4414000000,
    "ricavi": 149341000000,
    "patrimonioNetto": 62628000000
   },
   {
    "anno": 2010,
    "roe": 0.1643,
    "margine": 0.1793,
    "roa": 0.0727,
    "utileNetto": 11358000000,
    "ricavi": 63335000000,
    "patrimonioNetto": 69124000000
   },
   {
    "anno": 2011,
    "roe": 0.1891,
    "margine": 0.1882,
    "roa": 0.0812,
    "utileNetto": 12436000000,
    "ricavi": 66069000000,
    "patrimonioNetto": 65749000000
   },
   {
    "anno": 2012,
    "roe": 0.174,
    "margine": 0.1359,
    "roa": 0.0719,
    "utileNetto": 8428000000,
    "ricavi": 62004000000,
    "patrimonioNetto": 48427000000
   },
   {
    "anno": 2013,
    "roe": 0.1744,
    "margine": 0.1572,
    "roa": 0.0776,
    "utileNetto": 9156000000,
    "ricavi": 58248000000,
    "patrimonioNetto": 52492000000
   },
   {
    "anno": 2014,
    "roe": 0.1314,
    "margine": 0.1237,
    "roa": 0.0589,
    "utileNetto": 6869000000,
    "ricavi": 55517000000,
    "patrimonioNetto": 52273000000
   },
   {
    "anno": 2015,
    "roe": -0.1105,
    "margine": -0.1431,
    "roa": -0.0454,
    "utileNetto": -4428000000,
    "ricavi": 30935000000,
    "patrimonioNetto": 40082000000
   },
   {
    "anno": 2016,
    "roe": -0.1026,
    "margine": -0.1484,
    "roa": -0.0403,
    "utileNetto": -3615000000,
    "ricavi": 24360000000,
    "patrimonioNetto": 35226000000
   },
   {
    "anno": 2017,
    "roe": -0.0278,
    "margine": -0.0262,
    "roa": -0.0117,
    "utileNetto": -855000000,
    "ricavi": 32584000000,
    "patrimonioNetto": 30801000000
   },
   {
    "anno": 2018,
    "roe": 0.1951,
    "margine": 0.1616,
    "roa": 0.0894,
    "utileNetto": 6257000000,
    "ricavi": 38727000000,
    "patrimonioNetto": 32064000000
   },
   {
    "anno": 2019,
    "roe": 0.2051,
    "margine": 0.196,
    "roa": 0.102,
    "utileNetto": 7189000000,
    "ricavi": 36670000000,
    "patrimonioNetto": 35050000000
   },
   {
    "anno": 2020,
    "roe": -0.0905,
    "margine": -0.1438,
    "roa": -0.0431,
    "utileNetto": -2701000000,
    "ricavi": 18784000000,
    "patrimonioNetto": 29849000000
   },
   {
    "anno": 2021,
    "roe": 0.1779,
    "margine": 0.1763,
    "roa": 0.0891,
    "utileNetto": 8079000000,
    "ricavi": 45828000000,
    "patrimonioNetto": 45406000000
   },
   {
    "anno": 2022,
    "roe": 0.3891,
    "margine": 0.238,
    "roa": 0.1991,
    "utileNetto": 18680000000,
    "ricavi": 78494000000,
    "patrimonioNetto": 48003000000
   },
   {
    "anno": 2023,
    "roe": 0.2223,
    "margine": 0.1952,
    "roa": 0.1142,
    "utileNetto": 10957000000,
    "ricavi": 56141000000,
    "patrimonioNetto": 49279000000
   },
   {
    "anno": 2024,
    "roe": 0.1427,
    "margine": 0.1689,
    "roa": 0.0753,
    "utileNetto": 9245000000,
    "ricavi": 54745000000,
    "patrimonioNetto": 64796000000
   },
   {
    "anno": 2025,
    "roe": 0.1239,
    "margine": 0.1355,
    "roa": 0.0655,
    "utileNetto": 7988000000,
    "ricavi": 58944000000,
    "patrimonioNetto": 64487000000
   }
  ]
 },
 "CAT": {
  "nome": "CATERPILLAR INC",
  "anni": [
   {
    "anno": 2007,
    "roe": 0.3943,
    "margine": 0.0788,
    "roa": 0.0631,
    "utileNetto": 3541000000,
    "ricavi": 44958000000,
    "patrimonioNetto": 8980000000
   },
   {
    "anno": 2008,
    "roe": 0.5746,
    "margine": 0.0693,
    "roa": 0.0525,
    "utileNetto": 3557000000,
    "ricavi": 51324000000,
    "patrimonioNetto": 6190000000
   },
   {
    "anno": 2009,
    "roe": 0.0938,
    "margine": 0.0255,
    "roa": 0.0138,
    "utileNetto": 827000000,
    "ricavi": 32396000000,
    "patrimonioNetto": 8820000000
   },
   {
    "anno": 2010,
    "roe": 0.2539,
    "margine": 0.0648,
    "roa": 0.0431,
    "utileNetto": 2758000000,
    "ricavi": 42588000000,
    "patrimonioNetto": 10864000000
   },
   {
    "anno": 2011,
    "roe": 0.3853,
    "margine": 0.0828,
    "roa": 0.0613,
    "utileNetto": 4981000000,
    "ricavi": 60138000000,
    "patrimonioNetto": 12929000000
   },
   {
    "anno": 2012,
    "roe": 0.3254,
    "margine": 0.0869,
    "roa": 0.0643,
    "utileNetto": 5722000000,
    "ricavi": 65875000000,
    "patrimonioNetto": 17582000000
   },
   {
    "anno": 2013,
    "roe": 0.1822,
    "margine": 0.0683,
    "roa": 0.0448,
    "utileNetto": 3803000000,
    "ricavi": 55656000000,
    "patrimonioNetto": 20878000000
   },
   {
    "anno": 2014,
    "roe": 0.1467,
    "margine": 0.0447,
    "roa": 0.0292,
    "utileNetto": 2468000000,
    "ricavi": 55184000000,
    "patrimonioNetto": 16826000000
   },
   {
    "anno": 2015,
    "roe": 0.1695,
    "margine": 0.0537,
    "roa": 0.0322,
    "utileNetto": 2523000000,
    "ricavi": 47011000000,
    "patrimonioNetto": 14885000000
   },
   {
    "anno": 2016,
    "roe": -0.0045,
    "margine": -0.0015,
    "roa": -0.0008,
    "utileNetto": -59000000,
    "ricavi": 38537000000,
    "patrimonioNetto": 13228000000
   },
   {
    "anno": 2017,
    "roe": 0.0551,
    "margine": 0.0167,
    "roa": 0.0099,
    "utileNetto": 759000000,
    "ricavi": 45462000000,
    "patrimonioNetto": 13766000000
   },
   {
    "anno": 2018,
    "roe": 0.4366,
    "margine": 0.1123,
    "roa": 0.0783,
    "utileNetto": 6148000000,
    "ricavi": 54722000000,
    "patrimonioNetto": 14080000000
   },
   {
    "anno": 2019,
    "roe": 0.4166,
    "margine": 0.1133,
    "roa": 0.0777,
    "utileNetto": 6094000000,
    "ricavi": 53800000000,
    "patrimonioNetto": 14629000000
   },
   {
    "anno": 2020,
    "roe": 0.1953,
    "margine": 0.0719,
    "roa": 0.0383,
    "utileNetto": 3003000000,
    "ricavi": 41748000000,
    "patrimonioNetto": 15378000000
   },
   {
    "anno": 2021,
    "roe": 0.3931,
    "margine": 0.1274,
    "roa": 0.0784,
    "utileNetto": 6493000000,
    "ricavi": 50971000000,
    "patrimonioNetto": 16516000000
   },
   {
    "anno": 2022,
    "roe": 0.4219,
    "margine": 0.1128,
    "roa": 0.0818,
    "utileNetto": 6704000000,
    "ricavi": 59427000000,
    "patrimonioNetto": 15891000000
   },
   {
    "anno": 2023,
    "roe": 0.5298,
    "margine": 0.1541,
    "roa": 0.1181,
    "utileNetto": 10332000000,
    "ricavi": 67060000000,
    "patrimonioNetto": 19503000000
   },
   {
    "anno": 2024,
    "roe": 0.5534,
    "margine": 0.1665,
    "roa": 0.1229,
    "utileNetto": 10788000000,
    "ricavi": 64809000000,
    "patrimonioNetto": 19494000000
   },
   {
    "anno": 2025,
    "roe": 0.4166,
    "margine": 0.1314,
    "roa": 0.0901,
    "utileNetto": 8882000000,
    "ricavi": 67589000000,
    "patrimonioNetto": 21318000000
   }
  ]
 },
 "BA": {
  "nome": "BOEING CO",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.0614,
    "roa": null,
    "utileNetto": 4074000000,
    "ricavi": 66387000000,
    "patrimonioNetto": 9078000000
   },
   {
    "anno": 2008,
    "roe": null,
    "margine": 0.0439,
    "roa": 0.0497,
    "utileNetto": 2672000000,
    "ricavi": 60909000000,
    "patrimonioNetto": -1142000000
   },
   {
    "anno": 2009,
    "roe": null,
    "margine": 0.0192,
    "roa": 0.0211,
    "utileNetto": 1312000000,
    "ricavi": 68281000000,
    "patrimonioNetto": 2225000000
   },
   {
    "anno": 2010,
    "roe": null,
    "margine": 0.0514,
    "roa": 0.0482,
    "utileNetto": 3307000000,
    "ricavi": 64306000000,
    "patrimonioNetto": 2862000000
   },
   {
    "anno": 2011,
    "roe": null,
    "margine": 0.0585,
    "roa": 0.0502,
    "utileNetto": 4018000000,
    "ricavi": 68735000000,
    "patrimonioNetto": 3608000000
   },
   {
    "anno": 2012,
    "roe": 0.6536,
    "margine": 0.0477,
    "roa": 0.0439,
    "utileNetto": 3900000000,
    "ricavi": 81698000000,
    "patrimonioNetto": 5967000000
   },
   {
    "anno": 2013,
    "roe": 0.3057,
    "margine": 0.0529,
    "roa": 0.0495,
    "utileNetto": 4585000000,
    "ricavi": 86623000000,
    "patrimonioNetto": 14997000000
   },
   {
    "anno": 2014,
    "roe": 0.6196,
    "margine": 0.06,
    "roa": 0.0586,
    "utileNetto": 5446000000,
    "ricavi": 90762000000,
    "patrimonioNetto": 8790000000
   },
   {
    "anno": 2015,
    "roe": 0.7092,
    "margine": 0.0539,
    "roa": 0.0548,
    "utileNetto": 5176000000,
    "ricavi": 96114000000,
    "patrimonioNetto": 7298000000
   },
   {
    "anno": 2016,
    "roe": null,
    "margine": 0.0538,
    "roa": 0.0559,
    "utileNetto": 5034000000,
    "ricavi": 93496000000,
    "patrimonioNetto": 1917000000
   },
   {
    "anno": 2017,
    "roe": null,
    "margine": 0.09,
    "roa": 0.0753,
    "utileNetto": 8458000000,
    "ricavi": 94005000000,
    "patrimonioNetto": 1713000000
   },
   {
    "anno": 2018,
    "roe": null,
    "margine": 0.1034,
    "roa": 0.0891,
    "utileNetto": 10460000000,
    "ricavi": 101127000000,
    "patrimonioNetto": 410000000
   },
   {
    "anno": 2019,
    "roe": null,
    "margine": -0.0083,
    "roa": -0.0048,
    "utileNetto": -636000000,
    "ricavi": 76559000000,
    "patrimonioNetto": -8462000000
   },
   {
    "anno": 2020,
    "roe": null,
    "margine": -0.2042,
    "roa": -0.078,
    "utileNetto": -11873000000,
    "ricavi": 58158000000,
    "patrimonioNetto": -18075000000
   },
   {
    "anno": 2021,
    "roe": null,
    "margine": -0.0675,
    "roa": -0.0303,
    "utileNetto": -4202000000,
    "ricavi": 62286000000,
    "patrimonioNetto": -14846000000
   },
   {
    "anno": 2022,
    "roe": null,
    "margine": -0.0741,
    "roa": -0.036,
    "utileNetto": -4935000000,
    "ricavi": 66608000000,
    "patrimonioNetto": -15848000000
   },
   {
    "anno": 2023,
    "roe": null,
    "margine": -0.0286,
    "roa": -0.0162,
    "utileNetto": -2222000000,
    "ricavi": 77794000000,
    "patrimonioNetto": -17228000000
   },
   {
    "anno": 2024,
    "roe": null,
    "margine": -0.1777,
    "roa": -0.0756,
    "utileNetto": -11817000000,
    "ricavi": 66517000000,
    "patrimonioNetto": -3908000000
   },
   {
    "anno": 2025,
    "roe": null,
    "margine": 0.025,
    "roa": 0.0133,
    "utileNetto": 2235000000,
    "ricavi": 89463000000,
    "patrimonioNetto": 5454000000
   }
  ]
 },
 "HON": {
  "nome": "HONEYWELL INTERNATIONAL INC",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.0707,
    "roa": null,
    "utileNetto": 2444000000,
    "ricavi": 34589000000,
    "patrimonioNetto": 9293000000
   },
   {
    "anno": 2008,
    "roe": 0.1121,
    "margine": 0.022,
    "roa": 0.0227,
    "utileNetto": 806000000,
    "ricavi": 36556000000,
    "patrimonioNetto": 7187000000
   },
   {
    "anno": 2009,
    "roe": 0.1747,
    "margine": 0.0517,
    "roa": 0.043,
    "utileNetto": 1548000000,
    "ricavi": 29951000000,
    "patrimonioNetto": 8861000000
   },
   {
    "anno": 2010,
    "roe": 0.1874,
    "margine": 0.0625,
    "roa": 0.0534,
    "utileNetto": 2022000000,
    "ricavi": 32350000000,
    "patrimonioNetto": 10787000000
   },
   {
    "anno": 2011,
    "roe": 0.1896,
    "margine": 0.0566,
    "roa": 0.0519,
    "utileNetto": 2067000000,
    "ricavi": 36529000000,
    "patrimonioNetto": 10902000000
   },
   {
    "anno": 2012,
    "roe": 0.224,
    "margine": 0.0777,
    "roa": 0.0699,
    "utileNetto": 2926000000,
    "ricavi": 37665000000,
    "patrimonioNetto": 13065000000
   },
   {
    "anno": 2013,
    "roe": 0.2232,
    "margine": 0.1005,
    "roa": 0.0864,
    "utileNetto": 3924000000,
    "ricavi": 39055000000,
    "patrimonioNetto": 17579000000
   },
   {
    "anno": 2014,
    "roe": 0.2384,
    "margine": 0.1052,
    "roa": 0.0933,
    "utileNetto": 4239000000,
    "ricavi": 40306000000,
    "patrimonioNetto": 17784000000
   },
   {
    "anno": 2015,
    "roe": 0.2589,
    "margine": 0.1236,
    "roa": 0.0967,
    "utileNetto": 4768000000,
    "ricavi": 38581000000,
    "patrimonioNetto": 18418000000
   },
   {
    "anno": 2016,
    "roe": 0.2548,
    "margine": 0.1224,
    "roa": 0.0882,
    "utileNetto": 4812000000,
    "ricavi": 39302000000,
    "patrimonioNetto": 18883000000
   },
   {
    "anno": 2017,
    "roe": 0.0927,
    "margine": 0.0381,
    "roa": 0.026,
    "utileNetto": 1545000000,
    "ricavi": 40534000000,
    "patrimonioNetto": 16665000000
   },
   {
    "anno": 2018,
    "roe": 0.3685,
    "margine": 0.1618,
    "roa": 0.1171,
    "utileNetto": 6765000000,
    "ricavi": 41802000000,
    "patrimonioNetto": 18358000000
   },
   {
    "anno": 2019,
    "roe": 0.3284,
    "margine": 0.1673,
    "roa": 0.1047,
    "utileNetto": 6143000000,
    "ricavi": 36709000000,
    "patrimonioNetto": 18706000000
   },
   {
    "anno": 2020,
    "roe": 0.2686,
    "margine": 0.1464,
    "roa": 0.074,
    "utileNetto": 4779000000,
    "ricavi": 32637000000,
    "patrimonioNetto": 17790000000
   },
   {
    "anno": 2021,
    "roe": 0.288,
    "margine": 0.1611,
    "roa": 0.086,
    "utileNetto": 5542000000,
    "ricavi": 34392000000,
    "patrimonioNetto": 19242000000
   },
   {
    "anno": 2022,
    "roe": 0.2867,
    "margine": 0.14,
    "roa": 0.0797,
    "utileNetto": 4966000000,
    "ricavi": 35466000000,
    "patrimonioNetto": 17319000000
   },
   {
    "anno": 2023,
    "roe": 0.3443,
    "margine": 0.1714,
    "roa": 0.092,
    "utileNetto": 5658000000,
    "ricavi": 33009000000,
    "patrimonioNetto": 16434000000
   },
   {
    "anno": 2024,
    "roe": 0.3064,
    "margine": 0.1643,
    "roa": 0.0759,
    "utileNetto": 5705000000,
    "ricavi": 34717000000,
    "patrimonioNetto": 18619000000
   },
   {
    "anno": 2025,
    "roe": 0.3401,
    "margine": 0.1263,
    "roa": 0.0642,
    "utileNetto": 4729000000,
    "ricavi": 37442000000,
    "patrimonioNetto": 13904000000
   }
  ]
 },
 "GE": {
  "nome": "GENERAL ELECTRIC CO",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.1307,
    "roa": null,
    "utileNetto": 22208000000,
    "ricavi": 169964000000,
    "patrimonioNetto": 115559000000
   },
   {
    "anno": 2008,
    "roe": 0.1663,
    "margine": 0.0968,
    "roa": 0.0218,
    "utileNetto": 17410000000,
    "ricavi": 179769000000,
    "patrimonioNetto": 104665000000
   },
   {
    "anno": 2009,
    "roe": 0.094,
    "margine": 0.0714,
    "roa": 0.0141,
    "utileNetto": 11025000000,
    "ricavi": 154396000000,
    "patrimonioNetto": 117291000000
   },
   {
    "anno": 2010,
    "roe": 0.0979,
    "margine": 0.0782,
    "roa": 0.0156,
    "utileNetto": 11644000000,
    "ricavi": 148875000000,
    "patrimonioNetto": 118936000000
   },
   {
    "anno": 2011,
    "roe": 0.1215,
    "margine": 0.1286,
    "roa": 0.0197,
    "utileNetto": 14151000000,
    "ricavi": 110062000000,
    "patrimonioNetto": 116438000000
   },
   {
    "anno": 2012,
    "roe": 0.1109,
    "margine": 0.1212,
    "roa": 0.0199,
    "utileNetto": 13641000000,
    "ricavi": 112588000000,
    "patrimonioNetto": 123026000000
   },
   {
    "anno": 2013,
    "roe": 0.1,
    "margine": 0.1153,
    "roa": 0.0197,
    "utileNetto": 13057000000,
    "ricavi": 113245000000,
    "patrimonioNetto": 130566000000
   },
   {
    "anno": 2014,
    "roe": 0.1189,
    "margine": 0.13,
    "roa": 0.0233,
    "utileNetto": 15233000000,
    "ricavi": 117184000000,
    "patrimonioNetto": 128159000000
   },
   {
    "anno": 2015,
    "roe": -0.0623,
    "margine": -0.0522,
    "roa": -0.0124,
    "utileNetto": -6126000000,
    "ricavi": 117386000000,
    "patrimonioNetto": 98274000000
   },
   {
    "anno": 2016,
    "roe": 0.1069,
    "margine": 0.0628,
    "roa": 0.0209,
    "utileNetto": 7500000000,
    "ricavi": 119469000000,
    "patrimonioNetto": 70162000000
   },
   {
    "anno": 2017,
    "roe": -0.1514,
    "margine": -0.0855,
    "roa": -0.023,
    "utileNetto": -8484000000,
    "ricavi": 99279000000,
    "patrimonioNetto": 56031000000
   },
   {
    "anno": 2018,
    "roe": -0.7216,
    "margine": -0.2304,
    "roa": -0.0719,
    "utileNetto": -22355000000,
    "ricavi": 97012000000,
    "patrimonioNetto": 30981000000
   },
   {
    "anno": 2019,
    "roe": -0.1758,
    "margine": -0.0552,
    "roa": -0.0188,
    "utileNetto": -4979000000,
    "ricavi": 90221000000,
    "patrimonioNetto": 28316000000
   },
   {
    "anno": 2020,
    "roe": 0.1539,
    "margine": 0.0752,
    "roa": 0.0223,
    "utileNetto": 5704000000,
    "ricavi": 75833000000,
    "patrimonioNetto": 37073000000
   },
   {
    "anno": 2021,
    "roe": -0.19,
    "margine": -0.1122,
    "roa": -0.0319,
    "utileNetto": -6337000000,
    "ricavi": 56469000000,
    "patrimonioNetto": 33346000000
   },
   {
    "anno": 2022,
    "roe": 0.0096,
    "margine": 0.0115,
    "roa": 0.0018,
    "utileNetto": 336000000,
    "ricavi": 29139000000,
    "patrimonioNetto": 34930000000
   },
   {
    "anno": 2023,
    "roe": 0.3315,
    "margine": 0.2682,
    "roa": 0.0547,
    "utileNetto": 9482000000,
    "ricavi": 35348000000,
    "patrimonioNetto": 28605000000
   },
   {
    "anno": 2024,
    "roe": 0.339,
    "margine": 0.1694,
    "roa": 0.0532,
    "utileNetto": 6556000000,
    "ricavi": 38702000000,
    "patrimonioNetto": 19342000000
   },
   {
    "anno": 2025,
    "roe": 0.466,
    "margine": 0.1898,
    "roa": 0.0669,
    "utileNetto": 8704000000,
    "ricavi": 45855000000,
    "patrimonioNetto": 18677000000
   }
  ]
 },
 "LMT": {
  "nome": "LOCKHEED MARTIN CORP",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.0725,
    "roa": null,
    "utileNetto": 3033000000,
    "ricavi": 41862000000,
    "patrimonioNetto": 9805000000
   },
   {
    "anno": 2008,
    "roe": 1.1229,
    "margine": 0.0778,
    "roa": 0.0962,
    "utileNetto": 3217000000,
    "ricavi": 41372000000,
    "patrimonioNetto": 2865000000
   },
   {
    "anno": 2009,
    "roe": 0.7496,
    "margine": 0.0678,
    "roa": 0.0847,
    "utileNetto": 2973000000,
    "ricavi": 43867000000,
    "patrimonioNetto": 3966000000
   },
   {
    "anno": 2010,
    "roe": 0.823,
    "margine": 0.063,
    "roa": 0.082,
    "utileNetto": 2878000000,
    "ricavi": 45671000000,
    "patrimonioNetto": 3497000000
   },
   {
    "anno": 2011,
    "roe": null,
    "margine": 0.0571,
    "roa": 0.07,
    "utileNetto": 2655000000,
    "ricavi": 46499000000,
    "patrimonioNetto": 1001000000
   },
   {
    "anno": 2012,
    "roe": null,
    "margine": 0.0582,
    "roa": 0.071,
    "utileNetto": 2745000000,
    "ricavi": 47182000000,
    "patrimonioNetto": 39000000
   },
   {
    "anno": 2013,
    "roe": 0.6061,
    "margine": 0.0657,
    "roa": 0.0824,
    "utileNetto": 2981000000,
    "ricavi": 45358000000,
    "patrimonioNetto": 4918000000
   },
   {
    "anno": 2014,
    "roe": 1.0629,
    "margine": 0.0905,
    "roa": 0.0976,
    "utileNetto": 3614000000,
    "ricavi": 39946000000,
    "patrimonioNetto": 3400000000
   },
   {
    "anno": 2015,
    "roe": 1.164,
    "margine": 0.0889,
    "roa": 0.0731,
    "utileNetto": 3605000000,
    "ricavi": 40536000000,
    "patrimonioNetto": 3097000000
   },
   {
    "anno": 2016,
    "roe": null,
    "margine": 0.1094,
    "roa": 0.1082,
    "utileNetto": 5173000000,
    "ricavi": 47290000000,
    "patrimonioNetto": 1477000000
   },
   {
    "anno": 2017,
    "roe": null,
    "margine": 0.0393,
    "roa": 0.0421,
    "utileNetto": 1963000000,
    "ricavi": 49960000000,
    "patrimonioNetto": -776000000
   },
   {
    "anno": 2018,
    "roe": null,
    "margine": 0.0939,
    "roa": 0.1124,
    "utileNetto": 5046000000,
    "ricavi": 53762000000,
    "patrimonioNetto": 1449000000
   },
   {
    "anno": 2019,
    "roe": 1.9647,
    "margine": 0.1042,
    "roa": 0.1311,
    "utileNetto": 6230000000,
    "ricavi": 59812000000,
    "patrimonioNetto": 3171000000
   },
   {
    "anno": 2020,
    "roe": 1.1317,
    "margine": 0.1045,
    "roa": 0.1347,
    "utileNetto": 6833000000,
    "ricavi": 65398000000,
    "patrimonioNetto": 6038000000
   },
   {
    "anno": 2021,
    "roe": 0.5762,
    "margine": 0.0942,
    "roa": 0.1241,
    "utileNetto": 6315000000,
    "ricavi": 67044000000,
    "patrimonioNetto": 10959000000
   },
   {
    "anno": 2022,
    "roe": 0.6186,
    "margine": 0.0869,
    "roa": 0.1084,
    "utileNetto": 5732000000,
    "ricavi": 65984000000,
    "patrimonioNetto": 9266000000
   },
   {
    "anno": 2023,
    "roe": 1.0124,
    "margine": 0.1024,
    "roa": 0.1319,
    "utileNetto": 6920000000,
    "ricavi": 67571000000,
    "patrimonioNetto": 6835000000
   },
   {
    "anno": 2024,
    "roe": 0.8426,
    "margine": 0.0751,
    "roa": 0.0959,
    "utileNetto": 5336000000,
    "ricavi": 71043000000,
    "patrimonioNetto": 6333000000
   },
   {
    "anno": 2025,
    "roe": 0.7465,
    "margine": 0.0669,
    "roa": 0.0838,
    "utileNetto": 5017000000,
    "ricavi": 75048000000,
    "patrimonioNetto": 6721000000
   }
  ]
 },
 "RTX": {
  "nome": "RTX Corp",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.0758,
    "roa": null,
    "utileNetto": 4224000000,
    "ricavi": 55716000000,
    "patrimonioNetto": 22064000000
   },
   {
    "anno": 2008,
    "roe": 0.2811,
    "margine": 0.0793,
    "roa": 0.0825,
    "utileNetto": 4689000000,
    "ricavi": 59119000000,
    "patrimonioNetto": 16681000000
   },
   {
    "anno": 2009,
    "roe": 0.1823,
    "margine": 0.073,
    "roa": 0.0687,
    "utileNetto": 3829000000,
    "ricavi": 52425000000,
    "patrimonioNetto": 20999000000
   },
   {
    "anno": 2010,
    "roe": 0.1958,
    "margine": 0.0837,
    "roa": 0.0748,
    "utileNetto": 4373000000,
    "ricavi": 52275000000,
    "patrimonioNetto": 22332000000
   },
   {
    "anno": 2011,
    "roe": 0.2182,
    "margine": 0.0893,
    "roa": 0.081,
    "utileNetto": 4979000000,
    "ricavi": 55754000000,
    "patrimonioNetto": 22820000000
   },
   {
    "anno": 2012,
    "roe": 0.1895,
    "margine": 0.0889,
    "roa": 0.0574,
    "utileNetto": 5130000000,
    "ricavi": 57708000000,
    "patrimonioNetto": 27069000000
   },
   {
    "anno": 2013,
    "roe": 0.1722,
    "margine": 0.1011,
    "roa": 0.0631,
    "utileNetto": 5721000000,
    "ricavi": 56600000000,
    "patrimonioNetto": 33219000000
   },
   {
    "anno": 2014,
    "roe": 0.191,
    "margine": 0.1074,
    "roa": 0.0682,
    "utileNetto": 6220000000,
    "ricavi": 57900000000,
    "patrimonioNetto": 32564000000
   },
   {
    "anno": 2015,
    "roe": 0.2638,
    "margine": 0.1356,
    "roa": 0.087,
    "utileNetto": 7608000000,
    "ricavi": 56098000000,
    "patrimonioNetto": 28844000000
   },
   {
    "anno": 2016,
    "roe": 0.1733,
    "margine": 0.0883,
    "roa": 0.0564,
    "utileNetto": 5055000000,
    "ricavi": 57244000000,
    "patrimonioNetto": 29169000000
   },
   {
    "anno": 2017,
    "roe": 0.1449,
    "margine": 0.0761,
    "roa": 0.047,
    "utileNetto": 4552000000,
    "ricavi": 59837000000,
    "patrimonioNetto": 31421000000
   },
   {
    "anno": 2018,
    "roe": 0.1297,
    "margine": 0.1518,
    "roa": 0.0393,
    "utileNetto": 5269000000,
    "ricavi": 34701000000,
    "patrimonioNetto": 40610000000
   },
   {
    "anno": 2019,
    "roe": 0.1252,
    "margine": 0.1221,
    "roa": 0.0397,
    "utileNetto": 5537000000,
    "ricavi": 45349000000,
    "patrimonioNetto": 44231000000
   },
   {
    "anno": 2020,
    "roe": -0.0476,
    "margine": -0.0622,
    "roa": -0.0217,
    "utileNetto": -3519000000,
    "ricavi": 56587000000,
    "patrimonioNetto": 73852000000
   },
   {
    "anno": 2021,
    "roe": 0.0518,
    "margine": 0.06,
    "roa": 0.0239,
    "utileNetto": 3864000000,
    "ricavi": 64388000000,
    "patrimonioNetto": 74664000000
   },
   {
    "anno": 2022,
    "roe": 0.0701,
    "margine": 0.0775,
    "roa": 0.0327,
    "utileNetto": 5197000000,
    "ricavi": 67074000000,
    "patrimonioNetto": 74178000000
   },
   {
    "anno": 2023,
    "roe": 0.052,
    "margine": 0.0464,
    "roa": 0.0197,
    "utileNetto": 3195000000,
    "ricavi": 68920000000,
    "patrimonioNetto": 61410000000
   },
   {
    "anno": 2024,
    "roe": 0.0794,
    "margine": 0.0591,
    "roa": 0.0293,
    "utileNetto": 4774000000,
    "ricavi": 80738000000,
    "patrimonioNetto": 60156000000
   },
   {
    "anno": 2025,
    "roe": 0.1032,
    "margine": 0.076,
    "roa": 0.0394,
    "utileNetto": 6732000000,
    "ricavi": 88603000000,
    "patrimonioNetto": 65245000000
   }
  ]
 },
 "UPS": {
  "nome": "UNITED PARCEL SERVICE INC",
  "anni": [
   {
    "anno": 2008,
    "roe": 0.4429,
    "margine": 0.0583,
    "roa": 0.0942,
    "utileNetto": 3003000000,
    "ricavi": 51486000000,
    "patrimonioNetto": 6780000000
   },
   {
    "anno": 2009,
    "roe": 0.2579,
    "margine": 0.0434,
    "roa": 0.0617,
    "utileNetto": 1968000000,
    "ricavi": 45297000000,
    "patrimonioNetto": 7630000000
   },
   {
    "anno": 2010,
    "roe": 0.4183,
    "margine": 0.0674,
    "roa": 0.0994,
    "utileNetto": 3338000000,
    "ricavi": 49545000000,
    "patrimonioNetto": 7979000000
   },
   {
    "anno": 2011,
    "roe": 0.5407,
    "margine": 0.0716,
    "roa": 0.1096,
    "utileNetto": 3804000000,
    "ricavi": 53105000000,
    "patrimonioNetto": 7035000000
   },
   {
    "anno": 2012,
    "roe": 0.1734,
    "margine": 0.0149,
    "roa": 0.0208,
    "utileNetto": 807000000,
    "ricavi": 54127000000,
    "patrimonioNetto": 4653000000
   },
   {
    "anno": 2013,
    "roe": 0.6753,
    "margine": 0.0789,
    "roa": 0.123,
    "utileNetto": 4372000000,
    "ricavi": 55438000000,
    "patrimonioNetto": 6474000000
   },
   {
    "anno": 2014,
    "roe": 1.4162,
    "margine": 0.0521,
    "roa": 0.0856,
    "utileNetto": 3032000000,
    "ricavi": 58232000000,
    "patrimonioNetto": 2141000000
   },
   {
    "anno": 2015,
    "roe": 1.9611,
    "margine": 0.083,
    "roa": 0.1264,
    "utileNetto": 4844000000,
    "ricavi": 58363000000,
    "patrimonioNetto": 2470000000
   },
   {
    "anno": 2016,
    "roe": null,
    "margine": 0.0555,
    "roa": 0.0844,
    "utileNetto": 3422000000,
    "ricavi": 61610000000,
    "patrimonioNetto": 405000000
   },
   {
    "anno": 2017,
    "roe": null,
    "margine": 0.0737,
    "roa": 0.1076,
    "utileNetto": 4905000000,
    "ricavi": 66585000000,
    "patrimonioNetto": 994000000
   },
   {
    "anno": 2018,
    "roe": 1.5859,
    "margine": 0.0667,
    "roa": 0.0958,
    "utileNetto": 4791000000,
    "ricavi": 71861000000,
    "patrimonioNetto": 3021000000
   },
   {
    "anno": 2019,
    "roe": 1.359,
    "margine": 0.0599,
    "roa": 0.0767,
    "utileNetto": 4440000000,
    "ricavi": 74094000000,
    "patrimonioNetto": 3267000000
   },
   {
    "anno": 2020,
    "roe": null,
    "margine": 0.0159,
    "roa": 0.0215,
    "utileNetto": 1343000000,
    "ricavi": 84628000000,
    "patrimonioNetto": 657000000
   },
   {
    "anno": 2021,
    "roe": 0.9044,
    "margine": 0.1325,
    "roa": 0.1857,
    "utileNetto": 12890000000,
    "ricavi": 97287000000,
    "patrimonioNetto": 14253000000
   },
   {
    "anno": 2022,
    "roe": 0.5836,
    "margine": 0.1151,
    "roa": 0.1624,
    "utileNetto": 11548000000,
    "ricavi": 100338000000,
    "patrimonioNetto": 19786000000
   },
   {
    "anno": 2023,
    "roe": 0.3876,
    "margine": 0.0737,
    "roa": 0.0947,
    "utileNetto": 6708000000,
    "ricavi": 90958000000,
    "patrimonioNetto": 17306000000
   },
   {
    "anno": 2024,
    "roe": 0.3459,
    "margine": 0.0635,
    "roa": 0.0825,
    "utileNetto": 5782000000,
    "ricavi": 91070000000,
    "patrimonioNetto": 16718000000
   },
   {
    "anno": 2025,
    "roe": 0.3434,
    "margine": 0.0628,
    "roa": 0.0762,
    "utileNetto": 5572000000,
    "ricavi": 88661000000,
    "patrimonioNetto": 16227000000
   }
  ]
 },
 "UNP": {
  "nome": "UNION PACIFIC CORP",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.1139,
    "roa": null,
    "utileNetto": 1855000000,
    "ricavi": 16283000000,
    "patrimonioNetto": 15456000000
   },
   {
    "anno": 2008,
    "roe": 0.1525,
    "margine": 0.1299,
    "roa": 0.0588,
    "utileNetto": 2335000000,
    "ricavi": 17970000000,
    "patrimonioNetto": 15315000000
   },
   {
    "anno": 2009,
    "roe": 0.1125,
    "margine": 0.1336,
    "roa": 0.0448,
    "utileNetto": 1890000000,
    "ricavi": 14143000000,
    "patrimonioNetto": 16801000000
   },
   {
    "anno": 2010,
    "roe": 0.1565,
    "margine": 0.1639,
    "roa": 0.0645,
    "utileNetto": 2780000000,
    "ricavi": 16965000000,
    "patrimonioNetto": 17763000000
   },
   {
    "anno": 2011,
    "roe": 0.1772,
    "margine": 0.1683,
    "roa": 0.073,
    "utileNetto": 3292000000,
    "ricavi": 19557000000,
    "patrimonioNetto": 18578000000
   },
   {
    "anno": 2012,
    "roe": 0.1984,
    "margine": 0.1884,
    "roa": 0.0836,
    "utileNetto": 3943000000,
    "ricavi": 20926000000,
    "patrimonioNetto": 19877000000
   },
   {
    "anno": 2013,
    "roe": 0.2067,
    "margine": 0.1998,
    "roa": 0.0882,
    "utileNetto": 4388000000,
    "ricavi": 21963000000,
    "patrimonioNetto": 21225000000
   },
   {
    "anno": 2014,
    "roe": 0.2445,
    "margine": 0.2159,
    "roa": 0.0989,
    "utileNetto": 5180000000,
    "ricavi": 23988000000,
    "patrimonioNetto": 21189000000
   },
   {
    "anno": 2015,
    "roe": 0.2305,
    "margine": 0.2188,
    "roa": 0.0874,
    "utileNetto": 4772000000,
    "ricavi": 21813000000,
    "patrimonioNetto": 20702000000
   },
   {
    "anno": 2016,
    "roe": 0.2124,
    "margine": 0.2123,
    "roa": 0.076,
    "utileNetto": 4233000000,
    "ricavi": 19941000000,
    "patrimonioNetto": 19932000000
   },
   {
    "anno": 2017,
    "roe": 0.431,
    "margine": 0.5043,
    "roa": 0.1853,
    "utileNetto": 10712000000,
    "ricavi": 21240000000,
    "patrimonioNetto": 24856000000
   },
   {
    "anno": 2018,
    "roe": 0.2921,
    "margine": 0.2613,
    "roa": 0.1009,
    "utileNetto": 5966000000,
    "ricavi": 22832000000,
    "patrimonioNetto": 20423000000
   },
   {
    "anno": 2019,
    "roe": 0.3265,
    "margine": 0.2727,
    "roa": 0.096,
    "utileNetto": 5919000000,
    "ricavi": 21708000000,
    "patrimonioNetto": 18128000000
   },
   {
    "anno": 2020,
    "roe": 0.3154,
    "margine": 0.2738,
    "roa": 0.0857,
    "utileNetto": 5349000000,
    "ricavi": 19533000000,
    "patrimonioNetto": 16958000000
   },
   {
    "anno": 2021,
    "roe": 0.4606,
    "margine": 0.2992,
    "roa": 0.1027,
    "utileNetto": 6523000000,
    "ricavi": 21804000000,
    "patrimonioNetto": 14161000000
   },
   {
    "anno": 2022,
    "roe": 0.5754,
    "margine": 0.2813,
    "roa": 0.1069,
    "utileNetto": 6998000000,
    "ricavi": 24875000000,
    "patrimonioNetto": 12163000000
   },
   {
    "anno": 2023,
    "roe": 0.4314,
    "margine": 0.2645,
    "roa": 0.095,
    "utileNetto": 6379000000,
    "ricavi": 24119000000,
    "patrimonioNetto": 14788000000
   },
   {
    "anno": 2024,
    "roe": 0.3995,
    "margine": 0.2782,
    "roa": 0.0996,
    "utileNetto": 6747000000,
    "ricavi": 24250000000,
    "patrimonioNetto": 16890000000
   },
   {
    "anno": 2025,
    "roe": 0.3865,
    "margine": 0.2912,
    "roa": 0.1024,
    "utileNetto": 7138000000,
    "ricavi": 24510000000,
    "patrimonioNetto": 18467000000
   }
  ]
 },
 "DE": {
  "nome": "DEERE & CO",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.0756,
    "roa": null,
    "utileNetto": 1821700000,
    "ricavi": 24082200000,
    "patrimonioNetto": 7155800000
   },
   {
    "anno": 2008,
    "roe": 0.314,
    "margine": 0.0722,
    "roa": 0.053,
    "utileNetto": 2052800000,
    "ricavi": 28437600000,
    "patrimonioNetto": 6537200000
   },
   {
    "anno": 2009,
    "roe": 0.1811,
    "margine": 0.0378,
    "roa": 0.0212,
    "utileNetto": 873500000,
    "ricavi": 23112400000,
    "patrimonioNetto": 4822800000
   },
   {
    "anno": 2010,
    "roe": 0.2959,
    "margine": 0.0717,
    "roa": 0.0431,
    "utileNetto": 1865000000,
    "ricavi": 26004600000,
    "patrimonioNetto": 6303400000
   },
   {
    "anno": 2011,
    "roe": 0.4108,
    "margine": 0.0875,
    "roa": 0.0581,
    "utileNetto": 2799900000,
    "ricavi": 32012500000,
    "patrimonioNetto": 6814900000
   },
   {
    "anno": 2012,
    "roe": 0.4466,
    "margine": 0.0848,
    "roa": 0.0545,
    "utileNetto": 3064700000,
    "ricavi": 36157100000,
    "patrimonioNetto": 6862000000
   },
   {
    "anno": 2013,
    "roe": 0.3445,
    "margine": 0.0936,
    "roa": 0.0594,
    "utileNetto": 3537300000,
    "ricavi": 37795400000,
    "patrimonioNetto": 10267700000
   },
   {
    "anno": 2014,
    "roe": 0.3488,
    "margine": 0.0877,
    "roa": 0.0515,
    "utileNetto": 3161700000,
    "ricavi": 36066900000,
    "patrimonioNetto": 9065500000
   },
   {
    "anno": 2015,
    "roe": 0.2871,
    "margine": 0.0672,
    "roa": 0.0335,
    "utileNetto": 1940000000,
    "ricavi": 28862800000,
    "patrimonioNetto": 6757600000
   },
   {
    "anno": 2016,
    "roe": 0.2333,
    "margine": 0.0572,
    "roa": 0.0263,
    "utileNetto": 1523900000,
    "ricavi": 26644000000,
    "patrimonioNetto": 6531000000
   },
   {
    "anno": 2017,
    "roe": 0.2258,
    "margine": 0.0726,
    "roa": 0.0328,
    "utileNetto": 2159000000,
    "ricavi": 29738000000,
    "patrimonioNetto": 9560000000
   },
   {
    "anno": 2018,
    "roe": 0.2097,
    "margine": 0.0634,
    "roa": 0.0338,
    "utileNetto": 2368000000,
    "ricavi": 37358000000,
    "patrimonioNetto": 11291000000
   },
   {
    "anno": 2019,
    "roe": 0.2849,
    "margine": 0.0829,
    "roa": 0.0446,
    "utileNetto": 3253000000,
    "ricavi": 39258000000,
    "patrimonioNetto": 11417000000
   },
   {
    "anno": 2020,
    "roe": 0.2125,
    "margine": 0.0774,
    "roa": 0.0366,
    "utileNetto": 2751000000,
    "ricavi": 35540000000,
    "patrimonioNetto": 12944000000
   },
   {
    "anno": 2021,
    "roe": 0.3235,
    "margine": 0.1354,
    "roa": 0.0709,
    "utileNetto": 5963000000,
    "ricavi": 44024000000,
    "patrimonioNetto": 18434000000
   },
   {
    "anno": 2022,
    "roe": 0.3519,
    "margine": 0.1356,
    "roa": 0.0792,
    "utileNetto": 7131000000,
    "ricavi": 52577000000,
    "patrimonioNetto": 20265000000
   },
   {
    "anno": 2023,
    "roe": 0.4666,
    "margine": 0.166,
    "roa": 0.0977,
    "utileNetto": 10166000000,
    "ricavi": 61251000000,
    "patrimonioNetto": 21789000000
   },
   {
    "anno": 2024,
    "roe": 0.3109,
    "margine": 0.1373,
    "roa": 0.0662,
    "utileNetto": 7100000000,
    "ricavi": 51716000000,
    "patrimonioNetto": 22836000000
   },
   {
    "anno": 2025,
    "roe": 0.1937,
    "margine": 0.11,
    "roa": 0.0474,
    "utileNetto": 5027000000,
    "ricavi": 45684000000,
    "patrimonioNetto": 25950000000
   }
  ]
 },
 "MMM": {
  "nome": "3M CO",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.1674,
    "roa": null,
    "utileNetto": 4096000000,
    "ricavi": 24462000000,
    "patrimonioNetto": 12072000000
   },
   {
    "anno": 2008,
    "roe": 0.3358,
    "margine": 0.1369,
    "roa": 0.1341,
    "utileNetto": 3460000000,
    "ricavi": 25269000000,
    "patrimonioNetto": 10304000000
   },
   {
    "anno": 2009,
    "roe": 0.2439,
    "margine": 0.1403,
    "roa": 0.119,
    "utileNetto": 3244000000,
    "ricavi": 23123000000,
    "patrimonioNetto": 13302000000
   },
   {
    "anno": 2010,
    "roe": 0.255,
    "margine": 0.1532,
    "roa": 0.1355,
    "utileNetto": 4085000000,
    "ricavi": 26662000000,
    "patrimonioNetto": 16017000000
   },
   {
    "anno": 2011,
    "roe": 0.27,
    "margine": 0.1446,
    "roa": 0.1355,
    "utileNetto": 4283000000,
    "ricavi": 29611000000,
    "patrimonioNetto": 15862000000
   },
   {
    "anno": 2012,
    "roe": 0.2463,
    "margine": 0.1486,
    "roa": 0.1312,
    "utileNetto": 4444000000,
    "ricavi": 29904000000,
    "patrimonioNetto": 18040000000
   },
   {
    "anno": 2013,
    "roe": 0.2637,
    "margine": 0.1509,
    "roa": 0.1399,
    "utileNetto": 4659000000,
    "ricavi": 30871000000,
    "patrimonioNetto": 17669000000
   },
   {
    "anno": 2014,
    "roe": 0.3853,
    "margine": 0.1557,
    "roa": 0.158,
    "utileNetto": 4956000000,
    "ricavi": 31821000000,
    "patrimonioNetto": 12863000000
   },
   {
    "anno": 2015,
    "roe": 0.4214,
    "margine": 0.1596,
    "roa": 0.147,
    "utileNetto": 4833000000,
    "ricavi": 30274000000,
    "patrimonioNetto": 11468000000
   },
   {
    "anno": 2016,
    "roe": 0.4883,
    "margine": 0.1677,
    "roa": 0.1535,
    "utileNetto": 5050000000,
    "ricavi": 30109000000,
    "patrimonioNetto": 10343000000
   },
   {
    "anno": 2017,
    "roe": 0.418,
    "margine": 0.1535,
    "roa": 0.1279,
    "utileNetto": 4858000000,
    "ricavi": 31657000000,
    "patrimonioNetto": 11622000000
   },
   {
    "anno": 2018,
    "roe": 0.5432,
    "margine": 0.1633,
    "roa": 0.1465,
    "utileNetto": 5349000000,
    "ricavi": 32765000000,
    "patrimonioNetto": 9848000000
   },
   {
    "anno": 2019,
    "roe": 0.4461,
    "margine": 0.1406,
    "roa": 0.1011,
    "utileNetto": 4517000000,
    "ricavi": 32136000000,
    "patrimonioNetto": 10126000000
   },
   {
    "anno": 2020,
    "roe": 0.4214,
    "margine": 0.1693,
    "roa": 0.1151,
    "utileNetto": 5449000000,
    "ricavi": 32184000000,
    "patrimonioNetto": 12931000000
   },
   {
    "anno": 2021,
    "roe": 0.3917,
    "margine": 0.1675,
    "roa": 0.1258,
    "utileNetto": 5921000000,
    "ricavi": 35355000000,
    "patrimonioNetto": 15117000000
   },
   {
    "anno": 2022,
    "roe": 0.3911,
    "margine": 0.2208,
    "roa": 0.1244,
    "utileNetto": 5777000000,
    "ricavi": 26161000000,
    "patrimonioNetto": 14770000000
   },
   {
    "anno": 2023,
    "roe": -1.4369,
    "margine": -0.2842,
    "roa": -0.1383,
    "utileNetto": -6995000000,
    "ricavi": 24610000000,
    "patrimonioNetto": 4868000000
   },
   {
    "anno": 2024,
    "roe": 1.0862,
    "margine": 0.1698,
    "roa": 0.1047,
    "utileNetto": 4173000000,
    "ricavi": 24575000000,
    "patrimonioNetto": 3842000000
   },
   {
    "anno": 2025,
    "roe": 0.6912,
    "margine": 0.1303,
    "roa": 0.0861,
    "utileNetto": 3250000000,
    "ricavi": 24948000000,
    "patrimonioNetto": 4702000000
   }
  ]
 },
 "EMR": {
  "nome": "EMERSON ELECTRIC CO",
  "anni": [
   {
    "anno": 2008,
    "roe": 0.2593,
    "margine": 0.1016,
    "roa": 0.1146,
    "utileNetto": 2412000000,
    "ricavi": 23751000000,
    "patrimonioNetto": 9301000000
   },
   {
    "anno": 2009,
    "roe": 0.198,
    "margine": 0.0858,
    "roa": 0.0872,
    "utileNetto": 1724000000,
    "ricavi": 20102000000,
    "patrimonioNetto": 8706000000
   },
   {
    "anno": 2010,
    "roe": 0.2174,
    "margine": 0.1029,
    "roa": 0.0947,
    "utileNetto": 2164000000,
    "ricavi": 21039000000,
    "patrimonioNetto": 9952000000
   },
   {
    "anno": 2011,
    "roe": 0.235,
    "margine": 0.1024,
    "roa": 0.1039,
    "utileNetto": 2480000000,
    "ricavi": 24222000000,
    "patrimonioNetto": 10551000000
   },
   {
    "anno": 2012,
    "roe": 0.1912,
    "margine": 0.0806,
    "roa": 0.0826,
    "utileNetto": 1968000000,
    "ricavi": 24412000000,
    "patrimonioNetto": 10295000000
   },
   {
    "anno": 2013,
    "roe": 0.1893,
    "margine": 0.0812,
    "roa": 0.0811,
    "utileNetto": 2004000000,
    "ricavi": 24669000000,
    "patrimonioNetto": 10585000000
   },
   {
    "anno": 2014,
    "roe": 0.2122,
    "margine": 0.1211,
    "roa": 0.0888,
    "utileNetto": 2147000000,
    "ricavi": 17733000000,
    "patrimonioNetto": 10119000000
   },
   {
    "anno": 2015,
    "roe": 0.3354,
    "margine": 0.1668,
    "roa": 0.1227,
    "utileNetto": 2710000000,
    "ricavi": 16249000000,
    "patrimonioNetto": 8081000000
   },
   {
    "anno": 2016,
    "roe": 0.216,
    "margine": 0.1126,
    "roa": 0.0752,
    "utileNetto": 1635000000,
    "ricavi": 14522000000,
    "patrimonioNetto": 7568000000
   },
   {
    "anno": 2017,
    "roe": 0.1741,
    "margine": 0.0994,
    "roa": 0.0775,
    "utileNetto": 1518000000,
    "ricavi": 15264000000,
    "patrimonioNetto": 8718000000
   },
   {
    "anno": 2018,
    "roe": 0.2462,
    "margine": 0.1266,
    "roa": 0.108,
    "utileNetto": 2203000000,
    "ricavi": 17408000000,
    "patrimonioNetto": 8947000000
   },
   {
    "anno": 2019,
    "roe": 0.2801,
    "margine": 0.1255,
    "roa": 0.1125,
    "utileNetto": 2306000000,
    "ricavi": 18372000000,
    "patrimonioNetto": 8233000000
   },
   {
    "anno": 2020,
    "roe": 0.2338,
    "margine": 0.1171,
    "roa": 0.0859,
    "utileNetto": 1965000000,
    "ricavi": 16785000000,
    "patrimonioNetto": 8405000000
   },
   {
    "anno": 2021,
    "roe": 0.2321,
    "margine": 0.1781,
    "roa": 0.0932,
    "utileNetto": 2303000000,
    "ricavi": 12932000000,
    "patrimonioNetto": 9923000000
   },
   {
    "anno": 2022,
    "roe": 0.198,
    "margine": 0.2341,
    "roa": 0.0906,
    "utileNetto": 3231000000,
    "ricavi": 13804000000,
    "patrimonioNetto": 16316000000
   },
   {
    "anno": 2023,
    "roe": 0.497,
    "margine": 0.8717,
    "roa": 0.3092,
    "utileNetto": 13219000000,
    "ricavi": 15165000000,
    "patrimonioNetto": 26598000000
   },
   {
    "anno": 2024,
    "roe": 0.091,
    "margine": 0.1125,
    "roa": 0.0445,
    "utileNetto": 1968000000,
    "ricavi": 17492000000,
    "patrimonioNetto": 21636000000
   },
   {
    "anno": 2025,
    "roe": 0.1131,
    "margine": 0.1273,
    "roa": 0.0546,
    "utileNetto": 2293000000,
    "ricavi": 18016000000,
    "patrimonioNetto": 20282000000
   }
  ]
 },
 "TSLA": {
  "nome": "Tesla, Inc.",
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
 "F": {
  "nome": "FORD MOTOR CO",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": -0.0164,
    "roa": null,
    "utileNetto": -2795000000,
    "ricavi": 170572000000,
    "patrimonioNetto": 7771000000
   },
   {
    "anno": 2008,
    "roe": null,
    "margine": -0.1028,
    "roa": -0.0676,
    "utileNetto": -14766000000,
    "ricavi": 143584000000,
    "patrimonioNetto": -15371000000
   },
   {
    "anno": 2009,
    "roe": null,
    "margine": 0.0234,
    "roa": 0.0141,
    "utileNetto": 2717000000,
    "ricavi": 116283000000,
    "patrimonioNetto": -7820000000
   },
   {
    "anno": 2010,
    "roe": null,
    "margine": 0.0509,
    "roa": 0.0398,
    "utileNetto": 6561000000,
    "ricavi": 128954000000,
    "patrimonioNetto": -673000000
   },
   {
    "anno": 2011,
    "roe": 1.3678,
    "margine": 0.1491,
    "roa": 0.1139,
    "utileNetto": 20213000000,
    "ricavi": 135605000000,
    "patrimonioNetto": 14778000000
   },
   {
    "anno": 2012,
    "roe": 0.3534,
    "margine": 0.042,
    "roa": 0.0296,
    "utileNetto": 5613000000,
    "ricavi": 133559000000,
    "patrimonioNetto": 15882000000
   },
   {
    "anno": 2013,
    "roe": 0.4567,
    "margine": 0.0814,
    "roa": 0.0591,
    "utileNetto": 11953000000,
    "ricavi": 146917000000,
    "patrimonioNetto": 26173000000
   },
   {
    "anno": 2014,
    "roe": 0.0503,
    "margine": 0.0085,
    "roa": 0.0059,
    "utileNetto": 1230000000,
    "ricavi": 144077000000,
    "patrimonioNetto": 24465000000
   },
   {
    "anno": 2015,
    "roe": 0.2522,
    "margine": 0.0493,
    "roa": 0.0328,
    "utileNetto": 7371000000,
    "ricavi": 149558000000,
    "patrimonioNetto": 29223000000
   },
   {
    "anno": 2016,
    "roe": 0.1546,
    "margine": 0.0303,
    "roa": 0.0193,
    "utileNetto": 4600000000,
    "ricavi": 151800000000,
    "patrimonioNetto": 29746000000
   },
   {
    "anno": 2017,
    "roe": 0.2179,
    "margine": 0.0495,
    "roa": 0.03,
    "utileNetto": 7757000000,
    "ricavi": 156776000000,
    "patrimonioNetto": 35606000000
   },
   {
    "anno": 2018,
    "roe": 0.1027,
    "margine": 0.023,
    "roa": 0.0144,
    "utileNetto": 3695000000,
    "ricavi": 160338000000,
    "patrimonioNetto": 35966000000
   },
   {
    "anno": 2019,
    "roe": 0.0025,
    "margine": 0.0005,
    "roa": 0.0003,
    "utileNetto": 84000000,
    "ricavi": 155900000000,
    "patrimonioNetto": 33230000000
   },
   {
    "anno": 2020,
    "roe": -0.0416,
    "margine": -0.01,
    "roa": -0.0048,
    "utileNetto": -1276000000,
    "ricavi": 127144000000,
    "patrimonioNetto": 30690000000
   },
   {
    "anno": 2021,
    "roe": 0.3697,
    "margine": 0.1316,
    "roa": 0.0698,
    "utileNetto": 17937000000,
    "ricavi": 136341000000,
    "patrimonioNetto": 48519000000
   },
   {
    "anno": 2022,
    "roe": -0.0459,
    "margine": -0.0125,
    "roa": -0.0077,
    "utileNetto": -1981000000,
    "ricavi": 158057000000,
    "patrimonioNetto": 43167000000
   },
   {
    "anno": 2023,
    "roe": 0.1011,
    "margine": 0.0246,
    "roa": 0.0158,
    "utileNetto": 4329000000,
    "ricavi": 176191000000,
    "patrimonioNetto": 42798000000
   },
   {
    "anno": 2024,
    "roe": 0.1315,
    "margine": 0.0319,
    "roa": 0.0207,
    "utileNetto": 5894000000,
    "ricavi": 184992000000,
    "patrimonioNetto": 44835000000
   },
   {
    "anno": 2025,
    "roe": -0.227,
    "margine": -0.0436,
    "roa": -0.0282,
    "utileNetto": -8162000000,
    "ricavi": 187267000000,
    "patrimonioNetto": 35952000000
   }
  ]
 },
 "GM": {
  "nome": "General Motors Co",
  "anni": [
   {
    "anno": 2010,
    "roe": 0.1661,
    "margine": 0.0455,
    "roa": 0.0444,
    "utileNetto": 6172000000,
    "ricavi": 135592000000,
    "patrimonioNetto": 37159000000
   },
   {
    "anno": 2011,
    "roe": 0.2357,
    "margine": 0.0612,
    "roa": 0.0636,
    "utileNetto": 9190000000,
    "ricavi": 150276000000,
    "patrimonioNetto": 38991000000
   },
   {
    "anno": 2012,
    "roe": 0.1672,
    "margine": 0.0406,
    "roa": 0.0414,
    "utileNetto": 6188000000,
    "ricavi": 152256000000,
    "patrimonioNetto": 37000000000
   },
   {
    "anno": 2013,
    "roe": 0.1238,
    "margine": 0.0344,
    "roa": 0.0322,
    "utileNetto": 5346000000,
    "ricavi": 155427000000,
    "patrimonioNetto": 43174000000
   },
   {
    "anno": 2014,
    "roe": 0.1096,
    "margine": 0.0253,
    "roa": 0.0223,
    "utileNetto": 3949000000,
    "ricavi": 155929000000,
    "patrimonioNetto": 36024000000
   },
   {
    "anno": 2015,
    "roe": 0.2402,
    "margine": 0.0714,
    "roa": 0.0498,
    "utileNetto": 9687000000,
    "ricavi": 135725000000,
    "patrimonioNetto": 40323000000
   },
   {
    "anno": 2016,
    "roe": 0.2139,
    "margine": 0.0632,
    "roa": 0.0425,
    "utileNetto": 9427000000,
    "ricavi": 149184000000,
    "patrimonioNetto": 44075000000
   },
   {
    "anno": 2017,
    "roe": -0.1067,
    "margine": -0.0265,
    "roa": -0.0182,
    "utileNetto": -3864000000,
    "ricavi": 145588000000,
    "patrimonioNetto": 36200000000
   },
   {
    "anno": 2018,
    "roe": 0.1873,
    "margine": 0.0545,
    "roa": 0.0353,
    "utileNetto": 8014000000,
    "ricavi": 147049000000,
    "patrimonioNetto": 42777000000
   },
   {
    "anno": 2019,
    "roe": 0.1465,
    "margine": 0.0491,
    "roa": 0.0295,
    "utileNetto": 6732000000,
    "ricavi": 137237000000,
    "patrimonioNetto": 45957000000
   },
   {
    "anno": 2020,
    "roe": 0.1294,
    "margine": 0.0525,
    "roa": 0.0273,
    "utileNetto": 6427000000,
    "ricavi": 122485000000,
    "patrimonioNetto": 49677000000
   },
   {
    "anno": 2021,
    "roe": 0.1522,
    "margine": 0.0789,
    "roa": 0.0409,
    "utileNetto": 10019000000,
    "ricavi": 127004000000,
    "patrimonioNetto": 65815000000
   },
   {
    "anno": 2022,
    "roe": 0.1381,
    "margine": 0.0634,
    "roa": 0.0376,
    "utileNetto": 9934000000,
    "ricavi": 156735000000,
    "patrimonioNetto": 71927000000
   },
   {
    "anno": 2023,
    "roe": 0.1485,
    "margine": 0.0589,
    "roa": 0.0371,
    "utileNetto": 10127000000,
    "ricavi": 171842000000,
    "patrimonioNetto": 68189000000
   },
   {
    "anno": 2024,
    "roe": 0.0953,
    "margine": 0.0321,
    "roa": 0.0215,
    "utileNetto": 6008000000,
    "ricavi": 187442000000,
    "patrimonioNetto": 63072000000
   },
   {
    "anno": 2025,
    "roe": 0.0441,
    "margine": 0.0146,
    "roa": 0.0096,
    "utileNetto": 2697000000,
    "ricavi": 185019000000,
    "patrimonioNetto": 61119000000
   }
  ]
 },
 "T": {
  "nome": "AT&T INC.",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.1005,
    "roa": null,
    "utileNetto": 11951000000,
    "ricavi": 118928000000,
    "patrimonioNetto": 115256000000
   },
   {
    "anno": 2008,
    "roe": -0.0272,
    "margine": -0.0213,
    "roa": -0.0099,
    "utileNetto": -2625000000,
    "ricavi": 123443000000,
    "patrimonioNetto": 96364000000
   },
   {
    "anno": 2009,
    "roe": 0.119,
    "margine": 0.0991,
    "roa": 0.0452,
    "utileNetto": 12138000000,
    "ricavi": 122513000000,
    "patrimonioNetto": 101989000000
   },
   {
    "anno": 2010,
    "roe": 0.1774,
    "margine": 0.1598,
    "roa": 0.0737,
    "utileNetto": 19864000000,
    "ricavi": 124280000000,
    "patrimonioNetto": 111950000000
   },
   {
    "anno": 2011,
    "roe": 0.0373,
    "margine": 0.0311,
    "roa": 0.0146,
    "utileNetto": 3944000000,
    "ricavi": 126723000000,
    "patrimonioNetto": 105797000000
   },
   {
    "anno": 2012,
    "roe": 0.0759,
    "margine": 0.057,
    "roa": 0.0267,
    "utileNetto": 7264000000,
    "ricavi": 127434000000,
    "patrimonioNetto": 95653000000
   },
   {
    "anno": 2013,
    "roe": 0.1947,
    "margine": 0.1431,
    "roa": 0.0663,
    "utileNetto": 18418000000,
    "ricavi": 128752000000,
    "patrimonioNetto": 94610000000
   },
   {
    "anno": 2014,
    "roe": 0.0714,
    "margine": 0.0486,
    "roa": 0.0217,
    "utileNetto": 6442000000,
    "ricavi": 132447000000,
    "patrimonioNetto": 90270000000
   },
   {
    "anno": 2015,
    "roe": 0.1079,
    "margine": 0.0909,
    "roa": 0.0331,
    "utileNetto": 13345000000,
    "ricavi": 146801000000,
    "patrimonioNetto": 123640000000
   },
   {
    "anno": 2016,
    "roe": 0.1046,
    "margine": 0.0792,
    "roa": 0.0321,
    "utileNetto": 12976000000,
    "ricavi": 163786000000,
    "patrimonioNetto": 124110000000
   },
   {
    "anno": 2017,
    "roe": 0.2074,
    "margine": 0.1834,
    "roa": 0.0663,
    "utileNetto": 29450000000,
    "ricavi": 160546000000,
    "patrimonioNetto": 142007000000
   },
   {
    "anno": 2018,
    "roe": 0.0999,
    "margine": 0.1134,
    "roa": 0.0364,
    "utileNetto": 19370000000,
    "ricavi": 170756000000,
    "patrimonioNetto": 193884000000
   },
   {
    "anno": 2019,
    "roe": 0.0688,
    "margine": 0.0767,
    "roa": 0.0252,
    "utileNetto": 13903000000,
    "ricavi": 181193000000,
    "patrimonioNetto": 201934000000
   },
   {
    "anno": 2020,
    "roe": -0.0289,
    "margine": -0.0362,
    "roa": -0.0098,
    "utileNetto": -5176000000,
    "ricavi": 143050000000,
    "patrimonioNetto": 179240000000
   },
   {
    "anno": 2021,
    "roe": 0.1092,
    "margine": 0.1498,
    "roa": 0.0364,
    "utileNetto": 20081000000,
    "ricavi": 134038000000,
    "patrimonioNetto": 183855000000
   },
   {
    "anno": 2022,
    "roe": -0.0801,
    "margine": -0.0706,
    "roa": -0.0212,
    "utileNetto": -8524000000,
    "ricavi": 120741000000,
    "patrimonioNetto": 106457000000
   },
   {
    "anno": 2023,
    "roe": 0.1226,
    "margine": 0.1176,
    "roa": 0.0354,
    "utileNetto": 14400000000,
    "ricavi": 122428000000,
    "patrimonioNetto": 117442000000
   },
   {
    "anno": 2024,
    "roe": 0.0926,
    "margine": 0.0895,
    "roa": 0.0277,
    "utileNetto": 10948000000,
    "ricavi": 122336000000,
    "patrimonioNetto": 118245000000
   },
   {
    "anno": 2025,
    "roe": 0.1736,
    "margine": 0.1747,
    "roa": 0.0522,
    "utileNetto": 21953000000,
    "ricavi": 125648000000,
    "patrimonioNetto": 126491000000
   }
  ]
 },
 "VZ": {
  "nome": "VERIZON COMMUNICATIONS INC",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.0591,
    "roa": null,
    "utileNetto": 5521000000,
    "ricavi": 93469000000,
    "patrimonioNetto": 82869000000
   },
   {
    "anno": 2008,
    "roe": -0.0278,
    "margine": -0.0225,
    "roa": -0.0108,
    "utileNetto": -2193000000,
    "ricavi": 97354000000,
    "patrimonioNetto": 78791000000
   },
   {
    "anno": 2009,
    "roe": 0.0582,
    "margine": 0.0454,
    "roa": 0.0216,
    "utileNetto": 4894000000,
    "ricavi": 107808000000,
    "patrimonioNetto": 84143000000
   },
   {
    "anno": 2010,
    "roe": 0.0293,
    "margine": 0.0239,
    "roa": 0.0116,
    "utileNetto": 2549000000,
    "ricavi": 106565000000,
    "patrimonioNetto": 86912000000
   },
   {
    "anno": 2011,
    "roe": 0.028,
    "margine": 0.0217,
    "roa": 0.0104,
    "utileNetto": 2404000000,
    "ricavi": 110875000000,
    "patrimonioNetto": 85908000000
   },
   {
    "anno": 2012,
    "roe": 0.0102,
    "margine": 0.0076,
    "roa": 0.0039,
    "utileNetto": 875000000,
    "ricavi": 115846000000,
    "patrimonioNetto": 85533000000
   },
   {
    "anno": 2013,
    "roe": 0.1205,
    "margine": 0.0954,
    "roa": 0.0419,
    "utileNetto": 11497000000,
    "ricavi": 120550000000,
    "patrimonioNetto": 95416000000
   },
   {
    "anno": 2014,
    "roe": 0.7038,
    "margine": 0.0757,
    "roa": 0.0414,
    "utileNetto": 9625000000,
    "ricavi": 127079000000,
    "patrimonioNetto": 13676000000
   },
   {
    "anno": 2015,
    "roe": 1.0021,
    "margine": 0.1358,
    "roa": 0.0732,
    "utileNetto": 17879000000,
    "ricavi": 131620000000,
    "patrimonioNetto": 17842000000
   },
   {
    "anno": 2016,
    "roe": 0.5462,
    "margine": 0.1042,
    "roa": 0.0538,
    "utileNetto": 13127000000,
    "ricavi": 125980000000,
    "patrimonioNetto": 24032000000
   },
   {
    "anno": 2017,
    "roe": 0.6736,
    "margine": 0.2388,
    "roa": 0.1171,
    "utileNetto": 30101000000,
    "ricavi": 126034000000,
    "patrimonioNetto": 44687000000
   },
   {
    "anno": 2018,
    "roe": 0.2838,
    "margine": 0.1187,
    "roa": 0.0586,
    "utileNetto": 15528000000,
    "ricavi": 130863000000,
    "patrimonioNetto": 54710000000
   },
   {
    "anno": 2019,
    "roe": 0.3066,
    "margine": 0.1461,
    "roa": 0.066,
    "utileNetto": 19265000000,
    "ricavi": 131868000000,
    "patrimonioNetto": 62835000000
   },
   {
    "anno": 2020,
    "roe": 0.257,
    "margine": 0.1388,
    "roa": 0.0562,
    "utileNetto": 17801000000,
    "ricavi": 128292000000,
    "patrimonioNetto": 69272000000
   },
   {
    "anno": 2021,
    "roe": 0.2652,
    "margine": 0.1651,
    "roa": 0.0602,
    "utileNetto": 22065000000,
    "ricavi": 133613000000,
    "patrimonioNetto": 83200000000
   },
   {
    "anno": 2022,
    "roe": 0.2299,
    "margine": 0.1553,
    "roa": 0.056,
    "utileNetto": 21256000000,
    "ricavi": 136835000000,
    "patrimonioNetto": 92463000000
   },
   {
    "anno": 2023,
    "roe": 0.1238,
    "margine": 0.0867,
    "roa": 0.0305,
    "utileNetto": 11614000000,
    "ricavi": 133974000000,
    "patrimonioNetto": 93799000000
   },
   {
    "anno": 2024,
    "roe": 0.1741,
    "margine": 0.1299,
    "roa": 0.0455,
    "utileNetto": 17506000000,
    "ricavi": 134788000000,
    "patrimonioNetto": 100575000000
   },
   {
    "anno": 2025,
    "roe": 0.1624,
    "margine": 0.1243,
    "roa": 0.0425,
    "utileNetto": 17174000000,
    "ricavi": 138191000000,
    "patrimonioNetto": 105741000000
   }
  ]
 },
 "TMUS": {
  "nome": "T-Mobile US, Inc.",
  "anni": [
   {
    "anno": 2008,
    "roe": null,
    "margine": 0.0543,
    "roa": null,
    "utileNetto": 149438000,
    "ricavi": 2751516000,
    "patrimonioNetto": 2034323000
   },
   {
    "anno": 2009,
    "roe": 0.0773,
    "margine": 0.0508,
    "roa": 0.0239,
    "utileNetto": 176844000,
    "ricavi": 3480515000,
    "patrimonioNetto": 2288142000
   },
   {
    "anno": 2010,
    "roe": 0.0094,
    "margine": 0.0475,
    "roa": 0.0244,
    "utileNetto": 193415000,
    "ricavi": 4069353000,
    "patrimonioNetto": 20492000000
   },
   {
    "anno": 2011,
    "roe": -0.2989,
    "margine": -0.2288,
    "roa": -0.4975,
    "utileNetto": -4718000000,
    "ricavi": 20618000000,
    "patrimonioNetto": 15785000000
   },
   {
    "anno": 2012,
    "roe": -1.1997,
    "margine": -0.372,
    "roa": -0.2182,
    "utileNetto": -7336000000,
    "ricavi": 19719000000,
    "patrimonioNetto": 6115000000
   },
   {
    "anno": 2013,
    "roe": 0.0025,
    "margine": 0.0014,
    "roa": 0.0007,
    "utileNetto": 35000000,
    "ricavi": 24420000000,
    "patrimonioNetto": 14245000000
   },
   {
    "anno": 2014,
    "roe": 0.0158,
    "margine": 0.0084,
    "roa": 0.0044,
    "utileNetto": 247000000,
    "ricavi": 29564000000,
    "patrimonioNetto": 15663000000
   },
   {
    "anno": 2015,
    "roe": 0.0443,
    "margine": 0.0226,
    "roa": 0.0117,
    "utileNetto": 733000000,
    "ricavi": 32467000000,
    "patrimonioNetto": 16557000000
   },
   {
    "anno": 2016,
    "roe": 0.0801,
    "margine": 0.0389,
    "roa": 0.0222,
    "utileNetto": 1460000000,
    "ricavi": 37490000000,
    "patrimonioNetto": 18236000000
   },
   {
    "anno": 2017,
    "roe": 0.2011,
    "margine": 0.1117,
    "roa": 0.0643,
    "utileNetto": 4536000000,
    "ricavi": 40604000000,
    "patrimonioNetto": 22559000000
   },
   {
    "anno": 2018,
    "roe": 0.1168,
    "margine": 0.0667,
    "roa": 0.0399,
    "utileNetto": 2888000000,
    "ricavi": 43310000000,
    "patrimonioNetto": 24718000000
   },
   {
    "anno": 2019,
    "roe": 0.1205,
    "margine": 0.0771,
    "roa": 0.0399,
    "utileNetto": 3468000000,
    "ricavi": 44998000000,
    "patrimonioNetto": 28789000000
   },
   {
    "anno": 2020,
    "roe": 0.0469,
    "margine": 0.0448,
    "roa": 0.0153,
    "utileNetto": 3064000000,
    "ricavi": 68397000000,
    "patrimonioNetto": 65344000000
   },
   {
    "anno": 2021,
    "roe": 0.0438,
    "margine": 0.0377,
    "roa": 0.0146,
    "utileNetto": 3024000000,
    "ricavi": 80118000000,
    "patrimonioNetto": 69102000000
   },
   {
    "anno": 2022,
    "roe": 0.0372,
    "margine": 0.0325,
    "roa": 0.0123,
    "utileNetto": 2590000000,
    "ricavi": 79571000000,
    "patrimonioNetto": 69656000000
   },
   {
    "anno": 2023,
    "roe": 0.1285,
    "margine": 0.1059,
    "roa": 0.04,
    "utileNetto": 8317000000,
    "ricavi": 78558000000,
    "patrimonioNetto": 64715000000
   },
   {
    "anno": 2024,
    "roe": 0.1837,
    "margine": 0.1393,
    "roa": 0.0545,
    "utileNetto": 11339000000,
    "ricavi": 81400000000,
    "patrimonioNetto": 61741000000
   },
   {
    "anno": 2025,
    "roe": 0.1857,
    "margine": 0.1245,
    "roa": 0.0501,
    "utileNetto": 10992000000,
    "ricavi": 88309000000,
    "patrimonioNetto": 59203000000
   }
  ]
 },
 "DIS": {
  "nome": "Walt Disney Co",
  "anni": [
   {
    "anno": 2018,
    "roe": 0.2583,
    "margine": 0.212,
    "roa": 0.1278,
    "utileNetto": 12598000000,
    "ricavi": 59434000000,
    "patrimonioNetto": 48773000000
   },
   {
    "anno": 2019,
    "roe": 0.1244,
    "margine": 0.1588,
    "roa": 0.057,
    "utileNetto": 11054000000,
    "ricavi": 69607000000,
    "patrimonioNetto": 88877000000
   },
   {
    "anno": 2020,
    "roe": -0.0343,
    "margine": -0.0438,
    "roa": -0.0142,
    "utileNetto": -2864000000,
    "ricavi": 65388000000,
    "patrimonioNetto": 83583000000
   },
   {
    "anno": 2021,
    "roe": 0.0225,
    "margine": 0.0296,
    "roa": 0.0098,
    "utileNetto": 1995000000,
    "ricavi": 67418000000,
    "patrimonioNetto": 88553000000
   },
   {
    "anno": 2022,
    "roe": 0.0331,
    "margine": 0.038,
    "roa": 0.0154,
    "utileNetto": 3145000000,
    "ricavi": 82722000000,
    "patrimonioNetto": 95008000000
   },
   {
    "anno": 2023,
    "roe": 0.0237,
    "margine": 0.0265,
    "roa": 0.0115,
    "utileNetto": 2354000000,
    "ricavi": 88898000000,
    "patrimonioNetto": 99277000000
   },
   {
    "anno": 2024,
    "roe": 0.0494,
    "margine": 0.0544,
    "roa": 0.0253,
    "utileNetto": 4972000000,
    "ricavi": 91361000000,
    "patrimonioNetto": 100696000000
   },
   {
    "anno": 2025,
    "roe": 0.1129,
    "margine": 0.1314,
    "roa": 0.0628,
    "utileNetto": 12404000000,
    "ricavi": 94425000000,
    "patrimonioNetto": 109869000000
   }
  ]
 },
 "NFLX": {
  "nome": "NETFLIX INC",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.0553,
    "roa": null,
    "utileNetto": 66608000,
    "ricavi": 1205340000,
    "patrimonioNetto": 429812000
   },
   {
    "anno": 2008,
    "roe": 0.2392,
    "margine": 0.0608,
    "roa": 0.1349,
    "utileNetto": 83026000,
    "ricavi": 1364661000,
    "patrimonioNetto": 347155000
   },
   {
    "anno": 2009,
    "roe": 0.5818,
    "margine": 0.0694,
    "roa": 0.1704,
    "utileNetto": 115860000,
    "ricavi": 1670269000,
    "patrimonioNetto": 199143000
   },
   {
    "anno": 2010,
    "roe": 0.5544,
    "margine": 0.0744,
    "roa": 0.1638,
    "utileNetto": 160853000,
    "ricavi": 2162625000,
    "patrimonioNetto": 290164000
   },
   {
    "anno": 2011,
    "roe": 0.3518,
    "margine": 0.0706,
    "roa": 0.0737,
    "utileNetto": 226126000,
    "ricavi": 3204577000,
    "patrimonioNetto": 642810000
   },
   {
    "anno": 2012,
    "roe": 0.023,
    "margine": 0.0048,
    "roa": 0.0043,
    "utileNetto": 17152000,
    "ricavi": 3609282000,
    "patrimonioNetto": 744673000
   },
   {
    "anno": 2013,
    "roe": 0.0843,
    "margine": 0.0257,
    "roa": 0.0208,
    "utileNetto": 112403000,
    "ricavi": 4374562000,
    "patrimonioNetto": 1333561000
   },
   {
    "anno": 2014,
    "roe": 0.1436,
    "margine": 0.0485,
    "roa": 0.0379,
    "utileNetto": 266799000,
    "ricavi": 5504656000,
    "patrimonioNetto": 1857708000
   },
   {
    "anno": 2015,
    "roe": 0.0552,
    "margine": 0.0181,
    "roa": 0.012,
    "utileNetto": 122641000,
    "ricavi": 6779511000,
    "patrimonioNetto": 2223426000
   },
   {
    "anno": 2016,
    "roe": 0.0697,
    "margine": 0.0211,
    "roa": 0.0137,
    "utileNetto": 186678000,
    "ricavi": 8830669000,
    "patrimonioNetto": 2679800000
   },
   {
    "anno": 2017,
    "roe": 0.156,
    "margine": 0.0478,
    "roa": 0.0294,
    "utileNetto": 558929000,
    "ricavi": 11692713000,
    "patrimonioNetto": 3581956000
   },
   {
    "anno": 2018,
    "roe": 0.2312,
    "margine": 0.0767,
    "roa": 0.0466,
    "utileNetto": 1211242000,
    "ricavi": 15794341000,
    "patrimonioNetto": 5238765000
   },
   {
    "anno": 2019,
    "roe": 0.2462,
    "margine": 0.0926,
    "roa": 0.0549,
    "utileNetto": 1866916000,
    "ricavi": 20156447000,
    "patrimonioNetto": 7582157000
   },
   {
    "anno": 2020,
    "roe": 0.2496,
    "margine": 0.1105,
    "roa": 0.0703,
    "utileNetto": 2761395000,
    "ricavi": 24996056000,
    "patrimonioNetto": 11065240000
   },
   {
    "anno": 2021,
    "roe": 0.3228,
    "margine": 0.1723,
    "roa": 0.1148,
    "utileNetto": 5116228000,
    "ricavi": 29697844000,
    "patrimonioNetto": 15849248000
   },
   {
    "anno": 2022,
    "roe": 0.2162,
    "margine": 0.1421,
    "roa": 0.0924,
    "utileNetto": 4491924000,
    "ricavi": 31615550000,
    "patrimonioNetto": 20777401000
   },
   {
    "anno": 2023,
    "roe": 0.2627,
    "margine": 0.1604,
    "roa": 0.111,
    "utileNetto": 5407990000,
    "ricavi": 33723297000,
    "patrimonioNetto": 20588313000
   },
   {
    "anno": 2024,
    "roe": 0.3521,
    "margine": 0.2234,
    "roa": 0.1624,
    "utileNetto": 8711631000,
    "ricavi": 39000966000,
    "patrimonioNetto": 24743567000
   },
   {
    "anno": 2025,
    "roe": 0.4126,
    "margine": 0.243,
    "roa": 0.1975,
    "utileNetto": 10981201000,
    "ricavi": 45183036000,
    "patrimonioNetto": 26615488000
   }
  ]
 },
 "CMCSA": {
  "nome": "COMCAST CORP",
  "anni": [
   {
    "anno": 2007,
    "roe": null,
    "margine": 0.0833,
    "roa": null,
    "utileNetto": 2587000000,
    "ricavi": 31060000000,
    "patrimonioNetto": 41489000000
   },
   {
    "anno": 2008,
    "roe": 0.0628,
    "margine": 0.074,
    "roa": 0.0225,
    "utileNetto": 2547000000,
    "ricavi": 34423000000,
    "patrimonioNetto": 40576000000
   },
   {
    "anno": 2009,
    "roe": 0.085,
    "margine": 0.1017,
    "roa": 0.0323,
    "utileNetto": 3638000000,
    "ricavi": 35756000000,
    "patrimonioNetto": 42811000000
   },
   {
    "anno": 2010,
    "roe": 0.0818,
    "margine": 0.0958,
    "roa": 0.0307,
    "utileNetto": 3635000000,
    "ricavi": 37937000000,
    "patrimonioNetto": 44434000000
   },
   {
    "anno": 2011,
    "roe": 0.0873,
    "margine": 0.0745,
    "roa": 0.0264,
    "utileNetto": 4160000000,
    "ricavi": 55842000000,
    "patrimonioNetto": 47655000000
   },
   {
    "anno": 2012,
    "roe": 0.1246,
    "margine": 0.0991,
    "roa": 0.0376,
    "utileNetto": 6203000000,
    "ricavi": 62570000000,
    "patrimonioNetto": 49796000000
   },
   {
    "anno": 2013,
    "roe": 0.1335,
    "margine": 0.1054,
    "roa": 0.0429,
    "utileNetto": 6816000000,
    "ricavi": 64657000000,
    "patrimonioNetto": 51058000000
   },
   {
    "anno": 2014,
    "roe": 0.1579,
    "margine": 0.1218,
    "roa": 0.0526,
    "utileNetto": 8380000000,
    "ricavi": 68775000000,
    "patrimonioNetto": 53068000000
   },
   {
    "anno": 2015,
    "roe": 0.1512,
    "margine": 0.1096,
    "roa": 0.049,
    "utileNetto": 8163000000,
    "ricavi": 74510000000,
    "patrimonioNetto": 53978000000
   },
   {
    "anno": 2016,
    "roe": 0.1545,
    "margine": 0.1075,
    "roa": 0.0481,
    "utileNetto": 8678000000,
    "ricavi": 80736000000,
    "patrimonioNetto": 56163000000
   },
   {
    "anno": 2017,
    "roe": 0.3273,
    "margine": 0.2674,
    "roa": 0.1213,
    "utileNetto": 22735000000,
    "ricavi": 85029000000,
    "patrimonioNetto": 69459000000
   },
   {
    "anno": 2018,
    "roe": 0.1618,
    "margine": 0.1241,
    "roa": 0.0466,
    "utileNetto": 11731000000,
    "ricavi": 94507000000,
    "patrimonioNetto": 72502000000
   },
   {
    "anno": 2019,
    "roe": 0.1557,
    "margine": 0.1199,
    "roa": 0.0496,
    "utileNetto": 13057000000,
    "ricavi": 108942000000,
    "patrimonioNetto": 83874000000
   },
   {
    "anno": 2020,
    "roe": 0.1148,
    "margine": 0.1017,
    "roa": 0.0385,
    "utileNetto": 10534000000,
    "ricavi": 103564000000,
    "patrimonioNetto": 91738000000
   },
   {
    "anno": 2021,
    "roe": 0.1452,
    "margine": 0.1217,
    "roa": 0.0513,
    "utileNetto": 14159000000,
    "ricavi": 116385000000,
    "patrimonioNetto": 97490000000
   },
   {
    "anno": 2022,
    "roe": 0.0658,
    "margine": 0.0442,
    "roa": 0.0209,
    "utileNetto": 5370000000,
    "ricavi": 121427000000,
    "patrimonioNetto": 81627000000
   },
   {
    "anno": 2023,
    "roe": 0.1849,
    "margine": 0.1266,
    "roa": 0.0581,
    "utileNetto": 15388000000,
    "ricavi": 121572000000,
    "patrimonioNetto": 83226000000
   },
   {
    "anno": 2024,
    "roe": 0.1892,
    "margine": 0.1309,
    "roa": 0.0608,
    "utileNetto": 16192000000,
    "ricavi": 123731000000,
    "patrimonioNetto": 85560000000
   },
   {
    "anno": 2025,
    "roe": 0.2064,
    "margine": 0.1617,
    "roa": 0.0734,
    "utileNetto": 19998000000,
    "ricavi": 123707000000,
    "patrimonioNetto": 96903000000
   }
  ]
 },
 "NEE": {
  "nome": "NEXTERA ENERGY INC",
  "anni": [
   {
    "anno": 2008,
    "roe": 0.1403,
    "margine": 0.0999,
    "roa": 0.0366,
    "utileNetto": 1639000000,
    "ricavi": 16410000000,
    "patrimonioNetto": 11681000000
   },
   {
    "anno": 2009,
    "roe": 0.1245,
    "margine": 0.1032,
    "roa": 0.0333,
    "utileNetto": 1615000000,
    "ricavi": 15643000000,
    "patrimonioNetto": 12967000000
   },
   {
    "anno": 2010,
    "roe": 0.1353,
    "margine": 0.1278,
    "roa": 0.0369,
    "utileNetto": 1957000000,
    "ricavi": 15317000000,
    "patrimonioNetto": 14461000000
   },
   {
    "anno": 2011,
    "roe": 0.1287,
    "margine": 0.1254,
    "roa": 0.0336,
    "utileNetto": 1923000000,
    "ricavi": 15341000000,
    "patrimonioNetto": 14943000000
   },
   {
    "anno": 2012,
    "roe": 0.1189,
    "margine": 0.134,
    "roa": 0.0297,
    "utileNetto": 1911000000,
    "ricavi": 14256000000,
    "patrimonioNetto": 16068000000
   },
   {
    "anno": 2013,
    "roe": 0.1058,
    "margine": null,
    "roa": 0.0276,
    "utileNetto": 1908000000,
    "ricavi": null,
    "patrimonioNetto": 18040000000
   },
   {
    "anno": 2014,
    "roe": 0.1222,
    "margine": null,
    "roa": 0.033,
    "utileNetto": 2465000000,
    "ricavi": null,
    "patrimonioNetto": 20168000000
   },
   {
    "anno": 2015,
    "roe": 0.1191,
    "margine": null,
    "roa": 0.0334,
    "utileNetto": 2752000000,
    "ricavi": null,
    "patrimonioNetto": 23112000000
   },
   {
    "anno": 2016,
    "roe": 0.1146,
    "margine": null,
    "roa": 0.0321,
    "utileNetto": 2906000000,
    "ricavi": null,
    "patrimonioNetto": 25358000000
   },
   {
    "anno": 2017,
    "roe": 0.1822,
    "margine": null,
    "roa": 0.0549,
    "utileNetto": 5380000000,
    "ricavi": null,
    "patrimonioNetto": 29531000000
   },
   {
    "anno": 2018,
    "roe": 0.1774,
    "margine": 0.431,
    "roa": 0.064,
    "utileNetto": 6638000000,
    "ricavi": 15400000000,
    "patrimonioNetto": 37413000000
   },
   {
    "anno": 2019,
    "roe": 0.0911,
    "margine": 0.2154,
    "roa": 0.032,
    "utileNetto": 3769000000,
    "ricavi": 17500000000,
    "patrimonioNetto": 41360000000
   },
   {
    "anno": 2020,
    "roe": 0.065,
    "margine": 0.1717,
    "roa": 0.0229,
    "utileNetto": 2919000000,
    "ricavi": 17000000000,
    "patrimonioNetto": 44929000000
   },
   {
    "anno": 2021,
    "roe": 0.0787,
    "margine": 0.1901,
    "roa": 0.0254,
    "utileNetto": 3573000000,
    "ricavi": 18800000000,
    "patrimonioNetto": 45424000000
   },
   {
    "anno": 2022,
    "roe": 0.0858,
    "margine": 0.1803,
    "roa": 0.0261,
    "utileNetto": 4147000000,
    "ricavi": 23000000000,
    "patrimonioNetto": 48326000000
   },
   {
    "anno": 2023,
    "roe": 0.1265,
    "margine": 0.2948,
    "roa": 0.0412,
    "utileNetto": 7310000000,
    "ricavi": 24800000000,
    "patrimonioNetto": 57768000000
   },
   {
    "anno": 2024,
    "roe": 0.1386,
    "margine": 0.2956,
    "roa": 0.0365,
    "utileNetto": 6946000000,
    "ricavi": 23500000000,
    "patrimonioNetto": 50101000000
   },
   {
    "anno": 2025,
    "roe": 0.1252,
    "margine": 0.2649,
    "roa": 0.0321,
    "utileNetto": 6835000000,
    "ricavi": 25800000000,
    "patrimonioNetto": 54608000000
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
