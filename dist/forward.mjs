// ═══════════════════════════════════════════════════════════════════
// forward.mjs — قسم التحويل الشامل (نسخة معزولة لكل مستخدم)
// [FIX-PER-USER] كل مستخدم يرى قنواته وقواعده ومجموعاته فقط
// تحويل الرسائل بين القنوات والمجموعات والأشخاص تلقائياً
// ═══════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

// [PIPELINE-FIX] كاش في الذاكرة — يقضي على readFileSync لكل رسالة
import {
  getRules      as _cacheGetRules,
  getChats      as _cacheGetChats,
  invalidate    as _cacheInvalidate,
  initRulesCache,
} from "../engine/rules-cache.mjs";

import { webappUrlFor } from "./webapp-auth.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const RULES_FILE = join(DATA_DIR, "forward-rules.json");
const CHATS_FILE = join(DATA_DIR, "forward-chats.json");

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

// تهيئة الكاش فوراً عند تحميل الوحدة
initRulesCache(RULES_FILE, CHATS_FILE);

// ─── مرجع البوت والسوكت ────────────────────────────────────────────
let _bot = null;
let _sock = null;
const DEV_ID = "7428421245";

// [FIX-PER-USER] سوكتات كل رقم واتساب مربوط: phone → { sock, ownerUid }
const _socksByNumber = new Map();

export function initForward(bot) { _bot = bot; }
export function setForwardSock(sock) { _sock = sock; }

// يُستدعى من index.mjs عند كل اتصال ناجح لرقم — يسجّل سوكته مع مالكه
export function registerForwardSock(phoneNumber, sock, ownerUid) {
  if (!phoneNumber || !sock) return;
  const prev = _socksByNumber.get(phoneNumber);
  _socksByNumber.set(phoneNumber, {
    sock,
    ownerUid: ownerUid != null ? String(ownerUid) : (prev?.ownerUid || null),
  });
}
export function unregisterForwardSock(phoneNumber, ownerUid) {
  if (!phoneNumber) return;
  const entry = _socksByNumber.get(phoneNumber);
  if (ownerUid != null && entry?.ownerUid && entry.ownerUid !== String(ownerUid)) return;
  _socksByNumber.delete(phoneNumber);
  if (entry?.sock && entry.sock === _sock) {
    const next = _socksByNumber.values().next().value;
    _sock = next ? next.sock : null;
  }
}

function _normalizePhone(value) {
  return String(value || "").replace(/[^0-9]/g, "");
}
function _samePhone(a, b) {
  const x = _normalizePhone(a), y = _normalizePhone(b);
  return !!x && !!y && x === y;
}
// [FIX-PER-USER] مع uid: أرقام هذا المستخدم فقط. بدون uid: الكل (توافق عكسي)
export function getConnectedForwardNumbers(uid) {
  const out = [];
  for (const [phone, entry] of _socksByNumber.entries()) {
    if (uid != null && entry.ownerUid && entry.ownerUid !== String(uid)) continue;
    if (uid != null && !entry.ownerUid) continue; // رقم بلا مالك معروف لا يُعرض لأحد غير مالكه
    out.push(phone);
  }
  // توافق عكسي: استدعاء بدون uid يرجع كل الأرقام
  if (uid == null) {
    return Array.from(_socksByNumber.keys());
  }
  return out;
}
function _sockForNumber(phoneNumber) {
  // [USER-ISOLATION] لا fallback لسوكت عام — الرقم المطلوب فقط
  const entry = phoneNumber ? _socksByNumber.get(phoneNumber) : null;
  return entry?.sock || null;
}
// [SESSION-RESOLVER] مُحلّل احتياطي يُحقن من index.mjs — يبحث في مخزن جلسات
// البوت الرئيسي (inMemoryDB.sessions) بنفس طريقة بقية أقسام البوت.
// هذا يضمن أن قسم التحويلات والـ WebApp يجدان الجلسة حتى لو لم يُسجَّل
// السوكت في السجل المحلي (مثلاً بعد استعادة جلسة عند إعادة التشغيل).
let _sessionResolver = null;
export function setForwardSessionResolver(fn) { _sessionResolver = fn; }

// أفضل سوكت متاح لمستخدم معيّن (أول رقم يملكه)
function _sockForUser(uid) {
  uid = String(uid);
  for (const entry of _socksByNumber.values()) {
    if (entry.ownerUid === uid && entry.sock) return entry.sock;
  }
  // احتياطي: مخزن الجلسات الرئيسي للبوت (خاص بهذا المستخدم فقط)
  if (_sessionResolver) {
    try { return _sessionResolver(uid) || null; } catch { return null; }
  }
  return null;
}
function _ownerOfSock(sock) {
  for (const entry of _socksByNumber.values()) {
    if (entry.sock === sock) return entry.ownerUid;
  }
  return null;
}
function _ownNumberOfSock(sock) {
  try {
    return "+" + (sock?.user?.id || "").split(":")[0].split("@")[0].replace(/[^0-9]/g, "");
  } catch { return null; }
}

// [LOG] إشعارات تيليجرام معطّلة بطلب المستخدم
function _fwLog(_text) { /* disabled */ }

// ─── إدارة البيانات (معزولة لكل مستخدم) ────────────────────────────
function loadRules() {
  try { return JSON.parse(readFileSync(RULES_FILE, "utf8")); }
  catch { return []; }
}
function saveRules(rules) {
  writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2), "utf8");
  _cacheInvalidate();
}
function loadChats() {
  try {
    const c = JSON.parse(readFileSync(CHATS_FILE, "utf8"));
    if (!Array.isArray(c.groups)) c.groups = [];
    if (!Array.isArray(c.channels)) c.channels = [];
    return c;
  }
  catch { return { groups: [], channels: [] }; }
}
function saveChats(chats) {
  writeFileSync(CHATS_FILE, JSON.stringify(chats, null, 2), "utf8");
  _cacheInvalidate();
}

// [FIX-PER-USER] ترحيل البيانات القديمة (بلا ownerUid) إلى المطوّر — مرة واحدة
(function _migrateLegacy() {
  try {
    let dirty = false;
    const chats = loadChats();
    for (const g of chats.groups)   { if (!g.ownerUid) { g.ownerUid = DEV_ID; dirty = true; } }
    for (const c of chats.channels) { if (!c.ownerUid) { c.ownerUid = DEV_ID; dirty = true; } }
    if (dirty) saveChats(chats);
    let rdirty = false;
    const rules = loadRules();
    for (const r of rules) { if (!r.ownerUid) { r.ownerUid = DEV_ID; rdirty = true; } }
    if (rdirty) saveRules(rules);
  } catch {}
})();

// ─── وصول معزول لكل مستخدم ─────────────────────────────────────────
export function userRules(uid) {
  uid = String(uid);
  return loadRules().filter((r) => String(r.ownerUid) === uid);
}
export function userChannels(uid) {
  uid = String(uid);
  return loadChats().channels.filter((c) => String(c.ownerUid) === uid);
}
export function userGroups(uid, phoneNumber = null) {
  uid = String(uid);
  return loadChats().groups.filter((g) =>
    String(g.ownerUid) === uid &&
    (phoneNumber == null || _samePhone(g.phoneNumber, phoneNumber))
  );
}
function addUserChannel(uid, ch) {
  uid = String(uid);
  const chats = loadChats();
  if (chats.channels.find((c) => c.id === ch.id && String(c.ownerUid) === uid)) return false;
  chats.channels.push({ ...ch, ownerUid: uid });
  saveChats(chats);
  return true;
}
function removeUserChannel(uid, chId) {
  uid = String(uid);
  const chats = loadChats();
  const before = chats.channels.length;
  chats.channels = chats.channels.filter((c) => !(c.id === chId && String(c.ownerUid) === uid));
  if (chats.channels.length === before) return false;
  saveChats(chats);
  return true;
}
function setUserGroups(uid, groups, phoneNumber) {
  uid = String(uid);
  const phone = _normalizePhone(phoneNumber);
  if (!phone) throw new Error("تعذّر تحديد رقم واتساب المرتبط بهذه المجموعات");
  const chats = loadChats();
  chats.groups = chats.groups.filter((g) =>
    !(String(g.ownerUid) === uid && _samePhone(g.phoneNumber, phone))
  );
  for (const g of groups) chats.groups.push({
    id: g.id,
    name: g.name,
    members: g.members || 0,
    ownerUid: uid,
    phoneNumber: phone,
  });
  saveChats(chats);
}

export function purgeForwardNumber(uid, phoneNumber) {
  uid = String(uid);
  const phone = _normalizePhone(phoneNumber);
  if (!phone) return { groups: 0, channels: 0, rules: 0 };
  const chats = loadChats();
  const beforeGroups = chats.groups.length;
  const beforeChannels = chats.channels.length;
  chats.groups = chats.groups.filter((g) =>
    !(String(g.ownerUid) === uid && _samePhone(g.phoneNumber, phone))
  );
  chats.channels = chats.channels.filter((c) =>
    !(String(c.ownerUid) === uid && _samePhone(c.phoneNumber, phone))
  );
  saveChats(chats);
  const rules = loadRules();
  const kept = rules.filter((r) =>
    !(String(r.ownerUid) === uid && _samePhone(r.sourceNumber, phone))
  );
  saveRules(kept);
  unregisterForwardSock(phoneNumber, uid);
  const state = gs(uid);
  if (_samePhone(state.fwNumber, phone)) cs(uid);
  return {
    groups: beforeGroups - chats.groups.length,
    channels: beforeChannels - chats.channels.length,
    rules: rules.length - kept.length,
  };
}

// ─── حالة الجلسة (في الذاكرة) ──────────────────────────────────────
const SESSION = new Map();
function gs(uid) { return SESSION.get(uid) || {}; }
function ss(uid, data) { SESSION.set(uid, { ...gs(uid), ...data }); }
function cs(uid) { SESSION.delete(uid); }

// ─── جلب المجموعات من واتساب ──────────────────────────────────────
// [GROUPS-PROVIDER] مزوّد يُحقن من index.mjs — نفس دالة قسم المجموعات الشغّالة
// (كاش inMemoryDB.groupsCache + 3 محاولات) فيعيد أسماء حقيقية وعدد الأعضاء
let _groupsProvider = null;
export function setForwardGroupsProvider(fn) { _groupsProvider = fn; }

function _mapGroup(g) {
  return {
    id: g.id,
    name: (g.subject && String(g.subject).trim()) || (g.name && String(g.name).trim()) || g.id,
    members: g.participants?.length || g.size || 0,
  };
}

