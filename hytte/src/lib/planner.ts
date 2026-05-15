import type { FridgeItem, Recipe, WeekPlan, Weekday } from '../types';
import { WEEKDAYS } from '../types';

export function fridgeMatchCount(recipe: Recipe, fridge: FridgeItem[]): number {
  const have = new Set(fridge.map((f) => f.name));
  let n = 0;
  for (const ing of recipe.ingredients) {
    if (have.has(ing.name)) n++;
  }
  return n;
}

export function fridgeMatchRatio(recipe: Recipe, fridge: FridgeItem[]): number {
  if (!recipe.ingredients.length) return 0;
  return fridgeMatchCount(recipe, fridge) / recipe.ingredients.length;
}

type ScoredRecipe = { recipe: Recipe; score: number };

function scoreRecipe(recipe: Recipe, fridge: FridgeItem[], cuisineCounts: Record<string, number>): number {
  const match = fridgeMatchCount(recipe, fridge);
  const total = recipe.ingredients.length || 1;
  const wouldNeedToBuy = total - match;
  let score = match * 1.5 - wouldNeedToBuy * 0.25;

  // Repetition penalty (already picked this cuisine twice)
  const reps = cuisineCounts[recipe.cuisine] ?? 0;
  if (reps >= 1) score -= 0.8;
  if (reps >= 2) score -= 2.0;

  // Mild bias toward Norwegian: keep some traditional food in the week.
  if (recipe.cuisine === 'Norwegian') score += 0.3;

  // Small random jitter to break ties (so suggestion ≠ identical each time)
  score += Math.random() * 0.5;

  return score;
}

/**
 * Build a 7-day plan from a pool of recipes, optimising for fridge overlap and
 * cuisine variety. `keepDays` is a set of weekdays whose existing assignments
 * we should NOT change (used for "reshuffle this day" or "fill the empty slots").
 */
export function suggestWeek(
  pool: Recipe[],
  fridge: FridgeItem[],
  weekStartISO: string,
  existing?: WeekPlan,
  keepDays: Set<Weekday> = new Set(),
): WeekPlan {
  const cuisineCounts: Record<string, number> = {};
  const used = new Set<string>();
  const days: Record<Weekday, string | null> = {
    man: null,
    tir: null,
    ons: null,
    tor: null,
    fre: null,
    lor: null,
    son: null,
  };

  // Preserve kept days
  if (existing) {
    for (const d of WEEKDAYS) {
      if (keepDays.has(d) && existing.days[d]) {
        const rid = existing.days[d]!;
        const r = pool.find((p) => p.id === rid);
        if (r) {
          days[d] = rid;
          used.add(rid);
          cuisineCounts[r.cuisine] = (cuisineCounts[r.cuisine] ?? 0) + 1;
        }
      }
    }
  }

  for (const day of WEEKDAYS) {
    if (days[day]) continue;
    const candidates: ScoredRecipe[] = pool
      .filter((r) => !used.has(r.id))
      .map((r) => ({ recipe: r, score: scoreRecipe(r, fridge, cuisineCounts) }));

    if (!candidates.length) break;
    candidates.sort((a, b) => b.score - a.score);
    // Pick from top 3 with weighted randomness for variety
    const topN = candidates.slice(0, Math.min(3, candidates.length));
    const pick = topN[Math.floor(Math.random() * topN.length)];

    days[day] = pick.recipe.id;
    used.add(pick.recipe.id);
    cuisineCounts[pick.recipe.cuisine] = (cuisineCounts[pick.recipe.cuisine] ?? 0) + 1;
  }

  return { weekStartISO, days };
}

/* ------------------------------------------------------------------ */
/* Week helpers                                                        */
/* ------------------------------------------------------------------ */

export function startOfISOWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function formatWeekLabel(weekStartISO: string): string {
  const start = new Date(weekStartISO + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const wk = isoWeekNumber(start);
  const months = [
    'januar', 'februar', 'mars', 'april', 'mai', 'juni',
    'juli', 'august', 'september', 'oktober', 'november', 'desember',
  ];
  const sd = start.getDate();
  const ed = end.getDate();
  const sm = months[start.getMonth()];
  const em = months[end.getMonth()];
  if (start.getMonth() === end.getMonth()) {
    return `Uke ${wk} · ${sd}.–${ed}. ${sm} ${start.getFullYear()}`;
  }
  return `Uke ${wk} · ${sd}. ${sm}–${ed}. ${em} ${start.getFullYear()}`;
}

export function emptyPlan(weekStartISO: string): WeekPlan {
  return {
    weekStartISO,
    days: { man: null, tir: null, ons: null, tor: null, fre: null, lor: null, son: null },
  };
}
