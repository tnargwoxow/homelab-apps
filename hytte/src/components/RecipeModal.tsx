import { useEffect } from 'react';
import type { FridgeItem, Recipe, Weekday } from '../types';
import { WEEKDAYS, WEEKDAY_LABELS } from '../types';
import { formatQty } from '../lib/ingredients';
import { fridgeMatchCount } from '../lib/planner';
import { CheckIcon, ClockIcon, LeafIcon, XIcon } from './icons';

type Props = {
  recipe: Recipe;
  fridge: FridgeItem[];
  assignedDay?: Weekday | null;
  onAssign: (day: Weekday) => void;
  onClear?: () => void;
  onClose: () => void;
};

export function RecipeModal({ recipe, fridge, assignedDay, onAssign, onClear, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const have = new Set(fridge.map((f) => f.name));
  const match = fridgeMatchCount(recipe, fridge);
  const total = recipe.ingredients.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-hytte-coal/60 p-2 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <div
        className="card max-h-[90vh] w-full max-w-3xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          {recipe.image ? (
            <div className="aspect-[21/9] bg-hytte-parchment">
              <img
                src={recipe.image}
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-hytte-snow/95 text-hytte-coal shadow-hytteSm hover:bg-hytte-cream"
            aria-label="Lukk"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="heading text-3xl leading-tight">{recipe.title}</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="chip">{recipe.cuisine}</span>
                <span className="chip">
                  <ClockIcon className="h-3 w-3" />
                  {recipe.prepMinutes + recipe.cookMinutes} min
                </span>
                <span className="chip">{recipe.servings} pers.</span>
                {match > 0 ? (
                  <span className="chip bg-hytte-pine/10 text-hytte-pineDark">
                    <LeafIcon className="h-3 w-3" />
                    {match}/{total} i kjøleskapet
                  </span>
                ) : null}
                {recipe.tags.slice(0, 3).map((t) => (
                  <span key={t} className="chip">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {recipe.description ? (
            <p className="mt-3 text-hytte-ash">{recipe.description}</p>
          ) : null}

          <div className="my-5 divider" />

          <div className="grid gap-6 sm:grid-cols-[1fr_1.4fr]">
            <section>
              <h3 className="heading text-xl">Ingredienser</h3>
              <ul className="mt-2 space-y-1.5 text-sm">
                {recipe.ingredients.map((ing, i) => {
                  const inFridge = have.has(ing.name);
                  return (
                    <li
                      key={`${ing.name}-${i}`}
                      className={`flex items-baseline justify-between gap-2 rounded-md px-2 py-1 ${
                        inFridge ? 'bg-hytte-pine/5 text-hytte-pineDark' : ''
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {inFridge ? <CheckIcon className="h-3.5 w-3.5 text-hytte-pine" /> : null}
                        <span>{ing.display}</span>
                      </span>
                      <span className="font-mono text-xs text-hytte-ash">
                        {formatQty(ing.qty, ing.unit)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section>
              <h3 className="heading text-xl">Fremgangsmåte</h3>
              <ol className="mt-2 space-y-2 text-sm leading-relaxed">
                {recipe.instructions.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-hytte-ember/15 text-xs font-semibold text-hytte-ember">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              {recipe.sourceUrl ? (
                <p className="mt-4 text-xs text-hytte-ash">
                  Kilde:{' '}
                  <a
                    className="underline decoration-dotted hover:text-hytte-pine"
                    href={recipe.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {recipe.source === 'curated' ? 'Wikipedia / tradisjon' : 'TheMealDB'}
                  </a>
                </p>
              ) : null}
            </section>
          </div>

          <div className="my-5 divider" />

          <div>
            <h3 className="heading text-xl">Legg til i ukens meny</h3>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-7">
              {WEEKDAYS.map((d) => {
                const active = assignedDay === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onAssign(d)}
                    className={`rounded-lg border px-2 py-2 text-sm transition ${
                      active
                        ? 'border-hytte-pine bg-hytte-pine text-hytte-snow'
                        : 'border-hytte-wood/20 bg-hytte-snow text-hytte-coal hover:border-hytte-pine/50 hover:bg-hytte-pine/5'
                    }`}
                  >
                    {WEEKDAY_LABELS[d]}
                  </button>
                );
              })}
            </div>
            {assignedDay && onClear ? (
              <button type="button" className="mt-3 btn-ghost text-sm" onClick={onClear}>
                Fjern fra {WEEKDAY_LABELS[assignedDay].toLowerCase()}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
