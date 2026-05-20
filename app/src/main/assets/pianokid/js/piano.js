/**
 * 钢琴小达人 - 钢琴键盘
 * 范围：C3(48) - C5(72)，共25个音
 */
var Piano = (function() {
  // 25个音：C3到C5（不含C5本身，但含B4和C5）
  var WHITE_KEYS = [
    {note:'C3',midi:48},{note:'D3',midi:50},{note:'E3',midi:52},{note:'F3',midi:53},
    {note:'G3',midi:55},{note:'A3',midi:57},{note:'B3',midi:59},
    {note:'C4',midi:60},{note:'D4',midi:62},{note:'E4',midi:64},{note:'F4',midi:65},
    {note:'G4',midi:67},{note:'A4',midi:69},{note:'B4',midi:71},
    {note:'C5',midi:72}
  ];
  var BLACK_KEYS = [
    {note:'C#3',midi:49},{note:'D#3',midi:51},{note:null,midi:null},{note:'F#3',midi:54},
    {note:'G#3',midi:56},{note:'A#3',midi:58},
    {note:'C#4',midi:61},{note:'D#4',midi:63},{note:null,midi:null},{note:'F#4',midi:66},
    {note:'G#4',midi:68},{note:'A#4',midi:70},
    {note:'C#5',midi:73},{note:null,midi:null},{note:null,midi:null}
  ];

  // 黑键相对于白键的index偏移
  var BLACK_OFFSETS = [0, 1, -1, 2, 3, 4, -1, 5, 6, 7, -1, 8, 9, 10, -1];
  var BLACK_WIDTH_RATIO = 0.6;
  var KEY_COUNT = 15; // 白键数量

  var container = null;
  var keyElements = {}; // noteName -> div element

  function init() {
    container = document.getElementById('piano-keys');
    if (!container) return;

    // Calculate dimensions
    var containerWidth = container.clientWidth || 600;
    var whiteKeyWidth = Math.max(28, Math.floor(containerWidth / KEY_COUNT) - 2);
    var blackKeyWidth = Math.floor(whiteKeyWidth * BLACK_WIDTH_RATIO);

    container.innerHTML = '';
    keyElements = {};

    var whiteKeyIndex = 0;
    for (var i = 0; i < KEY_COUNT; i++) {
      var wk = WHITE_KEYS[i];
      var div = document.createElement('div');
      div.className = 'key white';
      div.style.width = whiteKeyWidth + 'px';
      div.id = 'key-' + wk.note;

      var label = document.createElement('span');
      label.className = 'key-label';
      label.textContent = wk.note;
      div.appendChild(label);

      container.appendChild(div);
      keyElements[wk.note] = div;

      // Add black key if exists at this position
      var bk = BLACK_KEYS[i];
      if (bk.note) {
        var bdiv = document.createElement('div');
        bdiv.className = 'key black';
        bdiv.style.width = blackKeyWidth + 'px';
        bdiv.style.left = (whiteKeyIndex * (whiteKeyWidth + 1) - Math.floor(blackKeyWidth / 2)) + 'px';
        bdiv.id = 'key-' + bk.note;

        var blabel = document.createElement('span');
        blabel.className = 'key-label';
        blabel.textContent = bk.note;
        bdiv.appendChild(blabel);

        container.appendChild(bdiv);
        keyElements[bk.note] = bdiv;
      }
      whiteKeyIndex++;
    }

    // Fix black key z-index
    container.style.position = 'relative';
    GameLog.info('Piano', 'Initialized with ' + Object.keys(keyElements).length + ' keys');
  }

  function highlight(noteName) {
    clearAllHighlights();
    if (noteName && keyElements[noteName]) {
      keyElements[noteName].classList.add('hint');
    }
  }

  function flashCorrect(noteName) {
    if (noteName && keyElements[noteName]) {
      var el = keyElements[noteName];
      el.classList.remove('hint', 'wrong');
      el.classList.add('correct');
      setTimeout(function() { el.classList.remove('correct'); }, 300);
    }
  }

  function flashWrong(noteName) {
    if (noteName && keyElements[noteName]) {
      var el = keyElements[noteName];
      el.classList.remove('hint', 'correct');
      el.classList.add('wrong');
      setTimeout(function() { el.classList.remove('wrong'); }, 300);
    }
  }

  function clearAllHighlights() {
    for (var k in keyElements) {
      keyElements[k].classList.remove('hint', 'correct', 'wrong');
    }
  }

  return {
    init: init, highlight: highlight,
    flashCorrect: flashCorrect, flashWrong: flashWrong,
    clearAllHighlights: clearAllHighlights
  };
})();