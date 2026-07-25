import React from 'react';
import { useOutletContext } from 'react-router-dom';
import ServicesSection from './landing/ServicesSection';
import PricingSection from './landing/PricingSection';
import FAQSection from './landing/FAQSection';
import TrialModal from '../components/landing/TrialModal';

export function ServicesPage() {
    const { config } = useOutletContext();
    return (
        <div className="pt-20 bg-slate-50 min-h-screen">
            <ServicesSection config={config} />
        </div>
    );
}

export function PricingPage() {
    const { config } = useOutletContext();
    const [showModal, setShowModal] = React.useState(false);
    const [selectedPlan, setSelectedPlan] = React.useState("");

    const onShowTrial = (plan) => {
        setSelectedPlan(plan);
        setShowModal(true);
    }

    return (
        <div className="pt-20 bg-slate-50 min-h-screen">
            <PricingSection config={config} onShowTrial={onShowTrial} />
            <TrialModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                initialPlan={selectedPlan}
            />
        </div>
    );
}

export function FAQPage() {
    const { config } = useOutletContext();
    return (
        <div className="pt-20 bg-slate-50 min-h-screen">
            <FAQSection config={config} />
        </div>
    );
}
