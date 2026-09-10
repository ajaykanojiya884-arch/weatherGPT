import { NextResponse } from "next/server";
export async function GET(req) {
  const q = new URL(req.url).searchParams.get("q");
  if (!q) return NextResponse.json({results:[]});
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`;
    const r = await fetch(url, { next:{revalidate:3600} });
    if (!r.ok) throw new Error("Geocoding failed");
    const data = await r.json();
    return NextResponse.json({results:(data.results||[]).map(x=>({
      id:x.id,name:x.name,country:x.country,admin1:x.admin1,latitude:x.latitude,longitude:x.longitude,timezone:x.timezone
    }))});
  } catch {
    return NextResponse.json({error:"Location search failed."},{status:502});
  }
}