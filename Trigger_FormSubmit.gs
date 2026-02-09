/**
 * CC Lume - Form Submit Trigger
 * Googleフォーム送信→ロット生成→アカウント共有反映
 */

/**
 * フォーム送信時のトリガー関数
 * @param {Object} e - イベントオブジェクト
 */
function onFormSubmit(e) {
  const lock = LockService.getScriptLock();
  
  try {
    // ロック取得（同時実行対策）
    if (!lock.tryLock(CONFIG.LIMITS.LOCK_TIMEOUT)) {
      logError('onFormSubmit', new Error(CONFIG.ERRORS.LOCK_TIMEOUT));
      return;
    }
    
    // 最新行からデータ取得
    const formData = parseFormData(e);
    if (!formData) {
      logError('onFormSubmit', new Error('フォームデータの解析に失敗しました'));
      return;
    }
    
    // ロット番号生成
    const lotNumber = generateLotNumber(formData);
    
    // アカウント共有で Gmail一致行を検索
    const accountResult = findAccountByGmail(formData.gmail);
    if (!accountResult) {
      logError('onFormSubmit', new Error(`アカウントが見つかりません: ${formData.gmail}`));
      return;
    }
    
    // アカウント共有へ書込み
    updateAccountRow(accountResult.rowIndex, {
      [CONFIG.ACCOUNT_COLS.LOT_NUMBER]: lotNumber,
      [CONFIG.ACCOUNT_COLS.EXPERIENCE]: formData.experience
    });
    
    // Usersに共有時発行キーが未発行なら生成・保存
    const userResult = findUserByLotNumber(lotNumber);
    if (!userResult) {
      // 新規ユーザー作成
      const shareKey = generateShareKey();
      const newUserRow = createNewUserRow(shareKey, lotNumber);
      appendUserRow(newUserRow);
      
      // アカウント共有にも共有時発行キーを保存
      updateAccountRow(accountResult.rowIndex, {
        [CONFIG.ACCOUNT_COLS.SHARE_KEY]: shareKey
      });
    }
    
    // Dictionaryに初期データを作成（素材抽出）
    initializeDictionary(lotNumber, formData.name, formData.experience);
    
    console.log(`Form processed successfully: ${lotNumber}`);
    
  } catch (error) {
    logError('onFormSubmit', error);
  } finally {
    lock.releaseLock();
  }
}

/**
 * フォームデータを解析
 * @param {Object} e - イベントオブジェクト
 * @returns {Object|null} 解析されたフォームデータ
 */
function parseFormData(e) {
  try {
    // イベントオブジェクトから値を取得
    let values;
    if (e && e.values) {
      values = e.values;
    } else {
      // テスト用：最新行から取得
      const latestRow = getLatestFormResponse();
      if (!latestRow) return null;
      values = latestRow;
    }
    
    // ヘッダーを取得してマッピング
    const headers = getFormResponseHeaders();
    const dataMap = {};
    for (let i = 0; i < headers.length; i++) {
      dataMap[headers[i]] = values[i] || '';
    }
    
    // 必要なフィールドを抽出
    return {
      timestamp: values[0],
      ageGender: dataMap['年代性別（Q1）'] || dataMap['年代・性別'] || values[1] || '',
      occupation: dataMap['職業（Q2）'] || dataMap['職業'] || values[2] || '',
      mbti1: dataMap['MBTI質問1（Q3）'] || values[3] || '',
      mbti2: dataMap['MBTI質問2（Q4）'] || values[4] || '',
      mbti3: dataMap['MBTI質問3（Q5）'] || values[5] || '',
      mbti4: dataMap['MBTI質問4（Q6）'] || values[6] || '',
      hair: dataMap['髪型（Q7）'] || dataMap['髪型'] || values[7] || '',
      glasses: dataMap['眼鏡（Q8）'] || dataMap['眼鏡'] || values[8] || '',
      taste: dataMap['テイスト（Q9）'] || dataMap['テイスト'] || values[9] || '',
      item: dataMap['アイテム（Q10）'] || dataMap['アイテム'] || values[10] || '',
      experience: dataMap['体験・経験（Q11）'] || dataMap['体験・経験'] || values[11] || '',
      gmail: dataMap['Gmailアドレス（CC共通）'] || dataMap['Gmailアドレス'] || values[12] || '',
      password: dataMap['パスワード（CC共通）'] || dataMap['パスワード'] || values[13] || '',
      name: dataMap['氏名'] || ''
    };
    
  } catch (error) {
    logError('parseFormData', error);
    return null;
  }
}