async function fetchGroups(sockOverride, uid, force) {
  // 1) الطريقة المُثبتة: مزوّد قسم المجموعات (كاش + إعادة محاولات)
  if (uid && _groupsProvider) {
    try {
      const raw = await _groupsProvider(String(uid), !!force);
      if (Array.isArray(raw) && raw.length > 0) return raw.map(_mapGroup);
    } catch {}
  }
  // 2) احتياطي: جلب مباشر عبر السوكت المُمرَّر (مع إعادة محاولات)
  const sock = sockOverride;
  if (!sock) return [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const groups = await sock.groupFetchAllParticipating();
      const list = Object.values(groups || {});
      if (list.length > 0) return list.map(_mapGroup);
    } catch {}
    if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 1500));
  }
  return [];
}

// ─── مساعد: جلب اسم القناة من صفحتها على الويب (fallback بدون sock) ─
function _decodeHtmlEntities(str) {
  if (!str) return str;
  const _safeCP = (cp) => {
    try {
      return (cp > 0 && cp <= 0x10FFFF && !(cp >= 0xD800 && cp <= 0xDFFF))
        ? String.fromCodePoint(cp) : "";
    } catch { return ""; }
  };
  return str
    .replace(/&#x([0-9a-fA-F]{1,6});/g, (_, h) => _safeCP(parseInt(h, 16)))
    .replace(/&#([0-9]{1,7});/g,         (_, d) => _safeCP(parseInt(d, 10)))
    .replace(/&amp;/g,  '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/[\u200E\u200F\u202A-\u202E\uFEFF]/g, '').trim();
}

async function _fetchChannelWebInfo(inviteCode) {
  try {
    const url = `https://www.whatsapp.com/channel/${inviteCode}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "ar,en;q=0.9",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    let name = null, image = null;
    const ogMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
    if (ogMatch) {
      const raw = _decodeHtmlEntities(ogMatch[1])
        .replace(/ [\|\-] WhatsApp.*/i, "").replace(/ - \u0642\u0646\u0627\u0629 \u0639\u0644\u0649 \u0648\u0627\u062A\u0633\u0627\u0628.*/i, "").trim();
      if (raw && raw.length > 0 && raw !== "WhatsApp") name = raw;
    }
    if (!name) {
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) {
        const raw = _decodeHtmlEntities(titleMatch[1])
          .replace(/ [\|\-] WhatsApp.*/i, "").replace(/ - \u0642\u0646\u0627\u0629 \u0639\u0644\u0649 \u0648\u0627\u062A\u0633\u0627\u0628.*/i, "").trim();
        if (raw && raw.length > 0 && raw !== "WhatsApp") name = raw;
      }
    }
    const imgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (imgMatch) image = _decodeHtmlEntities(imgMatch[1]);
    return (name || image) ? { name, image } : null;
  } catch {
    return null;
  }
}

async function _fetchChannelNameFromWeb(inviteCode) {
  const info = await _fetchChannelWebInfo(inviteCode);
  return info?.name || null;
}

// ─── مساعد: جلب وعرض معلومات قناة واتساب (newsletter) ─────────────
async function _fetchAndShowNewsletter(uid, type, key, displayFn) {
  const sock = _sockForUser(uid);
  if (!sock) {
    await displayFn("⚠️ *واتساب غير متصل*\n\nاربط رقم واتساب أولاً ثم حاول مجدداً.", {
      inline_keyboard: [[{ text: "🔙 رجوع", callback_data: "fw_chm" }]],
    });
    return;
  }
  try {
    const meta = await sock.newsletterMetadata(type, key);
    if (!meta || !meta.id) throw new Error("no result");
    let _metaRawName = (typeof meta.name === "string" ? meta.name.trim() : "") || "";
    if (!_metaRawName || /^\d+$/.test(_metaRawName)) {
      if (type === "invite") {
        const _webN = await _fetchChannelNameFromWeb(key);
        if (_webN) _metaRawName = _webN;
      }
    }
    const name = _metaRawName || meta.id;
    const desc = typeof meta.description === "string" && meta.description ? meta.description.slice(0, 200) : "";
    const subs = meta.subscribers ? Number(meta.subscribers).toLocaleString("ar-SA") : "—";
    const verified = meta.verification === "VERIFIED" ? " ✅" : "";
    ss(uid, { chSearchResult: { id: meta.id, name, type, key } });
    await displayFn(
      `📺 *${name}${verified}*\n\n👥 المشتركون: ${subs}${desc ? "\n\n📝 " + desc : ""}`,
      {
        inline_keyboard: [
          [{ text: "📥 اشتراك في القناة", callback_data: "fw_chfollow" }],
          [{ text: "💾 حفظ في قائمة القنوات", callback_data: "fw_chsave" }],
          [{ text: "🖼️ تنزيل بروفايل القناة", callback_data: "fw_chpic" }],
          [{ text: "🔄 تحديث المعلومات", callback_data: "fw_chref" }],
          [{ text: "🔍 بحث عن قناة أخرى", callback_data: "fw_ch_search" }],
          backHome("fw_chm"),
        ],
      }
    );
  } catch {
    await displayFn(
      `❌ *لم يتم العثور على القناة*\n\nتأكد من:\n• صحة الرابط أو JID\n• أن القناة عامة وموجودة\n• أن واتساب متصل`,
      {
        inline_keyboard: [
          [{ text: "🔍 حاول مرة أخرى", callback_data: "fw_ch_search" }],
          backHome("fw_chm"),
        ],
      }
    );
  }
}

// ─── حذف الروابط ──────────────────────────────────────────────────
function removeLinks(text) {
  if (!text) return "";
  return text
    .replace(/https?:\/\/[^\s<>]*/gi, "")
    .replace(/www\.[^\s<>]*/gi, "")
    .replace(/bit\.ly\/[^\s]*/gi, "")
    .replace(/t\.me\/[^\s]*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
function hasLinks(text) {
  return /https?:\/\/|www\.|bit\.ly\/|t\.me\//i.test(text || "");
}

// ─── استخراج نص الرسالة ─────────────────���──────────────────────────
function extractMsgText(msg) {
  const m = msg.message;
  if (!m) return "";
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    ""
  );
}

// ═══════════════════════════════════════════════════════════════════
// معالجة رسائل واتساب — تطبيق قواعد التحويل
// ═══════════════════════════════════════════════════════════════════
export async function applyForwardRules(sock, msg) {
  try {
    // [PIPELINE-FIX] O(1) من الكاش ��� لا disk read لكل رسالة
    const rules = _cacheGetRules().filter((r) => r.enabled);
    const fromJid = msg.key?.remoteJid;
    const isNewsletter = fromJid?.endsWith("@newsletter");

    if (!rules.length || !fromJid) return;

    if (isNewsletter) {
      const matched = rules.some((r) => r.sources.includes(fromJid));
      if (!matched) return;
    }

    // [FIX-PER-USER] رقم الحساب الذي استقبل الرسالة + مالكه — القاعدة تُنفَّذ فقط
    // على سوكت صاحبها ورقمها المحدد
    const receivingNumber = _ownNumberOfSock(sock);
    const sockOwner = _ownerOfSock(sock);

    for (const rule of rules) {
      if (!rule.sources.includes(fromJid)) continue;
      if (rule.sourceNumber && receivingNumber && rule.sourceNumber !== receivingNumber) continue;
      // [FIX-PER-USER] قاعدة مستخدم آخر لا تُنفَّذ على سوكت غير سوكته
      if (rule.ownerUid && sockOwner && String(rule.ownerUid) !== String(sockOwner)) continue;
      const destJid = rule.destination;
      if (!destJid) continue;

      try {
        let text = extractMsgText(msg);
        const m = msg.message;
        if (!m) {
          _fwLog(`⚠️ رس��لة بدون محتوى واردة من:\n\`${fromJid}\``);
          continue;
        }

        // [FIX-REPLY-FILTER] تجاهل ردود صاحب القناة على تعليقات المستخدمين
        if (isNewsletter) {
          const _replyCtxId =
            m.extendedTextMessage?.contextInfo?.stanzaId ||
            m.ephemeralMessage?.message?.extendedTextMessage?.contextInfo?.stanzaId ||
            m.imageMessage?.contextInfo?.stanzaId ||
            m.videoMessage?.contextInfo?.stanzaId;
          if (_replyCtxId) {
            console.log(`[FW-TRACE] تخطي رد من صاحب القناة (رسالة مقتبسة): ${fromJid}`);
            continue;
          }
        }

        // حذف الروابط إذا مفعّل
        if (rule.blockLinks && hasLinks(text)) {
          text = removeLinks(text);
          const isTextOnly = !!(m.conversation || m.extendedTextMessage);
          if (isTextOnly && !text) continue;
        }
        // [FIX-MEDIA-FILTER] فلترة الوسائط حسب إعدادات القاعدة
        if (rule.blockImages && m.imageMessage) continue;
        if (rule.blockVideos && m.videoMessage) continue;
        if (rule.blockAudios && (m.audioMessage)) continue;

        // [NEWSLETTER-FIX] رسائل القنوات تُعاد كتابتها بدل forward مباشر
        const forceResend = isNewsletter || rule.noForward;

        let sent = false;
        let skipReason = null;

        if (forceResend) {
          if (m.conversation || m.extendedTextMessage) {
            if (text) { await sock.sendMessage(destJid, { text }); sent = true; }
            else skipReason = "نص فارغ";
          } else if (m.imageMessage) {
            const buf = await _downloadMedia(sock, msg);
            if (buf) { await sock.sendMessage(destJid, { image: buf, caption: text }); sent = true; }
            else if (!isNewsletter) { await sock.sendMessage(destJid, { forward: msg }); sent = true; }
            else skipReason = "فشل تنزيل الصورة";
          } else if (m.videoMessage) {
            const buf = await _downloadMedia(sock, msg);
            if (buf) { await sock.sendMessage(destJid, { video: buf, caption: text, mimetype: m.videoMessage.mimetype }); sent = true; }
            else if (!isNewsletter) { await sock.sendMessage(destJid, { forward: msg }); sent = true; }
            else skipReason = "فشل تنزيل الفيديو";
          } else if (m.audioMessage) {
            const buf = await _downloadMedia(sock, msg);
            if (buf) { await sock.sendMessage(destJid, { audio: buf, mimetype: m.audioMessage.mimetype || "audio/mp4", ptt: m.audioMessage.ptt }); sent = true; }
            else if (!isNewsletter) { await sock.sendMessage(destJid, { forward: msg }); sent = true; }
            else skipReason = "فشل تنزيل الصوت";
          } else if (m.stickerMessage) {
            const buf = await _downloadMedia(sock, msg);
            if (buf) { await sock.sendMessage(destJid, { sticker: buf }); sent = true; }
            else if (!isNewsletter) { await sock.sendMessage(destJid, { forward: msg }); sent = true; }
            else skipReason = "فشل تنزيل الملصق";
          } else if (m.documentMessage) {
            const buf = await _downloadMedia(sock, msg);
            if (buf) { await sock.sendMessage(destJid, { document: buf, mimetype: m.documentMessage.mimetype, fileName: m.documentMessage.fileName, caption: text }); sent = true; }
            else if (!isNewsletter) { await sock.sendMessage(destJid, { forward: msg }); sent = true; }
            else skipReason = "فشل تنزيل الملف";
          } else if (!isNewsletter) {
            await sock.sendMessage(destJid, { forward: msg }); sent = true;
          } else {
            const msgType = Object.keys(m).find(k => !["messageContextInfo","messageSecret"].includes(k)) || "غير معروف";
            skipReason = `نوع غير مدعوم من القنوات: ${msgType}`;
          }
        } else {
          await sock.sendMessage(destJid, { forward: msg }); sent = true;
        }

        const chats = _cacheGetChats();
        const srcName = chats.channels.find((c) => c.id === fromJid)?.name || fromJid;
        const dstName = chats.groups.find((g) => g.id === destJid)?.name || destJid;
        if (sent) {
          _fwLog(`✅ *تم التحويل بنجاح*\n📺 من: ${srcName}\n👥 إلى: ${dstName}`);
        } else if (skipReason) {
          _fwLog(`⏭️ *تم تخطي رسالة*\n📺 من: ${srcName}\n👥 إلى: ${dstName}\n⚠️ السبب: ${skipReason}`);
        }
      } catch (ruleErr) {
        console.error(`[FW-ERR] فشل التحويل | من: ${fromJid} | إلى: ${destJid} | خطأ: ${ruleErr?.message || String(ruleErr)}`);
      }
    }
  } catch (err) {
    console.error(`[FW-ERR] خطأ عام في نظام التحويل: ${err?.message || String(err)}`);
  }
}

