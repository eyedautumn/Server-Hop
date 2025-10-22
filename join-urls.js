// roblox-joiner.js
'use strict';

/**
 * Returns the native protocol URL and the web fallback URL for joining a Roblox place+job.
 * @param {string|number} placeId
 * @param {string} jobId - sometimes called gameInstanceId or jobId
 * @returns {{protocolUrl: string, webFallback: string}}
 */
function getJoinUrls(placeId, jobId) {
  if (!placeId) throw new Error('placeId required');
  // Normalize to strings
  const p = String(placeId);
  const j = jobId ? String(jobId) : '';

  // Commonly used Roblox protocol (may vary across platforms).
  // Keeping format similar to widely used patterns:
  // roblox-player:1+launchmode:play+placeId:12345+gameInstanceId:jobguid
  const protocolUrl =
    'roblox-player:1+launchmode:play+placeId:' + encodeURIComponent(p) +
    (j ? ('+gameInstanceId:' + encodeURIComponent(j)) : '');

  // Web fallback: Roblox's /games/start endpoint with gameInstanceId query param
  const webFallback =
    'https://www.roblox.com/games/start?placeId=' + encodeURIComponent(p) +
    (j ? ('&gameInstanceId=' + encodeURIComponent(j)) : '');

  return { protocolUrl, webFallback };
}

module.exports = {
  getJoinUrls,
};