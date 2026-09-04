/**
 * Blockdown - 3D Endless Marquee for Level Up Modal
 * Displays unlocked polycubes endlessly scrolling horizontally
 * and freely tumbling in 3D space with solid, opaque faces, authentic DOS shading,
 * and retro styling.
 */

// Authentic EGA / VGA palette for unlocked polycube demonstration
const PIECE_PALETTE = [
    '#00e5ff', // Bright Cyan
    '#ffd60a', // Bright Yellow
    '#00e640', // Emerald Green
    '#ff007f', // Deep Pink / Magenta
    '#ff9100', // Neon Orange
    '#bf5af2', // Purple
    '#76ff03', // Lime
    '#ff3b30'  // Coral Red
];

// Unit cube vertices centered at (0, 0, 0)
const CUBE_VERTICES = [
    [-0.5, -0.5, -0.5], // 0: Top-Left-Back
    [ 0.5, -0.5, -0.5], // 1: Top-Right-Back
    [ 0.5,  0.5, -0.5], // 2: Bot-Right-Back
    [-0.5,  0.5, -0.5], // 3: Bot-Left-Back
    [-0.5, -0.5,  0.5], // 4: Top-Left-Front
    [ 0.5, -0.5,  0.5], // 5: Top-Right-Front
    [ 0.5,  0.5,  0.5], // 6: Bot-Right-Front
    [-0.5,  0.5,  0.5]  // 7: Bot-Left-Front
];

// 6 Quad faces with vertex indices and outward unit normals
const CUBE_FACES = [
    { indices: [4, 5, 6, 7], normal: [0, 0, 1] },   // Front (+Z)
    { indices: [1, 0, 3, 2], normal: [0, 0, -1] },  // Back (-Z)
    { indices: [0, 1, 5, 4], normal: [0, -1, 0] },  // Top (-Y)
    { indices: [7, 6, 2, 3], normal: [0, 1, 0] },   // Bottom (+Y)
    { indices: [0, 4, 7, 3], normal: [-1, 0, 0] },  // Left (-X)
    { indices: [5, 1, 2, 6], normal: [1, 0, 0] }    // Right (+X)
];

export class Marquee3D {
    constructor(canvas = null) {
        this.canvas = canvas;
        this.ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
        this.pieces = [];
        this.scrollOffset = 0;
        this.scrollSpeed = 56; // Pixels per second
        this.itemSpacing = 150; // Spacing between piece centers
        this.cubeSize = 18; // 3D cube side size in pixels
        this.cameraDist = 6.0;
        this.animId = null;
        this.lastTime = 0;
        this.running = false;
    }

    /**
     * Set pieces to display in the marquee.
     * @param {Array} pieces - Array of piece definitions or objects with { name, cubes }
     */
    setPieces(pieces) {
        this.pieces = (pieces && pieces.length > 0) ? pieces : [];
        this.scrollOffset = 0;
    }

    /**
     * Returns a repeating list of pieces ensuring continuous marquee coverage.
     */
    getDisplayList(minWidth = 460) {
        if (!this.pieces || this.pieces.length === 0) return [];
        const minItems = Math.max(4, Math.ceil((minWidth + this.itemSpacing * 2) / this.itemSpacing));
        let list = [];
        while (list.length < minItems) {
            list = list.concat(this.pieces);
        }
        return list;
    }

    /**
     * Calculates the geometric center of a piece's cubes.
     */
    static getPieceCenter(cubes) {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        for (const c of cubes) {
            const x = Array.isArray(c) ? c[0] : c.x;
            const y = Array.isArray(c) ? c[1] : c.y;
            const z = Array.isArray(c) ? c[2] : c.z;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            if (z < minZ) minZ = z;
            if (z > maxZ) maxZ = z;
        }

        return {
            cx: (minX + maxX) / 2,
            cy: (minY + maxY) / 2,
            cz: (minZ + maxZ) / 2
        };
    }

