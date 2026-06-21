// Learn more: https://docs.expo.dev/guides/customizing-metro
// Use Sentry's Expo Metro config so source-map Debug IDs are registered at
// runtime (globalThis._sentryDebugIds) — without this, events don't carry the
// debug id and won't resolve against uploaded source maps.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

// @supabase/supabase-js does an optional dynamic `import("@opentelemetry/api")`
// for tracing. It's wrapped in a try/catch and unused on the client, but Metro
// still tries to resolve it at bundle time and fails. Resolve it to an empty
// module so bundling succeeds on every platform (web, iOS, Android).
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@opentelemetry/api') {
    return { type: 'empty' };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
