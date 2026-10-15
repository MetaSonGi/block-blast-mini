/* 블록 블라스트 미니 — 2026 트렌드 Block 메카닉
 * v2: 줄 삭제 후 중력 적용 + 드래그 앤 드롭 배치 + 관대한 놓기 판정
 */
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
  let dragState = null;
  let suppressClick = false; // 드래그 직후 따라오는 click 무시용

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
        d.addEventListener('click', () => onCellTap(r, c));
        d.addEventListener('mouseenter', () => {
          if (!(dragState && dragState.active)) previewAt(r, c);
        });
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

  function shapeSize(shape) {
    return {
      rows: Math.max(...shape.map((s) => s[1])) + 1,
      cols: Math.max(...shape.map((s) => s[0])) + 1,
    };
  }

  function canPlace(shape, r0, c0) {
    return shape.every(([x, y]) => {
      const r = r0 + y, c = c0 + x;
      return r >= 0 && r < N && c >= 0 && c < N && !grid[r][c];
    });
  }

  /**
   * 관대한 놓기 판정: 탭/드롭한 칸을 기준으로 놓을 수 있는
   * 가장 가까운 앵커를 찾는다 (탭 위치 → 도형 중심 → 주변 2칸).
   */
  function findAnchor(shape, r, c) {
    const { rows, cols } = shapeSize(shape);
    const cand = [[r, c], [r - (rows >> 1), c - (cols >> 1)]];
    for (let d = 1; d <= 2; d++) {
      for (let dr = -d; dr <= d; dr++) {
        for (let dc = -d; dc <= d; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== d) continue;
          cand.push([r + dr, c + dc]);
        }
      }
    }
    const seen = new Set();
    for (const [rr, cc] of cand) {
      const k = rr + ',' + cc;
      if (seen.has(k)) continue;
      seen.add(k);
      if (canPlace(shape, rr, cc)) return { r: rr, c: cc };
    }
    return null;
  }

  /** 고스트 미리보기 (관대한 앵커 기준) */
  function previewAt(r, c) {
    clearGhost();
    if (selected == null) return;
    const p = tray[selected];
    if (!p || p.used) return;
    const a = findAnchor(p.shape, r, c);
    if (!a) return;
    p.shape.forEach(([x, y]) => cellEls[a.r + y][a.c + x].classList.add('ghost'));
  }

  function dealTray() {
    tray = [];
    for (let i = 0; i < 3; i++) {
      tray.push({
        shape: SHAPES[(Math.random() * SHAPES.length) | 0],
        color: COLORS[(Math.random() * COLORS.length) | 0],
        used: false,
      });
    }
    buildTray();
  }

  function makePieceEl(p) {
    const d = document.createElement('div');
    d.className = 'piece' + (p.used ? ' used' : '');
    const { rows, cols } = shapeSize(p.shape);
    d.style.gridTemplateColumns = `repeat(${cols}, 22px)`;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      const on = p.shape.some(([x, y]) => x === c && y === r);
      cell.className = 'pcell' + (on ? '' : ' empty');
      if (on) cell.style.background = p.color;
      d.appendChild(cell);
    }
    return d;
  }

  /**
   * 트레이 DOM은 새로 딜할 때만 만든다.
   * 선택 토글은 클래스만 바꿔서, 탭 도중 요소 교체로 click이
   * 유실되는 문제를 원천 차단한다.
   */
  function buildTray() {
    trayEl.innerHTML = '';
    tray.forEach((p, i) => {
      const d = makePieceEl(p);
      d.addEventListener('click', () => onPieceTap(i));
      d.addEventListener('pointerdown', (e) => onPiecePointerDown(e, i));
      trayEl.appendChild(d);
    });
    updateTray();
  }

  function updateTray() {
    Array.prototype.forEach.call(trayEl.children, (d, i) => {
      d.classList.toggle('used', !!tray[i].used);
      d.classList.toggle('selected', selected === i && !tray[i].used);
    });
  }

  function onPieceTap(i) {
    if (suppressClick) return;
    const p = tray[i];
    if (!p || p.used) return;
    selected = (selected === i) ? null : i;
    updateTray();
    clearGhost();
  }

  /* ---------------- 드래그 앤 드롭 ---------------- */

  function onPiecePointerDown(e, i) {
    const p = tray[i];
    if (!p || p.used) return;
    dragState = { idx: i, sx: e.clientX, sy: e.clientY, active: false, el: null, anchor: null };
    window.addEventListener('pointermove', onDragMove, { passive: false });
    window.addEventListener('pointerup', onDragEnd);
    window.addEventListener('pointercancel', onDragEnd);
  }

  function onDragMove(e) {
    const st = dragState;
    if (!st) return;
    if (!st.active) {
      if (Math.hypot(e.clientX - st.sx, e.clientY - st.sy) < 10) return;
      st.active = true;
      st.el = makePieceEl(tray[st.idx]);
      st.el.classList.add('dragging');
      document.body.appendChild(st.el);
      selected = st.idx;
      updateTray();
    }
    if (e.cancelable) e.preventDefault();
    st.el.style.left = e.clientX + 'px';
    st.el.style.top = e.clientY + 'px';
    clearGhost();
    st.anchor = null;
    const cell = cellFromPoint(e.clientX, e.clientY);
    if (cell) {
      const p = tray[st.idx];
      const a = findAnchor(p.shape, cell.r, cell.c);
      if (a) {
        p.shape.forEach(([x, y]) => cellEls[a.r + y][a.c + x].classList.add('ghost'));
        st.anchor = a;
      }
    }
  }

  function onDragEnd() {
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragEnd);
    window.removeEventListener('pointercancel', onDragEnd);
    const st = dragState;
    dragState = null;
    if (!st) return;
    if (st.el) st.el.remove();
    clearGhost();
    if (!st.active) return; // 그냥 탭 → click 핸들러가 처리
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 100);
    if (st.anchor) placePiece(st.idx, st.anchor.r, st.anchor.c);
    else { selected = st.idx; updateTray(); } // 드롭 실패 → 선택 유지
  }

  function cellFromPoint(x, y) {
    const rect = gridEl.getBoundingClientRect();
    const pad = 10, gap = 4;
    const pitch = (rect.width - pad * 2 + gap) / N;
    const c = Math.floor((x - rect.left - pad) / pitch);
    const r = Math.floor((y - rect.top - pad) / pitch);
    if (r < 0 || r >= N || c < 0 || c >= N) return null;
    return { r, c };
  }

  /* ---------------- 배치 + 줄 삭제 + 중력 ---------------- */

  function onCellTap(r, c) {
    if (selected == null) return;
    const p = tray[selected];
    if (!p || p.used) return;
    const a = findAnchor(p.shape, r, c);
    if (!a) {
      // 놓을 수 없으면 빨간 플래시로 피드백
      cellEls[r][c].classList.add('invalid');
      setTimeout(() => cellEls[r][c].classList.remove('invalid'), 260);
      return;
    }
    placePiece(selected, a.r, a.c);
  }

  function placePiece(idx, r, c) {
    const p = tray[idx];
    if (!p || p.used || !canPlace(p.shape, r, c)) return false;
    p.shape.forEach(([x, y]) => { grid[r + y][c + x] = p.color; });
    p.used = true;
    score += p.shape.length;
    selected = null;
    const cleared = clearLines();
    refreshGrid();
    updateTray();
    $('score').textContent = score;
    const finish = () => {
      if (tray.every((t) => t.used)) dealTray();
      else updateTray();
      if (!anyMovePossible()) gameOver();
    };
    if (cleared.length) {
      // 1) 지워지는 애니메이션 → 2) 중력 낙하 → 3) 착지 바운스
      cleared.forEach(([rr, cc]) => cellEls[rr][cc].classList.add('clearing'));
      setTimeout(() => {
        cleared.forEach(([rr, cc]) => cellEls[rr][cc].classList.remove('clearing'));
        const moved = applyGravity();
        refreshGrid();
        if (moved.length) {
          moved.forEach(([rr, cc]) => cellEls[rr][cc].classList.add('landed'));
          setTimeout(() => moved.forEach(([rr, cc]) => cellEls[rr][cc].classList.remove('landed')), 320);
        }
        finish();
      }, 380);
    } else {
      finish();
    }
    return true;
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

  /**
   * 중력: 각 열의 블록을 아래로 모은다.
   * 이동한 셀 좌표 목록을 반환 (착지 애니메이션용).
   */
  function applyGravity() {
    const moved = [];
    for (let c = 0; c < N; c++) {
      let write = N - 1;
      for (let r = N - 1; r >= 0; r--) {
        if (grid[r][c]) {
          if (write !== r) {
            grid[write][c] = grid[r][c];
            grid[r][c] = null;
            moved.push([write, c]);
          }
          write--;
        }
      }
    }
    return moved;
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

  // 로직 단위 테스트용 노출
  window.__bbm = {
    applyGravity, findAnchor, canPlace, clearLines,
    get grid() { return grid; },
    set grid(v) { grid = v; },
    get score() { return score; },
    newGrid() { grid = Array.from({ length: N }, () => Array(N).fill(null)); },
  };
})();
