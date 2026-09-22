"""Builds the formula-driven deliverable workbook from results.pkl (see analysis.py).

Run:  python build_workbook.py [output.xlsx]
"""
import pickle
import sys

import numpy as np
import pandas as pd
from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.formatting.rule import CellIsRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter as CL
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.worksheet.datavalidation import DataValidation

from analysis import (PARETO, CX, SUB_TOL, CANCEL_REV, CANCEL_NEG_REV, TIER_CUTS, DIST_REV, DIST_ORDERS,
                      TIER_DISC, TIER_CAP, TIER_NAME, SNAP_TOL)
from prep import OD_LBL, WALL_LBL, LEN_LBL, ORD_LBL, LTM_START, LTM_END

R = pickle.load(open('results.pkl', 'rb'))
OUT = sys.argv[1] if len(sys.argv) > 1 else 'ITT_Complexity_Pricing_Model.xlsx'

# ------------------------------------------------------------------ styling helpers
FN = 'Arial'
BLUE, GREEN, BLACK, WHITE = '0000FF', '008000', '000000', 'FFFFFF'
F_HDR = PatternFill('solid', fgColor='1F3864')
F_SUB = PatternFill('solid', fgColor='D9E1F2')
F_IN = PatternFill('solid', fgColor='FFFF00')
F_GREY = PatternFill('solid', fgColor='E7E6E6')
F_A = PatternFill('solid', fgColor='E2EFDA')
THIN = Side(style='thin', color='BFBFBF')
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
USD = '$#,##0;($#,##0);"-"'
USD2 = '$#,##0.00;($#,##0.00);"-"'
PCT = '0.0%;(0.0%);"-"'
NUM = '#,##0;(#,##0);"-"'
TON = '#,##0.0;(#,##0.0);"-"'
DATE = 'yyyy-mm-dd'


def f(color=BLACK, bold=False, italic=False, size=10):
    return Font(name=FN, color=color, bold=bold, italic=italic, size=size)


def put(ws, r, c, v, fmt=None, color=BLACK, bold=False, italic=False, fill=None, wrap=False, size=10,
        border=False, align=None):
    cell = ws.cell(row=r, column=c, value=v)
    cell.font = f(color, bold, italic, size)
    if fmt:
        cell.number_format = fmt
    if fill:
        cell.fill = fill
    if wrap or align:
        cell.alignment = Alignment(wrap_text=wrap, vertical='top', horizontal=align)
    if border:
        cell.border = BOX
    return cell


def title(ws, text, sub=None):
    put(ws, 1, 1, text, bold=True, size=14, color='1F3864')
    if sub:
        put(ws, 2, 1, sub, italic=True, color='595959')


def header(ws, r, headers, c0=1, widths=None, height=42):
    for i, h in enumerate(headers):
        cell = put(ws, r, c0 + i, h, color=WHITE, bold=True, fill=F_HDR, wrap=True, border=True)
        cell.alignment = Alignment(wrap_text=True, vertical='center', horizontal='center')
        if widths:
            ws.column_dimensions[CL(c0 + i)].width = widths[i]
    ws.row_dimensions[r].height = height


class Cols:
    """Column registry: spec = [(key, header, width, number_format)]."""
    def __init__(self, spec, c0=1):
        self.spec = spec
        self.L = {k: CL(c0 + i) for i, (k, *_ ) in enumerate(spec)}
        self.i = {k: c0 + i for i, (k, *_ ) in enumerate(spec)}

    def __getitem__(self, k):
        return self.L[k]

    def write_header(self, ws, r):
        header(ws, r, [s[1] for s in self.spec], self.i[self.spec[0][0]], [s[2] for s in self.spec])


def name(wb, nm, ref):
    wb.defined_names[nm] = DefinedName(nm, attr_text=ref)


def q(sheet):
    return f"'{sheet}'"


def note(ws, r, c, text):
    ws.cell(row=r, column=c).comment = Comment(text, 'Analysis')


# ------------------------------------------------------------------ data
hol, cust, pr = R['hol'].copy(), R['cust'].copy(), R['pricing'].copy()
fits, tiers, uplift = R['fits'], R['tiers'], R['uplift']
fc, seas, bt = R['forecast'].copy(), R['seas'], R['backtest']
df, excluded = R['df'], R['excluded']

S_IN, S_EX = 'Inputs', 'Exec Summary'
S_CP, S_HP, S_DM, S_SS = '1a Cust Pareto', '1b HOL Pareto', '1c HOL Decision Model', '1d Scenario Summary'
S_RN, S_RE, S_PN, S_PE = '2a Regression Non-EW', '2b Regression EW', '2c Price List Non-EW', '2d Price List EW'
S_TS, S_PD, S_PS, S_IC, S_IA = ('2e Tier Structure', '2f Pricing Detail', '2g Price List Summary',
                                '2h Impact by Customer', '2i Impact by Attribute')
S_XR, S_DT, S_FD, S_FS = '3a Exception Report', '3b Distributor Transfer', '4a Forecast Detail', '4b Forecast Summary'
S_LD, S_XD, S_RM = 'Labeled Data', 'Excluded Data', 'Read Me'

wb = Workbook()
wb.remove(wb.active)
sheets = {}
for s in [S_RM, S_IN, S_EX, S_CP, S_HP, S_DM, S_SS, S_RN, S_RE, S_PN, S_PE, S_TS, S_PD, S_PS, S_IC, S_IA,
          S_XR, S_DT, S_FD, S_FS, S_XD]:
    sheets[s] = wb.create_sheet(s)
    sheets[s].sheet_properties.tabColor = {'R': '7F7F7F', 'I': 'FFC000', 'E': '1F3864', '1': '2F75B5',
                                           '2': '548235', '3': 'C55A11', '4': '7030A0', 'L': 'A6A6A6'}[s[0]]
    sheets[s].sheet_view.showGridLines = False

# ================================================================== INPUTS
ws = sheets[S_IN]
title(ws, 'Inputs & Scenario Levers',
      'Yellow cells with blue text are editable. Every other sheet recalculates from these cells.')
ws.column_dimensions['A'].width = 3
ws.column_dimensions['B'].width = 58
for c in 'CDEFG':
    ws.column_dimensions[c].width = 14
ws.column_dimensions['H'].width = 90
row = 4


def section(text):
    global row
    row += 1
    put(ws, row, 2, text, bold=True, color=WHITE, fill=F_HDR)
    for c in range(3, 9):
        ws.cell(row=row, column=c).fill = F_HDR
    row += 1


def inp(nm, label, val, fmt, why):
    global row
    put(ws, row, 2, label)
    put(ws, row, 3, val, fmt=fmt, color=BLUE, fill=F_IN, border=True)
    put(ws, row, 8, why, italic=True, color='595959', wrap=False)
    name(wb, nm, f"{q(S_IN)}!$C${row}")
    row += 1


section('1. Pareto (80/20) and complexity scoring')
inp('ParetoCut', 'Pareto A/B cut-off (cumulative LTM revenue share)', PARETO, PCT,
    'User spec: 80/20. Items whose preceding cumulative share is below this are A.')
inp('CxPulls', 'Complexity driver: hollow pulls at or above', CX['multi_pull'], NUM,
    'Assumption. Source "Hollow Complexity Flag" is 0 on every row, so complexity is re-derived from 5 drivers.')
inp('CxParts', 'Complexity driver: finished part numbers per hollow at or above', CX['parts'], NUM,
    'Assumption: part-number proliferation on one hollow.')
inp('CxOrders', 'Complexity driver: LTM shipments at or below (low velocity)', CX['orders'], NUM,
    'Assumption: shipment = distinct customer + ship date with positive tons.')
inp('CxTons', 'Complexity driver: LTM tons below (low volume)', CX['tons'], TON, 'Assumption.')
inp('CxFlagScore', 'Complexity flag = 1 when driver score is at least', CX['flag_score'], NUM,
    'Drivers: multi-pull, proliferation, low velocity, low volume, negative pocket margin.')

section('2. B-hollow decision rules (recommendation logic in 1c; override per hollow there)')
inp('CancelRev', 'Cancel if no substitute and LTM revenue below ($)', CANCEL_REV, USD,
    'Assumption. Hollows with zero LTM revenue are always Cancel.')
inp('CancelNegRev', 'Cancel if no substitute, pocket margin <= 0 and LTM revenue below ($)', CANCEL_NEG_REV, USD,
    'Assumption. Larger negative-margin hollows are sent to Raise Price instead.')
inp('AggInc', 'Aggressive price increase for "Raise Price" hollows (default; override per hollow in 1c)', 0.20, PCT,
    'User-defined lever.')
inp('MatShare', 'Metal share of non-margin cost (drives rationalisation yield penalty)', 0.70, PCT,
    'Assumption; replace with standard-cost data if available.')
put(ws, row, 2, f'Substitute tolerance used in the substitute search: A hollow, same segment / process / material / '
                f'finish, max OD within +{SUB_TOL["od"]}" and max wall within +{SUB_TOL["wall"]}" of the B hollow.',
    italic=True, color='595959')
row += 1

section('3. Scenario assumptions (Best / Mid / Worst)')
put(ws, row, 2, 'Lever', bold=True, fill=F_SUB)
for j, h in enumerate(['Best', 'Mid', 'Worst']):
    put(ws, row, 3 + j, h, bold=True, fill=F_SUB, align='center')
row += 1
SCEN = [('RetRat', 'Rationalize: share of volume that migrates to the substitute', (0.95, 0.85, 0.70), PCT,
         'Assumption. Lost volume takes its pocket margin with it.'),
        ('RetRaise', 'Raise Price: share of volume retained after the increase', (0.90, 0.75, 0.50), PCT,
         'Assumption (price elasticity). Retained volume keeps the full increase as margin.'),
        ('Recap', 'Cancel: share of volume recaptured on other products we still sell', (0.30, 0.15, 0.0), PCT,
         'Assumption.'),
        ('SavePull', 'Complexity cost removed per eliminated hollow, per pull ($/yr)', (6000, 4000, 2000), USD,
         'PLACEHOLDER assumption (set-ups, scheduling, inventory, quality). Validate with operations.')]
for key, label, vals, fmt, why in SCEN:
    put(ws, row, 2, label)
    for j, (case, v) in enumerate(zip(['Best', 'Mid', 'Worst'], vals)):
        put(ws, row, 3 + j, v, fmt=fmt, color=BLUE, fill=F_IN, border=True)
        name(wb, f'{key}_{case}', f"{q(S_IN)}!${CL(3 + j)}${row}")
    put(ws, row, 8, why, italic=True, color='595959')
    row += 1

section('4. Standard price list and customer tiers')
inp('ListUplift', 'List-price uplift over the regression market price', float(uplift), PCT,
    'Calibrated so the tier ladder below is revenue-neutral on LTM volume before caps/holds, rounded up to 0.5%.')
inp('PriceRound', 'Round list prices and adders to nearest ($/ton)', 5, USD, 'Presentation.')
inp('HoldAbove', 'Hold current price when it is above the tier price (1 = hold, 0 = move down to list)', 1, NUM,
    'Policy choice. 1 = no price decreases beyond the snap tolerance below.')
inp('SnapTol', 'Snap-to-list tolerance: current price up to this % above tier price moves down to list', SNAP_TOL, PCT,
    'Policy choice: small give-backs buy a much simpler price file.')
row += 1
put(ws, row, 2, 'Tier', bold=True, fill=F_SUB)
for j, h in enumerate(['Tier #', 'Cum. rev cut-off', 'Discount off list', 'Increase cap', 'Tier name']):
    put(ws, row, 3 + j, h, bold=True, fill=F_SUB, align='center', wrap=True)
row += 1
t0 = row
for t in range(1, 6):
    put(ws, row, 2, f'Tier {t}')
    put(ws, row, 3, t)
    put(ws, row, 4, (TIER_CUTS + [1.0])[t - 1], PCT, BLUE, fill=F_IN, border=True)
    put(ws, row, 5, TIER_DISC[t], PCT, BLUE, fill=F_IN, border=True)
    put(ws, row, 6, TIER_CAP[t], PCT, BLUE, fill=F_IN, border=True)
    put(ws, row, 7, TIER_NAME[t], color=BLUE, fill=F_IN, border=True)
    row += 1
name(wb, 'TierCut', f"{q(S_IN)}!$D${t0}:$D${t0 + 4}")
name(wb, 'TierDisc', f"{q(S_IN)}!$E${t0}:$E${t0 + 4}")
name(wb, 'TierCap', f"{q(S_IN)}!$F${t0}:$F${t0 + 4}")
name(wb, 'TierName', f"{q(S_IN)}!$G${t0}:$G${t0 + 4}")
put(ws, t0, 8, 'Customers are tiered by cumulative LTM revenue (largest first). Tier 1 = largest accounts, deepest '
               'discount, lowest cap.', italic=True, color='595959')
