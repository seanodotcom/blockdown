/**
 * Blockdown - Core Game Engine
 * Manages 3D pit state, active piece manipulation, collision detection, wall kicks,
 * layer clearing, scoring, level progression, and event dispatching.
 */

import { Vector3 } from './math3d.js';
import { PieceManager, Piece } from './polycubes.js';

export class BlockdownGame {
    constructor(options = {}) {
        this.pitWidth = options.pitWidth || 5;
        this.pitHeight = options.pitHeight || 5;
        this.pitDepth = options.pitDepth || 12;

        this.pieceManager = new PieceManager();
        this.audio = options.audio || null;
        this.layersPerLevel = options.layersPerLevel || 3;

        // Callbacks
        this.onScoreChange = options.onScoreChange || (() => {});
        this.onLevelUp = options.onLevelUp || (() => {});
        this.onGameOver = options.onGameOver || (() => {});
        this.onBlockout = options.onBlockout || (() => {});

        let savedHighScore = 0;
        try {
            if (typeof localStorage !== 'undefined') {
                savedHighScore = parseInt(localStorage.getItem('blockdown_high_score') || '0', 10);
            }
        } catch (e) {}
        this.highScore = savedHighScore;

        this.reset();
    }

    reset() {
        this.grid = Array.from({ length: this.pitWidth }, () =>
            Array.from({ length: this.pitHeight }, () =>
                new Array(this.pitDepth).fill(false)
            )
        );

        this.score = 0;
        this.cubesPlayed = 0;
        this.layersClearedTotal = 0;
        this.level = 0;
        this.gameOver = false;
        this.paused = false;
        this.demoMode = false;

        this.pieceManager.setLevel(0);

        this.activePiece = null;
        this.activePos = new Vector3(0, 0, 0);
        this.nextPiece = this.pieceManager.getNextPiece();

        this.fallTimer = 0;
        this.lockTimer = 0;
        this.isLocking = false;
        this.lockDelay = 0.45; // seconds

        this.clearingAnimation = null; // { clearedLayers: [], timer: 0, duration: 0.25 }

        this.spawnPiece();
    }

    setPitDimensions(w, h, d) {
        this.pitWidth = w;
        this.pitHeight = h;
        this.pitDepth = d;
        this.reset();
    }

    getFallInterval() {
        // Fall interval decreases gently with level (50ms per level) for balanced progression
        return Math.max(0.18, 1.05 - this.level * 0.05);
    }

    spawnPiece() {
        this.activePiece = this.nextPiece;
        this.nextPiece = this.pieceManager.getNextPiece();

        const dims = this.activePiece.getDimensions();
        // Spawn centered at the pit entrance
        const startX = Math.floor((this.pitWidth - dims.w) / 2);
        const startY = Math.floor((this.pitHeight - dims.h) / 2);
        const startZ = 0;

        this.activePos = new Vector3(startX, startY, startZ);
        this.isLocking = false;
        this.lockTimer = 0;

        // Check if spawn position already collides -> Game Over!
        if (this.checkCollision(this.activePiece, this.activePos)) {
            this.gameOver = true;
            this.clearSavedGame();
            if (this.audio) this.audio.playGameOver();
            this.onGameOver(this.score);
        } else {
            if (!this.demoMode && (this.cubesPlayed > 0 || this.score > 0)) {
                this.saveToStorage();
            }
        }
    }

    checkCollision(piece, pos) {
        for (const c of piece.cubes) {
            const x = pos.x + c.x;
            const y = pos.y + c.y;
            const z = pos.z + c.z;

            if (x < 0 || x >= this.pitWidth || y < 0 || y >= this.pitHeight || z < 0 || z >= this.pitDepth) {
                return true;
            }
            if (this.grid[x][y][z]) {
                return true;
            }
        }
        return false;
    }

    /**
     * Calculates the landing Z coordinate for current active piece and position.
     */
    getLandingZ() {
        if (!this.activePiece) return this.activePos.z;
        let testZ = this.activePos.z;
        while (testZ < this.pitDepth) {
            const testPos = new Vector3(this.activePos.x, this.activePos.y, testZ + 1);
            if (this.checkCollision(this.activePiece, testPos)) {
                break;
            }
            testZ++;
        }
        return testZ;
    }

