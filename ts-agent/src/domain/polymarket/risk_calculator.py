def kelly_criterion(p: float, odds_decimal: float, alpha: float = 0.25) -> float:
    """
    Calculate fractional Kelly criterion bet sizing.

    Args:
        p: Probability of success (0-1)
        odds_decimal: Decimal odds from market price
        alpha: Fractional reduction (0.25-0.5 for safety)

    Returns:
        Fraction of bankroll to bet
    """
    if p <= 0 or p >= 1:
        return 0.0

    b = odds_decimal - 1
    if b <= 0:
        return 0.0

    kelly_full = (p * b - (1 - p)) / b
    kelly_fractional = alpha * kelly_full

    return max(0.0, min(kelly_fractional, 1.0))


def calculate_var_95(mean: float, std_dev: float) -> float:
    """
    Calculate Value at Risk at 95% confidence level.

    Args:
        mean: Expected return
        std_dev: Standard deviation

    Returns:
        Maximum loss (95% confidence)
    """
    z_score = 1.645
    var = mean - (z_score * std_dev)
    return var


def validate_risk_constraints(
    kelly_fraction: float,
    bet_size: float,
    var_95: float,
    bankroll: float,
    max_exposure: float,
    current_exposure: float,
    max_daily_loss: float,
    max_drawdown_pct: float,
) -> dict:
    """
    Validate all risk constraints.

    Returns:
        {
            'approved': bool,
            'violations': [list of constraint violations],
            'reasoning': str
        }
    """
    violations = []

    if var_95 < max_daily_loss:
        violations.append(f"VaR {var_95:.2f} < daily limit {max_daily_loss:.2f}")

    if current_exposure + bet_size > max_exposure:
        violations.append(
            f"Exposure {current_exposure + bet_size:.2f} > max {max_exposure:.2f}"
        )

    if max_drawdown_pct > 0.08:
        violations.append(f"Max drawdown {max_drawdown_pct:.2%} > 8%")

    if kelly_fraction < 0:
        violations.append("Negative Kelly fraction (no edge)")

    approved = len(violations) == 0
    reasoning = "; ".join(violations) if violations else "All constraints passed"

    return {
        "approved": approved,
        "violations": violations,
        "reasoning": reasoning,
    }
