export type JojSite = {
  name: string;
  lat: number;
  lng: number;
  sport: string;
  icon: string;
};

export type Route = {
  name: string;
  color: string;
  coords: [number, number][];
};

export type Ville = {
  name: string;
  lat: number;
  lng: number;
  pop: string;
  type: "capitale" | "ville" | "site_joj";
};

export const DAKAR: [number, number] = [14.6937, -17.4441];
export const BOUNDS: [[number, number], [number, number]] = [
  [12.3, -17.6],
  [16.7, -11.4],
];

export const JOJ_SITES: JojSite[] = [
  { name: "Stade Léopold Sédar Senghor", lat: 14.7233, lng: -17.4572, sport: "Athlétisme, Cérémonie d'ouverture", icon: "🏟️" },
  { name: "Stade Iba Mar Diop", lat: 14.6892, lng: -17.4445, sport: "Boxe, Judo", icon: "🥊" },
  { name: "Piscine Olympique de Dakar", lat: 14.7150, lng: -17.4600, sport: "Natation, Water-polo", icon: "🏊" },
  { name: "Stade Demba Diop", lat: 14.7100, lng: -17.4500, sport: "Football", icon: "⚽" },
  { name: "Arène Nationale", lat: 14.7050, lng: -17.4780, sport: "Lutte sénégalaise, Wrestling", icon: "🤼" },
  { name: "Saly Portudal — Beach Arena", lat: 14.4566, lng: -17.0122, sport: "Beach Volley, Surf", icon: "🏐" },
  { name: "Lac Rose — Parcours Aventure", lat: 14.8345, lng: -17.2345, sport: "VTT, Triathlon", icon: "🚴" },
  { name: "Village Olympique", lat: 14.7500, lng: -17.4800, sport: "Hébergement athlètes", icon: "🏅" },
];

export const ROUTES_SENEGAL: Route[] = [
  { name: "RN1 — Dakar → Saint-Louis", color: "#F5A623", coords: [[14.6937,-17.4441],[14.8,-17.2],[15.1,-16.9],[15.5,-16.5],[15.8,-16.3],[16.02,-16.48]] },
  { name: "RN2 — Saint-Louis → Bakel", color: "#F5A623", coords: [[16.02,-16.48],[16.2,-15.8],[16.4,-15.2],[14.9,-12.8],[14.69,-12.47]] },
  { name: "RN3 — Dakar → Touba", color: "#00D4FF", coords: [[14.6937,-17.4441],[14.791,-16.926],[14.649,-16.231],[14.85,-15.88]] },
  { name: "RN4 — Dakar → Ziguinchor", color: "#1A7A4A", coords: [[14.6937,-17.4441],[14.139,-16.073],[13.78,-15.55],[12.9,-14.9],[12.55,-16.272]] },
  { name: "RN6 — Kaolack → Kédougou", color: "#E67E22", coords: [[14.139,-16.073],[13.77,-14.47],[13.5,-13.7],[12.56,-12.18]] },
  { name: "Autoroute A1 — Dakar → Saly", color: "#C0392B", coords: [[14.6937,-17.4441],[14.6,-17.2],[14.4566,-17.0122]] },
  { name: "RN7 — Tambacounda → Ziguinchor", color: "#2dd4bf", coords: [[13.77,-14.47],[13.3,-14.1],[12.9,-15.0],[12.55,-16.272]] },
];

export const VILLES: Ville[] = [
  { name: "Dakar", lat: 14.6937, lng: -17.4441, pop: "3.9M", type: "capitale" },
  { name: "Thiès", lat: 14.791, lng: -16.926, pop: "400K", type: "ville" },
  { name: "Kaolack", lat: 14.139, lng: -16.073, pop: "250K", type: "ville" },
  { name: "Saint-Louis", lat: 16.02, lng: -16.48, pop: "300K", type: "ville" },
  { name: "Ziguinchor", lat: 12.55, lng: -16.272, pop: "250K", type: "ville" },
  { name: "Tambacounda", lat: 13.77, lng: -13.67, pop: "120K", type: "ville" },
  { name: "Touba", lat: 14.85, lng: -15.88, pop: "800K", type: "ville" },
  { name: "Diourbel", lat: 14.649, lng: -16.231, pop: "90K", type: "ville" },
  { name: "Kolda", lat: 12.8985, lng: -14.9418, pop: "80K", type: "ville" },
  { name: "Kédougou", lat: 12.56, lng: -12.18, pop: "50K", type: "ville" },
  { name: "Saly", lat: 14.4566, lng: -17.0122, pop: "30K", type: "site_joj" },
  { name: "Lac Rose", lat: 14.8345, lng: -17.2345, pop: "—", type: "site_joj" },
];

export function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b[0] - a[0]);
  const dLng = toR(b[1] - a[1]);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(a[0])) * Math.cos(toR(b[0])) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(x)));
}
