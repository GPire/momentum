import fs from 'node:fs';
import {evaluatePaymentWindows} from '../src/invoice/payment-window-evaluation.js';
import {syntheticPaymentDataset} from './payment-window-fixture.mjs';
// Optional authorized anonymized dataset path; no upload or network call.
const dataset=process.argv[2]?JSON.parse(fs.readFileSync(process.argv[2],'utf8')):syntheticPaymentDataset;
console.log(JSON.stringify(evaluatePaymentWindows(dataset),null,2));
