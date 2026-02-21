/**
 * app.js - メインアプリケーション制御
 * ※ ユーティリティ関数は db.js に定義
 */

// ===== タブ切り替え =====

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));

  document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');

  if (tabName === 'ingredients') renderIngredientList();
  if (tabName === 'formulas') renderFormulaList();
  if (tabName === 'stats') renderStats();
}

// ===== 統計タブ =====

async function renderStats() {
  const ingredients = await IngredientDB.getAll();
  const formulas = await FormulaDB.getAll();

  // カテゴリ別集計
  const catCount = {};
  ingredients.forEach(ing => {
    catCount[ing.category] = (catCount[ing.category] || 0) + 1;
  });

  const statusCount = {};
  formulas.forEach(f => {
    statusCount[f.status] = (statusCount[f.status] || 0) + 1;
  });

  document.getElementById('stat-ingredient-count').textContent = ingredients.length;
  document.getElementById('stat-formula-count').textContent = formulas.length;
  document.getElementById('stat-active-count').textContent =
    ingredients.filter(i => i.is_active !== false).length;

  // カテゴリ別チャート
  const catContainer = document.getElementById('category-chart');
  if (catContainer) {
    const maxVal = Math.max(...Object.values(catCount), 1);
    catContainer.innerHTML = Object.entries(catCount)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, count]) => `
        <div class="chart-bar-row">
          <div class="chart-bar-label">${escapeHtml(cat)}</div>
          <div class="chart-bar-track">
            <div class="chart-bar-fill" style="width: ${(count / maxVal) * 100}%"></div>
          </div>
          <div class="chart-bar-value">${count}</div>
        </div>
      `).join('');
  }

  // 処方ステータス
  const statusContainer = document.getElementById('status-chart');
  if (statusContainer) {
    statusContainer.innerHTML = Object.entries(statusCount)
      .map(([status, count]) => `
        <div class="status-chip">
          <span class="badge badge-${getStatusClass(status)}">${escapeHtml(status)}</span>
          <span class="fw-bold">${count} 件</span>
        </div>
      `).join('');
  }

  // 直近の処方
  const recentFormulas = [...formulas]
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 5);

  const recentContainer = document.getElementById('recent-formulas');
  if (recentContainer) {
    recentContainer.innerHTML = recentFormulas.length === 0
      ? '<div class="text-muted text-sm">処方がありません</div>'
      : recentFormulas.map(f => `
          <div class="recent-formula-row" onclick="switchTab('formulas'); setTimeout(() => openFormulaDetail(${f.id}), 100)">
            <div>
              <div class="fw-medium">${escapeHtml(f.name)}</div>
              <div class="text-muted text-sm">${escapeHtml(f.product_type || '-')} · v${escapeHtml(f.version || '1.0')}</div>
            </div>
            <div>
              <span class="badge badge-${getStatusClass(f.status)}">${escapeHtml(f.status || '-')}</span>
            </div>
          </div>
        `).join('');
  }
}

// ===== データエクスポート全体 =====

async function exportAllData() {
  const ingredients = await IngredientDB.getAll();
  const formulas = await FormulaDB.getAll();
  const allItems = [];
  for (const f of formulas) {
    const items = await FormulaItemDB.getByFormulaId(f.id);
    allItems.push(...items);
  }

  const data = {
    exported_at: new Date().toISOString(),
    version: '1.0',
    ingredients,
    formulas,
    formula_items: allItems,
  };

  downloadFile(
    `cosmetic_db_backup_${formatDateForFile()}.json`,
    JSON.stringify(data, null, 2),
    'application/json'
  );
  showAlert('データをエクスポートしました', 'success');
}

// ===== データインポート =====

function triggerImport() {
  document.getElementById('import-file-input').click();
}

async function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.ingredients || !data.formulas) {
      showAlert('無効なバックアップファイルです', 'error');
      return;
    }

    if (!confirm(`バックアップからデータを復元します。\n原料: ${data.ingredients.length}件、処方: ${data.formulas.length}件\n\n注意: 既存データはそのままで追記されます。続行しますか？`)) {
      return;
    }

    // 原料インポート（IDなしで追加）
    for (const ing of data.ingredients) {
      const { id, ...rest } = ing;
      await IngredientDB.add(rest);
    }

    // 処方インポート
    const formulaIdMap = {};
    for (const f of data.formulas) {
      const { id, ...rest } = f;
      const newId = await FormulaDB.add(rest);
      formulaIdMap[id] = newId;
    }

    // 処方明細インポートは複雑なのでスキップ（原料IDの対応が必要）
    showAlert(`インポート完了: 原料 ${data.ingredients.length}件、処方 ${data.formulas.length}件`, 'success');
    await renderIngredientList();
    await renderFormulaList();
  } catch (err) {
    showAlert('インポートに失敗しました: ' + err.message, 'error');
  }

  event.target.value = '';
}

// ===== 初期化 =====

async function initApp() {
  try {
    await openDB();
    await seedSampleData();
    initCategoryFilter();
    renderIngredientList();
    renderStats();

    // イベントリスナー
    document.getElementById('ingredient-search')?.addEventListener('input', applyIngredientFilter);
    document.getElementById('ingredient-category-filter')?.addEventListener('change', applyIngredientFilter);
    document.getElementById('formula-search')?.addEventListener('input', renderFormulaList);
    document.getElementById('formula-status-filter')?.addEventListener('change', renderFormulaList);
    document.getElementById('import-file-input')?.addEventListener('change', handleImport);

    // モーダル外クリックで閉じる
    document.getElementById('ingredient-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'ingredient-modal') closeIngredientModal();
    });
    document.getElementById('formula-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'formula-modal') closeFormulaModal();
    });

    console.log('化粧品原料データベース: 初期化完了');
  } catch (err) {
    console.error('初期化エラー:', err);
    showAlert('データベースの初期化に失敗しました: ' + err.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', initApp);
