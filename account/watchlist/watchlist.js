document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    const addForm = document.getElementById('addWatchlistForm');
    const tickerInput = document.getElementById('tickerInput');
    const tableBody = document.querySelector('#watchlistTable tbody');

    let userWatchlist = [];

    const renderTable = (watchlistWithData) => {
        tableBody.innerHTML = '';
        if (watchlistWithData.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Your watchlist is empty.</td></tr>';
            return;
        }

        watchlistWithData.forEach(item => {
            const changeClass = item.change >= 0 ? 'positive' : 'negative';
            const row = `
                <tr>
                    <td class="symbol"><a href="/ticker/?symbol=${item.ticker}">${item.ticker}</a></td>
                    <td>$${item.price?.toFixed(2) || 'N/A'}</td>
                    <td class="${changeClass}">${item.change?.toFixed(2) || 'N/A'}</td>
                    <td class="${changeClass}">${item.changePercent?.toFixed(2) || 'N/A'}%</td>
                    <td>${item.volume?.toLocaleString() || 'N/A'}</td>
                    <td><button class="danger-button remove-btn" data-ticker="${item.ticker}">Remove</button></td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });
    };
    
    const fetchWatchlistData = async () => {
        if (userWatchlist.length === 0) {
            renderTable([]);
            return;
        }
        try {
            const tickers = userWatchlist.map(item => item.ticker);
            const response = await fetch('/api/proxy/stocks/batch', {
                method: 'POST',
                headers,
                body: JSON.stringify({ tickers })
            });
            const data = await response.json();
            if (response.ok) {
                renderTable(data);
            } else {
                throw new Error('Failed to fetch market data');
            }
        } catch (error) {
            console.error('Error fetching watchlist data:', error);
            showToast(error.message, 'error');
        }
    };
    
    const getWatchlist = async () => {
        try {
            const response = await fetch('/api/watchlist', { headers });
            if (response.ok) {
                userWatchlist = await response.json();
                fetchWatchlistData();
            } else {
                throw new Error('Could not get watchlist');
            }
        } catch(error) {
            console.error('Error getting watchlist:', error);
            showToast(error.message, 'error');
        }
    };

    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const ticker = tickerInput.value.trim().toUpperCase();
        if (!ticker) return;

        try {
            const response = await fetch('/api/watchlist', {
                method: 'POST',
                headers,
                body: JSON.stringify({ ticker })
            });
            const result = await response.json();
            if (response.ok) {
                tickerInput.value = '';
                showToast(`${ticker} added to watchlist.`);
                getWatchlist(); // Refresh list
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Error adding to watchlist:', error);
            showToast(error.message, 'error');
        }
    });

    tableBody.addEventListener('click', async (e) => {
        if (e.target.classList.contains('remove-btn')) {
            const ticker = e.target.dataset.ticker;
            try {
                const response = await fetch(`/api/watchlist/${ticker}`, {
                    method: 'DELETE',
                    headers
                });
                if (response.ok) {
                    showToast(`${ticker} removed from watchlist.`);
                    getWatchlist(); // Refresh list
                } else {
                    const result = await response.json();
                    throw new Error(result.error);
                }
            } catch (error) {
                console.error('Error removing from watchlist:', error);
                showToast(error.message, 'error');
            }
        }
    });

    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => toast.className = toast.className.replace('show', ''), 3000);
    }
    
    getWatchlist();
}); 
