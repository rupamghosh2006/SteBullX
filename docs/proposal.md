# SteBullX proposal positioning

**Problem.** Stellar DeFi protocols can calculate whether individual positions are
liquidatable, but there is limited ecosystem-wide tooling for testing whether those
liquidations remain economically feasible during severe market and liquidity shocks.

**Solution.** SteBullX is an open-source economic stress-testing engine for Stellar
DeFi. It combines protocol positions, market liquidity and risk parameters to simulate
price shocks, liquidity contractions and liquidation cascades. The initial implementation
supports one Stellar lending protocol and XLM/USDC.

**Impact.** Protocols can use SteBullX to identify dangerous collateral parameters,
estimate liquidation capacity, quantify potential bad debt and test resilience before
adverse market events occur.

SteBullX complements Blend, Templar, Kinetic, Stellar/SDEX, Soroswap, price feeds, and
liquidators. Those systems answer or execute parts of “is this position liquidatable?”;
SteBullX evaluates “if many positions are liquidatable at once, can the Stellar market
realistically absorb the liquidation?”
