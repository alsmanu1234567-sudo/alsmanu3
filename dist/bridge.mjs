// dist/bridge.mjs — الجسر الذكي مع دعم متعدد الأرقام
let _deps = {};
export function setDeps(d) { _deps = d; }

// ── تتبع الرقم المختار لكل مستخدم في جلسة الجسر ─────────────────────────
const _bridgeNumSel = new Map(); // Map<userId, sessionKey>

/**
 * يُستدعى من خارج الوحدة (index.mjs) عند فصل رقم أو تسجيل الخروج
 * لتنظيف الاختيار القديم وتجنب السوكت الخاطئ
 */
export function clearBridgeSelection(userId) {
  _bridgeNumSel.delete(userId);
}

// ── جلب السوكت المناسب (المختار أو الافتراضي) ────────────────────────────
function _getBridgeSock(userId) {
  const { inMemoryDB } = _deps;
  const selectedKey = _bridgeNumSel.get(userId);
  if (selectedKey) {
    const s = inMemoryDB.sessions.get(selectedKey);
    if (s) return s;
  }
  return inMemoryDB.sessions.get(userId);
}

// ── جمع كل مفاتيح الجلسات المرتبطة بالمستخدم ────────────────────────────
function _getAllUserSessionKeys(userId) {
  const { inMemoryDB } = _deps;
  const keys = [];
  for (const [k] of inMemoryDB.sessions) {
    if (k === userId || k.startsWith(userId + '_+') || k.startsWith(userId + '+')) {
      keys.push(k);
    }
  }
  return keys;
}

// ── تسمية المفتاح بشكل مفهوم ──────────────────────────────────────────────
function _keyLabel(userId, key, nums) {
  if (key === userId) {
    const main = nums.find(n => !n.sessionId || n.sessionId === userId);
    return main ? (main.label || main.number || 'الرقم الرئيسي') : 'الرقم الرئيسي';
  }
  const found = nums.find(n => n.sessionId === key || (key.includes('_+') && key.endsWith(n.number)));
  if (found) return found.label || found.number;
  if (key.includes('_+')) return '+' + key.split('_+')[1];
  return key;
}