async function _downloadMedia(sock, msg) {
  try {
    const { downloadMediaMessage } = await import("@whiskeysockets/baileys");
    const reuploadRequest = sock?.updateMediaMessage
      ? (m) => sock.updateMediaMessage(m)
      : undefined;
    const buf = await downloadMediaMessage(
      msg,
      "buffer",
      {},
      {
        logger: {
          info: () => {}, warn: () => {}, error: () => {}, debug: () => {},
          child: () => ({ info: () => {}, warn: () => {}, error: () => {}, debug: () => {} }),
        },
        reuploadRequest,
      }
    );
    return buf && buf.length > 0 ? buf : null;
  } catch (e) {
    console.error("[FW] _downloadMedia error:", e?.message || String(e));
    return null;
  }
}

// ─── تسجيل قناة من رسالة واتساب واردة ───────────────────────────
export function autoDetectSource(_msg) {
  // معطّلة بطلب المستخدم
  return;
}

// ═══════════���═════════��═════════════════════════════════════════════
// مكوّنات لوحة المفاتيح
// ═══════════════════════════════════════════════════════════════════
const PAGE = 9;

function backHome(back = "fw_menu") {
  return [{ text: "🔙 رجوع", callback_data: back }, { text: "🏠 الرئيسية", callback_data: "home" }];
}

// [FIX-WEBAPP] زر إدارة التحويلات عبر الويب — بدل زر التشخيص المحذوف
function _webappButton(uid) {
  const url = webappUrlFor(uid);
  if (url && url.startsWith("https://")) {
    return [{ text: "🌐 إدارة التحويلات (WebApp)", web_app: { url } }];
  }
  if (url) {
    return [{ text: "🌐 إدارة التح��يلات (WebApp)", url }];
  }
  // لا يوجد رابط عام — زر يشرح الرابط المحلي
  return [{ text: "🌐 إدارة التحويلات (WebApp)", callback_data: "fw_webapp" }];
}

function fwMenuKb(uid, n) {
  return {
    inline_keyboard: [
      [{ text: "➕ إضافة قاعدة تحويل", callback_data: "fw_add" }],
      [{ text: "📋 قواعد التحويل" + (n ? ` (${n})` : ""), callback_data: "fw_rules" }],
      [{ text: "📺 إدارة القنوات المحفوظة", callback_data: "fw_chm" }],
      _webappButton(uid),
      backHome("home"),
    ],
  };
}

function srcTypeKb() {
  return {
    inline_keyboard: [
      [{ text: "📺 قناة", callback_data: "fw_src_ch" }, { text: "👥 مجموعة", callback_data: "fw_src_gr" }],
      backHome("fw_menu"),
    ],
  };
}

function numberPickerKb(numbers) {
  const rows = numbers.map((num, i) => [{ text: `📱 ${num}`, callback_data: "fw_numpick_" + i }]);
  rows.push(backHome("fw_menu"));
  return { inline_keyboard: rows };
}

function dstTypeKb() {
  return {
    inline_keyboard: [
      [{ text: "📺 قناة", callback_data: "fw_dst_ch" }, { text: "👥 مجموعة", callback_data: "fw_dst_gr" }],
      [{ text: "👤 شخص (رقم هاتف)", callback_data: "fw_dst_person" }],
      backHome("fw_add"),
    ],
  };
}

function settingsKb(bl, nf, bi, bv, ba) {
  return {
    inline_keyboard: [
      [{ text: (bl ? "✅" : "❌") + " حذف الروابط", callback_data: "fw_set_lnk" }],
      [{ text: (bi ? "✅" : "❌") + " حذف الصور", callback_data: "fw_set_img" }, { text: (bv ? "✅" : "❌") + " حذف الفيديو", callback_data: "fw_set_vid" }],
      [{ text: (ba ? "✅" : "❌") + " حذف الصوت", callback_data: "fw_set_aud" }],
      [{ text: (nf ? "✅" : "❌") + " بدون علامة إعادة توجيه", callback_data: "fw_set_fwd" }],
      [{ text: "💾 حفظ القاعدة", callback_data: "fw_save" }],
      backHome("fw_dst_type"),
    ],
  };
}
function ruleKb(rule) {
  return {
    inline_keyboard: [
      [{ text: rule.enabled ? "⏸️ إيقاف" : "▶️ تفعيل", callback_data: "fw_en_" + rule.id }],
      [{ text: (rule.blockLinks ? "✅" : "❌") + " حذف الروابط", callback_data: "fw_lnk_" + rule.id }],
      [{ text: (rule.blockImages ? "✅" : "❌") + " حذف الصور", callback_data: "fw_img_" + rule.id }, { text: (rule.blockVideos ? "✅" : "❌") + " حذف الفيديو", callback_data: "fw_vid_" + rule.id }],
      [{ text: (rule.blockAudios ? "✅" : "❌") + " حذف الصوت", callback_data: "fw_aud_" + rule.id }],
      [{ text: (rule.noForward ? "✅" : "❌") + " بدون إعادة توجيه", callback_data: "fw_nfwd_" + rule.id }],
      [{ text: "🗑️ حذف القاعدة", callback_data: "fw_del_" + rule.id }],
      backHome("fw_rules"),
    ],
  };
}
function rulesListKb(rules, page = 0) {
  const slice = rules.slice(page * PAGE, (page + 1) * PAGE);
  const rows = slice.map((r) => [{
    text: (r.enabled ? "🟢 " : "🔴 ") + String(r?.name || r?.id || "قاعدة").slice(0, 40),
    callback_data: "fw_rl_" + r.id,
  }]);
  const nav = [];
  if (page > 0) nav.push({ text: "◀️ السابق", callback_data: "fw_rls_p" + (page - 1) });
  if ((page + 1) * PAGE < rules.length) nav.push({ text: "التالي ▶️", callback_data: "fw_rls_p" + (page + 1) });
  if (nav.length) rows.push(nav);
  rows.push(backHome("fw_menu"));
  return { inline_keyboard: rows };
}

// قائمة مجموعات أو قنوات مع pagination وبحث
// [FIX-NEXT-BTN] أُعيد بناء التنقّل من الصفر — الفهارس مطلقة والقائمة تُستعاد
// دائماً من بيانات المستخدم المحفوظة عند فقدان الجلسة، فلا يتعطّل زر التالي أبداً
function chatListKb(items, page, prefix, selected = [], multi = true, backCb = "fw_menu") {
  const total = Math.max(1, Math.ceil(items.length / PAGE));
  page = Math.min(Math.max(0, page), total - 1);
  const start = page * PAGE;
  const pageItems = items.slice(start, start + PAGE);

  const rows = pageItems.map((item, i) => {
    const idx = start + i;
    const isSel = selected.includes(item?.id);
    const label = String(item?.name || item?.subject || item?.id || "بدون اسم").slice(0, 38);
    return [{ text: (isSel ? "✅ " : "⬜ ") + label, callback_data: prefix + "t" + idx }];
  });

  const nav = [];
  if (page > 0) nav.push({ text: "◀️ السابقة", callback_data: prefix + "p" + (page - 1) });
  nav.push({ text: `📄 ${page + 1}/${total}`, callback_data: "noop" });
  if (page < total - 1) nav.push({ text: "التالية ▶️", callback_data: prefix + "p" + (page + 1) });
  rows.push(nav);

  rows.push([
    { text: "🔍 بحث", callback_data: prefix + "srch" },
    { text: "🔄 تحديث", callback_data: prefix + "ref" },
  ]);

  if (multi && selected.length > 0) {
    rows.push([{ text: `✔️ تأكيد الاختيار (${selected.length} محدد)`, callback_data: prefix + "ok" }]);
  }
  rows.push(backHome(backCb));
  return { inline_keyboard: rows };
}

function chMgrKb() {
  return {
    inline_keyboard: [
      [{ text: "🔍 بحث في القنوات العامة", callback_data: "fw_ch_search" }],
      [{ text: "➕ إضافة قناة يدوياً (JID أو رابط)", callback_data: "fw_ch_add" }],
      [{ text: "📺 القنوات المحفوظة", callback_data: "fw_ch_list" }],
      [{ text: "👥 المجموعات المحفوظة", callback_data: "fw_gr_list" }],
      [{ text: "🔄 تحديث المجموعات من واتساب", callback_data: "fw_gr_ref" }],
      backHome("fw_menu"),
    ],
  };
}

// [FIX-NEXT-BTN] مصدر موحّد لعناصر القائمة — جلسة ثم fallback لبيانات المستخدم
function _listItems(uid, isCh, sessKey) {
  const s = gs(uid);
  let items = s[sessKey];
  if (Array.isArray(items) && items.length) return items;
  items = isCh ? userChannels(uid) : userGroups(uid);
  ss(uid, { [sessKey]: items });
  return items;
}

