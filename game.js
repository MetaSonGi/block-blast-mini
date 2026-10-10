/* 블록 블라스트 미니 — 2026 트렌드 Block 메카닉 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const N = 8;
  const SHAPES = [
    [[0,0]], [[0,0],[1,0]], [[0,0],[0,1]],
    [[0,0],[1,0],[2,0]], [[0,0],[0,1],[0,2]],
    [[0,0],[1,0],[0,1],[1,1]],
    [[0,0],[1,0],[2,0],[2,1]], [[0,0],[0,1],[0,2],[1,2]],
    [[0,0],[1,0],[2,0],[3,0]], [[0,0],[0,1],[0,2],[0,3]],
    [[0,0],[1,0],[2,0],[1,1]],
    [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]],
    [[0,0],[1,0],[0,1],[1,1],[2,0],[2,1]],
    [[0,1],[1,0],[1,1],[1,2]], [[0,0],[1,0],[1,1],[2,1]],
  ];
  const COLORS = ['#2f81f7', '#00d4aa', '#ffb020', '#f85149', '#a06bff', '#ff7ab8'];

  let grid, tray, selected, score, best;

  const gridEl = $('grid'), trayEl = $('tray');

  function init() {
    grid = Array.from({ length: N }, () => Array(N).fill(null));
    tray = []; selected = null; score = 0;
    best = parseInt(localStorage.getItem('bbm_best') || '0', 10);
    $('best').textContent = best;
    $('score').textContent = '0';
    $('overlay').classList.add('hidden');
    drawGrid();
    dealTray();
  }

  function drawGrid(ghostCells) {
    gridEl.innerHTML = '';
    const ghost = new Set((ghostCells || []).map(([r, c]) => r * N + c));
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const d = document.createElement('div');
      d.className = 'cell';
      if (grid[r][c]) d.style.background = grid[r][c];
      if (ghost.has(r * N + c) && !grid[r][c]) d.classList.add('ghost');
      d.addEventListener('click', () => onCellClick(r, c));
      d.addEventListener('mouseenter', () => showGhost(r, c));
      gridEl.appendChild(d);
    }
  }

  function dealTray() {
    tray = [];
    for (let i = 0; i < 3; i++) {
      tray.push({
        shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        used: false,
      });
    }
    drawTray();
  }

  function drawTray() {
    trayEl.innerHTML = '';
    tray.forEach((p, i) => {
      const d = document.createElement('div');
      d.className = 'piece' + (p.used ? ' used' : '') + (selected === i ? ' selected' : '');
      const rows = Math.max(...p.shape.map((s) => s[1])) + 1;
      const cols = Math.max(...p.shape.map((s) => s[0])) + 1;
      d.style.gridTemplateColumns = `repeat(${cols}, 22px)`;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const cell = document.createElement('div');
        const on = p.shape.some(([x, y]) => x === c && y === r);
        cell.className = 'pcell' + (on ? '' : ' empty');
        if (on) cell.style.background = p.color;
        d.appendChild(cell);
      }
      d.addEventListener('click', () => {
        if (p.used) return;
        selected = (selected === i) ? null : i;
        drawTray(); drawGrid();
      });
      trayEl.appendChild(d);
    });
  }

  function canPlace(shape, r0, c0) {
    return shape.every(([x, y]) => {
      const r = r0 + y, c = c0 + x;
      return r >= 0 && r < N && c >= 0 && c < N && !grid[r][c];
    });
  }

  function showGhost(r, c) {
    if (selected == null) return;
    const p = tray[selected];
    if (p.used || !canPlace(p.shape, r, c)) { drawGrid(); return; }
    drawGrid(p.shape.map(([x, y]) => [r + y, c + x]));
  }

  function onCellClick(r, c) {
    if (selected == null) return;
    const p = tray[selected];
    if (p.used || !canPlace(p.shape, r, c)) return;
    p.shape.forEach(([x, y]) => { grid[r + y][c + x] = p.color; });
    p.used = true;
    score += p.shape.length;
    selected = null;
    clearLines();
    $('score').textContent = score;
    if (tray.every((t) => t.used)) dealTray();
    else drawTray();
    drawGrid();
    if (!anyMovePossible()) gameOver();
  }

  function clearLines() {
    const fullR = [], fullC = [];
    for (let r = 0; r < N; r++) if (grid[r].every(Boolean)) fullR.push(r);
    for (let c = 0; c < N; c++) if (grid.every((row) => row[c])) fullC.push(c);
    const n = fullR.length + fullC.length;
    if (!n) return;
    fullR.forEach((r) => grid[r].fill(null));
    fullC.forEach((c) => grid.forEach((row) => { row[c] = null; }));
    score += n * n * 10;
    // 터지는 셀 애니메이션
    drawGrid();
    document.querySelectorAll('.cell').forEach((el) => el.classList.add('clearing'));
  }

  function anyMovePossible() {
    return tray.some((p) => {
      if (p.used) return false;
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        if (canPlace(p.shape, r, c)) return true;
      }
      return false;
    });
  }

  function gameOver() {
    const isBest = score > best;
    if (isBest) { best = score; localStorage.setItem('bbm_best', best); }
    $('finalScore').textContent = score;
    $('best').textContent = best;
    $('newBest').classList.toggle('hidden', !isBest);
    $('overlay').classList.remove('hidden');
  }

  $('resetBtn').addEventListener('click', init);
  $('againBtn').addEventListener('click', init);
  gridEl.addEventListener('mouseleave', () => drawGrid());
  init();
})();