export async function handleBridgeCallback(bot2, chatId, userId, data) {
  const {
    getUser, saveUser, setState, inMemoryDB,
    cancelKeyboard, bridgeMenuKeyboard, getBridgeRelays, getCustomContactList,
  } = _deps;

  // ── menu_bridge: إذا أكثر من رقم نعرض قائمة اختيار ──────────────────────
  if (data === "menu_bridge") {
    const allKeys = _getAllUserSessionKeys(userId);
    const user = getUser(userId);
    const nums = user.whatsappNumbers || [];

    if (allKeys.length > 1) {
      // أكثر من رقم مرتبط — أظهر قائمة اختيار
      const rows = allKeys.map((k) => {
        const sock2 = inMemoryDB.sessions.get(k);
        const connected = sock2 ? '🟢' : '🔴';
        const label = _keyLabel(userId, k, nums);
        const isSel = _bridgeNumSel.get(userId) === k;
        return [{ text: `${connected}${isSel ? ' ✅' : ''} ${label}`, callback_data: `bridge_sel_num_${k}` }];
      });
      rows.push([{ text: '🏠 الرئيسية', callback_data: 'home' }]);
      await bot2.sendMessage(
        chatId,
        `🌉 *الجسر الذكي*\n\nلديك أكثر من رقم مرتبط.\nاختر الرقم الذي تريد العمل عليه:`,
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: rows } }
      );
      return true;
    }

    // رقم واحد — ضع المفتاح الافتراضي واعرض قائمة الجسر مباشرة
    if (allKeys.length === 1) _bridgeNumSel.set(userId, allKeys[0]);
    return await _showBridgeMenu(bot2, chatId, userId);
  }

  // ── bridge_sel_num_: اختيار رقم محدد (مع التحقق من الملكية) ──────────────
  if (data.startsWith('bridge_sel_num_')) {
    const sessionKey = data.replace('bridge_sel_num_', '');
    // [SECURITY] التحقق أن المفتاح فعلاً يخص هذا المستخدم قبل قبوله
    const validKeys = _getAllUserSessionKeys(userId);
    if (!validKeys.includes(sessionKey)) {
      await bot2.sendMessage(chatId, '⚠️ رقم غير صالح أو منتهي — يرجى الرجوع وإعادة المحاولة.',
        { reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'menu_bridge' }]] } });
      return true;
    }
    _bridgeNumSel.set(userId, sessionKey);
    return await _showBridgeMenu(bot2, chatId, userId);
  }

  const sock = _getBridgeSock(userId);
  const user = getUser(userId);

  if (data === "bridge_broadcast") {
    if (!sock) {
      await bot2.sendMessage(chatId, "❌ ربط واتساب أولاً");
      return true;
    }
    setState(userId, "awaiting_bridge_msg", { type: "broadcast" });
    await bot2.sendMessage(
      chatId,
      `📢 *الإرسال الجماعي الذكي*\n\n✅ سيُرسَل للمجموعات وجهات الاتصال في آنٍ واحد.\n\n*الخطوة 1:* اكتب الرسالة (يمكن استخدام {name}):`,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return true;
  }

  if (data === "bridge_copy_members") {
    if (!sock) {
      await bot2.sendMessage(chatId, "❌ ربط واتساب أولاً");
      return true;
    }
    let groups = inMemoryDB.groupsCache.get(userId) || [];
    if (groups.length === 0) {
      try {
        const c = await sock.groupFetchAllParticipating?.();
        groups = c ? Object.values(c) : [];
        inMemoryDB.groupsCache.set(userId, groups);
      } catch {}
    }
    if (groups.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد مجموعات");
      return true;
    }
    setState(userId, "awaiting_group_select_for_action", { bridgeAction: "copy_members" });
    const kb = {
      inline_keyboard: [
        ...groups.slice(0, 10).map((g) => [{
          text: `👥 ${(g.subject || g.id).slice(0, 30)}`,
          callback_data: `bridge_selgrp_${g.id}`,
        }]),
        [{ text: "❌ إلغاء", callback_data: "cancel" }],
      ],
    };
    await bot2.sendMessage(chatId, "👥 اختر المجموعة لنسخ أعضائها:", { reply_markup: kb });
    return true;
  }

  if (data.startsWith("bridge_selgrp_")) {
    const groupId = data.replace("bridge_selgrp_", "");
    const groups = inMemoryDB.groupsCache.get(userId) || [];
    const group = groups.find((g) => g.id === groupId);
    const members = (group?.participants || []).map((p) => p.id?.split("@")[0]).filter(Boolean);
    await bot2.sendMessage(
      chatId,
      `✅ *تم نسخ أعضاء المجموعة!*\n\n👥 ${group?.subject || groupId}\n👤 الأعضاء: ${members.length}`,
      { parse_mode: "Markdown", reply_markup: bridgeMenuKeyboard() }
    );
    return true;
  }

  if (data === "bridge_sync") {
    await bot2.sendMessage(
      chatId,
      `🔄 *مزامنة الرسائل بين مجموعتين*\n\nستُعاد كل رسالة في المجموعة الأولى للمجموعة الثانية تلقائياً.\n\n⚙️ الميزة متاحة للإعداد:`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔄 إعداد Relay مجموعة↔مجموعة", callback_data: "bridge_relay_gg" }],
            [{ text: "🔙 رجوع", callback_data: "menu_bridge" }],
          ],
        },
      }
    );
    return true;
  }

  if (data === "bridge_relay_gg") {
    setState(userId, "awaiting_bridge_relay_gg_src");
    await bot2.sendMessage(
      chatId,
      `🔄 *ترحيل مجموعة ↔ مجموعة*\n\n*الخطوة 1/2:* أدخل معرّف مجموعة المصدر:`,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return true;
  }

  if (data === "bridge_relay_gp") {
    if (!sock) { await bot2.sendMessage(chatId, "❌ ربط واتساب أولاً"); return true; }
    setState(userId, "awaiting_bridge_relay_gp_src");
    await bot2.sendMessage(chatId, `👥→💬 *توجيه مجموعة → أشخاص*\n\n*الخطوة 1/2:* أدخل معرّف المجموعة المصدر:`, { parse_mode: "Markdown", reply_markup: cancelKeyboard() });
    return true;
  }

  if (data === "bridge_relay_pg") {
    if (!sock) { await bot2.sendMessage(chatId, "❌ ربط واتساب أولاً"); return true; }
    setState(userId, "awaiting_bridge_relay_pg_src");
    await bot2.sendMessage(chatId, `💬→👥 *توجيه شخص → مجموعة*\n\n*الخطوة 1/2:* أدخل رقم الشخص المصدر:`, { parse_mode: "Markdown", reply_markup: cancelKeyboard() });
    return true;
  }

  if (data === "bridge_active_members") {
    if (!sock) { await bot2.sendMessage(chatId, "❌ ربط واتساب أولاً"); return true; }
    setState(userId, "awaiting_bridge_active_group");
    await bot2.sendMessage(chatId, `⚡ *استخراج الأعضاء النشطين*\n\nيستخرج الأعضاء الذين أرسلوا رسائل آخر 7 أيام.\n\nأدخل معرّف المجموعة:`, { parse_mode: "Markdown", reply_markup: cancelKeyboard() });
    return true;
  }

  if (data === "bridge_notify_join") {
    const current = user.bridgeNotifyJoin ?? false;
    saveUser(userId, { bridgeNotifyJoin: !current });
    await bot2.sendMessage(chatId, `✅ تنبيه الانضمام/المغادرة: ${!current ? "مفعّل ✅" : "معطّل ❌"}`, { reply_markup: bridgeMenuKeyboard() });
    return true;
  }

  if (data === "bridge_compare_groups") {
    if (!sock) { await bot2.sendMessage(chatId, "❌ ربط واتساب أولاً"); return true; }
    setState(userId, "awaiting_bridge_compare_g1");
    await bot2.sendMessage(chatId, `📊 *مقارنة أعضاء مجموعتين*\n\n*الخطوة 1/2:* أدخل معرّف المجموعة الأولى:`, { parse_mode: "Markdown", reply_markup: cancelKeyboard() });
    return true;
  }

  if (data === "bridge_custom_list") {
    const customList = getCustomContactList(userId);
    const kb = {
      inline_keyboard: [
        [{ text: "➕ إضافة رقم", callback_data: "bridge_custom_add" }],
        [{ text: "📢 إرسال للقائمة", callback_data: "bridge_custom_send" }],
        [{ text: `📋 القائمة (${customList.length} رقم)`, callback_data: "bridge_custom_view" }],
        [{ text: "🗑️ مسح القائمة", callback_data: "bridge_custom_clear" }],
        [{ text: "🔙 رجوع", callback_data: "menu_bridge" }],
      ],
    };
    const nums2 = customList.slice(0, 5).map((c) => `• ${c.label || c.number}`).join("\n");
    await bot2.sendMessage(chatId, `📋 *القائمة المخصصة*\n\nأرقام: ${customList.length}\n${nums2 || "القائمة فارغة"}`, { parse_mode: "Markdown", reply_markup: kb });
    return true;
  }

  if (data === "bridge_custom_add") {
    setState(userId, "awaiting_custom_contact_num");
    await bot2.sendMessage(chatId, "➕ أدخل الرقم:\nمثال: `249960506662`", { parse_mode: "Markdown", reply_markup: cancelKeyboard() });
    return true;
  }

  if (data === "bridge_custom_send") {
    const customList = getCustomContactList(userId);
    if (!sock) { await bot2.sendMessage(chatId, "❌ ربط واتساب أولاً"); return true; }
    if (customList.length === 0) { await bot2.sendMessage(chatId, "❌ القائمة فارغة"); return true; }
    setState(userId, "awaiting_custom_list_msg");
    await bot2.sendMessage(chatId, `📢 سيُرسَل لـ ${customList.length} رقم.\n\naكتب الرسالة:`, { reply_markup: cancelKeyboard() });
    return true;
  }

  if (data === "bridge_custom_view") {
    const customList = getCustomContactList(userId);
    if (customList.length === 0) { await bot2.sendMessage(chatId, "❌ القائمة فارغة"); return true; }
    const text = customList.map((c, i) => `${i + 1}. ${c.label || c.number} (+${c.number})`).join("\n");
    await bot2.sendMessage(chatId, `📋 *القائمة المخصصة:*\n\n${text}`, { parse_mode: "Markdown" });
    return true;
  }

  if (data === "bridge_custom_clear") {
    inMemoryDB.customContactLists.set(userId, []);
    await bot2.sendMessage(chatId, "✅ تم مسح القائمة.");
    return true;
  }

  if (data === "bridge_delayed_bulk") {
    if (!sock) { await bot2.sendMessage(chatId, "❌ ربط واتساب أولاً"); return true; }
    setState(userId, "awaiting_delayed_bulk_msg");
    await bot2.sendMessage(chatId, `⏱️ *إرسال جماعي بتأخير ذكي*\n\n✅ يضيف تأخيراً عشوائياً 2-5 ثوانٍ بين كل رسالة\n\nاكتب الرسالة:`, { parse_mode: "Markdown", reply_markup: cancelKeyboard() });
    return true;
  }

  if (data === "bridge_stats_bulk" || data === "bridge_stats") {
    const relays = getBridgeRelays(userId);
    const customList = getCustomContactList(userId);
    const stats = user.bulkStats || { sent: 0, failed: 0, total: 0 };
    await bot2.sendMessage(
      chatId,
      `📊 *إحصائيات الجسر*\n\n🔄 Relays نشطة: ${relays.filter((r) => r.active).length}\n📋 قائمة مخصصة: ${customList.length} رقم\n📤 إرسال ناجح: ${stats.sent}\n❌ فشل: ${stats.failed}\n✅ معدل النجاح: ${stats.total ? Math.round(stats.sent / stats.total * 100) : 0}%`,
      { parse_mode: "Markdown", reply_markup: bridgeMenuKeyboard() }
    );
    return true;
  }

  return false;
}

// ── عرض قائمة الجسر الرئيسية ─────────────────────────────────────────────
async function _showBridgeMenu(bot2, chatId, userId) {
  const { getUser, bridgeMenuKeyboard, getBridgeRelays, getCustomContactList } = _deps;
  const relays = getBridgeRelays(userId);
  const customList = getCustomContactList(userId);
  const user = getUser(userId);

  const selectedKey = _bridgeNumSel.get(userId);
  const numLabel = selectedKey && selectedKey !== userId
    ? (' — ' + (selectedKey.includes('_+') ? '+' + selectedKey.split('_+')[1] : selectedKey))
    : '';

  await bot2.sendMessage(
    chatId,
    `🌉 *الجسر الذكي${numLabel}*\n\n🔄 Relays نشطة: ${relays.filter((r) => r.active).length}\n📋 قائمة مخصصة: ${customList.length} رقم\n🔔 تنبيه الانضمام: ${user.bridgeNotifyJoin ? "✅" : "❌"}`,
    { parse_mode: "Markdown", reply_markup: bridgeMenuKeyboard() }
  );
  return true;
}
