// GENERATO una tantum. Non modificare a mano.
//
// TERRE RARE: 121 anni (1900 - 2020).
// Fonte: U.S. Geological Survey, Data Series 140 — Historical Statistics for
// Mineral and Material Commodities. Ente federale USA: DOMINIO PUBBLICO.
//
// PERCHE' QUESTO PANNELLO ESISTE. Avevo scritto, e detto all'utente, che un
// dato pubblico sulle terre rare non esiste. Era sbagliato: non esiste un
// PREZZO DI BORSA quotato in continuo, perche' le terre rare si scambiano per
// contratti diretti. Ma esiste molto di piu', e da molto piu' tempo: lo Stato
// americano censisce questo mercato dal 1900. Centoventun anni di produzione,
// importazioni, esportazioni, consumo e valore unitario. Cercare meglio ha
// dato piu' di quanto avesse dato arrendersi.
//
// COS'E' IL "VALORE UNITARIO": il valore in dollari per tonnellata del consumo
// apparente americano. Non e' la quotazione di un mercato, e' quanto e'
// costato in media quello che il Paese ha effettivamente usato. Per un mercato
// fatto di contratti bilaterali e' la cosa piu' vicina a un prezzo che esista,
// e in un certo senso e' piu' onesta di una quotazione: sono transazioni vere.
//
// IL PREZZO REALE E' GIA' DEFLAZIONATO ALLA FONTE, in dollari del 1998. Non
// va deflazionato di nuovo con il CPI, sarebbe toglierla due volte.
//
// I LIMITI, dichiarati: e' ANNUALE (un mercato di contratti annuali non ha un
// prezzo giornaliero), riguarda gli STATI UNITI (il consumo americano, non il
// mondo — ma la produzione mondiale c'e'), e finisce nel 2020. Per gli anni
// dopo c'e' solo l'ETF di societa' minerarie, che e' un'altra cosa e il modulo
// a valle lo misura invece di far finta.
'use strict';

export const TR_DA = 1900;
export const TR_A = 2020;
export const TR_ANNI = 121;
export const TR_FONTE = 'U.S. Geological Survey, Data Series 140 — dominio pubblico';

export const TR_ANNO = [
  1900, 1901, 1902, 1903, 1904, 1905, 1906, 1907, 1908, 1909, 1910, 1911,
  1912, 1913, 1914, 1915, 1916, 1917, 1918, 1919, 1920, 1921, 1922, 1923,
  1924, 1925, 1926, 1927, 1928, 1929, 1930, 1931, 1932, 1933, 1934, 1935,
  1936, 1937, 1938, 1939, 1940, 1941, 1942, 1943, 1944, 1945, 1946, 1947,
  1948, 1949, 1950, 1951, 1952, 1953, 1954, 1955, 1956, 1957, 1958, 1959,
  1960, 1961, 1962, 1963, 1964, 1965, 1966, 1967, 1968, 1969, 1970, 1971,
  1972, 1973, 1974, 1975, 1976, 1977, 1978, 1979, 1980, 1981, 1982, 1983,
  1984, 1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995,
  1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007,
  2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019,
  2020,
];

// Tonnellate di ossido di terre rare.
export const TR_PRODUZIONE_USA = [
    227, 187, 200, 215, 186, 335, 211, 137, 105, 135, 25, null,
    null, null, null, 9, 9, 25, null, null, null, null, null, null,
    null, 0.499, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null,
    20, null, 383, 747, 1110, 615, 983, 608, null, 499, 625, 600,
    1050, 1030, null, 278, 256, 2900, 12200, 12900, 10300, 12500, 9110, 9820,
    10700, 17500, 19900, 15000, 13000, 15400, 14100, 16500, 16000, 17100, 17500, 17100,
    25300, 13400, 10900, 11100, 11500, 20800, 22700, 16500, 20700, 17800, 20700, 22200,
    20400, 20000, 10000, 5000, 5000, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 3000, 5500, 5400, 5900, 0, 0, 14000, 28000,
    39000
];

export const TR_PRODUZIONE_MONDO = [
    1040, 1090, 863, 2030, 2860, 2780, 2600, 2580, 2840, 3690, 3020, 2490,
    2500, 1480, 992, 870, 731, 1730, 1470, 1210, 1590, 929, 189, 138,
    348, 12, 146, 352, 180, 197, 17, 50, 530, 302, 564, 2130,
    1840, 2150, 3310, 2510, 2370, 2380, 1500, 1900, 3200, 1440, 721, 1300,
    2720, 1290, 470, 1240, 1820, 3960, 7840, 5760, 5230, 5980, 8060, 2810,
    2270, 3690, 8020, 6060, 3680, 6960, 16200, 16900, 16200, 18100, 15900, 16400,
    18200, 24000, 25600, 22100, 19700, 24500, 26500, 28800, 27300, 30600, 26600, 31400,
    41400, 43500, 39900, 46900, 55300, 60700, 52900, 41700, 50100, 46700, 55100, 74300,
    79700, 68300, 77100, 86600, 90900, 94500, 98200, 97100, 102000, 122000, 137000, 124000,
    132000, 135000, 101000, 104000, 106000, 107000, 125000, 129000, 133000, 147000, 190000, 219000,
    243000
];

