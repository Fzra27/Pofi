const crypto = require("node:crypto");
const COOKIE = "pofi_pairing";
function matches(value, expected) {
  const a = Buffer.from(typeof value === "string" ? value : ""),
    b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function authenticatePhone(req, res, expected, { internet = false } = {}) {
  const header =
    typeof req.headers["x-pofi-token"] === "string"
      ? req.headers["x-pofi-token"]
      : "";
  let cookie = "";
  try {
    cookie =
      (req.headers.cookie || "")
        .split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith(COOKIE + "="))
        ?.slice(COOKIE.length + 1) || "";
  } catch {}
  if (!matches(header || cookie, expected)) return false;
  const phone =
    internet ||
    req.headers["x-pofi-device"] === "phone" ||
    (!header && matches(cookie, expected));
  if (phone) {
    res.setHeader("X-Pofi-Pairing", "phone");
    res.setHeader("X-Pofi-Network", internet ? "internet" : "local");
    if (!matches(cookie, expected)) {
      const secure =
        req.socket.encrypted ||
        String(req.headers["x-forwarded-proto"] || "")
          .split(",")[0]
          .trim() === "https";
      res.setHeader(
        "Set-Cookie",
        `${COOKIE}=${expected}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`,
      );
    }
  }
  return true;
}
module.exports = { authenticatePhone };
