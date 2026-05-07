/** @type {import('next').NextConfig} */

// Build CSP connect-src from the actual Supabase URL so we don't rely
// on wildcard patterns that some mobile browsers handle inconsistently.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
let connectSrc = "'self'"
if (supabaseUrl) {
  try {
    const { protocol, host } = new URL(supabaseUrl)
    connectSrc += ` ${protocol}//${host} wss://${host}`
  } catch {
    // Fallback: allow all HTTPS/WSS if URL parsing fails
    connectSrc += ' https: wss:'
  }
} else {
  // No Supabase URL at build time — allow all secure connections
  connectSrc += ' https: wss:'
}

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=(), payment=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data:",
              `connect-src ${connectSrc}`,
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
