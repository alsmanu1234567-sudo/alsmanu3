let _deps = {};
export function setDeps(d) { _deps = d; }

export async function handleCallsCallback(bot2, chatId, userId, data) {
  const { getUser, saveUser, setState, cancelKeyboard, callsMenuKeyboard, callsSettingsKeyboard } = _deps;
  const user = getUser(userId);
  const callLog = user.callLog || [];
  if (data === "menu_calls") {
    const incoming = callLog.filter((c) => c.type === "incoming").length;
    const missed = callLog.filter((c) => c.type === "missed").length;
    const s = user.callSettings || {};
    await bot2.sendMessage(
      chatId,
      `\u{1F4DE} *\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0643\u0627\u0644\u0645\u0627\u062A*

\u{1F4CA} \u0627\u0644\u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A:
\u2022 \u0648\u0627\u0631\u062F\u0629: ${incoming} | \u0641\u0627\u0626\u062A\u0629: ${missed} | \u0625\u062C\u0645\u0627\u0644\u064A: ${callLog.length}

\u2699\uFE0F \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A:
\u2022 \u0627\u0644\u0631\u0641\u0636 \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A: ${s.autoReject ? "\u2705" : "\u274C"}
\u2022 \u0625\u0634\u0639\u0627\u0631 \u0627\u0644\u0641\u0627\u0626\u062A\u0629: ${s.notifyMissed !== false ? "\u2705" : "\u274C"}
\u2022 \u0648\u0636\u0639 \u0627\u0644\u062A\u062E\u0641\u064A: ${s.ghostMode ? "\u2705" : "\u274C"}`,
      { parse_mode: "Markdown", reply_markup: callsMenuKeyboard() }
    );
    return true;
  }
  if (data === "calls_log") {
    if (callLog.length === 0) {
      await bot2.sendMessage(chatId, "\u{1F4CB} *\u0633\u062C\u0644 \u0627\u0644\u0645\u0643\u0627\u0644\u0645\u0627\u062A*\n\n\u0644\u0627 \u062A\u0648\u062C\u062F \u0645\u0643\u0627\u0644\u0645\u0627\u062A \u0645\u0633\u062C\u0644\u0629 \u0628\u0639\u062F.", { parse_mode: "Markdown", reply_markup: callsMenuKeyboard() });
      return true;
    }
    const lines = callLog.slice(-15).reverse().map(
      (c) => `${c.type === "incoming" ? "\u{1F4E5}" : c.type === "outgoing" ? "\u{1F4E4}" : "\u{1F4F5}"} +${c.number}
   \u23F1 ${c.duration || "0"}\u062B \u2014 ${c.date || ""}`
    ).join("\n\n");
    await bot2.sendMessage(chatId, `\u{1F4CB} *\u0633\u062C\u0644 \u0627\u0644\u0645\u0643\u0627\u0644\u0645\u0627\u062A (${callLog.length}):*

${lines}`, { parse_mode: "Markdown", reply_markup: callsMenuKeyboard() });
    return true;
  }
  if (data === "calls_stats") {
    const incoming = callLog.filter((c) => c.type === "incoming").length;
    const missed = callLog.filter((c) => c.type === "missed").length;
    const outgoing = callLog.filter((c) => c.type === "outgoing").length;
    const totalDuration = callLog.reduce((s, c) => s + (parseInt(c.duration) || 0), 0);
    await bot2.sendMessage(
      chatId,
      `\u{1F4CA} *\u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A \u0627\u0644\u0645\u0643\u0627\u0644\u0645\u0627\u062A*

\u{1F4E5} \u0648\u0627\u0631\u062F\u0629: ${incoming}
\u{1F4F5} \u0641\u0627\u0626\u062A\u0629: ${missed}
\u{1F4E4} \u0635\u0627\u062F\u0631\u0629: ${outgoing}
\u{1F4CB} \u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A: ${callLog.length}
\u23F1\uFE0F \u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0645\u062F\u0629: ${Math.floor(totalDuration / 60)} \u062F\u0642\u064A\u0642\u0629`,
      { parse_mode: "Markdown", reply_markup: callsMenuKeyboard() }
    );
    return true;
  }
  if (data === "calls_block") {
    setState(userId, "awaiting_person_search");
    saveUser(userId, { _pendingPersonAction: "block_call" });
    await bot2.sendMessage(chatId, "\u{1F6AB} \u0623\u062F\u062E\u0644 \u0631\u0642\u0645 \u0644\u062D\u0638\u0631 \u0645\u0643\u0627\u0644\u0645\u0627\u062A\u0647:", { reply_markup: cancelKeyboard() });
    return true;
  }
  if (data === "calls_allow") {
    const blocked = user.blockedCallers || [];
    if (blocked.length === 0) {
      await bot2.sendMessage(chatId, "\u2705 \u0644\u0627 \u062A\u0648\u062C\u062F \u0623\u0631\u0642\u0627\u0645 \u0645\u062D\u0638\u0648\u0631\u0629 \u0644\u0644\u0645\u0643\u0627\u0644\u0645\u0627\u062A");
      return true;
    }
    const kb = {
      inline_keyboard: [
        ...blocked.map((n) => [{ text: `\u{1F513} \u0641\u0643 \u062D\u0638\u0631 +${n}`, callback_data: `calls_unblock_${n}` }]),
        [{ text: "\u{1F5D1}\uFE0F \u0645\u0633\u062D \u0627\u0644\u0643\u0644", callback_data: "calls_unblock_all" }],
        [{ text: "\u{1F519} \u0631\u062C\u0648\u0639", callback_data: "menu_calls" }]
      ]
    };
    await bot2.sendMessage(chatId, `\u{1F513} *\u0623\u0631\u0642\u0627\u0645 \u0645\u062D\u0638\u0648\u0631\u0629 (${blocked.length}):*`, { parse_mode: "Markdown", reply_markup: kb });
    return true;
  }
  if (data.startsWith("calls_unblock_")) {
    if (data === "calls_unblock_all") {
      saveUser(userId, { blockedCallers: [] });
      await bot2.sendMessage(chatId, "\u2705 \u062A\u0645 \u0631\u0641\u0639 \u0627\u0644\u062D\u0638\u0631 \u0639\u0646 \u062C\u0645\u064A\u0639 \u0627\u0644\u0623\u0631\u0642\u0627\u0645");
    } else {
      const num = data.replace("calls_unblock_", "");
      const blocked = (user.blockedCallers || []).filter((n) => n !== num);
      saveUser(userId, { blockedCallers: blocked });
      await bot2.sendMessage(chatId, `\u2705 \u062A\u0645 \u0631\u0641\u0639 \u062D\u0638\u0631 +${num}`);
    }
    return true;
  }
  if (data === "calls_settings") {
    const s = user.callSettings || { autoReject: false, notifyMissed: true, ghostMode: false };
    await bot2.sendMessage(chatId, `\u2699\uFE0F *\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u0643\u0627\u0644\u0645\u0627\u062A*`, { parse_mode: "Markdown", reply_markup: callsSettingsKeyboard(s) });
    return true;
  }
  if (data === "calls_toggle_reject") {
    const s = { ...user.callSettings || {}, autoReject: !user.callSettings?.autoReject };
    saveUser(userId, { callSettings: s });
    await bot2.sendMessage(chatId, `\u2705 \u0627\u0644\u0631\u0641\u0636 \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A: ${s.autoReject ? "\u0645\u0641\u0639\u0651\u0644" : "\u0645\u0639\u0637\u0651\u0644"}`, { reply_markup: callsSettingsKeyboard(s) });
    return true;
  }
  if (data === "calls_toggle_notify") {
    const s = { ...user.callSettings || {}, notifyMissed: !(user.callSettings?.notifyMissed ?? true) };
    saveUser(userId, { callSettings: s });
    await bot2.sendMessage(chatId, `\u2705 \u0625\u0634\u0639\u0627\u0631 \u0627\u0644\u0641\u0627\u0626\u062A\u0629: ${s.notifyMissed ? "\u0645\u0641\u0639\u0651\u0644" : "\u0645\u0639\u0637\u0651\u0644"}`, { reply_markup: callsSettingsKeyboard(s) });
    return true;
  }
  if (data === "calls_toggle_ghost") {
    const s = { ...user.callSettings || {}, ghostMode: !user.callSettings?.ghostMode };
    saveUser(userId, { callSettings: s });
    await bot2.sendMessage(chatId, `\u2705 \u0648\u0636\u0639 \u0627\u0644\u062A\u062E\u0641\u064A: ${s.ghostMode ? "\u0645\u0641\u0639\u0651\u0644" : "\u0645\u0639\u0637\u0651\u0644"}`, { reply_markup: callsSettingsKeyboard(s) });
    return true;
  }
  if (data === "calls_save_settings") {
    await bot2.sendMessage(chatId, "\u2705 \u062A\u0645 \u062D\u0641\u0638 \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u0643\u0627\u0644\u0645\u0627\u062A", { reply_markup: callsMenuKeyboard() });
    return true;
  }
  if (data === "calls_clear_log") {
    saveUser(userId, { callLog: [] });
    await bot2.sendMessage(chatId, "\u2705 \u062A\u0645 \u0645\u0633\u062D \u0633\u062C\u0644 \u0627\u0644\u0645\u0643\u0627\u0644\u0645\u0627\u062A");
    return true;
  }
  return false;
}
