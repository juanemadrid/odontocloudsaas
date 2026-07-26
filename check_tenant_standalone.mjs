import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc, query, where, addDoc, setDoc } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyC70mGCRrjE8iOap8iTHuid8HEuyadue8Y",
    authDomain: "odontocloud-d92ac.firebaseapp.com",
    projectId: "odontocloud-d92ac",
    storageBucket: "odontocloud-d92ac.firebasestorage.app",
    messagingSenderId: "267020714981",
    appId: "1:267020714981:web:a44416ea83aa1d1172650c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkTenants() {
    console.log("🔍 Checking Tenants...");

    try {
        const tenantsRef = collection(db, "tenants");
        const snap = await getDocs(tenantsRef);

        let found = false;
        let juanId = null;

        snap.forEach(doc => {
            const data = doc.data();
            console.log(`- Tenant: ${data.name} (Slug: ${data.slug}) [ID: ${doc.id}]`);
            if (data.slug === 'juanemadrid') {
                found = true;
                juanId = doc.id;
            }
        });

        if (found) {
            console.log("✅ Tenant 'juanemadrid' FOUND (ID: " + juanId + ")");
            await checkWebsite(juanId);
        } else {
            console.log("❌ Tenant 'juanemadrid' NOT FOUND. Creating...");
            await createTenant();
        }
    } catch (e) {
        console.error("Error checking tenants:", e);
    }
}

async function checkWebsite(tenantId) {
    console.log(`🔍 Checking Website Config for ${tenantId}...`);
    const ref = doc(db, "website_config", tenantId);
    const snap = await getDoc(ref);

    if (snap.exists()) {
        console.log("✅ Website Config EXISTS.");
        const data = snap.data();
        if (!data.mission) {
            console.log("⚠️ Missing Mission/Vision. Updating...");
            await updateDoc(ref, {
                mission: "Nuestra misión es brindar atención odontológica integral con calidez y profesionalismo.",
                vision: "Ser la clínica líder en transformación de sonrisas.",
                services: [
                    { title: "Ortodoncia", desc: "Brackets y alineadores.", icon: "🦷" },
                    { title: "Implantes", desc: "Recupera tu sonrisa.", icon: "🔩" },
                    { title: "Diseño", desc: "Estética dental.", icon: "✨" }
                ]
            });
            console.log("✅ Updated Mission/Vision.");
        }
    } else {
        console.log("❌ Website Config MISSING. Creating...");
        await createWebsiteConfig(tenantId);
    }
}

async function createTenant() {
    try {
        const tenantData = {
            name: "Juan Madrid Odontología",
            slug: "juanemadrid",
            email: "juan@odonto.com",
            plan: "pro",
            active: true,
            createdAt: new Date()
        };
        const ref = await addDoc(collection(db, "tenants"), tenantData);
        console.log("✅ Created Tenant: " + ref.id);
        await createWebsiteConfig(ref.id);
    } catch (e) {
        console.error("Error creating tenant:", e);
    }
}

async function createWebsiteConfig(tenantId) {
    const configData = {
        name: "Juan Madrid Odontología",
        primaryColor: "#4f46e5",
        accentColor: "#ec4899",
        mission: "Nuestra misión es brindar atención odontológica integral con calidez y profesionalismo.",
        vision: "Ser la clínica líder en transformación de sonrisas.",
        services: [
            { title: "Ortodoncia", desc: "Brackets y alineadores.", icon: "🦷" },
            { title: "Implantes", desc: "Recupera tu sonrisa.", icon: "🔩" },
            { title: "Diseño", desc: "Estética dental.", icon: "✨" }
        ],
        contactPhone: "3001234567"
    };
    await setDoc(doc(db, "website_config", tenantId), configData);
    console.log("✅ Created Website Config for " + tenantId);
}

checkTenants();
