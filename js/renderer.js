/**
 * Blockdown - 3D Pit Canvas Renderer
 * Renders the 3D perspective wireframe pit, color-coded depth layers, depth-sorted placed blocks,
 * bright wireframe falling piece, landing shadow, clearing animations, and next-piece 3D preview.
 */

import { PerspectiveProjector } from './math3d.js';

// Classic EGA/VGA depth layer colors (from bottom layer up to pit entrance)
export const LAYER_COLORS = [
    '#ffffff', // Layer 0 (Pit entrance - white)
    '#ff3b30', // Layer 1 (Crimson)
    '#af52de', // Layer 2 (Violet)
    '#30d158', // Layer 3 (Lime)
    '#00c7be', // Layer 4 (Teal)
    '#ff9500', // Layer 5 (Amber)
    '#ff2d55', // Layer 6 (Magenta)
    '#ff453a', // Layer 7 (Bright Red)
    '#ffd60a', // Layer 8 (Golden Yellow)
    '#32d74b', // Layer 9 (Emerald Green)
    '#64d2ff', // Layer 10 (Cyan)
    '#0a84ff', // Layer 11 (DOS Royal Blue - bottom layer in video)
    '#0055ff', // Layer 12+
    '#0040dd',
    '#0030bb',
    '#002099',
    '#001588',
    '#001077'
];

export class GameRenderer {
    constructor(canvas, nextCanvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        this.nextCanvas = nextCanvas;
        this.nextCtx = nextCanvas ? nextCanvas.getContext('2d') : null;

        this.projector = new PerspectiveProjector(5, 5, 12);
        this.previewProjector = new PerspectiveProjector(4, 4, 4);

        // Preview rotation angle for idle spin
        this.previewAngle = 0.35;
        this.showLandingShadow = true;

        // Pit grid color (classic DOS phosphor green)
        this.gridColor = '#00e040';
        this.wallDimColor = 'rgba(0, 180, 50, 0.25)';
    }

    setPitDimensions(w, h, d) {
        this.projector.setPitDimensions(w, h, d);
    }

