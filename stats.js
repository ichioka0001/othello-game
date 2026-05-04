/* =============================================
   オセロゲーム 戦績管理（stats.js）
   =============================================

   このファイルには対戦結果の保存・読み込み・
   表示・リセットに関するすべての処理が書かれています。

   【使用する技術】
   localStorage：ブラウザに小さなデータを保存できる仕組み。
     サーバー不要で、ブラウザを閉じても消えない。
     ただし、そのブラウザ・端末でしか見られない。

   【保存するデータの形式（JSON）】
   {
     "history": [
       {
         "id": "一意なID",
         "date": "2025-05-04T10:30:00",
         "mode": "cpu",           // 'local' または 'cpu'
         "cpuLevel": "medium",    // CPU対戦の場合のみ。'easy'（初級）/ 'medium'（中級）/ 'hard'（上級）
         "result": "black",       // 'black'（黒勝ち）/ 'white'（白勝ち）/ 'draw'（引き分け）
         "blackCount": 34,
         "whiteCount": 30
       },
       ...
     ]
   }

   ⚠️ セキュリティ注意点：
   localStorage はブラウザ上に平文で保存されます。
   パスワードや個人情報は絶対に保存しないでください。

   ============================================= */


// localStorage に保存するときのキー名
// このキーで保存・読み込みを行う
const STATS_KEY = 'othello_stats';

// 保存できる履歴の最大件数
// これを超えたら古いものから削除する
const MAX_HISTORY = 100;


/* =============================================
   対戦結果の保存
   ============================================= */

/**
 * 対戦結果を localStorage に保存する関数
 *
 * ゲーム終了時（showResult）から呼ばれる。
 *
 * @param {Object} result - 保存する対戦結果
 * @param {string} result.mode      - 対戦モード（'local' または 'cpu'）
 * @param {string} result.cpuLevel  - CPUレベル（'easy'/'medium'、CPU対戦のみ）
 * @param {string} result.result    - 勝敗（'black'/'white'/'draw'）
 * @param {number} result.blackCount - 黒の石数
 * @param {number} result.whiteCount - 白の石数
 */
function saveGameResult(result) {
  // localStorage から既存の戦績データを読み込む
  const stats = loadStatsData();

  // 新しい対戦結果を作成する
  const newRecord = {
    // 一意なIDを生成する（現在時刻のミリ秒 + ランダム数）
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    // 現在の日時をISO形式で保存する（例: "2025-05-04T10:30:00.000Z"）
    date: new Date().toISOString(),
    // 対戦モード
    mode: result.mode,
    // CPUレベル（2人対戦の場合は null）
    cpuLevel: result.mode === 'cpu' ? result.cpuLevel : null,
    // 勝敗
    result: result.result,
    // 石数
    blackCount: result.blackCount,
    whiteCount: result.whiteCount,
  };

  // 履歴の先頭に追加する（最新が一番上になるように）
  stats.history.unshift(newRecord);

  // 最大件数を超えた場合は、末尾（古いもの）から削除する
  if (stats.history.length > MAX_HISTORY) {
    // slice(0, MAX_HISTORY) は「先頭から MAX_HISTORY 件だけ残す」
    stats.history = stats.history.slice(0, MAX_HISTORY);
  }

  // localStorage に保存する
  // JSON.stringify() はオブジェクトを文字列に変換する
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}


/* =============================================
   戦績データの読み込み
   ============================================= */

/**
 * localStorage から戦績データを読み込んで返す関数
 *
 * データがない場合は空の初期データを返す。
 *
 * @returns {{ history: Array }} 戦績データ
 */
function loadStatsData() {
  // localStorage からデータを取得する
  const raw = localStorage.getItem(STATS_KEY);

  // データがない場合（初回起動時など）は空のデータを返す
  if (!raw) {
    return { history: [] };
  }

  // 文字列をオブジェクトに変換して返す
  // JSON.parse() は文字列をオブジェクトに変換する
  try {
    return JSON.parse(raw);
  } catch (e) {
    // データが壊れていた場合は空のデータを返す
    console.warn('戦績データの読み込みに失敗しました。データをリセットします。');
    return { history: [] };
  }
}


/* =============================================
   戦績サマリーの計算
   ============================================= */

