const ACTIVITY_PROFILES = {
  walking: { label: "Walking", rain: 55, wind: 35, temperature: [5, 35] },
  running: { label: "Running", rain: 35, wind: 28, temperature: [8, 30] },
  cycling: { label: "Cycling", rain: 30, wind: 25, temperature: [8, 32] },
  hiking: { label: "Hiking", rain: 30, wind: 30, temperature: [5, 30] },
  picnic: { label: "Picnic", rain: 25, wind: 22, temperature: [15, 32] },
  camping: { label: "Camping", rain: 20, wind: 25, temperature: [8, 28] },
  beach: { label: "Beach", rain: 35, wind: 35, temperature: [20, 36] },
  swimming: { label: "Swimming", rain: 25, wind: 30, temperature: [22, 38] },
  photography: { label: "Photography", rain: 45, wind: 35, temperature: [5, 35] },
  fishing: { label: "Fishing", rain: 45, wind: 28, temperature: [8, 35] },
  golf: { label: "Golf", rain: 30, wind: 30, temperature: [10, 32] },
  "outdoor sports": { label: "Outdoor sports", rain: 25, wind: 28, temperature: [8, 32] },
  "outdoor event": { label: "Outdoor event", rain: 25, wind: 25, temperature: [12, 32] },
  "dog walking": { label: "Dog walking", rain: 45, wind: 32, temperature: [5, 32] },
  "road trip": { label: "Road trip", rain: 50, wind: 35, temperature: [5, 38] },
};

