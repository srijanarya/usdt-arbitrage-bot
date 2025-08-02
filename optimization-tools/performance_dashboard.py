"""
Performance Metrics and KPIs Dashboard for P2P USDT Arbitrage
Comprehensive analytics and monitoring system for trading strategy performance
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import dash
from dash import dcc, html, dash_table
from dash.dependencies import Input, Output
import warnings
warnings.filterwarnings('ignore')

class PerformanceDashboard:
    """
    Comprehensive performance analytics and KPI tracking system
    """
    
    def __init__(self):
        self.trading_data = None
        self.kpis = {}
        self.benchmarks = {
            'sharpe_ratio': 1.5,
            'max_drawdown': -0.10,
            'win_rate': 0.65,
            'profit_factor': 1.8,
            'monthly_return': 0.08
        }
        
    def calculate_core_kpis(self, trading_data: pd.DataFrame) -> Dict:
        """
        Calculate core Key Performance Indicators
        """
        # Ensure datetime index
        if 'timestamp' in trading_data.columns:
            trading_data['timestamp'] = pd.to_datetime(trading_data['timestamp'])
            trading_data = trading_data.set_index('timestamp')
        
        # Basic metrics
        total_trades = len(trading_data)
        profitable_trades = len(trading_data[trading_data['profit'] > 0])
        win_rate = profitable_trades / total_trades if total_trades > 0 else 0
        
        # Financial metrics
        total_profit = trading_data['profit'].sum()
        total_revenue = trading_data['revenue'].sum() if 'revenue' in trading_data.columns else 0
        avg_profit_per_trade = trading_data['profit'].mean()
        
        # Risk metrics
        returns = trading_data['profit'].pct_change().dropna()
        volatility = returns.std() * np.sqrt(252)  # Annualized
        sharpe_ratio = (returns.mean() * 252) / volatility if volatility > 0 else 0
        
        # Drawdown analysis
        cumulative_profit = trading_data['profit'].cumsum()
        peak = cumulative_profit.expanding().max()
        drawdown = (cumulative_profit - peak) / peak
        max_drawdown = drawdown.min()
        
        # Win/Loss analysis
        wins = trading_data[trading_data['profit'] > 0]['profit']
        losses = trading_data[trading_data['profit'] <= 0]['profit']
        
        avg_win = wins.mean() if len(wins) > 0 else 0
        avg_loss = losses.mean() if len(losses) > 0 else 0
        profit_factor = abs(wins.sum() / losses.sum()) if losses.sum() != 0 else np.inf
        
        # Time-based metrics
        trading_data['month'] = trading_data.index.to_period('M')
        monthly_profits = trading_data.groupby('month')['profit'].sum()
        monthly_return = monthly_profits.mean()
        monthly_volatility = monthly_profits.std()
        
        # Efficiency metrics
        total_investment = trading_data['investment'].sum() if 'investment' in trading_data.columns else 0
        roi = (total_profit / total_investment) * 100 if total_investment > 0 else 0
        
        return {
            'total_trades': total_trades,
            'win_rate': win_rate,
            'total_profit': total_profit,
            'avg_profit_per_trade': avg_profit_per_trade,
            'sharpe_ratio': sharpe_ratio,
            'max_drawdown': max_drawdown,
            'profit_factor': profit_factor,
            'avg_win': avg_win,
            'avg_loss': avg_loss,
            'monthly_return': monthly_return,
            'monthly_volatility': monthly_volatility,
            'roi': roi,
            'volatility': volatility
        }
    
    def calculate_advanced_metrics(self, trading_data: pd.DataFrame) -> Dict:
        """
        Calculate advanced performance metrics
        """
        returns = trading_data['profit'].pct_change().dropna()
        
        # Risk-adjusted metrics
        sortino_ratio = self._calculate_sortino_ratio(returns)
        calmar_ratio = self._calculate_calmar_ratio(trading_data)
        omega_ratio = self._calculate_omega_ratio(returns)
        
        # Market efficiency metrics
        hit_ratio = self._calculate_hit_ratio(trading_data)
        average_trade_duration = self._calculate_avg_trade_duration(trading_data)
        
        # Consistency metrics
        monthly_win_rate = self._calculate_monthly_consistency(trading_data)
        kelly_criterion = self._calculate_kelly_criterion(trading_data)
        
        # Market timing metrics
        timing_metrics = self._analyze_market_timing(trading_data)
        
        # Slippage and execution metrics
        execution_metrics = self._analyze_execution_quality(trading_data)
        
        return {
            'sortino_ratio': sortino_ratio,
            'calmar_ratio': calmar_ratio,
            'omega_ratio': omega_ratio,
            'hit_ratio': hit_ratio,
            'avg_trade_duration': average_trade_duration,
            'monthly_win_rate': monthly_win_rate,
            'kelly_criterion': kelly_criterion,
            'timing_metrics': timing_metrics,
            'execution_metrics': execution_metrics
        }
    
    def generate_performance_report(self, trading_data: pd.DataFrame) -> Dict:
        """
        Generate comprehensive performance report
        """
        core_kpis = self.calculate_core_kpis(trading_data)
        advanced_metrics = self.calculate_advanced_metrics(trading_data)
        
        # Benchmark comparison
        benchmark_comparison = self._compare_to_benchmarks(core_kpis)
        
        # Trend analysis
        trend_analysis = self._analyze_performance_trends(trading_data)
        
        # Risk analysis
        risk_analysis = self._comprehensive_risk_analysis(trading_data)
        
        # Strategy effectiveness
        strategy_effectiveness = self._analyze_strategy_effectiveness(trading_data)
        
        return {
            'core_kpis': core_kpis,
            'advanced_metrics': advanced_metrics,
            'benchmark_comparison': benchmark_comparison,
            'trend_analysis': trend_analysis,
            'risk_analysis': risk_analysis,
            'strategy_effectiveness': strategy_effectiveness,
            'summary_score': self._calculate_overall_score(core_kpis, advanced_metrics)
        }
    
    def create_interactive_dashboard(self, trading_data: pd.DataFrame):
        """
        Create interactive dashboard using Plotly Dash
        """
        app = dash.Dash(__name__)
        
        # Calculate metrics
        report = self.generate_performance_report(trading_data)
        
        # Define layout
        app.layout = html.Div([
            html.H1("P2P USDT Arbitrage Performance Dashboard", 
                   style={'textAlign': 'center', 'marginBottom': 30}),
            
            # KPI Cards
            html.Div([
                self._create_kpi_card("Total Profit", f"₹{report['core_kpis']['total_profit']:,.0f}", "green"),
                self._create_kpi_card("Win Rate", f"{report['core_kpis']['win_rate']:.1%}", "blue"),
                self._create_kpi_card("Sharpe Ratio", f"{report['core_kpis']['sharpe_ratio']:.2f}", "purple"),
                self._create_kpi_card("Max Drawdown", f"{report['core_kpis']['max_drawdown']:.1%}", "red"),
            ], style={'display': 'flex', 'justifyContent': 'space-around', 'marginBottom': 30}),
            
            # Charts row 1
            html.Div([
                dcc.Graph(id='profit-chart', figure=self._create_profit_chart(trading_data)),
                dcc.Graph(id='drawdown-chart', figure=self._create_drawdown_chart(trading_data)),
            ], style={'display': 'flex'}),
            
            # Charts row 2
            html.Div([
                dcc.Graph(id='monthly-performance', figure=self._create_monthly_performance_chart(trading_data)),
                dcc.Graph(id='risk-metrics', figure=self._create_risk_metrics_chart(report)),
            ], style={'display': 'flex'}),
            
            # Performance table
            html.Div([
                html.H3("Detailed Metrics"),
                dash_table.DataTable(
                    id='metrics-table',
                    data=self._create_metrics_table_data(report),
                    columns=[{"name": "Metric", "id": "metric"}, 
                            {"name": "Value", "id": "value"},
                            {"name": "Benchmark", "id": "benchmark"},
                            {"name": "Status", "id": "status"}],
                    style_cell={'textAlign': 'left'},
                    style_data_conditional=[
                        {
                            'if': {'filter_query': '{status} = ✅'},
                            'backgroundColor': '#d4edda',
                        },
                        {
                            'if': {'filter_query': '{status} = ❌'},
                            'backgroundColor': '#f8d7da',
                        }
                    ]
                )
            ], style={'margin': 20})
        ])
        
        return app
    
    def _calculate_sortino_ratio(self, returns: pd.Series) -> float:
        """Calculate Sortino ratio (downside deviation)"""
        negative_returns = returns[returns < 0]
        downside_deviation = negative_returns.std() * np.sqrt(252)
        return (returns.mean() * 252) / downside_deviation if downside_deviation > 0 else 0
    
    def _calculate_calmar_ratio(self, trading_data: pd.DataFrame) -> float:
        """Calculate Calmar ratio (return / max drawdown)"""
        annual_return = trading_data['profit'].sum() / len(trading_data) * 252
        cumulative_profit = trading_data['profit'].cumsum()
        peak = cumulative_profit.expanding().max()
        drawdown = (cumulative_profit - peak) / peak
        max_drawdown = abs(drawdown.min())
        return annual_return / max_drawdown if max_drawdown > 0 else 0
    
    def _calculate_omega_ratio(self, returns: pd.Series) -> float:
        """Calculate Omega ratio"""
        threshold = 0
        gains = returns[returns > threshold].sum()
        losses = abs(returns[returns <= threshold].sum())
        return gains / losses if losses > 0 else np.inf
    
    def _calculate_hit_ratio(self, trading_data: pd.DataFrame) -> float:
        """Calculate hit ratio (profitable trades vs total trades)"""
        return len(trading_data[trading_data['profit'] > 0]) / len(trading_data)
    
    def _calculate_avg_trade_duration(self, trading_data: pd.DataFrame) -> float:
        """Calculate average trade duration in hours"""
        if 'duration' in trading_data.columns:
            return trading_data['duration'].mean()
        else:
            # Estimate based on timestamp differences
            time_diffs = trading_data.index.to_series().diff().dt.total_seconds() / 3600
            return time_diffs.mean()
    
    def _calculate_monthly_consistency(self, trading_data: pd.DataFrame) -> float:
        """Calculate monthly win rate consistency"""
        trading_data['month'] = trading_data.index.to_period('M')
        monthly_profits = trading_data.groupby('month')['profit'].sum()
        profitable_months = len(monthly_profits[monthly_profits > 0])
        return profitable_months / len(monthly_profits) if len(monthly_profits) > 0 else 0
    
    def _calculate_kelly_criterion(self, trading_data: pd.DataFrame) -> float:
        """Calculate Kelly criterion for optimal position sizing"""
        wins = trading_data[trading_data['profit'] > 0]['profit']
        losses = trading_data[trading_data['profit'] <= 0]['profit']
        
        if len(wins) == 0 or len(losses) == 0:
            return 0
        
        win_rate = len(wins) / len(trading_data)
        avg_win = wins.mean()
        avg_loss = abs(losses.mean())
        
        if avg_loss == 0:
            return 0
        
        win_loss_ratio = avg_win / avg_loss
        kelly = win_rate - (1 - win_rate) / win_loss_ratio
        return max(0, kelly)  # Ensure non-negative
    
    def _analyze_market_timing(self, trading_data: pd.DataFrame) -> Dict:
        """Analyze market timing effectiveness"""
        trading_data['hour'] = trading_data.index.hour
        trading_data['day_of_week'] = trading_data.index.dayofweek
        
        hourly_performance = trading_data.groupby('hour')['profit'].agg(['mean', 'count'])
        daily_performance = trading_data.groupby('day_of_week')['profit'].agg(['mean', 'count'])
        
        best_hour = hourly_performance['mean'].idxmax()
        worst_hour = hourly_performance['mean'].idxmin()
        best_day = daily_performance['mean'].idxmax()
        
        return {
            'best_trading_hour': best_hour,
            'worst_trading_hour': worst_hour,
            'best_trading_day': best_day,
            'hourly_performance': hourly_performance.to_dict(),
            'daily_performance': daily_performance.to_dict()
        }
    
    def _analyze_execution_quality(self, trading_data: pd.DataFrame) -> Dict:
        """Analyze execution quality and slippage"""
        if 'expected_price' in trading_data.columns and 'actual_price' in trading_data.columns:
            slippage = trading_data['actual_price'] - trading_data['expected_price']
            avg_slippage = slippage.mean()
            slippage_std = slippage.std()
            
            return {
                'avg_slippage': avg_slippage,
                'slippage_volatility': slippage_std,
                'positive_slippage_rate': len(slippage[slippage > 0]) / len(slippage)
            }
        else:
            return {'avg_slippage': 0, 'slippage_volatility': 0, 'positive_slippage_rate': 0}
    
    def _compare_to_benchmarks(self, kpis: Dict) -> Dict:
        """Compare KPIs to benchmarks"""
        comparison = {}
        for metric, benchmark in self.benchmarks.items():
            if metric in kpis:
                actual = kpis[metric]
                if metric == 'max_drawdown':
                    comparison[metric] = {
                        'actual': actual,
                        'benchmark': benchmark,
                        'status': '✅' if actual > benchmark else '❌',  # Less negative is better
                        'difference': actual - benchmark
                    }
                else:
                    comparison[metric] = {
                        'actual': actual,
                        'benchmark': benchmark,
                        'status': '✅' if actual >= benchmark else '❌',
                        'difference': actual - benchmark
                    }
        return comparison
    
    def _analyze_performance_trends(self, trading_data: pd.DataFrame) -> Dict:
        """Analyze performance trends over time"""
        trading_data['month'] = trading_data.index.to_period('M')
        monthly_data = trading_data.groupby('month').agg({
            'profit': ['sum', 'mean', 'count'],
            'roi': 'mean' if 'roi' in trading_data.columns else lambda x: 0
        }).round(2)
        
        # Calculate trend
        months = range(len(monthly_data))
        profits = monthly_data[('profit', 'sum')].values
        trend_slope = np.polyfit(months, profits, 1)[0] if len(months) > 1 else 0
        
        return {
            'monthly_data': monthly_data,
            'trend_slope': trend_slope,
            'trend_direction': 'improving' if trend_slope > 0 else 'declining',
            'best_month': monthly_data[('profit', 'sum')].idxmax(),
            'worst_month': monthly_data[('profit', 'sum')].idxmin()
        }
    
    def _comprehensive_risk_analysis(self, trading_data: pd.DataFrame) -> Dict:
        """Comprehensive risk analysis"""
        returns = trading_data['profit'].pct_change().dropna()
        
        # VaR calculations
        var_95 = np.percentile(returns, 5)
        var_99 = np.percentile(returns, 1)
        
        # Stress testing
        worst_day = returns.min()
        worst_week = returns.rolling(5).sum().min()
        worst_month = returns.rolling(20).sum().min()
        
        # Correlation analysis (if multiple strategies)
        correlation_matrix = trading_data[['profit']].corr() if len(trading_data.columns) > 1 else None
        
        return {
            'var_95': var_95,
            'var_99': var_99,
            'worst_day': worst_day,
            'worst_week': worst_week,
            'worst_month': worst_month,
            'return_skewness': returns.skew(),
            'return_kurtosis': returns.kurtosis(),
            'correlation_matrix': correlation_matrix
        }
    
    def _analyze_strategy_effectiveness(self, trading_data: pd.DataFrame) -> Dict:
        """Analyze strategy effectiveness"""
        # Trade size analysis
        if 'trade_size' in trading_data.columns:
            size_performance = trading_data.groupby(
                pd.cut(trading_data['trade_size'], bins=5, labels=['Small', 'Medium-Small', 'Medium', 'Medium-Large', 'Large'])
            )['profit'].agg(['mean', 'count'])
        else:
            size_performance = None
        
        # Market condition analysis
        trading_data['volatility_regime'] = pd.cut(
            trading_data['profit'].rolling(10).std(),
            bins=3,
            labels=['Low Vol', 'Medium Vol', 'High Vol']
        )
        
        volatility_performance = trading_data.groupby('volatility_regime')['profit'].agg(['mean', 'count'])
        
        return {
            'size_performance': size_performance,
            'volatility_performance': volatility_performance,
            'strategy_consistency': trading_data['profit'].std() / trading_data['profit'].mean()
        }
    
    def _calculate_overall_score(self, core_kpis: Dict, advanced_metrics: Dict) -> float:
        """Calculate overall strategy score (0-100)"""
        scores = []
        
        # Profitability score (30%)
        profit_score = min(100, max(0, core_kpis['total_profit'] / 10000 * 100))
        scores.append(profit_score * 0.3)
        
        # Risk-adjusted return score (25%)
        sharpe_score = min(100, max(0, core_kpis['sharpe_ratio'] / 3 * 100))
        scores.append(sharpe_score * 0.25)
        
        # Consistency score (20%)
        win_rate_score = core_kpis['win_rate'] * 100
        scores.append(win_rate_score * 0.2)
        
        # Risk control score (15%)
        drawdown_score = max(0, (1 + core_kpis['max_drawdown']) * 100)  # Less negative is better
        scores.append(drawdown_score * 0.15)
        
        # Efficiency score (10%)
        profit_factor_score = min(100, core_kpis['profit_factor'] / 3 * 100)
        scores.append(profit_factor_score * 0.1)
        
        return sum(scores)
    
    def _create_kpi_card(self, title: str, value: str, color: str) -> html.Div:
        """Create KPI card for dashboard"""
        return html.Div([
            html.H4(title, style={'margin': 0, 'color': 'white'}),
            html.H2(value, style={'margin': 0, 'color': 'white'})
        ], style={
            'backgroundColor': color,
            'padding': 20,
            'borderRadius': 10,
            'textAlign': 'center',
            'width': '200px',
            'boxShadow': '0 4px 8px rgba(0,0,0,0.1)'
        })
    
    def _create_profit_chart(self, trading_data: pd.DataFrame) -> go.Figure:
        """Create cumulative profit chart"""
        cumulative_profit = trading_data['profit'].cumsum()
        
        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=trading_data.index,
            y=cumulative_profit,
            mode='lines',
            name='Cumulative Profit',
            line=dict(color='green', width=2)
        ))
        
        fig.update_layout(
            title='Cumulative Profit Over Time',
            xaxis_title='Date',
            yaxis_title='Profit (₹)',
            hovermode='x unified'
        )
        
        return fig
    
    def _create_drawdown_chart(self, trading_data: pd.DataFrame) -> go.Figure:
        """Create drawdown chart"""
        cumulative_profit = trading_data['profit'].cumsum()
        peak = cumulative_profit.expanding().max()
        drawdown = (cumulative_profit - peak) / peak * 100
        
        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=trading_data.index,
            y=drawdown,
            mode='lines',
            name='Drawdown',
            line=dict(color='red', width=2),
            fill='tonexty'
        ))
        
        fig.update_layout(
            title='Drawdown Analysis',
            xaxis_title='Date',
            yaxis_title='Drawdown (%)',
            hovermode='x unified'
        )
        
        return fig
    
    def _create_monthly_performance_chart(self, trading_data: pd.DataFrame) -> go.Figure:
        """Create monthly performance chart"""
        trading_data['month'] = trading_data.index.to_period('M')
        monthly_profits = trading_data.groupby('month')['profit'].sum()
        
        fig = go.Figure()
        fig.add_trace(go.Bar(
            x=[str(m) for m in monthly_profits.index],
            y=monthly_profits.values,
            name='Monthly Profit',
            marker_color=['green' if p > 0 else 'red' for p in monthly_profits.values]
        ))
        
        fig.update_layout(
            title='Monthly Performance',
            xaxis_title='Month',
            yaxis_title='Profit (₹)'
        )
        
        return fig
    
    def _create_risk_metrics_chart(self, report: Dict) -> go.Figure:
        """Create risk metrics radar chart"""
        metrics = ['Sharpe Ratio', 'Win Rate', 'Profit Factor', 'Sortino Ratio']
        values = [
            report['core_kpis']['sharpe_ratio'] / 3,  # Normalize to 0-1
            report['core_kpis']['win_rate'],
            min(1, report['core_kpis']['profit_factor'] / 3),
            report['advanced_metrics']['sortino_ratio'] / 3
        ]
        
        fig = go.Figure()
        fig.add_trace(go.Scatterpolar(
            r=values,
            theta=metrics,
            fill='toself',
            name='Current Strategy'
        ))
        
        fig.update_layout(
            polar=dict(
                radialaxis=dict(
                    visible=True,
                    range=[0, 1]
                )),
            title='Risk-Adjusted Performance Metrics'
        )
        
        return fig
    
    def _create_metrics_table_data(self, report: Dict) -> List[Dict]:
        """Create data for metrics table"""
        data = []
        
        # Core KPIs
        core_metrics = [
            ('Total Profit', f"₹{report['core_kpis']['total_profit']:,.0f}", "₹50,000", 
             '✅' if report['core_kpis']['total_profit'] > 50000 else '❌'),
            ('Win Rate', f"{report['core_kpis']['win_rate']:.1%}", "65%",
             '✅' if report['core_kpis']['win_rate'] > 0.65 else '❌'),
            ('Sharpe Ratio', f"{report['core_kpis']['sharpe_ratio']:.2f}", "1.5",
             '✅' if report['core_kpis']['sharpe_ratio'] > 1.5 else '❌'),
            ('Max Drawdown', f"{report['core_kpis']['max_drawdown']:.1%}", "-10%",
             '✅' if report['core_kpis']['max_drawdown'] > -0.10 else '❌'),
            ('Profit Factor', f"{report['core_kpis']['profit_factor']:.2f}", "1.8",
             '✅' if report['core_kpis']['profit_factor'] > 1.8 else '❌')
        ]
        
        for metric, value, benchmark, status in core_metrics:
            data.append({
                'metric': metric,
                'value': value,
                'benchmark': benchmark,
                'status': status
            })
        
        return data
    
    def export_performance_report(self, trading_data: pd.DataFrame, 
                                filepath: str = None) -> str:
        """Export comprehensive performance report to file"""
        report = self.generate_performance_report(trading_data)
        
        # Create detailed report
        report_text = f"""
