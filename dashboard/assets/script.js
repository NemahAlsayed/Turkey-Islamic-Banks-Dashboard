/* ============================================================
   1. CSV LOADER (WIDE FORMAT → USABLE FORMAT)
   ============================================================ */

async function loadWideCSV(path) {
    const res = await fetch(path);
    if (!res.ok) {
        console.error('Failed to load CSV:', path, res.status);
        return { years: [], metrics: {} };
    }

    const text = await res.text();
    const rows = text.trim().split('\n').map(r => r.split(','));

    const years = rows[0].slice(1).map(y => y.trim());
    const metrics = {};

    for (let i = 1; i < rows.length; i++) {
        const metricName = rows[i][0].trim();
        const values = rows[i]
            .slice(1)
            .map(v => {
                let cleaned = v.replace(/"/g, '').replace('%', '');
                if (v.includes('%')) {
                    cleaned = cleaned.replace(/,/g, '.');
                } else {
                    cleaned = cleaned.replace(/,/g, '');
                }
                return Number(cleaned) || 0;
            });
        metrics[metricName] = values;
    }

    return { years, metrics };
}

/* ============================================================
   2. FORMAT HELPERS
   ============================================================ */

function formatNumber(x) {
    if (x === null || x === undefined) return '-';
    const n = Number(x);
    if (isNaN(n)) return x;
    if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
    if (n >= 1e9)  return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6)  return (n / 1e6).toFixed(1) + 'M';
    return n.toLocaleString('en-US');
}

function buildHoverText(xArr, yArr) {
    return yArr.map((v, i) => `${xArr[i]}: ${formatNumber(v)}`);
}

function getYearIndex(data, year) {
    return data.years.indexOf(year);
}

/* ============================================================
   3. GLOBAL STATE
   ============================================================ */

let marketData, financingData, depositsData, riskData, esgData, macroData;
let currentYear = null;
let currentCustomerType = 'all';

/* ============================================================
   4. KPI UPDATER (SINGLE-YEAR VIEW)
   ============================================================ */

function updateKPIs(market) {
    if (!market.years.length || !currentYear) return;

    const idx = getYearIndex(market, currentYear);
    if (idx < 0) return;

    document.getElementById('kpi-assets').textContent =
        formatNumber(market.metrics["Total Assets of Participation Banks"]?.[idx]);

    document.getElementById('kpi-financing').textContent =
        formatNumber(market.metrics["Total Financing"]?.[idx]);

    document.getElementById('kpi-deposits').textContent =
        formatNumber(market.metrics["Total Deposits"]?.[idx]);

    const share = market.metrics["Participation Banking Market Share"]?.[idx];
    document.getElementById('kpi-share').textContent =
        share !== undefined ? share + "%" : '-';
}

/* ============================================================
   5. PLOTLY CHART BUILDERS
   ============================================================ */
/* ---------- 5.1 MARKET (FULL SERIES + HIGHLIGHTED YEAR) ---------- */

function buildMarketChart(market) {
    if (!market.years.length) return;

    const years = market.years;
    const assets = market.metrics["Total Assets of Participation Banks"] || [];
    const deposits = market.metrics["Total Deposits"] || [];

    const traces = [
        {
            x: years,
            y: assets,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Total Assets',
            line: { color: '#0F8A5F' },
            marker: { size: 6 },
            text: buildHoverText(years, assets),
            hovertemplate: '%{text}<extra></extra>'
        },
        {
            x: years,
            y: deposits,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Total Deposits',
            line: { color: '#C9A227' },
            marker: { size: 6 },
            text: buildHoverText(years, deposits),
            hovertemplate: '%{text}<extra></extra>'
        }
    ];

    if (currentYear) {
        const idx = years.indexOf(currentYear);
        if (idx >= 0) {
            traces.push({
                x: [years[idx]],
                y: [assets[idx]],
                type: 'scatter',
                mode: 'markers',
                marker: { color: '#C9A227', size: 12 },
                hoverinfo: 'skip',
                showlegend: false
            });
            traces.push({
                x: [years[idx]],
                y: [deposits[idx]],
                type: 'scatter',
                mode: 'markers',
                marker: { color: '#C9A227', size: 12 },
                hoverinfo: 'skip',
                showlegend: false
            });
        }
    }

    Plotly.newPlot('market_chart', traces, {
        margin: { t: 30, r: 20, l: 60, b: 40 }
    });
}

