"""Sample B2B catalog: Tamil Nadu's GI-tagged products (food, handlooms, crafts), one sample trade seller per district.

GI names, districts and application numbers come from the GI Registry as listed on Wikipedia
("Geographical indications in India") and from Tamil Nadu agriculture department notices.
Sellers, prices, stock and order sizes are SAMPLE data for demonstrating the marketplace and
should be replaced by real authorised users.

Each product: (name, category slug, unit, price, min order, stock, tiers, description,
GI application number or None, photo file stem).
Tiers: (min qty, max qty or None, unit price).
"""

SELLERS = [
    dict(
        email="nilgiris@example.com", name="Ravi Shankar", business="Nilgiris Highland Traders",
        district="The Nilgiris", city="Ooty",
        desc="Bulk supplier of orthodox tea and bakery products from the Nilgiris hills to hotels, "
        "retailers and distributors.",
        products=[
            ("Nilgiri Orthodox Tea", "regional-specialties", "kg", 520, 10, 800,
             [(10, 49, 520), (50, 199, 485), (200, None, 450)],
             "High-grown orthodox black tea from Nilgiris estates. Bright, brisk liquor with a "
             "fragrant finish. Packed in 10 kg food-grade sacks.", "116", "nilgiri-tea"),
            ("Ooty Varkey", "homemade-foods", "kg", 360, 5, 150,
             [(5, 24, 360), (25, 99, 335), (100, None, 310)],
             "Flaky, crisp twice-baked biscuit made by Ooty bakeries. Supplied in 5 kg cartons "
             "for cafés and retail repacking.", "529", "ooty-varkey"),
        ],
    ),
    dict(
        email="kanyakumari@example.com", name="Jeyaraj S", business="Nanjil Nadu Produce Co.",
        district="Kanniyakumari", city="Nagercoil",
        desc="Aggregator for Kanniyakumari growers and bee-keepers, supplying spice traders, "
        "fruit wholesalers and food manufacturers.",
        products=[
            ("Kanniyakumari Clove", "spices", "kg", 1150, 5, 300,
             [(5, 24, 1150), (25, 99, 1090), (100, None, 1030)],
             "Bold, oil-rich cloves from the hill slopes of Kanniyakumari. Hand-picked and "
             "sun-dried; high eugenol content.", "675", "kanyakumari-clove"),
            ("Marthandam Honey", "regional-specialties", "kg", 520, 10, 600,
             [(10, 49, 520), (50, 199, 490), (200, None, 460)],
             "Raw honey from rubber-plantation apiaries around Marthandam. Supplied in 10 kg "
             "and 25 kg food-grade cans.", "800", "marthandam-honey"),
            ("Kanyakumari Matti Banana", "fruits", "kg", 70, 50, 2000,
             [(50, 199, 70), (200, 999, 64), (1000, None, 58)],
             "Small, sweet, honey-scented banana native to Kanniyakumari. Popular as baby food "
             "and in temples. Shipped in ripening-ready crates.", "757", "matti-banana"),
            ("Eathomozhy Tall Coconut", "fruits", "piece", 32, 500, 20000,
             [(500, 1999, 32), (2000, 9999, 29), (10000, None, 26)],
             "Large mature coconuts from the Eathomozhy tall variety, known for thick kernel "
             "and high oil content. Sold by the piece in lots of 500.", "110", "eathomozhy-coconut"),
        ],
    ),
    dict(
        email="dindigul@example.com", name="Muthulakshmi R", business="Palani Hills Agro Traders",
        district="Dindigul", city="Palani",
        desc="Trading hill bananas, Kodaikanal garlic and Palani panchamirtham for wholesalers "
        "and retail chains across South India.",
        products=[
            ("Palani Panchamirtham", "homemade-foods", "kg", 260, 10, 400,
             [(10, 49, 260), (50, 199, 240), (200, None, 225)],
             "Traditional temple prasadam of banana, jaggery, ghee, honey and cardamom. "
             "Made without preservatives; supplied in sealed 500 g tins packed per kg.",
             "550", "palani-panchamirtham"),
            ("Kodaikanal Malai Poondu (Hill Garlic)", "vegetables", "kg", 340, 25, 1500,
             [(25, 99, 340), (100, 499, 315), (500, None, 290)],
             "Pungent, long-keeping hill garlic grown in the Kodaikanal hills. Valued for its "
             "medicinal properties. Packed in 25 kg mesh bags.", "616", "kodaikanal-garlic"),
            ("Virupakshi Hill Banana", "fruits", "kg", 85, 50, 1500,
             [(50, 199, 85), (200, 999, 78), (1000, None, 72)],
             "Aromatic hill banana from the lower Palani hills, used in Palani panchamirtham. "
             "Long shelf life after ripening.", "124", "virupakshi-banana"),
            ("Sirumalai Hill Banana", "fruits", "kg", 80, 50, 1200,
             [(50, 199, 80), (200, 999, 74), (1000, None, 68)],
             "Distinctive sweet-sour hill banana from the Sirumalai hills near Dindigul.",
             "126", "sirumalai-banana"),
        ],
    ),
    dict(
        email="erode@example.com", name="Senthil Kumar", business="Erode Spice & Jaggery Mart",
        district="Erode", city="Erode",
        desc="Turmeric and jaggery traders from India's turmeric city, serving spice "
        "processors, exporters and FMCG buyers.",
        products=[
            ("Erode Manjal (Turmeric)", "spices", "kg", 165, 50, 10000,
             [(50, 249, 165), (250, 999, 152), (1000, None, 140)],
             "Bright yellow Erode turmeric fingers with high curcumin. Boiled, sun-dried and "
             "polished. Packed in 50 kg gunny bags.", "231", "erode-turmeric"),
            ("Kavindapadi Nattu Sakkarai", "regional-specialties", "kg", 78, 50, 5000,
             [(50, 249, 78), (250, 999, 72), (1000, None, 66)],
             "Chemical-free country sugar (jaggery powder) from the Kavindapadi belt, made from "
             "Lower Bhavani canal-irrigated sugarcane.", None, "kavindapadi-sakkarai"),
        ],
    ),
    dict(
        email="virudhunagar@example.com", name="Karthik V", business="Virudhunagar Traders",
        district="Virudhunagar", city="Virudhunagar",
        desc="Wholesale chilli and sweets supplier from the Virudhunagar trading hub.",
        products=[
            ("Virudhunagar Samba Vathal (Dry Chilli)", "spices", "kg", 230, 25, 4000,
             [(25, 99, 230), (100, 499, 215), (500, None, 200)],
             "Long, deep-red dried chillies with medium heat and strong colour, sun-dried in "
             "Virudhunagar. Packed in 25 kg bags.", None, "samba-vathal"),
            ("Srivilliputtur Palkova", "regional-specialties", "kg", 420, 5, 200,
             [(5, 24, 420), (25, 99, 395), (100, None, 370)],
             "Rich milk sweet slow-cooked from the milk of cows grazing in the Western Ghats "
             "foothills. Supplied chilled in 1 kg trays.", "403", "srivilliputtur-palkova"),
        ],
    ),
    dict(
        email="thoothukudi@example.com", name="Arul Selvi", business="Thoothukudi Coastal Foods",
        district="Thoothukudi", city="Kovilpatti",
        desc="Sweets, palm jaggery and betel leaves from Thoothukudi district for distributors "
        "and retail chains.",
        products=[
            ("Kovilpatti Kadalai Mittai", "regional-specialties", "kg", 190, 10, 1200,
             [(10, 49, 190), (50, 199, 175), (200, None, 160)],
             "Peanut candy made with Thamirabarani-water jaggery and hand-selected groundnuts. "
             "Supplied in 10 kg cartons of 200 g packs.", "486", "kovilpatti-kadalai-mittai"),
            ("Udangudi Panangkarupatti (Palm Jaggery)", "regional-specialties", "kg", 340, 10, 900,
             [(10, 49, 340), (50, 199, 315), (200, None, 295)],
             "Palm jaggery from palmyra sap tapped in the red-soil Udangudi region. No added "
             "sugar or chemicals.", "691", "udangudi-karupatti"),
            ("Authoor Vetrilai (Betel Leaf)", "regional-specialties", "bundle", 160, 20, 1000,
             [(20, 99, 160), (100, 499, 148), (500, None, 135)],
             "Pungent betel leaves grown on the banks of the Thamirabarani near Authoor. Sold "
             "by the bundle of 100 leaves.", "719", "authoor-vetrilai"),
        ],
    ),
    dict(
        email="ramnad@example.com", name="Abdul Rahman", business="Ramnad Farm Produce",
        district="Ramanathapuram", city="Ramanathapuram",
        desc="Dryland chillies and heritage rice from Ramanathapuram's rain-fed farms.",
        products=[
            ("Ramanathapuram Mundu Chilli", "spices", "kg", 260, 25, 3000,
             [(25, 99, 260), (100, 499, 242), (500, None, 225)],
             "Round, thick-skinned chilli with a bright red colour and gentle heat, grown "
             "rain-fed in Ramanathapuram.", "720", "mundu-chilli"),
            ("Ramanadu Chithiraikar Rice", "rice-grains", "kg", 95, 50, 6000,
             [(50, 249, 95), (250, 999, 88), (1000, None, 82)],
             "Drought-hardy traditional red rice grown in the Chithirai season in "
             "Ramanathapuram. Unpolished; packed in 25 kg bags.", None, "chithiraikar-rice"),
        ],
    ),
    dict(
        email="vellore@example.com", name="Prakash M", business="Vellore Vegetable Growers",
        district="Vellore", city="Vellore",
        desc="Growers' group supplying fresh vegetables to wholesale markets and caterers.",
        products=[
            ("Vellore Spiny Brinjal", "vegetables", "kg", 48, 50, 3000,
             [(50, 199, 48), (200, 999, 44), (1000, None, 40)],
             "Thorny-stemmed brinjal with tender flesh and few seeds, prized for kuzhambu and "
             "biryani gravies.", "788", "vellore-brinjal"),
        ],
    ),
    dict(
        email="manapparai@example.com", name="Lakshmi Narayanan", business="Manapparai Snack Makers",
        district="Tiruchirappalli", city="Manapparai",
        desc="Traditional snack makers supplying sweet shops, supermarkets and caterers.",
        products=[
            ("Manapparai Murukku", "homemade-foods", "kg", 320, 10, 600,
             [(10, 49, 320), (50, 199, 298), (200, None, 280)],
             "Crunchy rice murukku made with Manapparai's salty groundwater, which gives it its "
             "signature taste. Packed in 10 kg cartons.", "488", "manapparai-murukku"),
        ],
    ),
    dict(
        email="salem@example.com", name="Gowri Shankar", business="Salem Sago Exports",
        district="Salem", city="Salem",
        desc="Tapioca sago supplier to food processors, caterers and exporters.",
        products=[
            ("Salem Sago (Javvarisi)", "regional-specialties", "kg", 72, 50, 10000,
             [(50, 249, 72), (250, 999, 67), (1000, None, 62)],
             "Uniform, bright-white tapioca pearls from Salem's sago factories. Packed in 50 kg "
             "bags.", "711", "salem-sago"),
        ],
    ),
    dict(
        email="cumbum@example.com", name="Pandian K", business="Cumbum Valley Grape Growers",
        district="Theni", city="Cumbum",
        desc="Grape growers from the Cumbum valley, harvesting almost all year round.",
        products=[
            ("Cumbum Panneer Thratchai (Grapes)", "fruits", "kg", 90, 50, 4000,
             [(50, 199, 90), (200, 999, 83), (1000, None, 76)],
             "Muscat Hamburg grapes from the Cumbum valley, with a rose-water aroma and deep "
             "purple colour. Shipped in 8 kg crates.", "734", "cumbum-grapes"),
        ],
    ),
    dict(
        email="sholavandan@example.com", name="Meenakshi Sundaram", business="Sholavandan Betel Traders",
        district="Madurai", city="Sholavandan",
        desc="Betel leaf traders supplying markets across Tamil Nadu and Kerala.",
        products=[
            ("Sholavandan Vetrilai (Betel Leaf)", "regional-specialties", "bundle", 150, 20, 1200,
             [(20, 99, 150), (100, 499, 138), (500, None, 126)],
             "Tender, mildly pungent betel leaves grown along the Vaigai at Sholavandan. Sold by "
             "the bundle of 100 leaves.", "789", "sholavandan-vetrilai"),
        ],
    ),
    dict(
        email="kumbakonam@example.com", name="Venkatesh R", business="Kumbakonam Betel Growers",
        district="Thanjavur", city="Kumbakonam",
        desc="Delta betel growers supplying wholesale markets and temples.",
        products=[
            ("Kumbakonam Vetrilai (Betel Leaf)", "regional-specialties", "bundle", 155, 20, 1000,
             [(20, 99, 155), (100, 499, 142), (500, None, 130)],
             "Broad, glossy betel leaves from the Cauvery delta around Kumbakonam. Sold by the "
             "bundle of 100 leaves.", None, "kumbakonam-vetrilai"),
        ],
    ),
    dict(
        email="panruti@example.com", name="Elango P", business="Panruti Orchard Traders",
        district="Cuddalore", city="Panruti",
        desc="Jackfruit and cashew from Panruti's red-soil orchards for processors and "
        "wholesalers.",
        products=[
            ("Panruti Palappazham (Jackfruit)", "fruits", "kg", 45, 100, 5000,
             [(100, 499, 45), (500, 1999, 41), (2000, None, 37)],
             "Sweet, firm-bulbed jackfruit from Panruti's red laterite soil. Sold by weight in "
             "whole fruits.", None, "panruti-jackfruit"),
            ("Panruti Cashew (W240)", "regional-specialties", "kg", 880, 10, 1500,
             [(10, 49, 880), (50, 199, 840), (200, None, 800)],
             "Whole W240 cashew kernels processed in Panruti. Vacuum-packed in 10 kg tins.",
             None, "panruti-cashew"),
        ],
    ),
    dict(
        email="puliyankudi@example.com", name="Mariappan S", business="Puliyankudi Citrus Traders",
        district="Tenkasi", city="Puliyankudi",
        desc="Acid lime traders from the 'lemon city' of Tamil Nadu.",
        products=[
            ("Puliyankudi Acid Lime", "fruits", "kg", 75, 50, 3000,
             [(50, 199, 75), (200, 999, 69), (1000, None, 63)],
             "Thin-skinned, very juicy acid limes from Puliyankudi. Supplied in 25 kg crates "
             "for juice bars, hotels and pickle makers.", None, "puliyankudi-lime"),
        ],
    ),
    dict(
        email="chettikulam@example.com", name="Kalaiselvi T", business="Chettikulam Onion Growers",
        district="Perambalur", city="Chettikulam",
        desc="Small onion growers' collective supplying wholesale markets and processors.",
        products=[
            ("Chettikulam Small Onion", "vegetables", "kg", 58, 100, 8000,
             [(100, 499, 58), (500, 1999, 53), (2000, None, 48)],
             "Pungent small onions (shallots) with a long storage life, grown in Chettikulam's "
             "black soil. Packed in 50 kg mesh bags.", None, "chettikulam-onion"),
        ],
    ),
    dict(
        email="kanchi@example.com", name="Saravanan G", business="Kanchi Heritage Rice",
        district="Kanchipuram", city="Kanchipuram",
        desc="Traditional rice varieties for retailers, restaurants and organic stores.",
        products=[
            ("Thooyamalli Rice", "rice-grains", "kg", 110, 50, 5000,
             [(50, 249, 110), (250, 999, 102), (1000, None, 95)],
             "Fragrant, jasmine-white traditional samba rice. Soft and easy to digest. "
             "Packed in 25 kg bags.", None, "thooyamalli-rice"),
        ],
    ),
]