/**
 * 戦績の集計を計算して返す関数
 *
 * CPU対戦では「あなた（黒）が勝ったか負けたか」を集計する。
 * 2人対戦では「黒が勝ったか白が勝ったか」を集計する。
 *
 * 【勝率の計算方法】
 * 勝率 = 勝ち数 ÷ (勝ち数 + 負け数) × 100
 *
 * 引き分けを分母に含めない理由：
 * 引き分けは「勝てなかった」でも「負けた」でもないため、
 * 分母に含めると実力より低い勝率になってしまう。
 * 例：10勝0負10分 → 全対戦で割ると50%、勝ち負けのみで割ると100%
 * 後者の方が「一度も負けていない」という実態に合っている。
 *
 * @param {Array} history - 対戦履歴の配列
 * @returns {Object} 集計結果
 */
function calcSummary(history) {
  const summary = {
    total:    history.length, // 総対戦数
    win:      0,              // あなたの勝ち数（CPU対戦）/ 黒の勝ち数（2人対戦）
    lose:     0,              // あなたの負け数（CPU対戦）/ 白の勝ち数（2人対戦）
    draw:     0,              // 引き分け数
    winRate:  null,           // 勝率（%）。対戦数が0の場合は null
  };

  // 履歴をループして集計する
  for (const record of history) {
    if (record.mode === 'cpu') {
      // CPU対戦：プレイヤーは黒なので、黒勝ち = あなたの勝ち
      if (record.result === 'black') {
        summary.win++;
      } else if (record.result === 'white') {
        summary.lose++;
      } else {
        summary.draw++;
      }
    } else {
      // 2人対戦：どちらが自分か分からないので黒/白で集計
      if (record.result === 'black') {
        summary.win++;   // 黒の勝ち（ラベルは「黒の勝ち」と表示）
      } else if (record.result === 'white') {
        summary.lose++;  // 白の勝ち（ラベルは「白の勝ち」と表示）
      } else {
        summary.draw++;
      }
    }
  }

  // 勝率を計算する（勝ち + 負け が 0 の場合は計算しない）
  const decidedGames = summary.win + summary.lose; // 引き分けを除いた対戦数
  if (decidedGames > 0) {
    // 小数点以下1桁で四捨五入する
    summary.winRate = Math.round((summary.win / decidedGames) * 1000) / 10;
  }

  return summary;
}

/**
 * 対戦履歴に2人対戦が含まれているかどうかを確認する関数
 *
 * サマリーのラベルを「あなたの勝ち」にするか「黒の勝ち」にするかを
 * 判断するために使う。
 * 全履歴がCPU対戦のみなら「あなたの勝ち」、
 * 2人対戦が1件でも含まれていれば「黒の勝ち」と表示する。
 *
 * @param {Array} history - 対戦履歴の配列
 * @returns {boolean} 2人対戦が含まれていれば true
 */
function hasLocalGames(history) {
  return history.some(record => record.mode === 'local');
}


/* =============================================
   戦績モーダルの表示・非表示
   ============================================= */

/**
 * 戦績モーダルを表示する関数
 *
 * 「戦績を見る」ボタンが押されたときに呼ばれる。
 * localStorage からデータを読み込んで画面に表示する。
 */
function showStatsModal() {
  // localStorage から戦績データを読み込む
  const stats = loadStatsData();
  const history = stats.history;

  // 集計を計算する
  const summary = calcSummary(history);

  // 2人対戦が含まれているかどうかで、ラベルを切り替える
  // 全履歴がCPU対戦のみ → 「あなたの勝ち」「あなたの負け」
  // 2人対戦が含まれる  → 「黒の勝ち」「白の勝ち」
  const isAllCpu = !hasLocalGames(history);
  const winLabel  = isAllCpu ? 'あなたの勝ち' : '黒の勝ち';
  const loseLabel = isAllCpu ? 'あなたの負け' : '白の勝ち';

  // サマリーのラベルを更新する
  document.getElementById('stats-win-label').textContent  = winLabel;
  document.getElementById('stats-lose-label').textContent = loseLabel;

  // サマリーの数値を更新する
  document.getElementById('stats-total').textContent   = summary.total;
  document.getElementById('stats-win').textContent     = summary.win;
  document.getElementById('stats-lose').textContent    = summary.lose;
  document.getElementById('stats-draw').textContent    = summary.draw;

  // 勝率を表示する（対戦数が0の場合は「-」と表示する）
  const winRateEl = document.getElementById('stats-win-rate');
  if (summary.winRate !== null) {
    winRateEl.textContent = `${summary.winRate}%`;
  } else {
    winRateEl.textContent = '-';
  }

  // 対戦履歴一覧を描画する
  renderHistoryList(history);

  // モーダルを表示する
  document.getElementById('stats-modal').classList.remove('hidden');
}

/**
 * 戦績モーダルを非表示にする関数
 */
