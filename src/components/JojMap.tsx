import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
  Compass, Trophy, Route as RouteIcon, Building2, Crosshair, X,
  Sun, Moon, Plus, Minus, LocateFixed, Layers, Ruler, Menu, Navigation,
  ArrowRight, ChevronRight, Zap, Car, Bike, Footprints,
  CornerUpLeft, CornerUpRight, ArrowUp, RotateCcw, Flag, Play, Pause, ChevronLeft, Volume2, VolumeX,
  Palette, AlertTriangle, Coins, MapPin, ExternalLink, Sparkles,
} from "lucide-react";
import uadbLogo from "@/assets/uadb-logo.png";
import { findRegion, wikipediaUrl, senegalTourismUrl, lonelyPlanetUrl, tourismMapsUrl } from "@/lib/regions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BookOpen, Globe, Map as MapIcon } from "lucide-react";

// Détecte si un step correspond à un axe à péage au Sénégal et estime le coût
const TOLL_PATTERNS = /(autoroute|péage|peage|\bA1\b|ila touba|aibd|diamniadio)/i;
function isTollStep(name: string): boolean {
  return TOLL_PATTERNS.test(name || "");
}
// Tarif moyen ~65 FCFA/km sur les autoroutes à péage du Sénégal
const TOLL_RATE_FCFA_PER_KM = 65;
function fmtFcfa(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}
// Devine le nom principal du trajet ("via …") à partir des plus longs segments
function mainVia(steps: { name: string; distance: number }[]): string {
  const totals = new Map<string, number>();
  for (const s of steps) {
    if (!s.name) continue;
    totals.set(s.name, (totals.get(s.name) ?? 0) + s.distance);
  }
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([n]) => n);
  return top.length ? top.join(" · ") : "Itinéraire";
}


type TravelMode = "driving" | "cycling" | "foot";
const MODE_META: Record<TravelMode, { label: string; icon: typeof Car }> = {
  driving: { label: "Voiture", icon: Car },
  cycling: { label: "Vélo", icon: Bike },
  foot: { label: "À pied", icon: Footprints },
};
import {
  JOJ_SITES,
  ROUTES_SENEGAL,
  VILLES,
  DAKAR,
  BOUNDS,
  haversine,
  type JojSite,
} from "@/lib/joj-data";

type Dest = { key: string; name: string; lat: number; lng: number; kind: "site" | "ville" };

// Touch swipe helper — detects horizontal/vertical swipes with thresholds
function useSwipe(opts: {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
}) {
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const T = opts.threshold ?? 50;
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      startRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = startRef.current;
      startRef.current = null;
      if (!s) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      if (Date.now() - s.t > 600) return;
      if (adx > ady && adx > T) {
        if (dx < 0) opts.onSwipeLeft?.(); else opts.onSwipeRight?.();
      } else if (ady > adx && ady > T) {
        if (dy < 0) opts.onSwipeUp?.(); else opts.onSwipeDown?.();
      }
    },
  };
}

// SVG trophy icon (lucide path) injected directly into divIcon HTML
const TROPHY_SVG = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#0A0F1E" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`;

function makeJojIcon(_emoji: string) {
  return L.divIcon({
    className: "",
    html: `<div class="joj-marker"><div class="pulse"></div><div class="pulse"></div><div class="core">${TROPHY_SVG}</div></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

function pinIcon(color: string, letter: string) {
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:30px;height:38px;">
      <div style="position:absolute;inset:0;background:${color};clip-path:path('M15 0 C5 0 0 8 0 15 C0 26 15 38 15 38 C15 38 30 26 30 15 C30 8 25 0 15 0 Z');box-shadow:0 4px 12px rgba(0,0,0,.6)"></div>
      <div style="position:absolute;top:5px;left:0;right:0;text-align:center;color:#0A0F1E;font-weight:800;font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:.05em;">${letter}</div>
    </div>`,
    iconSize: [30, 38],
    iconAnchor: [15, 38],
  });
}

function fmtDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

