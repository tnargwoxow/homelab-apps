// Theme configurations. Each theme controls:
//  - app name + tagline + section labels (rendered text)
//  - mascot image URLs (with svelte fallback components when they fail)
//  - palette + display font (controlled in app.css via [data-theme="..."])

export type ThemeId = 'ballet' | 'heels' | 'hiphop';

export interface ThemeConfig {
  id: ThemeId;
  label: string;            // shown in selector
  emoji: string;            // shown in selector
  appName: string;
  tagline: string;
  welcomeTitle: string;
  welcomeBlurb: string;
  sections: {
    continueWatching: string;
    favorites: string;
    recent: string;
    browse: string;
    inSeries: string;
  };
  search: { placeholder: string; resultsTitle: string };
  favoritesIcon: '♥' | '★' | '🔥';
  // Two mascot URLs. The frontend Mascot component wraps these with an SVG
  // fallback if the image fails to load. mascotKind controls which fallback.
  mascotLeft:  { src: string; alt: string };
  mascotRight: { src: string; alt: string };
  mascotKind: 'pokemon' | 'heels' | 'hiphop';  // chooses fallback art
  emptyHint: string;        // copy on the "library is empty" placeholder
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  ballet: {
    id: 'ballet',
    label: "Mimi's Wonderland",
    emoji: '🩰',
    appName: "Mimi's Dance Wonderland",
    tagline: 'made with',
    welcomeTitle: "Welcome to Mimi's Dance Wonderland",
    welcomeBlurb: 'Pick up where you left off, find a favourite, or pirouette into something new.',
    sections: {
      continueWatching: 'Continue Watching',
      favorites: 'Your Favorites',
      recent: 'Recently Played',
      browse: 'Browse the Library',
      inSeries: 'In this series'
    },
    search: { placeholder: 'Search dances, lessons, instructors…', resultsTitle: 'Search ✨' },
    favoritesIcon: '♥',
    mascotLeft: {
      src: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/7.png',
      alt: 'Squirtle'
    },
    mascotRight: {
      src: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/151.png',
      alt: 'Mew'
    },
    mascotKind: 'pokemon',
    emptyHint: 'The wonderland is empty!'
  },
  heels: {
    id: 'heels',
    label: 'Heels Studio',
    emoji: '👠',
    appName: 'Heels Studio',
    tagline: 'choreographed by',
    welcomeTitle: 'Step Into the Spotlight',
    welcomeBlurb: 'Sultry, sleek, sky-high. Pick a track, light it up, own the floor.',
    sections: {
      continueWatching: 'Pick Up Where You Left Off',
      favorites: 'Saved Choreo',
      recent: 'Lately On Stage',
      browse: 'The Studio',
      inSeries: 'In this set'
    },
    search: { placeholder: 'Search heels routines, choreographers…', resultsTitle: 'Find a routine' },
    favoritesIcon: '🔥',
    // ----------------------------------------------------------------
    // SWAP THESE if you want different photos. They're just any image
    // URLs — drop a file into frontend/public/mascots/ and reference
    // it as e.g. '/mascots/heels-1.jpg' if you want fully local.
    // ----------------------------------------------------------------
    mascotLeft: {
      // Default: Wikimedia Commons via Special:FilePath. If the filename
      // doesn't exist, the SVG fallback (stiletto + flame) takes over.
      // Easiest reliable option: drop a JPG into frontend/public/mascots/
      // and use src: '/mascots/channing-1.jpg' instead.
      src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Channing_Tatum_by_Gage_Skidmore.jpg?width=400',
      alt: 'Channing Tatum'
    },
    mascotRight: {
      // Same as above. Local-file alternative: '/mascots/channing-2.jpg'
      src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Channing_Tatum_2012.jpg?width=400',
      alt: 'Channing Tatum'
    },
    mascotKind: 'heels',
    emptyHint: 'No routines yet — drop something in the library.'
  },
  hiphop: {
    id: 'hiphop',
    label: 'Flying Steps',
    emoji: '🅵',
    appName: 'Flying Steps Academy',
    tagline: 'breaks by',
    welcomeTitle: 'Welcome to the Academy',
    welcomeBlurb: 'B-boy, b-girl, freshness. Berlin-grown breaking from Flying Steps. Find your set and lock in.',
    sections: {
      continueWatching: 'Drop Back In',
      favorites: 'Saved Sets',
      recent: 'Last Cypher',
      browse: 'The Academy',
      inSeries: 'In this set'
    },
    search: { placeholder: 'Search sets, crews, moves…', resultsTitle: 'Search the cypher' },
    favoritesIcon: '★',
    mascotLeft: {
      // Default: Wikimedia Commons via Special:FilePath. If the filename
      // doesn't exist, the SVG fallback (red/black breakdancer badge) shows.
      // Local-file alternative: '/mascots/flying-steps-1.jpg'.
      src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Flying_Bach_-_Vartan.jpg?width=400',
      alt: 'Flying Steps'
    },
    mascotRight: {
      // Same as above. Local-file alternative: '/mascots/flying-steps-2.jpg'
      src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Flying_Steps_2014.jpg?width=400',
      alt: 'Flying Steps'
    },
    mascotKind: 'hiphop',
    emptyHint: 'No sets yet — drop something in the library.'
  }
};

export const THEME_ORDER: ThemeId[] = ['ballet', 'heels', 'hiphop'];
export const DEFAULT_THEME: ThemeId = 'ballet';
