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
    showTitleScreen: true,
    streak: 0,
    monthlyIncome: 0.00,
    dividendsCaught: 0,
    premiumsCaught: 0,
    volatilityHit: 0,
    assignmentsHit: 0,
    totalGamesPlayed: 0,
    highScore: 0,
    xp: 0,
    // Add more states as needed: paused, etc.
};

// Streak System
const streakSystem = {
    currentStreak: 0,
    lastPlayDate: null,
    freezesAvailable: 0,
    
    updateStreak() {
        const today = new Date().toDateString();
        const lastPlay = this.lastPlayDate;
        
        if (lastPlay === today) return;
        
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        
        if (lastPlay === yesterday) {
            this.currentStreak++;
        } else if (this.freezesAvailable > 0) {
            this.freezesAvailable--;
        } else {
            this.currentStreak = 1;
        }
        
        this.lastPlayDate = today;
        gameState.streak = this.currentStreak;
        this.save();
    },
    
    save() {
        localStorage.setItem('mstyStreak', JSON.stringify({
            currentStreak: this.currentStreak,
            lastPlayDate: this.lastPlayDate,
            freezesAvailable: this.freezesAvailable
        }));
    },
    
    load() {
        const saved = localStorage.getItem('mstyStreak');
        if (saved) {
            const data = JSON.parse(saved);
            this.currentStreak = data.currentStreak || 0;
            this.lastPlayDate = data.lastPlayDate;
            this.freezesAvailable = data.freezesAvailable || 0;
            gameState.streak = this.currentStreak;
        }
    }
};

// Title Screen State
const titleScreen = {
    active: true,
    blinkTimer: 0,
    blinkInterval: 500, // Blink every 500ms
    showPressStart: true,
    
    draw() {
        // Clear screen with black background
        ctx.fillStyle = colors.black;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw border around canvas
        ctx.strokeStyle = colors.lightGray;
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, canvas.width, canvas.height);
        
        // Draw ASCII art title
        ctx.fillStyle = colors.lightGreen;
        ctx.font = '6px monospace';
        ctx.textAlign = 'center';
        
        const title = [
            "███╗   ███╗███████╗████████╗██╗   ██╗",
            "████╗ ████║██╔════╝╚══██╔══╝╚██╗ ██╔╝",
            "██╔████╔██║███████╗   ██║    ╚████╔╝ ",
            "██║╚██╔╝██║╚════██║   ██║     ╚██╔╝  ",
            "██║ ╚═╝ ██║███████╗   ██║      ██║   ",
            "╚═╝     ╚═╝╚══════╝   ╚═╝      ╚═╝   "
        ];
        
        // Draw ASCII art title
        title.forEach((line, index) => {
            ctx.fillText(line, canvas.width / 2, 25 + (index * 8));
        });
        
        // Draw subtitle
        ctx.fillStyle = colors.yellow;
        ctx.font = 'bold 10px monospace';
        ctx.fillText("DIVIDEND DEFENDER", canvas.width / 2, 80);
        
        // Draw version and copyright
        ctx.fillStyle = colors.lightGray;
        ctx.font = '6px monospace';
        ctx.fillText("v1.0 - Educational Investment Game", canvas.width / 2, 95);
        ctx.fillText("© 2024 MSTY Millionaire", canvas.width / 2, 105);
        
        // Draw instructions
        ctx.fillStyle = colors.lightCyan;
        ctx.font = '8px monospace';
        ctx.fillText("Catch dividends ($) and premiums (P)", canvas.width / 2, 120);
        ctx.fillText("Avoid volatility (V) and assignments (!)", canvas.width / 2, 130);
        
        // Draw controls
        ctx.fillStyle = colors.lightGray;
        ctx.font = '6px monospace';
        ctx.fillText("Controls: Arrow Keys or A/D to move", canvas.width / 2, 145);
        ctx.fillText("Press ENTER to start game", canvas.width / 2, 155);
        
        // Blinking "Press ENTER to Start" text
        if (this.showPressStart) {
            ctx.fillStyle = colors.lightGreen;
            ctx.font = 'bold 10px monospace';
            ctx.fillText("PRESS ENTER TO START", canvas.width / 2, 175);
        }
    },
    
    update(deltaTime) {
        this.blinkTimer += deltaTime;
        if (this.blinkTimer >= this.blinkInterval) {
            this.showPressStart = !this.showPressStart;
            this.blinkTimer = 0;
        }
    }
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

