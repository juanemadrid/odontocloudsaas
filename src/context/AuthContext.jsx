import React, { createContext, useContext, useEffect, useState } from "react";
import supabase from "../lib/supabaseClient";

const AuthContext = createContext({
  user: null,          // Supabase Auth User
  userProfile: null,   // Supabase Profile (with tenant & roles)
  loading: true,
  logout: () => Promise.resolve(),
  signIn: () => Promise.resolve(),
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (authUser, forceRefresh = false) => {
    if (!authUser) return null;
    const cacheKey = `oc_user_profile_${authUser.id}`;
    if (!forceRefresh) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          // Descartar caché si no tiene inquilino válido
          if (parsed && parsed.inquilino) {
            console.log("AuthContext - Usando caché con inquilino:", parsed.inquilino);
            return parsed;
          } else {
            console.warn("AuthContext - Caché inválido (sin inquilino), recargando...");
            sessionStorage.removeItem(cacheKey);
          }
        }
      } catch (e) {}
    }

    try {
      // Consultar perfil e información completa del tenant en Supabase
      let { data: profile, error } = await supabase
        .from("profiles")
        .select("id, role, full_name, tenant_id, tenant:tenants(id, nombre, direccion, telefono, logo_url, nit, plan, activo, created_at, parametros)")
        .eq("id", authUser.id)
        .maybeSingle();

      if (error) {
        console.warn("AuthContext - Error al obtener perfil desde Supabase:", error.message);
      }

      // Auto-recuperación de perfil si el usuario está en auth.users pero no tiene fila en public.profiles
      if (!profile && authUser.email) {
        console.warn("AuthContext - Perfil no encontrado para el usuario autenticado, iniciando auto-recuperación...");
        const meta = authUser.user_metadata || {};
        const tenantId = meta.tenant_id;
        const fullName = meta.full_name || authUser.email;
        const userRole = meta.role || "admin";

        if (tenantId) {
          try {
            // 1. Asegurar la clínica en public.tenants
            await supabase.from("tenants").upsert([{
              id: tenantId,
              nombre: `Clínica ${fullName}`,
              activo: true
            }]);

            // 2. Crear el perfil en public.profiles
            await supabase.from("profiles").upsert([{
              id: authUser.id,
              email: authUser.email.toLowerCase().trim(),
              full_name: fullName,
              role: userRole,
              tenant_id: tenantId,
              activo: true
            }]);

            // 3. Re-consultar perfil recién sanado
            const { data: healedProfile } = await supabase
              .from("profiles")
              .select("id, role, full_name, tenant_id, tenant:tenants(id, nombre, direccion, telefono, logo_url, nit, plan, activo, created_at, parametros)")
              .eq("id", authUser.id)
              .maybeSingle();

            if (healedProfile) {
              profile = healedProfile;
            }
          } catch (healErr) {
            console.error("AuthContext - Error durante auto-recuperación de perfil:", healErr);
          }
        }
      }

      if (profile) {
        // Asignar fallback seguro si la relación tenant no pudo unirse por RLS
        if (!profile.tenant) {
          profile.tenant = {
            id: profile.tenant_id || "2e573a5a-70b2-4175-8332-4ebfa9bc0836",
            nombre: "ATM Centro del Dolor",
            activo: true
          };
        }

        // Para usuarios no superadmin, verificar únicamente si la cuenta se desactivó explícitamente (activo === false)
        const isSuperAdmin = authUser.email?.toLowerCase() === "madridsystem@outlook.es" || (profile.role || "").toLowerCase() === "superadmin";
        if (!isSuperAdmin && profile.activo === false) {
          console.warn("AuthContext - Perfil desactivado explícitamente, cerrando sesión...");
          try { sessionStorage.removeItem(cacheKey); } catch {}
          await supabase.auth.signOut();
          return null;
        }

        let permisosConfig = null;
        let extraLogo = "";
        try {
          const { data: wData } = await supabase
            .from("website_config")
            .select("config")
            .eq("tenant_id", profile.tenant_id)
            .maybeSingle();

          extraLogo = wData?.config?.empresa_datos?.logoUrl || "";

          const perfiles = wData?.config?.perfiles || [];
          const userRoleName = (profile.role || "").trim().toLowerCase();
          const matchedPerfil = perfiles.find(p => {
            const pName = (p.nombre || p.id || "").trim().toLowerCase();
            if (!pName || !userRoleName) return false;
            return pName === userRoleName ||
                   userRoleName.includes(pName) ||
                   pName.includes(userRoleName);
          });
          if (matchedPerfil?.permisos) {
            permisosConfig = matchedPerfil.permisos;
          }

        } catch (e) {
          console.warn("Error cargando permisos de perfil:", e);
        }

        let masterPlans = [];
        try {
          // Leer planes maestros directamente (sin RPC que puede no existir)
          const { data: masterCfg } = await supabase
            .from("website_config")
            .select("config")
            .eq("tenant_id", "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")
            .maybeSingle();
          masterPlans = masterCfg?.config?.plans || [];
        } catch (e) {}

        const tenantData = profile.tenant || {};
        const rawPlanKey = (tenantData.plan || "free").toString().toLowerCase().trim();

        const matchedMasterPlan = masterPlans.find(p => {
          const pId = (p.id || "").toLowerCase();
          const pName = (p.name || "").toLowerCase();
          return pId === rawPlanKey ||
                 pId.includes(rawPlanKey) || rawPlanKey.includes(pId) ||
                 pName.includes(rawPlanKey) || rawPlanKey.includes(pName);
        });

        const activePlanObj = matchedMasterPlan || {
          id: rawPlanKey,
          name: rawPlanKey.includes('clinica') || rawPlanKey.includes('pro') ? 'Clínica' : rawPlanKey.includes('enterp') ? 'Enterprise' : 'Consultorio',
          monthlyPrice: rawPlanKey.includes('clinica') || rawPlanKey.includes('pro') ? 99900 : rawPlanKey.includes('enterp') ? 165800 : 59900,
          yearlyPrice: rawPlanKey.includes('clinica') || rawPlanKey.includes('pro') ? 1190000 : rawPlanKey.includes('enterp') ? 1990000 : 599000,
          maxUsers: rawPlanKey.includes('clinica') || rawPlanKey.includes('pro') ? 12 : rawPlanKey.includes('enterp') ? 999 : 2
        };

        const createdAtDate = tenantData.created_at ? new Date(tenantData.created_at) : new Date();
        const subEndDate = tenantData.parametros?.subscription_end_date ||
                           tenantData.subscription_end_date ||
                           new Date(createdAtDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const resolvedLogo = tenantData.logo_url || tenantData.logoUrl || tenantData.logo || extraLogo || "";

        const fullProfile = {
          ...profile,
          uid: profile.id,
          rol: (profile.role || "odontologo").trim().toLowerCase(),
          role: profile.role,
          permisos: permisosConfig,
          inquilino: profile.tenant_id,
          nombre: profile.full_name,
          nombreCompleto: profile.full_name,
          tenant: {
            id: tenantData.id || profile.tenant_id,
            nombre: tenantData.nombre || tenantData.name || tenantData.nombreComercial || "Clínica Dental",
            nombreComercial: tenantData.nombreComercial || tenantData.nombre || tenantData.name || "Clínica Dental",
            direccion: tenantData.direccion || tenantData.address || "No configurada",
            telefono: tenantData.telefono || tenantData.phone || "---",
            logo: resolvedLogo,
            logo_url: resolvedLogo,
            nit: tenantData.nit || "",
            planId: activePlanObj.id || rawPlanKey,
            plan: activePlanObj,
            subscriptionEndDate: subEndDate,
            createdAt: tenantData.created_at
          }
        };

        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(fullProfile));
        } catch {
          // El almacenamiento de sesión puede no estar disponible.
        }
        return fullProfile;
      }

      // Fallback: leer tenant_id y rol desde el JWT (user_metadata)
      // Esto funciona cuando RLS aún no permite leer profiles pero el JWT ya tiene los datos
      const meta = authUser.user_metadata || {};
      const isSuperAdminEmail = authUser.email?.toLowerCase() === "madridsystem@outlook.es";
      const isAtmEmail = authUser.email?.toLowerCase() === "atmcentrodeldolor@gmail.com";
      const jwtTenantId = meta.tenant_id || (isAtmEmail ? "2e573a5a-70b2-4175-8332-4ebfa9bc0836" : (isSuperAdminEmail ? "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" : "2e573a5a-70b2-4175-8332-4ebfa9bc0836"));
      const jwtRole = meta.role || (isSuperAdminEmail ? "superadmin" : "admin");
      const jwtName = meta.full_name || (isAtmEmail ? "ATM Centro del Dolor" : authUser.email?.split("@")[0]?.toUpperCase() || "Usuario");

      if (jwtTenantId) {
        console.log("AuthContext - Usando fallback JWT para tenant_id:", jwtTenantId);

        // Intentar cargar datos del tenant
        let tenantInfo = { id: jwtTenantId, nombre: "Mi Clínica", nombreComercial: "Mi Clínica" };
        try {
          const { data: tenantRow } = await supabase
            .from("tenants")
            .select("id, nombre, nit, telefono, direccion, logo_url, plan, activo")
            .eq("id", jwtTenantId)
            .maybeSingle();
          if (tenantRow) {
            tenantInfo = {
              id: tenantRow.id,
              nombre: tenantRow.nombre || "Mi Clínica",
              nombreComercial: tenantRow.nombre || "Mi Clínica",
              nit: tenantRow.nit || "",
              telefono: tenantRow.telefono || "",
              direccion: tenantRow.direccion || "",
              logo: tenantRow.logo_url || "",
              logo_url: tenantRow.logo_url || "",
              plan: { id: tenantRow.plan || "free" },
              activo: tenantRow.activo
            };
          }
        } catch (e) {
          console.warn("AuthContext - No se pudo cargar tenant desde fallback JWT:", e);
        }

        const fallbackProfile = {
          uid: authUser.id,
          id: authUser.id,
          email: authUser.email,
          rol: jwtRole.trim().toLowerCase(),
          role: jwtRole,
          inquilino: jwtTenantId,
          tenant_id: jwtTenantId,
          nombre: jwtName,
          nombreCompleto: jwtName,
          tenant: tenantInfo
        };

        try { sessionStorage.setItem(cacheKey, JSON.stringify(fallbackProfile)); } catch (e) {}
        return fallbackProfile;
      }

      // Sin tenant_id no se puede operar
      console.warn("AuthContext - No se pudo obtener tenant_id para el usuario:", authUser.email);
      return null;
    } catch (e) {
      console.error("AuthContext - Error en fetchUserProfile:", e);
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Timeout de seguridad: si en 8 segundos no terminó de cargar, desbloquear
    const safetyTimeout = setTimeout(() => {
      if (isMounted) {
        console.warn("AuthContext - Timeout de seguridad: forzando loading=false");
        setLoading(false);
      }
    }, 8000);

    // Inicializar sesión Supabase
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      if (session?.user) {
        setUser(session.user);
        const prof = await fetchUserProfile(session.user);
        if (isMounted) setUserProfile(prof);
      } else {
        setUser(null);
        setUserProfile(null);
      }
      if (isMounted) {
        clearTimeout(safetyTimeout);
        setLoading(false);
      }
    }).catch(err => {
      console.error("AuthContext - Error obteniendo sesión de Supabase:", err);
      if (isMounted) {
        clearTimeout(safetyTimeout);
        setLoading(false);
      }
    });

    // Escuchar cambios de autenticación en tiempo real en Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("AuthContext - Evento Supabase Auth:", event);
      if (!isMounted) return;

      if (session?.user) {
        setUser(session.user);
        const prof = await fetchUserProfile(session.user);
        if (isMounted && prof) {
          setUserProfile(prev => {
            if (prev && prev.id === prof.id && prev.tenant_id === prof.tenant_id && prev.role === prof.role && prev.nombreCompleto === prof.nombreCompleto && prev.tenant?.id === prof.tenant?.id) {
              return prev;
            }
            return prof;
          });
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      if (isMounted) setLoading(false);
    });

    const handleTenantUpdated = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && isMounted) {
        const prof = await fetchUserProfile(session.user, true);
        if (isMounted) setUserProfile(prof);
      }
    };
    window.addEventListener("tenant-updated", handleTenantUpdated);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
      subscription?.unsubscribe();
      window.removeEventListener("tenant-updated", handleTenantUpdated);
    };
  }, []);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    try {
      sessionStorage.clear();
    } catch (e) {}
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("AuthContext - Error durante logout de Supabase:", e);
    }
    try {
      localStorage.removeItem("odc_session");
    } catch (e) {}
    setUser(null);
    setUserProfile(null);
  };

  const value = {
    user,
    userProfile,
    setUserProfile,
    loading,
    logout,
    signIn
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
