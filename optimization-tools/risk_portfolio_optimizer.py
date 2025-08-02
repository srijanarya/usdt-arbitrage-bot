"""
Risk Management and Portfolio Optimization for P2P USDT Arbitrage
Advanced quantitative risk analysis and position sizing optimization
"""

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats
from scipy.optimize import minimize
import warnings
warnings.filterwarnings('ignore')

class RiskPortfolioOptimizer:
    """
    Advanced risk management and portfolio optimization for P2P arbitrage trading
    """
    
    def __init__(self):
        self.risk_free_rate = 0.06  # 6% annual risk-free rate (Indian bonds)
        self.trading_days = 252
        
    def calculate_var(self, returns: np.array, confidence_level: float = 0.05) -> Dict[str, float]:
        """
        Calculate Value at Risk (VaR) using multiple methods
        """
        # Historical VaR
        var_historical = np.percentile(returns, confidence_level * 100)
        
        # Parametric VaR (assuming normal distribution)
        mean = np.mean(returns)
        std = np.std(returns)
        var_parametric = stats.norm.ppf(confidence_level, mean, std)
        
        # Modified VaR (Cornish-Fisher expansion for non-normal distributions)
        skewness = stats.skew(returns)
        kurtosis = stats.kurtosis(returns)
        
        z_score = stats.norm.ppf(confidence_level)
        modified_z = (z_score + 
                     (z_score**2 - 1) * skewness / 6 + 
                     (z_score**3 - 3*z_score) * kurtosis / 24 - 
                     (2*z_score**3 - 5*z_score) * skewness**2 / 36)
        
        var_modified = mean + modified_z * std
        
        return {
            'var_historical': var_historical,
            'var_parametric': var_parametric,
            'var_modified': var_modified,
            'confidence_level': confidence_level
        }
    
    def calculate_cvar(self, returns: np.array, confidence_level: float = 0.05) -> float:
        """
        Calculate Conditional Value at Risk (Expected Shortfall)
        """
        var = np.percentile(returns, confidence_level * 100)
        cvar = returns[returns <= var].mean()
        return cvar
    
    def calculate_maximum_drawdown(self, returns: np.array) -> Dict[str, float]:
        """
        Calculate maximum drawdown and related metrics
        """
        cumulative = np.cumprod(1 + returns)
        running_max = np.maximum.accumulate(cumulative)
        drawdown = (cumulative - running_max) / running_max
        
        max_dd = drawdown.min()
        max_dd_duration = self._calculate_drawdown_duration(drawdown)
        
        return {
            'max_drawdown': max_dd,
            'max_drawdown_duration': max_dd_duration,
            'avg_drawdown': drawdown[drawdown < 0].mean() if len(drawdown[drawdown < 0]) > 0 else 0,
            'drawdown_frequency': len(drawdown[drawdown < 0]) / len(drawdown)
        }
    
    def _calculate_drawdown_duration(self, drawdown: np.array) -> int:
        """
        Calculate maximum drawdown duration in periods
        """
        is_drawdown = drawdown < 0
        duration = 0
        max_duration = 0
        
        for dd in is_drawdown:
            if dd:
                duration += 1
                max_duration = max(max_duration, duration)
            else:
                duration = 0
                
        return max_duration
    
    def calculate_risk_metrics(self, returns: np.array) -> Dict[str, float]:
        """
        Calculate comprehensive risk metrics
        """
        returns_annual = returns * self.trading_days
        
        # Basic statistics
        mean_return = np.mean(returns_annual)
        volatility = np.std(returns_annual)
        
        # Risk-adjusted returns
        sharpe_ratio = (mean_return - self.risk_free_rate) / volatility if volatility > 0 else 0
        sortino_ratio = mean_return / np.std(returns_annual[returns_annual < 0]) if len(returns_annual[returns_annual < 0]) > 0 else 0
        
        # Tail risk
        var_metrics = self.calculate_var(returns_annual)
        cvar = self.calculate_cvar(returns_annual)
        
        # Drawdown metrics
        dd_metrics = self.calculate_maximum_drawdown(returns)
        
        # Calmar ratio (return / max drawdown)
        calmar_ratio = abs(mean_return / dd_metrics['max_drawdown']) if dd_metrics['max_drawdown'] != 0 else 0
        
        # Higher moments
        skewness = stats.skew(returns_annual)
        kurtosis = stats.kurtosis(returns_annual)
        
        return {
            'annual_return': mean_return,
            'volatility': volatility,
            'sharpe_ratio': sharpe_ratio,
            'sortino_ratio': sortino_ratio,
            'calmar_ratio': calmar_ratio,
            'var_95': var_metrics['var_historical'],
            'cvar_95': cvar,
            'max_drawdown': dd_metrics['max_drawdown'],
            'max_dd_duration': dd_metrics['max_drawdown_duration'],
            'skewness': skewness,
            'kurtosis': kurtosis
        }
    
    def kelly_criterion(self, win_rate: float, avg_win: float, avg_loss: float) -> float:
        """
        Calculate optimal position size using Kelly Criterion
        """
        if avg_loss == 0:
            return 0
        
        b = avg_win / abs(avg_loss)  # Win/loss ratio
        p = win_rate  # Win probability
        q = 1 - p     # Loss probability
        
        kelly_fraction = (b * p - q) / b
        
        # Apply fractional Kelly for safety (typically 0.25 to 0.5 of full Kelly)
        safe_kelly = max(0, min(kelly_fraction * 0.25, 0.15))  # Cap at 15%
        
        return safe_kelly
    
    def optimal_position_sizing_var(self, expected_returns: np.array, var_limit: float) -> float:
        """
        Calculate optimal position size based on VaR constraint
        """
        def var_constraint(weight):
            portfolio_return = weight * expected_returns
            return self.calculate_var(portfolio_return)['var_historical'] - var_limit
        
        # Minimize negative expected return subject to VaR constraint
        def objective(weight):
            return -weight * np.mean(expected_returns)
        
        # Constraints
        constraints = [
            {'type': 'ineq', 'fun': var_constraint},  # VaR constraint
            {'type': 'ineq', 'fun': lambda w: w},     # Positive weight
            {'type': 'ineq', 'fun': lambda w: 1 - w}  # Weight <= 1
        ]
        
        result = minimize(objective, x0=[0.1], method='SLSQP', constraints=constraints)
        
        return result.x[0] if result.success else 0.1
    
    def monte_carlo_portfolio_simulation(self, base_returns: np.array, 
                                       n_simulations: int = 10000, 
                                       time_horizon: int = 252) -> Dict:
        """
        Monte Carlo simulation for portfolio performance
        """
        mean_return = np.mean(base_returns)
        std_return = np.std(base_returns)
        
        # Generate random returns
        simulated_returns = np.random.normal(mean_return, std_return, 
                                           (n_simulations, time_horizon))
        
        # Calculate cumulative returns for each simulation
        cumulative_returns = np.cumprod(1 + simulated_returns, axis=1)
        final_returns = cumulative_returns[:, -1] - 1
        
        # Calculate portfolio statistics
        results = {
            'mean_final_return': np.mean(final_returns),
            'std_final_return': np.std(final_returns),
            'prob_positive': np.mean(final_returns > 0),
            'prob_loss_10pct': np.mean(final_returns < -0.1),
            'prob_loss_20pct': np.mean(final_returns < -0.2),
            'percentile_5': np.percentile(final_returns, 5),
            'percentile_25': np.percentile(final_returns, 25),
            'percentile_75': np.percentile(final_returns, 75),
            'percentile_95': np.percentile(final_returns, 95),
            'simulated_paths': cumulative_returns[:100],  # Sample of paths for plotting
            'all_final_returns': final_returns
        }
        
        return results
    
    def optimize_multi_asset_portfolio(self, returns_matrix: np.array, 
                                     risk_tolerance: float = 0.1) -> Dict:
        """
        Optimize portfolio across multiple arbitrage opportunities
        Modern Portfolio Theory implementation
        """
        n_assets = returns_matrix.shape[1]
        
        # Calculate expected returns and covariance matrix
        expected_returns = np.mean(returns_matrix, axis=0)
        cov_matrix = np.cov(returns_matrix.T)
        
        # Objective function: minimize portfolio variance
        def portfolio_variance(weights):
            return np.dot(weights.T, np.dot(cov_matrix, weights))
        
        # Constraint: target return
        def return_constraint(weights):
            return np.dot(weights, expected_returns) - risk_tolerance
        
        # Constraints
        constraints = [
            {'type': 'eq', 'fun': lambda w: np.sum(w) - 1},  # Weights sum to 1
            {'type': 'ineq', 'fun': return_constraint}        # Minimum return
        ]
        
        # Bounds: no short selling, max 40% in any single asset
        bounds = tuple([(0, 0.4) for _ in range(n_assets)])
        
        # Initial guess
        initial_weights = np.array([1/n_assets] * n_assets)
        
        # Optimize
        result = minimize(portfolio_variance, initial_weights, 
                         method='SLSQP', bounds=bounds, constraints=constraints)
        
        if result.success:
            optimal_weights = result.x
            portfolio_return = np.dot(optimal_weights, expected_returns)
            portfolio_risk = np.sqrt(portfolio_variance(optimal_weights))
            sharpe = (portfolio_return - self.risk_free_rate) / portfolio_risk
            
            return {
                'weights': optimal_weights,
                'expected_return': portfolio_return,
                'risk': portfolio_risk,
                'sharpe_ratio': sharpe,
                'success': True
            }
        else:
            return {'success': False, 'message': result.message}
    
    def calculate_position_sizing_rules(self, historical_data: pd.DataFrame) -> Dict:
        """
        Calculate multiple position sizing rules and recommendations
        """
        returns = historical_data['profit'].pct_change().dropna()
        
        # Basic statistics
        wins = historical_data[historical_data['profit'] > 0]['profit']
        losses = historical_data[historical_data['profit'] <= 0]['profit']
        
        win_rate = len(wins) / len(historical_data)
        avg_win = wins.mean() if len(wins) > 0 else 0
        avg_loss = losses.mean() if len(losses) > 0 else 0
        
        # Kelly Criterion
        kelly_size = self.kelly_criterion(win_rate, avg_win, avg_loss)
        
        # Fixed Fractional (conservative)
        fixed_fractional = 0.02  # 2% risk per trade
        
        # Percent Volatility
        volatility = returns.std()
        target_volatility = 0.01  # 1% daily volatility target
        percent_vol_size = target_volatility / volatility if volatility > 0 else fixed_fractional
        
        # Risk-adjusted sizing
        risk_metrics = self.calculate_risk_metrics(returns)
        risk_adjusted_size = fixed_fractional / max(abs(risk_metrics['max_drawdown']), 0.01)
        
        # Monte Carlo based sizing
        mc_results = self.monte_carlo_portfolio_simulation(returns)
        mc_size = fixed_fractional / max(abs(mc_results['percentile_5']), 0.01)
        
        return {
            'kelly_criterion': kelly_size,
            'fixed_fractional': fixed_fractional,
            'percent_volatility': percent_vol_size,
            'risk_adjusted': min(risk_adjusted_size, 0.15),  # Cap at 15%
            'monte_carlo_based': min(mc_size, 0.15),
            'recommended': min(np.mean([kelly_size, fixed_fractional, percent_vol_size]), 0.10),
            'statistics': {
                'win_rate': win_rate,
                'avg_win': avg_win,
                'avg_loss': avg_loss,
                'profit_factor': abs(avg_win / avg_loss) if avg_loss != 0 else np.inf
            }
        }
    
    def generate_risk_report(self, trading_data: pd.DataFrame) -> Dict:
        """
        Generate comprehensive risk analysis report
        """
        returns = trading_data['profit'].pct_change().dropna()
        
        # Core risk metrics
        risk_metrics = self.calculate_risk_metrics(returns)
        
        # Position sizing analysis
        position_rules = self.calculate_position_sizing_rules(trading_data)
        
        # Monte Carlo simulation
        mc_simulation = self.monte_carlo_portfolio_simulation(returns)
        
        # Stress testing
        stress_scenarios = self.stress_test_portfolio(returns)
        
        # Risk-adjusted performance
        risk_adjusted_metrics = self.calculate_risk_adjusted_performance(trading_data)
        
        return {
            'risk_metrics': risk_metrics,
            'position_sizing': position_rules,
            'monte_carlo': mc_simulation,
            'stress_tests': stress_scenarios,
            'risk_adjusted_performance': risk_adjusted_metrics,
            'recommendations': self._generate_risk_recommendations(risk_metrics, position_rules)
        }
    
    def stress_test_portfolio(self, returns: np.array) -> Dict:
        """
        Stress test portfolio under various market scenarios
        """
        scenarios = {
            'market_crash': {
                'description': '2008-style market crash (30% drop)',
                'shock': -0.30,
                'days': 30
            },
            'volatility_spike': {
                'description': 'Volatility doubles for 2 weeks',
                'vol_multiplier': 2.0,
                'days': 14
            },
            'liquidity_crisis': {
                'description': 'Liquidity dries up (wider spreads)',
                'spread_increase': 0.005,  # 0.5% additional spread
                'days': 7
            },
            'regulatory_shock': {
                'description': 'Sudden regulatory change',
                'shock': -0.15,
                'days': 1
            }
        }
        
        base_portfolio_value = 100000  # Starting value
        stress_results = {}
        
        for scenario_name, scenario in scenarios.items():
            # Simulate scenario impact
            if 'shock' in scenario:
                # Immediate price shock
                shocked_value = base_portfolio_value * (1 + scenario['shock'])
                recovery_days = scenario['days']
                
                stress_results[scenario_name] = {
                    'immediate_loss': scenario['shock'],
                    'portfolio_value': shocked_value,
                    'recovery_estimate_days': recovery_days,
                    'probability_estimate': 0.05  # 5% probability estimate
                }
            
            elif 'vol_multiplier' in scenario:
                # Increased volatility scenario
                increased_vol = np.std(returns) * scenario['vol_multiplier']
                var_under_stress = np.percentile(returns, 5) * scenario['vol_multiplier']
                
                stress_results[scenario_name] = {
                    'new_volatility': increased_vol,
                    'stressed_var': var_under_stress,
                    'risk_increase': scenario['vol_multiplier'] - 1
                }
        
        return stress_results
    
    def calculate_risk_adjusted_performance(self, trading_data: pd.DataFrame) -> Dict:
        """
        Calculate various risk-adjusted performance metrics
        """
        returns = trading_data['profit'].pct_change().dropna()
        
        # Information Ratio
        excess_returns = returns - self.risk_free_rate/252  # Daily risk-free rate
        information_ratio = np.mean(excess_returns) / np.std(excess_returns) if np.std(excess_returns) > 0 else 0
        
        # Omega Ratio (gains vs losses above threshold)
        threshold = 0  # Threshold return
        gains = returns[returns > threshold].sum()
        losses = abs(returns[returns <= threshold].sum())
        omega_ratio = gains / losses if losses > 0 else np.inf
        
        # Tail Ratio
        tail_ratio = abs(np.percentile(returns, 95) / np.percentile(returns, 5))
        
        # Martin Ratio (return / Ulcer Index)
        ulcer_index = self._calculate_ulcer_index(trading_data['profit'].cumsum())
        martin_ratio = np.mean(returns) / ulcer_index if ulcer_index > 0 else 0
        
        return {
            'information_ratio': information_ratio,
            'omega_ratio': omega_ratio,
            'tail_ratio': tail_ratio,
            'martin_ratio': martin_ratio,
            'ulcer_index': ulcer_index
        }
    
    def _calculate_ulcer_index(self, cumulative_returns: pd.Series) -> float:
        """
        Calculate Ulcer Index (measure of downside risk)
        """
        running_max = cumulative_returns.expanding().max()
        drawdowns = (cumulative_returns - running_max) / running_max * 100
        squared_drawdowns = drawdowns ** 2
        return np.sqrt(squared_drawdowns.mean())
    
    def _generate_risk_recommendations(self, risk_metrics: Dict, position_rules: Dict) -> List[str]:
        """
        Generate actionable risk management recommendations
        """
        recommendations = []
        
        # Sharpe ratio recommendations
        if risk_metrics['sharpe_ratio'] < 1.0:
            recommendations.append("⚠️ Low Sharpe ratio - consider improving strategy selectivity or reducing costs")
        elif risk_metrics['sharpe_ratio'] > 2.0:
            recommendations.append("✅ Excellent Sharpe ratio - strategy shows strong risk-adjusted returns")
        
        # Maximum drawdown recommendations
        if abs(risk_metrics['max_drawdown']) > 0.15:
            recommendations.append("🚨 High maximum drawdown (>15%) - implement stricter position sizing")
        
        # Position sizing recommendations
        recommended_size = position_rules['recommended']
        if recommended_size < 0.05:
            recommendations.append("📉 Very conservative position sizing recommended due to high strategy risk")
        elif recommended_size > 0.10:
            recommendations.append("⚠️ Large position sizes detected - ensure adequate risk management")
        
        # Skewness recommendations
        if risk_metrics['skewness'] < -1:
            recommendations.append("📊 Negative skew detected - strategy prone to large losses")
        elif risk_metrics['skewness'] > 1:
            recommendations.append("✅ Positive skew - strategy tends toward large wins")
        
        # Volatility recommendations
        if risk_metrics['volatility'] > 0.30:
            recommendations.append("⚡ High volatility - consider reducing position sizes or improving timing")
        
        return recommendations
    
    def plot_risk_analysis(self, risk_report: Dict, save_path: str = None):
        """
        Create comprehensive risk analysis visualizations
        """
        fig, axes = plt.subplots(2, 3, figsize=(18, 12))
        
        # Risk metrics radar chart
        metrics = risk_report['risk_metrics']
        categories = ['Sharpe Ratio', 'Sortino Ratio', 'Calmar Ratio']
        values = [metrics['sharpe_ratio'], metrics['sortino_ratio'], metrics['calmar_ratio']]
        
        # Normalize values for radar chart
        max_val = max(max(values), 3.0)
        normalized_values = [v/max_val for v in values]
        
        angles = np.linspace(0, 2*np.pi, len(categories), endpoint=False)
        axes[0, 0].plot(angles, normalized_values, 'o-', linewidth=2)
        axes[0, 0].fill(angles, normalized_values, alpha=0.25)
        axes[0, 0].set_xticks(angles)
        axes[0, 0].set_xticklabels(categories)
        axes[0, 0].set_title('Risk-Adjusted Performance')
        axes[0, 0].set_ylim(0, 1)
        
        # VaR and CVaR
        var_data = [abs(metrics['var_95']), abs(metrics['cvar_95']), abs(metrics['max_drawdown'])]
        var_labels = ['VaR (95%)', 'CVaR (95%)', 'Max Drawdown']
        
        axes[0, 1].bar(var_labels, var_data, color=['red', 'darkred', 'orange'])
        axes[0, 1].set_title('Tail Risk Metrics')
        axes[0, 1].set_ylabel('Loss (%)')
        axes[0, 1].tick_params(axis='x', rotation=45)
        
        # Position sizing comparison
        pos_sizing = risk_report['position_sizing']
        sizing_methods = ['Kelly', 'Fixed', 'Vol Target', 'Risk Adj', 'Recommended']
        sizing_values = [
            pos_sizing['kelly_criterion'],
            pos_sizing['fixed_fractional'],
            pos_sizing['percent_volatility'],
            pos_sizing['risk_adjusted'],
            pos_sizing['recommended']
        ]
        
        axes[0, 2].bar(sizing_methods, sizing_values, color='skyblue')
        axes[0, 2].set_title('Position Sizing Methods')
        axes[0, 2].set_ylabel('Position Size (%)')
        axes[0, 2].tick_params(axis='x', rotation=45)
        
        # Monte Carlo simulation results
        mc_results = risk_report['monte_carlo']
        axes[1, 0].hist(mc_results['all_final_returns'], bins=50, alpha=0.7, color='green')
        axes[1, 0].axvline(mc_results['mean_final_return'], color='red', linestyle='--', 
                          label=f"Mean: {mc_results['mean_final_return']:.1%}")
        axes[1, 0].axvline(mc_results['percentile_5'], color='orange', linestyle='--',
                          label=f"5th percentile: {mc_results['percentile_5']:.1%}")
        axes[1, 0].set_title('Monte Carlo Return Distribution')
        axes[1, 0].set_xlabel('Annual Return')
        axes[1, 0].legend()
        
        # Sample Monte Carlo paths
        for i, path in enumerate(mc_results['simulated_paths'][:20]):
            axes[1, 1].plot(path, alpha=0.3, color='blue')
        axes[1, 1].set_title('Sample Monte Carlo Paths')
        axes[1, 1].set_xlabel('Trading Days')
        axes[1, 1].set_ylabel('Cumulative Return')
        
        # Risk metrics table
        axes[1, 2].axis('tight')
        axes[1, 2].axis('off')
        
        risk_table_data = [
            ['Metric', 'Value'],
            ['Annual Return', f"{metrics['annual_return']:.1%}"],
            ['Volatility', f"{metrics['volatility']:.1%}"],
            ['Sharpe Ratio', f"{metrics['sharpe_ratio']:.2f}"],
            ['Max Drawdown', f"{metrics['max_drawdown']:.1%}"],
            ['VaR (95%)', f"{metrics['var_95']:.1%}"],
            ['Skewness', f"{metrics['skewness']:.2f}"],
            ['Kurtosis', f"{metrics['kurtosis']:.2f}"]
        ]
        
        table = axes[1, 2].table(cellText=risk_table_data, cellLoc='center', loc='center')
        table.auto_set_font_size(False)
        table.set_fontsize(10)
        table.scale(1.2, 1.5)
        axes[1, 2].set_title('Risk Metrics Summary')
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        else:
            plt.savefig('/Users/srijan/Desktop/my-automation-project/risk_analysis_report.png', 
                       dpi=300, bbox_inches='tight')
        
        plt.show()

