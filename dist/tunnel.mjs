// ═══════════════════════════════════════════════════════════════════
// tunnel.mjs — إنشاء رابط عام تلقائياً للاستضافات التي لا توفر رابطاً
// سلسلة احتياطية: Cloudflare Tunnel (الأفضل) ← localtunnel (احتياطي)
// بدون حساب، بدون إعداد، بدون أي تدخل من المستخدم
// ═══════════════════════════════════════════════════════════════════
import { existsSync, mkdirSync, chmodSync, createWriteStream, statSync, renameSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import net from "net";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN_DIR = join(__dirname, "..", "data", "bin");
const BIN_PATH = join(BIN_DIR, "cloudflared");

let _url = null;          // الرابط العام الجاهز
let _provider = null;     // "cloudflare" أو "localtunnel"
let _password = null;     // كلمة مرور localtunnel (عنوان IP العام) إن لزمت
let _starting = false;
let _cfProc = null;
let _ltSockets = [];
let _ltStopped = false;

export function tunnelUrl() { return _url; }
export function tunnelProvider() { return _provider; }
export function tunnelPassword() { return _password; }

function _setUrl(url, provider, log, onUrl) {
  _url = url;
  _provider = provider;
  globalThis.__FW_PUBLIC_URL = url;
  globalThis.__FW_TUNNEL_PROVIDER = provider;
  log(`[TUNNEL] الرابط العام جاهز (${provider}): ${url}`);
  try { onUrl && onUrl(url); } catch {}
}

// ─── المزود الأول: Cloudflare Tunnel ────────────────────────────────
function _archAsset() {
  const a = process.arch;
  if (a === "x64") return "cloudflared-linux-amd64";
  if (a === "arm64") return "cloudflared-linux-arm64";
  if (a === "arm") return "cloudflared-linux-arm";
  if (a === "ia32") return "cloudflared-linux-386";
  return "cloudflared-linux-amd64";
}

async function _downloadCf(log) {
  if (existsSync(BIN_PATH)) {
    try { if (statSync(BIN_PATH).size > 10_000_000) return true; } catch {}
  }
  mkdirSync(BIN_DIR, { recursive: true });
  const url = `https://github.com/cloudflare/cloudflared/releases/latest/download/${_archAsset()}`;
  log(`[TUNNEL] تحميل أداة النفق (مرة واحدة فقط)...`);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`download failed: ${res.status}`);
  const tmp = BIN_PATH + ".tmp";
  await new Promise((resolve, reject) => {
    const ws = createWriteStream(tmp);
    const reader = res.body.getReader();
    const pump = () =>
      reader.read().then(({ done, value }) => {
        if (done) { ws.end(resolve); return; }
        ws.write(Buffer.from(value), (e) => (e ? reject(e) : pump()));
      }).catch(reject);
    pump();
  });
  renameSync(tmp, BIN_PATH);
  chmodSync(BIN_PATH, 0o755);
  log(`[TUNNEL] تم التحميل بنجاح`);
  return true;
}

