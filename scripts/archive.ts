import { captureEpisode } from "../src/services/archiver";

/**
 * Snapshot archiver: captures the resolved live snapshot as a HISTORICAL
 * replay episode and appends it to the tiered archive store.
 * Requires DATA_SOURCE=live and BLEND_API_URL; optionally layers the live
 * SDEX order book and constant-product pools via STELLAR_USDC_ISSUER.
 * Schedule it (cron) so consecutive captures form replayable episodes.
 */
async function main() {
  const episode = await captureEpisode();
  console.log(`Captured archive ${episode.id} @ ledger ${episode.endLedger}`);
  console.log(`  price: ${episode.marketPath.at(-1)?.xlmUsd} USDC/XLM`);
  console.log(`  positions: ${episode.startSnapshot.positions.length}`);
  console.log(`  observed: volume=${episode.observed.liquidationVolumeUsd} badDebt=${episode.observed.badDebtUsd} affected=${episode.observed.affectedPositions}`);
  console.log(`  go to /replay to replay this episode and measure model error.`);
}

main().catch((cause) => {
  console.error(`Archive failed: ${cause instanceof Error ? cause.message : String(cause)}`);
  process.exit(1);
});