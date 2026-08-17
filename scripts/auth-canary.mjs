#!/usr/bin/env node

const projectRef = process.env.SUPABASE_PROJECT_REF || "ywsenspsfyrdhgyxgcrv";
const supabaseURL = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const callbackURL = "throughline://auth/callback";

if (!supabaseURL || !anonKey || !accessToken) {
  console.error("SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_ACCESS_TOKEN are required");
  process.exit(1);
}

const configResponse = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
  { headers: { Authorization: `Bearer ${accessToken}` } },
);
const config = await configResponse.json();

const settingsResponse = await fetch(new URL("/auth/v1/settings", supabaseURL), {
  headers: { apikey: anonKey },
});
const settings = await settingsResponse.json();

const authorizeURL = new URL("/auth/v1/authorize", supabaseURL);
authorizeURL.searchParams.set("provider", "google");
authorizeURL.searchParams.set("redirect_to", callbackURL);
const authorizeResponse = await fetch(authorizeURL, {
  redirect: "manual",
  headers: { apikey: anonKey },
});
const authorizeLocation = authorizeResponse.headers.get("location") || "";
const authorizeHost = authorizeLocation ? new URL(authorizeLocation).host : "";

const siteURL = config.site_url || "";
const checks = {
  management_api_ok: configResponse.ok,
  public_settings_ok: settingsResponse.ok,
  site_url_is_https: siteURL.startsWith("https://"),
  site_url_is_not_localhost: !/localhost|127\.0\.0\.1/i.test(siteURL),
  mobile_callback_allowed: (config.uri_allow_list || "")
    .split(",")
    .map((value) => value.trim())
    .includes(callbackURL),
  google_enabled: settings?.external?.google === true,
  apple_enabled: settings?.external?.apple === true,
  google_authorize_redirect_ok: authorizeResponse.status >= 300
    && authorizeResponse.status < 400
    && authorizeHost.endsWith("google.com"),
};
const passed = Object.values(checks).every(Boolean);

console.log(JSON.stringify({
  passed,
  checks,
  site_url: siteURL,
  mobile_callback: callbackURL,
  google_redirect_host: authorizeHost,
}, null, 2));

if (!passed) process.exitCode = 1;
