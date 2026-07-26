const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'public/images/teeth_svg');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.svg'));

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // The background block is typically the first path element which defines a rounded rectangle.
    // Usually looks like <path d="M0 0 C... 0 86 ... Z " fill="#F6F6F1" ... />
    // We can simply remove the first path if its fill is a light background-like color and it starts at M0 0.
    
    // Un regex que busque el primer <path d="M0 0 C... Z " fill="#...F..." transform="translate(0,0)"/>
    // O simplemente buscar un M0 0 C... Z que se extienda por toda la figura.
    // Vamos a buscar la etiqueta de path que tiene el fondo general (sabemos que es enorme y es el primero)
    
    const pathMatch = content.match(/<path[^>]+d="M0\s*0\s*C[^>]+fill="#F[^"]+"[^>]*\/>/i);
    if (pathMatch) {
       console.log(`Removing background path from ${file}`);
       content = content.replace(pathMatch[0], '');
       fs.writeFileSync(filePath, content);
    }
});
