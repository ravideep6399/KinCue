import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KinCue",
    short_name: "KinCue",
    description: "Verified family routines, timely cues, and clear handovers.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f5f1",
    theme_color: "#18372e",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
