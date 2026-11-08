// dist/handlers/download-handler.mjs
// Domain: Download — /vid /song /film /tiktok
// Phase 9: يستخدم download/download-parser-service لتحليل أوامر التنزيل
// ملاحظة: يستخدم init_search_utils() المتاح في bundle scope عبر _mod_ wrapper

import * as _dlParser from '../services/download/download-parser-service.mjs';

export const pluginManifest = {
  name: 'download',
  version: '1.0.0',
  type: 'handler',
  description: 'تنزيل الوسائط: /vid /song /film /tiktok',
  textOrder: 2,
  cbOrder: 0,
  enabled: true,
};

let _deps = null;
export function setDeps(d) { _deps = d; }

export async function handleText(bot, msg) {
  if (!msg.text) return false;
  const text = msg.text;
  const chatId = msg.chat.id;

  if (text.startsWith('/vid ') || text === '/vid') {
    var _vRest = text.replace('/vid', '').trim();
    if (!_vRest) { await bot.sendMessage(chatId, '\u26A0\uFE0F \u0645\u062B\u0627\u0644: /vid 3 2 \u0628\u062D\u062B\n\u2191\u062C\u0648\u062F\u0629(1-3) \u2191\u0639\u062F\u062F \u2191\u0628\u062D\u062B').catch(function(){}); return true; }
    var _vParsed = _dlParser.parseVideoCommand(text);
    if (!_vParsed) { await bot.sendMessage(chatId, '\u26A0\uFE0F \u0646\u0633\u064A\u062A \u0643\u0644\u0645\u0629 \u0627\u0644\u0628\u062D\u062B!').catch(function(){}); return true; }
    var _vQual = _vParsed.quality, _vCount = _vParsed.count, _vQuery = _vParsed.query, _vLbl = _vParsed.label;
    var _vSm = await bot.sendMessage(chatId, '\u{1F50D} \u0623\u0628\u062D\u062B \u0639\u0646 "' + _vQuery + '" \u2014 ' + _vLbl + ' \u00D7' + _vCount + '...').catch(function() { return null; });
    try {
      var _vDl = (await _deps._mod_search_utils()).searchAndDownloadYouTubeVideo;
      var _vRes = await _vDl(_vQuery, _vCount, 0, _vQual);
      for (var _vR of _vRes) { try { await bot.sendVideo(chatId, _vR.buffer, { caption: '\u{1F3AC} ' + _vR.title }); await new Promise(function(r) { setTimeout(r, 800); }); } catch (e2) {} }
      if (_vRes.length === 0) await bot.sendMessage(chatId, '\u274C \u0644\u0645 \u0623\u062C\u062F \u0646\u062A\u0627\u0626\u062C \u0644\u0640 "' + _vQuery + '"').catch(function() {});
    } catch (e) {
      await bot.sendMessage(chatId, '\u274C ' + (e && e.message ? e.message.slice(0, 80) : '\u062A\u0639\u0630\u0651\u0631 \u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0641\u064A\u062F\u064A\u0648')).catch(function() {});
    }
    if (_vSm) bot.deleteMessage(chatId, _vSm.message_id).catch(function() {});
    return true;
  }

  if (text.startsWith('/song ') || text === '/song') {
    var _sRest = text.replace('/song', '').trim();
    if (!_sRest) { await bot.sendMessage(chatId, '\u26A0\uFE0F \u0645\u062B\u0627\u0644: /song 3 \u0641\u064A\u0631\u0648\u0632').catch(function() {}); return true; }
    var _sParsed = _dlParser.parseAudioCommand(text);
    if (!_sParsed) { await bot.sendMessage(chatId, '\u26A0\uFE0F \u0646\u0633\u064A\u062A \u0643\u0644\u0645\u0629 \u0627\u0644\u0628\u062D\u062B!').catch(function() {}); return true; }
    var _sCnt = _sParsed.count, _sQuery = _sParsed.query;
    var _sSm = await bot.sendMessage(chatId, '\u{1F50D} \u0623\u0628\u062D\u062B \u0639\u0646 "' + _sQuery + '" \u00D7' + _sCnt + ' \u0623\u063A\u0646\u064A\u0629...').catch(function() { return null; });
    try {
      var _sDl = (await _deps._mod_search_utils()).searchAndDownloadYouTubeAudio;
      var _sRes = await _sDl(_sQuery, _sCnt, 0);
      for (var _sR of _sRes) { try { await bot.sendAudio(chatId, _sR.buffer, { title: _sR.title, performer: 'YouTube' }); await new Promise(function(r) { setTimeout(r, 600); }); } catch (e2) {} }
      if (_sRes.length === 0) await bot.sendMessage(chatId, '\u274C \u0644\u0645 \u0623\u062C\u062F \u0646\u062A\u0627\u0626\u062C \u0644\u0640 "' + _sQuery + '"').catch(function() {});
    } catch (e) {
      await bot.sendMessage(chatId, '\u274C \u062A\u0639\u0630\u0651\u0631 \u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0623\u063A\u0646\u064A\u0629 \u2014 \u062D\u0627\u0648\u0644 \u0645\u062C\u062F\u062F\u0627\u064B').catch(function() {});
    }
    if (_sSm) bot.deleteMessage(chatId, _sSm.message_id).catch(function() {});
    return true;
  }

  if (text.startsWith('/film ') || text === '/film') {
    var _fQ = text.replace('/film', '').trim();
    if (!_fQ) { await bot.sendMessage(chatId, '\u26A0\uFE0F \u0645\u062B\u0627\u0644: /film inception').catch(function() {}); return true; }
    var _fmParsed = _dlParser.parseFilmCommand(text);
    if (!_fmParsed) { await bot.sendMessage(chatId, '\u26A0\uFE0F \u0645\u062B\u0627\u0644: /film inception').catch(function() {}); return true; }
    var _fmQtg = _fmParsed.query, _fmQvtg = _fmParsed.quality;
    var _fPrgMsgIdTg = null;
    var _fPrgUpdateTg = async function(txt) {
      try {
        if (_fPrgMsgIdTg) { await bot.editMessageText(txt, { chat_id: chatId, message_id: _fPrgMsgIdTg }).catch(function() {}); }
        else { var s = await bot.sendMessage(chatId, txt).catch(function() { return null; }); if (s && s.message_id) _fPrgMsgIdTg = s.message_id; }
      } catch (ep) { try { var s2 = await bot.sendMessage(chatId, txt).catch(function() { return null; }); if (s2 && s2.message_id) _fPrgMsgIdTg = s2.message_id; } catch {} }
    };
    await _fPrgUpdateTg('\u{1F3A5} ' + _fmQtg + ' [' + _dlParser.qualityLabel(_fmQvtg) + ']\n\u{1F50D} \u062c\u0627\u0631\u064a \u0627\u0644\u0628\u062d\u062b...');
    try {
      var _fmSfnTg = (await _deps._mod_search_utils()).downloadMovieSmart;
      var _fRTg = await _fmSfnTg(_fmQtg, _fmQvtg, _fPrgUpdateTg);
      if (_fPrgMsgIdTg) bot.deleteMessage(chatId, _fPrgMsgIdTg).catch(function() {});
      await bot.sendVideo(chatId, _fRTg.buffer, { caption: '\u{1F3A5} ' + _fRTg.title.slice(0, 60) + ' [' + _dlParser.qualityLabel(_fRTg.quality) + ']' });
    } catch (e) {
      if (_fPrgMsgIdTg) bot.deleteMessage(chatId, _fPrgMsgIdTg).catch(function() {});
      await bot.sendMessage(chatId, '\u274C ' + (e && e.message ? e.message.slice(0, 120) : '\u062a\u0639\u0630\u0651\u0631 \u062a\u0646\u0632\u064a\u0644 \u0627\u0644\u0641\u064a\u0644\u0645')).catch(function() {});
    }
    return true;
  }

  if (text.startsWith('/tiktok ') || text === '/tiktok') {
    var _tRest = text.replace('/tiktok', '').trim();
    if (!_tRest) { await bot.sendMessage(chatId, '\u26A0\uFE0F \u0645\u062B\u0627\u0644: /tiktok 3 \u062A\u062D\u0634\u064A\u0634 \u0639\u0631\u0627\u0642\u064A').catch(function() {}); return true; }
    var _tParsed = _dlParser.parseTikTokCommand(text);
    if (!_tParsed) { await bot.sendMessage(chatId, '\u26A0\uFE0F \u0646\u0633\u064A\u062A \u0643\u0644\u0645\u0629 \u0627\u0644\u0628\u062D\u062B!').catch(function() {}); return true; }
    var _tCnt = _tParsed.count, _tQuery = _tParsed.query;
    var _tSm = await bot.sendMessage(chatId, '\u{1F50D} \u0623\u0628\u062D\u062B \u0639\u0646 "' + _tQuery + '" \u0641\u064A \u062A\u064A\u0643 \u062A\u0648\u0643 \u00D7' + _tCnt + '...').catch(function() { return null; });
    try {
      var _tDl = (await _deps._mod_search_utils()).searchAndDownloadTikTok;
      var _tRes = await _tDl(_tQuery, _tCnt);
      for (var _tR of _tRes) { try { await bot.sendVideo(chatId, _tR.buffer, { caption: _tR.title || undefined }); await new Promise(function(r) { setTimeout(r, 400); }); } catch (e2) {} }
      if (_tRes.length === 0) await bot.sendMessage(chatId, '\u274C \u0644\u0645 \u0623\u062C\u062F \u0646\u062A\u0627\u0626\u062C \u062A\u064A\u0643 \u062A\u0648\u0643 \u0644\u0640 "' + _tQuery + '"').catch(function() {});
    } catch (e) {
      await bot.sendMessage(chatId, '\u274C \u062A\u0639\u0630\u0651\u0631 \u062A\u0646\u0632\u064A\u0644 \u062A\u064A\u0643 \u062A\u0648\u0643 \u2014 \u062D\u0627\u0648\u0644 \u0645\u062C\u062F\u062F\u0627\u064B').catch(function() {});
    }
    if (_tSm) bot.deleteMessage(chatId, _tSm.message_id).catch(function() {});
    return true;
  }

  return false;
}

export async function handleCallback(bot, query) {
  return false;
}
