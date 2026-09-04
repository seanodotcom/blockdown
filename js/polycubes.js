/**
 * Blockdown - Polycube Definitions and Level Progression System
 * Defines 3D shapes as arrays of integer coordinate offsets [x, y, z] relative to piece center.
 * Features a level-based unlock system starting with simple shapes and unlocking complex 3D polycubes.
 */

import { Vector3, Rotations } from './math3d.js';

export const PIECE_DEFINITIONS = [
    // --- TIER 0: Absolute Basics (Level 0) ---
    {
        id: 'mono',
        name: 'Monocube',
        cubes: [[0, 0, 0]],
        tier: 0,
        category: 'flat'
    },
    {
        id: 'domino',
        name: 'Domino',
        cubes: [[0, 0, 0], [1, 0, 0]],
        tier: 0,
        category: 'flat'
    },
    {
        id: 'tri_i',
        name: 'Tromino-I',
        cubes: [[-1, 0, 0], [0, 0, 0], [1, 0, 0]],
        tier: 0,
        category: 'flat'
    },
    {
        id: 'tri_l',
        name: 'Tromino-L',
        cubes: [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
        tier: 0,
        category: 'flat'
    },

    // --- TIER 1: Classic Flat Tetrominoes (Level 1) ---
    {
        id: 'tetra_o',
        name: 'Square-O',
        cubes: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]],
        tier: 1,
        category: 'flat'
    },
    {
        id: 'tetra_i',
        name: 'Straight-I',
        cubes: [[-1, 0, 0], [0, 0, 0], [1, 0, 0], [2, 0, 0]],
        tier: 1,
        category: 'flat'
    },
    {
        id: 'tetra_l',
        name: 'Flat-L',
        cubes: [[-1, 0, 0], [0, 0, 0], [1, 0, 0], [-1, 1, 0]],
        tier: 1,
        category: 'flat'
    },
    {
        id: 'tetra_t',
        name: 'Flat-T',
        cubes: [[-1, 0, 0], [0, 0, 0], [1, 0, 0], [0, 1, 0]],
        tier: 1,
        category: 'flat'
    },

    // --- TIER 2: Skew & Introductory 3D Shapes (Level 2) ---
    {
        id: 'tetra_z',
        name: 'Flat-Z (Snake)',
        cubes: [[-1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]],
        tier: 2,
        category: 'flat'
    },
    {
        id: 'soma_tripod',
        name: '3D Tripod (Corner)',
        cubes: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]],
        tier: 2,
        category: 'basic_3d'
    },
    {
        id: 'soma_3d_t',
        name: '3D-T',
        cubes: [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1]],
        tier: 2,
        category: 'basic_3d'
    },

    // --- TIER 3: Soma 3D Chiral Pieces (Level 3) ---
    {
        id: 'soma_screw_l',
        name: 'Screw-L (3D Chiral)',
        cubes: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 0, 1]],
        tier: 3,
        category: 'basic_3d'
    },
    {
        id: 'soma_screw_r',
        name: 'Screw-R (3D Chiral)',
        cubes: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 1, 1]],
        tier: 3,
        category: 'basic_3d'
    },
    {
        id: 'soma_3d_l',
        name: '3D-L',
        cubes: [[0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 0, 1]],
        tier: 3,
        category: 'basic_3d'
    },

    // --- TIER 4+: Extended Pentacubes (Level 4+) ---
    {
        id: 'penta_cross',
        name: 'Pentacube Cross',
        cubes: [[0, 0, 0], [-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0]],
        tier: 4,
        category: 'extended'
    },
    {
        id: 'penta_u',
        name: 'Pentacube U',
        cubes: [[-1, 0, 0], [0, 0, 0], [1, 0, 0], [-1, 1, 0], [1, 1, 0]],
        tier: 4,
        category: 'extended'
    },
    {
        id: 'penta_corner',
        name: '3D Pentacube Corner',
        cubes: [[0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 1, 0], [0, 0, 1]],
        tier: 5,
        category: 'extended'
    }
];

