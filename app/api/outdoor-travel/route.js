import { NextResponse } from "next/server";
import { analyzeOutdoorTravel } from "../../../lib/outdoorTravelService";

export async function POST(req) {
  try {
    const body = await req.json();
    if (!body.message?.trim()) return NextResponse.json({ error: "A question is required." }, { status: 400 });
    const result = await analyzeOutdoorTravel(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Outdoor and travel analysis is temporarily unavailable." }, { status: 502 });
  }
}
