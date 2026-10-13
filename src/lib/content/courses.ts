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
export const LAUNCH = { discount: 0, endsOn: '' as string };

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
    price: { onlineNgn: 50000, onlineUsd: 35, physicalNgn: 70000 },
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
    slug: 'intermediate-forex-analysis',
    title: 'Intermediate: Forex Market Analysis',
    short: 'Read the forex market like a professional: technical analysis and fundamental analysis together, with a tested plan and solid risk management.',
    level: 'Intermediate',
    weeks: 6,
    price: { onlineNgn: 70000, onlineUsd: 50, physicalNgn: 100000 },
    forWho: 'Traders who know the basics and want to understand both the chart and the news behind it, then trade with a tested plan.',
    outcomes: [
      'Read market structure across timeframes',
      'Trade supply and demand zones and key levels with confirmation',
      'Read the economic calendar and know how inflation, jobs and interest rates move currencies and gold',
      'Combine technical setups with the fundamental picture',
      'Backtest a strategy and manage every trade with a clear plan',
    ],
    outline: [
      { week: 'Week 1', title: 'Market structure', lessons: ['Highs, lows, trends and ranges', 'Break of structure and change of character', 'Multi-timeframe analysis: top-down from daily to entry timeframe'], practice: 'Label structure on five charts with bar replay.' },
      { week: 'Week 2', title: 'Supply, demand and key levels', lessons: ['Drawing supply and demand zones that matter', 'Support and resistance flips', 'Candle confirmation at a level', 'Indicators as filters: moving averages, RSI and MACD'], practice: 'Use the Market Scanner to find zones and check them by hand.' },
      { week: 'Week 3', title: 'Fundamental analysis: the economic data', lessons: ['Inflation, jobs and growth, and why they move currencies', 'Forecast, previous and actual: what a surprise means', 'Reading the economic calendar and high-impact news'], practice: 'Follow three big releases with Telegram alerts and note how price reacted.' },
      { week: 'Week 4', title: 'Fundamental analysis: central banks and interest rates', lessons: ['Why interest rates drive the forex market', 'Rate decisions, statements and speeches', 'Rate differences between countries, the dollar and gold', 'Geopolitics, risk-on and risk-off'], practice: 'Compare two currencies with Ask MarkIQ and write a short outlook.' },
      { week: 'Week 5', title: 'Putting technical and fundamental together', lessons: ['Trading with the fundamental bias', 'When not to trade: big news and thin markets', 'Writing rules clearly enough to test', 'Backtesting and what the numbers mean'], practice: 'Backtest your strategy in the Bot Builder.' },
      { week: 'Week 6', title: 'Risk and trade management', lessons: ['Fixed fractional risk and drawdown limits', 'Moving stops, partial profits and break-even', 'Your personal trading plan and review routine'], practice: 'Two weeks of demo trading with the Journal.' },
    ],
    tools: [T.charts, T.scan, T.ind, T.bot, T.risk, T.journal, T.markets],
  },
  {
    slug: 'pro-forex-trader',
    title: 'Pro: Complete Forex Trader Program',
    short: 'Everything in one programme: market foundations, risk management and psychology, technical and fundamental analysis, trading automation and prop firm preparation, with supervised live practice.',
    level: 'Beginner to advanced',
    weeks: 18,
    price: { onlineNgn: 200000, onlineUsd: 150, physicalNgn: 250000 },
    forWho: 'Anyone who wants the complete journey with one enrolment, from first chart to building bots and preparing for a prop firm challenge.',
    outcomes: [
      'Understand how forex, gold, indices and crypto markets work',
      'Manage risk and control your trading psychology',
      'Read charts with technical analysis, including smart money concepts',
      'Understand the news, interest rates and data behind price with fundamental analysis',
      'Build and test your own trading bots and indicators with no coding',
      'Prepare for a prop firm challenge with a risk plan that respects the rules',
      'Practise under supervision on the trading floor or online',
    ],
    outline: [
      { week: 'Weeks 1 to 3', title: 'Market foundations', lessons: ['How forex, gold, oil, indices and crypto work', 'Brokers, spreads, pips, lots, leverage and trading sessions', 'Candlesticks, timeframes, trends, support and resistance', 'Spotting scams and fake "guaranteed profit" offers'], practice: 'Open a demo account and mark key levels with bar replay.' },
      { week: 'Weeks 4 to 5', title: 'Risk management and trading psychology', lessons: ['Position sizing, stop losses and risk to reward', 'Drawdown and how to recover', 'Fear, greed, overtrading and revenge trading', 'Journalling and reviewing your trades'], practice: 'Size every demo trade with the Risk Calculator and log it in the Journal.' },
      { week: 'Weeks 6 to 8', title: 'Technical analysis', lessons: ['Market structure and multi-timeframe analysis', 'Supply and demand zones and key levels', 'Indicators as filters', 'Smart money concepts: liquidity, order blocks, fair value gaps and OTE'], practice: 'Find your setups with the Market Scanner every day.' },
      { week: 'Weeks 9 to 11', title: 'Fundamental analysis', lessons: ['Inflation, jobs, growth and the economic calendar', 'Central banks and interest rates', 'The dollar, yields and gold', 'Geopolitics and trading the news safely'], practice: 'Write a weekly outlook using Ask MarkIQ.' },
      { week: 'Weeks 12 to 14', title: 'Trading automation', lessons: ['Turning your rules into a bot with no code', 'Building your own indicators', 'Backtesting, out-of-sample checks and demo forward testing', 'Installing on MT5 and TradingView'], practice: 'Build and backtest your own strategy as a bot.' },
      { week: 'Weeks 15 to 16', title: 'Prop firm challenge preparation', lessons: ['How challenges, phases and funded accounts work', 'Daily loss and total drawdown rules', 'A risk plan that survives a bad week'], practice: 'Run a mock challenge with the Prop Challenge Tracker.' },
      { week: 'Weeks 17 to 18', title: 'Supervised practice and review', lessons: ['Mentored sessions on the trading floor or online', 'Reviewing your journal statistics', 'Your next 90 days'] },
    ],
    tools: [T.charts, T.scan, T.ind, T.bot, T.risk, T.prop, T.journal, T.markets],
    bundle: ['beginner-market-foundations', 'intermediate-forex-analysis', 'fundamental-analysis', 'trading-automation'],
  },
  {
    slug: 'fundamental-analysis',
    title: 'Fundamental Analysis',
    short: 'Understand why markets move: news, inflation, jobs, interest rates and geopolitics, in plain words.',
    level: 'Beginner to intermediate',
    weeks: 3,
    price: { onlineNgn: 50000, onlineUsd: 35, physicalNgn: 50000 },
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
    price: { onlineNgn: 60000, onlineUsd: 45, physicalNgn: 100000 },
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
];

/** Courses that were renamed or merged keep working at their old addresses. */
export const OLD_SLUGS: Record<string, string> = {
  'intermediate-strategy-and-risk': 'intermediate-forex-analysis',
  'pro-advanced-strategy': 'pro-forex-trader',
  'full-path': 'pro-forex-trader',
  // Taught inside the Pro programme now, no longer sold on their own.
  'prop-firm-preparation': 'pro-forex-trader',
  'risk-management': 'pro-forex-trader',
};

export function findCourse(slug: string) {
  const s = OLD_SLUGS[slug] || slug;
  return COURSES.find((c) => c.slug === s) || null;
}
