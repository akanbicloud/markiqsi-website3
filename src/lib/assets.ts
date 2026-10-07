export type Driver = { t: string; x: string };
export type Asset = {
  key: string;
  label: string;
  currencies: string[];
  countries: string[];
  simply: string;
  drivers: Driver[];
  sources: string[];
};

const D = (t: string, x: string): Driver => ({ t, x });

/** Background knowledge used by Ask MarkIQ. Numbers never come from here, only from the market data tables. */
export const ASSETS: Asset[] = [
  { key: 'EUR/USD', label: 'EUR/USD', currencies: ['EUR', 'USD'], countries: ['Eurozone', 'US'], simply: 'It mostly follows the gap between European and US interest rates.', drivers: [D('Interest rates', 'ECB rates versus Fed rates. Money tends to flow to the higher rate.'), D('Inflation', 'Eurozone and US price numbers change what each central bank does next.'), D('Jobs and growth', 'Strong US jobs data usually lifts the dollar.'), D('Risk mood', 'In scary times traders often buy the dollar.')], sources: ['ECB', 'Eurostat', 'Federal Reserve', 'US Bureau of Labor Statistics'] },
  { key: 'GBP/USD', label: 'GBP/USD', currencies: ['GBP', 'USD'], countries: ['UK', 'US'], simply: 'It follows Bank of England versus Fed rates and UK inflation.', drivers: [D('Interest rates', 'Bank of England rates versus Fed rates.'), D('UK inflation and wages', 'High numbers can keep UK rates higher for longer.'), D('UK growth', 'Weak GDP can soften the pound.'), D('US data', 'Big US releases move the dollar side.')], sources: ['Bank of England', 'UK Office for National Statistics', 'Federal Reserve', 'US Bureau of Labor Statistics'] },
  { key: 'USD/JPY', label: 'USD/JPY', currencies: ['USD', 'JPY'], countries: ['US', 'Japan'], simply: 'It mostly follows the gap between US and Japanese interest rates.', drivers: [D('Rate gap', 'When US rates are far above Japan’s, USD/JPY tends to rise.'), D('Bank of Japan', 'Any move toward higher rates can strengthen the yen fast.'), D('US bond yields', 'Rising yields usually lift USD/JPY.'), D('Intervention', 'Japan may step in if the yen falls too fast.')], sources: ['Bank of Japan', 'Japan Ministry of Finance', 'Federal Reserve', 'US Treasury'] },
  { key: 'AUD/USD', label: 'AUD/USD', currencies: ['AUD', 'USD'], countries: ['Australia', 'US', 'China'], simply: 'It follows Australian versus US rates, metals prices and China’s economy.', drivers: [D('Interest rates', 'RBA rates versus Fed rates.'), D('China', 'China buys much of what Australia sells, so Chinese data matters.'), D('Metals prices', 'Iron ore and copper prices support the Australian dollar.'), D('Risk mood', 'It often weakens when markets are fearful.')], sources: ['Reserve Bank of Australia', 'Australian Bureau of Statistics', 'Federal Reserve'] },
  { key: 'USD/CAD', label: 'USD/CAD', currencies: ['USD', 'CAD'], countries: ['US', 'Canada'], simply: 'It follows US versus Canadian rates and the oil price.', drivers: [D('Interest rates', 'Fed rates versus Bank of Canada rates.'), D('Oil', 'Higher oil prices usually support the Canadian dollar, pushing USD/CAD down.'), D('Jobs', 'Canada and US jobs reports often come out at the same time.'), D('Trade', 'Trade news between the US and Canada can move it sharply.')], sources: ['Bank of Canada', 'Statistics Canada', 'Federal Reserve', 'US EIA'] },
  { key: 'Gold', label: 'Gold (XAU/USD)', currencies: ['USD', 'XAU'], countries: ['US'], simply: 'Gold likes lower interest rates, a weaker dollar and uncertain times.', drivers: [D('Real interest rates', 'Lower rates after inflation make gold more attractive.'), D('US dollar', 'Gold is priced in dollars, so a weaker dollar often helps it.'), D('Safe-haven demand', 'Wars and crises push investors into gold.'), D('Central bank buying', 'Big purchases by central banks support prices.')], sources: ['Federal Reserve', 'US Bureau of Labor Statistics', 'World Gold Council'] },
  { key: 'Oil', label: 'Oil (WTI)', currencies: ['USD', 'OIL'], countries: ['US', 'China', 'Global'], simply: 'Oil follows supply decisions and how much the world is using.', drivers: [D('OPEC+ supply', 'Decisions to pump more or less move prices directly.'), D('US oil stocks', 'Weekly storage numbers show if supply is tight.'), D('Global demand', 'China and US growth drive how much oil is used.'), D('Conflict', 'Trouble in oil regions can spike prices.')], sources: ['OPEC', 'US Energy Information Administration', 'International Energy Agency'] },
  { key: 'Bitcoin', label: 'Bitcoin', currencies: ['BTC', 'USD'], countries: ['US'], simply: 'Bitcoin reacts to interest rates, money flows and regulation news.', drivers: [D('Interest rates', 'Lower rates and more cash in the system tend to help.'), D('Fund flows', 'Money moving into or out of Bitcoin funds.'), D('Regulation', 'New rules or court cases can move it sharply.'), D('Risk mood', 'It often moves with tech stocks.')], sources: ['Federal Reserve', 'US SEC filings'] },
  { key: 'S&P 500', label: 'S&P 500', currencies: ['USD'], countries: ['US'], simply: 'US stocks follow company profits, interest rates and the economy.', drivers: [D('Company earnings', 'Profits from big companies drive the index most.'), D('Interest rates', 'Lower rates usually help stocks; higher rates weigh on them.'), D('Inflation and jobs', 'These shape what the Fed does next.'), D('Big tech', 'A few giant companies make up a large part of the index.')], sources: ['Federal Reserve', 'US Bureau of Labor Statistics', 'US Bureau of Economic Analysis', 'Company reports'] },
];

export function findAsset(key: string) {
  return ASSETS.find((a) => a.key.toLowerCase() === key.toLowerCase());
}
