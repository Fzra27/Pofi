const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { Updater, newer } = require("../desktop/updater.cjs");
test("version ordering rejects downgrades, same versions and malformed metadata", () => {
  assert(newer("1.10.0", "1.2.0"));
  assert(!newer("1.1.0", "1.1.0"));
  assert(!newer("1.0.0", "1.1.0"));
  assert.throws(() => newer("latest", "1.0.0"));
});
test("update checks fixed GitHub source, runs locked install/tests/build, then requests privileged install", async () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "pofi-update-"));
  const calls = [];
  let cwd;
  const runner = async (file, args, options = {}) => {
    calls.push([file, args]);
    if (file === "git") {
      cwd = args.at(-1);
      fs.writeFileSync(
        path.join(cwd, "package.json"),
        JSON.stringify({ name: "pofi", version: "1.2.0" }),
      );
    }
    if (args.join(" ") === "run build:linux") {
      fs.mkdirSync(path.join(cwd, "dist"));
      fs.writeFileSync(
        path.join(cwd, "dist", "pofi_1.2.0_amd64.deb"),
        "test fixture",
      );
    }
    return "";
  };
  const updater = new Updater({
    workDir,
    currentVersion: "1.1.0",
    runner,
    environment: async () => ({ npm: "/test/npm", env: {} }),
  });
  try {
    assert.equal((await updater.check()).available, true);
    assert.equal((await updater.install()).installed, true);
    assert.equal(calls[0][1].at(-2), "https://github.com/Fzra27/Pofi.git");
    assert.deepEqual(
      calls.slice(1).map((c) => c[1].slice(0, 2)),
      [
        ["ci"],
        ["test"],
        ["run", "build:linux"],
        ["/usr/bin/dpkg", "--install"],
      ],
    );
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});
test("failed tests prevent both building and privileged installation; failed checks cannot install", async () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "pofi-update-"));
  const calls = [];
  const runner = async (file, args) => {
    calls.push(file + ":" + args[0]);
    if (file === "git")
      fs.writeFileSync(
        path.join(args.at(-1), "package.json"),
        JSON.stringify({ name: "pofi", version: "1.2.0" }),
      );
    if (args[0] === "test") throw new Error("Tests failed");
    return "";
  };
  const updater = new Updater({
    workDir,
    currentVersion: "1.1.0",
    runner,
    environment: async () => ({ npm: "npm", env: {} }),
  });
  try {
    await assert.rejects(() => updater.install(), /Check for updates/);
    await updater.check();
    await assert.rejects(() => updater.install(), /Tests failed/);
    assert(!calls.some((c) => c.startsWith("pkexec")));
    assert(!calls.includes("npm:run"));
    assert.equal(updater.busy, false);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});
