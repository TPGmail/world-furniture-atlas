#!/usr/bin/env python3
"""One-off, rate-limited Furniverse address research (not a public geocoding API).

Reads the 123 already-published business addresses, preserves audited house-level
points, researches remaining addresses through Nominatim in a single process,
and saves reusable, source-linked results. Never displays area centroids as offices.

OSMF usage policy: https://operations.osmfoundation.org/policies/nominatim/
This script is deliberately NOT invoked by the website or on a schedule.
"""
import datetime as dt
import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "site/customer-addresses.js"
EXACT = ROOT / "site/customer-verified-points.js"
OUTPUT = ROOT / "site/customer-geocoded-points.js"
AUDIT = ROOT / "CUSTOMER_LOCATION_RESEARCH.json"
NOW = dt.date.today().isoformat()
SEARCH_URL = "https://nominatim.openstreetmap.org/search"
# Contact via repository Issues; avoids storing a personal email on a public website.
USER_AGENT = "FurniverseWorldFurnitureAtlas/2.3 (one-time research; https://github.com/TPGmail/world-furniture-atlas/issues)"
REQUEST_INTERVAL = 1.3
last_request = 0.0

def load_array(path):
    raw = path.read_text(encoding="utf-8")
    begin = raw.find("[")
    end = raw.rfind("]")
    if begin < 0 or end < begin:
        raise ValueError("Cannot parse static JS array: " + str(path))
    return json.loads(raw[begin:end+1])

def norm(s):
    value = unicodedata.normalize("NFKD",str(s or "").replace("Đ","D").replace("đ","d"))
    return re.sub(r"[^a-z0-9]+"," ", "".join(c for c in value if not unicodedata.combining(c)).lower()).strip()

def normalize_query(s):
    s = re.split(r"Ngoài ra có showroom|Điện thoại:|sales@|Registered office:",s, maxsplit=1,flags=re.I)[0]
    s = re.sub(r"\s+", " ", s).strip().strip(".")
    return s

COUNTRY_WORDS = [
    ("us",r"\bUSA\b|\bUnited States\b|\bMỹ\b"),
    ("gb",r"\bUnited Kingdom\b|\bNorthern Ireland\b|\bUK\b"),
    ("vn",r"\bVietnam\b|Việt Nam"),
    ("au",r"\bAustralia\b"),
    ("dk",r"\bDenmark\b|\bDK[-, ]"),
    ("de",r"\bGermany\b"),
    ("fi",r"\bFinland\b"),
    ("ch",r"\bSwitzerland\b"),
    ("cn",r"\bChina\b|Trung Quốc"),
    ("hk",r"\bHong Kong\b"),
    ("sg",r"\bSingapore\b"),
    ("nl",r"\bNetherlands\b"),
    ("nz",r"\bNew Zealand\b"),
    ("th",r"\bThailand\b"),
    ("es",r"\bSpain\b"),
    ("se",r"\bSweden\b"),
    ("jp",r"\bJapan\b"),
    ("my",r"\bMalaysia\b"),
    ("it",r"\bItaly\b"),
    ("pl",r"\bPoland\b"),
    ("fr",r"\bFrance\b"),
    ("at",r"\bAustria\b"),
    ("be",r"\bBelgium\b"),
    ("in",r"\bIndia\b"),
    ("id",r"\bIndonesia\b"),
    ("tw",r"\bTaiwan\b"),
    ("kr",r"\bSouth Korea\b"),
    ("pt",r"\bPortugal\b"),
    ("no",r"\bNorway\b"),
    ("br",r"\bBrazil\b"),
    ("ca",r"\bCanada\b"),
]
US_STATES = "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split()

def expected_country(addr):
    matches = [iso for iso,rgx in COUNTRY_WORDS if re.search(rgx,addr,re.I)]
    if len(set(matches)) == 1: return matches[0]
    if matches: return ""
    if re.search(r"\b(?:"+"|".join(US_STATES)+r")\s+\d{5}(?:-\d{4})?\b",addr): return "us"
    if re.search(r"\b(?:NSW|VIC|SA|QLD|WA)\s+\d{4}\b",addr): return "au"
    if re.search(r"\b(?:Binh Duong|Thu Dau Mot|Thu Duc|Ho Chi Minh|HCMc|TP HCM)\b",addr,re.I): return "vn"
    if re.search(r"\b(?:Apen|Westerstede|Langweid|Merzig)\b",addr,re.I): return "de"
    if re.search(r"\b(?:Ringsted|Kolding|Ikast)\b",addr,re.I): return "dk"
    if re.search(r"\b(?:Selangor|Sunway City)\b",addr,re.I): return "my"
    return ""

