import { NextResponse } from "next/server";

const INDIA = "IN";
const PREFERRED_MATCHES = {
  mum: { name: "mumbai", countryCode: INDIA },
  new: { name: "new delhi", countryCode: INDIA },
};
const INDIA_REGION_ALIASES = {
  andhra: "Andhra Pradesh, India", assam: "Assam, India", bihar: "Bihar, India",
  chandigarh: "Chandigarh, India", chhattisgarh: "Chhattisgarh, India", chatisgarh: "Chhattisgarh, India",
  del: "Delhi, India", delhi: "Delhi, India", goa: "Goa, India", guj: "Gujarat, India",
  gujar: "Gujarat, India", gujarat: "Gujarat, India", haryana: "Haryana, India", himachal: "Himachal Pradesh, India",
  jharkhand: "Jharkhand, India", karnataka: "Karnataka, India", kerala: "Kerala, India", ladakh: "Ladakh, India",
  lakshadweep: "Lakshadweep, India", madhya: "Madhya Pradesh, India", maharashtra: "Maharashtra, India",
  manipur: "Manipur, India", meghalaya: "Meghalaya, India", mizoram: "Mizoram, India", nagaland: "Nagaland, India",
  odisha: "Odisha, India", orissa: "Odisha, India", puducherry: "Puducherry, India", punjab: "Punjab, India",
  ra: "Rajasthan, India", raj: "Rajasthan, India", rajas: "Rajasthan, India", rajasthan: "Rajasthan, India", sikkim: "Sikkim, India",
  tamil: "Tamil Nadu, India", telangana: "Telangana, India", tripura: "Tripura, India", uttar: "Uttar Pradesh, India",
  uttarakhand: "Uttarakhand, India", west: "West Bengal, India", bengal: "West Bengal, India",
  mum: "Mumbai, Maharashtra, India", new: "New Delhi, India", "north asia": "Asia",
};

function normalize(value) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[,'’`-]/g, " ").replace(/\s+/g, " ").trim();
}

function featureType(result) {
  const code = result.feature_code || "";
  if (code === "ADM0") return "country";
  if (code.startsWith("ADM1")) return "state/region";
  if (code.startsWith("ADM2")) return "district";
  if (["PPLC", "PPLA", "PPLA2", "PPLA3", "PPLA4"].includes(code)) return "city";
  return result.feature_class === "P" ? "city/town" : "region";
}

function toLocation(result) {
  const type = featureType(result);
  const isCity = type === "city" || type === "city/town";
  return {
    id: `${result.id}-${result.latitude}-${result.longitude}`,
    name: result.name, locationName: result.name, displayName: [result.name, result.admin1, result.country].filter(Boolean).join(", "), city: isCity ? result.name : result.admin2 || null,
    state: result.admin1 || null, country: result.country || null, countryCode: result.country_code || null,
    latitude: result.latitude, longitude: result.longitude, timezone: result.timezone || "auto",
    locationType: type, featureType: type, population: result.population || 0,
  };
}

function toNominatimLocation(result) {
  const address = result.address || {};
  const type = result.type === "administrative" ? "state/region" : result.type === "continent" ? "continent" : "region";
  const country = address.country || (type === "continent" ? result.display_name : null);
  return {
    id: `osm-${result.osm_type}-${result.osm_id}`,
    name: address.state || address.country || result.display_name.split(",")[0],
    locationName: address.state || address.country || result.display_name.split(",")[0],
    city: address.city || address.town || address.village || null,
    state: address.state || null,
    country,
    countryCode: address.country_code?.toUpperCase() || null,
    latitude: Number(result.lat), longitude: Number(result.lon), timezone: "auto",
    locationType: type, featureType: type, population: Number(address.population || 0),
    displayName: result.display_name,
  };
}

function score(result, query) {
  const normalizedQuery = normalize(query); const name = normalize(result.name);
  const region = normalize(result.admin1 || ""); const country = normalize(result.country || "");
  const countryCode = normalize(result.country_code || ""); let value = 0;
  if (name === normalizedQuery) value += 1000;
  if (region === normalizedQuery) value += 900;
  if (country === normalizedQuery || countryCode === normalizedQuery) value += 850;
  if (name.startsWith(normalizedQuery)) value += 500;
  if (region.startsWith(normalizedQuery)) value += 450;
  if (country.startsWith(normalizedQuery)) value += 400;
  if (countryCode === INDIA) value += normalizedQuery.length <= 5 ? 90 : 20;
  if (result.feature_code?.startsWith("ADM1")) value += 80;
  if (result.feature_code === "PPLC") value += 50;
  return value + Math.min(Number(result.population) || 0, 5000000) / 100000;
}

function preferredScore(location, query) {
  const preferred = PREFERRED_MATCHES[query];
  if (!preferred) return 0;
  return normalize(location.name) === preferred.name && location.countryCode === preferred.countryCode ? 1800 : 0;
}

async function fetchResults(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=20&language=en&format=json`;
  const response = await fetch(url, { next: { revalidate: 3600 } });
  if (!response.ok) throw new Error("Geocoding failed");
  return (await response.json()).results || [];
}

async function fetchRegionalResults(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&accept-language=en&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers: { "User-Agent": "WeatherGPT-AI/1.0" }, next: { revalidate: 3600 } });
  if (!response.ok) throw new Error("Regional geocoding failed");
  return (await response.json()).filter((result) => ["administrative", "continent", "boundary"].includes(result.type));
}

async function fetchGlobalResults(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&accept-language=en&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers: { "User-Agent": "WeatherGPT-AI/1.0" }, next: { revalidate: 3600 } });
  if (!response.ok) throw new Error("Global geocoding failed");
  return (await response.json()).filter((result) => ["city", "town", "village", "administrative", "continent", "boundary"].includes(result.type));
}

export async function GET(req) {
  const rawQuery = new URL(req.url).searchParams.get("q") || ""; const query = normalize(rawQuery);
  if (query.length < 2) return NextResponse.json({ results: [] });
  try {
    const aliasQuery = INDIA_REGION_ALIASES[query] || rawQuery.trim();
    const aliasIsRegion = Boolean(INDIA_REGION_ALIASES[query]) && !["mum", "new"].includes(query);
    const resultSets = await Promise.all([...new Set([aliasQuery, rawQuery.trim()])].map(fetchResults));
    const unique = new Map();
    resultSets.flat().forEach((result) => {
      const location = toLocation(result); unique.set(location.id, { ...location, _score: score(result, query) + preferredScore(location, query) });
    });
    if (aliasIsRegion) {
      const regional = await fetchRegionalResults(aliasQuery);
      regional.forEach((result) => {
        const location = toNominatimLocation(result);
        const exactRegion = normalize(location.name) === normalize(aliasQuery.split(",")[0]);
        unique.set(location.id, { ...location, _score: (exactRegion ? 1900 : 1200) + (location.countryCode === INDIA ? 200 : 0) + preferredScore(location, query) });
      });
    }
    if (!unique.size || query.includes("asia") || query.includes("europe") || query.includes("africa") || query.includes("america")) {
      const global = await fetchGlobalResults(rawQuery.trim());
      global.forEach((result) => {
        const location = toNominatimLocation(result);
        unique.set(location.id, { ...location, _score: 700 + preferredScore(location, query) });
      });
    }
    const results = [...unique.values()].sort((a, b) => b._score - a._score).slice(0, 8)
      .map(({ _score, ...location }) => location);
    return NextResponse.json({ query: rawQuery, normalizedQuery: query, results });
  } catch {
    return NextResponse.json({ error: "Location search failed.", results: [] }, { status: 502 });
  }
}