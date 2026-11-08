
// [SCHED-FIX-V2] العثور على أي سوكت متصل للمستخدم — يدعم مفاتيح الأرقام المتعددة userId_+phone
function _findSock(inMemoryDB, userId) {
  if (!inMemoryDB?.sessions) return null;
  const direct = inMemoryDB.sessions.get(userId) || inMemoryDB.sessions.get(`sess_${userId}`);
  if (direct) return direct;
  for (const [k, v] of inMemoryDB.sessions.entries()) {
    if (String(k).startsWith(`${userId}_`) && v) return v;
  }
  return null;
}

let _deps = {};
export function setDeps(d) { _deps = { ..._deps, ...d }; }

// ─── [SCHED-FIX] معالج النصوص للجدولة (كان مفقوداً تماماً) ───────────────
// الحالات: awaiting_schedule_target → awaiting_schedule_time → awaiting_schedule_message
//          awaiting_recurring_recipient → awaiting_recurring_interval → awaiting_recurring_message
export function isScheduleState(state) {
  return typeof state === "string" && (state.startsWith("awaiting_schedule_") || state.startsWith("awaiting_recurring_"));
}

function _normJid(input) {
  const raw = String(input || "").trim().replace(/[+\s-]/g, "");
  if (!/^\d{6,20}$/.test(raw)) return null;
  // معرّفات المجموعات تبدأ عادة بـ 120 وطولها كبير
  if (raw.startsWith("120") && raw.length >= 15) return `${raw}@g.us`;
  return `${raw}@s.whatsapp.net`;
}

function _parseTime(text) {
  const t = String(text || "").trim();
  // صيغة: بعد X دقيقة/ساعة  مثال: 30m أو 2h أو "30" (دقائق)
  let m = t.match(/^(\d{1,4})\s*([mhdmد سي]?)/i);
  const now = Date.now();
  if (/^\d{1,4}$/.test(t)) return now + parseInt(t, 10) * 60000;
  m = t.match(/^(\d{1,4})\s*(m|min|د|دقيقة|دقائق)$/i);
  if (m) return now + parseInt(m[1], 10) * 60000;
  m = t.match(/^(\d{1,4})\s*(h|hr|س|ساعة|ساعات)$/i);
  if (m) return now + parseInt(m[1], 10) * 3600000;
  // صيغة كاملة: YYYY-MM-DD HH:mm أو DD/MM HH:mm (بتوقيت السعودية UTC+3)
  m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})$/);
  if (m) {
    const ts = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 3, +m[5]);
    return ts > now ? ts : null;
  }
  m = t.match(/^(\d{1,2})\/(\d{1,2})[ ](\d{1,2}):(\d{2})$/);
  if (m) {
    const y = new Date().getFullYear();
    const ts = Date.UTC(y, +m[2] - 1, +m[1], +m[3] - 3, +m[4]);
    return ts > now ? ts : null;
  }
  // صيغة HH:mm فقط → اليوم أو غداً
  m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    const d = new Date();
    let ts = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), +m[1] - 3, +m[2]);
    if (ts <= now) ts += 86400000;
    return ts;
  }
  return null;
}

const _INTERVALS = { "يومي": 86400000, "اسبوعي": 604800000, "أسبوعي": 604800000, "شهري": 2592000000, daily: 86400000, weekly: 604800000, monthly: 2592000000 };