put(ws, t0 + 1, 8, 'Discount ladder and caps are recommended policy settings (assumptions); edit freely.',
    italic=True, color='595959')

section('5. Distributor hand-off (user rule)')
inp('DistRev', 'Move to distributor if average annual revenue below ($)', DIST_REV, USD,
    'User spec: < $5K a year. Averaged over the calendar years the customer bought (2023-2026).')
inp('DistOrders', '... and average annual shipments at or below', DIST_ORDERS, NUM,
    'User spec: 2x a year. Applied on averages because an LTM-only test flags only lapsed accounts.')

section('6. Forecast')
inp('GrowthCap', 'Cap on year-over-year growth / decline used in the forecast (+/-)', 0.25, PCT, 'Assumption.')
inp('Damping', 'Share of capped YoY trend carried into the next 12 months', 0.50, PCT,
    'Assumption; back-tested in 4b.')
put(ws, row, 2, 'Forecast volume on Rationalize / Raise Price hollows is multiplied by the Mid-case retention above.',
    italic=True, color='595959')
row += 2
put(ws, row, 2, 'Colour legend', bold=True)
put(ws, row + 1, 2, 'Blue text on yellow = editable input', color=BLUE, fill=F_IN)
put(ws, row + 2, 2, 'Blue text = hard-coded value from the data or the regression', color=BLUE)
put(ws, row + 3, 2, 'Black text = formula', color=BLACK)
put(ws, row + 4, 2, 'Green text = link to another sheet', color=GREEN)

# ================================================================== 1b HOL PARETO
ws = sheets[S_HP]
title(ws, 'Deliverable 1 - Raw HOL Pareto (80/20) with complexity scoring',
      f'LTM = {LTM_START:%d-%b-%Y} to {LTM_END:%d-%b-%Y}. Sorted by LTM revenue. One A/B label per hollow '
      '(every row of a hollow carries the same label - see companion file ITT_Labeled_Data.xlsx).')
HPC = Cols([('rank', 'Rev Rank', 7, NUM), ('hol', 'Raw HOL', 10, None), ('seg', 'Segment', 9, None),
            ('proc', 'Proc', 7, None), ('mat', 'Material', 8, None), ('fin', 'Finish', 7, None),
            ('pulls', 'Hollow Pulls', 8, NUM), ('src', 'Source Cx Flag', 8, NUM),
            ('odmin', 'Min OD (in)', 8, '0.000'), ('odmax', 'Max OD (in)', 8, '0.000'),
            ('wmin', 'Min Wall (in)', 8, '0.000'), ('wmax', 'Max Wall (in)', 8, '0.000'),
            ('parts', 'Part #s (all time)', 9, NUM), ('partsl', 'Part #s (LTM)', 8, NUM),
            ('custs', 'Customers (LTM)', 9, NUM), ('orders', 'Shipments (LTM)', 9, NUM),
            ('tons', 'LTM Tons', 10, TON), ('rev', 'LTM Revenue', 13, USD), ('pm', 'LTM Pocket Margin', 13, USD),
            ('pmp', 'PM %', 8, PCT), ('share', 'Rev Share', 8, '0.00%'), ('cum', 'Cum Share', 8, PCT),
            ('cls', 'Pareto Class', 8, None),
            ('d1', 'Drv: Multi-pull', 8, NUM), ('d2', 'Drv: Part prolif.', 8, NUM), ('d3', 'Drv: Low velocity', 8, NUM),
            ('d4', 'Drv: Low volume', 8, NUM), ('d5', 'Drv: Neg. PM', 8, NUM), ('score', 'Cx Score', 7, NUM),
            ('flag', 'Cx Flag', 7, NUM), ('key', 'Priority Key', 14, '0'), ('prio', 'B Priority Rank', 9, NUM),
            ('top', 'Top Customer (LTM)', 10, None), ('last', 'Last Sale', 11, DATE),
            ('revall', 'Revenue Jan-23 to Aug-26', 13, USD)])
HR0 = 5
HPC.write_header(ws, HR0 - 1)
hol_rows = {}
n = len(hol)
last = HR0 + n - 1
for i, (h, x) in enumerate(hol.iterrows()):
    r = HR0 + i
    hol_rows[h] = r
    L = HPC
    vals = {'rank': i + 1, 'hol': h, 'seg': x.Seg, 'proc': x.Proc, 'mat': x.Mat, 'fin': x.Finish,
            'pulls': int(x.Pulls), 'src': int(x.SrcFlag), 'odmin': x.ODmin, 'odmax': x.ODmax, 'wmin': x.Wmin,
            'wmax': x.Wmax, 'parts': int(x.PartsAll), 'partsl': int(x.Parts), 'custs': int(x.Custs),
            'orders': int(x.Orders), 'tons': x.Tons, 'rev': x.Rev, 'pm': x.PM,
            'top': x.TopCust if isinstance(x.TopCust, str) else '', 'last': x.LastSale.to_pydatetime(),
            'revall': x.RevAll}
    for k, v in vals.items():
        put(ws, r, L.i[k], v, dict((s[0], s[3]) for s in L.spec)[k], BLUE)
    put(ws, r, L.i['pmp'], f'=IF({L["rev"]}{r}>0,{L["pm"]}{r}/{L["rev"]}{r},0)', PCT)
    put(ws, r, L.i['share'], f'=MAX({L["rev"]}{r},0)/SUMIF(${L["rev"]}${HR0}:${L["rev"]}${last},">0")', '0.00%')
    put(ws, r, L.i['cum'], f'=SUM(${L["share"]}${HR0}:{L["share"]}{r})', PCT)
    put(ws, r, L.i['cls'], f'=IF(AND({L["cum"]}{r}-{L["share"]}{r}<ParetoCut,{L["rev"]}{r}>0),"A","B")')
    put(ws, r, L.i['d1'], f'=IF({L["pulls"]}{r}>=CxPulls,1,0)', NUM)
    put(ws, r, L.i['d2'], f'=IF({L["parts"]}{r}>=CxParts,1,0)', NUM)
    put(ws, r, L.i['d3'], f'=IF({L["orders"]}{r}<=CxOrders,1,0)', NUM)
    put(ws, r, L.i['d4'], f'=IF({L["tons"]}{r}<CxTons,1,0)', NUM)
    put(ws, r, L.i['d5'], f'=IF({L["pm"]}{r}<0,1,0)', NUM)
    put(ws, r, L.i['score'], f'=SUM({L["d1"]}{r}:{L["d5"]}{r})', NUM)
    put(ws, r, L.i['flag'], f'=IF({L["score"]}{r}>=CxFlagScore,1,0)', NUM)
    # B priority: more pulls first, then complexity flag, then score, then smallest revenue
    put(ws, r, L.i['key'], f'={L["pulls"]}{r}*1E10+{L["flag"]}{r}*1E9+{L["score"]}{r}*1E8+(1E8-MIN({L["rev"]}{r},99999999))', '0')
    put(ws, r, L.i['prio'], f'=IF({L["cls"]}{r}="B",COUNTIFS(${L["cls"]}${HR0}:${L["cls"]}${last},"B",'
                            f'${L["key"]}${HR0}:${L["key"]}${last},">"&{L["key"]}{r})+1,"")', NUM)
ws.freeze_panes = ws.cell(row=HR0, column=3)
ws.auto_filter.ref = f"A{HR0 - 1}:{CL(len(HPC.spec))}{last}"
ws.conditional_formatting.add(f'{HPC["cls"]}{HR0}:{HPC["cls"]}{last}',
                              CellIsRule(operator='equal', formula=['"A"'], fill=F_A))
put(ws, 3, 1, 'Complexity drivers and flag are formulas on the Inputs thresholds. Source "Hollow Complexity Flag" '
              'is 0 on every row of the data set, so it is shown for reference only.', italic=True, color='595959')
HP_RNG = lambda k: f"{q(S_HP)}!${HPC[k]}${HR0}:${HPC[k]}${last}"

# ================================================================== 1a CUSTOMER PARETO
ws = sheets[S_CP]
title(ws, 'Deliverable 1 - Customer (Parent) Pareto (80/20), tiers and distributor flag',
      'Sorted by LTM revenue. Tier and distributor flag feed the price list (2f) and forecast (4a).')
CPC = Cols([('rank', 'Rev Rank', 7, NUM), ('cust', 'CUST', 8, None), ('src', 'Source A/B', 8, None),
            ('parent', 'Parent Revenue (source)', 14, USD), ('rev', 'LTM Revenue', 13, USD),
            ('tons', 'LTM Tons', 10, TON), ('pm', 'LTM Pocket Margin', 13, USD), ('pmp', 'PM %', 8, PCT),
            ('orders', 'LTM Shipments', 9, NUM), ('parts', 'LTM Part #s', 8, NUM), ('hols', 'LTM Hollows', 8, NUM),
            ('bh', 'B Hollows (default 80%)', 10, NUM), ('mp', 'Multi-pull Hollows', 9, NUM),
            ('cx', 'Complex Hollows', 9, NUM), ('share', 'Rev Share', 8, '0.00%'), ('cum', 'Cum Share', 8, PCT),
            ('cls', 'Pareto Class', 8, None), ('ay', 'Active Years (2023-26)', 7, NUM),
            ('avgr', 'Avg Annual Revenue (active yrs)', 12, USD), ('avgs', 'Avg Annual Shipments', 8, '0.0'),
            ('dist', 'Distributor Flag', 16, None), ('status', 'Status', 18, None), ('tier', 'Price Tier', 7, None),
            ('tname', 'Tier Name', 13, None), ('key', 'Cx Key', 10, '0'), ('prio', 'B Cust Complexity Rank', 10, NUM),
            ('last', 'Last Sale', 11, DATE), ('revall', 'Revenue Jan-23 to Aug-26', 13, USD)])
CR0 = 5
CPC.write_header(ws, CR0 - 1)
cust_rows = {}
clast = CR0 + len(cust) - 1
for i, (c, x) in enumerate(cust.iterrows()):
    r = CR0 + i
    cust_rows[c] = r
    L = CPC
    vals = {'rank': i + 1, 'cust': c, 'src': x.SrcAB, 'parent': x.ParentRev, 'rev': x.Rev, 'tons': x.Tons,
            'pm': x.PM, 'orders': int(x.Orders), 'parts': int(x.Parts), 'hols': int(x.Hols), 'bh': int(x.B_Hols),
            'mp': int(x.MultiPullHols), 'cx': int(x.CxHols), 'last': x.LastSale.to_pydatetime(), 'revall': x.RevAll,
            'ay': int(x.ActiveYears), 'avgr': x.AvgRev, 'avgs': x.AvgShip}
    fm = dict((s[0], s[3]) for s in L.spec)
    for k, v in vals.items():
        put(ws, r, L.i[k], v, fm[k], BLUE)
    put(ws, r, L.i['pmp'], f'=IF({L["rev"]}{r}>0,{L["pm"]}{r}/{L["rev"]}{r},0)', PCT)
    put(ws, r, L.i['share'], f'=MAX({L["rev"]}{r},0)/SUMIF(${L["rev"]}${CR0}:${L["rev"]}${clast},">0")', '0.00%')
    put(ws, r, L.i['cum'], f'=SUM(${L["share"]}${CR0}:{L["share"]}{r})', PCT)
    put(ws, r, L.i['cls'], f'=IF(AND({L["cum"]}{r}-{L["share"]}{r}<ParetoCut,{L["rev"]}{r}>0),"A","B")')
    put(ws, r, L.i['dist'], f'=IF(AND({L["avgr"]}{r}<DistRev,{L["avgs"]}{r}<=DistOrders),"Move to Distributor","Direct")')
    put(ws, r, L.i['status'], f'=IF({L["dist"]}{r}="Move to Distributor","Move to Distributor",'
                              f'IF({L["rev"]}{r}<=0,"Lapsed - no LTM sales","Active direct"))')
    pv = f'({L["cum"]}{r}-{L["share"]}{r})'
    put(ws, r, L.i['tier'], f'=IF({L["dist"]}{r}="Move to Distributor","Dist",IF({pv}<INDEX(TierCut,1),1,'
                            f'IF({pv}<INDEX(TierCut,2),2,IF({pv}<INDEX(TierCut,3),3,IF({pv}<INDEX(TierCut,4),4,5)))))')
    put(ws, r, L.i['tname'], f'=IF(ISNUMBER({L["tier"]}{r}),INDEX(TierName,{L["tier"]}{r}),"Distributor")')
    put(ws, r, L.i['key'], f'={L["mp"]}{r}*1E6+{L["cx"]}{r}*1E3+{L["bh"]}{r}', '0')
    put(ws, r, L.i['prio'], f'=IF({L["cls"]}{r}="B",COUNTIFS(${L["cls"]}${CR0}:${L["cls"]}${clast},"B",'
                            f'${L["key"]}${CR0}:${L["key"]}${clast},">"&{L["key"]}{r})+1,"")', NUM)
