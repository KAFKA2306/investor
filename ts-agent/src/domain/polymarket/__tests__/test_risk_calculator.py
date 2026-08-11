import pytest

from ..risk_calculator import (
    calculate_var_95,
    kelly_criterion,
    validate_risk_constraints,
)


class TestKellyCriterion:
    def test_kelly_even_odds_50_percent_win(self):
        result = kelly_criterion(p=0.5, odds_decimal=2.0, alpha=1.0)
        assert result == 0.0

    def test_kelly_favorable_odds(self):
        result = kelly_criterion(p=0.6, odds_decimal=2.5, alpha=1.0)
        assert pytest.approx(result, abs=0.01) == 0.333

    def test_kelly_fractional(self):
        result = kelly_criterion(p=0.6, odds_decimal=2.5, alpha=0.25)
        assert pytest.approx(result, abs=0.01) == 0.083

    def test_kelly_zero_probability(self):
        result = kelly_criterion(p=0.0, odds_decimal=2.0, alpha=1.0)
        assert result == 0.0

    def test_kelly_certain_probability(self):
        result = kelly_criterion(p=1.0, odds_decimal=2.0, alpha=1.0)
        assert result == 0.0

    def test_kelly_negative_odds(self):
        result = kelly_criterion(p=0.6, odds_decimal=0.5, alpha=1.0)
        assert result == 0.0

    def test_kelly_bounds(self):
        result = kelly_criterion(p=0.99, odds_decimal=10.0, alpha=1.0)
        assert result <= 1.0
        assert result >= 0.0


class TestCalculateVaR95:
    def test_var_mean_100_std_20(self):
        result = calculate_var_95(mean=100, std_dev=20)
        assert pytest.approx(result, abs=0.1) == 67.1

    def test_var_zero_mean(self):
        result = calculate_var_95(mean=0, std_dev=10)
        assert pytest.approx(result, abs=0.1) == -16.45

    def test_var_negative_returns(self):
        result = calculate_var_95(mean=-5, std_dev=15)
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
            var_95=-8000,
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
            bet_size=35000,
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
            max_drawdown_pct=0.15,
        )
        assert result["approved"] is False
        assert any("drawdown" in v for v in result["violations"])

    def test_negative_kelly_violation(self):
        result = validate_risk_constraints(
            kelly_fraction=-0.05,
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
