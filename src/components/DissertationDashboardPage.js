import React, { useEffect, useMemo, useState } from 'react';
import './DissertationDashboardPage.css';

const DATA_URL = `${process.env.PUBLIC_URL || ''}/data/dissertation-demo-predictions.csv`;
const DEFAULT_THRESHOLD = 0.495;
const VIEW_OPTIONS = ['Catalogue Explorer', 'Star Map'];
const FEATURE_COLUMNS = [
  'CSB',
  'sigma0',
  'L_tot',
  't_rh',
  'r_hl',
  'r_c',
  'rc_over_rhl',
  'L_over_rhl2',
];
const EXTRA_COLUMNS = [
  'paper_pred',
  'paper_pred_fallback',
  'lit_candidate',
  'catalogue_source',
  'relaxation_time_definition',
];
const TABLE_COLUMNS = [
  'cluster_name',
  'p_BHS',
  'predicted_BHS',
  'tier',
  'paper_pred',
  'paper_pred_fallback',
  'CSB',
  'sigma0',
  'L_tot',
  't_rh',
  'r_hl',
  'r_c',
];
const TIER_ORDER = ['Robust', 'Plausible', 'Exploratory', 'No tier', 'Not BHS'];
const TIER_COLORS = {
  Robust: '#ff5050',
  Plausible: '#ffbe46',
  Exploratory: '#9b78ff',
  'No tier': '#dcdcdc',
  'Not BHS': '#5a96ff',
};
const NUMERIC_FIELDS = new Set([
  'p_BHS',
  'paper_pred',
  'paper_pred_fallback',
  'CSB',
  'sigma0',
  'L_tot',
  't_rh',
  'r_hl',
  'r_c',
  'rc_over_rhl',
  'L_over_rhl2',
]);

function parseCsv(text) {
  const rows = [];
  let currentField = '';
  let currentRow = [];
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === ',' && !insideQuotes) {
      currentRow.push(currentField);
      currentField = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }

      if (currentField.length > 0 || currentRow.length > 0) {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      }
      continue;
    }

    currentField += char;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  if (!rows.length) {
    return [];
  }

  const [header, ...body] = rows;
  return body.map((row) => {
    const record = {};

    header.forEach((column, columnIndex) => {
      const value = row[columnIndex] ?? '';
      if (value === '') {
        record[column] = '';
      } else if (NUMERIC_FIELDS.has(column)) {
        const parsed = Number(value);
        record[column] = Number.isFinite(parsed) ? parsed : value;
      } else {
        record[column] = value;
      }
    });

    return record;
  });
}

function stableHash(value) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
}

function createRng(seedValue) {
  let seed = stableHash(seedValue) || 1;

  return () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function stablePoint(catalogue, clusterName) {
  const rng = createRng(`${catalogue}::${clusterName}`);
  return {
    x: rng(),
    y: rng(),
  };
}

function normaliseTier(value) {
  if (!value) {
    return 'No tier';
  }

  const lower = String(value).trim().toLowerCase();
  const tierMap = {
    r: 'Robust',
    robust: 'Robust',
    p: 'Plausible',
    plausible: 'Plausible',
    e: 'Exploratory',
    exploratory: 'Exploratory',
  };

  return tierMap[lower] || 'No tier';
}

function buildCatalogueRows(rows, selectedCatalogue, threshold) {
  return rows
    .filter((row) => row.catalogue === selectedCatalogue)
    .map((row) => {
      const probability = Number(row.p_BHS) || 0;
      const point = stablePoint(row.catalogue, String(row.cluster_name));
      return {
        ...row,
        predicted_BHS: probability >= threshold,
        x: point.x,
        y: point.y,
        markerSize: 10 + Math.max(0, Math.min(1, probability)) * 25,
      };
    });
}

function generateBackgroundStars(catalogue, count = 220) {
  return Array.from({ length: count }, (_, index) => {
    const rng = createRng(`bg::${catalogue}::${index}`);
    const x = rng();
    const y = rng();
    const size = 1.5 + rng() * 6;
    const glow = rng() < 0.28;
    const palette = [
      'rgba(255,255,255,0.85)',
      'rgba(190,220,255,0.8)',
      'rgba(255,244,214,0.82)',
      'rgba(255,220,150,0.74)',
      'rgba(170,200,255,0.72)',
    ];

    return {
      x,
      y,
      size,
      glow,
      color: palette[Math.floor(rng() * palette.length)],
    };
  });
}

function buildHistogramBins(rows, threshold, binCount = 30) {
  const bins = Array.from({ length: binCount }, (_, index) => ({
    index,
    lower: index / binCount,
    upper: (index + 1) / binCount,
    positive: 0,
    negative: 0,
  }));

  rows.forEach((row) => {
    const probability = Number(row.p_BHS) || 0;
    const clamped = Math.max(0, Math.min(0.999999, probability));
    const binIndex = Math.min(binCount - 1, Math.floor(clamped * binCount));

    if (probability >= threshold) {
      bins[binIndex].positive += 1;
    } else {
      bins[binIndex].negative += 1;
    }
  });

  return bins;
}

function formatValue(value, decimals = 2) {
  if (value === '' || value === null || value === undefined) {
    return '-';
  }

  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return value.toLocaleString();
    }

    return value.toLocaleString(undefined, {
      maximumFractionDigits: decimals,
      minimumFractionDigits: value < 1 ? Math.min(decimals, 3) : 0,
    });
  }

  return String(value);
}

