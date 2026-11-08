// ============================================================
// dist/auto-reply.mjs — قسم الردود التلقائية (ملف مستقل)
// WhatsApp Bot Pro — فُصل عن dist/index.mjs للتطوير المستقل
// ============================================================
// الاعتماديات تُمرَّر من الملف الرئيسي عبر setDeps()
// ============================================================

let _deps = {};

/**
 * تسجيل الاعتماديات من dist/index.mjs
 * يُستدعى مرة واحدة عند تهيئة البوت
 */
export function setDeps(d) {
  _deps = { ..._deps, ...d };
}

// ─────────────────────────────────────────────────────────────
// الدوال المساعدة الداخلية
// ─────────────────────────────────────────────────────────────

async function handleLongTextDoneInternal(bot2, chatId, userId) {
  const { getMergedText, getState, setState, clearTextParts,
          longTextDoneKeyboard, replyTargetKeyboard } = _deps;
  const merged = getMergedText(userId);
  if (!merged.trim()) {
    await bot2.sendMessage(chatId, "❌ لم تُدخل نصاً بعد. أرسل نص الرد:", {
      reply_markup: longTextDoneKeyboard(0)
    });
    return;
  }
  setState(userId, "awaiting_reply_target", { replyContent: merged });
  clearTextParts(userId);
  await bot2.sendMessage(
    chatId,
    `✅ *تم استلام النص (${merged.length} حرف)*\n\n*الخطوة التالية:* اختر من يستلم الرد:`,
    { parse_mode: "Markdown", reply_markup: replyTargetKeyboard() }
  );
}

async function handleReplyTypeCallbackInternal(bot2, chatId, userId, data) {
  const { getState, setState, saveAutoReply, addPoints, getUser, clearState,
          mainMenuKeyboard, cancelKeyboard, longTextDoneKeyboard, DEVELOPER_ID } = _deps;

  if (data === "rtype_ai") {
    const aiMgr = await _deps.getAiManager();
    const hasKey = aiMgr.hasNvidiaKey(userId);
    if (!hasKey) {
      await bot2.sendMessage(
        chatId,
        `⚠️ *الرد بالذكاء الاصطناعي*\n\nلم تضف مفتاح NVIDIA بعد.\n\nاذهب إلى: 🤖 الذكاء الاصطناعي ← 🔑 إضافة مفتاح\n\naحصل على مفتاح مجاني من:\nhttps://build.nvidia.com`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🤖 إعدادات الذكاء", callback_data: "menu_ai" }],
              [{ text: "🔙 رجوع", callback_data: "home" }]
            ]
          }
        }
      );
      return;
    }
    const modelShort = aiMgr.getUserSelectedModel(userId).split("/")[1] || "افتراضي";
    setState(userId, "awaiting_reply_content", { replyType: "ai" });
    await bot2.sendMessage(
      chatId,
      `🤖 *الرد بالذكاء الاصطناعي*\n\nالنموذج: \`${modelShort}\`\n\n📝 أدخل تعليمات الذكاء (البرومت):\n\nمثال: _أنت مساعد ودود للشركة X. رد باختصار ولباقة بالعربية._`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ استخدام البرومت الافتراضي", callback_data: "rtype_ai_default" }],
            [{ text: "❌ إلغاء", callback_data: "cancel" }]
          ]
        }
      }
    );
    return;
  }

  if (data === "rtype_ai_default") {
    const state = getState(userId);
    const { trigger, triggerType, target, targetNumbers, scope, caseSensitive } = state.data;
    saveAutoReply(userId, {
      trigger: trigger || "default",
      triggerType: triggerType || "exact",
      caseSensitive: caseSensitive || false,
      replyType: "ai",
      replyContent: "__ai_default__",
      target: target || "all",
      targetNumbers: targetNumbers || [],
      scope: scope || "both"
    });
    addPoints(userId, 10, "إضافة رد ذكاء اصطناعي");
    clearState(userId);
    const freshUser = getUser(userId);
    await bot2.sendMessage(
      chatId,
      `✅ *تم حفظ الرد بالذكاء الاصطناعي!*\n\nالكلمة المفتاحية: "${trigger}"\nسيستخدم البرومت الافتراضي تلقائياً.`,
      {
        parse_mode: "Markdown",
        reply_markup: mainMenuKeyboard(freshUser.points || 0, freshUser.tier, userId === DEVELOPER_ID)
      }
    );
    return;
  }

  if (data === "rtype_morphing") {
    const state = getState(userId);
    setState(userId, "awaiting_morph_initial", { ...state.data, replyType: "morphing" });
    await bot2.sendMessage(
      chatId,
      `✏️ *رسالة تتعدّل تلقائياً*\n\nالرسالة تُرسل بنص أولي ثم تتعدّل إلى نصوص مختلفة بعد أوقات محددة.\n\n*الخطوة 1:* أدخل *النص الأولي* للرسالة:`,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return;
  }

  const typeMap = {
    rtype_text: "text",
    rtype_image: "image",
    rtype_audio: "audio",
    rtype_video: "video",
    rtype_document: "document",
    rtype_sticker: "sticker"
  };
  const replyType = typeMap[data];
  if (!replyType) return;

  // أنواع الوسائط التي تُرفَع مباشرة (ليست نصاً)
  const mediaTypes = ["image", "video", "audio", "document"];
  if (mediaTypes.includes(replyType)) {
    setState(userId, "awaiting_reply_media", { replyType });
    const mediaHints = {
      image:    "🖼️ *الخطوة 4/4:* أرسل الصورة مباشرة في الشات (كصورة حقيقية، ليس ملفاً):",
      video:    "🎬 *الخطوة 4/4:* أرسل الفيديو مباشرة في الشات:",
      audio:    "🎵 *الخطوة 4/4:* أرسل ملف الصوت مباشرة في الشات:",
      document: "📄 *الخطوة 4/4:* أرسل الملف مباشرة في الشات:",
    };
    await bot2.sendMessage(chatId, mediaHints[replyType], {
      parse_mode: "Markdown",
      reply_markup: _deps.cancelKeyboard()
    });
    return;
  }

  setState(userId, "awaiting_reply_content", { replyType });
  const hints = {
    text:    "📝 *الخطوة 4/4:* اكتب نص الرد:\n\nيمكن استخدام المتغيرات: {name} {number} {time}",
    sticker: "😊 *الخطوة 4/4:* أرسل رابط الملصق أو ID السكتر:",
  };
  await bot2.sendMessage(chatId, hints[replyType] || "أدخل محتوى الرد:", {
    parse_mode: "Markdown",
    reply_markup: longTextDoneKeyboard(0)
  });
}

