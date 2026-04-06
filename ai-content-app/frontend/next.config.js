/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    domains: ['i.pravatar.cc', 'picsum.photos'],
  },
}

module.exports = nextConfig