function formatProbability(value) {
  if (typeof value !== 'number') {
    return '-';
  }

  return value.toFixed(3);
}

function TierBadge({ label }) {
  const color = TIER_COLORS[label] || '#dcdcdc';

  return (
    <span
      className="dashboard-badge"
      style={{
        backgroundColor: `${color}22`,
        borderColor: `${color}66`,
        color,
      }}
    >
      {label}
    </span>
  );
}

function ClusterDetails({ row, threshold }) {
  if (!row) {
    return (
      <div className="dashboard-empty">
        No cluster is selected for the current filters.
      </div>
    );
  }

  const displayTier = row.predicted_BHS ? normaliseTier(row.tier) : 'Not BHS';
  const thresholdMargin =
    typeof row.p_BHS === 'number' ? row.p_BHS - threshold : null;

  return (
    <div className="dashboard-grid">
      <div>
        <div className="dashboard-card-title">Cluster detail</div>
        <div className="dashboard-details-grid">
          <div className="dashboard-detail-card">
            <div className="dashboard-detail-label">Cluster</div>
            <div className="dashboard-detail-value">{row.cluster_name}</div>
          </div>
          <div className="dashboard-detail-card">
            <div className="dashboard-detail-label">Catalogue</div>
            <div className="dashboard-detail-value">{row.catalogue}</div>
          </div>
          <div className="dashboard-detail-card">
            <div className="dashboard-detail-label">Tier</div>
            <div className="dashboard-detail-value">
              <TierBadge label={displayTier} />
            </div>
          </div>
          <div className="dashboard-detail-card">
            <div className="dashboard-detail-label">p(BHS)</div>
            <div className="dashboard-detail-value">{formatProbability(row.p_BHS)}</div>
          </div>
          <div className="dashboard-detail-card">
            <div className="dashboard-detail-label">Prediction</div>
            <div className="dashboard-detail-value">
              {row.predicted_BHS ? 'BHS candidate' : 'Not BHS'}
            </div>
          </div>
          <div className="dashboard-detail-card">
            <div className="dashboard-detail-label">Threshold margin</div>
            <div className="dashboard-detail-value">
              {thresholdMargin === null ? '-' : thresholdMargin.toFixed(3)}
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-card">
        <div className="dashboard-card-title">Observable information</div>
        <table className="dashboard-feature-table">
          <tbody>
            {FEATURE_COLUMNS.map((column) => (
              <tr key={column}>
                <td>{column}</td>
                <td>{formatValue(row[column])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="dashboard-card">
        <div className="dashboard-card-title">Additional metadata</div>
        <table className="dashboard-feature-table">
          <tbody>
            {EXTRA_COLUMNS.map((column) => (
              <tr key={column}>
                <td>{column}</td>
                <td>{formatValue(row[column], 3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExplorerHistogram({ bins, threshold }) {
  const width = 920;
  const height = 280;
  const padding = { top: 16, right: 16, bottom: 30, left: 16 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxCount = Math.max(...bins.map((bin) => bin.positive + bin.negative), 1);
  const barWidth = chartWidth / bins.length;

  return (
    <svg
      className="dashboard-plot"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Histogram of dissertation prediction probabilities"
    >
      <rect x="0" y="0" width={width} height={height} fill="#09111f" rx="24" />
      {bins.map((bin) => {
        const x = padding.left + bin.index * barWidth;
        const negativeHeight = (bin.negative / maxCount) * chartHeight;
        const positiveHeight = (bin.positive / maxCount) * chartHeight;
        const negativeY = padding.top + chartHeight - negativeHeight;
        const positiveY = negativeY - positiveHeight;

        return (
          <g key={bin.index}>
            <rect
              x={x + 1}
              y={negativeY}
              width={Math.max(1, barWidth - 2)}
              height={negativeHeight}
              fill="rgba(90, 150, 255, 0.78)"
            />
            <rect
              x={x + 1}
              y={positiveY}
              width={Math.max(1, barWidth - 2)}
              height={positiveHeight}
              fill="rgba(255, 128, 80, 0.92)"
            />
          </g>
        );
      })}

      {Array.from({ length: 5 }, (_, index) => {
        const y = padding.top + (chartHeight / 4) * index;
        return (
          <line
            key={`grid-${index}`}
            x1={padding.left}
            x2={width - padding.right}
            y1={y}
            y2={y}
            stroke="rgba(148, 163, 184, 0.12)"
          />
        );
      })}

      <line
        x1={padding.left + chartWidth * threshold}
        x2={padding.left + chartWidth * threshold}
        y1={padding.top}
        y2={padding.top + chartHeight}
        stroke="#facc15"
        strokeDasharray="8 8"
        strokeWidth="3"
      />
      <text
        x={padding.left + chartWidth * threshold + 8}
        y={padding.top + 18}
        fill="#facc15"
        fontSize="14"
        fontWeight="700"
      >
        threshold {threshold.toFixed(3)}
      </text>
    </svg>
  );
}

function StarMap({ stars, clusters, selectedClusterName, setSelectedClusterName, labelHighProbability }) {
  const width = 1000;
  const height = 720;

  return (
    <div className="dashboard-map-frame">
      <svg
        className="dashboard-plot"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Interactive star map of predicted dissertation clusters"
      >
        <rect x="0" y="0" width={width} height={height} fill="#040610" />

        {stars.map((star, index) => (
          <g key={`star-${index}`}>
            {star.glow ? (
              <circle
                cx={star.x * width}
                cy={(1 - star.y) * height}
                r={star.size * 2.2}
                fill="rgba(255,255,255,0.08)"
              />
            ) : null}
            <circle
              cx={star.x * width}
              cy={(1 - star.y) * height}
              r={star.size}
              fill={star.color}
            />
          </g>
        ))}

        {clusters.map((row) => {
          const tierLabel = row.predicted_BHS ? normaliseTier(row.tier) : 'Not BHS';
          const color = TIER_COLORS[tierLabel] || '#dcdcdc';
          const x = row.x * width;
          const y = (1 - row.y) * height;
          const isSelected = row.cluster_name === selectedClusterName;
          const showLabel = labelHighProbability && row.p_BHS >= 0.8;

          return (
            <g
              key={row.cluster_name}
              onClick={() => setSelectedClusterName(row.cluster_name)}
              style={{ cursor: 'pointer' }}
            >
              <circle cx={x} cy={y} r={row.markerSize * 0.9} fill={`${color}24`} />
              {isSelected ? (
                <circle
                  cx={x}
                  cy={y}
                  r={row.markerSize * 0.45 + 9}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="4"
                />
              ) : null}
              <circle
                cx={x}
                cy={y}
                r={row.markerSize * 0.45}
                fill={color}
                stroke="#ffffff"
                strokeWidth="1.5"
              />
              {showLabel ? (
                <text
                  x={x}
                  y={y - row.markerSize * 0.65}
                  fill="#f8fafc"
                  fontSize="12"
                  textAnchor="middle"
                >
                  {row.cluster_name}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DissertationDashboardPage({ onBack }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState(VIEW_OPTIONS[0]);
  const [selectedCatalogue, setSelectedCatalogue] = useState('');
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [showOnlyPositive, setShowOnlyPositive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [minimumProbability, setMinimumProbability] = useState(0);
  const [showTiers, setShowTiers] = useState(TIER_ORDER);
  const [labelHighProbability, setLabelHighProbability] = useState(true);
  const [selectedClusterName, setSelectedClusterName] = useState('');

  useEffect(() => {
    let active = true;

    fetch(DATA_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unable to load dissertation data (${response.status})`);
        }
        return response.text();
      })
      .then((text) => {
        if (!active) {
          return;
        }
        setRows(parseCsv(text));
        setLoading(false);
      })
      .catch((fetchError) => {
        if (!active) {
          return;
        }
        setError(fetchError.message);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const catalogues = useMemo(() => {
    const uniqueCatalogues = [...new Set(rows.map((row) => row.catalogue).filter(Boolean))];
    return uniqueCatalogues.sort((left, right) => left.localeCompare(right));
  }, [rows]);

  useEffect(() => {
    if (!selectedCatalogue && catalogues.length) {
      setSelectedCatalogue(catalogues[0]);
    }
  }, [catalogues, selectedCatalogue]);

  const catalogueRows = useMemo(
    () => buildCatalogueRows(rows, selectedCatalogue, threshold),
    [rows, selectedCatalogue, threshold]
  );

  const histogramBins = useMemo(
    () => buildHistogramBins(catalogueRows, threshold),
    [catalogueRows, threshold]
  );

  const explorerRows = useMemo(() => {
    const filteredRows = showOnlyPositive
      ? catalogueRows.filter((row) => row.predicted_BHS)
      : catalogueRows;

    return [...filteredRows].sort((left, right) => right.p_BHS - left.p_BHS);
  }, [catalogueRows, showOnlyPositive]);

  const starMapRows = useMemo(() => {
    const loweredQuery = searchQuery.trim().toLowerCase();

    return catalogueRows
      .map((row) => ({
        ...row,
        tierDisplay: row.predicted_BHS ? normaliseTier(row.tier) : 'Not BHS',
      }))
      .filter((row) => {
        const matchesQuery = loweredQuery
          ? String(row.cluster_name).toLowerCase().includes(loweredQuery)
          : true;
        const matchesTier = showTiers.includes(row.tierDisplay);
        const matchesProbability = row.p_BHS >= minimumProbability;

        return matchesQuery && matchesTier && matchesProbability;
      })
      .sort((left, right) => right.p_BHS - left.p_BHS);
  }, [catalogueRows, minimumProbability, searchQuery, showTiers]);

  useEffect(() => {
    const activeRows = view === 'Star Map' ? starMapRows : explorerRows;

    if (!activeRows.length) {
      setSelectedClusterName('');
      return;
    }

    setSelectedClusterName((current) => {
      if (activeRows.some((row) => row.cluster_name === current)) {
        return current;
      }

      return activeRows[0].cluster_name;
    });
  }, [explorerRows, starMapRows, view]);

  const selectedCluster = useMemo(() => {
    const sourceRows = view === 'Star Map' ? starMapRows : explorerRows;
    return sourceRows.find((row) => row.cluster_name === selectedClusterName)
      || catalogueRows.find((row) => row.cluster_name === selectedClusterName)
      || null;
  }, [catalogueRows, explorerRows, selectedClusterName, starMapRows, view]);

  const stars = useMemo(
    () => generateBackgroundStars(selectedCatalogue, 260),
    [selectedCatalogue]
  );

  const totalClusters = catalogueRows.length;
  const positiveCandidates = catalogueRows.filter((row) => row.predicted_BHS).length;
  const positiveRate = totalClusters ? (positiveCandidates / totalClusters) * 100 : 0;

  if (loading) {
    return (
      <div className="dashboard-loading">
        Loading dissertation dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-shell">
        <div className="dashboard-page">
          <div className="dashboard-empty">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <div className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <div className="dashboard-status">
              <span className="dashboard-status-dot" />
              Interactive dissertation dashboard
            </div>
            <h1 className="dashboard-title">
              Black Hole Subsystem Classifier Demonstration
            </h1>
            <p className="dashboard-subtitle">
              A React rebuild of the original dissertation explorer for browsing model predictions,
              adjusting the classification threshold, and investigating cluster-level observables across
              multiple catalogues.
            </p>
          </div>

          <div className="dashboard-actions">
            <button
              type="button"
              className="dashboard-button"
              onClick={onBack}
            >
              Back to Portfolio
            </button>
            <button
              type="button"
              className="dashboard-button dashboard-button-primary"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              Jump to Controls
            </button>
          </div>
        </header>

        <section className="dashboard-hero">
          <div className="dashboard-card">
            <div className="dashboard-card-title">What this page shows</div>
            <p className="dashboard-card-copy">
              The dashboard uses observationally motivated cluster properties to estimate the
              probability that a globular cluster hosts a black hole subsystem. You can inspect
              distributions catalogue by catalogue, apply probability thresholds, and compare
              high-confidence candidates with below-threshold systems.
            </p>
            <div className="dashboard-feature-list">
              <div className="dashboard-feature-pill">Catalogue Explorer</div>
              <div className="dashboard-feature-pill">Interactive Star Map</div>
              <div className="dashboard-feature-pill">Threshold Tuning</div>
              <div className="dashboard-feature-pill">Cluster Detail Panels</div>
            </div>
          </div>

          <div className="dashboard-card">
            <div className="dashboard-card-title">Current scope</div>
            <p className="dashboard-card-copy">
              The data shown here is sourced from the dissertation export used by the original
              Streamlit prototype. This page now runs entirely inside the portfolio frontend,
              so it behaves like a normal route in the site rather than a separate Python app.
            </p>
          </div>
        </section>

        <section className="dashboard-controls">
          <div className="dashboard-field">
            <div className="dashboard-field-label">View</div>
            <div className="dashboard-segmented">
              {VIEW_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`dashboard-segment ${
                    option === view ? 'dashboard-segment-active' : ''
                  }`}
                  onClick={() => setView(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="dashboard-field">
            <label className="dashboard-field-label" htmlFor="catalogue-select">
              Catalogue
            </label>
            <select
              id="catalogue-select"
              className="dashboard-select"
              value={selectedCatalogue}
              onChange={(event) => setSelectedCatalogue(event.target.value)}
            >
              {catalogues.map((catalogue) => (
                <option key={catalogue} value={catalogue}>
                  {catalogue}
                </option>
              ))}
            </select>
          </div>

          <div className="dashboard-field">
            <label className="dashboard-field-label" htmlFor="threshold-slider">
              BHS threshold
            </label>
            <input
              id="threshold-slider"
              className="dashboard-slider"
              type="range"
              min="0"
              max="1"
              step="0.005"
              value={threshold}
              onChange={(event) => setThreshold(Number(event.target.value))}
            />
            <div className="dashboard-slider-value">{threshold.toFixed(3)}</div>
          </div>

          <div className="dashboard-field">
            <label className="dashboard-field-label" htmlFor="cluster-search">
              Search cluster
            </label>
            <input
              id="cluster-search"
              className="dashboard-input"
              type="text"
              placeholder="NGC 3201, Pal 5, M 10"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
        </section>

        <section className="dashboard-metrics">
          <div className="dashboard-metric">
            <div className="dashboard-metric-label">Clusters</div>
            <div className="dashboard-metric-value">{formatValue(totalClusters)}</div>
          </div>
          <div className="dashboard-metric">
            <div className="dashboard-metric-label">Positive candidates</div>
            <div className="dashboard-metric-value">{formatValue(positiveCandidates)}</div>
          </div>
          <div className="dashboard-metric">
            <div className="dashboard-metric-label">Positive rate</div>
            <div className="dashboard-metric-value">{positiveRate.toFixed(1)}%</div>
          </div>
        </section>

        {view === 'Catalogue Explorer' ? (
          <section className="dashboard-layout">
            <div className="dashboard-grid">
              <div className="dashboard-card">
                <div className="dashboard-card-title">Prediction distribution</div>
                <ExplorerHistogram bins={histogramBins} threshold={threshold} />
                <div className="dashboard-legend">
                  <span className="dashboard-legend-item">
                    <span className="dashboard-legend-swatch" style={{ background: '#ff8050' }} />
                    Predicted BHS
                  </span>
                  <span className="dashboard-legend-item">
                    <span className="dashboard-legend-swatch" style={{ background: '#5a96ff' }} />
                    Below threshold
                  </span>
                </div>
              </div>

              <div className="dashboard-card">
                <div className="dashboard-toolbar">
                  <label className="dashboard-checkbox">
                    <input
                      type="checkbox"
                      checked={showOnlyPositive}
                      onChange={(event) => setShowOnlyPositive(event.target.checked)}
                    />
                    Show only positive candidates
                  </label>
                </div>

                <div className="dashboard-card-title">Cluster predictions</div>
                <div className="dashboard-table-wrap">
                  <table className="dashboard-table">
                    <thead>
                      <tr>
                        {TABLE_COLUMNS.map((column) => (
                          <th key={column}>{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {explorerRows.map((row) => (
                        <tr
                          key={row.cluster_name}
                          className={
                            row.cluster_name === selectedClusterName
                              ? 'dashboard-table-row-active'
                              : ''
                          }
                          onClick={() => setSelectedClusterName(row.cluster_name)}
                        >
                          <td>{row.cluster_name}</td>
                          <td>{formatProbability(row.p_BHS)}</td>
                          <td>{row.predicted_BHS ? 'true' : 'false'}</td>
                          <td>{row.tier || '-'}</td>
                          <td>{formatValue(row.paper_pred, 3)}</td>
                          <td>{formatValue(row.paper_pred_fallback, 3)}</td>
                          <td>{formatValue(row.CSB)}</td>
                          <td>{formatValue(row.sigma0)}</td>
                          <td>{formatValue(row.L_tot)}</td>
                          <td>{formatValue(row.t_rh)}</td>
                          <td>{formatValue(row.r_hl)}</td>
                          <td>{formatValue(row.r_c)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="dashboard-card">
              <ClusterDetails row={selectedCluster} threshold={threshold} />
            </div>
          </section>
        ) : (
          <section className="dashboard-grid">
            <div className="dashboard-card">
              <div className="dashboard-toolbar">
                <div className="dashboard-field">
                  <label className="dashboard-field-label" htmlFor="min-probability">
                    Minimum p(BHS)
                  </label>
                  <input
                    id="min-probability"
                    className="dashboard-slider"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={minimumProbability}
                    onChange={(event) => setMinimumProbability(Number(event.target.value))}
                  />
                  <div className="dashboard-slider-value">{minimumProbability.toFixed(2)}</div>
                </div>

                <label className="dashboard-checkbox">
                  <input
                    type="checkbox"
                    checked={labelHighProbability}
                    onChange={(event) => setLabelHighProbability(event.target.checked)}
                  />
                  Label high-probability clusters
                </label>
              </div>

              <div className="dashboard-card-title">Legend and filters</div>
              <div className="dashboard-tier-list">
                {TIER_ORDER.map((tier) => {
                  const active = showTiers.includes(tier);
                  return (
                    <button
                      key={tier}
                      type="button"
                      className={`dashboard-tier-button ${
                        active ? 'dashboard-tier-button-active' : ''
                      }`}
                      onClick={() => {
                        setShowTiers((current) => {
                          if (current.includes(tier)) {
                            return current.filter((item) => item !== tier);
                          }

                          return [...current, tier];
                        });
                      }}
                    >
                      {tier}
                    </button>
                  );
                })}
              </div>
            </div>

            {!starMapRows.length ? (
              <div className="dashboard-empty">
                No clusters match the current star-map filters.
              </div>
            ) : (
              <div className="dashboard-map-layout">
                <div>
                  <StarMap
                    stars={stars}
                    clusters={starMapRows}
                    selectedClusterName={selectedClusterName}
                    setSelectedClusterName={setSelectedClusterName}
                    labelHighProbability={labelHighProbability}
                  />
                  <div className="dashboard-map-caption">
                    Decorative positions are deterministic but not physical sky coordinates.
                  </div>
                </div>

                <div className="dashboard-card">
                  <ClusterDetails row={selectedCluster} threshold={threshold} />
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export default DissertationDashboardPage;
