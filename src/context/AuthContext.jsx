import React, { createContext, useContext, useEffect, useState } from "react";
import supabase from "../lib/supabaseClient";

const AuthContext = createContext({
  user: null,          // Supabase Auth User
  userProfile: null,   // Supabase Profile (with tenant & roles)
  loading: true,
  logout: () => Promise.resolve(),
  signIn: () => Promise.resolve(),
});

const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;

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
          const cacheAge = Date.now() - Number(parsed?.cachedAt || 0);
          // Reusar únicamente perfiles completos y recientes. Así una suspensión
          // o cambio de permisos no queda oculto durante toda la sesión.
          if (parsed && parsed.inquilino && cacheAge >= 0 && cacheAge < PROFILE_CACHE_TTL_MS) {
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
        .select("id, role, full_name, tenant_id, telefono, registro_medico, tarjeta_profesional, firma, firma_url, foto_perfil, activo, tenant:tenants(id, nombre, direccion, telefono, logo_url, nit, plan, activo, created_at, parametros)")
        .eq("id", authUser.id)
        .maybeSingle();

      if (error) {
        // Fallback select without newer columns if table schema varies
        try {
          const { data: pBasic } = await supabase
            .from("profiles")
            .select("id, role, full_name, tenant_id, tenant:tenants(id, nombre, direccion, telefono, logo_url, nit, plan, activo, created_at, parametros)")
            .eq("id", authUser.id)
            .maybeSingle();
          if (pBasic) profile = pBasic;
        } catch {}
      }

      if (profile) {
        // Nunca inventar ni reutilizar el tenant de otra clínica. Si la relación
        // no está disponible, conservar sólo el tenant_id autorizado del perfil.
        if (!profile.tenant) {
          profile.tenant = {
            id: profile.tenant_id,
            nombre: "Clínica"
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
        let empresaNombre = "";
        let userDetail = {};

        try {
          const { data: wData } = await supabase
            .from("website_config")
            .select("config")
            .eq("tenant_id", profile.tenant_id)
            .maybeSingle();

          extraLogo = wData?.config?.empresa_datos?.logoUrl || "";
          empresaNombre = wData?.config?.empresa_datos?.nombre || 
                          wData?.config?.empresa_datos?.razonSocial || 
                          wData?.config?.empresa_datos?.nombreComercial || "";

          userDetail = wData?.config?.user_details?.[authUser.id] || {};

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
        const resolvedTenantName = tenantData.nombreComercial || 
                                   tenantData.nombre || 
                                   tenantData.name || 
                                   empresaNombre || 
                                   "Clínica Odontológica";

        const firmaResuelta = profile.firma || profile.firma_url || userDetail.firma || userDetail.firmaElectronica || null;
        const regMedicoResuelto = profile.registro_medico || profile.tarjeta_profesional || userDetail.registroMedico || userDetail.tarjetaProfesional || "";
        const fotoPerfilResuelta = profile.foto_perfil || userDetail.fotoPerfil || authUser.user_metadata?.avatar_url || "";
        const telefonoResuelto = profile.telefono || userDetail.telefonoMovil || userDetail.telefono || "";
        const esDoctorResuelto = userDetail.esDoctor ?? (
            (profile.role || "").toLowerCase().includes('doctor') || 
            (profile.role || "").toLowerCase().includes('odont') ||
            (profile.role || "").toLowerCase().includes('especialista') ||
            (profile.role || "").toLowerCase().includes('profesional')
        );

        const fullProfile = {
          ...profile,
          cachedAt: Date.now(),
          uid: profile.id,
          rol: (profile.role || "odontologo").trim().toLowerCase(),
          role: profile.role,
          esDoctor: esDoctorResuelto,
          permisos: permisosConfig,
          inquilino: profile.tenant_id,
          nombre: profile.full_name || userDetail.nombreCompleto || "",
          nombreCompleto: profile.full_name || userDetail.nombreCompleto || "",
          telefono: telefonoResuelto,
          telefonoMovil: telefonoResuelto,
          registroMedico: regMedicoResuelto,
          tarjetaProfesional: regMedicoResuelto,
          firma: firmaResuelta,
          firmaElectronica: firmaResuelta,
          fotoPerfil: fotoPerfilResuelta,
          clinica: resolvedTenantName,
          tenantNombre: resolvedTenantName,
          tenant: {
            id: tenantData.id || profile.tenant_id,
            nombre: resolvedTenantName,
            nombreComercial: resolvedTenantName,
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

      // Único fallback permitido: app_metadata, que sólo puede escribir el
      // servidor. user_metadata nunca decide tenant ni rol.
      const appMeta = authUser.app_metadata || {};
      const userMeta = authUser.user_metadata || {};
      const jwtTenantId = appMeta.tenant_id || null;
      const jwtRole = appMeta.role || null;
      const jwtName = userMeta.full_name || authUser.email?.split("@")[0]?.toUpperCase() || "Usuario";

      if (jwtTenantId && jwtRole) {

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
          cachedAt: Date.now(),
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

  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(false);

  const getDeviceSessionId = () => {
    let id = localStorage.getItem("odc_device_session_id");
    if (!id) {
      id = "sess_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
      try { localStorage.setItem("odc_device_session_id", id); } catch {}
    }
    return id;
  };

  useEffect(() => {
    let isMounted = true;
    let sessionChannel = null;

    // Timeout de seguridad: si en 8 segundos no terminó de cargar, desbloquear
    const safetyTimeout = setTimeout(() => {
      if (isMounted) {
        console.warn("AuthContext - Timeout de seguridad: forzando loading=false");
        setLoading(false);
      }
    }, 8000);

    // Función para suscribirse al canal de sesión única del usuario en Supabase Realtime
    const setupSingleSessionChannel = (userId) => {
      if (!userId) return;
      if (sessionChannel) {
        try { supabase.removeChannel(sessionChannel); } catch {}
      }

      sessionChannel = supabase.channel(`user-session-${userId}`, {
        config: { broadcast: { self: false } }
      });

      sessionChannel
        .on("broadcast", { event: "force_logout_previous" }, (payload) => {
          const incomingId = payload?.payload?.sessionId;
          const currentLocalId = localStorage.getItem("odc_device_session_id");
          // Solo cerrar si proviene de otro dispositivo con id diferente
          if (incomingId && incomingId !== currentLocalId) {
            console.warn("AuthContext - Se ha iniciado sesión desde otro dispositivo.");
            setSessionExpiredNotice(true);
            logout(false);
          }
        })
        .subscribe();
    };

    const verifyActiveDeviceSession = (authUser) => {
      if (!authUser) return true;
      const serverSessionId = authUser.user_metadata?.active_device_session_id;
      const currentLocalId = localStorage.getItem("odc_device_session_id");
      if (serverSessionId && currentLocalId && serverSessionId !== currentLocalId) {
        console.warn("AuthContext - Sesión reemplazada por otro dispositivo (Server Check).");
        setSessionExpiredNotice(true);
        logout(false);
        return false;
      }
      return true;
    };

    // Inicializar sesión Supabase
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      if (session?.user) {
        const isValid = verifyActiveDeviceSession(session.user);
        if (!isValid) {
          if (isMounted) {
            clearTimeout(safetyTimeout);
            setLoading(false);
          }
          return;
        }
        setUser(session.user);
        setupSingleSessionChannel(session.user.id);
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      window.setTimeout(async () => {
        if (!isMounted) return;
        if (session?.user) {
          const isValid = verifyActiveDeviceSession(session.user);
          if (!isValid) return;

          setUser(session.user);
          setupSingleSessionChannel(session.user.id);
          const prof = await fetchUserProfile(session.user);
          if (isMounted) {
            setUserProfile(prev => {
              if (prev && prof && prev.id === prof.id && prev.tenant_id === prof.tenant_id && prev.role === prof.role && prev.nombreCompleto === prof.nombreCompleto && prev.tenant?.id === prof.tenant?.id) {
                return prev;
              }
              return prof;
            });
          }
        } else {
          setUser(null);
          setUserProfile(null);
          if (sessionChannel) {
            try { supabase.removeChannel(sessionChannel); } catch {}
          }
        }
        if (isMounted) setLoading(false);
      }, 0);
    });

    // Verificación periódica y al reactivar la pestaña/pantalla del celular o computador
    const handleVisibilityOrFocus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && isMounted) {
          verifyActiveDeviceSession(session.user);
        }
      } catch {}
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

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
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("tenant-updated", handleTenantUpdated);
      if (sessionChannel) {
        try { supabase.removeChannel(sessionChannel); } catch {}
      }
    };
  }, []);

  const signIn = async (email, password) => {
    // Generar nuevo session ID exclusivo para este inicio de sesión
    const newSessionId = "sess_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
    try {
      localStorage.setItem("odc_device_session_id", newSessionId);
      sessionStorage.clear();
    } catch {}

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;

    // Actualizar metadata en el servidor de Supabase para invalidar cualquier otro dispositivo
    if (data?.user?.id) {
      try {
        await supabase.auth.updateUser({
          data: { active_device_session_id: newSessionId }
        });
      } catch (e) {
        console.warn("Error actualizando active_device_session_id:", e);
      }

      // Notificar en tiempo real a otras sesiones activas
      try {
        const notifyChannel = supabase.channel(`user-session-${data.user.id}`);
        notifyChannel.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            notifyChannel.send({
              type: "broadcast",
              event: "force_logout_previous",
              payload: { sessionId: newSessionId, timestamp: Date.now() }
            });
            setTimeout(() => {
              try { supabase.removeChannel(notifyChannel); } catch {}
            }, 2000);
          }
        });
      } catch (e) {
        console.warn("Error enviando broadcast de nuevo login:", e);
      }
    }

    setSessionExpiredNotice(false);
    return data;
  };

  const logout = async (clearNotice = true) => {
    if (clearNotice) {
      setSessionExpiredNotice(false);
    }
    try {
      sessionStorage.clear();
    } catch (e) {}
    try {
      localStorage.removeItem("odc_session");
    } catch (e) {}
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("AuthContext - Error durante logout de Supabase:", e);
    }
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

  return (
    <AuthContext.Provider value={value}>
      {children}
      {/* Modal de Aviso Amigable: Sesión Iniciada en Otro Dispositivo */}
      {sessionExpiredNotice && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center space-y-5 animate-scaleIn">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner text-2xl">
              💻📱
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Sesión iniciada en otro dispositivo
              </h3>
              <p className="text-xs text-slate-600 font-medium mt-2 leading-relaxed">
                Tu cuenta ha sido abierta recientemente en otro computador o teléfono. Para evitar conflictos de datos y proteger tu cuenta, esta sesión ha sido cerrada en este equipo.
              </p>
            </div>
            <button
              onClick={() => {
                setSessionExpiredNotice(false);
                window.location.reload();
              }}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black tracking-wider uppercase shadow-lg shadow-blue-500/25 transition-all transform active:scale-95"
            >
              Iniciar Sesión en este Equipo
            </button>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};
