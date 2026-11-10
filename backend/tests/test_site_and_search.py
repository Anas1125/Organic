from tests.conftest import make_product

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64


def test_site_settings_defaults_and_admin_update(client, admin, buyer):
    r = client.get("/api/v1/site-settings")
    assert r.status_code == 200 and r.json()["site_name"] == "Terralens"

    body = {"site_name": "GreenRoots", "tagline": "Fresh from the farm"}
    assert client.put("/api/v1/admin/site-settings", json=body, headers=buyer).status_code == 403
    assert client.put("/api/v1/admin/site-settings", json=body).status_code == 401
    r = client.put("/api/v1/admin/site-settings", json=body, headers=admin)
    assert r.json()["site_name"] == "GreenRoots"
    assert client.get("/api/v1/site-settings").json()["tagline"] == "Fresh from the farm"
    assert client.put("/api/v1/admin/site-settings", json={"site_name": ""}, headers=admin).status_code == 422


def test_logo_upload_and_reset(client, admin):
    files = {"file": ("logo.svg", b"<svg onload=alert(1)>", "image/svg+xml")}
    assert client.post("/api/v1/admin/site-settings/logo", files=files, headers=admin).status_code == 400

    r = client.post("/api/v1/admin/site-settings/logo", files={"file": ("l.png", PNG, "image/png")}, headers=admin)
    url = r.json()["logo_url"]
    assert url.startswith("/media/site/")
    assert client.get(url).content == PNG

    r = client.delete("/api/v1/admin/site-settings/logo", headers=admin)
    assert r.json()["logo_url"] is None
    assert client.get(url).status_code == 404


def test_search_suggestions(client, seller, admin, category):
    make_product(client, seller, admin, category, name="Black Rice")
    make_product(client, seller, admin, category, name="Ragi Flour", price_tiers=[])
    make_product(client, seller, admin, category, name="Brown Rice Flakes", approve=False)

    r = client.get("/api/v1/products/suggest?q=ri").json()
    names = [p["name"] for p in r["products"]]
    assert "Black Rice" in names and "Brown Rice Flakes" not in names  # unapproved hidden
    assert r["categories"][0]["slug"] == "rice-grains"

    # names that start with the text are listed first
    assert client.get("/api/v1/products/suggest?q=ra").json()["products"][0]["name"] == "Ragi Flour"
    assert client.get("/api/v1/products/suggest?q=").status_code == 422


def test_contact_details_saved_and_optional(client, admin):
    body = {"site_name": "Terralens", "contact_email": "hello@example.com",
            "contact_phone": "+91 98765 43210", "contact_hours": "",
            "locations": ["Chennai, Tamil Nadu", "  ", "Kochi, Kerala"]}
    r = client.put("/api/v1/admin/site-settings", json=body, headers=admin)
    assert r.status_code == 200, r.text
    s = client.get("/api/v1/site-settings").json()
    assert s["contact_phone"] == "+91 98765 43210"
    assert s["contact_hours"] is None          # blank → not shown
    assert s["locations"] == ["Chennai, Tamil Nadu", "Kochi, Kerala"]  # empty rows dropped

    # clearing everything is allowed
    r = client.put("/api/v1/admin/site-settings", json={"site_name": "Terralens"}, headers=admin)
    assert r.json()["contact_email"] is None and r.json()["locations"] == []


def test_contact_details_validated(client, admin):
    bad = [{"contact_email": "not-an-email"}, {"contact_phone": "call me"},
           {"locations": ["x" * 201]}, {"locations": ["a"] * 11}]
    for extra in bad:
        r = client.put("/api/v1/admin/site-settings", json={"site_name": "T", **extra}, headers=admin)
        assert r.status_code == 422, extra
