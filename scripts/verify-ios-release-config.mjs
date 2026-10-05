#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import path from 'node:path';

// Verify the packaged values, not merely the checkout's ignored configuration.
const [appPath, expectedBuild] = process.argv.slice(2);
function fail(message) { console.error(`release-config: ${message}`); process.exit(1); }
if (!appPath || !expectedBuild) fail('usage: node scripts/verify-ios-release-config.mjs <Throughline.app> <build>');
let info;
try { info = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', path.join(appPath, 'Info.plist')], {encoding:'utf8', stdio:['ignore','pipe','ignore']})); }
catch { fail('unable to read packaged Info.plist'); }
if (info.CFBundleIdentifier !== 'app.throughline.ios' || info.CFBundleVersion !== expectedBuild) fail('unexpected app or build');
if (info.ThroughlineSupabaseURL !== 'https://ywsenspsfyrdhgyxgcrv.supabase.co') fail('unexpected authentication endpoint');
if (info.ThroughlineBackendAPIToken) fail('service API token must not be packaged');
const key = info.ThroughlineSupabaseAnonKey;
if (typeof key !== 'string' || !key.trim() || key.includes('$(')) fail('public sign-in client key is missing');
let claims;
try { claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()); }
catch { fail('expected existing anon client configuration'); }
if (claims.role !== 'anon' || claims.ref !== 'ywsenspsfyrdhgyxgcrv') fail('client key has unexpected scope or project');
console.log(JSON.stringify({check:'release-config',version:info.CFBundleShortVersionString,build:info.CFBundleVersion,anonClientKeyConfigured:true,serviceApiTokenAbsent:true}));