export class Piece {
    constructor(definition) {
        this.id = definition.id;
        this.name = definition.name;
        this.category = definition.category;
        this.tier = definition.tier;
        // Array of Vector3 unit cube coordinates relative to (0,0,0)
        this.cubes = definition.cubes.map(([x, y, z]) => new Vector3(x, y, z));
        this.normalize();
    }

    clone() {
        const piece = Object.create(Piece.prototype);
        piece.id = this.id;
        piece.name = this.name;
        piece.category = this.category;
        piece.tier = this.tier;
        piece.cubes = this.cubes.map(c => c.clone());
        return piece;
    }

    /**
     * Normalizes the piece coordinates so that minimum (x, y, z) is at (0, 0, 0)
     */
    normalize() {
        if (this.cubes.length === 0) return;
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        for (const c of this.cubes) {
            if (c.x < minX) minX = c.x;
            if (c.y < minY) minY = c.y;
            if (c.z < minZ) minZ = c.z;
        }
        for (const c of this.cubes) {
            c.x -= minX;
            c.y -= minY;
            c.z -= minZ;
        }
    }

    /**
     * Rotates all cubes in the piece around the chosen axis, then normalizes.
     * @param {'pitch'|'yaw'|'roll'} axis
     * @param {number} dir - +1 or -1
     */
    rotate(axis, dir = 1) {
        this.cubes = this.cubes.map(c => Rotations[axis](c, dir));
        this.normalize();
    }

    /**
     * Calculates width, height, and depth bounds of the piece.
     */
    getDimensions() {
        let maxX = 0, maxY = 0, maxZ = 0;
        for (const c of this.cubes) {
            if (c.x > maxX) maxX = c.x;
            if (c.y > maxY) maxY = c.y;
            if (c.z > maxZ) maxZ = c.z;
        }
        return {
            w: maxX + 1,
            h: maxY + 1,
            d: maxZ + 1
        };
    }
}

/**
 * Manages the piece randomizer bag and level unlocking.
 */
export class PieceManager {
    constructor() {
        this.bag = [];
        this.currentLevel = 0;
        this.mode = 'progression'; // 'progression' | 'flat' | 'basic' | 'extended'
    }

    setLevel(level) {
        if (this.currentLevel !== level) {
            this.currentLevel = level;
            // Clear bag to ensure newly unlocked pieces enter the pool promptly
            this.bag = [];
        }
    }

    setMode(mode) {
        this.mode = mode;
        this.bag = [];
    }

    /**
     * Returns list of available piece definitions for current level/mode.
     */
    getAvailablePieces() {
        if (this.mode === 'flat') {
            return PIECE_DEFINITIONS.filter(p => p.category === 'flat');
        } else if (this.mode === 'basic') {
            return PIECE_DEFINITIONS.filter(p => p.category === 'flat' || p.category === 'basic_3d');
        } else if (this.mode === 'extended') {
            return PIECE_DEFINITIONS;
        } else {
            // Progression mode: unlocks by level
            return PIECE_DEFINITIONS.filter(p => p.tier <= this.currentLevel);
        }
    }

    /**
     * Get newly unlocked piece names when leveling up to targetLevel.
     */
    getNewlyUnlockedPieces(targetLevel) {
        return PIECE_DEFINITIONS.filter(p => p.tier === targetLevel);
    }

    /**
     * Draws the next random piece from a fair shuffle bag.
     */
    getNextPiece() {
        if (this.bag.length === 0) {
            const available = this.getAvailablePieces();
            if (available.length === 0) {
                // Fallback
                return new Piece(PIECE_DEFINITIONS[0]);
            }
            // Populate bag with 2 copies of each available shape for good balance
            this.bag = [...available, ...available];
            // Fisher-Yates shuffle
            for (let i = this.bag.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
            }
        }
        const def = this.bag.pop();
        return new Piece(def);
    }
}
