import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mailbox libraries use Node-only APIs and dynamic requires; keep them out of the bundle.
  serverExternalPackages: ['imapflow', 'mailparser', 'nodemailer'],
};

export default nextConfig;
