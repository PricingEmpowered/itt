"""Shared data prep for the complexity-reduction / price-list project."""
import numpy as np, pandas as pd

LTM_START, LTM_END = pd.Timestamp('2025-09-01'), pd.Timestamp('2026-08-31')
PRIOR_START = pd.Timestamp('2024-09-01')

OD_BINS = [0, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0, 6.0, 7.0, 9.01]
OD_LBL = ['0.625-1.000', '1.001-1.500', '1.501-2.000', '2.001-2.500', '2.501-3.000', '3.001-3.500',
          '3.501-4.000', '4.001-5.000', '5.001-6.000', '6.001-7.000', '7.001-9.000']
WALL_BINS = [0, .15, .20, .25, .30, .375, .45, .50, .70]
WALL_LBL = ['0.083-0.150', '0.151-0.200', '0.201-0.250', '0.251-0.300', '0.301-0.375', '0.376-0.450',
            '0.451-0.500', '0.501-0.625']
LEN_BINS = [0, 12, 20, 24, 30, 60]
LEN_LBL = ['<=12 ft', '12-20 ft', '20-24 ft', '24-30 ft', '>30 ft']
ORD_BINS = [-1e9, 2, 5, 10, 20, 1e9]
ORD_LBL = ['<2 t', '2-5 t', '5-10 t', '10-20 t', '>20 t']


def load(path):
    df = pd.read_excel(path)
    df = df.rename(columns={'Customer A B (i.e.key account vs bread and butter)': 'Cust AB (source)',
                            'Pocket Margin $': 'PM', 'Qty (tons)': 'Tons', 'Price Per Ton': 'Price',
                            'Raw HOL Material': 'HOL', 'Part ID': 'Part'})
    df['Date'] = pd.to_datetime(df['Date'])
    df['row_id'] = np.arange(len(df))
    df['Rev'] = df['Tons'] * df['Price'].fillna(0)
    df['Seg'] = np.where(df['Proc'] == 'EW', 'EW', 'Non-EW')
    df['LTM'] = (df['Date'] >= LTM_START) & (df['Date'] <= LTM_END)
    df['PRIOR'] = (df['Date'] >= PRIOR_START) & (df['Date'] < LTM_START)
    df['OD Band'] = pd.cut(df['OD (in)'], OD_BINS, labels=OD_LBL).astype(str)
    df['Wall Band'] = pd.cut(df['Wall (in)'], WALL_BINS, labels=WALL_LBL).astype(str)
    df['Len Band'] = pd.cut(df['Max Length (ft)'], LEN_BINS, labels=LEN_LBL).astype(str)
    df['Order Band'] = pd.cut(df['Total Order Size (tons)'], ORD_BINS, labels=ORD_LBL).astype(str)
    df['Mat'] = df['Material'].map(lambda m: f'M{int(m)}' if pd.notna(m) else None)
    df['CUST'] = df['CUST'].map(lambda c: f'C{int(c)}' if pd.notna(c) else None)
    return df


def split_scope(df):
    """Returns (in_scope, excluded-with-reason)."""
    reason = pd.Series('', index=df.index)
    reason[df['M&M (out of scope)'] == 'Yes'] = 'M&M flagged out of scope'
    reason[(reason == '') & df['CUST'].isna()] = 'Missing customer'
    reason[(reason == '') & df['HOL'].isna()] = 'Missing Raw HOL / attributes'
    ex = df[reason != ''].assign(**{'Exclusion Reason': reason[reason != '']})
    return df[reason == ''].copy(), ex
