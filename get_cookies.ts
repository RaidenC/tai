import * as fs from 'fs';
const data = JSON.parse(fs.readFileSync('apps/portal-web-e2e/.auth/user.json', 'utf8'));
console.log("Cookies saved in state:", data.cookies.map((c: any) => c.name));
