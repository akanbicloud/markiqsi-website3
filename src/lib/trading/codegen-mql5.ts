import type { EntryKind, Rules, Timeframe } from './botspec';
import { fullParams } from './botspec';

const TF: Record<Timeframe, string> = { M1: 'PERIOD_M1', M5: 'PERIOD_M5', M15: 'PERIOD_M15', M30: 'PERIOD_M30', H1: 'PERIOD_H1', H4: 'PERIOD_H4', D1: 'PERIOD_D1', W1: 'PERIOD_W1', MN1: 'PERIOD_MN1' };

export const KIND_ID: Record<EntryKind, number> = {
  ema_cross: 1, sma_cross: 2, rsi: 3, macd_cross: 4, breakout: 5, bb: 6, stoch: 7, supertrend: 8, pullback: 9,
  sd: 10, sr: 11, candles: 12, fvg: 13, ob: 14, bos: 15, liq: 16, ote: 17, ibb: 18, london: 19,
};

/**
 * The same detection rules the website uses, written in MQL5.
 * Bars are copied oldest-first: R[0] is the oldest, R[N-1] the last CLOSED candle.
 */
const ENGINE = String.raw`
MqlRates R[];
int      N = 0;
double   CL[], AT[], E20[], E50[], E200[], EF[], ES[], RS[], ML[], MS[], BBM[], BBS[], SK[], SD[], STD[], ETL[], EEL[];

double Hi(int i) { return R[i].high; }
double Lo(int i) { return R[i].low; }
double Op(int i) { return R[i].open; }
double Cl(int i) { return R[i].close; }
double Body(int i) { return MathAbs(R[i].close - R[i].open); }
bool   IsBull(int i) { return R[i].close > R[i].open; }
bool   IsBear(int i) { return R[i].close < R[i].open; }
double UpWick(int i) { return R[i].high - MathMax(R[i].open, R[i].close); }
double LoWick(int i) { return MathMin(R[i].open, R[i].close) - R[i].low; }
double Highest(int a, int b) { double m = -DBL_MAX; for(int i = MathMax(0, a); i <= b; i++) m = MathMax(m, R[i].high); return m; }
double Lowest(int a, int b) { double m = DBL_MAX; for(int i = MathMax(0, a); i <= b; i++) m = MathMin(m, R[i].low); return m; }

void EmaArr(const double &src[], int n, double &out[])
{
   int len = ArraySize(src); ArrayResize(out, len); ArrayInitialize(out, EMPTY_VALUE);
   if(len < n) return;
   double s = 0; for(int i = 0; i < n; i++) s += src[i];
   double prev = s / n; out[n - 1] = prev; double k = 2.0 / (n + 1);
   for(int i = n; i < len; i++) { prev = src[i] * k + prev * (1 - k); out[i] = prev; }
}
void SmaArr(const double &src[], int n, double &out[])
{
   int len = ArraySize(src); ArrayResize(out, len); ArrayInitialize(out, EMPTY_VALUE);
   double s = 0;
   for(int i = 0; i < len; i++) { s += src[i]; if(i >= n) s -= src[i - n]; if(i >= n - 1) out[i] = s / n; }
}
void StdArr(const double &src[], int n, const double &mid[], double &out[])
{
   int len = ArraySize(src); ArrayResize(out, len); ArrayInitialize(out, EMPTY_VALUE);
   for(int i = n - 1; i < len; i++) { double s = 0; for(int k = i - n + 1; k <= i; k++) s += MathPow(src[k] - mid[i], 2); out[i] = MathSqrt(s / n); }
}
void RsiArr(const double &src[], int n, double &out[])
{
   int len = ArraySize(src); ArrayResize(out, len); ArrayInitialize(out, EMPTY_VALUE);
   if(len <= n) return;
   double g = 0, l = 0;
   for(int i = 1; i <= n; i++) { double d = src[i] - src[i - 1]; if(d >= 0) g += d; else l -= d; }
   g /= n; l /= n; out[n] = (l == 0) ? 100 : 100 - 100 / (1 + g / l);
   for(int i = n + 1; i < len; i++) { double d = src[i] - src[i - 1]; g = (g * (n - 1) + MathMax(d, 0)) / n; l = (l * (n - 1) + MathMax(-d, 0)) / n; out[i] = (l == 0) ? 100 : 100 - 100 / (1 + g / l); }
}
void AtrArr(int n, double &out[])
{
   ArrayResize(out, N); ArrayInitialize(out, EMPTY_VALUE);
   if(N <= n) return;
   double tr[]; ArrayResize(tr, N);
   for(int i = 0; i < N; i++) tr[i] = (i == 0) ? Hi(i) - Lo(i) : MathMax(Hi(i) - Lo(i), MathMax(MathAbs(Hi(i) - Cl(i - 1)), MathAbs(Lo(i) - Cl(i - 1))));
   double a = 0; for(int i = 1; i <= n; i++) a += tr[i]; a /= n; out[n] = a;
   for(int i = n + 1; i < N; i++) { a = (a * (n - 1) + tr[i]) / n; out[i] = a; }
}
void MacdArr(double &line[], double &sig[])
{
   double f[], s[]; EmaArr(CL, 12, f); EmaArr(CL, 26, s);
   ArrayResize(line, N); ArrayInitialize(line, EMPTY_VALUE);
   int start = -1;
   for(int i = 0; i < N; i++) if(f[i] != EMPTY_VALUE && s[i] != EMPTY_VALUE) { line[i] = f[i] - s[i]; if(start < 0) start = i; }
   ArrayResize(sig, N); ArrayInitialize(sig, EMPTY_VALUE);
   if(start < 0) return;
   double part[], seg[]; ArrayResize(part, N - start); for(int i = start; i < N; i++) part[i - start] = line[i];
   EmaArr(part, 9, seg); for(int i = 0; i < ArraySize(seg); i++) sig[start + i] = seg[i];
}
void StochArr(int kLen, int dLen, int smooth, double &K[], double &D[])
{
   double raw[]; ArrayResize(raw, N);
   for(int i = 0; i < N; i++) { if(i < kLen - 1) { raw[i] = 0; continue; } double hh = Highest(i - kLen + 1, i), ll = Lowest(i - kLen + 1, i); raw[i] = (hh == ll) ? 50 : (Cl(i) - ll) / (hh - ll) * 100; }
   SmaArr(raw, smooth, K); for(int i = 0; i < N && i < kLen + smooth - 2; i++) K[i] = EMPTY_VALUE;
   double kk[]; ArrayResize(kk, N); for(int i = 0; i < N; i++) kk[i] = (K[i] == EMPTY_VALUE) ? 0 : K[i];
   SmaArr(kk, dLen, D); for(int i = 0; i < N && i < kLen + smooth + dLen - 3; i++) D[i] = EMPTY_VALUE;
}
void SupertrendArr(int period, double mult, double &dir[])
{
   double a[]; double keep[]; ArrayCopy(keep, AT); AtrArr(period, a); ArrayCopy(AT, keep);
   ArrayResize(dir, N); ArrayInitialize(dir, 0);
   double up = EMPTY_VALUE, dn = EMPTY_VALUE; int d = 1;
   for(int i = 0; i < N; i++)
   {
      if(a[i] == EMPTY_VALUE) continue;
      double mid = (Hi(i) + Lo(i)) / 2, u = mid - mult * a[i], l = mid + mult * a[i];
      double pc = (i > 0) ? Cl(i - 1) : Cl(i);
      up = (up == EMPTY_VALUE) ? u : (pc > up ? MathMax(u, up) : u);
      dn = (dn == EMPTY_VALUE) ? l : (pc < dn ? MathMin(l, dn) : l);
      if(d == -1 && Cl(i) > dn) d = 1; else if(d == 1 && Cl(i) < up) d = -1;
      dir[i] = d;
   }
}

struct Sw { int i; double p; int t; };   // t: 1 = swing high, -1 = swing low
int Swings(int side, int from, int to, Sw &out[])
{
   ArrayResize(out, 0); int n = 0;
   for(int i = MathMax(side, from); i <= MathMin(to, N - 1 - side); i++)
   {
      bool hi = true, lo = true;
      for(int k = 1; k <= side; k++)
      {
         if(!(Hi(i) > Hi(i - k) && Hi(i) >= Hi(i + k))) hi = false;
         if(!(Lo(i) < Lo(i - k) && Lo(i) <= Lo(i + k))) lo = false;
      }
      if(hi) { ArrayResize(out, n + 1); out[n].i = i; out[n].p = Hi(i); out[n].t = 1; n++; }
      if(lo) { ArrayResize(out, n + 1); out[n].i = i; out[n].p = Lo(i); out[n].t = -1; n++; }
   }
   return n;
}

int Trend(int L)
{
   if(E20[L] == EMPTY_VALUE || E50[L] == EMPTY_VALUE) return 0;
   if(E20[L] > E50[L] && Cl(L) > E50[L]) return 1;
   if(E20[L] < E50[L] && Cl(L) < E50[L]) return -1;
   return 0;
}
bool Ok(double v) { return v != EMPTY_VALUE; }

int DetCandles(int L)
{
   double a = AT[L]; if(!Ok(a)) return 0;
   int x = L, p = L - 1, pp = L - 2; int tr = Trend(L);
   if(IsBear(pp) && Body(pp) > 0.6 * a && Body(p) < 0.35 * Body(pp) && IsBull(x) && Cl(x) > (Op(pp) + Cl(pp)) / 2) return 1;
   if(IsBull(pp) && Body(pp) > 0.6 * a && Body(p) < 0.35 * Body(pp) && IsBear(x) && Cl(x) < (Op(pp) + Cl(pp)) / 2) return -1;
   if(IsBear(p) && IsBull(x) && Op(x) <= Cl(p) && Cl(x) >= Op(p) && Body(x) > Body(p) && Body(x) > 0.4 * a) return 1;
   if(IsBull(p) && IsBear(x) && Op(x) >= Cl(p) && Cl(x) <= Op(p) && Body(x) > Body(p) && Body(x) > 0.4 * a) return -1;
   double range = Hi(x) - Lo(x);
   if(range > 0.6 * a)
   {
      if(LoWick(x) >= 2 * Body(x) && UpWick(x) <= 0.3 * range && LoWick(x) >= 0.55 * range) return 1;
      if(UpWick(x) >= 2 * Body(x) && LoWick(x) <= 0.3 * range && UpWick(x) >= 0.55 * range) return -1;
   }
   if(Hi(x) < Hi(p) && Lo(x) > Lo(p) && tr != 0) return tr;
   return 0;
}

int DetSR(int L)
{
   double a = AT[L]; if(!Ok(a)) return 0;
   Sw sw[]; int n = Swings(3, L - 200, L - 4, sw);
   double tol = 0.2 * a; double lp[]; int lt[]; int m = 0;
   for(int s = 0; s < n; s++)
   {
      int f = -1; for(int v = 0; v < m; v++) if(MathAbs(lp[v] - sw[s].p) <= tol) { f = v; break; }
      if(f >= 0) { lp[f] = (lp[f] * lt[f] + sw[s].p) / (lt[f] + 1); lt[f]++; }
      else { ArrayResize(lp, m + 1); ArrayResize(lt, m + 1); lp[m] = sw[s].p; lt[m] = 1; m++; }
   }
   int best = -1; double bestD = DBL_MAX;
   for(int v = 0; v < m; v++)
   {
      if(lt[v] < 2) continue;
      int crosses = 0; for(int j = MathMax(1, L - 100); j < L; j++) if((Cl(j - 1) - lp[v]) * (Cl(j) - lp[v]) < 0) crosses++;
      if(crosses > 4) continue;
      bool touching = Lo(L) <= lp[v] + 0.15 * a && Hi(L) >= lp[v] - 0.15 * a;
      double nearD = MathAbs(Cl(L) - lp[v]);
      if(touching && nearD <= 0.6 * a && nearD < bestD) { best = v; bestD = nearD; }
   }
   if(best < 0) return 0;
   return Cl(L) >= lp[best] ? 1 : -1;
}

int DetSD(int L)
{
   for(int k = L - 4; k >= MathMax(20, L - 150); k--)
   {
      double a = AT[k + 1]; if(!Ok(a) || a <= 0) continue;
      int base = k, imp = k + 1;
      double move2 = MathAbs(Cl(MathMin(k + 2, L - 1)) - Cl(base));
      bool strong = Body(imp) >= 1.8 * a || move2 >= 2.5 * a;
      if(!strong || Body(base) > 0.6 * a) continue;
      if(IsBull(imp) && Cl(imp) > Hi(base))
      {
         double top = MathMax(Op(base), Cl(base)), bot = Lo(base); bool fresh = true;
         for(int j = k + 2; j < L; j++) if(Lo(j) <= top) { fresh = false; break; }
         if(fresh && Lo(L) <= top && Cl(L) >= bot) return 1;
      }
      if(IsBear(imp) && Cl(imp) < Lo(base))
      {
         double bot = MathMin(Op(base), Cl(base)), top = Hi(base); bool fresh = true;
         for(int j = k + 2; j < L; j++) if(Hi(j) >= bot) { fresh = false; break; }
         if(fresh && Hi(L) >= bot && Cl(L) <= top) return -1;
      }
   }
   return 0;
}

int DetFVG(int L)
{
   for(int m = L - 2; m >= MathMax(2, L - 60); m--)
   {
      double a = AT[m]; if(!Ok(a) || a <= 0) continue;
      int b = m - 1, f = m + 1;
      if(Lo(f) > Hi(b) && Lo(f) - Hi(b) >= 0.3 * a)
      {
         double bot = Hi(b), top = Lo(f); bool filled = false, touched = false;
         for(int j = m + 2; j < L; j++) { if(Lo(j) <= bot) filled = true; if(Lo(j) <= top) touched = true; }
         if(!filled && !touched && Lo(L) <= top && Cl(L) >= bot) return 1;
      }
      if(Hi(f) < Lo(b) && Lo(b) - Hi(f) >= 0.3 * a)
      {
         double top = Lo(b), bot = Hi(f); bool filled = false, touched = false;
         for(int j = m + 2; j < L; j++) { if(Hi(j) >= top) filled = true; if(Hi(j) >= bot) touched = true; }
         if(!filled && !touched && Hi(L) >= bot && Cl(L) <= top) return -1;
      }
   }
   return 0;
}

int DetOB(int L)
{
   for(int k = L - 4; k >= MathMax(15, L - 100); k--)
   {
      double ph = Highest(k - 10, k), pl = Lowest(k - 10, k);
      if(IsBear(k))
      {
         int broke = -1; for(int j = k + 1; j <= MathMin(k + 3, L - 1); j++) if(Cl(j) > ph) { broke = j; break; }
         if(broke > 0)
         {
            bool tapped = false; for(int j = broke + 1; j < L; j++) if(Lo(j) <= Hi(k)) { tapped = true; break; }
            if(!tapped && Lo(L) <= Hi(k) && Cl(L) >= Lo(k)) return 1;
         }
      }
      if(IsBull(k))
      {
         int broke = -1; for(int j = k + 1; j <= MathMin(k + 3, L - 1); j++) if(Cl(j) < pl) { broke = j; break; }
         if(broke > 0)
         {
            bool tapped = false; for(int j = broke + 1; j < L; j++) if(Hi(j) >= Lo(k)) { tapped = true; break; }
            if(!tapped && Hi(L) >= Lo(k) && Cl(L) <= Hi(k)) return -1;
         }
      }
   }
   return 0;
}

int DetBOS(int L)
{
   Sw sw[]; int n = Swings(2, L - 150, L - 2, sw);
   int h1 = -1, l1 = -1;
   for(int s = n - 1; s >= 0; s--) { if(sw[s].t == 1 && h1 < 0) h1 = s; if(sw[s].t == -1 && l1 < 0) l1 = s; }
   int hc = 0, lc = 0; for(int s = 0; s < n; s++) { if(sw[s].t == 1) hc++; else lc++; }
   if(hc < 2 || lc < 2) return 0;
   if(Cl(L) > sw[h1].p && Cl(L - 1) <= sw[h1].p) return 1;
   if(Cl(L) < sw[l1].p && Cl(L - 1) >= sw[l1].p) return -1;
   return 0;
}

int DetLiq(int L)
{
   Sw sw[]; int n = Swings(2, L - 40, L - 3, sw);
   for(int s = 0; s < n; s++)
   {
      if(sw[s].t != 1) continue;
      bool untouched = true; for(int j = sw[s].i + 1; j < L; j++) if(Hi(j) > sw[s].p) { untouched = false; break; }
      if(untouched && Hi(L) > sw[s].p && Cl(L) < sw[s].p) return -1;
   }
   for(int s = 0; s < n; s++)
   {
      if(sw[s].t != -1) continue;
      bool untouched = true; for(int j = sw[s].i + 1; j < L; j++) if(Lo(j) < sw[s].p) { untouched = false; break; }
      if(untouched && Lo(L) < sw[s].p && Cl(L) > sw[s].p) return 1;
   }
   return 0;
}

int DetOTE(int L)
{
   double a = AT[L]; if(!Ok(a)) return 0;
   Sw sw[]; int n = Swings(2, L - 80, L - 2, sw);
   if(n < 2) return 0;
   int last = n - 1, prev = -1;
   for(int s = n - 1; s >= 0; s--) if(sw[s].t != sw[last].t) { prev = s; break; }
   if(prev < 0) return 0;
   if(sw[prev].t == -1 && sw[last].t == 1 && sw[last].p - sw[prev].p >= 3 * a)
   {
      double leg = sw[last].p - sw[prev].p;
      if(Lowest(sw[last].i + 1, L) < sw[prev].p) return 0;
      double r = (sw[last].p - Cl(L)) / leg;
      if(r >= 0.62 && r <= 0.79) return 1;
   }
   if(sw[prev].t == 1 && sw[last].t == -1 && sw[prev].p - sw[last].p >= 3 * a)
   {
      double leg = sw[prev].p - sw[last].p;
      if(Highest(sw[last].i + 1, L) > sw[prev].p) return 0;
      double r = (Cl(L) - sw[last].p) / leg;
      if(r >= 0.62 && r <= 0.79) return -1;
   }
   return 0;
}

int DetIBB(int L)
{
   int mo = L - 2, ins = L - 1;
   if(!(Hi(ins) < Hi(mo) && Lo(ins) > Lo(mo))) return 0;
   if(Cl(L) > Hi(mo)) return 1;
   if(Cl(L) < Lo(mo)) return -1;
   return 0;
}

int UtcHour(int i) { MqlDateTime t; TimeToStruct(R[i].time - BrokerGMTOffsetHours * 3600, t); return t.hour; }
int UtcDay(int i) { return (int)((R[i].time - BrokerGMTOffsetHours * 3600) / 86400); }

int DetLondon(int L)
{
   if(R[L].time - R[L - 1].time > 3600) return 0;
   int h = UtcHour(L); if(h < 7 || h >= 11) return 0;
   int day = UtcDay(L); double hi = -DBL_MAX, lo = DBL_MAX; int n = 0;
   for(int i = L - 1; i >= 0 && UtcDay(i) == day; i--) if(UtcHour(i) < 7) { hi = MathMax(hi, Hi(i)); lo = MathMin(lo, Lo(i)); n++; }
   if(n < 3) return 0;
   for(int i = L - 1; i >= 0 && UtcDay(i) == day; i--) if(UtcHour(i) >= 7 && (Cl(i) > hi || Cl(i) < lo)) return 0;
   if(Cl(L) > hi) return 1;
   if(Cl(L) < lo) return -1;
   return 0;
}

int Cross(const double &f[], const double &s[], int i)
{
   if(!Ok(f[i]) || !Ok(s[i]) || !Ok(f[i - 1]) || !Ok(s[i - 1])) return 0;
   if(f[i - 1] <= s[i - 1] && f[i] > s[i]) return 1;
   if(f[i - 1] >= s[i - 1] && f[i] < s[i]) return -1;
   return 0;
}

int Detect(int kind, int L)
{
   if(L < 80) return 0;
   switch(kind)
   {
      case 1: case 2: return Cross(EF, ES, L);
      case 3: if(!Ok(RS[L]) || !Ok(RS[L - 1])) return 0; if(RS[L - 1] < RsiLower && RS[L] >= RsiLower) return 1; if(RS[L - 1] > RsiUpper && RS[L] <= RsiUpper) return -1; return 0;
      case 4: return Cross(ML, MS, L);
      case 5: if(Cl(L) > Highest(L - Lookback, L - 1)) return 1; if(Cl(L) < Lowest(L - Lookback, L - 1)) return -1; return 0;
      case 6: { if(!Ok(BBM[L]) || !Ok(BBM[L - 1])) return 0; double lo1 = BBM[L - 1] - BBDev * BBS[L - 1], lo0 = BBM[L] - BBDev * BBS[L], hi1 = BBM[L - 1] + BBDev * BBS[L - 1], hi0 = BBM[L] + BBDev * BBS[L];
                if(Cl(L - 1) < lo1 && Cl(L) > lo0) return 1; if(Cl(L - 1) > hi1 && Cl(L) < hi0) return -1; return 0; }
      case 7: if(!Ok(SK[L]) || !Ok(SD[L]) || !Ok(SK[L - 1]) || !Ok(SD[L - 1])) return 0;
              if(SK[L - 1] <= SD[L - 1] && SK[L] > SD[L] && MathMin(SK[L - 1], SD[L - 1]) < 20) return 1;
              if(SK[L - 1] >= SD[L - 1] && SK[L] < SD[L] && MathMax(SK[L - 1], SD[L - 1]) > 80) return -1; return 0;
      case 8: if(STD[L - 1] == -1 && STD[L] == 1) return 1; if(STD[L - 1] == 1 && STD[L] == -1) return -1; return 0;
      case 9: if(!Ok(ETL[L]) || !Ok(EEL[L])) return 0;
              if(Cl(L) > ETL[L] && EEL[L] > ETL[L] && Lo(L) <= EEL[L] && Cl(L) > EEL[L] && IsBull(L)) return 1;
              if(Cl(L) < ETL[L] && EEL[L] < ETL[L] && Hi(L) >= EEL[L] && Cl(L) < EEL[L] && IsBear(L)) return -1; return 0;
      case 10: return DetSD(L);
      case 11: return DetSR(L);
      case 12: return DetCandles(L);
      case 13: return DetFVG(L);
      case 14: return DetOB(L);
      case 15: return DetBOS(L);
      case 16: return DetLiq(L);
      case 17: return DetOTE(L);
      case 18: return DetIBB(L);
      case 19: return DetLondon(L);
   }
   return 0;
}

bool LoadBars()
{
   ArraySetAsSeries(R, false);
   int got = CopyRates(_Symbol, TF, 1, BarsToLoad, R);   // from the last CLOSED candle backwards, oldest first
   if(got < 120) return false;
   N = got;
   ArrayResize(CL, N); for(int i = 0; i < N; i++) CL[i] = R[i].close;
   AtrArr(14, AT);
   EmaArr(CL, 20, E20); EmaArr(CL, 50, E50); EmaArr(CL, 200, E200);
   if(MaKind == 2) { SmaArr(CL, FastPeriod, EF); SmaArr(CL, SlowPeriod, ES); } else { EmaArr(CL, FastPeriod, EF); EmaArr(CL, SlowPeriod, ES); }
   RsiArr(CL, RsiPeriod, RS);
   MacdArr(ML, MS);
   SmaArr(CL, BBPeriod, BBM); StdArr(CL, BBPeriod, BBM, BBS);
   StochArr(StochK, StochD, StochSmooth, SK, SD);
   SupertrendArr(STPeriod, STMult, STD);
   EmaArr(CL, TrendLen, ETL); EmaArr(CL, PullbackEma, EEL);
   return true;
}

int SignalNow()
{
   int L = N - 1;
   int s = Detect(EntryKind, L);
   if(s == 0) return 0;
   if(ConfirmKind > 0)
   {
      bool ok = false;
      for(int k = MathMax(80, L - ConfirmWithin); k <= L; k++) if(Detect(ConfirmKind, k) == s) { ok = true; break; }
      if(!ok) return 0;
   }
   if(UseTrendFilter) { if(!Ok(E200[L])) return 0; if(s == 1 && !(Cl(L) > E200[L])) return 0; if(s == -1 && !(Cl(L) < E200[L])) return 0; }
   if(SessionStartUTC != 0 || SessionEndUTC != 24) { int h = UtcHour(L); if(h < SessionStartUTC || h >= SessionEndUTC) return 0; }
   return s;
}
`;

