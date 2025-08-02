"""
P2P Listing Price Optimization and Adaptive Strategy Framework
Advanced pricing algorithms for competitive P2P arbitrage trading
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from typing import Dict, List, Tuple, Optional
from datetime import datetime, timedelta
from scipy import stats
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
import warnings
warnings.filterwarnings('ignore')

class P2PListingOptimizer:
    """
    Advanced P2P listing optimization with machine learning and competitive analysis
    """
    
    def __init__(self):
        self.market_data = None
        self.competitor_analysis = {}
        self.pricing_models = {}
        
    def analyze_market_microstructure(self, orderbook_data: pd.DataFrame) -> Dict:
        """
        Analyze P2P market microstructure for optimal pricing
        """
        # Order book depth analysis
        bid_depth = orderbook_data.groupby('price')['volume'].sum().sort_index(ascending=False)
        ask_depth = orderbook_data.groupby('price')['volume'].sum().sort_index()
        
        # Price impact analysis
        total_volume = orderbook_data['volume'].sum()
        cumulative_volume = orderbook_data.groupby('price')['volume'].cumsum()
        
        # Market concentration (Herfindahl Index for order sizes)
        market_shares = orderbook_data['volume'] / total_volume
        herfindahl_index = (market_shares ** 2).sum()
        
        # Spread analysis
        best_bid = orderbook_data[orderbook_data['side'] == 'buy']['price'].max()
        best_ask = orderbook_data[orderbook_data['side'] == 'sell']['price'].min()
        spread = best_ask - best_bid
        spread_percentage = (spread / best_bid) * 100
        
        # Order size distribution
        size_stats = {
            'mean_order_size': orderbook_data['volume'].mean(),
            'median_order_size': orderbook_data['volume'].median(),
            'order_size_std': orderbook_data['volume'].std(),
            'large_order_threshold': orderbook_data['volume'].quantile(0.9)
        }
        
        return {
            'spread': spread,
            'spread_percentage': spread_percentage,
            'market_concentration': herfindahl_index,
            'order_statistics': size_stats,
            'best_bid': best_bid,
            'best_ask': best_ask,
            'total_liquidity': total_volume
        }
    
    def competitive_positioning_analysis(self, competitor_data: List[Dict]) -> Dict:
        """
        Analyze competitor positioning for optimal pricing strategy
        """
        df_competitors = pd.DataFrame(competitor_data)
        
        # Price percentile analysis
        price_percentiles = {
            'p10': df_competitors['price'].quantile(0.10),
            'p25': df_competitors['price'].quantile(0.25),
            'p50': df_competitors['price'].quantile(0.50),
            'p75': df_competitors['price'].quantile(0.75),
            'p90': df_competitors['price'].quantile(0.90)
        }
        
        # Volume-weighted average price
        if 'max_volume' in df_competitors.columns:
            vwap = (df_competitors['price'] * df_competitors['max_volume']).sum() / df_competitors['max_volume'].sum()
        else:
            vwap = df_competitors['price'].mean()
        
        # Completion rate impact on pricing
        if 'completion_rate' in df_competitors.columns:
            high_quality_merchants = df_competitors[df_competitors['completion_rate'] >= 95]
            quality_premium = high_quality_merchants['price'].mean() - df_competitors['price'].mean()
        else:
            quality_premium = 0
        
        # Order limit analysis
        if 'min_order' in df_competitors.columns and 'max_order' in df_competitors.columns:
            avg_min_order = df_competitors['min_order'].mean()
            avg_max_order = df_competitors['max_order'].mean()
            order_range_analysis = {
                'avg_min': avg_min_order,
                'avg_max': avg_max_order,
                'range_ratio': avg_max_order / avg_min_order if avg_min_order > 0 else 0
            }
        else:
            order_range_analysis = {}
        
        return {
            'price_percentiles': price_percentiles,
            'vwap': vwap,
            'quality_premium': quality_premium,
            'order_ranges': order_range_analysis,
            'market_size': len(df_competitors),
            'price_variance': df_competitors['price'].var()
        }
    
    def calculate_optimal_pricing_strategy(self, market_analysis: Dict, 
                                         competitor_analysis: Dict,
                                         user_profile: Dict) -> Dict:
        """
        Calculate optimal pricing strategy based on market conditions and user profile
        """
        # Base pricing from competitor analysis
        base_price = competitor_analysis['price_percentiles']['p50']  # Median price
        
        # Adjustments based on user profile
        profile_adjustments = {
            'completion_rate_adj': 0,
            'volume_adj': 0,
            'speed_adj': 0,
            'payment_method_adj': 0
        }
        
        # Completion rate adjustment
        user_completion_rate = user_profile.get('completion_rate', 95)
        if user_completion_rate >= 98:
            profile_adjustments['completion_rate_adj'] = 0.3  # Premium pricing
        elif user_completion_rate >= 95:
            profile_adjustments['completion_rate_adj'] = 0.1
        elif user_completion_rate < 90:
            profile_adjustments['completion_rate_adj'] = -0.5  # Discount
        
        # Volume capacity adjustment
        user_max_volume = user_profile.get('max_order_size', 50000)
        market_avg_volume = competitor_analysis['order_ranges'].get('avg_max', 30000)
        if user_max_volume > market_avg_volume * 1.5:
            profile_adjustments['volume_adj'] = 0.2  # Premium for large orders
        
        # Payment method adjustment
        user_payment_methods = user_profile.get('payment_methods', [])
        premium_methods = ['UPI', 'IMPS', 'Bank Transfer']
        if any(method in premium_methods for method in user_payment_methods):
            profile_adjustments['speed_adj'] = 0.15
        
        # Market condition adjustments
        market_adjustments = {
            'liquidity_adj': 0,
            'volatility_adj': 0,
            'spread_adj': 0
        }
        
        # Liquidity adjustment
        if market_analysis['total_liquidity'] < 1000000:  # Low liquidity
            market_adjustments['liquidity_adj'] = 0.2
        elif market_analysis['total_liquidity'] > 5000000:  # High liquidity
            market_adjustments['liquidity_adj'] = -0.1
        
        # Spread adjustment
        if market_analysis['spread_percentage'] > 2.0:  # Wide spread
            market_adjustments['spread_adj'] = 0.1
        elif market_analysis['spread_percentage'] < 0.5:  # Tight spread
            market_adjustments['spread_adj'] = -0.05
        
        # Calculate final price
        total_adjustment = sum(profile_adjustments.values()) + sum(market_adjustments.values())
        optimal_price = base_price + total_adjustment
        
        # Competitive positioning
        position_vs_market = {
            'vs_p25': optimal_price - competitor_analysis['price_percentiles']['p25'],
            'vs_p50': optimal_price - competitor_analysis['price_percentiles']['p50'],
            'vs_p75': optimal_price - competitor_analysis['price_percentiles']['p75'],
            'vs_vwap': optimal_price - competitor_analysis['vwap']
        }
        
        return {
            'optimal_price': optimal_price,
            'base_price': base_price,
            'total_adjustment': total_adjustment,
            'profile_adjustments': profile_adjustments,
            'market_adjustments': market_adjustments,
            'competitive_position': position_vs_market,
            'expected_fill_probability': self._estimate_fill_probability(optimal_price, competitor_analysis),
            'expected_profit_margin': self._calculate_profit_margin(optimal_price, user_profile)
        }
    
    def dynamic_pricing_model(self, historical_data: pd.DataFrame, 
                            features: List[str]) -> Dict:
        """
        Build machine learning model for dynamic pricing
        """
        # Prepare features and target
        X = historical_data[features].fillna(0)
        y = historical_data['execution_price']  # Actual execution prices
        
        # Split data
        split_idx = int(len(X) * 0.8)
        X_train, X_test = X[:split_idx], X[split_idx:]
        y_train, y_test = y[:split_idx], y[split_idx:]
        
        # Scale features
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        # Train Random Forest model
        model = RandomForestRegressor(n_estimators=100, random_state=42)
        model.fit(X_train_scaled, y_train)
        
        # Predictions and evaluation
        train_pred = model.predict(X_train_scaled)
        test_pred = model.predict(X_test_scaled)
        
        train_rmse = np.sqrt(np.mean((train_pred - y_train) ** 2))
        test_rmse = np.sqrt(np.mean((test_pred - y_test) ** 2))
        
        # Feature importance
        feature_importance = dict(zip(features, model.feature_importances_))
        
        return {
            'model': model,
            'scaler': scaler,
            'train_rmse': train_rmse,
            'test_rmse': test_rmse,
            'feature_importance': feature_importance,
            'r2_score': model.score(X_test_scaled, y_test)
        }
    
    def adaptive_strategy_framework(self, market_regime: str, 
                                  volatility_level: str) -> Dict:
        """
        Create adaptive trading strategy based on market conditions
        """
        strategies = {
            'bull_market': {
                'low_volatility': {
                    'aggressive_pricing': True,
                    'price_adjustment': 0.3,
                    'order_size_multiplier': 1.2,
                    'update_frequency': '15min',
                    'risk_tolerance': 'medium'
                },
                'high_volatility': {
                    'aggressive_pricing': False,
                    'price_adjustment': 0.1,
                    'order_size_multiplier': 0.8,
                    'update_frequency': '5min',
                    'risk_tolerance': 'low'
                }
            },
            'bear_market': {
                'low_volatility': {
                    'aggressive_pricing': False,
                    'price_adjustment': -0.1,
                    'order_size_multiplier': 1.5,
                    'update_frequency': '30min',
                    'risk_tolerance': 'high'
                },
                'high_volatility': {
                    'aggressive_pricing': False,
                    'price_adjustment': -0.3,
                    'order_size_multiplier': 0.5,
                    'update_frequency': '2min',
                    'risk_tolerance': 'very_low'
                }
            },
            'sideways_market': {
                'low_volatility': {
                    'aggressive_pricing': True,
                    'price_adjustment': 0.2,
                    'order_size_multiplier': 1.0,
                    'update_frequency': '20min',
                    'risk_tolerance': 'medium'
                },
                'high_volatility': {
                    'aggressive_pricing': False,
                    'price_adjustment': 0.05,
                    'order_size_multiplier': 0.7,
                    'update_frequency': '10min',
                    'risk_tolerance': 'medium_low'
                }
            }
        }
        
        strategy = strategies.get(market_regime, {}).get(volatility_level, {})
        
        # Add risk management rules
        strategy['risk_management'] = {
            'max_exposure_per_trade': self._calculate_max_exposure(strategy.get('risk_tolerance', 'medium')),
            'stop_loss_threshold': self._get_stop_loss_threshold(strategy.get('risk_tolerance', 'medium')),
            'position_sizing_rule': self._get_position_sizing_rule(strategy.get('risk_tolerance', 'medium'))
        }
        
        return strategy
    
    def order_flow_analysis(self, order_flow_data: pd.DataFrame) -> Dict:
        """
        Analyze order flow patterns for better timing
        """
        # Time-based analysis
        order_flow_data['hour'] = pd.to_datetime(order_flow_data['timestamp']).dt.hour
        hourly_volume = order_flow_data.groupby('hour')['volume'].sum()
        hourly_avg_price = order_flow_data.groupby('hour')['price'].mean()
        
        # Buy/Sell imbalance
        buy_orders = order_flow_data[order_flow_data['side'] == 'buy']
        sell_orders = order_flow_data[order_flow_data['side'] == 'sell']
        
        imbalance_ratio = len(buy_orders) / len(sell_orders) if len(sell_orders) > 0 else np.inf
        volume_imbalance = buy_orders['volume'].sum() / sell_orders['volume'].sum() if sell_orders['volume'].sum() > 0 else np.inf
        
        # Order size patterns
        large_orders = order_flow_data[order_flow_data['volume'] > order_flow_data['volume'].quantile(0.9)]
        large_order_impact = large_orders.groupby('side')['price'].mean()
        
        # Execution probability by price level
        price_bins = pd.cut(order_flow_data['price'], bins=10)
        execution_prob = order_flow_data.groupby(price_bins)['executed'].mean()
        
        return {
            'hourly_patterns': {
                'volume': hourly_volume.to_dict(),
                'avg_price': hourly_avg_price.to_dict(),
                'peak_hours': hourly_volume.nlargest(3).index.tolist()
            },
            'order_imbalance': {
                'count_ratio': imbalance_ratio,
                'volume_ratio': volume_imbalance
            },
            'large_order_impact': large_order_impact.to_dict() if not large_order_impact.empty else {},
            'execution_probability': execution_prob.to_dict(),
            'optimal_timing': self._find_optimal_timing(hourly_volume, hourly_avg_price)
        }
    
    def real_time_price_optimization(self, current_market_data: Dict, 
                                   user_objectives: Dict) -> Dict:
        """
        Real-time price optimization based on current market conditions
        """
        # Current market snapshot
        current_spread = current_market_data['best_ask'] - current_market_data['best_bid']
        mid_price = (current_market_data['best_ask'] + current_market_data['best_bid']) / 2
        
        # Objective-based pricing
        if user_objectives.get('priority') == 'speed':
            # Aggressive pricing for fast execution
            if user_objectives.get('side') == 'buy':
                recommended_price = current_market_data['best_ask'] + 0.1
            else:
                recommended_price = current_market_data['best_bid'] - 0.1
        elif user_objectives.get('priority') == 'profit':
            # Conservative pricing for better margins
            if user_objectives.get('side') == 'buy':
                recommended_price = current_market_data['best_bid'] + current_spread * 0.3
            else:
                recommended_price = current_market_data['best_ask'] - current_spread * 0.3
        else:
            # Balanced approach
            if user_objectives.get('side') == 'buy':
                recommended_price = mid_price + current_spread * 0.1
            else:
                recommended_price = mid_price - current_spread * 0.1
        
        # Market impact estimation
        order_size = user_objectives.get('order_size', 10000)
        market_impact = self._estimate_market_impact(order_size, current_market_data)
        
        # Adjust for market impact
        adjusted_price = recommended_price + market_impact
        
        # Confidence intervals
        price_volatility = current_market_data.get('price_volatility', 0.01)
        confidence_95 = adjusted_price + 1.96 * price_volatility
        confidence_5 = adjusted_price - 1.96 * price_volatility
        
        return {
            'recommended_price': adjusted_price,
            'base_price': recommended_price,
            'market_impact': market_impact,
            'confidence_intervals': {
                '95%': confidence_95,
                '5%': confidence_5
            },
            'execution_probability': self._estimate_execution_probability(adjusted_price, current_market_data),
            'expected_profit': self._calculate_expected_profit(adjusted_price, user_objectives)
        }
    
    def _estimate_fill_probability(self, price: float, competitor_analysis: Dict) -> float:
        """
        Estimate probability of order being filled at given price
        """
        price_percentiles = competitor_analysis['price_percentiles']
        
        if price <= price_percentiles['p10']:
            return 0.95
        elif price <= price_percentiles['p25']:
            return 0.80
        elif price <= price_percentiles['p50']:
            return 0.60
        elif price <= price_percentiles['p75']:
            return 0.40
        elif price <= price_percentiles['p90']:
            return 0.20
        else:
            return 0.10
    
    def _calculate_profit_margin(self, price: float, user_profile: Dict) -> float:
        """
        Calculate expected profit margin at given price
        """
        cost_basis = user_profile.get('cost_basis', price - 2.0)
        return ((price - cost_basis) / cost_basis) * 100
    
    def _calculate_max_exposure(self, risk_tolerance: str) -> float:
        """
        Calculate maximum exposure per trade based on risk tolerance
        """
        exposure_limits = {
            'very_low': 0.05,
            'low': 0.08,
            'medium_low': 0.10,
            'medium': 0.15,
            'high': 0.20
        }
        return exposure_limits.get(risk_tolerance, 0.10)
    
    def _get_stop_loss_threshold(self, risk_tolerance: str) -> float:
        """
        Get stop loss threshold based on risk tolerance
        """
        stop_loss_levels = {
            'very_low': 0.01,
            'low': 0.015,
            'medium_low': 0.02,
            'medium': 0.025,
            'high': 0.03
        }
        return stop_loss_levels.get(risk_tolerance, 0.02)
    
    def _get_position_sizing_rule(self, risk_tolerance: str) -> str:
        """
        Get position sizing rule based on risk tolerance
        """
        sizing_rules = {
            'very_low': 'fixed_fractional_1pct',
            'low': 'fixed_fractional_2pct',
            'medium_low': 'kelly_quarter',
            'medium': 'kelly_half',
            'high': 'kelly_full'
        }
        return sizing_rules.get(risk_tolerance, 'fixed_fractional_2pct')
    
    def _find_optimal_timing(self, hourly_volume: pd.Series, 
                           hourly_avg_price: pd.Series) -> Dict:
        """
        Find optimal timing for order placement
        """
        # Volume-based optimal hours
        high_volume_hours = hourly_volume.nlargest(5).index.tolist()
        
        # Price-based optimal hours
        low_price_hours = hourly_avg_price.nsmallest(3).index.tolist()
        high_price_hours = hourly_avg_price.nlargest(3).index.tolist()
        
        return {
            'best_buy_hours': low_price_hours,
            'best_sell_hours': high_price_hours,
            'high_liquidity_hours': high_volume_hours
        }
    
    def _estimate_market_impact(self, order_size: float, 
                              market_data: Dict) -> float:
        """
        Estimate market impact of order size
        """
        total_liquidity = market_data.get('total_liquidity', 1000000)
        impact_coefficient = order_size / total_liquidity
        
        # Square root law for market impact
        return np.sqrt(impact_coefficient) * 0.1  # Rough estimate
    
    def _estimate_execution_probability(self, price: float, 
                                      market_data: Dict) -> float:
        """
        Estimate execution probability based on current market
        """
        if 'best_bid' in market_data and 'best_ask' in market_data:
            spread = market_data['best_ask'] - market_data['best_bid']
            mid_price = (market_data['best_ask'] + market_data['best_bid']) / 2
            
            distance_from_mid = abs(price - mid_price)
            normalized_distance = distance_from_mid / spread if spread > 0 else 0
            
            # Sigmoid function for probability
            return 1 / (1 + np.exp(5 * normalized_distance - 2))
        
        return 0.5  # Default probability
    
    def _calculate_expected_profit(self, price: float, objectives: Dict) -> float:
        """
        Calculate expected profit for given price and objectives
        """
        cost_basis = objectives.get('cost_basis', price - 1.0)
        order_size = objectives.get('order_size', 10000)
        
        profit_per_unit = price - cost_basis
        total_profit = profit_per_unit * (order_size / price)  # Convert to units
        
        return total_profit
    
    def plot_pricing_analysis(self, optimization_results: Dict, save_path: str = None):
        """
        Create visualization of pricing analysis results
        """
        fig, axes = plt.subplots(2, 2, figsize=(15, 12))
        
        # Price distribution and optimal positioning
        if 'competitive_analysis' in optimization_results:
            comp_data = optimization_results['competitive_analysis']
            percentiles = comp_data['price_percentiles']
            
            prices = list(percentiles.values())
            labels = list(percentiles.keys())
            
            axes[0, 0].bar(labels, prices, alpha=0.7, color='skyblue')
            
            # Add optimal price line
            if 'pricing_strategy' in optimization_results:
                optimal_price = optimization_results['pricing_strategy']['optimal_price']
                axes[0, 0].axhline(y=optimal_price, color='red', linestyle='--', 
                                  label=f'Optimal Price: ₹{optimal_price:.2f}')
                axes[0, 0].legend()
            
            axes[0, 0].set_title('Competitive Price Distribution')
            axes[0, 0].set_ylabel('Price (₹)')
            
        # Market timing analysis
        if 'order_flow' in optimization_results:
            flow_data = optimization_results['order_flow']
            hourly_data = flow_data['hourly_patterns']
            
            hours = list(hourly_data['volume'].keys())
            volumes = list(hourly_data['volume'].values())
            
            axes[0, 1].plot(hours, volumes, marker='o', linewidth=2, color='green')
            axes[0, 1].set_title('Hourly Trading Volume Pattern')
            axes[0, 1].set_xlabel('Hour of Day')
            axes[0, 1].set_ylabel('Volume')
            axes[0, 1].grid(True, alpha=0.3)
            
        # Risk-return profile
        if 'pricing_strategy' in optimization_results:
            strategy = optimization_results['pricing_strategy']
            
            # Create risk-return scatter
            prices = np.linspace(strategy['optimal_price'] - 2, 
                               strategy['optimal_price'] + 2, 20)
            
            fill_probs = [self._estimate_fill_probability(p, {
                'price_percentiles': {'p10': 83, 'p25': 84, 'p50': 85, 'p75': 86, 'p90': 87}
            }) for p in prices]
            
            profit_margins = [(p - (strategy['optimal_price'] - 1.5))/p * 100 for p in prices]
            
            axes[1, 0].scatter(fill_probs, profit_margins, c=prices, cmap='RdYlBu', s=50)
            axes[1, 0].set_xlabel('Fill Probability')
            axes[1, 0].set_ylabel('Profit Margin (%)')
            axes[1, 0].set_title('Risk-Return Profile')
            
            # Mark optimal point
            opt_fill_prob = strategy['expected_fill_probability']
            opt_profit = strategy['expected_profit_margin']
            axes[1, 0].scatter([opt_fill_prob], [opt_profit], 
                             color='red', s=100, marker='*', 
                             label='Optimal Strategy')
            axes[1, 0].legend()
            
        # Strategy comparison
        strategies = ['Conservative', 'Balanced', 'Aggressive']
        metrics = {
            'Expected Profit': [150, 200, 280],
            'Fill Probability': [0.85, 0.65, 0.45],
            'Risk Score': [2, 5, 8]
        }
        
        x = np.arange(len(strategies))
        width = 0.25
        
        for i, (metric, values) in enumerate(metrics.items()):
            axes[1, 1].bar(x + i*width, values, width, label=metric, alpha=0.8)
        
        axes[1, 1].set_xlabel('Strategy Type')
        axes[1, 1].set_title('Strategy Comparison')
        axes[1, 1].set_xticks(x + width)
        axes[1, 1].set_xticklabels(strategies)
        axes[1, 1].legend()
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        else:
            plt.savefig('/Users/srijan/Desktop/my-automation-project/pricing_optimization_results.png', 
                       dpi=300, bbox_inches='tight')
        
        plt.show()

# Example usage and testing
def main():
    print("💰 P2P Listing Price Optimization System")
    print("=" * 45)
    
    optimizer = P2PListingOptimizer()
    
    # Simulate market data
    np.random.seed(42)
    
    # Mock competitor data
    competitor_data = [
        {'price': 84.5 + np.random.normal(0, 0.5), 'completion_rate': 96 + np.random.randint(-3, 4),
         'min_order': 1000, 'max_order': 50000} for _ in range(20)
    ]
    
    # Mock user profile
    user_profile = {
        'completion_rate': 97,
        'max_order_size': 75000,
        'payment_methods': ['UPI', 'IMPS', 'Bank Transfer'],
        'cost_basis': 83.0
    }
    
    # Mock market data
    market_data = {
        'best_bid': 84.2,
        'best_ask': 84.8,
        'total_liquidity': 2500000,
        'spread_percentage': 0.7
    }
    
    print("📊 Analyzing competitive landscape...")
    competitor_analysis = optimizer.competitive_positioning_analysis(competitor_data)
    
    print("🎯 Calculating optimal pricing strategy...")
    pricing_strategy = optimizer.calculate_optimal_pricing_strategy(
        market_data, competitor_analysis, user_profile
    )
    
    print("⚡ Real-time price optimization...")
    user_objectives = {
        'priority': 'balanced',
        'side': 'sell',
        'order_size': 25000,
        'cost_basis': 83.0
    }
    
    real_time_pricing = optimizer.real_time_price_optimization(market_data, user_objectives)
    
    # Display results
    print(f"\n🎯 OPTIMAL PRICING STRATEGY")
    print("=" * 30)
    print(f"Optimal Price: ₹{pricing_strategy['optimal_price']:.2f}")
    print(f"Base Price (Market): ₹{pricing_strategy['base_price']:.2f}")
    print(f"Total Adjustment: ₹{pricing_strategy['total_adjustment']:.2f}")
    print(f"Expected Fill Probability: {pricing_strategy['expected_fill_probability']:.1%}")
    print(f"Expected Profit Margin: {pricing_strategy['expected_profit_margin']:.1%}")
    
    print(f"\n⚡ REAL-TIME PRICING")
    print("=" * 20)
    print(f"Recommended Price: ₹{real_time_pricing['recommended_price']:.2f}")
    print(f"Market Impact: ₹{real_time_pricing['market_impact']:.3f}")
    print(f"Execution Probability: {real_time_pricing['execution_probability']:.1%}")
    print(f"Expected Profit: ₹{real_time_pricing['expected_profit']:.0f}")
    
    print(f"\n📈 COMPETITIVE POSITION")
    print("=" * 25)
    comp_pos = pricing_strategy['competitive_position']
    print(f"vs 25th percentile: ₹{comp_pos['vs_p25']:+.2f}")
    print(f"vs Median: ₹{comp_pos['vs_p50']:+.2f}")
    print(f"vs 75th percentile: ₹{comp_pos['vs_p75']:+.2f}")
    print(f"vs VWAP: ₹{comp_pos['vs_vwap']:+.2f}")
    
    # Generate adaptive strategies
    print(f"\n🔄 ADAPTIVE STRATEGIES")
    print("=" * 22)
    
    bull_low_vol = optimizer.adaptive_strategy_framework('bull_market', 'low_volatility')
    bear_high_vol = optimizer.adaptive_strategy_framework('bear_market', 'high_volatility')
    
    print("Bull Market + Low Volatility:")
    print(f"  Price Adjustment: +₹{bull_low_vol['price_adjustment']:.1f}")
    print(f"  Update Frequency: {bull_low_vol['update_frequency']}")
    print(f"  Risk Tolerance: {bull_low_vol['risk_tolerance']}")
    
    print("Bear Market + High Volatility:")
    print(f"  Price Adjustment: ₹{bear_high_vol['price_adjustment']:.1f}")
    print(f"  Update Frequency: {bear_high_vol['update_frequency']}")
    print(f"  Risk Tolerance: {bear_high_vol['risk_tolerance']}")
    
    # Create visualization
    results = {
        'competitive_analysis': competitor_analysis,
        'pricing_strategy': pricing_strategy,
        'real_time_pricing': real_time_pricing
    }
    
    optimizer.plot_pricing_analysis(results)
    
    return results

if __name__ == "__main__":
    main()