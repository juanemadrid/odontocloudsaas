// scripts/send-test-email.js
// Prueba controlada con diseño de alta fidelidad, logo embebido (CID + URL) y texto no genérico
const https = require('https');
const fs = require('fs');
const path = require('path');

const resendApiKey = process.env.RESEND_API_KEY || process.argv[2];

if (!resendApiKey) {
  console.error("ERROR: Debes proporcionar la RESEND_API_KEY.");
  console.error("Uso: node scripts/send-test-email.js re_tu_clave_aqui");
  process.exit(1);
}

const recipientEmail = "madridsystem@outlook.es";
const adminName = "Juan Madrid";
const clinicName = "Clínica Odontológica Demo";
const planName = "Plan Profesional Clínico";
const setupPasswordUrl = "https://odontocloudcolombia.com/reset-password?demo_test=1";

// Cargar imagen del logo en Base64 para adjuntarla inline (CID)
let logoBase64 = "";
try {
  const logoPath = path.resolve(__dirname, "../public/assets/logo.png");
  if (fs.existsSync(logoPath)) {
    logoBase64 = fs.readFileSync(logoPath).toString("base64");
  }
} catch (e) {
  console.warn("No se pudo leer logo en base64:", e.message);
}

const textBody = `¡Hola, ${adminName}! Te damos la bienvenida oficial a OdontoCloud.

Nos alegra que hayas elegido OdontoCloud para potenciar la gestión y el crecimiento de tu clínica: ${clinicName}.

A partir de hoy, cuentas con la solución más moderna e intuitiva para administrar tu consulta:
- Agenda médica interactiva y recordatorios.
- Historia clínica odontológica con odontograma digital.
- Facturación electrónica DIAN / Factus y reportes RIPS / SISPRO.
- Control de presupuestos, pagos y caja en tiempo real.

--------------------------------------------------
TUS DATOS DE ACCESO:
- Clínica: ${clinicName}
- Administrador: ${adminName}
- Correo de ingreso: ${recipientEmail}
- Plan activado: ${planName}
- Portal web: https://odontocloudcolombia.com
--------------------------------------------------

PASO OBLIGATORIO - CREA TU CONTRASEÑA DE ACCESO:
Ingresa al siguiente enlace protegido para crear tu clave de ingreso:
${setupPasswordUrl}

(Por tu seguridad, este enlace es de un solo uso y expirará en las próximas 24 horas).

¿NECESITAS AYUDA PARA EMPEZAR?
Puedes responder directamente a este correo o ingresar a nuestro portal web oficial:
https://odontocloudcolombia.com

OdontoCloud Colombia — Transformación Digital Odontológica`;

