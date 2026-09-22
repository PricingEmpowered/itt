"""Computes every table behind the complexity-reduction / price-list workbook.

Run:  python analysis.py <path to regression_3.xlsx>
Writes results.pkl, consumed by build_workbook.py.
"""
import pickle
import sys

import numpy as np
import pandas as pd
import statsmodels.api as sm

from prep import (LTM_START, LTM_END, PRIOR_START, OD_LBL, WALL_LBL, LEN_LBL, ORD_LBL,
                  load, split_scope)

# ---- default policy settings (mirrored as editable inputs in the workbook) ----
PARETO = 0.80
CX = dict(multi_pull=2, parts=5, orders=3, tons=10.0, flag_score=2)
SUB_TOL = dict(od=0.25, wall=0.0625)          # substitute hollow may be up to +0.25" OD / +1/16" wall heavier
CANCEL_REV, CANCEL_NEG_REV = 25_000, 100_000
TIER_CUTS = [0.50, 0.80, 0.95, 0.99]          # cumulative LTM revenue share cut-offs for tiers 1-4
DIST_REV, DIST_ORDERS = 5_000, 2


def order_count(frame, key):
    """Distinct shipments per key = distinct (customer, date) pairs with positive tons."""
    cols = list(dict.fromkeys([key, 'CUST', 'Date']))
    return frame[frame.Tons > 0][cols].drop_duplicates().groupby(key).size()


def pareto_class(values, threshold=PARETO):
    v = values.clip(lower=0)
    cum = v.cumsum() / v.sum()
    prev = cum.shift(fill_value=0)
    return np.where((prev < threshold) & (values > 0), 'A', 'B'), cum


# ------------------------------------------------------------------ hollows
def hollow_table(df):
    ltm = df[df.LTM]
    base = df.groupby('HOL').agg(
        Seg=('Seg', 'first'), Proc=('Proc', lambda s: '/'.join(sorted(s.unique()))),
        Mat=('Mat', 'first'), Finish=('Finish', lambda s: s.mode().iat[0]),
        Pulls=('Hollow Pulls', 'max'), SrcFlag=('Hollow Complexity Flag', 'max'),
        ODmin=('OD (in)', 'min'), ODmax=('OD (in)', 'max'),
        Wmin=('Wall (in)', 'min'), Wmax=('Wall (in)', 'max'),
        PartsAll=('Part', 'nunique'), RevAll=('Rev', 'sum'), LastSale=('Date', 'max'))
    l = ltm.groupby('HOL').agg(Rev=('Rev', 'sum'), Tons=('Tons', 'sum'), PM=('PM', 'sum'),
                               Parts=('Part', 'nunique'), Custs=('CUST', 'nunique'))
    l['Orders'] = order_count(ltm, 'HOL')
    top = ltm.groupby(['HOL', 'CUST']).Rev.sum().reset_index().sort_values('Rev', ascending=False)
    l['TopCust'] = top.drop_duplicates('HOL').set_index('HOL').CUST
    h = base.join(l).fillna({'Rev': 0, 'Tons': 0, 'PM': 0, 'Parts': 0, 'Custs': 0, 'Orders': 0})
    h = h.sort_values('Rev', ascending=False)
    h['Class'], h['CumShare'] = pareto_class(h.Rev)
    # complexity drivers
    h['D_MultiPull'] = (h.Pulls >= CX['multi_pull']).astype(int)
    h['D_Parts'] = (h.PartsAll >= CX['parts']).astype(int)
    h['D_LowVel'] = (h.Orders <= CX['orders']).astype(int)
    h['D_LowVol'] = (h.Tons < CX['tons']).astype(int)
    h['D_NegPM'] = (h.PM < 0).astype(int)
    h['CxScore'] = h[['D_MultiPull', 'D_Parts', 'D_LowVel', 'D_LowVol', 'D_NegPM']].sum(axis=1)
    h['CxFlag'] = (h.CxScore >= CX['flag_score']).astype(int)
    h['Area'] = (h.ODmax - h.Wmax) * h.Wmax          # proportional to lb/ft of the hollow envelope
    # substitute search: nearest default-A hollow, same segment/process/material/finish, that
    # covers the B hollow's finished-part envelope within tolerance
    A = h[h.Class == 'A']
    sub, subdist, subpen = {}, {}, {}
    for hol, r in h[h.Class == 'B'].iterrows():
        c = A[(A.Seg == r.Seg) & (A.Proc == r.Proc) & (A.Mat == r.Mat) & (A.Finish == r.Finish)
              & (A.ODmax >= r.ODmax) & (A.ODmax <= r.ODmax + SUB_TOL['od'])
              & (A.Wmax >= r.Wmax) & (A.Wmax <= r.Wmax + SUB_TOL['wall'])]
        if len(c):
            d = (c.ODmax - r.ODmax) / SUB_TOL['od'] + (c.Wmax - r.Wmax) / SUB_TOL['wall']
            best = d.idxmin()
            sub[hol], subdist[hol] = best, d[best]
            subpen[hol] = max(0.0, c.Area[best] / r.Area - 1) if r.Area > 0 else 0.0
    h['Sub'] = pd.Series(sub)
    h['SubPenalty'] = pd.Series(subpen)
    h['CostPerTon'] = np.where(h.Tons > 0, (h.Rev - h.PM) / h.Tons.where(h.Tons > 0), 0)
    h['Priority'] = 0
    b = h[h.Class == 'B'].sort_values(['Pulls', 'CxFlag', 'CxScore', 'Rev'],
                                      ascending=[False, False, False, True])
    h.loc[b.index, 'Priority'] = np.arange(1, len(b) + 1)
    return h


