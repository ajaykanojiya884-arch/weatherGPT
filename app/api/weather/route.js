import { NextResponse } from "next/server";

const WMO = {
  0:["Clear sky","☀️"],1:["Mainly clear","🌤️"],2:["Partly cloudy","⛅"],3:["Overcast","☁️"],
  45:["Fog","🌫️"],48:["Depositing rime fog","🌫️"],51:["Light drizzle","🌦️"],53:["Drizzle","🌦️"],
  55:["Dense drizzle","🌧️"],56:["Freezing drizzle","🌧️"],57:["Freezing drizzle","🌧️"],
  61:["Light rain","🌦️"],63:["Moderate rain","🌧️"],65:["Heavy rain","🌧️"],
  66:["Freezing rain","🌧️"],67:["Freezing rain","🌧️"],71:["Light snow","🌨️"],
  73:["Moderate snow","🌨️"],75:["Heavy snow","❄️"],77:["Snow grains","🌨️"],
  80:["Rain showers","🌦️"],81:["Rain showers","🌧️"],82:["Violent rain showers","⛈️"],
  85:["Snow showers","🌨️"],86:["Heavy snow showers","❄️"],95:["Thunderstorm","⛈️"],
  96:["Thunderstorm with hail","⛈️"],99:["Severe thunderstorm with hail","⛈️"]
};

function riskFrom(hourly, current, daily) {
  let risk = 0, reasons = [];
  const rain = Number(current?.precipitation_probability ?? hourly?.precipitation_probability?.[0] ?? 0);
  const wind = Number(current?.wind_speed_10m ?? 0);
  const temp = Number(current?.temperature_2m ?? 0);
  const code = Number(current?.weather_code ?? 0);
  if (rain >= 70) { risk += 25; reasons.push("High probability of precipitation"); }
  else if (rain >= 40) { risk += 12; reasons.push("Moderate precipitation chance"); }
  if (wind >= 45) { risk += 30; reasons.push("Strong winds"); }
  else if (wind >= 30) { risk += 12; reasons.push("Elevated winds"); }
  if ([95,96,99].includes(code)) { risk += 45; reasons.push("Thunderstorm conditions"); }
  if ([65,67,75,82,86].includes(code)) { risk += 25; reasons.push("Heavy precipitation or snow"); }
  if (temp >= 40) { risk += 35; reasons.push("Extreme heat"); }
  if (temp <= 0) { risk += 20; reasons.push("Freezing temperatures"); }
  risk = Math.min(100, risk);
  const level = risk >= 70 ? "SEVERE" : risk >= 45 ? "HIGH" : risk >= 20 ? "MODERATE" : "LOW";
  return { score:risk, level, reasons };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const timezone = searchParams.get("timezone") || "auto";
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return NextResponse.json({error:"Valid latitude and longitude are required."},{status:400});
  }

  const params = new URLSearchParams({
    latitude, longitude, timezone,
    forecast_days: "16",
    current: [
      "temperature_2m","relative_humidity_2m","apparent_temperature","is_day",
      "precipitation","rain","showers","snowfall","weather_code","cloud_cover",
      "pressure_msl","surface_pressure","wind_speed_10m","wind_direction_10m","wind_gusts_10m"
    ].join(","),
    hourly: [
      "temperature_2m","relative_humidity_2m","apparent_temperature","precipitation_probability",
      "precipitation","rain","showers","snowfall","weather_code","cloud_cover","visibility",
      "wind_speed_10m","wind_direction_10m","wind_gusts_10m","uv_index"
    ].join(","),
    daily: [
      "weather_code","temperature_2m_max","temperature_2m_min","apparent_temperature_max",
      "apparent_temperature_min","sunrise","sunset","uv_index_max","precipitation_sum",
      "rain_sum","showers_sum","snowfall_sum","precipitation_probability_max",
      "wind_speed_10m_max","wind_gusts_10m_max"
    ].join(",")
  });

  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { next:{revalidate:300} });
    if (!r.ok) throw new Error("Weather provider returned an error");
    const data = await r.json();
    const current = data.current || {};
    const [condition, icon] = WMO[current.weather_code] || ["Unknown","🌤️"];
    const risk = riskFrom(data.hourly, current, data.daily);
    return NextResponse.json({ ...data, meta:{condition,icon,risk,source:"Open-Meteo"}, fetchedAt:new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({error:"Live weather data is temporarily unavailable.", detail:e.message},{status:502});
  }
}