document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
        // If no token, redirect to login page
        window.location.href = '/account/login/';
        return;
    }

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    // Fetch and display user's portfolio summary
    const fetchSummary = async () => {
        try {
            const response = await fetch('/api/portfolio/summary', { headers });
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                     window.location.href = '/account/login/';
                }
                throw new Error('Failed to fetch summary');
            }
            const summary = await response.json();
            updateSummaryCards(summary);
        } catch (error) {
            console.error('Error fetching summary:', error);
            // You could show an error message on the dashboard here
        }
    };

    // Fetch and display user's holdings
    const fetchHoldings = async () => {
        try {
            const response = await fetch('/api/portfolio/holdings', { headers });
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                     window.location.href = '/account/login/';
                }
                throw new Error('Failed to fetch holdings');
            }
            const { holdings } = await response.json();
            populateHoldingsTable(holdings);
        } catch (error) {
            console.error('Error fetching holdings:', error);
        }
    };

    // Update the summary cards with fetched data
    function updateSummaryCards(summary) {
        document.querySelector('.portfolio-summary .summary-card:nth-child(1) .amount').textContent = Math.round(summary.current_value).toLocaleString();
        document.querySelector('.portfolio-summary .summary-card:nth-child(4) .amount').textContent = summary.holdings_count;
        
        const gainLoss = summary.total_gain_loss;
        const gainLossPercent = summary.total_gain_loss_percent;
        const gainLossEl = document.querySelector('.portfolio-summary .summary-card:nth-child(1) .change');
        
        gainLossEl.textContent = `${gainLoss >= 0 ? '+' : ''}$${gainLoss.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} (${gainLossPercent.toFixed(2)}%)`;
        gainLossEl.className = `change ${gainLoss >= 0 ? 'positive' : 'negative'}`;
    }

    // Populate the holdings table with fetched data
    function populateHoldingsTable(holdings) {
        const tableBody = document.querySelector('.holdings-table tbody');
        tableBody.innerHTML = ''; // Clear static rows

        if (holdings.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No holdings yet. Add one to get started!</td></tr>';
            return;
        }

        holdings.forEach(holding => {
            const row = `
                <tr>
                    <td class="symbol"><a href="/ticker/?symbol=${holding.ticker}">${holding.ticker}</a></td>
                    <td>${holding.ticker}</td> 
                    <td>${holding.shares}</td>
                    <td>$${holding.display_price.toFixed(2)}</td>
                    <td class="value">$${holding.current_value.toFixed(2)}</td>
                    <td class="yield">N/A</td> 
                    <td class="income">N/A</td>
                    <td class="change ${holding.gain_loss >= 0 ? 'positive' : 'negative'}">${holding.gain_loss_percent.toFixed(2)}%</td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });
    }
    
    // Setup logout functionality
    const logoutButton = document.querySelector('.sidebar-link.logout');
    if(logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('authToken');
            window.location.href = '/';
        });
    }

    // Modal Handling
    const modal = document.getElementById('addHoldingModal');
    const addHoldingBtn = document.querySelector('.add-holding-btn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const addHoldingForm = document.getElementById('addHoldingForm');
    
    addHoldingBtn.addEventListener('click', () => modal.style.display = 'flex');
    closeModalBtn.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target == modal) {
            modal.style.display = 'none';
        }
    });

    // Handle Add Holding form submission
    addHoldingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const holdingData = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/api/portfolio/holdings', {
                method: 'POST',
                headers,
                body: JSON.stringify(holdingData)
            });
            const result = await response.json();
            if (response.ok) {
                modal.style.display = 'none';
                addHoldingForm.reset();
                showToast('Holding added successfully!');
                // Refresh data
                fetchSummary();
                fetchHoldings();
            } else {
                throw new Error(result.error || 'Failed to add holding');
            }
        } catch (error) {
            console.error('Error adding holding:', error);
            showToast(error.message, 'error');
        }
    });

    // Toast notification utility
    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => {
            toast.className = toast.className.replace('show', '');
        }, 3000);
    }

    // Initial data fetch
    fetchSummary();
    fetchHoldings();
}); 
