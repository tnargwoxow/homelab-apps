import type { IngredientCategory, Unit } from '../types';

/* ------------------------------------------------------------------ */
/* Normalization                                                       */
/* ------------------------------------------------------------------ */

export function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function normalizeName(s: string): string {
  return stripDiacritics(s.trim().toLowerCase())
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-zæøå0-9\s-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ------------------------------------------------------------------ */
/* Synonym map  ── English ↔ Norwegian canonical                       */
/* Keys and values are normalized (lowercased, no diacritics).         */
/* The "canonical" value is what we store as `name` in Ingredient.     */
/* ------------------------------------------------------------------ */

type Syn = { canonical: string; display: string; category: IngredientCategory };

const SYNONYMS: Record<string, Syn> = {};

function add(canonical: string, display: string, category: IngredientCategory, aliases: string[]) {
  const entry: Syn = { canonical, display, category };
  SYNONYMS[canonical] = entry;
  for (const a of aliases) SYNONYMS[normalizeName(a)] = entry;
}

// Produce
add('potet', 'Poteter', 'produce', ['potato', 'potatoes', 'poteter', 'mandelpotet']);
add('lok', 'Løk', 'produce', ['onion', 'onions', 'løk', 'gul lok', 'rod lok', 'red onion']);
add('hvitlok', 'Hvitløk', 'produce', ['garlic', 'hvitløk', 'garlic clove', 'garlic cloves']);
add('gulrot', 'Gulrøtter', 'produce', ['carrot', 'carrots', 'gulrøtter']);
add('tomat', 'Tomater', 'produce', ['tomato', 'tomatoes', 'cherry tomato', 'cherry tomatoes', 'plum tomato']);
add('paprika', 'Paprika', 'produce', ['bell pepper', 'pepper', 'red pepper', 'green pepper']);
add('sopp', 'Sopp', 'produce', ['mushroom', 'mushrooms', 'champignon']);
add('salat', 'Salat', 'produce', ['lettuce', 'salad']);
add('agurk', 'Agurk', 'produce', ['cucumber']);
add('sitron', 'Sitron', 'produce', ['lemon', 'lemons']);
add('lime', 'Lime', 'produce', ['limes']);
add('eple', 'Eple', 'produce', ['apple', 'apples']);
add('banan', 'Banan', 'produce', ['banana']);
add('kalrot', 'Kålrot', 'produce', ['swede', 'rutabaga', 'kålrot']);
add('kal', 'Kål', 'produce', ['cabbage', 'kål', 'hodekål', 'savoy cabbage']);
add('blomkal', 'Blomkål', 'produce', ['cauliflower', 'blomkål']);
add('brokkoli', 'Brokkoli', 'produce', ['broccoli']);
add('purre', 'Purre', 'produce', ['leek', 'leeks']);
add('selleri', 'Selleri', 'produce', ['celery', 'celery stalk']);
add('persille', 'Persille', 'produce', ['parsley']);
add('koriander', 'Koriander', 'produce', ['cilantro', 'coriander']);
add('basilikum', 'Basilikum', 'produce', ['basil']);
add('timian', 'Timian', 'produce', ['thyme']);
add('rosmarin', 'Rosmarin', 'produce', ['rosemary']);
add('ingefar', 'Ingefær', 'produce', ['ginger', 'ingefær']);
add('chili', 'Chili', 'produce', ['chilli', 'chili pepper', 'red chilli']);

// Meat
add('kyllingfilet', 'Kyllingfilet', 'meat', ['chicken breast', 'chicken fillet', 'chicken']);
add('kjottdeig', 'Kjøttdeig', 'meat', ['minced beef', 'ground beef', 'mince', 'beef mince', 'kjøttdeig']);
add('biff', 'Biff', 'meat', ['steak', 'beef steak', 'sirloin']);
add('svinekam', 'Svinekam', 'meat', ['pork loin', 'pork']);
add('bacon', 'Bacon', 'meat', ['bacon strips']);
add('palse', 'Pølser', 'meat', ['sausage', 'sausages', 'pølse', 'pølser']);
add('lammekjott', 'Lammekjøtt', 'meat', ['lamb', 'lamb shoulder', 'lamb meat']);
add('skinke', 'Skinke', 'meat', ['ham']);
add('pinnekjott', 'Pinnekjøtt', 'meat', ['cured lamb ribs', 'pinnekjøtt']);

// Fish
add('laks', 'Laks', 'fish', ['salmon', 'salmon fillet']);
add('torsk', 'Torsk', 'fish', ['cod', 'cod fillet']);
add('makrell', 'Makrell', 'fish', ['mackerel']);
add('reker', 'Reker', 'fish', ['shrimp', 'prawns', 'shrimps']);
add('fiskeboller', 'Fiskeboller', 'fish', ['fish balls', 'fiskeboller']);
add('tunfisk', 'Tunfisk', 'fish', ['tuna']);
add('sild', 'Sild', 'fish', ['herring']);

// Dairy
add('melk', 'Melk', 'dairy', ['milk', 'whole milk']);
add('fløte', 'Fløte', 'dairy', ['cream', 'heavy cream', 'double cream', 'fløte']);
add('rommet', 'Rømme', 'dairy', ['sour cream', 'rømme']);
add('smor', 'Smør', 'dairy', ['butter', 'smør']);
add('ost', 'Ost', 'dairy', ['cheese', 'cheddar', 'gouda', 'norvegia']);
add('parmesan', 'Parmesan', 'dairy', ['parmigiano', 'parmesan cheese']);
add('feta', 'Feta', 'dairy', ['feta cheese']);
add('yoghurt', 'Yoghurt', 'dairy', ['yogurt', 'greek yogurt']);
add('egg', 'Egg', 'dairy', ['eggs']);

// Bakery
add('brod', 'Brød', 'bakery', ['bread', 'loaf', 'brød']);
add('rundstykker', 'Rundstykker', 'bakery', ['rolls', 'bread rolls']);
add('lomper', 'Lomper', 'bakery', ['potato wraps', 'lompe']);
add('tortilla', 'Tortilla', 'bakery', ['wrap', 'tortillas', 'flour tortilla']);

// Pantry
add('mel', 'Hvetemel', 'pantry', ['flour', 'plain flour', 'all-purpose flour', 'wheat flour']);
add('sukker', 'Sukker', 'pantry', ['sugar', 'granulated sugar']);
add('salt', 'Salt', 'pantry', ['sea salt']);
add('pepper', 'Pepper', 'pantry', ['black pepper', 'ground pepper']);
add('olje', 'Olje', 'pantry', ['vegetable oil', 'oil', 'rapeseed oil']);
add('olivenolje', 'Olivenolje', 'pantry', ['olive oil']);
add('eddik', 'Eddik', 'pantry', ['vinegar', 'white vinegar']);
add('soyasaus', 'Soyasaus', 'pantry', ['soy sauce']);
add('sennep', 'Sennep', 'pantry', ['mustard', 'dijon mustard']);
add('ketchup', 'Ketchup', 'pantry', ['tomato ketchup']);
add('honning', 'Honning', 'pantry', ['honey']);
add('ris', 'Ris', 'pantry', ['rice', 'basmati rice', 'jasmine rice']);
add('pasta', 'Pasta', 'pantry', ['spaghetti', 'penne', 'fettuccine', 'macaroni', 'makaroni']);
add('havregryn', 'Havregryn', 'pantry', ['oats', 'rolled oats']);
add('linser', 'Linser', 'pantry', ['lentils', 'red lentils']);
add('kikerter', 'Kikerter', 'pantry', ['chickpeas', 'garbanzo beans']);
add('hermetisk-tomat', 'Hermetiske tomater', 'pantry', [
  'canned tomato',
  'canned tomatoes',
  'chopped tomatoes',
  'tomato sauce',
  'crushed tomatoes',
  'tomatpure',
  'tomatpuré',
]);
add('bouillon', 'Buljong', 'pantry', ['stock', 'broth', 'chicken stock', 'beef stock', 'vegetable stock', 'bouillon', 'buljong']);
add('kokos', 'Kokosmelk', 'pantry', ['coconut milk']);
add('paprikapulver', 'Paprikapulver', 'pantry', ['paprika powder', 'sweet paprika']);
add('karri', 'Karri', 'pantry', ['curry powder']);
add('kanel', 'Kanel', 'pantry', ['cinnamon']);
add('muskat', 'Muskatnøtt', 'pantry', ['nutmeg']);
add('gjaer', 'Gjær', 'pantry', ['yeast', 'gjær']);
add('bakepulver', 'Bakepulver', 'pantry', ['baking powder']);
add('natron', 'Natron', 'pantry', ['baking soda', 'bicarbonate']);
add('vaniljesukker', 'Vaniljesukker', 'pantry', ['vanilla sugar', 'vanilla']);
add('rosiner', 'Rosiner', 'pantry', ['raisins']);

// Frozen
add('arter', 'Erter', 'frozen', ['peas', 'frozen peas', 'green peas']);
add('mais', 'Mais', 'pantry', ['corn', 'sweetcorn']);

/* ------------------------------------------------------------------ */

export function canonicalize(rawName: string): Syn {
  const n = normalizeName(rawName);
  if (SYNONYMS[n]) return SYNONYMS[n];

  // Try removing trailing s (rough English plural)
  if (n.endsWith('s') && SYNONYMS[n.slice(0, -1)]) return SYNONYMS[n.slice(0, -1)];

  // Try first word (e.g. "fresh basil" → "basil")
  const parts = n.split(' ');
  if (parts.length > 1) {
    const last = parts[parts.length - 1];
    if (SYNONYMS[last]) return SYNONYMS[last];
    const first = parts[0];
    if (SYNONYMS[first]) return SYNONYMS[first];
  }

  // Unknown ingredient — fall back to title-case display, "other" category
  const display = rawName
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
  return { canonical: n.replace(/\s+/g, '-') || 'ukjent', display: display || rawName, category: 'other' };
}

/* ------------------------------------------------------------------ */
/* Unit parsing                                                        */
/* ------------------------------------------------------------------ */

const UNIT_ALIASES: Record<string, Unit> = {
  g: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  kilogram: 'kg',
  ml: 'ml',
  l: 'l',
  liter: 'l',
  liters: 'l',
  dl: 'dl',
  stk: 'stk',
  st: 'stk',
  pcs: 'stk',
  piece: 'stk',
  pieces: 'stk',
  ts: 'ts',
  tsp: 'ts',
  teaspoon: 'ts',
  teaspoons: 'ts',
  ss: 'ss',
  tbsp: 'ss',
  tablespoon: 'ss',
  tablespoons: 'ss',
  klype: 'klype',
  pinch: 'klype',
  cup: 'dl', // approx — 1 cup ~ 2.4 dl (we round to 2 dl scale in display)
  cups: 'dl',
  pakke: 'pakke',
  pack: 'pakke',
  package: 'pakke',
  boks: 'boks',
  can: 'boks',
  cans: 'boks',
};

function fractionToNumber(s: string): number {
  // Handles "1/2", "1 1/2", "0.5", etc.
  s = s.trim();
  if (!s) return 0;
  if (/^\d+\s+\d+\/\d+$/.test(s)) {
    const [whole, frac] = s.split(/\s+/);
    const [a, b] = frac.split('/').map(Number);
    return Number(whole) + a / b;
  }
  if (/^\d+\/\d+$/.test(s)) {
    const [a, b] = s.split('/').map(Number);
    return a / b;
  }
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function parseMeasure(measure: string | undefined): { qty: number; unit: Unit } {
  if (!measure) return { qty: 1, unit: 'stk' };
  const cleaned = measure.toLowerCase().trim();
  if (!cleaned) return { qty: 1, unit: 'stk' };

  // Match: leading number/fraction, then unit
  const m = cleaned.match(/^([\d.,\/\s]+)\s*([a-zæøå]*)/);
  if (m) {
    const qty = fractionToNumber(m[1]);
    const unitRaw = m[2].trim();
    const unit = UNIT_ALIASES[unitRaw] ?? (qty > 0 ? 'stk' : 'klype');
    if (qty > 0) {
      // Cup conversion: 1 cup ≈ 2.4 dl
      if (unitRaw === 'cup' || unitRaw === 'cups') {
        return { qty: Math.round(qty * 2.4 * 10) / 10, unit: 'dl' };
      }
      return { qty, unit };
    }
  }

  return { qty: 1, unit: 'stk' };
}

/* ------------------------------------------------------------------ */
/* Unit compatibility & display                                        */
/* ------------------------------------------------------------------ */

const WEIGHT_TO_G: Partial<Record<Unit, number>> = { g: 1, kg: 1000 };
const VOLUME_TO_ML: Partial<Record<Unit, number>> = { ml: 1, dl: 100, l: 1000, ts: 5, ss: 15 };

export function unitFamily(u: Unit): 'weight' | 'volume' | 'count' | 'other' {
  if (u in WEIGHT_TO_G) return 'weight';
  if (u in VOLUME_TO_ML) return 'volume';
  if (u === 'stk' || u === 'pakke' || u === 'boks') return 'count';
  return 'other';
}

/** Convert qty in given unit into a canonical small unit for aggregation. */
export function toBaseUnit(qty: number, unit: Unit): { qty: number; baseUnit: Unit } {
  if (unit in WEIGHT_TO_G) return { qty: qty * (WEIGHT_TO_G[unit] ?? 1), baseUnit: 'g' };
  if (unit in VOLUME_TO_ML) return { qty: qty * (VOLUME_TO_ML[unit] ?? 1), baseUnit: 'ml' };
  return { qty, baseUnit: unit };
}

export function fromBaseUnit(qty: number, baseUnit: Unit): { qty: number; unit: Unit } {
  if (baseUnit === 'g') {
    if (qty >= 1000) return { qty: Math.round((qty / 1000) * 10) / 10, unit: 'kg' };
    return { qty: Math.round(qty), unit: 'g' };
  }
  if (baseUnit === 'ml') {
    if (qty >= 1000) return { qty: Math.round((qty / 1000) * 10) / 10, unit: 'l' };
    if (qty >= 100) return { qty: Math.round((qty / 100) * 10) / 10, unit: 'dl' };
    return { qty: Math.round(qty), unit: 'ml' };
  }
  return { qty: Math.round(qty * 10) / 10, unit: baseUnit };
}

export function formatQty(qty: number, unit: Unit): string {
  const q = Math.round(qty * 100) / 100;
  const num = q % 1 === 0 ? String(q) : q.toFixed(q < 1 ? 2 : 1).replace(/\.?0+$/, '');
  if (unit === 'stk') return `${num} stk`;
  if (unit === 'klype') return `${num} klype`;
  if (unit === 'pakke') return `${num} pakke`;
  if (unit === 'boks') return `${num} boks`;
  return `${num} ${unit}`;
}