// يجرب Cloudflare — يرجع الرابط أو null إذا فشل خلال المهلة
function _tryCloudflare(port, log, timeoutMs = 30000) {
  return new Promise(async (resolve) => {
    try { await _downloadCf(log); } catch (e) { log(`[TUNNEL] تعذر تحميل cloudflared: ${e?.message}`); return resolve(null); }
    let resolved = false;
    let gotUrl = null;
    let edgeErrors = 0;
    _cfProc = spawn(BIN_PATH, [
      "tunnel", "--no-autoupdate", "--url", `http://127.0.0.1:${port}`,
    ], { stdio: ["ignore", "pipe", "pipe"] });

    const finish = (val) => { if (!resolved) { resolved = true; resolve(val); } };
    // المهلة تنهي المحاولة دائماً — حتى لو التُقط الرابط بدون تسجيل اتصال فعلي
    // (يحدث عندما تحجب الاستضافة منفذ 7844 الخاص بكلاودفلير)
    const timer = setTimeout(() => {
      try { _cfProc?.kill(); } catch {}
      finish(null);
    }, timeoutMs);

    const onData = (buf) => {
      const s = buf.toString();
      const m = s.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (m && !gotUrl) gotUrl = m[0];
      // إن تكررت أخطاء الاتصال بالحافة فالمنفذ 7844 محجوب — انتقل للاحتياطي
      if (/Unable to establish connection|TLS handshake with edge error|Serve tunnel error/.test(s)) {
        edgeErrors++;
        if (edgeErrors >= 6) { clearTimeout(timer); try { _cfProc?.kill(); } catch {} finish(null); }
      }
      // نجاح فعلي: تسجيل اتصال نفق
      if (gotUrl && /Registered tunnel connection/.test(s)) {
        clearTimeout(timer);
        finish(gotUrl);
      }
    };
    _cfProc.stdout.on("data", onData);
    _cfProc.stderr.on("data", onData);
    _cfProc.on("exit", () => { if (!resolved) { clearTimeout(timer); finish(null); } });
    _cfProc.on("error", () => { clearTimeout(timer); finish(null); });
  });
}

// ─── المزود الأول: tunnelmole (يعمل عبر WSS منفذ 443 — الأكثر توافقاً) ──
let _tmProc = null;
async function _tryTunnelmole(port, log) {
  // 1) كمكتبة مثبتة (الأسرع)
  try {
    const mod = await import("tunnelmole");
    const tm = mod.tunnelmole || mod.default;
    if (typeof tm === "function") {
      const url = await Promise.race([
        tm({ port }),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 45000)),
      ]);
      if (url) return String(url).replace(/^http:/, "https:");
    }
  } catch {}
  // 2) عبر npx (لا يتطلب تثبيتاً مسبقاً — فقط Node + npm)
  try {
    return await new Promise((resolve) => {
      const p = spawn("npx", ["-y", "tunnelmole", String(port)], {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, NODE_OPTIONS: "" },
      });
      let done = false;
      const finish = (v, keep) => {
        if (done) return;
        done = true;
        if (!keep) { try { p.kill(); } catch {} }
        resolve(v);
      };
      const timer = setTimeout(() => finish(null, false), 90000);
      const onData = (b) => {
        const m = b.toString().match(/https:\/\/[a-z0-9-]+(?:-ip-[0-9-]+)?\.tunnelmole\.net/);
        if (m) { clearTimeout(timer); _tmProc = p; finish(m[0], true); }
      };
      p.stdout.on("data", onData);
      p.stderr.on("data", onData);
      p.on("exit", () => { clearTimeout(timer); finish(null, false); });
      p.on("error", () => { clearTimeout(timer); finish(null, false); });
    });
  } catch (e) {
    log(`[TUNNEL] فشل tunnelmole: ${e?.message}`);
    return null;
  }
}

// ─── المزود الاحتياطي: localtunnel (بروتوكول مبني ببايثات Node فقط) ──
function _ltOpenConn(host, port, localPort) {
  if (_ltStopped) return;
  const remote = net.connect(port, host);
  _ltSockets.push(remote);
  remote.setKeepAlive(true, 30000);
  remote.on("connect", () => {
    const local = net.connect(localPort, "127.0.0.1");
    remote.pipe(local);
    local.pipe(remote);
    local.on("error", () => remote.destroy());
    remote.on("close", () => local.destroy());
  });
  remote.on("close", () => {
    _ltSockets = _ltSockets.filter((s) => s !== remote);
    if (!_ltStopped) setTimeout(() => _ltOpenConn(host, port, localPort), 1000);
  });
  remote.on("error", () => remote.destroy());
}