// Achievement System
const achievements = {
    firstDividend: { 
        id: "first_dividend",
        name: "BABY'S FIRST DIVIDEND",
        description: "Caught your first $",
        xp: 10,
        badge: "🍼",
        unlocked: false
    },
    perfectMonth: {
        id: "perfect_month",
        name: "PERFECT MONTH",
        description: "Caught all 30 dividends without missing",
        xp: 100,
        badge: "📅",
        unlocked: false
    },
    streakMaster: {
        id: "streak_master",
        name: "STREAK MASTER",
        description: "Maintained a 7-day streak",
        xp: 50,
        badge: "🔥",
        unlocked: false
    },
    premiumHunter: {
        id: "premium_hunter",
        name: "PREMIUM HUNTER",
        description: "Caught 10 premiums in one game",
        xp: 75,
        badge: "💎",
        unlocked: false
    },
    survivor: {
        id: "survivor",
        name: "SURVIVOR",
        description: "Reached level 5 without losing health",
        xp: 200,
        badge: "🛡️",
        unlocked: false
    }
};

function checkAchievements() {
    if (gameState.dividendsCaught === 1 && !achievements.firstDividend.unlocked) {
        unlockAchievement('firstDividend');
    }
    if (gameState.dividendsCaught >= 30 && gameState.volatilityHit === 0 && !achievements.perfectMonth.unlocked) {
        unlockAchievement('perfectMonth');
    }
    if (gameState.streak >= 7 && !achievements.streakMaster.unlocked) {
        unlockAchievement('streakMaster');
    }
    if (gameState.premiumsCaught >= 10 && !achievements.premiumHunter.unlocked) {
        unlockAchievement('premiumHunter');
    }
    if (gameState.level >= 5 && gameState.health === 100 && !achievements.survivor.unlocked) {
        unlockAchievement('survivor');
    }
}

function unlockAchievement(achievementKey) {
    const achievement = achievements[achievementKey];
    if (achievement && !achievement.unlocked) {
        achievement.unlocked = true;
        gameState.xp += achievement.xp;
        showAchievementNotification(achievement);
        saveAchievements();
    }
}

function showAchievementNotification(achievement) {
    // Create a temporary notification
    const notification = {
        text: `${achievement.badge} ${achievement.name} UNLOCKED!`,
        timer: 0,
        duration: 3000,
        y: 50
    };
    
    if (!window.achievementNotifications) {
        window.achievementNotifications = [];
    }
    window.achievementNotifications.push(notification);
}

function saveAchievements() {
    localStorage.setItem('mstyAchievements', JSON.stringify(achievements));
}

function loadAchievements() {
    const saved = localStorage.getItem('mstyAchievements');
    if (saved) {
        const savedAchievements = JSON.parse(saved);
        Object.keys(savedAchievements).forEach(key => {
            if (achievements[key]) {
                achievements[key].unlocked = savedAchievements[key].unlocked;
            }
        });
    }
}

// Daily Challenge System
const dailyChallenges = {
    Monday: { name: "MANIC MONDAY", speedMultiplier: 2, description: "Objects fall twice as fast!" },
    Tuesday: { name: "TWO-FER TUESDAY", dividendMultiplier: 2, description: "Dividends worth double points!" },
    Wednesday: { name: "WILD WEDNESDAY", randomEvents: true, description: "Random events occur!" },
    Thursday: { name: "THETA THURSDAY", timeDecayBonus: true, description: "Time decay affects premiums!" },
    Friday: { name: "FREAKY FRIDAY", reverseControls: true, description: "Controls are reversed!" }
};

