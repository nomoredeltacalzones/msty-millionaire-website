// Navigation utility script
// This script ensures consistent navigation across all pages

function updateNavigation() {
    const navMenus = document.querySelectorAll('.nav-menu');
    
    navMenus.forEach(navMenu => {
        // Check if game link already exists
        const existingGameLink = navMenu.querySelector('a[href*="/games/"]');
        if (existingGameLink) return;
        
        // Find the portfolio link to insert game link after it
        const portfolioLink = navMenu.querySelector('a[href*="/portfolio/"]');
        if (portfolioLink) {
            const gameLink = document.createElement('a');
            gameLink.href = '/games/';
            gameLink.className = 'nav-link';
            gameLink.textContent = '🎮 Games';
            
            // Insert after portfolio link
            portfolioLink.parentNode.insertBefore(gameLink, portfolioLink.nextSibling);
        }
    });
}

// Update navigation when DOM is loaded
document.addEventListener('DOMContentLoaded', updateNavigation);

// Also update if navigation is dynamically added later
const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        if (mutation.type === 'childList') {
            updateNavigation();
        }
    });
});

// Start observing
observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Export for use in other scripts
window.updateNavigation = updateNavigation; 