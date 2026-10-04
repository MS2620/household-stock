class HouseholdStockCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._search = "";
    this._showAdd = false;
    this._editing = null;
    this._renderScheduled = false;
  }

  setConfig(config) {
    this._config = {
      title: "Household Stock",
      sort: "name",
      ...config,
    };
    if (this._hass) this._render();
  }

  set hass(hass) {
    this._hass = hass;

    // HA may update the card during the pointer/focus event that opened an
    // input. Rendering synchronously here can replace the input before the
    // browser finishes focusing it. Defer the render until the event settles,
    // then leave the DOM alone while an input is actively being edited.
    if (this._renderScheduled) return;
    this._renderScheduled = true;
    setTimeout(() => {
      this._renderScheduled = false;

      const active = this.shadowRoot?.activeElement;
      if (
        active &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName)
      ) {
        return;
      }

      this._render();
    }, 0);
  }

  getCardSize() {
    return 5;
  }

  static getStubConfig() {
    return { title: "Household Stock" };
  }

  static getConfigForm() {
    return {
      schema: [
        { name: "title", selector: { text: {} } },
        {
          name: "sort",
          selector: {
            select: {
              options: [
                { value: "name", label: "Name" },
                { value: "quantity", label: "Quantity" },
                { value: "low_stock", label: "Low stock first" },
              ],
            },
          },
        },
      ],
    };
  }

  _items() {
    if (!this._hass) return [];
    const items = Object.values(this._hass.states)
      .filter(
        (state) =>
          state.entity_id.startsWith("sensor.") &&
          state.attributes?.item_id
      )
      .map((state) => ({
        entityId: state.entity_id,
        itemId: state.attributes.item_id,
        name: state.attributes.friendly_name?.replace(/ Quantity$/, "") ||
          state.attributes.item_name ||
          state.entity_id,
        quantity: Number(state.state) || 0,
        unit: state.attributes.unit_of_measurement || "item",
        category: state.attributes.category || "Other",
        threshold: Number(state.attributes.low_stock_threshold) || 0,
        lowStock: Boolean(state.attributes.low_stock),
        barcode: state.attributes.barcode || "",
        location: state.attributes.location || "",
        shoppingListItem: state.attributes.shopping_list_item || "",
        autoShopping: state.attributes.auto_add_to_shopping_list !== false,
      }));

    const query = this._search.trim().toLowerCase();
    const filtered = query
      ? items.filter(
          (item) =>
            item.name.toLowerCase().includes(query) ||
            item.category.toLowerCase().includes(query) ||
            item.location.toLowerCase().includes(query) ||
            item.barcode.toLowerCase().includes(query)
        )
      : items;

    return filtered.sort((a, b) => {
      if (this._config.sort === "quantity") return a.quantity - b.quantity;
      if (this._config.sort === "low_stock") {
        return Number(b.lowStock) - Number(a.lowStock) || a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });
  }

  async _call(service, data) {
    await this._hass.callService("household_stock", service, data);
  }

  _esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  _render() {
    if (!this._hass || !this._config) return;

    const items = this._items();
    const low = items.filter((item) => item.lowStock).length;
    const total = items.reduce((sum, item) => sum + item.quantity, 0);

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { overflow: hidden; }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          gap: 12px;
        }
        .title { font-size: 20px; font-weight: 500; }
        .summary { color: var(--secondary-text-color); font-size: 13px; margin-top: 4px; }
        .toolbar {
          display: flex;
          gap: 8px;
          padding: 0 16px 12px;
        }
        input, select {
          box-sizing: border-box;
          width: 100%;
          min-height: 40px;
          padding: 8px 10px;
          border: 1px solid var(--divider-color);
          border-radius: 8px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          font: inherit;
        }
        .search { flex: 1; }
        button {
          min-height: 40px;
          border: 0;
          border-radius: 8px;
          padding: 8px 12px;
          background: var(--primary-color);
          color: var(--text-primary-color);
          font: inherit;
          cursor: pointer;
        }
        button.secondary {
          background: var(--secondary-background-color);
          color: var(--primary-text-color);
        }
        button.danger { color: var(--error-color); }
        .items { padding: 0 8px 8px; }
        .item {
          border-top: 1px solid var(--divider-color);
          padding: 12px 8px;
        }
        .item.low { border-left: 4px solid var(--error-color); padding-left: 4px; }
        .row { display: flex; align-items: center; gap: 8px; }
        .item-name { flex: 1; font-weight: 500; }
        .quantity { font-size: 18px; font-variant-numeric: tabular-nums; }
        .meta { color: var(--secondary-text-color); font-size: 12px; margin: 4px 0 8px; }
        .actions { display: flex; gap: 6px; flex-wrap: wrap; }
        .actions button { min-width: 44px; padding: 6px 10px; min-height: 36px; }
        .details {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 8px;
          margin-top: 10px;
        }
        .details label { font-size: 12px; color: var(--secondary-text-color); }
        .details input { margin-top: 3px; }
        .form {
          margin: 0 16px 16px;
          padding: 12px;
          border: 1px solid var(--divider-color);
          border-radius: 10px;
          background: var(--secondary-background-color);
        }
        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 8px;
        }
        .form label { font-size: 12px; color: var(--secondary-text-color); }
        .form input { margin-top: 3px; background: var(--card-background-color); }
        .form-actions { display: flex; gap: 8px; margin-top: 10px; }
        .empty { padding: 24px 16px; text-align: center; color: var(--secondary-text-color); }
        .badge {
          display: inline-block;
          margin-left: 6px;
          padding: 2px 6px;
          border-radius: 999px;
          background: var(--error-color);
          color: var(--text-primary-color);
          font-size: 11px;
          font-weight: 500;
        }
      </style>
      <ha-card>
        <div class="header">
          <div>
            <div class="title">${this._esc(this._config.title)}</div>
            <div class="summary">${items.length} items · ${total} total units · ${low} low stock</div>
          </div>
          <button id="add">Add item</button>
        </div>
        <div class="toolbar">
          <input class="search" id="search" placeholder="Search inventory" value="${this._esc(this._search)}">
        </div>
        ${this._showAdd ? this._addForm() : ""}
        <div class="items">
          ${items.length ? items.map((item) => this._itemTemplate(item)).join("") : '<div class="empty">No inventory items found.</div>'}
        </div>
      </ha-card>
    `;

    this.shadowRoot.getElementById("add")?.addEventListener("click", () => {
      this._showAdd = !this._showAdd;
      this._render();
    });

    this.shadowRoot.getElementById("search")?.addEventListener("input", (event) => {
      this._search = event.target.value;
      this._render();
      const input = this.shadowRoot.getElementById("search");
      input?.focus();
      if (input) input.selectionStart = input.selectionEnd = this._search.length;
    });

    this._wireAddForm();
    this._wireItems();
  }

  _addForm() {
    return `
      <form class="form" id="add-form">
        <div class="form-grid">
          <label>Name<input name="name" required maxlength="255"></label>
          <label>Category<input name="category" value="Other"></label>
          <label>Unit<input name="unit" value="item"></label>
          <label>Quantity<input name="quantity" type="number" min="0" step="any" value="0"></label>
          <label>Low-stock threshold<input name="threshold" type="number" min="0" step="any" value="1"></label>
          <label>Barcode<input name="barcode"></label>
          <label>Location<input name="location"></label>
          <label>Shopping-list name<input name="shopping_list_item"></label>
        </div>
        <label style="display:block;margin-top:8px;">
          <input name="auto_shopping" type="checkbox" checked style="width:auto;min-height:auto;"> Automatically manage shopping list
        </label>
        <div class="form-actions">
          <button type="submit">Add</button>
          <button type="button" class="secondary" id="cancel-add">Cancel</button>
        </div>
      </form>
    `;
  }

  _wireAddForm() {
    const form = this.shadowRoot.getElementById("add-form");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const serviceData = {
        name: data.get("name"),
        category: data.get("category") || "Other",
        unit: data.get("unit") || "item",
        quantity: Number(data.get("quantity") || 0),
        low_stock_threshold: Number(data.get("threshold") || 1),
        auto_add_to_shopping_list: data.get("auto_shopping") !== null,
      };
      for (const key of ["barcode", "location", "shopping_list_item"]) {
        const value = data.get(key);
        if (value) serviceData[key] = value;
      }
      await this._call("add_item", serviceData);
      this._showAdd = false;
      this._render();
    });
    this.shadowRoot.getElementById("cancel-add")?.addEventListener("click", () => {
      this._showAdd = false;
      this._render();
    });
  }

  _itemTemplate(item) {
    const editing = this._editing === item.itemId;
    const lowBadge = item.lowStock ? '<span class="badge">LOW</span>' : "";
    return `
      <div class="item ${item.lowStock ? "low" : ""}" data-item-id="${this._esc(item.itemId)}">
        <div class="row">
          <div class="item-name">${this._esc(item.name)}${lowBadge}</div>
          <div class="quantity">${this._esc(item.quantity)} ${this._esc(item.unit)}</div>
        </div>
        <div class="meta">
          ${this._esc(item.category)}
          ${item.location ? " · " + this._esc(item.location) : ""}
          · threshold ${this._esc(item.threshold)}
        </div>
        <div class="actions">
          <button class="secondary" data-action="consume">−1</button>
          <button class="secondary" data-action="restock">+1</button>
          <button class="secondary" data-action="edit">${editing ? "Close" : "Edit"}</button>
          <button class="secondary danger" data-action="delete">Delete</button>
        </div>
        ${editing ? this._editForm(item) : ""}
      </div>
    `;
  }

  _editForm(item) {
    return `
      <form class="details edit-form">
        <label>Name<input name="name" value="${this._esc(item.name)}" required></label>
        <label>Category<input name="category" value="${this._esc(item.category)}"></label>
        <label>Unit<input name="unit" value="${this._esc(item.unit)}"></label>
        <label>Quantity<input name="quantity" type="number" min="0" step="any" value="${this._esc(item.quantity)}"></label>
        <label>Threshold<input name="threshold" type="number" min="0" step="any" value="${this._esc(item.threshold)}"></label>
        <label>Barcode<input name="barcode" value="${this._esc(item.barcode)}"></label>
        <label>Location<input name="location" value="${this._esc(item.location)}"></label>
        <label>Shopping-list name<input name="shopping_list_item" value="${this._esc(item.shoppingListItem)}"></label>
        <label style="grid-column:1/-1;">
          <input name="auto_shopping" type="checkbox" ${item.autoShopping ? "checked" : ""} style="width:auto;min-height:auto;"> Automatically manage shopping list
        </label>
        <button type="submit">Save changes</button>
      </form>
    `;
  }

  _wireItems() {
    this.shadowRoot.querySelectorAll(".item").forEach((element) => {
      const itemId = element.dataset.itemId;
      element.querySelectorAll("[data-action]").forEach((button) => {
        button.addEventListener("click", async () => {
          const action = button.dataset.action;
          if (action === "consume") {
            await this._call("consume_item", { item_id: itemId, quantity: 1 });
          } else if (action === "restock") {
            await this._call("restock_item", { item_id: itemId, quantity: 1 });
          } else if (action === "delete") {
            if (!window.confirm("Delete this inventory item?")) return;
            await this._call("delete_item", { item_id: itemId });
          } else if (action === "edit") {
            this._editing = this._editing === itemId ? null : itemId;
          }
          this._render();
        });
      });

      const form = element.querySelector(".edit-form");
      if (!form) return;
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const changes = {
          item_id: itemId,
          name: data.get("name"),
          category: data.get("category"),
          unit: data.get("unit"),
          low_stock_threshold: Number(data.get("threshold") || 0),
          auto_add_to_shopping_list: data.get("auto_shopping") !== null,
        };
        const quantity = Number(data.get("quantity") || 0);
        for (const key of ["barcode", "location", "shopping_list_item"]) {
          const value = data.get(key);
          changes[key] = value || "";
        }
        await this._call("update_item", changes);
        await this._call("set_quantity", { item_id: itemId, quantity });
        this._editing = null;
        this._render();
      });
    });
  }
}

customElements.define("household-stock-card", HouseholdStockCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "household-stock-card",
  name: "Household Stock",
  description: "Manage native Home Assistant inventory items.",
  preview: false,
});
