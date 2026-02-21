/**
 * ingredients.js - 原料マスター管理モジュール
 */

const CATEGORIES = [
  '溶剤', '保湿剤', '乳化剤', '増粘剤', '防腐剤',
  'pH調整剤', '有効成分', '香料', '色素', '酸化防止剤',
  '界面活性剤', '油性成分', '粉体', 'その他',
];

let allIngredients = [];
let filteredIngredients = [];
let currentIngredientId = null;

/**
 * 原料一覧を描画する
 */
async function renderIngredientList() {
  allIngredients = await IngredientDB.getAll();
  applyIngredientFilter();
}

function applyIngredientFilter() {
  const searchVal = document.getElementById('ingredient-search')?.value?.toLowerCase() || '';
  const categoryVal = document.getElementById('ingredient-category-filter')?.value || '';

  filteredIngredients = allIngredients.filter(ing => {
    const matchSearch =
      !searchVal ||
      ing.name.toLowerCase().includes(searchVal) ||
      (ing.inci_name || '').toLowerCase().includes(searchVal) ||
      (ing.cas_number || '').toLowerCase().includes(searchVal);

    const matchCategory = !categoryVal || ing.category === categoryVal;

    return matchSearch && matchCategory;
  });

  renderIngredientTable(filteredIngredients);
  document.getElementById('ingredient-count').textContent =
    `${filteredIngredients.length} / ${allIngredients.length} 件`;
}

