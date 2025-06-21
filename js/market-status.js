// js/market-status.js

function updateMarketStatus() {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 6 = Saturday
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const time = hours + minutes / 60;
    
    // Get EST/EDT time (market operates on Eastern Time)
    const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    const easternHours = easternTime.getHours();
    const easternMinutes = easternTime.getMinutes();
    const easternTime24 = easternHours + easternMinutes / 60;
    const easternDay = easternTime.getDay();
    
    // Market is open Monday-Friday, 9:30 AM - 4:00 PM ET
    const isWeekday = easternDay >= 1 && easternDay <= 5;
    const isMarketHours = easternTime24 >= 9.5 && easternTime24 < 16;
    const isMarketOpen = isWeekday && isMarketHours;
    
    // Update all market status indicators on the page
    const statusDots = document.querySelectorAll('.market-status-dot');
    const statusTexts = document.querySelectorAll('.market-status-text');
    
    statusDots.forEach(dot => {
        if (isMarketOpen) {
            dot.style.background = '#22c55e'; // Green
            dot.style.animation = 'blink 2s infinite';
        } else {
            dot.style.background = '#ef4444'; // Red
            dot.style.animation = 'none';
        }
    });
    
    statusTexts.forEach(text => {
        text.textContent = isMarketOpen ? 'Live' : 'Markets Closed';
    });
    
    // Update the parent container background color
    const indicators = document.querySelectorAll('.market-indicator');
    indicators.forEach(indicator => {
        if (isMarketOpen) {
            indicator.style.background = 'rgba(34, 197, 94, 0.2)'; // Green background
        } else {
            indicator.style.background = 'rgba(239, 68, 68, 0.2)'; // Red background
        }
    });
}

// Update immediately and then every 60 seconds
updateMarketStatus();
setInterval(updateMarketStatus, 60000);

// Also update when page becomes visible (user returns to tab)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        updateMarketStatus();
    }
});