# Example usage and testing
def main():
    print("🎯 P2P Risk Management & Portfolio Optimization")
    print("=" * 50)
    
    # Create synthetic trading data for testing
    np.random.seed(42)
    dates = pd.date_range(start='2024-01-01', end='2024-03-31', freq='D')
    
    # Simulate trading returns with realistic patterns
    base_returns = np.random.normal(0.001, 0.02, len(dates))  # Daily returns
    profits = np.cumsum(base_returns) * 1000 + np.random.normal(150, 50, len(dates))
    
    trading_data = pd.DataFrame({
        'date': dates,
        'profit': profits
    })
    
    # Initialize optimizer
    optimizer = RiskPortfolioOptimizer()
    
    # Generate comprehensive risk report
    print("📊 Generating risk analysis report...")
    risk_report = optimizer.generate_risk_report(trading_data)
    
    # Display key findings
    print("\n🎯 KEY RISK METRICS")
    print("=" * 30)
    metrics = risk_report['risk_metrics']
    print(f"Annual Return: {metrics['annual_return']:.1%}")
    print(f"Volatility: {metrics['volatility']:.1%}")
    print(f"Sharpe Ratio: {metrics['sharpe_ratio']:.2f}")
    print(f"Max Drawdown: {metrics['max_drawdown']:.1%}")
    print(f"VaR (95%): {metrics['var_95']:.1%}")
    print(f"Calmar Ratio: {metrics['calmar_ratio']:.2f}")
    
    print("\n💰 POSITION SIZING RECOMMENDATIONS")
    print("=" * 35)
    pos_sizing = risk_report['position_sizing']
    print(f"Kelly Criterion: {pos_sizing['kelly_criterion']:.1%}")
    print(f"Fixed Fractional: {pos_sizing['fixed_fractional']:.1%}")
    print(f"Volatility Target: {pos_sizing['percent_volatility']:.1%}")
    print(f"Recommended: {pos_sizing['recommended']:.1%}")
    
    print("\n🔮 MONTE CARLO SIMULATION")
    print("=" * 30)
    mc = risk_report['monte_carlo']
    print(f"Probability of Profit: {mc['prob_positive']:.1%}")
    print(f"Probability of >10% Loss: {mc['prob_loss_10pct']:.1%}")
    print(f"5th Percentile Return: {mc['percentile_5']:.1%}")
    print(f"95th Percentile Return: {mc['percentile_95']:.1%}")
    
    print("\n⚠️ RISK RECOMMENDATIONS")
    print("=" * 25)
    for rec in risk_report['recommendations']:
        print(f"  {rec}")
    
    # Generate visualizations
    optimizer.plot_risk_analysis(risk_report)
    
    return risk_report

if __name__ == "__main__":
    main()