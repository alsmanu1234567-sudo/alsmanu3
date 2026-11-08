// dist/handlers/groups-handler.mjs
// Domain: Groups — /groups + callbacks

export const pluginManifest = {
  name: 'groups',
  version: '1.0.0',
  type: 'handler',
  description: 'إدارة المجموعات: /groups + callbacks',
  textOrder: 6,
  cbOrder: 5,
  enabled: true,
};

let _deps = null;
export function setDeps(d) { _deps = d; }

export async function handleText(bot, msg) {
  if (!msg.text) return false;
  const text = msg.text;
  const chatId = msg.chat.id;

  if (text === '/groups') {
    const { groupsMenuKeyboardV2 } = await _deps._mod_groups_handler();
    await bot.sendMessage(chatId, '\u{1F465} \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0627\u062A', { reply_markup: groupsMenuKeyboardV2() });
    return true;
  }
  return false;
}

export async function handleCallback(bot, query) {
  const data = query.data || '';
  const chatId = query.message?.chat.id;
  const userId = String(query.from.id);

  if (data === 'menu_groups' || data.startsWith('grpv2_')) {
    try {
      await _deps.handleGroupsV2(bot, chatId, userId, data);
    } catch (error) {
      await bot.sendMessage(chatId, `تعذر فتح قسم المجموعات: ${error?.message || 'خطأ غير معروف'}`);
    }
    return true;
  }

  if (data.startsWith('grp_') || data.startsWith('groups_')) {
    try {
      const handled = await _deps.handleGroupsCallback(bot, chatId, userId, data);
      if (!handled) await _deps.handleGroupsV2(bot, chatId, userId, data);
    } catch (error) {
      await bot.sendMessage(chatId, `تعذر تنفيذ عملية المجموعات: ${error?.message || 'خطأ غير معروف'}`);
    }
    return true;
  }

  if (
    data.startsWith('group_') ||
    data.startsWith('groupinfo_') ||
    data.startsWith('expfmt_') ||
    data.startsWith('kickall_confirm_')
  ) {
    await _deps.handleGroupsV2(bot, chatId, userId, data);
    return true;
  }

  return false;
}
