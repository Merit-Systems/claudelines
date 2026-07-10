-- Remove the built-in demo catalog. Historical seed migrations remain intact
-- so existing databases and fresh migration runs converge on the same state.
DELETE FROM statuslines
WHERE slug IN (
  'agentcash-banner',
  'agentcash-mark',
  'catppuccin-mocha',
  'cost-hawk',
  'dracula-midnight',
  'matrix-rain',
  'merit-line',
  'mission-control',
  'nord-passage',
  'quiet-mono',
  'ship-it',
  'sunset-boulevard',
  'tokyo-drift'
);
