"""Saved delivery addresses."""

HOME = {"label": "Shop", "shipping_name": "Priya", "shipping_phone": "9876543210", "shipping_address": "12 Main Street",
        "shipping_city": "Chennai", "shipping_state": "Tamil Nadu", "shipping_pincode": "600001"}
GODOWN = {**HOME, "label": "Godown", "shipping_address": "4 Port Road", "shipping_pincode": "600002"}


def test_save_list_default_delete(client, buyer, seller):
    first = client.post("/api/v1/addresses", json=HOME, headers=buyer).json()
    assert first["is_default"] is True  # first one becomes default
    second = client.post("/api/v1/addresses", json=GODOWN, headers=buyer).json()
    assert second["is_default"] is False
    # Saving the same address again doesn't duplicate it
    again = client.post("/api/v1/addresses", json={**HOME, "shipping_city": "chennai"}, headers=buyer).json()
    assert again["id"] == first["id"]
    assert len(client.get("/api/v1/addresses", headers=buyer).json()) == 2

    # Make the second default; it's listed first
    client.put(f"/api/v1/addresses/{second['id']}", json={**GODOWN, "is_default": True}, headers=buyer)
    rows = client.get("/api/v1/addresses", headers=buyer).json()
    assert rows[0]["id"] == second["id"] and rows[0]["is_default"] and not rows[1]["is_default"]

    # Deleting the default promotes another
    assert client.delete(f"/api/v1/addresses/{second['id']}", headers=buyer).status_code == 204
    rows = client.get("/api/v1/addresses", headers=buyer).json()
    assert len(rows) == 1 and rows[0]["is_default"]

    # Validation, and other users can't see or touch them
    assert client.post("/api/v1/addresses", json={**HOME, "shipping_pincode": "12"}, headers=buyer).status_code == 422
    assert client.get("/api/v1/addresses", headers=seller).status_code == 403


def test_other_buyers_addresses_are_private(client, buyer):
    from tests.conftest import register

    other, _ = register(client, "other@test.io")
    a = client.post("/api/v1/addresses", json=HOME, headers=buyer).json()
    assert client.get("/api/v1/addresses", headers=other).json() == []
    assert client.put(f"/api/v1/addresses/{a['id']}", json=HOME, headers=other).status_code == 404
    assert client.delete(f"/api/v1/addresses/{a['id']}", headers=other).status_code == 404
