let _deps = {};
export function setDeps(d) { _deps = d; }

export function statusMainKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "\u{1F4DD} \u062D\u0627\u0644\u0629 \u0646\u0635\u064A\u0629", callback_data: "status_send_text" }, { text: "\u{1F5BC}\uFE0F \u062D\u0627\u0644\u0629 \u0635\u0648\u0631\u0629", callback_data: "status_send_image" }],
      [{ text: "\u{1F3AC} \u062D\u0627\u0644\u0629 \u0641\u064A\u062F\u064A\u0648", callback_data: "status_send_video" }, { text: "\u{1F3A8} \u062D\u0627\u0644\u0629 \u0628\u062E\u0644\u0641\u064A\u0629 \u0645\u0644\u0648\u0646\u0629", callback_data: "status_send_colored" }],
      [{ text: "\u{1F4CB} \u0633\u062C\u0644 \u062D\u0627\u0644\u0627\u062A\u064A", callback_data: "status_history" }, { text: "\u{1F4C5} \u062C\u062F\u0648\u0644\u0629 \u062D\u0627\u0644\u0629", callback_data: "status_schedule" }],
      [{ text: "\u{1F441}\uFE0F \u062D\u0627\u0644\u0627\u062A \u0627\u0644\u0622\u062E\u0631\u064A\u0646", callback_data: "status_view_others" }, { text: "\u{1F4E5} \u062A\u0646\u0632\u064A\u0644 \u062D\u0627\u0644\u0629", callback_data: "status_download" }],
      [{ text: "\u{1F504} \u062D\u0627\u0644\u0629 \u062A\u0644\u0642\u0627\u0626\u064A\u0629", callback_data: "status_auto" }, { text: "\u{1F4BE} \u062D\u0641\u0638 \u062D\u0627\u0644\u0627\u062A \u0627\u0644\u0622\u062E\u0631\u064A\u0646", callback_data: "status_save_others" }],
      [{ text: "\u{1F514} \u0625\u0634\u0639\u0627\u0631 \u0627\u0644\u0623\u0635\u062F\u0642\u0627\u0621", callback_data: "status_notify_friends" }, { text: "\u{1F4CA} \u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A", callback_data: "status_stats" }],
      [{ text: "\u{1F519} \u0631\u062C\u0648\u0639", callback_data: "back" }, { text: "\u{1F3E0} \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629", callback_data: "home" }]
    ]
  };
}

export function colorKeyboard() {
  const { BG_COLORS } = _deps;
  const rows = [];
  const entries = Object.keys(BG_COLORS || {});
  for (let i = 0; i < entries.length; i += 2) {
    const row = [{ text: entries[i], callback_data: `status_color_${i}` }];
    if (entries[i + 1]) row.push({ text: entries[i + 1], callback_data: `status_color_${i + 1}` });
    rows.push(row);
  }
  rows.push([{ text: "\u274C \u0625\u0644\u063A\u0627\u0621", callback_data: "cancel" }]);
  return { inline_keyboard: rows };
}

