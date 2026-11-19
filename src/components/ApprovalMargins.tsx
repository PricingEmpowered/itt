/**
 * The minimum margins an analyst may quote at without approval.
 *
 * One row per product line and region, with a default row that covers
 * everything else. Anyone signed in can read it; only an administrator can
 * change it, and the controls are not shown to anyone else.
 *
 * Pasting a table from a spreadsheet loads the figures that are plain
 * percentages and lists the cells that are not, so nothing is guessed. A row
 * flagged as a placeholder says so wherever it is used, and stays flagged
 * until someone confirms it.
 */

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { trpcClient } from '../lib/trpcClient';
import { parseMarginTable, type ParsedMarginTable } from '../utils/marginTable';

type Row = Awaited<ReturnType<typeof trpcClient.margins.list.query>>[number];

const REGIONS = ['*', 'North America', 'Europe', 'Asia Pacific'] as const;
const label = (v: string) => (v === '*' ? 'Any' : v);

interface Draft {
  productLine: string;
  region: (typeof REGIONS)[number];
  percent: string;
  isPlaceholder: boolean;
  note: string;
  /** Set when editing an existing row, so its key cannot be changed under it. */
  editing: boolean;
}

const BLANK: Draft = {
  productLine: '',
  region: '*',
  percent: '',
  isPlaceholder: false,
  note: '',
  editing: false,
};

