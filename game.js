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
  let cellEls = []; // [r][c] -> div (한 번만 생성, 절대 재생성하지 않음)

  const gridEl = $('grid'), trayEl = $('tray');

  function loadBest() {
    try { return parseInt(localStorage.getItem('bbm_best') || '0', 10) || 0; }
    catch (e) { return 0; }
  }
  function saveBest(v) {
    try { localStorage.setItem('bbm_best', String(v)); } catch (e) { /* 무시 */ }
  }

  function init() {
    grid = Array.from({ length: N }, () => Array(N).fill(null));
    tray = []; selected = null; score = 0;
    best = loadBest();
    $('best').textContent = best;
    $('score').textContent = '0';
    $('overlay').classList.add('hidden');
    buildGrid();    // 셀 div는 최초 1회만 생성
    refreshGrid();  // 이후엔 색상/클래스만 갱신
    dealTray();
  }

  /**
   * 셀 div를 한 번만 만들고 리스너를 부착한다.
   * (버그 수정) 예전에는 호버할 때마다 64개 셀을 전부 재생성했는데,
   * 터치 기기에서 탭 도중 요소가 교체되면 click 이벤트가 유실되어
   * 블록을 놓을 수 없었다. 이제 DOM은 그대로 두고 클래스만 토글한다.
   */
  function buildGrid() {
    gridEl.innerHTML = '';
    cellEls = [];
    for (let r = 0; r < N; r++) {
      const row = [];
      for (let c = 0; c < N; c++) {
        const d = document.createElement('div');
        d.className = 'cell';
        d.addEventListener('click', () => onCellClick(r, c));
        d.addEventListener('mouseenter', () => showGhost(r, c));
        gridEl.appendChild(d);
        row.push(d);
      }
      cellEls.push(row);
    }
  }

  /** DOM 재생성 없이 색상과 고스트만 갱신 */
  function refreshGrid() {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const d = cellEls[r][c];
      d.style.background = grid[r][c] || '';
      d.classList.remove('ghost');
    }
  }

  function clearGhost() {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      cellEls[r][c].classList.remove('ghost');
    }
  }

  function showGhost(r, c) {
    clearGhost();
    if (selected == null) return;
    const p = tray[selected];
    if (!p || p.used || !canPlace(p.shape, r, c)) return;
    p.shape.forEach(([x, y]) => {
      const rr = r + y, cc = c + x;
      if (!grid[rr][cc]) cellEls[rr][cc].classList.add('ghost');
    });
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
        drawTray(); clearGhost();
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

  function onCellClick(r, c) {
    if (selected == null) return;
    const p = tray[selected];
    if (p.used || !canPlace(p.shape, r, c)) return;
    p.shape.forEach(([x, y]) => { grid[r + y][c + x] = p.color; });
    p.used = true;
    score += p.shape.length;
    selected = null;
    const cleared = clearLines();
    refreshGrid();
    // 지워진 셀에만 터지는 애니메이션
    if (cleared.length) {
      cleared.forEach(([rr, cc]) => cellEls[rr][cc].classList.add('clearing'));
      setTimeout(() => cleared.forEach(([rr, cc]) => cellEls[rr][cc].classList.remove('clearing')), 350);
    }
    $('score').textContent = score;
    if (tray.every((t) => t.used)) dealTray();
    else drawTray();
    if (!anyMovePossible()) gameOver();
  }

  /** 가득 찬 줄을 지우고, 지워진 셀 좌표 목록 반환 */
  function clearLines() {
    const fullR = [], fullC = [];
    for (let r = 0; r < N; r++) if (grid[r].every(Boolean)) fullR.push(r);
    for (let c = 0; c < N; c++) if (grid.every((row) => row[c])) fullC.push(c);
    const cleared = [];
    const mark = (r, c) => {
      if (grid[r][c] && !cleared.some(([rr, cc]) => rr === r && cc === c)) cleared.push([r, c]);
    };
    fullR.forEach((r) => { for (let c = 0; c < N; c++) mark(r, c); grid[r].fill(null); });
    fullC.forEach((c) => { for (let r = 0; r < N; r++) mark(r, c); grid.forEach((row) => { row[c] = null; }); });
    const n = fullR.length + fullC.length;
    if (n) score += n * n * 10;
    return cleared;
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
    if (isBest) { best = score; saveBest(best); }
    $('finalScore').textContent = score;
    $('best').textContent = best;
    $('newBest').classList.toggle('hidden', !isBest);
    $('overlay').classList.remove('hidden');
  }

  $('resetBtn').addEventListener('click', init);
  $('againBtn').addEventListener('click', init);
  gridEl.addEventListener('mouseleave', clearGhost);
  init();
})();