    /**
     * Moves active piece in XY plane.
     */
    move(dx, dy) {
        if (this.gameOver || this.paused || !this.activePiece || this.clearingAnimation) return false;

        const newPos = new Vector3(this.activePos.x + dx, this.activePos.y + dy, this.activePos.z);
        if (!this.checkCollision(this.activePiece, newPos)) {
            this.activePos = newPos;
            if (this.audio) this.audio.playMove();

            // Reset lock timer if moved while touching bottom
            if (this.isLocking) {
                this.lockTimer = 0;
            }
            return true;
        } else {
            if (this.audio) this.audio.playBump();
            return false;
        }
    }

    /**
     * Rotates active piece in 3D (pitch, yaw, or roll) with wall kicks.
     */
    rotate(axis, dir = 1) {
        if (this.gameOver || this.paused || !this.activePiece || this.clearingAnimation) return false;

        const rotated = this.activePiece.clone();
        rotated.rotate(axis, dir);

        // Wall kick offsets to try if direct rotation collides
        const kickOffsets = [
            [0, 0, 0],
            [-1, 0, 0],
            [1, 0, 0],
            [0, -1, 0],
            [0, 1, 0],
            [-1, -1, 0],
            [1, 1, 0],
            [0, 0, -1]
        ];

        for (const [ox, oy, oz] of kickOffsets) {
            const testPos = new Vector3(
                this.activePos.x + ox,
                this.activePos.y + oy,
                this.activePos.z + oz
            );

            if (!this.checkCollision(rotated, testPos)) {
                this.activePiece = rotated;
                this.activePos = testPos;
                if (this.audio) this.audio.playRotate();

                if (this.isLocking) {
                    this.lockTimer = 0;
                }
                return true;
            }
        }

        if (this.audio) this.audio.playBump();
        return false;
    }

    /**
     * Drops the piece down by 1 unit (soft drop).
     */
    softDrop() {
        if (this.gameOver || this.paused || !this.activePiece || this.clearingAnimation) return false;

        const newPos = new Vector3(this.activePos.x, this.activePos.y, this.activePos.z + 1);
        if (!this.checkCollision(this.activePiece, newPos)) {
            this.activePos = newPos;
            this.score += 1;
            this.updateHighScore();
            this.onScoreChange(this.score, this.cubesPlayed);
            return true;
        } else {
            this.lockPiece();
            return false;
        }
    }

    /**
     * Instantly drops the piece to its landing position (hard drop).
     */
    hardDrop() {
        if (this.gameOver || this.paused || !this.activePiece || this.clearingAnimation) return;

        const landingZ = this.getLandingZ();
        const droppedLayers = landingZ - this.activePos.z;
        this.activePos.z = landingZ;

        // Points for depth dropped
        this.score += droppedLayers * 2;
        this.updateHighScore();
        this.lockPiece();
    }

    /**
     * Locks the active piece into the 3D grid and checks for cleared layers.
     */
    lockPiece() {
        if (!this.activePiece) return;

        // Place cubes into grid
        for (const c of this.activePiece.cubes) {
            const x = this.activePos.x + c.x;
            const y = this.activePos.y + c.y;
            const z = this.activePos.z + c.z;

            if (x >= 0 && x < this.pitWidth && y >= 0 && y < this.pitHeight && z >= 0 && z < this.pitDepth) {
                this.grid[x][y][z] = true;
            }
        }

        // Increment Cubes Played
        this.cubesPlayed += this.activePiece.cubes.length;
        this.score += this.activePiece.cubes.length * (this.level + 1);
        this.updateHighScore();

        if (this.audio) this.audio.playDrop();

        this.activePiece = null;
        this.isLocking = false;

        // Check for completed horizontal layers
        this.checkCompletedLayers();

        this.onScoreChange(this.score, this.cubesPlayed, this.layersClearedTotal, this.layersPerLevel);
    }

    /**
     * Scans the pit along Z for completely filled layers.
     */
    checkCompletedLayers() {
        const fullLayers = [];

        for (let z = 0; z < this.pitDepth; z++) {
            let full = true;
            for (let x = 0; x < this.pitWidth; x++) {
                for (let y = 0; y < this.pitHeight; y++) {
                    if (!this.grid[x][y][z]) {
                        full = false;
                        break;
                    }
                }
                if (!full) break;
            }
            if (full) {
                fullLayers.push(z);
            }
        }

        if (fullLayers.length > 0) {
            // Initiate clearing animation with 3 full flashes
            this.clearingAnimation = {
                clearedLayers: fullLayers,
                timer: 0,
                duration: 0.42,
                progress: 0
            };

            if (this.audio) this.audio.playLayerClear(fullLayers.length);
        } else {
            this.spawnPiece();
        }
    }