    /**
     * Resizes internal canvas buffers to match CSS display dimensions for crisp pixels.
     */
    resize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            this.canvas.width = Math.round(rect.width * dpr);
            this.canvas.height = Math.round(rect.height * dpr);
        }

        if (this.nextCanvas) {
            const nRect = this.nextCanvas.getBoundingClientRect();
            if (nRect.width > 0 && nRect.height > 0) {
                this.nextCanvas.width = Math.round(nRect.width * dpr);
                this.nextCanvas.height = Math.round(nRect.height * dpr);
            }
        }
    }

    /**
     * Main Render Loop
     */
    render(gameState) {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        if (w === 0 || h === 0) return;

        // Clear background with deep CRT black
        ctx.fillStyle = '#050706';
        ctx.fillRect(0, 0, w, h);

        const pitW = gameState.pitWidth;
        const pitH = gameState.pitHeight;
        const pitD = gameState.pitDepth;

        // 1. Render 3D Pit Wireframe Tunnel (Green Grid)
        this.renderPitTunnel(pitW, pitH, pitD, w, h);

        // 2. Render Placed Blocks (Depth-Sorted)
        this.renderPlacedBlocks(gameState, w, h);

        // 3. Render Landing Shadow / Ghost Piece
        if (this.showLandingShadow && gameState.activePiece && !gameState.gameOver && !gameState.clearingAnimation) {
            this.renderLandingShadow(gameState, w, h);
        }

        // 4. Render Active Falling Piece (Crisp White Wireframe)
        if (gameState.activePiece && !gameState.gameOver) {
            this.renderActivePiece(gameState, w, h);
        }

        // 5. Render Clearing Animation overlay
        if (gameState.clearingAnimation) {
            this.renderClearingAnimation(gameState, w, h);
        }

        // 6. Render Next Piece in the preview viewport
        if (this.nextCtx && gameState.nextPiece) {
            this.renderNextPiecePreview(gameState.nextPiece);
        }
    }

    /**
     * Draws the 3D perspective tunnel with phosphor-green grid lines.
     */
    renderPitTunnel(pitW, pitH, pitD, screenW, screenH) {
        const ctx = this.ctx;
        const proj = this.projector;

        ctx.save();
        ctx.lineWidth = 1.2;

        // A. Longitudinal corner rails (from entrance z=0 to bottom z=pitD)
        const corners = [
            [0, 0],
            [pitW, 0],
            [pitW, pitH],
            [0, pitH]
        ];

        ctx.strokeStyle = this.gridColor;
        ctx.beginPath();
        for (const [cx, cy] of corners) {
            const p0 = proj.project(cx, cy, 0, screenW, screenH);
            const p1 = proj.project(cx, cy, pitD, screenW, screenH);
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
        }
        ctx.stroke();

        // B. Wall longitudinal lines (subdivisions along X and Y walls)
        ctx.strokeStyle = this.wallDimColor;
        ctx.beginPath();
        // Top and Bottom walls (along X)
        for (let x = 1; x < pitW; x++) {
            // Top wall (y = 0)
            let p0 = proj.project(x, 0, 0, screenW, screenH);
            let p1 = proj.project(x, 0, pitD, screenW, screenH);
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);

            // Bottom wall (y = pitH)
            p0 = proj.project(x, pitH, 0, screenW, screenH);
            p1 = proj.project(x, pitH, pitD, screenW, screenH);
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
        }
        // Left and Right walls (along Y)
        for (let y = 1; y < pitH; y++) {
            // Left wall (x = 0)
            let p0 = proj.project(0, y, 0, screenW, screenH);
            let p1 = proj.project(0, y, pitD, screenW, screenH);
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);

            // Right wall (x = pitW)
            p0 = proj.project(pitW, y, 0, screenW, screenH);
            p1 = proj.project(pitW, y, pitD, screenW, screenH);
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
        }
        ctx.stroke();

        // C. Depth rings (transverse rings along Z from 0 to pitD)
        for (let z = 0; z <= pitD; z++) {
            // Far floor (z = pitD) and entrance (z = 0) are brighter; inner rings are slightly dimmer
            if (z === pitD || z === 0) {
                ctx.strokeStyle = this.gridColor;
                ctx.lineWidth = z === pitD ? 2.0 : 1.5;
            } else {
                ctx.strokeStyle = 'rgba(0, 220, 60, 0.45)';
                ctx.lineWidth = 1.0;
            }

            const p00 = proj.project(0, 0, z, screenW, screenH);
            const p10 = proj.project(pitW, 0, z, screenW, screenH);
            const p11 = proj.project(pitW, pitH, z, screenW, screenH);
            const p01 = proj.project(0, pitH, z, screenW, screenH);

            ctx.beginPath();
            ctx.moveTo(p00.x, p00.y);
            ctx.lineTo(p10.x, p10.y);
            ctx.lineTo(p11.x, p11.y);
            ctx.lineTo(p01.x, p01.y);
            ctx.closePath();
            ctx.stroke();

            // Floor grid (inner grid lines at the very bottom z = pitD)
            if (z === pitD) {
                ctx.strokeStyle = 'rgba(0, 220, 60, 0.55)';
                ctx.lineWidth = 1.0;
                ctx.beginPath();
                for (let x = 1; x < pitW; x++) {
                    const topP = proj.project(x, 0, pitD, screenW, screenH);
                    const botP = proj.project(x, pitH, pitD, screenW, screenH);
                    ctx.moveTo(topP.x, topP.y);
                    ctx.lineTo(botP.x, botP.y);
                }
                for (let y = 1; y < pitH; y++) {
                    const leftP = proj.project(0, y, pitD, screenW, screenH);
                    const rightP = proj.project(pitW, y, pitD, screenW, screenH);
                    ctx.moveTo(leftP.x, leftP.y);
                    ctx.lineTo(rightP.x, rightP.y);
                }
                ctx.stroke();
            }
        }

        ctx.restore();
    }

    /**
     * Gets depth-based color for a layer.
     * Layer index counted from bottom (layer 0 = pit floor).
     */
    getLayerColor(z, pitDepth) {
        // Distance from bottom floor
        const fromBottom = (pitDepth - 1) - z;
        if (fromBottom === 0) {
            // Bottom layer is classic DOS Royal Blue!
            return '#1e68ff';
        }
        const colorIdx = (LAYER_COLORS.length - 1) - Math.min(LAYER_COLORS.length - 1, fromBottom);
        return LAYER_COLORS[Math.max(0, colorIdx)];
    }

    /**
     * Renders placed blocks with Painter's depth sorting.
     */
    renderPlacedBlocks(gameState, screenW, screenH) {
        const ctx = this.ctx;
        const proj = this.projector;
        const grid = gameState.grid;
        const pitW = gameState.pitWidth;
        const pitH = gameState.pitHeight;
        const pitD = gameState.pitDepth;

        // Collect all visible faces of all placed cubes
        const faces = [];

        for (let x = 0; x < pitW; x++) {
            for (let y = 0; y < pitH; y++) {
                for (let z = 0; z < pitD; z++) {
                    if (!grid[x][y][z]) continue;

                    const color = this.getLayerColor(z, pitD);

                    // Front face facing player (z) - visible if cell in front (z-1) is empty
                    if (z === 0 || !grid[x][y][z - 1]) {
                        faces.push({
                            depth: z,
                            type: 'front',
                            color: color,
                            pts: [
                                [x, y, z],
                                [x + 1, y, z],
                                [x + 1, y + 1, z],
                                [x, y + 1, z]
                            ]
                        });
                    }

                    // Side faces: visible if facing camera and neighbor is empty
                    // Left face (visible if x < pitW/2 and left neighbor empty)
                    if (x < pitW / 2 && (x === 0 || !grid[x - 1][y][z])) {
                        faces.push({
                            depth: z + 0.5,
                            type: 'side',
                            color: this.shadeColor(color, -0.25),
                            pts: [
                                [x, y, z],
                                [x, y + 1, z],
                                [x, y + 1, z + 1],
                                [x, y, z + 1]
                            ]
                        });
                    }
                    // Right face (visible if x >= pitW/2 and right neighbor empty)
                    if (x >= pitW / 2 && (x === pitW - 1 || !grid[x + 1][y][z])) {
                        faces.push({
                            depth: z + 0.5,
                            type: 'side',
                            color: this.shadeColor(color, -0.25),
                            pts: [
                                [x + 1, y, z],
                                [x + 1, y, z + 1],
                                [x + 1, y + 1, z + 1],
                                [x + 1, y + 1, z]
                            ]
                        });
                    }
                    // Top face (visible if y < pitH/2 and top neighbor empty)
                    if (y < pitH / 2 && (y === 0 || !grid[x][y - 1][z])) {
                        faces.push({
                            depth: z + 0.5,
                            type: 'side',
                            color: this.shadeColor(color, 0.15),
                            pts: [
                                [x, y, z],
                                [x + 1, y, z],
                                [x + 1, y, z + 1],
                                [x, y, z + 1]
                            ]
                        });
                    }
                    // Bottom face (visible if y >= pitH/2 and bottom neighbor empty)
                    if (y >= pitH / 2 && (y === pitH - 1 || !grid[x][y + 1][z])) {
                        faces.push({
                            depth: z + 0.5,
                            type: 'side',
                            color: this.shadeColor(color, -0.35),
                            pts: [
                                [x, y + 1, z],
                                [x, y + 1, z + 1],
                                [x + 1, y + 1, z + 1],
                                [x + 1, y + 1, z]
                            ]
                        });
                    }
                }
            }
        }

        // Sort faces back to front (largest depth first)
        faces.sort((a, b) => b.depth - a.depth);

        ctx.save();
        for (const face of faces) {
            const p0 = proj.project(face.pts[0][0], face.pts[0][1], face.pts[0][2], screenW, screenH);
            const p1 = proj.project(face.pts[1][0], face.pts[1][1], face.pts[1][2], screenW, screenH);
            const p2 = proj.project(face.pts[2][0], face.pts[2][1], face.pts[2][2], screenW, screenH);
            const p3 = proj.project(face.pts[3][0], face.pts[3][1], face.pts[3][2], screenW, screenH);

            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.closePath();

            // Fill polygon with layer color
            ctx.fillStyle = face.color;
            ctx.fill();

            // Black or dark border around placed block faces
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1.4;
            ctx.stroke();
        }
        ctx.restore();
    }

    /**
     * Renders the falling piece as a crisp, bright white/cyan 3D wireframe polycube.
     */
    renderActivePiece(gameState, screenW, screenH) {
        const ctx = this.ctx;
        const proj = this.projector;
        const piece = gameState.activePiece;
        const pos = gameState.activePos;

        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.2;
        ctx.shadowColor = '#00f7ff';
        ctx.shadowBlur = 4;

        // Draw each unit cube of the piece
        for (const c of piece.cubes) {
            const x = pos.x + c.x;
            const y = pos.y + c.y;
            const z = pos.z + c.z;

            this.drawWireframeCube(ctx, proj, x, y, z, 1, screenW, screenH);
        }

        ctx.restore();
    }

    /**
     * Renders landing shadow (projection of active piece on the floor or landing level).
     */
    renderLandingShadow(gameState, screenW, screenH) {
        const dropZ = gameState.getLandingZ();
        if (dropZ === gameState.activePos.z) return;

        const ctx = this.ctx;
        const proj = this.projector;
        const piece = gameState.activePiece;
        const pos = gameState.activePos;

        ctx.save();
        ctx.strokeStyle = 'rgba(255, 235, 59, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 3]);

        for (const c of piece.cubes) {
            const x = pos.x + c.x;
            const y = pos.y + c.y;
            const z = dropZ + c.z;

            // Render front face of landing position
            const p0 = proj.project(x, y, z, screenW, screenH);
            const p1 = proj.project(x + 1, y, z, screenW, screenH);
            const p2 = proj.project(x + 1, y + 1, z, screenW, screenH);
            const p3 = proj.project(x, y + 1, z, screenW, screenH);

            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.closePath();
            ctx.stroke();
        }

        ctx.restore();
    }

    /**
     * Draws a single 3D wireframe cube at (x,y,z) with size s.
     */
    drawWireframeCube(ctx, proj, x, y, z, s, screenW, screenH) {
        const v = [
            proj.project(x, y, z, screenW, screenH),         // 0: front-top-left
            proj.project(x + s, y, z, screenW, screenH),     // 1: front-top-right
            proj.project(x + s, y + s, z, screenW, screenH), // 2: front-bot-right
            proj.project(x, y + s, z, screenW, screenH),     // 3: front-bot-left
            proj.project(x, y, z + s, screenW, screenH),     // 4: back-top-left
            proj.project(x + s, y, z + s, screenW, screenH), // 5: back-top-right
            proj.project(x + s, y + s, z + s, screenW, screenH), // 6: back-bot-right
            proj.project(x, y + s, z + s, screenW, screenH)  // 7: back-bot-left
        ];

        // Front face
        ctx.beginPath();
        ctx.moveTo(v[0].x, v[0].y);
        ctx.lineTo(v[1].x, v[1].y);
        ctx.lineTo(v[2].x, v[2].y);
        ctx.lineTo(v[3].x, v[3].y);
        ctx.closePath();
        ctx.stroke();

        // Back face
        ctx.beginPath();
        ctx.moveTo(v[4].x, v[4].y);
        ctx.lineTo(v[5].x, v[5].y);
        ctx.lineTo(v[6].x, v[6].y);
        ctx.lineTo(v[7].x, v[7].y);
        ctx.closePath();
        ctx.stroke();

        // Connecting side edges
        ctx.beginPath();
        ctx.moveTo(v[0].x, v[0].y); ctx.lineTo(v[4].x, v[4].y);
        ctx.moveTo(v[1].x, v[1].y); ctx.lineTo(v[5].x, v[5].y);
        ctx.moveTo(v[2].x, v[2].y); ctx.lineTo(v[6].x, v[6].y);
        ctx.moveTo(v[3].x, v[3].y); ctx.lineTo(v[7].x, v[7].y);
        ctx.stroke();
    }

    /**
     * Renders flashing white layer clear effect.
     */
    renderClearingAnimation(gameState, screenW, screenH) {
        const anim = gameState.clearingAnimation;
        if (!anim) return;

        const ctx = this.ctx;
        const proj = this.projector;
        const pitW = gameState.pitWidth;
        const pitH = gameState.pitHeight;

        ctx.save();
        const flashAlpha = Math.sin(anim.progress * Math.PI * 4) > 0 ? 0.85 : 0.2;
        ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;

        for (const z of anim.clearedLayers) {
            const p0 = proj.project(0, 0, z, screenW, screenH);
            const p1 = proj.project(pitW, 0, z, screenW, screenH);
            const p2 = proj.project(pitW, pitH, z, screenW, screenH);
            const p3 = proj.project(0, pitH, z, screenW, screenH);

            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    }

    /**
     * Renders the 3D Next Piece in the lower-left wireframe preview box.
     */
    renderNextPiecePreview(piece) {
        const ctx = this.nextCtx;
        const w = this.nextCanvas.width;
        const h = this.nextCanvas.height;
        if (!ctx || w === 0 || h === 0) return;

        // Clear preview canvas
        ctx.fillStyle = '#060907';
        ctx.fillRect(0, 0, w, h);

        const dims = piece.getDimensions();
        // Center offset
        const ox = (4 - dims.w) / 2;
        const oy = (4 - dims.h) / 2;
        const oz = (4 - dims.d) / 2;

        const proj = this.previewProjector;

        // Draw bounding box / wireframe cube cage
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 220, 60, 0.4)';
        ctx.lineWidth = 1.0;
        this.drawWireframeCube(ctx, proj, 0, 0, 0, 4, w, h);

        // Draw next piece inside cage with bright white wireframe
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.0;
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 3;

        for (const c of piece.cubes) {
            this.drawWireframeCube(ctx, proj, ox + c.x, oy + c.y, oz + c.z, 1, w, h);
        }

        ctx.restore();
    }

    /**
     * Color shading helper
     */
    shadeColor(color, percent) {
        let num = parseInt(color.replace('#', ''), 16);
        let amt = Math.round(255 * percent);
        let R = (num >> 16) + amt;
        let G = (num >> 8 & 0x00FF) + amt;
        let B = (num & 0x0000FF) + amt;
        return '#' + (
            0x1000000 +
            (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
            (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
            (B < 255 ? (B < 1 ? 0 : B) : 255)
        ).toString(16).slice(1);
    }
}
