/* =============================================
   オセロゲーム メインスクリプト
   =============================================

   このファイルにオセロゲームのすべてのロジックが
   書かれています。

   【実装済みの機能】
   - 2人対戦（ローカル）
   - CPU対戦（初級・中級・上級）
   - CPU代理（2人対戦中に1手だけCPUに任せる）
   - 戦績管理（stats.js と連携して localStorage に保存）
   - 遊び方モーダル（ルール説明の表示）

   【処理の流れ（2人対戦）】
   1. モード選択 → startGame() でゲーム開始
   2. プレイヤーがマスをクリック → handleCellClick()
   3. 石を置く → placeStone() → flipStones()
   4. 画面を更新 → renderBoard() / updateStatus()
   5. ターン交代 → switchPlayer()（パス処理含む）
   6. ゲーム終了チェック → checkGameOver() → showResult()

   【処理の流れ（CPU対戦）】
   上記に加えて、白のターンになると自動でCPUが動く：
   5a. switchPlayer() → 白のターン → isCpuTurn() が true
   5b. 500ms待機（思考中）→ cpuSelectMove() で手を選ぶ
   5c. executeCpuMove() で石を置く → 400ms後にターン交代

   ============================================= */


/* =============================================
   定数の定義
   =============================================
   定数とは「変わらない値」のことです。
   大文字で書くのが慣習です。
   ============================================= */

const EMPTY = 0;       // マスが空の状態
const BLACK = 1;       // 黒石
const WHITE = 2;       // 白石
const BOARD_SIZE = 8;  // 盤面のサイズ（8×8）

// 8方向の移動量を定義する [行の変化量, 列の変化量]
// 例: [-1, 0] は「1行上に移動」を意味する
//     [ 1, 1] は「1行下・1列右に移動」を意味する
const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],  // 左上・真上・右上
  [ 0, -1],          [ 0, 1],  // 真左・（自分）・真右
  [ 1, -1], [ 1, 0], [ 1, 1]   // 左下・真下・右下
];


/* =============================================
   ゲーム状態を管理する変数
   =============================================
   let は「後から値を変えられる変数」です。
   ============================================= */

let board;         // 盤面データ（8×8の2次元配列）
let currentPlayer; // 現在のターン（BLACK または WHITE）
let gameOver;      // ゲームが終了しているか（true/false）
let isAnimating;   // アニメーション中かどうか（true の間はクリックを無効にする）

// 直前の手で「置いた石」と「ひっくり返った石」の座標を保持する変数
// renderBoard() でアニメーションクラスを付けるために使う
let lastPlaced;    // 直前に置いた石の座標 { row, col } または null
let lastFlipped;   // 直前にひっくり返った石の座標の配列 [[row, col], ...] または []

// ---- 追加機能用の状態変数 ----

// 対戦モード：'local'（2人対戦）または 'cpu'（CPU対戦）
// モード選択画面で選ばれた値が入る
let gameMode = 'local';

// CPUの強さ：'easy'（初級）/ 'medium'（中級）/ 'hard'（上級）
// レベル選択ボタンで選ばれた値が入る。デフォルトは初級。
let cpuLevel = 'easy';

// CPUが担当する色（CPU対戦時のみ使用）
// 現在はCPUが常に白（WHITE）
const CPU_COLOR = WHITE;

// CPU代理中かどうかのフラグ
// true の間は人間のクリックを無効にする
// （isAnimating と役割が似ているが、代理専用に分けることで意図が明確になる）
let isProxyMode = false;

// ゲームが実際にプレイ中かどうかのフラグ
// false の間（初期化中・リセット中）は効果音を鳴らさない
// initGame() の開始時に false にセットし、初期化完了後に true にセットする
let isGameActive = false;


/* =============================================
   ゲームの初期化
   ============================================= */

/**
 * ゲームを初期状態にリセットする関数
 *
 * 呼ばれるタイミング：
 * - startGame() からゲーム開始時
 * - リセットボタンが押されたとき（gameMode は維持される）
 */
function initGame() {
  // 初期化中は効果音を鳴らさない
  isGameActive = false;

  // 8×8の空の盤面を作成する
  board = createBoard();

  // 初期配置：中央4マスに石を置く（オセロの標準ルール）
  // ※ 配列のインデックスは0始まりなので、中央は3と4
  //
  //   列→  0 1 2 3 4 5 6 7
  // 行↓
  //   3         W B
  //   4         B W
  //
  board[3][3] = WHITE; // 中央左上：白
  board[3][4] = BLACK; // 中央右上：黒
  board[4][3] = BLACK; // 中央左下：黒
  board[4][4] = WHITE; // 中央右下：白

  // 黒が先攻
  currentPlayer = BLACK;

  // ゲームはまだ終了していない
  gameOver = false;

  // アニメーション中フラグをリセットする
  isAnimating = false;

  // CPU代理フラグをリセットする
  isProxyMode = false;

  // 直前の手の情報をリセットする（初期配置の石はアニメーションしない）
  lastPlaced = null;
  lastFlipped = [];

  // 結果表示エリアを非表示にする
  const resultDisplay = document.getElementById('result-display');
  resultDisplay.textContent = '';
  resultDisplay.classList.remove('visible');

  // 勝敗モーダルを閉じる（リセット・もう一度遊ぶ時に確実に閉じる）
  hideResultModal();

  // パスメッセージを非表示にする
  hidePassMessage();

  // 画面を更新する
  renderBoard();
  updateStatus();

  // 初期化完了：ここからプレイヤーの操作を受け付ける
  // この行より後のクリック・CPU着手でのみ効果音が鳴る
  isGameActive = true;
}