// ═══════════════════════════════════════════════════════════════════
// معالج callbacks التيليجرام
// ══════════════════════════════════════════════════════════════════��
export async function handleForwardCallback(query) {
  if (!_bot) return false;
  const data = (query.data || "").trim();
  if (!data.startsWith("fw_")) return false;

  const chatId = query.message.chat.id;
  const msgId = query.message.message_id;
  const uid = String(query.from.id);

  const ans = (t = "") => _bot.answerCallbackQuery(query.id, { text: t }).catch(() => {});
  const edit = async (txt, kb) => {
    try {
      await _bot.editMessageText(txt, { chat_id: chatId, message_id: msgId, reply_markup: kb, parse_mode: "Markdown" });
    } catch {
      try { await _bot.deleteMessage(chatId, msgId); } catch {}
      await _bot.sendMessage(chatId, txt, { reply_markup: kb, parse_mode: "Markdown" }).catch(() => {});
    }
  };
  const send = (txt, kb) => _bot.sendMessage(chatId, txt, { reply_markup: kb, parse_mode: "Markdown" }).catch(() => {});

  // ── القائمة الرئيسية ─────────────────��────────────────────────
  if (data === "fw_menu") {
    ans();
    await edit("📡 *قسم التحويل*\n\nأنشئ قواعد لتوجيه الرسائل بين ال��نوات والمجموعات تلقائياً.\nتحويل شامل: قناة→مجموعة، مجموعة→مجموعة، مجموعة→شخص...", fwMenuKb(uid, userRules(uid).length));
    return true;
  }

  // ── WebApp (الرابط العام قيد الإنشاء عبر النفق التلقائي) ─────
  if (data === "fw_webapp") {
    // البوت ينشئ رابطاً عاماً بنفسه عبر النفق — قد يستغرق ثوانٍ عند أول تشغيل
    const readyUrl = webappUrlFor(uid);
    if (readyUrl && readyUrl.startsWith("https://")) {
      ans("✅ الرابط جاهز");
      let note = "";
      try {
        const t = await import("./tunnel.mjs");
        if (t.tunnelProvider?.() === "localtunnel" && t.tunnelPassword?.()) {
          note = "\n\n⚠️ عند أول فتح قد تظهر صفحة تطلب كلمة مرور — أدخل:\n`" + t.tunnelPassword() + "`\n(تُدخل مرة واحدة فقط)";
        }
      } catch {}
      await edit(
        "🌐 *إدارة التحويلات عبر الويب*\n\nالرابط جاهز! اضغط الزر بالأسفل لفتح لوحة الإدارة." + note + "\n\n_رابطك خاص بك — لا تشاركه مع أحد._",
        { inline_keyboard: [
          [{ text: "🌐 فتح لوحة الإدارة", web_app: { url: readyUrl } }],
          backHome("fw_menu"),
        ] }
      );
      return true;
    }
    ans("⏳ جاري إنشاء الرابط...");
    await edit(
      "⏳ *جاري إنشاء الرابط العام...*\n\n" +
      "البوت ينشئ رابطاً عاماً تلقائياً (يستغرق 10-30 ثانية عند أول تشغيل).\n\n" +
      "اضغط الزر بالأسفل بعد لحظات للتحقق مجدداً.",
      { inline_keyboard: [
        [{ text: "🔄 تحقق مجدداً", callback_data: "fw_webapp" }],
        backHome("fw_menu"),
      ] }
    );
    return true;
  }

  // ── إدارة القنوات ─────────────────────────────────────────────
  if (data === "fw_chm") { ans(); await edit("📺 *إدارة القنوات والمجموعات*", chMgrKb()); return true; }

  if (data === "fw_ch_add") {
    ans();
    ss(uid, { step: "add_ch_jid" });
    await send("📺 *إضافة قناة*\n\nأرسل رابط القناة مباشرة:\n`https://whatsapp.com/channel/...`\n\nأو JID مباشرة:\n`120363...@newsletter`\n\n_البوت سيجلب الاسم الحقيقي ويشترك تلقائياً._");
    return true;
  }

  if (data === "fw_gr_ref") {
    const sock = _sockForUser(uid);
    if (!sock) {
      ans("⚠️ واتساب غير متصل");
      await edit("⚠️ *واتساب غير متصل بعد*\n\nاربط رقم واتساب أولاً ثم اضغط تحديث مجدداً.", chMgrKb());
      return true;
    }
    ans("🔄 جاري جلب المجموعات...");
    const groups = await fetchGroups(sock, uid, true);
    setUserGroups(uid, groups);
    await edit(`✅ *تم تحديث المجموعات*\n\n📊 عدد المجموعات: ${groups.length}`, chMgrKb());
    return true;
  }

  if (data === "fw_ch_list") {
    ans();
    const items = userChannels(uid);
    if (!items.length) { await edit("📺 *القنوات المحفوظة*\n\nلا توجد قنوات محفوظة بعد.\nأضف قناة من زر الإضافة أو من الويب آب.", chMgrKb()); return true; }
    const rows = items.slice(0, 20).map((c, i) => [{ text: "🗑️ " + c.name, callback_data: "fw_ch_del_" + i }]);
    rows.push(backHome("fw_chm"));
    await edit(`📺 *القنوات المحفوظة* (${items.length})\n\n_اضغط على أي قناة لحذفها_`, { inline_keyboard: rows });
    return true;
  }

  if (data.startsWith("fw_ch_del_")) {
    ans();
    const idx = parseInt(data.slice(10));
    const items = userChannels(uid);
    if (isNaN(idx) || idx >= items.length) { ans("⚠️ خطأ في الفهرس"); return true; }
    const removed = items[idx];
    removeUserChannel(uid, removed.id);
    const rest = userChannels(uid);
    if (!rest.length) {
      await edit("📺 *القنوات المحفوظة*\n\nلا توجد قنوات محفوظة بعد.", chMgrKb());
      return true;
    }
    const rows = rest.slice(0, 20).map((c, i) => [{ text: "🗑️ " + c.name, callback_data: "fw_ch_del_" + i }]);
    rows.push(backHome("fw_chm"));
    await edit(`📺 *القنوات المحفوظة* (${rest.length})\n\n✅ تم حذف: ${removed.name}\n\n_اضغط على أي قناة لحذفها_`, { inline_keyboard: rows });
    return true;
  }

  // ── بحث عن قناة واتساب عامة ─────────────────────────────────
  if (data === "fw_ch_search") {
    ans();
    ss(uid, { step: "ch_search" });
    await send(
      "🔍 *البحث عن قناة واتساب عامة*\n\nأرسل رابط القناة أو JID الخاص بها:\n\n" +
      "• رابط: `https://whatsapp.com/channel/0029Va...`\n" +
      "• JID: `120363...@newsletter`\n\n" +
      "_البوت سيجلب اسمها ومشتركيها وصورتها تلقائياً._"
    );
    return true;
  }

  // ── حفظ قناة من نتائج البحث ─────────────────────────────────
  if (data === "fw_chsave") {
    ans();
    const result = gs(uid).chSearchResult;
    if (!result?.id) { ans("⚠️ لا توجد قناة في الجلسة — ابحث أولاً"); return true; }
    const added = addUserChannel(uid, { id: result.id, name: result.name });
    if (!added) { ans("ℹ️ القناة محفوظة مسبقاً"); return true; }
    const sock = _sockForUser(uid);
    if (sock?.subscribeNewsletterUpdates) sock.subscribeNewsletterUpdates(result.id).catch(() => {});
    ans("✅ تم الحفظ والاشتراك في تحديثات القناة");
    return true;
  }

  // ── اشتراك في القناة (follow) ────────────────────────────────
  if (data === "fw_chfollow") {
    ans("⏳ جاري الاشتراك...");
    const result = gs(uid).chSearchResult;
    if (!result?.id) { ans("⚠️ لا توجد قناة في الجلسة"); return true; }
    const sock = _sockForUser(uid);
    if (!sock) { ans("⚠️ واتساب غير متصل"); return true; }
    try {
      await sock.newsletterFollow(result.id);
      await sock.subscribeNewsletterUpdates(result.id).catch(() => {});
      ans("✅ تم الاشتراك في القناة بنجاح");
    } catch {
      ans("❌ تعذّر الاشتراك — تأكد من الاتصال");
    }
    return true;
  }

  // ── ت��زيل بروفايل القناة ──────────────────────────────────────
  if (data === "fw_chpic") {
    ans("⏳ جاري تنزيل البروفايل الكامل...");
    const result = gs(uid).chSearchResult;
    if (!result?.id) { await send("⚠️ لا توجد قناة في الجلسة"); return true; }
    const sock = _sockForUser(uid);
    if (!sock) { await send("⚠️ واتساب غير متصل"); return true; }
    let _meta = null;
    try {
      _meta = await sock.newsletterMetadata(result.type === "invite" ? "invite" : "jid", result.key || result.id);
    } catch {}
    const _nm = (_meta?.name && String(_meta.name).trim()) || result.name || result.id;
    const _dsc = _meta?.description ? String(_meta.description).slice(0, 600) : "";
    const _sbs = _meta?.subscribers ? Number(_meta.subscribers).toLocaleString("ar-SA") : "—";
    const _vrf = _meta?.verification === "VERIFIED" ? " ✅ موثّقة" : "";
    const _crt = _meta?.creation_time ? new Date(Number(_meta.creation_time) * 1000).toLocaleDateString("ar") : "";
    const _cap = `📺 *${_nm}*${_vrf}\n\n👥 المشتركون: ${_sbs}${_crt ? `\n📅 تاريخ الإنشاء: ${_crt}` : ""}\n🆔 \`${result.id}\`${_dsc ? `\n\n📝 *الوصف:*\n${_dsc}` : ""}`;
    try {
      let url;
      try { url = await sock.profilePictureUrl(result.id, "image"); }
      catch { url = await sock.profilePictureUrl(result.id, "preview"); }
      const _picRes = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 WhatsApp/2.24.3.84" },
        signal: AbortSignal.timeout(15000),
      });
      if (!_picRes.ok) throw new Error("HTTP " + _picRes.status);
      const _picBuf = Buffer.from(await _picRes.arrayBuffer());
      if (!_picBuf.length) throw new Error("empty buffer");
      await _bot.sendPhoto(
        chatId,
        _picBuf,
        { caption: _cap, parse_mode: "Markdown" },
        { filename: "profile.jpg", contentType: "image/jpeg" }
      );
    } catch (e) {
      console.error("[FW] fw_chpic pic error:", e?.message || String(e));
      await send(_cap + "\n\n⚠️ _القناة لا تملك صورة بروفايل قابلة للتنزيل._");
    }
    return true;
  }

  // ── تحديث معلومات القناة الحالية ─────────────────────────────
  if (data === "fw_chref") {
    ans("🔄 جاري التحديث...");
    const result = gs(uid).chSearchResult;
    if (!result?.id) { ans("⚠️ لا توجد قناة في الجلسة — ابحث أولاً"); return true; }
    await _fetchAndShowNewsletter(uid, result.type || "jid", result.key || result.id, edit);
    return true;
  }

  // ── عرض قائمة المجموعات المحفوظة ────────────────────────────
  if (data === "fw_gr_list" || data.startsWith("fw_grl_p")) {
    ans();
    const p = data.startsWith("fw_grl_p") ? (parseInt(data.slice(8)) || 0) : 0;
    const items = userGroups(uid);
    if (!items.length) {
      await edit("👥 *المجموعات المحفوظة*\n\nلا توجد مجموعات بعد.\nاضغط 🔄 تحديث لجلبها من واتساب.", chMgrKb());
      return true;
    }
    const total = Math.max(1, Math.ceil(items.length / PAGE));
    const pSafe = Math.min(Math.max(0, p), total - 1);
    const slice = items.slice(pSafe * PAGE, (pSafe + 1) * PAGE);
    const rows = slice.map((g) => [{ text: "👥 " + String(g?.name || g?.subject || g?.id || "مجموعة بدون اسم").slice(0, 36) + (g?.members ? ` (${g.members})` : ""), callback_data: "noop" }]);
    const nav = [];
    if (pSafe > 0) nav.push({ text: "◀️ السابق", callback_data: "fw_grl_p" + (pSafe - 1) });
    nav.push({ text: `📄 ${pSafe + 1}/${total}`, callback_data: "noop" });
    if (pSafe < total - 1) nav.push({ text: "التالي ▶️", callback_data: "fw_grl_p" + (pSafe + 1) });
    rows.push(nav);
    rows.push(backHome("fw_chm"));
    await edit(`👥 *المجموعات المحفوظة* (${items.length})`, { inline_keyboard: rows });
    return true;
  }

  // ── إضافة قاعدة — أولاً: اختيار رقم واتساب ثم نوع المصدر ────────
  if (data === "fw_add") {
    ans();
    const numbers = getConnectedForwardNumbers(uid);
    if (!numbers.length) {
      await edit("⚠️ لا يوجد أي رقم واتساب متصل حالياً لحسابك.\nاربط رقماً أولاً ثم أعد المحاولة.", { inline_keyboard: [backHome("fw_menu")] });
      return true;
    }
    ss(uid, { step: "pick_number", fwNumberList: numbers, sources: [], srcItems: null, dstItems: null, srcPage: 0, dstPage: 0, blockLinks: false, blockImages: false, blockVideos: false, blockAudios: false, noForward: false });
    await edit("➕ *إضافة قاعدة تحويل*\n\n📱 اختر *رقم الواتساب* الذي تريد إنشاء التحويل عليه:", numberPickerKb(numbers));
    return true;
  }

  if (data.startsWith("fw_numpick_")) {
    ans();
    const idx = parseInt(data.slice("fw_numpick_".length));
    const numbers = gs(uid).fwNumberList || getConnectedForwardNumbers(uid);
    const fwNumber = numbers[idx];
    if (!fwNumber) { ans("⚠️ رقم غير صالح — أعد المحاولة"); return true; }
    ss(uid, { fwNumber, step: "src_type" });
    await edit(`➕ *إضافة قاعدة تحويل*\n\n📱 الرقم المختار: \`${fwNumber}\`\n\nاختر *نوع المصدر* — من أين تأتي الرسائل؟`, srcTypeKb());
    return true;
  }

  if (data === "fw_src_ch" || data === "fw_src_gr") {
    ans();
    const isCh = data === "fw_src_ch";
    const fwNumber = gs(uid).fwNumber;
    if (!fwNumber) { ans("⚠️ اختر رقم واتساب أولاً"); return true; }
    let items = isCh ? userChannels(uid) : userGroups(uid);
    if (!isCh && !items.length) {
      const fetched = await fetchGroups(_sockForNumber(fwNumber), uid);
      if (fetched.length) { setUserGroups(uid, fetched); items = fetched; }
    }
    ss(uid, { srcType: isCh ? "ch" : "gr", srcPage: 0, srcItems: items });
    const prefix = isCh ? "fw_sch_" : "fw_sgr_";
    const title = isCh ? "📺 اختر القنوات المصدر" : "👥 اختر المجموعات المصدر";
    const body = items.length
      ? "\n\n_يمكنك اختيار أكثر من واحدة ثم اضغط تأكيد._"
      : "\n\n⚠️ لا توجد عناصر. اضغط 🔄 تحديث.";
    await edit(`*${title}*${body}`, chatListKb(items, 0, prefix, gs(uid).sources || [], true, "fw_add"));
    return true;
  }

  // ── Pagination مصادر — [FIX-NEXT-BTN] مبنية من جديد ───────────
  if (data.startsWith("fw_sch_p") || data.startsWith("fw_sgr_p")) {
    ans();
    const isCh = data.startsWith("fw_sch_p");
    const page = parseInt(data.slice(8)) || 0;
    const items = _listItems(uid, isCh, "srcItems");
    ss(uid, { srcPage: page });
    const prefix = isCh ? "fw_sch_" : "fw_sgr_";
    const title = isCh ? "📺 اختر القنوات المصدر" : "👥 اختر المجموعات المصدر";
    await edit(`*${title}*\n\n_يمكنك اختيار أكثر من واحدة._`, chatListKb(items, page, prefix, gs(uid).sources || [], true, "fw_add"));
    return true;
  }

  // ── Toggle مصدر ───────────────────────��──────────────────��──
  if (data.startsWith("fw_sch_t") || data.startsWith("fw_sgr_t")) {
    ans();
    const isCh = data.startsWith("fw_sch_t");
    const idx = parseInt(data.slice(8));
    const items = _listItems(uid, isCh, "srcItems");
    if (isNaN(idx) || idx >= items.length) { ans("⚠️ خطأ في الفهرس — حدّث القائمة"); return true; }
    const s = gs(uid);
    const itemId = items[idx].id;
    let sources = s.sources || [];
    let justAdded = false;
    if (sources.includes(itemId)) sources = sources.filter((x) => x !== itemId);
    else { sources.push(itemId); justAdded = true; }
    ss(uid, { sources });
    if (isCh && justAdded && itemId.endsWith("@newsletter")) {
      const numSock = _sockForNumber(s.fwNumber);
      if (numSock?.subscribeNewsletterUpdates) {
        numSock.subscribeNewsletterUpdates(itemId).catch(() => {});
      }
    }
    const prefix = isCh ? "fw_sch_" : "fw_sgr_";
    const title = isCh ? "📺 اختر القنوا�� المصدر" : "👥 اختر المجموعات المصدر";
    await edit(`*${title}*\n\n_يمكنك اختيار أكثر من واحدة._`, chatListKb(items, s.srcPage || 0, prefix, sources, true, "fw_add"));
    return true;
  }

  // ── Refresh مصادر ───────────────────────────────────────────
  if (data === "fw_sch_ref" || data === "fw_sgr_ref") {
    const isCh = data === "fw_sch_ref";
    if (isCh) { ans("ℹ️ أضف القنوات من قسم إدارة القنوات أو الويب آب"); return true; }
    const numSock = _sockForNumber(gs(uid).fwNumber) || _sockForUser(uid);
    if (!numSock) { ans("⚠️ واتساب غير متصل — اربط الرقم أولاً"); return true; }
    ans("🔄 جاري التحديث...");
    const items = await fetchGroups(numSock, uid, true);
    setUserGroups(uid, items);
    ss(uid, { srcItems: items, srcPage: 0 });
    const prefix = isCh ? "fw_sch_" : "fw_sgr_";
    const title = isCh ? "📺 القنوات المصدر" : "👥 المجموعات المصدر";
    await edit(`*${title}*\n\n✅ تم التحديث (${items.length} عنصر)`, chatListKb(items, 0, prefix, gs(uid).sources || [], true, "fw_add"));
    return true;
  }

  // ── بحث مصادر ───────────────────────────────────────────────
  if (data === "fw_sch_srch" || data === "fw_sgr_srch") {
    ans();
    const isCh = data === "fw_sch_srch";
    ss(uid, { searchMode: "src", searchIsCh: isCh });
    await send("🔍 اكتب اسم " + (isCh ? "القناة" : "المجموعة") + " أو جزءاً منه:");
    return true;
  }

  // ── تأكيد اختيار المصادر ────────────────────────────────���────
  if (data === "fw_sch_ok" || data === "fw_sgr_ok") {
    ans();
    const s = gs(uid);
    if (!s.sources?.length) { ans("⚠️ اختر مصدراً على الأقل"); return true; }
    if (data === "fw_sch_ok") {
      ss(uid, { step: "dst_type" });
      await edit(`➕ *إضافة قاعدة*\n\n✅ تم اختيار ${s.sources.length} مصدر\n\nاختر *نوع الوجهة*:`, dstTypeKb());
      return true;
    }
    let items = userGroups(uid);
    if (!items.length) {
      items = await fetchGroups(_sockForNumber(s.fwNumber) || _sockForUser(uid), uid);
      if (items.length) setUserGroups(uid, items);
    }
    ss(uid, { step: "dst_type", dstType: "gr", dstItems: items, dstPage: 0 });
    await edit(
      `➕ *إضافة قاعدة*\n\n✅ تم اختيار ${s.sources.length} مصدر\n\n👥 *اختر المجموعة الوجهة*\n\nاضغط على المجموعة مباشرة لاختيارها.`,
      chatListKb(items, 0, "fw_dgr_", [], false, "fw_add")
    );
    return true;
  }

  // ── اختيار الوجهة ────────────────────────────────────────────
  if (data === "fw_dst_type") {
    ans();
    await edit("➕ *إضافة قاعدة*\n\nاختر *نوع الوجهة*:", dstTypeKb());
    return true;
  }

  if (data === "fw_dst_ch" || data === "fw_dst_gr") {
    ans();
    const isCh = data === "fw_dst_ch";
    let items = isCh ? userChannels(uid) : userGroups(uid);
    if (!items.length && !isCh) {
      items = await fetchGroups(_sockForNumber(gs(uid).fwNumber) || _sockForUser(uid), uid);
      if (items.length) setUserGroups(uid, items);
    }
    ss(uid, { dstType: isCh ? "ch" : "gr", dstItems: items, dstPage: 0 });
    const prefix = isCh ? "fw_dch_" : "fw_dgr_";
    const title = isCh ? "📺 اختر القناة الوجهة" : "👥 اختر المجموعة الوجهة";
    await edit(`*${title}*\n\nاختر وجهة واحدة فقط.`, chatListKb(items, 0, prefix, [], false, "fw_dst_type"));
    return true;
  }

  if (data === "fw_dst_person") {
    ans();
    ss(uid, { dstType: "person", step: "dst_phone" });
    await send("👤 *تحديد الشخص الوجهة*\n\nأرسل رقم الهاتف مع رمز الدولة\n\nمثال: `9665XXXXXXXX`\n_(أرقام فقط، بدون + أو مسافات)_");
    return true;
  }

  // ── Pagination وجهة — [FIX-NEXT-BTN] مبنية من جديد ────────────
  if (data.startsWith("fw_dch_p") || data.startsWith("fw_dgr_p")) {
    ans();
    const isCh = data.startsWith("fw_dch_p");
    const page = parseInt(data.slice(8)) || 0;
    const items = _listItems(uid, isCh, "dstItems");
    ss(uid, { dstPage: page });
    const prefix = isCh ? "fw_dch_" : "fw_dgr_";
    const total = Math.max(1, Math.ceil(items.length / PAGE));
    const title = `${isCh ? "📺 اختر القناة الوجهة" : "👥 اختر المجموعة الوجهة"} (صفحة ${Math.min(page, total - 1) + 1}/${total})`;
    await edit(`*${title}*`, chatListKb(items, page, prefix, [], false, "fw_dst_type"));
    return true;
  }

  // ── Toggle وجهة (اختيار واحد) ────────────────────────────────
  if (data.startsWith("fw_dch_t") || data.startsWith("fw_dgr_t")) {
    ans();
    const isCh = data.startsWith("fw_dch_t");
    const idx = parseInt(data.slice(8));
    const items = _listItems(uid, isCh, "dstItems");
    if (isNaN(idx) || idx >= items.length) { ans("⚠️ خطأ في الفهرس — حدّث القائمة"); return true; }
    const item = items[idx];
    ss(uid, { destJid: item.id, destName: item.name, step: "settings" });
    const s2 = gs(uid);
    await edit(`⚙️ *إعدادات التحويل*\n\n📌 *الوجهة:* ${item.name}\n\nاضبط الخيارات ثم احفظ:`, settingsKb(s2.blockLinks, s2.noForward, s2.blockImages, s2.blockVideos, s2.blockAudios));
    return true;
  }

  // ── Refresh وجهة ─────────────────────────────────────────────
  if (data === "fw_dch_ref" || data === "fw_dgr_ref") {
    const isCh = data === "fw_dch_ref";
    if (isCh) { ans("ℹ️ أضف القنوات من قسم إدارة القنوات أو الويب آب"); return true; }
    const numSock = _sockForNumber(gs(uid).fwNumber) || _sockForUser(uid);
    if (!numSock) { ans("⚠️ واتساب غير مت��ل — اربط الرقم أولاً"); return true; }
    ans("🔄 جاري التحديث...");
    const items = await fetchGroups(numSock, uid, true);
    setUserGroups(uid, items);
    ss(uid, { dstItems: items, dstPage: 0 });
    const prefix = isCh ? "fw_dch_" : "fw_dgr_";
    const title = isCh ? "📺 القناة الوجهة" : "👥 المجموعة الوجهة";
    await edit(`*${title}*\n\n✅ تم التحديث (${items.length} عنصر)`, chatListKb(items, 0, prefix, [], false, "fw_dst_type"));
    return true;
  }

  // ── بحث وجهة ───────��────────────────────────────────────────
  if (data === "fw_dch_srch" || data === "fw_dgr_srch") {
    ans();
    const isCh = data === "fw_dch_srch";
    ss(uid, { searchMode: "dst", searchIsCh: isCh });
    await send("🔍 اكتب اسم " + (isCh ? "القناة" : "المجموعة") + " للبحث:");
    return true;
  }

  // ── الإعدادات ─────────────────────────────────────────────────
  if (data === "fw_set_lnk") {
    ans();
    ss(uid, { blockLinks: !gs(uid).blockLinks });
    const s = gs(uid);
    await edit("⚙️ *إعدادات التحويل*", settingsKb(s.blockLinks, s.noForward, s.blockImages, s.blockVideos, s.blockAudios));
    return true;
  }

  if (data === "fw_set_img" || data === "fw_set_vid" || data === "fw_set_aud") {
    ans();
    const _mediaKey = data === "fw_set_img" ? "blockImages" : data === "fw_set_vid" ? "blockVideos" : "blockAudios";
    ss(uid, { [_mediaKey]: !gs(uid)[_mediaKey] });
    const s = gs(uid);
    await edit("⚙️ *إعدادات التحويل*", settingsKb(s.blockLinks, s.noForward, s.blockImages, s.blockVideos, s.blockAudios));
    return true;
  }

  if (data === "fw_set_fwd") {
    ans();
    ss(uid, { noForward: !gs(uid).noForward });
    const s = gs(uid);
    await edit("⚙️ *إعدادات التحويل*", settingsKb(s.blockLinks, s.noForward, s.blockImages, s.blockVideos, s.blockAudios));
    return true;
  }

  // ── حفظ القاعدة ──────────────────────────────────────────────
  if (data === "fw_save") {
    ans();
    const s = gs(uid);
    if (!s.sources?.length || !s.destJid) { ans("⚠️ بيانات ناقصة — أعد المحاولة"); return true; }

    const allItems = [...userGroups(uid), ...userChannels(uid)];
    const srcNames = s.sources.map((id) => {
      const found = allItems.find((x) => x.id === id);
      return found?.name || id.split("@")[0];
    }).join(" + ");
    const dstName = s.destName || allItems.find((x) => x.id === s.destJid)?.name || s.destJid.split("@")[0];

    const rule = {
      id: randomUUID(),
      name: srcNames + " → " + dstName,
      ownerUid: uid, // [FIX-PER-USER]
      sources: s.sources,
      destination: s.destJid,
      sourceNumber: s.fwNumber || null,
      blockLinks: s.blockLinks || false,
      blockImages: s.blockImages || false,
      blockVideos: s.blockVideos || false,
      blockAudios: s.blockAudios || false,
      noForward: s.noForward || false,
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    const rules = loadRules();
    rules.push(rule);
    saveRules(rules);
    cs(uid);

    await edit(
      `✅ *تم حفظ القاعدة بنجاح!*\n\n📌 ${rule.name}\n🔗 حذف الروابط: ${rule.blockLinks ? "نعم ✅" : "لا ❌"}\n↩️ بدون إعادة توجيه: ${rule.noForward ? "نعم ✅" : "لا ❌"}\n\n_القاعدة مفعّلة الآن._`,
      fwMenuKb(uid, userRules(uid).length)
    );
    return true;
  }

  // ── قائمة القواعد ────────────────────────────────────────────
  if (data === "fw_rules" || data.startsWith("fw_rls_p")) {
    ans();
    const page = data.startsWith("fw_rls_p") ? parseInt(data.slice(8)) || 0 : 0;
    const rules = userRules(uid);
    if (!rules.length) {
      await edit("📋 *قواعد التحويل*\n\nلا توجد قواعد بعد.", {
        inline_keyboard: [[{ text: "➕ إضافة قاعدة", callback_data: "fw_add" }], backHome("fw_menu")],
      });
      return true;
    }
    await edit(`📋 *قواعد التحويل* (${rules.length})\n\nاضغط على قاعدة لإدارتها:`, rulesListKb(rules, page));
    return true;
  }

  // ── تفاصيل قاعدة ─────────────────────────────────────────────
  if (data.startsWith("fw_rl_")) {
    ans();
    const ruleId = data.slice(6);
    const rule = userRules(uid).find((r) => r.id === ruleId);
    if (!rule) { ans("⚠️ القاعدة غير موجودة"); return true; }
    const status = rule.enabled ? "🟢 مفعّلة" : "🔴 موقوفة";
    const allItems = [...userGroups(uid), ...userChannels(uid)];
    const _friendlyId = (id) => {
      if (!id) return "—";
      const raw = id.split("@")[0];
      const isNewsletterJid = id.endsWith("@newsletter");
      const found = allItems.find((x) => x.id === id);
      if (found?.name) return found.name;
      return isNewsletterJid ? `📺 قناة ...${raw.slice(-6)}` : `👥 ...${raw.slice(-6)}`;
    };
    const srcNames = rule.sources.map(_friendlyId).join("\n  • ");
    const dstName = _friendlyId(rule.destination);
    await edit(
      `📌 *${rule.name}*\n\n📊 الحالة: ${status}\n\n📥 *المصادر:*\n  • ${srcNames}\n📤 *الوجهة:* ${dstName || "—"}\n\n🔗 حذف الروابط: ${rule.blockLinks ? "✅" : "❌"}\n↩️ بدون إعادة توجيه: ${rule.noForward ? "✅" : "❌"}`,
      ruleKb(rule)
    );
    return true;
  }

  // مساعد: جلب قاعدة يملكها المستخدم فقط
  const _findOwnRule = (ruleId) => {
    const rules = loadRules();
    const rule = rules.find((r) => r.id === ruleId && String(r.ownerUid) === uid);
    return { rules, rule };
  };

  // ── تفعيل/إيقاف قاعدة ───────────────────────────────────────
  if (data.startsWith("fw_en_")) {
    ans();
    const { rules, rule } = _findOwnRule(data.slice(6));
    if (!rule) { ans("⚠️ القاعدة غير موجودة"); return true; }
    rule.enabled = !rule.enabled;
    saveRules(rules);
    ans(rule.enabled ? "✅ تم التفعيل" : "⏸️ تم الإيقاف");
    await edit(`📌 *${rule.name}*\n\n📊 الحالة: ${rule.enabled ? "🟢 مفعّلة" : "🔴 موقوفة"}`, ruleKb(rule));
    return true;
  }

  // ── تبديل حذف الروابط ──────────────────────────────────────
  if (data.startsWith("fw_lnk_")) {
    ans();
    const { rules, rule } = _findOwnRule(data.slice(7));
    if (!rule) return true;
    rule.blockLinks = !rule.blockLinks;
    saveRules(rules);
    ans(rule.blockLinks ? "✅ حذف الروابط مفعّل" : "❌ حذف الروابط معطّل");
    await edit(`📌 *${rule.name}*`, ruleKb(rule));
    return true;
  }

  // ── تبديل بدون إعادة توجيه ─────────────────────────────────
  if (data.startsWith("fw_nfwd_")) {
    ans();
    const { rules, rule } = _findOwnRule(data.slice(8));
    if (!rule) return true;
    rule.noForward = !rule.noForward;
    saveRules(rules);
    ans(rule.noForward ? "✅ بدون علامة إعادة توجيه" : "❌ مع علامة إعادة توجيه");
    await edit(`📌 *${rule.name}*`, ruleKb(rule));
    return true;
  }

  if (data.startsWith("fw_img_")) {
    ans();
    const { rules, rule } = _findOwnRule(data.slice(7));
    if (!rule) return true;
    rule.blockImages = !rule.blockImages;
    saveRules(rules);
    ans(rule.blockImages ? "✅ حذف الصور مفعّل" : "❌ حذف الصور معطّل");
    await edit(`📌 *${rule.name}*`, ruleKb(rule));
    return true;
  }
  if (data.startsWith("fw_vid_")) {
    ans();
    const { rules, rule } = _findOwnRule(data.slice(7));
    if (!rule) return true;
    rule.blockVideos = !rule.blockVideos;
    saveRules(rules);
    ans(rule.blockVideos ? "✅ حذف الفيديو مفعّل" : "❌ حذف الفيديو معطّل");
    await edit(`📌 *${rule.name}*`, ruleKb(rule));
    return true;
  }
  if (data.startsWith("fw_aud_")) {
    ans();
    const { rules, rule } = _findOwnRule(data.slice(7));
    if (!rule) return true;
    rule.blockAudios = !rule.blockAudios;
    saveRules(rules);
    ans(rule.blockAudios ? "✅ حذف الصوت مفعّل" : "❌ حذف الصوت معطّل");
    await edit(`📌 *${rule.name}*`, ruleKb(rule));
    return true;
  }

  // ── حذف قاعدة ────────────────────────────────────────────────
  if (data.startsWith("fw_del_")) {
    ans();
    const ruleId = data.slice(7);
    let rules = loadRules();
    const rule = rules.find((r) => r.id === ruleId && String(r.ownerUid) === uid);
    if (!rule) return true;
    rules = rules.filter((r) => r.id !== ruleId);
    saveRules(rules);
    await edit(`🗑️ *تم حذف القاعدة*\n\n${rule.name}`, fwMenuKb(uid, userRules(uid).length));
    return true;
  }

  return false; // غير معالج
}

