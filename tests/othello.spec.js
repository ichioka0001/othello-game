// =============================================
// オセロゲーム 自動テスト（Playwright）
// =============================================
//
// このファイルでオセロゲームの主要機能を自動テストします。
//
// 【テスト実行方法】
//   npm install          # 依存パッケージをインストール
//   npx playwright install  # ブラウザをインストール
//   npm test             # テストを実行
//
// 【テスト結果の確認】
//   npx playwright show-report  # HTMLレポートをブラウザで開く
//
// =============================================

const { test, expect } = require('@playwright/test');

// =============================================
// テスト用のヘルパー関数
// =============================================

/**
 * ゲームを開始するヘルパー関数
 * モード選択画面でモードを選んで「ゲーム開始」を押す
 *
 * @param {import('@playwright/test').Page} page - Playwrightのページオブジェクト
 * @param {'local'|'cpu'} mode - 対戦モード
 * @param {'easy'|'medium'|'hard'|null} cpuLevel - CPUレベル（CPU対戦時のみ）
 */
async function startGame(page, mode = 'local', cpuLevel = null) {
  // ページを開く
  await page.goto('/');

  if (mode === 'cpu') {
    // CPU対戦ボタンをクリック
    await page.click('#btn-cpu');

    // CPUレベルを選択する
    if (cpuLevel === 'medium') {
      await page.click('#btn-medium');
    } else if (cpuLevel === 'hard') {
      await page.click('#btn-hard');
    }
    // 'easy' はデフォルトなのでクリック不要
  }

  // ゲーム開始ボタンをクリック
  await page.click('#btn-start');

  // ゲーム画面が表示されるまで待機する
  await expect(page.locator('#game-screen')).not.toHaveClass(/hidden/);
}

/**
 * 盤面上の指定した行・列のマスを取得するヘルパー関数
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} row - 行番号（0〜7）
 * @param {number} col - 列番号（0〜7）
 */
function getCell(page, row, col) {
  return page.locator(`#board .cell[data-row="${row}"][data-col="${col}"]`);
}

/**
 * 置けるマス（.valid クラスを持つマス）を取得するヘルパー関数
 *
 * @param {import('@playwright/test').Page} page
 */
function getValidCells(page) {
  return page.locator('#board .cell.valid');
}


// =============================================
// テストグループ 1: モード選択画面
// =============================================

test.describe('モード選択画面', () => {

  test('ページを開くとモード選択画面が表示される', async ({ page }) => {
    // ページを開く
    await page.goto('/');

    // モード選択画面が表示されていることを確認する
    await expect(page.locator('#mode-select')).toBeVisible();

    // ゲーム画面は非表示であることを確認する
    await expect(page.locator('#game-screen')).toHaveClass(/hidden/);
  });

  test('タイトル「オセロ」が表示される', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('オセロ');
  });

  test('2人対戦ボタンとCPU対戦ボタンが表示される', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#btn-local')).toBeVisible();
    await expect(page.locator('#btn-cpu')).toBeVisible();
  });

  test('CPU対戦を選ぶとレベル選択UIが表示される', async ({ page }) => {
    await page.goto('/');

    // 初期状態ではレベル選択UIが非表示
    await expect(page.locator('#cpu-level-select')).toHaveClass(/hidden/);

    // CPU対戦ボタンをクリック
    await page.click('#btn-cpu');

    // レベル選択UIが表示される
    await expect(page.locator('#cpu-level-select')).not.toHaveClass(/hidden/);

    // 初級・中級・上級ボタンが表示される
    await expect(page.locator('#btn-easy')).toBeVisible();
    await expect(page.locator('#btn-medium')).toBeVisible();
    await expect(page.locator('#btn-hard')).toBeVisible();
  });

  test('2人対戦に戻るとレベル選択UIが非表示になる', async ({ page }) => {
    await page.goto('/');

    // CPU対戦を選ぶ
    await page.click('#btn-cpu');
    await expect(page.locator('#cpu-level-select')).not.toHaveClass(/hidden/);

    // 2人対戦に戻す
    await page.click('#btn-local');
    await expect(page.locator('#cpu-level-select')).toHaveClass(/hidden/);
  });

  test('CPUレベルボタンをクリックするとアクティブ状態が切り替わる', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-cpu');

    // 初期状態では初級がアクティブ
    await expect(page.locator('#btn-easy')).toHaveClass(/level-btn--active/);

    // 中級をクリック
    await page.click('#btn-medium');
    await expect(page.locator('#btn-medium')).toHaveClass(/level-btn--active/);
    await expect(page.locator('#btn-easy')).not.toHaveClass(/level-btn--active/);

    // 上級をクリック
    await page.click('#btn-hard');
    await expect(page.locator('#btn-hard')).toHaveClass(/level-btn--active/);
    await expect(page.locator('#btn-medium')).not.toHaveClass(/level-btn--active/);
  });

});