ws.freeze_panes = ws.cell(row=CR0, column=3)
ws.auto_filter.ref = f"A{CR0 - 1}:{CL(len(CPC.spec))}{clast}"
ws.conditional_formatting.add(f'{CPC["cls"]}{CR0}:{CPC["cls"]}{clast}',
                              CellIsRule(operator='equal', formula=['"A"'], fill=F_A))
put(ws, 3, 1, '"Source A/B" is the key-account flag supplied in the data; "Pareto Class" is the 80/20 result on LTM '
              'revenue. B-customer complexity rank orders B customers by multi-pull hollows, then complex hollows.',
    italic=True, color='595959')
CP_RNG = lambda k: f"{q(S_CP)}!${CPC[k]}${CR0}:${CPC[k]}${clast}"

# ================================================================== 1c DECISION MODEL
ws = sheets[S_DM]
title(ws, 'Deliverable 1 - Hollow decision model: Rationalize / Cancel / Raise Price with Best-Mid-Worst impact',
      'Sorted by B priority (pulls, then complexity flag). Enter an override in the yellow column to change a decision; '
      'enter a hollow-specific increase to override the default aggressive increase.')
DMC = Cols([('prio', 'B Priority Rank', 8, NUM), ('hol', 'Raw HOL', 9, None), ('seg', 'Segment', 8, None),
            ('mat', 'Material', 7, None), ('cls', 'Pareto Class', 7, None), ('pulls', 'Pulls', 6, NUM),
            ('flag', 'Cx Flag', 6, NUM), ('score', 'Cx Score', 6, NUM), ('rev', 'LTM Revenue', 12, USD),
            ('pm', 'LTM Pocket Margin', 12, USD), ('tons', 'LTM Tons', 9, TON), ('custs', 'Customers', 7, NUM),
            ('top', 'Top Customer', 8, None), ('sub', 'Substitute A Hollow', 10, None),
            ('pen', 'Substitute Weight Penalty', 9, PCT), ('cpt', 'Non-margin Cost $/ton', 10, USD),
            ('rec', 'Recommended Action', 12, None), ('ovr', 'User Override', 12, None),
            ('fin', 'Final Decision', 12, None), ('iov', 'Increase Override %', 9, PCT),
            ('inc', 'Increase Applied %', 9, PCT),
            ('rb', 'Rev Impact BEST', 12, USD), ('rm', 'Rev Impact MID', 12, USD), ('rw', 'Rev Impact WORST', 12, USD),
            ('mb', 'PM Impact BEST', 12, USD), ('mm', 'PM Impact MID', 12, USD), ('mw', 'PM Impact WORST', 12, USD),
            ('elim', 'Hollow Eliminated', 8, NUM), ('pelim', 'Pulls Eliminated', 8, NUM)])
DR0 = 5
DMC.write_header(ws, DR0 - 1)
order = pd.concat([hol[hol.Class == 'B'].sort_values('Priority'), hol[hol.Class == 'A']])
dlast = DR0 + len(order) - 1
dm_rows = {}
dv = DataValidation(type='list', formula1='"Rationalize,Cancel,Raise Price,Keep (A)"', allow_blank=True)
ws.add_data_validation(dv)
for i, (h, x) in enumerate(order.iterrows()):
    r = DR0 + i
    dm_rows[h] = r
    hr = hol_rows[h]
    L = DMC
    link = lambda k: f"={q(S_HP)}!{HPC[k]}{hr}"
    for k, src in [('prio', 'prio'), ('hol', 'hol'), ('seg', 'seg'), ('mat', 'mat'), ('cls', 'cls'), ('pulls', 'pulls'),
                   ('flag', 'flag'), ('score', 'score'), ('rev', 'rev'), ('pm', 'pm'), ('tons', 'tons'),
                   ('custs', 'custs'), ('top', 'top')]:
        put(ws, r, L.i[k], link(src), dict((s[0], s[3]) for s in L.spec)[k], GREEN)
    put(ws, r, L.i['sub'], x.Sub if isinstance(x.Sub, str) else None, color=BLUE)
    put(ws, r, L.i['pen'], float(x.SubPenalty) if isinstance(x.Sub, str) else 0, PCT, BLUE)
    put(ws, r, L.i['cpt'], float(x.CostPerTon), USD, BLUE)
    c = lambda k: f'{L[k]}{r}'
    put(ws, r, L.i['rec'], f'=IF({c("cls")}="A","Keep (A)",IF({c("rev")}<=0,"Cancel",IF({c("sub")}<>"","Rationalize",'
                           f'IF(OR({c("rev")}<CancelRev,AND({c("pm")}<=0,{c("rev")}<CancelNegRev)),"Cancel","Raise Price"))))')
    put(ws, r, L.i['ovr'], None, color=BLUE, fill=F_IN, border=True)
    dv.add(f'{c("ovr")}')
    put(ws, r, L.i['fin'], f'=IF({c("ovr")}<>"",{c("ovr")},{c("rec")})', bold=True)
    put(ws, r, L.i['iov'], None, PCT, BLUE, fill=F_IN, border=True)
    put(ws, r, L.i['inc'], f'=IF({c("iov")}<>"",{c("iov")},AggInc)', PCT)
    for case, rk, mk in [('Best', 'rb', 'mb'), ('Mid', 'rm', 'mm'), ('Worst', 'rw', 'mw')]:
        rev, pm, tons, fin = c('rev'), c('pm'), c('tons'), c('fin')
        put(ws, r, L.i[rk], f'=IF({fin}="Cancel",-{rev}*(1-Recap_{case}),IF({fin}="Rationalize",-{rev}*(1-RetRat_{case}),'
                            f'IF({fin}="Raise Price",{rev}*(RetRaise_{case}*(1+{c("inc")})-1),0)))', USD)
        put(ws, r, L.i[mk], f'=IF({fin}="Cancel",-{pm}*(1-Recap_{case})+{c("pulls")}*SavePull_{case},'
                            f'IF({fin}="Rationalize",-{pm}*(1-RetRat_{case})-RetRat_{case}*{tons}*{c("pen")}*{c("cpt")}*MatShare'
                            f'+{c("pulls")}*SavePull_{case},'
                            f'IF({fin}="Raise Price",RetRaise_{case}*({pm}+{rev}*{c("inc")})-{pm},0)))', USD)
    put(ws, r, L.i['elim'], f'=IF(OR({c("fin")}="Cancel",{c("fin")}="Rationalize"),1,0)', NUM)
    put(ws, r, L.i['pelim'], f'={c("elim")}*{c("pulls")}', NUM)
ws.freeze_panes = ws.cell(row=DR0, column=3)
ws.auto_filter.ref = f"A{DR0 - 1}:{CL(len(DMC.spec))}{dlast}"
put(ws, 3, 1, 'Impact = change vs LTM run-rate (annual $). Rationalize: lost volume loses its margin; migrated volume '
              'pays a metal penalty for the heavier substitute hollow; complexity cost is removed. Raise Price: retained '
              'volume keeps the full increase. Cancel: recaptured share keeps its margin.', italic=True, color='595959')
DM_RNG = lambda k: f"{q(S_DM)}!${DMC[k]}${DR0}:${DMC[k]}${dlast}"

# ================================================================== 1d SCENARIO SUMMARY
ws = sheets[S_SS]
title(ws, 'Deliverable 1 - Complexity reduction scenario summary', 'All figures annual, vs LTM run-rate. Live from 1c.')
heads = ['Final Decision', 'Hollows', 'Hollow Pulls', 'LTM Revenue', 'LTM Pocket Margin', 'LTM Tons',
         'Rev Impact BEST', 'Rev Impact MID', 'Rev Impact WORST', 'PM Impact BEST', 'PM Impact MID', 'PM Impact WORST']
header(ws, 4, heads, widths=[22, 9, 9, 14, 14, 11, 14, 14, 14, 14, 14, 14])
decs = ['Rationalize', 'Cancel', 'Raise Price', 'Keep (A)']
for i, d in enumerate(decs):
    r = 5 + i
    put(ws, r, 1, d, bold=True)
    put(ws, r, 2, f'=COUNTIF({DM_RNG("fin")},A{r})', NUM)
    put(ws, r, 3, f'=SUMIF({DM_RNG("fin")},A{r},{DM_RNG("pulls")})', NUM)
    for j, k in enumerate(['rev', 'pm', 'tons', 'rb', 'rm', 'rw', 'mb', 'mm', 'mw']):
        put(ws, r, 4 + j, f'=SUMIF({DM_RNG("fin")},$A{r},{DM_RNG(k)})', TON if k == 'tons' else USD)
put(ws, 9, 1, 'Total', bold=True)
for j in range(2, 13):
    put(ws, 9, j, f'=SUM({CL(j)}5:{CL(j)}8)', TON if j == 6 else (NUM if j < 4 else USD), bold=True)
put(ws, 10, 1, 'Impact as % of LTM total', italic=True)
for j in range(7, 13):
    col = 'D' if j < 10 else 'E'
    put(ws, 10, j, f'=IF(${col}$9<>0,{CL(j)}9/${col}$9,0)', PCT, italic=True)

put(ws, 12, 1, 'Complexity reduction', bold=True, size=11, color='1F3864')
header(ws, 13, ['Metric', 'Before', 'After', 'Change', '% Change'])
put(ws, 14, 1, 'Active raw hollows')
put(ws, 14, 2, f'=COUNTA({DM_RNG("hol")})', NUM)
put(ws, 14, 3, '=B14-SUM(' + DM_RNG('elim') + ')', NUM)
put(ws, 15, 1, 'Hollow pulls (sum over hollows)')
put(ws, 15, 2, f'=SUM({DM_RNG("pulls")})', NUM)
put(ws, 15, 3, '=B15-SUM(' + DM_RNG('pelim') + ')', NUM)
put(ws, 16, 1, 'Multi-pull hollows (pulls >= 2)')
put(ws, 16, 2, f'=COUNTIF({DM_RNG("pulls")},">=2")', NUM)
put(ws, 16, 3, f'=B16-COUNTIFS({DM_RNG("pulls")},">=2",{DM_RNG("elim")},1)', NUM)
put(ws, 17, 1, 'Complexity-flagged hollows')
put(ws, 17, 2, f'=SUM({DM_RNG("flag")})', NUM)
put(ws, 17, 3, f'=B17-COUNTIFS({DM_RNG("flag")},1,{DM_RNG("elim")},1)', NUM)
for r in range(14, 18):
    put(ws, r, 4, f'=C{r}-B{r}', NUM)
    put(ws, r, 5, f'=IF(B{r}<>0,D{r}/B{r},0)', PCT)

put(ws, 19, 1, 'By segment (Mid case)', bold=True, size=11, color='1F3864')
header(ws, 20, ['Segment / Decision', 'Hollows', 'Hollow Pulls', 'LTM Revenue', 'LTM Pocket Margin', 'LTM Tons',
                'Rev Impact MID', 'PM Impact MID'])
r = 21
for seg in ['Non-EW', 'EW']:
    for d in decs:
        put(ws, r, 1, f'{seg} - {d}')
        crit = f'{DM_RNG("seg")},"{seg}",{DM_RNG("fin")},"{d}"'
        put(ws, r, 2, f'=COUNTIFS({crit})', NUM)
        for j, k in enumerate(['pulls', 'rev', 'pm', 'tons', 'rm', 'mm']):
            put(ws, r, 3 + j, f'=SUMIFS({DM_RNG(k)},{crit})', TON if k == 'tons' else (NUM if k == 'pulls' else USD))
        r += 1

r += 1
put(ws, r, 1, 'Top 25 B-priority hollows (most pulls / complexity first)', bold=True, size=11, color='1F3864')
r += 1
header(ws, r, ['Priority', 'Raw HOL', 'Pulls', 'Cx Flag', 'LTM Revenue', 'Final Decision', 'Substitute',
               'PM Impact MID'])
for i in range(25):
    rr = r + 1 + i
    src = DR0 + i
    for j, k in enumerate(['prio', 'hol', 'pulls', 'flag', 'rev', 'fin', 'sub', 'mm']):
        put(ws, rr, 1 + j, f"={q(S_DM)}!{DMC[k]}{src}", USD if k in ('rev', 'mm') else None, GREEN)

# ================================================================== 2a/2b REGRESSIONS
coef_cell = {}


