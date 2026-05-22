// Régions du Sénégal — description + zones touristiques
// Le lookup se fait par mot-clé (nom de ville/site) puis fallback proximité géo.

export type TouristSpot = {
  name: string;
  description: string;
  // recherche Google Maps (ouvre la fiche du lieu)
  query: string;
};

export type RegionInfo = {
  region: string;
  description: string;
  emoji: string;
  spots: TouristSpot[];
};

const REGIONS: Record<string, RegionInfo> = {
  dakar: {
    region: "Région de Dakar",
    emoji: "🌊",
    description:
      "Capitale dynamique du Sénégal, Dakar est une métropole vibrante perchée sur la presqu'île du Cap-Vert, entre océan et culture. Mêle marchés colorés, plages atlantiques et patrimoine colonial.",
    spots: [
      { name: "Île de Gorée", description: "Mémoire de la traite négrière — UNESCO", query: "Île de Gorée Sénégal" },
      { name: "Monument de la Renaissance", description: "Statue géante avec vue panoramique", query: "Monument de la Renaissance Africaine Dakar" },
      { name: "Marché Sandaga", description: "Marché emblématique du centre-ville", query: "Marché Sandaga Dakar" },
      { name: "Plage de N'Gor", description: "Surf, restos & ambiance balnéaire", query: "Plage N'Gor Dakar" },
      { name: "Musée des Civilisations Noires", description: "Art & histoire africaine", query: "Musée des Civilisations Noires Dakar" },
    ],
  },
  thies: {
    region: "Région de Thiès",
    emoji: "🚂",
    description:
      "Carrefour ferroviaire historique, Thiès rayonne par son artisanat (tapisseries renommées), ses falaises et la proximité du parc de Bandia.",
    spots: [
      { name: "Manufacture des Tapisseries", description: "Tapisseries d'art sénégalaises", query: "Manufacture Sénégalaise des Arts Décoratifs Thiès" },
      { name: "Réserve de Bandia", description: "Safari : girafes, rhinocéros, zèbres", query: "Réserve de Bandia Sénégal" },
      { name: "Falaise de Popenguine", description: "Réserve naturelle et plage sauvage", query: "Réserve de Popenguine" },
    ],
  },
  saly: {
    region: "Petite Côte (Saly / Mbour)",
    emoji: "🏖️",
    description:
      "Station balnéaire phare du Sénégal, la Petite Côte aligne plages de sable fin, hôtels, marchés de pêche animés et excursions vers le Siné-Saloum.",
    spots: [
      { name: "Plage de Saly", description: "Cocotiers et farniente", query: "Plage de Saly Sénégal" },
      { name: "Marché aux poissons de Mbour", description: "Pirogues colorées au coucher du soleil", query: "Marché aux poissons Mbour" },
      { name: "Réserve de Bandia", description: "Safari à 20 min", query: "Réserve de Bandia" },
      { name: "La Somone", description: "Lagune et pirogue", query: "Lagune de la Somone" },
    ],
  },
  saint_louis: {
    region: "Région de Saint-Louis",
    emoji: "🎷",
    description:
      "Ancienne capitale de l'AOF inscrite à l'UNESCO, Saint-Louis enchante avec son architecture coloniale, son festival de jazz et le delta du fleuve Sénégal.",
    spots: [
      { name: "Île de Saint-Louis", description: "Centre historique UNESCO", query: "Île de Saint-Louis Sénégal" },
      { name: "Parc National de la Langue de Barbarie", description: "Oiseaux migrateurs", query: "Parc Langue de Barbarie" },
      { name: "Parc National des Oiseaux du Djoudj", description: "3e réserve ornithologique mondiale", query: "Parc National Djoudj" },
      { name: "Pont Faidherbe", description: "Icône métallique du XIXe", query: "Pont Faidherbe Saint-Louis" },
    ],
  },
  ziguinchor: {
    region: "Casamance (Ziguinchor)",
    emoji: "🌴",
    description:
      "Région verdoyante du sud, la Casamance séduit par ses rizières, ses villages diolas, ses bolongs (bras de mer) et ses plages sauvages du Cap Skirring.",
    spots: [
      { name: "Cap Skirring", description: "Plages paradisiaques", query: "Cap Skirring Casamance" },
      { name: "Île de Carabane", description: "Village historique dans le delta", query: "Île de Carabane Casamance" },
      { name: "Ziguinchor centre", description: "Marché Saint-Maur", query: "Marché Saint-Maur Ziguinchor" },
      { name: "Bolongs en pirogue", description: "Excursions mangrove", query: "bolong Casamance pirogue" },
    ],
  },
  kaolack: {
    region: "Région de Kaolack",
    emoji: "🥜",
    description:
      "Capitale du bassin arachidier, Kaolack est un grand carrefour commercial réputé pour son marché central couvert (l'un des plus grands d'Afrique de l'Ouest) et la zaouïa de Médina Baye.",
    spots: [
      { name: "Marché central de Kaolack", description: "L'un des plus grands marchés couverts d'Afrique", query: "Marché central Kaolack" },
      { name: "Médina Baye", description: "Haut lieu de la Tijaniyya", query: "Médina Baye Kaolack" },
      { name: "Réserve de Fathala", description: "Safari & lions blancs", query: "Réserve de Fathala" },
    ],
  },
  touba: {
    region: "Région de Diourbel — Touba",
    emoji: "🕌",
    description:
      "Capitale spirituelle du mouridisme, Touba est dominée par sa Grande Mosquée et accueille chaque année le Magal, l'un des plus grands rassemblements religieux d'Afrique.",
    spots: [
      { name: "Grande Mosquée de Touba", description: "Symbole du mouridisme", query: "Grande Mosquée de Touba" },
      { name: "Bibliothèque Cheikhoul Khadim", description: "Manuscrits & héritage mouride", query: "Bibliothèque Cheikhoul Khadim Touba" },
      { name: "Mausolée de Cheikh Ahmadou Bamba", description: "Lieu de pèlerinage", query: "Mausolée Cheikh Ahmadou Bamba Touba" },
    ],
  },
  tambacounda: {
    region: "Région de Tambacounda",
    emoji: "🦁",
    description:
      "Porte du Sénégal oriental, Tambacounda donne accès au mythique Parc National du Niokolo-Koba, plus grande aire protégée du pays.",
    spots: [
      { name: "Parc National du Niokolo-Koba", description: "Lions, hippopotames, éléphants — UNESCO", query: "Parc National Niokolo-Koba" },
      { name: "Mako", description: "Village d'orpaillage", query: "Mako Sénégal" },
    ],
  },
  kedougou: {
    region: "Région de Kédougou",
    emoji: "⛰️",
    description:
      "Région la plus montagneuse du Sénégal, Kédougou abrite les contreforts du Fouta-Djalon, des cascades spectaculaires et le pays Bassari classé UNESCO.",
    spots: [
      { name: "Cascades de Dindéfélo", description: "Chute de 100 m dans la forêt", query: "Cascade de Dindéfélo" },
      { name: "Pays Bassari", description: "Cultures Bedik & Bassari — UNESCO", query: "Pays Bassari Kédougou" },
      { name: "Mont Assirik", description: "Faune sauvage du Niokolo", query: "Mont Assirik" },
    ],
  },
  lac_rose: {
    region: "Lac Rose (Retba)",
    emoji: "💗",
    description:
      "Célèbre pour ses eaux roses dues à une micro-algue, le Lac Rose était l'arrivée historique du Paris-Dakar. Récolte du sel, dunes et villages lébous à proximité.",
    spots: [
      { name: "Lac Retba", description: "Baignade & récolte de sel", query: "Lac Rose Retba Sénégal" },
      { name: "Dunes & océan", description: "Quad et 4x4", query: "Lac Rose dunes Sénégal" },
    ],
  },
  kolda: {
    region: "Région de Kolda",
    emoji: "🌳",
    description:
      "Au cœur de la Haute-Casamance, Kolda est une région agricole et forestière, riche en culture peule et en sites naturels préservés.",
    spots: [
      { name: "Forêt classée de Mahon", description: "Biodiversité tropicale", query: "Forêt de Mahon Kolda" },
      { name: "Marché de Kolda", description: "Artisanat peul", query: "Marché Kolda" },
    ],
  },
};

