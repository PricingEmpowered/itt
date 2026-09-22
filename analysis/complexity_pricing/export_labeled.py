"""Writes every in-scope transaction row with its customer / hollow labels (values, default Inputs).

Run:  python export_labeled.py [output.xlsx]
"""
import pickle
import sys

import pandas as pd

R = pickle.load(open('results.pkl', 'rb'))
out = sys.argv[1] if len(sys.argv) > 1 else 'ITT_Labeled_Data.xlsx'
df, hol, cust = R['df'], R['hol'], R['cust']
lab = df.copy()
lab['Cust Pareto Class'] = lab.CUST.map(cust.Class)
lab['Cust Price Tier'] = lab.CUST.map(cust.Tier.where(~cust.Distributor, 'Dist'))
lab['Cust Distributor Flag'] = lab.CUST.map(cust.Distributor).map({True: 'Move to Distributor', False: 'Direct'})
lab['HOL Pareto Class'] = lab.HOL.map(hol.Class)
lab['HOL Cx Score'] = lab.HOL.map(hol.CxScore)
lab['HOL Cx Flag'] = lab.HOL.map(hol.CxFlag)
lab['HOL B Priority'] = lab.HOL.map(hol.Priority.replace(0, pd.NA))
lab['HOL Decision'] = lab.HOL.map(hol.DefaultDecision)
lab['HOL Substitute'] = lab.HOL.map(hol.Sub)
cols = ['Date', 'CUST', 'Part', 'HOL', 'Seg', 'Proc', 'Mat', 'OD (in)', 'Wall (in)', 'Finish', 'LT', 'Order Type',
        'Tons', 'Price', 'Rev', 'PM', 'Hollow Pulls', 'LTM', 'Cust Pareto Class', 'Cust Price Tier',
        'Cust Distributor Flag', 'HOL Pareto Class', 'HOL Cx Score', 'HOL Cx Flag', 'HOL B Priority', 'HOL Decision',
        'HOL Substitute']
lab = lab.sort_values('Date')[cols].rename(columns={'Seg': 'Segment', 'Mat': 'Material', 'Rev': 'Revenue',
                                                   'PM': 'Pocket Margin $', 'Price': 'Price Per Ton',
                                                   'Tons': 'Qty (tons)', 'HOL': 'Raw HOL', 'Part': 'Part ID',
                                                   'LTM': 'In LTM'})
with pd.ExcelWriter(out, engine='openpyxl') as xw:
    lab.to_excel(xw, sheet_name='Labeled Data', index=False)
    ws = xw.sheets['Labeled Data']
    ws.freeze_panes = 'A2'
    ws.auto_filter.ref = ws.dimensions
print('saved', out, len(lab))