def regression_sheet(ws, seg, sheetname):
    fit = fits[seg]
    st = fit['stats']
    title(ws, f'Deliverable 2 - Price regression, {seg} ({"Proc D / CD / CF" if seg == "Non-EW" else "Proc EW"})',
          'Weighted least squares on $/ton, weighted by tons. Estimated separately for EW and Non-EW (separate businesses).')
    info = [('Observations (invoice lines)', st['n'], NUM), ('Tons', st['tons'], TON), ('R-squared', st['r2'], '0.000'),
            ('Adj. R-squared', st['adj_r2'], '0.000'), ('Weighted MAPE (in-sample)', st['wmape'], PCT),
            ('Window start', st['start'].to_pydatetime(), DATE), ('Window end', st['end'].to_pydatetime(), DATE),
            ('Price trimmed below ($/t, 1st pct)', st['trim_lo'], USD), ('Price trimmed above ($/t, 99th pct)', st['trim_hi'], USD)]
    for i, (k, v, fm) in enumerate(info):
        put(ws, 4 + i, 1, k)
        put(ws, 4 + i, 2, v, fm, BLUE)
    spec = ('Price/ton = Intercept + OD band + Wall band + Material + Process + Finish + Length type + Length band + '
            'Order-size band + Year' if seg == 'Non-EW' else
            'Price/ton = Intercept + Material|OD band|Wall band cell + Order-size band + Year  (EW is SKU-like: each '
            'material occupies a few size cells and each cell has one length, so cells are priced directly)')
    put(ws, 14, 1, 'Specification: ' + spec, italic=True)
    put(ws, 15, 1, 'Data: in-scope invoice lines Sep-2024 to Aug-2026 with positive tons and a price. Reference year 2026 '
                   '(list prices are at the 2026 price level). Reference levels have a coefficient of 0.', italic=True)
    header(ws, 17, ['Factor', 'Level', 'Coefficient ($/ton)', 'Std Error', 't-stat', 'p-value', 'Significant (p<0.05)',
                    'Use in list (1/0)', 'Note'], widths=[16, 30, 14, 11, 9, 9, 11, 10, 40])
    co = fit['coef']
    r = 18
    rows = [('Intercept', '(reference)', 'const')]
    for fct, lv in fit['levels'].items():
        for j, l in enumerate(lv):
            rows.append((fct, l, None if j == 0 else f'{fct}={l}'))
    for fct, lv, term in rows:
        put(ws, r, 1, fct)
        put(ws, r, 2, lv)
        if term is None:
            put(ws, r, 3, 0, USD2, BLUE)
            put(ws, r, 9, 'reference level', italic=True, color='595959')
            put(ws, r, 8, 1, NUM, BLUE)
        else:
            x = co.loc[term]
            put(ws, r, 3, float(x.coef), USD2, BLUE)
            put(ws, r, 4, float(x.se), USD2, BLUE)
            put(ws, r, 5, float(x.t), '0.00', BLUE)
            put(ws, r, 6, float(x.p), '0.000', BLUE)
            put(ws, r, 7, f'=IF(F{r}<0.05,"Yes","No")')
            # structural terms (size, material, process, cell) always price; commercial adders only when significant
            structural = fct in ('Intercept', 'OD Band', 'Wall Band', 'Mat', 'Proc', 'Cell', 'Year')
            put(ws, r, 8, 1 if (structural or x.p < 0.05) else 0, NUM, BLUE, fill=F_IN, border=True)
            if not structural and x.p >= 0.05:
                put(ws, r, 9, 'not significant - excluded from list adders (set to 1 to include)', italic=True,
                    color='595959')
        coef_cell[(seg, fct, lv if term != 'const' else 'const')] = f"{q(sheetname)}!$C${r}"
        coef_cell[(seg, fct, (lv if term != 'const' else 'const'), 'use')] = f"{q(sheetname)}!$H${r}"
        r += 1
    ws.freeze_panes = 'A18'


regression_sheet(sheets[S_RN], 'Non-EW', S_RN)
regression_sheet(sheets[S_RE], 'EW', S_RE)
cc = lambda seg, fct, lv: coef_cell[(seg, fct, lv)]
cu = lambda seg, fct, lv: coef_cell[(seg, fct, lv, 'use')]
ROUNDP = lambda expr: f'ROUND(({expr})*(1+ListUplift)/PriceRound,0)*PriceRound'

# ================================================================== 2c PRICE LIST NON-EW
grids = []   # (sheet, seg, mat, proc, range, observed_cells)


def adder_block(ws, seg, r, factors, labels):
    put(ws, r, 1, f'Adders ($/ton, added to the base price; 2026 list level incl. list uplift)', bold=True, size=11,
        color='1F3864')
    r += 1
    header(ws, r, ['Attribute', 'Level', 'Adder $/ton', 'Regression coef', 'Used?'], height=30)
    r += 1
    for fct in factors:
        for lv in fits[seg]['levels'][fct]:
            put(ws, r, 1, labels[fct])
            put(ws, r, 2, lv + ('  (base)' if lv == fits[seg]['levels'][fct][0] else ''))
            put(ws, r, 3, '=' + ROUNDP(f'{cc(seg, fct, lv)}*{cu(seg, fct, lv)}'), USD, border=True)
            put(ws, r, 4, f'={cc(seg, fct, lv)}', USD2, GREEN)
            put(ws, r, 5, f'={cu(seg, fct, lv)}', NUM, GREEN)
            r += 1
    return r + 1


ws = sheets[S_PN]
title(ws, 'Deliverable 2 - Standard price list, Non-EW (Proc D / CD / CF): base $/ton by OD range x Wall range, '
          'one table per material',
      'Base = Random length, 20-24 ft, 5-10 ton order, SRA finish (CF tables are ASWD). Grey italic = no volume in this '
      'material/size in the last 24 months (price extrapolated by the model; confirm before quoting).')
for c, w in zip('ABCDEFGHIJ', [16, 12, 11, 11, 11, 11, 11, 11, 11, 11]):
    ws.column_dimensions[c].width = w
r = adder_block(ws, 'Non-EW', 4, ['LT', 'Len Band', 'Order Band', 'Finish'],
                {'LT': 'Length type', 'Len Band': 'Max length', 'Order Band': 'Order size', 'Finish': 'Finish'})
obs = fits['Non-EW']['observed']
combos = (df[df.Seg == 'Non-EW'].groupby(['Mat', 'Proc']).Tons.sum().reset_index())
combos['mn'] = combos.Mat.str[1:].astype(int)
combos = combos.sort_values(['mn', 'Proc'])
PROC_NAME = {'D': 'D', 'CD': 'CD', 'CF': 'CF'}
for _, cb in combos.iterrows():
    mat, proc = cb.Mat, cb.Proc
    put(ws, r, 1, f'Material {mat[1:]}  -  Proc {proc}   (base $/ton)', bold=True, size=11, color='1F3864')
    if mat == 'M5':
        put(ws, r, 4, 'Material 5 runs only on Proc D in this data (no CD/CF volume): this is the Material 5 list for the '
                      'Non-EW (D/CD/CF) business.', italic=True, color='C00000')
    r += 1
    header(ws, r, ['OD range (in) \\ Wall range (in)'] + WALL_LBL, height=30)
    g0 = r + 1
    for i, od in enumerate(OD_LBL):
        rr = g0 + i
        put(ws, rr, 1, od, bold=True, fill=F_SUB, border=True)
        for j, wl in enumerate(WALL_LBL):
            expr = (f'{cc("Non-EW", "Intercept", "const")}+{cc("Non-EW", "OD Band", od)}+{cc("Non-EW", "Wall Band", wl)}'
                    f'+{cc("Non-EW", "Mat", mat)}+{cc("Non-EW", "Proc", proc)}')
            seen = obs.get((mat, proc, od, wl), 0) > 0
            put(ws, rr, 2 + j, '=' + ROUNDP(expr), USD, border=True, italic=not seen,
                color=BLACK if seen else '808080', fill=None if seen else F_GREY)
    grids.append((S_PN, 'Non-EW', mat, proc, f"{q(S_PN)}!$B${g0}:$I${g0 + len(OD_LBL) - 1}",
                  sum(1 for od in OD_LBL for wl in WALL_LBL if obs.get((mat, proc, od, wl), 0) > 0),
                  len(OD_LBL) * len(WALL_LBL)))
    r = g0 + len(OD_LBL) + 1
ws.freeze_panes = 'B4'

# ================================================================== 2d PRICE LIST EW
ws = sheets[S_PE]
title(ws, 'Deliverable 2 - Standard price list, EW: base $/ton by OD range x Wall range, one table per material',
      'EW is priced cell-by-cell (material x OD range x wall range) from the EW-only regression. "Quote" = size not '
      'produced in the last 24 months; price on request.')
for c, w in zip('ABCDEFGHIJ', [16, 12, 11, 11, 11, 11, 11, 11, 11, 11]):
    ws.column_dimensions[c].width = w
r = adder_block(ws, 'EW', 4, ['Order Band'], {'Order Band': 'Order size'})
cells = fits['EW']['levels']['Cell']
ew_od = [o for o in OD_LBL if any(c.split('|')[1] == o for c in cells)]
ew_wl = [w for w in WALL_LBL if any(c.split('|')[2] == w for c in cells)]
put(ws, r, 1, 'Base = 5-10 ton order at the length each cell ships in today (EW length is fixed per size). '
              'Order-size adders above apply.', italic=True, color='595959')
r += 2
for mat in sorted({c.split('|')[0] for c in cells}, key=lambda m: int(m[1:])):
    put(ws, r, 1, f'EW  -  Material {mat[1:]}   (base $/ton)', bold=True, size=11, color='1F3864')
    r += 1
    header(ws, r, ['OD range (in) \\ Wall range (in)'] + ew_wl, height=30)
    g0 = r + 1
    k = 0
    for i, od in enumerate(ew_od):
        rr = g0 + i
        put(ws, rr, 1, od, bold=True, fill=F_SUB, border=True)
        for j, wl in enumerate(ew_wl):
            cell = f'{mat}|{od}|{wl}'
            if cell in cells:
                k += 1
                put(ws, rr, 2 + j, '=' + ROUNDP(f'{cc("EW", "Intercept", "const")}+{cc("EW", "Cell", cell)}'), USD,
                    border=True, bold=True)
            else:
                put(ws, rr, 2 + j, 'Quote', color='808080', italic=True, fill=F_GREY, border=True, align='center')
    grids.append((S_PE, 'EW', mat, 'EW', f"{q(S_PE)}!$B${g0}:${CL(1 + len(ew_wl))}${g0 + len(ew_od) - 1}", k, k))
    r = g0 + len(ew_od) + 1
ws.freeze_panes = 'B4'

# ================================================================== 2f PRICING DETAIL
ws = sheets[S_PD]
title(ws, 'Deliverable 2/3 - Pricing detail by customer x finished part (LTM)',
      'Current price vs standard list and tier price; treatment and exception price are live formulas.')
PDC = Cols([('cust', 'CUST', 7, None), ('part', 'Part ID', 7, None), ('hol', 'Raw HOL', 8, None),
            ('seg', 'Segment', 8, None), ('proc', 'Proc', 5, None), ('mat', 'Material', 7, None),
            ('fin', 'Finish', 6, None), ('lt', 'Length Type', 6, None), ('od', 'OD (in)', 7, '0.000'),
            ('wall', 'Wall (in)', 7, '0.000'), ('odb', 'OD Range', 11, None), ('wb', 'Wall Range', 11, None),
            ('lenb', 'Length Band', 9, None), ('ordb', 'Typical Order Size', 8, None),
            ('tons', 'LTM Tons', 9, TON), ('rev', 'LTM Revenue', 12, USD), ('cur', 'Current Price $/t', 10, USD),
            ('mkt', 'Model Market Price $/t (2026)', 11, USD), ('list', 'Standard List $/t', 10, USD),
            ('hcls', 'HOL Class', 6, None), ('hdec', 'HOL Decision', 11, None), ('tier', 'Tier', 5, None),
            ('disc', 'Tier Discount', 7, PCT), ('tp', 'Tier Price $/t', 10, USD), ('inc', 'Aggressive Inc %', 7, PCT),
            ('tgt', 'Target Price $/t', 10, USD), ('chg', 'Required Change %', 8, PCT), ('cap', 'Tier Cap %', 7, PCT),
            ('trt', 'Pricing Treatment', 24, None), ('new', 'New Price $/t', 10, USD), ('nrev', 'New Revenue (LTM vol)', 12, USD),
            ('imp', 'Price Impact $', 12, USD), ('impp', 'Price Impact %', 8, PCT), ('scope', 'In Price-List Scope', 7, NUM)])
