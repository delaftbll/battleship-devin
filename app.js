(() => {
  const GRID = 10;
  const SHIPS = [
    { name: "Carrier", size: 5 },
    { name: "Battleship", size: 4 },
    { name: "Cruiser", size: 3 },
    { name: "Submarine", size: 3 },
    { name: "Destroyer", size: 2 },
  ];

  const el = (q) => document.querySelector(q);
  const playerBoardEl = el('#playerBoard');
  const aiBoardEl = el('#aiBoard');
  const statusEl = el('#status');
  const newGameBtn = el('#newGameBtn');
  const reshuffleBtn = el('#reshuffleBtn');
  const voiceBtn = el('#voiceBtn');
  const themeToggle = el('#themeToggle');

  const statsEls = {
    games: el('#sGames'),
    wins: el('#sWins'),
    rate: el('#sRate'),
    avgTurns: el('#sAvgTurns'),
  };

  const LS_KEY = 'battleship_devin_stats';

  let game = null;

  function init() {
    initTheme();
    wireUI();
    loadStats();
    renderEmptyBoards();
    status('Welcome! Click New Game to begin.');
    createGameEndModal();
  }

  function wireUI() {
    themeToggle.addEventListener('click', toggleTheme);
    newGameBtn.addEventListener('click', startGame);
    reshuffleBtn.addEventListener('click', () => {
      if (!game || game.started) return;
      placeAllShips(game.player);
      drawBoards();
      status('Your fleet was reshuffled.');
    });
    aiBoardEl.addEventListener('click', (e) => {
      const cell = e.target.closest('.cell');
      if (!cell) return;
      const r = +cell.dataset.r, c = +cell.dataset.c;
      playerFire(r,c);
    });
    aiBoardEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const cell = e.target.closest('.cell');
        if (!cell) return;
        const r = +cell.dataset.r, c = +cell.dataset.c;
        playerFire(r,c);
      }
    });
    setupVoice();
  }

  function status(msg) { statusEl.innerHTML = msg; }

  function renderEmptyBoards() {
    renderBoard(playerBoardEl, emptyMatrix(), false);
    renderBoard(aiBoardEl, emptyMatrix(), true);
  }

  function emptyMatrix() {
    return Array.from({length: GRID}, () => Array.from({length: GRID}, () => ({
      ship: null, hit:false, miss:false, tried:false
    })));
  }

  function startGame() {
    game = {
      player: { grid: emptyMatrix(), ships: [], fleetSunk:0 },
      ai:     { grid: emptyMatrix(), ships: [], fleetSunk:0 },
      turn: 'player',
      started: false,
      over: false,
      playerTurns: 0,
      aiTargets: [], // queue of target cells
      aiTried: new Set(), // "r,c" strings
      aiLastHit: null,
    };
    // place ships for both
    placeAllShips(game.player);
    placeAllShips(game.ai);
    game.started = false;
    drawBoards();
    status('Game ready. You can <strong>Reshuffle</strong> before your first shot. When ready, target the enemy grid.');
    reshuffleBtn.disabled = false;
  }

  function placeAllShips(side) {
    side.grid = emptyMatrix();
    side.ships = [];
    SHIPS.forEach((spec, idx) => {
      let placed = false;
      while(!placed) {
        const horizontal = Math.random() < 0.5;
        const r = rand(0, GRID-1);
        const c = rand(0, GRID-1);
        if (canPlace(side.grid, r, c, spec.size, horizontal)) {
          const cells = [];
          for (let i=0;i<spec.size;i++) {
            const rr = r + (horizontal?0:i);
            const cc = c + (horizontal?i:0);
            side.grid[rr][cc].ship = idx;
            cells.push([rr,cc]);
          }
          side.ships[idx] = { id: idx, ...spec, cells, hits:0, sunk:false };
          placed = true;
        }
      }
    });
  }

  function canPlace(grid, r, c, size, horizontal) {
    const endR = r + (horizontal?0:size-1);
    const endC = c + (horizontal?size-1:0);
    if (endR >= GRID || endC >= GRID) return false;
    for (let i=0;i<size;i++) {
      const rr = r + (horizontal?0:i);
      const cc = c + (horizontal?i:0);
      if (grid[rr][cc].ship !== null) return false;
    }
    return true;
  }

  function drawBoards() {
    renderBoard(playerBoardEl, game.player.grid, false);
    renderBoard(aiBoardEl, game.ai.grid, true);
  }

  function renderBoard(container, grid, hideShips) {
    container.innerHTML = '';
    container.style.setProperty('--size', GRID);
    
    const emptyCorner = document.createElement('div');
    emptyCorner.className = 'grid-header';
    emptyCorner.style.gridRow = '1';
    emptyCorner.style.gridColumn = '1';
    container.appendChild(emptyCorner);
    
    for (let c = 0; c < GRID; c++) {
      const colHeader = document.createElement('div');
      colHeader.className = 'grid-header col';
      colHeader.textContent = String.fromCharCode(65 + c);
      colHeader.style.gridRow = '1';
      colHeader.style.gridColumn = `${c + 2}`;
      container.appendChild(colHeader);
    }
    
    for (let r = 0; r < GRID; r++) {
      const rowHeader = document.createElement('div');
      rowHeader.className = 'grid-header row';
      rowHeader.textContent = `${r + 1}`;
      rowHeader.style.gridRow = `${r + 2}`;
      rowHeader.style.gridColumn = '1';
      container.appendChild(rowHeader);
    }
    
    for (let r=0;r<GRID;r++) {
      for (let c=0;c<GRID;c++) {
        const d = grid[r][c];
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.tabIndex = 0;
        cell.style.gridRow = `${r + 2}`;
        cell.style.gridColumn = `${c + 2}`;
        const label = coordLabel(r,c);
        cell.title = label;
        if (d.ship !== null && !hideShips) cell.classList.add('ship');
        if (d.hit) cell.classList.add('hit');
        if (d.miss) cell.classList.add('miss');
        if (d.ship !== null) {
          const s = getShipById(grid, d.ship);
          if (s && s.sunk) cell.classList.add('sunk');
        }
        container.appendChild(cell);
      }
    }
  }

  function coordLabel(r,c) { return String.fromCharCode(65+c) + (r+1); }
  function coordFromLabel(label) {
    const m = label.trim().toUpperCase().match(/^([A-J])\s*(10|[1-9])$/);
    if (!m) return null;
    const c = m[1].charCodeAt(0) - 65;
    const r = parseInt(m[2],10) - 1;
    if (r<0||r>=GRID||c<0||c>=GRID) return null;
    return [r,c];
  }

  function getShipById(grid, id) {
    // Find ship cells and compute from side.ships in game object
    const side = (grid === game.player.grid) ? game.player : game.ai;
    return side.ships[id];
  }

  function playerFire(r,c) {
    if (!game || game.over) return;
    if (!game.started) { game.started = true; reshuffleBtn.disabled = true; }
    if (game.turn !== 'player') return;
    const cell = game.ai.grid[r][c];
    if (cell.hit || cell.miss) { status('You already tried ' + coordLabel(r,c) + '.'); return; }
    game.playerTurns++;
    const hit = applyShot(game.ai, r, c);
    drawBoards();
    if (checkGameOver()) return;
    if (hit) {
      status(`🎯 Hit at <strong>${coordLabel(r,c)}</strong> — take another shot!`);
      // Allow extra shot on hit (house rule for fun)
      return;
    } else {
      status(`Splash at ${coordLabel(r,c)}. Enemy's turn…`);
      game.turn = 'ai';
      setTimeout(aiTurn, 500);
    }
  }

  function applyShot(side, r, c) {
    const cell = side.grid[r][c];
    if (cell.ship !== null) {
      cell.hit = true;
      const ship = side.ships[cell.ship];
      ship.hits++;
      if (ship.hits === ship.size) {
        ship.sunk = true;
        side.fleetSunk++;
        status(`<strong>${ship.name}</strong> sunk!`);
        setTimeout(() => animateShipSunk(ship, side), 100);
      }
      return true;
    } else {
      cell.miss = true;
      return false;
    }
  }

  function checkGameOver() {
    if (game.player.fleetSunk === SHIPS.length) {
      game.over = true;
      status('💥 Your fleet is destroyed. You lose.');
      finalizeStats(false);
      setTimeout(() => showGameEndModal(false), 500);
      return true;
    }
    if (game.ai.fleetSunk === SHIPS.length) {
      game.over = true;
      status('🏆 You sank all enemy ships. You win!');
      finalizeStats(true);
      setTimeout(() => showGameEndModal(true), 500);
      return true;
    }
    return false;
  }

  function aiTurn() {
    if (game.over) return;
    const [r,c] = pickAiTarget();
    const hit = applyShot(game.player, r, c);
    drawBoards();
    if (checkGameOver()) return;
    if (hit) {
      status(`Enemy hit your ship at <strong>${coordLabel(r,c)}</strong>!`);
      enqueueNeighbors(r,c);
      // AI also gets an extra shot on hit
      setTimeout(aiTurn, 500);
    } else {
      status(`Enemy missed at ${coordLabel(r,c)}. Your turn.`);
      game.turn = 'player';
    }
  }

  function pickAiTarget() {
    // If we have queued targets, pop from front
    while (game.aiTargets.length) {
      const [r,c] = game.aiTargets.shift();
      const key = r+','+c;
      if (!game.aiTried.has(key) && inBounds(r,c)) {
        game.aiTried.add(key);
        return [r,c];
      }
    }
    // otherwise random unseen
    let r, c, key;
    do {
      r = rand(0, GRID-1);
      c = rand(0, GRID-1);
      key = r+','+c;
    } while (game.aiTried.has(key));
    game.aiTried.add(key);
    return [r,c];
  }

  function enqueueNeighbors(r,c) {
    const deltas = [[1,0],[-1,0],[0,1],[0,-1]];
    deltas.forEach(([dr,dc]) => {
      const rr=r+dr, cc=c+dc;
      if (inBounds(rr,cc)) game.aiTargets.push([rr,cc]);
    });
  }

  function inBounds(r,c){ return r>=0 && r<GRID && c>=0 && c<GRID; }
  function rand(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }

  // === Analytics ===
  function loadStats() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return updateStatsUI({games:0,wins:0,totalTurns:0});
      const s = JSON.parse(raw);
      updateStatsUI(s);
    } catch(e){ /* ignore */ }
  }
  function finalizeStats(win) {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const s = raw? JSON.parse(raw) : {games:0,wins:0,totalTurns:0};
      s.games += 1;
      if (win) s.wins += 1;
      s.totalTurns += game.playerTurns;
      localStorage.setItem(LS_KEY, JSON.stringify(s));
      updateStatsUI(s);
    } catch(e){ /* ignore */ }
  }
  function updateStatsUI(s) {
    statsEls.games.textContent = s.games||0;
    statsEls.wins.textContent = s.wins||0;
    const rate = (s.games? Math.round((s.wins/s.games)*100):0) + '%';
    statsEls.rate.textContent = rate;
    const avg = (s.games? (s.totalTurns/s.games).toFixed(1): '—');
    statsEls.avgTurns.textContent = avg;
  }

  // === Voice Commands ===
  let recognition = null;
  let listening = false;
  function setupVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      voiceBtn.disabled = true;
      voiceBtn.textContent = '🎙️ Voice: Unavailable';
      return;
    }
    recognition = new SR();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = true;

    recognition.onresult = (e) => {
      const last = e.results[e.results.length-1][0].transcript.trim();
      const m = /([A-Ja-j])\s*(10|[1-9])/i.exec(last);
      if (m) {
        const coord = (m[1].toUpperCase() + m[2]);
        const rc = coordFromLabel(coord);
        if (rc) {
          status('Voice command: firing at <strong>'+coord+'</strong>');
          playerFire(rc[0], rc[1]);
        }
      } else {
        status('Voice heard: "' + last + '". Say for example: "Fire at B5".');
      }
    };
    recognition.onend = () => {
      if (listening) recognition.start();
    };

    voiceBtn.addEventListener('click', () => {
      listening = !listening;
      voiceBtn.setAttribute('aria-pressed', String(listening));
      voiceBtn.textContent = listening? '🎙️ Voice: On' : '🎙️ Voice: Off';
      if (listening) recognition.start(); else recognition.stop();
    });
  }

  function initTheme() {
    const saved = localStorage.getItem('battleship_theme');
    const theme = saved || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    applyTheme(theme);
  }
  
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = themeToggle.querySelector('.theme-icon');
    if (icon) {
      icon.textContent = theme === 'light' ? '🌙' : '☀️';
    }
  }
  
  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'light' ? 'dark' : 'light';
    applyTheme(next);
    localStorage.setItem('battleship_theme', next);
  }

  function animateShipSunk(ship, side) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    
    const boardEl = (side === game.player) ? playerBoardEl : aiBoardEl;
    ship.cells.forEach(([r, c]) => {
      const cell = boardEl.querySelector(`[data-r="${r}"][data-c="${c}"]`);
      if (cell) {
        cell.classList.add('ship-sunk');
        setTimeout(() => cell.classList.remove('ship-sunk'), 600);
      }
    });
  }

  let gameEndModal = null;
  
  function createGameEndModal() {
    const modalHTML = `
      <div id="game-end-modal" class="modal-overlay" role="dialog" aria-labelledby="modal-title" aria-modal="true">
        <div class="modal">
          <h2 id="modal-title"></h2>
          <p id="modal-content"></p>
          <div class="buttons">
            <button id="play-again-btn" class="primary">Play Again</button>
            <button id="share-btn" class="secondary">Share</button>
          </div>
        </div>
        <div class="confetti-container" id="confetti-container"></div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    gameEndModal = el('#game-end-modal');
    
    el('#play-again-btn').addEventListener('click', () => {
      hideGameEndModal();
      startGame();
    });
    
    el('#share-btn').addEventListener('click', () => {
      const url = window.location.href;
      const text = `I just played Battleship! Check it out: ${url}`;
      
      if (navigator.share) {
        navigator.share({ title: 'Battleship Game', text, url });
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
        status('Game link copied to clipboard!');
      } else {
        prompt('Copy this link:', url);
      }
    });
    
    gameEndModal.addEventListener('click', (e) => {
      if (e.target === gameEndModal) hideGameEndModal();
    });
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && gameEndModal.classList.contains('show')) {
        hideGameEndModal();
      }
    });
  }
  
  function showGameEndModal(won) {
    const title = el('#modal-title');
    const content = el('#modal-content');
    
    if (won) {
      title.textContent = '🎉 Victory!';
      content.textContent = `You won in ${game.playerTurns} turns!`;
      showConfetti();
    } else {
      title.textContent = '💥 Defeat';
      content.textContent = `The AI won. Better luck next time!`;
    }
    
    gameEndModal.classList.add('show');
    trapFocus();
  }
  
  function hideGameEndModal() {
    gameEndModal.classList.remove('show');
    clearConfetti();
  }
  
  function showConfetti() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    
    const container = el('#confetti-container');
    for (let i = 0; i < 50; i++) {
      setTimeout(() => {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.animationDelay = Math.random() * 3 + 's';
        container.appendChild(confetti);
        
        setTimeout(() => {
          if (confetti.parentNode) {
            confetti.parentNode.removeChild(confetti);
          }
        }, 3000);
      }, i * 50);
    }
  }
  
  function clearConfetti() {
    const container = el('#confetti-container');
    if (container) container.innerHTML = '';
  }
  
  function trapFocus() {
    const focusableElements = gameEndModal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    firstElement.focus();

    const handleTabKey = (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    gameEndModal.addEventListener('keydown', handleTabKey);
  }

  // start
  init();
})();
