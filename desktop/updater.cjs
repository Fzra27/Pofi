const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const { spawn } = require("node:child_process");
const SOURCE = "https://github.com/Fzra27/Pofi.git";
function newer(next, current) {
  const parse = (v) => {
    if (!/^\d+\.\d+\.\d+$/.test(v))
      throw new Error("Unsupported update version.");
    return v.split(".").map(Number);
  };
  const a = parse(next),
    b = parse(current);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}
function run(file, args, { cwd, env = process.env, timeout = 600000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    let output = "";
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeout);
    const capture = (c) => {
      output = (output + c.toString()).slice(-5000);
    };
    child.stdout.on("data", capture);
    child.stderr.on("data", capture);
    child.on("error", (e) => {
      clearTimeout(timeoutId);
      reject(new Error(`Could not run ${file}: ${e.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timeoutId);
      if (code === 0) resolve(output.trim());
      else
        reject(
          new Error(
            timedOut
              ? "Update step timed out. Try again."
              : `${path.basename(file)} failed (${code}). ${output.slice(-1800)}`,
          ),
        );
    });
  });
}
async function nodeEnvironment() {
  let candidates = [];
  const nvm = path.join(os.homedir(), ".nvm/versions/node");
  try {
    candidates = fs
      .readdirSync(nvm)
      .filter((v) => /^v\d+\.\d+\.\d+$/.test(v))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
      .map((v) => path.join(nvm, v, "bin", "node"));
  } catch {}
  candidates.push(
    ...(process.env.PATH || "")
      .split(path.delimiter)
      .map((dir) => path.join(dir, "node")),
  );
  for (const candidate of candidates) {
    try {
      const version = await run(candidate, ["--version"], { timeout: 5000 });
      if (
        /^v(\d+)/.test(version) &&
        Number(version.match(/^v(\d+)/)[1]) >= 24
      ) {
        const bin = path.dirname(candidate),
          npm = path.join(bin, "npm");
        if (!fs.existsSync(npm)) continue;
        const env = {
          ...process.env,
          PATH: bin + path.delimiter + (process.env.PATH || ""),
        };
        delete env.ELECTRON_RUN_AS_NODE;
        return { npm, env };
      }
    } catch {}
  }
  throw new Error(
    "Node.js 24+ and npm are needed for source updates. Install them with nvm, then retry.",
  );
}
class Updater {
  constructor({
    workDir,
    currentVersion,
    onProgress = () => {},
    runner = run,
    environment = nodeEnvironment,
  }) {
    Object.assign(this, {
      workDir,
      currentVersion,
      onProgress,
      runner,
      environment,
    });
    this.busy = false;
    this.target = null;
  }
  async check() {
    if (this.busy) throw new Error("An update operation is already running.");
    this.busy = true;
    try {
      this.onProgress("Checking GitHub…");
      fs.mkdirSync(this.workDir, { recursive: true });
      if (this.target) {
        fs.rmSync(this.target.dir, { recursive: true, force: true });
        this.target = null;
      }
      const dir = fs.mkdtempSync(path.join(this.workDir, "source-"));
      try {
        await this.runner(
          "git",
          [
            "-c",
            "core.hooksPath=/dev/null",
            "clone",
            "--depth",
            "1",
            "--branch",
            "main",
            SOURCE,
            dir,
          ],
          { timeout: 120000 },
        );
        const metadata = JSON.parse(
          fs.readFileSync(path.join(dir, "package.json"), "utf8"),
        );
        if (metadata.name !== "pofi")
          throw new Error("Unexpected update package.");
        const available = newer(metadata.version, this.currentVersion);
        if (available) this.target = { dir, version: metadata.version };
        else fs.rmSync(dir, { recursive: true, force: true });
        const result = {
          available,
          currentVersion: this.currentVersion,
          version: metadata.version,
        };
        this.onProgress(
          available
            ? `Pofi ${metadata.version} is available.`
            : "Pofi is up to date.",
        );
        return result;
      } catch (e) {
        fs.rmSync(dir, { recursive: true, force: true });
        throw e;
      }
    } finally {
      this.busy = false;
    }
  }
  async install() {
    if (this.busy) throw new Error("An update operation is already running.");
    if (!this.target) throw new Error("Check for updates first.");
    this.busy = true;
    try {
      if (process.arch !== "x64" || process.platform !== "linux")
        throw new Error(
          "In-app package installation currently supports Ubuntu amd64.",
        );
      const { npm, env } = await this.environment();
      const cwd = this.target.dir;
      this.onProgress("Downloading verified dependencies…");
      await this.runner(npm, ["ci"], { cwd, env });
      this.onProgress("Running update tests…");
      await this.runner(npm, ["test"], { cwd, env });
      this.onProgress("Building your Ubuntu package…");
      await this.runner(npm, ["run", "build:linux"], { cwd, env });
      const file = path.join(
        cwd,
        "dist",
        `pofi_${this.target.version}_amd64.deb`,
      );
      if (!fs.statSync(file).isFile())
        throw new Error("Update package was not produced.");
      this.onProgress("Approve the Ubuntu password prompt to install…");
      await this.runner("pkexec", ["/usr/bin/dpkg", "--install", file], {
        cwd,
        env,
        timeout: 300000,
      });
      this.onProgress(
        "Update installed. Quit Pofi and reopen it from Applications.",
      );
      return { installed: true, version: this.target.version };
    } finally {
      this.busy = false;
    }
  }
}
module.exports = { Updater, newer, nodeEnvironment };
