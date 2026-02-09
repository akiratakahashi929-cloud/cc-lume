/**
 * CC Lume - Configuration
 * 設定ファイル（シート名・列・制限値・モデル・FeatureFlag）
 */

const CONFIG = {
  // === スプレッドシート設定 ===
  SPREADSHEET_ID: '1ZlccVm_nXDVMSbIYX4mz7LhklZe0DoZwyMBAT9jY8N4',
  
  // === シート名（完全一致必須） ===
  SHEETS: {
    USERS: 'Users',
    ACCOUNT_SHARE: 'アカウント共有',
    EXPERIENCE_MAP: 'エクスペリエンスマップ',
    POST_TYPES: '初回投稿型',
    DICTIONARY: 'Dictionary',
    FORM_RESPONSES: 'フォームの回答 1'
  },
  
  // === Users列定義（A〜L） ===
  USERS_COLS: {
    SHARE_KEY: 0,        // A: 共有時発行キー
    LOT_NUMBER: 1,       // B: ロットナンバー
    FIRST_LOGIN_OLD: 2,  // C: Users.FirstLoginDone（互換用）
    ENABLED: 3,          // D: Enabled
    FIRST_LOGIN_DONE: 4, // E: FirstLoginDone（正式フラグ）
    LAST_LOGIN_AT: 5,    // F: LastLoginAt
    TODAY_COUNT: 6,      // G: TodayCount
    TODAY_DATE_KEY: 7,   // H: TodayDateKey
    TOTAL_COUNT: 8,      // I: TotalCount
    LAST_GENERATE_AT: 9, // J: LastGenerateAt
    LAST_ERROR: 10,      // K: LastError
    AUDIT_LOG: 11        // L: AuditLog
  },
  
  // === アカウント共有列定義（A〜T） ===
  ACCOUNT_COLS: {
    NAME: 0,             // A: 氏名
    GMAIL: 1,            // B: Gmailアドレス
    PASSWORD: 2,         // C: パスワード
    LOT_NUMBER: 3,       // D: ロットナンバー
    EXPERIENCE: 4,       // E: 体験・経験
    X_URL: 5,            // F: XアカウントURL
    ACCOUNT_NAME: 6,     // G: アカウント名
    ACCOUNT_ID: 7,       // H: ID
    BIO: 8,              // I: バイオ
    POST_TEXT: 9,        // J: 投稿文
    ICON_IMAGE: 10,      // K: アイコン画像
    BANNER: 11,          // L: バナー
    PERSONA: 12,         // M: 人格
    ENABLE: 13,          // N: Enable
    SHARE_KEY: 14,       // O: 共有時発行キー
    INVITE_CODE: 15,     // P: 招待コード
    POST_1: 16,          // Q: 投稿1
    POST_2: 17,          // R: 投稿2
    POST_3: 18,          // S: 投稿3
    POST_4: 19,          // T: 投稿4
    POST_5: 20           // U: 投稿5
  },
  
  // === Dictionary列定義（A〜H） ===
  DICTIONARY_COLS: {
    NAME: 0,             // A: 氏名
    LOT_NUMBER: 1,       // B: ロットナンバー
    FACTS: 2,            // C: Facts
    NUMBERS: 3,          // D: Numbers
    EFFORTS: 4,          // E: Efforts
    EMOTIONS: 5,         // F: Emotions
    AESTHETICS: 6,       // G: Aesthetics
    PUNCHLINE: 7         // H: Punchline
  },
  
  // === 初回投稿型列定義（A〜I） ===
  POST_TYPES_COLS: {
    TYPE_ID: 0,          // A: type_id
    TYPE_NAME: 1,        // B: type_name
    STRATEGY: 2,         // C: strategy
    DEFAULT_USE: 3,      // D: default_use
    KPI: 4,              // E: kpi
    NEED_REPLY: 5,       // F: need_reply
    NEED_THREAD: 6,      // G: need_thread
    DESCRIPTION: 7,      // H: description
    STRUCTURE: 8         // I: structure
  },
  
  // === Gemini API設定 ===
  GEMINI: {
    MODEL: 'gemini-2.5-flash-lite',
    API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/',
    PROPERTY_KEY: 'GEMINI_API_KEY'
  },

  // === Claude API設定 ===
  CLAUDE: {
    MODEL: 'claude-3-5-sonnet-20241022',
    API_URL: 'https://api.anthropic.com/v1/messages',
    PROPERTY_KEY: 'CLAUDE_API_KEY',
    ANTHROPIC_VERSION: '2023-06-01'
  },
  
  // === 制限値 ===
  LIMITS: {
    DAILY_GENERATE: 3,       // 1日の生成上限
    THEME_MAX_LENGTH: 100,   // テーマ文字数上限
    TARGET_MAX_LENGTH: 50,   // ターゲット文字数上限
    POST_MAX_LENGTH: 140,    // 投稿文字数上限
    SESSION_TTL: 1800,       // セッション有効期限（秒）= 30分
    LOCK_TIMEOUT: 10000      // ロックタイムアウト（ミリ秒）
  },
  
  // === 曜日別戦略（0=日曜〜6=土曜） ===
  DAILY_STRATEGY: {
    0: 'EMPATHY',   // 日
    1: 'PARADOX',   // 月
    2: 'EMPATHY',   // 火
    3: 'PROOF',     // 水
    4: 'EMPATHY',   // 木
    5: 'PARADOX',   // 金
    6: 'PROOF'      // 土
  },
  
  // === 戦略設定 ===
  STRATEGIES: {
    PARADOX: {
      name: '逆説',
      color: '#E74C3C',
      kpiTarget: 'リポスト・引用',
      routine: '投稿後1分：反論コメントをチェック→論点整理してリプ',
      donts: ['長文で説明しすぎる', '根拠なしで断定する', '炎上狙いの極論'],
      abDiff: {
        A: '断定＋数字/事実強め',
        B: '問い＋対立軸強め'
      }
    },
    EMPATHY: {
      name: '共感',
      color: '#3498DB',
      kpiTarget: 'リプライ・コメント',
      routine: '投稿後1分：共感リプに「いいね」→深掘り質問',
      donts: ['上から目線で語る', '解決策を押し付ける', '自分語りで終わる'],
      abDiff: {
        A: '情景・感情強め',
        B: '伴走・提案強め'
      }
    },
    PROOF: {
      name: '実証',
      color: '#27AE60',
      kpiTarget: '保存・ブックマーク',
      routine: '投稿後1分：「詳細希望」に反応→スレッド展開',
      donts: ['数字だけ羅列する', '専門用語で固める', '再現性を示さない'],
      abDiff: {
        A: '数字中心',
        B: '手順中心'
      }
    }
  },
  
  // === Feature Flags ===
  FEATURES: {
    ADVANCED_MODE: false,      // 上級モード（pain/gain選択）
    STRATEGY_SELECT: false,    // 戦略自由選択
    AUTO_REGENERATE: true      // 自動再生成（最大1回）
  },
  
  // === ロット番号マッピング ===
  LOT_MAPPING: {
    // 職業コード（01〜10）
    OCCUPATION: {
      '主婦／ホームメーカー': '01',
      '主婦': '01',
      'ホームメーカー': '01',
      '一般事務／正社員': '02',
      '一般事務': '02',
      '正社員': '02',
      '営業／接客／販売': '03',
      '営業': '03',
      '接客': '03',
      '販売': '03',
      '製造／建設／現場職': '04',
      '製造': '04',
      '建設': '04',
      '現場職': '04',
      'IT／エンジニア／クリエイティブ': '05',
      'IT': '05',
      'エンジニア': '05',
      'クリエイティブ': '05',
      '医療／福祉／介護': '06',
      '医療': '06',
      '福祉': '06',
      '介護': '06',
      '公務員／団体職員／教職': '07',
      '公務員': '07',
      '団体職員': '07',
      '教職': '07',
      '自営業／フリーランス': '08',
      '自営業': '08',
      'フリーランス': '08',
      'パート／アルバイト／求職中': '09',
      'パート': '09',
      'アルバイト': '09',
      '求職中': '09',
      '物流／配送／ドライバー': '10',
      '物流': '10',
      '配送': '10',
      'ドライバー': '10'
    },
    
    // MBTIコード（Q1-Q4の組み合わせ）
    MBTI: {
      'AAAA': '01', 'AAAB': '02', 'AABA': '03', 'AABB': '04',
      'ABAA': '05', 'ABAB': '06', 'ABBA': '07', 'ABBB': '08',
      'BAAA': '09', 'BAAB': '10', 'BABA': '11', 'BABB': '12',
      'BBAA': '13', 'BBAB': '14', 'BBBA': '15', 'BBBB': '16'
    },
    
    // 髪型コード
    HAIR: {
      'ショート': '1',
      'ミディアム': '2',
      'ロング': '3',
      'ボブ': '4',
      'その他': '5'
    },
    
    // テイストコード
    TASTE: {
      'アジア系': '1',
      'ハイブリッド': '5',
      '欧米系': '9'
    },
    
    // アイテムコード
    ITEM: {
      'スマホ': '1',
      '手帳': '2',
      'コーヒー': '3',
      'PC': '4',
      '高級万年筆': '5'
    }
  },
  
  // === エラーメッセージ ===
  ERRORS: {
    SHEET_NOT_FOUND: 'シートが見つかりません: ',
    COLUMN_MISMATCH: '列構造が不一致です: ',
    USER_NOT_FOUND: 'ユーザーが見つかりません',
    ACCOUNT_DISABLED: 'アカウントが無効化されています',
    INVALID_PASSWORD: 'パスワードが一致しません',
    DAILY_LIMIT_REACHED: '本日の生成上限（3回）に達しました。明日また進めましょう。',
    INPUT_TOO_LONG: '入力文字数制限をオーバーしています',
    GEMINI_ERROR: '生成に失敗しました。再度お試しください。',
    CLAUDE_ERROR: '生成に失敗しました。再度お試しください。',
    SESSION_EXPIRED: 'セッションが期限切れです。再ログインしてください。',
    LOCK_TIMEOUT: '同時アクセスが集中しています。しばらくお待ちください。'
  }
};

/**
 * 設定値を取得
 */
function getConfig() {
  return CONFIG;
}

/**
 * Gemini APIキーを取得
 */
function getGeminiApiKey() {
  return PropertiesService.getScriptProperties().getProperty(CONFIG.GEMINI.PROPERTY_KEY);
}

/**
 * Claude APIキーを取得
 */
function getClaudeApiKey() {
  return PropertiesService.getScriptProperties().getProperty(CONFIG.CLAUDE.PROPERTY_KEY);
}

/**
 * 今日の戦略を取得
 */
function getTodayStrategy() {
  const dayOfWeek = new Date().getDay();
  return CONFIG.DAILY_STRATEGY[dayOfWeek];
}

/**
 * 今日の日付キー（YYYYMMDD）を取得
 */
function getTodayDateKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/**
 * 曜日名を取得
 */
function getDayName() {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return days[new Date().getDay()];
}
