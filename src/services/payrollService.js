// src/services/payrollService.js
import supabase from "../lib/supabaseClient";

export const getEmployees = async (tenantId) => {
    if (!tenantId) return [];
    try {
        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("tenant_id", tenantId)
            .order("full_name", { ascending: true });

        if (error) throw error;

        return (data || []).map(e => ({
            id: e.id,
            nombre: e.full_name,
            name: e.full_name,
            email: e.email,
            rol: e.role,
            salary: 2000000,
            salarioBase: 2000000
        }));
    } catch (e) {
        console.error("Error al obtener empleados de Supabase:", e);
        return [];
    }
};

export const addEmployee = async (tenantId, employeeData) => {
    const payload = {
        tenant_id: tenantId,
        full_name: employeeData.nombre || employeeData.name,
        email: employeeData.email || "",
        role: employeeData.rol || "odontologo",
        activo: true
    };

    const { data, error } = await supabase
        .from("profiles")
        .insert([payload])
        .select()
        .single();

    if (error) throw error;
    return data.id;
};

export const updateEmployee = async (employeeId, employeeData) => {
    const payload = {
        full_name: employeeData.nombre || employeeData.name,
        role: employeeData.rol || "odontologo"
    };

    const { error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", employeeId);

    if (error) throw error;
};

export const deleteEmployee = async (employeeId) => {
    const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", employeeId);

    if (error) throw error;
};

export const getPayrollRecords = async (tenantId, period) => {
    if (!tenantId) return [];
    try {
        const { data, error } = await supabase
            .from("liquidaciones")
            .select("*, profesional:profiles(full_name)")
            .eq("tenant_id", tenantId)
            .eq("periodo", period || "")
            .order("created_at", { ascending: false });

        if (error) throw error;

        return (data || []).map(d => ({
            id: d.id,
            employeeName: d.profesional?.full_name || "Empleado",
            period: d.periodo,
            totalNeto: Number(d.monto || 0),
            statusDian: d.estado || "Pendiente",
            createdAt: d.created_at
        }));
    } catch (e) {
        console.error("Error al obtener nómina de Supabase:", e);
        return [];
    }
};

export const generatePayrollRecord = async (tenantId, employee, period) => {
    const salaryBase = Number(employee.salary || employee.salarioBase || 2000000);
    const salud = salaryBase * 0.04;
    const pension = salaryBase * 0.04;
    const totalDeducciones = salud + pension;
    const totalNeto = salaryBase - totalDeducciones;

    const payload = {
        tenant_id: tenantId,
        profesional_id: employee.id,
        periodo: period || new Date().toISOString().slice(0, 7),
        monto: totalNeto,
        estado: "Pendiente"
    };

    const { data, error } = await supabase
        .from("liquidaciones")
        .insert([payload])
        .select()
        .single();

    if (error) throw error;

    return {
        id: data.id,
        employeeId: employee.id,
        employeeName: employee.nombre || employee.name,
        period: data.periodo,
        salaryBase,
        deducciones: { salud, pension, total: totalDeducciones },
        totalNeto,
        statusDian: "Pendiente"
    };
};

export const sendPayrollToDian = async (payrollId) => {
    const { error } = await supabase
        .from("liquidaciones")
        .update({ estado: "Enviado" })
        .eq("id", payrollId);

    if (error) throw error;
    return "Enviado";
};
