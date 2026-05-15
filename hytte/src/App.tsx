import { useEffect, useMemo, useState } from 'react';
import type { FridgeItem, Recipe, WeekPlan, Weekday } from './types';
import { emptyPlan, formatWeekLabel, isoDate, startOfISOWeek, suggestWeek } from './lib/planner';
import { buildGroceryList } from './lib/grocery';
import { Header } from './components/Header';
import { WeekGrid } from './components/WeekGrid';
import { FridgePanel } from './components/FridgePanel';
import { GroceryList as GroceryListView } from './components/GroceryList';
import { RecipeBrowser } from './components/RecipeBrowser';
import { RecipeModal } from './components/RecipeModal';
import { usePersistentState } from './hooks/usePersistentState';
import { useRecipes } from './hooks/useRecipes';
import { CabinIcon, FireIcon, LeafIcon, ListIcon, PotIcon, SnowflakeIcon } from './components/icons';

type Tab = 'fridge' | 'grocery' | 'recipes';

export default function App() {
  const [weekStartISO, setWeekStartISO] = useState<string>(() => isoDate(startOfISOWeek(new Date())));
  const [plansByWeek, setPlansByWeek] = usePersistentState<Record<string, WeekPlan>>('plans', {});
  const [fridge, setFridge] = usePersistentState<FridgeItem[]>('fridge', []);
  const [checked, setChecked] = usePersistentState<Record<string, Record<string, boolean>>>('grocery-checked', {});
  const [tab, setTab] = useState<Tab>('grocery');
  const [openRecipeId, setOpenRecipeId] = useState<string | null>(null);
  const [dayToAssign, setDayToAssign] = useState<Weekday | null>(null);
  const [browserOpen, setBrowserOpen] = useState(false);

  const { recipes, loading: loadingRecipes, addRecipes } = useRecipes();

  // Ensure a plan exists for the current week
  useEffect(() => {
    if (!plansByWeek[weekStartISO]) {
      setPlansByWeek({ ...plansByWeek, [weekStartISO]: emptyPlan(weekStartISO) });
    }
  }, [weekStartISO, plansByWeek, setPlansByWeek]);

  const plan = plansByWeek[weekStartISO] ?? emptyPlan(weekStartISO);
  const weekChecked = checked[weekStartISO] ?? {};

  const groceryList = useMemo(
    () => buildGroceryList(plan, recipes, fridge),
    [plan, recipes, fridge],
  );

  const setPlan = (next: WeekPlan) => {
    setPlansByWeek({ ...plansByWeek, [weekStartISO]: next });
  };

  const shiftWeek = (days: number) => {
    const d = new Date(weekStartISO + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setWeekStartISO(isoDate(startOfISOWeek(d)));
  };

  const onSuggest = () => {
    const fresh = suggestWeek(recipes, fridge, weekStartISO);
    setPlan(fresh);
    setTab('grocery');
  };

  const onReshuffleDay = (day: Weekday) => {
    const keep = new Set<Weekday>(
      (Object.keys(plan.days) as Weekday[]).filter((d) => d !== day && plan.days[d]),
    );
    const next = suggestWeek(recipes, fridge, weekStartISO, plan, keep);
    setPlan(next);
  };

  const onClearDay = (day: Weekday) => {
    setPlan({ ...plan, days: { ...plan.days, [day]: null } });
  };

  const openBrowserForDay = (day: Weekday) => {
    setDayToAssign(day);
    setBrowserOpen(true);
  };

  const pickFromBrowser = (r: Recipe) => {
    setBrowserOpen(false);
    setOpenRecipeId(r.id);
  };

  const assignRecipeToDay = (recipeId: string, day: Weekday) => {
    setPlan({ ...plan, days: { ...plan.days, [day]: recipeId } });
    setOpenRecipeId(null);
    setDayToAssign(null);
  };

  const removeRecipeFromDay = (day: Weekday) => {
    setPlan({ ...plan, days: { ...plan.days, [day]: null } });
    setOpenRecipeId(null);
    setDayToAssign(null);
  };

  const toggleGrocery = (key: string) => {
    const next = { ...weekChecked, [key]: !weekChecked[key] };
    setChecked({ ...checked, [weekStartISO]: next });
  };

  const clearChecked = () => {
    setChecked({ ...checked, [weekStartISO]: {} });
  };

  const openRecipe = recipes.find((r) => r.id === openRecipeId) ?? null;
  const assignedDay = openRecipe
    ? ((Object.keys(plan.days) as Weekday[]).find((d) => plan.days[d] === openRecipe.id) ?? null)
    : null;

  return (
    <div className="min-h-screen">
      <Header
        weekStartISO={weekStartISO}
        onPrevWeek={() => shiftWeek(-7)}
        onNextWeek={() => shiftWeek(7)}
        onToday={() => setWeekStartISO(isoDate(startOfISOWeek(new Date())))}
        onSuggest={onSuggest}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          {/* Left: weekly plan */}
          <section className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="heading text-2xl">Ukens meny</h2>
                <p className="text-sm text-hytte-ash">{formatWeekLabel(weekStartISO)}</p>
              </div>
              {loadingRecipes ? (
                <span className="text-xs text-hytte-ash">laster oppskrifter…</span>
              ) : null}
            </div>

            <WeekGrid
              plan={plan}
              recipes={recipes}
              onSlotClick={(d) => {
                const id = plan.days[d];
                if (id) {
                  setDayToAssign(d);
                  setOpenRecipeId(id);
                } else {
                  openBrowserForDay(d);
                }
              }}
              onReshuffleDay={onReshuffleDay}
              onClearDay={onClearDay}
            />

            <div className="card bg-hytte-snow/70 px-4 py-3 text-xs text-hytte-ash">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="inline-flex items-center gap-1.5">
                  <CabinIcon className="h-4 w-4 text-hytte-pine" /> Norske klassikere
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <PotIcon className="h-4 w-4 text-hytte-pine" /> Internasjonal variasjon
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <LeafIcon className="h-4 w-4 text-hytte-pine" /> Bruker det i kjøleskapet
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <FireIcon className="h-4 w-4 text-hytte-ember" /> Komfortmat
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <SnowflakeIcon className="h-4 w-4 text-hytte-pine" /> Persisterer i nettleseren
                </span>
              </div>
            </div>
          </section>

          {/* Right: tabbed panel */}
          <aside className="space-y-3">
            <nav className="card flex overflow-hidden text-sm font-medium">
              {(
                [
                  { id: 'grocery' as Tab, label: 'Handleliste', icon: ListIcon },
                  { id: 'fridge' as Tab, label: 'Kjøleskap', icon: SnowflakeIcon },
                  { id: 'recipes' as Tab, label: 'Oppskrifter', icon: PotIcon },
                ]
              ).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2 transition ${
                    tab === id
                      ? 'bg-hytte-pine text-hytte-snow'
                      : 'text-hytte-coal hover:bg-hytte-cream'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </button>
              ))}
            </nav>

            <div className="card p-4 sm:p-5">
              {tab === 'fridge' ? <FridgePanel fridge={fridge} onChange={setFridge} /> : null}
              {tab === 'grocery' ? (
                <GroceryListView
                  list={groceryList}
                  checked={weekChecked}
                  onToggle={toggleGrocery}
                  onClearChecked={clearChecked}
                />
              ) : null}
              {tab === 'recipes' ? (
                <RecipeBrowser
                  recipes={recipes}
                  fridge={fridge}
                  onPick={(r) => setOpenRecipeId(r.id)}
                  onAddRecipes={addRecipes}
                />
              ) : null}
            </div>
          </aside>
        </div>

        <footer className="mt-10 border-t border-hytte-wood/15 pt-4 text-center text-xs text-hytte-ash">
          <p>
            Hytte · ukens meny fra hytta · Bilder fra Wikimedia Commons · Internasjonale oppskrifter fra TheMealDB.
          </p>
        </footer>
      </main>

      {/* Recipe browser modal (for picking a recipe to assign to a day) */}
      {browserOpen ? (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-hytte-coal/60 p-2 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={() => setBrowserOpen(false)}
        >
          <div
            className="card max-h-[90vh] w-full max-w-3xl overflow-y-auto p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <RecipeBrowser
              recipes={recipes}
              fridge={fridge}
              onPick={pickFromBrowser}
              onAddRecipes={addRecipes}
            />
          </div>
        </div>
      ) : null}

      {/* Recipe details modal */}
      {openRecipe ? (
        <RecipeModal
          recipe={openRecipe}
          fridge={fridge}
          assignedDay={assignedDay ?? dayToAssign}
          onAssign={(d) => assignRecipeToDay(openRecipe.id, d)}
          onClear={assignedDay ? () => removeRecipeFromDay(assignedDay) : undefined}
          onClose={() => {
            setOpenRecipeId(null);
            setDayToAssign(null);
          }}
        />
      ) : null}
    </div>
  );
}
