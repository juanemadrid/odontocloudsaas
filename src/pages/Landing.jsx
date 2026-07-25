import React, { useState, useEffect } from "react";
import HeroSection from "./landing/HeroSection";
import ServicesSection from "./landing/ServicesSection";
import TestimonialsSection from "./landing/TestimonialsSection";
import Footer from "../layout/Footer";
import "../styles/landing.css";

export default function Landing() {
    const [config, setConfig] = useState(null);

    // Mock config or fetch from context/DB if needed
    useEffect(() => {
        setConfig({
            heroBtn1Text: "Empezar Gratis",
            heroBtn2Text: "Ver Documentación",
            contactPhone: "300 123 4567"
        });
    }, []);

    const handleShowTrial = (plan) => {
        console.log("Show trial for:", plan);
        // Implement trial modal logic here if needed
        const contactSection = document.getElementById('contacto');
        if (contactSection) contactSection.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="viva-wrapper bg-[var(--viva-blue)] min-h-screen text-slate-800 font-sans selection:bg-sky-500/30">

            <HeroSection
                config={config}
                onShowTrial={handleShowTrial}
            />

            <ServicesSection
                config={config}
                onShowTrial={handleShowTrial}
                dark={false}
                hideTitle={true} // Explicitly hide the "mondá" title
            />

            {/* Optional: Add Testimonials if they exist/are ready */}
            <TestimonialsSection
                config={config}
            />

            {/* Footer is usually handled by layout, but if Landing is standalone: */}
            {/* <Footer config={config} /> */}
        </div>
    );
}
