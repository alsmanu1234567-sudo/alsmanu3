// dist/text-handler.mjs
// Phase 5: Thin orchestrator — يُفوّض أوامر النص لـ Registry
// Phase 6: الـ switch statement انتقل لـ state-switch-handler.mjs
// [PATCH_PHASE6_STATE_SWITCH_EXTRACTED]

import * as _registry from './handlers/registry.mjs';
import * as _switchHandler from './handlers/state-switch-handler.mjs';

let _deps = null;

export function setDeps(d) {
  _deps = d;
  // يُوزّع الـ deps على جميع الـ domain handlers عبر الـ registry (مع دمج)
  _registry.setDepsAll(d);
  // يُوزّع الـ deps على state-switch-handler (Phase 6)
  _switchHandler.setDeps(d);
}

export async function handleTextMessage(bot2, msg) {
  const { getUser, saveUser, getState, setState, clearState, DEVELOPER_ID, BOT_USERNAME, DEVELOPER_NAME, inMemoryDB, TIER_NAMES, setDynamicPrice, mainMenuKeyboard, cancelKeyboard, personsMenuKeyboard, callsMenuKeyboard, securityMenuKeyboard, bridgeMenuKeyboard, scheduleMenuKeyboard, replyTargetKeyboard, handleStart, handleHelp, showConnect, handleLinkQr, handleLinkNumber, handleAddReply2, showPoints, showFeatures, handleNumbersMenu, handleAiMenu, showReplies2, handleNumberStateInput, handleAutoReplyTextInput, handleGithubTextInput2, handleGroupsTextInput, handleStatusTextInput2, handleMyMsgsTextInput2, handleTextEditInput, handleChannelGuardInput, handleDevTexts, handleDevChannels, handleDevKeepalive, sendDevPanel, sendDevUsers, sendDevStats, sendDevErrors, sendDevInbox, sendDevEconomy, sendUserProfile, showInfo, showReplies, handleAddReply, handleGodMode, handleImpersonate, handleModifyPoints, handleGrantFeature, handleRevokeFeature, handleBanUser, handleUnbanUser, handleDeleteUser, handlePersonPicV2 } = _deps;
  const chatId = msg.chat.id;
  const userId = String(msg.from?.id);
  const text = msg.text || "";
  if (!msg.from) return;
  const user = getUser(userId);
  user.firstName = msg.from.first_name;
  user.username = msg.from.username;
  user.lastSeen = /* @__PURE__ */ new Date();
  saveUser(userId, user);
  const state = getState(userId);
  const isDev2 = userId === DEVELOPER_ID;
  if (user.isBanned) {
    await bot2.sendMessage(chatId, "\u26D4 \u062A\u0645 \u062D\u0638\u0631 \u062D\u0633\u0627\u0628\u0643. \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0645\u0637\u0648\u0631.");
    return;
  }

  // ── [PATCH_PHASE5_DOMAIN_HANDLERS] توجيه النص عبر Registry ───────────────
  const _commandHandled = await _registry.dispatchText(bot2, msg);
  if (_commandHandled) return;

  // ── Early State Handlers (UNCHANGED) ─────────────────────────────────────
  // PATCH_ALL_FIXES_V1: معالج مبكر لحالات البث
  const _earlyBroadcastStates = ["awaiting_broadcast_message", "awaiting_bulk_broadcast_msg", "awaiting_bulk_points_amount", "awaiting_bulk_points_message"];
  if (!_earlyBroadcastStates.includes(state.state)) {
    const { handleMyMsgsTextInput: handleMyMsgsTextInput2 } = await _deps._mod_my_msgs();
    const handledMyMsgs = await handleMyMsgsTextInput2(bot2, chatId, userId, text, state);
    if (handledMyMsgs) return;
  }
  if (isDev2 && state.state && state.state.startsWith("gh_input")) {
    const { handleGithubTextInput: handleGithubTextInput2 } = await _deps._mod_github();
    const handledGh = await handleGithubTextInput2(bot2, chatId, userId, text, state);
    if (handledGh) return;
  }
  const handled = await handleAutoReplyTextInput(bot2, chatId, userId, text, state) || await handleGroupsTextInput(bot2, chatId, userId, text, state) || await handleNumberStateInput(bot2, chatId, userId, text, state) || await handleTextEditInput(bot2, chatId, userId, text, state) || await handleChannelGuardInput(bot2, chatId, userId, text, state);
  if (handled) return;

  // ── [PATCH_PHASE6_STATE_SWITCH_EXTRACTED] State Switch Handler ────────────
  // جميع الـ switch cases انتقلت لـ dist/handlers/state-switch-handler.mjs
  await _switchHandler.handleText(bot2, msg);
}
