/* =============================================
   オセロゲーム CPU AIロジック（cpu.js）
   =============================================

   このファイルにはCPUの思考ロジックが書かれています。
   初級・中級・上級（評価関数ベース）を実装しています。

   【難易度の違い】
   - 初級：置ける場所の中からランダムに選ぶ（戦略なし）
   - 中級：最も多くの石をひっくり返せる場所を選ぶ（貪欲法）
   - 上級：盤面の位置に点数をつけて、最も高い場所を選ぶ（評価関数）
           角 > 辺 > 通常 > 危険な場所 の優先順位で選ぶ

   【このファイルが使う外部の変数・関数】
   - board, BOARD_SIZE, BLACK, WHITE, EMPTY
     → script.js で定義されているゲーム状態変数
   - getValidMoves(player)
     → script.js で定義されている「置ける場所を返す関数」
   - getFlippedStones(board, row, col, player)
     → script.js で定義されている「ひっくり返る石を返す関数」

   ============================================= */


/**
 * 初級CPU：置ける場所の中からランダムに1つ選んで返す関数
 *
 * 【アルゴリズムの説明】
 * 1. 現在のCPUが置ける場所の一覧を取得する
 * 2. その中からランダムに1つ選ぶ
 * 3. 選んだ座標 { row, col } を返す
 *
 * ランダムに選ぶだけなので、戦略はまったくない。
 * 初心者でも勝てる難易度。
 *
 * @param {number} cpuColor - CPUが担当する色（BLACK または WHITE）
 * @returns {{ row: number, col: number } | null}
 *   選んだマスの座標。置ける場所がない場合は null を返す。
 */
function cpuEasy(cpuColor) {
  // CPUが置ける場所の一覧を取得する
  // getValidMoves は script.js で定義されている関数
  const validMoves = getValidMoves(cpuColor);

  // 置ける場所がない場合は null を返す（パス処理はscript.js側で行う）
  if (validMoves.length === 0) {
    return null;
  }

  // Math.random() は 0以上1未満のランダムな小数を返す
  // Math.floor() は小数点以下を切り捨てる
  // 例: validMoves.length が 5 の場合、0〜4 のランダムな整数が得られる
  const randomIndex = Math.floor(Math.random() * validMoves.length);

  // ランダムに選んだ座標を取り出す
  const [row, col] = validMoves[randomIndex];

  // 座標をオブジェクト形式で返す
  return { row, col };
}


/**
 * 中級CPU：最も多くの石をひっくり返せる場所を選ぶ関数（貪欲法）
 *
 * 【アルゴリズムの説明（貪欲法とは）】
 * 「今この瞬間に一番得をする選択をする」方法。
 * 将来のことは考えず、今すぐ最も多くの石をひっくり返せる場所を選ぶ。
 *
 * 具体的な手順：
 * 1. 置ける場所の一覧を取得する
 * 2. 各マスに置いたとき、何個の石をひっくり返せるか数える
 * 3. 最も多くひっくり返せるマスを選ぶ
 * 4. 同じ数のマスが複数ある場合は、その中からランダムに選ぶ
 *
 * 初級より強いが、角（隅）の重要性などは考慮しないため
 * 上級CPUには及ばない。
 *
 * @param {number} cpuColor - CPUが担当する色（BLACK または WHITE）
 * @returns {{ row: number, col: number } | null}
 *   選んだマスの座標。置ける場所がない場合は null を返す。
 */
function cpuMedium(cpuColor) {
  // CPUが置ける場所の一覧を取得する
  const validMoves = getValidMoves(cpuColor);

  // 置ける場所がない場合は null を返す
  if (validMoves.length === 0) {
    return null;
  }

  // 各マスに置いたときにひっくり返せる石の数を計算して、最大値を探す
  let maxFlipCount = -1; // 現時点での最大ひっくり返し数（-1で初期化）
  let bestMoves = [];    // 最大ひっくり返し数を達成できるマスの一覧

  for (const [row, col] of validMoves) {
    // このマスに置いたときにひっくり返る石の座標一覧を取得する
    // getFlippedStones は script.js で定義されている関数
    const flipped = getFlippedStones(board, row, col, cpuColor);

    // ひっくり返せる石の数
    const flipCount = flipped.length;

    if (flipCount > maxFlipCount) {
      // 今までの最大より多くひっくり返せる → 最大値を更新してリストをリセット
      maxFlipCount = flipCount;
      bestMoves = [[row, col]];

    } else if (flipCount === maxFlipCount) {
      // 今までの最大と同じ数 → リストに追加する（後でランダムに選ぶ）
      bestMoves.push([row, col]);
    }
    // flipCount < maxFlipCount の場合は何もしない（このマスは候補外）
  }

  // 最大ひっくり返し数を達成できるマスが複数ある場合は、ランダムに1つ選ぶ
  const randomIndex = Math.floor(Math.random() * bestMoves.length);
  const [row, col] = bestMoves[randomIndex];

  return { row, col };
}