/**
 * モード選択画面を非表示にしてゲームを開始する関数
 *
 * 「ゲーム開始」ボタンが押されたときに呼ばれる。
 * gameMode に選択されたモードをセットしてから initGame() を呼ぶ。
 */
function startGame() {
  // モード選択画面を非表示にする
  document.getElementById('mode-select').classList.add('hidden');
  // ゲーム画面を表示する
  document.getElementById('game-screen').classList.remove('hidden');

  // ゲーム画面用のクラスを body に付ける
  // → CSS で初期画面とゲーム画面のレイアウトを分けるために使う
  document.body.classList.add('game-active');

  // ユーザーの最初の操作として AudioContext を resume する
  // iPhone Safari の自動再生ポリシー対応：音の再生直前ではなく
  // ここで resume することで、意図しないタイミングで音が鳴るのを防ぐ
  resumeAudioContext();

  // CPU代理ボタンの表示を切り替える
  // 2人対戦のときだけ表示する（CPU対戦では不要）
  updateProxyBtnVisibility();

  // ゲームを初期化する（gameMode はすでにセット済み）
  initGame();
}

/**
 * ゲーム画面を非表示にしてモード選択画面に戻る関数
 *
 * 「モード選択に戻る」ボタンが押されたときに呼ばれる。
 */
function backToModeSelect() {
  // ゲーム画面を非表示にする
  document.getElementById('game-screen').classList.add('hidden');
  // モード選択画面を表示する
  document.getElementById('mode-select').classList.remove('hidden');

  // 勝敗モーダルを閉じる（ゲーム終了後にモード選択に戻る場合）
  hideResultModal();

  // ゲーム画面用のクラスを body から外す
  // → 初期画面のレイアウト（上寄せ・min-height: auto）に戻す
  document.body.classList.remove('game-active');
}

/**
 * 8×8の空の盤面配列を作成して返す関数
 *
 * @returns {number[][]} すべて EMPTY(0) で埋まった8×8の2次元配列
 *
 * 例：board[2][5] は「3行目・6列目のマス」を表す
 */
function createBoard() {
  // Array.from で8行分の配列を作り、各行も8列分の0で埋める
  return Array.from({ length: BOARD_SIZE }, () =>
    new Array(BOARD_SIZE).fill(EMPTY)
  );
}


/* =============================================
   盤面の描画（HTMLへの反映）
   ============================================= */

/**
 * 盤面データ（board配列）をHTMLに反映して画面を更新する関数
 *
 * この関数を呼ぶたびに、盤面全体を描き直す。
 * 石の配置・置ける場所のハイライトを最新の状態に更新する。
 *
 * 【アニメーションの仕組み】
 * - lastPlaced に一致する座標の石 → .placed クラスを付ける（置いた石）
 * - lastFlipped に含まれる座標の石 → .flipped クラスを付ける（ひっくり返った石）
 * - それ以外の既存の石 → クラスを付けない（アニメーションしない）
 *
 * 【ハイライト表示の制御】
 * - showValidMoves が true の場合：置ける場所に .valid を付けてクリック可能にする
 * - showValidMoves が false の場合：ハイライトを表示せず、クリックも無効にする
 *   （アニメーション中に前のターンの置ける場所が見えないようにするため）
 *
 * @param {boolean} showValidMoves - 置ける場所のハイライトを表示するか（デフォルト: true）
 */
function renderBoard(showValidMoves = true) {
  // HTMLの盤面要素を取得する
  const boardElement = document.getElementById('board');

  // 現在のターンのプレイヤーが置ける場所の一覧を取得する
  const validMoves = getValidMoves(currentPlayer);

  // 盤面のHTMLを一度クリアして、ゼロから描き直す
  boardElement.innerHTML = '';

  // 8行 × 8列 = 64マスをループして描画する
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {

      // マスのdiv要素を作成する
      const cell = document.createElement('div');
      cell.classList.add('cell');

      // data属性に行・列番号を保存する（クリック時に使用）
      cell.dataset.row = row;
      cell.dataset.col = col;

      // このマスの状態（空・黒石・白石）を確認する
      const stoneValue = board[row][col];

      if (stoneValue === BLACK) {
        // 黒石を表示する
        const stone = createStoneElement('black', row, col);
        cell.appendChild(stone);

      } else if (stoneValue === WHITE) {
        // 白石を表示する
        const stone = createStoneElement('white', row, col);
        cell.appendChild(stone);

      } else {
        // 空マスの場合、置ける場所かどうか確認する
        // some() は「条件に合う要素が1つでもあればtrue」を返す
        const isValid = validMoves.some(([r, c]) => r === row && c === col);

        // ハイライト（見た目）を表示する条件：
        //   showValidMoves が true（呼び出し元がハイライトを許可している）
        //   かつ CPUのターンでない（CPUが置ける場所を人間に見せない）
        //   かつ ゲーム中
        //   かつ 設定でヒント表示がONになっている
        const shouldShowHint = showValidMoves && !isCpuTurn() && currentSettings.showHints;

        // クリックイベントを付与する条件：
        //   置けるマスである かつ ゲーム中 かつ CPUのターンでない
        //   ※ ヒント表示のON/OFFに関わらず、置けるマスはクリック可能にする
        //   ※ canHumanMove() による最終チェックは handleCellClick() 内で行う
        const shouldEnableClick = isValid && !gameOver && !isCpuTurn();

        if (isValid && !gameOver && shouldShowHint) {
          // 置ける場所にはハイライトクラスを追加する（見た目のみ）
          cell.classList.add('valid');
        }

        if (shouldEnableClick) {
          // クリックイベントを設定する（ヒント表示OFFでも有効）
          // （クロージャでrow・colを保持）
          cell.addEventListener('click', () => handleCellClick(row, col));
        }
      }

      // 作成したマスを盤面に追加する
      boardElement.appendChild(cell);
    }
  }
}

