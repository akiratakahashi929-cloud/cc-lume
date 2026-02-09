/**
 * CC Lume - Logger
 * エラーログ・監査ログ管理
 */

/**
 * エラーをログ出力
 * @param {string} functionName - 関数名
 * @param {Error} error - エラーオブジェクト
 */
function logError(functionName, error) {
  const timestamp = getNowISO();
  const message = error.message || String(error);
  const stack = error.stack || '';
  
  // コンソールログ
  console.error(`[${timestamp}] ${functionName}: ${message}`);
  if (stack) {
    console.error(stack);
  }
  
  // Script Propertiesにも記録（直近のエラーのみ）
  try {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('LAST_ERROR', JSON.stringify({
      timestamp,
      function: functionName,
      message,
      stack: stack.substring(0, 500) // 長すぎる場合は切り詰め
    }));
  } catch (e) {
    // Properties書き込み失敗は無視
  }
}

/**
 * 情報ログを出力
 * @param {string} functionName - 関数名
 * @param {string} message - メッセージ
 */
function logInfo(functionName, message) {
  const timestamp = getNowISO();
  console.log(`[${timestamp}] ${functionName}: ${message}`);
}

/**
 * 警告ログを出力
 * @param {string} functionName - 関数名
 * @param {string} message - メッセージ
 */
function logWarn(functionName, message) {
  const timestamp = getNowISO();
  console.warn(`[${timestamp}] ${functionName}: ${message}`);
}

/**
 * デバッグログを出力（開発時のみ）
 * @param {string} functionName - 関数名
 * @param {*} data - デバッグデータ
 */
function logDebug(functionName, data) {
  // 本番では無効化（必要に応じてコメントアウト）
  const timestamp = getNowISO();
  console.log(`[DEBUG ${timestamp}] ${functionName}:`, JSON.stringify(data, null, 2));
}

/**
 * 直近のエラーを取得
 * @returns {Object|null} エラー情報
 */
function getLastError() {
  try {
    const props = PropertiesService.getScriptProperties();
    const errorJson = props.getProperty('LAST_ERROR');
    if (errorJson) {
      return JSON.parse(errorJson);
    }
  } catch (e) {
    // 無視
  }
  return null;
}

/**
 * エラーログをクリア
 */
function clearLastError() {
  try {
    const props = PropertiesService.getScriptProperties();
    props.deleteProperty('LAST_ERROR');
  } catch (e) {
    // 無視
  }
}

/**
 * 監査ログを記録（重要操作用）
 * @param {Object} params - パラメータ
 * @param {string} params.action - アクション名
 * @param {string} params.shareKey - ユーザー識別子
 * @param {string} params.lotNumber - ロット番号
 * @param {string} params.status - ステータス
 * @param {string} params.message - メッセージ
 */
function recordAudit(params) {
  const { action, shareKey, lotNumber, status, message } = params;
  const timestamp = getNowISO();
  
  // ログ出力
  const logMessage = `${timestamp}|${action}|${shareKey || '-'}|${lotNumber || '-'}|${status}|${message}`;
  console.log(`[AUDIT] ${logMessage}`);
  
  // 必要に応じて別シートに記録（大規模運用時）
  // recordToAuditSheet(logMessage);
}

/**
 * パフォーマンス計測開始
 * @param {string} label - ラベル
 * @returns {Object} タイマーオブジェクト
 */
function startTimer(label) {
  return {
    label,
    startTime: new Date().getTime()
  };
}

/**
 * パフォーマンス計測終了
 * @param {Object} timer - タイマーオブジェクト
 */
function endTimer(timer) {
  const endTime = new Date().getTime();
  const duration = endTime - timer.startTime;
  console.log(`[PERF] ${timer.label}: ${duration}ms`);
  return duration;
}

/**
 * エラーをユーザーフレンドリーなメッセージに変換
 * @param {Error|string} error - エラー
 * @returns {string} ユーザー向けメッセージ
 */
function toUserFriendlyError(error) {
  const message = error.message || String(error);
  
  // 既知のエラーパターンをマッピング
  const errorMap = {
    'SHEET_NOT_FOUND': 'システムエラーが発生しました。管理者にお問い合わせください。',
    'COLUMN_MISMATCH': 'データ構造に問題があります。管理者にお問い合わせください。',
    'quota': 'APIの利用制限に達しました。しばらく待ってから再度お試しください。',
    'timeout': '処理がタイムアウトしました。再度お試しください。',
    'network': 'ネットワークエラーが発生しました。接続を確認してください。'
  };
  
  for (const [key, friendlyMessage] of Object.entries(errorMap)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      return friendlyMessage;
    }
  }
  
  // 汎用メッセージ
  return 'エラーが発生しました。再度お試しください。';
}