P2P USDT ARBITRAGE PERFORMANCE REPORT
=====================================
Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

EXECUTIVE SUMMARY
-----------------
Overall Strategy Score: {report['summary_score']:.1f}/100

CORE PERFORMANCE METRICS
------------------------
Total Trades: {report['core_kpis']['total_trades']:,}
Win Rate: {report['core_kpis']['win_rate']:.1%}
Total Profit: ₹{report['core_kpis']['total_profit']:,.0f}
Average Profit per Trade: ₹{report['core_kpis']['avg_profit_per_trade']:.0f}
Return on Investment: {report['core_kpis']['roi']:.1f}%

RISK METRICS
------------
Sharpe Ratio: {report['core_kpis']['sharpe_ratio']:.2f}
Sortino Ratio: {report['advanced_metrics']['sortino_ratio']:.2f}
Calmar Ratio: {report['advanced_metrics']['calmar_ratio']:.2f}
Maximum Drawdown: {report['core_kpis']['max_drawdown']:.1%}
Volatility: {report['core_kpis']['volatility']:.1%}

TRADE ANALYSIS
--------------
Profit Factor: {report['core_kpis']['profit_factor']:.2f}
Average Win: ₹{report['core_kpis']['avg_win']:.0f}
Average Loss: ₹{report['core_kpis']['avg_loss']:.0f}
Kelly Criterion: {report['advanced_metrics']['kelly_criterion']:.1%}

