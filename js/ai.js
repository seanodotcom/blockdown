/**
 * Blockdown - Autonomous AI Demo Mode Player
 * Evaluates 3D pit states using spatial heuristics (height, holes, roughness, layer clears)
 * to autonomously solve and play Blockdown in Demo Mode.
 */

import { Piece } from './polycubes.js';

export class BlockdownAI {
    constructor() {
        this.targetMove = null;
        this.stepCooldown = 0;
    }

    reset() {
        this.targetMove = null;
        this.stepCooldown = 0;
    }

    /**
     * Finds all unique orientations of a piece via 3D rotations.
     */
    getUniqueOrientations(piece) {
        const orientations = [];
        const seenSignatures = new Set();

        const axes = ['pitch', 'yaw', 'roll'];

        // Breadth-first exploration of rotations up to depth 4
        const queue = [{ piece: piece.clone(), path: [] }];

        while (queue.length > 0) {
            const current = queue.shift();
            const sig = this.getPieceSignature(current.piece);

            if (!seenSignatures.has(sig)) {
                seenSignatures.add(sig);
                orientations.push({
                    piece: current.piece,
                    rotations: current.path
                });

                if (current.path.length < 4) {
                    for (const axis of axes) {
                        const rotatedPiece = current.piece.clone();
                        rotatedPiece.rotate(axis, 1);
                        queue.push({
                            piece: rotatedPiece,
                            path: [...current.path, { axis, dir: 1 }]
                        });
                    }
                }
            }
        }

        return orientations;
    }

    getPieceSignature(piece) {
        return piece.cubes
            .map(c => `${c.x},${c.y},${c.z}`)
            .sort()
            .join(';');
    }

    /**
     * Evaluates all possible moves for current piece and selects best placement.
     */
    findBestMove(game) {
        const pitW = game.pitWidth;
        const pitH = game.pitHeight;
        const pitD = game.pitDepth;
        const grid = game.grid;

        const orientations = this.getUniqueOrientations(game.activePiece);
        let bestScore = -Infinity;
        let bestMove = null;

        for (const ori of orientations) {
            const dims = ori.piece.getDimensions();

            for (let x = 0; x <= pitW - dims.w; x++) {
                for (let y = 0; y <= pitH - dims.h; y++) {
                    // Find landing depth
                    let dropZ = 0;
                    while (dropZ <= pitD - dims.d) {
                        if (this.checkCollision(grid, ori.piece, x, y, dropZ + 1, pitW, pitH, pitD)) {
                            break;
                        }
                        dropZ++;
                    }

                    // If it collides at entrance, invalid
                    if (this.checkCollision(grid, ori.piece, x, y, dropZ, pitW, pitH, pitD)) {
                        continue;
                    }

                    // Score this placement
                    const score = this.evaluateBoard(grid, ori.piece, x, y, dropZ, pitW, pitH, pitD);
                    if (score > bestScore) {
                        bestScore = score;
                        bestMove = {
                            x,
                            y,
                            rotations: ori.rotations
                        };
                    }
                }
            }
        }

        return bestMove;
    }

    checkCollision(grid, piece, px, py, pz, pitW, pitH, pitD) {
        for (const c of piece.cubes) {
            const x = px + c.x;
            const y = py + c.y;
            const z = pz + c.z;

            if (x < 0 || x >= pitW || y < 0 || y >= pitH || z < 0 || z >= pitD) {
                return true;
            }
            if (grid[x][y][z]) {
                return true;
            }
        }
        return false;
    }

    /**
     * Evaluates pit heuristic: clears, depth, covered holes, flatness.
     */
    evaluateBoard(grid, piece, px, py, pz, pitW, pitH, pitD) {
        // Clone affected grid slices to calculate simulated state
        const tempGrid = Array.from({ length: pitW }, (_, x) =>
            Array.from({ length: pitH }, (_, y) => [...grid[x][y]])
        );

        // Place piece
        for (const c of piece.cubes) {
            tempGrid[px + c.x][py + c.y][pz + c.z] = true;
        }

        // Count completed layers
        let completedLayers = 0;
        for (let z = 0; z < pitD; z++) {
            let full = true;
            for (let x = 0; x < pitW; x++) {
                for (let y = 0; y < pitH; y++) {
                    if (!tempGrid[x][y][z]) {
                        full = false;
                        break;
                    }
                }
                if (!full) break;
            }
            if (full) completedLayers++;
        }

        // Count holes (empty cells covered by occupied cells along Z)
        let holes = 0;
        for (let x = 0; x < pitW; x++) {
            for (let y = 0; y < pitH; y++) {
                let seenBlock = false;
                for (let z = 0; z < pitD; z++) {
                    if (tempGrid[x][y][z]) {
                        seenBlock = true;
                    } else if (seenBlock) {
                        holes++;
                    }
                }
            }
        }

        // Depth reward (prefer placing as deep in pit as possible)
        const depthReward = pz * 30;
        const layerReward = completedLayers * 800;
        const holePenalty = holes * 120;

        return layerReward + depthReward - holePenalty;
    }

    /**
     * Executes one AI action per step in Demo Mode.
     */
    update(game, dt) {
        if (!game.activePiece || game.gameOver || game.clearingAnimation) return;

        this.stepCooldown -= dt;
        if (this.stepCooldown > 0) return;
        this.stepCooldown = 0.09; // Speed of AI inputs

        if (!this.targetMove) {
            this.targetMove = this.findBestMove(game);
            if (!this.targetMove) return;
        }

        // 1. Perform rotations first
        if (this.targetMove.rotations && this.targetMove.rotations.length > 0) {
            const rot = this.targetMove.rotations.shift();
            game.rotate(rot.axis, rot.dir);
            return;
        }

        // 2. Perform translation
        if (game.activePos.x < this.targetMove.x) {
            game.move(1, 0);
            return;
        } else if (game.activePos.x > this.targetMove.x) {
            game.move(-1, 0);
            return;
        }

        if (game.activePos.y < this.targetMove.y) {
            game.move(0, 1);
            return;
        } else if (game.activePos.y > this.targetMove.y) {
            game.move(0, -1);
            return;
        }

        // 3. In position! Hard drop
        game.hardDrop();
        this.targetMove = null;
        this.stepCooldown = 0.25;
    }
}