    /**
     * Clears full layers and drops all layers above down.
     */
    finishClearingLayers(clearedLayers) {
        // Sort descending so bottom layers clear first
        const sorted = [...clearedLayers].sort((a, b) => b - a);

        for (const z of sorted) {
            // Shift all layers above z down by 1
            for (let curZ = z; curZ > 0; curZ--) {
                for (let x = 0; x < this.pitWidth; x++) {
                    for (let y = 0; y < this.pitHeight; y++) {
                        this.grid[x][y][curZ] = this.grid[x][y][curZ - 1];
                    }
                }
            }
            // Clear top layer
            for (let x = 0; x < this.pitWidth; x++) {
                for (let y = 0; y < this.pitHeight; y++) {
                    this.grid[x][y][0] = false;
                }
            }
        }

        // Scoring bonuses
        const layerCount = clearedLayers.length;
        const multiplier = [0, 100, 300, 700, 1500, 3000][Math.min(5, layerCount)] || (layerCount * 1000);
        this.score += multiplier * (this.level + 1);
        this.layersClearedTotal += layerCount;

        // Check if pit is 100% empty -> "BLOCK OUT" Jackpot!
        let isEmpty = true;
        for (let x = 0; x < this.pitWidth; x++) {
            for (let y = 0; y < this.pitHeight; y++) {
                for (let z = 0; z < this.pitDepth; z++) {
                    if (this.grid[x][y][z]) {
                        isEmpty = false;
                        break;
                    }
                }
                if (!isEmpty) break;
            }
            if (!isEmpty) break;
        }

        let isBlockout = false;
        if (isEmpty) {
            // Huge bonus!
            this.score += 10000 * (this.level + 1);
            if (this.audio) this.audio.playBlockout();
            isBlockout = true;
        }

        // Check level progression strictly when complete layers are cleared!
        const leveledUp = this.checkLevelProgression(isBlockout);

        if (isBlockout) {
            this.onBlockout(leveledUp);
        }

        this.updateHighScore();
        this.onScoreChange(this.score, this.cubesPlayed, this.layersClearedTotal, this.layersPerLevel);

        this.clearingAnimation = null;
        this.spawnPiece();
    }

    /**
     * Checks if criteria for advancing to next level are met.
     * Levels advance strictly when full horizontal layers (e.g. 5x5 grids) are cleared.
     */
    checkLevelProgression(isBlockout = false) {
        const targetLevel = Math.floor(this.layersClearedTotal / this.layersPerLevel);
        if (targetLevel > this.level) {
            const oldLevel = this.level;
            this.level = targetLevel;
            this.pieceManager.setLevel(this.level);

            const newlyUnlocked = this.pieceManager.getNewlyUnlockedPieces(this.level);
            if (this.audio) this.audio.playLevelUp();
            this.onLevelUp(this.level, newlyUnlocked, this.layersClearedTotal, isBlockout);
            return true;
        }
        return false;
    }

    setLayersPerLevel(n) {
        this.layersPerLevel = Math.max(1, parseInt(n, 10) || 3);
        this.checkLevelProgression();
    }

