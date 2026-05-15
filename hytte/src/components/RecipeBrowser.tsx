import { useMemo, useState } from 'react';
import type { FridgeItem, Recipe } from '../types';
import { fridgeMatchRatio } from '../lib/planner';
import { searchMealsByName } from '../lib/themealdb';
import { RecipeCard } from './RecipeCard';

type Props = {
  recipes: Recipe[];
  fridge: FridgeItem[];
  onPick: (r: Recipe) => void;
  onAddRecipes: (more: Recipe[]) => void;
};

export function RecipeBrowser({ recipes, fridge, onPick, onAddRecipes }: Props) {
  const [query, setQuery] = useState('');
  const [cuisine, setCuisine] = useState<'all' | 'norwegian' | 'international'>('all');
  const [useFridge, setUseFridge] = useState(false);
  const [searching, setSearching] = useState(false);

  const cuisines = useMemo(() => {
    const set = new Set<string>();
    for (const r of recipes) set.add(r.cuisine);
    return Array.from(set).sort();
  }, [recipes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = recipes.slice();

    if (cuisine === 'norwegian') {
      out = out.filter((r) => r.cuisine === 'Norwegian');
    } else if (cuisine === 'international') {
      out = out.filter((r) => r.cuisine !== 'Norwegian');
    }

    if (q) {
      out = out.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.cuisine.toLowerCase().includes(q) ||
          r.tags.some((t) => t.toLowerCase().includes(q)) ||
          r.ingredients.some(
            (i) => i.display.toLowerCase().includes(q) || i.name.includes(q),
          ),
      );
    }

    if (useFridge) {
      out = out
        .map((r) => ({ r, m: fridgeMatchRatio(r, fridge) }))
        .filter((x) => x.m > 0)
        .sort((a, b) => b.m - a.m)
        .map((x) => x.r);
    } else {
      // Default sort: Norwegian first, then alphabetic
      out.sort((a, b) => {
        if (a.cuisine === 'Norwegian' && b.cuisine !== 'Norwegian') return -1;
        if (b.cuisine === 'Norwegian' && a.cuisine !== 'Norwegian') return 1;
        return a.title.localeCompare(b.title, 'nb');
      });
    }

    return out;
  }, [recipes, query, cuisine, useFridge, fridge]);

  const onSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const remote = await searchMealsByName(query);
      if (remote.length) onAddRecipes(remote);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="heading text-2xl">Oppskrifter</h2>
        <p className="text-sm text-hytte-ash">
          Norske klassikere bundlet inn, samt en utvalg fra TheMealDB. Søk for å hente flere.
        </p>
      </div>

      <form onSubmit={onSearchSubmit} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Søk etter rett, kjøkken eller ingrediens…"
          className="flex-1 rounded-lg border border-hytte-wood/20 bg-hytte-snow px-3 py-2 text-sm focus:border-hytte-pine focus:outline-none"
        />
        <button type="submit" className="btn-outline" disabled={searching}>
          {searching ? 'Søker…' : 'Søk online'}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="inline-flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={useFridge}
            onChange={(e) => setUseFridge(e.target.checked)}
            className="accent-hytte-pine"
          />
          Bruk det jeg har i kjøleskapet
        </label>
        <span className="text-hytte-ash">·</span>
        {(['all', 'norwegian', 'international'] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCuisine(c)}
            className={`rounded-full px-2.5 py-0.5 ${
              cuisine === c
                ? 'bg-hytte-pine text-hytte-snow'
                : 'border border-hytte-wood/20 bg-hytte-snow text-hytte-coal hover:bg-hytte-parchment'
            }`}
          >
            {c === 'all' ? 'Alle' : c === 'norwegian' ? 'Norsk' : 'Internasjonal'}
          </button>
        ))}
        <span className="ml-auto text-hytte-ash">{filtered.length} treff</span>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-hytte-wood/30 bg-hytte-snow/40 px-4 py-8 text-center text-sm text-hytte-ash">
          Ingen oppskrifter matcher. Prøv «Søk online» for å hente fra TheMealDB.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.slice(0, 60).map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              matchPct={useFridge ? fridgeMatchRatio(r, fridge) : undefined}
              onClick={() => onPick(r)}
              compact
            />
          ))}
        </div>
      )}

      <p className="mt-2 text-[0.65rem] text-hytte-ash">
        Oppskriftsdata fra <a className="underline decoration-dotted hover:text-hytte-pine" href="https://www.themealdb.com" target="_blank" rel="noreferrer">TheMealDB</a> samt egen norsk samling. Bilder fra Wikimedia Commons.
      </p>
      {cuisines.length === 1 ? <span className="hidden" /> : null}
    </div>
  );
}
