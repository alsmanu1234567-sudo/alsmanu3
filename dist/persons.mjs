let _deps = {};
export function setDeps(d) { _deps = d; }

export async function handlePersonsCallback(bot2, chatId, userId, data) {
  const { getUser, saveUser, setState, cancelKeyboard, personsMenuKeyboard, personPickerKeyboard,
    contactsListKeyboard, personChatKeyboard, personSettingsKeyboard, getContacts, getPersonSettings, inMemoryDB } = _deps;
  const user = getUser(userId);
  if (data === "menu_persons") {
    const contacts = getContacts(userId);
    await bot2.sendMessage(chatId, `\u{1F465} *\u0627\u0644\u0623\u0634\u062E\u0627\u0635*\n\n\u062C\u0647\u0627\u062A \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0627\u0644\u0645\u0639\u0631\u0648\u0641\u0629: ${contacts.length}\n\n\u0645\u0627 \u0627\u0644\u0630\u064A \u062A\u0631\u064A\u062F \u0641\u0639\u0644\u0647\u061F`, { parse_mode: "Markdown", reply_markup: personsMenuKeyboard() });
    return true;
  }
  if (data === "person_search") {
    setState(userId, "awaiting_person_search");
    await bot2.sendMessage(chatId, "\u{1F50D} \u0623\u062F\u062E\u0644 \u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u0645\u0639 \u0643\u0648\u062F \u0627\u0644\u062F\u0648\u0644\u0629:\n\u0645\u062B\u0627\u0644: `249960506662`", { parse_mode: "Markdown", reply_markup: cancelKeyboard() });
    return true;
  }
  if (data === "person_chat") {
    await bot2.sendMessage(chatId, "\u{1F4AC} *\u0641\u062A\u062D \u0645\u062D\u0627\u062F\u062B\u0629*\n\n\u0627\u062E\u062A\u0631 \u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u0625\u062F\u062E\u0627\u0644:", { parse_mode: "Markdown", reply_markup: personPickerKeyboard("chat") });
    return true;
  }
  if (data === "person_contacts_list") {
    const contacts = getContacts(userId);
    if (contacts.length === 0) {
      await bot2.sendMessage(chatId, "\u{1F465} *\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0623\u0634\u062E\u0627\u0635*\n\n\u0644\u0627 \u062A\u0648\u062C\u062F \u062C\u0647\u0627\u062A \u0627\u062A\u0635\u0627\u0644 \u0628\u0639\u062F.\n\n\u0633\u062A\u064F\u0636\u0627\u0641 \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B \u0639\u0646\u062F \u0627\u0633\u062A\u0644\u0627\u0645 \u0631\u0633\u0627\u0626\u0644 \u0648\u0627\u062A\u0633\u0627\u0628 \u062E\u0627\u0635\u0629.", { parse_mode: "Markdown", reply_markup: personsMenuKeyboard() });
      return true;
    }
    await bot2.sendMessage(chatId, `\u{1F465} *\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0623\u0634\u062E\u0627\u0635 (${contacts.length}):*\n\n\u0627\u062E\u062A\u0631 \u0634\u062E\u0635\u0627\u064B:`, { parse_mode: "Markdown", reply_markup: contactsListKeyboard(contacts, 0, "view") });
    return true;
  }
  if (data === "person_status_dl") {
    await bot2.sendMessage(chatId, "\u{1F4E5} *\u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u062D\u0627\u0644\u0629*\n\n\u0627\u062E\u062A\u0631 \u0637\u0631\u064A\u0642\u0629:", { parse_mode: "Markdown", reply_markup: personPickerKeyboard("status") });
    return true;
  }
  if (data === "person_pic") {
    await bot2.sendMessage(chatId, "\u{1F5BC}\uFE0F *\u062A\u0646\u0632\u064A\u0644 \u0635\u0648\u0631\u0629 \u0627\u0644\u0628\u0631\u0648\u0641\u0627\u064A\u0644*\n\n\u0627\u062E\u062A\u0631 \u0637\u0631\u064A\u0642\u0629:", { parse_mode: "Markdown", reply_markup: personPickerKeyboard("pic") });
    return true;
  }
  if (data === "person_forward") {
    await bot2.sendMessage(chatId, `\u21AA\uFE0F *\u062A\u0648\u062C\u064A\u0647 \u0627\u0644\u0631\u0633\u0627\u0626\u0644*\n\n\u0647\u0630\u0647 \u0627\u0644\u0645\u064A\u0632\u0629 \u062A\u062A\u064A\u062D \u0625\u0639\u0627\u062F\u0629 \u062A\u0648\u062C\u064A\u0647 \u0631\u0633\u0627\u0626\u0644 \u0634\u062E\u0635 \u0645\u0639\u064A\u0646 \u0644\u0634\u062E\u0635 \u0622\u062E\u0631.\n\n1. \u0627\u0628\u062D\u062B \u0639\u0646 \u0627\u0644\u0634\u062E\u0635 \u0627\u0644\u0645\u0635\u062F\u0631\n2. \u062D\u062F\u062F \u0648\u062C\u0647\u0629 \u0627\u0644\u062A\u0648\u062C\u064A\u0647`, { parse_mode: "Markdown", reply_markup: personsMenuKeyboard() });
    return true;
  }
  if (data === "person_settings_list") {
    const settings = inMemoryDB.personSettings.get(userId);
    if (!settings || settings.size === 0) {
      await bot2.sendMessage(chatId, "\u2699\uFE0F \u0644\u0627 \u062A\u0648\u062C\u062F \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0645\u062E\u0635\u0635\u0629 \u0628\u0639\u062F.", { reply_markup: personsMenuKeyboard() });
      return true;
    }
    const kb = {
      inline_keyboard: [
        ...Array.from(settings.entries()).slice(0, 10).map(([jid, s]) => [{
          text: `\u2699\uFE0F +${jid.split("@")[0]} | \u0631\u062F:${s.autoReply ? "\u2705" : "\u274C"} \u062D\u0638\u0631:${s.blocked ? "\u2705" : "\u274C"}`,
          callback_data: `person_cfg_${jid.replace(/[@.]/g, "_")}`
        }]),
        [{ text: "\u{1F519} \u0631\u062C\u0648\u0639", callback_data: "menu_persons" }]
      ]
    };
    await bot2.sendMessage(chatId, "\u2699\uFE0F *\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0623\u0634\u062E\u0627\u0635:*", { parse_mode: "Markdown", reply_markup: kb });
    return true;
  }
  if (data.startsWith("person_cfg_")) {
    const jidSafe = data.replace("person_cfg_", "");
    const jid = jidSafe.replace(/_/g, "@").replace(/@@/g, "@");
    const pSettings = getPersonSettings(userId, jid);
    await bot2.sendMessage(chatId, `\u2699\uFE0F *\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0634\u062E\u0635*\n\n\u{1F4F1} \u0627\u0644\u0631\u0642\u0645: +${jid.split("@")[0]}`, { parse_mode: "Markdown", reply_markup: _deps.personSettingsKeyboard(jid, pSettings) });
    return true;
  }
  if (data.startsWith("pchat_")) { await handlePersonChatCallback(bot2, chatId, userId, data); return true; }
  if (data.startsWith("psetting_")) { await handlePersonSettingsCallback(bot2, chatId, userId, data); return true; }
  if (data.startsWith("contacts_p")) { await handleContactsPage(bot2, chatId, userId, data); return true; }
  if (data.startsWith("contact_pick_")) { await handleContactPick(bot2, chatId, userId, data); return true; }
  if (data.startsWith("picker_manual_") || data.startsWith("picker_contacts_")) { await handlePersonPicker(bot2, chatId, userId, data); return true; }
  return false;
}