export async function handleScheduleText(bot2, msg) {
  const { getUser, saveUser, setState, clearState, getState, cancelKeyboard, scheduleMenuKeyboard } = _deps;
  if (!getState) return false;
  const userId = String(msg.from?.id || "");
  const chatId = msg.chat.id;
  const st = getState(userId);
  if (!isScheduleState(st.state)) return false;
  const text = String(msg.text || "").trim();
  if (text === "إلغاء" || text === "/cancel") {
    clearState?.(userId);
    await bot2.sendMessage(chatId, "✅ تم الإلغاء.", { reply_markup: scheduleMenuKeyboard?.() });
    return true;
  }
  const data = st.data || {};

  // ── رسالة مجدولة لمرة واحدة ──
  if (st.state === "awaiting_schedule_target") {
    const jid = _normJid(text);
    if (!jid) {
      await bot2.sendMessage(chatId, "❌ رقم غير صالح. أدخل الرقم مع كود الدولة، مثال: `966501234567`", { parse_mode: "Markdown", reply_markup: cancelKeyboard?.() });
      return true;
    }
    setState(userId, "awaiting_schedule_time", { ...data, schedJid: jid });
    await bot2.sendMessage(
      chatId,
      "📅 *الخطوة 2⁄3:* متى تريد الإرسال؟\n\nأمثلة:\n• `30` أو `30m` → بعد 30 دقيقة\n• `2h` → بعد ساعتين\n• `21:30` → اليوم/غداً الساعة 21:30 (توقيت السعودية)\n• `2026-07-15 14:00` → تاريخ محدد",
      { parse_mode: "Markdown", reply_markup: cancelKeyboard?.() }
    );
    return true;
  }
  if (st.state === "awaiting_schedule_time") {
    const ts = _parseTime(text);
    if (!ts) {
      await bot2.sendMessage(chatId, "❌ صيغة وقت غير صالحة. أمثلة: `30m` أو `2h` أو `21:30` أو `2026-07-15 14:00`", { parse_mode: "Markdown", reply_markup: cancelKeyboard?.() });
      return true;
    }
    setState(userId, "awaiting_schedule_message", { ...data, schedAt: ts });
    const date = new Date(ts).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh", hour12: false });
    await bot2.sendMessage(chatId, `📅 *الخطوة 3⁄3:* موعد الإرسال: ${date}\n\nالآن أرسل *نص الرسالة*:`, { parse_mode: "Markdown", reply_markup: cancelKeyboard?.() });
    return true;
  }
  if (st.state === "awaiting_schedule_message") {
    const user = getUser(userId);
    const list = user.scheduledMessages || [];
    const item = {
      id: `sch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      jid: data.schedJid,
      message: text,
      sendAt: data.schedAt,
      status: "pending",
      createdAt: Date.now()
    };
    list.push(item);
    saveUser(userId, { scheduledMessages: list });
    clearState?.(userId);
    const date = new Date(item.sendAt).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh", hour12: false });
    await bot2.sendMessage(chatId, `✅ *تمت الجدولة بنجاح!*\n\n📱 المستلم: +${item.jid.split("@")[0]}\n📅 الموعد: ${date}\n💬 "${text.slice(0, 60)}"`, { parse_mode: "Markdown", reply_markup: scheduleMenuKeyboard?.() });
    return true;
  }

  // ── رسالة متكررة ──
  if (st.state === "awaiting_recurring_recipient") {
    const jid = _normJid(text);
    if (!jid) {
      await bot2.sendMessage(chatId, "❌ رقم غير صالح. أدخل الرقم مع كود الدولة:", { reply_markup: cancelKeyboard?.() });
      return true;
    }
    setState(userId, "awaiting_recurring_interval", { ...data, recJid: jid });
    await bot2.sendMessage(chatId, "🔁 *الخطوة 2⁄4:* اختر التكرار — أرسل: `يومي` أو `اسبوعي` أو `شهري`", { parse_mode: "Markdown", reply_markup: cancelKeyboard?.() });
    return true;
  }
  if (st.state === "awaiting_recurring_interval") {
    const iv = _INTERVALS[text.toLowerCase()] || _INTERVALS[text];
    if (!iv) {
      await bot2.sendMessage(chatId, "❌ اختر: `يومي` أو `اسبوعي` أو `شهري`", { parse_mode: "Markdown", reply_markup: cancelKeyboard?.() });
      return true;
    }
    setState(userId, "awaiting_recurring_time", { ...data, recInterval: iv });
    await bot2.sendMessage(chatId, "🔁 *الخطوة 3⁄4:* متى أول إرسال؟ مثال: `21:30` أو `30m`", { parse_mode: "Markdown", reply_markup: cancelKeyboard?.() });
    return true;
  }
  if (st.state === "awaiting_recurring_time") {
    const ts = _parseTime(text);
    if (!ts) {
      await bot2.sendMessage(chatId, "❌ صيغة وقت غير صالحة. مثال: `21:30` أو `2h`", { parse_mode: "Markdown", reply_markup: cancelKeyboard?.() });
      return true;
    }
    setState(userId, "awaiting_recurring_message", { ...data, recAt: ts });
    await bot2.sendMessage(chatId, "🔁 *الخطوة 4⁄4:* أرسل *نص الرسالة* المتكررة:", { parse_mode: "Markdown", reply_markup: cancelKeyboard?.() });
    return true;
  }
  if (st.state === "awaiting_recurring_message") {
    const user = getUser(userId);
    const list = user.scheduledMessages || [];
    const item = {
      id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      jid: data.recJid,
      message: text,
      sendAt: data.recAt,
      recurring: data.recInterval,
      status: "pending",
      createdAt: Date.now()
    };
    list.push(item);
    saveUser(userId, { scheduledMessages: list });
    clearState?.(userId);
    const date = new Date(item.sendAt).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh", hour12: false });
    await bot2.sendMessage(chatId, `✅ *تم إنشاء الرسالة المتكررة!*\n\n📱 المستلم: +${item.jid.split("@")[0]}\n📅 أول إرسال: ${date}`, { parse_mode: "Markdown", reply_markup: scheduleMenuKeyboard?.() });
    return true;
  }
  return false;
}

// ─── [SCHED-FIX] حلقة الإرسال الفعلية (كانت مفقودة تماماً) ────────────────
let _loopTimer = null;
export function startScheduleLoop(bot2) {
  if (_loopTimer) return;
  _loopTimer = setInterval(async () => {
    try {
      const { getAllUsers, getUser, saveUser, inMemoryDB } = _deps;
      if (!getAllUsers || !inMemoryDB) return;
      const now = Date.now();
      const users = getAllUsers() || {};
      for (const userId of Object.keys(users)) {
        const user = getUser(userId);
        const list = user.scheduledMessages || [];
        let changed = false;
        for (const m of list) {
          if (m.status !== "pending") continue;
          const ts = typeof m.sendAt === "number" ? m.sendAt : new Date(m.sendAt).getTime();
          if (!ts || ts > now) continue;
          const sock = _findSock(inMemoryDB, userId);
          if (!sock) {
            // لا يوجد اتصال واتساب — أجّل 5 دقائق بدل الفشل النهائي
            if (!m._retries) m._retries = 0;
            m._retries++;
            if (m._retries > 12) { m.status = "failed"; m.error = "لا يوجد اتصال واتساب"; }
            else m.sendAt = now + 300000;
            changed = true;
            continue;
          }
          try {
            await sock.sendMessage(m.jid, { text: m.message });
            if (m.recurring) {
              m.sendAt = ts + m.recurring;
              m.lastSentAt = now;
            } else {
              m.status = "sent";
              m.sentAt = now;
            }
            changed = true;
            try {
              if (user.telegramChatId) {
                await bot2.sendMessage(user.telegramChatId, `✅ تم إرسال رسالتك المجدولة إلى +${(m.jid || "").split("@")[0]}`);
              }
            } catch {}
          } catch (e) {
            m.status = "failed";
            m.error = String(e?.message || e).slice(0, 100);
            changed = true;
          }
        }
        if (changed) saveUser(userId, { scheduledMessages: list });
      }
    } catch {}
  }, 30000);
}

export async function handleScheduleCallback(bot2, chatId, userId, data) {
  const { getUser, saveUser, setState, inMemoryDB, cancelKeyboard, scheduleMenuKeyboard } = _deps;
  const user = getUser(userId);
  const scheduled = user.scheduledMessages || [];
  if (data === "menu_schedule") {
    const active = scheduled.filter((m) => m.status === "pending").length;
    const sent = scheduled.filter((m) => m.status === "sent").length;
    await bot2.sendMessage(
      chatId,
      `\u{1F4C5} *\u0627\u0644\u0631\u0633\u0627\u0626\u0644 \u0627\u0644\u0645\u062C\u062F\u0648\u0644\u0629*\n\n\u23F3 \u0641\u064A \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631: ${active}\n\u2705 \u062A\u0645 \u0625\u0631\u0633\u0627\u0644\u0647\u0627: ${sent}\n\u{1F4CB} \u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A: ${scheduled.length}`,
      { parse_mode: "Markdown", reply_markup: scheduleMenuKeyboard() }
    );
    return true;
  }
  if (data === "schedule_add") {
    const sock = _findSock(inMemoryDB, userId);
    if (!sock) {
      await bot2.sendMessage(chatId, "\u274C \u064A\u062C\u0628 \u0631\u0628\u0637 \u0648\u0627\u062A\u0633\u0627\u0628 \u0623\u0648\u0644\u0627\u064B \u0644\u062C\u062F\u0648\u0644\u0629 \u0631\u0633\u0627\u0626\u0644");
      return true;
    }
    setState(userId, "awaiting_schedule_target");
    await bot2.sendMessage(
      chatId,
      `\uD83D\uDCC5 *\u062C\u062F\u0648\u0644\u0629 \u0631\u0633\u0627\u0644\u0629 \u062C\u062F\u064A\u062F\u0629*\n\n*\u0627\u0644\u062E\u0637\u0648\u0629 1\u20443:* \u0623\u062F\u062E\u0644 \u0631\u0642\u0645 \u0627\u0644\u0645\u0633\u062A\u0644\u0645 \u0645\u0639 \u0643\u0648\u062F \u0627\u0644\u062F\u0648\u0644\u0629:\n\u0645\u062B\u0627\u0644: \`966501234567\`\n\n\u0623\u0648 \u0623\u062F\u062E\u0644 \u0645\u0639\u0631\u0651\u0641 \u0645\u062C\u0645\u0648\u0639\u0629 (120365...):`,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return true;
  }
  if (data === "schedule_list") {
    if (scheduled.length === 0) {
      await bot2.sendMessage(chatId, "\u{1F4CB} \u0644\u0627 \u062A\u0648\u062C\u062F \u0631\u0633\u0627\u0626\u0644 \u0645\u062C\u062F\u0648\u0644\u0629 \u0628\u0639\u062F.", { reply_markup: scheduleMenuKeyboard() });
      return true;
    }
    const lines = scheduled.slice(-10).reverse().map((m, i) => {
      const ts2 = typeof m.sendAt === 'number' ? m.sendAt : new Date(m.sendAt).getTime();
      const date = new Date(ts2).toLocaleString("ar-SA", {timeZone:"Asia/Riyadh", hour12:false, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit"});
      const status = m.status === "sent" ? "\u2705" : m.status === "failed" ? "\u274C" : "\u23F3";
      const remaining = ts2 > Date.now() ? ` (${Math.ceil((ts2-Date.now())/60000)}\u062F)` : "";
      return `${status} ${i + 1}. +${(m.jid || "").split("@")[0]}\n   \uD83D\uDCC5 ${date}${remaining}\n   \uD83D\uDCAC "${(m.message || "").slice(0, 40)}"`;
    }).join("\n\n");
    const pendingCount = scheduled.filter((m) => m.status === "pending").length;
    await bot2.sendMessage(
      chatId,
      `\uD83D\uDCCB *\u0631\u0633\u0627\u0626\u0644 \u0645\u062C\u062F\u0648\u0644\u0629*\n\u23F3 \u0641\u064A \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631: *${pendingCount}* | \uD83D\uDCCA \u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A: *${scheduled.length}*\n\u23F0 \u0627\u0644\u062A\u0648\u0642\u064A\u062A: \u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629 (UTC+3)\n\n${lines}`,
      { parse_mode: "Markdown", reply_markup: scheduleMenuKeyboard() }
    );
    return true;
  }
  if (data === "schedule_delete") {
    const pending = scheduled.filter((m) => m.status === "pending");
    if (pending.length === 0) {
      await bot2.sendMessage(chatId, "\u274C \u0644\u0627 \u062A\u0648\u062C\u062F \u0631\u0633\u0627\u0626\u0644 \u0641\u064A \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631");
      return true;
    }
    const rows = pending.slice(0, 8).map((m, i) => {
      const ts3 = typeof m.sendAt === 'number' ? m.sendAt : new Date(m.sendAt).getTime();
      const date = new Date(ts3).toLocaleString("ar-SA", {timeZone:"Asia/Riyadh", hour12:false, month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit"});
      return [{ text: `\uD83D\uDDD1\uFE0F +${(m.jid || "").split("@")[0]} \u2190 ${date}`, callback_data: `schedule_del_${m.id}` }];
    });
    rows.push([{ text: "\u{1F5D1}\uFE0F \u062D\u0630\u0641 \u0627\u0644\u0643\u0644", callback_data: "schedule_del_all" }]);
    rows.push([{ text: "\u{1F519} \u0631\u062C\u0648\u0639", callback_data: "menu_schedule" }]);
    await bot2.sendMessage(chatId, "\u{1F5D1}\uFE0F *\u0627\u062E\u062A\u0631 \u0631\u0633\u0627\u0644\u0629 \u0644\u062D\u0630\u0641\u0647\u0627:*", { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } });
    return true;
  }
  if (data.startsWith("schedule_del_")) {
    if (data === "schedule_del_all") {
      saveUser(userId, { scheduledMessages: scheduled.filter((m) => m.status !== "pending") });
      await bot2.sendMessage(chatId, "\u2705 \u062A\u0645 \u062D\u0630\u0641 \u062C\u0645\u064A\u0639 \u0627\u0644\u0631\u0633\u0627\u0626\u0644 \u0641\u064A \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631");
    } else {
      const id = data.replace("schedule_del_", "");
      saveUser(userId, { scheduledMessages: scheduled.filter((m) => m.id !== id) });
      await bot2.sendMessage(chatId, "\u2705 \u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0631\u0633\u0627\u0644\u0629");
    }
    return true;
  }
  if (data === "schedule_stats") {
    const sent = scheduled.filter((m) => m.status === "sent").length;
    const pending = scheduled.filter((m) => m.status === "pending").length;
    const failed = scheduled.filter((m) => m.status === "failed").length;
    await bot2.sendMessage(
      chatId,
      `\u{1F4CA} *\u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A \u0627\u0644\u062C\u062F\u0648\u0644\u0629*\n\n\u2705 \u0645\u064F\u0631\u0633\u064E\u0644\u0629: ${sent}\n\u23F3 \u0641\u064A \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631: ${pending}\n\u274C \u0641\u0634\u0644\u062A: ${failed}\n\u{1F4CB} \u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A: ${scheduled.length}`,
      { parse_mode: "Markdown", reply_markup: scheduleMenuKeyboard() }
    );
    return true;
  }
  if (data === "schedule_recurring") {
    setState(userId, "awaiting_recurring_recipient");
    await bot2.sendMessage(
      chatId,
      `\u{1F501} *\u0631\u0633\u0627\u0626\u0644 \u0645\u062A\u0643\u0631\u0631\u0629*\n\n\u064A\u0645\u0643\u0646\u0643 \u0625\u0631\u0633\u0627\u0644 \u0631\u0633\u0627\u0644\u0629 \u0643\u0644 \u064A\u0648\u0645 \u0623\u0648 \u0623\u0633\u0628\u0648\u0639 \u0623\u0648 \u0634\u0647\u0631.\n\n*\u0627\u0644\u062E\u0637\u0648\u0629 1/4:* \u0623\u062F\u062E\u0644 \u0631\u0642\u0645 \u0627\u0644\u0645\u0633\u062A\u0644\u0645:`,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return true;
  }
  return false;
}