/**
 * 石のdiv要素を作成して返すヘルパー関数
 *
 * 【アニメーションクラスの付け方】
 * - この石が「直前に置いた石」なら .placed クラスを付ける
 * - この石が「直前にひっくり返った石」なら .flipped クラスを付ける
 * - それ以外の既存の石にはクラスを付けない（アニメーションしない）
 *
 * @param {string} color - 'black' または 'white'
 * @param {number} row   - この石の行番号
 * @param {number} col   - この石の列番号
 * @returns {HTMLElement} 石のdiv要素
 */
function createStoneElement(color, row, col) {
  const stone = document.createElement('div');
  stone.classList.add('stone', color);

  // 直前に置いた石かどうか確認する
  // lastPlaced が null でなく、行・列が一致すれば「置いた石」
  if (lastPlaced && lastPlaced.row === row && lastPlaced.col === col) {
    // アニメーションがONの場合のみ .placed クラスを付ける
    if (currentSettings.animationOn) {
      stone.classList.add('placed');
    }
  }
  // 直前にひっくり返った石かどうか確認する
  else if (lastFlipped.some(([r, c]) => r === row && c === col)) {
    // アニメーションがONの場合のみ .flipped クラスを付ける
    if (currentSettings.animationOn) {
      stone.classList.add('flipped');
    }
  }
  // それ以外の既存の石にはアニメーションクラスを付けない

  return stone;
}


/* =============================================
   石を置けるか判定する処理
   ============================================= */

/**
 * 指定したマスに石を置けるかどうか判定する関数
 *
 * 置けるための条件：
 * 1. そのマスが空であること
 * 2. 石を置いたときに、相手の石を1つ以上ひっくり返せること
 *
 * @param {number[][]} boardState - 判定に使う盤面データ
 * @param {number} row - 行番号（0〜7）
 * @param {number} col - 列番号（0〜7）
 * @param {number} player - プレイヤー（BLACK または WHITE）
 * @returns {boolean} 置ける場合はtrue、置けない場合はfalse
 */
function isValidMove(boardState, row, col, player) {
  // すでに石が置かれているマスには置けない
  if (boardState[row][col] !== EMPTY) {
    return false;
  }

  // ひっくり返せる石が1つ以上あれば置ける
  const flipped = getFlippedStones(boardState, row, col, player);
  return flipped.length > 0;
}

/**
 * 指定したマスに石を置いたとき、ひっくり返る石の座標一覧を返す関数
 *
 * 【アルゴリズムの説明】
 * 8方向それぞれについて、以下の手順で確認する：
 * 1. その方向に1マスずつ進む
 * 2. 相手の石が続く間、候補リストに追加する
 * 3. 相手の石の後に自分の石があれば、候補リストの石をひっくり返せる
 * 4. 空マスや盤面の外に出たら、その方向はひっくり返せない
 *
 * @param {number[][]} boardState - 判定に使う盤面データ
 * @param {number} row - 行番号（0〜7）
 * @param {number} col - 列番号（0〜7）
 * @param {number} player - 石を置くプレイヤー（BLACK または WHITE）
 * @returns {number[][]} ひっくり返る石の座標の配列 [[row, col], ...]
 */
function getFlippedStones(boardState, row, col, player) {
  // 相手プレイヤーを特定する（黒なら白、白なら黒）
  const opponent = (player === BLACK) ? WHITE : BLACK;

  // ひっくり返る石の座標を格納するリスト
  const flippedStones = [];

  // 8方向それぞれについて確認する
  for (const [dRow, dCol] of DIRECTIONS) {
    // この方向でひっくり返る可能性のある石を一時的に格納する
    const candidates = [];

    // 現在の位置から1マスずつ進む
    let r = row + dRow;
    let c = col + dCol;

    // 盤面の範囲内で、相手の石が続く限りループする
    while (
      r >= 0 && r < BOARD_SIZE &&  // 行が盤面内か
      c >= 0 && c < BOARD_SIZE &&  // 列が盤面内か
      boardState[r][c] === opponent // 相手の石か
    ) {
      // 相手の石を候補リストに追加する
      candidates.push([r, c]);
      // 次のマスに進む
      r += dRow;
      c += dCol;
    }

    // ループが終わった位置に自分の石があれば、候補リストの石をひっくり返せる
    // 条件：候補が1つ以上 かつ 盤面内 かつ 自分の石
    if (
      candidates.length > 0 &&
      r >= 0 && r < BOARD_SIZE &&
      c >= 0 && c < BOARD_SIZE &&
      boardState[r][c] === player
    ) {
      // ひっくり返る石リストに追加する（スプレッド構文で配列を展開）
      flippedStones.push(...candidates);
    }
  }

  return flippedStones;
}

/**
 * 現在のプレイヤーが石を置けるマスの一覧を返す関数
 *
 * @param {number} player - プレイヤー（BLACK または WHITE）
 * @returns {number[][]} 置ける座標の配列 [[row, col], ...]
 */
function getValidMoves(player) {
  const validMoves = [];

  // 全マスをチェックして置けるマスを探す
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (isValidMove(board, row, col, player)) {
        validMoves.push([row, col]);
      }
    }
  }

  return validMoves;
}


