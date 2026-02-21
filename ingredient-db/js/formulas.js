/**
 * formulas.js - 処方管理モジュール
 */

const PRODUCT_TYPES = [
  '化粧水', '乳液', 'クリーム', '美容液', 'ジェル',
  'オイル', 'パック', 'クレンジング', '洗顔料', 'シャンプー',
  'コンディショナー', '日焼け止め', 'ファンデーション', 'その他',
];

const FORMULA_STATUSES = ['開発中', 'レビュー中', '承認済', '量産対応', '廃止'];

let allFormulas = [];
let currentFormulaId = null;
let formulaItems = []; // 処方明細（編集中）
let cachedIngredients = [];

/**
 * 処方一覧を描画する
 */
async function renderFormulaList() {
  allFormulas = await FormulaDB.getAll();
  cachedIngredients = await IngredientDB.getAll();

  const searchVal = document.getElementById('formula-search')?.value?.toLowerCase() || '';
  const statusVal = document.getElementById('formula-status-filter')?.value || '';

  const filtered = allFormulas.filter(f => {
    const matchSearch = !searchVal ||
      f.name.toLowerCase().includes(searchVal) ||
      (f.product_type || '').toLowerCase().includes(searchVal);
    const matchStatus = !statusVal || f.status === statusVal;
    return matchSearch && matchStatus;
  });

  renderFormulaCards(filtered);
  document.getElementById('formula-count').textContent =
    `${filtered.length} / ${allFormulas.length} 件`;
}

function renderFormulaCards(formulas) {
  const container = document.getElementById('formula-list');
  if (!container) return;

  if (formulas.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <div>処方が見つかりません</div>
        <div class="empty-sub">新規処方を作成してください</div>
      </div>`;
    return;
  }

  container.innerHTML = formulas.map(formula => `
    <div class="formula-card" data-id="${formula.id}">
      <div class="formula-card-header">
        <div>
          <div class="formula-card-title">${escapeHtml(formula.name)}</div>
          <div class="formula-card-meta">
            <span class="badge badge-blue">${escapeHtml(formula.product_type || '-')}</span>
            <span class="badge badge-${getStatusClass(formula.status)}">${escapeHtml(formula.status || '-')}</span>
            <span class="text-muted text-sm">v${escapeHtml(formula.version || '1.0')}</span>
          </div>
        </div>
        <div class="formula-card-actions">
          <button class="btn btn-sm btn-primary" onclick="openFormulaDetail(${formula.id})">開く</button>
          <button class="btn btn-sm btn-danger" onclick="deleteFormula(${formula.id})">削除</button>
        </div>
      </div>
      ${formula.description ? `<div class="formula-card-desc">${escapeHtml(formula.description)}</div>` : ''}
      <div class="formula-card-footer">
        <span class="text-muted text-sm">更新: ${formatDate(formula.updated_at)}</span>
      </div>
    </div>
  `).join('');
}

function getStatusClass(status) {
  const map = {
    '開発中': 'orange',
    'レビュー中': 'purple',
    '承認済': 'green',
    '量産対応': 'teal',
    '廃止': 'gray',
  };
  return map[status] || 'gray';
}

/**
 * 処方詳細を開く（配合リスト・規制チェック含む）
 */
async function openFormulaDetail(id) {
  currentFormulaId = id;
  const formula = await FormulaDB.getById(id);
  if (!formula) return;

  cachedIngredients = await IngredientDB.getAll();
  formulaItems = await FormulaItemDB.getByFormulaId(id);

  const panel = document.getElementById('formula-detail-panel');
  panel.classList.add('open');

  document.getElementById('detail-formula-name').textContent = formula.name;
  document.getElementById('detail-formula-type').textContent = formula.product_type || '-';
  document.getElementById('detail-formula-status').textContent = formula.status || '-';
  document.getElementById('detail-formula-version').textContent = 'v' + (formula.version || '1.0');
  document.getElementById('detail-formula-desc').textContent = formula.description || '';
  document.getElementById('detail-formula-notes').textContent = formula.notes || '';

  renderFormulaItemsTable();
  renderComplianceCheck();
  renderCostSummary(formula);

  // 配合原料セレクト更新
  updateIngredientSelect();
}

function closeFormulaDetail() {
  document.getElementById('formula-detail-panel').classList.remove('open');
  currentFormulaId = null;
  formulaItems = [];
}

function renderFormulaItemsTable() {
  const tbody = document.getElementById('formula-items-tbody');
  if (!tbody) return;

  if (formulaItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state-sm">原料が追加されていません</td>
      </tr>`;
    updateTotalPercentage(0);
    return;
  }

  let total = 0;
  tbody.innerHTML = formulaItems.map(item => {
    const ing = cachedIngredients.find(i => i.id === item.ingredient_id);
    const pct = Number(item.percentage) || 0;
    total += pct;
    const isOver = ing && ing.max_concentration != null && pct > ing.max_concentration;
    return `
      <tr class="${isOver ? 'row-warning' : ''}">
        <td>
          <div class="fw-medium">${escapeHtml(ing ? ing.name : '不明')}</div>
          <div class="text-muted text-sm">${escapeHtml(ing ? (ing.inci_name || '') : '')}</div>
        </td>
        <td><span class="badge badge-${getCategoryClass(ing ? ing.category : '')}">${escapeHtml(ing ? (ing.category || '-') : '-')}</span></td>
        <td class="text-right">
          <input
            type="number"
            class="pct-input"
            value="${pct}"
            min="0" max="100" step="0.01"
            onchange="updateItemPercentage(${item.id}, this.value)"
          />
        </td>
        <td class="text-right text-sm text-muted">
          ${ing && ing.max_concentration != null ? ing.max_concentration + (ing.unit || '%') : '-'}
          ${isOver ? '<span class="warning-icon" title="上限超過">⚠️</span>' : ''}
        </td>
        <td>
          <button class="btn btn-sm btn-danger" onclick="removeFormulaItem(${item.id})">削除</button>
        </td>
      </tr>`;
  }).join('');

  updateTotalPercentage(total);
}

