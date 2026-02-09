/**
 * CC Lume - Web Application
 * Webアプリエントリーポイント（doGet / google.script.run用API）
 */

/**
 * WebアプリのPOSTリクエストハンドラ (Vercel等の外部API用)
 * @param {Object} e - イベントオブジェクト
 * @returns {TextOutput} JSONレスポンス
 */
function doPost(e) {
  let params;
  try {
    params = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Invalid JSON'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  const action = params.action;
  const payload = params.payload || {};
  let result;

  try {
    // API関数の動的呼び出し
    switch (action) {
      case 'apiLogin':
        result = apiLogin(payload.shareKey, payload.gmail, payload.password);
        break;
      case 'apiGetStartupItems':
        result = apiGetStartupItems(payload.shareKey);
        break;
      case 'apiGetDashboard':
        result = apiGetDashboard(payload.token);
        break;
      case 'apiGetStrategyGuide':
        result = apiGetStrategyGuide(payload.token);
        break;
      case 'apiGeneratePosts':
        result = apiGeneratePosts(payload.token, payload.theme, payload.target, payload.templateData);
        break;
      case 'apiUpdateDictionary':
        result = apiUpdateDictionary(payload.token, payload.updates);
        break;
      case 'apiGetDictionary':
        result = apiGetDictionary(payload.token);
        break;
      case 'apiCompleteFirstLogin':
        result = apiCompleteFirstLogin(payload.token);
        break;
      case 'apiLogout':
        result = apiLogout(payload.token);
        break;
      case 'apiValidateSession':
        result = apiValidateSession(payload.token);
        break;
      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { success: false, error: err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * WebアプリのGETリクエストハンドラ
 * @param {Object} e - イベントオブジェクト
 * @returns {HtmlOutput} HTMLページ
 */
function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Ui_Index');
  
  // 初期データを埋め込み
  template.initialConfig = JSON.stringify({
    strategies: CONFIG.STRATEGIES,
    dailyLimit: CONFIG.LIMITS.DAILY_GENERATE,
    features: CONFIG.FEATURES
  });
  
  return template.evaluate()
    .setTitle('CC Lume - X Post Generator')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * HTMLファイルをインクルード（テンプレート用）
 * @param {string} filename - ファイル名
 * @returns {string} HTMLコンテンツ
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ========================================
// google.script.run 用 API関数
// ========================================

/**
 * ログインAPI
 * @param {string} shareKey - 発行キー
 * @param {string} gmail - Gmail
 * @param {string} password - パスワード
 * @returns {Object} ログイン結果
 */
function apiLogin(shareKey, gmail, password) {
  if (arguments.length === 1 && typeof shareKey === 'object') {
    const p = shareKey;
    shareKey = p.shareKey;
    gmail = p.gmail;
    password = p.password;
  }
  return login({ shareKey, gmail, password });
}

/**
 * スタートアップアイテム（アカウント設計情報）取得API
 * @param {string} shareKey - 共有時発行キー
 * @returns {Object} アカウント情報
 */
function apiGetStartupItems(shareKey) {
  if (arguments.length === 1 && typeof shareKey === 'object') {
    shareKey = shareKey.shareKey;
  }
  try {
    const accountResult = getAllAccounts();
    const accountRow = accountResult.find(row => 
      String(row[CONFIG.ACCOUNT_COLS.SHARE_KEY]).trim() === String(shareKey).trim()
    );

    if (!accountRow) {
      return { success: false, error: 'アカウントが見つかりません' };
    }

    return {
      success: true,
      accountName: accountRow[CONFIG.ACCOUNT_COLS.ACCOUNT_NAME],
      xId: accountRow[CONFIG.ACCOUNT_COLS.ACCOUNT_ID],
      bio: accountRow[CONFIG.ACCOUNT_COLS.BIO],
      bannerUrl: convertDriveUrl(accountRow[CONFIG.ACCOUNT_COLS.BANNER]),
      iconUrl: convertDriveUrl(accountRow[CONFIG.ACCOUNT_COLS.ICON_IMAGE]),
      inviteCode: accountRow[CONFIG.ACCOUNT_COLS.INVITE_CODE]
    };
  } catch (error) {
    logError('apiGetStartupItems', error);
    return { success: false, error: '取得エラーが発生しました' };
  }
}

/**
 * ログアウトAPI
 * @param {string} token - セッショントークン
 * @returns {Object} 処理結果
 */
function apiLogout(token) {
  return logout(token);
}

/**
 * 初回ログイン完了API
 * @param {string} token - セッショントークン
 * @returns {Object} 処理結果
 */
function apiCompleteFirstLogin(token) {
  return completeFirstLogin(token);
}

/**
 * セッション検証API
 * @param {string} token - セッショントークン
 * @returns {Object} 検証結果
 */
function apiValidateSession(token) {
  return validateSession(token);
}

/**
 * 現在のユーザー情報取得API
 * @param {string} token - セッショントークン
 * @returns {Object} ユーザー情報
 */
function apiGetCurrentUser(token) {
  return getCurrentUser(token);
}

/**
 * ユーザープロフィール更新API
 * @param {string} token - セッショントークン
 * @param {Object} updates - 更新内容
 * @returns {Object} 処理結果
 */
function apiUpdateUserProfile(token, updates) {
  if (arguments.length === 1 && typeof token === 'object') {
    const p = token;
    token = p.token;
    updates = p.updates;
  }
  return updateUserProfile(token, updates);
}

/**
 * 今日の戦略情報取得API
 * @param {string} token - セッショントークン
 * @returns {Object} 戦略情報
 */
function apiGetTodayStrategyInfo(token) {
  return getTodayStrategyInfo(token);
}

/**
 * 投稿生成API
 * @param {string} token - セッショントークン
 * @param {Object} params - 生成パラメータ
 * @returns {Object} 生成結果
 */
function apiGeneratePosts(token, params) {
  if (arguments.length === 1 && typeof token === 'object') {
    const p = token;
    token = p.token;
    params = p.params || p; // ネストしていてもいなくても対応
  }
  return generatePosts(token, params);
}

/**
 * 穴埋めテンプレート取得API
 * @param {string} strategy - 戦略名
 * @returns {Object} テンプレート情報
 */
function apiGetTemplate(strategy) {
  return getTemplateForStrategy(strategy);
}

/**
 * 投稿前チェックAPI
 * @param {string} text - 投稿文
 * @returns {Object} チェック結果
 */
function apiFinalCheck(text) {
  return finalCheckBeforePost(text);
}

/**
 * Dictionary取得API
 * @param {string} token - セッショントークン
 * @returns {Object} Dictionary情報
 */
function apiGetDictionary(token) {
  try {
    const sessionResult = validateSession(token);
    if (!sessionResult.valid) {
      return {
        success: false,
        error: sessionResult.error
      };
    }
    
    const dictResult = findDictionaryByLotNumber(sessionResult.session.lotNumber);
    if (!dictResult) {
      return {
        success: true,
        dictionary: {
          facts: '',
          numbers: '',
          efforts: '',
          emotions: '',
          aesthetics: '',
          punchline: ''
        }
      };
    }
    
    const data = dictResult.data;
    return {
      success: true,
      dictionary: {
        facts: data[CONFIG.DICTIONARY_COLS.FACTS] || '',
        numbers: data[CONFIG.DICTIONARY_COLS.NUMBERS] || '',
        efforts: data[CONFIG.DICTIONARY_COLS.EFFORTS] || '',
        emotions: data[CONFIG.DICTIONARY_COLS.EMOTIONS] || '',
        aesthetics: data[CONFIG.DICTIONARY_COLS.AESTHETICS] || '',
        punchline: data[CONFIG.DICTIONARY_COLS.PUNCHLINE] || ''
      }
    };
    
  } catch (error) {
    logError('apiGetDictionary', error);
    return {
      success: false,
      error: 'Dictionary取得中にエラーが発生しました'
    };
  }
}

/**
 * Dictionary更新API
 * @param {string} token - セッショントークン
 * @param {Object} updates - 更新内容
 * @returns {Object} 処理結果
 */
function apiUpdateDictionary(token, updates) {
  if (arguments.length === 1 && typeof token === 'object') {
    const p = token;
    token = p.token;
    updates = p.updates;
  }
  try {
    const sessionResult = validateSession(token);
    if (!sessionResult.valid) {
      return {
        success: false,
        error: sessionResult.error
      };
    }
    
    const dictResult = findDictionaryByLotNumber(sessionResult.session.lotNumber);
    if (!dictResult) {
      // 新規作成
      const row = [];
      row[CONFIG.DICTIONARY_COLS.NAME] = '';
      row[CONFIG.DICTIONARY_COLS.LOT_NUMBER] = sessionResult.session.lotNumber;
      row[CONFIG.DICTIONARY_COLS.FACTS] = updates.facts || '';
      row[CONFIG.DICTIONARY_COLS.NUMBERS] = updates.numbers || '';
      row[CONFIG.DICTIONARY_COLS.EFFORTS] = updates.efforts || '';
      row[CONFIG.DICTIONARY_COLS.EMOTIONS] = updates.emotions || '';
      row[CONFIG.DICTIONARY_COLS.AESTHETICS] = updates.aesthetics || '';
      row[CONFIG.DICTIONARY_COLS.PUNCHLINE] = updates.punchline || '';
      appendDictionaryRow(row);
    } else {
      // 更新
      const updateData = {};
      if (updates.facts !== undefined) updateData[CONFIG.DICTIONARY_COLS.FACTS] = updates.facts;
      if (updates.numbers !== undefined) updateData[CONFIG.DICTIONARY_COLS.NUMBERS] = updates.numbers;
      if (updates.efforts !== undefined) updateData[CONFIG.DICTIONARY_COLS.EFFORTS] = updates.efforts;
      if (updates.emotions !== undefined) updateData[CONFIG.DICTIONARY_COLS.EMOTIONS] = updates.emotions;
      if (updates.aesthetics !== undefined) updateData[CONFIG.DICTIONARY_COLS.AESTHETICS] = updates.aesthetics;
      if (updates.punchline !== undefined) updateData[CONFIG.DICTIONARY_COLS.PUNCHLINE] = updates.punchline;
      
      updateDictionaryRow(dictResult.rowIndex, updateData);
    }
    
    return { success: true };
    
  } catch (error) {
    logError('apiUpdateDictionary', error);
    return {
      success: false,
      error: 'Dictionary更新中にエラーが発生しました'
    };
  }
}

/**
 * ガイドブック情報取得API
 * @returns {Object} ガイドブック情報
 */
function apiGetGuidebook() {
  return {
    success: true,
    pages: [
      {
        id: 1,
        theme: 'CC Lume 使い方ガイド',
        subTheme: 'X投稿ポストを迷わず作れるようにします',
        content: '皆さん こんにちは！\nこのガイドでは「このアプリで何ができるか」と「今日からの使い方」を短く分かりやすくまとめます。\n\nこのページで覚えること：ここを読めば すぐ投稿が作れます'
      },
      {
        id: 2,
        theme: '投稿作成をアプリ内で完結',
        subTheme: 'Xは「貼る場所」 ここは「作る場所」です',
        content: '1. 投稿のテーマとターゲットを入力します\n2. A案/B案が2つ出ます\n3. 画面で編集して コピーして投稿します\n\nこのページで覚えること：投稿はここで作って Xには貼るだけ'
      },
      {
        id: 3,
        theme: '誰でもかんたん投稿手順',
        subTheme: '迷うポイントを減らして 継続力UP',
        content: '・書き方の形（テンプレ）が見えるので、書き始めやすいです\n・文章は編集して仕上げられます\n・使うほど「辞書」に素材がたまって楽になります\n\nこのページで覚えること：続けるほど 作る時間が短くなります'
      },
      {
        id: 4,
        theme: '今日は 何を書く日？',
        subTheme: '迷いなく 書くことができる',
        content: '月/金：PARADOX（逆説）\n火/木/日：EMPATHY（共感）\n水/土：PROOF（実証）\n\n画面の上に「今日の戦略」が表示されます\n\nこのページで覚えること：まずは今日の戦略どおりに作ればOKです'
      },
      {
        id: 5,
        theme: '入力項目は2つだけ',
        subTheme: 'テーマ / ターゲット のみで生成',
        content: '1.「ターゲット」を入力します（例：副業初心者）\n2.「テーマ」を入力します（例：審査に落ちた体験）\n3.「A/Bを作る」を押します\n4. A案/B案が表示されます\n\nこのページで覚えること：入力→生成→A/B確認、ここまで一気に進めます'
      },
      {
        id: 6,
        theme: 'A/Bを元に 投稿文を完成させましょう',
        subTheme: '文字数に注意で 画面仕上げ',
        content: '・A案/B案の文章は編集できます\n・140文字を超えると注意が出ます\n・「テンプレA/Bから本文へ反映」を押すと本文欄へ入ります\n\nこのページで覚えること：編集して完成したら コピーして投稿できます'
      },
      {
        id: 7,
        theme: '投稿直前の動きも CC Lumeで完結',
        subTheme: 'リプ欄操作もラクチン',
        content: '・「＋リプを追加」で140文字のリプ欄が増えます\n・「メイン投稿をコピー」「リプ1をコピー」「リプ全部をコピー」があります\n・コピーしたら、Xに貼り付けて送信するだけです\n\nこのページで覚えること：X上で考えず、コピーして貼るだけにします'
      },
      {
        id: 8,
        theme: '続けるための3つのルール',
        subTheme: 'これを守るとムダがなくなる',
        content: '1. 1日の生成は3回までです（上限に達すると止まります）\n2.【 】が残っていたら 投稿前に必ず埋めてください\n3. 一般的な話だけで終わらず 数字か具体例を1つ入れてください\n\nそれでは 今からやってみましょう\n✅「Post Studio」を開いて ターゲットとテーマを入力してください'
      }
    ]
  };
}

/**
 * ヒント情報取得API（ホバー用）
 * @param {string} category - カテゴリ
 * @returns {Object} ヒント情報
 */
function apiGetHints(category) {
  const hints = {
    experience: [
      'その時、誰にどう思われた？',
      '一番きつかった瞬間はどこ？',
      '今なら、当時の自分に何と言う？'
    ],
    emotion: [
      '我慢していたことは？',
      '言えなかった本音は？',
      '逃げたかった瞬間は？'
    ],
    learning: [
      '数字で言うと何が変わった？',
      '行動を1つに絞るなら？',
      '逆に「やらなくていい」と思ったことは？'
    ],
    common: [
      '一番最初に諦めかけた瞬間は？',
      'それでも続けた理由は？',
      '誰にも言っていない失敗は？'
    ]
  };
  
  return {
    success: true,
    hints: hints[category] || hints.common
  };
}