const ACTIVITY_TERMS = Object.keys(ACTIVITY_PROFILES);
const SEVERE_CODES = [95, 96, 99];
const HEAVY_CODES = [65, 67, 75, 82, 86];

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalize(value) {
  return clean(value).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

function targetDate(message, context) {
  const text = normalize(message);
  const now = new Date();
  if (text.includes("tomorrow") || normalize(context?.date).includes("tomorrow")) {
    now.setUTCDate(now.getUTCDate() + 1);
    return { iso: now.toISOString().slice(0, 10), label: formatDate(now) };
  }
  if (context?.dateIso && /^\d{4}-\d{2}-\d{2}$/.test(context.dateIso)) {
    return { iso: context.dateIso, label: context.date || context.dateIso };
  }
  if (text.includes("weekend") || normalize(context?.date).includes("weekend")) {
    const daysUntilSaturday = (6 - now.getUTCDay() + 7) % 7 || 7;
    now.setUTCDate(now.getUTCDate() + daysUntilSaturday);
    return { iso: now.toISOString().slice(0, 10), label: `this weekend (${formatDate(now)})` };
  }
  return { iso: now.toISOString().slice(0, 10), label: `today (${formatDate(now)})` };
}

function detectActivity(message, context) {
  const text = normalize(`${message} ${context?.activity || ""}`);
  const match = ACTIVITY_TERMS.find((term) => text.includes(term));
  if (match) return match;
  if (text.includes("outside") || text.includes("family") || text.includes("children") || text.includes("go out")) return "walking";
  if (text.includes("trip") || text.includes("travel") || text.includes("drive") || text.includes("road") || text.includes("highway")) return "road trip";
  return "walking";
}

function detectIntent(message, context) {
  const text = normalize(`${message} ${context?.intent || ""}`);
  if (text.includes("highway") || text.includes("road") || text.includes("drive") || text.includes("by car")) return "road-travel";
  if (text.includes("travel") || text.includes("trip") || text.includes("destination") || text.includes("go to")) return "travel";
  return "outdoor";
}

function extractRoute(message) {
  const text = clean(message);
  const match = text.match(/from\s+(.+?)\s+to\s+(.+?)(?=\s+(?:tomorrow|today|this weekend|by road|by car|in the morning|in the evening)|[?.!,]|$)/i);
  return match ? { origin: clean(match[1]), destination: clean(match[2]) } : { origin: null, destination: null };
}

function extractDestination(message, context) {
  const route = extractRoute(message);
  if (route.destination) return route.destination;
  const weatherQuestion = clean(message).match(/(?:what(?:'s| is)|how(?:'s| is))\s+(.+?)\s+weather(?:\s|\?|$)/i);
  if (weatherQuestion) return clean(weatherQuestion[1]);
  const match = clean(message).match(/(?:to|visit|at|in)\s+([\p{L}][\p{L}\s.'-]{1,40}?)(?=\s+(?:tomorrow|today|this weekend|by road|by car|for|and)|[?.!,]|$)/iu);
  if (match) return clean(match[1]);
  return context?.destination?.name || context?.destination?.locationName || null;
}

function locationFromResult(result) {
  const address = result.address || {};
  const type = result.type === "administrative" ? "state/region" : result.type === "continent" ? "continent" : "city";
  return {
    name: address.city || address.town || address.village || address.state || address.country || result.display_name.split(",")[0],
    state: address.state || null,
    country: address.country || null,
    countryCode: address.country_code?.toUpperCase() || null,
    latitude: Number(result.lat), longitude: Number(result.lon), timezone: "auto", locationType: type,
  };
}

async function resolveLocation(query, selectedLocation) {
  if (!query && selectedLocation?.latitude != null) return selectedLocation;
  const requested = clean(query);
  if (!requested && selectedLocation?.latitude != null) return selectedLocation;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&accept-language=en&q=${encodeURIComponent(requested)}`;
  const response = await fetch(url, { headers: { "User-Agent": "WeatherGPT-AI/1.0" }, next: { revalidate: 900 } });
  if (!response.ok) throw new Error("Destination lookup failed");
  const results = await response.json();
  if (!results.length) throw new Error(`I could not resolve ${requested} to a verified destination.`);
  const preferred = results.find((item) => ["city", "town", "village", "administrative"].includes(item.type)) || results[0];
  return locationFromResult(preferred);
}

async function fetchWeather(location) {
  const params = new URLSearchParams({
    latitude: location.latitude, longitude: location.longitude, timezone: "auto", forecast_days: "7",
    current: "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,visibility",
    hourly: "temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m,visibility",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset",
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { next: { revalidate: 300 } });
  if (!response.ok) throw new Error("Weather provider is temporarily unavailable.");
  return response.json();
}

async function fetchAirQuality(location) {
  const params = new URLSearchParams({ latitude: location.latitude, longitude: location.longitude, timezone: "auto", forecast_days: "3", hourly: "us_aqi,pm2_5,pm10" });
  const response = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${params}`, { next: { revalidate: 300 } });
  if (!response.ok) return null;
  return response.json();
}

function hourIndex(weather, date) {
  const prefix = date.iso;
  const index = (weather.hourly?.time || []).findIndex((time) => time.startsWith(prefix));
  return index >= 0 ? index : 0;
}

function metricsAt(weather, air, index) {
  return {
    temperature: weather.hourly?.temperature_2m?.[index], feelsLike: weather.hourly?.apparent_temperature?.[index],
    rain: weather.hourly?.precipitation_probability?.[index] ?? 0, wind: weather.hourly?.wind_speed_10m?.[index] ?? 0,
    visibility: weather.hourly?.visibility?.[index], code: weather.hourly?.weather_code?.[index],
    aqi: air?.hourly?.us_aqi?.[index], pm25: air?.hourly?.pm2_5?.[index],
  };
}

function riskFor(metrics, profile) {
  let score = 100; const reasons = [];
  if (metrics.rain >= profile.rain) { score -= 25; reasons.push(`${metrics.rain}% rain probability`); }
  else if (metrics.rain >= 40) { score -= 12; reasons.push("moderate rain probability"); }
  if (metrics.wind >= profile.wind) { score -= 20; reasons.push(`winds near ${Math.round(metrics.wind)} km/h`); }
  if (metrics.visibility != null && metrics.visibility < 5000) { score -= 20; reasons.push("reduced visibility"); }
  if (SEVERE_CODES.includes(Number(metrics.code))) { score -= 55; reasons.push("thunderstorm or lightning risk"); }
  else if (HEAVY_CODES.includes(Number(metrics.code))) { score -= 25; reasons.push("heavy precipitation risk"); }
  if (metrics.temperature != null && (metrics.temperature < profile.temperature[0] || metrics.temperature > profile.temperature[1])) { score -= 15; reasons.push("temperature outside the preferred activity range"); }
  if (metrics.aqi != null && metrics.aqi > 150) { score -= 20; reasons.push(`AQI around ${Math.round(metrics.aqi)}`); }
  return { score: Math.max(0, Math.min(100, score)), reasons };
}

function recommendation(score, severe) {
  if (severe || score < 35) return { label: "NOT RECOMMENDED", emoji: "🔴", tone: "severe" };
  if (score < 55) return { label: "NOT IDEAL", emoji: "🟠", tone: "caution" };
  if (score < 75) return { label: "GO WITH CAUTION", emoji: "🟡", tone: "moderate" };
  return { label: "GOOD TO GO", emoji: "🟢", tone: "good" };
}

function departureWindow(weather, air, date, profile) {
  const start = hourIndex(weather, date); let best = null; let worst = null;
  for (let offset = 6; offset <= 18; offset += 1) {
    const index = start + offset; const metrics = metricsAt(weather, air, index); const risk = riskFor(metrics, profile);
    if (!best || risk.score > best.score) best = { index, score: risk.score, metrics };
    if (!worst || risk.score < worst.score) worst = { index, score: risk.score, metrics };
  }
  const format = (index) => weather.hourly?.time?.[index] ? new Date(weather.hourly.time[index]).toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" }) : "Unavailable";
  return { best: best ? `${format(best.index)} – ${format(best.index + 2)}` : "Unavailable", bestReason: best?.metrics, avoid: worst ? `${format(worst.index)} – ${format(worst.index + 2)}` : "Unavailable", avoidReason: worst?.metrics };
}

function suggestions({ intent, location, date, profile, score }) {
  const items = [];
  if (intent === "road-travel") items.push({ label: "Check weather along route", query: "Check weather along the route" }, { label: "Best departure time", query: "What time should I leave?" }, { label: "Show road limitations", query: "What highway information is verified?" });
  else if (intent === "travel") items.push({ label: "Check road conditions", query: "Check road conditions" }, { label: "Best departure time", query: "What time should I leave?" }, { label: "Show travel score", query: "Show the travel score factors" });
  else items.push({ label: "What is the best time?", query: "What is the best time for this activity?" }, { label: "Will it rain later?", query: "Will it rain later today?" }, { label: "Check AQI", query: "Check air quality" });
  if (score < 60) items.push({ label: "Show weather risks", query: "Show the main weather risks" });
  else items.push({ label: `Show ${date.iso === new Date().toISOString().slice(0, 10) ? "today" : "tomorrow"} forecast`, query: "Show the detailed forecast" });
  return items.slice(0, 5);
}

export async function analyzeOutdoorTravel({ message, selectedLocation, conversation = [], weatherData }) {
  const lastMessage = conversation.at(-1) || {};
  const context = lastMessage.context || lastMessage.result?.context || {};
  const route = extractRoute(message);
  const destinationName = extractDestination(message, context);
  const destination = await resolveLocation(destinationName, selectedLocation);
  const date = targetDate(message, context);
  const profileKey = detectActivity(message, context);
  const profile = ACTIVITY_PROFILES[profileKey];
  const intent = detectIntent(message, context);
  const weather = weatherData && destination.latitude === selectedLocation?.latitude && destination.longitude === selectedLocation?.longitude ? weatherData : await fetchWeather(destination);
  const air = await fetchAirQuality(destination);
  const index = hourIndex(weather, date);
  const metrics = metricsAt(weather, air, index);
  const risk = riskFor(metrics, profile);
  const severe = SEVERE_CODES.includes(Number(metrics.code));
  const travel = recommendation(risk.score, severe);
  const departure = departureWindow(weather, air, date, profile);
  const origin = route.origin ? await resolveLocation(route.origin, null) : null;
  const routeSegments = origin ? [{ name: origin.name, status: recommendation(riskFor(metrics, profile).score, severe) }, { name: destination.name, status: travel }] : [];
  const routeNotice = origin ? "Live highway-condition information is not currently available from the connected data sources. Route weather is available only for the resolved endpoints; intermediate route-segment weather was not verified." : "Live highway-condition information is not currently available from the connected data sources.";
  const why = risk.reasons.length ? `Based on the latest available forecast, the main factors are ${risk.reasons.join(", ")}.` : "The latest available forecast shows no major weather risk indicators for this activity window.";
  const score = risk.score;
  return {
    type: "outdoor-travel", title: "AI TRAVEL & OUTDOOR ADVISOR", intent, activity: profile.label,
    destination, origin, date, recommendation: travel, score, scoreLabel: `${score}/100 — ${travel.label}`,
    metrics, why, departure, routeSegments, routeNotice,
    alerts: severe ? ["Weather-derived severe thunderstorm conditions detected. Follow official local guidance."] : ["No connected official weather-alert feed is available; verify local official warnings before departure."],
    final: `${travel.emoji} ${travel.label}. ${why} This is decision support based on the latest available weather and air-quality data, not a guarantee of travel safety.`,
    suggestions: suggestions({ intent, location: destination, date, profile, score }),
    context: { destination, origin, date: date.label, dateIso: date.iso, intent, activity: profileKey },
  };
}
