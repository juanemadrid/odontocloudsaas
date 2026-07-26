const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'public/images/teeth_svg');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.svg'));

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if it already has viewBox
    if (!content.includes('viewBox')) {
        // Extract width and height from <svg ... width="43" height="86" ... >
        const match = content.match(/<svg[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"/i);
        if (match) {
            const w = match[1];
            const h = match[2];
            content = content.replace(/<svg ([^>]+)>/i, `<svg viewBox="0 0 ${w} ${h}" $1>`);
            fs.writeFileSync(filePath, content);
            console.log(`Added viewBox to ${file}: 0 0 ${w} ${h}`);
        }
    }
});
