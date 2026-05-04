// =============================================
// Playwright テスト設定ファイル
// =============================================
//
// このファイルでテストの実行環境を設定します。
// テスト対象のURL・ブラウザ・タイムアウトなどを定義します。
//
// 【前提】
// テストを実行する前に、ローカルサーバーを起動する必要があります。
// このファイルの webServer 設定で自動的に起動します。
// =============================================

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  // テストファイルの場所
  testDir: './tests',

  // テストのタイムアウト（1テストあたり30秒）
  timeout: 30000,

  // テスト失敗時のリトライ回数（CI環境では2回、ローカルでは0回）
  retries: process.env.CI ? 2 : 0,

  // テストを並列実行するかどうか
  // CPU対戦のタイミング依存テストがあるため、直列実行にする
  workers: 1,

  // テスト結果のレポート形式
  reporter: [
    ['list'],           // コンソールに一覧表示
    ['html', {          // HTMLレポートを生成
      outputFolder: 'playwright-report',
      open: 'never',    // テスト後に自動でブラウザを開かない
    }],
  ],

  // 全テスト共通の設定
  use: {
    // テスト対象のURL（ローカルサーバー）
    baseURL: 'http://localhost:3000',

    // テスト失敗時にスクリーンショットを撮る
    screenshot: 'only-on-failure',

    // テスト失敗時にビデオを録画する
    video: 'retain-on-failure',

    // ブラウザ操作のタイムアウト（各アクションあたり5秒）
    actionTimeout: 5000,

    // ページ読み込みのタイムアウト
    navigationTimeout: 10000,
  },

  // テストするブラウザの設定
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    // Safari（WebKit）でもテストしたい場合はコメントを外す
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // テスト実行前にローカルサーバーを自動起動する設定
  // npm test を実行すると自動でサーバーが起動し、テスト後に停止する
  webServer: {
    // serve パッケージでカレントディレクトリを配信する
    command: 'npx serve . -p 3000 -s',
    url: 'http://localhost:3000',
    // サーバーが起動するまで待機する（最大10秒）
    timeout: 10000,
    // すでにサーバーが起動している場合は再利用する
    reuseExistingServer: !process.env.CI,
  },
});