/* =============================================
   石を置く・ひっくり返す処理
   ============================================= */

/**
 * 指定したマスに石を置き、ひっくり返す処理を行う関数
 *
 * 変更点：ひっくり返る石の座標を lastFlipped に保存するようにした。
 * これにより renderBoard() でひっくり返った石だけにアニメーションを付けられる。
 *
 * @param {number} row - 行番号（0〜7）
 * @param {number} col - 列番号（0〜7）
 */
function placeStone(row, col) {
  // ひっくり返る石の座標を先に取得する（board を変更する前に取得する必要がある）
  const flipped = getFlippedStones(board, row, col, currentPlayer);

  // 盤面データに現在のプレイヤーの石を置く
  board[row][col] = currentPlayer;

  // 石を置いたときの効果音を鳴らす（sound.js）
  // isGameActive が true のとき（実際のゲームプレイ中）だけ鳴らす
  if (isGameActive) {
    playPlaceSound();
  }

  // 取得した石をひっくり返す
  flipStones(flipped);

  // アニメーション用に「置いた石」と「ひっくり返った石」の座標を保存する
  lastPlaced  = { row, col };  // 置いた石の座標
  lastFlipped = flipped;       // ひっくり返った石の座標一覧
}

/**
 * 指定した座標の石をひっくり返す関数
 *
 * 黒石 → 白石、白石 → 黒石 に変える
 *
 * @param {number[][]} stones - ひっくり返す石の座標の配列 [[row, col], ...]
 */
function flipStones(stones) {
  for (const [row, col] of stones) {
    if (board[row][col] === BLACK) {
      board[row][col] = WHITE; // 黒 → 白
    } else if (board[row][col] === WHITE) {
      board[row][col] = BLACK; // 白 → 黒
    }
  }
  // ひっくり返した石がある場合のみ効果音を鳴らす（sound.js）
  // isGameActive が true のとき（実際のゲームプレイ中）だけ鳴らす
  if (stones.length > 0 && isGameActive) {
    playFlipSound();
  }
}


/* =============================================
   クリックイベントの処理
   ============================================= */

/**
 * マスがクリックされたときに呼ばれる関数
 *
 * 【変更点】
 * - isAnimating フラグでアニメーション中の連続クリックを防ぐ
 * - 石を置いた直後にすぐ switchPlayer() せず、
 *   setTimeout で 400ms 待ってからターン交代する
 *   （その間にアニメーションが見える）
 *
 * 処理の流れ：
 * 1. ゲーム終了 / アニメーション中チェック
 * 2. 置けるマスかチェック
 * 3. isAnimating = true にしてクリックをロック
 * 4. 石を置いてひっくり返す（lastPlaced / lastFlipped を更新）
 * 5. renderBoard() で盤面を描画（アニメーションが始まる）
 * 6. updateStatus() で石数を更新
 * 7. 400ms 待つ（setTimeout）
 * 8. ゲーム終了チェック → 終了なら結果表示
 * 9. ターンを切り替える
 * 10. isAnimating = false にしてクリックを解除
 *
 * @param {number} row - クリックされたマスの行番号
 * @param {number} col - クリックされたマスの列番号
 */
function handleCellClick(row, col) {
  // 人間が操作できる状態かどうかをまとめて確認する
  // ゲーム終了・アニメーション中・CPUターン中のいずれかなら何もしない
  if (!canHumanMove()) {
    return;
  }

  // クリックされたマスに石を置けるか確認する
  if (!isValidMove(board, row, col, currentPlayer)) {
    // 置けないマスをクリックしても何もしない
    return;
  }

  // ---- ここから石を置く処理 ----

  // アニメーション中フラグを立てる（この間はクリック無効）
  isAnimating = true;

  // パスメッセージを非表示にする
  hidePassMessage();

  // 石を置いてひっくり返す
  // （この中で lastPlaced と lastFlipped が更新される）
  placeStone(row, col);

  // 盤面を描画する（ハイライトは表示しない）
  // showValidMoves = false にすることで、アニメーション中は
  // 前のターンの「置ける場所」が見えないようにする
  renderBoard(false);

  // 石数表示を更新する
  updateStatus();

  // アニメーションが見えるように 400ms 待ってからターン交代する
  // setTimeout(関数, 待機時間ms) は「指定時間後に関数を実行する」命令
  setTimeout(() => {

    // 待機後は「直前の手」の情報をリセットする
    // （次の renderBoard() でアニメーションが再発動しないようにする）
    lastPlaced  = null;
    lastFlipped = [];

    // ゲーム終了チェック（両者とも置けない場合）
    if (checkGameOver()) {
      // ゲーム終了なら盤面を再描画して終わる
      // ゲーム終了時はハイライト不要なので false を渡す
      renderBoard(false);
      isAnimating = false; // クリックロックを解除する
      return;
    }

    // ターンを切り替える（パス処理も含む）
    // switchPlayer() の中で renderBoard(true) が呼ばれ、
    // 次のプレイヤーの置ける場所がハイライト表示される
    switchPlayer();

    // クリックロックを解除する（次のクリックを受け付けるようにする）
    isAnimating = false;

  }, 400); // 400ミリ秒（0.4秒）待つ
}


/* =============================================
   ターン管理・パス処理
   ============================================= */

/**
 * ターンを切り替える関数
 *
 * 次のプレイヤーが置ける場所がない場合はパス処理を行う。
 * CPU対戦モードで次のターンがCPUの場合は、自動でCPUの手を実行する。
 */