async function handlePersonChatCallback(bot2, chatId, userId, data) {
  const { setState, cancelKeyboard, personChatKeyboard } = _deps;
  const parts = data.split("_");
  const action = parts[1];
  const jidSafe = parts.slice(2).join("_");
  const realJid = jidSafe.replace(/_/g, "@").replace(/@@/g, "@");
  if (action === "open") {
    await bot2.sendMessage(chatId, `\u{1F4AC} *\u0645\u062D\u0627\u062F\u062B\u0629 \u0645\u0639 +${realJid.split("@")[0]}*\n\n\u0627\u062E\u062A\u0631 \u0646\u0648\u0639 \u0627\u0644\u0631\u0633\u0627\u0644\u0629:`, { parse_mode: "Markdown", reply_markup: personChatKeyboard(realJid) });
    return;
  }
  const stateMap = {
    text: { state: "awaiting_pchat_msg", msg: "\u2709\uFE0F \u0627\u0643\u062A\u0628 \u0627\u0644\u0631\u0633\u0627\u0644\u0629:" },
    img:  { state: "awaiting_pchat_msg", msg: "\u{1F5BC}\uFE0F \u0623\u0631\u0633\u0644 \u0631\u0627\u0628\u0637 \u0627\u0644\u0635\u0648\u0631\u0629:" },
    vid:  { state: "awaiting_pchat_msg", msg: "\u{1F3AC} \u0623\u0631\u0633\u0644 \u0631\u0627\u0628\u0637 \u0627\u0644\u0641\u064A\u062F\u064A\u0648:" },
    doc:  { state: "awaiting_pchat_msg", msg: "\u{1F4C4} \u0623\u0631\u0633\u0644 \u0631\u0627\u0628\u0637 \u0627\u0644\u0645\u0644\u0641:" }
  };
  const info = stateMap[action];
  if (info) {
    setState(userId, info.state, { pchatJid: realJid, pchatType: action === "text" ? "text" : action });
    await bot2.sendMessage(chatId, `${info.msg} *+${realJid.split("@")[0]}*\n\n${info.msg}`, { parse_mode: "Markdown", reply_markup: cancelKeyboard() });
  }
}