// ═══════════════════════════════════════════════════════════════════
// معالج الرسائل ال��صية (للبحث وإدخال الرقم)
// ═════════════════════════════════════════════════════════���═════════
export async function handleForwardText(msg) {
  if (!_bot) return false;
  const chatId = msg.chat?.id;
  const uid = String(msg.from?.id || "");
  if (!chatId || !uid) return false;
  const text = msg.text?.trim() || "";
  if (!text) return false;
  const sess = gs(uid);

  const send = (txt, kb) =>
    _bot.sendMessage(chatId, txt, { parse_mode: "Markdown", reply_markup: kb }).catch(() => {});

  // ── إدخال رقم هاتف للوجهة ────────────────────────────────────
  if (sess.step === "dst_phone") {
    const digits = text.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) {
      await send("⚠️ رقم غير صالح. أرسل الرقم مع رمز الدولة (أرقام فقط)\nمثال: `9665XXXXXXXX`");
      return true;
    }
    const jid = digits + "@s.whatsapp.net";
    ss(uid, { destJid: jid, destName: "👤 +" + digits, step: "settings" });
    const s = gs(uid);
    await send(`✅ تم تحديد الشخص: +${digits}\n\nاضبط إعدادات التحويل:`, settingsKb(s.blockLinks, s.noForward, s.blockImages, s.blockVideos, s.blockAudios));
    return true;
  }

  // ── إضافة قناة يدوياً ────────────────────────────────────────
  if (sess.step === "add_ch_jid") {
    const input = text.trim();
    const sock = _sockForUser(uid);
    if (input.includes("whatsapp.com/channel/")) {
      const match = input.match(/channel\/([A-Za-z0-9_\-]+)/);
      if (!match) { await send("⚠️ رابط غير صالح — تأكد من نسخ الرابط كاملاً"); return true; }
      await send("⏳ جاري جلب معلومات القناة...");
      ss(uid, { step: null });
      try {
        let metaId = null, metaName = null;
        if (sock?.newsletterMetadata) {
          try {
            const meta = await sock.newsletterMetadata("invite", match[1]);
            if (meta?.id) {
              metaId = meta.id;
              const _rawName = typeof meta.name === "string" ? meta.name.trim() : null;
              metaName = (_rawName && !/^\d+$/.test(_rawName)) ? _rawName : null;
            }
          } catch {}
        }
        if (metaId && !metaName) {
          const webName = await _fetchChannelNameFromWeb(match[1]);
          if (webName) metaName = webName;
        }
        if (!metaId) throw new Error("no meta");
        const name = metaName || ("📺 " + metaId.split("@")[0]);
        addUserChannel(uid, { id: metaId, name });
        if (sock?.subscribeNewsletterUpdates) sock.subscribeNewsletterUpdates(metaId).catch(() => {});
        await send(`✅ *تم إضافة القناة:*\n\n📺 ${name}\n\`${metaId}\`\n\nالبوت مشترك الآن ويستقبل رسائلها.`, chMgrKb());
      } catch {
        await send("❌ *تعذّر جلب القناة*\n\nتأكد من:\n• صحة الرابط\n• أن واتساب متصل\n• أن القناة عامة");
      }
      return true;
    }
    // JID مباشر أو رقم
    const digits = input.replace(/\D/g, "");
    let jid;
    if (input.includes("@")) {
      jid = input;
    } else if (digits.length >= 5) {
      jid = digits + "@newsletter";
    } else {
      await send("⚠️ أدخل رابط القناة أو JID مباشرةً\nمثال: `https://whatsapp.com/channel/...`");
      return true;
    }
    const label = jid.endsWith("@newsletter") ? "📺 قناة " : "👤 ";
    let chName = label + digits;
    if (jid.endsWith("@newsletter") && sock?.newsletterMetadata) {
      try {
        const meta = await sock.newsletterMetadata("jid", jid);
        if (meta?.name && typeof meta.name === "string" && meta.name.trim() && !/^\d+$/.test(meta.name.trim())) {
          chName = meta.name.trim();
        }
      } catch {}
    }
    addUserChannel(uid, { id: jid, name: chName });
    if (jid.endsWith("@newsletter") && sock?.subscribeNewsletterUpdates) {
      sock.subscribeNewsletterUpdates(jid).catch(() => {});
    }
    ss(uid, { step: null });
    await send(`✅ تم حفظ: \`${jid}\`\n📺 ${chName}`, chMgrKb());
    return true;
  }

  // ── بحث عن قناة واتساب عامة ──────────────────────────────────
  if (sess.step === "ch_search") {
    ss(uid, { step: null });
    const input = text.trim();
    let type, key;
    if (input.includes("whatsapp.com/channel/")) {
      const match = input.match(/channel\/([A-Za-z0-9_\-]+)/);
      if (!match) {
        await send("⚠️ رابط غير صالح.\n\nأرسل رابطاً صحيحاً مثل:\n`https://whatsapp.com/channel/0029Va...`");
        return true;
      }
      type = "invite"; key = match[1];
    } else if (input.endsWith("@newsletter")) {
      type = "jid"; key = input;
    } else {
      await send(
        "⚠️ *مدخل غير مدعوم*\n\nأرسل:\n" +
        "• رابط القناة: `https://whatsapp.com/channel/...`\n" +
        "• أو JID: `120363...@newsletter`"
      );
      return true;
    }
    await send("⏳ جاري البحث عن القناة...");
    await _fetchAndShowNewsletter(
      uid, type, key,
      (t, kb) => _bot.sendMessage(chatId, t, { parse_mode: "Markdown", reply_markup: kb }).catch(() => {})
    );
    return true;
  }

  // ── وضع البحث ────────────────────────────────────────────────
  if (sess.searchMode) {
    const mode = sess.searchMode; // "src" | "dst"
    const isCh = sess.searchIsCh;
    const pool = isCh ? userChannels(uid) : userGroups(uid);
    const q = text.toLowerCase();
    const filtered = pool.filter((i) => (i.name || "").toLowerCase().includes(q));

    ss(uid, { searchMode: null });

    if (!filtered.length) {
      await send(`🔍 لا توجد نتائج لـ "${text}"\n\nجرّب كلمة أخرى.`);
      return true;
    }

    if (mode === "src") {
      ss(uid, { srcItems: filtered, srcPage: 0 });
      const prefix = isCh ? "fw_sch_" : "fw_sgr_";
      const title = isCh ? "📺 نتائج البحث — اختر المصادر" : "👥 نتائج البحث — اختر المصادر";
      await send(`*${title}* (${filtered.length})`, chatListKb(filtered, 0, prefix, gs(uid).sources || [], true, "fw_add"));
    } else {
      ss(uid, { dstItems: filtered, dstPage: 0 });
      const prefix = isCh ? "fw_dch_" : "fw_dgr_";
      const title = isCh ? "📺 نتائج البحث — الوجهة" : "👥 نتائج البحث — الوجهة";
      await send(`*${title}* (${filtered.length})`, chatListKb(filtered, 0, prefix, [], false, "fw_dst_type"));
    }
    return true;
  }

  // ── [LINK-AUTO-ADD] رابط قناة مُرسَل في أي وقت → جلب الاسم وإضافتها فوراً ──
  if (text.includes("whatsapp.com/channel/")) {
    const match = text.match(/channel\/([A-Za-z0-9_\-]+)/);
    if (match) {
      await send("⏳ جاري جلب معلومات القناة...");
      const sock = _sockForUser(uid);
      try {
        let metaId = null, metaName = null;
        if (sock?.newsletterMetadata) {
          try {
            const meta = await sock.newsletterMetadata("invite", match[1]);
            if (meta?.id) {
              metaId = meta.id;
              const _rawName = typeof meta.name === "string" ? meta.name.trim() : null;
              metaName = (_rawName && !/^\d+$/.test(_rawName)) ? _rawName : null;
            }
          } catch {}
        }
        if (!metaName) {
          const webName = await _fetchChannelNameFromWeb(match[1]);
          if (webName) metaName = webName;
        }
        if (!metaId && !metaName) throw new Error("no meta");
        // بدون sock نحفظ بالاسم من الويب والرابط كمعرف مؤقت يُحدَّث عند الاتصال
        const id = metaId || ("invite:" + match[1]);
        const name = metaName || ("📺 " + (metaId ? metaId.split("@")[0] : match[1]));
        const isNew = addUserChannel(uid, { id, name });
        if (metaId && sock?.subscribeNewsletterUpdates) {
          sock.subscribeNewsletterUpdates(metaId).catch(() => {});
        }
        await send(
          isNew
            ? `✅ *تمت إضافة القناة:*\n\n📺 ${name}\n\nأصبحت متاحة الآن في قوائم التحويل.`
            : `ℹ️ القناة *${name}* مضافة مسبقاً.`,
          chMgrKb()
        );
      } catch {
        await send("❌ *تعذّر جلب القناة*\n\nتأكد من:\n• صحة الرابط\n• أن واتساب متصل\n• أن القناة عامة");
      }
      return true;
    }
  }

  return false;
}