BENCHMARK COMPARISON
-------------------
"""
        
        for metric, comparison in report['benchmark_comparison'].items():
            status = "✅ PASS" if comparison['status'] == '✅' else "❌ FAIL"
            report_text += f"{metric.replace('_', ' ').title()}: {comparison['actual']:.2f} vs {comparison['benchmark']:.2f} - {status}\n"
        
        # Save to file
        if filepath is None:
            filepath = f"/Users/srijan/Desktop/my-automation-project/performance_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        
        with open(filepath, 'w') as f:
            f.write(report_text)
        
        return filepath

# Example usage and main execution
def main():
    print("📊 P2P Trading Performance Dashboard")
    print("=" * 40)
    
    # Create sample trading data
    np.random.seed(42)
    dates = pd.date_range(start='2024-01-01', end='2024-03-31', freq='D')
    
    # Simulate realistic trading data
    base_profits = np.random.normal(200, 100, len(dates))  # Average ₹200 profit per trade
    profits = np.maximum(base_profits, -500)  # Cap max loss at ₹500
    
    # Add some winning/losing streaks
    for i in range(1, len(profits)):
        if np.random.random() < 0.3:  # 30% chance of streak
            profits[i] = profits[i-1] * 0.8 + np.random.normal(0, 50)
    
    trading_data = pd.DataFrame({
        'timestamp': dates,
        'profit': profits,
        'investment': np.random.normal(10000, 2000, len(dates)),
        'revenue': profits + np.random.normal(10000, 2000, len(dates)),
        'roi': profits / 10000 * 100
    })
    
    trading_data = trading_data.set_index('timestamp')
    
    # Initialize dashboard
    dashboard = PerformanceDashboard()
    
    # Generate performance report
    print("📈 Generating performance report...")
    report = dashboard.generate_performance_report(trading_data)
    
    # Display key metrics
    print(f"\n🎯 KEY PERFORMANCE INDICATORS")
    print("=" * 35)
    kpis = report['core_kpis']
    print(f"Overall Score: {report['summary_score']:.1f}/100")
    print(f"Total Profit: ₹{kpis['total_profit']:,.0f}")
    print(f"Win Rate: {kpis['win_rate']:.1%}")
    print(f"Sharpe Ratio: {kpis['sharpe_ratio']:.2f}")
    print(f"Max Drawdown: {kpis['max_drawdown']:.1%}")
    print(f"Profit Factor: {kpis['profit_factor']:.2f}")
    print(f"ROI: {kpis['roi']:.1f}%")
    
    print(f"\n📊 ADVANCED METRICS")
    print("=" * 20)
    advanced = report['advanced_metrics']
    print(f"Sortino Ratio: {advanced['sortino_ratio']:.2f}")
    print(f"Calmar Ratio: {advanced['calmar_ratio']:.2f}")
    print(f"Kelly Criterion: {advanced['kelly_criterion']:.1%}")
    print(f"Monthly Win Rate: {advanced['monthly_win_rate']:.1%}")
    
    print(f"\n⚖️ BENCHMARK COMPARISON")
    print("=" * 25)
    for metric, comp in report['benchmark_comparison'].items():
        status = comp['status']
        print(f"{metric.replace('_', ' ').title()}: {status} ({comp['actual']:.2f} vs {comp['benchmark']:.2f})")
    
    print(f"\n📈 TREND ANALYSIS")
    print("=" * 18)
    trends = report['trend_analysis']
    print(f"Performance Trend: {trends['trend_direction'].title()}")
    print(f"Trend Slope: ₹{trends['trend_slope']:.0f}/month")
    print(f"Best Month: {trends['best_month']}")
    print(f"Worst Month: {trends['worst_month']}")
    
    # Export report
    report_file = dashboard.export_performance_report(trading_data)
    print(f"\n💾 Performance report exported to: {report_file}")
    
    # Create visualizations
    print("\n🎨 Creating performance visualizations...")
    dashboard_app = dashboard.create_interactive_dashboard(trading_data)
    
    print(f"\n🚀 Dashboard created! Run 'python -c \"from performance_dashboard import *; main()\"' to view interactive dashboard")
    
    return report

if __name__ == "__main__":
    main()