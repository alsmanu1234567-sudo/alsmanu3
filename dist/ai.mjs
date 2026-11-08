// dist/ai.mjs — [AI-FIX] معالجات الذكاء الاصطناعي الإضافية
// إصلاحات:
// 1. حُذف معالج menu_ai المكرر (كان يمرر boolean بدل اسم النموذج → TypeError)
//    الآن menu_ai يُوجَّه إلى handleAiMenu في ai-handler.mjs مباشرة.
// 2. ai_toggle: أصبح يمرر (hasKey, model) الصحيحين لـ aiMenuKeyboard بدل (hasKey, aiEnabled).
// 3. ai_model_: أصبح يستثني ai_model_pick_ حتى لا يُفسد اختيار النموذج من القائمة الأخرى.
let _deps = {};
export function setDeps(d) { _deps = d; }

async function _ai() {
  const { init_ai_manager, ai_manager_exports } = _deps;
  return Promise.resolve().then(() => (init_ai_manager(), ai_manager_exports));
}

export async function handleAiCallback2(bot2, chatId, userId, data) {
  const { getUser, saveUser, setState, cancelKeyboard, aiMenuKeyboard } = _deps;
  const user = getUser(userId);
  if (data === "ai_add_key") {
    setState(userId, "awaiting_nvidia_key");
    await bot2.sendMessage(chatId,
      `\u{1F511} *\u0625\u0636\u0627\u0641\u0629 \u0645\u0641\u062A\u0627\u062D NVIDIA*\n\n1. \u0627\u0630\u0647\u0628 \u0625\u0644\u0649: https://build.nvidia.com\n2. \u0623\u0646\u0634\u0626 \u062D\u0633\u0627\u0628\u0627\u064B \u0645\u062C\u0627\u0646\u064A\u0627\u064B\n3. \u0627\u0636\u063A\u0637 "API Keys" \u2190 "Create key"\n4. \u0627\u0646\u0633\u062E \u0627\u0644\u0645\u0641\u062A\u0627\u062D \u0648\u0623\u0631\u0633\u0644\u0647 \u0647\u0646\u0627\n\n\u26A0\uFE0F \u0627\u0644\u0645\u0641\u062A\u0627\u062D \u064A\u0628\u062F\u0623 \u0628\u0640 \`nvapi-\``,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return true;
  }
  if (data === "ai_toggle") {
    const { hasNvidiaKey, getUserSelectedModel } = await _ai();
    const aiEnabled = !user.aiEnabled;
    if (aiEnabled && !hasNvidiaKey(userId)) {
      await bot2.sendMessage(chatId, "\u274C \u0623\u0636\u0641 \u0645\u0641\u062A\u0627\u062D NVIDIA \u0623\u0648\u0644\u0627\u064B \u0645\u0646 \u062E\u064A\u0627\u0631 \u{1F511} \u0625\u0636\u0627\u0641\u0629 \u0645\u0641\u062A\u0627\u062D");
      return true;
    }
    saveUser(userId, { aiEnabled });
    // [AI-FIX] كان يمرر aiEnabled (boolean) كاسم النموذج → TypeError داخل aiMenuKeyboard
    await bot2.sendMessage(chatId,
      `${aiEnabled ? "\u2705 \u062A\u0645 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A" : "\u274C \u062A\u0645 \u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A"}`,
      { reply_markup: aiMenuKeyboard(hasNvidiaKey(userId), getUserSelectedModel(userId)) }
    );
    return true;
  }
  if (data === "ai_select_model") {
    const { probeModels, getCachedWorkingModels, getAllModels, hasNvidiaKey, getUserSelectedModel } = await _ai();
    const hasKey = hasNvidiaKey(userId);
    const currentModel = getUserSelectedModel(userId);
    let models;
    if (hasKey) {
      const loadMsg = await bot2.sendMessage(chatId, "\u23F3 *\u062C\u0627\u0631\u064A \u0641\u062D\u0635 \u0627\u0644\u0646\u0645\u0627\u0630\u062C \u0627\u0644\u0645\u062A\u0627\u062D\u0629 \u0644\u0645\u0641\u062A\u0627\u062D\u0643...*", { parse_mode: "Markdown" });
      try {
        models = await probeModels(userId);
        if (!models || !models.length) models = getCachedWorkingModels(userId);
      } catch {
        models = getCachedWorkingModels(userId);
      }
      await bot2.deleteMessage(chatId, loadMsg.message_id).catch(() => {});
    } else {
      models = getAllModels();
    }
    if (!models || !models.length) models = getAllModels();
    const rows = models.map((m) => [{
      text: `${m.id === currentModel ? "\u2705 " : ""}${m.name || m.label || m.id}`,
      callback_data: `ai_model_${m.id}`
    }]);
    rows.push([{ text: "\u{1F519} \u0631\u062C\u0648\u0639", callback_data: "menu_ai" }]);
    const headerTxt = hasKey
      ? `\u{1F9E0} *\u0627\u062E\u062A\u0631 \u0646\u0645\u0648\u0630\u062C \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A:*\n\n\u2705 \u0627\u0644\u0646\u0645\u0627\u0630\u062C \u0627\u0644\u062A\u0627\u0644\u064A\u0629 \u062A\u0639\u0645\u0644 \u0645\u0639 \u0645\u0641\u062A\u0627\u062D\u0643 (${models.length} \u0646\u0645\u0648\u0630\u062C):`
      : `\u{1F9E0} *\u0627\u062E\u062A\u0631 \u0646\u0645\u0648\u0630\u062C \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A:*\n\n\u26A0\uFE0F \u0623\u0636\u0641 \u0645\u0641\u062A\u0627\u062D NVIDIA \u0644\u0641\u062D\u0635 \u0627\u0644\u0646\u0645\u0627\u0630\u062C \u0627\u0644\u0641\u0639\u0644\u064A\u0629`;
    await bot2.sendMessage(chatId, headerTxt, { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } });
    return true;
  }
  // [AI-FIX] استثناء ai_model_pick_ — كانت تُعترض هنا ويُحفظ معرّف نموذج فاسد ("pick_...")
  if (data.startsWith("ai_model_") && !data.startsWith("ai_model_pick_")) {
    const modelId = data.replace("ai_model_", "");
    const { setUserModel, hasNvidiaKey } = await _ai();
    setUserModel(userId, modelId);
    await bot2.sendMessage(chatId,
      `\u2705 \u062A\u0645 \u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0644\u0646\u0645\u0648\u0630\u062C: ${modelId.split("/")[1] || modelId}`,
      { reply_markup: aiMenuKeyboard(hasNvidiaKey(userId), modelId) }
    );
    return true;
  }
  if (data === "ai_test") {
    const { hasNvidiaKey } = await _ai();
    if (!hasNvidiaKey(userId)) { await bot2.sendMessage(chatId, "\u274C \u0623\u0636\u0641 \u0645\u0641\u062A\u0627\u062D NVIDIA \u0623\u0648\u0644\u0627\u064B"); return true; }
    setState(userId, "awaiting_ai_test_msg");
    await bot2.sendMessage(chatId, "\u{1F9EA} *\u0627\u062E\u062A\u0628\u0627\u0631 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A*\n\n\u0623\u0631\u0633\u0644 \u0631\u0633\u0627\u0644\u0629 \u0644\u0623\u0631\u0633\u0644\u0647\u0627 \u0644\u0644\u0646\u0645\u0648\u0630\u062C \u0648\u0623\u0639\u0631\u0636 \u0627\u0644\u0631\u062F:", { parse_mode: "Markdown", reply_markup: cancelKeyboard() });
    return true;
  }
  if (data === "ai_remove_key") {
    const { setUserNvidiaKey, getUserSelectedModel } = await _ai();
    setUserNvidiaKey(userId, null);
    saveUser(userId, { aiEnabled: false });
    await bot2.sendMessage(chatId,
      "\u2705 \u062A\u0645 \u062D\u0630\u0641 \u0645\u0641\u062A\u0627\u062D NVIDIA. \u0633\u064A\u062A\u0648\u0642\u0641 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A.",
      { reply_markup: aiMenuKeyboard(false, getUserSelectedModel(userId)) }
    );
    return true;
  }
  if (data === "ai_stats") {
    const { getUserSelectedModel, hasNvidiaKey } = await _ai();
    const aiStats = user.aiStats || { requests: 0, tokens: 0 };
    const model = getUserSelectedModel(userId);
    const temp = typeof user.aiTemperature === "number" ? user.aiTemperature : 0.7;
    const maxTok = typeof user.aiMaxTokens === "number" ? user.aiMaxTokens : 300;
    const lastAt = aiStats.lastAt ? new Date(aiStats.lastAt).toLocaleString("ar-EG") : "\u0644\u0627 \u064A\u0648\u062C\u062F";
    await bot2.sendMessage(chatId,
      `\u{1F4CA} *\u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A*\n\n\u{1F522} \u0627\u0644\u0637\u0644\u0628\u0627\u062A: ${aiStats.requests || 0}\n\u{1F4DD} \u0627\u0644\u0631\u0645\u0648\u0632 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u0629: ${(aiStats.tokens || 0).toLocaleString()}\n\u{1F9E0} \u0627\u0644\u0646\u0645\u0648\u0630\u062C: \`${model.split("/")[1] || model}\`\n\u{1F321}\uFE0F \u062F\u0631\u062C\u0629 \u0627\u0644\u0625\u0628\u062F\u0627\u0639: ${temp}\n\u{1F4CF} \u0623\u0642\u0635\u0649 \u0637\u0648\u0644 \u0644\u0644\u0631\u062F: ${maxTok} \u0631\u0645\u0632\n\u{1F511} \u0627\u0644\u0645\u0641\u062A\u0627\u062D: ${hasNvidiaKey(userId) ? "\u2705" : "\u274C"}\n\u{1F552} \u0622\u062E\u0631 \u0637\u0644\u0628: ${lastAt}`,
      { parse_mode: "Markdown" }
    );
    return true;
  }
  if (data === "ai_prompt") {
    setState(userId, "awaiting_ai_system_prompt");
    const currentPrompt = user.aiSystemPrompt || "";
    await bot2.sendMessage(chatId,
      `\u{1F4DD} *\u062A\u0639\u062F\u064A\u0644 System Prompt*\n\n\u0627\u0644\u062D\u0627\u0644\u064A:\n"${currentPrompt || "\u0644\u0645 \u064A\u064F\u0639\u064A\u064E\u0651\u0646 \u2014 \u0633\u064A\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0628\u0631\u0648\u0645\u062A \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A"}"\n\n\u0623\u0631\u0633\u0644 \u0627\u0644\u0628\u0631\u0648\u0645\u062A \u0627\u0644\u062C\u062F\u064A\u062F:`,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
    return true;
  }
  return false;
}