// =============================================
// テストグループ 2: 2人対戦の基本動作
// =============================================

test.describe('2人対戦 - 基本動作', () => {

  test('2人対戦を開始するとゲーム画面が表示される', async ({ page }) => {
    await startGame(page, 'local');

    // ゲーム画面が表示される
    await expect(page.locator('#game-screen')).not.toHaveClass(/hidden/);

    // モード選択画面が非表示になる
    await expect(page.locator('#mode-select')).toHaveClass(/hidden/);
  });

  test('初期配置が正しく表示される', async ({ page }) => {
    await startGame(page, 'local');

    // 中央4マスに石が配置されていることを確認する
    // board[3][3] = 白石
    await expect(getCell(page, 3, 3).locator('.stone.white')).toBeVisible();
    // board[3][4] = 黒石
    await expect(getCell(page, 3, 4).locator('.stone.black')).toBeVisible();
    // board[4][3] = 黒石
    await expect(getCell(page, 4, 3).locator('.stone.black')).toBeVisible();
    // board[4][4] = 白石
    await expect(getCell(page, 4, 4).locator('.stone.white')).toBeVisible();
  });

  test('黒のターンから始まる', async ({ page }) => {
    await startGame(page, 'local');

    // ターン表示が「● 黒のターン」であることを確認する
    await expect(page.locator('#turn-display')).toHaveText('● 黒のターン');
  });

  test('黒が置ける場所がハイライトされる', async ({ page }) => {
    await startGame(page, 'local');

    // 初期状態で黒が置ける場所は4か所
    const validCells = getValidCells(page);
    await expect(validCells).toHaveCount(4);
  });

  test('石数の初期表示が正しい', async ({ page }) => {
    await startGame(page, 'local');

    // 初期状態は黒2・白2
    await expect(page.locator('#black-count')).toHaveText('● 黒: 2');
    await expect(page.locator('#white-count')).toHaveText('○ 白: 2');
  });

  test('黒が石を置けて、ターンが白に切り替わる', async ({ page }) => {
    await startGame(page, 'local');

    // 置ける場所の最初のマスをクリックする
    const firstValidCell = getValidCells(page).first();
    await firstValidCell.click();

    // アニメーション完了を待つ（400ms + 余裕）
    await page.waitForTimeout(600);

    // ターンが白に切り替わっていることを確認する
    await expect(page.locator('#turn-display')).toHaveText('○ 白のターン');
  });

  test('石を置いた後、石数が更新される', async ({ page }) => {
    await startGame(page, 'local');

    // 黒が石を置く
    const firstValidCell = getValidCells(page).first();
    await firstValidCell.click();

    // アニメーション完了を待つ
    await page.waitForTimeout(600);

    // 石数が変化していることを確認する（黒が増えているはず）
    const blackCount = await page.locator('#black-count').textContent();
    // 初期値の「● 黒: 2」から変化していることを確認
    expect(blackCount).not.toBe('● 黒: 2');
  });

  test('置けないマスをクリックしても何も起きない', async ({ page }) => {
    await startGame(page, 'local');

    // 角（0,0）は初期状態では置けない
    await getCell(page, 0, 0).click();

    // ターンが変わっていないことを確認する
    await page.waitForTimeout(200);
    await expect(page.locator('#turn-display')).toHaveText('● 黒のターン');
  });

  test('2人対戦中はCPU代理ボタンが表示される', async ({ page }) => {
    await startGame(page, 'local');

    // CPU代理ボタンが表示されていることを確認する
    await expect(page.locator('#proxy-btn')).not.toHaveClass(/hidden/);
  });

});


// =============================================
// テストグループ 3: CPU対戦
// =============================================