export function toMql5(r: Rules) {
  const p = fullParams(r.entry);
  const sess = { any: [0, 24], london: [7, 16], newyork: [12, 21], london_ny: [7, 21] }[r.session];
  const safeName = r.name.replace(/[^\w\s-]/g, '');
  return `//+------------------------------------------------------------------+
//| ${safeName} - generated by MarkIQ SI Bot Builder
//| Market: ${r.symbol}   Timeframe: ${r.timeframe}
//| Strategy: ${r.entry.kind}${r.confirm ? ` + confirm ${r.confirm.kind} within ${r.confirm.within} candles` : ''}
//| ALWAYS test this on a demo account first. Trading risks real money.
//| This bot never needs your password: it runs inside your own MT5.
//+------------------------------------------------------------------+
#property copyright "Built with MarkIQ SI"
#property version   "2.00"
#include <Trade/Trade.mqh>

input ENUM_TIMEFRAMES TF = ${TF[r.timeframe]};
input int    EntryKind = ${KIND_ID[r.entry.kind]};        // strategy id (see MarkIQ SI Bot Builder)
input int    ConfirmKind = ${r.confirm ? KIND_ID[r.confirm.kind] : 0};      // 0 = no confirmation
input int    ConfirmWithin = ${r.confirm ? r.confirm.within : 0};
input bool   UseTrendFilter = ${r.trendFilter === 'ema200'};  // only trade with the 200 EMA trend
input int    SessionStartUTC = ${sess[0]};
input int    SessionEndUTC = ${sess[1]};
input int    BrokerGMTOffsetHours = 2;  // your broker's server time minus UTC (often 2 or 3)
input int    MaKind = ${r.entry.kind === 'sma_cross' ? 2 : 1};             // 1 = EMA, 2 = SMA
input int    FastPeriod = ${p.fast};
input int    SlowPeriod = ${p.slow};
input int    RsiPeriod = ${p.period};
input double RsiLower = ${p.lower};
input double RsiUpper = ${p.upper};
input int    Lookback = ${p.lookback};
input int    BBPeriod = ${p.bbPeriod};
input double BBDev = ${p.bbDev};
input int    StochK = ${p.stochK};
input int    StochD = ${p.stochD};
input int    StochSmooth = ${p.stochSmooth};
input int    STPeriod = ${p.stLen};
input double STMult = ${p.stMult};
input int    TrendLen = ${p.trendLen};
input int    PullbackEma = ${p.emaLen};
input double RiskPercent = ${r.riskPercent};          // % of equity risked per trade
input double StopLossPips = ${r.stopLossPips};
input double TakeProfitPips = ${r.takeProfitPips};
input int    MaxTradesPerDay = ${r.maxTradesPerDay};
input double DailyLossLimitPercent = ${r.dailyLossPercent}; // stop trading for the day after this loss
input bool   AllowBuy = ${r.direction !== 'short'};
input bool   AllowSell = ${r.direction !== 'long'};
input double PipSizeOverride = 0;       // leave 0 for automatic
input int    BarsToLoad = 500;
input ulong  MagicNumber = 77010;

CTrade trade;
datetime lastBar = 0;
datetime dayStart = 0;
double   dayStartEquity = 0;
${ENGINE}
double Pip()
{
   if(PipSizeOverride > 0) return PipSizeOverride;
   if(_Digits == 3 || _Digits == 5) return _Point * 10;
   if(_Digits == 2 && StringFind(_Symbol, "XAU") >= 0) return _Point * 10;
   return _Point;
}

bool HasPosition()
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong t = PositionGetTicket(i);
      if(t > 0 && PositionGetString(POSITION_SYMBOL) == _Symbol && PositionGetInteger(POSITION_MAGIC) == (long)MagicNumber) return true;
   }
   return false;
}

int TradesToday()
{
   if(!HistorySelect(dayStart, TimeCurrent())) return 0;
   int n = 0;
   for(int i = HistoryDealsTotal() - 1; i >= 0; i--)
   {
      ulong d = HistoryDealGetTicket(i);
      if(d > 0 && HistoryDealGetInteger(d, DEAL_MAGIC) == (long)MagicNumber && HistoryDealGetInteger(d, DEAL_ENTRY) == DEAL_ENTRY_IN) n++;
   }
   return n;
}

double LotsForRisk(double slDistance)
{
   double tickValue = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   double tickSize  = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   if(tickValue <= 0 || tickSize <= 0 || slDistance <= 0) return 0;
   double riskMoney = AccountInfoDouble(ACCOUNT_EQUITY) * RiskPercent / 100.0;
   double lots = riskMoney / (slDistance / tickSize * tickValue);
   double step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   double minL = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double maxL = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   lots = MathFloor(lots / step) * step;
   if(lots < minL) return 0;            // the trade would risk more than allowed, so skip it
   return MathMin(lots, maxL);
}

int OnInit()
{
   trade.SetExpertMagicNumber(MagicNumber);
   return INIT_SUCCEEDED;
}

void OnTick()
{
   MqlDateTime now; TimeToStruct(TimeCurrent(), now);
   now.hour = 0; now.min = 0; now.sec = 0;
   datetime today = StructToTime(now);
   if(today != dayStart) { dayStart = today; dayStartEquity = AccountInfoDouble(ACCOUNT_EQUITY); }

   datetime bar = iTime(_Symbol, TF, 0);
   if(bar == lastBar) return;          // act once per new candle
   lastBar = bar;

   if(AccountInfoDouble(ACCOUNT_EQUITY) <= dayStartEquity * (1.0 - DailyLossLimitPercent / 100.0)) return;
   if(HasPosition()) return;           // one trade at a time
   if(TradesToday() >= MaxTradesPerDay) return;
   if(!LoadBars()) return;

   int sig = SignalNow();
   if(sig == 0) return;
   double pip = Pip();
   double sl = StopLossPips * pip, tp = TakeProfitPips * pip;
   double lots = LotsForRisk(sl);
   if(lots <= 0) return;

   if(sig == 1 && AllowBuy)
   {
      double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      trade.Buy(lots, _Symbol, ask, NormalizeDouble(ask - sl, _Digits), NormalizeDouble(ask + tp, _Digits), "MarkIQ SI");
   }
   else if(sig == -1 && AllowSell)
   {
      double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      trade.Sell(lots, _Symbol, bid, NormalizeDouble(bid + sl, _Digits), NormalizeDouble(bid - tp, _Digits), "MarkIQ SI");
   }
}
`;
}