def whole_phrase(needle,haystack):
    a,b=norm(needle),norm(haystack)
    return bool(a) and (" " + a + " ") in (" " + b + " ")

def token_match(text, query):
    a=[w for w in norm(text).split() if len(w)>3 and w not in {"street","road","avenue","boulevard","drive","place","parkway","building","tower","suite"}]
    n=norm(query)
    return bool(a) and any(w in n.split() for w in a)

def first_level(addr):
    for k in ("house_number","road","neighbourhood","suburb","quarter","city_district","borough","district","municipality","village","town","city","county","state"):
        if addr.get(k): return k,addr[k]
    return "", ""

def classify(row,result,expected):
    addr=result.get("address") or {}
    country=addr.get("country_code","").lower()
    if expected and country != expected: return None
    raw=row["address"]
    match=result.get("display_name","")
    if not match or not result.get("osm_id") or result.get("osm_type") not in ("node","way","relation"):
        return None
    road=addr.get("road") or addr.get("pedestrian") or addr.get("residential") or ""
    house=addr.get("house_number","")
    input_norm=norm(raw)
    display_norm=norm(match)
    postal=addr.get("postcode","")
    postcode_match=bool(postal and whole_phrase(postal,raw))
    street_match=bool(road and (whole_phrase(road,raw) or token_match(road,raw)))
    house_match=bool(house and whole_phrase(house,raw) and street_match)
    # Exact OSM address numbers are not proof that the company occupies that building.
    if house_match:
        level="address"
        detail="Số nhà/tòa nhà"
    elif result.get("class")=="highway" and street_match or road and street_match and int(result.get("place_rank",0))>=25:
        level="street"
        detail="Đường (vị trí đại diện, không phải số nhà)"
    elif postcode_match and result.get("addresstype")=="postcode":
        level="postal"
        detail="Mã bưu chính (vị trí đại diện)"
    else:
        # For area-only matches, the returned administrative name must be written
        # explicitly in the supplied address. Never accept a country-wide result.
        admin_fields=[
            ("neighbourhood","Khu phố"),("quarter","Khu vực"),("suburb","Phường/khu vực"),
            ("city_district","Quận/huyện"),("borough","Quận/huyện"),("district","Quận/huyện"),
            ("municipality","Đô thị"),("village","Xã/làng"),("town","Thị trấn"),
            ("city","Thành phố"),("county","Huyện"),("state_district","Huyện")
        ]
        level=None
        for field,label in admin_fields:
            value=addr.get(field,"")
            if value and whole_phrase(value,raw):
                # Require an actual small-area search feature, not a business object
                # which merely contains that district in its address.
                if int(result.get("place_rank",0))<12 or result.get("addresstype")=="country":
                    continue
                level="administrative"
                detail=label+": "+value+" (tọa độ đại diện)"
                break
        if level is None:
            return None
    # If we cannot confirm the country from the original address, require a
    # matched house/street/postcode, not an unsupported district-only inference.
    if not expected and level=="administrative": return None
    try:
        lat,lon=float(result["lat"]),float(result["lon"])
        if not (-90<=lat<=90 and -180<=lon<=180): return None
        osm_id=int(result["osm_id"])
        if osm_id<=0: return None
    except (ValueError,TypeError,KeyError): return None
    return {
        "id":row["id"],"checkedAddress":row["address"],
        "verificationLevel":level,"checkedAt":NOW,
        "verificationSource":"OpenStreetMap Nominatim (one-time research)",
        "lat":lat,"lon":lon,"osmType":result["osm_type"],"osmId":osm_id,
        "matchedAddress":match,"objectKind":str(result.get("class",""))+":"+str(result.get("type","")),
        "precisionLabel":detail,"countryCode":country or expected,
        "sourceUrl":"https://www.openstreetmap.org/"+result["osm_type"]+"/"+str(osm_id),
    }

def geocode(query, country):
    global last_request
    delay=REQUEST_INTERVAL-(time.monotonic()-last_request)
    if delay>0: time.sleep(delay)
    params={"q":query,"format":"jsonv2","limit":"5","addressdetails":"1","accept-language":"en"}
    if country: params["countrycodes"]=country
    target=SEARCH_URL+"?"+urllib.parse.urlencode(params)
    req=urllib.request.Request(target,headers={"User-Agent":USER_AGENT,"Accept":"application/json"})
    last_request=time.monotonic()
    try:
        with urllib.request.urlopen(req,timeout=28) as response:
            results=json.load(response)
            return results if isinstance(results,list) else []
    except urllib.error.HTTPError as exc:
        if exc.code in (403,429):
            raise RuntimeError("Nominatim blocked or rate-limited research (HTTP "+str(exc.code)+"); stop without retry") from exc
        raise

