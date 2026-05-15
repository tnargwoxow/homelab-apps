import { useEffect, useState } from 'react';
import type { Recipe } from '../types';
import { NORWEGIAN_RECIPES } from '../data/norwegian-recipes';
import { fetchSeedMeals } from '../lib/themealdb';
import { loadJSON, saveJSON } from '../lib/storage';

const SEED_CACHE_KEY = 'mdb-seed';

type SeedCache = { ts: number; recipes: Recipe[] };

export function useRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>(() => {
    const cached = loadJSON<SeedCache | null>(SEED_CACHE_KEY, null);
    if (cached && Array.isArray(cached.recipes)) {
      return [...NORWEGIAN_RECIPES, ...cached.recipes];
    }
    return NORWEGIAN_RECIPES;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = loadJSON<SeedCache | null>(SEED_CACHE_KEY, null);
    const fresh = cached && Date.now() - cached.ts < 7 * 24 * 60 * 60 * 1000;
    if (fresh && cached.recipes.length) return;

    let cancelled = false;
    setLoading(true);
    fetchSeedMeals()
      .then((mdb) => {
        if (cancelled) return;
        if (mdb.length) {
          saveJSON<SeedCache>(SEED_CACHE_KEY, { ts: Date.now(), recipes: mdb });
          setRecipes([...NORWEGIAN_RECIPES, ...mdb]);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? 'kunne ikke laste oppskrifter');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const addRecipes = (more: Recipe[]) => {
    setRecipes((cur) => {
      const seen = new Set(cur.map((r) => r.id));
      const additions = more.filter((r) => !seen.has(r.id));
      return [...cur, ...additions];
    });
  };

  return { recipes, loading, error, addRecipes };
}
