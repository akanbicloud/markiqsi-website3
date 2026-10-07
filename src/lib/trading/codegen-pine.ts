import type { Rules } from './botspec';
import { fullParams } from './botspec';
import { KIND_ID } from './codegen-mql5';

/**
 * Pine Script v6 version of the MarkIQ SI detection rules.
 * Offsets: [0] is the candle that just closed, [1] the one before, and so on.
 */
const ENGINE = String.raw`
atrS = ta.atr(14)
e20 = ta.ema(close, 20)
e50 = ta.ema(close, 50)
e200 = ta.ema(close, 200)
maF = maKind == 2 ? ta.sma(close, fastLen) : ta.ema(close, fastLen)
maS = maKind == 2 ? ta.sma(close, slowLen) : ta.ema(close, slowLen)
rsiV = ta.rsi(close, rsiLen)
[macdL, macdSig, macdH] = ta.macd(close, 12, 26, 9)
bbMid = ta.sma(close, bbLen)
bbDevS = ta.stdev(close, bbLen)
stK = ta.sma(ta.stoch(close, high, low, stochK), stochSmooth)
stD = ta.sma(stK, stochD)
[stLine, stDir] = ta.supertrend(stMult, stLen)
eTrend = ta.ema(close, trendLen)
ePull = ta.ema(close, pullEma)
crossMA = ta.crossover(maF, maS) ? 1 : ta.crossunder(maF, maS) ? -1 : 0
crossMACD = ta.crossover(macdL, macdSig) ? 1 : ta.crossunder(macdL, macdSig) ? -1 : 0
hiLB = ta.highest(high, lookback)[1]
loLB = ta.lowest(low, lookback)[1]

trendDir() =>
    e20 > e50 and close > e50 ? 1 : e20 < e50 and close < e50 ? -1 : 0
bodyAt(int o) =>
    math.abs(close[o] - open[o])
bullAt(int o) =>
    close[o] > open[o]
bearAt(int o) =>
    close[o] < open[o]
hiOf(int a, int b) =>
    float m = high[a]
    for o = a to b
        m := math.max(m, high[o])
    m
loOf(int a, int b) =>
    float m = low[a]
    for o = a to b
        m := math.min(m, low[o])
    m
isSH(int o, int s) =>
    bool ok = true
    for k = 1 to s
        if not (high[o] > high[o + k] and high[o] >= high[o - k])
            ok := false
    ok
isSL(int o, int s) =>
    bool ok = true
    for k = 1 to s
        if not (low[o] < low[o + k] and low[o] <= low[o - k])
            ok := false
    ok

detCandles() =>
    a = atrS
    int r = 0
    tr = trendDir()
    rng = high - low
    if bearAt(2) and bodyAt(2) > 0.6 * a and bodyAt(1) < 0.35 * bodyAt(2) and bullAt(0) and close > (open[2] + close[2]) / 2
        r := 1
    else if bullAt(2) and bodyAt(2) > 0.6 * a and bodyAt(1) < 0.35 * bodyAt(2) and bearAt(0) and close < (open[2] + close[2]) / 2
        r := -1
    else if bearAt(1) and bullAt(0) and open <= close[1] and close >= open[1] and bodyAt(0) > bodyAt(1) and bodyAt(0) > 0.4 * a
        r := 1
    else if bullAt(1) and bearAt(0) and open >= close[1] and close <= open[1] and bodyAt(0) > bodyAt(1) and bodyAt(0) > 0.4 * a
        r := -1
    else if rng > 0.6 * a and (math.min(open, close) - low) >= 2 * bodyAt(0) and (high - math.max(open, close)) <= 0.3 * rng and (math.min(open, close) - low) >= 0.55 * rng
        r := 1
    else if rng > 0.6 * a and (high - math.max(open, close)) >= 2 * bodyAt(0) and (math.min(open, close) - low) <= 0.3 * rng and (high - math.max(open, close)) >= 0.55 * rng
        r := -1
    else if high < high[1] and low > low[1] and tr != 0
        r := tr
    r

detSR() =>
    int r = 0
    a = atrS
    F = math.min(200, bar_index - 3)
    if not na(a) and F >= 4
        lp = array.new_float()
        lt = array.new_int()
        for o = F to 4
            for side = 0 to 1
                bool isSw = side == 0 ? isSH(o, 3) : isSL(o, 3)
                if isSw
                    float p = side == 0 ? high[o] : low[o]
                    int f = -1
                    if array.size(lp) > 0
                        for v = 0 to array.size(lp) - 1
                            if f == -1 and math.abs(array.get(lp, v) - p) <= 0.2 * a
                                f := v
                    if f >= 0
                        int t = array.get(lt, f)
                        array.set(lp, f, (array.get(lp, f) * t + p) / (t + 1))
                        array.set(lt, f, t + 1)
                    else
                        array.push(lp, p)
                        array.push(lt, 1)
        float best = na
        float bestD = 1e18
        if array.size(lp) > 0
            for v = 0 to array.size(lp) - 1
                lvl = array.get(lp, v)
                if array.get(lt, v) >= 2
                    int crosses = 0
                    lim = math.min(100, bar_index - 1)
                    for o = 1 to lim
                        if (close[o + 1] - lvl) * (close[o] - lvl) < 0
                            crosses += 1
                    touching = low <= lvl + 0.15 * a and high >= lvl - 0.15 * a
                    d = math.abs(close - lvl)
                    if crosses <= 4 and touching and d <= 0.6 * a and d < bestD
                        best := lvl
                        bestD := d
        if not na(best)
            r := close >= best ? 1 : -1
    r

detSD() =>
    int r = 0
    lim = math.min(150, bar_index - 20)
    if lim >= 4
        for k = 4 to lim
            if r == 0
                a = atrS[k - 1]
                if not na(a) and a > 0
                    m2o = math.max(k - 2, 1)
                    move2 = math.abs(close[m2o] - close[k])
                    strong = bodyAt(k - 1) >= 1.8 * a or move2 >= 2.5 * a
                    if strong and bodyAt(k) <= 0.6 * a
                        if bullAt(k - 1) and close[k - 1] > high[k]
                            top = math.max(open[k], close[k])
                            bot = low[k]
                            bool fresh = true
                            if k - 2 >= 1
                                for j = k - 2 to 1
                                    if low[j] <= top
                                        fresh := false
                            if fresh and low <= top and close >= bot
                                r := 1
                        if r == 0 and bearAt(k - 1) and close[k - 1] < low[k]
                            bot = math.min(open[k], close[k])
                            top = high[k]
                            bool fresh = true
                            if k - 2 >= 1
                                for j = k - 2 to 1
                                    if high[j] >= bot
                                        fresh := false
                            if fresh and high >= bot and close <= top
                                r := -1
    r

detFVG() =>
    int r = 0
    lim = math.min(60, bar_index - 2)
    if lim >= 2
        for m = 2 to lim
            if r == 0
                a = atrS[m]
                if not na(a) and a > 0
                    if low[m - 1] > high[m + 1] and low[m - 1] - high[m + 1] >= 0.3 * a
                        bot = high[m + 1]
                        top = low[m - 1]
                        bool used = false
                        if m - 2 >= 1
                            for j = m - 2 to 1
                                if low[j] <= top
                                    used := true
                        if not used and low <= top and close >= bot
                            r := 1
                    if r == 0 and high[m - 1] < low[m + 1] and low[m + 1] - high[m - 1] >= 0.3 * a
                        top = low[m + 1]
                        bot = high[m - 1]
                        bool used = false
                        if m - 2 >= 1
                            for j = m - 2 to 1
                                if high[j] >= bot
                                    used := true
                        if not used and high >= bot and close <= top
                            r := -1
    r

detOB() =>
    int r = 0
    lim = math.min(100, bar_index - 15)
    if lim >= 4
        for k = 4 to lim
            if r == 0
                ph = hiOf(k, k + 10)
                pl = loOf(k, k + 10)
                if bearAt(k)
                    int broke = -1
                    for j = k - 1 to math.max(k - 3, 1)
                        if broke == -1 and close[j] > ph
                            broke := j
                    if broke > 0
                        bool tapped = false
                        if broke - 1 >= 1
                            for j = broke - 1 to 1
                                if low[j] <= high[k]
                                    tapped := true
                        if not tapped and low <= high[k] and close >= low[k]
                            r := 1
                if r == 0 and bullAt(k)
                    int broke = -1
                    for j = k - 1 to math.max(k - 3, 1)
                        if broke == -1 and close[j] < pl
                            broke := j
                    if broke > 0
                        bool tapped = false
                        if broke - 1 >= 1
                            for j = broke - 1 to 1
                                if high[j] >= low[k]
                                    tapped := true
                        if not tapped and high >= low[k] and close <= high[k]
                            r := -1
    r

detBOS() =>
    int r = 0
    F = math.min(150, bar_index - 2)
    float h1 = na
    float l1 = na
    int hc = 0
    int lc = 0
    if F >= 2
        for o = 2 to F
            if isSH(o, 2)
                hc += 1
                if na(h1)
                    h1 := high[o]
            if isSL(o, 2)
                lc += 1
                if na(l1)
                    l1 := low[o]
    if hc >= 2 and lc >= 2
        if close > h1 and close[1] <= h1
            r := 1
        else if close < l1 and close[1] >= l1
            r := -1
    r

detLiq() =>
    int r = 0
    F = math.min(40, bar_index - 2)
    if F >= 3
        for o = 3 to F
            if r == 0 and isSH(o, 2)
                p = high[o]
                bool untouched = true
                for j = o - 1 to 1
                    if high[j] > p
                        untouched := false
                if untouched and high > p and close < p
                    r := -1
        if r == 0
            for o = 3 to F
                if r == 0 and isSL(o, 2)
                    p = low[o]
                    bool untouched = true
                    for j = o - 1 to 1
                        if low[j] < p
                            untouched := false
                    if untouched and low < p and close > p
                        r := 1
    r

detOTE() =>
    int r = 0
    a = atrS
    F = math.min(80, bar_index - 2)
    int lastT = 0
    float lastP = na
    int lastO = 0
    int prevT = 0
    float prevP = na
    if F >= 2 and not na(a)
        for o = 2 to F
            bool sh = isSH(o, 2)
            bool sl = isSL(o, 2)
            // newest first; when both, the low counts as the later swing (same as the website)
            if lastT == 0
                if sl
                    lastT := -1
                    lastP := low[o]
                    lastO := o
                    if sh
                        prevT := 1
                        prevP := high[o]
                else if sh
                    lastT := 1
                    lastP := high[o]
                    lastO := o
            else if prevT == 0
                if lastT == 1 and sl
                    prevT := -1
                    prevP := low[o]
                else if lastT == -1 and sh
                    prevT := 1
                    prevP := high[o]
    if prevT == -1 and lastT == 1 and lastP - prevP >= 3 * a
        if loOf(0, lastO - 1) >= prevP
            rr = (lastP - close) / (lastP - prevP)
            if rr >= 0.62 and rr <= 0.79
                r := 1
    if prevT == 1 and lastT == -1 and prevP - lastP >= 3 * a
        if hiOf(0, lastO - 1) <= prevP
            rr = (close - lastP) / (prevP - lastP)
            if rr >= 0.62 and rr <= 0.79
                r := -1
    r

detIBB() =>
    high[1] < high[2] and low[1] > low[2] ? (close > high[2] ? 1 : close < low[2] ? -1 : 0) : 0

detLondon() =>
    int r = 0
    h = hour(time, "UTC")
    if timeframe.in_seconds() <= 3600 and h >= 7 and h < 11
        d = dayofmonth(time, "UTC")
        float hi = na
        float lo = na
        int n = 0
        bool broken = false
        lim = math.min(400, bar_index - 1)
        for o = 1 to lim
            if dayofmonth(time[o], "UTC") != d
                break
            hh = hour(time[o], "UTC")
            if hh < 7
                hi := na(hi) ? high[o] : math.max(hi, high[o])
                lo := na(lo) ? low[o] : math.min(lo, low[o])
                n += 1
        for o = 1 to lim
            if dayofmonth(time[o], "UTC") != d
                break
            if hour(time[o], "UTC") >= 7 and not na(hi) and (close[o] > hi or close[o] < lo)
                broken := true
        if n >= 3 and not broken
            r := close > hi ? 1 : close < lo ? -1 : 0
    r

detect(int kind) =>
    int r = 0
    if bar_index >= 80
        r := switch kind
            1 => crossMA
            2 => crossMA
            3 => rsiV[1] < rsiLower and rsiV >= rsiLower ? 1 : rsiV[1] > rsiUpper and rsiV <= rsiUpper ? -1 : 0
            4 => crossMACD
            5 => close > hiLB ? 1 : close < loLB ? -1 : 0
            6 => close[1] < bbMid[1] - bbMult * bbDevS[1] and close > bbMid - bbMult * bbDevS ? 1 : close[1] > bbMid[1] + bbMult * bbDevS[1] and close < bbMid + bbMult * bbDevS ? -1 : 0
            7 => stK[1] <= stD[1] and stK > stD and math.min(stK[1], stD[1]) < 20 ? 1 : stK[1] >= stD[1] and stK < stD and math.max(stK[1], stD[1]) > 80 ? -1 : 0
            8 => stDir[1] > 0 and stDir < 0 ? 1 : stDir[1] < 0 and stDir > 0 ? -1 : 0
            9 => close > eTrend and ePull > eTrend and low <= ePull and close > ePull and close > open ? 1 : close < eTrend and ePull < eTrend and high >= ePull and close < ePull and close < open ? -1 : 0
            10 => detSD()
            11 => detSR()
            12 => detCandles()
            13 => detFVG()
            14 => detOB()
            15 => detBOS()
            16 => detLiq()
            17 => detOTE()
            18 => detIBB()
            19 => detLondon()
            => 0
    r
`;