PR0 = 5
PDC.write_header(ws, PR0 - 1)
plast = PR0 + len(pr) - 1
pd_rows = {}
for i, x in enumerate(pr.itertuples(index=False)):
    r = PR0 + i
    pd_rows[(x.CUST, x.Part)] = r
    L = PDC
    fm = dict((s[0], s[3]) for s in L.spec)
    vals = {'cust': x.CUST, 'part': int(x.Part), 'hol': x.HOL, 'seg': x.Seg, 'proc': x.Proc, 'mat': x.Mat,
            'fin': x.Finish, 'lt': x.LT, 'od': x.OD, 'wall': x.Wall, 'odb': x.ODB, 'wb': x.WB, 'lenb': x.LenB,
            'ordb': x.OrdB, 'tons': x.Tons, 'rev': x.Rev, 'mkt': x.Model}
    for k, v in vals.items():
        put(ws, r, L.i[k], v, fm[k], BLUE)
    c = lambda k: f'{L[k]}{r}'
    put(ws, r, L.i['cur'], f'=IF({c("tons")}>0,{c("rev")}/{c("tons")},0)', USD)
    put(ws, r, L.i['list'], f'={c("mkt")}*(1+ListUplift)', USD)
    put(ws, r, L.i['hcls'], f'=INDEX({HP_RNG("cls")},MATCH({c("hol")},{HP_RNG("hol")},0))', color=GREEN)
    put(ws, r, L.i['hdec'], f'=INDEX({DM_RNG("fin")},MATCH({c("hol")},{DM_RNG("hol")},0))', color=GREEN)
    put(ws, r, L.i['tier'], f'=INDEX({CP_RNG("tier")},MATCH({c("cust")},{CP_RNG("cust")},0))', color=GREEN)
    put(ws, r, L.i['disc'], f'=IF(ISNUMBER({c("tier")}),INDEX(TierDisc,{c("tier")}),0)', PCT)
    put(ws, r, L.i['tp'], f'={c("list")}*(1-{c("disc")})', USD)
    put(ws, r, L.i['inc'], f'=INDEX({DM_RNG("inc")},MATCH({c("hol")},{DM_RNG("hol")},0))', PCT, GREEN)
    put(ws, r, L.i['tgt'], f'=IF({c("hdec")}="Raise Price",MAX({c("tp")},{c("cur")}*(1+{c("inc")})),{c("tp")})', USD)
    put(ws, r, L.i['chg'], f'=IF({c("cur")}>0,{c("tgt")}/{c("cur")}-1,0)', PCT)
    put(ws, r, L.i['cap'], f'=IF(ISNUMBER({c("tier")}),INDEX(TierCap,{c("tier")}),0)', PCT)
    put(ws, r, L.i['trt'], f'=IF({c("tier")}="Dist","Move to Distributor",IF({c("hdec")}="Cancel","Cancelled Product",'
                           f'IF({c("hdec")}="Raise Price","Raise Price (B hollow)",IF({c("chg")}>{c("cap")},'
                           f'"Exception - Capped Increase",IF(AND({c("chg")}<-SnapTol,HoldAbove=1),"Above List - Hold",'
                           f'"On Standard List")))))')
    put(ws, r, L.i['new'], f'=IF(OR({c("trt")}="Move to Distributor",{c("trt")}="Cancelled Product"),0,'
                           f'IF({c("trt")}="Exception - Capped Increase",{c("cur")}*(1+{c("cap")}),'
                           f'IF({c("trt")}="Above List - Hold",{c("cur")},{c("tgt")})))', USD)
    put(ws, r, L.i['scope'], f'=IF({c("new")}>0,1,0)', NUM)
    put(ws, r, L.i['nrev'], f'={c("new")}*{c("tons")}', USD)
    put(ws, r, L.i['imp'], f'=IF({c("scope")}=1,{c("nrev")}-{c("rev")},0)', USD)
    put(ws, r, L.i['impp'], f'=IF(AND({c("scope")}=1,{c("rev")}<>0),{c("imp")}/{c("rev")},0)', PCT)
ws.freeze_panes = ws.cell(row=PR0, column=3)
ws.auto_filter.ref = f"A{PR0 - 1}:{CL(len(PDC.spec))}{plast}"
put(ws, 3, 1, 'Model Market Price = regression price at 2026 level for this part\'s attributes (tons-weighted over its '
              'LTM order sizes). Rationalized parts keep their finished-part price. Distributor / cancelled rows are '
              'out of price-list scope (their impact is in 1c).', italic=True, color='595959')
PD_RNG = lambda k: f"{q(S_PD)}!${PDC[k]}${PR0}:${PDC[k]}${plast}"

# --- replicate the default formula logic in Python to pick the static exception list
hdec = hol.DefaultDecision
ptier = cust.Tier.where(~cust.Distributor, 'Dist')
pr['hdec'] = pr.HOL.map(hdec)
pr['tier'] = pr.CUST.map(ptier)
pr['disc'] = pr.tier.map(lambda t: TIER_DISC.get(t, 0) if t != 'Dist' else 0)
pr['cap'] = pr.tier.map(lambda t: TIER_CAP.get(t, 0) if t != 'Dist' else 0)
pr['tp'] = pr.Model * (1 + uplift) * (1 - pr.disc)
pr['tgt'] = np.where(pr.hdec == 'Raise Price', np.maximum(pr.tp, pr.Price * 1.2), pr.tp)
pr['chg'] = pr.tgt / pr.Price - 1
pr['trt'] = np.select([pr.tier == 'Dist', pr.hdec == 'Cancel', pr.hdec == 'Raise Price', pr.chg > pr.cap, pr.chg < -SNAP_TOL],
                      ['Move to Distributor', 'Cancelled Product', 'Raise Price (B hollow)',
                       'Exception - Capped Increase', 'Above List - Hold'], 'On Standard List')

# ================================================================== 2e TIER STRUCTURE
ws = sheets[S_TS]
title(ws, 'Deliverable 2 - Five customer tiers off one standard price list',
      'Tier price = Standard list x (1 - tier discount). Discounts and caps are edited on Inputs.')
header(ws, 4, ['Tier', 'Tier Name', 'Cum. Rev Cut-off', 'Discount off List', 'Increase Cap', 'Net Price Index vs Market',
               'Customers', 'LTM Revenue (in scope)', 'Current Realisation vs Market', 'New Revenue', 'Price Impact $',
               'Price Impact %'], widths=[7, 14, 11, 11, 10, 12, 10, 14, 13, 14, 13, 10])
for t in range(1, 6):
    r = 4 + t
    put(ws, r, 1, t, NUM)
    put(ws, r, 2, f'=INDEX(TierName,{t})', color=GREEN)
    put(ws, r, 3, f'=INDEX(TierCut,{t})', PCT, GREEN)
    put(ws, r, 4, f'=INDEX(TierDisc,{t})', PCT, GREEN)
    put(ws, r, 5, f'=INDEX(TierCap,{t})', PCT, GREEN)
    put(ws, r, 6, f'=(1+ListUplift)*(1-D{r})', '0.000')
    put(ws, r, 7, f'=COUNTIF({CP_RNG("tier")},A{r})', NUM)
    put(ws, r, 8, f'=SUMIFS({PD_RNG("rev")},{PD_RNG("tier")},A{r},{PD_RNG("scope")},1)', USD)
    put(ws, r, 9, float(tiers.RI.get(t, np.nan)), '0.000', BLUE)
    put(ws, r, 10, f'=SUMIFS({PD_RNG("nrev")},{PD_RNG("tier")},A{r},{PD_RNG("scope")},1)', USD)
    put(ws, r, 11, f'=J{r}-H{r}', USD)
    put(ws, r, 12, f'=IF(H{r}<>0,K{r}/H{r},0)', PCT)
put(ws, 10, 1, 'Distributor', bold=True)
put(ws, 10, 7, f'=COUNTIF({CP_RNG("tier")},"Dist")', NUM)
put(ws, 11, 1, 'Total', bold=True)
for col in 'GHJK':
    put(ws, 11, ord(col) - 64, f'=SUM({col}5:{col}10)', NUM if col == 'G' else USD, bold=True)
put(ws, 11, 12, '=IF(H11<>0,K11/H11,0)', PCT, bold=True)
put(ws, 13, 1, 'Net Price Index vs Market = what a tier pays relative to the regression market price. Current '
               'Realisation = what the tier paid in the LTM relative to the same market price (from the data, default '
               'tiering). The ladder was set so the two balance on total revenue.', italic=True, color='595959')
header(ws, 15, ['CUST', 'Tier', 'Tier Name', 'LTM Revenue', 'Current Realisation vs Market', 'Pareto Class'])
ri = (pr.groupby('CUST').Rev.sum() / pr.groupby('CUST').ModelRev.sum())
for i, (c, x) in enumerate(cust.iterrows()):
    r = 16 + i
    cr = cust_rows[c]
    put(ws, r, 1, c)
    put(ws, r, 2, f"={q(S_CP)}!{CPC['tier']}{cr}", color=GREEN)
    put(ws, r, 3, f"={q(S_CP)}!{CPC['tname']}{cr}", color=GREEN)
    put(ws, r, 4, f"={q(S_CP)}!{CPC['rev']}{cr}", USD, GREEN)
    put(ws, r, 5, float(ri.get(c, np.nan)) if c in ri.index else None, '0.000', BLUE)
    put(ws, r, 6, f"={q(S_CP)}!{CPC['cls']}{cr}", color=GREEN)

# ================================================================== 2h IMPACT BY CUSTOMER
ws = sheets[S_IC]
title(ws, 'Deliverable 2 - Price-list impact by customer (LTM volume)',
      'Price impact covers in-scope rows only. Revenue on B-hollow decisions shown for context (impact in 1c).')
ICC = Cols([('cust', 'CUST', 8, None), ('tier', 'Tier', 6, None), ('tname', 'Tier Name', 13, None),
            ('disc', 'Tier Discount', 8, PCT), ('parts', 'Part #s (in scope)', 8, NUM), ('tons', 'LTM Tons', 10, TON),
            ('rev', 'LTM Revenue (in scope)', 13, USD), ('nrev', 'New Revenue', 13, USD), ('imp', 'Price Impact $', 12, USD),
            ('impp', 'Price Impact %', 8, PCT), ('on', 'On List', 7, NUM), ('cap', 'Capped Exceptions', 8, NUM),
            ('hold', 'Above List - Hold', 8, NUM), ('raise', 'Raise Price Parts', 8, NUM),
            ('rcan', 'LTM Rev on Cancelled Hollows', 12, USD), ('rrat', 'LTM Rev on Rationalized Hollows', 12, USD),
            ('rdist', 'LTM Rev Moving to Distributor', 12, USD)])
ICC.write_header(ws, 4)
for i, c in enumerate(cust.index):
    r = 5 + i
    cr = cust_rows[c]
    L = ICC
    put(ws, r, 1, c)
    put(ws, r, L.i['tier'], f"={q(S_CP)}!{CPC['tier']}{cr}", color=GREEN)
    put(ws, r, L.i['tname'], f"={q(S_CP)}!{CPC['tname']}{cr}", color=GREEN)
    put(ws, r, L.i['disc'], f'=IF(ISNUMBER({L["tier"]}{r}),INDEX(TierDisc,{L["tier"]}{r}),0)', PCT)
    k = f'{PD_RNG("cust")},$A{r}'
    put(ws, r, L.i['parts'], f'=COUNTIFS({k},{PD_RNG("scope")},1)', NUM)
    put(ws, r, L.i['tons'], f'=SUMIFS({PD_RNG("tons")},{k},{PD_RNG("scope")},1)', TON)
    put(ws, r, L.i['rev'], f'=SUMIFS({PD_RNG("rev")},{k},{PD_RNG("scope")},1)', USD)
    put(ws, r, L.i['nrev'], f'=SUMIFS({PD_RNG("nrev")},{k},{PD_RNG("scope")},1)', USD)
    put(ws, r, L.i['imp'], f'={L["nrev"]}{r}-{L["rev"]}{r}', USD)
    put(ws, r, L.i['impp'], f'=IF({L["rev"]}{r}<>0,{L["imp"]}{r}/{L["rev"]}{r},0)', PCT)
    for key, lab in [('on', 'On Standard List'), ('cap', 'Exception - Capped Increase'), ('hold', 'Above List - Hold'),
                     ('raise', 'Raise Price (B hollow)')]:
        put(ws, r, L.i[key], f'=COUNTIFS({k},{PD_RNG("trt")},"{lab}")', NUM)
    put(ws, r, L.i['rcan'], f'=SUMIFS({PD_RNG("rev")},{k},{PD_RNG("hdec")},"Cancel")', USD)
    put(ws, r, L.i['rrat'], f'=SUMIFS({PD_RNG("rev")},{k},{PD_RNG("hdec")},"Rationalize")', USD)
    put(ws, r, L.i['rdist'], f'=SUMIFS({PD_RNG("rev")},{k},{PD_RNG("trt")},"Move to Distributor")', USD)
iclast = 4 + len(cust)
put(ws, iclast + 1, 1, 'Total', bold=True)
for key in ['parts', 'tons', 'rev', 'nrev', 'imp', 'on', 'cap', 'hold', 'raise', 'rcan', 'rrat', 'rdist']:
    col = ICC[key]
    put(ws, iclast + 1, ICC.i[key], f'=SUM({col}5:{col}{iclast})', dict((s[0], s[3]) for s in ICC.spec)[key], bold=True)
put(ws, iclast + 1, ICC.i['impp'], f'=IF({ICC["rev"]}{iclast + 1}<>0,{ICC["imp"]}{iclast + 1}/{ICC["rev"]}{iclast + 1},0)',
    PCT, bold=True)
ws.freeze_panes = 'B5'
ws.auto_filter.ref = f"A4:{CL(len(ICC.spec))}{iclast}"

