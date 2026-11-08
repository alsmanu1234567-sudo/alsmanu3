let _deps = {};
export function setDeps(d) { _deps = { ..._deps, ...d }; }

// هروب محارف Markdown v1: يهرب _ * [ ] `
function escMd(s) {
  return String(s || "").replace(/([_*[\]`])/g, function(c){ return "\\" + c; });
}

let _telegramUsername = "";
async function getTelegramUsername(bot) {
  if (_telegramUsername) return _telegramUsername;
  try {
    const me = await bot.getMe();
    _telegramUsername = String(me?.username || "").replace(/^@/, "");
  } catch {}
  return _telegramUsername;
}

// ── قسم النقاط المُطوَّر ────────────────────────────────────────────────────

export async function showPoints2(bot2, chatId, userId, user) {
  const { getUser, inMemoryDB, TIER_NAMES, pointsMenuKeyboard, BOT_USERNAME } = _deps;
  user = user || getUser(userId);

  const pts   = user.points || 0;
  const tier  = user.tier   || "free";
  const log   = inMemoryDB.pointsLog.filter((l) => l.userId === userId).slice(-5).reverse();
  const logText = log.length > 0
    ? log.map((l) => `${l.amount > 0 ? "🟢 +" : "🔴 "}${l.amount} — ${escMd(l.reason)}`).join("\n")
    : "لا توجد حركات بعد";

  // [FIX-REFERRAL-CODE] حفظ رمز الإحالة في سجل المستخدم إذا لم يكن محفوظاً
  let refCode = user.referralCode;
  if (!refCode) {
    refCode = `REF${userId.slice(-6)}`;
    if (typeof _deps.saveUser === 'function') {
      _deps.saveUser(userId, { referralCode: refCode });
    }
  }
  const botName = await getTelegramUsername(bot2);
  const refLink = botName
    ? `https://t.me/${botName}?start=ref_${encodeURIComponent(refCode)}`
    : null;

  // شريط التقدم البصري للنقاط
  const tiers = ["free","pro","promax","khariq","khariqpro","mizaj"];
  const TIER_COSTS_LOCAL = { free:0, pro:1000, promax:5000, khariq:15000, khariqpro:40000, mizaj:100000 };
  const idx = tiers.indexOf(tier);
  const nextTier = tiers[idx + 1];
  let progressLine = "";
  if (nextTier) {
    const cost = TIER_COSTS_LOCAL[nextTier] || 0;
    const ratio = Math.min(1, pts / cost);
    const filled = Math.round(ratio * 10);
    progressLine = `\n\n📈 *نحو ${TIER_NAMES?.[nextTier] || nextTier}:*\n${"█".repeat(filled)}${"░".repeat(10 - filled)} ${Math.floor(ratio * 100)}%\n${pts >= cost ? "✅ يمكنك الترقية الآن!" : `⏳ ${(cost - pts).toLocaleString()} نقطة إضافية`}`;
  } else {
    progressLine = "\n\n🏆 *أنت في أعلى فئة — ميزاج!*";
  }

  await bot2.sendMessage(
    chatId,
    `💎 *نقاطي ورصيدي*\n\n` +
    `💰 رصيدك: *${pts.toLocaleString()} نقطة*\n` +
    `⭐ فئتك: *${TIER_NAMES?.[tier] || "مجاني"}*\n` +
    `📱 الأرقام: *${(user.whatsappNumbers || []).length}/${user.maxNumbers || 1}*\n` +
    `👥 إحالاتك: *${user.referralCount || 0} صديق*` +
    progressLine +
    `\n\n📋 *آخر الحركات:*\n${logText}`,
    { parse_mode: "Markdown", reply_markup: pointsMenuKeyboard() }
  );
}

export async function showFeatures2(bot2, chatId, userId, user) {
  const { getUser, TIER_NAMES, TIER_ORDER, TIER_COSTS, getDynamicPrice, featuresMenuKeyboard } = _deps;
  user = user || getUser(userId);
  const currentIndex = TIER_ORDER.indexOf(user.tier);
  let text = `⭐ *ميزاتي والترقية*\n\nفئتك الحالية: *${TIER_NAMES[user.tier] || "مجاني"}*\n💰 رصيدك: *${(user.points || 0).toLocaleString()} نقطة*\n\n`;
  if (user.tier !== "mizaj") {
    const nextTier = TIER_ORDER[currentIndex + 1];
    if (nextTier) {
      const cost = getDynamicPrice(`tier_${nextTier}`, TIER_COSTS[nextTier] || 0);
      const canAfford = (user.points || 0) >= cost;
      text += `📈 *الترقية التالية:* ${TIER_NAMES[nextTier]}\n💵 السعر: ${cost.toLocaleString()} نقطة\n${canAfford ? "✅ يمكنك الترقية الآن!" : `❌ تحتاج ${(cost - (user.points || 0)).toLocaleString()} نقطة إضافية`}\n\n`;
    }
  } else {
    text += "🏆 *أنت في أعلى فئة — ميزاج!*\n\n";
  }
  text += "اختر للتفاصيل:";
  await bot2.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: featuresMenuKeyboard(user.tier, user.points || 0)
  });
}

export async function handlePointsCallback(bot2, chatId, userId, data) {
  const {
    getUser, saveUser, addPoints, setState, getState, clearState, inMemoryDB,
    DEVELOPER_ID, TIER_NAMES, TIER_COSTS, TIER_ORDER, TIER_MAX_NUMBERS, TIER_FEATURES,
    MULTI_TIER_DISCOUNTS, getDynamicPrice, mainMenuKeyboard, pointsMenuKeyboard,
    featuresMenuKeyboard, confirmKeyboard, cancelKeyboard, bundleKeyboard, bulkPointsKeyboard,
    BOT_USERNAME,
  } = _deps;
  const user = getUser(userId);
  const isDev2 = userId === DEVELOPER_ID;

  if (data === "menu_points") {
    await showPoints2(bot2, chatId, userId, user);
    return true;
  }
  if (data === "menu_features" || data === "points_buy") {
    await showFeatures2(bot2, chatId, userId, user);
    return true;
  }
  // ── إحصائيات النقاط التفصيلية ────────────────────────────────────────────
  if (data === "points_stats") {
    const pts  = user.points || 0;
    const tier = user.tier   || "free";
    const refs = user.referralCount || 0;
    const reps = user.reportsSent   || 0;
    const log  = inMemoryDB.pointsLog.filter((l) => l.userId === userId);
    const earned = log.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0);
    const spent  = log.filter((l) => l.amount < 0).reduce((s, l) => s + Math.abs(l.amount), 0);
    await bot2.sendMessage(
      chatId,
      `📈 *إحصائيات نقاطي*\n\n` +
      `💰 الرصيد الحالي: *${pts.toLocaleString()} نقطة*\n` +
      `⭐ الفئة: *${TIER_NAMES?.[tier] || "مجاني"}*\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `📥 إجمالي المكتسب: *${earned.toLocaleString()}* نقطة\n` +
      `📤 إجمالي المُنفَق: *${spent.toLocaleString()}* نقطة\n` +
      `🔄 عدد الحركات: *${log.length}*\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `📢 من البلاغات: *${Math.floor(reps / 20) * 1000}* نقطة\n` +
      `👥 من الإحالات: *${(refs * 200).toLocaleString()}* نقطة`,
      { parse_mode: "Markdown", reply_markup: pointsMenuKeyboard() }
    );
    return true;
  }
  // ── استبدال النقاط ────────────────────────────────────────────────────────
  if (data === "points_redeem") {
    const pts     = user.points || 0;
    const cost50k = getDynamicPrice("extra_num", 5e4);
    await bot2.sendMessage(
      chatId,
      `🎁 *استبدال النقاط*\n\n` +
      `💰 رصيدك: *${pts.toLocaleString()} نقطة*\n\n` +
      `*ما يمكن استبداله:*\n` +
      `📱 رقم واتساب إضافي → ${cost50k.toLocaleString()} نقطة\n` +
      `⭐ ترقية لفئة أعلى → راجع الميزات\n\n` +
      `${pts >= cost50k
        ? "✅ يمكنك فتح رقم إضافي الآن!"
        : `❌ تحتاج ${(cost50k - pts).toLocaleString()} نقطة للرقم الإضافي`}`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: `📱 فتح رقم إضافي (${cost50k.toLocaleString()} نقطة)`, callback_data: "redeem_extra_num" }],
            [{ text: "⭐ الترقية والميزات", callback_data: "menu_features" }],
            [{ text: "🔙 رجوع", callback_data: "menu_points" }]
          ]
        }
      }
    );
    return true;
  }

  // ── كيف تكسب النقاط ────────────────────────────────────────────────���─────
  if (data === "points_earn") {
    await bot2.sendMessage(
      chatId,
      `💡 *طرق كسب النقاط*\n\n` +
      `🎁 تسجيل أول مرة: +100 نقطة\n` +
      `⚙️ إضافة رد تلقائي: +5 نقاط\n` +
      `🤖 رد ذكاء اصطناعي: +10 نقاط\n` +
      `👥 دعوة صديق: +200 نقطة\n` +
      `📅 جدولة رسالة: +3 نقاط\n` +
      `⚡ إرسال بلاغ: يكسب عند التراكم\n` +
      `📤 إرسال جماعي: +2 نقاط للرسالة\n\n` +
      `*المعالم والمكافآت:*\n` +
      `• 20 بلاغ → 1,000 نقطة\n` +
      `• 200 بلاغ → ⭐ نجمة للمطوّر\n` +
      `• كل دعوة → +200 نقطة\n\n` +
      `💎 النقاط تُستخدم للترقية وفتح الميزات.`,
      { parse_mode: "Markdown", reply_markup: pointsMenuKeyboard() }
    );
    return true;
  }

  // ── سجل النقاط ───────────────────────────────────────────────────────────
  if (data === "points_log") {
    const log = inMemoryDB.pointsLog.filter((l) => l.userId === userId).slice(-20).reverse();
    if (log.length === 0) {
      await bot2.sendMessage(chatId, "📊 لا توجد حركات نقاط بعد.");
      return true;
    }
    const text = log.map(
      (l) => `${l.amount > 0 ? "🟢 +" : "🔴 "}${l.amount} — ${escMd(l.reason)}`
    ).join("\n");
    await bot2.sendMessage(chatId, `📊 *سجل النقاط (آخر 20):*\n\n${text}`, { parse_mode: "Markdown" });
    return true;
  }

  // ── نظام الإحالة المطوَّر ─────────────────────────────────────────────────
  if (data === "points_referral") {
    // [FIX-REFERRAL-CODE] حفظ رمز الإحالة في سجل المستخدم إذا لم يكن محفوظاً بعد
    let code = user.referralCode;
    if (!code) {
      code = `REF${userId.slice(-6)}`;
      if (typeof _deps.saveUser === 'function') {
        _deps.saveUser(userId, { referralCode: code });
      }
    }
    const botName = await getTelegramUsername(bot2);
    const refLink = botName
      ? `https://t.me/${botName}?start=ref_${encodeURIComponent(code)}`
      : null;

    const refCount = user.referralCount || 0;
    const earned   = refCount * 200;

    // شريط التقدم للإحالات (كل 5 إحالات = مكافأة)
    const nextBatch = 5 - (refCount % 5 || 5);
    const filled = Math.min(5, refCount % 5 || (refCount > 0 ? 5 : 0));
    const progressBar = "★".repeat(filled) + "☆".repeat(5 - filled);

    let msgText =
      `🔗 *نظام الإحالة*\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `👤 إحالاتك: *${refCount}* صديق\n` +
      `💰 مكتسب: *${earned.toLocaleString()} نقطة*\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `🎯 *المكافآت:*\n` +
      `• كل إحالة = +200 نقطة فوراً\n` +
      `• كل 5 إحالات = +1,000 نقطة إضافية\n\n` +
      `📊 *التقدم:*\n${progressBar} ${refCount % 5 || (refCount >= 5 ? 5 : 0)}/5\n` +
      (nextBatch < 5 ? `⏳ ${nextBatch} إحالة للمكافأة التالية (+1,000)\n\n` : `✅ استحققت مكافأة! اجمع المزيد!\n\n`);

    if (refLink) {
      msgText +=
        `🔗 *رابط الإحالة الخاص بك:*\n${refLink}\n\n` +
        `📋 *أو شارك الرمز:* \`${code}\`\n\n` +
        `💬 شارك هذا الرابط مع أصدقائك وستحصل على النقاط تلقائياً عند تسجيلهم!`;
    } else {
      msgText +=
        `تعذر جلب اسم مستخدم البوت الحقيقي من Telegram الآن.\n` +
        `أعد فتح القسم لاحقاً؛ لن نعرض رابطاً غير صالح.\n\n` +
        `رمز الإحالة: \`${code}\``;
    }

    const kb = {
      inline_keyboard: [
        refLink ? [{ text: "مشاركة رابط الدعوة", url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent("انضم إلى البوت من رابط دعوتي")}` }] : [],
        [{ text: "📊 نقاطي", callback_data: "menu_points" }, { text: "🔙 رجوع", callback_data: "menu_points" }],
      ].filter(row => row.length > 0)
    };

    await bot2.sendMessage(chatId, msgText, { parse_mode: "Markdown", reply_markup: kb });
    return true;
  }

  // ── استرداد رقم إضافي ────────────────────────────────────────────────────
  if (data === "redeem_extra_num") {
    const cost = getDynamicPrice("extra_num", 5e4);
    if ((user.points || 0) < cost) {
      await bot2.sendMessage(
        chatId,
        `❌ *نقاط غير كافية*\n\nتحتاج: ${cost.toLocaleString()} نقطة\nلديك: ${(user.points || 0).toLocaleString()} نقطة`,
        { parse_mode: "Markdown" }
      );
      return true;
    }
    addPoints(userId, -cost, "فتح رقم إضافي");
    saveUser(userId, { maxNumbers: (user.maxNumbers || 1) + 1 });
    const fresh = getUser(userId);
    await bot2.sendMessage(
      chatId,
      `✅ *تم فتح رقم إضافي!*\n\n📱 أرقام مسموحة: ${fresh.maxNumbers}\n💰 المتبقي: ${fresh.points.toLocaleString()} نقطة`,
      { parse_mode: "Markdown", reply_markup: mainMenuKeyboard(fresh.points || 0, fresh.tier, isDev2) }
    );
    return true;
  }

  if (data.startsWith("feature_buy_")) {
    await handleFeatureBuy(bot2, chatId, userId, data, user);
    return true;
  }
  if (data.startsWith("feature_info_")) {
    await handleFeatureInfo(bot2, chatId, userId, data);
    return true;
  }
  if (data === "feature_bundle") {
    await bot2.sendMessage(
      chatId,
      `📦 *باقات متعددة*\n\nاختر باقتين أو أكثر للحصول على خصم:`,
      { parse_mode: "Markdown", reply_markup: bundleKeyboard(user.points || 0) }
    );
    return true;
  }
  if (data.startsWith("bundle_toggle_")) {
    await handleBundleToggle(bot2, chatId, userId, data);
    return true;
  }
  if (data === "bundle_calc") {
    await handleBundleCalc(bot2, chatId, userId, user);
    return true;
  }
  if (data === "bundle_confirm") {
    await handleBundleConfirm(bot2, chatId, userId, user);
    return true;
  }
  return false;
}

async function handleFeatureBuy(bot2, chatId, userId, data, user) {
  const { TIER_NAMES, TIER_COSTS, TIER_ORDER, getDynamicPrice, featuresMenuKeyboard, confirmKeyboard } = _deps;
  const tier = data.replace("feature_buy_", "");
  const currentIndex = TIER_ORDER.indexOf(user.tier);
  const targetIndex  = TIER_ORDER.indexOf(tier);
  if (targetIndex <= currentIndex) {
    await bot2.sendMessage(chatId, `⚠️ لديك بالفعل فئة ${TIER_NAMES[user.tier] || user.tier} أو أعلى.`);
    return;
  }
  const cost = getDynamicPrice(`tier_${tier}`, TIER_COSTS[tier] || 0);
  if ((user.points || 0) < cost) {
    await bot2.sendMessage(
      chatId,
      `❌ *نقاط غير كافية*\n\nالفئة: ${TIER_NAMES[tier]}\nالتكلفة: ${cost.toLocaleString()} نقطة\nرصيدك: ${(user.points || 0).toLocaleString()} نقطة\nينقصك: ${(cost - (user.points || 0)).toLocaleString()} نقطة`,
      { parse_mode: "Markdown", reply_markup: featuresMenuKeyboard(user.tier, user.points || 0) }
    );
    return;
  }
  await bot2.sendMessage(
    chatId,
    `✅ *تأكيد الترقية*\n\nالفئة: ${TIER_NAMES[tier]}\nالتكلفة: ${cost.toLocaleString()} نقطة\nرصيدك بعد ا��شراء: ${((user.points || 0) - cost).toLocaleString()} نقطة\n\nهل تأكد؟`,
    { parse_mode: "Markdown", reply_markup: confirmKeyboard(`confirm_buy_${tier}`, "cancel") }
  );
}

async function handleFeatureInfo(bot2, chatId, userId, data) {
  const { TIER_NAMES, TIER_COSTS, TIER_FEATURES, TIER_MAX_NUMBERS, getDynamicPrice } = _deps;
  const tier = data.replace("feature_info_", "");
  const features = TIER_FEATURES[tier] || [];
  const cost = getDynamicPrice(`tier_${tier}`, TIER_COSTS[tier] || 0);
  await bot2.sendMessage(
    chatId,
    `📋 *${TIER_NAMES[tier] || tier}*\n\n💰 السعر: ${cost.toLocaleString()} نقطة\n📱 أرقام: ${TIER_MAX_NUMBERS[tier] || 1}\n\n✨ *الميزات:*\n${features.map((f) => `• ${f}`).join("\n")}`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: `💎 شراء ${TIER_NAMES[tier]}`, callback_data: `feature_buy_${tier}` }],
          [{ text: "🔙 رجوع", callback_data: "menu_features" }]
        ]
      }
    }
  );
}

export async function handleConfirmBuy(bot2, chatId, userId, tier) {
  const { getUser, saveUser, addPoints, inMemoryDB, DEVELOPER_ID, TIER_NAMES, TIER_COSTS, TIER_MAX_NUMBERS, getDynamicPrice, mainMenuKeyboard } = _deps;
  const user = getUser(userId);
  const cost = getDynamicPrice(`tier_${tier}`, TIER_COSTS[tier] || 0);
  if ((user.points || 0) < cost) {
    await bot2.sendMessage(chatId, "❌ نقاط غير كافية");
    return;
  }
  addPoints(userId, -cost, `شراء باقة ${tier}`);
  saveUser(userId, { tier, maxNumbers: TIER_MAX_NUMBERS[tier] || 1 });
  const fresh = getUser(userId);
  const isDev2 = userId === DEVELOPER_ID;
  await bot2.sendMessage(
    chatId,
    `🎉 *تهانينا! تمت الترقية!*\n\n⭐ الفئة الجديدة: *${TIER_NAMES[tier]}*\n📱 أرقام مسموحة: ${TIER_MAX_NUMBERS[tier] || 1}\n💰 المتبقي: ${fresh.points.toLocaleString()} نقطة\n\nاستمتع بميزاتك الجديدة! 🚀`,
    { parse_mode: "Markdown", reply_markup: mainMenuKeyboard(fresh.points || 0, fresh.tier, isDev2) }
  );
  const devId = parseInt(DEVELOPER_ID);
  if (!isNaN(devId)) {
    bot2.sendMessage(
      devId,
      `💰 *ترقية جديدة!*\n\nالمستخدم: ${fresh.firstName || userId} (${userId})\nالفئة: ${TIER_NAMES[tier]}\nالتكلفة: ${cost.toLocaleString()} نقطة`,
      { parse_mode: "Markdown" }
    ).catch(() => {});
  }
}

async function handleBundleToggle(bot2, chatId, userId, data) {
  const { getUser, setState, getState, TIER_NAMES, bundleKeyboard } = _deps;
  const tier = data.replace("bundle_toggle_", "");
  const state = getState(userId);
  const selected = state.data.selectedBundle || [];
  const idx = selected.indexOf(tier);
  if (idx > -1) selected.splice(idx, 1);
  else selected.push(tier);
  setState(userId, "idle", { selectedBundle: selected });
  await bot2.sendMessage(
    chatId,
    `📦 *اختيارك:* ${selected.length > 0 ? selected.map((t) => TIER_NAMES[t]).join("، ") : "لم تختر بعد"}\n\naضغط "حساب الخصم" لرؤية السعر:`,
    { parse_mode: "Markdown", reply_markup: bundleKeyboard(getUser(userId).points || 0, selected) }
  );
}

async function handleBundleCalc(bot2, chatId, userId, user) {
  const { getState, TIER_NAMES, TIER_COSTS, MULTI_TIER_DISCOUNTS, getDynamicPrice, confirmKeyboard } = _deps;
  const state = getState(userId);
  const selected = state.data.selectedBundle || [];
  if (selected.length < 2) {
    await bot2.sendMessage(chatId, "❌ اختر باقتين على الأقل للحصول على خصم");
    return;
  }
  const totalCost = selected.reduce((s, t) => s + getDynamicPrice(`tier_${t}`, TIER_COSTS[t] || 0), 0);
  const discountPct = MULTI_TIER_DISCOUNTS[selected.length] || 0;
  const discount = Math.floor(totalCost * discountPct / 100);
  const finalCost = totalCost - discount;
  const canAfford = (user.points || 0) >= finalCost;
  await bot2.sendMessage(
    chatId,
    `📦 *ملخص الباقات المتعددة*\n\nالباقات: ${selected.map((t) => TIER_NAMES[t]).join("، ")}\nالسعر الأصلي: ${totalCost.toLocaleString()} نقطة\nالخصم (${discountPct}%): -${discount.toLocaleString()} نقطة\n*السعر النهائي: ${finalCost.toLocaleString()} نقطة*\n\n${canAfford ? "✅ يمكنك الشراء!" : `❌ ينقصك ${(finalCost - (user.points || 0)).toLocaleString()} نقطة`}`,
    {
      parse_mode: "Markdown",
      reply_markup: canAfford
        ? confirmKeyboard("bundle_confirm", "cancel")
        : { inline_keyboard: [[{ text: "🔙 رجوع", callback_data: "menu_features" }]] }
    }
  );
}

async function handleBundleConfirm(bot2, chatId, userId, user) {
  const { getUser, saveUser, addPoints, clearState, getState, DEVELOPER_ID, TIER_NAMES, TIER_COSTS, TIER_ORDER, TIER_MAX_NUMBERS, MULTI_TIER_DISCOUNTS, getDynamicPrice, mainMenuKeyboard } = _deps;
  const state = getState(userId);
  const selected = state.data.selectedBundle || [];
  if (selected.length === 0) {
    await bot2.sendMessage(chatId, "❌ لا توجد باقات محددة");
    return;
  }
  const totalCost = selected.reduce((s, t) => s + getDynamicPrice(`tier_${t}`, TIER_COSTS[t] || 0), 0);
  const discountPct = MULTI_TIER_DISCOUNTS[selected.length] || 0;
  const finalCost = Math.floor(totalCost - totalCost * discountPct / 100);
  if ((user.points || 0) < finalCost) {
    await bot2.sendMessage(chatId, "❌ نقاط غير كافية");
    return;
  }
  const highestTier = selected.sort((a2, b) => TIER_ORDER.indexOf(b) - TIER_ORDER.indexOf(a2))[0];
  addPoints(userId, -finalCost, `شراء باقات متعددة: ${selected.join(",")}`);
  saveUser(userId, { tier: highestTier, maxNumbers: TIER_MAX_NUMBERS[highestTier] || 1 });
  clearState(userId);
  const fresh = getUser(userId);
  const isDev2 = userId === DEVELOPER_ID;
  await bot2.sendMessage(
    chatId,
    `🎉 *تمت عملية الشراء بنجاح!*\n\nالفئة المفعَّلة: *${TIER_NAMES[highestTier]}*\nالنقاط المخصومة: ${finalCost.toLocaleString()}\nالمتبقي: ${fresh.points.toLocaleString()} نقطة`,
    { parse_mode: "Markdown", reply_markup: mainMenuKeyboard(fresh.points || 0, fresh.tier, isDev2) }
  );
}

export function getBulkUsers2(category) {
  const { inMemoryDB } = _deps;
  return Array.from(inMemoryDB.users.values()).filter((u3) => {
    if (category === "all") return true;
    if (category === "active")
      return u3.lastSeen && Date.now() - new Date(u3.lastSeen).getTime() < 7 * 24 * 60 * 60 * 1e3;
    if (category === "new")
      return u3.createdAt && Date.now() - new Date(u3.createdAt).getTime() < 24 * 60 * 60 * 1e3;
    return u3.tier === category;
  });
}

export async function handleBulkPoints(bot2, chatId, userId, data) {
  const { DEVELOPER_ID, setState, getState, clearState, addPoints, cancelKeyboard } = _deps;
  if (userId !== DEVELOPER_ID) return false;
  if (data.startsWith("bulk_cat_")) {
    const category = data.replace("bulk_cat_", "");
    setState(userId, "awaiting_bulk_points_amount", { bulkCategory: category });
    const users = getBulkUsers2(category);
    await bot2.sendMessage(
      chatId,
      `💎 *إرسال نقاط جماعي*\n\nالفئة: ${category}\nعدد المستخدمين: ${users.length}\n\nأدخل عدد النقاط لكل مستخدم:`,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return true;
  }
  if (data === "bulk_confirm") {
    const state = getState(userId);
    const category = state.data.bulkCategory || "all";
    const amount = state.data.bulkAmount || 0;
    const message = state.data.bulkMessage || "";
    const users = getBulkUsers2(category);
    for (const u3 of users) {
      addPoints(u3.telegramId, amount, `مطوّر: إرسال جماعي — ${category}`);
      if (u3.telegramChatId && message) {
        const personalMsg = message
          .replace(/{name}/g, u3.firstName || u3.telegramId)
          .replace(/{points}/g, amount.toString())
          .replace(/{date}/g, new Date().toLocaleDateString("ar"));
        bot2.sendMessage(u3.telegramChatId, personalMsg).catch(() => {});
      }
    }
    clearState(userId);
    await bot2.sendMessage(
      chatId,
      `✅ *تم إرسال ${amount.toLocaleString()} نقطة لـ ${users.length} مستخدم بنجاح!*`,
      { parse_mode: "Markdown" }
    );
    return true;
  }
  return false;
}