# Handlooms, handicrafts, home & kitchen and flowers.
SELLERS += [
    dict(
        email="kanchisilk@example.com", name="Murugesan K", business="Kanchi Silk Weavers",
        district="Kanchipuram", city="Kanchipuram",
        desc="Weavers' cooperative supplying pure mulberry silk sarees to boutiques, textile "
        "showrooms and exporters.",
        products=[
            ("Kanchipuram Silk Saree", "sarees-handlooms", "piece", 14500, 5, 120,
             [(5, 19, 14500), (20, 49, 13600), (50, None, 12800)],
             "Pure mulberry silk saree with real zari, woven with the korvai technique that joins "
             "a contrast border to the body. Each piece carries the silk mark.", "15", "kanchipuram-silk"),
        ],
    ),
    dict(
        email="tiruvannamalai@example.com", name="Devi Ramesh", business="Tiruvannamalai Handloom & Crafts",
        district="Tiruvannamalai", city="Arani",
        desc="Silk sarees from Arani's looms and Jaderi namakatti for retailers and temple stores.",
        products=[
            ("Arani Silk Saree", "sarees-handlooms", "piece", 6800, 5, 200,
             [(5, 19, 6800), (20, 49, 6350), (50, None, 5900)],
             "Lightweight silk saree from Arani with contrast borders and fine zari, popular for "
             "everyday and festive wear.", "92", "arani-silk"),
            ("Jaderi Namakatti", "handicrafts", "box", 450, 10, 500,
             [(10, 49, 450), (50, 199, 410), (200, None, 380)],
             "Traditional namam sticks made from Jaderi's white clay, used for religious marks. "
             "Box of 100 sticks.", "698", "jaderi-namakatti"),
        ],
    ),
    dict(
        email="thanjavurart@example.com", name="Ganesan S", business="Thanjavur Art & Crafts House",
        district="Thanjavur", city="Thanjavur",
        desc="Thanjavur's heritage crafts for gift shops, hotels, corporate gifting and exporters.",
        products=[
            ("Thanjavur Painting", "handicrafts", "piece", 9500, 2, 60,
             [(2, 9, 9500), (10, 24, 8900), (25, None, 8300)],
             "Classical painting on wood with gesso relief, 22-carat gold foil and semi-precious "
             "stones. 15 × 12 inch, framed.", "47", "thanjavur-painting"),
            ("Thanjavur Art Plate", "handicrafts", "piece", 2400, 5, 150,
             [(5, 24, 2400), (25, 99, 2200), (100, None, 2000)],
             "Brass, copper and silver repoussé art plate with embossed deity motifs. 8-inch "
             "plate with stand — a classic corporate gift.", "63", "thanjavur-art-plate"),
            ("Swamimalai Bronze Icon", "handicrafts", "piece", 18000, 1, 40,
             [(1, 4, 18000), (5, 9, 16800), (10, None, 15500)],
             "Panchaloha icon made by the lost-wax process by Swamimalai sthapathis. 12-inch "
             "Nataraja; other deities on order.", "64", "swamimalai-bronze"),
            ("Thanjavur Doll (Thalaiyatti Bommai)", "handicrafts", "piece", 380, 25, 600,
             [(25, 99, 380), (100, 499, 345), (500, None, 310)],
             "Hand-painted terracotta and papier-mâché bobble-head doll that keeps swaying. "
             "Pair of 6-inch dolls.", "96", "thanjavur-doll"),
            ("Thanjavur Netti Works", "handicrafts", "piece", 1500, 5, 120,
             [(5, 24, 1500), (25, 99, 1380), (100, None, 1260)],
             "Delicate temple and gopuram models carved from netti (sola pith). Supplied in a "
             "glass case.", "423", "thanjavur-netti"),
            ("Karuppur Kalamkari Painting", "handicrafts", "piece", 3200, 5, 80,
             [(5, 19, 3200), (20, 49, 2950), (50, None, 2700)],
             "Hand-painted kalamkari on cotton using natural dyes, a temple-cloth tradition of "
             "Karuppur. 3 × 2 ft panel.", "424", "karuppur-kalamkari"),
        ],
    ),
    dict(
        email="kumbakonamheritage@example.com", name="Raghavan N", business="Kumbakonam Heritage Emporium",
        district="Thanjavur", city="Kumbakonam",
        desc="Musical instruments, lamps and silk sarees from the Kumbakonam belt.",
        products=[
            ("Thirubuvanam Silk Saree", "sarees-handlooms", "piece", 9800, 5, 100,
             [(5, 19, 9800), (20, 49, 9200), (50, None, 8600)],
             "Rich silk saree from the Thirubuvanam weavers' society near Kumbakonam, known for "
             "its heavy body and traditional motifs.", "480", "thirubuvanam-silk"),
            ("Thanjavur Veena", "handicrafts", "piece", 42000, 1, 15,
             [(1, 2, 42000), (3, 4, 40000), (5, None, 38000)],
             "Saraswati veena carved from a single block of jackwood by Thanjavur craftsmen, "
             "with hand-painted decoration.", "209", "thanjavur-veena"),
            ("Narasinghapettai Nagaswaram", "handicrafts", "piece", 28000, 1, 12,
             [(1, 2, 28000), (3, 4, 26500), (5, None, 25000)],
             "Temple wind instrument turned from aacha wood in Narasinghapettai village, tuned "
             "by hand.", "467", "narasinghapettai-nagaswaram"),
            ("Nachiarkoil Kuthuvilakku (Brass Lamp)", "home-kitchen", "piece", 3600, 5, 150,
             [(5, 24, 3600), (25, 99, 3350), (100, None, 3100)],
             "Five-faced brass oil lamp cast in Nachiarkoil using sand moulds. 18-inch.",
             "196", "nachiarkoil-lamp"),
        ],
    ),
    dict(
        email="salemhandloom@example.com", name="Kannan P", business="Salem Handloom Weavers",
        district="Salem", city="Salem",
        desc="Handloom fabrics and silk dhotis from Salem for garment makers and retailers.",
        products=[
            ("Salem Venpattu (Silk Dhoti)", "sarees-handlooms", "piece", 3400, 10, 300,
             [(10, 49, 3400), (50, 199, 3150), (200, None, 2900)],
             "Pure white silk dhoti with a fine zari border, woven on Salem handlooms.", "94", "salem-silk"),
            ("Salem Handloom Fabric", "sarees-handlooms", "piece", 260, 100, 5000,
             [(100, 499, 260), (500, 1999, 238), (2000, None, 220)],
             "Durable handloom cotton fabric from Salem, sold by the metre (1 piece = 1 metre). "
             "For garment makers and home-textile brands.", "5", "salem-fabric"),
        ],
    ),
    dict(
        email="kovaihandloom@example.com", name="Radha Krishnan", business="Kovai Handloom Co-op",
        district="Coimbatore", city="Coimbatore",
        desc="Cotton sarees from Coimbatore district's handloom clusters.",
        products=[
            ("Kovai Kora Cotton Saree", "sarees-handlooms", "piece", 2200, 10, 300,
             [(10, 49, 2200), (50, 199, 2050), (200, None, 1900)],
             "Kora cotton blended with silk for a crisp, light drape. Woven in Coimbatore.", "93", "kovai-kora"),
            ("Negamam Cotton Saree", "sarees-handlooms", "piece", 1650, 10, 400,
             [(10, 49, 1650), (50, 199, 1530), (200, None, 1420)],
             "Soft, fine-count cotton saree from Negamam near Pollachi, with traditional checks "
             "and stripes.", "766", "negamam-saree"),
        ],
    ),
    dict(
        email="wetgrinder@example.com", name="Sundaram Iyer", business="Coimbatore Wet Grinder Works",
        district="Coimbatore", city="Coimbatore",
        desc="Wet grinder manufacturer supplying dealers, hotels and canteens.",
        products=[
            ("Coimbatore Wet Grinder", "home-kitchen", "piece", 5400, 5, 200,
             [(5, 19, 5400), (20, 99, 5050), (100, None, 4700)],
             "Stone wet grinder made in Coimbatore for idli and dosa batter. 2-litre table-top "
             "model; commercial 10–40 litre models on order.", "26", "coimbatore-wet-grinder"),
        ],
    ),
    dict(
        email="madurai@example.com", name="Sowmya V", business="Madurai Sungudi & Malli Traders",
        district="Madurai", city="Madurai",
        desc="Sungudi sarees and fresh Madurai malli for retailers, event planners and temples.",
        products=[
            ("Madurai Sungudi Saree", "sarees-handlooms", "piece", 1450, 10, 500,
             [(10, 49, 1450), (50, 199, 1340), (200, None, 1240)],
             "Cotton saree with tie-and-dye dots made by Madurai's Saurashtra community.", "21", "madurai-sungudi"),
            ("Madurai Malli (Jasmine)", "flowers", "kg", 850, 5, 300,
             [(5, 24, 850), (25, 99, 790), (100, None, 730)],
             "Highly fragrant jasmine buds from Madurai, picked at dawn and shipped the same day. "
             "Price varies with season.", "238", "madurai-malli"),
        ],
    ),
    dict(
        email="chettinad@example.com", name="Valliammai A", business="Chettinad Heritage Store",
        district="Sivaganga", city="Karaikudi",
        desc="Chettinad sarees, palm-leaf baskets and Manamadurai pottery for boutiques and "
        "hotels.",
        products=[
            ("Kandangi Saree", "sarees-handlooms", "piece", 1850, 10, 400,
             [(10, 49, 1850), (50, 199, 1720), (200, None, 1600)],
             "Bold-checked Chettinad cotton saree with wide contrast borders, woven around "
             "Karaikudi.", "422", "kandangi-saree"),
            ("Chettinad Kottan (Palm Leaf Basket)", "handicrafts", "piece", 280, 50, 1500,
             [(50, 199, 280), (200, 999, 255), (1000, None, 230)],
             "Colourful baskets woven from palmyra leaves by Chettinad women. Popular as return "
             "gifts and packaging.", "200", "chettinad-kottan"),
            ("Manamadurai Pottery", "home-kitchen", "piece", 320, 25, 800,
             [(25, 99, 320), (100, 499, 290), (500, None, 260)],
             "Clay cooking and water pots from Manamadurai's special clay, fired for strength. "
             "Medium cooking pot.", "561", "manamadurai-pottery"),
        ],
    ),
    dict(
        email="tirunelveli@example.com", name="Esakki Muthu", business="Tirunelveli Crafts Collective",
        district="Tirunelveli", city="Tirunelveli",
        desc="Mats, sarees and wooden toys from Tirunelveli's craft villages.",
        products=[
            ("Pattamadai Pai (Silk Mat)", "handicrafts", "piece", 4200, 5, 120,
             [(5, 19, 4200), (20, 49, 3900), (50, None, 3600)],
             "Ultra-fine korai grass mat woven in Pattamadai, soft enough to fold like cloth. "
             "6 × 4 ft.", "195", "pattamadai-mat"),
            ("Chedibutta Saree", "sarees-handlooms", "piece", 1550, 10, 400,
             [(10, 49, 1550), (50, 199, 1440), (200, None, 1340)],
             "Cotton saree with the traditional 'chedi' (plant) butta motif, woven in "
             "Tirunelveli district.", "762", "chedibutta-saree"),
            ("Ambasamudram Choppu Saman (Wooden Toys)", "handicrafts", "box", 650, 20, 500,
             [(20, 99, 650), (100, 499, 590), (500, None, 540)],
             "Lacquered wooden toy kitchen set turned in Ambasamudram. Box of 12 pieces.", None, "ambasamudram-toys"),
        ],
    ),
    dict(
        email="woraiyur@example.com", name="Selvam R", business="Woraiyur Weavers",
        district="Tiruchirappalli", city="Tiruchirappalli",
        desc="Cotton sarees from Woraiyur's handloom weavers.",
        products=[
            ("Woraiyur Cotton Saree", "sarees-handlooms", "piece", 1350, 10, 400,
             [(10, 49, 1350), (50, 199, 1250), (200, None, 1160)],
             "Light, breathable cotton saree woven at Manamedu near Tiruchi, with temple and "
             "check borders.", None, "woraiyur-saree"),
        ],
    ),
    dict(
        email="bhavani@example.com", name="Palanisamy K", business="Bhavani Jamakkalam Weavers",
        district="Erode", city="Bhavani",
        desc="Handloom cotton durries for hotels, temples, wedding halls and retailers.",
        products=[
            ("Bhavani Jamakkalam (Cotton Durrie)", "sarees-handlooms", "piece", 1250, 10, 600,
             [(10, 49, 1250), (50, 199, 1150), (200, None, 1060)],
             "Thick, colourful handloom cotton carpet woven in Bhavani. 6 × 9 ft.", "16", "bhavani-jamakkalam"),
        ],
    ),
    dict(
        email="toda@example.com", name="Pothili K", business="Toda Embroidery Collective",
        district="The Nilgiris", city="Ooty",
        desc="Toda women's embroidery collective supplying boutiques and museum shops.",
        products=[
            ("Toda Embroidery Shawl (Pukhoor)", "sarees-handlooms", "piece", 3800, 5, 80,
             [(5, 19, 3800), (20, 49, 3550), (50, None, 3300)],
             "Hand-embroidered red-and-black geometric shawl made by Toda women of the Nilgiris.",
             "135", "toda-embroidery"),
        ],
    ),
    dict(
        email="nagercoilcrafts@example.com", name="Antony Raj", business="Nagercoil Heritage Crafts",
        district="Kanniyakumari", city="Nagercoil",
        desc="Temple jewellery, stone carvings and Thovalai flower garlands from Kanniyakumari.",
        products=[
            ("Nagercoil Temple Jewellery Set", "handicrafts", "piece", 6500, 5, 100,
             [(5, 19, 6500), (20, 49, 6050), (50, None, 5600)],
             "Gold-plated silver temple jewellery with kemp stones, made in Vadasery, Nagercoil. "
             "Necklace and earring set for classical dancers and brides.", "65", "nagercoil-temple-jewellery"),
            ("Myladi Stone Carving", "handicrafts", "piece", 7500, 2, 40,
             [(2, 9, 7500), (10, 24, 7000), (25, None, 6500)],
             "Granite sculpture carved by Myladi stone artisans. 18-inch deity or garden piece.",
             "428", "myladi-stone"),
            ("Thovalai Flower Garland", "flowers", "piece", 450, 20, 300,
             [(20, 99, 450), (100, 499, 410), (500, None, 380)],
             "Hand-tied garland from the Thovalai flower market, made to order for temples and "
             "events. 4 ft.", None, "thovalai-garland"),
        ],
    ),
    dict(
        email="mamallapuram@example.com", name="Velu Sthapathi", business="Mamallapuram Stone Artisans",
        district="Chengalpattu", city="Mamallapuram",
        desc="Stone sculptors carrying on the Pallava tradition, for temples, hotels and "
        "landscapers.",
        products=[
            ("Mahabalipuram Stone Sculpture", "handicrafts", "piece", 12000, 1, 30,
             [(1, 4, 12000), (5, 9, 11200), (10, None, 10400)],
             "Hand-carved granite sculpture by Mamallapuram sthapathis. 2-ft deity; custom "
             "sizes on order.", "426", "mahabalipuram-sculpture"),
        ],
    ),
    dict(
        email="dindigullocks@example.com", name="Abdul Kareem", business="Dindigul Lock Works",
        district="Dindigul", city="Dindigul",
        desc="Hand-made security locks for hardware dealers, temples and institutions.",
        products=[
            ("Dindigul Lock", "home-kitchen", "piece", 950, 20, 600,
             [(20, 99, 950), (100, 499, 880), (500, None, 820)],
             "Hand-made iron and brass lever lock with a trick mechanism, built in Dindigul. "
             "Medium door lock with 2 keys.", "400", "dindigul-lock"),
        ],
    ),
    dict(
        email="arumbavur@example.com", name="Rajendran C", business="Arumbavur Wood Carvers",
        district="Perambalur", city="Arumbavur",
        desc="Temple and decor wood carvers taking bulk and custom orders.",
        products=[
            ("Arumbavur Wood Carving", "handicrafts", "piece", 8500, 2, 40,
             [(2, 9, 8500), (10, 24, 7900), (25, None, 7300)],
             "Carved panel in vaagai and illupai wood with deity and floral motifs. 2 × 1.5 ft.",
             "429", "arumbavur-wood"),
        ],
    ),
    dict(
        email="kallakurichi@example.com", name="Murthy K", business="Kallakurichi Wood Carvers",
        district="Kallakurichi", city="Chinnasalem",
        desc="Wood carvers known for temple cars, doors and furniture.",
        products=[
            ("Kallakurichi Wood Carving", "handicrafts", "piece", 11000, 1, 30,
             [(1, 4, 11000), (5, 9, 10300), (10, None, 9600)],
             "Intricately carved teak panel in the Kallakurichi temple-car style. 3 × 2 ft.",
             "431", "kallakurichi-wood"),
        ],
    ),
    dict(
        email="thaikkal@example.com", name="Shahul Hameed", business="Thaikkal Rattan Crafts",
        district="Mayiladuthurai", city="Thaikkal",
        desc="Cane and rattan furniture makers supplying resorts, cafés and retailers.",
        products=[
            ("Thaikkal Rattan Chair", "handicrafts", "piece", 4800, 5, 100,
             [(5, 19, 4800), (20, 49, 4450), (50, None, 4100)],
             "Hand-woven rattan armchair from Thaikkal village, light and weather-resistant.",
             "574", "thaikkal-rattan"),
        ],
    ),
    dict(
        email="namakkal@example.com", name="Sivakumar M", business="Namakkal Soapstone Cookware",
        district="Namakkal", city="Namakkal",
        desc="Soapstone cookware makers supplying restaurants and kitchenware stores.",
        products=[
            ("Namakkal Makkal Pathiram (Soapstone Pot)", "home-kitchen", "piece", 1400, 10, 300,
             [(10, 49, 1400), (50, 199, 1290), (200, None, 1190)],
             "Hand-carved soapstone (kalchatti) cooking pot that holds heat for slow cooking. "
             "2-litre, pre-seasoned.", None, "namakkal-soapstone"),
        ],
    ),
    dict(
        email="leather@example.com", name="Imran Basha", business="Ranipet Leather Traders",
        district="Ranipet", city="Ranipet",
        desc="Vegetable-tanned leather supplier to footwear and leather-goods makers.",
        products=[
            ("East India (E.I.) Tanned Leather", "handicrafts", "kg", 780, 50, 3000,
             [(50, 199, 780), (200, 999, 730), (1000, None, 680)],
             "Traditional vegetable-tanned E.I. leather from Tamil Nadu's tanning belt, for "
             "footwear, bags and bookbinding.", "95", "east-india-leather"),
        ],
    ),
]

# Emails of the earlier demo catalog, removed when this catalog is loaded.
OLD_DEMO_EMAILS = [
    "farmer@example.com",
    "karuvadu@example.com",
    "spices@example.com",
    "kongu@example.com",
]
