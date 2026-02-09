const fs = require('fs');
const path = require('path');

const indexHtml = fs.readFileSync('Ui_Index.html', 'utf8');
const styleCssHtml = fs.readFileSync('Ui_Style.css.html', 'utf8');
const appJsHtml = fs.readFileSync('Ui_App.js.html', 'utf8');

// 抽出 (タグの中身だけ)
const cssContent = styleCssHtml.replace(/<style>|<\/style>/gi, '').trim();
const jsContent = appJsHtml.replace(/<script>|<\/script>/gi, '').trim();

// プレースホルダーの置き換え
let finalHtml = indexHtml.replace(/<\?!= include\('Ui_Style.css'\) \?>/g, `<style>\n${cssContent}\n</style>`);
finalHtml = finalHtml.replace(/<\?!= include\('Ui_App.js'\) \?>/g, `<script>\n${jsContent}\n</script>`);

fs.writeFileSync('index.html', finalHtml);
console.log('index.html has been successfully integrated.');
