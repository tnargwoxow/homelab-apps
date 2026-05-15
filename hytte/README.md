# Hytte — ukens meny fra hytta

A cozy, cabin-themed weekly meal planner and grocery list. Pick what's in your
fridge, get a 7-day plan that uses those ingredients, and a tidy shopping list
for what's missing — grouped by aisle.

- **Recipes**: 12 curated Norwegian classics bundled in + seeded variety from
  [TheMealDB](https://www.themealdb.com/)'s free public API.
- **Theme**: "hytte cozy" — warm dark wood, fireplace ambers, cream, hand-drawn
  SVG glyphs (cabin, pine, fire, pot, fish, snowflake).
- **Architecture**: frontend only. React + TypeScript + Vite + Tailwind. All
  state in `localStorage` under the `hytte:v1:*` key prefix. No backend, no
  accounts, deployable as static files anywhere.

## Develop

```sh
npm install
npm run dev    # http://localhost:5173
```

## Build

```sh
npm run build
npm run preview
```

The build output in `dist/` is plain static assets — drop it on Vercel,
Netlify, GitHub Pages, an S3 bucket, or a local file server.

## How it works

- **Suggest button** (`Forslå ukens meny`) — scores every recipe by fridge
  overlap minus shopping cost, penalises cuisine repetition within the week,
  biases mildly toward Norwegian, then greedily fills the 7 days with a touch
  of randomness so reruns aren't identical.
- **Fridge panel** — categorised checklist of common Norwegian pantry items,
  plus free-text additions. Selections persist.
- **Grocery list** — aggregates ingredients across the week, merges duplicates,
  converts units within a family (g/kg, ml/dl/l), and subtracts anything in
  the fridge. Rows can be checked off and the list copied or printed.
- **Recipes tab** — search and filter the library; "Søk online" pulls more
  recipes from TheMealDB on demand. English ingredients are normalised to a
  small Norwegian canonical vocabulary so fridge matching works across both
  sources.

## Project layout

```
src/
├── App.tsx                      # top-level state, layout
├── main.tsx                     # entry
├── styles/index.css             # Tailwind + hytte theme tokens
├── types.ts                     # Recipe, Ingredient, WeekPlan, …
├── data/norwegian-recipes.ts    # curated traditional dishes
├── lib/
│   ├── storage.ts               # localStorage wrapper
│   ├── ingredients.ts           # canonicalize, parse, unit conversion
│   ├── planner.ts               # weekly suggestion algorithm
│   ├── grocery.ts               # build/group grocery list
│   └── themealdb.ts             # free public-API client + normaliser
├── hooks/
│   ├── usePersistentState.ts
│   └── useRecipes.ts
└── components/
    ├── Header.tsx
    ├── WeekGrid.tsx
    ├── RecipeCard.tsx
    ├── RecipeModal.tsx
    ├── RecipeBrowser.tsx
    ├── FridgePanel.tsx
    ├── GroceryList.tsx
    └── icons.tsx
```

## Credits

- Norwegian recipe text written from scratch for this project, referencing
  Wikipedia for traditional dishes.
- International recipes via [TheMealDB](https://www.themealdb.com/api.php)
  (free public API, no key required).
- Photographs via Wikimedia Commons (CC-BY / public domain).