const KEYWORDS: Array<{ patterns: string[]; key: keyof typeof REGIONS }> = [
  { patterns: ["dakar", "gorée", "ngor", "yoff", "ouakam", "almadies", "plateau"], key: "dakar" },
  { patterns: ["thiès", "thies", "bandia", "popenguine"], key: "thies" },
  { patterns: ["saly", "mbour", "somone", "nianing"], key: "saly" },
  { patterns: ["saint-louis", "saint louis", "djoudj", "langue de barbarie"], key: "saint_louis" },
  { patterns: ["ziguinchor", "casamance", "cap skirring", "carabane", "oussouye"], key: "ziguinchor" },
  { patterns: ["kaolack", "fatick", "kaffrine"], key: "kaolack" },
  { patterns: ["touba", "diourbel", "mbacké"], key: "touba" },
  { patterns: ["tambacounda", "niokolo"], key: "tambacounda" },
  { patterns: ["kédougou", "kedougou", "dindéfélo", "bassari"], key: "kedougou" },
  { patterns: ["lac rose", "retba", "niaga"], key: "lac_rose" },
  { patterns: ["kolda", "vélingara", "sédhiou"], key: "kolda" },
];

export function findRegion(label: string, lat?: number, lng?: number): RegionInfo | null {
  const l = label.toLowerCase();
  for (const { patterns, key } of KEYWORDS) {
    if (patterns.some((p) => l.includes(p))) return REGIONS[key];
  }
  // fallback géographique grossier
  if (lat != null && lng != null) {
    if (lat < 13.2) return REGIONS.ziguinchor;
    if (lat > 15.5) return REGIONS.saint_louis;
    if (lng > -13.5) return REGIONS.kedougou;
    if (lng > -15.5) return REGIONS.tambacounda;
    if (lat > 14.5 && lng < -17) return REGIONS.dakar;
  }
  return null;
}

export function tourismMapsUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

// Page Wikipédia (francophone) — meilleure source descriptive pour découvrir une région ou un site
export function wikipediaUrl(query: string): string {
  return `https://fr.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}&go=Go`;
}

// Guide touristique officiel du Sénégal (Agence Sénégalaise de Promotion Touristique)
export function senegalTourismUrl(query: string): string {
  return `https://www.visitsenegal.com/?s=${encodeURIComponent(query)}`;
}

// Lonely Planet — guide international réputé
export function lonelyPlanetUrl(query: string): string {
  return `https://www.lonelyplanet.com/search?q=${encodeURIComponent(query + " Senegal")}`;
}
