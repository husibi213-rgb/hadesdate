import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";

/** 관리자·API 는 색인하지 않는다. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
