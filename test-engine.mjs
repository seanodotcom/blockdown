import { BlockdownGame } from './js/game.js';
import { BlockdownAI } from './js/ai.js';
import { Piece, PieceManager, PIECE_DEFINITIONS } from './js/polycubes.js';
import { Rotations, Vector3 } from './js/math3d.js';

console.log('--- Testing Blockdown Game Engine ---');

// 1. Test Piece Manager & Progression
const pm = new PieceManager();
console.log('Level 0 pieces count:', pm.getAvailablePieces().length);
if (pm.getAvailablePieces().length !== 4) {
    throw new Error(`Expected 4 pieces at level 0, got ${pm.getAvailablePieces().length}`);
}

pm.setLevel(1);
console.log('Level 1 pieces count:', pm.getAvailablePieces().length);
if (pm.getAvailablePieces().length !== 8) {
    throw new Error(`Expected 8 pieces at level 1, got ${pm.getAvailablePieces().length}`);
}

// 2. Test Rotations
const v = new Vector3(1, 2, 0);
const pitched = Rotations.pitch(v, 1);
const yawed = Rotations.yaw(v, 1);
const rolled = Rotations.roll(v, 1);
console.log('Rotations working:', { pitched, yawed, rolled });

// 3. Test Game Instance
let scoreUpdates = 0;
let levelUps = 0;

const game = new BlockdownGame({
    pitWidth: 5,
    pitHeight: 5,
    pitDepth: 12,
    onScoreChange: () => scoreUpdates++,
    onLevelUp: () => levelUps++
});

console.log('Initial state:', {
    pit: `${game.pitWidth}x${game.pitHeight}x${game.pitDepth}`,
    level: game.level,
    score: game.score,
    activePiece: game.activePiece.name
});

// Test moves
const movedRight = game.move(1, 0);
console.log('Move right:', movedRight, 'New pos:', game.activePos);

const rotatedPitch = game.rotate('pitch', 1);
console.log('Rotate pitch:', rotatedPitch);

const landingZ = game.getLandingZ();
console.log('Landing Z:', landingZ);

// Test hard drop
game.hardDrop();
console.log('After hard drop:', {
    score: game.score,
    cubesPlayed: game.cubesPlayed,
    activePiece: game.activePiece.name
});

if (game.cubesPlayed <= 0) {
    throw new Error('Cubes played should increase after drop');
}

// 4. Test Layer Clear & Level Progression strictly on complete layers
console.log('Testing 5x5 layer clear and level progression...');
// Initially level 0 with 0 clears
if (game.level !== 0 || game.layersClearedTotal !== 0) {
    throw new Error('Game should start at level 0 with 0 clears');
}

// Clear layer #1
for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) game.grid[x][y][11] = true;
game.checkCompletedLayers();
if (!game.clearingAnimation || Math.abs(game.clearingAnimation.duration - 0.42) > 0.001) {
    throw new Error(`Expected clearingAnimation duration of 0.42s for 3 flashes, got ${game.clearingAnimation?.duration}`);
}
game.finishClearingLayers(game.clearingAnimation.clearedLayers);
console.log('Layer #1 cleared. Total cleared:', game.layersClearedTotal, 'Level:', game.level);
if (game.level !== 0 || game.layersClearedTotal !== 1) {
    throw new Error('Level should still be 0 after 1 cleared layer');
}

// Clear layer #2
for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) game.grid[x][y][11] = true;
game.checkCompletedLayers();
game.finishClearingLayers(game.clearingAnimation.clearedLayers);
console.log('Layer #2 cleared. Total cleared:', game.layersClearedTotal, 'Level:', game.level);
if (game.level !== 0 || game.layersClearedTotal !== 2) {
    throw new Error('Level should still be 0 after 2 cleared layers');
}

// Clear layer #3 -> Should trigger onLevelUp callback and advance level!
let levelUpFiredWith = null;
let levelUpIsBlockout = null;
let blockoutLeveledUp = null;

game.onLevelUp = (lvl, pieces, cleared, isBlockout) => {
    levelUpFiredWith = lvl;
    levelUpIsBlockout = isBlockout;
};
game.onBlockout = (leveledUp) => {
    blockoutLeveledUp = leveledUp;
};

for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) game.grid[x][y][11] = true;
game.checkCompletedLayers();
game.finishClearingLayers(game.clearingAnimation.clearedLayers);
console.log('Layer #3 cleared. Total cleared:', game.layersClearedTotal, 'Level:', game.level);
if (game.level !== 1 || game.layersClearedTotal !== 3) {
    throw new Error(`Expected level to advance to 1 after 3 layers, got ${game.level}`);
}
if (levelUpFiredWith !== 1) {
    throw new Error(`Expected onLevelUp callback to fire with level 1, got ${levelUpFiredWith}`);
}
if (levelUpIsBlockout !== true) {
    throw new Error(`Expected onLevelUp isBlockout to be true when pit is emptied, got ${levelUpIsBlockout}`);
}
if (blockoutLeveledUp !== true) {
    throw new Error(`Expected onBlockout leveledUp to be true, got ${blockoutLeveledUp}`);
}
console.log('Level progressed to 1 strictly after 3 complete grid clears (with coordinated Blockout + Level Up verified)!');

