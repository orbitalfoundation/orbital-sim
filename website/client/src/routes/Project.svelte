<script>
  import { router } from '../lib/router.svelte.js';

  let { area, project } = $props();

  let info    = $state(null);
  let readme  = $state(null);
  let hasPage = $state(false);

  $effect(() => {
    fetch(`/api/areas/${area}/${project}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        info    = d;
        readme  = d.readme  ?? null;
        hasPage = d.hasIndex ?? false;
      });
  });

  function formatDate(iso) {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
</script>

<main class="px-6 sm:px-12 py-16 max-w-3xl">

  <nav class="mono text-xs text-[var(--muted)] mb-10">
    <button onclick={() => router.navigate('/')}        class="hover:text-[var(--accent)]">orbital</button>
    <span class="mx-1">/</span>
    <button onclick={() => router.navigate(`/${area}`)} class="hover:text-[var(--accent)]">{area}</button>
    <span class="mx-1">/</span>
    <span>{project}</span>
  </nav>

  <div class="mb-6">
    <h1 class="text-xl font-light tracking-tight">
      {info?.title ?? project}
    </h1>
    {#if info?.type}
      <span class="mono text-[10px] text-[var(--muted)] border border-[var(--border)] px-1.5 py-0.5 mt-1 inline-block">
        {info.type}
      </span>
    {/if}
  </div>

  {#if info?.description}
    <p class="text-sm text-[var(--muted)] leading-relaxed mb-4">{info.description}</p>
  {/if}

  {#if info?.tags?.length || info?.location}
    <div class="flex items-center gap-2 flex-wrap mb-6">
      {#each (info.tags ?? []) as tag}
        <span class="mono text-[10px] tracking-wide text-[var(--muted)] bg-[var(--surface)] px-2 py-0.5">{tag}</span>
      {/each}
      {#if info?.location?.label}
        <span class="mono text-[10px] text-[var(--muted)] opacity-60">{info.location.label}</span>
      {/if}
    </div>
  {/if}

  {#if info?.author || info?.updated}
    <div class="mono text-[10px] text-[var(--muted)] opacity-50 mb-6 flex gap-4">
      {#if info.author}<span>{info.author}</span>{/if}
      {#if info.updated}<span>updated {formatDate(info.updated)}</span>{/if}
    </div>
  {/if}

  {#if hasPage}
    <p class="text-sm text-[var(--muted)] mb-6">
      <a href="/{area}/{project}/" class="text-[var(--accent)]">Open scenario page →</a>
    </p>
  {/if}

  {#if readme}
    <div class="prose text-sm text-[var(--muted)] leading-relaxed whitespace-pre-wrap border-t border-[var(--border)] pt-6">
      {readme}
    </div>
  {/if}

</main>