function getDailyChallenge() {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];
    return dailyChallenges[today] || null;
}

// Difficulty Manager
class DifficultyManager {
    calculateDifficulty() {
        const baseSpeed = 1;
        const speedIncrease = 0.1 * gameState.level;
        const spawnRateDecrease = Math.max(200, 1000 - (gameState.level * 100));
        
        // Apply daily challenge modifiers
        const challenge = getDailyChallenge();
        let speedMultiplier = 1;
        if (challenge && challenge.speedMultiplier) {
            speedMultiplier = challenge.speedMultiplier;
        }
        
        return {
            objectSpeed: (baseSpeed + speedIncrease) * speedMultiplier,
            spawnInterval: spawnRateDecrease,
            volatilityRatio: 0.2 + (gameState.level * 0.05),
            assignmentChance: gameState.level > 3 ? 0.05 : 0
        };
    }
}

const difficultyManager = new DifficultyManager();

// Save Game System
const saveGame = {
    save() {
        const data = {
            highScore: Math.max(gameState.score, this.getHighScore()),
            totalGamesPlayed: this.getTotalGames() + 1,
            achievements: achievements,
            streak: streakSystem.currentStreak,
            xp: gameState.xp
        };
        localStorage.setItem('mstyDefender', JSON.stringify(data));
    },
    
    load() {
        const saved = localStorage.getItem('mstyDefender');
        return saved ? JSON.parse(saved) : null;
    },
    
    getHighScore() {
        const saved = this.load();
        return saved ? saved.highScore : 0;
    },
    
    getTotalGames() {
        const saved = this.load();
        return saved ? saved.totalGamesPlayed : 0;
    }
};

// III. AUDIO MANAGER
// -----------------------------------------------------------------------------
class AudioManager {
    constructor() {
        this.sounds = {
            collect: new Audio('games/msty-dividend-defender/sounds/collect.wav'),
            hurt: new Audio('games/msty-dividend-defender/sounds/hurt.wav'),
            levelUp: new Audio('games/msty-dividend-defender/sounds/levelUp.wav')
        };
        
        // Initialize 8-bit sound generator
        this.initRetroSoundGenerator();
    }