function switchPlayer() {
  // ターンを切り替える（黒→白、白→黒）
  currentPlayer = (currentPlayer === BLACK) ? WHITE : BLACK;

  // 次のプレイヤーが置ける場所を確認する
  const validMoves = getValidMoves(currentPlayer);

  if (validMoves.length === 0) {
    // 置ける場所がない → パス処理
    const playerName = (currentPlayer === BLACK) ? '黒' : '白';
    showPassMessage(`${playerName}は置ける場所がないため、パスします`);

    // もう一方のプレイヤーに戻す
    currentPlayer = (currentPlayer === BLACK) ? WHITE : BLACK;
  }

  // 盤面と状態表示を更新する
  renderBoard();
  updateStatus();

  // ---- Phase 2 で追加した処理 ----
  // CPU対戦モードで、次のターンがCPUの場合は自動で手を実行する
  if (isCpuTurn()) {
    scheduleCpuMove();
  }
}

/**
 * 人間がクリック操作できる状態かどうかを判定する関数
 *
 * 以下の4つの条件がすべて満たされた場合のみ、人間は操作できる：
 * 1. ゲームが終了していない
 * 2. アニメーション中でない（石を置いた直後の待機時間でない）
 * 3. CPUのターンでない（CPU対戦モードで白のターンでない）
 * 4. CPU代理中でない（2人対戦でCPUに1手任せている最中でない）
 *
 * @returns {boolean} 人間が操作できる状態なら true
 */
function canHumanMove() {
  return !gameOver && !isAnimating && !isCpuTurn() && !isProxyMode;
}

/**
 * 現在のターンがCPUかどうかを判定する関数
 *
 * CPU対戦モード（gameMode === 'cpu'）かつ
 * 現在のターンがCPUの色（CPU_COLOR）の場合に true を返す。
 *
 * @returns {boolean} CPUのターンなら true
 */
function isCpuTurn() {
  return gameMode === 'cpu' && currentPlayer === CPU_COLOR && !gameOver;
}

/**
 * CPUの手を一定時間後に実行する関数
 *
 * 0.5秒待ってから手を選ぶことで「考えている」ように見せる。
 * 待機中は isAnimating = true にしてクリックを無効にする。
 */
function scheduleCpuMove() {
  // CPU思考中はクリックを無効にする
  isAnimating = true;

  // ターン表示を「CPU思考中...」に変える
  const turnDisplay = document.getElementById('turn-display');
  turnDisplay.textContent = '🤖 CPU思考中...';
  turnDisplay.style.color = '#aaaaaa';

  // 設定画面で選んだCPU思考時間だけ待ってからCPUの手を実行する
  // currentSettings.cpuThinkTime は settings.js で管理されている値
  // （短い：300ms / 普通：500ms / 長い：1000ms）
  setTimeout(() => {
    executeCpuMove();
  }, currentSettings.cpuThinkTime);
}

/**
 * CPUの手を実際に実行する汎用関数
 *
 * CPU対戦（白が自動で打つ）とCPU代理（任意の色を1手だけ代理）の
 * 両方から呼ばれる。引数で色と完了後の処理を切り替える。
 *
 * @param {number} color      - CPUが打つ色（BLACK または WHITE）
 * @param {Function} onComplete - 石を置いてターン交代した後に呼ぶコールバック関数
 */
function executeCpuMove(color = CPU_COLOR, onComplete = null) {
  // ゲームが終了していたら何もしない（念のため確認）
  if (gameOver) {
    isAnimating = false;
    isProxyMode = false;
    return;
  }

  // cpu.js の cpuSelectMove() を呼んで手を選ぶ
  // CPU対戦は cpuLevel（初級/中級）、代理は中級固定
  const level = (color === CPU_COLOR && gameMode === 'cpu') ? cpuLevel : 'medium';
  const move = cpuSelectMove(level, color);

  // 置ける場所がない場合（パスのケース）
  // ※ switchPlayer() でパス処理済みのはずだが念のため確認
  if (!move) {
    isAnimating = false;
    isProxyMode = false;
    if (onComplete) onComplete();
    return;
  }

  // パスメッセージを非表示にする
  hidePassMessage();

  // 石を置いてひっくり返す
  // （この中で lastPlaced と lastFlipped が更新される）
  placeStone(move.row, move.col);

  // 盤面を描画する（ハイライトは表示しない）
  // アニメーション中は置ける場所を表示しない
  renderBoard(false);

  // 石数表示のみ更新する（ターン表示はアニメーション後に switchPlayer() が更新する）
  const { black, white } = countStones();
  document.getElementById('black-count').textContent = `● 黒: ${black}`;
  document.getElementById('white-count').textContent = `○ 白: ${white}`;

  // アニメーションが見えるように 400ms 待ってからターン交代する
  setTimeout(() => {
    // 待機後は「直前の手」の情報をリセットする
    lastPlaced  = null;
    lastFlipped = [];

    // ゲーム終了チェック
    if (checkGameOver()) {
      renderBoard(false);
      isAnimating = false;
      isProxyMode = false;
      return;
    }

    // ターンを切り替える
    switchPlayer();

    // クリックロックを解除する
    isAnimating = false;
    isProxyMode = false;

    // 完了後のコールバックがあれば呼ぶ（代理完了後の処理など）
    if (onComplete) onComplete();

  }, 400);
}

/**
 * パスメッセージを表示する関数
 *
 * @param {string} message - 表示するメッセージ
 */
function showPassMessage(message) {
  const passMsg = document.getElementById('pass-message');
  passMsg.textContent = message;
  passMsg.classList.add('visible');
}

