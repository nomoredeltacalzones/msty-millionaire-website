// Enhanced site integration for stats and persistent data
class GameAPI {
    constructor() {
        this.baseURL = '/api/game';
        this.token = localStorage.getItem('authToken');
    }

    // Get authentication token from localStorage or cookies
    getAuthHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        return headers;
    }

    // Submit score with enhanced data
    async submitScore(gameData) {
        try {
            const response = await fetch(`${this.baseURL}/score`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    playerName: gameData.playerName,
                    score: gameData.score,
                    level: gameData.level,
                    etfsCollected: gameData.dividendsCaught + gameData.premiumsCaught,
                    maxYield: gameData.monthlyIncome
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            // Handle achievements if any were unlocked
            if (result.achievements && result.achievements.length > 0) {
                this.showAchievements(result.achievements);
            }

            return result;
        } catch (error) {
            console.error('Failed to submit score:', error);
            throw error;
        }
    }

    // Get leaderboard with optional filters
    async getLeaderboard(period = 'all', limit = 10) {
        try {
            const response = await fetch(`${this.baseURL}/leaderboard?period=${period}&limit=${limit}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Failed to fetch leaderboard:', error);
            return [];
        }
    }

    // Get daily challenge
    async getDailyChallenge() {
        try {
            const response = await fetch(`${this.baseURL}/daily-challenge`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Failed to fetch daily challenge:', error);
            return null;
        }
    }

    // Get user achievements (authenticated)
    async getAchievements() {
        if (!this.token) return [];
        
        try {
            const response = await fetch(`${this.baseURL}/achievements`, {
                headers: this.getAuthHeaders()
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Failed to fetch achievements:', error);
            return [];
        }
    }

    // Get user progress (authenticated)
    async getProgress() {
        if (!this.token) return null;
        
        try {
            const response = await fetch(`${this.baseURL}/progress`, {
                headers: this.getAuthHeaders()
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Failed to fetch progress:', error);
            return null;
        }
    }

    // Get user powerups (authenticated)
    async getPowerups() {
        if (!this.token) return [];
        
        try {
            const response = await fetch(`${this.baseURL}/powerups`, {
                headers: this.getAuthHeaders()
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Failed to fetch powerups:', error);
            return [];
        }
    }

    // Use a powerup (authenticated)
    async usePowerup(powerupType) {
        if (!this.token) return false;
        
        try {
            const response = await fetch(`${this.baseURL}/use-powerup`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ powerupType })
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Failed to use powerup:', error);
            return false;
        }
    }

    // Show achievement notifications
    showAchievements(achievements) {
        achievements.forEach(achievement => {
            this.showAchievementNotification(achievement);
        });
    }

    // Display achievement notification
    showAchievementNotification(achievement) {
        const notification = document.createElement('div');
        notification.className = 'achievement-notification';
        notification.innerHTML = `
            <div class="achievement-content">
                <h3>🏆 Achievement Unlocked!</h3>
                <h4>${achievement.name}</h4>
                <p>${achievement.description}</p>
                <p class="points">+${achievement.points} points</p>
            </div>
        `;
        
        // Add styles if not already present
        if (!document.getElementById('achievement-styles')) {
            const style = document.createElement('style');
            style.id = 'achievement-styles';
            style.textContent = `
                .achievement-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: linear-gradient(135deg, #ffd700, #ffed4e);
                    border: 2px solid #ffb347;
                    border-radius: 10px;
                    padding: 15px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                    z-index: 10000;
                    animation: slideIn 0.5s ease-out;
                    max-width: 300px;
                }
                .achievement-content h3 {
                    margin: 0 0 10px 0;
                    color: #8b4513;
                    font-size: 16px;
                }
                .achievement-content h4 {
                    margin: 0 0 8px 0;
                    color: #d2691e;
                    font-size: 18px;
                }
                .achievement-content p {
                    margin: 5px 0;
                    color: #654321;
                }
                .achievement-content .points {
                    font-weight: bold;
                    color: #228b22;
                }
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        // Remove notification after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }
}

// Initialize game API
const gameAPI = new GameAPI();

// Load saved stats and initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Load saved stats from localStorage as fallback
    const savedData = localStorage.getItem('mstyDefender');
    if (savedData) {
        const data = JSON.parse(savedData);
        document.getElementById('highScore').textContent = data.highScore || 0;
        document.getElementById('gamesPlayed').textContent = data.totalGamesPlayed || 0;
        document.getElementById('currentStreak').textContent = data.streak || 0;
    }
    
    // Try to load user progress from API
    try {
        const progress = await gameAPI.getProgress();
        if (progress) {
            document.getElementById('highScore').textContent = progress.max_level_reached * 1000 || 0;
            document.getElementById('gamesPlayed').textContent = progress.games_played || 0;
            document.getElementById('currentStreak').textContent = progress.daily_streak || 0;
        }
    } catch (error) {
        console.warn('Could not load progress from API:', error);
    }
    
    // Load daily challenge
    try {
        const challenge = await gameAPI.getDailyChallenge();
        if (challenge) {
            // You can display the daily challenge somewhere in the UI
            console.log('Daily challenge:', challenge);
        }
    } catch (error) {
        console.warn('Could not load daily challenge:', error);
    }
    
    // Update stats when game loads initial data
    window.addEventListener('gameStatsLoaded', (event) => {
        const stats = event.detail;
        document.getElementById('highScore').textContent = stats.highScore;
        document.getElementById('gamesPlayed').textContent = stats.gamesPlayed;
        document.getElementById('currentStreak').textContent = stats.streak;
    });
    
    // Update stats after each game
    window.addEventListener('gameOver', async (event) => {
        const stats = event.detail;
        document.getElementById('highScore').textContent = stats.highScore;
        document.getElementById('gamesPlayed').textContent = stats.gamesPlayed;
        document.getElementById('currentStreak').textContent = stats.streak;
        
        // Submit score to enhanced API
        try {
            await gameAPI.submitScore(stats);
        } catch (error) {
            console.warn('Could not submit score to API:', error);
        }
    });
});

// Export for use in game
window.gameAPI = gameAPI; 