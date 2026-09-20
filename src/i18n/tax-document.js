const keys=['open','code','credit','reference','note'];
const copy={
it:['Collega una riga F24 · Erario','Codice tributo','Credito compensato (€)','Riferimento del documento','Copia una sola riga dal tuo F24. Il controllo è formale, non certifica il credito o l’esito. Il credito resta separato dai pagamenti in denaro.'],
en:['Link an F24 row · Erario','Tax code','Offset credit (€)','Document reference','Copy one row from your F24. Checks are formal, not proof of credit eligibility or submission. Credit stays separate from cash payments.'],
de:['F24-Zeile verknüpfen · Erario','Steuercode','Verrechnetes Guthaben (€)','Dokumentreferenz','Eine F24-Zeile übernehmen. Formale Prüfung, keine Bestätigung des Guthabens oder der Übermittlung. Guthaben bleibt von Geldzahlungen getrennt.'],
fr:['Relier une ligne F24 · Erario','Code fiscal','Crédit compensé (€)','Référence du document','Recopiez une ligne F24. Contrôle formel, sans certification du crédit ni du résultat de transmission. Le crédit reste distinct des paiements en argent.'],
es:['Vincular una fila F24 · Erario','Código tributario','Crédito compensado (€)','Referencia del documento','Copia una fila F24. Control formal, sin certificar el crédito ni el resultado del envío. El crédito queda separado de los pagos en dinero.'],
nl:['F24-regel koppelen · Erario','Belastingcode','Verrekend tegoed (€)','Documentreferentie','Kopieer één F24-regel. Formele controle, geen bewijs van recht op tegoed of indiening. Tegoed blijft gescheiden van geldbetalingen.'],
pt:['Associar linha F24 · Erario','Código tributário','Crédito compensado (€)','Referência do documento','Copie uma linha F24. Verificação formal, sem certificar o crédito ou o resultado do envio. O crédito fica separado dos pagamentos em dinheiro.']
};
export const taxDocumentCopy=lang=>Object.fromEntries(keys.map((k,i)=>[k,(Object.hasOwn(copy,lang)?copy[lang]:copy.en)[i]]));