/**
 * 上級CPU：評価関数で各マスに点数をつけて最善手を選ぶ関数
 *
 * 【アルゴリズムの説明（評価関数とは）】
 * 各マスに「置く価値」を表す点数をつけて、
 * 最も点数が高いマスを選ぶ方法。
 *
 * 【評価基準（点数の内訳）】
 * ① 位置ボーナス（マスの場所による固定点数）
 *   - 角（4隅）：+100点
 *     理由：角は一度取ると絶対にひっくり返されない最強の場所
 *   - 角の隣（X打ち・C打ち）：-30点
 *     理由：ここに置くと相手に角を取られやすくなる危険な場所
 *     ※ 角がすでに自分の石なら危険ではないが、簡易実装のため常に-30点
 *   - 辺（端の行・列）：+10点
 *     理由：辺は2方向からしか挟まれないため比較的安全
 *   - その他（内側のマス）：0点
 *
 * ② ひっくり返し数ボーナス
 *   - ひっくり返せる石1個につき +1点
 *
 * 合計点数が最も高いマスを選ぶ。
 * 同点のマスが複数ある場合はランダムに選ぶ。
 *
 * 【中級との違い】
 * 中級はひっくり返し数だけを見るが、
 * 上級は位置の価値も考慮するため、
 * 角を積極的に狙い、危険な場所を避ける。
 *
 * @param {number} cpuColor - CPUが担当する色（BLACK または WHITE）
 * @returns {{ row: number, col: number } | null}
 *   選んだマスの座標。置ける場所がない場合は null を返す。
 */
function cpuHard(cpuColor) {
  // CPUが置ける場所の一覧を取得する
  const validMoves = getValidMoves(cpuColor);

  // 置ける場所がない場合は null を返す
  if (validMoves.length === 0) {
    return null;
  }

  // 各マスの評価点を計算して、最高点のマスを探す
  let maxScore = -Infinity; // 現時点での最高点（-Infinity で初期化）
  let bestMoves = [];       // 最高点を達成できるマスの一覧

  for (const [row, col] of validMoves) {
    // このマスの評価点を計算する
    const score = evaluateMove(row, col, cpuColor);

    if (score > maxScore) {
      // 今までの最高点より高い → 最高点を更新してリストをリセット
      maxScore = score;
      bestMoves = [[row, col]];
    } else if (score === maxScore) {
      // 今までの最高点と同じ → リストに追加する（後でランダムに選ぶ）
      bestMoves.push([row, col]);
    }
  }

  // 最高点のマスが複数ある場合は、ランダムに1つ選ぶ
  const randomIndex = Math.floor(Math.random() * bestMoves.length);
  const [row, col] = bestMoves[randomIndex];

  return { row, col };
}

/**
 * 指定したマスに石を置いたときの評価点を計算する関数
 *
 * 位置ボーナス + ひっくり返し数ボーナス の合計を返す。
 *
 * @param {number} row      - 行番号（0〜7）
 * @param {number} col      - 列番号（0〜7）
 * @param {number} cpuColor - CPUが担当する色
 * @returns {number} 評価点（高いほど良い手）
 */
function evaluateMove(row, col, cpuColor) {
  let score = 0;

  // ---- ① 位置ボーナスを計算する ----

  // 角の座標（4隅）
  // 盤面は 0〜7 なので、角は (0,0)(0,7)(7,0)(7,7)
  const isCorner = (row === 0 || row === 7) && (col === 0 || col === 7);

  // 角の隣の座標（X打ち・C打ち）
  // 角の斜め隣（X打ち）：(1,1)(1,6)(6,1)(6,6)
  // 角の辺隣（C打ち）  ：(0,1)(1,0)(0,6)(6,0)(1,7)(7,1)(6,7)(7,6)
  const isNextToCorner =
    (row <= 1 && col <= 1) ||   // 左上の角周辺
    (row <= 1 && col >= 6) ||   // 右上の角周辺
    (row >= 6 && col <= 1) ||   // 左下の角周辺
    (row >= 6 && col >= 6);     // 右下の角周辺

  // 辺の座標（端の行・列）
  const isEdge = row === 0 || row === 7 || col === 0 || col === 7;

  if (isCorner) {
    // 角：最も価値が高い
    score += 100;
  } else if (isNextToCorner) {
    // 角の隣：危険な場所（角を相手に取られやすくなる）
    // ただし角自体は除く（isCorner が先に判定されるため問題なし）
    score -= 30;
  } else if (isEdge) {
    // 辺：比較的安全な場所
    score += 10;
  }
  // それ以外（内側のマス）：位置ボーナスなし（0点）

  // ---- ② ひっくり返し数ボーナスを計算する ----

  // このマスに置いたときにひっくり返る石の数を取得する
  const flipped = getFlippedStones(board, row, col, cpuColor);

  // ひっくり返せる石1個につき +1点
  score += flipped.length;

  return score;
}


/**
 * CPUの手を選んで返す関数（レベルに応じて呼び分ける）
 *
 * @param {string} level    - CPUのレベル（'easy' / 'medium' / 'hard'）
 * @param {number} cpuColor - CPUが担当する色（BLACK または WHITE）
 * @returns {{ row: number, col: number } | null} 選んだマスの座標
 */
function cpuSelectMove(level, cpuColor) {
  if (level === 'easy') {
    // 初級：ランダムに選ぶ
    return cpuEasy(cpuColor);
  }

  if (level === 'medium') {
    // 中級：最も多くひっくり返せる場所を選ぶ（貪欲法）
    return cpuMedium(cpuColor);
  }

  if (level === 'hard') {
    // 上級：評価関数で最も点数が高い場所を選ぶ
    return cpuHard(cpuColor);
  }

  // 未知のレベルが渡された場合は初級で対応する
  console.warn(`未知のCPUレベル: ${level}。初級で代替します。`);
  return cpuEasy(cpuColor);
}