export async function handleStatusCallback(bot2, chatId, userId, data) {
  const { getUser, saveUser, inMemoryDB, cancelKeyboard, setState, getState, clearState } = _deps;
  const user = getUser(userId);
  const sock = inMemoryDB.sessions.get(userId);
  const statusSettings = user.statusSettings || {};
  if (data === "menu_status") {
    const history = user.statusHistory || [];
    const autoEnabled = statusSettings.autoStatus ? "\u2705" : "\u274C";
    const saveOthers = statusSettings.saveOthers ? "\u2705" : "\u274C";
    const notifyFrds = statusSettings.notifyFriends ? "\u2705" : "\u274C";
    const savedCount = statusSettings.savedCount || 0;
    await bot2.sendMessage(
      chatId,
      `\u{1F4CA} *\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u062D\u0627\u0644\u0629*

${sock ? "\u2705 \u0648\u0627\u062A\u0633\u0627\u0628 \u0645\u062A\u0635\u0644" : "\u274C \u0648\u0627\u062A\u0633\u0627\u0628 \u063A\u064A\u0631 \u0645\u062A\u0635\u0644 \u2014 \u0631\u0628\u0637 \u0623\u0648\u0644\u0627\u064B"}

\u{1F4CB} \u0625\u062C\u0645\u0627\u0644\u064A \u062D\u0627\u0644\u0627\u062A\u064A \u0627\u0644\u0645\u0631\u0633\u0644\u0629: ${history.length}
\u{1F4BE} \u062D\u0627\u0644\u0627\u062A \u0627\u0644\u0622\u062E\u0631\u064A\u0646 \u0627\u0644\u0645\u062D\u0641\u0648\u0638\u0629: ${savedCount}

\u2699\uFE0F \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A:
\u2022 \u062D\u0627\u0644\u0629 \u062A\u0644\u0642\u0627\u0626\u064A\u0629: ${autoEnabled}
\u2022 \u062D\u0641\u0638 \u062D\u0627\u0644\u0627\u062A \u0627\u0644\u0622\u062E\u0631\u064A\u0646: ${saveOthers}
\u2022 \u0625\u0634\u0639\u0627\u0631 \u062D\u0627\u0644\u0627\u062A \u0627\u0644\u0623\u0635\u062F\u0642\u0627\u0621: ${notifyFrds}`,
      { parse_mode: "Markdown", reply_markup: statusMainKeyboard() }
    );
    return true;
  }
  if (data === "status_send_text") {
    if (!sock) { await bot2.sendMessage(chatId, "\u274C \u0631\u0628\u0637 \u0648\u0627\u062A\u0633\u0627\u0628 \u0623\u0648\u0644\u0627\u064B"); return true; }
    setState(userId, "awaiting_status_text");
    await bot2.sendMessage(chatId, `\u{1F4DD} *\u0625\u0631\u0633\u0627\u0644 \u062D\u0627\u0644\u0629 \u0646\u0635\u064A\u0629*\n\n\u0627\u0643\u062A\u0628 \u0646\u0635 \u0627\u0644\u062D\u0627\u0644\u0629 (\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 700 \u062D\u0631\u0641):\n\n\u{1F4A1} \u062A\u062F\u0639\u0645 \u0627\u0644\u0625\u064A\u0645\u0648\u062C\u064A \u0648\u0627\u0644\u0646\u0635\u0648\u0635 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0648\u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629`, { parse_mode: "Markdown", reply_markup: cancelKeyboard() });
    return true;
  }
  if (data === "status_send_image") {
    if (!sock) { await bot2.sendMessage(chatId, "\u274C \u0631\u0628\u0637 \u0648\u0627\u062A\u0633\u0627\u0628 \u0623\u0648\u0644\u0627\u064B"); return true; }
    setState(userId, "awaiting_status_image");
    await bot2.sendMessage(chatId, `\u{1F5BC}\uFE0F *\u0625\u0631\u0633\u0627\u0644 \u062D\u0627\u0644\u0629 \u0635\u0648\u0631\u0629*\n\n\u0623\u0631\u0633\u0644 \u0627\u0644\u0635\u0648\u0631\u0629 \u0645\u0628\u0627\u0634\u0631\u0629\u064B \u0645\u0646 \u062A\u064A\u0644\u064A\u063A\u0631\u0627\u0645\u060C \u0623\u0648 \u0623\u0631\u0633\u0644 \u0631\u0627\u0628\u0637 \u0635\u0648\u0631\u0629 (URL):\n\n\u{1F4A1} \u064A\u0645\u0643\u0646\u0643 \u0625\u0636\u0627\u0641\u0629 \u062A\u0639\u0644\u064A\u0642 (caption) \u0645\u0639 \u0627\u0644\u0635\u0648\u0631\u0629`, { parse_mode: "Markdown", reply_markup: cancelKeyboard() });
    return true;
  }
  if (data === "status_send_video") {
    if (!sock) { await bot2.sendMessage(chatId, "\u274C \u0631\u0628\u0637 \u0648\u0627\u062A\u0633\u0627\u0628 \u0623\u0648\u0644\u0627\u064B"); return true; }
    setState(userId, "awaiting_status_video");
    await bot2.sendMessage(chatId, `\u{1F3AC} *\u0625\u0631\u0633\u0627\u0644 \u062D\u0627\u0644\u0629 \u0641\u064A\u062F\u064A\u0648*\n\n\u0623\u0631\u0633\u0644 \u0627\u0644\u0641\u064A\u062F\u064A\u0648 \u0645\u0628\u0627\u0634\u0631\u0629\u064B \u0645\u0646 \u062A\u064A\u0644\u064A\u063A\u0631\u0627\u0645:\n\n\u{1F4A1} \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 15 \u062B\u0627\u0646\u064A\u0629 \u0644\u062D\u0627\u0644\u0627\u062A \u0648\u0627\u062A\u0633\u0627\u0628`, { parse_mode: "Markdown", reply_markup: cancelKeyboard() });
    return true;
  }
  if (data === "status_send_colored") {
    if (!sock) { await bot2.sendMessage(chatId, "\u274C \u0631\u0628\u0637 \u0648\u0627\u062A\u0633\u0627\u0628 \u0623\u0648\u0644\u0627\u064B"); return true; }
    setState(userId, "awaiting_status_color_text");
    await bot2.sendMessage(chatId, `\u{1F3A8} *\u062D\u0627\u0644\u0629 \u0628\u062E\u0644\u0641\u064A\u0629 \u0645\u0644\u0648\u0646\u0629*\n\n*\u0627\u0644\u062E\u0637\u0648\u0629 1/2:* \u0627\u0643\u062A\u0628 \u0646\u0635 \u0627\u0644\u062D\u0627\u0644\u0629:`, { parse_mode: "Markdown", reply_markup: cancelKeyboard() });
    return true;
  }
  if (data.startsWith("status_color_")) {
    const { BG_COLORS } = _deps;
    const colorIdx = parseInt(data.replace("status_color_", ""), 10);
    const colorName = Object.keys(BG_COLORS)[colorIdx];
    const colorHex = BG_COLORS[colorName];
    const state = getState(userId);
    const statusText = state.data?.colorText || "";
    if (!statusText) { await bot2.sendMessage(chatId, "\u274C \u0644\u0645 \u064A\u064F\u0639\u062B\u0631 \u0639\u0644\u0649 \u0627\u0644\u0646\u0635. \u0627\u0628\u062F\u0623 \u0645\u0646 \u062C\u062F\u064A\u062F.", { reply_markup: statusMainKeyboard() }); return true; }
    clearState(userId);
    try {
      await sock?.sendMessage("status@broadcast", { text: statusText.slice(0, 700), backgroundArgb: colorHex, font: 2 });
      const history = user.statusHistory || [];
      history.push({ text: statusText, type: "colored", color: colorName, date: (new Date()).toISOString() });
      saveUser(userId, { statusHistory: history.slice(-50) });
      await bot2.sendMessage(chatId, `\u2705 \u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062D\u0627\u0644\u0629 \u0627\u0644\u0645\u0644\u0648\u0646\u0629 ${colorName} \u0628\u0646\u062C\u0627\u062D!`);
    } catch (e) {
      await bot2.sendMessage(chatId, `\u274C \u0641\u0634\u0644 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062D\u0627\u0644\u0629: ${e.message || ""}`);
    }
    return true;
  }
  if (data === "status_auto") {
    const autoEnabled = !statusSettings.autoStatus;
    saveUser(userId, { statusSettings: { ...statusSettings, autoStatus: autoEnabled } });
    await bot2.sendMessage(chatId, `${autoEnabled ? "\u2705 \u0627\u0644\u062D\u0627\u0644\u0629 \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A\u0629 \u0645\u0641\u0639\u0651\u0644\u0629" : "\u274C \u0627\u0644\u062D\u0627\u0644\u0629 \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A\u0629 \u0645\u0639\u0637\u0651\u0644\u0629"}\n\n${autoEnabled ? "\u{1F4C5} \u0633\u064A\u064F\u0631\u0633\u064E\u0644 \u062A\u062D\u062F\u064A\u062B \u062D\u0627\u0644\u0629 \u062A\u0644\u0642\u0627\u0626\u064A \u0643\u0644 24 \u0633\u0627\u0639\u0629 \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B." : ""}`, { reply_markup: statusMainKeyboard() });
    return true;
  }
  if (data === "status_save_others") {
    const val = !statusSettings.saveOthers;
    saveUser(userId, { statusSettings: { ...statusSettings, saveOthers: val } });
    await bot2.sendMessage(chatId, `${val ? "\u2705" : "\u274C"} \u062D\u0641\u0638 \u062D\u0627\u0644\u0627\u062A \u0627\u0644\u0622\u062E\u0631\u064A\u0646: ${val ? "\u0645\u0641\u0639\u0651\u0644 \u2014 \u0633\u062A\u064F\u062D\u0641\u0638 \u0643\u0644 \u062D\u0627\u0644\u0629 \u062A\u0631\u0627\u0647\u0627" : "\u0645\u0639\u0637\u0651\u0644"}`, { reply_markup: statusMainKeyboard() });
    return true;
  }
  if (data === "status_notify_friends") {
    const val = !statusSettings.notifyFriends;
    saveUser(userId, { statusSettings: { ...statusSettings, notifyFriends: val } });
    await bot2.sendMessage(chatId, `${val ? "\u2705" : "\u274C"} \u0625\u0634\u0639\u0627\u0631 \u062D\u0627\u0644\u0627\u062A \u0627\u0644\u0623\u0635\u062F\u0642\u0627\u0621: ${val ? "\u0645\u0641\u0639\u0651\u0644" : "\u0645\u0639\u0637\u0651\u0644"}`, { reply_markup: statusMainKeyboard() });
    return true;
  }
  if (data === "status_history") {
    const history = user.statusHistory || [];
    if (history.length === 0) { await bot2.sendMessage(chatId, "\u{1F4CB} \u0644\u0627 \u062A\u0648\u062C\u062F \u062D\u0627\u0644\u0627\u062A \u0633\u0627\u0628\u0642\u0629.", { reply_markup: statusMainKeyboard() }); return true; }
    const lines = history.slice(-15).reverse().map((h, i) => {
      const typeIcon = h.type === "image" ? "\u{1F5BC}\uFE0F" : h.type === "video" ? "\u{1F3AC}" : h.type === "colored" ? "\u{1F3A8}" : "\u{1F4DD}";
      const preview = (h.text || "").slice(0, 40) || `[${h.type || "\u062D\u0627\u0644\u0629"}]`;
      const date = new Date(h.date).toLocaleDateString("ar-SA");
      return `${i + 1}. ${typeIcon} "${preview}" \u2014 ${date}`;
    }).join("\n");
    await bot2.sendMessage(chatId, `\u{1F4CB} *\u0622\u062E\u0631 ${history.length} \u062D\u0627\u0644\u0629:*\n\n${lines}`, { parse_mode: "Markdown", reply_markup: statusMainKeyboard() });
    return true;
  }
  if (data === "status_stats") {
    const history = user.statusHistory || [];
    const byType = history.reduce((acc, h) => { acc[h.type || "text"] = (acc[h.type || "text"] || 0) + 1; return acc; }, {});
    await bot2.sendMessage(chatId, `\u{1F4CA} *\u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A \u0627\u0644\u062D\u0627\u0644\u0627\u062A*\n\n\u{1F4DD} \u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u062D\u0627\u0644\u0627\u062A: ${history.length}\n\u{1F4DD} \u0646\u0635\u064A\u0629: ${byType.text || 0}\n\u{1F5BC}\uFE0F \u0635\u0648\u0631: ${byType.image || 0}\n\u{1F3AC} \u0641\u064A\u062F\u064A\u0648: ${byType.video || 0}\n\u{1F3A8} \u0645\u0644\u0648\u0646\u0629: ${byType.colored || 0}\n\u{1F4BE} \u062D\u0627\u0644\u0627\u062A \u0645\u062D\u0641\u0648\u0638\u0629 \u0645\u0646 \u0627\u0644\u0622\u062E\u0631\u064A\u0646: ${statusSettings.savedCount || 0}`, { parse_mode: "Markdown", reply_markup: statusMainKeyboard() });
    return true;
  }
  if (data === "status_schedule") {
    if (!sock) { await bot2.sendMessage(chatId, "\u274C \u0631\u0628\u0637 \u0648\u0627\u062A\u0633\u0627\u0628 \u0623\u0648\u0644\u0627\u064B"); return true; }
    setState(userId, "awaiting_scheduled_status_text");
    await bot2.sendMessage(chatId, `\u{1F4C5} *\u062C\u062F\u0648\u0644\u0629 \u062D\u0627\u0644\u0629*\n\n*\u0627\u0644\u062E\u0637\u0648\u0629 1/2:* \u0627\u0643\u062A\u0628 \u0646\u0635 \u0627\u0644\u062D\u0627\u0644\u0629 \u0627\u0644\u062A\u064A \u062A\u0631\u064A\u062F \u062C\u062F\u0648\u0644\u062A\u0647\u0627:`, { parse_mode: "Markdown", reply_markup: cancelKeyboard() });
    return true;
  }
  if (data === "status_view_others") {
    if (!sock) { await bot2.sendMessage(chatId, "\u274C \u0631\u0628\u0637 \u0648\u0627\u062A\u0633\u0627\u0628 \u0623\u0648\u0644\u0627\u064B"); return true; }
    if (!inMemoryDB.statusBuf) inMemoryDB.statusBuf = new Map();
    const _statuses = inMemoryDB.statusBuf.get(userId) || [];
    if (_statuses.length === 0) {
      await bot2.sendMessage(chatId, "\u{1F441}\uFE0F *\u062D\u0627\u0644\u0627\u062A \u0627\u0644\u0622\u062E\u0631\u064A\u0646*\n\n\u23F3 \u0644\u0645 \u062A\u0635\u0644 \u0623\u064A \u062D\u0627\u0644\u0629 \u062D\u062A\u0649 \u0627\u0644\u0622\u0646.\n\u062A\u0623\u0643\u062F \u0645\u0646 \u0627\u062A\u0635\u0627\u0644 \u0648\u0627\u062A\u0633\u0627\u0628 \u062B\u0645 \u0627\u0646\u062A\u0638\u0631 \u0648\u0635\u0648\u0644 \u062D\u0627\u0644\u0629 \u062C\u062F\u064A\u062F\u0629.", { parse_mode: "Markdown", reply_markup: statusMainKeyboard() });
      return true;
    }
    const _recent = _statuses.slice(-25).reverse();
    let _stMsg = "\u{1F441}\uFE0F *\u062D\u0627\u0644\u0627\u062A \u0627\u0644\u0622\u062E\u0631\u064A\u0646 (" + _statuses.length + " \u062D\u0627\u0644\u0629):*\n\n";
    for (const _s of _recent) {
      const _num = _s.jid ? _s.jid.split("@")[0] : "?";
      const _time = new Date(_s.ts).toLocaleTimeString("ar");
      const _type = _s.hasMedia ? "\u{1F5BC}\uFE0F \u0648\u0633\u0627\u0626\u0637" : ("\u{1F4DD} " + (_s.text ? _s.text.slice(0, 55) : "\u0646\u0635"));
      _stMsg += "\u2022 +" + _num + " [" + _time + "]: " + _type + "\n";
    }
    await bot2.sendMessage(chatId, _stMsg, { parse_mode: "Markdown", reply_markup: statusMainKeyboard() });
    return true;
  }
  if (data === "status_download") {
    setState(userId, "awaiting_status_download_name");
    await bot2.sendMessage(chatId, `\u{1F4E5} *\u062A\u0646\u0632\u064A\u0644 \u062D\u0627\u0644\u0629*\n\n\u0623\u062F\u062E\u0644 \u0631\u0642\u0645 \u0635\u0627\u062D\u0628 \u0627\u0644\u062D\u0627\u0644\u0629 (\u0645\u0639 \u0643\u0648\u062F \u0627\u0644\u062F\u0648\u0644\u0629) \u0644\u062A\u0646\u0632\u064A\u0644 \u062D\u0627\u0644\u062A\u0647:\n\n\u0645\u062B\u0627\u0644: \`966501234567\``, { parse_mode: "Markdown", reply_markup: cancelKeyboard() });
    return true;
  }
  return false;
}

