/**
 * 钢琴小达人 - 游戏引擎
 * 负责游戏循环、音符推进、判定、评分
 */
var Game = (function() {
  var currentSong = null;
  var currentIndex = 0;
  var isPlaying = false;
  var score = 0;
  var combo = 0;
  var maxCombo = 0;
  var perfectCount = 0;
  var goodCount = 0;
  var missCount = 0;

  // Timing
  var startTime = 0;
  var noteStartTimes = []; // 每个音符的计划弹奏时间
  var beatDuration = 0; // 一个四分音符的时长(ms)

  // Current detected pitch
  var lastPitch = -1;
  var lastPitchTime = 0;
  var noteHandled = false; // 当前音符是否已判定

  function startGame(songId) {
    currentSong = SONGS[songId - 1];
    if (!currentSong) { GameLog.error('Game', 'Song not found: ' + songId); return; }

    Game.currentSong = currentSong;

    currentIndex = 0;
    isPlaying = true;
    score = 0;
    combo = 0;
    maxCombo = 0;
    perfectCount = 0;
    goodCount = 0;
    missCount = 0;
    noteHandled = false;

    beatDuration = 60000 / currentSong.bpm;

    // Calculate expected start time for each note
    noteStartTimes = [];
    var t = 0;
    for (var i = 0; i < currentSong.notes.length; i++) {
      noteStartTimes.push(t);
      t += currentSong.notes[i].b * beatDuration;
    }
    startTime = Date.now();

    // Load into staff
    Staff.loadSong(currentSong);
    Staff.setIndex(0);

    // Update UI
    document.getElementById('game-title').textContent = currentSong.name;
    updateStatusBar();

    // Highlight first note
    var firstNote = currentSong.notes[0];
    Piano.highlight(firstNote.n);
    GameLog.info('Game', 'Started: ' + currentSong.name + ', bpm=' + currentSong.bpm + ', notes=' + currentSong.notes.length);

    // Start mic
    PitchDetector.start().catch(function(e) {
      GameLog.warn('Game', 'Mic start failed: ' + e);
    });

    PitchDetector.setCallback(onPitchDetected);

    App.showScreen('game-screen');
    gameLoop();
  }

  function gameLoop() {
    if (!isPlaying) return;

    var elapsed = Date.now() - startTime;
    var currentNote = currentSong.notes[currentIndex];
    var expectedTime = noteStartTimes[currentIndex];
    var noteEndTime = currentIndex < noteStartTimes.length - 1
      ? noteStartTimes[currentIndex + 1]
      : expectedTime + beatDuration * 2;

    // Move to next note if time passed
    if (currentIndex < currentSong.notes.length - 1 && elapsed >= noteStartTimes[currentIndex + 1]) {
      if (!noteHandled) {
        // Miss: didn't play the note in time
        handleMiss();
      }
      currentIndex++;
      noteHandled = false;
      Staff.setIndex(currentIndex);

      if (currentIndex < currentSong.notes.length) {
        Piano.highlight(currentSong.notes[currentIndex].n);
      } else {
        Piano.clearAllHighlights();
      }
      updateStatusBar();
    }

    // If we haven't played the current note for too long
    if (!noteHandled && elapsed > noteEndTime + 500) {
      handleMiss();
      currentIndex++;
      noteHandled = false;
      Staff.setIndex(currentIndex);
      if (currentIndex < currentSong.notes.length) {
        Piano.highlight(currentSong.notes[currentIndex].n);
      }
      updateStatusBar();
    }

    // Check end of song
    if (currentIndex >= currentSong.notes.length) {
      endGame();
      return;
    }

    requestAnimationFrame(gameLoop);
  }

  function onPitchDetected(pitch) {
    if (!isPlaying || noteHandled) return;
    lastPitch = pitch;
    lastPitchTime = Date.now();

    if (pitch < 0) return;

    var note = currentSong.notes[currentIndex];
    var expectedFreq = noteFreq(note.n);
    var cents = Math.abs(1200 * Math.log2(pitch / expectedFreq));

    // Determine if this matches current note
    // Allow some tolerance for pitch (100 cents = half step)
    if (cents < 100) {
      var elapsed = Date.now() - startTime;
      var expectedTime = noteStartTimes[currentIndex];
      var timingDiff = Math.abs(elapsed - expectedTime);

      GameLog.info('Pitch', 'Detected: ' + pitch.toFixed(1) + 'Hz, target=' + expectedFreq.toFixed(1) + ', cents=' + cents.toFixed(0) + ', timingDiff=' + timingDiff + 'ms');

      if (timingDiff < 150 && cents < 50) {
        handlePerfect();
      } else if (timingDiff < 300 && cents < 100) {
        handleGood();
      } else if (cents < 100) {
        handleGood();
      }
    }
  }

  function noteFreq(noteName) {
    var noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    var baseNote = noteName.replace('#', '');
    var octave = parseInt(noteName.replace(baseNote, ''));
    var noteIdx = noteNames.indexOf(baseNote);
    var midi = (octave + 1) * 12 + noteIdx;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function handlePerfect() {
    noteHandled = true;
    perfectCount++;
    combo++;
    maxCombo = Math.max(maxCombo, combo);

    var bonus = 1;
    if (combo >= 20) bonus = 1.5;
    else if (combo >= 10) bonus = 1.2;
    else if (combo >= 5) bonus = 1.1;

    score += Math.round(100 * bonus);

    Piano.flashCorrect(currentSong.notes[currentIndex].n);
    showJudgment('PERFECT', 'perfect');
    GameLog.info('Game', 'Perfect! combo=' + combo + ', score=' + score);
    updateStatusBar();
  }

  function handleGood() {
    noteHandled = true;
    goodCount++;
    combo = 0;
    score += 50;

    Piano.flashCorrect(currentSong.notes[currentIndex].n);
    showJudgment('GOOD', 'good');
    GameLog.info('Game', 'Good! score=' + score);
    updateStatusBar();
  }

  function handleMiss() {
    noteHandled = true;
    missCount++;
    combo = 0;

    Piano.flashWrong(currentSong.notes[currentIndex].n);
    showJudgment('MISS', 'miss');
    GameLog.warn('Game', 'Miss at index=' + currentIndex);
    updateStatusBar();
  }

  function showJudgment(text, cls) {
    var el = document.getElementById('judgment-overlay');
    el.textContent = text;
    el.className = 'judgment-overlay ' + cls + ' show';
    setTimeout(function() { el.className = 'judgment-overlay'; }, 500);
  }

  function updateStatusBar() {
    document.getElementById('game-score').textContent = score;
    document.getElementById('game-combo').textContent = combo;
    // Stars estimate
    var total = perfectCount + goodCount + missCount;
    var missRate = total > 0 ? missCount / total : 1;
    var stars = missRate < 0.15 ? 3 : missRate < 0.30 ? 2 : missRate < 0.50 ? 1 : 0;
    document.getElementById('game-stars').textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
  }

  function endGame() {
    isPlaying = false;
    PitchDetector.stop();
    Piano.clearAllHighlights();

    var total = perfectCount + goodCount + missCount;
    var missRate = total > 0 ? missCount / total : 1;
    var stars = missRate < 0.15 ? 3 : missRate < 0.30 ? 2 : missRate < 0.50 ? 1 : 0;

    // Save record
    var prevRecord = Storage.getSongRecord(currentSong.id);
    var isNewBest = stars > prevRecord.stars || (stars === prevRecord.stars && score > prevRecord.bestScore);
    var record = {
      stars: Math.max(stars, prevRecord.stars),
      bestScore: Math.max(score, prevRecord.bestScore),
      playCount: (prevRecord.playCount || 0) + 1,
      completed: true
    };
    Storage.saveSongRecord(currentSong.id, record);

    // Coins
    var coinsEarned = 50;
    if (prevRecord.playCount === 0 || prevRecord.playCount === undefined) {
      coinsEarned += 30; // First clear bonus
    }
    if (stars >= 2) coinsEarned += 20;
    if (stars >= 3) coinsEarned += 50;
    if (stars >= 3 && prevRecord.playCount === 0) coinsEarned += 100;

    var p = Storage.addCoins(coinsEarned);
    GameLog.info('Game', 'Ended: stars=' + stars + ', score=' + score + ', coins=' + coinsEarned);

    // Show result
    document.getElementById('result-title').textContent = stars > 0 ? '🎉 恭喜通关！' : '😢 再接再厉';
    document.getElementById('result-stars').textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    document.getElementById('result-score').textContent = '得分: ' + score;
    document.getElementById('r-perfect').textContent = perfectCount;
    document.getElementById('r-good').textContent = goodCount;
    document.getElementById('r-miss').textContent = missCount;
    document.getElementById('r-combo').textContent = maxCombo;
    document.getElementById('r-coins').textContent = coinsEarned;
    document.getElementById('r-new-star').style.display = isNewBest ? 'inline' : 'none';

    // Show/hide next button
    var nextBtn = document.getElementById('btn-next');
    nextBtn.style.display = currentSong.id < 6 ? 'inline-block' : 'none';

    // Update home coins
    App.updateHomeInfo();

    App.showScreen('result-screen');
  }

  function stopGame() {
    isPlaying = false;
    PitchDetector.stop();
    Piano.clearAllHighlights();
  }

  return {
    startGame: startGame, endGame: endGame, stopGame: stopGame,
    handlePerfect: handlePerfect, handleGood: handleGood, handleMiss: handleMiss
  };
})();