/* ---------- 5.2 FINANCING (FULL SERIES + HIGHLIGHTED YEAR) ---------- */

function buildFinancingChart(fin) {
    if (!fin.years.length) return;

    const years = fin.years;
    const murabaha = fin.metrics["Murabaha Financing"] || [];
    const ijara = fin.metrics["Ijara (Leasing) Financing"] || [];

    const traces = [
        {
            x: years,
            y: murabaha,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Murabaha',
            line: { color: '#0F8A5F' },
            marker: { size: 6 },
            text: buildHoverText(years, murabaha),
            hovertemplate: '%{text}<extra></extra>'
        },
        {
            x: years,
            y: ijara,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Ijara',
            line: { color: '#0A1A2F' },
            marker: { size: 6 },
            text: buildHoverText(years, ijara),
            hovertemplate: '%{text}<extra></extra>'
        }
    ];

    if (currentYear) {
        const idx = years.indexOf(currentYear);
        if (idx >= 0) {
            traces.push({
                x: [years[idx]],
                y: [murabaha[idx]],
                type: 'scatter',
                mode: 'markers',
                marker: { color: '#C9A227', size: 12 },
                hoverinfo: 'skip',
                showlegend: false
            });
            traces.push({
                x: [years[idx]],
                y: [ijara[idx]],
                type: 'scatter',
                mode: 'markers',
                marker: { color: '#C9A227', size: 12 },
                hoverinfo: 'skip',
                showlegend: false
            });
        }
    }

    Plotly.newPlot('financing_chart', traces, {
        margin: { t: 30, r: 20, l: 60, b: 40 }
    });
}

/* ---------- 5.3 DEPOSITS (SINGLE-YEAR VIEW + MODAL DRILL-DOWN) ---------- */

function buildDepositsChart(dep) {
    if (!dep.years.length || !currentYear) return;

    const idx = getYearIndex(dep, currentYear);
    if (idx < 0) return;

    let x = [];
    let y = [];

    if (currentCustomerType === 'all') {
        x = ['Participation Accounts', 'Term Participation Accounts'];
        y = [
            dep.metrics["Participation Accounts"]?.[idx] ?? 0,
            dep.metrics["Term Participation Accounts"]?.[idx] ?? 0
        ];
    } else {
        const metricName = currentCustomerType === 'retail'
            ? "Deposits by Customer Type/ Retail"
            : "Deposits by Customer Type/ Corporate";

        x = [currentCustomerType === 'retail' ? 'Retail Deposits' : 'Corporate Deposits'];
        y = [dep.metrics[metricName]?.[idx] ?? 0];
    }

    const trace = {
        x,
        y,
        type: 'bar',
        marker: { color: '#0F8A5F' },
        text: y.map(v => formatNumber(v)),
        hovertemplate: '%{x}: %{text}<extra></extra>'
    };

    Plotly.newPlot('deposits_chart', [trace], {
        margin: { t: 30, r: 20, l: 60, b: 40 }
    });

    document.getElementById('deposits_chart').on('plotly_click', (data) => {
        const point = data.points[0];
        if (!point) return;
        if (currentCustomerType === 'all' && point.x === 'Term Participation Accounts') {
            openTermAccountsModal();
        }
    });
}

/* ---------- 5.4 CUSTOMER COMPARISON (SINGLE-YEAR VIEW) ---------- */

function buildCustomerComparisonChart(dep) {
    if (!dep.years.length || !currentYear) return;

    const idx = getYearIndex(dep, currentYear);
    if (idx < 0) return;

    const retail = dep.metrics["Deposits by Customer Type/ Retail"]?.[idx] ?? 0;
    const corp = dep.metrics["Deposits by Customer Type/ Corporate"]?.[idx] ?? 0;

    const trace = {
        x: ['Retail', 'Corporate'],
        y: [retail, corp],
        type: 'bar',
        marker: { color: ['#0F8A5F', '#0A1A2F'] },
        text: [formatNumber(retail), formatNumber(corp)],
        hovertemplate: '%{x}: %{text}<extra></extra>'
    };

    Plotly.newPlot('customer_comparison_chart', [trace], {
        margin: { t: 30, r: 20, l: 60, b: 40 }
    });
}

