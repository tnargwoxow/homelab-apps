export type IngredientCategory =
  | 'produce'
  | 'meat'
  | 'fish'
  | 'dairy'
  | 'pantry'
  | 'frozen'
  | 'bakery'
  | 'other';

export type Unit =
  | 'g'
  | 'kg'
  | 'ml'
  | 'dl'
  | 'l'
  | 'stk'
  | 'ts'
  | 'ss'
  | 'klype'
  | 'pakke'
  | 'boks';

export type Ingredient = {
  name: string; // canonical lowercase, e.g. "potet"
  display: string; // user-facing, e.g. "Poteter"
  qty: number;
  unit: Unit;
  category: IngredientCategory;
};

export type RecipeSource = 'curated' | 'themealdb';

export type Recipe = {
  id: string;
  title: string;
  source: RecipeSource;
  sourceUrl?: string;
  image?: string;
  cuisine: string;
  tags: string[];
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  ingredients: Ingredient[];
  instructions: string[];
  description?: string;
};

export type Weekday = 'man' | 'tir' | 'ons' | 'tor' | 'fre' | 'lor' | 'son';

export const WEEKDAYS: Weekday[] = ['man', 'tir', 'ons', 'tor', 'fre', 'lor', 'son'];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  man: 'Mandag',
  tir: 'Tirsdag',
  ons: 'Onsdag',
  tor: 'Torsdag',
  fre: 'Fredag',
  lor: 'Lørdag',
  son: 'Søndag',
};

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  man: 'Man',
  tir: 'Tir',
  ons: 'Ons',
  tor: 'Tor',
  fre: 'Fre',
  lor: 'Lør',
  son: 'Søn',
};

export type WeekPlan = {
  weekStartISO: string; // ISO date of Monday
  days: Record<Weekday, string | null>;
};

export type FridgeItem = {
  name: string; // canonical
  display: string;
  category: IngredientCategory;
};

export type GroceryRow = {
  key: string; // `${name}|${unit}`
  display: string;
  qty: number;
  unit: Unit;
  category: IngredientCategory;
  fromRecipes: string[]; // recipe titles contributing
};

export type GroceryList = {
  weekStartISO: string;
  rows: GroceryRow[];
};

export const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  produce: 'Frukt & grønt',
  meat: 'Kjøtt',
  fish: 'Fisk',
  dairy: 'Meieri',
  pantry: 'Tørrvarer',
  frozen: 'Frysevarer',
  bakery: 'Bakeri',
  other: 'Annet',
};

export const CATEGORY_ORDER: IngredientCategory[] = [
  'produce',
  'meat',
  'fish',
  'dairy',
  'bakery',
  'pantry',
  'frozen',
  'other',
];