// 5. Test AI pacing and solver
console.log('Testing BlockdownAI solver and pacing...');
const ai = new BlockdownAI();
if (ai.stepCooldown !== 0.4) {
    throw new Error(`Expected initial AI cooldown of 0.4s, got ${ai.stepCooldown}`);
}
const bestMove = ai.findBestMove(game);
console.log('AI Best Move found:', bestMove);
if (!bestMove) {
    throw new Error('AI should find a valid move');
}

// 6. Test Landing Shadow Support & Red Hole-Cover Warning Outlines
console.log('Testing Landing Shadow support & red outline detection...');
import('./js/renderer.js').then(({ GameRenderer }) => {
    const renderer = new GameRenderer();

    // Setup a clean game with 24/25 blocks filled at bottom layer (z = 11)
    const shadowGame = new BlockdownGame({ pitWidth: 5, pitHeight: 5, pitDepth: 12 });
    for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
            shadowGame.grid[x][y][11] = true;
        }
    }
    // Leave exactly 1 blank space at (2, 2, 11)
    shadowGame.grid[2][2][11] = false;

    // Create a 2x1 piece (Domino)
    const dominoDef = PIECE_DEFINITIONS.find(p => p.id === 'domino');
    shadowGame.activePiece = new Piece(dominoDef);

    // Place 2x1 domino horizontal hovering over (1, 2) and (2, 2) at z=0
    shadowGame.activePos = new Vector3(1, 2, 0);

    // It should stop at z = 10 because block at (1, 2) hits (1, 2, 11)
    const landingZ = shadowGame.getLandingZ();
    console.log('Horizontal Domino landing Z over 1 blank space:', landingZ);
    if (landingZ !== 10) {
        throw new Error(`Expected landing Z = 10, got ${landingZ}`);
    }

    const shadowData = renderer.getShadowCubeData(shadowGame);
    console.log('Shadow cubes support data:', shadowData.map(d => ({ x: d.x, y: d.y, z: d.z, isSupported: d.isSupported })));

    const supportedCube = shadowData.find(d => d.x === 1 && d.y === 2);
    const holeCoverCube = shadowData.find(d => d.x === 2 && d.y === 2);

    if (!supportedCube || !supportedCube.isSupported) {
        throw new Error('Cube at (1,2) over solid block should be isSupported = true (Yellow)');
    }
    if (!holeCoverCube || holeCoverCube.isSupported) {
        throw new Error('Cube at (2,2) over hole should be isSupported = false (RED outline)');
    }
    console.log('PASS: Horizontal 2x1 over hole correctly outlines hole-covering block in RED and supported block in YELLOW!');

    // Now test rotating the 2x1 piece to vertical (1x1x2) at (2, 2)
    shadowGame.activePiece.rotate('yaw', 1); // Now vertical in Z (cubes at (0,0,0) and (0,0,1))
    shadowGame.activePos = new Vector3(2, 2, 0);

    const verticalLandingZ = shadowGame.getLandingZ();
    console.log('Vertical Domino landing Z into blank space:', verticalLandingZ);
    if (verticalLandingZ !== 10) {
        throw new Error(`Expected vertical landing Z = 10 (reaches floor at 11), got ${verticalLandingZ}`);
    }

    const verticalShadowData = renderer.getShadowCubeData(shadowGame);
    console.log('Vertical shadow cubes support data:', verticalShadowData.map(d => ({ x: d.x, y: d.y, z: d.z, isSupported: d.isSupported })));
    for (const d of verticalShadowData) {
        if (!d.isSupported) {
            throw new Error(`All vertical cubes entering hole should reach floor support, but cube at (${d.x},${d.y},${d.z}) was unsupported`);
        }
    }
    console.log('PASS: Vertical 2x1 entering hole reaches floor; both cubes are supported (YELLOW)!');

    // 7. Test Fall Speed Progression Curve
    console.log('Testing softened fall speed progression curve...');
    const speedGame = new BlockdownGame();
    speedGame.level = 0;
    const speedL0 = speedGame.getFallInterval();
    speedGame.level = 1;
    const speedL1 = speedGame.getFallInterval();
    speedGame.level = 3;
    const speedL3 = speedGame.getFallInterval();
    console.log('Fall intervals: Level 0 =', speedL0, 'Level 1 =', speedL1, 'Level 3 =', speedL3);
    if (Math.abs(speedL0 - 1.05) > 0.001 || Math.abs(speedL1 - 1.00) > 0.001 || Math.abs(speedL3 - 0.90) > 0.001) {
        throw new Error(`Unexpected fall intervals: L0=${speedL0}, L1=${speedL1}, L3=${speedL3}`);
    }
    console.log('PASS: Fall speed progression curve is gentle (50ms per level)!');

    // 8. Test Layer Color Differentiation
    console.log('Testing layer color differentiation...');
    const floorColor = renderer.getLayerColor(11, 12);
    const layer2Color = renderer.getLayerColor(10, 12);
    const layer3Color = renderer.getLayerColor(9, 12);
    const layer4Color = renderer.getLayerColor(8, 12);
    console.log('Layer colors from bottom up:', {
        floor: floorColor,
        level2: layer2Color,
        level3: layer3Color,
        level4: layer4Color
    });
    if (floorColor !== '#1868ff') {
        throw new Error(`Expected floor layer to be classic Royal Blue (#1868ff), got ${floorColor}`);
    }
    if (layer2Color !== '#00e5ff') {
        throw new Error(`Expected level 2 layer to be Bright Cyan (#00e5ff), got ${layer2Color}`);
    }
    if (layer3Color !== '#00e640') {
        throw new Error(`Expected level 3 layer to be Emerald Green (#00e640), got ${layer3Color}`);
    }
    // Verify all 12 depths have distinct colors
    const colors = [];
    for (let z = 0; z < 12; z++) {
        colors.push(renderer.getLayerColor(z, 12));
    }
    const uniqueColors = new Set(colors);
    if (uniqueColors.size !== 12) {
        throw new Error(`Expected 12 unique layer colors across 12 depths, got ${uniqueColors.size}`);
    }
    // 9. Test Marquee3D Endless Scrolling & 3D Math
    console.log('Testing Marquee3D endless marquee and 3D transformations...');
    import('./js/marquee3d.js').then(({ Marquee3D }) => {
        const marquee = new Marquee3D();
        const unlockedL1 = [
            { id: 'tetra_o', name: 'Square-O', cubes: [[0,0,0],[1,0,0],[0,1,0],[1,1,0]] },
            { id: 'tetra_i', name: 'Straight-I', cubes: [[-1,0,0],[0,0,0],[1,0,0],[2,0,0]] },
            { id: 'tetra_l', name: 'Flat-L', cubes: [[-1,0,0],[0,0,0],[1,0,0],[-1,1,0]] }
        ];

        marquee.setPieces(unlockedL1);
        const displayList = marquee.getDisplayList(460);
        console.log(`Marquee display list item count for 460px: ${displayList.length}`);
        if (displayList.length < 4) {
            throw new Error(`Expected at least 4 items in display list for seamless loop, got ${displayList.length}`);
        }

        // Test piece geometric center
        const center = Marquee3D.getPieceCenter(unlockedL1[0].cubes);
        console.log('Square-O geometric center:', center);
        if (Math.abs(center.cx - 0.5) > 0.001 || Math.abs(center.cy - 0.5) > 0.001 || Math.abs(center.cz - 0) > 0.001) {
            throw new Error(`Expected center (0.5, 0.5, 0), got (${center.cx}, ${center.cy}, ${center.cz})`);
        }

        // Test 3D vertex rotation
        const rotated = Marquee3D.rotateVertex(1, 0, 0, 0, Math.PI / 2, 0);
        console.log('Rotated (1,0,0) by 90 deg Yaw:', rotated);
        if (Math.abs(rotated.x) > 0.001 || Math.abs(rotated.z - (-1)) > 0.001) {
            throw new Error(`Expected rotated vertex ~ (0, 0, -1), got (${rotated.x}, ${rotated.y}, ${rotated.z})`);
        }

        // Test scroll update wrapping
        marquee.scrollOffset = 0;
        marquee.update(1.0); // scrollSpeed = 56 px/s
        if (Math.abs(marquee.scrollOffset - 56) > 0.001) {
            throw new Error(`Expected scrollOffset 56 after 1s, got ${marquee.scrollOffset}`);
        }

        // Test color shading
        const shaded = Marquee3D.shadeRgb('#00e5ff', 0.5);
        if (shaded !== 'rgb(0,114,127)') {
            throw new Error(`Expected rgb(0,114,127), got ${shaded}`);
        }

        // Test piece name descriptor splitting onto new line
        const splitWithDesc = Marquee3D.splitPieceName('3D Tripod (Corner)');
        console.log('Split 3D Tripod (Corner):', splitWithDesc);
        if (splitWithDesc.title !== '3D TRIPOD' || splitWithDesc.descriptor !== '(CORNER)') {
            throw new Error(`Expected { title: '3D TRIPOD', descriptor: '(CORNER)' }, got ${JSON.stringify(splitWithDesc)}`);
        }

        const splitWithoutDesc = Marquee3D.splitPieceName('Square-O');
        if (splitWithoutDesc.title !== 'SQUARE-O' || splitWithoutDesc.descriptor !== null) {
            throw new Error(`Expected { title: 'SQUARE-O', descriptor: null }, got ${JSON.stringify(splitWithoutDesc)}`);
        }
        console.log('PASS: Marquee3D endless wrapping, 3D rotations, shading, and descriptor splitting verified!');

        console.log('--- ALL ENGINE, SHADOW, AND MARQUEE TESTS PASSED! ---');
    });
});
