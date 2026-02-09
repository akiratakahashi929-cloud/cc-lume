/**
 * CC Lume - Repository (Spreadsheet I/O)
 * スプレッドシートのまとめ読み・まとめ書き
 */

/**
 * スプレッドシートを取得
 */
function getSpreadsheet() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

/**
 * シートを取得（存在チェック付き）
 */
function getSheet(sheetName) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(CONFIG.ERRORS.SHEET_NOT_FOUND + sheetName);
  }
  return sheet;
}

/**
 * シート全データを配列で取得（ヘッダー含む）
 */
function getSheetData(sheetName) {
  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) {
    return [];
  }
  return sheet.getRange(1, 1, lastRow, lastCol).getValues();
}

/**
 * シートデータを取得（ヘッダー除く）
 */
function getSheetDataWithoutHeader(sheetName) {
  const data = getSheetData(sheetName);
  return data.slice(1);
}

// ========================================
// Users操作
// ========================================

/**
 * Users全データを取得
 */
function getAllUsers() {
  return getSheetDataWithoutHeader(CONFIG.SHEETS.USERS);
}

/**
 * 共有時発行キーでUsersの行を検索
 * @param {string} shareKey - 共有時発行キー
 * @returns {Object|null} { rowIndex, data }
 */
function findUserByShareKey(shareKey) {
  const data = getAllUsers();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][CONFIG.USERS_COLS.SHARE_KEY]).trim() === String(shareKey).trim()) {
      return {
        rowIndex: i + 2, // ヘッダー分+1、0-indexed→1-indexedで+1
        data: data[i]
      };
    }
  }
  return null;
}

/**
 * ロットナンバーでUsersの行を検索
 * @param {string} lotNumber - ロットナンバー
 * @returns {Object|null} { rowIndex, data }
 */
function findUserByLotNumber(lotNumber) {
  const data = getAllUsers();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][CONFIG.USERS_COLS.LOT_NUMBER]).trim() === String(lotNumber).trim()) {
      return {
        rowIndex: i + 2,
        data: data[i]
      };
    }
  }
  return null;
}

/**
 * Usersの特定行を更新
 * @param {number} rowIndex - 行番号（1-indexed）
 * @param {Object} updates - 更新内容 { colIndex: value, ... }
 */
function updateUserRow(rowIndex, updates) {
  const sheet = getSheet(CONFIG.SHEETS.USERS);
  for (const [colIndex, value] of Object.entries(updates)) {
    sheet.getRange(rowIndex, parseInt(colIndex) + 1).setValue(value);
  }
}

/**
 * Usersに新規行を追加
 * @param {Array} rowData - 行データ配列
 */
function appendUserRow(rowData) {
  const sheet = getSheet(CONFIG.SHEETS.USERS);
  sheet.appendRow(rowData);
}

// ========================================
// アカウント共有操作
// ========================================

/**
 * アカウント共有全データを取得
 */
function getAllAccounts() {
  return getSheetDataWithoutHeader(CONFIG.SHEETS.ACCOUNT_SHARE);
}

/**
 * Gmailでアカウント共有の行を検索
 * @param {string} gmail - Gmailアドレス
 * @returns {Object|null} { rowIndex, data }
 */
function findAccountByGmail(gmail) {
  const data = getAllAccounts();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][CONFIG.ACCOUNT_COLS.GMAIL]).trim().toLowerCase() === String(gmail).trim().toLowerCase()) {
      return {
        rowIndex: i + 2,
        data: data[i]
      };
    }
  }
  return null;
}

/**
 * ロットナンバーでアカウント共有の行を検索
 * @param {string} lotNumber - ロットナンバー
 * @returns {Object|null} { rowIndex, data }
 */
function findAccountByLotNumber(lotNumber) {
  const data = getAllAccounts();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][CONFIG.ACCOUNT_COLS.LOT_NUMBER]).trim() === String(lotNumber).trim()) {
      return {
        rowIndex: i + 2,
        data: data[i]
      };
    }
  }
  return null;
}

/**
 * 職業コードでアカウント共有からランダム抽出（フォールバック用）
 * @param {string} occupationCode - 職業コード（2桁）
 * @param {string} excludeLot - 除外するロット番号
 * @returns {Object|null} アカウントデータ
 */
function findRandomAccountByOccupation(occupationCode, excludeLot) {
  const data = getAllAccounts();
  const candidates = [];
  
  for (let i = 0; i < data.length; i++) {
    const lot = String(data[i][CONFIG.ACCOUNT_COLS.LOT_NUMBER] || '');
    const enable = data[i][CONFIG.ACCOUNT_COLS.ENABLE];
    
    // ロット3-4桁目が職業コードに一致し、Enable=TRUEで、除外ロット以外
    if (lot.length >= 4 && 
        lot.substring(2, 4) === occupationCode &&
        isEnabled(enable) &&
        lot !== excludeLot) {
      candidates.push(data[i]);
    }
  }
  
  if (candidates.length === 0) return null;
  
  // ランダム選択
  const randomIndex = Math.floor(Math.random() * candidates.length);
  return candidates[randomIndex];
}

/**
 * アカウント共有の特定行を更新
 * @param {number} rowIndex - 行番号（1-indexed）
 * @param {Object} updates - 更新内容 { colIndex: value, ... }
 */
