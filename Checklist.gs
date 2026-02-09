/**
 * CC Lume - Checklist
 * 禁止事項チェック（文字列解析・GAS側判定）
 */

/**
 * 投稿文のチェックリストを実行
 * @param {string} text - 投稿文
 * @returns {Object} チェック結果 { passed, reasons }
 */
function runChecklist(text) {
  const reasons = [];
  
  if (!text || typeof text !== 'string') {
    return {
      passed: false,
      reasons: ['投稿文が空です']
    };
  }
  
  // 1. AI飾り（比喩語検知）
  const metaphorCheck = checkMetaphors(text);
  if (!metaphorCheck.passed) {
    reasons.push(metaphorCheck.reason);
  }
  
  // 2. 説教臭（命令語多）
  const lectureCheck = checkLecturing(text);
  if (!lectureCheck.passed) {
    reasons.push(lectureCheck.reason);
  }
  
  // 3. 比喩過多（比喩語2個以上）
  const excessiveMetaphorCheck = checkExcessiveMetaphors(text);
  if (!excessiveMetaphorCheck.passed) {
    reasons.push(excessiveMetaphorCheck.reason);
  }
  
  // 4. 長文（140文字超）
  const lengthCheck = checkLength(text);
  if (!lengthCheck.passed) {
    reasons.push(lengthCheck.reason);
  }
  
  // 5. 主張複数（文が3つ以上）
  const multipleClaimsCheck = checkMultipleClaims(text);
  if (!multipleClaimsCheck.passed) {
    reasons.push(multipleClaimsCheck.reason);
  }
  
  return {
    passed: reasons.length === 0,
    reasons: reasons
  };
}

/**
 * AI飾り（比喩語）チェック
 * @param {string} text - 投稿文
 * @returns {Object} { passed, reason }
 */
function checkMetaphors(text) {
  const metaphorPatterns = [
    /比喩/,
    /まるで/,
    /のような/,
    /ように/,
    /みたいな/,
    /みたいに/,
    /のごとく/,
    /さながら/
  ];
  
  for (const pattern of metaphorPatterns) {
    if (pattern.test(text)) {
      return {
        passed: false,
        reason: '比喩表現が含まれています'
      };
    }
  }
  
  return { passed: true };
}

/**
 * 説教臭チェック（命令語3個以上でNG）
 * @param {string} text - 投稿文
 * @returns {Object} { passed, reason }
 */
function checkLecturing(text) {
  const lecturePatterns = [
    /すべき/g,
    /べきだ/g,
    /絶対/g,
    /やれ/g,
    /しろ/g,
    /しなさい/g,
    /必ず/g,
    /当然/g,
    /なければならない/g
  ];
  
  let count = 0;
  for (const pattern of lecturePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      count += matches.length;
    }
  }
  
  if (count >= 3) {
    return {
      passed: false,
      reason: '説教臭い表現が多すぎます'
    };
  }
  
  return { passed: true };
}

/**
 * 比喩過多チェック（比喩語2個以上でNG）
 * @param {string} text - 投稿文
 * @returns {Object} { passed, reason }
 */
function checkExcessiveMetaphors(text) {
  const metaphorPatterns = [
    /まるで/g,
    /のような/g,
    /ように/g,
    /みたいな/g,
    /みたいに/g,
    /のごとく/g,
    /さながら/g
  ];
  
  let count = 0;
  for (const pattern of metaphorPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      count += matches.length;
    }
  }
  
  if (count >= 2) {
    return {
      passed: false,
      reason: '比喩表現が多すぎます'
    };
  }
  
  return { passed: true };
}

/**
 * 文字数チェック（140文字超でNG）
 * @param {string} text - 投稿文
 * @returns {Object} { passed, reason }
 */
function checkLength(text) {
  // プレースホルダ【】を除外してカウント（編集前提）
  const textWithoutPlaceholders = text.replace(/【[^】]*】/g, '');
  const length = textWithoutPlaceholders.length;
  
  if (length > CONFIG.LIMITS.POST_MAX_LENGTH) {
    return {
      passed: false,
      reason: `文字数が${length}文字です（上限：${CONFIG.LIMITS.POST_MAX_LENGTH}文字）`
    };
  }
  
  return { passed: true };
}

/**
 * 主張複数チェック（3文以上でNG）
 * @param {string} text - 投稿文
 * @returns {Object} { passed, reason }
 */
function checkMultipleClaims(text) {
  // 文末パターンで分割
  const sentenceEnders = /[。！？\!\?]/g;
  const sentences = text.split(sentenceEnders).filter(s => s.trim().length > 0);
  
  if (sentences.length >= 4) {
    return {
      passed: false,
      reason: '主張が多すぎます（3つ以内に絞ってください）'
    };
  }
  
  return { passed: true };
}

/**
 * 追加のAI臭チェック（オプション）
 * @param {string} text - 投稿文
 * @returns {Object} { passed, reason }
 */
function checkAiSmell(text) {
  const aiPatterns = [
    /革命的/,
    /驚くべき/,
    /圧倒的/,
    /感動的/,
    /衝撃的/,
    /奇跡的/,
    /究極の/,
    /最高の秘密/,
    /人生を変える/,
    /世界が変わる/
  ];
  
  for (const pattern of aiPatterns) {
    if (pattern.test(text)) {
      return {
        passed: false,
        reason: 'AI臭い表現が含まれています'
      };
    }
  }
  
  return { passed: true };
}

/**
 * 穴埋めプレースホルダが残っているかチェック
 * @param {string} text - 投稿文
 * @returns {Object} { hasPlaceholders, placeholders }
 */
function checkPlaceholders(text) {
  const pattern = /【[^】]+】/g;
  const matches = text.match(pattern);
  
  return {
    hasPlaceholders: matches && matches.length > 0,
    placeholders: matches || []
  };
}

/**
 * 投稿前の最終チェック（UIで使用）
 * @param {string} text - 投稿文
 * @returns {Object} チェック結果
 */
function finalCheckBeforePost(text) {
  const result = {
    canPost: true,
    warnings: [],
    errors: []
  };
  
  // プレースホルダチェック
  const placeholderCheck = checkPlaceholders(text);
  if (placeholderCheck.hasPlaceholders) {
    result.canPost = false;
    result.errors.push(`【】が残っています：${placeholderCheck.placeholders.join(', ')}`);
  }
  
  // 文字数チェック
  if (text.length > CONFIG.LIMITS.POST_MAX_LENGTH) {
    result.canPost = false;
    result.errors.push(`文字数オーバー（${text.length}文字 / ${CONFIG.LIMITS.POST_MAX_LENGTH}文字）`);
  }
  
  // 空チェック
  if (!text.trim()) {
    result.canPost = false;
    result.errors.push('投稿文が空です');
  }
  
  // 警告チェック（投稿は可能だが注意）
  if (text.length < 50) {
    result.warnings.push('短すぎる投稿です。もう少し具体的に書くと効果的です');
  }
  
  // 数字・具体性チェック
  const hasNumber = /\d/.test(text);
  if (!hasNumber) {
    result.warnings.push('数字がありません。具体的な数字を入れると説得力が増します');
  }
  
  return result;
}
