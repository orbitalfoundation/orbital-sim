<script>
  import { router } from '../lib/router.svelte.js';
  import { auth }   from '../lib/auth.svelte.js';

  let { name } = $props();

  let items   = $state([]);
  let loading = $state(true);
  let error   = $state(null);

  $effect(() => {
    loading = true;
    error   = null;
    fetch(`/api/areas/${name}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(d => { items = d.items ?? []; loading = false; })
      .catch(e => { error = String(e); loading = false; });
  });

  const isOwner = $derived(auth.loggedIn && auth.area === name.toLowerCase());

  async function createProject() {
    const slug = prompt('Project slug (letters, numbers, hyphens):')?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!slug) return;
    const type  = prompt('Type (scenario / agent / collection / post / other):', 'other')?.trim() || 'other';
    const title = prompt('Title:', slug)?.trim() || slug;
    const res = await fetch(`/api/areas/${name}/${slug}`, {
      method: 'POST',
      headers: { ...auth.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, title }),
    });
    if (res.ok) {
      const item = await res.json();
      items = [...items, { slug: item.slug, type: item.type, title: item.title, author: item.author, tags: [] }];
    } else {
      alert(await res.text());
    }
  }

  function typeLabel(type) {
    return type === 'scenario'   ? 'scenario'
         : type === 'agent'      ? 'agent'
         : type === 'collection' ? 'collection'
         : type === 'post'       ? 'post'
         : null;
  }
</script>

<main class="px-6 sm:px-12 py-16 max-w-3xl">

  <nav class="mono text-xs text-[var(--muted)] mb-10">
    <button onclick={() => router.navigate('/')} class="hover:text-[var(--accent)]">orbital</button>
    <span class="mx-1">/</span>
    <span>{name}</span>
  </nav>

  <h1 class="text-xl font-light tracking-tight mb-8">{name}<span class="text-[var(--muted)]">/</span></h1>

  {#if loading}
    <p class="text-[var(--muted)] mono text-sm">Loading…</p>

  {:else if error}
    <p class="text-red-400 mono text-sm">{error}</p>

  {:else if items.length === 0}
    <p class="text-[var(--muted)] text-sm">Nothing listed in info.json yet.</p>

  {:else}
    <div class="flex flex-col gap-2">
      {#each items as item}
        <button
          onclick={() => router.navigate(`/${name}/${item.slug}`)}
          class="group bg-[var(--bg)]/50 hover:bg-[var(--surface)]/60 text-left px-4 py-4 transition-colors w-full"
        >
          <div class="flex items-baseline gap-3 mb-1 flex-wrap">
            <span class="mono text-sm text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
              {item.title ?? item.slug}
            </span>
            {#if typeLabel(item.type)}
              <span class="mono text-[10px] text-[var(--muted)] border border-[var(--border)] px-1.5 py-0.5">
                {typeLabel(item.type)}
              </span>
            {/if}
          </div>
          {#if item.description}
            <p class="text-sm text-[var(--muted)] leading-relaxed">{item.description}</p>
          {/if}
          {#if item.tags?.length || item.location?.label}
            <div class="flex gap-2 mt-2 flex-wrap">
              {#each (item.tags ?? []) as tag}
                <span class="mono text-[10px] tracking-wide text-[var(--muted)] bg-[var(--surface)] px-2 py-0.5">{tag}</span>
              {/each}
              {#if item.location?.label}
                <span class="mono text-[10px] text-[var(--muted)] opacity-60">{item.location.label}</span>
              {/if}
            </div>
          {/if}
        </button>
      {/each}
    </div>
  {/if}

  {#if isOwner}
    <div class="mt-8">
      <button
        onclick={createProject}
        class="mono text-xs border border-[var(--accent)] text-[var(--accent)] px-4 py-2 hover:bg-[var(--accent)] hover:text-[var(--bg)] transition-colors"
      >
        + new project
      </button>
    </div>
  {/if}

</main>
