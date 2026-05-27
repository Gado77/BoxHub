import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  org: "boxhub",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