/**
 * パスメッセージを非表示にする関数
 */
function hidePassMessage() {
  const passMsg = document.getElementById('pass-message');
  passMsg.classList.remove('visible');
}


/* =============================================
   石数のカウントと画面表示の更新
   ============================================= */

/**
 * 黒・白の石数を数えて返す関数
 *
 * @returns {{ black: number, white: number }} 黒と白の石数
 */
function countStones() {
  let black = 0;
  let white = 0;

  // 全マスをループして石を数える
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col] === BLACK) {
        black++;
      } else if (board[row][col] === WHITE) {
        white++;
      }
    }
  }

  return { black, white };
}

/**
 * 画面上のターン表示・石数表示を最新の状態に更新する関数
 */
function updateStatus() {
  // ターン表示を更新する
  const turnDisplay = document.getElementById('turn-display');

  if (!gameOver) {
    if (currentPlayer === BLACK) {
      turnDisplay.textContent = '● 黒のターン';
      turnDisplay.style.color = '#e0e0e0';
    } else {
      turnDisplay.textContent = '○ 白のターン';
      turnDisplay.style.color = '#ffffff';
    }
  }

  // 石数を数えて表示を更新する
  const { black, white } = countStones();
  document.getElementById('black-count').textContent = `● 黒: ${black}`;
  document.getElementById('white-count').textContent = `○ 白: ${white}`;
}


/* =============================================
   ゲーム終了判定・結果表示
   ============================================= */

/**
 * ゲーム終了条件を確認する関数
 *
 * 終了条件：
 * - 黒・白どちらも置ける場所がない場合
 * - 盤面がすべて埋まった場合
 *
 * @returns {boolean} ゲームが終了した場合はtrue
 */
function checkGameOver() {
  // 黒・白それぞれの置ける場所を確認する
  const blackMoves = getValidMoves(BLACK);
  const whiteMoves = getValidMoves(WHITE);

  // 両者とも置ける場所がない場合はゲーム終了
  if (blackMoves.length === 0 && whiteMoves.length === 0) {
    gameOver = true;
    showResult();
    return true;
  }

  // 盤面がすべて埋まった場合もゲーム終了
  // （理論上は上の条件で先に終了するが、念のため確認する）
  let emptyCount = 0;
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col] === EMPTY) {
        emptyCount++;
      }
    }
  }
  if (emptyCount === 0) {
    gameOver = true;
    showResult();
    return true;
  }

  // まだゲームは続く
  return false;
}

/**
 * ゲーム終了時に勝敗結果を画面に表示する関数
 *
 * Phase 3 で追加：ゲーム終了時に戦績を localStorage に保存する。
 */
function showResult() {
  // 石数を数える
  const { black, white } = countStones();

  // 勝敗を判定してメッセージと結果コードを作る
  let resultText;
  let resultCode; // 'black' / 'white' / 'draw'（stats.js に渡す用）
  if (black > white) {
    resultText = `🎉 黒の勝ち！（黒: ${black} 対 白: ${white}）`;
    resultCode = 'black';
  } else if (white > black) {
    resultText = `🎉 白の勝ち！（黒: ${black} 対 白: ${white}）`;
    resultCode = 'white';
  } else {
    resultText = `🤝 引き分け！（黒: ${black} 対 白: ${white}）`;
    resultCode = 'draw';
  }

  // 結果表示エリアにテキストをセットして表示する（PC用・互換性維持）
  const resultDisplay = document.getElementById('result-display');
  resultDisplay.textContent = resultText;
  resultDisplay.classList.add('visible');

  // ターン表示を「ゲーム終了」に変える
  const turnDisplay = document.getElementById('turn-display');
  turnDisplay.textContent = 'ゲーム終了';
  turnDisplay.style.color = '#ffb74d'; // オレンジ色

  // パスメッセージを非表示にする
  hidePassMessage();

  // ゲーム終了時の効果音を鳴らす（sound.js）
  // isGameActive が true のとき（実際のゲームプレイ中）だけ鳴らす
  if (isGameActive) {
    playGameOverSound();
  }

  // ---- 勝敗モーダルを表示する ----
  showResultModal(resultCode, black, white);

  // ---- Phase 3 で追加した処理 ----
  // 対戦結果を localStorage に保存する（stats.js の関数を呼ぶ）
  saveGameResult({
    mode:       gameMode,   // 'local' または 'cpu'
    cpuLevel:   cpuLevel,   // 'easy' または 'medium'（2人対戦時は無視される）
    result:     resultCode, // 'black' / 'white' / 'draw'
    blackCount: black,
    whiteCount: white,
  });
}

/**
 * 勝敗モーダルを表示する関数
 *
 * @param {string} resultCode - 'black' / 'white' / 'draw'
 * @param {number} black      - 黒の石数
 * @param {number} white      - 白の石数
 */
function showResultModal(resultCode, black, white) {
  // 勝敗テキストを決定する
  // CPU対戦では「あなたの勝ち/負け」、2人対戦では「黒/白の勝ち」と表示する
  let modalText;
  if (resultCode === 'draw') {
    modalText = '🤝 引き分け！';
  } else if (gameMode === 'cpu') {
    // CPU対戦：黒（プレイヤー）が勝ったかどうかで判定
    modalText = (resultCode === 'black') ? '🎉 あなたの勝ち！' : '😢 あなたの負け…';
  } else {
    // 2人対戦
    modalText = (resultCode === 'black') ? '🎉 黒の勝ち！' : '🎉 白の勝ち！';
  }

  // モーダルの各要素を更新する
  document.getElementById('result-modal-text').textContent = modalText;
  document.getElementById('result-modal-black').textContent = `● 黒: ${black}`;
  document.getElementById('result-modal-white').textContent = `○ 白: ${white}`;

  // モーダルを表示する
  document.getElementById('result-modal').classList.remove('hidden');
}

