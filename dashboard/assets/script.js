/* ============================================================
   1. CSV LOADER (WIDE FORMAT → USABLE FORMAT)
   ============================================================ */

async function loadWideCSV(path) {
    const res = await fetch(path);
    const text = await res.text();
    const rows = text.trim().split('\n').map(r => r.split(','));

    const years = rows[0].slice(1).map(y => y.trim());
    const metrics = {};

    for (let i = 1; i < rows.length; i++) {
        const metricName = rows[i][0].trim();
        const values = rows[i]
            .slice(1)
            .map(v => Number(v.replace('%','').replace(',','.')));
        metrics[metricName] = values;
    }

    return { years, metrics };
}

/* ============================================================
   2. FORMAT HELPERS
   ============================================================ */

function formatNumber(x) {
    if (!x) return '-';
    const n = Number(x);
    if (isNaN(n)) return x;
    if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
    if (n >= 1e9)  return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6)  return (n / 1e6).toFixed(1) + 'M';
    return n.toLocaleString('en-US');
}

function formatPercent(x) {
    if (!x) return '-';
    return (Number(x) * 100).toFixed(1) + '%';
}

/* ============================================================
   3. KPI UPDATER
   ============================================================ */

function updateKPIs(market) {
    const latestIndex = 0; // 2025 is first column

    document.getElementById('kpi-assets').textContent =
        formatNumber(market.metrics["Total Assets of Participation Banks"][latestIndex]);

    document.getElementById('kpi-financing').textContent =
        formatNumber(market.metrics["Total Financing"][latestIndex]);

    document.getElementById('kpi-deposits').textContent =
        formatNumber(market.metrics["Total Deposits"][latestIndex]);

    document.getElementById('kpi-share').textContent =
        market.metrics["Participation Banking Market Share"][latestIndex] + "%";
}

/* ============================================================
   4. PLOTLY CHART BUILDERS
   ============================================================ */

function buildMarketChart(market) {
    Plotly.newPlot('market_chart', [
        {
            x: market.years,
            y: market.metrics["Total Assets of Participation Banks"],
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Total Assets',
            line: { color: '#0F8A5F' }
        },
        {
            x: market.years,
            y: market.metrics["Total Deposits"],
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Total Deposits',
            line: { color: '#C9A227' }
        }
    ], {
        margin: { t: 30, r: 20, l: 60, b: 40 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)'
    });
}

function buildFinancingChart(fin) {
    Plotly.newPlot('financing_chart', [
        {
            x: fin.years,
            y: fin.metrics["Murabaha Financing"],
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Murabaha',
            line: { color: '#0F8A5F' }
        },
        {
            x: fin.years,
            y: fin.metrics["Ijara (Leasing) Financing"],
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Ijara',
            line: { color: '#0A1A2F' }
        }
    ], {
        margin: { t: 30, r: 20, l: 60, b: 40 }
    });
}

function buildDepositsChart(dep) {
    Plotly.newPlot('deposits_chart', [
        {
            x: dep.years,
            y: dep.metrics["Participation Accounts"],
            type: 'bar',
            name: 'Participation Accounts',
            marker: { color: '#0F8A5F' }
        },
        {
            x: dep.years,
            y: dep.metrics["Term Participation Accounts"],
            type: 'bar',
            name: 'Term Accounts',
            marker: { color: '#C9A227' }
        }
    ], {
        barmode: 'group',
        margin: { t: 30, r: 20, l: 60, b: 40 }
    });
}

function buildRiskChart(risk) {
    Plotly.newPlot('risk_chart', [
        {
            x: risk.years,
            y: risk.metrics["Non_Performing Financing Ratio (NPF Ratio)"],
            type: 'scatter',
            mode: 'lines+markers',
            name: 'NPF Ratio',
            line: { color: '#C0392B' }
        },
        {
            x: risk.years,
            y: risk.metrics["Capital Adequacy Ratio"],
            type: 'scatter',
            mode: 'lines+markers',
            name: 'CAR',
            yaxis: 'y2',
            line: { color: '#0F8A5F' }
        }
    ], {
        yaxis2: { overlaying: 'y', side: 'right' }
    });
}

function buildESGChart(esg) {
    Plotly.newPlot('esg_chart', [
        {
            x: esg.years,
            y: esg.metrics["Sustainable Sukuk"],
            type: 'bar',
            name: 'Sustainable Sukuk',
            marker: { color: '#0F8A5F' }
        },
        {
            x: esg.years,
            y: esg.metrics["Avg. ESG Score (Weighted)"],
            type: 'scatter',
            mode: 'lines+markers',
            name: 'ESG Score',
            yaxis: 'y2',
            line: { color: '#C9A227' }
        }
    ], {
        yaxis2: { overlaying: 'y', side: 'right' }
    });
}

function buildMacroChart(macro) {
    Plotly.newPlot('macro_chart', [
        {
            x: macro.years,
            y: macro.metrics["Inflation Rate (CPI %)"],
            type: 'scatter',
            mode: 'lines+markers',
            name: 'CPI',
            line: { color: '#C0392B' }
        },
        {
            x: macro.years,
            y: macro.metrics["Money Supply M2"],
            type: 'scatter',
            mode: 'lines+markers',
            name: 'M2',
            yaxis: 'y2',
            line: { color: '#0F8A5F' }
        }
    ], {
        yaxis2: { overlaying: 'y', side: 'right' }
    });
}

/* ============================================================
   5. DARK MODE
   ============================================================ */

function setupThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    btn.addEventListener('click', () => {
        document.body.classList.toggle('dark');
        btn.textContent = document.body.classList.contains('dark')
            ? 'Light Mode'
            : 'Dark Mode';

        Plotly.Plots.resize('market_chart');
        Plotly.Plots.resize('financing_chart');
        Plotly.Plots.resize('deposits_chart');
        Plotly.Plots.resize('risk_chart');
        Plotly.Plots.resize('esg_chart');
        Plotly.Plots.resize('macro_chart');
    });
}

/* ============================================================
   6. INITIALIZATION
   ============================================================ */

window.addEventListener('DOMContentLoaded', async () => {
    setupThemeToggle();

    const market = await loadWideCSV('../data/Market_Size.csv');
    const financing = await loadWideCSV('../data/Financing_Portfolio_Islamic_Products.csv');
    const deposits = await loadWideCSV('../data/Deposits_Participation_Accounts.csv');
    const risk = await loadWideCSV('../data/Risk_Stability_Metrics.csv');
    const esg = await loadWideCSV('../data/ESG_Climate_Metrics.csv'); // only 2025–2021
    const macro = await loadWideCSV('../data/Macroeconomic_Participation_Banking_Data.csv');

    updateKPIs(market);
    buildMarketChart(market);
    buildFinancingChart(financing);
    buildDepositsChart(deposits);
    buildRiskChart(risk);
    buildESGChart(esg);
    buildMacroChart(macro);
});