export const TR_IMPORTAZIONI_USA = [
    null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, 0.017, 13.6,
    37.2, 6.74, 3.53, 26.4, 31.4, 41.7, 27.1, 0.12, null, 0.018, null, null,
    0.009, 652, 377, 471, 0.2, 8.13, 4.66, 2.34, 8.18, 13.3, 6.31, 0.268,
    0.644, 1.43, 54.2, 172, null, 1.7, 4.78, 12.5, 27.8, 44.3, 20.6, 6.7,
    17.9, 1450, 3840, 3220, 1060, 1050, 1240, 1070, 2220, 2110, 1730, 1690,
    466, 1080, 707, 1300, 1070, 2760, 4010, 3810, 3290, 4340, 4210, 2790,
    4420, 3390, 2150, 1070, 1840, 7710, 5520, 5930, 5110, 6250, 6990, 12400,
    17500, 12200, 14000, 21300, 21700, 19200, 14200, 16700, 17300, 15300, 18500, 17700,
    15400, 12100, 12900, 7790, 5310, 9140, 11400, 9900, 12200, 11800, 11700, 13300,
    7200
];

export const TR_ESPORTAZIONI_USA = [
    null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, 10.5, 22.1, 16.9, 13, 16, 73.4,
    22.2, 28.2, 22.3, null, null, 50.1, 19.3, 14.9, 19.5, 8.58, 19.4, 18.5,
    19.5, 11.8, 17.5, 86.2, 906, 21.8, null, 56.9, 36.2, 41.6, 31.2, 284,
    597, 1420, 1770, 539, 263, 867, 287, 33.9, 8470, 5350, 2730, 2900,
    4550, 4670, 3650, 4540, 6530, 1940, 5860, 5360, 5720, 7170, 10200, 10600,
    13000, 12400, 9440, 9620, 9750, 9100, 8210, 7310, 11800, 9240, 9150, 7450,
    7920, 9190, 7880, 10300, 5870, 8770, 5990, 6260, 1640, 2780, 19100, 29500,
    39500
];

export const TR_CONSUMO_USA = [
    227, 187, 200, 215, 186, 335, 211, 137, 105, 135, 25, 22,
    19, 15, 12, 9, 9, 25, 20, 15, 9.99, 5, 0.017, 13.6,
    37.2, 7.24, 3.53, 26.4, 31.4, 41.7, 27.1, 0.12, 0.069, 0.018, 0.015, 0.012,
    0.009, 652, 377, 471, 0.2, 8.13, 6.19, 4.25, 2.31, 0.365, 83.2, 200,
    200, 300, 400, 900, 1000, 600, 2270, 2450, 2720, 2720, 2450, 2270,
    2040, 2460, 2110, 2810, 2770, 5050, 6620, 5530, 7800, 10100, 10500, 9340,
    12200, 14800, 14100, 11500, 12200, 16800, 16800, 16100, 18100, 20000, 17100, 19600,
    21400, 12100, 10900, 11100, 16800, 27800, 28700, 22100, 21400, 17000, 17800, 24000,
    24900, 19400, 11500, 11500, 12100, null, null, null, null, null, null, 10200,
    7410, 2830, 5050, null, 2440, 5870, 10800, 9550, 10500, 9050, 6500, 12000,
    6700
];

// Dollari per tonnellata, correnti.
export const TR_PREZZO_NOMINALE = [
    null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, 2450, 344,
    219, 1070, 311, 237, 451, 412, 601, 367, 5930, 11600, 11700, 11700,
    11700, 4, 3, 3, 8480, 11200, 9930, 7240, 8680, 9620, 11100, 14400,
    14700, 8900, 3540, 1670, 3910, 7090, 8630, 6720, 5070, 1920, 5100, 5050,
    3540, 82, 341, 319, 385, 485, 284, 562, 401, 420, 412, 1040,
    3690, 2150, 3070, 2050, 4380, 2600, 2500, 4580, 1960, 1870, 2360, 2820,
    2380, 2190, 3840, 3970, 2230, 6780, 8990, 9470, 10100, 9010, 7980, 8210,
    7150, 8540, 8900, 6400, 6450, 5790, 7500, 6150, 8590, 6595, 3890, 5290,
    13600, 9300, 20000, 58100, 51200, 19100, 15200, 14800, 10600, 11500, 8860, 6080,
    5130
];

// Dollari del 1998 per tonnellata: gia' al netto dell'inflazione.
export const TR_PREZZO_REALE = [
    null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, 23800, 3280,
    2090, 10000, 2850, 2210, 4300, 3920, 5890, 3930, 70600, 145000, 142000, 139000,
    137000, 41, 38, 29, 98700, 124000, 99300, 68300, 80400, 87500, 92500, 105000,
    99300, 61000, 23900, 10400, 24000, 43200, 52300, 41000, 30400, 11200, 28800, 28200,
    19500, 446, 1840, 1700, 2030, 2510, 1430, 2740, 1880, 1870, 1730, 4190,
    14400, 7890, 10100, 6210, 12500, 6990, 6250, 10300, 3880, 3350, 3990, 4620,
    3730, 3320, 5710, 5700, 3070, 8910, 11200, 11300, 11700, 10200, 8780, 8780,
    7430, 8670, 8900, 6260, 6110, 5330, 6800, 5450, 7410, 5500, 3150, 4160,
    10300, 7100, 14500, 42100, 36300, 13400, 10500, 10200, 7200, 7650, 5750, 3880,
    3230
];
