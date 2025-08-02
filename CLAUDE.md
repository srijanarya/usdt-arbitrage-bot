
## Agent Orchestration for USDT Arbitrage Bot

### Available Agent Workflows

1. **Strategy Optimization** (Daily 6 AM)
   - Trigger: "Optimize today's P2P strategy"
   - Agents: researcher → quant-analyst → risk-manager
   - Output: Updated strategy parameters

2. **Risk Monitoring** (Event-based)
   - Trigger: "Check current risk exposure"
   - Agents: risk-manager → checker
   - Output: Risk report and recommendations

3. **Performance Improvement** (Manual)
   - Trigger: "Improve bot performance"
   - Agents: python-pro → backend → checker
   - Output: Optimized code and performance metrics

4. **Data Pipeline** (Every 4 hours)
   - Trigger: "Optimize data pipeline"
   - Agents: data-engineer → backend → python-pro
   - Output: Enhanced data flow and reduced latency

### Quick Agent Commands

- "Analyze P2P market conditions" - Activates researcher
- "Backtest current strategy" - Activates quant-analyst
- "Calculate position sizes" - Activates risk-manager
- "Optimize bot code" - Activates python-pro
- "Check system security" - Activates checker

### Integration Points

The agents integrate with existing bot components:
- `/src/services/arbitrage/` - Strategy optimization
- `/src/services/p2p/` - P2P listing management
- `/src/services/monitoring/` - Risk monitoring
- `/src/api/` - Performance improvements

