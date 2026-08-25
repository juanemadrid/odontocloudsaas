// src/modules/facturacion/facturascompra/FacturasCompra.jsx
import React, { useState } from "react";
import FacturasCompraList from "./FacturasCompraList";
import FacturasCompraForm from "./FacturasCompraForm";

export default function FacturasCompra() {
  const [isCreating, setIsCreating] = useState(false);

  if (isCreating) {
    return (
      <FacturasCompraForm
        onCancel={() => setIsCreating(false)}
        onSuccess={() => setIsCreating(false)}
      />
    );
  }

  return (
    <FacturasCompraList
      onNew={() => setIsCreating(true)}
    />
  );
}