# ------------------------------------------------------------------ customers
def customer_table(df, hol):
    ltm = df[df.LTM]
    base = df.groupby('CUST').agg(SrcAB=('Cust AB (source)', 'first'), ParentRev=('Parent Revenue', 'first'),
                                  RevAll=('Rev', 'sum'), FirstSale=('Date', 'min'), LastSale=('Date', 'max'))
    l = ltm.groupby('CUST').agg(Rev=('Rev', 'sum'), Tons=('Tons', 'sum'), PM=('PM', 'sum'),
                                Parts=('Part', 'nunique'), Hols=('HOL', 'nunique'))
    l['Orders'] = order_count(ltm, 'CUST')
    hh = ltm[['CUST', 'HOL']].drop_duplicates().join(hol[['Class', 'Pulls', 'CxFlag']], on='HOL')
    l['B_Hols'] = hh[hh.Class == 'B'].groupby('CUST').size()
    l['MultiPullHols'] = hh[hh.Pulls >= 2].groupby('CUST').size()
    l['CxHols'] = hh[hh.CxFlag == 1].groupby('CUST').size()
    c = base.join(l).fillna(0).sort_values(['Rev', 'RevAll'], ascending=False)
    c['Class'], c['CumShare'] = pareto_class(c.Rev)
    prev = c.CumShare.shift(fill_value=0)
    c['Tier'] = np.select([prev < t for t in TIER_CUTS], [1, 2, 3, 4], 5)
    # user rule "< $5K a year, 2x a year": averaged over the calendar years in which the customer bought
    pos = df[df.Tons > 0].assign(Y=df.Date.dt.year)
    act = pos.groupby('CUST').agg(ActiveYears=('Y', 'nunique'))
    act['ShipAll'] = order_count(pos, 'CUST')
    c = c.join(act).fillna({'ActiveYears': 0, 'ShipAll': 0})
    yrs = c.ActiveYears.clip(lower=1)
    c['AvgRev'] = c.RevAll / yrs
    c['AvgShip'] = c.ShipAll / yrs
    c['Distributor'] = (c.AvgRev < DIST_REV) & (c.AvgShip <= DIST_ORDERS)
    c['Lapsed'] = (c.Rev <= 0) & ~c.Distributor
    return c


# ------------------------------------------------------------------ regression
REFS = {'OD Band': '2.501-3.000', 'Wall Band': '0.201-0.250', 'Mat': 'M1', 'Proc': 'D', 'Finish': 'SRA',
        'LT': 'Ran', 'Len Band': '20-24 ft', 'Order Band': '5-10 t', 'Year': '2026', 'Cell': None}
