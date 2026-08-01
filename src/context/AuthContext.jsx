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
        if (cached) return JSON.parse(cached);
      } catch (e) {}
    }

    try {
      // Consultar perfil e información completa del tenant en Supabase
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, role, full_name, tenant_id, tenant:tenants(id, nombre, direccion, telefono, logo_url, nit, plan, activo, created_at, parametros)")
        .eq("id", authUser.id)
        .maybeSingle();

      if (error) {
        console.warn("AuthContext - Error al obtener perfil desde Supabase:", error.message);
      }

      if (profile) {
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
          const { data: superConfig } = await supabase
            .from("website_config")
            .select("config")
            .eq("tenant_id", "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")
            .maybeSingle();
          masterPlans = superConfig?.config?.plans || [];
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



        if (authUser.email === "madridsystem@outlook.es") {
          fullProfile.rol = "superadmin";
        }

        try { sessionStorage.setItem(cacheKey, JSON.stringify(fullProfile)); } catch (e) {}
        return fullProfile;
      }


      // 2. Profile fallback: Buscar si el usuario pertenece a una clínica registrada en website_config JSONB
      try {
        const { data: webConfig } = await supabase
          .from("website_config")
          .select("config")
          .eq("tenant_id", "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")
          .maybeSingle();

        const registeredTenants = webConfig?.config?.registered_tenants || [];
        const userEmail = (authUser.email || "").toLowerCase();
        const matchingTenant = registeredTenants.find(t => 
          (t.adminEmail && t.adminEmail.toLowerCase() === userEmail) ||
          (t.contactEmail && t.contactEmail.toLowerCase() === userEmail)
        );

        if (matchingTenant) {
          return {
            uid: authUser.id,
            email: authUser.email,
            rol: "administrador",
            inquilino: matchingTenant.id,
            nombre: matchingTenant.nombre || matchingTenant.name || authUser.email.split("@")[0],
            tenant: {
              id: matchingTenant.id,
              nombre: matchingTenant.nombre || matchingTenant.name,
              nombreComercial: matchingTenant.nombre || matchingTenant.name,
              direccion: matchingTenant.direccion || matchingTenant.address || "---",
              telefono: matchingTenant.telefono || "---",
              logo: matchingTenant.logo_url || matchingTenant.logoUrl || matchingTenant.logo || "",
              nit: matchingTenant.nit || ""
            }
          };
        }
      } catch (tErr) {
        console.warn("AuthContext - Error buscando tenant en website_config:", tErr);
      }

      // Profile fallback por defecto
      return {
        uid: authUser.id,
        email: authUser.email,
        rol: authUser.email === "madridsystem@outlook.es" ? "superadmin" : "recepcionista",
        inquilino: authUser.email === "madridsystem@outlook.es" ? "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" : null,
        nombre: authUser.email ? authUser.email.split("@")[0].toUpperCase() : "Usuario",
      };
    } catch (e) {
      console.error("AuthContext - Error en fetchUserProfile:", e);
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;

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
      if (isMounted) setLoading(false);
    }).catch(err => {
      console.error("AuthContext - Error obteniendo sesión de Supabase:", err);
      if (isMounted) setLoading(false);
    });

    // Escuchar cambios de autenticación en tiempo real en Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("AuthContext - Evento Supabase Auth:", event);
      if (!isMounted) return;

      if (session?.user) {
        setUser(session.user);
        const prof = await fetchUserProfile(session.user);
        if (isMounted) setUserProfile(prof);
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
