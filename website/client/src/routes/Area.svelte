<script>
  import { router } from '../lib/router.svelte.js';
  import { auth }   from '../lib/auth.svelte.js';

  let { name } = $props();

  let projects = $state([]);
  let loading  = $state(true);
  let error    = $state(null);

  $effect(() => {
    loading = true;
    error   = null;
    fetch(`/api/areas/${name}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(d => { projects = d.projects ?? []; loading = false; })
      .catch(e => { error = String(e); loading = false; });
  });

  const isOwner = $derived(auth.loggedIn && auth.area === name.toLowerCase());

  async function createProject() {
    const slug = prompt('Project name (letters, numbers, hyphens):')?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!slug) return;
    const res = await fetch(`/api/areas/${name}/${slug}`, {
      method: 'POST',
      headers: { ...auth.headers, 'Content-Type': 'application/json' },
    });
    if (res.ok) { projects = [...projects, { name: slug, hasIndex: false }]; }
    else alert(await res.text());
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

  {:else if projects.length === 0}
    <p class="text-[var(--muted)] text-sm">No projects yet.</p>

  {:else}
    <div class="flex flex-col gap-px bg-[var(--border)]">
      {#each projects as p}
        <button
          onclick={() => router.navigate(`/${name}/${p.name}`)}
          class="group bg-[var(--bg)] hover:bg-[var(--surface)] text-left px-4 py-3 transition-colors w-full"
        >
          <span class="mono text-sm text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
            {p.name}/
          </span>
          {#if p.hasIndex}
            <span class="ml-2 mono text-[10px] text-[var(--muted)] border border-[var(--border)] px-1.5 py-0.5">page</span>
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