# Non-EW has enough breadth for an additive OD + Wall + adders model. EW is a narrow, SKU-like business
# (each material sits in a handful of OD/Wall cells), so it gets one fixed effect per Material|OD|Wall cell
# plus the same commercial adders; unobserved EW cells are quoted rather than extrapolated.
FACTORS = {'Non-EW': ['OD Band', 'Wall Band', 'Mat', 'Proc', 'Finish', 'LT', 'Len Band', 'Order Band', 'Year'],
           'EW': ['Cell', 'Order Band', 'Year']}   # EW length is fixed per cell, so it is carried by the cell
ORDER = {'OD Band': OD_LBL, 'Wall Band': WALL_LBL, 'Len Band': LEN_LBL, 'Order Band': ORD_LBL}


def design(g, seg, levels):
    cols = {}
    for f in FACTORS[seg]:
        for lv in levels[f][1:]:
            cols[f'{f}={lv}'] = (g[f] == lv).astype(float)
    X = pd.DataFrame(cols, index=g.index)
    return sm.add_constant(X, has_constant='add')


def fit_segment(df, seg):
    d = df[(df.Seg == seg) & (df.Tons > 0) & df.Price.notna() & (df.Date >= PRIOR_START)].copy()
    d['Year'] = d.Date.dt.year.astype(str)
    d['Cell'] = d.Mat + '|' + d['OD Band'] + '|' + d['Wall Band']
    lo, hi = d.Price.quantile([.01, .99])
    d = d[(d.Price >= lo) & (d.Price <= hi)]
    # the only Non-EW ASWD rows are CF, so finish is already carried by the CF process term
    if seg == 'Non-EW':
        d = d[d.Finish != 'AD']            # 4 rows, single CD part; not enough to price a finish
    levels = {}
    for f in FACTORS[seg]:
        present = [x for x in ORDER.get(f, sorted(d[f].unique())) if x in set(d[f])]
        ref = REFS[f] if REFS[f] in present else d.groupby(f).Tons.sum().idxmax()
        levels[f] = [ref] + [x for x in present if x != ref]
    if seg == 'Non-EW':
        levels['Finish'] = [x for x in levels['Finish'] if x != 'ASWD']
        d.loc[d.Finish == 'ASWD', 'Finish'] = 'SRA'   # absorbed by Proc=CF
    X = design(d, seg, levels)
    m = sm.WLS(d.Price, X, weights=d.Tons).fit()
    pred = m.predict(X)
    stats = dict(n=len(d), tons=d.Tons.sum(), r2=m.rsquared, adj_r2=m.rsquared_adj,
                 wmape=float(np.average((pred / d.Price - 1).abs(), weights=d.Tons)),
                 trim_lo=lo, trim_hi=hi, start=d.Date.min(), end=d.Date.max())
    coef = pd.DataFrame({'coef': m.params, 'se': m.bse, 't': m.tvalues, 'p': m.pvalues})
    obs = d.groupby(['Mat', 'Proc', 'OD Band', 'Wall Band']).Tons.sum()
    return dict(model=m, levels=levels, stats=stats, coef=coef, observed=obs)


def predict(fit, seg, rows):
    """Model market price at the 2026 price level for arbitrary rows."""
    r = rows.copy()
    r['Year'] = '2026'
    r['Cell'] = r.Mat + '|' + r['OD Band'] + '|' + r['Wall Band']
    if seg == 'Non-EW':
        r.loc[r.Finish.isin(['ASWD', 'AD']), 'Finish'] = 'SRA'
    for f in FACTORS[seg]:
        if f in ORDER:   # fall back to nearest modelled band when a band was trimmed out
            lv = fit['levels'][f]
            r[f] = r[f].where(r[f].isin(lv), lv[0])
    X = design(r, seg, fit['levels'])
    pred = fit['model'].predict(X[fit['model'].params.index])
    if seg == 'EW':   # a cell the model never saw has no list price
        pred[~r.Cell.isin(fit['levels']['Cell'])] = np.nan
    return pred


