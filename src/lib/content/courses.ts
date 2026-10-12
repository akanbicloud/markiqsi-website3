/**
 * MarkIQ SI Academy courses. Prices are set by the owner: Naira for online and physical classes,
 * US dollars for online only (fixed prices, reviewed monthly, not a live conversion).
 * Never promise income or profit in course copy.
 */

export type Format = 'online' | 'physical';
export type Currency = 'NGN' | 'USD';

export type Course = {
  slug: string;
  title: string;
  short: string;
  level: string;
  weeks: number;
  /** List prices. */
  price: { onlineNgn: number; onlineUsd: number; physicalNgn: number };
  forWho: string;
  outcomes: string[];
  /** One entry per week (or block of weeks). */
  outline: { week: string; title: string; lessons: string[]; practice?: string }[];
  /** Tools used in the course, as links. */
  tools: { label: string; href: string }[];
  bundle?: string[];
};

export const ACADEMY = {
  name: 'MarkIQ SI Academy',
  street: '24 Majek Kembo Plaza, beside Chicken Republic',
  area: 'Oke-Ilewo',
  city: 'Abeokuta',
  region: 'Ogun State',
  country: 'NG',
  get addressLine() {
    return `${this.street}, ${this.area}, ${this.city}, ${this.region}`;
  },
};

/** Launch offer. Set `discount` to 0 to end it. `endsOn` is shown on the page when set (YYYY-MM-DD). */
export const LAUNCH = { discount: 0.5, endsOn: '' as string };

const round = (n: number, step: number) => Math.round(n / step) * step;

export function priceFor(c: Course, format: Format, currency: Currency) {
  const list = format === 'physical' ? c.price.physicalNgn : currency === 'USD' ? c.price.onlineUsd : c.price.onlineNgn;
  const now = LAUNCH.discount > 0 ? (currency === 'USD' ? Math.max(5, round(list * (1 - LAUNCH.discount), 5)) : round(list * (1 - LAUNCH.discount), 500)) : list;
  return { list, now, onOffer: now < list };
}

export function money(n: number, currency: Currency) {
  return currency === 'USD' ? `$${n.toLocaleString('en-US')}` : `₦${n.toLocaleString('en-NG')}`;
}

/** Physical classes are only priced in Naira; online can be Naira or dollars. */
export function validChoice(format: Format, currency: Currency) {
  return !(format === 'physical' && currency === 'USD');
}

const T = {
  risk: { label: 'Risk Calculator', href: '/tools?tool=risk' },
  prop: { label: 'Prop Challenge Tracker', href: '/tools?tool=prop' },
  charts: { label: 'Charts with bar replay', href: '/tools?tool=charts' },
  scan: { label: 'Market Scanner', href: '/tools?tool=scan' },
  bot: { label: 'Bot Builder', href: '/tools?tool=bot' },
  ind: { label: 'Indicator Builder', href: '/tools?tool=indicator' },
  journal: { label: 'Trading Journal', href: '/tools?tool=journal' },
  markets: { label: 'Markets and Ask MarkIQ', href: '/markets' },
};

