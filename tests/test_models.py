import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from custom_components.household_stock.models import StockItem


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