// ─── مساعدات خارجية ───────────────────────────────────────────────
export function isForwardCb(data) {
  return typeof data === "string" && data.startsWith("fw_");
}

// [NEWSLETTER-FIX] الاشتراك في قنوات مالك السوكت فقط لاستقبال رسائلها الحية
export async function subscribeForwardChannels(sock) {
  if (!sock?.subscribeNewsletterUpdates) {
    console.log("[FORWARD] subscribeNewsletterUpdates غير موجود في السوكت");
    return;
  }
  try {
    const owner = _ownerOfSock(sock);
    const allChannels = loadChats().channels;
    const channels = allChannels.filter(ch =>
      ch.id?.endsWith("@newsletter") && (!owner || String(ch.ownerUid) === String(owner))
    );
    if (!channels.length) return;
    for (const ch of channels) {
      try {
        const res = await sock.subscribeNewsletterUpdates(ch.id);
        const dur = res?.duration;
        console.log(`[FORWARD] ✅ اشتراك ناجح في القناة: ${ch.id} | مدة: ${dur ?? "غير محدد"}`);
      } catch (e) {
        console.log(`[FORWARD] ❌ فشل الاشتراك في القناة: ${ch.id} | ${e?.message}`);
      }
    }
  } catch (e) {
    console.log(`[FORWARD] خطأ في subscribeForwardChannels: ${e?.message}`);
  }
}

