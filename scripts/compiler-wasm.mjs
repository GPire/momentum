// Loaded only by build-portable.mjs, never bundled into the application.
const api = globalThis.__momentumBuildCompiler;
export default api;
export const { transform, build, formatMessages, analyzeMetafile, initialize, stop, version, context } = api;
