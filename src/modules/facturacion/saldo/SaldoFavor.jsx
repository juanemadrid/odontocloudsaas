import React from "react";
import { Routes, Route } from "react-router-dom";
import SaldoFavorList from "./SaldoFavorList";
import SaldoFavorForm from "./SaldoFavorForm";

export default function SaldoFavor() {
  return (
    <div className="w-full h-full animate-in fade-in duration-500">
      <Routes>
        <Route index element={<SaldoFavorList />} />
        <Route path="nuevo" element={<SaldoFavorForm />} />
      </Routes>
    </div>
  );
}
