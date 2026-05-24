/**
 * 钢琴小达人 - App主逻辑
 * 页面路由、初始化、UI更新
 */
var App = (function() {
  var currentScreen = 'screen-home';

  function safeText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function showScreen(name) {
    if (currentScreen === 'screen-game' && name !== 'screen-game') {
      Game.stopGame();
    }

    document.querySelectorAll('.screen').forEach(function(s) {
      s.classList.remove('active');
    });

    var target = document.getElementById('screen-' + name);
    if (target) target.classList.add('active');
    currentScreen = 'screen-' + name;

    if (name === 'home-screen') updateHomeInfo();
    if (name === 'shop-screen') updateShopInfo();
    if (name === 'records-screen') updateRecordsInfo();
    if (name === 'log-screen') updateLogInfo();

    GameLog.info('App', 'Screen: ' + name);
  }

  function updateHomeInfo() {
    var p = Storage.getProgress();
    safeText('home-coins', p.coins);
    safeText('home-stars', p.totalStars);

    var titles = ['', '钢琴小白', '钢琴学徒', '钢琴达人', '钢琴高手', '钢琴大师'];
    safeText('home-username', titles[p.level] || '钢琴小白');
    safeText('home-level', 'Lv.' + p.level);

    renderLevelList();
  }

  function renderLevelList() {
    var container = document.getElementById('level-list');
    if (!container) return;

    var p = Storage.getProgress();
    container.innerHTML = '';

    SONGS.forEach(function(song) {
      var isUnlocked = p.unlockedSongs.indexOf(song.id) >= 0;
      var record = p.records[song.id] || { stars: 0, bestScore: 0 };
      var starsStr = record.stars > 0 ? '⭐'.repeat(record.stars) + '☆'.repeat(3 - record.stars) : '☆☆☆';

      var div = document.createElement('div');
      div.className = 'level-item' + (isUnlocked ? '' : ' locked');
      div.innerHTML =
        '<span class="level-stars">' + starsStr + '</span>' +
        '<span class="level-name">' + song.name + '</span>' +
        '<span class="level-difficulty">' + DIFFICULTY_STARS[song.difficulty] + '</span>' +
        '<span class="level-best">' + (record.bestScore > 0 ? record.bestScore + '分' : '') + '</span>';
      if (isUnlocked) {
        div.onclick = (function(id) { return function() { startSong(id); }; })(song.id);
      }
      container.appendChild(div);
    });
  }

  function updateShopInfo() {
    safeText('shop-my-coins', Storage.getProgress().coins);
  }

  function buyItem(itemId) {
    var p = Storage.getProgress();
    var prices = { freetime1: 100, freetime5: 400, unlock: 200 };
    var price = prices[itemId];
    if (!price || p.coins < price) {
      GameLog.warn('Shop', 'Not enough coins: need ' + price + ', have ' + p.coins);
      alert('金币不足！需要 ' + price + ' 金币');
      return;
    }
    p.coins -= price;
    Storage.saveProgress(p);

    if (itemId === 'freetime1' || itemId === 'freetime5') {
      showFreetime(itemId === 'freetime1' ? 1 : 5);
    } else if (itemId === 'unlock') {
      for (var i = 1; i <= 6; i++) {
        if (p.unlockedSongs.indexOf(i) < 0) { p.unlockedSongs.push(i); break; }
      }
      Storage.saveProgress(p);
      alert('已解锁下一关卡！');
    }

    updateShopInfo();
    updateHomeInfo();
    GameLog.info('Shop', 'Bought: ' + itemId);
  }

  function showFreetime(minutes) {
    var remaining = minutes * 60;
    var modal = document.getElementById('modal-freetime');
    var timerEl = document.getElementById('freetime-timer');
    if (!modal || !timerEl) return;

    modal.style.display = 'flex';

    function tick() {
      if (remaining <= 0) {
        modal.style.display = 'none';
        return;
      }
      var m = Math.floor(remaining / 60);
      var s = remaining % 60;
      timerEl.textContent = m + ':' + (s < 10 ? '0' : '') + s;
      remaining--;
      setTimeout(tick, 1000);
    }
    tick();
  }

  function closeFreetime() { document.getElementById('modal-freetime').style.display = 'none'; }

  function updateRecordsInfo() {
    var container = document.getElementById('records-list');
    if (!container) return;

    var p = Storage.getProgress();
    container.innerHTML = '';

    SONGS.forEach(function(song) {
      var record = p.records[song.id] || { stars: 0, bestScore: 0, playCount: 0 };
      var starsStr = record.stars > 0 ? '⭐'.repeat(record.stars) + '☆'.repeat(3 - record.stars) : '☆☆☆';
      var div = document.createElement('div');
      div.className = 'record-item';
      div.innerHTML =
        '<span style="min-width:80px">' + song.name + '</span>' +
        '<span style="color:#FFD700">' + starsStr + '</span>' +
        '<span style="color:#aaa;font-size:12px">最高' + record.bestScore + '分</span>' +
        '<span style="color:#aaa;font-size:12px">玩了' + record.playCount + '次</span>';
      container.appendChild(div);
    });
  }

  function updateLogInfo() {
    var container = document.getElementById('log-content');
    if (!container) return;

    container.innerHTML = '';
    GameLog.onEntry(function(entry) {
      if (entry.cleared) { container.innerHTML = ''; return; }
      var ts = entry.time.toISOString().substr(11, 12);
      var div = document.createElement('div');
      div.className = 'log-entry ' + entry.level;
      div.textContent = '[' + ts + '][' + entry.level.toUpperCase() + '][' + entry.tag + '] ' + entry.msg;
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    });
    GameLog.getAll().forEach(function(e) {
      var ts = e.time.toISOString().substr(11, 12);
      var div = document.createElement('div');
      div.className = 'log-entry ' + e.level;
      div.textContent = '[' + ts + '][' + e.level.toUpperCase() + '][' + e.tag + '] ' + e.msg;
      container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
  }

  function startSong(songId) { GameLog.info('App', 'Starting song: ' + songId); Game.startGame(songId); }
  function replayGame() { if (window.Game && Game.currentSong) Game.startGame(Game.currentSong.id); }
  function nextSong() { if (window.Game && Game.currentSong && Game.currentSong.id < 6) Game.startGame(Game.currentSong.id + 1); }
  function goHome() { Game.stopGame(); showScreen('home-screen'); }
  function confirmQuit() { document.getElementById('modal-quit').style.display = 'flex'; }
  function hideQuitModal() { document.getElementById('modal-quit').style.display = 'none'; }
  function quitGame() { document.getElementById('modal-quit').style.display = 'none'; Game.stopGame(); showScreen('home-screen'); }

  window._onBackPressed = function() {
    if (currentScreen === 'screen-home') return;
    if (currentScreen === 'screen-game') confirmQuit();
    else showScreen('home-screen');
  };

  function init() {
    try {
      GameLog.info('App', 'PianoKid initializing...');
      safeText('version-text', '版本 1.0.0');
      Staff.init();
      Piano.init();
      showScreen('home-screen');
      updateHomeInfo();
      GameLog.info('App', 'PianoKid ready!');
    } catch (e) {
      console.error(e);
      GameLog.error('App', 'Init failed: ' + e);
    }
  }

  document.addEventListener('DOMContentLoaded', function() { try { init(); } catch(e) { console.error('init error:', e); } });

  return { showScreen: showScreen, updateHomeInfo: updateHomeInfo, startSong: startSong, replayGame: replayGame, nextSong: nextSong, goHome: goHome, confirmQuit: confirmQuit, hideQuitModal: hideQuitModal, quitGame: quitGame, buyItem: buyItem, closeFreetime: closeFreetime };
})();