const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'public/images/teeth_svg');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.svg'));

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Si no tiene el stroke
    if (!content.includes('stroke="#0369a1"')) {
       // Insertamos el stroke azul oscuro y width 1 a <svg> para forzar que sea bien visible
       content = content.replace(/<svg([^>]+)>/i, '<svg$1 stroke="#0284c7" stroke-width="1.5" stroke-linejoin="round">');
       fs.writeFileSync(filePath, content);
       console.log(`Fixed ${file}`);
    }
});