/**
 * ロット番号を生成（11桁）
 * @param {Object} formData - フォームデータ
 * @returns {string} 11桁のロット番号
 */
function generateLotNumber(formData) {
  // 1桁目：年代コード
  const ageCode = getAgeCode(formData.ageGender);
  
  // 2桁目：性別コード
  const genderCode = getGenderCode(formData.ageGender);
  
  // 3-4桁目：職業コード
  const occupationCode = getOccupationCode(formData.occupation);
  
  // 5-6桁目：MBTIコード
  const mbtiCode = getMbtiCode(formData.mbti1, formData.mbti2, formData.mbti3, formData.mbti4);
  
  // 7桁目：髪型コード
  const hairCode = getHairCode(formData.hair);
  
  // 8桁目：眼鏡コード
  const glassesCode = getGlassesCode(formData.glasses);
  
  // 9桁目：テイストコード
  const tasteCode = getTasteCode(formData.taste);
  
  // 10桁目：アイテムコード（熟練モードチェック）
  const isSenior = isSeniorMode(formData.ageGender);
  const itemCode = isSenior ? '5' : getItemCode(formData.item);
  
  // 11桁目：ランダムコード
  const randomCode = String(Math.floor(Math.random() * 10));
  
  return `${ageCode}${genderCode}${occupationCode}${mbtiCode}${hairCode}${glassesCode}${tasteCode}${itemCode}${randomCode}`;
}

/**
 * 年代コードを取得
 * @param {string} ageGender - 年代性別の回答
 * @returns {string} 年代コード（1桁）
 */
function getAgeCode(ageGender) {
  const str = String(ageGender || '');
  
  if (str.includes('10代') || str.includes('20代')) return '2';
  if (str.includes('30代')) return '3';
  if (str.includes('40代') || str.includes('50代') || str.includes('60代') || str.includes('70代')) return '4';
  
  // デフォルト
  return '2';
}

/**
 * 性別コードを取得
 * @param {string} ageGender - 年代性別の回答
 * @returns {string} 性別コード（1桁）
 */
function getGenderCode(ageGender) {
  const str = String(ageGender || '');
  return str.includes('女') ? '2' : '1';
}

/**
 * 職業コードを取得
 * @param {string} occupation - 職業の回答
 * @returns {string} 職業コード（2桁）
 */
function getOccupationCode(occupation) {
  const str = String(occupation || '').trim();
  
  // 完全一致を優先
  if (CONFIG.LOT_MAPPING.OCCUPATION[str]) {
    return CONFIG.LOT_MAPPING.OCCUPATION[str];
  }
  
  // 部分一致を検索
  for (const [key, code] of Object.entries(CONFIG.LOT_MAPPING.OCCUPATION)) {
    if (str.includes(key) || key.includes(str)) {
      return code;
    }
  }
  
  // デフォルト
  return '09';
}

/**
 * MBTIコードを取得
 * @param {string} q1 - 質問1の回答
 * @param {string} q2 - 質問2の回答
 * @param {string} q3 - 質問3の回答
 * @param {string} q4 - 質問4の回答
 * @returns {string} MBTIコード（2桁）
 */
function getMbtiCode(q1, q2, q3, q4) {
  const parseAnswer = (answer) => {
    const str = String(answer || '').toUpperCase();
    if (str.includes('A') || str.includes('左') || str.includes('前者')) return 'A';
    if (str.includes('B') || str.includes('右') || str.includes('後者')) return 'B';
    return 'A'; // デフォルト
  };
  
  const combination = parseAnswer(q1) + parseAnswer(q2) + parseAnswer(q3) + parseAnswer(q4);
  return CONFIG.LOT_MAPPING.MBTI[combination] || '01';
}

/**
 * 髪型コードを取得
 * @param {string} hair - 髪型の回答
 * @returns {string} 髪型コード（1桁）
 */
function getHairCode(hair) {
  const str = String(hair || '').trim();
  
  for (const [key, code] of Object.entries(CONFIG.LOT_MAPPING.HAIR)) {
    if (str.includes(key)) {
      return code;
    }
  }
  
  return '5'; // その他
}