async function handleTargetCallbackInternal(bot2, chatId, userId, data) {
  const { setState, cancelKeyboard, replyScopeKeyboard } = _deps;
  const t = { target_all: "all", target_specific: "specific", target_multiple: "multiple", target_self: "self" }[data];
  if (!t) return;
  if (t === "self") {
    setState(userId, "awaiting_reply_scope", { target: "self" });
    await bot2.sendMessage(
      chatId,
      `🔄 *رد على رسائلك أنت (fromMe)*\n\n*الخطوة 3/4:* اختر نطاق الرد:`,
      { parse_mode: "Markdown", reply_markup: replyScopeKeyboard() }
    );
  } else if (t === "specific") {
    setState(userId, "awaiting_specific_numbers", { target: t });
    await bot2.sendMessage(
      chatId,
      `👤 *أدخل رقم الشخص:*\nمثال: \`249960506662\``,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
  } else if (t === "multiple") {
    setState(userId, "awaiting_specific_numbers", { target: t });
    await bot2.sendMessage(
      chatId,
      `👥 *أدخل الأرقام (واحد في كل سطر أو مفصولة بفاصلة):*`,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
  } else {
    setState(userId, "awaiting_reply_scope", { target: "all" });
    await bot2.sendMessage(
      chatId,
      `✅ *الهدف:* الجميع\n\n*الخطوة 3/4:* اختر النطاق:`,
      { parse_mode: "Markdown", reply_markup: replyScopeKeyboard() }
    );
  }
}

async function handleScopeCallbackInternal(bot2, chatId, userId, data) {
  const { getState, setState, clearTextParts, getMergedText, saveAutoReply,
          addPoints, getUser, mainMenuKeyboard, DEVELOPER_ID } = _deps;
  const scopeMap = { scope_private: "private", scope_groups: "groups", scope_both: "both" };
  const scope = scopeMap[data];
  if (!scope) return;
  const state = getState(userId);
  const { trigger, triggerType, caseSensitive, replyType, replyContent, target, targetNumbers } = state.data;
  setState(userId, "idle");
  const newReply = {
    trigger: trigger || "default",
    triggerType: triggerType || "exact",
    caseSensitive: caseSensitive || false,
    replyType: replyType || "text",
    replyContent: replyContent || getMergedText(userId) || "",
    target: target || "all",
    targetNumbers: targetNumbers || [],
    scope
  };
  clearTextParts(userId);
  saveAutoReply(userId, newReply);
  addPoints(userId, 5, "إضافة رد تلقائي");
  const freshUser = getUser(userId);
  const scopeLabels = {
    private: "المحادثات الخاصة فقط",
    groups: "المجموعات فقط",
    both: "المحادثات الخاصة والمجموعات"
  };
  await bot2.sendMessage(
    chatId,
    `✅ *تم حفظ الرد التلقائي!*\n\n🔑 المفتاح: "${trigger}"\n📊 التطابق: ${triggerType || "exact"}\n📝 النوع: ${replyType || "text"}\n👥 الهدف: ${target || "all"}\n🌍 النطاق: ${scopeLabels[scope]}\n\n💰 +5 نقاط!`,
    {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard(freshUser.points || 0, freshUser.tier, userId === DEVELOPER_ID)
    }
  );
}

// ─────────────────────────────────────────────────────────────
// الدوال المُصدَّرة العامة
// ─────────────────────────────────────────────────────────────

export async function showReplies(bot2, chatId, userId) {
  const { getUserReplies, repliesMenuKeyboard } = _deps;
  const replies = getUserReplies(userId);
  const active = replies.filter((r) => r.isActive).length;
  const inactive = replies.length - active;
  await bot2.sendMessage(
    chatId,
    `⚙️ *إدارة الردود التلقائية*\n\n📊 الإجمالي: ${replies.length} رد\n✅ نشط: ${active} | ❌ معطّل: ${inactive}\n\nالردود تُطبَّق على رسائل واتساب تلقائياً.\nيمكنك إضافة ردود نصية، صور، ملفات، أو بالذكاء الاصطناعي.`,
    {
      parse_mode: "Markdown",
      reply_markup: repliesMenuKeyboard(active, inactive)
    }
  );
}

export async function handleAddReply(bot2, chatId, userId) {
  const { setState, cancelKeyboard, VARIABLES_HELP } = _deps;
  setState(userId, "awaiting_trigger");
  await bot2.sendMessage(
    chatId,
    `➕ *إضافة رد تلقائي جديد*\n\n*الخطوة 1/4:* أدخل الكلمة أو الجملة التي إذا أرسلها شخص، يرد البوت تلقائياً:\n\n${VARIABLES_HELP}\n\n💡 مثال: "مرحبا" أو "السعر" أو "التوصيل"`,
    { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
  );
}

export async function handleAutoReplyCallback(bot2, chatId, userId, data) {
  const {
    getUser, getUserReplies, saveAutoReply, deleteAutoReply, toggleAutoReply,
    getReplyStat, inMemoryDB, addPoints, getState, setState, clearState,
    appendTextPart, clearTextParts, getMergedText,
    repliesMenuKeyboard, replyListKeyboard, singleReplyKeyboard, cancelKeyboard,
    mainMenuKeyboard, longTextDoneKeyboard, DEVELOPER_ID
  } = _deps;

  const user = getUser(userId);
  const isDev2 = userId === DEVELOPER_ID;

  if (data === "menu_replies") {
    await showReplies(bot2, chatId, userId);
    return true;
  }
  if (data === "reply_add") {
    await handleAddReply(bot2, chatId, userId);
    return true;
  }
  if (data === "reply_list") {
    const replies = getUserReplies(userId);
    if (replies.length === 0) {
      await bot2.sendMessage(chatId, "📋 لا توجد ردود بعد.\n\nاضغط ➕ لإضافة أول رد!", {
        reply_markup: repliesMenuKeyboard(0, 0)
      });
      return true;
    }
    await bot2.sendMessage(
      chatId,
      `📋 *ردودك (${replies.length}):*\n\naضغط على رد لإدارته:`,
      { parse_mode: "Markdown", reply_markup: replyListKeyboard(replies) }
    );
    return true;
  }
  if (data === "reply_toggle" || data === "reply_delete" || data === "reply_edit") {
    const replies = getUserReplies(userId);
    if (replies.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود");
      return true;
    }
    await bot2.sendMessage(chatId, "اختر الرد:", { reply_markup: replyListKeyboard(replies) });
    return true;
  }
  if (data === "reply_search") {
    setState(userId, "awaiting_search_reply");
    await bot2.sendMessage(chatId, "🔍 أدخل كلمة للبحث في ردودك:", { reply_markup: cancelKeyboard() });
    return true;
  }
  if (data === "reply_stats_all") {
    const replies = getUserReplies(userId);
    if (replies.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود");
      return true;
    }
    const stats = replies.map(
      (r) => `• "${r.trigger.slice(0, 25)}" → ${getReplyStat(userId, r.id)} مرة${r.isActive ? "" : " ❌"}`
    ).join("\n");
    await bot2.sendMessage(
      chatId,
      `📊 *إحصائيات الردود التلقائية:*\n\n${stats}\n\n📈 إجمالي: ${replies.reduce((s, r) => s + getReplyStat(userId, r.id), 0)} رد`,
      { parse_mode: "Markdown", reply_markup: repliesMenuKeyboard(replies.filter((r) => r.isActive).length, replies.filter((r) => !r.isActive).length) }
    );
    return true;
  }
  if (data === "reply_reaction") {
    setState(userId, "awaiting_trigger", { replyType: "reaction" });
    await bot2.sendMessage(
      chatId,
      `😊 *رد بتفاعل (Reaction)*\n\nبدلاً من إرسال رسالة نصية، سيُضاف تفاعل إيموجي على رسالة المُرسِل.\n\n*الخطوة 1:* أدخل الكلمة المفتاحية:`,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return true;
  }
  if (data === "reply_random_delay") {
    const numMgr = await _deps.getNumberManager();
    const nums = numMgr.getUserNumbers(userId);
    const activeNum = nums.find((n) => n.status === "active");
    if (!activeNum) {
      await bot2.sendMessage(chatId, "❌ لا يوجد رقم نشط. ربط واتساب أولاً.");
      return true;
    }
    const current = activeNum.randomDelayEnabled || false;
    await numMgr.updateNumber(userId, activeNum.id, { ...activeNum, randomDelayEnabled: !current });
    await bot2.sendMessage(
      chatId,
      `⏱️ *التأخير العشوائي: ${!current ? "✅ مفعّل" : "❌ معطّل"}*\n\n${!current ? "سيضيف البوت 1-5 ثوانٍ عشوائية بين الردود لتبدو أكثر طبيعية وتقلل خطر الحظر." : ""}`,
      { parse_mode: "Markdown" }
    );
    return true;
  }
  if (data === "reply_rotating") {
    setState(userId, "awaiting_rotating_trigger");
    await bot2.sendMessage(
      chatId,
      `🔄 *الردود المتناوبة*\n\nالبوت يتناوب بين عدة ردود لنفس الكلمة المفتاحية لتبدو الردود متنوعة وطبيعية.\n\n*الخطوة 1/2:* أدخل الكلمة المفتاحية:`,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return true;
  }
  // PATCH_PER_USER_LIMIT_FIX_APPLIED
  if (data === "reply_per_user_limit") {
    const repliesPU = _deps.getUserReplies(userId);
    if (repliesPU.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود.");
      return true;
    }
    const rows = repliesPU.slice(0, 15).map((r) => [{
      text: (r.isActive ? "✅" : "❌") + " " + r.trigger.slice(0, 30),
      callback_data: "set_per_user_" + r.id
    }]);
    rows.push([{ text: "🏠 الرئيسية", callback_data: "home" }]);
    await bot2.sendMessage(chatId,
      "👤 *حد كل شخص / 8 ساعات*\n\nاختر الرد:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }
    );
    return true;
  }
  if (data.startsWith("set_per_user_")) {
    const replyIdPU = data.replace("set_per_user_", "");
    const repliesPU2 = _deps.getUserReplies(userId);
    const replyPU2 = repliesPU2.find((r) => r.id === replyIdPU);
    if (!replyPU2) { await bot2.sendMessage(chatId, "❌ الرد غير موجود"); return true; }
    const { setState: stPU, cancelKeyboard: ckPU } = _deps;
    stPU(userId, "awaiting_reply_per_user_limit", { limitReplyId: replyIdPU });
    await bot2.sendMessage(chatId,
      `👤 *حد كل شخص / 8 ساعات*\n\nالرد: "${replyPU2.trigger.slice(0,30)}"\nالحد الحالي: ${replyPU2.perUserLimit || 0}\n\nأرسل الرقم الجديد (0 = بلا حد):`,
      { parse_mode: "Markdown", reply_markup: ckPU() }
    );
    return true;
  }
  // [FIX_BUG002] reply_daily_limit — لم يكن موجوداً → كانت الضغطة تُفقد في الفراغ
  if (data === "reply_daily_limit") {
    const repliesDL = getUserReplies(userId);
    if (repliesDL.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود.");
      return true;
    }
    const rows = repliesDL.slice(0, 15).map((r) => [{
      text: (r.isActive ? "✅" : "❌") + " " + r.trigger.slice(0, 28) + ` (${r.dailyLimit || 0}/يوم)`,
      callback_data: "set_daily_" + r.id
    }]);
    rows.push([{ text: "🏠 الرئيسية", callback_data: "home" }]);
    await bot2.sendMessage(chatId,
      "📊 *الحد اليومي للرد*\n\nاختر الرد لتعديل حده اليومي (0 = بلا حد):",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }
    );
    return true;
  }
  // [FIX_BUG002] set_daily_{id} — تابع لـ reply_daily_limit
  if (data.startsWith("set_daily_")) {
    const replyIdDL = data.replace("set_daily_", "");
    const repliesDL2 = getUserReplies(userId);
    const replyDL = repliesDL2.find((r) => r.id === replyIdDL);
    if (!replyDL) { await bot2.sendMessage(chatId, "❌ الرد غير موجود"); return true; }
    _deps.setState(userId, "awaiting_reply_daily_limit", { limitReplyId: replyIdDL });
    await bot2.sendMessage(chatId,
      `📊 *الحد اليومي*\n\nالرد: "${replyDL.trigger.slice(0, 30)}"\nالحد الحالي: ${replyDL.dailyLimit || 0} رسالة/يوم\n\nأرسل الرقم الجديد (0 = بلا حد):`,
      { parse_mode: "Markdown", reply_markup: _deps.cancelKeyboard() }
    );
    return true;
  }
  // [FIX_BUG003] reply_lang_filter — لم يكن موجوداً → كانت الضغطة تُفقد في الفراغ
  if (data === "reply_lang_filter") {
    const repliesFL = getUserReplies(userId);
    const activeFL = repliesFL.filter((r) => r.isActive).length;
    await bot2.sendMessage(chatId,
      "🔜 *فلتر اللغة*\n\nهذه الميزة قيد التطوير. يمكنك ضبط اللغة من حقل `langFilter` عند استيراد الردود بصيغة JSON.",
      { parse_mode: "Markdown", reply_markup: repliesMenuKeyboard(activeFL, repliesFL.length - activeFL) }
    );
    return true;
  }
  // [FIX_BUG004] reply_duplicate — لم يكن موجوداً → كانت الضغطة تُفقد في الفراغ
  if (data === "reply_duplicate") {
    const repliesDUP = getUserReplies(userId);
    if (repliesDUP.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود للنسخ.");
      return true;
    }
    const rows = repliesDUP.slice(0, 15).map((r) => [{
      text: (r.isActive ? "✅" : "❌") + " " + r.trigger.slice(0, 30),
      callback_data: "dup_reply_" + r.id
    }]);
    rows.push([{ text: "🏠 الرئيسية", callback_data: "home" }]);
    await bot2.sendMessage(chatId,
      "📋 *نسخ رد*\n\nاختر الرد الذي تريد نسخه:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }
    );
    return true;
  }
  // [FIX_BUG004] dup_reply_{id} — تابع لـ reply_duplicate
  if (data.startsWith("dup_reply_")) {
    const replyIdDUP = data.replace("dup_reply_", "");
    const repliesDUP2 = getUserReplies(userId);
    const replyDUP = repliesDUP2.find((r) => r.id === replyIdDUP);
    if (!replyDUP) { await bot2.sendMessage(chatId, "❌ الرد غير موجود"); return true; }
    const { id: _omit1, createdAt: _omit2, ...replyBody } = replyDUP;
    saveAutoReply(userId, {
      ...replyBody,
      trigger: "نسخة — " + replyDUP.trigger
    });
    // [FIX_NEW_2] saveAutoReply تُجبر isActive: true دائماً — نُطفئ النسخة فوراً بعد الحفظ
    const allAfterDup = getUserReplies(userId);
    const newDupReply = allAfterDup[allAfterDup.length - 1];
    if (newDupReply) toggleAutoReply(userId, newDupReply.id);
    const freshReplies = getUserReplies(userId);
    const freshActive = freshReplies.filter((r) => r.isActive).length;
    await bot2.sendMessage(chatId,
      `✅ *تم النسخ!*\n\nالمفتاح: "نسخة — ${replyDUP.trigger.slice(0, 28)}"\n⚠️ الحالة: معطّل — فعّله من القائمة`,
      { parse_mode: "Markdown", reply_markup: repliesMenuKeyboard(freshActive, freshReplies.length - freshActive) }
    );
    return true;
  }
  // PATCH_PER_USER_LIMIT_FIX_APPLIED
  if (data === "reply_per_user_limit") {
    const repliesPU = _deps.getUserReplies(userId);
    if (repliesPU.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود.");
      return true;
    }
    const rows = repliesPU.slice(0, 15).map((r) => [{
      text: (r.isActive ? "✅" : "❌") + " " + r.trigger.slice(0, 30),
      callback_data: "set_per_user_" + r.id
    }]);
    rows.push([{ text: "🏠 الرئيسية", callback_data: "home" }]);
    await bot2.sendMessage(chatId,
      "👤 *حد كل شخص / 8 ساعات*\n\nاختر الرد:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }
    );
    return true;
  }
  if (data.startsWith("set_per_user_")) {
    const replyIdPU = data.replace("set_per_user_", "");
    const repliesPU2 = _deps.getUserReplies(userId);
    const replyPU2 = repliesPU2.find((r) => r.id === replyIdPU);
    if (!replyPU2) { await bot2.sendMessage(chatId, "❌ الرد غير موجود"); return true; }
    const { setState: stPU, cancelKeyboard: ckPU } = _deps;
    stPU(userId, "awaiting_reply_per_user_limit", { limitReplyId: replyIdPU });
    await bot2.sendMessage(chatId,
      `👤 *حد كل شخص / 8 ساعات*\n\nالرد: "${replyPU2.trigger.slice(0,30)}"\nالحد الحالي: ${replyPU2.perUserLimit || 0}\n\nأرسل الرقم الجديد (0 = بلا حد):`,
      { parse_mode: "Markdown", reply_markup: ckPU() }
    );
    return true;
  }
  // PATCH_PER_USER_LIMIT_FIX_APPLIED
  if (data === "reply_per_user_limit") {
    const repliesPU = _deps.getUserReplies(userId);
    if (repliesPU.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود.");
      return true;
    }
    const rows = repliesPU.slice(0, 15).map((r) => [{
      text: (r.isActive ? "✅" : "❌") + " " + r.trigger.slice(0, 30),
      callback_data: "set_per_user_" + r.id
    }]);
    rows.push([{ text: "🏠 الرئيسية", callback_data: "home" }]);
    await bot2.sendMessage(chatId,
      "👤 *حد كل شخص / 8 ساعات*\n\nاختر الرد:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }
    );
    return true;
  }
  if (data.startsWith("set_per_user_")) {
    const replyIdPU = data.replace("set_per_user_", "");
    const repliesPU2 = _deps.getUserReplies(userId);
    const replyPU2 = repliesPU2.find((r) => r.id === replyIdPU);
    if (!replyPU2) { await bot2.sendMessage(chatId, "❌ الرد غير موجود"); return true; }
    const { setState: stPU, cancelKeyboard: ckPU } = _deps;
    stPU(userId, "awaiting_reply_per_user_limit", { limitReplyId: replyIdPU });
    await bot2.sendMessage(chatId,
      `👤 *حد كل شخص / 8 ساعات*\n\nالرد: "${replyPU2.trigger.slice(0,30)}"\nالحد الحالي: ${replyPU2.perUserLimit || 0}\n\nأرسل الرقم الجديد (0 = بلا حد):`,
      { parse_mode: "Markdown", reply_markup: ckPU() }
    );
    return true;
  }
  // PATCH_PER_USER_LIMIT_FIX_APPLIED
  if (data === "reply_per_user_limit") {
    const repliesPU = _deps.getUserReplies(userId);
    if (repliesPU.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود.");
      return true;
    }
    const rows = repliesPU.slice(0, 15).map((r) => [{
      text: (r.isActive ? "✅" : "❌") + " " + r.trigger.slice(0, 30),
      callback_data: "set_per_user_" + r.id
    }]);
    rows.push([{ text: "🏠 الرئيسية", callback_data: "home" }]);
    await bot2.sendMessage(chatId,
      "👤 *حد كل شخص / 8 ساعات*\n\nاختر الرد:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }
    );
    return true;
  }
  if (data.startsWith("set_per_user_")) {
    const replyIdPU = data.replace("set_per_user_", "");
    const repliesPU2 = _deps.getUserReplies(userId);
    const replyPU2 = repliesPU2.find((r) => r.id === replyIdPU);
    if (!replyPU2) { await bot2.sendMessage(chatId, "❌ الرد غير موجود"); return true; }
    const { setState: stPU, cancelKeyboard: ckPU } = _deps;
    stPU(userId, "awaiting_reply_per_user_limit", { limitReplyId: replyIdPU });
    await bot2.sendMessage(chatId,
      `👤 *حد كل شخص / 8 ساعات*\n\nالرد: "${replyPU2.trigger.slice(0,30)}"\nالحد الحالي: ${replyPU2.perUserLimit || 0}\n\nأرسل الرقم الجديد (0 = بلا حد):`,
      { parse_mode: "Markdown", reply_markup: ckPU() }
    );
    return true;
  }
  // PATCH_PER_USER_LIMIT_FIX_APPLIED
  if (data === "reply_per_user_limit") {
    const repliesPU = _deps.getUserReplies(userId);
    if (repliesPU.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود.");
      return true;
    }
    const rows = repliesPU.slice(0, 15).map((r) => [{
      text: (r.isActive ? "✅" : "❌") + " " + r.trigger.slice(0, 30),
      callback_data: "set_per_user_" + r.id
    }]);
    rows.push([{ text: "🏠 الرئيسية", callback_data: "home" }]);
    await bot2.sendMessage(chatId,
      "👤 *حد كل شخص / 8 ساعات*\n\nاختر الرد:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }
    );
    return true;
  }
  if (data.startsWith("set_per_user_")) {
    const replyIdPU = data.replace("set_per_user_", "");
    const repliesPU2 = _deps.getUserReplies(userId);
    const replyPU2 = repliesPU2.find((r) => r.id === replyIdPU);
    if (!replyPU2) { await bot2.sendMessage(chatId, "❌ الرد غير موجود"); return true; }
    const { setState: stPU, cancelKeyboard: ckPU } = _deps;
    stPU(userId, "awaiting_reply_per_user_limit", { limitReplyId: replyIdPU });
    await bot2.sendMessage(chatId,
      `👤 *حد كل شخص / 8 ساعات*\n\nالرد: "${replyPU2.trigger.slice(0,30)}"\nالحد الحالي: ${replyPU2.perUserLimit || 0}\n\nأرسل الرقم الجديد (0 = بلا حد):`,
      { parse_mode: "Markdown", reply_markup: ckPU() }
    );
    return true;
  }
  // PATCH_PER_USER_LIMIT_FIX_APPLIED
  if (data === "reply_per_user_limit") {
    const repliesPU = _deps.getUserReplies(userId);
    if (repliesPU.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود.");
      return true;
    }
    const rows = repliesPU.slice(0, 15).map((r) => [{
      text: (r.isActive ? "✅" : "❌") + " " + r.trigger.slice(0, 30),
      callback_data: "set_per_user_" + r.id
    }]);
    rows.push([{ text: "🏠 الرئيسية", callback_data: "home" }]);
    await bot2.sendMessage(chatId,
      "👤 *حد كل شخص / 8 ساعات*\n\nاختر الرد:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }
    );
    return true;
  }
  if (data.startsWith("set_per_user_")) {
    const replyIdPU = data.replace("set_per_user_", "");
    const repliesPU2 = _deps.getUserReplies(userId);
    const replyPU2 = repliesPU2.find((r) => r.id === replyIdPU);
    if (!replyPU2) { await bot2.sendMessage(chatId, "❌ الرد غير موجود"); return true; }
    const { setState: stPU, cancelKeyboard: ckPU } = _deps;
    stPU(userId, "awaiting_reply_per_user_limit", { limitReplyId: replyIdPU });
    await bot2.sendMessage(chatId,
      `👤 *حد كل شخص / 8 ساعات*\n\nالرد: "${replyPU2.trigger.slice(0,30)}"\nالحد الحالي: ${replyPU2.perUserLimit || 0}\n\nأرسل الرقم الجديد (0 = بلا حد):`,
      { parse_mode: "Markdown", reply_markup: ckPU() }
    );
    return true;
  }
  // PATCH_PER_USER_LIMIT_FIX_APPLIED
  if (data === "reply_per_user_limit") {
    const repliesPU = _deps.getUserReplies(userId);
    if (repliesPU.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود.");
      return true;
    }
    const rows = repliesPU.slice(0, 15).map((r) => [{
      text: (r.isActive ? "✅" : "❌") + " " + r.trigger.slice(0, 30),
      callback_data: "set_per_user_" + r.id
    }]);
    rows.push([{ text: "🏠 الرئيسية", callback_data: "home" }]);
    await bot2.sendMessage(chatId,
      "👤 *حد كل شخص / 8 ساعات*\n\nاختر الرد:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }
    );
    return true;
  }
  if (data.startsWith("set_per_user_")) {
    const replyIdPU = data.replace("set_per_user_", "");
    const repliesPU2 = _deps.getUserReplies(userId);
    const replyPU2 = repliesPU2.find((r) => r.id === replyIdPU);
    if (!replyPU2) { await bot2.sendMessage(chatId, "❌ الرد غير موجود"); return true; }
    const { setState: stPU, cancelKeyboard: ckPU } = _deps;
    stPU(userId, "awaiting_reply_per_user_limit", { limitReplyId: replyIdPU });
    await bot2.sendMessage(chatId,
      `👤 *حد كل شخص / 8 ساعات*\n\nالرد: "${replyPU2.trigger.slice(0,30)}"\nالحد الحالي: ${replyPU2.perUserLimit || 0}\n\nأرسل الرقم الجديد (0 = بلا حد):`,
      { parse_mode: "Markdown", reply_markup: ckPU() }
    );
    return true;
  }
  // PATCH_PER_USER_LIMIT_FIX_APPLIED
  if (data === "reply_per_user_limit") {
    const repliesPU = _deps.getUserReplies(userId);
    if (repliesPU.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود.");
      return true;
    }
    const rows = repliesPU.slice(0, 15).map((r) => [{
      text: (r.isActive ? "✅" : "❌") + " " + r.trigger.slice(0, 30),
      callback_data: "set_per_user_" + r.id
    }]);
    rows.push([{ text: "🏠 الرئيسية", callback_data: "home" }]);
    await bot2.sendMessage(chatId,
      "👤 *حد كل شخص / 8 ساعات*\n\nاختر الرد:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }
    );
    return true;
  }
  if (data.startsWith("set_per_user_")) {
    const replyIdPU = data.replace("set_per_user_", "");
    const repliesPU2 = _deps.getUserReplies(userId);
    const replyPU2 = repliesPU2.find((r) => r.id === replyIdPU);
    if (!replyPU2) { await bot2.sendMessage(chatId, "❌ الرد غير موجود"); return true; }
    const { setState: stPU, cancelKeyboard: ckPU } = _deps;
    stPU(userId, "awaiting_reply_per_user_limit", { limitReplyId: replyIdPU });
    await bot2.sendMessage(chatId,
      `👤 *حد كل شخص / 8 ساعات*\n\nالرد: "${replyPU2.trigger.slice(0,30)}"\nالحد الحالي: ${replyPU2.perUserLimit || 0}\n\nأرسل الرقم الجديد (0 = بلا حد):`,
      { parse_mode: "Markdown", reply_markup: ckPU() }
    );
    return true;
  }
  // PATCH_PER_USER_LIMIT_FIX_APPLIED
  if (data === "reply_per_user_limit") {
    const repliesPU = _deps.getUserReplies(userId);
    if (repliesPU.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود.");
      return true;
    }
    const rows = repliesPU.slice(0, 15).map((r) => [{
      text: (r.isActive ? "✅" : "❌") + " " + r.trigger.slice(0, 30),
      callback_data: "set_per_user_" + r.id
    }]);
    rows.push([{ text: "🏠 الرئيسية", callback_data: "home" }]);
    await bot2.sendMessage(chatId,
      "👤 *حد كل شخص / 8 ساعات*\n\nاختر الرد:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }
    );
    return true;
  }
  if (data.startsWith("set_per_user_")) {
    const replyIdPU = data.replace("set_per_user_", "");
    const repliesPU2 = _deps.getUserReplies(userId);
    const replyPU2 = repliesPU2.find((r) => r.id === replyIdPU);
    if (!replyPU2) { await bot2.sendMessage(chatId, "❌ الرد غير موجود"); return true; }
    const { setState: stPU, cancelKeyboard: ckPU } = _deps;
    stPU(userId, "awaiting_reply_per_user_limit", { limitReplyId: replyIdPU });
    await bot2.sendMessage(chatId,
      `👤 *حد كل شخص / 8 ساعات*\n\nالرد: "${replyPU2.trigger.slice(0,30)}"\nالحد الحالي: ${replyPU2.perUserLimit || 0}\n\nأرسل الرقم الجديد (0 = بلا حد):`,
      { parse_mode: "Markdown", reply_markup: ckPU() }
    );
    return true;
  }
  // PATCH_PER_USER_LIMIT_FIX_APPLIED
  if (data === "reply_per_user_limit") {
    const repliesPU = _deps.getUserReplies(userId);
    if (repliesPU.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود.");
      return true;
    }
    const rows = repliesPU.slice(0, 15).map((r) => [{
      text: (r.isActive ? "✅" : "❌") + " " + r.trigger.slice(0, 30),
      callback_data: "set_per_user_" + r.id
    }]);
    rows.push([{ text: "🏠 الرئيسية", callback_data: "home" }]);
    await bot2.sendMessage(chatId,
      "👤 *حد كل شخص / 8 ساعات*\n\nاختر الرد:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }
    );
    return true;
  }
  if (data.startsWith("set_per_user_")) {
    const replyIdPU = data.replace("set_per_user_", "");
    const repliesPU2 = _deps.getUserReplies(userId);
    const replyPU2 = repliesPU2.find((r) => r.id === replyIdPU);
    if (!replyPU2) { await bot2.sendMessage(chatId, "❌ الرد غير موجود"); return true; }
    const { setState: stPU, cancelKeyboard: ckPU } = _deps;
    stPU(userId, "awaiting_reply_per_user_limit", { limitReplyId: replyIdPU });
    await bot2.sendMessage(chatId,
      `👤 *حد كل شخص / 8 ساعات*\n\nالرد: "${replyPU2.trigger.slice(0,30)}"\nالحد الحالي: ${replyPU2.perUserLimit || 0}\n\nأرسل الرقم الجديد (0 = بلا حد):`,
      { parse_mode: "Markdown", reply_markup: ckPU() }
    );
    return true;
  }
  // PATCH_PER_USER_LIMIT_FIX_APPLIED
  if (data === "reply_per_user_limit") {
    const repliesPU = _deps.getUserReplies(userId);
    if (repliesPU.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود.");
      return true;
    }
    const rows = repliesPU.slice(0, 15).map((r) => [{
      text: (r.isActive ? "✅" : "❌") + " " + r.trigger.slice(0, 30),
      callback_data: "set_per_user_" + r.id
    }]);
    rows.push([{ text: "🏠 الرئيسية", callback_data: "home" }]);
    await bot2.sendMessage(chatId,
      "👤 *حد كل شخص / 8 ساعات*\n\nاختر الرد:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }
    );
    return true;
  }
  if (data.startsWith("set_per_user_")) {
    const replyIdPU = data.replace("set_per_user_", "");
    const repliesPU2 = _deps.getUserReplies(userId);
    const replyPU2 = repliesPU2.find((r) => r.id === replyIdPU);
    if (!replyPU2) { await bot2.sendMessage(chatId, "❌ الرد غير موجود"); return true; }
    const { setState: stPU, cancelKeyboard: ckPU } = _deps;
    stPU(userId, "awaiting_reply_per_user_limit", { limitReplyId: replyIdPU });
    await bot2.sendMessage(chatId,
      `👤 *حد كل شخص / 8 ساعات*\n\nالرد: "${replyPU2.trigger.slice(0,30)}"\nالحد الحالي: ${replyPU2.perUserLimit || 0}\n\nأرسل الرقم الجديد (0 = بلا حد):`,
      { parse_mode: "Markdown", reply_markup: ckPU() }
    );
    return true;
  }
  // PATCH_PER_USER_LIMIT_FIX_APPLIED
  if (data === "reply_per_user_limit") {
    const repliesPU = _deps.getUserReplies(userId);
    if (repliesPU.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود.");
      return true;
    }
    const rows = repliesPU.slice(0, 15).map((r) => [{
      text: (r.isActive ? "✅" : "❌") + " " + r.trigger.slice(0, 30),
      callback_data: "set_per_user_" + r.id
    }]);
    rows.push([{ text: "🏠 الرئيسية", callback_data: "home" }]);
    await bot2.sendMessage(chatId,
      "👤 *حد كل شخص / 8 ساعات*\n\nاختر الرد:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }
    );
    return true;
  }
  if (data.startsWith("set_per_user_")) {
    const replyIdPU = data.replace("set_per_user_", "");
    const repliesPU2 = _deps.getUserReplies(userId);
    const replyPU2 = repliesPU2.find((r) => r.id === replyIdPU);
    if (!replyPU2) { await bot2.sendMessage(chatId, "❌ الرد غير موجود"); return true; }
    const { setState: stPU, cancelKeyboard: ckPU } = _deps;
    stPU(userId, "awaiting_reply_per_user_limit", { limitReplyId: replyIdPU });
    await bot2.sendMessage(chatId,
      `👤 *حد كل شخص / 8 ساعات*\n\nالرد: "${replyPU2.trigger.slice(0,30)}"\nالحد الحالي: ${replyPU2.perUserLimit || 0}\n\nأرسل الرقم الجديد (0 = بلا حد):`,
      { parse_mode: "Markdown", reply_markup: ckPU() }
    );
    return true;
  }
  // PATCH_PER_USER_LIMIT_FIX_APPLIED
  if (data === "reply_per_user_limit") {
    const repliesPU = _deps.getUserReplies(userId);
    if (repliesPU.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود.");
      return true;
    }
    const rows = repliesPU.slice(0, 15).map((r) => [{
      text: (r.isActive ? "✅" : "❌") + " " + r.trigger.slice(0, 30),
      callback_data: "set_per_user_" + r.id
    }]);
    rows.push([{ text: "🏠 الرئيسية", callback_data: "home" }]);
    await bot2.sendMessage(chatId,
      "👤 *حد كل شخص / 8 ساعات*\n\nاختر الرد:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }
    );
    return true;
  }
  if (data.startsWith("set_per_user_")) {
    const replyIdPU = data.replace("set_per_user_", "");
    const repliesPU2 = _deps.getUserReplies(userId);
    const replyPU2 = repliesPU2.find((r) => r.id === replyIdPU);
    if (!replyPU2) { await bot2.sendMessage(chatId, "❌ الرد غير موجود"); return true; }
    const { setState: stPU, cancelKeyboard: ckPU } = _deps;
    stPU(userId, "awaiting_reply_per_user_limit", { limitReplyId: replyIdPU });
    await bot2.sendMessage(chatId,
      `👤 *حد كل شخص / 8 ساعات*\n\nالرد: "${replyPU2.trigger.slice(0,30)}"\nالحد الحالي: ${replyPU2.perUserLimit || 0}\n\nأرسل الرقم الجديد (0 = بلا حد):`,
      { parse_mode: "Markdown", reply_markup: ckPU() }
    );
    return true;
  }
  // PATCH_PER_USER_LIMIT_FIX_APPLIED
  if (data === "reply_per_user_limit") {
    const repliesPU = _deps.getUserReplies(userId);
    if (repliesPU.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود.");
      return true;
    }
    const rows = repliesPU.slice(0, 15).map((r) => [{
      text: (r.isActive ? "✅" : "❌") + " " + r.trigger.slice(0, 30),
      callback_data: "set_per_user_" + r.id
    }]);
    rows.push([{ text: "🏠 الرئيسية", callback_data: "home" }]);
    await bot2.sendMessage(chatId,
      "👤 *حد كل شخص / 8 ساعات*\n\nاختر الرد:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }
    );
    return true;
  }
  if (data.startsWith("set_per_user_")) {
    const replyIdPU = data.replace("set_per_user_", "");
    const repliesPU2 = _deps.getUserReplies(userId);
    const replyPU2 = repliesPU2.find((r) => r.id === replyIdPU);
    if (!replyPU2) { await bot2.sendMessage(chatId, "❌ الرد غير موجود"); return true; }
    const { setState: stPU, cancelKeyboard: ckPU } = _deps;
    stPU(userId, "awaiting_reply_per_user_limit", { limitReplyId: replyIdPU });
    await bot2.sendMessage(chatId,
      `👤 *حد كل شخص / 8 ساعات*\n\nالرد: "${replyPU2.trigger.slice(0,30)}"\nالحد الحالي: ${replyPU2.perUserLimit || 0}\n\nأرسل الرقم الجديد (0 = بلا حد):`,
      { parse_mode: "Markdown", reply_markup: ckPU() }
    );
    return true;
  }
  // PATCH_PER_USER_LIMIT_FIX_APPLIED
  if (data === "reply_per_user_limit") {
    const repliesPU = _deps.getUserReplies(userId);
    if (repliesPU.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود.");
      return true;
    }
    const rows = repliesPU.slice(0, 15).map((r) => [{
      text: (r.isActive ? "✅" : "❌") + " " + r.trigger.slice(0, 30),
      callback_data: "set_per_user_" + r.id
    }]);
    rows.push([{ text: "🏠 الرئيسية", callback_data: "home" }]);
    await bot2.sendMessage(chatId,
      "👤 *حد كل شخص / 8 ساعات*\n\nاختر الرد:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }
    );
    return true;
  }
  if (data.startsWith("set_per_user_")) {
    const replyIdPU = data.replace("set_per_user_", "");
    const repliesPU2 = _deps.getUserReplies(userId);
    const replyPU2 = repliesPU2.find((r) => r.id === replyIdPU);
    if (!replyPU2) { await bot2.sendMessage(chatId, "❌ الرد غير موجود"); return true; }
    const { setState: stPU, cancelKeyboard: ckPU } = _deps;
    stPU(userId, "awaiting_reply_per_user_limit", { limitReplyId: replyIdPU });
    await bot2.sendMessage(chatId,
      `👤 *حد كل شخص / 8 ساعات*\n\nالرد: "${replyPU2.trigger.slice(0,30)}"\nالحد الحالي: ${replyPU2.perUserLimit || 0}\n\nأرسل الرقم الجديد (0 = بلا حد):`,
      { parse_mode: "Markdown", reply_markup: ckPU() }
    );
    return true;
  }
  // PATCH_PER_USER_LIMIT_FIX_APPLIED
  if (data === "reply_per_user_limit") {
    const repliesPU = _deps.getUserReplies(userId);
    if (repliesPU.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود.");
      return true;
    }
    const rows = repliesPU.slice(0, 15).map((r) => [{
      text: (r.isActive ? "✅" : "❌") + " " + r.trigger.slice(0, 30),
      callback_data: "set_per_user_" + r.id
    }]);
    rows.push([{ text: "🏠 الرئيسية", callback_data: "home" }]);
    await bot2.sendMessage(chatId,
      "👤 *حد كل شخص / 8 ساعات*\n\nاختر الرد:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }
    );
    return true;
  }
  if (data.startsWith("set_per_user_")) {
    const replyIdPU = data.replace("set_per_user_", "");
    const repliesPU2 = _deps.getUserReplies(userId);
    const replyPU2 = repliesPU2.find((r) => r.id === replyIdPU);
    if (!replyPU2) { await bot2.sendMessage(chatId, "❌ الرد غير موجود"); return true; }
    const { setState: stPU, cancelKeyboard: ckPU } = _deps;
    stPU(userId, "awaiting_reply_per_user_limit", { limitReplyId: replyIdPU });
    await bot2.sendMessage(chatId,
      `👤 *حد كل شخص / 8 ساعات*\n\nالرد: "${replyPU2.trigger.slice(0,30)}"\nالحد الحالي: ${replyPU2.perUserLimit || 0}\n\nأرسل الرقم الجديد (0 = بلا حد):`,
      { parse_mode: "Markdown", reply_markup: ckPU() }
    );
    return true;
  }
  // PATCH_PER_USER_LIMIT_FIX_APPLIED
  if (data === "reply_per_user_limit") {
    const repliesPU = _deps.getUserReplies(userId);
    if (repliesPU.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود.");
      return true;
    }
    const rows = repliesPU.slice(0, 15).map((r) => [{
      text: (r.isActive ? "✅" : "❌") + " " + r.trigger.slice(0, 30),
      callback_data: "set_per_user_" + r.id
    }]);
    rows.push([{ text: "🏠 الرئيسية", callback_data: "home" }]);
    await bot2.sendMessage(chatId,
      "👤 *حد كل شخص / 8 ساعات*\n\nاختر الرد:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }
    );
    return true;
  }
  if (data.startsWith("set_per_user_")) {
    const replyIdPU = data.replace("set_per_user_", "");
    const repliesPU2 = _deps.getUserReplies(userId);
    const replyPU2 = repliesPU2.find((r) => r.id === replyIdPU);
    if (!replyPU2) { await bot2.sendMessage(chatId, "❌ الرد غير موجود"); return true; }
    const { setState: stPU, cancelKeyboard: ckPU } = _deps;
    stPU(userId, "awaiting_reply_per_user_limit", { limitReplyId: replyIdPU });
    await bot2.sendMessage(chatId,
      `👤 *حد كل شخص / 8 ساعات*\n\nالرد: "${replyPU2.trigger.slice(0,30)}"\nالحد الحالي: ${replyPU2.perUserLimit || 0}\n\nأرسل الرقم الجديد (0 = بلا حد):`,
      { parse_mode: "Markdown", reply_markup: ckPU() }
    );
    return true;
  }
  // PATCH_PER_USER_LIMIT_FIX_APPLIED
  if (data === "reply_per_user_limit") {
    const repliesPU = _deps.getUserReplies(userId);
    if (repliesPU.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود.");
      return true;
    }
    const rows = repliesPU.slice(0, 15).map((r) => [{
      text: (r.isActive ? "✅" : "❌") + " " + r.trigger.slice(0, 30),
      callback_data: "set_per_user_" + r.id
    }]);
    rows.push([{ text: "🏠 الرئيسية", callback_data: "home" }]);
    await bot2.sendMessage(chatId,
      "👤 *حد كل شخص / 8 ساعات*\n\nاختر الرد:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }
    );
    return true;
  }
  if (data.startsWith("set_per_user_")) {
    const replyIdPU = data.replace("set_per_user_", "");
    const repliesPU2 = _deps.getUserReplies(userId);
    const replyPU2 = repliesPU2.find((r) => r.id === replyIdPU);
    if (!replyPU2) { await bot2.sendMessage(chatId, "❌ الرد غير موجود"); return true; }
    const { setState: stPU, cancelKeyboard: ckPU } = _deps;
    stPU(userId, "awaiting_reply_per_user_limit", { limitReplyId: replyIdPU });
    await bot2.sendMessage(chatId,
      `👤 *حد كل شخص / 8 ساعات*\n\nالرد: "${replyPU2.trigger.slice(0,30)}"\nالحد الحالي: ${replyPU2.perUserLimit || 0}\n\nأرسل الرقم الجديد (0 = بلا حد):`,
      { parse_mode: "Markdown", reply_markup: ckPU() }
    );
    return true;
  }
  // PATCH_PER_USER_LIMIT_FIX_APPLIED
  if (data === "reply_per_user_limit") {
    const repliesPU = _deps.getUserReplies(userId);
    if (repliesPU.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود.");
      return true;
    }
    const rows = repliesPU.slice(0, 15).map((r) => [{
      text: (r.isActive ? "✅" : "❌") + " " + r.trigger.slice(0, 30),
      callback_data: "set_per_user_" + r.id
    }]);
    rows.push([{ text: "🏠 الرئيسية", callback_data: "home" }]);
    await bot2.sendMessage(chatId,
      "👤 *حد كل شخص / 8 ساعات*\n\nاختر الرد:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }
    );
    return true;
  }
  if (data.startsWith("set_per_user_")) {
    const replyIdPU = data.replace("set_per_user_", "");
    const repliesPU2 = _deps.getUserReplies(userId);
    const replyPU2 = repliesPU2.find((r) => r.id === replyIdPU);
    if (!replyPU2) { await bot2.sendMessage(chatId, "❌ الرد غير موجود"); return true; }
    const { setState: stPU, cancelKeyboard: ckPU } = _deps;
    stPU(userId, "awaiting_reply_per_user_limit", { limitReplyId: replyIdPU });
    await bot2.sendMessage(chatId,
      `👤 *حد كل شخص / 8 ساعات*\n\nالرد: "${replyPU2.trigger.slice(0,30)}"\nالحد الحالي: ${replyPU2.perUserLimit || 0}\n\nأرسل الرقم الجديد (0 = بلا حد):`,
      { parse_mode: "Markdown", reply_markup: ckPU() }
    );
    return true;
  }
  // PATCH_PER_USER_LIMIT_FIX_APPLIED
  if (data === "reply_per_user_limit") {
    const repliesPU = _deps.getUserReplies(userId);
    if (repliesPU.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود.");
      return true;
    }
    const rows = repliesPU.slice(0, 15).map((r) => [{
      text: (r.isActive ? "✅" : "❌") + " " + r.trigger.slice(0, 30),
      callback_data: "set_per_user_" + r.id
    }]);
    rows.push([{ text: "🏠 الرئيسية", callback_data: "home" }]);
    await bot2.sendMessage(chatId,
      "👤 *حد كل شخص / 8 ساعات*\n\nاختر الرد:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }
    );
    return true;
  }
  if (data.startsWith("set_per_user_")) {
    const replyIdPU = data.replace("set_per_user_", "");
    const repliesPU2 = _deps.getUserReplies(userId);
    const replyPU2 = repliesPU2.find((r) => r.id === replyIdPU);
    if (!replyPU2) { await bot2.sendMessage(chatId, "❌ الرد غير موجود"); return true; }
    const { setState: stPU, cancelKeyboard: ckPU } = _deps;
    stPU(userId, "awaiting_reply_per_user_limit", { limitReplyId: replyIdPU });
    await bot2.sendMessage(chatId,
      `👤 *حد كل شخص / 8 ساعات*\n\nالرد: "${replyPU2.trigger.slice(0,30)}"\nالحد الحالي: ${replyPU2.perUserLimit || 0}\n\nأرسل الرقم الجديد (0 = بلا حد):`,
      { parse_mode: "Markdown", reply_markup: ckPU() }
    );
    return true;
  }
  // PATCH_PER_USER_LIMIT_FIX_APPLIED
  if (data === "reply_per_user_limit") {
    const repliesPU = _deps.getUserReplies(userId);
    if (repliesPU.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود.");
      return true;
    }
    const rows = repliesPU.slice(0, 15).map((r) => [{
      text: (r.isActive ? "✅" : "❌") + " " + r.trigger.slice(0, 30),
      callback_data: "set_per_user_" + r.id
    }]);
    rows.push([{ text: "🏠 الرئيسية", callback_data: "home" }]);
    await bot2.sendMessage(chatId,
      "👤 *حد كل شخص / 8 ساعات*\n\nاختر الرد:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }
    );
    return true;
  }
  if (data.startsWith("set_per_user_")) {
    const replyIdPU = data.replace("set_per_user_", "");
    const repliesPU2 = _deps.getUserReplies(userId);
    const replyPU2 = repliesPU2.find((r) => r.id === replyIdPU);
    if (!replyPU2) { await bot2.sendMessage(chatId, "❌ الرد غير موجود"); return true; }
    const { setState: stPU, cancelKeyboard: ckPU } = _deps;
    stPU(userId, "awaiting_reply_per_user_limit", { limitReplyId: replyIdPU });
    await bot2.sendMessage(chatId,
      `👤 *حد كل شخص / 8 ساعات*\n\nالرد: "${replyPU2.trigger.slice(0,30)}"\nالحد الحالي: ${replyPU2.perUserLimit || 0}\n\nأرسل الرقم الجديد (0 = بلا حد):`,
      { parse_mode: "Markdown", reply_markup: ckPU() }
    );
    return true;
  }
  // PATCH_PER_USER_LIMIT_FIX_APPLIED
  if (data === "reply_per_user_limit") {
    const repliesPU = _deps.getUserReplies(userId);
    if (repliesPU.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود.");
      return true;
    }
    const rows = repliesPU.slice(0, 15).map((r) => [{
      text: (r.isActive ? "✅" : "❌") + " " + r.trigger.slice(0, 30),
      callback_data: "set_per_user_" + r.id
    }]);
    rows.push([{ text: "🏠 الرئيسية", callback_data: "home" }]);
    await bot2.sendMessage(chatId,
      "👤 *حد كل شخص / 8 ساعات*\n\nاختر الرد:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }
    );
    return true;
  }
  if (data.startsWith("set_per_user_")) {
    const replyIdPU = data.replace("set_per_user_", "");
    const repliesPU2 = _deps.getUserReplies(userId);
    const replyPU2 = repliesPU2.find((r) => r.id === replyIdPU);
    if (!replyPU2) { await bot2.sendMessage(chatId, "❌ الرد غير موجود"); return true; }
    const { setState: stPU, cancelKeyboard: ckPU } = _deps;
    stPU(userId, "awaiting_reply_per_user_limit", { limitReplyId: replyIdPU });
    await bot2.sendMessage(chatId,
      `👤 *حد كل شخص / 8 ساعات*\n\nالرد: "${replyPU2.trigger.slice(0,30)}"\nالحد الحالي: ${replyPU2.perUserLimit || 0}\n\nأرسل الرقم الجديد (0 = بلا حد):`,
      { parse_mode: "Markdown", reply_markup: ckPU() }
    );
    return true;
  }
  // PATCH_PER_USER_LIMIT_FIX_APPLIED
  if (data === "reply_per_user_limit") {
    const repliesPU = _deps.getUserReplies(userId);
    if (repliesPU.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود.");
      return true;
    }
    const rows = repliesPU.slice(0, 15).map((r) => [{
      text: (r.isActive ? "✅" : "❌") + " " + r.trigger.slice(0, 30),
      callback_data: "set_per_user_" + r.id
    }]);
    rows.push([{ text: "🏠 الرئيسية", callback_data: "home" }]);
    await bot2.sendMessage(chatId,
      "👤 *حد كل شخص / 8 ساعات*\n\nاختر الرد:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }
    );
    return true;
  }
  if (data.startsWith("set_per_user_")) {
    const replyIdPU = data.replace("set_per_user_", "");
    const repliesPU2 = _deps.getUserReplies(userId);
    const replyPU2 = repliesPU2.find((r) => r.id === replyIdPU);
    if (!replyPU2) { await bot2.sendMessage(chatId, "❌ الرد غير موجود"); return true; }
    const { setState: stPU, cancelKeyboard: ckPU } = _deps;
    stPU(userId, "awaiting_reply_per_user_limit", { limitReplyId: replyIdPU });
    await bot2.sendMessage(chatId,
      `👤 *حد كل شخص / 8 ساعات*\n\nالرد: "${replyPU2.trigger.slice(0,30)}"\nالحد الحالي: ${replyPU2.perUserLimit || 0}\n\nأرسل الرقم الجديد (0 = بلا حد):`,
      { parse_mode: "Markdown", reply_markup: ckPU() }
    );
    return true;
  }
  // PATCH_PER_USER_LIMIT_FIX_APPLIED
  if (data === "reply_per_user_limit") {
    const repliesPU = _deps.getUserReplies(userId);
    if (repliesPU.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود.");
      return true;
    }
    const rows = repliesPU.slice(0, 15).map((r) => [{
      text: (r.isActive ? "✅" : "❌") + " " + r.trigger.slice(0, 30),
      callback_data: "set_per_user_" + r.id
    }]);
    rows.push([{ text: "🏠 الرئيسية", callback_data: "home" }]);
    await bot2.sendMessage(chatId,
      "👤 *حد كل شخص / 8 ساعات*\n\nاختر الرد:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }
    );
    return true;
  }
  if (data.startsWith("set_per_user_")) {
    const replyIdPU = data.replace("set_per_user_", "");
    const repliesPU2 = _deps.getUserReplies(userId);
    const replyPU2 = repliesPU2.find((r) => r.id === replyIdPU);
    if (!replyPU2) { await bot2.sendMessage(chatId, "❌ الرد غير موجود"); return true; }
    const { setState: stPU, cancelKeyboard: ckPU } = _deps;
    stPU(userId, "awaiting_reply_per_user_limit", { limitReplyId: replyIdPU });
    await bot2.sendMessage(chatId,
      `👤 *حد كل شخص / 8 ساعات*\n\nالرد: "${replyPU2.trigger.slice(0,30)}"\nالحد الحالي: ${replyPU2.perUserLimit || 0}\n\nأرسل الرقم الجديد (0 = بلا حد):`,
      { parse_mode: "Markdown", reply_markup: ckPU() }
    );
    return true;
  }
  // PATCH_PER_USER_LIMIT_FIX_APPLIED
  if (data === "reply_per_user_limit") {
    const repliesPU = _deps.getUserReplies(userId);
    if (repliesPU.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود.");
      return true;
    }
    const rows = repliesPU.slice(0, 15).map((r) => [{
      text: (r.isActive ? "✅" : "❌") + " " + r.trigger.slice(0, 30),
      callback_data: "set_per_user_" + r.id
    }]);
    rows.push([{ text: "🏠 الرئيسية", callback_data: "home" }]);
    await bot2.sendMessage(chatId,
      "👤 *حد كل شخص / 8 ساعات*\n\nاختر الرد:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }
    );
    return true;
  }
  if (data.startsWith("set_per_user_")) {
    const replyIdPU = data.replace("set_per_user_", "");
    const repliesPU2 = _deps.getUserReplies(userId);
    const replyPU2 = repliesPU2.find((r) => r.id === replyIdPU);
    if (!replyPU2) { await bot2.sendMessage(chatId, "❌ الرد غير موجود"); return true; }
    const { setState: stPU, cancelKeyboard: ckPU } = _deps;
    stPU(userId, "awaiting_reply_per_user_limit", { limitReplyId: replyIdPU });
    await bot2.sendMessage(chatId,
      `👤 *حد كل شخص / 8 ساعات*\n\nالرد: "${replyPU2.trigger.slice(0,30)}"\nالحد الحالي: ${replyPU2.perUserLimit || 0}\n\nأرسل الرقم الجديد (0 = بلا حد):`,
      { parse_mode: "Markdown", reply_markup: ckPU() }
    );
    return true;
  }
  // PATCH_PER_USER_LIMIT_FIX_APPLIED
  if (data === "reply_per_user_limit") {
    const repliesPU = _deps.getUserReplies(userId);
    if (repliesPU.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود.");
      return true;
    }
    const rows = repliesPU.slice(0, 15).map((r) => [{
      text: (r.isActive ? "✅" : "❌") + " " + r.trigger.slice(0, 30),
      callback_data: "set_per_user_" + r.id
    }]);
    rows.push([{ text: "🏠 الرئيسية", callback_data: "home" }]);
    await bot2.sendMessage(chatId,
      "👤 *حد كل شخص / 8 ساعات*\n\nاختر الرد:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }
    );
    return true;
  }
  if (data.startsWith("set_per_user_")) {
    const replyIdPU = data.replace("set_per_user_", "");
    const repliesPU2 = _deps.getUserReplies(userId);
    const replyPU2 = repliesPU2.find((r) => r.id === replyIdPU);
    if (!replyPU2) { await bot2.sendMessage(chatId, "❌ الرد غير موجود"); return true; }
    const { setState: stPU, cancelKeyboard: ckPU } = _deps;
    stPU(userId, "awaiting_reply_per_user_limit", { limitReplyId: replyIdPU });
    await bot2.sendMessage(chatId,
      `👤 *حد كل شخص / 8 ساعات*\n\nالرد: "${replyPU2.trigger.slice(0,30)}"\nالحد الحالي: ${replyPU2.perUserLimit || 0}\n\nأرسل الرقم الجديد (0 = بلا حد):`,
      { parse_mode: "Markdown", reply_markup: ckPU() }
    );
    return true;
  }
  // PATCH_PER_USER_LIMIT_FIX_APPLIED
  if (data === "reply_per_user_limit") {
    const repliesPU = _deps.getUserReplies(userId);
    if (repliesPU.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود.");
      return true;
    }
    const rows = repliesPU.slice(0, 15).map((r) => [{
      text: (r.isActive ? "✅" : "❌") + " " + r.trigger.slice(0, 30),
      callback_data: "set_per_user_" + r.id
    }]);
    rows.push([{ text: "🏠 الرئيسية", callback_data: "home" }]);
    await bot2.sendMessage(chatId,
      "👤 *حد كل شخص / 8 ساعات*\n\nاختر الرد:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } }
    );
    return true;
  }
  if (data.startsWith("set_per_user_")) {
    const replyIdPU = data.replace("set_per_user_", "");
    const repliesPU2 = _deps.getUserReplies(userId);
    const replyPU2 = repliesPU2.find((r) => r.id === replyIdPU);
    if (!replyPU2) { await bot2.sendMessage(chatId, "❌ الرد غير موجود"); return true; }
    const { setState: stPU, cancelKeyboard: ckPU } = _deps;
    stPU(userId, "awaiting_reply_per_user_limit", { limitReplyId: replyIdPU });
    await bot2.sendMessage(chatId,
      `👤 *حد كل شخص / 8 ساعات*\n\nالرد: "${replyPU2.trigger.slice(0,30)}"\nالحد الحالي: ${replyPU2.perUserLimit || 0}\n\nأرسل الرقم الجديد (0 = بلا حد):`,
      { parse_mode: "Markdown", reply_markup: ckPU() }
    );
    return true;
  }
  if (data === "reply_schedule") {
    const replies = getUserReplies(userId);
    if (replies.length === 0) {
      await bot2.sendMessage(chatId, "❌ أضف ردوداً أولاً ثم جدوِلها.");
      return true;
    }
    await bot2.sendMessage(
      chatId,
      `📅 *جدولة الردود*\n\nيمكنك تحديد فترة زمنية لكل رد (من-إلى) وحد يومي.\n\nاختر الرد للجدولة:`,
      { parse_mode: "Markdown", reply_markup: replyListKeyboard(replies) }
    );
    return true;
  }
  if (data === "reply_export") {
    const replies = getUserReplies(userId);
    if (replies.length === 0) {
      await bot2.sendMessage(chatId, "❌ لا توجد ردود للتصدير");
      return true;
    }
    const exported = JSON.stringify(replies, null, 2);
    if (exported.length < 4000) {
      await bot2.sendMessage(chatId, `\`\`\`json\n${exported.slice(0, 3900)}\n\`\`\``, { parse_mode: "Markdown" });
    } else {
      await bot2.sendMessage(chatId, `✅ لديك ${replies.length} رد. حجم البيانات: ${(exported.length / 1024).toFixed(1)} KB`);
    }
    return true;
  }
  if (data === "reply_import") {
    setState(userId, "awaiting_reply_import_json");
    await bot2.sendMessage(
      chatId,
      `📥 *استيراد الردود*\n\nأرسل ملف JSON للردود (من تصدير سابق):`,
      { reply_markup: cancelKeyboard() }
    );
    return true;
  }
  if (data === "reply_ai_guide") {
    const sampleR = getUserReplies(userId)[0] || {
      id: "reply_abc123", trigger: "مرحبا", triggerType: "contains", caseSensitive: false,
      replyType: "text", replyContent: "وعليكم السلام!",
      target: "all", scope: "both", isActive: true, dailyLimit: 0, perUserLimit: 0,
      scheduleFrom: null, scheduleTo: null, langFilter: null, morphEdits: [], rotatingMessages: []
    };
    const sampleJson = JSON.stringify(sampleR, null, 2);
    const rotEx = JSON.stringify({
      trigger: "احوالك", triggerType: "contains", replyType: "rotating",
      rotatingMessages: ["بخير والحمد لله", "تمام شكراً"],
      target: "all", scope: "both", isActive: true, dailyLimit: 0, perUserLimit: 0
    }, null, 2);
    const aiEx = JSON.stringify({
      trigger: "ما رأيك", triggerType: "starts", replyType: "ai",
      replyContent: "أنت مساعد ودي. أجب باختصار.",
      target: "all", scope: "private", isActive: true, dailyLimit: 10, perUserLimit: 2
    }, null, 2);
    const guide = [
      "🤖 *دليل الذكاء الاصطناعي — بوت واتسآب*",
      "أرسل هذا لأي AI ليفهم هيكل البوت ويبني ردوداً جاهزة.",
      "## 1. نظرة عامة",
      "البوت يعمل عبر تيليغرام ويتحكم بجلسة واتسآب (Baileys). كل مستخدم لديه autoReplies تنطبق على رسائل واتساب.",
      "## 2. هيكل ملف الرد (JSON)",
      "```json\n" + sampleJson + "\n```",
      "## 3. شرح الحقول",
      "- **trigger**: الكلمة المفتاحية\n- **triggerType**: [exact | contains | starts | ends | regex]\n- **replyType**: [text | ai | reaction | morphing | rotating | image | audio | video | document | sticker]\n- **replyContent**: نص أو URL أو \"__ai_default__\" للذكاء\n- **target**: [all | specific | multiple] | **scope**: [both | private | group]\n- **dailyLimit**: حد يومي (0 = بلا حد) | **perUserLimit**: حد لكل شخص كل 8ساعات",
      "## 4. مثال رد دوري",
      "```json\n" + rotEx + "\n```",
      "## 5. مثال رد بالذكاء الاصطناعي",
      "```json\n" + aiEx + "\n```",
      "## 6. طريقة الاستيراد",
      "أرسل ملف .json بهيكل [{...}] — أو الصق النص — في زر \"استيراد الردود\"."
    ].join("\n");
    const chunks = [];
    for (let i = 0; i < guide.length; i += 4000) chunks.push(guide.slice(i, i + 4000));
    for (const ch of chunks) await bot2.sendMessage(chatId, ch);
    return true;
  }
  if (data === "reply_code_parts") {
    setState(userId, "awaiting_code_parts", { parts: [] });
    await bot2.sendMessage(chatId,
      "📝 *رفع كود على أجزاء*\n\n• ارسل كل جزء على حدة\n• بعد آخر جزء اضغط \"اكتملت؟\"\n\nℹ️ يمكنك أيضاً رفع ملف .json مباشرة",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
        [{ text: "✅ اكتملت؟ — ركّب الأجزاء", callback_data: "code_parts_done" }],
        [{ text: "❌ إلغاء", callback_data: "cancel" }]
      ] } }
    );
    return true;
  }
  if (data === "code_parts_done") {
    const stCP = getState(userId);
    const parts = stCP?.data?.parts || [];
    if (parts.length === 0) {
      await bot2.sendMessage(chatId, "⚠️ لم ترسل أي جزء بعد.");
      return true;
    }
    const assembled = parts.join("");
    clearState(userId);
    try {
      const imported = JSON.parse(assembled);
      if (!Array.isArray(imported)) throw new Error("not array");
      let cnt = 0;
      for (const r of imported.slice(0, 100)) {
        if (r.trigger && r.replyContent !== undefined) { saveAutoReply(userId, r); cnt++; }
      }
      await bot2.sendMessage(chatId, "✅ *تم تركيب " + parts.length + " جزء واستيراد " + cnt + " رد!*", { parse_mode: "Markdown" });
    } catch (e) {
      await bot2.sendMessage(chatId, "⚠️ الكود المجمّع (" + assembled.length + " حرف) ليس JSON صالحاً: " + e.message);
    }
    return true;
  }
  if (data === "reply_enable_all") {
    const replies = getUserReplies(userId);
    replies.forEach((r) => r.isActive = true);
    inMemoryDB.autoReplies.set(userId, replies);
    await bot2.sendMessage(chatId, `✅ تم تفعيل جميع الردود (${replies.length})`);
    return true;
  }
  if (data === "reply_disable_all") {
    const replies = getUserReplies(userId);
    replies.forEach((r) => r.isActive = false);
    inMemoryDB.autoReplies.set(userId, replies);
    await bot2.sendMessage(chatId, `❌ تم تعطيل جميع الردود (${replies.length})`);
    return true;
  }
  if (data.startsWith("replyitem_")) {
    const replyId = data.replace("replyitem_", "");
    const replies = getUserReplies(userId);
    const reply = replies.find((r) => r.id === replyId);
    if (!reply) {
      await bot2.sendMessage(chatId, "❌ الرد غير موجود");
      return true;
    }
    const stat3 = getReplyStat(userId, replyId);
    await bot2.sendMessage(
      chatId,
      `📌 *تفاصيل الرد*\n\n🔑 المفتاح: "${reply.trigger}"\n📊 نوع التطابق: ${reply.triggerType || "exact"}\n📝 نوع الرد: ${reply.replyType || "text"}\n💬 المحتوى: ${(reply.replyContent || "").slice(0, 100)}\n👥 الهدف: ${reply.target || "all"}\n🌍 النطاق: ${reply.scope || "both"}\n✅ الحالة: ${reply.isActive ? "نشط" : "معطّل"}\n📈 استُخدم: ${stat3} مرة`,
      { parse_mode: "Markdown", reply_markup: singleReplyKeyboard(replyId) }
    );
    return true;
  }
  if (data.startsWith("toggle_reply_")) {
    const replyId = data.replace("toggle_reply_", "");
    const newState = toggleAutoReply(userId, replyId);
    if (newState === null) {
      await bot2.sendMessage(chatId, "❌ الرد غير موجود");
      return true;
    }
    await bot2.sendMessage(chatId, `${newState ? "✅ تم تفعيل الرد" : "❌ تم تعطيل الرد"}`);
    return true;
  }
  if (data.startsWith("delete_reply_")) {
    const replyId = data.replace("delete_reply_", "");
    const deleted = deleteAutoReply(userId, replyId);
    await bot2.sendMessage(chatId, deleted ? "✅ تم حذف الرد بنجاح" : "❌ الرد غير موجود");
    return true;
  }
  if (data.startsWith("ttype_")) {
    await handleTriggerTypeCallback(bot2, chatId, userId, data);
    return true;
  }
  if (data.startsWith("rtype_")) {
    await handleReplyTypeCallbackInternal(bot2, chatId, userId, data);
    return true;
  }
  if (data.startsWith("target_")) {
    await handleTargetCallbackInternal(bot2, chatId, userId, data);
    return true;
  }
  if (data.startsWith("scope_")) {
    await handleScopeCallbackInternal(bot2, chatId, userId, data);
    return true;
  }
  if (data === "morph_add_edit") {
    await bot2.sendMessage(chatId, `✏️ أدخل نص التعديل التالي:`, { reply_markup: _deps.cancelKeyboard() });
    return true;
  }
  if (data === "morph_done") {
    const s = getState(userId);
    const { trigger, triggerType, caseSensitive, morphInitial, morphEdits } = s.data || {};
    if (!morphInitial || !morphEdits?.length) {
      await bot2.sendMessage(chatId, "❌ أضف تعديلاً واحداً على الأقل");
      return true;
    }
    saveAutoReply(userId, {
      trigger: trigger || "default",
      triggerType: triggerType || "exact",
      caseSensitive: caseSensitive || false,
      replyType: "morphing",
      replyContent: morphInitial,
      morphEdits,
      target: "all",
      targetNumbers: [],
      scope: "both"
    });
    addPoints(userId, 10, "إضافة رسالة متعددة");
    clearState(userId);
    const freshUser = getUser(userId);
    const editsSummary = morphEdits.map((e, i) => `${i + 1}. "${e.text.slice(0, 30)}" — بعد ${e.delaySeconds}ث`).join("\n");
    await bot2.sendMessage(
      chatId,
      `✅ *تم حفظ الرسالة المتعددة!*\n\n🔑 المفتاح: "${trigger}"\n📝 النص الأولي: "${morphInitial.slice(0, 40)}"\n\n✏️ *التعديلات:*\n${editsSummary}\n\n💰 +10 نقاط!`,
      {
        parse_mode: "Markdown",
        reply_markup: mainMenuKeyboard(freshUser.points || 0, freshUser.tier, userId === DEVELOPER_ID)
      }
    );
    return true;
  }
  if (data === "longtext_done") {
    await handleLongTextDoneInternal(bot2, chatId, userId);
    return true;
  }
  if (data === "longtext_cancel") {
    clearTextParts(userId);
    clearState(userId);
    await bot2.sendMessage(chatId, "🗑️ تم الإلغاء");
    return true;
  }
  return false;
}

export async function handleTriggerTypeCallback(bot2, chatId, userId, data) {
  const { getState, setState, cancelKeyboard, replyTypeKeyboard } = _deps;
  const typeMap = {
    ttype_exact: { type: "exact", label: "تطابق تام" },
    ttype_contains: { type: "contains", label: "يحتوي على" },
    ttype_starts: { type: "starts", label: "يبدأ بـ" },
    ttype_ends: { type: "ends", label: "ينتهي بـ" },
    ttype_regex: { type: "regex", label: "تعبير منتظم" },
    ttype_cs_exact: { type: "exact", label: "تطابق تام (حساس)" },
    ttype_cs_contains: { type: "contains", label: "يحتوي (حساس)" }
  };
  // [FIX_BUG005] ttype_case_on / ttype_case_off لم تكن في typeMap → صامتة الفشل
  if (data === "ttype_case_on" || data === "ttype_case_off") {
    const caseSensitive = data === "ttype_case_on";
    const prevState = getState(userId);
    const prevData = prevState.data || {};
    const preservedTriggerType = prevData.triggerType || "exact";
    const label = caseSensitive ? "حساس للأحرف" : "غير حساس للأحرف";
    if (prevData.replyType === "reaction") {
      setState(userId, "awaiting_reaction_emoji", { ...prevData, caseSensitive, triggerType: preservedTriggerType });
      await bot2.sendMessage(chatId,
        `✅ *الأحرف:* ${label}\n\n😊 *الخطوة 3/3:* أرسل الإيموجي للتفاعل:\n\nمثال: 👍 ❤️ 😂 🔥`,
        { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
      );
      return;
    }
    setState(userId, "awaiting_reply_type", { ...prevData, caseSensitive, triggerType: preservedTriggerType });
    const morphingRow = [{ text: "✏️ رسالة تتعدّل تلقائياً", callback_data: "rtype_morphing" }];
    await bot2.sendMessage(chatId,
      `✅ *الأحرف:* ${label}\n\n*الخطوة 3/4:* اختر نوع الرد:`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            ...replyTypeKeyboard().inline_keyboard.slice(0, -1),
            morphingRow,
            ...replyTypeKeyboard().inline_keyboard.slice(-1)
          ]
        }
      }
    );
    return;
  }
  const isCaseSensitive = data.startsWith("ttype_cs_");
  const baseData = data.replace("ttype_cs_", "ttype_");
  const info = typeMap[data] || typeMap[baseData];
  if (!info) return;
  const state = getState(userId);
  const prevData = state.data || {};
  if (prevData.replyType === "reaction") {
    setState(userId, "awaiting_reaction_emoji", {
      ...prevData,
      triggerType: info.type,
      caseSensitive: isCaseSensitive
    });
    await bot2.sendMessage(
      chatId,
      `✅ *طريقة التطابق:* ${info.label}${isCaseSensitive ? " (حساس للأحرف)" : ""}\n\n😊 *الخطوة 3/3:* أرسل الإيموجي للتفاعل:\n\nمثال: 👍 ❤️ 😂 🔥 😎 💯`,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return;
  }
  setState(userId, "awaiting_reply_type", {
    ...prevData,
    triggerType: info.type,
    caseSensitive: isCaseSensitive
  });
  const morphingRow = [{ text: "✏️ رسالة تتعدّل تلقائياً", callback_data: "rtype_morphing" }];
  await bot2.sendMessage(
    chatId,
    `✅ *طريقة التطابق:* ${info.label}${isCaseSensitive ? " (حساس للأحرف)" : ""}\n\n*الخطوة 3/4:* اختر نوع الرد:`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          ...replyTypeKeyboard().inline_keyboard.slice(0, -1),
          morphingRow,
          ...replyTypeKeyboard().inline_keyboard.slice(-1)
        ]
      }
    }
  );
}

