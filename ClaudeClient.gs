/**
 * CC Lume - Claude Client
 * Claude API通信（JSON限定）
 */

/**
 * Claude APIで投稿を生成
 * @param {Object} params - 生成パラメータ
 * @param {string} params.theme - テーマ
 * @param {string} params.target - ターゲット
 * @param {string} params.strategy - 戦略
 * @param {string} params.experience - 体験・経験
 * @param {Array} [params.postType] - 投稿型データ
 * @param {boolean} [params.isRetry] - 再生成かどうか
 * @returns {Object} 生成結果
 */
function callClaudeForPosts(params) {
  try {
    const apiKey = getClaudeApiKey();
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

    const payload = {
      model: CONFIG.CLAUDE.MODEL,
      max_tokens: 1024,
      temperature: 0.8,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': CONFIG.CLAUDE.ANTHROPIC_VERSION
      },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(CONFIG.CLAUDE.API_URL, options);
    const responseCode = response.getResponseCode();

    if (responseCode !== 200) {
      console.error(`Claude API error: ${responseCode}`);
      return {
        success: false,
        error: CONFIG.ERRORS.CLAUDE_ERROR
      };
    }

    const responseData = JSON.parse(response.getContentText());
    const result = parseClaudeResponse(responseData);

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
    logError('callClaudeForPosts', error);
    return {
      success: false,
      error: CONFIG.ERRORS.CLAUDE_ERROR
    };
  }
}

/**
 * Claudeレスポンスを解析
 * @param {Object} responseData - APIレスポンス
 * @returns {Object} 解析結果
 */
function parseClaudeResponse(responseData) {
  try {
    if (!responseData.content || !responseData.content[0] || !responseData.content[0].text) {
      return {
        success: false,
        error: 'APIレスポンスが不正です'
      };
    }

    const text = responseData.content[0].text;

    // JSONをパース
    let jsonData;
    try {
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
      posts: jsonData.posts.slice(0, 2)
    };

  } catch (error) {
    logError('parseClaudeResponse', error);
    return {
      success: false,
      error: CONFIG.ERRORS.CLAUDE_ERROR
    };
  }
}

/**
 * Claude APIの接続テスト
 * @returns {Object} テスト結果
 */
function testClaudeConnection() {
  try {
    const apiKey = getClaudeApiKey();
    if (!apiKey) {
      return {
        success: false,
        error: 'APIキーが設定されていません。Script Propertiesに CLAUDE_API_KEY を設定してください。'
      };
    }

    const payload = {
      model: CONFIG.CLAUDE.MODEL,
      max_tokens: 50,
      messages: [
        {
          role: 'user',
          content: 'テスト。「こんにちは」と返答してください。'
        }
      ]
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': CONFIG.CLAUDE.ANTHROPIC_VERSION
      },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(CONFIG.CLAUDE.API_URL, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      return {
        success: true,
        message: 'Claude API接続成功'
      };
    }

    return {
      success: false,
      error: `API Error: ${responseCode} - ${response.getContentText()}`
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