test.describe('CPU対戦', () => {

  test('CPU対戦（初級）を開始できる', async ({ page }) => {
    await startGame(page, 'cpu', 'easy');

    // ゲーム画面が表示される
    await expect(page.locator('#game-screen')).not.toHaveClass(/hidden/);

    // 黒のターンから始まる
    await expect(page.locator('#turn-display')).toHaveText('● 黒のターン');
  });

  test('CPU対戦中はCPU代理ボタンが表示されない', async ({ page }) => {
    await startGame(page, 'cpu', 'easy');

    // CPU代理ボタンが非表示であることを確認する
    await expect(page.locator('#proxy-btn')).toHaveClass(/hidden/);
  });

  test('CPU対戦で黒が石を置いた後、CPUが自動で白を置く', async ({ page }) => {
    await startGame(page, 'cpu', 'easy');

    // 黒が石を置く
    const firstValidCell = getValidCells(page).first();
    await firstValidCell.click();

    // CPU思考中の表示を確認する（500ms以内に表示される）
    await expect(page.locator('#turn-display')).toHaveText('🤖 CPU思考中...', { timeout: 1000 });

    // CPUが石を置いた後、黒のターンに戻ることを確認する
    // CPU思考500ms + アニメーション400ms + 余裕 = 1500ms待機
    await expect(page.locator('#turn-display')).toHaveText('● 黒のターン', { timeout: 2000 });
  });

  test('CPU思考中は盤面をクリックできない', async ({ page }) => {
    await startGame(page, 'cpu', 'easy');

    // 黒が石を置く
    const firstValidCell = getValidCells(page).first();
    await firstValidCell.click();

    // CPU思考中（ターン表示が「CPU思考中...」の間）に盤面をクリックする
    await expect(page.locator('#turn-display')).toHaveText('🤖 CPU思考中...', { timeout: 1000 });

    // この時点でハイライトが表示されていないことを確認する
    const validCells = getValidCells(page);
    await expect(validCells).toHaveCount(0);
  });

  test('CPU対戦（中級）を開始できる', async ({ page }) => {
    await startGame(page, 'cpu', 'medium');
    await expect(page.locator('#game-screen')).not.toHaveClass(/hidden/);
    await expect(page.locator('#turn-display')).toHaveText('● 黒のターン');
  });

  test('CPU対戦（上級）を開始できる', async ({ page }) => {
    await startGame(page, 'cpu', 'hard');
    await expect(page.locator('#game-screen')).not.toHaveClass(/hidden/);
    await expect(page.locator('#turn-display')).toHaveText('● 黒のターン');
  });

});


// =============================================
// テストグループ 4: ボタン操作
// =============================================

test.describe('ボタン操作', () => {

  test('リセットボタンで初期状態に戻る', async ({ page }) => {
    await startGame(page, 'local');

    // 黒が石を置く
    const firstValidCell = getValidCells(page).first();
    await firstValidCell.click();
    await page.waitForTimeout(600);

    // リセットボタンをクリック
    await page.click('#reset-btn');

    // 初期状態に戻っていることを確認する
    await expect(page.locator('#turn-display')).toHaveText('● 黒のターン');
    await expect(page.locator('#black-count')).toHaveText('● 黒: 2');
    await expect(page.locator('#white-count')).toHaveText('○ 白: 2');
  });

  test('リセット後も同じモードが維持される', async ({ page }) => {
    // CPU対戦で開始してリセット
    await startGame(page, 'cpu', 'easy');
    await page.click('#reset-btn');

    // ゲーム画面が表示されたまま（モード選択に戻らない）
    await expect(page.locator('#game-screen')).not.toHaveClass(/hidden/);
  });

  test('「モード選択に戻る」ボタンでモード選択画面に戻る', async ({ page }) => {
    await startGame(page, 'local');

    // モード選択に戻るボタンをクリック
    await page.click('#back-btn');

    // モード選択画面が表示される
    await expect(page.locator('#mode-select')).not.toHaveClass(/hidden/);

    // ゲーム画面が非表示になる
    await expect(page.locator('#game-screen')).toHaveClass(/hidden/);
  });

});


// =============================================
// テストグループ 5: 戦績モーダル
// =============================================