function updateTotalPercentage(total) {
  const el = document.getElementById('total-percentage');
  if (!el) return;
  el.textContent = total.toFixed(2) + '%';
  el.className = 'total-pct ' +
    (Math.abs(total - 100) < 0.01 ? 'pct-ok' : total > 100 ? 'pct-over' : 'pct-under');
}

/**
 * 規制チェック
 */
function renderComplianceCheck() {
  const container = document.getElementById('compliance-results');
  if (!container) return;

  const issues = [];
  let totalPct = 0;

  for (const item of formulaItems) {
    const ing = cachedIngredients.find(i => i.id === item.ingredient_id);
    const pct = Number(item.percentage) || 0;
    totalPct += pct;

    if (ing && ing.max_concentration != null && pct > ing.max_concentration) {
      issues.push({
        type: 'error',
        message: `【${ing.name}】配合量 ${pct}% が上限 ${ing.max_concentration}${ing.unit || '%'} を超えています`,
      });
    }
  }

  if (Math.abs(totalPct - 100) > 0.1) {
    issues.push({
      type: totalPct > 100 ? 'error' : 'warning',
      message: `合計配合量が ${totalPct.toFixed(2)}% です（100%になるよう調整してください）`,
    });
  }

  if (issues.length === 0) {
    container.innerHTML = `<div class="compliance-ok">✅ 規制上の問題は検出されませんでした</div>`;
    return;
  }

  container.innerHTML = issues.map(issue => `
    <div class="compliance-issue ${issue.type}">
      ${issue.type === 'error' ? '🚫' : '⚠️'} ${escapeHtml(issue.message)}
    </div>
  `).join('');
}

/**
 * コスト計算
 */
function renderCostSummary(formula) {
  const container = document.getElementById('cost-summary');
  if (!container) return;

  let totalCost = 0;
  let hasAnyCost = false;
  const rows = [];

  for (const item of formulaItems) {
    const ing = cachedIngredients.find(i => i.id === item.ingredient_id);
    const pct = Number(item.percentage) || 0;

    if (ing && ing.unit_cost != null && ing.unit_cost > 0) {
      // 単価(円/kg) × 配合量(%) ÷ 100 = 円/kg製品あたりのコスト
      const cost = (ing.unit_cost * pct) / 100;
      totalCost += cost;
      hasAnyCost = true;
      rows.push({ name: ing.name, pct, cost });
    }
  }

  if (!hasAnyCost) {
    container.innerHTML = `<div class="text-muted text-sm">単価が登録されている原料がありません</div>`;
    return;
  }

  container.innerHTML = `
    <table class="cost-table">
      <thead>
        <tr>
          <th>原料名</th>
          <th class="text-right">配合量</th>
          <th class="text-right">コスト (円/kg)</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${escapeHtml(r.name)}</td>
            <td class="text-right">${r.pct.toFixed(2)}%</td>
            <td class="text-right">¥${r.cost.toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2" class="fw-medium">合計コスト (1kg製品あたり)</td>
          <td class="text-right fw-bold">¥${totalCost.toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>`;
}

/**
 * 処方明細の操作
 */
async function addFormulaItem() {
  if (!currentFormulaId) return;

  const select = document.getElementById('add-ingredient-select');
  const pctInput = document.getElementById('add-ingredient-pct');
  const ingredientId = parseInt(select.value);
  const percentage = parseFloat(pctInput.value);

  if (!ingredientId) {
    showAlert('原料を選択してください', 'error');
    return;
  }
  if (isNaN(percentage) || percentage <= 0) {
    showAlert('配合量（%）を正しく入力してください', 'error');
    return;
  }

  // 重複チェック
  const exists = formulaItems.some(i => i.ingredient_id === ingredientId);
  if (exists) {
    showAlert('この原料はすでに配合リストに追加されています', 'error');
    return;
  }

  await FormulaItemDB.add({
    formula_id: currentFormulaId,
    ingredient_id: ingredientId,
    percentage,
    notes: '',
  });

  // 更新日時を更新
  const formula = await FormulaDB.getById(currentFormulaId);
  await FormulaDB.update(formula);

  formulaItems = await FormulaItemDB.getByFormulaId(currentFormulaId);
  select.value = '';
  pctInput.value = '';
  renderFormulaItemsTable();
  renderComplianceCheck();
  renderCostSummary(formula);
}

