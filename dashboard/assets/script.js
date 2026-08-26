/* ============================================================
   1. CSV LOADER (WIDE FORMAT → USABLE FORMAT)
   ============================================================ */

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

async function loadWideCSV(path) {
    const res = await fetch(path);
    if (!res.ok) {
        console.error('Failed to load CSV:', path, res.status);
        return { years: [], metrics: {} };
    }

    const text = await res.text();
    const rows = text.trim().split('\n').map(r => parseCSVLine(r));

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
let financingView = 'all';
let riskMetrics = 'npf-car';
let esgView = 'sukuk-score';
let macroMetrics = 'cpi-m2';
let forecastMetric = 'participation';

/* ============================================================
   3.1 PREMIUM COLOR PALETTE
   ============================================================ */
const PALETTE = {
    navy: '#013026',
    blue: '#014760',
    emerald: '#107e57',
    lime: '#a1ce3f',
    paleLime: '#cbe58e'
};


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
            line: { color: '#107e57' },
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
            line: { color: '#a1ce3f' },
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
                marker: { color: '#a1ce3f', size: 12 },
                hoverinfo: 'skip',
                showlegend: false
            });
            traces.push({
                x: [years[idx]],
                y: [deposits[idx]],
                type: 'scatter',
                mode: 'markers',
                marker: { color: '#a1ce3f', size: 12 },
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
    const mudaraba = fin.metrics["Mudaraba Financing"] || [];
    const musharaka = fin.metrics["Musharaka Financing"] || [];

    const traces = [];

    // Always include Murabaha and Ijara
    traces.push({
        x: years,
        y: murabaha,
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Murabaha',
        line: { color: '#107e57' },
        marker: { size: 6 },
        text: buildHoverText(years, murabaha),
        hovertemplate: '%{text}<extra></extra>'
    });

    traces.push({
        x: years,
        y: ijara,
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Ijara',
        line: { color: '#014760' },
        marker: { size: 6 },
        text: buildHoverText(years, ijara),
        hovertemplate: '%{text}<extra></extra>'
    });

    // Add Mudaraba and Musharaka only if "all" is selected
    if (financingView === 'all') {
        traces.push({
            x: years,
            y: mudaraba,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Mudaraba',
            line: { color: '#a1ce3f' },
            marker: { size: 6 },
            text: buildHoverText(years, mudaraba),
            hovertemplate: '%{text}<extra></extra>'
        });

        traces.push({
            x: years,
            y: musharaka,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Musharaka',
            line: { color: '#013026' },
            marker: { size: 6 },
            text: buildHoverText(years, musharaka),
            hovertemplate: '%{text}<extra></extra>'
        });
    }

    if (currentYear) {
        const idx = years.indexOf(currentYear);
        if (idx >= 0) {
            traces.push({
                x: [years[idx]],
                y: [murabaha[idx]],
                type: 'scatter',
                mode: 'markers',
                marker: { color: '#a1ce3f', size: 12 },
                hoverinfo: 'skip',
                showlegend: false
            });
            traces.push({
                x: [years[idx]],
                y: [ijara[idx]],
                type: 'scatter',
                mode: 'markers',
                marker: { color: '#a1ce3f', size: 12 },
                hoverinfo: 'skip',
                showlegend: false
            });
            
            if (financingView === 'all') {
                traces.push({
                    x: [years[idx]],
                    y: [mudaraba[idx]],
                    type: 'scatter',
                    mode: 'markers',
                    marker: { color: '#a1ce3f', size: 12 },
                    hoverinfo: 'skip',
                    showlegend: false
                });
                traces.push({
                    x: [years[idx]],
                    y: [musharaka[idx]],
                    type: 'scatter',
                    mode: 'markers',
                    marker: { color: '#a1ce3f', size: 12 },
                    hoverinfo: 'skip',
                    showlegend: false
                });
            }
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
        marker: { color: '#107e57' },
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
        marker: { color: ['#107e57', '#014760'] },
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
    const lcr = risk.metrics["Liquidity Coverage Ratio"] || [];
    const ldr = risk.metrics["Loan_to_Deposit Ratio"] || [];

    const traces = [];
    let yaxes = {};

    if (riskMetrics === 'npf-car' || riskMetrics === 'all') {
        traces.push({
            x: years,
            y: npf,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'NPF Ratio',
            line: { color: '#013026' },
            marker: { size: 6 },
            text: buildHoverText(years, npf),
            hovertemplate: '%{text}<extra></extra>',
            yaxis: riskMetrics === 'all' ? 'y' : 'y'
        });

        traces.push({
            x: years,
            y: car,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'CAR',
            line: { color: '#107e57' },
            marker: { size: 6 },
            text: buildHoverText(years, car),
            hovertemplate: '%{text}<extra></extra>',
            yaxis: 'y2'
        });
    }

    if (riskMetrics === 'lcr-ldr' || riskMetrics === 'all') {
        traces.push({
            x: years,
            y: lcr,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'LCR',
            line: { color: '#014760' },
            marker: { size: 6 },
            text: buildHoverText(years, lcr),
            hovertemplate: '%{text}<extra></extra>',
            yaxis: riskMetrics === 'all' ? 'y3' : 'y'
        });

        traces.push({
            x: years,
            y: ldr,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'LDR',
            line: { color: '#a1ce3f' },
            marker: { size: 6 },
            text: buildHoverText(years, ldr),
            hovertemplate: '%{text}<extra></extra>',
            yaxis: riskMetrics === 'all' ? 'y4' : 'y2'
        });
    }

    if (currentYear) {
        const idx = years.indexOf(currentYear);
        if (idx >= 0) {
            if (riskMetrics === 'npf-car' || riskMetrics === 'all') {
                traces.push({
                    x: [years[idx]],
                    y: [npf[idx]],
                    type: 'scatter',
                    mode: 'markers',
                    marker: { color: '#a1ce3f', size: 12 },
                    hoverinfo: 'skip',
                    showlegend: false
                });

                traces.push({
                    x: [years[idx]],
                    y: [car[idx]],
                    type: 'scatter',
                    mode: 'markers',
                    marker: { color: '#a1ce3f', size: 12 },
                    hoverinfo: 'skip',
                    showlegend: false,
                    yaxis: 'y2'
                });
            }

            if (riskMetrics === 'lcr-ldr' || riskMetrics === 'all') {
                traces.push({
                    x: [years[idx]],
                    y: [lcr[idx]],
                    type: 'scatter',
                    mode: 'markers',
                    marker: { color: '#a1ce3f', size: 12 },
                    hoverinfo: 'skip',
                    showlegend: false,
                    yaxis: riskMetrics === 'all' ? 'y3' : 'y'
                });

                traces.push({
                    x: [years[idx]],
                    y: [ldr[idx]],
                    type: 'scatter',
                    mode: 'markers',
                    marker: { color: '#a1ce3f', size: 12 },
                    hoverinfo: 'skip',
                    showlegend: false,
                    yaxis: riskMetrics === 'all' ? 'y4' : 'y2'
                });
            }
        }
    }

    let layout = {
        margin: { t: 30, r: 40, l: 60, b: 40 }
    };

    if (riskMetrics === 'npf-car') {
        layout.yaxis2 = { overlaying: 'y', side: 'right' };
    } else if (riskMetrics === 'lcr-ldr') {
        layout.yaxis2 = { overlaying: 'y', side: 'right' };
    } else if (riskMetrics === 'all') {
        layout.yaxis2 = { overlaying: 'y', side: 'right' };
        layout.yaxis3 = { overlaying: 'y', side: 'left', position: 0.15 };
        layout.yaxis4 = { overlaying: 'y', side: 'right', position: 0.85 };
    }

    Plotly.newPlot('risk_chart', traces, layout);
}

/* ---------- 5.6 ESG (FULL SERIES + HIGHLIGHTED YEAR) ---------- */

function buildESGChart(esg) {
    if (!esg.years.length) return;

    const years = esg.years;
    const sukuk = esg.metrics["Sustainable Sukuk"] || [];
    const emissions = esg.metrics["GHG Emissions"] || [];
    const social = esg.metrics["Social Impact Projects/ SME Financing"] || [];
    const score = esg.metrics["Avg. ESG Score (Weighted)"] || [];

    const traces = [];

    if (esgView === 'sukuk-score') {
        traces.push({
            x: years,
            y: sukuk,
            type: 'bar',
            name: 'Sustainable Sukuk',
            marker: { color: '#107e57' },
            text: buildHoverText(years, sukuk),
            hovertemplate: '%{text}<extra></extra>'
        });
    } else if (esgView === 'emissions-score') {
        traces.push({
            x: years,
            y: emissions,
            type: 'bar',
            name: 'GHG Emissions',
            marker: { color: '#013026' },
            text: buildHoverText(years, emissions),
            hovertemplate: '%{text}<extra></extra>'
        });
    } else if (esgView === 'social-score') {
        traces.push({
            x: years,
            y: social,
            type: 'bar',
            name: 'Social Impact Projects / SME Financing',
            marker: { color: '#014760' },
            text: buildHoverText(years, social),
            hovertemplate: '%{text}<extra></extra>'
        });
    }

    traces.push({
        x: years,
        y: score,
        type: 'scatter',
        mode: 'lines+markers',
        name: 'ESG Score',
        yaxis: 'y2',
        line: { color: '#a1ce3f' },
        marker: { size: 6 },
        text: buildHoverText(years, score),
        hovertemplate: '%{text}<extra></extra>'
    });

    if (currentYear) {
        const idx = years.indexOf(currentYear);
        if (idx >= 0) {
            if (esgView === 'sukuk-score') {
                traces.push({
                    x: [years[idx]],
                    y: [sukuk[idx]],
                    type: 'scatter',
                    mode: 'markers',
                    marker: { color: '#a1ce3f', size: 12 },
                    hoverinfo: 'skip',
                    showlegend: false
                });
            } else if (esgView === 'emissions-score') {
                traces.push({
                    x: [years[idx]],
                    y: [emissions[idx]],
                    type: 'scatter',
                    mode: 'markers',
                    marker: { color: '#a1ce3f', size: 12 },
                    hoverinfo: 'skip',
                    showlegend: false
                });
            } else if (esgView === 'social-score') {
                traces.push({
                    x: [years[idx]],
                    y: [social[idx]],
                    type: 'scatter',
                    mode: 'markers',
                    marker: { color: '#a1ce3f', size: 12 },
                    hoverinfo: 'skip',
                    showlegend: false
                });
            }

            traces.push({
                x: [years[idx]],
                y: [score[idx]],
                type: 'scatter',
                mode: 'markers',
                marker: { color: '#a1ce3f', size: 12 },
                hoverinfo: 'skip',
                showlegend: false,
                yaxis: 'y2'
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
    const financing = macro.metrics["PB Sectoral Financing"] || [];

    const traces = [];

    // Always include CPI
    traces.push({
        x: years,
        y: cpi,
        type: 'scatter',
        mode: 'lines+markers',
        name: 'CPI',
        line: { color: '#013026' },
        marker: { size: 6 },
        text: buildHoverText(years, cpi),
        hovertemplate: '%{text}<extra></extra>'
    });

    if (macroMetrics === 'cpi-m2') {
        traces.push({
            x: years,
            y: m2,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'M2',
            yaxis: 'y2',
            line: { color: '#107e57' },
            marker: { size: 6 },
            text: buildHoverText(years, m2),
            hovertemplate: '%{text}<extra></extra>'
        });
    } else if (macroMetrics === 'cpi-financing') {
        traces.push({
            x: years,
            y: financing,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'PB Sectoral Financing',
            yaxis: 'y2',
            line: { color: '#107e57' },
            marker: { size: 6 },
            text: buildHoverText(years, financing),
            hovertemplate: '%{text}<extra></extra>'
        });
    }

    if (currentYear) {
        const idx = years.indexOf(currentYear);
        if (idx >= 0) {
            traces.push({
                x: [years[idx]],
                y: [cpi[idx]],
                type: 'scatter',
                mode: 'markers',
                marker: { color: '#a1ce3f', size: 12 },
                hoverinfo: 'skip',
                showlegend: false
            });

            if (macroMetrics === 'cpi-m2') {
                traces.push({
                    x: [years[idx]],
                    y: [m2[idx]],
                    type: 'scatter',
                    mode: 'markers',
                    marker: { color: '#a1ce3f', size: 12 },
                    hoverinfo: 'skip',
                    showlegend: false,
                    yaxis: 'y2'
                });
            } else if (macroMetrics === 'cpi-financing') {
                traces.push({
                    x: [years[idx]],
                    y: [financing[idx]],
                    type: 'scatter',
                    mode: 'markers',
                    marker: { color: '#a1ce3f', size: 12 },
                    hoverinfo: 'skip',
                    showlegend: false,
                    yaxis: 'y2'
                });
            }
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
    
    let metricKey = "Participation Accounts";
    if (forecastMetric === 'special') {
        metricKey = "Special Current Accounts";
    } else if (forecastMetric === 'term') {
        metricKey = "Term Participation Accounts";
    }

    const yArr = dep.metrics[metricKey] || [];
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

    const lastYear = Math.max(...xNum);
    const forecastYearsNum = [lastYear + 1, lastYear + 2, lastYear + 3];
    const forecastYears = forecastYearsNum.map(String);
    const forecastValues = forecastYearsNum.map(x => slope * x + intercept);

    const traces = [
        {
            x: years,
            y: yArr,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Actual ' + metricKey,
            line: { color: '#107e57' },
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
            line: { color: '#a1ce3f', dash: 'dash' },
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
                marker: { color: '#a1ce3f', size: 12 },
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
        marker: { color: '#107e57' },
        text: y.map(v => formatNumber(v)),
        hovertemplate: '%{x}: %{text}<extra></extra>'
    };

    Plotly.newPlot('modal-chart', [trace], {
        margin: { t: 30, r: 20, l: 60, b: 40 }
    });
}

/* ============================================================
   7. INTERACTIVE GLOSSARY
   ============================================================ */

const GLOSSARY_TERMS = [
    { term: 'Total Assets of Participation Banks', category: 'Market Size', def: 'The combined balance-sheet size (all owned and financed resources) of Türkiye\'s Islamic ("participation") banks — the headline measure of how big the sector is.' },
    { term: 'Total Financing', category: 'Market Size', def: 'The aggregate value of funds extended to customers through Sharia-compliant contracts such as Murabaha, Ijara, Mudaraba, and Musharaka.' },
    { term: 'Total Deposits', category: 'Market Size', def: 'The combined balance of all customer funds held by participation banks, including Participation Accounts, Term Participation Accounts, and Special Current Accounts.' },
    { term: 'Participation Banking Market Share', category: 'Market Size', def: 'The percentage of Türkiye\'s total banking sector assets held by participation (Islamic) banks, relative to conventional banks.' },
    { term: 'Number of Branches / Employees', category: 'Market Size', def: 'The physical network size and workforce of the participation banking sector, indicating the scale of its retail footprint.' },
    { term: 'Sector Growth Rate', category: 'Market Size', def: 'The year-over-year percentage growth in the sector\'s total assets, showing momentum and expansion speed.' },

    { term: 'Murabaha Financing', category: 'Financing Portfolio', def: 'A cost-plus-profit sale contract: the bank buys an asset and resells it to the customer at a disclosed markup, payable in installments. The most widely used Islamic financing instrument.' },
    { term: 'Ijara (Leasing) Financing', category: 'Financing Portfolio', def: 'An Islamic leasing contract in which the bank owns an asset and leases its use to the customer for a rental fee, similar to an operating or finance lease.' },
    { term: 'Mudaraba Financing', category: 'Financing Portfolio', def: 'A profit-sharing partnership where the bank provides capital and the customer provides expertise/management; profits are shared per an agreed ratio and losses are borne by the capital provider.' },
    { term: 'Musharaka Financing', category: 'Financing Portfolio', def: 'A joint-venture partnership in which both the bank and the customer contribute capital and share profits and losses according to their equity stake.' },
    { term: 'Sukuk Investments', category: 'Financing Portfolio', def: 'Sharia-compliant investment certificates representing ownership in tangible assets or projects, functioning as the Islamic finance equivalent of bonds.' },
    { term: 'SME / Retail / Corporate Financing', category: 'Financing Portfolio', def: 'The financing portfolio broken down by customer segment — small & medium enterprises, individual retail customers, and large corporate clients.' },
    { term: 'Non-Performing Financing (NPF)', category: 'Financing Portfolio', def: 'The portion of financing where the customer has defaulted or is significantly overdue on payments — the Islamic-finance equivalent of a non-performing loan.' },

    { term: 'Participation Accounts', category: 'Deposits', def: 'Profit-and-loss-sharing deposit accounts — the Islamic equivalent of a savings account — where depositors earn a share of the bank\'s investment profits instead of fixed interest.' },
    { term: 'Special Current Accounts', category: 'Deposits', def: 'Capital-guaranteed, non-interest current accounts used for everyday transactions; depositors receive no profit share and the bank cannot invest these funds for its own gain in the same way.' },
    { term: 'Term Participation Accounts', category: 'Deposits', def: 'Participation accounts placed for a fixed maturity/term rather than being available on demand, typically offering a different profit-sharing arrangement based on tenor.' },
    { term: '1M / 3M / 6M / 12M Term Accounts', category: 'Deposits', def: 'The maturity buckets used to break down Term Participation Accounts by duration — one, three, six, and twelve months — revealing customer preference for shorter vs. longer commitments.' },
    { term: 'Retail vs Corporate Deposits', category: 'Deposits', def: 'Deposits segmented by depositor type: individual retail customers versus corporate/institutional clients — useful for gauging funding concentration.' },
    { term: 'Deposits by Currency (TL)', category: 'Deposits', def: 'The portion of total deposits held in Turkish Lira, as opposed to foreign-currency-denominated deposits.' },

    { term: 'NPF Ratio', category: 'Risk & Stability', def: 'Non-Performing Financing divided by Total Financing. A core asset-quality indicator — the lower it is, the healthier the financing book.' },
    { term: 'Capital Adequacy Ratio (CAR)', category: 'Risk & Stability', def: 'A bank\'s capital measured against its risk-weighted assets. It shows how well-cushioned the bank is to absorb unexpected losses; regulators set minimum thresholds.' },
    { term: 'Liquidity Coverage Ratio (LCR)', category: 'Risk & Stability', def: 'The ratio of high-quality liquid assets to expected net cash outflows over a 30-day stress period — a measure of short-term liquidity resilience.' },
    { term: 'Loan-to-Deposit Ratio (LDR)', category: 'Risk & Stability', def: 'Total financing extended relative to total deposits collected. A high LDR signals heavier reliance on financing relative to the stable deposit base.' },
    { term: 'Asset Quality', category: 'Risk & Stability', def: 'A broader composite indicator of the health of the bank\'s financing/asset portfolio, complementing the NPF Ratio.' },
    { term: 'ROA / ROE', category: 'Risk & Stability', def: 'Return on Assets and Return on Equity — profitability ratios measuring how efficiently the bank generates profit from its asset base and shareholder equity.' },

    { term: 'Sustainable Sukuk', category: 'ESG & Climate', def: 'Sukuk (Islamic bond-equivalent) certificates issued specifically to fund green, social, or sustainability-linked projects.' },
    { term: 'GHG Emissions', category: 'ESG & Climate', def: 'Greenhouse gas emissions associated with the bank\'s financed activities and operations — a key environmental-footprint metric.' },
    { term: 'Avg. ESG Score (Weighted)', category: 'ESG & Climate', def: 'A composite score summarizing Environmental, Social, and Governance performance, weighted across multiple underlying indicators.' },
    { term: 'Social Impact Projects / SME Financing', category: 'ESG & Climate', def: 'Financing directed toward projects with a measurable social benefit, including support for small and medium-sized enterprises.' },

    { term: 'Inflation Rate (CPI)', category: 'Macroeconomics', def: 'The year-over-year percentage change in the Consumer Price Index — the headline measure of inflation in the Turkish economy.' },
    { term: 'Money Supply (M2)', category: 'Macroeconomics', def: 'A broad measure of money supply including cash, checking deposits, and easily convertible near-money — an indicator of overall liquidity in the economy.' },
    { term: 'PB Sectoral Financing', category: 'Macroeconomics', def: 'The total value of financing extended by the participation banking sector as a whole, used here for macro-level context.' },
    { term: 'PB Market Share (%)', category: 'Macroeconomics', def: 'Participation banking\'s share of the total Turkish banking sector, tracked as a macroeconomic indicator alongside inflation and money supply.' }
];

function renderGlossary() {
    const list = document.getElementById('glossary-list');
    const search = document.getElementById('glossary-search');
    const countEl = document.getElementById('glossary-count');
    if (!list) return;

    function render(filterText) {
        const q = (filterText || '').trim().toLowerCase();
        const matches = GLOSSARY_TERMS.filter(item =>
            !q || item.term.toLowerCase().includes(q) || item.def.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
        );

        list.innerHTML = '';

        if (!matches.length) {
            const empty = document.createElement('div');
            empty.className = 'glossary-empty';
            empty.textContent = `No terms match "${filterText}".`;
            list.appendChild(empty);
        } else {
            let lastCategory = null;
            matches.forEach(item => {
                if (item.category !== lastCategory) {
                    const catEl = document.createElement('div');
                    catEl.className = 'glossary-category';
                    catEl.textContent = item.category;
                    list.appendChild(catEl);
                    lastCategory = item.category;
                }

                const itemEl = document.createElement('div');
                itemEl.className = 'glossary-item';

                const btn = document.createElement('button');
                btn.className = 'glossary-term';
                btn.innerHTML = `<span>${item.term}</span><span class="caret">▶</span>`;
                btn.addEventListener('click', () => {
                    itemEl.classList.toggle('open');
                });

                const defEl = document.createElement('div');
                defEl.className = 'glossary-def';
                defEl.textContent = item.def;

                itemEl.appendChild(btn);
                itemEl.appendChild(defEl);
                list.appendChild(itemEl);
            });
        }

        if (countEl) {
            countEl.textContent = `${matches.length} of ${GLOSSARY_TERMS.length} terms`;
        }
    }

    render('');

    if (search) {
        search.addEventListener('input', () => render(search.value));
    }
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
   9. SLICERS (YEAR + CUSTOMER TYPE + CHART-SPECIFIC OPTIONS)
   ============================================================ */

function setupSlicers() {
    const yearSelect = document.getElementById('year-slicer');
    const customerSelect = document.getElementById('customer-slicer');
    const financingViewSelect = document.getElementById('financing-view');
    const riskMetricsSelect = document.getElementById('risk-metrics');
    const esgViewSelect = document.getElementById('esg-view');
    const macroMetricsSelect = document.getElementById('macro-metrics');
    const forecastMetricSelect = document.getElementById('forecast-metric');

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

    if (financingViewSelect) {
        financingViewSelect.addEventListener('change', () => {
            financingView = financingViewSelect.value;
            updateAll();
        });
    }

    if (riskMetricsSelect) {
        riskMetricsSelect.addEventListener('change', () => {
            riskMetrics = riskMetricsSelect.value;
            updateAll();
        });
    }

    if (esgViewSelect) {
        esgViewSelect.addEventListener('change', () => {
            esgView = esgViewSelect.value;
            updateAll();
        });
    }

    if (macroMetricsSelect) {
        macroMetricsSelect.addEventListener('change', () => {
            macroMetrics = macroMetricsSelect.value;
            updateAll();
        });
    }

    if (forecastMetricSelect) {
        forecastMetricSelect.addEventListener('change', () => {
            forecastMetric = forecastMetricSelect.value;
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
}

/* ============================================================
   11. INITIALIZATION
   ============================================================ */

window.addEventListener('DOMContentLoaded', async () => {
    setupThemeToggle();
    renderGlossary();

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
