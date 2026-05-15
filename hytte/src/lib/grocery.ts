import type { FridgeItem, GroceryList, GroceryRow, Recipe, WeekPlan } from '../types';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../types';
import { formatQty, fromBaseUnit, toBaseUnit, unitFamily } from './ingredients';

export function buildGroceryList(
  plan: WeekPlan,
  recipes: Recipe[],
  fridge: FridgeItem[],
  servingsMultiplier = 1,
): GroceryList {
  const inFridge = new Set(fridge.map((f) => f.name));
  const byId = new Map(recipes.map((r) => [r.id, r]));

  // Aggregation key: name + base unit (so 200g + 0.5kg merges)
  type Agg = {
    name: string;
    display: string;
    baseUnit: string;
    qty: number;
    category: GroceryRow['category'];
    titles: Set<string>;
  };
  const buckets = new Map<string, Agg>();

  for (const day of Object.values(plan.days)) {
    if (!day) continue;
    const recipe = byId.get(day);
    if (!recipe) continue;
    const scale = (servingsMultiplier * 4) / (recipe.servings || 4);

    for (const ing of recipe.ingredients) {
      if (inFridge.has(ing.name)) continue;

      const { qty: baseQty, baseUnit } = toBaseUnit(ing.qty * scale, ing.unit);
      const key = `${ing.name}|${baseUnit}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.qty += baseQty;
        existing.titles.add(recipe.title);
      } else {
        buckets.set(key, {
          name: ing.name,
          display: ing.display,
          baseUnit,
          qty: baseQty,
          category: ing.category,
          titles: new Set([recipe.title]),
        });
      }
    }
  }

  const rows: GroceryRow[] = Array.from(buckets.values()).map((agg) => {
    const { qty, unit } = fromBaseUnit(agg.qty, agg.baseUnit as any);
    return {
      key: `${agg.name}|${unit}`,
      display: agg.display,
      qty,
      unit,
      category: agg.category,
      fromRecipes: Array.from(agg.titles),
    };
  });

  // Sort by category order, then alphabetically
  rows.sort((a, b) => {
    const ca = CATEGORY_ORDER.indexOf(a.category);
    const cb = CATEGORY_ORDER.indexOf(b.category);
    if (ca !== cb) return ca - cb;
    return a.display.localeCompare(b.display, 'nb');
  });

  return { weekStartISO: plan.weekStartISO, rows };
}

export function groupByCategory(rows: GroceryRow[]) {
  const out = new Map<GroceryRow['category'], GroceryRow[]>();
  for (const r of rows) {
    if (!out.has(r.category)) out.set(r.category, []);
    out.get(r.category)!.push(r);
  }
  // Preserve CATEGORY_ORDER
  return CATEGORY_ORDER.filter((c) => out.has(c)).map((c) => ({
    category: c,
    label: CATEGORY_LABELS[c],
    rows: out.get(c)!,
  }));
}

export function formatGroceryRow(row: GroceryRow): string {
  return `${row.display} — ${formatQty(row.qty, row.unit)}`;
}

export function groceryAsText(list: GroceryList): string {
  const lines: string[] = [`Handleliste — uke som starter ${list.weekStartISO}`, ''];
  for (const group of groupByCategory(list.rows)) {
    lines.push(`# ${group.label}`);
    for (const row of group.rows) {
      lines.push(`- ${formatGroceryRow(row)}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

// re-export for components that build their own grouping
export { unitFamily };