    updateHighScore() {
        if (this.score > this.highScore) {
            this.highScore = this.score;
            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('blockdown_high_score', this.highScore.toString());
                }
            } catch (e) {}
        }
    }

    /**
     * Core update loop called each frame.
     * @param {number} dt - delta time in seconds
     */
    update(dt) {
        if (this.gameOver || this.paused) return;

        // Handle layer clearing animation
        if (this.clearingAnimation) {
            this.clearingAnimation.timer += dt;
            this.clearingAnimation.progress = this.clearingAnimation.timer / this.clearingAnimation.duration;
            if (this.clearingAnimation.timer >= this.clearingAnimation.duration) {
                this.finishClearingLayers(this.clearingAnimation.clearedLayers);
            }
            return;
        }

        if (!this.activePiece) return;

        // Check if piece is touching floor or resting on block
        const testPos = new Vector3(this.activePos.x, this.activePos.y, this.activePos.z + 1);
        const touching = this.checkCollision(this.activePiece, testPos);

        if (touching) {
            this.isLocking = true;
            this.lockTimer += dt;
            if (this.lockTimer >= this.lockDelay) {
                this.lockPiece();
                return;
            }
        } else {
            this.isLocking = false;
            this.lockTimer = 0;
        }

        // Automatic downward fall
        this.fallTimer += dt;
        const interval = this.getFallInterval();
        if (this.fallTimer >= interval) {
            this.fallTimer = 0;
            if (!touching) {
                this.activePos.z += 1;
            }
        }
    }

    /**
     * Serializes complete game state to JSON-safe object.
     */
    serializeState() {
        return {
            pitWidth: this.pitWidth,
            pitHeight: this.pitHeight,
            pitDepth: this.pitDepth,
            grid: this.grid,
            score: this.score,
            cubesPlayed: this.cubesPlayed,
            layersClearedTotal: this.layersClearedTotal,
            level: this.level,
            layersPerLevel: this.layersPerLevel,
            activePiece: this.activePiece ? this.activePiece.serialize() : null,
            activePos: this.activePos ? { x: this.activePos.x, y: this.activePos.y, z: this.activePos.z } : null,
            nextPiece: this.nextPiece ? this.nextPiece.serialize() : null,
            fallTimer: this.fallTimer,
            lockTimer: this.lockTimer,
            isLocking: this.isLocking,
            mode: this.pieceManager.mode,
            timestamp: Date.now()
        };
    }

    /**
     * Restores game state from serialized data.
     */
    restoreState(data) {
        if (!data || !data.grid) return false;

        this.pitWidth = data.pitWidth || this.pitWidth;
        this.pitHeight = data.pitHeight || this.pitHeight;
        this.pitDepth = data.pitDepth || this.pitDepth;

        // Rebuild full grid correctly sized
        this.grid = Array.from({ length: this.pitWidth }, (_, x) =>
            Array.from({ length: this.pitHeight }, (_, y) =>
                Array.from({ length: this.pitDepth }, (_, z) =>
                    Boolean(data.grid[x] && data.grid[x][y] && data.grid[x][y][z])
                )
            )
        );

        this.score = data.score || 0;
        this.cubesPlayed = data.cubesPlayed || 0;
        this.layersClearedTotal = data.layersClearedTotal || 0;
        this.level = data.level || 0;
        this.layersPerLevel = data.layersPerLevel || 3;
        this.gameOver = false;
        this.paused = true;
        this.demoMode = false;
        this.clearingAnimation = null;

        if (data.mode) {
            this.pieceManager.setMode(data.mode);
        }
        this.pieceManager.setLevel(this.level);

        this.activePiece = data.activePiece ? Piece.deserialize(data.activePiece) : null;
        this.activePos = data.activePos ? new Vector3(data.activePos.x, data.activePos.y, data.activePos.z) : new Vector3(0, 0, 0);
        this.nextPiece = data.nextPiece ? Piece.deserialize(data.nextPiece) : this.pieceManager.getNextPiece();

        this.fallTimer = data.fallTimer || 0;
        this.lockTimer = data.lockTimer || 0;
        this.isLocking = Boolean(data.isLocking);

        if (!this.activePiece) {
            this.spawnPiece();
        }

        this.updateHighScore();
        this.onScoreChange(this.score, this.cubesPlayed, this.layersClearedTotal, this.layersPerLevel);
        return true;
    }

    /**
     * Saves active human game to localStorage.
     */
    saveToStorage() {
        if (this.demoMode || this.gameOver) return;
        // Never save an empty/unplayed game with zero progress
        if (this.cubesPlayed === 0 && this.score === 0) return;
        try {
            if (typeof localStorage !== 'undefined') {
                const serialized = this.serializeState();
                localStorage.setItem('blockdown_saved_game', JSON.stringify(serialized));
            }
        } catch (e) {
            console.warn('Could not save game to localStorage:', e);
        }
    }

    /**
     * Removes saved game from localStorage.
     */
    clearSavedGame() {
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('blockdown_saved_game');
            }
        } catch (e) {}
    }
}
