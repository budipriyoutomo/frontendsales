import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Build standalone: `next build` menghasilkan server minimal beserta
   * hanya dependency yang benar-benar dipakai, jadi image Docker tidak perlu
   * membawa seluruh `node_modules` (TODO 9.1).
   */
  output: "standalone",

  /**
   * `API_BASE_URL` sengaja TIDAK diberi prefix `NEXT_PUBLIC_` (TODO 9.4).
   * Variabel tanpa prefix itu hanya hidup di server, jadi alamat backend
   * tidak pernah ikut ke bundel browser — sejalan dengan keputusan BFF (0.2):
   * browser hanya bicara ke origin sendiri.
   */
};

export default nextConfig;
