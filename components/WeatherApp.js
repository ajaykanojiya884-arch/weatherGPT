'use client';
import {useEffect,useMemo,useState} from "react";
import {Search, MapPin, Moon, Sun, Bell, History, Star, Navigation, Wind, Droplets, Eye, Gauge, Umbrella, Plane, ShieldAlert, Sparkles, Trash2} from "lucide-react";

const fmt=(n,unit="°C")=>`${Math.round(Number(n)||0)}${unit}`;
const weatherText=(c)=>({0:["Clear sky","☀️"],1:["Mainly clear","🌤️"],2:["Partly cloudy","⛅"],3:["Overcast","☁️"],45:["Fog","🌫️"],48:["Fog","🌫️"],51:["Light drizzle","🌦️"],53:["Drizzle","🌦️"],55:["Dense drizzle","🌧️"],61:["Light rain","🌦️"],63:["Moderate rain","🌧️"],65:["Heavy rain","🌧️"],71:["Light snow","🌨️"],73:["Snow","🌨️"],75:["Heavy snow","❄️"],80:["Rain showers","🌦️"],81:["Rain showers","🌧️"],82:["Heavy showers","⛈️"],85:["Snow showers","🌨️"],86:["Heavy snow","❄️"],95:["Thunderstorm","⛈️"],96:["Thunderstorm + hail","⛈️"],99:["Severe thunderstorm","⛈️"]}[c]||["Unknown","🌤️"]);
const day=(d)=>new Date(d).toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"});
const hour=(d)=>new Date(d).toLocaleTimeString(undefined,{hour:"numeric"});

