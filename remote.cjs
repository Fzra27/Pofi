const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
function relayOrigin(value) {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error(
      "Enter only the server origin, such as https://pofi-relay.onrender.com",
    );
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["127.0.0.1", "localhost"].includes(url.hostname)
    )
  )
    throw new Error("Internet pairing requires HTTPS.");
  return url.origin;
}
class RemoteBridge {
  constructor({ timer, dataDir, fetcher = fetch }) {
    this.timer = timer;
    this.file = path.join(dataDir, "remote.json");
    this.fetcher = fetcher;
    this.instance = crypto.randomUUID();
    this.timer.state.sessionId = this.instance;
    this.generation = 0;
    this.closed = false;
    this.connected = false;
    this.error = "";
    this.config = null;
    this.phoneKey = null;
    this.results = new Map();
    try {
      const config = JSON.parse(fs.readFileSync(this.file, "utf8"));
      this.config = { origin: relayOrigin(config.origin), key: config.key };
    } catch {}
    this.loop();
  }
  status() {
    return {
      configured: !!this.config,
      origin: this.config?.origin || "",
      connected: this.connected,
      error: this.error,
    };
  }
  configure({ origin, key }) {
    origin = relayOrigin(origin);
    if (typeof key !== "string" || key.length < 32 || key.length > 512)
      throw new Error(
        "Paste the Render POFI_RELAY_KEY (at least 32 characters).",
      );
    fs.writeFileSync(this.file + ".tmp", JSON.stringify({ origin, key }), {
      mode: 0o600,
    });
    fs.renameSync(this.file + ".tmp", this.file);
    this.generation++;
    this.controller?.abort();
    this.config = { origin, key };
    this.connected = false;
    this.phoneKey = null;
    this.error = "Connecting…";
    this.results.clear();
    return this.status();
  }
  disable() {
    this.generation++;
    this.controller?.abort();
    this.config = null;
    this.connected = false;
    this.phoneKey = null;
    this.error = "";
    fs.rmSync(this.file, { force: true });
    return this.status();
  }
  pairing() {
    if (!this.config || !this.phoneKey) return null;
    return {
      link: `${this.config.origin}/#token=${this.phoneKey}&phone=1&remote=1`,
      remote: true,
      online: this.connected,
    };
  }
  async sync() {
    if (!this.config || this.closed) return;
    const generation = this.generation,
      config = this.config;
    this.controller = new AbortController();
    const controller = this.controller;
    const sentIds = [...this.results.keys()];
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await this.fetcher(config.origin + "/bridge/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Pofi-Host": config.key,
        },
        body: JSON.stringify({
          instance: this.instance,
          state: this.timer.snapshot(),
          results: [...this.results.values()],
        }),
        signal: this.controller.signal,
        redirect: "error",
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "Incorrect Render connection key."
            : `Server returned ${response.status}.`,
        );
      const data = await response.json();
      if (this.closed || generation !== this.generation) return;
      if (
        typeof data.phoneKey !== "string" ||
        !/^[a-f0-9]{64}$/.test(data.phoneKey)
      )
        throw new Error("This address is not a Pofi relay.");
      for (const id of sentIds) this.results.delete(id);
      this.phoneKey = data.phoneKey;
      this.connected = true;
      this.error = "";
      for (const command of data.commands || []) {
        if (
          !command ||
          typeof command.id !== "string" ||
          this.results.has(command.id)
        )
          continue;
        let result;
        try {
          result = {
            id: command.id,
            state: this.timer.command(command.action, command.value),
          };
        } catch (e) {
          result = { id: command.id, error: e.message };
        }
        this.results.set(command.id, result);
        while (this.results.size > 100)
          this.results.delete(this.results.keys().next().value);
      }
    } catch (e) {
      if (generation === this.generation && !this.closed) {
        this.connected = false;
        this.error =
          e.name === "AbortError"
            ? "Connection timed out. A sleeping free server may need a minute to wake."
            : e.message;
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  async loop() {
    await this.sync();
    if (!this.closed) {
      this.timeout = setTimeout(() => this.loop(), 1000);
      this.timeout.unref();
    }
  }
  close() {
    this.closed = true;
    clearTimeout(this.timeout);
    this.controller?.abort();
  }
}
module.exports = { RemoteBridge, relayOrigin };
