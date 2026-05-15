import { useMemo, useState } from 'react';
import type { FridgeItem, IngredientCategory } from '../types';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../types';
import { canonicalize } from '../lib/ingredients';
import { CheckIcon, PlusIcon, XIcon } from './icons';

const COMMON: Array<{ name: string; display: string; category: IngredientCategory }> = [
  // Produce
  { name: 'potet', display: 'Poteter', category: 'produce' },
  { name: 'lok', display: 'Løk', category: 'produce' },
  { name: 'hvitlok', display: 'Hvitløk', category: 'produce' },
  { name: 'gulrot', display: 'Gulrøtter', category: 'produce' },
  { name: 'tomat', display: 'Tomater', category: 'produce' },
  { name: 'paprika', display: 'Paprika', category: 'produce' },
  { name: 'sopp', display: 'Sopp', category: 'produce' },
  { name: 'agurk', display: 'Agurk', category: 'produce' },
  { name: 'salat', display: 'Salat', category: 'produce' },
  { name: 'sitron', display: 'Sitron', category: 'produce' },
  { name: 'eple', display: 'Eple', category: 'produce' },
  { name: 'kal', display: 'Kål', category: 'produce' },
  { name: 'brokkoli', display: 'Brokkoli', category: 'produce' },
  { name: 'persille', display: 'Persille', category: 'produce' },
  // Dairy
  { name: 'melk', display: 'Melk', category: 'dairy' },
  { name: 'smor', display: 'Smør', category: 'dairy' },
  { name: 'egg', display: 'Egg', category: 'dairy' },
  { name: 'ost', display: 'Ost', category: 'dairy' },
  { name: 'flote', display: 'Fløte', category: 'dairy' },
  { name: 'rommet', display: 'Rømme', category: 'dairy' },
  { name: 'yoghurt', display: 'Yoghurt', category: 'dairy' },
  // Meat & fish
  { name: 'kyllingfilet', display: 'Kyllingfilet', category: 'meat' },
  { name: 'kjottdeig', display: 'Kjøttdeig', category: 'meat' },
  { name: 'bacon', display: 'Bacon', category: 'meat' },
  { name: 'palse', display: 'Pølser', category: 'meat' },
  { name: 'laks', display: 'Laks', category: 'fish' },
  { name: 'torsk', display: 'Torsk', category: 'fish' },
  // Pantry
  { name: 'mel', display: 'Hvetemel', category: 'pantry' },
  { name: 'sukker', display: 'Sukker', category: 'pantry' },
  { name: 'salt', display: 'Salt', category: 'pantry' },
  { name: 'pepper', display: 'Pepper', category: 'pantry' },
  { name: 'olje', display: 'Olje', category: 'pantry' },
  { name: 'olivenolje', display: 'Olivenolje', category: 'pantry' },
  { name: 'ris', display: 'Ris', category: 'pantry' },
  { name: 'pasta', display: 'Pasta', category: 'pantry' },
  { name: 'hermetisk-tomat', display: 'Hermetiske tomater', category: 'pantry' },
  { name: 'bouillon', display: 'Buljong', category: 'pantry' },
  // Bakery
  { name: 'brod', display: 'Brød', category: 'bakery' },
];

type Props = {
  fridge: FridgeItem[];
  onChange: (next: FridgeItem[]) => void;
};

export function FridgePanel({ fridge, onChange }: Props) {
  const [custom, setCustom] = useState('');
  const have = useMemo(() => new Set(fridge.map((f) => f.name)), [fridge]);

  const toggle = (item: { name: string; display: string; category: IngredientCategory }) => {
    if (have.has(item.name)) {
      onChange(fridge.filter((f) => f.name !== item.name));
    } else {
      onChange([...fridge, item]);
    }
  };

  const addCustom = () => {
    const trimmed = custom.trim();
    if (!trimmed) return;
    const canon = canonicalize(trimmed);
    if (have.has(canon.canonical)) {
      setCustom('');
      return;
    }
    onChange([
      ...fridge,
      { name: canon.canonical, display: canon.display, category: canon.category },
    ]);
    setCustom('');
  };

  const grouped = useMemo(() => {
    const byCat = new Map<IngredientCategory, typeof COMMON>();
    for (const c of COMMON) {
      if (!byCat.has(c.category)) byCat.set(c.category, []);
      byCat.get(c.category)!.push(c);
    }
    // Include custom items the user typed
    for (const f of fridge) {
      if (!COMMON.find((c) => c.name === f.name)) {
        if (!byCat.has(f.category)) byCat.set(f.category, []);
        byCat.get(f.category)!.push(f);
      }
    }
    return CATEGORY_ORDER.filter((c) => byCat.has(c)).map((c) => ({
      category: c,
      label: CATEGORY_LABELS[c],
      items: byCat.get(c)!,
    }));
  }, [fridge]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="heading text-2xl">Kjøleskapet</h2>
        <p className="text-sm text-hytte-ash">
          Hak av det du har — vi prøver å foreslå retter som bruker det opp og holder handlelista kort.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="Legg til egen vare…"
          className="flex-1 rounded-lg border border-hytte-wood/20 bg-hytte-snow px-3 py-2 text-sm focus:border-hytte-pine focus:outline-none"
        />
        <button type="button" onClick={addCustom} className="btn-outline">
          <PlusIcon className="h-4 w-4" />
          Legg til
        </button>
      </div>

      <div className="space-y-3">
        {grouped.map((group) => (
          <section key={group.category}>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-hytte-wood">
              {group.label}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {group.items.map((item) => {
                const on = have.has(item.name);
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => toggle(item)}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition ${
                      on
                        ? 'border-hytte-pine bg-hytte-pine text-hytte-snow shadow-hytteSm'
                        : 'border-hytte-wood/20 bg-hytte-snow text-hytte-coal hover:border-hytte-pine/60 hover:bg-hytte-pine/5'
                    }`}
                  >
                    {on ? <CheckIcon className="h-3.5 w-3.5" /> : null}
                    {item.display}
                    {on && !COMMON.find((c) => c.name === item.name) ? (
                      <span
                        role="button"
                        tabIndex={-1}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-hytte-snow/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          onChange(fridge.filter((f) => f.name !== item.name));
                        }}
                      >
                        <XIcon className="h-2.5 w-2.5" />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {fridge.length > 0 ? (
        <button
          type="button"
          onClick={() => onChange([])}
          className="text-xs text-hytte-ash underline-offset-4 hover:underline"
        >
          Tøm kjøleskapet
        </button>
      ) : null}
    </div>
  );
}