export async function handleStatusTextInput(bot2, chatId, userId, text, state) {
  const { getUser, saveUser, inMemoryDB, cancelKeyboard, setState, clearState } = _deps;
  const user = getUser(userId);
  const sock = inMemoryDB.sessions.get(userId);
  if (state.state === "awaiting_status_text") {
    if (!sock) { clearState(userId); await bot2.sendMessage(chatId, "\u274C \u0627\u0646\u0642\u0637\u0639 \u0627\u062A\u0635\u0627\u0644 \u0648\u0627\u062A\u0633\u0627\u0628"); return true; }
    try {
      await sock.sendMessage?.("status@broadcast", { text: text.slice(0, 700) });
      const history = user.statusHistory || [];
      history.push({ text, type: "text", date: (new Date()).toISOString() });
      saveUser(userId, { statusHistory: history.slice(-50) });
      clearState(userId);
      await bot2.sendMessage(chatId, "\u2705 \u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062D\u0627\u0644\u0629 \u0627\u0644\u0646\u0635\u064A\u0629 \u0628\u0646\u062C\u0627\u062D! \u{1F389}", { reply_markup: statusMainKeyboard() });
    } catch (e) {
      clearState(userId);
      await bot2.sendMessage(chatId, `\u274C \u0641\u0634\u0644 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062D\u0627\u0644\u0629: ${e.message || "\u062E\u0637\u0623 \u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641"}`);
    }
    return true;
  }
  if (state.state === "awaiting_status_image") {
    if (!sock) { clearState(userId); await bot2.sendMessage(chatId, "\u274C \u0627\u0646\u0642\u0637\u0639 \u0627\u062A\u0635\u0627\u0644 \u0648\u0627\u062A\u0633\u0627\u0628"); return true; }
    const url = text.trim();
    if (!url.startsWith("http")) { await bot2.sendMessage(chatId, "\u274C \u0623\u0631\u0633\u0644 \u0631\u0627\u0628\u0637\u0627\u064B \u0635\u062D\u064A\u062D\u0627\u064B \u064A\u0628\u062F\u0623 \u0628\u0640 http \u0623\u0648 \u0623\u0631\u0633\u0644 \u0627\u0644\u0635\u0648\u0631\u0629 \u0645\u0628\u0627\u0634\u0631\u0629\u064B.", { reply_markup: cancelKeyboard() }); return true; }
    await bot2.sendMessage(chatId, "\u23F3 \u062C\u0627\u0631\u064A \u062A\u062D\u0645\u064A\u0644 \u0648\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0635\u0648\u0631\u0629...");
    try {
      const res = await fetch(url);
      const buf = Buffer.from(await res.arrayBuffer());
      await sock.sendMessage?.("status@broadcast", { image: buf, caption: "" });
      const history = user.statusHistory || [];
      history.push({ type: "image", url, date: (new Date()).toISOString() });
      saveUser(userId, { statusHistory: history.slice(-50) });
      clearState(userId);
      await bot2.sendMessage(chatId, "\u2705 \u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u062D\u0627\u0644\u0629 \u0627\u0644\u0635\u0648\u0631\u0629 \u0628\u0646\u062C\u0627\u062D! \u{1F389}", { reply_markup: statusMainKeyboard() });
    } catch (e) {
      clearState(userId);
      await bot2.sendMessage(chatId, `\u274C \u0641\u0634\u0644 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0635\u0648\u0631\u0629: ${e.message || ""}`);
    }
    return true;
  }
  if (state.state === "awaiting_status_color_text") {
    setState(userId, "awaiting_status_color_pick", { colorText: text });
    await bot2.sendMessage(chatId, `\u2705 *\u0627\u0644\u0646\u0635:* "${text.slice(0, 60)}"\n\n*\u0627\u0644\u062E\u0637\u0648\u0629 2/2:* \u0627\u062E\u062A\u0631 \u0644\u0648\u0646 \u0627\u0644\u062E\u0644\u0641\u064A\u0629:`, { parse_mode: "Markdown", reply_markup: colorKeyboard() });
    return true;
  }
  if (state.state === "awaiting_scheduled_status_text") {
    setState(userId, "awaiting_scheduled_status_time", { scheduledStatusText: text });
    await bot2.sendMessage(chatId, `\u2705 *\u0627\u0644\u0646\u0635:* "${text.slice(0, 60)}"\n\n*\u0627\u0644\u062E\u0637\u0648\u0629 2/2:* \u0628\u0639\u062F \u0643\u0645 \u062F\u0642\u064A\u0642\u0629 \u062A\u0631\u0633\u0644 \u0627\u0644\u062D\u0627\u0644\u0629\u061F\n\n\u0645\u062B\u0627\u0644: \`30\` (30 \u062F\u0642\u064A\u0642\u0629) \u0623\u0648 \`120\` (\u0633\u0627\u0639\u062A\u0627\u0646)`, { parse_mode: "Markdown", reply_markup: cancelKeyboard() });
    return true;
  }
  if (state.state === "awaiting_scheduled_status_time") {
    const minutes = parseInt(text.trim(), 10);
    if (isNaN(minutes) || minutes < 1) { await bot2.sendMessage(chatId, "\u274C \u0623\u062F\u062E\u0644 \u0639\u062F\u062F\u0627\u064B \u0635\u062D\u064A\u062D\u0627\u064B \u0645\u0646 \u0627\u0644\u062F\u0642\u0627\u0626\u0642 (\u0623\u0642\u0644 \u0642\u064A\u0645\u0629: 1 \u062F\u0642\u064A\u0642\u0629)", { reply_markup: cancelKeyboard() }); return true; }
    const statusText = state.data.scheduledStatusText;
    clearState(userId);
    const sock2 = inMemoryDB.sessions.get(userId);
    setTimeout(async () => {
      if (!sock2) return;
      try {
        await sock2.sendMessage?.("status@broadcast", { text: statusText.slice(0, 700) });
        const freshUser = getUser(userId);
        const history = freshUser.statusHistory || [];
        history.push({ text: statusText, type: "text", scheduled: true, date: (new Date()).toISOString() });
        saveUser(userId, { statusHistory: history.slice(-50) });
        try { await bot2.sendMessage(chatId, `\u2705 \u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062D\u0627\u0644\u0629 \u0627\u0644\u0645\u062C\u062F\u0648\u0644\u0629:\n"${statusText.slice(0, 60)}"`, { reply_markup: statusMainKeyboard() }); } catch {}
      } catch {}
    }, minutes * 60 * 1e3);
    await bot2.sendMessage(chatId, `\u2705 *\u062A\u0645 \u062C\u062F\u0648\u0644\u0629 \u0627\u0644\u062D\u0627\u0644\u0629!*\n\n\u{1F4DD} \u0627\u0644\u0646\u0635: "${statusText.slice(0, 60)}"\n\u23F1\uFE0F \u0633\u064A\u064F\u0631\u0633\u064E\u0644 \u0628\u0639\u062F ${minutes} \u062F\u0642\u064A\u0642\u0629`, { parse_mode: "Markdown", reply_markup: statusMainKeyboard() });
    return true;
  }
  if (state.state === "awaiting_status_download_name") {
    const phone = text.replace(/\D/g, "");
    if (!phone || phone.length < 7) { await bot2.sendMessage(chatId, "\u274C \u0631\u0642\u0645 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D", { reply_markup: cancelKeyboard() }); return true; }
    clearState(userId);
    const sock2 = inMemoryDB.sessions.get(userId);
    if (!sock2) { await bot2.sendMessage(chatId, "\u274C \u0648\u0627\u062A\u0633\u0627\u0628 \u063A\u064A\u0631 \u0645\u062A\u0635\u0644"); return true; }
    await bot2.sendMessage(chatId, "\u23F3 \u062C\u0627\u0631\u064A \u0627\u0644\u0628\u062D\u062B \u0639\u0646 \u0627\u0644\u062D\u0627\u0644\u0629...");
    try {
      const jid = `${phone}@s.whatsapp.net`;
      const status = await sock2.fetchStatus?.(jid);
      if (status?.status) {
        await bot2.sendMessage(chatId, `\u{1F4CA} *\u062D\u0627\u0644\u0629 +${phone}:*\n\n"${status.status}"\n\n\u{1F550} ${status.setAt ? new Date(status.setAt).toLocaleString("ar-SA") : ""}`, { parse_mode: "Markdown", reply_markup: statusMainKeyboard() });
      } else {
        await bot2.sendMessage(chatId, `\u2139\uFE0F \u0644\u0627 \u062A\u0648\u062C\u062F \u062D\u0627\u0644\u0629 \u0646\u0635\u064A\u0629 \u0644\u0640 +${phone} \u0623\u0648 \u0644\u0627 \u062A\u0645\u0644\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0645\u0634\u0627\u0647\u062F\u0629`, { reply_markup: statusMainKeyboard() });
      }
    } catch (e) {
      await bot2.sendMessage(chatId, `\u274C \u0641\u0634\u0644 \u062C\u0644\u0628 \u0627\u0644\u062D\u0627\u0644\u0629: ${e.message || ""}`, { reply_markup: statusMainKeyboard() });
    }
    return true;
  }
  return false;
}

