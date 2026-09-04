/**
 * Blockdown - Main Application Entry Point
 * Orchestrates Game Engine, Renderer, Retro Audio, AI Demo Mode, and User Inputs.
 */

import { BlockdownGame } from './game.js';
import { GameRenderer } from './renderer.js';
import { RetroAudio } from './audio.js';
import { BlockdownAI } from './ai.js';
import { Marquee3D } from './marquee3d.js';

window.addEventListener('DOMContentLoaded', () => {
    // --- Canvas and Audio Setup ---
    const pitCanvas = document.getElementById('pitCanvas');
    const nextCanvas = document.getElementById('nextCanvas');
    const marqueeCanvas = document.getElementById('marqueeCanvas');

    const audio = new RetroAudio();
    const renderer = new GameRenderer(pitCanvas, nextCanvas);
    const ai = new BlockdownAI();
    const marquee = new Marquee3D(marqueeCanvas);

    // --- DOM Elements ---
    const levelDisplay = document.getElementById('levelDisplay');
    const layerProgressDisplay = document.getElementById('layerProgressDisplay');
    const scoreDisplay = document.getElementById('scoreDisplay');
    const cubesDisplay = document.getElementById('cubesDisplay');
    const highScoreDisplay = document.getElementById('highScoreDisplay');
    const pitSizeDisplay = document.getElementById('pitSizeDisplay');
    const blockSetDisplay = document.getElementById('blockSetDisplay');
    const demoModeBtn = document.getElementById('demoModeBtn');
    const notificationBanner = document.getElementById('notificationBanner');
    const bannerTitle = document.getElementById('bannerTitle');
    const bannerSubtitle = document.getElementById('bannerSubtitle');
    const bannerMarqueeWrap = document.getElementById('bannerMarqueeWrap');
    const bannerPrompt = document.getElementById('bannerPrompt');
    const audioBtn = document.getElementById('audioBtn');
    const crtBtn = document.getElementById('crtBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettings = document.getElementById('closeSettings');
    const pitSelect = document.getElementById('pitSelect');
    const modeSelect = document.getElementById('modeSelect');
    const controlSelect = document.getElementById('controlSelect');
    const layersPerLevelSelect = document.getElementById('layersPerLevelSelect');
    const scanlineToggle = document.getElementById('scanlineToggle');

    const monitorFrame = document.querySelector('.monitor-frame');
    const scanlines = document.querySelector('.scanlines');

    // --- Notification & Level Up Helpers ---
    let notificationTimeout = null;
    function showNotification(title, subtitle, durationMs = 2800) {
        if (waitingForLevelAdvance) return; // Do not overwrite active level advance modal!
        if (notificationTimeout) clearTimeout(notificationTimeout);
        if (marquee) marquee.stop();
        notificationBanner.classList.remove('level-up-modal');
        bannerMarqueeWrap.classList.remove('show');
        bannerPrompt.classList.remove('show');
        bannerTitle.textContent = title;
        bannerSubtitle.textContent = subtitle;
        notificationBanner.classList.add('show');
        notificationTimeout = setTimeout(() => {
            if (!waitingForLevelAdvance) {
                notificationBanner.classList.remove('show');
            }
        }, durationMs);
    }

    let controlScheme = 'classic'; // 'classic' | 'wasd'
    let waitingForLevelAdvance = false;

    function dismissLevelModal() {
        if (!waitingForLevelAdvance && !notificationBanner.classList.contains('level-up-modal')) return;
        waitingForLevelAdvance = false;
        marquee.stop();
        notificationBanner.classList.remove('show', 'level-up-modal');
        bannerMarqueeWrap.classList.remove('show');
        bannerPrompt.classList.remove('show');
        bannerSubtitle.style.display = 'block';
        game.paused = false;
    }

    const game = new BlockdownGame({
        pitWidth: 5,
        pitHeight: 5,
        pitDepth: 12,
        layersPerLevel: 3,
        audio: audio,
        onScoreChange: (score, cubes, layersCleared, layersPerLevel) => {
            scoreDisplay.textContent = score.toString();
            cubesDisplay.textContent = cubes.toString();
            highScoreDisplay.textContent = game.highScore.toString();
            if (layerProgressDisplay) {
                const currentInLevel = (layersCleared || 0) % (layersPerLevel || game.layersPerLevel);
                layerProgressDisplay.textContent = `${currentInLevel}/${layersPerLevel || game.layersPerLevel} CLEARS`;
            }
        },
        onLevelUp: (newLevel, unlockedPieces, totalCleared, isBlockout = false) => {
            levelDisplay.textContent = newLevel.toString();
            if (layerProgressDisplay) {
                const currentInLevel = (totalCleared || 0) % game.layersPerLevel;
                layerProgressDisplay.textContent = `${currentInLevel}/${game.layersPerLevel} CLEARS`;
            }

            // Determine unlocked pieces to display in marquee
            const piecesToShow = (unlockedPieces && unlockedPieces.length > 0)
                ? unlockedPieces
                : game.pieceManager.getAvailablePieces().slice(-4);

            if (notificationTimeout) clearTimeout(notificationTimeout);

            // Sync marquee canvas resolution with viewport size
            if (marqueeCanvas) {
                const rect = marqueeCanvas.getBoundingClientRect();
                if (rect.width > 0) {
                    marqueeCanvas.width = Math.round(rect.width);
                    marqueeCanvas.height = 136;
                }
            }

            marquee.setPieces(piecesToShow);
            marquee.start();

            notificationBanner.classList.add('level-up-modal');
            bannerMarqueeWrap.classList.add('show');

            bannerTitle.textContent = `LEVEL ${newLevel}!`;

            // Remove redundant white "UNLOCKED:" line per user request
            if (isBlockout) {
                bannerSubtitle.innerHTML = `
                    <div style="color:var(--dos-cyan);font-weight:bold;margin-bottom:4px;text-shadow:0 0 8px var(--dos-cyan);">
                        PERFECT PIT CLEAR! +10,000 BONUS!
                    </div>
                `;
                bannerSubtitle.style.display = 'block';
            } else {
                bannerSubtitle.textContent = '';
                bannerSubtitle.style.display = 'none';
            }

            if (game.demoMode) {
                bannerPrompt.textContent = '[ DEMO MODE: ADVANCING... ]';
                bannerPrompt.classList.add('show');
                notificationBanner.classList.add('show');

                notificationTimeout = setTimeout(() => {
                    if (game.demoMode) {
                        dismissLevelModal();
                    }
                }, 4000);
            } else {
                game.paused = true;
                waitingForLevelAdvance = true;
                bannerPrompt.textContent = '[ PRESS ANY KEY TO PROCEED ]';
                bannerPrompt.classList.add('show');
                notificationBanner.classList.add('show');
            }
        },
        onBlockout: (leveledUp = false) => {
            // If leveledUp is true or level advance is pending, onLevelUp handles the combined modal!
            if (leveledUp || waitingForLevelAdvance || notificationBanner.classList.contains('level-up-modal')) {
                return;
            }
            showNotification('★ BLOCK OUT! ★', 'PERFECT PIT CLEAR! +10,000 BONUS!', 4000);
        },
        onGameOver: (finalScore) => {
            showNotification('GAME OVER', `FINAL SCORE: ${finalScore}. Press R to Restart.`, 4500);
            if (game.demoMode) {
                setTimeout(() => {
                    if (game.demoMode && game.gameOver) {
                        game.reset();
                        ai.reset();
                        showNotification('DEMO MODE', 'AI is playing Blockdown. Press any key to play!', 3000);
                    }
                }, 4000);
            }
        }
    });

    // Update initial UI
    levelDisplay.textContent = game.level.toString();
    if (layerProgressDisplay) {
        layerProgressDisplay.textContent = `0/${game.layersPerLevel} CLEARS`;
    }
    scoreDisplay.textContent = game.score.toString();
    cubesDisplay.textContent = game.cubesPlayed.toString();
    highScoreDisplay.textContent = game.highScore.toString();
    pitSizeDisplay.textContent = `${game.pitWidth}x${game.pitHeight}x${game.pitDepth}`;

    // Resize handler
    function handleResize() {
        renderer.resize();
        if (marqueeCanvas) {
            const rect = marqueeCanvas.getBoundingClientRect();
            if (rect.width > 0) {
                marqueeCanvas.width = Math.round(rect.width);
                marqueeCanvas.height = 136;
            }
        }
    }
    window.addEventListener('resize', handleResize);
    handleResize();

    // --- User Keyboard Input Handling ---
    const keysDown = new Set();

    window.addEventListener('keydown', (e) => {
        // Unlock Web Audio context on user action
        audio.init();

        // Prevent scrolling with arrows and spacebar
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
            e.preventDefault();
        }

        // If waiting for player to proceed past level complete, any key proceeds
        if (waitingForLevelAdvance) {
            dismissLevelModal();
            return;
        }

        // Avoid repeated triggers when key is held, except for movement and soft drop
        const repeatableKeys = controlScheme === 'wasd'
            ? ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight']
            : ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'];
        if (e.repeat && !repeatableKeys.includes(e.code)) return;

        // If Demo Mode active, any player move takes control
        if (game.demoMode && !['KeyP', 'KeyM'].includes(e.code)) {
            toggleDemoMode(false);
        }

        if (e.code === 'KeyR') {
            game.reset();
            levelDisplay.textContent = '0';
            if (layerProgressDisplay) {
                layerProgressDisplay.textContent = `0/${game.layersPerLevel} CLEARS`;
            }
            ai.reset();
            return;
        }

        if (e.code === 'KeyP') {
            game.paused = !game.paused;
            if (game.paused) {
                showNotification('PAUSED', 'Press P to resume', 60000);
            } else {
                notificationBanner.classList.remove('show');
            }
            return;
        }

        if (e.code === 'KeyM') {
            const isMuted = audio.toggleMute();
            audioBtn.textContent = isMuted ? 'AUDIO: OFF' : 'AUDIO: ON';
            audioBtn.classList.toggle('active', !isMuted);
            return;
        }

        if (game.gameOver || game.paused) return;

        // 1. Universal Arrow Keys: Full 2D Movement in the Pit (XY plane)
        if (e.code === 'ArrowLeft') game.move(-1, 0);
        else if (e.code === 'ArrowRight') game.move(1, 0);
        else if (e.code === 'ArrowUp') game.move(0, -1);
        else if (e.code === 'ArrowDown') game.move(0, 1); // Moves piece DOWN along Y axis!

        // 2. Drop / Descent Actions (Z axis into depth)
        else if (e.code === 'Space') game.hardDrop();
        else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'Enter') game.softDrop();

        // 3. Scheme-specific key mapping
        if (controlScheme === 'classic') {
            // Intuitive 3D Rotations:
            // W/S = Flip forward / backward (Pitch)
            // A/D = Roll CCW / CW (Rotate Left / Right)
            // Q/E = Turn Left / Right in 3D (Yaw)
            if (e.code === 'KeyW') game.rotate('pitch', -1);
            else if (e.code === 'KeyS') game.rotate('pitch', 1);
            else if (e.code === 'KeyA') game.rotate('roll', -1);
            else if (e.code === 'KeyD') game.rotate('roll', 1);
            else if (e.code === 'KeyQ') game.rotate('yaw', -1);
            else if (e.code === 'KeyE') game.rotate('yaw', 1);

            // Also support Desktop NumPad for 3D rotation:
            // 8/2 (or 8/5) = Pitch, 4/6 = Roll, 7/9 = Yaw
            else if (e.code === 'Numpad8') game.rotate('pitch', -1);
            else if (e.code === 'Numpad2' || e.code === 'Numpad5') game.rotate('pitch', 1);
            else if (e.code === 'Numpad4') game.rotate('roll', -1);
            else if (e.code === 'Numpad6') game.rotate('roll', 1);
            else if (e.code === 'Numpad7') game.rotate('yaw', -1);
            else if (e.code === 'Numpad9') game.rotate('yaw', 1);
        } else if (controlScheme === 'wasd') {
            // WASD Movement (XY plane)
            if (e.code === 'KeyA') game.move(-1, 0);
            else if (e.code === 'KeyD') game.move(1, 0);
            else if (e.code === 'KeyW') game.move(0, -1);
            else if (e.code === 'KeyS') game.move(0, 1);

            // Right-hand 3D Rotations:
            // I/K = Flip forward/backward (Pitch), J/L = Roll CCW / CW, U/O = Turn Left/Right (Yaw)
            else if (e.code === 'KeyI') game.rotate('pitch', -1);
            else if (e.code === 'KeyK') game.rotate('pitch', 1);
            else if (e.code === 'KeyJ') game.rotate('roll', -1);
            else if (e.code === 'KeyL') game.rotate('roll', 1);
            else if (e.code === 'KeyU') game.rotate('yaw', -1);
            else if (e.code === 'KeyO') game.rotate('yaw', 1);

            // NumPad rotation also active
            else if (e.code === 'Numpad8') game.rotate('pitch', -1);
            else if (e.code === 'Numpad2' || e.code === 'Numpad5') game.rotate('pitch', 1);
            else if (e.code === 'Numpad4') game.rotate('roll', -1);
            else if (e.code === 'Numpad6') game.rotate('roll', 1);
            else if (e.code === 'Numpad7') game.rotate('yaw', -1);
            else if (e.code === 'Numpad9') game.rotate('yaw', 1);
        }
    });

    notificationBanner.addEventListener('click', () => {
        if (waitingForLevelAdvance) {
            dismissLevelModal();
        }
    });

    // --- On-Screen Touch / Mouse Controller ---
    document.querySelectorAll('[data-act]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            audio.init();
            if (waitingForLevelAdvance) {
                dismissLevelModal();
                return;
            }
            const act = btn.getAttribute('data-act');
            if (game.demoMode) toggleDemoMode(false);

            switch (act) {
                case 'left': game.move(-1, 0); break;
                case 'right': game.move(1, 0); break;
                case 'up': game.move(0, -1); break;
                case 'down': game.move(0, 1); break;
                case 'drop': game.hardDrop(); break;
                case 'pitch-up': game.rotate('pitch', -1); break;
                case 'pitch-down': game.rotate('pitch', 1); break;
                case 'yaw-left': game.rotate('yaw', -1); break;
                case 'yaw-right': game.rotate('yaw', 1); break;
                case 'roll-ccw': game.rotate('roll', -1); break;
                case 'roll-cw': game.rotate('roll', 1); break;
            }
        });
    });

    // --- Demo Mode Handler ---
    function toggleDemoMode(enable, resetOnExit = true) {
        const prev = game.demoMode;
        game.demoMode = enable !== undefined ? enable : !game.demoMode;
        demoModeBtn.classList.toggle('active', game.demoMode);
        if (game.demoMode) {
            ai.reset();
            showNotification('DEMO MODE', 'AI is playing Blockdown. Press any key or button to take over!', 3000);
        } else {
            if (prev && resetOnExit) {
                game.reset();
                levelDisplay.textContent = '0';
                if (layerProgressDisplay) {
                    layerProgressDisplay.textContent = `0/${game.layersPerLevel} CLEARS`;
                }
                scoreDisplay.textContent = '0';
                cubesDisplay.textContent = '0';
                showNotification('PLAYER START', 'Good luck! Use Arrows & WASD/QE', 2200);
            } else {
                notificationBanner.classList.remove('show');
            }
        }
    }

    // Start in Demo Mode by default (faithful to the demo video!)
    toggleDemoMode(true, false);

    demoModeBtn.addEventListener('click', () => {
        audio.init();
        toggleDemoMode();
    });

    // Audio button
    audioBtn.addEventListener('click', () => {
        const isMuted = audio.toggleMute();
        audioBtn.textContent = isMuted ? 'AUDIO: OFF' : 'AUDIO: ON';
        audioBtn.classList.toggle('active', !isMuted);
    });

    // CRT Bezel toggle
    let bezelOn = true;
    crtBtn.addEventListener('click', () => {
        bezelOn = !bezelOn;
        monitorFrame.classList.toggle('no-bezel', !bezelOn);
        crtBtn.textContent = bezelOn ? 'CRT BEZEL: ON' : 'CRT BEZEL: OFF';
        handleResize();
    });

    // Settings Modal
    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('open');
    });

    closeSettings.addEventListener('click', () => {
        settingsModal.classList.remove('open');
    });

    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.remove('open');
        }
    });

    // Pit size change
    pitSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        const [w, h, d] = val.split('x').map(n => parseInt(n, 10));
        game.setPitDimensions(w, h, d);
        renderer.setPitDimensions(w, h, d);
        pitSizeDisplay.textContent = `${w}x${h}x${d}`;
        ai.reset();
        handleResize();
    });

    // Block set mode change
    modeSelect.addEventListener('change', (e) => {
        const mode = e.target.value;
        game.pieceManager.setMode(mode);
        blockSetDisplay.textContent = mode.toUpperCase();
        ai.reset();
    });

    // Control scheme change
    controlSelect.addEventListener('change', (e) => {
        controlScheme = e.target.value;
        updateControlsGuide();
    });

    // Clears per level change
    if (layersPerLevelSelect) {
        layersPerLevelSelect.addEventListener('change', (e) => {
            game.setLayersPerLevel(parseInt(e.target.value, 10));
            if (layerProgressDisplay) {
                const currentInLevel = game.layersClearedTotal % game.layersPerLevel;
                layerProgressDisplay.textContent = `${currentInLevel}/${game.layersPerLevel} CLEARS`;
            }
        });
    }

    function updateControlsGuide() {
        const guide = document.getElementById('controlsGuide');
        if (controlScheme === 'classic') {
            guide.innerHTML = `
                <div><kbd>&larr;</kbd> <kbd>&rarr;</kbd> <kbd>&uarr;</kbd> <kbd>&darr;</kbd> Move XY (Down &darr; = Y axis)</div>
                <div><kbd>W</kbd>/<kbd>S</kbd> Flip Fwd/Back &bull; <kbd>A</kbd>/<kbd>D</kbd> Roll (Rotate L/R) &bull; <kbd>Q</kbd>/<kbd>E</kbd> Turn 3D</div>
                <div><kbd>Space</kbd> Drop to Floor &bull; <kbd>Shift</kbd> Soft Drop (Z)</div>
            `;
        } else {
            guide.innerHTML = `
                <div><kbd>WASD</kbd> or <kbd>Arrows</kbd> Move XY (<kbd>S</kbd>/<kbd>&darr;</kbd> = Y Down)</div>
                <div><kbd>I</kbd>/<kbd>K</kbd> Flip Fwd/Back &bull; <kbd>J</kbd>/<kbd>L</kbd> Roll (Rotate L/R) &bull; <kbd>U</kbd>/<kbd>O</kbd> Turn 3D</div>
                <div><kbd>Space</kbd> Drop to Floor &bull; <kbd>Shift</kbd> Soft Drop (Z)</div>
            `;
        }
    }
    updateControlsGuide();

    // Scanlines toggle
    scanlineToggle.addEventListener('change', (e) => {
        scanlines.classList.toggle('off', !e.target.checked);
    });

    // --- Main Game Loop (60 FPS) ---
    let lastTime = performance.now();

    function gameLoop(time) {
        const dt = Math.min(0.1, (time - lastTime) / 1000);
        lastTime = time;

        if (game.demoMode) {
            ai.update(game, dt);
        }

        game.update(dt);
        renderer.render(game);

        requestAnimationFrame(gameLoop);
    }

    requestAnimationFrame(gameLoop);
});
