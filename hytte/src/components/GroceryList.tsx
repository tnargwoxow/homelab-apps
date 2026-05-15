import { useMemo } from 'react';
import type { GroceryList as GL } from '../types';
import { formatQty } from '../lib/ingredients';
import { groceryAsText, groupByCategory } from '../lib/grocery';
import { CheckIcon, CopyIcon, PrinterIcon } from './icons';

type Props = {
  list: GL;
  checked: Record<string, boolean>;
  onToggle: (key: string) => void;
  onClearChecked: () => void;
};

export function GroceryList({ list, checked, onToggle, onClearChecked }: Props) {
  const groups = useMemo(() => groupByCategory(list.rows), [list]);
  const total = list.rows.length;
  const done = list.rows.filter((r) => checked[r.key]).length;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(groceryAsText(list));
    } catch {
      // noop — older browsers
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="heading text-2xl">Handleliste</h2>
          <p className="text-sm text-hytte-ash">
            Det du må kjøpe for ukens meny — kjøleskapet er allerede trukket fra.
          </p>
        </div>
        <div className="no-print flex flex-none flex-col items-end gap-1">
          <div className="flex gap-1.5">
            <button type="button" className="btn-outline px-2 py-1.5 text-xs" onClick={copy} title="Kopier som tekst">
              <CopyIcon className="h-3.5 w-3.5" />
              Kopier
            </button>
            <button
              type="button"
              className="btn-outline px-2 py-1.5 text-xs"
              onClick={() => window.print()}
              title="Skriv ut"
            >
              <PrinterIcon className="h-3.5 w-3.5" />
              Skriv ut
            </button>
          </div>
          {done > 0 ? (
            <button
              type="button"
              onClick={onClearChecked}
              className="text-[0.7rem] text-hytte-ash underline-offset-4 hover:underline"
            >
              Nullstill avkrysset
            </button>
          ) : null}
        </div>
      </div>

      {total === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-hytte-wood/30 bg-hytte-snow/40 px-4 py-8 text-center text-sm text-hytte-ash">
          Ingen rettar er valgt for denne uka enda. Trykk «Forslå ukens meny» eller legg til en rett selv.
        </p>
      ) : (
        <>
          <p className="mt-3 text-xs text-hytte-ash">
            {done} av {total} hentet
          </p>
          <div className="mt-3 space-y-4">
            {groups.map((g) => (
              <section key={g.category}>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-hytte-wood">
                  {g.label}
                </h3>
                <ul className="divide-y divide-hytte-wood/10 rounded-lg border border-hytte-wood/15 bg-hytte-snow/70">
                  {g.rows.map((row) => {
                    const isChecked = !!checked[row.key];
                    return (
                      <li key={row.key}>
                        <button
                          type="button"
                          onClick={() => onToggle(row.key)}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-hytte-cream/60"
                        >
                          <span className="flex items-center gap-3">
                            <span
                              className={`inline-flex h-5 w-5 flex-none items-center justify-center rounded-md border ${
                                isChecked
                                  ? 'border-hytte-pine bg-hytte-pine text-hytte-snow'
                                  : 'border-hytte-wood/30 bg-hytte-snow'
                              }`}
                              aria-hidden
                            >
                              {isChecked ? <CheckIcon className="h-3 w-3" /> : null}
                            </span>
                            <span className={isChecked ? 'text-hytte-ash line-through' : ''}>
                              {row.display}
                            </span>
                          </span>
                          <span
                            className={`font-mono text-xs ${
                              isChecked ? 'text-hytte-ash line-through' : 'text-hytte-coal/80'
                            }`}
                          >
                            {formatQty(row.qty, row.unit)}
                          </span>
                        </button>
                        {row.fromRecipes.length > 1 ? (
                          <p className="px-9 pb-1.5 text-[0.65rem] text-hytte-ash">
                            til: {row.fromRecipes.join(', ')}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