    initRetroSoundGenerator() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported, falling back to file-based audio');
            this.audioContext = null;
        }
    }

    play(soundName) {
        const sound = this.sounds[soundName];
        if (sound) {
            sound.currentTime = 0; // Rewind to the start
            sound.play().catch(e => {
                console.error(`Could not play sound: ${soundName}`, e);
                // Fallback to 8-bit sounds if file fails
                this.playRetroSound(soundName);
            });
        } else {
            // Use 8-bit sounds as fallback
            this.playRetroSound(soundName);
        }
    }
    
    playRetroSound(soundName) {
        if (!this.audioContext) return;
        
        switch (soundName) {
            case 'collect':
                this.playCollectSound();
                break;
            case 'hurt':
                this.playHurtSound();
                break;
            case 'levelUp':
                this.playLevelUpSound();
                break;
        }
    }
    
    playCollectSound() {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1600, this.audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.1);
    }
    
    playHurtSound() {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + 0.2);
        
        gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.2);
    }
    
    playLevelUpSound() {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(523, this.audioContext.currentTime); // C5
        oscillator.frequency.setValueAtTime(659, this.audioContext.currentTime + 0.1); // E5
        oscillator.frequency.setValueAtTime(784, this.audioContext.currentTime + 0.2); // G5
        
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime + 0.2);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.3);
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
        this.baseSpeed = 1 + Math.random() * 1.5; // Add some variety to speed
    }

    // Update object's position
    update() {
        const difficulty = difficultyManager.calculateDifficulty();
        const challenge = getDailyChallenge();
        
        let speedMultiplier = 1;
        if (challenge && challenge.speedMultiplier) {
            speedMultiplier = challenge.speedMultiplier;
        }
        
        this.y += this.baseSpeed * difficulty.objectSpeed * speedMultiplier;
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

    // Apply daily challenge effects
    const challenge = getDailyChallenge();
    let movementMultiplier = 1;
    if (challenge && challenge.reverseControls) {
        movementMultiplier = -1;
    }

    // Handle player input for movement
    if (keys.right) player.dx = player.speed * movementMultiplier;
    else if (keys.left) player.dx = -player.speed * movementMultiplier;
    else player.dx = 0;
    
    player.x += player.dx;

    // Wall collision for player
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

    // Get difficulty settings
    const difficulty = difficultyManager.calculateDifficulty();
    
    // Spawn new objects with dynamic timing
    spawnTimer += deltaTime;
    if (spawnTimer > difficulty.spawnInterval) {
        spawnObject();
        spawnTimer = 0;
    }

    // Update and check collisions for all falling objects
    for (let i = fallingObjects.length - 1; i >= 0; i--) {
        const obj = fallingObjects[i];
        obj.update();

        if (checkCollision(player, obj)) {
            // Apply daily challenge multipliers
            let points = obj.type.points;
            if (challenge && challenge.dividendMultiplier && obj.type.char === '$') {
                points *= challenge.dividendMultiplier;
            }
            
            gameState.score += points;
            gameState.health += obj.type.health;
            
            // Track statistics
            if (obj.type.char === '$') {
                gameState.dividendsCaught++;
                gameState.monthlyIncome += 0.25; // $0.25 per dividend
            } else if (obj.type.char === 'P') {
                gameState.premiumsCaught++;
                gameState.monthlyIncome += 1.00; // $1.00 per premium
            } else if (obj.type.char === 'V') {
                gameState.volatilityHit++;
            } else if (obj.type.char === '!') {
                gameState.assignmentsHit++;
            }
            
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

    // Check achievements
    checkAchievements();

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
        streakSystem.updateStreak();
        saveGame.save();
        submitScore();
        
        // Dispatch event for site integration
        const gameOverEvent = new CustomEvent('gameOver', {
            detail: {
                highScore: saveGame.getHighScore(),
                gamesPlayed: saveGame.getTotalGames(),
                streak: streakSystem.currentStreak,
                finalScore: gameState.score,
                level: gameState.level
            }
        });
        window.dispatchEvent(gameOverEvent);
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

    drawPlayer();
    fallingObjects.forEach(obj => obj.draw(ctx));
    drawHUD();
    
    // Draw achievement notifications
    drawAchievementNotifications();

    if (gameState.isGameOver) {
        ctx.fillStyle = colors.lightRed;
        ctx.font = '24px "Courier New", Courier, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 10);
        ctx.font = '16px "Courier New", Courier, monospace';
        ctx.fillText('Press Enter to Restart', canvas.width / 2, canvas.height / 2 + 10);
        ctx.fillText('Press "L" for Leaderboard', canvas.width / 2, canvas.height / 2 + 30);
        ctx.fillText('Press "T" for Title Screen', canvas.width / 2, canvas.height / 2 + 50);
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

/**
 * Draws the DOS-style HUD with box-drawing characters
 */
function drawHUD() {
    const healthBar = drawHealthBar();
    const challenge = getDailyChallenge();
    
    const hudText = [
        "╔════════════════════════════════════════╗",
        `║ SCORE: ${String(gameState.score).padStart(5, '0')}  STREAK: ${String(gameState.streak).padStart(2, '0')}  HEALTH: ${healthBar} ║`,
        `║ LEVEL: ${String(gameState.level).padStart(2, '0')}     MONTHLY INCOME: $${gameState.monthlyIncome.toFixed(2).padStart(6, '0')}  ║`,
        "╚════════════════════════════════════════╝"
    ];
    
    ctx.fillStyle = colors.lightGray;
    ctx.font = '8px monospace';
    ctx.textAlign = 'left';
    
    hudText.forEach((line, index) => {
        ctx.fillText(line, 5, 15 + (index * 10));
    });
    
    // Draw daily challenge if active
    if (challenge) {
        ctx.fillStyle = colors.yellow;
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`DAILY: ${challenge.name}`, canvas.width / 2, 55);
        ctx.fillStyle = colors.lightCyan;
        ctx.font = '6px monospace';
        ctx.fillText(challenge.description, canvas.width / 2, 65);
    }
}

/**
 * Draws a visual health bar using ASCII characters
 */
function drawHealthBar() {
    const healthPercent = gameState.health / 100;
    const barLength = 10;
    const filledBlocks = Math.floor(healthPercent * barLength);
    
    let bar = '';
    for (let i = 0; i < barLength; i++) {
        if (i < filledBlocks) {
            bar += '█';
        } else {
            bar += '░';
        }
    }
    
    return bar;
}

/**
 * Draws the player bucket with a more detailed sprite
 */
function drawPlayer() {
    ctx.fillStyle = colors.lightGray;
    
    // Draw bucket body
    ctx.fillRect(player.x + 5, player.y, player.width - 10, player.height);
    ctx.fillRect(player.x, player.y + 2, player.width, player.height - 2);
    
    // Draw bucket handles
    ctx.fillRect(player.x - 3, player.y + 2, 3, 5);
    ctx.fillRect(player.x + player.width, player.y + 2, 3, 5);
    
    // Draw bucket rim
    ctx.fillStyle = colors.darkGray;
    ctx.fillRect(player.x + 2, player.y - 2, player.width - 4, 2);
}

/**
 * Draws achievement notifications
 */
function drawAchievementNotifications() {
    if (!window.achievementNotifications) return;
    
    const currentTime = Date.now();
    
    for (let i = window.achievementNotifications.length - 1; i >= 0; i--) {
        const notification = window.achievementNotifications[i];
        notification.timer += 16; // Approximate frame time
        
        if (notification.timer >= notification.duration) {
            window.achievementNotifications.splice(i, 1);
            continue;
        }
        
        // Calculate fade effect
        const alpha = Math.max(0, 1 - (notification.timer / notification.duration));
        
        // Draw notification background
        ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.8})`;
        ctx.fillRect(10, notification.y - 5, canvas.width - 20, 20);
        
        // Draw notification border
        ctx.strokeStyle = `rgba(255, 255, 0, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(10, notification.y - 5, canvas.width - 20, 20);
        
        // Draw notification text
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(notification.text, canvas.width / 2, notification.y + 5);
    }
}

// VI. API COMMUNICATION
// -----------------------------------------------------------------------------
async function submitScore() {
    const playerName = prompt("Game Over! Enter your name for the leaderboard:", "Player");
    if (!playerName) return;

    try {
        // Send score via WebSocket if available
        sendScore();
        
        // Also send via HTTP API as fallback
        await fetch('/api/game/score', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                playerName,
                score: gameState.score,
                level: gameState.level,
                monthlyIncome: gameState.monthlyIncome,
                dividendsCaught: gameState.dividendsCaught,
                premiumsCaught: gameState.premiumsCaught
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

// WebSocket Connection for Real-time Updates
let socket = null;

function initializeWebSocket() {
    try {
        // Try to connect to the backend WebSocket
        socket = new WebSocket('wss://msty-millionaire-backend.up.railway.app/game');
        
        socket.onopen = () => {
            console.log('WebSocket connected');
        };
        
        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'leaderboardUpdate') {
                updateLeaderboard(data.leaderboard);
            } else if (data.type === 'mstyData') {
                updateMSTYData(data.data);
            }
        };
        
        socket.onerror = (error) => {
            console.warn('WebSocket error:', error);
        };
        
        socket.onclose = () => {
            console.log('WebSocket disconnected');
            // Try to reconnect after 5 seconds
            setTimeout(initializeWebSocket, 5000);
        };
    } catch (error) {
        console.warn('WebSocket not available:', error);
    }
}

function sendScore() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'score',
            score: gameState.score,
            level: gameState.level,
            monthlyIncome: gameState.monthlyIncome
        }));
    }
}

