const XLSX = require("xlsx");
const path = require("path");

const headers = ["Documento", "Tipo_Doc", "Nombres", "Apellidos", "Celular", "Email", "Fecha_Nacimiento", "Sexo", "Direccion"];
const data = [
    headers,
    ["1099887766", "CC", "Pepito", "Perez", "3112345678", "pepito@perez.com", "1990-05-15", "MASCULINO", "Calle 123 # 45-67"]
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(data);
XLSX.utils.book_append_sheet(wb, ws, "Hoja1");

const outputPath = path.join(__dirname, "test_pacientes.xlsx");
XLSX.writeFile(wb, outputPath);
console.log("Excel file generated successfully at:", outputPath);