function updateAccountRow(rowIndex, updates) {
  const sheet = getSheet(CONFIG.SHEETS.ACCOUNT_SHARE);
  for (const [colIndex, value] of Object.entries(updates)) {
    sheet.getRange(rowIndex, parseInt(colIndex) + 1).setValue(value);
  }
}

// ========================================
// Dictionary操作
// ========================================

/**
 * Dictionary全データを取得
 */
function getAllDictionary() {
  return getSheetDataWithoutHeader(CONFIG.SHEETS.DICTIONARY);
}

/**
 * ロットナンバーでDictionaryの行を検索
 * @param {string} lotNumber - ロットナンバー
 * @returns {Object|null} { rowIndex, data }
 */
function findDictionaryByLotNumber(lotNumber) {
  const data = getAllDictionary();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][CONFIG.DICTIONARY_COLS.LOT_NUMBER]).trim() === String(lotNumber).trim()) {
      return {
        rowIndex: i + 2,
        data: data[i]
      };
    }
  }
  return null;
}

/**
 * Dictionaryに新規行を追加
 * @param {Array} rowData - 行データ配列
 */
function appendDictionaryRow(rowData) {
  const sheet = getSheet(CONFIG.SHEETS.DICTIONARY);
  sheet.appendRow(rowData);
}

/**
 * Dictionaryの特定行を更新
 * @param {number} rowIndex - 行番号（1-indexed）
 * @param {Object} updates - 更新内容 { colIndex: value, ... }
 */
function updateDictionaryRow(rowIndex, updates) {
  const sheet = getSheet(CONFIG.SHEETS.DICTIONARY);
  for (const [colIndex, value] of Object.entries(updates)) {
    sheet.getRange(rowIndex, parseInt(colIndex) + 1).setValue(value);
  }
}

// ========================================
// 初回投稿型操作
// ========================================

/**
 * 初回投稿型全データを取得
 */
function getAllPostTypes() {
  return getSheetDataWithoutHeader(CONFIG.SHEETS.POST_TYPES);
}

/**
 * 戦略で初回投稿型を検索
 * @param {string} strategy - 戦略名（PARADOX/EMPATHY/PROOF）
 * @returns {Array} 該当する投稿型のリスト
 */
function findPostTypesByStrategy(strategy) {
  const data = getAllPostTypes();
  return data.filter(row => 
    String(row[CONFIG.POST_TYPES_COLS.STRATEGY]).toUpperCase() === strategy.toUpperCase()
  );
}

/**
 * type_idで初回投稿型を検索
 * @param {number|string} typeId - type_id
 * @returns {Object|null} 投稿型データ
 */
function findPostTypeById(typeId) {
  const data = getAllPostTypes();
  for (const row of data) {
    if (String(row[CONFIG.POST_TYPES_COLS.TYPE_ID]) === String(typeId)) {
      return row;
    }
  }
  return null;
}

// ========================================
// フォーム回答操作
// ========================================

/**
 * フォーム回答の最新行を取得
 * @returns {Array|null} 最新行データ
 */
function getLatestFormResponse() {
  const sheet = getSheet(CONFIG.SHEETS.FORM_RESPONSES);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  
  const lastCol = sheet.getLastColumn();
  return sheet.getRange(lastRow, 1, 1, lastCol).getValues()[0];
}

/**
 * フォーム回答のヘッダーを取得
 * @returns {Array} ヘッダー行
 */
function getFormResponseHeaders() {
  const sheet = getSheet(CONFIG.SHEETS.FORM_RESPONSES);
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0];
}

// ========================================
// ユーティリティ
// ========================================

/**
 * Enabled/Enableの値を判定
 * @param {*} value - チェック対象の値
 * @returns {boolean} 有効かどうか
 */
function isEnabled(value) {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const v = value.trim().toUpperCase();
    return v === 'TRUE' || v === '1' || v === 'YES' || v === 'ON';
  }
  return false;
}

/**
 * 共有時発行キーを生成（UUID形式）
 * @returns {string} 発行キー
 */
function generateShareKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = '';
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) key += '-';
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

/**
 * DriveリンクをViewable URLに変換
 * @param {string} url - DriveのURL
 * @returns {string} 変換後のURL
 */
function convertDriveUrl(url) {
  if (!url) return '';
  
  // fileId抽出パターン
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/open\?id=([a-zA-Z0-9_-]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      // 埋め込み表示に強い thumbnail 形式に変更 (sz=w1000 で高品質を維持)
      return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
    }
  }
  
  // 変換できない場合は元のURLを返す
  return url;
}

/**
 * 現在時刻をISO形式で取得
 * @returns {string} ISO形式の日時
 */
function getNowISO() {
  return new Date().toISOString();
}

/**
 * 監査ログを追記形式でフォーマット
 * @param {string} existing - 既存のログ
 * @param {string} action - アクション名
 * @param {string} status - ステータス
 * @param {string} message - メッセージ
 * @returns {string} 新しいログ
 */
function appendAuditLog(existing, action, status, message) {
  const timestamp = getNowISO();
  const newEntry = `${timestamp}|${action}|${status}|${message}`;
  
  // 最大5件を保持
  const entries = existing ? existing.split('\n') : [];
  entries.push(newEntry);
  while (entries.length > 5) {
    entries.shift();
  }
  
  return entries.join('\n');
}