/**
 * 勝敗モーダルを非表示にする関数
 */
function hideResultModal() {
  document.getElementById('result-modal').classList.add('hidden');
}


/* =============================================
   CPU代理機能（2人対戦専用）
   ============================================= */

/**
 * CPU代理ボタンの表示・非表示を切り替える関数
 *
 * 2人対戦モードのときだけボタンを表示する。
 * CPU対戦モードでは不要なので非表示にする。
 */
function updateProxyBtnVisibility() {
  const proxyBtn = document.getElementById('proxy-btn');
  if (gameMode === 'local') {
    proxyBtn.classList.remove('hidden');
  } else {
    proxyBtn.classList.add('hidden');
  }
}

/**
 * CPU代理ボタンの有効・無効を切り替える関数
 *
 * ゲーム終了時・アニメーション中・代理中は押せないようにする。
 *
 * @param {boolean} enabled - true なら有効、false なら無効（グレーアウト）
 */
function setProxyBtnEnabled(enabled) {
  const proxyBtn = document.getElementById('proxy-btn');
  if (!proxyBtn) return;
  proxyBtn.disabled = !enabled;
}

/**
 * 現在の手番をCPUに1手だけ代理させる関数
 *
 * 「CPUに任せる」ボタンが押されたときに呼ばれる。
 *
 * 処理の流れ：
 * 1. 操作できる状態かチェック（ゲーム終了・アニメーション中は無効）
 * 2. isProxyMode = true にしてクリックをロック
 * 3. ターン表示を「CPU思考中...」に変える
 * 4. 500ms 待機（考えているように見せる）
 * 5. executeCpuMove() で現在のプレイヤーの色を代理で打つ
 * 6. 完了後に isProxyMode = false でロック解除
 */
function startCpuProxy() {
  // ゲーム終了・アニメーション中・すでに代理中なら何もしない
  if (gameOver || isAnimating || isProxyMode) {
    return;
  }

  // 代理中フラグを立てる（この間は人間のクリックを無効にする）
  isProxyMode = true;

  // ボタンを無効化する
  setProxyBtnEnabled(false);

  // ターン表示を「CPU思考中...」に変える
  const turnDisplay = document.getElementById('turn-display');
  const playerName = currentPlayer === BLACK ? '黒' : '白';
  turnDisplay.textContent = `🤖 ${playerName}をCPUが代理中...`;
  turnDisplay.style.color = '#ce93d8'; // 紫系（代理専用の色）

  // 設定画面で選んだCPU思考時間だけ待ってから代理で打つ
  setTimeout(() => {
    // 現在のプレイヤーの色を代理で打つ
    // executeCpuMove() の第1引数に現在のプレイヤーの色を渡す
    executeCpuMove(currentPlayer, () => {
      // 代理完了後にボタンを再び有効化する
      setProxyBtnEnabled(true);
    });
  }, currentSettings.cpuThinkTime);
}


/* =============================================
   イベントリスナーの設定
   ============================================= */

// リセットボタン：選択中のモードを維持してゲームを最初からやり直す
document.getElementById('reset-btn').addEventListener('click', () => {
  initGame();
});

// 戦績ボタン：戦績モーダルを表示する
document.getElementById('stats-btn').addEventListener('click', () => {
  showStatsModal();
});

// CPU代理ボタン：現在の手番をCPUに1手だけ任せる（2人対戦専用）
document.getElementById('proxy-btn').addEventListener('click', () => {
  startCpuProxy();
});

// モード選択に戻るボタン
document.getElementById('back-btn').addEventListener('click', () => {
  backToModeSelect();
});

// 「2人対戦」ボタン：gameMode を 'local' にセットしてボタンの見た目を切り替える
document.getElementById('btn-local').addEventListener('click', () => {
  gameMode = 'local';
  // アクティブなボタンのスタイルを切り替える
  document.getElementById('btn-local').classList.add('mode-btn--active');
  document.getElementById('btn-cpu').classList.remove('mode-btn--active');
  // CPU強さ選択エリアを非表示にする（2人対戦では不要）
  document.getElementById('cpu-level-select').classList.add('hidden');
});

// 「CPU対戦」ボタン：gameMode を 'cpu' にセットしてボタンの見た目を切り替える
document.getElementById('btn-cpu').addEventListener('click', () => {
  gameMode = 'cpu';
  // アクティブなボタンのスタイルを切り替える
  document.getElementById('btn-cpu').classList.add('mode-btn--active');
  document.getElementById('btn-local').classList.remove('mode-btn--active');
  // CPU強さ選択エリアを表示する
  document.getElementById('cpu-level-select').classList.remove('hidden');
});

// 「初級」ボタン：cpuLevel を 'easy' にセットしてボタンの見た目を切り替える
document.getElementById('btn-easy').addEventListener('click', () => {
  cpuLevel = 'easy';
  document.getElementById('btn-easy').classList.add('level-btn--active');
  document.getElementById('btn-medium').classList.remove('level-btn--active');
  document.getElementById('btn-hard').classList.remove('level-btn--active');
});

