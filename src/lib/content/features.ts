/**
 * Content for the dedicated explainer pages (one per major feature) so Google, Bing and AI
 * assistants can find and describe each thing MarkIQ SI does. Every statement here must match
 * what the product really does today: no invented features, results or prices.
 */
export type Faq = { q: string; a: string };
export type FeatureSection = { heading: string; intro?: string; items: { title: string; text: string }[] };

export type FeaturePageContent = {
  slug: string;
  /** Page <title> (the site template appends " · MarkIQ SI"). */
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  lead: string;
  cta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  sections: FeatureSection[];
  stepsHeading?: string;
  steps?: string[];
  note: string;
  faqs: Faq[];
  related: { href: string; label: string; text: string }[];
  schema:
    | { kind: 'software'; name: string; category: string }
    | { kind: 'academy' }
    | { kind: 'guide' };
};

const DISCLAIMER = 'MarkIQ SI provides education and market information, not financial advice. Trading carries a high risk of loss.';

export const FEATURE_PAGES: Record<string, FeaturePageContent> = {
  'fundamental-analysis': {
    slug: 'fundamental-analysis',
    title: 'Fundamental Analysis for Forex, Gold and Crypto Traders',
    description: 'Understand why markets move. MarkIQ SI explains news, inflation, jobs data, interest rates and geopolitics in plain words, from official data, with Telegram alerts.',
    eyebrow: 'Fundamental analysis',
    h1: 'Fundamental analysis, explained in plain words',
    lead: 'Most traders know they should follow the news but not what it means for price. MarkIQ SI puts the official numbers, the interest-rate picture and a plain explanation in one place, so you can see why a market is moving.',
    cta: { label: 'Open the Markets page', href: '/markets' },
    secondaryCta: { label: 'Create a free account', href: '/get-started' },
    sections: [
      {
        heading: 'What you get',
        items: [
          { title: "This week's big events", text: 'An economic calendar for the US, UK, Euro area, Japan, China, Canada and Australia, with the results as soon as they are released.' },
          { title: 'Official numbers, never guesses', text: 'Figures come from official sources such as the US Bureau of Labor Statistics and central banks, dated and sourced. AI is used to explain the data, never to invent it.' },
          { title: 'Interest rates and central banks', text: 'See where central bank interest rates stand and follow central bank broadcasts, so you understand what the market is reacting to.' },
          { title: 'News in plain words', text: 'Headlines explained simply, including geopolitics: wars, elections, sanctions and trade.' },
          { title: 'Ask MarkIQ', text: 'Ask why a currency pair or asset is moving and get the fundamentals behind it, including the history. Ask MarkIQ is in beta.' },
          { title: 'Chart Analysis', text: 'Upload a screenshot of your chart and get the structure and key levels from real price data, the news behind the move and possible scenarios. In beta.' },
          { title: 'Telegram alerts', text: 'A heads-up before a big release, and again when the official result is out, sent straight to Telegram.' },
        ],
      },
      {
        heading: 'Why fundamentals feel hard, and what we do about it',
        intro: 'A calendar gives you numbers without meaning. News is scattered and full of opinion. MarkIQ SI shows the official figure, what the central bank is doing and a plain explanation together, so you spend your time understanding the market and not hunting for information.',
        items: [
          { title: 'Learn it properly', text: 'The Fundamental Analysis track covers how news, inflation and jobs data move markets, central banks and interest rates, geopolitics, and how to trade the news safely.' },
          { title: 'Works for every market we cover', text: 'Forex, gold and oil, stock indices and crypto.' },
        ],
      },
    ],
    stepsHeading: 'How to use it',
    steps: ['Open the Markets page and look at this week\'s big events.', 'Read the plain-words explanation of any result.', 'Ask MarkIQ about a pair or asset you trade.', 'Create a free account to get Telegram alerts before and after big news.'],
    note: DISCLAIMER,
    faqs: [
      { q: 'What is fundamental analysis in forex?', a: 'Fundamental analysis studies the economic forces behind price: interest rates, inflation, jobs data, growth, central bank decisions and geopolitics. Traders use it to understand why a currency, gold or another market is moving, instead of looking only at the chart.' },
      { q: 'Where does MarkIQ SI get its data?', a: 'Numbers come from official sources such as the US Bureau of Labor Statistics and central banks, and are dated and sourced.' },
      { q: 'Does the AI make up numbers?', a: 'No. AI is used to explain data that comes from official sources. It is never used to invent figures.' },
      { q: 'Can I learn fundamental analysis on its own?', a: 'Yes. Fundamental Analysis is one of the four MarkIQ SI learning tracks, alongside Risk Management, Technical Analysis and Trading Automation.' },
    ],
    related: [
      { href: '/markets', label: 'Markets', text: 'Events, rates, results and news in plain words.' },
      { href: '/academy', label: 'Academy', text: 'Learn it in class in Abeokuta or online.' },
      { href: '/market-scanner', label: 'Market Scanner', text: 'See setups with the news and rates beside them.' },
    ],
    schema: { kind: 'guide' },
  },

  'bot-builder': {
    slug: 'bot-builder',
    title: 'No-Code Trading Bot Builder: Build, Backtest, Then Go Live',
    description: 'Build your own trading bot without coding. Describe your strategy in plain words, get an MT5 Expert Advisor and TradingView Pine Script, backtest it, then test on demo before going live.',
    eyebrow: 'Bot Builder',
    h1: 'Build your own trading bot, with no coding',
    lead: 'Do not pay for a bot that promises profit. Describe your strategy in plain words, see the exact rules, test it on past data, and only then run it on a demo account.',
    cta: { label: 'Open the Bot Builder', href: '/tools?tool=bot' },
    secondaryCta: { label: 'Learn trading automation', href: '/academy' },
    sections: [
      {
        heading: 'What makes it different',
        items: [
          { title: 'No coding needed', text: 'Write your strategy like you would explain it to a friend. The Bot Builder turns it into working code for you.' },
          { title: 'You see the rules', text: 'Before anything is built you check the exact rules the Bot Builder understood and fix anything that is unclear. Nothing is hidden.' },
          { title: 'Backtest before you risk money', text: 'Watch your strategy replay on past prices, with entries, stop losses and take profits marked on the chart, then read a report card with the results.' },
          { title: 'Risk limits built in', text: 'Add risk limits such as a daily loss limit, and a trade size that suits your account.' },
          { title: 'MT5 and TradingView', text: 'Get an MT5 Expert Advisor (MQL5) and a TradingView Pine Script strategy from the same description.' },
          { title: 'Demo first, live later', text: 'The recommended path is a demo account for at least 2 to 4 weeks, a small trade size and a daily loss limit before any real money.' },
        ],
      },
    ],
    stepsHeading: 'How it works',
    steps: ['Describe your strategy in plain words.', 'Check the rules the Bot Builder understood and fix anything unclear.', 'Get your MT5 Expert Advisor and TradingView Pine Script strategy.', 'Backtest it on past data and watch the replay.', 'Run it on a demo account for 2 to 4 weeks.', 'When you are ready, deploy it to your own MT5.'],
    note: 'No trading bot, bought or built, can guarantee profit. A backtest shows how your rules would have done on past prices, not what will happen next. Always test on a demo account first. The Bot Builder is in beta. ' + DISCLAIMER,
    faqs: [
      { q: 'Can I build a trading bot without coding?', a: 'Yes. You describe your strategy in plain words, check the rules the Bot Builder understood, and it generates the code for you.' },
      { q: 'What does the Bot Builder create?', a: 'An MT5 Expert Advisor written in MQL5 and a TradingView Pine Script (v6) strategy, with risk limits, from the same description.' },
      { q: 'Should I buy a trading bot that promises profit?', a: 'No trading bot can promise profit, and you should be careful with any seller who does. Building your own means you can see every rule and test it on past data and a demo account before you risk money.' },
      { q: 'What is backtesting?', a: 'Backtesting runs your trading rules on historical prices to see how they would have performed. It helps you spot weak ideas early. It does not predict future results.' },
      { q: 'Does the Bot Builder cost money?', a: 'The tools on MarkIQ SI are free to use.' },
    ],
    related: [
      { href: '/indicator-builder', label: 'Indicator Builder', text: 'Build your own indicators with no code.' },
      { href: '/prop-firm-tools', label: 'Prop firm tools', text: 'Keep a bot inside daily and total loss limits.' },
      { href: '/academy', label: 'Academy', text: 'Learn Pine Script and MQL5 in the Trading Automation track.' },
    ],
    schema: { kind: 'software', name: 'MarkIQ SI Bot Builder', category: 'FinanceApplication' },
  },

  'indicator-builder': {
    slug: 'indicator-builder',
    title: 'No-Code Indicator Builder for TradingView and MT5',
    description: 'Build your own trading indicator without coding. Describe it in plain words, see it on a real chart with years of history, then add it to TradingView (Pine Script) or MT5. Free.',
    eyebrow: 'Indicator Builder',
    h1: 'Build your own trading indicator, with no coding',
    lead: 'Describe the indicator you want, like "20 and 50 EMA with arrows when they cross, only with the 200 EMA trend". See it drawn on a real chart with years of history, then add it to TradingView or MT5 in a few clicks.',
    cta: { label: 'Open the Indicator Builder', href: '/tools?tool=indicator' },
    secondaryCta: { label: 'Build a bot instead', href: '/bot-builder' },
    sections: [
      {
        heading: 'What you can build',
        items: [
          { title: 'Lines on the chart', text: 'EMA, SMA, Bollinger Bands, Supertrend and Donchian channels, up to six at once.' },
          { title: 'A lower panel', text: 'RSI, MACD or Stochastic with your own levels.' },
          { title: 'Buy and sell arrows', text: 'Arrows from crosses, RSI, Bollinger Bands, supply and demand, support and resistance, candle patterns, fair value gaps, order blocks, break of structure, liquidity sweeps and more.' },
          { title: 'Filters', text: 'Only after a confirmation, only with the 200 EMA trend, or only in the London and New York sessions.' },
          { title: 'Alerts', text: 'Turn on alerts so TradingView or MT5 tells you when an arrow appears.' },
          { title: 'Test it before you trust it', text: 'Scroll years of real history on the MarkIQ SI chart and check every arrow, then paste it into TradingView and check it there too.' },
        ],
      },
    ],
    stepsHeading: 'How it works',
    steps: ['Describe your indicator in plain words.', 'Check what it will draw and change anything you want.', 'See it on a real chart for any market and timeframe.', 'Copy it into TradingView or download it for MT5.'],
    note: 'An indicator shows information. It does not place trades, and arrows on past candles do not guarantee future results. The Indicator Builder is in beta. ' + DISCLAIMER,
    faqs: [
      { q: 'Can I create a TradingView indicator without coding?', a: 'Yes. Describe it in plain words and MarkIQ SI writes the Pine Script v6 code for you. Copy it into the TradingView Pine Editor and press Add to chart.' },
      { q: 'Does it work with MT5?', a: 'Yes. Download the .mq5 file, put it in the MQL5 Indicators folder, compile it in MetaEditor and drag it onto a chart. Lower-panel oscillators use MT5\'s built-in RSI, MACD or Stochastic.' },
      { q: 'Do I need an account?', a: 'No. You can build, preview and export without an account. A free account lets you save your indicators.' },
      { q: 'Is it free?', a: 'Yes, the Indicator Builder is free to use, with a fair daily limit on AI help.' },
    ],
    related: [
      { href: '/bot-builder', label: 'Bot Builder', text: 'Turn the same rules into a tested bot.' },
      { href: '/market-scanner', label: 'Market Scanner', text: 'Find the setups across many markets.' },
      { href: '/courses/trading-automation', label: 'Automation course', text: 'Learn to build and test properly.' },
    ],
    schema: { kind: 'software', name: 'MarkIQ SI Indicator Builder', category: 'FinanceApplication' },
  },

  'market-scanner': {
    slug: 'market-scanner',
    title: 'Market Scanner: Supply and Demand, ICT, SMC and Candle Patterns',
    description: 'Scan forex, gold, oil, indices and crypto from 1 minute to monthly for supply and demand zones, ICT and SMC setups, candle patterns and indicators, with optional Telegram alerts.',
    eyebrow: 'Market Scanner',
    h1: 'Scan the markets for the setups you trade',
    lead: 'Pick your strategies and let the scanner watch many markets and timeframes. Every result also shows the news coming up and the interest-rate picture, so you see the setup and the context together.',
    cta: { label: 'Open the Market Scanner', href: '/tools?tool=scan' },
    secondaryCta: { label: 'Create a free account', href: '/get-started' },
    sections: [
      {
        heading: 'What it can scan for',
        items: [
          { title: 'Price action', text: 'Supply and demand zones, support and resistance, and candle patterns.' },
          { title: 'ICT and SMC', text: 'Fair value gaps, order blocks, break of structure, liquidity sweeps and OTE setups.' },
          { title: 'Classic indicators', text: 'EMA, RSI, MACD, Bollinger Bands, Stochastic, Supertrend, breakouts and trend pullbacks.' },
        ],
      },
      {
        heading: 'Built for how you actually trade',
        items: [
          { title: 'Every timeframe', text: 'From 1 minute to monthly, with higher-timeframe confirmation.' },
          { title: 'Five market groups', text: 'Forex, gold and oil, stock indices, stocks and crypto.' },
          { title: 'News beside every setup', text: 'Each result shows upcoming news and the interest-rate picture, so you do not trade into a big release by accident.' },
          { title: 'Telegram alerts', text: 'Turn on optional alerts and get notified when a setup you chose appears.' },
        ],
      },
    ],
    note: 'The Market Scanner highlights setups for you to review. It does not tell you to buy or sell, and it is in beta. ' + DISCLAIMER,
    faqs: [
      { q: 'What is a market scanner?', a: 'A market scanner checks many markets and timeframes automatically and shows you the ones where a setup you care about has appeared, so you do not have to flip through charts by hand.' },
      { q: 'Which strategies can the MarkIQ SI Market Scanner find?', a: 'Supply and demand zones, support and resistance, candle patterns, ICT and SMC setups (fair value gaps, order blocks, break of structure, liquidity sweeps, OTE), and classic indicators such as EMA, RSI, MACD, Bollinger Bands, Stochastic and Supertrend.' },
      { q: 'Does the scanner send alerts?', a: 'Yes, optional Telegram alerts for the setups you choose.' },
      { q: 'Does it give buy and sell signals?', a: 'No. It shows setups for you to judge. It is information, not advice.' },
    ],
    related: [
      { href: '/bot-builder', label: 'Bot Builder', text: 'Turn a setup into a tested bot.' },
      { href: '/fundamental-analysis', label: 'Fundamental analysis', text: 'Understand the news behind the move.' },
      { href: '/prop-firm-tools', label: 'Prop firm tools', text: 'Size the trade and watch your loss limits.' },
    ],
    schema: { kind: 'software', name: 'MarkIQ SI Market Scanner', category: 'FinanceApplication' },
  },

  'prop-firm-tools': {
    slug: 'prop-firm-tools',
    title: 'Prop Firm Challenge Tracker and Risk Calculator',
    description: 'Track your prop firm challenge profit target, daily loss and total loss room, size every trade with the Risk Calculator and add loss limits to your bot. Free tools.',
    eyebrow: 'Prop firm tools',
    h1: 'Stay inside your prop firm rules',
    lead: 'Daily loss and drawdown limits are where prop challenges are won or lost. These tools show your room before each trade, so you can size positions and protect your account.',
    cta: { label: 'Open the Prop Challenge Tracker', href: '/tools?tool=prop' },
    secondaryCta: { label: 'Open the Risk Calculator', href: '/tools?tool=risk' },
    sections: [
      {
        heading: 'Tools for a prop firm challenge',
        items: [
          { title: 'Prop Challenge Tracker', text: 'Enter your challenge rules and see the profit target still to reach, the daily loss room left and the total loss room left.' },
          { title: 'Risk Calculator', text: 'Get your position size from your account size, risk percent and stop loss, before you click buy or sell.' },
          { title: 'Bot Builder with loss limits', text: 'If you automate, build your bot with a daily loss limit and risk limits so it respects your rules.' },
          { title: 'Trading Journal', text: 'Log every trade, see your results on a calendar and find out what actually works.' },
          { title: 'Charts with bar replay', text: 'Practise on years of price history, one candle at a time, before you take the setup in a challenge.' },
          { title: 'Learn it in the Academy', text: 'Position sizing, stop losses, trading psychology and prop firm preparation are taught in the Pro: Complete Forex Trader Program.' },
        ],
      },
    ],
    note: 'No tool can guarantee that you pass a prop firm challenge, and every firm has its own rules, so always check yours. ' + DISCLAIMER,
    faqs: [
      { q: 'What is a prop firm challenge?', a: 'A prop firm challenge is an evaluation in which you trade under set rules, usually a profit target together with a daily loss limit and a maximum total loss, to qualify for a funded account. Rules differ between firms.' },
      { q: 'What does the Prop Challenge Tracker show?', a: 'The profit target you still have to reach, how much daily loss room you have left, and how much total loss room you have left.' },
      { q: 'Will these tools make me pass a challenge?', a: 'No. They help you see your limits and size trades sensibly. Passing depends on your trading and on your firm\'s rules.' },
      { q: 'Are the tools free?', a: 'Yes, the tools on MarkIQ SI are free to use.' },
    ],
    related: [
      { href: '/bot-builder', label: 'Bot Builder', text: 'Automate with a daily loss limit.' },
      { href: '/market-scanner', label: 'Market Scanner', text: 'Find setups across many markets.' },
      { href: '/courses/pro-forex-trader', label: 'Pro programme', text: 'Includes risk management and prop firm preparation.' },
    ],
    schema: { kind: 'software', name: 'MarkIQ SI Prop Challenge Tracker and Risk Calculator', category: 'FinanceApplication' },
  },

  academy: {
    slug: 'academy',
    title: 'MarkIQ SI Academy: Physical Trading Classes in Abeokuta',
    description: 'In-person trading classes and a trading floor in Oke-Ilewo, Abeokuta, plus virtual sessions. Learn risk management, technical and fundamental analysis and trading automation.',
    eyebrow: 'MarkIQ SI Academy',
    h1: 'Learn to trade in person in Abeokuta',
    lead: 'MarkIQ SI Academy runs physical classes and a trading floor at 24 Majek Kembo Plaza, beside Chicken Republic, Oke-Ilewo, Abeokuta, with virtual sessions online. Four learning tracks take you from beginner to building your own trading bot.',
    cta: { label: 'See courses and prices', href: '/courses' },
    secondaryCta: { label: 'Ask on WhatsApp', href: 'whatsapp' },
    sections: [
      {
        heading: 'Four learning tracks',
        items: [
          { title: 'Risk Management (all levels)', text: 'Position sizing, stop losses that make sense, and trading psychology and discipline.' },
          { title: 'Technical Analysis (beginner to intermediate)', text: 'Candlesticks, reading charts, price action and market structure, and building your own trading plan.' },
          { title: 'Fundamental Analysis (beginner to intermediate)', text: 'How news, inflation and jobs data move markets, central banks and interest rates, geopolitics, and trading the news safely.' },
          { title: 'Trading Automation (intermediate to advanced)', text: 'Turn your strategy into a bot with Pine Script and MQL5, build and test it the right way, and deploy it to MT5.' },
        ],
      },
      {
        heading: 'Classes that fit you',
        items: [
          { title: 'Physical classes in Abeokuta', text: 'Learn in person with a mentor on our trading floor at 24 Majek Kembo Plaza, beside Chicken Republic, Oke-Ilewo, Abeokuta, Ogun State.' },
          { title: 'Virtual sessions', text: 'Join online if you are outside Abeokuta, and ask a mentor your questions.' },
          { title: 'Free tools alongside', text: 'Practise with the Risk Calculator, charts with bar replay, the Market Scanner, the Bot Builder and the Trading Journal.' },
        ],
      },
    ],
    note: 'Message or call +234 901 677 1255 to ask about the next class and how to join. ' + DISCLAIMER,
    faqs: [
      { q: 'Where are the MarkIQ SI Academy physical classes?', a: 'At 24 Majek Kembo Plaza, beside Chicken Republic, Oke-Ilewo, Abeokuta, Ogun State, Nigeria. Message us on WhatsApp for the next class date.' },
      { q: 'Can I join online instead?', a: 'Yes. The Academy also runs virtual sessions, so you can learn from anywhere.' },
      { q: 'What can I learn?', a: 'Four tracks: Risk Management, Technical Analysis, Fundamental Analysis and Trading Automation, from beginner to advanced.' },
      { q: 'Do I need experience?', a: 'No. The tracks start at beginner level.' },
      { q: 'How much are the courses?', a: 'Every course outline and its price, in Naira and US dollars, is on the Courses page at markiqsi.com/courses. Physical classes are priced in Naira.' },
      { q: 'How do I enrol?', a: 'Choose a course on the Courses page, sign in with your email and enrol. You can also message or call +234 901 677 1255.' },
    ],
    related: [
      { href: '/fundamental-analysis', label: 'Fundamental analysis', text: 'See how the news is explained in plain words.' },
      { href: '/bot-builder', label: 'Bot Builder', text: 'Build and backtest a bot with no coding.' },
      { href: '/prop-firm-tools', label: 'Prop firm tools', text: 'Track a challenge and size every trade.' },
    ],
    schema: { kind: 'academy' },
  },
};

export const FEATURE_ORDER = ['fundamental-analysis', 'bot-builder', 'indicator-builder', 'market-scanner', 'prop-firm-tools', 'academy'] as const;
