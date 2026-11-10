const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { Updater, newer, installationPlan } = require("../desktop/updater.cjs");
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
    if (args.join(" ") === "run build:deb") {
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
    plan: () =>
      installationPlan({
        appImage: null,
        exists: (p) => p === "/usr/bin/dpkg",
      }),
    environment: async () => ({ npm: "/test/npm", env: {} }),
  });
  try {
    assert.equal((await updater.check()).available, true);
    assert.equal((await updater.install()).installed, true);
    assert.equal(calls[0][1].at(-2), "https://github.com/Fzra27/Pofi.git");
    assert.deepEqual(
      calls.slice(1).map((c) => c[1].slice(0, 2)),
      [["ci"], ["test"], ["run", "build:deb"], ["/usr/bin/dpkg", "--install"]],
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
    plan: () =>
      installationPlan({
        appImage: null,
        exists: (p) => p === "/usr/bin/dpkg",
      }),
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

test("update selection chooses Arch package or portable AppImage before considering Debian", () => {
  let plan = installationPlan({
    appImage: null,
    exists: (p) => ["/usr/bin/pacman", "/usr/bin/dpkg"].includes(p),
  });
  assert.equal(plan.kind, "arch");
  assert.equal(plan.script, "build:arch");
  assert.equal(plan.filename("1.4.0"), "pofi-1.4.0-x86_64.pkg.tar.zst");
  assert.deepEqual(plan.args("/tmp/pofi.pkg.tar.zst"), [
    "-U",
    "--noconfirm",
    "/tmp/pofi.pkg.tar.zst",
  ]);
  plan = installationPlan({
    appImage: "/home/user/Pofi.AppImage",
    exists: () => true,
  });
  assert.equal(plan.kind, "appimage");
  assert.equal(plan.filename("1.4.0"), "Pofi-1.4.0-x86_64.AppImage");
  assert.throws(() => installationPlan({ appImage: "relative.AppImage" }));
  assert.throws(
    () => installationPlan({ appImage: null, exists: () => false }),
    /AppImage edition/,
  );
});
test("Arch update hands a native package to pacman rather than dpkg", async () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "pofi-arch-update-"));
  const calls = [];
  let dir;
  const runner = async (file, args) => {
    calls.push([file, args]);
    if (file === "git") {
      dir = args.at(-1);
      fs.writeFileSync(
        path.join(dir, "package.json"),
        JSON.stringify({ name: "pofi", version: "1.4.0" }),
      );
    }
    if (args.join(" ") === "run build:arch") {
      fs.mkdirSync(path.join(dir, "dist"));
      fs.writeFileSync(
        path.join(dir, "dist", "pofi-1.4.0-x86_64.pkg.tar.zst"),
        "fixture",
      );
    }
    return "";
  };
  const u = new Updater({
    workDir,
    currentVersion: "1.3.1",
    runner,
    environment: async () => ({ npm: "npm", env: {} }),
    plan: () =>
      installationPlan({
        appImage: null,
        exists: (p) => p === "/usr/bin/pacman",
      }),
  });
  try {
    await u.check();
    assert((await u.install()).installed);
    assert(
      calls.some(
        ([f, a]) =>
          f === "pkexec" && a[0] === "/usr/bin/pacman" && a[1] === "-U",
      ),
    );
    assert(!calls.some(([f, a]) => a.includes("/usr/bin/dpkg")));
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});
test("AppImage update replaces only its own user-writable file and never runs a privileged installer", async () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "pofi-image-update-"));
  const image = path.join(workDir, "Pofi.AppImage");
  fs.writeFileSync(image, "old");
  let dir;
  let privileged = false;
  const runner = async (file, args) => {
    if (file === "pkexec") privileged = true;
    if (file === "git") {
      dir = args.at(-1);
      fs.writeFileSync(
        path.join(dir, "package.json"),
        JSON.stringify({ name: "pofi", version: "1.4.0" }),
      );
    }
    if (args.join(" ") === "run build:appimage") {
      fs.mkdirSync(path.join(dir, "dist"));
      fs.writeFileSync(
        path.join(dir, "dist", "Pofi-1.4.0-x86_64.AppImage"),
        "new image",
      );
    }
    return "";
  };
  const u = new Updater({
    workDir: path.join(workDir, "updates"),
    currentVersion: "1.3.1",
    runner,
    environment: async () => ({ npm: "npm", env: {} }),
    plan: () => installationPlan({ appImage: image }),
  });
  try {
    await u.check();
    assert((await u.install()).installed);
    assert.equal(fs.readFileSync(image, "utf8"), "new image");
    assert.equal(fs.statSync(image).mode & 0o777, 0o755);
    assert.equal(privileged, false);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});