# ------------------------------------------------------------------ pricing detail
def pricing_detail(df, fits, hol, cust):
    ltm = df[df.LTM & (df.Tons > 0) & df.Price.notna()].copy()
    ltm['Model'] = np.nan
    for seg in fits:
        idx = ltm.Seg == seg
        ltm.loc[idx, 'Model'] = predict(fits[seg], seg, ltm[idx])
    ltm['ModelFallback'] = ltm.Model.isna()
    ltm['Model'] = ltm.Model.fillna(ltm.Price)      # unmodelled -> current price (priced as exception)
    ltm['ModelRev'] = ltm.Model * ltm.Tons
    key = ['CUST', 'Part']
    g = ltm.groupby(key)
    p = g.agg(HOL=('HOL', 'first'), Seg=('Seg', 'first'), Proc=('Proc', 'first'), Mat=('Mat', 'first'),
              Finish=('Finish', 'first'), LT=('LT', 'first'), OD=('OD (in)', 'first'),
              Wall=('Wall (in)', 'first'), ODB=('OD Band', 'first'), WB=('Wall Band', 'first'),
              LenB=('Len Band', 'first'), OrdB=('Order Band', lambda s: s.mode().iat[0]),
              Tons=('Tons', 'sum'), Rev=('Rev', 'sum'), ModelRev=('ModelRev', 'sum'),
              Lines=('Tons', 'size'), Fallback=('ModelFallback', 'max'), OrderType=('Order Type', lambda s: s.mode().iat[0]))
    p['Price'] = p.Rev / p.Tons
    p['Model'] = p.ModelRev / p.Tons
    p = p.reset_index().sort_values(['CUST', 'Rev'], ascending=[True, False])
    return p, ltm


TIER_DISC = {1: 0.08, 2: 0.06, 3: 0.04, 4: 0.02, 5: 0.0}
TIER_CAP = {1: 0.06, 2: 0.08, 3: 0.10, 4: 0.12, 5: 0.15}
SNAP_TOL = 0.03   # current price up to 3% above the tier price moves down to list
TIER_NAME = {1: 'Strategic', 2: 'Key', 3: 'Core', 4: 'Transactional', 5: 'Spot / Small'}


def tier_calibration(p, cust):
    """Observed realisation vs model by tier, and the list uplift that makes the policy ladder
    revenue-neutral on today's volume (rounded up to the next 0.5%)."""
    q = p.join(cust.Tier, on='CUST')
    q = q[~q.CUST.isin(cust.index[cust.Distributor])]
    t = q.groupby('Tier').agg(Rev=('Rev', 'sum'), ModelRev=('ModelRev', 'sum'), Custs=('CUST', 'nunique'))
    t['RI'] = t.Rev / t.ModelRev
    t['Disc'] = pd.Series(TIER_DISC)
    t['Cap'] = pd.Series(TIER_CAP)
    t['Name'] = pd.Series(TIER_NAME)
    neutral = t.Rev.sum() / (t.ModelRev * (1 - t.Disc)).sum() - 1
    uplift = np.ceil(neutral * 200) / 200
    return t, uplift


