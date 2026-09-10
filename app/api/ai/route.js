import { NextResponse } from "next/server";

function fallback({location, current, daily, activity}) {
  const t = Number(current?.temperature_2m ?? 0);
  const feels = Number(current?.apparent_temperature ?? t);
  const rain = Number(daily?.precipitation_probability_max?.[0] ?? 0);
  const wind = Number(current?.wind_speed_10m ?? 0);
  const uv = Number(daily?.uv_index_max?.[0] ?? 0);
  const code = Number(current?.weather_code ?? 0);
  let score = 100, notes=[];
  if (rain>=70) {score-=25; notes.push("high precipitation probability");}
  else if(rain>=40){score-=12; notes.push("moderate precipitation probability");}
  if(wind>=45){score-=25; notes.push("strong winds");}
  else if(wind>=30){score-=10; notes.push("elevated winds");}
  if([95,96,99].includes(code)){score-=40; notes.push("thunderstorm conditions");}
  if(t>=40){score-=30; notes.push("extreme heat");}
  if(uv>=8){score-=8; notes.push("high UV");}
  score=Math.max(0,Math.min(100,score));
  const verdict=score>=75?"GOOD TO GO":score>=50?"FAIR — TAKE PRECAUTIONS":score>=25?"NOT RECOMMENDED":"AVOID OUTDOOR ACTIVITY";
  const condition = code>=95 ? "stormy conditions" : rain>=60 ? "wet conditions" : "generally stable conditions";
  const text = `${location} is currently around ${t}°C with a feels-like temperature of ${feels}°C. The latest forecast indicates ${condition}. ${rain}% is the forecast maximum precipitation probability today and winds are around ${wind} km/h.`;
  const recommendation = notes.length
    ? `The main considerations are ${notes.join(", ")}. Plan around the better hourly window and follow any official warnings.`
    : "Conditions appear broadly favorable. Check the hourly forecast before leaving because weather can change.";
  return {title:"AI Weather Analysis",summary:text,recommendation,score,verdict,notes};
}

export async function POST(req){
  const body=await req.json();
  const {location,current,daily,activity="general"}=body;
  if(process.env.AI_GATEWAY_API_KEY){
    try{
      const prompt=`You are WeatherGPT AI. Analyze ONLY the supplied weather data. Never invent weather or alerts. Give a professional concise report for ${location}. Activity: ${activity}. Include current conditions, future outlook, risk, best time if hourly data exists, practical suggestions, and clearly state that recommendations are based on the latest available forecast. Data: ${JSON.stringify({current,daily})}`;
      const r=await fetch("https://ai-gateway.vercel.sh/v1/chat/completions",{
        method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${process.env.AI_GATEWAY_API_KEY}`},
        body:JSON.stringify({model:process.env.AI_MODEL||"openai/gpt-4o-mini",messages:[{role:"system",content:"You are a careful weather analyst. Never fabricate data."},{role:"user",content:prompt}],temperature:0.2})
      });
      if(r.ok){const d=await r.json();return NextResponse.json({text:d.choices?.[0]?.message?.content||""});}
    }catch{}
  }
  return NextResponse.json(fallback(body));
}