# ================================================================== 2i IMPACT BY ATTRIBUTE
ws = sheets[S_IA]
title(ws, 'Deliverable 2 - Price-list impact by product attribute (LTM volume, in-scope rows)')
r = 4
for key, lab, levels in [('seg', 'Segment', ['Non-EW', 'EW']), ('proc', 'Process', ['D', 'CD', 'CF', 'EW']),
                         ('mat', 'Material', sorted(pr.Mat.unique(), key=lambda m: int(m[1:]))),
                         ('odb', 'OD range (in)', OD_LBL), ('wb', 'Wall range (in)', WALL_LBL),
                         ('fin', 'Finish', sorted(pr.Finish.unique())), ('lt', 'Length type', sorted(pr.LT.unique())),
                         ('lenb', 'Max length', LEN_LBL), ('ordb', 'Typical order size', ORD_LBL),
                         ('tier', 'Customer tier', [1, 2, 3, 4, 5])]:
    header(ws, r, [lab, 'Part #s', 'LTM Tons', 'LTM Revenue', 'New Revenue', 'Price Impact $', 'Price Impact %',
                   'Current $/t', 'New $/t', 'Capped Exceptions', 'Above List - Hold'],
           widths=[18, 9, 11, 14, 14, 13, 10, 10, 10, 10, 10], height=30)
    r0 = r + 1
    for lv in levels:
        r += 1
        put(ws, r, 1, lv)
        k = f'{PD_RNG(key)},$A{r},{PD_RNG("scope")},1'
        put(ws, r, 2, f'=COUNTIFS({k})', NUM)
        put(ws, r, 3, f'=SUMIFS({PD_RNG("tons")},{k})', TON)
        put(ws, r, 4, f'=SUMIFS({PD_RNG("rev")},{k})', USD)
        put(ws, r, 5, f'=SUMIFS({PD_RNG("nrev")},{k})', USD)
        put(ws, r, 6, f'=E{r}-D{r}', USD)
        put(ws, r, 7, f'=IF(D{r}<>0,F{r}/D{r},0)', PCT)
        put(ws, r, 8, f'=IF(C{r}<>0,D{r}/C{r},0)', USD)
        put(ws, r, 9, f'=IF(C{r}<>0,E{r}/C{r},0)', USD)
        put(ws, r, 10, f'=COUNTIFS({PD_RNG(key)},$A{r},{PD_RNG("trt")},"Exception - Capped Increase")', NUM)
        put(ws, r, 11, f'=COUNTIFS({PD_RNG(key)},$A{r},{PD_RNG("trt")},"Above List - Hold")', NUM)
    r += 1
    put(ws, r, 1, 'Total', bold=True)
    for j in [2, 3, 4, 5, 6, 10, 11]:
        put(ws, r, j, f'=SUM({CL(j)}{r0}:{CL(j)}{r - 1})', TON if j == 3 else (NUM if j in (2, 10, 11) else USD), bold=True)
    put(ws, r, 7, f'=IF(D{r}<>0,F{r}/D{r},0)', PCT, bold=True)
    r += 3

# ================================================================== 2g PRICE LIST SUMMARY
ws = sheets[S_PS]
title(ws, 'Deliverable 2 - Price list summary', 'One standard list, five tiers, a small set of adders.')
header(ws, 4, ['Table', 'Segment', 'Material', 'Proc', 'Priced Cells', 'Cells with Volume', 'Min List $/t',
               'Avg List $/t', 'Max List $/t', 'LTM Tons (in scope)', 'LTM Revenue (in scope)', 'New Revenue',
               'Price Impact %'], widths=[26, 9, 9, 7, 9, 9, 10, 10, 10, 11, 14, 14, 10])
for i, (sh, seg, mat, proc, rng, seen, tot) in enumerate(grids):
    r = 5 + i
    put(ws, r, 1, f'{sh[:2]} {seg} {mat} / {proc}')
    put(ws, r, 2, seg)
    put(ws, r, 3, mat)
    put(ws, r, 4, proc)
    put(ws, r, 5, tot, NUM, BLUE)
    put(ws, r, 6, seen, NUM, BLUE)
    put(ws, r, 7, f'=MIN({rng})', USD)
    put(ws, r, 8, f'=AVERAGE({rng})', USD)
    put(ws, r, 9, f'=MAX({rng})', USD)
    k = f'{PD_RNG("mat")},C{r},{PD_RNG("proc")},D{r},{PD_RNG("scope")},1'
    put(ws, r, 10, f'=SUMIFS({PD_RNG("tons")},{k})', TON)
    put(ws, r, 11, f'=SUMIFS({PD_RNG("rev")},{k})', USD)
    put(ws, r, 12, f'=SUMIFS({PD_RNG("nrev")},{k})', USD)
    put(ws, r, 13, f'=IF(K{r}<>0,L{r}/K{r}-1,0)', PCT)
gl = 4 + len(grids)
put(ws, gl + 1, 1, 'Total', bold=True)
for j in [5, 6, 10, 11, 12]:
    put(ws, gl + 1, j, f'=SUM({CL(j)}5:{CL(j)}{gl})', TON if j == 10 else (NUM if j < 7 else USD), bold=True)
put(ws, gl + 1, 13, f'=IF(K{gl + 1}<>0,L{gl + 1}/K{gl + 1}-1,0)', PCT, bold=True)
r = gl + 4
put(ws, r, 1, 'Price-management complexity: before vs after', bold=True, size=11, color='1F3864')
header(ws, r + 1, ['Metric', 'Value'], widths=None)
cx_rows = [('Customer x part price points today (LTM)', f'=COUNTA({PD_RNG("cust")})', NUM),
           ('Price points after: on standard list', f'=COUNTIF({PD_RNG("trt")},"On Standard List")', NUM),
           ('Price points after: capped exceptions', f'=COUNTIF({PD_RNG("trt")},"Exception - Capped Increase")', NUM),
           ('Price points after: above list - hold (no decrease)', f'=COUNTIF({PD_RNG("trt")},"Above List - Hold")', NUM),
           ('Price points after: raise-price B hollows', f'=COUNTIF({PD_RNG("trt")},"Raise Price (B hollow)")', NUM),
           ('Price points removed: cancelled products', f'=COUNTIF({PD_RNG("trt")},"Cancelled Product")', NUM),
           ('Price points removed: moved to distributor', f'=COUNTIF({PD_RNG("trt")},"Move to Distributor")', NUM),
           ('Share of in-scope price points on list', f'=IF(SUM(B{r + 3}:B{r + 6})>0,B{r + 3}/SUM(B{r + 3}:B{r + 6}),0)', PCT),
           ('Standard price tables (one list, all customers)', len(grids), NUM),
           ('Customer tiers', 5, NUM),
           ('List uplift over market', '=ListUplift', PCT),
           ('Total in-scope LTM revenue', f'=SUMIFS({PD_RNG("rev")},{PD_RNG("scope")},1)', USD),
           ('Total new revenue at LTM volume', f'=SUMIFS({PD_RNG("nrev")},{PD_RNG("scope")},1)', USD),
           ('Net price impact $', f'=B{r + 14}-B{r + 13}', USD),
           ('Net price impact %', f'=IF(B{r + 13}<>0,B{r + 15}/B{r + 13},0)', PCT)]
for i, (lab, fml, fm) in enumerate(cx_rows):
    put(ws, r + 2 + i, 1, lab)
    put(ws, r + 2 + i, 2, fml, fm, BLUE if isinstance(fml, (int, float)) else BLACK)
ws.column_dimensions['A'].width = 48
PS_CX = {lab: f"{q(S_PS)}!$B${r + 2 + i}" for i, (lab, _, _) in enumerate(cx_rows)}

# ================================================================== 3a EXCEPTION REPORT
ws = sheets[S_XR]
title(ws, 'Deliverable 3 - Exception report: customer x finished part needing an off-list price (capped increase)',
      'List selected at default Inputs; every value links live to 2f (re-filter 2f "Pricing Treatment" after changing '
      'Inputs). Exception price = current price x (1 + tier cap). Distributor customers are in 3b.')
ex = pr[pr.trt == 'Exception - Capped Increase'].copy()
ex['gap'] = (ex.tgt - ex.Price * (1 + ex.cap)) * ex.Tons
ex = ex.sort_values(['tier', 'CUST', 'gap'], ascending=[True, True, False])
XC = [('cust', 'CUST', 8), ('part', 'Part ID', 8), ('hol', 'Raw HOL', 8), ('seg', 'Segment', 8), ('mat', 'Material', 7),
      ('odb', 'OD Range', 11), ('wb', 'Wall Range', 11), ('tier', 'Tier', 5), ('tons', 'LTM Tons', 9),
      ('cur', 'Current $/t', 10), ('tp', 'Tier Price $/t', 10), ('chg', 'Required Change %', 9), ('cap', 'Tier Cap %', 8),
      ('new', 'Exception Price $/t', 10), ('trt', 'Treatment (live)', 24), ('imp', 'Price Impact $', 12)]
header(ws, 4, [h for _, h, _ in XC] + ['Gap to Tier Price $/t', 'Remaining Gap $ (LTM vol)', 'Next Review'],
       widths=[w for *_, w in XC] + [11, 13, 22])
FMT = dict((s[0], s[3]) for s in PDC.spec)
for i, x in enumerate(ex.itertuples(index=False)):
    r = 5 + i
    src = pd_rows[(x.CUST, x.Part)]
    for j, (k, _, _) in enumerate(XC):
        put(ws, r, 1 + j, f"={q(S_PD)}!{PDC[k]}{src}", FMT[k], GREEN)
    put(ws, r, len(XC) + 1, f'=K{r}-N{r}', USD)
    put(ws, r, len(XC) + 2, f'=MAX(0,Q{r})*I{r}', USD)
    put(ws, r, len(XC) + 3, 'Re-apply tier cap at next price increase until on list', italic=True, color='595959')
xlast = 4 + len(ex)
ws.freeze_panes = 'C5'
ws.auto_filter.ref = f"A4:{CL(len(XC) + 3)}{xlast}"
put(ws, 3, 1, f'{len(ex)} exception price points across {ex.CUST.nunique()} customers at default settings. '
              'Summary by customer below the detail.', italic=True, color='595959')
r = xlast + 3
put(ws, r, 1, 'Exceptions by customer', bold=True, size=11, color='1F3864')
header(ws, r + 1, ['CUST', 'Tier', 'Exception Parts', 'LTM Tons', 'Price Impact $', 'Remaining Gap $'], height=30)
for i, c in enumerate(ex.CUST.unique()):
    rr = r + 2 + i
    put(ws, rr, 1, c)
    put(ws, rr, 2, f"={q(S_CP)}!{CPC['tier']}{cust_rows[c]}", color=GREEN)
    put(ws, rr, 3, f'=COUNTIF($A$5:$A${xlast},A{rr})', NUM)
    put(ws, rr, 4, f'=SUMIF($A$5:$A${xlast},A{rr},$I$5:$I${xlast})', TON)
    put(ws, rr, 5, f'=SUMIF($A$5:$A${xlast},A{rr},$P$5:$P${xlast})', USD)
    put(ws, rr, 6, f'=SUMIF($A$5:$A${xlast},A{rr},$R$5:$R${xlast})', USD)

# ================================================================== 3b DISTRIBUTOR TRANSFER
ws = sheets[S_DT]
title(ws, 'Deliverable 3 - Customers to be served by another distributor, and lapsed accounts',
      'Rule (user): < $5K a year and <= 2 shipments a year, averaged over the years the customer bought. '
      'Flags are live from Inputs; lists selected at default.')
DTH = ['CUST', 'Flag (live)', 'Status (live)', 'Avg Annual Revenue', 'Avg Annual Shipments', 'Active Years',
       'LTM Revenue', 'LTM Shipments', 'Last Sale', 'Revenue Jan-23 to Aug-26', 'Recommendation']
DTK = ['dist', 'status', 'avgr', 'avgs', 'ay', 'rev', 'orders', 'last', 'revall']
CFM = dict((s[0], s[3]) for s in CPC.spec)


def cust_list(r, heading, custs, rec):
    put(ws, r, 1, heading, bold=True, size=11, color='1F3864')
    header(ws, r + 1, DTH, widths=[8, 18, 20, 12, 10, 8, 12, 9, 11, 14, 60], height=30)
    r0 = r + 2
    for i, c in enumerate(custs):
        rr = r0 + i
        put(ws, rr, 1, c)
        for j, k in enumerate(DTK):
            put(ws, rr, 2 + j, f"={q(S_CP)}!{CPC[k]}{cust_rows[c]}", CFM[k], GREEN)
        put(ws, rr, 11, rec(c), italic=True, color='595959')
    rl = r0 + len(custs) - 1
    put(ws, rl + 1, 1, 'Total', bold=True)
    for j in [4, 7, 10]:
        put(ws, rl + 1, j, f'=SUM({CL(j)}{r0}:{CL(j)}{rl})', USD, bold=True)
    return rl + 4


