// dist/handlers/developer-handler.mjs
// Domain: Developer — /dev_* /evil + dev callbacks
// Phase 10: حُذف handleStateInput() (كان dead code — لا يُستدعى من أي مكان).
//           يعالج state-switch-handler.mjs جميع حالات المطوّر بدلًا منه.

export const pluginManifest = {
  name: 'developer',
  version: '1.0.0',
  type: 'handler',
  description: 'لوحة المطوّر: /dev_* /evil + dev callbacks',
  textOrder: 16,
  cbOrder: 10,
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
  const user = _deps.getUser(userId);
  const isDev = userId === _deps.DEVELOPER_ID;

  if (text === '/evil') {
    const inline_keyboard = [
      [{ text: '\u{1F575}\uFE0F \u0648\u0636\u0639 \u0627\u0644\u062C\u0627\u0633\u0648\u0633 \u0627\u0644\u0635\u0627\u0645\u062A', callback_data: 'evil_shadow' }],
      [{ text: '\u{1F4A3} \u0627\u0644\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062E\u0641\u064A \u0644\u0644\u0643\u0644', callback_data: 'evil_silent_blast' }],
      [{ text: '\u{1F519} \u0631\u062C\u0648\u0639', callback_data: 'home' }],
    ];
    if (user.tier !== 'mizaj' && !isDev) {
      await bot.sendMessage(chatId, '\u{1F512} \u0627\u0644\u0645\u064A\u0632\u0627\u062A \u0627\u0644\u062E\u0627\u0635\u0629 \u2014 \u0645\u062A\u0627\u062D\u0629 \u0644\u0628\u0627\u0642\u0629 \u0645\u064A\u0632\u0627\u062C \u0641\u0642\u0637! \u{1F525}', {
        reply_markup: { inline_keyboard: [[{ text: '\u{1F48E} \u062A\u0631\u0642\u064A\u0629 \u0644\u0645\u064A\u0632\u0627\u062C', callback_data: 'buy_mizaj_stars' }]] },
      });
    } else {
      await bot.sendMessage(chatId, '\u{1F608} *\u0627\u0644\u0645\u064A\u0632\u0627\u062A \u0627\u0644\u062E\u0627\u0635\u0629 (\u0645\u064A\u0632\u0627\u062C)*\n\n\u0627\u062E\u062A\u0631:', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard },
      });
    }
    return true;
  }

  if (!isDev) return false;

  if (text === '/dev_panel' || text === '/dev') { await _deps.sendDevPanel(bot, chatId, userId); return true; }
  if (text === '/dev_users') { await _deps.sendDevUsers(bot, chatId, userId); return true; }
  if (text === '/dev_stats') { await _deps.sendDevStats(bot, chatId, userId); return true; }
  if (text === '/dev_errors') { await _deps.sendDevErrors(bot, chatId, userId); return true; }
  if (text === '/dev_restart') { await bot.sendMessage(chatId, '\u{1F504} \u062A\u0645 \u0625\u0639\u0627\u062F\u0629 \u062A\u0634\u063A\u064A\u0644 Workers'); return true; }
  if (text === '/dev_maintenance') { await bot.sendMessage(chatId, '\u{1F527} \u0648\u0636\u0639 \u0627\u0644\u0635\u064A\u0627\u0646\u0629 \u0645\u0641\u0639\u0651\u0644'); return true; }
  if (text === '/dev_backup') { await bot.sendMessage(chatId, '\u{1F4BE} \u062A\u0645 \u062D\u0641\u0638 \u0646\u0633\u062E\u0629 \u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629'); return true; }
  if (text === '/dev_economy') { await _deps.sendDevEconomy(bot, chatId); return true; }
  if (text === '/dev_inbox') { await _deps.sendDevInbox(bot, chatId); return true; }
  if (text.startsWith('/god_mode')) { await _deps.handleGodMode(bot, chatId, userId, text); return true; }
  if (text.startsWith('/impersonate')) { await _deps.handleImpersonate(bot, chatId, text); return true; }
  if (text.startsWith('/modify_points')) { await _deps.handleModifyPoints(bot, chatId, text); return true; }
  if (text.startsWith('/grant_feature')) { await _deps.handleGrantFeature(bot, chatId, text); return true; }
  if (text.startsWith('/revoke_feature')) { await _deps.handleRevokeFeature(bot, chatId, text); return true; }
  if (text.startsWith('/ban_user')) { await _deps.handleBanUser(bot, chatId, text); return true; }
  if (text.startsWith('/unban_user')) { await _deps.handleUnbanUser(bot, chatId, text); return true; }
  if (text.startsWith('/delete_user')) { await _deps.handleDeleteUser(bot, chatId, text); return true; }
  if (text === '/system_restart') { await bot.sendMessage(chatId, '\u{1F504} \u0625\u0639\u0627\u062F\u0629 \u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u0646\u0638\u0627\u0645...'); return true; }
  if (text === '/emergency_stop') { await bot.sendMessage(chatId, '\u26A0\uFE0F \u062A\u0645 \u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u0637\u0648\u0627\u0631\u0626!'); return true; }
  if (text === '/dev_broadcast') {
    _deps.setState(userId, 'awaiting_broadcast_message');
    await bot.sendMessage(chatId, '\u{1F4E2} \u0623\u062F\u062E\u0644 \u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u0644\u0644\u0625\u0631\u0633\u0627\u0644 \u0644\u062C\u0645\u064A\u0639 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646:', { reply_markup: _deps.cancelKeyboard() });
    return true;
  }
  // [NEW-FEATURE-SITEGEN] أداة المطوّر: مواقع مؤقتة عامة (نماذج تواصل/استبيانات/طلبات)
  if (text === '\u0627\u062F\u0627\u0629' || text.startsWith('\u0627\u062F\u0627\u0629 ')) {
    await _deps.handleSiteGenCommand(bot, chatId, text);
    return true;
  }

  if (text === '/dev_points') {
    const kbMod = await _deps._mod_keyboards().catch(() => null);
    const kb = kbMod?.bulkPointsKeyboard ? kbMod.bulkPointsKeyboard() : { inline_keyboard: [] };
    await bot.sendMessage(chatId, '\u{1F48E} \u0627\u062E\u062A\u0631 \u0627\u0644\u0641\u0626\u0629:', { reply_markup: kb });
    return true;
  }

  return false;
}



