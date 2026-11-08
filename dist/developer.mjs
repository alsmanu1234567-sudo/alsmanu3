// PATCH_MASTER_FIX_APPLIED
// dist/developer.mjs — وحدة المطور الكاملة | نمط setDeps
// ──────────────────────────────────────────────────────────────────────────────

let _deps = {};
export function setDeps(d) { _deps = d; }

// [FIX-GRANT-FEATURE] جدول الحد الأقصى للأرقام لكل فئة — يُستخدم عند منح الفئة
const _TIER_MAX_NUMS = { free: 1, pro: 10, promax: 20, khariq: 50, khariqpro: 100, mizaj: 999999 };

// ── الأزرار المساعدة ──────────────────────────────────────────────────────────
function backToDevPanel() {
  return [{ text: "🔙 لوحة التحكم", callback_data: "dev_panel" }];
}
function backToGodMode() {
  return [{ text: "🎭 العودة لـ GOD MODE", callback_data: "dev_godmode" }];
}
function backToUserProfile(userId) {
  return [{ text: "👤 العودة للملف", callback_data: `devuser_${userId}` }];
}

// ── ترجمة bulk_* إلى الصيغة المتوقعة في handleBulkPoints ────────────────────
const BULK_CATS = new Set(["all","pro","promax","khariq","khariqpro","mizaj","active","new"]);
function translateBulkData(data) {
  if (data === "bulk_confirm") return data;
  const cat = data.replace(/^bulk_/, "");
  return BULK_CATS.has(cat) ? `bulk_cat_${cat}` : null;
}

