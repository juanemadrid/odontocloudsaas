import * as z from "zod";

export const patientSchema = z.object({
    id: z.string().optional(),

    // 1. Identificación (SOLO CAMPOS CRÍTICOS OBLIGATORIOS)
    tipoDocumento: z.string().min(1, "El tipo de documento es obligatorio"),
    nroDocumento: z.string()
        .min(3, "El número de documento debe tener al menos 3 caracteres")
        .refine((val) => {
            const numeros = val.replace(/\D/g, '');
            return numeros.length >= 6 && numeros.length <= 12;
        }, "Documento debe tener entre 6 y 12 dígitos"),
    nroHistoria: z.string().optional(),
    nombres: z.string().min(2, "Los nombres son obligatorios"),
    apellidos: z.string().min(2, "Los apellidos son obligatorios"),
    nombreCompleto: z.string().optional(),
    sexo: z.string().min(1, "El sexo es obligatorio"),
    estadoCivil: z.string().min(1, "El estado civil es obligatorio"),
    paisNacimiento: z.string().min(1, "El país de nacimiento es obligatorio"),
    ciudadNacimiento: z.string().optional(),
    fechaNacimiento: z.string().min(1, "La fecha de nacimiento es obligatoria"),
    fechaIngreso: z.string().optional(),

    // 2. Ubicación y Contacto
    paisDomicilio: z.string().min(1, "El país de domicilio es obligatorio"),
    ciudadDomicilio: z.string().min(1, "La ciudad de domicilio es obligatoria"),
    barrio: z.string().min(1, "El barrio es obligatorio"),
    lugarResidencia: z.string().min(1, "El lugar de residencia es obligatorio"),
    estrato: z.string().optional(),
    zonaResidencial: z.string().min(1, "La zona residencial es obligatoria"),
    esExtranjero: z.boolean().default(false),
    permitePublicidad: z.boolean().default(true),

    celular: z.string()
        .min(7, "El celular debe tener al menos 7 dígitos")
        .regex(/^\d+$/, "El celular solo debe contener números")
        .refine((val) => {
            // Validación para número colombiano: debe tener 10 dígitos y empezar con 3
            const numeros = val.replace(/\D/g, '');
            if (numeros.length === 10 && numeros.startsWith('3')) return true;
            // Si no es colombiano, permitir mínimo 7 dígitos
            return numeros.length >= 7;
        }, "Celular colombiano debe tener 10 dígitos y empezar con 3"),
    prefijoCelular: z.string().optional(),
    telDomicilio: z.string().optional(),
    telOficina: z.string().optional(),
    extension: z.string().optional(),
    email: z.string()
        .min(1, "El correo electrónico es obligatorio")
        .email("El correo electrónico no es válido")
        .refine((val) => {
            // Validación adicional: debe tener @ y punto después del @
            const parts = val.split('@');
            return parts.length === 2 && parts[1].includes('.');
        }, "Formato de correo inválido"),
    ocupacion: z.string().min(2, "La ocupación es obligatoria"),

    // 3. Facturación y Responsables (TODO OPCIONAL)
    multiplesResponsables: z.boolean().default(false),
    asociarTercero: z.string().optional(),
    nombreResponsable: z.string().optional(),
    parentesco: z.string().optional(),
    celularResponsable: z.string().optional(),
    telefonoResponsable: z.string().optional(),
    emailResponsable: z.string().optional().or(z.literal("")),

    nombreAcompanante: z.string().optional(),
    telefonoAcompanante: z.string().optional(),

    // 4. Mercadeo y EPS (SIMPLIFICADO)
    planId: z.string().optional(),
    planNombre: z.string().optional(),
    convenioBeneficio: z.string().optional(),
    convenioPago: z.string().optional(),
    comoConocio: z.string().optional(),
    campania: z.string().optional(),
    remitidoPorType: z.string().default("Libre"),
    remitidoPorValue: z.string().optional(),
    asesorComercialType: z.string().default("Libre"),
    asesorComercialValue: z.string().optional(),

    nombreEps: z.string().optional().or(z.literal("")),
    tipoVinculacion: z.string().optional().or(z.literal("")),
    polizaSalud: z.string().optional(),

    // 5. Otros
    profesionalId: z.string().optional(),
    profesionalNombre: z.string().optional(),
    notas: z.string().optional(),
    fotoUrl: z.string().optional(),
    alertas: z.string().optional(),
    edad: z.string().optional(),
});
