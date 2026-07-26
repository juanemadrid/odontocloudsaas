import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, updateDoc, doc } from "firebase/firestore";

// Standalone config to avoid importing 'analytics' which requires window
const firebaseConfig = {
    apiKey: "AIzaSyC70mGCRrjE8iOap8iTHuid8HEuyadue8Y",
    authDomain: "odontocloud-d92ac.firebaseapp.com",
    projectId: "odontocloud-d92ac",
    storageBucket: "odontocloud-d92ac.firebasestorage.app",
    messagingSenderId: "267020714981",
    appId: "1:267020714981:web:a44416ea83aa1d1172650c",
    measurementId: "G-ZMCC5CFY0C",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
    console.log("🔍 Searching for tenant 'OdontoSalud'...");

    try {
        const q = query(collection(db, "tenants"));
        const querySnapshot = await getDocs(q);

        let targetTenant = null;

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Case insensitive check
            if (data.name && data.name.toLowerCase().includes("odontosalu")) {
                targetTenant = { id: doc.id, ...data };
            }
        });

        if (targetTenant) {
            console.log(`✅ Found Tenant: ${targetTenant.name} (ID: ${targetTenant.id})`);
            console.log(`Current Slug: ${targetTenant.slug}`);

            if (!targetTenant.slug) {
                console.log("⚠️ Slug is missing! Fixing it remotely...");
                const docRef = doc(db, "tenants", targetTenant.id);
                await updateDoc(docRef, {
                    slug: "odontosalud"
                });
                console.log("✅ SUCCESS: Tenant slug set to 'odontosalud'.");
            } else {
                console.log("ℹ️ Tenant already has a slug. No action taken.");
            }
        } else {
            console.log("❌ Tenant 'OdontoSalud' not found. Listing all names:");
            querySnapshot.forEach((doc) => {
                console.log(`- ${doc.data().name}`);
            });
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

main();
