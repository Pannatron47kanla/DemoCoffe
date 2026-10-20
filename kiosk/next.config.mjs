import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

const API = 'http://127.0.0.1:3000';

// build → static export ให้ api เสิร์ฟ; dev → proxy ไป api เพื่อให้เป็น origin เดียวกัน
export default function config(phase) {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    return {
      trailingSlash: true,
      async rewrites() {
        return ['/menu', '/carts/:path*', '/orders/:path*', '/voice/:path*'].map((source) => ({ source, destination: `${API}${source}` }));
      },
    };
  }
  return { output: 'export', trailingSlash: true };
}
