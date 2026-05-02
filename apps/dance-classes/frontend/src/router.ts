import Home from './routes/Home.svelte';
import Folder from './routes/Folder.svelte';
import Watch from './routes/Watch.svelte';
import Search from './routes/Search.svelte';
import Favorites from './routes/Favorites.svelte';
import Stats from './routes/Stats.svelte';

export const routes = {
  '/': Home,
  '/folder/:id': Folder,
  '/watch/:id': Watch,
  '/search': Search,
  '/favorites': Favorites,
  '/stats': Stats,
  '*': Home
};
