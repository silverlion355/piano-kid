/**
 * 钢琴小达人 - 音高检测
 * 使用 YIN 算法 + Web Audio API
 */
var PitchDetector = (function() {
  var audioContext = null;
  var analyser = null;
  var micStream = null;
  var isRunning = false;
  var sampleRate = 44100;
  var bufferSize = 2048;
  var onPitchCallback = null;

  // 音符名到频率（两个八度 C3-C5）
  var NOTE_FREQS = buildFreqMap();

  function buildFreqMap() {
    var map = {};
    // C3(48) to C5(72)
    var noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    for (var midi = 48; midi <= 72; midi++) {
      var octave = Math.floor(midi / 12) - 1;
      var noteName = noteNames[midi % 12];
      var freq = 440 * Math.pow(2, (midi - 69) / 12);
      map[noteName + octave] = freq;
      map[midi] = freq;
    }
    return map;
  }

  function start() {
    return new Promise(function(resolve, reject) {
      if (isRunning) { resolve('already_started'); return; }
      navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(function(stream) {
          micStream = stream;
          audioContext = new (window.AudioContext || window.webkitAudioContext)();
          var source = audioContext.createMediaStreamSource(stream);
          analyser = audioContext.createAnalyser();
          analyser.fftSize = bufferSize;
          source.connect(analyser);
          isRunning = true;
          GameLog.info('Pitch', 'Mic stream started, sampleRate=' + audioContext.sampleRate);
          resolve('ok');
          tickLoop();
        })
        .catch(function(e) {
          GameLog.error('Pitch', 'getUserMedia failed: ' + e);
          reject(e);
        });
    });
  }

  function stop() {
    isRunning = false;
    if (micStream) {
      micStream.getTracks().forEach(function(t) { t.stop(); });
      micStream = null;
    }
    if (audioContext) {
      audioContext.close();
      audioContext = null;
      analyser = null;
    }
    GameLog.info('Pitch', 'Mic stream stopped');
  }

  function isAvailable() {
    return isRunning;
  }

  function setCallback(fn) {
    onPitchCallback = fn;
  }

  function tickLoop() {
    if (!isRunning || !analyser) return;
    var buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);
    var pitch = yinDetect(buffer);
    if (onPitchCallback) onPitchCallback(pitch);
    setTimeout(tickLoop, 30);
  }

  /**
   * YIN pitch detection
   * Returns frequency in Hz, or -1 if no pitch detected
   */
  function yinDetect(buffer) {
    var half = Math.floor(buffer.length / 2);
    var yinBuffer = new Float32Array(half);
    var threshold = 0.10;

    // Step 1: Difference
    for (var tau = 0; tau < half; tau++) {
      yinBuffer[tau] = 0;
      for (var i = 0; i < half; i++) {
        var delta = buffer[i] - buffer[i + tau];
        yinBuffer[tau] += delta * delta;
      }
    }

    // Step 2: Cumulative mean normalized difference
    yinBuffer[0] = 1;
    var runningSum = 0;
    for (var tau = 1; tau < half; tau++) {
      runningSum += yinBuffer[tau];
      yinBuffer[tau] = yinBuffer[tau] * tau / runningSum;
    }

    // Step 3: Absolute threshold + find min
    var tauBest = -1;
    for (var tau = 2; tau < half; tau++) {
      if (yinBuffer[tau] < threshold) {
        while (tau + 1 < half && yinBuffer[tau + 1] < yinBuffer[tau]) tau++;
        tauBest = tau;
        break;
      }
    }
    if (tauBest < 2) {
      var minVal = Infinity;
      for (var tau = 2; tau < half; tau++) {
        if (yinBuffer[tau] < minVal) { minVal = yinBuffer[tau]; tauBest = tau; }
      }
    }
    if (tauBest < 2) return -1;

    // Step 4: Parabolic interpolation
    var s0 = yinBuffer[tauBest - 1] || 0;
    var s1 = yinBuffer[tauBest] || 0;
    var s2 = yinBuffer[tauBest + 1] || 0;
    var shift = (s2 - s0) / (2 * (2 * s1 - s2 - s0));
    var betterTau = tauBest + (isFinite(shift) ? shift : 0);

    var freq = audioContext.sampleRate / betterTau;
    if (freq < 60 || freq > 2000) return -1;
    return freq;
  }

  /**
   * Convert frequency to closest note name
   */
  function freqToNote(freq) {
    if (freq < 0) return null;
    var midi = Math.round(69 + 12 * Math.log2(freq / 440));
    var noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    var octave = Math.floor(midi / 12) - 1;
    var noteName = noteNames[midi % 12];
    return { name: noteName + octave, midi: midi, freq: freq };
  }

  /**
   * Get cents deviation from nearest note
   */
  function centsDeviation(freq, targetNote) {
    var targetFreq = NOTE_FREQS[targetNote];
    if (!targetFreq) return 999;
    return 1200 * Math.log2(freq / targetFreq);
  }

  /**
   * Get all available note names in our range
   */
  function getNoteNames() {
    return Object.keys(NOTE_FREQS).filter(function(k) { return typeof NOTE_FREQS[k] === 'number'; });
  }

  return {
    start: start, stop: stop, isAvailable: isAvailable,
    setCallback: setCallback, freqToNote: freqToNote,
    centsDeviation: centsDeviation, getNoteNames: getNoteNames
  };
})();