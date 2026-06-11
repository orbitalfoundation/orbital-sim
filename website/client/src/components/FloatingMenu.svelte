<script>
  import { auth }   from '../lib/auth.svelte.js';
  import { router } from '../lib/router.svelte.js';

  let open = $state(false);

  function toggle() { open = !open; }
  function close()  { open = false; }

  function goHome() { router.navigate('/'); close(); }
</script>

<!-- Top-right floating control -->
<div class="fixed top-4 right-4 z-50 flex flex-col items-end gap-2">

  <div class="flex items-center gap-2">

    <!-- Draft status — the whole site is an early draft for now -->
    <span
      class="mono text-[10px] tracking-wider uppercase text-[var(--muted)]
             border border-[var(--border)] rounded px-2 py-1 select-none"
      title="This site and its contents are an early work in progress"
    >
      very draft
    </span>

    <!-- GitHub -->
    <a
      href="https://github.com/orbitalfoundation"
      target="_blank"
      rel="noopener"
      aria-label="Source on GitHub"
      class="w-9 h-9 rounded-full flex items-center justify-center
             border border-[var(--border)] bg-[var(--surface)]
             text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent)]
             transition-colors shadow-sm"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
      </svg>
    </a>

    <!-- Circle button (menu / auth) -->
    <button
      onclick={toggle}
      aria-label="Menu"
      class="w-9 h-9 rounded-full flex items-center justify-center
             border border-[var(--border)] bg-[var(--surface)]
             text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent)]
             transition-colors shadow-sm"
    >
      {#if auth.loggedIn && auth.user?.profileImage}
        <img src={auth.user.profileImage} alt="" class="w-full h-full rounded-full object-cover" />
      {:else}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="8" cy="8" r="4.5"/>
          <ellipse cx="8" cy="8" rx="7" ry="2.5"/>
        </svg>
      {/if}
    </button>

  </div>

  <!-- Dropdown menu -->
  {#if open}
    <div
      class="min-w-44 rounded border border-[var(--border)] bg-[var(--surface)] shadow-lg py-1 text-sm"
      role="menu"
    >
      <button onclick={goHome}
        class="w-full text-left px-4 py-2 hover:bg-[var(--border)] text-[var(--text)] mono">
        / home
      </button>

      <div class="border-t border-[var(--border)] my-1"></div>

      {#if auth.loggedIn}
        <div class="px-4 py-1 text-[var(--muted)] mono text-xs truncate">
          {auth.user?.email ?? auth.user?.name}
        </div>
        <button onclick={() => { auth.logout(); close(); }}
          class="w-full text-left px-4 py-2 hover:bg-[var(--border)] text-[var(--text)]">
          Sign out
        </button>
      {:else}
        <button onclick={() => { auth.login(); close(); }}
          class="w-full text-left px-4 py-2 hover:bg-[var(--border)] text-[var(--accent)]"
          disabled={auth.loading}>
          {auth.loading ? 'Signing in…' : 'Sign in'}
        </button>
      {/if}
    </div>
    <!-- Click-outside dismissal -->
    <div class="fixed inset-0 -z-10" onclick={close} aria-hidden="true"></div>
  {/if}

</div>
