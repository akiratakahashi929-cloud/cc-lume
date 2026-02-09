/**
 * 新しい認証フローとデータ取得の検証用テストスクリプト
 * 実行前にスプレッドシートのデータを適宜用意してください。
 */
function testNewAuthAndData() {
  const testShareKey = 'PJPFEJm6JZ'; // ユーザー提供画像にあるキー
  const testGmail = 'cctcsa104@gmail.com';
  const testPassword = 'cctcsp4233212';
  
  console.log('--- テスト開始: apiLogin ---');
  const loginRes = apiLogin(testShareKey, testGmail, testPassword);
  console.log('ログイン結果:', JSON.stringify(loginRes, null, 2));
  
  if (loginRes.success) {
    console.log('--- テスト開始: apiGetStartupItems ---');
    const startupItems = apiGetStartupItems(testShareKey);
    console.log('スタートアップアイテム取得結果:', JSON.stringify(startupItems, null, 2));
    
    // 期待値チェック: P列(15)が招待コードとして取得できているか
    if (startupItems.inviteCode) {
      console.log('SUCCESS: 招待コードが取得できました: ' + startupItems.inviteCode);
    } else {
      console.log('WARNING: 招待コードが空です。シートのP列を確認してください。');
    }
  } else {
    console.log('FAILURE: ログインに失敗しました。Enable(N列)がチェックされているか確認してください。');
  }
}
