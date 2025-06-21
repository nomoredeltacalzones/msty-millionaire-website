// -----------------------------------------------------------------------------
// MSTY Dividend Defender - Core Game Logic
// -----------------------------------------------------------------------------

// I. GAME SETUP
// -----------------------------------------------------------------------------

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game constants
const FPS = 30;
const frameInterval = 1000 / FPS;
let lastTime = 0;
let timer = 0;

// DOS-style color palette (EGA)
const colors = {
    black: '#000000',
    blue: '#0000AA',
    green: '#00AA00',
    cyan: '#00AAAA',
    red: '#AA0000',
    magenta: '#AA00AA',
    brown: '#AA5500',
    lightGray: '#AAAAAA',
    darkGray: '#555555',
    lightBlue: '#5555FF',
    lightGreen: '#55FF55',
    lightCyan: '#55FFFF',
    lightRed: '#FF5555',
    lightMagenta: '#FF55FF',
    yellow: '#FFFF55',
    white: '#FFFFFF',
};

// II. STATE MANAGEMENT
// -----------------------------------------------------------------------------
// Here we'll track everything about the current game session.
const gameState = {
    level: 1,
    score: 0,
    health: 100,
    isGameOver: false,
    isPaused: false,
    // Add more states as needed: paused, etc.
};

// Player (the "bucket")
const player = {
    x: canvas.width / 2 - 25,
    y: canvas.height - 20,
    width: 50,
    height: 10,
    speed: 5,
    dx: 0, // Direction of movement
};

// Input handling
const keys = {
    right: false,
    left: false,
};

// Object management
let fallingObjects = [];
let spawnTimer = 0;
const spawnInterval = 1000; // Spawn a new object every 1 second

// Game object types
const objectTypes = {
    dividend: { color: colors.lightGreen, points: 10, health: 0, char: '$' },
    volatility: { color: colors.lightRed, points: -5, health: -10, char: 'V' },
    premium: { color: colors.yellow, points: 50, health: 0, char: 'P' },
    assignment: { color: colors.lightMagenta, points: 0, health: -25, char: '!' },
};

// Level progression
const scoreToNextLevel = 200;

// Educational Content
const educationalFacts = [
    "MSTY seeks to generate monthly income via a covered call strategy.",
    "Covered calls involve selling call options on an underlying asset.",
    "Dividends are payments made by a corporation to its shareholders.",
    "Volatility can increase the premium received from selling options.",
    "An 'assignment' means you must sell your shares at the strike price.",
    "Diversification helps manage risk in an investment portfolio.",
    "High-yield investments often come with higher risk.",
    "Reinvesting dividends can take advantage of compound growth."
];

// Leaderboard State
let leaderboard = [];
let showLeaderboard = false;

// III. AUDIO MANAGER
// -----------------------------------------------------------------------------
class AudioManager {
    constructor() {
        this.sounds = {
            collect: new Audio('games/msty-dividend-defender/sounds/collect.wav'),
            hurt: new Audio('games/msty-dividend-defender/sounds/hurt.wav'),
            levelUp: new Audio('games/msty-dividend-defender/sounds/levelUp.wav')
        };
    }

    play(soundName) {
        const sound = this.sounds[soundName];
        if (sound) {
            sound.currentTime = 0; // Rewind to the start
            sound.play().catch(e => console.error(`Could not play sound: ${soundName}`, e));
        }
    }
}
const audioManager = new AudioManager();

// IV. GAME OBJECT CLASS
// -----------------------------------------------------------------------------
class GameObject {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.width = 10;
        this.height = 10;
        this.speed = 1 + Math.random() * 1.5; // Add some variety to speed
    }

    // Update object's position
    update() {
        this.y += this.speed;
    }

    // Draw the object on the canvas
    draw(ctx) {
        ctx.fillStyle = this.type.color;
        ctx.font = 'bold 16px "Courier New", Courier, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(this.type.char, this.x + this.width / 2, this.y + this.height);
    }
}

// IV. GAME LOGIC & UPDATES
// -----------------------------------------------------------------------------

/**
 * Spawns new objects based on the current level.
 */
function spawnObject() {
    const x = Math.random() * (canvas.width - 20) + 10;
    
    // Level-based spawning logic
    const levelProbabilities = {
        1: { dividend: 1.0 },
        2: { dividend: 0.7, volatility: 0.3 },
        3: { dividend: 0.6, volatility: 0.2, premium: 0.2 },
        4: { dividend: 0.5, volatility: 0.3, premium: 0.15, assignment: 0.05 }
    };

    const currentLevelProbs = levelProbabilities[gameState.level] || levelProbabilities[4];
    const rand = Math.random();
    let cumulativeProb = 0;
    let selectedTypeKey;

    for (const key in currentLevelProbs) {
        cumulativeProb += currentLevelProbs[key];
        if (rand <= cumulativeProb) {
            selectedTypeKey = key;
            break;
        }
    }
    
    const type = objectTypes[selectedTypeKey];
    fallingObjects.push(new GameObject(x, 0, type));
}