async function updateItemPercentage(itemId, value) {
  const pct = parseFloat(value);
  if (isNaN(pct) || pct < 0) return;

  const item = formulaItems.find(i => i.id === itemId);
  if (!item) return;

  await FormulaItemDB.update({ ...item, percentage: pct });

  // 更新日時を更新
  const formula = await FormulaDB.getById(currentFormulaId);
  await FormulaDB.update(formula);

  formulaItems = await FormulaItemDB.getByFormulaId(currentFormulaId);
  renderFormulaItemsTable();
  renderComplianceCheck();
  renderCostSummary(formula);
}

async function removeFormulaItem(itemId) {
  await FormulaItemDB.remove(itemId);

  const formula = await FormulaDB.getById(currentFormulaId);
  await FormulaDB.update(formula);

  formulaItems = await FormulaItemDB.getByFormulaId(currentFormulaId);
  renderFormulaItemsTable();
  renderComplianceCheck();
  renderCostSummary(formula);
}

function updateIngredientSelect() {
  const select = document.getElementById('add-ingredient-select');
  if (!select) return;

  const usedIds = new Set(formulaItems.map(i => i.ingredient_id));
  const available = cachedIngredients.filter(i => i.is_active !== false && !usedIds.has(i.id));

  select.innerHTML =
    `<option value="">原料を選択...</option>` +
    available.map(i => `<option value="${i.id}">${escapeHtml(i.name)} (${escapeHtml(i.inci_name || '')})</option>`).join('');
}

/**
 * 新規処方モーダル
 */
function openNewFormulaModal() {
  const modal = document.getElementById('formula-modal');
  document.getElementById('formula-form').reset();
  document.getElementById('formula-modal-title').textContent = '新規処方を作成';

  const typeSelect = document.getElementById('fml-product-type');
  typeSelect.innerHTML = PRODUCT_TYPES.map(t => `<option value="${t}">${t}</option>`).join('');

  const statusSelect = document.getElementById('fml-status');
  statusSelect.innerHTML = FORMULA_STATUSES.map(s => `<option value="${s}">${s}</option>`).join('');

  document.getElementById('fml-version').value = '1.0';
  modal.classList.add('open');
}

function closeFormulaModal() {
  document.getElementById('formula-modal').classList.remove('open');
}

async function saveFormula() {
  const name = document.getElementById('fml-name').value.trim();
  if (!name) {
    showAlert('処方名を入力してください', 'error');
    return;
  }

  const data = {
    name,
    product_type: document.getElementById('fml-product-type').value,
    status: document.getElementById('fml-status').value,
    version: document.getElementById('fml-version').value.trim() || '1.0',
    description: document.getElementById('fml-description').value.trim(),
    notes: document.getElementById('fml-notes').value.trim(),
  };

  try {
    const newId = await FormulaDB.add(data);
    showAlert('処方を作成しました', 'success');
    closeFormulaModal();
    await renderFormulaList();
    await openFormulaDetail(newId);
  } catch (err) {
    showAlert('保存に失敗しました: ' + err.message, 'error');
  }
}

async function deleteFormula(id) {
  const formula = await FormulaDB.getById(id);
  if (!formula) return;

  if (!confirm(`「${formula.name}」を削除しますか？\n配合リストも含め、この処方のすべてのデータが削除されます。`)) return;

  try {
    await FormulaDB.remove(id);
    if (currentFormulaId === id) closeFormulaDetail();
    showAlert('処方を削除しました', 'success');
    await renderFormulaList();
  } catch (err) {
    showAlert('削除に失敗しました: ' + err.message, 'error');
  }
}

/**
 * 処方をCSVでエクスポート
 */
async function exportFormulaCSV() {
  if (!currentFormulaId) return;

  const formula = await FormulaDB.getById(currentFormulaId);
  const items = await FormulaItemDB.getByFormulaId(currentFormulaId);
  const allIng = await IngredientDB.getAll();
  const ingMap = {};
  allIng.forEach(i => { ingMap[i.id] = i; });

  const headers = ['原料名', 'INCI名', 'カテゴリ', '配合量(%)', '上限濃度', '規制情報'];
  const rows = items.map(item => {
    const ing = ingMap[item.ingredient_id] || {};
    return [
      ing.name || '',
      ing.inci_name || '',
      ing.category || '',
      item.percentage || '',
      ing.max_concentration != null ? ing.max_concentration + (ing.unit || '%') : '',
      ing.regulations || '',
    ];
  });

  const csv = [
    [`# 処方名: ${formula.name}`, '', '', '', '', ''],
    [`# 製品タイプ: ${formula.product_type}`, '', '', '', '', ''],
    [`# バージョン: v${formula.version}`, '', '', '', '', ''],
    [`# ステータス: ${formula.status}`, '', '', '', '', ''],
    [],
    headers,
    ...rows,
  ]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  downloadFile(`処方_${formula.name}_${formatDateForFile()}.csv`, csv, 'text/csv;charset=utf-8;');
}
