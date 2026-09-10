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

function buildSuggestions({locationData={}, current={}, daily={}, message="", location=""}) {
  const lower = `${message} ${location}`.toLowerCase();
  const rain = Number(daily?.precipitation_probability_max?.[0] ?? 0);
  const hot = Number(current?.temperature_2m ?? 0) >= 32;
  const storm = [95, 96, 99].includes(Number(current?.weather_code));
  const region = locationData.locationType === "state/region" || locationData.locationType === "region";
  const suggestions = [];
  if (storm || rain >= 60) suggestions.push({label:"Will it rain today?",query:"Will it rain today and when is the driest window?"});
  if (hot || region) suggestions.push({label:region?"Which areas may get rain?":"Should I go outside?",query:region?"Which areas of this region may get rain?":"Should I go outside in these conditions?"});
  if (lower.includes("travel") || lower.includes("trip") || lower.includes("destination")) {
    suggestions.push({label:"Check destination alerts",query:"Check the important weather and travel alerts for this destination."});
    suggestions.push({label:"Best departure time",query:"What is the best departure time based on the forecast?"});
  }
  suggestions.push({label:"What about tomorrow?",query:"What will the weather be like tomorrow?"});
  suggestions.push({label:"Show 7-day forecast",query:"Summarize the next 7 days of forecast conditions."});
  suggestions.push({label:region?"Best outdoor time":"What's the best time?",query:"What is the best time for outdoor activity?"});
  return [...new Map(suggestions.map(item=>[item.query,item])).values()].slice(0,5);
}

export async function POST(req){
  const body=await req.json();
  const {location,current,daily,activity="general",message="",locationData={}}=body;
  if(!location||!current||!daily)return NextResponse.json({error:"Location and weather data are required."},{status:400});
  const suggestions=buildSuggestions(body);
  if(process.env.AI_GATEWAY_API_KEY){
    try{
      const prompt=`You are WeatherGPT AI. Analyze ONLY the supplied weather data. Never invent weather or alerts. Give a professional concise report for ${location}. Activity: ${activity}. User follow-up: ${message||"Give the initial location analysis."} Include current conditions, future outlook, risk, best time if hourly data exists, practical suggestions, and clearly state that recommendations are based on the latest available forecast. Data: ${JSON.stringify({current,daily})}`;
      const r=await fetch("https://ai-gateway.vercel.sh/v1/chat/completions",{
        method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${process.env.AI_GATEWAY_API_KEY}`},
        body:JSON.stringify({model:process.env.AI_MODEL||"openai/gpt-4o-mini",messages:[{role:"system",content:"You are a careful weather analyst. Never fabricate data."},{role:"user",content:prompt}],temperature:0.2})
      });
      if(r.ok){const d=await r.json();return NextResponse.json({text:d.choices?.[0]?.message?.content||"",suggestions});}
    }catch{}
  }
  return NextResponse.json({...fallback(body),suggestions});
}