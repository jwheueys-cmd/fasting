// شغّل هذا الملف مرة وحدة فقط بعد رفع باقي التعديلات:
// node migrate-passwords.js
//
// يبحث عن أي حساب كلمة سره محفوظة كنص عادي (من قبل ما ينضاف bcrypt)
// ويشفّرها بنفس القيمة الحالية بدون ما يغيّر كلمة السر اللي يعرفها صاحب الحساب.

const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));

let count = 0;
for (const id in users) {
    const pw = users[id].password || '';
    const isHashed = pw.startsWith('$2a$') || pw.startsWith('$2b$') || pw.startsWith('$2y$');
    if (!isHashed) {
        users[id].password = bcrypt.hashSync(pw, 10);
        console.log(`تم تشفير كلمة سر: ${users[id].username} (${id})`);
        count++;
    }
}

fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
console.log(`\nانتهى. تم تشفير ${count} حساب/حسابات.`);

