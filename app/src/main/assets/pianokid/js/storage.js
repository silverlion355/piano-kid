/**
 * 钢琴小达人 - 本地存储
 */
var Storage = (function() {
  var PREFIX = 'pianokid_';

  function get(key) {
    try {
      var v = localStorage.getItem(PREFIX + key);
      if (v === null) return null;
      return JSON.parse(v);
    } catch(e) { return null; }
  }

  function set(key, val) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(val));
    } catch(e) { GameLog.error('Storage', 'set ' + key + ' failed: ' + e); }
  }

  // ---- Progress ----
  function getProgress() {
    return get('progress') || {
      coins: 0,
      totalStars: 0,
      level: 1,
      exp: 0,
      unlockedSongs: [1],
      records: {}
    };
  }

  function saveProgress(p) { set('progress', p); }

  function addCoins(n) {
    var p = getProgress();
    p.coins += n;
    // Level up check
    var levels = [[0,1],[200,2],[500,3],[1000,4],[2000,5]];
    for (var i = levels.length - 1; i >= 0; i--) {
      if (p.coins >= levels[i][0]) { p.level = levels[i][1]; break; }
    }
    saveProgress(p);
    return p;
  }

  // ---- Per-song records ----
  function getSongRecord(id) {
    var p = getProgress();
    return p.records[id] || { stars: 0, bestScore: 0, playCount: 0, completed: false };
  }

  function saveSongRecord(id, record) {
    var p = getProgress();
    p.records[id] = record;
    // Unlock next
    var nextId = id + 1;
    if (nextId <= 6 && p.unlockedSongs.indexOf(nextId) < 0) {
      p.unlockedSongs.push(nextId);
    }
    saveProgress(p);
  }

  return {
    get: get, set: set,
    getProgress: getProgress, saveProgress: saveProgress,
    addCoins: addCoins,
    getSongRecord: getSongRecord, saveSongRecord: saveSongRecord
  };
})();