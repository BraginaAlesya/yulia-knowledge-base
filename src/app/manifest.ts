import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Взмах к себе",
    short_name: "Взмах",
    description: "Личный кабинет пространства «Дом телесной устойчивости».",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf7f2",
    theme_color: "#7a4c40",
    lang: "ru",
    icons: [
      { src: "/app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
