/**
 * CC Lume - Gemini Client
 * Gemini API通信（JSON限定）
 */

/**
 * Gemini APIで投稿を生成
 * @param {Object} params - 生成パラメータ
 * @param {string} params.theme - テーマ
 * @param {string} params.target - ターゲット
 * @param {string} params.strategy - 戦略
 * @param {string} params.experience - 体験・経験
 * @param {Array} [params.postType] - 投稿型データ
 * @param {boolean} [params.isRetry] - 再生成かどうか
 * @returns {Object} 生成結果
 */
function callGeminiForPosts(params) {
  try {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return {
        success: false,
        error: 'APIキーが設定されていません'
      };
    }
    
    const { theme, target, strategy, experience, postType, isRetry } = params;
    const strategyInfo = CONFIG.STRATEGIES[strategy];
    
    // プロンプト構築
    const prompt = buildPrompt({
      theme,
      target,
      strategy,
      strategyInfo,
      experience,
      postType,
      isRetry
    });
    
    // API呼び出し
    const url = `${CONFIG.GEMINI.API_URL}${CONFIG.GEMINI.MODEL}:generateContent?key=${apiKey}`;
    
    const payload = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.8,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
        responseMimeType: "application/json"
      }
    };
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    
    if (responseCode !== 200) {
      console.error(`Gemini API error: ${responseCode}`);
      return {
        success: false,
        error: CONFIG.ERRORS.GEMINI_ERROR
      };
    }
    
    const responseData = JSON.parse(response.getContentText());
    
    // レスポンス解析
    const result = parseGeminiResponse(responseData);
    
    if (!result.success) {
      return result;
    }
    
    // templateIdを付与（postTypeがある場合）
    if (postType) {
      result.posts = result.posts.map(post => ({
        ...post,
        templateId: postType[CONFIG.POST_TYPES_COLS.TYPE_ID] || 0
      }));
    }
    
    return result;
    
  } catch (error) {
    logError('callGeminiForPosts', error);
    return {
      success: false,
      error: CONFIG.ERRORS.GEMINI_ERROR
    };
  }
}

/**
 * プロンプトを構築
 * @param {Object} params - パラメータ
 * @returns {string} プロンプト
 */
function buildPrompt(params) {
  const { theme, target, strategy, strategyInfo, experience, postType, isRetry } = params;
  
  const abDiffA = strategyInfo.abDiff.A;
  const abDiffB = strategyInfo.abDiff.B;
  
  let postTypeInstruction = '';
  if (postType) {
    const structure = postType[CONFIG.POST_TYPES_COLS.STRUCTURE] || '';
    const description = postType[CONFIG.POST_TYPES_COLS.DESCRIPTION] || '';
    if (structure || description) {
      postTypeInstruction = `
【投稿構造参考】
${description}
${structure}
`;
    }
  }
  
  const retryNote = isRetry ? `
【重要：再生成】
前回の生成が品質チェックに通過しませんでした。以下を厳守してください：
- 比喩表現（まるで、のような）を使わない
- 説教臭い表現（すべき、絶対、やれ）を控える
- 140文字以内に収める
- 主張は1つに絞る
` : '';

  return `あなたはX（Twitter）投稿のプロライターです。

【タスク】
テーマとターゲットに基づいて、${strategy}（${strategyInfo.name}）戦略の投稿を2本（A案・B案）生成してください。

【入力情報】
- テーマ：${theme}
- ターゲット：${target}
- 戦略：${strategy}（${strategyInfo.name}）
- 体験・経験素材：${experience}
${postTypeInstruction}
${retryNote}

【A案の方向性】
${abDiffA}

【B案の方向性】
${abDiffB}

【厳守ルール】
1. 各投稿は140文字前後（120〜145文字目安）
2. 具体的な数字や固有名詞を最低1つ入れる
3. 【】で囲んだ部分は穴埋め用のプレースホルダとして残す
4. AI臭い比喩表現を避ける
5. 説教臭くしない
6. 必ず以下のJSON形式のみで返答する

【出力形式（JSONのみ）】
{
  "posts": [
    {
      "abVariant": "A",
      "strategy": "${strategy}",
      "intent": "reply",
      "text": "ここに投稿文（140字前後）"
    },
    {
      "abVariant": "B",
      "strategy": "${strategy}",
      "intent": "bookmark",
      "text": "ここに投稿文（140字前後）"
    }
  ]
}

intentの選択肢：reply（リプ狙い）、bookmark（保存狙い）、repost（リポスト狙い）、follow（フォロー狙い）

JSONのみを出力し、他の説明文は一切付けないでください。`;
}

/**
 * Geminiレスポンスを解析
 * @param {Object} responseData - APIレスポンス
 * @returns {Object} 解析結果
 */
function parseGeminiResponse(responseData) {
  try {
    // candidates[0].content.parts[0].text を取得
    if (!responseData.candidates || 
        !responseData.candidates[0] || 
        !responseData.candidates[0].content ||
        !responseData.candidates[0].content.parts ||
        !responseData.candidates[0].content.parts[0]) {
      return {
        success: false,
        error: 'APIレスポンスが不正です'
      };
    }
    
    const text = responseData.candidates[0].content.parts[0].text;
    
    // JSONをパース
    let jsonData;
    try {
      // コードブロックがある場合は除去
      let cleanText = text.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      jsonData = JSON.parse(cleanText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError, text);
      return {
        success: false,
        error: 'JSONの解析に失敗しました'
      };
    }
    
    // postsの検証
    if (!jsonData.posts || !Array.isArray(jsonData.posts) || jsonData.posts.length < 2) {
      return {
        success: false,
        error: '投稿データが不足しています'
      };
    }
    
    // 必須キーの検証
    const requiredKeys = ['abVariant', 'strategy', 'text'];
    for (const post of jsonData.posts) {
      for (const key of requiredKeys) {
        if (!post[key]) {
          return {
            success: false,
            error: `投稿データに${key}がありません`
          };
        }
      }
    }
    
    return {
      success: true,
      posts: jsonData.posts.slice(0, 2) // 最大2本
    };
    
  } catch (error) {
    logError('parseGeminiResponse', error);
    return {
      success: false,
      error: CONFIG.ERRORS.GEMINI_ERROR
    };
  }
}

/**
 * Gemini APIの接続テスト
 * @returns {Object} テスト結果
 */
function testGeminiConnection() {
  try {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return {
        success: false,
        error: 'APIキーが設定されていません。Script Propertiesに GEMINI_API_KEY を設定してください。'
      };
    }
    
    const url = `${CONFIG.GEMINI.API_URL}${CONFIG.GEMINI.MODEL}:generateContent?key=${apiKey}`;
    
    const payload = {
      contents: [{
        parts: [{
          text: 'テスト。「こんにちは」と返答してください。'
        }]
      }],
      generationConfig: {
        maxOutputTokens: 50
      }
    };
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    
    if (responseCode === 200) {
      return {
        success: true,
        message: 'Gemini API接続成功'
      };
    } else {
      return {
        success: false,
        error: `API Error: ${responseCode} - ${response.getContentText()}`
      };
    }
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
