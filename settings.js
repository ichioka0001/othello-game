/* =============================================
   オセロゲーム 設定管理（settings.js）
   =============================================

   このファイルではゲームの設定を管理します。
   設定内容は localStorage に保存され、
   ブラウザを閉じて開き直しても維持されます。

   【管理する設定項目】
   - cpuThinkTime  : CPU思考時間（ms）
   - showHints     : 置ける場所のヒント表示（true/false）
   - animationOn   : アニメーションのON/OFF（true/false）
   - soundOn       : 効果音のON/OFF（true/false）

   ============================================= */

// localStorage に保存するときのキー名
const SETTINGS_KEY = 'othello_settings';

// デフォルト設定（初回起動時・リセット時に使う）
const DEFAULT_SETTINGS = {
  cpuThinkTime: 500,   // CPU思考時間：普通（500ms）
  showHints:    true,  // ヒント表示：ON
  animationOn:  true,  // アニメーション：ON
  soundOn:      true,  // 効果音：ON
};

// 現在の設定を保持するオブジェクト
// このオブジェクトを script.js から参照して使う
let currentSettings = { ...DEFAULT_SETTINGS };

/**
 * localStorage から設定を読み込む関数
 *
 * ページ読み込み時に呼ばれる。
 * 保存データがない場合はデフォルト設定を使う。
 */
function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    // 保存データがない場合はデフォルト設定を使う
    currentSettings = { ...DEFAULT_SETTINGS };
    return;
  }
  try {
    const saved = JSON.parse(raw);
    // 保存データとデフォルト設定をマージする
    // （将来新しい設定項目が増えたときにデフォルト値が補完される）
    currentSettings = { ...DEFAULT_SETTINGS, ...saved };
  } catch (e) {
    console.warn('設定データの読み込みに失敗しました。デフォルト設定を使います。');
    currentSettings = { ...DEFAULT_SETTINGS };
  }
}

/**
 * 現在の設定を localStorage に保存する関数
 */
function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(currentSettings));
}

/**
 * 設定モーダルを開く関数
 *
 * モーダルを開くときに、現在の設定値をUIに反映する。
 */
function showSettingsModal() {
  // 現在の設定値をUIに反映する
  applySettingsToUI();
  // モーダルを表示する
  document.getElementById('settings-modal').classList.remove('hidden');
}

/**
 * 設定モーダルを閉じる関数
 */
function hideSettingsModal() {
  document.getElementById('settings-modal').classList.add('hidden');
}

/**
 * 現在の設定値をモーダルのUIに反映する関数
 *
 * モーダルを開くたびに呼ばれ、ボタンのアクティブ状態を更新する。
 */
function applySettingsToUI() {
  // CPU思考時間のボタンを更新する
  document.querySelectorAll('.setting-btn[data-setting="cpuThinkTime"]').forEach(btn => {
    const val = parseInt(btn.dataset.value, 10);
    if (val === currentSettings.cpuThinkTime) {
      btn.classList.add('setting-btn--active');
    } else {
      btn.classList.remove('setting-btn--active');
    }
  });

  // ヒント表示のボタンを更新する
  document.querySelectorAll('.setting-btn[data-setting="showHints"]').forEach(btn => {
    const val = btn.dataset.value === 'true';
    if (val === currentSettings.showHints) {
      btn.classList.add('setting-btn--active');
    } else {
      btn.classList.remove('setting-btn--active');
    }
  });

  // アニメーションのボタンを更新する
  document.querySelectorAll('.setting-btn[data-setting="animationOn"]').forEach(btn => {
    const val = btn.dataset.value === 'true';
    if (val === currentSettings.animationOn) {
      btn.classList.add('setting-btn--active');
    } else {
      btn.classList.remove('setting-btn--active');
    }
  });

  // 効果音のボタンを更新する
  document.querySelectorAll('.setting-btn[data-setting="soundOn"]').forEach(btn => {
    const val = btn.dataset.value === 'true';
    if (val === currentSettings.soundOn) {
      btn.classList.add('setting-btn--active');
    } else {
      btn.classList.remove('setting-btn--active');
    }
  });
}

/**
 * 設定ボタンがクリックされたときの処理
 *
 * data-setting と data-value 属性を使って設定を更新する。
 *
 * @param {string} settingKey - 設定項目名（例: 'cpuThinkTime'）
 * @param {string} rawValue   - 設定値（文字列。数値や真偽値に変換する）
 */
function onSettingButtonClick(settingKey, rawValue) {
  // 値の型を適切に変換する
  let value;
  if (rawValue === 'true') {
    value = true;
  } else if (rawValue === 'false') {
    value = false;
  } else {
    value = parseInt(rawValue, 10); // 数値に変換する
  }

  // 設定を更新する
  currentSettings[settingKey] = value;

  // localStorage に保存する
  saveSettings();

  // UIのアクティブ状態を更新する
  applySettingsToUI();
}

/**
 * 設定ボタンのイベントリスナーを設定する関数
 *
 * ページ読み込み時に1回だけ呼ばれる。
 */
function initSettingsButtons() {
  // すべての設定ボタンにクリックイベントを設定する
  document.querySelectorAll('.setting-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      onSettingButtonClick(btn.dataset.setting, btn.dataset.value);
    });
  });

  // 設定モーダルの「閉じる」ボタン
  document.getElementById('settings-close-btn').addEventListener('click', () => {
    hideSettingsModal();
  });

  // 設定モーダルの背景クリックで閉じる
  document.getElementById('settings-overlay').addEventListener('click', () => {
    hideSettingsModal();
  });

  // 設定モーダルの下部「閉じる」ボタン
  const closeBottom = document.getElementById('settings-close-bottom-btn');
  if (closeBottom) {
    closeBottom.addEventListener('click', () => {
      hideSettingsModal();
    });
  }

  // モード選択画面の「設定」ボタン
  document.getElementById('settings-btn-mode').addEventListener('click', () => {
    showSettingsModal();
  });

  // ゲーム画面の「設定」ボタン
  document.getElementById('settings-btn-game').addEventListener('click', () => {
    showSettingsModal();
  });
}

// =============================================
// ページ読み込み時の初期化
// =============================================

// 設定を読み込む
loadSettings();

// DOMが読み込まれたらボタンのイベントを設定する
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSettingsButtons);
} else {
  initSettingsButtons();
}
