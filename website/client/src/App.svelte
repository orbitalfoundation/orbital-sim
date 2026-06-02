<script>
  import { router } from './lib/router.svelte.js';
  import { auth }   from './lib/auth.svelte.js';
  import Home    from './routes/Home.svelte';
  import Area    from './routes/Area.svelte';
  import Project from './routes/Project.svelte';
  import FloatingMenu from './components/FloatingMenu.svelte';

  auth.restore();
  // If this page load is the return leg of an OAuth redirect, complete the login.
  auth.checkRedirect();

  const route = $derived(router.parts);
</script>

<FloatingMenu />

{#if !route.area}
  <Home />
{:else if !route.project}
  <Area name={route.area} />
{:else}
  <Project area={route.area} project={route.project} />
{/if}
