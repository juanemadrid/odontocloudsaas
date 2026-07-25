// src/api/tratamientosCatalog.js

export const TRATAMIENTOS = [
  {
    id: "caries",
    label: "Caries / Se requiere resina",
    color: "#e74c3c", // Rojo
    precio: 80000,
    tipo: "superficie", // Se aplica a una cara
  },
  {
    id: "obturado",
    label: "Obturado / Resina OK",
    color: "#3498db", // Azul
    precio: 0,
    tipo: "superficie",
  },
  {
    id: "ausente",
    label: "Diente Ausente",
    color: "#000000", // Negro - tacha todo
    precio: 0,
    tipo: "diente", // Se aplica al diente entero
  },
  {
    id: "endodoncia",
    label: "Endodoncia Realizada",
    color: "#f1c40f", // Amarillo
    precio: 450000,
    tipo: "diente",
  },
  {
    id: "corona",
    label: "Corona / Prótesis",
    color: "#9b59b6", // Morado
    precio: 900000,
    tipo: "diente",
  },
  {
    id: "extraccion",
    label: "Indicado para Extracción",
    color: "#e67e22", // Naranja
    precio: 50000,
    tipo: "diente",
  },
  {
    id: "limpieza",
    label: "Limpieza General",
    precio: 80000,
    tipo: "general", // No se marca en el diente
    color: "#2ecc71"
  }
];

export const getTratamientoById = (id) => TRATAMIENTOS.find((t) => t.id === id);