    /**
     * Transforms a 3D vertex by Euler rotation angles (rotX, rotY, rotZ).
     */
    static rotateVertex(x, y, z, rotX, rotY, rotZ) {
        const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
        const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
        const cosZ = Math.cos(rotZ), sinZ = Math.sin(rotZ);

        // Pitch (around X)
        const y1 = y * cosX - z * sinX;
        const z1 = y * sinX + z * cosX;
        const x1 = x;

        // Yaw (around Y)
        const x2 = x1 * cosY + z1 * sinY;
        const z2 = -x1 * sinY + z1 * cosY;
        const y2 = y1;

        // Roll (around Z)
        const x3 = x2 * cosZ - y2 * sinZ;
        const y3 = x2 * sinZ + y2 * cosZ;
        const z3 = z2;

        return { x: x3, y: y3, z: z3 };
    }

    /**
     * Checks if a cube has a neighbor in the specified face direction (interior shared face).
     */
    static isInteriorFace(cubes, cx, cy, cz, nx, ny, nz) {
        const tx = cx + nx;
        const ty = cy + ny;
        const tz = cz + nz;
        for (const c of cubes) {
            const x = Array.isArray(c) ? c[0] : c.x;
            const y = Array.isArray(c) ? c[1] : c.y;
            const z = Array.isArray(c) ? c[2] : c.z;
            if (x === tx && y === ty && z === tz) {
                return true;
            }
        }
        return false;
    }

    /**
     * Splits piece name into main title and optional parenthesized descriptor for two-line layout.
     */
    static splitPieceName(name) {
        const rawName = (name || 'BLOCK').trim();
        const match = rawName.match(/^(.*?)\s*(\(.*?\))$/);
        if (match) {
            return {
                title: match[1].trim().toUpperCase(),
                descriptor: match[2].trim().toUpperCase()
            };
        }
        return {
            title: rawName.toUpperCase(),
            descriptor: null
        };
    }

    /**
     * Starts the continuous rendering loop.
     */
    start() {
        if (this.running) return;
        this.running = true;
        this.lastTime = performance.now();

        const loop = (time) => {
            if (!this.running) return;
            const dt = Math.min(0.1, (time - this.lastTime) / 1000);
            this.lastTime = time;

            this.update(dt);
            this.render(time / 1000);

            this.animId = requestAnimationFrame(loop);
        };

        this.animId = requestAnimationFrame(loop);
    }

    /**
     * Stops the rendering loop.
     */
    stop() {
        this.running = false;
        if (this.animId) {
            cancelAnimationFrame(this.animId);
            this.animId = null;
        }
    }

    /**
     * Advances the horizontal marquee scroll position.
     */
    update(dt) {
        const displayList = this.getDisplayList(this.canvas ? this.canvas.width : 460);
        if (displayList.length === 0) return;

        const totalWidth = displayList.length * this.itemSpacing;
        this.scrollOffset = (this.scrollOffset + this.scrollSpeed * dt) % totalWidth;
    }

    /**
     * Renders the full 3D marquee frame.
     */
    render(timeSec) {
        const ctx = this.ctx;
        if (!ctx || !this.canvas) return;

        const w = this.canvas.width;
        const h = this.canvas.height;

        // Clear dark CRT background
        ctx.fillStyle = '#030604';
        ctx.fillRect(0, 0, w, h);

        // Draw subtle DOS grid in background
        ctx.strokeStyle = 'rgba(0, 224, 64, 0.08)';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        for (let x = 0; x < w; x += 20) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
        }
        for (let y = 0; y < h; y += 20) {
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
        }
        ctx.stroke();

