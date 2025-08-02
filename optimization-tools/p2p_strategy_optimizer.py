"""
USDT P2P Trading Strategy Optimizer
Quantitative analysis tool for optimizing P2P arbitrage trading parameters
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from typing import Dict, List, Tuple, Optional
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

class P2PStrategyOptimizer:
    """
    Comprehensive P2P trading strategy optimizer with backtesting capabilities
    """
    
    def __init__(self):
        self.fees = {
            'zebpay': {
                'trading_fee': 0.0025,  # 0.25%
                'withdrawal_fee': 8,    # 8 USDT
                'deposit_fee': 0        # Free INR deposits
            },
            'kucoin': {
                'trading_fee': 0.001,   # 0.1%
                'withdrawal_fee': 1.5,  # 1.5 USDT
                'deposit_fee': 0
            },
            'binance_p2p': {
                'trading_fee': 0,       # No P2P fees
                'express_fee': 0,       # No express fees
                'withdrawal_fee': 0     # No internal withdrawal
            },
            'taxes': {
                'tds': 0.01,           # 1% TDS on sale
                'gst': 0,              # No GST on P2P
                'income_tax': 0.30     # 30% on profits (for high income)
            }
        }
        
        self.current_config = {
            'min_profit_threshold': 100,   # INR
            'max_trade_amount': 10000,     # INR
            'min_trade_amount': 1000,      # INR
            'position_size_pct': 0.10,     # 10% of available capital
            'stop_loss_pct': 0.02,         # 2%
            'take_profit_pct': 0.03        # 3%
        }
        
    def generate_synthetic_data(self, days: int = 365) -> pd.DataFrame:
        """
        Generate synthetic market data for backtesting
        Based on actual USDT/INR market patterns
        """
        dates = pd.date_range(start=datetime.now() - timedelta(days=days), 
                             end=datetime.now(), freq='5min')
        
        # Base prices with realistic volatility
        base_price = 83.50  # Base USDT/INR price
        
        # Generate price movements with volatility clustering
        returns = np.random.normal(0, 0.005, len(dates))  # 0.5% volatility
        
        # Add volatility clustering (GARCH-like)
        for i in range(1, len(returns)):
            if abs(returns[i-1]) > 0.01:  # High volatility period
                returns[i] *= 1.5
                
        prices = base_price * np.exp(np.cumsum(returns))
        
        # P2P spreads (express vs regular)
        p2p_express_spread = np.random.normal(2.5, 0.5, len(dates))  # Express spread
        p2p_regular_spread = np.random.normal(5.0, 1.0, len(dates))  # Regular spread
        
        # Volume patterns (higher during business hours)
        hours = dates.hour
        volume_multiplier = np.where((hours >= 9) & (hours <= 18), 1.5, 0.7)
        base_volume = np.random.lognormal(5, 1, len(dates))
        volume = base_volume * volume_multiplier
        
        data = pd.DataFrame({
            'timestamp': dates,
            'zebpay_price': prices + np.random.normal(0, 0.2, len(dates)),
            'kucoin_price': prices + np.random.normal(0, 0.15, len(dates)),
            'p2p_express_price': prices + p2p_express_spread,
            'p2p_regular_price': prices + p2p_regular_spread,
            'volume': volume,
            'hour': hours
        })
        
        return data
    
    def calculate_transaction_costs(self, amount_usdt: float, buy_price: float, 
                                  exchange: str = 'zebpay') -> Dict[str, float]:
        """
        Calculate all transaction costs for a trade
        """
        fees = self.fees[exchange]
        
        # Investment costs
        investment = buy_price * amount_usdt
        trading_fee = investment * fees['trading_fee']
        total_investment = investment + trading_fee
        
        # Withdrawal costs
        withdrawal_fee_inr = fees['withdrawal_fee'] * buy_price
        
        # Tax costs (on revenue)
        return {
            'investment': total_investment,
            'trading_fee': trading_fee,
            'withdrawal_fee': withdrawal_fee_inr,
            'total_costs': total_investment + withdrawal_fee_inr
        }
    
    def calculate_profit(self, buy_price: float, sell_price: float, 
                        amount_usdt: float, exchange: str = 'zebpay') -> Dict[str, float]:
        """
        Calculate detailed profit analysis
        """
        costs = self.calculate_transaction_costs(amount_usdt, buy_price, exchange)
        
        # Revenue calculation
        gross_revenue = sell_price * amount_usdt
        tds = gross_revenue * self.fees['taxes']['tds']
        net_revenue = gross_revenue - tds
        
        # Profit calculation
        net_profit = net_revenue - costs['total_costs']
        roi = (net_profit / costs['investment']) * 100
        
        return {
            'gross_revenue': gross_revenue,
            'net_revenue': net_revenue,
            'net_profit': net_profit,
            'roi': roi,
            'total_costs': costs['total_costs'],
            'profitable': net_profit > 0
        }
    
    def backtest_strategy(self, data: pd.DataFrame, config: Dict) -> Dict:
        """
        Backtest the trading strategy with given configuration
        """
        trades = []
        capital = 100000  # Starting capital in INR
        max_position_size = capital * config['position_size_pct']
        
        for i in range(len(data)):
            row = data.iloc[i]
            
            # Express P2P opportunity
            buy_price = row['zebpay_price']
            sell_price = row['p2p_express_price']
            
            # Calculate position size (ensure minimum trade amount)
            trade_value = min(max_position_size, config['max_trade_amount'])
            trade_value = max(trade_value, config['min_trade_amount'])
            amount_usdt = trade_value / buy_price
            
            # Calculate profit
            profit_analysis = self.calculate_profit(buy_price, sell_price, amount_usdt)
            
            # Check if trade meets criteria
            if (profit_analysis['net_profit'] >= config['min_profit_threshold'] and
                profit_analysis['profitable']):
                
                trade = {
                    'timestamp': row['timestamp'],
                    'buy_price': buy_price,
                    'sell_price': sell_price,
                    'amount_usdt': amount_usdt,
                    'investment': trade_value,
                    'profit': profit_analysis['net_profit'],
                    'roi': profit_analysis['roi'],
                    'hour': row['hour']
                }
                trades.append(trade)
                
                # Update capital
                capital += profit_analysis['net_profit']
                max_position_size = capital * config['position_size_pct']
        
        return self.analyze_backtest_results(trades, capital)
    
    def analyze_backtest_results(self, trades: List[Dict], final_capital: float) -> Dict:
        """
        Analyze backtest results and calculate performance metrics
        """
        if not trades:
            return {'error': 'No profitable trades found'}
        
        df_trades = pd.DataFrame(trades)
        
        # Basic metrics
        total_trades = len(trades)
        total_profit = df_trades['profit'].sum()
        avg_profit = df_trades['profit'].mean()
        win_rate = (df_trades['profit'] > 0).mean() * 100
        
        # Risk metrics
        returns = df_trades['roi'].values / 100
        sharpe_ratio = np.mean(returns) / np.std(returns) * np.sqrt(252) if np.std(returns) > 0 else 0
        max_drawdown = self.calculate_max_drawdown(df_trades['profit'].cumsum())
        
        # Time-based analysis
        hourly_performance = df_trades.groupby('hour')['profit'].agg(['mean', 'count']).round(2)
        
        return {
            'total_trades': total_trades,
            'total_profit': total_profit,
            'avg_profit_per_trade': avg_profit,
            'win_rate': win_rate,
            'sharpe_ratio': sharpe_ratio,
            'max_drawdown': max_drawdown,
            'final_capital': final_capital,
            'total_return': ((final_capital - 100000) / 100000) * 100,
            'hourly_performance': hourly_performance,
            'trades_df': df_trades
        }
    
    def calculate_max_drawdown(self, cumulative_returns: pd.Series) -> float:
        """
        Calculate maximum drawdown
        """
        peak = cumulative_returns.expanding().max()
        drawdown = (cumulative_returns - peak) / peak
        return drawdown.min() * 100
    
    def optimize_profit_threshold(self, data: pd.DataFrame) -> Tuple[float, Dict]:
        """
        Find optimal profit threshold using backtesting
        """
        thresholds = np.arange(50, 500, 25)  # Test from 50 to 500 INR
        results = []
        
        for threshold in thresholds:
            config = self.current_config.copy()
            config['min_profit_threshold'] = threshold
            
            backtest_result = self.backtest_strategy(data, config)
            if 'error' not in backtest_result:
                results.append({
                    'threshold': threshold,
                    'total_profit': backtest_result['total_profit'],
                    'total_trades': backtest_result['total_trades'],
                    'sharpe_ratio': backtest_result['sharpe_ratio'],
                    'win_rate': backtest_result['win_rate']
                })
        
        if not results:
            return 100, {}
        
        df_results = pd.DataFrame(results)
        
        # Optimize for risk-adjusted returns (Sharpe ratio with trade frequency consideration)
        df_results['score'] = (df_results['sharpe_ratio'] * 0.4 + 
                              df_results['total_profit'] / df_results['total_profit'].max() * 0.3 +
                              df_results['win_rate'] / 100 * 0.3)
        
        optimal_threshold = df_results.loc[df_results['score'].idxmax(), 'threshold']
        
        return optimal_threshold, df_results
    
    def optimize_position_sizing(self, data: pd.DataFrame) -> Tuple[float, Dict]:
        """
        Optimize position sizing using Kelly Criterion and risk management
        """
        position_sizes = np.arange(0.05, 0.30, 0.025)  # 5% to 30% of capital
        results = []
        
        for pos_size in position_sizes:
            config = self.current_config.copy()
            config['position_size_pct'] = pos_size
            
            backtest_result = self.backtest_strategy(data, config)
            if 'error' not in backtest_result:
                results.append({
                    'position_size': pos_size,
                    'total_return': backtest_result['total_return'],
                    'sharpe_ratio': backtest_result['sharpe_ratio'],
                    'max_drawdown': backtest_result['max_drawdown'],
                    'total_trades': backtest_result['total_trades']
                })
        
        if not results:
            return 0.10, {}
        
        df_results = pd.DataFrame(results)
        
        # Optimize for risk-adjusted returns with drawdown consideration
        df_results['risk_adjusted_return'] = (df_results['total_return'] / 
                                            (abs(df_results['max_drawdown']) + 1))
        
        optimal_size = df_results.loc[df_results['risk_adjusted_return'].idxmax(), 'position_size']
        
        return optimal_size, df_results
    
    def calculate_optimal_listing_prices(self, data: pd.DataFrame) -> Dict[str, float]:
        """
        Calculate optimal P2P listing prices for competitive advantage
        """
        # Analyze market spreads and competition
        p2p_express_mean = data['p2p_express_price'].mean()
        p2p_regular_mean = data['p2p_regular_price'].mean()
        zebpay_mean = data['zebpay_price'].mean()
        
        # Calculate percentiles for competitive pricing
        express_75th = data['p2p_express_price'].quantile(0.75)
        express_25th = data['p2p_express_price'].quantile(0.25)
        
        regular_75th = data['p2p_regular_price'].quantile(0.75)
        regular_25th = data['p2p_regular_price'].quantile(0.25)
        
        # Optimal pricing strategy
        optimal_express_sell = express_75th - 0.2  # Slightly below 75th percentile
        optimal_regular_sell = regular_75th - 0.5  # More competitive for regular
        
        optimal_express_buy = express_25th + 0.2   # Slightly above 25th percentile
        optimal_regular_buy = regular_25th + 0.5   # More competitive for regular
        
        return {
            'express_sell_price': optimal_express_sell,
            'regular_sell_price': optimal_regular_sell,
            'express_buy_price': optimal_express_buy,
            'regular_buy_price': optimal_regular_buy,
            'market_analysis': {
                'express_spread': express_75th - express_25th,
                'regular_spread': regular_75th - regular_25th,
                'avg_premium_over_spot': p2p_express_mean - zebpay_mean
            }
        }
    
    def create_adaptive_strategy(self, data: pd.DataFrame) -> Dict:
        """
        Create adaptive strategy based on market volatility
        """
        data['returns'] = data['zebpay_price'].pct_change()
        data['volatility'] = data['returns'].rolling(window=24).std()  # 2-hour volatility
        
        # Define volatility regimes
        vol_low = data['volatility'].quantile(0.33)
        vol_high = data['volatility'].quantile(0.67)
        
        strategies = {
            'low_volatility': {
                'min_profit_threshold': 75,    # Lower threshold in stable markets
                'position_size_pct': 0.15,     # Higher position size
                'take_profit_pct': 0.025,      # Conservative take profit
                'stop_loss_pct': 0.015         # Tighter stop loss
            },
            'medium_volatility': {
                'min_profit_threshold': 100,   # Standard threshold
                'position_size_pct': 0.10,     # Standard position size
                'take_profit_pct': 0.03,       # Standard take profit
                'stop_loss_pct': 0.02          # Standard stop loss
            },
            'high_volatility': {
                'min_profit_threshold': 150,   # Higher threshold for volatile markets
                'position_size_pct': 0.08,     # Smaller position size
                'take_profit_pct': 0.04,       # Higher take profit
                'stop_loss_pct': 0.025         # Wider stop loss
            }
        }
        
        # Backtest each strategy
        strategy_results = {}
        for vol_regime, config in strategies.items():
            config_full = self.current_config.copy()
            config_full.update(config)
            
            result = self.backtest_strategy(data, config_full)
            if 'error' not in result:
                strategy_results[vol_regime] = result
        
        return {
            'strategies': strategies,
            'backtest_results': strategy_results,
            'volatility_thresholds': {
                'low': vol_low,
                'high': vol_high
            }
        }
    
    def generate_performance_report(self, data: pd.DataFrame) -> Dict:
        """
        Generate comprehensive performance metrics and KPIs
        """
        # Optimize all parameters
        optimal_threshold, threshold_results = self.optimize_profit_threshold(data)
        optimal_position_size, position_results = self.optimize_position_sizing(data)
        optimal_pricing = self.calculate_optimal_listing_prices(data)
        adaptive_strategy = self.create_adaptive_strategy(data)
        
        # Create optimized config
        optimized_config = self.current_config.copy()
        optimized_config['min_profit_threshold'] = optimal_threshold
        optimized_config['position_size_pct'] = optimal_position_size
        
        # Compare current vs optimized strategy
        current_result = self.backtest_strategy(data, self.current_config)
        optimized_result = self.backtest_strategy(data, optimized_config)
        
        return {
            'optimization_results': {
                'optimal_profit_threshold': optimal_threshold,
                'optimal_position_size': optimal_position_size,
                'threshold_analysis': threshold_results,
                'position_size_analysis': position_results
            },
            'pricing_strategy': optimal_pricing,
            'adaptive_strategy': adaptive_strategy,
            'performance_comparison': {
                'current_strategy': current_result,
                'optimized_strategy': optimized_result
            },
            'key_improvements': {
                'profit_increase': (optimized_result.get('total_profit', 0) - 
                                  current_result.get('total_profit', 0)),
                'sharpe_improvement': (optimized_result.get('sharpe_ratio', 0) - 
                                     current_result.get('sharpe_ratio', 0)),
                'trade_efficiency': (optimized_result.get('avg_profit_per_trade', 0) / 
                                   current_result.get('avg_profit_per_trade', 1))
            }
        }
    
    def plot_optimization_results(self, report: Dict):
        """
        Create visualization plots for optimization results
        """
        fig, axes = plt.subplots(2, 2, figsize=(15, 12))
        
        # Profit threshold optimization
        if 'threshold_analysis' in report['optimization_results']:
            threshold_df = report['optimization_results']['threshold_analysis']
            axes[0, 0].plot(threshold_df['threshold'], threshold_df['total_profit'], 'b-', linewidth=2)
            axes[0, 0].set_title('Profit Threshold Optimization')
            axes[0, 0].set_xlabel('Minimum Profit Threshold (INR)')
            axes[0, 0].set_ylabel('Total Profit (INR)')
            axes[0, 0].grid(True, alpha=0.3)
        
        # Position size optimization
        if 'position_size_analysis' in report['optimization_results']:
            position_df = report['optimization_results']['position_size_analysis']
            axes[0, 1].plot(position_df['position_size'], position_df['total_return'], 'g-', linewidth=2)
            axes[0, 1].plot(position_df['position_size'], position_df['max_drawdown'], 'r--', linewidth=2)
            axes[0, 1].set_title('Position Size Optimization')
            axes[0, 1].set_xlabel('Position Size (% of Capital)')
            axes[0, 1].set_ylabel('Return/Drawdown (%)')
            axes[0, 1].legend(['Total Return', 'Max Drawdown'])
            axes[0, 1].grid(True, alpha=0.3)
        
        # Strategy comparison
        strategies = ['Current', 'Optimized']
        profits = [report['performance_comparison']['current_strategy'].get('total_profit', 0),
                  report['performance_comparison']['optimized_strategy'].get('total_profit', 0)]
        sharpe = [report['performance_comparison']['current_strategy'].get('sharpe_ratio', 0),
                 report['performance_comparison']['optimized_strategy'].get('sharpe_ratio', 0)]
        
        x = np.arange(len(strategies))
        width = 0.35
        
        axes[1, 0].bar(x - width/2, profits, width, label='Total Profit (INR)', color='skyblue')
        axes[1, 0].set_title('Strategy Performance Comparison')
        axes[1, 0].set_ylabel('Total Profit (INR)')
        axes[1, 0].set_xticks(x)
        axes[1, 0].set_xticklabels(strategies)
        
        ax2 = axes[1, 0].twinx()
        ax2.bar(x + width/2, sharpe, width, label='Sharpe Ratio', color='lightcoral')
        ax2.set_ylabel('Sharpe Ratio')
        
        # Risk-return profile
        if 'current_strategy' in report['performance_comparison']:
            current = report['performance_comparison']['current_strategy']
            optimized = report['performance_comparison']['optimized_strategy']
            
            axes[1, 1].scatter(abs(current.get('max_drawdown', 0)), current.get('total_return', 0), 
                             s=100, color='red', label='Current Strategy', alpha=0.7)
            axes[1, 1].scatter(abs(optimized.get('max_drawdown', 0)), optimized.get('total_return', 0), 
                             s=100, color='green', label='Optimized Strategy', alpha=0.7)
            axes[1, 1].set_title('Risk-Return Profile')
            axes[1, 1].set_xlabel('Max Drawdown (%)')
            axes[1, 1].set_ylabel('Total Return (%)')
            axes[1, 1].legend()
            axes[1, 1].grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.savefig('/Users/srijan/Desktop/my-automation-project/strategy_optimization_results.png', 
                    dpi=300, bbox_inches='tight')
        plt.show()

# Usage example and optimization runner
def main():
    print("🚀 USDT P2P Strategy Optimization Analysis")
    print("=" * 50)
    
    optimizer = P2PStrategyOptimizer()
    
    # Generate synthetic market data
    print("📊 Generating synthetic market data...")
    data = optimizer.generate_synthetic_data(days=90)  # 3 months of data
    
    # Run comprehensive optimization
    print("🔧 Running strategy optimization...")
    report = optimizer.generate_performance_report(data)
    
    # Display results
    print("\n📈 OPTIMIZATION RESULTS")
    print("=" * 30)
    
    opt_results = report['optimization_results']
    print(f"Optimal Profit Threshold: ₹{opt_results['optimal_profit_threshold']:.0f}")
    print(f"Optimal Position Size: {opt_results['optimal_position_size']:.1%}")
    
    current = report['performance_comparison']['current_strategy']
    optimized = report['performance_comparison']['optimized_strategy']
    
    print(f"\nCURRENT STRATEGY:")
    print(f"  Total Profit: ₹{current.get('total_profit', 0):,.0f}")
    print(f"  Sharpe Ratio: {current.get('sharpe_ratio', 0):.2f}")
    print(f"  Win Rate: {current.get('win_rate', 0):.1f}%")
    
    print(f"\nOPTIMIZED STRATEGY:")
    print(f"  Total Profit: ₹{optimized.get('total_profit', 0):,.0f}")
    print(f"  Sharpe Ratio: {optimized.get('sharpe_ratio', 0):.2f}")
    print(f"  Win Rate: {optimized.get('win_rate', 0):.1f}%")
    
    improvements = report['key_improvements']
    print(f"\nIMPROVEMENTS:")
    print(f"  Profit Increase: ₹{improvements['profit_increase']:,.0f}")
    print(f"  Sharpe Improvement: +{improvements['sharpe_improvement']:.2f}")
    print(f"  Trade Efficiency: {improvements['trade_efficiency']:.2f}x")
    
    # Pricing recommendations
    pricing = report['pricing_strategy']
    print(f"\nOPTIMAL LISTING PRICES:")
    print(f"  Express Sell: ₹{pricing['express_sell_price']:.2f}")
    print(f"  Regular Sell: ₹{pricing['regular_sell_price']:.2f}")
    print(f"  Express Buy: ₹{pricing['express_buy_price']:.2f}")
    print(f"  Regular Buy: ₹{pricing['regular_buy_price']:.2f}")
    
    # Generate plots
    optimizer.plot_optimization_results(report)
    
    return report

if __name__ == "__main__":
    main()