function updateLeaderboard(newLeaderboard) {
    leaderboard = newLeaderboard;
}

function updateMSTYData(data) {
    // Update game with real MSTY data
    if (data.lastDistribution) {
        gameState.dividendValue = data.lastDistribution;
    }
    if (data.impliedVolatility) {
        gameState.volatilityLevel = data.impliedVolatility;
    }
}

// Real MSTY Data Integration
async function fetchRealMSTYData() {
    try {
        const response = await fetch('/api/msty/current');
        if (response.ok) {
            const data = await response.json();
            updateMSTYData(data);
        }
    } catch (error) {
        console.warn('Could not fetch MSTY data:', error);
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
        // Handle title screen
        if (gameState.showTitleScreen) {
            titleScreen.update(timer);
            titleScreen.draw();
        } else {
            // Main game logic
            update(timer);
            draw();
        }
        timer = 0;
    }
    
    requestAnimationFrame(gameLoop);
}


// VIII. EVENT LISTENERS
// -----------------------------------------------------------------------------
// To capture player input.

function handleKeyDown(e) {
    // Handle title screen
    if (gameState.showTitleScreen) {
        if (e.key === 'Enter') {
            gameState.showTitleScreen = false;
            resetGame();
            fetchLeaderboard();
        }
        return; // Don't process other keys on title screen
    }

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

    // Return to title screen
    if (e.key === 't' || e.key === 'T') {
        if (gameState.isGameOver) {
            gameState.showTitleScreen = true;
            gameState.isGameOver = false;
            gameState.isPaused = false;
            fallingObjects = [];
            showLeaderboard = false;
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
    gameState.showTitleScreen = false; // Don't show title screen when resetting game
    gameState.monthlyIncome = 0.00;
    gameState.dividendsCaught = 0;
    gameState.premiumsCaught = 0;
    gameState.volatilityHit = 0;
    gameState.assignmentsHit = 0;
    fallingObjects = [];
    player.x = canvas.width / 2 - player.width / 2;
    spawnTimer = 0;
    lastTime = 0; // Reset time for the game loop
    timer = 0;
    
    // Clear achievement notifications
    if (window.achievementNotifications) {
        window.achievementNotifications = [];
    }
}

// Initialize all systems
function initializeGame() {
    // Load saved data
    const savedData = saveGame.load();
    if (savedData) {
        gameState.highScore = savedData.highScore || 0;
        gameState.totalGamesPlayed = savedData.totalGamesPlayed || 0;
        gameState.xp = savedData.xp || 0;
    }
    
    // Load streak data
    streakSystem.load();
    
    // Load achievements
    loadAchievements();
    
    // Initialize achievement notifications
    window.achievementNotifications = [];
    
    // Initialize WebSocket connection
    initializeWebSocket();
    
    // Fetch real MSTY data
    fetchRealMSTYData();
    
    // Dispatch initial stats event for site integration
    const initialStatsEvent = new CustomEvent('gameStatsLoaded', {
        detail: {
            highScore: saveGame.getHighScore(),
            gamesPlayed: saveGame.getTotalGames(),
            streak: streakSystem.currentStreak
        }
    });
    window.dispatchEvent(initialStatsEvent);
}

// Kicks everything off.
console.log("MSTY Dividend Defender Initializing...");
initializeGame(); // Initialize all systems
fetchLeaderboard(); // Fetch leaderboard on initial load
requestAnimationFrame(gameLoop); 