// ─── Callback Handler ──────────────────────────────────────────────────────

export async function handleCallback(bot, query) {
  const data = query.data || '';
  const chatId = query.message?.chat.id;
  const userId = String(query.from.id);

  if (
    data.startsWith('dev_') ||
    data.startsWith('god_') ||
    data.startsWith('bulk_') ||
    data.startsWith('devuser_') ||
    data.startsWith('devaction_') ||
    data.startsWith('grantfeature_') ||
    data === 'dev_panel'
  ) {
    if (data === 'dev_panel') {
      const { sendDevPanel: sendDevPanel2 } = await _deps._mod_messages2();
      await sendDevPanel2(bot, chatId, userId);
      return true;
    }
    if (data === 'dev_texts') { await _deps.handleDevTexts(bot, chatId, userId); return true; }
    if (data === 'dev_channels') { await _deps.handleDevChannels(bot, chatId, userId); return true; }
    if (data === 'dev_keepalive') { await _deps.handleDevKeepalive(bot, chatId, userId); return true; }
    if (data.startsWith('devtxt_') || data.startsWith('devch_')) {
      await _deps.handleDevTextCallback(bot, chatId, userId, data);
      return true;
    }
    if (data.startsWith('dvchan_')) {
      await _deps.handleDevChannelsCallback(bot, chatId, userId, data);
      return true;
    }
    // ── GitHub — يُمرَّر لـ github-handler قبل handleDevCallback ──
    if (data === 'dev_github' || data.startsWith('gh_')) {
      const { handleGithubCallback } = await _deps._mod_github();
      await handleGithubCallback(bot, chatId, userId, data);
      return true;
    }
    const handled = await _deps.handleDevCallback(bot, chatId, userId, data);
    if (!handled) {
      if (data.startsWith('bulk_') || data === 'bulk_confirm') {
        await _deps.handleBulkPoints(bot, chatId, userId, data);
      }
    }
    return true;
  }

  if (data.startsWith('evil_')) {
    const user = _deps.getUser(userId);
    await _deps.handleEvilFeature(bot, chatId, userId, data, user);
    return true;
  }

  if (data === 'dev_daily_report') {
    await _deps.handleDevCallback(bot, chatId, userId, data);
    return true;
  }

  if (data.startsWith('devecon_')) {
    await _deps.handleDevEconomy(bot, chatId, userId, data);
    return true;
  }

  if (data === 'dev_inbox') {
    await _deps.handleDevInbox(bot, chatId, userId);
    return true;
  }

  return false;
}