function hideStatsModal() {
  document.getElementById('stats-modal').classList.add('hidden');
}

/**
 * 対戦履歴の一覧を描画する関数
 *
 * @param {Array} history - 対戦履歴の配列
 */
function renderHistoryList(history) {
  const listEl = document.getElementById('stats-history-list');

  // 一度クリアしてから描き直す
  listEl.innerHTML = '';

  // 履歴がない場合はメッセージを表示する
  if (history.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.className = 'stats-empty';
    emptyMsg.textContent = 'まだ対戦履歴がありません';
    listEl.appendChild(emptyMsg);
    return;
  }

  // 各履歴をループして行を作成する
  for (const record of history) {
    const row = document.createElement('div');
    row.className = 'history-row';

    // 日時を読みやすい形式に変換する
    // 例: "2025/05/04 10:30"
    const date = new Date(record.date);
    const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

    // 対戦モードの表示文字列を作る
    let modeStr;
    if (record.mode === 'cpu') {
      // CPU対戦の場合はレベルも表示する
      // cpuLevel の値に応じて日本語ラベルに変換する
      let levelLabel;
      if (record.cpuLevel === 'easy') {
        levelLabel = '初級';
      } else if (record.cpuLevel === 'medium') {
        levelLabel = '中級';
      } else if (record.cpuLevel === 'hard') {
        levelLabel = '上級';
      } else {
        levelLabel = '不明';
      }
      modeStr = `CPU（${levelLabel}）`;
    } else {
      modeStr = '2人対戦';
    }

    // 勝敗の表示文字列と色クラスを決める
    // CPU対戦の場合は「あなたの勝ち/負け」、2人対戦は「黒勝ち/白勝ち」と表示する
    let resultStr;
    let resultClass;

    if (record.mode === 'cpu') {
      // CPU対戦：プレイヤーは黒なので、黒勝ち = あなたの勝ち
      if (record.result === 'black') {
        resultStr   = 'あなたの勝ち';
        resultClass = 'result-win';
      } else if (record.result === 'white') {
        resultStr   = 'あなたの負け';
        resultClass = 'result-lose';
      } else {
        resultStr   = '引き分け';
        resultClass = 'result-draw';
      }
    } else {
      // 2人対戦：どちらが自分か分からないので黒/白で表示する
      if (record.result === 'black') {
        resultStr   = '黒勝ち';
        resultClass = 'result-black';
      } else if (record.result === 'white') {
        resultStr   = '白勝ち';
        resultClass = 'result-white';
      } else {
        resultStr   = '引き分け';
        resultClass = 'result-draw';
      }
    }

    // 行のHTMLを組み立てる
    row.innerHTML = `
      <span class="history-date">${dateStr}</span>
      <span class="history-mode">${modeStr}</span>
      <span class="history-result ${resultClass}">${resultStr}</span>
      <span class="history-score">${record.blackCount} - ${record.whiteCount}</span>
    `;

    listEl.appendChild(row);
  }
}


/* =============================================
   戦績のリセット
   ============================================= */

/**
 * 戦績をすべて削除する関数
 *
 * 確認ダイアログを表示してから削除する。
 */
function resetStats() {
  // confirm() は「OK / キャンセル」のダイアログを表示する
  // OK を押すと true、キャンセルを押すと false が返る
  const confirmed = window.confirm('戦績をすべて削除しますか？\nこの操作は元に戻せません。');

  if (!confirmed) {
    // キャンセルされた場合は何もしない
    return;
  }

  // localStorage からデータを削除する
  localStorage.removeItem(STATS_KEY);

  // 画面を更新する（空の状態で再描画）
  showStatsModal();
}


/* =============================================
   開発用デバッグ機能
   =============================================

   ⚠️ この機能は開発・動作確認専用です。
   URLに ?debug=1 が付いているときだけ有効になります。
   通常の index.html では表示されません。

   使い方：
     index.html?debug=1 をブラウザで開く
     → 戦績モーダルの下部にデバッグボタンが表示される

   ============================================= */


/**
 * ランダムなダミー対戦結果を1件生成して返す関数
 *
 * saveGameResult() と同じ形式のオブジェクトを返す。
 * 日時は過去30日以内のランダムな時刻にする。
 *
 * @returns {Object} ダミーの対戦結果オブジェクト
 */