async function handlePersonSettingsCallback(bot2, chatId, userId, data) {
  const { getPersonSettings, savePersonSettings, personsMenuKeyboard, personSettingsKeyboard } = _deps;
  const parts = data.split("_");
  const action = parts[1];
  const jidSafe = parts.slice(2).join("_");
  const jid = jidSafe.replace(/_/g, "@").replace(/@@/g, "@");
  const settings = getPersonSettings(userId, jid);
  if (action === "ar") {
    settings.autoReply = !settings.autoReply;
    savePersonSettings(userId, jid, settings);
    await bot2.sendMessage(chatId, `\u2705 \u0627\u0644\u0631\u062F \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A ${settings.autoReply ? "\u0645\u0641\u0639\u0651\u0644 \u2705" : "\u0645\u0639\u0637\u0651\u0644 \u274C"}`, { reply_markup: personSettingsKeyboard(jid, settings) });
  } else if (action === "block") {
    settings.blocked = !settings.blocked;
    savePersonSettings(userId, jid, settings);
    await bot2.sendMessage(chatId, `\u2705 ${settings.blocked ? "\u062A\u0645 \u062D\u0638\u0631 \u0627\u0644\u0634\u062E\u0635" : "\u062A\u0645 \u0641\u0643 \u0627\u0644\u062D\u0638\u0631"}`, { reply_markup: personSettingsKeyboard(jid, settings) });
  } else if (action === "save") {
    await bot2.sendMessage(chatId, "\u2705 \u062A\u0645 \u062D\u0641\u0638 \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A", { reply_markup: personsMenuKeyboard() });
  } else if (action === "notify") {
    settings.notify = !settings.notify;
    savePersonSettings(userId, jid, settings);
    await bot2.sendMessage(chatId, `\u2705 \u0627\u0644\u0625\u0634\u0639\u0627\u0631: ${settings.notify ? "\u0645\u0641\u0639\u0651\u0644 \u2705" : "\u0645\u0639\u0637\u0651\u0644 \u274C"}`, { reply_markup: personSettingsKeyboard(jid, settings) });
  }
}

