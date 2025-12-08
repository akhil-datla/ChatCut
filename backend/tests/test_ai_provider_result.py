"""
Tests for the AIProviderResult helper class to ensure consistent serialization.
"""

from services.ai_provider import AIProviderResult


def test_success_helper_includes_defaults():
    result = AIProviderResult.success("zoomIn", {"endScale": 120}, message="Zooming")
    as_dict = result.to_dict()

    assert as_dict["action"] == "zoomIn"
    assert as_dict["parameters"] == {"endScale": 120}
    assert as_dict["message"] == "Zooming"
    assert as_dict["confidence"] == 1.0
    assert as_dict["error"] is None


def test_success_multiple_tracks_actions_list():
    actions = [{"action": "applyFilter", "parameters": {"filterName": "BW"}}]
    result = AIProviderResult.success_multiple(actions, message="Multiple")
    as_dict = result.to_dict()

    assert as_dict["action"] is None
    assert as_dict["actions"] == actions
    assert as_dict["message"] == "Multiple"
    assert as_dict["confidence"] == 1.0


def test_failure_sets_error_and_zero_confidence():
    result = AIProviderResult.failure("oops", error="FAIL")
    as_dict = result.to_dict()

    assert as_dict["action"] is None
    assert as_dict["parameters"] == {}
    assert as_dict["confidence"] == 0.0
    assert as_dict["error"] == "FAIL"
