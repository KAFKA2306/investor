import pytest
from ..risk_calculator import (
    kelly_criterion,
    calculate_var_95,
    validate_risk_constraints,
)


class TestKellyCriterion:
    def test_kelly_even_odds_50_percent_win(self):
        # Even odds (2.0), 50% win probability → 0 Kelly
        result = kelly_criterion(p=0.5, odds_decimal=2.0, alpha=1.0)
        assert result == 0.0

    def test_kelly_favorable_odds(self):
        # 60% win probability, 2.5 decimal odds, full Kelly
        result = kelly_criterion(p=0.6, odds_decimal=2.5, alpha=1.0)
        # Kelly: (0.6 * 1.5 - 0.4) / 1.5 = (0.9 - 0.4) / 1.5 = 0.5 / 1.5 = 0.333...
        assert pytest.approx(result, abs=0.01) == 0.333

    def test_kelly_fractional(self):
        # 60% win, 2.5 odds, 25% Kelly (alpha=0.25)
        result = kelly_criterion(p=0.6, odds_decimal=2.5, alpha=0.25)
        # 0.333 * 0.25 = 0.0833
        assert pytest.approx(result, abs=0.01) == 0.083

    def test_kelly_zero_probability(self):
        # 0% win probability
        result = kelly_criterion(p=0.0, odds_decimal=2.0, alpha=1.0)
        assert result == 0.0

    def test_kelly_certain_probability(self):
        # 100% win probability (edge case, should clamp)
        result = kelly_criterion(p=1.0, odds_decimal=2.0, alpha=1.0)
        assert result == 0.0

    def test_kelly_negative_odds(self):
        # Invalid odds (odds < 1 are nonsensical)
        result = kelly_criterion(p=0.6, odds_decimal=0.5, alpha=1.0)
        assert result == 0.0

    def test_kelly_bounds(self):
        # Very high edge: result should never exceed 1.0
        result = kelly_criterion(p=0.99, odds_decimal=10.0, alpha=1.0)
        assert result <= 1.0
        assert result >= 0.0


class TestCalculateVaR95:
    def test_var_mean_100_std_20(self):
        # Mean 100, StdDev 20
        result = calculate_var_95(mean=100, std_dev=20)
        # VaR = 100 - 1.645 * 20 = 100 - 32.9 = 67.1
        assert pytest.approx(result, abs=0.1) == 67.1

    def test_var_zero_mean(self):
        # Zero mean, 10 std dev
        result = calculate_var_95(mean=0, std_dev=10)
        # VaR = 0 - 1.645 * 10 = -16.45
        assert pytest.approx(result, abs=0.1) == -16.45

    def test_var_negative_returns(self):
        # Negative mean (losing scenario)
        result = calculate_var_95(mean=-5, std_dev=15)
        # VaR = -5 - 1.645 * 15 = -5 - 24.675 = -29.675
        assert pytest.approx(result, abs=0.1) == -29.675


class TestValidateRiskConstraints:
    def test_all_constraints_pass(self):
        result = validate_risk_constraints(
            kelly_fraction=0.05,
            bet_size=5000,
            var_95=-1000,
            bankroll=100000,
            max_exposure=50000,
            current_exposure=20000,
            max_daily_loss=-5000,
            max_drawdown_pct=0.05,
        )
        assert result["approved"] is True
        assert len(result["violations"]) == 0
        assert "All constraints passed" in result["reasoning"]

    def test_var_constraint_violated(self):
        result = validate_risk_constraints(
            kelly_fraction=0.05,
            bet_size=5000,
            var_95=-8000,  # Exceeds max_daily_loss
            bankroll=100000,
            max_exposure=50000,
            current_exposure=20000,
            max_daily_loss=-5000,
            max_drawdown_pct=0.05,
        )
        assert result["approved"] is False
        assert any("VaR" in v for v in result["violations"])

    def test_exposure_constraint_violated(self):
        result = validate_risk_constraints(
            kelly_fraction=0.05,
            bet_size=35000,  # 35k + 20k = 55k > 50k max
            var_95=-1000,
            bankroll=100000,
            max_exposure=50000,
            current_exposure=20000,
            max_daily_loss=-5000,
            max_drawdown_pct=0.05,
        )
        assert result["approved"] is False
        assert any("Exposure" in v for v in result["violations"])

    def test_drawdown_constraint_violated(self):
        result = validate_risk_constraints(
            kelly_fraction=0.05,
            bet_size=5000,
            var_95=-1000,
            bankroll=100000,
            max_exposure=50000,
            current_exposure=20000,
            max_daily_loss=-5000,
            max_drawdown_pct=0.15,  # Exceeds 8%
        )
        assert result["approved"] is False
        assert any("drawdown" in v for v in result["violations"])

    def test_negative_kelly_violation(self):
        result = validate_risk_constraints(
            kelly_fraction=-0.05,  # Negative Kelly
            bet_size=5000,
            var_95=-1000,
            bankroll=100000,
            max_exposure=50000,
            current_exposure=20000,
            max_daily_loss=-5000,
            max_drawdown_pct=0.05,
        )
        assert result["approved"] is False
        assert any("Negative Kelly" in v for v in result["violations"])

    def test_multiple_violations(self):
        result = validate_risk_constraints(
            kelly_fraction=-0.05,
            bet_size=35000,
            var_95=-8000,
            bankroll=100000,
            max_exposure=50000,
            current_exposure=20000,
            max_daily_loss=-5000,
            max_drawdown_pct=0.15,
        )
        assert result["approved"] is False
        assert len(result["violations"]) >= 3