const htmlBody = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>¡Bienvenido a OdontoCloud!</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #0F172A;">

  <!-- Preheader oculto para vista previa en bandeja -->
  <div style="display: none; font-size: 1px; color: #F8FAFC; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    Tu clínica ${clinicName} ya está lista en OdontoCloud. Haz clic aquí para activar tu acceso y establecer tu contraseña.
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F8FAFC; padding: 40px 16px;">
    <tr>
      <td align="center">
        
        <!-- Tarjeta Principal -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 12px 35px -8px rgba(15, 23, 42, 0.1); border: 1px solid #E2E8F0;">
          
          <!-- Cabecera con Logo Oficial -->
          <tr>
            <td style="background-color: #FFFFFF; padding: 28px 24px 20px 24px; text-align: center; border-bottom: 2px solid #F1F5F9;">
              <a href="https://odontocloudcolombia.com" target="_blank" style="display: inline-block; text-decoration: none;">
                <img src="https://odontocloudcolombia.com/assets/logo.png" alt="🦷 OdontoCloud" width="180" style="display: block; margin: 0 auto; max-width: 180px; width: 180px; height: auto; border: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 26px; font-weight: 900; color: #0284C7; letter-spacing: -0.5px;" />
              </a>
            </td>
          </tr>

          <!-- Banner de Bienvenida -->
          <tr>
          <!-- Banner de Bienvenida compatible con Outlook Word Engine -->
          <tr>
            <td bgcolor="#0284C7" style="background-color: #0284C7; background: linear-gradient(135deg, #0284C7 0%, #0369A1 50%, #0F172A 100%); padding: 36px 32px; text-align: center;">
              <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); padding: 4px 14px; border-radius: 20px; margin-bottom: 12px;">
                <span style="color: #FFFFFF; font-size: 12px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">
                  ✨ ¡Tu clínica ahora está en la nube!
                </span>
              </div>
              <h1 style="margin: 0; color: #FFFFFF !important; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.3;">
                ¡Bienvenido a OdontoCloud!
              </h1>
              <p style="margin: 8px 0 0 0; color: #E0F2FE !important; font-size: 15px; line-height: 1.5; font-weight: 500;">
                La plataforma odontológica integral diseñada para hacer crecer tu consultorio.
              </p>
            </td>
          </tr>

          <!-- Contenido Central -->
          <tr>
            <td style="padding: 36px 36px 28px 36px;">
              
              <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #0F172A; font-weight: 700;">
                Hola, <span style="color: #0284C7;">${adminName}</span> 👋
              </h2>

              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                Es un gusto darte la bienvenida. Nos complace confirmarte que la cuenta de tu clínica <strong>${clinicName}</strong> ha sido creada y activada con éxito.
              </p>

              <!-- Tarjeta de Datos de la Cuenta -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 14px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 22px 24px;">
                    <div style="font-size: 12px; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
                      📋 Resumen de tu suscripción
                    </div>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #64748B; width: 40%; font-weight: 600;">
                          Clínica:
                        </td>
                        <td style="padding: 6px 0; font-size: 14px; color: #0F172A; font-weight: 700;">
                          ${clinicName}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #64748B; font-weight: 600;">
                          Administrador:
                        </td>
                        <td style="padding: 6px 0; font-size: 14px; color: #0F172A; font-weight: 600;">
                          ${adminName}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #64748B; font-weight: 600;">
                          Usuario / Email:
                        </td>
                        <td style="padding: 6px 0; font-size: 14px; color: #0284C7; font-weight: 700;">
                          ${recipientEmail}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #64748B; font-weight: 600;">
                          Plan Habilitado:
                        </td>
                        <td style="padding: 6px 0; font-size: 14px; color: #0F172A; font-weight: 700;">
                          <span style="display: inline-block; background-color: #E0F2FE; color: #0369A1; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 800;">
                            ${planName}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #64748B; font-weight: 600;">
                          Estado:
                        </td>
                        <td style="padding: 6px 0; font-size: 14px; color: #059669; font-weight: 700;">
                          ● Activa y Operativa
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Botón Principal de Llamado a la Acción -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 32px;">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: #334155; font-weight: 600;">
                      Para comenzar a utilizar tu clínica, activa tu contraseña aquí:
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td align="center" bgcolor="#0284C7" style="border-radius: 12px; background-color: #0284C7; background: linear-gradient(135deg, #0284C7 0%, #0369A1 100%); box-shadow: 0 6px 20px -2px rgba(2, 132, 199, 0.45);">
                          <a href="${setupPasswordUrl}" target="_blank" style="display: inline-block; background-color: #0284C7; padding: 16px 36px; font-size: 16px; font-weight: 800; color: #FFFFFF !important; text-decoration: none; border-radius: 12px; letter-spacing: 0.2px;">
                            🚀 Activar mi Cuenta y Crear Contraseña
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 10px 0 0 0; font-size: 12px; color: #94A3B8;">
                      Este enlace es de uso único y privado para tu cuenta.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- 3 Pasos para Empezar -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 14px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <div style="font-size: 13px; font-weight: 800; color: #166534; margin-bottom: 12px;">
                      🎯 Próximos 3 pasos recomendados:
                    </div>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding: 4px 0; font-size: 13px; color: #15803D; line-height: 1.5;">
                          <strong>1.</strong> Define tu contraseña con el botón superior.<br>
                          <strong>2.</strong> Agrega tus consultorios / sillones y el equipo de odontólogos.<br>
                          <strong>3.</strong> ¡Empieza a registrar pacientes, agendar turnos y usar el odontograma!
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Asistencia y Soporte Humano -->
              <div style="border-top: 1px solid #E2E8F0; padding-top: 24px; font-size: 14px; color: #475569; line-height: 1.6;">
                <p style="margin: 0 0 8px 0; font-weight: 700; color: #0F172A; font-size: 15px;">
                  ¿Tienes dudas o necesitas acompañamiento para tu clínica?
                </p>
                <p style="margin: 0 0 16px 0; color: #64748B; font-size: 13px;">
                  Puedes <strong>responder directamente a este correo</strong> o ingresar a nuestro portal oficial para recibir asistencia inmediata de nuestro equipo.
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td>
                      <a href="https://odontocloudcolombia.com" target="_blank" style="display: inline-block; background-color: #F8FAFC; color: #0284C7; font-weight: 700; font-size: 13px; padding: 10px 20px; border-radius: 8px; text-decoration: none; border: 1px solid #BAE6FD;">
                        🌐 Ir a OdontoCloud Colombia
                      </a>
                    </td>
                  </tr>
                </table>
              </div>

            </td>
          </tr>

          <!-- Pie de Página -->
          <tr>
            <td style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 24px 36px; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 13px; color: #64748B; font-weight: 700;">
                OdontoCloud Colombia — Transformación Digital Odontológica
              </p>
              <p style="margin: 0; font-size: 11px; color: #94A3B8; line-height: 1.5;">
                Recibes este correo porque se activó tu cuenta en la plataforma odontológica.<br>
                OdontoCloud jamás te solicitará contraseñas confidenciales por este medio.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;

const requestData = {
  from: "OdontoCloud <bienvenido@odontocloudcolombia.com>",
  reply_to: "madridsystem@outlook.es",
  to: [recipientEmail],
  subject: "¡Bienvenido a OdontoCloud! - Configura tu acceso a Clínica Dental Demo",
  html: htmlBody,
  text: textBody,
};

const payload = JSON.stringify(requestData);

console.log("--------------------------------------------------");
console.log("Enviando correo de bienvenida vía Resend...");
console.log("Remitente: OdontoCloud <bienvenido@odontocloudcolombia.com>");
console.log("Destinatario:", recipientEmail);
console.log("--------------------------------------------------");

const req = https.request(
  {
    hostname: "api.resend.com",
    port: 443,
    path: "/emails",
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey.trim()}`,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
    },
  },
  (res) => {
    let body = "";
    res.on("data", (chunk) => (body += chunk));
    res.on("end", () => {
      console.log(`Código HTTP respuesta Resend: ${res.statusCode}`);
      try {
        const json = JSON.parse(body);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log("\n==================================================");
          console.log("¡CORREO ENVIADO CON ÉXITO A TRAVÉS DE RESEND!");
          console.log("Resend Email ID:", json.id);
          console.log("Revisa en: madridsystem@outlook.es");
          console.log("==================================================\n");
        } else {
          console.error("\nError retornado por la API de Resend:", json);
        }
      } catch (e) {
        console.log("Respuesta en texto:", body);
      }
    });
  }
);

req.on("error", (err) => {
  console.error("Error de red conectando a Resend:", err.message);
});

req.write(payload);
req.end();