async function handleContactsPage(bot2, chatId, userId, data) {
  const { getContacts, contactsListKeyboard } = _deps;
  const parts = data.replace("contacts_p", "").split("_");
  const page = parseInt(parts[0]) || 0;
  const action = parts.slice(1).join("_") || "view";
  const contacts = getContacts(userId);
  if (contacts.length === 0) { await bot2.sendMessage(chatId, "\u{1F465} \u0644\u0627 \u062A\u0648\u062C\u062F \u062C\u0647\u0627\u062A \u0627\u062A\u0635\u0627\u0644 \u0628\u0639\u062F."); return; }
  await bot2.sendMessage(chatId, `\u{1F465} *\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0623\u0634\u062E\u0627\u0635 (${contacts.length}):*\n\n\u0627\u062E\u062A\u0631 \u0634\u062E\u0635\u0627\u064B:`, { parse_mode: "Markdown", reply_markup: contactsListKeyboard(contacts, page, action) });
}

async function handleContactPick(bot2, chatId, userId, data) {
  const { getContacts, personChatKeyboard } = _deps;
  const withoutPrefix = data.replace("contact_pick_", "");
  const actionEnd = withoutPrefix.indexOf("_");
  const action = actionEnd > -1 ? withoutPrefix.slice(0, actionEnd) : "view";
  const jidSafe = actionEnd > -1 ? withoutPrefix.slice(actionEnd + 1) : withoutPrefix;
  const jid = jidSafe.replace(/_/g, "@").replace(/@@/g, "@");
  const num = jid.split("@")[0];
  const contacts = getContacts(userId);
  const contact = contacts.find((c) => c.jid === jid) || contacts.find((c) => c.jid?.split("@")[0] === num);
  const name = contact?.name || num;
  if (action === "pic") { await handlePersonPicFromJid(bot2, chatId, userId, `${num}@s.whatsapp.net`); }
  else if (action === "status") { await handlePersonStatusFromJid(bot2, chatId, userId, `${num}@s.whatsapp.net`); }
  else if (action === "chat") { await bot2.sendMessage(chatId, `\u{1F4AC} *\u0645\u062D\u0627\u062F\u062B\u0629 \u0645\u0639 ${name}*\n\u{1F4F1} +${num}\n\n\u0627\u062E\u062A\u0631 \u0646\u0648\u0639 \u0627\u0644\u0631\u0633\u0627\u0644\u0629:`, { parse_mode: "Markdown", reply_markup: personChatKeyboard(jid) }); }
  else { await bot2.sendMessage(chatId, `\u{1F464} *${name}*\n\u{1F4F1} +${num}\n\n\u0627\u062E\u062A\u0631 \u0627\u0644\u0625\u062C\u0631\u0627\u0621:`, { parse_mode: "Markdown", reply_markup: personChatKeyboard(jid) }); }
}