/**
 * 眼鏡コードを取得
 * @param {string} glasses - 眼鏡の回答
 * @returns {string} 眼鏡コード（1桁）
 */
function getGlassesCode(glasses) {
  const str = String(glasses || '');
  return str.includes('あり') ? '1' : '0';
}

/**
 * テイストコードを取得
 * @param {string} taste - テイストの回答
 * @returns {string} テイストコード（1桁）
 */
function getTasteCode(taste) {
  const str = String(taste || '').trim();
  
  for (const [key, code] of Object.entries(CONFIG.LOT_MAPPING.TASTE)) {
    if (str.includes(key)) {
      return code;
    }
  }
  
  return '5'; // ハイブリッド
}

/**
 * アイテムコードを取得
 * @param {string} item - アイテムの回答
 * @returns {string} アイテムコード（1桁）
 */
function getItemCode(item) {
  const str = String(item || '').trim();
  
  for (const [key, code] of Object.entries(CONFIG.LOT_MAPPING.ITEM)) {
    if (str.includes(key)) {
      return code;
    }
  }
  
  return '1'; // スマホ
}

/**
 * 熟練モード判定（50代以上）
 * @param {string} ageGender - 年代性別の回答
 * @returns {boolean} 熟練モードかどうか
 */
function isSeniorMode(ageGender) {
  const str = String(ageGender || '');
  return str.includes('50代') || str.includes('60代') || str.includes('70代');
}

/**
 * 新規ユーザー行を作成
 * @param {string} shareKey - 共有時発行キー
 * @param {string} lotNumber - ロットナンバー
 * @returns {Array} 新規ユーザー行データ
 */
function createNewUserRow(shareKey, lotNumber) {
  const row = [];
  row[CONFIG.USERS_COLS.SHARE_KEY] = shareKey;
  row[CONFIG.USERS_COLS.LOT_NUMBER] = lotNumber;
  row[CONFIG.USERS_COLS.FIRST_LOGIN_OLD] = false;
  row[CONFIG.USERS_COLS.ENABLED] = true;
  row[CONFIG.USERS_COLS.FIRST_LOGIN_DONE] = false;
  row[CONFIG.USERS_COLS.LAST_LOGIN_AT] = '';
  row[CONFIG.USERS_COLS.TODAY_COUNT] = 0;
  row[CONFIG.USERS_COLS.TODAY_DATE_KEY] = '';
  row[CONFIG.USERS_COLS.TOTAL_COUNT] = 0;
  row[CONFIG.USERS_COLS.LAST_GENERATE_AT] = '';
  row[CONFIG.USERS_COLS.LAST_ERROR] = '';
  row[CONFIG.USERS_COLS.AUDIT_LOG] = appendAuditLog('', 'CREATE', 'SUCCESS', `lot:${lotNumber}`);
  
  return row;
}

/**
 * Dictionaryに初期データを作成
 * @param {string} lotNumber - ロットナンバー
 * @param {string} name - 氏名
 * @param {string} experience - 体験・経験（原文）
 */
function initializeDictionary(lotNumber, name, experience) {
  // 既存チェック
  const existing = findDictionaryByLotNumber(lotNumber);
  if (existing) {
    // 更新
    updateDictionaryRow(existing.rowIndex, {
      [CONFIG.DICTIONARY_COLS.NAME]: name
    });
    return;
  }
  
  // 新規作成（素材は後でユーザーが編集）
  const row = [];
  row[CONFIG.DICTIONARY_COLS.NAME] = name;
  row[CONFIG.DICTIONARY_COLS.LOT_NUMBER] = lotNumber;
  row[CONFIG.DICTIONARY_COLS.FACTS] = '';
  row[CONFIG.DICTIONARY_COLS.NUMBERS] = '';
  row[CONFIG.DICTIONARY_COLS.EFFORTS] = '';
  row[CONFIG.DICTIONARY_COLS.EMOTIONS] = '';
  row[CONFIG.DICTIONARY_COLS.AESTHETICS] = '';
  row[CONFIG.DICTIONARY_COLS.PUNCHLINE] = '';
  
  appendDictionaryRow(row);
}

/**
 * テスト用：手動でフォーム処理を実行
 */
function testFormSubmit() {
  onFormSubmit(null);
}
