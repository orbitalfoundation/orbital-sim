<script>
  import { router } from '../lib/router.svelte.js';
  import Globe from '../lib/Globe.svelte';

  // Hand-curated featured scenarios — update as new ones are published.
  const featured = [
    {
      path: '/anselm/africa_middle_east_warming_2049',
      title: 'MENA Warming — 2049',
      author: 'anselm',
      tags: ['climate', 'energy balance'],
      desc: 'Accelerated surface temperature rise in the Middle East and North Africa. Desert regions warm at Arctic rates because no soil moisture buffers the CO₂ forcing.',
    },
    {
      path: '/anselm/tuvalu',
      title: 'Tuvalu Baseline',
      author: 'anselm',
      tags: ['ecosystem', 'sea level'],
      desc: 'Freshwater lens, coral reef, fishery, and population dynamics on a low-lying island under sustained sea-level pressure.',
    },
    {
      path: '/anselm/tenerife-futures',
      title: 'Tenerife Futures',
      author: 'anselm',
      tags: ['speculative', 'urban'],
      desc: 'Scenario sketches for land use, water, and tourism on a volcanic Atlantic island.',
    },
  ];
</script>

<!-- Half-globe: 3D rotating Earth, circular crop, right-half clipped off screen -->
<div aria-hidden="true" class="fixed -z-10 right-0 top-1/2 -translate-y-1/2 translate-x-1/2
     w-[min(80vw,80vh)] aspect-square rounded-full overflow-hidden pointer-events-none
     opacity-[0.38] select-none">
  <Globe />
</div>

<main class="relative px-6 sm:px-12 py-12 max-w-3xl">

  <!-- Wordmark -->
  <div class="mono text-xs tracking-[0.2em] text-[var(--muted)] uppercase mb-10">
    Orbital
  </div>

  <!-- Hero -->
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

  <!-- Featured scenarios -->
  <section>
    <h2 class="mono text-xs tracking-[0.15em] text-[var(--muted)] uppercase mb-4">
      Recent scenarios
    </h2>
    <div class="flex flex-col divide-y divide-[var(--border)]">
      {#each featured as s}
        <button
          onclick={() => router.navigate(s.path)}
          class="group bg-transparent hover:bg-[var(--surface)]/60 text-left px-4 py-4 transition-colors w-full"
        >
          <div class="flex items-baseline gap-3 mb-1">
            <span class="font-medium text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
              {s.title}
            </span>
            <span class="mono text-xs text-[var(--muted)]">{s.author}/</span>
          </div>
          <p class="text-sm text-[var(--muted)] leading-relaxed">{s.desc}</p>
          <div class="flex gap-2 mt-2">
            {#each s.tags as tag}
              <span class="mono text-[10px] tracking-wide text-[var(--muted)] border border-[var(--border)] px-2 py-0.5">
                {tag}
              </span>
            {/each}
          </div>
        </button>
      {/each}
    </div>
  </section>

  <footer class="mt-16 mono text-[10px] text-[var(--muted)] opacity-40">
    build {__BUILD_DATE__}
  </footer>

</main>