/* ---------- 5.5 RISK (FULL SERIES + HIGHLIGHTED YEAR) ---------- */

function buildRiskChart(risk) {
    if (!risk.years.length) return;

    const years = risk.years;
    const npf = risk.metrics["Non_Performing Financing Ratio (NPF Ratio)"] || [];
    const car = risk.metrics["Capital Adequacy Ratio"] || [];

    const traces = [
        {
            x: years,
            y: npf,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'NPF Ratio',
            line: { color: '#C0392B' },
            marker: { size: 6 },
            text: buildHoverText(years, npf),
            hovertemplate: '%{text}<extra></extra>'
        },
        {
            x: years,
            y: car,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'CAR',
            yaxis: 'y2',
            line: { color: '#0F8A5F' },
            marker: { size: 6 },
            text: buildHoverText(years, car),
            hovertemplate: '%{text}<extra></extra>'
        }
    ];

    if (currentYear) {
        const idx = years.indexOf(currentYear);
        if (idx >= 0) {
            traces.push({
                x: [years[idx]],
                y: [npf[idx]],
                type: 'scatter',
                mode: 'markers',
                marker: { color: '#C9A227', size: 12 },
                hoverinfo: 'skip',
                showlegend: false
            });
            traces.push({
                x: [years[idx]],
                y: [car[idx]],
                type: 'scatter',
                mode: 'markers',
                marker: { color: '#C9A227', size: 12 },
                hoverinfo: 'skip',
                showlegend: false
            });
        }
    }

    Plotly.newPlot('risk_chart', traces, {
        yaxis2: { overlaying: 'y', side: 'right' },
        margin: { t: 30, r: 40, l: 60, b: 40 }
    });
}

/* ---------- 5.6 ESG (FULL SERIES + HIGHLIGHTED YEAR) ---------- */

function buildESGChart(esg) {
    if (!esg.years.length) return;

    const years = esg.years;
    const sukuk = esg.metrics["Sustainable Sukuk"] || [];
    const score = esg.metrics["Avg. ESG Score (Weighted)"] || [];

    const traces = [
        {
            x: years,
            y: sukuk,
            type: 'bar',
            name: 'Sustainable Sukuk',
            marker: { color: '#0F8A5F' },
            text: buildHoverText(years, sukuk),
            hovertemplate: '%{text}<extra></extra>'
        },
        {
            x: years,
            y: score,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'ESG Score',
            yaxis: 'y2',
            line: { color: '#C9A227' },
            marker: { size: 6 },
            text: buildHoverText(years, score),
            hovertemplate: '%{text}<extra></extra>'
        }
    ];

    if (currentYear) {
        const idx = years.indexOf(currentYear);
        if (idx >= 0) {
            traces.push({
                x: [years[idx]],
                y: [sukuk[idx]],
                type: 'scatter',
                mode: 'markers',
                marker: { color: '#C9A227', size: 12 },
                hoverinfo: 'skip',
                showlegend: false
            });
            traces.push({
                x: [years[idx]],
                y: [score[idx]],
                type: 'scatter',
                mode: 'markers',
                marker: { color: '#C9A227', size: 12 },
                hoverinfo: 'skip',
                showlegend: false
            });
        }
    }

    Plotly.newPlot('esg_chart', traces, {
        yaxis2: { overlaying: 'y', side: 'right' },
        margin: { t: 30, r: 40, l: 60, b: 40 }
    });
}

/* ---------- 5.7 MACRO (FULL SERIES + HIGHLIGHTED YEAR) ---------- */

function buildMacroChart(macro) {
    if (!macro.years.length) return;

    const years = macro.years;
    const cpi = macro.metrics["Inflation Rate (CPI %)"] || [];
    const m2 = macro.metrics["Money Supply M2"] || [];

    const traces = [
        {
            x: years,
            y: cpi,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'CPI',
            line: { color: '#C0392B' },
            marker: { size: 6 },
            text: buildHoverText(years, cpi),
            hovertemplate: '%{text}<extra></extra>'
        },
        {
            x: years,
            y: m2,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'M2',
            yaxis: 'y2',
            line: { color: '#0F8A5F' },
            marker: { size: 6 },
            text: buildHoverText(years, m2),
            hovertemplate: '%{text}<extra></extra>'
        }
    ];

    if (currentYear) {
        const idx = years.indexOf(currentYear);
        if (idx >= 0) {
            traces.push({
                x: [years[idx]],
                y: [cpi[idx]],
                type: 'scatter',
                mode: 'markers',
                marker: { color: '#C9A227', size: 12 },
                hoverinfo: 'skip',
                showlegend: false
            });
            traces.push({
                x: [years[idx]],
                y: [m2[idx]],
                type: 'scatter',
                mode: 'markers',
                marker: { color: '#C9A227', size: 12 },
                hoverinfo: 'skip',
                showlegend: false
            });
        }
    }

    Plotly.newPlot('macro_chart', traces, {
        yaxis2: { overlaying: 'y', side: 'right' },
        margin: { t: 30, r: 40, l: 60, b: 40 }
    });
}

