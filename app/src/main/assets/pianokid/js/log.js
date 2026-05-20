/**
 * 钢琴小达人 - 日志系统
 * 所有游戏日志统一通过这里记录
 */
var GameLog = (function() {
  var logs = [];
  var maxLogs = 500;
  var listeners = [];

  function add(level, tag, msg) {
    var entry = {
      time: new Date(),
      level: level,
      tag: tag,
      msg: msg
    };
    logs.push(entry);
    if (logs.length > maxLogs) logs.shift();
    notifyListeners(entry);
    console.log('[' + level + '][' + tag + '] ' + msg);
  }

  function info(tag, msg) { add('info', tag, msg); }
  function warn(tag, msg) { add('warn', tag, msg); }
  function error(tag, msg) { add('error', tag, msg); }

  function notifyListeners(entry) {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](entry); } catch(e) {}
    }
  }

  function onEntry(fn) {
    listeners.push(fn);
  }

  function getAll() {
    return logs.slice();
  }

  function getText() {
    var lines = [];
    for (var i = 0; i < logs.length; i++) {
      var e = logs[i];
      var ts = e.time.toISOString().substr(11, 12);
      lines.push('[' + ts + '][' + e.level.toUpperCase() + '][' + e.tag + '] ' + e.msg);
    }
    return lines.join('\n');
  }

  function clear() {
    logs = [];
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i]({cleared: true}); } catch(e) {}
    }
  }

  function copyAll() {
    var text = getText();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function() {
        alert('日志已复制到剪贴板，共 ' + logs.length + ' 条');
      }).catch(function() {
        prompt('复制失败，手动复制：', text);
      });
    } else {
      prompt('手动复制日志：', text);
    }
  }

  return {
    add: add, info: info, warn: warn, error: error,
    onEntry: onEntry, getAll: getAll, getText: getText,
    clear: clear, copyAll: copyAll
  };
})();