import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { JojMap } from "@/components/JojMap";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Index,
  head: () => ({
    meta: [
      { title: "UADJOJ Sénégal 2026 — Carte officielle des sites olympiques" },
      { name: "description", content: "Carte interactive des sites des Jeux Olympiques de la Jeunesse Sénégal 2026 : stades, routes nationales et villes." },
      { property: "og:title", content: "JOJ Sénégal 2026 — Carte officielle" },
      { property: "og:description", content: "Explorez les sites olympiques, routes et villes du Sénégal pour les JOJ 2026." },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;700&display=swap" },
    ],
  }),
});

function Index() {
  return (
    <ClientOnly fallback={<div className="flex h-screen items-center justify-center bg-[#0A0F1E] text-[#F5A623] font-[Bebas_Neue]">Chargement de la carte…</div>}>
      <JojMap />
    </ClientOnly>
  );
}