/* ---------- 5.8 FORECASTING (FULL HISTORY + FORECAST + HIGHLIGHT) ---------- */

function buildForecastChart(dep) {
    if (!dep.years.length) return;

    const years = dep.years;
    const yArr = dep.metrics["Participation Accounts"] || [];
    if (!years.length || !yArr.length) return;

    const xNum = years.map(y => parseInt(y, 10));
    const n = xNum.length;

    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
        sumX += xNum[i];
        sumY += yArr[i];
        sumXY += xNum[i] * yArr[i];
        sumXX += xNum[i] * xNum[i];
    }

    const denom = (n * sumXX - sumX * sumX) || 1;
    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;

    const lastYear = xNum[xNum.length - 1];
    const forecastYearsNum = [lastYear + 1, lastYear + 2, lastYear + 3];
    const forecastYears = forecastYearsNum.map(String);
    const forecastValues = forecastYearsNum.map(x => slope * x + intercept);

    const traces = [
        {
            x: years,
            y: yArr,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Actual Participation Accounts',
            line: { color: '#0F8A5F' },
            marker: { size: 6 },
            text: buildHoverText(years, yArr),
            hovertemplate: '%{text}<extra></extra>'
        },
        {
            x: forecastYears,
            y: forecastValues,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Forecast',
            line: { color: '#C9A227', dash: 'dash' },
            marker: { size: 6 },
            text: buildHoverText(forecastYears, forecastValues),
            hovertemplate: '%{text}<extra></extra>'
        }
    ];

    if (currentYear) {
        const idx = years.indexOf(currentYear);
        if (idx >= 0) {
            traces.push({
                x: [years[idx]],
                y: [yArr[idx]],
                type: 'scatter',
                mode: 'markers',
                marker: { color: '#C9A227', size: 12 },
                hoverinfo: 'skip',
                showlegend: false
            });
        }
    }

    Plotly.newPlot('forecast_chart', traces, {
        margin: { t: 30, r: 20, l: 60, b: 40 }
    });
}

/* ============================================================
   6. MODAL DRILL-DOWN FOR TERM ACCOUNTS (BAR CHART)
   ============================================================ */

function openTermAccountsModal() {
    const overlay = document.getElementById('modal-overlay');
    const titleEl = document.getElementById('modal-title');
    titleEl.textContent = `Term Accounts Breakdown – ${currentYear}`;
    overlay.classList.remove('hidden');

    buildTermAccountsChart(depositsData);
}

function closeTermAccountsModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.add('hidden');
}

function buildTermAccountsChart(dep) {
    if (!dep.years.length || !currentYear) return;

    const idx = getYearIndex(dep, currentYear);
    if (idx < 0) return;

    const terms = [
        "1_Month Term Accounts",
        "3_Month Term Accounts",
        "6_Month Term Accounts",
        "12_Month Term Accounts"
    ];

    const x = ['1M', '3M', '6M', '12M'];
    const y = terms.map(name => (dep.metrics[name] || [])[idx] ?? 0);

    const trace = {
        x,
        y,
        type: 'bar',
        marker: { color: '#0F8A5F' },
        text: y.map(v => formatNumber(v)),
        hovertemplate: '%{x}: %{text}<extra></extra>'
    };

    Plotly.newPlot('modal-chart', [trace], {
        margin: { t: 30, r: 20, l: 60, b: 40 }
    });
}

/* ============================================================
   7. DATA EXPLORER TABLE
   ============================================================ */