async function handlePersonPicker(bot2, chatId, userId, data) {
  const { saveUser, setState, cancelKeyboard, getContacts, contactsListKeyboard, personsMenuKeyboard } = _deps;
  const rest = data.replace("picker_manual_", "").replace("picker_contacts_", "");
  const action = rest;
  const labels = { pic: "\u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0635\u0648\u0631\u0629", status: "\u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u062D\u0627\u0644\u0629", chat: "\u0641\u062A\u062D \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629" };
  if (data.startsWith("picker_manual_")) {
    setState(userId, "awaiting_person_search");
    saveUser(userId, { _pendingPersonAction: action });
    await bot2.sendMessage(chatId, `\u270F\uFE0F \u0623\u062F\u062E\u0644 \u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u0645\u0639 \u0643\u0648\u062F \u0627\u0644\u062F\u0648\u0644\u0629:\n\u0645\u062B\u0627\u0644: \`249960506662\`\n\n\u0627\u0644\u0625\u062C\u0631\u0627\u0621: ${labels[action] || action}`, { parse_mode: "Markdown", reply_markup: cancelKeyboard() });
  } else if (data.startsWith("picker_contacts_")) {
    const contacts = getContacts(userId);
    if (contacts.length === 0) { await bot2.sendMessage(chatId, "\u{1F465} \u0644\u0627 \u062A\u0648\u062C\u062F \u062C\u0647\u0627\u062A \u0627\u062A\u0635\u0627\u0644 \u0628\u0639\u062F.", { reply_markup: personsMenuKeyboard() }); return; }
    await bot2.sendMessage(chatId, `\u{1F465} \u0627\u062E\u062A\u0631 \u0645\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629 (${contacts.length} \u0634\u062E\u0635):`, { reply_markup: contactsListKeyboard(contacts, 0, action) });
  }
}

async function handlePersonPicFromJid(bot2, chatId, userId, jid) {
  const { inMemoryDB } = _deps;
  const sock = inMemoryDB.sessions.get(userId);
  if (!sock) { await bot2.sendMessage(chatId, "\u274C \u0631\u0628\u0637 \u0648\u0627\u062A\u0633\u0627\u0628 \u0623\u0648\u0644\u0627\u064B"); return; }
  const num = jid.replace(/[^0-9]/g, "");
  const targetJid = `${num}@s.whatsapp.net`;
  await bot2.sendMessage(chatId, "\u23F3 \u062C\u0627\u0631\u064A \u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0635\u0648\u0631\u0629...");
  try {
    const url = await sock.profilePictureUrl(targetJid, "image");
    if (url) {
      const res = await globalThis.fetch(url);
      const buffer = Buffer.from(await res.arrayBuffer());
      await bot2.sendPhoto(chatId, buffer, { caption: `\u{1F5BC}\uFE0F \u0635\u0648\u0631\u0629 \u0627\u0644\u0628\u0631\u0648\u0641\u0627\u064A\u0644: +${num}` });
    } else { await bot2.sendMessage(chatId, "\u274C \u0627\u0644\u0635\u0648\u0631\u0629 \u062E\u0627\u0635\u0629 \u0623\u0648 \u0644\u0627 \u062A\u0648\u062C\u062F \u0635\u0648\u0631\u0629."); }
  } catch { await bot2.sendMessage(chatId, "\u274C \u0641\u0634\u0644 \u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0635\u0648\u0631\u0629."); }
}

async function handlePersonStatusFromJid(bot2, chatId, userId, jid) {
  const { inMemoryDB } = _deps;
  const sock = inMemoryDB.sessions.get(userId);
  if (!sock) { await bot2.sendMessage(chatId, "\u274C \u0631\u0628\u0637 \u0648\u0627\u062A\u0633\u0627\u0628 \u0623\u0648\u0644\u0627\u064B"); return; }
  const num = jid.replace(/[^0-9]/g, "");
  const targetJid = `${num}@s.whatsapp.net`;
  await bot2.sendMessage(chatId, "\u23F3 \u062C\u0627\u0631\u064A \u062C\u0644\u0628 \u0627\u0644\u062D\u0627\u0644\u0629...");
  try {
    const status = await sock.fetchStatus?.(targetJid);
    if (status?.status) { await bot2.sendMessage(chatId, `\u{1F4CA} *\u062D\u0627\u0644\u0629 +${num}:*\n\n"${status.status}"`, { parse_mode: "Markdown" }); }
    else { await bot2.sendMessage(chatId, "\u274C \u0627\u0644\u062D\u0627\u0644\u0629 \u062E\u0627\u0635\u0629 \u0623\u0648 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629."); }
  } catch { await bot2.sendMessage(chatId, "\u274C \u0641\u0634\u0644 \u062C\u0644\u0628 \u0627\u0644\u062D\u0627\u0644\u0629."); }
}
