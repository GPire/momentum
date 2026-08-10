// GENERATO una tantum da Yahoo Finance (^GSPC). Non modificare a mano.
//
// AZIONI STATI UNITI, media annuale dell'indice S&P 500: 41 anni
// (1985-2025). Serve per mettere le azioni sulla STESSA GRIGLIA
// ANNUALE delle materie prime, delle case e delle terre rare: e' l'unica
// frequenza che tutte queste serie hanno in comune, perche' un mercato di
// contratti annuali non ha un prezzo giornaliero.
//
// MEDIA DELL'ANNO e non chiusura di dicembre: tutte le altre serie qui sono
// medie annuali (il valore unitario USGS, il Pink Sheet, gli indici BIS), e
// confrontare una media con una chiusura introdurrebbe uno sfasamento
// sistematico di sei mesi che si travestirebbe da anticipo o da ritardo.
//
// FONTE FRAGILE, dichiarata: Yahoo non ha un'API ufficiale dal 2017. Questo
// pannello e` una fotografia gia` scaricata, non una dipendenza a runtime.
'use strict';

export const AZ_ANNO = [1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
export const AZ_LIVELLO = [188.97, 238.92, 285.99, 268.05, 326.31, 332.68, 381.53, 417.12, 453.45, 460.66, 546.88, 674.85, 875.86, 1087.86, 1330.58, 1419.73, 1185.75, 988.59, 967.93, 1133.96, 1207.77, 1318.31, 1478.1, 1215.22, 948.52, 1130.68, 1280.76, 1386.51, 1652.29, 1944.41, 2051.93, 2105.83, 2465.2, 2738.4, 2937.96, 3216.95, 4278.76, 4077.66, 4322.65, 5460.22, 6276.29];
export const AZ_FONTE = 'Yahoo Finance, indice S&P 500, media annuale';
