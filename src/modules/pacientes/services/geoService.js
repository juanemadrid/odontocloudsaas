import { COUNTRY_ES_TO_EN } from "../constants/countryTranslation";
import { CIUDADES_COLOMBIA } from "../constants/colombianCities";

export { CIUDADES_COLOMBIA };

export const fetchCitiesForCountry = async (countryName) => {
    if (!countryName) return [];
    
    // Check if it's Colombia
    if (countryName.toLowerCase() === "colombia") {
        return CIUDADES_COLOMBIA;
    }
    
    const englishName = COUNTRY_ES_TO_EN[countryName] || countryName;
    try {
        const response = await fetch("https://countriesnow.space/api/v0.1/countries/cities", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ country: englishName })
        });
        if (!response.ok) {
            throw new Error("HTTP error " + response.status);
        }
        const resJson = await response.json();
        if (resJson.error) {
            console.warn(`API returned error for ${englishName}:`, resJson.msg);
            return [];
        }
        const cities = resJson.data || [];
        // Sort alphabetically
        return [...cities].sort((a, b) => a.localeCompare(b));
    } catch (e) {
        console.error(`Error fetching cities for ${countryName}:`, e);
        return [];
    }
};
