import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { auth, db } from "../firebase/firebaseConfig";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";

const AuthContext = createContext({
    user: null,          // Firebase User
    userProfile: null,   // Firestore User Document (Rol, Permission)
    loading: true,
    logout: () => Promise.resolve(),
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 🛡️ Safety Timeout: If Firebase hangs (common in weak networks), force load
        const safetyTimer = setTimeout(() => {
            if (loading) {
                console.warn("⚠️ Auth check timed out. Forcing app load.");
                setLoading(false);
                // VISUAL DEBUG REMOVED - Just let it load
            }
        }, 2500);

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            // clearTimeout(safetyTimer); // Optional: keep it running just in case async logic hangs
            setLoading(true);
            if (currentUser) {
                // User is signed in
                setUser(currentUser);

                // Fetch extra profile data (Role, etc.) if stored in 'usuarios' or 'users' collection
                // Assuming 'usuarios' based on roles mentioned in App.jsx (administrador, doctor, etc.)
                try {
                    // Check 'usuarios' collection using email as ID or UID? 
                    // Often projects use UID. Let's try UID first.
                    let docRef = doc(db, "usuarios", currentUser.uid);
                    let snap = await getDoc(docRef);

                    if (!snap.exists()) {
                        // Fallback: Try searching by Email
                        try {
                            const q = query(collection(db, "usuarios"), where("email", "==", currentUser.email));
                            const qSnap = await getDocs(q);
                            if (!qSnap.empty) {
                                const profile = qSnap.docs[0].data();

                                // NEW: Fetch Tenant/Clinic Info if applicable
                                if (profile.tenantId) {
                                    try {
                                        const tenantSnap = await getDoc(doc(db, "tenants", profile.tenantId));
                                        if (tenantSnap.exists()) {
                                            profile.tenant = tenantSnap.data();
                                            profile.tenant.id = tenantSnap.id;

                                            // NEW: Subscription Expiration Check
                                            if (profile.tenant.subscriptionEndDate) {
                                                const endDate = profile.tenant.subscriptionEndDate.toDate ? profile.tenant.subscriptionEndDate.toDate() : new Date(profile.tenant.subscriptionEndDate);
                                                const now = new Date();
                                                if (now > endDate) {
                                                    profile.subscriptionStatus = "expired";
                                                    // Optional: Override role or status to block access
                                                    // profile.role = "expired_user"; 
                                                } else {
                                                    profile.subscriptionStatus = "active";
                                                }
                                            }

                                            // NEW: Fetch Plan Details
                                            if (profile.tenant.planId) {
                                                try {
                                                    const planSnap = await getDoc(doc(db, "subscription_plans", profile.tenant.planId));
                                                    if (planSnap.exists()) {
                                                        profile.tenant.plan = { id: planSnap.id, ...planSnap.data() };
                                                    }
                                                } catch (pErr) { console.error(pErr); }
                                            }
                                        }
                                    } catch (tError) {
                                        console.error("Error fetching tenant", tError);
                                    }
                                }
                                // Normalización robusta del rol
                                if (profile && profile.rol) {
                                    profile.rol = profile.rol.trim().toLowerCase();
                                }

                                // HARDCODED FALLBACK: Superadmin bypass por correo (MadridSystem)
                                if (currentUser.email === "madridsystem@outlook.es") {
                                    profile.rol = "superadmin";
                                    console.log("AuthContext - Rol de superadmin forzado por correo para MadridSystem.");
                                }

                                setUserProfile(profile);
                            } else {
                                // Try legacy 'users' collection
                                const qLegacy = query(collection(db, "users"), where("correo", "==", currentUser.email));
                                const qLegacySnap = await getDocs(qLegacy);
                                if (!qLegacySnap.empty) {
                                    setUserProfile(qLegacySnap.docs[0].data());
                                } else {
                                    setUserProfile({ rol: "guest" });
                                }
                            }
                        } catch (e) {
                            console.error("Fallback lookup failed", e);
                            setUserProfile({ rol: "guest" });
                        }
                    } else {
                        const profile = snap.data();


                        // NEW: Fetch Tenant/Clinic Info if applicable
                        if (profile.tenantId) {
                            try {
                                const tenantSnap = await getDoc(doc(db, "tenants", profile.tenantId));
                                if (tenantSnap.exists()) {
                                    profile.tenant = tenantSnap.data();
                                    profile.tenant.id = tenantSnap.id;

                                    // NEW: Subscription Expiration Check
                                    if (profile.tenant.subscriptionEndDate) {
                                        const endDate = profile.tenant.subscriptionEndDate.toDate ? profile.tenant.subscriptionEndDate.toDate() : new Date(profile.tenant.subscriptionEndDate);
                                        const now = new Date();
                                        if (now > endDate) {
                                            profile.subscriptionStatus = "expired";
                                        } else {
                                            profile.subscriptionStatus = "active";
                                        }
                                    }

                                    // NEW: Fetch Plan Details
                                    if (profile.tenant.planId) {
                                        try {
                                            const planSnap = await getDoc(doc(db, "subscription_plans", profile.tenant.planId));
                                            if (planSnap.exists()) {
                                                profile.tenant.plan = { id: planSnap.id, ...planSnap.data() };
                                            }
                                        } catch (pErr) { console.error(pErr); }
                                    }
                                }
                            } catch (tError) {
                                console.error("Error fetching tenant", tError);
                            }
                        }

                        // NEW: Fetch Assigned Profile Permissions (if profileId exists)
                        if (profile.profileId) {
                            try {
                                const profileSnap = await getDoc(doc(db, "perfiles", profile.profileId));
                                if (profileSnap.exists()) {
                                    const profileData = profileSnap.data();
                                    // Merge permissions into userProfile
                                    profile.permisos = profileData.permisos || {};
                                    profile.profileName = profileData.nombre;
                                }
                            } catch (permErr) {
                                console.error("Error fetching profile permissions", permErr);
                            }
                        }

                        // Normalización robusta del rol
                        if (profile && profile.rol) {
                            profile.rol = profile.rol.trim().toLowerCase();
                        }

                        // HARDCODED FALLBACK: Superadmin bypass por correo (MadridSystem)
                        if (currentUser.email === "madridsystem@outlook.es") {
                            profile.rol = "superadmin";
                            console.log("AuthContext - Rol de superadmin forzado por correo para MadridSystem.");
                        }

                        setUserProfile(profile);
                    }
                } catch (err) {
                    console.error("Error fetching user profile", err);
                    setUserProfile(null);
                }
            } else {
                // User is signed out
                setUser(null);
                setUserProfile(null);
                // Clear legacy
                localStorage.removeItem("odc_session");
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const logout = async () => {
        await firebaseSignOut(auth);
        localStorage.removeItem("odc_session");
    };

    const value = {
        user,
        userProfile,
        loading,
        logout
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
