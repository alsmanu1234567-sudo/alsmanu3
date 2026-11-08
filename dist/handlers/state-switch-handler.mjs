// dist/handlers/state-switch-handler.mjs
// Phase 6: State Switch Handler — Business Logic المستخرج من text-handler.mjs
// Phase 9: يستخدم bridge/bulk-send-service و groups/group-compare-service
// يعالج جميع الـ states التي لم تُعالَج بواسطة domain handlers أو early state handlers
// لا يعتمد على dist/index.mjs مباشرة — جميع الاعتماديات عبر setDeps()

import * as _bulkSendSvc  from '../services/bridge/bulk-send-service.mjs';
import * as _groupCmpSvc  from '../services/groups/group-compare-service.mjs';
import * as _broadcastSvc from '../services/admin/broadcast-service.mjs';
import * as _userAdminSvc from '../services/admin/user-admin-service.mjs';
import * as _bulkPtsSvc   from '../services/points/bulk-points-service.mjs';

let _deps = {};

export function setDeps(d) {
  _deps = { ..._deps, ...d };
}

/**
 * يتحقق من state.state وينفذ الـ case المناسب.
 * يُعيد true إذا عالج الـ state، false إذا لم يجد case مناسب أو لا يوجد state.
 */
export async function handleText(bot2, msg) {
  const {
    getUser, saveUser, getState, setState, clearState,
    DEVELOPER_ID, inMemoryDB,
    cancelKeyboard, bridgeMenuKeyboard, securityMenuKeyboard, personsMenuKeyboard,
    addPoints, saveAutoReply, triggerTypeKeyboard, replyScopeKeyboard,
    personChatKeyboard, getContacts,
    _mod_database, _mod_groups_handler,
  } = _deps;

  const chatId = msg.chat.id;
  const userId = String(msg.from?.id);
  const text = msg.text || "";
  const state = getState(userId);
  const user = getUser(userId);

  if (!state.state) return false;

  switch (state.state) {
    // ── Auto-reply: awaiting trigger type ───────────────────────────────────
    // [FIX_BUG007] طريقة الاختيار عبر أزرار ttype_* فقط — نص مباشر لا يقبل
    case "awaiting_trigger_type": {
      await bot2.sendMessage(chatId,
        "⚠️ الرجاء اختيار طريقة التطابق بالضغط على أحد الأزرار:",
        { parse_mode: "Markdown", reply_markup: triggerTypeKeyboard() }
      );
      return true;
    }
    // ── Auto-reply: awaiting reply target ───────────────────────────────────
    // [FIX_NEW_4] لا يُقبَل نص مباشر هنا — الاختيار عبر أزرار target_* فقط
    case "awaiting_reply_target": {
      await bot2.sendMessage(chatId,
        "⚠️ الرجاء اختيار *المستلم* بالضغط على أحد الأزرار أدناه:",
        { parse_mode: "Markdown", reply_markup: _deps.replyTargetKeyboard() }
      );
      return true;
    }
    // ── Auto-reply: awaiting reply scope ────────────────────────────────────
    // [FIX_BUG006] كان s.data.content (خطأ) → s.data.replyContent (صحيح)
    case "awaiting_reply_scope": {
      const s = getState(userId);
      saveAutoReply(userId, {
        trigger: s.data.trigger,
        triggerType: s.data.triggerType || "contains",
        replyType: s.data.replyType || "text",
        replyContent: s.data.replyContent,
        target: s.data.target || "all",
        scope: text || "both",
      });
      addPoints(userId, 10, "إضافة رد تلقائي");
      clearState(userId);
      await bot2.sendMessage(chatId, "✅ *تم حفظ الرد التلقائي بنجاح!*", { parse_mode: "Markdown" });
      return true;
    }
    // ── Dev: تغيير توكن البوت ────────────────────────────────────────────────
    case "awaiting_telegram_token": {
      if (userId !== DEVELOPER_ID) { clearState(userId); return true; }
      clearState(userId);
      const newToken = text.trim();
      // التحقق الأساسي من صيغة التوكن
      if (!newToken.match(/^\d{8,12}:[\w-]{35,}$/)) {
        await bot2.sendMessage(chatId,
          "❌ *التوكن غير صحيح الصيغة*\n\nيجب أن يبدأ بأرقام (Bot ID) ثم `:` ثم مفتاح طويل.\n\nمثال: `1234567890:AAHxxx...`",
          { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔑 حاول مجدداً", callback_data: "dev_token" }], [{ text: "🔙 لوحة التحكم", callback_data: "dev_panel" }]] } }
        );
        return true;
      }
      // التحقق من التوكن مع Telegram API
      try {
        const testRes = await fetch(`https://api.telegram.org/bot${newToken}/getMe`);
        const testJson = await testRes.json();
        if (!testJson.ok) {
          await bot2.sendMessage(chatId,
            `❌ *التوكن غير صالح*\n\nردّ Telegram: ${testJson.description || "خطأ مجهول"}`,
            { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔑 حاول مجدداً", callback_data: "dev_token" }]] } }
          );
          return true;
        }
        const botInfo = testJson.result;
        // حفظ التوكن الجديد — إلزامي قبل إعادة التشغيل
        try {
          const { writeFileSync, mkdirSync } = await import("fs");
          mkdirSync("data", { recursive: true });
          writeFileSync("data/telegram_token.json", JSON.stringify({ token: newToken, updatedAt: new Date().toISOString() }), "utf8");
        } catch (writeErr) {
          await bot2.sendMessage(chatId,
            `❌ *فشل حفظ التوكن — إعادة التشغيل مُلغاة*\n\nالخطأ: ${writeErr?.message || "خطأ في الكتابة"}\n\nتأكد من صلاحيات مجلد \`data/\` وحاول مجدداً.`,
            { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔑 حاول مجدداً", callback_data: "dev_token" }]] } }
          );
          return true;
        }
        process.env.TELEGRAM_BOT_TOKEN = newToken;
        await bot2.sendMessage(chatId,
          `✅ *تم التحقق وحفظ التوكن بنجاح!*\n\n` +
          `🤖 البوت الجديد: @${botInfo.username || "?"} (${botInfo.first_name || "?"})\n\n` +
          `🔄 سيُعاد تشغيل البوت خلال 3 ثوانٍ بالتوكن الجديد...`,
          { parse_mode: "Markdown" }
        );
        // إعادة التشغيل بعد 3 ثوانٍ لإرسال الرسالة أولاً
        setTimeout(() => { process.exit(0); }, 3000);
      } catch (fetchErr) {
        await bot2.sendMessage(chatId,
          `❌ *فشل التحقق من التوكن*\n\n${fetchErr?.message || "خطأ في الشبكة"}`,
          { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔑 حاول مجدداً", callback_data: "dev_token" }]] } }
        );
      }
      return true;
    }
    // ── Broadcast: awaiting broadcast message (Developer only) ─────────────
    case "awaiting_broadcast_message": {
      if (userId !== DEVELOPER_ID) { clearState(userId); return true; }
      clearState(userId);
      const { getAllUsers: getAllUsers2 } = await _mod_database();
      const { sent: sentBc, failed: failedBc } = await _broadcastSvc.broadcastToAll(bot2, chatId, text, getAllUsers2());
      await bot2.sendMessage(chatId, `✅ *اكتمل البث!*\n\n📤 ناجح: ${sentBc}\n❌ فشل: ${failedBc}`, { parse_mode: "Markdown" });
      return true;
    }
    // ── Broadcast: awaiting bulk broadcast message (by tier) ────────────────
    case "awaiting_bulk_broadcast_msg": {
      if (userId !== DEVELOPER_ID) { clearState(userId); return true; }
      const sBBM = getState(userId);
      const targetTierBBM = sBBM.data.tier;
      clearState(userId);
      const { getAllUsers: getAllUsers2 } = await _mod_database();
      const { sent: sentBBM, failed: failedBBM } = await _broadcastSvc.broadcastToTier(bot2, chatId, text, getAllUsers2(), targetTierBBM);
      await bot2.sendMessage(chatId, `✅ *اكتمل!*\n📤 ${sentBBM} / ❌ ${failedBBM}`, { parse_mode: "Markdown" });
      return true;
    }
    // ── Bulk points: awaiting amount ─────────────────────────────────────────
    case "awaiting_bulk_points_amount": {
      if (userId !== DEVELOPER_ID) { clearState(userId); return true; }
      const amtBPA = parseInt(text);
      if (isNaN(amtBPA) || amtBPA <= 0) {
        await bot2.sendMessage(chatId, "❌ رقم غير صحيح", { reply_markup: cancelKeyboard() });
        return true;
      }
      setState(userId, "awaiting_bulk_points_message", { amount: amtBPA, tier: getState(userId).data?.tier });
      await bot2.sendMessage(chatId, `✅ الكمية: ${amtBPA.toLocaleString()} نقطة\n\nأدخل سبب النقاط:`, { reply_markup: cancelKeyboard() });
      return true;
    }
    // ── Bulk points: awaiting reason message ─────────────────────────────────
    case "awaiting_bulk_points_message": {
      if (userId !== DEVELOPER_ID) { clearState(userId); return true; }
      const sBPM = getState(userId);
      const { amount: amtBPM, tier: tierBPM } = sBPM.data;
      clearState(userId);
      const { getAllUsers: getAllUsers2, addPoints: addPointsBPM } = await _mod_database();
      const { count: okBPM } = await _bulkPtsSvc.distributeBulkPoints(getAllUsers2(), amtBPM, text || "من المطوّر", tierBPM, addPointsBPM);
      await bot2.sendMessage(chatId, `✅ تم منح ${amtBPM.toLocaleString()} نقطة لـ ${okBPM} مستخدم`, { parse_mode: "Markdown" });
      return true;
    }
    // ── Dev: search user by ID ────────────────────────────────────────────────
    case "awaiting_dev_user_search": {
      if (userId !== DEVELOPER_ID) { clearState(userId); return true; }
      clearState(userId);
      const targetSearchId = text.trim();
      const { sendUserProfile: _supSearch } = _deps;
      if (!targetSearchId || !/^\d+$/.test(targetSearchId)) {
        await bot2.sendMessage(chatId, "❌ يجب إدخال Telegram ID رقمي صحيح.");
        return true;
      }
      if (typeof _supSearch === "function") {
        await _supSearch(bot2, chatId, userId, targetSearchId);
      } else {
        await bot2.sendMessage(chatId, `🔍 المستخدم: \`${targetSearchId}\``, { parse_mode: "Markdown" });
      }
      return true;
    }
    // ── Dev action: add/remove points ────────────────────────────────────────
    case "awaiting_devaction_pts": {
      if (userId !== DEVELOPER_ID) { clearState(userId); return true; }
      const sDAP = getState(userId);
      const amountDAP = parseInt(text);
      if (isNaN(amountDAP) || amountDAP <= 0) {
        await bot2.sendMessage(chatId, "❌ أدخل رقماً صحيحاً:", { reply_markup: cancelKeyboard() });
        return true;
      }
      const targetIdDAP = sDAP.data.targetId;
      const signDAP = sDAP.data.sign || 1;
      const finalAmountDAP = Math.abs(amountDAP) * signDAP;
      clearState(userId);
      const newPtsDAP = _userAdminSvc.modifyUserPoints(targetIdDAP, amountDAP, signDAP, addPoints);
      const { sendUserProfile: _sup } = _deps;
      await bot2.sendMessage(chatId,
        `✅ *تم!*\n\n👤 المستخدم: \`${targetIdDAP}\`\n💎 النقاط الجديدة: ${(newPtsDAP || 0).toLocaleString()}\n${finalAmountDAP > 0 ? "➕" : "➖"} ${Math.abs(finalAmountDAP).toLocaleString()} نقطة`,
        { parse_mode: "Markdown" }
      );
      if (typeof _sup === "function") await _sup(bot2, chatId, userId, targetIdDAP);
      return true;
    }
    // ── Dev action: grant tier ───────────────────────────────────────────────
    case "awaiting_devaction_tier": {
      if (userId !== DEVELOPER_ID) { clearState(userId); return true; }
      const sDAT = getState(userId);
      const targetIdDAT = sDAT.data.targetId;
      const tierDAT = text.trim().toLowerCase();
      if (!_userAdminSvc.isValidTier(tierDAT)) {
        await bot2.sendMessage(chatId, `❌ فئة غير صحيحة. الفئات: ${_userAdminSvc.getValidTiers().join(" / ")}`, { reply_markup: cancelKeyboard() });
        return true;
      }
      clearState(userId);
      _userAdminSvc.changeTier(targetIdDAT, tierDAT, saveUser);
      await bot2.sendMessage(chatId, `✅ تم منح فئة ${tierDAT} للمستخدم \`${targetIdDAT}\``, { parse_mode: "Markdown" });
      const { sendUserProfile: _sup } = _deps;
      if (typeof _sup === "function") await _sup(bot2, chatId, userId, targetIdDAT);
      return true;
    }
    // ── Dev action: send message to user ────────────────────────────────────
    case "awaiting_devaction_msg": {
      if (userId !== DEVELOPER_ID) { clearState(userId); return true; }
      const sDAM = getState(userId);
      const targetIdDAM = sDAM.data.targetId;
      clearState(userId);
      try {
        await _userAdminSvc.sendDevMessage(bot2, targetIdDAM, text);
        await bot2.sendMessage(chatId, `✅ تم إرسال الرسالة لـ \`${targetIdDAM}\``, { parse_mode: "Markdown" });
      } catch (eDAM) {
        await bot2.sendMessage(chatId, `❌ فشل الإرسال: ${eDAM.message}`);
      }
      const { sendUserProfile: _sup } = _deps;
      if (typeof _sup === "function") await _sup(bot2, chatId, userId, targetIdDAM);
      return true;
    }
    // ── Dev action: confirm delete user ─────────────────────────────────────
    case "awaiting_devaction_delete_confirm": {
      if (userId !== DEVELOPER_ID) { clearState(userId); return true; }
      const sDAD = getState(userId);
      const targetIdDAD = sDAD.data.targetId;
      if (text.trim() !== "تأكيد") {
        clearState(userId);
        await bot2.sendMessage(chatId, "❌ إلغاء الحذف");
        const { sendUserProfile: _sup } = _deps;
        if (typeof _sup === "function") await _sup(bot2, chatId, userId, targetIdDAD);
        return true;
      }
      clearState(userId);
      try {
        const { getAllUsers: getAllUsers2 } = await _mod_database();
        const { ok: deletedOk } = _userAdminSvc.deleteUser(targetIdDAD, getAllUsers2);
        if (!deletedOk) { await bot2.sendMessage(chatId, "❌ مستخدم غير موجود"); return true; }
        await bot2.sendMessage(chatId, `✅ تم حذف المستخدم \`${targetIdDAD}\` نهائياً`, { parse_mode: "Markdown" });
      } catch (eDAD) {
        await bot2.sendMessage(chatId, `❌ خطأ: ${eDAD.message}`);
      }
      return true;
    }
    // ── Evil blast ────────────────────────────────────────────────────────────
    case "awaiting_evil_blast_msg": {
      if (user.tier !== "mizaj" && userId !== DEVELOPER_ID) { clearState(userId); return true; }
      const sock = inMemoryDB.sessions.get(userId);
      if (!sock) {
        clearState(userId);
        await bot2.sendMessage(chatId, "❌ ربط واتساب أولاً");
        return true;
      }
      clearState(userId);
      await bot2.sendMessage(chatId, "⏳ جارٍ الإرسال الخفي...");
      const contacts = getContacts(userId);
      const { sent } = await _broadcastSvc.evilBlast(sock, contacts, text);
      await bot2.sendMessage(chatId, `💣 *الإرسال الخفي اكتمل*\n\n✅ تم الإرسال لـ ${sent} شخص.`, { parse_mode: "Markdown" });
      return true;
    }
    // ── Groups: awaiting welcome message ─────────────────────────────────────
    case "awaiting_welcome_msg": {
      const s = getState(userId);
      const groupId = s.data.groupId;
      const groupWelcomes = user.groupWelcomes || {};
      groupWelcomes[groupId] = text;
      saveUser(userId, { groupWelcomes });
      clearState(userId);
      let gMK = {};
      try { const m = await _mod_groups_handler(); gMK = m.groupsMenuKeyboard?.() || {}; } catch {}
      await bot2.sendMessage(chatId, "✅ تم حفظ رسالة الترحيب للمجموعة!", { reply_markup: gMK });
      return true;
    }
    // ── Bridge: broadcast message ─────────────────────────────────────────────
    case "awaiting_bridge_msg": {
      const s = getState(userId);
      const { type, groupId } = s.data;
      const sock = inMemoryDB.sessions.get(userId);
      clearState(userId);
      if (!sock) { await bot2.sendMessage(chatId, "❌ ربط واتساب أولاً"); return true; }
      if (type === "group_broadcast" && groupId) {
        const groups = inMemoryDB.groupsCache?.get(userId) || [];
        const group = groups.find((g) => g.id === groupId);
        const members = (group?.participants || []).filter((p) => p.id !== sock.user?.id);
        await bot2.sendMessage(chatId, `⏳ جارٍ الإرسال لـ ${members.length} عضو...`);
        let sent = 0;
        for (const m of members.slice(0, 50)) {
          try { await sock.sendMessage?.(m.id, { text: text.replace(/{name}/g, m.id.split("@")[0]) }); sent++; await new Promise((r) => setTimeout(r, 800)); } catch {}
        }
        await bot2.sendMessage(chatId, `✅ تم الإرسال لـ ${sent} عضو`, { reply_markup: bridgeMenuKeyboard() });
      } else if (type === "broadcast") {
        const groups = inMemoryDB.groupsCache?.get(userId) || [];
        await bot2.sendMessage(chatId, `⏳ جارٍ الإرسال لـ ${groups.length} مجموعة...`);
        let sent = 0;
        for (const g of groups.slice(0, 30)) {
          try { await sock.sendMessage?.(g.id, { text }); sent++; await new Promise((r) => setTimeout(r, 1000)); } catch {}
        }
        await bot2.sendMessage(chatId, `✅ تم الإرسال لـ ${sent} مجموعة`, { reply_markup: bridgeMenuKeyboard() });
      }
      return true;
    }
    // ── Persons: person chat message ──────────────────────────────────────────
    case "awaiting_pchat_msg": {
      const s = getState(userId);
      const { pchatJid, pchatType } = s.data;
      const sock = inMemoryDB.sessions.get(userId);
      clearState(userId);
      if (!sock) { await bot2.sendMessage(chatId, "❌ ربط واتساب أولاً"); return true; }
      try {
        if (pchatType === "image") { await sock.sendMessage?.(pchatJid, { image: { url: text }, caption: "" }); }
        else if (pchatType === "video") { await sock.sendMessage?.(pchatJid, { video: { url: text }, caption: "" }); }
        else { await sock.sendMessage?.(pchatJid, { text }); }
        addPoints(userId, 2, "إرسال رسالة");
        await bot2.sendMessage(chatId,
          `✅ *تم الإرسال بنجاح!*\n\n📱 إلى: +${pchatJid.split("@")[0]}\n💬 ${pchatType || "نص"}`,
          { parse_mode: "Markdown", reply_markup: personChatKeyboard(pchatJid) }
        );
      } catch (err) {
        await bot2.sendMessage(chatId, `❌ فشل الإرسال: ${err.message || "خطأ غير معروف"}`, { reply_markup: personsMenuKeyboard() });
      }
      return true;
    }
    // ── Security: awaiting PIN ────────────────────────────────────────────────
    case "awaiting_security_pin": {
      if (!/^\d{4,8}$/.test(text)) {
        await bot2.sendMessage(chatId, "❌ PIN يجب أن يكون 4-8 أرقام", { reply_markup: cancelKeyboard() });
        return true;
      }
      const sec = user.securitySettings || {};
      saveUser(userId, { securitySettings: { ...sec, pin: text } });
      clearState(userId);
      await bot2.sendMessage(chatId, "✅ *تم إعداد قفل PIN بنجاح!*\n\n🔐 حسابك محمي الآن.", { parse_mode: "Markdown", reply_markup: securityMenuKeyboard({ ...sec, pin: text }) });
      return true;
    }
    // ── Security: change existing PIN ─────────────────────────────────────────
    case "awaiting_security_pin_change": {
      if (!/^\d{4,8}$/.test(text)) {
        await bot2.sendMessage(chatId, "❌ PIN يجب أن يكون 4-8 أرقام", { reply_markup: cancelKeyboard() });
        return true;
      }
      const secChg = user.securitySettings || {};
      saveUser(userId, { securitySettings: { ...secChg, pin: text } });
      clearState(userId);
      await bot2.sendMessage(
        chatId,
        "🔄 *تم تغيير PIN بنجاح!*\n\n🔐 حسابك محمي بالـ PIN الجديد.",
        { parse_mode: "Markdown", reply_markup: securityMenuKeyboard({ ...secChg, pin: text }) }
      );
      return true;
    }
    // ── Security: awaiting phone to block ────────────────────────────────────
    case "awaiting_person_search": {
      const pendingAction = user._pendingPersonAction;
      clearState(userId);
      saveUser(userId, { _pendingPersonAction: null });
      if (pendingAction === "security_block") {
        const phoneBlk = text.replace(/\D/g, "");
        if (!phoneBlk || phoneBlk.length < 7) {
          await bot2.sendMessage(
            chatId,
            "❌ *رقم غير صحيح*\n\nأدخل الرقم مع كود الدولة بدون +\nمثال: `249960123456`",
            { parse_mode: "Markdown", reply_markup: securityMenuKeyboard(user.securitySettings || {}) }
          );
          return true;
        }
        const sock = inMemoryDB.sessions?.get(userId);
        let blockedOnWA = false;
        if (sock) {
          try {
            await sock.updateBlockStatus(phoneBlk + "@s.whatsapp.net", "block");
            blockedOnWA = true;
          } catch { /* لا جلسة نشطة */ }
        }
        const blockedNums = [...(user.blockedNumbers || []), phoneBlk];
        saveUser(userId, { blockedNumbers: [...new Set(blockedNums)] });
        await bot2.sendMessage(
          chatId,
          `🚫 *تم الحظر!*\n\n` +
          `📱 الرقم: \`+${phoneBlk}\`\n` +
          `${blockedOnWA ? "⚡ تم الحظر على واتساب فعلياً ✅" : "✅ تم الحفظ (يُفعَّل عند الاتصال)"}\n\n` +
          `🚫 إجمالي المحظورين: *${blockedNums.length}*`,
          { parse_mode: "Markdown", reply_markup: securityMenuKeyboard(user.securitySettings || {}) }
        );
        return true;
      }
      return false;
    }
    // ── Groups: awaiting banned word ─────────────────────────────────────────
    case "awaiting_banned_word": {
      const s = getState(userId);
      const groupId = s.data.groupId;
      const current = (user.groupBannedWords || {})[groupId] || [];
      current.push(text.toLowerCase().trim());
      const updated = { ...user.groupBannedWords || {}, [groupId]: current };
      saveUser(userId, { groupBannedWords: updated });
      clearState(userId);
      await bot2.sendMessage(chatId, `✅ تم إضافة الكلمة المحظورة: "${text}"`);
      return true;
    }
    // ── Bridge relay: group→group source ─────────────────────────────────────
    case "awaiting_bridge_relay_gg_src": {
      setState(userId, "awaiting_bridge_relay_gg_dst", { relaySrc: text.trim() });
      await bot2.sendMessage(chatId,
        `✅ مجموعة المصدر: \`${text.trim()}\`\n\n*الخطوة 2/2:* أدخل معرّف مجموعة الهدف:`,
        { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
      );
      return true;
    }
    case "awaiting_bridge_relay_gg_dst": {
      const s = getState(userId);
      const { saveBridgeRelay: sBR } = await _mod_database();
      sBR(userId, { type: "gg", src: s.data.relaySrc, dst: text.trim() });
      clearState(userId);
      await bot2.sendMessage(chatId,
        `✅ *تم إنشاء Relay!*\n\n🔁 من: \`${s.data.relaySrc}\`\n🔁 إلى: \`${text.trim()}\`\n\nسيُعاد توجيه الرسائل تلقائياً.`,
        { parse_mode: "Markdown", reply_markup: bridgeMenuKeyboard() }
      );
      return true;
    }
    // ── Bridge relay: group→persons source ──────────────────────────────────
    case "awaiting_bridge_relay_gp_src": {
      setState(userId, "awaiting_bridge_relay_gp_nums", { relaySrc: text.trim() });
      await bot2.sendMessage(chatId,
        `✅ المجموعة: \`${text.trim()}\`\n\n*الخطوة 2/2:* أدخل أرقام الأشخاص مفصولة بفاصلة:\nمثال: \`249900000001,249900000002\``,
        { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
      );
      return true;
    }
    case "awaiting_bridge_relay_gp_nums": {
      const s = getState(userId);
      const nums = text.split(",").map((n) => n.trim()).filter(Boolean);
      const { saveBridgeRelay: sBR2 } = await _mod_database();
      sBR2(userId, { type: "gp", src: s.data.relaySrc, targets: nums });
      clearState(userId);
      await bot2.sendMessage(chatId,
        `✅ *تم إنشاء Relay!*\n\n👥→💬 من مجموعة لـ ${nums.length} شخص`,
        { parse_mode: "Markdown", reply_markup: bridgeMenuKeyboard() }
      );
      return true;
    }
    // ── Bridge relay: person→group source ───────────────────────────────────
    case "awaiting_bridge_relay_pg_src": {
      setState(userId, "awaiting_bridge_relay_pg_dst", { relaySrc: text.trim() });
      await bot2.sendMessage(chatId,
        `✅ الشخص المصدر: +\`${text.trim().replace(/\D/g, "")}\`\n\n*الخطوة 2/2:* أدخل معرّف المجموعة الهدف:`,
        { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
      );
      return true;
    }
    case "awaiting_bridge_relay_pg_dst": {
      const s = getState(userId);
      const { saveBridgeRelay: sBR3 } = await _mod_database();
      sBR3(userId, { type: "pg", src: s.data.relaySrc, dst: text.trim() });
      clearState(userId);
      await bot2.sendMessage(chatId,
        `✅ *تم إنشاء Relay!*\n\n💬→👥 من شخص لمجموعة`,
        { parse_mode: "Markdown", reply_markup: bridgeMenuKeyboard() }
      );
      return true;
    }
    // ── Bridge: active group members ─────────────────────────────────────────
    case "awaiting_bridge_active_group": {
      const sock = inMemoryDB.sessions.get(userId);
      clearState(userId);
      if (!sock) { await bot2.sendMessage(chatId, "❌ ربط واتساب أولاً"); return true; }
      const groupId = text.trim();
      try {
        const members = (await _groupCmpSvc.getGroupMembers(sock, groupId)).slice(0, 50);
        await bot2.sendMessage(chatId,
          `⚡ *أعضاء المجموعة (${members.length}):*\n\n${_groupCmpSvc.formatMembersList(members)}`,
          { parse_mode: "Markdown", reply_markup: bridgeMenuKeyboard() }
        );
      } catch {
        await bot2.sendMessage(chatId, "❌ لم يتم الوصول للمجموعة. تأكد من المعرّف.", { reply_markup: bridgeMenuKeyboard() });
      }
      return true;
    }
    // ── Bridge: compare groups ────────────────────────────────────────────────
    case "awaiting_bridge_compare_g1": {
      setState(userId, "awaiting_bridge_compare_g2", { cmpG1: text.trim() });
      await bot2.sendMessage(chatId,
        `✅ المجموعة الأولى: \`${text.trim()}\`\n\n*الخطوة 2/2:* أدخل معرّف المجموعة الثانية:`,
        { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
      );
      return true;
    }
    case "awaiting_bridge_compare_g2": {
      const s = getState(userId);
      const sock = inMemoryDB.sessions.get(userId);
      clearState(userId);
      if (!sock) { await bot2.sendMessage(chatId, "❌ ربط واتساب أولاً"); return true; }
      try {
        const { common, only1, only2 } = await _groupCmpSvc.compareGroups(sock, s.data.cmpG1, text.trim());
        await bot2.sendMessage(chatId,
          `📊 *مقارنة المجموعتين:*\n\n🤝 مشترك: ${common.length}\n1️⃣ في الأولى فقط: ${only1.length}\n2️⃣ في الثانية فقط: ${only2.length}\n\nمثال مشترك:\n${common.slice(0, 5).map((id) => `• +${id.split("@")[0]}`).join("\n")}`,
          { parse_mode: "Markdown", reply_markup: bridgeMenuKeyboard() }
        );
      } catch {
        await bot2.sendMessage(chatId, "❌ فشل المقارنة. تأكد من المعرّفات.", { reply_markup: bridgeMenuKeyboard() });
      }
      return true;
    }
    // ── Bridge: add custom contact ────────────────────────────────────────────
    case "awaiting_custom_contact_num": {
      const phone = text.replace(/\D/g, "");
      clearState(userId);
      if (!phone || phone.length < 7) { await bot2.sendMessage(chatId, "❌ رقم غير صحيح"); return true; }
      const { saveCustomContact } = await _mod_database();
      saveCustomContact(userId, phone);
      await bot2.sendMessage(chatId, `✅ تم إضافة +${phone} للقائمة المخصصة!`, { reply_markup: bridgeMenuKeyboard() });
      return true;
    }
    // ── Bridge: bulk send to custom list / delayed ────────────────────────────
    case "awaiting_custom_list_msg":
    case "awaiting_delayed_bulk_msg": {
      const { getCustomContactList } = await _mod_database();
      const list = getCustomContactList(userId);
      const sock = inMemoryDB.sessions.get(userId);
      const isDelayed = state.state === "awaiting_delayed_bulk_msg";
      clearState(userId);
      if (!sock) { await bot2.sendMessage(chatId, "❌ ربط واتساب أولاً"); return true; }
      if (list.length === 0) { await bot2.sendMessage(chatId, "❌ القائمة فارغة. أضف أرقاماً أولاً."); return true; }
      await bot2.sendMessage(chatId, `⏳ جارٍ الإرسال لـ ${list.length} رقم${isDelayed ? " بتأخير ذكي" : ""}...`);
      const { sent, failed } = await _bulkSendSvc.bulkSendMessages(sock, list, text, isDelayed);
      _bulkSendSvc.updateBulkStats(userId, sent, failed, list.length, getUser, saveUser);
      await bot2.sendMessage(chatId,
        `✅ *اكتمل الإرسال!*\n\n📤 ناجح: ${sent}\n❌ فشل: ${failed}\n📊 إجمالي: ${list.length}`,
        { parse_mode: "Markdown", reply_markup: bridgeMenuKeyboard() }
      );
      return true;
    }
    // ── Pairing: awaiting phone number ────────────────────────────────────────
    // [FIX_AWAITING_PAIRING_NUMBER] هذا الـ case كان غائباً → البوت لا يستجيب عند إرسال الرقم
    case "awaiting_pairing_number": {
      clearState(userId);
      const cleanPhone = text.replace(/\D/g, "");
      if (!/^\d{7,15}$/.test(cleanPhone)) {
        await bot2.sendMessage(
          chatId,
          "❌ رقم الهاتف غير صحيح.\n\nأدخل الرقم مع كود الدولة بدون +\nمثال: `249960506662`",
          { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
        );
        return true;
      }
      const { startPairingSession: _startPairing } = await _deps._mod_baileys_session();
      await _startPairing(userId, chatId, cleanPhone);
      return true;
    }

    // ── Reports: awaiting target phone/description ──────────────────────────
    case "awaiting_report_target": {
      const isPhoneInput = /\d{5,}/.test(text);
      const phone = text.replace(/\D/g, "");

      if (isPhoneInput && phone.length < 5) {
        setState(userId, "awaiting_report_target");
        await bot2.sendMessage(
          chatId,
          `\u274C *\u0631\u0642\u0645 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D*\n\n\u0623\u0631\u0633\u0644 \u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u0645\u0639 \u0643\u0648\u062F \u0627\u0644\u062F\u0648\u0644\u0629 \u0623\u0648 \u0648\u0635\u0641\u0627\u064B \u0644\u0644\u0645\u0634\u0643\u0644\u0629.\n\u0645\u062B\u0627\u0644: \`249960123456\``,
          { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
        );
        return true;
      }

      // حفظ الهدف والانتقال لطلب الكمية
      const targetDisplay = (isPhoneInput && phone.length >= 5)
        ? `\uD83D\uDCF1 \u0627\u0644\u0631\u0642\u0645: \`+${phone}\``
        : `\uD83D\uDCDD \u0627\u0644\u0648\u0635\u0641: "${text.slice(0, 60)}"`;

      setState(userId, "awaiting_report_count", {
        target: isPhoneInput && phone.length >= 5 ? phone : text.trim(),
        isPhone: isPhoneInput && phone.length >= 5,
        targetDisplay,
      });

      await bot2.sendMessage(
        chatId,
        `\u{1F4CA} *\u0643\u0645 \u0628\u0644\u0627\u063A\u0627\u064B \u062A\u0631\u064A\u062F \u0625\u0631\u0633\u0627\u0644\u0647\u0627 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628\u061F*\n\n${targetDisplay}\n\n\u0623\u0631\u0633\u0644 \u0627\u0644\u0639\u062F\u062F \u0643\u0631\u0642\u0645 \u0635\u062D\u064A\u062D (1\u2013500)`,
        { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
      );
      return true;
    }

    // ── Reports: awaiting quantity of reports ────────────────────────────────
    case "awaiting_report_count": {
      clearState(userId);
      const s = state.data || {};
      const count = parseInt(text.trim(), 10);

      if (!count || count < 1 || count > 500) {
        await bot2.sendMessage(
          chatId,
          `\u274C \u0623\u062F\u062E\u0644 \u0639\u062F\u062F\u0627\u064B \u0635\u062D\u064A\u062D\u0627\u064B \u0628\u064A\u0646 1 \u0648 500.`,
          { reply_markup: cancelKeyboard() }
        );
        return true;
      }

      const prevReports = user.reportsSent || 0;
      const newReports  = prevReports + count;
      saveUser(userId, { reportsSent: newReports });

      // محاولة الإبلاغ الفعلي عبر واتساب
      let reportSent = false;
      const sock = inMemoryDB.sessions?.get(userId);
      if (sock && s.isPhone && s.target) {
        try {
          for (let i = 0; i < Math.min(count, 10); i++) {
            await sock.updateBlockStatus(s.target + "@s.whatsapp.net", "block");
          }
          reportSent = true;
        } catch { /* لا جلسة نشطة */ }
      }

      let rewardMsg = "";
      const pts20  = Math.floor(newReports / 20)  - Math.floor(prevReports / 20);
      const pts200 = Math.floor(newReports / 200) - Math.floor(prevReports / 200);
      if (pts20 > 0) {
        addPoints(userId, pts20 * 1000, `\u0625\u0631\u0633\u0627\u0644 ${pts20 * 20} \u0628\u0644\u0627\u063A`);
        rewardMsg += `\n\n\uD83C\uDF89 *\u0645\u0628\u0631\u0648\u0643! \u0631\u0628\u062D\u062A ${(pts20 * 1000).toLocaleString()} \u0646\u0642\u0637\u0629!*`;
      }
      if (pts200 > 0) {
        saveUser(userId, { reportsStarsSent: (user.reportsStarsSent || 0) + pts200 });
        rewardMsg += `\n\u2B50 *\u062D\u0635\u0644\u062A \u0639\u0644\u0649 ${pts200} \u0646\u062C\u0645\u0629 \u062A\u0642\u064A\u064A\u0645 \u0644\u0644\u0645\u0637\u0648\u0651\u0631!*`;
      }

      const filled = Math.min(10, Math.floor((newReports % 20) / 2));
      const progressBar20 = "\u2588".repeat(filled) + "\u2591".repeat(10 - filled);
      const nextMilestone20 = 20 - (newReports % 20);

      await bot2.sendMessage(
        chatId,
        `\u2705 *\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 ${count} \u0628\u0644\u0627\u063A!*\n\n` +
        `${s.targetDisplay || ""}\n` +
        `${reportSent ? "\uD83D\uDCE1 _\u062A\u0645 \u0625\u0628\u0644\u0627\u063A \u0648\u0627\u062A\u0633\u0622\u0628 \u0641\u0639\u0644\u064A\u0627\u064B_\n" : ""}` +
        `\n\uD83D\uDCCA *\u0625\u062C\u0645\u0627\u0644\u064A \u0628\u0644\u0627\u063A\u0627\u062A\u0643:* ${newReports.toLocaleString()}\n\n` +
        `*\u0627\u0644\u062A\u0642\u062F\u0645 \u0646\u062D\u0648 1,000 \u0646\u0642\u0637\u0629:*\n${progressBar20} ${newReports % 20}/20` +
        `${nextMilestone20 > 0 && nextMilestone20 < 20 ? `\n\u23F3 ${nextMilestone20} \u0628\u0644\u0627\u063A \u0644\u0644\u0645\u0643\u0627\u0641\u0623\u0629 \u0627\u0644\u062A\u0627\u0644\u064A\u0629` : ""}` +
        rewardMsg,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "\uD83D\uDCE2 \u0625\u0631\u0633\u0627\u0644 \u0628\u0644\u0627\u063A \u062C\u062F\u064A\u062F", callback_data: "report_send" }],
              [{ text: "\uD83D\uDCCA \u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A\u064A", callback_data: "report_stats" }, { text: "\uD83D\uDD19 \u0627\u0644\u0628\u0644\u0627\u063A\u0627\u062A", callback_data: "menu_reports" }],
              [{ text: "\uD83C\uDFE0 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629", callback_data: "home" }]
            ]
          }
        }
      );
      return true;
    }

    // ── Reports Store: awaiting custom buy count ─────────────────────────────
    case "awaiting_report_buy_count": {
      clearState(userId);
      const buyCount = parseInt(text.trim(), 10);

      if (!buyCount || buyCount < 1 || buyCount > 10000) {
        await bot2.sendMessage(
          chatId,
          `\u274C \u0623\u062F\u062E\u0644 \u0639\u062F\u062F\u0627\u064B \u0635\u062D\u064A\u062D\u0627\u064B \u0628\u064A\u0646 1 \u0648 10000.`,
          { reply_markup: cancelKeyboard() }
        );
        return true;
      }

      const cost = buyCount * 50;
      const userPts = user.points || 0;

      if (userPts < cost) {
        await bot2.sendMessage(
          chatId,
          `\u274C *\u0631\u0635\u064A\u062F\u0643 \u063A\u064A\u0631 \u0643\u0627\u0641\u064D!*\n\n\u062A\u062D\u062A\u0627\u062C: *${cost.toLocaleString()} \u0646\u0642\u0637\u0629*\n\u0631\u0635\u064A\u062F\u0643: *${userPts.toLocaleString()} \u0646\u0642\u0637\u0629*\n\n\u0646\u0642\u0635: *${(cost - userPts).toLocaleString()} \u0646\u0642\u0637\u0629*`,
          { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
        );
        return true;
      }

      addPoints(userId, -cost, `\u0634\u0631\u0627\u0621 ${buyCount} \u0628\u0644\u0627\u063A \u0645\u0646 \u0627\u0644\u0645\u062A\u062C\u0631`);
      const prevR = user.reportsSent || 0;
      saveUser(userId, { reportsSent: prevR + buyCount });

      await bot2.sendMessage(
        chatId,
        `\u2705 *\u062A\u0645 \u0634\u0631\u0627\u0621 ${buyCount} \u0628\u0644\u0627\u063A \u0628\u0646\u062C\u0627\u062D!*\n\n` +
        `\uD83D\uDCB0 \u062A\u0645 \u062E\u0635\u0645: *${cost.toLocaleString()} \u0646\u0642\u0637\u0629*\n` +
        `\uD83D\uDCCA \u0625\u062C\u0645\u0627\u0644\u064A \u0628\u0644\u0627\u063A\u0627\u062A\u0643: *${(prevR + buyCount).toLocaleString()}*\n` +
        `\uD83D\uDCB3 \u0631\u0635\u064A\u062F\u0643 \u0627\u0644\u0645\u062A\u0628\u0642\u064A: *${(userPts - cost).toLocaleString()} \u0646\u0642\u0637\u0629*`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "\uD83D\uDCE2 \u0625\u0631\u0633\u0627\u0644 \u0628\u0644\u0627\u063A \u0627\u0644\u0622\u0646", callback_data: "report_send" }],
              [{ text: "\uD83D\uDED2 \u0645\u062A\u062C\u0631 \u0627\u0644\u0628\u0644\u0627\u063A\u0627\u062A", callback_data: "report_store" }, { text: "\uD83C\uDFE0 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629", callback_data: "home" }],
            ]
          }
        }
      );
      return true;
    }

    default:
      return false;
  }
}
