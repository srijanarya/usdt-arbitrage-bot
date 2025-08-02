
import { createDynamicSizer } from './src/services/trading/DynamicPositionSizer';
import { volatilityCalculator } from './src/services/analysis/MarketVolatilityCalculator';

async function testDynamicSizing() {
  console.log('Testing Dynamic Position Sizing\n');
  
  const sizer = createDynamicSizer(10000); // $10,000 initial capital
  
  // Test scenarios
  const scenarios = [
    {
      name: 'High confidence, low volatility',
      opportunity: { expectedProfit: 3, confidence: 0.9 },
      conditions: { volatility: 20, liquidityDepth: 50000, spread: 0.1, recentDrawdown: 2 }
    },
    {
      name: 'Medium confidence, high volatility',
      opportunity: { expectedProfit: 2, confidence: 0.7 },
      conditions: { volatility: 70, liquidityDepth: 30000, spread: 0.3, recentDrawdown: 8 }
    },
    {
      name: 'Low confidence, extreme volatility',
      opportunity: { expectedProfit: 1.5, confidence: 0.5 },
      conditions: { volatility: 90, liquidityDepth: 20000, spread: 0.5, recentDrawdown: 15 }
    }
  ];
  
  for (const scenario of scenarios) {
    console.log(`\nScenario: ${scenario.name}`);
    console.log('Conditions:', scenario.conditions);
    
    const result = sizer.calculatePositionSize(scenario.opportunity, scenario.conditions);
    
    console.log('Result:');
    console.log(`  Position Size: $${result.size.toFixed(2)}`);
    console.log(`  Risk Amount: $${result.riskAmount.toFixed(2)}`);
    console.log(`  Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`  Reasoning: ${result.reasoning}`);
  }
  
  // Simulate some trades
  console.log('\n\nSimulating trades...');
  
  // Win
  sizer.updateStats({ profit: 150, win: true });
  console.log('Trade 1: WIN +$150');
  
  // Loss
  sizer.updateStats({ profit: -80, win: false });
  console.log('Trade 2: LOSS -$80');
  
  // Check new position sizing
  const afterTrades = sizer.calculatePositionSize(
    { expectedProfit: 2.5, confidence: 0.8 },
    { volatility: 40, liquidityDepth: 40000, spread: 0.2, recentDrawdown: 5 }
  );
  
  console.log('\nPosition size after trades:');
  console.log(`  Size: $${afterTrades.size.toFixed(2)}`);
  console.log(`  Kelly Fraction: ${(afterTrades.kellyFraction * 100).toFixed(2)}%`);
}

testDynamicSizing();