export async function handleAutoReplyTextInput(bot2, chatId, userId, text, state) {
  const {
    getUser, getUserReplies, saveAutoReply, addPoints, getState, setState, clearState,
    appendTextPart, clearTextParts, getMergedText,
    repliesMenuKeyboard, replyListKeyboard, cancelKeyboard,
    mainMenuKeyboard, longTextDoneKeyboard, triggerTypeKeyboard, replyScopeKeyboard,
    DEVELOPER_ID
  } = _deps;

  const user = getUser(userId);
  const isDev2 = userId === DEVELOPER_ID;

  if (state.state === "awaiting_trigger") {
    setState(userId, "awaiting_trigger_type", { trigger: text });
    await bot2.sendMessage(
      chatId,
      `✅ *الكلمة المفتاحية:* "${text}"\n\n*الخطوة 2/4:* اختر طريقة التطابق:\n\nيمكنك أيضاً تحديد حساسية الأحرف 👇`,
      { parse_mode: "Markdown", reply_markup: triggerTypeKeyboard() }
    );
    return true;
  }
  // [FIX_NEW_3] awaiting_reply_type — الاختيار عبر أزرار rtype_* فقط — نص لا يُقبَل
  if (state.state === "awaiting_reply_type") {
    const morphingRow = [{ text: "✏️ رسالة تتعدّل تلقائياً", callback_data: "rtype_morphing" }];
    await bot2.sendMessage(
      chatId,
      "⚠️ الرجاء اختيار *نوع الرد* بالضغط على أحد الأزرار أدناه:",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            ..._deps.replyTypeKeyboard().inline_keyboard.slice(0, -1),
            morphingRow,
            ..._deps.replyTypeKeyboard().inline_keyboard.slice(-1)
          ]
        }
      }
    );
    return true;
  }
  if (state.state === "awaiting_specific_numbers") {
    const lines = text.split(/[\n,\s]+/).map((l) => l.replace(/\D/g, "")).filter((l) => l.length >= 7);
    if (lines.length === 0) {
      await bot2.sendMessage(chatId, "❌ لم يُعثَر على أرقام صالحة.", { reply_markup: cancelKeyboard() });
      return true;
    }
    setState(userId, "awaiting_reply_scope", {
      targetNumbers: lines,
      target: lines.length === 1 ? "specific" : "multiple"
    });
    await bot2.sendMessage(
      chatId,
      `✅ *الأرقام:* ${lines.map((n) => `+${n}`).join(", ")}\n\n*الخطوة 3/4:* اختر النطاق:`,
      { parse_mode: "Markdown", reply_markup: replyScopeKeyboard() }
    );
    return true;
  }
  if (state.state === "awaiting_reply_content" || state.state === "awaiting_long_text") {
    const curState = getState(userId);
    if (curState.data?.replyType === "ai") {
      const { trigger, triggerType, target, targetNumbers, scope, caseSensitive } = curState.data;
      saveAutoReply(userId, {
        trigger: trigger || "default",
        triggerType: triggerType || "exact",
        caseSensitive: caseSensitive || false,
        replyType: "ai",
        replyContent: text,
        target: target || "all",
        targetNumbers: targetNumbers || [],
        scope: scope || "both"
      });
      addPoints(userId, 10, "إضافة رد ذكاء اصطناعي");
      clearState(userId);
      const freshUser = getUser(userId);
      await bot2.sendMessage(
        chatId,
        `✅ *تم حفظ الرد بالذكاء الاصطناعي!*\n\nالمفتاح: "${trigger}"\nالبرومت: "${text.slice(0, 60)}..."`,
        {
          parse_mode: "Markdown",
          reply_markup: mainMenuKeyboard(freshUser.points || 0, freshUser.tier, isDev2)
        }
      );
      return true;
    }
    const partNum = appendTextPart(userId, text);
    await bot2.sendMessage(
      chatId,
      `✅ *الجزء ${partNum} مستلم*\n📊 إجمالي: ${getMergedText(userId).length} حرف\n\nأرسل المزيد أو اضغط "تم ✅":`,
      { parse_mode: "Markdown", reply_markup: longTextDoneKeyboard(partNum) }
    );
    return true;
  }
  if (state.state === "awaiting_search_reply") {
    const replies = getUserReplies(userId);
    const term = text.toLowerCase();
    const found = replies.filter(
      (r) => r.trigger?.toLowerCase().includes(term) || r.replyContent?.toLowerCase().includes(term)
    );
    clearState(userId);
    if (found.length === 0) {
      await bot2.sendMessage(chatId, `🔍 لا توجد نتائج لـ "${text}"`);
      return true;
    }
    await bot2.sendMessage(
      chatId,
      `🔍 *نتائج البحث عن "${text}" (${found.length}):*`,
      { parse_mode: "Markdown", reply_markup: replyListKeyboard(found) }
    );
    return true;
  }
  if (state.state === "awaiting_rotating_trigger") {
    setState(userId, "awaiting_rotating_responses", { rotatingTrigger: text });
    await bot2.sendMessage(
      chatId,
      `✅ المفتاح: "${text}"\n\n*الخطوة 2/2:* أدخل الردود المتناوبة (كل رد في سطر منفصل):\n\nمثال:\nأهلاً بك!\nمرحباً!\nنورت!`,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return true;
  }
  if (state.state === "awaiting_rotating_responses") {
    const responses = text.split("\n").map((r) => r.trim()).filter(Boolean);
    if (responses.length < 2) {
      await bot2.sendMessage(chatId, "❌ أدخل ردين على الأقل (كل رد في سطر منفصل)");
      return true;
    }
    const trigger = state.data.rotatingTrigger;
    saveAutoReply(userId, {
      trigger,
      triggerType: "exact",
      replyType: "rotating",
      rotatingMessages: responses,
      target: "all",
      scope: "both"
    });
    clearState(userId);
    await bot2.sendMessage(
      chatId,
      `✅ *تم حفظ الرد المتناوب!*\n\nالمفتاح: "${trigger}"\nعدد الردود: ${responses.length}`,
      { parse_mode: "Markdown" }
    );
    return true;
  }
  if (state.state === "awaiting_reaction_emoji") {
    const emoji = text.trim().split(/\s+/)[0] || "👍";
    const { trigger, triggerType, caseSensitive } = state.data;
    saveAutoReply(userId, {
      trigger: trigger || "default",
      triggerType: triggerType || "exact",
      caseSensitive: caseSensitive || false,
      replyType: "reaction",
      replyContent: emoji,
      target: "all",
      targetNumbers: [],
      scope: "both"
    });
    addPoints(userId, 5, "إضافة رد تفاعل");
    clearState(userId);
    const freshUser = getUser(userId);
    await bot2.sendMessage(
      chatId,
      `✅ *تم حفظ رد التفاعل!*\n\n🔑 المفتاح: "${trigger}"\n😊 الإيموجي: ${emoji}\n💰 +5 نقاط!`,
      {
        parse_mode: "Markdown",
        reply_markup: mainMenuKeyboard(freshUser.points || 0, freshUser.tier, isDev2)
      }
    );
    return true;
  }
  if (state.state === "awaiting_morph_initial") {
    setState(userId, "awaiting_morph_edits", {
      ...state.data,
      morphInitial: text,
      morphEdits: []
    });
    await bot2.sendMessage(
      chatId,
      `✅ *النص الأولي:* "${text.slice(0, 60)}"\n\n✏️ *الخطوة 2:* أدخل التعديل الأول للرسالة:\n\n📝 هذا هو النص الذي ستتعدّل إليه الرسالة.`,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return true;
  }
  if (state.state === "awaiting_morph_edits") {
    const edits = state.data.morphEdits || [];
    const editNum = edits.length + 1;
    setState(userId, "awaiting_morph_delay", { ...state.data, pendingEditText: text });
    await bot2.sendMessage(
      chatId,
      `✅ *نص التعديل ${editNum}:* "${text.slice(0, 60)}"\n\n⏱️ *الخطوة:* بعد كم ثانية يتم هذا التعديل؟\n\nأدخل رقماً (يمكن الكسور مثل 0.5 لنصف ثانية):`,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return true;
  }
  if (state.state === "awaiting_morph_delay") {
    const seconds = parseFloat(text.replace(",", "."));
    if (isNaN(seconds) || seconds < 0.1) {
      await bot2.sendMessage(chatId, "❌ أدخل عدداً صحيحاً (أقل قيمة: 0.1 ثانية)", { reply_markup: cancelKeyboard() });
      return true;
    }
    const edits = state.data.morphEdits || [];
    edits.push({ text: state.data.pendingEditText, delaySeconds: seconds });
    setState(userId, "awaiting_morph_edits", { ...state.data, morphEdits: edits, pendingEditText: undefined });
    await bot2.sendMessage(
      chatId,
      `✅ *التعديل ${edits.length} محفوظ* (بعد ${seconds} ثانية)\n\nاختر التالي:`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: `➕ إضافة تعديل ${edits.length + 1}`, callback_data: "morph_add_edit" }],
            [{ text: "✅ تم — حفظ الرسالة المتعددة", callback_data: "morph_done" }],
            [{ text: "❌ إلغاء", callback_data: "cancel" }]
          ]
        }
      }
    );
    return true;
  }
  if (state.state === "awaiting_code_parts") {
    const parts2 = state?.data?.parts || [];
    parts2.push(text);
    setState(userId, "awaiting_code_parts", { parts: parts2 });
    const total = parts2.join("").length;
    await bot2.sendMessage(chatId,
      "✅ *الجزء " + parts2.length + " وصل!*\n📊 إجمالي: " + total + " حرف\n\nارسل الجزء التالي أو اضغط اكتملت:",
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
        [{ text: "✅ اكتملت؟ — ركّب (" + parts2.length + " أجزاء)", callback_data: "code_parts_done" }],
        [{ text: "❌ إلغاء", callback_data: "cancel" }]
      ] } }
    );
    return true;
  }
  if (state.state === "awaiting_reply_import_json") {
    try {
      const imported = JSON.parse(text);
      const arr = Array.isArray(imported) ? imported : [imported];
      let count = 0;
      for (const r of arr) {
        if (r.trigger) { saveAutoReply(userId, r); count++; }
      }
      clearState(userId);
      await bot2.sendMessage(chatId, `✅ تم استيراد ${count} رد بنجاح!`);
    } catch {
      await bot2.sendMessage(chatId, "❌ تنسيق JSON غير صحيح. تأكد من صحة البيانات.");
    }
    return true;
  }
  if (state.state === "awaiting_reply_per_user_limit") {
    const limitVal = parseInt(text, 10);
    if (isNaN(limitVal) || limitVal < 0) {
      await bot2.sendMessage(chatId, "❌ أدخل رقماً صحيحاً (0 = بلا حد، أو رقم موجب)", {
        reply_markup: cancelKeyboard()
      });
      return true;
    }
    const replies = getUserReplies(userId);
    const reply = replies.find((r) => r.id === state.data?.limitReplyId);
    if (!reply) {
      clearState(userId);
      await bot2.sendMessage(chatId, "❌ الرد غير موجود");
      return true;
    }
    reply.perUserLimit = limitVal;
    clearState(userId);
    await bot2.sendMessage(
      chatId,
      `✅ *تم تحديث الحد!*\n\nالرد: "${reply.trigger.slice(0, 30)}"\nالحد الجديد: ${limitVal === 0 ? "بلا حد" : limitVal + " مرة / 8 ساعات"}`,
      { parse_mode: "Markdown", reply_markup: repliesMenuKeyboard(replies.filter((r) => r.isActive).length, replies.filter((r) => !r.isActive).length) }
    );
    return true;
  }
  // [FIX_BUG009] awaiting_reply_daily_limit — حالة جديدة من إصلاح reply_daily_limit
  if (state.state === "awaiting_reply_daily_limit") {
    const limitValDL = parseInt(text, 10);
    if (isNaN(limitValDL) || limitValDL < 0) {
      await bot2.sendMessage(chatId, "❌ أدخل رقماً صحيحاً (0 = بلا حد، أو رقم موجب):", {
        reply_markup: cancelKeyboard()
      });
      return true;
    }
    const repliesDL3 = getUserReplies(userId);
    const replyDL3 = repliesDL3.find((r) => r.id === state.data?.limitReplyId);
    if (!replyDL3) {
      clearState(userId);
      await bot2.sendMessage(chatId, "❌ الرد غير موجود");
      return true;
    }
    replyDL3.dailyLimit = limitValDL;
    _deps.inMemoryDB.autoReplies.set(userId, repliesDL3);
    clearState(userId);
    await bot2.sendMessage(
      chatId,
      `✅ *تم تحديث الحد اليومي!*\n\nالرد: "${replyDL3.trigger.slice(0, 30)}"\nالحد اليومي: ${limitValDL === 0 ? "بلا حد" : limitValDL + " رسالة/يوم"}`,
      { parse_mode: "Markdown", reply_markup: repliesMenuKeyboard(repliesDL3.filter((r) => r.isActive).length, repliesDL3.filter((r) => !r.isActive).length) }
    );
    return true;
  }
  return false;
}