test.describe('戦績モーダル', () => {

  test('「📊 戦績」ボタンで戦績モーダルが開く', async ({ page }) => {
    await startGame(page, 'local');

    // 初期状態ではモーダルが非表示
    await expect(page.locator('#stats-modal')).toHaveClass(/hidden/);

    // 戦績ボタンをクリック
    await page.click('#stats-btn');

    // モーダルが表示される
    await expect(page.locator('#stats-modal')).not.toHaveClass(/hidden/);
  });

  test('戦績モーダルの「✕」ボタンで閉じる', async ({ page }) => {
    await startGame(page, 'local');
    await page.click('#stats-btn');
    await expect(page.locator('#stats-modal')).not.toHaveClass(/hidden/);

    // ✕ボタンをクリック
    await page.click('#stats-close-btn');

    // モーダルが閉じる
    await expect(page.locator('#stats-modal')).toHaveClass(/hidden/);
  });

  test('戦績モーダルの背景クリックで閉じる', async ({ page }) => {
    await startGame(page, 'local');
    await page.click('#stats-btn');
    await expect(page.locator('#stats-modal')).not.toHaveClass(/hidden/);

    // モーダル本体（#stats-content）は画面中央に表示される。
    // 画面左上隅（10, 10）はモーダル本体の外側＝オーバーレイ上なので
    // 実際のユーザークリックと同じ操作でモーダルを閉じられる。
    await page.mouse.click(10, 10);

    // モーダルが閉じる
    await expect(page.locator('#stats-modal')).toHaveClass(/hidden/);
  });

  test('戦績モーダルにサマリー項目が表示される', async ({ page }) => {
    await startGame(page, 'local');
    await page.click('#stats-btn');

    // 各サマリー項目が表示されていることを確認する
    await expect(page.locator('#stats-total')).toBeVisible();
    await expect(page.locator('#stats-win')).toBeVisible();
    await expect(page.locator('#stats-lose')).toBeVisible();
    await expect(page.locator('#stats-draw')).toBeVisible();
    await expect(page.locator('#stats-win-rate')).toBeVisible();
  });

  test('初期状態では勝率が「-」と表示される', async ({ page }) => {
    // localStorage をクリアしてから開く
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await startGame(page, 'local');
    await page.click('#stats-btn');

    // 勝率が「-」であることを確認する
    await expect(page.locator('#stats-win-rate')).toHaveText('-');
  });

});


// =============================================
// テストグループ 6: 遊び方モーダル
// =============================================

test.describe('遊び方モーダル', () => {

  test('モード選択画面の「遊び方」ボタンでモーダルが開く', async ({ page }) => {
    await page.goto('/');

    // 初期状態ではモーダルが非表示
    await expect(page.locator('#help-modal')).toHaveClass(/hidden/);

    // 遊び方ボタンをクリック
    await page.click('#help-btn-mode');

    // モーダルが表示される
    await expect(page.locator('#help-modal')).not.toHaveClass(/hidden/);
  });

  test('ゲーム画面の「遊び方」ボタンでモーダルが開く', async ({ page }) => {
    await startGame(page, 'local');

    // 遊び方ボタンをクリック
    await page.click('#help-btn-game');

    // モーダルが表示される
    await expect(page.locator('#help-modal')).not.toHaveClass(/hidden/);
  });

  test('遊び方モーダルの「✕」ボタンで閉じる', async ({ page }) => {
    await page.goto('/');
    await page.click('#help-btn-mode');
    await expect(page.locator('#help-modal')).not.toHaveClass(/hidden/);

    // ✕ボタンをクリック
    await page.click('#help-close-btn');

    // モーダルが閉じる
    await expect(page.locator('#help-modal')).toHaveClass(/hidden/);
  });

  test('遊び方モーダルの背景クリックで閉じる', async ({ page }) => {
    await page.goto('/');
    await page.click('#help-btn-mode');
    await expect(page.locator('#help-modal')).not.toHaveClass(/hidden/);

    // モーダル本体（#help-content）は画面中央に表示される。
    // 画面左上隅（10, 10）はモーダル本体の外側＝オーバーレイ上なので
    // 実際のユーザークリックと同じ操作でモーダルを閉じられる。
    await page.mouse.click(10, 10);

    // モーダルが閉じる
    await expect(page.locator('#help-modal')).toHaveClass(/hidden/);
  });

  test('遊び方モーダルの下部「閉じる」ボタンで閉じる', async ({ page }) => {
    await page.goto('/');
    await page.click('#help-btn-mode');

    // 下部の閉じるボタンをクリック
    await page.click('#help-close-bottom-btn');

    // モーダルが閉じる
    await expect(page.locator('#help-modal')).toHaveClass(/hidden/);
  });

  test('遊び方モーダルに6つのセクションが表示される', async ({ page }) => {
    await page.goto('/');
    await page.click('#help-btn-mode');

    // 6つのセクション（h3）が表示されていることを確認する
    const sections = page.locator('#help-body .help-section h3');
    await expect(sections).toHaveCount(6);
  });

});


