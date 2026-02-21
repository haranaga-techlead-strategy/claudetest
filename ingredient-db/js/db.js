/**
 * db.js - IndexedDB データベース層
 * 化粧品原料データベース管理システム
 */

const DB_NAME = 'CosmeticIngredientDB';
const DB_VERSION = 1;

const STORES = {
  INGREDIENTS: 'ingredients',
  FORMULAS: 'formulas',
  FORMULA_ITEMS: 'formula_items',
};

let db = null;

/**
 * データベースを開く・初期化する
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 原料マスターストア
      if (!db.objectStoreNames.contains(STORES.INGREDIENTS)) {
        const ingredientStore = db.createObjectStore(STORES.INGREDIENTS, {
          keyPath: 'id',
          autoIncrement: true,
        });
        ingredientStore.createIndex('name', 'name', { unique: false });
        ingredientStore.createIndex('inci_name', 'inci_name', { unique: false });
        ingredientStore.createIndex('cas_number', 'cas_number', { unique: false });
        ingredientStore.createIndex('category', 'category', { unique: false });
      }

      // 処方ストア
      if (!db.objectStoreNames.contains(STORES.FORMULAS)) {
        const formulaStore = db.createObjectStore(STORES.FORMULAS, {
          keyPath: 'id',
          autoIncrement: true,
        });
        formulaStore.createIndex('name', 'name', { unique: false });
        formulaStore.createIndex('product_type', 'product_type', { unique: false });
        formulaStore.createIndex('status', 'status', { unique: false });
      }

      // 処方明細ストア
      if (!db.objectStoreNames.contains(STORES.FORMULA_ITEMS)) {
        const itemStore = db.createObjectStore(STORES.FORMULA_ITEMS, {
          keyPath: 'id',
          autoIncrement: true,
        });
        itemStore.createIndex('formula_id', 'formula_id', { unique: false });
        itemStore.createIndex('ingredient_id', 'ingredient_id', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * 汎用CRUD関数
 */
