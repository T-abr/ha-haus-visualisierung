import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parents[2]))  # custom_components importierbar
sys.path.insert(0, str(Path(__file__).parent))


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield
