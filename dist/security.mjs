let _deps = {};
export function setDeps(d) { _deps = d; }

// ── أداة تسجيل الأنشطة ───────────────────────────────────────────────────────
function _logActivity(userId, action) {
  const { getUser, saveUser } = _deps;
  try {
    const user = getUser(userId);
    const logs = user.activityLog || [];
    logs.push({ action, date: new Date().toLocaleString("ar-SA") });
    if (logs.length > 30) logs.shift(); // احتفظ بآخر 30 نشاط
    saveUser(userId, { activityLog: logs });
  } catch { /* لا تُوقف الـ flow */ }
}

export async function handleSecurityCallback(bot2, chatId, userId, data) {
  const { getUser, saveUser, setState, cancelKeyboard, securityMenuKeyboard, _getNumberMgr, _getBaileys } = _deps;
  const user = getUser(userId);
  const sec  = user.securitySettings || {};

  // ── قائمة الحماية الرئيسية ─────────────────────────────────────────────────
  if (data === "menu_security") {
    const { getUserNumbers } = _getNumberMgr();
    const nums   = getUserNumbers(userId);
    const active = nums.find((n) => n.status === "active");

    const score = [sec.pin, sec.hideLastSeen, sec.hideReadReceipt, sec.rejectCalls, sec.ghostMode]
      .filter(Boolean).length;
    const scoreBar = "🛡️".repeat(score) + "⬜".repeat(5 - score);
    const scoreText = ["ضعيف", "مقبول", "جيد", "جيد جداً", "ممتاز", "حصين 🏆"][score] || "ضعيف";

    await bot2.sendMessage(
      chatId,
      `🔐 *الأمان والخصوصية*\n\n` +
      `${scoreBar} *${scoreText}*\n\n` +
      `🔒 قفل PIN: ${sec.pin ? "✅ مفعَّل" : "❌ معطَّل"}\n` +
      `👁️ إخفاء آخر ظهور: ${sec.hideLastSeen ? "✅" : "❌"}\n` +
      `✅ إخفاء علامة القراءة: ${sec.hideReadReceipt ? "✅" : "❌"}\n` +
      `⌨️ إخفاء يكتب: ${sec.hideTyping ? "✅" : "❌"}\n` +
      `🔇 رفض المكالمات: ${sec.rejectCalls ? "✅" : "❌"}\n` +
      `👻 وضع التخفي: ${sec.ghostMode ? "✅" : "❌"}\n` +
      `🌐 الظهور المستمر: ${active?.alwaysOnline ? "✅ مفعَّل" : "❌ معطَّل"}`,
      { parse_mode: "Markdown", reply_markup: securityMenuKeyboard(sec, active?.alwaysOnline) }
    );
    return true;
  }

  // ── قفل PIN ───────────────────────────────────────────────────────────────
  if (data === "sec_pin") {
    if (sec.pin) {
      await bot2.sendMessage(chatId, `🔒 *قفل PIN*\n\nالحالة: مفعَّل ✅\n\nاختر:`, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔄 تغيير PIN", callback_data: "sec_pin_change" }, { text: "🔓 إلغاء PIN", callback_data: "sec_pin_remove" }],
            [{ text: "🔙 رجوع", callback_data: "menu_security" }]
          ]
        }
      });
    } else {
      setState(userId, "awaiting_security_pin");
      await bot2.sendMessage(chatId, "🔒 *إعداد قفل PIN*\n\nأدخل PIN مكوَّن من 4 أرقام:", {
        parse_mode: "Markdown",
        reply_markup: cancelKeyboard()
      });
    }
    return true;
  }
  if (data === "sec_pin_change") {
    setState(userId, "awaiting_security_pin_change");
    await bot2.sendMessage(chatId, "🔄 أدخل PIN الجديد (4 أرقام):", { reply_markup: cancelKeyboard() });
    return true;
  }
  if (data === "sec_pin_remove") {
    saveUser(userId, { securitySettings: { ...sec, pin: null } });
    _logActivity(userId, "🔓 إلغاء قفل PIN");
    await bot2.sendMessage(chatId, "✅ تم إلغاء قفل PIN", { reply_markup: securityMenuKeyboard({ ...sec, pin: null }) });
    return true;
  }

  // ── إخفاء آخر ظهور ──────────────────────────────────────────────────────
  if (data === "sec_lastseen") {
    const val = !sec.hideLastSeen;
    saveUser(userId, { securitySettings: { ...sec, hideLastSeen: val } });
    _logActivity(userId, val ? "👁️ تفعيل إخفاء آخر ظهور" : "👁️ تعطيل إخفاء آخر ظهور");
    await bot2.sendMessage(
      chatId,
      `✅ إخفاء آخر ظهور: ${val ? "مفعَّل ✅" : "معطَّل ❌"}\n\n` +
      (val ? "⚡ لن يرى أحد متى كنت متصلاً آخر مرة." : "⚠️ سيرى الآخرون وقت آخر ظهورك."),
      { reply_markup: securityMenuKeyboard({ ...sec, hideLastSeen: val }) }
    );
    return true;
  }

  // ── إخفاء القراءة ──────────────────────────────────────────────────────
  if (data === "sec_readreceipt") {
    const val = !sec.hideReadReceipt;
    saveUser(userId, { securitySettings: { ...sec, hideReadReceipt: val } });
    _logActivity(userId, val ? "✅ تفعيل إخفاء علامة القراءة" : "✅ تعطيل إخفاء علامة القراءة");
    await bot2.sendMessage(
      chatId,
      `✅ إخفاء علامة القراءة (✓✓): ${val ? "مفعَّل ✅" : "معطَّل ❌"}\n\n` +
      (val ? "⚡ لن يرى المرسِل أنك قرأت رسالته." : "⚠️ سيرى المرسِل حين تقرأ رسائله."),
      { reply_markup: securityMenuKeyboard({ ...sec, hideReadReceipt: val }) }
    );
    return true;
  }

  // ── إخفاء يكتب ─────────────────────────────────────────────────────────
  if (data === "sec_typing") {
    const val = !sec.hideTyping;
    saveUser(userId, { securitySettings: { ...sec, hideTyping: val } });
    _logActivity(userId, val ? "⌨️ تفعيل إخفاء يكتب..." : "⌨️ تعطيل إخفاء يكتب...");
    await bot2.sendMessage(
      chatId,
      `✅ إخفاء "يكتب...": ${val ? "مفعَّل ✅" : "معطَّل ❌"}\n\n` +
      (val ? "⚡ لن يرى أحد أنك تكتب رسالة." : "⚠️ سيظهر للآخرين أنك تكتب."),
      { reply_markup: securityMenuKeyboard({ ...sec, hideTyping: val }) }
    );
    return true;
  }

  // ── الظهور المستمر ──────────────────────────────────────────────────────
  if (data === "sec_always_online") {
    const { getUserNumbers, updateNumber } = _getNumberMgr();
    const { setAlwaysOnline } = _getBaileys();
    const nums      = getUserNumbers(userId);
    const activeNum = nums.find((n) => n.status === "active");
    if (!activeNum) {
      await bot2.sendMessage(chatId, "❌ لا يوجد رقم نشط");
      return true;
    }
    const newVal = !activeNum.alwaysOnline;
    await updateNumber(userId, activeNum.id, { ...activeNum, alwaysOnline: newVal });
    setAlwaysOnline(userId, newVal);
    _logActivity(userId, newVal ? "🌐 تفعيل الظهور المستمر" : "🌐 تعطيل الظهور المستمر");
    const freshNums   = getUserNumbers(userId);
    const freshActive = freshNums.find((n) => n.status === "active");
    await bot2.sendMessage(
      chatId,
      `🌐 *الظهور المستمر*\n\n${newVal ? "✅ مفعَّل — سيظهر دائماً كمتصل" : "❌ معطَّل"}`,
      { parse_mode: "Markdown", reply_markup: securityMenuKeyboard(sec, freshActive?.alwaysOnline) }
    );
    return true;
  }

  // ── رفض المكالمات ──────────────────────────────────────────────────────
  if (data === "sec_reject_calls") {
    const val = !sec.rejectCalls;
    saveUser(userId, { securitySettings: { ...sec, rejectCalls: val } });
    _logActivity(userId, val ? "🔇 تفعيل رفض المكالمات" : "🔇 تعطيل رفض المكالمات");
    await bot2.sendMessage(
      chatId,
      `🔇 رفض المكالمات تلقائياً: ${val ? "مفعَّل ✅" : "معطَّل ❌"}\n\n` +
      (val ? "⚡ ستُرفض كل مكالمة واتساب وارية تلقائياً." : "⚠️ ستصلك المكالمات كالمعتاد."),
      { reply_markup: securityMenuKeyboard({ ...sec, rejectCalls: val }) }
    );
    return true;
  }

  // ── وضع التخفي الكامل ──────────────────────────────────────────────────
  if (data === "sec_ghost_mode") {
    const val    = !sec.ghostMode;
    const newSec = { ...sec, ghostMode: val };
    if (val) {
      newSec.hideLastSeen    = true;
      newSec.hideReadReceipt = true;
      newSec.hideTyping      = true;
    }
    saveUser(userId, { securitySettings: newSec });
    _logActivity(userId, val ? "👻 تفعيل وضع التخفي الكامل" : "👻 تعطيل وضع التخفي");
    await bot2.sendMessage(
      chatId,
      `👻 *وضع التخفي الكامل: ${val ? "مفعَّل ✅" : "معطَّل ❌"}*\n\n` +
      (val
        ? "⚡ تم تفعيل:\n• إخفاء آخر ظهور ✅\n• إخفاء علامة القراءة ✅\n• إخفاء يكتب... ✅\n\nلن يعرف أحد متى كنت متصلاً أو هل قرأت رسائلهم!"
        : "تم إلغاء وضع التخفي — الإعدادات عادت للوضع الطبيعي."),
      { parse_mode: "Markdown", reply_markup: securityMenuKeyboard(newSec) }
    );
    return true;
  }

  // ── حظر جهات اتصال ─────────────────────────────────────────────────────
  if (data === "sec_block") {
    setState(userId, "awaiting_person_search");
    saveUser(userId, { _pendingPersonAction: "security_block" });
    _logActivity(userId, "🚫 طلب حظر جهة اتصال");
    await bot2.sendMessage(chatId, "🚫 أدخل رقم الهاتف لحظره:", { reply_markup: cancelKeyboard() });
    return true;
  }

  // ── سجل الأنشطة ─────────────────────────────────────────────────────────
  if (data === "sec_log") {
    const logs = user.activityLog || [];
    if (logs.length === 0) {
      await bot2.sendMessage(
        chatId,
        "📝 *سجل الأنشطة*\n\n_لا توجد أنشطة مسجَّلة بعد._\n\nسيبدأ البوت بتسجيل أنشطتك عند تغيير إعدادات الأمان.",
        { parse_mode: "Markdown", reply_markup: securityMenuKeyboard(sec) }
      );
      return true;
    }
    const text = logs.slice(-15).reverse()
      .map((l) => `• ${l.action} — _${l.date}_`)
      .join("\n");
    await bot2.sendMessage(
      chatId,
      `📝 *سجل الأنشطة (آخر ${Math.min(15, logs.length)}):*\n\n${text}`,
      { parse_mode: "Markdown", reply_markup: securityMenuKeyboard(sec) }
    );
    return true;
  }

  // ── فحص الأمان الشامل ──────────────────────────────────────────────────
  if (data === "sec_scan") {
    const score = [sec.pin, sec.hideLastSeen, sec.hideReadReceipt, sec.rejectCalls, sec.ghostMode]
      .filter(Boolean).length;
    const scoreBar  = "🛡️".repeat(score) + "⬜".repeat(5 - score);
    const scoreText = ["ضعيف 🔴", "مقبول 🟡", "جيد 🟡", "جيد جداً 🟢", "ممتاز 🟢", "حصين 🏆"][score] || "ضعيف";

    const recommendations = [];
    if (!sec.pin)            recommendations.push("• فعَّل قفل PIN للحماية من الوصول غير المرخَّص");
    if (!sec.hideLastSeen)   recommendations.push("• فعَّل إخفاء آخر ظهور لحماية خصوصيتك");
    if (!sec.hideReadReceipt) recommendations.push("• فعَّل إخفاء علامة القراءة");
    if (!sec.rejectCalls)    recommendations.push("• فكَّر في تفعيل رفض المكالمات إذا تلقيت مكالمات مزعجة");
    if (!sec.ghostMode)      recommendations.push("• وضع التخفي يجمع كل إعدادات الخصوصية دفعةً واحدة");

    await bot2.sendMessage(
      chatId,
      `🔍 *فحص الأمان الشامل*\n\n` +
      `${scoreBar} ${score}/5 — *${scoreText}*\n\n` +
      `🔒 قفل PIN: ${sec.pin ? "✅" : "❌"}\n` +
      `👁️ إخفاء آخر ظهور: ${sec.hideLastSeen ? "✅" : "❌"}\n` +
      `✅ إخفاء القراءة: ${sec.hideReadReceipt ? "✅" : "❌"}\n` +
      `⌨️ إخفاء يكتب: ${sec.hideTyping ? "✅" : "❌"}\n` +
      `🔇 رفض المكالمات: ${sec.rejectCalls ? "✅" : "❌"}\n` +
      `👻 وضع التخفي: ${sec.ghostMode ? "✅" : "❌"}\n` +
      (recommendations.length > 0
        ? `\n💡 *التوصيات:*\n${recommendations.join("\n")}`
        : "\n🏆 إعداداتك ممتازة! أنت محمي بشكل كامل."),
      { parse_mode: "Markdown", reply_markup: securityMenuKeyboard(sec) }
    );
    return true;
  }

  // ── تقرير الخصوصية الكامل ──────────────────────────────────────────────
  if (data === "sec_report") {
    const blockedNums  = user.blockedNumbers  || [];
    const activityLogs = user.activityLog     || [];
    const { getUserNumbers } = _getNumberMgr();
    const nums = getUserNumbers(userId);
    const activeNum = nums.find((n) => n.status === "active");

    await bot2.sendMessage(
      chatId,
      `📋 *تقرير الخصوصية الكامل*\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `*⚙️ إعدادات الأمان:*\n` +
      `🔒 قفل PIN: ${sec.pin ? "✅" : "❌"}\n` +
      `👁️ إخفاء آخر ظهور: ${sec.hideLastSeen ? "✅" : "❌"}\n` +
      `✅ إخفاء القراءة: ${sec.hideReadReceipt ? "✅" : "❌"}\n` +
      `⌨️ إخفاء يكتب: ${sec.hideTyping ? "✅" : "❌"}\n` +
      `🌐 الظهور المستمر: ${activeNum?.alwaysOnline ? "✅" : "❌"}\n` +
      `🔇 رفض المكالمات: ${sec.rejectCalls ? "✅" : "❌"}\n` +
      `👻 وضع التخفي: ${sec.ghostMode ? "✅" : "❌"}\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `*📊 إحصائيات:*\n` +
      `🚫 أرقام محظورة: ${blockedNums.length}\n` +
      `📝 سجلات الأنشطة: ${activityLogs.length}\n` +
      `━━━━━━━━━━━━━━━━━━━`,
      { parse_mode: "Markdown", reply_markup: securityMenuKeyboard(sec) }
    );
    return true;
  }

  return false;
}