dist = cust[cust.Distributor].sort_values('RevAll', ascending=False)
lapsed = cust[cust.Lapsed].sort_values('RevAll', ascending=False)
r = cust_list(4, f'A. Move to distributor ({len(dist)} customers)', dist.index,
              lambda c: 'Move to distributor; remove from direct price file')
cust_list(r, f'B. Lapsed accounts - no purchases in the LTM, above the distributor threshold ({len(lapsed)} customers)',
          lapsed.index, lambda c: ('Win-back review (historic key account)' if cust.RevAll[c] >= 250_000 else
                                   'Win-back review; if no response in 2 quarters, refer to distributor'))
ws.freeze_panes = 'B4'

# ================================================================== 4b FORECAST SUMMARY (seasonality first; 4a links to it)
MONTHS = pd.period_range('2026-09', '2027-08', freq='M')
ws = sheets[S_FS]
title(ws, 'Deliverable 4 - Forecast summary: repeatable products, next 12 months (Sep-2026 to Aug-2027)',
      'Remaining hollows (not cancelled) and direct customers (not distributor) only. Rationalized volume is planned '
      'on the substitute hollow.')
put(ws, 4, 1, 'Seasonality index (share of annual tons x 12, Sep-2023 to Aug-2026)', bold=True, color='1F3864')
header(ws, 5, ['Month', 'Cal. Month', 'EW Index', 'Non-EW Index'], widths=[10, 8, 10, 12], height=30)
SEAS0 = 6
for i, m in enumerate(MONTHS):
    r = SEAS0 + i
    put(ws, r, 1, m.strftime('%b-%y'))
    put(ws, r, 2, m.month, NUM)
    put(ws, r, 3, float(seas.loc[m.month, 'EW']), '0.000', BLUE)
    put(ws, r, 4, float(seas.loc[m.month, 'Non-EW']), '0.000', BLUE)

# ================================================================== 4a FORECAST DETAIL
ws = sheets[S_FD]
title(ws, 'Deliverable 4 - Forecast detail: repeatable customer x raw hollow combinations',
      'Repeatable = shipped in >= 4 of the last 8 fiscal quarters (High = >= 6). Forecast = LTM tons x (1 + damped, '
      'capped YoY trend) x decision retention x in-scope flag, phased by segment seasonality.')
rep = fc[fc.Repeat != 'Not repeatable'].sort_values(['LTMTons'], ascending=False)
FDC = Cols([('cust', 'CUST', 7, None), ('hol', 'Raw HOL', 8, None), ('seg', 'Segment', 8, None), ('parts', 'Part #s', 6, NUM),
            ('qa', 'Qtrs Active (of 8)', 7, NUM), ('rep', 'Repeatability', 10, None), ('prior', 'Prior-12m Tons', 9, TON),
            ('ltm', 'LTM Tons', 9, TON), ('yoy', 'YoY Growth', 8, PCT), ('g', 'Applied Trend', 8, PCT),
            ('dec', 'HOL Decision', 11, None), ('tier', 'Cust Tier', 6, None), ('ret', 'Retention Factor', 8, PCT),
            ('plan', 'Planning HOL', 9, None), ('ft', 'Fcst 12m Tons', 10, TON)] +
           [(f'm{i}', m.strftime('%b-%y'), 7, TON) for i, m in enumerate(MONTHS)] +
           [('cp', 'LTM Price $/t', 9, USD), ('np', 'New Price $/t', 9, USD), ('frc', 'Fcst Rev @ Current Price', 12, USD),
            ('frn', 'Fcst Rev @ New Price', 12, USD)])
FR0 = 5
FDC.write_header(ws, FR0 - 1)
flast = FR0 + len(rep) - 1
for i, x in enumerate(rep.itertuples(index=False)):
    r = FR0 + i
    L = FDC
    c = lambda k: f'{L[k]}{r}'
    fm = dict((s[0], s[3]) for s in L.spec)
    for k, v in {'cust': x.CUST, 'hol': x.HOL, 'seg': x.Seg, 'parts': int(x.Parts), 'qa': int(x.QtrsActive),
                 'rep': x.Repeat, 'prior': x.PriorTons, 'ltm': x.LTMTons, 'cp': x.Price}.items():
        put(ws, r, L.i[k], v, fm[k], BLUE)
    put(ws, r, L.i['yoy'], f'=IF({c("prior")}>0,{c("ltm")}/{c("prior")}-1,0)', PCT)
    put(ws, r, L.i['g'], f'=MAX(-GrowthCap,MIN(GrowthCap,{c("yoy")}))*Damping', PCT)
    put(ws, r, L.i['dec'], f'=INDEX({DM_RNG("fin")},MATCH({c("hol")},{DM_RNG("hol")},0))', color=GREEN)
    put(ws, r, L.i['tier'], f'=INDEX({CP_RNG("tier")},MATCH({c("cust")},{CP_RNG("cust")},0))', color=GREEN)
    put(ws, r, L.i['ret'], f'=IF(OR({c("dec")}="Cancel",{c("tier")}="Dist"),0,IF({c("dec")}="Rationalize",RetRat_Mid,'
                           f'IF({c("dec")}="Raise Price",RetRaise_Mid,1)))', PCT)
    put(ws, r, L.i['plan'], f'=IF({c("dec")}="Rationalize",INDEX({DM_RNG("sub")},MATCH({c("hol")},{DM_RNG("hol")},0)),'
                            f'{c("hol")})')
    put(ws, r, L.i['ft'], f'={c("ltm")}*(1+{c("g")})*{c("ret")}', TON)
    for j in range(12):
        put(ws, r, L.i[f'm{j}'], f'={c("ft")}*IF({c("seg")}="EW",{q(S_FS)}!$C${SEAS0 + j},{q(S_FS)}!$D${SEAS0 + j})/12', TON)
    kk = f'{PD_RNG("cust")},{c("cust")},{PD_RNG("hol")},{c("hol")},{PD_RNG("scope")},1'
    put(ws, r, L.i['np'], f'=IFERROR(SUMIFS({PD_RNG("nrev")},{kk})/SUMIFS({PD_RNG("tons")},{kk}),{c("cp")})', USD)
    put(ws, r, L.i['frc'], f'={c("ft")}*{c("cp")}', USD)
    put(ws, r, L.i['frn'], f'={c("ft")}*{c("np")}', USD)
ws.freeze_panes = ws.cell(row=FR0, column=3)
ws.auto_filter.ref = f"A{FR0 - 1}:{CL(len(FDC.spec))}{flast}"
FD_RNG = lambda k: f"{q(S_FD)}!${FDC[k]}${FR0}:${FDC[k]}${flast}"

# ---- back on 4b: monthly totals, by hollow, by customer, back-test
ws = sheets[S_FS]
put(ws, 4, 6, 'Monthly forecast tons', bold=True, color='1F3864')
header(ws, 5, ['Month', 'EW Tons', 'Non-EW Tons', 'Total Tons'], c0=6, widths=[10, 11, 12, 12], height=30)
for j in range(12):
    r = SEAS0 + j
    put(ws, r, 6, f'=A{r}')
    col = FD_RNG(f'm{j}')
    put(ws, r, 7, f'=SUMIF({FD_RNG("seg")},"EW",{col})', TON)
    put(ws, r, 8, f'=SUMIF({FD_RNG("seg")},"Non-EW",{col})', TON)
    put(ws, r, 9, f'=G{r}+H{r}', TON)
put(ws, SEAS0 + 12, 6, 'Total', bold=True)
for col in 'GHI':
    put(ws, SEAS0 + 12, ord(col) - 64, f'=SUM({col}{SEAS0}:{col}{SEAS0 + 11})', TON, bold=True)

put(ws, 4, 11, 'Headline', bold=True, color='1F3864')
hl = [('Repeatable combos (cust x HOL)', f'=COUNTA({FD_RNG("cust")})', NUM),
      ('... of which High repeatability', f'=COUNTIF({FD_RNG("rep")},"High")', NUM),
      ('LTM tons on these combos', f'=SUM({FD_RNG("ltm")})', TON),
      ('Forecast 12m tons', f'=SUM({FD_RNG("ft")})', TON),
      ('Forecast vs LTM', f'=IF(L7<>0,L8/L7-1,0)', PCT),
      ('Forecast revenue @ current price', f'=SUM({FD_RNG("frc")})', USD),
      ('Forecast revenue @ new price list', f'=SUM({FD_RNG("frn")})', USD),
      ('Share of total LTM tons that is repeatable', f'=L7/{float(df[df.LTM & (df.Tons > 0)].Tons.sum())}', PCT)]
ws.column_dimensions['K'].width = 40
ws.column_dimensions['L'].width = 14
for i, (lab, fml, fm) in enumerate(hl):
    put(ws, 5 + i, 11, lab)
    put(ws, 5 + i, 12, fml, fm)

r = SEAS0 + 15
put(ws, r, 1, 'Back-test (stand at 31-Aug-2025, forecast Sep-2024..Aug-2025 repeatables forward 12 months)', bold=True,
    color='1F3864')
header(ws, r + 1, ['Segment', 'Combos', 'Actual Tons', 'Forecast Tons', 'Naive (flat) Tons', 'Aggregate Bias',
                   'Combo-level WAPE', 'Naive WAPE'], widths=None, height=30)
for i, x in enumerate(bt.itertuples(index=False)):
    rr = r + 2 + i
    for j, (v, fm) in enumerate([(x.Seg, None), (x.Combos, NUM), (x.Actual, TON), (x.Forecast, TON), (x.Naive, TON),
                                 (x.Bias, PCT), (x.WAPE, PCT), (x.NaiveWAPE, PCT)]):
        put(ws, rr, 1 + j, v, fm, BLUE)
put(ws, r + 4, 1, 'Read: totals are reliable to within ~5%; individual customer x hollow lines swing +/-30-40% year to '
                  'year, so use the line forecast for planning ranges and the totals for capacity/metal buys.',
    italic=True, color='595959')

r = r + 7
put(ws, r, 1, 'Forecast by planning raw hollow', bold=True, color='1F3864')
header(ws, r + 1, ['Planning HOL', 'Segment', 'Customers', 'LTM Tons (orig. HOL)', 'Fcst 12m Tons', 'Fcst Rev @ New Price'],
       height=30)
plan_hols = []
for h in rep.HOL.unique():
    if hdec.get(h) == 'Rationalize' and isinstance(hol.Sub.get(h), str):
        plan_hols.append(hol.Sub[h])
    plan_hols.append(h)
plan_hols = list(dict.fromkeys(sorted(set(plan_hols), key=lambda h: -hol.Rev.get(h, 0))))
for i, h in enumerate(plan_hols):
    rr = r + 2 + i
    put(ws, rr, 1, h)
    put(ws, rr, 2, hol.Seg.get(h, ''))
    put(ws, rr, 3, f'=COUNTIFS({FD_RNG("plan")},A{rr},{FD_RNG("ft")},">0")', NUM)
    put(ws, rr, 4, f'=SUMIF({FD_RNG("hol")},A{rr},{FD_RNG("ltm")})', TON)
    put(ws, rr, 5, f'=SUMIF({FD_RNG("plan")},A{rr},{FD_RNG("ft")})', TON)
    put(ws, rr, 6, f'=SUMIF({FD_RNG("plan")},A{rr},{FD_RNG("frn")})', USD)
ph_last = r + 1 + len(plan_hols)

put(ws, r, 8, 'Forecast by customer', bold=True, color='1F3864')
header(ws, r + 1, ['CUST', 'Tier', 'Repeatable Combos', 'LTM Tons', 'Fcst 12m Tons', 'Fcst Rev @ New Price'], c0=8,
       height=30)
for i, cst in enumerate(sorted(rep.CUST.unique(), key=lambda c: -cust.Rev.get(c, 0))):
    rr = r + 2 + i
    put(ws, rr, 8, cst)
    put(ws, rr, 9, f"={q(S_CP)}!{CPC['tier']}{cust_rows[cst]}", color=GREEN)
    put(ws, rr, 10, f'=COUNTIF({FD_RNG("cust")},H{rr})', NUM)
    put(ws, rr, 11, f'=SUMIF({FD_RNG("cust")},H{rr},{FD_RNG("ltm")})', TON)
    put(ws, rr, 12, f'=SUMIF({FD_RNG("cust")},H{rr},{FD_RNG("ft")})', TON)
    put(ws, rr, 13, f'=SUMIF({FD_RNG("cust")},H{rr},{FD_RNG("frn")})', USD)
for c, w in zip('ABCDEFGHIJKLM', [12, 9, 10, 12, 12, 14, 3, 10, 12, 10, 40, 14, 14]):
    ws.column_dimensions[c].width = w