// =============================================
// テストグループ 7: 設定モーダル
// =============================================

test.describe('設定モーダル', () => {

  test('モード選択画面の設定ボタンで設定モーダルが開く', async ({ page }) => {
    await page.goto('/');

    // 初期状態ではモーダルが非表示
    await expect(page.locator('#settings-modal')).toHaveClass(/hidden/);

    // 設定ボタンをクリック
    await page.click('#settings-btn-mode');

    // モーダルが表示される
    await expect(page.locator('#settings-modal')).not.toHaveClass(/hidden/);
  });

  test('ゲーム画面の設定ボタンで設定モーダルが開く', async ({ page }) => {
    await startGame(page, 'local');

    // 初期状態ではモーダルが非表示
    await expect(page.locator('#settings-modal')).toHaveClass(/hidden/);

    // 設定ボタンをクリック
    await page.click('#settings-btn-game');

    // モーダルが表示される
    await expect(page.locator('#settings-modal')).not.toHaveClass(/hidden/);
  });

  test('設定モーダルの「✕」ボタンで閉じる', async ({ page }) => {
    await page.goto('/');
    await page.click('#settings-btn-mode');
    await expect(page.locator('#settings-modal')).not.toHaveClass(/hidden/);

    // ✕ボタンをクリック
    await page.click('#settings-close-btn');

    // モーダルが閉じる
    await expect(page.locator('#settings-modal')).toHaveClass(/hidden/);
  });

  test('設定モーダルの背景クリックで閉じる', async ({ page }) => {
    await page.goto('/');
    await page.click('#settings-btn-mode');
    await expect(page.locator('#settings-modal')).not.toHaveClass(/hidden/);

    // モーダル本体（#settings-content）は画面中央に表示される。
    // 画面左上隅（10, 10）はモーダル本体の外側＝オーバーレイ上なので
    // 実際のユーザークリックと同じ操作でモーダルを閉じられる。
    await page.mouse.click(10, 10);

    // モーダルが閉じる
    await expect(page.locator('#settings-modal')).toHaveClass(/hidden/);
  });

  test('CPU思考時間の「短い」「普通」「長い」を選択できる', async ({ page }) => {
    await page.goto('/');
    await page.click('#settings-btn-mode');

    // 「短い」ボタンをクリック
    await page.click('.setting-btn[data-setting="cpuThinkTime"][data-value="300"]');
    await expect(page.locator('.setting-btn[data-setting="cpuThinkTime"][data-value="300"]')).toHaveClass(/setting-btn--active/);
    await expect(page.locator('.setting-btn[data-setting="cpuThinkTime"][data-value="500"]')).not.toHaveClass(/setting-btn--active/);
    await expect(page.locator('.setting-btn[data-setting="cpuThinkTime"][data-value="1000"]')).not.toHaveClass(/setting-btn--active/);

    // 「普通」ボタンをクリック
    await page.click('.setting-btn[data-setting="cpuThinkTime"][data-value="500"]');
    await expect(page.locator('.setting-btn[data-setting="cpuThinkTime"][data-value="500"]')).toHaveClass(/setting-btn--active/);
    await expect(page.locator('.setting-btn[data-setting="cpuThinkTime"][data-value="300"]')).not.toHaveClass(/setting-btn--active/);

    // 「長い」ボタンをクリック
    await page.click('.setting-btn[data-setting="cpuThinkTime"][data-value="1000"]');
    await expect(page.locator('.setting-btn[data-setting="cpuThinkTime"][data-value="1000"]')).toHaveClass(/setting-btn--active/);
    await expect(page.locator('.setting-btn[data-setting="cpuThinkTime"][data-value="500"]')).not.toHaveClass(/setting-btn--active/);
  });

  test('ヒント表示 ON/OFF を切り替えられる', async ({ page }) => {
    await page.goto('/');
    await page.click('#settings-btn-mode');

    // 「OFF」ボタンをクリック
    await page.click('.setting-btn[data-setting="showHints"][data-value="false"]');
    await expect(page.locator('.setting-btn[data-setting="showHints"][data-value="false"]')).toHaveClass(/setting-btn--active/);
    await expect(page.locator('.setting-btn[data-setting="showHints"][data-value="true"]')).not.toHaveClass(/setting-btn--active/);

    // 「ON」ボタンをクリック
    await page.click('.setting-btn[data-setting="showHints"][data-value="true"]');
    await expect(page.locator('.setting-btn[data-setting="showHints"][data-value="true"]')).toHaveClass(/setting-btn--active/);
    await expect(page.locator('.setting-btn[data-setting="showHints"][data-value="false"]')).not.toHaveClass(/setting-btn--active/);
  });

  test('アニメーション ON/OFF を切り替えられる', async ({ page }) => {
    await page.goto('/');
    await page.click('#settings-btn-mode');

    // 「OFF」ボタンをクリック
    await page.click('.setting-btn[data-setting="animationOn"][data-value="false"]');
    await expect(page.locator('.setting-btn[data-setting="animationOn"][data-value="false"]')).toHaveClass(/setting-btn--active/);
    await expect(page.locator('.setting-btn[data-setting="animationOn"][data-value="true"]')).not.toHaveClass(/setting-btn--active/);

    // 「ON」ボタンをクリック
    await page.click('.setting-btn[data-setting="animationOn"][data-value="true"]');
    await expect(page.locator('.setting-btn[data-setting="animationOn"][data-value="true"]')).toHaveClass(/setting-btn--active/);
    await expect(page.locator('.setting-btn[data-setting="animationOn"][data-value="false"]')).not.toHaveClass(/setting-btn--active/);
  });

  test('設定内容が localStorage に保存される', async ({ page }) => {
    // localStorage をクリアしてから開く
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // 設定モーダルを開く
    await page.click('#settings-btn-mode');

    // CPU思考時間を「短い」に変更する
    await page.click('.setting-btn[data-setting="cpuThinkTime"][data-value="300"]');

    // ヒント表示を「OFF」に変更する
    await page.click('.setting-btn[data-setting="showHints"][data-value="false"]');

    // アニメーションを「OFF」に変更する
    await page.click('.setting-btn[data-setting="animationOn"][data-value="false"]');

    // localStorage に保存されていることを確認する
    const saved = await page.evaluate(() => {
      const raw = localStorage.getItem('othello_settings');
      return raw ? JSON.parse(raw) : null;
    });

    expect(saved).not.toBeNull();
    expect(saved.cpuThinkTime).toBe(300);
    expect(saved.showHints).toBe(false);
    expect(saved.animationOn).toBe(false);
  });

  test('設定モーダルの下部「閉じる」ボタンで閉じる', async ({ page }) => {
    await page.goto('/');
    await page.click('#settings-btn-mode');
    await expect(page.locator('#settings-modal')).not.toHaveClass(/hidden/);

    // 下部の閉じるボタンをクリック
    await page.click('#settings-close-bottom-btn');

    // モーダルが閉じる
    await expect(page.locator('#settings-modal')).toHaveClass(/hidden/);
  });

});


