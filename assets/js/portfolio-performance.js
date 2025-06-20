// assets/js/portfolio-performance.js
// Portfolio Performance Module

class PortfolioPerformance {
    constructor() {
        this.chart = null;
        this.currentPeriod = '1M';
        this.performanceData = null;
        this.historyData = null;
    }

    async init() {
        // Mock data for demonstration since API is not live
        this.historyData = this.getMockHistoryData('1M'); 
        
        this.setupEventListeners();
        this.renderChart();
    }

    getMockHistoryData(period) {
        const data = {
            '1M': { labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'], values: [10000, 10200, 10150, 10300], invested: [9900, 9900, 9900, 9900] },
            '3M': { labels: ['Jan', 'Feb', 'Mar'], values: [9800, 10000, 10300], invested: [9700, 9700, 9700] },
            '6M': { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], values: [9800, 10000, 10300, 10500, 10400, 10700], invested: [9700, 9700, 9700, 9700, 9700, 9700] },
            '1Y': { labels: ['Q1', 'Q2', 'Q3', 'Q4'], values: [9500, 10300, 10800, 11200], invested: [9400, 9400, 9400, 9400] },
            'All':{ labels: ['2023', '2024', '2025'], values: [8000, 9500, 11200], invested: [7900, 7900, 7900] }
        };
        const selected = data[period] || data['1M'];
        
        return selected.labels.map((label, index) => ({
            date: label, // Using labels as dates for simplicity
            value: selected.values[index],
            invested: selected.invested[index]
        }));
    }

    setupEventListeners() {
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                this.currentPeriod = e.target.dataset.period;
                this.historyData = this.getMockHistoryData(this.currentPeriod);
                this.renderChart();
            });
        });
    }

    renderChart() {
        let canvas = document.getElementById('portfolioChart');
        if (!canvas) {
            // If the canvas is named 'portfolio-chart' in some files
            canvas = document.getElementById('portfolio-chart');
            if (!canvas) return;
        }

        if (!this.historyData || this.historyData.length === 0) return;

        if (this.chart) {
            this.chart.destroy();
        }

        const ctx = canvas.getContext('2d');
        
        const labels = this.historyData.map(d => d.date);
        const values = this.historyData.map(d => d.value);
        const invested = this.historyData.map(d => d.invested);

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
                                const value = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                                return `${label}: ${value}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(99, 102, 241, 0.1)', drawBorder: false },
                        ticks: { color: '#94a3b8', maxTicksLimit: 8 }
                    },
                    y: {
                        grid: { color: 'rgba(99, 102, 241, 0.1)', drawBorder: false },
                        ticks: {
                            color: '#94a3b8',
                            callback: (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value)
                        }
                    }
                }
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Check for a unique ID for the portfolio section
    const portfolioSection = document.querySelector('#portfolio-performance-section, .performance-section');
    if (portfolioSection) {
        window.portfolioPerformance = new PortfolioPerformance();
        window.portfolioPerformance.init();
    }
});