        // Draw background CRT scanlines BEFORE rendering pieces (so pieces stay 100% solid & opaque!)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        for (let y = 0; y < h; y += 3) {
            ctx.fillRect(0, y, w, 1);
        }

        const displayList = this.getDisplayList(w);
        if (displayList.length === 0) return;

        const totalWidth = displayList.length * this.itemSpacing;
        const centerY = 45; // Center height for tumbling 3D shapes

        // Render each 3D piece at its current marquee track position
        for (let i = 0; i < displayList.length; i++) {
            const piece = displayList[i];
            let itemX = (i * this.itemSpacing - this.scrollOffset);

            // Wrap items smoothly to maintain endless flow
            while (itemX < -this.itemSpacing) itemX += totalWidth;
            while (itemX > totalWidth - this.itemSpacing) itemX -= totalWidth;

            // Only render if within or touching visible viewport
            if (itemX < -this.itemSpacing || itemX > w + this.itemSpacing) continue;

            const baseColor = PIECE_PALETTE[i % PIECE_PALETTE.length];
            this.renderPiece3D(ctx, piece, itemX + this.itemSpacing / 2, centerY, timeSec, i, baseColor);
        }

        // Left edge fade vignette
        const leftGrad = ctx.createLinearGradient(0, 0, 32, 0);
        leftGrad.addColorStop(0, '#030604');
        leftGrad.addColorStop(1, 'rgba(3, 6, 4, 0)');
        ctx.fillStyle = leftGrad;
        ctx.fillRect(0, 0, 32, h);

        // Right edge fade vignette
        const rightGrad = ctx.createLinearGradient(w - 32, 0, w, 0);
        rightGrad.addColorStop(0, 'rgba(3, 6, 4, 0)');
        rightGrad.addColorStop(1, '#030604');
        ctx.fillStyle = rightGrad;
        ctx.fillRect(w - 32, 0, 32, h);
    }

    /**
     * Renders a single polycube freely rotating in 3D space with solid, 100% opaque faces.
     */
    renderPiece3D(ctx, piece, centerX, centerY, timeSec, index, baseColor) {
        const cubes = piece.cubes || [];
        if (cubes.length === 0) return;

        const center = Marquee3D.getPieceCenter(cubes);

        // Distinct 3D tumbling rotation rates per item for dynamic visual interest
        const rotX = timeSec * 1.5 + index * 0.75;
        const rotY = timeSec * 2.1 + index * 1.15;
        const rotZ = timeSec * 0.9 + index * 0.45;

        // Light direction in eye space (from top-left-front)
        const lightDir = { x: -0.35, y: -0.65, z: -0.65 };

        // Collect all exterior quad faces across all cubes in this polycube
        const facesToDraw = [];

        for (const c of cubes) {
            const cx = Array.isArray(c) ? c[0] : c.x;
            const cy = Array.isArray(c) ? c[1] : c.y;
            const cz = Array.isArray(c) ? c[2] : c.z;

            // Local cube center relative to piece mass center
            const ox = cx - center.cx;
            const oy = cy - center.cy;
            const oz = cz - center.cz;

            // Transform each of the 6 cube faces
            for (const face of CUBE_FACES) {
                const nx = face.normal[0];
                const ny = face.normal[1];
                const nz = face.normal[2];

                // Skip interior faces between adjacent cubes for a completely solid 3D polycube!
                if (Marquee3D.isInteriorFace(cubes, cx, cy, cz, nx, ny, nz)) {
                    continue;
                }

                // Face center in piece object space
                const fcx = ox + nx * 0.5;
                const fcy = oy + ny * 0.5;
                const fcz = oz + nz * 0.5;

                // Rotate face center and outward normal
                const rotFC = Marquee3D.rotateVertex(fcx, fcy, fcz, rotX, rotY, rotZ);
                const rotNorm = Marquee3D.rotateVertex(nx, ny, nz, rotX, rotY, rotZ);

                // Outward face normal dot view direction towards camera (camera at (0, 0, -cameraDist))
                // View vector from face to camera: (0 - rotFC.x, 0 - rotFC.y, -cameraDist - rotFC.z)
                const vx = -rotFC.x;
                const vy = -rotFC.y;
                const vz = -this.cameraDist - rotFC.z;
                const viewDot = rotNorm.x * vx + rotNorm.y * vy + rotNorm.z * vz;

                // Backface culling: only draw faces oriented towards the camera
                if (viewDot <= 0) continue;

                // Transform and project the 4 quad corners
                const quadPoints = [];
                for (const idx of face.indices) {
                    const vert = CUBE_VERTICES[idx];
                    const rx = ox + vert[0];
                    const ry = oy + vert[1];
                    const rz = oz + vert[2];

                    const rotV = Marquee3D.rotateVertex(rx, ry, rz, rotX, rotY, rotZ);
                    const scale = this.cameraDist / (this.cameraDist + rotV.z);
                    const px = centerX + rotV.x * this.cubeSize * scale;
                    const py = centerY + rotV.y * this.cubeSize * scale;
                    quadPoints.push({ x: px, y: py });
                }

                // Directional diffuse lighting
                const dot = -(rotNorm.x * lightDir.x + rotNorm.y * lightDir.y + rotNorm.z * lightDir.z);
                const diffuse = Math.max(0, dot);
                const brightness = Math.min(1.15, 0.45 + 0.55 * diffuse);

                facesToDraw.push({
                    pts: quadPoints,
                    avgZ: rotFC.z, // Smaller Z is closer to camera; larger Z is further away
                    brightness,
                    color: baseColor
                });
            }
        }

        // Painter's algorithm: sort back-to-front (largest Z / deepest faces drawn first)
        facesToDraw.sort((a, b) => b.avgZ - a.avgZ);

        // Draw 100% solid, fully opaque faces with bevel lighting and crisp outlines
        for (const face of facesToDraw) {
            const [p0, p1, p2, p3] = face.pts;

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.closePath();

            // 100% solid opaque face fill
            ctx.fillStyle = Marquee3D.shadeRgb(face.color, face.brightness);
            ctx.fill();

            // Crisp dark border outline defining cube facets
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1.6;
            ctx.stroke();

            // Specular / bevel highlight on illuminated edges
            if (face.brightness > 0.65) {
                ctx.beginPath();
                ctx.moveTo(p3.x, p3.y);
                ctx.lineTo(p0.x, p0.y);
                ctx.lineTo(p1.x, p1.y);
                ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.55, (face.brightness - 0.6) * 1.1)})`;
                ctx.lineWidth = 1.3;
                ctx.stroke();
            }

            ctx.restore();
        }

        // Render retro arcade piece title label below the tumbling 3D piece
        // Moves parenthesized descriptors like (Snake), (Corner), (3D Chiral) to a new line
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 4;

        const { title, descriptor } = Marquee3D.splitPieceName(piece.name);

        if (descriptor) {
            // Two-line layout: main title on top, descriptor below
            ctx.font = '9px "Press Start 2P", monospace';
            ctx.fillStyle = '#ffea00';
            ctx.shadowColor = 'rgba(255, 234, 0, 0.6)';
            ctx.fillText(title, centerX, 102);

            ctx.font = '8px "Press Start 2P", monospace';
            ctx.fillStyle = '#00e5ff';
            ctx.shadowColor = 'rgba(0, 229, 255, 0.6)';
            ctx.fillText(descriptor, centerX, 118);
        } else {
            // Single line layout: centered vertically
            ctx.font = '10px "Press Start 2P", monospace';
            ctx.fillStyle = '#ffea00';
            ctx.shadowColor = 'rgba(255, 234, 0, 0.6)';
            ctx.fillText(title, centerX, 110);
        }

        ctx.restore();
    }

    /**
     * Color shading helper to multiply hex RGB by a brightness factor.
     */
    static shadeRgb(hexColor, factor) {
        const hex = hexColor.replace('#', '');
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);

        const sr = Math.min(255, Math.floor(r * factor));
        const sg = Math.min(255, Math.floor(g * factor));
        const sb = Math.min(255, Math.floor(b * factor));

        return `rgb(${sr},${sg},${sb})`;
    }
}
