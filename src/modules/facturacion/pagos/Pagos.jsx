import React, { useState } from "react";
import PagosList from "./PagosList";
import PagosForm from "./PagosForm";

export default function Pagos() {
  const [view, setView] = useState("list");

  return (
    <div className="w-full h-full animate-in fade-in duration-500">
      {view === "list" ? (
        <PagosList onNew={() => setView("new")} />
      ) : (
        <PagosForm
          onCancel={() => setView("list")}
          onSuccess={() => setView("list")}
        />
      )}
    </div>
  );
}
