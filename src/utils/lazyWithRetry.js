import React from "react";
import { retryImport } from "./retryImport.js";

// Igual que React.lazy, pero reintenta la descarga del módulo si la conexión falla un instante.
export const lazyWithRetry = (factory) => React.lazy(() => retryImport(factory));

export default lazyWithRetry;