// ══════════════════════════════════════════════════════════════════════════════
// 1 — handleDevCallback — الموزّع الرئيسي
// ══════════════════════════════════════════════════════════════════════════════
export async function handleDevCallback(bot2, chatId, userId, data) {
  const {
    DEVELOPER_ID, inMemoryDB, getUser, saveUser, getAllUsers, addPoints,
    setState, getState, clearState, workerManager,
    cancelKeyboard, bulkPointsKeyboard, devEconomyKeyboard,
    devMenuKeyboard, devUsersKeyboard, devUserActionKeyboard, godModeKeyboard,
    TIER_COSTS, TIER_NAMES, getDynamicPrice, handleBulkPoints,
  } = _deps;

  // ── حماية: مطور فقط ────────────────────────────────────────────────────────
  if (userId !== DEVELOPER_ID) {
    await bot2.sendMessage(chatId, "❌ غير مصرح");
    return true;
  }

  // ── المجموعة 1: عرض الإحصاءات والنظام ─────────────────────────────────────
  if (data === "dev_stats") {
    await sendDevStats2(bot2, chatId, userId);
    return true;
  }
  if (data === "dev_users") {
    await sendDevUsers2(bot2, chatId, userId, 0);
    return true;
  }
  // [FIX-USERS-PAGINATION] التنقل بين صفحات المستخدمين
  if (data.startsWith("dev_users_p")) {
    const page = parseInt(data.slice("dev_users_p".length)) || 0;
    await sendDevUsers2(bot2, chatId, userId, page);
    return true;
  }
  // [FIX-USERS-SEARCH] البحث عن مستخدم بالـ ID
  if (data === "dev_users_search") {
    setState(userId, "awaiting_dev_user_search");
    await bot2.sendMessage(
      chatId,
      `🔍 *البحث عن مستخدم*\n\nأدخل Telegram ID الخاص بالمستخدم:`,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return true;
  }
  if (data === "dev_errors") {
    await sendDevErrors2(bot2, chatId, userId);
    return true;
  }
  if (data === "dev_daily_report") {
    await handleDevDailyReport(bot2, chatId, userId);
    return true;
  }

  // ── المجموعة 2: تحكم النظام ─────────────────────────────────────────────────
  if (data === "dev_restart") {
    const workers = workerManager.getAllWorkers();
    let stopped = 0;
    for (const w of workers) {
      try { workerManager.stopWorker(w.userId); stopped++; } catch {}
    }
    await bot2.sendMessage(
      chatId,
      `🔄 *إعادة تشغيل Workers*\n\n✅ تم إيقاف ${stopped} Worker.\nسيُعاد تشغيلها تلقائياً.`,
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: [backToDevPanel()] } }
    );
    return true;
  }
  if (data === "dev_maintenance") {
    const current = inMemoryDB.maintenanceMode || false;
    inMemoryDB.maintenanceMode = !current;
    const status = !current ? "✅ مُفعَّل" : "❌ مُعطَّل";
    await bot2.sendMessage(
      chatId,
      `🔧 *وضع الصيانة*\n\nالحالة: ${status}\n\n${!current ? "⚠️ لن يتمكن المستخدمون من استخدام البوت الآن." : "✅ البوت يعمل بشكل طبيعي الآن."}`,
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: [backToDevPanel()] } }
    );
    return true;
  }
  if (data === "dev_monitor") {
    const workers = workerManager.getAllWorkers();
    const lines = workers.slice(0, 25).map(w =>
      `${w.status === "running" ? "🟢" : "🔴"} \`${String(w.userId).slice(-6)}\` | ${w.status} | WA:${w.whatsappConnected ? "✅" : "❌"}`
    );
    const msg = lines.length
      ? lines.join("\n")
      : "لا يوجد Workers نشطة";
    await bot2.sendMessage(
      chatId,
      `👁️ *Workers Live (${workers.length}):*\n\n${msg}`,
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: [backToDevPanel()] } }
    );
    return true;
  }
  if (data === "dev_remote") {
    const mem = process.memoryUsage();
    const upSec = process.uptime();
    const hrs = Math.floor(upSec / 3600);
    const mins = Math.floor((upSec % 3600) / 60);
    await bot2.sendMessage(
      chatId,
      `📡 *تحكم عن بُعد — نظرة عامة*\n\n💾 RSS: ${Math.round(mem.rss / 1024 / 1024)} MB\n📊 Heap: ${Math.round(mem.heapUsed / 1024 / 1024)} MB\n🏗️ External: ${Math.round(mem.external / 1024 / 1024)} MB\n⏱️ Uptime: ${hrs}h ${mins}m\n🖥️ Node: ${process.version}\n⚙️ PID: ${process.pid}\n📦 Platform: ${process.platform}`,
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: [backToDevPanel()] } }
    );
    return true;
  }

  // ── المجموعة 3: الاقتصاد والنقاط ──────────────────────────────────────────
  if (data === "dev_points") {
    await bot2.sendMessage(
      chatId,
      "💎 *إرسال نقاط جماعي*\n\nاختر الفئة المستهدفة:",
      { parse_mode: "Markdown", reply_markup: bulkPointsKeyboard() }
    );
    return true;
  }
  if (data === "dev_economy") {
    const lines = Object.entries(TIER_COSTS).map(([k, v]) => {
      const dyn = getDynamicPrice ? getDynamicPrice(`tier_${k}`, v) : v;
      const diff = dyn !== v ? ` ✏️ (أصلي: ${v.toLocaleString()})` : "";
      return `• *${TIER_NAMES[k] || k}*: ${dyn.toLocaleString()} نقطة${diff}`;
    }).join("\n");
    await bot2.sendMessage(
      chatId,
      `💰 *التحكم الاقتصادي — الأسعار الحالية*\n\n${lines}\n\nاختر فئة لتعديل سعرها:`,
      { parse_mode: "Markdown", reply_markup: devEconomyKeyboard() }
    );
    return true;
  }
  if (data.startsWith("devecon_")) {
    const tierKey = data.replace("devecon_", "");
    const currentPrice = getDynamicPrice
      ? getDynamicPrice(`tier_${tierKey}`, TIER_COSTS[tierKey] || 0)
      : (TIER_COSTS[tierKey] || 0);
    setState(userId, "awaiting_devecon_price", { tierKey, currentPrice });
    await bot2.sendMessage(
      chatId,
      `💰 *تعديل سعر ${TIER_NAMES[tierKey] || tierKey}*\n\nالسعر الحالي: \`${currentPrice.toLocaleString()}\` نقطة\n\nأدخل السعر الجديد (0 = إعادة للسعر الأصلي):`,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return true;
  }

  // ── تغيير توكن البوت ────────────────────────────────────────────────────
  if (data === "dev_token") {
    const currentToken = process.env.TELEGRAM_BOT_TOKEN || "(غير محدد)";
    const masked = currentToken.length > 10
      ? currentToken.slice(0, 8) + "•".repeat(Math.max(0, currentToken.length - 12)) + currentToken.slice(-4)
      : "•".repeat(currentToken.length);
    await bot2.sendMessage(chatId,
      `🔑 *تغيير توكن البوت*\n\n` +
      `التوكن الحالي: \`${masked}\`\n\n` +
      `⚠️ *تحذير:* تغيير التوكن يستلزم إعادة تشغيل البوت.\n` +
      `بعد الحفظ سيُعاد التشغيل تلقائياً في غضون ثوانٍ.\n\n` +
      `أرسل التوكن الجديد (يبدأ بأرقام ثم :AAH أو مشابه):`,
      {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: "❌ إلغاء", callback_data: "dev_panel" }]] }
      }
    );
    setState(userId, "awaiting_telegram_token");
    return true;
  }

  // ── المجموعة 4: إرسال جماعي ───────────────────────────────────────────────
  if (data === "dev_broadcast") {
    setState(userId, "awaiting_broadcast_message");
    await bot2.sendMessage(
      chatId,
      `📢 *إرسال للجميع*\n\nاكتب الرسالة — ستُرسَل لكل مستخدمي البوت:\n_(يمكن استخدام Markdown)_`,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return true;
  }

  // ── المجموعة 5: GOD MODE ──────────────────────────────────────────────────
  if (data === "dev_godmode") {
    await _showGodMode(bot2, chatId, inMemoryDB, workerManager, godModeKeyboard, getAllUsers);
    return true;
  }
  if (data === "god_list_users") {
    await handleGodListUsers(bot2, chatId, userId);
    return true;
  }
  if (data === "god_add_pts") {
    setState(userId, "awaiting_god_add_pts");
    await bot2.sendMessage(
      chatId,
      `💎 *إضافة نقاط لحساب*\n\nأدخل: \`ID الكمية\`\nمثال: \`123456789 5000\``,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return true;
  }
  if (data === "god_upgrade") {
    setState(userId, "awaiting_god_upgrade");
    const tierList = Object.keys(TIER_NAMES || {}).join(" | ") || "free | pro | promax | khariq | khariqpro | mizaj";
    await bot2.sendMessage(
      chatId,
      `🔝 *ترقية حساب*\n\nأدخل: \`ID الفئة\`\nمثال: \`123456789 mizaj\`\n\nالفئات المتاحة: ${tierList}`,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return true;
  }
  if (data === "god_ban") {
    setState(userId, "awaiting_god_ban");
    await bot2.sendMessage(
      chatId,
      `🚫 *حظر / فك حظر مستخدم*\n\nأدخل: \`ID الإجراء\`\nمثال: \`123456789 ban\` أو \`123456789 unban\``,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return true;
  }
  if (data === "god_user_detail") {
    setState(userId, "awaiting_god_user_detail");
    await bot2.sendMessage(
      chatId,
      "🔍 *تفاصيل مستخدم*\n\nأدخل ID التيليغرام:",
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return true;
  }
  if (data === "god_msg_user") {
    setState(userId, "awaiting_god_msg_user_id");
    await bot2.sendMessage(
      chatId,
      `💬 *إرسال رسالة لمستخدم*\n\nأدخل: \`ID الرسالة\`\nمثال: \`123456789 مرحباً يا صديقي\``,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return true;
  }
  if (data === "god_delete_user") {
    setState(userId, "awaiting_god_delete_user");
    await bot2.sendMessage(
      chatId,
      `🗑️ *حذف مستخدم نهائياً*\n\n⚠️ لا يمكن التراجع عن هذا الإجراء!\n\nأدخل ID التيليغرام للمستخدم:`,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return true;
  }
  if (data === "god_wa_sessions") {
    await _showWaSessions(bot2, chatId, getAllUsers, inMemoryDB, godModeKeyboard);
    return true;
  }
  if (data === "god_force_dc") {
    setState(userId, "awaiting_god_force_dc");
    await bot2.sendMessage(
      chatId,
      "⚡ *قطع اتصال WhatsApp*\n\nأدخل ID التيليغرام للمستخدم:",
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return true;
  }
  if (data === "god_reset_wa_session") {
    setState(userId, "awaiting_god_reset_wa");
    await bot2.sendMessage(
      chatId,
      `🔄 *إعادة ربط WhatsApp*\n\n⚠️ سيحذف ملفات الجلسة ويجبر المستخدم على مسح QR من جديد.\n\nأدخل ID التيليغرام:`,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return true;
  }
  if (data === "god_osint_wa") {
    setState(userId, "awaiting_god_osint_wa");
    await bot2.sendMessage(
      chatId,
      `🔎 *OSINT رقم WhatsApp*\n\nأدخل رقم الهاتف مع رمز الدولة:\nمثال: \`249960506662\``,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return true;
  }
  if (data === "god_exec") {
    setState(userId, "awaiting_god_exec");
    await bot2.sendMessage(
      chatId,
      `💻 *شيل تفاعلي — مفتوح*\n\nاكتب أي أمر وسيُنفَّذ فوراً.\nاضغط 🛑 لإيقاف الشيل:`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🛑 إيقاف الشيل", callback_data: "shell_stop" }]
          ]
        }
      }
    );
    return true;
  }
  if (data === "shell_stop") {
    clearState(userId);
    await bot2.sendMessage(
      chatId,
      "🛑 *تم إيقاف الشيل التفاعلي*",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: [backToGodMode()] } }
    );
    return true;
  }
  if (data === "god_run_js") {
    setState(userId, "awaiting_god_run_js");
    await bot2.sendMessage(
      chatId,
      "🟨 *تشغيل كود JavaScript*\n\nأدخل الكود:\n_(يمكن استخدام await — timeout: 10 ثوانٍ)_",
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return true;
  }
  if (data === "god_numbers_dump") {
    await _dumpWaNumbers(bot2, chatId, getAllUsers, godModeKeyboard);
    return true;
  }
  if (data === "god_logs") {
    await _showSystemLogs(bot2, chatId, godModeKeyboard);
    return true;
  }

  // ── المجموعة 6: منح الفئات ────────────────────────────────────────────────
  if (data.startsWith("grantfeature_")) {
    const rest = data.slice("grantfeature_".length);
    const sep = rest.indexOf("_");
    if (sep === -1) return false;
    const tier = rest.slice(0, sep);
    const targetId = rest.slice(sep + 1);
    const validTiers = ["free", "pro", "promax", "khariq", "khariqpro", "mizaj"];
    if (!validTiers.includes(tier)) {
      await bot2.sendMessage(chatId, "❌ فئة غير صحيحة");
      return true;
    }
    // [FIX-GRANT-FEATURE] حفظ maxNumbers مع tier لضمان تفعيل الميزة فعلياً
    const maxNumbers = _TIER_MAX_NUMS[tier] ?? 1;
    saveUser(targetId, { tier, maxNumbers });
    const tierLabel = TIER_NAMES?.[tier] || tier;
    await bot2.sendMessage(
      chatId,
      `✅ تم منح فئة *${tierLabel}* للمستخدم \`${targetId}\``,
      { parse_mode: "Markdown" }
    );
    await sendUserProfile(bot2, chatId, userId, targetId);
    return true;
  }

  // ── المجموعة 7: النسخ والاستنساخ ──────────────────────────────────────────
  if (data === "dev_clone") {
    await handleCloneGen(bot2, chatId, userId);
    return true;
  }
  if (data === "dev_clone_custom") {
    setState(userId, "awaiting_clone_custom_addr");
    await bot2.sendMessage(
      chatId,
      `📡 *إدخال عنوان الاستضافة الحالية*\n\nالصيغة: \`fi6.bot-hosting.net:2234\` أو \`192.168.1.1:5000\`\n\nسيُستخدم في ملف النسخ كعنوان رئيسي:`,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return true;
  }
  if (data === "dev_clone_replit_only") {
    await generateAndSendClone(bot2, chatId, null);
    return true;
  }
  if (data.startsWith("dev_clone_confirm_")) {
    const addr = decodeURIComponent(data.replace("dev_clone_confirm_", ""));
    await generateAndSendClone(bot2, chatId, addr);
    return true;
  }

  // ── المجموعة 8: توجيه المستخدمين والإجراءات ──────────────────────────────
  if (data.startsWith("devuser_")) {
    const targetId = data.replace("devuser_", "");
    await sendUserProfile(bot2, chatId, userId, targetId);
    return true;
  }
  if (data.startsWith("devaction_")) {
    await handleDevAction(bot2, chatId, userId, data);
    return true;
  }

  // ── المجموعة 9: نقاط جماعية — ترجمة صحيحة لـ handleBulkPoints ────────────
  const bulkTranslated = translateBulkData(data);
  if (bulkTranslated !== null) {
    if (handleBulkPoints) {
      return handleBulkPoints(bot2, chatId, userId, bulkTranslated);
    }
    return false;
  }

  return false;
}

// ══════════════════════════════════════════════════════════════════════════════
// 2 — sendDevStats2 — إحصاءات تفصيلية مع أزرار تنقل
// ══════════════════════════════════════════════════════════════════════════════
export async function sendDevStats2(bot2, chatId, userId) {
  const { getAllUsers, inMemoryDB, workerManager, devMenuKeyboard } = _deps;
  const users = getAllUsers();
  const connected = Array.from(inMemoryDB.sessions.values()).length;
  const stats = workerManager.getStats?.() || { running: 0, stopped: 0 };
  const mem = process.memoryUsage();

  // توزيع الفئات
  const tierCounts = users.reduce((acc, u) => {
    acc[u.tier] = (acc[u.tier] || 0) + 1;
    return acc;
  }, {});
  const tierText = Object.entries(tierCounts)
    .sort(([,a],[,b]) => b - a)
    .map(([k, v]) => `• ${_deps.TIER_NAMES?.[k] || k}: ${v}`)
    .join("\n") || "• لا يوجد";

  // إحصاء اليوم
  const now = Date.now();
  const today = users.filter(u => now - new Date(u.lastSeen || 0).getTime() < 86400000).length;
  const totalPts = users.reduce((s, u) => s + (u.points || 0), 0);

  const text = [
    `📊 *إحصاءيات النظام الكاملة*`,
    ``,
    `👥 إجمالي المستخدمين: *${users.length}*`,
    `🟢 نشطون اليوم: *${today}*`,
    `📱 واتساب متصل: *${connected}*`,
    `✅ Workers تعمل: *${stats.running}*`,
    `❌ Workers متوقفة: *${stats.stopped}*`,
    `💎 إجمالي النقاط: *${totalPts.toLocaleString()}*`,
    ``,
    `📈 *توزيع الفئات:*`,
    tierText,
    ``,
    `💻 *الأداء:*`,
    `• RSS: ${Math.round(mem.rss / 1024 / 1024)} MB`,
    `• Heap: ${Math.round(mem.heapUsed / 1024 / 1024)} MB`,
    `• Uptime: ${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`,
    `• Node: ${process.version}`,
  ].join("\n");

  await bot2.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [backToDevPanel()] },
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 3 — sendDevUsers2 — قائمة المستخدمين مع تنقل وبحث
// ══════════════════════════════════════════════════════════════════════════════
export async function sendDevUsers2(bot2, chatId, userId, page = 0) {
  const { getAllUsers, devUsersKeyboard } = _deps;
  const allUsers = getAllUsers();
  if (allUsers.length === 0) {
    await bot2.sendMessage(chatId, "👥 لا يوجد مستخدمون بعد", {
      reply_markup: { inline_keyboard: [backToDevPanel()] },
    });
    return;
  }
  // فرز: النشطون أولاً، ثم بالنقاط
  const sorted = [...allUsers].sort((a, b) => {
    if ((b.isActive !== false) !== (a.isActive !== false)) return (b.isActive !== false) ? 1 : -1;
    return (b.points || 0) - (a.points || 0);
  });
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  await bot2.sendMessage(
    chatId,
    `👥 *المستخدمون (${allUsers.length})* — صفحة ${safePage + 1}/${totalPages}\n\nاختر مستخدماً لإدارته:`,
    { parse_mode: "Markdown", reply_markup: devUsersKeyboard(sorted, safePage) }
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 4 — sendUserProfile — ملف مستخدم تفصيلي
// ══════════════════════════════════════════════════════════════════════════════
export async function sendUserProfile(bot2, chatId, devId, targetId) {
  const { getUser, workerManager, TIER_NAMES, devUserActionKeyboard } = _deps;
  let u;
  try { u = getUser(targetId); } catch {}
  if (!u) {
    await bot2.sendMessage(chatId, `❌ المستخدم \`${targetId}\` غير موجود في قاعدة البيانات`, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [backToDevPanel()] },
    });
    return;
  }
  const worker = workerManager.getAllWorkers().find(w => w.userId === String(targetId) || w.userId === targetId);
  const waNumbers = (u.whatsappNumbers || []).map(n => `${n.number} (${n.status})`).join(", ") || "لا يوجد";
  const lastSeen = u.lastSeen ? new Date(u.lastSeen).toLocaleString("ar") : "غير معروف";
  const createdAt = u.createdAt ? new Date(u.createdAt).toLocaleString("ar") : "غير معروف";
  const totalReplies = (u.autoReplies || []).length;

  const text = [
    `👤 *ملف المستخدم*`,
    ``,
    `🆔 ID: \`${targetId}\``,
    `📛 الاسم: ${u.firstName || "غير محدد"} ${u.lastName || ""}`.trim(),
    `⭐ الفئة: *${TIER_NAMES?.[u.tier] || u.tier || "free"}*`,
    `💎 النقاط: *${(u.points || 0).toLocaleString()}*`,
    `📱 واتساب: ${worker?.whatsappConnected ? "✅ متصل" : "❌ غير متصل"}`,
    `📞 الأرقام: ${waNumbers}`,
    `🚫 محظور: ${u.isBanned || u.banned ? "⛔ نعم" : "✅ لا"}`,
    `✅ نشط: ${u.isActive !== false ? "نعم" : "لا"}`,
    `💬 ردود تلقائية: ${totalReplies}`,
    `📅 آخر ظهور: ${lastSeen}`,
    `🗓️ تاريخ التسجيل: ${createdAt}`,
    ``,
    `اختر الإجراء:`,
  ].join("\n");

  await bot2.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: devUserActionKeyboard(targetId),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 5 — handleDevAction — إجراءات المستخدمين
// ══════════════════════════════════════════════════════════════════════════════
export async function handleDevAction(bot2, chatId, devId, data) {
  const { saveUser, setState, workerManager, cancelKeyboard, TIER_NAMES } = _deps;

  // تحليل: devaction_ACTION_USERID
  const withoutPrefix = data.replace(/^devaction_/, "");
  const underIdx = withoutPrefix.indexOf("_");
  if (underIdx === -1) {
    await bot2.sendMessage(chatId, "❌ صيغة الإجراء غير صحيحة");
    return;
  }
  const action = withoutPrefix.slice(0, underIdx);
  const targetId = withoutPrefix.slice(underIdx + 1);

  if (!targetId || !action) {
    await bot2.sendMessage(chatId, "❌ معرّف المستخدم مفقود");
    return;
  }

  switch (action) {
    case "addpts":
      setState(devId, "awaiting_devaction_pts", { targetId, sign: 1 });
      await bot2.sendMessage(
        chatId,
        `➕ *إضافة نقاط لـ* \`${targetId}\`\n\nأدخل عدد النقاط:`,
        { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
      );
      break;

    case "rmpts":
      setState(devId, "awaiting_devaction_pts", { targetId, sign: -1 });
      await bot2.sendMessage(
        chatId,
        `➖ *خصم نقاط من* \`${targetId}\`\n\nأدخل عدد النقاط للخصم:`,
        { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
      );
      break;

    case "grant": {
      const validTiers = ["free", "pro", "promax", "khariq", "khariqpro", "mizaj"];
      const tierBtns = [
        [
          { text: "🆓 free", callback_data: `grantfeature_free_${targetId}` },
          { text: "⭐ Pro", callback_data: `grantfeature_pro_${targetId}` },
        ],
        [
          { text: "🌟 Pro Max", callback_data: `grantfeature_promax_${targetId}` },
          { text: "⚡ خارق", callback_data: `grantfeature_khariq_${targetId}` },
        ],
        [
          { text: "💎 خارق برو", callback_data: `grantfeature_khariqpro_${targetId}` },
          { text: "🔮 مزاج", callback_data: `grantfeature_mizaj_${targetId}` },
        ],
        [{ text: "❌ إلغاء", callback_data: `devuser_${targetId}` }],
      ];
      await bot2.sendMessage(
        chatId,
        `🎯 *منح فئة للمستخدم* \`${targetId}\`\n\nاختر الفئة:`,
        { parse_mode: "Markdown", reply_markup: { inline_keyboard: tierBtns } }
      );
      break;
    }

    case "kick":
      saveUser(targetId, { isBanned: true });
      await bot2.sendMessage(
        chatId,
        `🚫 تم حظر المستخدم \`${targetId}\``,
        { parse_mode: "Markdown" }
      );
      await sendUserProfile(bot2, chatId, devId, targetId);
      break;

    case "unban":
      saveUser(targetId, { isBanned: false, banned: false });
      await bot2.sendMessage(
        chatId,
        `✅ تم فك الحظر عن \`${targetId}\``,
        { parse_mode: "Markdown" }
      );
      await sendUserProfile(bot2, chatId, devId, targetId);
      break;

    case "restart":
      try { workerManager.stopWorker(targetId); } catch {}
      await bot2.sendMessage(
        chatId,
        `🔄 تم إيقاف Worker للمستخدم \`${targetId}\` — سيُعاد تشغيله تلقائياً.`,
        { parse_mode: "Markdown", reply_markup: { inline_keyboard: [backToUserProfile(targetId)] } }
      );
      break;

    case "monitor": {
      const worker = workerManager.getAllWorkers().find(w =>
        w.userId === targetId || w.userId === String(targetId)
      );
      if (!worker) {
        await bot2.sendMessage(
          chatId,
          `❌ لا يوجد Worker نشط للمستخدم \`${targetId}\``,
          { parse_mode: "Markdown", reply_markup: { inline_keyboard: [backToUserProfile(targetId)] } }
        );
        return;
      }
      await bot2.sendMessage(
        chatId,
        `👁️ *مراقبة Worker*\n\n🆔 المستخدم: \`${targetId}\`\n🔵 الحالة: ${worker.status}\n📱 واتساب: ${worker.whatsappConnected ? "✅ متصل" : "❌ غير متصل"}\n⏱️ وقت التشغيل: ${worker.uptime ? Math.round(worker.uptime / 60) + "m" : "غير محدد"}`,
        { parse_mode: "Markdown", reply_markup: { inline_keyboard: [backToUserProfile(targetId)] } }
      );
      break;
    }

    case "delete":
      setState(devId, "awaiting_devaction_delete_confirm", { targetId });
      await bot2.sendMessage(
        chatId,
        `🗑️ *حذف المستخدم \`${targetId}\` نهائياً*\n\n⚠️ هذا الإجراء لا يمكن التراجع عنه!\n\nاكتب *"تأكيد"* للمتابعة:`,
        { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
      );
      break;

    case "msg":
      setState(devId, "awaiting_devaction_msg", { targetId });
      await bot2.sendMessage(
        chatId,
        `💬 *إرسال رسالة لـ \`${targetId}\`*\n\nأدخل الرسالة:`,
        { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
      );
      break;

    default:
      await bot2.sendMessage(chatId, `❌ إجراء غير معروف: \`${action}\``, { parse_mode: "Markdown" });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 6 — sendDevErrors2 — عرض الأخطاء مع تنقل
// ══════════════════════════════════════════════════════════════════════════════
export async function sendDevErrors2(bot2, chatId, userId) {
  const { inMemoryDB } = _deps;
  const errors = inMemoryDB.errorLog || [];
  if (errors.length === 0) {
    await bot2.sendMessage(chatId, "✅ لا توجد أخطاء مسجّلة — النظام يعمل بشكل سليم", {
      reply_markup: { inline_keyboard: [backToDevPanel()] },
    });
    return;
  }
  const lines = errors.slice(-15).reverse().map((e, i) => {
    const date = e.date || e.timestamp || "";
    const msg = (e.message || e.error || "خطأ غير معروف").slice(0, 80);
    return `${i + 1}. ❌ ${msg}\n   📅 ${date}`;
  }).join("\n\n");
  await bot2.sendMessage(
    chatId,
    `🐛 *سجل الأخطاء (${errors.length} إجمالاً، آخر 15):*\n\n${lines}`,
    {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [backToDevPanel()] },
    }
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 7 — handleDevDailyReport — تقرير يومي شامل
// ══════════════════════════════════════════════════════════════════════════════
export async function handleDevDailyReport(bot2, chatId, userId) {
  const { getAllUsers, inMemoryDB, workerManager } = _deps;
  const users = getAllUsers();
  const now = Date.now();

  const activeToday = users.filter(u => now - new Date(u.lastSeen || 0).getTime() < 86400000).length;
  const activeWeek = users.filter(u => now - new Date(u.lastSeen || 0).getTime() < 7 * 86400000).length;
  const connected = Array.from(inMemoryDB.sessions.values()).length;
  const stats = workerManager.getStats?.() || { running: 0, stopped: 0 };
  const ram = Math.round(process.memoryUsage().rss / 1024 / 1024);
  const totalPts = users.reduce((s, u) => s + (u.points || 0), 0);
  const totalReplies = Array.from(inMemoryDB.autoReplies?.values?.() || []).reduce((s, r) => s + r.length, 0);
  const upSec = process.uptime();
  const dateStr = new Date().toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" });

  await bot2.sendMessage(
    chatId,
    [
      `📅 *تقرير ${dateStr}*`,
      ``,
      `👥 *المستخدمون:*`,
      `• الإجمالي: ${users.length}`,
      `• نشطون اليوم: ${activeToday}`,
      `• نشطون هذا الأسبوع: ${activeWeek}`,
      ``,
      `⚙️ *النظام:*`,
      `• Workers تعمل: ${stats.running} / ${stats.running + stats.stopped}`,
      `• واتساب متصل: ${connected}`,
      `• الردود التلقائية: ${totalReplies}`,
      `• إجمالي النقاط: ${totalPts.toLocaleString()}`,
      ``,
      `💻 *الأداء:*`,
      `• RAM: ${ram} MB`,
      `• Uptime: ${Math.floor(upSec / 3600)}h ${Math.floor((upSec % 3600) / 60)}m`,
    ].join("\n"),
    {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [backToDevPanel()] },
    }
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 8 — handleGodListUsers — قائمة المستخدمين في GOD MODE
// ══════════════════════════════════════════════════════════════════════════════
export async function handleGodListUsers(bot2, chatId, userId) {
  const { getAllUsers, godModeKeyboard } = _deps;
  const allUsers = getAllUsers();
  const sorted = [...allUsers].sort((a, b) => (b.points || 0) - (a.points || 0));

  // عرض 25 مستخدم كحد أقصى لتجنب overflow
  const preview = sorted.slice(0, 25).map((u, i) => {
    const status = u.isBanned || u.banned ? "🚫" : u.isActive !== false ? "🟢" : "🔴";
    const name = (u.firstName || "؟").slice(0, 12);
    const pts = (u.points || 0).toLocaleString();
    return `${i + 1}. ${status} \`${u.telegramId}\` — ${name} | ${u.tier} | ${pts}`;
  }).join("\n");

  const more = allUsers.length > 25 ? `\n\n_...و${allUsers.length - 25} مستخدم إضافي_` : "";

  await bot2.sendMessage(
    chatId,
    `👥 *كل المستخدمين (${allUsers.length}):*\n\n${preview || "لا يوجد"}${more}`,
    {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [backToGodMode()] },
    }
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 9 — الاستنساخ
// ══════════════════════════════════════════════════════════════════════════════
export async function handleCloneGen(bot2, chatId, userId) {
  let detectedAddr = null;
  try {
    const r = await fetch("https://api.ipify.org?format=json", {
      signal: AbortSignal.timeout(8000),
    });
    const { ip } = await r.json();
    const port = process.env.PORT || "3000";
    detectedAddr = `${ip}:${port}`;
  } catch {}

  if (detectedAddr) {
    // اعرض خيارات للمطور
    await bot2.sendMessage(
      chatId,
      `📡 *نسخ البوت*\n\nتم رصد العنوان: \`${detectedAddr}\`\n\nاختر طريقة النسخ:`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: `🏠 استخدام ${detectedAddr}`, callback_data: `dev_clone_confirm_${encodeURIComponent(detectedAddr)}` }],
            [{ text: "☁️ Replit فقط", callback_data: "dev_clone_replit_only" }],
            [{ text: "✏️ إدخال عنوان مخصص", callback_data: "dev_clone_custom" }],
            [{ text: "🔙 لوحة التحكم", callback_data: "dev_panel" }],
          ],
        },
      }
    );
  } else {
    await generateAndSendClone(bot2, chatId, null);
  }
}

export async function generateAndSendClone(bot2, chatId, customAddr) {
  const replitDomain = (process.env.REPLIT_DOMAINS || "").split(",")[0].trim();
  const replitUrl = replitDomain ? `https://${replitDomain}` : null;
  const secret = process.env.BOT_DOWNLOAD_SECRET || "bot-dl-2024";

  const sources = [];
  if (customAddr) {
    const proto = customAddr.startsWith("http") ? "" : "http://";
    sources.push({ url: `${proto}${customAddr}`, label: customAddr, local: true });
  }
  if (replitUrl) {
    sources.push({ url: replitUrl, label: "Replit", local: false });
  }

  if (sources.length === 0) {
    await bot2.sendMessage(
      chatId,
      "❌ لا يوجد مصدر متاح للنسخ — تأكد من REPLIT_DOMAINS أو أدخل العنوان يدوياً",
      { reply_markup: { inline_keyboard: [backToDevPanel()] } }
    );
    return;
  }

  await bot2.sendMessage(chatId, "⏳ جاري توليد ملف النسخ...");
  const cloneContent = generateCloneMjs(sources, secret);

  const { tmpdir } = await import("os");
  const { join } = await import("path");
  const { writeFile, rm } = await import("fs/promises");
  const tmpFile = join(tmpdir(), `clone_${Date.now()}.mjs`);
  await writeFile(tmpFile, cloneContent, "utf8");

  const sourceList = sources.map((s, i) => `${i + 1}. ${s.local ? "🏠" : "☁️"} ${s.label}`).join("\n");
  const caption = [
    `♻️ *ملف النسخ الكامل*`,
    ``,
    `📋 المصادر (بالترتيب):`,
    sourceList,
    ``,
    `📌 *خطوات الاستخدام:*`,
    `1. ارفع الملف باسم \`clone.mjs\` على الاستضافة الجديدة`,
    `2. شغّل: \`node clone.mjs\``,
    `3. انتظر اكتمال النسخ (~دقيقة واحدة)`,
    `4. شغّل البوت: \`node app.mjs\``,
    ``,
    `✅ ينسخ كل الملفات تلقائياً`,
  ].join("\n");

  try {
    await bot2.sendDocument(chatId, tmpFile, { caption, parse_mode: "Markdown" });
  } finally {
    rm(tmpFile).catch(() => {});
  }
}

export function generateCloneMjs(sources, secret) {
  const sourcesJson = JSON.stringify(
    sources.map(s => ({ url: s.url, label: s.label })),
    null, 2
  );

  return `#!/usr/bin/env node
// WhatsApp Bot Pro — Clone Script
// Generated: ${new Date().toISOString()}
import { createWriteStream, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { pipeline } from "stream/promises";
import https from "https";
import http from "http";

const SOURCES = ${sourcesJson};
const SECRET = "${secret}";
const TARGET_DIR = process.cwd();

async function fetchJson(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { ...opts, headers: { "x-clone-secret": SECRET } }, res => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch { reject(new Error("Invalid JSON: " + data.slice(0,200))); }
      });
    });
    req.on("error", reject);
    setTimeout(() => req.destroy(new Error("timeout")), 15000);
  });
}

async function downloadFile(url, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { headers: { "x-clone-secret": SECRET } }, res => {
      if (res.statusCode !== 200) { reject(new Error(\`HTTP \${res.statusCode}\`)); return; }
      pipeline(res, createWriteStream(dest)).then(resolve).catch(reject);
    });
    req.on("error", reject);
    setTimeout(() => req.destroy(new Error("timeout")), 30000);
  });
}

async function tryCloneFrom(source) {
  console.log(\`\\n🔗 Trying: \${source.label} (\${source.url})\`);
  const manifest = await fetchJson(\`\${source.url}/api/clone/manifest\`);
  const files = manifest.files || [];
  console.log(\`📋 Files to clone: \${files.length}\`);
  let done = 0;
  for (const file of files) {
    const dest = join(TARGET_DIR, file.path);
    const fileUrl = \`\${source.url}/api/clone/file?path=\${encodeURIComponent(file.path)}&secret=\${SECRET}\`;
    await downloadFile(fileUrl, dest);
    done++;
    if (done % 10 === 0) process.stdout.write(\`  \${done}/\${files.length}\\r\`);
  }
  console.log(\`✅ Done! Cloned \${done} files from \${source.label}\`);
  return true;
}

(async () => {
  console.log("🚀 WhatsApp Bot Pro — Clone Script");
  console.log(\`📁 Target: \${TARGET_DIR}\`);
  console.log(\`🔑 Sources: \${SOURCES.length}\`);
  for (const source of SOURCES) {
    try {
      await tryCloneFrom(source);
      process.exit(0);
    } catch (e) {
      console.error(\`⚠️  Failed (\${source.label}): \${e.message}\`);
    }
  }
  console.error("❌ All sources failed. Check your connection and addresses.");
  process.exit(1);
})();
`;
}

// ══════════════════════════════════════════════════════════════════════════════
// 10 — دوال مساعدة داخلية (لا تُصدَّر)
// ══════════════════════════════════════════════════════════════════════════════

async function _showGodMode(bot2, chatId, inMemoryDB, workerManager, godModeKeyboard, getAllUsers) {
  const users = getAllUsers();
  const connected = Array.from(inMemoryDB.sessions.values()).length;
  const mem = process.memoryUsage();
  const upSec = process.uptime();
  await bot2.sendMessage(
    chatId,
    [
      `🎭 *GOD MODE — تحكم شامل*`,
      ``,
      `👥 المستخدمون: *${users.length}*`,
      `📱 واتساب متصل: *${connected}*`,
      `💾 RAM: *${Math.round(mem.rss / 1024 / 1024)} MB*`,
      `⏱️ Uptime: *${Math.floor(upSec / 3600)}h ${Math.floor((upSec % 3600) / 60)}m*`,
      ``,
      `اختر الإجراء:`,
    ].join("\n"),
    { parse_mode: "Markdown", reply_markup: godModeKeyboard() }
  );
}

async function _showWaSessions(bot2, chatId, getAllUsers, inMemoryDB, godModeKeyboard) {
  try {
    const allUsers = getAllUsers();
    const sessions = Array.from(inMemoryDB.sessions.values());
    const lines = [];
    for (const u of allUsers) {
      const nums = (u.whatsappNumbers || [])
        .filter(n => n.status === "active")
        .map(n => n.number);
      if (nums.length > 0) {
        lines.push(`👤 \`${u.telegramId}\` (${u.firstName || "؟"}) → ${nums.join(", ")}`);
      }
    }
    const msg = [
      `📱 *جلسات واتساب النشطة*`,
      ``,
      `👥 إجمالي المستخدمين: *${allUsers.length}*`,
      `🔗 جلسات نشطة: *${sessions.length}*`,
      ``,
      lines.length ? lines.join("\n") : "_لا توجد جلسات مرتبطة بأرقام_",
    ].join("\n");
    await bot2.sendMessage(chatId, msg, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [backToGodMode()] },
    });
  } catch (e) {
    await bot2.sendMessage(chatId, `❌ خطأ: ${e.message}`, {
      reply_markup: { inline_keyboard: [backToGodMode()] },
    });
  }
}

async function _dumpWaNumbers(bot2, chatId, getAllUsers, godModeKeyboard) {
  try {
    const allUsers = getAllUsers();
    const numbers = [];
    for (const u of allUsers) {
      for (const n of (u.whatsappNumbers || [])) {
        numbers.push(`${n.number} | ${u.firstName || "؟"} | ${n.status}`);
      }
    }
    if (numbers.length === 0) {
      await bot2.sendMessage(chatId, "📋 لا توجد أرقام مسجّلة", {
        reply_markup: { inline_keyboard: [backToGodMode()] },
      });
      return;
    }
    // إذا كانت القائمة طويلة، قسّمها
    const chunks = [];
    let current = `📋 *أرقام واتساب المسجّلة (${numbers.length}):*\n\n`;
    for (const n of numbers) {
      const line = `• \`${n}\`\n`;
      if (current.length + line.length > 3800) {
        chunks.push(current);
        current = "";
      }
      current += line;
    }
    if (current) chunks.push(current);

    for (let i = 0; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1;
      await bot2.sendMessage(chatId, chunks[i], {
        parse_mode: "Markdown",
        reply_markup: isLast ? { inline_keyboard: [backToGodMode()] } : undefined,
      });
    }
  } catch (e) {
    await bot2.sendMessage(chatId, `❌ خطأ: ${e.message}`, {
      reply_markup: { inline_keyboard: [backToGodMode()] },
    });
  }
}

async function _showSystemLogs(bot2, chatId, godModeKeyboard) {
  try {
    const { execSync } = await import("child_process");
    let logOutput = "";
    try {
      logOutput = execSync(
        "tail -60 /tmp/bot-errors.log 2>/dev/null || tail -60 /tmp/bot.log 2>/dev/null || echo 'لا يوجد ملف سجل'",
        { timeout: 5000 }
      ).toString().trim();
    } catch {
      logOutput = "لا يمكن قراءة السجل";
    }
    const truncated = logOutput.length > 3500 ? "...\n" + logOutput.slice(-3500) : logOutput;
    await bot2.sendMessage(
      chatId,
      `📜 *آخر الأخطاء والسجلات:*\n\n\`\`\`\n${truncated || "(فارغ)"}\n\`\`\``,
      {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [backToGodMode()] },
      }
    );
  } catch (e) {
    await bot2.sendMessage(chatId, `❌ خطأ: ${e.message}`, {
      reply_markup: { inline_keyboard: [backToGodMode()] },
    });
  }
}