# ------------------------------------------------------------------ forecast
def forecast_base(df, hol_cancel, dist_custs):
    d = df[(df.Tons > 0) & ~df.HOL.isin(hol_cancel) & ~df.CUST.isin(dist_custs)].copy()
    d['Q'] = d.Date.dt.to_period('Q-AUG')    # fiscal quarters aligned so the LTM is 4 whole quarters
    last8 = pd.period_range(pd.Period(LTM_END, 'Q-AUG') - 7, pd.Period(LTM_END, 'Q-AUG'), freq='Q-AUG')
    k = ['CUST', 'HOL']
    ltm = d[d.LTM].groupby(k).agg(LTMTons=('Tons', 'sum'), LTMRev=('Rev', 'sum'),
                                  Seg=('Seg', 'first'), Parts=('Part', 'nunique'))
    prior = d[d.PRIOR].groupby(k).Tons.sum().rename('PriorTons')
    qa = d[d.Q.isin(last8)].groupby(k).Q.nunique().rename('QtrsActive')
    f = ltm.join(prior).join(qa).fillna({'PriorTons': 0, 'QtrsActive': 0}).reset_index()
    f['Repeat'] = np.select([f.QtrsActive >= 6, f.QtrsActive >= 4], ['High', 'Repeatable'], 'Not repeatable')
    f['Price'] = f.LTMRev / f.LTMTons
    # seasonality (share of annual tons by calendar month, Sep-2023..Aug-2026) per segment
    s = df[(df.Tons > 0) & (df.Date >= '2023-09-01')].copy()
    s['M'] = s.Date.dt.month
    seas = s.groupby(['Seg', 'M']).Tons.sum().unstack(0)
    seas = seas / seas.sum() * 12
    # back-test: stand at 31-Aug-2025, pick the combos that were repeatable then (>=4 of the prior
    # 8 fiscal quarters), forecast the next 12 months with the same method and compare to actuals
    bt = []
    prev8 = last8 - 4
    for seg in ['EW', 'Non-EW']:
        x = d[d.Seg == seg]
        rep = x[x.Q.isin(prev8)].groupby(k).Q.nunique()
        rep = rep[rep >= 4].index
        y1 = x[(x.Date >= '2023-09-01') & (x.Date < PRIOR_START)].groupby(k).Tons.sum()
        y2 = x[x.PRIOR].groupby(k).Tons.sum()
        act = x[x.LTM].groupby(k).Tons.sum()
        j = pd.concat([y1.rename('y1'), y2.rename('y2'), act.rename('act')], axis=1).fillna(0).reindex(rep).fillna(0)
        g = ((j.y2 / j.y1.where(j.y1 > 0)) - 1).clip(-.25, .25).fillna(0)
        j['fc'] = j.y2 * (1 + 0.5 * g)
        bt.append(dict(Seg=seg, Combos=len(j), Actual=j.act.sum(), Forecast=j.fc.sum(), Naive=j.y2.sum(),
                       Bias=j.fc.sum() / j.act.sum() - 1,
                       WAPE=(j.fc - j.act).abs().sum() / j.act.sum(),
                       NaiveWAPE=(j.y2 - j.act).abs().sum() / j.act.sum()))
    return f, seas, pd.DataFrame(bt)


def main(path):
    raw = load(path)
    df, excluded = split_scope(raw)
    hol = hollow_table(df)
    cust = customer_table(df, hol)
    fits = {s: fit_segment(df, s) for s in ['Non-EW', 'EW']}
    p, lines = pricing_detail(df, fits, hol, cust)
    tiers, uplift = tier_calibration(p, cust)
    # default hollow decision (the workbook recomputes this live from Inputs)
    ltm_rev_zero = hol.Rev <= 0
    cancel = (hol.Class == 'B') & (ltm_rev_zero | (hol.Sub.isna() & ((hol.Rev < CANCEL_REV) |
                                                                     ((hol.PM <= 0) & (hol.Rev < CANCEL_NEG_REV)))))
    hol['DefaultDecision'] = np.where(hol.Class == 'A', 'Keep (A)', np.where(
        cancel, 'Cancel', np.where(hol.Sub.notna(), 'Rationalize', 'Raise Price')))
    fc, seas, bt = forecast_base(df, hol.index[hol.DefaultDecision == 'Cancel'], cust.index[cust.Distributor])
    out = dict(df=df, excluded=excluded, hol=hol, cust=cust, fits={s: {k: v for k, v in f.items() if k != 'model'}
                                                                    for s, f in fits.items()},
               pricing=p, tiers=tiers, uplift=uplift, forecast=fc, seas=seas, backtest=bt)
    with open('results.pkl', 'wb') as fh:
        pickle.dump(out, fh)
    # console summary
    print('in-scope rows', len(df), 'excluded', len(excluded))
    print(hol.Class.value_counts().to_dict(), hol.DefaultDecision.value_counts().to_dict())
    print('subs found', hol.Sub.notna().sum())
    print(cust.Class.value_counts().to_dict(), cust.Tier.value_counts().sort_index().to_dict(),
          'dist', cust.Distributor.sum())
    for s, f in fits.items():
        print(s, {k: (round(v, 3) if isinstance(v, float) else v) for k, v in f['stats'].items()})
    print(tiers, 'uplift', uplift)
    print(fc.Repeat.value_counts().to_dict()); print(bt)


if __name__ == '__main__':
    main(sys.argv[1])