export async function handleStatusMedia(bot2, chatId, userId, msg, state) {
  const { getUser, saveUser, inMemoryDB, clearState } = _deps;
  const user = getUser(userId);
  const sock = inMemoryDB.sessions.get(userId);
  if (state.state === "awaiting_status_image" && msg.photo) {
    if (!sock) { clearState(userId); await bot2.sendMessage(chatId, "\u274C \u0627\u0646\u0642\u0637\u0639 \u0627\u062A\u0635\u0627\u0644 \u0648\u0627\u062A\u0633\u0627\u0628"); return true; }
    const photo = msg.photo[msg.photo.length - 1];
    const caption = msg.caption || "";
    clearState(userId);
    await bot2.sendMessage(chatId, "\u23F3 \u062C\u0627\u0631\u064A \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0635\u0648\u0631\u0629 \u0644\u0644\u062D\u0627\u0644\u0629...");
    try {
      const fileInfo = await bot2.getFile(photo.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${bot2.token}/${fileInfo.file_path}`;
      const res = await fetch(fileUrl);
      const buf = Buffer.from(await res.arrayBuffer());
      await sock.sendMessage?.("status@broadcast", { image: buf, caption: caption.slice(0, 700) });
      const history = user.statusHistory || [];
      history.push({ type: "image", caption, date: (new Date()).toISOString() });
      saveUser(userId, { statusHistory: history.slice(-50) });
      await bot2.sendMessage(chatId, "\u2705 \u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u062D\u0627\u0644\u0629 \u0627\u0644\u0635\u0648\u0631\u0629 \u0628\u0646\u062C\u0627\u062D! \u{1F389}", { reply_markup: statusMainKeyboard() });
    } catch (e) {
      await bot2.sendMessage(chatId, `\u274C \u0641\u0634\u0644 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0635\u0648\u0631\u0629: ${e.message || ""}`);
    }
    return true;
  }
  if (state.state === "awaiting_status_video" && msg.video) {
    if (!sock) { clearState(userId); await bot2.sendMessage(chatId, "\u274C \u0627\u0646\u0642\u0637\u0639 \u0627\u062A\u0635\u0627\u0644 \u0648\u0627\u062A\u0633\u0627\u0628"); return true; }
    const video = msg.video;
    const caption = msg.caption || "";
    clearState(userId);
    await bot2.sendMessage(chatId, "\u23F3 \u062C\u0627\u0631\u064A \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0641\u064A\u062F\u064A\u0648 \u0644\u0644\u062D\u0627\u0644\u0629 (\u0642\u062F \u064A\u0633\u062A\u063A\u0631\u0642 \u0628\u0639\u0636 \u0627\u0644\u0648\u0642\u062A)...");
    try {
      const fileInfo = await bot2.getFile(video.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${bot2.token}/${fileInfo.file_path}`;
      const res = await fetch(fileUrl);
      const buf = Buffer.from(await res.arrayBuffer());
      await sock.sendMessage?.("status@broadcast", { video: buf, caption: caption.slice(0, 700) });
      const history = user.statusHistory || [];
      history.push({ type: "video", caption, date: (new Date()).toISOString() });
      saveUser(userId, { statusHistory: history.slice(-50) });
      await bot2.sendMessage(chatId, "\u2705 \u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u062D\u0627\u0644\u0629 \u0627\u0644\u0641\u064A\u062F\u064A\u0648 \u0628\u0646\u062C\u0627\u062D! \u{1F389}", { reply_markup: statusMainKeyboard() });
    } catch (e) {
      await bot2.sendMessage(chatId, `\u274C \u0641\u0634\u0644 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0641\u064A\u062F\u064A\u0648: ${e.message || ""}`);
    }
    return true;
  }
  return false;
}