/**
 * AABB Collision Detection
 * @param {object} rect1
 * @param {object} rect2
 * @returns {boolean}
 */
function checkCollision(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
    );
}

/**
 * Updates the game state for each frame.
 * @param {number} deltaTime - Time elapsed since the last frame.
 */
function update(deltaTime) {
    if (gameState.isGameOver || gameState.isPaused) return;

    // Handle player input for movement
    if (keys.right) player.dx = player.speed;
    else if (keys.left) player.dx = -player.speed;
    else player.dx = 0;
    
    player.x += player.dx;

    // Wall collision for player
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

    // Spawn new objects
    spawnTimer += deltaTime;
    if (spawnTimer > spawnInterval) {
        spawnObject();
        spawnTimer = 0;
    }

    // Update and check collisions for all falling objects
    for (let i = fallingObjects.length - 1; i >= 0; i--) {
        const obj = fallingObjects[i];
        obj.update();

        if (checkCollision(player, obj)) {
            gameState.score += obj.type.points;
            gameState.health += obj.type.health;
            
            if (obj.type.health < 0) {
                audioManager.play('hurt');
            } else {
                audioManager.play('collect');
            }

            fallingObjects.splice(i, 1);
            continue;
        }

        if (obj.y > canvas.height) {
            fallingObjects.splice(i, 1);
        }
    }

    // Check for level up
    if (gameState.score >= gameState.level * scoreToNextLevel) {
        gameState.level++;
        gameState.isPaused = true;
        audioManager.play('levelUp');
    }

    // Check for game over condition
    if (gameState.health <= 0) {
        gameState.isGameOver = true;
        gameState.health = 0;
        submitScore();
    }
}

// V. RENDERING
// -----------------------------------------------------------------------------

/**
 * Draws the entire game screen.
 */
function draw() {
    ctx.fillStyle = colors.black;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = colors.lightGray;
    ctx.fillRect(player.x, player.y, player.width, player.height);
    ctx.fillRect(player.x + 5, player.y - 5, player.width - 10, 5);

    fallingObjects.forEach(obj => obj.draw(ctx));

    ctx.fillStyle = colors.white;
    ctx.font = '16px "Courier New", Courier, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${gameState.score}`, 10, 20);
    ctx.fillText(`Health: ${gameState.health}`, canvas.width - 110, 20);
    ctx.fillText(`Level: ${gameState.level}`, canvas.width / 2 - 40, 20);

    if (gameState.isGameOver) {
        ctx.fillStyle = colors.lightRed;
        ctx.font = '24px "Courier New", Courier, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 10);
        ctx.font = '16px "Courier New", Courier, monospace';
        ctx.fillText('Press Enter to Restart', canvas.width / 2, canvas.height / 2 + 10);
        ctx.fillText('Press "L" for Leaderboard', canvas.width / 2, canvas.height / 2 + 30);
    }

    // Draw educational pop-up if paused
    if (gameState.isPaused && !gameState.isGameOver) {
        // Semi-transparent background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Pop-up box
        ctx.fillStyle = colors.darkGray;
        ctx.fillRect(20, 40, canvas.width - 40, canvas.height - 80);
        ctx.strokeStyle = colors.white;
        ctx.strokeRect(20, 40, canvas.width - 40, canvas.height - 80);

        // Text
        ctx.fillStyle = colors.white;
        ctx.font = 'bold 16px "Courier New", Courier, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('LEVEL UP!', canvas.width / 2, 70);
        
        ctx.font = '12px "Courier New", Courier, monospace';
        const fact = educationalFacts[(gameState.level - 2) % educationalFacts.length];
        // Poor man's text wrapping
        const words = fact.split(' ');
        let line = '';
        let y = 100;
        for(let n = 0; n < words.length; n++) {
            let testLine = line + words[n] + ' ';
            let metrics = ctx.measureText(testLine);
            if (metrics.width > canvas.width - 60 && n > 0) {
                ctx.fillText(line, canvas.width / 2, y);
                line = words[n] + ' ';
                y += 15;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, canvas.width / 2, y);


        ctx.font = '14px "Courier New", Courier, monospace';
        ctx.fillText('Press Enter to Continue', canvas.width / 2, canvas.height - 60);
    }

    // Draw leaderboard
    if (showLeaderboard) {
        // Semi-transparent background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Pop-up box
        ctx.fillStyle = colors.darkGray;
        ctx.fillRect(20, 20, canvas.width - 40, canvas.height - 40);
        ctx.strokeStyle = colors.white;
        ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

        // Title
        ctx.fillStyle = colors.yellow;
        ctx.font = 'bold 20px "Courier New", Courier, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('LEADERBOARD', canvas.width / 2, 50);

        // Headers
        ctx.fillStyle = colors.lightGray;
        ctx.font = '14px "Courier New", Courier, monospace';
        ctx.textAlign = 'left';
        ctx.fillText('Name', 40, 80);
        ctx.textAlign = 'right';
        ctx.fillText('Score', canvas.width - 90, 80);
        ctx.fillText('Lvl', canvas.width - 40, 80);
        

        // Scores
        ctx.font = '12px "Courier New", Courier, monospace';
        leaderboard.forEach((entry, index) => {
            const y = 105 + (index * 15);
            ctx.textAlign = 'left';
            ctx.fillStyle = colors.white;
            ctx.fillText(`${index + 1}. ${entry.player_name}`, 40, y);
            ctx.textAlign = 'right';
            ctx.fillStyle = colors.lightGreen;
            ctx.fillText(entry.score, canvas.width - 90, y);
            ctx.fillStyle = colors.lightCyan;
            ctx.fillText(entry.level, canvas.width - 40, y);
        });
        
        ctx.font = '14px "Courier New", Courier, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Press "L" to Close', canvas.width / 2, canvas.height - 30);
    }
}


