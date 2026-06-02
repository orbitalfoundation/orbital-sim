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

  <!-- Circle button -->
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
