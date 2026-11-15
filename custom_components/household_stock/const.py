from __future__ import annotations

DOMAIN = "household_stock"
PLATFORMS = ["sensor", "binary_sensor", "button", "number", "text"]

CONF_AUTO_ADD_TO_SHOPPING_LIST = "auto_add_to_shopping_list"

SERVICE_ADD_ITEM = "add_item"
SERVICE_CONSUME_ITEM = "consume_item"
SERVICE_RESTOCK_ITEM = "restock_item"
SERVICE_SET_QUANTITY = "set_quantity"
SERVICE_UPDATE_ITEM = "update_item"
SERVICE_DELETE_ITEM = "delete_item"

ATTR_ITEM_ID = "item_id"
ATTR_NAME = "name"
ATTR_CATEGORY = "category"
ATTR_UNIT = "unit"
ATTR_QUANTITY = "quantity"
ATTR_LOW_STOCK_THRESHOLD = "low_stock_threshold"
ATTR_BARCODE = "barcode"
ATTR_LOCATION = "location"
ATTR_AUTO_ADD_TO_SHOPPING_LIST = "auto_add_to_shopping_list"

DEFAULT_LOW_STOCK_THRESHOLD = 1.0
STORAGE_VERSION = 1
STORAGE_KEY = f"{DOMAIN}.storage"
