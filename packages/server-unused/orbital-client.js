// orbital-client.js — browser helper for connecting to an @orbital/server instance.
//
// Depends on socket.io client, served automatically at /socket.io/socket.io.js.
//
// Usage:
//   <script src="/socket.io/socket.io.js"></script>
//   <script src="/orbital-client.js"></script>
//   <script>
//     const session = await OrbitalClient.start('public/my/manifest.js', { hz: 1, dt: 3600 });
//     session.on('tick', ({ tick, t, dt }) => render(t));
//     session.stop();
//   </script>

const OrbitalClient = (() => {
  // Lazy singleton socket — all sessions on a page share one connection.
  let _socket = null;
  function socket() {
    if (!_socket) _socket = io();
    return _socket;
  }

  class Session extends EventTarget {
    #id;
    #socket;

    constructor(id, sock) {
      super();
      this.#id = id;
      this.#socket = sock;
    }

    get id() { return this.#id; }

    on(event, handler) {
      this.addEventListener(event, (e) => handler(e.detail));
      return this;
    }

    _emit(event, detail) {
      this.dispatchEvent(new CustomEvent(event, { detail }));
    }

    async stop() {
      this.#socket.emit('unsubscribe', this.#id);
      await fetch(`/api/sim/${this.#id}`, { method: 'DELETE' });
    }
  }

  async function start(manifest, opts = {}) {
    const res = await fetch('/api/sim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manifest, ...opts }),
    });
    if (!res.ok) throw new Error(`Failed to start sim: ${res.statusText}`);
    const { id } = await res.json();

    const sock = socket();
    sock.emit('subscribe', id);

    const session = new Session(id, sock);
    sock.on('tick',    (data) => session._emit('tick',    data));
    sock.on('stopped', ()     => session._emit('stopped', {}));
    return session;
  }

  return { start };
})();

if (typeof window !== 'undefined') window.OrbitalClient = OrbitalClient;