function getAll(storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getById(storeName, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function add(storeName, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const now = new Date().toISOString();
    const record = { ...data, created_at: now, updated_at: now };
    const request = store.add(record);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function update(storeName, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const record = { ...data, updated_at: new Date().toISOString() };
    const request = store.put(record);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function remove(storeName, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function getByIndex(storeName, indexName, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 原料 API
 */
const IngredientDB = {
  getAll: () => getAll(STORES.INGREDIENTS),
  getById: (id) => getById(STORES.INGREDIENTS, id),
  add: (data) => add(STORES.INGREDIENTS, data),
  update: (data) => update(STORES.INGREDIENTS, data),
  remove: (id) => remove(STORES.INGREDIENTS, id),
  getByCategory: (category) => getByIndex(STORES.INGREDIENTS, 'category', category),
};

/**
 * 処方 API
 */
const FormulaDB = {
  getAll: () => getAll(STORES.FORMULAS),
  getById: (id) => getById(STORES.FORMULAS, id),
  add: (data) => add(STORES.FORMULAS, data),
  update: (data) => update(STORES.FORMULAS, data),
  remove: async (id) => {
    // 処方明細も削除
    const items = await getByIndex(STORES.FORMULA_ITEMS, 'formula_id', id);
    for (const item of items) {
      await remove(STORES.FORMULA_ITEMS, item.id);
    }
    return remove(STORES.FORMULAS, id);
  },
};

/**
 * 処方明細 API
 */
const FormulaItemDB = {
  getByFormulaId: (formulaId) => getByIndex(STORES.FORMULA_ITEMS, 'formula_id', formulaId),
  add: (data) => add(STORES.FORMULA_ITEMS, data),
  update: (data) => update(STORES.FORMULA_ITEMS, data),
  remove: (id) => remove(STORES.FORMULA_ITEMS, id),
  removeAllByFormulaId: async (formulaId) => {
    const items = await getByIndex(STORES.FORMULA_ITEMS, 'formula_id', formulaId);
    for (const item of items) {
      await remove(STORES.FORMULA_ITEMS, item.id);
    }
  },
};

/**
 * サンプルデータ投入
 */
async function seedSampleData() {
  const existing = await IngredientDB.getAll();
  if (existing.length > 0) return; // すでにデータがある場合はスキップ

  const sampleIngredients = [
    {
      name: '精製水',
      inci_name: 'WATER',
      cas_number: '7732-18-5',
      category: '溶剤',
      max_concentration: 100,
      unit: '%',
      supplier: '',
      unit_cost: 0.01,
      cost_unit: 'kg',
      regulations: '制限なし',
      notes: '化粧品基材として使用。不純物管理が重要。',
      is_active: true,
    },
    {
      name: 'グリセリン',
      inci_name: 'GLYCERIN',
      cas_number: '56-81-5',
      category: '保湿剤',
      max_concentration: 30,
      unit: '%',
      supplier: '',
      unit_cost: 150,
      cost_unit: 'kg',
      regulations: '濃度30%以下を推奨（高濃度では逆に乾燥を引き起こす可能性あり）',
      notes: '植物由来と合成品あり。吸湿性が高い。',
      is_active: true,
    },
    {
      name: 'BG（1,3-ブチレングリコール）',
      inci_name: 'BUTYLENE GLYCOL',
      cas_number: '107-88-0',
      category: '保湿剤',
      max_concentration: 15,
      unit: '%',
      supplier: '',
      unit_cost: 300,
      cost_unit: 'kg',
      regulations: '15%以下推奨',
      notes: '保湿・防腐補助・溶剤として多目的に使用可能。',
      is_active: true,
    },
    {
      name: 'フェノキシエタノール',
      inci_name: 'PHENOXYETHANOL',
      cas_number: '122-99-6',
      category: '防腐剤',
      max_concentration: 1,
      unit: '%',
      supplier: '',
      unit_cost: 800,
      cost_unit: 'kg',
      regulations: '最大配合量1.0%（日本・EU共通）',
      notes: 'EU Annex V, No.29。広域スペクトルの防腐効果。',
      is_active: true,
    },
    {
      name: 'カルボマー',
      inci_name: 'CARBOMER',
      cas_number: '9003-01-4',
      category: '増粘剤',
      max_concentration: 2,
      unit: '%',
      supplier: '',
      unit_cost: 600,
      cost_unit: 'kg',
      regulations: '制限なし（一般的使用量0.1〜2%）',
      notes: '中和剤（TEA、NaOH等）が必要。透明ゲルが作製可能。',
      is_active: true,
    },
    {
      name: 'トリエタノールアミン',
      inci_name: 'TRIETHANOLAMINE',
      cas_number: '102-71-6',
      category: 'pH調整剤',
      max_concentration: 2.5,
      unit: '%',
      supplier: '',
      unit_cost: 200,
      cost_unit: 'kg',
      regulations: '最大配合量2.5%（EU規制）。N-ニトロソアミン形成リスクあり。',
      notes: 'カルボマーの中和剤として使用。最終pH 5.5〜7.0を目標に。',
      is_active: true,
    },
    {
      name: 'ヒアルロン酸Na',
      inci_name: 'SODIUM HYALURONATE',
      cas_number: '9067-32-7',
      category: '保湿剤',
      max_concentration: 2,
      unit: '%',
      supplier: '',
      unit_cost: 15000,
      cost_unit: 'kg',
      regulations: '制限なし',
      notes: '分子量により浸透深度が異なる。高分子（皮膜形成）・低分子（浸透型）を使い分ける。',
      is_active: true,
    },
    {
      name: 'ナイアシンアミド',
      inci_name: 'NIACINAMIDE',
      cas_number: '98-92-0',
      category: '有効成分',
      max_concentration: 10,
      unit: '%',
      supplier: '',
      unit_cost: 2000,
      cost_unit: 'kg',
      regulations: '一般に5〜10%が有効。高濃度では刺激の可能性。',
      notes: '美白・毛穴・油分コントロール効果。pH安定性に注意（酸性条件で分解）。',
      is_active: true,
    },
    {
      name: 'ポリソルベート80',
      inci_name: 'POLYSORBATE 80',
      cas_number: '9005-65-6',
      category: '乳化剤',
      max_concentration: 10,
      unit: '%',
      supplier: '',
      unit_cost: 400,
      cost_unit: 'kg',
      regulations: '制限なし',
      notes: 'HLB値15。O/Wエマルション向け。油溶性成分の可溶化にも使用。',
      is_active: true,
    },
    {
      name: 'エタノール',
      inci_name: 'ALCOHOL',
      cas_number: '64-17-5',
      category: '溶剤',
      max_concentration: 70,
      unit: '%',
      supplier: '',
      unit_cost: 250,
      cost_unit: 'kg',
      regulations: '化粧品配合エタノールは食品添加物規格品を使用',
      notes: '揮発性溶剤・防腐補助・清涼感付与。配合量により防腐効果が変動。',
      is_active: true,
    },
  ];

  for (const ingredient of sampleIngredients) {
    await IngredientDB.add(ingredient);
  }

  // サンプル処方データ
  const formulaId = await FormulaDB.add({
    name: '基本化粧水 v1.0',
    product_type: '化粧水',
    description: '保湿を重視したシンプルな基本化粧水。敏感肌向け。',
    status: '開発中',
    version: '1.0',
    notes: 'pH 5.5〜6.0目標',
  });

  const allIngredients = await IngredientDB.getAll();
  const byName = {};
  allIngredients.forEach(i => { byName[i.inci_name] = i; });

  const formulaItems = [
    { inci: 'WATER', pct: 82.35 },
    { inci: 'GLYCERIN', pct: 5.0 },
    { inci: 'BUTYLENE GLYCOL', pct: 3.0 },
    { inci: 'SODIUM HYALURONATE', pct: 0.1 },
    { inci: 'NIACINAMIDE', pct: 5.0 },
    { inci: 'CARBOMER', pct: 0.2 },
    { inci: 'TRIETHANOLAMINE', pct: 0.35 },
    { inci: 'PHENOXYETHANOL', pct: 1.0 },
  ];

  for (const item of formulaItems) {
    const ingredient = byName[item.inci];
    if (ingredient) {
      await FormulaItemDB.add({
        formula_id: formulaId,
        ingredient_id: ingredient.id,
        percentage: item.pct,
        notes: '',
      });
    }
  }
}

// ===== ユーティリティ関数（依存ファイルより前に読み込まれるため、ここに定義） =====

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseFloatOrNull(val) {
  const f = parseFloat(val);
  return isNaN(f) ? null : f;
}

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatDateForFile() {
  const d = new Date();
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob(['\ufeff' + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function showAlert(message, type = 'info') {
  const container = document.getElementById('alert-container');
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.textContent = message;
  container.appendChild(alert);
  setTimeout(() => {
    alert.classList.add('alert-fade-out');
    setTimeout(() => alert.remove(), 300);
  }, 3000);
}