function renderIngredientTable(ingredients) {
  const tbody = document.getElementById('ingredient-tbody');
  if (!tbody) return;

  if (ingredients.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <div class="empty-icon">🔬</div>
          <div>原料が見つかりません</div>
          <div class="empty-sub">検索条件を変更するか、新規登録してください</div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = ingredients.map(ing => `
    <tr class="${ing.is_active === false ? 'inactive-row' : ''}" data-id="${ing.id}">
      <td><span class="badge badge-${getCategoryClass(ing.category)}">${escapeHtml(ing.category || '-')}</span></td>
      <td class="fw-medium">${escapeHtml(ing.name)}</td>
      <td class="text-mono text-sm">${escapeHtml(ing.inci_name || '-')}</td>
      <td class="text-mono text-sm">${escapeHtml(ing.cas_number || '-')}</td>
      <td class="text-right">
        ${ing.max_concentration != null
          ? `<span class="concentration-value">${ing.max_concentration}${ing.unit || '%'}</span>`
          : '<span class="text-muted">-</span>'}
      </td>
      <td class="text-right">
        ${ing.unit_cost != null && ing.unit_cost > 0
          ? `¥${Number(ing.unit_cost).toLocaleString()} / ${ing.cost_unit || 'kg'}`
          : '<span class="text-muted">-</span>'}
      </td>
      <td>
        <div class="action-btns">
          <button class="btn btn-sm btn-secondary" onclick="openIngredientModal(${ing.id})">編集</button>
          <button class="btn btn-sm btn-danger" onclick="deleteIngredient(${ing.id})">削除</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function getCategoryClass(category) {
  const classMap = {
    '溶剤': 'gray',
    '保湿剤': 'blue',
    '乳化剤': 'purple',
    '増粘剤': 'orange',
    '防腐剤': 'red',
    'pH調整剤': 'teal',
    '有効成分': 'green',
    '香料': 'pink',
    '色素': 'yellow',
    '酸化防止剤': 'amber',
    '界面活性剤': 'indigo',
    '油性成分': 'brown',
    '粉体': 'slate',
    'その他': 'gray',
  };
  return classMap[category] || 'gray';
}

/**
 * 原料登録・編集モーダルを開く
 */
async function openIngredientModal(id = null) {
  currentIngredientId = id;
  const modal = document.getElementById('ingredient-modal');
  const title = document.getElementById('ingredient-modal-title');
  const form = document.getElementById('ingredient-form');

  form.reset();
  document.getElementById('ing-is-active').checked = true;

  // カテゴリセレクトを生成
  const catSelect = document.getElementById('ing-category');
  catSelect.innerHTML = CATEGORIES.map(c =>
    `<option value="${c}">${c}</option>`
  ).join('');

  if (id) {
    title.textContent = '原料を編集';
    const ing = await IngredientDB.getById(id);
    if (ing) {
      document.getElementById('ing-name').value = ing.name || '';
      document.getElementById('ing-inci-name').value = ing.inci_name || '';
      document.getElementById('ing-cas-number').value = ing.cas_number || '';
      document.getElementById('ing-category').value = ing.category || '';
      document.getElementById('ing-max-concentration').value = ing.max_concentration ?? '';
      document.getElementById('ing-unit').value = ing.unit || '%';
      document.getElementById('ing-supplier').value = ing.supplier || '';
      document.getElementById('ing-unit-cost').value = ing.unit_cost ?? '';
      document.getElementById('ing-cost-unit').value = ing.cost_unit || 'kg';
      document.getElementById('ing-regulations').value = ing.regulations || '';
      document.getElementById('ing-notes').value = ing.notes || '';
      document.getElementById('ing-is-active').checked = ing.is_active !== false;
    }
  } else {
    title.textContent = '原料を新規登録';
  }

  modal.classList.add('open');
}

function closeIngredientModal() {
  document.getElementById('ingredient-modal').classList.remove('open');
  currentIngredientId = null;
}

/**
 * 原料フォームを保存する
 */
async function saveIngredient() {
  const name = document.getElementById('ing-name').value.trim();
  if (!name) {
    showAlert('原料名を入力してください', 'error');
    return;
  }

  const data = {
    name,
    inci_name: document.getElementById('ing-inci-name').value.trim(),
    cas_number: document.getElementById('ing-cas-number').value.trim(),
    category: document.getElementById('ing-category').value,
    max_concentration: parseFloatOrNull(document.getElementById('ing-max-concentration').value),
    unit: document.getElementById('ing-unit').value || '%',
    supplier: document.getElementById('ing-supplier').value.trim(),
    unit_cost: parseFloatOrNull(document.getElementById('ing-unit-cost').value),
    cost_unit: document.getElementById('ing-cost-unit').value || 'kg',
    regulations: document.getElementById('ing-regulations').value.trim(),
    notes: document.getElementById('ing-notes').value.trim(),
    is_active: document.getElementById('ing-is-active').checked,
  };

  try {
    if (currentIngredientId) {
      await IngredientDB.update({ ...data, id: currentIngredientId });
      showAlert('原料を更新しました', 'success');
    } else {
      await IngredientDB.add(data);
      showAlert('原料を登録しました', 'success');
    }
    closeIngredientModal();
    await renderIngredientList();
  } catch (err) {
    showAlert('保存に失敗しました: ' + err.message, 'error');
  }
}

/**
 * 原料を削除する
 */
async function deleteIngredient(id) {
  const ing = await IngredientDB.getById(id);
  if (!ing) return;

  if (!confirm(`「${ing.name}」を削除しますか？\n処方で使用中の場合、処方明細からも削除されます。`)) return;

  try {
    await IngredientDB.remove(id);
    showAlert('原料を削除しました', 'success');
    await renderIngredientList();
  } catch (err) {
    showAlert('削除に失敗しました: ' + err.message, 'error');
  }
}

/**
 * 原料データをCSVでエクスポート
 */
async function exportIngredientCSV() {
  const ingredients = await IngredientDB.getAll();
  const headers = [
    '原料名', 'INCI名', 'CAS番号', 'カテゴリ',
    '最大配合濃度', '単位', '仕入先', '単価', '単価単位',
    '規制情報', '備考', '有効', '登録日',
  ];
  const rows = ingredients.map(ing => [
    ing.name,
    ing.inci_name || '',
    ing.cas_number || '',
    ing.category || '',
    ing.max_concentration ?? '',
    ing.unit || '%',
    ing.supplier || '',
    ing.unit_cost ?? '',
    ing.cost_unit || 'kg',
    ing.regulations || '',
    ing.notes || '',
    ing.is_active !== false ? '有効' : '無効',
    ing.created_at ? ing.created_at.slice(0, 10) : '',
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  downloadFile('原料マスター_' + formatDateForFile() + '.csv', csv, 'text/csv;charset=utf-8;');
}

/**
 * カテゴリフィルターのオプションを生成
 */
function initCategoryFilter() {
  const select = document.getElementById('ingredient-category-filter');
  if (!select) return;
  select.innerHTML =
    `<option value="">すべてのカテゴリ</option>` +
    CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
}