// VI. API COMMUNICATION
// -----------------------------------------------------------------------------
async function submitScore() {
    const playerName = prompt("Game Over! Enter your name for the leaderboard:", "Player");
    if (!playerName) return;

    try {
        await fetch('/api/game/score', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                playerName,
                score: gameState.score,
                level: gameState.level,
            }),
        });
        // After submitting, refresh and show the leaderboard
        await fetchLeaderboard();
        showLeaderboard = true;
    } catch (error) {
        console.error('Failed to submit score:', error);
    }
}

async function fetchLeaderboard() {
    try {
        const response = await fetch('/api/game/leaderboard');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        leaderboard = await response.json();
    } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
        leaderboard = []; // Clear leaderboard on error
    }
}


// VII. GAME LOOP
// -----------------------------------------------------------------------------
// This is the heart of the game, running continuously.
// It uses requestAnimationFrame for smooth rendering and a time-based
// logic to ensure it runs at our desired FPS.

function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    
    timer += deltaTime;

    if (timer > frameInterval) {
        update(timer);
        draw();
        timer = 0;
    }
    
    requestAnimationFrame(gameLoop);
}


// VIII. EVENT LISTENERS
// -----------------------------------------------------------------------------
// To capture player input.

function handleKeyDown(e) {
    // Leaderboard toggle
    if (e.key === 'l' || e.key === 'L') {
        // Allow toggling only when not in a level-up pause
        if (!gameState.isPaused || showLeaderboard) { 
            showLeaderboard = !showLeaderboard;
            if (showLeaderboard && !gameState.isGameOver) {
                gameState.isPaused = true;
            } else if (!gameState.isGameOver) {
                gameState.isPaused = false;
            }
        }
    }

    // Action button (Enter or Space)
    if ((e.key === 'Enter' || e.key === ' ')) {
        if (gameState.isGameOver) {
            resetGame();
            fetchLeaderboard();
        } else if (gameState.isPaused && !showLeaderboard) {
            // This case is specifically for the educational pop-up
            gameState.isPaused = false;
        }
    }

    // Player movement
    if (!gameState.isPaused) {
        if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
        else if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
    }
}

function handleKeyUp(e) {
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
    else if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
}

document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);

// Mobile Touch Controls
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touchX = e.touches[0].clientX;
    if (touchX < window.innerWidth / 2) {
        keys.left = true;
    } else {
        keys.right = true;
    }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    keys.left = false;
    keys.right = false;
}, { passive: false });


// IX. INITIALIZATION & GAME RESET
// -----------------------------------------------------------------------------

function resetGame() {
    gameState.level = 1; // Start at level 1
    gameState.score = 0;
    gameState.health = 100;
    gameState.isGameOver = false;
    gameState.isPaused = false;
    fallingObjects = [];
    player.x = canvas.width / 2 - player.width / 2;
    spawnTimer = 0;
    lastTime = 0; // Reset time for the game loop
    timer = 0;
}

// Kicks everything off.
console.log("MSTY Dividend Defender Initializing...");
resetGame();
fetchLeaderboard(); // Fetch leaderboard on initial load
requestAnimationFrame(gameLoop); 