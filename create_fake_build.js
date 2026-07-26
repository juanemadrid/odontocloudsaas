
import fs from 'fs';
import path from 'path';

const distDir = path.join(process.cwd(), 'dist');
const publicDir = path.join(process.cwd(), 'public');

if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
}

// Copy index.html
fs.copyFileSync(path.join(process.cwd(), 'index.html'), path.join(distDir, 'index.html'));

// Copy public assets
function copyRecursive(src, dest) {
    if (fs.statSync(src).isDirectory()) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest);
        }
        fs.readdirSync(src).forEach(child => {
            copyRecursive(path.join(src, child), path.join(dest, child));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

copyRecursive(publicDir, distDir);

console.log('Fake build created at ./dist');