// إعادة اشتراك دورية — مدة الاشتراك 90 ثانية فقط
// [FIX-PER-USER] مؤقّت لكل سوكت بدل مؤقت عام واحد (كان آخر رقم متصل يقتل تجديد البقية)
const _renewTimers = new Map();
export function startNewsletterRenewal(sock) {
  const key = _ownNumberOfSock(sock) || "default";
  const prev = _renewTimers.get(key);
  if (prev) clearInterval(prev);
  const timer = setInterval(async () => {
    if (!sock?.subscribeNewsletterUpdates) return;
    const owner = _ownerOfSock(sock);
    const channels = loadChats().channels.filter(ch =>
      ch.id?.endsWith("@newsletter") && (!owner || String(ch.ownerUid) === String(owner))
    );
    if (!channels.length) return;
    for (const ch of channels) {
      try { await sock.subscribeNewsletterUpdates(ch.id); } catch {}
    }
  }, 60 * 1000);
  _renewTimers.set(key, timer);
}

export function isForwardSession(uid) {
  const s = SESSION.get(String(uid));
  return !!(s && (s.searchMode || s.step === "dst_phone" || s.step === "add_ch_jid" || s.step === "ch_search"));
}

// ═══════════════════════════════════════════════════════════════════
// [WEBAPP-API] واجهات للويب آب — كلها معزولة لكل مستخدم
// ═══════════════════════════════════════════════════════════════════
export function webGetOverview(uid) {
  uid = String(uid);
  const numbers = getConnectedForwardNumbers(uid);
  const owned = new Set(numbers.map(_normalizePhone));
  const groups = userGroups(uid).filter((g) => owned.has(_normalizePhone(g.phoneNumber)));
  const channels = userChannels(uid).filter((c) => !c.phoneNumber || owned.has(_normalizePhone(c.phoneNumber)));
  const rules = userRules(uid).filter((r) => !r.sourceNumber || owned.has(_normalizePhone(r.sourceNumber)));
  return {
    numbers,
    channels,
    groups,
    rules,
    waConnected: numbers.length > 0 && !!_sockForUser(uid),
  };
}

