/**
 * 钢琴小达人 - 五线谱绘制
 * 使用 Canvas 绘制五线谱和当前音符
 */
var Staff = (function() {
  var canvas = null;
  var ctx = null;
  var song = null;
  var currentIndex = 0;
  var nextIndex = 0;

  // 五线谱参数
  var LINE_SPACING = 18;
  var LINE_COUNT = 5;
  var STAFF_TOP = 20;
  var STAFF_MARGIN = 60; // 左边留空间给高音谱号
  var NOTE_RADIUS = 10;

  // 音符在五线谱上的位置（以线/间为基准）
  // C4=60 落在上加一线（treble: E4线=4, F4=间4, G4线5=treble上第一线）
  // 实际上我们用相对位置: 以C4为基准(0)
  // 五线谱从G4(第5线)开始

  function init() {
    canvas = document.getElementById('staff-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    drawEmpty();
  }

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    if (song) draw();
  }

  function loadSong(s) {
    song = s;
    currentIndex = 0;
    nextIndex = 1;
    if (ctx) draw();
    GameLog.info('Staff', 'Loaded song: ' + s.name + ', ' + s.notes.length + ' notes');
  }

  function setIndex(idx) {
    currentIndex = idx;
    nextIndex = Math.min(idx + 1, song ? song.notes.length - 1 : 0);
    if (ctx) draw();
  }

  function getCurrentNote() {
    if (!song || currentIndex >= song.notes.length) return null;
    return song.notes[currentIndex];
  }

  function getNextNote() {
    if (!song || nextIndex >= song.notes.length) return null;
    return song.notes[nextIndex];
  }

  function draw() {
    if (!ctx || !canvas) return;
    var w = canvas.width;
    var h = canvas.height;

    // Clear
    ctx.fillStyle = '#0D1525';
    ctx.fillRect(0, 0, w, h);

    // Draw staff lines
    var top = h / 2 - LINE_SPACING * 2;
    for (var i = 0; i < LINE_COUNT; i++) {
      ctx.strokeStyle = '#446688';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(STAFF_MARGIN - 10, top + i * LINE_SPACING);
      ctx.lineTo(w - 20, top + i * LINE_SPACING);
      ctx.stroke();
    }

    // Draw treble clef (simplified text version)
    ctx.fillStyle = '#88AACC';
    ctx.font = 'bold 48px serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('𝄞', STAFF_MARGIN - 40, top + LINE_SPACING * 2);

    // Draw time signature
    ctx.font = 'bold 20px serif';
    ctx.fillText('4', STAFF_MARGIN + 5, top + LINE_SPACING);
    ctx.fillText('4', STAFF_MARGIN + 5, top + LINE_SPACING * 3);

    // Draw current note
    var cur = getCurrentNote();
    if (cur) {
      var pos = noteToPosition(cur.n);
      drawNote(cur.n, pos.x, pos.y, true);
    }

    // Draw next note (faded)
    var nxt = getNextNote();
    if (nxt && currentIndex < song.notes.length - 1) {
      var npos = noteToPosition(nxt.n);
      drawNote(nxt.n, npos.x, npos.y, false);
    }

    // Draw progress indicator
    if (song) {
      var progress = currentIndex / song.notes.length;
      ctx.fillStyle = '#333355';
      ctx.fillRect(STAFF_MARGIN, h - 12, w - STAFF_MARGIN - 20, 4);
      ctx.fillStyle = '#5B4FCF';
      ctx.fillRect(STAFF_MARGIN, h - 12, (w - STAFF_MARGIN - 20) * progress, 4);
    }
  }

  /**
   * Convert note name to (x, y) position
   */
  function noteToPosition(noteName) {
    var w = canvas.width;
    var top = canvas.height / 2 - LINE_SPACING * 2;
    var usableWidth = w - STAFF_MARGIN - 40;

    // X: spread notes evenly
    var x;
    if (song && song.notes.length > 1) {
      var lastNote = song.notes[song.notes.length - 1];
      // Calculate total beats
      var totalBeats = 0;
      for (var i = 0; i < song.notes.length; i++) {
        totalBeats += song.notes[i].b;
      }
      // Position current note based on cumulative beats before it
      var beatsBefore = 0;
      for (var i = 0; i < currentIndex; i++) {
        beatsBefore += song.notes[i].b;
      }
      x = STAFF_MARGIN + 20 + (beatsBefore / totalBeats) * usableWidth;
    } else {
      x = STAFF_MARGIN + 40;
    }

    // Y: based on note position on staff
    // 谱表范围: G4(第5线) 到 E6(下加一间)
    // 我们用 G4(音符G4)=y0 基准
    // 每升一个音程下降 LINE_SPACING/2 (因为线间交替)
    var noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    var baseNote = noteName.replace('#', '');
    var isSharp = noteName.indexOf('#') >= 0;

    // Find vertical position: C4 at bottom (below staff), G4 at line 5
    // For a standard treble clef:
    // Line 1 (bottom): E4
    // Line 2: G4
    // Line 3: B4
    // Line 4: D5
    // Line 5 (top): F5
    // Space 1 (bottom): F4
    // Space 2: A4
    // Space 3: C5
    // Space 4: E5

    // We map all notes relative to E4 (bottom line = 0)
    var e4Midi = 64; // E4
    var g4Midi = 67; // G4
    var e4Y = top + LINE_SPACING * 4; // E4 at bottom line

    // Parse note
    var notePart = noteName.replace('#', '');
    var octave = parseInt(noteName.replace(notePart, ''));
    var noteIndex = noteNames.indexOf(notePart);
    var midi = (octave + 1) * 12 + noteIndex;

    // Position relative to E4
    var stepsFromE4 = midi - e4Midi;
    // Each staff step (line/space) is a semitone for natural notes
    // but we need to account for sharps - they occupy the same line/space as natural
    // Sharps raise by half a line spacing

    var isWhite = noteIndex % 2 === 0 || noteIndex === 2 || noteIndex === 5; // C,D,F,G,A,B are white keys
    // Actually for position on staff, sharps don't change line position for readability
    // We'll treat sharps same as natural for display

    // Staff positions for natural notes (from bottom line E4):
    // E4=0, F4=0.5, G4=1, A4=1.5, B4=2, C5=2.5, D5=3, E5=3.5, F5=4, G5=4.5, A5=5, B5=5.5, C6=6
    // E4=0, F4=1, G4=2, A4=3, B4=4, C5=5, D5=6, E5=7, F5=8, G5=9, A5=10, B5=11, C6=12
    // Each step = LINE_SPACING / 2

    var noteToStep = {
      'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11
    };

    var step = noteToStep[notePart] || 0;
    var yOffset = ((step - 4) * (LINE_SPACING / 2)); // relative to G4 (step 7 = G4)
    var y = e4Y + (step - 4) * (LINE_SPACING / 2);

    // Clamp
    y = Math.max(top - LINE_SPACING * 2, Math.min(top + LINE_SPACING * 4, y));

    return { x: Math.min(x, w - 30), y: y };
  }

  function drawNote(noteName, x, y, isCurrent) {
    var top = canvas.height / 2 - LINE_SPACING * 2;

    // Note head
    ctx.beginPath();
    if (isCurrent) {
      ctx.fillStyle = '#FFD700';
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 12;
    } else {
      ctx.fillStyle = 'rgba(136,170,204,0.4)';
      ctx.shadowBlur = 0;
    }
    ctx.ellipse(x, y, NOTE_RADIUS, NOTE_RADIUS * 0.75, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Add ledger lines if needed
    if (y > top + LINE_SPACING * 4) {
      // Below staff
      var topLine = top + LINE_SPACING * 4;
      for (var ly = topLine + LINE_SPACING; ly <= y + LINE_SPACING; ly += LINE_SPACING) {
        ctx.strokeStyle = '#446688';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - NOTE_RADIUS - 5, ly);
        ctx.lineTo(x + NOTE_RADIUS + 5, ly);
        ctx.stroke();
      }
    }
    if (y < top) {
      // Above staff
      var bottomLine = top;
      for (var ly = bottomLine - LINE_SPACING; ly >= y - LINE_SPACING; ly -= LINE_SPACING) {
        ctx.strokeStyle = '#446688';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - NOTE_RADIUS - 5, ly);
        ctx.lineTo(x + NOTE_RADIUS + 5, ly);
        ctx.stroke();
      }
    }
  }

  function drawEmpty() {
    if (!ctx) return;
    var w = canvas.width || 400;
    var h = canvas.height || 100;
    ctx.fillStyle = '#0D1525';
    ctx.fillRect(0, 0, w, h);
    var top = h / 2 - LINE_SPACING * 2;
    for (var i = 0; i < LINE_COUNT; i++) {
      ctx.strokeStyle = '#446688';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(STAFF_MARGIN - 10, top + i * LINE_SPACING);
      ctx.lineTo(w - 20, top + i * LINE_SPACING);
      ctx.stroke();
    }
    ctx.fillStyle = '#88AACC';
    ctx.font = 'bold 48px serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('𝄞', STAFF_MARGIN - 40, top + LINE_SPACING * 2);
  }

  return {
    init: init, loadSong: loadSong, setIndex: setIndex,
    getCurrentNote: getCurrentNote, getNextNote: getNextNote,
    draw: draw, drawEmpty: drawEmpty
  };
})();