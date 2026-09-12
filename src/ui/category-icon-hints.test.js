import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestCategoryIcon } from './category-icon-hints.js';
import { t, UI_LANGS } from '../i18n/ui-strings.js';
import { tIntegration } from '../i18n/integration-copy.js';
import { EXTRA_CATEGORY_ICONS } from './category-icons.js';

test('recognizes specific everyday expenses across supported languages', () => {
  for (const [name, icon] of [['Parkeren','parcheggio'],['Assicurazioni','assicurazione'],['Kinderbetreuung','bambini'],['Manutenção','manutenzione'],['Vêtements','abbigliamento'],['Consegne','consegne'],['Supermercado','spesa'],['Donaciones','donazioni'],['Education','scuola'],['Technology','tecnologia']]) assert.equal(suggestCategoryIcon(name), icon, name);
  for (const [name, icon] of [['Alcolici','alcolici'],['Cigarettes','tabacco'],['Merenda','snack'],['Öffentliche Verkehrsmittel','trasporto'],['Café','caffe'],['Combustível','carburante'],['Sportschool','sport'],['Peluquería','bellezza'],['Treno','trasporto']]) assert.equal(suggestCategoryIcon(name), icon, name);
});
test('does not guess from unrelated substrings or retain an old suggestion', () => {
  for (const name of ['', null, 'business', 'steam engine', 'misteriosa']) assert.equal(suggestCategoryIcon(name), null);
});

test('every icon has a readable label in all supported languages', () => {
  for (const language of UI_LANGS) {
    for (const {chiave} of EXTRA_CATEGORY_ICONS) {
      const key = `catIcon_${chiave}`;
      assert.notEqual(tIntegration(key, language), key, `${language}: ${key}`);
    }
    for (const icon of ['cinema','snack','caffe','trasporto','carburante','sport','bellezza','gioco','libri','viaggi','animali','salute','regali','casa','musica','bollette','alcolici','tabacco']) {
      const key = `catIcon_${icon}`;
      assert.notEqual(t(key, language), key, `${language}: ${key}`);
    }
  }
});
