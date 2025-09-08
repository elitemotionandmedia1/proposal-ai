/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true }  // don't fail deploy on lint
};
export default nextConfig;
