/* =============================================
   オセロゲーム 効果音管理（sound.js）
   =============================================

   このファイルでは Web Audio API を使って
   効果音を生成・再生します。
   外部の音声ファイルは使用しません。

   【再生する効果音】
   - playPlaceSound()    : 石を置いたときの音（短い「ポン」）
   - playFlipSound()     : 石をひっくり返したときの音（柔らかい「パタ」）
   - playGameOverSound() : ゲーム終了時の音（短いファンファーレ）

   【効果音のON/OFF制御】
   currentSettings.soundOn（settings.js で管理）を参照して
   OFF のときは何もしない。

   ============================================= */

/**
 * AudioContext を遅延生成して返す関数
 *
 * ブラウザのポリシーにより、ユーザー操作前に AudioContext を
 * 作成すると警告が出る場合があるため、初回呼び出し時に生成する。
 */
let _audioCtx = null;

function getAudioContext() {
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // suspended 状態（自動再生ポリシーで停止中）なら再開する
  if (_audioCtx.state === 'suspended') {
    _audioCtx.resume();
  }
  return _audioCtx;
}

/**
 * 効果音が有効かどうかを確認するヘルパー関数
 *
 * settings.js の currentSettings.soundOn を参照する。
 * Web Audio API が使えない環境でも安全に動作する。
 *
 * @returns {boolean} 効果音を再生すべきなら true
 */
function isSoundEnabled() {
  // currentSettings が未定義の場合（settings.js 読み込み前）は鳴らさない
  if (typeof currentSettings === 'undefined') return false;
  // soundOn が未定義の場合（古い設定データ）はデフォルト true
  if (typeof currentSettings.soundOn === 'undefined') return true;
  return currentSettings.soundOn;
}

/**
 * 石を置いたときの効果音を再生する関数
 *
 * 短い「ポン」という音。
 * 周波数 600Hz → 300Hz に急降下するサイン波（約80ms）。
 */
function playPlaceSound() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(600, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.08);

    gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.08);
  } catch (e) {
    // Web Audio API が使えない環境では無視する
  }
}

/**
 * 石をひっくり返したときの効果音を再生する関数
 *
 * 柔らかい「パタ」という音。
 * 周波数 400Hz → 200Hz に降下するサイン波（約120ms）。
 * 音量を抑えめにして石を置く音と区別する。
 */
function playFlipSound() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(400, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.12);

    gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.12);
  } catch (e) {
    // Web Audio API が使えない環境では無視する
  }
}

/**
 * ゲーム終了時の効果音を再生する関数
 *
 * 短いファンファーレ風の音。
 * ド（523Hz）→ ミ（659Hz）→ ソ（784Hz）の3音を順番に鳴らす。
 */
function playGameOverSound() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();

    // 3音の周波数と開始タイミングを定義する
    const notes = [
      { freq: 523, start: 0.0,  duration: 0.15 }, // ド
      { freq: 659, start: 0.15, duration: 0.15 }, // ミ
      { freq: 784, start: 0.3,  duration: 0.3  }, // ソ（少し長め）
    ];

    notes.forEach(({ freq, start, duration }) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, ctx.currentTime + start);

      gainNode.gain.setValueAtTime(0.0, ctx.currentTime + start);
      gainNode.gain.linearRampToValueAtTime(0.35, ctx.currentTime + start + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);

      oscillator.start(ctx.currentTime + start);
      oscillator.stop(ctx.currentTime + start + duration);
    });
  } catch (e) {
    // Web Audio API が使えない環境では無視する
  }
}
