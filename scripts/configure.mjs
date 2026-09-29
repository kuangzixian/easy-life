import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appid = process.argv[2];
if (!/^wx[0-9a-f]{16}$/.test(appid || '')) {
  console.error('用法：npm run configure -- wx0123456789abcdef（填写微信公众平台中的真实 AppID，不是 AppSecret）');
  process.exit(1);
}
const target = path.join(root, 'project.config.json');
const config = JSON.parse(fs.readFileSync(target, 'utf8'));
config.appid = appid;
fs.writeFileSync(target, JSON.stringify(config, null, 2) + '\n');
console.log('已配置 AppID。请用微信开发者工具重新导入项目根目录。AppID 是公开标识，不是密钥。');
