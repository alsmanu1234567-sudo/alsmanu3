// ═══════════════════════════════════════════════════════════════════
// webapp-auth.mjs — توثيق الويب آب: رمز دخول ثابت لكل مستخدم تيليجرام
// كل مستخدم يرى بياناته فقط عبر token خاص به
// ═══════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const TOKENS_FILE = join(DATA_DIR, "webapp-tokens.json");
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function loadTokens() {
  try { return JSON.parse(readFileSync(TOKENS_FILE, "utf8")); } catch { return {}; }
}
function saveTokens(t) {
  try { writeFileSync(TOKENS_FILE, JSON.stringify(t, null, 2), "utf8"); } catch {}
}

// رمز ثابت لكل مستخدم — يُنشأ مرة واحدة ويُعاد استخدامه
export function tokenForUser(uid) {
  uid = String(uid);
  const tokens = loadTokens();
  const found = Object.entries(tokens).find(([, u]) => u === uid);
  if (found) return found[0];
  const tok = randomBytes(24).toString("hex");
  tokens[tok] = uid;
  saveTokens(tokens);
  return tok;
}

export function userForToken(token) {
  if (!token) return null;
  const tokens = loadTokens();
  return tokens[String(token)] || null;
}

// اكتشاف رابط الاستضافة تلقائياً من متغيرات البيئة الشائعة — بدون أي إعداد خارجي
// وإن لم يوجد: يُستخدم رابط النفق التلقائي (tunnel.mjs) الذي ينشئه البوت بنفسه
export function webappBaseUrl() {
  const env = process.env;
  let url =
    env.WEBAPP_URL ||
    env.PUBLIC_URL ||
    env.RENDER_EXTERNAL_URL ||
    (env.RAILWAY_PUBLIC_DOMAIN ? `https://${env.RAILWAY_PUBLIC_DOMAIN}` : null) ||
    (env.RAILWAY_STATIC_URL ? `https://${env.RAILWAY_STATIC_URL}` : null) ||
    (env.KOYEB_PUBLIC_DOMAIN ? `https://${env.KOYEB_PUBLIC_DOMAIN}` : null) ||
    (env.FLY_APP_NAME ? `https://${env.FLY_APP_NAME}.fly.dev` : null) ||
    (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : null) ||
    (env.HEROKU_APP_NAME ? `https://${env.HEROKU_APP_NAME}.herokuapp.com` : null) ||
    globalThis.__FW_PUBLIC_URL || // رابط النفق التلقائي المنشأ من البوت
    null;
  if (url) {
    url = String(url).trim().replace(/\/+$/, "");
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  }
  return url;
}

export function webappUrlFor(uid) {
  const base = webappBaseUrl();
  if (!base) return null;
  return `${base}/webapp?token=${tokenForUser(uid)}`;
}

// رابط محلي (fallback عند غياب رابط عام) — يُعرض كنص للمستخدم
export function webappLocalUrlFor(uid, port) {
  const p = port || process.env.PORT || 3000;
  return `http://localhost:${p}/webapp?token=${tokenForUser(uid)}`;
}
