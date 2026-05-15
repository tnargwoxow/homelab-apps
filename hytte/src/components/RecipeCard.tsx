import type { Recipe } from '../types';
import { ClockIcon, FishIcon, LeafIcon, PineIcon, PotIcon } from './icons';

type Props = {
  recipe: Recipe;
  onClick?: () => void;
  matchPct?: number; // 0–1, optional, shown as chip
  compact?: boolean;
  cta?: string;
};

function cuisineGlyph(cuisine: string) {
  if (cuisine === 'Norwegian') return <PineIcon className="h-4 w-4 text-hytte-pine" />;
  if (/fish|seafood/i.test(cuisine)) return <FishIcon className="h-4 w-4 text-hytte-pine" />;
  if (/vegan|vegetarian/i.test(cuisine)) return <LeafIcon className="h-4 w-4 text-hytte-pine" />;
  return <PotIcon className="h-4 w-4 text-hytte-pine" />;
}

export function RecipeCard({ recipe, onClick, matchPct, compact, cta }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card group block w-full overflow-hidden text-left transition hover:-translate-y-0.5 hover:shadow-emberGlow"
    >
      <div className="relative aspect-[16/10] bg-hytte-parchment">
        {recipe.image ? (
          <img
            src={recipe.image}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-hytte-coal/40 via-transparent to-transparent" />
        {matchPct !== undefined && matchPct > 0 ? (
          <span className="absolute left-2 top-2 chip bg-hytte-snow/95 text-hytte-pineDark">
            <LeafIcon className="h-3 w-3" />
            {Math.round(matchPct * 100)}% i kjøleskapet
          </span>
        ) : null}
        <span className="absolute right-2 top-2 chip bg-hytte-snow/95">
          {cuisineGlyph(recipe.cuisine)}
          <span>{recipe.cuisine}</span>
        </span>
      </div>

      <div className={`flex flex-col gap-1 px-4 ${compact ? 'py-3' : 'py-4'}`}>
        <h3 className="heading text-xl leading-tight">{recipe.title}</h3>
        {!compact && recipe.description ? (
          <p className="text-sm text-hytte-ash line-clamp-2">{recipe.description}</p>
        ) : null}
        <div className="mt-1 flex items-center justify-between text-xs text-hytte-ash">
          <span className="inline-flex items-center gap-1">
            <ClockIcon className="h-3.5 w-3.5" />
            {recipe.prepMinutes + recipe.cookMinutes} min
          </span>
          <span>{recipe.servings} pers.</span>
        </div>
        {cta ? (
          <span className="mt-2 inline-flex items-center justify-center rounded-md bg-hytte-pine/10 px-2 py-1 text-xs font-medium text-hytte-pineDark group-hover:bg-hytte-pine/20">
            {cta}
          </span>
        ) : null}
      </div>
    </button>
  );
}
