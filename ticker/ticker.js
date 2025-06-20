document.addEventListener('DOMContentLoaded', () => {
    const tickerSymbol = new URLSearchParams(window.location.search).get('symbol');
    if (!tickerSymbol) {
        document.getElementById('ticker-detail-container').innerHTML = '<h1>Ticker symbol not provided.</h1>';
        return;
    }

    let myChart;
    const chartCanvas = document.getElementById('priceChart').getContext('2d');

    const fetchData = async (url) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch ${url}`);
        return response.json();
    };

    const renderPage = async () => {
        try {
            const [quote, profile, news] = await Promise.all([
                fetchData(`/api/proxy/stock/${tickerSymbol}`),
                fetchData(`/api/proxy/company/${tickerSymbol}`),
                fetchData(`/api/proxy/news/${tickerSymbol}`)
            ]);

            // Header
            document.getElementById('company-logo').src = profile.logo || 'https://placehold.co/64';
            document.getElementById('ticker-symbol').textContent = profile.ticker || tickerSymbol.toUpperCase();
            document.getElementById('company-name').textContent = profile.name;
            document.getElementById('current-price').textContent = `$${quote.price.toFixed(2)}`;
            const priceChangeEl = document.getElementById('price-change');
            priceChangeEl.textContent = `${quote.change.toFixed(2)} (${quote.changePercent.toFixed(2)}%)`;
            priceChangeEl.className = quote.change >= 0 ? 'positive' : 'negative';

            // Key Stats
            const stats = {
                'Market Cap': profile.marketCapitalization.toLocaleString(),
                'Shares Outstanding': profile.shareOutstanding.toLocaleString(),
                '52-Week High': quote.high,
                '52-Week Low': quote.low,
                'Previous Close': quote.previousClose,
                'Volume': quote.volume.toLocaleString()
            };
            const keyStatsGrid = document.getElementById('key-stats');
            keyStatsGrid.innerHTML = Object.entries(stats).map(([key, value]) => `
                <div class="stat-item">
                    <span class="stat-key">${key}</span>
                    <span class="stat-value">${value || 'N/A'}</span>
                </div>
            `).join('');

            // About
            document.getElementById('company-description').textContent = profile.description || 'No description available.';
            document.getElementById('company-website').href = profile.weburl;


            // News
            const newsList = document.getElementById('news-list');
            newsList.innerHTML = news.map(article => `
                <a href="${article.url}" target="_blank" rel="noopener noreferrer" class="news-item">
                    <div class="news-content">
                        <span class="news-source">${article.source}</span>
                        <h4 class="news-headline">${article.headline}</h4>
                        <p class="news-summary">${article.summary}</p>
                    </div>
                    ${article.image ? `<img src="${article.image}" alt="News Image" class="news-image">` : ''}
                </a>
            `).join('');

            renderChart('1Y');

        } catch (error) {
            console.error('Error rendering page:', error);
            document.getElementById('ticker-detail-container').innerHTML = `<h1>Error loading data for ${tickerSymbol}</h1>`;
        }
    };
    
    const renderChart = async (range) => {
        let days = 30;
        let resolution = 'D';
        if (range === '6M') days = 182;
        if (range === '1Y') days = 365;
        if (range === 'ALL') days = 5 * 365; // ~5 years

        try {
            const historicalData = await fetchData(`/api/proxy/historical/${tickerSymbol}?resolution=${resolution}&days=${days}`);
            
            const labels = historicalData.t.map(ts => new Date(ts * 1000));
            const dataPoints = historicalData.c;

            if (myChart) {
                myChart.destroy();
            }

            myChart = new Chart(chartCanvas, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Price',
                        data: dataPoints,
                        borderColor: '#8b5cf6',
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.1
                    }]
                },
                options: {
                    scales: {
                        x: { type: 'time', time: { unit: 'month' } },
                        y: { beginAtZero: false }
                    },
                    plugins: { legend: { display: false } }
                }
            });
        } catch (error) {
            console.error(`Error rendering chart for range ${range}:`, error);
        }
    };
    
    document.querySelector('.chart-controls').addEventListener('click', (e) => {
        if (e.target.classList.contains('time-range-btn')) {
            document.querySelectorAll('.time-range-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            renderChart(e.target.dataset.range);
        }
    });

    renderPage();
}); 