export function toPine(r: Rules) {
  const p = fullParams(r.entry);
  const sess = { any: [0, 24], london: [7, 16], newyork: [12, 21], london_ny: [7, 21] }[r.session];
  const tf = { M1: '1-minute', M5: '5-minute', M15: '15-minute', M30: '30-minute', H1: '1-hour', H4: '4-hour', D1: 'daily', W1: 'weekly', MN1: 'monthly' }[r.timeframe];
  return `//@version=6
// ${r.name.replace(/[^\w\s-]/g, '')} - generated by MarkIQ SI Bot Builder
// Use on the ${r.symbol} ${tf} chart. Results on past data never guarantee future results.
strategy("${r.name.replace(/"/g, '')} (MarkIQ SI)", overlay = true, initial_capital = 10000, slippage = 1, max_bars_back = 500, calc_on_every_tick = false)

entryKind = input.int(${KIND_ID[r.entry.kind]}, "Strategy id")
confirmKind = input.int(${r.confirm ? KIND_ID[r.confirm.kind] : 0}, "Confirmation id (0 = none)")
confirmWithin = input.int(${r.confirm ? r.confirm.within : 0}, "Confirmation within (candles)")
useTrend = input.bool(${r.trendFilter === 'ema200'}, "Only trade with the 200 EMA trend")
sessStart = input.int(${sess[0]}, "Session start (UTC hour)")
sessEnd = input.int(${sess[1]}, "Session end (UTC hour)")
maKind = input.int(${r.entry.kind === 'sma_cross' ? 2 : 1}, "1 = EMA, 2 = SMA")
fastLen = input.int(${p.fast}, "Fast MA")
slowLen = input.int(${p.slow}, "Slow MA")
rsiLen = input.int(${p.period}, "RSI length")
rsiLower = input.float(${p.lower}, "RSI oversold")
rsiUpper = input.float(${p.upper}, "RSI overbought")
lookback = input.int(${p.lookback}, "Breakout candles")
bbLen = input.int(${p.bbPeriod}, "Bollinger length")
bbMult = input.float(${p.bbDev}, "Bollinger deviation")
stochK = input.int(${p.stochK}, "Stochastic %K")
stochD = input.int(${p.stochD}, "Stochastic %D")
stochSmooth = input.int(${p.stochSmooth}, "Stochastic smoothing")
stLen = input.int(${p.stLen}, "Supertrend ATR length")
stMult = input.float(${p.stMult}, "Supertrend factor")
trendLen = input.int(${p.trendLen}, "Trend EMA")
pullEma = input.int(${p.emaLen}, "Pullback EMA")
riskPct = input.float(${r.riskPercent}, "Risk % per trade", minval = 0.1, maxval = 10)
slPips = input.float(${r.stopLossPips}, "Stop loss (pips)")
tpPips = input.float(${r.takeProfitPips}, "Take profit (pips)")
allowBuy = input.bool(${r.direction !== 'short'}, "Allow buys")
allowSell = input.bool(${r.direction !== 'long'}, "Allow sells")
maxTradesPerDay = input.int(${r.maxTradesPerDay}, "Max trades per day")
pipSize = syminfo.type == "forex" ? syminfo.mintick * 10 : syminfo.mintick
${ENGINE}
sig = detect(entryKind)
confSig = confirmKind > 0 ? detect(confirmKind) : 0
var int lastBullConf = -100000
var int lastBearConf = -100000
if confSig == 1
    lastBullConf := bar_index
if confSig == -1
    lastBearConf := bar_index
confOk = confirmKind == 0 or (sig == 1 and bar_index - lastBullConf <= confirmWithin) or (sig == -1 and bar_index - lastBearConf <= confirmWithin)
trendOk = not useTrend or (sig == 1 and close > e200) or (sig == -1 and close < e200)
hUtc = hour(time, "UTC")
sessOk = (sessStart == 0 and sessEnd == 24) or (hUtc >= sessStart and hUtc < sessEnd)
finalSig = sig != 0 and confOk and trendOk and sessOk ? sig : 0

plotshape(finalSig == 1, "Buy setup", shape.triangleup, location.belowbar, color.new(color.green, 0), size = size.small)
plotshape(finalSig == -1, "Sell setup", shape.triangledown, location.abovebar, color.new(color.red, 0), size = size.small)

// Position size from risk: lose about riskPct of equity if the stop is hit
slDistance = slPips * pipSize
qty = slDistance > 0 ? (strategy.equity * riskPct / 100) / (slDistance * syminfo.pointvalue) : 0

var int tradesToday = 0
if ta.change(time("D")) != 0
    tradesToday := 0

canTrade = strategy.position_size == 0 and tradesToday < maxTradesPerDay and qty > 0
if finalSig == 1 and allowBuy and canTrade
    strategy.entry("Buy", strategy.long, qty = qty)
    tradesToday += 1
if finalSig == -1 and allowSell and canTrade
    strategy.entry("Sell", strategy.short, qty = qty)
    tradesToday += 1

ticks = pipSize / syminfo.mintick
strategy.exit("Buy exit", from_entry = "Buy", loss = slPips * ticks, profit = tpPips * ticks)
strategy.exit("Sell exit", from_entry = "Sell", loss = slPips * ticks, profit = tpPips * ticks)
`;
}
