/** @type {import('next').NextConfig} */
const nextConfig = {
  // Supabase Storage image domains (adicionar quando necessário)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default nextConfig