// 「中級」ボタン：cpuLevel を 'medium' にセットしてボタンの見た目を切り替える
document.getElementById('btn-medium').addEventListener('click', () => {
  cpuLevel = 'medium';
  document.getElementById('btn-medium').classList.add('level-btn--active');
  document.getElementById('btn-easy').classList.remove('level-btn--active');
  document.getElementById('btn-hard').classList.remove('level-btn--active');
});

// 「上級」ボタン：cpuLevel を 'hard' にセットしてボタンの見た目を切り替える
document.getElementById('btn-hard').addEventListener('click', () => {
  cpuLevel = 'hard';
  document.getElementById('btn-hard').classList.add('level-btn--active');
  document.getElementById('btn-easy').classList.remove('level-btn--active');
  document.getElementById('btn-medium').classList.remove('level-btn--active');
});

// 「ゲーム開始」ボタン：モード選択を確定してゲームを開始する
document.getElementById('btn-start').addEventListener('click', () => {
  startGame();
});


/* =============================================
   ページ読み込み時の処理
   =============================================
   最初はモード選択画面を表示する。
   ゲーム画面は非表示のまま待機する。
   ============================================= */
// ページ読み込み時はモード選択画面を表示するだけ
// （startGame() が呼ばれるまでゲームは始まらない）

// ---- Phase 3 で追加したイベントリスナー ----

// 戦績モーダルの「✕」ボタン：モーダルを閉じる
document.getElementById('stats-close-btn').addEventListener('click', () => {
  hideStatsModal();
});

// 戦績モーダルの背景（オーバーレイ）：クリックで閉じる
document.getElementById('stats-overlay').addEventListener('click', () => {
  hideStatsModal();
});

// 戦績リセットボタン：確認ダイアログを出してから削除する
document.getElementById('stats-reset-btn').addEventListener('click', () => {
  resetStats();
});


/* =============================================
   遊び方モーダルの開閉
   ============================================= */

/**
 * 遊び方モーダルを表示する関数
 */
function showHelpModal() {
  document.getElementById('help-modal').classList.remove('hidden');
}

/**
 * 遊び方モーダルを非表示にする関数
 */
function hideHelpModal() {
  document.getElementById('help-modal').classList.add('hidden');
}

// モード選択画面の「遊び方」ボタン
document.getElementById('help-btn-mode').addEventListener('click', () => {
  showHelpModal();
});

// ゲーム画面の「遊び方」ボタン
document.getElementById('help-btn-game').addEventListener('click', () => {
  showHelpModal();
});

// 遊び方モーダルの「✕」ボタン
document.getElementById('help-close-btn').addEventListener('click', () => {
  hideHelpModal();
});

// 遊び方モーダルの背景（クリックで閉じる）
document.getElementById('help-overlay').addEventListener('click', () => {
  hideHelpModal();
});

// 遊び方モーダルの下部「閉じる」ボタン
document.getElementById('help-close-bottom-btn').addEventListener('click', () => {
  hideHelpModal();
});


/* =============================================
   勝敗モーダルのイベントリスナー
   ============================================= */

// 「✕」ボタン：モーダルだけ閉じる（ゲームは終了状態のまま）
document.getElementById('result-close-btn').addEventListener('click', () => {
  hideResultModal();
});

// 「もう一度遊ぶ」ボタン：モーダルを閉じて同じモードでリセット
document.getElementById('result-replay-btn').addEventListener('click', () => {
  hideResultModal();
  initGame();
});

// 「モード選択に戻る」ボタン：モーダルを閉じてモード選択画面へ
document.getElementById('result-back-btn').addEventListener('click', () => {
  backToModeSelect();
});


/* =============================================
   デバッグモード（?debug=1 のときだけ有効）
   =============================================
   URLに ?debug=1 が付いているときだけ、
   表示確認用のデバッグパネルを表示する。

   【確認できること】
   - パスメッセージの表示位置・アニメーション
   - 勝敗モーダルの表示内容・ボタン動作

   【注意】
   - パスメッセージテストはターン・盤面状態を変更しない
   - 勝敗モーダルテストは localStorage に保存しない
   - 通常アクセス時（?debug=1 なし）は一切表示されない
   ============================================= */

/**
 * ゲーム画面のデバッグモードを初期化する関数
 *
 * URLに ?debug=1 が付いているときだけ呼ばれる。
 * デバッグパネルを表示してイベントリスナーを設定する。
 */
function initGameDebugMode() {
  const panel = document.getElementById('game-debug-panel');
  if (!panel) return;

  // デバッグパネルを表示する
  panel.classList.remove('hidden');

  // 「パスメッセージ表示テスト」ボタン
  document.getElementById('debug-show-pass').addEventListener('click', () => {
    // ターン・盤面状態は変更せず、表示だけテストする
    showPassMessage('白は置ける場所がないため、パスします（テスト表示）');
    // 3秒後に自動で消す（実際のパス処理と同じ挙動）
    setTimeout(() => {
      hidePassMessage();
    }, 3000);
  });

  // 「勝敗モーダル表示テスト」ボタン
  document.getElementById('debug-show-result').addEventListener('click', () => {
    // localStorage への保存・ゲーム終了処理は行わず、表示だけテストする
    // showResultModal() を直接呼んでモーダルを表示する
    showResultModal('black', 40, 24);
  });

  console.log('[DEBUG] ゲームデバッグモードが有効です。表示確認ボタンが使えます。');
}

// URLのクエリパラメータを確認して ?debug=1 のときだけ有効にする
// stats.js の urlParams と同じ仕組みを使う
(function () {
  const params = new URLSearchParams(window.location.search);
  if (params.get('debug') === '1') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initGameDebugMode);
    } else {
      initGameDebugMode();
    }
  }
})();
