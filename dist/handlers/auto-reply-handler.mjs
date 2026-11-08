// dist/handlers/auto-reply-handler.mjs
// Domain: Auto-Reply — /autoreply /autoreply_add + callbacks

export const pluginManifest = {
  name: 'auto-reply',
  version: '1.0.0',
  type: 'handler',
  description: 'الردود التلقائية: /autoreply /autoreply_add + callbacks',
  textOrder: 4,
  cbOrder: 3,
  enabled: true,
};

let _deps = null;
export function setDeps(d) { _deps = d; }

// ─── Text Commands ─────────────────────────────────────────────────────────

export async function handleText(bot, msg) {
  if (!msg.text) return false;
  const text = msg.text;
  const chatId = msg.chat.id;
  const userId = String(msg.from?.id);

  if (text === '/autoreply' || text === '/autoreply_list') {
    await _deps.showReplies2(bot, chatId, userId);
    return true;
  }
  if (text === '/autoreply_add') {
    await _deps.handleAddReply2(bot, chatId, userId);
    return true;
  }
  return false;
}

// ─── Callback Handler ──────────────────────────────────────────────────────

export async function handleCallback(bot, query) {
  const data = query.data || '';
  const chatId = query.message?.chat.id;
  const userId = String(query.from.id);

  // [FIX_BUG001] set_per_user_ — [FIX_BUG002] set_daily_ — [FIX_BUG004] dup_reply_
  // [FIX_NEW_1] morph_done/morph_add_edit مُدمَجان هنا بدل dynamic import منفصلة
  if (
    data === 'menu_replies' ||
    data.startsWith('reply_') ||
    data.startsWith('rtype_') ||
    data.startsWith('ttype_') ||
    data.startsWith('target_') ||
    data.startsWith('scope_') ||
    data === 'longtext_done' ||
    data === 'longtext_cancel' ||
    data.startsWith('replyitem_') ||
    data.startsWith('toggle_reply_') ||
    data.startsWith('delete_reply_') ||
    data === 'code_parts_done' ||
    data.startsWith('set_per_user_') ||
    data.startsWith('set_daily_') ||
    data.startsWith('dup_reply_') ||
    data === 'morph_done' ||
    data === 'morph_add_edit'
  ) {
    await _deps.handleAutoReplyCallback(bot, chatId, userId, data);
    return true;
  }

  return false;
}