function generateTestRecord() {
  // 対戦モードをランダムに選ぶ（'local' または 'cpu'）
  const modes = ['local', 'cpu', 'cpu', 'cpu']; // CPUの方が多めに出るようにする
  const mode = modes[Math.floor(Math.random() * modes.length)];

  // CPUレベルをランダムに選ぶ（CPU対戦の場合のみ使用）
  const cpuLevels = ['easy', 'medium'];
  const cpuLevel = cpuLevels[Math.floor(Math.random() * cpuLevels.length)];

  // 勝敗をランダムに選ぶ
  const results = ['black', 'black', 'white', 'draw']; // 黒勝ちが少し多め
  const result = results[Math.floor(Math.random() * results.length)];

  // 石数をランダムに生成する（合計が64になるように）
  // 黒の石数を20〜44の範囲でランダムに決める
  const blackCount = Math.floor(Math.random() * 25) + 20;
  const whiteCount = 64 - blackCount;

  // 日時を過去30日以内のランダムな時刻にする
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000; // 30日をミリ秒に変換
  const randomDate = new Date(now - Math.random() * thirtyDaysMs);

  return {
    mode:       mode,
    cpuLevel:   mode === 'cpu' ? cpuLevel : null,
    result:     result,
    blackCount: blackCount,
    whiteCount: whiteCount,
    // 日時を上書きするため、saveGameResult() を使わず直接データを作る
    _overrideDate: randomDate.toISOString(),
  };
}

/**
 * ダミーの対戦結果を指定件数だけ localStorage に追加する関数
 *
 * @param {number} count - 追加する件数
 */
function addTestRecords(count) {
  // localStorage から既存の戦績データを読み込む
  const stats = loadStatsData();

  // 指定件数分のダミーデータを生成して追加する
  for (let i = 0; i < count; i++) {
    const testData = generateTestRecord();

    // saveGameResult() と同じ形式でレコードを作成する
    const newRecord = {
      id:         Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      date:       testData._overrideDate, // ランダムな過去の日時を使う
      mode:       testData.mode,
      cpuLevel:   testData.cpuLevel,
      result:     testData.result,
      blackCount: testData.blackCount,
      whiteCount: testData.whiteCount,
    };

    // 履歴の先頭に追加する
    stats.history.unshift(newRecord);
  }

  // 最大件数を超えた場合は古いものから削除する
  if (stats.history.length > MAX_HISTORY) {
    stats.history = stats.history.slice(0, MAX_HISTORY);
  }

  // localStorage に保存する
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));

  // 戦績モーダルの表示を更新する
  showStatsModal();

  // 追加件数をコンソールに出力する（開発確認用）
  console.log(`[DEBUG] テスト戦績を ${count} 件追加しました。現在の件数: ${stats.history.length}`);
}

/**
 * デバッグモードを初期化する関数
 *
 * URLに ?debug=1 が付いているときだけ呼ばれる。
 * デバッグ用ボタンを表示して、イベントリスナーを設定する。
 */
function initDebugMode() {
  // デバッグエリアを表示する
  const debugArea = document.getElementById('debug-area');
  if (!debugArea) {
    // デバッグエリアが見つからない場合は何もしない
    return;
  }
  debugArea.classList.remove('hidden');

  // 「テスト戦績を1件追加」ボタンのイベントリスナーを設定する
  document.getElementById('debug-add-1').addEventListener('click', () => {
    addTestRecords(1);
  });

  // 「テスト戦績を10件追加」ボタンのイベントリスナーを設定する
  document.getElementById('debug-add-10').addEventListener('click', () => {
    addTestRecords(10);
  });

  // デバッグモードが有効であることをコンソールに出力する
  console.log('[DEBUG] デバッグモードが有効です。テスト戦績ボタンが使えます。');
}


/* =============================================
   ページ読み込み時のデバッグモード判定
   =============================================
   URLのクエリパラメータを確認して、
   ?debug=1 が付いている場合はデバッグモードを有効にする。

   URLSearchParams は URL のクエリパラメータを扱うための
   ブラウザ標準の機能。
   例: "index.html?debug=1" → params.get('debug') === '1'
   ============================================= */

// URLのクエリパラメータを取得する
const urlParams = new URLSearchParams(window.location.search);

// ?debug=1 が付いている場合はデバッグモードを有効にする
if (urlParams.get('debug') === '1') {
  // stats.js は body 末尾の <script> で読み込まれるため、
  // DOMContentLoaded が既に発火済みの場合もある。
  // readyState を確認して、適切なタイミングで initDebugMode() を呼ぶ。
  if (document.readyState === 'loading') {
    // まだ読み込み中なら DOMContentLoaded を待つ
    document.addEventListener('DOMContentLoaded', () => {
      initDebugMode();
    });
  } else {
    // 既に読み込み完了していれば即座に実行する
    initDebugMode();
  }
}