async function _tryLocaltunnel(port, log) {
  try {
    const res = await fetch("https://localtunnel.me/?new", { redirect: "follow" });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const info = await res.json();
    if (!info?.url || !info?.port) throw new Error("bad response");
    const maxConn = Math.max(1, Math.min(info.max_conn_count || 2, 4));
    _ltStopped = false;
    for (let i = 0; i < maxConn; i++) _ltOpenConn("localtunnel.me", info.port, port);
    // كلمة المرور = عنوان الـ IP العام للخادم (تُطلب مرة واحدة عند أول فتح)
    try {
      _password = (await (await fetch("https://ipv4.icanhazip.com")).text()).trim();
    } catch { _password = null; }
    return info.url;
  } catch (e) {
    log(`[TUNNEL] فشل localtunnel: ${e?.message}`);
    return null;
  }
}

// ─── نقطة الدخول ─────────────────────────────────────────────────────
export async function startTunnel(port, logger, onUrl) {
  const log = (m) => { try { logger ? logger.info(m) : console.log(m); } catch { console.log(m); } };
  if (_starting || _url) return _url;
  _starting = true;
  try {
    // إن وُجد رابط عام من البيئة فلا حاجة للنفق
    const { webappBaseUrl } = await import("./webapp-auth.mjs");
    const envUrl = webappBaseUrl();
    if (envUrl) {
      log(`[TUNNEL] رابط عام موجود من البيئة: ${envUrl} — لا حاجة للنفق`);
      return envUrl;
    }

    // 1) tunnelmole أولاً — يعمل عبر WSS على منفذ 443 (يمر من أي جدار حماية)
    //    بدون صفحة وسيطة وبدون كلمة مرور — مثالي لزر Telegram WebApp
    log(`[TUNNEL] محاولة إنشاء رابط عام عبر tunnelmole...`);
    const tmUrl = await _tryTunnelmole(port, log);
    if (tmUrl) {
      _setUrl(tmUrl, "tunnelmole", log, onUrl);
      _tmProc?.on("exit", () => {
        _url = null; globalThis.__FW_PUBLIC_URL = null; _starting = false;
        log("[TUNNEL] النفق أُغلق — إعادة تشغيل خلال 5 ثوانٍ...");
        setTimeout(() => startTunnel(port, logger, onUrl), 5000);
      });
      return tmUrl;
    }

    // 2) Cloudflare (بدون صفحة وسيطة — يتطلب منفذ 7844 صادراً)
    log(`[TUNNEL] tunnelmole غير متاح — محاولة Cloudflare...`);
    const cfUrl = await _tryCloudflare(port, log);
    if (cfUrl) {
      _setUrl(cfUrl, "cloudflare", log, onUrl);
      // مراقبة انهيار النفق وإعادة التشغيل
      _cfProc?.on("exit", () => {
        _url = null; globalThis.__FW_PUBLIC_URL = null; _starting = false;
        log("[TUNNEL] النفق أُغلق — إعادة تشغيل خلال 5 ثوانٍ...");
        setTimeout(() => startTunnel(port, logger, onUrl), 5000);
      });
      return cfUrl;
    }

    // 3) الاحتياطي الأخير: localtunnel
    log(`[TUNNEL] Cloudflare محجوب على هذه الاستضافة — التحويل إلى localtunnel...`);
    const ltUrl = await _tryLocaltunnel(port, log);
    if (ltUrl) {
      _setUrl(ltUrl, "localtunnel", log, onUrl);
      if (_password) log(`[TUNNEL] كلمة مرور الصفحة الأولى (تُدخل مرة واحدة): ${_password}`);
      return ltUrl;
    }

    log(`[TUNNEL] تعذر إنشاء رابط عام بأي طريقة — تحقق من اتصال الاستضافة بالإنترنت`);
    return null;
  } catch (e) {
    log(`[TUNNEL] فشل إنشاء النفق: ${e?.message || e}`);
    return null;
  } finally {
    _starting = false;
  }
}
