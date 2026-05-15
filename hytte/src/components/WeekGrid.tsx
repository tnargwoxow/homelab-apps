import type { Recipe, WeekPlan, Weekday } from '../types';
import { WEEKDAYS, WEEKDAY_LABELS, WEEKDAY_SHORT } from '../types';
import { ClockIcon, PlusIcon, ShuffleIcon, XIcon } from './icons';

type Props = {
  plan: WeekPlan;
  recipes: Recipe[];
  onSlotClick: (day: Weekday) => void;
  onReshuffleDay: (day: Weekday) => void;
  onClearDay: (day: Weekday) => void;
};

export function WeekGrid({ plan, recipes, onSlotClick, onReshuffleDay, onClearDay }: Props) {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
      {WEEKDAYS.map((d) => {
        const id = plan.days[d];
        const recipe = id ? byId.get(id) : null;
        return (
          <article
            key={d}
            className="card-wood relative flex flex-col overflow-hidden"
          >
            <header className="flex items-center justify-between border-b border-hytte-wood/15 bg-hytte-snow/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-hytte-wood">
              <span>{WEEKDAY_LABELS[d]}</span>
              <span className="text-hytte-ember/80 sm:hidden lg:inline">{WEEKDAY_SHORT[d]}</span>
            </header>
            {recipe ? (
              <button
                type="button"
                onClick={() => onSlotClick(d)}
                className="group relative aspect-[16/10] w-full overflow-hidden text-left"
                aria-label={`Bytt rett for ${WEEKDAY_LABELS[d]}`}
              >
                {recipe.image ? (
                  <img
                    src={recipe.image}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-hytte-coal/85 via-hytte-coal/35 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3 text-hytte-snow">
                  <p className="font-display text-lg italic leading-tight drop-shadow">
                    {recipe.title}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[0.7rem] text-hytte-cream/80">
                    <ClockIcon className="h-3 w-3" />
                    {recipe.prepMinutes + recipe.cookMinutes} min · {recipe.cuisine}
                  </p>
                </div>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSlotClick(d)}
                className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-1 bg-hytte-cream/40 text-hytte-ash transition hover:bg-hytte-pine/5 hover:text-hytte-pineDark"
              >
                <PlusIcon className="h-6 w-6" />
                <span className="text-sm">Legg til</span>
              </button>
            )}

            {recipe ? (
              <div className="flex items-center justify-end gap-1 border-t border-hytte-wood/15 bg-hytte-snow/40 px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => onReshuffleDay(d)}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-hytte-ash hover:bg-hytte-wood/10 hover:text-hytte-coal"
                  title="Foreslå en ny rett"
                >
                  <ShuffleIcon className="h-3.5 w-3.5" />
                  Bytt
                </button>
                <button
                  type="button"
                  onClick={() => onClearDay(d)}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-hytte-ash hover:bg-hytte-wood/10 hover:text-hytte-coal"
                  title="Fjern"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
