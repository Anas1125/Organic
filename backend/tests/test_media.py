"""Product video (link or short upload), extra photos and key points."""

from tests.conftest import make_product, real_png

MP4 = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 200


def test_video_links_parsed(client, seller, admin, category):
    pid = make_product(client, seller, admin, category)
    base = f"/api/v1/seller/products/{pid}/video"
    r = client.put(base, json={"url": "https://youtu.be/dQw4w9WgXcQ"}, headers=seller)
    v = r.json()["video"]
    assert v["kind"] == "youtube" and v["embed_url"].endswith("/embed/dQw4w9WgXcQ")
    r = client.put(base, json={"url": "https://vimeo.com/76979871"}, headers=seller)
    assert r.json()["video"]["embed_url"] == "https://player.vimeo.com/video/76979871"
    assert client.put(base, json={"url": "https://example.com/page.html"}, headers=seller).status_code == 422
    # Shown to buyers on the public product page
    assert client.get(f"/api/v1/products/{pid}").json()["video"]["kind"] == "vimeo"
    assert client.delete(base, headers=seller).json()["video"] is None


def test_video_upload_and_range(client, seller, admin, category):
    pid = make_product(client, seller, admin, category)
    up = f"/api/v1/seller/products/{pid}/video/upload"
    bad = client.post(up, files={"file": ("v.mp4", b"not a video at all", "video/mp4")}, headers=seller)
    assert bad.status_code == 400
    r = client.post(up, files={"file": ("v.mp4", MP4, "video/mp4")}, headers=seller)
    url = r.json()["video"]["url"]
    assert r.json()["video"]["kind"] == "file" and url.endswith(".mp4")
    whole = client.get(url)
    assert whole.status_code == 200 and whole.headers["content-type"] == "video/mp4"
    part = client.get(url, headers={"Range": "bytes=0-9"})
    assert part.status_code == 206 and part.content == MP4[:10]
    assert part.headers["content-range"] == f"bytes 0-9/{len(MP4)}"
    # Replacing with a link removes the uploaded file
    client.put(f"/api/v1/seller/products/{pid}/video", json={"url": "https://youtu.be/dQw4w9WgXcQ"}, headers=seller)
    assert client.get(url).status_code == 404


def test_key_points(client, seller, admin, category):
    pid = make_product(client, seller, admin, category, key_points=["  Hand  pounded ", "", "Unpolished"])
    assert client.get(f"/api/v1/products/{pid}").json()["key_points"] == ["Hand pounded", "Unpolished"]
    r = client.patch(f"/api/v1/seller/products/{pid}", json={"key_points": ["x" * 161]}, headers=seller)
    assert r.status_code == 422


def test_admin_manages_any_product_media(client, seller, admin, buyer, category):
    pid = make_product(client, seller, admin, category)
    base = f"/api/v1/admin/products/{pid}"
    assert client.patch(base, json={"key_points": ["GI-tagged"]}, headers=admin).json()["key_points"] == ["GI-tagged"]
    r = client.post(f"{base}/images", files=[("files", ("a.png", real_png(), "image/png"))] * 2, headers=admin)
    assert r.status_code == 201 and len(r.json()["images"]) == 2
    img = r.json()["images"][0]["id"]
    assert len(client.delete(f"{base}/images/{img}", headers=admin).json()["images"]) == 1
    assert client.put(f"{base}/video", json={"url": "https://youtu.be/dQw4w9WgXcQ"}, headers=admin).status_code == 200
    # Buyers and sellers can't use the admin routes
    assert client.patch(base, json={"key_points": []}, headers=buyer).status_code == 403
    assert client.patch(base, json={"key_points": []}, headers=seller).status_code == 403
