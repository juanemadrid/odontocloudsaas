import React from "react";
import PremiumLoading from "./components/PremiumLoading";
import ModernLayout from "./layout/ModernLayout";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

export default function TestApp() {
    return (
        <AuthProvider>
            <Routes>
                <Route element={<ModernLayout />}>
                    <Route path="/" element={<PremiumLoading />} />
                </Route>
            </Routes>
        </AuthProvider>
    );
}