export const COURSES: Course[] = [
  {
    slug: 'beginner-market-foundations',
    title: 'Beginner: Market Foundations',
    short: 'Start from zero: how forex, gold, indices and crypto work, how to read a chart and how to protect your money.',
    level: 'Beginner',
    weeks: 4,
    price: { onlineNgn: 30000, onlineUsd: 25, physicalNgn: 42000 },
    forWho: 'Complete beginners, and anyone who has traded a little but never learned the basics properly.',
    outcomes: [
      'Understand what moves forex, gold, indices and crypto',
      'Read candlestick charts and spot trends',
      'Place a trade with a stop loss and take profit on a demo account',
      'Work out position size so one trade cannot wipe out your account',
      'Keep a trading journal from day one',
    ],
    outline: [
      { week: 'Week 1', title: 'How the markets work', lessons: ['What forex, gold, oil, indices and crypto are', 'Brokers, spreads, pips, lots and leverage in plain words', 'Trading sessions: Asia, London and New York', 'Spotting scams and fake "guaranteed profit" offers'], practice: 'Open a demo account and explore the platform.' },
      { week: 'Week 2', title: 'Reading a chart', lessons: ['Candlesticks and what each one tells you', 'Timeframes, and why the higher timeframe matters', 'Trends, ranges, support and resistance', 'Your first chart walk-through on MarkIQ SI Charts'], practice: 'Mark support and resistance on three markets with bar replay.' },
      { week: 'Week 3', title: 'Protecting your money', lessons: ['Stop loss and take profit', 'Risk per trade and position sizing', 'Risk to reward, and why win rate is not everything', 'Trading psychology: fear, greed and revenge trading'], practice: 'Size five demo trades with the Risk Calculator.' },
      { week: 'Week 4', title: 'News and your first plan', lessons: ['Why the news moves prices: an introduction to fundamentals', 'Reading the economic calendar', 'Building a simple written trading plan', 'Journalling and reviewing your trades'], practice: 'Take ten demo trades from your plan and log them in the Journal.' },
    ],
    tools: [T.charts, T.risk, T.journal, T.markets],
  },
  {
    slug: 'intermediate-strategy-and-risk',
    title: 'Intermediate: Strategy and Risk',
    short: 'Build a real strategy with price action and market structure, test it, and manage risk like a professional.',
    level: 'Intermediate',
    weeks: 6,
    price: { onlineNgn: 70000, onlineUsd: 55, physicalNgn: 95000 },
    forWho: 'Traders who know the basics and want a tested strategy and a disciplined routine.',
    outcomes: [
      'Read market structure across timeframes',
      'Trade supply and demand zones and key levels with confirmation',
      'Combine technicals with the news calendar',
      'Backtest a strategy before risking money',
      'Manage a trade from entry to exit with a clear plan',
    ],
    outline: [
      { week: 'Week 1', title: 'Market structure', lessons: ['Highs, lows, trends and ranges', 'Break of structure and change of character', 'Multi-timeframe analysis: top-down from daily to entry timeframe'], practice: 'Label structure on five charts with bar replay.' },
      { week: 'Week 2', title: 'Supply, demand and key levels', lessons: ['Drawing supply and demand zones that matter', 'Support and resistance flips', 'Candle confirmation at a level'], practice: 'Use the Market Scanner to find zones and check them by hand.' },
      { week: 'Week 3', title: 'Indicators that help, and ones that do not', lessons: ['Moving averages for trend', 'RSI and MACD for momentum', 'Using an indicator as a filter, not a signal'], practice: 'Build a trend filter with the Indicator Builder.' },
      { week: 'Week 4', title: 'Fundamentals for the technical trader', lessons: ['High-impact news and when not to trade', 'Interest rates and the bigger trend', 'Reading a result versus forecast'], practice: 'Plan a week of trades around the economic calendar.' },
      { week: 'Week 5', title: 'Testing your strategy', lessons: ['Writing rules clearly enough to test', 'Backtesting and what the numbers mean', 'Why a backtest is not a promise'], practice: 'Backtest your strategy in the Bot Builder.' },
      { week: 'Week 6', title: 'Risk and trade management', lessons: ['Fixed fractional risk and drawdown limits', 'Moving stops, partial profits and break-even', 'Your personal trading plan and review routine'], practice: 'Two weeks of demo trading with the Journal.' },
    ],
    tools: [T.charts, T.scan, T.ind, T.bot, T.risk, T.journal, T.markets],
  },
  {
    slug: 'pro-advanced-strategy',
    title: 'Pro: Advanced Strategy and Live Practice',
    short: 'Smart money concepts, deeper fundamentals, automation and supervised live practice on the trading floor.',
    level: 'Advanced',
    weeks: 8,
    price: { onlineNgn: 140000, onlineUsd: 105, physicalNgn: 190000 },
    forWho: 'Traders with a working routine who want advanced concepts, automation and mentored practice.',
    outcomes: [
      'Use ICT and SMC concepts with a clear set of rules',
      'Build a weekly fundamental outlook for the markets you trade',
      'Turn your strategy into a tested bot and indicator',
      'Prepare for prop firm challenges with a risk plan',
      'Review your own trading with data, not feelings',
    ],
    outline: [
      { week: 'Week 1', title: 'Liquidity and smart money concepts', lessons: ['Liquidity pools and sweeps', 'Order blocks and fair value gaps', 'Premium, discount and optimal trade entry'] },
      { week: 'Week 2', title: 'Building an advanced setup', lessons: ['Higher-timeframe bias with lower-timeframe entry', 'Session timing: London and New York', 'A complete, testable rule set'], practice: 'Find your setup with the Market Scanner every day this week.' },
      { week: 'Week 3', title: 'Advanced fundamentals', lessons: ['Central bank policy and rate expectations', 'Inflation, jobs and growth together', 'Geopolitics, risk-on and risk-off'], practice: 'Write a weekly outlook using Ask MarkIQ.' },
      { week: 'Week 4', title: 'Correlation and gold', lessons: ['The dollar, yields and gold', 'Correlated pairs and doubled risk', 'Trading around big releases safely'] },
      { week: 'Week 5', title: 'Automation', lessons: ['Turning your rules into a bot with no code', 'Building your own indicator', 'Exporting to MT5 and TradingView'], practice: 'Build and backtest your setup as a bot.' },
      { week: 'Week 6', title: 'Testing properly', lessons: ['Out-of-sample testing and over-fitting', 'Demo forward testing for 2 to 4 weeks', 'Deciding when, or if, to go live'] },
      { week: 'Week 7', title: 'Prop firm preparation', lessons: ['Daily loss and total drawdown rules', 'A risk plan that survives a bad week', 'Tracking a challenge day by day'], practice: 'Run a mock challenge with the Prop Challenge Tracker.' },
      { week: 'Week 8', title: 'Supervised practice and review', lessons: ['Mentored sessions on the trading floor or online', 'Reviewing your journal statistics', 'Your next 90 days'] },
    ],
    tools: [T.scan, T.bot, T.ind, T.prop, T.journal, T.markets],
  },
  {
    slug: 'full-path',
    title: 'Full Path: Beginner to Pro',
    short: 'All three levels together, from your first chart to automation and supervised practice, at a lower price.',
    level: 'Beginner to advanced',
    weeks: 18,
    price: { onlineNgn: 200000, onlineUsd: 150, physicalNgn: 270000 },
    forWho: 'Anyone who wants the complete journey with one enrolment.',
    outcomes: ['Everything in Beginner, Intermediate and Pro', 'Cheaper than buying the three separately', 'One mentor relationship from start to finish'],
    outline: [
      { week: 'Weeks 1 to 4', title: 'Beginner: Market Foundations', lessons: ['How markets work', 'Reading a chart', 'Protecting your money', 'News and your first plan'] },
      { week: 'Weeks 5 to 10', title: 'Intermediate: Strategy and Risk', lessons: ['Market structure', 'Supply, demand and key levels', 'Indicators as filters', 'Fundamentals for technical traders', 'Testing your strategy', 'Risk and trade management'] },
      { week: 'Weeks 11 to 18', title: 'Pro: Advanced Strategy and Live Practice', lessons: ['Liquidity and smart money concepts', 'Advanced setups and sessions', 'Advanced fundamentals and gold', 'Automation and proper testing', 'Prop firm preparation', 'Supervised practice and review'] },
    ],
    tools: [T.charts, T.scan, T.ind, T.bot, T.risk, T.prop, T.journal, T.markets],
    bundle: ['beginner-market-foundations', 'intermediate-strategy-and-risk', 'pro-advanced-strategy'],
  },
  {
    slug: 'fundamental-analysis',
    title: 'Fundamental Analysis',
    short: 'Understand why markets move: news, inflation, jobs, interest rates and geopolitics, in plain words.',
    level: 'Beginner to intermediate',
    weeks: 3,
    price: { onlineNgn: 30000, onlineUsd: 25, physicalNgn: 40000 },
    forWho: 'Any trader who looks at the calendar and does not know what the numbers mean for price.',
    outcomes: ['Read the economic calendar with confidence', 'Explain how a result moves a currency or gold', 'Follow central banks and interest rates', 'Avoid getting caught by big releases'],
    outline: [
      { week: 'Week 1', title: 'The economy and the market', lessons: ['Inflation, jobs and growth', 'Forecast, previous and actual: what a surprise means', 'Reading the MarkIQ SI calendar and results'], practice: 'Follow three big releases with Telegram alerts.' },
      { week: 'Week 2', title: 'Central banks and interest rates', lessons: ['Why rates drive currencies', 'Rate decisions, statements and speeches', 'Rate differences between countries'], practice: 'Compare two currencies with Ask MarkIQ.' },
      { week: 'Week 3', title: 'Geopolitics and trading the news', lessons: ['Wars, elections, sanctions and trade', 'Risk-on, risk-off and safe havens like gold', 'Trading before, during and after news safely'], practice: 'Write your own weekly outlook.' },
    ],
    tools: [T.markets, T.scan, T.risk],
  },
  {
    slug: 'trading-automation',
    title: 'Trading Automation: Strategy to Tested Bot',
    short: 'Turn your strategy into a bot and your own indicators with no code, test them properly, and deploy to MT5 or TradingView.',
    level: 'Intermediate to advanced',
    weeks: 5,
    price: { onlineNgn: 60000, onlineUsd: 45, physicalNgn: 80000 },
    forWho: 'Traders with a strategy who want to automate it, and anyone tired of paying for bots that promise profit. Bring a laptop.',
    outcomes: ['Write strategy rules a computer can follow', 'Build your own bot and indicators with no coding', 'Read a backtest report honestly', 'Install your bot on MT5 and your indicator on TradingView', 'Know why no bot can guarantee profit'],
    outline: [
      { week: 'Week 1', title: 'From idea to rules', lessons: ['Why most bought bots fail', 'Clear entry, exit and risk rules', 'Describing a strategy so it can be built'], practice: 'Write your strategy in plain words.' },
      { week: 'Week 2', title: 'Building indicators', lessons: ['Moving averages, RSI, MACD and more', 'Signal arrows and alerts', 'Exporting to TradingView Pine Script and MT5'], practice: 'Build an indicator and add it to TradingView.' },
      { week: 'Week 3', title: 'Building the bot', lessons: ['Entries, confirmations, filters and sessions', 'Stops, targets and risk limits', 'MT5 Expert Advisors and Pine Script strategies'], practice: 'Build your bot in the Bot Builder.' },
      { week: 'Week 4', title: 'Testing properly', lessons: ['Backtests and what the report card means', 'Over-fitting and out-of-sample checks', 'Demo forward testing for 2 to 4 weeks'], practice: 'Backtest on two markets and compare.' },
      { week: 'Week 5', title: 'Going live safely', lessons: ['Installing an EA on MT5 step by step', 'Running on a VPS', 'Daily loss limits and when to switch a bot off'], practice: 'Run your bot on a demo account.' },
    ],
    tools: [T.bot, T.ind, T.charts, T.risk],
  },
  {
    slug: 'prop-firm-preparation',
    title: 'Prop Firm Challenge Preparation',
    short: 'Understand prop firm rules and build a risk plan that respects daily and total loss limits.',
    level: 'Intermediate',
    weeks: 3,
    price: { onlineNgn: 40000, onlineUsd: 30, physicalNgn: 55000 },
    forWho: 'Traders planning a prop firm challenge. No course can promise you will pass.',
    outcomes: ['Understand how challenges and funded accounts work', 'Build a risk plan around daily and total loss limits', 'Track a challenge day by day', 'Know the common reasons people fail'],
    outline: [
      { week: 'Week 1', title: 'How prop firms work', lessons: ['Challenges, phases and funded accounts', 'Daily loss, total drawdown and consistency rules', 'Choosing a firm and reading its rules'] },
      { week: 'Week 2', title: 'Your risk plan', lessons: ['Risk per trade for a challenge', 'Surviving a losing streak', 'News rules and weekend holding'], practice: 'Set up the Prop Challenge Tracker with your firm\'s rules.' },
      { week: 'Week 3', title: 'Execution and review', lessons: ['Daily routine during a challenge', 'When to stop for the day', 'Reviewing your journal'], practice: 'Run a two-week mock challenge on demo.' },
    ],
    tools: [T.prop, T.risk, T.journal, T.bot],
  },
  {
    slug: 'risk-management',
    title: 'Risk Management and Trading Psychology',
    short: 'The skill that keeps traders in the game: position sizing, stop losses and discipline.',
    level: 'All levels',
    weeks: 2,
    price: { onlineNgn: 20000, onlineUsd: 15, physicalNgn: 28000 },
    forWho: 'Every trader, at any level.',
    outcomes: ['Size every position correctly', 'Place stops that make sense', 'Control fear, greed and revenge trading', 'Keep a journal that improves your trading'],
    outline: [
      { week: 'Week 1', title: 'Risk', lessons: ['Position sizing', 'Stop losses and risk to reward', 'Drawdown and how to recover'], practice: 'Size ten trades with the Risk Calculator.' },
      { week: 'Week 2', title: 'Psychology', lessons: ['Fear, greed and overtrading', 'Rules for bad days', 'Journalling and review'], practice: 'Journal every demo trade for a week.' },
    ],
    tools: [T.risk, T.journal],
  },
];

export function findCourse(slug: string) {
  return COURSES.find((c) => c.slug === slug) || null;
}
