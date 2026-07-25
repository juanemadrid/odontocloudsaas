import React from "react";
import { Routes, Route } from "react-router-dom";
import ReciboCajaList from "./ReciboCajaList";
import ReciboCajaForm from "./ReciboCajaForm";

export default function ReciboCaja() {
  return (
    <div className="w-full h-full animate-in fade-in duration-500">
      <Routes>
        <Route index element={<ReciboCajaList />} />
        <Route path="nuevo" element={<ReciboCajaForm />} />
        <Route path="editar/:id" element={<ReciboCajaForm />} />
      </Routes>
    </div>
  );
}