def fallback_query(address):
    short=normalize_query(address)
    parts=[part.strip() for part in short.split(",") if part.strip()]
    if len(parts)<=2: return ""
    # Try neighbourhood + city + country. Only use if Nominatim confirms
    # these names in its returned admin hierarchy.
    trailing=parts[-3:]
    if len(trailing)==3 and re.fullmatch(r"(?:USA|Vietnam|Denmark|Germany|United Kingdom|Australia|Canada|Finland|Netherlands|China|Singapore|Malaysia|Sweden|Japan|Thailand|Spain|Italy|New Zealand|Switzerland|Hong Kong|Mỹ|Việt Nam)",trailing[-1],re.I):
        # US/AU addresses often contain "City, State ZIP, Country".
        return ", ".join(trailing)
    return ", ".join(parts[-3:])

def main():
    customers=load_array(SOURCE)
    existing=load_array(EXACT)
    existing_by_id={p["id"]:p for p in existing}
    # Allow resumable manual re-runs without re-fetching a previously researched address.
    cached=load_array(OUTPUT) if OUTPUT.exists() else []
    located={p["id"]:p for p in cached if p.get("checkedAddress")==next(
        (row["address"] for row in customers if row["id"]==p["id"]),None)}
    audit={"date":NOW,"policy":"one-time; 1 thread; <=1 request/1.3sec; static cached results",
           "total":len(customers),"originalPrecise":len(existing),"rows":[]}
    errors=[]
    for index,row in enumerate(customers,1):
        rid=row["id"]
        if rid in existing_by_id:
            audit["rows"].append({"id":rid,"name":row["name"],"status":"original-verified",
                                  "precision":"address"})
            continue
        if rid in located:
            audit["rows"].append({"id":rid,"name":row["name"],"status":"cached",
                                  "precision":located[rid]["verificationLevel"]})
            continue
        address=normalize_query(row["address"])
        country=expected_country(address)
        tries=[address]
        more=fallback_query(address)
        if more and norm(more)!=norm(address): tries.append(more)
        best=None
        used=0
        for query in tries:
            try:
                results=geocode(query,country)
                used+=1
            except Exception as exc:
                if isinstance(exc,RuntimeError): raise
                errors.append({"id":rid,"query":query,"error":str(exc)})
                continue
            candidate=[classify(row,res,country) for res in results]
            ranked=[p for p in candidate if p]
            if ranked:
                rank={"address":4,"street":3,"postal":2,"administrative":1}
                best=max(ranked,key=lambda p:rank[p["verificationLevel"]])
                break
        if best:
            located[rid]=best
            status=best["verificationLevel"]
            print(f"{index:03d}/{len(customers)} {row['name']}: {status} {best['matchedAddress'][:65]}",flush=True)
        else:
            status="no-reliable-match"
            print(f"{index:03d}/{len(customers)} {row['name']}: no reliable match",flush=True)
        audit["rows"].append({"id":rid,"name":row["name"],"status":status,
                             "queries":used,
                             **({"matchedAddress":best["matchedAddress"],"source":best["sourceUrl"]}
                                if best else {})})
    # Keep all originally verified exact-address points separate and authoritative.
    ordered=[located[row["id"]] for row in customers if row["id"] in located]
    OUTPUT.write_text("/* One-time Nominatim research. Area markers are NOT office locations. */\n"
        "window.ATLAS_RESEARCHED_CUSTOMER_POINTS = "+json.dumps(ordered,ensure_ascii=False,indent=2)+";\n",encoding="utf-8")
    audit["newLocated"]=len(ordered)
    audit["missing"]=len(customers)-len(existing)-len(ordered)
    audit["byPrecision"]={level:sum(1 for p in ordered if p["verificationLevel"]==level)
                          for level in ["address","street","postal","administrative"]}
    audit["errors"]=errors
    AUDIT.write_text(json.dumps(audit,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("FINAL: "+json.dumps({k:audit[k] for k in ("total","originalPrecise","newLocated","missing","byPrecision")}),flush=True)

if __name__=="__main__":
    main()
