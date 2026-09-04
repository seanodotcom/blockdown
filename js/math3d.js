/**
 * Blockdown - 3D Math & Perspective Projection Engine
 * Provides integer rotation matrices, vector operations, and 3D-to-2D perspective projection.
 */

export class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = Math.round(x);
        this.y = Math.round(y);
        this.z = Math.round(z);
    }

    clone() {
        return new Vector3(this.x, this.y, this.z);
    }

    add(v) {
        return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z);
    }

    sub(v) {
        return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z);
    }

    equals(v) {
        return this.x === v.x && this.y === v.y && this.z === v.z;
    }
}

/**
 * 90-degree rotations in 3D integer coordinates around origin.
 * Avoids any floating-point drift.
 */
export const Rotations = {
    // Pitch: Rotation around X axis (tilt forward/backward in the pit)
    pitch(v, dir = 1) {
        // dir = 1: 90 deg (+Y -> +Z, +Z -> -Y)
        // dir = -1: -90 deg
        if (dir === 1) {
            return new Vector3(v.x, -v.z, v.y);
        } else {
            return new Vector3(v.x, v.z, -v.y);
        }
    },

    // Yaw: Rotation around Y axis (turn left/right)
    yaw(v, dir = 1) {
        // dir = 1: 90 deg (+X -> -Z, +Z -> +X)
        if (dir === 1) {
            return new Vector3(-v.z, v.y, v.x);
        } else {
            return new Vector3(v.z, v.y, -v.x);
        }
    },

    // Roll: Rotation around Z axis (flat 2D spin clockwise/counter-clockwise)
    roll(v, dir = 1) {
        // dir = 1: 90 deg (+X -> +Y, +Y -> -X)
        if (dir === 1) {
            return new Vector3(-v.y, v.x, v.z);
        } else {
            return new Vector3(v.y, -v.x, v.z);
        }
    }
};

/**
 * Perspective Camera & Projector looking down the pit.
 * Origin (0,0,0) is top-left-front of the pit.
 * Z increases going deeper into the pit (0 = pit entrance, depth = pit floor).
 */
export class PerspectiveProjector {
    constructor(pitWidth = 5, pitHeight = 5, pitDepth = 12) {
        this.pitWidth = pitWidth;
        this.pitHeight = pitHeight;
        this.pitDepth = pitDepth;
        
        // Distance of virtual camera in front of the pit entrance
        this.cameraZ = -3.2;
        // Distance scaling factor for perspective
        this.fovScale = 1.15;
    }

    setPitDimensions(w, h, d) {
        this.pitWidth = w;
        this.pitHeight = h;
        this.pitDepth = d;
    }

    /**
     * Projects a 3D point (in pit coordinates) onto 2D canvas coordinates.
     * @param {number} x - X coordinate in pit (0 to pitWidth)
     * @param {number} y - Y coordinate in pit (0 to pitHeight)
     * @param {number} z - Z coordinate in pit (0 to pitDepth)
     * @param {number} canvasWidth - Viewport width
     * @param {number} canvasHeight - Viewport height
     * @returns {{x: number, y: number, scale: number}}
     */
    project(x, y, z, canvasWidth, canvasHeight) {
        const cx = this.pitWidth / 2;
        const cy = this.pitHeight / 2;

        const rx = x - cx;
        const ry = y - cy;

        const dist = z - this.cameraZ;
        const scale = (0 - this.cameraZ) / Math.max(0.1, dist);

        const baseSize = Math.min(canvasWidth, canvasHeight) * 0.90;
        const aspect = this.pitWidth / this.pitHeight;

        let unitPixels;
        if (aspect >= 1) {
            unitPixels = (baseSize / this.pitWidth) * this.fovScale;
        } else {
            unitPixels = (baseSize / this.pitHeight) * this.fovScale;
        }

        const screenX = (canvasWidth / 2) + rx * unitPixels * scale;
        const screenY = (canvasHeight / 2) + ry * unitPixels * scale;

        return { x: screenX, y: screenY, scale: scale };
    }
}
