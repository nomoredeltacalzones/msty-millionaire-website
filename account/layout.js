document.addEventListener('DOMContentLoaded', () => {
    // Check for auth token on all account pages
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = '/account/login/';
        return;
    }

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    // Load shared layout components
    const loadLayout = () => {
        const header = document.querySelector('.header');
        const sidebar = document.querySelector('.dashboard-sidebar');

        if (header) {
            // Simplified header for now
            header.innerHTML = `
                <div class="container">
                    <div class="header-content">
                        <div class="logo">
                            <h1><a href="/" style="text-decoration: none; color: inherit;">MSTY Millionaire</a></h1>
                        </div>
                        <div class="user-menu">
                            <span class="user-name">Loading...</span>
                        </div>
                    </div>
                </div>
            `;
        }
        if (sidebar) {
            sidebar.innerHTML = `
                <nav class="sidebar-nav">
                    <a href="../dashboard/" class="sidebar-link ${window.location.pathname.includes('dashboard') ? 'active' : ''}"><span>📊</span> Dashboard</a>
                    <a href="../watchlist/" class="sidebar-link ${window.location.pathname.includes('watchlist') ? 'active' : ''}"><span>👁️</span> Watchlist</a>
                    <a href="../alerts/" class="sidebar-link ${window.location.pathname.includes('alerts') ? 'active' : ''}"><span>🔔</span> Alerts</a>
                    <a href="../settings/" class="sidebar-link ${window.location.pathname.includes('settings') ? 'active' : ''}"><span>⚙️</span> Settings</a>
                    <div class="sidebar-divider"></div>
                    <a href="#" class="sidebar-link logout"><span>🚪</span> Logout</a>
                </nav>
            `;
            // Add logout functionality
            const logoutButton = document.querySelector('.sidebar-link.logout');
            if(logoutButton) {
                logoutButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    localStorage.removeItem('authToken');
                    window.location.href = '/';
                });
            }
        }
    };

    // Fetch user profile to populate user-specific elements
    const fetchUserProfile = async () => {
        try {
            const response = await fetch('/api/user/profile', { headers });
            if (!response.ok) {
                 if (response.status === 401 || response.status === 403) {
                     window.location.href = '/account/login/';
                }
                throw new Error('Could not fetch user profile');
            }
            const user = await response.json();
            
            // Update layout with user info
            const userNameEl = document.querySelector('.user-menu .user-name');
            if(userNameEl) userNameEl.textContent = user.full_name;

            // Return user for other functions to use
            return user;

        } catch (error) {
            console.error(error);
            localStorage.removeItem('authToken');
            window.location.href = '/account/login/';
        }
    };
    
    loadLayout();
    fetchUserProfile();
}); 
