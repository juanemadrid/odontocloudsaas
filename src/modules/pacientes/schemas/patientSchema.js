import * as z from "zod";

const requiredString = (msg) => z.string({
    invalid_type_error: msg,
    required_error: msg
}).trim().min(1, msg);

export const patientSchema = z.object({
    id: z.string().optional(),

    // 1. Identificación (SOLO CAMPOS CRÍTICOS OBLIGATORIOS)
    tipoDocumento: requiredString("El tipo de documento es obligatorio"),
    nroDocumento: z.string({
            invalid_type_error: "El número de documento es obligatorio",
            required_error: "El número de documento es obligatorio"
        })
        .min(3, "El número de documento debe tener al menos 3 caracteres")
        .refine((val) => {
            const numeros = (val || '').replace(/\D/g, '');
            return numeros.length >= 6 && numeros.length <= 12;
        }, "Documento debe tener entre 6 y 12 dígitos"),
    nroHistoria: z.string().optional().or(z.literal("")),
    nombres: requiredString("Los nombres son obligatorios"),
    apellidos: requiredString("Los apellidos son obligatorios"),
    nombreCompleto: z.string().optional().or(z.literal("")),
    sexo: requiredString("El sexo es obligatorio"),
    estadoCivil: requiredString("El estado civil es obligatorio"),
    paisNacimiento: requiredString("El país de nacimiento es obligatorio"),
    ciudadNacimiento: z.string().optional().or(z.literal("")),
    fechaNacimiento: requiredString("La fecha de nacimiento es obligatoria"),
    fechaIngreso: z.string().optional().or(z.literal("")),

    // 2. Ubicación y Contacto
    paisDomicilio: requiredString("El país de domicilio es obligatorio"),
    ciudadDomicilio: requiredString("La ciudad de domicilio es obligatoria"),
    barrio: requiredString("El barrio es obligatorio"),
    lugarResidencia: requiredString("El lugar de residencia es obligatorio"),
    estrato: z.string().optional().or(z.literal("")),
    zonaResidencial: requiredString("La zona residencial es obligatoria"),
    esExtranjero: z.boolean().default(false),
    permitePublicidad: z.boolean().default(true),

    celular: z.string({
            invalid_type_error: "El celular es obligatorio",
            required_error: "El celular es obligatorio"
        })
        .min(7, "El celular debe tener al menos 7 dígitos")
        .regex(/^\d+$/, "El celular solo debe contener números")
        .refine((val) => {
            const numeros = (val || '').replace(/\D/g, '');
            if (numeros.length === 10 && numeros.startsWith('3')) return true;
            return numeros.length >= 7;
        }, "Celular colombiano debe tener 10 dígitos y empezar con 3"),
    prefijoCelular: z.string().optional().or(z.literal("")),
    telDomicilio: z.string().optional().or(z.literal("")),
    telOficina: z.string().optional().or(z.literal("")),
    extension: z.string().optional().or(z.literal("")),
    email: z.string({
            invalid_type_error: "El correo electrónico es obligatorio",
            required_error: "El correo electrónico es obligatorio"
        })
        .min(1, "El correo electrónico es obligatorio")
        .email("El correo electrónico no es válido")
        .refine((val) => {
            if (!val) return false;
            const parts = val.split('@');
            return parts.length === 2 && parts[1].includes('.');
        }, "Formato de correo inválido"),
    ocupacion: requiredString("La ocupación es obligatoria"),

    // 3. Facturación y Responsables (TODO OPCIONAL)
    multiplesResponsables: z.boolean().default(false),
    asociarTercero: z.string().optional().or(z.literal("")),
    nombreResponsable: z.string().optional().or(z.literal("")),
    parentesco: z.string().optional().or(z.literal("")),
    celularResponsable: z.string().optional().or(z.literal("")),
    telefonoResponsable: z.string().optional().or(z.literal("")),
    emailResponsable: z.string().optional().or(z.literal("")),

    nombreAcompanante: z.string().optional().or(z.literal("")),
    telefonoAcompanante: z.string().optional().or(z.literal("")),

    // 4. Mercadeo y EPS (SIMPLIFICADO)
    planId: z.string().optional().or(z.literal("")),
    planNombre: z.string().optional().or(z.literal("")),
    convenioBeneficio: z.string().optional().or(z.literal("")),
    convenioPago: z.string().optional().or(z.literal("")),
    comoConocio: z.string().optional().or(z.literal("")),
    campania: z.string().optional().or(z.literal("")),
    remitidoPorType: z.string().default("Libre"),
    remitidoPorValue: z.string().optional().or(z.literal("")),
    asesorComercialType: z.string().default("Libre"),
    asesorComercialValue: z.string().optional().or(z.literal("")),

    nombreEps: z.string().optional().or(z.literal("")),
    tipoVinculacion: z.string().optional().or(z.literal("")),
    polizaSalud: z.string().optional().or(z.literal("")),

    // 5. Otros
    profesionalId: z.string().optional().or(z.literal("")),
    profesionalNombre: z.string().optional().or(z.literal("")),
    notas: z.string().optional().or(z.literal("")),
    fotoUrl: z.string().optional().or(z.literal("")),
    alertas: z.string().optional().or(z.literal("")),
    edad: z.string().optional().or(z.literal("")),
});
