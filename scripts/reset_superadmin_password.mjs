// Resetea la contraseña del superadmin via Admin API
import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const TARGET_EMAIL = process.env.SUPERADMIN_EMAIL || 'madridsystem@outlook.es';
const NEW_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'MadridSystem2026!';

const headers = {
  'Content-Type': 'application/json',
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
};

async function main() {
  console.log('🔍 Buscando usuario:', TARGET_EMAIL);

  // 1. Listar todos los usuarios para encontrar el ID
  let found = null;
  let page = 1;
  while (!found) {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=1000`,
      { headers }
    );
    if (!res.ok) {
      const err = await res.json();
      console.error('Error listando usuarios:', err.message);
      return;
    }
    const data = await res.json();
    const users = data.users || [];
    console.log(`  Página ${page}: ${users.length} usuarios encontrados`);
    
    found = users.find(u => u.email?.toLowerCase() === TARGET_EMAIL.toLowerCase());
    if (found || users.length < 1000) break;
    page++;
  }

  if (!found) {
    console.log('\n❌ Usuario no encontrado con email:', TARGET_EMAIL);
    console.log('\n📋 Usuarios registrados en el sistema:');
    
    // Mostrar todos los usuarios disponibles
    const res2 = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=50`, { headers });
    const d2 = await res2.json();
    (d2.users || []).forEach(u => {
      console.log(`   • ${u.email} — ID: ${u.id} — Confirmado: ${u.email_confirmed_at ? 'sí' : 'no'}`);
    });
    return;
  }

  console.log('✅ Usuario encontrado:');
  console.log(`   ID: ${found.id}`);
  console.log(`   Email: ${found.email}`);
  console.log(`   Confirmado: ${found.email_confirmed_at ? 'sí' : 'no'}`);
  console.log(`   Último login: ${found.last_sign_in_at || 'nunca'}`);

  // 2. Resetear contraseña
  console.log('\n🔑 Reseteando contraseña a:', NEW_PASSWORD);
  const patchRes = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users/${found.id}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({ 
        password: NEW_PASSWORD,
        email_confirm: true // Confirmar email si no estaba confirmado
      }),
    }
  );

  if (patchRes.ok) {
    const result = await patchRes.json();
    console.log('✅ Contraseña actualizada correctamente');
    console.log('\n🎉 Ya puedes iniciar sesión con:');
    console.log(`   📧 Email:      ${TARGET_EMAIL}`);
    console.log(`   🔑 Contraseña: ${NEW_PASSWORD}`);
    console.log('\n   URL: http://localhost:3000/odontocloudsaas/login');
  } else {
    const err = await patchRes.json();
    console.error('❌ Error al resetear:', err.message || JSON.stringify(err));
  }
}

main().catch(console.error);
