<script>
  import { router } from '../lib/router.svelte.js';

  let { area, project } = $props();

  let readme  = $state(null);
  let hasPage = $state(false);

  $effect(() => {
    // Check for a README and whether a manifest exists
    fetch(`/api/areas/${area}/${project}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        readme  = d.readme  ?? null;
        hasPage = d.hasIndex ?? false;
      });
  });
</script>

<main class="px-6 sm:px-12 py-16 max-w-3xl">

  <nav class="mono text-xs text-[var(--muted)] mb-10">
    <button onclick={() => router.navigate('/')}     class="hover:text-[var(--accent)]">orbital</button>
    <span class="mx-1">/</span>
    <button onclick={() => router.navigate(`/${area}`)} class="hover:text-[var(--accent)]">{area}</button>
    <span class="mx-1">/</span>
    <span>{project}</span>
  </nav>

  <h1 class="text-xl font-light tracking-tight mb-2">
    {area}<span class="text-[var(--muted)]">/</span>{project}
  </h1>

  {#if hasPage}
    <p class="text-sm text-[var(--muted)] mb-6">
      This project has its own page.
      <a href="/{area}/{project}/" class="text-[var(--accent)]">Open it →</a>
    </p>
  {/if}

  {#if readme}
    <div class="prose text-sm text-[var(--muted)] leading-relaxed whitespace-pre-wrap mt-6 border-t border-[var(--border)] pt-6">
      {readme}
    </div>
  {:else}
    <p class="text-[var(--muted)] text-sm mt-6">No README found.</p>
  {/if}

</main>
