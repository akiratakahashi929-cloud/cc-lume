/**
 * CC Lume - Authentication Service
 * ログイン検証・ユーザー特定・セッション管理
 */

/**
 * セッショントークンを生成
 * @returns {string} UUID形式のトークン
 */
function generateSessionToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * セッションをキャッシュに保存
 * @param {string} token - セッショントークン
 * @param {Object} sessionData - セッションデータ
 */
function saveSession(token, sessionData) {
  const cache = CacheService.getScriptCache();
  const key = `session:${token}`;
  const data = JSON.stringify({
    ...sessionData,
    issuedAt: getNowISO()
  });
  cache.put(key, data, CONFIG.LIMITS.SESSION_TTL);
}

/**
 * セッションを取得
 * @param {string} token - セッショントークン
 * @returns {Object|null} セッションデータ
 */
function getSession(token) {
  if (!token) return null;
  
  const cache = CacheService.getScriptCache();
  const key = `session:${token}`;
  const data = cache.get(key);
  
  if (!data) return null;
  
  try {
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
}

/**
 * セッションを削除（ログアウト）
 * @param {string} token - セッショントークン
 */
function deleteSession(token) {
  if (!token) return;
  
  const cache = CacheService.getScriptCache();
  const key = `session:${token}`;
  cache.remove(key);
}

/**
 * セッションを延長
 * @param {string} token - セッショントークン
 */
function refreshSession(token) {
  const session = getSession(token);
  if (session) {
    saveSession(token, session);
  }
}

/**
 * ログイン処理
 * @param {Object} credentials - ログイン情報
 * @param {string} credentials.shareKey - 共有時発行キー
 * @param {string} credentials.gmail - Gmailアドレス
 * @param {string} credentials.password - パスワード
 * @returns {Object} ログイン結果
 */
function login(credentials) {
  try {
    const { shareKey, gmail, password } = credentials;
    
    // 入力検証
    if (!shareKey || !gmail || !password) {
      return {
        success: false,
        error: '必須項目が入力されていません'
      };
    }
    
    // 1. アカウント共有で gmail 検索（認証の主体をアカウント共有へ）
    const accountResult = findAccountByGmail(gmail);
    if (!accountResult) {
      return {
        success: false,
        error: CONFIG.ERRORS.USER_NOT_FOUND
      };
    }
    
    const accountData = accountResult.data;
    const accountRowIndex = accountResult.rowIndex;
    
    // 2. アカウント共有 Enable チェック（N列）
    if (!isEnabled(accountData[CONFIG.ACCOUNT_COLS.ENABLE])) {
      return {
        success: false,
        error: CONFIG.ERRORS.ACCOUNT_DISABLED
      };
    }
    
    // 3. 発行キー照合（O列）
    const storedShareKey = String(accountData[CONFIG.ACCOUNT_COLS.SHARE_KEY] || '').trim();
    if (storedShareKey !== String(shareKey).trim()) {
      return {
        success: false,
        error: '発行キーが一致しません'
      };
    }
    
    // 4. パスワード照合（C列）
    const storedPassword = String(accountData[CONFIG.ACCOUNT_COLS.PASSWORD] || '').trim();
    if (storedPassword !== String(password).trim()) {
      return {
        success: false,
        error: CONFIG.ERRORS.INVALID_PASSWORD
      };
    }
    
    // 5. Users A列で shareKey 検索（生成機能等のための関連付け）
    const userResult = findUserByShareKey(shareKey);
    if (!userResult) {
      return {
        success: false,
        error: CONFIG.ERRORS.USER_NOT_FOUND
      };
    }
    
    const userData = userResult.data;
    const userRowIndex = userResult.rowIndex;

    // Users Enabled チェック
    if (!isEnabled(userData[CONFIG.USERS_COLS.ENABLED])) {
      return {
        success: false,
        error: CONFIG.ERRORS.ACCOUNT_DISABLED
      };
    }
    
    // 6. FirstLoginDone 判定
    const isFirstLogin = !isEnabled(userData[CONFIG.USERS_COLS.FIRST_LOGIN_DONE]);
    
    // 7. セッショントークン発行
    const token = generateSessionToken();
    const sessionData = {
      shareKey: shareKey,
      lotNumber: accountData[CONFIG.ACCOUNT_COLS.LOT_NUMBER] || userData[CONFIG.USERS_COLS.LOT_NUMBER],
      gmail: gmail,
      userRowIndex: userRowIndex,
      accountRowIndex: accountRowIndex,
      isFirstLogin: isFirstLogin
    };
    saveSession(token, sessionData);
    
    // 8. LastLoginAt 更新
    updateUserRow(userRowIndex, {
      [CONFIG.USERS_COLS.LAST_LOGIN_AT]: getNowISO()
    });
    
    // 9. 監査ログ更新
    const existingLog = userData[CONFIG.USERS_COLS.AUDIT_LOG] || '';
    const newLog = appendAuditLog(existingLog, 'LOGIN', 'SUCCESS', gmail);
    updateUserRow(userRowIndex, {
      [CONFIG.USERS_COLS.AUDIT_LOG]: newLog
    });
    
    // アカウント情報を取得（初回表示・アカウント設計用）
    const accountInfo = {
      name: accountData[CONFIG.ACCOUNT_COLS.NAME],
      accountName: accountData[CONFIG.ACCOUNT_COLS.ACCOUNT_NAME],
      accountId: accountData[CONFIG.ACCOUNT_COLS.ACCOUNT_ID],
      bio: accountData[CONFIG.ACCOUNT_COLS.BIO],
      iconImage: convertDriveUrl(accountData[CONFIG.ACCOUNT_COLS.ICON_IMAGE]),
      banner: convertDriveUrl(accountData[CONFIG.ACCOUNT_COLS.BANNER]),
      experience: accountData[CONFIG.ACCOUNT_COLS.EXPERIENCE],
      inviteCode: accountData[CONFIG.ACCOUNT_COLS.INVITE_CODE] // P列: 招待コード
    };
    
    return {
      success: true,
      token: token,
      isFirstLogin: isFirstLogin,
      accountInfo: accountInfo,
      lotNumber: sessionData.lotNumber
    };
    
  } catch (error) {
    logError('login', error);
    return {
      success: false,
      error: 'ログイン処理中にエラーが発生しました'
    };
  }
}

/**
 * 初回ログイン完了処理（プレゼント受け取り後）
 * @param {string} token - セッショントークン
 * @returns {Object} 処理結果
 */
function completeFirstLogin(token) {
  try {
    const session = getSession(token);
    if (!session) {
      return {
        success: false,
        error: CONFIG.ERRORS.SESSION_EXPIRED
      };
    }
    
    // FirstLoginDone を TRUE に更新
    updateUserRow(session.userRowIndex, {
      [CONFIG.USERS_COLS.FIRST_LOGIN_DONE]: true,
      [CONFIG.USERS_COLS.FIRST_LOGIN_OLD]: true // 互換用も更新
    });
    
    // セッションを更新
    session.isFirstLogin = false;
    saveSession(token, session);
    
    return {
      success: true
    };
    
  } catch (error) {
    logError('completeFirstLogin', error);
    return {
      success: false,
      error: 'プレゼント受け取り処理中にエラーが発生しました'
    };
  }
}

/**
 * セッション検証
 * @param {string} token - セッショントークン
 * @returns {Object} 検証結果とセッションデータ
 */
function validateSession(token) {
  const session = getSession(token);
  if (!session) {
    return {
      valid: false,
      error: CONFIG.ERRORS.SESSION_EXPIRED
    };
  }
  
  // セッション延長
  refreshSession(token);
  
  return {
    valid: true,
    session: session
  };
}

/**
 * ログアウト処理
 * @param {string} token - セッショントークン
 * @returns {Object} 処理結果
 */
function logout(token) {
  deleteSession(token);
  return { success: true };
}

/**
 * 現在のユーザー情報を取得
 * @param {string} token - セッショントークン
 * @returns {Object} ユーザー情報
 */
function getCurrentUser(token) {
  try {
    const session = getSession(token);
    if (!session) {
      return {
        success: false,
        error: CONFIG.ERRORS.SESSION_EXPIRED
      };
    }
    
    // アカウント情報を再取得（最新データ）
    const accountResult = findAccountByGmail(session.gmail);
    if (!accountResult) {
      return {
        success: false,
        error: CONFIG.ERRORS.USER_NOT_FOUND
      };
    }
    
    const accountData = accountResult.data;
    
    // Users情報を取得
    const userResult = findUserByShareKey(session.shareKey);
    const userData = userResult ? userResult.data : null;
    
    return {
      success: true,
      user: {
        name: accountData[CONFIG.ACCOUNT_COLS.NAME],
        gmail: accountData[CONFIG.ACCOUNT_COLS.GMAIL],
        lotNumber: accountData[CONFIG.ACCOUNT_COLS.LOT_NUMBER],
        accountName: accountData[CONFIG.ACCOUNT_COLS.ACCOUNT_NAME],
        accountId: accountData[CONFIG.ACCOUNT_COLS.ACCOUNT_ID],
        bio: accountData[CONFIG.ACCOUNT_COLS.BIO],
        experience: accountData[CONFIG.ACCOUNT_COLS.EXPERIENCE],
        iconImage: convertDriveUrl(accountData[CONFIG.ACCOUNT_COLS.ICON_IMAGE]),
        banner: convertDriveUrl(accountData[CONFIG.ACCOUNT_COLS.BANNER]),
        xUrl: accountData[CONFIG.ACCOUNT_COLS.X_URL],
        todayCount: userData ? parseInt(userData[CONFIG.USERS_COLS.TODAY_COUNT]) || 0 : 0,
        totalCount: userData ? parseInt(userData[CONFIG.USERS_COLS.TOTAL_COUNT]) || 0 : 0
      }
    };
    
  } catch (error) {
    logError('getCurrentUser', error);
    return {
      success: false,
      error: 'ユーザー情報取得中にエラーが発生しました'
    };
  }
}

/**
 * ユーザー情報を更新（設定画面から）
 * @param {string} token - セッショントークン
 * @param {Object} updates - 更新内容
 * @returns {Object} 処理結果
 */
function updateUserProfile(token, updates) {
  try {
    const session = getSession(token);
    if (!session) {
      return {
        success: false,
        error: CONFIG.ERRORS.SESSION_EXPIRED
      };
    }
    
    const updateData = {};
    
    // 許可された項目のみ更新
    if (updates.accountName !== undefined) {
      updateData[CONFIG.ACCOUNT_COLS.ACCOUNT_NAME] = updates.accountName;
    }
    if (updates.accountId !== undefined) {
      updateData[CONFIG.ACCOUNT_COLS.ACCOUNT_ID] = updates.accountId;
    }
    if (updates.bio !== undefined) {
      updateData[CONFIG.ACCOUNT_COLS.BIO] = updates.bio;
    }
    if (updates.experience !== undefined) {
      updateData[CONFIG.ACCOUNT_COLS.EXPERIENCE] = updates.experience;
    }
    
    if (Object.keys(updateData).length > 0) {
      updateAccountRow(session.accountRowIndex, updateData);
    }
    
    return {
      success: true
    };
    
  } catch (error) {
    logError('updateUserProfile', error);
    return {
      success: false,
      error: 'プロフィール更新中にエラーが発生しました'
    };
  }
}
