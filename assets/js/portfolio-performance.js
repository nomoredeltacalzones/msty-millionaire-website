// assets/js/portfolio-performance.js
// Portfolio Performance Module

class PortfolioPerformance {
    constructor() {
        this.chart = null;
        this.currentPeriod = '1M';
        this.performanceData = null;
        this.historyData = null;
        
        this.init();
    }

    async init() {
        await this.loadPerformanceData();
        await this.loadHistoryData();
        this.setupEventListeners();
        this.renderPerformanceCards();
        this.renderChart();
    }

    async loadPerformanceData() {
        try {
            const response = await window.apiProxy.get('/api/portfolio/performance');
            this.performanceData = response;
        } catch (error) {
            console.error('Failed to load performance data:', error);
            this.showError('Failed to load portfolio performance');
        }
    }

    async loadHistoryData(period = '1M') {
        try {
            const response = await window.apiProxy.get(`/api/portfolio/history?period=${period}`);
            this.historyData = response.history;
        } catch (error) {
            console.error('Failed to load history data:', error);
        }
    }

    setupEventListeners() {
        // Period selector buttons
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                // Update active state
                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                // Load new data
                this.currentPeriod = e.target.dataset.period;
                await this.loadHistoryData(this.currentPeriod);
                this.renderChart();
            });
        });
    }

    renderPerformanceCards() {
        if (!this.performanceData) return;

        // Update summary values
        const currentValue = this.performanceData.current_value || 0;
        const totalInvested = this.performanceData.total_invested || 0;
        const totalReturn = this.performanceData.gain_all || 0;
        const totalReturnPercent = this.performanceData.gain_all_percent || 0;

        document.getElementById('current-value').textContent = this.formatCurrency(currentValue);
        document.getElementById('total-invested').textContent = this.formatCurrency(totalInvested);
        document.getElementById('total-return').textContent = 
            (totalReturn >= 0 ? '+' : '') + this.formatCurrency(totalReturn);
        document.getElementById('total-return').className = 
            'value ' + (totalReturn >= 0 ? 'positive' : 'negative');
        document.getElementById('total-return-percent').textContent = 
            (totalReturnPercent >= 0 ? '+' : '') + totalReturnPercent.toFixed(2) + '%';
        document.getElementById('total-return-percent').className = 
            'value ' + (totalReturnPercent >= 0 ? 'positive' : 'negative');

        const periods = [
            { key: '1d', label: '1 Day' },
            { key: '1w', label: '1 Week' },
            { key: '1m', label: '1 Month' },
            { key: '3m', label: '3 Months' },
            { key: '6m', label: '6 Months' },
            { key: '1y', label: '1 Year' },
            { key: 'all', label: 'All Time' }
        ];

        const container = document.getElementById('performance-cards');
        if (!container) return;

        container.innerHTML = periods.map(period => {
            const gain = this.performanceData[`gain_${period.key}`] || 0;
            const gainPercent = this.performanceData[`gain_${period.key}_percent`] || 0;
            const isPositive = gain >= 0;

            return `
                <div class="performance-card">
                    <div class="period-label">${period.label}</div>
                    <div class="performance-value ${isPositive ? 'positive' : 'negative'}">
                        ${isPositive ? '+' : ''}${this.formatCurrency(gain)}
                    </div>
                    <div class="performance-percent ${isPositive ? 'positive' : 'negative'}">
                        ${isPositive ? '+' : ''}${gainPercent.toFixed(2)}%
                    </div>
                </div>
            `;
        }).join('');
    }

    renderChart() {
        const canvas = document.getElementById('portfolio-chart');
        if (!canvas || !this.historyData || this.historyData.length === 0) return;

        // Destroy existing chart
        if (this.chart) {
            this.chart.destroy();
        }

        const ctx = canvas.getContext('2d');
        
        // Prepare data
        const labels = this.historyData.map(d => this.formatDate(d.date));
        const values = this.historyData.map(d => d.value);
        const invested = this.historyData.map(d => d.invested);

        // Create gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.3)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Portfolio Value',
                        data: values,
                        borderColor: '#6366f1',
                        backgroundColor: gradient,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        borderWidth: 2
                    },
                    {
                        label: 'Total Invested',
                        data: invested,
                        borderColor: '#94a3b8',
                        backgroundColor: 'transparent',
                        fill: false,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        borderWidth: 2,
                        borderDash: [5, 5]
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#e4e8f1',
                            usePointStyle: true,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(22, 32, 51, 0.9)',
                        titleColor: '#e4e8f1',
                        bodyColor: '#94a3b8',
                        borderColor: 'rgba(99, 102, 241, 0.3)',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: true,
                        callbacks: {
                            label: (context) => {
                                const label = context.dataset.label || '';
                                const value = this.formatCurrency(context.parsed.y);
                                return `${label}: ${value}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(99, 102, 241, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#94a3b8',
                            maxTicksLimit: 8
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(99, 102, 241, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#94a3b8',
                            callback: (value) => this.formatCurrency(value, true)
                        }
                    }
                }
            }
        });
    }

    formatCurrency(amount, compact = false) {
        if (compact && Math.abs(amount) >= 1000) {
            const formatter = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                notation: 'compact',
                maximumFractionDigits: 1
            });
            return formatter.format(amount);
        }
        
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        
        if (diffDays < 7) {
            return date.toLocaleDateString('en-US', { weekday: 'short' });
        } else if (diffDays < 365) {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else {
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        }
    }

    showError(message) {
        const container = document.getElementById('performance-error');
        if (container) {
            container.textContent = message;
            container.style.display = 'block';
        }
    }

    async refreshPerformance() {
        // Update prices first
        await window.apiProxy.post('/api/portfolio/update-prices');
        
        // Reload data
        await this.loadPerformanceData();
        await this.loadHistoryData(this.currentPeriod);
        
        // Re-render
        this.renderPerformanceCards();
        this.renderChart();
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('portfolio-performance-section')) {
        window.portfolioPerformance = new PortfolioPerformance();
    }
});