function fmtDistance(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

function maneuverFr(type: string, modifier: string | undefined, name: string): string {
  const dir: Record<string, string> = {
    left: "à gauche", right: "à droite",
    "slight left": "légèrement à gauche", "slight right": "légèrement à droite",
    "sharp left": "fortement à gauche", "sharp right": "fortement à droite",
    straight: "tout droit", uturn: "demi-tour",
  };
  const d = modifier ? dir[modifier] ?? modifier : "";
  const on = name ? ` sur ${name}` : "";
  switch (type) {
    case "depart": return `Départ${on}`;
    case "arrive": return `Arrivée${on}`;
    case "turn": return `Tourner ${d}${on}`;
    case "continue": return `Continuer ${d}${on}`.trim();
    case "merge": return `S'insérer ${d}${on}`.trim();
    case "on ramp": return `Prendre la bretelle ${d}${on}`.trim();
    case "off ramp": return `Sortir ${d}${on}`.trim();
    case "fork": return `Embranchement ${d}${on}`.trim();
    case "roundabout": case "rotary": return `Au rond-point, prendre ${d || "la sortie"}${on}`;
    case "end of road": return `Au bout de la route, ${d}${on}`.trim();
    default: return `${type} ${d}${on}`.trim();
  }
}

function ManeuverIcon({ type, modifier, size = 28 }: { type: string; modifier?: string; size?: number }) {
  if (type === "arrive") return <Flag size={size} />;
  if (type === "depart") return <Navigation size={size} />;
  if (type === "roundabout" || type === "rotary") return <RotateCcw size={size} />;
  if (modifier?.includes("left")) return <CornerUpLeft size={size} />;
  if (modifier?.includes("right")) return <CornerUpRight size={size} />;
  if (modifier === "uturn") return <RotateCcw size={size} />;
  return <ArrowUp size={size} />;
}

export function JojMap() {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseDarkRef = useRef<L.TileLayer | null>(null);
  const baseSatRef = useRef<L.TileLayer | null>(null);
  const routeLayersRef = useRef<L.Polyline[]>([]);
  const siteMarkersRef = useRef<L.Marker[]>([]);
  const cityMarkersRef = useRef<L.Marker[]>([]);

  // measure state
  const measuringRef = useRef(false);
  const measurePtsRef = useRef<[number, number][]>([]);
  const measureLineRef = useRef<L.Polyline | null>(null);
  const measureMarkersRef = useRef<L.CircleMarker[]>([]);

  // itinerary state/refs
  const itinLayersRef = useRef<{ halo: L.Polyline; line: L.Polyline }[]>([]);
  const originMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const pickingOriginRef = useRef(false);

  const [selected, setSelected] = useState<JojSite | null>(null);
  const [showCities, setShowCities] = useState(true);
  const [showSites, setShowSites] = useState(true);
  const [routeVis, setRouteVis] = useState<boolean[]>(() => ROUTES_SENEGAL.map(() => false));
  const [darkMode, setDarkMode] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const PALETTES = ["cyan", "gold", "sahel"] as const;
  type Palette = typeof PALETTES[number];
  const PALETTE_LABEL: Record<Palette, string> = { cyan: "Océan", gold: "Or", sahel: "Sahel" };
  const [palette, setPalette] = useState<Palette>("cyan");

  const [measuring, setMeasuring] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [days, setDays] = useState<number>(0);
  const [flip, setFlip] = useState(false);

  // itinerary UI state
  type Pt = { lat: number; lng: number; label: string };
  type Sug = { display_name: string; lat: string; lon: string };
  type Step = { instruction: string; distance: number; name: string; type: string; modifier?: string; location: [number, number] };
  type Alt = { distance: number; duration: number; coords: [number, number][]; steps: Step[]; tollKm: number; tollPrice: number; via: string; noToll?: boolean };
  const [origin, setOrigin] = useState<Pt | null>(null);
  const [dest, setDest] = useState<Pt | null>(null);
  const [originQuery, setOriginQuery] = useState("");
  const [destQuery, setDestQuery] = useState("");
  const [originSugs, setOriginSugs] = useState<Sug[]>([]);
  const [destSugs, setDestSugs] = useState<Sug[]>([]);
  const [pickingOrigin, setPickingOrigin] = useState(false);
  const [itinLoading, setItinLoading] = useState(false);
  const [itinError, setItinError] = useState<string | null>(null);
  const [alts, setAlts] = useState<Alt[]>([]);
  const [selectedAlt, setSelectedAlt] = useState(0);
  const [fastestIdx, setFastestIdx] = useState(0);
  const [shortestIdx, setShortestIdx] = useState(0);
  const [travelMode, setTravelMode] = useState<TravelMode>("driving");

  // step-by-step guidance
  const [guiding, setGuiding] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [voiceOn, setVoiceOn] = useState(true);
  const [userDist, setUserDist] = useState<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const maneuverMarkerRef = useRef<L.Marker | null>(null);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);
  const spokenRef = useRef<number>(-1);

  const destinations = useMemo<Dest[]>(
    () => [
      ...JOJ_SITES.map((s) => ({ key: `s:${s.name}`, name: `🏅 ${s.name}`, lat: s.lat, lng: s.lng, kind: "site" as const })),
      ...VILLES.map((v) => ({ key: `v:${v.name}`, name: `🏙️ ${v.name}`, lat: v.lat, lng: v.lng, kind: "ville" as const })),
    ],
    []
  );



  // init map (once)
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, {
      zoomControl: false,
      attributionControl: true,
      minZoom: 5,
      maxZoom: 17,
    }).setView(DAKAR, 7);
    mapRef.current = map;

    baseDarkRef.current = L.tileLayer(
      "https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png",
      { attribution: "© OpenStreetMap © CARTO", subdomains: "abcd" }
    ).addTo(map);
    baseSatRef.current = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { attribution: "Tiles © Esri" }
    );

    // Routes (créées masquées; géométrie réelle chargée via OSRM à la demande)
    ROUTES_SENEGAL.forEach((r) => {
      const poly = L.polyline(r.coords, {
        color: r.color,
        weight: 4,
        opacity: 0.85,
        lineJoin: "round",
        lineCap: "round",
        className: "route-anim",
      });
      poly.bindTooltip(r.name, { sticky: true, direction: "top" });
      poly.on("mouseover", () => poly.setStyle({ weight: 7, opacity: 1 }));
      poly.on("mouseout", () => poly.setStyle({ weight: 4, opacity: 0.85 }));
      // tag pour lazy-load de la géométrie réelle
      (poly as L.Polyline & { _realLoaded?: boolean })._realLoaded = false;
      routeLayersRef.current.push(poly);
    });

    // Sites
    JOJ_SITES.forEach((s) => {
      const m = L.marker([s.lat, s.lng], { icon: makeJojIcon(s.icon), title: s.name }).addTo(map);
      const d = haversine(DAKAR, [s.lat, s.lng]);
      m.bindPopup(
        `<b>${s.name}</b>${s.icon} ${s.sport}<br/><small style="color:#00D4FF">${d} km de Dakar</small>`
      );
      m.on("click", () => {
        setSelected(s);
        map.flyTo([s.lat, s.lng], 13, { duration: 1.1 });
      });
      siteMarkersRef.current.push(m);
    });

    // Cities
    VILLES.forEach((v) => {
      const isCap = v.type === "capitale";
      const html = `<div class="city-marker ${isCap ? "capital" : ""}"></div><div class="city-label ${isCap ? "capital" : ""}">${v.name}</div>`;
      const ic = L.divIcon({ className: "", html, iconSize: [10, 10], iconAnchor: [5, 5] });
      const m = L.marker([v.lat, v.lng], { icon: ic, keyboard: false }).addTo(map);
      m.bindPopup(`<b>${v.name}</b>Population : ${v.pop}<br/><small>${v.type}</small>`);
      cityMarkersRef.current.push(m);
    });

    // measure / pick-origin handler
    map.on("click", (e) => {
      if (pickingOriginRef.current) {
        const { lat, lng } = e.latlng;
        setOrigin({ lat, lng, label: `Position choisie (${lat.toFixed(3)}, ${lng.toFixed(3)})` });
        setPickingOrigin(false);
        return;
      }
      if (!measuringRef.current) return;
      const pt: [number, number] = [e.latlng.lat, e.latlng.lng];
      measurePtsRef.current.push(pt);
      const cm = L.circleMarker(e.latlng, {
        radius: 5, color: "#F5A623", fillColor: "#F5A623", fillOpacity: 1,
      }).addTo(map);
      measureMarkersRef.current.push(cm);
      if (measurePtsRef.current.length > 1) {
        if (measureLineRef.current) map.removeLayer(measureLineRef.current);
        measureLineRef.current = L.polyline(measurePtsRef.current, {
          color: "#F5A623", weight: 3, dashArray: "6 6",
        }).addTo(map);
        let total = 0;
        for (let i = 1; i < measurePtsRef.current.length; i++) {
          total += haversine(measurePtsRef.current[i - 1], measurePtsRef.current[i]);
        }
        cm.bindTooltip(`${total} km`, { permanent: true, direction: "top", offset: [0, -6] }).openTooltip();
      }
    });

    // close mobile sidebar on map click (unless picking origin)
    map.on("click", () => {
      if (pickingOriginRef.current) return;
      if (window.innerWidth < 820) setSidebarOpen(false);
    });


    const t = setTimeout(() => map.flyToBounds(BOUNDS, { duration: 1.4 }), 400);
    return () => {
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // toggle base layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !baseDarkRef.current || !baseSatRef.current) return;
    if (darkMode) { map.removeLayer(baseSatRef.current); baseDarkRef.current.addTo(map); }
    else { map.removeLayer(baseDarkRef.current); baseSatRef.current.addTo(map); }
  }, [darkMode]);

  // UI theme (clair / sombre) + palette
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", theme === "light");
    PALETTES.forEach((p) => root.classList.remove(`theme-${p}`));
    if (palette !== "cyan") root.classList.add(`theme-${palette}`);
  }, [theme, palette]);


  // toggle cities / sites
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    cityMarkersRef.current.forEach((m) => (showCities ? m.addTo(map) : map.removeLayer(m)));
  }, [showCities]);
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    siteMarkersRef.current.forEach((m) => (showSites ? m.addTo(map) : map.removeLayer(m)));
  }, [showSites]);

  // routes toggles — charge la géométrie réelle OSRM à la 1ère activation
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    routeLayersRef.current.forEach((p, i) => {
      const visible = routeVis[i];
      if (visible) {
        p.addTo(map);
        const poly = p as L.Polyline & { _realLoaded?: boolean };
        if (!poly._realLoaded) {
          poly._realLoaded = true;
          const coords = ROUTES_SENEGAL[i].coords;
          const path = coords.map(([la, ln]) => `${ln},${la}`).join(";");
          fetch(`https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson`)
            .then((r) => r.json())
            .then((data) => {
              const route = data?.routes?.[0];
              if (!route) return;
              const real = (route.geometry.coordinates as [number, number][]).map(
                ([ln, la]) => [la, ln] as [number, number]
              );
              poly.setLatLngs(real);
            })
            .catch(() => { poly._realLoaded = false; });
        }
      } else {
        map.removeLayer(p);
      }
    });
  }, [routeVis]);

  // measure ref sync + reset
  useEffect(() => {
    measuringRef.current = measuring;
    if (!measuring) {
      const map = mapRef.current;
      if (measureLineRef.current && map) { map.removeLayer(measureLineRef.current); measureLineRef.current = null; }
      if (map) measureMarkersRef.current.forEach((m) => map.removeLayer(m));
      measureMarkersRef.current = [];
      measurePtsRef.current = [];
    }
  }, [measuring]);

  // countdown
  useEffect(() => {
    const TARGET = new Date("2026-10-22T00:00:00Z").getTime();
    const tick = () => {
      const d = Math.max(0, Math.ceil((TARGET - Date.now()) / 86400000));
      setDays((prev) => {
        if (prev !== d) {
          setFlip(true);
          setTimeout(() => setFlip(false), 600);
        }
        return d;
      });
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // header particles
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const resize = () => { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);
    const ps = Array.from({ length: 30 }, () => ({
      x: Math.random() * cv.width, y: Math.random() * cv.height,
      r: Math.random() * 1.6 + 0.4,
      vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
      a: Math.random() * 0.6 + 0.2,
    }));
    let raf = 0;
    const loop = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      ps.forEach((p) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > cv.width) p.vx *= -1;
        if (p.y < 0 || p.y > cv.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245,166,35,${p.a})`;
        ctx.shadowColor = "#F5A623"; ctx.shadowBlur = 8;
        ctx.fill();
      });
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  const recenter = () => mapRef.current?.flyToBounds(BOUNDS, { duration: 1.2 });
  const focusSite = (s: JojSite) => {
    setSelected(s);
    setDest({ lat: s.lat, lng: s.lng, label: s.name });
    setDestQuery(s.name);
    mapRef.current?.flyTo([s.lat, s.lng], 13, { duration: 1.1 });
    if (window.innerWidth < 820) setSidebarOpen(false);
  };

  // sync picking-origin ref
  useEffect(() => { pickingOriginRef.current = pickingOrigin; }, [pickingOrigin]);

  // origin marker
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (originMarkerRef.current) { map.removeLayer(originMarkerRef.current); originMarkerRef.current = null; }
    if (origin) {
      originMarkerRef.current = L.marker([origin.lat, origin.lng], { icon: pinIcon("#00D4FF", "A"), title: "Départ" })
        .addTo(map).bindTooltip(origin.label, { direction: "top", offset: [0, -32] });
    }
  }, [origin]);

  // dest marker
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (destMarkerRef.current) { map.removeLayer(destMarkerRef.current); destMarkerRef.current = null; }
    if (dest) {
      destMarkerRef.current = L.marker([dest.lat, dest.lng], { icon: pinIcon("#F5A623", "B"), title: dest.label })
        .addTo(map).bindTooltip(dest.label, { direction: "top", offset: [0, -32] });
    }
  }, [dest]);

  const useMyLocation = () => {
    setItinError(null);
    if (!navigator.geolocation) {
      setItinError("Géolocalisation non supportée par ce navigateur.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: "Ma position actuelle" };
        setOrigin(p);
        setOriginQuery(p.label);
        setOriginSugs([]);
        mapRef.current?.flyTo([p.lat, p.lng], 10, { duration: 1 });
      },
      (err) => setItinError(`Géolocalisation refusée : ${err.message}`),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // geocoding (Nominatim) – debounced
  const geocode = async (q: string): Promise<Sug[]> => {
    if (q.trim().length < 3) return [];
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=sn&q=${encodeURIComponent(q)}`;
    try {
      const r = await fetch(url, { headers: { "Accept-Language": "fr" } });
      if (!r.ok) return [];
      return (await r.json()) as Sug[];
    } catch { return []; }
  };
  useEffect(() => {
    if (origin && originQuery === origin.label) return;
    const t = setTimeout(async () => setOriginSugs(await geocode(originQuery)), 350);
    return () => clearTimeout(t);
  }, [originQuery, origin]);
  useEffect(() => {
    if (dest && destQuery === dest.label) return;
    const t = setTimeout(async () => setDestSugs(await geocode(destQuery)), 350);
    return () => clearTimeout(t);
  }, [destQuery, dest]);

  const pickSug = (s: Sug, kind: "o" | "d") => {
    const p: Pt = { lat: parseFloat(s.lat), lng: parseFloat(s.lon), label: s.display_name.split(",").slice(0, 2).join(",") };
    if (kind === "o") { setOrigin(p); setOriginQuery(p.label); setOriginSugs([]); }
    else { setDest(p); setDestQuery(p.label); setDestSugs([]); }
    mapRef.current?.flyTo([p.lat, p.lng], 10, { duration: 1 });
  };

  const stopGuide = () => {
    setGuiding(false);
    setGuideStep(0);
    setUserDist(null);
    spokenRef.current = -1;
    if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    const map = mapRef.current;
    if (map) {
      if (maneuverMarkerRef.current) { map.removeLayer(maneuverMarkerRef.current); maneuverMarkerRef.current = null; }
      if (userMarkerRef.current) { map.removeLayer(userMarkerRef.current); userMarkerRef.current = null; }
    }
  };

  const clearItinerary = () => {
    stopGuide();
    const map = mapRef.current;
    if (map) itinLayersRef.current.forEach(({ halo, line }) => { map.removeLayer(halo); map.removeLayer(line); });
    itinLayersRef.current = [];
    setAlts([]);
    setItinError(null);
  };

  // meters between two lat/lng
  const distM = (a: [number, number], b: [number, number]) => {
    const R = 6371000;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(b[0] - a[0]);
    const dLng = toRad(b[1] - a[1]);
    const lat1 = toRad(a[0]), lat2 = toRad(b[0]);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  };

  const speak = (text: string) => {
    if (!voiceOn || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "fr-FR";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch { /* ignore */ }
  };

  const startGuide = () => {
    if (!alts[selectedAlt]?.steps.length) return;
    setGuiding(true);
    setGuideStep(0);
    spokenRef.current = -1;
  };

  const nextStep = () => {
    const total = alts[selectedAlt]?.steps.length ?? 0;
    setGuideStep((i) => Math.min(i + 1, Math.max(total - 1, 0)));
  };
  const prevStep = () => setGuideStep((i) => Math.max(0, i - 1));

  // Touch gestures
  const infoSwipe = useSwipe({
    onSwipeUp: () => setSelected(null),
    onSwipeRight: () => setSelected(null),
  });
  const guideSwipe = useSwipe({
    onSwipeLeft: () => nextStep(),
    onSwipeRight: () => prevStep(),
    onSwipeDown: () => stopGuide(),
  });

  const drawAlts = (list: Alt[], shortest: number, selectedIdx: number) => {
    const map = mapRef.current; if (!map) return;
    itinLayersRef.current.forEach(({ halo, line }) => { map.removeLayer(halo); map.removeLayer(line); });
    itinLayersRef.current = [];
    // draw non-selected first, shortest/selected on top
    const order = list.map((_, i) => i).sort((a, b) => {
      const w = (i: number) => (i === selectedIdx ? 2 : i === shortest ? 1 : 0);
      return w(a) - w(b);
    });
    order.forEach((i) => {
      const a = list[i];
      const isSel = i === selectedIdx;
      const isShort = i === shortest;
      const color = isShort ? "#F5A623" : "#00D4FF";
      const halo = L.polyline(a.coords, {
        color, weight: isSel ? 12 : 8, opacity: isSel ? 0.4 : 0.12, lineCap: "round", lineJoin: "round",
      }).addTo(map);
      const line = L.polyline(a.coords, {
        color, weight: isShort ? 6 : isSel ? 5 : 3, opacity: isShort || isSel ? 1 : 0.55, lineCap: "round", lineJoin: "round",
        dashArray: !isShort && !isSel ? "8 8" : undefined,
        className: isShort ? "route-anim" : undefined,
      }).addTo(map);
      line.on("click", () => setSelectedAlt(i));
      itinLayersRef.current.push({ halo, line });
    });
  };

  const computeItinerary = async (modeOverride?: TravelMode) => {
    const mode = modeOverride ?? travelMode;
    setItinError(null);
    if (!origin || !dest) { setItinError("Choisissez un point de départ et une destination."); return; }
    setItinLoading(true);
    try {
      const baseUrl = (exclude?: string) =>
        `https://router.project-osrm.org/route/v1/${mode}/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson&alternatives=true&steps=true&annotations=false${exclude ? `&exclude=${exclude}` : ""}`;
      type OsrmStep = { maneuver: { type: string; modifier?: string; location: [number, number] }; name: string; distance: number };
      type OsrmRoute = { distance: number; duration: number; geometry: { coordinates: [number, number][] }; legs: { steps: OsrmStep[] }[] };

      const mapRoute = (r: OsrmRoute, noToll = false): Alt => {
        const steps = r.legs.flatMap((leg) =>
          leg.steps.map((s) => ({
            instruction: maneuverFr(s.maneuver.type, s.maneuver.modifier, s.name),
            distance: s.distance,
            name: s.name || "",
            type: s.maneuver.type,
            modifier: s.maneuver.modifier,
            location: [s.maneuver.location[1], s.maneuver.location[0]] as [number, number],
          }))
        );
        const tollMeters = noToll ? 0 : steps.reduce((sum, s) => sum + (isTollStep(s.name) ? s.distance : 0), 0);
        const tollKm = tollMeters / 1000;
        const tollPrice = mode === "driving" && !noToll ? Math.round(tollKm * TOLL_RATE_FCFA_PER_KM) : 0;
        return {
          distance: r.distance,
          duration: r.duration,
          coords: r.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
          steps,
          tollKm,
          tollPrice,
          via: mainVia(steps),
          noToll,
        };
      };

      const res = await fetch(baseUrl());
      if (!res.ok) throw new Error(`OSRM ${res.status}`);
      const data = await res.json();
      const routes = (data.routes ?? []) as OsrmRoute[];
      if (!routes.length) throw new Error("Aucun itinéraire trouvé.");
      const list: Alt[] = routes.map((r) => mapRoute(r));

      // En voiture : ajoute une alternative sans péage via les routes nationales (exclude=motorway)
      if (mode === "driving") {
        try {
          const res2 = await fetch(baseUrl("motorway"));
          if (res2.ok) {
            const data2 = await res2.json();
            const ntRoutes = (data2.routes ?? []) as OsrmRoute[];
            if (ntRoutes.length) {
              const nt = mapRoute(ntRoutes[0], true);
              // évite les doublons quasi identiques aux routes existantes
              const isDup = list.some((a) => Math.abs(a.distance - nt.distance) < 500 && Math.abs(a.duration - nt.duration) < 60);
              if (!isDup) list.push(nt);
            }
          }
        } catch { /* ignore : on garde au moins l'itinéraire principal */ }
      }

      let fastest = 0, shortest = 0;
      list.forEach((a, i) => {
        if (a.duration < list[fastest].duration) fastest = i;
        if (a.distance < list[shortest].distance) shortest = i;
      });
      setAlts(list);
      setFastestIdx(fastest);
      setShortestIdx(shortest);
      setSelectedAlt(shortest);
      drawAlts(list, shortest, shortest);
      const map = mapRef.current!;
      map.flyToBounds(L.latLngBounds(list[shortest].coords), { padding: [80, 80], duration: 1.2 });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setItinError(`Calcul impossible : ${msg}`);
    } finally {
      setItinLoading(false);
    }
  };

  // redraw when selection changes
  useEffect(() => {
    if (alts.length) drawAlts(alts, shortestIdx, selectedAlt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAlt]);

  // when entering a new guide step: place maneuver marker, fly to it, speak instruction
  useEffect(() => {
    if (!guiding) return;
    const map = mapRef.current;
    const step = alts[selectedAlt]?.steps[guideStep];
    if (!map || !step) return;
    if (maneuverMarkerRef.current) { map.removeLayer(maneuverMarkerRef.current); maneuverMarkerRef.current = null; }
    const icon = L.divIcon({
      className: "",
      html: `<div style="display:flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:50%;background:#F5A623;color:#0A0F1E;font-weight:800;box-shadow:0 0 0 4px rgba(245,166,35,0.35),0 6px 18px rgba(0,0,0,.5);border:2px solid #0A0F1E;">${guideStep + 1}</div>`,
      iconSize: [42, 42], iconAnchor: [21, 21],
    });
    maneuverMarkerRef.current = L.marker(step.location, { icon, interactive: false }).addTo(map);
    map.flyTo(step.location, Math.max(map.getZoom(), 15), { duration: 0.8 });
    if (spokenRef.current !== guideStep) {
      spokenRef.current = guideStep;
      speak(step.instruction);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guiding, guideStep, selectedAlt]);

  // GPS watch for auto-advance + user marker
  useEffect(() => {
    if (!guiding) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const map = mapRef.current;
        const step = alts[selectedAlt]?.steps[guideStep];
        if (!map || !step) return;
        const here: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        if (!userMarkerRef.current) {
          userMarkerRef.current = L.circleMarker(here, {
            radius: 8, color: "#00D4FF", weight: 3, fillColor: "#00D4FF", fillOpacity: 0.6,
          }).addTo(map);
        } else {
          userMarkerRef.current.setLatLng(here);
        }
        const d = distM(here, step.location);
        setUserDist(d);
        if (d < 30 && guideStep < (alts[selectedAlt]?.steps.length ?? 0) - 1) {
          setGuideStep((i) => i + 1);
        }
      },
      () => { /* ignore errors */ },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guiding, selectedAlt]);


  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-dark text-text">
      {/* HEADER */}
      <header className="fixed inset-x-0 top-0 z-[1000] flex h-[60px] md:h-[72px] items-center gap-2 md:gap-4 overflow-hidden border-b border-[var(--border)] bg-gradient-to-b from-[rgba(10,15,30,0.92)] to-[rgba(10,15,30,0.55)] px-3 md:px-5 backdrop-blur-md">
        <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-55" />
        <button
          aria-label="Ouvrir le menu"
          onClick={() => setSidebarOpen((v) => !v)}
          className="relative z-10 inline-flex items-center justify-center rounded-lg border border-[var(--border)] p-2 text-gold md:hidden"
        ><Menu size={18} /></button>
        <div className="relative z-10 flex items-center gap-2 md:gap-3.5 min-w-0">
          <img
            src={uadbLogo}
            alt="Université Alioune Diop de Bambey"
            className="h-9 md:h-12 w-auto shrink-0 rounded-md bg-white/95 p-1 shadow-[0_0_14px_rgba(0,226,224,0.35)]"
          />
          <div className="leading-none min-w-0">
            <h1 className="font-display text-[18px] md:text-[26px] tracking-[0.06em] md:tracking-[0.08em] text-gold truncate">JOJ Sénégal 2026</h1>
            <div className="mt-1 text-[10px] md:text-[11px] uppercase tracking-[0.28em] md:tracking-[0.32em] text-[var(--accent)] truncate">
              L'UADB for Dakar 2K26
            </div>
          </div>
        </div>
        <div className="relative z-10 ml-auto flex items-center gap-2 md:gap-3">
          <button
            onClick={() => {
              const i = PALETTES.indexOf(palette);
              setPalette(PALETTES[(i + 1) % PALETTES.length]);
            }}
            aria-label="Changer la palette de couleurs"
            title={`Palette : ${PALETTE_LABEL[palette]}`}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[rgba(0,226,224,0.06)] px-2.5 md:px-3 py-2 text-[12px] uppercase tracking-wider text-gold transition-colors hover:bg-[rgba(0,226,224,0.16)]"
          >
            <Palette size={16} />
            <span className="hidden md:inline">{PALETTE_LABEL[palette]}</span>
          </button>
          <button
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            aria-label={theme === "dark" ? "Activer le mode clair" : "Activer le mode sombre"}
            title={theme === "dark" ? "Mode clair" : "Mode sombre"}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[rgba(0,226,224,0.06)] px-2.5 md:px-3 py-2 text-[12px] uppercase tracking-wider text-gold transition-colors hover:bg-[rgba(0,226,224,0.16)]"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            <span className="hidden sm:inline">{theme === "dark" ? "Clair" : "Sombre"}</span>
          </button>
          <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[rgba(0,226,224,0.06)] px-2.5 md:px-4 py-1.5 md:py-2.5">
            <span className={`cd-num font-display text-[20px] md:text-[28px] text-gold ${flip ? "cd-flip" : ""}`} style={{ minWidth: 40, textAlign: "center" }}>
              {String(days).padStart(3, "0")}
            </span>
            <span className="hidden sm:inline text-[10px] uppercase leading-tight tracking-[0.25em] text-text/70">
              jours avant<br />les Jeux
            </span>
          </div>

        </div>
      </header>

      {/* LAYOUT */}
      <div className="fixed inset-x-0 bottom-0 top-[60px] md:top-[72px] flex">
        {/* MOBILE BACKDROP */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="absolute inset-0 z-[550] bg-black/50 backdrop-blur-sm md:hidden"
            aria-hidden="true"
          />
        )}
        {/* SIDEBAR */}
        <aside
          className={`joj-scroll absolute z-[600] h-full w-[85vw] max-w-[340px] md:w-[300px] flex-shrink-0 overflow-y-auto border-r border-[var(--border)] bg-[var(--glass-strong)] p-4 pb-24 backdrop-blur-xl transition-transform duration-300 md:relative md:translate-x-0 ${sidebarOpen ? "translate-x-0 shadow-[8px_0_40px_rgba(0,0,0,0.6)]" : "-translate-x-full md:shadow-none"}`}
        >
          <Section title="Itinéraire" icon={<Compass size={18} />}>
            <div className="space-y-2 text-[13px]">
              {/* DÉPART */}
              <div className="rounded-lg border border-[var(--border)] bg-black/20 p-2.5">
                <div className="mb-1.5 flex items-center gap-2 text-[11px] uppercase tracking-wider text-accent">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-dark">A</span>
                  Départ
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={originQuery}
                    onChange={(e) => { setOriginQuery(e.target.value); if (origin && e.target.value !== origin.label) setOrigin(null); }}
                    placeholder="Ville, adresse, lieu…"
                    className="w-full rounded-md border border-[var(--border)] bg-dark px-2 py-1.5 text-[12px] text-text focus:border-accent focus:outline-none"
                    aria-label="Adresse de départ"
                  />
                  {originSugs.length > 0 && (
                    <ul className="absolute left-0 right-0 top-full z-[700] mt-1 max-h-48 overflow-y-auto rounded-md border border-[var(--border)] bg-dark text-[12px] shadow-xl">
                      {originSugs.map((s, i) => (
                        <li key={i}>
                          <button onClick={() => pickSug(s, "o")} className="block w-full truncate px-2.5 py-1.5 text-left text-text/90 hover:bg-[rgba(0,212,255,0.12)] hover:text-accent">
                            {s.display_name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button onClick={useMyLocation} className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[rgba(0,212,255,0.08)] px-2 py-1 text-[11px] text-accent hover:bg-[rgba(0,212,255,0.18)]">
                    <LocateFixed size={12} /> Ma position
                  </button>
                  <button
                    onClick={() => setPickingOrigin((v) => !v)}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors ${pickingOrigin ? "border-gold bg-gold text-dark" : "border-[var(--border)] text-text/80 hover:border-gold hover:text-gold"}`}
                  >
                    <Crosshair size={12} /> {pickingOrigin ? "Cliquez sur la carte…" : "Choisir sur carte"}
                  </button>
                  {origin && (
                    <button onClick={() => { setOrigin(null); setOriginQuery(""); }} aria-label="Effacer le départ" className="inline-flex items-center rounded-md border border-[var(--border)] px-2 py-1 text-[11px] text-text/60 hover:text-red-400"><X size={12} /></button>
                  )}
                </div>
              </div>

              {/* DESTINATION */}
              <div className="rounded-lg border border-[var(--border)] bg-black/20 p-2.5">
                <div className="mb-1.5 flex items-center gap-2 text-[11px] uppercase tracking-wider text-gold">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-dark">B</span>
                  Destination
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={destQuery}
                    onChange={(e) => { setDestQuery(e.target.value); if (dest && e.target.value !== dest.label) setDest(null); }}
                    placeholder="Ville, site JOJ, adresse…"
                    className="w-full rounded-md border border-[var(--border)] bg-dark px-2 py-1.5 text-[12px] text-text focus:border-gold focus:outline-none"
                    aria-label="Adresse de destination"
                  />
                  {destSugs.length > 0 && (
                    <ul className="absolute left-0 right-0 top-full z-[700] mt-1 max-h-48 overflow-y-auto rounded-md border border-[var(--border)] bg-dark text-[12px] shadow-xl">
                      {destSugs.map((s, i) => (
                        <li key={i}>
                          <button onClick={() => pickSug(s, "d")} className="block w-full truncate px-2.5 py-1.5 text-left text-text/90 hover:bg-[rgba(245,166,35,0.12)] hover:text-gold">
                            {s.display_name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {destinations.slice(0, 6).map((d) => (
                    <button
                      key={d.key}
                      onClick={() => { const p = { lat: d.lat, lng: d.lng, label: d.name }; setDest(p); setDestQuery(p.label); setDestSugs([]); }}
                      className="rounded-md border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-text/70 hover:border-gold hover:text-gold"
                    >{d.name}</button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-text/60">Mode de déplacement</div>
                <div role="radiogroup" aria-label="Mode de déplacement" className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(MODE_META) as TravelMode[]).map((m) => {
                    const Icon = MODE_META[m].icon;
                    const active = travelMode === m;
                    return (
                      <button
                        key={m}
                        role="radio"
                        aria-checked={active}
                        onClick={() => {
                          setTravelMode(m);
                          if (origin && dest) void computeItinerary(m);
                        }}
                        className={`inline-flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-[10px] uppercase tracking-wider transition-all ${
                          active
                            ? "border-gold bg-[rgba(245,166,35,0.16)] text-gold"
                            : "border-[var(--border)] bg-black/20 text-text/70 hover:border-gold/50 hover:text-gold"
                        }`}
                      >
                        <Icon size={16} />
                        {MODE_META[m].label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={() => void computeItinerary()}
                disabled={!origin || !dest || itinLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gold px-3 py-2 text-[12px] font-bold uppercase tracking-wider text-dark transition-transform hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(245,166,35,0.4)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                <Navigation size={14} />
                {itinLoading ? "Calcul…" : "Calculer l'itinéraire"}
              </button>

              {itinError && (
                <div className="rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-300">{itinError}</div>
              )}

              {alts.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] uppercase tracking-wider text-text/60">
                      {alts.length} itinéraire{alts.length > 1 ? "s" : ""}
                    </div>
                    <div className="text-[10px] text-text/50">Le plus court mis en avant</div>
                  </div>
                  {alts.map((a, i) => {
                    const isFast = i === fastestIdx;
                    const isShort = i === shortestIdx;
                    const isSel = i === selectedAlt;
                    // Couleur "Google Maps style" : vert si plus court, orange si plus long
                    const durColor = isShort ? "text-emerald-400" : isFast ? "text-accent" : "text-orange-400";
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedAlt(i)}
                        className={`group relative w-full overflow-hidden rounded-xl border bg-white/[0.03] text-left transition-all ${
                          isSel
                            ? isShort
                              ? "border-emerald-400/70 shadow-[0_6px_24px_rgba(16,185,129,0.18)]"
                              : "border-accent/70 shadow-[0_6px_24px_rgba(0,212,255,0.15)]"
                            : "border-[var(--border)] hover:border-gold/50"
                        }`}
                      >
                        {/* bandeau gauche couleur (vert = short, accent = sélection) */}
                        <span className={`absolute inset-y-0 left-0 w-1 ${isShort ? "bg-emerald-400" : isSel ? "bg-accent" : "bg-text/10"}`} />
                        <div className="flex items-start gap-3 px-3 py-2.5 pl-4">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/40 text-text/80">
                            <Car size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate text-[13px] font-semibold text-text">via {a.via}</div>
                                {isShort ? (
                                  <div className="text-[11px] text-emerald-400/90">Itinéraire le plus court actuellement</div>
                                ) : isFast ? (
                                  <div className="text-[11px] text-accent/90">Le plus rapide</div>
                                ) : (
                                  <div className="text-[11px] text-text/55">Itinéraire alternatif</div>
                                )}
                              </div>
                              <div className="shrink-0 text-right">
                                <div className={`text-[15px] font-bold leading-tight ${durColor}`}>{fmtDuration(a.duration)}</div>
                                <div className="text-[11px] text-text/60">{(a.distance / 1000).toFixed(0)} km</div>
                              </div>
                            </div>
                            {/* Badges péage / mode */}
                            {a.tollPrice > 0 && (
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                                  <AlertTriangle size={10} /> Itinéraire avec péage
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
                                  <Coins size={10} /> {fmtFcfa(a.tollPrice)}
                                </span>
                                <span className="text-[10px] text-text/50">~{a.tollKm.toFixed(0)} km à péage</span>
                              </div>
                            )}
                            {a.noToll && (
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/40 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                                  <Coins size={10} /> Sans péage · routes nationales
                                </span>
                                <span className="text-[10px] text-text/50">0 FCFA de péage</span>
                              </div>
                            )}
                            {isShort && (
                              <div className="mt-1 inline-flex items-center gap-1 rounded bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                                <Ruler size={10} /> Plus court
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  {/* Étapes du trajet sélectionné */}
                  {alts[selectedAlt] && (
                    <div className="mt-2 rounded-lg border border-[var(--border)] bg-black/20 p-2.5">
                      <div className="mb-1.5 flex items-center justify-between text-[11px] uppercase tracking-wider text-gold">
                        <span>Étapes du trajet</span>
                        <span className="text-text/60">{alts[selectedAlt].steps.length} étapes</span>
                      </div>
                      <ol className="joj-scroll max-h-72 overflow-y-auto space-y-1 pr-1">
                        {alts[selectedAlt].steps.map((st, i) => (
                          <li key={i} className="flex items-start gap-2 rounded-md border border-[var(--border)] bg-black/20 px-2 py-1.5 text-[11px]">
                            <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gold/80 text-[9px] font-bold text-dark">{i + 1}</span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-text/90">{st.instruction}</div>
                              {st.distance > 0 && <div className="text-[10px] text-accent">{fmtDistance(st.distance)}</div>}
                            </div>
                            <ChevronRight size={12} className="mt-0.5 text-text/40" />
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => (guiding ? stopGuide() : startGuide())}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[11px] font-bold uppercase tracking-wider transition-all ${
                        guiding
                          ? "bg-red-500/20 text-red-300 border border-red-400/40 hover:bg-red-500/30"
                          : "bg-gold text-dark hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(245,166,35,0.4)]"
                      }`}
                    >
                      {guiding ? <><Pause size={12} /> Arrêter</> : <><Play size={12} /> Démarrer le guidage</>}
                    </button>
                    <button onClick={clearItinerary} className="inline-flex items-center justify-center gap-1 rounded-md border border-[var(--border)] px-2 py-2 text-[11px] text-text/70 hover:text-gold">
                      <X size={12} /> Effacer
                    </button>
                  </div>
                </div>
              )}

              {/* RÉGION DE DESTINATION + TOURISME */}
              {dest && (() => {
                const region = findRegion(dest.label, dest.lat, dest.lng);
                if (!region) return null;
                return (
                  <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)] bg-gradient-to-br from-[rgba(0,212,255,0.06)] to-[rgba(245,166,35,0.06)]">
                    <div className="border-b border-[var(--border)] px-3 py-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="group w-full text-left outline-none"
                            aria-label={`Découvrir ${region.region}`}
                          >
                            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-gold">
                              <Sparkles size={12} /> Découvrir
                              <span className="ml-auto rounded-full border border-gold/40 px-1.5 py-0.5 text-[9px] normal-case tracking-normal text-gold/80 group-hover:bg-gold/10">
                                Cliquer pour explorer
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-2">
                              <span className="text-[18px]">{region.emoji}</span>
                              <h3 className="font-display text-[16px] leading-tight tracking-wider text-text group-hover:text-gold">{region.region}</h3>
                            </div>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          align="start"
                          side="top"
                          className="w-[300px] border-[var(--border)] bg-[var(--bg-elev,#0c1626)]/95 backdrop-blur p-0 text-text"
                        >
                          <div className="border-b border-[var(--border)] px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[20px]">{region.emoji}</span>
                              <div className="min-w-0">
                                <div className="font-display text-[14px] leading-tight tracking-wider text-gold">{region.region}</div>
                                <div className="text-[10px] uppercase tracking-wider text-accent/80">Guide rapide</div>
                              </div>
                            </div>
                            <p className="mt-2 text-[11.5px] leading-relaxed text-text/80 line-clamp-4">{region.description}</p>
                          </div>
                          <div className="grid grid-cols-1 gap-1.5 px-3 py-2.5">
                            <a
                              href={wikipediaUrl(region.region)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group flex items-center gap-2 rounded-lg border border-[var(--border)] bg-black/25 px-2.5 py-2 text-left transition-all hover:-translate-y-0.5 hover:border-gold/70 hover:bg-black/40"
                            >
                              <BookOpen size={14} className="text-accent shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[12px] font-semibold text-text group-hover:text-gold">Wikipédia</div>
                                <div className="truncate text-[10px] text-text/60">Histoire, géographie, culture</div>
                              </div>
                              <ExternalLink size={11} className="shrink-0 text-text/40 group-hover:text-gold" />
                            </a>
                            <a
                              href={senegalTourismUrl(region.region)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group flex items-center gap-2 rounded-lg border border-[var(--border)] bg-black/25 px-2.5 py-2 text-left transition-all hover:-translate-y-0.5 hover:border-gold/70 hover:bg-black/40"
                            >
                              <Globe size={14} className="text-accent shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[12px] font-semibold text-text group-hover:text-gold">Visit Sénégal</div>
                                <div className="truncate text-[10px] text-text/60">Guide officiel — ASPT</div>
                              </div>
                              <ExternalLink size={11} className="shrink-0 text-text/40 group-hover:text-gold" />
                            </a>
                            <a
                              href={lonelyPlanetUrl(region.region)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group flex items-center gap-2 rounded-lg border border-[var(--border)] bg-black/25 px-2.5 py-2 text-left transition-all hover:-translate-y-0.5 hover:border-gold/70 hover:bg-black/40"
                            >
                              <Sparkles size={14} className="text-accent shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[12px] font-semibold text-text group-hover:text-gold">Lonely Planet</div>
                                <div className="truncate text-[10px] text-text/60">Conseils voyage internationaux</div>
                              </div>
                              <ExternalLink size={11} className="shrink-0 text-text/40 group-hover:text-gold" />
                            </a>
                            <a
                              href={tourismMapsUrl(region.region)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group flex items-center gap-2 rounded-lg border border-[var(--border)] bg-black/25 px-2.5 py-2 text-left transition-all hover:-translate-y-0.5 hover:border-gold/70 hover:bg-black/40"
                            >
                              <MapIcon size={14} className="text-accent shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[12px] font-semibold text-text group-hover:text-gold">Voir sur la carte</div>
                                <div className="truncate text-[10px] text-text/60">Google Maps</div>
                              </div>
                              <ExternalLink size={11} className="shrink-0 text-text/40 group-hover:text-gold" />
                            </a>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="px-3 py-2.5">
                      <p className="text-[11.5px] leading-relaxed text-text/80">{region.description}</p>
                      <div className="mt-2.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-accent">
                        <MapPin size={11} /> Zones touristiques
                      </div>
                      <div className="mt-1.5 grid grid-cols-1 gap-1.5">
                        {region.spots.map((sp) => (
                          <a
                            key={sp.name}
                            href={wikipediaUrl(sp.query)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Découvrir ${sp.name} sur Wikipédia`}
                            className="group flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-black/25 px-2.5 py-1.5 text-left transition-all hover:-translate-y-0.5 hover:border-gold/70 hover:bg-black/40"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-[12px] font-semibold text-text group-hover:text-gold">{sp.name}</div>
                              <div className="truncate text-[10px] text-text/60">{sp.description}</div>
                            </div>
                            <BookOpen size={12} className="shrink-0 text-text/40 group-hover:text-gold" />
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <p className="text-[10px] leading-relaxed text-text/50">
                Géocodage Nominatim · Itinéraires routiers OSRM (OpenStreetMap).
                <br />Tarifs péage indicatifs : ~{TOLL_RATE_FCFA_PER_KM} FCFA/km sur autoroutes (A1, Ila Touba).
              </p>
            </div>
          </Section>



          <Section title="Sites Olympiques" icon={<Trophy size={18} />}>
            {JOJ_SITES.map((s) => (
              <Row key={s.name} onClick={() => focusSite(s)}>
                <Trophy size={14} className="text-gold" />
                <span className="truncate">{s.name}</span>
              </Row>
            ))}
          </Section>

          <Section title="Routes" icon={<RouteIcon size={18} />}>
            {ROUTES_SENEGAL.map((r, i) => (
              <label key={r.name} className="row-label flex cursor-pointer items-center gap-2.5 rounded-lg p-2 text-[13px] transition-colors hover:bg-[rgba(245,166,35,0.1)] hover:text-gold">
                <input
                  type="checkbox"
                  className="cursor-pointer accent-[var(--gold)]"
                  checked={routeVis[i]}
                  onChange={(e) => setRouteVis((prev) => prev.map((v, j) => (j === i ? e.target.checked : v)))}
                />
                <span className="block h-[3px] w-[18px] rounded-[2px]" style={{ background: r.color }} />
                <span className="flex-1 truncate">{r.name}</span>
              </label>
            ))}
          </Section>

          <Section title="Villes" icon={<Building2 size={18} />}>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg p-2 text-[13px] transition-colors hover:bg-[rgba(245,166,35,0.1)] hover:text-gold">
              <input type="checkbox" className="accent-[var(--gold)]" checked={showCities} onChange={(e) => setShowCities(e.target.checked)} />
              <span>Afficher les villes</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg p-2 text-[13px] transition-colors hover:bg-[rgba(245,166,35,0.1)] hover:text-gold">
              <input type="checkbox" className="accent-[var(--gold)]" checked={showSites} onChange={(e) => setShowSites(e.target.checked)} />
              <span>Afficher les sites JOJ</span>
            </label>
          </Section>
        </aside>

        {/* MAP */}
        <div className="relative flex-1 bg-surface" role="application" aria-label="Carte interactive du Sénégal">
          <div ref={mapEl} className="absolute inset-0" />

          {/* INFO PANEL */}
          <aside
            className={`fixed md:absolute z-[1200] md:z-[500] overflow-y-auto md:overflow-visible border-0 md:border border-[var(--border)] bg-[var(--glass-strong)] backdrop-blur-xl transition-transform duration-500
              inset-0 md:inset-auto md:right-4 md:top-4 md:w-[340px] md:max-w-[calc(100%-2rem)] md:max-h-[calc(100vh-2rem)]
              rounded-none md:rounded-2xl p-4 md:p-5
              ${selected ? "translate-x-0 translate-y-0" : "translate-y-full md:translate-y-0 md:translate-x-[120%]"}`}
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(245,166,35,0.08)", paddingTop: "max(env(safe-area-inset-top), 1rem)", paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
            aria-live="polite"
            role="dialog"
            aria-modal="true"
            {...infoSwipe}
          >
            {selected && (
              <div className="md:hidden mx-auto mb-3 h-1.5 w-12 rounded-full bg-gold/50" aria-hidden />
            )}
            {selected && (
              <>
                <button
                  onClick={() => setSelected(null)}
                  aria-label="Fermer"
                  className="absolute right-3 inline-flex h-11 w-11 md:h-8 md:w-8 items-center justify-center rounded-full bg-black/40 md:bg-transparent text-text hover:text-gold active:scale-95 touch-manipulation"
                  style={{ top: "max(env(safe-area-inset-top), 0.75rem)" }}
                >
                  <X size={22} />
                </button>
                <div className="mb-2 inline-flex h-14 w-14 md:h-12 md:w-12 items-center justify-center rounded-full bg-gold/15 ring-2 ring-gold/40">
                  <Trophy size={28} className="text-gold" />
                </div>
                <h2 className="m-0 mb-1 font-display text-[26px] md:text-[24px] text-gold">{selected.name}</h2>
                <div className="mb-3.5 text-[13px] tracking-wider text-accent">{selected.sport}</div>
                <Stat label="Distance depuis Dakar" value={`${haversine(DAKAR, [selected.lat, selected.lng])} km`} />
                <Stat label="Coordonnées" value={`${selected.lat.toFixed(4)}, ${selected.lng.toFixed(4)}`} />
                <div className="mt-4 grid gap-2">
                  <button
                    onClick={() => {
                      setDest({ lat: selected.lat, lng: selected.lng, label: selected.name });
                      setDestQuery(selected.name);
                      setSidebarOpen(true);
                      if (!origin) useMyLocation();
                      else computeItinerary();
                      setSelected(null);
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3.5 md:py-2.5 text-center text-[13px] md:text-[12px] font-bold uppercase tracking-wider text-dark transition-transform hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(245,166,35,0.4)] active:scale-[0.98] touch-manipulation"
                  >
                    <Navigation size={16} /> Itinéraire <ArrowRight size={16} />
                  </button>
                  <button
                    onClick={() => setSelected(null)}
                    className="md:hidden inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-black/30 px-4 py-3 text-[13px] font-semibold uppercase tracking-wider text-text/80 active:scale-[0.98] touch-manipulation"
                  >
                    <X size={16} /> Fermer
                  </button>
                </div>
              </>
            )}
          </aside>

          {/* FAB */}
          <div className="absolute bottom-3 right-3 md:bottom-5 md:right-5 z-[500] flex flex-col gap-1.5 md:gap-2" role="toolbar" aria-label="Outils carte">
            <FabBtn label="Zoom avant" onClick={() => mapRef.current?.zoomIn()}><Plus size={18} /></FabBtn>
            <FabBtn label="Zoom arrière" onClick={() => mapRef.current?.zoomOut()}><Minus size={18} /></FabBtn>
            <FabBtn label="Recentrer sur le Sénégal" onClick={recenter}><LocateFixed size={18} /></FabBtn>
            <FabBtn label="Changer fond de carte" onClick={() => setDarkMode((v) => !v)}><Layers size={18} /></FabBtn>
            <FabBtn label="Outil de mesure" active={measuring} onClick={() => setMeasuring((v) => !v)}><Ruler size={18} /></FabBtn>
          </div>

          {/* LEGEND */}
          <div className="hidden md:block absolute bottom-5 left-5 z-[500] rounded-xl border border-[var(--border)] bg-[var(--glass-strong)] px-3.5 py-3 text-[12px] backdrop-blur-md">
            <h4 className="mb-2 font-display text-[14px] tracking-[0.15em] text-gold">Légende</h4>
            <LegendDot color="var(--gold)" label="Sites JOJ" />
            <LegendDot color="var(--accent)" label="Capitale" />
            <LegendDot color="#fff" label="Villes" />
            <LegendLine color="var(--gold)" label="Routes nationales" />
            <LegendLine color="var(--red)" label="Autoroutes" />
          </div>
        </div>
      </div>

      {/* GUIDE BANNER */}
      {guiding && alts[selectedAlt]?.steps[guideStep] && (() => {
        const steps = alts[selectedAlt].steps;
        const step = steps[guideStep];
        const nextS = steps[guideStep + 1];
        const isLast = guideStep >= steps.length - 1;
        const distLabel = userDist != null ? fmtDistance(userDist) : fmtDistance(step.distance);
        return (
          <div {...guideSwipe} className="pointer-events-auto fixed inset-x-2 bottom-2 z-[1100] mx-auto max-w-2xl rounded-2xl border border-gold/60 bg-[var(--glass-strong)] p-2.5 md:p-3 shadow-[0_18px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl md:inset-x-auto md:left-1/2 md:-translate-x-1/2 touch-pan-y">
            <div className="md:hidden mx-auto mb-1.5 h-1 w-10 rounded-full bg-gold/40" aria-hidden />
            <div className="flex items-center gap-2 md:gap-3">
              <div className="flex h-11 w-11 md:h-14 md:w-14 shrink-0 items-center justify-center rounded-xl bg-gold text-dark shadow-[0_0_18px_rgba(245,166,35,0.6)]">
                <ManeuverIcon type={step.type} modifier={step.modifier} size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-[0.2em] text-gold/80">
                  Étape {guideStep + 1} / {steps.length} · {distLabel}
                </div>
                <div className="truncate font-display text-[15px] md:text-[18px] leading-tight text-text">{step.instruction}</div>
                {nextS && (
                  <div className="mt-0.5 hidden sm:block truncate text-[11px] text-text/60">
                    <ChevronRight size={11} className="-mt-0.5 inline" /> Puis : {nextS.instruction}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => setVoiceOn((v) => !v)}
                  aria-label={voiceOn ? "Couper la voix" : "Activer la voix"}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-text/70 hover:text-gold"
                >
                  {voiceOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
                <button
                  onClick={prevStep}
                  disabled={guideStep === 0}
                  aria-label="Étape précédente"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-text/70 hover:text-gold disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={isLast ? stopGuide : nextStep}
                  aria-label={isLast ? "Terminer" : "Étape suivante"}
                  className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-gold px-3 text-[12px] font-bold uppercase tracking-wider text-dark hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(245,166,35,0.4)]"
                >
                  {isLast ? <><Flag size={14} /> Fin</> : <>Suivant <ChevronRight size={14} /></>}
                </button>
                <button
                  onClick={stopGuide}
                  aria-label="Quitter le guidage"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-400/40 text-red-300 hover:bg-red-500/15"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-black/40">
              <div
                className="h-full bg-gradient-to-r from-gold to-accent transition-all"
                style={{ width: `${((guideStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="mb-2.5 flex items-center gap-2 border-b border-[var(--border)] pb-1.5 font-display text-[18px] tracking-[0.1em] text-gold">
        {icon}
        <span>{title}</span>
      </h3>
      <div>{children}</div>
    </div>
  );
}

function Row({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer items-center gap-2.5 rounded-lg p-2 text-[13px] transition-all hover:translate-x-0.5 hover:bg-[rgba(245,166,35,0.1)] hover:text-gold"
    >{children}</div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-t border-[rgba(245,166,35,0.15)] py-2 text-[13px]">
      <span>{label}</span>
      <span className="font-bold text-gold">{value}</span>
    </div>
  );
}

function FabBtn({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={`flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] text-lg backdrop-blur-md transition-all hover:border-gold hover:text-gold hover:shadow-[0_0_18px_rgba(245,166,35,0.35)] ${active ? "bg-gold text-dark" : "bg-[var(--glass-strong)] text-text"}`}
    >{children}</button>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="my-1 flex items-center gap-2">
      <span className="h-3.5 w-3.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      {label}
    </div>
  );
}
function LegendLine({ color, label }: { color: string; label: string }) {
  return (
    <div className="my-1 flex items-center gap-2">
      <span className="h-[3px] w-5 rounded-[2px]" style={{ background: color }} />
      {label}
    </div>
  );
}
