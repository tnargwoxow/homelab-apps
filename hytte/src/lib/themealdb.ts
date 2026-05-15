import type { Recipe, Ingredient } from '../types';
import { canonicalize, parseMeasure } from './ingredients';
import { loadJSON, saveJSON } from './storage';

const BASE = 'https://www.themealdb.com/api/json/v1/1';
const CACHE_KEY = 'themealdb-cache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

type CacheEntry = { ts: number; data: unknown };
type Cache = Record<string, CacheEntry>;

function getCache(): Cache {
  return loadJSON<Cache>(CACHE_KEY, {});
}

function setCache(cache: Cache) {
  saveJSON(CACHE_KEY, cache);
}

async function fetchCached(path: string): Promise<unknown> {
  const cache = getCache();
  const hit = cache[path];
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`TheMealDB ${path} → ${res.status}`);
  const data = await res.json();
  cache[path] = { ts: Date.now(), data };
  setCache(cache);
  return data;
}

type RawMeal = {
  idMeal: string;
  strMeal: string;
  strCategory?: string;
  strArea?: string;
  strInstructions?: string;
  strMealThumb?: string;
  strSource?: string;
  strTags?: string;
  [k: string]: unknown;
};

export function normalizeMeal(raw: RawMeal): Recipe {
  const ingredients: Ingredient[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = (raw[`strIngredient${i}`] as string | undefined)?.trim();
    const measure = (raw[`strMeasure${i}`] as string | undefined)?.trim();
    if (!name) continue;
    const canon = canonicalize(name);
    const { qty, unit } = parseMeasure(measure);
    ingredients.push({
      name: canon.canonical,
      display: canon.display,
      qty,
      unit,
      category: canon.category,
    });
  }

  // Crude instruction split — TheMealDB returns one big blob.
  const rawInstr = raw.strInstructions || '';
  const instructions = rawInstr
    .split(/(?:\r?\n)+|(?<=\.)\s+(?=[A-ZÆØÅ])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 6);

  return {
    id: `mdb-${raw.idMeal}`,
    title: raw.strMeal,
    source: 'themealdb',
    sourceUrl: raw.strSource || `https://www.themealdb.com/meal.php?c=${raw.idMeal}`,
    image: raw.strMealThumb,
    cuisine: raw.strArea || 'International',
    tags: (raw.strTags || '').split(',').map((t) => t.trim()).filter(Boolean),
    servings: 4,
    prepMinutes: 15,
    cookMinutes: 30,
    ingredients,
    instructions: instructions.length ? instructions : [rawInstr],
  };
}

export async function fetchRandomMeals(count: number): Promise<Recipe[]> {
  const meals: Recipe[] = [];
  const seen = new Set<string>();
  // TheMealDB random has no cache benefit, but we de-dupe in case of repeats.
  for (let i = 0; i < count * 2 && meals.length < count; i++) {
    try {
      const res = await fetch(`${BASE}/random.php`);
      if (!res.ok) continue;
      const json = (await res.json()) as { meals?: RawMeal[] };
      const m = json.meals?.[0];
      if (!m || seen.has(m.idMeal)) continue;
      seen.add(m.idMeal);
      meals.push(normalizeMeal(m));
    } catch {
      // network error — return what we have
      break;
    }
  }
  return meals;
}

export async function searchMealsByName(query: string): Promise<Recipe[]> {
  if (!query.trim()) return [];
  try {
    const data = (await fetchCached(`/search.php?s=${encodeURIComponent(query.trim())}`)) as {
      meals: RawMeal[] | null;
    };
    return (data.meals ?? []).map(normalizeMeal);
  } catch {
    return [];
  }
}

/**
 * Seed recipes: fetched once and cached forever-ish. We pull a handful
 * of curated names known to exist in TheMealDB so the app has variety
 * even on first load, without burning random API calls.
 */
const SEED_NAMES = [
  'Spaghetti Bolognese',
  'Chicken Alfredo',
  'Fish Pie',
  'Beef Stroganoff',
  'Vegetarian Chilli',
  'Thai Green Curry',
  'Chicken Tikka Masala',
  'Mushroom Risotto',
  'Beef Wellington',
  'Tortilla Espanola',
  'Tuna Pasta',
  'Pad Thai',
];

export async function fetchSeedMeals(): Promise<Recipe[]> {
  const all: Recipe[] = [];
  for (const name of SEED_NAMES) {
    const meals = await searchMealsByName(name);
    if (meals[0]) all.push(meals[0]);
  }
  return all;
}
