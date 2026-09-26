import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "التوفيقية مارت",
    short_name: "التوفيقية مارت",
    description: "قطع غيار السيارات لكل الموديلات",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#146BFD",
    dir: "rtl",
    lang: "ar-EG",
    icons: [
      { src: "/brand/icon-512.jpg", sizes: "512x512", type: "image/jpeg" },
    ],
  };
}
