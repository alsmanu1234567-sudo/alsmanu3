let _deps = {};
export function setDeps(d) { _deps = d; }

export async function handleGroupsCallback(bot2, chatId, userId, data) {
  const { getUser, setState, cancelKeyboard, inMemoryDB } = _deps;
  const user = getUser(userId);
  const sock = inMemoryDB.sessions.get(userId);
  if (data === "menu_groups" || data === "groups_list") return false;
  if (data === "groups_create") {
    if (!sock) { await bot2.sendMessage(chatId, "\u274C \u0631\u0628\u0637 \u0648\u0627\u062A\u0633\u0627\u0628 \u0623\u0648\u0644\u0627\u064B"); return true; }
    setState(userId, "awaiting_group_name");
    await bot2.sendMessage(chatId, `\u2795 *\u0625\u0646\u0634\u0627\u0621 \u0645\u062C\u0645\u0648\u0639\u0629 \u062C\u062F\u064A\u062F\u0629*\n\n*\u0627\u0644\u062E\u0637\u0648\u0629 1/2:* \u0623\u062F\u062E\u0644 \u0627\u0633\u0645 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629:`, { parse_mode: "Markdown", reply_markup: cancelKeyboard() });
    return true;
  }
  const _fetchGroups = async () => {
    let groups = inMemoryDB.groupsCache.get(userId) || [];
    if (groups.length === 0) {
      try { const c = await sock.groupFetchAllParticipating?.(); groups = c ? Object.values(c) : []; inMemoryDB.groupsCache.set(userId, groups); } catch {}
    }
    return groups;
  };
  if (data === "groups_add_member") {
    if (!sock) { await bot2.sendMessage(chatId, "\u274C \u0631\u0628\u0637 \u0648\u0627\u062A\u0633\u0627\u0628 \u0623\u0648\u0644\u0627\u064B"); return true; }
    const groups = await _fetchGroups();
    if (groups.length === 0) { await bot2.sendMessage(chatId, "\u274C \u0644\u0627 \u062A\u0648\u062C\u062F \u0645\u062C\u0645\u0648\u0639\u0627\u062A"); return true; }
    const rows = groups.slice(0, 10).map((g) => [{ text: `\u{1F465} ${(g.subject || g.id).slice(0, 35)}`, callback_data: `grp_select_add_${g.id}` }]);
    rows.push([{ text: "\u274C \u0625\u0644\u063A\u0627\u0621", callback_data: "cancel" }]);
    await bot2.sendMessage(chatId, "\u{1F465} \u0627\u062E\u062A\u0631 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629 \u0644\u0625\u0636\u0627\u0641\u0629 \u0639\u0636\u0648:", { reply_markup: { inline_keyboard: rows } });
    return true;
  }
  if (data.startsWith("grp_select_add_")) {
    const groupId = data.replace("grp_select_add_", "");
    setState(userId, "awaiting_member_to_add", { groupId });
    await bot2.sendMessage(chatId, `\u2795 \u0623\u062F\u062E\u0644 \u0631\u0642\u0645 \u0627\u0644\u0639\u0636\u0648 \u0644\u0644\u0625\u0636\u0627\u0641\u0629:\n\u0645\u062B\u0627\u0644: \`249960506662\``, { parse_mode: "Markdown", reply_markup: cancelKeyboard() });
    return true;
  }
  if (data === "groups_remove_member") {
    if (!sock) { await bot2.sendMessage(chatId, "\u274C \u0631\u0628\u0637 \u0648\u0627\u062A\u0633\u0627\u0628 \u0623\u0648\u0644\u0627\u064B"); return true; }
    const groups = await _fetchGroups();
    if (groups.length === 0) { await bot2.sendMessage(chatId, "\u274C \u0644\u0627 \u062A\u0648\u062C\u062F \u0645\u062C\u0645\u0648\u0639\u0627\u062A"); return true; }
    const rows = groups.slice(0, 10).map((g) => [{ text: `\u{1F465} ${(g.subject || g.id).slice(0, 35)}`, callback_data: `grp_select_rem_${g.id}` }]);
    rows.push([{ text: "\u274C \u0625\u0644\u063A\u0627\u0621", callback_data: "cancel" }]);
    await bot2.sendMessage(chatId, "\u{1F465} \u0627\u062E\u062A\u0631 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629 \u0644\u0625\u0632\u0627\u0644\u0629 \u0639\u0636\u0648:", { reply_markup: { inline_keyboard: rows } });
    return true;
  }
  if (data.startsWith("grp_select_rem_")) {
    const groupId = data.replace("grp_select_rem_", "");
    setState(userId, "awaiting_member_to_remove", { groupId });
    await bot2.sendMessage(chatId, `\u2796 \u0623\u062F\u062E\u0644 \u0631\u0642\u0645 \u0627\u0644\u0639\u0636\u0648 \u0644\u0644\u0625\u0632\u0627\u0644\u0629:\n\u0645\u062B\u0627\u0644: \`249960506662\``, { parse_mode: "Markdown", reply_markup: cancelKeyboard() });
    return true;
  }
  if (data === "groups_send_msg") {
    if (!sock) { await bot2.sendMessage(chatId, "\u274C \u0631\u0628\u0637 \u0648\u0627\u062A\u0633\u0627\u0628 \u0623\u0648\u0644\u0627\u064B"); return true; }
    const groups = await _fetchGroups();
    if (groups.length === 0) { await bot2.sendMessage(chatId, "\u274C \u0644\u0627 \u062A\u0648\u062C\u062F \u0645\u062C\u0645\u0648\u0639\u0627\u062A"); return true; }
    const rows = groups.slice(0, 10).map((g) => [{ text: `\u{1F465} ${(g.subject || g.id).slice(0, 35)}`, callback_data: `grp_select_msg_${g.id}` }]);
    rows.push([{ text: "\u{1F4E2} \u0625\u0631\u0633\u0627\u0644 \u0644\u0643\u0644 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0627\u062A", callback_data: "grp_send_all" }]);
    rows.push([{ text: "\u274C \u0625\u0644\u063A\u0627\u0621", callback_data: "cancel" }]);
    await bot2.sendMessage(chatId, "\u{1F465} \u0627\u062E\u062A\u0631 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629 \u0644\u0625\u0631\u0633\u0627\u0644 \u0631\u0633\u0627\u0644\u0629:", { reply_markup: { inline_keyboard: rows } });
    return true;
  }
  if (data.startsWith("grp_select_msg_")) {
    const groupId = data.replace("grp_select_msg_", "");
    setState(userId, "awaiting_group_message", { groupId });
    await bot2.sendMessage(chatId, `\u{1F4AC} \u0627\u0643\u062A\u0628 \u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u0644\u0644\u0645\u062C\u0645\u0648\u0639\u0629:`, { reply_markup: cancelKeyboard() });
    return true;
  }
  if (data === "grp_send_all") {
    if (!sock) { await bot2.sendMessage(chatId, "\u274C \u0631\u0628\u0637 \u0648\u0627\u062A\u0633\u0627\u0628 \u0623\u0648\u0644\u0627\u064B"); return true; }
    setState(userId, "awaiting_all_groups_msg");
    await bot2.sendMessage(chatId, `\u{1F4E2} \u0627\u0643\u062A\u0628 \u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u2014 \u0633\u062A\u064F\u0631\u0633\u064E\u0644 \u0644\u062C\u0645\u064A\u0639 \u0645\u062C\u0645\u0648\u0639\u0627\u062A\u0643:`, { reply_markup: cancelKeyboard() });
    return true;
  }
  if (data === "groups_leave") {
    if (!sock) { await bot2.sendMessage(chatId, "\u274C \u0631\u0628\u0637 \u0648\u0627\u062A\u0633\u0627\u0628 \u0623\u0648\u0644\u0627\u064B"); return true; }
    const groups = await _fetchGroups();
    if (groups.length === 0) { await bot2.sendMessage(chatId, "\u274C \u0644\u0627 \u062A\u0648\u062C\u062F \u0645\u062C\u0645\u0648\u0639\u0627\u062A"); return true; }
    const rows = groups.slice(0, 10).map((g) => [{ text: `\u{1F6AA} \u0645\u063A\u0627\u062F\u0631\u0629: ${(g.subject || g.id).slice(0, 30)}`, callback_data: `grp_leave_${g.id}` }]);
    rows.push([{ text: "\u274C \u0625\u0644\u063A\u0627\u0621", callback_data: "cancel" }]);
    await bot2.sendMessage(chatId, "\u26A0\uFE0F *\u0627\u062E\u062A\u0631 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629 \u0644\u0644\u0645\u063A\u0627\u062F\u0631\u0629:*", { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } });
    return true;
  }
  if (data.startsWith("grp_leave_")) {
    const groupId = data.replace("grp_leave_", "");
    if (!sock) { await bot2.sendMessage(chatId, "\u274C \u0631\u0628\u0637 \u0648\u0627\u062A\u0633\u0627\u0628 \u0623\u0648\u0644\u0627\u064B"); return true; }
    try {
      await sock.groupLeave?.(groupId);
      const groups = (inMemoryDB.groupsCache.get(userId) || []).filter((g) => g.id !== groupId);
      inMemoryDB.groupsCache.set(userId, groups);
      await bot2.sendMessage(chatId, `\u2705 \u062A\u0645\u062A \u0645\u063A\u0627\u062F\u0631\u0629 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629`);
    } catch (e) { await bot2.sendMessage(chatId, `\u274C \u0641\u0634\u0644 \u0627\u0644\u0645\u063A\u0627\u062F\u0631\u0629: ${e.message || ""}`); }
    return true;
  }
  if (data === "groups_info") {
    if (!sock) { await bot2.sendMessage(chatId, "\u274C \u0631\u0628\u0637 \u0648\u0627\u062A\u0633\u0627\u0628 \u0623\u0648\u0644\u0627\u064B"); return true; }
    setState(userId, "awaiting_group_info_id");
    await bot2.sendMessage(chatId, `\u{1F50D} \u0623\u062F\u062E\u0644 \u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629:`, { reply_markup: cancelKeyboard() });
    return true;
  }
  if (data === "groups_refresh") {
    if (!sock) { await bot2.sendMessage(chatId, "\u274C \u0631\u0628\u0637 \u0648\u0627\u062A\u0633\u0627\u0628 \u0623\u0648\u0644\u0627\u064B"); return true; }
    await bot2.sendMessage(chatId, "\u23F3 \u062C\u0627\u0631\u064A \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0627\u062A...");
    try {
      const c = await sock.groupFetchAllParticipating?.();
      const groups = c ? Object.values(c) : [];
      inMemoryDB.groupsCache.set(userId, groups);
      await bot2.sendMessage(chatId, `\u2705 \u062A\u0645 \u062A\u062D\u062F\u064A\u062B ${groups.length} \u0645\u062C\u0645\u0648\u0639\u0629`);
    } catch (e) { await bot2.sendMessage(chatId, `\u274C \u0641\u0634\u0644 \u0627\u0644\u062A\u062D\u062F\u064A\u062B: ${e.message || ""}`); }
    return true;
  }
  return false;
}
