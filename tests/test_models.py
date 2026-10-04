import importlib.util
import sys
from pathlib import Path

MODELS_PATH = (
    Path(__file__).resolve().parents[1]
    / "custom_components"
    / "household_stock"
    / "models.py"
)

spec = importlib.util.spec_from_file_location("household_stock_models", MODELS_PATH)
assert spec is not None
assert spec.loader is not None
models = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = models
spec.loader.exec_module(models)

StockItem = models.StockItem


def test_low_stock_boundary() -> None:
    item = StockItem(item_id="1", name="Milk", quantity=1, low_stock_threshold=1)
    assert item.is_low_stock


def test_not_low_stock_above_threshold() -> None:
    item = StockItem(item_id="1", name="Milk", quantity=2, low_stock_threshold=1)
    assert not item.is_low_stock


def test_round_trip_preserves_shopping_list_metadata() -> None:
    item = StockItem(
        item_id="1",
        name="Milk",
        shopping_list_item="Semi-skimmed milk",
        auto_add_to_shopping_list=False,
    )
    restored = StockItem.from_dict(item.to_dict())
    assert restored.shopping_list_item == "Semi-skimmed milk"
    assert restored.auto_add_to_shopping_list is False