// =============================================
// テストグループ 8: ゲーム終了
// =============================================

test.describe('ゲーム終了', () => {

  test('ゲーム終了時に勝敗が表示される（JavaScriptで強制終了）', async ({ page }) => {
    await startGame(page, 'local');

    // JavaScriptを直接実行してゲームを終了状態にする
    // （実際のゲームを最後まで進めるのは時間がかかるため）
    await page.evaluate(() => {
      // 盤面を黒石で埋めてゲームを終了させる
      // board は script.js のグローバル変数
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          board[r][c] = BLACK; // すべて黒石にする
        }
      }
      // ゲーム終了チェックを実行する
      checkGameOver();
    });

    // 勝敗表示が表示されることを確認する
    await expect(page.locator('#result-display')).toHaveClass(/visible/);

    // 「黒の勝ち」が表示されることを確認する
    const resultText = await page.locator('#result-display').textContent();
    expect(resultText).toContain('黒の勝ち');
  });

  test('ゲーム終了後にリセットすると初期状態に戻る', async ({ page }) => {
    await startGame(page, 'local');

    // ゲームを強制終了する
    await page.evaluate(() => {
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          board[r][c] = BLACK;
        }
      }
      checkGameOver();
    });

    // 勝敗表示が出ていることを確認
    await expect(page.locator('#result-display')).toHaveClass(/visible/);

    // リセットボタンをクリック
    await page.click('#reset-btn');

    // 勝敗表示が消えることを確認する
    await expect(page.locator('#result-display')).not.toHaveClass(/visible/);

    // 黒のターンに戻ることを確認する
    await expect(page.locator('#turn-display')).toHaveText('● 黒のターン');
  });

});
