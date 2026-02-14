/**
 * chart.js - Chart.js による資産推移グラフ
 */

document.addEventListener('DOMContentLoaded', () => {
  initPerformanceChart();
});

function initPerformanceChart() {
  const canvas = document.getElementById('performanceChart');
  if (!canvas) return;

  // Wait for Chart.js to load
  if (typeof Chart === 'undefined') {
    window.addEventListener('load', () => {
      if (typeof Chart !== 'undefined') {
        createChart(canvas);
      }
    });
  } else {
    createChart(canvas);
  }
}

function createChart(canvas) {
  const ctx = canvas.getContext('2d');

  // Sample asset growth data (base 100 at start of 2021)
  const labels = [
    '2021 Q1', '2021 Q2', '2021 Q3', '2021 Q4',
    '2022 Q1', '2022 Q2', '2022 Q3', '2022 Q4',
    '2023 Q1', '2023 Q2', '2023 Q3', '2023 Q4',
    '2024 Q1', '2024 Q2', '2024 Q3', '2024 Q4',
    '2025 Q1', '2025 Q2', '2025 Q3', '2025 Q4'
  ];

  const data = [
    100, 102.1, 103.8, 108.7,    // 2021: +8.7%
    110.2, 113.5, 117.8, 120.9,  // 2022: +11.2%
    122.1, 125.3, 128.0, 132.4,  // 2023: +9.5%
    134.8, 139.2, 143.1, 146.7,  // 2024: +10.8%
    150.2, 155.8, 160.3, 164.7   // 2025: +12.3%
  ];

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: '資産推移（基準値: 100）',
        data: data,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.08)',
        borderWidth: 2.5,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#2563eb',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2.5,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            font: {
              family: "'Inter', 'Noto Sans JP', sans-serif",
              size: 13
            },
            color: '#64748b',
            padding: 20
          }
        },
        tooltip: {
          backgroundColor: '#1e293b',
          titleFont: {
            family: "'Inter', 'Noto Sans JP', sans-serif",
            size: 13
          },
          bodyFont: {
            family: "'Inter', 'Noto Sans JP', sans-serif",
            size: 13
          },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              const value = context.parsed.y;
              const gain = (value - 100).toFixed(1);
              return `資産: ${value.toFixed(1)} (${gain >= 0 ? '+' : ''}${gain}%)`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            font: {
              family: "'Inter', sans-serif",
              size: 11
            },
            color: '#94a3b8',
            maxRotation: 45
          }
        },
        y: {
          beginAtZero: false,
          min: 95,
          grid: {
            color: 'rgba(0, 0, 0, 0.04)'
          },
          ticks: {
            font: {
              family: "'Inter', sans-serif",
              size: 11
            },
            color: '#94a3b8',
            callback: function(value) {
              return value;
            }
          }
        }
      }
    }
  });
}
