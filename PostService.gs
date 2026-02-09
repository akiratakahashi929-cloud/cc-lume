/**
 * CC Lume - Post Service
 * 投稿生成サービス（生成回数制限・戦略決定・素材取得）
 */

/**
 * 投稿を生成
 * @param {string} token - セッショントークン
 * @param {Object} params - 生成パラメータ
 * @param {string} params.theme - テーマ（必須）
 * @param {string} params.target - ターゲット（必須）
 * @param {string} [params.strategy] - 戦略（指定がなければ曜日固定）
 * @returns {Object} 生成結果
 */
function generatePosts(token, params) {
  const lock = LockService.getScriptLock();
  
  try {
    // ロック取得
    if (!lock.tryLock(CONFIG.LIMITS.LOCK_TIMEOUT)) {
      return {
        success: false,
        error: CONFIG.ERRORS.LOCK_TIMEOUT
      };
    }
    
    // セッション検証
    const sessionResult = validateSession(token);
    if (!sessionResult.valid) {
      return {
        success: false,
        error: sessionResult.error
      };
    }
    const session = sessionResult.session;
    
    // 入力検証
    const validationResult = validateGenerateParams(params);
    if (!validationResult.valid) {
      return {
        success: false,
        error: validationResult.error
      };
    }
    
    // 生成回数チェック・リセット
    const limitResult = checkAndUpdateDailyLimit(session);
    if (!limitResult.allowed) {
      return {
        success: false,
        error: CONFIG.ERRORS.DAILY_LIMIT_REACHED,
        remainingCount: 0
      };
    }
    
    // 戦略決定（指定がなければ曜日固定）
    const strategy = params.strategy || getTodayStrategy();
    
    // 体験・経験を取得
    const experienceResult = getExperienceForGeneration(session);
    
    // 投稿型を取得
    const postTypes = findPostTypesByStrategy(strategy);
    const selectedType = postTypes.length > 0 
      ? postTypes[Math.floor(Math.random() * postTypes.length)]
      : null;
    
    // Geminiで生成
    const geminiResult = callGeminiForPosts({
      theme: params.theme,
      target: params.target,
      strategy: strategy,
      experience: experienceResult.experience,
      postType: selectedType
    });
    
    if (!geminiResult.success) {
      // エラーログ
      updateUserError(session.userRowIndex, geminiResult.error);
      return {
        success: false,
        error: geminiResult.error
      };
    }
    
    // チェックリスト検証（GAS側で実施）
    const posts = geminiResult.posts.map(post => ({
      ...post,
      checklistResult: runChecklist(post.text)
    }));
    
    // 自動再生成（チェック失敗時、1回のみ）
    let finalPosts = posts;
    if (CONFIG.FEATURES.AUTO_REGENERATE) {
      const needsRegenerate = posts.some(p => !p.checklistResult.passed);
      if (needsRegenerate) {
        const retryResult = callGeminiForPosts({
          theme: params.theme,
          target: params.target,
          strategy: strategy,
          experience: experienceResult.experience,
          postType: selectedType,
          isRetry: true
        });
        
        if (retryResult.success) {
          finalPosts = retryResult.posts.map(post => ({
            ...post,
            checklistResult: runChecklist(post.text)
          }));
        }
      }
    }
    
    // 生成回数を更新
    updateGenerationCount(session.userRowIndex);
    
    // 戦略情報を取得
    const strategyInfo = CONFIG.STRATEGIES[strategy];
    
    return {
      success: true,
      posts: finalPosts,
      strategy: {
        key: strategy,
        name: strategyInfo.name,
        color: strategyInfo.color,
        kpiTarget: strategyInfo.kpiTarget,
        routine: strategyInfo.routine,
        donts: strategyInfo.donts,
        abDiff: strategyInfo.abDiff
      },
      dayName: getDayName(),
      remainingCount: CONFIG.LIMITS.DAILY_GENERATE - (limitResult.currentCount + 1),
      experienceNote: experienceResult.isFallback ? '体験・経験が薄いため、編集を推奨します（辞書で更新可能）' : null
    };
    
  } catch (error) {
    logError('generatePosts', error);
    return {
      success: false,
      error: CONFIG.ERRORS.GEMINI_ERROR
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 生成パラメータを検証
 * @param {Object} params - パラメータ
 * @returns {Object} 検証結果
 */
function validateGenerateParams(params) {
  if (!params.theme || !params.theme.trim()) {
    return {
      valid: false,
      error: 'テーマを入力してください'
    };
  }
  
  if (!params.target || !params.target.trim()) {
    return {
      valid: false,
      error: 'ターゲットを入力してください'
    };
  }
  
  if (params.theme.length > CONFIG.LIMITS.THEME_MAX_LENGTH) {
    return {
      valid: false,
      error: `テーマは${CONFIG.LIMITS.THEME_MAX_LENGTH}文字以内で入力してください`
    };
  }
  
  if (params.target.length > CONFIG.LIMITS.TARGET_MAX_LENGTH) {
    return {
      valid: false,
      error: `ターゲットは${CONFIG.LIMITS.TARGET_MAX_LENGTH}文字以内で入力してください`
    };
  }
  
  return { valid: true };
}

/**
 * 1日の生成回数制限をチェック・更新
 * @param {Object} session - セッション情報
 * @returns {Object} { allowed, currentCount }
 */
function checkAndUpdateDailyLimit(session) {
  const userResult = findUserByShareKey(session.shareKey);
  if (!userResult) {
    return { allowed: false, currentCount: 0 };
  }
  
  const userData = userResult.data;
  const todayKey = getTodayDateKey();
  const storedDateKey = String(userData[CONFIG.USERS_COLS.TODAY_DATE_KEY] || '');
  let currentCount = parseInt(userData[CONFIG.USERS_COLS.TODAY_COUNT]) || 0;
  
  // 日付が変わっていたらリセット
  if (storedDateKey !== todayKey) {
    currentCount = 0;
    updateUserRow(userResult.rowIndex, {
      [CONFIG.USERS_COLS.TODAY_DATE_KEY]: todayKey,
      [CONFIG.USERS_COLS.TODAY_COUNT]: 0
    });
  }
  
  // 上限チェック
  if (currentCount >= CONFIG.LIMITS.DAILY_GENERATE) {
    return { allowed: false, currentCount };
  }
  
  return { allowed: true, currentCount };
}

/**
 * 生成回数を更新
 * @param {number} userRowIndex - Users行インデックス
 */
function updateGenerationCount(userRowIndex) {
  const sheet = getSheet(CONFIG.SHEETS.USERS);
  const todayCountCell = sheet.getRange(userRowIndex, CONFIG.USERS_COLS.TODAY_COUNT + 1);
  const totalCountCell = sheet.getRange(userRowIndex, CONFIG.USERS_COLS.TOTAL_COUNT + 1);
  const lastGenerateCell = sheet.getRange(userRowIndex, CONFIG.USERS_COLS.LAST_GENERATE_AT + 1);
  
  const currentTodayCount = parseInt(todayCountCell.getValue()) || 0;
  const currentTotalCount = parseInt(totalCountCell.getValue()) || 0;
  
  todayCountCell.setValue(currentTodayCount + 1);
  totalCountCell.setValue(currentTotalCount + 1);
  lastGenerateCell.setValue(getNowISO());
}

/**
 * ユーザーエラーを更新
 * @param {number} userRowIndex - Users行インデックス
 * @param {string} error - エラーメッセージ
 */
function updateUserError(userRowIndex, error) {
  updateUserRow(userRowIndex, {
    [CONFIG.USERS_COLS.LAST_ERROR]: `${getNowISO()}|${error}`
  });
}

/**
 * 生成用の体験・経験を取得（フォールバック含む）
 * @param {Object} session - セッション情報
 * @returns {Object} { experience, isFallback }
 */
function getExperienceForGeneration(session) {
  // まずアカウント共有から取得
  const accountResult = findAccountByGmail(session.gmail);
  if (accountResult) {
    const experience = accountResult.data[CONFIG.ACCOUNT_COLS.EXPERIENCE];
    if (experience && String(experience).trim().length > 20) {
      return {
        experience: String(experience).trim(),
        isFallback: false
      };
    }
  }
  
  // Dictionaryから取得を試みる
  const dictResult = findDictionaryByLotNumber(session.lotNumber);
  if (dictResult) {
    const dict = dictResult.data;
    const parts = [
      dict[CONFIG.DICTIONARY_COLS.FACTS],
      dict[CONFIG.DICTIONARY_COLS.EFFORTS],
      dict[CONFIG.DICTIONARY_COLS.EMOTIONS]
    ].filter(p => p && String(p).trim());
    
    if (parts.length > 0) {
      return {
        experience: parts.join(' / '),
        isFallback: false
      };
    }
  }
  
  // フォールバック：同職業からランダム抽出
  if (session.lotNumber && session.lotNumber.length >= 4) {
    const occupationCode = session.lotNumber.substring(2, 4);
    const fallbackAccount = findRandomAccountByOccupation(occupationCode, session.lotNumber);
    
    if (fallbackAccount) {
      const experience = fallbackAccount[CONFIG.ACCOUNT_COLS.EXPERIENCE];
      if (experience && String(experience).trim()) {
        return {
          experience: String(experience).trim(),
          isFallback: true
        };
      }
    }
  }
  
  // 最終フォールバック
  return {
    experience: '具体的な体験を辞書に追加してください',
    isFallback: true
  };
}

/**
 * 今日の戦略情報を取得（画面表示用）
 * @param {string} token - セッショントークン
 * @returns {Object} 戦略情報
 */
function getTodayStrategyInfo(token) {
  try {
    const sessionResult = validateSession(token);
    if (!sessionResult.valid) {
      return {
        success: false,
        error: sessionResult.error
      };
    }
    
    const strategy = getTodayStrategy();
    const strategyInfo = CONFIG.STRATEGIES[strategy];
    
    // 残り生成回数を取得
    const session = sessionResult.session;
    const userResult = findUserByShareKey(session.shareKey);
    let remainingCount = CONFIG.LIMITS.DAILY_GENERATE;
    
    if (userResult) {
      const todayKey = getTodayDateKey();
      const storedDateKey = String(userResult.data[CONFIG.USERS_COLS.TODAY_DATE_KEY] || '');
      
      if (storedDateKey === todayKey) {
        const currentCount = parseInt(userResult.data[CONFIG.USERS_COLS.TODAY_COUNT]) || 0;
        remainingCount = Math.max(0, CONFIG.LIMITS.DAILY_GENERATE - currentCount);
      }
    }
    
    return {
      success: true,
      strategy: {
        key: strategy,
        name: strategyInfo.name,
        color: strategyInfo.color,
        kpiTarget: strategyInfo.kpiTarget,
        routine: strategyInfo.routine,
        donts: strategyInfo.donts,
        abDiff: strategyInfo.abDiff
      },
      dayName: getDayName(),
      remainingCount: remainingCount,
      dailyLimit: CONFIG.LIMITS.DAILY_GENERATE
    };
    
  } catch (error) {
    logError('getTodayStrategyInfo', error);
    return {
      success: false,
      error: 'エラーが発生しました'
    };
  }
}

/**
 * 穴埋めテンプレートを取得
 * @param {string} strategy - 戦略名
 * @returns {Object} テンプレート情報
 */
function getTemplateForStrategy(strategy) {
  const templates = {
    PARADOX: {
      structure: [
        { slot: '常識', hint: 'みんなが信じている前提、自分も昔は信じていたこと、SNSでよく見る言葉' },
        { slot: '体験', hint: '一番しんどかった具体場面、失敗した数字・期間、感情が動いた瞬間' },
        { slot: '結果', hint: '数字で変化したこと、気持ちが楽になった点、判断が速くなったこと' },
        { slot: '問い', hint: '軽い問いかけ、一言で締める' }
      ],
      template: '【{常識}】は間違っている。\n実際は【{体験}】で【{結果}】が変わった。\n【{問い}】？'
    },
    EMPATHY: {
      structure: [
        { slot: '悩み', hint: '今つらい状況、多くの人が抱える不安' },
        { slot: '過去体験', hint: '自分も同じだった具体的なエピソード' },
        { slot: '呼びかけ', hint: '共有・共感を促す一言' }
      ],
      template: '【{悩み}】でしんどい人、多いと思う。\n自分も【{過去体験}】だった。\n【{呼びかけ}】。'
    },
    PROOF: {
      structure: [
        { slot: '数字成果', hint: '具体的な数字・結果' },
        { slot: '行動1', hint: 'やった具体的な行動の1つ目' },
        { slot: '行動2', hint: 'やった具体的な行動の2つ目' },
        { slot: '再現誘導', hint: '再現を促す一言' }
      ],
      template: '【{数字成果}】が出た理由はシンプル。\nやったのは【{行動1}】と【{行動2}】だけ。\n【{再現誘導}】。'
    }
  };
  
  return templates[strategy] || templates.EMPATHY;
}