export function ApprovalMargins() {
  const [rows, setRows] = useState<Row[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [parsed, setParsed] = useState<ParsedMarginTable | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, edit] = await Promise.all([
        trpcClient.margins.list.query(),
        trpcClient.margins.canEdit.query(),
      ]);
      setRows(list);
      setCanEdit(edit);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The margins could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!draft) return;
    const percent = Number(draft.percent);
    if (draft.productLine.trim() === '') return setError('Enter a product line, or * for any.');
    if (draft.percent.trim() === '' || !Number.isFinite(percent) || percent < 0 || percent >= 100) {
      return setError('The minimum margin must be a percentage from 0 up to 100.');
    }
    setSaving(true);
    try {
      await trpcClient.margins.save.mutate({
        authorityLevel: 'analyst',
        productLine: draft.productLine.trim(),
        region: draft.region,
        minimumMarginPercent: percent,
        isPlaceholder: draft.isPlaceholder,
        note: draft.note.trim() === '' ? null : draft.note.trim(),
      });
      setDraft(null);
      setError(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The change could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: Row) => {
    const where = `${label(r.productLine)}, ${label(r.region)}`;
    if (!window.confirm(`Delete the ${(r.minimumMargin * 100).toFixed(1)}% row for ${where}?`)) return;
    setSaving(true);
    try {
      await trpcClient.margins.remove.mutate({
        authorityLevel: r.authorityLevel,
        productLine: r.productLine,
        region: r.region as (typeof REGIONS)[number],
      });
      setError(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The row could not be deleted.');
    } finally {
      setSaving(false);
    }
  };

  const applyImport = async () => {
    if (!parsed || parsed.rows.length === 0) return;
    setSaving(true);
    let done = 0;
    try {
      for (const r of parsed.rows) {
        await trpcClient.margins.save.mutate({
          authorityLevel: 'analyst',
          productLine: r.productLine,
          region: r.region,
          minimumMarginPercent: r.marginPercent,
          isPlaceholder: false,
          note: null,
        });
        done++;
      }
      setImportMessage(
        `Loaded ${done} figure${done === 1 ? '' : 's'}.` +
          (parsed.skipped.length > 0
            ? ` ${parsed.skipped.length} cell${parsed.skipped.length === 1 ? ' was' : 's were'} not loaded, so those lines use the default.`
            : '')
      );
      setPasteText('');
      setParsed(null);
      setPasteOpen(false);
      setError(null);
      await load();
    } catch (e) {
      setError(
        `Stopped after ${done} of ${parsed.rows.length}: ` +
          (e instanceof Error ? e.message : 'a row could not be saved.')
      );
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading…</div>;

  const placeholders = rows.filter((r) => r.isPlaceholder).length;

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Approval margins</h2>
          <p className="mt-1 text-sm text-gray-600 max-w-2xl">
            The lowest margin an analyst can quote without approval. Below it, a quote is escalated
            in Channel Partners. The most specific row applies: a product line in a region, then the
            product line anywhere, then the region, then the default.
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setPasteOpen((v) => !v);
                setImportMessage(null);
              }}
              className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 text-sm"
            >
              <Upload size={16} />
              Paste a table
            </button>
            <button
              onClick={() => setDraft({ ...BLANK })}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 text-sm"
            >
              <Plus size={16} />
              Add a row
            </button>
          </div>
        )}
      </div>

      {placeholders > 0 && (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            {placeholders === 1 ? 'One row is a placeholder' : `${placeholders} rows are placeholders`},
            not a confirmed figure. Quotes priced against {placeholders === 1 ? 'it' : 'them'} say so.
          </span>
        </div>
      )}

      {!canEdit && (
        <div className="text-sm text-gray-500">
          Only an administrator can change these figures.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {importMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {importMessage}
        </div>
      )}

      {pasteOpen && canEdit && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <div className="text-sm font-medium text-gray-900">Paste a margin table</div>
          <p className="text-xs text-gray-600">
            Copy the grid from the spreadsheet: product lines down the side, a column for each
            region, a percentage in each cell. Only cells that are percentages are loaded. Anything
            else, such as a region name, is listed below and left for you to settle.
          </p>
          <textarea
            id="margin-paste"
            value={pasteText}
            onChange={(e) => {
              setPasteText(e.target.value);
              setParsed(e.target.value.trim() === '' ? null : parseMarginTable(e.target.value));
            }}
            rows={8}
            className="w-full rounded border border-gray-300 p-2 font-mono text-xs"
            placeholder={'Product Line\tNorth America\tEurope\nPumps\t41.0%\t38.0%'}
          />

          {parsed?.fatal && <div className="text-sm text-red-700">{parsed.fatal}</div>}

          {parsed && !parsed.fatal && (
            <div className="space-y-2 text-sm">
              <div className="text-gray-800">
                <span className="font-medium">{parsed.rows.length}</span> figure
                {parsed.rows.length === 1 ? '' : 's'} will be loaded
                {parsed.skipped.length > 0 && (
                  <>
                    , <span className="font-medium">{parsed.skipped.length}</span> cell
                    {parsed.skipped.length === 1 ? '' : 's'} held back
                  </>
                )}
                .
              </div>
              {parsed.skipped.length > 0 && (
                <details className="text-xs text-amber-800">
                  <summary className="cursor-pointer">Cells not loaded</summary>
                  <ul className="mt-1 space-y-0.5 pl-4 list-disc">
                    {parsed.skipped.map((s, i) => (
                      <li key={i}>
                        {s.productLine}, {s.region ?? 'unknown region'}: {s.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <button
                onClick={applyImport}
                disabled={saving || parsed.rows.length === 0}
                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-40 text-sm"
              >
                {saving ? 'Loading…' : `Load ${parsed.rows.length} figure${parsed.rows.length === 1 ? '' : 's'}`}
              </button>
            </div>
          )}
        </div>
      )}

      {draft && canEdit && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm font-medium text-gray-900 mb-3">
            {draft.editing ? 'Change a row' : 'Add a row'}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <label className="text-xs text-gray-600 space-y-1" htmlFor="floor-line">
              Product line
              <input
                id="floor-line"
                value={draft.productLine}
                disabled={draft.editing}
                onChange={(e) => setDraft({ ...draft, productLine: e.target.value })}
                placeholder="* for any"
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-50"
              />
            </label>
            <label className="text-xs text-gray-600 space-y-1" htmlFor="floor-region">
              Region
              <select
                id="floor-region"
                value={draft.region}
                disabled={draft.editing}
                onChange={(e) =>
                  setDraft({ ...draft, region: e.target.value as Draft['region'] })
                }
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-50"
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {label(r)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-600 space-y-1" htmlFor="floor-percent">
              Minimum margin (%)
              <input
                id="floor-percent"
                type="number"
                step="0.1"
                min="0"
                max="99.9"
                value={draft.percent}
                onChange={(e) => setDraft({ ...draft, percent: e.target.value })}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-gray-600 space-y-1" htmlFor="floor-note">
              Note
              <input
                id="floor-note"
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-gray-700" htmlFor="floor-placeholder">
            <input
              id="floor-placeholder"
              type="checkbox"
              checked={draft.isPlaceholder}
              onChange={(e) => setDraft({ ...draft, isPlaceholder: e.target.checked })}
            />
            Not confirmed yet (keep flagged as a placeholder)
          </label>
          <div className="mt-4 flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-40 text-sm"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => {
                setDraft(null);
                setError(null);
              }}
              className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Level', 'Product line', 'Region', 'Minimum margin', 'Status', 'Note', ''].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((r) => {
              const isDefault = r.productLine === '*' && r.region === '*';
              return (
                <tr key={`${r.authorityLevel}/${r.productLine}/${r.region}`}>
                  <td className="px-4 py-2.5 capitalize text-gray-600">{r.authorityLevel}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-900">
                    {isDefault ? 'Any product line (default)' : label(r.productLine)}
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{label(r.region)}</td>
                  <td className="px-4 py-2.5 font-semibold text-gray-900">
                    {(r.minimumMargin * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5">
                    {r.isPlaceholder ? (
                      <span className="inline-block rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                        placeholder
                      </span>
                    ) : (
                      <span className="inline-block rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                        confirmed
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 max-w-xs">{r.note}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-right">
                    {canEdit && (
                      <>
                        <button
                          onClick={() =>
                            setDraft({
                              productLine: r.productLine,
                              region: r.region as Draft['region'],
                              percent: (r.minimumMargin * 100).toFixed(1),
                              isPlaceholder: r.isPlaceholder,
                              note: r.note ?? '',
                              editing: true,
                            })
                          }
                          className="text-gray-500 hover:text-gray-900 mr-3"
                          title="Change"
                        >
                          <Pencil size={15} />
                        </button>
                        {!isDefault && (
                          <button
                            onClick={() => remove(r)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
