import { BlockdownGame } from './js/game.js';
import { BlockdownAI } from './js/ai.js';
import { PieceManager, PIECE_DEFINITIONS } from './js/polycubes.js';
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

// Clear layer #3 -> Should trigger LEVEL UP!
for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) game.grid[x][y][11] = true;
game.checkCompletedLayers();
game.finishClearingLayers(game.clearingAnimation.clearedLayers);
console.log('Layer #3 cleared. Total cleared:', game.layersClearedTotal, 'Level:', game.level);
if (game.level !== 1 || game.layersClearedTotal !== 3) {
    throw new Error(`Expected level to advance to 1 after 3 layers, got ${game.level}`);
}
console.log('Level progressed to 1 strictly after 3 complete grid clears!');

// 5. Test AI
console.log('Testing BlockdownAI solver...');
const ai = new BlockdownAI();
const bestMove = ai.findBestMove(game);
console.log('AI Best Move found:', bestMove);
if (!bestMove) {
    throw new Error('AI should find a valid move');
}

console.log('--- ALL ENGINE TESTS PASSED! ---');