// معاينة قناة عبر رابط أو JID — اسم + صورة + مشتركين
export async function webPreviewChannel(uid, input) {
  uid = String(uid);
  const sock = _sockForUser(uid);
  input = String(input || "").trim();
  let type = null, key = null;
  if (input.includes("whatsapp.com/channel/")) {
    const match = input.match(/channel\/([A-Za-z0-9_\-]+)/);
    if (!match) throw new Error("رابط غير صالح");
    type = "invite"; key = match[1];
  } else if (input.endsWith("@newsletter")) {
    type = "jid"; key = input;
  } else if (/^\d{5,}$/.test(input.replace(/\D/g, "")) && !input.includes("@")) {
    type = "jid"; key = input.replace(/\D/g, "") + "@newsletter";
  } else {
    throw new Error("أدخل رابط قناة واتساب أو JID صالحاً");
  }

  let meta = null;
  if (sock?.newsletterMetadata) {
    try { meta = await sock.newsletterMetadata(type, key); } catch {}
  }
  let name = (meta?.name && typeof meta.name === "string" && meta.name.trim() && !/^\d+$/.test(meta.name.trim())) ? meta.name.trim() : null;
  let picture = meta?.preview || null;
  const id = meta?.id || (type === "jid" ? key : null);

  // fallback من صفحة الويب
  if ((!name || !picture) && type === "invite") {
    const web = await _fetchChannelWebInfo(key);
    if (web) {
      if (!name && web.name) name = web.name;
      if (!picture && web.image) picture = web.image;
    }
  }
  if (!id) throw new Error("تعذّر العثور على الق��اة — تأكد من الرابط واتصال واتساب");

  // صورة عبر السوكت إن ��م توجد
  if (!picture && sock?.profilePictureUrl) {
    try { picture = await sock.profilePictureUrl(id, "image"); }
    catch { try { picture = await sock.profilePictureUrl(id, "preview"); } catch {} }
  }

  return {
    id,
    name: name || ("📺 " + id.split("@")[0]),
    picture: picture || null,
    subscribers: meta?.subscribers ? Number(meta.subscribers) : null,
    verified: meta?.verification === "VERIFIED",
    description: meta?.description ? String(meta.description).slice(0, 300) : "",
    alreadySaved: userChannels(uid).some((c) => c.id === id),
  };
}

export function webAddChannel(uid, ch) {
  uid = String(uid);
  if (!ch?.id) throw new Error("بيانات قناة ناقصة");
  const numbers = getConnectedForwardNumbers(uid);
  const phoneNumber = ch.phoneNumber || numbers[0];
  if (!phoneNumber || !numbers.some((n) => _samePhone(n, phoneNumber))) {
    throw new Error("اختر رقم واتساب تابعاً لك");
  }
  const added = addUserChannel(uid, { id: ch.id, name: ch.name || ch.id, phoneNumber: _normalizePhone(phoneNumber) });
  const sock = _sockForNumber(phoneNumber);
  if (ch.id.endsWith("@newsletter") && sock?.subscribeNewsletterUpdates) {
    sock.subscribeNewsletterUpdates(ch.id).catch(() => {});
  }
  return { added };
}

export function webDeleteChannel(uid, chId) {
  return { removed: removeUserChannel(String(uid), chId) };
}

export async function webRefreshGroups(uid, number) {
  uid = String(uid);
  const numbers = getConnectedForwardNumbers(uid);
  const selected = number || numbers[0];
  if (!selected || !numbers.some((n) => _samePhone(n, selected))) {
    throw new Error("رقم واتساب غير تابع لك أو غير متصل");
  }
  const entry = [..._socksByNumber.entries()].find(([phone, e]) => _samePhone(phone, selected) && e.ownerUid === uid)?.[1];
  const sock = entry?.sock;
  if (!sock) throw new Error("واتساب غير متصل — اربط رقمك أولاً");
  const groups = await fetchGroups(sock, uid, true);
  setUserGroups(uid, groups, selected);
  return { groups: userGroups(uid, selected) };
}

export function webCreateRule(uid, payload) {
  uid = String(uid);
  const { sources, destination, sourceNumber, name } = payload || {};
  if (!Array.isArray(sources) || !sources.length) throw new Error("اختر مصدراً واحد��ً على الأقل");
  if (!destination) throw new Error("اختر وجهة");
  const numbers = getConnectedForwardNumbers(uid);
  if (!sourceNumber || !numbers.some((n) => _samePhone(n, sourceNumber))) throw new Error("اختر رقم واتساب تابعاً لك");
  const allItems = [...userGroups(uid, sourceNumber), ...userChannels(uid).filter((c) => !c.phoneNumber || _samePhone(c.phoneNumber, sourceNumber))];
  const allowedIds = new Set(allItems.map((x) => x.id));
  if (sources.some((id) => !allowedIds.has(id)) || !allowedIds.has(destination)) throw new Error("تم رفض مجموعة أو قناة لا تخص رقمك");
  const nm = (id) => allItems.find((x) => x.id === id)?.name || id.split("@")[0];
  const rule = {
    id: randomUUID(),
    name: (name && String(name).trim()) || (sources.map(nm).join(" + ") + " → " + nm(destination)),
    ownerUid: uid,
    sources,
    destination,
    sourceNumber: sourceNumber || null,
    blockLinks: !!payload.blockLinks,
    blockImages: !!payload.blockImages,
    blockVideos: !!payload.blockVideos,
    blockAudios: !!payload.blockAudios,
    noForward: !!payload.noForward,
    enabled: payload.enabled !== false,
    createdAt: new Date().toISOString(),
  };
  const rules = loadRules();
  rules.push(rule);
  saveRules(rules);
  // اشتراك تلقائي في القنوات المصدر
  const sock = _sockForUser(uid);
  if (sock?.subscribeNewsletterUpdates) {
    for (const s of sources) {
      if (s.endsWith("@newsletter")) sock.subscribeNewsletterUpdates(s).catch(() => {});
    }
  }
  return rule;
}

export function webUpdateRule(uid, ruleId, patch) {
  uid = String(uid);
  const rules = loadRules();
  const rule = rules.find((r) => r.id === ruleId && String(r.ownerUid) === uid);
  if (!rule) throw new Error("القاعدة غير موجودة");
  const allowed = ["name", "sources", "destination", "sourceNumber", "blockLinks", "blockImages", "blockVideos", "blockAudios", "noForward", "enabled"];
  for (const k of allowed) {
    if (patch[k] !== undefined) rule[k] = patch[k];
  }
  if (!Array.isArray(rule.sources) || !rule.sources.length) throw new Error("القاعدة تحتاج مصدراً واحداً على الأقل");
  if (!rule.destination) throw new Error("القاعدة تحتاج وجهة");
  saveRules(rules);
  const sock = _sockForUser(uid);
  if (sock?.subscribeNewsletterUpdates) {
    for (const s of rule.sources) {
      if (s.endsWith("@newsletter")) sock.subscribeNewsletterUpdates(s).catch(() => {});
    }
  }
  return rule;
}

export function webDeleteRule(uid, ruleId) {
  uid = String(uid);
  let rules = loadRules();
  const rule = rules.find((r) => r.id === ruleId && String(r.ownerUid) === uid);
  if (!rule) throw new Error("القاعدة غير موجودة");
  rules = rules.filter((r) => r.id !== ruleId);
  saveRules(rules);
  return { removed: true };
}

// صورة مجموعة/قناة محفوظة (للويب آب)
export async function webChatPicture(uid, jid) {
  const sock = _sockForUser(String(uid));
  if (!sock?.profilePictureUrl) return null;
  try { return await sock.profilePictureUrl(jid, "preview"); } catch { return null; }
}