export default function WeatherApp(){
  const [query,setQuery]=useState(""); const [places,setPlaces]=useState([]); const [place,setPlace]=useState(null);
  const [data,setData]=useState(null); const [loading,setLoading]=useState(false); const [err,setErr]=useState("");
  const [unit,setUnit]=useState("C"); const [dark,setDark]=useState(true); const [tab,setTab]=useState("home");
  const [history,setHistory]=useState([]); const [saved,setSaved]=useState([]);
  const [ai,setAi]=useState(null); const [activity,setActivity]=useState("general");

  useEffect(()=>{try{setHistory(JSON.parse(localStorage.getItem("wg_history")||"[]"));setSaved(JSON.parse(localStorage.getItem("wg_saved")||"[]"));}catch{}},[]);
  useEffect(()=>{document.documentElement.dataset.theme=dark?"dark":"light"},[dark]);

  async function search(e){
    e?.preventDefault(); if(!query.trim())return;
    setErr(""); setLoading(true);
    try{const r=await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);const d=await r.json();setPlaces(d.results||[]);if(!d.results?.length)setErr("No matching location found.");}
    catch{setErr("Location search failed.");} finally{setLoading(false);}
  }
  async function load(p){
    setPlace(p);setPlaces([]);setLoading(true);setErr("");setAi(null);
    try{
      const r=await fetch(`/api/weather?lat=${p.latitude}&lon=${p.longitude}&timezone=${encodeURIComponent(p.timezone||"auto")}`);
      const d=await r.json();if(!r.ok)throw new Error(d.error);setData(d);
      const item={...p,title:`${p.name}, ${p.country}`,at:new Date().toISOString()};
      const h=[item,...history.filter(x=>x.id!==p.id)].slice(0,12);setHistory(h);localStorage.setItem("wg_history",JSON.stringify(h));
      const ar=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({location:`${p.name}, ${p.country}`,current:d.current,daily:d.daily,activity})});
      setAi(await ar.json());
    }catch(e){setErr(e.message||"Unable to load weather.");}finally{setLoading(false);}
  }
  function save(){if(!place)return;const s=[place,...saved.filter(x=>x.id!==place.id)];setSaved(s);localStorage.setItem("wg_saved",JSON.stringify(s));}
  const cur=data?.current||{}; const daily=data?.daily||{}; const hourly=data?.hourly||{};
  const [condition,icon]=weatherText(cur.weather_code);
  const temp=(n)=> unit==="F"?`${Math.round(Number(n)*9/5+32)}°F`:`${Math.round(Number(n))}°C`;
  const risk=data?.meta?.risk;
  const alert = risk?.level==="SEVERE" || [95,96,99].includes(cur.weather_code) || Number(cur.wind_speed_10m)>45 || Number(cur.temperature_2m)>=40;
  const next24=(hourly.time||[]).slice(0,24).map((t,i)=>({t,i,temp:hourly.temperature_2m?.[i],rain:hourly.precipitation_probability?.[i],code:hourly.weather_code?.[i],wind:hourly.wind_speed_10m?.[i]}));
  return <main className="app">
    <header className="topbar"><div className="brand"><span className="logo">🌦️</span><div><b>WeatherGPT AI</b><small>Global Weather Intelligence</small></div></div>
      <nav><button onClick={()=>setTab("home")} className={tab==="home"?"active":""}>Dashboard</button><button onClick={()=>setTab("history")}><History size={16}/> History</button><button onClick={()=>setTab("saved")}><Star size={16}/> Saved</button></nav>
      <div className="actions"><button className="iconbtn" onClick={()=>setDark(!dark)}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button><button className="unit" onClick={()=>setUnit(unit==="C"?"F":"C")}>°{unit}</button></div>
    </header>

    {tab==="history" && <section className="panel page"><h2>💬 Chat & Search History</h2><p className="muted">Your recent searches are stored locally in this browser.</p>{history.length?<div className="list">{history.map(x=><button className="listitem" key={x.id} onClick={()=>load(x)}><History size={17}/><span><b>{x.title}</b><small>{new Date(x.at).toLocaleString()}</small></span></button>)}</div>:<Empty text="No previous searches yet."/>}</section>}
    {tab==="saved" && <section className="panel page"><h2>⭐ Saved Locations</h2>{saved.length?<div className="grid">{saved.map(x=><button className="saved" key={x.id} onClick={()=>load(x)}><MapPin size={18}/><b>{x.name}</b><span>{x.country}</span></button>)}</div>:<Empty text="Save a location from its weather dashboard."/>}</section>}

    {tab==="home" && <><section className="hero"><div className="badge"><Sparkles size={14}/> AI-powered global weather intelligence</div><h1>Ask the weather.<br/><span>Understand what it means.</span></h1><p>Live conditions, future forecasts, alerts, travel intelligence and professional AI recommendations for locations worldwide.</p>
      <form onSubmit={search} className="search"><Search size={21}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search any city, country or destination..." /><button>{loading?"Searching…":"Search"}</button></form>
      {places.length>0&&<div className="results">{places.map(p=><button key={p.id} onClick={()=>load(p)}><MapPin size={17}/><span><b>{p.name}</b><small>{[p.admin1,p.country].filter(Boolean).join(", ")}</small></span></button>)}</div>}
      {err&&<div className="error">{err}</div>}
    </section>

    {data&&place&&<section className="content">
      <div className="locationbar"><div><span className="eyebrow">CURRENT LOCATION</span><h2><MapPin size={20}/>{place.name}, {place.country}</h2></div><div className="row"><button className="secondary" onClick={save}><Star size={16}/> Save</button><button className="secondary" onClick={()=>navigator.geolocation?.getCurrentPosition(pos=>load({...place,latitude:pos.coords.latitude,longitude:pos.coords.longitude,name:"Current Location"}))}><Navigation size={16}/> Use location</button></div></div>
      {alert&&<div className="alert"><div className="alerticon"><ShieldAlert/></div><div><b>⚠️ Weather Risk Alert — {risk?.level||"HIGH"}</b><p>{risk?.reasons?.join(". ")||"Potentially hazardous weather conditions detected. Check local official guidance before going outside."}</p><strong>Recommendation: Follow local official warnings and avoid unnecessary outdoor activity during severe conditions.</strong></div></div>}
      <div className="dashboard">
        <div className="panel current"><div className="currenttop"><div><span className="eyebrow">LIVE CONDITIONS</span><div className="bigtemp">{temp(cur.temperature_2m)}</div><h3>{icon} {condition}</h3><p>Feels like {temp(cur.apparent_temperature)}</p></div><div className="weathericon">{icon}</div></div><div className="metrics">
          <Metric icon={<Droplets/>} label="Humidity" value={`${cur.relative_humidity_2m??"—"}%`}/><Metric icon={<Wind/>} label="Wind" value={`${Math.round(cur.wind_speed_10m||0)} km/h`}/><Metric icon={<Gauge/>} label="Pressure" value={`${Math.round(cur.pressure_msl||0)} hPa`}/><Metric icon={<Eye/>} label="Visibility" value={hourly.visibility?.[0]?`${(hourly.visibility[0]/1000).toFixed(1)} km`:"—"}/><Metric icon={<Umbrella/>} label="Rain chance" value={`${daily.precipitation_probability_max?.[0]??0}%`}/><Metric icon={<Sun/>} label="UV Max" value={`${daily.uv_index_max?.[0]??"—"}`}/></div></div>
        <div className="panel ai"><div className="panelhead"><div><span className="eyebrow">WEATHERGPT INTELLIGENCE</span><h3>🤖 AI Weather Analysis</h3></div><span className="live">● LIVE DATA</span></div>{ai?.text?<p className="prose">{ai.text}</p>:<><p className="prose">{ai?.summary||"Analyzing the latest available forecast…"}</p>{ai?.recommendation&&<p className="recommend">{ai.recommendation}</p>}<div className="score"><div><small>OUTDOOR SCORE</small><b>{ai?.score??"—"}/100</b></div><span>{ai?.verdict||"Analyzing"}</span></div></>}</div>
      </div>

      <div className="panel"><div className="panelhead"><div><span className="eyebrow">NEXT 24 HOURS</span><h3>Hourly Forecast</h3></div></div><div className="hourly">{next24.map(x=>{const [c,i]=weatherText(x.code);return <div className="hour" key={x.t}><b>{hour(x.t)}</b><span>{i}</span><strong>{temp(x.temp)}</strong><small>🌧 {x.rain??0}%</small><small>💨 {Math.round(x.wind||0)} km/h</small></div>})}</div></div>

      <div className="panel"><div className="panelhead"><div><span className="eyebrow">UP TO 16 DAYS</span><h3>Future Forecast</h3></div></div><div className="daily">{(daily.time||[]).map((d,i)=>{const [c,ic]=weatherText(daily.weather_code?.[i]);return <div className="daycard" key={d}><b>{day(d)}</b><span>{ic}</span><strong>{temp(daily.temperature_2m_max?.[i])}</strong><small>{temp(daily.temperature_2m_min?.[i])}</small><small>🌧 {daily.precipitation_probability_max?.[i]??0}%</small><small>💨 {Math.round(daily.wind_speed_10m_max?.[i]||0)} km/h</small></div>})}</div></div>

      <div className="decision"><div className="panel"><span className="eyebrow">PLAN SMARTER</span><h3>🧭 Weather Decision Center</h3><p className="muted">Choose an activity and get a data-driven recommendation.</p><div className="chips">{["general","walking","running","cycling","hiking","picnic","beach","travel","outdoor event"].map(a=><button key={a} onClick={async()=>{setActivity(a); if(place&&data){const r=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({location:`${place.name}, ${place.country}`,current:data.current,daily:data.daily,activity:a})});setAi(await r.json())}}} className={activity===a?"chip active":"chip"}>{a}</button>)}</div><div className="decisionbox"><Plane size={24}/><div><b>{ai?.verdict||"Select an activity"}</b><p>{ai?.recommendation||"WeatherGPT will analyze the latest forecast for your chosen activity."}</p></div></div></div>
        <div className="panel"><span className="eyebrow">RISK CENTER</span><h3>⚠️ Weather Risk</h3><div className={`risk ${risk?.level?.toLowerCase()||"low"}`}><b>{risk?.level||"LOW"} RISK</b><strong>{risk?.score??0}/100</strong></div><ul>{(risk?.reasons?.length?risk.reasons:["No major risk indicators detected in the current data."]).map((r,i)=><li key={i}>{r}</li>)}</ul></div></div>
      <div className="footerline">Weather data: Open-Meteo · Forecast values are provider data; AI text is analysis, not an independent weather forecast.</div>
    </section>}
    {!data&&tab==="home"&&<section className="featuregrid"><Feature icon="🚨" title="Live Weather Alerts" text="Risk detection and professional warning explanations."/><Feature icon="🔮" title="Future Intelligence" text="Forecast analysis with best-time and activity recommendations."/><Feature icon="✈️" title="Travel Advisor" text="Data-driven travel and outdoor decisions."/><Feature icon="🌍" title="Global Coverage" text="Search cities and regions worldwide."/><Feature icon="🗺️" title="Weather Intelligence" text="Built for maps, environmental data and global expansion."/><Feature icon="💬" title="Chat History" text="Keep previous searches available on this device." /></section>}
    </>}
  </main>
}
function Metric({icon,label,value}){return <div className="metric">{icon}<span><small>{label}</small><b>{value}</b></span></div>}
function Feature({icon,title,text}){return <div className="feature"><span>{icon}</span><h3>{title}</h3><p>{text}</p></div>}
function Empty({text}){return <div className="empty">{text}</div>}