function buildDataExplorerTable(datasets) {
    const table = document.getElementById('data-explorer-table');
    if (!table) return;

    table.innerHTML = '';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Dataset', 'Metric', 'Year', 'Value'].forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    const tbody = document.createElement('tbody');

    datasets.forEach(ds => {
        const { name, data } = ds;
        if (!data || !data.years || !data.metrics) return;

        const years = data.years;
        Object.keys(data.metrics).forEach(metricName => {
            const arr = data.metrics[metricName] || [];
            years.forEach((year, i) => {
                const tr = document.createElement('tr');

                const tdDataset = document.createElement('td');
                tdDataset.textContent = name;

                const tdMetric = document.createElement('td');
                tdMetric.textContent = metricName;

                const tdYear = document.createElement('td');
                tdYear.textContent = year;

                const tdValue = document.createElement('td');
                tdValue.textContent = formatNumber(arr[i]);

                tr.appendChild(tdDataset);
                tr.appendChild(tdMetric);
                tr.appendChild(tdYear);
                tr.appendChild(tdValue);

                tbody.appendChild(tr);
            });
        });
    });

    table.appendChild(thead);
    table.appendChild(tbody);
}

/* ============================================================
   8. THEME TOGGLE (DARK MODE)
   ============================================================ */

function setupThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;

    btn.addEventListener('click', () => {
        document.body.classList.toggle('dark');
        btn.textContent = document.body.classList.contains('dark')
            ? 'Light Mode'
            : 'Dark Mode';

        [
            'market_chart',
            'financing_chart',
            'deposits_chart',
            'customer_comparison_chart',
            'forecast_chart',
            'risk_chart',
            'esg_chart',
            'macro_chart',
            'modal-chart'
        ].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                Plotly.Plots.resize(el);
            }
        });
    });
}

/* ============================================================
   9. SLICERS (YEAR + CUSTOMER TYPE)
   ============================================================ */

function setupSlicers() {
    const yearSelect = document.getElementById('year-slicer');
    const customerSelect = document.getElementById('customer-slicer');

    if (marketData && marketData.years.length && yearSelect) {
        yearSelect.innerHTML = '';
        marketData.years.forEach(y => {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            yearSelect.appendChild(opt);
        });
        currentYear = marketData.years[0];
        yearSelect.value = currentYear;
    }

    if (yearSelect) {
        yearSelect.addEventListener('change', () => {
            currentYear = yearSelect.value;
            updateAll();
        });
    }

    if (customerSelect) {
        customerSelect.addEventListener('change', () => {
            currentCustomerType = customerSelect.value;
            updateAll();
        });
    }
}

/* ============================================================
   10. GLOBAL UPDATE FUNCTION
   ============================================================ */

function updateAll() {
    if (!marketData) return;

    updateKPIs(marketData);
    buildMarketChart(marketData);
    buildFinancingChart(financingData);
    buildDepositsChart(depositsData);
    buildCustomerComparisonChart(depositsData);
    buildForecastChart(depositsData);
    buildRiskChart(riskData);
    buildESGChart(esgData);
    buildMacroChart(macroData);

    buildDataExplorerTable([
        { name: 'Market Size', data: marketData },
        { name: 'Financing Portfolio', data: financingData },
        { name: 'Deposits', data: depositsData },
        { name: 'Risk & Stability', data: riskData },
        { name: 'ESG & Climate', data: esgData },
        { name: 'Macroeconomics', data: macroData }
    ]);
}

/* ============================================================
   11. INITIALIZATION
   ============================================================ */

window.addEventListener('DOMContentLoaded', async () => {
    setupThemeToggle();

    const overlay = document.getElementById('modal-overlay');
    const closeBtn = document.getElementById('modal-close');
    if (overlay && closeBtn) {
        closeBtn.addEventListener('click', closeTermAccountsModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeTermAccountsModal();
        });
    }

    marketData = await loadWideCSV('./data/Market_Size.csv');
    financingData = await loadWideCSV('./data/Financing_Portfolio_Islamic_Products.csv');
    depositsData = await loadWideCSV('./data/Deposits_Participation_Accounts.csv');
    riskData = await loadWideCSV('./data/Risk_Stability_Metrics.csv');
    esgData = await loadWideCSV('./data/ESG_Climate_Metrics.csv');
    macroData = await loadWideCSV('./data/Macroeconomic_Participation_Banking_Data.csv');

    setupSlicers();
    updateAll();
});
