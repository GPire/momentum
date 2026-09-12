import { portfolioProviderRisk } from '../alpha/portfolio-provider-risk.js';
import { t } from '../i18n/ui-strings.js';

export function isPortfolioRiskQuestion(q) {
  return /(?:rischio.{0,25}portafoglio|portfolio.{0,25}risk|risque.{0,25}portefeuille|riesgo.{0,25}cartera|risiko.{0,25}portfolio|portfoliorisiko|risico.{0,25}portefeuille|risco.{0,25}carteira)/iu.test(q);
}

export function answerPortfolioRisk(ctx, lang) {
  const data = portfolioProviderRisk(ctx.positions, ctx.marketRiskSources, {
    asOf: (ctx.referenceDate || new Date()).toISOString().slice(0, 10),
  });
  let answer;
  if (!ctx.positions?.length) answer = t('qaPortfolioRiskEmpty', lang);
  else if (!data.available) answer = t('qaPortfolioRiskMissing', lang);
  else {
    const percent = x => new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 1 }).format(x);
    const amount = new Intl.NumberFormat(lang, { style: 'currency', currency: data.baseCurrency, signDisplay: 'always' }).format(data.changeBase);
    answer = t('qaPortfolioRiskResult', lang, amount, percent(1 - data.level), data.horizon, percent(data.coverage), data.last);
  }
  return { intent: 'portfolio-risk', data, answer };
}
