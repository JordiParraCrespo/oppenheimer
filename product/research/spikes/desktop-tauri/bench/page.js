// The bench, run inside the console's page by either shell (`run.mjs` hands
// it over): sign in through the console's own form, sit idle, then drive
// `window.oppenheimerDesktop` against the stub runner. Results go out as
// `BENCH {json}` lines: Tauri through its `bench_report` command, Electron
// through the page's console. The harness reads memory between phases.
(() => {
  if (window !== window.top || window.__oppenheimerBench) return;
  window.__oppenheimerBench = true;
  const ACCOUNT = __ACCOUNT__;
  const ECHO_SAMPLES = 300;
  const FLOOD_BYTES = __FLOOD_BYTES__;

  const report = (result) =>
    window.__TAURI_INTERNALS__
      ? window.__TAURI_INTERNALS__.invoke('bench_report', { result })
      : console.log(`BENCH ${JSON.stringify(result)}`);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function until(predicate, timeoutMs, what) {
    const end = performance.now() + timeoutMs;
    while (performance.now() < end) {
      const v = predicate();
      if (v) return v;
      await sleep(20);
    }
    throw new Error(`timed out waiting for ${what}`);
  }
  function setValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const pct = (xs, p) => {
    const s = [...xs].sort((a, b) => a - b);
    return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] * 100) / 100;
  };

  async function signIn() {
    if (location.pathname !== '/login') history.pushState(null, '', '/login');
    const email = await until(
      () => document.querySelector('input[autocomplete="email"]'),
      20000,
      'the login form',
    );
    const password = document.querySelector('input[autocomplete="current-password"]');
    const t0 = performance.now();
    setValue(email, ACCOUNT.email);
    setValue(password, ACCOUNT.password);
    email.form.requestSubmit();
    await until(() => location.pathname !== '/login', 20000, 'leaving /login');
    // The authenticated shell has drawn: something beyond the auth layout.
    await until(() => document.querySelectorAll('nav a, aside a').length > 0, 20000, 'the console');
    return Math.round(performance.now() - t0);
  }

  async function bridge() {
    const desktop = window.oppenheimerDesktop;
    if (!desktop) return { bridge: false };
    const has = await desktop.hasSession('bench');
    const tAttach = performance.now();
    const handle = await desktop.attach('bench', 0, 120, 40);
    const attachMs = Math.round((performance.now() - tAttach) * 100) / 100;
    let onChunk = () => {};
    desktop.onData(handle, (chunk) => {
      desktop.credit(handle, chunk.byteLength);
      onChunk(chunk);
    });

    // Echo: one key, its echo back, one at a time.
    // WebKit clamps performance.now() to 1 ms, so a single echo reads 0 or 1
    // there; the loop's total over ECHO_SAMPLES gives the mean either way.
    const echo = [];
    const tEcho = performance.now();
    for (let i = 0; i < ECHO_SAMPLES; i++) {
      const t = performance.now();
      await new Promise((resolve) => {
        onChunk = resolve;
        desktop.write(handle, 'x');
      });
      echo.push(performance.now() - t);
    }
    const echoMean = (performance.now() - tEcho) / ECHO_SAMPLES;

    // Flood: the stub prints FLOOD_BYTES; decode it as the terminal would.
    const decoder = new TextDecoder();
    let received = 0;
    let chunks = 0;
    const tFlood = performance.now();
    await new Promise((resolve) => {
      onChunk = (chunk) => {
        decoder.decode(chunk, { stream: true });
        received += chunk.byteLength;
        chunks++;
        if (received >= FLOOD_BYTES) resolve();
      };
      desktop.write(handle, '\x06');
    });
    const floodMs = performance.now() - tFlood;

    // Typing right after the flood.
    const after = [];
    for (let i = 0; i < 50; i++) {
      const t = performance.now();
      await new Promise((resolve) => {
        onChunk = resolve;
        desktop.write(handle, 'y');
      });
      after.push(performance.now() - t);
    }
    desktop.close(handle);
    return {
      bridge: true,
      hasSession: has,
      attachMs,
      echoMeanUs: Math.round(echoMean * 1000),
      echoP50: pct(echo, 50),
      echoP95: pct(echo, 95),
      floodMs: Math.round(floodMs),
      floodMBps: Math.round((received / 1024 / 1024 / (floodMs / 1000)) * 10) / 10,
      floodChunks: chunks,
      afterFloodEchoP50: pct(after, 50),
    };
  }

  async function run() {
    try {
      const signInMs = await signIn();
      await sleep(5000);
      report({ phase: 'idle', signInMs, path: location.pathname });
      await sleep(1500);
      report({ phase: 'bridge', ...(await bridge()) });
    } catch (e) {
      report({ phase: 'error', error: String(e?.stack ?? e) });
    }
  }
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
})();
