import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import {
  isValidCatalogSlug,
  normalizeCatalogSlug,
} from "../shared/marketing-class-catalog";

const http = httpRouter();

auth.addHttpRoutes(http);

const catalogHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=60",
  "Content-Type": "application/json; charset=utf-8",
};

const marketingClasses = httpAction(async (ctx, request) => {
  const seasonSlug = normalizeCatalogSlug(
    new URL(request.url).searchParams.get("season") || undefined,
  );
  if (!seasonSlug || !isValidCatalogSlug(seasonSlug)) {
    return new Response(
      JSON.stringify({ error: "A valid season query parameter is required." }),
      { status: 400, headers: catalogHeaders },
    );
  }

  const catalog = await ctx.runQuery(internal.marketing.listClasses, {
    seasonSlug,
  });
  if (!catalog) {
    return new Response(JSON.stringify({ error: "Season not found." }), {
      status: 404,
      headers: catalogHeaders,
    });
  }

  return new Response(JSON.stringify(catalog), {
    status: 200,
    headers: catalogHeaders,
  });
});

http.route({
  path: "/marketing/classes",
  method: "GET",
  handler: marketingClasses,
});

export default http;
