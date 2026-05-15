import { CabinIcon, ChevronIcon, SparkleIcon } from './icons';
import { formatWeekLabel } from '../lib/planner';

type Props = {
  weekStartISO: string;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  onSuggest: () => void;
  suggesting?: boolean;
};

export function Header({ weekStartISO, onPrevWeek, onNextWeek, onToday, onSuggest, suggesting }: Props) {
  return (
    <header className="relative overflow-hidden bg-hytte-woodDark text-hytte-cream">
      <div className="absolute inset-0 bg-grain opacity-25" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 h-3 bg-gradient-to-r from-hytte-ember/60 via-hytte-ember/30 to-transparent" />
      <div className="relative mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-7">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-hytte-ember/20 text-hytte-emberLight shadow-inner">
            <CabinIcon className="h-7 w-7" />
          </span>
          <div>
            <h1 className="font-display text-3xl italic leading-none">Hytte</h1>
            <p className="text-xs uppercase tracking-[0.25em] text-hytte-cream/70">Ukens meny fra hytta</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-full border border-hytte-cream/20 bg-hytte-cream/5 px-1 py-1 shadow-inner">
            <button
              type="button"
              onClick={onPrevWeek}
              className="rounded-full p-1.5 hover:bg-hytte-cream/15"
              aria-label="Forrige uke"
            >
              <ChevronIcon dir="left" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onToday}
              className="px-3 py-1 text-sm tracking-wide"
              title="Gå til denne uken"
            >
              {formatWeekLabel(weekStartISO)}
            </button>
            <button
              type="button"
              onClick={onNextWeek}
              className="rounded-full p-1.5 hover:bg-hytte-cream/15"
              aria-label="Neste uke"
            >
              <ChevronIcon dir="right" className="h-4 w-4" />
            </button>
          </div>

          <button type="button" className="btn-ember" onClick={onSuggest} disabled={suggesting}>
            <SparkleIcon className="h-4 w-4" />
            {suggesting ? 'Foreslår…' : 'Forslå ukens meny'}
          </button>
        </div>
      </div>
    </header>
  );
}
