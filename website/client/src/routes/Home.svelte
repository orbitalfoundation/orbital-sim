<script>
  import { router } from '../lib/router.svelte.js';
  import Globe from '../lib/Globe.svelte';

  let feed  = $state([]);
  let error = $state(null);

  $effect(() => {
    fetch('/api/home')
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(d => { feed = d.feed ?? []; })
      .catch(e => { error = String(e); });
  });

  function navigate(item) {
    if (item.external && item.url) { window.open(item.url, '_blank', 'noopener'); return; }
    if (item.ref) router.navigate(item.ref);
  }

  function typeLabel(type) {
    return type === 'scenario'   ? 'scenario'
         : type === 'agent'      ? 'agent'
         : type === 'collection' ? 'collection'
         : type === 'post'       ? 'post'
         : 'other';
  }

  function formatDate(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
</script>

<div aria-hidden="true" class="fixed -z-10 right-0 top-1/2 -translate-y-1/2 translate-x-1/2
     w-[min(80vw,80vh)] aspect-square rounded-full overflow-hidden pointer-events-none
     opacity-[0.55] select-none">
  <Globe />
</div>

<main class="relative px-6 sm:px-12 py-12 max-w-3xl">

  <div class="mono text-xs tracking-[0.2em] text-[var(--muted)] uppercase mb-10">
    Orbital
  </div>

  <div class="flex flex-col gap-4 mb-12">
    <h1 class="text-3xl sm:text-4xl font-light tracking-tight leading-snug text-[var(--text)]">
      Simulation<br/>as argument.
    </h1>
    <p class="text-[var(--muted)] max-w-md leading-relaxed">
      Run mechanistic models against real geodata.
      Publish the results as interactive documents.
      Replace speculation with evidence.
    </p>
  </div>

  <section>
    <h2 class="mono text-xs tracking-[0.15em] text-[var(--muted)] uppercase mb-4 px-4">
      Recent activity
    </h2>

    {#if error}
      <p class="text-[var(--muted)] mono text-xs px-4">{error}</p>
    {:else}
      <div class="flex flex-col gap-2">
        {#each feed as item}
          <button
            onclick={() => navigate(item)}
            class="group bg-[var(--bg)]/50 hover:bg-[var(--surface)]/60 text-left px-4 py-4 transition-colors w-full"
          >
            <div class="flex items-baseline gap-3 mb-1 flex-wrap">
              <span class="font-medium text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
                {item.title ?? item.ref ?? item.url ?? 'Untitled'}
              </span>
              {#if item.author}
                <span class="mono text-xs text-[var(--muted)]">{item.author}/</span>
              {/if}
              <span class="mono text-[10px] text-[var(--muted)] border border-[var(--border)] px-1.5 py-0.5 ml-auto">
                {typeLabel(item.type)}
              </span>
            </div>

            {#if item.description}
              <p class="text-sm text-[var(--muted)] leading-relaxed">{item.description}</p>
            {/if}

            <div class="flex items-center gap-2 mt-2 flex-wrap">
              {#each (item.tags ?? []) as tag}
                <span class="mono text-[10px] tracking-wide text-[var(--muted)] bg-[var(--surface)] px-2 py-0.5">
                  {tag}
                </span>
              {/each}
              {#if item.location?.label}
                <span class="mono text-[10px] text-[var(--muted)] opacity-60">{item.location.label}</span>
              {/if}
              {#if item.date}
                <span class="mono text-[10px] text-[var(--muted)] opacity-50 ml-auto">{formatDate(item.date)}</span>
              {/if}
              {#if item.external}
                <span class="mono text-[10px] text-[var(--accent)] opacity-70">↗</span>
              {/if}
            </div>
          </button>
        {/each}
      </div>
    {/if}
  </section>

  <footer class="mt-16 mono text-[10px] text-[var(--muted)] opacity-40">
    build {__BUILD_DATE__}
  </footer>

</main>
