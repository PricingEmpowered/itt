# Complexity reduction, price-list rationalisation, exceptions & forecast

Input: `regression_3.xlsx` (Sheet1, 51,756 invoice lines, Jan-2023 to Aug-2026; not committed).

```
pip install pandas openpyxl statsmodels
python analysis.py /path/to/regression_3.xlsx      # all statistics -> results.pkl
python build_workbook.py output/ITT_Complexity_Pricing_Model.xlsx
python export_labeled.py output/ITT_Labeled_Data.xlsx
```
Open the model in Excel (formulas calculate on open), or recalculate headless with LibreOffice Calc.

| File | Purpose |
|---|---|
| `prep.py` | Load, rename, LTM window, OD / wall / length / order-size bands, scope exclusions |
| `analysis.py` | Pareto, complexity drivers, substitute search, WLS price regressions (EW and Non-EW separately), tier calibration, forecast + back-test |
| `build_workbook.py` | Formula-driven workbook: every lever is on the **Inputs** sheet |
| `export_labeled.py` | Every in-scope row with its customer / hollow labels |

Workbook map: `Exec Summary` · `Inputs` · 1a–1d (80/20 by customer and raw hollow, decision model with
Best/Mid/Worst impact, scenario summary) · 2a–2i (regressions, price lists, tiers, pricing detail, summaries,
impact by customer and by attribute) · 3a–3b (exception report, distributor hand-off and lapsed accounts) ·
4a–4b (repeatable-product forecast). See the workbook's **Read Me** sheet for method and assumptions.
