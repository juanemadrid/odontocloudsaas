import React from "react";
import { Routes, Route } from "react-router-dom";
import NotaCreditoList from "./NotaCreditoList";
import NotaCreditoForm from "./NotaCreditoForm";

export default function NotaCredito() {
  return (
    <div className="w-full h-full animate-in fade-in duration-500">
      <Routes>
        <Route index element={<NotaCreditoList />} />
        <Route path="nuevo" element={<NotaCreditoForm />} />
      </Routes>
    </div>
  );
}