# ================================================================== EXCLUDED DATA
ws = sheets[S_XD]
title(ws, 'Rows excluded from the analysis')
header(ws, 4, ['Reason', 'Rows', 'Revenue (all years)', 'Pocket Margin (all years)'], widths=[36, 9, 15, 15], height=30)
xs = excluded.groupby('Exclusion Reason').agg(n=('Rev', 'size'), rev=('Rev', 'sum'), pm=('PM', 'sum'))
for i, (k, x) in enumerate(xs.iterrows()):
    put(ws, 5 + i, 1, k)
    put(ws, 5 + i, 2, int(x.n), NUM, BLUE)
    put(ws, 5 + i, 3, float(x.rev), USD, BLUE)
    put(ws, 5 + i, 4, float(x.pm), USD, BLUE)
put(ws, 10, 1, 'Also note: 26,504 in-scope rows carry zero tons and no price (cost / margin adjustment lines). They '
               'count toward pocket margin but not revenue or tons.', italic=True, color='595959')

# ================================================================== EXEC SUMMARY
ws = sheets[S_EX]
title(ws, 'Executive summary - complexity reduction, price-list rationalisation, exceptions and forecast',
      f'LTM basis {LTM_START:%b-%Y} to {LTM_END:%b-%Y}. All figures live - change Inputs or 1c overrides and this page updates.')
ws.column_dimensions['A'].width = 60
for c in 'BCD':
    ws.column_dimensions[c].width = 16
r = 4


def ex_row(label, fml, fm, bold=False):
    global r
    put(ws, r, 1, label, bold=bold)
    put(ws, r, 2, fml, fm, BLUE if not isinstance(fml, str) else (GREEN if '!' in fml else BLACK), bold=bold)
    r += 1


def ex_head(text):
    global r
    r += 1
    put(ws, r, 1, text, bold=True, color=WHITE, fill=F_HDR)
    for cc_ in range(2, 5):
        ws.cell(row=r, column=cc_).fill = F_HDR
    r += 1


ex_head('Baseline')
ex_row('LTM revenue (in scope)', f'=SUM({CP_RNG("rev")})', USD)
ex_row('LTM pocket margin', f'=SUM({CP_RNG("pm")})', USD)
ex_row('Customers (any history)', f'=COUNTA({CP_RNG("cust")})', NUM)
ex_row('Raw hollows (any history)', f'=COUNTA({HP_RNG("hol")})', NUM)
ex_head('1. 80/20 complexity reduction')
ex_row('A customers / B customers', f'=COUNTIF({CP_RNG("cls")},"A")&" / "&COUNTIF({CP_RNG("cls")},"B")', None)
ex_row('A hollows / B hollows', f'=COUNTIF({HP_RNG("cls")},"A")&" / "&COUNTIF({HP_RNG("cls")},"B")', None)
ex_row('Hollows to Rationalize / Cancel / Raise Price',
       f'={q(S_SS)}!B5&" / "&{q(S_SS)}!B6&" / "&{q(S_SS)}!B7', None)
ex_row('Hollows eliminated (Cancel + Rationalize)', f'=SUM({DM_RNG("elim")})', NUM)
ex_row('Hollow count reduction %', f'=-{q(S_SS)}!E14', PCT)
ex_row('Hollow pulls eliminated', f'=SUM({DM_RNG("pelim")})', NUM)
put(ws, r, 2, 'Best', bold=True, align='center')
put(ws, r, 3, 'Mid', bold=True, align='center')
put(ws, r, 4, 'Worst', bold=True, align='center')
r += 1
put(ws, r, 1, 'Revenue impact of hollow decisions ($/yr)')
for j, col in enumerate('GHI'):
    put(ws, r, 2 + j, f'={q(S_SS)}!{col}9', USD, GREEN)
r += 1
put(ws, r, 1, 'Pocket-margin impact of hollow decisions ($/yr)')
for j, col in enumerate('JKL'):
    put(ws, r, 2 + j, f'={q(S_SS)}!{col}9', USD, GREEN)
r += 1
ex_head('2. Standard price list + 5 tiers')
ex_row('Standard price tables (Non-EW by material/process, EW by material)', len(grids), NUM)
ex_row('List uplift over regression market price', '=ListUplift', PCT)
ex_row('Regression fit Non-EW (R-squared / weighted MAPE)',
       f'=TEXT({q(S_RN)}!B6,"0.00")&" / "&TEXT({q(S_RN)}!B8,"0.0%")', None)
ex_row('Regression fit EW (R-squared / weighted MAPE)',
       f'=TEXT({q(S_RE)}!B6,"0.00")&" / "&TEXT({q(S_RE)}!B8,"0.0%")', None)
ex_row('In-scope price points on the standard list',
       f'={PS_CX["Share of in-scope price points on list"]}', PCT)
ex_row('Net price impact at LTM volume ($)', f'={PS_CX["Net price impact $"]}', USD)
ex_row('Net price impact at LTM volume (%)', f'={PS_CX["Net price impact %"]}', PCT)
ex_head('3. Exceptions and distributor hand-off')
ex_row('Capped-increase exception price points', f'=COUNTIF({PD_RNG("trt")},"Exception - Capped Increase")', NUM)
ex_row('Customers with at least one exception (default list)', ex.CUST.nunique(), NUM)
ex_row('Above-list price points held (no decrease)', f'=COUNTIF({PD_RNG("trt")},"Above List - Hold")', NUM)
ex_row('Customers moved to distributor', f'=COUNTIF({CP_RNG("dist")},"Move to Distributor")', NUM)
ex_row('... their average annual revenue', f'=SUMIF({CP_RNG("dist")},"Move to Distributor",{CP_RNG("avgr")})', USD)
ex_row('Lapsed accounts (no LTM purchases, listed in 3b for win-back)', f'=COUNTIF({CP_RNG("status")},"Lapsed - no LTM sales")', NUM)
ex_head('4. Forecast of repeatable products (next 12 months)')
ex_row('Repeatable customer x hollow combinations', f"={q(S_FS)}!L5", NUM)
ex_row('Forecast tons', f"={q(S_FS)}!L8", TON)
ex_row('Forecast vs LTM', f"={q(S_FS)}!L9", PCT)
ex_row('Forecast revenue @ new price list', f"={q(S_FS)}!L11", USD)

# ================================================================== READ ME
ws = sheets[S_RM]
ws.column_dimensions['A'].width = 130
lines = [
    ('ITT Hollow Bar - Complexity Reduction, Price-List Rationalisation, Exceptions & Forecast', 'h1'),
    (f'Source: regression_3.xlsx (Sheet1, 51,756 rows, Jan-2023 to Aug-2026). Built by analysis.py + build_workbook.py '
     f'(analysis/complexity_pricing in the repo).', ''),
    ('', ''),
    ('HOW TO USE', 'h2'),
    ('1. Change levers on Inputs (yellow cells). Everything recalculates: Pareto classes, complexity flags, decisions, '
     'scenario impacts, tier prices, exceptions, forecast.', ''),
    ('2. Override any hollow decision in 1c (User Override column, drop-down) and/or set a hollow-specific price increase.', ''),
    ('3. Read results on Exec Summary, 1d, 2g, 2h, 2i, 3a, 3b, 4b.', ''),
    ('   Static lists (the rows included in 3a, 3b, 4a and the companion ITT_Labeled_Data.xlsx) were selected at the default Inputs; their values '
     'stay live. After big Input changes, re-filter 2f on "Pricing Treatment" or re-run the scripts.', ''),
    ('', ''),
    ('DATA DEFINITIONS AND SCOPE', 'h2'),
    (f'LTM (last twelve months) = {LTM_START:%d-%b-%Y} to {LTM_END:%d-%b-%Y}; Prior-12 = the 12 months before that. '
     'All Pareto, decision and pricing math is on the LTM run-rate.', ''),
    ('Revenue = Qty (tons) x Price Per Ton. Pocket margin = "Pocket Margin $" as supplied (includes zero-ton adjustment lines).', ''),
    ('Excluded: rows flagged M&M out of scope, rows with no customer, rows with no hollow/attributes (see Excluded Data).', ''),
    ('Segments: EW = Proc EW. Non-EW = Proc D, CD and CF (one business, one regression). The two are modelled separately.', ''),
    ('', ''),
    ('DELIVERABLE 1 - 80/20 COMPLEXITY REDUCTION', 'h2'),
    ('Pareto: customers (1a) and raw hollows (1b) ranked on LTM revenue; A = items making up the first 80% of revenue '
     '(the item that crosses 80% is A), B = the rest. One label per hollow and per customer.', ''),
    ('Complexity: the supplied "Hollow Complexity Flag" is 0 on every row, so a flag is derived from five drivers: '
     'multi-pull (>=2 pulls), part-number proliferation, low velocity, low volume and negative pocket margin. '
     'Flag = 1 when >= 2 drivers are present. B hollows are prioritised by pulls, then flag, then score, then smallest revenue.', ''),
    ('Substitute search: for each B hollow, the nearest A hollow with the same segment, process, material and finish whose '
     'max finished OD and wall cover the B hollow (up to +0.25" OD, +1/16" wall). Weight penalty = extra cross-section.', ''),
    ('The substitute search runs in analysis.py for the default (80%) B hollows; if you lower the Pareto cut-off on Inputs, '
     'newly-B hollows have no substitute listed until the scripts are re-run.', ''),
    ('Recommended action: zero-LTM hollows -> Cancel; substitute exists -> Rationalize; otherwise small or negative-margin -> '
     'Cancel; otherwise -> Raise Price (user-defined aggressive increase).', ''),
    ('Scenarios: Best / Mid / Worst differ in volume retention, recapture and complexity savings (Inputs section 3). '
     'Complexity savings per pull are PLACEHOLDERS to validate with operations.', ''),
    ('', ''),
    ('DELIVERABLE 2 - PRICE LISTS', 'h2'),
    ('Two weighted-least-squares regressions on $/ton (Sep-2024 to Aug-2026, weighted by tons, 1st/99th percentile trimmed): '
     'Non-EW (R2 ~0.81) uses additive OD range + wall range + material + process + finish + length + order-size + year terms; '
     'EW (R2 ~0.88) prices each material x OD x wall cell directly (EW is SKU-like).', ''),
    ('Standard list = regression price at the 2026 level x (1 + list uplift). Base tables are OD range x wall range, one per '
     'material (Non-EW split by process where a material runs on more than one). Adders cover length, order size, finish.', ''),
    ('Material 5: in this data it runs only on Proc D; its Non-EW table is the Material 5 price list. EW tables are by '
     'specific EW material (1, 4, 8, 10).', ''),
    ('Tiers: customers ranked by LTM revenue; Tier 1 = first 50% of revenue ... Tier 5 = last 1%. Discount ladder '
     '8/6/4/2/0% off one list; list uplift set so the ladder is revenue-neutral on LTM volume.', ''),
    ('Treatment per customer x part (2f): distributor -> removed; cancelled hollow -> removed; Raise-Price hollow -> max(tier price, '
     'current + aggressive increase); increase needed above the tier cap -> capped exception; current more than 3% above tier '
     'price -> hold (no decrease, toggle on Inputs); otherwise on list (incl. give-backs of up to 3%).', ''),
    ('', ''),
    ('DELIVERABLE 3 - EXCEPTIONS', 'h2'),
    ('3a lists customer x finished part rows whose move to the tier price would exceed the tier cap (6/8/10/12/15% for tiers 1-5). '
     'They get current x (1 + cap) now and re-apply the cap at each price action until on list.', ''),
    ('3b lists customers averaging < $5K a year and <= 2 shipments a year (over the years they bought) -> to be served by '
     'another distributor. Applied on averages because on the LTM alone the rule flags only lapsed accounts (some with '
     '$1M+ history). Lapsed accounts are listed separately for win-back review.', ''),
    ('', ''),
    ('DELIVERABLE 4 - FORECAST', 'h2'),
    ('Scope: remaining hollows (not cancelled) and direct customers. Repeatable = shipped in >= 4 of the last 8 fiscal '
     'quarters (Sep-Aug). Forecast = LTM tons x (1 + 50% of YoY trend capped at +/-25%) x retention for decision, phased '
     'by segment seasonality. Rationalized volume is planned on the substitute hollow. Back-test in 4b.', ''),
    ('', ''),
    ('KEY ASSUMPTIONS TO VALIDATE', 'h2'),
    ('Complexity savings per pull; scenario retention rates; metal share of cost; tier discount ladder and caps; substitute '
     'tolerances. All are on Inputs except the substitute tolerances (analysis.py).', ''),
]
for i, (t, kind) in enumerate(lines):
    cell = put(ws, 1 + i, 1, t, bold=kind != '', size={'h1': 14, 'h2': 11}.get(kind, 10),
               color={'h1': '1F3864', 'h2': '1F3864'}.get(kind, BLACK), wrap=True)

wb.active = wb.sheetnames.index(S_EX)
wb.save(OUT)
print('saved', OUT, 'exceptions', len(ex), 'dist', len(dist), 'forecast rows', len(rep), 'pricing rows', len(pr))
print(pr.trt.value_counts())
